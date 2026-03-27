# Migration Guide - March 2026 Updates

This guide covers breaking changes and migration steps for updates released in March 2026.

## Table of Contents

- [Player Death System (PR #1094)](#player-death-system-pr-1094)
- [Home Teleport System (PR #1095)](#home-teleport-system-pr-1095)
- [Skilling Panel Components (PR #1093)](#skilling-panel-components-pr-1093)
- [UI Tab Arrow Keys (PR #1092)](#ui-tab-arrow-keys-pr-1092)
- [Missing Packet Handlers (PR #1091)](#missing-packet-handlers-pr-1091)

## Player Death System (PR #1094)

### Breaking Changes

#### 1. `PLAYER_DIED` Event Deprecated

**Status**: DEPRECATED (March 26, 2026)

**Replacement**: Use `PLAYER_SET_DEAD` for client death UI, or `ENTITY_DEATH` for server-side death processing.

**Migration**:

```typescript
// ❌ OLD (deprecated - will stop receiving events)
world.on(EventType.PLAYER_DIED, (data: { playerId: string }) => {
  handlePlayerDeath(data.playerId);
});

// ✅ NEW (use ENTITY_DEATH with type filter)
world.on(EventType.ENTITY_DEATH, (data: { 
  entityId: string; 
  entityType: string;
  killedBy?: string;
  deathPosition?: { x: number; y: number; z: number };
}) => {
  if (data.entityType === 'player') {
    handlePlayerDeath(data.entityId);
  }
});
```

**Why**: `ENTITY_DEATH` is a unified event for all entity types (players, mobs, NPCs), reducing event proliferation and improving consistency.

**Timeline**: `PLAYER_DIED` is marked deprecated but still exists in the enum for backward compatibility. It will be removed in the next major version.

#### 2. Death Lock Schema Change

**Change**: Death lock now includes `keptItems` field for crash recovery.

**Database Migration**: Automatic (migration 0018 adds column with default `NULL`)

**Code Impact**:

```typescript
// ❌ OLD
interface DeathLock {
  items?: DeathItemData[];  // Dropped items only
}

// ✅ NEW
interface DeathLock {
  items?: DeathItemData[];      // Dropped items for gravestone
  keptItems?: DeathItemData[];  // OSRS keep-3 items returned on respawn
}
```

**Action Required**: None (backward compatible - old death locks have `keptItems: null`)

#### 3. HeadstoneEntity Network Sync

**Change**: `HeadstoneEntity.modify()` now syncs `lootItems` from network data.

**Impact**: Client-side gravestone entities now receive loot item updates, preventing stale item lists after looting.

**Code Impact**:

```typescript
// ❌ OLD (client never synced lootItems)
getNetworkData(): Record<string, unknown> {
  return {
    lootItemCount: this.lootItems.length,
    // lootItems NOT included
  };
}

// ✅ NEW (client syncs lootItems for accurate state)
getNetworkData(): Record<string, unknown> {
  return {
    lootItemCount: this.lootItemCount,
    lootItems: this.lootItems,  // Full items for client sync
  };
}

// Client applies updates via modify()
modify(data: Partial<EntityData>): void {
  super.modify(data);
  if (Array.isArray(changes.lootItems)) {
    this.lootItems = validated.map(item => ({ ...item }));
    this.lootItemCount = this.lootItems.length;
  }
}
```

**Action Required**: None (automatic via network sync)

### New Features

#### OSRS Keep-3 System

Players now keep their 3 most valuable items on death in safe zones:

```typescript
import { splitItemsForSafeDeath, ITEMS_KEPT_ON_DEATH } from '@hyperscape/shared';

const { kept, dropped } = splitItemsForSafeDeath(allItems, ITEMS_KEPT_ON_DEATH);
// kept: top 3 most valuable items (returned on respawn)
// dropped: remaining items (go to gravestone)
```

**Value Source**: Item values come from `world/assets/manifests/items.json` (`value` field)

**Stack Handling**: Stacks are split intelligently - if you have 10,000 arrows and they're in the top 3 most valuable, you keep 3 arrows and drop 9,997.

#### Death Utilities

New utility functions for death-related operations:

```typescript
import {
  sanitizeKilledBy,
  validatePosition,
  isPositionInBounds,
  GRAVESTONE_ID_PREFIX,
} from '@hyperscape/shared';

// Sanitize killer names for display
const safeKiller = sanitizeKilledBy(event.killedBy);

// Validate death position
const validPos = validatePosition(deathPosition);
if (!validPos) {
  // Position invalid (NaN, Infinity)
}

// Check if position is in bounds
if (!isPositionInBounds(position)) {
  // Out of world bounds
}

// Filter gravestone entities
if (entityId.startsWith(GRAVESTONE_ID_PREFIX)) {
  // This is a gravestone, not a player
}
```

### Troubleshooting

#### Player Stuck in Death Animation

**Symptoms**: Player plays death animation but never respawns.

**Diagnosis**:
```sql
-- Check for active death lock
SELECT * FROM death_locks WHERE player_id = 'player_<id>';
```

**Recovery**:
```sql
-- Clear stuck death lock
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: Death system now has robust retry logic and crash recovery. If issues persist:
1. Check server logs for `DEATH_PERSIST_DESYNC` tag
2. Check for `AUDIT_LOG` events
3. Verify database connection pool health

#### Equipment Duplication

**Symptoms**: Player has duplicate equipment after death.

**Root Cause**: Fixed in PR #1094 - was caused by nested DB transactions deadlocking.

**Action**: Update to latest version (March 26, 2026 or later).

## Home Teleport System (PR #1095)

### Breaking Changes

#### Cooldown Reduced

**Change**: Home teleport cooldown reduced from 15 minutes to 30 seconds.

**Constant Update**:

```typescript
// ❌ OLD
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 15 * 60 * 1000,  // 15 minutes
};

// ✅ NEW
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30 * 1000,  // 30 seconds
};
```

**Impact**: Existing cooldown timers will complete at the old 15-minute duration. New teleports use 30-second cooldown.

**Action Required**: None (automatic after server restart)

### New Features

#### Server-Authoritative Cooldown

Server now sends remaining cooldown time in rejection packets:

```typescript
// Server sends:
socket.send("homeTeleportFailed", {
  reason: "Home teleport on cooldown (25s remaining)",
  remainingMs: 25000,  // NEW field
});

// Client reads:
import { readHomeTeleportRemainingMs } from '@/game/hud/homeTeleportUi';

const onFailed = (event?: unknown) => {
  const remainingMs = readHomeTeleportRemainingMs(event);
  if (remainingMs > 0) {
    // Enter cooldown state with server-authoritative time
    setState("cooldown");
    setCooldownEndTime(performance.now() + remainingMs);
  }
};
```

#### Cooldown Formatting

New utility for human-readable cooldown display:

```typescript
import { formatCooldownRemaining } from '@/server/systems/ServerNetwork/handlers/home-teleport';

formatCooldownRemaining(0);      // "1s" (rounds up)
formatCooldownRemaining(999);    // "1s"
formatCooldownRemaining(60000);  // "1m"
formatCooldownRemaining(90500);  // "1m 31s"
```

#### Cast Effects

New channel-mode portal effect with terrain-aware anchoring:

- Dedicated cast-time portal (veil + orbital rings)
- Grounded to player's lowest bone position
- Separate from arrival burst effect
- Auto-stops on fail/cancel/completion

**No Action Required**: Effects are automatic when `HOME_TELEPORT_CAST_START` event fires.

## Skilling Panel Components (PR #1093)

### Breaking Changes

#### Shared Component Extraction

**Change**: Skilling panel styling and quantity selector extracted to shared components.

**Migration**: If you have custom skilling panels, update to use shared components:

```typescript
// ❌ OLD (duplicated styling in each panel)
<div className="rounded-lg shadow-2xl border" style={{...getPanelSurfaceStyle(theme)}}>
  <div className="p-3 overflow-y-auto">
    {/* Recipe list */}
  </div>
</div>

// ✅ NEW (use shared components)
import {
  SkillingPanelBody,
  SkillingSection,
  SkillingQuantitySelector,
  getSkillingSelectableStyle,
  getSkillingBadgeStyle,
} from '@/game/panels/skilling/SkillingPanelShared';

<SkillingPanelBody
  theme={theme}
  intro="Browse available recipes..."
  emptyMessage="You don't have the materials to craft anything."
>
  <SkillingSection theme={theme}>
    {/* Recipe list */}
  </SkillingSection>
  
  <SkillingQuantitySelector
    theme={theme}
    showCustomInput={showQuantityInput}
    customQuantity={customQuantity}
    lastCustomQuantity={lastCustomQuantity}
    onCustomQuantityChange={setCustomQuantity}
    onCustomSubmit={handleCustomQuantitySubmit}
    onCancelCustomInput={() => setShowQuantityInput(false)}
    onPresetQuantity={(qty) => handleCraft(selectedRecipe, qty)}
    allQuantity={-1}
    onShowCustomInput={() => setShowQuantityInput(true)}
  />
</SkillingPanelBody>
```

**Benefits**:
- Eliminates ~500 lines of duplicated code
- Consistent visual language across all skilling panels
- Easier to maintain and update styling

### New Features

#### Dialogue Character Portraits

Live 3D VRM portrait rendering in dialogue panels:

```typescript
import { DialogueCharacterPortrait } from '@/game/panels/dialogue/DialogueCharacterPortrait';

<DialogueCharacterPortrait
  world={world}
  npcEntityId={npcEntityId}
  npcName={npcName}
  className="self-start"
/>
```

**Features**:
- WebGPU viewport with live VRM rendering
- Terrain-aware grounding
- Automatic cleanup on unmount
- Fallback to initials badge if model unavailable

#### Dialogue Popup Shell

Dedicated modal shell for NPC dialogue:

```typescript
import { DialoguePopupShell } from '@/game/panels/dialogue/DialoguePopupShell';

<DialoguePopupShell
  visible={true}
  onClose={closeDialogue}
  title={npcName}
  width={700}
  maxWidth="min(86vw, 700px)"
  maxHeight="min(40vh, 400px)"
>
  <DialoguePanel {...dialogueProps} />
</DialoguePopupShell>
```

**Features**:
- Proper focus management with focus trap
- ARIA attributes for accessibility
- Escape key handling
- Backdrop click to close

#### Service Handoff Fix

Opening bank/store/tanner now properly closes dialogue:

```typescript
// In useModalPanels.ts:
const handleBankOpen = (data: unknown) => {
  if (d) {
    setBankData({ ...d, visible: true });
    setDialogueData(null);  // NEW: Close dialogue
  }
};
```

**Impact**: No more orphaned dialogue panels when transitioning to service UIs.

## UI Tab Arrow Keys (PR #1092)

### Breaking Changes

#### `reserveArrowKeys` Prop

**Change**: `TabBar` component now accepts `reserveArrowKeys` prop to disable arrow key consumption.

**Migration**:

```typescript
// ❌ OLD (arrow keys always consumed by tabs)
<TabBar
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// ✅ NEW (reserve arrow keys for game controls)
<TabBar
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  reserveArrowKeys={true}  // NEW: Don't consume arrow keys
/>
```

**When to Use**:
- Set `reserveArrowKeys={true}` for in-game panels (inventory, equipment, combat)
- Set `reserveArrowKeys={false}` or omit for non-game UI (settings, character editor)

**Impact**: Arrow keys control camera movement even when panel tabs have focus. Enter/Space still activate tabs for keyboard accessibility.

## Missing Packet Handlers (PR #1091)

### New Handlers

**Change**: Added 8 missing server→client packet handlers to `ClientNetwork.ts`.

**Handlers Added**:
- `onFletchingComplete` - Fletching batch finished
- `onCookingComplete` - Cooking result with burn check
- `onSmeltingComplete` - Smelting batch finished
- `onSmithingComplete` - Smithing batch finished
- `onCraftingComplete` - Crafting batch finished
- `onTanningComplete` - Tanning batch finished
- `onCombatEnded` - Combat session ended
- `onQuestStarted` - Quest begun notification

**Migration**: If you were handling these events manually, remove custom handlers:

```typescript
// ❌ OLD (custom handler for missing packet)
world.on('fletchingComplete', (data) => {
  // Custom handling
});

// ✅ NEW (automatic via ClientNetwork)
// No action required - ClientNetwork forwards to event bus
world.on(EventType.FLETCHING_COMPLETE, (data) => {
  // Handle event
});
```

**Impact**: Eliminates "No handler for packet" console errors.

## Database Schema Changes

### Death Lock Table

**Migration 0018**: Added `kept_items` column to `death_locks` table.

```sql
ALTER TABLE death_locks ADD COLUMN kept_items JSONB;
```

**Action Required**: None (automatic via Drizzle migrations)

**Rollback**: If you need to rollback to pre-March-26 version:

```sql
-- Remove kept_items column (data loss)
ALTER TABLE death_locks DROP COLUMN IF EXISTS kept_items;
```

## Configuration Changes

### Home Teleport Cooldown

**File**: `packages/shared/src/constants/GameConstants.ts`

```typescript
// OLD
COOLDOWN_MS: 15 * 60 * 1000,  // 15 minutes

// NEW
COOLDOWN_MS: 30 * 1000,  // 30 seconds
```

**Action Required**: None (automatic after rebuild)

### WebSocket Port

**File**: `packages/client/.env`

```bash
# OLD
PUBLIC_WS_URL=ws://localhost:5555/ws

# NEW
PUBLIC_WS_URL=ws://localhost:5556/ws
```

**Action Required**: Update `.env` file if you're using custom WebSocket URL.

**Note**: This change was from the March 19-20 performance overhaul (PR #1064), not March 26 updates.

## Testing Updates

### New Test Files

**DeathUtils Tests** (`packages/shared/src/systems/shared/combat/__tests__/DeathUtils.test.ts`):
- 51 tests covering sanitization, stack splitting, position validation
- Run: `bunx vitest run packages/shared/src/systems/shared/combat/__tests__/DeathUtils.test.ts`

**PlayerDeathFlow Tests** (`packages/shared/src/systems/shared/combat/__tests__/PlayerDeathFlow.test.ts`):
- 10 tests covering death-to-respawn flow, guards, retry queue
- Run: `bunx vitest run packages/shared/src/systems/shared/combat/__tests__/PlayerDeathFlow.test.ts`

**Home Teleport Tests** (`packages/server/tests/unit/teleport/HomeTeleportManager.test.ts`):
- Updated tests for 30-second cooldown and `remainingMs` field
- Run: `bunx vitest run packages/server/tests/unit/teleport/HomeTeleportManager.test.ts`

## Deprecation Timeline

### Immediate (March 26, 2026)

- `PLAYER_DIED` event marked deprecated
- All internal code migrated to `ENTITY_DEATH`

### Next Major Version (TBD)

- `PLAYER_DIED` event will be removed from `EventType` enum
- External plugins must migrate before upgrading

## Rollback Instructions

If you need to rollback to pre-March-26 state:

### 1. Revert Code Changes

```bash
# Rollback to commit before PR #1094
git checkout <commit-before-1094>
```

### 2. Revert Database Schema

```sql
-- Remove kept_items column
ALTER TABLE death_locks DROP COLUMN IF EXISTS kept_items;
```

### 3. Clear Death Locks

```sql
-- Clear any active death locks (prevents desync)
DELETE FROM death_locks;
```

### 4. Restart Services

```bash
bun run build
bun run dev
```

## Support

For issues or questions about these changes:

1. Check [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)
2. Review PR discussions:
   - [PR #1094 - Player Death System](https://github.com/HyperscapeAI/hyperscape/pull/1094)
   - [PR #1095 - Home Teleport](https://github.com/HyperscapeAI/hyperscape/pull/1095)
   - [PR #1093 - Dialogue & Skilling](https://github.com/HyperscapeAI/hyperscape/pull/1093)
3. See [CLAUDE.md](../CLAUDE.md) for development guidelines
