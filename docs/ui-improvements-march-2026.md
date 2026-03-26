# UI Improvements - March 2026

**Last Updated**: March 26, 2026  
**Related PRs**: #1093, #1092, #1089, #1088

## Overview

March 2026 saw a comprehensive UI polish pass focusing on consistency, reusability, and user experience. Key improvements include unified skilling panels, redesigned NPC dialogue system, combat panel enhancements, and critical bug fixes.

## Skilling Panel Unification (PR #1093)

### Problem

Each skilling panel (Fletching, Cooking, Smelting, Smithing, Crafting, Tanning) had its own duplicated styling code:
- ~500 lines of duplicated CSS-in-JS across 5 panels
- Inconsistent visual treatment (colors, borders, shadows)
- Duplicated quantity selector logic
- Maintenance burden (changes required updating 5+ files)

### Solution

Extracted shared components and style helpers into `SkillingPanelShared.tsx`:

#### SkillingPanelBody

Wrapper component for panel content with intro text and empty state support.

```typescript
interface SkillingPanelBodyProps {
  theme: Theme;
  children?: ReactNode;
  emptyMessage?: string;  // Shown when no recipes available
  intro?: string;         // Introductory text at top
}

export function SkillingPanelBody({ theme, children, emptyMessage, intro }: SkillingPanelBodyProps)
```

**Usage**:
```tsx
<SkillingPanelBody
  theme={theme}
  intro="Select logs and a recipe to begin fletching."
  emptyMessage={hasLogs ? undefined : "You need logs to fletch items."}
>
  {/* Recipe grid */}
</SkillingPanelBody>
```

#### SkillingSection

Themed section card for grouping recipes.

```typescript
interface SkillingSectionProps {
  theme: Theme;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SkillingSection({ theme, children, className, style }: SkillingSectionProps)
```

**Styling**:
- Background: `theme.colors.background.panelSecondary`
- Border: `theme.colors.border.default`
- Inset highlight: `rgba(255, 255, 255, 0.03)`
- Rounded corners: `rounded-xl`

**Usage**:
```tsx
<SkillingSection theme={theme}>
  <h3>Arrows</h3>
  {/* Arrow recipes */}
</SkillingSection>
```

#### SkillingQuantitySelector

Reusable quantity selector with preset buttons and custom input mode.

```typescript
interface SkillingQuantitySelectorProps {
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
}

export function SkillingQuantitySelector(props: SkillingQuantitySelectorProps)
```

**Features**:
- Preset buttons: 1, 5, 10, All, X (custom)
- Custom input mode with Enter/Escape keyboard shortcuts
- Remembers last custom quantity
- Responsive layout (2 columns mobile, 5 columns desktop)

**Usage**:
```tsx
<SkillingQuantitySelector
  theme={theme}
  showCustomInput={showCustomInput}
  customQuantity={customQuantity}
  lastCustomQuantity={lastCustomQuantity}
  onCustomQuantityChange={setCustomQuantity}
  onCustomSubmit={handleCustomSubmit}
  onCancelCustomInput={() => setShowCustomInput(false)}
  onPresetQuantity={handlePresetQuantity}
  allQuantity={maxQuantity}
  onShowCustomInput={() => setShowCustomInput(true)}
/>
```

#### Style Helpers

Consistent visual treatment for selectable items and badges.

```typescript
// Selectable item style (recipe cards, material options)
export function getSkillingSelectableStyle(
  theme: Theme,
  selected: boolean,
  disabled = false
): CSSProperties

// Badge style (level requirements, quantities)
export function getSkillingBadgeStyle(theme: Theme): CSSProperties
```

**getSkillingSelectableStyle**:
- Selected: Accent-tinted background with glow border
- Unselected: Dark semi-transparent background
- Disabled: 48% opacity

**getSkillingBadgeStyle**:
- Dark background with subtle border
- Secondary text color
- Consistent across all panels

### Impact

- **Code Reduction**: ~500 lines of duplicated styling eliminated
- **Consistency**: All skilling panels now have identical visual language
- **Maintainability**: Single source of truth for skilling UI patterns
- **Reusability**: New skilling panels can use shared components immediately
- **Mobile**: Responsive layouts with proper touch targets

### Migration

**Before** (duplicated in each panel):
```tsx
// FletchingPanel.tsx
const selectableStyle = {
  background: selected ? `${theme.colors.accent.primary}18` : "rgba(8, 10, 14, 0.34)",
  borderColor: selected ? `${theme.colors.accent.primary}66` : theme.colors.border.default,
  // ... 10+ more lines
};

// CookingPanel.tsx
const selectableStyle = {
  background: selected ? `${theme.colors.accent.primary}18` : "rgba(8, 10, 14, 0.34)",
  borderColor: selected ? `${theme.colors.accent.primary}66` : theme.colors.border.default,
  // ... 10+ more lines (duplicated)
};
```

**After** (shared helper):
```tsx
// Any skilling panel
import { getSkillingSelectableStyle } from "./skilling/SkillingPanelShared";

const selectableStyle = getSkillingSelectableStyle(theme, selected, disabled);
```

## NPC Dialogue Redesign (PR #1093)

### Problem

Old dialogue system had several issues:
- Generic modal shell (not dialogue-specific)
- No character portraits (less immersive)
- Service handoffs (bank, store, tanner) left orphaned dialogue panels
- Inconsistent focus management

### Solution

#### DialoguePopupShell

Dedicated modal shell for NPC dialogue with proper focus management.

```typescript
interface DialoguePopupShellProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  contentStyle?: CSSProperties;
}

export function DialoguePopupShell(props: DialoguePopupShellProps)
```

**Features**:
- Auto-focus on open
- Escape key to close
- Click outside to close
- Prevents event bubbling to game world
- Gold accent bar at top (dialogue-specific styling)
- Responsive sizing (mobile-friendly)

**Default Dimensions**:
- Width: 700px
- Max width: `min(86vw, 700px)` (responsive)
- Max height: `min(40vh, 400px)` (prevents overflow)

#### DialogueCharacterPortrait

Live 3D VRM portrait rendering in dialogue panels.

```typescript
interface DialogueCharacterPortraitProps {
  world: World;
  npcEntityId: string;
  npcName: string;
  className?: string;
}

export const DialogueCharacterPortrait = React.memo(function DialogueCharacterPortrait(
  props: DialogueCharacterPortraitProps
)
```

**Features**:
- Renders NPC's VRM model in real-time
- Isolated Three.js scene (doesn't affect main game)
- Automatic camera positioning
- Memoized for performance
- Fallback to placeholder if VRM not loaded

**Implementation**:
- Creates dedicated `WebGPURenderer` instance
- Clones NPC's VRM model (shares textures, independent materials)
- Renders to canvas element in dialogue panel
- Cleanup on unmount (disposes renderer, scene, materials)

#### Service Handoff Fix

Opening bank/store/tanner now properly closes dialogue:

**Before**:
```typescript
// DialogueSystem.ts
if (effect === "openBank") {
  this.executeEffect(playerId, npcId, effect, state.npcEntityId);
  // Dialogue stays open - orphaned panel!
}
```

**After**:
```typescript
// DialogueSystem.ts
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
  this.endDialogue(playerId, npcId);  // Close dialogue immediately
  return;
}
```

**Client-side** (`packages/client/src/hooks/useModalPanels.ts`):
```typescript
const handleBankOpen = (data: unknown) => {
  const d = data as BankData;
  if (d) {
    setBankData({ ...d, visible: true });
    setDialogueData(null);  // Close dialogue
  }
};
```

### Impact

- **Immersion**: Live NPC portraits make dialogue feel more engaging
- **Consistency**: Dedicated dialogue shell with dialogue-specific styling
- **UX**: Service handoffs no longer leave orphaned panels
- **Accessibility**: Proper focus management and keyboard navigation

## Combat Panel Enhancements (PR #1088)

### Combat Style Banners

**Features**:
- Drag-to-action-bar support for combat styles
- Fixed click handling on drag overlays
- Stabilized banner width (4-column calc width instead of flex:1)
- Banners stay same size whether 3 or 4 styles are shown

**Implementation**:
```tsx
// CombatPanel.tsx
<div
  className="combat-style-banner"
  style={{
    width: "calc((100% - 0.75rem) / 4)",  // Fixed width, not flex:1
    // ... other styles
  }}
>
  {/* Style content */}
</div>
```

**Drag Overlay Fix**:
```tsx
// Before: overlay blocked clicks
<div
  className="drag-overlay"
  style={{ pointerEvents: "none" }}  // Couldn't capture drag events
/>

// After: overlay handles both click and drag
<div
  className="drag-overlay"
  style={{ pointerEvents: "auto" }}
  onClick={handleStyleClick}  // Pass through to button
  {...listeners}  // dnd-kit drag listeners
/>
```

### Auto-Retaliate Toggle

**Fix**: Auto-retaliate toggle was overridden by stale entity read on `useEffect` re-run.

**Problem**:
```tsx
// Old code
useEffect(() => {
  const player = world.getEntity(playerId) as PlayerEntity;
  setAutoRetaliate(player.combat.autoRetaliate);  // Overwrites user toggle!
}, [targetName]);  // Re-runs every time target changes
```

**Solution**:
```tsx
// New code - remove direct fallback read
useEffect(() => {
  // getAutoRetaliate callback and UI_AUTO_RETALIATE_CHANGED event handle init and sync
  // No direct entity read needed
}, [targetName]);
```

**Impact**: User's auto-retaliate toggle persists correctly during combat.

## Equipment Panel Cross-Player Leak Fix (PR #1089)

### Problem

Equipment panel showed stale data from previously inspected players:

1. User inspects Player A's equipment
2. Panel opens with Player A's data
3. User closes panel
4. User inspects Player B's equipment
5. Panel opens with Player A's data (stale!)

**Root Cause**: Panel data was captured in closure at render time. When `renderPanel` function was created, it closed over the initial `data` value. Subsequent data changes didn't recreate the function.

### Solution

Include panel data in `useMemo` dependencies to recreate `renderPanel` when data changes:

**Before**:
```tsx
const renderPanel = useMemo(() => {
  return (data: PanelData) => {
    // Render logic using data
  };
}, [theme]);  // Missing data dependency!
```

**After**:
```tsx
const renderPanel = useMemo(() => {
  return (data: PanelData) => {
    // Render logic using data
  };
}, [theme, data]);  // Include data to recreate on change
```

**Alternative Approach** (also valid):
```tsx
const panelDataRef = useRef<PanelData>(data);
useEffect(() => {
  panelDataRef.current = data;
}, [data]);

const renderPanel = useMemo(() => {
  return () => {
    const currentData = panelDataRef.current;  // Always fresh
    // Render logic using currentData
  };
}, [theme]);
```

### Impact

- Equipment panel always shows current player's data
- No cross-contamination between inspected players
- Fixes confusing UX where wrong player's stats appeared

## Arrow Key Capture Fix (PR #1092)

### Problem

When a combined panel tab retained focus, pressing an arrow key would switch tabs instead of moving the camera. This broke camera controls during gameplay.

**Root Cause**: Tab component's `onKeyDown` handler consumed arrow key events without checking if they should be reserved for game controls.

### Solution

Added `reserveArrowKeys` prop to Tab component:

```typescript
interface TabProps {
  // ... other props
  reserveArrowKeys?: boolean;  // Disable arrow key consumption for game windows
}

function Tab({ reserveArrowKeys, ...props }: TabProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Reserve arrow keys for game controls (camera movement)
    if (reserveArrowKeys && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      return;  // Don't consume, let game handle
    }

    // Handle Enter/Space for tab activation (accessibility)
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };
}
```

**Usage**:
```tsx
// Game windows (reserve arrow keys)
<Tab reserveArrowKeys={true} />

// Non-game UI (allow arrow key navigation)
<Tab reserveArrowKeys={false} />
```

### Impact

- Arrow keys control camera movement even when panel tabs have focus
- Enter/Space still activate tabs for keyboard accessibility
- Better separation between game controls and UI navigation

## Missing Packet Handlers (PR #1091)

### Problem

Server was sending 8 packet types that client had no handlers for, causing console errors:

```
[ClientNetwork] No handler for packet: fletchingComplete
[ClientNetwork] No handler for packet: cookingComplete
[ClientNetwork] No handler for packet: smeltingComplete
[ClientNetwork] No handler for packet: smithingComplete
[ClientNetwork] No handler for packet: craftingComplete
[ClientNetwork] No handler for packet: tanningComplete
[ClientNetwork] No handler for packet: combatEnded
[ClientNetwork] No handler for packet: questStarted
```

### Solution

Added 8 missing handler methods in `ClientNetwork.ts`:

```typescript
class ClientNetwork {
  // Fletching batch finished
  onFletchingComplete(data: FletchingCompleteData) {
    this.world.emit("FLETCHING_COMPLETE", data);
  }

  // Cooking result with burn check
  onCookingComplete(data: CookingCompleteData) {
    this.world.emit("COOKING_COMPLETE", data);
  }

  // Smelting batch finished
  onSmeltingComplete(data: SmeltingCompleteData) {
    this.world.emit("SMELTING_COMPLETE", data);
  }

  // Smithing batch finished
  onSmithingComplete(data: SmithingCompleteData) {
    this.world.emit("SMITHING_COMPLETE", data);
  }

  // Crafting batch finished
  onCraftingComplete(data: CraftingCompleteData) {
    this.world.emit("CRAFTING_COMPLETE", data);
  }

  // Tanning batch finished
  onTanningComplete(data: TanningCompleteData) {
    this.world.emit("TANNING_COMPLETE", data);
  }

  // Combat session ended
  onCombatEnded(data: CombatEndedData) {
    this.world.emit("COMBAT_ENDED", data);
  }

  // Quest begun notification
  onQuestStarted(data: QuestStartedData) {
    this.world.emit("QUEST_STARTED", data);
  }
}
```

**Pattern**: Each handler forwards packet data to client world event bus so UI systems can react.

### Impact

- Eliminates "No handler for packet" console errors
- UI systems can now react to skill completion events
- Combat end notifications work correctly
- Quest start notifications work correctly

## Prayer Login Sync Fix (PR #1090)

### Problem

Prayer state (points, active prayers) wasn't syncing correctly on player login:
- Prayer points reset to max on login
- Active prayers cleared on login
- Inconsistent state between sessions

### Solution

Fixed prayer state synchronization in login flow:

```typescript
// ServerNetwork.ts - character selection handler
const prayerData = await prayerRepository.loadPrayerState(characterId);
if (prayerData) {
  playerEntity.prayer.points = prayerData.points;
  playerEntity.prayer.activePrayers = prayerData.activePrayers;
}
```

**Also Fixed**:
- Prayer drain persistence
- Prayer point restoration on level-up
- Active prayer sync on reconnect

### Impact

- Prayer points persist correctly between sessions
- Active prayers remain active after reconnect
- Consistent prayer state across client and server

## Component API Reference

### SkillingPanelBody

**Props**:
- `theme: Theme` - Current theme object
- `children?: ReactNode` - Panel content (recipe grid, etc.)
- `emptyMessage?: string` - Message shown when no content available
- `intro?: string` - Introductory text at top of panel

**Styling**:
- Intro text: `text-xs`, secondary color, relaxed line height
- Empty message: Centered, rounded border, secondary background

**Example**:
```tsx
<SkillingPanelBody
  theme={theme}
  intro="Select ore and a recipe to begin smelting."
  emptyMessage={hasOre ? undefined : "You need ore to smelt bars."}
>
  <div className="grid grid-cols-2 gap-2">
    {recipes.map(recipe => (
      <RecipeCard key={recipe.id} recipe={recipe} />
    ))}
  </div>
</SkillingPanelBody>
```

### SkillingSection

**Props**:
- `theme: Theme` - Current theme object
- `children: ReactNode` - Section content
- `className?: string` - Additional CSS classes
- `style?: CSSProperties` - Additional inline styles

**Styling**:
- Background: `panelSecondary`
- Border: `border.default`
- Padding: `p-3` (12px)
- Border radius: `rounded-xl`
- Inset highlight: `rgba(255, 255, 255, 0.03)`

**Example**:
```tsx
<SkillingSection theme={theme}>
  <h3 className="mb-2 text-sm font-semibold">Bronze Items</h3>
  <div className="grid grid-cols-3 gap-2">
    {bronzeRecipes.map(recipe => (
      <RecipeCard key={recipe.id} recipe={recipe} />
    ))}
  </div>
</SkillingSection>
```

### SkillingQuantitySelector

**Props**:
- `theme: Theme` - Current theme object
- `showCustomInput: boolean` - Whether custom input mode is active
- `customQuantity: string` - Current custom quantity value
- `lastCustomQuantity: number` - Last submitted custom quantity (for placeholder)
- `onCustomQuantityChange: (value: string) => void` - Custom input change handler
- `onCustomSubmit: () => void` - Custom input submit handler
- `onCancelCustomInput: () => void` - Custom input cancel handler
- `onPresetQuantity: (quantity: number) => void` - Preset button click handler
- `allQuantity: number` - Maximum quantity for "All" button
- `onShowCustomInput: () => void` - Show custom input mode handler

**Modes**:

**Preset Mode** (default):
- Buttons: 1, 5, 10, All, X
- Grid layout: 2 columns (mobile), 5 columns (desktop)
- Click preset → immediately process quantity

**Custom Input Mode**:
- Number input with placeholder showing last custom quantity
- OK/Cancel buttons
- Enter key → submit
- Escape key → cancel
- Auto-focus on input

**Example**:
```tsx
const [showCustomInput, setShowCustomInput] = useState(false);
const [customQuantity, setCustomQuantity] = useState("");
const [lastCustomQuantity, setLastCustomQuantity] = useState(1);

const handlePresetQuantity = (qty: number) => {
  processRecipe(selectedRecipe, qty);
};

const handleCustomSubmit = () => {
  const qty = parseInt(customQuantity, 10);
  if (qty > 0) {
    setLastCustomQuantity(qty);
    processRecipe(selectedRecipe, qty);
    setShowCustomInput(false);
    setCustomQuantity("");
  }
};

<SkillingQuantitySelector
  theme={theme}
  showCustomInput={showCustomInput}
  customQuantity={customQuantity}
  lastCustomQuantity={lastCustomQuantity}
  onCustomQuantityChange={setCustomQuantity}
  onCustomSubmit={handleCustomSubmit}
  onCancelCustomInput={() => setShowCustomInput(false)}
  onPresetQuantity={handlePresetQuantity}
  allQuantity={maxQuantity}
  onShowCustomInput={() => setShowCustomInput(true)}
/>
```

### DialoguePopupShell

**Props**:
- `visible: boolean` - Whether dialogue is visible
- `title: string` - Dialogue title (NPC name)
- `children: ReactNode` - Dialogue content (text, responses, portrait)
- `onClose: () => void` - Close handler
- `width?: number | string` - Panel width (default: 700)
- `maxWidth?: number | string` - Max width (default: `min(86vw, 700px)`)
- `maxHeight?: number | string` - Max height (default: `min(40vh, 400px)`)
- `contentStyle?: CSSProperties` - Additional content area styles

**Features**:
- Auto-focus on open
- Escape key to close
- Click outside to close
- Prevents event bubbling to game world
- Gold accent bar at top
- Responsive sizing

**Example**:
```tsx
<DialoguePopupShell
  visible={dialogueData !== null}
  title={dialogueData?.npcName ?? ""}
  onClose={() => setDialogueData(null)}
  width={700}
  maxWidth="min(86vw, 700px)"
  maxHeight="min(40vh, 400px)"
>
  <div className="flex gap-4">
    <DialogueCharacterPortrait
      world={world}
      npcEntityId={dialogueData.npcEntityId}
      npcName={dialogueData.npcName}
    />
    <div className="flex-1">
      <DialogueText text={dialogueData.text} />
      <DialogueResponses responses={dialogueData.responses} />
    </div>
  </div>
</DialoguePopupShell>
```

### DialogueCharacterPortrait

**Props**:
- `world: World` - Game world instance
- `npcEntityId: string` - NPC entity ID
- `npcName: string` - NPC name (for fallback)
- `className?: string` - Additional CSS classes

**Rendering**:
- Creates isolated Three.js scene
- Clones NPC's VRM model
- Renders to 200×200 canvas
- Auto-cleanup on unmount

**Example**:
```tsx
<DialogueCharacterPortrait
  world={world}
  npcEntityId="npc_banker_001"
  npcName="Banker"
  className="rounded-lg"
/>
```

## Style Helpers

### getSkillingSelectableStyle

Generate consistent style for selectable items (recipe cards, material options).

```typescript
function getSkillingSelectableStyle(
  theme: Theme,
  selected: boolean,
  disabled = false
): CSSProperties
```

**Returns**:
```typescript
{
  background: selected ? `${accent}18` : "rgba(8, 10, 14, 0.34)",
  borderColor: selected ? `${accent}66` : theme.colors.border.default,
  boxShadow: selected ? `0 0 0 1px ${accent}33 inset` : "none",
  opacity: disabled ? 0.48 : 1,
}
```

**Usage**:
```tsx
<div
  className="recipe-card"
  style={getSkillingSelectableStyle(theme, isSelected, !canCraft)}
>
  {/* Recipe content */}
</div>
```

### getSkillingBadgeStyle

Generate consistent style for badges (level requirements, quantities).

```typescript
function getSkillingBadgeStyle(theme: Theme): CSSProperties
```

**Returns**:
```typescript
{
  background: "rgba(6, 8, 12, 0.34)",
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.secondary,
}
```

**Usage**:
```tsx
<span
  className="level-badge"
  style={getSkillingBadgeStyle(theme)}
>
  Level {requiredLevel}
</span>
```

## Migration Guide

### Updating Existing Skilling Panels

**Step 1**: Import shared components
```tsx
import {
  SkillingPanelBody,
  SkillingSection,
  SkillingQuantitySelector,
  getSkillingSelectableStyle,
  getSkillingBadgeStyle,
} from "./skilling/SkillingPanelShared";
```

**Step 2**: Replace panel body wrapper
```tsx
// Before
<div className="flex flex-col gap-3">
  {intro && <p className="text-xs" style={{ color: theme.colors.text.secondary }}>{intro}</p>}
  {emptyMessage ? (
    <div className="empty-state" style={{ /* ... */ }}>{emptyMessage}</div>
  ) : (
    children
  )}
</div>

// After
<SkillingPanelBody theme={theme} intro={intro} emptyMessage={emptyMessage}>
  {children}
</SkillingPanelBody>
```

**Step 3**: Replace section wrappers
```tsx
// Before
<div
  className="rounded-xl border p-3"
  style={{
    background: theme.colors.background.panelSecondary,
    borderColor: theme.colors.border.default,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  }}
>
  {children}
</div>

// After
<SkillingSection theme={theme}>
  {children}
</SkillingSection>
```

**Step 4**: Replace quantity selector
```tsx
// Before (duplicated logic)
{showCustomInput ? (
  <div className="flex gap-2">
    <input type="number" value={customQuantity} onChange={...} />
    <button onClick={handleSubmit}>OK</button>
    <button onClick={handleCancel}>Cancel</button>
  </div>
) : (
  <div className="grid grid-cols-5 gap-2">
    <button onClick={() => handleQuantity(1)}>1</button>
    <button onClick={() => handleQuantity(5)}>5</button>
    <button onClick={() => handleQuantity(10)}>10</button>
    <button onClick={() => handleQuantity(allQty)}>All</button>
    <button onClick={() => setShowCustomInput(true)}>X</button>
  </div>
)}

// After (shared component)
<SkillingQuantitySelector
  theme={theme}
  showCustomInput={showCustomInput}
  customQuantity={customQuantity}
  lastCustomQuantity={lastCustomQuantity}
  onCustomQuantityChange={setCustomQuantity}
  onCustomSubmit={handleCustomSubmit}
  onCancelCustomInput={() => setShowCustomInput(false)}
  onPresetQuantity={handlePresetQuantity}
  allQuantity={maxQuantity}
  onShowCustomInput={() => setShowCustomInput(true)}
/>
```

**Step 5**: Replace style helpers
```tsx
// Before (duplicated)
const selectableStyle = {
  background: selected ? `${theme.colors.accent.primary}18` : "rgba(8, 10, 14, 0.34)",
  borderColor: selected ? `${theme.colors.accent.primary}66` : theme.colors.border.default,
  boxShadow: selected ? `0 0 0 1px ${theme.colors.accent.primary}33 inset` : "none",
  opacity: disabled ? 0.48 : 1,
};

// After (shared helper)
const selectableStyle = getSkillingSelectableStyle(theme, selected, disabled);
```

### Creating New Skilling Panels

Use shared components from the start:

```tsx
import {
  SkillingPanelBody,
  SkillingSection,
  SkillingQuantitySelector,
  getSkillingSelectableStyle,
  getSkillingBadgeStyle,
} from "./skilling/SkillingPanelShared";

export function NewSkillingPanel({ theme, data }: NewSkillingPanelProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");
  const [lastCustomQuantity, setLastCustomQuantity] = useState(1);

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Select materials and a recipe to begin."
      emptyMessage={hasMaterials ? undefined : "You need materials to craft items."}
    >
      <SkillingSection theme={theme}>
        <div className="grid grid-cols-2 gap-2">
          {recipes.map(recipe => (
            <div
              key={recipe.id}
              className="recipe-card"
              style={getSkillingSelectableStyle(theme, selectedRecipe?.id === recipe.id)}
              onClick={() => setSelectedRecipe(recipe)}
            >
              <span className="recipe-name">{recipe.name}</span>
              <span style={getSkillingBadgeStyle(theme)}>
                Level {recipe.requiredLevel}
              </span>
            </div>
          ))}
        </div>
      </SkillingSection>

      {selectedRecipe && (
        <SkillingQuantitySelector
          theme={theme}
          showCustomInput={showCustomInput}
          customQuantity={customQuantity}
          lastCustomQuantity={lastCustomQuantity}
          onCustomQuantityChange={setCustomQuantity}
          onCustomSubmit={handleCustomSubmit}
          onCancelCustomInput={() => setShowCustomInput(false)}
          onPresetQuantity={handlePresetQuantity}
          allQuantity={maxQuantity}
          onShowCustomInput={() => setShowCustomInput(true)}
        />
      )}
    </SkillingPanelBody>
  );
}
```

## Best Practices

### Skilling Panels

1. **Always use shared components** - Don't duplicate styling
2. **Consistent intro text** - Explain what materials are needed
3. **Empty states** - Show helpful message when no recipes available
4. **Responsive grids** - Use `grid-cols-2` (mobile) and `sm:grid-cols-3` (desktop)
5. **Proper touch targets** - Minimum 44×44px for mobile

### Dialogue Panels

1. **Use DialoguePopupShell** - Don't use generic modal
2. **Include character portrait** - More immersive than text-only
3. **Close on service handoff** - Bank/store/tanner should close dialogue
4. **Keyboard navigation** - Escape to close, Enter to select response
5. **Prevent event bubbling** - Mark events as `isCoreUI` to prevent game interaction

### Combat Panels

1. **Fixed banner width** - Use calc width, not flex:1
2. **Drag overlay** - Handle both click and drag events
3. **Optimistic updates** - Update UI immediately, sync with server
4. **Auto-retaliate** - Don't override with stale entity reads

## Performance Considerations

### Skilling Panels

- **Shared components**: Reduce bundle size (single implementation)
- **Memoization**: Use `React.memo` for expensive recipe cards
- **Virtual scrolling**: For panels with 100+ recipes (future)

### Dialogue Panels

- **Portrait rendering**: Isolated Three.js scene (doesn't affect main game)
- **Memoization**: `DialogueCharacterPortrait` is memoized
- **Cleanup**: Dispose renderer/scene/materials on unmount
- **Texture sharing**: Cloned VRM shares textures (memory efficient)

### Combat Panels

- **Optimistic updates**: Reduce perceived latency
- **Debounced sync**: Batch style changes to server
- **Fixed layouts**: Prevent reflow on style count change

## Accessibility

### Keyboard Navigation

- **Tab**: Focus next interactive element
- **Enter/Space**: Activate focused element
- **Escape**: Close modal/cancel input
- **Arrow keys**: Reserved for game controls (camera movement)

### Screen Readers

- **ARIA labels**: All buttons have `aria-label`
- **Role attributes**: Modals use `role="dialog"` and `aria-modal="true"`
- **Focus management**: Auto-focus on modal open, restore on close
- **Semantic HTML**: Use `<button>`, `<input>`, `<h2>` instead of `<div>`

### Touch Targets

- **Minimum size**: 44×44px for mobile
- **Spacing**: 8px gap between interactive elements
- **Visual feedback**: Hover/active states for all buttons

## Future Improvements

### Skilling Panels

- [ ] Virtual scrolling for large recipe lists
- [ ] Recipe search/filter
- [ ] Favorite recipes
- [ ] Batch crafting queue
- [ ] Material requirement tooltips

### Dialogue Panels

- [ ] Dialogue history (scroll back)
- [ ] Voice acting integration
- [ ] Animated portraits (lip sync, expressions)
- [ ] Dialogue choices with icons
- [ ] Multi-NPC dialogues (group conversations)

### Combat Panels

- [ ] Combat style presets (save/load)
- [ ] Damage calculator
- [ ] DPS meter
- [ ] Combat log
- [ ] Auto-retaliate delay slider

## References

- **PR #1093**: Dialogue and skilling panel polish
- **PR #1092**: Arrow key capture fix
- **PR #1091**: Missing packet handlers
- **PR #1090**: Prayer login sync
- **PR #1089**: Equipment panel cross-player leak
- **PR #1088**: Comprehensive UI panel upgrade
- **SkillingPanelShared.tsx**: Shared skilling components
- **DialoguePopupShell.tsx**: Dialogue modal shell
- **DialogueCharacterPortrait.tsx**: Live NPC portrait rendering
