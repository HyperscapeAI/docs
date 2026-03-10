# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

## CRITICAL: Secrets and Private Keys

**Never put private keys, seed phrases, API keys, tokens, RPC secrets, or wallet secrets into any tracked file.**

- ALWAYS use local untracked `.env` files for real secrets during development
- NEVER hardcode secrets in source, tests, docs, fixtures, scripts, config files, or GitHub workflow files
- NEVER place real credentials in `.env.example`; placeholders only
- Production and CI secrets must live in the platform secret manager, not in git
- If a new secret is required, add only the variable name to docs or `.env.example` and load the real value from `.env`, `.env.local`, or deployment secrets

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
- Safari 18+ (macOS 15+) - **Safari 17 support was removed**
- Firefox (behind flag, not recommended)
- Check WebGPU availability: [webgpureport.org](https://webgpureport.org)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED** - Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run non-headless** with Xorg or Xvfb (WebGPU requires window context)
- **Chrome Beta Channel**: Use `google-chrome-beta` for WebGPU streaming (better stability than Dev/Canary)
- **ANGLE Backend**: Use default ANGLE backend (`--use-angle=default`), NOT native Vulkan
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults
- If GPU cannot initialize WebGPU, deployment MUST FAIL (no soft fallbacks)

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

# Full duel stack (game + agents + streaming)
bun run duel

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
bun run dev:ai          # Game + ElizaOS agents
bun run dev:forge       # AssetForge tools
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
│   ├── PostgreSQL persistence (connection pool: 20)
│   ├── LiveKit voice chat integration
│   ├── Streaming duel scheduler
│   └── Duel arena oracle publisher
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   ├── UI/HUD
│   └── Streaming entry points (stream.html)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── contracts/           # MUD onchain game state (experimental)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation + VFX catalog
└── docs-site/           # Docusaurus documentation site
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet). The duel arena oracle remains in Hyperscape for verifiable outcome publishing.

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
bun run dev:ai     # Game + ElizaOS agents
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
bun run duel       # Full duel stack (game + agents + streaming)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | (hardcoded) | `bun run dev:ai` |
| 5555 | Game Server | `PORT` | `bun run dev` |

**Note**: The betting app (port 4179) and keeper API have been moved to the [hyperbet repository](https://github.com/HyperscapeAI/hyperbet).

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Secret handling is non-negotiable**:
- Real private keys and API tokens must come from local untracked `.env` files
- Tracked files may only contain placeholders and variable names
- If you find a real credential in a tracked file, remove it and move it to `.env` or the deployment secret store immediately

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker), streaming, oracle |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent configuration |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# PostgreSQL Connection Pool (increased March 2026)
POSTGRES_POOL_MAX=20             # Default: 20 (up from 10)
POSTGRES_POOL_MIN=2              # Default: 2

# ElizaCloud AI (for duel arena agents)
ELIZAOS_CLOUD_API_KEY=...        # Single key for 13 frontier models

# Streaming (optional) - auto-detected from available keys
TWITCH_STREAM_KEY=...            # or TWITCH_RTMP_STREAM_KEY
KICK_STREAM_KEY=...
YOUTUBE_STREAM_KEY=...           # or YOUTUBE_RTMP_STREAM_KEY
STREAM_ENABLED_DESTINATIONS=...  # Auto-detected if not set

# Streaming Capture Configuration
STREAM_CAPTURE_MODE=cdp               # CDP (Chrome DevTools Protocol) for reliability
STREAM_CAPTURE_CHANNEL=chrome-beta    # Chrome Beta for stability
STREAM_CAPTURE_ANGLE=default          # Default ANGLE backend
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
DISPLAY=:99                           # Xvfb virtual display

# Database Mode (auto-detected from DATABASE_URL)
DUEL_DATABASE_MODE=remote        # or local (auto-detected)

# CDN Configuration (unified)
PUBLIC_CDN_URL=https://assets.hyperscape.club  # Production CDN (used everywhere)

# Oracle (optional)
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=...

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
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon/Railway), Docker (local)
- **Testing**: Playwright, Vitest 4.x (upgraded from 2.x for Vite 6 compatibility)
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor 8.2.0
- **AI Agents**: ElizaOS `alpha` packages with InMemoryDatabaseAdapter (no PGLite)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Icons**: Lucide React 0.577.0
- **3D Utilities**: three-mesh-bvh 0.9.9

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Bundle Size Warnings:**

The client and asset-forge packages have increased `chunkSizeWarningLimit` to suppress warnings for intentionally large WebGPU/PhysX bundles:

- `packages/client/vite.config.ts`: 8000 KB (up from 2000 KB) - WebGPU/PhysX bundles
- `packages/asset-forge/vite.config.ts`: 9000 KB (new) - Asset tooling with WebGPU

These limits are intentional until deeper code splitting is implemented. The large bundles are due to:
- Three.js WebGPU renderer and TSL shader system
- PhysX WASM bindings
- Asset processing tools (GLB decimation, impostor baking, etc.)

**Tech Debt**: Track deeper code splitting as future optimization to reduce initial bundle size.

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
lsof -ti:4001 | xargs kill -9  # ElizaOS API
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### Agent Memory Issues

If agents are consuming excessive memory:
- Check that InMemoryDatabaseAdapter is being used (not PGLite)
- Verify memory caps are in place (50 memories per agent, 20 adapter logs, 100 cache entries)
- Monitor periodic GC is running (every 60s)
- Check DB connection pool isn't exhausted (max 5 concurrent bank queries)

### Database Connection Pool Exhaustion

If seeing "timeout exceeded when trying to connect" errors:
- **PostgreSQL connection pool increased to 20** (March 2026, commit 24fa8a5)
- Increase serverless PG pool max if needed (default: 20)
- Increase connection timeout (default: 60s)
- Enable concurrency limiting for bank queries (max 5)
- Stagger agent refresh intervals to distribute load

### CSRF 403 Errors

If account creation fails with "CSRF validation failed" (403) when running client on localhost against a deployed server:
- Ensure `UsernameSelectionScreen` includes Privy auth token in Authorization header (fixed in commit 0b1a0bd)
- Verify CSRF middleware allows localhost/private IP origins
- Check that client's `api-client.ts` accepts both `{ token }` and `{ csrfToken }` response formats

### Streaming Issues

If RTMP streaming fails to start:
- Verify stream keys are set: `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, `YOUTUBE_STREAM_KEY`
- Check `STREAM_ENABLED_DESTINATIONS` is set or auto-detected
- Ensure FFmpeg is installed: `which ffmpeg` or set `FFMPEG_PATH`
- Verify Playwright Chromium is installed: `bunx playwright install chromium`
- Check GPU display driver is active (Vast.ai: `gpu_display_active=true`)
- Verify Chrome Beta is installed: `google-chrome-beta --version`
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment variable: `echo $DISPLAY` (should be `:99`)
- Review logs: `bunx pm2 logs hyperscape-duel`

### CDN Asset Loading Issues

If assets fail to load in production streaming deployments:
- Verify `PUBLIC_CDN_URL` is set to production CDN (not localhost)
- Default: `https://assets.hyperscape.club`
- Check `ecosystem.config.cjs` has correct CDN URL
- Ensure CDN is accessible from deployment environment

## Recent Changes (March 2026)

### Three.js 0.183.2 Upgrade (March 10, 2026)

**Change** (Commit 8b93772): Upgraded Three.js from 0.182.0 to 0.183.2 across all packages.

**Breaking Changes**:
- **TSL API Change**: `atan2` renamed to `atan` in TSL exports
- **Type Compatibility**: Updated TSL typed node aliases (TSLNodeFloat/Vec2/Vec3/Vec4)
- **InstancedBufferAttribute**: Fixed type cast in HealthBars system

**Files Changed**:
- `packages/shared/src/materials/LeafMaterialTSL.ts` - Updated `atan2` → `atan`
- `packages/shared/src/extras/three/three.ts` - Added TSL typed node aliases
- `packages/shared/src/systems/client/HealthBars.ts` - Fixed instancedBufferAttribute type cast
- All `package.json` files - Updated three to 0.183.2 and @types/three to 0.183.1

**Migration Notes**:
```typescript
// Old (0.182.0)
import { atan2 } from 'three/tsl';

// New (0.183.2)
import { atan } from 'three/tsl';
```

**Impact**: 
- Latest Three.js features and bug fixes
- Improved WebGPU performance and stability
- Better TSL shader compilation
- Required for future Three.js ecosystem compatibility

### Streaming Pipeline Optimization (March 10, 2026)

**Change** (Commits c0e7313, 796b61f): Major streaming pipeline overhaul with CDP default, default ANGLE backend, and FFmpeg improvements.

**Key Changes**:
- **Default Capture Mode**: CDP (Chrome DevTools Protocol) everywhere for reliability
- **Chrome Beta Channel**: Switched from Chrome Unstable to Chrome Beta for better stability
- **ANGLE Backend**: Default ANGLE backend (`--use-angle=default`) for cross-platform compatibility
- **FFmpeg Resolution**: Prefer system ffmpeg (`/usr/bin`, `/usr/local/bin`) over ffmpeg-static to avoid segfaults
- **x264 Tuning**: Default to `zerolatency` tune for live streaming (was `film`)
- **GOP Size**: Set to 30 frames (1s at 30fps) to match HLS segment boundaries
- **MediaRecorder Chunks**: Tighter chunking for lower latency
- **Dead Code Removal**: Deleted `dev-final.mjs` (875 lines), removed `SERVER_DEV_LEAN_MODE` system
- **Playwright Fix**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering

**ANGLE Backend Selection**:
```bash
# Default (auto-select) - RECOMMENDED
STREAM_CAPTURE_ANGLE=default
--use-angle=default

# macOS (explicit)
STREAM_CAPTURE_ANGLE=metal
--use-angle=metal

# Linux NVIDIA (explicit, if default fails)
STREAM_CAPTURE_ANGLE=vulkan
--use-angle=vulkan --enable-features=DefaultANGLEVulkan,Vulkan,VulkanFromANGLE
```

**Why Default ANGLE Backend**:
- Automatically selects best backend (Vulkan, OpenGL, or D3D11) for the system
- Better compatibility across different GPU configurations and driver versions
- Reduces rendering artifacts and crashes from incompatible drivers
- Simpler configuration - no platform-specific logic needed

**FFmpeg Improvements**:
```bash
# Resolution order (avoids ffmpeg-static segfaults)
/usr/bin/ffmpeg → /usr/local/bin/ffmpeg → PATH → ffmpeg-static
```

**Configuration**:
```bash
# Capture mode
STREAM_CAPTURE_MODE=cdp  # Default: CDP for reliability

# Chrome channel
STREAM_CAPTURE_CHANNEL=chrome-beta  # Chrome Beta for stability

# ANGLE backend
STREAM_CAPTURE_ANGLE=default  # Auto-select (recommended)

# x264 encoding
x264_tune=zerolatency  # Live streaming (was film)
gop_size=30           # 1s segments at 30fps
```

**Files Changed**:
- `packages/server/scripts/stream-to-rtmp.ts` - ANGLE backend logic, FFmpeg resolution
- `scripts/duel-stack.mjs` - Updated default capture mode and ANGLE backend
- `ecosystem.config.cjs` - STREAM_CAPTURE_ANGLE=default
- `scripts/deploy-vast.sh` - Chrome Beta installation
- `playwright.config.ts` - Updated DEFAULT_LINUX_WEBGPU_ARGS
- `packages/shared/src/utils/rendering/RendererFactory.ts` - Prefer high-performance GPU adapter

**Impact**: 
- More reliable streaming across diverse GPU hardware
- Lower latency with zerolatency tune
- Eliminates FFmpeg segfaults
- Better HLS segment alignment
- Fewer crashes and rendering artifacts

### Physics Optimization for Streaming (March 10, 2026)

**Change** (Commit c0e7313): Skip client-side PhysX initialization for streaming/spectator viewports.

**Rationale**: Streaming and spectator clients don't need physics simulation - they only render the world state. Skipping PhysX reduces memory usage and startup time.

**Detection Logic**:
```typescript
// packages/shared/src/runtime/clientViewportMode.ts
isStreamingLikeViewport(window) // true for stream or spectator modes
```

**Impact**: 
- Faster streaming client startup
- Reduced memory footprint for spectator views
- No physics overhead for non-interactive clients

### Camera Fallback for Empty Streaming Worlds (March 10, 2026)

**Change** (Commit 93cac36): Added arena lobby fallback camera position when no entities exist in streaming mode.

**Problem**: Streaming clients with empty world states showed a black void instead of the arena.

**Solution**: `ClientCameraSystem` now defaults to arena lobby position `(0, 5, 10)` when no entities are present in streaming mode.

**Impact**: Streaming always shows the arena instead of a black screen during initialization or between duels.

### Service Worker Cache Strategy (March 10, 2026)

**Change** (Commit 796b61f): Switched Workbox caching from `CacheFirst` to `NetworkFirst` for JS/CSS.

**Problem**: Stale service worker serving old HTML for JS chunks after rebuild, causing module loading errors.

**Solution**: 
- `NetworkFirst` strategy for JS/CSS - always fetch latest, fallback to cache
- Aggressive cache clearing for local dev (clears `workbox-*` and `hyperscape-*` caches)

**Impact**: 
- Eliminates stale module errors after rebuilds
- Better dev experience with hot reload
- Production still benefits from cache fallback

### WebGPU Feature Flags (March 10, 2026)

**Change** (Commit 796b61f, 93cac36): Updated Chrome WebGPU feature flags for better compatibility.

**Added Flags**:
- `UnsafeWebGPU` - Enable WebGPU in non-secure contexts (dev/testing)
- `WebGPUDeveloperFeatures` - Enable developer features for debugging
- Removed `UseSkiaRenderer` - Conflicts with WebGPU (causes "Instance dropped" errors)

**Removed Flags**:
- `--disable-gpu-sandbox` - Not needed for working Chrome
- `--enable-webgl` - Irrelevant for WebGPU-only rendering
- `--disable-field-trial-config` - Blocks GPU feature config propagation

**Configuration**:
```bash
# Chrome flags for WebGPU streaming
--enable-features=WebGPU,UnsafeWebGPU,WebGPUDeveloperFeatures
--enable-gpu-service-logging  # Better GPU debugging
```

**Impact**: 
- More reliable WebGPU initialization
- Better error messages for GPU issues
- Eliminates "Instance dropped" device-lost errors

### CDN URL Unification (March 10, 2026)

**Change** (Commit 2173086): Replaced `DUEL_PUBLIC_CDN_URL` with unified `PUBLIC_CDN_URL` environment variable.

**Rationale**: Simplifies CDN configuration by using a single environment variable across all contexts instead of separate duel-specific and general CDN URLs.

**Configuration**:
```bash
# Old (deprecated)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club

# New (unified)
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

**Files Changed**:
- `scripts/deploy-vast.sh` - Updated to use `PUBLIC_CDN_URL`
- `packages/server/.env.example` - Updated documentation
- All deployment scripts and configurations

**Impact**: 
- Cleaner environment variable naming
- Consistent CDN URL across client, server, and streaming contexts
- Reduces configuration complexity
- Easier to understand and maintain

### Chrome Swiftshader Rendering Block Fix (March 10, 2026)

**Change** (Commit 7c16937): Fixed Playwright injecting `--enable-unsafe-swiftshader` flag which forces CPU software rendering and blocks WebGPU compositor pipeline.

**Problem**: Playwright's default args include `--enable-unsafe-swiftshader`, forcing Chrome to use CPU-based software rendering instead of GPU acceleration. This sabotages the WebGPU compositor pipeline and causes rendering failures.

**Solution**: Use `ignoreDefaultArgs: ['--enable-unsafe-swiftshader']` in Playwright browser launch configuration to prevent Playwright from injecting this flag.

**Additional Fix**: Added explicit FFmpeg cleanup in script teardown to prevent stale ffmpeg processes from blocking Twitch/Kick RTMP connections between restarts.

**Files Changed**:
- `packages/server/src/streaming/browser-capture.ts` - Added `ignoreDefaultArgs` to Playwright launch config
- `packages/server/src/streaming/rtmp-bridge.ts` - Added FFmpeg process cleanup on teardown

**Impact**: 
- Enables proper GPU-accelerated WebGPU rendering in Playwright-launched Chrome instances
- Prevents RTMP connection failures from zombie FFmpeg processes
- Critical for streaming capture on Vast.ai GPU instances

### Dependency Updates (March 10, 2026)

**Major Updates**:
- **Capacitor**: 7.6.0 → 8.2.0 (Android, iOS, Core)
- **lucide-react**: → 0.577.0 (icon library)
- **three-mesh-bvh**: 0.8.3 → 0.9.9 (BVH acceleration)
- **eslint**: → 10.0.3 (linting)
- **jsdom**: → 28.1.0 (testing)
- **@ai-sdk/openai**: → 3.0.41 (AI SDK)
- **hardhat**: → 3.1.11 (smart contracts)
- **@nomicfoundation/hardhat-chai-matchers**: → 3.0.0 (testing)
- **globals**: → 17.4.0 (TypeScript globals)

**Impact**:
- Latest mobile platform features (Capacitor 8.2.0)
- Improved icon library with new icons
- Better BVH performance for collision detection
- Latest linting rules and TypeScript support
- Bug fixes and security updates

### WebSocket Connection Stability (March 10, 2026)

**Change** (Commit 3b4dc66): Fixed WebSocket disconnects under load.

**Problem**: WebSocket connections dropping under high load from concurrent agent queries and player actions.

**Solution**: Improved connection health monitoring and error handling in WebSocket layer.

**Impact**: More stable multiplayer connections during high-load scenarios (many agents, busy servers).

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions and feature documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- [docs/duel-stack.md](docs/duel-stack.md) - Duel stack documentation
- [docs/duel-arena-oracle-deploy.md](docs/duel-arena-oracle-deploy.md) - Oracle deployment guide
- [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) - Betting stack (separate repository)
- Game Design Document: See `.cursor/rules/gdd.mdc`
