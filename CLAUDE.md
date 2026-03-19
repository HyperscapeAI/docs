# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with biome-based terrain generation, AI agents powered by ElizaOS, and live streaming capabilities.

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
- Safari 18+ (macOS 15+)
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- **Chrome Beta Channel**: Use `google-chrome-beta` (Chrome Beta) for WebGPU streaming on Linux NVIDIA (best stability and WebGPU support as of March 13, 2026)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
- If WebGPU cannot initialize, deployment MUST FAIL

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
│   ├── Biome terrain generation with quadtree LOD
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence (connection pool: 20)
│   ├── LiveKit voice chat integration
│   ├── Maintenance mode system
│   ├── Admin live controls dashboard
│   └── Duel oracle publishing (EVM + Solana)
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   ├── UI/HUD
│   └── Maintenance banner
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (terrain, trees, rocks, plants)
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
└── contracts/           # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

> **RESOLVED (March 2026): CIRCULAR DEPENDENCY - shared ↔ procgen**
>
> The circular dependency between `@hyperscape/shared` and `@hyperscape/procgen` has been resolved.
> - **Fix**: `TileCoord` interface is now defined locally in `packages/procgen/src/building/viewer/index.ts`
> - **Impact**: Procgen can now build without TypeScript errors
> - **Future**: Consider extracting shared types to `@hyperscape/types` package for cleaner boundaries

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

## Recent Major Features (March 2026)

### Docker Build Improvements (March 18, 2026)

**Change** (PR #1033, Commit 7519105): Comprehensive Docker build improvements for multi-service deployment.

**Problems Fixed**:
1. **Missing Client Build**: Dockerfile was server-only but multi-service template uses same image for both app and web containers
2. **Bun Version Incompatibility**: Bun 1.1.38 couldn't run Vite 6+ builds
3. **Node Binary Missing**: `ensure-assets.mjs` was called with `node` but bun-only base image doesn't have node binary
4. **better-sqlite3 QEMU Crash**: Native build segfaults under QEMU cross-compilation
5. **Workspace Symlinks Destroyed**: Docker COPY flattens Bun workspace symlinks in `node_modules/@hyperscape/*`
6. **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root, packages have their own `node_modules/`

**Solutions**:
```dockerfile
# Builder stage
FROM oven/bun:1.3.10 AS builder  # Upgraded from 1.1.38

# Add packages/client to builder
COPY packages/client ./packages/client

# Use bun instead of node for ensure-assets
RUN bun run ensure-assets.mjs

# Remove better-sqlite3 from manifests before install
RUN find packages -name package.json -exec sed -i '/"better-sqlite3"/d' {} \\;

# Copy per-package node_modules from builder
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Restore workspace symlinks in runtime stage
RUN bun install --production
```

**Files Changed**:
- `Dockerfile.server` - Added client build, Bun 1.3.10, workspace symlink restoration
- `packages/*/package.json` - better-sqlite3 removed during Docker build

**Impact**: 
- Multi-service deployments now work correctly (app + web containers)
- Vite 6+ builds work in Docker
- Workspace packages resolve correctly at runtime
- No more QEMU segfaults from better-sqlite3
- Cleaner manifest files without unused dependencies

## Recent Major Features (March 2026)

### Docker Build Improvements (March 15, 2026)

**Change** (PR #1033, Commit 7519105): Comprehensive Docker build improvements for multi-service deployment.

**Problems Fixed**:
1. **Missing Client Build**: Dockerfile was server-only but multi-service template uses same image for both app and web containers
2. **Bun Version Incompatibility**: Bun 1.1.38 couldn't run Vite builds
3. **Node Binary Missing**: `ensure-assets.mjs` was called with `node` but bun-only base image doesn't have node binary
4. **better-sqlite3 QEMU Crash**: Native build segfaults under QEMU cross-compilation
5. **Workspace Symlinks Destroyed**: Docker COPY flattens Bun workspace symlinks to `packages/*`
6. **Bun 1.3 Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root

**Fixes**:
- **Client Build Added**: Added `packages/client` to builder and `packages/client/dist` to runtime
- **Bun Upgrade**: Updated both builder and runtime stages from 1.1.38 → 1.3.10
- **Node → Bun**: Changed `ensure-assets.mjs` to use `bun` instead of `node`
- **better-sqlite3 Removal**: Stripped from manifests before install (project uses bun:sqlite/PostgreSQL)
- **Workspace Symlinks Restored**: Manually recreated symlinks in runtime stage with `bun install --production`
- **Per-Package node_modules**: Explicitly copy package-specific node_modules from builder (three, dotenv, etc.)
- **Manifest Preservation**: Package manifests copied from builder to ensure cleaned manifests (better-sqlite3 removed)

**Dockerfile Changes**:
```dockerfile
# Builder stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS builder

# Build packages in correct order
WORKDIR /app/packages/physx-js-webidl
RUN bun run build || echo \"PhysX build skipped\"

WORKDIR /app/packages/shared
RUN bun run build

WORKDIR /app/packages/server
RUN bun run build

# Runtime stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS runtime

# Copy built artifacts from builder
COPY --from=builder /app/packages/physx-js-webidl/dist ./packages/physx-js-webidl/dist
COPY --from=builder /app/packages/shared/build ./packages/shared/build
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/plugin-hyperscape ./packages/plugin-hyperscape

# Copy manifests where server expects them
RUN mkdir -p ./packages/server/world/assets/manifests
COPY assets/manifests ./packages/server/world/assets/manifests

# Restore workspace symlinks (flattened by Docker COPY)
RUN bun install --production
```

**Files Changed**:
- `packages/server/Dockerfile` - Complete rewrite for multi-service support

**Impact**: 
- Docker images now support both server and client deployments
- Vite builds work correctly with Bun 1.3.10
- Workspace dependencies resolve correctly at runtime
- No more QEMU crashes from better-sqlite3
- Consistent manifest versions across deployments

### VRM Material Isolation Fix (March 17, 2026)

**Change** (PR #1061, Commit 364d0a5): Isolated VRM clone materials to prevent highlight bleed across mob instances.

**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type. When hovering over a goblin, all goblins in the world would highlight simultaneously.

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Implementation** (`packages/shared/src/rendering/materials/cloneGLB.ts`):
```typescript
// Clone material to prevent shared state across instances
// Textures are shared by reference (memory efficient)
// but outputNode and uniforms are per-instance
const clonedMaterial = new MeshStandardNodeMaterial();
clonedMaterial.copy(originalMaterial);
// ... copy all material properties
mesh.material = clonedMaterial;
```

**Files Changed**:
- `packages/shared/src/rendering/materials/cloneGLB.ts` - Added material cloning logic

**Impact**: 
- Each mob instance now has independent highlight state
- Hovering over one goblin no longer highlights all goblins
- Textures remain shared for memory efficiency
- Fixes visual bug where all VRM mobs of same type would highlight together

### Mob AI Tick Processing Fix (March 17, 2026)

**Change** (PR #1060, Commit a55079e): Wired mob AI tick processing into server tick loop to enable mob state machine transitions.

**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Implementation** (`packages/server/src/systems/ServerNetwork/index.ts`):
```typescript
// OSRS-ACCURATE: Process mob AI BEFORE mob movement each tick
// AI state machine (IDLE → WANDER → CHASE → ATTACK → RETURN) decides movement targets,
// then mob tile movement executes the path on the same tick.
// Without this, mobs stand idle forever because MobEntity.serverUpdate() defers
// AI ticking to the tick system for deterministic OSRS ordering.
const MOB_AI_DELTA_SECONDS = TICK_DURATION_MS / 1000;
this.tickSystem.onTick(() => {
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof MobEntity)) continue;
    if (entity.getHealth() <= 0) continue;
    entity.runAITick(MOB_AI_DELTA_SECONDS);
  }
}, TickPriority.MOVEMENT);

// Register mob tile movement to run on each tick (same priority as player movement)
// Runs AFTER mob AI so paths set by AI are executed this tick
this.tickSystem.onTick((tickNumber) => {
  this.mobTileMovementManager.onTick(tickNumber);
}, TickPriority.MOVEMENT);
```

**Files Changed**:
- `packages/server/src/systems/ServerNetwork/index.ts` - Added mob AI tick processing loop

**Impact**: 
- Mob AI state machines now function correctly
- Goblins and other mobs properly transition through IDLE → WANDER → CHASE → ATTACK states
- Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)
- Fixes mobs standing idle forever after spawn

### Dev Server Watcher CPU Fix (March 16, 2026)

**Change** (PR #1034, Commit 7b5bf08): Fixed dev server watcher burning 100% CPU when idle.

**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms — redundant since the script already debounces rebuilds itself
2. Polling fallback does a full recursive directory walk every 1s

**Fix** (`packages/server/scripts/dev.mjs`):
```javascript
// Removed awaitWriteFinish (redundant with existing 200ms debounce)
const watcher = chokidar.watch(watchRoots, {
  ignoreInitial: true,
  // awaitWriteFinish removed - script already debounces via setTimeout
});

// Increased polling fallback interval from 1s to 5s
async function startPollingFallback() {
  pollFallbackInterval = setInterval(() => {
    // ... scan for changes
  }, 5000); // Was 1000ms
}
```

**Files Changed**:
- `packages/server/scripts/dev.mjs` - Removed `awaitWriteFinish` config, increased polling interval

**Impact**: 
- Eliminates 100% CPU usage when dev server is idle
- Reduces unnecessary file system polling
- Better developer experience with lower resource consumption
- No impact on rebuild responsiveness (200ms debounce still active)

### Railway ENOTDIR Fix (March 13, 2026)

**Change** (Commit 511519d): Added fallback to `gameAssetsRoot` to prevent Fastify static ENOTDIR crash on Railway.

**Problem**: Railway deployments were crashing with ENOTDIR errors when Fastify tried to serve static assets from a path that wasn't a directory.

**Fix**: Added fallback logic in server initialization to use `gameAssetsRoot` when primary asset path is unavailable.

**Files Changed**:
- `packages/server/src/startup/http-server.ts` - Added fallback logic for asset path resolution

**Impact**: More reliable Railway deployments, eliminates ENOTDIR crashes on production servers.

### PM2 Log Tail Fix for Deployment (March 13, 2026)

**Change** (Commit c226be7): Replaced hanging `pm2 logs` command with direct `tail` for log dumping in deployment script.

**Problem**: `pm2 logs` command was hanging indefinitely during deployment error handling, preventing SSH session from closing and causing GitHub Actions to timeout after 30 minutes even though the deployment had already failed.

**Fix**: Replaced `bunx pm2 logs hyperscape-duel --lines 10000 --nostream` with direct OS-level log file access:
```bash
# Old (hangs indefinitely)
bunx pm2 logs hyperscape-duel --lines 10000 --nostream || true

# New (returns immediately)
tail -n 10000 /root/.pm2/logs/hyperscape-duel-error.log 2>/dev/null || true
tail -n 10000 /root/.pm2/logs/hyperscape-duel-out.log 2>/dev/null || true
```

**Files Changed**:
- `scripts/deploy-vast.sh` - Replaced PM2 logs command with direct tail

**Impact**: 
- Deployment failures now exit immediately with full error logs
- No more 30-minute SSH session hangs on deployment errors
- GitHub Actions workflows complete faster on failures
- Better debugging experience with immediate log access

### Chrome Beta for Linux WebGPU Support (March 13, 2026)

**Change** (Commit 154f0b6): Reverted from Chrome Canary back to Chrome Beta for Linux WebGPU streaming support.

**Problem**: Chrome Canary was experiencing instability issues on Linux NVIDIA GPUs. Chrome Beta provides better stability for production streaming.

**Fix**: Updated `scripts/deploy-vast.sh` to install `google-chrome-beta` instead of `google-chrome-unstable`:
```bash
# Install Chrome Beta channel (Required for WebGPU on Linux)
echo "[deploy] Installing Chrome Beta for WebGPU support..."
if ! command -v google-chrome-beta &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - || true
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update && apt-get install -y google-chrome-beta || true
fi
```

**Configuration**:
- **Linux NVIDIA**: Use Chrome Beta (`google-chrome-beta`) with Vulkan ANGLE backend
- **macOS**: Continue using stable Chrome with Metal ANGLE backend
- **Deployment**: `scripts/deploy-vast.sh` now installs Chrome Beta by default on Linux

**Impact**: More reliable WebGPU initialization on Linux NVIDIA GPUs, better production stability for streaming.

### Curl Timeout Configuration (March 13, 2026)

**Change** (Commit d37bbe3): Added `--max-time 10` timeout to all curl health check commands in deployment scripts.

**Problem**: Health check curl commands could hang indefinitely if services were unresponsive, causing deployment scripts to stall.

**Fix**: Added explicit 10-second timeout to all curl commands in `scripts/deploy-vast.sh`:
```bash
# Before
curl -fsS http://127.0.0.1:5555/health > /dev/null 2>&1

# After
curl -fsS --max-time 10 http://127.0.0.1:5555/health > /dev/null 2>&1
```

**Impact**: Deployment scripts fail fast when services are unresponsive, prevents indefinite hangs during health checks.

### SSH Keepalive & Maintenance Timeout (March 13, 2026)

**Change** (Commit fb0d154): Added strict SSH keepalive settings and reduced maintenance mode timeout for faster deployments.

**SSH Keepalive Configuration**:
- Added `ServerAliveInterval=15` and `ServerAliveCountMax=3` to SSH commands in `.github/workflows/deploy-vast.yml`
- Prevents SSH connection drops during long-running maintenance mode operations
- SSH will detect dead connections within 45 seconds (15s × 3 retries)

**Maintenance Mode Timeout**:
- Reduced timeout from 300 seconds (5 minutes) to 30 seconds
- Reduced curl timeout from 600 seconds to 30 seconds
- Faster deployment cycles when waiting for current duel to complete

**Configuration**:
```bash
# SSH keepalive flags
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3

# Maintenance mode API call
curl -X POST 'http://127.0.0.1:5555/admin/maintenance/enter' \
  -d '{"reason":"deployment","timeoutMs":30000}' \
  --max-time 30
```

**Impact**: More reliable SSH connections during deployments, faster deployment cycles, prevents connection drops during maintenance mode.

### OSRS-Accurate Movement Rotation (March 13, 2026)

**Change** (Commit 24ed839): Fixed player rotation to ignore combat target rotation while moving, restoring OSRS-accurate movement behavior.

**Problem**: Players were rotating to face their combat target even while moving, which differs from Old School RuneScape behavior where movement direction takes priority over combat facing.

**Fix**: Modified movement system to ignore combat rotation updates while the player is actively moving:
```typescript
// Movement rotation takes priority over combat rotation
if (isMoving) {
  // Ignore combat target rotation updates
  return;
}
```

**Impact**: 
- Movement feels more responsive and natural
- Matches OSRS behavior where players face their movement direction
- Combat rotation only applies when standing still
- Better player control during kiting and tactical movement

### Fresh Asset Fetching on Vast.ai Deploy (March 13, 2026)

**Change** (Commit ef42c3d): Force fresh asset download on every Vast.ai deployment to prevent stale biome manifests.

**Problem**: Vast.ai VM cache was persisting old `packages/server/world/assets` directory across deployments, causing stale biome manifests to be used even after CDN updates.

**Fix**: Added explicit asset cleanup in `scripts/deploy-vast.sh` before `bun install`:
```bash
# Clean up assets folder to forcefully redownload the latest biomes manifest over the VM cache.
rm -rf packages/server/world/assets
bun install
```

**Impact**: 
- Eliminates stale manifest issues on Vast.ai deployments
- Ensures latest biome configs are always used
- Fixes canyon biome errors from outdated manifests
- Forces fresh download from CDN on every deploy

### Docker Build Cache Invalidation (March 13, 2026)

**Change** (Commits a522949, 207fd8a): Prevent Docker build cache from storing old biomes.json and other manifest files.

**Problem**: Docker layer caching was preserving old manifest files across builds, causing production deployments to use stale biome configurations even after manifest updates.

**Fix**: Modified `packages/server/Dockerfile` to invalidate cache for manifest copy operations:
```dockerfile
# Create world directory structure and copy manifests where server expects them
RUN mkdir -p ./packages/server/world/assets/manifests

# Copy manifests (small JSON files needed for server-side logic)
# This layer is invalidated on every build to ensure fresh manifests
COPY assets/manifests ./packages/server/world/assets/manifests
```

**Additional Changes**:
- Added cache-busting comments to force rebuild of manifest layers
- Ensured `bun install --production` runs after manifest copy to restore workspace symlinks

**Impact**: 
- Docker images always contain latest manifest files
- Eliminates production errors from stale biome configs
- Consistent manifest versions across all deployment targets
- No manual cache clearing required

### PM2 Dump Path Fix (March 13, 2026)

**Change** (Commit 20cc492): Fixed PM2 error log path for remote dump functionality.

**Problem**: PM2 dump logs were not being saved to the correct path, making debugging difficult for production deployments.

**Fix**: Updated PM2 configuration to use correct error log path for remote dump operations.

**Impact**: Better debugging capabilities, proper log persistence for production deployments, easier troubleshooting of production issues.

### CDN Cache Busting & Manifest Reliability (March 13, 2026)

**Change** (Commits db6581f, 94e3a1d, ef42c3d): Added cache busting to CDN requests and manifest uploads to prevent stale asset issues.

**Problem**: Cloudflare R2 CDN was serving stale manifests and assets even after new versions were uploaded, causing clients to load outdated game data (items, NPCs, terrain configs, etc.). This was particularly problematic for canyon biome which relies on up-to-date manifest data.

**Solution**:
```typescript
// Client-side cache busting (packages/shared/src/data/DataManager.ts)
const cacheBuster = `?v=${Date.now()}`;
const manifestUrl = `${CDN_URL}/manifests/${filename}${cacheBuster}`;

// Server-side cache busting (scripts/upload-to-r2.sh)
aws s3 cp "manifests/${file}" "s3://${BUCKET}/manifests/${file}?v=$(date +%s)" \
  --endpoint-url "${ENDPOINT}" \
  --content-type "application/json"
```

**Deployment Workflow Improvements**:
- **Prevent Submodule Overwrite**: `scripts/upload-to-r2.sh` now skips `assets/manifests` directory during upload
- **Ensure Manifests Exist**: GitHub Actions runs `ensure-assets.mjs` before R2 upload
- **Removed Broken CORS Config**: R2 CORS is now configured via Cloudflare dashboard (removed failing CLI step)
- **Wrangler R2 Fix** (Commit 94e3a1d): Added `--remote` flag to `wrangler r2 object put` in `.github/workflows/deploy-cloudflare.yml` to target remote Cloudflare bucket instead of local
- **Vast.ai Asset Refresh** (Commit ef42c3d): Deployment script now forcefully removes cached `packages/server/world/assets` folder before `bun install` to ensure latest manifests are fetched from Git LFS
- **Docker Cache Invalidation** (Commits a52294, 207fd8a): Added cache-busting steps to prevent Docker build cache from storing stale `biomes.json` and other manifest files

**Files Changed**:
- `packages/shared/src/data/DataManager.ts` - Client-side cache busting
- `scripts/upload-to-r2.sh` - Server-side cache busting and submodule skip
- `.github/workflows/deploy-r2.yml` - Added ensure-assets step
- `.github/workflows/deploy-cloudflare.yml` - Added `--remote` flag to wrangler
- `scripts/deploy-vast.sh` - Force fresh asset fetch with `rm -rf packages/server/world/assets`
- `Dockerfile.server` - Added `rm -rf packages/server/world/assets` before `ensure-assets.mjs`

**Impact**: 
- Eliminates stale manifest issues across all deployment targets (Railway, Vast.ai, Cloudflare)
- Ensures clients always fetch latest game data
- Prevents canyon biome errors from outdated manifests
- No manual CDN cache purging required
- Docker builds always use fresh manifests from Git LFS

### Manifest Embedding in Docker (March 13, 2026)

**Change** (Commit efa8021): Server Docker image now embeds manifests to bypass CDN and fix canyon biome errors.

**Problem**: Server was fetching manifests from CDN at runtime, which could fail if CDN was unavailable or manifests were stale. Canyon biome was failing due to missing manifest data.

**Fix**: 
- Manifests are now embedded directly in the Docker image at build time
- Server reads manifests from local filesystem instead of CDN
- Ensures manifests are always available and match the deployed code version

**Files Changed**:
- `Dockerfile.server` - Added COPY step for manifests from builder stage
- Server reads from `packages/server/world/assets/manifests/` (embedded in image)

**Docker Build Process**:
```dockerfile
# Builder stage
RUN node scripts/ensure-assets.mjs  # Fetch manifests
COPY --from=builder /app/packages/server/world ./packages/server/world  # Runtime stage
```

**Impact**: More reliable server startup, eliminates CDN dependency for manifests, fixes canyon biome loading errors.

### Workbox Service Worker Fix (March 13, 2026)

**Change** (Commit 9312a96): Inline workbox runtime to prevent MIME type errors on PWA update.

**Problem**: Service worker was failing to update due to MIME type errors when loading workbox runtime from external CDN.

**Fix**: Workbox runtime is now inlined directly into the service worker bundle instead of being loaded from external source.

**Files Changed**:
- `packages/client/vite.config.ts` - Updated Workbox plugin configuration

**Configuration**:
```typescript
// packages/client/vite.config.ts
workbox: {
  inlineWorkboxRuntime: true,  // Inline instead of loading from CDN
  // ... rest of config
}
```

**Impact**: Eliminates service worker update failures, more reliable PWA updates, better offline support.

### Tree Shader Lighting Fix (March 12, 2026)

**Change** (PR #1022): Fixed tree lighting to use vertex sphere normals instead of normal maps.

**Problem**: Tree models have sphere normals baked into the vertex normal attribute for volumetric foliage shading, but the shader was using `normalWorld` which goes through the TSL normal map pipeline, ignoring the correct vertex data.

**Solution**:
```typescript
// packages/shared/src/systems/shared/world/GPUMaterials.ts
// Old (incorrect - uses normal map pipeline)
const N = normalize(normalWorld);

// New (correct - uses vertex sphere normals)
const N = normalize(mul(modelNormalMatrix, normalLocal));
```

**Night Lighting Improvements**:
- Uniform `nightDim` multiplier maintains consistent ~1.35x lit-to-shadow ratio
- SSS (subsurface scattering), edge brightening, and saturation boost scale with `dayFactor`
- Night foliage stays muted and cool-toned
- Eliminates 4.8x contrast variance between day and night

**Impact**: Correct volumetric foliage lighting, consistent tree appearance across day/night cycle.

### Biome Terrain Generation & Quadtree LOD (March 12, 2026)

**Change** (PR #1018): Merged biome-based terrain generation with hierarchical quadtree LOD system.

#### TerrainQuadTree
Hierarchical LOD system for infinite terrain rendering:
- **Dynamic Splitting**: Chunks split/unsplit based on camera distance
- **LOD Levels**: 5 levels (depth 0-4), from 1600m root chunks to 100m leaf chunks
- **Uniform Resolution**: 32x32 vertices per chunk at all LOD levels
- **Skirt Geometry**: 15m drop to hide LOD seams
- **Client-Only**: Visual system only - server still uses flat 100m tile grid

**Configuration** (`packages/shared/src/systems/shared/world/TerrainQuadTree.ts`):
```typescript
{
  minSize: 100,           // Smallest chunk (matches TILE_SIZE)
  maxDepth: 4,            // Max subdivision depth
  splitRatio: 1.5,        // Split when distance < size * splitRatio
  unsplitMultiplier: 1.2, // Prevents thrashing at LOD boundaries
  resolution: 32,         // Uniform vertex resolution
  skirtDrop: 15,          // Skirt depth in meters
}
```

**Performance Optimizations**:
- Numeric grid coordinates instead of string keys (eliminates per-frame string allocation)
- Structural dirty flag to skip neighbor resolution when tree is stable
- Lazy terrain generation (only when all 4 neighbors are resolved)

#### GLBTreeBatchedInstancer
Multi-variant tree rendering with BatchedMesh:
- **One BatchedMesh per material slot per LOD** - minimal draw calls
- **Texture Fingerprinting**: Automatic material slot matching across variants
- **LOD Switching**: Smooth transitions between LOD0/LOD1/LOD2 based on distance
- **Depleted State**: Separate geometry for chopped trees (stumps)
- **Highlight Support**: Per-instance color tinting for interaction feedback

**Key Features**:
- Supports trees with multiple model variants (e.g., oak_tree_1.glb, oak_tree_2.glb)
- Deterministic fingerprinting prevents silent variant matching failures
- Hysteresis on LOD transitions (0.81x multiplier) prevents flickering

**Usage**:
```typescript
await addInstance(
  'oak',                    // Tree type
  ['oak_1.glb', 'oak_2.glb'], // Variant paths
  0,                        // Variant index
  entityId,
  position,
  rotation,
  scale,
  'oak_stump.glb',         // Depleted model (optional)
  0.8                       // Depleted scale (optional)
);
```

#### Biome System
Terrain generation now uses biome-specific parameters:
- **3 Biomes**: Forest, Canyon, Tundra (defined in `TerrainBiomeTypes.ts`)
- **2 Landscape Types**: Mountain, Pond (defined in `TerrainHeightParams.ts`)
- **Per-Biome Tree Distribution**: Each biome has unique tree types, densities, and placement rules
- **TreeId Enum**: Centralized tree type identifiers replacing magic strings
- **Batched Entity Spawning**: Reduces network overhead by batching all entities for a tile into single packet

**Files**:
- `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts` - Biome definitions and per-biome tree configs
- `packages/shared/src/systems/shared/world/TerrainHeightParams.ts` - Landscape feature definitions
- `packages/shared/src/systems/shared/world/BiomeResourceGenerator.ts` - Resource placement logic
- `packages/shared/src/constants/TreeTypes.ts` - TreeId enum (single source of truth for tree type identifiers)

**TreeId Enum Pattern**:
All tree types are now defined using the `TreeId` enum instead of magic strings:
```typescript
// packages/shared/src/constants/TreeTypes.ts
export enum TreeId {
  Oak = "tree_oak",
  Willow = "tree_willow",
  Maple = "tree_maple",
  // ... etc
}

// Usage in biome configs
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  trees: {
    [TreeId.Oak]: { weight: 20, maxHeight: 30 },
    [TreeId.Maple]: { weight: 40, maxHeight: 30 },
  },
  // ...
};
```

**Tree Placement Rules**:
Each tree type can have biome-specific placement constraints:
- `weight` - Relative spawn probability (higher = more common)
- `minHeight` / `maxHeight` - Elevation constraints (world units)
- `waterAffinity` - Preference for water-adjacent placement (0-1, where 1 = only spawns near water)
- `waterProximityHeight` - Max height above water to consider "near water" (meters)
- `avoidsWaterBelow` - Reject placement if below this height above water threshold (meters)
- `maxSlope` - Maximum terrain slope for placement (gradient, e.g., 1.5 = 56° max slope)

**Example Biome Config** (from `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`):
```typescript
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Knotwood]: { weight: 40, maxHeight: 30 },
    [TreeId.Oak]: { weight: 20, maxHeight: 30 },
    [TreeId.Birch]: { weight: 20, maxHeight: 30 },
    [TreeId.Maple]: { weight: 40, maxHeight: 30 },
    [TreeId.Fir]: { weight: 15, maxHeight: 30 },
    [TreeId.Pine]: { weight: 15, maxHeight: 30 },
    [TreeId.ChinaPine]: { weight: 15, minHeight: 30, maxHeight: 60 },
    [TreeId.Bamboo]: { weight: 15, minHeight: 35 },
  },
  density: 15,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [0.8, 1.2],
  maxSlope: 1.5,
};

const CANYON_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Cactus]: { weight: 20, avoidsWaterBelow: 3 },
    [TreeId.Dead]: { weight: 20, minHeight: 20 },
    [TreeId.Palm]: {
      weight: 20,
      waterAffinity: 0.3,
      waterProximityHeight: 9,
      maxHeight: 15,
    },
    [TreeId.Coconut]: {
      weight: 10,
      waterAffinity: 0.6,
      waterProximityHeight: 9,
      maxHeight: 15,
    },
  },
  density: 15,
  minSpacing: 18,
  clustering: false,
  scaleVariation: [0.7, 1.3],
  maxSlope: 2.0,
};

const TUNDRA_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.WindPine]: { weight: 40, minHeight: 15 },
    [TreeId.Fir]: { weight: 30, minHeight: 10 },
    [TreeId.Pine]: { weight: 25, minHeight: 8 },
    [TreeId.Birch]: { weight: 10 },
  },
  density: 10,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [0.6, 1.0],
  maxSlope: 1.5,
};
```

**Impact**: Infinite terrain rendering with dynamic LOD, biome-specific visuals, improved performance through reduced draw calls and smarter chunk management.

### Admin Live Controls & Maintenance Mode (March 12, 2026)

**Change** (PR #1015): Added admin dashboard with live controls, maintenance mode, and log streaming.

#### Maintenance Mode System
Graceful server pause/resume for zero-downtime deployments:
- **Endpoints**:
  - `POST /admin/maintenance/enter` - Pause game after current duel
  - `POST /admin/maintenance/exit` - Resume game
  - `GET /admin/maintenance/status` - Check maintenance state
- **Safe-to-Deploy Flag**: Prevents restarts during active duels
- **Market Pause**: Automatically pauses betting markets during maintenance

**Implementation**:
```typescript
// packages/server/src/startup/maintenance-mode.ts
export interface MaintenanceState {
  active: boolean;
  enteredAt: number | null;
  reason: string | null;
  safeToDeploy: boolean;
  currentPhase: string | null;
  marketStatus: string;
  pendingMarkets: number;
}
```

#### Live Controls Dashboard
Real-time admin panel (`packages/client/src/screens/AdminLiveControls.tsx`):
- **HLS Stream Preview**: Embedded video player for live stream monitoring
- **Server Controls**: Pause/resume game, restart process
- **Live Logs**: 1000-entry ring buffer with auto-refresh (3s interval)
- **Status Display**: Maintenance state, viewer count, current phase

**CSS Layout Improvements** (PR #1019):
- Fixed scrolling issues in admin panels with proper flexbox layout
- Added `overflow: hidden` on `.admin-content` with `overflow-y: auto` on inner containers
- Proper `min-height: 0` overrides for nested flex containers to enable scroll containment
- Eliminated layout thrashing and scroll conflicts in admin dashboard

**Admin API Endpoints**:
- `GET /admin/logs` - Fetch recent server logs from in-memory ring buffer
- `POST /admin/restart` - Restart server process (requires PM2)
- `GET /admin/duels/status` - Get current duel cycle status

#### Maintenance Banner
Client-side warning banner (`packages/client/src/components/common/MaintenanceBanner.tsx`):
- Polls `/health` endpoint every 5s
- Displays red banner when `maintenanceMode: true`
- Visible across all client screens (game, admin, leaderboard, etc.)

#### Logger Ring Buffer
In-memory log storage (`packages/server/src/systems/ServerNetwork/services/Logger.ts`):
- **Capacity**: 1000 most recent log entries
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Structure**: `{ timestamp, level, system, message, data }`
- **API**: `GET /admin/logs` returns full buffer

**Configuration**:
```bash
# ecosystem.config.cjs
ORACLE_SETTLEMENT_DELAY_MS=7000  # Delay oracle publish to sync with stream
```

**Impact**: Zero-downtime deployments, better operational visibility, safer server restarts.

### Oracle Settlement Delay & Stream Sync (March 12, 2026)

**Change** (Commit 38c8c89): Added configurable settlement delay to sync oracle publishing with stream delivery.

**Problem**: Oracle was publishing duel outcomes immediately after resolution, but stream viewers were still watching the duel (7-10s behind live).

**Solution**: 
- Added `settlementDelayMs` to `DuelArenaOracleConfig`
- Default: 7000ms (7 seconds)
- Delays `publishAcrossTargets()` call after duel resolution

**Configuration**:
```bash
# ecosystem.config.cjs or .env
ORACLE_SETTLEMENT_DELAY_MS=7000  # Match typical stream latency
```

**Code**:
```typescript
// packages/server/src/oracle/DuelArenaOraclePublisher.ts
if (this.config.settlementDelayMs > 0) {
  await new Promise((resolve) =>
    setTimeout(resolve, this.config.settlementDelayMs),
  );
}
await this.publishAcrossTargets(existing, "RESOLVE");
```

**Impact**: Stream viewers see duel outcome before oracle publishes, better UX for betting/spectating.

### Agent Autonomous Behavior Restoration (March 12, 2026)

**Change** (Commit 82a5365): Fixed agent T-pose and re-enabled autonomous behavior between duels.

**Fixes**:
- **Physics Null Guards**: Added null checks in `RigidBody.ts` and `Collider.ts` for stream mode viewports where physics system is removed
- **Autonomous Behavior**: Re-enabled mining, chopping, fishing for duel bot agents between duels (was suppressed)
- **Post-Duel Roaming**: Relaxed restore position from 120-unit lobby radius to 2000-unit world boundary
- **Model Provider Diversity**: Switched from ElizaCloud to direct Anthropic/Groq providers (PR #1018)
  - Interleaved provider selection ensures diversity (Anthropic → Groq → Anthropic → Groq...)
  - Models: Claude Sonnet 4.6, Llama 4 Scout, Claude Opus 4.6, Llama 4 Maverick, Claude Haiku 4.5, Llama 3.3 70B, Kimi K2, Qwen 3 30B
  - Updated `@elizaos/plugin-elizacloud` to `alpha` tag for compatibility
- **Bank State Request**: Request bank state on player spawn so goal planner has item data

**Code Changes**:
```typescript
// packages/shared/src/nodes/RigidBody.ts
if (!this.world.physics) return; // Null guard for stream mode

// packages/server/src/eliza/ElizaDuelBot.ts
// Removed dedicatedDuelBot gates that killed all open-world autonomy
// shouldRunOpenWorldAutonomy() now always returns true

// packages/plugin-hyperscape/src/services/HyperscapeService.ts
private shouldRunOpenWorldAutonomy(): boolean {
  // Duel bots should perform autonomous activities (mining, chopping, fishing)
  // between duels to make the world feel alive
  return true;
}
```

**Impact**: Agents now behave naturally between duels, no more T-pose in stream mode, better goal planning with bank awareness.

### Streaming Pipeline Improvements (March 10-12, 2026)

**Frame Pacing Fix** (Commits 522fe37, e2c9fbf):
- **Problem**: CDP screencast delivering ~60fps to FFmpeg expecting 30fps, causing buffer buildup
- **Fix**: Reverted `everyNthFrame` to 1 (Xvfb compositor runs at 30fps, not 60fps)
- **Resolution**: Default changed from 1920x1080→1280x720 to match capture viewport
- **Impact**: Eliminates stream buffering, smoother playback

**GOP Size Change** (Commit 38c8c89):
- Changed from 30→60 frames (1s→2s at 30fps)
- Recommended by Twitch/YouTube for stability
- Tradeoff: Increased tune-in latency for better stream stability

**RTMP Muxer** (Commit 38c8c89):
- Changed from `flv` to `fifo` muxer
- `drop_pkts_on_overflow=1` absorbs network stalls without blocking encoder
- Better resilience to network jitter

**Configuration**:
```bash
# ecosystem.config.cjs
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_MODE=cdp          # CDP (default) or webcodecs
STREAM_CAPTURE_ANGLE=vulkan      # ANGLE backend (vulkan, metal, default)
```

### Solana Oracle IDL Type Formatting (March 13, 2026)

**Change** (Commits in `packages/duel-oracle-solana/src/generated/`): Reformatted Solana oracle IDL types from JSON-style to TypeScript-style object literals.

**Technical Details**:
```typescript
// Old (JSON-style)
export const FIGHT_ORACLE_IDL = {
  "address": "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  "metadata": {
    "name": "fight_oracle",
    // ...
  }
}

// New (TypeScript-style)
export const FIGHT_ORACLE_IDL = {
  address: "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  metadata: {
    name: "fight_oracle",
    // ...
  }
} as const;
```

**Files Changed**:
- `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`
- `packages/duel-oracle-solana/src/generated/fightOracleTypes.ts`
- `packages/duel-oracle-solana/src/generated/fight_oracle.ts`

**Impact**: Better TypeScript type inference, cleaner code style, improved IDE autocomplete, no functional changes.

### Solana Oracle Error Handling Improvements (March 12, 2026)

**Change** (PR #1019): Enhanced Solana transaction error messages with detailed log extraction.

**Problem**: Solana `SendTransactionError` messages were unhelpful, showing generic "Catch the `SendTransactionError` and call `getLogs()` on it for full details" instead of actual error details.

**Solution**:
```typescript
// packages/server/src/oracle/DuelArenaOraclePublisher.ts
if (error && typeof error === "object" && "logs" in error) {
  const logs = (error as any).logs;
  if (Array.isArray(logs)) {
    // Strip unhelpful boilerplate
    errorMessage = errorMessage
      .replace(/Catch the `SendTransactionError`.*$/g, "")
      .trim();
    
    // Append actual transaction logs
    const logsStr = logs.join("\\n  ");
    errorMessage = `${errorMessage}\\nTransaction Logs:\\n  ${logsStr}`;
    
    // Detect common errors
    if (logsStr.includes("insufficient lamports")) {
      errorMessage = `Insufficient SOL to pay for transaction rent or fees.\\n${errorMessage}`;
    }
  }
}
```

**Impact**: Significantly improved debuggability for Solana oracle failures, clearer error messages for insufficient SOL and other transaction failures.

### Deployment Fixes (March 11-13, 2026)

**Docker Workspace Symlinks** (Commit 7f1af94):
- **Problem**: Docker COPY flattens workspace symlinks, breaking runtime module resolution for externalized packages
- **Fix**: Added `bun install --production` in Docker runtime stage to restore symlinks
- **Impact**: Server can resolve @hyperscape/* workspace packages in production Docker deployments

**SSH Timeout Fix** (Commit a65a308):
- **Problem**: Background processes (Xvfb, socat) keeping SSH session open, causing 30-minute hangs
- **Fix**: Added `disown` after each background process in `scripts/deploy-vast.sh`
- **Impact**: Deployment completes in ~1 minute instead of hanging for 30 minutes

**Orphaned Process Cleanup** (Commit 9e6f5bb):
- **Problem**: PM2 `kill` failing to terminate orphaned bun child processes, causing database deadlocks
- **Fix**: Added explicit `pkill` commands before deployment:
  ```bash
  pkill -f "bun.*packages/server.*dist/index.js" || true
  pkill -f "bun.*packages/server.*start" || true
  pkill -f "bun.*dev-duel.mjs" || true
  pkill -f "bun.*preview.*3333" || true
  ```
- **Impact**: Eliminates database connection deadlocks from ghost game servers

**Docker Workspace Symlinks** (Commit 7f1af94):
- **Problem**: Docker COPY flattens workspace symlinks, breaking runtime module resolution
- **Fix**: Added `bun install --production` in Docker runtime stage to restore symlinks
- **Impact**: Server can resolve externalized workspace packages (@hyperscape/decimation, @hyperscape/impostors, etc.)

### Test Infrastructure Updates (March 11-12, 2026)

**CI Exclusions** (Commits cd253d5, 754dea2):
- Excluded `@hyperscape/impostor` from headless CI test runs (requires WebGPU)
- Increased `sim-engine` guarded MEV fee sweep test timeout from 60s to 120s
- Fixed cyclic dependencies and port conflicts
- Fixed biome config loading in tests

**Test Mock Refactoring** (PR #1019):
- **DuelBot.test.ts**: Replaced `vi.hoisted()` + `vi.mock()` with `vi.spyOn()` pattern to avoid Bun hoisting issues
- **DuelMatchmaker.test.ts**: Removed 60-line `MockDuelBot` class, now uses real `DuelBot` (aligns with "NO MOCKS" philosophy)
- **EquipmentVisualSystem.test.ts**: Changed to `vi.spyOn()` with fallback to real `getItem()` data
- **MobRightClickAttack.test.ts**: Added proper window mock cleanup with try/finally guards
- **GravestoneLootSystem.test.ts**: Namespaced test items with `grave_` prefix to avoid registry collisions

**Testing Strategy**:
- WebGPU-dependent packages (`impostor`, `client`) require local testing with GPU-enabled browsers
- Headless CI focuses on server-side logic, data processing, and non-rendering systems
- Full integration tests run locally or on GPU-enabled CI runners (not GitHub Actions)
- Prefer real implementations over mocks (use `vi.spyOn()` with fallbacks instead of full mocks)

**Test Improvements** (PR #1019):
- **DuelBot.test.ts**: Replaced `vi.hoisted()` + `vi.mock()` with `vi.spyOn()` to avoid Bun hoisting issues
- **DuelMatchmaker.test.ts**: Removed 60-line `MockDuelBot` class, now uses real `DuelBot` (aligns with "NO MOCKS" philosophy)
- **EquipmentVisualSystem.test.ts**: Changed to `vi.spyOn()` with fallback to real `getItem()` data
- **MobRightClickAttack.test.ts**: Added proper window mock cleanup with try/finally guards
- **GravestoneLootSystem.test.ts**: Namespaced test items with `grave_` prefix to avoid registry collisions
- **BiomeSystem Tests**: Updated to use explicit biome definitions instead of hardcoded `DEFAULT_BIOMES`

### Dependency Updates & Migration Guide (March 10-19, 2026)

**📖 Complete Migration Guide**: See [`docs/migration-march-2026.md`](../docs/migration-march-2026.md) for detailed migration steps, code examples, and troubleshooting.

**Major Updates**:
- **Vite**: 6.4.1 → 8.0.0 (MAJOR - build tool upgrade)
  - **Breaking**: New plugin API, updated config schema
  - **Migration**: Update `vite.config.ts` for Vite 8 plugin API
  - **Impact**: Faster builds, improved HMR, better tree-shaking
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1 (MAJOR - React plugin upgrade)
  - **Breaking**: New Fast Refresh implementation
  - **Migration**: Update plugin configuration in `vite.config.ts`
  - **Impact**: Better React 19 compatibility with new Fast Refresh implementation
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)
  - **Impact**: Updated TypeScript definitions matching Three.js 0.183.2
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (test coverage tooling)
  - **Impact**: Enhanced test coverage reporting with Vitest 4.1
- **jsdom**: 28.1.0 → 29.0.0 (MAJOR - testing environment)
  - **Impact**: Updated testing environment with jsdom 29.x
- **jest**: 29.7.0 → 30.3.0 (MAJOR - testing framework)
  - **Impact**: Updated testing framework with Jest 30.x
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6 (MAJOR - Hardhat plugin)
  - **Breaking**: New ethers.js v6 integration
  - **Migration**: Update contract deployment scripts for ethers v6 API
  - **Impact**: Improved smart contract tooling
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support)
  - **Impact**: Latest VRM avatar features and improvements
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (Solana mobile wallet)
  - **Impact**: Improved mobile wallet support for Solana
- **sqlite3**: 5.1.7 → 6.0.1 (SQLite database driver)
  - **Impact**: SQLite 6.x with performance improvements and bug fixes

**Impact Summary**:
- Latest build tooling with improved performance and faster builds
- Better React 19 compatibility with new Fast Refresh implementation
- Updated testing environment with Jest 30.x and jsdom 29.x
- Latest VRM avatar features and improvements
- Improved mobile wallet support for Solana
- Updated TypeScript definitions matching Three.js 0.183.2
- Enhanced test coverage reporting with Vitest 4.1
- SQLite 6.x with performance improvements and bug fixes

### Manifest Loading Fixes (March 10, 2026)

**Change** (Commit c0898fa): Fixed legacy manifest entries that 404 on CDN.

**Removed** (never existed):
- `items.json` (items are split into category files: `items/weapons.json`, `items/armor.json`, etc.)
- `resources.json`

**Added** (missing manifests):
- `ammunition.json`
- `combat-spells.json`
- `duel-arenas.json`
- `lod-settings.json`
- `quests.json`
- `runes.json`

**Impact**: Eliminates 404 errors during manifest loading, ensures all current manifests are properly fetched.

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

**Exception**: WebGPU-dependent tests (`@hyperscape/impostor`, `@hyperscape/client`) are excluded from headless CI and must run locally with GPU-enabled browsers.

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
| 4001 | ElizaOS API | `ELIZA_PORT` | `bun run dev:ai` |
| 5555 | Game Server | `PORT` | `bun run dev` |
| 8080 | Asset CDN | `CDN_PORT` | `bun run cdn:up` |
| 8765 | RTMP Bridge | `RTMP_BRIDGE_PORT` | `bun run duel` |
| 4180 | Spectator Server | `SPECTATOR_PORT` | `bun run duel` |

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
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent configuration |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth
ORACLE_SETTLEMENT_DELAY_MS=7000  # Oracle publish delay (stream sync)

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
PUBLIC_CDN_URL=https://...       # Asset CDN URL

# Streaming (ecosystem.config.cjs)
STREAM_CAPTURE_MODE=cdp          # CDP (default) or webcodecs
STREAM_CAPTURE_WIDTH=1280        # Capture resolution
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_ANGLE=vulkan      # ANGLE backend (vulkan, metal, default)
RTMP_BRIDGE_PORT=8765            # RTMP bridge WebSocket port
SPECTATOR_PORT=4180              # Spectator server port
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server
- `PUBLIC_CDN_URL` must point to your asset hosting

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.3.10+ (upgraded from 1.1.38 for Vite 6+ compatibility)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

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
lsof -ti:8080 | xargs kill -9  # Asset CDN
lsof -ti:4001 | xargs kill -9  # ElizaOS API
lsof -ti:8765 | xargs kill -9  # RTMP Bridge
lsof -ti:4180 | xargs kill -9  # Spectator Server
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)
- WebGPU-dependent tests (`@hyperscape/impostor`, `@hyperscape/client`) must run locally with GPU

### Streaming Issues

**Stream buffering / lag**:
- Check `STREAM_CAPTURE_WIDTH` and `STREAM_CAPTURE_HEIGHT` match (default 1280x720)
- Verify Xvfb is running at 30fps (no vsync)
- Ensure `everyNthFrame: 1` in CDP screencast config

**WebGPU initialization fails**:
- Verify `gpu_display_active=true` on Vast.ai instance
- Check Chrome Beta is installed: `google-chrome-beta --version` (required as of March 13, 2026)
- Verify ANGLE backend: `STREAM_CAPTURE_ANGLE=vulkan` on Linux NVIDIA
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment variable: `echo $DISPLAY` (should be `:99`)
- Verify curl health checks have `--max-time 10` timeout

**Orphaned processes after deployment**:
- Check PM2 logs: `pm2 logs hyperscape-duel`
- Manually kill orphaned bun processes: `pkill -f "bun.*packages/server"`
- Verify database connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'hyperscape';`

### Admin Dashboard Issues

**Logs not appearing**:
- Verify admin authentication (requires admin role)
- Check ring buffer size: `Logger.getRecentLogs().length`
- Ensure auto-refresh is enabled
- Check browser console for fetch errors to `/admin/logs`

**Maintenance mode not working**:
- Check `/admin/maintenance/status` endpoint
- Verify no active duels: `safeToDeploy` should be `true`
- Check market status: `marketStatus` should be `PAUSED`
- Ensure PM2 is running: `pm2 status`

**Server restart button not working**:
- Verify PM2 is managing the process: `pm2 list`
- Check PM2 logs: `pm2 logs hyperscape-duel`
- Ensure admin code is set: `ADMIN_CODE` in server `.env`
- Note: Restart requires PM2 to auto-restart on `process.exit(0)`

### Docker Deployment Issues

**Module resolution errors for workspace packages**:
- **Symptom**: "Cannot find module @hyperscape/decimation" or similar errors in Docker
- **Cause**: Docker COPY flattens workspace symlinks (fixed March 12, 2026)
- **Fix**: Ensure Dockerfile includes `RUN bun install --production` after COPY steps
- **Verify**: Check `Dockerfile.server` has workspace symlink restoration step

**Manifests not loading in Docker**:
- **Symptom**: Server fails to start with "Failed to load manifest" errors
- **Cause**: Manifests not embedded in Docker image (fixed March 13, 2026)
- **Fix**: Ensure Dockerfile copies manifests from builder stage
- **Verify**: Check `COPY --from=builder /app/packages/server/world ./packages/server/world` exists in Dockerfile

### Biome System Issues

**"Unknown biome name" errors**:
- **Symptom**: Terrain generation fails with biome-related errors
- **Cause**: Biome system no longer has hardcoded defaults (changed March 12, 2026)
- **Fix**: Pass explicit biome definitions to `BiomeSystem` or `TerrainGenerator` constructor
- **Example**: See `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`

**Trees spawning on cliffs or steep slopes**:
- **Symptom**: Trees appear on unrealistic terrain
- **Cause**: Missing or incorrect `maxSlope` configuration
- **Fix**: Set `maxSlope` in biome tree config (e.g., `maxSlope: 1.5` for forest, `2.0` for canyon)
- **Location**: `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`

### Canyon Biome Errors

**Symptom**: Server fails to load canyon biome or crashes on canyon tile generation

**Cause**: Missing or stale manifests

**Fix** (as of March 13, 2026):
- **Docker**: Manifests are now embedded in Docker image (commit efa8021) - rebuild to pick up latest
- **CDN**: Cache busting is automatically applied (commit db6581f) - no manual purging needed
- **Local Dev**: Ensure assets are synced: `bun run assets:sync`
- **Hard Refresh**: Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R) to force fresh manifest fetch

### Stale Manifests / Outdated Game Data

**Symptom**: Seeing outdated items, NPCs, or terrain configs after deployment

**Cause**: CDN caching, stale service worker, or Docker build cache

**Fix** (as of March 13, 2026):
- **Automatic**: Cache busting is now applied to all manifest requests (commit db6581f)
- **Client**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- **Server**: Manifests embedded in Docker - rebuild image: `docker build -f Dockerfile.server .`
- **Service Worker**: Workbox runtime is inlined (commit 9312a96) - PWA updates are now reliable
- **R2 Upload**: Wrangler now uses `--remote` flag to target remote bucket (commit 94e3a1d)
- **Vast.ai**: Deployment script forcefully removes cached assets folder before install (commit ef42c3d)
- **Docker Cache**: Dockerfile now removes assets folder before `ensure-assets.mjs` to prevent stale cache (commits a52294, 207fd8a)

### Solana Oracle Type Errors

**Symptom**: TypeScript errors in Solana oracle IDL imports

**Cause**: IDL types were reformatted from JSON-style to TypeScript-style (March 13, 2026)

**Fix**: Update imports to use new TypeScript-style object literals:
```typescript
// Old (JSON-style - no longer valid)
const idl = FIGHT_ORACLE_IDL;
idl["address"]  // Error: Element implicitly has 'any' type

// New (TypeScript-style)
const idl = FIGHT_ORACLE_IDL;
idl.address  // ✅ Properly typed
```

**Files Changed**:
- `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`
- `packages/duel-oracle-solana/src/generated/fightOracleTypes.ts`
- `packages/duel-oracle-solana/src/generated/fight_oracle.ts`

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI assistant instructions
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
