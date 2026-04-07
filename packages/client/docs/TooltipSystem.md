# UI Tooltip System

The unified tooltip system provides consistent styling and behavior across all UI panels in Hyperscape. Centralized style utilities ensure visual consistency for inventory, equipment, bank, spells, prayer, skills, trade, store, and loot panels.

## Overview

Previously, each panel implemented its own tooltip styling, leading to ~500 lines of duplicated code and inconsistent visual appearance. The new system provides a set of style utility functions that generate consistent React `CSSProperties` objects based on the current theme.

## Key Features

- **Centralized Styling**: Single source of truth for tooltip appearance
- **Theme-Aware**: All styles adapt to current theme (Hyperscape, Dark, Light)
- **Consistent Hierarchy**: Clear visual distinction between titles, metadata, body text, and status indicators
- **Tone Support**: Status indicators support success/danger/warning tones
- **Zero Duplication**: Eliminates ~500 lines of duplicated styling code

## API Reference

### Module: `packages/client/src/ui/core/tooltip/tooltipStyles.ts`

#### `getTooltipTitleStyle()`

Generate title text styling for tooltip headers.

```typescript
function getTooltipTitleStyle(
  theme: Theme,
  accentColor?: string
): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object
- `accentColor` - Optional accent color (defaults to `theme.colors.accent.secondary`)

**Returns:** CSSProperties object with title styling

**Style Properties:**
- `color`: Accent color (default: theme.colors.accent.secondary)
- `fontWeight`: 700 (bold)
- `fontSize`: "13px"
- `lineHeight`: 1.2

**Example:**
```typescript
<div style={getTooltipTitleStyle(theme)}>
  Iron Sword
</div>

// With custom accent color
<div style={getTooltipTitleStyle(theme, theme.colors.state.success)}>
  Quest Complete!
</div>
```

#### `getTooltipMetaStyle()`

Generate metadata/secondary text styling.

```typescript
function getTooltipMetaStyle(theme: Theme): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object

**Returns:** CSSProperties object with metadata styling

**Style Properties:**
- `color`: theme.colors.text.muted
- `fontSize`: "11px"
- `lineHeight`: 1.3

**Use Cases:**
- Item quantities ("x5", "x100")
- Level requirements ("Level 40 Attack")
- Contextual hints ("Drag to reorder")

**Example:**
```typescript
<div style={getTooltipTitleStyle(theme)}>
  Dragon Scimitar
  <span style={getTooltipMetaStyle(theme)}> x1</span>
</div>
<div style={getTooltipMetaStyle(theme)}>
  Level 60 Attack required
</div>
```

#### `getTooltipBodyStyle()`

Generate body content styling for descriptions and details.

```typescript
function getTooltipBodyStyle(theme: Theme): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object

**Returns:** CSSProperties object with body text styling

**Style Properties:**
- `color`: theme.colors.text.secondary
- `fontSize`: "11px"
- `lineHeight`: 1.45

**Use Cases:**
- Item descriptions
- Spell effects
- Stat bonuses
- Detailed information

**Example:**
```typescript
<div style={getTooltipBodyStyle(theme)}>
  A powerful scimitar forged from dragon metal.
</div>
<div style={getTooltipBodyStyle(theme)}>
  Attack: +67 • Strength: +66
</div>
```

#### `getTooltipDividerStyle()`

Generate section divider styling with optional accent color.

```typescript
function getTooltipDividerStyle(
  theme: Theme,
  accentColor?: string
): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object
- `accentColor` - Optional accent color for divider (defaults to `theme.colors.border.default`)

**Returns:** CSSProperties object with divider styling

**Style Properties:**
- `borderTop`: `1px solid ${accentColor}33`
- `marginTop`: "8px"
- `paddingTop`: "8px"

**Use Cases:**
- Separating tooltip sections
- Visual hierarchy between content blocks
- Grouping related information

**Example:**
```typescript
<div style={getTooltipTitleStyle(theme)}>Iron Sword</div>
<div style={getTooltipBodyStyle(theme)}>A basic iron weapon.</div>

<div style={getTooltipDividerStyle(theme)}>
  <div style={getTooltipBodyStyle(theme)}>
    Attack: +10 • Strength: +8
  </div>
</div>
```

#### `getTooltipTagStyle()`

Generate tag/badge styling for labels and categories.

```typescript
function getTooltipTagStyle(theme: Theme): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object

**Returns:** CSSProperties object with tag styling

**Style Properties:**
- `display`: "inline-flex"
- `alignItems`: "center"
- `padding`: "2px 6px"
- `borderRadius`: theme.borderRadius.sm
- `background`: `${theme.colors.background.tertiary}cc`
- `border`: `1px solid ${theme.colors.border.default}33`
- `color`: theme.colors.text.secondary
- `fontSize`: "10px"
- `lineHeight`: 1.2

**Use Cases:**
- Rune costs ("5x Air Rune", "3x Fire Rune")
- Item categories ("Weapon", "Armor", "Food")
- Skill requirements

**Example:**
```typescript
<div style={getTooltipBodyStyle(theme)}>
  Rune Cost:
  <span style={getTooltipTagStyle(theme)}>5x Air</span>
  <span style={getTooltipTagStyle(theme)}>3x Fire</span>
</div>
```

#### `getTooltipStatusStyle()`

Generate status indicator styling with tone-based coloring.

```typescript
function getTooltipStatusStyle(
  theme: Theme,
  tone: 'default' | 'success' | 'danger' | 'warning'
): React.CSSProperties
```

**Parameters:**
- `theme` - Current theme object
- `tone` - Status tone (default/success/danger/warning)

**Returns:** CSSProperties object with status indicator styling

**Style Properties:**
- `marginTop`: "8px"
- `padding`: "5px 8px"
- `borderRadius`: theme.borderRadius.sm
- `background`: Tone-specific background color with transparency
- `border`: Tone-specific border color
- `color`: Tone-specific text color
- `fontSize`: "10px"
- `lineHeight`: 1.3
- `textAlign`: "center"
- `fontWeight`: 600

**Tone Colors:**
- `success`: Green (theme.colors.state.success)
- `danger`: Red (theme.colors.state.danger)
- `warning`: Yellow (theme.colors.state.warning)
- `default`: Accent (theme.colors.accent.secondary)

**Use Cases:**
- Level requirements ("Requires level 60 Attack")
- Active states ("Currently Active")
- Warnings ("Not enough runes")
- Success messages ("Quest Complete!")

**Example:**
```typescript
// Danger tone for requirements
{playerLevel < requiredLevel && (
  <div style={getTooltipStatusStyle(theme, 'danger')}>
    Requires level {requiredLevel} Attack
  </div>
)}

// Success tone for active state
{isActive && (
  <div style={getTooltipStatusStyle(theme, 'success')}>
    Currently Active
  </div>
)}
```

## Usage Patterns

### Basic Item Tooltip

```typescript
import { 
  getTooltipTitleStyle, 
  getTooltipMetaStyle, 
  getTooltipBodyStyle 
} from '@/ui/core/tooltip/tooltipStyles';

<CursorTooltip visible={true} position={hoverState}>
  <div style={getTooltipTitleStyle(theme)}>
    {itemName}
    {quantity > 1 && (
      <span style={getTooltipMetaStyle(theme)}> x{quantity}</span>
    )}
  </div>
  <div style={getTooltipBodyStyle(theme)}>
    {itemDescription}
  </div>
</CursorTooltip>
```

### Equipment Tooltip with Bonuses

```typescript
<CursorTooltip visible={true} position={hoverState}>
  <div style={getTooltipTitleStyle(theme, rarityColor)}>
    {itemName}
  </div>
  <div style={getTooltipMetaStyle(theme)}>
    {itemType} • {rarity}
  </div>
  
  <div style={getTooltipDividerStyle(theme, rarityColor)}>
    <div style={getTooltipBodyStyle(theme)}>
      Attack: +{attackBonus} • Defense: +{defenseBonus}
    </div>
  </div>
  
  {!meetsRequirements && (
    <div style={getTooltipStatusStyle(theme, 'danger')}>
      Requires level {requiredLevel} Attack
    </div>
  )}
</CursorTooltip>
```

### Spell Tooltip with Rune Costs

```typescript
<CursorTooltip visible={true} position={hoverState}>
  <div style={getTooltipTitleStyle(theme)}>
    {spellName}
  </div>
  <div style={getTooltipMetaStyle(theme)}>
    Level {spellLevel} Magic
  </div>
  
  <div style={getTooltipBodyStyle(theme)}>
    {spellDescription}
  </div>
  
  <div style={getTooltipDividerStyle(theme)}>
    <div style={getTooltipMetaStyle(theme)}>Rune Cost</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {runes.map(rune => (
        <span key={rune.id} style={getTooltipTagStyle(theme)}>
          {rune.quantity}x {rune.name}
        </span>
      ))}
    </div>
  </div>
  
  {isSelected && (
    <div style={getTooltipStatusStyle(theme, 'success')}>
      Currently Selected for Autocast
    </div>
  )}
</CursorTooltip>
```

## Integration with CursorTooltip

The style utilities are designed to work with the `CursorTooltip` component:

```typescript
import { CursorTooltip } from '@/ui';
import { getTooltipTitleStyle } from '@/ui/core/tooltip/tooltipStyles';

function MyComponent() {
  const theme = useThemeStore(s => s.theme);
  const [hoverState, setHoverState] = useState<{x: number, y: number} | null>(null);
  
  return (
    <>
      <button
        onMouseEnter={(e) => setHoverState({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setHoverState({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoverState(null)}
      >
        Hover me
      </button>
      
      {hoverState && (
        <CursorTooltip
          visible={true}
          position={hoverState}
          estimatedSize={{ width: 180, height: 48 }}
          style={{
            zIndex: theme.zIndex.tooltip,
            minWidth: '140px',
            maxWidth: '240px',
          }}
        >
          <div style={getTooltipTitleStyle(theme)}>
            Tooltip Title
          </div>
        </CursorTooltip>
      )}
    </>
  );
}
```

## Performance Considerations

### Hover State Management

Each tooltip-enabled component manages its own hover state:

```typescript
const [hoverState, setHoverState] = useState<{x: number, y: number} | null>(null);
```

**Important**: `onMouseMove` fires at 60+ Hz, creating a new object on every event. For performance-critical components (e.g., bank slots with hundreds of items):

1. **Throttle position updates**: Only update when position changes by >2px
2. **Lift state to parent**: Parent manages hover state, children call `onHoverStart`/`onHoverMove`/`onHoverEnd`
3. **Use `React.memo`**: Wrap slot components to prevent unnecessary re-renders

**Example (lifted state pattern):**
```typescript
// Parent component
const [hoveredItem, setHoveredItem] = useState<{item, position} | null>(null);

// Child component
<BankSlot
  onHoverStart={(item, pos) => setHoveredItem({item, position: pos})}
  onHoverMove={(pos) => setHoveredItem(prev => prev ? {...prev, position: pos} : null)}
  onHoverEnd={() => setHoveredItem(null)}
/>

// Render tooltip in parent (single portal)
{hoveredItem && renderTooltip(hoveredItem)}
```

## Migration Guide

### From Inline Styles

**Before:**
```typescript
<div
  style={{
    color: theme.colors.accent.secondary,
    fontWeight: 'bold',
    fontSize: '13px',
    marginBottom: '4px',
  }}
>
  {itemName}
</div>
```

**After:**
```typescript
<div style={getTooltipTitleStyle(theme)}>
  {itemName}
</div>
```

### From Custom Tooltip Components

**Before:**
```typescript
<div className="tooltip-title" style={{ color: rarityColor }}>
  {itemName}
</div>
<div className="tooltip-meta">
  Level {level} required
</div>
```

**After:**
```typescript
<div style={getTooltipTitleStyle(theme, rarityColor)}>
  {itemName}
</div>
<div style={getTooltipMetaStyle(theme)}>
  Level {level} required
</div>
```

## Panels Using Unified Tooltips

The following panels have been migrated to use the unified tooltip system:

- **ActionBarPanel** - Action bar slots and rubbish bin
- **ActionPanel** - Draggable action slots
- **BankPanel** - Bank items, tabs, and equipment sidebar
- **EquipmentPanel** - Equipment slots and paperdoll
- **InventoryPanel** - Inventory slots and coin pouch
- **LootWindowPanel** - Loot items
- **PrayerPanel** - Prayer icons and descriptions
- **SkillsPanel** - Skill icons and XP progress
- **SpellsPanel** - Spell icons and rune costs
- **StorePanel** - Store items
- **TradePanel** - Trade slots and inventory items

## Customization

### Adding New Tone Colors

To add a new tone (e.g., "info"), update `getToneColors()`:

```typescript
function getToneColors(theme: Theme, tone: TooltipTone) {
  switch (tone) {
    // ... existing cases ...
    case 'info':
      return {
        text: theme.colors.state.info,
        background: `${theme.colors.state.info}22`,
        border: `${theme.colors.state.info}4d`,
      };
  }
}
```

### Extending Style Functions

To add new style utilities, follow the existing pattern:

```typescript
export function getTooltipFooterStyle(theme: Theme): React.CSSProperties {
  return {
    color: theme.colors.text.muted,
    fontSize: '9px',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: `1px solid ${theme.colors.border.default}30`,
    opacity: 0.7,
  };
}
```

## Best Practices

### 1. Use Semantic Style Functions

Choose the style function that matches the content's semantic meaning:

```typescript
// ✅ GOOD - semantic meaning clear
<div style={getTooltipTitleStyle(theme)}>{itemName}</div>
<div style={getTooltipMetaStyle(theme)}>{itemType}</div>
<div style={getTooltipBodyStyle(theme)}>{description}</div>

// ❌ BAD - using title style for everything
<div style={getTooltipTitleStyle(theme)}>{itemName}</div>
<div style={getTooltipTitleStyle(theme)}>{itemType}</div>
<div style={getTooltipTitleStyle(theme)}>{description}</div>
```

### 2. Avoid Redundant Spreads

When the style function is the only property source, use it directly:

```typescript
// ✅ GOOD
<div style={getTooltipTitleStyle(theme)}>Title</div>

// ❌ UNNECESSARY - spread adds noise
<div style={{ ...getTooltipTitleStyle(theme) }}>Title</div>
```

### 3. Combine Styles Appropriately

When combining with custom styles, spread the utility function first:

```typescript
// ✅ GOOD - utility first, then overrides
<div style={{
  ...getTooltipBodyStyle(theme),
  marginBottom: '12px',
  fontStyle: 'italic',
}}>
  {description}
</div>
```

### 4. Use Consistent Spacing

Follow the established spacing patterns:

```typescript
// Title → Meta: 4px gap
<div style={getTooltipTitleStyle(theme)}>{title}</div>
<div style={{ ...getTooltipMetaStyle(theme), marginTop: '4px' }}>
  {meta}
</div>

// Divider: 8px margin + padding
<div style={getTooltipDividerStyle(theme)}>
  {content}
</div>
```

## Troubleshooting

**Tooltip styles not applying:**

**Cause**: Theme not passed correctly or style function not imported.

**Fix**: Verify imports and theme access:
```typescript
import { getTooltipTitleStyle } from '@/ui/core/tooltip/tooltipStyles';
import { useThemeStore } from '@/ui';

const theme = useThemeStore(s => s.theme);
```

**Inconsistent tooltip appearance across panels:**

**Cause**: Panel using custom inline styles instead of utility functions.

**Fix**: Replace inline styles with utility functions:
```typescript
// Before
<div style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>

// After
<div style={getTooltipTitleStyle(theme)}>
```

**Performance issues with many tooltips:**

**Cause**: Each slot managing its own hover state causes excessive re-renders.

**Fix**: Lift hover state to parent component (see [Performance Considerations](#performance-considerations)).

## See Also

- `packages/client/src/ui/core/tooltip/CursorTooltip.tsx` - Tooltip component
- `packages/client/src/ui/theme/themes.ts` - Theme definitions
- `packages/client/src/game/panels/` - Panel implementations using unified tooltips
