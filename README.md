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
# Install Git LFS first (if not already installed)
git lfs install

# Clone repository (Git LFS will automatically download binary assets)
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

### Vast.ai Commands (NEW)

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

**Requirements**:
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

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

### New Environment Variables

**Streaming/Duel Configuration:**
```bash
SPAWN_MODEL_AGENTS=true          # Auto-create agents when database is empty
STREAM_CAPTURE_EXECUTABLE=...    # Explicit Chrome path for WebGPU
STREAM_LOW_LATENCY=true          # Use zerolatency tune for faster playback
STREAM_GOP_SIZE=60               # GOP size in frames (default: 60)
STREAM_AUDIO_ENABLED=true        # Enable audio capture
PULSE_AUDIO_DEVICE=...           # PulseAudio device name
STREAM_PLACEHOLDER_ENABLED=true  # Send placeholder frames during idle periods (prevents 30min disconnect)
```

**Database Configuration (Railway/Serverless):**
```bash
POSTGRES_POOL_MAX=3              # Max connections (3 for crash loops, 1 for duels)
POSTGRES_POOL_MIN=0              # Min connections (0 to not hold idle)
```

**Production Client Build:**
```bash
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

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

### Railway

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

**Railway Database Configuration:**

Railway uses connection pooling (pgbouncer) which requires special configuration:

```bash
# In packages/server/.env for Railway deployments
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Railway proxy detection is automatic - the system detects `.rlwy.net`, `.railway.app`, and `.railway.internal` domains and:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits
- Prevents "too many clients already" errors

Detection also works via `RAILWAY_ENVIRONMENT` environment variable for reliable identification.

### Vast.ai (GPU Streaming)

**Automated Provisioning:**

Use the Vast.ai provisioner to automatically rent WebGPU-capable instances:

```bash
VAST_API_KEY=xxx bun run vast:provision
```

This will:
1. Search for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
2. Filter by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr)
3. Rent the best available instance
4. Wait for instance to be ready
5. Output SSH connection details and GitHub secret commands

**Manual Deployment:**

See `scripts/deploy-vast.sh` for the complete deployment script. Key requirements:

- NVIDIA GPU with display driver support (`gpu_display_active=true`)
- 120GB disk space minimum
- WebGPU initialization must succeed or deployment fails

**Monitoring:**

Check streaming health with:
```bash
bun run duel:status
```

This checks:
- Server health endpoint
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs

**Graceful Restart (Zero-Downtime Deployments):**

Request a server restart after the current duel ends:

```bash
# Via API (requires ADMIN_CODE)
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active: restarts immediately
- If duel in progress: waits until RESOLUTION phase completes
- PM2 automatically restarts with new code
- No interruption to active duels or streams

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

**Railway "too many clients already" errors:**
Set lower connection pool limits in `packages/server/.env`:
```bash
POSTGRES_POOL_MAX=3              # Down from default 6
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also increase PM2 restart delay to allow connections to close:
```javascript
// In ecosystem.config.cjs
restart_delay: 10000,            // 10s instead of 5s
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
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

**Vitest 4.x upgrade issues:**
If you see `__vite_ssr_exportName__` errors, ensure you're using Vitest 4.x (not 2.x):
```bash
bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6
```

Vitest 2.x is incompatible with Vite 6.x. The upgrade to Vitest 4.x was required for compatibility.

**Streaming Issues:**

*WebGPU not initializing on Vast.ai:*
- Ensure instance has `gpu_display_active=true` (use `bun run vast:provision`)
- Check deployment logs for GPU display driver detection
- Run `bun run duel:status` to check streaming health
- Verify NVIDIA display driver: `nvidia-smi` should show display mode

*Browser timeout during page load:*
- Set `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
- Use pre-built client via `vite preview` instead of dev server
- Significantly faster page loads (no on-demand module compilation)

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Recent Improvements

### Stability Improvements (March 2026)

- **Combat System**: Aligned retry timer with tick system, reduced phase timeouts, improved stall detection
- **Agent System**: LLM rate limiting with exponential backoff, memory leak fixes, dynamic combat escalation, banking goal type added
- **Resource Management**: Activity logger queue limits, session timeouts, proper cleanup
- **Test Stability**: Vitest 4.x upgrade for Vite 6 compatibility, increased timeouts for fuzz tests
- **E2E Journey Tests**: Complete login→loading→spawn→walk gameplay tests with screenshot comparison

### Performance Optimizations

- **Object Pooling**: Zero-allocation event emission for combat events (eliminates GC pressure)
- **Instanced Rendering**: O(1) draw calls per unique model per LOD level for resources
- **Model Cache Integrity**: Index buffer type preservation fixes geometry corruption
- **Movement System**: Immediate move processing, increased pathfinding rate limit, path continuation
- **Minimap Rendering**: Async terrain generation, zero RAF blocking, 16× reduction in sampling
- **GPU Resource Hygiene**: Object pools for textures/materials, proper cleanup on destroy

### Memory Leak Fixes

Fixed critical memory leaks in 20+ systems including:
- ModelCache, EventBridge, Logger, PlayerTokenManager
- AgentManager, AutonomousBehaviorManager, GameTickProcessor
- TradingSystem, RTMPBridge, ActionQueue, ScriptQueue
- And many more - see AGENTS.md for complete list

### New Features

**Graceful Restart API** (Zero-Downtime Deployments):
- `POST /admin/graceful-restart` - Request restart after current duel ends
- `GET /admin/restart-status` - Check if restart is pending
- Waits for duel RESOLUTION phase before restarting
- PM2 automatically restarts with new code

**Placeholder Frame Mode** (Stream Keep-Alive):
- Set `STREAM_PLACEHOLDER_ENABLED=true` to prevent 30-minute disconnects
- Sends minimal JPEG frames during idle periods
- Automatically exits when live frames resume

**Streaming Status Check**:
- `bun run duel:status` - Quick diagnostic for streaming health
- Checks server, RTMP bridge, PM2 processes, and logs

**Model Agent Spawning**:
- Set `SPAWN_MODEL_AGENTS=true` to auto-create agents when database is empty
- Useful for fresh deployments and testing

### Railway Database Detection

Automatic detection of Railway proxy connections with:
- Disabled prepared statements (not supported by pgbouncer)
- Lower connection pool limits (max: 6)
- Fixes "too many clients already" errors
- Detection via `RAILWAY_ENVIRONMENT` env var or hostname patterns

### Vast.ai Provisioner

Automated instance provisioning with WebGPU support:
- Searches for `gpu_display_active=true` instances
- Filters by reliability, GPU RAM, price, disk space
- Automatic rental and setup
- SSH connection details and GitHub secrets output

## Branding Assets

Official Hyperscape logo files are available in `publishing/branding/`:

**Logo Variants:**
- `hyperscape_logo_color` - Full wordmark with gold gradient (primary logo)
- `hyperscape_logo_black` - Full wordmark, solid black (print/light backgrounds)
- `hyperscape_logo_white` - Full wordmark, solid white (dark backgrounds)
- `hyperscape_logo_icon_color` - "HS" icon with gold gradient (favicons, app icons)

**Formats:**
- **SVG** (source of truth): Web, UI, scalable usage
- **EPS** (Git LFS): Print production
- **PDF** (Git LFS): Print-ready distribution
- **PNG** (Git LFS): Raster with transparency
- **JPG** (Git LFS): Raster without transparency
- **AI** (Git LFS): Adobe Illustrator source templates

**Git LFS**: Binary branding files (~28MB) are tracked via Git LFS to avoid repo bloat. Run `git lfs install` before cloning.

See `publishing/branding/README.md` for complete usage guidelines and naming conventions.

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and WebGPU streaming architecture.

## License

MIT
