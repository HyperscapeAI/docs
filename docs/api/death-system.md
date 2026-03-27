# Death System API Reference

Complete API documentation for the player death system, including utilities, types, and event handling.

## Overview

The death system was completely rewritten in March 2026 (PR #1094) to fix SQLite deadlock issues, prevent equipment duplication, and implement OSRS-style "keep 3 most valuable items" mechanics for safe zone deaths.

## Core Modules

### DeathUtils (`packages/shared/src/systems/shared/combat/DeathUtils.ts`)

Pure utility functions for the player death pipeline. All functions are stateless and side-effect-free.

#### Constants

##### `GRAVESTONE_ID_PREFIX`

```typescript
export const GRAVESTONE_ID_PREFIX = "gravestone_"
```

Prefix for gravestone entity IDs. Used in ID generation and filtering to distinguish gravestones from player entities.

**Usage**:
```typescript
const gravestoneId = `${GRAVESTONE_ID_PREFIX}${playerId}_${Date.now()}`;

// Filter out gravestone destruction events
if (entityId.startsWith(GRAVESTONE_ID_PREFIX)) {
  return; // Not a player death
}
```

##### `ITEMS_KEPT_ON_DEATH`

```typescript
export const ITEMS_KEPT_ON_DEATH = 3
```

OSRS-style constant for number of most valuable items kept on death in safe zones.

**Reference**: [OSRS Wiki - Items Kept on Death](https://oldschool.runescape.wiki/w/Items_Kept_on_Death)

##### `POSITION_VALIDATION`

```typescript
export const POSITION_VALIDATION = {
  WORLD_BOUNDS: 10000,  // Max 10km from origin
  MAX_HEIGHT: 500,      // Max height
  MIN_HEIGHT: -50,      // Allow some underground (caves)
} as const
```

Position validation constants for world bounds checking.

#### Functions

##### `sanitizeKilledBy()`

```typescript
export function sanitizeKilledBy(killedBy: unknown): string
```

Sanitize killedBy string to prevent injection attacks.

**Security Features**:
- Normalizes Unicode to prevent homograph attacks (Cyrillic 'а' vs Latin 'a')
- Removes zero-width characters and BiDi overrides that could manipulate display
- Removes control characters and dangerous HTML characters
- Limits length to prevent buffer overflow attacks
- Defaults to "unknown" for invalid inputs

**Parameters**:
- `killedBy` - Raw killer identifier (string, entity ID, or unknown type)

**Returns**: Sanitized string (max 64 characters) or "unknown"

**Example**:
```typescript
const killedBy = sanitizeKilledBy(event.killedBy);
// "Goblin" - safe for display
// "<script>alert(1)</script>" → "scriptalert(1)/script"
// "Gоblin" (Cyrillic 'о') → normalized to consistent form
```

##### `getItemValue()`

```typescript
export function getItemValue(itemId: string): number
```

Get the value of an item from manifest data.

**Parameters**:
- `itemId` - Item identifier string

**Returns**: Item value from manifest, or 0 for unknown items (they sort to bottom and get dropped first)

**Example**:
```typescript
const value = getItemValue("rune_scimitar"); // 15000
const unknownValue = getItemValue("invalid_item"); // 0
```

##### `splitItemsForSafeDeath()`

```typescript
export function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number,
): { kept: InventoryItem[]; dropped: InventoryItem[] }
```

Split items into "kept" and "dropped" lists for safe zone deaths (OSRS-style). Keeps the N most valuable individual items. For stacked items (quantity > 1), each unit counts as one item but only the top N units across all stacks are kept.

**Algorithm**: O(n log n) on unique items — does NOT expand stacks into individual entries, avoiding memory explosion for large quantities (e.g. 10,000 arrows).

**Parameters**:
- `allItems` - Combined inventory + equipment items
- `keepCount` - Number of items to keep (typically `ITEMS_KEPT_ON_DEATH = 3`)

**Returns**: Object with `kept` (items retained by player) and `dropped` (items for gravestone)

**Example**:
```typescript
const allItems = [
  { itemId: "rune_scimitar", quantity: 1, ... },  // value: 15000
  { itemId: "dragon_med_helm", quantity: 1, ... }, // value: 58000
  { itemId: "coins", quantity: 10000, ... },       // value: 1 each
  { itemId: "lobster", quantity: 20, ... },        // value: 100 each
];

const { kept, dropped } = splitItemsForSafeDeath(allItems, 3);
// kept: [dragon_med_helm (1), rune_scimitar (1), lobster (1)]
// dropped: [coins (10000), lobster (19)]
```

**Stack Handling**:
- Stacks are NOT expanded into individual entries (prevents OOM)
- Greedy quantity assignment: keeps top N units across all stacks
- Deterministic tiebreaking: original index used when values are equal

##### `validatePosition()`

```typescript
export function validatePosition(position: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } | null
```

Validate and clamp a position to world bounds.

**Parameters**:
- `position` - Position to validate

**Returns**: Validated and clamped position, or `null` if completely invalid (NaN, Infinity)

**Example**:
```typescript
const pos = validatePosition({ x: 99999, y: NaN, z: -200 });
// null (NaN detected)

const pos2 = validatePosition({ x: 99999, y: 50, z: -200 });
// { x: 10000, y: 50, z: -200 } (x clamped to WORLD_BOUNDS)
```

##### `isPositionInBounds()`

```typescript
export function isPositionInBounds(position: {
  x: number;
  y: number;
  z: number;
}): boolean
```

Check if position is within world bounds without clamping.

**Parameters**:
- `position` - Position to check

**Returns**: `true` if within bounds, `false` otherwise

**Example**:
```typescript
isPositionInBounds({ x: 5000, y: 100, z: -3000 }); // true
isPositionInBounds({ x: 99999, y: 100, z: 0 });    // false
```

##### `isValidPositionNumber()`

```typescript
export function isValidPositionNumber(n: number): boolean
```

Check if a number is valid for position use (finite, not NaN).

**Parameters**:
- `n` - Number to validate

**Returns**: `true` if finite, `false` for NaN/Infinity

**Example**:
```typescript
isValidPositionNumber(42);       // true
isValidPositionNumber(NaN);      // false
isValidPositionNumber(Infinity); // false
```

### DeathTypes (`packages/shared/src/systems/shared/combat/DeathTypes.ts`)

Shared type definitions for the player death pipeline. Extracted from PlayerDeathSystem to reduce file size and allow reuse across death-related modules.

#### Interfaces

##### `PlayerSystemLike`

Duck-typed interface for PlayerSystem.

```typescript
export interface PlayerSystemLike {
  players?: Map<string, { position?: { x: number; y: number; z: number } }>;
}
```

##### `DatabaseSystemLike`

Duck-typed interface for DatabaseSystem with transaction support.

```typescript
export interface DatabaseSystemLike {
  executeInTransaction: (
    fn: (tx: TransactionContext) => Promise<void>,
  ) => Promise<void>;
}
```

##### `EquipmentSystemLike`

Duck-typed interface for EquipmentSystem.

```typescript
export interface EquipmentSystemLike {
  getPlayerEquipment: (playerId: string) => EquipmentData | null;
  clearEquipmentImmediate?: (playerId: string) => Promise<void>;
  /** Atomic clear-and-return for death system */
  clearEquipmentAndReturn?: (
    playerId: string,
    tx?: TransactionContext,
  ) => Promise<Array<{ itemId: string; slot: string; quantity: number }>>;
}
```

**Key Method**: `clearEquipmentAndReturn()` - Atomic read-and-clear operation that prevents item duplication if server crashes between read and clear.

##### `PlayerEntityLike`

Duck-typed interface for player entities in the death pipeline.

```typescript
export interface PlayerEntityLike {
  emote?: string;
  data?: {
    e?: string;
    visible?: boolean;
    name?: string;
    position?: number[];
    /** Death state fields (single source of truth) */
    deathState?: DeathState;
    deathPosition?: [number, number, number];
    respawnTick?: number;
  };
  node?: {
    position: { set: (x: number, y: number, z: number) => void };
  };
  position?: { x: number; y: number; z: number };
  setHealth?: (health: number) => void;
  getMaxHealth?: () => number;
  markNetworkDirty?: () => void;
}
```

##### `DeathLocationDataWithHeadstone`

Extended death location data with headstone tracking.

```typescript
export interface DeathLocationDataWithHeadstone extends DeathLocationData {
  headstoneId?: string;
}
```

## Events

### Deprecated Events

#### `PLAYER_DIED`

**Status**: DEPRECATED (as of March 26, 2026)

**Replacement**: Use `PLAYER_SET_DEAD` for client death UI, or `ENTITY_DEATH` for server-side death processing.

**Migration**:
```typescript
// ❌ OLD (deprecated)
world.on(EventType.PLAYER_DIED, (data: { playerId: string }) => {
  handlePlayerDeath(data.playerId);
});

// ✅ NEW (use ENTITY_DEATH with type filter)
world.on(EventType.ENTITY_DEATH, (data: { 
  entityId: string; 
  entityType: string;
  killedBy?: string;
  deathPosition?: { x: number; y: number; z: number };
}) => {
  if (data.entityType === 'player') {
    handlePlayerDeath(data.entityId);
  }
});
```

### Current Events

#### `ENTITY_DEATH`

Unified death event for all entity types (players, mobs, NPCs).

**Payload**:
```typescript
{
  entityId: string;
  entityType: 'player' | 'mob' | 'npc';
  killedBy?: string;
  deathPosition?: { x: number; y: number; z: number };
}
```

**Usage**:
```typescript
world.on(EventType.ENTITY_DEATH, (data) => {
  if (data.entityType === 'player') {
    // Handle player death
    console.log(`Player ${data.entityId} died at`, data.deathPosition);
  }
});
```

#### `PLAYER_SET_DEAD`

Client-side death state event for UI updates.

**Payload**:
```typescript
{
  playerId: string;
  isDead: boolean;
  deathPosition?: { x: number; y: number; z: number };
}
```

**Usage**:
```typescript
world.on(EventType.PLAYER_SET_DEAD, (data) => {
  if (data.isDead) {
    // Show death screen, block input
  } else {
    // Clear death screen, restore input
  }
});
```

#### `CORPSE_EMPTY`

Fired when a gravestone is fully looted.

**Payload**:
```typescript
{
  corpseId: string;
  playerId: string;
}
```

**Usage**:
```typescript
world.on(EventType.CORPSE_EMPTY, (data) => {
  // Destroy gravestone entity
  entityManager.destroyEntity(data.corpseId);
});
```

## Death Lock System

### Schema

Death locks prevent item duplication during the death-to-respawn window.

**Database Schema** (`death_locks` table):
```typescript
{
  player_id: string;           // Primary key
  gravestone_id: string;       // Gravestone entity ID
  position: { x, y, z };       // Death position
  zone_type: 'safe_area' | 'wilderness';
  item_count: number;          // Number of dropped items
  items: DeathItemData[];      // Dropped items for crash recovery
  keptItems?: DeathItemData[]; // OSRS keep-3 items (NEW in March 2026)
  killed_by: string;           // Sanitized killer name
  recovered: boolean;          // Whether death was processed during crash recovery
  created_at: timestamp;
}
```

**DeathItemData**:
```typescript
interface DeathItemData {
  itemId: string;
  quantity: number;
}
```

### Crash Recovery

If the server crashes between death transaction commit and post-transaction DB persist:

1. **On Restart**: `DeathStateManager.recoverUnrecoveredDeaths()` finds active death locks
2. **On Reconnect**: `onPlayerReconnect()` blocks inventory load from DB (prevents stale items)
3. **Kept Items**: Restored from `keptItems` field in death lock if in-memory map is lost

## Two-Phase Persist Pattern

The death system uses a two-phase pattern to avoid SQLite nested transaction deadlocks:

### Phase 1: Transaction (Atomic)

Inside `executeInTransaction()`:
1. Clear inventory in-memory (`skipPersist=true`)
2. Clear equipment in-memory (via `clearEquipmentAndReturn()` with `tx` parameter)
3. Create death lock with dropped items and kept items
4. Transaction commits

### Phase 2: Persist (After Transaction)

After transaction completes:
1. Persist equipment clear to DB (`clearEquipmentImmediate()`)
2. Persist inventory clear to DB (`clearInventoryImmediate(skipPersist=false)`)
3. If persist fails, add to retry queue

**Retry Queue**:
- Bounded to 100 entries (prevents unbounded growth)
- Single retry attempt per failure
- Drained once per tick in `processPendingRespawns()`
- Emits `AUDIT_LOG` event if retry also fails

## OSRS Keep-3 System

### How It Works

In safe zones (non-wilderness), players keep their 3 most valuable items on death:

1. **Value Calculation**: Items sorted by manifest value (descending)
2. **Stack Handling**: Each unit in a stack counts as one item
3. **Greedy Assignment**: Top N units across all stacks are kept
4. **Deterministic Tiebreaking**: Original index used when values are equal

### Example

```typescript
// Player dies with:
const inventory = [
  { itemId: "dragon_med_helm", quantity: 1 },   // value: 58000
  { itemId: "rune_scimitar", quantity: 1 },     // value: 15000
  { itemId: "amulet_of_glory", quantity: 1 },   // value: 10000
  { itemId: "lobster", quantity: 20 },          // value: 100 each
  { itemId: "coins", quantity: 10000 },         // value: 1 each
];

const { kept, dropped } = splitItemsForSafeDeath(inventory, 3);

// kept: [dragon_med_helm (1), rune_scimitar (1), amulet_of_glory (1)]
// dropped: [lobster (20), coins (10000)]
```

### Wilderness Deaths

In wilderness zones, ALL items are dropped (no keep-3 protection).

## Gravestone System

### Privacy Protection

Gravestone loot items are hidden from network broadcast to prevent information leakage:

**Network Data** (broadcast to all clients):
```typescript
{
  lootItemCount: number;  // Only the count, not the items
  despawnTime: number;
  playerId: string;
  deathMessage: string;
}
```

**Full Loot Data** (sent only to interacting player):
```typescript
// Via corpseLoot packet when player interacts with gravestone
{
  corpseId: string;
  playerId: string;
  items: InventoryItem[];  // Full item list
}
```

### Gravestone Lifecycle

1. **Creation**: `SafeAreaDeathHandler.spawnGravestone()`
2. **Interaction**: Player clicks gravestone → server sends `corpseLoot` packet
3. **Looting**: `HeadstoneEntity.removeItem()` → updates `lootItemCount`
4. **Empty**: When `lootItemCount` reaches 0, emits `CORPSE_EMPTY` event
5. **Destruction**: `PlayerDeathSystem.handleCorpseEmpty()` destroys entity via `EntityManager`

### TTL Fallback

If `CORPSE_EMPTY` event is lost, `SafeAreaDeathHandler.processTick()` still destroys the gravestone when its tick-based TTL expires (fallback cleanup).

## Error Handling

### Death Processing Guard

Prevents respawn race while death transaction is in progress:

```typescript
private deathProcessingInProgress = new Set<string>();

// In processPlayerDeath():
this.deathProcessingInProgress.add(playerId);
try {
  await _processPlayerDeathInner(playerId, deathPosition, killedBy);
} finally {
  this.deathProcessingInProgress.delete(playerId);
}
```

### Duel Respawn Guard

Blocks respawn during active duels to prevent escape exploit:

```typescript
// In handleRespawnRequest() and initiateRespawn():
if (duelSystem?.isPlayerInActiveDuel?.(playerId)) {
  this.logger.warn("Blocked respawn request during active duel", { playerId });
  return;
}
```

### Persist Retry Queue

Handles transient DB failures during post-transaction persist:

```typescript
private pendingPersistRetries: Array<{
  playerId: string;
  type: 'equipment' | 'inventory';
}> = [];

// Bounded to prevent unbounded growth
private static readonly MAX_PERSIST_RETRIES = 100;

// Drained once per tick
private processPersistRetries(): void {
  // Single retry attempt, emits AUDIT_LOG if fails
}
```

## Audit Events

The death system emits `AUDIT_LOG` events for operational monitoring:

### `DEATH_LOCK_RECONNECT_BLOCK`

Player reconnected with active death lock (potential crash-window scenario).

```typescript
{
  action: "DEATH_LOCK_RECONNECT_BLOCK",
  playerId: string,
  actorId: string,
  zoneType: string,
  success: true,
  itemCount: number,
  deathAge: number,
  timestamp: number,
}
```

### `DEATH_PERSIST_DESYNC`

Post-transaction persist failed (equipment or inventory).

```typescript
{
  action: "DEATH_PERSIST_DESYNC",
  playerId: string,
  actorId: string,
  zoneType: "unknown",
  success: false,
  failureReason: "equipment_persist_retry_failed" | "inventory_persist_retry_failed",
  timestamp: number,
}
```

### `DEATH_PERSIST_RETRY_QUEUE_FULL`

Retry queue reached max capacity (DB may be persistently unavailable).

```typescript
{
  action: "DEATH_PERSIST_RETRY_QUEUE_FULL",
  playerId: string,
  actorId: string,
  zoneType: "unknown",
  success: false,
  failureReason: string,
  queueSize: number,
  timestamp: number,
}
```

## Testing

### Unit Tests

**DeathUtils** (`packages/shared/src/systems/shared/combat/__tests__/DeathUtils.test.ts`):
- 51 tests covering sanitization, stack splitting, position validation
- Edge cases: Unicode attacks, stack explosion (10k arrows), boundary values

**PlayerDeathFlow** (`packages/shared/src/systems/shared/combat/__tests__/PlayerDeathFlow.test.ts`):
- 10 tests covering death-to-respawn flow, guards, retry queue
- Duel guard, processing guard, tick-based respawn, persist retry, event migration

### Integration Tests

Use Playwright with real Hyperscape instances (per project testing philosophy):
- Full death → respawn → items-returned flow
- Gravestone interaction and looting
- Crash recovery scenarios
- Duel escape prevention

## Performance Considerations

### Stack Handling

`splitItemsForSafeDeath()` uses O(n log n) on unique item slots, NOT on total quantity:

```typescript
// ❌ BAD (memory explosion)
const expanded = [];
for (const item of allItems) {
  for (let i = 0; i < item.quantity; i++) {
    expanded.push({ ...item, quantity: 1 });
  }
}
// 10,000 arrows → 10,000 array entries

// ✅ GOOD (efficient)
const tagged = allItems.map((item, index) => ({
  item,
  index,
  unitValue: getItemValue(item.itemId),
}));
// 10,000 arrows → 1 array entry
```

### Gravestone Network Sync

`lootItems` are included in network data but only sent when dirty:
- `markNetworkDirty()` called after `removeItem()`/`restoreItem()`
- Gravestones have few items and rarely change
- Bandwidth impact is minimal

## See Also

- [Player Death System](../../../packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts) - Main death orchestration
- [Safe Area Death Handler](../../../packages/shared/src/systems/shared/death/SafeAreaDeathHandler.ts) - Gravestone spawning and TTL
- [Death State Manager](../../../packages/shared/src/systems/shared/death/DeathStateManager.ts) - Death lock persistence
- [Headstone Entity](../../../packages/shared/src/entities/world/HeadstoneEntity.ts) - Gravestone entity implementation
