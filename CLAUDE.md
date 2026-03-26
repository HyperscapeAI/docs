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
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── SQLite/PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── procgen/             # Procedural generation (terrain, biomes, vegetation)
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
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify (HTTP), uWebSockets.js (game WebSocket), LiveKit (voice)
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

## Recent Changes (March 2026)

### Player Death System Overhaul (March 26, 2026)

**Change** (PR #1094): Complete rewrite of player death pipeline to fix SQLite deadlock, equipment duplication, and implement OSRS-style "keep 3 most valuable items" for safe zone deaths.

**Root Cause**: Death transaction called `clearEquipmentAndReturn()` and `clearInventoryImmediate()` which each opened nested DB transactions inside the outer `executeInTransaction()`, causing SQLite to deadlock silently. Players would play the death animation but never respawn.

**Key Fixes**:
1. **Two-Phase Persist Pattern**: In-memory clear inside transaction, DB persist after transaction completes
2. **OSRS Keep-3 System**: Safe zone deaths keep 3 most valuable items (by manifest value), returned on respawn
3. **Event Migration**: All `PLAYER_DIED` subscribers migrated to `ENTITY_DEATH` (deprecated event)
4. **Gravestone Privacy**: Loot items stripped from network broadcast, only sent to interacting player
5. **Death Lock Recovery**: Persist kept items in death lock for crash recovery
6. **Persist Retry Queue**: Single-retry queue for post-transaction DB persist failures

**New Utilities** (`packages/shared/src/systems/shared/combat/DeathUtils.ts`):
- `sanitizeKilledBy()` - XSS/Unicode/injection protection for killer names
- `splitItemsForSafeDeath()` - OSRS keep-3 with stack handling (O(n log n) on unique items)
- `validatePosition()` - Position validation and clamping to world bounds
- `isPositionInBounds()` - Bounds checking without clamping
- `GRAVESTONE_ID_PREFIX` - Constant for gravestone entity ID filtering

**New Types** (`packages/shared/src/systems/shared/combat/DeathTypes.ts`):
- `PlayerSystemLike`, `DatabaseSystemLike`, `EquipmentSystemLike`
- `TerrainSystemLike`, `NetworkLike`, `TickSystemLike`
- `PlayerEntityLike`, `DeathLocationDataWithHeadstone`

**Breaking Changes**:
- `PLAYER_DIED` event is deprecated - use `PLAYER_SET_DEAD` instead
- Death lock schema now includes `keptItems` field for crash recovery

**Impact**: 
- Eliminates death softlock where players never respawn
- Prevents equipment duplication on death
- OSRS-accurate safe zone death mechanics
- Robust crash recovery for death-window scenarios
- Privacy-preserving gravestone loot (hidden until interaction)

**Files Changed**: 40+ files, 3,000+ additions, 800+ deletions

### Dialogue and Skilling Panel Polish (March 26, 2026)

**Change** (PR #1093): Unified skilling panel layouts and redesigned NPC dialogue system with dedicated in-world panels.

**Skilling Panel Improvements**:
- **Shared Components**: Extracted `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector` into `SkillingPanelShared.tsx`
- **Unified Layouts**: All skilling panels (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) now use consistent styling
- **Shared Style Helpers**: `getSkillingSelectableStyle()` and `getSkillingBadgeStyle()` for consistent visual treatment
- **Quantity Selector**: Reusable component with preset buttons (1, 5, 10, All, X) and custom input mode
- **Responsive Design**: Mobile and desktop variants with proper touch targets

**Dialogue System Redesign**:
- **DialoguePopupShell**: New dedicated modal shell for NPC dialogue with proper focus management
- **DialogueCharacterPortrait**: Live 3D VRM portrait rendering in dialogue panels
- **Service Handoff Fix**: Opening bank/store/tanner now properly closes dialogue instead of leaving terminal continue step
- **Improved Layout**: Horizontal layout with portrait on left, dialogue text and responses on right

**Impact**:
- Eliminates ~500 lines of duplicated styling across 5 skilling panels
- Consistent visual language for all crafting/processing interfaces
- NPC dialogue feels more immersive with live character portraits
- Service handoffs (bank, store, tanner) no longer leave orphaned dialogue panels
- Better mobile responsiveness with proper touch targets

**Files Changed**: 15 files, 1,623 additions, 1,265 deletions

### Home Teleport Feature (March 26, 2026)

**Change** (PR #1095): Polished home teleport cast effects and cooldown flow.

**Features**:
- Visual cast effects with particle animations
- Cooldown system with UI feedback
- Minimap orb integration for quick access
- Smooth teleport animation and camera transition

**Impact**: Players can quickly return to home location with polished visual feedback.

### Game UI Tab Arrow Key Capture Fix (March 26, 2026)

**Change** (PR #1092): Fixed arrow keys being consumed by in-game panel tabs, preventing camera controls from working.

**Problem**: When a combined panel tab retained focus, pressing an arrow key would switch tabs instead of moving the camera.

**Fix**: Added `reserveArrowKeys` prop to disable arrow key consumption for game windows while preserving tab navigation for non-game UI.

**Impact**: Arrow keys now control camera movement even when panel tabs have focus. Enter/Space still activate tabs for keyboard accessibility.

**Files Changed**: 9 files, 392 additions, 4 deletions

### Missing Packet Handlers Fix (March 26, 2026)

**Change** (PR #1091): Added 8 missing server→client packet handlers to eliminate console errors.

**Missing Handlers**: `onFletchingComplete`, `onCookingComplete`, `onSmeltingComplete`, `onSmithingComplete`, `onCraftingComplete`, `onTanningComplete`, `onCombatEnded`, `onQuestStarted`

**Impact**: Eliminates "No handler for packet" errors, UI systems can react to skill completion and combat events.

### Prayer Login Sync Fix (March 26, 2026)

**Change** (PR #1090): Fixed prayer state synchronization on player login.

**Impact**: Prayer points and active prayers now sync correctly between sessions.

### Equipment Panel Cross-Player Leak Fix (March 26, 2026)

**Change** (PR #1089): Fixed equipment panel showing stale data from previously inspected players.

**Problem**: Panel data was captured in closure at render time, causing stale data when switching between players.

**Fix**: Recreate `renderPanel` function when panel data changes by including data in `useMemo` dependencies.

**Impact**: Equipment panel always shows current player's data, no cross-contamination.

### Comprehensive UI Panel Upgrade (March 26, 2026)

**Change** (PR #1088): Major UI polish pass across combat, equipment, and inventory panels.

**Features**:
- Combat style banners with drag-to-action-bar support
- Fixed combat style click handling on drag overlays
- Stabilized combat banner width regardless of style count
- Auto-retaliate toggle improvements
- Optimistic UI updates for combat settings

**Impact**: More responsive and polished combat UI with better drag-and-drop integration.

### Performance & Scalability Overhaul (March 19-20, 2026)

**PR #1064**: Major architectural changes to improve server tick reliability and support 50+ concurrent players with 25+ AI agents.

**Key Changes**:
1. **Server Runtime Migration**: Bun → Node.js 22+ (V8 incremental GC eliminates 500-1200ms stop-the-world pauses)
2. **uWebSockets.js Integration**: Native pub/sub broadcasting on port 5556 (eliminates O(n) socket iteration)
3. **Agent AI Worker Thread**: Decision logic runs off main thread (eliminates 200-600ms blocking)
4. **BFS Pathfinding Optimization**: Global iteration budget, zero-allocation scratch tiles, per-tick walkability cache
5. **Terrain System Optimization**: Low-res collision (16×16), time-budgeted processing, pre-baked walkability flags
6. **Tick System Reliability**: Drift correction, health monitoring, per-handler timing

**Impact**:
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%
- Scalability: 20 players + 10 agents → 50+ players + 25+ agents

**Breaking Changes**:
- Server now requires Node.js 22+ (Bun no longer supported for server runtime)
- WebSocket port changed from 5555 → 5556 (uWS, configurable with `UWS_PORT`)
- Client `PUBLIC_WS_URL` must be updated to `ws://localhost:5556/ws`

**Configuration**:
```bash
# Server runtime (REQUIRED)
node >= 22.0.0

# WebSocket transport
UWS_ENABLED=true          # Enable uWS (default: true)
UWS_PORT=5556             # uWS port (default: 5556)
PUBLIC_WS_URL=ws://localhost:5556/ws

# Agent AI worker thread
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000  # Agent tick interval (ms)
AGENT_STAGGER_OFFSET_MS=800           # Stagger offset (ms)
MAX_AGENTS_PER_POLL=5                 # Max agents per poll cycle

# BFS pathfinding
MAX_BFS_ITERATIONS_PER_TICK=12000     # Global budget
DEFAULT_MAX_ITERATIONS=4000           # Per-call limit

# Terrain system
SERVER_COLLISION_RESOLUTION=16        # Collision mesh resolution
COLLISION_BUDGET_MS=8                 # Collision queue budget (ms)
WALKABILITY_BUDGET_MS=4               # Walkability baking budget (ms)
```

**Files Changed**: 54 files, 6,502 additions, 1,164 deletions

**Documentation**: See `docs/performance-march-2026.md` for complete details.

### VRM Material Isolation Fix (March 17, 2026)

**Change** (PR #1061, Commit 364d0a5): Isolated VRM clone materials to prevent highlight bleed across mob instances.

**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type.

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Impact**: Each mob instance now has independent highlight state.

### Mob AI Tick Processing Fix (March 17, 2026)

**Change** (PR #1060, Commit a55079e): Wired mob AI tick processing into server tick loop to enable mob state machine transitions.

**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Impact**: Mob AI state machines now function correctly (IDLE → WANDER → CHASE → ATTACK).

### Dev Server Watcher CPU Fix (March 16, 2026)

**Change** (PR #1034, Commit 7b5bf08): Fixed dev server watcher burning 100% CPU when idle.

**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms — redundant since the script already debounces rebuilds itself
2. Polling fallback does a full recursive directory walk every 1s

**Fix**: Removed `awaitWriteFinish` (redundant with existing 200ms debounce), increased polling fallback interval from 1s to 5s.

**Impact**: Eliminates 100% CPU usage when dev server is idle.

### Docker Build Improvements (March 15, 2026)

**Change** (PR #1033, Commit 7519105): Major Dockerfile improvements for production deployment.

**Key Changes**:
- **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds
- **Client Build**: Added `packages/client` build to Docker image (required for multi-service deployments)
- **Workspace Symlinks**: Manually recreate Bun workspace symlinks after Docker COPY (COPY flattens symlinks)
- **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root - explicitly copy package-level node_modules
- **better-sqlite3 Removal**: Strip from manifests before install (segfaults under QEMU cross-compilation)

**Impact**: Production Docker images now build successfully with Vite 6+.

### Dependency Updates (March 19, 2026)

**Major Updates**:
- **Vite**: 6.4.1 → 8.0.0 (major version bump for build system)
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1 (React plugin compatibility)
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (test coverage tooling)
- **jsdom**: 28.1.0 → 29.0.0 (testing environment)
- **jest**: 29.7.0 → 30.3.0 (testing framework)
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6 (smart contract tooling)
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support)
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (mobile wallet integration)
- **sqlite3**: 5.1.7 → 6.0.1 (SQLite database driver)

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

### Player Death Issues

**Symptoms**: Player plays death animation but never respawns, or equipment duplicates on death.

**Diagnosis**:
1. Check server logs for `DEATH_PERSIST_DESYNC` tag (DB persist failures)
2. Check for `AUDIT_LOG` events (reconnect with active death lock, persist retry failures)
3. Verify death lock is cleared after respawn: `SELECT * FROM death_locks WHERE player_id = ?`

**Recovery**:
```sql
-- Clear stuck death lock (use player's character ID)
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: Death system now has robust retry logic and crash recovery. If issues persist, check:
- Database connection pool health
- Transaction timeout settings
- Death lock TTL (should auto-expire after 5 minutes)

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
