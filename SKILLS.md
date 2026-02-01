# Skills System Documentation

Hyperscape implements a comprehensive OSRS-style skills system with 17 skills, XP progression, and level requirements.

## Overview

**Total Skills**: 17 (7 combat, 3 gathering, 7 production)

**Level Range**: 1-99 for all skills

**XP Formula**: Uses OSRS XP table formula:
```
XP for level N = floor(N + 300 * 2^(N/7)) / 4
```

**Combat Level**: Calculated from combat skills using OSRS formula

**Total Level**: Sum of all skill levels (max 1683 at 99 in all skills)

## Skill Categories

### Combat Skills

| Skill | Description | Trained By |
|-------|-------------|------------|
| Attack | Accuracy with melee weapons | Melee combat (accurate style) |
| Strength | Damage with melee weapons | Melee combat (aggressive style) |
| Defense | Damage reduction from all sources | Combat (defensive style) |
| Constitution | Maximum hitpoints | All combat (1.33 XP per damage) |
| Ranged | Accuracy and damage with bows/arrows | Ranged combat |
| Magic | Spell effectiveness and damage | Casting spells |
| Prayer | Prayer points and unlockable prayers | Burying bones |

### Gathering Skills

| Skill | Description | Activities |
|-------|-------------|------------|
| Woodcutting | Chopping trees for logs | Chop trees, higher levels = faster gathering |
| Mining | Mining rocks for ores | Mine rocks, higher levels = faster gathering |
| Fishing | Catching fish | Fish at fishing spots, higher levels = better catch rates |

### Production Skills

| Skill | Description | Activities | Processing Type |
|-------|-------------|------------|-----------------|
| Cooking | Preparing food | Cook raw food at fires/ranges | Tick-based (burn chance) |
| Firemaking | Lighting fires | Burn logs to create fires | Tick-based |
| Smithing | Metalworking | Smelt ores → bars, forge bars → items at anvils | Tick-based |
| Crafting | Leatherworking, jewelry, gems | Craft leather armor, jewelry, cut gems | Tick-based |
| Fletching | Bowmaking, arrow crafting | Fletch bows, arrows, arrow shafts | Tick-based (multi-output) |
| Runecrafting | Rune creation | Convert essence → runes at altars | Instant (multi-rune) |
| Agility | Agility training | Complete obstacle courses | Tick-based |

## Production Skills Details

### Cooking

**Mechanics**:
- Cook raw food at fires or ranges
- Burn chance decreases with level
- Stop-burn level varies by food and heat source (ranges have lower stop-burn)
- Grants cooking XP per successful cook

**Recipe Data**: `packages/server/world/assets/manifests/recipes/cooking.json`

**Example Recipe**:
```json
{
  "raw": "raw_shrimp",
  "cooked": "shrimp",
  "burnt": "burnt_shrimp",
  "level": 1,
  "xp": 30,
  "ticks": 4,
  "stopBurnLevel": { "fire": 35, "range": 32 }
}
```

### Smithing

**Mechanics**:
- **Smelting**: Combine ores + coal at furnaces → bars (4 ticks, success rate varies)
- **Forging**: Use bars at anvils → weapons/armor/tools (4 ticks)
- Multi-output support: Arrowtips produce 15 per bar
- Grants smithing XP per item made

**Recipe Data**: 
- `packages/server/world/assets/manifests/recipes/smelting.json`
- `packages/server/world/assets/manifests/recipes/smithing.json`

**Example Smelting Recipe**:
```json
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
```

**Example Smithing Recipe**:
```json
{
  "output": "bronze_sword",
  "bar": "bronze_bar",
  "barsRequired": 1,
  "level": 4,
  "xp": 12.5,
  "ticks": 4,
  "category": "weapons"
}
```

### Crafting

**Mechanics**:
- **Leather Armor**: Use needle + thread + leather/dragonhide
- **Jewelry**: Use mould + gold bar at furnace
- **Gem Cutting**: Use chisel on uncut gems
- Thread has 5 uses before being consumed
- Always succeeds (no failure rate)
- Grants crafting XP per item made

**Recipe Data**: `packages/server/world/assets/manifests/recipes/crafting.json`

**Example Recipe**:
```json
{
  "output": "leather_body",
  "category": "leather",
  "inputs": [{ "item": "leather", "amount": 14 }],
  "tools": ["needle"],
  "consumables": [{ "item": "thread", "uses": 5 }],
  "level": 14,
  "xp": 25,
  "ticks": 3,
  "station": "none"
}
```

**Categories**: leather, studded, dragonhide, jewelry, gem_cutting

### Fletching

**Mechanics**:
- **Arrow Shafts**: Knife + logs → 15 arrow shafts per log
- **Bows**: Knife + logs → unstrung bow, then bowstring + unstrung bow → strung bow
- **Arrows**: Arrowtips + headless arrows → finished arrows (multi-output)
- **Headless Arrows**: Arrow shafts + feathers → headless arrows (multi-output)
- Always succeeds (no failure rate)
- Multi-output support (15 shafts per log, 15 arrows per set)
- Grants fletching XP per action (total for all items produced)

**Recipe Data**: `packages/server/world/assets/manifests/recipes/fletching.json`

**Example Recipe** (multi-output):
```json
{
  "output": "arrow_shaft",
  "outputQuantity": 15,
  "category": "arrow_shafts",
  "inputs": [{ "item": "logs", "amount": 1 }],
  "tools": ["knife"],
  "level": 1,
  "xp": 5,
  "ticks": 2,
  "skill": "fletching"
}
```

**Categories**: arrow_shafts, headless_arrows, shortbows, longbows, stringing, arrows

### Runecrafting

**Mechanics**:
- Click altar to **instantly** convert all carried essence → runes
- Two essence types: `rune_essence` (basic runes), `pure_essence` (all runes)
- Multi-rune crafting at higher levels (e.g., 2x air runes at level 11, 3x at level 22)
- Grants runecrafting XP per essence consumed
- No tick delay (instant conversion)

**Recipe Data**: `packages/server/world/assets/manifests/recipes/runecrafting.json`

**Example Recipe**:
```json
{
  "runeType": "air",
  "runeItemId": "air_rune",
  "levelRequired": 1,
  "xpPerEssence": 5,
  "essenceTypes": ["rune_essence", "pure_essence"],
  "multiRuneLevels": [11, 22, 33, 44, 55, 66, 77, 88, 99]
}
```

**Multi-Rune Calculation**:
- Base: 1 rune per essence
- Each threshold in `multiRuneLevels` adds +1 rune per essence
- Example: At level 22, air runes produce 3 per essence (base + 2 thresholds)

**Altar Types**: air, water, earth, fire, mind, body, cosmic, chaos, nature, law, death, blood

### Tanning

**Mechanics**:
- Talk to tanner NPC to instantly convert hides → leather
- Costs coins per hide tanned
- No level requirement
- No XP reward
- Instant conversion (no tick delay)

**Recipe Data**: `packages/server/world/assets/manifests/recipes/tanning.json`

**Example Recipe**:
```json
{
  "input": "cowhide",
  "output": "leather",
  "cost": 1,
  "name": "Leather"
}
```

## Skill Guide Panel

**Feature** (added in PR #711):
- Click any skill icon in the skills panel to open the guide
- Shows all unlocks for that skill at each level
- Visual indicators:
  - ✓ Green: Unlocked (player meets level requirement)
  - ➤ Yellow: Next unlock (closest level above player)
  - 🔒 Gray: Locked (future unlocks)
- Displays levels to next unlock
- Shows unlock type badges (item, ability, location, etc.)

**Data Source**: `packages/shared/src/data/skill-unlocks.ts`

**Example Unlock Data**:
```typescript
{
  level: 14,
  description: "Craft leather body armor",
  type: "item"
}
```

## ProcessingDataProvider API

**Location**: `packages/shared/src/data/ProcessingDataProvider.ts`

**Purpose**: Centralized recipe data provider for all processing skills. Loads recipes from JSON manifests and provides lookup methods.

### Initialization

```typescript
import { processingDataProvider } from '@hyperscape/shared';

// Called automatically by DataManager after loading manifests
processingDataProvider.initialize();
```

### Cooking Methods

```typescript
// Check if item is cookable
processingDataProvider.isCookable('raw_shrimp'); // true

// Get cooking data
const data = processingDataProvider.getCookingData('raw_shrimp');
// Returns: { rawItemId, cookedItemId, burntItemId, levelRequired, xp, stopBurnLevel }

// Get all cookable items
const cookableIds = processingDataProvider.getCookableItemIds(); // Set<string>

// Get specific properties
const cookedId = processingDataProvider.getCookedItemId('raw_shrimp'); // 'shrimp'
const burntId = processingDataProvider.getBurntItemId('raw_shrimp'); // 'burnt_shrimp'
const level = processingDataProvider.getCookingLevel('raw_shrimp'); // 1
const xp = processingDataProvider.getCookingXP('raw_shrimp'); // 30
const stopBurn = processingDataProvider.getStopBurnLevel('raw_shrimp', 'fire'); // 35
```

### Smithing Methods

```typescript
// Check if item is smithable
processingDataProvider.isSmithableItem('bronze_sword'); // true

// Get smithing recipe
const recipe = processingDataProvider.getSmithingRecipe('bronze_sword');
// Returns: { itemId, name, barType, barsRequired, levelRequired, xp, category, ticks, outputQuantity }

// Get recipes for a bar type
const bronzeRecipes = processingDataProvider.getSmithingRecipesForBar('bronze_bar');

// Get recipes grouped by category
const grouped = processingDataProvider.getSmithingRecipesByCategory('bronze_bar');
// Returns: Map<SmithingCategory, SmithingRecipeData[]>

// Get available recipes for player level
const available = processingDataProvider.getAvailableSmithingRecipes(40);

// Get smithable items from inventory (with availability flags)
const smithable = processingDataProvider.getSmithableItemsWithAvailability(
  inventory,
  smithingLevel
);
// Returns: SmithingRecipeWithAvailability[] (includes meetsLevel, hasBars flags)
```

### Smelting Methods

```typescript
// Check if item is a smeltable bar
processingDataProvider.isSmeltableBar('bronze_bar'); // true

// Check if item is a smeltable ore
processingDataProvider.isSmeltableOre('copper_ore'); // true

// Get smelting data
const data = processingDataProvider.getSmeltingData('bronze_bar');
// Returns: { barItemId, primaryOre, secondaryOre, coalRequired, levelRequired, xp, successRate, ticks }

// Get all smeltable bars from inventory
const smeltable = processingDataProvider.getSmeltableBarsFromInventory(
  inventory,
  smithingLevel
);
```

### Crafting Methods

```typescript
// Check if item is craftable
processingDataProvider.isCraftableItem('leather_body'); // true

// Get crafting recipe
const recipe = processingDataProvider.getCraftingRecipe('leather_body');
// Returns: { output, name, category, inputs, tools, consumables, level, xp, ticks, station }

// Get recipes by category
const leatherRecipes = processingDataProvider.getCraftingRecipesByCategory('leather');

// Get recipes by station
const furnaceRecipes = processingDataProvider.getCraftingRecipesByStation('furnace');

// Get valid inputs for a tool
const needleInputs = processingDataProvider.getCraftingInputsForTool('needle');
// Returns: Set<string> of item IDs that can be crafted with needle

// Check if item is a crafting input
processingDataProvider.isCraftingInput('leather'); // true

// Get tool required for an input
const tool = processingDataProvider.getCraftingToolForInput('leather'); // 'needle'
```

### Fletching Methods

```typescript
// Check if item is fletchable
processingDataProvider.isFletchableItem('arrow_shaft'); // true

// Get fletching recipe by unique ID (output:primaryInput)
const recipe = processingDataProvider.getFletchingRecipe('arrow_shaft:logs');
// Returns: { recipeId, output, name, outputQuantity, category, inputs, tools, level, xp, ticks }

// Get recipes for a specific input item
const logRecipes = processingDataProvider.getFletchingRecipesForInput('logs');

// Get recipes for item-on-item interactions (both inputs required)
const stringRecipes = processingDataProvider.getFletchingRecipesForInputPair(
  'shortbow_u',
  'bowstring'
);

// Get valid inputs for a tool
const knifeInputs = processingDataProvider.getFletchingInputsForTool('knife');

// Get recipes by category
const arrowRecipes = processingDataProvider.getFletchingRecipesByCategory('arrows');
```

### Runecrafting Methods

```typescript
// Get runecrafting recipe by rune type
const recipe = processingDataProvider.getRunecraftingRecipe('air');
// Returns: { runeType, runeItemId, name, levelRequired, xpPerEssence, essenceTypes, multiRuneLevels }

// Check if item is essence
processingDataProvider.isRunecraftingEssence('rune_essence'); // true

// Calculate multi-rune multiplier for a level
const multiplier = processingDataProvider.getRunecraftingMultiplier('air', 22);
// Returns: 3 (base + 2 thresholds at levels 11 and 22)

// Get all runecrafting recipes
const allRecipes = processingDataProvider.getAllRunecraftingRecipes();
```

### Tanning Methods

```typescript
// Get tanning recipe
const recipe = processingDataProvider.getTanningRecipe('cowhide');
// Returns: { input, output, cost, name }

// Check if item can be tanned
processingDataProvider.isTannableItem('cowhide'); // true

// Get all tanning recipes
const allRecipes = processingDataProvider.getAllTanningRecipes();
```

## System Architecture

### SkillsSystem

**Location**: `packages/shared/src/systems/shared/character/SkillsSystem.ts`

**Responsibilities**:
- XP tracking and level calculation
- Level-up detection and events
- Combat level calculation
- Total level tracking
- Skill milestone detection
- XP drop visualization

**Key Methods**:
```typescript
// Grant XP to a skill
skillsSystem.grantXP(playerId, 'attack', 100);

// Get level for XP amount
const level = skillsSystem.getLevelForXP(13034); // 30

// Get XP required for level
const xp = skillsSystem.getXPForLevel(50); // 101333

// Check skill requirements
const meetsReqs = skillsSystem.meetsRequirements(entity, {
  smithing: 40,
  mining: 30
});

// Get combat level
const combatLevel = skillsSystem.getCombatLevel(stats);

// Get total level
const totalLevel = skillsSystem.getTotalLevel(stats);
```

**Events Emitted**:
- `SKILLS_XP_GAINED`: XP awarded to a skill
- `SKILLS_LEVEL_UP`: Skill leveled up
- `SKILLS_MILESTONE`: Skill milestone reached (50, 92, 99)
- `SKILLS_UPDATED`: Skills data changed (for UI sync)
- `COMBAT_LEVEL_CHANGED`: Combat level changed
- `TOTAL_LEVEL_CHANGED`: Total level changed
- `XP_DROP_BROADCAST`: XP drop for visual feedback

### Processing Systems

All processing systems follow a common pattern:

1. **Listen for interaction events** (player clicks station/uses item)
2. **Validate player level and materials**
3. **Create tick-based session** (or instant for runecrafting)
4. **Process on tick completion** (consume materials, add output, grant XP)
5. **Cancel on movement/combat** (OSRS behavior)
6. **Emit completion events** (for UI feedback and logging)

**Systems**:
- `CookingSystem` - Food preparation
- `FiremakingSystem` - Fire lighting
- `SmeltingSystem` - Ore smelting
- `SmithingSystem` - Item forging
- `CraftingSystem` - Leather/jewelry/gems
- `FletchingSystem` - Bows/arrows
- `RunecraftingSystem` - Rune creation
- `TanningSystem` - Hide tanning

**Common Features**:
- Server-authoritative (all systems run on server)
- Rate limiting (prevent spam)
- Audit logging (economic tracking)
- Idempotency checks (prevent duplicate actions)
- Inventory validation (re-check materials before consumption)
- Session management (one active session per player)

**Example: Starting a Crafting Session**:
```typescript
// Player clicks needle on leather
world.emit(EventType.CRAFTING_INTERACT, {
  playerId: 'player123',
  triggerType: 'needle',
  inputItemId: 'leather'
});

// System shows available recipes
// Player selects "leather_body" and quantity 5

world.emit(EventType.PROCESSING_CRAFTING_REQUEST, {
  playerId: 'player123',
  recipeId: 'leather_body',
  quantity: 5
});

// System creates session, processes every 3 ticks until complete or interrupted
```

## Database Schema

**Character Skills** (stored in `characters` table):

Each skill has two columns:
- `{skill}Level` - Current level (1-99)
- `{skill}Xp` - Current XP (0-200,000,000)

**Columns**:
```sql
-- Combat
attackLevel, attackXp
strengthLevel, strengthXp
defenseLevel, defenseXp
constitutionLevel, constitutionXp
rangedLevel, rangedXp
magicLevel, magicXp
prayerLevel, prayerXp

-- Gathering
woodcuttingLevel, woodcuttingXp
miningLevel, miningXp
fishingLevel, fishingXp

-- Production
firemakingLevel, firemakingXp
cookingLevel, cookingXp
smithingLevel, smithingXp
agilityLevel, agilityXp
craftingLevel, craftingXp
fletchingLevel, fletchingXp
runecraftingLevel, runecraftingXp
```

**Migrations**:
- 0029: Added crafting skill columns
- 0030: Added fletching skill columns
- 0031: Added runecrafting skill columns

## Adding New Skills

To add a new skill to Hyperscape:

### 1. Update SkillsSystem

Add skill constant to `Skill` object:
```typescript
export const Skill = {
  // ... existing skills
  HERBLORE: "herblore" as keyof Skills,
};
```

Add skill to `Skills` type in `packages/shared/src/types/core/core.ts`:
```typescript
export interface Skills {
  // ... existing skills
  herblore: SkillData;
}
```

Add skill to level/XP calculation methods in `SkillsSystem.ts`:
```typescript
const skills: (keyof Skills)[] = [
  // ... existing skills
  Skill.HERBLORE,
];
```

### 2. Create Processing System

Create `HerbloreSystem.ts` following the pattern in `CraftingSystem.ts`:
- Extend `SystemBase`
- Listen for interaction events
- Validate level and materials
- Create tick-based sessions
- Process on tick completion
- Cancel on movement/combat
- Emit completion events

### 3. Add Recipe Manifest

Create `packages/server/world/assets/manifests/recipes/herblore.json`:
```json
{
  "recipes": [
    {
      "output": "attack_potion",
      "inputs": [
        { "item": "guam_leaf", "amount": 1 },
        { "item": "eye_of_newt", "amount": 1 }
      ],
      "level": 3,
      "xp": 25,
      "ticks": 2
    }
  ]
}
```

### 4. Update ProcessingDataProvider

Add methods to load and access herblore recipes:
```typescript
private herbloreManifest: HerbloreManifest | null = null;
private herbloreRecipeMap = new Map<string, HerbloreRecipeData>();

public loadHerbloreRecipes(manifest: HerbloreManifest): void {
  this.herbloreManifest = manifest;
}

private buildHerbloreDataFromManifest(): void {
  // Build lookup tables from manifest
}

public getHerbloreRecipe(outputItemId: string): HerbloreRecipeData | null {
  return this.herbloreRecipeMap.get(outputItemId) || null;
}
```

### 5. Add Database Migration

Create migration to add skill columns:
```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "herbloreLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "herbloreXp" integer DEFAULT 0;
```

### 6. Update UI

Add skill icon to `packages/shared/src/data/skill-icons.ts`:
```typescript
export const SKILL_ICONS: Record<string, string> = {
  // ... existing skills
  herblore: "🧪",
};
```

Add unlock data to `packages/shared/src/data/skill-unlocks.ts`:
```typescript
export const SKILL_UNLOCKS: Record<string, readonly SkillUnlock[]> = {
  // ... existing skills
  herblore: [
    { level: 3, description: "Brew attack potions", type: "item" },
    // ... more unlocks
  ],
};
```

### 7. Register System

Add to world initialization in `packages/shared/src/runtime/createServerWorld.ts`:
```typescript
world.addSystem(new HerbloreSystem(world));
```

## Testing

All skill systems have comprehensive unit tests:

**Test Files**:
- `packages/shared/src/systems/shared/interaction/__tests__/CraftingSystem.test.ts`
- `packages/shared/src/systems/shared/interaction/__tests__/FletchingSystem.test.ts`
- `packages/shared/src/systems/shared/interaction/__tests__/RunecraftingSystem.test.ts`
- `packages/shared/src/data/__tests__/ProcessingDataProvider.test.ts`

**Test Coverage**:
- Recipe loading and validation
- Level requirement checks
- Material consumption
- XP calculation
- Multi-output handling (fletching, smithing arrowtips)
- Consumable tracking (thread uses)
- Multi-rune multipliers (runecrafting)
- Session management (start, complete, cancel)
- Edge cases (out of materials, level too low, invalid recipes)

**Example Test**:
```typescript
test('fletching produces 15 arrow shafts per log', async () => {
  const world = await createTestWorld();
  const player = createTestPlayer(world, { fletching: { level: 1, xp: 0 } });
  
  // Add materials
  addInventoryItem(player, 'logs', 1);
  addInventoryItem(player, 'knife', 1);
  
  // Start fletching
  world.emit(EventType.FLETCHING_INTERACT, {
    playerId: player.id,
    triggerType: 'knife',
    inputItemId: 'logs'
  });
  
  // Select recipe
  world.emit(EventType.PROCESSING_FLETCHING_REQUEST, {
    playerId: player.id,
    recipeId: 'arrow_shaft:logs',
    quantity: 1
  });
  
  // Advance ticks
  advanceTicks(world, 2);
  
  // Verify output
  expect(getInventoryItem(player, 'arrow_shaft').quantity).toBe(15);
  expect(getInventoryItem(player, 'logs')).toBeUndefined();
});
```

## Performance Optimizations

**Memory Management**:
- Pre-allocated buffers for inventory counting (avoids Map allocations in hot paths)
- Reusable arrays for tick processing (avoids per-frame allocations)
- Skill level caching (reduces entity lookups)

**Tick Processing**:
- Once-per-tick processing guard (prevents duplicate processing)
- Batch completion checks (collect completed sessions, then process)
- Early exits for empty sessions

**Example** (from FletchingSystem):
```typescript
// Pre-allocated buffer (class field)
private readonly completedPlayerIds: string[] = [];

update(_dt: number): void {
  const currentTick = this.world.currentTick ?? 0;
  
  // Only process once per tick
  if (currentTick === this.lastProcessedTick) return;
  this.lastProcessedTick = currentTick;
  
  // Collect completed sessions (reuse array)
  this.completedPlayerIds.length = 0;
  for (const [playerId, session] of this.activeSessions) {
    if (currentTick >= session.completionTick) {
      this.completedPlayerIds.push(playerId);
    }
  }
  
  // Process completions
  for (const playerId of this.completedPlayerIds) {
    this.completeFletch(playerId);
  }
}
```

## Manifest-Driven Design

All skill recipes are defined in JSON manifests, not hardcoded in TypeScript:

**Recipe Manifests**:
- `packages/server/world/assets/manifests/recipes/cooking.json`
- `packages/server/world/assets/manifests/recipes/firemaking.json`
- `packages/server/world/assets/manifests/recipes/smelting.json`
- `packages/server/world/assets/manifests/recipes/smithing.json`
- `packages/server/world/assets/manifests/recipes/crafting.json`
- `packages/server/world/assets/manifests/recipes/fletching.json`
- `packages/server/world/assets/manifests/recipes/runecrafting.json`
- `packages/server/world/assets/manifests/recipes/tanning.json`

**Benefits**:
- Add new recipes without code changes
- Easy balancing (edit JSON, reload)
- Content creators can add recipes
- Validation on load (detailed error reporting)
- Fallback to embedded item data (backwards compatibility)

**Validation**:
ProcessingDataProvider validates all recipes on load:
- Required fields present and correct types
- Level in range [1, 99]
- XP > 0, ticks > 0
- All item IDs exist in ITEMS manifest
- Input amounts >= 1
- Tool IDs valid
- Consumable uses >= 1

Validation errors are logged to console with recipe label for easy debugging.

## UI Components

### SkillsPanel

**Location**: `packages/client/src/game/panels/SkillsPanel.tsx`

**Features**:
- Displays all 17 skills with icons, levels, and XP
- Click skill icon to open Skill Guide Panel
- Shows XP progress bars
- Displays combat level and total level
- Real-time updates via SKILLS_UPDATED events

### SkillGuidePanel

**Location**: `packages/client/src/game/panels/SkillGuidePanel.tsx`

**Features** (new in PR #711):
- Modal window showing all unlocks for a skill
- Sorted by level (ascending)
- Visual unlock status (unlocked/next/locked)
- Shows levels to next unlock
- Type badges (item, ability, location, etc.)
- Progress indicator (X/Y unlocked)

**Usage**:
```typescript
<SkillGuidePanel
  visible={isOpen}
  skillLabel="Fletching"
  skillIcon="🏹"
  playerLevel={45}
  unlocks={SKILL_UNLOCKS.fletching}
  isLoading={false}
  onClose={() => setIsOpen(false)}
/>
```

### Processing Panels

**Panels**:
- `CraftingPanel.tsx` - Leather/jewelry/gems
- `FletchingPanel.tsx` - Bows/arrows
- `SmithingPanel.tsx` - Metal items
- `SmeltingPanel.tsx` - Ore smelting
- `TanningPanel.tsx` - Hide tanning

**Common Features**:
- Category grouping (e.g., leather, studded, dragonhide)
- Recipe filtering by available materials
- Level requirement indicators (red = too low, green = can make)
- Material count display
- Quantity selection (1, 5, 10, All)
- Output quantity display (for multi-output recipes)

## Event Flow

### Crafting Example

```
1. Player clicks needle on leather
   → CRAFTING_INTERACT event

2. CraftingSystem validates and shows recipes
   → CRAFTING_INTERFACE_OPEN event

3. Client displays CraftingPanel with available recipes

4. Player selects "leather_body" and quantity 5
   → PROCESSING_CRAFTING_REQUEST event

5. CraftingSystem creates session, sets completionTick

6. Every tick, system checks if currentTick >= completionTick

7. On completion:
   → INVENTORY_ITEM_REMOVED (consume materials)
   → INVENTORY_ITEM_ADDED (add crafted item)
   → SKILLS_XP_GAINED (grant XP)
   → ANIMATION_PLAY (crafting animation)
   → UI_MESSAGE (success message)

8. Repeat steps 6-7 until quantity reached or interrupted

9. On session end:
   → CRAFTING_COMPLETE event
```

### Runecrafting Example (Instant)

```
1. Player clicks air altar
   → RUNECRAFTING_INTERACT event

2. RunecraftingSystem validates essence and level

3. Calculate multi-rune multiplier based on level

4. Instantly:
   → INVENTORY_ITEM_REMOVED (all essence)
   → INVENTORY_ITEM_ADDED (runes = essence * multiplier)
   → SKILLS_XP_GAINED (XP = essence * xpPerEssence)
   → RUNECRAFTING_COMPLETE event
   → UI_MESSAGE (success message)
```

## Common Pitfalls

### 1. Forgetting to Register Skills in Multiple Places

When adding a new skill, you must update:
- `Skill` constants in `SkillsSystem.ts`
- `Skills` type in `types/core/core.ts`
- Skill arrays in `getTotalLevel()` and `getTotalXP()`
- Database migration (add columns)
- `SKILL_ICONS` in `skill-icons.ts`
- `SKILL_UNLOCKS` in `skill-unlocks.ts`

### 2. Not Handling Multi-Output Recipes

Fletching and smithing arrowtips produce multiple items per action:
- Use `outputQuantity` field in recipe
- Grant XP once per action (not per item)
- Display output quantity in UI

### 3. Forgetting Movement/Combat Cancellation

All processing systems must cancel on:
- `MOVEMENT_CLICK_TO_MOVE` event
- `COMBAT_STARTED` event

This is OSRS-accurate behavior.

### 4. Not Validating Materials Before Consumption

Always re-check inventory before consuming materials:
```typescript
// ❌ BAD: Assume materials still exist
this.consumeMaterials(playerId, recipe);

// ✅ GOOD: Re-validate before consuming
const invState = this.getInventoryState(playerId);
if (!this.hasRequiredInputs(invState, recipe)) {
  this.cancelSession(playerId);
  return;
}
this.consumeMaterials(playerId, recipe);
```

### 5. Hardcoding Recipe Data

Never hardcode recipe data in system files:
```typescript
// ❌ BAD: Hardcoded data
const BRONZE_SWORD_XP = 12.5;

// ✅ GOOD: Load from manifest
const recipe = processingDataProvider.getSmithingRecipe('bronze_sword');
const xp = recipe?.xp ?? 0;
```

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
- OSRS Wiki: https://oldschool.runescape.wiki (reference for mechanics)
