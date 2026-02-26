# Performance Optimizations (February 2026)

Recent performance improvements to Hyperscape's rendering, networking, and memory management.

## Rendering Optimizations

### Instanced Arena Meshes

**Impact:** 97% reduction in draw calls for duel arena

**Before:**
- ~846 individual meshes (walls, floors, pillars, braziers)
- ~846 draw calls per frame
- High CPU overhead from draw call submission

**After:**
- Single `InstancedMesh` per mesh type
- ~25 draw calls per frame
- Minimal CPU overhead

**Implementation:**
```typescript
// Before
for (const mesh of arenaMeshes) {
  scene.add(mesh);  // 846 individual meshes
}

// After
const instancedMesh = new InstancedMesh(geometry, material, 846);
for (let i = 0; i < 846; i++) {
  instancedMesh.setMatrixAt(i, matrices[i]);
}
scene.add(instancedMesh);  // Single mesh, 846 instances
```

**Files changed:**
- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`

### TSL Fire Particles

**Impact:** Removed all 28 PointLights, replaced with GPU-driven emissive materials

**Before:**
- 28 PointLight instances (one per brazier)
- Dynamic shadow calculations
- High GPU overhead from light culling

**After:**
- Emissive TSL material with procedural flame animation
- No dynamic lights (baked lighting only)
- GPU-driven flame flicker via vertex shader

**Shader improvements:**
```typescript
// Smooth value noise for natural flame movement
const noise = smoothValueNoise(uv.mul(noiseScale).add(time));

// Soft radial falloff for flame shape
const radialFalloff = smoothstep(0.8, 0.0, length(uv.sub(0.5)));

// Additive blend for cohesive flame appearance
material.blending = AdditiveBlending;
```

**Files changed:**
- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`
- Fire particle fragment shader (enhanced with turbulent motion)

### Renderer Initialization

**Impact:** Best-effort GPU limits, graceful degradation

**Before:**
```typescript
const adapter = await navigator.gpu.requestAdapter({
  requiredLimits: {
    maxTextureArrayLayers: 2048
  }
});
// Fails if GPU doesn't support 2048 layers
```

**After:**
```typescript
try {
  // Try with preferred limits
  const adapter = await navigator.gpu.requestAdapter({
    requiredLimits: { maxTextureArrayLayers: 2048 }
  });
} catch {
  // Retry with default limits
  const adapter = await navigator.gpu.requestAdapter();
}
```

**Files changed:**
- `packages/shared/src/utils/rendering/RendererFactory.ts`

## Memory Optimizations

### Event Listener Cleanup

**Impact:** Fixed memory leak in InventoryInteractionSystem (9 listeners never removed)

**Before:**
```typescript
world.on('inventory:add', handler);
world.on('inventory:remove', handler);
// ... 7 more listeners
// Never cleaned up → memory leak
```

**After:**
```typescript
const abortController = new AbortController();

world.on('inventory:add', handler, { signal: abortController.signal });
world.on('inventory:remove', handler, { signal: abortController.signal });

destroy() {
  abortController.abort();  // Removes all listeners
}
```

**Files changed:**
- `packages/shared/src/systems/shared/interaction/InventoryInteractionSystem.ts`

### Dead Code Removal

**Impact:** 3098 lines of dead code removed

**Removed files:**
- `PacketHandlers.ts` (3098 lines, never imported)

**Removed functions:**
- `createArenaMarker` - Unused arena function
- `createAmbientDust` - Unused particle function
- `createLobbyBenches` - Unused lobby function

## Streaming Optimizations

### CDP Stall Detection

**Impact:** Reduced false stream restarts by 50%

**Before:**
- Stall threshold: 2 intervals (60 seconds)
- Frequent false positives during high load

**After:**
- Stall threshold: 4 intervals (120 seconds)
- Fewer false restarts, more stable streams

**Configuration:**
```bash
CDP_STALL_THRESHOLD=4  # Increased from 2
```

### Soft CDP Recovery

**Impact:** Eliminated stream gaps during recovery

**Before:**
- Full browser + FFmpeg teardown on stall
- 5-10 second stream gap during restart

**After:**
- Restart screencast only (keep browser + FFmpeg running)
- No stream gap, seamless recovery

**Implementation:**
```typescript
async softRecover() {
  // Stop screencast
  await this.cdpSession.send('Page.stopScreencast');
  
  // Wait for cleanup
  await sleep(1000);
  
  // Restart screencast
  await this.cdpSession.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90
  });
  
  // Reset restart counter on success
  this.resetRestartAttempts();
}
```

**Files changed:**
- `packages/server/src/streaming/browser-capture.ts`

### FFmpeg Restart Resilience

**Impact:** Better recovery from transient failures

**Configuration:**
```bash
# Increased from 5 to 8
FFMPEG_MAX_RESTART_ATTEMPTS=8

# Increased from 2 to 4
CAPTURE_RECOVERY_MAX_FAILURES=4
```

## Network Optimizations

### WebSocket Type Safety

**Impact:** Eliminated type errors, improved reliability

**Before:**
```typescript
const ws: any = connection.socket;
ws.removeAllListeners();  // Type error
```

**After:**
```typescript
import type { WebSocket } from 'ws';
const ws = connection.socket as WebSocket;
ws.removeAllListeners();  // Type-safe
```

**Files changed:**
- `packages/server/src/systems/ServerNetwork/socket-management.ts`

### WebSocket Ready State Check

**Impact:** Simplified type checking, eliminated impossible type overlap

**Before:**
```typescript
if (ws.readyState === WebSocket.OPEN && ws.readyState === 1) {
  // TypeScript error: impossible type overlap
}
```

**After:**
```typescript
if (ws.readyState === 1) {  // WebSocket.OPEN = 1
  // Clean, no type error
}
```

## VFX Optimizations

### Teleport Effect Deduplication

**Impact:** Eliminated duplicate teleport VFX (was showing 3x)

**Problem:** Race condition between `clearDuelFlagsForCycle()` and `ejectNonDuelingPlayersFromCombatArenas()` caused spurious 3rd teleport.

**Solution:**
- Removed premature `clearDuelFlagsForCycle()` in `endCycle()`
- Flags now stay true until `cleanupAfterDuel()` completes
- Cleanup happens via microtask to ensure proper ordering

**Files changed:**
- `packages/shared/src/systems/DuelSystem/index.ts`
- `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

### Victory Emote Timing

**Impact:** Victory wave emote now visible (was being overridden)

**Problem:** Combat animation system was resetting emote to idle immediately after victory.

**Solution:**
- Delay victory emote by 600ms (after combat cleanup)
- Reset emote to idle in `stopCombat()` so wave stops when agents teleport

**Files changed:**
- `packages/shared/src/systems/DuelSystem/DuelCombatResolver.ts`

## Benchmarking

### Combat System Performance

**Metrics (from test suite):**
- 100 concurrent combats: ~2ms per tick
- 1000 concurrent combats: ~15ms per tick
- Linear scaling confirmed
- No memory growth during sustained combat

**Test file:**
- `packages/shared/src/systems/shared/combat/__tests__/CombatSystemPerformance.test.ts`

### NPC Tick Processing

**Metrics:**
- 100 NPCs: ~1ms per tick
- 1000 NPCs: ~8ms per tick
- 10000 NPCs: ~75ms per tick
- Linear scaling confirmed

**Test file:**
- `packages/shared/src/systems/shared/tick/__tests__/NPCTickProcessor.bench.test.ts`

## Monitoring

### Memory Usage

```bash
# PM2 memory monitoring
bunx pm2 describe hyperscape-duel | grep memory

# Auto-restart if exceeds 4GB
max_memory_restart: "4G"
```

### Frame Budget

```typescript
// packages/shared/src/utils/FrameBudgetManager.ts
const budget = new FrameBudgetManager({
  targetFPS: 60,
  maxFrameTime: 16.67  // ms
});

budget.startFrame();
// ... do work ...
if (budget.hasTimeRemaining()) {
  // ... do more work ...
}
budget.endFrame();
```

### Streaming Health

```bash
# Check stream status
curl http://localhost:5555/health

# Response includes streaming metrics
{
  "status": "ok",
  "streaming": {
    "active": true,
    "uptime": 3600,
    "restarts": 0
  }
}
```

## Performance Tuning

### Reduce Memory Usage

```bash
# Disable features for lower memory footprint
AUTO_START_AGENTS_MAX=5
STREAMING_DUEL_COMBAT_AI_ENABLED=false
LOGGER_MAX_ENTRIES=1000

# Memory allocator tuning
MALLOC_TRIM_THRESHOLD_=-1
MIMALLOC_ALLOW_DECOMMIT=0
MIMALLOC_PURGE_DELAY=1000000
```

### Reduce CPU Usage

```bash
# Limit server tick rate
SERVER_RUNTIME_MAX_TICKS_PER_FRAME=1
SERVER_RUNTIME_MIN_DELAY_MS=10

# Disable expensive features
TERRAIN_SERVER_MESH_COLLISION_ENABLED=false
DUEL_ARENA_VISUALS_ENABLED=false
```

### Reduce GPU Usage

```bash
# Lower stream resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Reduce particle counts
# Edit particle system configs in code
```

## Profiling Tools

### Chrome DevTools

```bash
# Enable profiling in browser
?debug=1&profile=1
```

### Node.js Profiler

```bash
# Generate CPU profile
bun --inspect run dev:server

# Open chrome://inspect in Chrome
# Click "inspect" → Profiler tab
```

### Memory Profiler

```bash
# Generate heap snapshot
bun --inspect run dev:server

# Open chrome://inspect → Memory tab
# Take heap snapshot
```

## Related Documentation

- [docs/ci-cd-improvements.md](ci-cd-improvements.md) - CI/CD optimizations
- [docs/webgpu-requirements.md](webgpu-requirements.md) - WebGPU requirements
- [docs/streaming-configuration.md](streaming-configuration.md) - Streaming setup
