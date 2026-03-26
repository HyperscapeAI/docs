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
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces
6. **Secrets stay out of git** - Real keys must only come from local `.env` files or secret managers

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
├── server/          # Game server (Fastify, WebSockets, PostgreSQL)
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

### Player Death Pipeline Overhaul (March 26, 2026)

**Change** (PR #1094): Complete rewrite of player death system to fix SQLite deadlock, prevent item duplication, and add OSRS-style "keep 3 most valuable items" mechanic.

**Root Cause**: Death transaction called `clearEquipmentAndReturn()` and `clearInventoryImmediate()` which each opened nested DB transactions inside the outer `executeInTransaction()`, causing SQLite to deadlock silently. Players would play the death animation but never respawn.

**Critical Fixes**:
1. **SQLite Deadlock**: Two-phase clear pattern — in-memory clear inside transaction, DB persist after transaction completes
2. **Item Duplication**: Gravestone loot items now sync via `HeadstoneEntity.modify()` to prevent stale client-side item lists
3. **Equipment Duplication**: Atomic `clearEquipmentAndReturn()` prevents race conditions between read and clear
4. **Death State Softlock**: `deathProcessingInProgress` guard prevents respawn during async death transaction
5. **Duel Escape Exploit**: Respawn blocked during active duels in both `handleRespawnRequest` and `initiateRespawn`

**New Features**:
- **OSRS Keep-3**: In safe zones, players keep their 3 most valuable items on death (returned on respawn)
- **Event Migration**: `PLAYER_DIED` deprecated → use `PLAYER_SET_DEAD` (client UI) or `ENTITY_DEATH` (server processing)
- **Crash Recovery**: Death locks persist dropped/kept items to DB for server restart recovery
- **Persist Retry Queue**: Single-retry mechanism for post-transaction DB failures (bounded to 100 entries)

**New Utilities** (`packages/shared/src/systems/shared/combat/DeathUtils.ts`):
```typescript
// OSRS keep-3 constant
export const ITEMS_KEPT_ON_DEATH = 3;

// Gravestone ID prefix for filtering
export const GRAVESTONE_ID_PREFIX = "gravestone_";

// Input sanitization (XSS, Unicode normalization, BiDi override removal)
export function sanitizeKilledBy(killedBy: unknown): string

// OSRS-style item splitting (O(n log n) on unique items, no stack expansion)
export function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number,
): { kept: InventoryItem[]; dropped: InventoryItem[] }

// Position validation and clamping
export function validatePosition(position: { x: number; y: number; z: number }): { x: number; y: number; z: number } | null
export function isPositionInBounds(position: { x: number; y: number; z: number }): boolean
export function isValidPositionNumber(n: number): boolean
```

**Type Definitions** (`packages/shared/src/systems/shared/combat/DeathTypes.ts`):
```typescript
// Extracted interfaces for duck-typed system dependencies
export interface PlayerSystemLike { ... }
export interface DatabaseSystemLike { ... }
export interface EquipmentSystemLike { ... }
export interface TerrainSystemLike { ... }
export interface NetworkLike { ... }
export interface TickSystemLike { ... }
export interface PlayerEntityLike { ... }
export interface DeathLocationDataWithHeadstone extends DeathLocationData { ... }
```

**Death Flow Architecture**:
1. **PlayerSystem.handleDeath**: Sets entity death state (`deathState = DYING`, `emote = "death"`), emits `PLAYER_SET_DEAD` (immediate client feedback), then emits `ENTITY_DEATH`
2. **PlayerDeathSystem.handlePlayerDeath**: Processes `ENTITY_DEATH`, runs death transaction (clear inventory/equipment, create death lock, spawn gravestone), schedules tick-based respawn
3. **Tick-Based Respawn**: `processPendingRespawns()` polls all players in `DYING` state, respawns when `currentTick >= respawnTick`
4. **Kept Items Return**: On respawn, `itemsKeptOnDeath` Map is checked, items added back via `InventorySystem.addItemDirect()`

**Event Migration**:
- **DEPRECATED**: `PLAYER_DIED` (marked `@deprecated` in `event-types.ts`, no longer emitted)
- **NEW**: `ENTITY_DEATH` with `{ entityId, entityType, killedBy, deathPosition }` for server-side death processing
- **CANONICAL**: `PLAYER_SET_DEAD` with `{ playerId, isDead, deathPosition }` for client death UI state

**Crash Recovery**:
- Death locks persist `items` (dropped to gravestone) and `keptItems` (returned on respawn) to DB
- `onPlayerReconnect()` blocks inventory load when active death lock exists
- `recoverUnrecoveredDeaths()` on server startup handles unprocessed deaths from crashes
- Persist retry queue handles transient DB failures with `AUDIT_LOG` events for ops alerting

**Security Improvements**:
- `sanitizeKilledBy()`: Unicode NFKC normalization, zero-width character stripping, BiDi override removal, HTML character filtering, 64-char limit
- Duel escape prevention: Respawn blocked during active duels (defense-in-depth in two locations)
- Client-side death processing blocked: `!this.world.isServer` guard prevents client-triggered death transactions
- Gravestone privacy: `lootItems` not broadcast to all clients (only `lootItemCount` sent, full loot via `corpseLoot` packet on interaction)

**Bug Fixes**:
- `CombatantEntity`: `||` → `??` for config values (0 is now respected for `attackPower`, `defense`, `criticalChance`, etc.)
- `CombatantEntity.isDead`: Fixed method call (was property reference, always truthy)
- `PlayerLocal`: Extracted `clearDeathAnimationState()` to eliminate duplicated death→idle reset code
- `HeadstoneEntity`: Entity destruction now handled by `PlayerDeathSystem.handleCorpseEmpty()` via `EntityManager` (was unreliable `setTimeout`)

**Test Coverage**: 1,534 lines of new tests
- `DeathUtils.test.ts` (502 lines): Unit tests for sanitization, keep-3 logic, position validation, stack splitting edge cases
- `PlayerDeathFlow.test.ts` (1,032 lines): Integration tests for death guards, transaction failure recovery, tick-based respawn, persist retry queue

**Impact**:
- Players no longer stuck in death state (SQLite deadlock fixed)
- Item duplication exploits eliminated (atomic operations, network sync, entity cleanup)
- OSRS-authentic death mechanics (keep 3 most valuable items in safe zones)
- Robust crash recovery with death locks and persist retry queue
- Clean event architecture (`ENTITY_DEATH` unifies player/mob death processing)

**Files Changed**: 23 files, 2,574 additions, 566 deletions.

**Breaking Changes**:
- `PLAYER_DIED` event no longer emitted (migrate to `PLAYER_SET_DEAD` or `ENTITY_DEATH`)
- External plugins listening for `PLAYER_DIED` must update to `ENTITY_DEATH` with `entityType === "player"` filter

### Dialogue and Skilling Panel Polish (March 26, 2026)

**Change** (PR #1093): Unified skilling panel layouts and redesigned NPC dialogue system with dedicated in-world panels.

**Skilling Panel Improvements**:
- **Shared Components**: Extracted `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector` into `SkillingPanelShared.tsx`
- **Unified Layouts**: All skilling panels (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) now use consistent styling
- **Shared Style Helpers**: `getSkillingSelectableStyle()` and `getSkillingBadgeStyle()` for consistent visual treatment
- **Quantity Selector**: Reusable component with preset buttons (1, 5, 10, All, X) and custom input mode
- **Responsive Design**: Mobile and desktop variants with proper touch targets

**Implementation** (`packages/client/src/game/panels/skilling/SkillingPanelShared.tsx`):
```typescript
// Shared panel body with intro text and empty state
export function SkillingPanelBody({ theme, children, emptyMessage, intro }: SkillingPanelBodyProps)

// Themed section card for recipe groups
export function SkillingSection({ theme, children }: SkillingSectionProps)

// Reusable quantity selector with preset buttons and custom input
export function SkillingQuantitySelector({
  theme,
  showCustomInput,
  customQuantity,
  lastCustomQuantity,
  onCustomQuantityChange,
  onCustomSubmit,
  onCancelCustomInput,
  onPresetQuantity,
  allQuantity,
  onShowCustomInput,
}: SkillingQuantitySelectorProps)

// Style helpers for consistent visual treatment
export function getSkillingSelectableStyle(theme: Theme, selected: boolean, disabled = false): CSSProperties
export function getSkillingBadgeStyle(theme: Theme): CSSProperties
```

**Dialogue System Redesign**:
- **DialoguePopupShell**: New dedicated modal shell for NPC dialogue with proper focus management
- **DialogueCharacterPortrait**: Live 3D VRM portrait rendering in dialogue panels
- **Service Handoff Fix**: Opening bank/store/tanner now properly closes dialogue instead of leaving terminal continue step
- **Improved Layout**: Horizontal layout with portrait on left, dialogue text and responses on right

**Implementation** (`packages/client/src/game/panels/dialogue/DialoguePopupShell.tsx`):
```typescript
export function DialoguePopupShell({
  visible,
  title,
  children,
  onClose,
  width = 700,
  maxWidth = "min(86vw, 700px)",
  maxHeight = "min(40vh, 400px)",
  contentStyle,
}: DialoguePopupShellProps)
```

**DialogueCharacterPortrait** (`packages/client/src/game/panels/dialogue/DialogueCharacterPortrait.tsx`):
```typescript
export const DialogueCharacterPortrait = React.memo(function DialogueCharacterPortrait({
  world,
  npcEntityId,
  npcName,
  className = "",
}: DialogueCharacterPortraitProps)
```

**Service Handoff Logic** (`packages/shared/src/systems/shared/interaction/DialogueSystem.ts`):
```typescript
private isImmediateHandoffEffect(effect?: string): boolean {
  if (!effect) return false;
  const [effectName] = effect.split(":");
  return (
    effectName === "openBank" ||
    effectName === "openShop" ||
    effectName === "openStore" ||
    effectName === "openTanner"
  );
}

// In handleDialogueResponse:
if (effect && this.isImmediateHandoffEffect(effect)) {
  this.executeEffect(playerId, npcId, effect, state.npcEntityId);
  this.endDialogue(playerId, npcId);
  return;
}
```

**Dialogue Close Handlers** (`packages/client/src/hooks/useModalPanels.ts`):
```typescript
// Close dialogue when opening service panels
const handleBankOpen = (data: unknown) => {
  const d = data as BankData;
  if (d) {
    setBankData({ ...d, visible: true });
    setDialogueData(null);  // Close dialogue
  }
};

const handleStoreOpen = (data: unknown) => {
  const d = data as StoreData;
  if (d) {
    setStoreData({ ...d, visible: true });
    setDialogueData(null);  // Close dialogue
  }
};
```

**Impact**:
- Eliminates ~500 lines of duplicated styling across 5 skilling panels
- Consistent visual language for all crafting/processing interfaces
- NPC dialogue feels more immersive with live character portraits
- Service handoffs (bank, store, tanner) no longer leave orphaned dialogue panels
- Better mobile responsiveness with proper touch targets
- Reusable components reduce maintenance burden

**Files Changed**: 15 files, 1,623 additions, 1,265 deletions.

### Game UI Tab Arrow Key Capture Fix (March 26, 2026)

**Change** (PR #1092): Fixed arrow keys being consumed by in-game panel tabs, preventing camera controls from working.

**Problem**: When a combined panel tab retained focus, pressing an arrow key would switch tabs instead of moving the camera.

**Fix**: Added `reserveArrowKeys` prop to disable arrow key consumption for game windows while preserving tab navigation for non-game UI.

**Impact**: Arrow keys now control camera movement even when panel tabs have focus. Enter/Space still activate tabs for keyboard accessibility.

**Files Changed**: 9 files, 392 additions, 4 deletions.

### Missing Packet Handlers Fix (March 26, 2026)

**Change** (PR #1091): Added 8 missing server→client packet handlers to eliminate console errors.

**Missing Handlers**: `onFletchingComplete`, `onCookingComplete`, `onSmeltingComplete`, `onSmithingComplete`, `onCraftingComplete`, `onTanningComplete`, `onCombatEnded`, `onQuestStarted`

**Impact**: Eliminates "No handler for packet" errors, UI systems can react to skill completion and combat events.

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

## Recent Changes (March 2026)

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
