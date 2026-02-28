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
- Safari 18+ (macOS 15+) - Safari 17 support removed
- Firefox (behind flag, not recommended)
- Check: [webgpureport.org](https://webgpureport.org)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Vulkan support is REQUIRED**
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- Chrome uses ANGLE/Vulkan backend to access WebGPU
- If GPU cannot initialize WebGPU, deployment MUST FAIL (no soft fallbacks)

#### Vast.ai Deployment Architecture

The streaming pipeline requires specific GPU setup. See `scripts/deploy-vast.sh` for implementation.

**GPU Rendering Modes** (tried in order):

1. **Xorg with NVIDIA** (preferred):
   - Best performance with direct GPU access
   - Requires DRI/DRM device access (`/dev/dri/card0`)
   - Uses NVIDIA Xorg driver with headless configuration
   - Validates GPU rendering (not software fallback)

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer provides X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures frames from Chrome's internal GPU rendering
   - Works in containers without DRM access

3. **Headless mode**: NOT SUPPORTED
   - WebGPU requires a display server
   - Deployment fails if neither Xorg nor Xvfb can start

**Audio Capture**:
- PulseAudio with `chrome_audio` virtual sink
- FFmpeg captures from PulseAudio monitor (`chrome_audio.monitor`)
- Configurable via `STREAM_AUDIO_ENABLED` and `PULSE_AUDIO_DEVICE`
- User-mode PulseAudio (more reliable than system mode)

**RTMP Multi-Streaming**:
- Simultaneous streaming to Twitch, Kick, X/Twitter
- FFmpeg tee muxer for single-encode multi-output
- Stream keys configured via environment variables
- YouTube explicitly disabled (set `YOUTUBE_STREAM_KEY=""`)

**Deployment Validation**:
- Verifies NVIDIA GPU accessible via `nvidia-smi`
- Checks Vulkan ICD availability
- Ensures display server (Xorg/Xvfb) responds to `xdpyinfo`
- Fails deployment if WebGPU cannot be initialized
- Persists GPU/display settings to `.env` for PM2 restarts

**Environment Variables** (auto-configured by deploy script):
```bash
DISPLAY=:99                                              # X display
GPU_RENDERING_MODE=xorg|xvfb-vulkan                     # Rendering mode
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json # Force NVIDIA Vulkan
DUEL_CAPTURE_USE_XVFB=true|false                        # Xvfb vs Xorg
STREAM_CAPTURE_HEADLESS=false                           # Always false (WebGPU requires display)
STREAM_CAPTURE_USE_EGL=false                            # EGL vs ANGLE (always false for WebGPU)
STREAM_GOP_SIZE=60                                      # GOP size in frames (default: 60)
DUEL_USE_PRODUCTION_CLIENT=true                         # Use pre-built client for faster loads
XDG_RUNTIME_DIR=/tmp/pulse-runtime                      # PulseAudio runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native       # PulseAudio socket
```

**Secrets Management** (BREAKING CHANGE):
All stream keys must be set via environment variables - hardcoded secrets removed:
```bash
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
X_STREAM_KEY=...
YOUTUBE_STREAM_KEY=""  # Explicitly disabled
```

**Production Client Build**:
- When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
- Serves pre-built client via `vite preview` instead of dev server
- Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
- Significantly faster page loads for streaming (no on-demand module compilation)
- Page navigation timeout increased to 180s for Vite dev mode compatibility

**Stream Capture Enhancements**:
- 5s timeout on probe evaluate calls to prevent hanging
- Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)
- Resolution tracking with automatic viewport recovery on mismatch
- WebGPU diagnostics (`captureGpuDiagnostics()`) extract chrome://gpu info at startup
- Preflight test (`testWebGpuInit()`) detects WebGPU hangs before loading game content

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
│   ├── PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

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
- **Database**: PostgreSQL (production), Docker (local)
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

### WebGPU Not Available

Hyperscape requires WebGPU - WebGL will NOT work. If you see WebGPU errors:

1. **Check browser version**:
   - Chrome 113+ (recommended)
   - Edge 113+
   - Safari 18+ (macOS 15+) - Safari 17 support removed
   - Verify at [webgpureport.org](https://webgpureport.org)

2. **Enable hardware acceleration**:
   - Chrome: `chrome://settings` → System → "Use hardware acceleration"
   - Safari: Preferences → Advanced → "Show Develop menu" → Develop → Experimental Features → "WebGPU"

3. **Update GPU drivers**:
   - NVIDIA: [nvidia.com/drivers](https://nvidia.com/drivers)
   - AMD: [amd.com/support](https://amd.com/support)
   - Intel: [intel.com/content/www/us/en/download-center](https://intel.com/content/www/us/en/download-center)

4. **Check for WebView restrictions**:
   - Some WebViews (Electron, Tauri) may block WebGPU
   - Ensure WebGPU is enabled in WebView configuration

5. **BREAKING CHANGE - WebGL Removed**:
   - All WebGL fallback code has been removed (commit 47782ed)
   - `RendererFactory` no longer detects or supports WebGL
   - `--disable-webgpu` and `forceWebGL` flags are ignored
   - Deployment fails if WebGPU cannot initialize (no soft fallbacks)

### Streaming Issues (Vast.ai)

If streaming fails to start or produces black frames:

1. **Check GPU access**:
   ```bash
   nvidia-smi  # Should show GPU info
   vulkaninfo --summary  # Should show Vulkan support
   ```

2. **Verify display server**:
   ```bash
   echo $DISPLAY  # Should be :99 or :0
   xdpyinfo -display $DISPLAY  # Should show display info
   ```

3. **Check PulseAudio**:
   ```bash
   pulseaudio --check  # Should exit silently if running
   pactl list short sinks  # Should show chrome_audio sink
   ```

4. **Review deployment logs**:
   ```bash
   bunx pm2 logs hyperscape-duel --lines 200
   ```

5. **Check RTMP status**:
   ```bash
   cat /root/hyperscape/packages/server/public/live/rtmp-status.json
   ```

6. **Common issues**:
   - **Black frames**: Display server not running or WebGPU failed to initialize
   - **No audio**: PulseAudio not running or `chrome_audio` sink missing
   - **Resolution mismatch**: Viewport size doesn't match stream dimensions
   - **Timeout on page load**: Use production client build (`NODE_ENV=production`)

## Performance Optimizations

### Instanced Rendering

Hyperscape uses GPU instancing to render thousands of resource entities (rocks, ores, herbs, trees) with minimal draw calls.

**Architecture:**
- **GLBResourceInstancer**: Pools instances by model path, separate `InstancedMesh` per LOD level
- **GLBTreeInstancer**: Specialized instancer for tree resources with dissolve materials
- **InstancedModelVisualStrategy**: Thin wrapper with invisible collision proxies for raycasting
- **StandardModelVisualStrategy**: Fallback for non-instanced rendering

**Benefits:**
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis to prevent flickering
- Supports depleted models (stumps, empty rocks) with separate instance pools
- Highlight mesh support for hover/selection effects

**Implementation:**
```typescript
// packages/shared/src/visual/strategies/InstancedModelVisualStrategy.ts
// packages/shared/src/visual/instancers/GLBResourceInstancer.ts
// packages/shared/src/visual/instancers/GLBTreeInstancer.ts
```

**Configuration:**
- Instancing is enabled by default for all resource entities
- Falls back to `StandardModelVisualStrategy` if instancing fails
- LOD distances and hysteresis configurable per instancer

**Depleted Models:**
- Resources can specify `depletedModelPath` and `depletedModelScale` in config
- Instancer maintains separate pools for normal and depleted states
- Automatic transition on resource depletion (e.g., tree → stump)
- Collision proxy persists across state transitions
- Highlight mesh support for hover/selection on instanced entities

**API Changes (BREAKING):**
- `ResourceVisualStrategy.onDepleted()` now returns `Promise<boolean>`
  - `true` = strategy handled depletion (instanced stump)
  - `false` = ResourceEntity should load individual depleted model
- New optional method: `getHighlightMesh(ctx): THREE.Object3D | null`
  - Returns positioned mesh for outline pass on instanced entities
- `ResourceEntity.getHighlightRoot()` returns highlight mesh for instanced entities
- `EntityHighlightService` supports instanced highlight via `getHighlightRoot()`

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
