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

### Server/Streaming (Vast.ai)
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- Must run non-headless with Xorg or Xvfb (WebGPU requires window context)
- **Chrome Beta Channel**: Use `google-chrome-beta` (Chrome Beta) for WebGPU streaming on Linux NVIDIA (best stability and WebGPU support)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
- If WebGPU cannot initialize, deployment MUST FAIL

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on Three.js WebGPURenderer with TSL shaders.

## CRITICAL: Secrets and Private Keys

**Never put private keys, seed phrases, API keys, tokens, RPC secrets, or wallet secrets into any file that could be committed.**

- ALWAYS use local untracked `.env` files for real secrets
- NEVER hardcode secrets in source files, tests, docs, JSON fixtures, scripts, config files, or workflow YAML
- NEVER put real secrets in `.env.example`; placeholders only
- If a secret is needed in production or CI, use the platform secret store, not a tracked file
- If a task requires a new secret, document the variable name and load it from `.env`, `.env.local`, or deployment secrets

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm (client/build tasks)
5. **Node.js 22+ for server** - Server runtime migrated from Bun (March 2026)
6. **Strong typing** - Prefer classes over interfaces
7. **Secrets stay out of git** - Real keys must only come from local `.env` files or secret managers

## Tech Stack

- **Runtime**: 
  - **Client/Build**: Bun v1.3.10+ (upgraded from 1.1.38 for Vite 6+ compatibility)
  - **Server**: Node.js 22+ (migrated from Bun for V8 incremental GC - March 2026)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0
- **Server**: Fastify (HTTP), uWebSockets.js (game WebSocket), LiveKit (voice)
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
bun run duel         # Full duel stack (game + agents + streaming)
npm test             # Run tests
```

## File Structure

```
packages/
├── shared/          # Core engine (ECS, Three.js, PhysX, networking, React UI)
├── server/          # Game server (Fastify, uWebSockets.js, PostgreSQL)
├── client/          # Web client (Vite + React)
├── plugin-hyperscape/ # ElizaOS AI agent plugin
├── physx-js-webidl/ # PhysX WASM bindings
├── procgen/         # Procedural generation (terrain, biomes, vegetation)
├── asset-forge/     # AI asset generation + VFX catalog
├── duel-oracle-evm/ # EVM duel outcome oracle contracts
├── duel-oracle-solana/ # Solana duel outcome oracle program
└── contracts/       # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

## Recent Changes (March 2026)

### Tree Dissolve Transparency System (March 27, 2026)

**Change** (PR #1101): Added dissolve transparency for depleted trees with smooth respawn animation.

**Features**: Depleted trees become 80% transparent instantly on depletion and animate back to full opacity over 0.3s on respawn. Uses per-instance dissolve attributes (InstancedMesh) and batch color blue channel (BatchedMesh) to drive real alpha transparency in the TSL shader.

**Key Implementation**:
- **Shared Animation Module**: `DissolveAnimation.ts` provides `startDissolve()` and `tickDissolveAnims()` for both instancer types
- **GPU Attribute Encoding**: Blue channel of batch color encodes `1.0 - dissolveVal` (1.0 = fully visible, 0.0 = fully dissolved)
- **Dithered Discard**: Uses Bayer 4×4 screen-door dithering in `alphaTestNode` instead of alpha blending to keep trees in opaque render pass with full early-Z rejection
- **LOD Transition Preservation**: Dissolve state carries over during LOD swaps to prevent visual pops
- **Atomic Initial Dissolve**: Pass `initialDissolve` through `addInstance()` → `addToPool()` so depleted trees have GPU attribute set at pool insertion time (no 1-frame flash)

**New Files**:
- `packages/shared/src/systems/shared/world/DissolveAnimation.ts` - Shared dissolve animation state machine

**Configuration** (`packages/shared/src/systems/shared/world/GPUMaterials.ts`):
```typescript
GPU_VEG_CONFIG = {
  DISSOLVE_DURATION: 0.3,  // Animation duration (seconds)
  DISSOLVE_MAX: 1.0,       // Max dissolve progress (not visual opacity)
  FADE_START: 40,          // Distance fade start (meters)
  FADE_END: 60,            // Distance fade end (meters)
}
```

**Impact**: 
- Visual feedback for resource depletion/respawn
- No performance cost (opaque render pass with early-Z)
- Smooth animations without visual pops during LOD transitions
- Eliminates ~60 lines of duplication between instancer files

### Tree Collision Proxy Improvements (March 27, 2026)

**Change** (PR #1100): Use LOD2 model geometry for tree collision proxy instead of oversized invisible cylinder.

**Problem**: The invisible cylinder hitbox was too large, causing ground clicks near trees to be intercepted by the collision proxy instead of registering as ground clicks.

**Fix**: Replace cylinder with actual LOD2 mesh geometry so clicks only register on the visible tree silhouette. Falls back to tighter cylinder (0.25 radius factor) if LOD unavailable.

**Key Features**:
- **Geometry Caching**: Cache merged+scaled proxy geometry per `(sourceGeometries, scale)` to avoid redundant merges
- **Multi-Part Merging**: Merge multi-part geometries (bark + leaves) into single proxy mesh
- **Defensive Bounding Box**: Pre-compute `boundingBox` alongside `boundingSphere` to prevent lazy mutation by Three.js raycaster
- **Float Key Safety**: Round scale key to 3 decimal places to prevent floating-point cache misses

**New Functions** (`packages/shared/src/systems/shared/world/GLBTreeBatchedInstancer.ts`, `GLBTreeInstancer.ts`):
- `getProxyGeometry()` - Returns stable source geometry refs for collision proxy (callers MUST clone before mutating)
- `clearProxyGeometryCache()` - Dispose cached geometries during world teardown

**Implementation**:
```typescript
// Get LOD2 geometry for collision proxy
const proxyData = getProxyGeometry(entityId);
if (proxyData) {
  const merged = mergeGeometries(proxyData.geometries);
  const scaled = merged.clone().scale(scale, scale, scale);
  // Use scaled geometry for raycasting
}
```

**Impact**: 
- Clicks only register on visible tree silhouette
- Prevents ground clicks near trees from being intercepted
- More accurate interaction hitboxes
- Cached geometry reduces CPU overhead

### Resource Respawn System Changes (March 27, 2026)

**Change** (PR #1099): Make resource respawn purely tick-based and use manifest `depleteChance` for mining.

**Problem**: Legacy `setTimeout`-based respawn in `ResourceEntity.deplete()` was non-deterministic and didn't match OSRS tick-based mechanics. Mining used hardcoded `MINING_DEPLETE_CHANCE` constant instead of reading from manifest, preventing rune essence rocks (depleteChance: 0) from working correctly.

**Fix**: Remove `setTimeout` respawn — respawn is now exclusively handled by `ResourceSystem.processRespawns()` via deterministic tick counting. Mining depletion now reads `depleteChance` from manifest.

**Key Changes**:
- **Tick-Based Respawn**: `ResourceSystem.processRespawns()` counts ticks since depletion and respawns at `respawnTicks` threshold
- **Manifest depleteChance**: Mining reads `depleteChance` from resource manifest (0.0 = never depletes, 1.0 = always depletes)
- **Removed Constants**: `MINING_DEPLETE_CHANCE` and `MINING_REDWOOD_DEPLETE_CHANCE` removed in favor of manifest values

**Implementation**:
```typescript\n// Manifest-based depletion (mining)\nconst depleteChance = resourceData.depleteChance ?? 1.0;\nif (Math.random() < depleteChance) {\n  resource.deplete();\n}\n\n// Tick-based respawn (ResourceSystem)\nif (ticksSinceDepleted >= resource.respawnTicks) {\n  resource.respawn();\n}\n```\n\n**Impact**: \n- OSRS-accurate tick-based respawn mechanics\n- Rune essence rocks (depleteChance: 0) never deplete per OSRS behavior\n- Deterministic respawn timing\n- Manifest-driven resource configuration\n\n**Tests**: Added tests for `depleteChance: 0` (essence rocks) and `depleteChance: 1.0` (regular ores).\n\n### Tool Validation System Overhaul (March 27, 2026)

**Change** (PR #1098): Manifest-based tool validation to prevent cross-skill tool usage.

**Problem**: Substring matching allowed pickaxes to cut trees and hatchets to mine rocks because "pickaxe" contains "axe". This violated OSRS mechanics where tools are skill-specific.

**Fix**: Use `tools.json` manifest as single source of truth. Each tool declares its skill explicitly ("woodcutting", "mining", "fishing"). Manifest lookup prevents cross-skill usage.

**Key Features**:
- **Manifest-First Validation**: `getExternalTool()` lookup with explicit skill comparison
- **Fallback Guards**: Substring fallback with symmetric exclusions (hatchet rejects "pickaxe", pickaxe rejects "hatchet")
- **Warn-Once Logging**: Bounded Set (max 50 entries) prevents log flooding for unmanifested tools
- **Fishing Tool Exact Match**: Fishing tools require exact ID match (not interchangeable like pickaxe tiers)

**New Utilities** (`packages/shared/src/systems/shared/entities/gathering/ToolUtils.ts`):
- `itemMatchesToolCategory()` - Manifest-based tool validation with fallback guards
- `getToolCategory()` - Extract tool category from item ID
- `CATEGORY_TO_SKILL` - Map tool categories to gathering skills
- `_resetFallbackWarnings()` - Test helper for warning cache isolation

**Implementation**:
```typescript
// Manifest-based validation (primary path)
const toolData = getExternalTool(lowerItemId);
if (toolData) {
  const expectedSkill = CATEGORY_TO_SKILL[category] ?? category;
  return toolData.skill === expectedSkill;
}

// Fallback with cross-skill guards
if (category === "hatchet") {
  if (lowerItemId.includes("pickaxe") || lowerItemId.includes("pick")) {
    return false; // Reject pickaxes for woodcutting
  }
  return lowerItemId.includes("hatchet");
}
```

**Impact**: 
- Prevents cross-skill tool usage (pickaxe for woodcutting, hatchet for mining)
- Forces all gathering tools to be in manifest for proper validation
- Eliminates false positives from combat weapons (battleaxe, greataxe)
- Maintains OSRS-accurate fishing tool behavior (exact match required)

**Tests**: 15 new tests covering manifest validation, cross-skill rejection, fallback warnings, and fishing tool exact matching.

### Gathering Tool Visual Display Fix (March 27, 2026)

**Change** (Commit 1f789cb): Show correct tool in hand for all gathering skills, not just fishing.

**Problem**: Fishing-only gate in `GATHERING_TOOL_SHOW/HIDE` events meant woodcutting and mining didn't display tools. A player with a pickaxe equipped and hatchet in inventory would visually swing the pickaxe at trees.

**Fix**: Remove fishing-only gate so all gathering skills (woodcutting, mining, fishing) display the correct tool during gathering actions.

**Impact**: 
- Woodcutting now shows hatchet in hand (overrides equipped weapon)
- Mining now shows pickaxe in hand (overrides equipped weapon)
- Visual feedback matches actual tool being used

### Mob Level Display Fix (March 27, 2026)

**Change** (PR #1097): Fixed duplicate mob levels showing in right-click context menus.

**Problem**: Mob names like "Bandit (Lv8)" would show as "Attack Bandit (Lv8) (Level: 8)", displaying the level twice.

**Fix**: Strip trailing `(Lv#)` suffix from mob display names before building context menu labels.

**Impact**: Context menus now show clean mob names without duplicate level information.

### Home Teleport Polish (March 26, 2026)

**Change** (PR #1095): Polished home teleport cast effects and cooldown flow.

**Features**: Visual cast effects, cooldown system (30s), minimap orb integration, smooth teleport animation.

**Key Changes**:
- Cooldown reduced from 15 minutes to 30 seconds
- Server sends `remainingMs` in cooldown rejection packets
- Dedicated channel-mode portal effect with terrain-aware anchoring
- Both `HomeTeleportButton` and `MinimapHomeTeleportOrb` show cooldown progress

### Player Death System Overhaul (March 26, 2026)

**Change** (PR #1094): Complete rewrite of player death pipeline to fix SQLite deadlock, equipment duplication, and implement OSRS-style "keep 3 most valuable items" for safe zone deaths.

**Key Features**:
- **Two-Phase Persist Pattern**: In-memory clear inside transaction, DB persist after transaction
- **OSRS Keep-3 System**: Safe zone deaths keep 3 most valuable items (by manifest value)
- **Event Migration**: `PLAYER_DIED` deprecated → use `PLAYER_SET_DEAD` or `ENTITY_DEATH`
- **Gravestone Privacy**: Loot items hidden from broadcast, only sent to interacting player
- **Death Lock Recovery**: Persist kept items in death lock for crash recovery
- **Persist Retry Queue**: Single-retry queue for post-transaction DB persist failures

**New Utilities** (`packages/shared/src/systems/shared/combat/DeathUtils.ts`):
- `sanitizeKilledBy()` - XSS/Unicode/injection protection
- `splitItemsForSafeDeath()` - OSRS keep-3 with stack handling
- `validatePosition()` - Position validation and clamping
- `GRAVESTONE_ID_PREFIX` - Constant for gravestone entity ID filtering

**Breaking Changes**:
- `PLAYER_DIED` event is deprecated - use `PLAYER_SET_DEAD` instead
- Death lock schema now includes `keptItems` field

### Dialogue and Skilling Panel Polish (March 26, 2026)

**Change** (PR #1093): Unified skilling panel layouts and redesigned NPC dialogue system with dedicated in-world panels.

**Skilling Panel Improvements**:
- **Shared Components**: `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector` in `SkillingPanelShared.tsx`
- **Unified Layouts**: All skilling panels (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) use consistent styling
- **Quantity Selector**: Reusable component with preset buttons (1, 5, 10, All, X) and custom input mode

**Dialogue System Redesign**:
- **DialoguePopupShell**: Dedicated modal shell for NPC dialogue with focus management
- **DialogueCharacterPortrait**: Live 3D VRM portrait rendering in dialogue panels
- **Service Handoff Fix**: Opening bank/store/tanner properly closes dialogue

**Impact**: Eliminates ~500 lines of duplicated styling, more immersive NPC interactions.

### Game UI Tab Arrow Key Capture Fix (March 26, 2026)

**Change** (PR #1092): Fixed arrow keys being consumed by in-game panel tabs, preventing camera controls.

**Fix**: Added `reserveArrowKeys` prop to disable arrow key consumption for game windows.

**Impact**: Arrow keys now control camera movement even when panel tabs have focus.

### Missing Packet Handlers Fix (March 26, 2026)

**Change** (PR #1091): Added 8 missing server→client packet handlers.

**Missing Handlers**: `onFletchingComplete`, `onCookingComplete`, `onSmeltingComplete`, `onSmithingComplete`, `onCraftingComplete`, `onTanningComplete`, `onCombatEnded`, `onQuestStarted`

**Impact**: Eliminates "No handler for packet" errors.

### Prayer Login Sync Fix (March 26, 2026)

**Change** (PR #1090): Fixed prayer state synchronization on player login.

**Impact**: Prayer points and active prayers now sync correctly between sessions.

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

**Impact**: 
- Eliminates 100% CPU usage when dev server is idle
- Reduces unnecessary file system polling
- Better developer experience with lower resource consumption
- No impact on rebuild responsiveness (200ms debounce still active)

### Docker Build Improvements (March 15, 2026)

**Change** (PR #1033, Commit 7519105): Major Dockerfile improvements for production deployment.

**Key Changes**:
- **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds
- **Client Build**: Added `packages/client` build to Docker image (required for multi-service deployments)
- **Workspace Symlinks**: Manually recreate Bun workspace symlinks after Docker COPY (COPY flattens symlinks)
- **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root - explicitly copy package-level node_modules
- **better-sqlite3 Removal**: Strip from manifests before install (segfaults under QEMU cross-compilation)
- **Manifest Embedding**: Copy manifests from builder stage to ensure cleaned versions are used

**Implementation** (`packages/server/Dockerfile`):
```dockerfile
# Builder stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS builder

# Build client (required for multi-service template)
WORKDIR /app/packages/client
RUN bun run build

# Runtime stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS runtime

# Copy per-package node_modules (Bun 1.3 doesn't hoist)
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Restore workspace symlinks (Docker COPY flattens them)
RUN bun install --production
```

**Impact**: 
- Production Docker images now build successfully with Vite 6+
- Client and server can run from same image (multi-service deployments)
- Workspace dependencies resolve correctly at runtime
- No more QEMU segfaults from better-sqlite3

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

**Impact**:
- Latest build tooling with improved performance and faster builds
- Better React 19 compatibility with new Fast Refresh implementation
- Updated testing environment with Jest 30.x and jsdom 29.x
- Latest VRM avatar features and improvements
- Improved mobile wallet support for Solana
- Updated TypeScript definitions matching Three.js 0.183.2
- Enhanced test coverage reporting with Vitest 4.1
- SQLite 6.x with performance improvements and bug fixes

See CLAUDE.md for complete documentation.
