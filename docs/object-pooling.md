# Object Pooling System

Hyperscape implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Overview

Object pooling is a performance optimization technique that reuses objects instead of creating new ones. This is especially important in high-frequency code paths like:

- Combat events (every 600ms tick per combatant)
- Movement updates (every frame)
- Network synchronization (every tick)
- Position calculations (every frame)

## Architecture

The pooling system is located in `packages/shared/src/utils/pools/` and consists of three main components:

### Core Infrastructure

1. **EventPayloadPool.ts** - Factory for creating type-safe event payload pools
2. **PositionPool.ts** - Pool for `{x, y, z}` position objects
3. **CombatEventPools.ts** - Pre-configured pools for all combat events

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

### Available Pools

The `CombatEventPools` object provides pre-configured pools for all combat events:

- `damageDealt` - COMBAT_DAMAGE_DEALT events
- `projectileLaunched` - COMBAT_PROJECTILE_LAUNCHED events
- `faceTarget` - COMBAT_FACE_TARGET events
- `clearFaceTarget` - COMBAT_CLEAR_FACE_TARGET events
- `attackFailed` - COMBAT_ATTACK_FAILED events
- `followTarget` - COMBAT_FOLLOW_TARGET events
- `combatStarted` - COMBAT_STARTED events
- `combatEnded` - COMBAT_ENDED events
- `projectileHit` - COMBAT_PROJECTILE_HIT events
- `combatKill` - COMBAT_KILL events

### Pool Configuration

Each pool is configured with:

- **Initial size**: 16-64 objects (varies by event frequency)
- **Growth size**: 8-32 objects (automatic when exhausted)
- **Leak detection**: Warns when payloads not released at end of tick
- **Statistics**: Track acquire/release counts, peak usage, leak warnings

### Monitoring

```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();

// Reset all pools (use with caution)
CombatEventPools.resetAll();
```

## Position Pool

The position pool provides reusable `{x, y, z}` position objects for hot paths.

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

- **O(1) acquire/release operations**
- **Zero allocations after warmup**
- **Automatic pool growth when exhausted**
- **Helper methods**: `set()`, `copy()`, `distanceSquared()`
- **Statistics tracking**: `getStats()`

### Helper Methods

```typescript
// Set position values in-place
positionPool.set(pos, 10, 0, 20);

// Copy values from another position-like object
positionPool.copy(target, source);

// Calculate distance squared between two positions (avoids sqrt)
const distSq = positionPool.distanceSquared(pos1, pos2);
```

## Creating New Pools

When adding new high-frequency events, create a pool:

```typescript
import { createEventPayloadPool, eventPayloadPoolRegistry } from './EventPayloadPool';

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

### Configuration Options

- **name**: Pool name for debugging and monitoring
- **factory**: Function to create a new payload object
- **reset**: Function to reset payload state before returning to pool
- **initialSize**: Initial pool size (default: 64)
- **growthSize**: Growth size when exhausted (default: 32)
- **warnOnLeaks**: Enable leak detection warnings (default: true)

## Performance Impact

The object pooling system provides significant performance benefits:

- **Eliminates per-tick object allocations** in combat hot paths
- **Memory stays flat** during 60s stress test with agents in combat
- **Verified zero-allocation event emission** in CombatSystem and CombatTickProcessor
- **Reduces GC pressure** by reusing objects instead of creating new ones

### Benchmarks

From `CombatSystemPerformance.test.ts`:

- **Memory Hygiene**: Heap does not grow significantly during combat processing
- **Concurrent Combat Scalability**: Scales linearly with combat count
- **Zero Allocations**: No object allocations in hot paths after warmup

## Best Practices

### When to Use Pooling

Use object pooling for:

1. **High-frequency events** (fired every tick or frame)
2. **Hot paths** (executed many times per second)
3. **Temporary objects** (created and discarded quickly)
4. **Fixed-size data structures** (known shape and size)

### When NOT to Use Pooling

Avoid pooling for:

1. **Long-lived objects** (persist across many ticks)
2. **Infrequent events** (fired rarely)
3. **Variable-size data** (dynamic arrays, complex nested structures)
4. **Objects with complex lifecycle** (require cleanup beyond simple reset)

### Memory Management Rules

1. **Always release after use**: Failure to release causes pool exhaustion
2. **Don't hold references**: Release as soon as processing is complete
3. **Use withPayload() for short operations**: Automatic release on completion
4. **Monitor pool statistics**: Check for leaks and adjust pool sizes
5. **Reset state completely**: Ensure factory and reset functions clear all fields

## Troubleshooting

### Pool Exhaustion Warnings

If you see warnings like:

```
[EventPayloadPool:CombatDamageDealt] Pool exhausted (64/64 in use), growing by 32
```

This indicates:

1. **High load**: More concurrent events than expected
2. **Leak**: Payloads not being released properly
3. **Undersized pool**: Initial size too small for typical load

**Solutions**:

- Check for missing `release()` calls in event listeners
- Increase `initialSize` if load is consistently high
- Use `checkLeaks()` to detect unreleased payloads

### Memory Leaks

If you see warnings like:

```
[EventPayloadPool:CombatDamageDealt] Potential leak: 15 payloads still in use at end of tick
```

This indicates payloads are not being released. Common causes:

1. **Missing release() call**: Event listener forgot to call `release()`
2. **Exception before release**: Error thrown before `release()` is called
3. **Async operations**: Payload held across async boundaries

**Solutions**:

- Use `try/finally` to ensure release even on error
- Use `withPayload()` for automatic release
- Avoid holding payloads across async operations

### Performance Degradation

If pooling is not improving performance:

1. **Pool too small**: Frequent growth causes allocations
2. **Pool too large**: Wasted memory for unused objects
3. **Incorrect usage**: Not using pools in hot paths
4. **Leak**: Payloads not being released, causing growth

**Solutions**:

- Monitor pool statistics with `getStats()`
- Adjust `initialSize` and `growthSize` based on peak usage
- Profile code to ensure pools are used in hot paths
- Check for leaks with `checkLeaks()`

## Implementation Details

### Pool Structure

Each pool maintains:

- **pool**: Array of all objects (grows as needed)
- **available**: Stack of available object indices
- **stats**: Acquire/release counts, peak usage, leak warnings

### Acquire/Release Flow

1. **Acquire**: Pop index from available stack, return object at that index
2. **Use**: Caller modifies object fields
3. **Release**: Reset object state, push index back to available stack

### Growth Strategy

When pool is exhausted:

1. Warn (throttled to once per minute)
2. Grow pool by `growthSize` objects
3. Add new indices to available stack
4. Continue operation

### Leak Detection

At end of tick:

1. Check if any objects are still in use (`pool.length - available.length > 0`)
2. Warn if leaks detected (up to 10 warnings, then suppress)
3. Track leak count in statistics

## Migration Guide

### Converting Existing Code

**Before (allocating on every event):**

```typescript
// Emitter
this.world.emit(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15,
});

// Listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
});
```

**After (using object pool):**

```typescript
// Emitter
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// Listener - MUST call release()
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### Type Safety

All pools are fully type-safe:

```typescript
interface PooledCombatDamageDealtPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  attackType: string;
  targetType: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  hasPosition: boolean;
  isCritical: boolean;
}
```

The `PooledPayload` interface adds a hidden `_poolIndex` field for tracking.

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Memory management best practices
- [CLAUDE.md](../CLAUDE.md) - Performance optimizations overview
- [packages/shared/src/utils/pools/](../packages/shared/src/utils/pools/) - Source code
- [CombatSystemPerformance.test.ts](../packages/shared/src/systems/shared/combat/__tests__/CombatSystemPerformance.test.ts) - Performance benchmarks
