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
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode, dynamic combat escalation, gear progression, cooking |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, instanced rendering |

## System Requirements

### Browser Requirements (CRITICAL)

**Hyperscape requires WebGPU. WebGL is NOT supported.**

- **Chrome 113+** (recommended)
- **Edge 113+**
- **Safari 18+** (macOS 15+) - Note: Safari 17 is no longer supported
- WebGPU must be available and working
- Check your browser support at: [webgpureport.org](https://webgpureport.org)

**Why WebGPU-Only?**
- All materials use TSL (Three Shading Language) which requires WebGPU
- Post-processing effects use TSL-based node materials
- There is NO WebGL fallback - the game will not render without WebGPU

### Development Requirements

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
- `.env.example` (root) - Streaming keys, Solana keys, GPU configuration

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

### Railway Deployment

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

### Vast.ai GPU Streaming Deployment

For GPU-accelerated streaming with WebGPU support, use the automated Vast.ai provisioner:

```bash
./scripts/vast-provision.sh
```

**What it does:**
- Searches for GPU instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), and price (≤$2/hr)
- Automatically rents the best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Ensures only instances with NVIDIA display driver support are rented

**Requirements:**
- Install Vast.ai CLI: `pip install vastai`
- Set API key: `vastai set api-key YOUR_API_KEY`
- Get API key from: https://cloud.vast.ai/account/

**After provisioning:**
1. Update GitHub secrets with the provided commands
2. Trigger deployment: `gh workflow run deploy-vast.yml`

**Deployment Features:**
- 6-stage WebGPU testing (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
- Early display driver checks (nvidia_drm kernel module, DRM device nodes)
- GPU display mode validation via nvidia-smi
- Vulkan ICD detection and diagnostics
- Automatic fallback between GPU rendering modes
- Production client build for faster page loads (eliminates Vite JIT compilation timeout)
- Browser restart every 45 minutes to prevent WebGPU OOM crashes

See `scripts/deploy-vast.sh` for the full deployment pipeline and WebGPU validation process.

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

**WebGPU not available:**
Visit [webgpureport.org](https://webgpureport.org) to check if your browser supports WebGPU. If not:
- Update to Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+)
- Ensure graphics drivers are up to date
- Check `chrome://gpu` to see GPU feature status
- Note: Safari 17 is no longer supported - Safari 18+ (macOS 15+) is required

**WebGPU initialization hangs or times out:**
If the game loads but hangs on a black screen:
- Check browser console for "WebGPU adapter request timed out" or "WebGPU renderer initialization timed out"
- Try restarting your browser
- Update graphics drivers
- For server deployments, ensure NVIDIA GPU is accessible and Vulkan ICD is configured (see CLAUDE.md)

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

## Recent Improvements

### Stability & Performance (Feb 2026)

#### Memory Management
- **Critical Memory Leak Fixes**: Fixed 20+ memory leaks across the codebase
  - **Client**: ModelCache GPU memory disposal, EventBridge listener cleanup, ClientLiveKit voices Map
  - **Server**: GameTickProcessor, TradingSystem, RTMPBridge, ActionQueue, ScriptQueue
  - **Agent System**: AgentManager, AutonomousBehaviorManager event handler cleanup
  - **Entity System**: ColliderComponent, MobEntity, Socket proper resource cleanup
  - **Game Systems**: AggroSystem bounded maps, StarterChestEntity LRU pruning
  - **Shutdown Process**: Rate limiters and idempotency service cleanup
- **Resource Bounds**: Activity logger queue (max 1000), damage event cache (max 1000), session timeout (30 min)
- **E2E Journey Tests**: Complete login→loading→spawn→walk tests with screenshot comparison and loading screen detection

#### Combat System
- **Timing Improvements**: Combat retry timer aligned with tick system (3000ms = 5 ticks)
- **Faster Failure Detection**: Phase timeout reduced from 30s to 10s
- **Stall Recovery**: Re-nudging support when combat stalls again after cooldown
- **Cache Optimization**: Damage event cleanup every tick, 75% eviction when cap exceeded

#### AI Agent System
- **Dynamic Combat Escalation**: Agents progress from goblins → bandits → barbarians as they level
- **Combat Style Rotation**: Agents cycle attack → strength → defense (train lowest skill)
- **Cooking Phase**: Agents cook raw food immediately instead of waiting for full inventory
- **Gear Upgrade Phase**: Agents smith better equipment when they have materials + levels
- **LLM Rate Limiting**: Exponential backoff (5s base, max 60s) with consecutive failure tracking
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` that broke ALL agents
- **Quest Lifecycle**: Proper quest goal status change detection
- **Dashboard Sync**: All agents show activity logs even when skipping LLM

#### Streaming & WebGPU
- **Production Client Build**: Vite preview mode for faster page loads (fixes 180s timeout)
- **Multiple GPU Modes**: Xorg, Xvfb, headless-vulkan, headless-egl, ozone-headless, swiftshader
- **macOS Support**: Auto-detects system Chrome, uses Metal backend (not Vulkan)
- **6-Stage WebGPU Testing**: Comprehensive pre-deployment validation
- **Browser Restart**: Every 45 minutes to prevent WebGPU OOM crashes
- **Resolution Tracking**: Automatic viewport recovery on mismatch
- **Improved Diagnostics**: GPU info extraction, preflight testing, timeout detection

#### Client Performance
- **GPU Memory Management**: Fixed memory leaks in XPDropSystem, DuelCountdownSplatSystem, HealthBars, ProjectileRenderer
  - Object pooling for CanvasTexture/SpriteMaterial reuse
  - Proper cleanup of setTimeout handles and event listeners
  - Stale health bar sweep when entities are removed
- **Movement Optimizations**: Eliminated per-frame allocations in TileInterpolator
  - Pre-allocated position vectors, squared distance comparisons
  - Single sqrt for both normalization and distance checks
  - Push loops instead of array.map() to avoid intermediate allocations
- **Minimap Rendering**: 16× faster terrain generation with async chunked sampling
  - 50×50 grid sampling instead of per-pixel (40,000 → 2,500 calls)
  - Async generation with setTimeout(0) yields - zero RAF blocking
  - Canvas rotation transform for instant rotation (no regeneration)
  - Canvas 2D terrain background (eliminates WebGPU context switching)
  - Cached road/building data and canvas contexts
- **State Management**: Debounced localStorage writes (500ms), cached machine ID generation
  - World init/destroy race condition fix with two-flag handshake

#### Movement System
- **Immediate Move Processing**: Bypass ActionQueue for 0-latency move requests
- **Pathfinding**: 15/sec rate limit (up from 5/sec), 8000 BFS iterations (up from 2000)
- **Path Continuation**: Seamless long-distance movement beyond ~44-tile BFS radius
  - Automatic re-pathfinding from new tile toward original destination
  - Death/duel state guards, respawn/teleport destination clearing
- **Skating Fix**: Server-side pre-computation + client-side path appending
  - Next segment sent 1 tick early, path-append fast-path in TileInterpolator
  - Max catch-up multiplier reduced from 4x to 2x
- **Multi-Click**: Optimistic target pivoting, pending-move queue for rapid clicks

#### Rendering Optimizations
- **Instanced Rendering**: Optimized resource rendering with depleted model support
  - Separate pools for normal and depleted states (tree → stump)
  - Highlight mesh support for instanced entities
  - `ResourceVisualStrategy.onDepleted()` now returns boolean
- **Model Cache Integrity**: Preserves index buffer type (Uint16Array vs Uint32Array)
  - Fixes silent geometry corruption and RangeError crashes
  - Cache version bumped to 4

#### Test Stability
- **Timeout Increases**: GoldClob fuzz (120s), dynamic imports (60s), Playwright navigation (180s)
- **Precision Fixes**: Larger amounts (10000n) to avoid gas cost precision issues
- **Anchor Configuration**: Use localnet for tests (free SOL, no devnet funding required)

See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) for detailed technical documentation.

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
