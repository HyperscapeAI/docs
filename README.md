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
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, **WebGPU rendering** |

## System Requirements

**Browser Requirements:**
- **WebGPU support required** - Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+)
- Check compatibility: [webgpureport.org](https://webgpureport.org)
- See [docs/webgpu-requirements.md](docs/webgpu-requirements.md) for full details

**Development Prerequisites:**
- [Bun](https://bun.sh) (v1.1.38+)
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

## Quick Start

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
   JWT_SECRET=your-secure-random-string
   ```

> **⚠️ Without Privy credentials**, the game runs in anonymous mode where users get a new identity on every page refresh. Characters will appear to vanish because they're tied to the old anonymous account.

**Production Security Requirements:**
- **JWT_SECRET** is now **required** in production/staging environments (throws error if not set)
- Generate with: `openssl rand -base64 32`
- **ADMIN_CODE** should be set to prevent unauthorized admin access

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

5. Open **http://localhost:3333** in **Chrome 113+** or **Edge 113+**.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (trees, rocks, terrain)
├── asset-forge/         # AI asset generation tools + VFX catalog
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `procgen` → `shared` → everything else (handled automatically by Turbo)

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
bun run dev:forge     # AssetForge tools + VFX catalog (ports 3400, 3401)
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
- `packages/server/.env` - Set `PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `JWT_SECRET`

Both must use the same Privy App ID from [Privy Dashboard](https://dashboard.privy.io).

**Optional configuration** - see `.env.example` files for all options:
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, streaming, maintenance mode
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

Hyperscape supports multiple deployment targets:

| Target | Use Case | Documentation |
|--------|----------|---------------|
| **Cloudflare Pages** | Static client hosting | [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md) |
| **Railway** | Game server (dev/prod) | [docs/railway-dev-prod.md](docs/railway-dev-prod.md) |
| **Vast.ai** | GPU streaming & duels | [docs/vast-deployment.md](docs/vast-deployment.md) |

### Cloudflare Pages (Client)

- **URL**: https://hyperscape.gg
- **Build**: Automatic on push to `main`
- **Assets**: Served from Cloudflare R2 (https://assets.hyperscape.club)
- **CORS**: Configured for cross-origin asset loading

### Railway (Game Server)

- `main` branch → `prod` environment
- `develop` branch → `dev` environment
- See [docs/railway-dev-prod.md](docs/railway-dev-prod.md)

### Vast.ai (Streaming)

- GPU-accelerated rendering with WebGPU + Vulkan
- Automated maintenance mode for graceful deployments
- Multi-platform RTMP streaming (Twitch, Kick, X)
- Chrome Dev + Xvfb for headless rendering
- See [docs/vast-deployment.md](docs/vast-deployment.md)

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

**WebGPU not supported error:**
Hyperscape requires WebGPU (all shaders use TSL). Check browser compatibility:
- Chrome/Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS 15+ only)
- Firefox: WebGPU support is experimental (not recommended)

Visit [webgpureport.org](https://webgpureport.org) to verify your browser/GPU support. See [docs/webgpu-requirements.md](docs/webgpu-requirements.md) for full requirements.

**Characters vanishing / not appearing on character select:**
This happens when Privy credentials are missing. Each page refresh creates a new anonymous user, orphaning your characters. Fix: Set `PUBLIC_PRIVY_APP_ID` in client `.env` and both `PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` + `JWT_SECRET` in server `.env`.

**Assets not loading (404 errors for models/avatars):**
The CDN container needs to be running. It starts automatically with `bun run dev`, but if you're running services separately:
```bash
bun run cdn:up
```

**CORS errors loading assets from R2:**
R2 bucket needs CORS configuration. Run:
```bash
bash scripts/configure-r2-cors.sh
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

**CI/CD npm 403 errors:**
GitHub Actions may hit npm rate limits. The CI now uses `--frozen-lockfile` and retry logic with exponential backoff (15s, 30s, 45s, 60s, 75s delays).

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Recent Updates (February 2026)

### AI Agents
- ✅ **Model agent stability** - Circuit breakers, timeouts, memory leak fixes, graceful shutdown
- ✅ **Quest-driven tools** - Replaced starter chest with quest-based tool acquisition
- ✅ **Autonomous banking** - Agents auto-deposit at 25/28 slots, keep essential tools
- ✅ **Action locks** - Skip LLM during movement, fast-tick mode for quick follow-up
- ✅ **Resource detection** - Increased approach range from 20m to 40m
- ✅ **Database isolation** - Force PGLite for agents, prevent schema conflicts

### Streaming & Audio
- ✅ **PulseAudio audio capture** - Game music and sound effects in streams
- ✅ **Improved buffering** - Changed from 'zerolatency' to 'film' tune, 4x buffer size
- ✅ **Audio stability** - Wall clock timestamps, async resampling, removed -shortest flag
- ✅ **Multi-platform RTMP** - Twitch, Kick, X (YouTube removed)
- ✅ **Stream key management** - Explicit unset/re-export prevents stale keys
- ✅ **Public delay to 0ms** - Live betting mode (was 12-15s)

### Deployment & Infrastructure
- ✅ **Cloudflare Pages workflow** - Automated client deployment on push to main
- ✅ **DATABASE_URL persistence** - Survives git reset operations in CI/CD
- ✅ **Database warmup** - 3 retry attempts prevent cold start failures
- ✅ **Vast.ai improvements** - Vulkan drivers, health checking, Chrome Dev channel, diagnostics
- ✅ **CSRF cross-origin handling** - Apex domain support for Cloudflare Pages → Railway
- ✅ **R2 CORS configuration** - Automated setup for cross-origin asset loading
- ✅ **Solana keypair setup** - Automated from SOLANA_DEPLOYER_PRIVATE_KEY env var

### Rendering & Performance
- ✅ **WebGPU enforcement** - WebGL fallback removed (all shaders use TSL)
- ✅ **Type safety** - Reduced explicit `any` types from 142 to ~46
- ✅ **Memory leak fixes** - AbortController for event listener cleanup
- ✅ **Dead code removal** - 3098 lines removed (PacketHandlers.ts)

### Solana Markets
- ✅ **WSOL default** - Markets use native token (WSOL) instead of custom GOLD
- ✅ **Perps oracle disabled** - Default off (program not deployed on devnet)
- ✅ **MARKET_MINT variable** - Replaced GOLD_MINT for flexibility

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## Documentation

### Deployment
- [docs/cloudflare-pages-deployment.md](docs/cloudflare-pages-deployment.md) - Cloudflare Pages automated deployment
- [docs/vast-deployment-improvements.md](docs/vast-deployment-improvements.md) - Vast.ai GPU streaming improvements
- [docs/railway-dev-prod.md](docs/railway-dev-prod.md) - Railway deployment (dev/prod)
- [docs/native-release.md](docs/native-release.md) - Native app releases

### Streaming
- [docs/streaming-improvements-feb-2026.md](docs/streaming-improvements-feb-2026.md) - RTMP streaming improvements
- [docs/streaming-audio-capture.md](docs/streaming-audio-capture.md) - PulseAudio audio capture setup

### AI Agents
- [docs/agent-stability-improvements.md](docs/agent-stability-improvements.md) - Model agent stability fixes

### Blockchain
- [docs/solana-market-wsol-migration.md](docs/solana-market-wsol-migration.md) - WSOL market token migration

### Technical
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - Browser and GPU requirements
- [CLAUDE.md](CLAUDE.md) - Development guide and architecture

## License

MIT
