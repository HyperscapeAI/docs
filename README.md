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
├── procgen/             # Procedural generation (terrain, trees, buildings)
├── impostors/           # Impostor system for LOD rendering
├── asset-forge/         # AI asset generation tools
├── vast-keeper/         # Vast.ai instance management and monitoring
├── gold-betting-demo/   # Gold betting demo with mobile-responsive UI
├── evm-contracts/       # EVM smart contracts (GoldClob, AgentPerps)
├── contracts/           # MUD smart contracts
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `impostors` → `procgen` → `shared` → everything else (handled automatically by Turbo)

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

### Vast.ai Commands

For GPU server deployment and streaming:

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

### Streaming Commands

```bash
# Check streaming status on Vast.ai
bun run duel:status

# Start duel stack locally
bun run duel              # Basic duel stack
bun run duel:full         # With market maker

# Production duel stack (PM2)
bun run duel:prod         # Start with PM2
bun run duel:prod:stop    # Stop PM2 processes
bun run duel:prod:restart # Restart PM2 processes
bun run duel:prod:logs    # View PM2 logs
bun run duel:prod:status  # Check PM2 status

# Verify duel stack configuration
bun run duel:verify
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

## Recent Improvements

### Performance Optimizations (PR #950, PR #hackathon)

**Object Pooling for Zero-Allocation Event Emission**:
- Comprehensive object pooling eliminates GC pressure in high-frequency event loops
- `CombatEventPools`: Pre-configured pools for all combat events (damageDealt, projectileLaunched, etc.)
- `PositionPool`: Global pool for `{x, y, z}` position objects
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor

**Movement System**:
- Immediate move processing (eliminates 0-600ms latency by bypassing ActionQueue)
- Pathfinding rate limit raised from 5/sec to 15/sec to match tile movement limiter
- BFS iterations increased from 2000 to 8000 (~44 tile radius vs ~22 tile)
- Path continuation for seamless long-distance movement with automatic re-pathfinding
- Skating fix with server-side pre-computation + client-side path appending
- Multi-click feel with optimistic target pivoting + pending move queue
- Per-frame allocation elimination with pre-allocated buffers and squared distance comparisons

**Minimap Rendering**:
- Async terrain generation (50×50 grid) runs off RAF callback via setTimeout(0) yields
- Zero RAF blocking - terrain generation happens in background macrotasks
- Canvas rotation transform decouples regeneration from camera rotation
- Reduced terrain sampling from up to 40,000 pixels to 2,500 (16× reduction)
- Layer synchronization - all layers (terrain, roads, buildings, pips) use same camera snapshot
- Cached contexts to avoid getContext() DOM queries
- Rotation threshold raised from 0.01 to 0.087 (~5°) to prevent regeneration on every tiny angular change

**GPU Resource Hygiene**:
- Object pools for XPDropSystem and DuelCountdownSplatSystem
- Proper destroy() methods for HealthBars and ProjectileRenderer
- Machine ID caching and activity debouncing (500ms)
- Stale health bar sweep for despawned entities (reverse iteration)
- World initialization race condition fix with two-flag handshake (initComplete + needsCleanup)
- ThreeResourceManager teardown() to stop dev monitor interval

### Stability Improvements

**Combat System**:
- Zero-allocation event emission with object pooling (CombatEventPools)
- Combat retry timer aligned with tick system (3000ms = 5 ticks)
- Phase timeout reduced from 30s to 10s for faster failure detection
- Combat stall nudge tracks last nudge timestamp for re-nudging
- Damage event cache cleanup every tick, cap lowered to 1000, evict 75%
- TerrainSystem player position tracking fixed for proper tile unloading
- PendingGatherManager reduced logging, added early-out for repeated gathers
- ResourceSystem added `isPlayerGatheringResource()` for early-out checks

**Agent System**:
- LLM rate limiting with exponential backoff (5s base, max 60s)
- Dynamic combat escalation (goblins → bandits → barbarians as combat level grows)
- Combat style rotation (attack → strength → defense, train lowest skill)
- Cooking phase for immediate food preparation
- Gear upgrade phase for smithing better equipment
- Combat food threshold increased from 5 → 10 for better survival
- Critical crash fix: `weapon.toLowerCase is not a function` in getEquippedWeaponTier
- Quest goal status change detection for proper quest lifecycle transitions

**Memory Leak Fixes** (PR #950):
- 20+ critical memory leaks fixed across codebase
- ModelCache geometry disposal (CRITICAL) - prevents GPU memory accumulation
- EventBridge listener cleanup (HIGH) - 50+ world event listeners now properly removed
- GameTickProcessor, TradingSystem event handler cleanup (HIGH)
- Proper destroy() methods for all systems and managers
- Session timeout (30-minute max via MAX_SESSION_TICKS)
- Activity logger queue with max size 1000 and 25% eviction
- PostgreSQL connection pool: POOL_MAX=3, POOL_MIN=0, restart_delay=10s to prevent connection exhaustion

### Testing (PR #950)

**E2E Journey Tests**:
- Complete journey tests (login→loading→spawn→walk) in `complete-journey.spec.ts`
- Screenshot comparison utilities to verify game is rendering correctly
- Loading screen detection helpers (`waitForLoadingScreenHidden`)
- Real browser testing with Playwright and actual WebGPU rendering (no mocks)

**Test Stability**:
- GoldClob fuzz tests with 120s timeout (4 seeds × 140 operations)
- Precision fixes for gas cost calculations (use 10000n amounts)
- Dynamic import timeout for service tests (60s for EmbeddedHyperscapeService)
- Anchor test configuration using localnet instead of devnet for free SOL
- SlidingWindowRateLimiter test updated to expect 15/sec for pathfind (was 5/sec)
- TradingSystem test guards world.off calls for test environments
- ScriptQueue test uses `handlers.clear()` not `this.handler = null`
- Mob tile movement test adds missing TileMovementState properties

### WebGPU & Streaming

**Browser Support**:
- Safari 18+ (macOS 15+) now required (Safari 17 support removed)
- WebGPU initialization with 30s adapter timeout and 60s renderer timeout
- Preflight testing on localhost server (secure context, not about:blank)
- Adapter info compatibility fallback for older Chromium (requestAdapterInfo() not available)

**Vast.ai Deployment**:
- GPU display driver requirement (`gpu_display_active=true`) - CRITICAL for WebGPU
- Automated provisioner script (`./scripts/vast-provision.sh`) with reliability/price filtering
- Early display driver check with nvidia_drm kernel module and /dev/dri/ device node verification
- 6-stage WebGPU testing during deployment (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
- Verbose Chrome GPU logging for diagnostics (`--enable-logging=stderr --v=1`)
- PM2 log capture with 60s initialization wait and crash loop detection
- Display environment reuse to prevent Vulkan ICD configuration loss
- X server detection via socket check (`/tmp/.X11-unix/X99`) instead of xdpyinfo

**Streaming Optimizations**:
- Production client build support (fixes 180s browser timeout caused by Vite JIT compilation)
- Stream encoding with 2x bitrate buffer multiplier (reduced from 4x to prevent backpressure)
- Health check timeout: 5s (data timeout: 15s) for faster failure detection
- Browser restart every 45 minutes to prevent WebGPU OOM crashes
- Resolution tracking and mismatch detection with automatic viewport recovery
- Model agent spawning (`SPAWN_MODEL_AGENTS=true`) for empty database
- Streaming status check script (`bun run duel:status`) for quick diagnostics

### Gold Betting Demo (PR #944)

**Mobile Responsive UI**:
- Resizable panels for desktop with `useResizePanel` hook + `ResizeHandle` component
- Mobile detection with `useIsMobile` hook gates JS inline styles so CSS media queries control layout
- 16:9 aspect-ratio video, bottom-sheet sidebar, touch-friendly tab targets, dvh units
- Mobile header: stacked HYPERSCAPE/MARKET logo, phase strip above video, SOL + EVM wallet buttons
- Tab reordering: Trades tab moved first for better mobile UX
- Real data integration via live SSE feed from game server (devnet mode replaces mock data)
- Simulation mode available via `bun run dev:stream-ui` (dev mode uses real endpoints only)

**Console Noise Reduction**:
- Recharts warning fix: raised `.hm-chart-container` min-height to 120px (eliminates width/height=0 warnings)
- EventSource auto-reconnect prevention: close EventSource on onerror to stop browser's built-in reconnect loop
- Exponential backoff: `useDuelContext` switched from fixed setInterval to setTimeout with backoff (3s → 6s → 60s cap)

**Architecture Changes**:
- `AppRoot.tsx` routes `MODE=stream-ui` to `StreamUIApp`, all other modes to `App`
- `App.tsx` fully purged of `isStreamUIMode` checks and `useMockStreamingEngine` import
- `bun run dev` (devnet) now connects only to real SSE/duel-context endpoints
- Simulation/mock data remains available via `bun run dev:stream-ui`

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

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

See [AGENTS.md](AGENTS.md) for AI coding assistant instructions and WebGPU streaming architecture.

## License

MIT
