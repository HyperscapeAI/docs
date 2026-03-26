# PLAYER_DIED Event Migration Guide

**Deprecation Date**: March 26, 2026  
**Removal Date**: TBD (next major version)  
**Related PR**: #1094

## Overview

The `PLAYER_DIED` event has been deprecated in favor of `PLAYER_SET_DEAD`. This migration guide explains why the change was made, how to update your code, and what to watch out for.

## Why the Change?

### Problem with PLAYER_DIED

The old `PLAYER_DIED` event was emitted **multiple times** during the death flow:

1. **First emission**: `PlayerSystem.handleDeath()` when health reaches 0
2. **Second emission**: `PlayerDeathSystem.postDeathCleanup()` after death processing

This caused several issues:
- Subscribers received duplicate events
- Timing was unpredictable (before or after death processing?)
- Race conditions when multiple systems reacted to the same death
- Difficult to reason about event ordering

### Solution: PLAYER_SET_DEAD

The new `PLAYER_SET_DEAD` event is emitted **exactly once**, after all death processing completes:

- Emitted in `PlayerDeathSystem.postDeathCleanup()`
- Fires after inventory/equipment cleared
- Fires after gravestone created
- Fires after death lock created
- Fires after player state set to DYING

**Guarantee**: When `PLAYER_SET_DEAD` fires, the player is fully dead and all death processing is complete.

## Migration Steps

### Step 1: Find All Usages

Search your codebase for `PLAYER_DIED`:

```bash
# Find all event listeners
grep -r "PLAYER_DIED" packages/

# Find all event emissions (should only be in deprecated code)
grep -r "emit.*PLAYER_DIED" packages/
```

### Step 2: Update Event Listeners

Replace `PLAYER_DIED` with `PLAYER_SET_DEAD`:

**Before**:
```typescript
world.on("PLAYER_DIED", (data: { playerId: string }) => {
  console.log(`Player ${data.playerId} died`);
  // Handle death
});
```

**After**:
```typescript
world.on("PLAYER_SET_DEAD", (data: { playerId: string; killedBy?: string }) => {
  console.log(`Player ${data.playerId} died (killed by: ${data.killedBy ?? "unknown"})`);
  // Handle death
});
```

**Payload Compatibility**: Both events have the same payload structure:
```typescript
interface PlayerDeathEventData {
  playerId: string;
  killedBy?: string;  // Optional killer name
}
```

### Step 3: Update Event Emissions (if any)

**You should NOT be emitting PLAYER_DIED directly.** This event is internal to the death system.

If you find code emitting `PLAYER_DIED`:
1. Remove the emission
2. Let `PlayerSystem.handleDeath()` handle it
3. Subscribe to `PLAYER_SET_DEAD` instead

**Anti-pattern** (remove this):
```typescript
// ❌ DON'T DO THIS
if (player.health <= 0) {
  world.emit("PLAYER_DIED", { playerId: player.id });
}
```

**Correct pattern**:
```typescript
// ✅ DO THIS
if (player.health <= 0) {
  // PlayerSystem.handleDeath() will emit ENTITY_DEATH
  // PlayerDeathSystem will emit PLAYER_SET_DEAD
  // Just subscribe to PLAYER_SET_DEAD
}
```

### Step 4: Test Your Changes

After migration, verify:

1. **Death events fire correctly**:
   - Kill a player
   - Check that `PLAYER_SET_DEAD` fires exactly once
   - Check that your subscriber receives the event

2. **No duplicate handling**:
   - Ensure your code doesn't run twice for the same death
   - Check logs for duplicate messages

3. **Timing is correct**:
   - Verify death processing completes before your subscriber runs
   - Check that gravestone exists when your code runs
   - Check that player is in DYING state when your code runs

## Event Timing Comparison

### Old Flow (PLAYER_DIED)

```
Player health reaches 0
  ↓
PlayerSystem.handleDeath()
  ↓
PLAYER_DIED emitted (1st time) ← Subscribers run here
  ↓
PlayerDeathSystem.handlePlayerDeath()
  ↓
processPlayerDeath() (clear inventory, equipment)
  ↓
postDeathCleanup()
  ↓
PLAYER_DIED emitted (2nd time) ← Subscribers run again!
  ↓
Create gravestone
  ↓
Schedule respawn
```

**Problem**: Subscribers run twice, and first run happens before death processing completes.

### New Flow (PLAYER_SET_DEAD)

```
Player health reaches 0
  ↓
PlayerSystem.handleDeath()
  ↓
ENTITY_DEATH emitted (generic death event)
  ↓
PlayerDeathSystem.handlePlayerDeath()
  ↓
processPlayerDeath() (clear inventory, equipment)
  ↓
postDeathCleanup()
  ├─ Set player state to DYING
  ├─ PLAYER_SET_DEAD emitted (once) ← Subscribers run here
  ├─ Create gravestone
  └─ Schedule respawn
```

**Guarantee**: Subscribers run exactly once, after all death processing completes.

## Common Migration Patterns

### Pattern 1: Death Logging

**Before**:
```typescript
world.on("PLAYER_DIED", (data) => {
  logger.info(`Player died: ${data.playerId}`);
});
```

**After**:
```typescript
world.on("PLAYER_SET_DEAD", (data) => {
  logger.info(`Player died: ${data.playerId} (killed by: ${data.killedBy ?? "unknown"})`);
});
```

### Pattern 2: Death Statistics

**Before**:
```typescript
world.on("PLAYER_DIED", (data) => {
  deathCount++;
  deathsByPlayer.set(data.playerId, (deathsByPlayer.get(data.playerId) ?? 0) + 1);
});
```

**After**:
```typescript
world.on("PLAYER_SET_DEAD", (data) => {
  deathCount++;
  deathsByPlayer.set(data.playerId, (deathsByPlayer.get(data.playerId) ?? 0) + 1);
});
```

**Note**: No logic change needed, just event name.

### Pattern 3: Death Notifications

**Before**:
```typescript
world.on("PLAYER_DIED", (data) => {
  const player = world.getEntity(data.playerId) as PlayerEntity;
  notifyNearbyPlayers(player.position, `${player.name} has died!`);
});
```

**After**:
```typescript
world.on("PLAYER_SET_DEAD", (data) => {
  const player = world.getEntity(data.playerId) as PlayerEntity;
  notifyNearbyPlayers(player.position, `${player.name} has died!`);
});
```

**Note**: Player entity still exists when event fires (state is DYING, not removed).

### Pattern 4: Achievement Tracking

**Before**:
```typescript
world.on("PLAYER_DIED", (data) => {
  if (data.killedBy === "Goblin") {
    unlockAchievement(data.playerId, "FIRST_DEATH_TO_GOBLIN");
  }
});
```

**After**:
```typescript
world.on("PLAYER_SET_DEAD", (data) => {
  if (data.killedBy === "Goblin") {
    unlockAchievement(data.playerId, "FIRST_DEATH_TO_GOBLIN");
  }
});
```

**Note**: `killedBy` is now sanitized (XSS protection), but still usable for logic.

### Pattern 5: Conditional Logic Based on Death State

**Before** (fragile):
```typescript
world.on("PLAYER_DIED", (data) => {
  const player = world.getEntity(data.playerId) as PlayerEntity;
  
  // This might be undefined if event fires before death processing!
  if (player.deathState === DeathState.DYING) {
    // Handle death
  }
});
```

**After** (reliable):
```typescript
world.on("PLAYER_SET_DEAD", (data) => {
  const player = world.getEntity(data.playerId) as PlayerEntity;
  
  // Guaranteed to be DYING when this event fires
  console.assert(player.deathState === DeathState.DYING);
  // Handle death
});
```

## Breaking Changes

### Event Payload

**No breaking changes** - payload structure is identical:

```typescript
// Both events use the same payload
interface PlayerDeathEventData {
  playerId: string;
  killedBy?: string;
}
```

### Event Timing

**Breaking change** - event fires at different time:

- **PLAYER_DIED**: Fired before death processing (unreliable)
- **PLAYER_SET_DEAD**: Fired after death processing (reliable)

**Impact**: If your code assumed death processing hadn't completed yet, it will break. Update your code to assume death processing is complete.

### Event Frequency

**Breaking change** - event fires once instead of twice:

- **PLAYER_DIED**: Fired 2 times per death
- **PLAYER_SET_DEAD**: Fired 1 time per death

**Impact**: If your code relied on duplicate events (e.g., incrementing a counter twice), it will break. Update your code to handle single emission.

## Deprecation Timeline

### Phase 1: Deprecation (March 26, 2026)

- `PLAYER_DIED` marked `@deprecated` in JSDoc
- `PLAYER_SET_DEAD` is the recommended event
- Both events work (backward compatibility)

**Action Required**: Migrate to `PLAYER_SET_DEAD` at your convenience.

### Phase 2: Removal (TBD - next major version)

- `PLAYER_DIED` event removed entirely
- Code using `PLAYER_DIED` will break
- No backward compatibility

**Action Required**: Complete migration before next major version.

## Testing Your Migration

### Unit Tests

Update test assertions:

**Before**:
```typescript
test("player death emits PLAYER_DIED", () => {
  const events: string[] = [];
  world.on("PLAYER_DIED", () => events.push("PLAYER_DIED"));
  
  player.health = 0;
  world.update(0.6);  // Tick
  
  expect(events).toEqual(["PLAYER_DIED", "PLAYER_DIED"]);  // Fires twice!
});
```

**After**:
```typescript
test("player death emits PLAYER_SET_DEAD", () => {
  const events: string[] = [];
  world.on("PLAYER_SET_DEAD", () => events.push("PLAYER_SET_DEAD"));
  
  player.health = 0;
  world.update(0.6);  // Tick
  
  expect(events).toEqual(["PLAYER_SET_DEAD"]);  // Fires once
});
```

### Integration Tests

Verify death flow end-to-end:

```typescript
test("death flow completes before PLAYER_SET_DEAD", async () => {
  let deathEventFired = false;
  let gravestoneExists = false;
  let playerStateIsDying = false;

  world.on("PLAYER_SET_DEAD", (data) => {
    deathEventFired = true;
    
    // Verify death processing completed
    const player = world.getEntity(data.playerId) as PlayerEntity;
    playerStateIsDying = player.deathState === DeathState.DYING;
    
    // Verify gravestone created
    const gravestone = world.getEntity(`gravestone_${data.playerId}`);
    gravestoneExists = gravestone !== undefined;
  });

  // Kill player
  player.health = 0;
  await world.update(0.6);  // Tick

  expect(deathEventFired).toBe(true);
  expect(playerStateIsDying).toBe(true);
  expect(gravestoneExists).toBe(true);
});
```

## Troubleshooting

### Issue: Event not firing

**Symptoms**: `PLAYER_SET_DEAD` never fires when player dies.

**Diagnosis**:
1. Check that player health actually reaches 0
2. Check server logs for death processing errors
3. Verify `PlayerDeathSystem` is registered in world

**Solution**: Update to latest version (March 26, 2026+). Ensure `PlayerDeathSystem` is in your world's system list.

### Issue: Event fires multiple times

**Symptoms**: `PLAYER_SET_DEAD` fires more than once for a single death.

**Diagnosis**:
1. Check for duplicate `PlayerDeathSystem` instances
2. Check for manual `PLAYER_SET_DEAD` emissions (anti-pattern)

**Solution**: Remove duplicate system registrations. Never emit `PLAYER_SET_DEAD` manually.

### Issue: Gravestone doesn't exist when event fires

**Symptoms**: `PLAYER_SET_DEAD` fires but gravestone entity is undefined.

**Diagnosis**:
1. Check server logs for gravestone creation errors
2. Verify position is valid (not NaN/Infinity)
3. Check entity manager for gravestone entity

**Solution**: Update to latest version. Position validation was added in PR #1094.

## FAQ

### Q: Can I use both PLAYER_DIED and PLAYER_SET_DEAD during migration?

**A**: Yes, both events work during the deprecation phase. However, you should migrate to `PLAYER_SET_DEAD` as soon as possible to avoid breaking changes in the next major version.

### Q: What's the difference between ENTITY_DEATH and PLAYER_SET_DEAD?

**A**: 
- `ENTITY_DEATH` is a generic event for any entity death (players, mobs, NPCs)
- `PLAYER_SET_DEAD` is player-specific and fires after death processing completes
- Use `PLAYER_SET_DEAD` for player-specific logic (respawn, gravestones, etc.)
- Use `ENTITY_DEATH` for generic death logic (kill tracking, loot drops, etc.)

### Q: Does PLAYER_SET_DEAD fire for mob deaths?

**A**: No, `PLAYER_SET_DEAD` is player-only. For mob deaths, use `ENTITY_DEATH` or mob-specific events.

### Q: What if I need to run code BEFORE death processing?

**A**: Subscribe to `ENTITY_DEATH` instead. This fires immediately when health reaches 0, before death processing starts.

**Example**:
```typescript
// Run before death processing
world.on("ENTITY_DEATH", (data) => {
  if (data.entityType === "Player") {
    // Save pre-death state, etc.
  }
});

// Run after death processing
world.on("PLAYER_SET_DEAD", (data) => {
  // Handle post-death logic
});
```

### Q: Can I still access player inventory when PLAYER_SET_DEAD fires?

**A**: No, inventory and equipment are cleared before `PLAYER_SET_DEAD` fires. If you need pre-death inventory, subscribe to `ENTITY_DEATH` instead.

**Example**:
```typescript
// Capture inventory before death
world.on("ENTITY_DEATH", (data) => {
  if (data.entityType === "Player") {
    const player = world.getEntity(data.entityId) as PlayerEntity;
    const inventory = player.inventory.items;  // Still populated
    // Save inventory snapshot
  }
});

// Handle post-death logic
world.on("PLAYER_SET_DEAD", (data) => {
  const player = world.getEntity(data.playerId) as PlayerEntity;
  const inventory = player.inventory.items;  // Empty (cleared)
});
```

### Q: What about ElizaOS agents?

**A**: The `plugin-hyperscape` package has been updated to use `PLAYER_SET_DEAD`. If you're using a custom ElizaOS plugin, update your event listeners.

**File**: `packages/plugin-hyperscape/src/types.ts`

**Before**:
```typescript
// Deprecated
export type HyperscapeEvent = 
  | { type: "PLAYER_DIED"; data: { playerId: string } }
  | ...
```

**After**:
```typescript
// Current
export type HyperscapeEvent = 
  | { type: "PLAYER_SET_DEAD"; data: { playerId: string; killedBy?: string } }
  | ...
```

## Automated Migration

### Search and Replace

Use your editor's search-and-replace to migrate:

**Find**: `PLAYER_DIED`  
**Replace**: `PLAYER_SET_DEAD`

**Regex** (for event listener patterns):
```regex
Find:    world\.on\("PLAYER_DIED"
Replace: world.on("PLAYER_SET_DEAD"
```

**Regex** (for event emission patterns - should find none):
```regex
Find:    world\.emit\("PLAYER_DIED"
Replace: world.emit("PLAYER_SET_DEAD"
```

### Codemod Script

For large codebases, use a codemod:

```typescript
// migrate-player-died.ts
import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

const files = glob.sync("packages/**/*.{ts,tsx}", {
  ignore: ["**/node_modules/**", "**/dist/**"],
});

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  let changed = false;

  // Replace event listeners
  if (content.includes('on("PLAYER_DIED"')) {
    content = content.replace(/on\("PLAYER_DIED"/g, 'on("PLAYER_SET_DEAD"');
    changed = true;
  }

  // Replace event emissions (should find none, but check anyway)
  if (content.includes('emit("PLAYER_DIED"')) {
    content = content.replace(/emit\("PLAYER_DIED"/g, 'emit("PLAYER_SET_DEAD"');
    changed = true;
  }

  // Replace type references
  if (content.includes("PLAYER_DIED")) {
    content = content.replace(/PLAYER_DIED/g, "PLAYER_SET_DEAD");
    changed = true;
  }

  if (changed) {
    writeFileSync(file, content, "utf-8");
    console.log(`Updated: ${file}`);
  }
}
```

Run with:
```bash
bun run migrate-player-died.ts
```

## Rollback Plan

If you need to rollback during migration:

### Option 1: Listen to Both Events

```typescript
// Temporary during migration
const handleDeath = (data: { playerId: string; killedBy?: string }) => {
  // Your death handling logic
};

world.on("PLAYER_DIED", handleDeath);      // Old event (deprecated)
world.on("PLAYER_SET_DEAD", handleDeath);  // New event

// Remove PLAYER_DIED listener after migration complete
```

### Option 2: Feature Flag

```typescript
const USE_NEW_DEATH_EVENT = process.env.USE_NEW_DEATH_EVENT === "true";

if (USE_NEW_DEATH_EVENT) {
  world.on("PLAYER_SET_DEAD", handleDeath);
} else {
  world.on("PLAYER_DIED", handleDeath);
}
```

## Support

If you encounter issues during migration:

1. **Check the logs**: Look for death processing errors
2. **Review the PR**: See [PR #1094](https://github.com/HyperscapeAI/hyperscape/pull/1094) for implementation details
3. **Read the docs**: See [death-system-architecture.md](../death-system-architecture.md) for complete system documentation
4. **Ask for help**: Open an issue on GitHub with your migration question

## References

- **PR #1094**: Player death system overhaul
- **DeathUtils.ts**: Pure utility functions
- **PlayerDeathSystem.ts**: Main death orchestration
- **death-system-architecture.md**: Complete system documentation
- **CLAUDE.md**: Recent changes section
