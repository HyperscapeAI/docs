# Hyperscape Changelog - Q1 2026 (January - April)

This document tracks all significant changes to Hyperscape during Q1 2026.

## April 2026

### Week of April 6, 2026

#### Docker Build & CI Infrastructure Improvements

**PR #1105** - Tailwind v3 Rollback & Docker Build Fixes
- **Problem**: Tailwind v4 dropped critical utilities in linux/amd64 Docker production builds
- **Solution**: Rolled back to Tailwind CSS 3.4.1 with standard PostCSS pipeline
- **Impact**: Consistent CSS output across all build environments, no more missing utilities
- **Files Changed**: 1 file, 4 additions
- **Commits**: 07a8bc7, 5eb078c, 1307fc7

**Commits 192696d-fca9ffb** - CI/CD Infrastructure Upgrades
- Upgraded GitHub Actions workflows to Node.js 24 runners
- Fixed workflow token usage for Claude review automation
- Removed unused Foundry installations from CI
- Switched Docker builds to use real Node.js for Vite builds
- Fixed empty downloads handling in CI
- Resolved Railway auth drift issues
- **Impact**: Faster CI builds, more reliable Docker images

**Commit 976d075** - Panel Affordances Restoration
- Restored visual affordances for UI panels
- Aligned test deploy flow with production requirements
- Fixed duplicate bank tab hover handler (192696d)
- **Impact**: Consistent UI panel behavior

### Week of April 5, 2026

#### Production Runtime Configuration

**Commits ba7f6f4-3f2e7d0** - Production Runtime Defaults
- Server now defaults to `hyperscape.gg` for production runtime
- Fixed local development WebSocket defaults
- ElizaOS agents use local Hyperscape uWS defaults
- Fixed server runtime and local websocket defaults (c95e51c)
- Fixed hyperscape.gg production client routing (89eb26f)
- **Impact**: Simplified production deployment, better dev/prod separation

## March 2026

### Week of March 27, 2026

#### UI Panel Tooltip Unification

**PR #1102** - Unified Panel Tooltips & Bank Equipment Layout
- Created centralized tooltip style utilities (`tooltipStyles.ts`)
- Unified tooltip behavior across all UI panels
- Improved bank equipment grid layout
- Reused shared `EquipmentPanel` in bank interface
- **New Functions**:
  - `getTooltipTitleStyle(theme, accentColor?)`
  - `getTooltipMetaStyle(theme)`
  - `getTooltipBodyStyle(theme)`
  - `getTooltipDividerStyle(theme, accentColor?)`
  - `getTooltipTagStyle(theme)`
  - `getTooltipStatusStyle(theme, tone)`
- **Impact**: Eliminated ~500 lines of duplicated styling, consistent UX
- **Files Changed**: 22 files, 1,880 additions, 837 deletions
- **Commit**: 0928550

#### Tree Dissolve Transparency System

**PR #1101** - Tree Dissolve Transparency
- Depleted trees become ~70% transparent instantly on depletion
- Animate back to full opacity over 0.3s on respawn
- Uses screen-door dithering (Bayer 4×4) to stay in opaque render pass
- **New Module**: `DissolveAnimation.ts` - Shared animation state machine
- **New APIs**:
  - `startDissolve(anims, entityId, direction, instant, applyFn)`
  - `tickDissolveAnims(anims, deltaTime, applyFn)`
- **Configuration**: `GPU_VEG_CONFIG` in `GPUMaterials.ts`
  - `DISSOLVE_DURATION: 0.3` (seconds)
  - `DISSOLVE_MAX: 1.0` (progress ceiling)
  - `DISSOLVE_ALPHA_SCALE: 0.7` (discard fraction)
- **Encoding**:
  - InstancedMesh: `instanceDissolve` Float32 attribute
  - BatchedMesh: Blue channel of batch color
- **Impact**: Visual feedback for depletion/respawn, no performance cost
- **Files Changed**: 5 files, 404 additions, 316 deletions
- **Commits**: 87f3f12, 1aa5f17, 37f2653, 7433ce0, de421cd, 284c118, 833052c, eab22a8, 5c1df5d, 414cadb, e618e90, 5d9a0e2, 25053d2, f871dc1, c2afdb9, d23bfbc, 7add25b

#### Tree Collision Proxy Improvements

**PR #1100** - LOD2 Geometry Collision Proxy
- Replaced oversized cylinder hitbox with actual LOD2 mesh geometry
- Clicks only register on visible tree silhouette
- Multi-part geometries (bark + leaves) merged into single proxy
- Falls back to tighter cylinder (0.25 radius) if LOD unavailable
- **New Functions**:
  - `getProxyGeometry(entityId)` - Get LOD geometries for collision
  - `clearProxyGeometryCache()` - Dispose cached geometries
- **Geometry Caching**: Cache merged+scaled proxy per (model, scale)
- **Impact**: Accurate click detection, ground clicks near trees work correctly
- **Files Changed**: 4 files, 243 additions, 13 deletions
- **Commits**: 9e7403f, 13800db, e28ad9c, b7d4895, 6b64ab8, c0050664, e73c02e

#### Resource Respawn System Overhaul

**PR #1099** - Tick-Based Respawn & Manifest Depletion
- Removed `setTimeout`-based respawn from `ResourceEntity.deplete()`
- Respawn now exclusively handled by `ResourceSystem.processRespawns()` via tick counting
- Mining depletion reads `depleteChance` from manifest instead of hardcoded constant
- **Removed Constants**:
  - `MINING_DEPLETE_CHANCE` (was 1.0)
  - `MINING_REDWOOD_DEPLETE_CHANCE` (was 0.091)
- **New Behavior**: Resources with `depleteChance: 0` never deplete (rune essence rocks)
- **Impact**: OSRS-accurate tick-based mechanics, deterministic respawn timing
- **Files Changed**: 4 files, 262 additions, 39 deletions
- **Tests Added**: 2 integration tests for depleteChance: 0 and 1.0
- **Commits**: 8928cd8, 6217f58

#### Tool Validation System Overhaul

**PR #1098** - Manifest-Based Tool Validation
- Replaced substring matching with manifest-first validation
- Prevents cross-skill tool usage (pickaxe for woodcutting, hatchet for mining)
- **New Utilities** (`ToolUtils.ts`):
  - `itemMatchesToolCategory(itemId, category)` - Manifest-based validation
  - `getToolCategory(itemId)` - Extract tool category
  - `CATEGORY_TO_SKILL` - Map categories to skills
  - `_resetFallbackWarnings()` - Test helper
- **Fallback Guards**: Hatchet rejects "pickaxe", pickaxe rejects "hatchet"
- **Warn-Once Logging**: Bounded Set (max 50 entries) prevents log flooding
- **Impact**: Prevents cross-skill tool usage, eliminates false positives
- **Tests Added**: 15 new tests covering manifest validation and cross-skill rejection

#### Gathering Tool Visual Display Fix

**Commit 1f789cb** - Show Correct Tool for All Gathering Skills
- Removed fishing-only gate in `GATHERING_TOOL_SHOW/HIDE` events
- Woodcutting now shows hatchet in hand
- Mining now shows pickaxe in hand
- **Impact**: Visual feedback matches actual tool being used

#### Mob Level Display Fix

**PR #1097** - Fixed Duplicate Mob Levels
- Strip trailing `(Lv#)` suffix from mob display names
- **Before**: "Attack Bandit (Lv8) (Level: 8)"
- **After**: "Attack Bandit (Lv8)"
- **Impact**: Clean context menu labels

### Week of March 26, 2026

#### Home Teleport Polish

**PR #1095** - Home Teleport Visual Effects & Cooldown
- Visual cast effects with portal animation
- Cooldown system (30s, reduced from 15 minutes)
- Server sends `remainingMs` in cooldown rejection packets
- Dedicated channel-mode portal effect with terrain-aware anchoring
- Both `HomeTeleportButton` and `MinimapHomeTeleportOrb` show cooldown progress
- **Impact**: Polished teleport experience with visual feedback

#### Player Death System Overhaul

**PR #1094** - Death System Rewrite
- Complete rewrite to fix SQLite deadlock and equipment duplication
- **Two-Phase Persist Pattern**: In-memory clear inside transaction, DB persist after
- **OSRS Keep-3 System**: Safe zone deaths keep 3 most valuable items
- **Event Migration**: `PLAYER_DIED` deprecated → use `PLAYER_SET_DEAD` or `ENTITY_DEATH`
- **Gravestone Privacy**: Loot items hidden from broadcast
- **Death Lock Recovery**: Persist kept items for crash recovery
- **Persist Retry Queue**: Single-retry for post-transaction failures
- **New Utilities** (`DeathUtils.ts`):
  - `sanitizeKilledBy()` - XSS/Unicode protection
  - `splitItemsForSafeDeath()` - OSRS keep-3 logic
  - `validatePosition()` - Position validation
  - `GRAVESTONE_ID_PREFIX` - Gravestone entity filtering
- **Breaking Changes**:
  - `PLAYER_DIED` event deprecated
  - Death lock schema includes `keptItems` field
- **Impact**: Reliable death system, OSRS-accurate item loss

#### Dialogue & Skilling Panel Polish

**PR #1093** - Unified Skilling Panels & NPC Dialogue
- **Skilling Panel Improvements**:
  - Shared components: `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector`
  - Unified layouts for Fletching, Cooking, Smelting, Smithing, Crafting, Tanning
  - Reusable quantity selector with presets (1, 5, 10, All, X)
- **Dialogue System Redesign**:
  - `DialoguePopupShell` - Dedicated modal for NPC dialogue
  - `DialogueCharacterPortrait` - Live 3D VRM portrait rendering
  - Service handoff fix (bank/store/tanner properly closes dialogue)
- **Impact**: Eliminated ~500 lines of duplicated styling, immersive NPC interactions

#### Game UI Tab Arrow Key Fix

**PR #1092** - Arrow Key Capture Fix
- Added `reserveArrowKeys` prop to disable arrow key consumption
- **Impact**: Arrow keys control camera even when panel tabs have focus

#### Missing Packet Handlers

**PR #1091** - Added 8 Missing Handlers
- Added handlers: `onFletchingComplete`, `onCookingComplete`, `onSmeltingComplete`, `onSmithingComplete`, `onCraftingComplete`, `onTanningComplete`, `onCombatEnded`, `onQuestStarted`
- **Impact**: Eliminates "No handler for packet" errors

#### Prayer Login Sync Fix

**PR #1090** - Prayer State Synchronization
- Fixed prayer points and active prayers syncing on login
- **Impact**: Prayer state persists correctly between sessions

### Week of March 19-20, 2026

#### Performance & Scalability Overhaul

**PR #1064** - Major Performance Improvements
- **Server Runtime Migration**: Bun → Node.js 22+ for V8 incremental GC
  - Eliminates 500-1200ms stop-the-world GC pauses
  - Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
  - Missed ticks: 3-5/min → 0 under normal load
- **uWebSockets.js Integration**: Native pub/sub on port 5556
  - Eliminates O(n) socket iteration
  - Efficient binary message framing
- **Agent AI Worker Thread**: Decision logic off main thread
  - Eliminates 200-600ms blocking
  - Supports 25+ concurrent AI agents
- **BFS Pathfinding Optimization**:
  - Global iteration budget (12,000 per tick)
  - Zero-allocation scratch tiles
  - Per-tick walkability cache
- **Terrain System Optimization**:
  - Low-res collision mesh (16×16)
  - Time-budgeted processing (8ms collision, 4ms walkability)
  - Pre-baked walkability flags
- **Tick System Reliability**:
  - Drift correction
  - Health monitoring
  - Per-handler timing
- **Breaking Changes**:
  - Server requires Node.js 22+ (Bun no longer supported)
  - WebSocket port: 5555 → 5556
  - Client `PUBLIC_WS_URL` must update to `ws://localhost:5556/ws`
- **Configuration**:
  - `UWS_ENABLED=true` (default)
  - `UWS_PORT=5556` (default)
  - `EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000` (ms)
  - `MAX_BFS_ITERATIONS_PER_TICK=12000`
  - `SERVER_COLLISION_RESOLUTION=16`
- **Impact**: 
  - Event loop blocking: 62.5% → <3%
  - Scalability: 20 players + 10 agents → 50+ players + 25+ agents
- **Files Changed**: 54 files, 6,502 additions, 1,164 deletions
- **Documentation**: `docs/performance-march-2026.md`

### Week of March 17, 2026

#### VRM Material Isolation Fix

**PR #1061, Commit 364d0a5** - Isolated VRM Clone Materials
- **Problem**: `SkeletonUtils.clone()` shares materials, causing highlight bleed across all mobs of same type
- **Solution**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()`
- **Impact**: Each mob instance has independent highlight state
- **Files Changed**: `packages/shared/src/rendering/materials/cloneGLB.ts`

#### Mob AI Tick Processing Fix

**PR #1060, Commit a55079e** - Wired Mob AI into Tick Loop
- **Problem**: `GameTickProcessor` never instantiated, mob AI never ticked
- **Solution**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`
- **Implementation**: AI decides movement targets, movement system executes paths (same tick)
- **Impact**: Mob AI state machines function correctly (IDLE → WANDER → CHASE → ATTACK)
- **Files Changed**: `packages/server/src/systems/ServerNetwork/index.ts`

### Week of March 16, 2026

#### Dev Server Watcher CPU Fix

**PR #1034, Commit 7b5bf08** - Fixed 100% CPU Usage
- **Problem**: `awaitWriteFinish` polling + 1s directory walk caused 100% CPU when idle
- **Solution**: 
  - Removed redundant `awaitWriteFinish` (script already debounces)
  - Increased polling fallback: 1s → 5s
- **Impact**: Eliminates idle CPU usage, better developer experience
- **Files Changed**: `packages/server/scripts/dev.mjs`

### Week of March 15, 2026

#### Docker Build Improvements

**PR #1033, Commit 7519105** - Production Docker Improvements
- **Bun 1.3.10 Upgrade**: Support for Vite 6+ builds
- **Client Build**: Added to Docker image for multi-service deployments
- **Workspace Symlinks**: Manually recreate after Docker COPY
- **Per-Package node_modules**: Explicitly copy (Bun 1.3 doesn't hoist)
- **better-sqlite3 Removal**: Strip from manifests (QEMU segfault fix)
- **Manifest Embedding**: Copy cleaned manifests from builder stage
- **Impact**: Production Docker images build successfully with Vite 6+
- **Files Changed**: `packages/server/Dockerfile`

## Summary Statistics

### April 2026
- **Pull Requests**: 1 major (PR #1105)
- **Commits**: 10+ infrastructure and bug fixes
- **Files Changed**: 25+ files
- **Lines Changed**: ~2,000 additions, ~850 deletions
- **Key Focus**: Build stability, CI/CD improvements, production deployment

### March 2026
- **Pull Requests**: 10 major (PRs #1064, #1090-1102)
- **Commits**: 50+ feature additions and fixes
- **Files Changed**: 100+ files
- **Lines Changed**: ~10,000 additions, ~2,500 deletions
- **Key Focus**: Performance optimization, UI polish, OSRS accuracy

## Breaking Changes Summary

### March 2026

1. **Server Runtime** (PR #1064)
   - **Old**: Bun runtime for server
   - **New**: Node.js 22+ required
   - **Migration**: Install Node.js 22+, update deployment scripts

2. **WebSocket Port** (PR #1064)
   - **Old**: Port 5555 for WebSocket
   - **New**: Port 5556 (uWebSockets.js)
   - **Migration**: Update `PUBLIC_WS_URL=ws://localhost:5556/ws` in client `.env`

3. **Death Events** (PR #1094)
   - **Old**: `PLAYER_DIED` event
   - **New**: `PLAYER_SET_DEAD` or `ENTITY_DEATH`
   - **Migration**: Update event listeners to use new events

4. **Death Lock Schema** (PR #1094)
   - **Old**: Death lock without kept items
   - **New**: Death lock includes `keptItems` field
   - **Migration**: Database migration runs automatically

## Dependency Updates

### Major Version Bumps (March 2026)

- **Vite**: 6.4.1 → 8.0.0
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1
- **jest**: 29.7.0 → 30.3.0
- **jsdom**: 28.1.0 → 29.0.0
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6
- **sqlite3**: 5.1.7 → 6.0.1

### Minor Version Bumps (March 2026)

- **@types/three**: 0.182.0 → 0.183.1
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0

### Rollbacks (April 2026)

- **Tailwind CSS**: v4 beta → 3.4.1 (stability)

## New Files Added

### March 2026

- `packages/shared/src/systems/shared/world/DissolveAnimation.ts` - Tree dissolve animation
- `packages/shared/src/systems/shared/combat/DeathUtils.ts` - Death system utilities
- `packages/client/src/ui/core/tooltip/tooltipStyles.ts` - Tooltip style utilities
- `packages/client/src/game/panels/dialogue/DialoguePopupShell.tsx` - Dialogue modal
- `packages/client/src/game/panels/dialogue/DialogueCharacterPortrait.tsx` - NPC portraits
- `packages/client/src/game/panels/skilling/SkillingPanelShared.tsx` - Shared skilling components

### April 2026

- `docs/api-reference-march-april-2026.md` - API documentation for new features
- `CHANGELOG-2026-Q1.md` - This changelog

## Configuration Changes

### New Environment Variables (March 2026)

**Server** (`packages/server/.env.example`):
```bash
# uWebSockets.js configuration
UWS_ENABLED=true
UWS_PORT=5556
PUBLIC_WS_URL=ws://localhost:5556/ws

# Agent AI worker thread
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000
AGENT_STAGGER_OFFSET_MS=800
MAX_AGENTS_PER_POLL=5

# BFS pathfinding
MAX_BFS_ITERATIONS_PER_TICK=12000
DEFAULT_MAX_ITERATIONS=4000

# Terrain system
SERVER_COLLISION_RESOLUTION=16
COLLISION_BUDGET_MS=8
WALKABILITY_BUDGET_MS=4
```

**Client** (`packages/client/.env.example`):
```bash
# Updated WebSocket URL (port 5556)
PUBLIC_WS_URL=ws://localhost:5556/ws
```

### Updated Configuration (March 2026)

**GPU Vegetation Config** (`GPUMaterials.ts`):
```typescript
GPU_VEG_CONFIG = {
  DISSOLVE_DURATION: 0.3,      // Tree dissolve animation duration
  DISSOLVE_MAX: 1.0,           // Max dissolve progress
  DISSOLVE_ALPHA_SCALE: 0.7,   // Discard fraction
  FADE_START: 40,              // Distance fade start (meters)
  FADE_END: 60,                // Distance fade end (meters)
}
```

**Home Teleport Constants** (`GameConstants.ts`):
```typescript
HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30000,  // 30 seconds (was 15 minutes)
  CAST_TIME_MS: 3000,  // 3 seconds
}
```

## Test Coverage Added

### March 2026

- **Resource System**: 2 tests for `depleteChance: 0` and `1.0` (PR #1099)
- **Tool Validation**: 15 tests for manifest validation and cross-skill rejection (PR #1098)
- **Death System**: Integration tests for keep-3 logic and gravestone privacy (PR #1094)
- **Prayer System**: Sync tests for login state persistence (PR #1090)

## Performance Improvements

### March 2026

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tick Blocking | 900-2400ms | 110-200ms | 81-92% reduction |
| Missed Ticks | 3-5/min | 0 | 100% reduction |
| Event Loop Blocking | 62.5% | <3% | 95% reduction |
| Max Players | 20 | 50+ | 150% increase |
| Max AI Agents | 10 | 25+ | 150% increase |
| Dev Server CPU (idle) | 100% | <5% | 95% reduction |

## Documentation Added

### April 2026

- Updated `AGENTS.md` with April 2026 changes
- Updated `CLAUDE.md` with comprehensive April 2026 section
- Updated `README.md` with recent features
- Updated `packages/server/README.md` with uWS and Node.js 22+ requirements
- Updated `packages/client/README.md` with tooltip system and recent changes
- Created `docs/api-reference-march-april-2026.md` - API reference for new features
- Created `CHANGELOG-2026-Q1.md` - This comprehensive changelog

### March 2026

- `docs/performance-march-2026.md` - Performance optimization details (PR #1064)
- Updated `CLAUDE.md` with March 2026 changes section
- Updated `AGENTS.md` with performance changes

## Migration Guides

### Migrating to Node.js 22+ Server Runtime

**Required for**: March 2026 performance update (PR #1064)

1. Install Node.js 22+:
   ```bash
   # macOS
   brew install node@22
   
   # Linux
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Update deployment scripts to use Node.js instead of Bun for server

3. Update `PUBLIC_WS_URL` in client `.env`:
   ```bash
   # Old
   PUBLIC_WS_URL=ws://localhost:5555/ws
   
   # New
   PUBLIC_WS_URL=ws://localhost:5556/ws
   ```

4. Restart server and client

### Migrating to Unified Tooltip Styles

**Required for**: March 2026 UI update (PR #1102)

1. Import tooltip style utilities:
   ```typescript
   import {
     getTooltipTitleStyle,
     getTooltipMetaStyle,
     getTooltipBodyStyle,
   } from '@/ui/core/tooltip/tooltipStyles';
   ```

2. Replace inline styles with utility functions:
   ```typescript
   // Before
   <div style={{ color: theme.colors.accent.secondary, fontWeight: 'bold' }}>
     Title
   </div>
   
   // After
   <div style={getTooltipTitleStyle(theme)}>
     Title
   </div>
   ```

3. Update tooltip rendering to use `CursorTooltip` component

### Migrating to Manifest-Based Tool Validation

**Required for**: March 2026 tool validation update (PR #1098)

1. Ensure all tools are in `tools.json` manifest:
   ```json
   {
     "id": "bronze_pickaxe",
     "name": "Bronze Pickaxe",
     "skill": "mining",
     "level": 1,
     "category": "pickaxe"
   }
   ```

2. Replace substring matching with manifest validation:
   ```typescript
   // Before
   const hasTool = itemId.toLowerCase().includes('pickaxe');
   
   // After
   import { itemMatchesToolCategory } from './ToolUtils';
   const hasTool = itemMatchesToolCategory(itemId, 'pickaxe');
   ```

### Migrating to Tick-Based Resource Respawn

**Required for**: March 2026 resource system update (PR #1099)

1. Remove any `setTimeout`-based respawn code

2. Add `depleteChance` to resource manifests:
   ```json
   {
     "id": "copper_rock",
     "type": "ore",
     "depleteChance": 1.0,
     "respawnTicks": 4
   }
   ```

3. For resources that never deplete (rune essence):
   ```json
   {
     "id": "rune_essence_rock",
     "type": "ore",
     "depleteChance": 0,
     "respawnTicks": 0
   }
   ```

## Known Issues

### April 2026

- None reported

### March 2026

- **Resolved**: Tailwind v4 production build issues (fixed in April 2026)
- **Resolved**: Player death system deadlocks (fixed PR #1094)
- **Resolved**: Prayer state sync on login (fixed PR #1090)
- **Resolved**: Mob AI not ticking (fixed PR #1060)
- **Resolved**: Dev server 100% CPU usage (fixed PR #1034)

## Contributors

Special thanks to all contributors for Q1 2026:
- @lalalune (Shaw)
- @dreaminglucid (Lucid)
- @SYMBaiEX (symbaiex)
- @mavisakalyan

## See Also

- [CLAUDE.md](CLAUDE.md) - Development guide
- [AGENTS.md](AGENTS.md) - AI assistant instructions
- [README.md](README.md) - Project overview
- [docs/performance-march-2026.md](docs/performance-march-2026.md) - Performance details
- [docs/api-reference-march-april-2026.md](docs/api-reference-march-april-2026.md) - API reference
