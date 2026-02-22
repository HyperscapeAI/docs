# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with AI agents, live streaming duels, and Solana betting integration.

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

### Streaming Duel Arena
```bash
# Start full duel stack (game + bots + streaming + betting)
bun run duel

# Options
bun run duel --bots=8              # Start with 8 duel bots
bun run duel --skip-betting        # Skip betting app (stream only)
bun run duel --skip-stream         # Skip RTMP/HLS (betting only)
bun run duel --with-mm             # Enable market maker bots
bun run duel --fresh               # Force fresh restart
bun run duel --verify              # Run startup verification
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
│   ├── Streaming duel scheduler
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── gold-betting-demo/   # Solana betting integration
│   ├── anchor/          # Solana programs (Fight Oracle, CLOB Market)
│   ├── app/             # Betting UI (React + Vite)
│   └── keeper/          # Automated market operations
├── market-maker-bot/    # CLOB market maker bots
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

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

## Particle System Architecture

### ParticleManager (Unified Particle System)

**Location:** `packages/shared/src/entities/managers/particleManager/`

The particle system was refactored in commit `4168f2f` to centralize GPU-instanced particle rendering:

**Architecture:**
- **ParticleManager** - Central router that dispatches particle events to specialized sub-managers
- **WaterParticleManager** - Handles fishing spot particles (splash, bubble, shimmer, ripple)
- **GlowParticleManager** - Handles instanced glow billboards (altar, fire, torch)

**Performance Impact:**
- Reduced ~150 draw calls to 4 InstancedMeshes
- Removed ~450 lines of per-entity CPU particle animation code
- All particle animation runs in GPU via TSL NodeMaterials

**Usage:**
```typescript
// Register water particles (fishing spot)
particleManager.register('fishing_spot_1', {
  type: 'water',
  position: { x: 10, y: 0, z: 20 },
  resourceId: 'fishing_spot_net'
});

// Register glow particles (altar, fire, torch)
particleManager.register('altar_1', {
  type: 'glow',
  preset: 'altar',
  position: { x: 5, y: 0, z: 10 },
  color: 0x88ccff
});

// Move particle emitter
particleManager.move('fishing_spot_1', { x: 12, y: 0, z: 22 });

// Unregister (automatic cleanup)
particleManager.unregister('fishing_spot_1');
```

**Glow Presets:**
- `altar` - Geometry-aware sparks rising from altar mesh
- `fire` - Campfire with rising embers and heat distortion
- `torch` - Tight cluster of 6 particles with flicker animation

**Implementation Details:**
- Uses InstancedBufferAttributes for per-instance data (position, age, dynamics)
- TSL NodeMaterials for GPU-driven animation
- Vertex buffer budget: 7 of 8 max attributes per particle layer
- Ripple layer: 5 of 8 max attributes

## AI Combat System

### DuelCombatAI (Trash Talk System)

**Location:** `packages/server/src/arena/DuelCombatAI.ts`

Added in commit `8ff3ad3` - AI agents now generate trash talk during combat using LLMs or scripted fallbacks.

**Features:**
- Health threshold detection at 75%, 50%, 25%, 10% for self and opponent
- LLM-generated taunts using agent character bio/style via TEXT_SMALL model
- Scripted fallback taunt pools when no runtime available
- Ambient periodic taunts every 15-25 ticks
- 8-second cooldown between messages
- All trash talk is fire-and-forget (never blocks combat tick)

**Trash Talk Triggers:**
1. **Own Health Milestones** - When agent's HP crosses threshold (descending)
2. **Opponent Health Milestones** - When opponent's HP crosses threshold
3. **Ambient Taunts** - Random periodic taunts during combat

**LLM Integration:**
```typescript
// Trash talk uses agent character personality from ElizaOS runtime
const character = runtime.character;
const bioText = character?.bio; // Agent backstory
const styleHints = character?.style?.all; // Communication style

// Generates short messages (under 40 chars) for overhead chat bubble
// Temperature: 0.9 for creative, varied responses
// Timeout: 3 seconds (falls back to scripted on timeout)
```

**Scripted Fallbacks:**
- Own low HP: "Not even close!", "I've had worse", "Is that all?"
- Opponent low HP: "GG soon", "You're done!", "Sit down"
- Ambient: "Let's go!", "Fight me!", "Too slow"

**Configuration:**
```typescript
// In DuelOrchestrator, wire sendChatMessage callback:
const combatAI = new DuelCombatAI(
  service,
  opponentId,
  config,
  runtime,
  (text) => this.sendChatMessage(agentId, text) // Callback for chat
);
```

**Combat Allowed:**
The `CHAT_MESSAGE` action is now allowed during combat (previously blocked). This enables trash talk without breaking combat state.

## Streaming Infrastructure

### RTMP Multi-Platform Streaming

**Location:** `packages/server/src/streaming/`

The streaming system supports simultaneous broadcast to multiple platforms:

**Supported Platforms:**
- Twitch
- YouTube
- Kick
- Pump.fun (limited access)
- X/Twitter (requires Premium)
- Custom RTMP destinations
- RTMP multiplexer services (Restream, Livepeer)

**Capture Modes:**
- `cdp` - Chrome DevTools Protocol (default on macOS)
- `webcodecs` - WebCodecs API (default on Linux, lower CPU)

**Rendering Backends:**
- `vulkan` - Vulkan (default, best performance)
- `metal` - Metal (macOS)
- `gl` - OpenGL ANGLE (fallback for broken Vulkan ICD)
- `swiftshader` - Software rendering (CPU fallback)

**Environment Variables:**
```bash
# Capture configuration
STREAM_CAPTURE_MODE=webcodecs        # cdp | webcodecs
STREAM_CAPTURE_CHANNEL=chrome        # chrome | chromium
STREAM_CAPTURE_ANGLE=vulkan          # vulkan | metal | gl | swiftshader
STREAM_CAPTURE_DISABLE_WEBGPU=false  # Force WebGL fallback
STREAM_CAPTURE_HEADLESS=true         # Headless mode (Linux default)

# HLS output
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2
HLS_LIST_SIZE=24
HLS_DELETE_THRESHOLD=96
HLS_START_NUMBER=1700000000
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file

# RTMP destinations
TWITCH_STREAM_KEY=live_123456789_abcdefghij
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
```

**Stability Fixes (commits `f3aa787`, `ae42beb`, `5e4c6f1`):**
- Removed aggressive GPU flags that crash RTX 5060 Ti
- Use GL ANGLE backend when Vulkan ICD is broken
- Use system FFmpeg to avoid static build SIGSEGV
- Switch to headful mode with Xvfb for GPU compositing on Linux

**Chrome Channel Selection (commits `ba8bd53`, `d824163`):**
- Use Chrome Dev channel for WebGPU support on Vast.ai
- Stable Chrome lacks WebGPU on some cloud GPU instances

## Solana Betting Integration

### CLOB Market Mainnet Migration

**Commits:** `dba3e03`, `35c14f9`

The betting system has been migrated from binary market to CLOB (Central Limit Order Book) market on Solana mainnet:

**Program Updates:**
- Fight Oracle: `Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1` (mainnet)
- GOLD CLOB Market: Updated to mainnet program ID
- GOLD Token: `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`

**Bot Rewrite:**
The keeper bot (`packages/gold-betting-demo/keeper/src/bot.ts`) was completely rewritten for CLOB instructions:
- `initializeConfig` - Initialize market configuration
- `initializeMatch` - Create new match/duel
- `initializeOrderBook` - Set up order book for match
- `resolveMatch` - Settle match and distribute payouts

**Removed:**
- Binary market seeding/vault logic
- Old binary market IDL files

**Updated Files:**
- `packages/gold-betting-demo/anchor/programs/fight_oracle/src/lib.rs` - Mainnet program ID
- `packages/gold-betting-demo/anchor/programs/gold_clob_market/src/lib.rs` - Mainnet program ID
- `packages/gold-betting-demo/keeper/src/bot.ts` - CLOB instruction rewrite
- `packages/gold-betting-demo/keeper/src/common.ts` - Mainnet fallback program IDs
- `packages/server/src/arena/config.ts` - Mainnet fight oracle fallback
- `packages/gold-betting-demo/app/.env.mainnet` - All VITE_ vars for mainnet

### Market Maker Bot

**Location:** `packages/market-maker-bot/`

Automated market making for CLOB betting markets with duel signal integration:

**Environment Variables:**
```bash
MM_DUEL_STATE_API_URL=http://localhost:5555/api/streaming/state
MM_ENABLE_DUEL_SIGNAL=true
MM_DUEL_SIGNAL_WEIGHT=0.9
MM_DUEL_HP_EDGE_MULTIPLIER=0.49
MM_DUEL_SIGNAL_FETCH_TIMEOUT_MS=2500
MM_TAKER_INTERVAL_CYCLES=1
ORDER_SIZE_MIN=40
ORDER_SIZE_MAX=140
MM_TAKER_SIZE_MIN=20
MM_TAKER_SIZE_MAX=80
MAX_ORDERS_PER_SIDE=6
CANCEL_STALE_AGE_MS=12000
```

**Modes:**
- `single` - Single wallet market maker
- `multi` - Multiple wallets with staggered startup

**Usage:**
```bash
# Single wallet
bun run --cwd packages/market-maker-bot start

# Multiple wallets
bun run --cwd packages/market-maker-bot start:multi -- \
  --config wallets.generated.json \
  --stagger-ms 900
```

## Test Suite Improvements

### WebGPU Test Support

**Commit:** `25ba63c`

Added `vitest.setup.ts` to mock WebGPU browser globals for test compatibility:

**Mocked Globals:**
- `GPUShaderStage` - Shader stage constants
- `GPUBufferUsage` - Buffer usage flags
- `GPUTextureUsage` - Texture usage flags
- Other WebGPU constants required by Three.js WebGPU renderer

**Test Fixes:**
- Added protected passthrough methods on ArenaService for test spying
- Updated ArenaService.referrals.test.ts to use `setDbMock` helper
- Fixed StreamingDuelScheduler integration test to accept undefined as falsy

**Test Results:**
- 1569 tests passing
- 85 tests skipped (need deeper refactoring)

**Skipped Tests:**
- ArenaService lifecycle tests (need createBetOpenRound fix)
- ArenaService simulation tests (need architecture updates)
- ArenaService referrals tests (sub-services call ctx directly)
- StreamingDuelScheduler unit tests (internal methods moved)
- Admin index integration tests (need DB migrations)

### Build Resilience

**Commit:** `5666ece`

Made procgen and plugin-hyperscape builds resilient to circular dependencies:

**Issue:**
Both packages have circular dependencies with @hyperscape/shared. When turbo runs a clean build, tsc fails because the other package's dist/ doesn't exist yet.

**Solution:**
Use `tsc || echo` pattern so builds exit 0 even with circular dep errors. Packages still produce partial output sufficient for downstream consumers.

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
bun run duel       # Full duel stack (game + bots + streaming + betting)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | - | `bun run dev:ai` |
| 4179 | Betting App | - | `bun run duel` |
| 5555 | Game Server | `PORT` | `bun run dev` |
| 8765 | RTMP Bridge | `RTMP_BRIDGE_PORT` | `bun run duel` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Betting Demo | `packages/gold-betting-demo/app/.env.example` | Betting app deployment |

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

# AI Agent Configuration (duel stack and streaming)
SPAWN_MODEL_AGENTS=false         # Enable heavyweight model-agent spawner (default: false)
MAX_MODEL_AGENTS=0               # Maximum number of model agents to spawn (default: 0)
MEMORY_RESTART_THRESHOLD_MB=12288 # Memory threshold for auto-restart in MB (default: 12288)

# Duel stack defaults (scripts/duel-stack.mjs)
AUTO_START_AGENTS=true           # Auto-load embedded agents (default: true for duel stack)
AUTO_START_AGENTS_MAX=10         # Max embedded agents to start (default: 10)
EMBEDDED_AGENT_AUTONOMY_ENABLED=false  # Enable background questing/pathing (default: false for streaming)
STREAMING_DUEL_LLM_TACTICS_ENABLED=false  # Enable LLM-based combat tactics (default: false for stability)
STREAMING_DUEL_COMBAT_AI_ENABLED=false    # Enable per-agent DuelCombatAI (default: false)
```

**Duel Stack Environment Variables:**

Added in commit `68c0020`:
```bash
# Agent spawning control
SPAWN_MODEL_AGENTS=false         # Disable heavyweight model agent spawner
MAX_MODEL_AGENTS=0               # Max model agents to spawn
AUTO_START_AGENTS=true           # Auto-load embedded agents from DB
AUTO_START_AGENTS_MAX=10         # Max embedded agents to auto-start

# Memory management
MEMORY_RESTART_THRESHOLD_MB=12288  # Restart threshold (12GB)

# Combat AI configuration
STREAMING_DUEL_LLM_TACTICS_ENABLED=false      # Use LLM for combat strategy
STREAMING_DUEL_COMBAT_AI_ENABLED=false        # Enable per-agent DuelCombatAI
EMBEDDED_AGENT_AUTONOMY_ENABLED=false         # Disable background questing during duels

# Streaming timing
STREAMING_ANNOUNCEMENT_MS=30000    # Announcement phase duration
STREAMING_FIGHTING_MS=150000       # Combat phase duration
STREAMING_END_WARNING_MS=10000     # End warning duration
STREAMING_RESOLUTION_MS=5000       # Resolution phase duration
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
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon)
- **Blockchain**: Solana (mainnet), Anchor framework
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor
- **Streaming**: FFmpeg, Playwright, WebCodecs

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
lsof -ti:4179 | xargs kill -9  # Betting App
lsof -ti:8765 | xargs kill -9  # RTMP Bridge
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### ESLint Crashes with ajv TypeError

**Fixed in commit `b344d9e`**

If ESLint crashes with `TypeError: Class extends value undefined is not a constructor or null` related to ajv:

**Cause:**
Forcing ajv@8 on @eslint/eslintrc which requires ajv@6 for Draft-04 schema support.

**Solution:**
Remove ajv>=8.18.0 override from package.json. The fix is already applied in the latest code.

### Integration Tests Fail with "anvil: command not found"

**Fixed in commit `b344d9e`**

**Cause:**
Integration tests start a local Ethereum node with anvil, but the binary wasn't available in CI.

**Solution:**
CI workflow now installs `foundry-rs/foundry-toolchain` before running integration tests.

**Local Development:**
Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Streaming Crashes on Vast.ai RTX 5060 Ti

**Fixed in commits `f3aa787`, `ae42beb`, `5e4c6f1`, `30cacb0`**

**Symptoms:**
- Chrome crashes with Vulkan ICD errors
- Static FFmpeg build causes SIGSEGV
- WebGPU not available in stable Chrome

**Solutions Applied:**
1. Use GL ANGLE backend instead of Vulkan when ICD is broken
2. Use system FFmpeg instead of static build
3. Use Chrome Dev channel for WebGPU support
4. Remove RTX 5060 Ti from GPU search in vast-keeper
5. Switch to headful mode with Xvfb for GPU compositing

**Environment Variables:**
```bash
STREAM_CAPTURE_ANGLE=gl          # Use OpenGL ANGLE instead of Vulkan
STREAM_CAPTURE_CHANNEL=chrome    # Use Chrome Dev for WebGPU
STREAM_CAPTURE_HEADLESS=false    # Use headful with Xvfb
```

### Vast.ai Keeper Setup

**Commits:** `3ce7d64`, `63374bb`, `621ae67`, `d9e9111`, `987e037`, `5c2a561`

The vast-keeper package automates Vast.ai GPU instance management for streaming:

**Fixes Applied:**
1. Install vastai CLI via pip3 in Docker
2. Use `python3 -m vastai` instead of binary invocation
3. Upgrade to bookworm-slim for Python 3.11+ (vastai-sdk requires 3.10+)
4. Add `--break-system-packages` for pip3 on Debian 12 (PEP 668)
5. Use python venv for vastai install to guarantee binary on PATH
6. Generate SSH keys in Docker for instance access

**Docker Configuration:**
```dockerfile
# Install Python and vastai CLI
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv
RUN python3 -m venv /opt/vastai-venv
RUN /opt/vastai-venv/bin/pip install --break-system-packages vastai
ENV PATH="/opt/vastai-venv/bin:$PATH"
```

### Deployment DNS Configuration

**Commit:** `fd17248`

**Issue:**
Docker containers on some hosts use broken DNS resolvers that fail to resolve external domains.

**Solution:**
Overwrite `/etc/resolv.conf` with Google DNS instead of appending:
```bash
echo "nameserver 8.8.8.8" > /etc/resolv.conf
echo "nameserver 8.8.4.4" >> /etc/resolv.conf
```

### Circular Dependency Build Errors

**Commit:** `5666ece`

**Affected Packages:**
- `packages/procgen` - Circular dependency with @hyperscape/shared
- `packages/plugin-hyperscape` - Circular dependency with @hyperscape/shared

**Solution:**
Use `tsc || echo` pattern in build scripts so builds exit 0 even with circular dep errors. Packages still produce partial output sufficient for downstream consumers.

**Example:**
```json
{
  "scripts": {
    "build": "tsc || echo 'Build completed with circular dependency warnings'"
  }
}
```

### TypeScript Errors in CI

**Commit:** `5e60439`

Fixed 4 TypeScript errors for CI typecheck:

1. **AgentManager.ts** - Cast EmbeddedHyperscapeService to HyperscapeService
2. **ArenaService.ts** - Cast unknown position param via `Parameters<>` utility
3. **ArenaRoundService.ts** - Change `getEligibleAgents` from private to public

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
- Duel Stack Documentation: See `docs/duel-stack.md`
- Streaming Mode Plan: See `STREAMING_MODE_PLAN.md`
