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
| **AI Agents** | ElizaOS-powered autonomous gameplay, 13 frontier LLM models via ElizaCloud, spectator mode |
| **Streaming** | Multi-platform RTMP streaming (Twitch, Kick, YouTube), dedicated streaming entry points |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.1.38+)
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### Setup Environment Files

> **⚠️ WebGPU Linux / Streaming Note**: When running Hyperscape on Linux (e.g. Vast.ai), you must use headful Chrome with Xorg/Xvfb. For production streaming, use Chrome Beta channel (`google-chrome-beta`) with default ANGLE backend (`--use-angle=default`). **Critical**: When using Playwright for streaming capture, use `ignoreDefaultArgs: ['--enable-unsafe-swiftshader']` to prevent CPU software rendering from blocking WebGPU. System FFmpeg is preferred over ffmpeg-static to avoid segfaults.

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
├── shared/              # Core 3D engine (ECS, Three.js 0.183.2, PhysX, networking, React UI)
├── server/              # Game server (Fastify, WebSockets, PostgreSQL pool: 20, oracle publisher)
├── client/              # Web client (Vite, React, streaming entry points: stream.html)
├── plugin-hyperscape/   # ElizaOS AI agent plugin (ElizaCloud integration)
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation + VFX catalog
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
└── contracts/           # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet). Oracle functionality remains in Hyperscape for duel outcome verification.

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
bun run dev:duel      # Full duel stack with AI agents and streaming
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
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, ElizaCloud API key, streaming (RTMP), oracle
- `packages/client/.env.example` - API URLs, Farcaster integration
- `packages/asset-forge/.env.example` - AI API keys (OpenAI, Meshy)
- `packages/plugin-hyperscape/.env.example` - ElizaOS agent config

**Key Optional Features:**
- **ElizaCloud AI**: Set `ELIZAOS_CLOUD_API_KEY` in server `.env` for access to 13 frontier LLM models (GPT-5, Claude 4.6, Gemini 3.1 Pro, Grok 4, DeepSeek V3.2, Qwen 3 Max, and more)
- **RTMP Streaming**: Set `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, or `YOUTUBE_STREAM_KEY` for multi-platform streaming (auto-detected)
- **Duel Oracle**: Set `DUEL_ARENA_ORACLE_ENABLED=true` and configure EVM/Solana signers for verifiable duel outcome publishing

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

## Streaming (RTMP)

Hyperscape supports multi-platform RTMP streaming to Twitch, Kick, and YouTube with automatic destination detection.

### Quick Start

1. **Set stream keys** in `packages/server/.env`:
   ```bash
   TWITCH_STREAM_KEY=live_123456789_abcdefghij
   KICK_STREAM_KEY=your-kick-stream-key
   YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
   ```

2. **Run the duel stack** (includes streaming):
   ```bash
   bun run dev:duel
   ```

Stream destinations are auto-detected from available keys. No manual configuration needed.

### Streaming Architecture

- **Capture Mode**: CDP (Chrome DevTools Protocol) for reliable frame capture (default)
- **Browser**: Chrome Beta with default ANGLE backend for WebGPU stability
- **Virtual Display**: Xvfb on Linux for headless GPU rendering (DISPLAY=:99)
- **Entry Points**: Dedicated `stream.html` for optimized streaming capture (separate bundle)
- **Pipeline**: Playwright → CDP → FFmpeg (system preferred) → RTMP
- **Encoding**: x264 with zerolatency tune, GOP=30 (1s segments at 30fps)
- **Physics**: Client-side PhysX skipped for streaming/spectator viewports (memory optimization)

### Environment Variables

```bash
# Stream keys (auto-detected destinations)
TWITCH_STREAM_KEY=...           # or TWITCH_RTMP_STREAM_KEY
KICK_STREAM_KEY=...
YOUTUBE_STREAM_KEY=...          # or YOUTUBE_RTMP_STREAM_KEY

# Streaming configuration (defaults shown)
STREAM_CAPTURE_MODE=cdp         # or mediarecorder
STREAM_CAPTURE_CHANNEL=chrome-beta
STREAM_CAPTURE_ANGLE=default
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
DISPLAY=:99                     # Xvfb virtual display (Linux)
```

### Vast.ai GPU Streaming

For production streaming on Vast.ai GPU instances:

1. **GPU Requirements**: NVIDIA GPU with display driver (`gpu_display_active=true`)
2. **Chrome Beta**: Installed automatically by `scripts/deploy-vast.sh`
3. **Xvfb**: Virtual display started before PM2 processes
4. **PM2 Environment**: `DISPLAY`, `DATABASE_URL`, and stream keys forwarded automatically
5. **Auto-Detection**: Database mode and stream destinations detected from environment

See `scripts/deploy-vast.sh` for full deployment automation.

### Troubleshooting Streaming

**Stream not starting:**
- Verify stream keys are set and valid
- Check FFmpeg is installed: `which ffmpeg`
- Ensure Playwright Chromium is installed: `bunx playwright install chromium`
- Verify GPU display driver is active (Vast.ai: `gpu_display_active=true`)

**Black screen / frozen stream:**
- Check Chrome Beta is installed: `google-chrome-beta --version`
- Verify Xvfb is running: `ps aux | grep Xvfb`
- Ensure `DISPLAY=:99` is set in environment
- Check Playwright isn't injecting `--enable-unsafe-swiftshader` (blocks WebGPU)
- Verify ANGLE backend is set to `default` (not `vulkan` or `gl`)
- Check Chrome feature flags include `WebGPU,UnsafeWebGPU,WebGPUDeveloperFeatures`

**RTMP connection failures:**
- Check for stale FFmpeg processes: `pkill -f ffmpeg`
- Verify stream keys match platform requirements
- Review logs: `bunx pm2 logs hyperscape-duel`

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

**Database connection pool exhaustion:**
If seeing "timeout exceeded when trying to connect" errors, the PostgreSQL connection pool has been increased to 20 connections (March 2026). Configure via `POSTGRES_POOL_MAX` and `POSTGRES_POOL_MIN` in server `.env`.

**CSRF 403 errors on account creation:**
If account creation fails with "CSRF validation failed" when running client on localhost against a deployed server, this was fixed in March 2026 (commit 0b1a0bd). Ensure you're running the latest version.

## More Info

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and recent changes documentation.

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
