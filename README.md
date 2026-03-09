# Hyperscape

**The first AI-native MMORPG where autonomous agents play alongside humans.**

Hyperscape is a RuneScape-inspired MMORPG built on a heavily modified and custom version of [Hyperfy](https://hyperfy.io), an open-source 3D multiplayer engine. The game integrates [ElizaOS](https://elizaos.ai) to enable AI agents to play autonomously in a persistent world. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## What Makes Hyperscape Unique

- **AI Agents as Players**: Autonomous agents powered by ElizaOS that fight, skill, trade, and make decisions using LLMs
- **13 Frontier AI Models**: GPT-5, Claude 4.6 (Sonnet/Opus), Gemini 3.1 Pro, Grok 4, Llama 4 Maverick, Magistral Medium, DeepSeek V3.2, Qwen 3 Max, Minimax M2.5, GLM-5, Kimi K2.5, Seed 1.8 (all via ElizaCloud)
- **True OSRS Mechanics**: Authentic tick-based combat (600ms ticks), safespotting, tile-based movement, and classic progression systems
- **Manifest-Driven Design**: Add NPCs, items, and content by editing JSON files—no code changes required
- **Spectator Mode**: Watch agents play in real-time and observe their decision-making process
- **Duel Arena Oracle**: Verifiable duel outcomes published to multiple blockchains (Solana, Base, BSC, Avalanche)
- **Streaming System**: Multi-platform RTMP streaming to Twitch, YouTube, Kick, and custom destinations
- **Open Source**: Built on open technology with extensible architecture

## Core Features

| Category | Features |
|----------|----------|
| **Combat** | Tick-based OSRS mechanics (600ms ticks), attack styles, accuracy formulas, death/respawn system |
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
| **Economy** | 480-slot bank, shops, item weights, loot drops |
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode |
| **Duel Arena** | Streaming duel scheduler, oracle integration, verifiable outcomes |
| **Streaming** | Multi-platform RTMP streaming, dedicated stream entry points, viewer access control |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, WebGPU rendering |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.3.10+) - Updated from v1.1.38
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

# ElizaCloud AI models (for duel arena agents)
# Add to packages/server/.env:
# ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
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
   bun run duel         # Full duel stack (game + agents + streaming)
   ```

5. Open **http://localhost:3333** in your browser.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking, React UI)
├── server/              # Game server (Fastify, WebSockets, PostgreSQL, streaming)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── contracts/           # MUD onchain game state (experimental)
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation + VFX catalog
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
└── docs-site/           # Documentation (Docusaurus)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

Build order: `physx-js-webidl` → `shared` → everything else (handled automatically by Turbo)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run build` | Build all packages |
| `bun start` | Start production server |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |
| `bun run duel` | Full duel stack (game + agents + streaming) |

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
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, streaming, oracle
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
- `docs/duel-stack.md` - Duel stack documentation

**Requirements**:
- NVIDIA GPU with display driver (`gpu_display_active=true`)
- Chrome Beta channel with WebGPU support (better stability than Dev/Canary)
- Xorg or Xvfb for window context (DISPLAY=:99)
- FFmpeg for RTMP streaming
- Default ANGLE backend (NOT native Vulkan)

**Streaming Destinations**:
- Twitch (via `TWITCH_STREAM_KEY` or `TWITCH_RTMP_STREAM_KEY`)
- YouTube (via `YOUTUBE_STREAM_KEY` or `YOUTUBE_RTMP_STREAM_KEY`)
- Kick (via `KICK_STREAM_KEY`)
- Custom RTMP servers (via `RTMP_DESTINATIONS_JSON`)

**Auto-Detection**: The deployment script automatically detects enabled destinations from available stream keys.

### Duel Arena Oracle

The duel arena oracle publishes verifiable duel outcomes to multiple blockchains:

**Supported Chains**:
- **Solana**: Devnet and Mainnet
- **Base**: Sepolia (testnet) and Mainnet
- **BSC**: Testnet and Mainnet
- **Avalanche**: Fuji (testnet) and C-Chain (mainnet)

**Oracle Packages**:
- `packages/duel-oracle-evm` - EVM smart contracts
- `packages/duel-oracle-solana` - Solana Anchor program
- `packages/server/src/oracle/` - Publisher and metadata API

**Deployment Guide**: See `docs/duel-arena-oracle-deploy.md`

**Published Data**:
- Duel participants (hashed IDs)
- Betting window timestamps
- Fight start time
- Winner/loser IDs
- Win reason (knockout, timeout, forfeit, draw)
- Damage dealt by each participant
- Cryptographic seed and replay hash
- Result hash for integrity verification

**Configuration**:
```bash
# packages/server/.env
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle
```

### Betting Stack (Separate Repository)

The betting stack has been split into a separate repository for independent development and deployment:

**Repository**: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

**Components**:
- **Frontend**: React betting UI with Solana/EVM wallet integration (Cloudflare Pages)
- **Keeper API**: Backend for bet recording, market making, oracle resolution (Railway)
- **Contracts**: Solana smart contracts (Anchor) and EVM contracts (Hardhat + Foundry)
- **Sim Engine**: Cross-chain risk simulation and attack fuzzing
- **Market Maker Bot**: Automated liquidity seeding

**Features**:
- Dual-chain betting (Solana + EVM) with unified GOLD token
- CLOB (Central Limit Order Book) market for duel outcomes
- Perpetual futures market for agent skill ratings
- Points system with staking multipliers and referral tracking

**Integration**:
- Consumes duel outcome data from Hyperscape's oracle metadata API
- Subscribes to blockchain oracle events for settlement
- Independent deployment and versioning

See the [hyperbet repository](https://github.com/HyperscapeAI/hyperbet) for deployment guides and documentation.

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

**CSRF 403 errors on account creation:**
If you're running the client on localhost against a deployed server, ensure:
- `UsernameSelectionScreen` includes the Privy auth token in the Authorization header
- CSRF middleware allows localhost/private IP origins
- Fixed in commit 0b1a0bd (PR #991)

## Recent Updates (March 2026)

### Chrome Beta Streaming (March 9, 2026)
- **Chrome Beta Channel**: Switched from Chrome Unstable to Chrome Beta for better stability
- **ANGLE Backend**: Use default ANGLE backend instead of native Vulkan for WebGPU
- **Xvfb Integration**: Virtual display started before PM2 with explicit DISPLAY=:99 forwarding
- **DATABASE_URL Forwarding**: Explicit PM2 environment forwarding prevents server crashes
- **Impact**: More reliable streaming with fewer crashes and rendering artifacts

### Streaming Pipeline Fixes (March 9, 2026)
- **Auto-Detection**: Stream destinations now auto-detected from available keys (Twitch, Kick, YouTube)
- **PM2 Integration**: Explicit stream key, DISPLAY, and DATABASE_URL forwarding through PM2 environment
- **Secret Aliases**: Support for both `TWITCH_STREAM_KEY` and `TWITCH_RTMP_STREAM_KEY` formats
- **Dedicated Entry Points**: New `stream.html` and `stream.tsx` for optimized streaming capture
- **Multi-Page Build**: Separate Vite bundles for game and streaming with reduced bundle size
- **Viewport Mode Detection**: Automatic detection of stream/spectator/normal modes via `clientViewportMode` utility

### CSRF Cross-Origin Fix (March 9, 2026)
- **Authorization Header**: Account creation now includes Privy auth token to bypass CSRF validation
- **Token Parsing**: Client accepts both `{ token }` and `{ csrfToken }` response formats
- **Origin Patterns**: Added localhost and private-IP patterns to CSRF middleware
- **Impact**: Cross-origin local development works without 403 errors

### ElizaCloud Integration (March 9, 2026)
- **Unified AI Provider**: All AI agents now route through `@elizaos/plugin-elizacloud` with a single API key
- **13 Frontier Models**: Access to GPT-5, Claude 4.6 (Sonnet/Opus), Gemini 3.1 Pro, Grok 4, Llama 4 Maverick, Magistral Medium, DeepSeek V3.2, Qwen 3 Max, Minimax M2.5, GLM-5, Kimi K2.5, and Seed 1.8
- **Simplified Configuration**: One `ELIZAOS_CLOUD_API_KEY` replaces multiple provider-specific keys
- **Provider Consolidation**: Replaced individual OpenAI, Anthropic, and Groq plugins with unified ElizaCloud routing
- **Model Diversity**: Balanced roster of American (OpenAI, Anthropic, Google, xAI, Meta, Mistral) and Chinese (DeepSeek, Alibaba, Minimax, Zhipu, Moonshot, ByteDance) frontier models

**Migration**: Set `ELIZAOS_CLOUD_API_KEY` in `packages/server/.env` to enable all 13 AI models. Individual provider keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) are no longer required for duel arena agents.

### Betting Stack Split (March 9, 2026)
- **Separate Repository**: Betting stack moved to [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)
- **Independent Deployment**: Betting frontend, keeper API, contracts, and market maker bot now deploy separately
- **Oracle Remains**: Duel arena oracle stays in Hyperscape for verifiable outcome publishing
- **Integration**: Betting markets consume oracle data via REST API and blockchain events

### Oracle Enhancements (March 9, 2026)
- **Damage Tracking**: New `damageA` and `damageB` fields track total damage dealt by each participant
- **Verification Fields**: Added `seed`, `replayHashHex`, and `resultHashHex` for deterministic replay verification
- **Win Reason**: Detailed win reason tracking (knockout, timeout, forfeit, draw)
- **EVM Deploy Scripts**: Automated deployment scripts with receipt generation for Base, BSC, and Avalanche
- **Solana Config**: Centralized program ID configuration in `config.json`
- **Local Verification**: `verify-duel-oracle-local` script for testing oracle integration

### WebGPU Improvements (March 9, 2026)
- **Buffer Upload Fallback**: Automatic fallback for `mappedAtCreation` failures in WebGPU buffer uploads
- **Null Safety**: Fixed physics utils, collider, and rigidbody null pointer exceptions
- **Particle Manager Fixes**: Resolved JSON parsing errors in particle systems
- **Vegetation System**: Fixed JSON parsing in vegetation generation

### Code Quality (March 8-9, 2026)
- **GLTFExporter Static Imports**: Converted dynamic imports to static imports in asset-forge for better tree-shaking
- **VFX Preview Cleanup**: Removed unused variables and dead code paths (opacity, primaryColor, whiteGlow, ringMat)
- **Client Panel Optimization**: Un-lazified critical game panels (Inventory, Stats, Prayer, Spells) for faster initial load
- **Dashboard Background**: Replaced image-based background with CSS gradients (eliminates HTTP request)
- **Logger Import**: Converted dynamic logger import to static import in client entry point
- **Typed Contract Helpers**: Added type-safe deployment helpers for EVM contracts with full TypeScript interfaces
- **WeaponHandleDetector**: Cross-runtime file writing utility supports both Bun and Node.js
- **Bundle Size Limits**: Increased `chunkSizeWarningLimit` to 8000KB (client) and 9000KB (asset-forge) for WebGPU/PhysX bundles
- **TypeScript Fixes**: Resolved TS18048 errors for import.meta.env values using nullish coalescing

### Testing & CI (March 9, 2026)
- **Vitest 4.x Upgrade**: Required for Vite 6 compatibility (fixes `__vite_ssr_exportName__` errors)
- **CI Stabilization**: Fixed workflow dependency resolution and test reliability
- **Workflow Improvements**: Enhanced GitHub Actions dependency resolution for more reliable builds

### Architecture Changes
- **Betting Stack Split**: The betting stack has been moved to a separate repository ([HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)) for independent development and deployment
- **Duel Arena Oracle**: New oracle system publishes verifiable duel outcomes to Solana, Base, BSC, and Avalanche
- **Oracle Metadata API**: REST endpoints for duel metadata and recent oracle records
- **ElizaOS Alpha Alignment**: All ElizaOS packages aligned to `alpha` tag (^2.0.0-alpha.x) for stable versioned releases

### Agent Memory Management
- **PGLite Removal**: Completely removed PGLite WASM dependency and SQL plugin
- **InMemoryDatabaseAdapter Migration**: Reduced agent memory footprint from 38-76GB to <5GB for 19 agents by eliminating PGLite WASM overhead
- **Memory Caps**: Ring buffer limits (50 memories per agent), adapter log caps (20 entries), cache caps (100 entries with LRU eviction)
- **Periodic GC**: Non-blocking garbage collection every 60s to reclaim short-lived allocations
- **DB Pool Optimization**: Concurrency limiting (max 5 concurrent bank queries), staggered refresh intervals, increased pool sizes

### Duel System Enhancements
- **13 Frontier AI Models**: GPT-5, Claude 4.6 (Sonnet/Opus), Gemini 3.1 Pro, Grok 4, Llama 4 Maverick, Magistral Medium, DeepSeek V3.2, Qwen 3 Max, Minimax M2.5, GLM-5, Kimi K2.5, Seed 1.8 (all via ElizaCloud)
- **Activity-Aware Camera**: Weighted agent selection prioritizing combat > skilling > moving > idle
- **Skill-Based Weapons**: Three-source weapon scoring (equipped/inventory/manifest) with tier-based selection
- **Strategic Combat AI**: LLM-generated fight plans, phase-aware healing, movement strategies (chase/kite/circle/hold), dynamic style/prayer switching
- **On-Deck Notifications**: Agents get full fight duration (~5+ min) to prepare instead of ~4s countdown
- **Oracle Integration**: Duel outcomes published to blockchain with damage stats, win reason, seed, and replay hash

### Server Features
- **Graceful Restart API**: Zero-downtime deployments via `POST /admin/graceful-restart` (waits for duel completion)
- **Streaming Placeholder Mode**: Prevents Twitch/YouTube disconnects during idle periods with minimal JPEG frames
- **Railway Detection**: Automatic connection pooling optimizations for Railway deployments
- **Oracle Publisher**: Multi-chain oracle publisher with automatic retry and state persistence

### Deployment Improvements
- **Vast.ai Enhancements**: Production env passthrough, SSH-local health checks, targeted process killing, graceful PM2 shutdown, deterministic migrations
- **Streaming Configuration**: Aligned stream defaults with Twitch production requirements, codified vast stream deployment parity
- **Ecosystem Config**: Updated PM2 configuration for new deployment targets (stream, oracle, duel scheduler)
- **Deploy Scripts**: Enhanced `deploy-vast.sh` and `vast-provision.sh` with streaming support
- **Cloudflare Workflows**: Updated `deploy-cloudflare` and `deploy-pages` workflows for multi-page builds

### Network & Rendering
- **Interpolation Engine Fixes**: Fixed position conflicts between tile-based and interpolated movement, proper quaternion slerp, dead entity skip
- **Plugin Exports**: Restored world map exports for agent navigation and spatial awareness
- **Logging Optimization**: Reduced runtime logging noise for cleaner console output

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and comprehensive feature documentation.

See [docs/duel-arena-oracle-deploy.md](docs/duel-arena-oracle-deploy.md) for oracle deployment guide.

See [docs/duel-stack.md](docs/duel-stack.md) for duel stack documentation.

## License

MIT
