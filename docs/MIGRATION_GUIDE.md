# Migration Guide

This document outlines breaking changes and migration steps for recent Hyperscape updates.

## Table of Contents

- [Bun v1.3.10 Update](#bun-v1310-update)
- [Safari 18+ Requirement](#safari-18-requirement)
- [Object Pooling System](#object-pooling-system)
- [Movement System Changes](#movement-system-changes)
- [TileMovementState Interface Changes](#tilemovementstate-interface-changes)
- [Combat Event Payload Changes](#combat-event-payload-changes)
- [PostgreSQL Connection Pool Configuration](#postgresql-connection-pool-configuration)

---

## Bun v1.3.10 Update

**Date**: March 2026  
**Severity**: Medium  
**Impact**: Development environment

### What Changed

Minimum Bun version requirement updated from v1.1.38 to v1.3.10.

### Migration Steps

1. **Update Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   # Or on macOS with Homebrew:
   brew upgrade bun
   ```

2. **Verify version**:
   ```bash
   bun --version
   # Should show 1.3.10 or higher
   ```

3. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules packages/*/node_modules
   bun install
   ```

4. **Rebuild project**:
   ```bash
   bun run build
   ```

### Why This Change

- Improved performance and stability
- Better TypeScript support
- Bug fixes in package resolution

---

## Safari 18+ Requirement

**Date**: March 2026  
**Severity**: High  
**Impact**: Browser compatibility

### What Changed

Safari 17 support was removed. Safari 18+ (macOS 15+) is now required for WebGPU support.

### Migration Steps

**For Users**:
1. Update macOS to version 15 or later
2. Update Safari to version 18 or later
3. Alternatively, use Chrome 113+ or Edge 113+

**For Developers**:
1. Update browser compatibility documentation
2. Update user-facing error messages for unsupported browsers
3. Test on Safari 18+ instead of Safari 17

### Why This Change

- Safari 17 had incomplete WebGPU implementation
- Safari 18 provides full WebGPU support with Metal backend
- Aligns with Three.js TSL shader requirements

---

## Object Pooling System

**Date**: March 2026  
**Severity**: High  
**Impact**: Event handling, memory management

### What Changed

Introduced comprehensive object pooling for event payloads to eliminate GC pressure. Event listeners must now release pooled payloads after processing.

### Migration Steps

#### 1. Update Event Emitters

**Before**:
```typescript
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, {
  attackerId: attacker.id,
  targetId: target.id,
  damage: 15,
  attackType: 'melee',
  targetType: 'mob',
});
```

**After**:
```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
payload.attackType = 'melee';
payload.targetType = 'mob';
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);
```

#### 2. Update Event Listeners

**Before**:
```typescript
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
});
```

**After**:
```typescript
import { CombatEventPools } from '@hyperscape/shared/utils/pools';

world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  
  // CRITICAL: Release payload back to pool
  CombatEventPools.damageDealt.release(payload);
});
```

#### 3. Available Pools

All combat events now have pre-configured pools:

- `CombatEventPools.damageDealt`
- `CombatEventPools.projectileLaunched`
- `CombatEventPools.faceTarget`
- `CombatEventPools.clearFaceTarget`
- `CombatEventPools.attackFailed`
- `CombatEventPools.followTarget`
- `CombatEventPools.combatStarted`
- `CombatEventPools.combatEnded`
- `CombatEventPools.projectileHit`
- `CombatEventPools.combatKill`

#### 4. Position Pool Usage

**Before**:
```typescript
const pos = { x: 10, y: 0, z: 20 };
const distance = calculateDistance(playerPos, pos);
```

**After**:
```typescript
import { positionPool } from '@hyperscape/shared/utils/pools';

const distance = positionPool.withPosition(10, 0, 20, (pos) => {
  return calculateDistance(playerPos, pos);
});
```

### Why This Change

- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem

### Common Pitfalls

**❌ Forgetting to release**:
```typescript
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  // Missing release() - causes memory leak!
});
```

**✅ Always release**:
```typescript
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  updateHealthBar(payload.targetId, payload.damage);
  CombatEventPools.damageDealt.release(payload);
});
```

---

## Movement System Changes

**Date**: March 2026  
**Severity**: Medium  
**Impact**: Movement handling, pathfinding

### What Changed

1. Move requests now bypass ActionQueue for immediate processing (0-latency response)
2. Pathfinding rate limit raised from 5/sec to 15/sec
3. BFS iterations increased from 2000 to 8000 (~44 tile radius)
4. Added path continuation for seamless long-distance movement

### Migration Steps

#### 1. Remove ActionQueue Buffering

**Before**:
```typescript
// Move requests went through ActionQueue
this.actionQueue.enqueue(playerId, {
  type: 'move',
  destination: { x, y, z },
});
```

**After**:
```typescript
// Move requests processed immediately
this.handleMoveRequest(playerId, { x, y, z });
```

#### 2. Update Rate Limiting

**Before**:
```typescript
const moveRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 5,
  windowMs: 1000,
});
```

**After**:
```typescript
const moveRateLimit = new SlidingWindowRateLimiter({
  maxRequests: 15,
  windowMs: 1000,
});
```

#### 3. Handle Path Continuation

Path continuation is now automatic. No code changes required, but be aware:

- Long-distance clicks (>44 tiles) now work seamlessly
- Movement continues across multiple BFS segments
- `tileMovementEnd` is suppressed while segments continue

### Why This Change

- Eliminates 0-600ms latency between click and movement start
- Aligns with 30 Hz client input rate
- Provides "snappier modern feel" for movement
- Enables long-distance movement without premature stopping

---

## TileMovementState Interface Changes

**Date**: March 2026  
**Severity**: Medium  
**Impact**: Movement system, tile-based movement

### What Changed

Added three new required fields to `TileMovementState`:

```typescript
interface TileMovementState {
  // ... existing fields ...
  
  // NEW: Required fields for path continuation
  requestedDestination: { x: number; y: number; z: number } | null;
  lastPathPartial: boolean;
  nextSegmentPrecomputed: boolean;
}
```

### Migration Steps

#### 1. Update State Initialization

**Before**:
```typescript
function createTileMovementState(): TileMovementState {
  return {
    isMoving: false,
    path: [],
    currentTileIndex: 0,
    // ... other fields ...
  };
}
```

**After**:
```typescript
function createTileMovementState(): TileMovementState {
  return {
    isMoving: false,
    path: [],
    currentTileIndex: 0,
    // ... other fields ...
    
    // NEW: Required fields
    requestedDestination: null,
    lastPathPartial: false,
    nextSegmentPrecomputed: false,
  };
}
```

#### 2. Clear on Teleport/Respawn

```typescript
function syncPlayerPosition(playerId: string, position: Position3D) {
  const state = getTileMovementState(playerId);
  
  // Clear path continuation state on teleport/respawn
  state.requestedDestination = null;
  state.lastPathPartial = false;
  state.nextSegmentPrecomputed = false;
  
  // ... rest of sync logic ...
}
```

### Why This Change

- Enables seamless long-distance movement
- Supports server-side path pre-computation
- Eliminates skating at segment boundaries

---

## Combat Event Payload Changes

**Date**: March 2026  
**Severity**: Low  
**Impact**: Combat projectile events

### What Changed

`COMBAT_PROJECTILE_LAUNCHED` event payload property renamed:

- `travelDurationMs` → `flightTimeMs`

### Migration Steps

**Before**:
```typescript
world.on(EventType.COMBAT_PROJECTILE_LAUNCHED, (payload) => {
  scheduleProjectileHit(payload.travelDurationMs);
});
```

**After**:
```typescript
world.on(EventType.COMBAT_PROJECTILE_LAUNCHED, (payload) => {
  scheduleProjectileHit(payload.flightTimeMs);
});
```

### Why This Change

- Consistent naming with other time-based properties
- Clearer semantic meaning

---

## PostgreSQL Connection Pool Configuration

**Date**: March 2026  
**Severity**: Medium  
**Impact**: Database connections, crash recovery

### What Changed

Default PostgreSQL connection pool settings optimized for crash loop scenarios:

- `POSTGRES_POOL_MAX`: 6 → 3
- `POSTGRES_POOL_MIN`: 1 → 0
- PM2 `restart_delay`: 5s → 10s
- PM2 `exp_backoff_restart_delay`: 1s → 2s

### Migration Steps

#### 1. Update Environment Variables

**Before** (`.env`):
```bash
# Defaults were:
# POSTGRES_POOL_MAX=6
# POSTGRES_POOL_MIN=1
```

**After** (`.env`):
```bash
# New defaults (can be overridden):
POSTGRES_POOL_MAX=3
POSTGRES_POOL_MIN=0
```

#### 2. Update PM2 Configuration

**Before** (`ecosystem.config.cjs`):
```javascript
{
  restart_delay: 5000,
  exp_backoff_restart_delay: 1000,
}
```

**After** (`ecosystem.config.cjs`):
```javascript
{
  restart_delay: 10000,
  exp_backoff_restart_delay: 2000,
}
```

### Why This Change

- Prevents PostgreSQL error 53300 (too many connections) during crash loops
- Allows connections to fully close before PM2 restart
- More gradual backoff on repeated failures
- Reduces connection exhaustion risk

### When to Override

Increase pool size if you have:
- High concurrent user load (>100 simultaneous players)
- Multiple server instances sharing same database
- Complex queries requiring long-held connections

```bash
# For high-load scenarios:
POSTGRES_POOL_MAX=10
POSTGRES_POOL_MIN=2
```

---

## New Environment Variables

**Date**: March 2026  
**Severity**: Low  
**Impact**: Configuration, feature flags

### New Variables

#### `SPAWN_MODEL_AGENTS`

**Purpose**: Enable automatic agent creation when database is empty

**Default**: `false`

**Usage**:
```bash
SPAWN_MODEL_AGENTS=true
```

**When to use**: Fresh deployments, testing, duel streaming

#### `STREAM_CAPTURE_EXECUTABLE`

**Purpose**: Explicit Chrome path for WebGPU streaming

**Default**: Auto-detected

**Usage**:
```bash
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

**When to use**: Vast.ai deployments, custom Chrome installations

#### `STREAM_LOW_LATENCY`

**Purpose**: Use zerolatency tune for faster playback start

**Default**: `false` (uses `film` tune)

**Usage**:
```bash
STREAM_LOW_LATENCY=true
```

**When to use**: Live streaming, real-time betting

#### `STREAM_GOP_SIZE`

**Purpose**: GOP size in frames

**Default**: `60`

**Usage**:
```bash
STREAM_GOP_SIZE=120
```

**When to use**: Adjust for bitrate/latency tradeoff

---

## Troubleshooting

### Memory Leaks After Update

**Symptom**: Memory usage grows over time

**Cause**: Event listeners not releasing pooled payloads

**Solution**:
```typescript
// Check for leaks at end of tick
const leakCount = CombatEventPools.checkAllLeaks();
if (leakCount > 0) {
  console.error(`${leakCount} payloads not released!`);
}
```

### Movement Feels Different

**Symptom**: Movement behavior changed

**Cause**: Immediate move processing, path continuation

**Solution**: This is expected. New behavior provides:
- 0-latency response to clicks
- Seamless long-distance movement
- No skating at segment boundaries

### Database Connection Errors

**Symptom**: PostgreSQL error 53300 (too many connections)

**Cause**: Old connection pool settings

**Solution**:
```bash
# In .env
POSTGRES_POOL_MAX=3
POSTGRES_POOL_MIN=0
```

### Safari Not Working

**Symptom**: WebGPU not available in Safari

**Cause**: Safari 17 no longer supported

**Solution**: Update to Safari 18+ (macOS 15+) or use Chrome 113+

---

## Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting](../README.md#troubleshooting) section in README.md
2. Review [AGENTS.md](../AGENTS.md) for memory management patterns
3. See [CLAUDE.md](../CLAUDE.md) for development guidelines
4. Check [API_OBJECT_POOLING.md](./API_OBJECT_POOLING.md) for pooling API details
5. Open an issue on GitHub with:
   - Error messages
   - Steps to reproduce
   - Environment details (OS, Bun version, browser)

---

## See Also

- [README.md](../README.md) - Project documentation
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [AGENTS.md](../AGENTS.md) - AI coding assistant guidelines
- [API_OBJECT_POOLING.md](./API_OBJECT_POOLING.md) - Object pooling API reference
