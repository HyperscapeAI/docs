# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with AI agents powered by ElizaOS.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement due to our use of TSL (Three Shading Language) for all materials and post-processing effects. TSL only works with the WebGPU node material pipeline.

### Why WebGPU-Only?
- **TSL Shaders**: All materials use Three.js Shading Language (TSL) which requires WebGPU
- **Post-Processing**: Bloom, tone mapping, and other effects use TSL-based node materials
- **No Fallback**: There is NO WebGL fallback - the game will not render without WebGPU

### Browser Requirements
- Chrome 113+ (recommended)
- Edge 113+
- Safari 18+ (macOS 15+) - Safari 17 support removed
- Firefox (behind flag, not recommended)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Vulkan support is REQUIRED**
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- Chrome uses ANGLE/Vulkan backend to access WebGPU
- If GPU cannot initialize WebGPU, deployment MUST FAIL (no soft fallbacks)

### Development Rules for WebGPU
- **NEVER add WebGL fallback code** - it will not work with TSL shaders
- **NEVER use `--disable-webgpu`** or `forceWebGL` flags
- **NEVER use headless Chrome modes** that don't support WebGPU
- All renderer code must assume WebGPU availability
- If WebGPU is unavailable, throw an error immediately

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
bun run dev:ai          # Game + ElizaOS agents (adds port 4001)
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

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

**Requirements**:
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

### Duel Stack Commands
```bash
# Start full duel arena stack (game + agents + streaming + betting)
bun run duel

# Verify duel stack is running correctly
bun run duel:verify

# Check streaming health
bun run duel:status
```

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```

## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence
│   ├── ElizaOS agent integration
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── procgen/             # Procedural generation
├── gold-betting-demo/   # Solana/EVM betting demo app
│   ├── app/             # React betting UI (Cloudflare Pages)
│   ├── anchor/          # Solana programs (Anchor framework)
│   └── keeper/          # Automated keeper bot (Railway)
├── evm-contracts/       # EVM smart contracts (Hardhat/Foundry)
├── sim-engine/          # Cross-chain risk simulation engine
└── docs-site/           # Docusaurus documentation site

publishing/
└── branding/            # Official logo files (SVG, EPS, PDF, PNG, JPG)
                         # Binary files tracked via Git LFS
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: [\"^build\"]`.

> **TODO(AUDIT-004): CIRCULAR DEPENDENCY - shared ↔ procgen**
>
> There is a circular dependency between `@hyperscape/shared` and `@hyperscape/procgen`.
> - shared imports procgen for vegetation/terrain generation
> - procgen imports shared for TileCoord type in viewers
>
> **Current workaround**: procgen build ignores TypeScript errors.
>
> **Recommended fix**: Extract shared types to `@hyperscape/types` package:
> - Create new package with only type definitions (no runtime code)
> - Both shared and procgen depend on types (no circular dep)
> - Move TileCoord, Position3D, EntityData to types package

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### RPG Implementation Architecture

**Important**: Despite references to \"Hyperscape apps (.hyp)\" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or \"will fill this out later\" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:ai     # Game + ElizaOS agents
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
bun run duel       # Full duel arena stack
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | `ELIZAOS_API_URL` | `bun run dev:ai` |
| 5555 | Game Server | `PORT` | `bun run dev` |
| 8080 | Asset CDN | (Docker) | `bun run cdn:up` |
| 8765 | RTMP Bridge | `RTMP_BRIDGE_PORT` | `bun run duel` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Root | `.env.example` | Streaming keys and deployment secrets |
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**New Environment Variables** (March 2026):
```bash
# Streaming/Duel Configuration
SPAWN_MODEL_AGENTS=true          # Auto-create agents when database is empty
STREAM_CAPTURE_EXECUTABLE=...    # Explicit Chrome path for WebGPU
STREAM_LOW_LATENCY=true          # Use zerolatency tune for faster playback
STREAM_GOP_SIZE=60               # GOP size in frames (default: 60)
STREAM_AUDIO_ENABLED=true        # Enable audio capture
PULSE_AUDIO_DEVICE=...           # PulseAudio device name
STREAM_PLACEHOLDER_ENABLED=true  # Send placeholder frames during idle periods (prevents 30min disconnect)

# Database Configuration (Railway/Serverless)
POSTGRES_POOL_MAX=3              # Max connections (3 for crash loops, 1 for duels)
POSTGRES_POOL_MIN=0              # Min connections (0 to not hold idle)
RAILWAY_ENVIRONMENT=...          # Auto-detected by Railway (most reliable detection method)

# Production Client Build
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming

# Solana Duel Arena Configuration
DUEL_SOLANA_RPC_URL=...                      # Solana RPC endpoint (default: devnet)
DUEL_SOLANA_WS_URL=...                       # Solana WebSocket endpoint
DUEL_SOLANA_ARENA_MARKET_PROGRAM_ID=...      # Fight oracle program ID (default: 9NdidShnVzy1fc1WHWJTvyuXmH47ynfNGA6QFdyfAuSU)
DUEL_SOLANA_GOLD_MINT=...                    # Gold token mint (default: DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump)
DUEL_SOLANA_ARENA_AUTHORITY_SECRET=...       # Solana keypair for arena operations (file path or base58)
DUEL_SOLANA_ARENA_REPORTER_SECRET=...        # Solana keypair for reporting results
DUEL_SOLANA_ARENA_KEEPER_SECRET=...          # Solana keypair for keeper bot automation

# Deployment Secrets (GitHub Actions → /tmp/hyperscape-secrets.env)
DATABASE_URL=...                 # PostgreSQL connection string
JWT_SECRET=...                   # Server authentication secret
ARENA_EXTERNAL_BET_WRITE_KEY=... # Arena betting API key
TWITCH_STREAM_KEY=...            # Twitch RTMP stream key
X_STREAM_KEY=...                 # X/Twitter RTMP stream key
KICK_STREAM_KEY=...              # Kick RTMP stream key
SOLANA_DEPLOYER_PRIVATE_KEY=...  # Solana deployer keypair
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager and runtime (updated from v1.1.38).

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.3.10+ (updated from v1.1.38 in commit bc3b1bc, March 2026)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.183.1 (updated from 0.182.0), PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Railway/Neon), Docker (local)
- **Testing**: Playwright 1.58.2 (updated from 1.54.2), Vitest 4.x (upgraded from 2.x in commit a916e4ee for Vite 6 compatibility)
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor 8.1.0 (updated from 7.5.0)
- **AI**: ElizaOS 2.0.0-alpha.26 (updated from 2.0.0-alpha.11)

## Recent Improvements (March 2026)

### Agent Memory Management

See [AGENTS.md](AGENTS.md) for comprehensive documentation on:
- InMemoryDatabaseAdapter migration (38-76GB → <5GB memory reduction)
- Memory accumulation caps (50 memories per agent, adapter data structure limits)
- Database connection pool optimization (concurrency limiting, staggered refresh)
- Sequential agent spawning (prevents migration conflicts)
- Auto-spawn configuration (STREAMING_DUEL_ENABLED=true)

### Duel System Enhancements

See [AGENTS.md](AGENTS.md) for comprehensive documentation on:
- 19 AI model roster expansion (GPT-4.1, Claude Opus 4, Llama 3.3 70B, etc.)
- Activity-aware idle camera (weighted agent selection)
- Skill-based weapon selection (three-source scoring)
- Strategic duel combat AI (LLM fight plans, phase-aware healing, movement strategies)
- On-deck duel notification (5+ min preparation time)
- Duel pipeline audit fixes (18 findings resolved)

### Server Features

#### Graceful Restart API

**Feature** (commit c76ca516): Zero-downtime deployments for the duel arena stream.

**Endpoints**:
- `POST /admin/graceful-restart` - Request restart after current duel
- `GET /admin/restart-status` - Check if restart is pending
- `StreamingDuelScheduler.requestGracefulRestart()` - Programmatic API

**Behavior**:
- If no duel active: restart immediately via SIGTERM
- If duel in progress: wait until RESOLUTION phase completes
- PM2 automatically restarts the server with new code

**Use Case**: Deploy code updates without interrupting live duels.

#### Streaming Placeholder Mode

**Feature** (commit 83056565): Prevents stream disconnects during idle periods.

**Configuration**:
```bash
STREAM_PLACEHOLDER_ENABLED=true  # Enable placeholder mode (default: false)
```

**Behavior**:
- Detects when no frames are received for 5 seconds
- Switches to placeholder mode, sending minimal JPEG frames at configured FPS
- Automatically exits placeholder mode when live frames resume
- Keeps Twitch/YouTube streams alive during content gaps
- Prevents 30-minute disconnect that occurs when streams appear "idle"

**Technical Details**:
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size
- Maintains configured FPS to satisfy platform requirements
- Zero impact on live stream quality when frames are flowing

### Railway Database Detection

**Improvements** (commits d8c26d2, a5a201c):

**Detection Methods** (in priority order):
1. `RAILWAY_ENVIRONMENT` env var (most reliable, auto-set by Railway)
2. `.railway.internal` hostname (internal connections)
3. `.rlwy.net` hostname (Railway proxy)
4. `.railway.app` hostname (direct connections)

**Automatic Optimizations**:
- Disables prepared statements when using Railway proxy
- Uses lower connection pool limits (max: 6) for pooler connections
- Detects pgbouncer/Supavisor poolers for compatibility mode

**Impact**: Fixes "too many clients already" errors on Railway deployments.

### Deployment Process Improvements

**Vast.ai Deployment** (commits e065ef3, fad8885, 087033fa, 58d88f4c, 46324033):
- **Production Environment Passthrough**: GitHub Actions writes secrets to `/tmp/hyperscape-secrets.env`
- **SSH-Local Health Checks**: Health checks run via SSH instead of HTTP for reliability
- **Targeted Process Killing**: Use specific process names instead of blanket `pkill -f bun`
- **Graceful PM2 Shutdown**: Stop PM2 with delays between commands
- **Process Teardown Before Migration**: Prevents "too many clients" errors during deployment
- **Deterministic Migrations**: Migrations run in sorted order for consistency

**Solana Configuration** (commits 7fd94ffe, d4df6a4c, b71796b3, 54eef352):
- **Runtime Defaults**: PM2 config includes default Solana program IDs and gold mint
- **Environment Passthrough**: All deploy-time secrets passed into PM2 runtime
- **Auto-Discovery**: Solana authority auto-discovered from multiple candidate sources

### Testing & CI Improvements

**Vitest 4.x Upgrade** (commit a916e4e):
- Vitest 2.x is incompatible with Vite 6.x
- Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6
- Fixes `__vite_ssr_exportName__` errors during test runs
- All packages using Vitest must use 4.x for Vite 6 compatibility

**CI Stabilization** (commits 23323ac, 2ae03b4, 83a3452, 4b47012):
- Fixed client test runner resolution
- Stabilized duel agent tests and client CI builds
- Stabilized vegetation concurrency test
- Fixed asset forge CI module resolution

**Anchor Test Configuration** (commit 8b7d126):
- Skip anchor localnet tests in CI when Solana CLI is not installed
- Prevents false failures in environments without Solana toolchain
- Tests run normally in local development with Solana CLI

### Branding Assets

**Git LFS Integration** (commit f334c57):
- Binary branding files (.ai, .eps, .pdf, .png, .jpg) now tracked via Git LFS
- Prevents repo bloat (~28 MB of design assets)
- Location: `publishing/branding/` directory
- Documentation: `publishing/branding/README.md` documents logo variants and usage guidelines

### Betting Stack Synchronization

**Updates** (commits ba5617c, b36c054, d8e4d39, 6330821, a4a275b, 792159b, ca439b3):
- Synced betting stack updates from production
- Hardened betting localnet flows and cleared anchor audit
- Cleaned stale app wiring after betting hardening
- Removed legacy binary market app state
- Restored stable app shell for production build
- Finalized betting production sync artifacts

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
lsof -ti:4001 | xargs kill -9  # ElizaOS API
lsof -ti:8765 | xargs kill -9  # RTMP Bridge
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### Database Issues

**Railway "too many clients already" errors**:
- Set `POSTGRES_POOL_MAX=3` (or lower) in `.env`
- Set `POSTGRES_POOL_MIN=0` to not hold idle connections
- Increase `restart_delay=10s` in PM2 config to allow connections to close
- Railway is auto-detected via `RAILWAY_ENVIRONMENT` env var

**Local database schema errors after pulling updates**:
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

### Streaming Issues

**WebGPU not initializing on Vast.ai**:
- Ensure instance has `gpu_display_active=true` (use `bun run vast:provision`)
- Check deployment logs for GPU display driver detection
- Run `bun run duel:status` to check streaming health
- Verify NVIDIA display driver: `nvidia-smi` should show display mode

**Browser timeout during page load**:
- Set `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
- Use pre-built client via `vite preview` instead of dev server
- Significantly faster page loads (no on-demand module compilation)

**Stream disconnects after 30 minutes**:
- Enable placeholder frame mode: `STREAM_PLACEHOLDER_ENABLED=true`
- Sends minimal frames during idle periods to keep stream alive
- Automatically exits when live frames resume

**Zero-downtime deployments**:
- Use graceful restart API: `POST /admin/graceful-restart`
- Server waits for current duel to complete before restarting
- PM2 automatically restarts with new code

### Agent Issues

**Agent memory leaks**:
- Agents now use InMemoryDatabaseAdapter (zero WASM overhead)
- Memory capped at 50 memories per agent with ring buffer eviction
- Adapter logs capped at 20 entries, cache at 100 entries
- Periodic GC every 60s per agent
- See [AGENTS.md](AGENTS.md) for full memory management documentation

**Database connection pool exhaustion**:
- Bank queries now throttled (max 5 concurrent)
- Agent refresh intervals staggered with random offset
- Increase `POSTGRES_POOL_MAX` if needed (default: 20 for serverless, 30 for standard)

**Agent spawning failures**:
- First agent spawns sequentially to complete migrations
- Remaining agents spawn in parallel
- Prevents concurrent ALTER TABLE races on serverless PostgreSQL

**Missing Anthropic agents**:
- Ensure `@elizaos/plugin-anthropic` is installed
- Check `MAX_MODEL_AGENTS` is set to 25 (default increased from 10)

### Vitest 4.x Upgrade

**Breaking Changes** (commit a916e4e):
- Vitest 2.x is incompatible with Vite 6.x
- Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6
- Fixes `__vite_ssr_exportName__` errors during test runs
- All packages using Vitest must use 4.x for Vite 6 compatibility

**Migration Notes**:
- Update `vitest` and `@vitest/coverage-v8` to `^4.0.6` in package.json
- No API changes required - tests continue to work as-is
- Vite 6 requires Vitest 4.x for SSR module handling

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI agent system documentation (memory management, duel improvements)
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- [docs/duel-stack.md](docs/duel-stack.md) - Duel arena stack documentation
- Game Design Document: See `.cursor/rules/gdd.mdc`
