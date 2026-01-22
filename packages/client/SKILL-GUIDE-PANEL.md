# Skill Guide Panel

OSRS-style skill guide interface showing unlocks at each level.

## Overview

The Skill Guide Panel is a popup interface that displays all unlockable content for each skill. Players can click any skill in the Skills Panel to view what they can unlock at each level, with visual indicators for achieved vs. future unlocks.

## Features

- **Click-to-open**: Click any skill in the Skills Panel to open its guide
- **Level progression**: Shows all unlocks with level requirements
- **Visual states**: 
  - ✓ Green checkmark for unlocked content (achieved)
  - 🔒 Lock icon for locked content (future)
  - ➤ Arrow for next unlock (highlighted)
- **Progress tracking**: Shows "X of Y unlocked" count
- **Next unlock indicator**: Highlights the next unlock you're working toward
- **Scrollable**: Handles skills with many unlocks (Prayer has 29!)
- **Type badges**: Visual indicators for item vs. ability unlocks
- **Smooth animations**: Fade-in and slide-up effects
- **Keyboard support**: ESC key to close
- **Click-outside-to-close**: Intuitive UX

## Usage

### Opening the Guide

1. Open the Skills Panel (🧠 icon in sidebar)
2. Click on any skill icon
3. The Skill Guide Panel opens showing that skill's unlocks

### Understanding the Display

```
┌─────────────────────────────────────┐
│ [Icon] Skill Name Guide        [X] │  ← Header with skill icon
├─────────────────────────────────────┤
│ Your Level: 45                      │  ← Current level
│ 6/10 unlocked                       │  ← Progress indicator
├─────────────────────────────────────┤
│ ➤ 5 more levels to unlock: Dragon  │  ← Next unlock info
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ✓ Lvl 1   Bronze weapons  [item]│ │  ← Unlocked (green)
│ │ ✓ Lvl 5   Steel weapons   [item]│ │
│ │ ✓ Lvl 40  Rune weapons    [item]│ │
│ │ ➤ Lvl 50  Dragon weapons  [item]│ │  ← Next (highlighted)
│ │ 🔒 Lvl 60 Barrows gear    [item]│ │  ← Locked (dimmed)
│ │ 🔒 Lvl 70 Abyssal whip   [item]│ │
│ └─────────────────────────────────┘ │  ← Scrollable list
└─────────────────────────────────────┘
```

### Closing the Guide

- Click the **X** button in the header
- Press **ESC** key
- Click anywhere outside the panel

## Technical Implementation

### Components

**SkillGuidePanel.tsx** (`packages/client/src/game/panels/SkillGuidePanel.tsx`)
- Main panel component
- Portal rendering for proper z-index layering
- Handles keyboard events and click-outside-to-close
- Fetches unlock data from server API

**UnlockRow** (internal component)
- Individual unlock row display
- Visual state management (unlocked/next/locked)
- Type badge rendering

### Data Flow

```
User clicks skill
     ↓
SkillsPanel.handleSkillClick()
     ↓
Opens SkillGuidePanel with skill data
     ↓
Panel fetches unlocks from /api/data/skill-unlocks
     ↓
Displays sorted unlocks with visual states
```

### API Integration

**Endpoint:** `GET /api/data/skill-unlocks`

**Response:**
```json
{
  "attack": [
    {
      "level": 1,
      "description": "Bronze weapons, Iron weapons",
      "type": "item"
    },
    {
      "level": 40,
      "description": "Rune weapons",
      "type": "item"
    }
  ],
  "woodcutting": [
    {
      "level": 1,
      "description": "Normal trees",
      "type": "item"
    }
  ]
}
```

**Data Source:** `packages/server/world/assets/manifests/skill-unlocks.json`

### State Management

**SkillsPanel.tsx** manages:
- `selectedSkill` - Currently selected skill
- `isGuideOpen` - Panel visibility state
- `skillUnlocks` - Fetched unlock data
- `isLoadingUnlocks` - Loading state during fetch

**Loading States:**
1. **Loading**: Shows spinner while fetching data
2. **Empty**: Shows "No unlock data available" if skill has no unlocks
3. **Data**: Displays unlock list with visual states

### Styling

**Color Palette:**
```css
Primary Gold:     #c9b386
Bright Yellow:    #ffff00 (level numbers)
Gold Accent:      #fbbf24
Dark Brown BG:    rgba(20, 15, 10, 0.98)
Border Brown:     rgba(139, 69, 19, 0.8)
Unlocked Green:   #22c55e
Next Gold:        #fbbf24
Locked Gray:      #6b7280
```

**Animations:**
- Backdrop: `fadeIn 0.15s ease-out`
- Panel: `slideUp 0.2s ease-out`
- Spinner: `spin 0.8s linear infinite`

## Skills with Unlocks

| Skill | Unlock Count | Level Range | Notable Unlocks |
|-------|--------------|-------------|-----------------|
| Attack | 9 | 1-75 | Bronze → Dragon weapons |
| Strength | 2 | 1-99 | Damage bonuses |
| Defence | 10 | 1-70 | Bronze → Dragon armor |
| Constitution | 2 | 10-99 | Health increases |
| Prayer | 29 | 1-77 | Protection prayers, stat boosts |
| Woodcutting | 9 | 1-90 | Normal → Redwood trees |
| Mining | 8 | 1-85 | Copper → Runite ore |
| Fishing | 10 | 1-76 | Shrimp → Shark |
| Cooking | 10 | 1-80 | Shrimp → Manta ray |
| Firemaking | 9 | 1-90 | Normal → Redwood logs |
| Smithing | 8 | 1-85 | Bronze → Rune bars |
| Agility | 6 | 1-99 | Agility courses |

## Unlock Types

**item** - Equipment, resources, or craftable items
- Examples: "Bronze weapons", "Rune armor", "Shark"
- Badge color: Blue (`#93c5fd`)

**ability** - Passive bonuses, prayers, or unlocked actions
- Examples: "Protect from Melee", "Ultimate Strength"
- Badge color: Purple (`#c4b5fd`)

**area** - New locations or zones
- Examples: "Wilderness access", "Agility course"
- Badge color: Green

**quest** - Quest requirements or unlocks
- Examples: "Dragon Slayer quest"
- Badge color: Yellow

**activity** - New activities or minigames
- Examples: "Barbarian Fishing"
- Badge color: Orange

## Development

### Adding New Unlocks

Edit `packages/server/world/assets/manifests/skill-unlocks.json`:

```json
{
  "skills": {
    "skillName": [
      {
        "level": 50,
        "description": "New unlock description",
        "type": "item"
      }
    ]
  }
}
```

**Important:** Use British spelling "defence" in JSON (OSRS accuracy). The code automatically normalizes to American "defense" for UI compatibility.

### Testing

**Manual Testing Checklist:**
- [ ] Click on each skill opens correct guide
- [ ] Correct unlocks shown for each skill
- [ ] Player's current level displayed correctly
- [ ] Unlocked items show green checkmark
- [ ] Locked items show lock icon and dimmed
- [ ] Next unlock is highlighted
- [ ] Scroll works for skills with many unlocks (Prayer)
- [ ] Click outside closes panel
- [ ] ESC key closes panel
- [ ] X button closes panel
- [ ] Loading state shows spinner
- [ ] Empty state shows appropriate message
- [ ] Panel doesn't interfere with other UI elements
- [ ] Works on different screen sizes

**Automated Testing:**
```bash
# Run Playwright tests for Skill Guide Panel
bun test packages/client/tests/e2e/skill-guide-panel.spec.ts
```

### Customization

**Panel Width:**
Adjust in `SkillGuidePanel.tsx`:
```typescript
width: "400px",  // Default
// or
width: "min(440px, 90vw)",  // Responsive
```

**Animation Speed:**
```css
animation: slideUp 0.2s ease-out;  // Default
animation: slideUp 0.3s ease-out;  // Slower
```

**Colors:**
Modify inline styles in `SkillGuidePanel.tsx` to match your theme.

## Troubleshooting

### Panel Not Opening

**Issue:** Clicking skill does nothing

**Solutions:**
1. Check browser console for errors
2. Verify `handleSkillClick` is wired up in SkillsPanel
3. Ensure `onClick` prop is passed to SkillBox component

### No Unlocks Showing

**Issue:** Panel shows "No unlock data available"

**Solutions:**
1. Check that `/api/data/skill-unlocks` endpoint is working
2. Verify manifests are loaded on server
3. Check browser network tab for failed requests
4. Ensure skill key matches between UI and manifest (e.g., "defense" vs "defence")

### Loading Forever

**Issue:** Spinner shows indefinitely

**Solutions:**
1. Check server is running and accessible
2. Verify `PUBLIC_API_URL` is set correctly in client `.env`
3. Check CORS configuration allows client domain
4. Review browser console for network errors

### Styling Issues

**Issue:** Panel looks broken or misaligned

**Solutions:**
1. Clear browser cache
2. Check for CSS conflicts with other panels
3. Verify z-index is high enough (should be 9999)
4. Test in different browsers

## Future Enhancements

Potential improvements for future versions:

1. **Search/Filter** - Filter unlocks by type or search by name
2. **Goal Setting** - Mark specific unlocks as goals
3. **XP Calculator** - Show XP needed to reach specific levels
4. **Training Tips** - Add tips for how to train each skill
5. **Sub-categories** - Group unlocks by type (weapons, armor, etc.)
6. **Comparison View** - Compare unlocks across multiple skills
7. **Achievement Tracking** - Track when unlocks were achieved
8. **Sharing** - Share progress with other players

## References

- [OSRS Wiki - Skills](https://oldschool.runescape.wiki/w/Skills)
- [OSRS Wiki - Interface](https://oldschool.runescape.wiki/w/Interface)
- Implementation PR: #601
- Planning Document: `SKILL_GUIDE_PANEL_PLAN.md` (archived)

## License

MIT - See LICENSE file
