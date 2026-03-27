# Changelog - March 2026

All notable changes for March 2026 releases.

## [Unreleased] - 2026-03-27

### Fixed

#### Mob Level Display (PR #1097)
- Fixed duplicate mob levels showing in right-click context menus
- Mob names like "Bandit (Lv8)" no longer show as "Attack Bandit (Lv8) (Level: 8)"
- Added `getDisplayName()` method to strip trailing `(Lv#)` suffix
- Added regression test for mob names with level suffixes

**Files Changed**: 2 files, 33 additions, 5 deletions

## [Released] - 2026-03-26

### Added

#### Home Teleport System (PR #1095)
- **Visual Cast Effects**: Dedicated channel-mode portal effect with veil and orbital rings
- **Cooldown System**: 30-second cooldown (reduced from 15 minutes) with server-authoritative tracking
- **UI Integration**: `HomeTeleportButton` and `MinimapHomeTeleportOrb` components
- **Cooldown Progress**: Visual refill animation and remaining time display
- **Server Feedback**: Server sends `remainingMs` in cooldown rejection packets
- **Terrain Anchoring**: Portal effect anchored to player's lowest bone position

**New Files**:
- `packages/client/src/game/hud/homeTeleportUi.ts` - Shared utilities
- `packages/client/src/game/hud/HomeTeleportButton.tsx` - Dedicated button
- `packages/client/src/game/hud/MinimapHomeTeleportOrb.tsx` - Minimap orb

**API**:
- `readHomeTeleportRemainingMs(event)` - Extract cooldown from server event
- `getHomeTeleportCooldownProgress(remaining)` - Calculate progress percentage
- `formatCooldownRemaining(ms)` - Format as "Xm Ys" or "Xs"

**Constants**:
```typescript
HOME_TELEPORT_CONSTANTS.COOLDOWN_MS: 30 * 1000  // 30 seconds (was 15 minutes)
```

**Files Changed**: 8 files, 649 additions, 53 deletions

#### Skilling Panel Shared Components (PR #1093)
- **SkillingPanelBody**: Outer container with intro text and empty state
- **SkillingSection**: Section container for grouping recipes
- **SkillingQuantitySelector**: Reusable quantity selector with presets (1, 5, 10, All, X)
- **Style Helpers**: `getSkillingSelectableStyle()` and `getSkillingBadgeStyle()`
- **Unified Layouts**: All skilling panels (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) use consistent styling

**New Files**:
- `packages/client/src/game/panels/skilling/SkillingPanelShared.tsx`
- `packages/client/src/game/panels/dialogue/DialoguePopupShell.tsx`
- `packages/client/src/game/panels/dialogue/DialogueCharacterPortrait.tsx`

**Impact**: Eliminates ~500 lines of duplicated styling

**Files Changed**: 15 files, 1,623 additions, 1,265 deletions

#### Dialogue System Redesign (PR #1093)
- **DialoguePopupShell**: Dedicated modal shell with focus management and ARIA attributes
- **DialogueCharacterPortrait**: Live 3D VRM portrait rendering in dialogue panels
- **Service Handoff Fix**: Opening bank/store/tanner properly closes dialogue
- **Improved Layout**: Horizontal layout with portrait on left, dialogue on right

**Files Changed**: Included in PR #1093 totals above

### Fixed

#### Player Death System Overhaul (PR #1094)
- **SQLite Deadlock**: Fixed nested transaction deadlock causing players to never respawn
- **Equipment Duplication**: Prevented item duplication via two-phase persist pattern
- **OSRS Keep-3**: Implemented "keep 3 most valuable items" for safe zone deaths
- **Gravestone Privacy**: Loot items hidden from broadcast, only sent to interacting player
- **Death Lock Recovery**: Persist kept items in death lock for crash recovery
- **Persist Retry Queue**: Single-retry queue (bounded to 100) for DB persist failures
- **Duel Respawn Guard**: Block respawn during active duels to prevent escape exploit
- **Death Processing Guard**: Prevent respawn race while death transaction is in progress

**New Files**:
- `packages/shared/src/systems/shared/combat/DeathUtils.ts` - Pure utility functions
- `packages/shared/src/systems/shared/combat/DeathTypes.ts` - Shared type definitions
- `packages/shared/src/systems/shared/combat/__tests__/DeathUtils.test.ts` - 51 unit tests
- `packages/shared/src/systems/shared/combat/__tests__/PlayerDeathFlow.test.ts` - 10 integration tests

**API**:
- `sanitizeKilledBy(killedBy)` - XSS/Unicode/injection protection
- `splitItemsForSafeDeath(items, keepCount)` - OSRS keep-3 with stack handling
- `validatePosition(position)` - Position validation and clamping
- `isPositionInBounds(position)` - Bounds checking without clamping
- `GRAVESTONE_ID_PREFIX` - Constant for gravestone entity ID filtering

**Files Changed**: 23 files, 2,574 additions, 566 deletions

#### UI Tab Arrow Key Capture (PR #1092)
- Fixed arrow keys being consumed by in-game panel tabs
- Added `reserveArrowKeys` prop to `TabBar` component
- Arrow keys now control camera movement even when panel tabs have focus
- Enter/Space still activate tabs for keyboard accessibility

**Files Changed**: 9 files, 392 additions, 4 deletions

#### Missing Packet Handlers (PR #1091)
- Added 8 missing server→client packet handlers to `ClientNetwork`
- Handlers: `onFletchingComplete`, `onCookingComplete`, `onSmeltingComplete`, `onSmithingComplete`, `onCraftingComplete`, `onTanningComplete`, `onCombatEnded`, `onQuestStarted`
- Eliminates "No handler for packet" console errors

**Files Changed**: 1 file, 48 additions, 0 deletions

#### Prayer Login Sync (PR #1090)
- Fixed prayer state synchronization on player login
- Prayer points and active prayers now sync correctly between sessions

**Files Changed**: 3 files, 28 additions, 12 deletions

### Changed

#### CombatantEntity Config Initialization (PR #1094)
- Changed `||` to `??` for combat config initialization
- Fixes bug where `0` values for `attackPower`, `defense`, `criticalChance` were ignored
- Now correctly handles falsy-but-valid values

```typescript
// OLD (buggy)
this.attackPower = config.combat.attack || this.attackPower;

// NEW (correct)
this.attackPower = config.combat.attack ?? this.attackPower;
```

#### CombatantEntity.isDead (PR #1094)
- Fixed `isDead` property reference to method call
- Was: `!this.isDead` (always truthy - function reference)
- Now: `!this.isDead()` (correct method call)

### Deprecated

#### PLAYER_DIED Event (PR #1094)
- `PLAYER_DIED` event marked deprecated
- Use `PLAYER_SET_DEAD` for client death UI
- Use `ENTITY_DEATH` for server-side death processing
- Will be removed in next major version

**Migration**:
```typescript
// OLD
world.on(EventType.PLAYER_DIED, (data: { playerId: string }) => { ... });

// NEW
world.on(EventType.ENTITY_DEATH, (data: { 
  entityId: string; 
  entityType: string;
}) => {
  if (data.entityType === 'player') { ... }
});
```

## [Released] - 2026-03-19 to 2026-03-20

### Changed

#### Performance & Scalability Overhaul (PR #1064)
- **Server Runtime**: Migrated from Bun to Node.js 22+ for V8 incremental GC
- **WebSocket Transport**: Integrated uWebSockets.js on port 5556 (was 5555)
- **Agent AI**: Moved to worker thread (eliminates 200-600ms blocking)
- **BFS Pathfinding**: Global iteration budget, zero-allocation scratch tiles
- **Terrain System**: Low-res collision (16×16), time-budgeted processing
- **Tick System**: Drift correction, health monitoring, per-handler timing

**Impact**:
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%
- Scalability: 20 players + 10 agents → 50+ players + 25+ agents

**Breaking Changes**:
- Server requires Node.js 22+ (Bun no longer supported)
- WebSocket port changed from 5555 → 5556
- Client `PUBLIC_WS_URL` must be updated to `ws://localhost:5556/ws`

**Files Changed**: 54 files, 6,502 additions, 1,164 deletions

### Updated

#### Dependency Updates
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

## [Released] - 2026-03-17

### Fixed

#### VRM Material Isolation (PR #1061)
- Fixed highlight bleed across mob instances
- Each VRM clone now has independent material instance
- Textures remain shared for memory efficiency
- Hovering over one goblin no longer highlights all goblins

#### Mob AI Tick Processing (PR #1060)
- Wired mob AI tick processing into server tick loop
- Mob state machines now function correctly (IDLE → WANDER → CHASE → ATTACK)
- Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)

## [Released] - 2026-03-16

### Fixed

#### Dev Server Watcher CPU (PR #1034)
- Fixed dev server watcher burning 100% CPU when idle
- Removed redundant `awaitWriteFinish` polling
- Increased polling fallback interval from 1s to 5s
- No impact on rebuild responsiveness

## [Released] - 2026-03-15

### Changed

#### Docker Build Improvements (PR #1033)
- Upgraded to Bun 1.3.10 (from 1.1.38) for Vite 6+ support
- Added client build to Docker image
- Manually recreate workspace symlinks after Docker COPY
- Explicitly copy per-package node_modules (Bun 1.3 doesn't hoist)
- Strip better-sqlite3 from manifests (prevents QEMU segfaults)

## Summary Statistics

### March 26, 2026 (5 PRs)
- **Total Changes**: 50 files, 4,704 additions, 1,852 deletions
- **Major Features**: Player death overhaul, home teleport, dialogue redesign
- **Bug Fixes**: UI tab arrow keys, missing packet handlers, prayer sync, mob level display

### March 19-20, 2026 (1 PR)
- **Total Changes**: 54 files, 6,502 additions, 1,164 deletions
- **Major Feature**: Performance & scalability overhaul

### March 15-17, 2026 (4 PRs)
- **Total Changes**: 12 files, 487 additions, 156 deletions
- **Bug Fixes**: VRM material isolation, mob AI ticking, dev server CPU, Docker builds

### Grand Total (March 2026)
- **Total Changes**: 116 files, 11,693 additions, 3,172 deletions
- **Net Addition**: +8,521 lines
- **Major Features**: 3 (death system, home teleport, dialogue/skilling)
- **Bug Fixes**: 8
- **Performance Improvements**: 1 (major)
- **Breaking Changes**: 3 (PLAYER_DIED deprecation, WebSocket port, server runtime)

## Migration Checklist

If upgrading from pre-March-2026 version:

- [ ] Update `PUBLIC_WS_URL` to port 5556 (if using custom URL)
- [ ] Migrate `PLAYER_DIED` event listeners to `ENTITY_DEATH`
- [ ] Update server runtime to Node.js 22+ (if deploying)
- [ ] Run database migrations (automatic via Drizzle)
- [ ] Update skilling panels to use shared components (optional, for custom panels)
- [ ] Test death/respawn flow (verify keep-3 items work)
- [ ] Test home teleport (verify 30-second cooldown)
- [ ] Verify arrow keys work for camera control

## See Also

- [Migration Guide](docs/migration-march-2026.md) - Detailed migration instructions
- [Death System API](docs/api/death-system.md) - Complete API reference
- [Home Teleport](docs/features/home-teleport.md) - Feature documentation
- [Skilling Panels](docs/ui/skilling-panels.md) - UI component documentation
