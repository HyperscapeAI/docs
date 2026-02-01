# Recipe Manifest Documentation

This guide documents the JSON recipe manifest format for all processing skills in Hyperscape.

## Overview

Recipe manifests are JSON files that define crafting recipes, cooking data, smelting formulas, and other processing skill data. They enable content creators to add new recipes without modifying code.

**Location**: `packages/server/world/assets/manifests/recipes/`

**Loaded By**: `DataManager` → `ProcessingDataProvider`

**Validation**: All recipes are validated on load with detailed error reporting.

## Manifest Files

| File | Skill | Purpose |
|------|-------|---------|
| `cooking.json` | Cooking | Raw food → cooked/burnt food |
| `firemaking.json` | Firemaking | Logs → fires |
| `smelting.json` | Smithing | Ores → bars |
| `smithing.json` | Smithing | Bars → weapons/armor/tools |
| `crafting.json` | Crafting | Materials → leather/jewelry/gems |
| `fletching.json` | Fletching | Logs/materials → bows/arrows |
| `runecrafting.json` | Runecrafting | Essence → runes |
| `tanning.json` | Crafting | Hides → leather (instant, costs coins) |

## Cooking Manifest

**File**: `recipes/cooking.json`

**Format**:
```json
{
  "recipes": [
    {
      "raw": "raw_shrimp",
      "cooked": "shrimp",
      "burnt": "burnt_shrimp",
      "level": 1,
      "xp": 30,
      "ticks": 4,
      "stopBurnLevel": {
        "fire": 35,
        "range": 32
      }
    }
  ]
}
```

**Fields**:
- `raw` (string, required): Raw food item ID
- `cooked` (string, required): Cooked food item ID
- `burnt` (string, required): Burnt food item ID
- `level` (integer, required): Cooking level required (1-99)
- `xp` (number, required): XP granted per successful cook (> 0)
- `ticks` (integer, required): Time in game ticks (600ms per tick, > 0)
- `stopBurnLevel` (object, required): Levels at which burning stops
  - `fire` (integer): Stop-burn level for fires
  - `range` (integer): Stop-burn level for ranges

**Validation**:
- All item IDs must exist in items manifest
- Level in range [1, 99]
- XP > 0, ticks > 0
- stopBurnLevel.fire and stopBurnLevel.range must be integers

**Example** (lobster):
```json
{
  "raw": "raw_lobster",
  "cooked": "lobster",
  "burnt": "burnt_lobster",
  "level": 40,
  "xp": 120,
  "ticks": 4,
  "stopBurnLevel": {
    "fire": 74,
    "range": 64
  }
}
```

## Firemaking Manifest

**File**: `recipes/firemaking.json`

**Format**:
```json
{
  "recipes": [
    {
      "log": "logs",
      "level": 1,
      "xp": 40,
      "ticks": 3
    }
  ]
}
```

**Fields**:
- `log` (string, required): Log item ID
- `level` (integer, required): Firemaking level required (1-99)
- `xp` (number, required): XP granted per fire lit (> 0)
- `ticks` (integer, required): Time in game ticks (> 0)

**Validation**:
- Log item ID must exist in items manifest
- Level in range [1, 99]
- XP > 0, ticks > 0

**Example** (willow logs):
```json
{
  "log": "willow_logs",
  "level": 30,
  "xp": 90,
  "ticks": 3
}
```

## Smelting Manifest

**File**: `recipes/smelting.json`

**Format**:
```json
{
  "recipes": [
    {
      "output": "bronze_bar",
      "inputs": [
        { "item": "copper_ore", "amount": 1 },
        { "item": "tin_ore", "amount": 1 }
      ],
      "level": 1,
      "xp": 6.25,
      "ticks": 4,
      "successRate": 1.0
    }
  ]
}
```

**Fields**:
- `output` (string, required): Bar item ID
- `inputs` (array, required): Input materials (non-empty)
  - `item` (string): Ore or coal item ID
  - `amount` (integer): Quantity required (>= 1)
- `level` (integer, required): Smithing level required (1-99)
- `xp` (number, required): XP granted per bar smelted (> 0)
- `ticks` (integer, required): Time in game ticks (> 0)
- `successRate` (number, required): Success chance (0.0-1.0)

**Validation**:
- All item IDs must exist in items manifest
- Inputs array must be non-empty
- Input amounts >= 1
- Level in range [1, 99]
- XP > 0, ticks > 0
- successRate in range [0.0, 1.0]

**Example** (iron bar):
```json
{
  "output": "iron_bar",
  "inputs": [
    { "item": "iron_ore", "amount": 1 }
  ],
  "level": 15,
  "xp": 12.5,
  "ticks": 4,
  "successRate": 0.5
}
```

**Example** (steel bar with coal):
```json
{
  "output": "steel_bar",
  "inputs": [
    { "item": "iron_ore", "amount": 1 },
    { "item": "coal", "amount": 2 }
  ],
  "level": 30,
  "xp": 17.5,
  "ticks": 4,
  "successRate": 1.0
}
```

## Smithing Manifest

**File**: `recipes/smithing.json`

**Format**:
```json
{
  "recipes": [
    {
      "output": "bronze_sword",
      "bar": "bronze_bar",
      "barsRequired": 1,
      "level": 4,
      "xp": 12.5,
      "ticks": 4,
      "category": "weapons",
      "outputQuantity": 1
    }
  ]
}
```

**Fields**:
- `output` (string, required): Output item ID
- `bar` (string, required): Bar type required
- `barsRequired` (integer, required): Number of bars needed (>= 1)
- `level` (integer, required): Smithing level required (1-99)
- `xp` (number, required): XP granted per item made (> 0)
- `ticks` (integer, required): Time in game ticks (> 0)
- `category` (string, required): Category for UI grouping
- `outputQuantity` (integer, optional): Items produced per action (default: 1)

**Categories**: weapons, armor, tools, arrowtips, nails, other

**Validation**:
- All item IDs must exist in items manifest
- barsRequired >= 1
- Level in range [1, 99]
- XP > 0, ticks > 0
- outputQuantity >= 1 (if present)
- Category must be valid

**Example** (bronze platebody):
```json
{
  "output": "bronze_platebody",
  "bar": "bronze_bar",
  "barsRequired": 5,
  "level": 18,
  "xp": 62.5,
  "ticks": 4,
  "category": "armor",
  "outputQuantity": 1
}
```

**Example** (bronze arrowtips - multi-output):
```json
{
  "output": "bronze_arrowtips",
  "bar": "bronze_bar",
  "barsRequired": 1,
  "level": 5,
  "xp": 12.5,
  "ticks": 4,
  "category": "arrowtips",
  "outputQuantity": 15
}
```

## Crafting Manifest

**File**: `recipes/crafting.json`

**Format**:
```json
{
  "recipes": [
    {
      "output": "leather_body",
      "category": "leather",
      "inputs": [
        { "item": "leather", "amount": 14 }
      ],
      "tools": ["needle"],
      "consumables": [
        { "item": "thread", "uses": 5 }
      ],
      "level": 14,
      "xp": 25,
      "ticks": 3,
      "station": "none"
    }
  ]
}
```

**Fields**:
- `output` (string, required): Output item ID
- `category` (string, required): Category for UI grouping
- `inputs` (array, required): Input materials (non-empty)
  - `item` (string): Material item ID
  - `amount` (integer): Quantity required (>= 1)
- `tools` (array, required): Tool item IDs (not consumed, can be empty)
- `consumables` (array, optional): Consumable items with limited uses
  - `item` (string): Consumable item ID
  - `uses` (integer): Uses before consumed (>= 1)
- `level` (integer, required): Crafting level required (1-99)
- `xp` (number, required): XP granted per item made (> 0)
- `ticks` (integer, required): Time in game ticks (> 0)
- `station` (string, required): Station required ("none" or "furnace")

**Categories**: leather, studded, dragonhide, jewelry, gem_cutting

**Stations**: none, furnace

**Validation**:
- All item IDs must exist in items manifest
- Inputs array must be non-empty
- Input amounts >= 1
- Tool IDs must be valid (if present)
- Consumable uses >= 1 (if present)
- Level in range [1, 99]
- XP > 0, ticks > 0
- Station must be "none" or "furnace"

**Example** (gold necklace at furnace):
```json
{
  "output": "gold_necklace",
  "category": "jewelry",
  "inputs": [
    { "item": "gold_bar", "amount": 1 }
  ],
  "tools": ["necklace_mould"],
  "consumables": [],
  "level": 6,
  "xp": 20,
  "ticks": 3,
  "station": "furnace"
}
```

**Example** (gem cutting with chisel):
```json
{
  "output": "sapphire",
  "category": "gem_cutting",
  "inputs": [
    { "item": "uncut_sapphire", "amount": 1 }
  ],
  "tools": ["chisel"],
  "consumables": [],
  "level": 20,
  "xp": 50,
  "ticks": 2,
  "station": "none"
}
```

## Fletching Manifest

**File**: `recipes/fletching.json`

**Format**:
```json
{
  "recipes": [
    {
      "output": "arrow_shaft",
      "outputQuantity": 15,
      "category": "arrow_shafts",
      "inputs": [
        { "item": "logs", "amount": 1 }
      ],
      "tools": ["knife"],
      "level": 1,
      "xp": 5,
      "ticks": 2,
      "skill": "fletching"
    }
  ]
}
```

**Fields**:
- `output` (string, required): Output item ID
- `outputQuantity` (integer, optional): Items produced per action (default: 1)
- `category` (string, required): Category for UI grouping
- `inputs` (array, required): Input materials (non-empty)
  - `item` (string): Material item ID
  - `amount` (integer): Quantity required (>= 1)
- `tools` (array, optional): Tool item IDs (not consumed, can be empty for no-tool recipes)
- `level` (integer, required): Fletching level required (1-99)
- `xp` (number, required): XP granted per action (> 0, total for all items)
- `ticks` (integer, required): Time in game ticks (> 0)
- `skill` (string, required): Must be "fletching"

**Categories**: arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows

**Validation**:
- All item IDs must exist in items manifest
- Inputs array must be non-empty
- Input amounts >= 1
- Tool IDs must be valid (if present)
- outputQuantity >= 1 (if present)
- Level in range [1, 99]
- XP > 0, ticks > 0
- skill must be "fletching"

**Example** (shortbow unstrung):
```json
{
  "output": "shortbow_u",
  "outputQuantity": 1,
  "category": "shortbows",
  "inputs": [
    { "item": "logs", "amount": 1 }
  ],
  "tools": ["knife"],
  "level": 5,
  "xp": 5,
  "ticks": 3,
  "skill": "fletching"
}
```

**Example** (stringing - no tool required):
```json
{
  "output": "shortbow",
  "outputQuantity": 1,
  "category": "stringing",
  "inputs": [
    { "item": "shortbow_u", "amount": 1 },
    { "item": "bowstring", "amount": 1 }
  ],
  "tools": [],
  "level": 5,
  "xp": 5,
  "ticks": 2,
  "skill": "fletching"
}
```

**Example** (headless arrows - multi-output):
```json
{
  "output": "headless_arrow",
  "outputQuantity": 15,
  "category": "headless_arrows",
  "inputs": [
    { "item": "arrow_shaft", "amount": 15 },
    { "item": "feather", "amount": 15 }
  ],
  "tools": [],
  "level": 1,
  "xp": 15,
  "ticks": 2,
  "skill": "fletching"
}
```

## Runecrafting Manifest

**File**: `recipes/runecrafting.json`

**Format**:
```json
{
  "recipes": [
    {
      "runeType": "air",
      "runeItemId": "air_rune",
      "levelRequired": 1,
      "xpPerEssence": 5,
      "essenceTypes": ["rune_essence", "pure_essence"],
      "multiRuneLevels": [11, 22, 33, 44, 55, 66, 77, 88, 99]
    }
  ]
}
```

**Fields**:
- `runeType` (string, required): Rune type identifier (e.g., "air", "water")
- `runeItemId` (string, required): Output rune item ID
- `levelRequired` (integer, required): Runecrafting level required (1-99)
- `xpPerEssence` (number, required): XP granted per essence converted (> 0)
- `essenceTypes` (array, required): Valid essence item IDs (non-empty)
- `multiRuneLevels` (array, required): Levels granting +1 rune per essence (can be empty)

**Validation**:
- All item IDs must exist in items manifest
- essenceTypes array must be non-empty
- multiRuneLevels must be an array (can be empty)
- Level in range [1, 99]
- XP > 0

**Multi-Rune Mechanics**:
- Base: 1 rune per essence
- Each threshold in `multiRuneLevels` adds +1 rune per essence
- Example: At level 22 with thresholds [11, 22, 33], player gets 3 runes per essence

**Example** (water rune):
```json
{
  "runeType": "water",
  "runeItemId": "water_rune",
  "levelRequired": 5,
  "xpPerEssence": 6,
  "essenceTypes": ["rune_essence", "pure_essence"],
  "multiRuneLevels": [19, 38, 57, 76, 95]
}
```

**Example** (law rune - no multi-rune):
```json
{
  "runeType": "law",
  "runeItemId": "law_rune",
  "levelRequired": 54,
  "xpPerEssence": 9.5,
  "essenceTypes": ["pure_essence"],
  "multiRuneLevels": []
}
```

## Tanning Manifest

**File**: `recipes/tanning.json`

**Format**:
```json
{
  "recipes": [
    {
      "input": "cowhide",
      "output": "leather",
      "cost": 1,
      "name": "Leather"
    }
  ]
}
```

**Fields**:
- `input` (string, required): Input hide item ID
- `output` (string, required): Output leather item ID
- `cost` (integer, required): Coin cost per hide tanned (>= 0)
- `name` (string, required): Display name

**Validation**:
- All item IDs must exist in items manifest
- Cost >= 0

**Example** (green dragonhide):
```json
{
  "input": "green_dragonhide",
  "output": "green_dragon_leather",
  "cost": 20,
  "name": "Green Dragon Leather"
}
```

## Recipe ID Generation

### Crafting and Smithing

**Recipe ID**: Output item ID (e.g., `"leather_body"`)

**Uniqueness**: One recipe per output item

**Lookup**:
```typescript
const recipe = processingDataProvider.getCraftingRecipe('leather_body');
```

### Fletching

**Recipe ID**: `{output}:{primaryInput}` (e.g., `"arrow_shaft:logs"`)

**Uniqueness**: Multiple recipes can share the same output (e.g., arrow shafts from different log types)

**Lookup**:
```typescript
const recipe = processingDataProvider.getFletchingRecipe('arrow_shaft:logs');
```

**Why**: Allows different recipes for the same output using different inputs.

### Runecrafting

**Recipe ID**: Rune type (e.g., `"air"`, `"water"`)

**Uniqueness**: One recipe per rune type

**Lookup**:
```typescript
const recipe = processingDataProvider.getRunecraftingRecipe('air');
```

## Multi-Output Recipes

Some recipes produce multiple items per action:

**Fletching**:
- Arrow shafts: 15 per log
- Headless arrows: 15 per set (15 shafts + 15 feathers)
- Arrows: 15 per set (15 headless + 15 arrowtips)

**Smithing**:
- Arrowtips: 15 per bar

**Implementation**:
```json
{
  "output": "arrow_shaft",
  "outputQuantity": 15,
  "inputs": [{ "item": "logs", "amount": 1 }],
  "xp": 5
}
```

**XP Calculation**: XP is granted once per action (not per item produced).

**Example**: Fletching 1 log into 15 arrow shafts grants 5 XP total (not 75 XP).

## Consumables with Limited Uses

Crafting supports consumables that have multiple uses before being consumed:

**Example** (thread):
```json
{
  "consumables": [
    { "item": "thread", "uses": 5 }
  ]
}
```

**Mechanics**:
- Player needs 1 thread in inventory to start crafting
- Thread is NOT consumed on first craft
- After 5 crafts, thread is consumed and a new one is required
- If player runs out of thread mid-session, crafting stops

**Implementation**:
```typescript
// Session tracks remaining uses per consumable
interface CraftingSession {
  consumableUses: Map<string, number>; // "thread" → 5, 4, 3, 2, 1, 0
}

// On session start
session.consumableUses.set('thread', 5);

// On each craft
const remaining = session.consumableUses.get('thread') || 0;
session.consumableUses.set('thread', remaining - 1);

// When uses reach 0, consume from inventory
if (remaining <= 0) {
  removeItem(playerId, 'thread', 1);
  session.consumableUses.set('thread', 5); // Reset uses
}
```

## Station Requirements

Some recipes require specific stations:

**Crafting Stations**:
- `"none"` - Can craft anywhere (leather armor, gem cutting)
- `"furnace"` - Requires furnace (jewelry)

**Example** (jewelry at furnace):
```json
{
  "output": "gold_necklace",
  "station": "furnace",
  "tools": ["necklace_mould"],
  "inputs": [{ "item": "gold_bar", "amount": 1 }]
}
```

**Validation**: Station must be "none" or "furnace".

## Item-on-Item Interactions

Fletching supports item-on-item interactions where player uses one item on another:

**Examples**:
- Bowstring + unstrung bow → strung bow
- Arrowtips + headless arrows → finished arrows
- Feathers + arrow shafts → headless arrows

**Recipe Format** (same as regular fletching):
```json
{
  "output": "shortbow",
  "inputs": [
    { "item": "shortbow_u", "amount": 1 },
    { "item": "bowstring", "amount": 1 }
  ],
  "tools": []
}
```

**Lookup**:
```typescript
// Get recipes that use BOTH items
const recipes = processingDataProvider.getFletchingRecipesForInputPair(
  'shortbow_u',
  'bowstring'
);
```

## Validation Rules

ProcessingDataProvider validates all recipes on load. Validation errors are logged to console with recipe label for debugging.

### Common Validation Errors

**Missing Required Field**:
```
[leather_body] missing or invalid 'output'
```

**Invalid Level**:
```
[bronze_sword] level must be 1–99, got 150
```

**Invalid XP**:
```
[raw_shrimp] xp must be > 0, got -10
```

**Invalid Ticks**:
```
[logs] ticks must be > 0, got 0
```

**Item Not Found**:
```
[leather_body] input 'fake_leather' not found in ITEMS manifest
```

**Invalid Input Amount**:
```
[bronze_bar] input 'copper_ore' has invalid amount: 0
```

**Invalid Station**:
```
[gold_ring] station must be 'none' or 'furnace', got 'anvil'
```

### Validation Process

1. Load manifest JSON file
2. For each recipe:
   - Check required fields present
   - Validate field types and ranges
   - Verify all item IDs exist in ITEMS manifest
   - Check input amounts >= 1
   - Validate tool/consumable IDs
   - Verify station is valid
3. Log all errors with recipe label
4. Skip invalid recipes (don't crash)
5. Build lookup tables from valid recipes

**Example Output**:
```
[ProcessingDataProvider] Crafting manifest validation errors (3):
  [leather_body] input 'fake_leather' not found in ITEMS manifest
  [gold_ring] station must be 'none' or 'furnace', got 'anvil'
  [sapphire] level must be 1–99, got 150
```

## Adding New Recipes

### 1. Edit Manifest File

Add recipe to appropriate manifest file:

```json
{
  "output": "mithril_platebody",
  "bar": "mithril_bar",
  "barsRequired": 5,
  "level": 68,
  "xp": 150,
  "ticks": 4,
  "category": "armor",
  "outputQuantity": 1
}
```

### 2. Verify Item Exists

Check that all item IDs exist in `packages/server/world/assets/manifests/items.json`:

```json
{
  "id": "mithril_platebody",
  "name": "Mithril Platebody",
  "type": "equipment",
  "equipmentSlot": "body",
  "smithing": {
    "barType": "mithril_bar",
    "barsRequired": 5,
    "levelRequired": 68,
    "xp": 150,
    "category": "armor"
  }
}
```

**Note**: Item manifest is the source of truth for item properties. Recipe manifests reference items by ID.

### 3. Reload Data

**Development**: Hot-reload automatically picks up manifest changes.

**Production**: Restart server to reload manifests.

### 4. Test Recipe

```typescript
// Check recipe loaded
const recipe = processingDataProvider.getSmithingRecipe('mithril_platebody');
console.log(recipe); // Should show recipe data

// Test in-game
// 1. Get mithril bars
// 2. Click anvil
// 3. Verify mithril platebody appears in smithing panel
// 4. Smith item and verify XP granted
```

## Recipe Manifest Best Practices

### 1. Use OSRS Wiki as Reference

All recipes should match OSRS mechanics:
- Level requirements
- XP values
- Material costs
- Processing times

**Reference**: https://oldschool.runescape.wiki

### 2. Consistent Naming

Use snake_case for all item IDs:
- ✅ `bronze_sword`, `leather_body`, `arrow_shaft`
- ❌ `BronzeSword`, `leatherBody`, `arrowShaft`

### 3. Logical Grouping

Group related recipes in categories:
- Smithing: weapons, armor, tools, arrowtips
- Crafting: leather, studded, dragonhide, jewelry, gem_cutting
- Fletching: arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows

### 4. Validate Before Committing

Run the game and check console for validation errors:

```bash
bun run dev
# Check console for:
# [ProcessingDataProvider] Initialized: ... recipes
# [ProcessingDataProvider] Crafting manifest validation errors (0)
```

### 5. Test Edge Cases

Test recipes with:
- Minimum level requirement
- Insufficient materials
- Missing tools
- Multi-output quantities
- Consumable depletion

## Recipe Manifest Examples

### Complete Crafting Recipe (Leather Armor)

```json
{
  "output": "leather_chaps",
  "category": "leather",
  "inputs": [
    { "item": "leather", "amount": 12 }
  ],
  "tools": ["needle"],
  "consumables": [
    { "item": "thread", "uses": 5 }
  ],
  "level": 18,
  "xp": 27,
  "ticks": 3,
  "station": "none"
}
```

**Mechanics**:
- Requires needle in inventory (not consumed)
- Requires thread in inventory (consumed every 5 crafts)
- Consumes 12 leather per chaps
- Grants 27 XP per chaps
- Takes 3 ticks (1.8 seconds) per chaps
- Can craft anywhere (no station required)

### Complete Fletching Recipe (Oak Longbow)

```json
{
  "output": "oak_longbow_u",
  "outputQuantity": 1,
  "category": "longbows",
  "inputs": [
    { "item": "oak_logs", "amount": 1 }
  ],
  "tools": ["knife"],
  "level": 25,
  "xp": 25,
  "ticks": 3,
  "skill": "fletching"
}
```

**Mechanics**:
- Requires knife in inventory (not consumed)
- Consumes 1 oak log per bow
- Produces 1 unstrung oak longbow
- Grants 25 XP per bow
- Takes 3 ticks (1.8 seconds) per bow

### Complete Runecrafting Recipe (Chaos Rune)

```json
{
  "runeType": "chaos",
  "runeItemId": "chaos_rune",
  "levelRequired": 35,
  "xpPerEssence": 8.5,
  "essenceTypes": ["pure_essence"],
  "multiRuneLevels": [74]
}
```

**Mechanics**:
- Requires level 35 runecrafting
- Only accepts pure essence (not rune essence)
- Grants 8.5 XP per essence converted
- Produces 1 chaos rune per essence at levels 35-73
- Produces 2 chaos runes per essence at level 74+
- Instant conversion (no tick delay)

### Complete Smelting Recipe (Mithril Bar)

```json
{
  "output": "mithril_bar",
  "inputs": [
    { "item": "mithril_ore", "amount": 1 },
    { "item": "coal", "amount": 4 }
  ],
  "level": 50,
  "xp": 30,
  "ticks": 4,
  "successRate": 1.0
}
```

**Mechanics**:
- Requires 1 mithril ore + 4 coal
- Requires level 50 smithing
- Grants 30 XP per bar
- Takes 4 ticks (2.4 seconds) per bar
- 100% success rate (always succeeds)

## Fallback Behavior

If recipe manifests are missing, ProcessingDataProvider falls back to embedded item data:

**Embedded Data** (backwards compatibility):
- Items with `cooking` property → cooking recipes
- Items with `firemaking` property → firemaking recipes
- Items with `smelting` property → smelting recipes
- Items with `smithing` property → smithing recipes

**Example** (item with embedded cooking data):
```json
{
  "id": "raw_shrimp",
  "name": "Raw Shrimp",
  "cooking": {
    "cookedItemId": "shrimp",
    "burntItemId": "burnt_shrimp",
    "levelRequired": 1,
    "xp": 30,
    "stopBurnLevel": { "fire": 35, "range": 32 }
  }
}
```

**Migration Path**:
1. Add recipe manifests
2. ProcessingDataProvider prefers manifests over embedded data
3. Eventually remove embedded data from items (cleanup)

## Manifest Loading Order

1. **DataManager** loads all manifests from `packages/server/world/assets/manifests/`
2. **DataManager** calls `processingDataProvider.loadXRecipes()` for each manifest
3. **ProcessingDataProvider** stores raw manifests
4. **ProcessingDataProvider.initialize()** builds lookup tables from manifests
5. **Systems** access recipes via ProcessingDataProvider methods

**Code Flow**:
```typescript
// DataManager.ts
const cookingManifest = await loadJSON('recipes/cooking.json');
processingDataProvider.loadCookingRecipes(cookingManifest);

// Later, after all manifests loaded
processingDataProvider.initialize();

// Systems can now access recipes
const recipe = processingDataProvider.getCookingData('raw_shrimp');
```

## Debugging Recipes

### Check Loaded Recipes

```typescript
import { processingDataProvider } from '@hyperscape/shared';

// Get summary
const summary = processingDataProvider.getSummary();
console.log(summary);
// Output:
// {
//   cookableItems: 15,
//   burnableLogs: 8,
//   smeltableBars: 12,
//   smithingRecipes: 45,
//   craftingRecipes: 28,
//   tanningRecipes: 6,
//   fletchingRecipes: 37,
//   runecraftingRecipes: 12,
//   isInitialized: true
// }
```

### Check Specific Recipe

```typescript
// Check if recipe exists
const recipe = processingDataProvider.getFletchingRecipe('arrow_shaft:logs');
if (!recipe) {
  console.error('Recipe not found!');
} else {
  console.log('Recipe:', recipe);
}
```

### Check Validation Errors

Look for validation errors in console on server startup:

```
[ProcessingDataProvider] Fletching manifest validation errors (2):
  [arrow_shaft] input 'fake_logs' not found in ITEMS manifest
  [shortbow] level must be 1–99, got 150
```

### Verify Item IDs

```typescript
import { ITEMS } from '@hyperscape/shared';

// Check if item exists
if (!ITEMS.has('leather')) {
  console.error('Item not found in manifest!');
}

// Get item data
const item = ITEMS.get('leather');
console.log(item?.name); // "Leather"
```

## Performance Considerations

### Recipe Lookup Performance

ProcessingDataProvider uses Map-based lookups for O(1) access:

```typescript
// O(1) lookup
const recipe = processingDataProvider.getCraftingRecipe('leather_body');

// O(n) filtering (use sparingly)
const leatherRecipes = processingDataProvider.getCraftingRecipesByCategory('leather');
```

### Memory Usage

Recipe data is loaded once on startup and cached in memory:

- ~50 KB for all recipe manifests
- ~100 KB for lookup tables (Maps, Sets)
- Total: ~150 KB memory overhead

**Optimization**: Pre-allocated buffers for inventory counting (avoids allocations in hot paths).

### Manifest Size Limits

**Recommended**:
- < 100 recipes per manifest
- < 500 KB per manifest file

**Current**:
- Fletching: 37 recipes (~15 KB)
- Smithing: 45 recipes (~20 KB)
- Crafting: 28 recipes (~12 KB)

## See Also

- [SKILLS.md](SKILLS.md) - Skills system overview
- [API-REFERENCE.md](API-REFERENCE.md) - API documentation
- [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md) - Migration guide
- [CLAUDE.md](CLAUDE.md) - Development guidelines
