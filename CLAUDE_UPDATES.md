# CLAUDE.md Updates - Recent Features

## Recent System Additions (January 2026)

### Food Consumption System

**Location**: `packages/shared/src/systems/shared/character/`

New components:
- `EatDelayManager.ts` - Per-player eat cooldown tracking (3-tick delay)
- `PlayerSystem.ts` - `handleItemUsed()` method for food consumption
- `CombatSystem.ts` - `isPlayerOnAttackCooldown()` and `addAttackDelay()` methods

**Key Constants** (`CombatConstants.ts`):
```typescript
EAT_DELAY_TICKS: 3              // 1.8 seconds between foods
EAT_ATTACK_DELAY_TICKS: 3       // Added to attack cooldown when eating mid-combat
MAX_HEAL_AMOUNT: 99             // Security cap on healing
```

**Network Flow**:
```
Client → useItem packet → Server validates → INVENTORY_USE event → 
InventorySystem validates → ITEM_USED event → PlayerSystem validates eat delay → 
Consume food + heal + attack delay
```

### Mining System Improvements

**Location**: `packages/shared/src/systems/shared/entities/gathering/`

Updated components:
- `SuccessRateCalculator.ts` - Now deterministic (no `Math.random()`)
- `ResourceSystem.ts` - Server-side bonus roll for dragon/crystal pickaxes
- `GatheringConstants.ts` - OSRS-accurate success rates

**Key Changes**:
- Rock depletion is now 100% (always depletes after one ore)
- Success rates depend only on Mining level, not pickaxe tier
- Dragon pickaxe: 1/6 chance for 2-tick roll (vs 3)
- Crystal pickaxe: 1/4 chance for 2-tick roll (vs 3)
- Server rolls bonus speed to prevent client/server desyncs

**Model Loading**:
- `ModelCache.ts` - Added `normalizeScales()` method to fix non-uniform scales
- `ResourceEntity.ts` - Simplified model loading (matches FurnaceEntity pattern)
- Depleted models now work for all resource types (not just trees)

### Context Menu System

**Location**: `packages/shared/src/systems/client/interaction/handlers/`

New components:
- `packages/client/src/game/systems/InventoryActionDispatcher.ts` - Centralized action handling
- `packages/shared/src/utils/item-helpers.ts` - Type detection utilities

**Key Constants** (`GameConstants.ts`):
```typescript
CONTEXT_MENU_COLORS = {
  ITEM: "#ff9040",      // Orange - for items
  NPC: "#ffff00",       // Yellow - for NPCs and mobs
  OBJECT: "#00ffff",    // Cyan - for scenery/objects
  PLAYER: "#ffffff",    // White - for players
}
```

**Item Helpers**:
```typescript
isFood(item)        // Has healAmount, not a potion
isPotion(item)      // Contains "potion" in ID
isBone(item)        // ID is "bones" or ends with "_bones"
usesWield(item)     // Weapons and shields
usesWear(item)      // Armor (not weapons/shields)
isNotedItem(item)   // Bank notes
getPrimaryAction(item, isNoted)  // Manifest-first with heuristic fallback
```

**Manifest Support**:
Items can now define `inventoryActions` array:
```json
{
  "id": "shrimp",
  "inventoryActions": ["Eat", "Use", "Drop", "Examine"]
}
```

### Bank Placeholder System

**Location**: `packages/server/src/systems/ServerNetwork/handlers/bank/`

Updated components:
- `placeholders.ts` - Two-phase slot update to prevent unique constraint violations

**Key Pattern**:
```typescript
// Phase 1: Offset all slots to 1000+ range
UPDATE bank_storage SET slot = slot + 1000 WHERE ...

// Phase 2: Renumber slots sequentially (0-N)
UPDATE bank_storage SET slot = ROW_NUMBER() - 1 WHERE ...
```

**Why**: PostgreSQL doesn't guarantee UPDATE order. Direct renumbering could cause temporary slot collisions.

### Debug Panel Keybind

**Location**: `packages/shared/src/systems/client/DevStats.ts`

**Change**: Added F5 keybind (matches Minecraft) in addition to backslash (\\)

```typescript
const isToggleKey = e.key === "F5" || 
  (e.key === "\\" && !e.ctrlKey && !e.metaKey && !e.altKey);
```

## Testing Requirements

All new features have comprehensive test coverage:

- **EatDelayManager**: 197 lines of tests (16 test cases)
- **CombatSystem eat delay**: 236 lines of integration tests
- **InventoryActionDispatcher**: 333 lines of tests
- **item-helpers**: 510 lines of tests

**Total new test coverage**: 1,176 lines across 4 test files

## Manifest Changes

### Item Manifest Extensions

Items now support:
- `inventoryActions` - Array of context menu actions
- `healAmount` - HP restored when consumed
- `bonusTickChance` - Chance for bonus speed (dragon/crystal pickaxes)
- `bonusRollTicks` - Tick count when bonus triggers

### Resource Manifest Extensions

Resources now support:
- `depletedModelPath` - Path to depleted model (rocks, stumps)
- `depletedModelScale` - Scale of depleted model
- `successRate` - Object with `low` and `high` values for LERP formula

### Station Manifest

Stations now have:
- `model` - Path to 3D model
- `modelScale` - Uniform scale factor
- `modelYOffset` - Vertical offset for positioning
- `examine` - Examine text

## Code Quality Standards

All recent PRs maintain:
- ✅ Zero `any` types
- ✅ Server-authoritative validation
- ✅ OWASP input validation
- ✅ Rate limiting
- ✅ Comprehensive test coverage
- ✅ JSDoc documentation
- ✅ OSRS-accurate mechanics

## Performance Optimizations

Recent changes include:
- **useMemo/useCallback**: InventoryPanel uses React optimization hooks
- **Event-driven health**: Eliminates polling overhead
- **Map-based tracking**: O(1) lookups for eat delay, attack cooldown
- **Pre-allocated buffers**: ProcessingDataProvider uses typed arrays
- **Model caching**: ModelCache normalizes scales once at load time
