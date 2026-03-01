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
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- Must run non-headless with Xorg or Xvfb (WebGPU requires window context)
- Chrome uses ANGLE/Vulkan for WebGPU
- **GPU Sandbox Bypass**: `--disable-gpu-sandbox` and `--disable-setuid-sandbox` required for container GPU access
- If WebGPU cannot initialize, deployment MUST FAIL

#### Vast.ai Deployment Architecture
The streaming pipeline requires specific GPU setup:

1. **GPU Display Driver Requirement** (CRITICAL):
   - **gpu_display_active=true**: REQUIRED when renting Vast.ai instances
   - WebGPU needs GPU display driver, not just compute access
   - Instances without display driver will fail WebGPU initialization
   - Early deployment check verifies nvidia_drm kernel module and /dev/dri/ device nodes
   - Deployment fails with clear guidance if display driver is missing

2. **GPU Rendering Modes** (tried in order):
   - **Xorg with NVIDIA**: Best performance, requires DRI/DRM device access
   - **Xvfb with NVIDIA Vulkan**: Virtual framebuffer + GPU rendering via ANGLE/Vulkan (non-headless Chrome)
   - **Headless Vulkan**: Chrome `--headless=new` with `--use-vulkan` and `--use-angle=vulkan`
   - **Headless EGL**: Direct EGL rendering without X server using `--headless=new --use-gl=egl`
   - **Ozone Headless**: Experimental mode using `--ozone-platform=headless` with GPU rendering
   - **SwiftShader**: Software Vulkan fallback (poor performance, last resort)
   - Deployment detects Xorg swrast software rendering and switches to alternative modes
   - Xvfb mode uses **non-headless Chrome** connecting to virtual display (WebGPU requires window context)

3. **Audio Capture**:
   - PulseAudio with `chrome_audio` virtual sink
   - FFmpeg captures from PulseAudio monitor (`chrome_audio.monitor`)
   - Configurable via `STREAM_AUDIO_ENABLED` and `PULSE_AUDIO_DEVICE`
   - User-mode PulseAudio with XDG_RUNTIME_DIR at `/tmp/pulse-runtime`

4. **RTMP Multi-Streaming**:
   - Simultaneous streaming to Twitch, Kick, X/Twitter (YouTube disabled)
   - FFmpeg tee muxer for single-encode multi-output
   - Stream keys configured via environment variables (never hardcoded)
   - All secrets read from `.env` file or GitHub Secrets

5. **Deployment Validation**:
   - Script verifies NVIDIA GPU is accessible via `nvidia-smi`
   - **Early Display Driver Check**: Checks nvidia_drm kernel module and DRM device nodes (/dev/dri/)
   - **GPU Display Mode Query**: Queries GPU display_mode via nvidia-smi to verify display driver support
   - **Guidance on Failure**: Provides clear guidance to rent instances with `gpu_display_active=true` on Vast.ai
   - Checks Vulkan ICD availability at `/usr/share/vulkan/icd.d/nvidia_icd.json`
   - Logs actual ICD content and VK_LOADER_DEBUG output for diagnostics
   - Ensures display server (Xorg/Xvfb) is running and accessible
   - Runs 6 WebGPU pre-check tests with different Chrome configurations
   - Extracts Chrome GPU info (WebGPU/Vulkan status) during deployment
   - Detects Xorg swrast software rendering fallback and switches to alternative modes
   - Fails deployment if WebGPU cannot be initialized (no soft fallbacks)
   - Persists GPU/display settings to `.env` for PM2 restarts
   - Exports working GPU mode for ecosystem.config.cjs
   - **XDG_RUNTIME_DIR**: Required for Vulkan/EGL initialization (set to `/tmp/runtime-root`)

6. **Production Client Build**:
   - When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
   - Serves pre-built client via `vite preview` instead of dev server
   - Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
   - Significantly faster page loads for streaming (no on-demand module compilation)

7. **Stream Capture Modes**:
   - **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
   - **WebCodecs**: Native VideoEncoder API (experimental)
   - **MediaRecorder**: Legacy fallback mode
   - Automatic recovery with viewport restoration on resolution mismatch
   - 5s timeout on probe evaluate calls to prevent hanging
   - Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)
   - **Chrome Executable**: Set `STREAM_CAPTURE_EXECUTABLE` to explicit Chrome path (e.g., `/usr/bin/google-chrome-unstable`) for reliable WebGPU
   - **Browser Restart**: Automatic browser restart every 45 minutes to prevent WebGPU OOM crashes
   - **Page Navigation Timeout**: Increased to 180s for Vite dev mode (production build recommended)

8. **Stream Encoding Optimization**:
   - Default: `film` tune with B-frames for better compression
   - Set `STREAM_LOW_LATENCY=true` for `zerolatency` tune (faster playback start)
   - Configurable GOP size via `STREAM_GOP_SIZE` (default: 60 frames)
   - 2x bitrate buffer multiplier (reduced from 4x to prevent backpressure buildup)
   - Audio buffering with `thread_queue_size=1024` and async resampling
   - Health check timeout: 5s (data timeout: 15s) for faster failure detection
   - Resolution tracking and mismatch detection with automatic viewport recovery

9. **WebGPU Diagnostics**:
   - `captureGpuDiagnostics()` extracts chrome://gpu info at startup
   - `testWebGpuInit()` preflight test detects WebGPU hangs early
   - Runs on blank page before loading heavy game content
   - Provides debugging info when WebGPU fails on remote GPU servers
   - 30s adapter timeout and 60s renderer init timeout prevent indefinite hangs
   - 6-stage WebGPU testing during deployment (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
   - **Verbose Chrome GPU Logging**: `--enable-logging=stderr --v=1` with `--vmodule` for GPU/Dawn/Vulkan debug output
   - **In-Process GPU Test**: `--in-process-gpu` flag for clearer GPU error messages during diagnostics
   - **XAUTHORITY Setup**: X11 authentication configured for container environments
   - **Chrome Crash Dumps**: Crash dump directory checked for debugging GPU failures

10. **Vast.ai CLI Provisioner**:
   - Automated provisioner script: `./scripts/vast-provision.sh`
   - Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
   - Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr)
   - Automatically rents best available instance
   - Waits for instance to be ready
   - Outputs SSH connection details and GitHub secret commands
   - Ensures only instances with NVIDIA display driver support are rented
   - **Requirements**: Vast.ai CLI (`pip install vastai`), API key configured (`vastai set api-key`)
   - **Usage**: `./scripts/vast-provision.sh`
   - **Disk Space**: 120GB minimum for builds and assets

11. **Display Environment Reuse**:
   - `duel-stack.mjs` checks if DISPLAY is already set before spawning new Xvfb
   - Reuses existing display from `deploy-vast.sh` with proper Vulkan/VK_ICD config
   - Prevents spawning new Xvfb (:100) that lacks Vulkan ICD configuration
   - Ensures WebGPU works with properly configured display from deployment script

12. **X Server Detection**:
   - Uses socket check (`/tmp/.X11-unix/X99`) instead of `xdpyinfo` for X server detection
   - More reliable and doesn't require additional packages
   - Prevents false negatives when `xdpyinfo` is not installed

13. **Chrome Flag Consolidation**:
   - Consolidate multiple `--enable-features` flags into single comma-separated flag
   - Add `isSecureContext` check to understand WebGPU availability
   - Add `hasGpuProperty` check to distinguish undefined vs falsy navigator.gpu
   - Add Dawn swiftshader backend for SwiftShader mode
   - Print navigator GPU-related properties for debugging

14. **PM2 Log Capture**:
   - Wait 60s for streaming bridge to initialize after PM2 start
   - Capture PM2 logs to diagnose streaming issues
   - Detect crash loops and dump error logs automatically
   - Helps debug streaming failures in production deployments

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
- Engine: Three.js 0.182.0, PhysX (WASM)
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

### Vast.ai Commands

```bash
# Search for WebGPU-capable instances
VAST_API_KEY=xxx bun run vast:search

# Provision new instance automatically
VAST_API_KEY=xxx bun run vast:provision

# Check current instance status
VAST_API_KEY=xxx bun run vast:status

# Destroy current instance
VAST_API_KEY=xxx bun run vast:destroy
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
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` crash in getEquippedWeaponTier that broke ALL agents every tick
- **Quest Goal Detection**: Added quest goal status change detection for proper quest lifecycle transitions

### Resource Management
- **Activity Logger Queue**: Max size 1000 with 25% eviction to prevent memory pressure
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS for zombie session cleanup
- **SessionCloseReason**: Added "timeout" to type for proper session termination tracking

### Test Stability
- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`

### E2E Journey Tests
- **Complete Journey Tests**: Full login→loading→spawn→walk gameplay tests in `complete-journey.spec.ts`
- **Screenshot Comparison**: Utilities to verify game is rendering correctly
- **Loading Screen Detection**: `waitForLoadingScreenHidden` helper for reliable test synchronization
- **Real Browser Testing**: Uses Playwright with actual WebGPU rendering (no mocks)

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

### Client Performance Optimizations

#### Movement System
- **Immediate Move Processing**: Bypasses ActionQueue for instant response to player clicks (eliminates 0-600ms latency)
- **Pathfinding Rate Limit**: Raised from 5/sec to 15/sec to match tile movement limiter
- **BFS Iterations**: Increased from 2000 to 8000 (~44 tile radius vs ~22 tile)
- **Path Continuation**: Seamless long-distance movement with automatic re-pathfinding when BFS limit reached
- **Skating Fix**: Server-side pre-computation + client-side path appending eliminates stop-lurch at segment boundaries
- **Multi-Click Feel**: Optimistic target pivoting + pending move queue ensures last click always reaches server
- **Per-Frame Allocation Elimination**: Pre-allocated buffers and squared distance comparisons in hot paths

#### Minimap Rendering
- **Async Terrain Generation**: Chunked sampling (50×50 grid) runs off RAF callback via setTimeout(0) yields
- **Zero RAF Blocking**: Terrain generation happens in background macrotasks, not during frame rendering
- **Canvas Rotation Transform**: Decouples terrain regeneration from camera rotation (only regenerates on player move/zoom)
- **Terrain Overshoot**: √2 × 1.1 sampling ensures corners stay filled at any rotation angle
- **Layer Synchronization**: All layers (terrain, roads, buildings, pips) use same camera snapshot
- **Cached Contexts**: Canvas 2D contexts cached in refs to avoid getContext() DOM queries
- **Performance**: Reduced terrain sampling from up to 40,000 pixels to 2,500 (16× reduction)

#### GPU Resource Hygiene
- **XPDropSystem**: Object pool for CanvasTexture/SpriteMaterial reuse, warn on pool exhaustion
- **DuelCountdownSplatSystem**: Pre-render count textures once, pool sprite/material pairs
- **HealthBars**: Add destroy() to clear hideTimeout handles and dispose InstancedMesh/texture/geometry
- **ProjectileRenderer**: Track pending setTimeout handles in Set, cancel all on destroy(), reference-counted geometry disposal
- **PlayerTokenManager**: Named beforeUnloadHandler property enables proper removeEventListener on dispose()
- **EmbeddedGameClient**: Guard async state updates with cancelled flag to prevent setState on unmounted component
- **ThreeResourceManager**: Add teardown() to stop dev monitor interval and reset WeakSet on hot-reload
- **Stale Health Bar Sweep**: Reverse iteration to remove bars for despawned entities

#### World Initialization Race Condition
- **Two-Flag Handshake**: initComplete + needsCleanup flags prevent world.destroy() from racing world.init()
- **Deferred Cleanup**: Cleanup callback waits for init() to complete if it arrives during async initialization
- **Resource Safety**: Ensures destroy() runs exactly once and only after world is fully constructed

#### Client Memory Optimizations
- **Machine ID Caching**: Browser fingerprint cached in _cachedMachineId (avoids canvas allocation on every token operation)
- **Activity Debouncing**: 500ms debounce on saveSession() localStorage writes (was synchronous on every interaction)
- **XP Drop Listener**: Store bound handler so destroy() can call world.off() (eliminates leak that survived world teardown)

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

#### GameTickProcessor (HIGH)
- **Issue**: Event handlers not cleaned up on destroy
- **Fix**: Store bound event handlers, cleanup in `destroy()` method
- **Pattern**: Track handler references, remove on destroy

#### TradingSystem (HIGH)
- **Issue**: PLAYER_LEFT/LOGOUT/DIED event handlers never removed
- **Fix**: Store bound handlers for player lifecycle events, cleanup in `destroy()`
- **Pattern**: Track handler references, remove on destroy

#### RTMPBridge (HIGH)
- **Issue**: WebSocket server listeners not cleaned up on close
- **Fix**: Call `removeAllListeners()` before closing WebSocket servers
- **Pattern**: Clear all listeners before resource disposal

#### ActionQueue (MEDIUM)
- **Issue**: playerQueues Map never cleared
- **Fix**: Add `destroy()` method to clear playerQueues
- **Pattern**: Clear collections on destroy

#### ScriptQueue (MEDIUM)
- **Issue**: PlayerScriptQueue and NPCScriptQueue not cleaned up
- **Fix**: Add `destroy()` methods to both queue classes
- **Pattern**: Implement cleanup methods for queue management

#### Shutdown Process (HIGH)
- **Issue**: Rate limiters and idempotency service not destroyed on shutdown
- **Fix**: Call `destroyAllRateLimiters()` and `destroyIdempotencyService()` in shutdown.ts
- **Pattern**: Explicit cleanup of global services during shutdown

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

## Gold Betting Demo

### Mobile Responsive UI
- **Resizable Panels**: Desktop layout with useResizePanel hook + ResizeHandle component
- **Mobile Detection**: useIsMobile hook gates JS inline styles so CSS media queries control layout
- **Mobile Layout**: 16:9 aspect-ratio video, bottom-sheet sidebar, touch-friendly tab targets, dvh units
- **Mobile Header**: Stacked HYPERSCAPE/MARKET logo, phase strip above video, SOL + EVM wallet buttons
- **Tab Reordering**: Trades tab moved first for better mobile UX
- **Real Data Integration**: Live SSE feed from game server (devnet mode) replaces mock data
- **Simulation Mode**: Available via `bun run dev:stream-ui` (dev mode uses real endpoints only)

### Console Noise Reduction
- **Recharts Warning Fix**: Raised .hm-chart-container min-height to 120px (eliminates width/height=0 warnings)
- **EventSource Auto-Reconnect**: Close EventSource on onerror to stop browser's built-in reconnect loop
- **Exponential Backoff**: useDuelContext switched from fixed setInterval to setTimeout with backoff (3s → 6s → 60s cap)

See CLAUDE.md for complete documentation.
