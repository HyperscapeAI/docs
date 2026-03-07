# Object Pooling for Zero-Allocation Event Emission

Hyperscape implements comprehensive object pooling to eliminate garbage collection (GC) pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Overview

Object pooling pre-allocates reusable objects and recycles them instead of creating new objects on every event emission. This eliminates per-tick memory allocations in hot paths and keeps memory usage flat during intensive gameplay.

**Performance Impact:**
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

### Event Payload Pools

Event payload pools are the primary mechanism for zero-allocation event emission.

**Available Pools:**
- `CombatEventPools.damageDealt` - COMBAT_DAMAGE_DEALT events
- `CombatEventPools.projectileLaunched` - COMBAT_PROJECTILE_LAUNCHED events
- `CombatEventPools.faceTarget` - COMBAT_FACE_TARGET events
- `CombatEventPools.clearFaceTarget` - COMBAT_CLEAR_FACE_TARGET events
- `CombatEventPools.attackFailed` - COMBAT_ATTACK_FAILED events
- `CombatEventPools.followTarget` - COMBAT_FOLLOW_TARGET events
- `CombatEventPools.combatStarted` - COMBAT_STARTED events
- `CombatEventPools.combatEnded` - COMBAT_ENDED events
- `CombatEventPools.projectileHit` - COMBAT_PROJECTILE_HIT events
- `CombatEventPools.combatKill` - COMBAT_KILL events

## Usage Pattern

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

### Position Pool

The position pool provides reusable `{x, y, z}` objects for spatial calculations:

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

**Features:**
- O(1) acquire/release operations
- Zero allocations after warmup
- Automatic pool growth when exhausted
- Helper methods: `set()`, `copy()`, `distanceSquared()`
- Statistics tracking: `getStats()`

## Pool Configuration

### Initial Sizes

Pools are pre-configured with initial sizes based on expected event frequency:

| Pool | Initial Size | Growth Size | Rationale |
|------|--------------|-------------|-----------|
| damageDealt | 64 | 32 | High frequency (every combat tick) |
| projectileLaunched | 32 | 16 | Medium frequency (ranged combat) |
| faceTarget | 32 | 16 | Medium frequency (combat rotation) |
| clearFaceTarget | 16 | 8 | Low frequency (combat end) |
| attackFailed | 16 | 8 | Low frequency (miss/out of range) |
| followTarget | 32 | 16 | Medium frequency (chase behavior) |
| combatStarted | 32 | 16 | Medium frequency (combat initiation) |
| combatEnded | 32 | 16 | Medium frequency (combat completion) |
| projectileHit | 32 | 16 | Medium frequency (ranged combat) |
| combatKill | 16 | 8 | Low frequency (death events) |

### Automatic Growth

When a pool is exhausted, it automatically grows by its configured growth size. This ensures the system never runs out of objects, but warns when growth occurs to help identify potential leaks.

## Monitoring and Debugging

### Statistics

Get statistics for all combat pools:

```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

// Get statistics for all pools
const stats = CombatEventPools.getAllStats();

// Example output:
// {
//   damageDealt: {
//     name: 'CombatDamageDealt',
//     totalAcquired: 1523,
//     totalReleased: 1523,
//     currentlyAcquired: 0,
//     peakAcquired: 12,
//     poolSize: 64,
//     leakWarnings: 0
//   },
//   ...
// }
```

### Leak Detection

Check for leaked payloads at the end of each tick:

```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();

if (leakCount > 0) {
  console.warn(`Detected ${leakCount} leaked event payloads`);
}
```

Leak detection warns when payloads are not released at the end of a tick, helping identify missing `release()` calls.

### Reset Pools

Reset all pools (use with caution - only for testing or shutdown):

```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

// Reset all pools
CombatEventPools.resetAll();
```

## Creating New Pools

When adding new high-frequency events, create a pool to avoid memory allocations:

```typescript
import { createEventPayloadPool } from './EventPayloadPool';
import { eventPayloadPoolRegistry } from './EventPayloadPool';

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
});

// Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);
```

**Guidelines for Pool Sizing:**
- **High frequency** (every tick): initialSize=64, growthSize=32
- **Medium frequency** (occasional): initialSize=32, growthSize=16
- **Low frequency** (rare): initialSize=16, growthSize=8

## Best Practices

### 1. Always Release Payloads

**CRITICAL**: Every `acquire()` must have a corresponding `release()`.

```typescript
// ❌ WRONG - Missing release()
const payload = CombatEventPools.damageDealt.acquire();
payload.damage = 10;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);
// Payload is never released - MEMORY LEAK!

// ✅ CORRECT - Release in listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### 2. Release After Processing

Release payloads immediately after processing, not at the end of the tick:

```typescript
// ❌ WRONG - Holding payload too long
const payloads: DamagePayload[] = [];
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  payloads.push(payload); // Holding reference
});
// Later...
payloads.forEach(p => CombatEventPools.damageDealt.release(p));

// ✅ CORRECT - Release immediately
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### 3. Don't Store Pool Objects

Never store pooled objects in long-lived data structures:

```typescript
// ❌ WRONG - Storing pooled object
class MySystem {
  private lastDamage: DamagePayload; // DON'T DO THIS!
  
  onDamage(payload: DamagePayload) {
    this.lastDamage = payload; // Payload will be reused!
  }
}

// ✅ CORRECT - Copy data, not reference
class MySystem {
  private lastDamage: { attackerId: string; damage: number };
  
  onDamage(payload: DamagePayload) {
    this.lastDamage = {
      attackerId: payload.attackerId,
      damage: payload.damage
    };
    CombatEventPools.damageDealt.release(payload);
  }
}
```

### 4. Monitor for Leaks

Use leak detection in development to catch missing `release()` calls:

```typescript
// In development mode, check for leaks at end of tick
if (process.env.NODE_ENV === 'development') {
  const leakCount = CombatEventPools.checkAllLeaks();
  if (leakCount > 0) {
    console.warn(`Detected ${leakCount} leaked event payloads`);
  }
}
```

## Performance Characteristics

### Memory Usage

**Before Object Pooling:**
- 10 combatants × 600ms ticks = ~16 events/second
- Each event allocates ~100 bytes
- 1.6 KB/second allocation rate
- Triggers GC every few seconds under load

**After Object Pooling:**
- Pre-allocated pool of 64 objects (~6.4 KB)
- Zero allocations during steady state
- Memory usage remains flat
- No GC pressure from event emission

### Benchmarks

From `CombatSystemPerformance.test.ts`:

```
CombatSystem Performance > Memory Hygiene
  ✓ does not grow heap significantly during combat processing (60s test)
    Initial heap: 45.2 MB
    Final heap: 45.3 MB
    Growth: 0.1 MB (0.2%)
```

## Troubleshooting

### Pool Exhaustion Warnings

If you see warnings about pool exhaustion:

```
[WARN] EventPayloadPool 'CombatDamageDealt' exhausted, growing from 64 to 96
```

**Causes:**
1. Missing `release()` calls in event listeners
2. Holding payloads too long before releasing
3. Unexpected spike in event frequency

**Solutions:**
1. Audit all event listeners for missing `release()` calls
2. Release payloads immediately after processing
3. Increase initial pool size if spikes are expected

### Memory Leaks

If memory grows over time despite pooling:

```typescript
// Check for leaked payloads
const stats = CombatEventPools.getAllStats();
console.log('Currently acquired:', stats.damageDealt.currentlyAcquired);
console.log('Total acquired:', stats.damageDealt.totalAcquired);
console.log('Total released:', stats.damageDealt.totalReleased);

// If totalAcquired > totalReleased, you have a leak
if (stats.damageDealt.totalAcquired > stats.damageDealt.totalReleased) {
  console.error('Memory leak detected in damageDealt pool');
}
```

**Common Causes:**
1. Event listener not calling `release()`
2. Exception thrown before `release()` call
3. Storing pooled object in long-lived data structure

**Solutions:**
1. Use try/finally to ensure `release()` is called:
   ```typescript
   world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
     try {
       // Process damage...
     } finally {
       CombatEventPools.damageDealt.release(payload);
     }
   });
   ```

2. Use the `withPosition()` pattern for automatic cleanup:
   ```typescript
   positionPool.withPosition(x, y, z, (pos) => {
     // pos is automatically released after this callback
   });
   ```

## Migration Guide

### Converting Existing Code to Use Pools

**Before (allocates on every event):**
```typescript
// Emitter
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15
});

// Listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
});
```

**After (uses object pool):**
```typescript
// Emitter
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// Listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### Checklist

When migrating to object pools:

- [ ] Create pool with appropriate initial/growth sizes
- [ ] Register pool with `eventPayloadPoolRegistry`
- [ ] Update emitter to use `acquire()`
- [ ] Update all listeners to call `release()`
- [ ] Add leak detection in development mode
- [ ] Test with stress test to verify zero allocations
- [ ] Monitor pool statistics for unexpected growth

## Related Documentation

- **AGENTS.md**: Memory Management section with complete leak fix list
- **CLAUDE.md**: Performance Optimizations section
- **packages/shared/src/utils/pools/**: Source code and tests

## Commit History

Object pooling was introduced in commit `4b64b148` (March 2, 2026):

> perf(combat): implement object pooling for zero-allocation event emission
>
> Eliminates hot-path memory allocations in combat system by implementing
> comprehensive object pooling for event payloads.
>
> Verified: Memory stays flat during 60s stress test with agents in combat.
