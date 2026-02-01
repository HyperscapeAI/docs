# Changelog

All notable changes to Hyperscape are documented in this file.

## [Unreleased]

### Added - Production Skills (2026-01-30 to 2026-02-01)

#### Crafting Skill (PR #698)
- **CraftingSystem**: Leather armor, jewelry, and gem cutting
  - Tick-based processing (3 ticks default)
  - Thread consumable with 5 uses
  - Station support (none, furnace)
  - Category grouping (leather, studded, dragonhide, jewelry, gem_cutting)
  - Movement/combat cancellation
  - 28 crafting recipes
- **CraftingPanel**: Client UI for recipe selection
  - Category tabs
  - Material count display
  - Level requirement indicators
  - Quantity selection (1, 5, 10, All)
- **TanningSystem**: Instant hide → leather conversion at tanner NPCs
  - Costs coins per hide
  - No level requirement
  - 6 tanning recipes
- **TanningPanel**: Client UI for tanning
- **Database**: Migration 0029 (craftingLevel, craftingXp columns)
- **Manifest**: `recipes/crafting.json`, `recipes/tanning.json`

#### Fletching Skill (PR #699)
- **FletchingSystem**: Bows, arrows, and arrow shafts
  - Tick-based processing (2-3 ticks)
  - Multi-output support (15 arrow shafts per log, 15 arrows per set)
  - Item-on-item interactions (bowstring + unstrung bow, arrowtips + headless arrows)
  - Category grouping (arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows)
  - Movement/combat cancellation
  - 37 fletching recipes
- **FletchingPanel**: Client UI for recipe selection
  - Category tabs
  - Output quantity display (for multi-output recipes)
  - Material count display
  - Quantity selection (1, 5, 10, All)
- **Database**: Migration 0030 (fletchingLevel, fletchingXp columns)
- **Manifest**: `recipes/fletching.json`
- **Tests**: 19 unit tests covering lifecycle, multi-output, cancellation

#### Runecrafting Skill (PR #703)
- **RunecraftingSystem**: Essence → runes at altars
  - Instant processing (no tick delay)
  - Multi-rune multiplier at higher levels (up to 10x at level 99)
  - Converts ALL essence in inventory at once
  - Two essence types: rune_essence (basic runes), pure_essence (all runes)
  - 12 runecrafting recipes (air, water, earth, fire, mind, body, cosmic, chaos, nature, law, death, blood)
- **RunecraftingAltarEntity**: Interactable altar entity
  - Per-rune-type color palettes (air=white, water=blue, fire=red, etc.)
  - Mystical particle effects (4 layers: pillar, wisps, sparks, base)
  - Mesh-aware particle placement (spawns from actual model geometry)
  - Collision footprint (2x2 tiles default)
  - Context menu (Craft-rune, Examine)
- **Database**: Migration 0031 (runecraftingLevel, runecraftingXp columns)
- **Manifest**: `recipes/runecrafting.json`
- **Tests**: Unit tests covering crafting, levels, essence validation, multipliers, skill caching

#### ProcessingDataProvider Enhancements
- **Crafting Support**: Load and validate crafting recipes from manifest
  - `getCraftingRecipe()`, `getCraftingRecipesByCategory()`, `getCraftingRecipesByStation()`
  - `getCraftingInputsForTool()`, `isCraftingInput()`, `getCraftingToolForInput()`
- **Fletching Support**: Load and validate fletching recipes from manifest
  - `getFletchingRecipe()`, `getFletchingRecipesForInput()`, `getFletchingRecipesForInputPair()`
  - `getFletchingInputsForTool()`, `isFletchingInput()`, `getFletchingToolForInput()`
  - Multi-output recipe support
- **Runecrafting Support**: Load and validate runecrafting recipes from manifest
  - `getRunecraftingRecipe()`, `getRunecraftingMultiplier()`, `isRunecraftingEssence()`
  - Multi-rune multiplier calculation
- **Tanning Support**: Load and validate tanning recipes from manifest
  - `getTanningRecipe()`, `isTannableItem()`, `getAllTanningRecipes()`
- **Validation**: Comprehensive recipe validation with detailed error reporting
- **Performance**: Pre-allocated buffers for inventory counting (avoids allocations)

#### Smithing Enhancements (PR #698)
- **Multi-Output Support**: `outputQuantity` field for recipes
  - Arrowtips produce 15 per bar (OSRS-accurate)
  - 6 arrowtip recipes added (bronze, iron, steel, mithril, adamant, rune)
- **SmithingPanel**: Display output quantity for multi-output recipes

### Added - UI Features (2026-02-01)

#### Skill Guide Panel (PR #711)
- **SkillGuidePanel**: OSRS-style skill unlock viewer
  - Click any skill icon in skills panel to open
  - Shows all unlocks for that skill at each level
  - Visual indicators: ✓ unlocked, ➤ next unlock, 🔒 locked
  - Displays levels to next unlock
  - Type badges (item, ability, location, etc.)
  - Progress indicator (X/Y unlocked)
- **Client-Side Data Loading**: Loads unlock data from `skill-unlocks.ts` manifest
- **Network Wiring**: Click handler on skill icons, modal state management

### Fixed - Visual and Gameplay (2026-01-30 to 2026-02-01)

#### Mining Rock Materials (PR #710)
- **PBR Material Fix**: Force metalness=0 on mining rock materials
  - Prevents overly shiny/metallic appearance
  - OSRS-accurate stone texture look
- **Model Alignment**: Align depleted rock models to ground
  - Prevents floating rocks after depletion
  - Consistent visual appearance

#### Fishing Spot Spawning (PR #712)
- **Water Threshold Fix**: Align water threshold to 9.0m
  - Fishing spots now spawn at shoreline instead of underwater
  - Matches terrain water level constant
  - Fixes underwater fishing spot bug

#### Equipment System (PR #697)
- **Idempotency Checks**: Prevent duplicate equip/unequip requests
  - Server validates equipment state before processing
  - Prevents race conditions from rapid clicking
  - Ensures consistent equipment state

### Changed - Architecture (2026-01-30 to 2026-01-31)

#### Processing System Refactoring
- **Unified Cancellation**: All processing systems cancel on movement/combat
  - Crafting, smelting, cooking, fletching all cancel on `MOVEMENT_CLICK_TO_MOVE`
  - All systems cancel on `COMBAT_STARTED` event
  - OSRS-accurate behavior (any action interrupts skilling)
- **Rate Limiting**: Added rate limiting to crafting interact
  - Prevents spam clicking
  - Server-side validation
- **Audit Logging**: Structured audit logs for all processing completions
  - Economic tracking
  - Debugging support
  - Format: `{ playerId, recipeId, output, inputsConsumed, xpAwarded, crafted, batchTotal }`

#### Type Safety Improvements
- **Typed Payloads**: Strengthen type safety with typed event payloads
  - Replace generic event data with specific payload types
  - Fix falsy level checks (0 is valid level)
  - Remove dead code
- **Skill Fallbacks**: Consistent skill fallbacks in PlayerEntity
  - All skills default to level 1, XP 0 if missing
  - Prevents undefined skill errors

#### Performance Optimizations
- **Inventory Scan Consolidation**: Eliminate per-tick allocations in crafting update loop
  - Pre-allocated arrays for completed session tracking
  - Reusable Maps for inventory counting
  - Batch processing (collect, then process)
- **Skill Caching**: Cache player skill levels to avoid repeated lookups
  - Map-based cache updated on SKILLS_UPDATED events
  - Fallback to entity lookup if cache miss
  - Memory cleanup on player disconnect

### Documentation

#### New Documentation Files
- **SKILLS.md**: Comprehensive skills system guide
  - All 17 skills documented
  - Production skill mechanics
  - ProcessingDataProvider API
  - System architecture
  - Event flow diagrams
  - Testing guidelines
- **API-REFERENCE.md**: Detailed API reference
  - SkillsSystem methods
  - ProcessingDataProvider methods
  - CraftingSystem, FletchingSystem, RunecraftingSystem
  - RunecraftingAltarEntity
  - Event types and payloads
  - Usage examples
- **DATABASE-MIGRATIONS.md**: Migration guide
  - Recent migrations (0029, 0030, 0031)
  - Complete skill schema
  - Migration best practices
  - Rollback procedures
  - Drizzle Kit commands
- **RECIPE-MANIFESTS.md**: Recipe manifest format guide
  - All manifest formats documented
  - Validation rules
  - Multi-output recipes
  - Consumables with limited uses
  - Item-on-item interactions
  - Debugging recipes

#### Updated Documentation Files
- **README.md**: Updated skills list, features table
- **CLAUDE.md**: Added skills system section, processing systems, new entity types

## Migration Guide

### From Pre-Crafting/Fletching/Runecrafting

If you have an existing Hyperscape installation from before 2026-01-30:

1. **Pull Latest Code**:
   ```bash
   git pull origin main
   bun install
   bun run build
   ```

2. **Run Migrations** (automatic on server start):
   ```bash
   bun run dev
   ```
   
   Migrations 0029, 0030, 0031 will run automatically, adding:
   - craftingLevel, craftingXp
   - fletchingLevel, fletchingXp
   - runecraftingLevel, runecraftingXp

3. **Verify Skills**:
   - Log in to existing character
   - Open skills panel
   - Verify crafting, fletching, runecrafting show level 1

4. **No Data Loss**: All existing characters, inventory, and progress are preserved.

### Breaking Changes

**None**. All changes are additive.

### Deprecations

**None**.

## Known Issues

### Resolved

- ✅ Fishing spots spawning underwater (fixed in PR #712)
- ✅ Mining rocks appearing metallic (fixed in PR #710)
- ✅ Duplicate equip/unequip requests (fixed in PR #697)
- ✅ Thread not being consumed in crafting (fixed in PR #698)
- ✅ Fletching producing wrong quantity (fixed in PR #699)
- ✅ Runecrafting multi-rune multiplier not working (fixed in PR #703)

## Performance Improvements

### Memory Optimizations (PR #698, #699, #703)
- Pre-allocated buffers for inventory counting (ProcessingDataProvider)
- Reusable arrays for tick processing (all processing systems)
- Skill level caching (all processing systems)
- Reduced allocations in hot paths (update loops)

### Tick Processing Optimizations
- Once-per-tick processing guard (prevents duplicate processing)
- Batch completion checks (collect, then process)
- Early exits for empty sessions

**Benchmark Results** (from tests):
- Crafting system: < 1ms per tick for 100 active sessions
- Fletching system: < 1ms per tick for 100 active sessions
- ProcessingDataProvider: < 0.1ms for recipe lookups

## Contributors

- @dreaminglucid - All recent features and fixes

## See Also

- [SKILLS.md](SKILLS.md) - Skills system overview
- [API-REFERENCE.md](API-REFERENCE.md) - API documentation
- [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) - Migration guide
- [RECIPE-MANIFESTS.md](RECIPE-MANIFESTS.md) - Recipe format guide
