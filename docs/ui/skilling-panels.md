# Skilling Panel Components

Shared React components for consistent skilling panel layouts across Fletching, Cooking, Smelting, Smithing, Crafting, and Tanning interfaces.

## Overview

**Added**: March 26, 2026 (PR #1093)

**Purpose**: Eliminate ~500 lines of duplicated styling and provide consistent visual language for all crafting/processing interfaces.

**Location**: `packages/client/src/game/panels/skilling/SkillingPanelShared.tsx`

## Components

### SkillingPanelBody

Outer container for skilling panels with intro text and empty state handling.

```typescript
export function SkillingPanelBody(props: {
  theme: Theme;
  children?: ReactNode;
  emptyMessage?: string;
  intro?: string;
})
```

**Props**:
- `theme` - Theme object from `useThemeStore`
- `children` - Panel content (recipe lists, quantity selectors)
- `emptyMessage` - Message to show when no recipes available (optional)
- `intro` - Introductory text explaining the panel (optional)

**Usage**:
```typescript
import { SkillingPanelBody } from '@/game/panels/skilling/SkillingPanelShared';

<SkillingPanelBody
  theme={theme}
  intro="Browse available recipes by category, then inspect the exact inputs and crafting XP before starting a batch."
  emptyMessage="You don't have the materials to craft anything."
>
  {/* Recipe sections */}
</SkillingPanelBody>
```

**Features**:
- Automatic empty state rendering when `emptyMessage` provided and no children
- Intro text with secondary color styling
- Consistent padding and layout

### SkillingSection

Section container for grouping related recipes or controls.

```typescript
export function SkillingSection(props: {
  theme: Theme;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
})
```

**Props**:
- `theme` - Theme object
- `children` - Section content
- `className` - Additional CSS classes (optional)
- `style` - Additional inline styles (optional)

**Usage**:
```typescript
import { SkillingSection } from '@/game/panels/skilling/SkillingPanelShared';

<SkillingSection theme={theme}>
  <div className="mb-2 text-xs font-medium">
    Select a bar to smelt:
  </div>
  {/* Recipe list */}
</SkillingSection>
```

**Features**:
- Rounded corners with border
- Panel secondary background
- Inset highlight for depth
- Consistent padding (12px)

### SkillingQuantitySelector

Reusable quantity selector with preset buttons and custom input mode.

```typescript
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
```

**Props**:
- `theme` - Theme object
- `showCustomInput` - Whether custom input mode is active
- `customQuantity` - Current custom quantity input value
- `lastCustomQuantity` - Last custom quantity (for placeholder)
- `onCustomQuantityChange` - Handler for input value changes
- `onCustomSubmit` - Handler for custom quantity submission
- `onCancelCustomInput` - Handler for cancelling custom input
- `onPresetQuantity` - Handler for preset button clicks (1, 5, 10, All)
- `allQuantity` - Value for "All" button (-1 for max, or specific number like 28)
- `onShowCustomInput` - Handler for "X" button click

**Usage**:
```typescript
import { SkillingQuantitySelector } from '@/game/panels/skilling/SkillingPanelShared';

const [showQuantityInput, setShowQuantityInput] = useState(false);
const [customQuantity, setCustomQuantity] = useState("");
const [lastCustomQuantity, setLastCustomQuantity] = useState(1);

<SkillingQuantitySelector
  theme={theme}
  showCustomInput={showQuantityInput}
  customQuantity={customQuantity}
  lastCustomQuantity={lastCustomQuantity}
  onCustomQuantityChange={setCustomQuantity}
  onCustomSubmit={handleCustomQuantitySubmit}
  onCancelCustomInput={() => setShowQuantityInput(false)}
  onPresetQuantity={(qty) => handleCraft(selectedRecipe, qty)}
  allQuantity={-1}  // -1 = craft all possible
  onShowCustomInput={() => setShowQuantityInput(true)}
/>
```

**Features**:
- Preset buttons: 1, 5, 10, All, X
- Custom input mode with Enter/Escape key handling
- Remembers last custom quantity (OSRS feature)
- Responsive grid layout (2 columns mobile, 5 columns desktop)
- Cancel button in custom input mode

**Keyboard Shortcuts**:
- `Enter` - Submit custom quantity
- `Escape` - Cancel custom input mode

## Style Helpers

### getSkillingSelectableStyle()

Generate consistent style for selectable recipe items.

```typescript
export function getSkillingSelectableStyle(
  theme: Theme,
  selected: boolean,
  disabled?: boolean,
): CSSProperties
```

**Parameters**:
- `theme` - Theme object
- `selected` - Whether item is currently selected
- `disabled` - Whether item is disabled (optional, default: false)

**Returns**: CSSProperties object with background, border, boxShadow, opacity

**Usage**:
```typescript
import { getSkillingSelectableStyle } from '@/game/panels/skilling/SkillingPanelShared';

<button
  onClick={() => setSelectedRecipe(recipe)}
  style={getSkillingSelectableStyle(theme, isSelected, !canCraft)}
>
  {/* Recipe content */}
</button>
```

**Visual States**:
- **Selected**: Accent primary background (18% opacity), accent border, inset glow
- **Unselected**: Dark background, default border
- **Disabled**: 48% opacity

### getSkillingBadgeStyle()

Generate consistent style for info badges (level, XP, cost).

```typescript
export function getSkillingBadgeStyle(theme: Theme): CSSProperties
```

**Parameters**:
- `theme` - Theme object

**Returns**: CSSProperties object with background, border, color

**Usage**:
```typescript
import { getSkillingBadgeStyle } from '@/game/panels/skilling/SkillingPanelShared';

<div
  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
  style={getSkillingBadgeStyle(theme)}
>
  {recipe.xp} XP
</div>
```

**Visual Style**:
- Dark background (rgba(6, 8, 12, 0.34))
- Default border
- Secondary text color
- Pill shape (rounded-full)

## Example: Complete Skilling Panel

```typescript
import {
  SkillingPanelBody,
  SkillingSection,
  SkillingQuantitySelector,
  getSkillingSelectableStyle,
  getSkillingBadgeStyle,
} from '@/game/panels/skilling/SkillingPanelShared';

export function CraftingPanel({ availableRecipes, onClose }: CraftingPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");
  const [lastCustomQuantity, setLastCustomQuantity] = useState(1);

  return (
    <SkillingPanelBody
      theme={theme}
      intro="Browse available recipes by category, then inspect the exact inputs and crafting XP before starting a batch."
      emptyMessage={
        availableRecipes.length === 0
          ? "You don't have the materials to craft anything."
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {/* Recipe Categories */}
        {groupedRecipes.map(([category, recipes]) => (
          <SkillingSection key={category} theme={theme}>
            <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              {CATEGORY_LABELS[category]}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {recipes.map((recipe) => {
                const isSelected = selectedRecipe?.output === recipe.output;
                const canCraft = recipe.meetsLevel && recipe.hasInputs;

                return (
                  <button
                    key={recipe.output}
                    onClick={() => setSelectedRecipe(recipe)}
                    style={getSkillingSelectableStyle(theme, isSelected, !canCraft)}
                  >
                    {/* Recipe content */}
                  </button>
                );
              })}
            </div>
          </SkillingSection>
        ))}

        {/* Selected Recipe Details */}
        {selectedRecipe && (
          <SkillingSection theme={theme}>
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl">{getItemIcon(selectedRecipe.output)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {selectedRecipe.name}
                </div>
                <div className="mt-1 text-xs">
                  {selectedRecipe.inputs.map(i => `${i.amount}x ${i.item}`).join(", ")}
                </div>
              </div>
              <div style={getSkillingBadgeStyle(theme)}>
                {selectedRecipe.xp} XP
              </div>
            </div>

            <div className="mb-2 text-xs font-medium">
              How many?
            </div>

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
          </SkillingSection>
        )}
      </div>
    </SkillingPanelBody>
  );
}
```

## Migration from Old Panels

### Before (Duplicated Code)

Each skilling panel had ~200 lines of duplicated styling:

```typescript
// FletchingPanel.tsx (OLD)
<div className="rounded-lg shadow-2xl border" style={{
  ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
  minWidth: "380px",
  maxWidth: "480px",
  maxHeight: "80vh",
}}>
  <div className="p-3 overflow-y-auto">
    {availableRecipes.length === 0 ? (
      <div className="text-center py-4 text-sm">
        You don't have the materials to fletch anything.
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {/* Recipe list with inline styles */}
      </div>
    )}
  </div>
</div>
```

### After (Shared Components)

```typescript
// FletchingPanel.tsx (NEW)
<SkillingPanelBody
  theme={theme}
  intro="Review each fletching recipe by category..."
  emptyMessage="You don't have the materials to fletch anything."
>
  <div className="flex flex-col gap-3">
    {/* Recipe list using shared components */}
  </div>
</SkillingPanelBody>
```

**Reduction**: ~200 lines → ~50 lines per panel

## Panels Using Shared Components

All skilling panels now use shared components:

1. **FletchingPanel** - Arrow shafts, bows, stringing, arrows
2. **CookingPanel** - Fish, meat, bread (uses range/fire)
3. **SmeltingPanel** - Bars from ores
4. **SmithingPanel** - Weapons, armor, tools from bars
5. **CraftingPanel** - Leather armor, jewelry, gem cutting
6. **TanningPanel** - Hides to leather

**Consistency Benefits**:
- Same layout and spacing
- Same color scheme and hover states
- Same quantity selector behavior
- Same keyboard shortcuts
- Same responsive breakpoints

## Accessibility

### Keyboard Navigation

- `Tab` - Navigate between recipe buttons
- `Enter` / `Space` - Select recipe
- `1`, `5`, `0` (zero) - Quick quantity selection
- `X` - Open custom quantity input
- `Enter` - Submit custom quantity
- `Escape` - Cancel custom input

### Screen Readers

- Recipe buttons have descriptive labels
- Quantity buttons announce their values
- Custom input has placeholder text
- Empty state messages are announced

### Focus Management

- Focus trap within custom input mode
- Autofocus on custom input when opened
- Focus returns to "X" button after cancel

## Theming

All components respect the active theme:

**Hyperscape Theme**:
- Warm gradients (bronze/gold accents)
- Subtle inset highlights
- Parchment-style backgrounds

**Other Themes**:
- Accent primary color for selections
- Theme-specific backgrounds and borders
- Consistent with theme's visual language

## Performance

### Memoization

Components use `useMemo` for expensive style calculations:

```typescript
const styles = useMemo(() => ({
  container: { /* ... */ },
  button: { /* ... */ },
  // ...
}), [theme, isSelected, isDisabled]);
```

### Render Optimization

- `React.memo` not used (components are lightweight)
- Style objects memoized to prevent re-creation
- No expensive computations in render path

## See Also

- [FletchingPanel](../../packages/client/src/game/panels/FletchingPanel.tsx) - Example usage
- [CraftingPanel](../../packages/client/src/game/panels/CraftingPanel.tsx) - Example usage
- [SmithingPanel](../../packages/client/src/game/panels/SmithingPanel.tsx) - Example usage
- [Theme System](../../packages/client/src/ui/theme/themes.ts) - Theme definitions
