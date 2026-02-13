# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

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

## Combat System Architecture

### Attack Types

Hyperscape supports three attack types for both players and mobs:
- **Melee**: Close-range combat (1-2 tiles depending on weapon)
- **Ranged**: Bow and arrow combat (up to 10 tiles)
- **Magic**: Spell casting (up to 10 tiles)

### Mob Combat Configuration

Mobs can be configured with any attack type via NPC manifest JSON:

```json
{
  "combat": {
    "attackType": "magic",
    "spellId": "wind_strike",
    "combatRange": 10,
    "attackSpeedTicks": 5
  },
  "appearance": {
    "heldWeaponModel": "asset://weapons/staff.glb"
  }
}
```

**Attack Type Fields:**
- `attackType`: `"melee"` (default), `"ranged"`, or `"magic"`
- `spellId`: Required for magic mobs (e.g., `"wind_strike"`)
- `arrowId`: Required for ranged mobs (e.g., `"bronze_arrow"`)
- `heldWeaponModel`: Optional visual weapon GLB (e.g., bow, staff)

### Combat Handler Architecture

The combat system uses specialized handlers:
- `MeleeAttackHandler` - Melee combat for players and mobs
- `RangedAttackHandler` - Ranged combat (bows/arrows) for players and mobs
- `MagicAttackHandler` - Magic combat (spells) for players and mobs

Each handler has separate paths for player attacks (with resource consumption, equipment bonuses) and mob attacks (infinite resources, stats from NPC manifest).

**Key Combat Files:**
- `packages/shared/src/systems/shared/combat/CombatSystem.ts` - Main combat orchestration
- `packages/shared/src/systems/shared/combat/handlers/AttackContext.ts` - Shared attack preparation utilities
- `packages/shared/src/constants/CombatConstants.ts` - Combat timing and range constants

### Combat Constants

Key constants from `CombatConstants.ts`:

```typescript
export const COMBAT_CONSTANTS = {
  // Attack ranges (tiles)
  MELEE_RANGE_STANDARD: 1,
  MELEE_RANGE_HALBERD: 2,
  RANGED_RANGE: 10,
  MAGIC_RANGE: 10,
  
  // Projectile launch delays (ms)
  SPELL_LAUNCH_DELAY_MS: 600,    // Spell cast animation wind-up
  ARROW_LAUNCH_DELAY_MS: 400,    // Arrow draw animation wind-up
  
  // Attack speeds (ticks)
  DEFAULT_ATTACK_SPEED_TICKS: 4,  // 2.4 seconds
  TICK_DURATION_MS: 600,          // OSRS-accurate tick timing
};
```

## Database System Architecture

### Inventory Write Coalescing

The database system uses **write coalescing** to prevent connection pool starvation during batch operations:

```typescript
// From DatabaseSystem/index.ts
// Write coalescing collapses N concurrent inventory writes into at most
// 2 DB transactions per player: one active + one queued with latest snapshot.
// This prevents pool exhaustion during batch operations (e.g., fletching 100 arrows).

private inventoryWriteActive = new Map<string, Promise<void>>();
private inventoryWriteQueued = new Map<string, {
  items: InventorySaveItem[];
  waiters: Array<{ resolve: () => void; reject: (err: unknown) => void; }>;
}>();
```

**How It Works:**
1. First write executes immediately
2. Concurrent writes queue with latest snapshot
3. All waiters resolve when batch completes
4. Prevents 200+ sequential transactions from batch operations

**Performance Impact:**
- Before: 100 fletching completions = 200 sequential DB transactions
- After: 100 fletching completions = 2 DB transactions per player
- Eliminates "200 pending operations" warnings and game freezes

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

### Database Pool Starvation

If you see "200 pending operations" warnings or game freezes during batch operations (fletching, smithing), this indicates database connection pool exhaustion. The inventory system uses write coalescing to prevent this—ensure you're on the latest version. The fix collapses concurrent inventory writes into at most 2 transactions per player instead of serializing all writes.

**Symptoms:**
- Game freezes during batch crafting (fletching 100 arrows)
- Console warnings: "200 pending operations"
- Database connection pool exhaustion
- Slow inventory operations

**Solution:**
The `DatabaseSystem` now uses write coalescing (implemented in PR #823) which collapses N concurrent `savePlayerInventoryAsync` calls into at most 2 DB transactions per player. Update to the latest code if experiencing this issue.

### Camera Facing Backwards on Fresh Load

If the camera initializes facing the wrong direction (player appears to move backwards), this was fixed in PR #829. The camera now correctly initializes with `theta=Math.PI` for standard third-person behind-the-player view.

**Technical Details:**
- Camera uses spherical coordinates (radius, phi, theta)
- `theta=0` places camera in front of player (incorrect)
- `theta=Math.PI` places camera behind player (correct)
- Fixed in `ClientCameraSystem.ts`

### Post-Processing Color Grading Leaking

If entity outlines show incorrect colors when color grading is disabled, ensure you're on the latest version. PR #829 fixed an issue where the LUT color grading shader pipeline leaked into outline-only rendering. The fix zeros LUT intensity when disabled so outline rendering stays clean.

## Website & Solana Integration

### Recent Updates (PR #822)

The marketing website (`packages/website/`) has been refactored with improved architecture and Solana wallet integration:

**Privy SDK Updates:**
- Upgraded to `@privy-io/react-auth` v3.13.1 and `@privy-io/server-auth` v1.32.5
- Enhanced multi-chain support with Solana RPC configuration
- Improved wallet detection for embedded wallets

**Solana Wallet Support:**
- Replaced `@solana-mobile/wallet-adapter-mobile` with `@solana-mobile/wallet-standard-mobile`
- Enhanced `SolanaWalletProvider` to support MWA on both Saga and Seeker devices
- Added balance fetching and MWA detection in `AccountPanel` and `SettingsPanel`
- Updated to `@solana-program/memo` v0.11.0 and `@solana/kit` v6.0.1

**Website Improvements:**
- Refactored GoldToken page into modular section components (TokenHero, ValueProps, HowItWorks)
- Added error boundaries, loading states, and not-found page
- Improved SEO with opengraph images and PWA manifest
- Enhanced accessibility with semantic HTML and ARIA labels
- Optimized CSS with variables for gold glow effects
- Fixed clipboard API usage in CopyAddress component

**Next.js Updates:**
- Upgraded from Next.js 15.1.0 to 16.1.6
- Added security headers in `next.config.ts`
- Updated TypeScript configuration to use 'react-jsx'
- Improved global styles with design tokens

**Files Changed:**
- `packages/client/src/auth/PrivyAuthProvider.tsx` - Multi-chain support
- `packages/client/src/auth/SolanaWalletProvider.tsx` - MWA support
- `packages/client/src/game/panels/AccountPanel.tsx` - Balance fetching
- `packages/client/src/game/panels/SettingsPanel/` - MWA detection
- `packages/website/` - Complete refactor with component modularization

## Minimap System

### RS3/OSRS Accuracy

The minimap has been updated to match RS3 and OSRS visual standards:

**Dot Colors (OSRS-accurate):**
- White: Other players
- Yellow: NPCs, mobs, and buildings
- Red: Ground items and loot
- White square: Local player (instead of circle)

**Destination Marker:**
- Red flag icon (RS3-style) instead of red dot
- Persists until player reaches destination
- Shared between world clicks and minimap clicks

**Location Icons:**
The minimap now displays icons for key locations instead of generic dots:
- **Bank**: Gold coin ($) symbol
- **Shop**: Open bag icon
- **Altar**: White cross (prayer)
- **Runecrafting Altar**: Purple circle with "R"
- **Anvil**: Dark anvil silhouette (smithing)
- **Furnace**: Orange circle with flame (smelting)
- **Cooking Range**: Brown circle with steam
- **Fishing Spot**: Cyan circle with fish
- **Mining Rock**: Brown circle with pickaxe
- **Tree**: Green circle (woodcutting)
- **Quest NPC**: Cyan circle with "?" (quest givers)

**Icon Detection:**
Icons are automatically assigned based on:
- Station types (bank, furnace, anvil, range, altar)
- NPC service types (bank, shop, quest)
- Resource types (fishing_spot, mining_rock, tree)

**Size Hierarchy:**
- Entity dots: 6px diameter (compact)
- Location icons: 12px diameter (prominent for navigation)

**Implementation:**
- `packages/client/src/game/hud/Minimap.tsx` - Main minimap component
- `drawMinimapIcon()` function - Renders location-specific icons
- Entity subtype detection from config data

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
