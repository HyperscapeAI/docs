# API Reference: March-April 2026 Updates

This document provides API reference for features added in March-April 2026.

## Table of Contents

- [Tooltip Style Utilities](#tooltip-style-utilities)
- [Tree Dissolve Animation](#tree-dissolve-animation)
- [Tree Collision Proxy](#tree-collision-proxy)
- [Equipment Panel Props](#equipment-panel-props)
- [Dialogue System](#dialogue-system)

## Tooltip Style Utilities

**Location**: `packages/client/src/ui/core/tooltip/tooltipStyles.ts`

**Added**: March 27, 2026 (PR #1102)

Centralized tooltip styling utilities for consistent appearance across all UI panels.

### Functions

#### `getTooltipTitleStyle(theme, accentColor?)`

Returns styling for tooltip title text.

**Parameters:**
- `theme: Theme` - Current theme object
- `accentColor?: string` - Optional accent color (defaults to `theme.colors.accent.secondary`)

**Returns:** `React.CSSProperties`

**Example:**
```typescript
import { getTooltipTitleStyle } from '@/ui/core/tooltip/tooltipStyles';
import { useThemeStore } from '@/ui';

const theme = useThemeStore((s) => s.theme);

<div style={getTooltipTitleStyle(theme)}>
  Iron Sword
</div>
```

#### `getTooltipMetaStyle(theme)`

Returns styling for metadata/secondary text (level requirements, quantities, etc.).

**Parameters:**
- `theme: Theme` - Current theme object

**Returns:** `React.CSSProperties`

**Example:**
```typescript
<div style={getTooltipMetaStyle(theme)}>
  Level 40 Attack required
</div>
```

#### `getTooltipBodyStyle(theme)`

Returns styling for body content text.

**Parameters:**
- `theme: Theme` - Current theme object

**Returns:** `React.CSSProperties`

**Example:**
```typescript
<div style={getTooltipBodyStyle(theme)}>
  A powerful melee weapon forged from iron ore.
</div>
```

#### `getTooltipDividerStyle(theme, accentColor?)`

Returns styling for section dividers within tooltips.

**Parameters:**
- `theme: Theme` - Current theme object
- `accentColor?: string` - Optional accent color for border

**Returns:** `React.CSSProperties`

**Example:**
```typescript
<div style={getTooltipDividerStyle(theme)}>
  <div>Attack: +15</div>
  <div>Strength: +14</div>
</div>
```

#### `getTooltipTagStyle(theme)`

Returns styling for tag/badge elements.

**Parameters:**
- `theme: Theme` - Current theme object

**Returns:** `React.CSSProperties`

**Example:**
```typescript
<span style={getTooltipTagStyle(theme)}>
  2x Fire rune
</span>
```

#### `getTooltipStatusStyle(theme, tone)`

Returns styling for status indicators.

**Parameters:**
- `theme: Theme` - Current theme object
- `tone: 'default' | 'success' | 'danger' | 'warning'` - Status tone

**Returns:** `React.CSSProperties`

**Example:**
```typescript
// Success status
<div style={getTooltipStatusStyle(theme, 'success')}>
  Currently Active
</div>

// Danger status
<div style={getTooltipStatusStyle(theme, 'danger')}>
  Requires level 50 Magic
</div>
```

### Usage Pattern

```typescript
import {
  getTooltipTitleStyle,
  getTooltipMetaStyle,
  getTooltipBodyStyle,
  getTooltipDividerStyle,
  getTooltipStatusStyle,
} from '@/ui/core/tooltip/tooltipStyles';
import { CursorTooltip, useThemeStore } from '@/ui';

function ItemTooltip({ item, position }) {
  const theme = useThemeStore((s) => s.theme);
  
  return (
    <CursorTooltip
      visible={true}
      position={position}
      estimatedSize={{ width: 200, height: 100 }}
      style={{ zIndex: theme.zIndex.tooltip }}
    >
      {/* Title */}
      <div style={getTooltipTitleStyle(theme)}>
        {item.name}
      </div>
      
      {/* Metadata */}
      <div style={getTooltipMetaStyle(theme)}>
        Level {item.levelRequired} {item.skill}
      </div>
      
      {/* Divider */}
      <div style={getTooltipDividerStyle(theme)}>
        {/* Stats */}
        <div style={getTooltipBodyStyle(theme)}>
          Attack: +{item.attackBonus}
        </div>
      </div>
      
      {/* Status */}
      {!hasRequiredLevel && (
        <div style={getTooltipStatusStyle(theme, 'danger')}>
          Requires level {item.levelRequired}
        </div>
      )}
    </CursorTooltip>
  );
}
```

## Tree Dissolve Animation

**Location**: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

**Added**: March 27, 2026 (PR #1101)

Shared dissolve animation state machine for tree depletion/respawn effects.

### Types

```typescript
interface DissolveAnim {
  /** 1 = dissolving out, -1 = appearing in */
  direction: 1 | -1;
  progress: number;
}
```

### Functions

#### `startDissolve(anims, entityId, direction, instant, applyFn)`

Start or instantly apply a dissolve animation.

**Parameters:**
- `anims: Map<string, DissolveAnim>` - Animation map to manage
- `entityId: string` - Entity to animate
- `direction: 1 | -1` - 1 = dissolve out, -1 = appear in
- `instant: boolean` - If true, skip animation and apply immediately
- `applyFn: (entityId: string, value: number) => void` - Callback to apply dissolve value

**Example:**
```typescript
import { startDissolve } from './DissolveAnimation';

const dissolveAnims = new Map<string, DissolveAnim>();

// Instant dissolve (depletion)
startDissolve(
  dissolveAnims,
  'tree_123',
  1,  // direction: dissolve out
  true,  // instant
  (entityId, value) => {
    // Apply dissolve value to rendering backend
    applyDissolveValue(entityId, value);
  }
);

// Animated appear (respawn)
startDissolve(
  dissolveAnims,
  'tree_123',
  -1,  // direction: appear in
  false,  // animated
  applyDissolveValue
);
```

#### `tickDissolveAnims(anims, deltaTime, applyFn)`

Advance all active dissolve animations by deltaTime.

**Parameters:**
- `anims: Map<string, DissolveAnim>` - Animation map to tick
- `deltaTime: number` - Time elapsed since last tick (seconds)
- `applyFn: (entityId: string, value: number) => void` - Callback to apply dissolve value

**Example:**
```typescript
import { tickDissolveAnims } from './DissolveAnimation';

// In your update loop
function update(deltaTime: number) {
  tickDissolveAnims(
    dissolveAnims,
    deltaTime,
    (entityId, value) => {
      applyDissolveValue(entityId, value);
    }
  );
}
```

### Configuration

**Location**: `packages/shared/src/systems/shared/world/GPUMaterials.ts`

```typescript
export const GPU_VEG_CONFIG = {
  // Duration of respawn dissolve-in animation (seconds)
  // Depletion is instant
  DISSOLVE_DURATION: 0.3,
  
  // Animation progress ceiling (not visual opacity)
  // Actual discard fraction controlled by DISSOLVE_ALPHA_SCALE
  DISSOLVE_MAX: 1.0,
  
  // Fraction of fragments discarded when fully dissolved
  // 0.7 = ~70% of Bayer 4×4 grid cells discarded
  DISSOLVE_ALPHA_SCALE: 0.7,
  
  // Distance fade configuration
  FADE_START: 40,  // meters
  FADE_END: 60,    // meters
};
```

### Implementation Notes

- **Screen-Door Dithering**: Uses Bayer 4×4 pattern in `alphaTestNode` to discard fragments
- **Opaque Render Pass**: Trees stay in opaque pass with full early-Z rejection (no transparency sorting)
- **LOD Preservation**: Dissolve state carries over during LOD transitions
- **Encoding**: 
  - InstancedMesh: `instanceDissolve` Float32 attribute
  - BatchedMesh: Blue channel of batch color (`1.0 - dissolveVal`)

## Tree Collision Proxy

**Location**: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`, `GLBTreeBatchedInstancer.ts`

**Added**: March 27, 2026 (PR #1100)

Functions for retrieving tree geometry for accurate collision detection.

### Functions

#### `getProxyGeometry(entityId)`

Returns LOD geometries for collision proxy creation.

**Parameters:**
- `entityId: string` - Tree entity ID

**Returns:** `{ geometries: THREE.BufferGeometry[], yOffset: number } | null`

**Important:** Returned geometries are shared by the instancer pool. **Callers MUST clone before mutating.**

**Example:**
```typescript
import { getProxyGeometry } from './GLBTreeInstancer';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

const proxyData = getProxyGeometry('tree_123');
if (proxyData) {
  // Merge multi-part geometries (bark + leaves)
  const merged = mergeGeometries(proxyData.geometries);
  
  // MUST clone before scaling (shared geometry!)
  const scaled = merged.clone();
  scaled.scale(scale, scale, scale);
  
  // Create collision proxy mesh
  const proxy = new THREE.Mesh(scaled, invisibleMaterial);
  proxy.position.y = proxyData.yOffset * scale;
}
```

#### `clearProxyGeometryCache()`

Dispose all cached proxy geometries and clear the cache.

**Must be called during world teardown** to prevent GPU buffer leaks.

**Example:**
```typescript
import { clearProxyGeometryCache } from './TreeGLBVisualStrategy';
import {
  destroyGLBTreeInstancer,
  destroyGLBTreeBatchedInstancer,
} from './GLBTreeInstancer';

// During world cleanup
destroyGLBTreeInstancer();
destroyGLBTreeBatchedInstancer();
clearProxyGeometryCache();  // Dispose cached proxy geometries
```

### Geometry Caching

Proxy geometries are cached per `(sourceGeometries, scale)` to avoid redundant merges:

```typescript
// Cache key: (sourceGeometries array reference, rounded scale)
const cacheKey = Math.round(scale * 1000) / 1000;

// Cached geometry includes:
// - Merged multi-part geometry (bark + leaves)
// - Scaled to final size
// - Pre-computed bounding box and sphere
```

**Cache Lifecycle:**
- Created on first `getProxyGeometry()` call for a given model+scale
- Reused for all trees with same model and scale
- Cleared only on world teardown via `clearProxyGeometryCache()`

## Equipment Panel Props

**Location**: `packages/client/src/game/panels/EquipmentPanel.tsx`

**Updated**: March 27, 2026 (PR #1102)

Extended equipment panel to support bank integration and custom actions.

### Interface

```typescript
interface EquipmentPanelProps {
  // Equipment data
  equipment: PlayerEquipmentItems | null;
  world?: ClientWorld;
  
  // Customization
  slotActionLabel?: string;  // Default: "Remove"
  onSlotAction?: (slotKey: string) => void;  // Custom slot action
  footerButtons?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  showBonuses?: boolean;  // Default: true
  layoutVariant?: 'default' | 'bank';  // Default: 'default'
  isVisible?: boolean;  // Default: true
}
```

### Usage Examples

#### Standalone Equipment Panel

```typescript
<EquipmentPanel
  equipment={playerEquipment}
  world={world}
  // Uses default "Remove" action
  // Shows Stats and On Death footer buttons
  // Shows stat bonuses
/>
```

#### Bank Equipment Panel

```typescript
<EquipmentPanel
  equipment={playerEquipment}
  world={world}
  slotActionLabel="Deposit"
  onSlotAction={(slotKey) => {
    // Custom deposit action
    handleDepositEquipment(slotKey);
  }}
  footerButtons={[]}  // No footer buttons in bank
  showBonuses={true}
  layoutVariant="bank"  // Compact layout for bank sidebar
  isVisible={mode === 'equipment'}
/>
```

### Layout Variants

#### `default` Layout
- Standard paperdoll grid (5 columns × 5 rows)
- Overlay portrait (3D avatar behind slots)
- Larger slot sizes (38px desktop, 34px mobile)
- Footer buttons (Stats, On Death)
- Stat bonuses display

#### `bank` Layout
- Compact grid (4 columns × 5 rows)
- Portrait in dedicated grid area (not overlay)
- Smaller slot sizes (30px)
- No footer buttons (controlled by parent)
- Optional stat bonuses

### Portrait Configuration

The equipment panel includes a live 3D VRM portrait that updates when equipment changes:

```typescript
<EquipmentPaperdollPortrait
  world={world}
  equipment={equipment}
  equipmentSignature={equipmentSignature}  // Cache key
  compact={isMobile || layoutVariant === 'bank'}
  layoutVariant={layoutVariant}
  isVisible={isVisible}
/>
```

**Portrait Features:**
- Live 3D rendering of equipped items
- Automatic camera framing
- Zoom controls (mouse wheel)
- Rotation controls (drag)
- Efficient caching (only re-renders on equipment change)

## Dialogue System

**Location**: `packages/client/src/game/panels/dialogue/`

**Added**: March 26, 2026 (PR #1093)

Redesigned NPC dialogue system with live 3D portraits.

### Components

#### `DialoguePopupShell`

Modal shell for NPC dialogue with focus management.

**Props:**
```typescript
interface DialoguePopupShellProps {
  isOpen: boolean;
  onClose: () => void;
  npcName: string;
  npcId: string;
  children: React.ReactNode;
}
```

**Example:**
```typescript
import { DialoguePopupShell } from '@/game/panels/dialogue/DialoguePopupShell';

<DialoguePopupShell
  isOpen={isDialogueOpen}
  onClose={() => setIsDialogueOpen(false)}
  npcName="Shopkeeper Bob"
  npcId="npc_lumbridge_shopkeeper"
>
  <div>
    <p>Welcome to my shop!</p>
    <button onClick={handleOpenShop}>View Shop</button>
  </div>
</DialoguePopupShell>
```

#### `DialogueCharacterPortrait`

Live 3D VRM portrait rendering for NPCs.

**Props:**
```typescript
interface DialogueCharacterPortraitProps {
  npcId: string;
  world: ClientWorld;
  compact?: boolean;  // Default: false
}
```

**Example:**
```typescript
import { DialogueCharacterPortrait } from '@/game/panels/dialogue/DialogueCharacterPortrait';

<DialogueCharacterPortrait
  npcId="npc_lumbridge_shopkeeper"
  world={world}
  compact={false}
/>
```

**Features:**
- Loads NPC VRM model from manifest
- Live 3D rendering with WebGPU
- Automatic camera framing
- Efficient caching (reuses viewport across dialogues)

### Service Handoff

When opening a service (bank, store, tanner) from dialogue, the dialogue properly closes:

```typescript
// In dialogue handler
function handleOpenBank() {
  // Close dialogue first
  setIsDialogueOpen(false);
  
  // Then open bank
  world.emit('bank:open', { npcId });
}
```

## Resource System Changes

**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

**Updated**: March 27, 2026 (PR #1099)

### Tick-Based Respawn

Resources now respawn via deterministic tick counting instead of `setTimeout`:

```typescript
// In ResourceSystem.processRespawns()
for (const [resourceId, resource] of this.resources) {
  if (!resource.isAvailable) {
    const ticksSinceDepleted = currentTick - resource.lastDepleted;
    if (ticksSinceDepleted >= resource.respawnTicks) {
      resource.respawn();
    }
  }
}
```

### Manifest-Based Depletion

Mining and other gathering skills now read `depleteChance` from manifest:

```typescript
// Mining depletion
const depleteChance = resourceData.depleteChance ?? 1.0;
if (depleteChance <= 0) {
  shouldDeplete = false;  // Never depletes (rune essence)
} else {
  const roll = Math.random();
  shouldDeplete = roll < depleteChance;
}
```

**Manifest Example:**
```json
{
  "id": "rune_essence_rock",
  "type": "ore",
  "depleteChance": 0,
  "respawnTicks": 0,
  "drops": [
    {
      "itemId": "rune_essence",
      "chance": 1.0,
      "quantity": 1
    }
  ]
}
```

### Removed Constants

The following constants were removed in favor of manifest values:
- `MINING_DEPLETE_CHANCE` (was 1.0)
- `MINING_REDWOOD_DEPLETE_CHANCE` (was 0.091)

## Tool Validation

**Location**: `packages/shared/src/systems/shared/entities/gathering/ToolUtils.ts`

**Updated**: March 27, 2026 (PR #1098)

### Functions

#### `itemMatchesToolCategory(itemId, category)`

Validate if an item matches a tool category using manifest data.

**Parameters:**
- `itemId: string` - Item ID to validate
- `category: string` - Tool category ('hatchet', 'pickaxe', 'fishing_rod', etc.)

**Returns:** `boolean`

**Example:**
```typescript
import { itemMatchesToolCategory } from './ToolUtils';

// Check if player has correct tool
const hasPickaxe = itemMatchesToolCategory('bronze_pickaxe', 'pickaxe');
// true

const canCutWithPickaxe = itemMatchesToolCategory('bronze_pickaxe', 'hatchet');
// false - cross-skill usage prevented
```

#### `getToolCategory(itemId)`

Extract tool category from item ID.

**Parameters:**
- `itemId: string` - Item ID

**Returns:** `string | null`

**Example:**
```typescript
import { getToolCategory } from './ToolUtils';

getToolCategory('bronze_pickaxe');  // 'pickaxe'
getToolCategory('steel_hatchet');   // 'hatchet'
getToolCategory('lobster_pot');     // 'lobster_pot'
getToolCategory('iron_sword');      // null (not a tool)
```

### Manifest Integration

Tools must be defined in `tools.json` manifest:

```json
{
  "id": "bronze_pickaxe",
  "name": "Bronze Pickaxe",
  "skill": "mining",
  "level": 1,
  "category": "pickaxe"
}
```

**Validation Flow:**
1. Primary: Lookup in `tools.json` manifest, compare `skill` field
2. Fallback: Substring matching with cross-skill guards
3. Warn-once logging for unmanifested tools (bounded to 50 entries)

## Home Teleport System

**Location**: `packages/client/src/game/hud/HomeTeleportButton.tsx`, `MinimapHomeTeleportOrb.tsx`

**Updated**: March 26, 2026 (PR #1095)

### Constants

```typescript
// packages/shared/src/constants/GameConstants.ts
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30000,  // 30 seconds
  CAST_TIME_MS: 3000,  // 3 seconds
};
```

### Events

#### `HOME_TELEPORT_CAST_START`

Emitted when player starts casting home teleport.

**Payload:**
```typescript
{
  playerId: string;
  castTimeMs: number;
}
```

#### `HOME_TELEPORT_FAILED`

Emitted when teleport fails (cooldown, interrupted, etc.).

**Payload:**
```typescript
{
  playerId: string;
  reason: string;
  remainingMs?: number;  // Cooldown remaining (if applicable)
}
```

#### `PLAYER_TELEPORTED`

Emitted when teleport completes successfully.

**Payload:**
```typescript
{
  playerId: string;
  destination: { x: number, y: number, z: number };
}
```

### Visual Effects

**Portal Effect** (`ClientTeleportEffectsSystem.ts`):
- Channel-mode portal with terrain-aware anchoring
- Appears at player position during cast
- Scales up over cast duration
- Disappears on completion or interruption

**Cooldown Display**:
- Both `HomeTeleportButton` and `MinimapHomeTeleportOrb` show cooldown progress
- Circular progress indicator
- Remaining time display
- Disabled state during cooldown

## Death System

**Location**: `packages/shared/src/systems/shared/combat/DeathUtils.ts`

**Updated**: March 26, 2026 (PR #1094)

### Utilities

#### `sanitizeKilledBy(killedBy)`

Sanitize killer name for XSS/Unicode/injection protection.

**Parameters:**
- `killedBy: string | undefined` - Raw killer name

**Returns:** `string`

**Example:**
```typescript
import { sanitizeKilledBy } from './DeathUtils';

const safeKiller = sanitizeKilledBy(rawKillerName);
// Strips control characters, limits length, prevents XSS
```

#### `splitItemsForSafeDeath(items, keepCount)`

Split items into kept and dropped for OSRS-style keep-3 deaths.

**Parameters:**
- `items: InventoryItem[]` - Player's items
- `keepCount: number` - Number of items to keep (default: 3)

**Returns:** `{ keptItems: InventoryItem[], droppedItems: InventoryItem[] }`

**Example:**
```typescript
import { splitItemsForSafeDeath } from './DeathUtils';

const { keptItems, droppedItems } = splitItemsForSafeDeath(
  playerInventory,
  3  // Keep 3 most valuable items
);

// keptItems: 3 most valuable items (by manifest value)
// droppedItems: Everything else (goes to gravestone)
```

#### `validatePosition(position)`

Validate and clamp position to world bounds.

**Parameters:**
- `position: { x: number, y: number, z: number }` - Position to validate

**Returns:** `{ x: number, y: number, z: number }`

**Example:**
```typescript
import { validatePosition } from './DeathUtils';

const safePosition = validatePosition(respawnPosition);
// Clamps to world bounds, ensures valid coordinates
```

### Constants

```typescript
export const GRAVESTONE_ID_PREFIX = 'gravestone_';

// Check if entity is a gravestone
if (entityId.startsWith(GRAVESTONE_ID_PREFIX)) {
  // Handle gravestone interaction
}
```

### Breaking Changes

**Deprecated Event**: `PLAYER_DIED`

Use `PLAYER_SET_DEAD` or `ENTITY_DEATH` instead:

```typescript
// ❌ Old (deprecated)
world.on(EventType.PLAYER_DIED, (event) => {
  // ...
});

// ✅ New
world.on(EventType.PLAYER_SET_DEAD, (event) => {
  // ...
});

// Or use generic entity death
world.on(EventType.ENTITY_DEATH, (event) => {
  if (event.entityType === 'player') {
    // Handle player death
  }
});
```

## Migration Guide

### Updating Tooltip Styles

**Before:**
```typescript
<div
  style={{
    color: theme.colors.accent.secondary,
    fontWeight: 'bold',
    fontSize: '13px',
  }}
>
  Item Name
</div>
```

**After:**
```typescript
import { getTooltipTitleStyle } from '@/ui/core/tooltip/tooltipStyles';

<div style={getTooltipTitleStyle(theme)}>
  Item Name
</div>
```

### Updating Resource Depletion

**Before:**
```typescript
// Hardcoded depletion chance
const shouldDeplete = Math.random() < MINING_DEPLETE_CHANCE;
```

**After:**
```typescript
// Manifest-based depletion
const depleteChance = resourceData.depleteChance ?? 1.0;
const shouldDeplete = depleteChance > 0 && Math.random() < depleteChance;
```

### Updating Tool Validation

**Before:**
```typescript
// Substring matching (allowed cross-skill usage)
const hasTool = itemId.toLowerCase().includes('pickaxe');
```

**After:**
```typescript
import { itemMatchesToolCategory } from './ToolUtils';

// Manifest-based validation with cross-skill guards
const hasTool = itemMatchesToolCategory(itemId, 'pickaxe');
```

### Updating WebSocket URL

**Before:**
```env
PUBLIC_WS_URL=ws://localhost:5555/ws
```

**After:**
```env
PUBLIC_WS_URL=ws://localhost:5556/ws
```

**Note**: WebSocket port changed from 5555 to 5556 with uWebSockets.js migration (March 2026).

## See Also

- [CLAUDE.md](../CLAUDE.md) - Complete development guide
- [README.md](../README.md) - Project overview
- [packages/server/README.md](../packages/server/README.md) - Server documentation
- [packages/client/README.md](../packages/client/README.md) - Client documentation
