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
- Safari 18+ (macOS 15+)
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- **Chrome Beta Channel**: Use `google-chrome-beta` for WebGPU streaming (better stability than Dev/Canary)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
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
│   └── Admin live controls dashboard
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   └── UI/HUD
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (terrain, trees, rocks, plants)
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
└── contracts/           # MUD onchain game state (experimental)
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

## Recent Major Features (March 2026)

### Biome Terrain Generation & Quadtree LOD

**New Systems** (Commits 82a5365, 6c14c8e):

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
- **Biome Types**: Plains, forest, desert, tundra, etc.
- **Resource Distribution**: Biome-specific tree/rock/plant placement
- **Height Variation**: Per-biome terrain height parameters
- **Vegetation Density**: Configurable grass/flower density per biome

**Files**:
- `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts` - Biome definitions
- `packages/shared/src/systems/shared/world/BiomeResourceGenerator.ts` - Resource placement logic

### Admin Live Controls & Maintenance Mode

**New Features** (PR #1015):

#### Maintenance Mode System
Graceful server pause/resume for zero-downtime deployments:
- **Endpoints**:
  - `POST /admin/maintenance/enter` - Pause game after current duel
  - `POST /admin/maintenance/exit` - Resume game
  - `GET /admin/maintenance/status` - Check maintenance state
- **Safe-to-Deploy Flag**: Prevents restarts during active duels
- **Market Pause**: Automatically pauses betting markets during maintenance

#### Live Controls Dashboard
Real-time admin panel (`packages/client/src/screens/AdminLiveControls.tsx`):
- **HLS Stream Preview**: Embedded video player for live stream monitoring
- **Server Controls**: Pause/resume game, restart process
- **Live Logs**: 1000-entry ring buffer with auto-refresh (3s interval)
- **Status Display**: Maintenance state, viewer count, current phase

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

### Oracle Settlement Delay & Stream Sync

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

### Streaming Pipeline Improvements

**Frame Pacing Fix** (Commits 522fe37, e2c9fbf):
- **Problem**: CDP screencast delivering ~60fps to FFmpeg expecting 30fps, causing buffer buildup
- **Fix**: Frame pacing guard skips frames arriving faster than 85% of 33.3ms target interval
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

### Agent Autonomous Behavior Restoration

**Change** (Commit 89322093): Fixed agent T-pose and re-enabled autonomous behavior between duels.

**Fixes**:
- **Physics Null Guards**: Added null checks in `RigidBody.ts` and `Collider.ts` for stream mode viewports where physics system is removed
- **Autonomous Behavior**: Re-enabled mining, chopping, fishing for duel bot agents between duels (was suppressed)
- **Post-Duel Roaming**: Relaxed restore position from 120-unit lobby radius to 2000-unit world boundary
- **Model Provider Diversity**: Interleave Anthropic/Groq agents for provider diversity
- **Bank State Request**: Request bank state on player spawn so goal planner has item data

**Code Changes**:
```typescript
// packages/shared/src/nodes/RigidBody.ts
if (!this.world.physics) return; // Null guard for stream mode

// packages/server/src/eliza/ElizaDuelBot.ts
// Removed dedicatedDuelBot gates that killed all open-world autonomy
// shouldRunOpenWorldAutonomy() now always returns true
```

**Impact**: Agents now behave naturally between duels, no more T-pose in stream mode, better goal planning with bank awareness.

### Deployment Fixes

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

### Test Infrastructure Updates

**CI Exclusions** (Commit cd253d5):
- Excluded `@hyperscape/impostor` from headless CI test runs (requires WebGPU)
- Increased `sim-engine` guarded MEV fee sweep test timeout from 60s to 120s
- Fixed cyclic dependencies and port conflicts

**Testing Strategy**:
- WebGPU-dependent packages (`impostor`, `client`) require local testing with GPU-enabled browsers
- Headless CI focuses on server-side logic, data processing, and non-rendering systems
- Full integration tests run locally or on GPU-enabled CI runners (not GitHub Actions)

### Dependency Updates (March 10, 2026)

**Major Updates**:
- **Three.js**: 0.182.0 → 0.183.2
  - **Breaking**: `atan2` renamed to `atan` in TSL exports
  - Migration: `import { atan } from 'three/tsl'` (was `atan2`)
- **Capacitor**: 7.6.0 → 8.2.0 (Android, iOS, Core)
- **lucide-react**: → 0.577.0 (icon library)
- **three-mesh-bvh**: 0.8.3 → 0.9.9 (BVH acceleration)
- **eslint**: → 10.0.3 (linting)
- **jsdom**: → 28.1.0 (testing)
- **@ai-sdk/openai**: → 3.0.41 (AI SDK)
- **hardhat**: → 3.1.11 (smart contracts)
- **@nomicfoundation/hardhat-chai-matchers**: → 3.0.0 (testing)
- **globals**: → 17.4.0 (TypeScript globals)

### Manifest Loading Fixes

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
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server
- `PUBLIC_CDN_URL` must point to your asset hosting

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
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local)
- **Testing**: Vitest 4.x, Playwright (WebGPU-enabled browsers only)
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Build**: Turbo, esbuild, Vite

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
- Verify frame pacing guard is active (logs show "Frame pacing: skipped frame")
- Ensure Xvfb is running at 30fps (no vsync)

**WebGPU initialization fails**:
- Verify `gpu_display_active=true` on Vast.ai instance
- Check Chrome Beta is installed: `google-chrome-beta --version`
- Verify ANGLE backend: `STREAM_CAPTURE_ANGLE=vulkan` on Linux NVIDIA
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment variable: `echo $DISPLAY` (should be `:99`)

**Orphaned processes after deployment**:
- Check PM2 logs: `pm2 logs hyperscape-duel`
- Manually kill orphaned bun processes: `pkill -f "bun.*packages/server"`
- Verify database connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'hyperscape';`

### Admin Dashboard Issues

**Logs not appearing**:
- Verify admin authentication (requires admin role)
- Check ring buffer size: `Logger.getRecentLogs().length`
- Ensure auto-refresh is enabled

**Maintenance mode not working**:
- Check `/admin/maintenance/status` endpoint
- Verify no active duels: `safeToDeploy` should be `true`
- Check market status: `marketStatus` should be `PAUSED`

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI assistant instructions (this file)
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
