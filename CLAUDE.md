# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

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
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
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
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**New Environment Variables**:
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

- **Runtime**: Bun v1.3.10+ (updated from v1.1.38 in commit bc3b1bc)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.182.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Railway/Neon), Docker (local)
- **Testing**: Playwright, Vitest 4.x (upgraded from 2.x in commit a916e4ee for Vite 6 compatibility)
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

## Recent Improvements

### Stability Improvements

#### Combat System
- **Combat Retry Timer**: Aligned with tick system (3000ms = 5 ticks) for consistent timing
- **Phase Timeout**: Reduced grace periods from 30s to 10s for faster failure detection
- **Combat Stall Nudge**: Tracks last nudge timestamp instead of cycle ID to allow re-nudging when combat stalls again
- **Damage Event Cache**: Cleanup every tick (was every 2 ticks), cap lowered from 5000 to 1000, evict 75% when exceeded

#### Agent System
- **LLM Rate Limiting**: Exponential backoff for API calls (5s base, max 60s)
- **Consecutive Failure Tracking**: Resets on successful tick
- **Memory Leak Fixes**: Proper cleanup of COMBAT_DAMAGE_DEALT listeners in AgentManager and event handlers in AutonomousBehaviorManager
- **Dynamic Combat Escalation**: Agents progress from goblins → bandits → barbarians as combat level grows
- **Combat Style Rotation**: Agents cycle attack → strength → defense (train lowest skill)
- **Cooking Phase**: Agents cook raw food immediately instead of waiting for full inventory
- **Gear Upgrade Phase**: Agents smith better equipment when they have materials + levels
- **Combat Food Threshold**: Increased from 5 → 10 for better survival
- **World Data Manifest Loading**: Monster tiers and gear tiers loaded from world-data
- **LLM Error Fallback**: Idle + retry when agent has active goal instead of derailing to explore
- **Short-Circuit Dashboard Sync**: All agents show activity logs even when skipping LLM
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` crash in getEquippedWeaponTier that broke ALL agents every tick
- **Quest Goal Detection**: Added quest goal status change detection for proper quest lifecycle transitions
- **Banking Goal Type**: Added 'banking' to CurrentGoal interface for agent banking behavior

#### Resource Management
- **Activity Logger Queue**: Max size 1000 with 25% eviction to prevent memory pressure
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS for zombie session cleanup
- **SessionCloseReason**: Added "timeout" to type for proper session termination tracking

#### Test Stability
- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`
- **Anchor Test Skip**: Automatically skip Anchor localnet tests in CI when Solana CLI is not installed (prevents false failures)
- **Vitest 4.x Upgrade**: Upgraded from 2.1.0 to 4.0.6 for Vite 6 compatibility (fixes __vite_ssr_exportName__ errors)

#### E2E Journey Tests
- **Complete Journey Tests**: Full login→loading→spawn→walk gameplay tests in `complete-journey.spec.ts`
- **Screenshot Comparison**: Utilities to verify game is rendering correctly
- **Loading Screen Detection**: `waitForLoadingScreenHidden` helper for reliable test synchronization
- **Real Browser Testing**: Uses Playwright with actual WebGPU rendering (no mocks)

### Performance Optimizations

#### Object Pooling for Zero-Allocation Event Emission
Hyperscape implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops. The combat system alone fires events every 600ms tick per combatant, which would cause significant memory churn without pooling.

**Event Payload Pools** (`packages/shared/src/utils/pools/`):
- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools with automatic growth and leak detection
- **PositionPool.ts**: Pool for `{x, y, z}` position objects with helper methods
- **CombatEventPools.ts**: Pre-configured pools for all combat events with optimized sizes

**Usage Pattern**:
```typescript
// In event emitter (CombatSystem, etc.)
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In event listener - MUST call release()
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

**Available Pools**: 
- damageDealt (64 initial, 32 growth)
- projectileLaunched (32 initial, 16 growth)
- faceTarget (64 initial, 32 growth)
- clearFaceTarget (64 initial, 32 growth)
- attackFailed (32 initial, 16 growth)
- followTarget (32 initial, 16 growth)
- combatStarted (32 initial, 16 growth)
- combatEnded (32 initial, 16 growth)
- projectileHit (32 initial, 16 growth)
- combatKill (16 initial, 8 growth)

**Pool Features**:
- Automatic growth when exhausted (warns every 60s)
- Leak detection (warns when payloads not released at end of tick, max 10 warnings then suppressed)
- Statistics tracking (acquire/release counts, peak usage, leak warnings)
- Global registry for monitoring all pools

**Monitoring**:
```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();

// Global registry for all pools
import { eventPayloadPoolRegistry } from '@hyperscape/shared/utils/pools';
const allStats = eventPayloadPoolRegistry.getAllStats();
```

**Performance Impact**: 
- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor
- Reduces GC pressure by 90%+ in high-frequency combat scenarios

**Creating New Pools**:
```typescript
import { createEventPayloadPool, eventPayloadPoolRegistry, type PooledPayload } from './EventPayloadPool';

interface MyEventPayload extends PooledPayload {
  entityId: string;
  value: number;
}

const myEventPool = createEventPayloadPool<MyEventPayload>({
  name: 'MyEvent',
  factory: () => ({ entityId: '', value: 0 }),
  reset: (p) => { p.entityId = ''; p.value = 0; },
  initialSize: 32,
  growthSize: 16,
  warnOnLeaks: true,
});

// Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);
```

#### Instanced Rendering
Hyperscape uses instanced rendering for resource entities (rocks, ores, herbs, trees):
- **GLBResourceInstancer**: Pools instances by model path, separate InstancedMesh per LOD level
- **GLBTreeInstancer**: Specialized instancer for tree resources with dissolve materials
- **InstancedModelVisualStrategy**: Thin wrapper with invisible collision proxies for raycasting
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis to prevent flickering
- Falls back to StandardModelVisualStrategy if instancing fails

**Depleted Models**:
- Resources can specify `depletedModelPath` and `depletedModelScale` in config
- Instancer maintains separate pools for normal and depleted states (e.g., tree → stump)
- Automatic transition on resource depletion without individual model loading
- Collision proxy persists across state transitions
- Highlight mesh support for hover/selection on instanced entities

#### Model Cache Integrity
- **Index Buffer Type Preservation**: Model cache now preserves original index buffer type (Uint16Array vs Uint32Array)
- Fixes silent geometry corruption and RangeError crashes on cached model restore
- Cache version bumped to 4 to invalidate corrupt entries
- Affects all GLB models loaded via ModelCache (resources, NPCs, items)

#### Client Performance Optimizations

**Movement System**:
- **Immediate Move Processing**: Bypasses ActionQueue for instant response to player clicks (eliminates 0-600ms latency)
- **Pathfinding Rate Limit**: Raised from 5/sec to 15/sec to match tile movement limiter
- **BFS Iterations**: Increased from 2000 to 8000 (~44 tile radius vs ~22 tile)
- **Path Continuation**: Seamless long-distance movement with automatic re-pathfinding when BFS limit reached
- **Skating Fix**: Server-side pre-computation + client-side path appending eliminates stop-lurch at segment boundaries
- **Multi-Click Feel**: Optimistic target pivoting + pending move queue ensures last click always reaches server
- **Per-Frame Allocation Elimination**: Pre-allocated buffers and squared distance comparisons in hot paths

**Minimap Rendering**:
- **Async Terrain Generation**: Chunked sampling (50×50 grid) runs off RAF callback via setTimeout(0) yields
- **Zero RAF Blocking**: Terrain generation happens in background macrotasks, not during frame rendering
- **Canvas Rotation Transform**: Decouples terrain regeneration from camera rotation (only regenerates on player move/zoom)
- **Terrain Overshoot**: √2 × 1.1 sampling ensures corners stay filled at any rotation angle
- **Layer Synchronization**: All layers (terrain, roads, buildings, pips) use same camera snapshot
- **Cached Contexts**: Canvas 2D contexts cached in refs to avoid getContext() DOM queries
- **Performance**: Reduced terrain sampling from up to 40,000 pixels to 2,500 (16× reduction)

**GPU Resource Hygiene**:
- **XPDropSystem**: Object pool for CanvasTexture/SpriteMaterial reuse, warn on pool exhaustion
- **DuelCountdownSplatSystem**: Pre-render count textures once, pool sprite/material pairs
- **HealthBars**: Add destroy() to clear hideTimeout handles and dispose InstancedMesh/texture/geometry
- **ProjectileRenderer**: Track pending setTimeout handles in Set, cancel all on destroy(), reference-counted geometry disposal
- **PlayerTokenManager**: Named beforeUnloadHandler property enables proper removeEventListener on dispose()
- **EmbeddedGameClient**: Guard async state updates with cancelled flag to prevent setState on unmounted component
- **ThreeResourceManager**: Add teardown() to stop dev monitor interval and reset WeakSet on hot-reload
- **Stale Health Bar Sweep**: Reverse iteration to remove bars for despawned entities

**World Initialization Race Condition**:
- **Two-Flag Handshake**: initComplete + needsCleanup flags prevent world.destroy() from racing world.init()
- **Deferred Cleanup**: Cleanup callback waits for init() to complete if it arrives during async initialization
- **Resource Safety**: Ensures destroy() runs exactly once and only after world is fully constructed

**Client Memory Optimizations**:
- **Machine ID Caching**: Browser fingerprint cached in _cachedMachineId (avoids canvas allocation on every token operation)
- **Activity Debouncing**: 500ms debounce on saveSession() localStorage writes (was synchronous on every interaction)
- **XP Drop Listener**: Store bound handler so destroy() can call world.off() (eliminates leak that survived world teardown)

### Memory Leak Fixes

Recent commits addressed critical memory leaks across the codebase:

- **ModelCache**: GPU memory leaks when cache is cleared (geometry disposal added)
- **EventBridge**: 50+ world event listeners never removed (destroy() method added)
- **Logger**: Cleanup interval not stored (destroy() method added)
- **PlayerTokenManager**: Heartbeat interval continues after logout (stopHeartbeat() added)
- **Connection Handler**: Error handler not cleaned up during auth cleanup
- **DuelBot**: World event handlers not cleaned up on disconnect
- **AgentManager**: COMBAT_DAMAGE_DEALT listener never removed
- **AutonomousBehaviorManager**: Event handlers not cleaned up during agent lifecycle
- **ColliderComponent**: Collision event handlers never unsubscribed
- **MobEntity**: PLAYER_SET_DEAD listener never removed
- **Socket**: WebSocket event handlers not cleaned up
- **ClientLiveKit**: Voices Map and room listeners not cleaned up
- **AggroSystem**: playerSkills, combatLevelCache, and aggro maps growing unboundedly
- **StarterChestEntity**: lootedByCharacters Set growing unboundedly (10k limit with LRU pruning added)
- **GameTickProcessor**: Event handlers not cleaned up on destroy
- **TradingSystem**: PLAYER_LEFT/LOGOUT/DIED event handlers never removed
- **RTMPBridge**: WebSocket server listeners not cleaned up on close
- **ActionQueue**: playerQueues Map never cleared (destroy() method added)
- **ScriptQueue**: PlayerScriptQueue and NPCScriptQueue not cleaned up (destroy() methods added)
- **Shutdown Process**: Rate limiters and idempotency service not destroyed on shutdown

All cleanup follows the established patterns in SystemBase for proper resource cleanup.

### Railway Database Detection

**Railway Proxy Detection** (commit a5a201c, d8c26d2):
- Detects Railway via `RAILWAY_ENVIRONMENT` env var (most reliable)
- Also detects Railway proxy (.rlwy.net), direct (.railway.app), and internal (.railway.internal) hostnames
- Add Railway proxy detection to isSupavisorPooler for pgbouncer support
- Disables prepared statements when using Railway proxy
- Uses lower connection pool limits (max: 6) for pooler connections
- Fixes "too many clients already" errors on Railway deployments

### Vast.ai Provisioner

**Automated Instance Provisioning**:
- Script: `./scripts/vast-provision.sh`
- Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr), disk space (≥120GB)
- Automatically rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Saves configuration to `/tmp/vast-instance-config.env`

**Requirements**:
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

**Usage**:
```bash
VAST_API_KEY=xxx bun run vast:provision
```

### Streaming Improvements

**WebGPU Initialization** (commit b3e096db):
- **Adapter Request Timeout**: 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- **Renderer Init Timeout**: 60s timeout on `renderer.init()` to detect GPU driver issues
- **Preflight Testing**: `testWebGpuInit()` runs on localhost server (secure context) before loading game content
- **Secure Context Fix**: Changed from about:blank to localhost:3333 for proper navigator.gpu exposure
- **GPU Diagnostics**: `captureGpuDiagnostics()` extracts chrome://gpu info for debugging
- **Adapter Info Compatibility**: Falls back to direct adapter properties when `requestAdapterInfo()` unavailable (older Chromium)
- **Page Navigation Timeout**: Increased to 120s (up from 60s) for WebGPU shader compilation on first load

**Stream Capture Improvements**:
- **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
- **WebCodecs**: Native VideoEncoder API (experimental)
- **MediaRecorder**: Legacy fallback mode
- Automatic recovery with viewport restoration on resolution mismatch
- 5s timeout on probe evaluate calls to prevent hanging
- Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)
- **Browser Restart**: Automatic browser restart every 45 minutes to prevent WebGPU OOM crashes

**Streaming Status Check** (commit 61c14bc8):
- Script: `bun run duel:status` or `bash scripts/check-streaming-status.sh`
- Quick diagnostic for verifying streaming health on Vast.ai
- Checks: server health, streaming API status, duel context, RTMP bridge, PM2 processes, recent logs

**Placeholder Frame Mode** (commit 83056565):
- Set `STREAM_PLACEHOLDER_ENABLED=true` to enable placeholder frames during idle periods
- Detects when no frames received for 5 seconds
- Switches to minimal JPEG frames at configured FPS to keep stream alive
- Automatically exits placeholder mode when live frames resume
- Prevents Twitch/YouTube 30-minute disconnect during content gaps
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size

**Graceful Restart for Duel Arena** (commit c76ca516):
- **POST /admin/graceful-restart**: Request server restart after current duel ends
- **GET /admin/restart-status**: Check if restart is pending
- **StreamingDuelScheduler.requestGracefulRestart()**: Programmatic API
- When graceful restart is requested:
  - If no duel active: restart immediately via SIGTERM
  - If duel in progress: wait until RESOLUTION phase completes
  - PM2 automatically restarts the server with new code
- Enables zero-downtime deployments for the duel arena stream

**Deployment Process Improvements** (commit 58d88f4c, 087033fa, dbd4332d):
- **Process Teardown Before Migration**: Tears down existing processes and closes DB connections before running migrations to prevent "too many clients" errors
- **Targeted Process Killing**: Use specific process names instead of blanket `pkill -f bun` to avoid killing deploy script itself
- **Graceful PM2 Shutdown**: Stop PM2 with delays between commands
- **Branch Fix**: Deploy from main branch instead of hackathon branch
- **GitHub Actions Fixes**: Fixed upload-artifact version (v7 → v4), build order (shared before impostors/procgen), heredoc variable expansion

**PostgreSQL Connection Pool** (commit 0c8dbe0f, 454d0ad2):
- **POSTGRES_POOL_MAX=3** (down from 6) to prevent connection exhaustion during crash loops
- **POSTGRES_POOL_MIN=0** to not hold idle connections during crashes
- **restart_delay=10s** (up from 5s) to allow connections to fully close before PM2 restart
- **exp_backoff_restart_delay=2s** for more gradual backoff on repeated failures
- Prevents PostgreSQL error 53300 (too many connections) during crash loop scenarios

**Model Agent Spawning** (commit fe6b5354):
- Set `SPAWN_MODEL_AGENTS=true` to enable automatic agent creation when database is empty
- Allows duels to run even with an empty database
- Useful for fresh deployments and testing

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

**Object pooling memory leaks**:
If you see pool exhaustion warnings, ensure all event listeners call `release()` after processing:
```typescript
// ❌ WRONG - causes memory leak
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  // Missing release() call!
});

// ✅ CORRECT - releases payload back to pool
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

### Vitest 4.x Upgrade

**Breaking Changes** (commit a916e4ee):
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
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
