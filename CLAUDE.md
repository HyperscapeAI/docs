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
- WebGPU must be available and working
- Check: [webgpureport.org](https://webgpureport.org)

### WebGPU Initialization
- **Adapter Request Timeout**: 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- **Renderer Init Timeout**: 60s timeout on `renderer.init()` to detect GPU driver issues
- **Preflight Testing**: `testWebGpuInit()` runs on blank page before loading game content
- **GPU Diagnostics**: `captureGpuDiagnostics()` extracts chrome://gpu info for debugging
- Timeouts help diagnose misconfigured GPU servers where WebGPU initialization hangs

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
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: [\"^build\"]`.

> **TODO(AUDIT-004): CIRCULAR DEPENDENCY - shared ↔ procgen**
>
> There is a circular dependency between `@hyperscape/shared` and `@hyperscape/procgen`.
> - shared imports procgen for vegetation/terrain generation
> - procgen imports shared for TileCoord type in viewers
>
> **Current workaround**: procgen build ignores TypeScript errors.
>
> **Recommended fix**: Extract shared types to `@hyperscape/types` package:
> - Create new package with only type definitions (no runtime code)
> - Both shared and procgen depend on types (no circular dep)
> - Move TileCoord, Position3D, EntityData to types package

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

### Resource Management
- **Activity Logger Queue**: Max size 1000 with 25% eviction to prevent memory pressure
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS for zombie session cleanup
- **SessionCloseReason**: Added "timeout" to type for proper session termination tracking

### Streaming Stability
- **Browser Restart**: Reduced from 1 hour to 45 minutes to prevent WebGPU OOM crashes
- **Health Check Timeout**: 5s (data timeout: 15s) for faster failure detection
- **Buffer Multiplier**: Lowered from 4x to 2x to reduce backpressure buildup
- **CDP Session Recovery**: Fixed handler cleanup on recovery (recovery mode flag prevents double-handling)

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
