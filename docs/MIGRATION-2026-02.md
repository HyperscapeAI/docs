# Migration Guide - February 2026

This document covers breaking changes and new features introduced in February 2026.

## Breaking Changes

### 1. WebGL Removed - WebGPU Only (Commit 47782ed)

**Impact**: HIGH - All WebGL fallback code has been removed.

**What Changed:**
- `RendererFactory` no longer detects or supports WebGL
- `UniversalRenderer` type replaced with `WebGPURenderer` throughout codebase
- `--disable-webgpu` and `forceWebGL` URL parameters are ignored
- Deployment fails if WebGPU cannot initialize (no soft fallbacks)

**Migration Steps:**
1. Ensure all users have WebGPU-capable browsers:
   - Chrome 113+
   - Edge 113+
   - Safari 18+ (macOS 15+) - Safari 17 support removed
2. Remove any custom WebGL fallback code from your codebase
3. Update browser compatibility warnings to mention WebGPU requirement
4. Test on target browsers: [webgpureport.org](https://webgpureport.org)

**Files Changed:**
- `packages/shared/src/utils/rendering/RendererFactory.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.client.ts`
- `packages/server/scripts/stream-to-rtmp.ts`
- `packages/server/scripts/deploy-vast.sh`
- `packages/client/src/screens/GameClient.tsx`
- `packages/client/src/game/panels/SettingsPanel/index.ts`
- `packages/client/src/lib/errorCodes.ts`

### 2. ResourceVisualStrategy API Changes (Commit 9643d5d)

**Impact**: MEDIUM - Breaking change for custom resource visual strategies.

**What Changed:**
- `ResourceVisualStrategy.onDepleted()` now returns `Promise<boolean>` instead of `Promise<void>`
  - Return `true` if strategy handled depletion (e.g., instanced stump)
  - Return `false` if ResourceEntity should load individual depleted model
- New optional method: `getHighlightMesh(ctx): THREE.Object3D | null`
  - Returns positioned mesh for outline pass on instanced entities
  - Used by `EntityHighlightService` for hover/selection effects

**Migration Steps:**
1. Update custom `ResourceVisualStrategy` implementations:
   ```typescript
   // OLD
   async onDepleted(ctx: ResourceVisualContext): Promise<void> {
     // Load depleted model
   }

   // NEW
   async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
     // Load depleted model
     return false; // Entity should load individual model
   }
   ```

2. Implement `getHighlightMesh()` if using instanced rendering:
   ```typescript
   getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
     // Return positioned mesh for outline pass
     return this.instancer.getHighlightMesh(ctx.id);
   }
   ```

**Files Changed:**
- `packages/shared/src/entities/world/visuals/ResourceVisualStrategy.ts`
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`
- `packages/shared/src/entities/world/ResourceEntity.ts`
- `packages/shared/src/systems/client/interaction/services/EntityHighlightService.ts`

### 3. YouTube Streaming Disabled (Commit 47167b6)

**Impact**: LOW - YouTube streaming is now explicitly disabled.

**What Changed:**
- `YOUTUBE_STREAM_KEY` is explicitly set to empty string in deployment
- All YouTube-related RTMP configuration is ignored
- Only Twitch, Kick, and X/Twitter streaming are supported

**Migration Steps:**
1. Remove YouTube stream keys from environment variables
2. Update streaming documentation to reflect Twitch/Kick/X only
3. Set `YOUTUBE_STREAM_KEY=""` explicitly to prevent stale keys from being used

**Files Changed:**
- `packages/server/ecosystem.config.cjs`
- `scripts/deploy-vast.sh`

### 4. Model Cache Version Bump (Commit 6fd626a)

**Impact**: LOW - Automatic cache invalidation.

**What Changed:**
- Model cache version bumped from 3 to 4
- All cached models will be re-downloaded and re-processed
- Fixes index buffer type corruption (Uint16Array vs Uint32Array)

**Migration Steps:**
- No action required - cache invalidation is automatic
- First load after update will be slower as cache rebuilds
- Expect increased network traffic for model downloads

**Files Changed:**
- `packages/shared/src/utils/rendering/ModelCache.ts`

## New Features

### 1. Instanced Rendering for Resources (Commit 53a9513, 9643d5d)

**What's New:**
- GPU instancing for all resource entities (rocks, ores, herbs, trees)
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Separate instance pools for normal and depleted states (tree → stump)
- Highlight mesh support for hover/selection on instanced entities

**Implementation:**
```typescript
// Instancing is enabled by default for all resources
// Falls back to StandardModelVisualStrategy if instancing fails

// New instancers:
// - GLBResourceInstancer: General resources (rocks, ores, herbs)
// - GLBTreeInstancer: Trees with dissolve materials

// Configuration in resource manifest:
{
  "modelPath": "assets/world/resources/tree.glb",
  "depletedModelPath": "assets/world/resources/stump.glb",  // NEW
  "depletedModelScale": 0.8  // NEW
}
```

**Files Added:**
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`

**Files Modified:**
- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`
- `packages/shared/src/entities/world/ResourceEntity.ts`
- `packages/shared/src/runtime/createClientWorld.ts`

### 2. WebGPU Initialization Timeouts (Commit ff45217, d5c6884)

**What's New:**
- 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- 60s timeout on `renderer.init()` to detect GPU driver issues
- Preflight test (`testWebGpuInit()`) runs on blank page before loading game
- GPU diagnostics (`captureGpuDiagnostics()`) extract chrome://gpu info

**Usage:**
```typescript
// Automatic - no code changes required
// Timeouts are built into RendererFactory

// For debugging:
// Check browser console for timeout errors
// Review GPU diagnostics in server logs
```

**Files Changed:**
- `packages/shared/src/utils/rendering/RendererFactory.ts`
- `packages/server/src/streaming/rtmp-bridge.ts`

### 3. Production Client Build for Streaming (Commit 4be263a)

**What's New:**
- Serves pre-built client via `vite preview` instead of dev server
- Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
- Significantly faster page loads for streaming

**Usage:**
```bash
# Enable production client build
export NODE_ENV=production
# OR
export DUEL_USE_PRODUCTION_CLIENT=true

# Start streaming
bun run stream:rtmp
```

**Files Changed:**
- `packages/server/scripts/stream-to-rtmp.ts`
- `packages/server/ecosystem.config.cjs`

### 4. Stream Capture Probe Timeouts (Commit 432ff84, cb0aaa9)

**What's New:**
- 5s timeout on probe evaluate calls to prevent hanging
- Proceeds with capture after 5 consecutive probe timeouts
- Handles browser unresponsiveness gracefully

**Configuration:**
```bash
# No configuration needed - automatic
# Logs will show probe timeout warnings if browser is unresponsive
```

**Files Changed:**
- `packages/server/src/streaming/browser-capture.ts`

### 5. GPU Sandbox Bypass for Containers (Commit 60c7157, b31f926)

**What's New:**
- `--disable-gpu-sandbox` and `--disable-setuid-sandbox` flags added
- Required for container GPU access (Docker, Vast.ai)
- Allows Chrome to access NVIDIA GPU in containerized environments

**Usage:**
```bash
# Automatic in deploy-vast.sh
# For custom deployments, add these Chrome flags:
--disable-gpu-sandbox
--disable-setuid-sandbox
```

**Files Changed:**
- `scripts/deploy-vast.sh`
- `packages/server/src/streaming/rtmp-bridge.ts`

## Stability Improvements

### 1. Combat System Stability (Commits 3357379, 0b2ff71)

**Improvements:**
- Combat retry timer aligned with tick system (3000ms = 5 ticks)
- Phase timeout grace periods reduced (30s → 10s)
- Combat stall nudge tracks timestamp instead of cycle ID (allows re-nudging)
- Damage event cache cleanup every tick (was every 2 ticks)
- Cache cap lowered from 5000 to 1000, evicts 75% when exceeded

**Configuration:**
```bash
# Optional tuning (defaults are optimized)
COMBAT_RETRY_TIMER_MS=3000
COMBAT_PHASE_TIMEOUT_MS=10000
DAMAGE_EVENT_CACHE_MAX_SIZE=1000
DAMAGE_EVENT_CACHE_EVICTION_PERCENT=75
```

### 2. Memory Leak Fixes (Commit 3357379)

**Improvements:**
- AgentManager properly cleans up COMBAT_DAMAGE_DEALT event listeners
- AutonomousBehaviorManager cleans up all event handlers in stop()
- Prevents memory accumulation during agent lifecycle

**No action required** - fixes are automatic.

### 3. Resource Management (Commits 3357379, 0b2ff71)

**Improvements:**
- Activity logger queue: max 1000 entries with 25% eviction
- Session timeout: 30 minutes (MAX_SESSION_TICKS)
- New "timeout" added to SessionCloseReason type

**Configuration:**
```bash
# Optional tuning
ACTIVITY_LOGGER_MAX_QUEUE_SIZE=1000
ACTIVITY_LOGGER_EVICTION_PERCENT=25
MAX_SESSION_TICKS=3000  # 30 minutes at 600ms/tick
```

### 4. Streaming Stability (Commits 3357379, 0b2ff71, 432ff84)

**Improvements:**
- Browser restart interval: 45 minutes (was 1 hour) to prevent WebGPU OOM
- Health check timeout: 5s (was 10s) for faster failure detection
- Data timeout: 15s (was 30s) to match health check ratio
- Buffer multiplier: 2x (was 4x) to reduce backpressure buildup
- CDP session handler cleanup on recovery (prevents double-handling)
- Proceeds with capture after 5 consecutive probe timeouts

**Configuration:**
```bash
# Optional tuning
BROWSER_RESTART_INTERVAL_MS=2700000  # 45 minutes
STREAM_HEALTH_CHECK_TIMEOUT_MS=5000
STREAM_DATA_TIMEOUT_MS=15000
STREAM_BITRATE_BUFFER_MULTIPLIER=2
```

### 5. Agent System Rate Limiting (Commit 0b2ff71)

**Improvements:**
- Exponential backoff for LLM API calls
- 5s base backoff, max 60s
- Tracks consecutive failures, resets on success

**Configuration:**
```bash
# Optional tuning
AGENT_LLM_BACKOFF_BASE_MS=5000
AGENT_LLM_BACKOFF_MAX_MS=60000
```

### 6. Test Stability (Commit 583b6bc)

**Improvements:**
- GoldClob fuzz tests: 120s timeout for randomized invariant tests
- Precision fixes: larger amounts (10000n) to avoid gas cost rounding errors
- Dynamic import timeout: 60s for EmbeddedHyperscapeService beforeEach hooks

**No action required** - test improvements are automatic.

## Deprecations

### 1. Safari 17 Support Removed

**Reason**: Safari 18+ (macOS 15+) provides more stable WebGPU implementation.

**Action**: Update browser compatibility documentation to require Safari 18+.

### 2. WebGL Renderer Type Removed

**Reason**: WebGL is no longer supported - WebGPU only.

**Action**: Replace `UniversalRenderer` with `WebGPURenderer` in custom code.

### 3. Headless Chrome for Streaming

**Reason**: Headless mode does not support WebGPU.

**Action**: Use Xorg or Xvfb display server for GPU streaming.

## Recommended Actions

### For Developers

1. **Update browser requirements** in user-facing documentation
2. **Test WebGPU compatibility** on target browsers
3. **Review custom ResourceVisualStrategy** implementations for API changes
4. **Update streaming deployment** scripts to use new environment variables
5. **Monitor memory usage** with new resource management limits

### For Operators

1. **Update Vast.ai deployment** to use latest `deploy-vast.sh`
2. **Configure stream keys** via environment variables (remove hardcoded secrets)
3. **Monitor browser restart** logs for WebGPU OOM prevention
4. **Review GPU diagnostics** in deployment logs
5. **Test WebGPU preflight** checks on GPU servers

### For Contributors

1. **Read AGENTS.md** for updated WebGPU requirements
2. **Review CLAUDE.md** for instanced rendering architecture
3. **Check .env.example** for new streaming configuration options
4. **Test changes** with real Playwright browser sessions (no mocks)
5. **Document breaking changes** in commit messages

## Support

For questions or issues related to this migration:
- Review [CLAUDE.md](../CLAUDE.md) for architecture details
- Check [AGENTS.md](../AGENTS.md) for WebGPU requirements
- See `scripts/deploy-vast.sh` for streaming deployment logic
- Open an issue: [github.com/HyperscapeAI/hyperscape/issues](https://github.com/HyperscapeAI/hyperscape/issues)
