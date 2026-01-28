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

### Production Deployment Architecture

Hyperscape uses a **split deployment** model for scalability and performance:

```
┌─────────────────┐
│   Cloudflare    │  Frontend (Static)
│     Pages       │  - React SPA
│ hyperscape.club │  - Vite build
└────────┬────────┘
         │ WebSocket + HTTP
         ▼
┌─────────────────┐
│    Railway      │  Game Server (API)
│  Game Server    │  - Fastify + WebSockets
│ (Nixpacks)      │  - PostgreSQL (Neon)
└────────┬────────┘
         │ Fetches manifests
         ▼
┌─────────────────┐
│  Cloudflare R2  │  Assets & CDN
│   Assets CDN    │  - Models, textures, audio
│                 │  - JSON manifests
└─────────────────┘
```

**Key Points:**
- **Frontend** is statically hosted on Cloudflare Pages (fast global CDN)
- **Server** runs on Railway with auto-scaling and managed PostgreSQL
- **Assets** are served from Cloudflare R2 (object storage with CDN)
- **Manifests** are fetched from CDN at server startup and cached locally

**Deployment Triggers:**
- Push to `main` → Railway redeploys server via GitHub Actions
- Push to `main` → Cloudflare Pages auto-deploys frontend
- Manual: `bun run sync:r2` to upload assets to R2

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
| 8080 | Asset CDN | (Docker) | `bun run cdn:up` |

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
PUBLIC_PRIVY_APP_ID=...          # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth
PUBLIC_CDN_URL=...               # CDN for assets and manifests

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
PUBLIC_CDN_URL=...               # CDN for assets (same as server)
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PUBLIC_PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server
- `PUBLIC_CDN_URL` should point to your CDN (R2, S3, etc.)

### Manifest System

**Development**: Manifests are auto-downloaded with assets during `bun install` via Git LFS.

**Production/CI**: Manifests are fetched from CDN at server startup:
- Server calls `fetchManifestsFromCDN()` on boot
- Downloads all JSON files from `{PUBLIC_CDN_URL}/manifests/`
- Caches locally in `packages/server/world/assets/manifests/`
- Skips download if local manifests exist (development mode)

**Manifest Files:**
- Root: `biomes.json`, `npcs.json`, `prayers.json`, `skill-unlocks.json`, `stores.json`, etc.
- Items: `items/food.json`, `items/weapons.json`, `items/tools.json`, etc.
- Gathering: `gathering/fishing.json`, `gathering/mining.json`, etc.
- Recipes: `recipes/cooking.json`, `recipes/smithing.json`, etc.

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
- **Deployment**: Railway (server), Cloudflare Pages (frontend), Cloudflare R2 (assets)

## Deployment

### Production Architecture

Hyperscape uses a **split deployment** for optimal performance:

| Component | Platform | URL | Purpose |
|-----------|----------|-----|---------|
| Frontend | Cloudflare Pages | https://hyperscape.club | Static React SPA |
| Game Server | Railway | https://hyperscape-production.up.railway.app | API + WebSocket |
| Assets/CDN | Cloudflare R2 | https://assets.hyperscape.club | Models, audio, textures |

### Railway Deployment

**Build Process** (via Nixpacks):
1. Install system dependencies (Python, Cairo, Pango for native modules)
2. Run `bun install`
3. Build `shared` package
4. Build `server` package
5. Create manifests directory
6. Start server with `bun dist/index.js`

**Configuration Files:**
- `nixpacks.toml` - Railway build configuration
- `Dockerfile.server` - Alternative Docker build (multi-stage)
- `.github/workflows/deploy-railway.yml` - Auto-deployment on push to main
- `railway.server.json` - Railway service configuration

**Environment Variables** (set in Railway dashboard):
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...           # Neon PostgreSQL
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
JWT_SECRET=...
ADMIN_CODE=...
```

### Cloudflare Pages Deployment

**Build Process:**
- Automatic deployment on push to main
- Vite builds React SPA
- Outputs to `packages/client/dist/`
- Served globally via Cloudflare CDN

**Environment Variables** (set in Pages dashboard):
```bash
PUBLIC_PRIVY_APP_ID=...                # Must match server
PUBLIC_API_URL=https://hyperscape-production.up.railway.app
PUBLIC_WS_URL=wss://hyperscape-production.up.railway.app/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://hyperscape.club
```

### Asset Deployment

**Upload to R2:**
```bash
bun run sync:r2          # Upload all assets to Cloudflare R2
bun run sync:r2:dry      # Preview what would be uploaded
bun run sync:r2:verbose  # Detailed upload logs
```

**Manifest Updates:**
- Manifests are committed to the repo at `packages/server/world/assets/manifests/`
- Server fetches from CDN at startup for production
- Local development uses committed manifests

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
lsof -ti:8080 | xargs kill -9  # CDN
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### Deployment Issues

**Railway build fails:**
- Check `nixpacks.toml` configuration
- Verify all dependencies are in `package.json`
- Check Railway logs for build errors
- Ensure `PUBLIC_CDN_URL` is set correctly

**Manifests not loading:**
- Verify CDN is accessible from server
- Check that manifests exist at `{CDN_URL}/manifests/*.json`
- Review server startup logs for fetch errors
- In development, manifests should exist locally

**CORS errors:**
- Verify client domain is in CORS allowlist (see `packages/server/src/startup/http-server.ts`)
- Check that `PUBLIC_PRIVY_APP_ID` matches between client and server
- Ensure WebSocket URL uses correct protocol (ws:// or wss://)

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
