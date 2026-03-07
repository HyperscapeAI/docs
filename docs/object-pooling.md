# Object Pooling System

Hyperscape implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Overview

**Location**: `packages/shared/src/utils/pools/`

**Core Infrastructure**:
- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools with automatic growth and leak detection
- **PositionPool.ts**: Pool for `{x, y, z}` position objects with helper methods
- **CombatEventPools.ts**: Pre-configured pools for all combat events with optimized sizes
- **TilePool.ts**: Pool for tile coordinate objects
- **QuaternionPool.ts**: Pool for quaternion objects
- **EntityPool.ts**: Pool for entity instances

## Event Payload Pools

### Usage Pattern

```typescript
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

| Pool | Event Type | Initial Size | Growth Size |
|------|-----------|--------------|-------------|
| `damageDealt` | COMBAT_DAMAGE_DEALT | 64 | 32 |
| `projectileLaunched` | COMBAT_PROJECTILE_LAUNCHED | 32 | 16 |
| `faceTarget` | COMBAT_FACE_TARGET | 64 | 32 |
| `clearFaceTarget` | COMBAT_CLEAR_FACE_TARGET | 64 | 32 |
| `attackFailed` | COMBAT_ATTACK_FAILED | 32 | 16 |
| `followTarget` | COMBAT_FOLLOW_TARGET | 32 | 16 |
| `combatStarted` | COMBAT_STARTED | 32 | 16 |
| `combatEnded` | COMBAT_ENDED | 32 | 16 |
| `projectileHit` | COMBAT_PROJECTILE_HIT | 32 | 16 |
| `combatKill` | COMBAT_KILL | 16 | 8 |

### Pool Features

- **Automatic Growth**: Pools automatically expand when exhausted (warns every 60s)
- **Leak Detection**: Warns when payloads not released at end of tick (max 10 warnings, then suppressed)
- **Statistics Tracking**: Acquire/release counts, peak usage, leak warnings
- **Global Registry**: Monitor all pools via `eventPayloadPoolRegistry`

### Monitoring

```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();

// Reset all pools (use with caution)
CombatEventPools.resetAll();

// Global registry for all pools
import { eventPayloadPoolRegistry } from '@hyperscape/shared/utils/pools';
const allStats = eventPayloadPoolRegistry.getAllStats();
const allLeaks = eventPayloadPoolRegistry.checkAllLeaks();
```

### Performance Impact

- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor
- Reduces GC pressure by 90%+ in high-frequency combat scenarios

## Position Pool

**Location**: `packages/shared/src/utils/pools/PositionPool.ts`

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
});
```

### Features

- O(1) acquire/release operations
- Zero allocations after warmup
- Automatic pool growth when exhausted
- Helper methods: `set()`, `copy()`, `distanceSquared()`
- Statistics tracking: `getStats()`

## Creating New Pools

When adding new high-frequency events, create a pool:

```typescript
import { createEventPayloadPool, eventPayloadPoolRegistry, type PooledPayload } from './EventPayloadPool';

interface MyEventPayload extends PooledPayload {
  entityId: string;
  value: number;
}

const myEventPool = createEventPayloadPool<MyEventPayload>({
  name: 'MyEvent',
  factory: () => ({ entityId: '', value: 0 }),
  reset: (p) => { p.entityId = ''; p.value = 0; },
  initialSize: 32,
  growthSize: 16,
  warnOnLeaks: true, // Enable leak detection (default: true)
});

// Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);
```

### Pool Configuration Options

- `name`: Pool name for debugging and monitoring
- `factory`: Function to create new payload objects (without `_poolIndex`)
- `reset`: Function to reset payload to initial state
- `initialSize`: Initial pool size (default: 64)
- `growthSize`: Number of objects to add when exhausted (default: 32)
- `warnOnLeaks`: Enable leak detection warnings (default: true)

### Best Practices

1. **Set `initialSize` based on expected concurrent usage** (e.g., max concurrent combatants)
2. **Set `growthSize` to ~50% of `initialSize`** for balanced growth
3. **Always register pools** with `eventPayloadPoolRegistry` for monitoring
4. **Use descriptive names** for easier debugging
5. **Call `checkLeaks()` at the end of each game tick** to detect unreleased payloads

## Pool Statistics

### EventPayloadPoolStats Interface

```typescript
interface EventPayloadPoolStats {
  name: string;           // Pool name
  total: number;          // Total pool size
  available: number;      // Available objects
  inUse: number;          // Objects currently in use
  peakUsage: number;      // Peak concurrent usage
  acquireCount: number;   // Total acquire calls
  releaseCount: number;   // Total release calls
  leakWarnings: number;   // Number of leak warnings
}
```

### Example: Monitoring All Pools

```typescript
// Get all pool statistics
const allStats = eventPayloadPoolRegistry.getAllStats();

console.log('Pool Statistics:');
allStats.forEach(stats => {
  console.log(`${stats.name}:`);
  console.log(`  Total: ${stats.total}`);
  console.log(`  In Use: ${stats.inUse}`);
  console.log(`  Peak Usage: ${stats.peakUsage}`);
  console.log(`  Acquire/Release: ${stats.acquireCount}/${stats.releaseCount}`);
  console.log(`  Leak Warnings: ${stats.leakWarnings}`);
});

// Check for leaks at end of tick
const leaks = eventPayloadPoolRegistry.checkAllLeaks();
if (leaks.size > 0) {
  console.warn('Detected unreleased payloads:', leaks);
}
```

## Troubleshooting

### Pool Exhaustion Warnings

If you see warnings like:
```
[EventPayloadPool:CombatDamageDealt] Pool exhausted (64/64 in use), growing by 32
```

This indicates high concurrent usage. Consider:
1. Increasing `initialSize` to reduce growth frequency
2. Checking for missing `release()` calls (memory leaks)
3. Optimizing event emission frequency

### Memory Leaks

If you see leak warnings:
```
[EventPayloadPool:CombatDamageDealt] Potential leak: 5 payloads still in use at end of tick
```

This means event listeners are not calling `release()`. Find the missing `release()` calls:

```typescript
// ❌ WRONG - causes memory leak
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  // Missing release() call!
});

// ✅ CORRECT - releases payload back to pool
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### Performance Monitoring

Monitor pool performance during development:

```typescript
// In your game tick loop
if (tickCount % 600 === 0) { // Every 10 seconds at 60 FPS
  const stats = CombatEventPools.getAllStats();
  console.log('Combat Pool Stats:', stats);
  
  const leaks = CombatEventPools.checkAllLeaks();
  if (leaks > 0) {
    console.warn(`Detected ${leaks} unreleased combat event payloads`);
  }
}
```

## Implementation Details

### PooledPayload Interface

All pooled payloads must extend `PooledPayload`:

```typescript
interface PooledPayload {
  /** Internal pool index - do not modify */
  _poolIndex: number;
}
```

The `_poolIndex` property is used internally for tracking and should never be modified by user code.

### Pool Lifecycle

1. **Initialization**: Pool creates `initialSize` objects
2. **Acquire**: Returns available object, grows pool if exhausted
3. **Use**: Caller populates object with data
4. **Release**: Caller returns object to pool, object is reset
5. **Growth**: Pool automatically expands by `growthSize` when exhausted

### Memory Safety

- Pools use array-based storage for O(1) operations
- Available objects tracked via index array
- No object creation after warmup (unless pool grows)
- Reset function ensures clean state for reuse
- Leak detection prevents unbounded growth

## Related Systems

- **CombatSystem**: Uses combat event pools for zero-allocation event emission
- **CombatTickProcessor**: Uses combat event pools for tick processing
- **EventBus**: Event system that pools integrate with
- **SystemBase**: Base class for systems with cleanup patterns

## Migration Guide

### Converting Existing Code to Use Pools

**Before (allocates on every event):**
```typescript
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15,
  attackType: 'melee',
  targetType: 'mob',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  hasPosition: false,
  isCritical: false,
});
```

**After (uses pool):**
```typescript
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.attackType = 'melee';
payload.targetType = 'mob';
payload.positionX = 0;
payload.positionY = 0;
payload.positionZ = 0;
payload.hasPosition = false;
payload.isCritical = false;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);
```

**Listener (must release):**
```typescript
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

## References

- [EventPayloadPool.ts](../packages/shared/src/utils/pools/EventPayloadPool.ts) - Pool factory implementation
- [CombatEventPools.ts](../packages/shared/src/utils/pools/CombatEventPools.ts) - Pre-configured combat pools
- [PositionPool.ts](../packages/shared/src/utils/pools/PositionPool.ts) - Position object pool
- [CombatSystem.ts](../packages/shared/src/systems/shared/combat/CombatSystem.ts) - Example usage in combat system
