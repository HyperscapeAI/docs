# AGENTS.md

Instructions for AI coding assistants (GitHub Copilot, Cursor, etc.) working with this codebase.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement. DO NOT:
- Add WebGL fallback code
- Use `--disable-webgpu` flags
- Use `forceWebGL` parameters
- Create headless Chrome configurations without GPU/WebGPU support
- Suggest WebGL as an alternative

### Why WebGPU-Only?
- All materials use TSL (Three Shading Language) which ONLY works with WebGPU
- Post-processing effects use TSL-based node materials
- There is NO WebGL fallback path - the game simply won't render

### Browser Requirements
- Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- WebGPU must be available and working
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### WebGPU Initialization
- **Adapter Request Timeout**: 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- **Renderer Init Timeout**: 60s timeout on `renderer.init()` to detect GPU driver issues
- **Preflight Testing**: `testWebGpuInit()` runs on blank page before loading game content
- **GPU Diagnostics**: `captureGpuDiagnostics()` extracts chrome://gpu info for debugging
- Timeouts help diagnose misconfigured GPU servers where WebGPU initialization hangs

### macOS WebGPU Support
- **Metal Backend**: macOS uses Metal (not Vulkan) for WebGPU
- **System Chrome Required**: Auto-detects and uses system Chrome on macOS for WebGPU support
- **Playwright Limitation**: Bundled Chromium doesn't have proper WebGPU support on macOS
- **No Vulkan ICD**: Don't set `VK_ICD_FILENAMES` on macOS (not applicable)
- **Chrome Flags**: Remove Vulkan from feature flags on macOS (Metal is the backend)

### Server/Streaming (Vast.ai)
- NVIDIA GPU with Vulkan support is REQUIRED
- Must run headful with Xorg or Xvfb (NOT headless Chrome)
- Chrome uses ANGLE/Vulkan for WebGPU
- **GPU Sandbox Bypass**: `--disable-gpu-sandbox` and `--disable-setuid-sandbox` required for container GPU access
- If WebGPU cannot initialize, deployment MUST FAIL

#### Vast.ai Deployment Architecture
The streaming pipeline requires specific GPU setup:

1. **GPU Rendering Modes** (tried in order):
   - **Xorg with NVIDIA**: Best performance, requires DRI/DRM device access
   - **Xvfb with NVIDIA Vulkan**: Virtual framebuffer + GPU rendering via ANGLE/Vulkan
   - **Headless EGL with NVIDIA**: Direct EGL rendering without X server using `--headless=new --use-gl=egl`
   - **Ozone Headless with GPU**: Experimental mode using `--ozone-platform=headless` with GPU rendering
   - **Headless mode (software)**: NOT SUPPORTED - WebGPU will not work

2. **Audio Capture**:
   - PulseAudio with `chrome_audio` virtual sink
   - FFmpeg captures from PulseAudio monitor (`chrome_audio.monitor`)
   - Configurable via `STREAM_AUDIO_ENABLED` and `PULSE_AUDIO_DEVICE`
   - User-mode PulseAudio with XDG_RUNTIME_DIR at `/tmp/pulse-runtime`

3. **RTMP Multi-Streaming**:
   - Simultaneous streaming to Twitch, Kick, X/Twitter (YouTube disabled)
   - FFmpeg tee muxer for single-encode multi-output
   - Stream keys configured via environment variables (never hardcoded)
   - All secrets read from `.env` file or GitHub Secrets

4. **Deployment Validation**:
   - Script verifies NVIDIA GPU is accessible via `nvidia-smi`
   - Checks Vulkan ICD availability at `/usr/share/vulkan/icd.d/nvidia_icd.json`
   - Logs actual ICD content and VK_LOADER_DEBUG output for diagnostics
   - Ensures display server (Xorg/Xvfb) is running and accessible (or uses headless EGL)
   - Runs WebGPU pre-check test with Chrome to verify navigator.gpu availability
   - Extracts Chrome GPU info (WebGPU/Vulkan status) during deployment
   - Detects Xorg swrast software rendering fallback and switches to headless EGL
   - Fails deployment if WebGPU cannot be initialized (no soft fallbacks)
   - Persists GPU/display settings to `.env` for PM2 restarts
   - Exports working GPU mode (Xorg/Xvfb/headless-egl/ozone-headless) for ecosystem.config.cjs

5. **Production Client Build**:
   - When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
   - Serves pre-built client via `vite preview` instead of dev server
   - Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
   - Significantly faster page loads for streaming (no on-demand module compilation)

6. **Stream Capture Modes**:
   - **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
   - **WebCodecs**: Native VideoEncoder API (experimental)
   - **MediaRecorder**: Legacy fallback mode
   - Automatic recovery with viewport restoration on resolution mismatch
   - 5s timeout on probe evaluate calls to prevent hanging
   - Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)
   - **Chrome Executable**: Set `STREAM_CAPTURE_EXECUTABLE` to explicit Chrome path (e.g., `/usr/bin/google-chrome-unstable`) for reliable WebGPU
   - **Browser Restart**: Automatic browser restart every 45 minutes to prevent WebGPU OOM crashes

7. **Stream Encoding Optimization**:
   - Default: `film` tune with B-frames for better compression
   - Set `STREAM_LOW_LATENCY=true` for `zerolatency` tune (faster playback start)
   - Configurable GOP size via `STREAM_GOP_SIZE` (default: 60 frames)
   - 2x bitrate buffer multiplier (reduced from 4x to prevent backpressure buildup)
   - Audio buffering with `thread_queue_size=1024` and async resampling
   - Health check timeout: 5s (data timeout: 15s) for faster failure detection

8. **WebGPU Diagnostics**:
   - `captureGpuDiagnostics()` extracts chrome://gpu info at startup
   - `testWebGpuInit()` preflight test detects WebGPU hangs early
   - Runs on blank page before loading heavy game content
   - Provides debugging info when WebGPU fails on remote GPU servers
   - 30s adapter timeout and 60s renderer init timeout prevent indefinite hangs

See `scripts/deploy-vast.sh` for complete setup logic.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on Three.js WebGPURenderer with TSL shaders.

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces

## Tech Stack

- Runtime: Bun v1.1.38+
- Rendering: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- Engine: Three.js 0.180.0, PhysX (WASM)
- UI: React 19.2.0
- Server: Fastify, WebSockets
- Database: PostgreSQL (production), Docker (local)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
npm test             # Run tests
```

## File Structure

```
packages/
├── shared/          # Core engine (ECS, Three.js, networking)
├── server/          # Game server (Fastify)
├── client/          # Web client (Vite + React)
├── physx-js-webidl/ # PhysX WASM bindings
├── procgen/         # Procedural generation
└── asset-forge/     # AI asset generation + VFX catalog
```

## Stability Improvements

### Combat System
- **Combat Retry Timer**: Aligned with tick system (3000ms = 5 ticks) for consistent timing
- **Phase Timeout**: Reduced grace periods from 30s to 10s for faster failure detection
- **Combat Stall Nudge**: Tracks last nudge timestamp instead of cycle ID to allow re-nudging when combat stalls again
- **Damage Event Cache**: Cleanup every tick (was every 2 ticks), cap lowered from 5000 to 1000, evict 75% when exceeded

### Agent System
- **LLM Rate Limiting**: Exponential backoff for API calls (5s base, max 60s)
- **Consecutive Failure Tracking**: Resets on successful tick
- **Memory Leak Fixes**: Proper cleanup of COMBAT_DAMAGE_DEALT listeners in AgentManager and event handlers in AutonomousBehaviorManager
- **Dynamic Combat Escalation**: Agents progress from goblins → bandits → barbarians as combat level grows
- **Combat Style Rotation**: Agents cycle attack → strength → defense (train lowest skill)
- **Cooking Phase**: Agents cook raw food immediately instead of waiting for full inventory
- **Gear Upgrade Phase**: Agents smith better equipment when they have materials + levels
- **Combat Food Threshold**: Increased from 5 → 10 for better survival
- **World Data Manifest Loading**: Monster tiers and gear tiers loaded from world-data
- **LLM Error Fallback**: Idle + retry when agent has active goal instead of derailing to explore
- **Short-Circuit Dashboard Sync**: All agents show activity logs even when skipping LLM

### Resource Management
- **Activity Logger Queue**: Max size 1000 with 25% eviction to prevent memory pressure
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS for zombie session cleanup
- **SessionCloseReason**: Added "timeout" to type for proper session termination tracking

### Test Stability
- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`

## Performance Optimizations

### Instanced Rendering
Hyperscape uses instanced rendering for resource entities (rocks, ores, herbs, trees):
- **GLBResourceInstancer**: Pools instances by model path, separate InstancedMesh per LOD level
- **GLBTreeInstancer**: Specialized instancer for tree resources with dissolve materials
- **InstancedModelVisualStrategy**: Thin wrapper with invisible collision proxies for raycasting
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis to prevent flickering
- Falls back to StandardModelVisualStrategy if instancing fails

**Depleted Models** (NEW):
- Resources can specify `depletedModelPath` and `depletedModelScale` in config
- Instancer maintains separate pools for normal and depleted states (e.g., tree → stump)
- Automatic transition on resource depletion without individual model loading
- Collision proxy persists across state transitions
- Highlight mesh support for hover/selection on instanced entities

**API Changes**:
- `ResourceVisualStrategy.onDepleted()` now returns `boolean`
  - `true` = strategy handled depletion (instanced stump)
  - `false` = ResourceEntity should load individual depleted model
- New optional method: `getHighlightMesh(ctx)` for instanced entity highlighting
- `EntityHighlightService` supports instanced highlight meshes via `getHighlightRoot()`

### Model Cache Integrity
- **Index Buffer Type Preservation**: Model cache now preserves original index buffer type (Uint16Array vs Uint32Array)
- Fixes silent geometry corruption and RangeError crashes on cached model restore
- Cache version bumped to 4 to invalidate corrupt entries
- Affects all GLB models loaded via ModelCache (resources, NPCs, items)

## Memory Management

### Critical Memory Leak Fixes

Recent commits addressed critical memory leaks across the codebase. All cleanup follows the established patterns in SystemBase for proper resource cleanup.

#### ModelCache (CRITICAL)
- **Issue**: GPU memory leaks when cache is cleared
- **Fix**: Add geometry disposal on `clear()` and `remove()` methods
- **Impact**: Prevents GPU memory accumulation during hot reload and cache invalidation

#### EventBridge (HIGH)
- **Issue**: 50+ world event listeners never removed, causing listener accumulation on hot reload
- **Fix**: Add `destroy()` method to clean up all registered listeners
- **Pattern**: Track listeners in Map, iterate and remove on destroy

#### Logger (MEDIUM)
- **Issue**: Cleanup interval not stored, preventing proper shutdown
- **Fix**: Store cleanup interval in instance variable, add `destroy()` method
- **Pattern**: Clear interval and release resources on destroy

#### PlayerTokenManager (MEDIUM)
- **Issue**: Heartbeat interval continues after logout
- **Fix**: Add `stopHeartbeat()` method, call on logout/clear
- **Pattern**: Clear interval on cleanup

#### Connection Handler (MEDIUM)
- **Issue**: Error handler not cleaned up during auth cleanup
- **Fix**: Track and cleanup error handler during auth cleanup
- **Pattern**: Store handler reference, remove on cleanup

#### DuelBot (MEDIUM)
- **Issue**: World event handlers not cleaned up on disconnect
- **Fix**: Track `world.on()` handlers and clean them up on disconnect
- **Pattern**: Store handler references, iterate and remove on cleanup

#### AgentManager (HIGH)
- **Issue**: COMBAT_DAMAGE_DEALT listener never removed
- **Fix**: Store and cleanup listener in `shutdown()` method
- **Pattern**: Track listener reference, remove on shutdown

#### AutonomousBehaviorManager (HIGH)
- **Issue**: Event handlers not cleaned up during agent lifecycle
- **Fix**: Store and cleanup event handlers in `stop()` method
- **Pattern**: Track handler references, remove on stop

#### ColliderComponent (MEDIUM)
- **Issue**: Collision event handlers never unsubscribed
- **Fix**: Track collision event handlers and unsubscribe in `destroy()`
- **Pattern**: Store handler references, remove on destroy

#### MobEntity (MEDIUM)
- **Issue**: PLAYER_SET_DEAD listener never removed
- **Fix**: Track PLAYER_SET_DEAD listener and remove on destroy
- **Pattern**: Store listener reference, remove on destroy

#### Socket (MEDIUM)
- **Issue**: WebSocket event handlers not cleaned up
- **Fix**: Track WebSocket event handlers and clean up in `disconnect()`
- **Pattern**: Store handler references, remove on disconnect

#### ClientLiveKit (MEDIUM)
- **Issue**: Voices Map and room listeners not cleaned up
- **Fix**: Properly clean up voices Map and room listeners in `destroy()`
- **Pattern**: Clear Map and remove listeners on destroy

#### AggroSystem (MEDIUM)
- **Issue**: playerSkills, combatLevelCache, and aggro maps growing unboundedly
- **Fix**: Clean up playerSkills, combatLevelCache, and aggro on player disconnect
- **Pattern**: Remove player-specific data from Maps on disconnect

#### StarterChestEntity (MEDIUM)
- **Issue**: lootedByCharacters Set growing unboundedly over server lifetime
- **Fix**: Add size limit (10k) with LRU pruning for lootedByCharacters Set
- **Pattern**: Implement bounded collection with eviction policy

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

See CLAUDE.md for complete documentation.
