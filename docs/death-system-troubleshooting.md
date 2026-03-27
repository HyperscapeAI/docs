# Player Death System Troubleshooting Guide

Comprehensive troubleshooting guide for the player death system (overhauled in PR #1094, March 26, 2026).

## Quick Diagnosis

### Symptom: Player stuck in death animation, never respawns

**Likely Causes**:
1. Death lock not cleared after respawn
2. Database transaction deadlock (pre-PR #1094)
3. Respawn timer not firing
4. Death state desync between client and server

**Quick Fix**:
```sql
-- Clear stuck death lock (use player's character ID)
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Permanent Fix**: Update to latest version (PR #1094 or later).

### Symptom: Equipment duplicates on death

**Likely Causes**:
1. Post-transaction DB persist failed (equipment not cleared)
2. Death lock not preventing reconnect inventory load
3. Gravestone loot not properly cleared

**Diagnosis**:
```bash
# Check server logs for DEATH_PERSIST_DESYNC tag
grep "DEATH_PERSIST_DESYNC" logs/server.log

# Check for AUDIT_LOG events
grep "AUDIT_LOG" logs/server.log | grep "DEATH_PERSIST"
```

**Fix**: PR #1094 added persist retry queue and death lock guards. Update to latest version.

### Symptom: Items lost on death (not in gravestone or inventory)

**Likely Causes**:
1. Gravestone spawned but entity destroyed prematurely
2. Ground items despawned before player could loot
3. Death lock cleared before items recovered

**Diagnosis**:
```sql
-- Check death lock for player
SELECT * FROM death_locks WHERE player_id = 'player_<id>';

-- Check if items were persisted
SELECT * FROM death_locks WHERE player_id = 'player_<id>' AND item_count > 0;
```

**Recovery**:
```sql
-- If death lock exists with items, trigger recovery
-- (Server will spawn gravestone on next restart)
-- No manual action needed - DeathStateManager handles it
```

## System Architecture

### Death Flow (Safe Zone)

```
1. Player dies (ENTITY_DEATH event)
       ↓
2. PlayerDeathSystem.handlePlayerDeath()
   ├── Validate position
   ├── Check duel arena (skip gravestone if in arena)
   └── Start death transaction
       ↓
3. Inside Transaction:
   ├── clearEquipmentAndReturn() - in-memory clear, skip DB persist
   ├── clearInventoryImmediate(skipPersist=true) - in-memory clear
   ├── splitItemsForSafeDeath() - OSRS keep-3
   ├── Create death lock with kept items
   └── Commit transaction
       ↓
4. After Transaction:
   ├── clearEquipmentImmediate() - persist to DB (retry on failure)
   ├── clearInventoryImmediate(skipPersist=false) - persist to DB (retry on failure)
   └── postDeathCleanup()
       ↓
5. Respawn:
   ├── Tick-based respawn (deterministic timing)
   ├── Return kept items to inventory
   ├── Spawn gravestone with dropped items
   ├── Clear death lock
   └── Teleport to spawn town
```

### Two-Phase Persist Pattern

**Why?** SQLite deadlocks on nested transactions. The death transaction calls `clearEquipmentAndReturn()` and `clearInventoryImmediate()`, which each try to open their own transactions.

**Solution**:
1. **Inside transaction**: Clear in-memory state, skip DB persist
2. **After transaction**: Persist to DB with retry queue

**Crash Recovery**: If server crashes between steps 1 and 2, death lock prevents reconnect inventory load. Items are not restored to player.

### Persist Retry Queue

**Purpose**: Handle transient DB failures during post-transaction persist.

**Behavior**:
- Single retry per failure (no infinite loops)
- Bounded to 100 entries (prevents unbounded growth)
- Drained once per tick in `processPendingRespawns()`
- Emits `AUDIT_LOG` event on retry failure

**Monitoring**:
```bash
# Check for persist retry failures
grep "DEATH_PERSIST_DESYNC" logs/server.log

# Check for retry queue full events
grep "DEATH_PERSIST_RETRY_QUEUE_FULL" logs/server.log
```

## Common Issues

### Issue: Player respawns but kept items not returned

**Diagnosis**:
```typescript
// Check in-memory kept items
this.itemsKeptOnDeath.get(playerId);

// Check death lock kept items (crash recovery)
await this.deathStateManager.getDeathLock(playerId);
```

**Causes**:
1. `itemsKeptOnDeath` Map cleared before respawn
2. Death lock `keptItems` field empty
3. `addItemDirect()` failed (inventory full, DB error)

**Fix**:
```typescript
// Prefer in-memory, fall back to death lock
let keptItems = this.itemsKeptOnDeath.get(playerId);
if (!keptItems || keptItems.length === 0) {
  const deathLock = await this.deathStateManager.getDeathLock(playerId);
  if (deathLock?.keptItems) {
    keptItems = deathLock.keptItems.map(item => ({
      id: `kept_${playerId}_${Date.now()}_${item.itemId}`,
      itemId: item.itemId,
      quantity: item.quantity,
      slot: -1,
      metadata: null,
    }));
  }
}
```

### Issue: Gravestone shows duplicate items after looting

**Diagnosis**:
```bash
# Check for CORPSE_EMPTY event firing
grep "CORPSE_EMPTY" logs/server.log

# Check for gravestone entity destruction
grep "destroyEntity.*gravestone" logs/server.log
```

**Causes**:
1. `CORPSE_EMPTY` event not firing (event lost)
2. Gravestone entity not destroyed after looting
3. `lootItems` not synced to client via `modify()`

**Fix** (PR #1094):
- `HeadstoneEntity.modify()` now syncs `lootItems` from network data
- `PlayerDeathSystem.handleCorpseEmpty()` destroys entity via `EntityManager`
- Tick-based expiration fallback if `CORPSE_EMPTY` is lost

### Issue: Death lock persists after respawn

**Diagnosis**:
```sql
-- Check for stale death locks
SELECT player_id, timestamp, item_count 
FROM death_locks 
WHERE timestamp < (EXTRACT(EPOCH FROM NOW()) * 1000) - 3600000; -- Older than 1 hour
```

**Causes**:
1. `clearDeathLock()` not called after respawn
2. `CORPSE_EMPTY` event never fired
3. Server crashed before lock cleared

**Fix**:
```sql
-- Manual cleanup (use with caution)
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Automatic Cleanup**: Death locks older than 1 hour are auto-cleared on reconnect.

### Issue: Player respawns during active duel

**Diagnosis**:
```bash
# Check for duel respawn guard logs
grep "Blocked.*respawn.*during.*duel" logs/server.log
```

**Causes**:
1. Duel respawn guard not active (pre-PR #1094)
2. `isPlayerInActiveDuel()` returning false incorrectly

**Fix** (PR #1094):
- `handleRespawnRequest()` blocks respawn during active duels
- `initiateRespawn()` has defense-in-depth guard

### Issue: Gravestone loot visible to all players

**Diagnosis**:
```bash
# Check network packets for lootItems broadcast
# Should only send lootItemCount, not full lootItems array
```

**Causes**:
1. `HeadstoneEntity.getNetworkData()` includes `lootItems` (pre-PR #1094)
2. Loot sent via broadcast instead of targeted packet

**Fix** (PR #1094):
- `lootItems` stripped from `getNetworkData()` and `serialize()`
- Only `lootItemCount` is broadcast
- Full loot data sent via targeted `corpseLoot` packet on interaction

## Monitoring & Alerting

### Key Metrics

**Death Lock Age**:
```sql
-- Check for old death locks (potential stuck states)
SELECT 
  player_id,
  (EXTRACT(EPOCH FROM NOW()) * 1000 - timestamp) / 1000 AS age_seconds,
  item_count
FROM death_locks
WHERE timestamp < (EXTRACT(EPOCH FROM NOW()) * 1000) - 300000 -- Older than 5 minutes
ORDER BY timestamp ASC;
```

**Persist Retry Failures**:
```bash
# Count persist retry failures in last hour
grep "DEATH_PERSIST_DESYNC.*retry.*failed" logs/server.log | wc -l
```

**Reconnect with Active Death Lock**:
```bash
# Check for crash-window scenarios
grep "DEATH_LOCK_RECONNECT_BLOCK" logs/server.log
```

### AUDIT_LOG Events

The death system emits `AUDIT_LOG` events for ops visibility:

**Event Types**:
- `DEATH_LOCK_RECONNECT_BLOCK` - Player reconnected with active death lock (crash recovery)
- `DEATH_PERSIST_DESYNC` - Equipment/inventory persist retry failed (possible item duplication)
- `DEATH_PERSIST_RETRY_QUEUE_FULL` - Retry queue full (DB persistently unavailable)

**Query**:
```sql
-- Check for death-related audit events
SELECT action, player_id, success, failure_reason, timestamp
FROM audit_logs
WHERE action LIKE 'DEATH_%'
ORDER BY timestamp DESC
LIMIT 100;
```

## Configuration

### Death Constants

```typescript
// packages/shared/src/constants/CombatConstants.ts
export const COMBAT_CONSTANTS = {
  DEATH: {
    ANIMATION_TICKS: 5,              // Death animation duration (3 seconds)
    COOLDOWN_TICKS: 1,               // Death cooldown (600ms)
    RECONNECT_RESPAWN_DELAY_TICKS: 2, // Delay before auto-respawn on reconnect
    STALE_LOCK_AGE_TICKS: 600000,    // 10 minutes (stale lock cleanup)
    DEFAULT_RESPAWN_POSITION: { x: 0, y: 10, z: 0 },
    DEFAULT_RESPAWN_TOWN: "Central Haven",
  },
  GRAVESTONE_TICKS: 500,             // 5 minutes (300 seconds)
  GROUND_ITEM_TICKS: 200,            // 2 minutes (120 seconds)
};
```

### Tuning Parameters

**Respawn Timing**:
```typescript
// Tick-based respawn (deterministic)
const respawnTick = currentTick + COMBAT_CONSTANTS.DEATH.ANIMATION_TICKS;

// Fallback setTimeout (non-deterministic)
const respawnMs = ticksToMs(COMBAT_CONSTANTS.DEATH.ANIMATION_TICKS);
```

**Gravestone TTL**:
```typescript
// Safe zone: 5 minutes
const gravestoneTTL = ticksToMs(COMBAT_CONSTANTS.GRAVESTONE_TICKS);

// Wilderness: 2 minutes (ground items)
const groundItemTTL = ticksToMs(COMBAT_CONSTANTS.GROUND_ITEM_TICKS);
```

**Death Lock Cleanup**:
```typescript
// Auto-clear death locks older than 10 minutes on reconnect
const MAX_DEATH_LOCK_AGE = ticksToMs(COMBAT_CONSTANTS.DEATH.STALE_LOCK_AGE_TICKS);
```

## Testing

### Unit Tests

**DeathUtils.test.ts** (51 tests):
- `sanitizeKilledBy()` - XSS, Unicode, injection, edge cases
- `splitItemsForSafeDeath()` - OSRS keep-3, stack handling, OOM regression
- `validatePosition()` - Validation, clamping, invalid inputs
- `isPositionInBounds()` - Bounds checking
- `isValidPositionNumber()` - Finite number validation
- `getItemValue()` - Manifest lookup

**PlayerDeathFlow.test.ts** (10 tests):
- Duel guard blocks respawn
- Death processing race guard
- Tick-based respawn timing
- Persist retry queue drain
- `PLAYER_DIED` → `PLAYER_SET_DEAD` migration

### Integration Tests

**PvPDeath.integration.test.ts**:
- Full death flow with real server
- Gravestone spawning and looting
- Kept items returned on respawn
- Death lock cleanup

**SafeAreaDeathHandler.test.ts**:
- Gravestone TTL expiration
- Tick-based cleanup
- Item drop to ground after gravestone expires

**WildernessDeathHandler.test.ts**:
- Immediate ground item drop
- No gravestone in wilderness
- All items dropped (no keep-3)

## Recovery Procedures

### Stuck Death Lock

**Symptoms**: Player can't log in, or inventory is empty on login.

**Diagnosis**:
```sql
SELECT * FROM death_locks WHERE player_id = 'player_<id>';
```

**Recovery**:
```sql
-- Option 1: Clear death lock (player loses items)
DELETE FROM death_locks WHERE player_id = 'player_<id>';

-- Option 2: Trigger recovery (server spawns gravestone on restart)
-- No action needed - DeathStateManager.recoverUnrecoveredDeaths() handles it
```

### Duplicate Equipment

**Symptoms**: Player has duplicate items after death.

**Diagnosis**:
```bash
# Check for persist retry failures
grep "DEATH_PERSIST_DESYNC.*equipment.*retry.*failed" logs/server.log

# Check death lock
SELECT * FROM death_locks WHERE player_id = 'player_<id>';
```

**Recovery**:
```sql
-- Remove duplicate items from inventory
DELETE FROM inventory 
WHERE player_id = 'player_<id>' 
  AND item_id = '<duplicate_item_id>'
  AND slot > 0; -- Keep first occurrence

-- Clear death lock
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: PR #1094 added persist retry queue. Update to latest version.

### Orphaned Gravestone

**Symptoms**: Gravestone persists after looting, shows stale items.

**Diagnosis**:
```bash
# Check for CORPSE_EMPTY event
grep "CORPSE_EMPTY.*<gravestone_id>" logs/server.log

# Check for entity destruction
grep "destroyEntity.*<gravestone_id>" logs/server.log
```

**Recovery**:
```typescript
// In-game admin command
/admin destroy <gravestone_id>
```

**Prevention**: PR #1094 fixed gravestone cleanup via `EntityManager.destroyEntity()`. Update to latest version.

## Database Schema

### death_locks Table

```sql
CREATE TABLE death_locks (
  player_id TEXT PRIMARY KEY,
  gravestone_id TEXT,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  zone_type TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  items JSONB,           -- Dropped items (for gravestone)
  kept_items JSONB,      -- Kept items (for respawn)
  killed_by TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields**:
- `player_id`: Player character ID (primary key)
- `gravestone_id`: Gravestone entity ID (empty until spawned)
- `position_x/y/z`: Death position
- `zone_type`: "safe_area" or "wilderness"
- `item_count`: Number of dropped items
- `items`: Dropped items (for gravestone)
- `kept_items`: Kept items (for respawn) - **NEW in PR #1094**
- `killed_by`: Killer name (sanitized)
- `timestamp`: Death timestamp (milliseconds)

### Migration (PR #1094)

```sql
-- Add kept_items column
ALTER TABLE death_locks ADD COLUMN kept_items JSONB;

-- Backfill existing death locks (no kept items)
UPDATE death_locks SET kept_items = '[]' WHERE kept_items IS NULL;
```

## Event Reference

### Deprecated Events

**`PLAYER_DIED`** (deprecated in PR #1094):
```typescript
// ❌ OLD (deprecated)
world.on(EventType.PLAYER_DIED, (data: { playerId: string }) => {
  // Handle player death
});
```

**Migration**:
```typescript
// ✅ NEW (use ENTITY_DEATH with type filter)
world.on(EventType.ENTITY_DEATH, (data: { 
  entityId: string; 
  entityType: string;
  killedBy?: string;
  deathPosition?: { x: number; y: number; z: number };
}) => {
  if (data.entityType === 'player') {
    // Handle player death
  }
});
```

### New Events (PR #1094)

**`PLAYER_SET_DEAD`**:
```typescript
// Emitted when player enters/exits death state
world.on(EventType.PLAYER_SET_DEAD, (data: {
  playerId: string;
  isDead: boolean;
  deathPosition?: [number, number, number];
}) => {
  // Update client death UI
});
```

**`DEATH_RECOVERED`**:
```typescript
// Emitted when DeathStateManager recovers unfinished death
world.on(EventType.DEATH_RECOVERED, (data: {
  playerId: string;
  position: { x: number; y: number; z: number };
  items: InventoryItem[];
  killedBy: string;
  zoneType: ZoneType;
}) => {
  // Spawn gravestone with recovered items
});
```

**`AUDIT_LOG`**:
```typescript
// Emitted for ops-visible audit events
world.on(EventType.AUDIT_LOG, (data: {
  action: string;
  playerId: string;
  actorId: string;
  zoneType: string;
  success: boolean;
  failureReason?: string;
  timestamp: number;
  [key: string]: unknown;
}) => {
  // Log to monitoring system
});
```

## Performance Tuning

### Tick-Based Respawn

**Advantages**:
- Deterministic timing (no setTimeout drift)
- Server-authoritative (client can't manipulate)
- Efficient (single tick handler for all players)

**Configuration**:
```typescript
// Register tick handler (server only)
this.tickSystem.onTick((tickNumber) => {
  this.processPendingRespawns(tickNumber);
}, TickPriority.AI); // Priority 3 = after combat
```

**Fallback**: If `TickSystem` not available (client-side), uses `setTimeout`.

### Persist Retry Queue

**Tuning**:
```typescript
// Max retries before dropping
private static readonly MAX_PERSIST_RETRIES = 100;

// Process retries once per tick
private processPendingRespawns(currentTick: number): void {
  this.processPersistRetries(); // Drain retry queue
  // ... respawn logic
}
```

**Monitoring**:
```bash
# Check retry queue size
grep "queueSize" logs/server.log | grep "DEATH_PERSIST"
```

### Gravestone Cleanup

**Tick-Based Expiration**:
```typescript
// SafeAreaDeathHandler.processTick()
const elapsed = currentTick - gravestone.spawnTick;
if (elapsed >= COMBAT_CONSTANTS.GRAVESTONE_TICKS) {
  // Expire gravestone, drop items to ground
}
```

**Event-Based Cleanup**:
```typescript
// PlayerDeathSystem.handleCorpseEmpty()
this.safeAreaHandler.cancelGravestoneTimer(corpseId);
entityManager.destroyEntity(corpseId);
await this.deathStateManager.clearDeathLock(playerId);
```

## Security Considerations

### Duel Escape Prevention

**Exploit**: Player could respawn during duel to escape with staked items.

**Fix** (PR #1094):
```typescript
// Block respawn during active duel
if (duelSystem?.isPlayerInActiveDuel?.(playerId)) {
  this.logger.warn("Blocked respawn request during active duel", { playerId });
  return;
}
```

**Guards**:
- `handleRespawnRequest()` - Blocks manual respawn button
- `initiateRespawn()` - Defense-in-depth guard

### Position Validation

**Exploit**: Malicious client sends extreme position to teleport on death.

**Fix**:
```typescript
// Validate and clamp position
const validPosition = validatePosition(deathPosition);
if (!validPosition) {
  this.logger.error("Invalid death position", { playerId });
  return; // Drop death event
}

// Log warning if clamped
if (!isPositionInBounds(deathPosition)) {
  this.logger.warn("Death position out of bounds, clamped", { playerId });
}
```

### Killer Name Sanitization

**Exploit**: Malicious killer name with XSS/injection payload.

**Fix**:
```typescript
// Sanitize killer name before storing
const killedBy = sanitizeKilledBy(killedByRaw);

// Store sanitized name in death lock
await this.deathStateManager.createDeathLock(playerId, {
  killedBy, // Sanitized
  // ...
});
```

## Related Documentation

- [PlayerDeathSystem.ts](../packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts) - Main death orchestrator
- [DeathUtils.ts](../packages/shared/src/systems/shared/combat/DeathUtils.ts) - Pure utility functions
- [DeathTypes.ts](../packages/shared/src/systems/shared/combat/DeathTypes.ts) - Type definitions
- [SafeAreaDeathHandler.ts](../packages/shared/src/systems/shared/death/SafeAreaDeathHandler.ts) - Safe zone handler
- [WildernessDeathHandler.ts](../packages/shared/src/systems/shared/death/WildernessDeathHandler.ts) - Wilderness handler
- [DeathStateManager.ts](../packages/shared/src/systems/shared/death/DeathStateManager.ts) - Death lock persistence
- [OSRS Wiki - Death](https://oldschool.runescape.wiki/w/Death) - OSRS death mechanics reference

## Changelog

### March 26, 2026 (PR #1094)
- Complete rewrite of death pipeline
- Two-phase persist pattern (fixes SQLite deadlock)
- OSRS keep-3 system for safe zone deaths
- Gravestone privacy (loot hidden from broadcast)
- Death lock crash recovery with kept items
- Persist retry queue (bounded to 100 entries)
- Duel respawn guard (prevents escape exploit)
- Death processing guard (prevents respawn race)
- Event migration (`PLAYER_DIED` → `PLAYER_SET_DEAD`/`ENTITY_DEATH`)
- 61 new tests (DeathUtils + PlayerDeathFlow)
- 23 files changed, 2,574 additions, 566 deletions
