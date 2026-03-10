# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with autonomous AI agents powered by ElizaOS.

## CRITICAL: Secrets and Private Keys

**Never put private keys, seed phrases, API keys, tokens, RPC secrets, or wallet secrets into any tracked file.**

- ALWAYS use local untracked `.env` files for real secrets during development
- NEVER hardcode secrets in source, tests, docs, fixtures, scripts, config files, or GitHub workflow files
- NEVER place real credentials in `.env.example`; placeholders only
- Production and CI secrets must live in the platform secret manager, not in git
- If a new secret is required, add only the variable name to docs or `.env.example` and load the real value from `.env`, `.env.local`, or deployment secrets

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
- Safari 18+ (macOS 15+) - **Safari 17 support was removed**
- Firefox (behind flag, not recommended)
- Check WebGPU availability: [webgpureport.org](https://webgpureport.org)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED** - Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run non-headless** with Xorg or Xvfb (WebGPU requires window context)
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

# Full duel stack (game + agents + streaming)
bun run duel

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
bun run dev:ai          # Game + ElizaOS agents
bun run dev:forge       # AssetForge tools
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
│   ├── LiveKit voice chat integration
│   ├── Streaming duel scheduler
│   └── Duel arena oracle publisher
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   └── UI/HUD
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── contracts/           # MUD onchain game state (experimental)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation + VFX catalog
└── docs-site/           # Docusaurus documentation site
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet). The duel arena oracle remains in Hyperscape for verifiable outcome publishing.

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

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
bun run dev:ai     # Game + ElizaOS agents
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
bun run duel       # Full duel stack (game + agents + streaming)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | (hardcoded) | `bun run dev:ai` |
| 5555 | Game Server | `PORT` | `bun run dev` |

**Note**: The betting app (port 4179) and keeper API have been moved to the [hyperbet repository](https://github.com/HyperscapeAI/hyperbet).

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Secret handling is non-negotiable**:
- Real private keys and API tokens must come from local untracked `.env` files
- Tracked files may only contain placeholders and variable names
- If you find a real credential in a tracked file, remove it and move it to `.env` or the deployment secret store immediately

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker), streaming, oracle |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent configuration |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# ElizaCloud AI (for duel arena agents)
ELIZAOS_CLOUD_API_KEY=...        # Single key for 13 frontier models

# Streaming (optional)
TWITCH_STREAM_KEY=...            # or TWITCH_RTMP_STREAM_KEY
KICK_STREAM_KEY=...
YOUTUBE_STREAM_KEY=...           # or YOUTUBE_RTMP_STREAM_KEY
STREAM_ENABLED_DESTINATIONS=...  # Auto-detected if not set

# Oracle (optional)
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=...

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.3.10+ (updated from v1.1.38)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.182.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon/Railway), Docker (local)
- **Testing**: Playwright, Vitest 4.x (upgraded from 2.x for Vite 6 compatibility)
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor
- **AI Agents**: ElizaOS `alpha` packages (^2.0.0-alpha.x) with InMemoryDatabaseAdapter (no PGLite)
- **Streaming**: FFmpeg, Playwright Chromium, RTMP

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Bundle Size Warnings:**

The client and asset-forge packages have increased `chunkSizeWarningLimit` to suppress warnings for intentionally large WebGPU/PhysX bundles:

- `packages/client/vite.config.ts`: 8000 KB (up from 2000 KB) - WebGPU/PhysX bundles
- `packages/asset-forge/vite.config.ts`: 9000 KB (new) - Asset tooling with WebGPU

These limits are intentional until deeper code splitting is implemented. The large bundles are due to:
- Three.js WebGPU renderer and TSL shader system
- PhysX WASM bindings
- Asset processing tools (GLB decimation, impostor baking, etc.)

**Tech Debt**: Track deeper code splitting as future optimization to reduce initial bundle size.

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
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### Agent Memory Issues

If agents are consuming excessive memory:
- Check that InMemoryDatabaseAdapter is being used (not PGLite)
- Verify memory caps are in place (50 memories per agent, 20 adapter logs, 100 cache entries)
- Monitor periodic GC is running (every 60s)
- Check DB connection pool isn't exhausted (max 5 concurrent bank queries)

### Database Connection Pool Exhaustion

If seeing "timeout exceeded when trying to connect" errors:
- Increase serverless PG pool max (default: 20)
- Increase connection timeout (default: 60s)
- Enable concurrency limiting for bank queries (max 5)
- Stagger agent refresh intervals to distribute load

### CSRF 403 Errors

If account creation fails with "CSRF validation failed" (403) when running client on localhost against a deployed server:
- Ensure `UsernameSelectionScreen` includes Privy auth token in Authorization header (fixed in commit 0b1a0bd)
- Verify CSRF middleware allows localhost/private IP origins
- Check that client's `api-client.ts` accepts both `{ token }` and `{ csrfToken }` response formats

### Streaming Issues

If RTMP streaming fails to start:
- Verify stream keys are set: `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, `YOUTUBE_STREAM_KEY`
- Check `STREAM_ENABLED_DESTINATIONS` is set or auto-detected
- Ensure FFmpeg is installed: `which ffmpeg` or set `FFMPEG_PATH`
- Verify Playwright Chromium is installed: `bunx playwright install chromium`
- Check GPU display driver is active (Vast.ai: `gpu_display_active=true`)
- Review logs: `bunx pm2 logs hyperscape-duel`

## Recent Changes (March 2026)

### PM2 Deployment Improvements (March 9-10, 2026)

**PM2 Secrets Loading** (Commit 684b203):
- `ecosystem.config.cjs` now reads `/tmp/hyperscape-secrets.env` directly at config load time
- Fixes issue where `bunx pm2` doesn't reliably inherit exported environment variables
- Ensures `DATABASE_URL` and stream keys are always available to PM2-managed processes

**Database Mode Auto-Detection** (Commit 3df4370):
- Automatically detects `DUEL_DATABASE_MODE` from `DATABASE_URL` hostname
- Local mode: localhost, 127.0.0.1, 0.0.0.0, ::1
- Remote mode: all other hostnames
- Prevents `sanitizeRuntimeEnv()` from stripping `DATABASE_URL` in remote mode
- Manual override via `DUEL_DATABASE_MODE=remote` environment variable

**Chrome Beta for Streaming** (Commit 547714e):
- Switched from `google-chrome-unstable` to `google-chrome-beta` for better stability
- Changed `STREAM_CAPTURE_ANGLE` from `vulkan` to `default` for better compatibility
- Default ANGLE backend automatically selects best backend for the system

**DATABASE_URL PM2 Forwarding** (Commit 5d415fc):
- `ecosystem.config.cjs` now explicitly forwards `DATABASE_URL` through PM2 environment
- Prevents server crashes with FATAL error when DATABASE_URL is missing

**Xvfb Display Environment** (Commits 704b955, 294a36c):
- `ecosystem.config.cjs` explicitly sets `DISPLAY=:99` in PM2 environment
- `deploy-vast.sh` starts Xvfb before PM2 to ensure virtual display is available
- Prevents "cannot open display" errors during RTMP streaming on headless servers

**Configuration**:
```bash
# Auto-detected database mode
DUEL_DATABASE_MODE=remote  # or local (auto-detected from DATABASE_URL)

# Chrome Beta streaming
STREAM_CAPTURE_CHANNEL=chrome-beta
STREAM_CAPTURE_ANGLE=default

# Xvfb display
DISPLAY=:99
```

### Streaming Pipeline Fixes (March 9, 2026)

**Auto-Detection**: Stream destinations now auto-detected from available keys.

**Changes**:
- `deploy-vast.sh`: Auto-detects enabled destinations from `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, etc.
- `ecosystem.config.cjs`: Explicitly forwards stream keys through PM2 environment
- `deploy-vast.yml`: Adds `TWITCH_RTMP_STREAM_KEY` alias for compatibility
- `stream.html` / `stream.tsx`: Dedicated streaming entry points with optimized bundles
- `clientViewportMode()`: Utility to detect stream/spectator/normal modes
- Multi-page Vite build: Separate bundles for game and streaming

**Environment Variables**:
```bash
# Auto-detected from available keys (no manual config needed)
STREAM_ENABLED_DESTINATIONS=twitch,kick

# Twitch (multiple formats supported)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
```

**Impact**: Reliable multi-platform RTMP streaming with automatic destination detection.

### CSRF Cross-Origin Fix (March 9, 2026)

**Problem**: Account creation failed with 403 when client runs on localhost:3333 against deployed server.

**Root Cause**: Missing Authorization header + CSRF token response shape mismatch.

**Fixes**:
- `UsernameSelectionScreen.tsx`: Include Privy auth token as `Authorization: Bearer` header
- `api-client.ts`: Accept both `{ token }` and `{ csrfToken }` from CSRF endpoint
- `csrf.ts`: Added localhost and private-IP patterns to `KNOWN_CROSS_ORIGIN_PATTERNS`

**Impact**: Cross-origin local development works without CSRF errors.

### ElizaCloud Integration (March 9, 2026)

**Unified AI Provider**: All duel arena agents now use `@elizaos/plugin-elizacloud`.

**13 Frontier Models**:
- American: GPT-5, Claude 4.6 (Sonnet/Opus), Gemini 3.1 Pro, Grok 4, Llama 4 Maverick, Magistral Medium
- Chinese: DeepSeek V3.2, Qwen 3 Max, Minimax M2.5, GLM-5, Kimi K2.5, Seed 1.8

**Configuration**:
```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

**Code Changes**:
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Updated MODEL_AGENTS array with ElizaCloud models
- `packages/server/src/eliza/agentHelpers.ts` - Added elizacloud provider to DEFAULT_SMALL_MODELS and MODEL_SETTING_KEYS
- `packages/server/src/eliza/index.ts` - Added elizacloud to modelProviders type union

**Benefits**:
- Single API key for all models (no need for OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY)
- Access to 13 frontier models from 13 different providers
- Simplified agent configuration and deployment
- Consistent error handling and retry logic

### Betting Stack Split (March 9, 2026)

**Separate Repository**: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

**Moved Packages**:
- `gold-betting-demo` - Betting frontend and keeper API
- `evm-contracts` - EVM smart contracts (GoldClob, AgentPerpEngine, SkillOracle)
- `sim-engine` - Cross-chain risk simulation
- `market-maker-bot` - Automated liquidity seeding

**Remaining in Hyperscape**:
- `duel-oracle-evm` - EVM duel outcome oracle contracts
- `duel-oracle-solana` - Solana duel outcome oracle program
- Oracle publisher and metadata API

**Rationale**:
- Independent deployment and versioning
- Cleaner separation: Oracle (verifiable outcomes) vs Betting (financial markets)
- Reduced monorepo complexity
- Better CI/CD isolation

### Oracle Improvements (March 9, 2026)

**New Database Fields:**
- `damage_a` - Total damage dealt by participant A
- `damage_b` - Total damage dealt by participant B
- `win_reason` - Detailed win reason (knockout, timeout, forfeit, draw)
- `seed` - Cryptographic seed for replay verification
- `replay_hash` - Hash of replay data
- `result_hash` - Combined hash of all outcome data

**New Scripts:**
- `verify-duel-oracle-local` - Local oracle integration testing
- EVM deploy scripts with receipt generation
- Solana config.json with program IDs

**Configuration**:
```bash
# Oracle toggle
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet

# Metadata API
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle

# Signers
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
```

**Impact**: Comprehensive duel outcome data for betting market settlement and replay verification.

### WebGPU Fixes (March 9, 2026)

**Buffer Upload Fallback:**
- Automatic fallback when `mappedAtCreation` fails
- Improved error handling for GPU buffer allocation
- Better compatibility across different GPU drivers

**Null Safety:**
- Fixed physics utils null pointer exceptions
- Collider and rigidbody null checks
- Particle manager JSON parsing fixes
- Vegetation system error handling

### Code Quality (March 8-9, 2026)

**Static Imports:**
- GLTFExporter now uses static imports (better tree-shaking)
- Logger import converted to static (faster module loading)
- Eliminates async import boilerplate

**Dead Code Removal:**
- VFX Preview: Removed unused opacity, primaryColor, whiteGlow, ringMat variables
- Type guards: Added `isCombatHud()` for proper type narrowing

**Cross-Runtime Compatibility:**
- `writeArrayBufferToFile()` utility supports both Bun and Node.js
- Proper runtime detection for file operations

**Panel Optimization:**
- Un-lazified critical panels (Inventory, Stats, Prayer, Spells) for faster initial load
- Other panels (Equipment, Quest, Friends) remain lazy-loaded

**Bundle Size:**
- Client: `chunkSizeWarningLimit` increased to 8000KB (up from 2000KB)
- Asset-forge: `chunkSizeWarningLimit` increased to 9000KB (new)
- Intentional for WebGPU/PhysX bundles until deeper code splitting

**TypeScript Fixes:**
- Resolved TS18048 errors using nullish coalescing (`??`) instead of logical OR (`||`)
- Added explicit string types to `api-config.ts` URL exports

### Testing & CI (March 9, 2026)

**Vitest 4.x Upgrade**:
- Required for Vite 6 compatibility
- Fixes `__vite_ssr_exportName__` errors
- No API changes - tests work as-is

**CI Stabilization**:
- Fixed workflow dependency resolution
- Improved test reliability across packages
- More reliable GitHub Actions builds

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions and feature documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- [docs/duel-stack.md](docs/duel-stack.md) - Duel stack documentation
- [docs/duel-arena-oracle-deploy.md](docs/duel-arena-oracle-deploy.md) - Oracle deployment guide
- [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) - Betting stack (separate repository)
- Game Design Document: See `.cursor/rules/gdd.mdc`
