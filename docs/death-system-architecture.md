# Player Death System Architecture

**Last Updated**: March 26, 2026  
**Related PR**: #1094

## Overview

The player death system implements OSRS-accurate death mechanics with robust transaction handling, crash recovery, and privacy-preserving gravestone loot. The system was completely rewritten in March 2026 to fix critical bugs including SQLite deadlock, equipment duplication, and missing keep-3 mechanics.

## Core Features

### 1. OSRS-Style Keep-3 System

In safe zones (non-PvP areas), players keep their 3 most valuable items on death:

- Items are ranked by manifest `value` field
- Stacked items (quantity > 1) are handled efficiently without memory explosion
- Kept items are returned to inventory on respawn
- Dropped items go to gravestone for retrieval

**Implementation**: `DeathUtils.splitItemsForSafeDeath()`
- O(n log n) complexity on unique item slots (not individual units)
- Greedy quantity assignment for stacked items
- Deterministic tiebreaking on original index when values are equal

### 2. Two-Phase Persist Pattern

Death processing uses a two-phase pattern to prevent database deadlock:

**Phase 1 - Inside Transaction**:
- Clear inventory and equipment in-memory
- Create death lock with kept items
- Skip database persist (would cause nested transaction deadlock)

**Phase 2 - After Transaction**:
- Persist equipment clear to database
- Persist inventory clear to database
- Retry queue handles failures

**Why This Matters**: SQLite doesn't support nested transactions. The old code called `clearEquipmentAndReturn()` and `clearInventoryImmediate()` inside `executeInTransaction()`, each opening their own transaction, causing silent deadlock.

### 3. Death Lock System

Death locks prevent state desync during the death-to-respawn window:

```typescript
interface DeathLock {
  playerId: string;
  deathPosition: { x: number; y: number; z: number };
  keptItems: InventoryItem[];  // For crash recovery
  createdAt: number;
  expiresAt: number;  // Auto-expire after 5 minutes
}
```

**Purpose**:
- Prevent reconnect during death processing from corrupting state
- Store kept items for crash recovery (in-memory map is lost on server crash)
- Auto-expire stale locks (TTL: 5 minutes)

**Crash Recovery**: If server crashes between transaction commit and persist completion, death lock persists kept items. On reconnect, system checks for active death lock and recovers kept items from database.

### 4. Gravestone Privacy

Gravestone loot is privacy-preserving (OSRS-accurate):

- `lootItems` array is stripped from network broadcast
- Only `lootItemCount` (number) is synced to all clients
- Full loot data sent only to interacting player via `corpseLoot` packet
- Empty gravestone guard uses synced `lootItemCount` field

**Why**: In OSRS, gravestone contents are hidden until interaction. Broadcasting full loot arrays would leak player wealth to all nearby clients.

### 5. Persist Retry Queue

Post-transaction persist failures are retried once:

```typescript
interface PersistRetry {
  playerId: string;
  type: 'equipment' | 'inventory';
  timestamp: number;
}
```

**Behavior**:
- Single retry per failure (no infinite loops)
- Retries drained once per tick in `processPendingRespawns()`
- Track in-flight retries to prevent races with reconnect/new death
- Bounded queue (max 100 entries) to prevent unbounded growth
- `AUDIT_LOG` events on retry failure for ops visibility

## Architecture

### File Structure

```
packages/shared/src/systems/shared/combat/
├── PlayerDeathSystem.ts       # Main death orchestration (1,605 lines)
├── DeathUtils.ts              # Pure utility functions
├── DeathTypes.ts              # Type definitions
└── __tests__/
    ├── PlayerDeathFlow.test.ts    # Death-to-respawn flow tests
    └── DeathUtils.test.ts         # Utility function tests (51 tests)

packages/shared/src/systems/shared/death/
├── DeathStateManager.ts       # Death lock CRUD operations
├── SafeAreaDeathHandler.ts    # Safe zone death logic
├── WildernessDeathHandler.ts  # PvP zone death logic (future)
└── ZoneDetectionSystem.ts     # Zone type detection
```

### Key Components

#### PlayerDeathSystem

Main orchestrator for death processing:

```typescript
class PlayerDeathSystem extends SystemBase {
  // Entry point - called by PlayerSystem.handleDeath
  handlePlayerDeath(playerId: string, killedBy?: string): void

  // Core death processing (server-only)
  private async processPlayerDeath(playerId: string, killedBy?: string): Promise<void>

  // Post-death cleanup (equipment, inventory, gravestone)
  private async postDeathCleanup(playerId: string, ...): Promise<void>

  // Respawn handling
  handleRespawnRequest(playerId: string): void
  private initiateRespawn(playerId: string): void
  private respawnPlayer(playerId: string): void

  // Tick-based processing
  processPendingRespawns(): void  // Called every tick
}
```

#### DeathUtils

Pure utility functions (stateless, side-effect-free):

```typescript
// XSS/Unicode/injection protection for killer names
function sanitizeKilledBy(killedBy: unknown): string

// OSRS keep-3 with stack handling (O(n log n) on unique items)
function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number
): { kept: InventoryItem[]; dropped: InventoryItem[] }

// Position validation and clamping to world bounds
function validatePosition(position: Position3D): Position3D | null
function isPositionInBounds(position: Position3D): boolean

// Constants
const GRAVESTONE_ID_PREFIX = "gravestone_"
const ITEMS_KEPT_ON_DEATH = 3
const POSITION_VALIDATION = { WORLD_BOUNDS: 10000, MAX_HEIGHT: 500, MIN_HEIGHT: -50 }
```

#### DeathStateManager

Database operations for death locks:

```typescript
class DeathStateManager {
  // Create death lock (with kept items for crash recovery)
  async createDeathLock(playerId: string, deathPosition: Position3D, keptItems: InventoryItem[]): Promise<void>

  // Check if player has active death lock
  async getDeathLock(playerId: string): Promise<DeathLock | null>

  // Clear death lock after respawn
  async clearDeathLock(playerId: string): Promise<void>

  // Cleanup expired locks (TTL: 5 minutes)
  async cleanupExpiredLocks(): Promise<void>
}
```

## Death Flow

### Safe Zone Death (Keep-3)

```
1. Player health reaches 0
   ↓
2. PlayerSystem.handleDeath() emits ENTITY_DEATH
   ↓
3. PlayerDeathSystem.handlePlayerDeath() receives event
   ↓
4. Check cooldown (prevent spam)
   ↓
5. Check duel guard (block respawn during active duel)
   ↓
6. Set deathProcessingInProgress flag (prevent race)
   ↓
7. processPlayerDeath() [SERVER-ONLY]
   ├─ Validate position (clamp to world bounds)
   ├─ Get all inventory + equipment items
   ├─ Split into kept (top 3 by value) and dropped
   ├─ Start transaction:
   │  ├─ Clear inventory in-memory (skipPersist=true)
   │  ├─ Clear equipment in-memory (skip save when tx provided)
   │  ├─ Create death lock with kept items
   │  └─ Commit transaction
   ├─ Persist equipment clear to DB (after tx)
   ├─ Persist inventory clear to DB (after tx)
   └─ Store kept items in-memory map
   ↓
8. postDeathCleanup()
   ├─ Set player state to DYING
   ├─ Emit PLAYER_SET_DEAD event
   ├─ Create gravestone entity with dropped items
   ├─ Schedule respawn timer (10 seconds)
   └─ Clear deathProcessingInProgress flag
   ↓
9. Tick-based respawn (processPendingRespawns)
   ├─ Check timer expired
   ├─ Check player still in DYING state
   ├─ Restore kept items to inventory
   ├─ Clear death lock
   ├─ Teleport to respawn point
   ├─ Reset health/prayer/combat state
   └─ Emit UI_DEATH_SCREEN_CLOSE
```

### Error Recovery

**Transaction Failure**:
- Catch in `handlePlayerDeath()`
- Reset player to alive state
- Revive in-place (deathPosition)
- Log error with stack trace

**Persist Failure** (after transaction):
- Add to retry queue
- Single retry on next tick
- `AUDIT_LOG` event on retry failure
- Bounded queue (max 100 entries)

**Server Crash** (during death window):
- Death lock persists kept items to database
- On reconnect: check for active death lock
- Emit `AUDIT_LOG` event (ops visibility)
- Recover kept items from death lock
- Complete respawn flow

## Event Migration

### PLAYER_DIED → PLAYER_SET_DEAD

**Old Event** (deprecated):
```typescript
world.on('PLAYER_DIED', (data: { playerId: string }) => {
  // Handle death
});
```

**New Event**:
```typescript
world.on('PLAYER_SET_DEAD', (data: { playerId: string; killedBy?: string }) => {
  // Handle death
});
```

**Why**: `PLAYER_DIED` was emitted multiple times in the old flow (once in `PlayerSystem.handleDeath`, again in `postDeathCleanup`). `PLAYER_SET_DEAD` is emitted exactly once, after all death processing completes.

**Migration**: Search codebase for `PLAYER_DIED` and replace with `PLAYER_SET_DEAD`. The event payload is compatible (both have `playerId` and optional `killedBy`).

**Deprecation Timeline**: `PLAYER_DIED` is marked `@deprecated` in JSDoc. Will be removed in next major version.

## Database Schema

### death_locks Table

```sql
CREATE TABLE death_locks (
  player_id TEXT PRIMARY KEY,
  death_position_x REAL NOT NULL,
  death_position_y REAL NOT NULL,
  death_position_z REAL NOT NULL,
  kept_items TEXT NOT NULL,  -- JSON array of InventoryItem
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

**Indexes**:
- Primary key on `player_id` (one lock per player)
- Index on `expires_at` for cleanup queries

**TTL**: Locks auto-expire after 5 minutes. Cleanup runs periodically via `cleanupExpiredLocks()`.

## Testing

### Unit Tests

**DeathUtils.test.ts** (51 tests):
- `sanitizeKilledBy()` - XSS, Unicode normalization, BiDi overrides, control characters
- `splitItemsForSafeDeath()` - OSRS keep-3, stack handling, edge cases, OOM regression
- `validatePosition()` - NaN/Infinity handling, clamping, bounds checking
- `isPositionInBounds()` - Boundary validation

**PlayerDeathFlow.test.ts** (10 tests):
- Duel guard blocks respawn during active duel
- Death processing race guard prevents duplicate ENTITY_DEATH
- Tick-based respawn timing
- Persist retry queue drain
- `PLAYER_DIED` → `PLAYER_SET_DEAD` migration

**HeadstoneEntity.test.ts** (5 tests):
- `modify()` network sync logic
- `lootItemCount=0` clears local items
- Non-zero preservation
- Missing field handling
- Null mesh safety

### Integration Tests

**PvPDeath.integration.test.ts**:
- Wilderness death (lose all items)
- Safe zone death (keep 3 most valuable)
- Gravestone creation and loot retrieval
- Death lock cleanup

## Security Considerations

### Input Validation

**killedBy Sanitization**:
- Normalize Unicode to NFKC (prevent homograph attacks)
- Remove zero-width characters (U+200B-U+200D, U+FEFF)
- Remove BiDi override characters (U+202A-U+202E)
- Remove control characters (0x00-0x1F, 0x7F)
- Remove dangerous HTML characters (`<>'\"&`)
- Limit to 64 characters
- Default to "unknown" for invalid inputs

**Position Validation**:
- Check for NaN/Infinity
- Clamp to world bounds (±10km from origin)
- Clamp height (-50m to 500m)
- Reject completely invalid positions

**Gravestone ID Filtering**:
- Early return for `gravestone_` prefix in `handlePlayerDeath()`
- Prevents gravestone destruction from triggering false player death
- Performance optimization (not security boundary - real gate is `isServer` check)

### Server-Only Processing

Death processing is strictly server-only:

```typescript
if (!this.world.isServer) {
  this.logger.warn("Client attempted server-only death processing", { playerId });
  return;
}
```

Client-side death attempts are logged for security visibility.

### Duel Guard

Respawn is blocked during active duels:

```typescript
const duelSystem = this.world.getSystem("duel") as DuelSystem;
if (duelSystem?.isPlayerInActiveDuel(playerId)) {
  this.logger.debug("Respawn blocked: player in active duel", { playerId });
  return;
}
```

Prevents exploits where players respawn mid-duel to escape combat.

## Performance Characteristics

### Memory

- **Kept Items Map**: O(n) space where n = number of dead players awaiting respawn
- **Retry Queue**: Bounded at 100 entries (prevents unbounded growth)
- **Death Locks**: One per player, auto-expire after 5 minutes

### CPU

- **splitItemsForSafeDeath()**: O(n log n) on unique item slots
  - Old implementation: O(n × quantity) - expanded stacks into individual entries
  - New implementation: Operates on unique slots with greedy assignment
  - Example: 10,000 arrows = 1 slot, not 10,000 array entries

- **Gravestone Cleanup**: O(1) per gravestone (event-driven via `CORPSE_EMPTY`)
  - Fallback: Tick-based expiration in `SafeAreaDeathHandler` (if event is lost)

## Monitoring & Observability

### Audit Events

The system emits `AUDIT_LOG` events for ops visibility:

```typescript
// Reconnect with active death lock (potential crash-window scenario)
world.emit("AUDIT_LOG", {
  event: "RECONNECT_WITH_DEATH_LOCK",
  playerId,
  deathLock,
});

// Persist retry failure (equipment)
world.emit("AUDIT_LOG", {
  event: "DEATH_PERSIST_RETRY_FAILED",
  playerId,
  type: "equipment",
  error: err.message,
});

// Persist retry failure (inventory)
world.emit("AUDIT_LOG", {
  event: "DEATH_PERSIST_RETRY_FAILED",
  playerId,
  type: "inventory",
  error: err.message,
});
```

### Debug Logging

Key decision points are logged:

```typescript
// Cooldown guard
this.logger.debug("Death on cooldown, ignoring", { playerId, remainingMs });

// Position fallback
this.logger.warn("Death position invalid, using player position", { playerId, deathPosition });

// Empty gravestone interaction
this.logger.warn("HeadstoneEntity.modify() received invalid lootItems", { entityId, lootItems });
```

### Grep Tags

Search logs for these tags:

- `DEATH_PERSIST_DESYNC` - Persist failure after transaction commit
- `AUDIT_LOG` - High-severity events requiring ops attention
- `[DEATH-DEBUG]` - Removed in cleanup (all debug logs now use Logger system)

## Common Issues & Solutions

### Issue: Player stuck in death animation, never respawns

**Symptoms**:
- Player plays death animation
- Death screen appears
- Respawn timer never triggers
- Player stuck in DYING state

**Diagnosis**:
1. Check server logs for `DEATH_PERSIST_DESYNC` tag
2. Check for transaction errors in death processing
3. Query death locks: `SELECT * FROM death_locks WHERE player_id = ?`

**Root Cause** (fixed in PR #1094):
- Nested transaction deadlock in SQLite
- `clearEquipmentAndReturn()` and `clearInventoryImmediate()` opened transactions inside `executeInTransaction()`

**Recovery**:
```sql
-- Clear stuck death lock
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: Update to latest version (March 26, 2026+). Two-phase persist pattern eliminates nested transactions.

### Issue: Equipment duplicates on death

**Symptoms**:
- Player dies
- Equipment appears in both gravestone and inventory after respawn
- Item duplication exploit

**Root Cause** (fixed in PR #1094):
- Equipment clear failed silently due to transaction deadlock
- Gravestone created with equipment items
- Player respawned with equipment still equipped

**Prevention**: Update to latest version. Two-phase persist ensures equipment is cleared before gravestone creation.

### Issue: Gravestone shows stale items after looting

**Symptoms**:
- Player loots gravestone
- Gravestone entity persists with old items
- Next death shows duplicate items in gravestone

**Root Cause** (fixed in commit 498cdff):
1. `removeItem()` used `setTimeout(500ms)` for self-destruct (unreliable)
2. `getNetworkData()` only sent `lootItemCount`, never actual items array
3. Client entity had no items → empty loot window

**Fix**:
1. Entity destruction moved to `PlayerDeathSystem.handleCorpseEmpty()` via `EntityManager`
2. `lootItems` added to network data
3. `modify()` overridden to sync private `lootItems` field on client

**Prevention**: Update to latest version. Gravestone destruction is now event-driven and reliable.

## API Reference

### DeathUtils

#### sanitizeKilledBy(killedBy: unknown): string

Sanitize killer name to prevent injection attacks.

**Parameters**:
- `killedBy` - Raw killer name (any type)

**Returns**: Sanitized string (max 64 chars) or "unknown"

**Security**:
- Normalizes Unicode to NFKC (prevent homograph attacks)
- Removes zero-width characters
- Removes BiDi override characters
- Removes control characters
- Removes dangerous HTML characters

**Example**:
```typescript
const safe = sanitizeKilledBy("Goblin<script>alert(1)</script>");
// Returns: "Goblinscriptalert1script"

const safe2 = sanitizeKilledBy("а\u200Bttacker"); // Cyrillic 'а' + zero-width space
// Returns: "аttacker" (normalized, zero-width removed)
```

#### splitItemsForSafeDeath(allItems: InventoryItem[], keepCount: number)

Split items into kept and dropped lists for safe zone deaths.

**Parameters**:
- `allItems` - All inventory + equipment items
- `keepCount` - Number of items to keep (typically 3)

**Returns**: `{ kept: InventoryItem[], dropped: InventoryItem[] }`

**Algorithm**:
1. Tag each item with unit value from manifest
2. Sort descending by value (tiebreak on original index)
3. Greedily assign keep-count without expanding stacks
4. Split into kept and dropped with adjusted quantities

**Complexity**: O(n log n) on unique item slots

**Example**:
```typescript
const items = [
  { itemId: "rune_scimitar", quantity: 1 },    // value: 15000
  { itemId: "lobster", quantity: 20 },         // value: 150 each
  { itemId: "dragon_bones", quantity: 5 },     // value: 3000 each
];

const { kept, dropped } = splitItemsForSafeDeath(items, 3);
// kept: [
//   { itemId: "rune_scimitar", quantity: 1 },  // 15000
//   { itemId: "dragon_bones", quantity: 2 },   // 6000 total (2 units kept)
// ]
// dropped: [
//   { itemId: "dragon_bones", quantity: 3 },   // 3 units dropped
//   { itemId: "lobster", quantity: 20 },       // All dropped (low value)
// ]
```

#### validatePosition(position: Position3D): Position3D | null

Validate and clamp position to world bounds.

**Parameters**:
- `position` - Position to validate

**Returns**: Clamped position or `null` if completely invalid (NaN/Infinity)

**Bounds**:
- X/Z: ±10,000 (10km from origin)
- Y: -50 to 500 (allow some underground, cap at 500m height)

**Example**:
```typescript
const pos = validatePosition({ x: 15000, y: 1000, z: -20000 });
// Returns: { x: 10000, y: 500, z: -10000 } (clamped)

const invalid = validatePosition({ x: NaN, y: 0, z: 0 });
// Returns: null
```

#### isPositionInBounds(position: Position3D): boolean

Check if position is within world bounds without clamping.

**Parameters**:
- `position` - Position to check

**Returns**: `true` if within bounds, `false` otherwise

**Example**:
```typescript
isPositionInBounds({ x: 5000, y: 100, z: -3000 });  // true
isPositionInBounds({ x: 15000, y: 100, z: 0 });     // false (x out of bounds)
```

### PlayerDeathSystem

#### handlePlayerDeath(playerId: string, killedBy?: string): void

Entry point for death processing. Called by `PlayerSystem.handleDeath()` when player health reaches 0.

**Parameters**:
- `playerId` - Player entity ID
- `killedBy` - Optional killer name (sanitized before use)

**Behavior**:
- Checks cooldown (prevent spam)
- Checks duel guard (block during active duel)
- Sets processing flag (prevent race)
- Calls `processPlayerDeath()` (server-only)
- Error recovery: reset to alive on failure

#### handleRespawnRequest(playerId: string): void

Handle manual respawn request from client (e.g., "Click here to respawn" button).

**Parameters**:
- `playerId` - Player entity ID

**Preconditions**:
- Player must be in DYING state
- Respawn timer must exist

**Behavior**:
- Validates preconditions
- Calls `initiateRespawn()` immediately (bypasses timer)

#### processPendingRespawns(): void

Tick-based respawn processor. Called every tick by `ServerNetwork`.

**Behavior**:
- Iterate all pending respawn timers
- Check if timer expired
- Check if player still in DYING state
- Call `respawnPlayer()` for expired timers
- Drain persist retry queue (single retry per failure)

## Configuration

### Environment Variables

```bash
# Death system (no specific env vars - uses game constants)
# Respawn timer: 10 seconds (hardcoded in PlayerDeathSystem)
# Death lock TTL: 5 minutes (hardcoded in DeathStateManager)
# Persist retry queue max: 100 entries (hardcoded in PlayerDeathSystem)
```

### Constants

```typescript
// DeathUtils.ts
export const ITEMS_KEPT_ON_DEATH = 3;
export const GRAVESTONE_ID_PREFIX = "gravestone_";
export const POSITION_VALIDATION = {
  WORLD_BOUNDS: 10000,
  MAX_HEIGHT: 500,
  MIN_HEIGHT: -50,
};

// PlayerDeathSystem.ts
private readonly DEATH_COOLDOWN_MS = 2000;  // 2 seconds between deaths
private readonly RESPAWN_DELAY_MS = 10000;  // 10 seconds to respawn
private readonly MAX_RETRY_QUEUE_SIZE = 100;  // Bounded retry queue
```

## Future Enhancements

### Wilderness Death (PvP)

**Status**: Placeholder exists (`WildernessDeathHandler.ts`)

**Planned Behavior**:
- Lose all items (no keep-3)
- Killer gets loot
- Skull system (protect item count)
- Unsafe zone detection

### Prayer Protection

**Status**: Not implemented

**Planned Behavior**:
- Protect Item prayer keeps 1 additional item (keep-4 instead of keep-3)
- Requires active prayer points
- Drains prayer on death

### Gravestone Upgrades

**Status**: Not implemented

**Planned Behavior**:
- Purchasable gravestones with longer TTL
- Gravestone blessing (extend timer)
- Gravestone repair (prevent decay)

## References

- **PR #1094**: Player death system overhaul
- **DeathUtils.ts**: Pure utility functions
- **DeathTypes.ts**: Type definitions
- **PlayerDeathSystem.ts**: Main orchestration
- **DeathStateManager.ts**: Death lock database operations
- **SafeAreaDeathHandler.ts**: Safe zone death logic
