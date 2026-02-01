# Artisan Skills API Reference

Complete API reference for Hyperscape's artisan skills systems.

## Table of Contents

- [CraftingSystem](#craftingsystem)
- [FletchingSystem](#fletchingsystem)
- [RunecraftingSystem](#runecraftingsystem)
- [TanningSystem](#tanningsystem)
- [ProcessingDataProvider](#processingdataprovider)
- [Event Types](#event-types)
- [Recipe Manifest Schemas](#recipe-manifest-schemas)

## CraftingSystem

Tick-based crafting system for leather armor, dragonhide, jewelry, and gems.

**Location:** `packages/shared/src/systems/shared/interaction/CraftingSystem.ts`

### Public Methods

#### `isPlayerCrafting(playerId: string): boolean`

Check if a player is currently crafting.

**Parameters:**
- `playerId`: Player entity ID

**Returns:** `true` if player has an active crafting session

**Example:**
```typescript
const crafting = craftingSystem.isPlayerCrafting(playerId);
if (crafting) {
  console.log("Player is crafting");
}
```

### Events

#### Subscribes To

- `CRAFTING_INTERACT`: Trigger crafting interaction
- `PROCESSING_CRAFTING_REQUEST`: Start crafting with quantity
- `SKILLS_UPDATED`: Cache player skill levels
- `MOVEMENT_CLICK_TO_MOVE`: Cancel crafting on movement
- `COMBAT_STARTED`: Cancel crafting on combat
- `PLAYER_UNREGISTERED`: Cleanup on disconnect

#### Emits

- `CRAFTING_INTERFACE_OPEN`: Send available recipes to client
- `CRAFTING_START`: Crafting session started
- `CRAFTING_COMPLETE`: Crafting session completed
- `INVENTORY_ITEM_REMOVED`: Consume materials
- `INVENTORY_ITEM_ADDED`: Add crafted item
- `SKILLS_XP_GAINED`: Grant crafting XP
- `ANIMATION_PLAY`: Play crafting animation
- `UI_MESSAGE`: User feedback messages

### Internal Types

```typescript
interface CraftingSession {
  playerId: string;
  recipeId: string; // Output item ID
  quantity: number;
  crafted: number;
  completionTick: number;
  consumableUses: Map<string, number>; // Thread uses tracking
}

interface InventoryState {
  counts: Map<string, number>;
  itemIds: Set<string>;
}
```

### Mechanics

**Thread Consumption:**
- Thread has 5 uses per item
- Uses tracked in `consumableUses` Map
- New thread consumed when uses depleted
- Crafting stops if no thread available

**Tick-Based Processing:**
- Processes once per game tick (600ms)
- Uses `completionTick` for timing
- Avoids duplicate processing with `lastProcessedTick` guard

**Performance:**
- Single inventory scan per tick
- Reusable arrays for completed sessions
- Pre-allocated inventory state buffer

## FletchingSystem

Tick-based fletching system for bows and arrows with multi-output support.

**Location:** `packages/shared/src/systems/shared/interaction/FletchingSystem.ts`

### Public Methods

#### `isPlayerFletching(playerId: string): boolean`

Check if a player is currently fletching.

**Parameters:**
- `playerId`: Player entity ID

**Returns:** `true` if player has an active fletching session

**Example:**
```typescript
const fletching = fletchingSystem.isPlayerFletching(playerId);
if (fletching) {
  console.log("Player is fletching");
}
```

### Events

#### Subscribes To

- `FLETCHING_INTERACT`: Trigger fletching interaction
- `PROCESSING_FLETCHING_REQUEST`: Start fletching with quantity
- `SKILLS_UPDATED`: Cache player skill levels
- `MOVEMENT_CLICK_TO_MOVE`: Cancel fletching on movement
- `COMBAT_STARTED`: Cancel fletching on combat
- `PLAYER_UNREGISTERED`: Cleanup on disconnect

#### Emits

- `FLETCHING_INTERFACE_OPEN`: Send available recipes to client
- `FLETCHING_START`: Fletching session started
- `FLETCHING_COMPLETE`: Fletching session completed
- `INVENTORY_ITEM_REMOVED`: Consume materials
- `INVENTORY_ITEM_ADDED`: Add fletched items
- `SKILLS_XP_GAINED`: Grant fletching XP
- `ANIMATION_PLAY`: Play fletching animation
- `UI_MESSAGE`: User feedback messages

### Internal Types

```typescript
interface FletchingSession {
  playerId: string;
  recipeId: string; // Unique ID (output:primaryInput)
  quantity: number;
  crafted: number;
  completionTick: number;
}

interface InventoryState {
  counts: Map<string, number>;
  itemIds: Set<string>;
}
```

### Mechanics

**Multi-Output Recipes:**
- `outputQuantity` field in recipe (default: 1)
- Arrow shafts: 15 per log
- Headless arrows: 15 per action
- Arrows: 15 per action

**Item-on-Item Interactions:**
- Bowstring + unstrung bow → strung bow
- Arrowtips + headless arrows → arrows
- Arrow shafts + feathers → headless arrows

**Recipe Filtering:**
- `getFletchingRecipesForInput(itemId)`: Single input (knife + logs)
- `getFletchingRecipesForInputPair(itemA, itemB)`: Both inputs (item-on-item)

## RunecraftingSystem

Instant essence-to-rune conversion system with multi-rune multipliers.

**Location:** `packages/shared/src/systems/shared/interaction/RunecraftingSystem.ts`

### Public Methods

None (instant conversion, no active sessions)

### Events

#### Subscribes To

- `RUNECRAFTING_INTERACT`: Trigger runecrafting interaction
- `SKILLS_UPDATED`: Cache player skill levels
- `PLAYER_UNREGISTERED`: Cleanup on disconnect

#### Emits

- `RUNECRAFTING_COMPLETE`: Runecrafting completed
- `INVENTORY_ITEM_REMOVED`: Consume essence
- `INVENTORY_ITEM_ADDED`: Add runes
- `SKILLS_XP_GAINED`: Grant runecrafting XP
- `UI_MESSAGE`: User feedback messages

### Mechanics

**Instant Conversion:**
- No tick delay (unlike other skills)
- All essence converted in one action
- XP granted per essence consumed

**Multi-Rune Multipliers:**
- Calculated from `multiRuneLevels` array
- Each threshold grants +1 rune per essence
- Example: Air runes at level 22 = 3 runes per essence

**Essence Validation:**
- Basic runes: rune_essence OR pure_essence
- Advanced runes: pure_essence only
- Invalid essence types ignored

## TanningSystem

Instant hide-to-leather conversion system at tanner NPCs.

**Location:** `packages/shared/src/systems/shared/interaction/TanningSystem.ts`

### Public Methods

None (instant conversion, no active sessions)

### Events

#### Subscribes To

- `TANNING_INTERACT`: Trigger tanning interaction
- `TANNING_REQUEST`: Request tanning with quantity
- `PLAYER_UNREGISTERED`: Cleanup on disconnect

#### Emits

- `TANNING_INTERFACE_OPEN`: Send available recipes to client
- `TANNING_COMPLETE`: Tanning completed
- `INVENTORY_ITEM_REMOVED`: Consume hides
- `INVENTORY_REMOVE_COINS`: Deduct tanning cost
- `INVENTORY_ITEM_ADDED`: Add leather
- `UI_MESSAGE`: User feedback messages

### Mechanics

**Instant Conversion:**
- No tick delay
- Coins deducted first, then hides removed, then leather added
- No XP granted (tanning is a service, not a skill)

**Cost Calculation:**
- Total cost = quantity × cost per hide
- If insufficient coins, tans only what player can afford
- Minimum 1 hide if player has any coins

## ProcessingDataProvider

Central data provider for all artisan skill recipes.

**Location:** `packages/shared/src/data/ProcessingDataProvider.ts`

### Singleton Access

```typescript
import { processingDataProvider } from '@/data/ProcessingDataProvider';

// Initialize after DataManager loads manifests
processingDataProvider.initialize();
```

### Crafting Methods

#### `getCraftingRecipe(outputItemId: string): CraftingRecipeData | null`

Get crafting recipe by output item ID.

**Parameters:**
- `outputItemId`: Item ID of crafted item (e.g., "leather_gloves")

**Returns:** Recipe data or null if not found

**Example:**
```typescript
const recipe = processingDataProvider.getCraftingRecipe('leather_gloves');
if (recipe) {
  console.log(`Level ${recipe.level} required, grants ${recipe.xp} XP`);
}
```

#### `getCraftingRecipesByStation(station: string): CraftingRecipeData[]`

Get all crafting recipes for a specific station.

**Parameters:**
- `station`: Station type ("none" or "furnace")

**Returns:** Array of recipes

**Example:**
```typescript
const furnaceRecipes = processingDataProvider.getCraftingRecipesByStation('furnace');
// Returns all jewelry recipes
```

#### `getCraftingRecipesByCategory(category: string): CraftingRecipeData[]`

Get all crafting recipes in a category.

**Parameters:**
- `category`: Category name (leather, dragonhide, jewelry, gem_cutting)

**Returns:** Array of recipes

#### `isCraftableItem(itemId: string): boolean`

Check if an item can be crafted.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item has a crafting recipe

#### `getCraftableItemIds(): Set<string>`

Get all craftable item IDs.

**Returns:** Set of item IDs

#### `getCraftingInputsForTool(toolId: string): Set<string>`

Get valid input items for a crafting tool.

**Parameters:**
- `toolId`: Tool item ID (e.g., "needle", "chisel")

**Returns:** Set of input item IDs

**Example:**
```typescript
const needleInputs = processingDataProvider.getCraftingInputsForTool('needle');
// Returns: Set(['leather', 'green_dragon_leather', ...])
```

#### `isCraftingInput(itemId: string): boolean`

Check if an item is used as input in any crafting recipe.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item is a crafting input

#### `getCraftingToolForInput(inputItemId: string): string | null`

Get the tool required for a crafting input item.

**Parameters:**
- `inputItemId`: Input item ID

**Returns:** Tool item ID or null

### Fletching Methods

#### `getFletchingRecipe(recipeId: string): FletchingRecipeData | null`

Get fletching recipe by unique recipe ID.

**Parameters:**
- `recipeId`: Unique recipe ID (format: "output:primaryInput")

**Returns:** Recipe data or null if not found

**Example:**
```typescript
const recipe = processingDataProvider.getFletchingRecipe('arrow_shaft:logs');
if (recipe) {
  console.log(`Produces ${recipe.outputQuantity} items per action`);
}
```

#### `getFletchingRecipesForInput(inputItemId: string): FletchingRecipeData[]`

Get all fletching recipes using a specific input item.

**Parameters:**
- `inputItemId`: Input item ID (e.g., "logs")

**Returns:** Array of recipes

**Example:**
```typescript
const logRecipes = processingDataProvider.getFletchingRecipesForInput('logs');
// Returns: arrow shafts, shortbow (u), longbow (u)
```

#### `getFletchingRecipesForInputPair(itemA: string, itemB: string): FletchingRecipeData[]`

Get fletching recipes matching both input items (item-on-item).

**Parameters:**
- `itemA`: First item ID
- `itemB`: Second item ID

**Returns:** Array of recipes using both items

**Example:**
```typescript
const recipes = processingDataProvider.getFletchingRecipesForInputPair(
  'bowstring',
  'shortbow_u'
);
// Returns: shortbow stringing recipe
```

#### `getFletchingRecipesByCategory(category: string): FletchingRecipeData[]`

Get all fletching recipes in a category.

**Parameters:**
- `category`: Category name (arrow_shafts, headless_arrows, arrows, shortbows, longbows, stringing)

**Returns:** Array of recipes

#### `isFletchableItem(itemId: string): boolean`

Check if an item can be fletched.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item has a fletching recipe

#### `getFletchableItemIds(): Set<string>`

Get all fletchable item IDs.

**Returns:** Set of item IDs

#### `getFletchingInputsForTool(toolId: string): Set<string>`

Get valid input items for a fletching tool.

**Parameters:**
- `toolId`: Tool item ID (e.g., "knife")

**Returns:** Set of input item IDs

#### `isFletchingInput(itemId: string): boolean`

Check if an item is used as input in any fletching recipe.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item is a fletching input

#### `getFletchingToolForInput(inputItemId: string): string | null`

Get the tool required for a fletching input item.

**Parameters:**
- `inputItemId`: Input item ID

**Returns:** Tool item ID or null (null for no-tool recipes like stringing)

### Runecrafting Methods

#### `getRunecraftingRecipe(runeType: string): RunecraftingRecipeData | null`

Get runecrafting recipe by rune type.

**Parameters:**
- `runeType`: Rune type identifier (e.g., "air", "mind", "water")

**Returns:** Recipe data or null if not found

**Example:**
```typescript
const recipe = processingDataProvider.getRunecraftingRecipe('air');
if (recipe) {
  console.log(`Level ${recipe.levelRequired} required, ${recipe.xpPerEssence} XP per essence`);
}
```

#### `getRunecraftingMultiplier(runeType: string, level: number): number`

Calculate multi-rune multiplier for a given rune type and level.

**Parameters:**
- `runeType`: Rune type identifier
- `level`: Player's runecrafting level

**Returns:** Number of runes produced per essence

**Example:**
```typescript
const multiplier = processingDataProvider.getRunecraftingMultiplier('air', 22);
// Returns: 3 (at level 22, you get 3 air runes per essence)
```

**Formula:**
```
multiplier = 1 + (number of thresholds in multiRuneLevels where level >= threshold)
```

#### `getAllRunecraftingRecipes(): RunecraftingRecipeData[]`

Get all runecrafting recipes.

**Returns:** Array of all recipes

#### `isRunecraftingEssence(itemId: string): boolean`

Check if an item is a valid runecrafting essence.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item is rune_essence or pure_essence

### Tanning Methods

#### `getTanningRecipe(inputItemId: string): TanningRecipeData | null`

Get tanning recipe by input hide item ID.

**Parameters:**
- `inputItemId`: Hide item ID (e.g., "cowhide")

**Returns:** Recipe data or null if not found

**Example:**
```typescript
const recipe = processingDataProvider.getTanningRecipe('cowhide');
if (recipe) {
  console.log(`Costs ${recipe.cost} coins, produces ${recipe.output}`);
}
```

#### `getAllTanningRecipes(): TanningRecipeData[]`

Get all tanning recipes.

**Returns:** Array of all recipes

#### `isTannableItem(itemId: string): boolean`

Check if an item can be tanned.

**Parameters:**
- `itemId`: Item ID to check

**Returns:** `true` if item has a tanning recipe

### Utility Methods

#### `initialize(): void`

Initialize the data provider by building lookup tables from manifests.

**Must be called after DataManager loads manifests.**

**Example:**
```typescript
// In server startup
await dataManager.initialize();
processingDataProvider.initialize();
```

#### `rebuild(): void`

Rebuild all lookup tables (for hot-reload scenarios).

**Example:**
```typescript
// After manifest hot-reload
processingDataProvider.rebuild();
```

#### `isReady(): boolean`

Check if provider is initialized.

**Returns:** `true` if initialized

#### `getSummary(): object`

Get summary of loaded recipes for debugging.

**Returns:**
```typescript
{
  cookableItems: number;
  burnableLogs: number;
  smeltableBars: number;
  smithingRecipes: number;
  craftingRecipes: number;
  tanningRecipes: number;
  fletchingRecipes: number;
  runecraftingRecipes: number;
  isInitialized: boolean;
}
```

## Event Types

### Crafting Events

#### `CRAFTING_INTERACT`

Trigger crafting interaction (player used tool on item or clicked furnace).

**Payload:**
```typescript
{
  playerId: string;
  triggerType: string; // "needle", "chisel", "furnace"
  stationId?: string;
  inputItemId?: string;
}
```

#### `PROCESSING_CRAFTING_REQUEST`

Request to start crafting with quantity.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string; // Output item ID
  quantity: number;
}
```

#### `CRAFTING_INTERFACE_OPEN`

Server sends available recipes to client.

**Payload:**
```typescript
{
  playerId: string;
  availableRecipes: Array<{
    output: string;
    name: string;
    category: string;
    inputs: Array<{ item: string; amount: number }>;
    tools: string[];
    level: number;
    xp: number;
    meetsLevel: boolean;
    hasInputs: boolean;
  }>;
  station: string;
}
```

#### `CRAFTING_START`

Crafting session started.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string;
}
```

#### `CRAFTING_COMPLETE`

Crafting session completed.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

### Fletching Events

#### `FLETCHING_INTERACT`

Trigger fletching interaction (player used knife on logs or item-on-item).

**Payload:**
```typescript
{
  playerId: string;
  triggerType: string; // "knife" or "item_on_item"
  inputItemId: string;
  secondaryItemId?: string;
}
```

#### `PROCESSING_FLETCHING_REQUEST`

Request to start fletching with quantity.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string; // Unique ID (output:primaryInput)
  quantity: number;
}
```

#### `FLETCHING_INTERFACE_OPEN`

Server sends available recipes to client.

**Payload:**
```typescript
{
  playerId: string;
  availableRecipes: Array<{
    recipeId: string;
    output: string;
    name: string;
    category: string;
    outputQuantity: number;
    inputs: Array<{ item: string; amount: number }>;
    tools: string[];
    level: number;
    xp: number;
    meetsLevel: boolean;
    hasInputs: boolean;
  }>;
}
```

#### `FLETCHING_START`

Fletching session started.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string;
}
```

#### `FLETCHING_COMPLETE`

Fletching session completed.

**Payload:**
```typescript
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

### Runecrafting Events

#### `RUNECRAFTING_INTERACT`

Trigger runecrafting interaction (player clicked altar).

**Payload:**
```typescript
{
  playerId: string;
  altarId: string;
  runeType: string; // "air", "mind", "water", etc.
}
```

#### `RUNECRAFTING_COMPLETE`

Runecrafting completed.

**Payload:**
```typescript
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

#### `TANNING_INTERACT`

Trigger tanning interaction (player talked to tanner NPC).

**Payload:**
```typescript
{
  playerId: string;
  npcId: string;
}
```

#### `TANNING_REQUEST`

Request tanning with quantity.

**Payload:**
```typescript
{
  playerId: string;
  inputItemId: string; // Hide item ID
  quantity: number;
}
```

#### `TANNING_INTERFACE_OPEN`

Server sends available recipes to client.

**Payload:**
```typescript
{
  playerId: string;
  availableRecipes: Array<{
    input: string;
    output: string;
    cost: number;
    name: string;
    hasHide: boolean;
    hideCount: number;
  }>;
}
```

#### `TANNING_COMPLETE`

Tanning completed.

**Payload:**
```typescript
{
  playerId: string;
  inputItemId: string;
  outputItemId: string;
  totalTanned: number;
  totalCost: number;
}
```

## Recipe Manifest Schemas

### Crafting Recipe Schema

**File:** `packages/server/world/assets/manifests/recipes/crafting.json`

```typescript
interface CraftingRecipeManifest {
  output: string; // Item ID of crafted item
  category: string; // UI grouping (leather, dragonhide, jewelry, gem_cutting)
  inputs: Array<{
    item: string; // Item ID
    amount: number; // Quantity consumed per craft
  }>;
  tools: string[]; // Item IDs required in inventory (not consumed)
  consumables: Array<{
    item: string; // Item ID (e.g., "thread")
    uses: number; // Uses before consumed (e.g., 5)
  }>;
  level: number; // Crafting level required (1-99)
  xp: number; // XP granted per item made
  ticks: number; // Time in game ticks (600ms per tick)
  station: string; // Required station ("none" or "furnace")
}
```

**Validation Rules:**
- `output`: Must exist in items manifest
- `category`: Non-empty string
- `inputs`: Non-empty array, each item must exist in manifest
- `tools`: Array (can be empty), each item must exist in manifest
- `consumables`: Array (can be empty), each item must exist in manifest
- `level`: Integer 1-99
- `xp`: Positive number
- `ticks`: Positive integer
- `station`: Must be "none" or "furnace"

### Fletching Recipe Schema

**File:** `packages/server/world/assets/manifests/recipes/fletching.json`

```typescript
interface FletchingRecipeManifest {
  output: string; // Item ID of fletched item
  outputQuantity: number; // Items produced per action (default: 1)
  category: string; // UI grouping (arrow_shafts, headless_arrows, arrows, shortbows, longbows, stringing)
  inputs: Array<{
    item: string; // Item ID
    amount: number; // Quantity consumed per action
  }>;
  tools: string[]; // Item IDs required in inventory (empty for stringing)
  level: number; // Fletching level required (1-99)
  xp: number; // XP granted per action (total for all outputQuantity items)
  ticks: number; // Time in game ticks (600ms per tick)
  skill: string; // Must be "fletching"
}
```

**Validation Rules:**
- `output`: Must exist in items manifest
- `outputQuantity`: Positive integer (default: 1)
- `category`: Non-empty string
- `inputs`: Non-empty array, each item must exist in manifest
- `tools`: Array (can be empty for stringing), each item must exist in manifest
- `level`: Integer 1-99
- `xp`: Positive number
- `ticks`: Positive integer
- `skill`: Must be "fletching"

### Runecrafting Recipe Schema

**File:** `packages/server/world/assets/manifests/recipes/runecrafting.json`

```typescript
interface RunecraftingRecipeManifest {
  runeType: string; // Unique identifier (air, mind, water, etc.)
  runeItemId: string; // Item ID of output rune
  levelRequired: number; // Runecrafting level required (1-99)
  xpPerEssence: number; // XP granted per essence consumed
  essenceTypes: string[]; // Valid essence item IDs
  multiRuneLevels: number[]; // Levels at which multiplier increases
}
```

**Validation Rules:**
- `runeType`: Non-empty string, unique
- `runeItemId`: Must exist in items manifest
- `levelRequired`: Integer 1-99
- `xpPerEssence`: Positive number
- `essenceTypes`: Non-empty array of item IDs
- `multiRuneLevels`: Array of integers (can be empty), sorted ascending

### Tanning Recipe Schema

**File:** `packages/server/world/assets/manifests/recipes/tanning.json`

```typescript
interface TanningRecipeManifest {
  input: string; // Hide item ID
  output: string; // Leather item ID
  cost: number; // Coin cost per hide
  name: string; // Display name
}
```

**Validation Rules:**
- `input`: Must exist in items manifest
- `output`: Must exist in items manifest
- `cost`: Non-negative integer
- `name`: Non-empty string

## Recipe Data Types

### CraftingRecipeData

```typescript
interface CraftingRecipeData {
  output: string; // Item ID
  name: string; // Display name
  category: string; // UI grouping
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  consumables: Array<{ item: string; uses: number }>;
  level: number;
  xp: number;
  ticks: number;
  station: string;
}
```

### FletchingRecipeData

```typescript
interface FletchingRecipeData {
  recipeId: string; // Unique ID (output:primaryInput)
  output: string; // Item ID
  name: string; // Display name
  outputQuantity: number; // Items per action
  category: string; // UI grouping
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  ticks: number;
}
```

### RunecraftingRecipeData

```typescript
interface RunecraftingRecipeData {
  runeType: string; // Unique identifier
  runeItemId: string; // Item ID
  name: string; // Display name
  levelRequired: number;
  xpPerEssence: number;
  essenceTypes: string[];
  multiRuneLevels: number[]; // Sorted ascending
}
```

### TanningRecipeData

```typescript
interface TanningRecipeData {
  input: string; // Hide item ID
  output: string; // Leather item ID
  cost: number; // Coin cost
  name: string; // Display name
}
```

## Usage Examples

### Starting a Crafting Session

```typescript
// Player uses needle on leather
world.emit(EventType.CRAFTING_INTERACT, {
  playerId: 'player123',
  triggerType: 'needle',
  inputItemId: 'leather',
});

// Server responds with available recipes
// Player selects "leather_gloves" and quantity 10

// Client sends crafting request
world.emit(EventType.PROCESSING_CRAFTING_REQUEST, {
  playerId: 'player123',
  recipeId: 'leather_gloves',
  quantity: 10,
});

// Server starts crafting session
// Emits CRAFTING_START event
// Processes tick-by-tick until complete or cancelled
// Emits CRAFTING_COMPLETE when done
```

### Starting a Fletching Session

```typescript
// Player uses knife on logs
world.emit(EventType.FLETCHING_INTERACT, {
  playerId: 'player123',
  triggerType: 'knife',
  inputItemId: 'logs',
});

// Server responds with available recipes
// Player selects "arrow_shaft:logs" and quantity 5

// Client sends fletching request
world.emit(EventType.PROCESSING_FLETCHING_REQUEST, {
  playerId: 'player123',
  recipeId: 'arrow_shaft:logs',
  quantity: 5, // 5 actions = 75 arrow shafts (5 × 15)
});

// Server starts fletching session
// Processes tick-by-tick until complete
```

### Runecrafting at Altar

```typescript
// Player clicks air altar with rune essence in inventory
world.emit(EventType.RUNECRAFTING_INTERACT, {
  playerId: 'player123',
  altarId: 'air_altar_1',
  runeType: 'air',
});

// Server instantly converts all essence to runes
// Emits RUNECRAFTING_COMPLETE with results
```

### Tanning Hides

```typescript
// Player talks to tanner NPC
world.emit(EventType.TANNING_INTERACT, {
  playerId: 'player123',
  npcId: 'tanner_1',
});

// Server responds with available recipes
// Player selects "cowhide" and quantity 10

// Client sends tanning request
world.emit(EventType.TANNING_REQUEST, {
  playerId: 'player123',
  inputItemId: 'cowhide',
  quantity: 10,
});

// Server instantly converts hides to leather
// Deducts 10 coins (1 per hide)
// Emits TANNING_COMPLETE
```

## Error Handling

### Common Errors

**Invalid Recipe:**
```typescript
const recipe = processingDataProvider.getCraftingRecipe('invalid_item');
// Returns: null
```

**Insufficient Level:**
```typescript
// CraftingSystem emits UI_MESSAGE
{
  playerId: 'player123',
  message: 'You need level 10 Crafting to make that.',
  type: 'error'
}
```

**Missing Materials:**
```typescript
// CraftingSystem emits UI_MESSAGE
{
  playerId: 'player123',
  message: "You don't have the required materials.",
  type: 'error'
}
```

**Missing Tools:**
```typescript
// CraftingSystem emits UI_MESSAGE
{
  playerId: 'player123',
  message: 'You need a needle to craft that.',
  type: 'error'
}
```

**Out of Thread:**
```typescript
// CraftingSystem emits UI_MESSAGE
{
  playerId: 'player123',
  message: 'You have run out of thread.',
  type: 'info'
}
```

## Performance Considerations

### Memory Usage

**Per Active Session:**
- CraftingSession: ~200 bytes (includes consumableUses Map)
- FletchingSession: ~150 bytes
- RunecraftingSystem: No active sessions (instant)

**Recipe Data:**
- Crafting: ~30 recipes × ~500 bytes = ~15KB
- Fletching: ~37 recipes × ~400 bytes = ~15KB
- Runecrafting: ~11 recipes × ~300 bytes = ~3KB
- Total: ~33KB for all recipe data

### CPU Usage

**Tick Processing:**
- CraftingSystem: O(n) where n = active sessions
- FletchingSystem: O(n) where n = active sessions
- RunecraftingSystem: No tick processing

**Inventory Scans:**
- Single scan per tick per active session
- Pre-allocated buffers to avoid allocations
- Reusable arrays for completed sessions

### Optimizations

**Inventory State Caching:**
```typescript
// Build once, use for all checks
const invState = this.getInventoryState(playerId);
if (!this.hasRequiredTools(invState, recipe)) return;
if (!this.hasRequiredInputs(invState, recipe)) return;
```

**Once-Per-Tick Processing:**
```typescript
if (currentTick === this.lastProcessedTick) return;
this.lastProcessedTick = currentTick;
```

**Pre-Allocated Buffers:**
```typescript
private readonly completedPlayerIds: string[] = [];
private readonly inventoryCountBuffer = new Map<string, number>();
```

## Security

### Rate Limiting

All artisan skill interactions are rate-limited:

```typescript
// From IntervalRateLimiter
crafting_interact: 500ms per request
fletching_interact: 500ms per request
runecrafting_interact: 500ms per request
```

### Audit Logging

All completions are logged for economic tracking:

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

**Recipe ID Validation:**
- Must exist in recipe map
- Must match expected format

**Quantity Validation:**
- Must be positive integer
- Clamped to available materials

**Level Validation:**
- Checked before starting session
- Re-checked on each craft action

**Material Validation:**
- Checked before starting session
- Re-checked on each craft action
- Prevents crafting with insufficient materials

## Testing

### Unit Tests

**CraftingSystem:**
- `CraftingSystem.test.ts`: 19 tests covering lifecycle, cancellation, edge cases

**FletchingSystem:**
- `FletchingSystem.test.ts`: 15 tests covering multi-output, item-on-item, cancellation

**RunecraftingSystem:**
- `RunecraftingSystem.test.ts`: 12 tests covering multipliers, essence validation, levels

**ProcessingDataProvider:**
- `ProcessingDataProvider.test.ts`: 25 tests covering recipe loading, filtering, validation

### Integration Tests

**Crafting Flow:**
1. Player uses needle on leather
2. Server sends available recipes
3. Player selects recipe and quantity
4. Server starts crafting session
5. Tick-by-tick processing
6. Materials consumed, items added, XP granted
7. Session completes

**Fletching Flow:**
1. Player uses knife on logs
2. Server sends available recipes (arrow shafts, bows)
3. Player selects arrow shafts and quantity 5
4. Server starts fletching session
5. Each action produces 15 arrow shafts
6. Total: 75 arrow shafts after 5 actions

**Runecrafting Flow:**
1. Player clicks air altar with 100 rune essence
2. Server calculates multiplier (e.g., 3x at level 22)
3. Server converts all essence instantly
4. Player receives 300 air runes
5. Player gains 500 XP (100 essence × 5 XP)

## License

GPL-3.0-only - See LICENSE file
