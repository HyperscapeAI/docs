# Migration Guide: Artisan Skills Update

Guide for updating existing Hyperscape installations to support the new artisan skills (Crafting, Fletching, Runecrafting).

## Overview

This update adds three new artisan skills to Hyperscape:
- **Crafting**: Create leather armor, dragonhide equipment, jewelry, and cut gems
- **Fletching**: Create bows and arrows
- **Runecrafting**: Convert essence into runes at altars

## Database Migrations

Three new migrations add skill columns to the `characters` table:

### Migration 0029: Crafting Skill

```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingXp" integer DEFAULT 0;
```

### Migration 0030: Fletching Skill

```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "fletchingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "fletchingXp" integer DEFAULT 0;
```

### Migration 0031: Runecrafting Skill

```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "runecraftingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "runecraftingXp" integer DEFAULT 0;
```

## Automatic Migration

Migrations run automatically on server startup. No manual intervention required.

**To verify migrations:**

```bash
# Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape

# Check migration version
SELECT * FROM config WHERE key = 'version';
# Should show version 31 or higher

# Verify columns exist
\d characters
# Should show craftingLevel, craftingXp, fletchingLevel, fletchingXp, runecraftingLevel, runecraftingXp
```

## Manual Migration (if needed)

If automatic migration fails, run manually:

```bash
cd packages/server

# Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape

# Run migrations manually
\i src/database/migrations/0029_add_crafting_skill.sql
\i src/database/migrations/0030_add_fletching_skill.sql
\i src/database/migrations/0031_add_runecrafting_skill.sql

# Update version
UPDATE config SET value = '31' WHERE key = 'version';
```

## Code Changes

### SkillsSystem Updates

The SkillsSystem now includes three new skills:

```typescript
export const Skill = {
  // ... existing skills ...
  CRAFTING: "crafting" as keyof Skills,
  FLETCHING: "fletching" as keyof Skills,
  RUNECRAFTING: "runecrafting" as keyof Skills,
};
```

**Updated Methods:**
- `getTotalLevel()`: Now includes crafting, fletching, runecrafting
- `getTotalXP()`: Now includes crafting, fletching, runecrafting
- `getSkills()`: Returns all 17 skills

### New Systems

Three new systems added to `packages/shared/src/systems/shared/interaction/`:

1. **CraftingSystem.ts**: Tick-based crafting with thread consumption
2. **FletchingSystem.ts**: Tick-based fletching with multi-output support
3. **RunecraftingSystem.ts**: Instant essence-to-rune conversion

### ProcessingDataProvider Updates

Extended to support new recipe types:

**New Methods:**
- `getCraftingRecipe(outputItemId)`
- `getCraftingRecipesByStation(station)`
- `getFletchingRecipe(recipeId)`
- `getFletchingRecipesForInput(itemId)`
- `getFletchingRecipesForInputPair(itemA, itemB)`
- `getRunecraftingRecipe(runeType)`
- `getRunecraftingMultiplier(runeType, level)`
- `getTanningRecipe(inputItemId)`

**New Recipe Manifests:**
- `recipes/crafting.json`: 30+ crafting recipes
- `recipes/tanning.json`: 5 tanning recipes
- `recipes/fletching.json`: 37 fletching recipes
- `recipes/runecrafting.json`: 11 runecrafting recipes

## New Entities

### RunecraftingAltarEntity

New entity type for runecrafting altars:

**Location:** `packages/shared/src/entities/world/RunecraftingAltarEntity.ts`

**Features:**
- Interactable altar entity
- Stores rune type (air, mind, water, etc.)
- Triggers instant essence-to-rune conversion
- Visual model with glow effect

**Spawning:**
```typescript
const altar = new RunecraftingAltarEntity(world, {
  id: "air_altar_1",
  name: "Air Altar",
  position: { x: 100, y: 0, z: 100 },
  runeType: "air",
  model: "altar.glb",
  modelScale: 1.0,
});
```

## Client UI Updates

### New Panels

Three new UI panels added to `packages/client/src/game/panels/`:

1. **CraftingPanel.tsx**: Crafting interface with category grouping
2. **TanningPanel.tsx**: Tanning interface with hide selection
3. **FletchingPanel.tsx**: Fletching interface with category grouping

**Features:**
- Category-based recipe grouping
- Output quantity display (for multi-output recipes)
- Make-X quantity selection (1, 5, 10, All, custom)
- Level requirement indicators
- Material availability checks
- Desktop and mobile responsive layouts

### Skills Panel Updates

The skills panel now displays 17 skills (was 14):

**New Skills:**
- Crafting (icon: needle)
- Fletching (icon: bow)
- Runecrafting (icon: altar)

## Network Protocol Updates

### New Packet Types

Added to `packages/shared/src/platform/shared/packets.ts`:

**Crafting:**
- `craftingInteract`: Trigger crafting interaction
- `craftingRequest`: Request crafting with quantity
- `craftingInterfaceOpen`: Server sends available recipes
- `craftingStart`: Crafting session started
- `craftingComplete`: Crafting session completed

**Fletching:**
- `fletchingInteract`: Trigger fletching interaction
- `fletchingRequest`: Request fletching with quantity
- `fletchingInterfaceOpen`: Server sends available recipes
- `fletchingStart`: Fletching session started
- `fletchingComplete`: Fletching session completed

**Tanning:**
- `tanningInteract`: Trigger tanning interaction
- `tanningRequest`: Request tanning with quantity
- `tanningInterfaceOpen`: Server sends available recipes
- `tanningComplete`: Tanning completed

**Runecrafting:**
- `runecraftingInteract`: Trigger runecrafting interaction
- `runecraftingComplete`: Runecrafting completed

## Backwards Compatibility

### Existing Characters

Existing characters automatically receive the new skills at level 1 with 0 XP:

- `craftingLevel = 1`, `craftingXp = 0`
- `fletchingLevel = 1`, `fletchingXp = 0`
- `runecraftingLevel = 1`, `runecraftingXp = 0`

No data loss or character reset required.

### Existing Items

All existing items remain functional. New items added:

**Crafting Materials:**
- Thread, needle, chisel, moulds (ring, necklace, amulet, bracelet)
- Leather, dragonhide (green, blue, red, black)
- Uncut gems (sapphire, emerald, ruby, diamond)

**Fletching Materials:**
- Knife, bowstring, feathers
- Arrow shafts, headless arrows, arrowtips
- Unstrung bows (shortbow, longbow variants)

**Runecrafting Materials:**
- Rune essence, pure essence
- Runes (air, mind, water, earth, fire, body, cosmic, chaos, nature, law, death)

## Testing

### Verify Installation

1. **Check database schema:**
```bash
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
\d characters
# Should show craftingLevel, fletchingLevel, runecraftingLevel columns
```

2. **Check recipe manifests:**
```bash
ls packages/server/world/assets/manifests/recipes/
# Should show: crafting.json, fletching.json, runecrafting.json, tanning.json
```

3. **Test in-game:**
- Create new character
- Check skills panel shows 17 skills
- Try crafting: Use needle on leather
- Try fletching: Use knife on logs
- Try runecrafting: Click on air altar with rune essence

### Common Issues

**Recipes not loading:**
- Check manifest files exist
- Verify JSON syntax is valid
- Check server logs for validation errors
- Restart server

**Skills not persisting:**
- Verify migrations ran successfully
- Check database columns exist
- Verify auto-save is working (5s interval)

**UI panels not opening:**
- Check client has latest build
- Verify network packets are registered
- Check browser console for errors

## Rollback

If you need to rollback the artisan skills update:

### Database Rollback

```sql
-- Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape

-- Remove skill columns
ALTER TABLE characters DROP COLUMN IF EXISTS craftingLevel;
ALTER TABLE characters DROP COLUMN IF EXISTS craftingXp;
ALTER TABLE characters DROP COLUMN IF EXISTS fletchingLevel;
ALTER TABLE characters DROP COLUMN IF EXISTS fletchingXp;
ALTER TABLE characters DROP COLUMN IF EXISTS runecraftingLevel;
ALTER TABLE characters DROP COLUMN IF EXISTS runecraftingXp;

-- Update version
UPDATE config SET value = '28' WHERE key = 'version';
```

### Code Rollback

```bash
# Checkout previous commit before artisan skills
git checkout <commit-before-artisan-skills>

# Rebuild
bun run build

# Restart server
bun run dev
```

**Warning:** Rolling back will delete all crafting/fletching/runecrafting progress for all characters.

## Performance Impact

### Memory Usage

- **CraftingSystem**: ~1KB per active session
- **FletchingSystem**: ~1KB per active session
- **RunecraftingSystem**: No active sessions (instant)
- **ProcessingDataProvider**: ~50KB for all recipe data

### CPU Usage

- **Crafting**: Processes once per tick (600ms) per active session
- **Fletching**: Processes once per tick (600ms) per active session
- **Runecrafting**: Instant (no tick processing)

### Database Impact

- **New Columns**: 6 integer columns per character (~24 bytes)
- **Auto-Save**: Skills saved every 5 seconds (existing behavior)
- **No Additional Queries**: Skills saved with existing character save

## Support

For issues with the artisan skills update:

1. Check this migration guide
2. Review [ARTISAN-SKILLS.md](ARTISAN-SKILLS.md) for usage
3. Check server logs for errors
4. Report bugs in GitHub Issues

## Changelog

### Added

- **Crafting Skill**: 30+ recipes for leather, dragonhide, jewelry, gems
- **Fletching Skill**: 37 recipes for bows and arrows
- **Runecrafting Skill**: 11 rune types with multi-rune multipliers
- **Tanning System**: Instant hide-to-leather conversion
- **ProcessingDataProvider**: Recipe loading and lookup for all artisan skills
- **CraftingPanel**: UI for crafting interactions
- **FletchingPanel**: UI for fletching interactions
- **TanningPanel**: UI for tanning interactions
- **RunecraftingAltarEntity**: Interactable altar entity

### Changed

- **SkillsSystem**: Now supports 17 skills (was 14)
- **Skills Panel**: Displays all 17 skills
- **Database Schema**: Added 6 new skill columns
- **Total Level Calculation**: Includes crafting, fletching, runecrafting

### Fixed

- **Mining Rocks**: Force metalness=0 on PBR materials for correct stone appearance
- **Depleted Rocks**: Align to ground using bounding box
- **Headstone**: Replaced placeholder box with headstone.glb model

## Version History

- **v1.0.0** (2026-01-31): Initial artisan skills release
  - Crafting skill with 30+ recipes
  - Fletching skill with 37 recipes
  - Runecrafting skill with 11 rune types
  - Tanning system
  - Database migrations 0029-0031
