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
- Safari 18+ (macOS 15+) - Safari 17 support was removed
- Firefox (behind flag, not recommended)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- **Chrome Beta Channel**: Use `google-chrome-beta` (Chrome Beta) for WebGPU streaming on Linux NVIDIA (best stability and WebGPU support)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
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
├── server/              # Game server (Fastify + uWebSockets.js)
│   ├── World management
│   ├── SQLite/PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── procgen/             # Procedural generation (terrain, biomes, vegetation)
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
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

**Important**: Despite references to \"Hyperscape apps (.hyp)\" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

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

- No TODOs or \"will fill this out later\" - implement completely
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
| 5555 | Game Server (HTTP) | `PORT` | `bun run dev` |
| 5556 | Game Server (WebSocket) | `UWS_PORT` | `bun run dev` |
| 4001 | ElizaOS API | `ELIZA_PORT` | `bun run dev:ai` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Secret handling is non-negotiable**:
- Real private keys and API tokens must come from local untracked `.env` files
- Tracked files may only contain placeholders and variable names
- If you find a real credential in a tracked file, remove it and move it to `.env` or the deployment secret store immediately

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
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket (port 5556)
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server
- WebSocket port is 5556 (uWebSockets.js), not 5555 (HTTP)

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager and runtime for client/build tasks.

**Server Runtime**: Node.js 22+ (migrated from Bun in March 2026 for V8 incremental GC)

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: 
  - **Client/Build**: Bun v1.3.10+ (upgraded from 1.1.38 for Vite 6+ compatibility)
  - **Server**: Node.js 22+ (migrated from Bun for V8 incremental GC - March 2026)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0, Tailwind CSS 3.4.19
- **Server**: Fastify (HTTP), uWebSockets.js (game WebSocket), LiveKit (voice)
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

## Recent Changes (April 2026)

### Client Auth Configuration (April 7, 2026)

**Change** (Commit ebbb9ed): Resolve auth config from runtime environment instead of build-time.

**Problem**: Client auth configuration was baked into the build at compile time, making it impossible to change Privy App ID without rebuilding the entire client bundle.

**Fix**: Auth config now resolves from runtime environment via `window.ENV` object populated by `/env.js` endpoint.

**Impact**: 
- Production deployments can update auth configuration without rebuilding client
- Better separation between build-time and runtime configuration
- Simplified deployment workflow for auth provider changes

### Docker Runtime Migration (April 7, 2026)

**Change** (Commit 4fd1d44): Use Debian Trixie runtime for uWebSockets.js compatibility.

**Problem**: uWebSockets.js requires GLIBC ≥ 2.38, which is not available in Debian Bookworm (GLIBC 2.36).

**Fix**: Switched Docker runtime from `node:22-bookworm-slim` to `node:22-trixie-slim` to provide GLIBC 2.38+ for uWebSockets.js native bindings.

**Impact**: 
- Production Docker images now support uWebSockets.js for high-performance WebSocket handling
- Enables 50+ concurrent players with 25+ AI agents (from March 2026 performance overhaul)
- Required for production deployment with uWS-based networking

**Configuration**:
```dockerfile
FROM node:22-trixie-slim AS runtime
```

### Production Runtime Defaults (April 5-6, 2026)

**Change** (Commits ba7f6f4-bc647e3): Restored Railway deployment targets and production API defaults.

**Key Changes**:
- **Production Defaults**: Server defaults to `hyperscape.gg` for production runtime URLs
- **Railway Targets**: Restored Railway deployment configuration for dev/prod environments
- **Local WebSocket**: Fixed local development to use correct WebSocket defaults (port 5556)
- **Agent Runtime**: ElizaOS agents use local Hyperscape uWS defaults for connection

**Impact**: 
- Simplified production deployment (fewer env vars needed)
- Better separation between local dev and production environments
- AI agents connect correctly to local game server during development
- Production deployments work out-of-the-box with hyperscape.gg

### CI/CD Infrastructure Upgrades (April 6, 2026)

**Change** (Commits 15e62b9-9d45fae): Upgraded GitHub Actions workflows to Node.js 24 runners.

**Key Changes**:
- Updated all GitHub Actions to use `node24` runners for improved performance
- Fixed workflow token usage for Claude review automation
- Removed unused Foundry installations from CI pipeline to reduce build times
- Switched Docker builds to use real Node.js instead of Bun for Vite builds (better stability)

**Impact**: 
- Faster CI builds with latest GitHub runner infrastructure
- More reliable Docker image builds with Node.js-based Vite compilation
- Reduced CI complexity and build times
- Better automation workflow reliability

### Docker Build Fixes (April 6, 2026)

**Change** (Commits fca9ffb-cb237b6): Fixed Docker build failures and CI pipeline issues.

**Key Changes**:
- **Defensive Directory Creation**: Added `mkdir -p` for `packages/web3/node_modules` and `packages/client/node_modules` to prevent COPY failures when Bun hoists deps without materializing per-package node_modules
- **Empty Downloads Handling**: Fixed CI pipeline to handle empty download artifacts gracefully
- **Railway Auth Drift**: Resolved Railway authentication drift issues in deployment pipeline
- **Node.js for Vite**: Switched Docker builds to use real Node.js for Vite builds instead of Bun's Node compatibility shim

**Implementation** (`Dockerfile.server`):
```dockerfile
# Bun may hoist workspace deps without materializing per-package node_modules.
# Create every runtime COPY source explicitly so missing dirs don't break builds.
RUN mkdir -p \
    packages/server/node_modules \
    packages/shared/node_modules \
    packages/procgen/node_modules \
    packages/impostors/node_modules \
    packages/plugin-hyperscape/node_modules \
    packages/web3/node_modules \
    packages/client/node_modules
```

**Impact**: 
- Reliable Docker image builds across all environments
- No more missing node_modules directory errors
- Improved CI/CD stability
- Production deployments work consistently

### Tailwind CSS Stabilization (April 2026)

**Change** (PR #1105, subsequent updates): Tailwind CSS build pipeline stabilization.

**Timeline**:
- April 4: Temporarily rolled back to Tailwind v3.4.19 due to production artifact issues with v4
- Current: Stable on Tailwind v3.4.19 with standard PostCSS pipeline

**Current State** (Tailwind v3.4.19):
- Uses standard PostCSS pipeline with `tailwindcss` plugin
- Stable CSS generation across all build environments
- Consistent auth and character screen styling in production Docker images
- All critical utilities (inset-0, gap-2, p-6, bg-black/80, shadow-2xl) reliably generated

**Configuration** (`packages/client/postcss.config.js`):
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Impact**: 
- Consistent CSS output across development and Docker production builds
- No more missing utility classes in production
- Stable build pipeline for deployment
- Reliable auth and character screen styling

## Recent Changes (March 2026)

### UI Panel Tooltip System (March 27, 2026)

**Change** (PR #1102): Unified tooltip styling across all UI panels.

**Features**: Centralized tooltip style utilities for consistent appearance across inventory, equipment, bank, spells, prayer, skills, trade, store, and loot panels.

**New Module**: `packages/client/src/ui/core/tooltip/tooltipStyles.ts`

**Key Functions**:
```typescript
getTooltipTitleStyle(theme, accentColor?)  // Title text styling
getTooltipMetaStyle(theme)                 // Metadata/secondary text
getTooltipBodyStyle(theme)                 // Body content
getTooltipDividerStyle(theme, accentColor?) // Section dividers
getTooltipTagStyle(theme)                  // Tag/badge styling
getTooltipStatusStyle(theme, tone)         // Status indicators (success/danger/warning)
```

**Usage Example**:
```typescript
import { getTooltipTitleStyle, getTooltipMetaStyle } from '@/ui/core/tooltip/tooltipStyles';

<CursorTooltip visible={true} position={hoverState}>
  <div style={getTooltipTitleStyle(theme)}>
    {itemName}
  </div>
  <div style={getTooltipMetaStyle(theme)}>
    {itemDescription}
  </div>
</CursorTooltip>
```

**Impact**: 
- Consistent tooltip appearance across all UI panels
- Eliminated ~500 lines of duplicated styling code
- Better visual hierarchy and readability
- Easier to maintain and update tooltip styles globally

### Tree Dissolve Transparency (March 27, 2026)

**Change** (PR #1101): Added screen-door dithered dissolve for depleted trees.

**Features**: Depleted trees become ~70% transparent instantly on depletion and animate back to full opacity over 0.3s on respawn.

**New Module**: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

**Key APIs**:
```typescript
// Start or instantly apply a dissolve animation
startDissolve(anims, entityId, direction, instant, applyFn)

// Advance all active dissolve animations by deltaTime
tickDissolveAnims(anims, deltaTime, applyFn)
```

**Configuration** (`GPU_VEG_CONFIG` in `GPUMaterials.ts`):
```typescript
DISSOLVE_DURATION: 0.3      // Animation duration (seconds)
DISSOLVE_MAX: 1.0           // Max dissolve progress
DISSOLVE_ALPHA_SCALE: 0.7   // Fraction of fragments discarded
```

**Implementation Details**:
- **Encoding**: Blue channel of batch color encodes `1.0 - dissolveVal` (BatchedMesh), or dedicated `instanceDissolve` attribute (InstancedMesh)
- **Dithering**: Uses Bayer 4×4 screen-door dithering in `alphaTestNode` to discard fragments
- **Opaque Pass**: Trees stay in opaque render pass (no transparency sorting overhead)
- **LOD Preservation**: Dissolve state carries over during LOD transitions to prevent visual pops
- **Atomic Initial State**: `initialDissolve` parameter on `addInstance()` prevents 1-frame flash

**Impact**: 
- Visual feedback for resource depletion/respawn
- Stays in opaque render pass (no transparency sorting overhead)
- Smooth LOD transitions without visual pops
- Eliminates ~60 lines of duplication between instancer files

### Tree Collision Proxy (March 27, 2026)

**Change** (PR #1100): Use LOD2 model geometry for tree collision instead of oversized cylinder.

**Problem**: Cylinder hitbox (0.4 radius factor) was too large, intercepting ground clicks near trees.

**Fix**: Use actual LOD2 mesh geometry for pixel-accurate collision. Falls back to tighter cylinder (0.25 radius) if LOD unavailable.

**New APIs**:
```typescript
// GLBTreeInstancer.ts, GLBTreeBatchedInstancer.ts
getProxyGeometry(entityId): { geometries, yOffset } | null
clearProxyGeometryCache(): void  // Call during world teardown
```

**Implementation**:
```typescript
// Merge multi-part geometries (bark + leaves) into single proxy
const merged = mergeGeometries(sourceGeometries);
const scaled = merged.clone();
scaled.scale(scale, scale, scale);
scaled.computeBoundingBox();
scaled.computeBoundingSphere();
```

**Caching Strategy**:
- Cache merged+scaled proxy geometry per `(sourceGeometries, scale)` tuple
- Avoids redundant merge/clone/scale work for trees sharing same model variant and scale
- Cache cleared on world teardown via `clearProxyGeometryCache()`

**Impact**: 
- Clicks only register on visible tree silhouette
- Ground clicks near trees work correctly
- Cached geometry reduces CPU overhead
- Memory-efficient (shared geometry references)

### Resource Respawn System (March 27, 2026)

**Change** (PR #1099): Made resource respawn purely tick-based, use manifest `depleteChance` for mining.

**Problem**: `setTimeout`-based respawn was non-deterministic. Mining used hardcoded `MINING_DEPLETE_CHANCE` instead of manifest values.

**Fix**: Remove `setTimeout` entirely. Respawn handled by `ResourceSystem.processRespawns()` via tick counting. Mining reads `depleteChance` from manifest.

**Key Changes**:
- Removed `MINING_DEPLETE_CHANCE` and `MINING_REDWOOD_DEPLETE_CHANCE` constants
- Resources with `depleteChance: 0` never deplete (rune essence rocks)
- Deterministic tick-based respawn timing

**Impact**: 
- OSRS-accurate resource mechanics
- Rune essence rocks work correctly (never deplete)
- Predictable respawn timing

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
lsof -ti:5555 | xargs kill -9  # Game Server (HTTP)
lsof -ti:5556 | xargs kill -9  # Game Server (WebSocket)
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### Docker Build Failures

**Symptoms**: `COPY failed: file not found` errors for `packages/*/node_modules` directories.

**Cause**: Bun may hoist workspace dependencies without materializing per-package `node_modules` directories.

**Fix**: The `Dockerfile.server` now includes defensive `mkdir -p` commands to create all required directories before COPY operations.

**Verification**:
```bash
# Build Docker image locally to test
docker build --platform linux/amd64 -f Dockerfile.server -t hyperscape:test .
```

### Tailwind CSS Missing Utilities

**Symptoms**: Auth screen or character screen appears unstyled in production Docker builds.

**Cause**: Tailwind v4 had issues with utility generation in linux/amd64 Docker builds.

**Current State**: Project uses stable Tailwind v3.4.19 with standard PostCSS pipeline.

**Verification**:
```bash
# Check generated CSS includes critical utilities
grep -E "inset-0|gap-2|p-6|bg-black/80|shadow-2xl" packages/client/dist/assets/*.css
```

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
