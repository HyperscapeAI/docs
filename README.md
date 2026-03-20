# Hyperscape

**The first AI-native MMORPG where autonomous agents play alongside humans.**

Hyperscape is a RuneScape-inspired MMORPG built on a heavily modified and custom version of [Hyperfy](https://hyperfy.io), an open-source 3D multiplayer engine. The game integrates [ElizaOS](https://elizaos.ai) to enable AI agents to play autonomously in a persistent world. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## What Makes Hyperscape Unique

- **AI Agents as Players**: Autonomous agents powered by ElizaOS that fight, skill, trade, and make decisions using LLMs
- **True OSRS Mechanics**: Authentic tick-based combat (600ms ticks), safespotting, tile-based movement, and classic progression systems
- **Manifest-Driven Design**: Add NPCs, items, and content by editing JSON files—no code changes required
- **Spectator Mode**: Watch agents play in real-time and observe their decision-making process
- **Open Source**: Built on open technology with extensible architecture

## Core Features

| Category | Features |
|----------|----------|
| **Combat** | Tick-based OSRS mechanics (600ms ticks), attack styles, accuracy formulas, death/respawn system |
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
| **Economy** | 480-slot bank, shops, item weights, loot drops |
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.3.10+) - **Updated from 1.1.38 for Vite 6+ compatibility**
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### Setup Environment Files

> **⚠️ WebGPU Linux / Streaming Note**: When running Hyperscape on Linux (e.g. Vast.ai), you must use headful Chrome with Xorg/Xvfb. You MUST use the ANGLE backend for WebGPU, **NOT** Vulkan (`--use-vulkan`). Using the native Vulkan backend with WebGPU currently will crash.

```bash
# Required: Copy both client and server env files
cp packages/client/.env.example packages/client/.env
cp packages/server/.env.example packages/server/.env
```

**Configure Privy Authentication** (required):

1. Create a free account at [Privy Dashboard](https://dashboard.privy.io)
2. Create an app and copy your **App ID** and **App Secret**
3. Set in `packages/client/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   ```
4. Set in `packages/server/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   PRIVY_APP_SECRET=your-app-secret
   ```

> **⚠️ Without Privy credentials**, the game runs in anonymous mode where users get a new identity on every page refresh. Characters will appear to vanish because they're tied to the old anonymous account.

**Optional configs:**
```bash
# AI agents (only if using bun run dev:ai)
cp packages/plugin-hyperscape/.env.example packages/plugin-hyperscape/.env

# Asset generation tools (only if using bun run dev:forge)
cp packages/asset-forge/.env.example packages/asset-forge/.env
# Edit and set OPENAI_API_KEY, MESHY_API_KEY
```

### Run the Game

1. **Start Docker** - Open Docker Desktop (macOS/Windows) or start the daemon (`sudo systemctl start docker` on Linux)

2. **Build the project** (required first time):
   ```bash
   bun run build
   ```

3. **Start the CDN** (serves game assets):
   ```bash
   bun run cdn:up
   ```

4. **Start the game**:
   ```bash
   bun run dev          # Game only (client + server)
   # OR
   bun run dev:ai       # Game + AI agents (ElizaOS)
   ```

5. Open **http://localhost:3333** in your browser.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation tools
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `shared` → everything else (handled automatically by Turbo)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run build` | Build all packages |
| `bun start` | Start production server |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |

### What `bun run dev` starts

| Service | Port | Description |
|---------|------|-------------|
| Client | 3333 | Vite dev server with hot reload |
| Server (HTTP) | 5555 | Game server HTTP API (Fastify) |
| Server (WebSocket) | 5556 | Game WebSocket (uWebSockets.js) |
| CDN | 8080 | Asset server (Docker nginx) |
| PostgreSQL | 5432 | Database (Docker) |

**Note**: As of March 2026, the server uses **dual ports**:
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints
- **Port 5556** (uWebSockets.js): Game WebSocket traffic for real-time multiplayer (can be disabled with `UWS_ENABLED=false`)

### Run specific services

```bash
bun run dev:client    # Client only (port 3333)
bun run dev:server    # Server only (port 5555)
bun run dev:ai        # Game + ElizaOS agents (adds port 4001)
bun run dev:forge     # AssetForge tools (ports 3400, 3401)
bun run docs:dev      # Documentation site (port 3402)
bun run dev:all       # Everything: game + AI + AssetForge
```

### Docker services

```bash
bun run cdn:up        # Start CDN container (needed for bun start)
bun run cdn:down      # Stop CDN container
```

### Database (Drizzle)

Run from `packages/server/`:

```bash
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

### Assets

Game assets (3D models, textures, audio) source: [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets)

**Local Development**: Assets are auto-downloaded during `bun install` (~200MB via Git LFS).

```bash
bun run assets:sync    # Pull latest assets from repo (local dev only)
```

**Production/CI**: Manifests are committed to the repo at `packages/server/world/assets/manifests/`.

## Configuration

**Required for local development:**
- `packages/client/.env` - Set `PUBLIC_PRIVY_APP_ID`
- `packages/server/.env` - Set `PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`

Both must use the same Privy App ID from [Privy Dashboard](https://dashboard.privy.io).

**Optional configuration** - see `.env.example` files for all options:
- `packages/server/.env.example` - Database, ports, LiveKit voice chat
- `packages/client/.env.example` - API URLs, Farcaster integration
- `packages/asset-forge/.env.example` - AI API keys (OpenAI, Meshy)
- `packages/plugin-hyperscape/.env.example` - ElizaOS agent config

### Default Ports

| Port | Service | Started By |
|------|---------|------------|
| 5555 | Game Server (HTTP) | `bun run dev` |
| 5556 | Game WebSocket (uWS) | `bun run dev` |
| 3333 | Client | `bun run dev` |
| 8080 | Asset CDN | `bun run dev` |
| 3400 | AssetForge UI | `bun run dev:forge` |
| 3401 | AssetForge API | `bun run dev:forge` |
| 4001 | ElizaOS API | `bun run dev:ai` |
| 3402 | Documentation | `bun run docs:dev` |

**WebSocket Configuration**:
- **Default**: Game WebSocket runs on port 5556 (uWebSockets.js for high performance)
- **Fallback**: Set `UWS_ENABLED=false` to use port 5555 (Fastify WebSocket)
- **Client**: Update `PUBLIC_WS_URL` in `packages/client/.env` to match your configuration

## Deployment (Railway)

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

## Native App Distribution

- Desktop and mobile build artifacts are published from tagged releases (`v*`) via `.github/workflows/build-app.yml`.
- Public download portal: [https://hyperscapeai.github.io/hyperscape/](https://hyperscapeai.github.io/hyperscape/)
- Release assets and notes: [https://github.com/HyperscapeAI/hyperscape/releases](https://github.com/HyperscapeAI/hyperscape/releases)
- Release setup details and required secrets: `docs/native-release.md`

### Creating a tagged app release

```bash
git tag v1.0.0
git push origin v1.0.0
```

That tag triggers cross-platform native packaging and publishes installers to a GitHub Release.

## Troubleshooting

**Characters vanishing / not appearing on character select:**
This happens when Privy credentials are missing. Each page refresh creates a new anonymous user, orphaning your characters. Fix: Set `PUBLIC_PRIVY_APP_ID` in client `.env` and both `PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` in server `.env`.

**Assets not loading (404 errors for models/avatars):**
The CDN container needs to be running. It starts automatically with `bun run dev`, but if you're running services separately:
```bash
bun run cdn:up
```

**Database schema errors or stale data after pulling updates:**
Migrations only run once, so pulling new code won't fix an outdated database schema. Reset to fresh:
> ⚠️ **Warning:** This will delete all local data (characters, inventory, progress).
```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null; docker rm hyperscape-postgres 2>/dev/null

# Remove postgres volumes
docker volume rm hyperscape-postgres-data 2>/dev/null; docker volume rm server_postgres-data 2>/dev/null

# Remove any remaining hyperscape volumes
docker volume ls | grep -i hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify volumes are gone
docker volume ls | grep -i hyperscape

# Restart with fresh database
bun run dev
```

**Port conflicts:**
```bash
lsof -ti:5555 | xargs kill -9   # Server HTTP
lsof -ti:5556 | xargs kill -9   # Server WebSocket (uWS)
lsof -ti:3333 | xargs kill -9   # Client
lsof -ti:8080 | xargs kill -9   # CDN
```

**Build errors:**
```bash
bun run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Vite 8 / React plugin 6 errors (after March 19, 2026 updates):**
If you see plugin errors or HMR issues after updating:
```bash
# Clear Vite cache
rm -rf packages/client/.vite packages/shared/.vite packages/asset-forge/.vite

# Reinstall dependencies
bun install

# Rebuild
bun run build
```

**ethers.js v6 contract errors (after March 19, 2026 updates):**
If contract deployment fails with `deployed() is not a function`:
```typescript
// Update contract scripts to use ethers v6 API
// OLD: await contract.deployed()
// NEW: await contract.waitForDeployment()
```
See `docs/migration-march-2026.md` for complete migration guide.

**Jest snapshot errors (after March 19, 2026 updates):**
If tests fail with snapshot mismatches:
```bash
# Regenerate snapshots with new Jest 30 format
npm test -- -u
```

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Recent Updates (March 2026)

### VRM Material Isolation Fix (March 17, 2026)
**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type (hovering over one goblin highlighted all goblins).

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Impact**: Each mob instance now has independent highlight state, fixes visual bug where all VRM mobs of same type would highlight together.

### Mob AI Tick Processing Fix (March 17, 2026)
**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Impact**: Mob AI state machines now function correctly, goblins properly transition through IDLE → WANDER → CHASE → ATTACK states, deterministic OSRS-style tick ordering.

### Dev Server Performance Fix (March 16, 2026)
**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms (redundant since script already debounces rebuilds)
2. Polling fallback does a full recursive directory walk every 1s

**Fix**: Removed `awaitWriteFinish` config and increased polling fallback interval from 1s to 5s.

**Impact**: Eliminates 100% CPU usage when dev server is idle, reduces unnecessary file system polling, better developer experience with lower resource consumption, no impact on rebuild responsiveness (200ms debounce still active).

### Docker Build Improvements (March 15-18, 2026)
**Key Changes:**
- **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds in Docker
- **Multi-Service Support**: Added `packages/client` build to Docker image (required for multi-service deployments)
- **Workspace Symlinks**: Fixed Docker COPY flattening workspace symlinks with `bun install --production` in runtime stage
- **Per-Package node_modules**: Properly handles Bun 1.3's per-package dependency structure (no longer hoists to root)
- **better-sqlite3 Removal**: Stripped from manifests during build to prevent QEMU cross-compilation segfaults
- **Manifest Embedding**: Copies cleaned manifests from builder stage to ensure consistency

**Impact**: Multi-service deployments work correctly, Vite 6+ builds succeed, workspace packages (@hyperscape/*) resolve at runtime, no more QEMU segfaults.

### Dependency Updates (March 19, 2026)
**Major Version Upgrades (Breaking Changes):**
- **Vite**: 6.4.1 → 8.0.0
  - New plugin API and config schema
  - Faster builds, improved HMR, better tree-shaking
  - **Migration**: Update `vite.config.ts` for Vite 8 plugin API
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1
  - New Fast Refresh implementation for React 19
  - **Migration**: Update plugin configuration in `vite.config.ts`
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6
  - ethers.js v6 integration
  - **Migration**: Update contract deployment scripts for ethers v6 API
- **jsdom**: 28.1.0 → 29.0.0
  - Improved DOM API compatibility and performance
  - Better test environment for React 19 components
- **jest**: 29.7.0 → 30.3.0
  - New snapshot format and improved performance
  - **Migration**: Regenerate snapshots with `npm test -- -u`
- **sqlite3**: 5.1.7 → 6.0.1
  - Node.js 18+ required
  - Performance improvements
  - **Note**: Removed from Docker builds to prevent QEMU segfaults (production uses PostgreSQL)

**Minor/Patch Updates:**
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support improvements)
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (enhanced mobile wallet integration)
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (improved coverage reporting)
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)

**Impact**: 
- **Performance**: Faster builds, improved HMR, better test execution
- **Compatibility**: Better React 19 support, latest VRM features, enhanced mobile wallet integration
- **Type Safety**: Improved TypeScript definitions for Three.js WebGPU renderer
- **Breaking Changes**: Requires migration for Vite configs, contract scripts, and test snapshots

**Migration Checklist**:
1. Update `vite.config.ts` plugin configurations for Vite 8 API
2. Ensure Fast Refresh configuration is compatible with React plugin 6
3. Update contract deployment scripts to use ethers v6 API
4. Regenerate Jest snapshots: `npm test -- -u`
5. Verify Node.js 18+ is installed (for sqlite3 6, though not used in production)

**📖 Complete Migration Guide**: See [`docs/migration-march-2026.md`](docs/migration-march-2026.md) for detailed migration steps, code examples, and troubleshooting.

## More Info

See [AGENTS.md](AGENTS.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
