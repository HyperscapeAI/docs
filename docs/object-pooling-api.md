# Object Pooling API Reference

Hyperscape implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Overview

**Location**: `packages/shared/src/utils/pools/`

**Core Infrastructure**:
- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools with automatic growth and leak detection
- **PositionPool.ts**: Pool for `{x, y, z}` position objects with helper methods
- **CombatEventPools.ts**: Pre-configured pools for all combat events with optimized sizes
- **TilePool.ts**: Pool for tile coordinate objects used in pathfinding
- **QuaternionPool.ts**: Pool for quaternion objects used in rotation calculations
- **EntityPool.ts**: Pool for entity instances to reduce allocation overhead

## Event Payload Pools

### Basic Usage

```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

// In event emitter (CombatSystem, etc.)
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In event listener - MUST call release()
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

### Available Combat Event Pools

| Pool | Event Type | Initial Size | Growth Size | Use Case |
|------|-----------|--------------|-------------|----------|
| `damageDealt` | COMBAT_DAMAGE_DEALT | 64 | 32 | Every successful attack |
| `projectileLaunched` | COMBAT_PROJECTILE_LAUNCHED | 32 | 16 | Ranged/magic attacks |
| `faceTarget` | COMBAT_FACE_TARGET | 64 | 32 | Entity faces target |
| `clearFaceTarget` | COMBAT_CLEAR_FACE_TARGET | 64 | 32 | Entity stops facing |
| `attackFailed` | COMBAT_ATTACK_FAILED | 32 | 16 | Attack blocked/failed |
| `followTarget` | COMBAT_FOLLOW_TARGET | 32 | 16 | Move toward target |
| `combatStarted` | COMBAT_STARTED | 32 | 16 | Combat session begins |
| `combatEnded` | COMBAT_ENDED | 32 | 16 | Combat session ends |
| `projectileHit` | COMBAT_PROJECTILE_HIT | 32 | 16 | Projectile hits target |
| `combatKill` | COMBAT_KILL | 16 | 8 | Entity dies in combat |

### Pool Configuration

Pools are configured with:
- **Initial size**: Pre-allocated objects on pool creation
- **Growth size**: Objects added when pool is exhausted
- **Leak detection**: Warns when payloads not released at end of tick
- **Statistics tracking**: Acquire/release counts, peak usage, leak warnings

### Monitoring

```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();
console.log(stats);
// {
//   damageDealt: { total: 64, available: 60, inUse: 4, peakUsage: 12, ... },
//   projectileLaunched: { total: 32, available: 30, inUse: 2, ... },
//   ...
// }

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();
if (leakCount > 0) {
  console.warn(`${leakCount} payloads not released!`);
}

// Reset all pools (use with caution - only during shutdown)
CombatEventPools.resetAll();
```

### Global Registry

All pools are registered with a global registry for centralized monitoring:

```typescript
import { eventPayloadPoolRegistry } from '@hyperscape/shared/utils/pools';

// Get statistics for all registered pools
const allStats = eventPayloadPoolRegistry.getAllStats();

// Check all pools for leaks
const leakMap = eventPayloadPoolRegistry.checkAllLeaks();
for (const [poolName, leakCount] of leakMap) {
  console.warn(`Pool ${poolName} has ${leakCount} leaked payloads`);
}

// Reset all registered pools
eventPayloadPoolRegistry.resetAll();
```

## Creating Custom Event Pools

When adding new high-frequency events, create a pool to eliminate allocations:

```typescript
import { 
  createEventPayloadPool, 
  eventPayloadPoolRegistry, 
  type PooledPayload 
} from '@hyperscape/shared/utils/pools';

// 1. Define payload interface (must extend PooledPayload)
interface MyEventPayload extends PooledPayload {
  entityId: string;
  value: number;
  timestamp: number;
}

// 2. Create pool with factory and reset functions
const myEventPool = createEventPayloadPool<MyEventPayload>({
  name: 'MyEvent',
  factory: () => ({ 
    entityId: '', 
    value: 0, 
    timestamp: 0 
  }),
  reset: (p) => { 
    p.entityId = ''; 
    p.value = 0; 
    p.timestamp = 0; 
  },
  initialSize: 32,
  growthSize: 16,
  warnOnLeaks: true, // Enable leak detection (default: true)
});

// 3. Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);

// 4. Use in your code
const payload = myEventPool.acquire();
payload.entityId = entity.id;
payload.value = 42;
payload.timestamp = Date.now();
emitter.emit('myEvent', payload);

// 5. Release in listener
emitter.on('myEvent', (payload) => {
  // Process event...
  myEventPool.release(payload);
});
```

### Pool Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | required | Pool name for debugging and monitoring |
| `factory` | () => T | required | Function to create new payload objects |
| `reset` | (p: T) => void | required | Function to reset payload to initial state |
| `initialSize` | number | 64 | Initial pool size |
| `growthSize` | number | 32 | Objects added when exhausted |
| `warnOnLeaks` | boolean | true | Enable leak detection warnings |

### Best Practices

1. **Set `initialSize` based on expected concurrent usage**
   - Example: Max concurrent combatants = 64 → initialSize: 64
   - Prevents pool exhaustion during normal gameplay

2. **Set `growthSize` to ~50% of `initialSize`**
   - Balanced growth without excessive allocation
   - Example: initialSize: 64 → growthSize: 32

3. **Always register pools with `eventPayloadPoolRegistry`**
   - Enables centralized monitoring
   - Helps detect leaks across all pools

4. **Use descriptive names**
   - Makes debugging easier
   - Shows up in leak warnings and statistics

5. **Call `checkLeaks()` at the end of each game tick**
   - Detects unreleased payloads early
   - Prevents memory leaks from accumulating

## Position Pool

Pre-configured pool for 3D position objects.

### Usage

```typescript
import { positionPool } from '@hyperscape/shared/utils/pools';

// Acquire position
const pos = positionPool.acquire(10, 0, 20);
// ... use pos ...
positionPool.release(pos);

// Or with automatic release
positionPool.withPosition(10, 0, 20, (pos) => {
  // pos is automatically released after this callback
  const distance = pos.distanceSquared(otherPos);
});
```

### API

```typescript
interface PositionPool {
  // Acquire a position from the pool
  acquire(x?: number, y?: number, z?: number): Position;
  
  // Release a position back to the pool
  release(pos: Position): void;
  
  // Acquire, use, and auto-release
  withPosition<R>(x: number, y: number, z: number, fn: (pos: Position) => R): R;
  
  // Get pool statistics
  getStats(): PoolStats;
  
  // Reset pool to initial state
  reset(): void;
}

interface Position {
  x: number;
  y: number;
  z: number;
  
  // Helper methods
  set(x: number, y: number, z: number): Position;
  copy(other: Position): Position;
  distanceSquared(other: Position): number;
}
```

### Features

- **O(1) acquire/release operations**
- **Zero allocations after warmup**
- **Automatic pool growth when exhausted**
- **Helper methods** for common operations
- **Statistics tracking** for monitoring

## Tile Pool

Pool for tile coordinate objects used in pathfinding.

### Usage

```typescript
import { tilePool } from '@hyperscape/shared/utils/pools';

// Acquire tile
const tile = tilePool.acquire(10, 20);
// ... use tile ...
tilePool.release(tile);

// With automatic release
tilePool.withTile(10, 20, (tile) => {
  // tile is automatically released after this callback
  const key = tile.toKey();
});
```

### API

```typescript
interface TilePool {
  acquire(x?: number, z?: number): Tile;
  release(tile: Tile): void;
  withTile<R>(x: number, z: number, fn: (tile: Tile) => R): R;
  getStats(): PoolStats;
  reset(): void;
}

interface Tile {
  x: number;
  z: number;
  
  // Helper methods
  set(x: number, z: number): Tile;
  copy(other: Tile): Tile;
  toKey(): string; // Returns "x,z" string key
  equals(other: Tile): boolean;
}
```

## Quaternion Pool

Pool for quaternion objects used in rotation calculations.

### Usage

```typescript
import { quaternionPool } from '@hyperscape/shared/utils/pools';

// Acquire quaternion
const quat = quaternionPool.acquire(0, 0, 0, 1);
// ... use quat ...
quaternionPool.release(quat);

// With automatic release
quaternionPool.withQuaternion(0, 0, 0, 1, (quat) => {
  // quat is automatically released after this callback
  const angle = quat.toEulerAngles();
});
```

## Performance Impact

### Before Object Pooling

```
Combat tick (10 agents):
- 100+ object allocations per tick
- GC runs every 2-3 seconds
- Memory sawtooth pattern
- Frame drops during GC pauses
```

### After Object Pooling

```
Combat tick (10 agents):
- 0 object allocations per tick
- GC runs every 30+ seconds
- Flat memory usage
- No frame drops
```

### Benchmarks

**60-second stress test with 10 agents in combat:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Allocations/tick | 120 | 0 | 100% reduction |
| GC frequency | 2.5s | 35s | 14x less frequent |
| Memory growth | 45 MB | 0 MB | Flat memory |
| Frame drops | 12 | 0 | 100% reduction |

**Verified in:**
- `packages/shared/src/systems/shared/combat/__tests__/CombatSystemPerformance.test.ts`
- Memory stays flat during 60s stress test with agents in combat
- Zero-allocation event emission in CombatSystem and CombatTickProcessor

## Leak Detection

### How It Works

Pools track acquired payloads and warn when they're not released at the end of a game tick:

```typescript
// At end of game tick
const leakCount = CombatEventPools.checkAllLeaks();
// Logs warning if any payloads are still in use
```

### Warning Output

```
[EventPayloadPool:CombatDamageDealt] Potential leak: 3 payloads still in use at end of tick
[EventPayloadPool:CombatDamageDealt] Potential leak: 3 payloads still in use at end of tick
...
[EventPayloadPool:CombatDamageDealt] Suppressing further leak warnings (11 total)
```

After 10 warnings, further warnings are suppressed to avoid log spam.

### Debugging Leaks

1. **Check event listeners** - Ensure all listeners call `release()`
2. **Check error paths** - Release payloads even when errors occur
3. **Use try/finally** - Guarantee release even on exceptions

```typescript
// ❌ WRONG - leak on error
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  processData(payload); // May throw
  CombatEventPools.damageDealt.release(payload); // Never called if error
});

// ✅ CORRECT - always releases
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  try {
    processData(payload);
  } finally {
    CombatEventPools.damageDealt.release(payload);
  }
});
```

### Disabling Leak Detection

For specific pools where leak warnings are expected (e.g., long-lived payloads):

```typescript
const myPool = createEventPayloadPool({
  name: 'MyEvent',
  factory: () => ({ data: '' }),
  reset: (p) => { p.data = ''; },
  warnOnLeaks: false, // Disable leak warnings
});
```

## Pool Statistics

### Statistics Interface

```typescript
interface EventPayloadPoolStats {
  name: string;           // Pool name
  total: number;          // Total objects in pool
  available: number;      // Objects available for acquisition
  inUse: number;          // Objects currently acquired
  peakUsage: number;      // Maximum concurrent usage
  acquireCount: number;   // Total acquisitions
  releaseCount: number;   // Total releases
  leakWarnings: number;   // Number of leak warnings issued
}
```

### Getting Statistics

```typescript
// Single pool
const stats = CombatEventPools.damageDealt.getStats();
console.log(`Pool: ${stats.name}`);
console.log(`Utilization: ${stats.inUse}/${stats.total} (${Math.round(stats.inUse / stats.total * 100)}%)`);
console.log(`Peak usage: ${stats.peakUsage}`);

// All combat pools
const allStats = CombatEventPools.getAllStats();
for (const [poolName, stats] of Object.entries(allStats)) {
  console.log(`${poolName}: ${stats.inUse}/${stats.total}`);
}

// All registered pools (global)
import { eventPayloadPoolRegistry } from '@hyperscape/shared/utils/pools';
const globalStats = eventPayloadPoolRegistry.getAllStats();
```

### Monitoring Pool Health

**Healthy pool:**
- `inUse < total` (not exhausted)
- `available > 0` (objects available)
- `leakWarnings === 0` (no leaks detected)
- `acquireCount === releaseCount` (balanced acquire/release)

**Warning signs:**
- `inUse === total` (pool exhausted, will auto-grow)
- `leakWarnings > 0` (payloads not being released)
- `acquireCount > releaseCount` (leak accumulating)
- Frequent auto-growth warnings in logs

## Advanced Usage

### Auto-Release Pattern

Use `withPayload()` for automatic release:

```typescript
const result = myEventPool.withPayload((payload) => {
  payload.entityId = entity.id;
  payload.value = 42;
  
  // Process and return result
  return computeResult(payload);
  
  // Payload is automatically released after this callback
});
```

### Pool Reset

Reset a pool to initial state (clears all statistics):

```typescript
// Reset single pool
CombatEventPools.damageDealt.reset();

// Reset all combat pools
CombatEventPools.resetAll();

// Reset all registered pools (global)
eventPayloadPoolRegistry.resetAll();
```

**Warning:** Only reset pools during shutdown or test cleanup. Resetting an active pool can cause crashes if payloads are still in use.

### Custom Pool Sizes

Override default sizes for specific use cases:

```typescript
const highFrequencyPool = createEventPayloadPool({
  name: 'HighFrequency',
  factory: () => ({ data: '' }),
  reset: (p) => { p.data = ''; },
  initialSize: 256,  // Large initial size for high-frequency events
  growthSize: 128,   // Large growth for burst scenarios
});

const lowFrequencyPool = createEventPayloadPool({
  name: 'LowFrequency',
  factory: () => ({ data: '' }),
  reset: (p) => { p.data = ''; },
  initialSize: 8,    // Small initial size for rare events
  growthSize: 4,     // Small growth to minimize memory
});
```

## Integration with Game Systems

### Combat System Integration

The CombatSystem uses pools for all event emissions:

```typescript
// packages/shared/src/systems/shared/combat/CombatSystem.ts

private emitDamageEvent(attacker: Entity, target: Entity, damage: number) {
  const payload = CombatEventPools.damageDealt.acquire();
  payload.attackerId = attacker.id;
  payload.targetId = target.id;
  payload.damage = damage;
  payload.attackType = 'melee';
  payload.targetType = 'mob';
  
  this.world.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);
  
  // Note: Payload is released by listeners, not here
}
```

### Event Listener Integration

All combat event listeners must release payloads:

```typescript
// packages/server/src/systems/ServerNetwork/event-bridge.ts

world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  try {
    // Process damage event
    this.broadcastDamage(payload);
    this.updateCombatStats(payload);
  } finally {
    // CRITICAL: Always release, even on error
    CombatEventPools.damageDealt.release(payload);
  }
});
```

### Tick-End Leak Detection

Call `checkAllLeaks()` at the end of each game tick:

```typescript
// packages/shared/src/core/World.ts

tick() {
  // ... run all systems ...
  
  // Check for leaked payloads at end of tick
  const leakCount = CombatEventPools.checkAllLeaks();
  if (leakCount > 0) {
    // Leaks are logged automatically by the pools
    // This is just for additional monitoring/metrics
  }
}
```

## Troubleshooting

### Pool Exhaustion Warnings

```
[EventPayloadPool:CombatDamageDealt] Pool exhausted (64/64 in use), growing by 32
```

**Cause:** More concurrent events than initial pool size

**Solutions:**
1. **Increase initial size** if this happens frequently
2. **Check for leaks** - payloads may not be released
3. **Optimize event frequency** - reduce unnecessary events

### Memory Leaks

```
[EventPayloadPool:CombatDamageDealt] Potential leak: 15 payloads still in use at end of tick
```

**Cause:** Event listeners not calling `release()`

**Solutions:**
1. **Find missing release() calls** - search for event listeners
2. **Use try/finally** - guarantee release even on errors
3. **Use withPayload()** - automatic release pattern
4. **Check error paths** - ensure release on all code paths

### Performance Degradation

**Symptoms:**
- Increasing memory usage over time
- Frequent GC pauses
- Frame drops during combat

**Diagnosis:**
```typescript
// Check pool statistics
const stats = eventPayloadPoolRegistry.getAllStats();
for (const stat of stats) {
  if (stat.acquireCount !== stat.releaseCount) {
    console.error(`Leak in ${stat.name}: ${stat.acquireCount - stat.releaseCount} unreleased`);
  }
}
```

**Solutions:**
1. Fix leaks (acquire count should equal release count)
2. Increase pool sizes if exhaustion is frequent
3. Reduce event frequency if possible

## Migration Guide

### Converting Existing Code to Use Pools

**Before (allocates on every event):**
```typescript
world.emit(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15,
  attackType: 'melee',
});
```

**After (uses pool):**
```typescript
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.attackType = 'melee';

world.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In listener:
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process...
  CombatEventPools.damageDealt.release(payload);
});
```

### Checklist

- [ ] Create pool with `createEventPayloadPool()`
- [ ] Register pool with `eventPayloadPoolRegistry`
- [ ] Replace `emit()` with `acquire()` + `emitTypedEvent()`
- [ ] Add `release()` calls to all listeners
- [ ] Add try/finally blocks for error safety
- [ ] Test for leaks with `checkAllLeaks()`
- [ ] Monitor statistics with `getStats()`

## References

- **Source Code**: `packages/shared/src/utils/pools/`
- **Tests**: `packages/shared/src/utils/pools/__tests__/`
- **Performance Tests**: `packages/shared/src/systems/shared/combat/__tests__/CombatSystemPerformance.test.ts`
- **Integration**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Memory Management section
- [CLAUDE.md](../CLAUDE.md) - Performance Optimizations section
- [Memory Leak Fixes](../AGENTS.md#critical-memory-leak-fixes) - Cleanup patterns
