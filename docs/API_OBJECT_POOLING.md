# Object Pooling API Documentation

## Overview

Hyperscape implements comprehensive object pooling to eliminate garbage collection pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

## Core Modules

### EventPayloadPool

**Location**: `packages/shared/src/utils/pools/EventPayloadPool.ts`

Factory for creating type-safe event payload pools that eliminate per-event allocations.

#### Types

```typescript
interface PooledPayload {
  /** Internal pool index - do not modify */
  _poolIndex: number;
}

interface EventPayloadPoolStats {
  name: string;
  total: number;
  available: number;
  inUse: number;
  peakUsage: number;
  acquireCount: number;
  releaseCount: number;
  leakWarnings: number;
}

interface EventPayloadPool<T extends PooledPayload> {
  acquire(): T;
  release(payload: T): void;
  withPayload<R>(fn: (payload: T) => R): R;
  getStats(): EventPayloadPoolStats;
  reset(): void;
  checkLeaks(): number;
}

interface EventPayloadPoolConfig<T extends PooledPayload> {
  factory: () => Omit<T, "_poolIndex">;
  reset: (payload: T) => void;
  name: string;
  initialSize?: number;      // default: 64
  growthSize?: number;        // default: 32
  warnOnLeaks?: boolean;      // default: true
}
```

#### Functions

##### `createEventPayloadPool<T>(config: EventPayloadPoolConfig<T>): EventPayloadPool<T>`

Creates a type-safe event payload pool.

**Parameters**:
- `config.factory` - Function to create a new payload object
- `config.reset` - Function to reset payload state before returning to pool
- `config.name` - Pool name for debugging and monitoring
- `config.initialSize` - Initial pool size (default: 64)
- `config.growthSize` - Growth size when exhausted (default: 32)
- `config.warnOnLeaks` - Enable leak detection warnings (default: true)

**Returns**: Pool instance for acquiring/releasing payloads

**Example**:
```typescript
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

#### Pool Methods

##### `acquire(): T`

Acquires a payload from the pool. Automatically grows pool if exhausted.

**Returns**: Payload object ready for use

**Example**:
```typescript
const payload = myEventPool.acquire();
payload.entityId = 'player-123';
payload.value = 42;
```

##### `release(payload: T): void`

Releases a payload back to the pool. Resets payload state before returning.

**Parameters**:
- `payload` - The payload to release

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

**Example**:
```typescript
myEventPool.release(payload);
```

##### `withPayload<R>(fn: (payload: T) => R): R`

Acquires, uses, and automatically releases a payload. Convenience method for short-lived usage.

**Parameters**:
- `fn` - Callback function that receives the payload

**Returns**: Return value of callback function

**Example**:
```typescript
const result = myEventPool.withPayload((payload) => {
  payload.entityId = 'player-123';
  return processPayload(payload);
});
```

##### `getStats(): EventPayloadPoolStats`

Returns pool statistics for monitoring and debugging.

**Returns**: Statistics object with usage metrics

**Example**:
```typescript
const stats = myEventPool.getStats();
console.log(`Pool ${stats.name}: ${stats.inUse}/${stats.total} in use, peak: ${stats.peakUsage}`);
```

##### `reset(): void`

Resets pool to initial state. Use with caution - invalidates all acquired payloads.

**Example**:
```typescript
myEventPool.reset();
```

##### `checkLeaks(): number`

Checks for unreleased payloads. Should be called at end of tick.

**Returns**: Number of payloads still in use

**Example**:
```typescript
const leakCount = myEventPool.checkLeaks();
if (leakCount > 0) {
  console.warn(`${leakCount} payloads not released!`);
}
```

#### Registry

##### `eventPayloadPoolRegistry`

Global registry of all event payload pools for monitoring.

**Methods**:
- `register<T>(pool: EventPayloadPool<T>): void` - Register a pool
- `unregister(name: string): void` - Unregister a pool
- `getAllStats(): EventPayloadPoolStats[]` - Get stats for all pools
- `checkAllLeaks(): Map<string, number>` - Check all pools for leaks
- `resetAll(): void` - Reset all pools

**Example**:
```typescript
// Register pool
eventPayloadPoolRegistry.register(myEventPool);

// Get all stats
const allStats = eventPayloadPoolRegistry.getAllStats();

// Check for leaks across all pools
const leaks = eventPayloadPoolRegistry.checkAllLeaks();
```

---

### CombatEventPools

**Location**: `packages/shared/src/utils/pools/CombatEventPools.ts`

Pre-configured pools for high-frequency combat events.

#### Available Pools

```typescript
const CombatEventPools = {
  damageDealt: EventPayloadPool<PooledCombatDamageDealtPayload>,
  projectileLaunched: EventPayloadPool<PooledCombatProjectileLaunchedPayload>,
  faceTarget: EventPayloadPool<PooledCombatFaceTargetPayload>,
  clearFaceTarget: EventPayloadPool<PooledCombatClearFaceTargetPayload>,
  attackFailed: EventPayloadPool<PooledCombatAttackFailedPayload>,
  followTarget: EventPayloadPool<PooledCombatFollowTargetPayload>,
  combatStarted: EventPayloadPool<PooledCombatStartedPayload>,
  combatEnded: EventPayloadPool<PooledCombatEndedPayload>,
  projectileHit: EventPayloadPool<PooledCombatProjectileHitPayload>,
  combatKill: EventPayloadPool<PooledCombatKillPayload>,
};
```

#### Payload Types

##### `PooledCombatDamageDealtPayload`

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

##### `PooledCombatProjectileLaunchedPayload`

```typescript
interface PooledCombatProjectileLaunchedPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
  projectileType: string;
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  spellId: string;
  arrowId: string;
  delayMs: number;
  flightTimeMs: number;
}
```

##### `PooledCombatFaceTargetPayload`

```typescript
interface PooledCombatFaceTargetPayload extends PooledPayload {
  playerId: string;
  targetId: string;
}
```

##### `PooledCombatClearFaceTargetPayload`

```typescript
interface PooledCombatClearFaceTargetPayload extends PooledPayload {
  playerId: string;
}
```

##### `PooledCombatAttackFailedPayload`

```typescript
interface PooledCombatAttackFailedPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
  reason: string;
}
```

##### `PooledCombatFollowTargetPayload`

```typescript
interface PooledCombatFollowTargetPayload extends PooledPayload {
  playerId: string;
  targetId: string;
  targetX: number;
  targetY: number;
  targetZ: number;
  attackRange: number;
  attackType: string;
}
```

##### `PooledCombatStartedPayload`

```typescript
interface PooledCombatStartedPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
}
```

##### `PooledCombatEndedPayload`

```typescript
interface PooledCombatEndedPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
}
```

##### `PooledCombatProjectileHitPayload`

```typescript
interface PooledCombatProjectileHitPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  projectileType: string;
}
```

##### `PooledCombatKillPayload`

```typescript
interface PooledCombatKillPayload extends PooledPayload {
  attackerId: string;
  targetId: string;
  damageDealt: number;
  attackStyle: string;
}
```

#### Utility Methods

##### `getAllStats()`

Returns statistics for all combat pools.

**Returns**: Object with stats for each pool

**Example**:
```typescript
const stats = CombatEventPools.getAllStats();
console.log('Damage dealt pool:', stats.damageDealt);
```

##### `checkAllLeaks(): number`

Checks all combat pools for unreleased payloads.

**Returns**: Total number of leaked payloads across all pools

**Example**:
```typescript
const totalLeaks = CombatEventPools.checkAllLeaks();
```

##### `resetAll(): void`

Resets all combat pools to initial state.

**Example**:
```typescript
CombatEventPools.resetAll();
```

#### Usage Example

```typescript
// In event emitter (CombatSystem, etc.)
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.attackType = 'melee';
payload.targetType = 'mob';
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In event listener - MUST call release()
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  updateHealthBar(payload.targetId, payload.damage);
  
  // CRITICAL: Release payload back to pool
  CombatEventPools.damageDealt.release(payload);
});
```

---

### PositionPool

**Location**: `packages/shared/src/utils/pools/PositionPool.ts`

Object pool for `{x, y, z}` position objects. Eliminates allocations in hot paths like position updates, movement, and combat.

#### Types

```typescript
interface PooledPosition {
  x: number;
  y: number;
  z: number;
  /** Internal pool index - do not modify */
  _poolIndex: number;
}
```

#### Global Instance

```typescript
export const positionPool: PositionPoolImpl;
```

#### Methods

##### `acquire(x = 0, y = 0, z = 0): PooledPosition`

Acquires a position from the pool, initialized to the given values.

**Parameters**:
- `x` - X coordinate (default: 0)
- `y` - Y coordinate (default: 0)
- `z` - Z coordinate (default: 0)

**Returns**: Position object ready for use

**IMPORTANT**: Must call `release()` when done to return to pool.

**Example**:
```typescript
const pos = positionPool.acquire(10, 0, 20);
// ... use pos ...
positionPool.release(pos);
```

##### `release(pos: PooledPosition): void`

Releases a position back to the pool. Resets position to origin before returning.

**Parameters**:
- `pos` - The position to release

**Example**:
```typescript
positionPool.release(pos);
```

##### `withPosition<T>(x: number, y: number, z: number, fn: (pos: PooledPosition) => T): T`

Acquires, uses, and automatically releases a position.

**Parameters**:
- `x` - X coordinate
- `y` - Y coordinate
- `z` - Z coordinate
- `fn` - Callback function that receives the position

**Returns**: Return value of callback function

**Example**:
```typescript
const distance = positionPool.withPosition(10, 0, 20, (pos) => {
  return calculateDistance(playerPos, pos);
});
```

##### `set(pos: PooledPosition, x: number, y: number, z: number): void`

Sets position values in-place.

**Parameters**:
- `pos` - Position to modify
- `x` - New X coordinate
- `y` - New Y coordinate
- `z` - New Z coordinate

**Example**:
```typescript
positionPool.set(pos, 15, 5, 25);
```

##### `copy(target: PooledPosition, source: { x: number; y: number; z: number }): void`

Copies values from another position-like object.

**Parameters**:
- `target` - Position to modify
- `source` - Source position to copy from

**Example**:
```typescript
positionPool.copy(pos, entity.position);
```

##### `distanceSquared(a: PooledPosition, b: { x: number; y: number; z: number }): number`

Calculates distance squared between two positions (avoids sqrt for performance).

**Parameters**:
- `a` - First position
- `b` - Second position

**Returns**: Distance squared

**Example**:
```typescript
const distSq = positionPool.distanceSquared(pos1, pos2);
if (distSq < 100) { // Within 10 units
  // ...
}
```

##### `getStats()`

Returns pool statistics for monitoring.

**Returns**: Statistics object

**Example**:
```typescript
const stats = positionPool.getStats();
console.log(`Position pool: ${stats.inUse}/${stats.total} in use`);
```

##### `reset(): void`

Resets pool to initial state. Use with caution - invalidates all acquired positions.

**Example**:
```typescript
positionPool.reset();
```

---

## Performance Characteristics

### EventPayloadPool
- **Acquire**: O(1) - Pop from available array
- **Release**: O(1) - Push to available array
- **Memory**: Fixed after warmup (unless pool exhausted)
- **Growth**: Automatic when exhausted, warns once per minute

### PositionPool
- **Acquire**: O(1) - Pop from available array
- **Release**: O(1) - Push to available array
- **Memory**: Fixed after warmup (unless pool exhausted)
- **Initial Size**: 128 positions
- **Growth Size**: 64 positions

### CombatEventPools
- **Pool Sizes**: 16-64 objects (varies by event frequency)
- **Growth Sizes**: 8-32 objects
- **Memory Impact**: Eliminates per-tick allocations in combat hot paths
- **Verified**: Memory stays flat during 60s stress test with agents in combat

---

## Best Practices

### 1. Always Release Payloads

**CRITICAL**: Event listeners MUST call `release()` after processing.

```typescript
// ❌ BAD - Payload never released
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  // Missing release() - causes memory leak!
});

// ✅ GOOD - Payload properly released
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload);
});
```

### 2. Use withPayload for Short-Lived Usage

```typescript
// ✅ GOOD - Automatic release
const result = myEventPool.withPayload((payload) => {
  payload.entityId = 'player-123';
  return processPayload(payload);
});
```

### 3. Monitor Pool Statistics

```typescript
// Check pool health periodically
setInterval(() => {
  const stats = CombatEventPools.getAllStats();
  for (const [name, poolStats] of Object.entries(stats)) {
    if (poolStats.inUse > poolStats.total * 0.8) {
      console.warn(`Pool ${name} is ${(poolStats.inUse / poolStats.total * 100).toFixed(1)}% full`);
    }
  }
}, 60000);
```

### 4. Check for Leaks at End of Tick

```typescript
// In game tick processor
onTickEnd() {
  const leakCount = CombatEventPools.checkAllLeaks();
  if (leakCount > 0) {
    console.error(`${leakCount} combat event payloads not released!`);
  }
}
```

### 5. Register Custom Pools

```typescript
// Always register custom pools for monitoring
const myPool = createEventPayloadPool({ ... });
eventPayloadPoolRegistry.register(myPool);
```

---

## Migration Guide

### Before (Without Pooling)

```typescript
// Event emitter
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

// Event listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
});
```

### After (With Pooling)

```typescript
// Event emitter
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.attackType = 'melee';
payload.targetType = 'mob';
payload.hasPosition = false;
payload.isCritical = false;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// Event listener - MUST release!
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload);
});
```

---

## Troubleshooting

### Pool Exhaustion Warnings

**Symptom**: Console warnings about pool exhaustion

**Cause**: High event frequency or payloads not being released

**Solution**:
1. Check that all event listeners call `release()`
2. Increase initial pool size if legitimate high frequency
3. Use `checkLeaks()` to identify unreleased payloads

### Memory Leaks

**Symptom**: Memory usage grows over time

**Cause**: Payloads not being released back to pool

**Solution**:
1. Call `CombatEventPools.checkAllLeaks()` at end of tick
2. Review event listeners for missing `release()` calls
3. Use Chrome DevTools Memory Profiler to identify leaking objects

### Performance Degradation

**Symptom**: Frame drops or tick slowdowns

**Cause**: Pool growth causing allocations

**Solution**:
1. Check pool statistics with `getStats()`
2. Increase initial pool size to avoid growth
3. Verify payloads are being released promptly

---

## See Also

- [AGENTS.md](../AGENTS.md) - Complete memory management documentation
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [Memory Management Best Practices](../AGENTS.md#memory-management-best-practices)
