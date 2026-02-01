# Artisan Skills Guide

Comprehensive guide to Hyperscape's three artisan skills: Crafting, Fletching, and Runecrafting.

## Overview

Artisan skills allow players to create equipment, ammunition, and consumables from raw materials. All three skills follow OSRS-accurate mechanics with manifest-driven recipes.

## Crafting

Create leather armor, dragonhide equipment, jewelry, and cut gems.

### Categories

#### Leather Crafting (Levels 1-18)

**Requirements:**
- Needle (tool, not consumed)
- Thread (consumable, 5 uses per item)
- Leather (material)

**Items:**
- Leather gloves (level 1, 13.8 XP)
- Leather boots (level 7, 16.3 XP)
- Leather vambraces (level 11, 22 XP)
- Leather chaps (level 14, 27 XP)
- Leather body (level 14, 25 XP)
- Coif (level 18, 37 XP)

**How to Craft:**
1. Have needle and thread in inventory
2. Use needle on leather
3. Select item from crafting panel
4. Choose quantity (1, 5, 10, All, or custom)
5. Wait for crafting to complete (2-3 ticks per item)

#### Dragonhide Crafting (Levels 57-84)

**Requirements:**
- Needle (tool, not consumed)
- Thread (consumable, 5 uses per item)
- Dragon leather (material)

**Items:**
- Green d'hide vambraces (level 57, 62 XP)
- Green d'hide chaps (level 60, 124 XP)
- Green d'hide body (level 63, 186 XP)
- Blue d'hide vambraces (level 66, 70 XP)
- Blue d'hide chaps (level 68, 140 XP)
- Blue d'hide body (level 71, 210 XP)
- Red d'hide vambraces (level 73, 78 XP)
- Red d'hide chaps (level 75, 156 XP)
- Red d'hide body (level 77, 234 XP)
- Black d'hide vambraces (level 79, 86 XP)
- Black d'hide chaps (level 82, 172 XP)
- Black d'hide body (level 84, 258 XP)

#### Jewelry Crafting (Levels 5-40)

**Requirements:**
- Furnace (station)
- Mould (tool, not consumed)
- Gold or silver bar (material)

**Items:**
- Gold ring (level 5, 15 XP, ring mould)
- Sapphire ring (level 20, 40 XP, ring mould + sapphire)
- Emerald ring (level 27, 55 XP, ring mould + emerald)
- Ruby ring (level 34, 70 XP, ring mould + ruby)
- Diamond ring (level 43, 85 XP, ring mould + diamond)
- Gold necklace (level 6, 20 XP, necklace mould)
- Sapphire necklace (level 22, 55 XP, necklace mould + sapphire)
- Emerald necklace (level 29, 60 XP, necklace mould + emerald)
- Ruby necklace (level 40, 75 XP, necklace mould + ruby)
- Diamond necklace (level 56, 90 XP, necklace mould + diamond)

**How to Craft Jewelry:**
1. Have mould and gold/silver bar in inventory
2. Use gold bar on furnace
3. Select jewelry item from crafting panel
4. Choose quantity
5. Wait for crafting to complete (instant at furnace)

#### Gem Cutting (Levels 20-43)

**Requirements:**
- Chisel (tool, not consumed)
- Uncut gem (material)

**Items:**
- Sapphire (level 20, 50 XP)
- Emerald (level 27, 67.5 XP)
- Ruby (level 34, 85 XP)
- Diamond (level 43, 107.5 XP)

**How to Cut Gems:**
1. Have chisel in inventory
2. Use chisel on uncut gem
3. Gem is instantly cut (no quantity selection)

### Tanning System

Convert hides to leather at tanner NPCs.

**Tanning Costs:**
- Cowhide → Leather (1 gp)
- Green dragonhide → Green dragon leather (20 gp)
- Blue dragonhide → Blue dragon leather (20 gp)
- Red dragonhide → Red dragon leather (20 gp)
- Black dragonhide → Black dragon leather (20 gp)

**How to Tan:**
1. Talk to tanner NPC
2. Select hide type from tanning panel
3. Choose quantity
4. Confirm (coins deducted, leather added instantly)

**Note:** Tanning is instant (no tick delay) and grants no XP.

### Crafting Mechanics

**Thread Consumption:**
- Thread has 5 uses before being consumed
- Uses tracked in-memory during crafting session
- New thread consumed from inventory when uses depleted
- Crafting stops if no thread available

**Movement/Combat Cancellation:**
- Crafting cancels when player moves
- Crafting cancels when combat starts
- Matches OSRS behavior where any action interrupts skilling

**Recipe Filtering:**
- Recipes filter by input item (e.g., chisel + uncut sapphire shows only sapphire)
- Furnace jewelry filters by equipped mould
- Auto-selects single recipe to skip to quantity selection

**Make-X Functionality:**
- Craft 1, 5, 10, All, or custom quantity
- Custom quantity remembered in localStorage
- "All" computes max based on available materials

**Performance:**
- Single inventory scan per tick
- Reusable arrays to avoid allocations
- Once-per-tick processing guard

**Security:**
- Rate limiting (1 request per 500ms)
- Audit logging on craft completion
- Monotonic counter for item IDs
- Input validation

## Fletching

Create ranged weapons and ammunition.

### Categories

#### Arrow Shafts (Levels 1-60)

**Requirements:**
- Knife (tool, not consumed)
- Logs (material)

**Items:**
- Arrow shaft (level 1, 5 XP, 15 per log)
- Oak arrow shaft (level 10, 10 XP, 15 per log)
- Willow arrow shaft (level 20, 15 XP, 15 per log)
- Maple arrow shaft (level 30, 20 XP, 15 per log)
- Yew arrow shaft (level 50, 25 XP, 15 per log)
- Magic arrow shaft (level 60, 30 XP, 15 per log)

**How to Make:**
1. Have knife in inventory
2. Use knife on logs
3. Select arrow shafts from fletching panel
4. Choose quantity (actions, not shafts - each action produces 15 shafts)
5. Wait for fletching to complete (2-3 ticks per action)

#### Headless Arrows (Level 1)

**Requirements:**
- Arrow shafts (material)
- Feathers (material)

**Items:**
- Headless arrow (level 1, 1 XP, 15 per action)

**How to Make:**
1. Use arrow shafts on feathers (item-on-item)
2. Fletching panel opens automatically
3. Choose quantity (actions, not arrows - each action produces 15 arrows)
4. Wait for fletching to complete

#### Arrows (Levels 1-75)

**Requirements:**
- Headless arrows (material)
- Arrowtips (material)

**Items:**
- Bronze arrow (level 1, 1.3 XP, 15 per action)
- Iron arrow (level 15, 2.5 XP, 15 per action)
- Steel arrow (level 30, 5 XP, 15 per action)
- Mithril arrow (level 45, 7.5 XP, 15 per action)
- Adamant arrow (level 60, 10 XP, 15 per action)
- Rune arrow (level 75, 12.5 XP, 15 per action)

**How to Make:**
1. Use arrowtips on headless arrows (item-on-item)
2. Fletching panel opens automatically
3. Choose quantity (actions, not arrows - each action produces 15 arrows)
4. Wait for fletching to complete

**Note:** Arrowtips are created via Smithing skill (15 arrowtips per bar).

#### Shortbows (Levels 5-70)

**Requirements:**
- Knife (tool, not consumed)
- Logs (material)

**Items:**
- Shortbow (u) (level 5, 5 XP)
- Oak shortbow (u) (level 20, 16.5 XP)
- Willow shortbow (u) (level 35, 33.3 XP)
- Maple shortbow (u) (level 50, 50 XP)
- Yew shortbow (u) (level 65, 67.5 XP)
- Magic shortbow (u) (level 80, 83.3 XP)

**How to Make:**
1. Have knife in inventory
2. Use knife on logs
3. Select shortbow from fletching panel
4. Choose quantity
5. Wait for fletching to complete

#### Longbows (Levels 10-85)

**Requirements:**
- Knife (tool, not consumed)
- Logs (material)

**Items:**
- Longbow (u) (level 10, 10 XP)
- Oak longbow (u) (level 25, 25 XP)
- Willow longbow (u) (level 40, 41.5 XP)
- Maple longbow (u) (level 55, 58.3 XP)
- Yew longbow (u) (level 70, 75 XP)
- Magic longbow (u) (level 85, 91.5 XP)

#### Stringing Bows (Levels 5-85)

**Requirements:**
- Bowstring (material)
- Unstrung bow (material)

**Items:**
- Shortbow (level 5, 5 XP)
- Oak shortbow (level 20, 16.5 XP)
- Willow shortbow (level 35, 33.3 XP)
- Maple shortbow (level 50, 50 XP)
- Yew shortbow (level 65, 67.5 XP)
- Magic shortbow (level 80, 83.3 XP)
- Longbow (level 10, 10 XP)
- Oak longbow (level 25, 25 XP)
- Willow longbow (level 40, 41.5 XP)
- Maple longbow (level 55, 58.3 XP)
- Yew longbow (level 70, 75 XP)
- Magic longbow (level 85, 91.5 XP)

**How to String:**
1. Use bowstring on unstrung bow (item-on-item)
2. Fletching panel opens automatically
3. Choose quantity
4. Wait for fletching to complete (no tool required)

### Fletching Mechanics

**Multi-Output Recipes:**
- Arrow shafts: 15 per log
- Headless arrows: 15 per action
- Arrows: 15 per action
- Arrowtips (from Smithing): 15 per bar

**Item-on-Item Interactions:**
- Bowstring + unstrung bow → strung bow
- Arrowtips + headless arrows → arrows
- Arrow shafts + feathers → headless arrows

**Movement/Combat Cancellation:**
- Fletching cancels when player moves
- Fletching cancels when combat starts

**Recipe Filtering:**
- Knife + logs shows all recipes for that log type
- Item-on-item shows only matching recipes

**Make-X Functionality:**
- Fletch 1, 5, 10, All, or custom quantity
- Quantity refers to ACTIONS, not output items
- Example: "Fletch 5" with logs = 75 arrow shafts (5 actions × 15 shafts)

## Runecrafting

Convert essence into runes at runecrafting altars.

### Altars

#### Basic Runes (Levels 1-27)

| Rune | Level | XP/Essence | Multi-Rune Levels |
|------|-------|------------|-------------------|
| Air | 1 | 5 | 11, 22, 33, 44, 55, 66, 77, 88, 99 |
| Mind | 2 | 5.5 | 14, 28, 42, 56, 70, 84, 98 |
| Water | 5 | 6 | 19, 38, 57, 76, 95 |
| Earth | 9 | 6.5 | 26, 52, 78 |
| Fire | 14 | 7 | 35, 70 |
| Body | 20 | 7.5 | 46, 92 |

#### Advanced Runes (Levels 27-65)

| Rune | Level | XP/Essence | Multi-Rune Levels |
|------|-------|------------|-------------------|
| Cosmic | 27 | 8 | 59 |
| Chaos | 35 | 8.5 | 74 |
| Nature | 44 | 9 | - |
| Law | 54 | 9.5 | - |
| Death | 65 | 10 | - |

### Essence Types

**Rune Essence:**
- Can craft: Air, Mind, Water, Earth, Fire, Body runes
- Obtained from: Rune essence mine (requires quest)

**Pure Essence:**
- Can craft: All runes (including Cosmic, Chaos, Nature, Law, Death)
- Obtained from: High-level mining, shops

### Multi-Rune Crafting

At specific levels, you craft multiple runes per essence:

**Example: Air Runes**
- Level 1-10: 1 air rune per essence
- Level 11-21: 2 air runes per essence
- Level 22-32: 3 air runes per essence
- Level 33-43: 4 air runes per essence
- And so on...

**Formula:**
```
Multiplier = 1 + (number of thresholds reached)
```

### How to Runecraft

1. Gather essence (rune essence or pure essence)
2. Travel to runecrafting altar
3. Click on altar
4. ALL essence in inventory is instantly converted to runes
5. Runes appear in inventory

**Note:** Runecrafting is instant (no tick delay). One click converts all essence at once.

### Runecrafting Mechanics

**Instant Conversion:**
- No tick delay (unlike other skills)
- All essence converted in one action
- XP granted per essence consumed

**Multi-Rune Multipliers:**
- Calculated based on player level
- Each threshold grants +1 rune per essence
- Thresholds are skill-specific (see table above)

**Essence Validation:**
- Basic runes require rune_essence OR pure_essence
- Advanced runes require pure_essence only
- Invalid essence types are ignored

**No Failure Rate:**
- Runecrafting always succeeds
- No burnt or failed runes

## Recipe Manifests

All artisan skill recipes are defined in JSON manifests at `packages/server/world/assets/manifests/recipes/`:

### Crafting Manifest (`recipes/crafting.json`)

```json
{
  "recipes": [
    {
      "output": "leather_gloves",
      "category": "leather",
      "inputs": [
        { "item": "leather", "amount": 1 }
      ],
      "tools": ["needle"],
      "consumables": [
        { "item": "thread", "uses": 5 }
      ],
      "level": 1,
      "xp": 13.8,
      "ticks": 3,
      "station": "none"
    }
  ]
}
```

**Fields:**
- `output`: Item ID of crafted item
- `category`: UI grouping (leather, dragonhide, jewelry, gem_cutting)
- `inputs`: Materials consumed per craft
- `tools`: Items required in inventory (not consumed)
- `consumables`: Items with limited uses (e.g., thread with 5 uses)
- `level`: Crafting level required
- `xp`: XP granted per item made
- `ticks`: Time in game ticks (600ms per tick)
- `station`: Required station ("none" or "furnace")

### Fletching Manifest (`recipes/fletching.json`)

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

**Fields:**
- `output`: Item ID of fletched item
- `outputQuantity`: Number of items produced per action (default: 1)
- `category`: UI grouping (arrow_shafts, headless_arrows, arrows, shortbows, longbows, stringing)
- `inputs`: Materials consumed per action
- `tools`: Items required in inventory (not consumed, empty for stringing)
- `level`: Fletching level required
- `xp`: XP granted per action (total for all outputQuantity items)
- `ticks`: Time in game ticks
- `skill`: Must be "fletching"

### Runecrafting Manifest (`recipes/runecrafting.json`)

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

**Fields:**
- `runeType`: Unique identifier (air, mind, water, etc.)
- `runeItemId`: Item ID of output rune
- `levelRequired`: Runecrafting level required
- `xpPerEssence`: XP granted per essence consumed
- `essenceTypes`: Valid essence item IDs
- `multiRuneLevels`: Levels at which multiplier increases (sorted ascending)

### Tanning Manifest (`recipes/tanning.json`)

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

**Fields:**
- `input`: Hide item ID
- `output`: Leather item ID
- `cost`: Coin cost per hide
- `name`: Display name

## ProcessingDataProvider API

Central data provider for all artisan skill recipes.

### Initialization

```typescript
import { processingDataProvider } from '@/data/ProcessingDataProvider';

// Initialize after DataManager loads manifests
processingDataProvider.initialize();
```

### Crafting Methods

```typescript
// Get recipe by output item ID
const recipe = processingDataProvider.getCraftingRecipe('leather_gloves');

// Get recipes by station
const furnaceRecipes = processingDataProvider.getCraftingRecipesByStation('furnace');

// Get recipes by category
const leatherRecipes = processingDataProvider.getCraftingRecipesByCategory('leather');

// Check if item is craftable
const isCraftable = processingDataProvider.isCraftableItem('leather_gloves');

// Get all craftable item IDs
const craftableIds = processingDataProvider.getCraftableItemIds();

// Get valid input items for a tool
const needleInputs = processingDataProvider.getCraftingInputsForTool('needle');
```

### Fletching Methods

```typescript
// Get recipe by unique ID (output:primaryInput)
const recipe = processingDataProvider.getFletchingRecipe('arrow_shaft:logs');

// Get recipes for a specific input
const logRecipes = processingDataProvider.getFletchingRecipesForInput('logs');

// Get recipes matching both inputs (item-on-item)
const stringRecipes = processingDataProvider.getFletchingRecipesForInputPair(
  'bowstring',
  'shortbow_u'
);

// Get recipes by category
const arrowRecipes = processingDataProvider.getFletchingRecipesByCategory('arrows');

// Check if item is fletchable
const isFletchable = processingDataProvider.isFletchableItem('shortbow');

// Get valid input items for a tool
const knifeInputs = processingDataProvider.getFletchingInputsForTool('knife');
```

### Runecrafting Methods

```typescript
// Get recipe by rune type
const recipe = processingDataProvider.getRunecraftingRecipe('air');

// Calculate multi-rune multiplier
const multiplier = processingDataProvider.getRunecraftingMultiplier('air', 22);
// Returns: 3 (at level 22, you get 3 air runes per essence)

// Check if item is essence
const isEssence = processingDataProvider.isRunecraftingEssence('rune_essence');

// Get all runecrafting recipes
const allRecipes = processingDataProvider.getAllRunecraftingRecipes();
```

### Tanning Methods

```typescript
// Get recipe by input hide ID
const recipe = processingDataProvider.getTanningRecipe('cowhide');

// Get all tanning recipes
const allRecipes = processingDataProvider.getAllTanningRecipes();

// Check if item can be tanned
const isTannable = processingDataProvider.isTannableItem('cowhide');
```

### Recipe Data Types

```typescript
interface CraftingRecipeData {
  output: string;
  name: string;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  consumables: Array<{ item: string; uses: number }>;
  level: number;
  xp: number;
  ticks: number;
  station: string;
}

interface FletchingRecipeData {
  recipeId: string; // Unique ID (output:primaryInput)
  output: string;
  name: string;
  outputQuantity: number;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  ticks: number;
}

interface RunecraftingRecipeData {
  runeType: string;
  runeItemId: string;
  name: string;
  levelRequired: number;
  xpPerEssence: number;
  essenceTypes: string[];
  multiRuneLevels: number[];
}

interface TanningRecipeData {
  input: string;
  output: string;
  cost: number;
  name: string;
}
```

## Event System

Artisan skills use the event system for all interactions:

### Crafting Events

```typescript
// Trigger crafting interaction
EventType.CRAFTING_INTERACT
{
  playerId: string;
  triggerType: string; // "needle", "chisel", "furnace"
  stationId?: string;
  inputItemId?: string;
}

// Request crafting
EventType.PROCESSING_CRAFTING_REQUEST
{
  playerId: string;
  recipeId: string; // Output item ID
  quantity: number;
}

// Crafting started
EventType.CRAFTING_START
{
  playerId: string;
  recipeId: string;
}

// Crafting completed
EventType.CRAFTING_COMPLETE
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

### Fletching Events

```typescript
// Trigger fletching interaction
EventType.FLETCHING_INTERACT
{
  playerId: string;
  triggerType: string; // "knife" or "item_on_item"
  inputItemId: string;
  secondaryItemId?: string;
}

// Request fletching
EventType.PROCESSING_FLETCHING_REQUEST
{
  playerId: string;
  recipeId: string; // Unique ID (output:primaryInput)
  quantity: number;
}

// Fletching started
EventType.FLETCHING_START
{
  playerId: string;
  recipeId: string;
}

// Fletching completed
EventType.FLETCHING_COMPLETE
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

### Runecrafting Events

```typescript
// Trigger runecrafting interaction
EventType.RUNECRAFTING_INTERACT
{
  playerId: string;
  altarId: string;
  runeType: string; // "air", "mind", "water", etc.
}

// Runecrafting completed
EventType.RUNECRAFTING_COMPLETE
{
  playerId: string;
  runeType: string;
  runeItemId: string;
  essenceConsumed: number;
  runesProduced: number;
  multiplier: number;
  xpAwarded: number;
}
```

### Tanning Events

```typescript
// Trigger tanning interaction
EventType.TANNING_INTERACT
{
  playerId: string;
  npcId: string;
}

// Request tanning
EventType.TANNING_REQUEST
{
  playerId: string;
  inputItemId: string; // Hide item ID
  quantity: number;
}

// Tanning completed
EventType.TANNING_COMPLETE
{
  playerId: string;
  inputItemId: string;
  outputItemId: string;
  totalTanned: number;
  totalCost: number;
}
```

## Adding New Recipes

To add new artisan skill recipes, edit the appropriate manifest file:

### Adding a Crafting Recipe

1. Open `packages/server/world/assets/manifests/recipes/crafting.json`
2. Add new recipe to `recipes` array:

```json
{
  "output": "new_item",
  "category": "leather",
  "inputs": [
    { "item": "leather", "amount": 2 }
  ],
  "tools": ["needle"],
  "consumables": [
    { "item": "thread", "uses": 5 }
  ],
  "level": 10,
  "xp": 20,
  "ticks": 3,
  "station": "none"
}
```

3. Restart server (recipes loaded on startup)

### Adding a Fletching Recipe

1. Open `packages/server/world/assets/manifests/recipes/fletching.json`
2. Add new recipe to `recipes` array:

```json
{
  "output": "new_arrow",
  "outputQuantity": 15,
  "category": "arrows",
  "inputs": [
    { "item": "new_arrowtips", "amount": 15 },
    { "item": "headless_arrow", "amount": 15 }
  ],
  "tools": [],
  "level": 50,
  "xp": 10,
  "ticks": 2,
  "skill": "fletching"
}
```

3. Restart server

### Adding a Runecrafting Recipe

1. Open `packages/server/world/assets/manifests/recipes/runecrafting.json`
2. Add new recipe to `recipes` array:

```json
{
  "runeType": "new_rune",
  "runeItemId": "new_rune",
  "levelRequired": 50,
  "xpPerEssence": 9,
  "essenceTypes": ["pure_essence"],
  "multiRuneLevels": [60, 75, 90]
}
```

3. Restart server

### Adding a Tanning Recipe

1. Open `packages/server/world/assets/manifests/recipes/tanning.json`
2. Add new recipe to `recipes` array:

```json
{
  "input": "new_hide",
  "output": "new_leather",
  "cost": 5,
  "name": "New Leather"
}
```

3. Restart server

## Database Schema

### Skill Columns

All artisan skill data is stored in the `characters` table:

```sql
-- Crafting
craftingLevel INTEGER DEFAULT 1
craftingXp INTEGER DEFAULT 0

-- Fletching
fletchingLevel INTEGER DEFAULT 1
fletchingXp INTEGER DEFAULT 0

-- Runecrafting
runecraftingLevel INTEGER DEFAULT 1
runecraftingXp INTEGER DEFAULT 0
```

### Migrations

Recent migrations for artisan skills:

- **0029_add_crafting_skill.sql**: Add crafting columns
- **0030_add_fletching_skill.sql**: Add fletching columns
- **0031_add_runecrafting_skill.sql**: Add runecrafting columns

## Performance Optimizations

### Crafting System

- Single inventory scan per tick (consolidated from 4 separate scans)
- Reusable arrays to avoid per-tick allocations
- Once-per-tick processing guard
- Pre-allocated inventory count buffer

### Fletching System

- Single inventory scan per tick
- Reusable arrays for completed session tracking
- Once-per-tick processing guard
- Recipe filtering by input item pair

### Runecrafting System

- No tick-based processing (instant conversion)
- Single inventory scan per interaction
- Pre-calculated multi-rune multipliers

## Security Features

### Rate Limiting

- Crafting interact: 1 request per 500ms
- Fletching interact: 1 request per 500ms
- Runecrafting interact: 1 request per 500ms

### Audit Logging

All artisan skill completions are logged:

```typescript
Logger.system("CraftingSystem", "craft_complete", {
  playerId,
  recipeId,
  output,
  inputsConsumed,
  xpAwarded,
  crafted,
  batchTotal,
});
```

### Input Validation

- Recipe ID validation
- Level requirement checks
- Material availability checks
- Tool presence validation
- Consumable availability checks

### Monotonic Counters

Item IDs use monotonic counters to prevent Date.now() collisions:

```typescript
private craftCounter = 0;

// Generate unique item ID
id: `craft_${playerId}_${++this.craftCounter}_${Date.now()}`
```

## Testing

### Unit Tests

Artisan skills have comprehensive unit tests:

```bash
# Run crafting tests
bun test CraftingSystem.test.ts

# Run fletching tests
bun test FletchingSystem.test.ts

# Run runecrafting tests
bun test RunecraftingSystem.test.ts
```

### Test Coverage

**CraftingSystem:**
- Crafting lifecycle (start, complete, cancel)
- Thread consumption tracking
- Movement/combat cancellation
- Recipe filtering
- Level requirements
- Material validation

**FletchingSystem:**
- Fletching lifecycle
- Multi-output recipes
- Item-on-item interactions
- Recipe filtering by input pair
- Movement/combat cancellation

**RunecraftingSystem:**
- Instant conversion
- Multi-rune multipliers
- Essence validation
- Level requirements

## Troubleshooting

### Recipes Not Loading

**Symptom:** Crafting/fletching/runecrafting panels show no recipes

**Solution:**
1. Check manifest files exist in `packages/server/world/assets/manifests/recipes/`
2. Verify JSON syntax is valid
3. Check server logs for validation errors
4. Restart server to reload manifests

### Thread Not Consuming

**Symptom:** Thread never runs out during crafting

**Solution:**
- Thread consumption is tracked in-memory per session
- Check `consumableUses` Map in CraftingSession
- Verify thread has `uses: 5` in manifest

### Multi-Output Not Working

**Symptom:** Fletching only produces 1 item instead of 15

**Solution:**
- Check `outputQuantity` field in fletching manifest
- Verify recipe has `outputQuantity: 15`
- Restart server to reload manifests

### Multi-Rune Not Working

**Symptom:** Runecrafting only produces 1 rune per essence at high levels

**Solution:**
- Check `multiRuneLevels` array in runecrafting manifest
- Verify levels are sorted ascending
- Check player's runecrafting level meets threshold

## License

GPL-3.0-only - See LICENSE file
