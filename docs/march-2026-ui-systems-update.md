# March 2026 UI & Systems Update

Comprehensive documentation for major UI panel redesign, prayer system fixes, equipment improvements, and combat optimizations merged to main in late March 2026.

## Overview

This document covers four major pull requests merged between March 25-26, 2026:

- **PR #1090**: Prayer Login Sync Fix
- **PR #1088**: Comprehensive UI Panel Upgrade  
- **PR #1089**: Equipment Panel Cross-Player Leak Fix
- **PR #1087**: Inventory UI Fixes for Firemaking and Targeting Mode

## Prayer Login Sync Fix (PR #1090)

### Problem

Prayer state was not hydrating correctly on login or reconnect. The client bootstrap path was overwriting authoritative cached prayer state with local entity fallback values before real prayer data had finished hydrating, causing the UI to stay stale until the player toggled a prayer again.

### Solution

**Preserve Authoritative Cache During Hydration:**
- Only use entity prayer fallback when both `prayerPoints` and `maxPrayerPoints` are explicitly present and finite
- Added `isFiniteNumber()` guard to prevent NaN/Infinity from overwriting cache
- Rerun initial hydration when local player becomes available via `PLAYER_SPAWNED` event

**Re-emit Prayer State on Join:**
- `PrayerSystem` now re-emits `PRAYER_STATE_SYNC` on `PLAYER_JOINED` event
- Ensures client receives authoritative prayer snapshot for new session after join
- Handles both initial login and reconnection scenarios

### Implementation

**packages/client/src/hooks/usePlayerData.ts:**
```typescript
// Only seed entity prayer points when both values are finite
const hasExplicitPrayerPoints =
  isFiniteNumber(prayerPoints) && isFiniteNumber(maxPrayerPoints);

if (hasExplicitPrayerPoints) {
  setPlayerStats((prev) => {
    const merged = mergePlayerStats(prev, {
      prayerPoints: {
        current: prayerPoints,
        max: maxPrayerPoints,
      },
    });
    return arePlayerStatsEqual(prev, merged) ? prev : merged;
  });
}

// Re-hydrate when local player becomes available
const handlePlayerSpawned = (event: unknown) => {
  const spawnedPlayerId = /* extract from event */;
  const localPlayerId = world.entities?.player?.id ?? world.getPlayer?.()?.id ?? playerId;
  
  if (spawnedPlayerId && localPlayerId && spawnedPlayerId !== localPlayerId) {
    return; // Not our player
  }
  
  requestInitial(); // Re-run hydration
};

world.on(EventType.PLAYER_SPAWNED, handlePlayerSpawned, undefined);
```

**packages/shared/src/systems/shared/character/PrayerSystem.ts:**
```typescript
/**
 * Handler for PLAYER_JOINED events.
 * Re-emits the authoritative prayer snapshot for the new session after join.
 */
private readonly onPlayerJoined = async (event: unknown): Promise<void> => {
  if (!this.world.isServer) return;

  const payload = event as Partial<PlayerJoinedPayload>;
  if (!payload.playerId || typeof payload.playerId !== \"string\") {
    Logger.systemError(\"PrayerSystem\", \"Invalid PLAYER_JOINED payload\", 
      new Error(`Invalid payload: ${JSON.stringify(event)}`));
    return;
  }

  const state = await this.ensurePlayerPrayerInitialized(payload.playerId);
  if (!state) return;

  this.emitPrayerStateSync(payload.playerId, state);
};
```

### Testing

**New Tests:**
- `packages/client/tests/unit/hooks/usePlayerData.test.ts` - Prayer cache preservation, PLAYER_SPAWNED hydration, finite number guards
- `packages/shared/src/systems/shared/character/__tests__/PrayerSystem.sync.test.ts` - PLAYER_REGISTERED → PLAYER_JOINED flow
- `packages/client/tests/e2e/prayer-sync.spec.ts` - Full login/reload/reconnect flow

### Impact

- Prayer HUD and prayer panel now reflect persisted server state immediately after login or reconnect
- No more stale prayer UI requiring manual prayer toggle to sync
- Robust handling of entity data timing races during bootstrap

---

## Comprehensive UI Panel Upgrade (PR #1088)

### Overview

Major UI overhaul with 4,211 additions and 2,320 deletions across 33 files. Introduces unified panel layout constants, reusable tooltip component, combat panel redesign with heraldic shields, equipment panel with live 3D paperdoll portrait, and tab persistence improvements.

### Unified Panel Layout Constants

**New File: `packages/client/src/constants/panelLayout.ts`**

Single source of truth for icon-grid panel dimensions used by Inventory, Equipment, Prayer, Spells, and Skills panels.

**Constants:**
```typescript
// Desktop
export const PANEL_PADDING = 4;           // Outer panel wrapper
export const PANEL_GRID_GAP = 4;          // Gap between icons/slots
export const PANEL_GRID_PADDING = 4;      // Inner grid inset
export const PANEL_ICON_SIZE = 36;        // Icon/slot size

// Mobile
export const PANEL_MOBILE_PADDING = 3;
export const PANEL_MOBILE_ICON_SIZE = 48; // Touch target size
export const PANEL_MOBILE_GRID_GAP = 4;

// Border radius
export const PANEL_SLOT_RADIUS = 4;       // Square aesthetic
```

**Impact:**
- Eliminates scattered magic numbers across 5+ panel components
- Ensures visual consistency across all icon-grid panels
- Single place to adjust spacing/sizing for all panels

### CursorTooltip Component

**New File: `packages/client/src/ui/core/tooltip/CursorTooltip.tsx`**

Reusable portal-based mouse-following tooltip that auto-measures and flips orientation when clipping viewport edges.

**Features:**
- Automatic dimension measurement via `useTooltipSize` hook
- Viewport-edge flipping with `calculateCursorTooltipPosition`
- Standardized dark gradient theme across game
- Portal rendering to document.body for z-index safety

**API:**
```typescript
<CursorTooltip
  visible={!!hoveredItem}
  position={{ x: mouseX, y: mouseY }}
  estimatedSize={{ width: 200, height: 100 }}
  cursorOffset={4}
  style={{ minWidth: 180 }}
>
  {/* Tooltip content */}
</CursorTooltip>
```

**Replaced Duplicated Code:**
- InventoryPanel tooltip (manual portal + positioning)
- EquipmentPanel tooltip (manual portal + positioning)
- PrayerPanel tooltip (manual portal + positioning)
- SkillsPanel tooltip (manual portal + positioning)
- SpellsPanel tooltip (manual portal + positioning)

**Impact:**
- Eliminates ~200 lines of duplicated tooltip code
- Consistent tooltip behavior across all panels
- Easier to maintain and extend

### Combat Panel Redesign

**Heraldic Shield Banners:**

Replaced vertical combat style list with horizontal SVG shield banners featuring:
- Protruding icons in circular badges above shields
- Theme-derived gradients (background colors)
- Style-colored tint overlays when active
- Filled game-style icons (accurate, aggressive, defensive, controlled, rapid, longrange, autocast)

**Visual Structure:**
```
┌─────────────────────────────────────┐
│  [Icon]  [Icon]  [Icon]  [Icon]     │  ← Circular badges
│  ╱▔▔▔╲  ╱▔▔▔╲  ╱▔▔▔╲  ╱▔▔▔╲       │
│ │ ⚔️  │ │ ⚡  │ │ 🛡️  │ │ ⚖️  │      │  ← Shield shapes
│ │ACCU │ │AGGR │ │DEFE │ │CTRL │      │  ← Style names
│ │+ATK │ │+STR │ │+DEF │ │+ALL │      │  ← XP bonuses
│  ╲___╱  ╲___╱  ╲___╱  ╲___╱        │
└─────────────────────────────────────┘
```

**SVG Shield Rendering:**
- Outer shadow edge for depth
- Base fill with theme gradient
- Active color tint overlay (when selected)
- Border stroke (gold inactive, style color active)
- Top edge highlight for polish
- Inner bevel for depth

**Optimistic State Updates:**
```typescript
// Combat style change - instant UI feedback
const changeStyle = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);
  
  // Send to server — server confirms via attackStyleChanged packet
  actions.actionMethods.changeAttackStyle(playerId, next);
};

// Auto-retaliate toggle - instant UI feedback
const toggleAutoRetaliate = () => {
  const newValue = !autoRetaliate;
  
  // Optimistic: update UI instantly
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);
  
  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

**Layout Reorganization:**
- Combat style banners moved to top
- HP + Combat Level below banners
- Target health (when in combat)
- Stats row (Attack/Strength/Defense)
- Auto-retaliate pinned to bottom

**Files Changed:**
- `packages/client/src/game/panels/CombatPanel.tsx` (+1,103/-1,427 lines)

### Equipment Panel with Live 3D Paperdoll Portrait

**Paperdoll Layout:**

Equipment slots arranged around a live 3D character preview showing equipped gear in real-time.

**Grid Layout:**
```
┌─────────────────────────────────┐
│ [Head]        [Portrait]   [Cape]│
│ [Body]        [Portrait]  [Amulet]│
│ [Legs]        [Portrait]   [Ring]│
│ [Boots]       [Portrait] [Gloves]│
│ [Ammo] [Weapon] [Portrait] [Shield]│
└─────────────────────────────────┘
```

**Live Portrait Features:**
- Real-time equipment visualization
- Drag to rotate character
- Scroll to zoom (0.4x - 1.15x)
- Smooth camera interpolation
- Automatic framing based on avatar bounds
- Loading/fallback states with stylized silhouette

**New Component: `EquipmentPaperdollPortrait`**

**packages/client/src/game/panels/equipment/EquipmentPaperdollPortrait.tsx** (765 lines)

**Features:**
- Dedicated WebGPU renderer for portrait (separate from main game renderer)
- Avatar loading from player's VRM URL
- Equipment visual attachment using `EquipmentVisualHelpers`
- Interactive camera controls (drag rotate, scroll zoom)
- Three portrait modes: `loading`, `live`, `fallback`
- Automatic camera framing with zoom compensation
- Smooth rotation/zoom interpolation (15x lerp factor)

**Implementation:**
```typescript
// Create dedicated viewport for portrait
const viewport = await createAvatarPreviewViewport({
  container,
  canvas,
  cameraPosition: new THREE.Vector3(0, 1.32, 2.95),
  adjustCameraDepth: false,
});

// Load player avatar
const loadedAvatar = await world.loader.load('avatar', avatarUrl);
const avatarNode = loadedAvatar.toNodes({ scene: viewport.scene, loader: world.loader }).get('avatar');

// Attach equipment visuals
await loadPreviewEquipmentVisuals({
  world,
  equipment,
  vrm,
  avatarRoot: avatarScene,
  visuals: previewVisualsRef.current,
});

// Start animation loop
viewport.start((delta) => {
  avatarNode.instance?.update(delta);
  // Smooth rotation/zoom interpolation
  currentRotationRef.current += (targetRotationRef.current - currentRotationRef.current) * delta * 15;
  currentZoomRef.current += (targetZoomRef.current - currentZoomRef.current) * delta * 15;
  framePortraitAvatar(avatarScene, viewport.camera, currentZoomRef.current);
});
```

**Equipment Visual Helpers Extraction:**

**New File: `packages/shared/src/systems/client/EquipmentVisualHelpers.ts`**

Extracted shared equipment attachment logic from `EquipmentVisualSystem` for reusability:

**Exported Functions:**
- `resolveEquipmentVisualData(options)` - Get item metadata
- `resolveEquipmentVisualUrls(options)` - Resolve primary/fallback URLs
- `attachEquipmentVisualToVRM(options)` - Attach model to VRM bones
- `removeEquipmentVisual(visuals, slot)` - Clean up equipment visual
- `extractEquipmentAttachmentData(gltf)` - Parse attachment metadata

**Types:**
- `EquipmentVisualModelData` - Item metadata structure
- `EquipmentVisualUrlResolution` - URL resolution result
- `EquipmentVisualStore` - Visual storage by slot
- `EquipmentAttachmentData` - Attachment metadata

**Impact:**
- Equipment preview system and main equipment system share same attachment logic
- Eliminates code duplication
- Easier to maintain and test
- Enables future equipment preview features

**Slot Redesign:**
- Removed item name labels from slots (icon-only)
- Quantity badges for stackable items (arrows)
- Hover tooltips show full item details
- Empty slot tooltips show slot name
- Improved visual hierarchy

**Footer Buttons:**
- Stats button (opens stats panel)
- On Death button (shows death mechanics)

**Files Changed:**
- `packages/client/src/game/panels/EquipmentPanel.tsx` (+549/-538 lines)
- `packages/client/src/game/panels/equipment/EquipmentPaperdollPortrait.tsx` (new, 765 lines)
- `packages/shared/src/systems/client/EquipmentVisualHelpers.ts` (new, 400+ lines)
- `packages/client/src/game/character/avatarPreviewViewport.ts` (new, 130 lines)

### Tab Persistence

**Problem:** Switching between tabs (e.g., Prayer ↔ Spells) unmounted inactive tabs, losing scroll position and component state.

**Solution:** Render all tabs simultaneously with `display: none/flex` toggling instead of unmounting.

**Implementation:**

**packages/client/src/game/interface/InterfacePanels.tsx:**
```typescript
// Old: Only render active tab (unmounts others)
if (typeof activeTab.content === \"string\") {
  const panelContent = renderPanel(activeTab.content, undefined, windowId);
  return <div>{panelContent}</div>;
}

// New: Render all tabs, toggle visibility
return (
  <div style={{ position: 'relative', flex: 1 }}>
    {tabs.map((tab, idx) => {
      const isActive = idx === activeTabIndex;
      const panelContent = typeof tab.content === \"string\"
        ? renderPanel(tab.content, undefined, windowId)
        : tab.content;
      
      return (
        <div
          key={tab.id || idx}
          style={{
            display: isActive ? 'flex' : 'none',
            position: 'absolute',
            inset: 0,
            flexDirection: 'column',
          }}
        >
          {panelContent}
        </div>
      );
    })}
  </div>
);
```

**Impact:**
- Scroll position preserved across tab switches
- Component state (expanded sections, selections) maintained
- Smoother user experience
- No re-mounting overhead when switching tabs

**Trade-off:** All tabs are mounted simultaneously, increasing initial render cost but improving UX.

### SpellsPanel Added to Default Layout

**Schema Migration v17:**

Added Spells tab alongside Prayer in the default right-column window.

**packages/client/src/game/interface/DefaultLayoutFactory.ts:**
```typescript
{
  id: \"prayer\",
  label: \"Prayer\",
  icon: \"✨\",
  content: \"prayer\",
  closeable: true,
},
{
  id: \"spells\",
  label: \"Spells\",
  icon: \"🪄\",
  content: \"spells\",
  closeable: true,
},
```

**Migration:** Existing users get the new tab on next load (schema version bump clears old layouts).

### Quest UI Theme Improvements

**Themed Components:**
- Quest list items use `getInteractiveTileStyle` for consistent hover/active states
- Category groups use `getPanelInsetStyle` for section headers
- Detail popup uses `getWindowSurfaceStyle` for immersive game window feel
- Compact pill badges for meta info (category, level, status, progress)

**Visual Enhancements:**
- State indicator dots with glow effect
- Category icons (crown, scroll, sun, calendar, star)
- Progress bars inline with quest items
- Themed section cards with inset styling
- Improved mobile layout with touch-friendly targets

**Files Changed:**
- `packages/client/src/game/components/quest/QuestLog.tsx` (+236/-202 lines)
- `packages/client/src/game/panels/QuestsPanel.tsx` (+77/-66 lines)

### Panel Size Adjustments

**Equipment Panel:**
- Min size: 235×290 → 235×340 (taller for portrait)
- Preferred size: 260×360 → 260×390
- Max size: 390×550 → 340×520

**Tab Chrome:**
- Min height: 34px → 32px (more compact)
- Padding: reduced for tighter window bars

---

## Equipment Panel Cross-Player Leak Fix (PR #1089)

### Problem

Equipment panel was displaying other players' gear (including AI agents' weapons) because `equipmentUpdated` broadcasts hit all players and the UI had no `playerId` filter.

### Solution

**Filter Equipment UI Updates by Local Player ID:**

**packages/client/src/hooks/usePlayerData.ts:**
```typescript
if (data.component === \"equipment\" && isObject(data.data)) {
  const equipmentPayload = data.data as {
    playerId?: string;
    equipment?: RawEquipmentData;
  };
  
  if (!equipmentPayload.equipment) return;
  
  // Only update if this equipment belongs to the local player
  if (playerId && equipmentPayload.playerId && equipmentPayload.playerId !== playerId) {
    return; // Ignore other players' equipment
  }
  
  const nextEquipment = processRawEquipment(equipmentPayload.equipment);
  setEquipment((prev) => areEquipmentItemsEqual(prev, nextEquipment) ? prev : nextEquipment);
}
```

**Include playerId in Equipment Emissions:**

**packages/shared/src/systems/client/ClientNetwork.ts:**
```typescript
// Re-emit as UI update event with playerId for filtering
this.world.emit(EventType.UI_UPDATE, {
  component: \"equipment\",
  data: {
    playerId: data.playerId, // Include for client-side filtering
    equipment: data.equipment,
  },
});
```

### Combat Damage Deduplication

**Problem:** `sendToNearby` publishes to 9 region topics, causing players near region boundaries to receive the same `combatDamageDealt` packet 2-3 times, resulting in duplicate damage splats.

**Solution:** Tick-based deduplication with periodic sweep.

**packages/shared/src/systems/client/ClientNetwork.ts:**
```typescript
// Deduplication map: key → timestamp
private readonly _recentDamageKeys = new Map<string, number>();

onCombatDamageDealt = (data: {
  attackerId: string;
  targetId: string;
  damage: number;
  targetType: \"player\" | \"mob\";
  position: { x: number; y: number; z: number };
  tick?: number;
}) => {
  // Include server tick in dedup key to distinguish same-damage rapid hits on different ticks
  // Use | separator (not -) to avoid collisions if IDs contain hyphens
  const tick = data.tick ?? Math.floor(performance.now() / 125); // Fallback during rolling deploy
  const dedupKey = `${data.attackerId}|${data.targetId}|${data.damage}|${tick}`;
  
  if (this._recentDamageKeys.has(dedupKey)) {
    return; // Already processed this damage event
  }
  
  // Periodic sweep: clear stale entries (>500ms old) when map exceeds threshold
  const now = performance.now();
  if (this._recentDamageKeys.size > 150) {
    // Soft threshold at 150 (close to hard cap of 200)
    for (const [key, ts] of this._recentDamageKeys) {
      if (now - ts > 500) this._recentDamageKeys.delete(key);
    }
    
    // Hard cap: trim to 100 if sweep didn't clear enough
    if (this._recentDamageKeys.size > 200) {
      const excess = this._recentDamageKeys.size - 100;
      let dropped = 0;
      for (const key of this._recentDamageKeys.keys()) {
        this._recentDamageKeys.delete(key);
        if (++dropped >= excess) break;
      }
    }
  }
  
  this._recentDamageKeys.set(dedupKey, now);
  
  // Forward to local event system
  this.world.emit(EventType.COMBAT_DAMAGE_DEALT, data);
};
```

**Server-Side Tick Inclusion:**

**packages/server/src/systems/ServerNetwork/event-bridge.ts:**
```typescript
this.broadcast.sendToNearby(
  \"combatDamageDealt\",
  {
    attackerId: data.attackerId,
    targetId: data.targetId,
    damage: data.damage,
    targetType: data.targetType,
    position: { x: pos.x, y: pos.y, z: pos.z },
    tick: currentTick, // Include server tick for dedup
  },
  pos.x,
  pos.z,
);
```

**Impact:**
- Eliminates duplicate damage splats near region boundaries
- Bounded memory usage (max 200 entries)
- Efficient periodic sweep (only when needed)
- Handles rolling deploys gracefully (tick fallback)

### Optimistic UI Updates for Combat

**Attack Style Switching:**
- UI updates instantly on click (no server round-trip delay)
- Server confirmation overwrites optimistic value with authoritative state
- Matches OSRS zero-delay feel

**Auto-Retaliate Toggle:**
- Same optimistic pattern as attack style
- Instant visual feedback
- Server-authoritative confirmation

**Implementation Pattern:**
```typescript
// 1. Update local cache + state (optimistic)
cache.set(playerId, newValue);
setState(newValue);

// 2. Send to server
actions.actionMethods.changeX(playerId, newValue);

// 3. Server confirms via event (overwrites optimistic value)
world.on(EventType.X_CHANGED, (data) => {
  cache.set(data.playerId, data.newValue);
  setState(data.newValue);
});
```

### Attack Style Cooldown Removal

**Removed Dead Code:**
- `STYLE_CHANGE_COOLDOWN = 0` (was always zero)
- `styleChangeTimers` Map and all timer management
- `combatStyleHistory` array (write-only, never displayed)
- `lastStyleChange` timestamp tracking
- `canPlayerChangeStyle()` method (always returned true)
- `getRemainingStyleCooldown()` method (always returned 0)
- `getPlayerStyleHistory()` method (always returned [])

**Impact:**
- Simplified codebase (~200 lines removed)
- No functional change (cooldown was already 0ms)
- Cleaner attack style system

### Auto-Style Switching on Weapon Change

**OSRS-Accurate Behavior:**

When weapon changes, validate current style is still available. If not, auto-switch to the first valid style for the new weapon type.

**Example:** Switching from staff (autocast) to sword → auto-select \"accurate\"

**packages/shared/src/systems/shared/character/PlayerSystem.ts:**
```typescript
/**
 * OSRS-accurate: When weapon changes, validate current style is still available.
 * If not, auto-switch to the first valid style for the new weapon type.
 */
private handleWeaponChange(playerId: string): void {
  const playerState = this.playerAttackStyles.get(playerId);
  if (!playerState) return;

  const weaponType = this.getPlayerWeaponType(playerId);
  const currentStyle = playerState.selectedStyle as CombatStyleExtended;

  if (!isStyleValidForWeapon(weaponType, currentStyle)) {
    const newStyle = getDefaultStyleForWeapon(weaponType);
    this.handleStyleChange({ playerId, newStyle });
  }
}

// Subscribe to equipment changes (server-only)
if (this.world.isServer) {
  this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data) => {
    const eqData = data as { playerId: string; slot: string; itemId: string | null };
    if (eqData.slot === \"weapon\") {
      this.handleWeaponChange(eqData.playerId);
    }
  });
}
```

### Auto-Initialize Attack Style and Auto-Retaliate

**Event Ordering Race Condition:**

If a player changes attack style or toggles auto-retaliate before `onPlayerRegister` fires (event ordering race), their in-session choice was being overwritten by the DB-saved value.

**Solution:** Auto-initialize on first use if player exists but `onPlayerRegister` hasn't fired yet.

**packages/shared/src/systems/shared/character/PlayerSystem.ts:**
```typescript
// In handleStyleChange
let playerState = this.playerAttackStyles.get(playerId);
if (!playerState) {
  // Auto-initialize if player exists but wasn't registered yet (event ordering)
  if (this.isKnownPlayer(playerId)) {
    const weaponType = this.getPlayerWeaponType(playerId);
    const defaultStyle = getDefaultStyleForWeapon(weaponType);
    this.logger.debug(
      `Auto-initializing attack style for ${playerId} (event ordering race), default: ${defaultStyle}`
    );
    this.initializePlayerAttackStyle(playerId, defaultStyle);
    playerState = this.playerAttackStyles.get(playerId);
  }
  if (!playerState) {
    this.logger.warn(`Attack style change rejected: no state for player ${playerId}`);
    return;
  }
}

// In onPlayerRegister - skip if state already exists
if (!this.playerAttackStyles.has(data.playerId)) {
  this.initializePlayerAttackStyle(data.playerId, savedAttackStyle);
}
if (!this.playerAutoRetaliate.has(data.playerId)) {
  this.initializePlayerAutoRetaliate(data.playerId, savedAutoRetaliate);
}
```

**Impact:**
- Player's in-session choice takes precedence over DB-saved value
- Updated value persists on next periodic save
- Handles event ordering races gracefully

### Item Rename: bronze_sword → bronze_shortsword

**Consistency Update:**

Renamed starter weapon across all systems for consistency with weapon categorization.

**Files Changed:**
- `packages/shared/src/systems/shared/character/InventorySystem.ts`
- `packages/shared/src/systems/shared/character/PlayerSystem.ts`
- `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

**Impact:**
- Consistent weapon naming across codebase
- Aligns with weapon type categorization (SHORTSWORD, LONGSWORD, SCIMITAR, 2H_SWORD)

---

## Inventory UI Fixes (PR #1087)

### Firemaking Optimistic Inventory Removal

**Problem:** Logs didn't disappear from inventory until server confirmed firemaking action (~100-200ms delay).

**Solution:** Optimistic removal using consolidated `ClientNetwork` API.

**packages/shared/src/systems/shared/interaction/InventoryInteractionSystem.ts:**
```typescript
// Optimistic removal: remove the logs from the client inventory cache
// so the UI updates immediately (same pattern as eat/drop/bury in
// InventoryActionDispatcher). The server's authoritative inventoryUpdated
// packet will replace this cache within ~100-200ms.
this.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Rollback Protection:**

`ClientNetwork.applyOptimisticRemoval()` automatically snapshots before mutation and manages rollback internally:

```typescript
/**
 * Optimistically remove an item from the inventory cache and emit an
 * immediate UI update. Automatically snapshots before mutation for
 * rollback if the server doesn't confirm within 5 seconds.
 */
applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void {
  const cached = this.lastInventoryByPlayerId[playerId];
  if (!cached) return;

  const itemIndex = cached.items.findIndex((i) => i.slot === slot);
  if (itemIndex === -1) return;

  // Snapshot before mutation for rollback on timeout
  const snapshot = this.snapshotInventory(playerId);
  if (snapshot) this.inventoryTracker.add(snapshot);
  this.ensureInventoryPruner();

  const item = cached.items[itemIndex];
  if (item.quantity <= quantity) {
    cached.items.splice(itemIndex, 1);
  } else {
    item.quantity -= quantity;
  }

  this.world.emit(EventType.INVENTORY_UPDATED, { ...cached });
}
```

**Rollback Mechanism:**

**packages/shared/src/systems/client/ClientNetwork.ts:**
```typescript
/** Start periodic stale-action pruning (once per second) */
private ensureInventoryPruner(): void {
  if (this.inventoryPrunerInterval) return;
  
  this.inventoryPrunerInterval = setInterval(() => {
    const rollbacks = this.inventoryTracker.pruneStale();
    for (const snapshot of rollbacks) {
      // Restore the pre-action cache so the UI corrects itself
      this.lastInventoryByPlayerId[snapshot.playerId] = snapshot;
      this.world.emit(EventType.INVENTORY_UPDATED, { ...snapshot });
      console.warn(\"[ClientNetwork] Optimistic inventory action timed out, rolling back\");
    }
  }, 1000);
}

// Clear tracker when server confirms
onInventoryUpdated = (data: { ... }) => {
  // Server sent authoritative inventory — discard all pending rollbacks
  this.inventoryTracker.clear();
  // ... rest of handler
};
```

### Targeting Mode Improvements

**Immediate Targeting State Clear:**

**packages/client/src/game/panels/InventoryPanel.tsx:**
```typescript
// After emitting TARGETING_SELECT
world.emit(EventType.TARGETING_SELECT, {
  sourceType: \"inventory_item\",
  sourceSlot: targetingState.sourceSlot,
  targetType: \"inventory_item\",
  targetSlot: slotIndex,
});

// Clear targeting immediately — action is committed
setTargetingState(initialTargetingState);
```

**Impact:**
- No stale highlights on all targets after selection
- Cleaner UX with instant state reset
- Prevents visual confusion

**Removed Targeting-Dependent Hover State:**

**packages/client/src/game/panels/InventoryPanel.tsx:**
```typescript
// Old: Hover disabled during targeting
hovered: !isEmpty && !isTargetingActive,

// New: Hover always enabled for filled slots
hovered: !isEmpty,
```

**Impact:**
- Prevents grey highlight flash on all filled slots when entering targeting mode
- Simpler hover logic
- Better visual feedback

### Fire Model Asset Path Fix

**Corrected Path:**

**packages/shared/src/systems/shared/interaction/ProcessingSystem.ts:**
```typescript
// Old (404 error)
const result = await modelCache.loadModel(
  \"asset://models/firemaking-fire/firemaking-fire.glb\",
  this.world
);

// New (correct)
const result = await modelCache.loadModel(
  \"asset://models/misc/firemaking-fire/firemaking-fire.glb\",
  this.world
);
```

### Optimistic Inventory Consolidation

**Moved to ClientNetwork:**

All optimistic inventory logic consolidated from module-level state in `InventoryActionDispatcher` to `ClientNetwork` instance methods.

**Benefits:**
- Eliminates module-level mutable state (`trackedWorld`, `prunerInterval`, `inventoryTracker`)
- Proper lifecycle management (cleanup on disconnect)
- Shared tracker for all optimistic actions (eat, drop, bury, firemaking)
- Single pruner interval instead of multiple

**Public API:**
```typescript
class ClientNetwork {
  // Deep-clone inventory cache for rollback
  snapshotInventory(playerId: string): InventorySnapshot | null;
  
  // Optimistically remove item with automatic snapshot + rollback
  applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void;
  
  // Restore inventory from snapshot (used by rollback)
  restoreInventorySnapshot(snapshot: InventorySnapshot): void;
}
```

**Exported Type:**
```typescript
export interface InventorySnapshot {
  playerId: string;
  items: Array<{ slot: number; itemId: string; quantity: number }>;
  coins: number;
  maxSlots: number;
}
```

**Callers Updated:**
- `InventoryActionDispatcher` (eat, drop, bury)
- `InventoryInteractionSystem` (firemaking)

---

## Combat Rotation Race Condition Fix

**Problem:** `PlayerLocal.update()` (hot entity) runs BEFORE `TileInterpolator.update()` (system), so they fought over `base.quaternion` every frame. PlayerLocal wrote combat rotation, then TileInterpolator overwrote it with stale `state.quaternion`, or vice versa.

**Solution:** Route combat rotation through `TileInterpolator` when it controls the entity.

**packages/shared/src/entities/player/PlayerLocal.ts:**
```typescript
// FIX: Route combat rotation through TileInterpolator when it controls this entity.
const tileControlled = this.data?.tileInterpolatorControlled === true;

if (tileControlled) {
  const network = this.world.network as {
    tileInterpolator?: {
      setCombatRotation?: (
        entityId: string,
        quaternion: number[] | THREE.Quaternion,
        entityPosition?: { x: number; y: number; z: number }
      ) => boolean;
    };
  };
  network?.tileInterpolator?.setCombatRotation?.(this.data.id, _combatQuat);
} else if (this.base) {
  // Fallback: TileInterpolator hasn't touched this entity yet
  this.base.quaternion.copy(_combatQuat);
}
```

**Impact:**
- Combat rotation flows through TileInterpolator's state, matching remote players
- Eliminates race condition between hot entity and system
- Consistent rotation behavior for local and remote players

---

## API Changes

### ClientNetwork Public Methods

**New Public Methods:**
```typescript
class ClientNetwork {
  /**
   * Deep-clone the current inventory cache for a player for rollback purposes.
   * Returns null if no cache exists yet.
   */
  snapshotInventory(playerId: string): InventorySnapshot | null;

  /**
   * Optimistically remove an item from the inventory cache and emit an
   * immediate UI update. Automatically snapshots before mutation for
   * rollback if the server doesn't confirm within 5 seconds.
   */
  applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void;
}
```

**Exported Types:**
```typescript
export interface InventorySnapshot {
  playerId: string;
  items: Array<{ slot: number; itemId: string; quantity: number }>;
  coins: number;
  maxSlots: number;
}
```

### Equipment Visual Helpers

**New Exports from `@hyperscape/shared`:**
```typescript
export {
  attachEquipmentVisualToVRM,
  extractEquipmentAttachmentData,
  removeEquipmentVisual,
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
} from \"./systems/client/EquipmentVisualHelpers\";

export type {
  EquipmentAttachmentData,
  EquipmentVisualModelData,
  EquipmentVisualStore,
  EquipmentVisualUrlResolution,
} from \"./systems/client/EquipmentVisualHelpers\";
```

**Usage:**
```typescript
import {
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
  attachEquipmentVisualToVRM,
  type EquipmentVisualStore,
} from \"@hyperscape/shared\";

// Resolve item metadata
const itemData = resolveEquipmentVisualData({ itemId: \"bronze_helmet\" });

// Resolve URLs (primary + fallback)
const urls = resolveEquipmentVisualUrls({
  assetsUrl: \"https://assets.hyperscape.club\",
  itemId: \"bronze_helmet\",
  slot: \"helmet\",
  itemData,
});

// Load and attach to VRM
const gltf = await loader.loadAsync(urls.primaryUrl);
const modelRoot = gltf.scene.clone(true);
attachEquipmentVisualToVRM({
  slot: \"helmet\",
  modelRoot,
  visuals: equipmentStore,
  vrm,
  avatarRoot,
});
```

### PlayerAttackStyleState Type

**Removed Fields:**
```typescript
// Old
interface PlayerAttackStyleState {
  playerId: string;
  selectedStyle: string;
  lastStyleChange: number;           // REMOVED
  combatStyleHistory: Array<{        // REMOVED
    style: string;
    timestamp: number;
    combatSession: string;
  }>;
}

// New
interface PlayerAttackStyleState {
  playerId: string;
  selectedStyle: string;
}
```

---

## Migration Guide

### For Developers

**Panel Layout Constants:**

If you're creating new icon-grid panels, use the shared constants:

```typescript
import {
  PANEL_PADDING,
  PANEL_GRID_GAP,
  PANEL_ICON_SIZE,
  PANEL_MOBILE_PADDING,
  PANEL_MOBILE_ICON_SIZE,
  PANEL_SLOT_RADIUS,
} from \"@/constants/panelLayout\";

// Desktop grid
<div style={{
  padding: PANEL_PADDING,
  gap: PANEL_GRID_GAP,
  gridTemplateColumns: `repeat(auto-fill, ${PANEL_ICON_SIZE}px)`,
}}>
  {/* Icons */}
</div>

// Mobile grid
<div style={{
  padding: PANEL_MOBILE_PADDING,
  gap: PANEL_MOBILE_GRID_GAP,
  gridTemplateColumns: `repeat(auto-fill, ${PANEL_MOBILE_ICON_SIZE}px)`,
}}>
  {/* Icons */}
</div>
```

**CursorTooltip Component:**

Replace manual tooltip code with `CursorTooltip`:

```typescript
// Old (manual portal + positioning)
const { left, top } = calculateCursorTooltipPosition(mousePos, tooltipSize);
return createPortal(
  <div ref={tooltipRef} style={{ position: 'fixed', left, top, zIndex: 100000 }}>
    {/* Content */}
  </div>,
  document.body
);

// New (CursorTooltip component)
return (
  <CursorTooltip
    visible={!!hoveredItem}
    position={mousePos}
    estimatedSize={{ width: 200, height: 100 }}
  >
    {/* Content */}
  </CursorTooltip>
);
```

**Optimistic Inventory Updates:**

Use `ClientNetwork` public API instead of direct cache manipulation:

```typescript
// Old (unsafe - direct cache access)
const network = world.network as { lastInventoryByPlayerId?: Record<string, any> };
const cached = network.lastInventoryByPlayerId?.[playerId];
cached.items.splice(itemIndex, 1);
world.emit(EventType.INVENTORY_UPDATED, cached);

// New (safe - public API with rollback)
const network = world.network as ClientNetwork;
network.applyOptimisticRemoval(playerId, slot, quantity);
```

**Attack Style System:**

Remove references to removed methods:

```typescript
// Removed methods (no longer available)
canPlayerChangeStyle(playerId)      // Always returned true
getRemainingStyleCooldown(playerId) // Always returned 0
getPlayerStyleHistory(playerId)     // Always returned []

// Use direct state access instead
const playerState = playerAttackStyles.get(playerId);
const currentStyle = playerState?.selectedStyle;
```

### For Players

**Prayer Sync:**
- Prayer state now persists correctly across login/reconnect
- No manual prayer toggle needed to sync UI

**Combat Panel:**
- New shield banner design for attack styles
- Instant feedback on style changes (no delay)
- Auto-retaliate toggle responds immediately

**Equipment Panel:**
- Live 3D character preview showing equipped gear
- Drag to rotate, scroll to zoom
- Click slots to unequip (no modal)
- Hover for item stats

**Spells Panel:**
- Now included in default layout alongside Prayer
- Access via right-column window tabs

**Firemaking:**
- Logs disappear from inventory instantly when lighting fire
- Smoother visual feedback

---

## Performance Considerations

### Tab Persistence Trade-off

**Before:** Only active tab mounted (minimal memory, re-mount overhead on switch)
**After:** All tabs mounted simultaneously (higher memory, instant switching)

**Impact:**
- Increased initial render cost (all panels mount at once)
- Higher memory usage (all panel state in memory)
- Better UX (instant tab switching, preserved state)

**Mitigation:** Heavy panels (e.g., EquipmentPaperdollPortrait with WebGPU renderer) should pause expensive operations when tab is hidden.

### Equipment Portrait WebGPU Context

**Consideration:** Each equipment panel creates its own WebGPU renderer, animation loop, and avatar scene. This is a second WebGPU context alongside the main game renderer.

**Impact:**
- Additional GPU memory usage
- Potential context loss on lower-end GPUs (especially mobile)
- Separate render loop overhead

**Recommendation:** Only initialize portrait when equipment panel is actually visible, dispose when hidden.

### Optimistic UI Pattern

**Benefits:**
- Instant visual feedback (matches OSRS zero-delay feel)
- Better perceived performance
- Reduced user frustration

**Risks:**
- UI can show incorrect state if server rejects action
- Requires rollback mechanism for correctness
- Increased complexity in state management

**Mitigation:** All optimistic updates have 5-second rollback timeout and server confirmation overwrites optimistic state.

---

## Testing

### New Test Files

**Prayer Sync:**
- `packages/client/tests/unit/hooks/usePlayerData.test.ts` (172 lines)
- `packages/shared/src/systems/shared/character/__tests__/PrayerSystem.sync.test.ts` (114 lines)
- `packages/client/tests/e2e/prayer-sync.spec.ts` (118 lines)

**Equipment Panel:**
- `packages/client/tests/unit/EquipmentPanel.test.tsx` (204 lines)
- `packages/client/tests/e2e/panels.spec.ts` (updated with paperdoll tests)

### Test Coverage

**Total Tests:** 1,569 passing, 85 skipped

**New Coverage:**
- Prayer cache preservation during hydration
- PLAYER_SPAWNED re-hydration
- Finite number guards for prayer points
- PLAYER_REGISTERED → PLAYER_JOINED sync flow
- Equipment paperdoll rendering
- Equipment slot interactions
- Mobile paperdoll layout
- Portrait stability during equipment changes

---

## Breaking Changes

### None

All changes are backward compatible. Existing layouts will be migrated to schema v17 automatically (clears old layouts to include Spells tab).

---

## Configuration

### No New Environment Variables

All changes use existing configuration.

---

## Known Issues

### Equipment Portrait Performance

**Issue:** Equipment portrait creates second WebGPU context, which may cause context loss on lower-end GPUs.

**Workaround:** Portrait only renders when equipment panel is visible. Dispose when panel is closed.

**Future Fix:** Consider sharing main game renderer via render-to-texture or readPixels.

### Tab Persistence Memory Usage

**Issue:** All tabs mounted simultaneously increases memory usage.

**Workaround:** Heavy components should pause expensive operations when tab is hidden.

**Future Fix:** Lazy-mount tabs on first activation, keep alive after first visit.

---

## References

### Pull Requests

- [PR #1090 - Fix prayer login sync](https://github.com/HyperscapeAI/hyperscape/pull/1090)
- [PR #1088 - feat(ui): comprehensive UI panel upgrade](https://github.com/HyperscapeAI/hyperscape/pull/1088)
- [PR #1089 - Fix/equipment panel cross player leak](https://github.com/HyperscapeAI/hyperscape/pull/1089)
- [PR #1087 - fix(client): inventory UI fixes for firemaking and targeting mode](https://github.com/HyperscapeAI/hyperscape/pull/1087)

### Related Documentation

- [Panel Layout Constants](/wiki/client/panel-layout)
- [CursorTooltip Component](/wiki/client/cursor-tooltip)
- [Optimistic UI Patterns](/wiki/client/optimistic-ui)
- [Equipment Visual System](/wiki/game-systems/equipment)
- [Prayer System](/wiki/game-systems/prayer)
- [Combat System](/wiki/game-systems/combat)

---

## Credits

**Contributors:**
- @SYMBaiEX - UI panel redesign, equipment portrait, quest theme improvements
- @dreaminglucid - Prayer sync fix, equipment leak fix, inventory optimizations, combat rotation fix

**Code Reviews:**
- Multiple rounds of thorough code review ensuring quality and correctness
- Comprehensive test coverage for all major changes
- Performance profiling and optimization

---

## Changelog Entry

```markdown
## March 26, 2026 - UI & Systems Update

### 🎨 UI Panel Redesign
- Combat panel with heraldic shield banners
- Equipment panel with live 3D paperdoll portrait
- Unified panel layout constants across all panels
- New CursorTooltip component for consistent tooltips
- Tab persistence (no unmounting on switch)
- SpellsPanel added to default layout

### 🙏 Prayer System
- Fixed prayer state hydration on login/reconnect
- Prayer cache preserved during bootstrap
- PLAYER_SPAWNED re-hydration support
- PrayerSystem re-emits state on PLAYER_JOINED

### ⚔️ Combat Improvements
- Optimistic UI updates for attack style and auto-retaliate
- Attack style cooldown system removed (was 0ms)
- Auto-style switching on weapon change
- Combat rotation race condition fixed

### 🎒 Inventory Enhancements
- Firemaking optimistic inventory removal
- Targeting mode improvements
- Optimistic inventory logic consolidated into ClientNetwork
- Fire model asset path corrected

### 🐛 Bug Fixes
- Equipment panel cross-player data leak fixed
- Combat damage deduplication for region boundaries
- Targeting state clears immediately after selection
- Item rename: bronze_sword → bronze_shortsword
```
