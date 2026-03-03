# Object Pooling for Zero-Allocation Event Emission

Hyperscape implements comprehensive object pooling to eliminate garbage collection (GC) pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Overview

Object pooling pre-allocates reusable objects and recycles them instead of creating new instances. This eliminates per-tick memory allocations in hot paths, keeping memory usage flat during intensive gameplay.

**Performance Impact**:
- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor

## Core Infrastructure

### Location

All pooling infrastructure is located in `packages/shared/src/utils/pools/`:

- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools
- **PositionPool.ts**: Pool for `{x, y, z}` position objects
- **CombatEventPools.ts**: Pre-configured pools for all combat events
- **QuaternionPool.ts**: Pool for quaternion objects
- **TilePool.ts**: Pool for tile coordinate objects
- **EntityPool.ts**: Pool for entity references

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

Located in `packages/shared/src/utils/pools/CombatEventPools.ts`:

| Pool | Event Type | Initial Size | Growth Size |
|------|-----------|--------------|-------------|
| `damageDealt` | COMBAT_DAMAGE_DEALT | 64 | 32 |
| `projectileLaunched` | COMBAT_PROJECTILE_LAUNCHED | 32 | 16 |
| `faceTarget` | COMBAT_FACE_TARGET | 32 | 16 |
| `clearFaceTarget` | COMBAT_CLEAR_FACE_TARGET | 16 | 8 |
| `attackFailed` | COMBAT_ATTACK_FAILED | 32 | 16 |
| `followTarget` | COMBAT_FOLLOW_TARGET | 32 | 16 |
| `combatStarted` | COMBAT_STARTED | 32 | 16 |
| `combatEnded` | COMBAT_ENDED | 32 | 16 |
| `projectileHit` | COMBAT_PROJECTILE_HIT | 32 | 16 |
| `combatKill` | COMBAT_KILL | 16 | 8 |

### Pool Configuration

Each pool is configured with:
- **Initial size**: Pre-allocated objects on pool creation
- **Growth size**: Objects added when pool is exhausted
- **Leak detection**: Warns when payloads not released at end of tick
- **Statistics**: Track acquire/release counts, peak usage, leak warnings

### Monitoring

```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();
console.log(stats);
// {
//   damageDealt: { acquired: 1234, released: 1234, peak: 45, leaks: 0 },
//   projectileLaunched: { acquired: 567, released: 567, peak: 12, leaks: 0 },
//   ...
// }

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();
if (leakCount > 0) {
  console.warn(`Detected ${leakCount} leaked event payloads`);
}

// Reset all pools (use with caution - only for testing)
CombatEventPools.resetAll();
```

## Position Pool

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

### Features

- **O(1) acquire/release operations**: Constant-time performance
- **Zero allocations after warmup**: No GC pressure after initial pool creation
- **Automatic pool growth**: Expands when exhausted
- **Helper methods**: `set()`, `copy()`, `distanceSquared()`
- **Statistics tracking**: `getStats()` for monitoring

### API Reference

```typescript
interface PositionPool {
  // Acquire a position from the pool
  acquire(x: number, y: number, z: number): Position3D;
  
  // Release a position back to the pool
  release(pos: Position3D): void;
  
  // Use a position with automatic release
  withPosition<T>(
    x: number,
    y: number,
    z: number,
    callback: (pos: Position3D) => T
  ): T;
  
  // Get pool statistics
  getStats(): PoolStats;
}

interface Position3D {
  x: number;
  y: number;
  z: number;
  
  // Helper methods
  set(x: number, y: number, z: number): void;
  copy(other: Position3D): void;
  distanceSquared(other: Position3D): number;
}
```

## Creating New Pools

When adding new high-frequency events, create a pool to avoid allocations:

```typescript
import { createEventPayloadPool } from './EventPayloadPool';
import { eventPayloadPoolRegistry } from './EventPayloadPool';

// 1. Define payload interface
interface MyEventPayload extends PooledPayload {
  entityId: string;
  value: number;
  timestamp: number;
}

// 2. Create pool
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
});

// 3. Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);

// 4. Use in event emitter
const payload = myEventPool.acquire();
payload.entityId = entity.id;
payload.value = 42;
payload.timestamp = Date.now();
this.emitTypedEvent(EventType.MY_EVENT, payload);

// 5. Release in event listener
world.on(EventType.MY_EVENT, (payload) => {
  // Process event...
  myEventPool.release(payload);
});
```

### Pool Configuration Guidelines

**Initial Size**:
- High-frequency events (every tick): 64-128 objects
- Medium-frequency events (every few ticks): 32-64 objects
- Low-frequency events (occasional): 16-32 objects

**Growth Size**:
- Typically 25-50% of initial size
- Larger growth for bursty events
- Smaller growth for steady-state events

**Reset Function**:
- Clear all object properties to default values
- Prevents data leakage between uses
- Must be fast (no complex operations)

## Best Practices

### 1. Always Release Payloads

```typescript
// ❌ WRONG - Payload never released
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  applyDamage(payload.targetId, payload.damage);
  // Missing release() - causes memory leak!
});

// ✅ CORRECT - Payload released after use
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  applyDamage(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload);
});
```

### 2. Release Even on Early Returns

```typescript
// ❌ WRONG - Payload leaked on early return
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  if (!isValidTarget(payload.targetId)) {
    return; // Leak!
  }
  applyDamage(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload);
});

// ✅ CORRECT - Payload released in all code paths
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  try {
    if (!isValidTarget(payload.targetId)) {
      return;
    }
    applyDamage(payload.targetId, payload.damage);
  } finally {
    CombatEventPools.damageDealt.release(payload);
  }
});
```

### 3. Don't Store Pool Objects

```typescript
// ❌ WRONG - Storing pool object causes use-after-release
class MySystem {
  private lastDamage: DamagePayload | null = null;
  
  onDamage(payload: DamagePayload) {
    this.lastDamage = payload; // Dangerous!
    CombatEventPools.damageDealt.release(payload);
  }
  
  tick() {
    // lastDamage may have been reused by another event!
    console.log(this.lastDamage?.damage);
  }
}

// ✅ CORRECT - Copy data, don't store pool object
class MySystem {
  private lastDamage: { targetId: string; damage: number } | null = null;
  
  onDamage(payload: DamagePayload) {
    this.lastDamage = {
      targetId: payload.targetId,
      damage: payload.damage
    };
    CombatEventPools.damageDealt.release(payload);
  }
}
```

### 4. Monitor for Leaks

```typescript
// Add leak detection to your tick loop
class CombatSystem extends SystemBase {
  tick(delta: number) {
    // ... combat logic ...
    
    // Check for leaks at end of tick
    if (this.world.isServer) {
      const leakCount = CombatEventPools.checkAllLeaks();
      if (leakCount > 0) {
        this.logger.warn(`Detected ${leakCount} leaked combat event payloads`);
      }
    }
  }
}
```

## Performance Benchmarks

### Memory Usage

**Without Pooling** (baseline):
- Memory grows ~2MB per minute during combat
- GC pauses every 10-15 seconds
- Heap size increases unbounded

**With Pooling** (optimized):
- Memory stays flat during 60s stress test
- No GC pauses during combat
- Heap size stable at ~50MB

### Allocation Rate

**Without Pooling**:
- ~1000 allocations/second during combat
- ~500KB/second allocation rate
- Frequent GC cycles

**With Pooling**:
- ~0 allocations/second during combat (after warmup)
- ~0KB/second allocation rate
- No GC cycles during steady-state

## Debugging

### Enable Pool Statistics

```typescript
// Log pool stats every 10 seconds
setInterval(() => {
  const stats = CombatEventPools.getAllStats();
  console.log('Combat Event Pool Stats:', stats);
}, 10000);
```

### Detect Pool Exhaustion

```typescript
// Pool will warn when it needs to grow
// Check console for warnings like:
// "EventPayloadPool[damageDealt] exhausted, growing from 64 to 96"
```

### Find Memory Leaks

```typescript
// Run leak detection at end of each tick
const leakCount = CombatEventPools.checkAllLeaks();
if (leakCount > 0) {
  // Inspect which pools have leaks
  const stats = CombatEventPools.getAllStats();
  for (const [name, stat] of Object.entries(stats)) {
    if (stat.acquired !== stat.released) {
      console.error(`Pool ${name} has ${stat.acquired - stat.released} leaked objects`);
    }
  }
}
```

## Migration Guide

### Converting Existing Code to Use Pools

**Before** (allocates new object every time):
```typescript
// CombatSystem.ts
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15,
  timestamp: Date.now()
});

// Event listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  applyDamage(payload.targetId, payload.damage);
});
```

**After** (uses pool):
```typescript
// CombatSystem.ts
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.timestamp = Date.now();
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// Event listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  applyDamage(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload); // MUST release!
});
```

### Checklist for Migration

- [ ] Identify high-frequency event emissions (>10/second)
- [ ] Create pool with appropriate initial/growth sizes
- [ ] Update emitter to acquire from pool
- [ ] Update ALL listeners to release after use
- [ ] Add leak detection to tick loop
- [ ] Test with stress scenarios
- [ ] Monitor pool statistics in production

## Related Systems

### Other Pooled Objects

Hyperscape uses pooling in multiple systems:

- **Position Pool**: `{x, y, z}` coordinates
- **Quaternion Pool**: Rotation quaternions
- **Tile Pool**: Tile coordinates for pathfinding
- **Entity Pool**: Entity reference recycling
- **Texture/Material Pools**: GPU resource reuse (XPDropSystem, DuelCountdownSplatSystem)

### Memory Management Best Practices

When creating new systems or managers:

1. **Track All Resources**: Store references to intervals, listeners, handlers
2. **Implement Cleanup**: Add `destroy()`, `shutdown()`, or `stop()` methods
3. **Follow SystemBase Pattern**: Use the same cleanup patterns as SystemBase
4. **Clean Up on Hot Reload**: Ensure resources are released during development
5. **Test for Leaks**: Monitor memory usage during long-running sessions

Example cleanup pattern:
```typescript
class MySystem {
  private listeners: Array<() => void> = [];
  private intervals: NodeJS.Timeout[] = [];

  init() {
    const listener = world.on('event', this.handleEvent);
    this.listeners.push(listener);
    
    const interval = setInterval(this.tick, 1000);
    this.intervals.push(interval);
  }

  destroy() {
    // Clean up listeners
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    
    // Clear intervals
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }
}
```

## Advanced Topics

### Custom Pool Implementation

For specialized use cases, you can create custom pools:

```typescript
class CustomObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number
  ) {
    this.factory = factory;
    this.reset = reset;
    
    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }
  
  acquire(): T {
    if (this.pool.length === 0) {
      // Pool exhausted, create new object
      return this.factory();
    }
    return this.pool.pop()!;
  }
  
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

### Pool Sizing Strategy

**Determine Initial Size**:
1. Profile your application under typical load
2. Count peak concurrent allocations
3. Add 25-50% buffer for bursts
4. Round up to nearest power of 2

**Determine Growth Size**:
1. Monitor pool exhaustion warnings
2. If frequent: increase initial size
3. If rare: keep growth size small
4. Typical: 25-50% of initial size

**Example Calculation**:
```
Peak concurrent damage events: 40
Buffer (50%): 20
Initial size: 64 (next power of 2)
Growth size: 32 (50% of initial)
```

## Troubleshooting

### Pool Exhaustion Warnings

**Symptom**: Console warnings like "EventPayloadPool[damageDealt] exhausted, growing from 64 to 96"

**Causes**:
- Initial size too small for typical load
- Payloads not being released (memory leak)
- Burst of events exceeding normal capacity

**Solutions**:
- Increase initial size if warnings are frequent
- Check for missing `release()` calls
- Add leak detection to find unreleased payloads

### Memory Leaks

**Symptom**: Pool statistics show `acquired > released`

**Causes**:
- Missing `release()` call in event listener
- Early return without release
- Exception thrown before release

**Solutions**:
- Use `try/finally` to ensure release
- Add leak detection at end of tick
- Review all event listeners for missing releases

### Performance Degradation

**Symptom**: Pool operations taking longer than expected

**Causes**:
- Pool grown too large (>10,000 objects)
- Reset function doing expensive operations
- Fragmented memory from excessive growth

**Solutions**:
- Reduce initial/growth sizes if pool is too large
- Optimize reset function (should be O(1))
- Periodically trim pool during idle periods

## References

- **Implementation**: `packages/shared/src/utils/pools/`
- **Usage Examples**: `packages/shared/src/systems/shared/combat/CombatSystem.ts`
- **Tests**: `packages/shared/src/utils/pools/__tests__/`
- **Performance Tests**: `packages/shared/src/systems/shared/combat/__tests__/CombatSystemPerformance.test.ts`

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Memory management best practices
- [CLAUDE.md](../CLAUDE.md) - Memory leak fixes and cleanup patterns
- [Combat System Documentation](../packages/shared/dev-book/05-core-systems/COMBAT-SYSTEM-DOCUMENTATION.md)
