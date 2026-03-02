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
- Safari 18+ (macOS 15+)
- Firefox (behind flag, not recommended)
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

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
bun run duel:status       # Quick diagnostic for streaming health
                          # Checks: server health, streaming API, duel context,
                          # RTMP bridge, PM2 processes, recent logs

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
├── impostor/            # Impostor system for LOD
├── vast-keeper/         # Vast.ai instance management
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **impostor** - Impostor system (required by shared)
3. **procgen** - Procedural generation (required by shared)
4. **shared** - Depends on physx-js-webidl, impostor, procgen
5. **All other packages** - Depend on shared

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
|---------|------|------------|
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

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

**Streaming environment variables** (Vast.ai deployment):
```bash
# Stream capture configuration
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable  # Explicit Chrome path
STREAM_CAPTURE_MODE=cdp                                     # cdp | webcodecs | mediarecorder
STREAM_LOW_LATENCY=false                                    # true = zerolatency tune
STREAM_GOP_SIZE=60                                          # GOP size in frames
STREAM_AUDIO_ENABLED=true                                   # Enable audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor                     # PulseAudio device

# Production client build (recommended for streaming)
NODE_ENV=production                                         # Use production build
DUEL_USE_PRODUCTION_CLIENT=true                             # Serve via vite preview

# Model agent spawning (for empty database)
SPAWN_MODEL_AGENTS=true                                     # Auto-create agents when DB is empty

# RTMP streaming keys (never hardcode)
TWITCH_STREAM_KEY=...
KICK_STREAM_KEY=...
TWITTER_STREAM_KEY=...
```

**Streaming Commands**:
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

## Package Manager

This project uses **Bun** (v1.3.10+, updated from v1.1.38) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.3.10+ (updated from v1.1.38)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.182.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Docker)
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

## Performance Optimizations

### Client Performance

#### Movement System (PR #950)
- **Immediate Move Processing**: Bypasses ActionQueue for instant response (eliminates 0-600ms latency)
- **Pathfinding Rate Limit**: Raised from 5/sec to 15/sec to match tile movement limiter
- **BFS Iterations**: Increased from 2000 to 8000 (~44 tile radius vs ~22 tile)
- **Path Continuation**: Seamless long-distance movement with automatic re-pathfinding when BFS limit reached
- **Skating Fix**: Server-side pre-computation + client-side path appending eliminates stop-lurch at segment boundaries
- **Multi-Click Feel**: Optimistic target pivoting + pending move queue ensures last click always reaches server
- **Per-Frame Allocation Elimination**: Pre-allocated buffers and squared distance comparisons in hot paths

**Technical Details**:
- `TileMovementState` adds `requestedDestination`, `lastPathPartial`, `nextSegmentPrecomputed` fields
- `_continuePathToDestination()` re-pathfinds from new tile toward original click target
- `tileMovementStart` packet adds `isContinuation` flag for client-side path appending
- `TileInterpolator.setOptimisticTarget()` immediately pivots character toward new destination
- `_sendMoveRequest()` with pending-move queue ensures last click reaches server within rate limit
- Death-state and duel-state guards prevent movement packets to dead/frozen players mid-continuation
- `syncPlayerPosition` clears `requestedDestination` + `lastPathPartial` on respawn/teleport

#### Minimap Rendering (PR #950)
- **Async Terrain Generation**: Chunked sampling (50×50 grid) runs off RAF callback via setTimeout(0) yields
- **Zero RAF Blocking**: Terrain generation happens in background macrotasks, not during frame rendering
- **Canvas Rotation Transform**: Decouples terrain regeneration from camera rotation (only regenerates on player move/zoom)
- **Terrain Overshoot**: √2 × 1.1 sampling ensures corners stay filled at any rotation angle
- **Layer Synchronization**: All layers (terrain, roads, buildings, pips) use same camera snapshot
- **Cached Contexts**: Canvas 2D contexts cached in refs to avoid getContext() DOM queries
- **Performance**: Reduced terrain sampling from up to 40,000 pixels to 2,500 (16× reduction)

**Technical Details**:
- `generateTerrainChunked()` async function yields every 10 rows (5 yield points per generation)
- `terrainGenVersionRef` monotonically-incrementing token cancels in-flight generation on camera change
- RAF callbacks only call `drawImage()` (sub-ms GPU blit), no terrain sampling
- Rotation handled by canvas transform: `ctx.rotate(+deltaYaw)` around canvas center
- `TERRAIN_OVERSHOOT` (√2 × 1.1 ≈ 1.555×) ensures canvas corners stay filled at any rotation
- `terrainCacheUpRef` stores camera up vector when terrain cache is generated
- All `worldToPx` calls for roads/buildings use snapshot values instead of live camera state
- Rotation threshold raised from 0.01 to 0.087 (~5°) to prevent regeneration on every tiny angular change
- `terrainIsGeneratingRef` mutex prevents overlapping async generations

#### GPU Resource Hygiene (PR #950)
- **XPDropSystem**: Object pool for CanvasTexture/SpriteMaterial reuse, warn on pool exhaustion
- **DuelCountdownSplatSystem**: Pre-render count textures once, pool sprite/material pairs
- **HealthBars**: Add destroy() to clear hideTimeout handles and dispose InstancedMesh/texture/geometry
- **ProjectileRenderer**: Track pending setTimeout handles in Set, cancel all on destroy(), reference-counted geometry disposal
- **PlayerTokenManager**: Named beforeUnloadHandler property enables proper removeEventListener on dispose()
- **EmbeddedGameClient**: Guard async state updates with cancelled flag to prevent setState on unmounted component
- **ThreeResourceManager**: Add teardown() to stop dev monitor interval and reset WeakSet on hot-reload
- **GameClient**: Call ThreeResourceManager.teardown() in useEffect cleanup after world.destroy()
- **Stale Health Bar Sweep**: Reverse iteration to remove bars for despawned entities

#### World Initialization Race Condition (PR #950)
- **Two-Flag Handshake**: `initComplete` + `needsCleanup` flags prevent world.destroy() from racing world.init()
- **Deferred Cleanup**: Cleanup callback waits for init() to complete if it arrives during async initialization
- **Resource Safety**: Ensures destroy() runs exactly once and only after world is fully constructed
- **Partial Init Cleanup**: `initComplete = true` even on init() failure to allow cleanup of partial resources

#### Client Memory Optimizations (PR #950)
- **Machine ID Caching**: Browser fingerprint cached in `_cachedMachineId` (avoids canvas allocation on every token operation)
- **Activity Debouncing**: 500ms debounce on saveSession() localStorage writes (was synchronous on every interaction)
- **XP Drop Listener**: Store bound handler so destroy() can call world.off() (eliminates leak that survived world teardown)
- **PlayerTokenManager Disposal**: Call dispose() in index.tsx cleanup so beforeunload listener is actually removed

### Server Performance

#### Combat System
- **Combat Retry Timer**: Aligned with tick system (3000ms = 5 ticks)
- **Phase Timeout**: Reduced from 30s to 10s for faster failure detection
- **Combat Stall Nudge**: Tracks last nudge timestamp for re-nudging
- **Damage Event Cache**: Cleanup every tick, cap lowered to 1000, evict 75%

#### Agent System
- **LLM Rate Limiting**: Exponential backoff (5s base, max 60s)
- **Consecutive Failure Tracking**: Resets on successful tick
- **Dynamic Combat Escalation**: Agents progress goblins → bandits → barbarians
- **Combat Style Rotation**: Agents cycle attack → strength → defense
- **Cooking Phase**: Agents cook raw food immediately
- **Gear Upgrade Phase**: Agents smith better equipment
- **Combat Food Threshold**: Increased from 5 → 10
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` crash in getEquippedWeaponTier
- **Quest Goal Detection**: Added quest goal status change detection

#### Resource Management
- **Activity Logger Queue**: Max size 1000 with 25% eviction
- **Session Timeout**: 30-minute max via MAX_SESSION_TICKS
- **SessionCloseReason**: Added "timeout" type

## Memory Management

### Critical Memory Leak Fixes

Recent commits addressed critical memory leaks across the codebase. All cleanup follows the established patterns in SystemBase for proper resource cleanup.

**Key Fixes**:
- **ModelCache** (CRITICAL): Add geometry disposal on clear() and remove()
- **EventBridge** (HIGH): Add destroy() method to clean up 50+ world event listeners
- **Logger** (MEDIUM): Store cleanup interval, add destroy() method
- **PlayerTokenManager** (MEDIUM): Add stopHeartbeat() method
- **Connection Handler** (MEDIUM): Track and cleanup error handler
- **DuelBot** (MEDIUM): Track world.on() handlers and clean up on disconnect
- **AgentManager** (HIGH): Store and cleanup COMBAT_DAMAGE_DEALT listener
- **AutonomousBehaviorManager** (HIGH): Store and cleanup event handlers
- **ColliderComponent** (MEDIUM): Track collision event handlers and unsubscribe
- **MobEntity** (MEDIUM): Track PLAYER_SET_DEAD listener and remove on destroy
- **Socket** (MEDIUM): Track WebSocket event handlers and clean up
- **ClientLiveKit** (MEDIUM): Clean up voices Map and room listeners
- **AggroSystem** (MEDIUM): Clean up playerSkills, combatLevelCache, and aggro maps
- **StarterChestEntity** (MEDIUM): Add size limit (10k) with LRU pruning
- **GameTickProcessor** (HIGH): Store bound event handlers, cleanup in destroy()
- **TradingSystem** (HIGH): Store bound handlers for player lifecycle events
- **RTMPBridge** (HIGH): Call removeAllListeners() before closing WebSocket servers
- **ActionQueue** (MEDIUM): Add destroy() method to clear playerQueues
- **ScriptQueue** (MEDIUM): Add destroy() methods to both queue classes
- **Shutdown Process** (HIGH): Call destroyAllRateLimiters() and destroyIdempotencyService()

### Object Pooling for Zero-Allocation Event Emission

Hyperscape implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops.

**Event Payload Pools** (`packages/shared/src/utils/pools/`):
- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools
- **PositionPool.ts**: Pool for `{x, y, z}` position objects
- **CombatEventPools.ts**: Pre-configured pools for all combat events

**Usage Pattern**:
```typescript
// Acquire from pool
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// MUST release in listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process...
  CombatEventPools.damageDealt.release(payload);
});
```

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

**Performance Impact**:
- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor

See [AGENTS.md](AGENTS.md) for complete object pooling documentation.

### Memory Management Best Practices

When creating new systems or managers:

1. **Track All Resources**: Store references to intervals, listeners, handlers
2. **Implement Cleanup**: Add `destroy()`, `shutdown()`, or `stop()` methods
3. **Follow SystemBase Pattern**: Use the same cleanup patterns as SystemBase
4. **Clean Up on Hot Reload**: Ensure resources are released during development
5. **Test for Leaks**: Monitor memory usage during long-running sessions
6. **Use Object Pools**: For high-frequency allocations (events, positions, quaternions)

Example cleanup pattern:
```typescript
class MySystem {
  private listeners: Array<() => void> = [];
  private intervals: NodeJS.Timeout[] = [];

  init() {
    const listener = world.on('event', this.handleEvent);
    this.listeners.push(listener);
    
    const interval = setInterval(this.tick, 1000);
    this.intervals.push(interval);
  }

  destroy() {
    // Clean up listeners
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    
    // Clear intervals
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }
}
```

## Testing

### E2E Journey Tests (PR #950)

Complete journey tests verify full gameplay flow:
- **complete-journey.spec.ts**: Full login→loading→spawn→walk gameplay tests
- **Screenshot Comparison**: Utilities to verify game is rendering correctly
- **Loading Screen Detection**: `waitForLoadingScreenHidden` helper for reliable test synchronization
- **Real Browser Testing**: Uses Playwright with actual WebGPU rendering (no mocks)
- **Visual Testing**: Screenshot comparison to verify game is rendering correctly

### Test Stability

- **GoldClob Fuzz Tests**: 120s timeout for randomized invariant tests (4 seeds × 140 operations)
- **Precision Fixes**: Use larger amounts (10000n) to avoid gas cost precision issues
- **Dynamic Import Timeout**: 60s timeout for EmbeddedHyperscapeService beforeEach hooks
- **Anchor Test Configuration**: Use localnet instead of devnet for free SOL in `anchor test`
- **Quest Actions Tests**: Updated to match current implementation (acceptQuestAction requires not_started quest state)
- **SlidingWindowRateLimiter Test**: Updated to expect 15/sec for pathfind (was 5/sec)
- **TradingSystem Test**: Guard world.off calls for test environments where mock world doesn't have off() method
- **ScriptQueue Test**: Use `handlers.clear()` not `this.handler = null` in PlayerScriptQueue.destroy()
- **Mob Tile Movement Test**: Add missing TileMovementState properties (requestedDestination, lastPathPartial, nextSegmentPrecomputed)

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

### WebGPU Issues

**Local Development**:
- Ensure browser supports WebGPU (Chrome 113+, Safari 18+)
- Check [webgpureport.org](https://webgpureport.org) for GPU status
- Disable browser extensions that might interfere

**Vast.ai Deployment**:
- Ensure instance has `gpu_display_active=true`
- Check deployment logs for WebGPU initialization errors
- Verify NVIDIA display driver is loaded (`nvidia-smi`)
- Check Vulkan ICD is available (`ls /usr/share/vulkan/icd.d/`)
- Review chrome://gpu diagnostics in deployment logs

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
