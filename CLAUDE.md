# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with autonomous AI agents powered by ElizaOS.

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
│   ├── SQLite/PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
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

## Game Systems

### Skills System

The game implements OSRS-style skills with XP progression and level requirements (1-99):

**Combat Skills**: Attack, Strength, Defense, Constitution, Ranged, Magic, Prayer

**Gathering Skills**: Woodcutting, Mining, Fishing

**Production Skills**: 
- **Cooking**: Food preparation at fires/ranges (tick-based, burn chance)
- **Firemaking**: Lighting fires from logs (tick-based)
- **Smithing**: Smelting ores → bars, forging bars → items at anvils (tick-based)
- **Crafting**: Leather armor, jewelry, gem cutting (needle/chisel/furnace, tick-based)
- **Fletching**: Bows, arrows, arrow shafts (knife + logs/bowstring, tick-based, multi-output)
- **Runecrafting**: Converting essence → runes at altars (instant, multi-rune at higher levels)
- **Agility**: Obstacle courses, shortcuts (tick-based)

**Key Features**:
- XP-based leveling (1-99) using OSRS XP table formula
- Level requirements for items and activities
- Skill guide panel showing unlocks at each level (click skill icon in skills panel)
- Database persistence for all skills (17 skills total)
- Combat level calculation from combat skills
- Total level tracking (sum of all skill levels)

**Skill Guide Panel** (new in #711):
- Click any skill icon in the skills panel to open the guide
- Shows all unlocks for that skill (items, abilities, locations)
- Visual indicators: ✓ unlocked, ➤ next unlock, 🔒 locked
- Displays levels to next unlock
- Client-side data loading from skill-unlocks.ts manifest

### Equipment System

**11 Equipment Slots** (OSRS-accurate):
- Weapon, Shield, Helmet, Body, Legs
- Boots, Gloves, Cape, Amulet, Ring
- Arrows (ammunition)

**Combat Bonuses**:
- Per-style attack bonuses: Stab, Slash, Crush, Magic, Ranged
- Per-style defense bonuses: Stab, Slash, Crush, Magic, Ranged
- Other bonuses: Melee Strength, Ranged Strength, Magic Damage, Prayer

**Combat Triangle** (OSRS mechanics):
- Weapon types have default attack styles (swords=slash, maces=crush, daggers=stab)
- Armor provides different defense values per attack style
- Equipment stats panel shows all bonuses

**Features**:
- Right-click to unequip
- Automatic 2h weapon handling (unequips shield)
- Level and skill requirements
- Trade/death guards (can't change equipment during trades or while dead)
- Idempotency checks to prevent duplicate equip/unequip (new in #697)

### Processing Systems

**Tick-Based Processing** (OSRS-style):
- **Smelting**: Ores → bars at furnaces (4 ticks default, success rate varies by bar type)
- **Smithing**: Bars → weapons/armor/tools at anvils (4 ticks default, multi-output for arrowtips: 15 per bar)
- **Cooking**: Raw food → cooked food at fires/ranges (varies by food, burn chance until stop-burn level)
- **Crafting**: Materials → leather/jewelry/gems (needle/chisel/furnace, 3 ticks, thread has 5 uses)
- **Fletching**: Logs/materials → bows/arrows (knife + bowstring, 2-3 ticks, multi-output: 15 shafts per log)

**Instant Processing**:
- **Runecrafting**: Essence → runes at altars (instant conversion, multi-rune multiplier at higher levels)
- **Tanning**: Hides → leather at tanner NPCs (instant, costs coins)

**Common Features**:
- Movement/combat cancellation (OSRS: any action interrupts skilling)
- Level requirements and XP rewards
- Material consumption and output production
- Server-authoritative validation
- Rate limiting and audit logging
- Recipe data loaded from JSON manifests (data-driven)

**ProcessingDataProvider** (new in #698, #699, #703):
- Centralized recipe data provider for all processing skills
- Loads recipes from `packages/server/world/assets/manifests/recipes/` JSON files
- Provides lookup methods for recipes, level requirements, XP values
- Supports multi-output recipes (e.g., 15 arrow shafts per log)
- Handles consumables with limited uses (e.g., thread with 5 uses)
- Validates recipe data on load with detailed error reporting

**New Entities**:
- **RunecraftingAltarEntity** (new in #703): Interactable altar for crafting runes, mystical particle effects, per-rune-type color palettes

**Database Migrations**:
- Migration 0029: Added crafting skill columns (craftingLevel, craftingXp)
- Migration 0030: Added fletching skill columns (fletchingLevel, fletchingXp)
- Migration 0031: Added runecrafting skill columns (runecraftingLevel, runecraftingXp)

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
const craftingSystem = world.getSystem('crafting') as CraftingSystem;
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

**Processing System Pattern** (for new skills):
```typescript
// All processing systems follow this pattern:
// 1. Listen for interaction events
// 2. Validate player level and materials
// 3. Create tick-based session
// 4. Process on tick completion
// 5. Cancel on movement/combat
// 6. Grant XP and emit completion events

// See CraftingSystem, FletchingSystem, SmithingSystem for examples
```

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
- **Database**: SQLite (local), PostgreSQL (production via Neon)
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

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

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
