# Changelog - March 2026

Comprehensive changelog for all changes made to Hyperscape in March 2026.

## Table of Contents

- [Player Death System Overhaul](#player-death-system-overhaul-march-26-2026)
- [UI Improvements](#ui-improvements-march-26-2026)
- [Home Teleport Feature](#home-teleport-feature-march-26-2026)
- [Bug Fixes](#bug-fixes-march-2026)
- [Performance & Scalability](#performance--scalability-march-19-20-2026)
- [Dependency Updates](#dependency-updates-march-19-2026)
- [Docker & Build Improvements](#docker--build-improvements-march-15-2026)

## Player Death System Overhaul (March 26, 2026)

**PR**: #1094  
**Files Changed**: 40+ files, 3,000+ additions, 800+ deletions

### Summary

Complete rewrite of player death pipeline to fix critical bugs and implement OSRS-accurate mechanics.

### Fixed Issues

1. **SQLite Deadlock**: Death transaction called `clearEquipmentAndReturn()` and `clearInventoryImmediate()` which opened nested transactions, causing silent deadlock. Players would play death animation but never respawn.

2. **Equipment Duplication**: Equipment clear failed due to deadlock, causing items to appear in both gravestone and player inventory after respawn.

3. **Missing Keep-3 System**: Safe zone deaths didn't implement OSRS "keep 3 most valuable items" mechanic.

4. **Gravestone Privacy**: Loot items were broadcast to all clients, leaking player wealth.

5. **Stale Gravestones**: Looted gravestones persisted with stale items, appearing to duplicate items on next death.

### New Features

#### 1. Two-Phase Persist Pattern

In-memory clear inside transaction, DB persist after transaction completes:

```typescript
// Phase 1: Inside transaction
await this.database.executeInTransaction(async (tx) => {
  await inventorySystem.clearInventoryImmediate(playerId, { skipPersist: true });
  await equipmentSystem.clearEquipmentAndReturn(playerId, tx);  // Skips save when tx provided
  await deathStateManager.createDeathLock(playerId, deathPosition, keptItems);
});

// Phase 2: After transaction
await equipmentSystem.persistEquipmentClear(playerId);
await inventorySystem.persistInventoryClear(playerId);
```

#### 2. OSRS Keep-3 System

Safe zone deaths keep 3 most valuable items (by manifest value):

```typescript
const { kept, dropped } = splitItemsForSafeDeath(allItems, ITEMS_KEPT_ON_DEATH);
// kept: Top 3 most valuable items (returned on respawn)
// dropped: Remaining items (go to gravestone)
```

**Algorithm**: O(n log n) on unique item slots, handles stacked items efficiently without memory explosion.

#### 3. Death Lock Recovery

Persist kept items in death lock for crash recovery:

```sql
CREATE TABLE death_locks (
  player_id TEXT PRIMARY KEY,
  death_position_x REAL NOT NULL,
  death_position_y REAL NOT NULL,
  death_position_z REAL NOT NULL,
  kept_items TEXT NOT NULL,  -- JSON array for crash recovery
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

#### 4. Gravestone Privacy

Loot items stripped from network broadcast:

```typescript
// Only lootItemCount is broadcast to all clients
getNetworkData() {
  return {
    lootItemCount: this.lootItems.length,
    // lootItems NOT included (privacy)
  };
}

// Full loot sent only to interacting player via corpseLoot packet
```

#### 5. Persist Retry Queue

Single-retry queue for post-transaction DB persist failures:

```typescript
interface PersistRetry {
  playerId: string;
  type: 'equipment' | 'inventory';
  timestamp: number;
}

// Retries drained once per tick
processPendingRespawns() {
  for (const retry of this.pendingPersistRetries) {
    await this.retryPersist(retry);
  }
}
```

### New Files

- `packages/shared/src/systems/shared/combat/DeathUtils.ts` - Pure utility functions
- `packages/shared/src/systems/shared/combat/DeathTypes.ts` - Type definitions
- `packages/shared/src/systems/shared/death/DeathStateManager.ts` - Death lock CRUD
- `packages/shared/src/systems/shared/death/SafeAreaDeathHandler.ts` - Safe zone logic
- `packages/shared/src/systems/shared/death/WildernessDeathHandler.ts` - PvP logic (placeholder)
- `packages/shared/src/systems/shared/death/ZoneDetectionSystem.ts` - Zone detection

### Breaking Changes

1. **PLAYER_DIED Event Deprecated**: Use `PLAYER_SET_DEAD` instead
   - `PLAYER_DIED` fired twice (before and after death processing)
   - `PLAYER_SET_DEAD` fires once (after death processing completes)
   - Migration guide: `docs/migrations/player-died-event-migration.md`

2. **Death Lock Schema**: Now includes `keptItems` field for crash recovery

### Documentation

- `docs/death-system-architecture.md` - Complete system documentation
- `docs/migrations/player-died-event-migration.md` - Event migration guide

## UI Improvements (March 26, 2026)

**PR**: #1093  
**Files Changed**: 15 files, 1,623 additions, 1,265 deletions

### Skilling Panel Unification

Extracted shared components to eliminate ~500 lines of duplicated styling:

#### New Components

1. **SkillingPanelBody** - Panel wrapper with intro text and empty state
2. **SkillingSection** - Themed section card for recipe groups
3. **SkillingQuantitySelector** - Reusable quantity selector with presets (1, 5, 10, All, X)

#### Style Helpers

1. **getSkillingSelectableStyle()** - Consistent selectable item styling
2. **getSkillingBadgeStyle()** - Consistent badge styling

#### Affected Panels

All skilling panels now use shared components:
- FletchingPanel
- CookingPanel
- SmeltingPanel
- SmithingPanel
- CraftingPanel
- TanningPanel

### Dialogue System Redesign

#### New Components

1. **DialoguePopupShell** - Dedicated modal shell for NPC dialogue
   - Auto-focus on open
   - Escape key to close
   - Click outside to close
   - Gold accent bar (dialogue-specific styling)

2. **DialogueCharacterPortrait** - Live 3D VRM portrait rendering
   - Isolated Three.js scene
   - Real-time NPC model rendering
   - Automatic cleanup on unmount

#### Service Handoff Fix

Opening bank/store/tanner now properly closes dialogue:

```typescript
// DialogueSystem.ts
if (effect && this.isImmediateHandoffEffect(effect)) {
  this.executeEffect(playerId, npcId, effect, state.npcEntityId);
  this.endDialogue(playerId, npcId);  // Close dialogue immediately
  return;
}

// useModalPanels.ts
const handleBankOpen = (data: unknown) => {
  setBankData({ ...d, visible: true });
  setDialogueData(null);  // Close dialogue
};
```

### Documentation

- `docs/ui-improvements-march-2026.md` - Complete UI documentation

## Home Teleport Feature (March 26, 2026)

**PR**: #1095

### Features

- Visual cast effects with particle animations
- Cooldown system (30 seconds)
- Minimap orb integration
- Smooth teleport animation
- Camera transition on completion

### Components

- `MinimapHomeTeleportOrb.tsx` - Minimap orb component
- `homeTeleportUi.ts` - Cast effects and UI utilities
- `home-teleport.ts` - Server-side handler

### Documentation

- `docs/features/home-teleport.md` - Complete feature documentation

## Bug Fixes (March 2026)

### Arrow Key Capture Fix (March 26, 2026)

**PR**: #1092  
**Files Changed**: 9 files, 392 additions, 4 deletions

**Problem**: Arrow keys consumed by panel tabs, preventing camera controls.

**Fix**: Added `reserveArrowKeys` prop to disable arrow key consumption for game windows.

**Impact**: Arrow keys now control camera even when panel tabs have focus.

### Missing Packet Handlers (March 26, 2026)

**PR**: #1091

**Added 8 missing handlers**:
- `onFletchingComplete`
- `onCookingComplete`
- `onSmeltingComplete`
- `onSmithingComplete`
- `onCraftingComplete`
- `onTanningComplete`
- `onCombatEnded`
- `onQuestStarted`

**Impact**: Eliminates "No handler for packet" console errors.

### Prayer Login Sync (March 26, 2026)

**PR**: #1090

**Fixed**: Prayer points and active prayers now sync correctly on login.

### Equipment Panel Cross-Player Leak (March 26, 2026)

**PR**: #1089

**Problem**: Equipment panel showed stale data from previously inspected players.

**Fix**: Include panel data in `useMemo` dependencies to recreate `renderPanel` on data change.

**Impact**: Equipment panel always shows current player's data.

### VRM Material Isolation (March 17, 2026)

**PR**: #1061

**Problem**: Hover highlight on one mob affected all mobs of same type.

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()`.

**Impact**: Each mob instance has independent highlight state.

### Mob AI Tick Processing (March 17, 2026)

**PR**: #1060

**Problem**: Mob AI state machines never received `update()` calls.

**Fix**: Register mob AI tick handler in `ServerNetwork` at MOVEMENT priority.

**Impact**: Mobs properly transition through IDLE → WANDER → CHASE → ATTACK states.

### Dev Server Watcher CPU (March 16, 2026)

**PR**: #1034

**Problem**: Dev server consumed 100% CPU when idle.

**Fix**: Removed `awaitWriteFinish`, increased polling interval 1s → 5s.

**Impact**: Eliminates 100% CPU usage when idle.

## Performance & Scalability (March 19-20, 2026)

**PR**: #1064  
**Files Changed**: 54 files, 6,502 additions, 1,164 deletions

### Server Runtime Migration

**Breaking Change**: Bun → Node.js 22+

**Why**: V8 incremental GC eliminates 500-1200ms stop-the-world pauses.

**Impact**:
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%

### uWebSockets.js Integration

**Breaking Change**: WebSocket port 5555 → 5556

**Why**: Native pub/sub eliminates O(n) socket iteration.

**Configuration**:
```bash
UWS_ENABLED=true
UWS_PORT=5556
PUBLIC_WS_URL=ws://localhost:5556/ws
```

### Agent AI Worker Thread

Decision logic runs off main thread (eliminates 200-600ms blocking).

**Configuration**:
```bash
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000
AGENT_STAGGER_OFFSET_MS=800
MAX_AGENTS_PER_POLL=5
```

### BFS Pathfinding Optimization

- Global iteration budget: 12,000 per tick
- Zero-allocation scratch tiles
- Per-tick walkability cache

**Configuration**:
```bash
MAX_BFS_ITERATIONS_PER_TICK=12000
DEFAULT_MAX_ITERATIONS=4000
```

### Terrain System Optimization

- Low-res collision: 16×16
- Time-budgeted processing
- Pre-baked walkability flags

**Configuration**:
```bash
SERVER_COLLISION_RESOLUTION=16
COLLISION_BUDGET_MS=8
WALKABILITY_BUDGET_MS=4
```

### Results

- **Scalability**: 20 players + 10 agents → 50+ players + 25+ agents
- **Tick reliability**: 0 missed ticks under normal load
- **Event loop**: <3% blocking (was 62.5%)

### Documentation

- `docs/performance-march-2026.md` - Complete performance documentation

## Dependency Updates (March 19, 2026)

### Major Updates

- **Vite**: 6.4.1 → 8.0.0
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1
- **@types/three**: 0.182.0 → 0.183.1
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0
- **jsdom**: 28.1.0 → 29.0.0
- **jest**: 29.7.0 → 30.3.0
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0
- **sqlite3**: 5.1.7 → 6.0.1

### Impact

- Latest build tooling with improved performance
- Better React 19 compatibility
- Updated testing environment
- Latest VRM avatar features
- Improved mobile wallet support

## Docker & Build Improvements (March 15, 2026)

**PR**: #1033

### Changes

1. **Bun 1.3.10 Upgrade**: Support Vite 6+ builds
2. **Client Build**: Added to Docker image for multi-service deployments
3. **Workspace Symlinks**: Manually recreate after Docker COPY
4. **Per-Package node_modules**: Bun 1.3 doesn't hoist - explicitly copy
5. **better-sqlite3 Removal**: Strip from manifests (segfaults under QEMU)

### Impact

- Production Docker images build successfully with Vite 6+
- Multi-service deployments supported
- No more QEMU segfaults

## Breaking Changes Summary

### Server Runtime (March 19-20, 2026)

**Before**: Bun runtime  
**After**: Node.js 22+ required

**Migration**:
```bash
nvm install 22
nvm use 22
node dist/index.js  # Use Node.js, not Bun
```

### WebSocket Port (March 19-20, 2026)

**Before**: Port 5555  
**After**: Port 5556

**Migration**:
```bash
# Server .env
UWS_PORT=5556

# Client .env
PUBLIC_WS_URL=ws://localhost:5556/ws
```

### PLAYER_DIED Event (March 26, 2026)

**Before**: `PLAYER_DIED` event  
**After**: `PLAYER_SET_DEAD` event

**Migration**:
```typescript
// Before
world.on("PLAYER_DIED", (data) => { /* ... */ });

// After
world.on("PLAYER_SET_DEAD", (data) => { /* ... */ });
```

**Documentation**: `docs/migrations/player-died-event-migration.md`

### Safari Support (March 2026)

**Before**: Safari 17+  
**After**: Safari 18+ (macOS 15+)

**Reason**: Safari 17 WebGPU support was unreliable. Safari 18 is now minimum.

## New Documentation

### Guides

- `docs/death-system-architecture.md` - Complete death system documentation
- `docs/ui-improvements-march-2026.md` - UI improvements and component API
- `docs/features/home-teleport.md` - Home teleport feature documentation
- `docs/migrations/player-died-event-migration.md` - Event migration guide

### Updated Files

- `README.md` - Updated with recent changes and new features
- `CLAUDE.md` - Added recent changes section with detailed documentation
- `AGENTS.md` - Updated with recent changes and breaking changes
- `packages/server/README.md` - Updated with Node.js requirement and new features
- `packages/shared/README.md` - Created comprehensive package documentation

## Migration Checklist

If you're updating from an older version, follow this checklist:

### Required Migrations

- [ ] **Update Node.js**: Install Node.js 22+ for server runtime
- [ ] **Update WebSocket Port**: Change client `PUBLIC_WS_URL` to port 5556
- [ ] **Update Event Listeners**: Replace `PLAYER_DIED` with `PLAYER_SET_DEAD`
- [ ] **Update Dependencies**: Run `bun install` to get latest versions
- [ ] **Rebuild**: Run `bun run build` to rebuild all packages

### Optional Migrations

- [ ] **Update Safari Requirement**: Document Safari 18+ requirement for users
- [ ] **Review Death System**: Check custom death handling code for compatibility
- [ ] **Review UI Code**: Check custom skilling panels for shared component usage
- [ ] **Update Tests**: Update tests using `PLAYER_DIED` event

### Database Migrations

Database migrations run automatically on server start. No manual action required.

**New Tables**:
- `death_locks` - Death lock storage for crash recovery

**New Columns**:
- `death_locks.kept_items` - JSON array of kept items

## Testing

All changes include comprehensive test coverage:

- **DeathUtils.test.ts**: 51 tests for utility functions
- **PlayerDeathFlow.test.ts**: 10 tests for death-to-respawn flow
- **HeadstoneEntity.test.ts**: 5 tests for gravestone network sync
- **UI component tests**: Tests for all new UI components

Run tests:
```bash
npm test
```

## Performance Metrics

### Before (March 15, 2026)

- Tick blocking: 900-2400ms
- Missed ticks: 3-5 per minute
- Event loop blocking: 62.5%
- Max players: 20 players + 10 agents

### After (March 26, 2026)

- Tick blocking: 110-200ms (81-92% reduction)
- Missed ticks: 0 under normal load
- Event loop blocking: <3%
- Max players: 50+ players + 25+ agents

## Contributors

- **dreaminglucid** - Death system overhaul, performance optimizations
- **SYMBaiEX** - UI improvements, dialogue system, home teleport

## References

### Pull Requests

- #1095 - Home teleport polish
- #1094 - Player death system overhaul
- #1093 - Dialogue and skilling panel polish
- #1092 - Arrow key capture fix
- #1091 - Missing packet handlers
- #1090 - Prayer login sync
- #1089 - Equipment panel cross-player leak
- #1088 - Comprehensive UI panel upgrade
- #1064 - Performance & scalability overhaul
- #1061 - VRM material isolation
- #1060 - Mob AI tick processing
- #1034 - Dev server watcher CPU fix
- #1033 - Docker build improvements

### Documentation

- `docs/death-system-architecture.md`
- `docs/ui-improvements-march-2026.md`
- `docs/features/home-teleport.md`
- `docs/migrations/player-died-event-migration.md`
- `docs/performance-march-2026.md`
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`

## Support

For questions or issues:

1. **Check Documentation**: See `docs/` directory
2. **Search Issues**: Check GitHub issues for similar problems
3. **Create Issue**: Open new issue with detailed description
4. **Discord**: Join community Discord for real-time help

## License

MIT - See LICENSE file
