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
| **AI Agents** | ElizaOS-powered autonomous gameplay, 10 frontier LLM models (Anthropic/Groq), spectator mode, autonomous behavior between duels |
| **Streaming** | Multi-platform RTMP streaming (Twitch, Kick, YouTube), CDP capture, 30fps frame pacing, HLS preview |
| **Terrain** | Biome-based generation, quadtree LOD (5 levels), infinite rendering, batched tree instancing |
| **Admin** | Maintenance mode, live controls dashboard, log streaming, graceful restarts, safe-to-deploy checks |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, WebGPU rendering |

## Recent Updates (March 2026)

### Docker Workspace Symlinks Fix (March 12, 2026)
- **Problem**: Docker COPY flattens workspace symlinks in `node_modules`, breaking runtime module resolution for externalized packages
- **Fix**: Added `bun install --production` in Docker runtime stage to restore workspace symlinks
- **Impact**: Server can now resolve @hyperscape/* workspace packages in production Docker deployments

### Model Provider Diversity (March 12, 2026)
- **Change**: Switched from ElizaCloud to direct Anthropic/Groq providers with interleaved selection
- **Models**: Claude Sonnet 4.6, Llama 4 Scout, Claude Opus 4.6, Llama 4 Maverick, Claude Haiku 4.5, Llama 3.3 70B, Kimi K2, Qwen 3 30B
- **Impact**: Better model diversity, reduced dependency on single provider, more resilient agent spawning

### Biome System Refactoring (March 12, 2026)
- **Removed Hardcoded Biomes**: Biome definitions now passed explicitly to `BiomeSystem` constructor
- **Dynamic Biome IDs**: Auto-assigned at runtime based on provided definitions
- **Explicit Centers**: Added `explicitCenters` option for pre-computed biome placement
- **Tree Config Unification**: Merged `distribution` and `placements` into single `trees` map
- **Slope Rejection**: Trees now rejected on steep slopes (configurable `maxSlope` per biome)
- **Impact**: More flexible biome system, cleaner API, realistic tree placement

### CDN Cache Busting & Manifest Reliability (March 13, 2026)
- **Cache Busting**: Added timestamp query parameters to all CDN manifest requests to prevent stale asset issues
- **Manifest Embedding**: Server Docker image now embeds manifests at build time, eliminating CDN dependency for server startup
- **Workbox Inline Runtime**: Service worker now inlines Workbox runtime to prevent MIME type errors on PWA updates
- **Deployment Fixes**: Improved manifest upload workflow to prevent submodule overwrites and ensure fresh manifests in production
- **Impact**: Eliminates stale manifest errors, more reliable deployments, better PWA update experience

### Tree Shader Lighting Fix (March 12, 2026)
- **Vertex Sphere Normals**: Fixed tree lighting to use sphere normals baked into vertex attributes instead of normal maps
- **Night Lighting**: Uniform night dimming maintains consistent light-shadow contrast (~1.35x ratio) across day/night cycle
- **Visual Quality**: SSS (subsurface scattering), edge brightening, and saturation boost now scale with dayFactor for natural appearance
- **Impact**: Correct volumetric foliage lighting, eliminates overly bright shadows at night

### Biome Terrain Generation & Quadtree LOD (March 12, 2026)
- **TerrainQuadTree**: Hierarchical LOD system for infinite terrain rendering
  - Dynamic chunk splitting/unsplitting based on camera distance
  - 5 LOD levels (1600m root → 100m leaf chunks)
  - Uniform 32x32 vertex resolution across all levels
  - Skirt geometry to hide LOD seams
- **GLBTreeBatchedInstancer**: Multi-variant tree rendering with BatchedMesh
  - One BatchedMesh per material slot per LOD level (minimal draw calls)
  - Texture fingerprinting for automatic material slot matching
  - Smooth LOD transitions with hysteresis (prevents flickering)
  - Depleted state support (stumps after chopping)
- **Biome System**: Terrain generation with biome-specific parameters (plains, forest, desert, etc.)
- **Performance**: Reduced per-frame allocations (numeric grid coords, structural dirty flag)

### Admin Live Controls & Maintenance Mode (March 12, 2026)
- **Maintenance Mode**: Graceful server pause/resume for zero-downtime deployments
  - Safe-to-deploy flag prevents mid-duel restarts
  - Market pause during maintenance
  - Client-side warning banner (polls `/health` every 5s)
- **Live Controls Dashboard**: Real-time admin panel with HLS stream preview, server controls, live log streaming
- **Logger Ring Buffer**: 1000-entry in-memory log storage with `GET /admin/logs` API
- **Server Restart**: `POST /admin/restart` endpoint for graceful process restart (requires PM2)

### Oracle Settlement Delay & Stream Sync (March 11, 2026)
- Added `ORACLE_SETTLEMENT_DELAY_MS` (default 7000ms) to delay oracle publishing until stream catches up
- Prevents oracle publishing before stream viewers see duel outcome
- Configurable per deployment based on stream latency

### Agent Autonomous Behavior Restoration (March 11, 2026)
- Fixed agent T-pose with physics null guards for stream mode viewports
- Re-enabled autonomous behavior (mining, chopping, fishing) between duels
- Relaxed post-duel restore position (120-unit lobby → 2000-unit world boundary)
- Interleaved Anthropic/Groq model agents for provider diversity
- Bank state request on spawn for better goal planning

### Streaming Frame Pacing Fix (March 11, 2026)
- Enforced 30fps frame pacing to eliminate stream buffering
- Frame pacing guard skips frames arriving faster than 85% of 33.3ms target
- Default resolution changed from 1920x1080→1280x720 to match capture viewport
- GOP size changed from 30→60 frames (2s at 30fps) per Twitch/YouTube recommendations

### Deployment Fixes (March 11, 2026)
- **SSH Timeout**: Added `disown` after background processes to prevent 30-minute hangs
- **Orphaned Processes**: Explicit `pkill` commands to kill ghost bun server processes before deployment
- **Impact**: Deployment completes in ~1 minute, eliminates database deadlocks

### Three.js 0.183.2 Upgrade (March 10, 2026)
- Upgraded from 0.182.0 to 0.183.2 for latest WebGPU features and performance improvements
- **Breaking Change**: TSL API `atan2` renamed to `atan` (migration required for custom shaders)
- Improved WebGPU stability and shader compilation

### Streaming Pipeline Optimization (March 10, 2026)
- **Default Capture Mode**: CDP (Chrome DevTools Protocol) for reliable frame capture
- **Chrome Beta**: Switched to Chrome Beta channel for better stability (from Unstable)
- **ANGLE Backend**: Default ANGLE backend (`--use-angle=default`) for automatic best-backend selection
- **FFmpeg**: System FFmpeg preferred over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin` → `/usr/local/bin` → PATH → ffmpeg-static)
- **x264 Tuning**: `zerolatency` tune for live streaming (lower latency, was `film`)
- **RTMP Muxer**: Changed from `flv` to `fifo` muxer with `drop_pkts_on_overflow=1` to absorb network stalls
- **Physics Optimization**: Skip client-side PhysX for streaming/spectator viewports (faster startup, lower memory)
- **Playwright Fix**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering from blocking WebGPU

### Test Infrastructure Updates (March 10-11, 2026)
- Excluded `@hyperscape/impostor` from headless CI (requires WebGPU)
- Increased `sim-engine` test timeout from 60s to 120s (prevents flaky CI failures)
- Fixed cyclic dependencies and port conflicts
- WebGPU-dependent packages require local testing with GPU-enabled browsers

### Manifest Loading Fixes (March 10, 2026)
- Removed legacy `items.json` and `resources.json` (never existed)
- Added missing manifests: `ammunition.json`, `combat-spells.json`, `duel-arenas.json`, `lod-settings.json`, `quests.json`, `runes.json`
- Eliminates 404 errors during manifest loading

### CDN Configuration Simplification (March 10, 2026)
- Unified `PUBLIC_CDN_URL` environment variable (replaced `DUEL_PUBLIC_CDN_URL`)
- Consistent CDN configuration across all contexts (client, server, streaming)
- Simplified R2 CORS configuration with wildcard origin for public assets

### Service Worker Improvements (March 10, 2026)
- Switched from `CacheFirst` to `NetworkFirst` strategy for JS/CSS
- Eliminates stale module errors after rebuilds
- Aggressive cache clearing for local development

### Dependency Updates (March 10, 2026)
- **Capacitor**: 8.2.0 (Android, iOS, Core) - Latest mobile platform features
- **lucide-react**: 0.577.0 - New icons and improvements
- **three-mesh-bvh**: 0.9.9 - Better BVH performance
- **eslint**: 10.0.3 - Latest linting rules
- **jsdom**: 28.1.0 - Testing improvements
- **@ai-sdk/openai**: 3.0.41 - AI SDK updates
- **hardhat**: 3.1.11 - Smart contract tooling
- **@nomicfoundation/hardhat-chai-matchers**: 3.0.0 - Testing matchers
- **globals**: 17.4.0 - TypeScript globals

### Database & Infrastructure (March 10, 2026)
- PostgreSQL connection pool increased to 20 (from 10) to prevent timeouts under load
- Auto-detection of database mode (local vs remote) from `DATABASE_URL` hostname
- PM2 environment variable forwarding for `DISPLAY`, `DATABASE_URL`, and stream keys
- Xvfb virtual display started before PM2 on Linux for reliable GPU rendering

See [AGENTS.md](AGENTS.md) for complete changelog and technical details.

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

> **⚠️ WebGPU Linux / Streaming Note**: When running Hyperscape on Linux (e.g. Vast.ai), you must use headful Chrome with Xorg/Xvfb. For production streaming, use Chrome Beta channel (`google-chrome-beta`) with default ANGLE backend (`--use-angle=default`) for automatic best-backend selection. **Critical**: When using Playwright for streaming capture, use `ignoreDefaultArgs: ['--enable-unsafe-swiftshader']` to prevent CPU software rendering from blocking WebGPU. System FFmpeg is preferred over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static).

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
│                        # - Biome terrain generation with quadtree LOD
│                        # - GLBTreeBatchedInstancer for multi-variant trees
│                        # - Physics null guards for stream mode
├── server/              # Game server (Fastify, WebSockets, PostgreSQL pool: 20)
│                        # - Maintenance mode system
│                        # - Admin live controls dashboard
│                        # - Logger ring buffer (1000 entries)
│                        # - Oracle settlement delay (7s default)
├── client/              # Web client (Vite, React, streaming entry points: stream.html)
│                        # - Maintenance banner (polls /health every 5s)
│                        # - Admin live controls UI
│                        # - NetworkFirst service worker cache
├── plugin-hyperscape/   # ElizaOS AI agent plugin (ElizaCloud integration)
│                        # - Autonomous behavior between duels
│                        # - Interleaved model providers (Anthropic/Groq)
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (terrain, trees, rocks, plants)
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
bun run duel          # Full duel stack with AI agents and streaming
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

## Admin Dashboard

Hyperscape includes a comprehensive admin dashboard for server management and monitoring.

### Accessing the Admin Dashboard

1. **Set admin code** in `packages/server/.env`:
   ```bash
   ADMIN_CODE=your-secure-admin-code
   ```

2. **Navigate to admin panel**:
   ```
   http://localhost:3333/?page=admin
   ```

3. **Enter admin code** when prompted

### Features

- **Live Controls Tab** (NEW - March 2026):
  - HLS stream preview with embedded video player
  - Maintenance mode toggle (pause/resume game)
  - Server restart button (requires PM2)
  - Live log streaming (1000-entry ring buffer, auto-refresh every 3s)
  - Real-time status: maintenance state, viewer count, current phase
- **User Management**: View all users, characters, and sessions
- **Player Management**: Inspect player state, inventory, equipment, skills
- **Activity Log**: Server-side event history with filtering

### Admin API Endpoints

All endpoints require `x-admin-code` header:

```bash
# Maintenance Mode
POST /admin/maintenance/enter    # Pause game after current duel
POST /admin/maintenance/exit     # Resume game
GET  /admin/maintenance/status   # Check maintenance state

# Server Control
POST /admin/restart              # Restart server process (requires PM2)
GET  /admin/logs                 # Fetch recent logs (1000 entries)

# Duel Management
GET  /admin/duels/status         # Current duel cycle status
```

### Maintenance Mode

Maintenance mode enables zero-downtime deployments:

1. **Enter maintenance mode**: Pauses new duel cycles, waits for active duels to complete
2. **Safe-to-deploy check**: `safeToDeploy: true` when no active duels
3. **Deploy**: Restart server with new code
4. **Exit maintenance mode**: Resume duel cycles

**Client-side banner**: Automatically displays warning when maintenance mode is active (polls `/health` every 5s).

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
- **Browser**: Chrome Beta with default ANGLE backend (`--use-angle=default`) for automatic best-backend selection
- **Virtual Display**: Xvfb on Linux for headless GPU rendering (DISPLAY=:99)
- **Entry Points**: Dedicated `stream.html` for optimized streaming capture (separate bundle)
- **Pipeline**: Playwright → CDP → FFmpeg (system preferred) → RTMP
- **FFmpeg Resolution**: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static (avoids segfaults)
- **Encoding**: x264 with zerolatency tune, GOP=30 (1s segments at 30fps)
- **Physics**: Client-side PhysX skipped for streaming/spectator viewports (memory optimization)
- **Playwright**: Blocks `--enable-unsafe-swiftshader` injection to prevent CPU software rendering

### Environment Variables

```bash
# Stream keys (auto-detected destinations)
TWITCH_STREAM_KEY=...           # or TWITCH_RTMP_STREAM_KEY
KICK_STREAM_KEY=...
YOUTUBE_STREAM_KEY=...          # or YOUTUBE_RTMP_STREAM_KEY

# Streaming configuration (defaults shown)
STREAM_CAPTURE_MODE=cdp         # CDP for reliability (or mediarecorder)
STREAM_CAPTURE_CHANNEL=chrome-beta  # Chrome Beta for stability
STREAM_CAPTURE_ANGLE=default    # Auto-select best ANGLE backend
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
DISPLAY=:99                     # Xvfb virtual display (Linux)

# CDN (unified configuration)
PUBLIC_CDN_URL=https://assets.hyperscape.club
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

**Stale manifests / outdated game data:**
If you're seeing outdated items, NPCs, or terrain configs after a deployment, this is likely due to CDN caching. As of March 2026, cache busting is automatically applied to all manifest requests. If you're still seeing stale data:
- **Client**: Hard refresh your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux)
- **Server**: Manifests are now embedded in Docker images, so rebuild and redeploy: `docker build -f Dockerfile.server .`
- **CDN**: Manifests are uploaded with cache-busting timestamps, no manual purging needed

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

**Stale module errors after rebuild:**
Service worker cache strategy was switched to `NetworkFirst` in March 2026 to prevent stale JS/CSS. Clear your browser cache or use incognito mode if you still see errors.

**Admin dashboard not accessible:**
Ensure `ADMIN_CODE` is set in `packages/server/.env`. Navigate to `http://localhost:3333/?page=admin` and enter the admin code when prompted.

**Maintenance mode not working:**
- Verify admin authentication (requires `ADMIN_CODE` in server `.env`)
- Check `/admin/maintenance/status` endpoint returns valid JSON
- Ensure no active duels: `safeToDeploy` should be `true`
- Check PM2 logs: `bunx pm2 logs hyperscape-duel`

**Live logs not appearing in admin dashboard:**
- Verify admin authentication (requires admin role)
- Check ring buffer size: Server logs show "Logger ring buffer: X entries"
- Ensure auto-refresh is enabled in dashboard
- Check browser console for fetch errors

## More Info

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and recent changes documentation.

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
