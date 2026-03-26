# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with biome-based terrain generation, AI agents powered by ElizaOS, and live streaming capabilities.

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
- Safari 18+ (macOS 15+)
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run headful** with Xorg or Xvfb (NOT headless Chrome)
- **Chrome Beta Channel**: Use `google-chrome-beta` (Chrome Beta) for WebGPU streaming on Linux NVIDIA (best stability and WebGPU support as of March 13, 2026)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
- If WebGPU cannot initialize, deployment MUST FAIL

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
│   ├── Biome terrain generation with quadtree LOD
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence (connection pool: 20)
│   ├── LiveKit voice chat integration
│   ├── Maintenance mode system
│   ├── Admin live controls dashboard
│   └── Duel oracle publishing (EVM + Solana)
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   ├── UI/HUD
│   └── Maintenance banner
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (terrain, trees, rocks, plants)
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── duel-oracle-evm/     # EVM duel outcome oracle contracts
├── duel-oracle-solana/  # Solana duel outcome oracle program
└── contracts/           # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

> **RESOLVED (March 2026): CIRCULAR DEPENDENCY - shared ↔ procgen**
>
> The circular dependency between `@hyperscape/shared` and `@hyperscape/procgen` has been resolved.
> - **Fix**: `TileCoord` interface is now defined locally in `packages/procgen/src/building/viewer/index.ts`
> - **Impact**: Procgen can now build without TypeScript errors
> - **Future**: Consider extracting shared types to `@hyperscape/types` package for cleaner boundaries

> **UPDATED (March 2026): PROCGEN TYPESCRIPT PATH MAPPING**
>
> Procgen now has TypeScript path mapping for `@hyperscape/shared` to support type imports during development.
> - **Added**: `tsconfig.json` now includes `baseUrl` and `paths` mapping
> - **Mapping**: `"@hyperscape/shared": ["../shared/build/framework.d.ts"]`
> - **Impact**: Procgen can import types from shared during development
> - **Note**: This maps to a single `.d.ts` file - if shared's build output changes, update the path

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

## Major Architectural Changes (March 2026)

### Server Runtime Migration (March 19-20, 2026)

**Change** (PR #1064): Migrated server runtime from Bun to Node.js to eliminate stop-the-world GC pauses.

**Problem**: Bun's JavaScriptCore (JSC) engine uses stop-the-world garbage collection for old-generation objects, causing 500-1200ms GC pauses that destroyed the 600ms game tick. With 25+ AI agents and complex pathfinding, the server would miss multiple ticks in a row, causing rubber-banding and combat desync.

**Solution**: Switch to Node.js runtime which uses V8's incremental/concurrent GC that keeps pauses <10ms.

**Implementation**:
```bash
# Old (Bun runtime)
bun --preload ./src/shared/polyfills.ts ./dist/index.js

# New (Node.js runtime with ESM hooks)
node --import ./scripts/register-hooks.mjs dist/index.js
```

**ESM Resolution Hooks** (`packages/server/scripts/node-esm-hooks.mjs`):
Node.js requires explicit `.js` extensions for ESM imports, but Bun workspace packages use extensionless imports. The hooks automatically resolve:
- Extensionless imports: `from "./Foo"` → `from "./Foo.js"`
- Directory imports: `from "./bar"` → `from "./bar/index.js"`

**Files Changed**:
- `packages/server/package.json` - Changed `start` script to use `node` instead of `bun`
- `packages/server/scripts/dev.mjs` - Dev server now spawns Node.js process
- `packages/server/scripts/node-esm-hooks.mjs` - NEW: ESM resolution hooks for Bun workspace packages
- `packages/server/scripts/register-hooks.mjs` - NEW: Hook registration entry point

**Impact**: 
- Tick reliability improved from 500-1200ms blocking → <10ms GC pauses
- Eliminated missed ticks and rubber-banding under load
- Server can handle 25+ AI agents without event loop starvation
- **Breaking**: Server now requires Node.js 22+ (Bun no longer supported for server runtime)

### uWebSockets.js Integration (March 20, 2026)

**Change** (PR #1064): Replaced Fastify WebSocket with uWebSockets.js for game traffic, using native pub/sub for broadcast fan-out.

**Problem**: Fastify WebSocket broadcast (`sendToAll`, `sendToNearby`) iterated all sockets in JavaScript, which became a bottleneck with 50+ concurrent connections. Each broadcast required O(n) iteration in the JS event loop.

**Solution**: Use uWebSockets.js with native pub/sub topics. The C++ kernel handles per-subscriber delivery, eliminating the JS iteration loop.

**Architecture**:
- **Dual Ports**: 
  - Port 5555 (Fastify): HTTP API, health checks, admin endpoints
  - Port 5556 (uWebSockets.js): Game WebSocket traffic (real-time multiplayer)
- **Pub/Sub Topics**:
  - `global` - All connected players
  - `region:<key>` - Players in specific spatial region (9 regions per player for nearby broadcasts)
  - `spectator` - Spectator/streaming clients
- **Subscription Lifecycle**:
  - Global topic on connection open
  - Region topics on player join (9 adjacent regions)
  - Region diff on player movement (subscribe new, unsubscribe old)
  - Spectator topic for streaming clients

**Implementation** (`packages/server/src/startup/uws-server.ts`):
```typescript
import uWS from "uWebSockets.js";

const app = uWS.App({
  maxPayloadLength: 512 * 1024,
  idleTimeout: 120,
  maxBackpressure: 1024 * 1024,
});

app.ws("/ws", {
  upgrade: (res, req, context) => {
    // Parse query params, validate token
    res.upgrade({ /* user data */ }, ...);
  },
  open: (ws) => {
    ws.subscribe("global");
    // ... handle connection
  },
  message: (ws, message, isBinary) => {
    // Dispatch to game handlers
  },
  close: (ws, code, message) => {
    // Cleanup subscriptions
  },
});
```

**Adapter Pattern** (`packages/server/src/startup/UwsWebSocketAdapter.ts`):
Bridges uWS callback API to `NodeWebSocket` interface used by existing game code:
```typescript\nexport class UwsWebSocketAdapter implements NodeWebSocket {\n  subscribe(topic: string): void {\n    this.ws.subscribe(topic);\n  }\n  \n  publish(topic: string, message: string | ArrayBuffer): void {\n    this.ws.publish(topic, message);\n  }\n  \n  // ... implements full NodeWebSocket interface\n}\n```

**Broadcast Manager** (`packages/server/src/systems/ServerNetwork/broadcast.ts`):
Dual-path broadcasting with pub/sub fast path and legacy fallback:
```typescript\nsendToAll(packet: string, data: unknown): number {\n  if (this.uwsApp) {\n    // Fast path: native pub/sub\n    this.uwsApp.publish(\"global\", buffer);\n    return this.sockets.size; // Estimate\n  }\n  // Fallback: JS iteration\n  for (const socket of this.sockets.values()) {\n    socket.send(buffer);\n  }\n  return sentCount;\n}\n```

**Configuration**:
```bash\n# Enable/disable uWS (default: enabled)\nUWS_ENABLED=true\n\n# uWS port (default: 5556)\nUWS_PORT=5556\n\n# Client connection URL\nPUBLIC_WS_URL=ws://localhost:5556/ws  # uWS (default)\n# or\nPUBLIC_WS_URL=ws://localhost:5555/ws  # Fastify fallback (UWS_ENABLED=false)\n```

**Files Changed**:
- `packages/server/src/startup/uws-server.ts` - NEW: uWS server implementation
- `packages/server/src/startup/UwsWebSocketAdapter.ts` - NEW: Adapter bridging uWS to NodeWebSocket
- `packages/server/src/systems/ServerNetwork/broadcast.ts` - Added pub/sub fast path
- `packages/server/src/systems/ServerNetwork/SpatialIndex.ts` - Added region topic cache and subscription diffing
- `packages/server/src/main.ts` - Start uWS server alongside Fastify
- `packages/server/package.json` - Added `uWebSockets.js` dependency
- `packages/client/vite.config.ts` - Updated default WS URL to use port 5556

**Impact**: 
- Eliminates O(n) socket iteration bottleneck for broadcasts
- Native C++ pub/sub handles per-subscriber delivery
- Supports 50+ concurrent connections without event loop blocking
- Full fallback via `UWS_ENABLED=false` (zero behavioral change)
- F5 DevStats panel shows pub/sub publish count

### Agent AI Worker Thread Architecture (March 20, 2026)

**Change** (PR #1064): Moved agent behavior decision-making to a worker thread to prevent blocking the game tick loop.

**Problem**: With 25+ AI agents, each running autonomous behavior ticks (pathfinding, inventory management, quest logic, combat decisions) on the main thread, the event loop was blocked for 200-600ms per tick. This prevented the 600ms game tick from firing on time, causing missed ticks and gameplay lag.

**Solution**: Extract pure decision logic into a worker thread. Main thread collects game state snapshots, sends to worker for decisions, receives action commands back, and executes them.

**Architecture**:
- **AgentBehaviorBridge** (main thread): Coordinates worker communication, collects snapshots, applies results
- **AgentBehaviorEngine** (worker thread): Pure decision functions (no World access, no side effects)
- **Shared Entity Snapshot**: Scanned once per second across ALL agents instead of per-agent scans
- **Batch Processing**: Up to 5 agents processed per poll cycle (1000ms interval)
- **Staggered Scheduling**: 800ms offset between agent start times to prevent simultaneous ticks

**Implementation** (`packages/server/src/eliza/managers/AgentBehaviorBridge.ts`):
```typescript\nexport class AgentBehaviorBridge {\n  private worker: Worker | null = null;\n  private schedules = new Map<string, AgentSchedule>();\n  \n  async start(): Promise<void> {\n    // Spawn worker thread\n    this.worker = new Worker(\"./agentBehaviorWorker.js\");\n    \n    // Poll for due agents every 1000ms\n    this.pollInterval = setInterval(() => {\n      void this.pollAndDispatch();\n    }, 1000);\n  }\n  \n  private async pollAndDispatch(): Promise<void> {\n    // Collect snapshots for due agents (max 5 per poll)\n    const dueAgents: AgentTickInput[] = [];\n    \n    // Send to worker and wait for decisions\n    const results = await this.sendTickAndWait(dueAgents, sharedData);\n    \n    // Apply results on main thread (execute actions)\n    for (const result of results) {\n      await this.applyTickResult(result);\n      await yieldToEventLoop(); // Don't block tick loop\n    }\n  }\n}\n```

**Worker Thread** (`packages/server/src/eliza/worker/AgentBehaviorEngine.ts`):
```typescript\n// Pure decision logic - no World access, serializable I/O only\nexport function processAgentTicks(agents: AgentTickInput[]): AgentTickOutput[] {\n  const results: AgentTickOutput[] = [];\n  for (const input of agents) {\n    results.push(processOneAgent(input));\n  }\n  return results;\n}\n```

**Shared Entity Snapshot** (`packages/server/src/eliza/EmbeddedHyperscapeService.ts`):
```typescript\n// Scan all entities once per second, share across all agent instances\nconst snapshot = getSharedEntitySnapshot(world, getPos);\n// Reduces O(agents × entities) to O(entities) per second\n```

**Configuration**:
```bash\n# Agent behavior tick interval (default: 8000ms)\nEMBEDDED_BEHAVIOR_TICK_INTERVAL=8000\n\n# Agent stagger offset (default: 800ms)\nAGENT_STAGGER_OFFSET_MS=800\n\n# Max agents per poll cycle (default: 5)\nMAX_AGENTS_PER_POLL=5\n```

**Files Changed**:
- `packages/server/src/eliza/managers/AgentBehaviorBridge.ts` - NEW: Main thread coordinator
- `packages/server/src/eliza/worker/AgentBehaviorEngine.ts` - NEW: Pure decision logic
- `packages/server/src/eliza/worker/agentBehaviorWorker.ts` - NEW: Worker thread entry point
- `packages/server/src/eliza/worker/workerTypes.ts` - NEW: Serializable message protocol
- `packages/server/src/eliza/AgentManager.ts` - Replaced `AgentBehaviorTicker` with `AgentBehaviorBridge`
- `packages/server/src/eliza/EmbeddedHyperscapeService.ts` - Added shared entity snapshot cache
- `packages/server/scripts/build-server.mjs` - Build worker as separate bundle
- `packages/server/scripts/dev.mjs` - Build worker in dev mode

**Impact**: 
- Agent AI no longer blocks the game tick loop
- Tick blocking reduced from 200-600ms → <10ms
- Supports 25+ AI agents without event loop starvation
- Shared snapshot reduces entity scanning from O(agents × entities) to O(entities)
- Worker crash recovery with automatic restart

### BFS Pathfinding Optimization (March 20, 2026)

**Change** (PR #1064): Optimized BFS pathfinding with global iteration budget, scratch tile reuse, and per-tick walkability caching.

**Problem**: 25+ agents each triggering full 4000-iteration BFS calls per tick with expensive per-iteration walkability checks (9 `getHeightAt` calls for slope calculation alone) monopolized the event loop.

**Solutions**:

#### 1. Global BFS Iteration Budget
Shared budget across ALL pathfinding callers (combat follow, gathering, path continuation, player clicks):
```typescript\n// packages/shared/src/systems/shared/movement/BFSPathfinder.ts\nconst MAX_BFS_ITERATIONS_PER_TICK = 12000; // Shared across all callers\nlet _globalIterationsUsedThisTick = 0;\nlet _lastBudgetResetTick = -1;\n\nfindPath(from, to, maxIterations = 4000): TileCoord[] | null {\n  // Reset budget at start of new tick\n  if (currentTick !== _lastBudgetResetTick) {\n    _globalIterationsUsedThisTick = 0;\n    _lastBudgetResetTick = currentTick;\n  }\n  \n  // Check remaining budget\n  const remainingBudget = MAX_BFS_ITERATIONS_PER_TICK - _globalIterationsUsedThisTick;\n  if (remainingBudget <= 0) return null; // Budget exhausted\n  \n  const effectiveMax = Math.min(maxIterations, remainingBudget);\n  // ... BFS with effectiveMax iterations\n}\n```\n\n#### 2. Zero-Allocation Scratch Tiles\nReuse instance fields instead of allocating new objects per iteration:\n```typescript\nprivate _scratchNeighbor = { x: 0, z: 0 };\nprivate _scratchCardinalX = { x: 0, z: 0 };\nprivate _scratchCardinalZ = { x: 0, z: 0 };\n\n// Old (allocates 8 objects per iteration)\nconst neighbors = [\n  { x: current.x + 1, z: current.z },\n  { x: current.x - 1, z: current.z },\n  // ... 6 more\n];\n\n// New (zero allocations)\nthis._scratchNeighbor.x = current.x + 1;\nthis._scratchNeighbor.z = current.z;\nif (canMoveTo(current, this._scratchNeighbor)) {\n  // ... process neighbor\n}\n```\n\n#### 3. Per-Tick Walkability Cache
Cache terrain/slope/biome results by tile key within a tick:\n```typescript\n// packages/server/src/systems/ServerNetwork/mob-tile-movement.ts\nprivate _walkabilityCache = new Map<number, boolean>();\nprivate _directionalBlockCache = new Map<number, boolean>();\nprivate _lastCacheClearTick = -1;\n\nisTileWalkable(tile: TileCoord): boolean {\n  const currentTick = this.world.currentTick ?? 0;\n  \n  // Clear cache at start of new tick\n  if (currentTick !== this._lastCacheClearTick) {\n    this._walkabilityCache.clear();\n    this._directionalBlockCache.clear();\n    this._lastCacheClearTick = currentTick;\n  }\n  \n  const key = tileKeyNumeric(tile);\n  const cached = this._walkabilityCache.get(key);\n  if (cached !== undefined) return cached;\n  \n  // Expensive check (terrain queries, slope calculation)\n  const walkable = /* ... */;\n  this._walkabilityCache.set(key, walkable);\n  return walkable;\n}\n```\n\n**Impact**: 25 agents checking same tiles → first check expensive, remaining 24 are O(1).\n\n#### 4. Iteration Tracking API\n```typescript\nconst pathfinder = new BFSPathfinder(/* ... */);\nconst path = pathfinder.findPath(from, to);\nconst iterationsUsed = pathfinder.getLastIterationsUsed();\n// Use for diagnostics, budget monitoring\n```\n\n**Configuration**:
```typescript\n// Global budget (shared across all callers)\nconst MAX_BFS_ITERATIONS_PER_TICK = 12000;\n\n// Per-call limit (default: 4000, reduced from 8000)\nconst DEFAULT_MAX_ITERATIONS = 4000;\n```

**Files Changed**:
- `packages/shared/src/systems/shared/movement/BFSPathfinder.ts` - Added budget system, scratch tiles, iteration tracking
- `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts` - Added walkability cache
- `packages/shared/src/systems/shared/world/TerrainSystem.ts` - Optimized slope calculation

**Impact**: 
- BFS pathfinding cost reduced by ~70% (from 200-600ms → 100-190ms per tick)
- Short paths are cheap, long paths cost proportionally
- 25 agents can pathfind simultaneously without blocking the tick
- Path continuation handles budget exhaustion gracefully

### Terrain Walkability Baking (March 20, 2026)

**Change** (PR #1064): Pre-compute WATER and STEEP_SLOPE collision flags into the CollisionMatrix at terrain generation time.

**Problem**: BFS pathfinding was calling `getHeightAt()` 9 times per tile to calculate slope, plus biome checks for water. With 25 agents pathfinding simultaneously, this was the primary CPU bottleneck.

**Solution**: Bake walkability flags into the collision matrix during terrain generation. Each walkability check drops from ~10 `getHeightAt()` calls to a single `Int32Array` bitwise AND.

**Implementation** (`packages/shared/src/systems/shared/world/TerrainSystem.ts`):
```typescript\n// Deferred walkability baking (spreads 10,000-iteration bakeWalkabilityFlags\n// across ticks with 4ms budget, row-by-row resumable progress)\nprivate processWalkabilityQueue(): void {\n  const budget = 4; // ms\n  const t0 = performance.now();\n  \n  while (this.pendingWalkabilityTiles.length > 0) {\n    const entry = this.pendingWalkabilityTiles[0];\n    \n    // Process one row at a time\n    for (let localZ = entry.lastProcessedRow; localZ < TILE_SIZE; localZ++) {\n      for (let localX = 0; localX < TILE_SIZE; localX++) {\n        const worldX = entry.tileX * TILE_SIZE + localX;\n        const worldZ = entry.tileZ * TILE_SIZE + localZ;\n        \n        // Check water\n        const biome = this.getBiomeAt(worldX, worldZ);\n        if (biome?.name === \"water\") {\n          this.collisionMatrix.setFlag(worldX, worldZ, CollisionFlags.WATER);\n        }\n        \n        // Check slope\n        const slope = this.calculateSlope(worldX, worldZ);\n        if (slope > MAX_WALKABLE_SLOPE) {\n          this.collisionMatrix.setFlag(worldX, worldZ, CollisionFlags.STEEP_SLOPE);\n        }\n      }\n      \n      entry.lastProcessedRow = localZ + 1;\n      \n      // Check budget\n      if (performance.now() - t0 > budget) {\n        return; // Resume next tick\n      }\n    }\n    \n    // Tile complete\n    this.pendingWalkabilityTiles.shift();\n  }\n}\n```\n\n**Collision Matrix Integration** (`packages/shared/src/systems/shared/movement/CollisionMatrix.ts`):
```typescript\nexport enum CollisionFlags {\n  OCCUPIED = 1 << 0,      // Entity occupying tile\n  BUILDING = 1 << 1,      // Building collision\n  WATER = 1 << 2,         // Water tile (unbaked)\n  STEEP_SLOPE = 1 << 3,   // Slope too steep (unbaked)\n}\n\n// Fast walkability check (single bitwise AND)\nisWalkable(x: number, z: number): boolean {\n  const flags = this.getFlags(x, z);\n  return (flags & (CollisionFlags.WATER | CollisionFlags.STEEP_SLOPE)) === 0;\n}\n```

**Cancellation on Tile Unload**:
```typescript\nunloadTile(tileX: number, tileZ: number): void {\n  // Cancel pending/in-progress walkability work\n  this.pendingWalkabilityTiles = this.pendingWalkabilityTiles.filter(\n    (entry) => entry.tileX !== tileX || entry.tileZ !== tileZ\n  );\n}\n```

**Files Changed**:
- `packages/shared/src/systems/shared/world/TerrainSystem.ts` - Added deferred walkability baking
- `packages/shared/src/systems/shared/movement/CollisionMatrix.ts` - Added WATER and STEEP_SLOPE flags
- `packages/shared/src/systems/shared/movement/BFSPathfinder.ts` - Use baked flags instead of runtime queries

**Impact**: 
- Walkability checks drop from ~10 `getHeightAt()` calls to 1 bitwise AND
- Terrain generation spreads across ticks (4ms budget) instead of blocking synchronously
- Cancels pending work on tile unload (no wasted CPU)
- BFS pathfinding cost reduced by ~80%

### Terrain System Server Optimization (March 20, 2026)

**Change** (PR #1064): Reduced terrain generation cost on server with low-res collision mesh and time-budgeted processing.

**Optimizations**:

#### 1. Low-Resolution Collision Mesh
```typescript\n// Old: 64×64 vertices = 8192 triangles per tile\nconst COLLISION_RESOLUTION = 64;\n\n// New: 16×16 vertices = 512 triangles per tile (~16x faster PhysX cooking)\nconst COLLISION_RESOLUTION = 16;\n```\n\n#### 2. Time-Budgeted Collision Queue
Process multiple tiles per tick within 8ms budget instead of exactly 1 per tick:
```typescript\nprivate processCollisionQueue(): void {\n  const budget = 8; // ms\n  const t0 = performance.now();\n  \n  while (this.pendingCollisionTiles.length > 0) {\n    const tile = this.pendingCollisionTiles.shift()!;\n    this.buildServerCollisionGeometry(tile.tileX, tile.tileZ);\n    \n    if (performance.now() - t0 > budget) break;\n  }\n}\n```\n\n#### 3. Server-Only Lightweight Tiles
Skip client-only data on server:\n```typescript\nif (this.runtimeIsServer) {\n  // Skip: colors, biomeIds, roadInfluences, forestWeights, canyonWeights\n  // Keep: heights (for pathfinding), collision geometry\n  return {\n    heights: new Float32Array(TILE_SIZE * TILE_SIZE),\n    // ~80% memory reduction per tile\n  };\n}\n```\n\n**Files Changed**:
- `packages/shared/src/systems/shared/world/TerrainSystem.ts` - Low-res collision, time-budgeted queue, lightweight tiles

**Impact**: 
- PhysX triangle mesh cooking ~16x faster per tile
- Collision queue processes multiple tiles per tick (8ms budget)
- Server terrain memory reduced by ~80% per tile
- Deferred walkability baking spreads 10,000-iteration work across ticks

### ElizaOS API Migration (March 20, 2026)

**Change** (Commit 12e8d78): Updated ElizaOS adapter API for current alpha release.

**API Changes**:
```typescript\n// Old API (no longer exists)\nadapter.log(params);           // ❌ Removed\nadapter.deleteMemory(memoryId); // ❌ Removed\n\n// New API (current ElizaOS alpha)\nadapter.createLogs([params]);  // ✅ Takes array\nadapter.deleteMemories([id]);  // ✅ Cleans memoriesByRoom natively\n```\n\n**Implementation**:
```typescript\n// packages/server/src/eliza/ElizaDuelBot.ts\nconst origCreateLogs = adapter.createLogs.bind(adapter);\nadapter.createLogs = async (params) => {\n  await origCreateLogs(params);\n  const logs = adapter.logs;\n  if (logs && logs.length > MAX_LOGS) {\n    logs.splice(0, logs.length - MAX_LOGS); // Cap at 20 logs\n  }\n};\n\n// deleteMemory monkey-patch removed - deleteMemories now cleans memoriesByRoom\n```\n\n**Files Changed**:
- `packages/server/src/eliza/ElizaDuelBot.ts` - Updated to `createLogs`, removed `deleteMemory` patch
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Updated to `createLogs`, removed `deleteMemory` patch

**Impact**: 
- Compatible with current ElizaOS alpha releases
- Eliminates \"Cannot read properties of undefined (reading 'bind')\" errors
- All 10 AI agents now spawn correctly
- Memory leak from `memoriesByRoom` fixed natively in ElizaOS

### Model Agent Spawning Fix (March 20, 2026)

**Change** (Commit 90e8d9a): Fixed model agent spawning being blocked by stale database agents.

**Problem**: `loadAgentsFromDatabase()` finds `isAgent=1` records from previous runs, setting `embeddedAgentCount > 0` which silently skipped `spawnModelAgents()`. Model agents manage their own deduplication via the `runningAgents` Map, so this gate was unnecessary and caused 0/10 agents to spawn.

**Fix**: Removed the `embeddedAgentCount > 0` gate:
```typescript\n// Old (blocked model agents if DB had stale agent records)\nconst shouldSpawnAgents = spawnRequested && \n  (embeddedAgentCount === 0 || allowSpawnWithEmbeddedAgents);\n\n// New (model agents always spawn if requested)\nconst shouldSpawnAgents = spawnRequested;\n```\n\n**Files Changed**:
- `packages/server/src/eliza/index.ts` - Removed `embeddedAgentCount` gate

**Impact**: 
- Model agents (GPT-4o, Claude, Llama) now spawn correctly
- No longer blocked by stale database records
- Deduplication handled by `runningAgents` Map as intended

### Equipment Slot Type Safety Fix (March 2026)

**Change** (PR #1064): Fixed equipment slot extraction to handle both string and object formats.

**Problem**: Equipment slots (`weapon`, `helmet`, `body`, etc.) can be either strings (item ID) or objects (`{ itemId, name, ... }`). Agent behavior code was assuming string format, causing crashes when slots contained objects.

**Fix**: Added type-safe extraction helper:
```typescript
// packages/server/src/eliza/managers/autonomous-behavior-manager.ts
const extractSlotName = (slot: unknown): string => {
  if (!slot) return "";
  if (typeof slot === "string") return slot;
  return String(
    (slot as Record<string, unknown>).itemId ||
    (slot as Record<string, unknown>).name ||
    ""
  );
};

// Usage for weapon slot
const weaponSlot = player.equipment?.weapon;
const weapon = weaponSlot
  ? typeof weaponSlot === "string"
    ? weaponSlot
    : String(
        (weaponSlot as Record<string, unknown>).itemId ||
        (weaponSlot as Record<string, unknown>).name ||
        "fists"
      )
  : "fists";

// Usage for armor slots
const armor = [eq?.helmet, eq?.body, eq?.legs, eq?.shield]
  .map(extractSlotName)
  .filter(Boolean)
  .join(", ") || "none";
```

**Files Changed**:
- `packages/server/src/eliza/managers/autonomous-behavior-manager.ts` - Added `extractSlotName` helper, fixed weapon/armor extraction

**Impact**:
- Agents no longer crash when equipment slots contain objects
- Combat role detection works correctly
- Post-combat analysis handles both string and object formats
- More robust equipment handling across agent behavior code

### Additional Model Agents (March 20, 2026)

**Change** (Commit 21d8984): Added OpenAI model agents and increased default duel bot count.

**New Agents**:
- GPT-4o (OpenAI)
- GPT-4.1 (OpenAI)
- GPT-4o Mini (OpenAI)
- o4-mini (OpenAI)

**Configuration**:
```typescript\n// packages/server/src/eliza/ModelAgentSpawner.ts\nexport const MODEL_AGENTS: ModelProviderConfig[] = [\n  { provider: \"openai\", model: \"gpt-4o\", displayName: \"GPT-4o\" },\n  { provider: \"anthropic\", model: \"claude-sonnet-4.6\" },\n  { provider: \"openai\", model: \"gpt-4.1\", displayName: \"GPT-4.1\" },\n  { provider: \"groq\", model: \"meta-llama/llama-4-scout-17b-16e-instruct\" },\n  { provider: \"openai\", model: \"gpt-4o-mini\", displayName: \"GPT-4o Mini\" },\n  { provider: \"anthropic\", model: \"claude-opus-4.6\" },\n  { provider: \"openai\", model: \"o4-mini\", displayName: \"o4-mini\" },\n  // ... more models\n];\n```\n\n**Duel Bot Count**:
```bash\n# Old default: 4 bots\n# New default: 10 bots\nDUEL_BOT_COUNT=10\n```\n\n**Files Changed**:
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Added OpenAI agents, increased default count

**Impact**: 
- More diverse AI agent pool (OpenAI + Anthropic + Groq)
- 10 concurrent duel bots for better matchmaking
- Requires `OPENAI_API_KEY` for OpenAI agents

### uWS Transport Wiring for Duel Bots (March 20, 2026)

**Change** (Commit 3bd085f): Fixed duel bot WebSocket connections to use uWS port instead of Fastify port.

**Problem**: Duel bots were connecting to `ws://localhost:5555/ws` (Fastify) but game traffic now runs on `ws://localhost:5556/ws` (uWS). Bots would connect but never receive game state updates.

**Fixes**:

#### 1. Port Routing
```bash\n# packages/server/scripts/dev-duel.mjs\n# Old: ws://127.0.0.1:5555/ws\n# New: ws://127.0.0.1:5556/ws (uWS port)\nconst wsUrl = process.env.PUBLIC_WS_URL || \"ws://127.0.0.1:5556/ws\";\n```\n\n#### 2. API URL Flag
```bash\n# Health checks hit Fastify /health (port 5555), not uWS\nnode dev-duel.mjs --api-url http://127.0.0.1:5555\n```\n\n#### 3. Lazy Service Start
ElizaOS v2 lazy-starts services — explicitly call `_ensureServiceStarted(\"hyperscapeService\")` after `runtime.initialize()`:
```typescript\n// packages/server/src/eliza/ElizaDuelBot.ts\nif (typeof runtime._ensureServiceStarted === \"function\") {\n  await runtime._ensureServiceStarted(\"hyperscapeService\");\n}\n```\n\n#### 4. uWS Error Handling
```typescript\n// packages/server/src/startup/uws-server.ts\nopen: (ws) => {\n  try {\n    world.network.onConnection(socket);\n  } catch (err) {\n    console.error(\"[uWS] Connection error:\", err);\n    ws.close(); // Prevent zombie connections\n  }\n}\n```\n\n**Files Changed**:
- `packages/server/scripts/dev-duel.mjs` - Route to uWS port, add `--api-url` flag
- `packages/server/scripts/duel-stack.mjs` - Set `HYPERSCAPE_SERVER_URL` + `SECRET_SALT` in gameEnv
- `packages/server/src/eliza/ElizaDuelBot.ts` - Explicit service start
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Explicit service start
- `packages/server/src/startup/uws-server.ts` - Add `.catch()` to `onConnection`
- `packages/server/scripts/dev.mjs` - Fix `PUBLIC_WS_URL` to use `UWS_PORT` when enabled

**Impact**: 
- Duel bots now connect to correct WebSocket port
- Health checks hit Fastify HTTP API (not uWS)
- ElizaOS services start correctly in v2
- Connection errors are surfaced instead of silently failing

### Tick System Reliability Improvements (March 20, 2026)

**Change** (PR #1064): Added tick health monitoring, drift correction, and per-handler timing.

**Features**:

#### 1. Tick Health Monitoring
```typescript\n// packages/server/src/systems/TickSystem.ts\ninterface TickHealth {\n  missedTicks: number;      // Ticks skipped due to overrun\n  lateTicks: number;        // Ticks that started late\n  maxLateness: number;      // Worst lateness (ms)\n  avgDuration: number;      // Average tick duration (ms)\n  lastTickDuration: number; // Most recent tick (ms)\n}\n```\n\n#### 2. Drift-Corrected setTimeout
```typescript\nprivate scheduleNextTick(): void {\n  const now = Date.now();\n  const drift = now - this.nextTickTime;\n  const delay = Math.max(0, this.tickInterval - drift);\n  \n  this.tickTimeout = setTimeout(() => {\n    this.processTick();\n  }, delay);\n  \n  this.nextTickTime += this.tickInterval;\n}\n```\n\n#### 3. Per-Handler Timing
```typescript\nthis.tickSystem.onTick(() => {\n  // ... handler logic\n}, TickPriority.MOVEMENT, \"mobAI\"); // Named handler for diagnostics\n```\n\n#### 4. DevStats F5 Panel
Real-time tick health display (press F5 in-game):
```\nTick Health:\n  Missed: 0 | Late: 2 | Max Lateness: 45ms\n  Avg Duration: 120ms | Last: 115ms\n  Pub/Sub Publishes: 1,234\n```\n\n**Files Changed**:
- `packages/server/src/systems/TickSystem.ts` - Drift correction, health tracking, named handlers
- `packages/shared/src/systems/client/DevStats.ts` - Added tick health panel
- `packages/server/src/systems/ServerNetwork/index.ts` - Per-handler timing instrumentation

**Impact**: 
- Tick drift eliminated (stays aligned with wall clock)
- Missed ticks are tracked and logged
- Per-handler timing identifies bottlenecks
- F5 panel provides real-time diagnostics

### Quest System Network Flow Fix (March 20, 2026)

**Change** (Commit f79767b, PR #1064): Fixed quest accept to send over network instead of local event, and added network listeners for server→client quest packets.

**Problem**: `InterfaceModals.tsx` was emitting `QUEST_START_ACCEPTED` as a local event which never reached the server. Quest accept UI would close but the quest never started server-side. Additionally, quest panels weren't listening for server→client quest packets, so UI wouldn't update after server-side quest state changes.

**Fix**: Changed to `network.send("questAccept")` to match `Sidebar` and `MobileInterfaceManager`, and added network listeners:
```typescript\n// Old (local event - never reaches server)\nworld.emit(EventType.QUEST_START_ACCEPTED, {\n  playerId: localPlayer.id,\n  questId: questStartData.questId,\n});\n\n// New (network packet - reaches server)\nworld.network.send(\"questAccept\", {\n  questId: questStartData.questId,\n});\n```\n\n**Network Listeners**: Added listeners for server→client quest packets to trigger UI updates:
```typescript\n// packages/client/src/game/panels/QuestJournalPanel.tsx\nworld.network?.on(\"questStarted\", onQuestEvent);\nworld.network?.on(\"questProgressed\", onQuestProgressed);\nworld.network?.on(\"questCompleted\", onQuestEvent);\n```\n\n**Files Changed**:
- `packages/client/src/game/interface/InterfaceModals.tsx` - Send quest accept over network
- `packages/client/src/game/panels/QuestJournalPanel.tsx` - Listen for server quest packets
- `packages/client/src/game/panels/QuestsPanel.tsx` - Listen for server quest packets
- `packages/client/src/game/hud/Minimap.tsx` - Listen for server quest packets

**Impact**: 
- Quest accept now works correctly from all UI entry points
- Quest panels update after server-side state changes
- Eliminates quest accept UI closing without quest starting

### Spectator Account ID Fix (March 20, 2026)

**Change** (Commit e7ad12b): Fixed spectator `accountId` ternary bug and added defensive guard on `onConnection`.

**Bugs Fixed**:

#### 1. Copy-Paste Bug
```typescript\n// Old (both branches undefined)\nsocket.accountId = isAgentCharacter ? undefined : undefined;\n\n// New (uses verifiedUserId for authenticated non-agent spectators)\nsocket.accountId = isAgentCharacter ? undefined : verifiedUserId;\n```\n\n#### 2. Non-Null Assertion
```typescript\n// Old (crashes if onConnection is undefined)\nworld.network.onConnection!(socket);\n\n// New (defensive guard + early close)\nif (!world.network?.onConnection) {\n  console.error(\"[uWS] onConnection handler not registered\");\n  ws.close();\n  return;\n}\nworld.network.onConnection(socket);\n```\n\n**Files Changed**:
- `packages/server/src/startup/uws-server.ts` - Fixed `accountId` ternary, added `onConnection` guard

**Impact**: 
- Spectator accounts now tracked correctly
- Server doesn't crash if network system not initialized
- Zombie connections prevented with early close

### Worker Crash Recovery Fix (March 20, 2026)

**Change** (Commit e363a36): Reset `tickInProgress` on worker crash to prevent permanent agent stall.

**Problem**: When the agent behavior worker crashed, `restartWorker()` spawned a new worker but didn't clear `tickInProgress` flags. Agents in the crashed batch would be permanently stuck (never tick again).

**Fix**:
```typescript\n// packages/server/src/eliza/managers/AgentBehaviorBridge.ts\nprivate async restartWorker(): Promise<void> {\n  // Clear tickInProgress for all agents so they aren't permanently stuck\n  for (const schedule of this.schedules.values()) {\n    schedule.tickInProgress = false;\n  }\n  \n  // Reject any pending tick promise\n  if (this.pendingResolve) {\n    this.pendingResolve([]);\n    this.pendingResolve = null;\n  }\n  \n  // Re-spawn worker\n  setTimeout(() => {\n    void this.start().catch(/* ... */);\n  }, 100);\n}\n```\n\n**Files Changed**:
- `packages/server/src/eliza/managers/AgentBehaviorBridge.ts` - Clear `tickInProgress` on crash

**Impact**: 
- Agents recover from worker crashes automatically
- No permanent stalls after worker restart
- Matches timeout-path fix (both paths now clear `tickInProgress`)

### Code Quality Fixes (March 20, 2026)

**Change** (Commit 210ddde): Addressed PR review feedback with code quality improvements and 69 new unit tests.

**Code Quality**:
- **Replaced 6 unsafe `(this as { _lastXTime })` casts** with proper class fields
- **Removed dead code**: Identical server/client branch in `TerrainSystem.getTerrainCenters`
- **Gated tick health transport/connections** behind `NODE_ENV !== production`
- **Fixed entity snapshot cross-contamination**: `WeakMap` keyed by world instance instead of module-level globals

**New Tests** (69 total):
- **BFSPathfinder**: Iteration budget enforcement, multi-destination `findPathToAny`, partial paths
- **SpatialIndex**: Region tracking, subscription diffs, adjacent keys
- **AgentBehaviorEngine**: Batch processing, combat chat, food/equipment/inventory management

**Files Changed**:
- `packages/server/src/systems/ServerNetwork/index.ts` - Proper class fields for timing
- `packages/shared/src/systems/shared/world/TerrainSystem.ts` - Removed dead branch
- `packages/shared/src/systems/client/DevStats.ts` - Gate transport info behind dev mode
- `packages/server/src/eliza/EmbeddedHyperscapeService.ts` - `WeakMap` for snapshot cache
- `packages/shared/src/systems/shared/movement/BFSPathfinder.ts` - Added tests
- `packages/server/src/systems/ServerNetwork/SpatialIndex.ts` - Added tests
- `packages/server/src/eliza/worker/AgentBehaviorEngine.ts` - Added tests

**Impact**: 
- Cleaner codebase with proper type safety
- No cross-contamination between World instances
- Comprehensive test coverage for new systems
- Production deployments don't leak internal diagnostics

### Critical Bug Fixes (March 20, 2026)

**Change** (Commit 21d8984): Fixed tick deadlock, cache collision, and uWS hardening issues.

**Bugs Fixed**:

#### 1. Tick Deadlock
Worker timeout now clears `tickInProgress` so agents aren't permanently stuck:
```typescript\n// packages/server/src/eliza/managers/AgentBehaviorBridge.ts\nsetTimeout(() => {\n  if (this.pendingResolve === resolve) {\n    // Clear tickInProgress for all agents in this batch\n    for (const agent of dueAgents) {\n      const schedule = this.schedules.get(agent.characterId);\n      if (schedule) schedule.tickInProgress = false;\n    }\n    this.pendingResolve = null;\n    resolve([]);\n  }\n}, 5000);\n```\n\n#### 2. Directional Block Cache Key Collision
Fixed bit-overlap in cache key encoding:
```typescript\n// Old (z*4 causes bit-overlap with direction bits)\nconst dirKey = fromTile.z * 4 + (dx+1)*2 + (dz+1);\n\n// New (z*9 provides enough bits, x*18.8M for large coordinates)\nconst dirKey =\n  ((fromTile.x + 1048576) | 0) * 18874368 +\n  ((fromTile.z + 1048576) | 0) * 9 +\n  ((tile.x - fromTile.x + 1) | 0) * 3 +\n  ((tile.z - fromTile.z + 1) | 0);\n```\n\n#### 3. uWS URI Decoding
Wrapped `decodeURIComponent` in try/catch for malformed URIs:
```typescript\n// packages/server/src/startup/uws-server.ts\nfunction parseQueryString(query: string): Record<string, string> {\n  const params: Record<string, string> = {};\n  for (const pair of query.split(\"&\")) {\n    const [key, value] = pair.split(\"=\");\n    try {\n      params[key] = decodeURIComponent(value || \"\");\n    } catch {\n      params[key] = value || \"\"; // Fallback for malformed encoding\n    }\n  }\n  return params;\n}\n```\n\n#### 4. uWS Port Bind Failure
Throw on port bind failure instead of silently continuing:
```typescript\n// packages/server/src/startup/uws-server.ts\nconst listenSocket = await createUwsServer(world, config.uwsPort);\nif (!listenSocket) {\n  throw new Error(`uWS failed to bind to port ${config.uwsPort}`);\n}\n```\n\n#### 5. Worker Init Listener Leak
Remove `onReady` handler after worker init resolves/times out:
```typescript\n// packages/server/src/eliza/managers/AgentBehaviorBridge.ts\nconst onReady = (msg: WorkerToMainMessage) => {\n  if (msg.type === \"ready\") {\n    this.worker?.off(\"message\", onReady); // Clean up\n    this.workerReady = true;\n    resolve();\n  }\n};\n\nsetTimeout(() => {\n  if (!this.workerReady) {\n    this.worker?.off(\"message\", onReady); // Clean up on timeout\n    resolve();\n  }\n}, 5000);\n```\n\n**Files Changed**:
- `packages/server/src/eliza/managers/AgentBehaviorBridge.ts` - Timeout fix, listener cleanup
- `packages/server/src/systems/ServerNetwork/mob-tile-movement.ts` - Cache key fix
- `packages/server/src/startup/uws-server.ts` - URI decoding, port bind error

**Impact**: 
- Agents no longer get stuck after worker timeout
- Directional block cache now collision-free
- Server fails fast on port bind errors
- No listener leaks in worker initialization

### BFS Early Exit Fix (March 20, 2026)

**Change** (Commit 19cae48): Reset `_lastIterationsUsed` on BFS early exit to prevent stale budget tracking.

**Problem**: When BFS found an adjacent tile or same-tile path (early exit), `_lastIterationsUsed` wasn't reset. Subsequent `getLastIterationsUsed()` calls would return stale values from previous pathfinding attempts.

**Fix**:
```typescript\n// packages/shared/src/systems/shared/movement/BFSPathfinder.ts\nfindPath(from: TileCoord, to: TileCoord): TileCoord[] | null {\n  // Early exit: already at destination\n  if (from.x === to.x && from.z === to.z) {\n    this._lastIterationsUsed = 0; // Reset for accurate tracking\n    return [from];\n  }\n  \n  // Early exit: adjacent tile\n  if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {\n    this._lastIterationsUsed = 1; // One iteration to check neighbor\n    return [from, to];\n  }\n  \n  // ... full BFS\n}\n```\n\n**Files Changed**:
- `packages/shared/src/systems/shared/movement/BFSPathfinder.ts` - Reset `_lastIterationsUsed` on early exit

**Impact**: 
- Accurate iteration tracking for budget monitoring
- Diagnostics show correct BFS cost per call
- No stale values from previous pathfinding attempts

## Recent Major Features (March 2026)

### UI Panel Modernization (March 25-26, 2026)

**Change** (PR #1088, PR #1089, PR #1087): Comprehensive UI panel redesign with unified layout system, optimistic updates, and cross-player data leak fixes.

#### Combat Panel Heraldic Shield Redesign

**Change**: Replaced vertical combat style list with horizontal heraldic shield banners featuring SVG shields, protruding icons, theme gradients, and style-colored tints.

**Implementation** (`packages/client/src/game/panels/CombatPanel.tsx`):
```typescript
// Heraldic shield SVG with theme-derived gradients
const SHIELD_OUTER = "M 5 0 L 95 0 Q 100 0 100 5 L 100 82 Q 100 102 50 128 Q 0 102 0 82 L 0 5 Q 0 0 5 0 Z";
const SHIELD_INNER = "M 8 3 L 92 3 Q 97 3 97 7 L 97 80 Q 97 99 50 123 Q 3 99 3 80 L 3 7 Q 3 3 8 3 Z";

// Banner component with filled game-style icons
const CombatStyleBanner = ({ style, isActive, disabled, onClick }) => (
  <div style={{ flex: "0 0 calc((100% - 3 * (var(--banner-gap))) / 4)" }}>
    <button onClick={onClick}>
      <svg viewBox="0 0 100 130">
        {/* Base gradient */}
        <linearGradient id={baseGradId}>
          <stop offset="0%" stopColor={isActive ? bgLight : bgMid} />
          <stop offset="50%" stopColor={isActive ? bgMid : bgDark} />
          <stop offset="100%" stopColor={bgDark} />
        </linearGradient>
        
        {/* Active color tint overlay */}
        {isActive && (
          <linearGradient id={tintGradId}>
            <stop offset="0%" stopColor={styleInfo.color} stopOpacity={0.28} />
            <stop offset="55%" stopColor={styleInfo.color} stopOpacity={0.1} />
          </linearGradient>
        )}
        
        {/* Shield shape with gradients */}
        <path d={SHIELD_OUTER} fill={`url(#${baseGradId})`} />
        {isActive && <path d={SHIELD_OUTER} fill={`url(#${tintGradId})`} />}
        <path d={SHIELD_OUTER} stroke={isActive ? styleInfo.color : borderClr} />
      </svg>
      
      {/* Protruding icon at top of shield */}
      <div style={{ position: "absolute", top: 0, transform: "translate(-50%, -50%)" }}>
        <BannerStyleIcon style={styleInfo.id} color={isActive ? styleInfo.color : accentGold} />
      </div>
      
      {/* Style name and XP bonus */}
      <div style={{ paddingTop: "16px" }}>
        <span>{styleInfo.label}</span>
        <span>{shortXp}</span>
      </div>
    </button>
  </div>
);
```

**Banner Style Icons**: Filled geometric icons for combat styles (accurate = concentric circles, aggressive = double arrows, defensive = shield, controlled = crosshair, rapid = lightning bolt, longrange = arrow, autocast = sparkle).

**Impact**: 
- More immersive fantasy UI matching OSRS/RS3 aesthetic
- Instant visual feedback with optimistic updates
- Horizontal layout fits more styles in compact space
- Theme-derived gradients ensure consistency across themes

#### Equipment Panel Paperdoll Portrait

**Change**: Added live 3D character preview with equipped gear in equipment panel center.

**Implementation** (`packages/client/src/game/panels/equipment/EquipmentPaperdollPortrait.tsx`):
```typescript
export const EquipmentPaperdollPortrait = React.memo(function EquipmentPaperdollPortrait({
  world,
  equipment,
  equipmentSignature,
  compact,
}) {
  // Create dedicated WebGPU viewport for portrait
  const viewport = await createAvatarPreviewViewport({
    container,
    canvas,
    cameraPosition: new THREE.Vector3(0, 1.32, 2.95),
    adjustCameraDepth: false,
  });
  
  // Load player's VRM avatar
  const avatarNode = loadedAvatar.toNodes({ scene: viewport.scene, loader: world.loader }).get("avatar");
  
  // Attach equipment visuals to VRM
  await loadPreviewEquipmentVisuals({
    world,
    equipment,
    vrm,
    avatarRoot: avatarScene,
    visuals: previewVisualsRef.current,
  });
  
  // Interactive rotation and zoom
  onPointerMove={(e) => {
    const deltaX = e.clientX - lastMousePosRef.current.x;
    targetRotationRef.current += deltaX * 0.01;
  }}
  onWheel={(e) => {
    const zoomDelta = e.deltaY > 0 ? 0.1 : -0.1;
    targetZoomRef.current = Math.max(0.4, Math.min(1.15, targetZoomRef.current + zoomDelta));
  }}
});
```

**Equipment Visual Helpers** (`packages/shared/src/systems/client/EquipmentVisualHelpers.ts`):
Extracted shared logic from `EquipmentVisualSystem` for reuse in portrait:
```typescript
// Resolve equipment visual data (attachment points, model paths)
export function resolveEquipmentVisualData(params: { itemId: string }): EquipmentVisualModelData | null

// Resolve primary and fallback URLs for equipment models
export function resolveEquipmentVisualUrls(params: {
  assetsUrl: string;
  itemId: string;
  slot: string;
  itemData: EquipmentVisualModelData | null;
}): EquipmentVisualUrlResolution | null

// Attach equipment model to VRM skeleton
export function attachEquipmentVisualToVRM(params: {
  slot: string;
  modelRoot: THREE.Object3D;
  visuals: EquipmentVisualStore;
  vrm: VRM;
  avatarRoot: THREE.Object3D;
}): void

// Remove equipment visual from VRM
export function removeEquipmentVisual(visuals: EquipmentVisualStore, slot: string): void
```

**Avatar Preview Viewport** (`packages/client/src/game/character/avatarPreviewViewport.ts`):
Reusable WebGPU viewport factory for character previews:
```typescript
export async function createAvatarPreviewViewport(options: {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  cameraPosition?: THREE.Vector3;
  fov?: number;
  adjustCameraDepth?: boolean;
}): Promise<AvatarPreviewViewport> {
  const renderer = await createRenderer({ canvas, alpha: true, antialias: true });
  
  return {
    scene,
    camera,
    renderer,
    resize: () => { /* ... */ },
    start: (onFrame?: (delta: number) => void) => { /* ... */ },
    stop: () => { /* ... */ },
    dispose: () => { /* ... */ },
  };
}
```

**Paperdoll Grid Layout**:
```typescript
// 5-column grid with portrait in center, slots around edges
gridTemplateColumns: `${slotWidth}px ${slotWidth}px 1fr ${slotWidth}px ${slotWidth}px`,
gridTemplateRows: `repeat(5, ${slotHeight}px)`,
gridTemplateAreas: `
  "head . . . cape"
  "body . . . amulet"
  "legs . . . ring"
  "boots . . . gloves"
  "ammo weapon . shield ."
`,
```

**Impact**:
- Live 3D preview of equipped gear
- Interactive rotation (drag) and zoom (scroll)
- Shared equipment visual logic between system and portrait
- Fallback to stylized silhouette when avatar unavailable
- Reusable viewport factory for other character previews

#### Unified Panel Layout Constants

**Change**: Extracted shared panel dimensions into `panelLayout.ts` for consistency across all icon-grid panels.

**Implementation** (`packages/client/src/constants/panelLayout.ts`):
```typescript
/**
 * Single source of truth for icon-grid panel dimensions used by:
 *   - InventoryPanel   (4px outer padding, 4px grid gap, 3px mobile)
 *   - EquipmentPanel   (4px outer padding, 8px grid gap, 3px mobile)
 *   - PrayerPanel
 *   - SpellsPanel
 *   - SkillsPanel
 */

// Desktop
export const PANEL_PADDING = 4;           // Outer panel wrapper
export const PANEL_GRID_GAP = 4;          // Gap between icons
export const PANEL_GRID_PADDING = 4;      // Inner grid inset
export const PANEL_ICON_SIZE = 36;        // Icon/slot size

// Mobile
export const PANEL_MOBILE_PADDING = 3;
export const PANEL_MOBILE_ICON_SIZE = 48; // Touch target size
export const PANEL_MOBILE_GRID_GAP = 4;

// Border radius
export const PANEL_SLOT_RADIUS = 4;       // Square aesthetic
```

**Usage**:
```typescript
// PrayerPanel.tsx
import { PANEL_ICON_SIZE, PANEL_GRID_GAP, PANEL_PADDING } from "@/constants/panelLayout";

const PRAYER_ICON_SIZE = PANEL_ICON_SIZE;  // 36px
const PRAYER_GAP = PANEL_GRID_GAP;         // 4px
```

**Impact**:
- Consistent spacing across all panels (Inventory, Equipment, Prayer, Spells, Skills)
- Single place to adjust panel dimensions
- Eliminates scattered magic numbers
- Mobile and desktop variants clearly defined

#### CursorTooltip Component

**Change**: Created reusable portal-based mouse-following tooltip with auto-measurement and viewport-edge flipping.

**Implementation** (`packages/client/src/ui/core/tooltip/CursorTooltip.tsx`):
```typescript
export const CursorTooltip = React.memo(function CursorTooltip({
  visible,
  position,
  estimatedSize = { width: 140, height: 60 },
  cursorOffset = 4,
  children,
  style,
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Measure actual rendered dimensions for precise alignment
  const actualSize = useTooltipSize(visible, tooltipRef, estimatedSize);
  
  // Calculate safe bounding-box positioning with edge flipping
  const { left, top } = calculateCursorTooltipPosition(
    position,
    actualSize,
    cursorOffset,
  );
  
  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left,
        top,
        background: `linear-gradient(180deg, ${theme.colors.background.primary}, ${theme.colors.background.secondary})`,
        border: `1px solid ${theme.colors.border.hover}`,
        borderRadius: "4px",
        padding: "8px 10px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
});
```

**Replaced Patterns**:
```typescript
// Old (duplicated across 5+ panels)
const tooltipRef = useRef<HTMLDivElement>(null);
const tooltipSize = useTooltipSize(hoveredItem, tooltipRef, { width: 200, height: 100 });
const { left, top } = calculateCursorTooltipPosition(mousePos, tooltipSize, 4, 8);
return createPortal(
  <div ref={tooltipRef} style={{ position: "fixed", left, top, ... }}>
    {/* tooltip content */}
  </div>,
  document.body,
);

// New (one line)
<CursorTooltip visible={!!hoveredItem} position={mousePos} estimatedSize={{ width: 200, height: 100 }}>
  {/* tooltip content */}
</CursorTooltip>
```

**Panels Updated**:
- `InventoryPanel.tsx` - Item tooltips
- `PrayerPanel.tsx` - Prayer tooltips
- `SpellsPanel.tsx` - Spell tooltips
- `SkillsPanel.tsx` - Skill tooltips
- `EquipmentPanel.tsx` - Equipment tooltips

**Impact**:
- Eliminates ~50 lines of duplicated tooltip code per panel
- Consistent tooltip behavior across all panels
- Auto-measurement prevents clipping
- Viewport-edge flipping for better UX

#### Tab Persistence System

**Change**: Render all window tabs simultaneously with `display:none/flex` toggling instead of unmounting inactive tabs.

**Problem**: Switching tabs would unmount the inactive panel, losing scroll position and component state.

**Solution** (`packages/client/src/game/interface/InterfacePanels.tsx`):
```typescript
// Old (unmounts inactive tabs)
if (typeof activeTab.content === "string") {
  const panelContent = renderPanel(activeTab.content, undefined, windowId);
  return <div>{panelContent}</div>;
}

// New (mounts all tabs, toggles visibility)
return (
  <div style={{ position: "relative", flex: 1 }}>
    {tabs.map((tab, idx) => {
      const isActive = idx === activeTabIndex;
      const panelContent = typeof tab.content === "string"
        ? renderPanel(tab.content, undefined, windowId)
        : tab.content;
      
      return (
        <div
          key={tab.id || idx}
          style={{
            display: isActive ? "flex" : "none",
            position: "absolute",
            inset: 0,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {panelContent}
        </div>
      );
    })}
  </div>
);
```

**Impact**:
- Scroll position preserved across tab switches
- Component state (expanded sections, filters) retained
- Smoother tab switching experience
- Matches modern browser tab behavior

#### Spells Panel Added to Default Layout

**Change**: Added Spells tab alongside Prayer in the default right-column window.

**Implementation**:
```typescript
// DefaultLayoutFactory.ts
{
  id: "spells",
  label: "Spells",
  icon: "🪄",
  content: "spells",
  closeable: true,
}

// windowStore.ts - Schema migration v17
const SCHEMA_VERSION = 17;  // Bumped from 16

migrations[17] = () => {
  // Clear all windows to include spellbook in default layout
  return new Map<string, WindowState>();
};
```

**Impact**:
- Spells panel now visible by default for new users
- Existing users get spells tab on next layout reset
- Consistent with Prayer panel positioning

#### Optimistic UI Updates

**Change**: Combat style and auto-retaliate toggles now update UI instantly before server confirmation.

**Implementation** (`packages/client/src/game/panels/CombatPanel.tsx`):
```typescript
// Local caches for optimistic updates
const combatStyleCache = new Map<string, string>();
const autoRetaliateCache = new Map<string, boolean>();

const changeStyle = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);

  // Send to server — server confirms via attackStyleChanged packet,
  // which will overwrite our optimistic value with the authoritative one
  actions.actionMethods.changeAttackStyle(playerId, next);
};

const toggleAutoRetaliate = () => {
  const newValue = !autoRetaliate;

  // Optimistic: update UI instantly
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);

  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

**Inventory Optimistic Removal** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
/**
 * Optimistically remove an item from the inventory cache and emit an
 * immediate UI update. Automatically snapshots before mutation for
 * rollback if the server doesn't confirm within 5 seconds.
 */
applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void {
  const cached = this.lastInventoryByPlayerId[playerId];
  if (!cached) return;

  const itemIndex = cached.items.findIndex((i) => i.slot === slot);
  if (itemIndex === -1) return;

  // Snapshot before mutation for rollback on timeout
  const snapshot = this.snapshotInventory(playerId);
  if (snapshot) this.inventoryTracker.add(snapshot);
  this.ensureInventoryPruner();

  const item = cached.items[itemIndex];
  if (item.quantity <= quantity) {
    cached.items.splice(itemIndex, 1);
  } else {
    item.quantity -= quantity;
  }

  this.world.emit(EventType.INVENTORY_UPDATED, { ...cached });
}
```

**Rollback System**:
- **Timeout**: 5 seconds (if server doesn't confirm)
- **Pruner**: Runs every 1 second to check for stale actions
- **Cleanup**: Clears on `INVENTORY_UPDATED` (server confirmation) or disconnect
- **Shared Tracker**: Single `PendingActionTracker` in `ClientNetwork` used by all callers

**Impact**:
- Zero perceived latency for combat controls (matches OSRS)
- Instant feedback for eat/drop/bury/firemaking actions
- Server remains authoritative (can reject invalid actions)
- Automatic rollback if server doesn't respond within 5s

#### Equipment Panel Cross-Player Leak Fix

**Problem**: Equipment panel was displaying other players' gear because `equipmentUpdated` broadcasts hit all players without filtering. When an AI agent equipped a weapon, all players' equipment panels would show that weapon.

**Root Cause**: `usePlayerData.ts` had no `playerId` filter on equipment updates.

**Fix** (`packages/client/src/hooks/usePlayerData.ts`):
```typescript
// Old (no filter - shows everyone's equipment)
if (update.component === "equipment" && isObject(update.data)) {
  const equipmentPayload = update.data as { equipment?: RawEquipmentData };
  setEquipment(processRawEquipment(equipmentPayload.equipment));
}

// New (filtered - shows only local player's equipment)
const equipmentPayload = update.data as {
  playerId?: string;
  equipment?: RawEquipmentData;
};

// Only update if this equipment belongs to the local player
if (playerId && equipmentPayload.playerId && equipmentPayload.playerId !== playerId) {
  return;
}

const nextEquipment = processRawEquipment(equipmentPayload.equipment);
setEquipment((prev) => areEquipmentItemsEqual(prev, nextEquipment) ? prev : nextEquipment);
```

**Server Changes** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
// Include playerId in equipment broadcasts
this.world.emit(EventType.UI_UPDATE, {
  component: "equipment",
  data: {
    playerId: data.playerId,  // NEW: Include playerId for filtering
    equipment: data.equipment,
  },
});
```

**Impact**: Equipment panel now shows only the local player's gear, eliminates cross-player data leak.

#### Combat Damage Deduplication

**Problem**: `sendToNearby` publishes to 9 region topics (player's region + 8 adjacent), causing players near region boundaries to receive the same damage packet 2-3 times, resulting in duplicate damage splats.

**Solution** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
private readonly _recentDamageKeys = new Map<string, number>();

onCombatDamageDealt = (data: {
  attackerId: string;
  targetId: string;
  damage: number;
  tick?: number;
}) => {
  // Include server tick so same-damage rapid hits on different ticks are NOT dropped
  // Use | separator (not -) to avoid collisions if IDs contain hyphens
  // If tick is missing (rolling deploy), fall back to ms timestamp rounded to 125ms
  const tick = data.tick ?? Math.floor(performance.now() / 125);
  const dedupKey = `${data.attackerId}|${data.targetId}|${data.damage}|${tick}`;
  
  if (this._recentDamageKeys.has(dedupKey)) {
    return; // Already processed this damage event
  }

  // Periodic sweep: clear stale entries (>500ms old) when map exceeds threshold
  const now = performance.now();
  if (this._recentDamageKeys.size > 150) {
    // Soft sweep: remove entries older than 500ms
    for (const [key, ts] of this._recentDamageKeys) {
      if (now - ts > 500) this._recentDamageKeys.delete(key);
    }
    
    // Hard cap: trim to 100 if sweep didn't clear enough
    if (this._recentDamageKeys.size > 200) {
      const excess = this._recentDamageKeys.size - 100;
      let dropped = 0;
      for (const key of this._recentDamageKeys.keys()) {
        this._recentDamageKeys.delete(key);
        if (++dropped >= excess) break;
      }
    }
  }

  this._recentDamageKeys.set(dedupKey, now);
  this.world.emit(EventType.COMBAT_DAMAGE_DEALT, data);
};
```

**Server Changes** (`packages/server/src/systems/ServerNetwork/event-bridge.ts`):
```typescript
// Include server tick in damage broadcasts
this.broadcast.sendToNearby("combatDamageDealt", pos, {
  attackerId: data.attackerId,
  targetId: data.targetId,
  damage: data.damage,
  targetType: data.targetType,
  position: { x: pos.x, y: pos.y, z: pos.z },
  tick: currentTick,  // NEW: Include server tick for dedup
});
```

**Dedup Strategy**:
- **Soft Sweep**: Clears entries >500ms old when map exceeds 150 entries
- **Hard Cap**: Trims to 100 entries if map exceeds 200 (prevents unbounded growth)
- **Tick-Based Keys**: Distinguishes same-damage rapid hits on different ticks
- **Rolling Deploy Fallback**: Uses `performance.now() / 125` when server tick field is missing

**Impact**: Eliminates duplicate damage splats near region boundaries, bounded memory usage.

#### Attack Style System Cleanup

**Change**: Removed dead cooldown infrastructure that was hardcoded to 0ms.

**Removed**:
- `STYLE_CHANGE_COOLDOWN = 0` constant
- `styleChangeTimers` Map and timer cleanup logic
- `combatStyleHistory` array (write-only, never displayed)
- `lastStyleChange` timestamp tracking
- Dead API methods: `canPlayerChangeStyle()`, `getRemainingStyleCooldown()`, `getPlayerStyleHistory()`

**Files Changed**:
- `packages/shared/src/systems/shared/character/PlayerSystem.ts` - Removed cooldown logic (~150 lines)
- `packages/shared/src/systems/shared/infrastructure/SystemLoader.ts` - Removed API bindings
- `packages/shared/src/types/entities/player-types.ts` - Removed `PlayerAttackStyleState` fields

**Impact**: Cleaner codebase, simpler attack style system, no functional changes (cooldown was already 0ms).

#### Auto-Initialization for Event Ordering Races

**Change**: Added auto-initialization guards to handle cases where UI events arrive before `onPlayerRegister`.

**Attack Style Auto-Init** (`packages/shared/src/systems/shared/character/PlayerSystem.ts`):
```typescript
let playerState = this.playerAttackStyles.get(playerId);
if (!playerState) {
  // Auto-initialize if player exists but wasn't registered yet (event ordering)
  if (this.isKnownPlayer(playerId)) {
    const weaponType = this.getPlayerWeaponType(playerId);
    const defaultStyle = getDefaultStyleForWeapon(weaponType);
    this.logger.debug(
      `Auto-initializing attack style for ${playerId} (event ordering race), default: ${defaultStyle}`
    );
    this.initializePlayerAttackStyle(playerId, defaultStyle);
    playerState = this.playerAttackStyles.get(playerId);
  }
}
```

**Equipment Idempotency**:
```typescript
// EquipmentSystem.ts - initializePlayerEquipment
if (this.playerEquipment.has(playerData.id)) {
  this.logger.debug(`Equipment already initialized for ${playerData.id}, skipping`);
  return;
}
```

**Reconnection Guard**:
```typescript
// EquipmentSystem.ts - PLAYER_JOINED handler
if (typedData.isReconnect && this.playerEquipment.has(typedData.playerId)) {
  this.sendEquipmentUpdated(typedData.playerId);
  this.emitEquipmentChangedForAllSlots(typedData.playerId);
  return;
}
```

**Impact**:
- Eliminates \"no state for player\" errors from event ordering races
- Player choices take precedence over DB-saved values during session
- Reconnection preserves in-session equipment and combat preferences

#### Weapon Change Auto-Style Switching

**Change**: Auto-switch attack style when weapon changes and current style is invalid for new weapon.

**Implementation** (`packages/shared/src/systems/shared/character/PlayerSystem.ts`):
```typescript
private handleWeaponChange(playerId: string): void {
  const playerState = this.playerAttackStyles.get(playerId);
  if (!playerState) return;

  const weaponType = this.getPlayerWeaponType(playerId);
  const currentStyle = playerState.selectedStyle as CombatStyleExtended;

  if (!isStyleValidForWeapon(weaponType, currentStyle)) {
    const newStyle = getDefaultStyleForWeapon(weaponType);
    this.handleStyleChange({ playerId, newStyle });
  }
}

// Subscribe to equipment changes (server-only)
if (this.world.isServer) {
  this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data) => {
    const eqData = data as { playerId: string; slot: string; itemId: string | null };
    if (eqData.slot === "weapon") {
      this.handleWeaponChange(eqData.playerId);
    }
  });
}
```

**Example**: Switching from staff (autocast) to sword → auto-select \"accurate\" style.

**Impact**: Prevents invalid style errors when weapon changes, OSRS-accurate behavior.

#### Firemaking Optimistic Removal

**Change**: Added optimistic inventory removal for firemaking so logs disappear instantly.

**Implementation** (`packages/shared/src/systems/shared/interaction/InventoryInteractionSystem.ts`):
```typescript
// Optimistic removal: remove the logs from the client inventory cache
// so the UI updates immediately (same pattern as eat/drop/bury in
// InventoryActionDispatcher). The server's authoritative inventoryUpdated
// packet will replace this cache within ~100-200ms.
this.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Consolidated Rollback Logic** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
// Single tracker for all optimistic inventory mutations (shared by all callers)
private inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);
private inventoryPrunerInterval: ReturnType<typeof setInterval> | null = null;

// Public API for optimistic mutations
applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void
snapshotInventory(playerId: string): InventorySnapshot | null
```

**Impact**:
- Logs disappear from inventory immediately when firemaking starts
- Eliminates duplicate tracker instances (two timers, two listeners)
- Single source of truth for optimistic inventory mutations
- Reduced ~70 lines of boilerplate across callers

#### Targeting Mode UI Fixes

**Changes**:
- **Immediate Clear**: Targeting state clears immediately after target selection (no server round-trip wait)
- **Hover State**: Removed `isTargetingActive` from slot hover condition to prevent grey flash on all filled slots
- **System Registration**: Registered `InventoryInteractionSystem` on client for targeting support

**Implementation** (`packages/client/src/game/panels/InventoryPanel.tsx`):
```typescript
if (targetingState.active && targetingState.sourceItem) {
  this.world.emit(EventType.TARGETING_SELECT, {
    targetType: "inventory_item",
    targetSlot: slotIndex,
  });
  // Clear targeting immediately — action is committed
  setTargetingState(initialTargetingState);
}

// DraggableInventorySlot - removed targeting from hover condition
const slotChrome = useMemo(
  () => getInteractiveTileStyle(theme, {
    active: isSourceItem,
    hovered: !isEmpty,  // Removed: && !isTargetingActive
    dragging: isDragging,
    dropTarget: isOver,
  }),
  [theme, isSourceItem, isEmpty, isDragging, isOver]
);
```

**Impact**: 
- Targeting mode feels more responsive
- No stale highlights after target selection
- No grey flash on all filled slots when entering targeting mode

#### Quest UI Theme Modernization

**Change**: Updated quest log and detail popup to use theme utility functions and panel layout constants.

**Implementation** (`packages/client/src/game/components/quest/QuestLog.tsx`):
```typescript
import {
  getPanelSurfaceStyle,
  getPanelInsetStyle,
  getPanelHeaderStyle,
  getInteractiveTileStyle,
  getWindowSurfaceStyle,
  getDecorativeBorderStyle,
} from "@/ui/theme/themes";
import {
  PANEL_PADDING,
  PANEL_GRID_GAP,
  PANEL_MOBILE_PADDING,
  PANEL_SLOT_RADIUS,
} from "../../../constants/panelLayout";

// Quest list items now use themed interactive tiles
const tileStyle: CSSProperties = {
  ...getInteractiveTileStyle(theme, {
    hovered: isHovered,
    active: isSelected,
    radius: PANEL_SLOT_RADIUS,
  }),
  borderLeft: `3px solid ${isSelected ? theme.colors.border.active : stateColor}`,
};

// Category headers use themed inset style
const headerStyle: CSSProperties = {
  ...getPanelInsetStyle(theme, { emphasis: "normal", radius: PANEL_SLOT_RADIUS }),
  borderLeft: `3px solid ${config.color}`,
};
```

**Visual Improvements**:
- Compact pill badges for quest metadata (category, level, state, progress)
- Inline progress bars with state-colored fills
- Category icons (crown, scroll, sun, calendar, star)
- Gold-accented pinned quest section
- Themed section cards with panel inset styling

**Impact**:
- Consistent visual language with other game panels
- Better use of theme colors and spacing constants
- More compact and information-dense layout
- Improved mobile responsiveness

#### Panel Data Synchronization Fix

**Change**: Added `panelDataVersion` counter to break through React.memo barriers in `WindowRenderer`/`WindowItem`.

**Problem**: `WindowRenderer` and `WindowItem` are wrapped in `React.memo()`, which blocked prop updates when inventory/equipment/stats changed.

**Solution** (`packages/client/src/game/interface/InterfaceManager.tsx`):
```typescript
// Monotonic counter that changes when panel data updates, breaking
// through React.memo barriers in WindowRenderer/WindowItem without
// recreating renderPanel (which would re-mount all panels).
const panelDataVersionRef = useRef(0);
const panelDataVersion = useMemo(() => {
  return ++panelDataVersionRef.current;
}, [inventory, coins, playerStats, equipment]);

// Pass to WindowRenderer
<WindowRenderer
  renderPanel={renderPanel}
  panelDataVersion={panelDataVersion}  // Breaks memo barrier
/>

// WindowItem - intentionally unused prop breaks React.memo
const WindowItem = memo(function WindowItem({
  windowId,
  isEditMode,
  windowCombiningEnabled,
  renderPanel,
  // Intentionally unused — its presence in props breaks React.memo's
  // shallow comparison when panel data changes, causing WindowItem to
  // re-render and call renderPanel with fresh ref-based data.
  panelDataVersion: _,
}: WindowItemProps) {
  // ...
});
```

**Impact**:
- Inventory panels update in real-time when data changes
- Lightweight counter (number) breaks memo without forcing panel re-mount
- `renderPanel` stays stable (no unnecessary panel recreation)

#### Starter Equipment Fix

**Change**: Fixed `STARTER_EQUIPMENT` referencing non-existent `bronze_sword` → `bronze_shortsword`.

**Files Changed**:
- `packages/shared/src/systems/shared/character/InventorySystem.ts`
- `packages/shared/src/systems/shared/character/PlayerSystem.ts`
- `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

**Impact**: New players receive correct starter weapon, eliminates item lookup failures.

#### Event Type Consistency

**Change**: Replaced raw string event names with `EventType` enum constants.

**Implementation** (`packages/shared/src/systems/shared/entities/Entities.ts`):
```typescript
// Old (string literals - error-prone)
this.emitTypedEvent("PLAYER_JOINED", { ... });

// New (typed enum - type-safe)
this.world.emit(EventType.PLAYER_JOINED, { ... });
```

**Impact**: Better type safety, prevents typo bugs, improves grep-ability.

**Files Changed**: 
- PR #1088: 33 files, 4,211 additions, 2,320 deletions
- PR #1089: 12 files, 250 additions, 194 deletions
- PR #1087: 9 files, 149 additions, 171 deletions

**Total Impact**: ~4,600 additions, ~2,700 deletions across 54 files.

### Equipment Panel & Combat UI Fixes (March 25-26, 2026)

**Change** (PR #1089): Fixed cross-player equipment data leak, added optimistic combat UI updates, removed attack style cooldown system, and added combat damage deduplication.

#### Equipment Panel Cross-Player Leak
**Problem**: Equipment panel was displaying other players' gear because `equipmentUpdated` broadcasts hit all players without filtering. When an AI agent equipped a weapon, all players' equipment panels would show that weapon.

**Root Cause**: `usePlayerData.ts` had no `playerId` filter on equipment updates:
```typescript
// Old (no filter - shows everyone's equipment)
if (update.component === "equipment" && isObject(update.data)) {
  const equipmentPayload = update.data as { equipment?: RawEquipmentData };
  setEquipment(processRawEquipment(equipmentPayload.equipment));
}
```

**Fix**: Filter by local `playerId`:
```typescript
// New (filtered - shows only local player's equipment)
const equipmentPayload = update.data as {
  playerId?: string;
  equipment?: RawEquipmentData;
};

// Only update if this equipment belongs to the local player
if (playerId && equipmentPayload.playerId && equipmentPayload.playerId !== playerId) {
  return;
}

const nextEquipment = processRawEquipment(equipmentPayload.equipment);
setEquipment((prev) => areEquipmentItemsEqual(prev, nextEquipment) ? prev : nextEquipment);
```

**Server Changes**: Include `playerId` in equipment broadcasts:
```typescript
// ClientNetwork.ts
this.world.emit(EventType.UI_UPDATE, {
  component: "equipment",
  data: {
    playerId: data.playerId,  // NEW: Include playerId for filtering
    equipment: data.equipment,
  },
});
```

**Impact**: Equipment panel now shows only the local player's gear, eliminates cross-player data leak.

#### Optimistic Combat UI Updates
**Change**: Combat style and auto-retaliate toggles now update UI instantly before server confirmation.

**Implementation** (`packages/client/src/game/panels/CombatPanel.tsx`):
```typescript
const handleStyleChange = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);

  // Send to server — server confirms via attackStyleChanged packet,
  // which will overwrite our optimistic value with the authoritative one
  actions.actionMethods.changeAttackStyle(playerId, next);
};

const handleAutoRetaliateToggle = () => {
  const newValue = !autoRetaliate;

  // Optimistic: update UI instantly (OSRS has zero visible delay)
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);

  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

**Impact**: 
- Combat controls feel instant and responsive
- Matches OSRS behavior (zero visible delay)
- Server remains authoritative (can reject invalid changes)

#### Attack Style Cooldown System Removed
**Change**: Removed dead cooldown infrastructure that was hardcoded to 0ms.

**Removed**:
- `STYLE_CHANGE_COOLDOWN = 0` constant
- `styleChangeTimers` Map and timer cleanup logic
- `combatStyleHistory` array (write-only, never displayed)
- `lastStyleChange` timestamp tracking
- Dead API methods: `canPlayerChangeStyle()`, `getRemainingStyleCooldown()`, `getPlayerStyleHistory()`

**Files Changed**:
- `packages/shared/src/systems/shared/character/PlayerSystem.ts` - Removed cooldown logic (~150 lines)
- `packages/shared/src/systems/shared/infrastructure/SystemLoader.ts` - Removed API bindings
- `packages/shared/src/types/entities/player-types.ts` - Removed `PlayerAttackStyleState` fields

**Impact**: Cleaner codebase, simpler attack style system, no functional changes (cooldown was already 0ms).

#### Combat Damage Deduplication
**Problem**: `sendToNearby` publishes to 9 region topics (player's region + 8 adjacent), causing players near region boundaries to receive the same damage packet 2-3 times, resulting in duplicate damage splats.

**Fix**: Deduplicate using tick-based keys with periodic sweep:
```typescript
// ClientNetwork.ts
private readonly _recentDamageKeys = new Map<string, number>();

onCombatDamageDealt = (data: {
  attackerId: string;
  targetId: string;
  damage: number;
  tick?: number;
}) => {
  // Include server tick so same-damage rapid hits on different ticks are NOT dropped
  // If tick is missing (rolling deploy), fall back to ms timestamp rounded to 125ms
  const tick = data.tick ?? Math.floor(performance.now() / 125);
  const dedupKey = `${data.attackerId}|${data.targetId}|${data.damage}|${tick}`;
  
  if (this._recentDamageKeys.has(dedupKey)) {
    return; // Already processed this damage event
  }

  // Periodic sweep: clear stale entries (>500ms old) when map exceeds threshold
  const now = performance.now();
  if (this._recentDamageKeys.size > 150) {
    for (const [key, ts] of this._recentDamageKeys) {
      if (now - ts > 500) this._recentDamageKeys.delete(key);
    }
    
    // Hard cap: trim to 100 if sweep didn't clear enough
    if (this._recentDamageKeys.size > 200) {
      const excess = this._recentDamageKeys.size - 100;
      let dropped = 0;
      for (const key of this._recentDamageKeys.keys()) {
        this._recentDamageKeys.delete(key);
        if (++dropped >= excess) break;
      }
    }
  }

  this._recentDamageKeys.set(dedupKey, now);
  this.world.emit(EventType.COMBAT_DAMAGE_DEALT, data);
};
```

**Server Changes**: Include `tick` in damage broadcasts:
```typescript
// event-bridge.ts
this.broadcast.sendToNearby("combatDamageDealt", pos, {
  attackerId: data.attackerId,
  targetId: data.targetId,
  damage: data.damage,
  targetType: data.targetType,
  position: { x: pos.x, y: pos.y, z: pos.z },
  tick: currentTick,  // NEW: Include server tick for dedup
});
```

**Dedup Strategy**:
- **Soft Sweep**: Clears entries >500ms old when map exceeds 150 entries
- **Hard Cap**: Trims to 100 entries if map exceeds 200 (prevents unbounded growth)
- **Tick-Based Keys**: Distinguishes same-damage rapid hits on different ticks
- **Rolling Deploy Fallback**: Uses `performance.now() / 125` when server tick field is missing

**Impact**: Eliminates duplicate damage splats near region boundaries, bounded memory usage.

#### Auto-Initialization for Event Ordering Races
**Change**: Added auto-initialization guards to handle cases where UI events arrive before `onPlayerRegister`.

**Attack Style Auto-Init**:
```typescript
// PlayerSystem.ts - handleStyleChange
let playerState = this.playerAttackStyles.get(playerId);
if (!playerState) {
  // Auto-initialize if player exists but wasn't registered yet (event ordering)
  if (this.isKnownPlayer(playerId)) {
    const weaponType = this.getPlayerWeaponType(playerId);
    const defaultStyle = getDefaultStyleForWeapon(weaponType);
    this.logger.debug(
      `Auto-initializing attack style for ${playerId} (event ordering race), default: ${defaultStyle}`
    );
    this.initializePlayerAttackStyle(playerId, defaultStyle);
    playerState = this.playerAttackStyles.get(playerId);
  }
}
```

**Auto-Retaliate Auto-Init**:
```typescript
// PlayerSystem.ts - handleSetAutoRetaliate
if (!this.playerAutoRetaliate.has(playerId)) {
  // Only auto-initialize for player entities (not mobs or other entity types)
  if (this.isKnownPlayer(playerId)) {
    this.logger.debug(
      `Auto-initializing auto-retaliate for ${playerId} (event ordering race)`
    );
    this.playerAutoRetaliate.set(playerId, true); // default ON
  }
}
```

**Equipment Idempotency**:
```typescript
// EquipmentSystem.ts - initializePlayerEquipment
// Idempotent: don't overwrite existing equipment (prevents reconnection wiping gear)
if (this.playerEquipment.has(playerData.id)) {
  this.logger.debug(
    `Equipment already initialized for ${playerData.id}, skipping`
  );
  return;
}
```

**Reconnection Guard**:
```typescript
// EquipmentSystem.ts - PLAYER_JOINED handler
// On reconnection, equipment is already in memory — just re-send to client
if (typedData.isReconnect && this.playerEquipment.has(typedData.playerId)) {
  this.sendEquipmentUpdated(typedData.playerId);
  this.emitEquipmentChangedForAllSlots(typedData.playerId);
  return;
}
```

**Impact**:
- Eliminates "no state for player" errors from event ordering races
- Player choices take precedence over DB-saved values during session
- Reconnection preserves in-session equipment and combat preferences

#### Weapon Change Auto-Style Switching
**Change**: Auto-switch attack style when weapon changes and current style is invalid for new weapon.

**Implementation**:
```typescript
// PlayerSystem.ts
private handleWeaponChange(playerId: string): void {
  const playerState = this.playerAttackStyles.get(playerId);
  if (!playerState) return;

  const weaponType = this.getPlayerWeaponType(playerId);
  const currentStyle = playerState.selectedStyle as CombatStyleExtended;

  if (!isStyleValidForWeapon(weaponType, currentStyle)) {
    const newStyle = getDefaultStyleForWeapon(weaponType);
    this.handleStyleChange({ playerId, newStyle });
  }
}

// Subscribe to equipment changes (server-only)
if (this.world.isServer) {
  this.subscribe(EventType.PLAYER_EQUIPMENT_CHANGED, (data) => {
    const eqData = data as { playerId: string; slot: string; itemId: string | null };
    if (eqData.slot === "weapon") {
      this.handleWeaponChange(eqData.playerId);
    }
  });
}
```

**Example**: Switching from staff (autocast) to sword → auto-select "accurate" style.

**Impact**: Prevents invalid style errors when weapon changes, OSRS-accurate behavior.

#### Starter Equipment Fix
**Change**: Fixed `STARTER_EQUIPMENT` referencing non-existent `bronze_sword` → `bronze_shortsword`.

**Files Changed**:
- `packages/shared/src/systems/shared/character/InventorySystem.ts`
- `packages/shared/src/systems/shared/character/PlayerSystem.ts`
- `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

**Impact**: New players receive correct starter weapon, eliminates item lookup failures.

#### Event Type Consistency
**Change**: Replaced raw string event names with `EventType` enum constants:
```typescript
// Old (string literals - error-prone)
this.emitTypedEvent("PLAYER_JOINED", { ... });

// New (typed enum - type-safe)
this.world.emit(EventType.PLAYER_JOINED, { ... });
```

**Files Changed**: `packages/shared/src/systems/shared/entities/Entities.ts`

**Impact**: Better type safety, prevents typo bugs, improves grep-ability.

**Files Changed**: 12 files, 250 additions, 194 deletions. See PR #1089 for complete details.

### Inventory UI & Firemaking Fixes (March 25, 2026)

**Change** (PR #1087): Fixed firemaking optimistic removal, consolidated inventory rollback logic, and improved targeting mode UX.

#### Optimistic Inventory Rollback Consolidation
**Problem**: Both `InventoryActionDispatcher` and `InventoryInteractionSystem` maintained separate `PendingActionTracker` instances with duplicate pruning logic, duplicate `INVENTORY_UPDATED` listeners, and potential overlapping rollback races.

**Solution**: Move tracker into `ClientNetwork` as shared infrastructure:
```typescript
// ClientNetwork.ts
export class ClientNetwork extends SystemBase {
  // Single tracker for all optimistic inventory mutations (shared by all callers)
  private inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);
  private inventoryPrunerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Optimistically remove an item from the inventory cache and emit an
   * immediate UI update. Automatically snapshots before mutation for
   * rollback if the server doesn't confirm within 5 seconds.
   */
  applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void {
    const cached = this.lastInventoryByPlayerId[playerId];
    if (!cached) return;

    const itemIndex = cached.items.findIndex((i) => i.slot === slot);
    if (itemIndex === -1) return;

    // Snapshot before mutation for rollback on timeout
    const snapshot = this.snapshotInventory(playerId);
    if (snapshot) this.inventoryTracker.add(snapshot);
    this.ensureInventoryPruner();

    const item = cached.items[itemIndex];
    if (item.quantity <= quantity) {
      cached.items.splice(itemIndex, 1);
    } else {
      item.quantity -= quantity;
    }

    this.world.emit(EventType.INVENTORY_UPDATED, { ...cached });
  }

  /** Start the periodic rollback pruner (once, lazily on first optimistic call). */
  private ensureInventoryPruner(): void {
    if (this.inventoryPrunerInterval) return;
    this.inventoryPrunerInterval = setInterval(() => {
      const rollbacks = this.inventoryTracker.pruneStale();
      for (const snapshot of rollbacks) {
        this.lastInventoryByPlayerId[snapshot.playerId] = snapshot;
        this.world.emit(EventType.INVENTORY_UPDATED, { ...snapshot });
        console.warn("[ClientNetwork] Optimistic inventory action timed out, rolling back");
      }
    }, 1000);
  }
}
```

**Callers** (simplified to one line):
```typescript
// InventoryActionDispatcher (eat/drop/bury)
network?.applyOptimisticRemoval(localPlayer.id, slot, 1);

// InventoryInteractionSystem (firemaking)
this.clientNetwork?.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Cleanup**:
```typescript
// ClientNetwork disconnect handler
if (this.inventoryPrunerInterval) {
  clearInterval(this.inventoryPrunerInterval);
  this.inventoryPrunerInterval = null;
}
this.inventoryTracker.clear();
```

**Impact**:
- Eliminates duplicate tracker instances (two timers, two listeners)
- Single source of truth for optimistic inventory mutations
- Reduced ~70 lines of boilerplate across callers
- Proper cleanup on disconnect (no leaked intervals)

#### Firemaking Optimistic Removal
**Change**: Added optimistic inventory removal for firemaking so logs disappear instantly.

**Implementation**:
```typescript
// InventoryInteractionSystem.ts
// Optimistic removal: remove the logs from the client inventory cache
// so the UI updates immediately (same pattern as eat/drop/bury in
// InventoryActionDispatcher). The server's authoritative inventoryUpdated
// packet will replace this cache within ~100-200ms.
this.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Impact**: Logs disappear from inventory immediately when firemaking starts, matching eat/drop/bury behavior.

#### Fire Model Asset Path Fix
**Change**: Corrected fire model path from `models/firemaking-fire/` to `models/misc/firemaking-fire/`.

**Files Changed**:
```typescript
// ProcessingSystem.ts
// Old (404 error)
const result = await modelCache.loadModel(
  "asset://models/firemaking-fire/firemaking-fire.glb",
  this.world
);

// New (correct path)
const result = await modelCache.loadModel(
  "asset://models/misc/firemaking-fire/firemaking-fire.glb",
  this.world
);
```

**Impact**: Eliminates 404 errors when spawning firemaking fires.

#### Targeting Mode UI Fixes
**Changes**:
- **Immediate Clear**: Targeting state clears immediately after target selection (no server round-trip wait)
- **Hover State**: Removed `isTargetingActive` from slot hover condition to prevent grey flash on all filled slots
- **System Registration**: Registered `InventoryInteractionSystem` on client for targeting support

**Implementation**:
```typescript
// InventoryPanel.tsx
if (targetingState.active && targetingState.sourceItem) {
  this.world.emit(EventType.TARGETING_SELECT, {
    targetType: "inventory_item",
    targetSlot: slotIndex,
  });
  // Clear targeting immediately — action is committed
  setTargetingState(initialTargetingState);
}

// DraggableInventorySlot - removed targeting from hover condition
const slotChrome = useMemo(
  () => getInteractiveTileStyle(theme, {
    active: isSourceItem,
    hovered: !isEmpty,  // Removed: && !isTargetingActive
    dragging: isDragging,
    dropTarget: isOver,
  }),
  [theme, isSourceItem, isEmpty, isDragging, isOver]  // Removed: isTargetingActive
);
```

**Impact**: 
- Targeting mode feels more responsive
- No stale highlights after target selection
- No grey flash on all filled slots when entering targeting mode

#### Panel Data Synchronization Fix
**Change**: Added `panelDataVersion` counter to break through React.memo barriers in `WindowRenderer`/`WindowItem`.

**Problem**: `WindowRenderer` and `WindowItem` are wrapped in `React.memo()`, which blocked prop updates when inventory/equipment/stats changed. The `renderPanel` function stayed stable (ref-based late binding), but panels never re-rendered with fresh data.

**Solution**:
```typescript
// InterfaceManager.tsx
const panelDataVersionRef = useRef(0);
const panelDataVersion = useMemo(() => {
  return ++panelDataVersionRef.current;
}, [inventory, coins, playerStats, equipment]);

// Pass to WindowRenderer
<WindowRenderer
  renderPanel={renderPanel}
  panelDataVersion={panelDataVersion}  // Breaks memo barrier
/>

// WindowItem - intentionally unused prop breaks React.memo
const WindowItem = memo(function WindowItem({
  windowId,
  isEditMode,
  windowCombiningEnabled,
  renderPanel,
  // Intentionally unused — its presence in props breaks React.memo's
  // shallow comparison when panel data changes, causing WindowItem to
  // re-render and call renderPanel with fresh ref-based data.
  panelDataVersion: _,
}: WindowItemProps): React.ReactElement {
  // ...
});
```

**Impact**:
- Inventory panels update in real-time when data changes
- Lightweight counter (number) breaks memo without forcing panel re-mount
- `renderPanel` stays stable (no unnecessary panel recreation)

**Files Changed**: 9 files, 149 additions, 171 deletions. See PR #1087 for complete details.

### Streaming Guardrails & Validation (March 2026)

**New Shared Module** (`packages/shared/src/utils/rendering/streamingGuardrails.ts`):

Centralized validation logic for streaming duel health, shared between client and server to prevent drift.

**Core Functions**:
```typescript
// Validate agent snapshot has required fields and sane values
export function hasValidStreamingGuardrailAgentSnapshot(
  agent: StreamingGuardrailAgentSnapshot | null | undefined
): boolean {
  if (!agent) return false;
  if (!agent.id || !agent.name) return false;
  if (typeof agent.hp !== "number" || typeof agent.maxHp !== "number") return false;
  if (agent.hp < 0 || agent.maxHp <= 0 || agent.hp > agent.maxHp) return false;
  return true;
}

// Check if phase requires arena positions
export function requiresArenaPositions(
  phase: StreamingGuardrailPhase | null
): boolean {
  return phase === "COUNTDOWN" || phase === "FIGHTING";
}

// Validate arena positions are sane (no overlaps, within bounds)
export function hasValidArenaPositions(
  positions: { agent1: [x,y,z], agent2: [x,y,z] } | null | undefined
): boolean {
  if (!positions) return false;
  const { agent1, agent2 } = positions;
  
  // Check both positions exist
  if (!Array.isArray(agent1) || !Array.isArray(agent2)) return false;
  if (agent1.length !== 3 || agent2.length !== 3) return false;
  
  // Check positions are not overlapping (same tile)
  const dx = Math.abs(agent1[0] - agent2[0]);
  const dz = Math.abs(agent1[2] - agent2[2]);
  if (dx < 1 && dz < 1) return false;  // Overlapping positions
  
  return true;
}

// Derive degraded reason or null if healthy
export function deriveStreamingGuardrailReason(params: {
  phase: StreamingGuardrailPhase | null;
  agent1: StreamingGuardrailAgentSnapshot | null;
  agent2: StreamingGuardrailAgentSnapshot | null;
  arenaPositions: { agent1: [x,y,z], agent2: [x,y,z] } | null | undefined;
}): string | null {
  const { phase, agent1, agent2, arenaPositions } = params;
  
  // IDLE phase is always healthy (no active duel)
  if (!phase || phase === "IDLE") return null;
  
  // Active phases require valid agents
  if (!hasValidStreamingGuardrailAgentSnapshot(agent1)) {
    return "agent1_invalid";
  }
  if (!hasValidStreamingGuardrailAgentSnapshot(agent2)) {
    return "agent2_invalid";
  }
  
  // COUNTDOWN and FIGHTING require valid arena positions
  if (requiresArenaPositions(phase)) {
    if (!hasValidArenaPositions(arenaPositions)) {
      return "arena_positions_invalid";
    }
  }
  
  return null;  // Healthy
}
```

**Usage on Client** (`packages/client/src/screens/StreamingMode.tsx`):
```typescript
import { deriveStreamingGuardrailReason } from "@hyperscape/shared";

const rendererHealth = deriveStreamingRendererHealth({
  // ... surface-level checks (connected, worldReady, etc.)
  
  // Streaming guardrails (shared validation)
  phase: streamingState?.cycle.phase ?? null,
  agent1: toGuardrailAgent(streamingState?.cycle.agent1),
  agent2: toGuardrailAgent(streamingState?.cycle.agent2),
  arenaPositions: streamingState?.cycle.arenaPositions,
});
```

**Usage on Server** (`packages/server/src/routes/streaming-betting-health.ts`):
```typescript
import { deriveStreamingGuardrailReason } from "@hyperscape/shared";

export function deriveBettingRendererHealth(
  cycle: StreamingCycleState | null
): RendererHealth {
  // ... external RTMP status, capture stats
  
  // Streaming guardrails (shared validation)
  const guardrailReason = deriveStreamingGuardrailReason({
    phase: cycle?.phase ?? null,
    agent1: toGuardrailAgent(cycle?.agent1),
    agent2: toGuardrailAgent(cycle?.agent2),
    arenaPositions: cycle?.arenaPositions,
  });
  
  return {
    ready: guardrailReason === null,
    degradedReason: guardrailReason,
    // ...
  };
}
```

**Impact**:
- Single source of truth for streaming health validation
- Client and server use identical logic (no drift)
- Prevents betting on degraded frames (overlapping agents, missing data, etc.)
- Shared types ensure consistency across packages

### Internal Bet Sync Feed & Renderer Health (March 20-23, 2026)

**Change** (PR #1065): Added authenticated internal betting sync API with renderer health monitoring.

**Problem**: Betting consumers (Hyperbet) were relying on delayed public spectator snapshots as the primary sync input, causing market state to drift from the actual streaming duel lifecycle. No visibility into renderer health meant betting could occur on degraded/loading frames.

**Solution**: Make Hyperscape the authoritative source for duel lifecycle events with sequence-aware SSE feeds and renderer health signals.

**New API Endpoints**:
```typescript
// Bootstrap endpoint - get current state + replay buffer
GET /api/internal/bet-sync/state
Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>

// SSE feed - real-time duel lifecycle events
GET /api/internal/bet-sync/events?since=<sequence>
Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>
// or (for EventSource which can't set headers)
GET /api/internal/bet-sync/events?streamToken=<token>&since=<sequence>
```

**Payload Structure**:
```typescript
interface BettingFeedPayload {
  seq: number;              // Monotonic sequence number
  sourceEpoch: number;      // Server start timestamp (for sequence continuity)
  emittedAt: number;        // Emission timestamp
  phaseVersion: number;     // Increments on phase transitions (idempotent dedup)
  cycle: {
    cycleId: string;
    phase: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
    agent1: AgentSnapshot;
    agent2: AgentSnapshot;
    arenaPositions: { agent1: [x,y,z], agent2: [x,y,z] };
    winnerId: string | null;
    winnerName: string | null;
    // ... full cycle state
  };
  rendererHealth: {
    ready: boolean;
    degradedReason: string | null;  // e.g., "loading_overlay_active", "arena_positions_invalid"
    updatedAt: number;
    phase: string | null;
  };
}
```

**Renderer Health Detection**:
```typescript
// Client-side globals (exposed for capture pipeline)
window.__HYPERSCAPE_STREAM_READY__: boolean
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__: {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}
window.__HYPERSCAPE_STREAM_BOOT_STATUS__: string | null  // "connecting" | "initializing" | "loading_assets" | "finalizing" | "error:*"
```

**Streaming Guardrails** (`packages/shared/src/utils/rendering/streamingGuardrails.ts`):
```typescript
export function deriveStreamingGuardrailReason(params: {
  phase: StreamingGuardrailPhase | null;
  agent1: StreamingGuardrailAgentSnapshot | null;
  agent2: StreamingGuardrailAgentSnapshot | null;
  arenaPositions: { agent1: [x,y,z], agent2: [x,y,z] } | null | undefined;
}): string | null {
  // Returns degraded reason or null if healthy
  // Checks: agent presence, HP validity, arena position sanity
}
```

**DuelBettingBridge Lifecycle** (`packages/server/src/systems/DuelScheduler/DuelBettingBridge.ts`):
```typescript
// Announcement → create or sync market
handleStreamingAnnouncement(data: { duelId, agent1, agent2 })
  → createOrSyncMarket() → solanaOperator.initRound()

// Fight Start → lock market (no new bets)
handleStreamingFightStart(data: { duelId })
  → lockMarket() → solanaOperator.lockMarket()

// Resolution → resolve market with outcome
handleStreamingResolution(data: { duelId, winnerId, loserId })
  → resolveMarket() → solanaOperator.resolveRound()

// Abort → clean up local state
handleStreamingAbort(data: { duelId })
  → deleteMarket() // Note: on-chain cancellation not yet supported
```

**Reconciliation Loop**:
```typescript
// Runs every 1s to ensure market state stays aligned with streaming lifecycle
private async reconcileLiveCycle(): Promise<void> {
  const scheduler = getStreamingDuelScheduler();
  const cycle = scheduler?.getCurrentCycle();
  
  // Create/sync market if in valid phase
  if (canCreateMarketForStreamingPhase(cycle.phase)) {
    await this.createOrSyncMarket(cycle);
  }
  
  // Resolve if in RESOLUTION phase
  if (cycle.phase === "RESOLUTION" && cycle.winnerId) {
    await this.resolveMarket(market, cycle);
  }
}
```

**Configuration**:
```bash
# Betting feed authentication
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Fallback to viewer token (temporary)
STREAMING_VIEWER_ACCESS_TOKEN=your-viewer-token

# CORS for betting consumers
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com

# SSE feed tuning
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
STREAMING_SSE_PUSH_INTERVAL_MS=500
STREAMING_SSE_MAX_PENDING_BYTES=1048576

# Capture browser security
CAPTURE_DISABLE_SANDBOX=false  # Only enable if required for Docker/CI

# Embed security (client)
PUBLIC_EMBED_ALLOWED_ORIGINS=https://embed.example.com,https://partner.example.com
```

**Embedded Auth Hardening** (`packages/client/src/lib/embeddedAuth.ts`):
```typescript
// Validates postMessage origins against explicit allowlist
export function resolveTrustedEmbedOrigins(params: {
  currentOrigin: string;
  publicAppUrl?: string | null;
  embedAllowedOrigins?: string | null;
}): string[]

// Rejects wildcard, null, and non-http(s) origins
export function isTrustedEmbedOrigin(
  eventOrigin: string,
  trustedOrigins: readonly string[]
): boolean

// Parses and validates HYPERSCAPE_AUTH bootstrap messages
export function parseHyperscapeAuthMessage(data: unknown): ParsedHyperscapeAuthMessage | null
```

**Streaming Access Token Management** (`packages/client/src/lib/streamingAccessToken.ts`):
```typescript
// Extracts token from URL hash (preferred) or query, scrubs from URL
export function resolveStreamingAccessTokenFromHref(href: string): {
  token: string | null;
  nextUrl: string | null;
}

// Primes token cache and scrubs URL before React mounts
export function primeStreamingAccessTokenFromWindow(window: Window): string | null

// Returns cached token (no re-parsing)
export function getStreamingAccessToken(): string | null
```

**Files Changed**:
- `packages/server/src/routes/streaming-betting-routes.ts` - NEW: Betting feed endpoints
- `packages/server/src/routes/streaming-betting-auth.ts` - NEW: Timing-safe token auth
- `packages/server/src/routes/streaming-betting-feed.ts` - NEW: Feed payload construction
- `packages/server/src/routes/streaming-betting-health.ts` - NEW: Renderer health derivation
- `packages/server/src/routes/streaming-external-status.ts` - NEW: External RTMP status parsing
- `packages/server/src/systems/DuelScheduler/DuelBettingBridge.ts` - Lifecycle management
- `packages/client/src/lib/embeddedAuth.ts` - NEW: Origin validation for embedded clients
- `packages/client/src/lib/streamingAccessToken.ts` - NEW: Token scrubbing and caching
- `packages/client/src/lib/streamingWindow.ts` - NEW: Window global types
- `packages/client/src/screens/StreamingMode.tsx` - Renderer health integration
- `packages/shared/src/utils/rendering/streamingGuardrails.ts` - NEW: Shared validation logic

**Impact**:
- Betting consumers have reliable, authoritative duel lifecycle feed
- Renderer health signals prevent betting on degraded frames
- Sequence-aware payloads enable idempotent deduplication
- Token scrubbing prevents leakage via browser history/referrer headers
- Origin validation prevents unauthorized embedded auth injection
- Capture browser hardening improves security posture

### Docker Build Improvements (March 18, 2026)

**Change** (PR #1033, Commit 7519105): Comprehensive Docker build improvements for multi-service deployment.

**Problems Fixed**:
1. **Missing Client Build**: Dockerfile was server-only but multi-service template uses same image for both app and web containers
2. **Bun Version Incompatibility**: Bun 1.1.38 couldn't run Vite 6+ builds
3. **Node Binary Missing**: `ensure-assets.mjs` was called with `node` but bun-only base image doesn't have node binary
4. **better-sqlite3 QEMU Crash**: Native build segfaults under QEMU cross-compilation
5. **Workspace Symlinks Destroyed**: Docker COPY flattens Bun workspace symlinks in `node_modules/@hyperscape/*`
6. **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root, packages have their own `node_modules/`

**Solutions**:
```dockerfile
# Builder stage
FROM oven/bun:1.3.10 AS builder  # Upgraded from 1.1.38

# Add packages/client to builder
COPY packages/client ./packages/client

# Use bun instead of node for ensure-assets
RUN bun run ensure-assets.mjs

# Remove better-sqlite3 from manifests before install
RUN find packages -name package.json -exec sed -i '/"better-sqlite3"/d' {} \\;

# Copy per-package node_modules from builder
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Restore workspace symlinks in runtime stage
RUN bun install --production
```

**Files Changed**:
- `Dockerfile.server` - Added client build, Bun 1.3.10, workspace symlink restoration
- `packages/*/package.json` - better-sqlite3 removed during Docker build

**Impact**: 
- Multi-service deployments now work correctly (app + web containers)
- Vite 6+ builds work in Docker
- Workspace packages resolve correctly at runtime
- No more QEMU segfaults from better-sqlite3
- Cleaner manifest files without unused dependencies

## Recent Major Features (March 2026)

### Docker Build Improvements (March 15, 2026)

**Change** (PR #1033, Commit 7519105): Comprehensive Docker build improvements for multi-service deployment.

**Problems Fixed**:
1. **Missing Client Build**: Dockerfile was server-only but multi-service template uses same image for both app and web containers
2. **Bun Version Incompatibility**: Bun 1.1.38 couldn't run Vite builds
3. **Node Binary Missing**: `ensure-assets.mjs` was called with `node` but bun-only base image doesn't have node binary
4. **better-sqlite3 QEMU Crash**: Native build segfaults under QEMU cross-compilation
5. **Workspace Symlinks Destroyed**: Docker COPY flattens Bun workspace symlinks to `packages/*`
6. **Bun 1.3 Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root

**Fixes**:
- **Client Build Added**: Added `packages/client` to builder and `packages/client/dist` to runtime
- **Bun Upgrade**: Updated both builder and runtime stages from 1.1.38 → 1.3.10
- **Node → Bun**: Changed `ensure-assets.mjs` to use `bun` instead of `node`
- **better-sqlite3 Removal**: Stripped from manifests before install (project uses bun:sqlite/PostgreSQL)
- **Workspace Symlinks Restored**: Manually recreated symlinks in runtime stage with `bun install --production`
- **Per-Package node_modules**: Explicitly copy package-specific node_modules from builder (three, dotenv, etc.)
- **Manifest Preservation**: Package manifests copied from builder to ensure cleaned manifests (better-sqlite3 removed)

**Dockerfile Changes**:
```dockerfile
# Builder stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS builder

# Build packages in correct order
WORKDIR /app/packages/physx-js-webidl
RUN bun run build || echo \"PhysX build skipped\"

WORKDIR /app/packages/shared
RUN bun run build

WORKDIR /app/packages/server
RUN bun run build

# Runtime stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS runtime

# Copy built artifacts from builder
COPY --from=builder /app/packages/physx-js-webidl/dist ./packages/physx-js-webidl/dist
COPY --from=builder /app/packages/shared/build ./packages/shared/build
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/plugin-hyperscape ./packages/plugin-hyperscape

# Copy manifests where server expects them
RUN mkdir -p ./packages/server/world/assets/manifests
COPY assets/manifests ./packages/server/world/assets/manifests

# Restore workspace symlinks (flattened by Docker COPY)
RUN bun install --production
```

**Files Changed**:
- `packages/server/Dockerfile` - Complete rewrite for multi-service support

**Impact**: 
- Docker images now support both server and client deployments
- Vite builds work correctly with Bun 1.3.10
- Workspace dependencies resolve correctly at runtime
- No more QEMU crashes from better-sqlite3
- Consistent manifest versions across deployments

### VRM Material Isolation Fix (March 17, 2026)

**Change** (PR #1061, Commit 364d0a5): Isolated VRM clone materials to prevent highlight bleed across mob instances.

**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type. When hovering over a goblin, all goblins in the world would highlight simultaneously.

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Implementation** (`packages/shared/src/rendering/materials/cloneGLB.ts`):
```typescript
// Clone material to prevent shared state across instances
// Textures are shared by reference (memory efficient)
// but outputNode and uniforms are per-instance
const clonedMaterial = new MeshStandardNodeMaterial();
clonedMaterial.copy(originalMaterial);
// ... copy all material properties
mesh.material = clonedMaterial;
```

**Files Changed**:
- `packages/shared/src/rendering/materials/cloneGLB.ts` - Added material cloning logic

**Impact**: 
- Each mob instance now has independent highlight state
- Hovering over one goblin no longer highlights all goblins
- Textures remain shared for memory efficiency
- Fixes visual bug where all VRM mobs of same type would highlight together

### Mob AI Tick Processing Fix (March 17, 2026)

**Change** (PR #1060, Commit a55079e): Wired mob AI tick processing into server tick loop to enable mob state machine transitions.

**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Implementation** (`packages/server/src/systems/ServerNetwork/index.ts`):
```typescript
// OSRS-ACCURATE: Process mob AI BEFORE mob movement each tick
// AI state machine (IDLE → WANDER → CHASE → ATTACK → RETURN) decides movement targets,
// then mob tile movement executes the path on the same tick.
// Without this, mobs stand idle forever because MobEntity.serverUpdate() defers
// AI ticking to the tick system for deterministic OSRS ordering.
const MOB_AI_DELTA_SECONDS = TICK_DURATION_MS / 1000;
this.tickSystem.onTick(() => {
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof MobEntity)) continue;
    if (entity.getHealth() <= 0) continue;
    entity.runAITick(MOB_AI_DELTA_SECONDS);
  }
}, TickPriority.MOVEMENT);

// Register mob tile movement to run on each tick (same priority as player movement)
// Runs AFTER mob AI so paths set by AI are executed this tick
this.tickSystem.onTick((tickNumber) => {
  this.mobTileMovementManager.onTick(tickNumber);
}, TickPriority.MOVEMENT);
```

**Files Changed**:
- `packages/server/src/systems/ServerNetwork/index.ts` - Added mob AI tick processing loop

**Impact**: 
- Mob AI state machines now function correctly
- Goblins and other mobs properly transition through IDLE → WANDER → CHASE → ATTACK states
- Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)
- Fixes mobs standing idle forever after spawn

### Dev Server Watcher CPU Fix (March 16, 2026)

**Change** (PR #1034, Commit 7b5bf08): Fixed dev server watcher burning 100% CPU when idle.

**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms — redundant since the script already debounces rebuilds itself
2. Polling fallback does a full recursive directory walk every 1s

**Fix** (`packages/server/scripts/dev.mjs`):
```javascript
// Removed awaitWriteFinish (redundant with existing 200ms debounce)
const watcher = chokidar.watch(watchRoots, {
  ignoreInitial: true,
  // awaitWriteFinish removed - script already debounces via setTimeout
});

// Increased polling fallback interval from 1s to 5s
async function startPollingFallback() {
  pollFallbackInterval = setInterval(() => {
    // ... scan for changes
  }, 5000); // Was 1000ms
}
```

**Files Changed**:
- `packages/server/scripts/dev.mjs` - Removed `awaitWriteFinish` config, increased polling interval

**Impact**: 
- Eliminates 100% CPU usage when dev server is idle
- Reduces unnecessary file system polling
- Better developer experience with lower resource consumption
- No impact on rebuild responsiveness (200ms debounce still active)

### Railway ENOTDIR Fix (March 13, 2026)

**Change** (Commit 511519d): Added fallback to `gameAssetsRoot` to prevent Fastify static ENOTDIR crash on Railway.

**Problem**: Railway deployments were crashing with ENOTDIR errors when Fastify tried to serve static assets from a path that wasn't a directory.

**Fix**: Added fallback logic in server initialization to use `gameAssetsRoot` when primary asset path is unavailable.

**Files Changed**:
- `packages/server/src/startup/http-server.ts` - Added fallback logic for asset path resolution

**Impact**: More reliable Railway deployments, eliminates ENOTDIR crashes on production servers.

### PM2 Log Tail Fix for Deployment (March 13, 2026)

**Change** (Commit c226be7): Replaced hanging `pm2 logs` command with direct `tail` for log dumping in deployment script.

**Problem**: `pm2 logs` command was hanging indefinitely during deployment error handling, preventing SSH session from closing and causing GitHub Actions to timeout after 30 minutes even though the deployment had already failed.

**Fix**: Replaced `bunx pm2 logs hyperscape-duel --lines 10000 --nostream` with direct OS-level log file access:
```bash
# Old (hangs indefinitely)
bunx pm2 logs hyperscape-duel --lines 10000 --nostream || true

# New (returns immediately)
tail -n 10000 /root/.pm2/logs/hyperscape-duel-error.log 2>/dev/null || true
tail -n 10000 /root/.pm2/logs/hyperscape-duel-out.log 2>/dev/null || true
```

**Files Changed**:
- `scripts/deploy-vast.sh` - Replaced PM2 logs command with direct tail

**Impact**: 
- Deployment failures now exit immediately with full error logs
- No more 30-minute SSH session hangs on deployment errors
- GitHub Actions workflows complete faster on failures
- Better debugging experience with immediate log access

### Chrome Beta for Linux WebGPU Support (March 13, 2026)

**Change** (Commit 154f0b6): Reverted from Chrome Canary back to Chrome Beta for Linux WebGPU streaming support.

**Problem**: Chrome Canary was experiencing instability issues on Linux NVIDIA GPUs. Chrome Beta provides better stability for production streaming.

**Fix**: Updated `scripts/deploy-vast.sh` to install `google-chrome-beta` instead of `google-chrome-unstable`:
```bash
# Install Chrome Beta channel (Required for WebGPU on Linux)
echo "[deploy] Installing Chrome Beta for WebGPU support..."
if ! command -v google-chrome-beta &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - || true
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update && apt-get install -y google-chrome-beta || true
fi
```

**Configuration**:
- **Linux NVIDIA**: Use Chrome Beta (`google-chrome-beta`) with Vulkan ANGLE backend
- **macOS**: Continue using stable Chrome with Metal ANGLE backend
- **Deployment**: `scripts/deploy-vast.sh` now installs Chrome Beta by default on Linux

**Impact**: More reliable WebGPU initialization on Linux NVIDIA GPUs, better production stability for streaming.

### Curl Timeout Configuration (March 13, 2026)

**Change** (Commit d37bbe3): Added `--max-time 10` timeout to all curl health check commands in deployment scripts.

**Problem**: Health check curl commands could hang indefinitely if services were unresponsive, causing deployment scripts to stall.

**Fix**: Added explicit 10-second timeout to all curl commands in `scripts/deploy-vast.sh`:
```bash
# Before
curl -fsS http://127.0.0.1:5555/health > /dev/null 2>&1

# After
curl -fsS --max-time 10 http://127.0.0.1:5555/health > /dev/null 2>&1
```

**Impact**: Deployment scripts fail fast when services are unresponsive, prevents indefinite hangs during health checks.

### SSH Keepalive & Maintenance Timeout (March 13, 2026)

**Change** (Commit fb0d154): Added strict SSH keepalive settings and reduced maintenance mode timeout for faster deployments.

**SSH Keepalive Configuration**:
- Added `ServerAliveInterval=15` and `ServerAliveCountMax=3` to SSH commands in `.github/workflows/deploy-vast.yml`
- Prevents SSH connection drops during long-running maintenance mode operations
- SSH will detect dead connections within 45 seconds (15s × 3 retries)

**Maintenance Mode Timeout**:
- Reduced timeout from 300 seconds (5 minutes) to 30 seconds
- Reduced curl timeout from 600 seconds to 30 seconds
- Faster deployment cycles when waiting for current duel to complete

**Configuration**:
```bash
# SSH keepalive flags
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3

# Maintenance mode API call
curl -X POST 'http://127.0.0.1:5555/admin/maintenance/enter' \
  -d '{"reason":"deployment","timeoutMs":30000}' \
  --max-time 30
```

**Impact**: More reliable SSH connections during deployments, faster deployment cycles, prevents connection drops during maintenance mode.

### OSRS-Accurate Movement Rotation (March 13, 2026)

**Change** (Commit 24ed839): Fixed player rotation to ignore combat target rotation while moving, restoring OSRS-accurate movement behavior.

**Problem**: Players were rotating to face their combat target even while moving, which differs from Old School RuneScape behavior where movement direction takes priority over combat facing.

**Fix**: Modified movement system to ignore combat rotation updates while the player is actively moving:
```typescript
// Movement rotation takes priority over combat rotation
if (isMoving) {
  // Ignore combat target rotation updates
  return;
}
```

**Impact**: 
- Movement feels more responsive and natural
- Matches OSRS behavior where players face their movement direction
- Combat rotation only applies when standing still
- Better player control during kiting and tactical movement

### Fresh Asset Fetching on Vast.ai Deploy (March 13, 2026)

**Change** (Commit ef42c3d): Force fresh asset download on every Vast.ai deployment to prevent stale biome manifests.

**Problem**: Vast.ai VM cache was persisting old `packages/server/world/assets` directory across deployments, causing stale biome manifests to be used even after CDN updates.

**Fix**: Added explicit asset cleanup in `scripts/deploy-vast.sh` before `bun install`:
```bash
# Clean up assets folder to forcefully redownload the latest biomes manifest over the VM cache.
rm -rf packages/server/world/assets
bun install
```

**Impact**: 
- Eliminates stale manifest issues on Vast.ai deployments
- Ensures latest biome configs are always used
- Fixes canyon biome errors from outdated manifests
- Forces fresh download from CDN on every deploy

### Docker Build Cache Invalidation (March 13, 2026)

**Change** (Commits a522949, 207fd8a): Prevent Docker build cache from storing old biomes.json and other manifest files.

**Problem**: Docker layer caching was preserving old manifest files across builds, causing production deployments to use stale biome configurations even after manifest updates.

**Fix**: Modified `packages/server/Dockerfile` to invalidate cache for manifest copy operations:
```dockerfile
# Create world directory structure and copy manifests where server expects them
RUN mkdir -p ./packages/server/world/assets/manifests

# Copy manifests (small JSON files needed for server-side logic)
# This layer is invalidated on every build to ensure fresh manifests
COPY assets/manifests ./packages/server/world/assets/manifests
```

**Additional Changes**:
- Added cache-busting comments to force rebuild of manifest layers
- Ensured `bun install --production` runs after manifest copy to restore workspace symlinks

**Impact**: 
- Docker images always contain latest manifest files
- Eliminates production errors from stale biome configs
- Consistent manifest versions across all deployment targets
- No manual cache clearing required

### PM2 Dump Path Fix (March 13, 2026)

**Change** (Commit 20cc492): Fixed PM2 error log path for remote dump functionality.

**Problem**: PM2 dump logs were not being saved to the correct path, making debugging difficult for production deployments.

**Fix**: Updated PM2 configuration to use correct error log path for remote dump operations.

**Impact**: Better debugging capabilities, proper log persistence for production deployments, easier troubleshooting of production issues.

### CDN Cache Busting & Manifest Reliability (March 13, 2026)

**Change** (Commits db6581f, 94e3a1d, ef42c3d): Added cache busting to CDN requests and manifest uploads to prevent stale asset issues.

**Problem**: Cloudflare R2 CDN was serving stale manifests and assets even after new versions were uploaded, causing clients to load outdated game data (items, NPCs, terrain configs, etc.). This was particularly problematic for canyon biome which relies on up-to-date manifest data.

**Solution**:
```typescript
// Client-side cache busting (packages/shared/src/data/DataManager.ts)
const cacheBuster = `?v=${Date.now()}`;
const manifestUrl = `${CDN_URL}/manifests/${filename}${cacheBuster}`;

// Server-side cache busting (scripts/upload-to-r2.sh)
aws s3 cp "manifests/${file}" "s3://${BUCKET}/manifests/${file}?v=$(date +%s)" \
  --endpoint-url "${ENDPOINT}" \
  --content-type "application/json"
```

**Deployment Workflow Improvements**:
- **Prevent Submodule Overwrite**: `scripts/upload-to-r2.sh` now skips `assets/manifests` directory during upload
- **Ensure Manifests Exist**: GitHub Actions runs `ensure-assets.mjs` before R2 upload
- **Removed Broken CORS Config**: R2 CORS is now configured via Cloudflare dashboard (removed failing CLI step)
- **Wrangler R2 Fix** (Commit 94e3a1d): Added `--remote` flag to `wrangler r2 object put` in `.github/workflows/deploy-cloudflare.yml` to target remote Cloudflare bucket instead of local
- **Vast.ai Asset Refresh** (Commit ef42c3d): Deployment script now forcefully removes cached `packages/server/world/assets` folder before `bun install` to ensure latest manifests are fetched from Git LFS
- **Docker Cache Invalidation** (Commits a52294, 207fd8a): Added cache-busting steps to prevent Docker build cache from storing stale `biomes.json` and other manifest files

**Files Changed**:
- `packages/shared/src/data/DataManager.ts` - Client-side cache busting
- `scripts/upload-to-r2.sh` - Server-side cache busting and submodule skip
- `.github/workflows/deploy-r2.yml` - Added ensure-assets step
- `.github/workflows/deploy-cloudflare.yml` - Added `--remote` flag to wrangler
- `scripts/deploy-vast.sh` - Force fresh asset fetch with `rm -rf packages/server/world/assets`
- `Dockerfile.server` - Added `rm -rf packages/server/world/assets` before `ensure-assets.mjs`

**Impact**: 
- Eliminates stale manifest issues across all deployment targets (Railway, Vast.ai, Cloudflare)
- Ensures clients always fetch latest game data
- Prevents canyon biome errors from outdated manifests
- No manual CDN cache purging required
- Docker builds always use fresh manifests from Git LFS

### Manifest Embedding in Docker (March 13, 2026)

**Change** (Commit efa8021): Server Docker image now embeds manifests to bypass CDN and fix canyon biome errors.

**Problem**: Server was fetching manifests from CDN at runtime, which could fail if CDN was unavailable or manifests were stale. Canyon biome was failing due to missing manifest data.

**Fix**: 
- Manifests are now embedded directly in the Docker image at build time
- Server reads manifests from local filesystem instead of CDN
- Ensures manifests are always available and match the deployed code version

**Files Changed**:
- `Dockerfile.server` - Added COPY step for manifests from builder stage
- Server reads from `packages/server/world/assets/manifests/` (embedded in image)

**Docker Build Process**:
```dockerfile
# Builder stage
RUN node scripts/ensure-assets.mjs  # Fetch manifests
COPY --from=builder /app/packages/server/world ./packages/server/world  # Runtime stage
```

**Impact**: More reliable server startup, eliminates CDN dependency for manifests, fixes canyon biome loading errors.

### Workbox Service Worker Fix (March 13, 2026)

**Change** (Commit 9312a96): Inline workbox runtime to prevent MIME type errors on PWA update.

**Problem**: Service worker was failing to update due to MIME type errors when loading workbox runtime from external CDN.

**Fix**: Workbox runtime is now inlined directly into the service worker bundle instead of being loaded from external source.

**Files Changed**:
- `packages/client/vite.config.ts` - Updated Workbox plugin configuration

**Configuration**:
```typescript
// packages/client/vite.config.ts
workbox: {
  inlineWorkboxRuntime: true,  // Inline instead of loading from CDN
  // ... rest of config
}
```

**Impact**: Eliminates service worker update failures, more reliable PWA updates, better offline support.

### Tree Shader Lighting Fix (March 12, 2026)

**Change** (PR #1022): Fixed tree lighting to use vertex sphere normals instead of normal maps.

**Problem**: Tree models have sphere normals baked into the vertex normal attribute for volumetric foliage shading, but the shader was using `normalWorld` which goes through the TSL normal map pipeline, ignoring the correct vertex data.

**Solution**:
```typescript
// packages/shared/src/systems/shared/world/GPUMaterials.ts
// Old (incorrect - uses normal map pipeline)
const N = normalize(normalWorld);

// New (correct - uses vertex sphere normals)
const N = normalize(mul(modelNormalMatrix, normalLocal));
```

**Night Lighting Improvements**:
- Uniform `nightDim` multiplier maintains consistent ~1.35x lit-to-shadow ratio
- SSS (subsurface scattering), edge brightening, and saturation boost scale with `dayFactor`
- Night foliage stays muted and cool-toned
- Eliminates 4.8x contrast variance between day and night

**Impact**: Correct volumetric foliage lighting, consistent tree appearance across day/night cycle.

### Biome Terrain Generation & Quadtree LOD (March 12, 2026)

**Change** (PR #1018): Merged biome-based terrain generation with hierarchical quadtree LOD system.

#### TerrainQuadTree
Hierarchical LOD system for infinite terrain rendering:
- **Dynamic Splitting**: Chunks split/unsplit based on camera distance
- **LOD Levels**: 5 levels (depth 0-4), from 1600m root chunks to 100m leaf chunks
- **Uniform Resolution**: 32x32 vertices per chunk at all LOD levels
- **Skirt Geometry**: 15m drop to hide LOD seams
- **Client-Only**: Visual system only - server still uses flat 100m tile grid

**Configuration** (`packages/shared/src/systems/shared/world/TerrainQuadTree.ts`):
```typescript
{
  minSize: 100,           // Smallest chunk (matches TILE_SIZE)
  maxDepth: 4,            // Max subdivision depth
  splitRatio: 1.5,        // Split when distance < size * splitRatio
  unsplitMultiplier: 1.2, // Prevents thrashing at LOD boundaries
  resolution: 32,         // Uniform vertex resolution
  skirtDrop: 15,          // Skirt depth in meters
}
```

**Performance Optimizations**:
- Numeric grid coordinates instead of string keys (eliminates per-frame string allocation)
- Structural dirty flag to skip neighbor resolution when tree is stable
- Lazy terrain generation (only when all 4 neighbors are resolved)

#### GLBTreeBatchedInstancer
Multi-variant tree rendering with BatchedMesh:
- **One BatchedMesh per material slot per LOD** - minimal draw calls
- **Texture Fingerprinting**: Automatic material slot matching across variants
- **LOD Switching**: Smooth transitions between LOD0/LOD1/LOD2 based on distance
- **Depleted State**: Separate geometry for chopped trees (stumps)
- **Highlight Support**: Per-instance color tinting for interaction feedback

**Key Features**:
- Supports trees with multiple model variants (e.g., oak_tree_1.glb, oak_tree_2.glb)
- Deterministic fingerprinting prevents silent variant matching failures
- Hysteresis on LOD transitions (0.81x multiplier) prevents flickering

**Usage**:
```typescript
await addInstance(
  'oak',                    // Tree type
  ['oak_1.glb', 'oak_2.glb'], // Variant paths
  0,                        // Variant index
  entityId,
  position,
  rotation,
  scale,
  'oak_stump.glb',         // Depleted model (optional)
  0.8                       // Depleted scale (optional)
);
```

#### Biome System
Terrain generation now uses biome-specific parameters:
- **3 Biomes**: Forest, Canyon, Tundra (defined in `TerrainBiomeTypes.ts`)
- **2 Landscape Types**: Mountain, Pond (defined in `TerrainHeightParams.ts`)
- **Per-Biome Tree Distribution**: Each biome has unique tree types, densities, and placement rules
- **TreeId Enum**: Centralized tree type identifiers replacing magic strings
- **Batched Entity Spawning**: Reduces network overhead by batching all entities for a tile into single packet

**Files**:
- `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts` - Biome definitions and per-biome tree configs
- `packages/shared/src/systems/shared/world/TerrainHeightParams.ts` - Landscape feature definitions
- `packages/shared/src/systems/shared/world/BiomeResourceGenerator.ts` - Resource placement logic
- `packages/shared/src/constants/TreeTypes.ts` - TreeId enum (single source of truth for tree type identifiers)

**TreeId Enum Pattern**:
All tree types are now defined using the `TreeId` enum instead of magic strings:
```typescript
// packages/shared/src/constants/TreeTypes.ts
export enum TreeId {
  Oak = "tree_oak",
  Willow = "tree_willow",
  Maple = "tree_maple",
  // ... etc
}

// Usage in biome configs
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  trees: {
    [TreeId.Oak]: { weight: 20, maxHeight: 30 },
    [TreeId.Maple]: { weight: 40, maxHeight: 30 },
  },
  // ...
};
```

**Tree Placement Rules**:
Each tree type can have biome-specific placement constraints:
- `weight` - Relative spawn probability (higher = more common)
- `minHeight` / `maxHeight` - Elevation constraints (world units)
- `waterAffinity` - Preference for water-adjacent placement (0-1, where 1 = only spawns near water)
- `waterProximityHeight` - Max height above water to consider "near water" (meters)
- `avoidsWaterBelow` - Reject placement if below this height above water threshold (meters)
- `maxSlope` - Maximum terrain slope for placement (gradient, e.g., 1.5 = 56° max slope)

**Example Biome Config** (from `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`):
```typescript
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Knotwood]: { weight: 40, maxHeight: 30 },
    [TreeId.Oak]: { weight: 20, maxHeight: 30 },
    [TreeId.Birch]: { weight: 20, maxHeight: 30 },
    [TreeId.Maple]: { weight: 40, maxHeight: 30 },
    [TreeId.Fir]: { weight: 15, maxHeight: 30 },
    [TreeId.Pine]: { weight: 15, maxHeight: 30 },
    [TreeId.ChinaPine]: { weight: 15, minHeight: 30, maxHeight: 60 },
    [TreeId.Bamboo]: { weight: 15, minHeight: 35 },
  },
  density: 15,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [0.8, 1.2],
  maxSlope: 1.5,
};

const CANYON_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Cactus]: { weight: 20, avoidsWaterBelow: 3 },
    [TreeId.Dead]: { weight: 20, minHeight: 20 },
    [TreeId.Palm]: {
      weight: 20,
      waterAffinity: 0.3,
      waterProximityHeight: 9,
      maxHeight: 15,
    },
    [TreeId.Coconut]: {
      weight: 10,
      waterAffinity: 0.6,
      waterProximityHeight: 9,
      maxHeight: 15,
    },
  },
  density: 15,
  minSpacing: 18,
  clustering: false,
  scaleVariation: [0.7, 1.3],
  maxSlope: 2.0,
};

const TUNDRA_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.WindPine]: { weight: 40, minHeight: 15 },
    [TreeId.Fir]: { weight: 30, minHeight: 10 },
    [TreeId.Pine]: { weight: 25, minHeight: 8 },
    [TreeId.Birch]: { weight: 10 },
  },
  density: 10,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [0.6, 1.0],
  maxSlope: 1.5,
};
```

**Impact**: Infinite terrain rendering with dynamic LOD, biome-specific visuals, improved performance through reduced draw calls and smarter chunk management.

### Admin Live Controls & Maintenance Mode (March 12, 2026)

**Change** (PR #1015): Added admin dashboard with live controls, maintenance mode, and log streaming.

#### Maintenance Mode System
Graceful server pause/resume for zero-downtime deployments:
- **Endpoints**:
  - `POST /admin/maintenance/enter` - Pause game after current duel
  - `POST /admin/maintenance/exit` - Resume game
  - `GET /admin/maintenance/status` - Check maintenance state
- **Safe-to-Deploy Flag**: Prevents restarts during active duels
- **Market Pause**: Automatically pauses betting markets during maintenance

**Implementation**:
```typescript
// packages/server/src/startup/maintenance-mode.ts
export interface MaintenanceState {
  active: boolean;
  enteredAt: number | null;
  reason: string | null;
  safeToDeploy: boolean;
  currentPhase: string | null;
  marketStatus: string;
  pendingMarkets: number;
}
```

#### Live Controls Dashboard
Real-time admin panel (`packages/client/src/screens/AdminLiveControls.tsx`):
- **HLS Stream Preview**: Embedded video player for live stream monitoring
- **Server Controls**: Pause/resume game, restart process
- **Live Logs**: 1000-entry ring buffer with auto-refresh (3s interval)
- **Status Display**: Maintenance state, viewer count, current phase

**CSS Layout Improvements** (PR #1019):
- Fixed scrolling issues in admin panels with proper flexbox layout
- Added `overflow: hidden` on `.admin-content` with `overflow-y: auto` on inner containers
- Proper `min-height: 0` overrides for nested flex containers to enable scroll containment
- Eliminated layout thrashing and scroll conflicts in admin dashboard

**Admin API Endpoints**:
- `GET /admin/logs` - Fetch recent server logs from in-memory ring buffer
- `POST /admin/restart` - Restart server process (requires PM2)
- `GET /admin/duels/status` - Get current duel cycle status

#### Maintenance Banner
Client-side warning banner (`packages/client/src/components/common/MaintenanceBanner.tsx`):
- Polls `/health` endpoint every 5s
- Displays red banner when `maintenanceMode: true`
- Visible across all client screens (game, admin, leaderboard, etc.)

#### Logger Ring Buffer
In-memory log storage (`packages/server/src/systems/ServerNetwork/services/Logger.ts`):
- **Capacity**: 1000 most recent log entries
- **Levels**: DEBUG, INFO, WARN, ERROR
- **Structure**: `{ timestamp, level, system, message, data }`
- **API**: `GET /admin/logs` returns full buffer

**Configuration**:
```bash
# ecosystem.config.cjs
ORACLE_SETTLEMENT_DELAY_MS=7000  # Delay oracle publish to sync with stream
```

**Impact**: Zero-downtime deployments, better operational visibility, safer server restarts.

### Oracle Settlement Delay & Stream Sync (March 12, 2026)

**Change** (Commit 38c8c89): Added configurable settlement delay to sync oracle publishing with stream delivery.

**Problem**: Oracle was publishing duel outcomes immediately after resolution, but stream viewers were still watching the duel (7-10s behind live).

**Solution**: 
- Added `settlementDelayMs` to `DuelArenaOracleConfig`
- Default: 7000ms (7 seconds)
- Delays `publishAcrossTargets()` call after duel resolution

**Configuration**:
```bash
# ecosystem.config.cjs or .env
ORACLE_SETTLEMENT_DELAY_MS=7000  # Match typical stream latency
```

**Code**:
```typescript
// packages/server/src/oracle/DuelArenaOraclePublisher.ts
if (this.config.settlementDelayMs > 0) {
  await new Promise((resolve) =>
    setTimeout(resolve, this.config.settlementDelayMs),
  );
}
await this.publishAcrossTargets(existing, "RESOLVE");
```

**Impact**: Stream viewers see duel outcome before oracle publishes, better UX for betting/spectating.

### Agent Autonomous Behavior Restoration (March 12, 2026)

**Change** (Commit 82a5365): Fixed agent T-pose and re-enabled autonomous behavior between duels.

**Fixes**:
- **Physics Null Guards**: Added null checks in `RigidBody.ts` and `Collider.ts` for stream mode viewports where physics system is removed
- **Autonomous Behavior**: Re-enabled mining, chopping, fishing for duel bot agents between duels (was suppressed)
- **Post-Duel Roaming**: Relaxed restore position from 120-unit lobby radius to 2000-unit world boundary
- **Model Provider Diversity**: Switched from ElizaCloud to direct Anthropic/Groq providers (PR #1018)
  - Interleaved provider selection ensures diversity (Anthropic → Groq → Anthropic → Groq...)
  - Models: Claude Sonnet 4.6, Llama 4 Scout, Claude Opus 4.6, Llama 4 Maverick, Claude Haiku 4.5, Llama 3.3 70B, Kimi K2, Qwen 3 30B
  - Updated `@elizaos/plugin-elizacloud` to `alpha` tag for compatibility
- **Bank State Request**: Request bank state on player spawn so goal planner has item data

**Code Changes**:
```typescript
// packages/shared/src/nodes/RigidBody.ts
if (!this.world.physics) return; // Null guard for stream mode

// packages/server/src/eliza/ElizaDuelBot.ts
// Removed dedicatedDuelBot gates that killed all open-world autonomy
// shouldRunOpenWorldAutonomy() now always returns true

// packages/plugin-hyperscape/src/services/HyperscapeService.ts
private shouldRunOpenWorldAutonomy(): boolean {
  // Duel bots should perform autonomous activities (mining, chopping, fishing)
  // between duels to make the world feel alive
  return true;
}
```

**Impact**: Agents now behave naturally between duels, no more T-pose in stream mode, better goal planning with bank awareness.

### Streaming Pipeline Improvements (March 10-12, 2026)

**Frame Pacing Fix** (Commits 522fe37, e2c9fbf):
- **Problem**: CDP screencast delivering ~60fps to FFmpeg expecting 30fps, causing buffer buildup
- **Fix**: Reverted `everyNthFrame` to 1 (Xvfb compositor runs at 30fps, not 60fps)
- **Resolution**: Default changed from 1920x1080→1280x720 to match capture viewport
- **Impact**: Eliminates stream buffering, smoother playback

**GOP Size Change** (Commit 38c8c89):
- Changed from 30→60 frames (1s→2s at 30fps)
- Recommended by Twitch/YouTube for stability
- Tradeoff: Increased tune-in latency for better stream stability

**RTMP Muxer** (Commit 38c8c89):
- Changed from `flv` to `fifo` muxer
- `drop_pkts_on_overflow=1` absorbs network stalls without blocking encoder
- Better resilience to network jitter

**Configuration**:
```bash
# ecosystem.config.cjs
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_MODE=cdp          # CDP (default) or webcodecs
STREAM_CAPTURE_ANGLE=vulkan      # ANGLE backend (vulkan, metal, default)
```

### Solana Oracle IDL Type Formatting (March 13, 2026)

**Change** (Commits in `packages/duel-oracle-solana/src/generated/`): Reformatted Solana oracle IDL types from JSON-style to TypeScript-style object literals.

**Technical Details**:
```typescript
// Old (JSON-style)
export const FIGHT_ORACLE_IDL = {
  "address": "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  "metadata": {
    "name": "fight_oracle",
    // ...
  }
}

// New (TypeScript-style)
export const FIGHT_ORACLE_IDL = {
  address: "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  metadata: {
    name: "fight_oracle",
    // ...
  }
} as const;
```

**Files Changed**:
- `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`
- `packages/duel-oracle-solana/src/generated/fightOracleTypes.ts`
- `packages/duel-oracle-solana/src/generated/fight_oracle.ts`

**Impact**: Better TypeScript type inference, cleaner code style, improved IDE autocomplete, no functional changes.

### Solana Oracle Error Handling Improvements (March 12, 2026)

**Change** (PR #1019): Enhanced Solana transaction error messages with detailed log extraction.

**Problem**: Solana `SendTransactionError` messages were unhelpful, showing generic "Catch the `SendTransactionError` and call `getLogs()` on it for full details" instead of actual error details.

**Solution**:
```typescript
// packages/server/src/oracle/DuelArenaOraclePublisher.ts
if (error && typeof error === "object" && "logs" in error) {
  const logs = (error as any).logs;
  if (Array.isArray(logs)) {
    // Strip unhelpful boilerplate
    errorMessage = errorMessage
      .replace(/Catch the `SendTransactionError`.*$/g, "")
      .trim();
    
    // Append actual transaction logs
    const logsStr = logs.join("\\n  ");
    errorMessage = `${errorMessage}\\nTransaction Logs:\\n  ${logsStr}`;
    
    // Detect common errors
    if (logsStr.includes("insufficient lamports")) {
      errorMessage = `Insufficient SOL to pay for transaction rent or fees.\\n${errorMessage}`;
    }
  }
}
```

**Impact**: Significantly improved debuggability for Solana oracle failures, clearer error messages for insufficient SOL and other transaction failures.

### Deployment Fixes (March 11-13, 2026)

**Docker Workspace Symlinks** (Commit 7f1af94):
- **Problem**: Docker COPY flattens workspace symlinks, breaking runtime module resolution for externalized packages
- **Fix**: Added `bun install --production` in Docker runtime stage to restore symlinks
- **Impact**: Server can resolve @hyperscape/* workspace packages in production Docker deployments

**SSH Timeout Fix** (Commit a65a308):
- **Problem**: Background processes (Xvfb, socat) keeping SSH session open, causing 30-minute hangs
- **Fix**: Added `disown` after each background process in `scripts/deploy-vast.sh`
- **Impact**: Deployment completes in ~1 minute instead of hanging for 30 minutes

**Orphaned Process Cleanup** (Commit 9e6f5bb):
- **Problem**: PM2 `kill` failing to terminate orphaned bun child processes, causing database deadlocks
- **Fix**: Added explicit `pkill` commands before deployment:
  ```bash
  pkill -f "bun.*packages/server.*dist/index.js" || true
  pkill -f "bun.*packages/server.*start" || true
  pkill -f "bun.*dev-duel.mjs" || true
  pkill -f "bun.*preview.*3333" || true
  ```
- **Impact**: Eliminates database connection deadlocks from ghost game servers

**Docker Workspace Symlinks** (Commit 7f1af94):
- **Problem**: Docker COPY flattens workspace symlinks, breaking runtime module resolution
- **Fix**: Added `bun install --production` in Docker runtime stage to restore symlinks
- **Impact**: Server can resolve externalized workspace packages (@hyperscape/decimation, @hyperscape/impostors, etc.)

### Test Infrastructure Updates (March 11-12, 2026)

**CI Exclusions** (Commits cd253d5, 754dea2):
- Excluded `@hyperscape/impostor` from headless CI test runs (requires WebGPU)
- Increased `sim-engine` guarded MEV fee sweep test timeout from 60s to 120s
- Fixed cyclic dependencies and port conflicts
- Fixed biome config loading in tests

**Test Mock Refactoring** (PR #1019):
- **DuelBot.test.ts**: Replaced `vi.hoisted()` + `vi.mock()` with `vi.spyOn()` pattern to avoid Bun hoisting issues
- **DuelMatchmaker.test.ts**: Removed 60-line `MockDuelBot` class, now uses real `DuelBot` (aligns with "NO MOCKS" philosophy)
- **EquipmentVisualSystem.test.ts**: Changed to `vi.spyOn()` with fallback to real `getItem()` data
- **MobRightClickAttack.test.ts**: Added proper window mock cleanup with try/finally guards
- **GravestoneLootSystem.test.ts**: Namespaced test items with `grave_` prefix to avoid registry collisions

**Testing Strategy**:
- WebGPU-dependent packages (`impostor`, `client`) require local testing with GPU-enabled browsers
- Headless CI focuses on server-side logic, data processing, and non-rendering systems
- Full integration tests run locally or on GPU-enabled CI runners (not GitHub Actions)
- Prefer real implementations over mocks (use `vi.spyOn()` with fallbacks instead of full mocks)

**Test Improvements** (PR #1019):
- **DuelBot.test.ts**: Replaced `vi.hoisted()` + `vi.mock()` with `vi.spyOn()` to avoid Bun hoisting issues
- **DuelMatchmaker.test.ts**: Removed 60-line `MockDuelBot` class, now uses real `DuelBot` (aligns with "NO MOCKS" philosophy)
- **EquipmentVisualSystem.test.ts**: Changed to `vi.spyOn()` with fallback to real `getItem()` data
- **MobRightClickAttack.test.ts**: Added proper window mock cleanup with try/finally guards
- **GravestoneLootSystem.test.ts**: Namespaced test items with `grave_` prefix to avoid registry collisions
- **BiomeSystem Tests**: Updated to use explicit biome definitions instead of hardcoded `DEFAULT_BIOMES`

### TensorFlow.js Import Path Fix (March 2026)

**Change** (PR #1064): Fixed hand pose detection import to use explicit `/dist/index.js` path.

**Problem**: TensorFlow.js hand pose detection module wasn't resolving correctly, causing import errors in asset-forge.

**Fix**:
```typescript
// packages/asset-forge/src/services/hand-rigging/HandPoseDetectionService.ts

// Old (ambiguous module resolution)
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";

// New (explicit dist path)
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection/dist/index.js";
```

**Files Changed**:
- `packages/asset-forge/src/services/hand-rigging/HandPoseDetectionService.ts` - Explicit import path

**Impact**:
- Hand pose detection service loads correctly
- Asset-forge hand rigging tools work as expected
- Eliminates module resolution errors

### Vite 8 Polyfill Migration (March 2026)

**Change** (PR #1064): Removed `vite-plugin-node-polyfills` and manually inject Buffer global for Vite 8 compatibility.

**Problem**: Vite 8 is incompatible with `vite-plugin-node-polyfills`. Solana libraries and crypto dependencies require `Buffer` global.

**Solution**: Manual Buffer injection in `packages/client/src/polyfills/buffer-shim.ts`:
```typescript
import { Buffer } from "buffer";

// Inject Buffer global for libraries that expect it (Solana, crypto, bn.js)
// Previously handled by vite-plugin-node-polyfills, which is incompatible with Vite 8
(globalThis as Record<string, unknown>).Buffer = Buffer;

export default Buffer;
```

**Vite Config Changes** (`packages/client/vite.config.ts`):
```typescript
// REMOVED: vite-plugin-node-polyfills plugin
// REMOVED: nodePolyfills({ include: ["buffer"], globals: { Buffer: true } })
// REMOVED: Alias paths for vite-plugin-node-polyfills shims

// ADDED: Manual chunk splitting function (Rolldown requires function, not object)
manualChunks(id: string) {
  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
    return "vendor-react";
  }
  if (id.includes("node_modules/three/")) {
    return "vendor-three";
  }
  if (id.includes("node_modules/lucide-react")) {
    return "vendor-ui";
  }
}
```

**Files Changed**:
- `packages/client/src/polyfills/buffer-shim.ts` - Added manual Buffer injection
- `packages/client/vite.config.ts` - Removed node-polyfills plugin, updated chunk splitting
- `packages/client/package.json` - Removed `vite-plugin-node-polyfills` dependency

**Impact**:
- Compatible with Vite 8 (Rolldown bundler)
- Solana and crypto libraries work correctly
- Smaller bundle size (no unused polyfills)
- Manual control over polyfill injection

### Dependency Updates & Migration Guide (March 10-19, 2026)

**📖 Complete Migration Guide**: See [`docs/migration-march-2026.md`](../docs/migration-march-2026.md) for detailed migration steps, code examples, and troubleshooting.

**Major Updates**:
- **Vite**: 6.4.1 → 8.0.0 (MAJOR - build tool upgrade)
  - **Breaking**: New plugin API, updated config schema
  - **Migration**: Update `vite.config.ts` for Vite 8 plugin API
  - **Impact**: Faster builds, improved HMR, better tree-shaking
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1 (MAJOR - React plugin upgrade)
  - **Breaking**: New Fast Refresh implementation
  - **Migration**: Update plugin configuration in `vite.config.ts`
  - **Impact**: Better React 19 compatibility with new Fast Refresh implementation
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)
  - **Impact**: Updated TypeScript definitions matching Three.js 0.183.2
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (test coverage tooling)
  - **Impact**: Enhanced test coverage reporting with Vitest 4.1
- **jsdom**: 28.1.0 → 29.0.0 (MAJOR - testing environment)
  - **Impact**: Updated testing environment with jsdom 29.x
- **jest**: 29.7.0 → 30.3.0 (MAJOR - testing framework)
  - **Impact**: Updated testing framework with Jest 30.x
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6 (MAJOR - Hardhat plugin)
  - **Breaking**: New ethers.js v6 integration
  - **Migration**: Update contract deployment scripts for ethers v6 API
  - **Impact**: Improved smart contract tooling
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support)
  - **Impact**: Latest VRM avatar features and improvements
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (Solana mobile wallet)
  - **Impact**: Improved mobile wallet support for Solana
- **sqlite3**: 5.1.7 → 6.0.1 (SQLite database driver)
  - **Impact**: SQLite 6.x with performance improvements and bug fixes

**Impact Summary**:
- Latest build tooling with improved performance and faster builds
- Better React 19 compatibility with new Fast Refresh implementation
- Updated testing environment with Jest 30.x and jsdom 29.x
- Latest VRM avatar features and improvements
- Improved mobile wallet support for Solana
- Updated TypeScript definitions matching Three.js 0.183.2
- Enhanced test coverage reporting with Vitest 4.1
- SQLite 6.x with performance improvements and bug fixes

### Manifest Loading Fixes (March 10, 2026)

**Change** (Commit c0898fa): Fixed legacy manifest entries that 404 on CDN.

**Removed** (never existed):
- `items.json` (items are split into category files: `items/weapons.json`, `items/armor.json`, etc.)
- `resources.json`

**Added** (missing manifests):
- `ammunition.json`
- `combat-spells.json`
- `duel-arenas.json`
- `lod-settings.json`
- `quests.json`
- `runes.json`

**Impact**: Eliminates 404 errors during manifest loading, ensures all current manifests are properly fetched.

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

**Exception**: WebGPU-dependent tests (`@hyperscape/impostor`, `@hyperscape/client`) are excluded from headless CI and must run locally with GPU-enabled browsers.

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
| 4001 | ElizaOS API | `ELIZA_PORT` | `bun run dev:ai` |
| 5555 | Game Server (HTTP) | `PORT` | `bun run dev` |
| 5556 | Game WebSocket (uWS) | `UWS_PORT` | `bun run dev` (when `UWS_ENABLED=true`) |
| 8080 | Asset CDN | `CDN_PORT` | `bun run cdn:up` |
| 8765 | RTMP Bridge | `RTMP_BRIDGE_PORT` | `bun run duel` |
| 4180 | Spectator Server | `SPECTATOR_PORT` | `bun run duel` |

**Note**: As of March 2026, the game uses **dual WebSocket ports**:
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints
- **Port 5556** (uWebSockets.js): Game WebSocket traffic (default, can be disabled with `UWS_ENABLED=false`)

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Secret handling is non-negotiable**:
- Real private keys and API tokens must come from local untracked `.env` files
- Tracked files may only contain placeholders and variable names
- If you find a real credential in a tracked file, remove it and move it to `.env` or the deployment secret store immediately

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
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
ORACLE_SETTLEMENT_DELAY_MS=7000  # Oracle publish delay (stream sync)

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
PUBLIC_CDN_URL=https://...       # Asset CDN URL

# Streaming (ecosystem.config.cjs)
STREAM_CAPTURE_MODE=cdp          # CDP (default) or webcodecs
STREAM_CAPTURE_WIDTH=1280        # Capture resolution
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_ANGLE=vulkan      # ANGLE backend (vulkan, metal, default)
RTMP_BRIDGE_PORT=8765            # RTMP bridge WebSocket port
SPECTATOR_PORT=4180              # Spectator server port
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server
- `PUBLIC_CDN_URL` must point to your asset hosting

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

**IMPORTANT**: The **server runtime** uses **Node.js 22+** (not Bun) as of March 2026. See [Server Runtime Migration](#server-runtime-migration-march-2026) for details.

## Tech Stack

- **Runtime**: 
  - **Client/Build**: Bun v1.3.10+ (upgraded from 1.1.38 for Vite 6+ compatibility)
  - **Server**: Node.js 22+ (migrated from Bun for V8 incremental GC - see [Server Runtime Migration](#server-runtime-migration-march-2026))
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify (HTTP), uWebSockets.js (game WebSocket), LiveKit (voice)
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **Polyfills**: Manual Buffer injection (Vite 8 removed vite-plugin-node-polyfills)
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

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
lsof -ti:8080 | xargs kill -9  # Asset CDN
lsof -ti:4001 | xargs kill -9  # ElizaOS API
lsof -ti:8765 | xargs kill -9  # RTMP Bridge
lsof -ti:4180 | xargs kill -9  # Spectator Server
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)
- WebGPU-dependent tests (`@hyperscape/impostor`, `@hyperscape/client`) must run locally with GPU

### Streaming Issues

**Stream buffering / lag**:
- Check `STREAM_CAPTURE_WIDTH` and `STREAM_CAPTURE_HEIGHT` match (default 1280x720)
- Verify Xvfb is running at 30fps (no vsync)
- Ensure `everyNthFrame: 1` in CDP screencast config

**WebGPU initialization fails**:
- Verify `gpu_display_active=true` on Vast.ai instance
- Check Chrome Beta is installed: `google-chrome-beta --version` (required as of March 13, 2026)
- Verify ANGLE backend: `STREAM_CAPTURE_ANGLE=vulkan` on Linux NVIDIA
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment variable: `echo $DISPLAY` (should be `:99`)
- Verify curl health checks have `--max-time 10` timeout

**Orphaned processes after deployment**:
- Check PM2 logs: `pm2 logs hyperscape-duel`
- Manually kill orphaned bun processes: `pkill -f "bun.*packages/server"`
- Verify database connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'hyperscape';`

### Admin Dashboard Issues

**Logs not appearing**:
- Verify admin authentication (requires admin role)
- Check ring buffer size: `Logger.getRecentLogs().length`
- Ensure auto-refresh is enabled
- Check browser console for fetch errors to `/admin/logs`

**Maintenance mode not working**:
- Check `/admin/maintenance/status` endpoint
- Verify no active duels: `safeToDeploy` should be `true`
- Check market status: `marketStatus` should be `PAUSED`
- Ensure PM2 is running: `pm2 status`

**Server restart button not working**:
- Verify PM2 is managing the process: `pm2 list`
- Check PM2 logs: `pm2 logs hyperscape-duel`
- Ensure admin code is set: `ADMIN_CODE` in server `.env`
- Note: Restart requires PM2 to auto-restart on `process.exit(0)`

### Docker Deployment Issues

**Module resolution errors for workspace packages**:
- **Symptom**: "Cannot find module @hyperscape/decimation" or similar errors in Docker
- **Cause**: Docker COPY flattens workspace symlinks (fixed March 12, 2026)
- **Fix**: Ensure Dockerfile includes `RUN bun install --production` after COPY steps
- **Verify**: Check `Dockerfile.server` has workspace symlink restoration step

**Manifests not loading in Docker**:
- **Symptom**: Server fails to start with "Failed to load manifest" errors
- **Cause**: Manifests not embedded in Docker image (fixed March 13, 2026)
- **Fix**: Ensure Dockerfile copies manifests from builder stage
- **Verify**: Check `COPY --from=builder /app/packages/server/world ./packages/server/world` exists in Dockerfile

### Biome System Issues

**"Unknown biome name" errors**:
- **Symptom**: Terrain generation fails with biome-related errors
- **Cause**: Biome system no longer has hardcoded defaults (changed March 12, 2026)
- **Fix**: Pass explicit biome definitions to `BiomeSystem` or `TerrainGenerator` constructor
- **Example**: See `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`

**Trees spawning on cliffs or steep slopes**:
- **Symptom**: Trees appear on unrealistic terrain
- **Cause**: Missing or incorrect `maxSlope` configuration
- **Fix**: Set `maxSlope` in biome tree config (e.g., `maxSlope: 1.5` for forest, `2.0` for canyon)
- **Location**: `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`

### Canyon Biome Errors

**Symptom**: Server fails to load canyon biome or crashes on canyon tile generation

**Cause**: Missing or stale manifests

**Fix** (as of March 13, 2026):
- **Docker**: Manifests are now embedded in Docker image (commit efa8021) - rebuild to pick up latest
- **CDN**: Cache busting is automatically applied (commit db6581f) - no manual purging needed
- **Local Dev**: Ensure assets are synced: `bun run assets:sync`
- **Hard Refresh**: Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R) to force fresh manifest fetch

### Stale Manifests / Outdated Game Data

**Symptom**: Seeing outdated items, NPCs, or terrain configs after deployment

**Cause**: CDN caching, stale service worker, or Docker build cache

**Fix** (as of March 13, 2026):
- **Automatic**: Cache busting is now applied to all manifest requests (commit db6581f)
- **Client**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- **Server**: Manifests embedded in Docker - rebuild image: `docker build -f Dockerfile.server .`
- **Service Worker**: Workbox runtime is inlined (commit 9312a96) - PWA updates are now reliable
- **R2 Upload**: Wrangler now uses `--remote` flag to target remote bucket (commit 94e3a1d)
- **Vast.ai**: Deployment script forcefully removes cached assets folder before install (commit ef42c3d)
- **Docker Cache**: Dockerfile now removes assets folder before `ensure-assets.mjs` to prevent stale cache (commits a52294, 207fd8a)

### Solana Oracle Type Errors

**Symptom**: TypeScript errors in Solana oracle IDL imports

**Cause**: IDL types were reformatted from JSON-style to TypeScript-style (March 13, 2026)

**Fix**: Update imports to use new TypeScript-style object literals:
```typescript
// Old (JSON-style - no longer valid)
const idl = FIGHT_ORACLE_IDL;
idl["address"]  // Error: Element implicitly has 'any' type

// New (TypeScript-style)
const idl = FIGHT_ORACLE_IDL;
idl.address  // ✅ Properly typed
```

**Files Changed**:
- `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`
- `packages/duel-oracle-solana/src/generated/fightOracleTypes.ts`
- `packages/duel-oracle-solana/src/generated/fight_oracle.ts`

## Additional Resources

### Core Documentation
- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI assistant instructions
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`

### Streaming & Betting (March 2026)
- [docs/streaming-betting-integration.md](docs/streaming-betting-integration.md) - Integration guide for betting consumers
- [docs/api-betting-feed.md](docs/api-betting-feed.md) - Complete API reference for internal betting feed
- [docs/migration-march-2026-streaming.md](docs/migration-march-2026-streaming.md) - Breaking changes and migration steps

### Performance & Architecture (March 2026)
- [docs/performance-march-2026.md](docs/performance-march-2026.md) - Performance overhaul details (PR #1064)
- Server Runtime Migration: Node.js 22+ (V8 incremental GC)
- uWebSockets.js Integration: Native pub/sub broadcasting
- Agent AI Worker Thread: Off-main-thread decision-making
- BFS Pathfinding Optimization: Global iteration budget, pre-baked walkability

### UI & Client (March 2026)
- [docs/ui-modernization-march-2026.md](docs/ui-modernization-march-2026.md) - Client UI modernization details (PR #1067)
- Sidebar Deletion & Interface Manager Migration: Modular hook-based architecture
- Minimap Modularization: Dedicated hooks for terrain, entities, and world caches
- Player Data Context Provider: Centralized subscriptions with equality checks
- Auth-Authoritative Startup: Privy SDK is source of truth
- Dashboard Polling Optimization: Adaptive intervals with visibility awareness
