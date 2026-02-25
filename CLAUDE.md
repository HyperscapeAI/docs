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

**Test Suite Status (as of Feb 22, 2026):**
- ✅ 1569 tests passing
- ⏭️ 85 tests skipped (pending deeper refactoring)
- 🔧 WebGPU mocks added for Three.js WebGPU renderer compatibility

**Recent Test Infrastructure Improvements:**

- **WebGPU Mocks** (commit 25ba63c): Added `vitest.setup.ts` to mock WebGPU browser globals
  - Mocks: GPUShaderStage, GPUBufferUsage, GPUTextureUsage, GPUTextureFormat, etc.
  - Required by Three.js WebGPU renderer in test environment
  - Prevents "GPUShaderStage is not defined" errors
  - Location: `packages/server/vitest.setup.ts`

- **ArenaService Test Helpers** (commit 25ba63c): Added protected passthrough methods for test spying
  - Methods: getDb, getEligibleAgents, findReferralMappingForWalletNetwork
  - Methods: listIdentityWallets, listLinkedWallets, recordFeeShare, awardPoints
  - Database mock helper: `setDbMock` properly configures world.getSystem("database") mock

- **Skipped Tests** (pending refactoring):
  - ArenaService lifecycle tests (need createBetOpenRound fix)
  - ArenaService simulation tests (need architecture updates)
  - ArenaService referrals tests (sub-services call ctx directly)
  - StreamingDuelScheduler unit tests (internal methods moved)
  - Admin index integration tests (need DB migrations)

- **CI Reliability Improvements**:
  - Foundry toolchain installed for anvil binary (commit b344d9e)
  - Chain setup skipped when CI=true (commit 034f9c9)
  - EVM contracts excluded from turbo test filter
  - Docs update failures handled gracefully (continue-on-error)
  - Assets directory removed before clone to avoid conflicts (commit 6ce05cc)

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
│   ├── GPU-instanced ParticleManager (fishing spots, future effects)
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence
│   ├── Duel trash talk system (LLM + scripted fallbacks)
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── gold-betting-demo/   # Solana CLOB betting integration (mainnet)
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

### GPU-Instanced Particle System Architecture

**ParticleManager** (commit 4168f2f, PR #877) - Centralized GPU-instanced particle rendering

**Performance Impact:**
- Reduced fishing spot draw calls from ~150 to 4 (97% reduction)
- Removed ~450 lines of per-entity CPU animation code
- FPS improvement: 65-70 → 120 on reference hardware

**Architecture:**

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash layer (InstancedMesh, parabolic arcs)
│   ├── Bubble layer (InstancedMesh, rise + wobble)
│   ├── Shimmer layer (InstancedMesh, surface twinkle)
│   └── Ripple layer (InstancedMesh, expanding rings)
└── [Future managers: fire, magic, dust, etc.]
```

**Key Components:**

1. **ParticleManager** (`packages/shared/src/entities/managers/particleManager/ParticleManager.ts`)
   - Central entry point for all particle systems
   - Routes events to specialized sub-managers based on resource type
   - Extensible architecture for adding new particle types

2. **WaterParticleManager** (`packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`)
   - 4 GPU InstancedMeshes (splash, bubble, shimmer, ripple)
   - TSL NodeMaterials with InstancedBufferAttributes
   - Per-instance data: spotPos (vec3), ageLifetime (vec2), angleRadius (vec2), dynamics (vec4)
   - GPU-computed: billboard orientation, parabolic arcs, wobble, twinkle, ring expansion

3. **ResourceSystem Integration** (`packages/shared/src/systems/shared/entities/ResourceSystem.ts`)
   - Creates ParticleManager on client startup
   - Forwards resource events via `handleResourceEvent()`
   - Calls `particleManager.update(dt, camera)` per frame

4. **ResourceEntity Delegation** (`packages/shared/src/entities/world/ResourceEntity.ts`)
   - Registers fishing spots with ParticleManager via `tryRegisterWithParticleManager()`
   - Retains only lightweight glow mesh for interaction detection
   - Lazy registration pattern handles timing/lifecycle edge cases

**Vertex Buffer Budget:**
- Particle layers: 7 of 8 max attributes (position, uv, instanceMatrix, spotPos, ageLifetime, angleRadius, dynamics)
- Ripple layer: 5 of 8 max attributes (position, uv, instanceMatrix, spotPos, rippleParams)

**Adding New Particle Types:**
1. Create sub-manager class in `packages/shared/src/entities/managers/particleManager/`
2. Instantiate in ParticleManager constructor
3. Add routing logic in register/unregister/move/handleEvent methods
4. Call update() and dispose() from ParticleManager

**Fishing Spot Variants:**
- Net fishing: calm/gentle (2 ripples, 4 splash, 3 bubble, 3 shimmer)
- Bait fishing: medium activity (2 ripples, 5 splash, 4 bubble, 4 shimmer)
- Fly fishing: active (2 ripples, 8 splash, 5 bubble, 5 shimmer)

### Duel Trash Talk System

**DuelCombatAI Trash Talk** (commit 8ff3ad3) - AI agents taunt during combat

**Features:**
- Health threshold detection at 75%, 50%, 25%, 10% for self and opponent
- LLM-generated taunts using agent character bio/style via TEXT_SMALL model
- Scripted fallback taunt pools when no LLM runtime available
- Ambient periodic taunts every 15-25 ticks
- 8-second cooldown between messages
- Fire-and-forget message delivery (non-blocking)

**Implementation:**

1. **DuelCombatAI** (`packages/server/src/arena/DuelCombatAI.ts`)
   - Health monitoring with threshold tracking
   - LLM taunt generation with character-specific prompts
   - Fallback taunt pools for offline/no-runtime scenarios
   - Ambient taunt timer with randomized intervals

2. **DuelOrchestrator Integration** (`packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`)
   - Wires `sendChatMessage` callbacks into combat AIs
   - Passes through to social system for broadcast

3. **Social System** (`packages/shared/src/systems/shared/character/social.ts`)
   - CHAT_MESSAGE action now allowed during combat
   - Broadcasts taunts to spectators and participants

**Taunt Categories:**
- Self health thresholds: 75%, 50%, 25%, 10%
- Opponent health thresholds: 75%, 50%, 25%, 10%
- Ambient taunts (periodic, no trigger)

**Testing:**
- 5 new trash talk tests added (14/14 passing)
- Tests verify LLM generation, fallback pools, cooldowns, and health triggers

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
| 4001 | ElizaOS API | `ELIZA_PORT` | `bun run dev:ai` |
| 4179 | Betting App | `VITE_PORT` | `bun run duel` |
| 5555 | Game Server | `PORT` | `bun run dev` |
| 8765 | RTMP Bridge | `RTMP_PORT` | `bun run duel` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent config |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Database migrations (CI/testing)
SKIP_MIGRATIONS=true             # Skip server migration when schema created externally

# Streaming (optional)
TWITCH_STREAM_KEY=live_...       # For Twitch streaming
YOUTUBE_STREAM_KEY=xxxx-...      # For YouTube streaming

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**SKIP_MIGRATIONS Environment Variable:**

When `SKIP_MIGRATIONS=true`, the server skips:
- Built-in migration execution
- `hasRequiredPublicTables` validation check
- Migration recovery loop

**Use Cases:**
- CI/testing environments using `drizzle-kit push` for declarative schema creation
- External schema management (avoids FK ordering issues in migration files)
- Integration tests that create schema before server startup

**Important**: When using `SKIP_MIGRATIONS=true`, you MUST create the database schema externally (e.g., via `drizzle-kit push`) before starting the server. The server will not create tables or run migrations.

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
- **Engine**: Three.js 0.183.1 (WebGPU + TSL shaders), PhysX (WASM)
- **UI**: React 19.2.0, styled-components, Framer Motion 12.34.3
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon/Supabase), Drizzle ORM
- **Testing**: Playwright 1.58.2, Vitest, Chai 6.2.2
- **Build**: Turbo, esbuild, Vite 5.1.4+
- **Mobile**: Capacitor 8.1.0, Tauri
- **Blockchain**: Solana (mainnet), Anchor 0.32.1, CLOB market program, @elizaos/core 2.0.0-alpha.12
- **Streaming**: RTMP (Twitch, YouTube), HLS, FFmpeg
- **Validation**: Zod 4.3.6
- **AI SDK**: @ai-sdk/anthropic 3.0.46
- **Icons**: lucide-react 0.575.0
- **Environment**: dotenv 17.3.1
- **Linting**: ESLint 10.0.2
- **3D Optimization**: three-mesh-bvh 0.9.8

**Recent Dependency Updates (Feb 2026):**
- Three.js: 0.182.0 → 0.183.1 (client, asset-forge, shared)
- @types/three: 0.180.0 → 0.183.1 (plugin-hyperscape, asset-forge)
- @types/node: 24.10.13 → 25.3.0 (shared, server, asset-forge)
- @ai-sdk/anthropic: 1.2.12 → 3.0.46 (asset-forge, plugin-hyperscape)
- @vitejs/plugin-react: 5.0.4 → 5.1.4
- @capacitor/cli: 7.5.0 → 8.1.0 (shared)
- @coral-xyz/anchor: 0.31.1 → 0.32.1
- @elizaos/core: 2.0.0-alpha.11 → 2.0.0-alpha.12
- @playwright/test: 1.54.2 → 1.58.2
- chai: 4.5.0 → 6.2.2
- dotenv: 16.6.1 → 17.3.1 (shared)
- eslint: 9.39.3 → 10.0.2 (shared, asset-forge, plugin-hyperscape)
- framer-motion: 11.18.2 → 12.34.3
- lucide-react: 0.553.0 → 0.575.0 (asset-forge, client)
- three-mesh-bvh: 0.8.3 → 0.9.8 (shared)
- vite-plugin-node-polyfills: 0.24.0 → 0.25.0
- zod: 3.25.76 → 4.3.6

## Security & CI/CD

### Security Audit Status

**Recent Fixes (commit a390b79, Feb 22 2026):**
- ✅ Resolved 14 of 16 npm audit vulnerabilities
- ✅ Playwright ^1.55.1 (fixes GHSA-7mvr-c777-76hp, high)
- ✅ Vite ^6.4.1 (fixes GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ ajv ^8.18.0 (fixes GHSA-2g4f-4pwh-qvx6)
- ✅ Root overrides for: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Remaining vulnerabilities (no upstream patches):**
- ⚠️ bigint-buffer (high) - no patched version available
- ⚠️ elliptic (moderate) - no patched version available

**CI Audit Policy:**
```bash
# Audit threshold lowered to critical (from high)
npm audit --audit-level=critical
```

### Database Configuration

**Supavisor Pooler Compatibility:**

When using Supabase's Supavisor connection pooler, prepared statements must be disabled to avoid `XX000` errors:

```typescript
// packages/server/src/startup/database.ts
const db = drizzle(pool, {
  schema,
  logger: false,
  casing: 'snake_case',
});

// Disable prepared statements for Supavisor pooler
pool.on('connect', (client) => {
  client.query('SET statement_timeout = 30000');
  client.query('SET idle_in_transaction_session_timeout = 60000');
});
```

**Why**: Supavisor's transaction pooling mode doesn't support prepared statements. Disabling them prevents `ERROR: prepared statement "..." does not exist (XX000)` errors.

**Commits**: 8aaaf28, f7ab9f7

### CI/CD Best Practices

**Chain Setup:**
- `setup-chain.mjs` skips when `CI=true` (anvil/mud not available in CI)
- Exclude `@hyperscape/evm-contracts` from turbo test filter
- Install Foundry toolchain for integration tests: `foundry-rs/foundry-toolchain@v1`

**Database Migrations:**
- Server handles migrations during startup by default
- Set `SKIP_MIGRATIONS=true` when using `drizzle-kit push` for schema creation
- Do NOT run `drizzle-kit push` in CI then start server (creates tables without migration journal)
- Running push separately causes server migration code to fail on re-creation attempts

**Migration 0050 Duplicate Table Fix (commit e4b6489):**
- Migration 0050 duplicated CREATE TABLE statements from earlier migrations
- Example: `agent_duel_stats` was created in migration 0039 and again in 0050
- On fresh databases, running all migrations sequentially caused `42P07` errors (relation already exists)
- **Fix**: Added `IF NOT EXISTS` to all CREATE TABLE and CREATE INDEX statements in migration 0050
- This allows migrations to run idempotently without errors on fresh database installs

**Migration FK Ordering Issues:**
- Migration 0050 references tables from older migrations (e.g., arena_rounds)
- On fresh databases, sequential migration execution can cause FK errors
- Solution: Use `drizzle-kit push` for declarative schema creation + `SKIP_MIGRATIONS=true`
- Fixed in commit eb8652a (CI integration tests)

**Package Exclusions:**
- `@hyperscape/contracts` excluded from CI test run (MUD CLI + @trpc/server compatibility issue) - commit 99dec96
- `@hyperscape/gold-betting-demo` excluded from CI (hls.js dependency resolution issue) - commit 93f9633
- `@hyperscape/evm-contracts` excluded from CI (foundry/anvil not available in CI) - commit 034f9c9
- Tests will be re-enabled when dependency conflicts are resolved

**Missing Dependencies Fixed:**
- `hls.js` added to gold-betting-demo package.json (commit cfdabf3)
  - StreamPlayer.tsx imports hls.js but it was not declared
  - Caused build failures in CI where bun resolves dependencies strictly

**Documentation Updates:**
- `update-docs.yml` has `continue-on-error: true` for Mintlify API calls
- Prevents CI failures from Mintlify service outages

**ESLint Configuration:**
- Do NOT override ajv version in root package.json
- @eslint/eslintrc requires ajv@6 for Draft-04 schema support
- Forcing ajv@8 causes `TypeError: Class extends value undefined is not a constructor or null`

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

### ESLint Crashes

**Symptom**: `TypeError: Class extends value undefined is not a constructor or null` related to ajv

**Cause**: Forcing ajv@8 on @eslint/eslintrc which requires ajv@6 for Draft-04 schema support

**Fix**: Remove any ajv version overrides from root `package.json`. Fixed in commit `b344d9e`.

### Integration Tests Fail (anvil missing)

**Symptom**: Integration tests fail with "anvil: command not found"

**Cause**: Foundry toolchain not installed in CI environment

**Fix**: Install Foundry locally or ensure CI workflow includes `foundry-rs/foundry-toolchain@v1`. Fixed in commit `b344d9e`.

```bash
# Install Foundry locally (macOS/Linux)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Duel Arena Issues

**Players/agents sinking into arena floors:**
Fixed in commits 7a60135 and 75d0aa6. Two separate issues were resolved:

1. **Terrain flat zones** (commit 7a60135): Players/agents were sinking ~0.4m into duel arena floors because flat zones were removed from the terrain system. This caused `getHeightAt()` to return raw procedural terrain height instead of floor-level height, and allowed grass to grow through floor surfaces.
   - **Fix**: DuelArenaVisualsSystem now registers flat zones programmatically for all 8 floor areas (6 arenas + lobby + hospital)
   - Terrain height queries now return correct floor-level values
   - Terrain mesh is carved under the floors to prevent grass/vegetation clipping

2. **Arena spawn heights** (commit 75d0aa6): Arena spawn heights were corrected to match visual mesh positions.

If you see players falling through the arena floor, ensure you're on the latest code.

### Streaming Mode Issues

**WebGPU crashes on RTX 5060 Ti:**
The streaming infrastructure has been updated to use GL ANGLE backend instead of Vulkan due to broken Vulkan ICD on RTX 5060 Ti GPUs. If you encounter crashes:

- Use Chrome Dev channel for WebGPU support (commit ba8bd53)
- Switch to GL ANGLE backend (commit 0257563)
- Use system FFmpeg instead of static build (commits 55a07bd, 536763d)
- Remove aggressive GPU optimization flags (commit f3aa787)

**Headless rendering issues:**
Switch to headful mode with Xvfb for GPU compositing (commit 5e4c6f1), or use swiftshader + headless + WebGL fallback (commit ae42beb).

**RTX 4090 WebGPU (commit 80bb06e):**
For RTX 4090 GPUs, switch ANGLE from GL to Vulkan backend for optimal WebGPU performance:

```bash
# In streaming infrastructure (packages/server/src/streaming/browser-capture.ts)
# Chrome launch args updated to use Vulkan ANGLE backend:
--use-angle=vulkan
--use-vulkan
--enable-features=Vulkan
```

This change improves WebGPU rendering performance on RTX 4090 GPUs by using the native Vulkan backend instead of the GL translation layer.

**Vast.ai GPU Compatibility:**
- RTX 5060 Ti removed from GPU search (broken Vulkan ICD) - commit 30cacb0
- Use system FFmpeg to avoid static build SIGSEGV - commit 30cacb0
- Use GL ANGLE backend for stability - commit 30cacb0

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
