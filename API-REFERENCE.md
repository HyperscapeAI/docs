# API Reference - Skills and Processing Systems

This document provides detailed API reference for the skills and processing systems added in recent updates.

## Table of Contents

- [SkillsSystem](#skillssystem)
- [ProcessingDataProvider](#processingdataprovider)
- [CraftingSystem](#craftingsystem)
- [FletchingSystem](#fletchingsystem)
- [RunecraftingSystem](#runecraftingsystem)
- [RunecraftingAltarEntity](#runecraftingaltarentity)
- [Event Types](#event-types)

---

## SkillsSystem

**Location**: `packages/shared/src/systems/shared/character/SkillsSystem.ts`

**Purpose**: Manages XP tracking, level calculation, and skill progression for all 17 skills.

### Constants

```typescript
export const Skill = {
  ATTACK: "attack",
  STRENGTH: "strength",
  DEFENSE: "defense",
  RANGE: "ranged",
  MAGIC: "magic",
  CONSTITUTION: "constitution",
  PRAYER: "prayer",
  WOODCUTTING: "woodcutting",
  MINING: "mining",
  FISHING: "fishing",
  FIREMAKING: "firemaking",
  COOKING: "cooking",
  SMITHING: "smithing",
  AGILITY: "agility",
  CRAFTING: "crafting",
  FLETCHING: "fletching",
  RUNECRAFTING: "runecrafting",
};
```

### Methods

#### `grantXP(entityId: string, skill: keyof Skills, amount: number): void`

Grant XP to a specific skill. Automatically handles level-ups and combat level updates.

**Parameters**:
- `entityId` - Entity ID (usually player ID)
- `skill` - Skill name (use `Skill` constants)
- `amount` - XP amount to grant

**Example**:
```typescript
const skillsSystem = world.getSystem('skills') as SkillsSystem;
skillsSystem.grantXP(playerId, Skill.FLETCHING, 5);
```

#### `getLevelForXP(xp: number): number`

Get the level for a given XP amount using OSRS XP table.

**Parameters**:
- `xp` - XP amount

**Returns**: Level (1-99)

**Example**:
```typescript
const level = skillsSystem.getLevelForXP(13034); // 30
```

#### `getXPForLevel(level: number): number`

Get the XP required for a specific level.

**Parameters**:
- `level` - Target level (1-99)

**Returns**: XP required

**Example**:
```typescript
const xp = skillsSystem.getXPForLevel(50); // 101333
```

#### `getXPToNextLevel(skill: SkillData): number`

Get XP remaining to next level.

**Parameters**:
- `skill` - Skill data object `{ level: number, xp: number }`

**Returns**: XP remaining

#### `getXPProgress(skill: SkillData): number`

Get XP progress percentage to next level.

**Parameters**:
- `skill` - Skill data object

**Returns**: Progress percentage (0-100)

#### `meetsRequirements(entity: Entity, requirements: Partial<Record<keyof Skills, number>>): boolean`

Check if entity meets skill level requirements.

**Parameters**:
- `entity` - Entity to check
- `requirements` - Object mapping skills to required levels

**Returns**: `true` if all requirements met

**Example**:
```typescript
const canSmith = skillsSystem.meetsRequirements(player, {
  smithing: 40,
  mining: 30
});
```

#### `getCombatLevel(stats: StatsComponent): number`

Calculate combat level from combat skills using OSRS formula.

**Parameters**:
- `stats` - Stats component with skill data

**Returns**: Combat level

#### `getTotalLevel(stats: StatsComponent): number`

Calculate total level (sum of all skill levels).

**Parameters**:
- `stats` - Stats component with skill data

**Returns**: Total level (max 1683)

#### `getSkills(entityId: string): Skills | undefined`

Get all skills for an entity.

**Parameters**:
- `entityId` - Entity ID

**Returns**: Skills object or undefined

---

## ProcessingDataProvider

**Location**: `packages/shared/src/data/ProcessingDataProvider.ts`

**Purpose**: Centralized recipe data provider for all processing skills. Loads recipes from JSON manifests.

### Singleton Access

```typescript
import { processingDataProvider } from '@hyperscape/shared';
```

### Initialization

```typescript
// Called automatically by DataManager
processingDataProvider.initialize();

// Check if ready
if (processingDataProvider.isReady()) {
  // Use provider
}
```

### Cooking Methods

#### `isCookable(itemId: string): boolean`

Check if an item can be cooked.

#### `getCookingData(rawItemId: string): CookingItemData | null`

Get cooking data for a raw food item.

**Returns**:
```typescript
{
  rawItemId: string;
  cookedItemId: string;
  burntItemId: string;
  levelRequired: number;
  xp: number;
  stopBurnLevel: { fire: number; range: number };
}
```

#### `getCookableItemIds(): Set<string>`

Get all cookable item IDs.

#### `getCookedItemId(rawItemId: string): string | null`

Get cooked item ID for a raw food.

#### `getBurntItemId(rawItemId: string): string | null`

Get burnt item ID for a raw food.

#### `getCookingLevel(rawItemId: string): number`

Get cooking level requirement.

#### `getCookingXP(rawItemId: string): number`

Get cooking XP reward.

#### `getStopBurnLevel(rawItemId: string, source: 'fire' | 'range'): number`

Get stop-burn level for a cooking source.

### Smithing Methods

#### `isSmithableItem(itemId: string): boolean`

Check if an item can be smithed.

#### `getSmithingRecipe(itemId: string): SmithingRecipeData | null`

Get smithing recipe for an output item.

**Returns**:
```typescript
{
  itemId: string;
  name: string;
  barType: string;
  barsRequired: number;
  levelRequired: number;
  xp: number;
  category: SmithingCategory;
  ticks: number;
  outputQuantity: number; // 1 for most items, 15 for arrowtips
}
```

#### `getSmithingRecipesForBar(barType: string): SmithingRecipeData[]`

Get all recipes that use a specific bar type.

#### `getSmithingRecipesByCategory(barType: string): Map<SmithingCategory, SmithingRecipeData[]>`

Get recipes grouped by category for a bar type.

#### `getAvailableSmithingRecipes(smithingLevel: number): SmithingRecipeData[]`

Get all recipes the player can make with their level.

#### `getSmithableItemsWithAvailability(inventory: Array<{itemId: string, quantity?: number}>, smithingLevel: number): SmithingRecipeWithAvailability[]`

Get all smithable items with availability flags for UI display.

**Returns**:
```typescript
{
  ...SmithingRecipeData,
  meetsLevel: boolean; // Player has sufficient level
  hasBars: boolean;    // Player has enough bars
}
```

### Smelting Methods

#### `isSmeltableBar(itemId: string): boolean`

Check if an item is a smeltable bar.

#### `isSmeltableOre(itemId: string): boolean`

Check if an item is an ore that can be used for smelting.

#### `getSmeltingData(barItemId: string): SmeltingItemData | null`

Get smelting data for a bar.

**Returns**:
```typescript
{
  barItemId: string;
  primaryOre: string;
  secondaryOre: string | null;
  coalRequired: number;
  levelRequired: number;
  xp: number;
  successRate: number;
  ticks: number;
}
```

#### `getSmeltableBarsFromInventory(inventory: Array<{itemId: string, quantity?: number}>, smithingLevel: number): SmeltingItemData[]`

Get all bars that can be smelted from inventory items.

### Crafting Methods

#### `isCraftableItem(itemId: string): boolean`

Check if an item can be crafted.

#### `getCraftingRecipe(outputItemId: string): CraftingRecipeData | null`

Get crafting recipe for an output item.

**Returns**:
```typescript
{
  output: string;
  name: string;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  consumables: Array<{ item: string; uses: number }>;
  level: number;
  xp: number;
  ticks: number;
  station: string; // "none" or "furnace"
}
```

#### `getCraftingRecipesByCategory(category: string): CraftingRecipeData[]`

Get all recipes in a category.

**Categories**: leather, studded, dragonhide, jewelry, gem_cutting

#### `getCraftingRecipesByStation(station: string): CraftingRecipeData[]`

Get all recipes that require a specific station.

**Stations**: "none", "furnace"

#### `getCraftingInputsForTool(toolId: string): Set<string>`

Get valid input item IDs for a tool.

**Example**:
```typescript
const needleInputs = processingDataProvider.getCraftingInputsForTool('needle');
// Returns: Set(['leather', 'green_dragon_leather', ...])
```

#### `isCraftingInput(itemId: string): boolean`

Check if an item is used as input in any crafting recipe.

#### `getCraftingToolForInput(inputItemId: string): string | null`

Get the tool required for a crafting input item.

### Fletching Methods

#### `isFletchableItem(itemId: string): boolean`

Check if an item can be fletched.

#### `getFletchingRecipe(recipeId: string): FletchingRecipeData | null`

Get fletching recipe by unique recipe ID (format: `output:primaryInput`).

**Returns**:
```typescript
{
  recipeId: string;
  output: string;
  name: string;
  outputQuantity: number; // 1 for bows, 15 for arrow shafts
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  ticks: number;
}
```

**Categories**: arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows

#### `getFletchingRecipesForInput(inputItemId: string): FletchingRecipeData[]`

Get all recipes that use a specific input item.

**Example**:
```typescript
const logRecipes = processingDataProvider.getFletchingRecipesForInput('logs');
// Returns recipes for arrow shafts, shortbow_u, etc.
```

#### `getFletchingRecipesForInputPair(itemA: string, itemB: string): FletchingRecipeData[]`

Get recipes that require BOTH input items (for item-on-item interactions).

**Example**:
```typescript
const stringRecipes = processingDataProvider.getFletchingRecipesForInputPair(
  'shortbow_u',
  'bowstring'
);
// Returns stringing recipe
```

#### `getFletchingInputsForTool(toolId: string): Set<string>`

Get valid input item IDs for a tool.

**Example**:
```typescript
const knifeInputs = processingDataProvider.getFletchingInputsForTool('knife');
// Returns: Set(['logs', 'oak_logs', 'willow_logs', ...])
```

#### `isFletchingInput(itemId: string): boolean`

Check if an item is used as input in any fletching recipe.

#### `getFletchingToolForInput(inputItemId: string): string | null`

Get the tool required for a fletching input item.

### Runecrafting Methods

#### `getRunecraftingRecipe(runeType: string): RunecraftingRecipeData | null`

Get runecrafting recipe by rune type.

**Parameters**:
- `runeType` - Rune type identifier (e.g., "air", "water", "chaos")

**Returns**:
```typescript
{
  runeType: string;
  runeItemId: string;
  name: string;
  levelRequired: number;
  xpPerEssence: number;
  essenceTypes: string[]; // ["rune_essence", "pure_essence"]
  multiRuneLevels: number[]; // Sorted ascending
}
```

#### `isRunecraftingEssence(itemId: string): boolean`

Check if an item is runecrafting essence.

#### `getRunecraftingMultiplier(runeType: string, level: number): number`

Calculate multi-rune multiplier for a rune type and level.

**Returns**: Number of runes produced per essence (1-10)

**Example**:
```typescript
const multiplier = processingDataProvider.getRunecraftingMultiplier('air', 22);
// Returns: 3 (base 1 + thresholds at 11 and 22)
```

**Multi-Rune Thresholds** (OSRS-accurate):
- Air: 11, 22, 33, 44, 55, 66, 77, 88, 99
- Water: 19, 38, 57, 76, 95
- Earth: 26, 52, 78
- Fire: 35, 70
- Mind: 14, 28, 42, 56, 70, 84, 98
- Body: 46, 92
- Cosmic: 59
- Chaos: 74
- Nature: 91
- Law: None (always 1)
- Death: None (always 1)
- Blood: None (always 1)

### Tanning Methods

#### `getTanningRecipe(inputItemId: string): TanningRecipeData | null`

Get tanning recipe by input hide item ID.

**Returns**:
```typescript
{
  input: string;
  output: string;
  cost: number;
  name: string;
}
```

#### `isTannableItem(itemId: string): boolean`

Check if an item can be tanned.

#### `getAllTanningRecipes(): TanningRecipeData[]`

Get all tanning recipes.

### Utility Methods

#### `getSummary(): object`

Get summary of loaded recipes for debugging.

**Returns**:
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

---

## CraftingSystem

**Location**: `packages/shared/src/systems/shared/interaction/CraftingSystem.ts`

**Purpose**: Handles crafting skill (leather armor, jewelry, gem cutting).

### Features

- Tick-based processing (3 ticks default)
- Thread consumable with 5 uses
- Station support (none, furnace)
- Category grouping (leather, studded, dragonhide, jewelry, gem_cutting)
- Movement/combat cancellation
- Server-authoritative validation

### Events Listened

- `CRAFTING_INTERACT` - Player used needle/chisel/gold bar
- `PROCESSING_CRAFTING_REQUEST` - Player selected recipe and quantity
- `SKILLS_UPDATED` - Cache player skill levels
- `MOVEMENT_CLICK_TO_MOVE` - Cancel crafting on movement
- `COMBAT_STARTED` - Cancel crafting on combat
- `PLAYER_UNREGISTERED` - Clean up on disconnect

### Events Emitted

- `CRAFTING_INTERFACE_OPEN` - Show available recipes to player
- `CRAFTING_START` - Crafting session started
- `CRAFTING_COMPLETE` - Crafting session completed
- `INVENTORY_ITEM_REMOVED` - Materials consumed
- `INVENTORY_ITEM_ADDED` - Crafted item added
- `SKILLS_XP_GAINED` - XP granted
- `ANIMATION_PLAY` - Crafting animation
- `UI_MESSAGE` - Feedback messages

### Methods

#### `isPlayerCrafting(playerId: string): boolean`

Check if a player is currently crafting.

### Session Flow

```
1. Player clicks needle on leather
   → CRAFTING_INTERACT

2. System validates and emits CRAFTING_INTERFACE_OPEN
   → Client shows CraftingPanel

3. Player selects recipe and quantity
   → PROCESSING_CRAFTING_REQUEST

4. System creates session with completionTick

5. Every tick, check if currentTick >= completionTick
   → If yes, complete one craft action

6. On completion:
   - Consume materials
   - Decrement thread uses (consume thread every 5 crafts)
   - Add crafted item
   - Grant XP
   - Play animation
   - Schedule next craft or complete session

7. Cancel on movement/combat
```

---

## FletchingSystem

**Location**: `packages/shared/src/systems/shared/interaction/FletchingSystem.ts`

**Purpose**: Handles fletching skill (bows, arrows, arrow shafts).

### Features

- Tick-based processing (2-3 ticks)
- Multi-output support (15 arrow shafts per log, 15 arrows per set)
- Item-on-item interactions (bowstring + unstrung bow, arrowtips + headless arrows)
- Category grouping (arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows)
- Movement/combat cancellation
- Server-authoritative validation

### Events Listened

- `FLETCHING_INTERACT` - Player used knife on logs or item-on-item
- `PROCESSING_FLETCHING_REQUEST` - Player selected recipe and quantity
- `SKILLS_UPDATED` - Cache player skill levels
- `MOVEMENT_CLICK_TO_MOVE` - Cancel fletching on movement
- `COMBAT_STARTED` - Cancel fletching on combat
- `PLAYER_UNREGISTERED` - Clean up on disconnect

### Events Emitted

- `FLETCHING_INTERFACE_OPEN` - Show available recipes to player
- `FLETCHING_START` - Fletching session started
- `FLETCHING_COMPLETE` - Fletching session completed
- `INVENTORY_ITEM_REMOVED` - Materials consumed
- `INVENTORY_ITEM_ADDED` - Fletched items added (with outputQuantity)
- `SKILLS_XP_GAINED` - XP granted
- `ANIMATION_PLAY` - Crafting animation
- `UI_MESSAGE` - Feedback messages

### Methods

#### `isPlayerFletching(playerId: string): boolean`

Check if a player is currently fletching.

### Multi-Output Handling

Fletching supports multi-output recipes where one action produces multiple items:

**Example**: Arrow Shafts
- Input: 1 log
- Output: 15 arrow shafts
- XP: 5 (total for all 15 shafts)
- Ticks: 2

**Implementation**:
```typescript
// Add fletched items with outputQuantity
this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
  playerId,
  item: {
    id: `fletch_${playerId}_${++this.fletchCounter}_${Date.now()}`,
    itemId: recipe.output,
    quantity: recipe.outputQuantity, // 15 for arrow shafts
    slot: -1,
    metadata: null,
  },
});
```

---

## RunecraftingSystem

**Location**: `packages/shared/src/systems/shared/interaction/RunecraftingSystem.ts`

**Purpose**: Handles runecrafting skill (essence → runes at altars).

### Features

- **Instant processing** (no tick delay)
- Multi-rune multiplier at higher levels
- Converts ALL essence in inventory at once
- Two essence types: rune_essence (basic runes), pure_essence (all runes)
- Server-authoritative validation

### Events Listened

- `RUNECRAFTING_INTERACT` - Player clicked altar
- `SKILLS_UPDATED` - Cache player skill levels
- `PLAYER_UNREGISTERED` - Clean up on disconnect

### Events Emitted

- `RUNECRAFTING_COMPLETE` - Runes crafted
- `INVENTORY_ITEM_REMOVED` - Essence consumed
- `INVENTORY_ITEM_ADDED` - Runes added
- `SKILLS_XP_GAINED` - XP granted
- `UI_MESSAGE` - Feedback messages

### Processing Flow

```
1. Player clicks air altar
   → RUNECRAFTING_INTERACT { runeType: "air" }

2. System validates:
   - Recipe exists for rune type
   - Player meets level requirement
   - Player has valid essence in inventory

3. Count all essence in inventory (rune_essence + pure_essence)

4. Calculate multiplier based on player level
   - Level 1-10: 1 rune per essence
   - Level 11-21: 2 runes per essence
   - Level 22-32: 3 runes per essence
   - etc.

5. Instantly:
   - Remove ALL essence from inventory
   - Add (essence count * multiplier) runes
   - Grant (essence count * xpPerEssence) XP
   - Emit RUNECRAFTING_COMPLETE

6. Show success message with multiplier info
```

**Example**:
```
Player has 28 rune essence, level 22 runecrafting
Clicks air altar
→ Removes 28 rune essence
→ Adds 84 air runes (28 * 3)
→ Grants 140 XP (28 * 5)
→ Message: "You craft 84 air runes (3x multiplier)."
```

---

## RunecraftingAltarEntity

**Location**: `packages/shared/src/entities/world/RunecraftingAltarEntity.ts`

**Purpose**: Interactable altar entity for runecrafting.

### Constructor

```typescript
new RunecraftingAltarEntity(world: World, config: RunecraftingAltarEntityConfig)
```

**Config**:
```typescript
{
  id: string;
  name?: string; // Default: "{RuneType} Altar"
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  footprint?: FootprintSpec; // Collision footprint
  runeType: string; // "air", "water", "fire", etc.
}
```

### Properties

- `entityType`: "runecrafting_altar"
- `isInteractable`: true
- `isPermanent`: true
- `displayName`: Display name (e.g., "Air Altar")
- `runeType`: Rune type this altar produces

### Methods

#### `handleInteraction(data: EntityInteractionData): Promise<void>`

Handle altar interaction. Emits `RUNECRAFTING_INTERACT` event.

#### `getContextMenuActions(playerId: string): Array<{id, label, priority, handler}>`

Get context menu actions.

**Returns**:
```typescript
[
  {
    id: "craft_rune",
    label: "Craft-rune",
    priority: 1,
    handler: () => { /* Emit RUNECRAFTING_INTERACT */ }
  },
  {
    id: "examine",
    label: "Examine",
    priority: 100,
    handler: () => { /* Show examine text */ }
  }
]
```

### Visual Effects

**Mystical Particle System** (client-only):
- 4 particle layers: pillar, wisps, sparks, base
- Color-coded by rune type (air=white, water=blue, fire=red, etc.)
- Mesh-aware placement (particles spawn from actual model geometry)
- Billboard rendering (always faces camera)
- Additive blending for glow effect

**Particle Layers**:
1. **Pillar**: Large soft glows above altar peak (slow vertical bob)
2. **Wisps**: Medium orbs orbiting altar silhouette (helical motion)
3. **Sparks**: Small bright particles rising from surface vertices
4. **Base**: Low ambient glows at altar footprint

**Color Palettes** (per rune type):
```typescript
air:    { core: 0xffffff, mid: 0xe0e8f0, outer: 0xc8d8e8 }
water:  { core: 0x80d0ff, mid: 0x2090e0, outer: 0x1060c0 }
earth:  { core: 0x80ff80, mid: 0x30a030, outer: 0x208020 }
fire:   { core: 0xff6040, mid: 0xe02020, outer: 0xb01010 }
mind:   { core: 0xe879f9, mid: 0xa855f7, outer: 0x7c3aed }
chaos:  { core: 0xff6b6b, mid: 0xdc2626, outer: 0x991b1b }
// ... etc.
```

### Collision

Altars register collision tiles based on footprint:
- Default footprint: 2x2 tiles (from station manifest)
- Can be overridden per-instance
- Blocks player movement (OSRS-accurate)

---

## Event Types

### New Events (Added in Recent PRs)

#### `CRAFTING_INTERACT`

Player used crafting tool (needle/chisel) or clicked furnace.

**Payload**:
```typescript
{
  playerId: string;
  triggerType: string; // "needle", "chisel", "furnace"
  stationId?: string;
  inputItemId?: string;
}
```

#### `CRAFTING_INTERFACE_OPEN`

Show crafting panel with available recipes.

**Payload**:
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

#### `PROCESSING_CRAFTING_REQUEST`

Player selected crafting recipe and quantity.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string; // Output item ID
  quantity: number;
}
```

#### `CRAFTING_START`

Crafting session started.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string;
}
```

#### `CRAFTING_COMPLETE`

Crafting session completed.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

#### `FLETCHING_INTERACT`

Player used knife on logs or item-on-item.

**Payload**:
```typescript
{
  playerId: string;
  triggerType: string; // "knife"
  inputItemId: string;
  secondaryItemId?: string; // For item-on-item
}
```

#### `FLETCHING_INTERFACE_OPEN`

Show fletching panel with available recipes.

**Payload**:
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

#### `PROCESSING_FLETCHING_REQUEST`

Player selected fletching recipe and quantity.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string; // Format: "output:primaryInput"
  quantity: number;
}
```

#### `FLETCHING_START`

Fletching session started.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string;
}
```

#### `FLETCHING_COMPLETE`

Fletching session completed.

**Payload**:
```typescript
{
  playerId: string;
  recipeId: string;
  outputItemId: string;
  totalCrafted: number;
  totalXp: number;
}
```

#### `RUNECRAFTING_INTERACT`

Player clicked runecrafting altar.

**Payload**:
```typescript
{
  playerId: string;
  altarId: string;
  runeType: string; // "air", "water", etc.
}
```

#### `RUNECRAFTING_COMPLETE`

Runes crafted from essence.

**Payload**:
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

---

## Type Definitions

### SkillData

```typescript
interface SkillData {
  level: number; // 1-99
  xp: number;    // 0-200,000,000
}
```

### Skills

```typescript
interface Skills {
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  constitution: SkillData;
  ranged: SkillData;
  magic: SkillData;
  prayer: SkillData;
  woodcutting: SkillData;
  mining: SkillData;
  fishing: SkillData;
  firemaking: SkillData;
  cooking: SkillData;
  smithing: SkillData;
  agility: SkillData;
  crafting: SkillData;
  fletching: SkillData;
  runecrafting: SkillData;
}
```

### SmithingCategory

```typescript
type SmithingCategory = 
  | "weapons"
  | "armor"
  | "tools"
  | "arrowtips"
  | "nails"
  | "other";
```

### FootprintSpec

```typescript
type FootprintSpec = 
  | { x: number; z: number }  // Explicit size
  | "1x1" | "2x2" | "3x3"     // Preset sizes
  | number;                    // Square size
```

---

## Usage Examples

### Example 1: Check if Player Can Craft Item

```typescript
import { processingDataProvider } from '@hyperscape/shared';

function canPlayerCraft(playerId: string, itemId: string): boolean {
  const recipe = processingDataProvider.getCraftingRecipe(itemId);
  if (!recipe) return false;
  
  const player = world.getPlayer(playerId);
  const craftingLevel = player.skills.crafting.level;
  
  if (craftingLevel < recipe.level) return false;
  
  const inventory = world.getInventory(playerId);
  const invState = buildInventoryState(inventory);
  
  return hasRequiredInputs(invState, recipe) &&
         hasRequiredTools(invState, recipe) &&
         hasRequiredConsumables(invState, recipe);
}
```

### Example 2: Calculate Runecrafting Output

```typescript
import { processingDataProvider } from '@hyperscape/shared';

function calculateRunecraftingOutput(
  runeType: string,
  essenceCount: number,
  playerLevel: number
): { runes: number; xp: number } {
  const recipe = processingDataProvider.getRunecraftingRecipe(runeType);
  if (!recipe) return { runes: 0, xp: 0 };
  
  const multiplier = processingDataProvider.getRunecraftingMultiplier(
    runeType,
    playerLevel
  );
  
  return {
    runes: essenceCount * multiplier,
    xp: essenceCount * recipe.xpPerEssence
  };
}

// Example usage
const output = calculateRunecraftingOutput('air', 28, 22);
// Returns: { runes: 84, xp: 140 }
```

### Example 3: Get Available Fletching Recipes for Logs

```typescript
import { processingDataProvider } from '@hyperscape/shared';

function getFletchingOptionsForLogs(
  logItemId: string,
  playerLevel: number
): FletchingRecipeData[] {
  const recipes = processingDataProvider.getFletchingRecipesForInput(logItemId);
  
  return recipes.filter(recipe => recipe.level <= playerLevel);
}

// Example usage
const options = getFletchingOptionsForLogs('oak_logs', 20);
// Returns: [arrow_shaft recipe, oak_shortbow_u recipe]
```

### Example 4: Display Smithing Panel with Availability

```typescript
import { processingDataProvider } from '@hyperscape/shared';

function getSmithingPanelData(
  inventory: InventoryItem[],
  smithingLevel: number
) {
  const recipes = processingDataProvider.getSmithableItemsWithAvailability(
    inventory,
    smithingLevel
  );
  
  // Group by category
  const grouped = new Map<SmithingCategory, typeof recipes>();
  for (const recipe of recipes) {
    const categoryRecipes = grouped.get(recipe.category) || [];
    categoryRecipes.push(recipe);
    grouped.set(recipe.category, categoryRecipes);
  }
  
  return grouped;
}

// UI can show:
// - Green highlight: meetsLevel && hasBars
// - Red highlight: !meetsLevel
// - Gray: meetsLevel && !hasBars
```

---

## Performance Considerations

### Memory Optimization

**Pre-allocated Buffers**:
```typescript
// ProcessingDataProvider uses pre-allocated Map for inventory counting
private readonly inventoryCountBuffer = new Map<string, number>();

// Reused across multiple method calls to avoid allocations
private buildInventoryCounts(inventory): Map<string, number> {
  this.inventoryCountBuffer.clear();
  // ... populate buffer
  return this.inventoryCountBuffer;
}
```

**Reusable Arrays**:
```typescript
// FletchingSystem uses reusable array for tick processing
private readonly completedPlayerIds: string[] = [];

update(_dt: number): void {
  this.completedPlayerIds.length = 0; // Clear without allocating
  // ... collect completed sessions
  for (const playerId of this.completedPlayerIds) {
    this.completeFletch(playerId);
  }
}
```

### Tick Processing Optimization

**Once-Per-Tick Guard**:
```typescript
private lastProcessedTick = -1;

update(_dt: number): void {
  const currentTick = this.world.currentTick ?? 0;
  
  // Only process once per tick (avoid duplicate processing)
  if (currentTick === this.lastProcessedTick) return;
  this.lastProcessedTick = currentTick;
  
  // ... process sessions
}
```

**Batch Processing**:
```typescript
// Collect all completed sessions first, then process
// Avoids modifying Map while iterating
const completedPlayerIds: string[] = [];
for (const [playerId, session] of this.activeSessions) {
  if (currentTick >= session.completionTick) {
    completedPlayerIds.push(playerId);
  }
}
for (const playerId of completedPlayerIds) {
  this.completeAction(playerId);
}
```

### Skill Level Caching

```typescript
// Cache player skills to avoid repeated entity lookups
private readonly playerSkills = new Map<
  string,
  Record<string, { level: number; xp: number }>
>();

// Update cache on SKILLS_UPDATED event
this.subscribe(EventType.SKILLS_UPDATED, (data) => {
  this.playerSkills.set(data.playerId, data.skills);
});

// Use cached value
private getCraftingLevel(playerId: string): number {
  const cached = this.playerSkills.get(playerId);
  if (cached?.crafting?.level != null) {
    return cached.crafting.level;
  }
  // Fallback to entity lookup
  // ...
}
```

---

## Migration Notes

### Breaking Changes

None. All new skills are additive.

### Database Migrations

**Required**: Run migrations to add new skill columns:
```bash
cd packages/server
bunx drizzle-kit migrate
```

**Migrations**:
- 0029: Crafting skill (craftingLevel, craftingXp)
- 0030: Fletching skill (fletchingLevel, fletchingXp)
- 0031: Runecrafting skill (runecraftingLevel, runecraftingXp)

**Default Values**:
- All new skills default to level 1, XP 0
- Existing characters automatically get default values

### Manifest Updates

**New Recipe Files** (must be present):
- `packages/server/world/assets/manifests/recipes/crafting.json`
- `packages/server/world/assets/manifests/recipes/fletching.json`
- `packages/server/world/assets/manifests/recipes/runecrafting.json`

**Fallback Behavior**:
If recipe manifests are missing, ProcessingDataProvider falls back to embedded item data (backwards compatibility).

---

## Troubleshooting

### Recipes Not Loading

**Symptom**: Crafting/fletching/runecrafting panels show no recipes.

**Cause**: Recipe manifests not loaded or validation errors.

**Fix**:
1. Check console for validation errors
2. Verify recipe JSON files exist in `packages/server/world/assets/manifests/recipes/`
3. Check DataManager initialization logs
4. Call `processingDataProvider.getSummary()` to see loaded recipe counts

### Thread Not Being Consumed

**Symptom**: Thread never runs out when crafting leather armor.

**Cause**: Consumable uses not being decremented.

**Fix**: Verify `consumableUses` Map is being updated in `completeCraft()`:
```typescript
for (const consumable of recipe.consumables) {
  const remaining = session.consumableUses.get(consumable.item) || 0;
  session.consumableUses.set(consumable.item, Math.max(0, remaining - 1));
}
```

### Multi-Rune Multiplier Not Working

**Symptom**: Always getting 1 rune per essence regardless of level.

**Cause**: `multiRuneLevels` array not sorted or multiplier calculation incorrect.

**Fix**: Verify `multiRuneLevels` is sorted ascending in manifest:
```json
{
  "multiRuneLevels": [11, 22, 33, 44, 55, 66, 77, 88, 99]
}
```

### Fletching Producing Wrong Quantity

**Symptom**: Arrow shafts produce 1 instead of 15.

**Cause**: `outputQuantity` not being used when adding items.

**Fix**: Verify `INVENTORY_ITEM_ADDED` event uses `recipe.outputQuantity`:
```typescript
this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
  playerId,
  item: {
    id: `fletch_${playerId}_${++this.fletchCounter}_${Date.now()}`,
    itemId: recipe.output,
    quantity: recipe.outputQuantity, // NOT hardcoded 1
    slot: -1,
    metadata: null,
  },
});
```

---

## See Also

- [SKILLS.md](SKILLS.md) - Skills system overview
- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [README.md](README.md) - Project documentation
- OSRS Wiki: https://oldschool.runescape.wiki
