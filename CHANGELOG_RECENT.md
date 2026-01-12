# Recent Updates (January 11, 2026)

## 🍖 Food Consumption & Healing System (PR #500)

OSRS-accurate food consumption with eat delay and combat integration:

- **Eat Delay**: 3-tick (1.8s) cooldown between foods
- **Combat Integration**: Eating during combat adds 3 ticks to attack cooldown (only if already on cooldown)
- **Server-Authoritative**: Full validation with rate limiting and input validation
- **Security**: Item mismatch detection, bounds checking, exploit prevention (MAX_HEAL_AMOUNT: 99)
- **OSRS-Accurate Behavior**: Food consumed even at full health, message format matches OSRS
- **Event-Driven Health**: Health bar updates via `PLAYER_HEALTH_UPDATED` events (eliminates race conditions)
- **EatDelayManager**: Per-player cooldown tracking with automatic cleanup on death/disconnect
- **Testing**: 30 unit tests covering eat delay and combat integration

**Files Changed:**
- `packages/shared/src/systems/shared/character/EatDelayManager.ts` (new)
- `packages/shared/src/systems/shared/character/PlayerSystem.ts` (+97 lines)
- `packages/shared/src/systems/shared/combat/CombatSystem.ts` (+47 lines)
- `packages/server/src/systems/ServerNetwork/handlers/inventory.ts` (+69 lines)
- `packages/client/src/game/hud/StatusBars.tsx` (+45/-20 lines)
- `packages/shared/src/constants/CombatConstants.ts` (added EAT_DELAY constants)

## ⛏️ Mining System Improvements (PR #504)

OSRS-accurate mining mechanics with proper depletion and success rates:

- **100% Rock Depletion**: Rocks always deplete after yielding one ore (OSRS-accurate)
- **Success Rates**: Level-dependent success rates matching OSRS wiki data
  - Copper/Tin: ~39.5% at L1, 100% at L62
  - Iron: ~52% at L15, 100% at L63
  - Coal: ~16.4% at L30, ~39.5% at L99
  - Runite: ~6.64% at L85, ~7.42% at L97+
- **Pickaxe Bonuses**: Dragon (1/6 chance) and Crystal (1/4 chance) for 2-tick rolls
- **Server-Side Rolls**: Bonus speed rolled server-side for deterministic shared code (prevents client/server desyncs)
- **Model Scale Normalization**: Fixed "squished" rock appearance with `ModelCache.normalizeScales()`
- **Depleted Models**: Rocks show depleted models (not just trees)

**Files Changed:**
- `packages/shared/src/constants/GatheringConstants.ts` (updated success rates)
- `packages/shared/src/data/DataManager.ts` (added bonusTickChance, bonusRollTicks)
- `packages/shared/src/systems/shared/entities/gathering/SuccessRateCalculator.ts` (deterministic cycle calculation)
- `packages/shared/src/systems/shared/entities/ResourceSystem.ts` (server-side bonus rolls)
- `packages/shared/src/entities/world/ResourceEntity.ts` (simplified model loading)
- `packages/shared/src/utils/rendering/ModelCache.ts` (added normalizeScales method)

## 🏦 Bank Placeholder Improvements (PR #502)

Fixed unique constraint violations in bank placeholder system:

- **Two-Phase Slot Updates**: Prevents database constraint violations during bulk operations
- **Phase 1**: Offset all slots to 1000+ range
- **Phase 2**: Renumber slots sequentially (0-N)
- **Why**: PostgreSQL doesn't guarantee UPDATE order, two-phase eliminates slot collisions
- **Affected Operations**: Release all placeholders, tab compaction

**Files Changed:**
- `packages/server/src/systems/ServerNetwork/handlers/bank/placeholders.ts` (+17/-2 lines)

## 🎮 Debug Panel Keybind (PR #505)

Added F5 keybind to toggle FPS debug panel (matches Minecraft):

- **F5** or **\\** (backslash) toggles debug panel
- Shows FPS, frame time, memory usage, entity counts
- Prevents typing in input fields when toggling

**Files Changed:**
- `packages/shared/src/systems/client/DevStats.ts` (+8/-3 lines)

## 🎨 OSRS-Style Context Menus (PR #497)

Authentic context menu system with colored entity names:

- **Color Coding**: Orange for items (#ff9040), yellow for NPCs (#ffff00), cyan for objects (#00ffff)
- **Inventory Actions**: Manifest-driven actions with heuristic fallback
  - Items can define `inventoryActions` array
  - First action becomes left-click default
  - Supported: Eat, Drink, Wield, Wear, Bury, Use, Drop, Examine
- **Centralized Dispatching**: `InventoryActionDispatcher` eliminates code duplication
- **Item Helpers**: Type detection utilities (`isFood`, `isPotion`, `isBone`, `usesWield`, `usesWear`)
- **Cancel Option**: Always shown last (OSRS standard)
- **Left-Click Primary Actions**: Execute first action in manifest or heuristic default
- **Shift-Click**: Instantly drop items

**Files Changed:**
- `packages/client/src/game/systems/InventoryActionDispatcher.ts` (new, 129 lines)
- `packages/shared/src/utils/item-helpers.ts` (new, 152 lines)
- `packages/client/src/game/panels/InventoryPanel.tsx` (+200 lines)
- `packages/shared/src/constants/GameConstants.ts` (added CONTEXT_MENU_COLORS)
- All interaction handlers updated for color consistency
- `packages/client/src/game/systems/__tests__/InventoryActionDispatcher.test.ts` (new, 333 lines)
- `packages/shared/src/utils/__tests__/item-helpers.test.ts` (new, 510 lines)

## 🔧 Equipment System Fix (PR #497)

- **Tool Equipping**: Tools with `equipSlot: "weapon"` can now be equipped (hatchets, pickaxes)
- **Explicit equipSlot**: Check `equipSlot` first before falling back to type-based detection

**Files Changed:**
- `packages/shared/src/systems/shared/character/EquipmentSystem.ts`

## 🐛 Resource Spam Fix (PR #494)

- **Duplicate Prevention**: Prevent duplicate resource harvesting on spam-click
- **Idempotency**: Server-side deduplication for gather requests

**Files Changed:**
- `packages/server/src/systems/ServerNetwork/handlers/resources.ts`
