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
- [Bun](https://bun.sh) (v1.3.10+) - updated from v1.1.38
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

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
├── procgen/             # Procedural generation (terrain, vegetation, buildings)
├── gold-betting-demo/   # Solana/EVM betting demo app
│   ├── app/             # React betting UI (Cloudflare Pages)
│   ├── anchor/          # Solana programs (Anchor framework)
│   └── keeper/          # Automated keeper bot (Railway)
├── evm-contracts/       # EVM smart contracts (Hardhat/Foundry)
├── sim-engine/          # Cross-chain risk simulation engine
└── docs-site/           # Documentation (Docusaurus)

publishing/
└── branding/            # Official logo files (SVG, EPS, PDF, PNG, JPG)
                         # Binary files tracked via Git LFS
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
bunx drizzle-kit migrate   # Run pending migrations (deterministic, sorted order)
```

### Assets

Game assets (3D models, textures, audio) source: [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets)

**Local Development**: Assets are auto-downloaded during `bun install` (~200MB via Git LFS).

```bash
bun run assets:sync    # Pull latest assets from repo (local dev only)
```

**Production/CI**: Manifests are committed to the repo at `packages/server/world/assets/manifests/`.

### Vast.ai Commands

```bash
# Search for WebGPU-capable instances
VAST_API_KEY=xxx bun run vast:search

# Provision new instance automatically
VAST_API_KEY=xxx bun run vast:provision

# Check current instance status
VAST_API_KEY=xxx bun run vast:status

# Destroy current instance
VAST_API_KEY=xxx bun run vast:destroy

# Run vast-keeper monitoring service
VAST_API_KEY=xxx bun run vast:keeper

# Check streaming health (server health, RTMP bridge, PM2 processes, logs)
bun run duel:status
```

**Vast.ai Provisioner** (`./scripts/vast-provision.sh`):
- Automatically searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr), disk space (≥120GB)
- Rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Saves configuration to `/tmp/vast-instance-config.env`

**Requirements**:
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

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
| 5555 | Game Server | `bun run dev` |
| 3333 | Client | `bun run dev` |
| 8080 | Asset CDN | `bun run dev` |
| 3400 | AssetForge UI | `bun run dev:forge` |
| 3401 | AssetForge API | `bun run dev:forge` |
| 4001 | ElizaOS API | `bun run dev:ai` |
| 3402 | Documentation | `bun run docs:dev` |

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

## Recent Improvements (March 2026)

### Agent Memory Management

**InMemoryDatabaseAdapter Migration** (commit 429bfbf):
- Replaced PGLite WASM with ElizaOS's InMemoryDatabaseAdapter
- Reduced agent memory footprint from 38-76GB to <5GB for 19 agents
- Zero WASM overhead while maintaining full agent functionality

**Memory Accumulation Caps** (commits c2661430, 5ae4be9):
- Cap each agent to 50 memories via ring buffer (evict oldest on overflow)
- Adapter logs capped at 20 entries (stores full LLM prompts+responses)
- Adapter cache capped at 100 entries with LRU eviction
- Periodic adapter flush every 60s for entities/rooms/worlds/tasks
- Periodic Bun.gc(false) every 20 ticks (~60s) to reclaim short-lived allocations

**Database Connection Pool Optimization** (commit a312abe):
- Concurrency limiter (max 5) for bank queries to prevent DB pool exhaustion
- Staggered refresh intervals with random offset to prevent agent synchronization
- Serverless PG pool increased from 10→20 max, 30s→60s timeout

**Sequential Agent Spawning** (commit afc15c3):
- First agent spawns sequentially for SQL migrations
- Remaining agents batch spawn in parallel
- Prevents concurrent ALTER TABLE races on Neon serverless PostgreSQL

### Duel System Enhancements

**Expanded Model Roster** (commit f6a8ba3):
- 19 AI models: GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, o4 Mini, o3 Mini (OpenAI), Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5 (Anthropic), Llama 3.3 70B, Llama 4 Scout, Llama 4 Maverick, Kimi K2, Qwen 3 30B (Groq)
- MAX_MODEL_AGENTS bumped from 10 to 25

**Activity-Aware Idle Camera** (commit 0a3b0af):
- Weighted agent selection based on activity type (combat > skilling > moving > idle)
- On-deck duel boost for agents selected for next duel
- Camera now focuses on active gameplay instead of idle agents

**Skill-Based Weapon Selection** (commit b71f512):
- Three-source weapon scoring (equipped gear, inventory, item manifest)
- Pick strongest combat style based on actual skill levels
- Agents use weapons appropriate for their skill levels

**Strategic Duel Combat AI** (commit b71f512):
- LLM-generated fight plans with character personality
- Phase-aware healing (desperate/trading/finishing/opening)
- Movement strategies (chase/kite/circle/hold)
- Dynamic style and prayer switching
- Cooldown-tracked trash talk with personality-driven LLM taunts

**On-Deck Duel Notification** (commit 656fdb7):
- Agents get full fight duration (~5+ min) to prepare instead of ~4s countdown
- Preparation state machine: bank items → withdraw food → move to lobby
- New packets: duelOnDeck, duelCountdownStart, duelCountdownTick, duelOpponentDisconnected, duelOpponentReconnected

**Duel Pipeline Audit** (commit 4c16ea3):
- Fixed 18 audit findings including prayer IDs, combat AI, broadcast timing
- Simultaneous death handling via damage comparison
- Escalating combat stall nudges
- New `streaming_duel_history` table for draw outcomes

### Deployment & Infrastructure

**Graceful Restart** (commit c76ca516):
- POST /admin/graceful-restart - Request restart after current duel ends
- GET /admin/restart-status - Check if restart is pending
- Zero-downtime deployments for duel arena stream

**Deployment Process** (commits 087033fa, 58d88f4c, 46324033, b71796b3, 54eef352):
- Process teardown before migration to prevent "too many clients" errors
- Targeted process killing (avoid killing deploy script itself)
- Runtime secrets loading from `/tmp/hyperscape-secrets.env`
- PM2 environment passthrough via `--update-env` flag
- Deterministic migrations (sorted order)
- Solana runtime defaults in PM2 config

**Railway Database Support** (commits d8c26d2, a5a201c):
- Auto-detection via `RAILWAY_ENVIRONMENT` env var
- Railway proxy detection for pgbouncer support
- Disables prepared statements when using Railway proxy
- Lower connection pool limits (max: 6) for pooler connections

**Placeholder Frame Mode** (commit 83056565):
- Set `STREAM_PLACEHOLDER_ENABLED=true` to enable placeholder frames during idle periods
- Prevents Twitch/YouTube 30-minute disconnect during content gaps
- Minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg

### Testing & CI

**Vitest 4.x Upgrade** (commit a916e4ee):
- Upgraded from 2.1.0 to 4.0.6 for Vite 6 compatibility
- Fixes `__vite_ssr_exportName__` errors during test runs

**Anchor Test Skip** (commit 8b7d126):
- Automatically skip Anchor localnet tests in CI when Solana CLI is not installed
- Prevents false failures in CI environments

**GitHub Actions Fixes** (commit f892d0b2):
- Fixed upload-artifact version (v7 → v4) across all workflows
- Fixed build order in ci.yml (shared must build before impostors/procgen)
- Fixed heredoc variable expansion in deploy-vast.yml

### Branding Assets

**Git LFS for Binary Files** (commit f334c57):
- Binary branding files (.ai, .eps, .pdf, .png, .jpg) tracked via Git LFS
- Prevents repo bloat (~28 MB of design assets)
- SVG files remain in Git (text format)
- See `publishing/branding/README.md` for usage guidelines

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

**Railway "too many clients already" errors:**
- Set `POSTGRES_POOL_MAX=3` (or lower) in `.env`
- Set `POSTGRES_POOL_MIN=0` to not hold idle connections
- Increase `restart_delay=10s` in PM2 config to allow connections to close
- Railway is auto-detected via `RAILWAY_ENVIRONMENT` env var

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

**Vitest errors after upgrading to Vite 6:**
- Upgrade vitest to 4.x: `bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6`
- Vitest 2.x is incompatible with Vite 6.x (causes `__vite_ssr_exportName__` errors)

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and agent memory management details.

## License

MIT
