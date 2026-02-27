# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

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
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU required)
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (trees, rocks, terrain)
├── asset-forge/         # AI asset generation + VFX catalog
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **procgen** - Procedural generation utilities
3. **shared** - Depends on physx-js-webidl and procgen
4. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

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

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

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

- No TODOs or "will fill this out later" - implement completely
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
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 5555 | Game Server | `PORT` | `bun run dev` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production (enforced)
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth
ADMIN_CODE=...                   # Required for production security

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.1.38+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.1.38+
- **Engine**: Three.js 0.180.0, PhysX (WASM)
- **Rendering**: WebGPU (required - all shaders use TSL)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon), Docker (local)
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

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
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### WebGPU Not Available

Hyperscape requires WebGPU (all shaders use TSL). WebGL fallback was removed.
- Chrome/Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS 15+ only)
- Check: [webgpureport.org](https://webgpureport.org)

## Deployment

### Cloudflare Pages (Client)

Automatic deployment on push to `main`:
- Workflow: `.github/workflows/deploy-pages.yml`
- Triggers on changes to `packages/client/**` or `packages/shared/**`
- Production URL: https://hyperscape.gg
- Preview URL: https://<commit>.hyperscape.pages.dev

### Railway (Game Server)

Branch-based deployment:
- `main` → `prod` environment
- `develop` → `dev` environment
- See [docs/railway-dev-prod.md](docs/railway-dev-prod.md)

### Vast.ai (GPU Streaming)

Automated deployment with maintenance mode:
- Workflow: `.github/workflows/deploy-vast.yml`
- Triggers after CI passes on `main`
- Manual trigger: `workflow_dispatch`
- Features:
  - Maintenance mode API (pauses duel cycles)
  - Health checking before exit
  - DATABASE_URL persistence through git reset
  - Vulkan driver installation
  - Chrome Dev channel for WebGPU
- See [docs/vast-deployment.md](docs/vast-deployment.md)

### Maintenance Mode API

Graceful deployment system for production:

```bash
# Enter maintenance mode (pauses new duel cycles)
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'

# Check status
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"

# Exit maintenance mode (resumes operations)
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

See [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) for full API reference.

## Recent Architectural Changes (February 2026)

### AI Agent Stability & Behavior
- **Database isolation**: Force PGLite for agents, prevent destructive migrations on game DB
- **Initialization timeouts**: 45s timeout on runtime init prevents indefinite hangs
- **Event listener cleanup**: Duplication guard prevents memory leaks
- **Graceful shutdown**: 10s timeout on runtime.stop() with dangling promise cleanup
- **WASM heap cleanup**: Explicit DB adapter close releases memory
- **Circuit breaker**: 3 consecutive failure limit, 8 max reconnect retries
- **Duel recovery**: Check contestant status independently during ANNOUNCEMENT phase
- **Quest-driven tools**: Replaced starter chest with quest-based tool acquisition
  - Lumberjack's First Lesson → bronze hatchet + tinderbox
  - Fresh Catch → small fishing net
  - Torvin's Tools → bronze pickaxe + hammer
- **Autonomous banking**: Auto-deposit at 25/28 slots, keep essential tools (axe, pickaxe, tinderbox, net)
  - New BANK_DEPOSIT_ALL action for bulk banking
  - Proper bankOpen/bankDeposit/bankDepositAll/bankWithdraw/bankClose packet sequence
  - Banking actions now await movement completion instead of returning early
- **Action locks**: Skip LLM during movement, fast-tick mode (2s) for quick follow-up after movement/goal changes
- **Short-circuit LLM**: Obvious decisions (repeat resource, banking, set goal) bypass LLM for faster response
- **Resource detection**: Increased approach range from 20m to 40m to match skills validation
- **Inventory tracking**: Display inventory count with full/nearly-full warnings
- **Quest priority**: Questing goal has highest priority when agent lacks tools
- **Banking goal**: Triggers when inventory >= 25/28 slots

### Streaming Infrastructure
- **GPU rendering**: Xorg headless setup with NVIDIA for hardware-accelerated WebGPU
  - AllowEmptyInitialConfiguration + UseDisplayDevice=None for headless operation
  - Xorg config at /etc/X11/xorg-nvidia-headless.conf
  - xdpyinfo verification before using X server
- **Xvfb fallback**: Robust fallback to software rendering if Xorg fails
  - Diagnostic logging for Xorg failures
  - DUEL_CAPTURE_USE_XVFB dynamically set based on outcome
- **Vulkan driver management**: Force NVIDIA-only ICD to avoid Mesa conflicts
  - VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
  - Prevents libGLX_nvidia.so.0 driver conflicts
- **Chrome Dev channel**: google-chrome-unstable for WebGPU support
  - Playwright channel mapping: chrome-dev → google-chrome-unstable
  - STREAM_CAPTURE_CHANNEL=chrome-dev
- **Display server**: DISPLAY=:99 (configurable), ecosystem.config.cjs reads from env

### Audio Capture & Streaming
- **PulseAudio setup**: User-mode PulseAudio with virtual sink
  - XDG_RUNTIME_DIR=/tmp/pulse-runtime
  - chrome_audio sink for browser audio output
  - default.pa config with module-null-sink
  - Fallback if initial start fails
- **Audio capture**: FFmpeg captures from chrome_audio.monitor
  - thread_queue_size=1024 prevents buffer underruns
  - use_wallclock_as_timestamps=1 for real-time timing
  - aresample=async=1000:first_pts=0 recovers from audio drift (22ms threshold)
- **Improved buffering**: Changed from 'zerolatency' to 'film' tune
  - Allows B-frames for better compression
  - Better lookahead for smoother bitrate
  - Set STREAM_LOW_LATENCY=true to restore old behavior
- **Buffer sizing**: Increased from 2x to 4x bitrate (18000k bufsize)
  - Reduces buffering during network hiccups
  - More headroom for bitrate spikes
- **Input buffering**: thread_queue_size for frame queueing, genpts+discardcorrupt for stream recovery
- **FLV flags**: flvflags=no_duration_filesize prevents FLV header issues
- **Audio stability**: Removed -shortest flag that caused audio dropouts during video buffering

### RTMP Streaming
- **Multi-platform**: Twitch, Kick, X (YouTube explicitly disabled)
  - YOUTUBE_STREAM_KEY="" prevents stale keys
  - Kick URL: rtmps://fa723fc1b171.global-contribute.live-video.net/app
  - X URL: rtmp://sg.pscp.tv:80/x
- **Stream key management**: Explicit unset/re-export prevents stale environment values
  - Unset before re-sourcing .env
  - Masked logging for security
  - Passed through GitHub secrets → SSH → .env file
- **Canonical platform**: STREAMING_CANONICAL_PLATFORM=twitch (was youtube)
- **Public delay**: STREAMING_PUBLIC_DELAY_MS=0 for live betting (was 12-15s)

### Deployment Automation
- **Cloudflare Pages workflow**: Automated client deployment on push to main
  - Triggers on changes to packages/client/** or packages/shared/**
  - Uses wrangler pages deploy instead of GitHub integration
  - Includes proper build steps for shared package first
  - Multi-line commit message handling
- **Vast.ai maintenance mode**: Graceful deployment with pause/resume
  - Enter maintenance mode before deployment (300s timeout)
  - Wait for pending markets to resolve
  - Health check after deployment (120s, 30 retries)
  - Exit maintenance mode after successful deployment
  - Manual trigger via workflow_dispatch
- **DATABASE_URL persistence**: Survives git reset operations
  - Secrets written to /tmp/hyperscape-secrets.env before git reset
  - Copied to packages/server/.env after git reset
  - Fallback recreation from environment variables
- **Database warmup**: 3 retry attempts after schema push
  - Prevents cold start failures
  - Uses pg Pool with max: 5 connections
  - 3s delay between retries
- **Bun installation**: Automated check and install
  - Installs unzip dependency first (required for bun)
  - Checks for /root/.bun/bin/bun before installing
  - Adds to PATH for subsequent commands
- **First-time setup**: Auto-clone repo if /root/hyperscape doesn't exist
- **Solana keypair**: Automated setup from SOLANA_DEPLOYER_PRIVATE_KEY
  - Writes to ~/.config/solana/id.json via scripts/decode-key.ts
  - Used by keeper bot and Anchor tools
- **Secrets injection**: pm2 kill instead of pm2 delete
  - Ensures daemon picks up new environment variables on restart
  - Prevents stale env var caching
- **Diagnostics**: Comprehensive streaming diagnostics after deployment
  - FFmpeg process check
  - RTMP status file check
  - PulseAudio sink verification
  - PM2 logs filtered for streaming keywords
  - 30s wait for streaming initialization

### Security Enhancements
- **JWT_SECRET enforcement**: Now required in production/staging (throws error if not set)
  - Generate with: `openssl rand -base64 32`
  - Prevents session hijacking in production
- **ARENA_EXTERNAL_BET_WRITE_KEY**: Added to secrets for external betting integration
- **Solana keypair management**: Setup from env var, removed hardcoded secrets
  - deployer-keypair.json added to .gitignore
  - SOLANA_DEPLOYER_PRIVATE_KEY passed through GitHub secrets
- **Stream key security**: Masked logging, explicit unset of stale values
  - Keys logged as ***configured*** instead of plaintext
  - Prevents accidental exposure in logs
- **ADMIN_CODE**: Required for production admin endpoints

### Client & Build Fixes
- **CSRF cross-origin handling**: Skip validation for known clients (already protected by Origin + JWT)
  - Apex domain support for Cloudflare Pages → Railway
- **R2 CORS automation**: Workflow step configures CORS for asset loading
  - configure-r2-cors.sh script for manual configuration
  - Allows assets.hyperscape.club to serve to all known domains
- **Vite polyfills fix**: Aliases resolve vite-plugin-node-polyfills/shims/* to dist files
  - Fixes "Failed to resolve module specifier" error in production
  - Disabled protocolImports to avoid unresolved imports
- **CSP updates**: Allow Google Fonts and data: URLs
  - fonts.googleapis.com for style-src
  - fonts.gstatic.com for font-src
  - data: URLs for WASM loading
- **Multi-line commit messages**: Pages deploy workflow handles multi-line commit messages

### Rendering Pipeline
- **WebGPU enforcement**: WebGL fallback removed (all shaders use TSL)
  - DUEL_FORCE_WEBGL_FALLBACK removed
  - STREAM_CAPTURE_DISABLE_WEBGPU=false (re-enabled)
- **Memory leak fixes**: AbortController for proper event listener cleanup

### Solana Markets
- **WSOL default**: Markets use native token (WSOL) instead of custom GOLD
  - MARKET_MINT env var replaces GOLD_MINT
  - Defaults to WSOL on each chain
- **Perps oracle disabled**: Default off (program not deployed on devnet)
  - ENABLE_PERPS_ORACLE env var to re-enable when ready
- **MARKET_MINT variable**: Replaced GOLD_MINT for flexibility

### Code Quality
- **Type safety**: Reduced explicit `any` types from 142 to ~46
- **Dead code removal**: 3098 lines removed (PacketHandlers.ts never imported)
- **Circular dependency**: shared ↔ procgen (TODO: extract to @hyperscape/types)
- **WebSocket type fixes**: Use ws library types for Fastify websocket connections

## Additional Resources

### Core Documentation
- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`

### Deployment Guides
- [docs/cloudflare-pages-deployment.md](docs/cloudflare-pages-deployment.md) - Cloudflare Pages automated deployment
- [docs/vast-deployment-improvements.md](docs/vast-deployment-improvements.md) - Vast.ai GPU streaming improvements
- [docs/railway-dev-prod.md](docs/railway-dev-prod.md) - Railway deployment (dev/prod)

### Streaming Documentation
- [docs/streaming-improvements-feb-2026.md](docs/streaming-improvements-feb-2026.md) - RTMP streaming improvements
- [docs/streaming-audio-capture.md](docs/streaming-audio-capture.md) - PulseAudio audio capture setup

### AI Agent Documentation
- [docs/agent-stability-improvements.md](docs/agent-stability-improvements.md) - Model agent stability fixes
- [packages/plugin-hyperscape/README.md](packages/plugin-hyperscape/README.md) - ElizaOS plugin guide

### Blockchain Documentation
- [docs/solana-market-wsol-migration.md](docs/solana-market-wsol-migration.md) - WSOL market token migration

### Technical References
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - Browser/GPU requirements
