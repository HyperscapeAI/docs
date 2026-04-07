# UI Tooltip System

**Added**: March 27, 2026 (PR #1102)  
**Location**: `packages/client/src/ui/core/tooltip/tooltipStyles.ts`

## Overview

The UI tooltip system provides centralized, consistent tooltip styling across all game panels. It eliminates ~500 lines of duplicated styling code and ensures visual hierarchy and readability across inventory, equipment, bank, spells, prayer, skills, trade, store, and loot panels.

## Core Functions

### `getTooltipTitleStyle(theme, accentColor?)`

Returns styling for tooltip title text.

**Parameters**:
- `theme: Theme` - Current theme object
- `accentColor?: string` - Optional accent color (defaults to `theme.colors.accent.secondary`)

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<div style={getTooltipTitleStyle(theme)}>
  Iron Sword
</div>
```

**Output Style**:
```typescript
{
  color: accentColor,
  fontWeight: 700,
  fontSize: '13px',
  lineHeight: 1.2,
}
```

---

### `getTooltipMetaStyle(theme)`

Returns styling for metadata/secondary text (e.g., item type, level requirements).

**Parameters**:
- `theme: Theme` - Current theme object

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<div style={getTooltipMetaStyle(theme)}>
  Level 40 Attack required
</div>
```

**Output Style**:
```typescript
{
  color: theme.colors.text.muted,
  fontSize: '11px',
  lineHeight: 1.3,
}
```

---

### `getTooltipBodyStyle(theme)`

Returns styling for body content text (e.g., descriptions, stats).

**Parameters**:
- `theme: Theme` - Current theme object

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<div style={getTooltipBodyStyle(theme)}>
  A sturdy iron sword suitable for combat.
</div>
```

**Output Style**:
```typescript
{
  color: theme.colors.text.secondary,
  fontSize: '11px',
  lineHeight: 1.45,
}
```

---

### `getTooltipDividerStyle(theme, accentColor?)`

Returns styling for section dividers within tooltips.

**Parameters**:
- `theme: Theme` - Current theme object
- `accentColor?: string` - Optional accent color for border (defaults to `theme.colors.border.default`)

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<div style={getTooltipDividerStyle(theme)}>
  {/* Content below divider */}
</div>
```

**Output Style**:
```typescript
{
  borderTop: `1px solid ${accentColor}33`,
  marginTop: '8px',
  paddingTop: '8px',
}
```

---

### `getTooltipTagStyle(theme)`

Returns styling for tag/badge elements (e.g., item categories, skill types).

**Parameters**:
- `theme: Theme` - Current theme object

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<span style={getTooltipTagStyle(theme)}>
  Weapon
</span>
```

**Output Style**:
```typescript
{
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: theme.borderRadius.sm,
  background: `${theme.colors.background.tertiary}cc`,
  border: `1px solid ${theme.colors.border.default}33`,
  color: theme.colors.text.secondary,
  fontSize: '10px',
  lineHeight: 1.2,
}
```

---

### `getTooltipStatusStyle(theme, tone)`

Returns styling for status indicators (success/danger/warning/default).

**Parameters**:
- `theme: Theme` - Current theme object
- `tone: 'default' | 'success' | 'danger' | 'warning'` - Status tone

**Returns**: `React.CSSProperties`

**Example**:
```typescript
<div style={getTooltipStatusStyle(theme, 'danger')}>
  Requires level 50 Attack
</div>

<div style={getTooltipStatusStyle(theme, 'success')}>
  Currently equipped
</div>
```

**Output Style** (varies by tone):
```typescript
{
  marginTop: '8px',
  padding: '5px 8px',
  borderRadius: theme.borderRadius.sm,
  background: colors.background,  // Tone-specific
  border: `1px solid ${colors.border}`,  // Tone-specific
  color: colors.text,  // Tone-specific
  fontSize: '10px',
  lineHeight: 1.3,
  textAlign: 'center',
  fontWeight: 600,
}
```

**Tone Colors**:
- `success`: Green background/border/text
- `danger`: Red background/border/text
- `warning`: Yellow/orange background/border/text
- `default`: Accent color background/border/text

---

## Usage Patterns

### Basic Tooltip

```typescript
import { CursorTooltip } from '@/ui';
import { getTooltipTitleStyle, getTooltipMetaStyle } from '@/ui/core/tooltip/tooltipStyles';

const [hoverState, setHoverState] = useState<{ x: number; y: number } | null>(null);

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
    style={{ zIndex: theme.zIndex.tooltip }}
  >
    <div style={getTooltipTitleStyle(theme)}>
      Item Name
    </div>
    <div style={{ ...getTooltipMetaStyle(theme), marginTop: '4px' }}>
      Click to use
    </div>
  </CursorTooltip>
)}
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
      Attack: <span style={{ fontWeight: 600 }}>+{attack}</span>
    </div>
    <div style={getTooltipBodyStyle(theme)}>
      Defense: <span style={{ fontWeight: 600 }}>+{defense}</span>
    </div>
  </div>
  
  {!meetsRequirements && (
    <div style={getTooltipStatusStyle(theme, 'danger')}>
      Requires level {requiredLevel} Attack
    </div>
  )}
</CursorTooltip>
```

### Spell Tooltip with Rune Cost

```typescript
<CursorTooltip visible={true} position={hoverState}>
  <div style={getTooltipTitleStyle(theme)}>
    {spellName}
  </div>
  <div style={getTooltipMetaStyle(theme)}>
    Level {level} Magic
  </div>
  
  <div style={getTooltipBodyStyle(theme)}>
    Max Hit: {maxHit} • XP: {xp}
  </div>
  
  <div style={getTooltipDividerStyle(theme)}>
    <div style={{ ...getTooltipMetaStyle(theme), marginBottom: 4 }}>
      Rune Cost
    </div>
    {runes.map(rune => (
      <span key={rune.id} style={getTooltipTagStyle(theme)}>
        {rune.quantity}x {rune.name}
      </span>
    ))}
  </div>
  
  {isSelected && (
    <div style={getTooltipStatusStyle(theme, 'success')}>
      Currently Selected for Autocast
    </div>
  )}
</CursorTooltip>
```

---

## Panels Using Tooltip System

The following panels have been updated to use the centralized tooltip system:

1. **InventoryPanel** - Item tooltips with bonuses and descriptions
2. **EquipmentPanel** - Equipment slot tooltips with stats and requirements
3. **BankPanel** - Bank item tooltips with tab info and value
4. **SpellsPanel** - Spell tooltips with rune costs and effects
5. **PrayerPanel** - Prayer tooltips with drain rates and requirements
6. **SkillsPanel** - Skill tooltips with XP progress and level info
7. **TradePanel** - Trade item tooltips with quantities
8. **StorePanel** - Store item tooltips with prices and stock
9. **LootWindowPanel** - Loot item tooltips with item types
10. **ActionBarPanel** - Action bar slot tooltips with shortcuts
11. **DuelPanel** - Duel stake tooltips with item info

---

## Migration Guide

### Before (Duplicated Styles)

```typescript
// Old approach - duplicated across multiple files
<div
  style={{
    color: theme.colors.accent.secondary,
    fontWeight: 'bold',
    fontSize: '13px',
    marginBottom: '6px',
  }}
>
  {itemName}
</div>
<div
  style={{
    fontSize: '11px',
    color: theme.colors.text.muted,
  }}
>
  {itemType}
</div>
```

### After (Centralized Utilities)

```typescript
// New approach - consistent across all panels
import { getTooltipTitleStyle, getTooltipMetaStyle } from '@/ui/core/tooltip/tooltipStyles';

<div style={getTooltipTitleStyle(theme)}>
  {itemName}
</div>
<div style={getTooltipMetaStyle(theme)}>
  {itemType}
</div>
```

---

## Design Principles

1. **Consistency**: All tooltips use the same visual hierarchy
2. **Theming**: Styles adapt to current theme (Hyperscape, Dark, Light)
3. **Accessibility**: Clear text hierarchy with appropriate contrast ratios
4. **Performance**: Styles are computed once per render, not per tooltip instance
5. **Maintainability**: Single source of truth for tooltip styling

---

## Future Enhancements

Potential improvements for the tooltip system:

- **Tooltip Animations**: Add fade-in/fade-out transitions
- **Tooltip Positioning**: Smart positioning to avoid screen edges
- **Tooltip Delays**: Configurable hover delay before showing tooltip
- **Tooltip Themes**: Additional theme variants for different contexts
- **Tooltip Icons**: Built-in support for icons in tooltips

---

## Related Files

- `packages/client/src/ui/core/tooltip/tooltipStyles.ts` - Core tooltip style utilities
- `packages/client/src/ui/core/tooltip/CursorTooltip.tsx` - Tooltip component
- `packages/client/src/ui/core/tooltip/useTooltipPosition.ts` - Tooltip positioning hook
- `packages/client/src/ui/stores/themeStore.ts` - Theme management

---

## Testing

Tooltip styles are tested indirectly through panel component tests:

- `packages/client/tests/unit/InventoryPanel/InventoryPanel.test.tsx`
- `packages/client/tests/unit/EquipmentPanel.test.tsx`
- `packages/client/tests/unit/BankPanel/BankPanel.test.tsx`
- `packages/client/tests/unit/PrayerPanel/PrayerPanel.test.tsx`

Visual regression tests verify tooltip appearance across all panels in E2E tests.
