# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with AI agents powered by ElizaOS.

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```

## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence
│   ├── ElizaOS agent integration
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── plugin-hyperscape/   # ElizaOS plugin for AI agents
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### Combat System Architecture

Hyperscape implements OSRS-accurate combat with three attack types and the combat triangle:

#### Attack Types
- **MELEE**: Swords, axes, maces - cardinal-only range for distance 1, per-style bonuses (stab/slash/crush)
- **RANGED**: Bows with arrows - Chebyshev distance, projectile system, ammunition consumption
- **MAGIC**: Combat spells with runes - Chebyshev distance, autocast support, staffless casting

#### Combat Triangle (OSRS-Accurate)

The armor system implements per-style attack and defense bonuses:

- **Melee Styles**: Stab, Slash, Crush (weapon type determines default style)
- **Armor Defense**: Each armor piece has separate defense values for stab/slash/crush/ranged/magic
- **Weapon Defaults**: Swords=slash, Daggers=stab, Maces=crush, Axes=slash, Spears=stab, Halberds=slash, Unarmed=crush

**Armor Characteristics:**
- **Melee Armor** (Bronze-Rune): High melee/ranged defense, negative magic attack/defense
- **Ranged Armor** (Leather, D'hide): Positive ranged/magic defense, lower melee defense
- **Magic Armor** (Wizard, Mystic): Positive magic attack/defense, minimal physical defense

#### Key Combat Systems

| System | Location | Purpose |
|--------|----------|---------|
| CombatSystem | `shared/src/systems/shared/combat/` | Main combat orchestration, per-style routing |
| CombatStateManager | `shared/src/entities/managers/` | Attack timing, cooldowns, first-attack delay |
| DamageCalculator | `shared/src/systems/shared/combat/` | OSRS damage formulas with per-style bonuses |
| RangedDamageCalculator | `shared/src/systems/shared/combat/` | Ranged-specific formulas |
| MagicDamageCalculator | `shared/src/systems/shared/combat/` | Magic-specific formulas |
| ProjectileService | `shared/src/systems/shared/combat/` | Projectile tracking and hit delay |
| AmmunitionService | `shared/src/systems/shared/combat/` | Arrow consumption |
| RuneService | `shared/src/systems/shared/combat/` | Rune validation and consumption |
| SpellService | `shared/src/systems/shared/combat/` | Spell data and validation |
| AggroSystem | `shared/src/systems/shared/combat/` | Mob aggression with spatial indexing (21x21 tile regions) |
| EquipmentSystem | `shared/src/systems/shared/character/` | 11-slot equipment with per-style bonus tracking |

#### Combat Formulas

All combat uses OSRS-accurate formulas:

**Melee/Ranged Attack Roll:**
```
Effective Level = floor(level * prayer) + style + 8
Attack Roll = Effective Level * (equipment + 64)
```

**Magic Attack Roll:**
```
Effective Level = floor(level * prayer) + style + 8
Attack Roll = Effective Level * (magic attack + 64)
```

**Magic Defense (Players):**
```
Effective Defense = floor(0.7 * magic + 0.3 * defense) + 9
Defense Roll = Effective Defense * (magic defense + 64)
```

**Hit Chance:**
```
If Attack > Defense: 1 - (Defense + 2) / (2 * (Attack + 1))
If Attack ≤ Defense: Attack / (2 * (Defense + 1))
```

#### Projectile System

Ranged and magic attacks use a projectile system with OSRS-accurate hit delays:

**Ranged Hit Delay:**
```
delay = 1 + floor((3 + distance) / 6) ticks
```

**Magic Hit Delay:**
```
delay = 1 + floor((1 + distance) / 3) ticks
```

Projectiles are tracked server-side and rendered client-side with visual effects.

### Crafting System Architecture

The crafting skill allows players to create leather armor, dragonhide equipment, jewelry, and cut gems:

#### Crafting Systems

| System | Location | Purpose |
|--------|----------|---------|
| CraftingSystem | `shared/src/systems/shared/interaction/` | Tick-based crafting sessions, thread consumption, movement/combat cancellation |
| TanningSystem | `shared/src/systems/shared/interaction/` | Instant hide-to-leather conversion at tanner NPCs |
| ProcessingDataProvider | `shared/src/data/` | Recipe loading, filtering, and lookup |

#### Crafting Categories

**Leather Crafting** (needle + thread):
- Gloves, boots, vambraces, chaps, body, coif
- Thread has 5 uses before being consumed
- Levels 1-18

**Dragonhide Crafting** (needle + thread):
- Green/blue/red/black d'hide vambraces, chaps, body
- High-level ranged armor
- Levels 57-84

**Jewelry Crafting** (furnace + moulds):
- Gold/silver rings, necklaces, amulets, bracelets
- Requires specific mould in inventory
- Levels 5-40

**Gem Cutting** (chisel):
- Cut sapphire, emerald, ruby, diamond
- Used in jewelry crafting
- Levels 20-43

#### Crafting Mechanics

**Thread Consumption:**
- Thread has 5 uses tracked in-memory per crafting session
- New thread consumed when uses depleted
- Crafting stops when no thread available

**Movement/Combat Cancellation:**
- Crafting cancels on `MOVEMENT_CLICK_TO_MOVE` event
- Crafting cancels on `COMBAT_STARTED` event
- Matches OSRS behavior where any action interrupts skilling

**Recipe Filtering:**
- Recipes filter by input item (e.g., chisel + uncut sapphire shows only sapphire)
- Furnace jewelry filters by equipped mould
- Auto-selects single recipe to skip to quantity selection

**Make-X Functionality:**
- Craft 1, 5, 10, All, or custom quantity
- Custom quantity remembered in localStorage
- "All" sends -1 sentinel, server computes actual max based on materials

**Performance Optimizations:**
- Single inventory scan per tick (consolidated from 4 separate scans)
- Reusable arrays to avoid per-tick allocations
- Once-per-tick processing guard

**Security Features:**
- Rate limiting on crafting interact (prevents inventory scan spam)
- Structured audit logging on craft completion
- Monotonic counter for item IDs (prevents Date.now() collisions)
- Input validation for triggerType and inputItemId

### Persistence Architecture

The game uses a multi-layered persistence system with crash-safe guarantees:

#### Auto-Save System
- Equipment: 5-second auto-save interval (parallelized with Promise.allSettled)
- Inventory: 5-second auto-save interval
- Bank: Immediate persistence on changes
- Skills: Immediate persistence on XP gain (XP rounded to integer at DB boundary)

#### Critical Operations
Pickups and drops persist immediately to prevent item loss on server crashes.

#### Transactional Safety
- **Equipment saves**: Use database transactions with upsert pattern (prevents race conditions)
- **Bank operations**: Unified atomic saves for items and tabs via `savePlayerBankComplete()`
- **Inventory operations**: Transactional with FOR UPDATE locks
- **Duel stakes**: Crash-safe design - items stay in inventory until duel completion, then atomic transfer

#### Unified PLAYER_JOINED Payload

Equipment and inventory data are loaded once during character selection and passed via the PLAYER_JOINED event payload:

```typescript
// From character-selection.ts
world.emit(EventType.PLAYER_JOINED, {
  playerId: socket.player.data.id,
  player: socket.player,
  equipment: equipmentRows,  // Pre-loaded from DB
  inventory: inventoryRows,  // Pre-loaded from DB
  isLoadTestBot,
});
```

This eliminates race conditions where multiple systems query the database independently.

#### EventBus Async Handler Tracking

The EventBus now tracks pending async handlers for graceful shutdown:

```typescript
// From EventBus.ts
private pendingAsyncHandlers: Set<Promise<unknown>> = new Set();

async waitForPendingHandlers(timeout: number = 5000): Promise<void> {
  // Waits for all async operations (like database saves) to complete
}
```

This ensures all database writes complete before server shutdown.

#### Graceful Shutdown Sequence

The shutdown system ensures no data loss on server termination:

1. Close HTTP server (stop accepting new connections)
2. Shutdown embedded agents
3. **Force-save all player data** (inventory, equipment, coins) - calls `destroyAsync()` directly on systems
4. Wait for pending database operations
5. Destroy world and all systems
6. Close database connections
7. Stop Docker containers (if started)
8. Clear startup flag (for hot reload)
9. Exit process (unless hot reload)

**Critical Fix**: Player data is now saved BEFORE `world.destroy()` to prevent data loss. The `forcePlayerDataSave()` function directly calls `destroyAsync()` on inventory, equipment, and coin pouch systems, then awaits completion before proceeding.

#### Write-Ahead Logging (Phase 2)
PersistenceService provides WAL pattern for future crash recovery:
- Located at `packages/server/src/persistence/PersistenceService.ts`
- Currently scaffolding - not yet integrated into game systems
- Will be wired to TradingSystem, BankSystem in future updates

### RPG Implementation Architecture

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or "will fill this out later" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Duel System

The duel arena implements OSRS-accurate dueling with crash-safe stake handling:

#### Duel States
1. **RULES** - Players negotiate combat rules (noFood, noPrayer, noRanged, etc.)
2. **STAKES** - Players stake items from inventory
3. **CONFIRMING** - Final review before fight
4. **COUNTDOWN** - 3-2-1-FIGHT animation
5. **FIGHTING** - Active combat
6. **FINISHED** - Resolution pending (death animation delay)

#### Crash-Safe Stakes

Items remain in player inventory during staking (not removed until duel completion):

```typescript
// Stakes are tracked in-memory only during negotiation
session.challengerStakes: StakedItem[] = [
  { inventorySlot: 5, itemId: "dragon_scimitar", quantity: 1, value: 100000 }
];

// At duel completion, atomic database transaction transfers items
// Uses Math.min(stake.quantity, dbItem.quantity) to handle consumed items
```

**Protection Mechanisms:**
- **Slot Locking**: `getStakedSlots()` returns Set of locked inventory slots
- **Trade Protection**: Cannot trade staked items
- **Drop Protection**: All drops blocked during duels
- **Move Protection**: Cannot move/swap staked items
- **Use Protection**: Cannot consume staked items (food, potions)
- **Equipment Protection**: Cannot equip/unequip during active duels
- **Idempotency**: Duplicate equip/unequip requests blocked with 5s dedup window

#### Settlement Safety

The settlement transaction includes multiple safety checks:

```typescript
// Validate item exists and matches expected ID
const dbItem = await pool.query(`SELECT itemId, quantity FROM inventory WHERE ...`);
if (dbItem.itemId !== stake.itemId) {
  // Security: Item ID mismatch - skip transfer
  continue;
}

// Use actual remaining quantity (handles consumed food)
const transferQuantity = Math.min(stake.quantity, dbItem.quantity);

// Integer overflow protection
if (existingQty > 2147483647 - transferQuantity) {
  // Skip merge to prevent overflow
  continue;
}
```

**Deadlock Retry**: Settlement retries up to 3 times on PostgreSQL deadlock (error code 40P01).

**Inventory Overflow**: If winner's inventory is full, items go to bank automatically.

### Artisan Skills Architecture

Hyperscape implements three OSRS-accurate artisan skills for creating equipment and items:

#### Crafting System

| System | Location | Purpose |
|--------|----------|---------|
| CraftingSystem | `shared/src/systems/shared/interaction/` | Tick-based crafting sessions, thread consumption, movement/combat cancellation |
| TanningSystem | `shared/src/systems/shared/interaction/` | Instant hide-to-leather conversion at tanner NPCs |

**Crafting Categories:**
- **Leather Crafting** (needle + thread): Gloves, boots, vambraces, chaps, body, coif (levels 1-18)
- **Dragonhide Crafting** (needle + thread): Green/blue/red/black d'hide armor (levels 57-84)
- **Jewelry Crafting** (furnace + moulds): Gold/silver rings, necklaces, amulets, bracelets (levels 5-40)
- **Gem Cutting** (chisel): Cut sapphire, emerald, ruby, diamond (levels 20-43)

**Mechanics:**
- Thread has 5 uses tracked in-memory per session
- Movement or combat cancels crafting
- Recipe filtering by input item
- Make-X with quantity memory (1, 5, 10, All, custom)
- Rate limiting and audit logging

#### Fletching System

| System | Location | Purpose |
|--------|----------|---------|
| FletchingSystem | `shared/src/systems/shared/interaction/` | Tick-based fletching sessions, multi-output support, item-on-item interactions |

**Fletching Categories:**
- **Arrow Shafts** (knife + logs): 15 shafts per log (levels 1-60)
- **Headless Arrows** (arrow shafts + feathers): 15 per action (level 1)
- **Arrows** (arrowtips + headless arrows): 15 per action (levels 1-75)
- **Shortbows** (knife + logs): Unstrung shortbows (levels 5-70)
- **Longbows** (knife + logs): Unstrung longbows (levels 10-85)
- **Stringing** (bowstring + unstrung bow): Complete bows (levels 5-85)

**Mechanics:**
- Multi-output recipes (15 items per action for arrows/shafts)
- Item-on-item interactions (bowstring + bow, arrowtips + arrows)
- Knife required for cutting, no tool for stringing
- Tick-based fletching (2-3 ticks per action)
- Movement or combat cancels fletching
- Recipe filtering by input item pair

#### Runecrafting System

| System | Location | Purpose |
|--------|----------|---------|
| RunecraftingSystem | `shared/src/systems/shared/interaction/` | Instant essence-to-rune conversion at altars, multi-rune multipliers |

**Runecrafting Altars:**
- **Basic Runes**: Air, Mind, Water, Earth, Fire, Body (levels 1-27)
- **Advanced Runes**: Cosmic, Chaos, Nature, Law, Death (levels 27-65)

**Mechanics:**
- Instant conversion (no tick delay)
- Multi-rune multipliers at specific levels (e.g., 2x air runes at level 11, 3x at level 22)
- Two essence types: rune_essence (basic runes), pure_essence (all runes)
- XP per essence consumed
- No failure rate
- Converts ALL essence in inventory at once

#### ProcessingDataProvider

Central data provider for all artisan skill recipes:

| Method | Purpose |
|--------|---------|
| `getCraftingRecipe(outputItemId)` | Get crafting recipe by output item |
| `getCraftingRecipesByStation(station)` | Filter recipes by station ("none" or "furnace") |
| `getFletchingRecipe(recipeId)` | Get fletching recipe by unique ID (output:primaryInput) |
| `getFletchingRecipesForInput(itemId)` | Get all recipes using a specific input |
| `getFletchingRecipesForInputPair(itemA, itemB)` | Get recipes matching both inputs (item-on-item) |
| `getRunecraftingRecipe(runeType)` | Get runecrafting recipe by rune type |
| `getRunecraftingMultiplier(runeType, level)` | Calculate multi-rune multiplier for level |
| `getTanningRecipe(inputItemId)` | Get tanning recipe by hide item ID |

**Recipe Loading:**
- Recipes loaded from JSON manifests in `packages/server/world/assets/manifests/recipes/`
- Validation on load with detailed error reporting
- Fallback to embedded item data for backwards compatibility
- Singleton pattern with lazy initialization

### Manifest-Driven Content

Game content is defined in JSON manifests at `packages/server/world/assets/manifests/`:

| Manifest | Purpose | Example |
|----------|---------|---------|
| `items/*.json` | Item definitions | Weapons, armor, food, resources |
| `npcs.json` | NPC/mob definitions | Combat stats, loot tables, AI behavior |
| `prayers.json` | Prayer definitions | Bonuses, drain rates, conflicts |
| `ammunition.json` | Arrows and bolts | Ranged strength, requirements |
| `runes.json` | Magic runes | Elemental staves, infinite runes |
| `combat-spells.json` | Combat spells | Damage, XP, rune costs |
| `banks-stores.json` | Shops and banks | Stock, prices, locations |
| `recipes/crafting.json` | Crafting recipes | Leather, dragonhide, jewelry, gems |
| `recipes/tanning.json` | Tanning recipes | Hide-to-leather conversion costs |
| `recipes/fletching.json` | Fletching recipes | Bows, arrows, arrow shafts, multi-output |
| `recipes/runecrafting.json` | Runecrafting recipes | Essence-to-rune conversion, multi-rune levels |
| `recipes/smelting.json` | Smelting recipes | Ore-to-bar conversion |
| `recipes/smithing.json` | Smithing recipes | Bar-to-equipment crafting |
| `recipes/cooking.json` | Cooking recipes | Raw-to-cooked food |
| `recipes/firemaking.json` | Firemaking recipes | Log burning XP |

**Adding new content**: Edit the appropriate manifest file - no code changes required.

### Combat System Implementation

#### Ranged Combat
- Weapons: Bows (shortbow, oak, willow, maple)
- Ammunition: Arrows (bronze, iron, steel, mithril, adamant)
- Styles: Accurate (+3 ranged), Rapid (-1 tick speed), Longrange (+2 range)
- Consumption: 1 arrow per shot (no Ava's devices in F2P)

#### Magic Combat
- Weapons: Staves (staff, magic staff, elemental staves)
- Spells: Strike tier (levels 1-13), Bolt tier (levels 17-35)
- Runes: Air, water, earth, fire, mind, chaos
- Elemental staves provide infinite runes for their element
- Autocast: Select a spell to auto-cast on attack
- Staffless casting: Can cast spells without a staff (lower accuracy)

#### Attack Type Routing
The combat system routes attacks based on weapon type and selected spell:
1. If player has spell selected → MAGIC attack (regardless of weapon)
2. Else if weapon is bow → RANGED attack
3. Else → MELEE attack

#### Armor System (69 Items)

The armor system implements OSRS-accurate per-style defense bonuses:

**Armor Categories:**
- **Melee Armor** (24 items): Bronze, Iron, Steel, Mithril, Adamant, Rune (helmet, body, legs, shield per tier)
  - High stab/slash/crush/ranged defense
  - Negative magic attack and magic defense penalties
  - Example: Rune platebody has +82 stab, +80 slash, +72 crush, +80 ranged, -6 magic defense, -30 magic attack

- **Ranged Armor** (8 items): Leather, Studded leather, Green d'hide, Coif
  - Positive ranged and magic defense
  - Lower melee defense than plate armor
  - Example: Green d'hide body has +40 stab, +32 slash, +45 crush, +40 ranged, +20 magic defense, +15 ranged attack

- **Magic Armor** (8 items): Wizard robes, Mystic robes, boots, gloves
  - Positive magic attack and magic defense
  - Minimal physical defense
  - Example: Mystic robe top has +20 magic attack, +20 magic defense

**Per-Style Bonus Tracking:**

Equipment bonuses are tracked in `PlayerEquipment.totalStats`:
```typescript
totalStats: {
  // Generic bonuses (backward compatibility)
  attack: number;
  strength: number;
  defense: number;
  ranged: number;
  
  // Per-style melee attack bonuses
  attackStab: number;
  attackSlash: number;
  attackCrush: number;
  
  // Per-style melee defense bonuses
  defenseStab: number;
  defenseSlash: number;
  defenseCrush: number;
  defenseRanged: number;
  
  // Magic/ranged bonuses
  attackMagic: number;
  attackRanged: number;
  magicDefense: number;
  rangedStrength: number;
  meleeStrength: number;
  magicDamage: number;
}
```

**Weapon Attack Style Mapping:**

Melee weapons have default attack styles that determine which per-style bonus is used:

```typescript
// From CombatConstants.ts
export const WEAPON_DEFAULT_ATTACK_STYLE: Record<string, MeleeAttackStyle> = {
  [WeaponType.SWORD]: "slash",
  [WeaponType.SCIMITAR]: "slash",
  [WeaponType.AXE]: "slash",
  [WeaponType.MACE]: "crush",
  [WeaponType.DAGGER]: "stab",
  [WeaponType.SPEAR]: "stab",
  [WeaponType.HALBERD]: "slash",
  [WeaponType.NONE]: "crush", // unarmed = crush (fists)
};
```

The DamageCalculator uses these mappings to select the appropriate attack/defense bonuses for combat calculations.

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 5555 | Game Server | `PORT` | `bun run dev` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.1.38+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.1.38+
- **Engine**: Three.js 0.180.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon), Docker for local dev
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor
- **AI**: ElizaOS for autonomous agents

## Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, wallet, privyId |
| `characters` | Player characters | id, userId, username, position, skills, selectedSpell |
| `inventory` | Player inventory | playerId, itemId, quantity, slotIndex |
| `equipment` | Equipped items (11 slots) | playerId, slotType, itemId, quantity |
| `bank_storage` | Bank items | playerId, itemId, quantity, slot, tabIndex |
| `bank_tabs` | Bank tab icons | playerId, tabIndex, iconItemId |
| `operations_log` | WAL for crash recovery | id, playerId, operationType, operationState |

### Skills Columns

All skill data is stored in the `characters` table:

**Combat Skills:**
- `attackLevel`, `attackXp`
- `strengthLevel`, `strengthXp`
- `defenseLevel`, `defenseXp`
- `constitutionLevel`, `constitutionXp`
- `rangedLevel`, `rangedXp`
- `magicLevel`, `magicXp` (now persisted)
- `prayerLevel`, `prayerXp` (now persisted)

**Gathering Skills:**
- `woodcuttingLevel`, `woodcuttingXp`
- `miningLevel`, `miningXp`
- `fishingLevel`, `fishingXp`

**Artisan Skills:**
- `cookingLevel`, `cookingXp`
- `firemakingLevel`, `firemakingXp`
- `smithingLevel`, `smithingXp`
- `craftingLevel`, `craftingXp`
- `fletchingLevel`, `fletchingXp`
- `runecraftingLevel`, `runecraftingXp`

**Other Skills:**
- `agilityLevel`, `agilityXp`

### Combat Preferences
- `attackStyle` - Selected combat style (accurate, aggressive, defensive, controlled, rapid, longrange, autocast)
- `autoRetaliate` - Auto-retaliate toggle (1=ON, 0=OFF)
- `selectedSpell` - Autocast spell ID (null = no autocast, persisted across sessions)

### Equipment Slots

The equipment table supports 11 slots (OSRS-style paperdoll):
- `weapon`, `shield`, `helmet`, `body`, `legs`
- `boots`, `gloves`, `cape`, `amulet`, `ring`
- `arrows` (ammunition slot for ranged combat)

Each slot tracks `itemId` and `quantity` (for stackable items like arrows).

**Arrow Quantity Tracking:**
- Arrows are stored in the equipment slot with full quantity
- `consumeArrow()` decrements quantity by 1 per shot
- Auto-unequips when quantity reaches 0
- Quantity persisted to database on equip/unequip/consume
- Prevents arrow duplication on crashes

### Migrations

Run from `packages/server/`:
```bash
bunx drizzle-kit generate  # Create migration from schema changes
bunx drizzle-kit migrate   # Apply pending migrations
bunx drizzle-kit push      # Push schema directly (dev only)
```

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### Database Issues

**Schema out of sync after pulling updates:**
```bash
# Reset database (WARNING: deletes all local data)
docker stop hyperscape-postgres 2>/dev/null
docker rm hyperscape-postgres 2>/dev/null
docker volume rm hyperscape-postgres-data 2>/dev/null
bun run dev  # Starts fresh database
```

**Migration errors:**
```bash
cd packages/server
bunx drizzle-kit push  # Force schema sync
```

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
