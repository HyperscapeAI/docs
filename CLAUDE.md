# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement due to our use of TSL (Three Shading Language) for all materials and post-processing effects. TSL only works with the WebGPU node material pipeline.

### Why WebGPU-Only?
- **TSL Shaders**: All materials use Three.js Shading Language (TSL) which requires WebGPU
- **Post-Processing**: Bloom, tone mapping, and other effects use TSL-based node materials
- **No Fallback**: There is NO WebGL fallback - the game will not render without WebGPU

### Browser Requirements
- Chrome 113+ (recommended)
- Edge 113+
- Safari 18+ (macOS 15+) - **Note: Safari 17 support was removed**
- Firefox (behind flag, not recommended)
- WebGPU must be available and working
- Check: [webgpureport.org](https://webgpureport.org)

### macOS WebGPU Support
- **Metal Backend**: macOS uses Metal (not Vulkan) for WebGPU
- **System Chrome Required**: Auto-detects and uses system Chrome on macOS for WebGPU support
- **Playwright Limitation**: Bundled Chromium doesn't have proper WebGPU support on macOS
- **No Vulkan ICD**: Don't set `VK_ICD_FILENAMES` on macOS (not applicable)
- **Chrome Flags**: Remove Vulkan from feature flags on macOS (Metal is the backend)

### WebGPU Initialization
- **Adapter Request Timeout**: 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- **Renderer Init Timeout**: 60s timeout on `renderer.init()` to detect GPU driver issues
- **Preflight Testing**: `testWebGpuInit()` runs on blank page before loading game content
- **GPU Diagnostics**: `captureGpuDiagnostics()` extracts chrome://gpu info for debugging
- Timeouts help diagnose misconfigured GPU servers where WebGPU initialization hangs

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
   - **X Server Detection**: Uses socket check (`/tmp/.X11-unix/X99`) instead of `xdpyinfo` for reliability
   - Runs 6 WebGPU pre-check tests with different Chrome configurations
   - Extracts Chrome GPU info (WebGPU/Vulkan status) during deployment
   - Detects Xorg swrast software rendering fallback and switches to alternative modes
   - Fails deployment if WebGPU cannot be initialized (no soft fallbacks)
   - Persists GPU/display settings to `.env` for PM2 restarts
   - Exports working GPU mode for ecosystem.config.cjs
   - **Display Environment Reuse**: `duel-stack.mjs` respects existing DISPLAY from deployment script

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

8. **WebGPU Diagnostics**:
   - `captureGpuDiagnostics()` extracts chrome://gpu info at startup
   - `testWebGpuInit()` preflight test detects WebGPU hangs early
   - Runs on blank page before loading heavy game content
   - Provides debugging info when WebGPU fails on remote GPU servers
   - 30s adapter timeout and 60s renderer init timeout prevent indefinite hangs
   - 6-stage WebGPU testing during deployment (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)

See `scripts/deploy-vast.sh` for complete setup logic.

### Vast.ai CLI Provisioner

The `scripts/vast-provision.sh` script automates GPU instance provisioning with display driver support:

**Features**:
- Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr)
- Automatically rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Ensures only instances with NVIDIA display driver support are rented

**Usage**:
```bash
./scripts/vast-provision.sh
```

**Requirements**:
- Vast.ai CLI installed: `pip install vastai`
- Logged in: `vastai set api-key YOUR_API_KEY`
- Get API key from: https://cloud.vast.ai/account/

**Output**:
- SSH connection command
- GitHub secrets for CI/CD (`VAST_HOST`, `VAST_PORT`, `VAST_SSH_KEY`)
- Configuration file saved to `/tmp/vast-instance-config.env`

**After Provisioning**:
1. Update GitHub secrets with the provided commands
2. Trigger deployment: `gh workflow run deploy-vast.yml`

**Deployment Validation**:
- 6-stage WebGPU testing (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
- Early display driver checks (nvidia_drm kernel module, DRM device nodes)
- GPU display mode validation via nvidia-smi
- Vulkan ICD detection and diagnostics
- Automatic fallback between GPU rendering modes
- Fails deployment if WebGPU cannot be initialized (no soft fallbacks)

This ensures you only rent instances with NVIDIA display driver support, which is required for WebGPU streaming (not just compute access).

### Development Rules for WebGPU
- **NEVER add WebGL fallback code** - it will not work with TSL shaders
- **NEVER use `--disable-webgpu`** or `forceWebGL` flags
- **NEVER use headless Chrome modes** that don't support WebGPU
- All renderer code must assume WebGPU availability
- If WebGPU is unavailable, throw an error immediately

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Vast.ai GPU Instance Management

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

**Requirements:**
- Install Vast.ai CLI: `pip install vastai`
- Set API key: `vastai set api-key YOUR_API_KEY`
- Get API key from: https://cloud.vast.ai/account/

**What `vast:provision` does:**
- Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr)
- Automatically rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Saves configuration to `/tmp/vast-instance-config.env`

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

#### Test Timeout Configuration
Recent stability improvements have adjusted test timeouts for reliability:

- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Playwright Tests**: Increased navigation timeout to 180s for Vite dev mode
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`

#### E2E Journey Tests
Complete end-to-end gameplay testing with real browser sessions:

- **Complete Journey Tests**: Full login→loading→spawn→walk gameplay tests in `complete-journey.spec.ts`
- **Screenshot Comparison**: Utilities to verify game is rendering correctly
- **Loading Screen Detection**: `waitForLoadingScreenHidden` helper for reliable test synchronization
- **Real Browser Testing**: Uses Playwright with actual WebGPU rendering (no mocks)
- **Visual Verification**: Captures screenshots at key gameplay moments for regression testing
- **Three.js Scene Introspection**: Queries actual scene state to verify entity spawning and movement

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```

## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── SQLite/PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **decimation** - Mesh decimation utilities
3. **impostors** - Impostor rendering system (required by shared)
4. **procgen** - Procedural generation (required by shared)
5. **shared** - Core engine (depends on physx-js-webidl, impostors, procgen)
6. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

**Manual Build Order** (for CI or troubleshooting):
```bash
cd packages/physx-js-webidl && bun run build
cd ../decimation && bun run build
cd ../impostors && bun run build
cd ../procgen && bun run build
cd ../shared && bun run build
cd ../plugin-hyperscape && bun run build
cd ../server && bun run build
```

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### RPG Implementation Architecture

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

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

## Client Performance Optimizations

### GPU Memory Management
Recent fixes eliminate GPU memory leaks in client rendering systems:

- **XPDropSystem**: Object pool for CanvasTexture/SpriteMaterial reuse instead of per-drop allocation
  - Warn to console when sprite pool is exhausted for POOL_SIZE tuning visibility
  - Proper cleanup of XP_DROP_RECEIVED listener in `destroy()` method
- **DuelCountdownSplatSystem**: Pre-render count textures once; pool sprite/material pairs
- **HealthBars**: Add `destroy()` to clear hideTimeout handles and dispose InstancedMesh/texture/geometry
  - Sweep stale health bar handles when entities are removed (reverse iteration for swap-with-last safety)
- **ProjectileRenderer**: Track pending setTimeout handles in a Set; cancel all on `destroy()`
  - Static `_instanceCount` reference counter ensures shared CircleGeometry is only disposed when last renderer instance tears down
  - Use `lengthSq()` for hit check + single sqrt for both normalization and fade (saves one sqrt per projectile/frame)
- **ThreeResourceManager**: Add `teardown()` to stop dev monitor interval and reset WeakSet on hot-reload
  - Called in GameClient useEffect cleanup after `world.destroy()`

### Client State Management
- **PlayerTokenManager**: Named `beforeUnloadHandler` property enables proper `removeEventListener` on `dispose()`
  - Call `dispose()` in index.tsx cleanup so beforeunload listener is actually removed
  - Debounce `saveSession()` localStorage write to 500ms (was synchronous on every user interaction)
  - Flush pending debounced write before marking session inactive in `endSession()`
  - Cancel debounce timer in `dispose()` to prevent post-teardown write
  - Cache `generateMachineId()` result in `_cachedMachineId` (browser fingerprint is session-stable)
- **EmbeddedGameClient**: Guard async state updates with cancelled flag to prevent setState on unmounted component
- **World Initialization**: Two-flag handshake prevents `world.destroy()` from racing `world.init()` mid-await
  - `initComplete`: set to true after init() resolves (even on failure, to allow cleanup of partial resources)
  - `needsCleanup`: set to true if cleanup fires before init() finishes
  - Cleanup callback defers destruction to init() when it arrives late; init() defers to cleanup() when pre-empted

### Movement System Improvements
- **Immediate Move Processing**: Bypass ActionQueue for move requests (player input event, not game-state mutation)
  - Walking still advances on 600ms tick schedule via `onTick()`
  - Eliminates 0-600ms latency between click and `tileMovementStart` broadcast
- **Pathfinding Rate Limit**: Raised from 5/sec to 15/sec (aligned with tile movement limiter)
- **BFS Iteration Limit**: Raised from 2000 to 8000 iterations (~22-tile → ~44-tile reliable radius)
- **Path Continuation**: Seamless long-distance movement beyond BFS radius
  - `requestedDestination` and `lastPathPartial` fields in TileMovementState
  - When partial BFS path ends, `onTick` calls `_continuePathToDestination()` to re-pathfind from new tile
  - `tileMovementEnd` packet suppressed while segments continue for uninterrupted client animation
  - Death-state and duel-state guards prevent movement packets to dead/frozen players mid-continuation
  - Clear `requestedDestination` + `lastPathPartial` on respawn/teleport to prevent cancelled destination re-pathfinding
- **Long-Distance Skating Fix**: Server-side pre-computation + client-side path appending
  - `nextSegmentPrecomputed` flag in TileMovementState
  - Look-ahead block sends next segment 1 tick early via `_precomputeAndSendNextSegment`
  - `isContinuation` flag in `tileMovementStart` packet triggers path-append fast-path in TileInterpolator
  - No interpolator reset, no catch-up spike - continuous walking across segment boundaries
  - Max catch-up multiplier reduced from 4x to 2x for smoother sync
- **Multi-Click Improvements**:
  - `setOptimisticTarget()` immediately pivots character toward newly clicked destination (no server round-trip)
  - Pending-move queue ensures last click in rapid burst always reaches server within 67ms rate-limit window

### Movement Performance
Per-frame allocation elimination in TileInterpolator hot paths:
- Use pre-allocated `_destWorldPos` instead of `tileToWorld()` which allocates `{x,y,z}` each frame per entity
- Replace sqrt in backward-tile-skip with squared distance comparison (TILE_SKIP_THRESHOLD_SQ)
- Defer sqrt in arrival check - compute distSq first, only sqrt when entity is actually arriving
- Reuse distSq for normalize via `divideScalar(sqrt(distSq))` instead of second sqrt inside `.normalize()`
- Replace `path.map()` with push loop on movement start to avoid intermediate array allocation

### Minimap Rendering Optimizations
- **Async Terrain Generation**: Terrain sampling runs entirely outside RAF callback via `generateTerrainChunked()`
  - 50×50 grid sampling (TERRAIN_SAMPLE_SIZE = 50) instead of per-pixel (16× reduction from 40,000 to 2,500 calls)
  - Yields to browser via `setTimeout(0)` every 10 rows (5 yield points per full generation)
  - Zero RAF blocking - no frame drops during terrain regeneration
  - `terrainGenVersionRef` monotonically-incrementing token cancels in-flight generation on camera state change
- **Canvas Rotation Transform**: Decouple terrain regeneration from camera rotation
  - Terrain only regenerates when player moves or zoom changes (not on rotation)
  - Single canvas rotation transform (`translate→rotate(+deltaYaw)→translate-back`) applied every terrain frame (~15fps)
  - `TERRAIN_OVERSHOOT` (√2 × 1.1 ≈ 1.555×) ensures canvas corners stay filled at any rotation angle
  - `terrainIsGeneratingRef` mutex prevents overlapping async generations
- **Canvas 2D Terrain Background**: Replace second WebGPURenderer with Canvas 2D
  - Eliminates constant shader recompilation from switching WebGPU contexts
  - Fixes THREE.TSL normal-attribute warnings and GPUDevice.createBindGroup errors
  - Height-sampled ImageData using `TerrainSystem.getHeightAt()` with height-to-color mapping
  - Terrain cache regenerates only when player moves >20 world units or zoom changes
- **Road/Building Overlays**: Restore vector overlays with performance optimizations
  - Draw road paths as tan/beige vector strokes with outline pass for depth
  - Draw building footprints as rotated rectangles accounting for building.rotation and camera up vector
  - Cache road and building data lazily (never changes after world init)
  - Cache 2D canvas contexts in refs (mainCtxRef/overlayCtxRef) to avoid getContext DOM queries
  - Cache `performance.now()` once per frame, replacing per-pip `Date.now()` calls
  - Replace `entity.serialize()` in InterpolationEngine hot loop with direct `entity.data` access
- **Layer Synchronization**: All layers (terrain, roads, buildings, pips) projected from same camera snapshot
  - `terrainCacheUpRef` stores cam.up.x/z when terrain cache is generated
  - Camera rotation added to cache invalidation trigger
  - `_cachedProjectionViewMatrix` updated every frame for smooth 60fps pip movement
  - Rotation threshold raised from 0.01 to 0.087 (~5°) to avoid per-frame terrain regeneration

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

### Streaming Stability
- **Browser Restart**: Reduced from 1 hour to 45 minutes to prevent WebGPU OOM crashes
- **Health Check Timeout**: 5s (data timeout: 15s) for faster failure detection
- **Buffer Multiplier**: Lowered from 4x to 2x to reduce backpressure buildup
- **CDP Session Recovery**: Fixed handler cleanup on recovery (recovery mode flag prevents double-handling)

### Quest System
- **acceptQuestAction Validation**: Now requires a `not_started` quest in state to validate/work
- **No Fallback to Interaction**: acceptQuestAction no longer falls back to interactWithEntity when quest state is missing
- **Test Updates**: Updated test expectations to match current implementation behavior

### Blockchain Testing
- **Anchor Configuration**: Use localnet instead of devnet for `anchor test` to spin up local validator with free SOL
- **Deployment**: For actual devnet/mainnet deployments, use `anchor deploy --provider.cluster devnet`
- **Test Isolation**: Tests no longer require real SOL funding on devnet

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or "will fill this out later" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 5555 | Game Server | `PORT` | `bun run dev` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.1.38+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.1.38+
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.180.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: SQLite (local), PostgreSQL (production via Neon)
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

## Memory Management

### Critical Memory Leak Fixes

Recent commits addressed critical memory leaks across the codebase. All cleanup follows the established patterns in SystemBase for proper resource cleanup.

#### Memory Management Best Practices

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

#### Known Memory Leak Patterns Fixed

**CRITICAL:**
- **ModelCache**: GPU memory leaks when cache is cleared - Add geometry disposal on `clear()` and `remove()` methods
- **Index Buffer Type Preservation**: Model cache now preserves original index buffer type (Uint16Array vs Uint32Array) to prevent silent geometry corruption

**HIGH:**
- **EventBridge**: 50+ world event listeners never removed - Add `destroy()` method to clean up all registered listeners
- **AgentManager**: COMBAT_DAMAGE_DEALT listener never removed - Store and cleanup listener in `shutdown()` method
- **AutonomousBehaviorManager**: Event handlers not cleaned up - Store and cleanup event handlers in `stop()` method
- **GameTickProcessor**: Event handlers not cleaned up - Store bound event handlers, cleanup in `destroy()` method
- **TradingSystem**: PLAYER_LEFT/LOGOUT/DIED event handlers never removed - Store bound handlers, cleanup in `destroy()`
- **RTMPBridge**: WebSocket server listeners not cleaned up - Call `removeAllListeners()` before closing WebSocket servers

**MEDIUM:**
- **Logger**: Cleanup interval not stored - Store cleanup interval in instance variable, add `destroy()` method
- **PlayerTokenManager**: Heartbeat interval continues after logout - Add `stopHeartbeat()` method, call on logout/clear
- **Connection Handler**: Error handler not cleaned up - Track and cleanup error handler during auth cleanup
- **DuelBot**: World event handlers not cleaned up - Track `world.on()` handlers and clean them up on disconnect
- **ColliderComponent**: Collision event handlers never unsubscribed - Track handlers and unsubscribe in `destroy()`
- **MobEntity**: PLAYER_SET_DEAD listener never removed - Track listener and remove on destroy
- **Socket**: WebSocket event handlers not cleaned up - Track handlers and clean up in `disconnect()`
- **ClientLiveKit**: Voices Map and room listeners not cleaned up - Properly clean up in `destroy()`
- **AggroSystem**: playerSkills, combatLevelCache, and aggro maps growing unboundedly - Clean up on player disconnect
- **StarterChestEntity**: lootedByCharacters Set growing unboundedly - Add size limit (10k) with LRU pruning
- **ActionQueue**: playerQueues Map never cleared - Add `destroy()` method to clear playerQueues
- **ScriptQueue**: PlayerScriptQueue and NPCScriptQueue not cleaned up - Add `destroy()` methods to both queue classes

**Shutdown Process:**
- Rate limiters and idempotency service not destroyed - Call `destroyAllRateLimiters()` and `destroyIdempotencyService()` in shutdown.ts

### Client Performance Optimizations

#### GPU Resource Management
- **XPDropSystem**: Object pool for CanvasTexture/SpriteMaterial reuse instead of per-drop allocation
- **DuelCountdownSplatSystem**: Pre-render count textures once; pool sprite/material pairs
- **HealthBars**: Add destroy() to clear hideTimeout handles and dispose InstancedMesh/texture/geometry
- **ProjectileRenderer**: Track pending setTimeout handles in a Set; cancel all on destroy()
- **PlayerTokenManager**: Named beforeUnloadHandler property enables proper removeEventListener on dispose()
- **EmbeddedGameClient**: Guard async state updates with cancelled flag to prevent setState on unmounted component
- **ThreeResourceManager**: Add teardown() to stop dev monitor interval and reset WeakSet on hot-reload
- **GameClient**: Call ThreeResourceManager.teardown() in useEffect cleanup after world.destroy()

#### Per-Frame Allocation Elimination
- **TileInterpolator**: Use pre-allocated `_destWorldPos` instead of `tileToWorld()` which allocates {x,y,z} each frame
- **TileInterpolator**: Replace sqrt in backward-tile-skip with squared distance comparison
- **TileInterpolator**: Defer sqrt in arrival check - compute distSq first, only sqrt when arriving
- **TileInterpolator**: Reuse distSq for normalize via divideScalar(sqrt(distSq))
- **TileInterpolator**: Replace path.map() with push loop to avoid intermediate array allocation
- **ProjectileRenderer**: Use lengthSq() for hit check + single sqrt for both normalization and fade

#### Performance Monitoring
- **generateMachineId()**: Cache result in `_cachedMachineId` - browser fingerprint is session-stable
- **updateActivity()**: Debounce the saveSession() localStorage write to 500ms
- **endSession()**: Flush any pending debounced write before marking session inactive
- **dispose()**: Cancel the debounce timer to prevent post-teardown write

### Movement System Improvements

#### Path Continuation for Long-Distance Movement
- **requestedDestination** and **lastPathPartial** fields added to TileMovementState
- When a partial BFS path ends (iteration limit reached), `onTick` calls `_continuePathToDestination()`
- Re-pathfinds from new tile toward original click target
- Suppresses tileMovementEnd packet while segments continue for uninterrupted client animation
- Eliminates premature stopping on clicks beyond ~44-tile BFS radius

#### Rate Limiting and BFS Improvements
- **Pathfind Rate Limiter**: Raised from 5/sec to 15/sec (aligned with tile movement limiter)
- **MAX_BFS_ITERATIONS**: Raised from 2000 to 8000 (~22-tile → ~44-tile reliable radius)
- **ActionQueue Bypass**: moveRequest bypasses ActionQueue for immediate processing (0-600ms latency eliminated)

#### Skating Fix (Server-Side Pre-computation + Client-Side Path Appending)
- **nextSegmentPrecomputed** flag added to TileMovementState
- Look-ahead block in onTick/processPlayerTick sends next segment 1 tick early via `_precomputeAndSendNextSegment`
- Clears RTT/2 idle gap that caused stop-then-lurch at segment boundaries
- **isContinuation** flag added to tileMovementStart packet type
- **TileInterpolator**: Path-append fast-path when isContinuation=true keeps entity walking continuously
- Max catch-up multiplier reduced from 4x to 2x for smoother sync

#### Multi-Click Improvements
- **setOptimisticTarget()**: Immediately pivot character toward newly clicked destination without server round-trip
- **_sendMoveRequest/pending-move queue**: Last click in rapid burst always reaches server even within 67ms rate-limit window

### Minimap Rendering Improvements

#### Canvas 2D Terrain Background (Replaced Second WebGPU Renderer)
- Removed second WebGPURenderer that caused constant shader recompilation
- Removed THREE.TSL normal-attribute warnings and GPUDevice.createBindGroup errors
- Height-sampled ImageData using TerrainSystem.getHeightAt() with height-to-color mapping
- Terrain cache regenerates only when player moves >20 world units or zoom changes

#### Async Chunked Terrain Generation
- **generateTerrainChunked()**: Module-level async function builds 50×50 terrain OffscreenCanvas
- Yields to browser via setTimeout(0) every 10 rows (5 yield points per full generation)
- Each chunk (500 getHeightAt calls) runs as separate macrotask
- Zero RAF blocking - browser rendering pipeline presents frames between chunks
- **terrainGenVersionRef**: Monotonically-incrementing token cancels in-flight generation
- Only generation whose version still matches on completion writes to terrainOffscreenRef

#### Rotation via Canvas Transform
- Terrain only regenerates when PLAYER MOVES or ZOOM changes (not on rotation)
- Rotation handled by single canvas rotation transform (translate→rotate(+deltaYaw)→translate-back)
- **TERRAIN_OVERSHOOT** (√2 × 1.1 ≈ 1.555×) ensures canvas corners stay filled at any rotation angle
- **terrainCacheUpRef** stores cam.up.x/z when terrain cache is generated
- All worldToPx calls use snapshot values (overlayCenterX/Z, overlayExtent, overlayUpX/Z)

#### Road and Building Overlays
- Draw road paths from RoadNetworkSystem.getRoads as tan/beige vector strokes
- Draw building footprints from TownSystem.getTowns as rotated rectangles
- Correctly account for both building.rotation and camera up vector
- Cache road and building data lazily (never changes after world init)
- Cache 2D canvas contexts in refs (mainCtxRef/overlayCtxRef)

#### Performance Optimizations
- Reduce terrain sampling from W×H pixels to 50×50 grid (16× faster)
- Cache performance.now() once per frame
- Reuse terrain cache center object instead of allocating {x,z} each time
- Replace entity.serialize() with direct entity.data access in InterpolationEngine hot loop

### Agent System Improvements

#### Dynamic Combat Escalation
- **Monster Escalation**: Agents progress from goblins → bandits → barbarians as combat level grows
- **Combat Style Rotation**: Agents cycle attack → strength → defense (train lowest skill)
- **Combat Food Threshold**: Increased from 5 → 10 for better survival

#### Gear and Resource Progression
- **Cooking Phase**: Agents cook raw food immediately instead of waiting for full inventory
- **Gear Upgrade Phase**: Agents smith better equipment when they have materials + levels
- **World Data Manifest Loading**: Monster tiers and gear tiers loaded from world-data

#### Stability Fixes
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` crash in getEquippedWeaponTier that broke ALL agents every tick
- **LLM Error Fallback**: Idle + retry when agent has active goal instead of derailing to explore
- **Short-Circuit Dashboard Sync**: All agents show activity logs even when skipping LLM
- **Quest Goal Detection**: Added quest goal status change detection for proper quest lifecycle transitions
- **LLM Rate Limiting**: Exponential backoff for API calls (5s base, max 60s)
- **Consecutive Failure Tracking**: Resets on successful tick

### Duel System Stability

#### Combat Timing Improvements
- **Combat Retry Timer**: Aligned with tick system (3000ms = 5 ticks) for consistent timing
- **Phase Timeout**: Reduced grace periods from 30s to 10s for faster failure detection
- **Combat Stall Nudge**: Tracks last nudge timestamp instead of cycle ID to allow re-nudging when combat stalls again

#### Resource Management
- **Damage Event Cache**: Cleanup every tick (was every 2 ticks), cap lowered from 5000 to 1000, evict 75% when exceeded
- **Activity Logger Queue**: Max size 1000 with 25% eviction to prevent memory pressure
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS for zombie session cleanup
- **SessionCloseReason**: Added "timeout" to type for proper session termination tracking

### Streaming Pipeline Stability

#### Health Check and Buffer Management
- Fix health check vs data timeout mismatch (5s/15s instead of 10s/30s)
- Lower buffer multiplier from 4x to 2x (reduces backpressure buildup)
- Fix CDP session handler cleanup on recovery (recovery mode flag prevents double-handling)

#### Browser Restart and Encoding
- **Browser Restart**: Automatic browser restart every 45 minutes to prevent WebGPU OOM crashes
- **Stream Encoding Optimization**:
  - Default: `film` tune with B-frames for better compression
  - Set `STREAM_LOW_LATENCY=true` for `zerolatency` tune (faster playback start)
  - Configurable GOP size via `STREAM_GOP_SIZE` (default: 60 frames)
  - 2x bitrate buffer multiplier (reduced from 4x to prevent backpressure buildup)
  - Audio buffering with `thread_queue_size=1024` and async resampling
  - Health check timeout: 5s (data timeout: 15s) for faster failure detection
  - Resolution tracking and mismatch detection with automatic viewport recovery

### Test Stability Improvements

#### Timeout and Precision Fixes
- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`

#### E2E Journey Tests
- **Complete Journey Tests**: Full login→loading→spawn→walk gameplay tests in `complete-journey.spec.ts`
- **Screenshot Comparison**: Utilities to verify game is rendering correctly
- **Loading Screen Detection**: `waitForLoadingScreenHidden` helper for reliable test synchronization
- **Real Browser Testing**: Uses Playwright with actual WebGPU rendering (no mocks)

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### WebGPU Initialization Hangs

If WebGPU initialization hangs or times out:

1. **Check Browser Support**: Visit [webgpureport.org](https://webgpureport.org) to verify WebGPU is available
2. **Check GPU Drivers**: Ensure graphics drivers are up to date
3. **Check Chrome Flags**: Visit `chrome://gpu` to see GPU feature status
4. **Server Deployment**: Ensure NVIDIA GPU is accessible and Vulkan ICD is configured
5. **Timeout Logs**: Check console for "WebGPU adapter request timed out" or "WebGPU renderer initialization timed out"

For server deployments, see the Vast.ai Deployment Architecture section above for detailed GPU setup requirements.

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI assistant guidance
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
