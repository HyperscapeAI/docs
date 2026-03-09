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
| **Betting** | Solana/EVM prediction markets, CLOB trading, perpetual futures, points system with staking multipliers |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, WebGPU rendering |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.3.10+)
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)
- WebGPU-compatible browser - Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)

```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### Setup Environment Files

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

# Betting stack (only if using bun run duel)
cp packages/gold-betting-demo/.env.example packages/gold-betting-demo/.env
# Edit and set Solana/EVM RPC URLs and contract addresses
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
   # OR
   bun run duel         # Full duel stack (game + agents + betting + streaming)
   ```

5. Open **http://localhost:3333** in your browser.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database, streaming)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── gold-betting-demo/   # Solana/EVM betting stack (app + keeper + contracts)
├── evm-contracts/       # EVM betting contracts (Hardhat + Foundry)
├── contracts/           # MUD onchain game state (experimental)
├── sim-engine/          # Cross-chain betting risk simulation
├── market-maker-bot/    # Automated market making for betting markets
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
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
| `bun run duel` | Full duel stack (game + agents + betting + streaming) |

### What `bun run dev` starts

| Service | Port | Description |
|---------|------|-------------|
| Client | 3333 | Vite dev server with hot reload |
| Server | 5555 | Game server (Fastify + WebSockets) |
| CDN | 8080 | Asset server (Docker nginx) |
| PostgreSQL | 5432 | Database (Docker) |

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
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, streaming
- `packages/client/.env.example` - API URLs, Farcaster integration
- `packages/asset-forge/.env.example` - AI API keys (OpenAI, Meshy)
- `packages/plugin-hyperscape/.env.example` - ElizaOS agent config
- `packages/gold-betting-demo/.env.example` - Solana/EVM RPC URLs, contract addresses

### Default Ports

| Port | Service | Started By |
|------|---------|------------|
| 5555 | Game Server | `bun run dev` |
| 3333 | Client | `bun run dev` |
| 8080 | Asset CDN | `bun run dev` |
| 3400 | AssetForge UI | `bun run dev:forge` |
| 3401 | AssetForge API | `bun run dev:forge` |
| 4001 | ElizaOS API | `bun run dev:ai` |
| 3402 | Documentation | `bun run docs:dev` |
| 4179 | Betting App | `bun run duel` |
| 8081 | Betting Keeper | `bun run duel` |

## Deployment

### Railway (Game Server)

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

### Vast.ai (Streaming Duel Arena)

For GPU-accelerated streaming duel arena deployment on Vast.ai, see:

- `.github/workflows/deploy-vast.yml` - Automated deployment workflow
- `ecosystem.config.cjs` - PM2 process configuration
- `scripts/deploy-vast.sh` - Deployment script

### Betting Stack (Cloudflare + Railway)

For production betting stack deployment:

- Frontend: Cloudflare Pages (`packages/gold-betting-demo/app`)
- Keeper API: Railway (`packages/gold-betting-demo/keeper`)
- Contracts: Solana mainnet-beta, BSC, Base

**Deployment guides:**
- `docs/betting-production-deploy.md` - Complete betting stack deployment (Cloudflare + Railway)
- `docs/evm-contracts-deployment.md` - EVM contract deployment (BSC, Base)

**Quick deployment:**

```bash
# Preflight validation
cd packages/gold-betting-demo
bun run deploy:preflight:mainnet

# Deploy Solana programs
cd anchor
bun run deploy:mainnet

# Deploy EVM contracts
cd ../evm-contracts
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Deployment metadata:**
- All contract addresses managed in `packages/gold-betting-demo/deployments/contracts.json`
- EVM deployment receipts in `packages/evm-contracts/deployments/<network>.json`
- Automatic manifest updates after successful deployment

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
lsof -ti:5555 | xargs kill -9   # Server
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

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Recent Updates (March 2026)

### Agent Memory Management
- **InMemoryDatabaseAdapter Migration**: Reduced agent memory footprint from 38-76GB to <5GB for 19 agents by eliminating PGLite WASM overhead
- **Memory Caps**: Ring buffer limits (50 memories per agent), adapter log caps (20 entries), cache caps (100 entries with LRU eviction)
- **Periodic GC**: Non-blocking garbage collection every 60s to reclaim short-lived allocations
- **DB Pool Optimization**: Concurrency limiting (max 5 concurrent bank queries), staggered refresh intervals, increased pool sizes

### Duel System Enhancements
- **19 AI Models**: Expanded roster including GPT-4.1, o4 Mini, o3 Mini, Claude Opus 4, Claude Sonnet 4, Llama 3.3 70B
- **Activity-Aware Camera**: Weighted agent selection prioritizing combat > skilling > moving > idle
- **Skill-Based Weapons**: Three-source weapon scoring (equipped/inventory/manifest) with tier-based selection
- **Strategic Combat AI**: LLM-generated fight plans, phase-aware healing, movement strategies (chase/kite/circle/hold), dynamic style/prayer switching
- **On-Deck Notifications**: Agents get full fight duration (~5+ min) to prepare instead of ~4s countdown
- **18 Audit Fixes**: Prayer IDs, combat AI improvements, broadcast enhancements, simultaneous death handling, draw outcomes, streaming duel history

### Server Features
- **Graceful Restart API**: Zero-downtime deployments via `POST /admin/graceful-restart` (waits for duel completion)
- **Streaming Placeholder Mode**: Prevents Twitch/YouTube disconnects during idle periods with minimal JPEG frames
- **Railway Detection**: Automatic connection pooling optimizations for Railway deployments

### Testing & CI
- **Vitest 4.x Upgrade**: Required for Vite 6 compatibility (fixes `__vite_ssr_exportName__` errors)
- **CI Stabilization**: Fixed client test runner, duel agent tests, vegetation concurrency tests, asset forge module resolution
- **Anchor Test Config**: Skip localnet tests in CI when Solana CLI not installed

### Deployment
- **Vast.ai Enhancements**: Production env passthrough, SSH-local health checks, targeted process killing, graceful PM2 shutdown, deterministic migrations
- **Solana Configuration**: Runtime defaults for program IDs and gold mint, environment passthrough, auto-discovery
- **Betting Stack Integration**: Full Solana/EVM betting system with CLOB markets, perps, points, and referrals
  - Frontend: Cloudflare Pages deployment
  - Keeper: Railway deployment with persistent storage
  - Contracts: Solana mainnet-beta, BSC, Base
  - Security: Passed Anchor audit, fuzz testing, exploit resistance
  - See `docs/betting-production-deploy.md` for deployment guide

### Branding
- **Git LFS Integration**: Binary branding files (.ai, .eps, .pdf, .png, .jpg) now tracked via Git LFS to prevent repo bloat (~28 MB)
- **Documentation**: `publishing/branding/README.md` documents logo variants and usage guidelines

### Network & Rendering
- **Interpolation Engine Fixes**: Fixed position conflicts between tile-based and interpolated movement, proper quaternion slerp, dead entity skip
- **Plugin Exports**: Restored world map exports for agent navigation and spatial awareness
- **Logging Optimization**: Reduced runtime logging noise for cleaner console output

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and comprehensive feature documentation.

## License

MIT
