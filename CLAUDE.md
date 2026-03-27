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

### Tree Collision Proxy Improvements (March 27, 2026)

**Change** (PR #1100): Use LOD2 model geometry for tree collision proxy instead of oversized cylinder.

**Problem**: Trees used an invisible cylinder hitbox with 0.4 radius factor, which was much larger than the visible tree silhouette. Ground clicks near trees were being intercepted by the collision proxy, making it difficult to click on the ground near trees.

**Fix**: Replace cylinder with actual LOD2 mesh geometry so clicks only register on the visible tree silhouette. Multi-part geometries (bark + leaves) are merged into a single proxy mesh. Falls back to tighter cylinder (0.25 radius factor) if LOD unavailable.

**Key Features**:
- **Geometry-Based Proxy**: Uses actual LOD2 model geometry for accurate collision detection
- **Multi-Part Merging**: `mergeGeometries()` combines bark and leaves into single proxy mesh
- **Proxy Geometry Cache**: Cache merged+scaled proxy geometry per `(sourceGeometries, scale)` to avoid redundant merges
- **Defensive Filtering**: Filters out geometry parts missing position attribute before merging
- **Bulk Copy Optimization**: Uses `Float32Array.set()` for non-interleaved position buffers
- **Shared Geometry Safety**: Proxy mesh geometry is shared (read-only) - callers must clone before mutating
- **Cache Cleanup**: `clearProxyGeometryCache()` disposes cached geometries during world teardown
- **Float Key Safety**: Round scale key to 3 decimal places to prevent floating-point cache misses

**New Utilities** (`packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`, `GLBTreeBatchedInstancer.ts`):
```typescript
/**
 * Get proxy geometry for collision detection.
 * Returns stable source geometry refs (not live InstancedMesh geometry).
 * 
 * CALLERS MUST CLONE BEFORE MUTATING - geometry is shared across all instances.
 * 
 * @returns Array of source geometries for LOD2, or undefined if unavailable
 */
export function getProxyGeometry(): THREE.BufferGeometry[] | undefined

/**
 * Merge multiple geometries into a single geometry.
 * Filters out parts missing position attribute.
 * Uses bulk copy for non-interleaved buffers.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null

/**
 * Clear the proxy geometry cache and dispose all cached geometries.
 * Called during world teardown to prevent memory leaks.
 */
export function clearProxyGeometryCache(): void
```

**Implementation** (`packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`):
```typescript
// Get LOD2 source geometries from instancer
const proxyData = this.instancer.getProxyGeometry?.();

if (merged && proxyData) {
  // Clone and merge multi-part geometries (bark + leaves)
  const clonedParts = proxyData.map((g) => g.clone());
  const mergedGeometry = mergeGeometries(clonedParts);
  
  if (mergedGeometry) {
    // Scale to match instance scale
    mergedGeometry.scale(scale.x, scale.y, scale.z);
    
    // Cache the merged+scaled geometry
    const cacheKey = `${sourceGeometries.join(',')}:${scale.x.toFixed(3)}`;
    proxyGeometryCache.set(cacheKey, mergedGeometry);
    
    // Create proxy mesh with cached geometry
    const proxyMesh = new THREE.Mesh(mergedGeometry);
    proxyMesh.position.copy(position);
    proxyMesh.visible = false;
    return proxyMesh;
  }
}

// Fallback to tighter cylinder if LOD unavailable
const radius = boundingSphere.radius * 0.25; // Reduced from 0.4
```

**Impact**:
- Accurate click detection on tree silhouettes
- Ground clicks near trees no longer intercepted
- Reduced false-positive interactions
- Memory-efficient geometry caching
- Proper cleanup during world teardown

**Tests**: Existing tree interaction tests verify collision proxy behavior.

**Files Changed**: 7 files, 312 additions, 27 deletions

### Resource Respawn System Overhaul (March 27, 2026)

**Change** (PR #1099): Made resource respawn purely tick-based and use manifest `depleteChance` for mining.

**Problem**: Legacy `setTimeout`-based respawn in `ResourceEntity.deplete()` was unreliable and non-deterministic. Mining used hardcoded `MINING_DEPLETE_CHANCE` constant instead of manifest values, preventing rune essence rocks (depleteChance: 0) from working correctly.

**Fix**: Remove `setTimeout` respawn entirely. Respawn is now exclusively handled by `ResourceSystem.processRespawns()` via deterministic tick counting (OSRS-accurate). Mining depletion now reads `depleteChance` from manifest.

**Key Changes**:
- **Tick-Based Respawn**: `ResourceSystem.processRespawns()` is the single source of truth for respawn timing
- **Manifest Depletion**: Mining reads `depleteChance` from manifest instead of hardcoded constant
- **Rune Essence Support**: Resources with `depleteChance: 0` never deplete (OSRS-accurate)
- **Removed Dead Code**: Deleted unused `MINING_DEPLETE_CHANCE` and `MINING_REDWOOD_DEPLETE_CHANCE` constants

**Implementation** (`packages/shared/src/entities/world/ResourceEntity.ts`):
```typescript
// OLD (unreliable setTimeout)
public deplete(): void {
  this.isDepleted = true;
  this.respawnTimer = setTimeout(() => {
    this.respawn();
  }, this.respawnTime);
}

// NEW (tick-based, handled by ResourceSystem)
public deplete(): void {
  this.isDepleted = true;
  this.depletedAtTick = this.world.currentTick;
  // No setTimeout - ResourceSystem.processRespawns() handles respawn
}
```

**Mining Depletion** (`packages/shared/src/systems/shared/entities/gathering/MiningSystem.ts`):
```typescript
// Read depleteChance from manifest (fallback to 1.0 for safety)
const depleteChance = resourceManifest.depleteChance ?? 1.0;

// Roll for depletion
if (Math.random() < depleteChance) {
  resource.deplete();
  this.logger.debug(`Resource ${resource.id} depleted (chance: ${depleteChance})`);
}
```

**Impact**:
- Deterministic OSRS-accurate respawn timing
- Rune essence rocks work correctly (never deplete)
- Eliminates race conditions from setTimeout
- Consistent with forestry system (already tick-based)

**Tests**: 2 new tests covering `depleteChance: 0` (essence rock) and `depleteChance: 1.0` (regular ore) depletion behavior.

**Files Changed**: 4 files, 89 additions, 35 deletions

### Tool Validation System Overhaul (March 27, 2026)

**Change** (PR #1098): Manifest-based tool validation to prevent cross-skill tool usage.

**Problem**: Substring matching in `itemMatchesToolCategory()` allowed pickaxes to cut trees and hatchets to mine rocks because "pickaxe" contains "axe". This violated OSRS mechanics where tools are skill-specific.

**Fix**: Use `tools.json` manifest as single source of truth. Each tool declares its skill explicitly ("woodcutting", "mining", "fishing"). Manifest lookup prevents cross-skill usage. Substring fallback has symmetric exclusions to prevent false positives.

**Key Features**:
- **Manifest-First Validation**: Primary path uses `getExternalTool()` lookup with explicit skill comparison
- **Fallback Guards**: Hatchet fallback rejects items containing "pickaxe"/"pick", pickaxe fallback rejects "hatchet"
- **Warn-Once Logging**: Bounded Set (max 50 entries) prevents log flooding for unmanifested tools
- **Fishing Tool Exact Match**: Fishing tools require exact ID match (not interchangeable like pickaxe tiers)
- **Category-to-Skill Mapping**: `CATEGORY_TO_SKILL` map must be updated when new gathering skills are added

**New Utilities** (`packages/shared/src/systems/shared/entities/gathering/ToolUtils.ts`):\n```typescript\n// Manifest-based tool validation with fallback guards\nexport function itemMatchesToolCategory(\n  itemId: string,\n  category: string,\n): boolean\n\n// Extract tool category from item ID\nexport function getToolCategory(toolRequired: string): string\n\n// Map tool categories to gathering skills\nconst CATEGORY_TO_SKILL: Partial<Record<string, GatheringSkill>> = {\n  hatchet: \"woodcutting\",\n  pickaxe: \"mining\",\n}\n\n// Test helper for warning cache isolation\nexport function _resetFallbackWarnings(): void\n```\n\n**Implementation Example**:\n```typescript\n// Manifest-based validation (primary path)\nconst toolData = getExternalTool(lowerItemId);\nif (toolData) {\n  const expectedSkill = CATEGORY_TO_SKILL[category] ?? category;\n  return toolData.skill === expectedSkill;\n}\n\n// Fallback with cross-skill guards\nif (category === \"hatchet\") {\n  if (lowerItemId.includes(\"pickaxe\") || lowerItemId.includes(\"pick\")) {\n    return false; // Reject pickaxes for woodcutting\n  }\n  return lowerItemId.includes(\"hatchet\");\n}\n```\n\n**Impact**: \n- Prevents cross-skill tool usage (pickaxe for woodcutting, hatchet for mining)\n- Forces all gathering tools to be in manifest for proper validation\n- Eliminates false positives from combat weapons (battleaxe, greataxe)\n- Maintains OSRS-accurate fishing tool behavior (exact match required)\n\n**Tests**: 15 new tests covering manifest validation, cross-skill rejection, fallback warnings, and fishing tool exact matching.\n\n**Files Changed**: 2 files, 234 additions, 31 deletions\n\n### Gathering Tool Visual Display Fix (March 27, 2026)\n\n**Change** (Commit 1f789cb): Show correct tool in hand for all gathering skills, not just fishing.\n\n**Problem**: Fishing-only gate in `GATHERING_TOOL_SHOW/HIDE` event handlers meant woodcutting and mining didn't display tools. A player with a pickaxe equipped and hatchet in inventory would visually swing the pickaxe at trees.\n\n**Fix**: Remove fishing-only gate from `ClientGraphics.ts` so all gathering skills (woodcutting, mining, fishing) display the correct tool during gathering actions.\n\n**Implementation** (`packages/shared/src/systems/client/ClientGraphics.ts`):\n```typescript\n// OLD (fishing-only)\nif (data.skill === 'fishing') {\n  this.handleGatheringToolShow(data);\n}\n\n// NEW (all gathering skills)\nthis.handleGatheringToolShow(data);\n```\n\n**Impact**: \n- Woodcutting now shows hatchet in hand (overrides equipped weapon)\n- Mining now shows pickaxe in hand (overrides equipped weapon)\n- Visual feedback matches actual tool being used\n- Consistent behavior across all gathering skills\n\n**Files Changed**: 1 file, 2 additions, 4 deletions\n\n### Mob Level Display Fix (March 27, 2026)

**Change** (PR #1097): Fixed duplicate mob levels showing in right-click context menus.

**Problem**: Mob names like "Bandit (Lv8)" would show as "Attack Bandit (Lv8) (Level: 8)" in context menus, displaying the level twice.

**Fix**: Strip trailing `(Lv#)` suffix from mob display names before building context menu labels. The authoritative level from mob data is still shown in the full "(Level: X)" format.

**Implementation** (`packages/shared/src/systems/client/interaction/handlers/MobInteractionHandler.ts`):
```typescript
private getDisplayName(name: string): string {
  return name.replace(/\s*\(Lv\d+\)\s*$/u, "");
}
```

**Impact**: Context menus now show clean mob names without duplicate level information.

**Files Changed**: 2 files, 33 additions, 5 deletions

### Home Teleport Polish (March 26, 2026)

**Change** (PR #1095): Polished home teleport cast effects and cooldown flow.

**Features**:
- **Visual Cast Effects**: Dedicated channel-mode portal effect with veil and orbital rings
- **Cooldown System**: 30-second cooldown with server-authoritative remaining time
- **UI Integration**: Both `HomeTeleportButton` and `MinimapHomeTeleportOrb` show cooldown progress
- **Smooth Animations**: Cast progress bar, cooldown refill visual, portal formation effects
- **Terrain-Aware Anchoring**: Portal effect anchored to player's lowest bone position for grounded appearance

**Constants** (`packages/shared/src/constants/GameConstants.ts`):
```typescript
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30 * 1000,        // 30 seconds (reduced from 15 minutes)
  CAST_TIME_MS: 10 * 1000,       // 10 seconds (interruptible)
  CAST_TIME_TICKS: 17,           // ~17 ticks at 600ms/tick
} as const;
```

**New Utilities** (`packages/client/src/game/hud/homeTeleportUi.ts`):
- `readHomeTeleportRemainingMs()` - Extract remaining cooldown from server event
- `getHomeTeleportCooldownProgress()` - Calculate cooldown progress percentage

**Server Changes** (`packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts`):
- `formatCooldownRemaining()` - Format cooldown as "Xm Ys" or "Xs"
- Server now sends `remainingMs` in `homeTeleportFailed` packet when blocked by cooldown

**Impact**: 
- Polished teleport experience with clear visual feedback
- Server-authoritative cooldown prevents client-side manipulation
- Cooldown reduced from 15 minutes to 30 seconds for better gameplay flow

**Files Changed**: 8 files, 649 additions, 53 deletions

### Player Death System Overhaul (March 26, 2026)

**Change** (PR #1094): Complete rewrite of player death pipeline to fix SQLite deadlock, equipment duplication, and implement OSRS-style "keep 3 most valuable items" for safe zone deaths.

**Root Cause**: Death transaction called `clearEquipmentAndReturn()` and `clearInventoryImmediate()` which each opened nested DB transactions inside the outer `executeInTransaction()`, causing SQLite to deadlock silently. Players would play the death animation but never respawn.

**Key Fixes**:
1. **Two-Phase Persist Pattern**: In-memory clear inside transaction, DB persist after transaction completes
2. **OSRS Keep-3 System**: Safe zone deaths keep 3 most valuable items (by manifest value), returned on respawn
3. **Event Migration**: All `PLAYER_DIED` subscribers migrated to `ENTITY_DEATH` (deprecated event)
4. **Gravestone Privacy**: Loot items stripped from network broadcast, only sent to interacting player
5. **Death Lock Recovery**: Persist kept items in death lock for crash recovery
6. **Persist Retry Queue**: Single-retry queue (bounded to 100 entries) for post-transaction DB persist failures
7. **Duel Respawn Guard**: Block respawn during active duels to prevent escape exploit
8. **Death Processing Guard**: Prevent respawn race while death transaction is in progress

**New Utilities** (`packages/shared/src/systems/shared/combat/DeathUtils.ts`):
```typescript
// XSS/Unicode/injection protection for killer names
export function sanitizeKilledBy(killedBy: unknown): string

// OSRS keep-3 with stack handling (O(n log n) on unique items)
export function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number,
): { kept: InventoryItem[]; dropped: InventoryItem[] }

// Position validation and clamping to world bounds
export function validatePosition(position: {
  x: number; y: number; z: number;
}): { x: number; y: number; z: number } | null

// Bounds checking without clamping
export function isPositionInBounds(position: {
  x: number; y: number; z: number;
}): boolean

// Gravestone entity ID prefix constant
export const GRAVESTONE_ID_PREFIX = "gravestone_"
```

**New Types** (`packages/shared/src/systems/shared/combat/DeathTypes.ts`):
- `PlayerSystemLike` - Duck-typed interface for PlayerSystem
- `DatabaseSystemLike` - Duck-typed interface for DatabaseSystem
- `EquipmentSystemLike` - Duck-typed interface for EquipmentSystem
- `TerrainSystemLike` - Duck-typed interface for TerrainSystem
- `NetworkLike` - Duck-typed interface for network layer
- `TickSystemLike` - Duck-typed interface for TickSystem
- `PlayerEntityLike` - Duck-typed interface for player entities
- `DeathLocationDataWithHeadstone` - Extended death location data

**Breaking Changes**:
- `PLAYER_DIED` event is deprecated - use `PLAYER_SET_DEAD` for client death UI, or `ENTITY_DEATH` for server-side death processing
- Death lock schema now includes `keptItems` field for crash recovery
- `HeadstoneEntity.modify()` now syncs `lootItems` from network data (privacy fix)

**Migration Guide**:
```typescript
// ❌ OLD (deprecated)
world.on(EventType.PLAYER_DIED, (data: { playerId: string }) => {
  // Handle player death
});

// ✅ NEW (use ENTITY_DEATH with type filter)
world.on(EventType.ENTITY_DEATH, (data: { 
  entityId: string; 
  entityType: string;
  killedBy?: string;
  deathPosition?: { x: number; y: number; z: number };
}) => {
  if (data.entityType === 'player') {
    // Handle player death
  }
});
```

**Impact**: 
- Eliminates death softlock where players never respawn
- Prevents equipment duplication on death
- OSRS-accurate safe zone death mechanics (keep 3 most valuable items)
- Robust crash recovery for death-window scenarios
- Privacy-preserving gravestone loot (hidden until interaction)
- Duel escape exploit prevented

**Files Changed**: 23 files, 2,574 additions, 566 deletions

### Dialogue and Skilling Panel Polish (March 26, 2026)

**Change** (PR #1093): Unified skilling panel layouts and redesigned NPC dialogue system with dedicated in-world panels.

**Skilling Panel Improvements**:
- **Shared Components**: Extracted `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector` into `SkillingPanelShared.tsx`
- **Unified Layouts**: All skilling panels (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) now use consistent styling
- **Shared Style Helpers**: `getSkillingSelectableStyle()` and `getSkillingBadgeStyle()` for consistent visual treatment
- **Quantity Selector**: Reusable component with preset buttons (1, 5, 10, All, X) and custom input mode
- **Responsive Design**: Mobile and desktop variants with proper touch targets

**New Components** (`packages/client/src/game/panels/skilling/SkillingPanelShared.tsx`):
```typescript
// Shared panel body with intro text and empty state
export function SkillingPanelBody(props: {
  theme: Theme;
  children?: ReactNode;
  emptyMessage?: string;
  intro?: string;
})

// Shared section container with consistent styling
export function SkillingSection(props: {
  theme: Theme;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
})

// Reusable quantity selector with presets and custom input
export function SkillingQuantitySelector(props: {
  theme: Theme;
  showCustomInput: boolean;
  customQuantity: string;
  lastCustomQuantity: number;
  onCustomQuantityChange: (value: string) => void;
  onCustomSubmit: () => void;
  onCancelCustomInput: () => void;
  onPresetQuantity: (quantity: number) => void;
  allQuantity: number;
  onShowCustomInput: () => void;
})

// Style helpers for consistent visual treatment
export function getSkillingSelectableStyle(
  theme: Theme,
  selected: boolean,
  disabled?: boolean,
): CSSProperties

export function getSkillingBadgeStyle(theme: Theme): CSSProperties
```

**Dialogue System Redesign**:
- **DialoguePopupShell**: New dedicated modal shell for NPC dialogue with proper focus management and ARIA attributes
- **DialogueCharacterPortrait**: Live 3D VRM portrait rendering in dialogue panels using WebGPU viewport
- **Service Handoff Fix**: Opening bank/store/tanner now properly closes dialogue instead of leaving terminal continue step
- **Improved Layout**: Horizontal layout with portrait on left, dialogue text and responses on right

**New Components** (`packages/client/src/game/panels/dialogue/`):
```typescript
// Dedicated modal shell for dialogue with focus trap
export function DialoguePopupShell(props: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  contentStyle?: CSSProperties;
})

// Live 3D VRM portrait renderer
export const DialogueCharacterPortrait = React.memo(
  function DialogueCharacterPortrait(props: {
    world: ClientWorld;
    npcEntityId?: string;
    npcName: string;
    className?: string;
  })
)
```

**Impact**:
- Eliminates ~500 lines of duplicated styling across 5 skilling panels
- Consistent visual language for all crafting/processing interfaces
- NPC dialogue feels more immersive with live character portraits
- Service handoffs (bank, store, tanner) no longer leave orphaned dialogue panels
- Better mobile responsiveness with proper touch targets

**Files Changed**: 15 files, 1,623 additions, 1,265 deletions

### Game UI Tab Arrow Key Capture Fix (March 26, 2026)

**Change** (PR #1092): Fixed arrow keys being consumed by in-game panel tabs, preventing camera controls from working.

**Problem**: When a combined panel tab retained focus, pressing an arrow key would switch tabs instead of moving the camera.

**Fix**: Added `reserveArrowKeys` prop to `TabBar` component to disable arrow key consumption for game windows while preserving tab navigation for non-game UI.

**Implementation** (`packages/client/src/ui/components/TabBar.tsx`):
```typescript
interface TabBarProps {
  // ... other props
  /** If true, arrow keys are not consumed (reserved for camera/game controls) */
  reserveArrowKeys?: boolean;
}

// In keyboard handler:
if (reserveArrowKeys && (key === 'ArrowLeft' || key === 'ArrowRight')) {
  return; // Don't consume arrow keys - let camera controls handle them
}
```

**Impact**: Arrow keys now control camera movement even when panel tabs have focus. Enter/Space still activate tabs for keyboard accessibility.

**Files Changed**: 9 files, 392 additions, 4 deletions

### Missing Packet Handlers Fix (March 26, 2026)

**Change** (PR #1091): Added 8 missing server→client packet handlers to eliminate console errors.

**Missing Handlers** (added to `ClientNetwork.ts`):
- `onFletchingComplete` - Fletching batch finished
- `onCookingComplete` - Cooking result with burn check
- `onSmeltingComplete` - Smelting batch finished
- `onSmithingComplete` - Smithing batch finished
- `onCraftingComplete` - Crafting batch finished
- `onTanningComplete` - Tanning batch finished
- `onCombatEnded` - Combat session ended
- `onQuestStarted` - Quest begun notification

**Implementation**: Each handler forwards the packet data to the client world event bus so UI systems can react to these events.

**Impact**: Eliminates "No handler for packet" errors, UI systems can react to skill completion and combat events.

**Files Changed**: 1 file, 48 additions, 0 deletions

### Prayer Login Sync Fix (March 26, 2026)

**Change** (PR #1090): Fixed prayer state synchronization on player login.

**Problem**: Prayer points and active prayers were not syncing correctly between sessions, causing desync between client and server state.

**Fix**: Properly sync prayer state during player login sequence.

**Impact**: Prayer points and active prayers now sync correctly between sessions.

**Files Changed**: 3 files, 28 additions, 12 deletions

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

**Prevention**: Death system now has robust retry logic and crash recovery (as of PR #1094, March 26, 2026). If issues persist, check:
- Database connection pool health
- Transaction timeout settings
- Death lock TTL (should auto-expire after 5 minutes)

### Home Teleport Issues

**Symptoms**: Teleport button shows incorrect cooldown state, or cast effect doesn't appear.

**Diagnosis**:
1. Check browser console for `HOME_TELEPORT_CAST_START`, `HOME_TELEPORT_FAILED`, `PLAYER_TELEPORTED` events
2. Verify `HOME_TELEPORT_CONSTANTS.COOLDOWN_MS` is 30000 (30 seconds)
3. Check server logs for cooldown rejection messages

**Common Issues**:
- **Cast effect missing**: Ensure `ClientTeleportEffectsSystem` is initialized and listening to events
- **Cooldown stuck**: Server sends `remainingMs` in failed packet - check client is reading it correctly
- **Portal not grounded**: Verify terrain system is ready and `getHeightAt()` returns valid values

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
