# UI Modernization (March 25-26, 2026)

Comprehensive UI panel redesign with unified layout system, optimistic updates, and cross-player data leak fixes.

**Pull Requests**: #1088, #1089, #1087  
**Files Changed**: 54 files, ~4,600 additions, ~2,700 deletions  
**Date**: March 25-26, 2026

## Overview

This update modernizes the game's UI panels with a focus on:
- **Visual Consistency**: Unified layout constants and theme utilities across all panels
- **Responsiveness**: Optimistic UI updates for instant feedback
- **Reliability**: Fixed cross-player data leaks and event ordering races
- **Immersion**: Heraldic shield combat banners and live 3D equipment preview

## Combat Panel Heraldic Shield Redesign

### Visual Changes

Replaced vertical combat style list with horizontal heraldic shield banners featuring:
- **SVG Shield Shapes**: Custom shield/crest geometry with theme-derived gradients
- **Protruding Icons**: Filled geometric icons at top of each shield (accurate = concentric circles, aggressive = double arrows, defensive = shield, controlled = crosshair, rapid = lightning bolt, longrange = arrow, autocast = sparkle)
- **Active State Tinting**: Color overlay gradients when style is active
- **Compact Layout**: 4 shields in a row with responsive gap sizing

### Implementation

**Shield SVG Paths** (`packages/client/src/game/panels/CombatPanel.tsx`):
```typescript
const SHIELD_OUTER = "M 5 0 L 95 0 Q 100 0 100 5 L 100 82 Q 100 102 50 128 Q 0 102 0 82 L 0 5 Q 0 0 5 0 Z";
const SHIELD_INNER = "M 8 3 L 92 3 Q 97 3 97 7 L 97 80 Q 97 99 50 123 Q 3 99 3 80 L 3 7 Q 3 3 8 3 Z";
```

**Banner Component**:
```typescript
const CombatStyleBanner = ({ style, isActive, disabled, onClick, theme }) => {
  const baseGradId = `banner-base-${style.id}`;
  const tintGradId = `banner-tint-${style.id}`;
  
  return (
    <div style={{ flex: "0 0 calc((100% - 3 * (var(--banner-gap))) / 4)" }}>
      <button onClick={onClick}>
        <svg viewBox="0 0 100 130">
          <defs>
            {/* Theme base gradient */}
            <linearGradient id={baseGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isActive ? bgLight : bgMid} />
              <stop offset="50%" stopColor={isActive ? bgMid : bgDark} />
              <stop offset="100%" stopColor={bgDark} />
            </linearGradient>
            
            {/* Active color tint overlay */}
            {isActive && (
              <linearGradient id={tintGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={style.color} stopOpacity={0.28} />
                <stop offset="55%" stopColor={style.color} stopOpacity={0.1} />
              </linearGradient>
            )}
          </defs>
          
          {/* Shield shape */}
          <path d={SHIELD_OUTER} fill={`url(#${baseGradId})`} />
          {isActive && <path d={SHIELD_OUTER} fill={`url(#${tintGradId})`} />}
          <path d={SHIELD_OUTER} stroke={isActive ? style.color : borderClr} strokeWidth={isActive ? 1.8 : 1.2} />
        </svg>
        
        {/* Protruding icon */}
        <div style={{ position: "absolute", top: 0, transform: "translate(-50%, -50%)" }}>
          <BannerStyleIcon style={style.id} color={isActive ? style.color : accentGold} />
        </div>
        
        {/* Style name and XP bonus */}
        <div style={{ paddingTop: "16px" }}>
          <span>{style.label}</span>
          <span>{shortXp}</span>
        </div>
      </button>
    </div>
  );
};
```

### Optimistic Updates

Combat controls now update instantly before server confirmation:

```typescript
const changeStyle = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);

  // Send to server — server confirms via attackStyleChanged packet
  actions.actionMethods.changeAttackStyle(playerId, next);
};

const toggleAutoRetaliate = () => {
  const newValue = !autoRetaliate;

  // Optimistic: update UI instantly
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);

  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

**Impact**:
- Zero perceived latency for combat controls
- Matches OSRS behavior (instant style switching)
- Server remains authoritative (can reject invalid changes)

## Equipment Panel Paperdoll Portrait

### Live 3D Character Preview

Added interactive 3D character preview showing equipped gear in real-time.

**Features**:
- **Live Rendering**: Dedicated WebGPU viewport with player's VRM avatar
- **Equipment Visuals**: Dynamically loads and attaches equipped items to VRM skeleton
- **Interactive Controls**: Drag to rotate, scroll to zoom
- **Fallback Graphics**: Stylized silhouette when avatar unavailable
- **Performance**: Shared equipment visual logic between system and portrait

### Implementation

**Avatar Preview Viewport** (`packages/client/src/game/character/avatarPreviewViewport.ts`):
```typescript
export async function createAvatarPreviewViewport(options: {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  cameraPosition?: THREE.Vector3;
  fov?: number;
  adjustCameraDepth?: boolean;
}): Promise<AvatarPreviewViewport> {
  const renderer = await createRenderer({ canvas, alpha: true, antialias: true });
  
  return {
    scene,
    camera,
    renderer,
    resize: () => { /* ... */ },
    start: (onFrame?: (delta: number) => void) => { /* ... */ },
    stop: () => { /* ... */ },
    dispose: () => { /* ... */ },
  };
}
```

**Equipment Visual Helpers** (`packages/shared/src/systems/client/EquipmentVisualHelpers.ts`):

Extracted shared logic from `EquipmentVisualSystem` for reuse in portrait:

```typescript
// Resolve equipment visual data (attachment points, model paths)
export function resolveEquipmentVisualData(params: {
  itemId: string;
}): EquipmentVisualModelData | null

// Resolve primary and fallback URLs for equipment models
export function resolveEquipmentVisualUrls(params: {
  assetsUrl: string;
  itemId: string;
  slot: string;
  itemData: EquipmentVisualModelData | null;
}): EquipmentVisualUrlResolution | null

// Attach equipment model to VRM skeleton
export function attachEquipmentVisualToVRM(params: {
  slot: string;
  modelRoot: THREE.Object3D;
  visuals: EquipmentVisualStore;
  vrm: VRM;
  avatarRoot: THREE.Object3D;
}): void

// Remove equipment visual from VRM
export function removeEquipmentVisual(
  visuals: EquipmentVisualStore,
  slot: string
): void
```

**Paperdoll Portrait Component** (`packages/client/src/game/panels/equipment/EquipmentPaperdollPortrait.tsx`):
```typescript
export const EquipmentPaperdollPortrait = React.memo(function EquipmentPaperdollPortrait({
  world,
  equipment,
  equipmentSignature,
  compact,
}) {
  // Create dedicated WebGPU viewport
  const viewport = await createAvatarPreviewViewport({
    container,
    canvas,
    cameraPosition: new THREE.Vector3(0, 1.32, 2.95),
    adjustCameraDepth: false,
  });
  
  // Load player's VRM avatar
  const avatarNode = loadedAvatar
    .toNodes({ scene: viewport.scene, loader: world.loader })
    .get("avatar");
  
  // Attach equipment visuals
  await loadPreviewEquipmentVisuals({
    world,
    equipment,
    vrm,
    avatarRoot: avatarScene,
    visuals: previewVisualsRef.current,
  });
  
  // Interactive rotation and zoom
  return (
    <div
      onPointerMove={(e) => {
        const deltaX = e.clientX - lastMousePosRef.current.x;
        targetRotationRef.current += deltaX * 0.01;
      }}
      onWheel={(e) => {
        const zoomDelta = e.deltaY > 0 ? 0.1 : -0.1;
        targetZoomRef.current = Math.max(0.4, Math.min(1.15, targetZoomRef.current + zoomDelta));
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
});
```

**Paperdoll Grid Layout**:
```typescript
// 5-column grid with portrait in center, slots around edges
gridTemplateColumns: `${slotWidth}px ${slotWidth}px 1fr ${slotWidth}px ${slotWidth}px`,
gridTemplateRows: `repeat(5, ${slotHeight}px)`,
gridTemplateAreas: `
  "head . . . cape"
  "body . . . amulet"
  "legs . . . ring"
  "boots . . . gloves"
  "ammo weapon . shield ."
`,
```

**Impact**:
- Immersive equipment preview matching OSRS/RS3 aesthetic
- Shared equipment visual logic reduces code duplication
- Reusable viewport factory for other character previews
- Interactive controls enhance player engagement

## Unified Panel Layout Constants

### Single Source of Truth

Extracted shared panel dimensions into `panelLayout.ts` for consistency across all icon-grid panels.

**Constants** (`packages/client/src/constants/panelLayout.ts`):
```typescript
/**
 * Single source of truth for icon-grid panel dimensions used by:
 *   - InventoryPanel   (4px outer padding, 4px grid gap, 3px mobile)
 *   - EquipmentPanel   (4px outer padding, 8px grid gap, 3px mobile)
 *   - PrayerPanel
 *   - SpellsPanel
 *   - SkillsPanel
 */

// Desktop
export const PANEL_PADDING = 4;           // Outer panel wrapper
export const PANEL_GRID_GAP = 4;          // Gap between icons
export const PANEL_GRID_PADDING = 4;      // Inner grid inset
export const PANEL_ICON_SIZE = 36;        // Icon/slot size

// Mobile
export const PANEL_MOBILE_PADDING = 3;
export const PANEL_MOBILE_ICON_SIZE = 48; // Touch target size
export const PANEL_MOBILE_GRID_GAP = 4;

// Border radius
export const PANEL_SLOT_RADIUS = 4;       // Square aesthetic
```

### Usage Pattern

**Before** (scattered magic numbers):
```typescript
// InventoryPanel.tsx
const padding = 4;
const gap = 3;
const iconSize = 36;

// PrayerPanel.tsx
const PRAYER_ICON_SIZE = 36;
const PRAYER_GAP = 2;
const PANEL_PADDING = 3;

// SpellsPanel.tsx
const SPELL_ICON_SIZE = 40;
const SPELL_GAP = 4;
```

**After** (shared constants):
```typescript
import {
  PANEL_ICON_SIZE,
  PANEL_GRID_GAP,
  PANEL_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_SLOT_RADIUS,
} from "@/constants/panelLayout";

const PRAYER_ICON_SIZE = PANEL_ICON_SIZE;  // 36px
const PRAYER_GAP = PANEL_GRID_GAP;         // 4px
```

**Panels Updated**:
- `InventoryPanel.tsx`
- `EquipmentPanel.tsx`
- `PrayerPanel.tsx`
- `SpellsPanel.tsx`
- `SkillsPanel.tsx`
- `QuestLog.tsx`

**Impact**:
- Consistent spacing across all panels
- Single place to adjust panel dimensions
- Eliminates scattered magic numbers
- Mobile and desktop variants clearly defined

## CursorTooltip Component

### Reusable Tooltip Primitive

Created portal-based mouse-following tooltip with auto-measurement and viewport-edge flipping.

**Component** (`packages/client/src/ui/core/tooltip/CursorTooltip.tsx`):
```typescript
export const CursorTooltip = React.memo(function CursorTooltip({
  visible,
  position,
  estimatedSize = { width: 140, height: 60 },
  cursorOffset = 4,
  children,
  style,
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Measure actual rendered dimensions for precise alignment
  const actualSize = useTooltipSize(visible, tooltipRef, estimatedSize);
  
  // Calculate safe bounding-box positioning with edge flipping
  const { left, top } = calculateCursorTooltipPosition(
    position,
    actualSize,
    cursorOffset,
  );
  
  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left,
        top,
        background: `linear-gradient(180deg, ${theme.colors.background.primary}, ${theme.colors.background.secondary})`,
        border: `1px solid ${theme.colors.border.hover}`,
        borderRadius: "4px",
        padding: "8px 10px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
});
```

### Before/After Comparison

**Old Pattern** (duplicated across 5+ panels):
```typescript
const tooltipRef = useRef<HTMLDivElement>(null);
const tooltipSize = useTooltipSize(hoveredItem, tooltipRef, { width: 200, height: 100 });
const { left, top } = calculateCursorTooltipPosition(mousePos, tooltipSize, 4, 8);

return createPortal(
  <div
    ref={tooltipRef}
    style={{
      position: "fixed",
      left,
      top,
      background: `linear-gradient(180deg, ${theme.colors.background.primary}, ${theme.colors.background.secondary})`,
      border: `1px solid ${theme.colors.border.hover}`,
      borderRadius: "4px",
      padding: "8px 10px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
    }}
  >
    {/* tooltip content */}
  </div>,
  document.body,
);
```

**New Pattern** (one line):
```typescript
<CursorTooltip
  visible={!!hoveredItem}
  position={mousePos}
  estimatedSize={{ width: 200, height: 100 }}
>
  {/* tooltip content */}
</CursorTooltip>
```

**Panels Updated**:
- `InventoryPanel.tsx` - Item tooltips
- `PrayerPanel.tsx` - Prayer tooltips
- `SpellsPanel.tsx` - Spell tooltips
- `SkillsPanel.tsx` - Skill tooltips
- `EquipmentPanel.tsx` - Equipment tooltips

**Impact**:
- Eliminates ~50 lines of duplicated tooltip code per panel
- Consistent tooltip behavior across all panels
- Auto-measurement prevents clipping
- Viewport-edge flipping for better UX

## Tab Persistence System

### Problem

Switching tabs would unmount the inactive panel, losing scroll position and component state.

### Solution

Render all window tabs simultaneously with `display:none/flex` toggling instead of unmounting.

**Implementation** (`packages/client/src/game/interface/InterfacePanels.tsx`):
```typescript
// Old (unmounts inactive tabs)
if (typeof activeTab.content === "string") {
  const panelContent = renderPanel(activeTab.content, undefined, windowId);
  return <div>{panelContent}</div>;
}

// New (mounts all tabs, toggles visibility)
return (
  <div style={{ position: "relative", flex: 1 }}>
    {tabs.map((tab, idx) => {
      const isActive = idx === activeTabIndex;
      const panelContent = typeof tab.content === "string"
        ? renderPanel(tab.content, undefined, windowId)
        : tab.content;
      
      return (
        <div
          key={tab.id || idx}
          style={{
            display: isActive ? "flex" : "none",
            position: "absolute",
            inset: 0,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {panelContent}
        </div>
      );
    })}
  </div>
);
```

**Impact**:
- Scroll position preserved across tab switches
- Component state (expanded sections, filters) retained
- Smoother tab switching experience
- Matches modern browser tab behavior

## Optimistic UI Updates

### Combat Controls

**Attack Style Changes**:
```typescript
const handleStyleChange = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);

  // Send to server — server confirms via attackStyleChanged packet,
  // which will overwrite our optimistic value with the authoritative one
  actions.actionMethods.changeAttackStyle(playerId, next);
};
```

**Auto-Retaliate Toggle**:
```typescript
const handleAutoRetaliateToggle = () => {
  const newValue = !autoRetaliate;

  // Optimistic: update UI instantly
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);

  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

### Inventory Actions

**Consolidated Rollback System** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
export class ClientNetwork extends SystemBase {
  // Single tracker for all optimistic inventory mutations
  private inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);
  private inventoryPrunerInterval: ReturnType<typeof setInterval> | null = null;

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

  /** Start the periodic rollback pruner (once, lazily on first optimistic call). */
  private ensureInventoryPruner(): void {
    if (this.inventoryPrunerInterval) return;
    this.inventoryPrunerInterval = setInterval(() => {
      const rollbacks = this.inventoryTracker.pruneStale();
      for (const snapshot of rollbacks) {
        this.lastInventoryByPlayerId[snapshot.playerId] = snapshot;
        this.world.emit(EventType.INVENTORY_UPDATED, { ...snapshot });
        console.warn("[ClientNetwork] Optimistic inventory action timed out, rolling back");
      }
    }, 1000);
  }
}
```

**Usage** (simplified to one line):
```typescript
// InventoryActionDispatcher (eat/drop/bury)
network?.applyOptimisticRemoval(localPlayer.id, slot, 1);

// InventoryInteractionSystem (firemaking)
this.clientNetwork?.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Rollback System**:
- **Timeout**: 5 seconds (if server doesn't confirm)
- **Pruner**: Runs every 1 second to check for stale actions
- **Cleanup**: Clears on `INVENTORY_UPDATED` (server confirmation) or disconnect
- **Shared Tracker**: Single `PendingActionTracker` in `ClientNetwork` used by all callers

**Impact**:
- Instant feedback for eat/drop/bury/firemaking actions
- Eliminates duplicate tracker instances (two timers, two listeners)
- Single source of truth for optimistic inventory mutations
- Reduced ~70 lines of boilerplate across callers
- Automatic rollback if server doesn't respond within 5s

## Cross-Player Data Leak Fixes

### Equipment Panel Leak

**Problem**: Equipment panel was displaying AI agents' weapons because `equipmentUpdated` broadcasts hit all players without filtering.

**Root Cause** (`packages/client/src/hooks/usePlayerData.ts`):
```typescript
// Old (no filter - shows everyone's equipment)
if (update.component === "equipment" && isObject(update.data)) {
  const equipmentPayload = update.data as { equipment?: RawEquipmentData };
  setEquipment(processRawEquipment(equipmentPayload.equipment));
}
```

**Fix**:
```typescript
// New (filtered - shows only local player's equipment)
const equipmentPayload = update.data as {
  playerId?: string;
  equipment?: RawEquipmentData;
};

// Only update if this equipment belongs to the local player
if (playerId && equipmentPayload.playerId && equipmentPayload.playerId !== playerId) {
  return;
}

const nextEquipment = processRawEquipment(equipmentPayload.equipment);
setEquipment((prev) => areEquipmentItemsEqual(prev, nextEquipment) ? prev : nextEquipment);
```

**Server Changes** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
// Include playerId in equipment broadcasts
this.world.emit(EventType.UI_UPDATE, {
  component: "equipment",
  data: {
    playerId: data.playerId,  // NEW: Include playerId for filtering
    equipment: data.equipment,
  },
});
```

**Impact**: Equipment panel now shows only the local player's gear, eliminates cross-player data leak.

## Combat Damage Deduplication

### Problem

`sendToNearby` publishes to 9 region topics (player's region + 8 adjacent), causing players near region boundaries to receive the same damage packet 2-3 times, resulting in duplicate damage splats.

### Solution

Deduplicate using tick-based keys with periodic sweep.

**Implementation** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
private readonly _recentDamageKeys = new Map<string, number>();

onCombatDamageDealt = (data: {
  attackerId: string;
  targetId: string;
  damage: number;
  tick?: number;
}) => {
  // Include server tick so same-damage rapid hits on different ticks are NOT dropped
  // Use | separator (not -) to avoid collisions if IDs contain hyphens
  // If tick is missing (rolling deploy), fall back to ms timestamp rounded to 125ms
  const tick = data.tick ?? Math.floor(performance.now() / 125);
  const dedupKey = `${data.attackerId}|${data.targetId}|${data.damage}|${tick}`;
  
  if (this._recentDamageKeys.has(dedupKey)) {
    return; // Already processed this damage event
  }

  // Periodic sweep: clear stale entries (>500ms old) when map exceeds threshold
  const now = performance.now();
  if (this._recentDamageKeys.size > 150) {
    // Soft sweep: remove entries older than 500ms
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
  this.world.emit(EventType.COMBAT_DAMAGE_DEALT, data);
};
```

**Server Changes** (`packages/server/src/systems/ServerNetwork/event-bridge.ts`):
```typescript
// Include server tick in damage broadcasts
this.broadcast.sendToNearby("combatDamageDealt", pos, {
  attackerId: data.attackerId,
  targetId: data.targetId,
  damage: data.damage,
  targetType: data.targetType,
  position: { x: pos.x, y: pos.y, z: pos.z },
  tick: currentTick,  // NEW: Include server tick for dedup
});
```

**Dedup Strategy**:
- **Soft Sweep**: Clears entries >500ms old when map exceeds 150 entries
- **Hard Cap**: Trims to 100 entries if map exceeds 200 (prevents unbounded growth)
- **Tick-Based Keys**: Distinguishes same-damage rapid hits on different ticks
- **Rolling Deploy Fallback**: Uses `performance.now() / 125` when server tick field is missing

**Impact**: Eliminates duplicate damage splats near region boundaries, bounded memory usage (max 200 entries).

## Attack Style System Cleanup

### Removed Dead Code

Removed attack style cooldown infrastructure that was hardcoded to 0ms.

**Removed**:
- `STYLE_CHANGE_COOLDOWN = 0` constant
- `styleChangeTimers` Map and timer cleanup logic
- `combatStyleHistory` array (write-only, never displayed)
- `lastStyleChange` timestamp tracking
- Dead API methods:
  - `canPlayerChangeStyle()` - Always returned `true`
  - `getRemainingStyleCooldown()` - Always returned `0`
  - `getPlayerStyleHistory()` - Always returned `[]`

**Files Changed**:
- `packages/shared/src/systems/shared/character/PlayerSystem.ts` - Removed cooldown logic (~150 lines)
- `packages/shared/src/systems/shared/infrastructure/SystemLoader.ts` - Removed API bindings
- `packages/shared/src/types/entities/player-types.ts` - Removed `PlayerAttackStyleState` fields

**Impact**: 
- Cleaner codebase with ~200 lines of dead code removed
- No functional changes (cooldown was already 0ms)
- Simpler attack style system without unnecessary complexity

## Auto-Initialization for Event Ordering Races

### Problem

UI events (attack style change, auto-retaliate toggle, equipment updates) can arrive before `onPlayerRegister` fires, causing \"no state for player\" errors.

### Solution

Added auto-initialization guards that create default state if player exists but hasn't been registered yet.

**Attack Style Auto-Init** (`packages/shared/src/systems/shared/character/PlayerSystem.ts`):
```typescript
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
}
```

**Auto-Retaliate Auto-Init**:
```typescript
if (!this.playerAutoRetaliate.has(playerId)) {
  // Only auto-initialize for player entities (not mobs or other entity types)
  if (this.isKnownPlayer(playerId)) {
    this.logger.debug(
      `Auto-initializing auto-retaliate for ${playerId} (event ordering race)`
    );
    this.playerAutoRetaliate.set(playerId, true); // default ON
  }
}
```

**Equipment Idempotency**:
```typescript
// EquipmentSystem.ts - initializePlayerEquipment
if (this.playerEquipment.has(playerData.id)) {
  this.logger.debug(`Equipment already initialized for ${playerData.id}, skipping`);
  return;
}
```

**Reconnection Guard**:
```typescript
// EquipmentSystem.ts - PLAYER_JOINED handler
if (typedData.isReconnect && this.playerEquipment.has(typedData.playerId)) {
  this.sendEquipmentUpdated(typedData.playerId);
  this.emitEquipmentChangedForAllSlots(typedData.playerId);
  return;
}
```

**Impact**:
- Eliminates \"no state for player\" errors from event ordering races
- Player choices take precedence over DB-saved values during session
- Reconnection preserves in-session equipment and combat preferences

## Weapon Change Auto-Style Switching

### OSRS-Accurate Behavior

Auto-switch attack style when weapon changes and current style is invalid for new weapon.

**Implementation** (`packages/shared/src/systems/shared/character/PlayerSystem.ts`):
```typescript
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
    if (eqData.slot === "weapon") {
      this.handleWeaponChange(eqData.playerId);
    }
  });
}
```

**Example**: Switching from staff (autocast) to sword → auto-select \"accurate\" style.

**Impact**: Prevents invalid style errors when weapon changes, OSRS-accurate behavior.

## Additional Fixes

### Starter Equipment

**Change**: Fixed `STARTER_EQUIPMENT` referencing non-existent `bronze_sword` → `bronze_shortsword`.

**Files Changed**:
- `packages/shared/src/systems/shared/character/InventorySystem.ts`
- `packages/shared/src/systems/shared/character/PlayerSystem.ts`
- `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

**Impact**: New players receive correct starter weapon, eliminates item lookup failures.

### Fire Model Asset Path

**Change**: Corrected fire model path from `models/firemaking-fire/` to `models/misc/firemaking-fire/`.

**Files Changed**: `packages/shared/src/systems/shared/interaction/ProcessingSystem.ts`

**Impact**: Eliminates 404 errors when spawning firemaking fires.

### Targeting Mode UI

**Changes**:
- **Immediate Clear**: Targeting state clears immediately after target selection (no server round-trip wait)
- **Hover State**: Removed `isTargetingActive` from slot hover condition to prevent grey flash on all filled slots
- **System Registration**: Registered `InventoryInteractionSystem` on client for targeting support

**Impact**: 
- Targeting mode feels more responsive
- No stale highlights after target selection
- Cleaner visual feedback

### Panel Data Synchronization

**Problem**: `WindowRenderer` and `WindowItem` are wrapped in `React.memo()`, which blocked prop updates when inventory/equipment/stats changed.

**Solution** (`packages/client/src/game/interface/InterfaceManager.tsx`):
```typescript
// Monotonic counter that changes when panel data updates, breaking
// through React.memo barriers in WindowRenderer/WindowItem without
// recreating renderPanel (which would re-mount all panels).
const panelDataVersionRef = useRef(0);
const panelDataVersion = useMemo(() => {
  return ++panelDataVersionRef.current;
}, [inventory, coins, playerStats, equipment]);

// Pass to WindowRenderer
<WindowRenderer
  renderPanel={renderPanel}
  panelDataVersion={panelDataVersion}  // Breaks memo barrier
/>

// WindowItem - intentionally unused prop breaks React.memo
const WindowItem = memo(function WindowItem({
  windowId,
  isEditMode,
  windowCombiningEnabled,
  renderPanel,
  // Intentionally unused — its presence in props breaks React.memo's
  // shallow comparison when panel data changes, causing WindowItem to
  // re-render and call renderPanel with fresh ref-based data.
  panelDataVersion: _,
}: WindowItemProps) {
  // ...
});
```

**Impact**:
- Inventory panels update in real-time when data changes
- Lightweight counter (number) breaks memo without forcing panel re-mount
- `renderPanel` stays stable (no unnecessary panel recreation)

### Event Type Consistency

**Change**: Replaced raw string event names with `EventType` enum constants.

**Implementation** (`packages/shared/src/systems/shared/entities/Entities.ts`):
```typescript
// Old (string literals - error-prone)
this.emitTypedEvent("PLAYER_JOINED", { ... });
this.emitTypedEvent("PLAYER_REGISTERED", { ... });

// New (typed enum - type-safe)
this.world.emit(EventType.PLAYER_JOINED, { ... });
this.world.emit(EventType.PLAYER_REGISTERED, { ... });
```

**Impact**: Better type safety, prevents typo bugs, improves grep-ability.

## Migration Guide

### For Developers

**Panel Layout Constants**:
```typescript
// Update imports to use shared constants
import {
  PANEL_ICON_SIZE,
  PANEL_GRID_GAP,
  PANEL_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_SLOT_RADIUS,
} from "@/constants/panelLayout";

// Replace hardcoded values
const iconSize = PANEL_ICON_SIZE;  // Instead of: const iconSize = 36;
const gap = PANEL_GRID_GAP;        // Instead of: const gap = 4;
```

**CursorTooltip Component**:
```typescript
// Replace manual tooltip implementation
<CursorTooltip
  visible={!!hoveredItem}
  position={mousePos}
  estimatedSize={{ width: 200, height: 100 }}
>
  {/* tooltip content */}
</CursorTooltip>
```

**Optimistic Inventory Updates**:
```typescript
// Use ClientNetwork API instead of manual tracker
const network = world.network as ClientNetwork;
network.applyOptimisticRemoval(playerId, slot, quantity);
```

### For Players

**No Breaking Changes**: All updates are backward-compatible. Existing characters, inventory, and progress are preserved.

**New Features**:
- Combat panel now shows horizontal shield banners (more compact)
- Equipment panel has live 3D character preview (drag to rotate, scroll to zoom)
- Spells panel added to default layout (check right-column window)
- Combat controls feel more responsive (instant feedback)
- Inventory actions (eat, drop, firemaking) update instantly

**Visual Changes**:
- Quest log uses themed tiles and badges
- Panel spacing is more consistent across all panels
- Tooltips have consistent styling and positioning

## Testing

### New Test Coverage

**Equipment Panel** (`packages/client/tests/unit/EquipmentPanel.test.tsx`):
- Paperdoll slots render correctly (11 slots)
- Portrait container exists and shows loading state
- Equipped items display with icons (no visible item names in slots)
- Props updates trigger re-render
- Mobile layout maintains portrait

**E2E Tests** (`packages/client/tests/e2e/panels.spec.ts`):
- Equipment panel renders paperdoll layout on mobile viewport
- Portrait stays stable during equipment interactions
- All 11 equipment slots present and functional

### Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test packages/client/tests/unit/EquipmentPanel.test.tsx

# Run E2E tests
npm test packages/client/tests/e2e/panels.spec.ts
```

## Performance Considerations

### Tab Persistence Trade-offs

**Benefit**: Preserves scroll position and component state across tab switches.

**Cost**: All tabs are mounted simultaneously (hidden with `display:none`). For windows with heavy panels (e.g., 3D equipment portrait), this means the portrait's WebGPU renderer stays alive even when viewing other tabs.

**Mitigation**: Portrait renderer is lightweight (separate viewport, minimal scene complexity). Future optimization could pause rendering when tab is hidden.

### Equipment Portrait WebGPU Context

**Resource Usage**: Each equipment panel creates its own WebGPU renderer, animation loop, and avatar scene.

**Considerations**:
- Second WebGPU context alongside main game renderer
- On lower-end GPUs (especially mobile), this could cause context loss
- Portrait only renders when equipment panel is visible

**Future Optimizations**:
- Share main renderer via render-to-texture
- Only initialize portrait when panel is actually visible
- Add cleanup when panel is hidden (not just unmounted)

### Optimistic Update Rollback

**Memory**: `PendingActionTracker` stores inventory snapshots for up to 5 seconds.

**Cleanup**: Automatic cleanup on server confirmation or disconnect.

**Bounded**: Single shared tracker prevents duplicate instances.

## Known Issues

### Optimistic Updates Without Rollback

**Combat Controls**: Optimistic updates for attack style and auto-retaliate don't have explicit rollback if server rejects the change. Server will send authoritative value, but there could be a brief flash of wrong state.

**Mitigation**: Server rejection is rare (only for invalid weapon/style combinations), and server confirmation arrives within ~100-200ms.

### Panel Data Version Pattern

**Implementation**: Uses `useMemo` with side effects (mutating `panelDataVersionRef.current`), which is technically an anti-pattern in React concurrent mode.

**Risk**: React may call memo factories more than once in concurrent mode.

**Mitigation**: Works correctly in current React 19 implementation. Future React upgrades may require refactoring to `useRef` + `useEffect` pattern.

## Files Changed

### PR #1088 (UI Panel Upgrade)
- **33 files**, 4,211 additions, 2,320 deletions
- Combat panel redesign with heraldic shields
- Equipment panel paperdoll portrait
- Unified panel layout constants
- CursorTooltip component
- Tab persistence system
- Quest UI theme modernization

### PR #1089 (Equipment Panel Cross-Player Leak)
- **12 files**, 250 additions, 194 deletions
- Equipment panel `playerId` filtering
- Optimistic combat UI updates
- Attack style cooldown removal
- Combat damage deduplication
- Auto-initialization guards
- Weapon change auto-style switching

### PR #1087 (Inventory Firemaking UI)
- **9 files**, 149 additions, 171 deletions
- Optimistic inventory rollback consolidation
- Firemaking optimistic removal
- Fire model asset path fix
- Targeting mode UI fixes
- Panel data synchronization fix

**Total**: 54 files, ~4,600 additions, ~2,700 deletions

## References

- **PR #1088**: [feat(ui): comprehensive UI panel upgrade](https://github.com/HyperscapeAI/hyperscape/pull/1088)
- **PR #1089**: [Fix/equipment panel cross player leak](https://github.com/HyperscapeAI/hyperscape/pull/1089)
- **PR #1087**: [fix(client): inventory UI fixes for firemaking and targeting mode](https://github.com/HyperscapeAI/hyperscape/pull/1087)
- **CLAUDE.md**: [Development guidelines](../CLAUDE.md)
- **README.md**: [Project overview](../README.md)
