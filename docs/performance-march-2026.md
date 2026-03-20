# Performance & Scalability Improvements (March 2026)

This document details the major performance and scalability improvements made to Hyperscape in March 2026. These changes enable the server to handle 50+ concurrent players with 25+ AI agents without tick blocking or event loop starvation.

## Table of Contents

1. [Server Runtime Migration (Bun → Node.js)](#server-runtime-migration-bun--nodejs)
2. [uWebSockets.js Integration](#uwebsocketsjs-integration)
3. [Agent AI Worker Thread Architecture](#agent-ai-worker-thread-architecture)
4. [BFS Pathfinding Optimization](#bfs-pathfinding-optimization)
5. [Terrain System Server Optimization](#terrain-system-server-optimization)
6. [Tick System Reliability](#tick-system-reliability)
7. [Configuration Reference](#configuration-reference)
8. [Performance Metrics](#performance-metrics)
9. [Troubleshooting](#troubleshooting)

---

## Server Runtime Migration (Bun → Node.js)

**PR**: #1064 | **Date**: March 19-20, 2026

### Problem

Bun's JavaScriptCore (JSC) engine uses **stop-the-world garbage collection** for old-generation objects. With 25+ AI agents and complex game state, GC pauses reached **500-1200ms**, destroying the 600ms game tick. This caused:
- Missed ticks (server couldn't fire tick on time)
- Rubber-banding (players teleporting due to delayed position updates)
- Combat desync (attacks not registering)
- Agent AI freezing (behavior loops blocked by GC)

### Solution

Migrated server runtime to **Node.js 22+** which uses V8's **incremental/concurrent GC**. V8 spreads GC work across multiple event loop turns, keeping pauses **<10ms**.

### Implementation

**Start Command**:
```bash\n# Old (Bun runtime)\nbun --preload ./src/shared/polyfills.ts ./dist/index.js\n\n# New (Node.js runtime with ESM hooks)\nnode --import ./scripts/register-hooks.mjs dist/index.js\n```

**ESM Resolution Hooks** (`packages/server/scripts/node-esm-hooks.mjs`):
Node.js requires explicit `.js` extensions for ESM imports, but Bun workspace packages use extensionless imports. The hooks automatically resolve:
- Extensionless imports: `from "./Foo"` → `from "./Foo.js"`
- Directory imports: `from "./bar"` → `from "./bar/index.js"`

```javascript
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && !specifier.endsWith(".js")) {
      // Try appending .js
      try {
        return await nextResolve(specifier + ".js", context);
      } catch {}
      // Try appending /index.js
      try {
        return await nextResolve(specifier + "/index.js", context);
      } catch {}
    }
    throw err;
  }
}
```

### Impact

- **Tick Reliability**: GC pauses reduced from 500-1200ms → <10ms
- **Missed Ticks**: Eliminated under normal load (25+ agents)
- **Rubber-Banding**: Eliminated position desync issues
- **Combat**: Attacks register reliably on 600ms ticks
- **Breaking Change**: Server now requires Node.js 22+ (Bun no longer supported for server runtime)

### Migration

1. **Install Node.js 22+**: `nvm install 22` or download from [nodejs.org](https://nodejs.org)
2. **Update package.json**: Already updated in PR #1064
3. **No code changes required**: ESM hooks handle module resolution automatically
4. **Bun still used for**: Package management (`bun install`), build scripts, client runtime

---

## uWebSockets.js Integration

**PR**: #1064 | **Date**: March 20, 2026

### Problem

Fastify WebSocket broadcast methods (`sendToAll`, `sendToNearby`) iterated all sockets in JavaScript:
```typescript
for (const socket of this.sockets.values()) {
  socket.send(buffer); // O(n) iteration in JS event loop
}
```

With 50+ concurrent connections, this became a bottleneck. Each broadcast required O(n) iteration, blocking the event loop.

### Solution

Replaced Fastify WebSocket with **uWebSockets.js** using **native pub/sub topics**. The C++ kernel handles per-subscriber delivery, eliminating the JS iteration loop.

### Architecture

**Dual Ports**:
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints, file uploads
- **Port 5556** (uWebSockets.js): Game WebSocket traffic (real-time multiplayer)

**Pub/Sub Topics**:
- `global` - All connected players (for server-wide announcements)
- `region:<key>` - Players in specific spatial region (for nearby entity updates)
- `spectator` - Spectator/streaming clients (for duel arena broadcasts)

**Subscription Lifecycle**:
1. **On Connection**: Subscribe to `global` topic
2. **On Player Join**: Subscribe to 9 adjacent region topics (3×3 grid around player)
3. **On Player Movement**: Diff old/new regions, subscribe to new, unsubscribe from old
4. **On Spectator Join**: Subscribe to `spectator` + followed player's region topics

### Implementation

**uWS Server** (`packages/server/src/startup/uws-server.ts`):
```typescript
import uWS from "uWebSockets.js";

export async function createUwsServer(
  world: World,
  port: number
): Promise<uWS.us_listen_socket | null> {
  const app = uWS.App({
    maxPayloadLength: 512 * 1024,  // 512KB max message size
    idleTimeout: 120,               // 2 minute idle timeout
    maxBackpressure: 1024 * 1024,   // 1MB backpressure limit
  });

  app.ws("/ws", {
    upgrade: (res, req, context) => {
      // Parse query params, validate token
      const token = parseQueryString(req.getQuery()).token;
      res.upgrade({ token, /* ... */ }, ...);
    },
    
    open: (ws) => {
      ws.subscribe("global");
      const socket = new UwsWebSocketAdapter(ws, wsId);
      world.network.onConnection(socket);
    },
    
    message: (ws, message, isBinary) => {
      const socket = ws.getUserData().socket;
      socket.dispatchMessage(Buffer.from(message));
    },
    
    close: (ws, code, message) => {
      const socket = ws.getUserData().socket;
      socket.dispatchClose(code, Buffer.from(message).toString());
    },
  });

  return new Promise((resolve) => {
    app.listen(port, (listenSocket) => {
      if (listenSocket) {
        console.log(`[uWS] Game WebSocket listening on port ${port}`);
      } else {
        console.error(`[uWS] Failed to bind to port ${port}`);
      }
      resolve(listenSocket);
    });
  });
}
```

**Adapter Pattern** (`packages/server/src/startup/UwsWebSocketAdapter.ts`):
Bridges uWS callback API to `NodeWebSocket` interface:
```typescript
export class UwsWebSocketAdapter implements NodeWebSocket {
  constructor(
    private ws: uWS.WebSocket<unknown>,
    public readonly id: string
  ) {}

  subscribe(topic: string): void {
    if (this._closed) return;
    try {
      this.ws.subscribe(topic);
    } catch {}
  }

  publish(topic: string, message: string | ArrayBuffer): void {
    if (this._closed) return;
    try {
      this.ws.publish(topic, message);
    } catch {}
  }

  send(data: string | ArrayBuffer): void {
    if (this._closed) return;
    try {
      // uWS invalidates ArrayBuffer after callback - must copy
      const buffer = typeof data === "string" 
        ? data 
        : (data as ArrayBuffer).slice(0);
      this.ws.send(buffer, typeof data !== "string");
    } catch {}
  }

  // ... implements full NodeWebSocket interface
}
```

**Broadcast Manager** (`packages/server/src/systems/ServerNetwork/broadcast.ts`):
Dual-path broadcasting with pub/sub fast path and legacy fallback:
```typescript
sendToAll(packet: string, data: unknown): number {
  const buffer = this.serialize(packet, data);
  
  if (this.uwsApp) {
    // Fast path: native pub/sub (O(1) from JS perspective)
    this.uwsApp.publish("global", buffer);
    return this.sockets.size; // Estimate
  }
  
  // Fallback: JS iteration (O(n))
  let sentCount = 0;
  for (const socket of this.sockets.values()) {
    try {
      socket.send(buffer);
      sentCount++;
    } catch {}
  }
  return sentCount;
}

sendToNearby(
  position: [number, number, number],
  packet: string,
  data: unknown
): number {
  const buffer = this.serialize(packet, data);
  
  if (this.uwsApp) {
    // Fast path: publish to 9 region topics (3×3 grid)
    const regionKeys = this.spatialIndex.getAdjacentRegionKeys(
      position[0],
      position[2]
    );
    for (const key of regionKeys) {
      this.uwsApp.publish(`region:${key}`, buffer);
    }
    return -1; // Unknown (C++ handles delivery)
  }
  
  // Fallback: JS iteration with distance check
  // ... O(n) socket iteration
}
```

**Spatial Index** (`packages/server/src/systems/ServerNetwork/SpatialIndex.ts`):
Region topic cache and subscription diffing:
```typescript
export class SpatialIndex {
  private regionTopicCache = new Map<number, string>();
  
  getRegionTopic(x: number, z: number): string {
    const key = this.getRegionKey(x, z);
    let topic = this.regionTopicCache.get(key);
    if (!topic) {
      topic = `region:${key}`;
      this.regionTopicCache.set(key, topic);
    }
    return topic;
  }
  
  getRegionSubscriptionDiff(
    oldPos: [number, number, number],
    newPos: [number, number, number]
  ): { subscribe: number[]; unsubscribe: number[] } {
    const oldKeys = new Set(this.getAdjacentRegionKeys(oldPos[0], oldPos[2]));
    const newKeys = new Set(this.getAdjacentRegionKeys(newPos[0], newPos[2]));
    
    const subscribe: number[] = [];
    const unsubscribe: number[] = [];
    
    for (const key of newKeys) {
      if (!oldKeys.has(key)) subscribe.push(key);
    }
    for (const key of oldKeys) {
      if (!newKeys.has(key)) unsubscribe.push(key);
    }
    
    return { subscribe, unsubscribe };
  }
}
```

### Configuration

```bash
# Enable/disable uWS (default: enabled)
UWS_ENABLED=true

# uWS port (default: 5556)
UWS_PORT=5556

# Client WebSocket URL
PUBLIC_WS_URL=ws://localhost:5556/ws  # uWS (default)
# or
PUBLIC_WS_URL=ws://localhost:5555/ws  # Fastify fallback (UWS_ENABLED=false)
```

### Impact

- **Broadcast Performance**: O(n) JS iteration → O(1) native pub/sub
- **Scalability**: Supports 50+ concurrent connections without event loop blocking
- **Region-Based Broadcasting**: Only 9 region topics per player (3×3 grid) instead of all sockets
- **Fallback**: Full compatibility with `UWS_ENABLED=false` (zero behavioral change)
- **DevStats**: F5 panel shows pub/sub publish count

### Migration

1. **Update Client WebSocket URL**: Change `PUBLIC_WS_URL` to port 5556 (or keep 5555 with `UWS_ENABLED=false`)
2. **Load Balancer**: Route both ports 5555 (HTTP) and 5556 (WebSocket) to server
3. **Health Checks**: Continue using port 5555 for `/health` endpoint
4. **No code changes required**: Adapter pattern maintains compatibility with existing game code

---

## Agent AI Worker Thread Architecture

**PR**: #1064 | **Date**: March 20, 2026

### Problem

With 25+ AI agents, each running autonomous behavior ticks (pathfinding, inventory management, quest logic, combat decisions) on the main thread, the event loop was blocked for **200-600ms per tick**. This prevented the 600ms game tick from firing on time, causing:
- Missed ticks (tick fired late or skipped entirely)
- Agent AI freezing (behavior loops blocked by other agents)
- Player input lag (event loop starved)

### Solution

Extract pure decision logic into a **worker thread**. Main thread collects game state snapshots, sends to worker for decisions, receives action commands back, and executes them.

### Architecture

**Components**:
- **AgentBehaviorBridge** (main thread): Coordinates worker communication, collects snapshots, applies results
- **AgentBehaviorEngine** (worker thread): Pure decision functions (no World access, no side effects)
- **Shared Entity Snapshot**: Scanned once per second across ALL agents instead of per-agent scans
- **Batch Processing**: Up to 5 agents processed per poll cycle (1000ms interval)
- **Staggered Scheduling**: 800ms offset between agent start times to prevent simultaneous ticks

**Data Flow**:
```
Main Thread                          Worker Thread
-----------                          -------------
1. Poll for due agents (every 1000ms)
2. Collect game state snapshots
3. Send to worker -----------------> 4. Receive snapshots
                                     5. Make decisions (pure functions)
6. Receive action commands <-------- 7. Send results
8. Execute actions (side effects)
9. Yield to event loop
```

### Implementation

**AgentBehaviorBridge** (`packages/server/src/eliza/managers/AgentBehaviorBridge.ts`):
```typescript
export class AgentBehaviorBridge {
  private worker: Worker | null = null;
  private schedules = new Map<string, AgentSchedule>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    // Spawn worker thread
    const workerPath = path.join(path.dirname(thisFile), "agentBehaviorWorker.js");
    this.worker = new Worker(workerPath);

    // Handle messages from worker
    this.worker.on("message", (msg) => this.handleWorkerMessage(msg));
    this.worker.on("error", (err) => this.restartWorker());

    // Send item data to worker
    await this.initializeWorker();

    // Start polling for due agents
    this.pollInterval = setInterval(() => {
      void this.pollAndDispatch();
    }, 1000);
  }

  private async pollAndDispatch(): Promise<void> {
    if (!this.workerReady || this.pendingResolve) return;

    const dueAgents: AgentTickInput[] = [];
    const now = Date.now();

    // Collect snapshots for due agents (max 5 per poll)
    for (const [characterId, schedule] of this.schedules) {
      if (schedule.tickInProgress || now < schedule.nextTickAt) continue;
      if (dueAgents.length >= 5) break; // Cap per poll

      const instance = this.getAgent(characterId);
      if (!instance || instance.state !== "running") continue;

      // Collect game state snapshot
      const gameState = instance.service.getGameState();
      dueAgents.push({
        characterId,
        gameState,
        inventoryItems: instance.service.getInventoryItems(),
        equippedItems: instance.service.getEquippedItems(),
        // ... more snapshot data
      });

      schedule.tickInProgress = true;
      schedule.nextTickAt = now + 8000; // Next tick in 8s
    }

    if (dueAgents.length === 0) return;

    // Send to worker and wait for results
    const results = await this.sendTickAndWait(dueAgents, sharedData);

    // Apply results on main thread
    for (const result of results) {
      await this.applyTickResult(result);
      await yieldToEventLoop(); // Don't block tick loop
    }
  }

  private async applyTickResult(result: AgentTickOutput): Promise<void> {
    const instance = this.getAgent(result.characterId);
    if (!instance) return;

    // Update agent state
    instance.goal = result.updatedState.goal;
    instance.currentTargetId = result.updatedState.currentTargetId;

    // Execute side effects (equip, drop, buy, eat)
    for (const effect of result.sideEffects) {
      switch (effect.type) {
        case "storeBuy":
          await instance.service.executeStoreBuy(effect.storeId, effect.itemId, effect.quantity);
          break;
        case "equip":
          await instance.service.executeEquip(effect.itemId);
          break;
        // ... more side effects
      }
    }

    // Execute main action
    switch (result.action.type) {
      case "attack":
        await instance.service.executeAttack(result.action.targetId);
        break;
      case "gather":
        await instance.service.executeGather(result.action.targetId);
        break;
      // ... more actions
    }
  }
}
```

**AgentBehaviorEngine** (`packages/server/src/eliza/worker/AgentBehaviorEngine.ts`):
```typescript
// Pure decision logic - no World access, serializable I/O only
export function processAgentTicks(agents: AgentTickInput[]): AgentTickOutput[] {
  const results: AgentTickOutput[] = [];
  for (const input of agents) {
    results.push(processOneAgent(input));
  }
  return results;
}

function processOneAgent(input: AgentTickInput): AgentTickOutput {
  const sideEffects: AgentSideEffect[] = [];
  const state = { ...input.agentState };

  // Quest management
  manageQuests(input, state);

  // Inventory management
  manageInventory(input, state, sideEffects);

  // Equipment management
  manageEquipment(input, sideEffects);

  // Survival: eat food if needed
  if (assessAndEat(input, state, sideEffects)) {
    return { characterId: input.characterId, action: { type: "idle" }, sideEffects, updatedState: state };
  }

  // Pick action (attack, gather, move, etc.)
  const action = pickBehaviorAction(input, state);

  return { characterId: input.characterId, action, sideEffects, updatedState: state };
}
```

**Shared Entity Snapshot** (`packages/server/src/eliza/EmbeddedHyperscapeService.ts`):
```typescript
// Scan all entities once per second, share across all agent instances
const _snapshotCache = new WeakMap<object, { snapshot: EntitySnapshot[]; time: number }>();

function getSharedEntitySnapshot(world, getPos): EntitySnapshot[] {
  const now = Date.now();
  const cached = _snapshotCache.get(world);
  
  if (cached && now - cached.time < 1000 && cached.snapshot.length > 0) {
    return cached.snapshot; // Reuse cached snapshot
  }

  // Scan all entities (expensive - only once per second)
  const snapshot: EntitySnapshot[] = [];
  for (const [id, entity] of world.entities.items.entries()) {
    const pos = getPos(entity);
    if (!pos) continue;
    snapshot.push({ id, position: pos, data: entity.data, entity });
  }

  _snapshotCache.set(world, { snapshot, time: now });
  return snapshot;
}
```

### Configuration

```bash
# Agent behavior tick interval (default: 8000ms)
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000

# Agent stagger offset (default: 800ms)
AGENT_STAGGER_OFFSET_MS=800

# Max agents per poll cycle (default: 5)
MAX_AGENTS_PER_POLL=5

# Bridge poll interval (default: 1000ms)
BRIDGE_POLL_INTERVAL_MS=1000
```

### Impact

- **Event Loop**: Agent AI no longer blocks the game tick loop
- **Tick Blocking**: Reduced from 200-600ms → <10ms
- **Scalability**: Supports 25+ AI agents without event loop starvation
- **Entity Scanning**: Reduced from O(agents × entities) to O(entities) per second
- **Worker Crash Recovery**: Automatic restart with state preservation

### Performance Metrics

**Before** (main thread AI):
- 25 agents × 200ms per tick = 5000ms total blocking per 8s cycle
- Event loop blocked 62.5% of the time
- Missed ticks: 3-5 per minute

**After** (worker thread AI):
- Main thread: <10ms per poll cycle (snapshot collection + result application)
- Worker thread: 200ms per batch (doesn't block main thread)
- Missed ticks: 0 under normal load

---

## BFS Pathfinding Optimization

**PR**: #1064 | **Date**: March 20, 2026

### Problem

25+ agents each triggering full 4000-iteration BFS calls per tick with expensive per-iteration walkability checks:
- **Slope Calculation**: 9 `getHeightAt()` calls per tile (center + 8 neighbors)
- **Biome Check**: Entity iteration to find biome at position
- **Building Check**: Collision matrix lookup
- **Total Cost**: ~10 expensive operations per BFS iteration × 4000 iterations × 25 agents = 1,000,000 operations per tick

This monopolized the event loop, blocking the 600ms game tick.

### Solutions

#### 1. Global BFS Iteration Budget

Shared budget across ALL pathfinding callers (combat follow, gathering, path continuation, player clicks):

```typescript
// packages/shared/src/systems/shared/movement/BFSPathfinder.ts
const MAX_BFS_ITERATIONS_PER_TICK = 12000; // Shared across all callers
let _globalIterationsUsedThisTick = 0;
let _lastBudgetResetTick = -1;

findPath(from: TileCoord, to: TileCoord, maxIterations = 4000): TileCoord[] | null {
  const currentTick = this.world.currentTick ?? 0;

  // Reset budget at start of new tick
  if (currentTick !== _lastBudgetResetTick) {
    _globalIterationsUsedThisTick = 0;
    _lastBudgetResetTick = currentTick;
  }

  // Check remaining budget
  const remainingBudget = MAX_BFS_ITERATIONS_PER_TICK - _globalIterationsUsedThisTick;
  if (remainingBudget <= 0) {
    this._lastIterationsUsed = 0;
    return null; // Budget exhausted
  }

  const effectiveMax = Math.min(maxIterations, remainingBudget);

  // ... BFS with effectiveMax iterations

  _globalIterationsUsedThisTick += iterationsUsed;
  this._lastIterationsUsed = iterationsUsed;
  return path;
}

// Iteration tracking API
getLastIterationsUsed(): number {
  return this._lastIterationsUsed;
}
```

**Impact**: Short paths are cheap (10-50 iterations), long paths cost proportionally. Budget prevents 25 agents from each running 4000 iterations simultaneously.

#### 2. Zero-Allocation Scratch Tiles

Reuse instance fields instead of allocating new objects per iteration:

```typescript
// Old (allocates 8 objects per iteration)
const neighbors = [
  { x: current.x + 1, z: current.z },
  { x: current.x - 1, z: current.z },
  { x: current.x, z: current.z + 1 },
  { x: current.x, z: current.z - 1 },
  { x: current.x + 1, z: current.z + 1 },
  { x: current.x + 1, z: current.z - 1 },
  { x: current.x - 1, z: current.z + 1 },
  { x: current.x - 1, z: current.z - 1 },
];

// New (zero allocations)
private _scratchNeighbor = { x: 0, z: 0 };
private _scratchCardinalX = { x: 0, z: 0 };
private _scratchCardinalZ = { x: 0, z: 0 };

// Check each neighbor by mutating scratch tile
this._scratchNeighbor.x = current.x + 1;
this._scratchNeighbor.z = current.z;
if (canMoveTo(current, this._scratchNeighbor)) {
  // ... process neighbor
}
```

**Impact**: Eliminates 24,000-32,000 object allocations per pathfind call (8 neighbors × 3000-4000 iterations).

#### 3. Per-Tick Walkability Cache

Cache terrain/slope/biome results by tile key within a tick:

```typescript
// packages/server/src/systems/ServerNetwork/mob-tile-movement.ts
private _walkabilityCache = new Map<number, boolean>();
private _directionalBlockCache = new Map<number, boolean>();
private _lastCacheClearTick = -1;

isTileWalkable(tile: TileCoord): boolean {
  const currentTick = this.world.currentTick ?? 0;

  // Clear cache at start of new tick
  if (currentTick !== this._lastCacheClearTick) {
    this._walkabilityCache.clear();
    this._directionalBlockCache.clear();
    this._lastCacheClearTick = currentTick;
  }

  const key = tileKeyNumeric(tile);
  const cached = this._walkabilityCache.get(key);
  if (cached !== undefined) return cached;

  // Expensive check (terrain queries, slope calculation, biome check)
  const walkable = this.performWalkabilityCheck(tile);
  this._walkabilityCache.set(key, walkable);
  return walkable;
}
```

**Impact**: 25 agents checking same tiles → first check expensive, remaining 24 are O(1).

#### 4. Pre-Baked Terrain Walkability

Pre-compute WATER and STEEP_SLOPE flags into the collision matrix at terrain generation time:

```typescript
// packages/shared/src/systems/shared/world/TerrainSystem.ts
private processWalkabilityQueue(): void {
  const budget = 4; // ms
  const t0 = performance.now();

  while (this.pendingWalkabilityTiles.length > 0) {
    const entry = this.pendingWalkabilityTiles[0];

    // Process one row at a time (resumable across ticks)
    for (let localZ = entry.lastProcessedRow; localZ < TILE_SIZE; localZ++) {
      for (let localX = 0; localX < TILE_SIZE; localX++) {
        const worldX = entry.tileX * TILE_SIZE + localX;
        const worldZ = entry.tileZ * TILE_SIZE + localZ;

        // Check water
        const biome = this.getBiomeAt(worldX, worldZ);
        if (biome?.name === "water") {
          this.collisionMatrix.setFlag(worldX, worldZ, CollisionFlags.WATER);
        }

        // Check slope
        const slope = this.calculateSlope(worldX, worldZ);
        if (slope > MAX_WALKABLE_SLOPE) {
          this.collisionMatrix.setFlag(worldX, worldZ, CollisionFlags.STEEP_SLOPE);
        }
      }

      entry.lastProcessedRow = localZ + 1;

      // Check budget
      if (performance.now() - t0 > budget) {
        return; // Resume next tick
      }
    }

    // Tile complete
    this.pendingWalkabilityTiles.shift();
  }
}
```

**Collision Matrix Integration**:
```typescript
// packages/shared/src/systems/shared/movement/CollisionMatrix.ts
export enum CollisionFlags {
  OCCUPIED = 1 << 0,      // Entity occupying tile
  BUILDING = 1 << 1,      // Building collision
  WATER = 1 << 2,         // Water tile (pre-baked)
  STEEP_SLOPE = 1 << 3,   // Slope too steep (pre-baked)
}

// Fast walkability check (single bitwise AND)
isWalkable(x: number, z: number): boolean {
  const flags = this.getFlags(x, z);
  return (flags & (CollisionFlags.WATER | CollisionFlags.STEEP_SLOPE)) === 0;
}
```

**Impact**: Walkability checks drop from ~10 `getHeightAt()` calls to 1 bitwise AND operation.

### Configuration

```typescript
// Global budget (shared across all callers)
const MAX_BFS_ITERATIONS_PER_TICK = 12000;

// Per-call limit (default: 4000, reduced from 8000)
const DEFAULT_MAX_ITERATIONS = 4000;

// Walkability baking budget (ms per tick)
const WALKABILITY_BUDGET_MS = 4;
```

### Impact

- **BFS Cost**: Reduced by ~70% (200-600ms → 100-190ms per tick)
- **Allocation Reduction**: Eliminated 24,000-32,000 object allocations per pathfind call
- **Cache Hit Rate**: ~90% for agents in same area
- **Terrain Generation**: Spreads 10,000-iteration walkability baking across ticks (4ms budget)
- **Scalability**: 25 agents can pathfind simultaneously without blocking the tick

### Performance Metrics

**Before**:
- 25 agents × 4000 iterations × 10 operations = 1,000,000 operations per tick
- BFS blocking: 200-600ms per tick
- Missed ticks: 2-4 per minute

**After**:
- Global budget: 12,000 iterations total (shared across all agents)
- BFS blocking: 100-190ms per tick
- Missed ticks: 0 under normal load
- Cache hit rate: ~90% for agents in same area

---

## Terrain System Server Optimization

**PR**: #1064 | **Date**: March 20, 2026

### Problem

Server terrain generation was using the same high-resolution geometry as the client:
- **64×64 vertices** per tile = 8,192 triangles for PhysX collision mesh
- **Full color/biome data** stored in memory (~80% unused on server)
- **Synchronous walkability baking**: 10,000-iteration `bakeWalkabilityFlags` blocked tile creation

### Solutions

#### 1. Low-Resolution Collision Mesh

```typescript
// packages/shared/src/systems/shared/world/TerrainSystem.ts
const COLLISION_RESOLUTION = this.runtimeIsServer ? 16 : 64;

// Server: 16×16 vertices = 512 triangles (~16x faster PhysX cooking)
// Client: 64×64 vertices = 8,192 triangles (visual quality)
```

**Impact**: PhysX triangle mesh cooking ~16x faster per tile on server.

#### 2. Time-Budgeted Collision Queue

Process multiple tiles per tick within 8ms budget instead of exactly 1 per tick:

```typescript
private processCollisionQueue(): void {
  const budget = 8; // ms
  const t0 = performance.now();

  while (this.pendingCollisionTiles.length > 0) {
    const tile = this.pendingCollisionTiles.shift()!;
    this.buildServerCollisionGeometry(tile.tileX, tile.tileZ);

    if (performance.now() - t0 > budget) break;
  }
}
```

**Impact**: Collision queue processes 2-4 tiles per tick instead of 1, reducing terrain generation latency.

#### 3. Server-Only Lightweight Tiles

Skip client-only data on server:

```typescript
if (this.runtimeIsServer) {
  return {
    heights: new Float32Array(TILE_SIZE * TILE_SIZE),
    // Skip: colors, biomeIds, roadInfluences, forestWeights, canyonWeights
    // ~80% memory reduction per tile
  };
}
```

**Impact**: Server terrain memory reduced by ~80% per tile.

#### 4. Deferred Walkability Baking

Spread 10,000-iteration `bakeWalkabilityFlags` across ticks with 4ms budget:

```typescript
private processWalkabilityQueue(): void {
  const budget = 4; // ms
  const t0 = performance.now();

  while (this.pendingWalkabilityTiles.length > 0) {
    const entry = this.pendingWalkabilityTiles[0];

    // Process one row at a time (resumable)
    for (let localZ = entry.lastProcessedRow; localZ < TILE_SIZE; localZ++) {
      for (let localX = 0; localX < TILE_SIZE; localX++) {
        // Bake WATER and STEEP_SLOPE flags
        // ...
      }

      entry.lastProcessedRow = localZ + 1;

      // Check budget
      if (performance.now() - t0 > budget) {
        return; // Resume next tick
      }
    }

    // Tile complete
    this.pendingWalkabilityTiles.shift();
  }
}
```

**Impact**: Terrain generation no longer blocks tile creation. Walkability baking spreads across multiple ticks.

### Configuration

```typescript
// Server terrain settings
const SERVER_COLLISION_RESOLUTION = 16;  // 16×16 vertices (512 triangles)
const COLLISION_BUDGET_MS = 8;           // 8ms per tick for collision queue
const WALKABILITY_BUDGET_MS = 4;         // 4ms per tick for walkability baking
```

### Impact

- **PhysX Cooking**: ~16x faster per tile (512 triangles vs 8,192)
- **Memory**: ~80% reduction per tile on server
- **Collision Queue**: Processes 2-4 tiles per tick (8ms budget)
- **Walkability Baking**: Spreads across ticks (4ms budget, row-by-row resumable)
- **Cancellation**: Pending work cancelled on tile unload (no wasted CPU)

---

## Tick System Reliability

**PR**: #1064 | **Date**: March 20, 2026

### Features

#### 1. Tick Health Monitoring

```typescript
// packages/server/src/systems/TickSystem.ts
interface TickHealth {
  missedTicks: number;      // Ticks skipped due to overrun
  lateTicks: number;        // Ticks that started late
  maxLateness: number;      // Worst lateness (ms)
  avgDuration: number;      // Average tick duration (ms)
  lastTickDuration: number; // Most recent tick (ms)
}
```

#### 2. Drift-Corrected setTimeout

```typescript
private scheduleNextTick(): void {
  const now = Date.now();
  const drift = now - this.nextTickTime;
  const delay = Math.max(0, this.tickInterval - drift);

  this.tickTimeout = setTimeout(() => {
    this.processTick();
  }, delay);

  this.nextTickTime += this.tickInterval;
}
```

**Impact**: Tick stays aligned with wall clock instead of drifting over time.

#### 3. Per-Handler Timing

```typescript
// Named handlers for diagnostics
this.tickSystem.onTick(() => {
  // ... mob AI logic
}, TickPriority.MOVEMENT, "mobAI");

this.tickSystem.onTick(() => {
  // ... combat logic
}, TickPriority.COMBAT, "combat");
```

**Impact**: Identifies which handlers are slow (logged when >20ms).

#### 4. DevStats F5 Panel

Real-time tick health display (press F5 in-game):
```
Tick Health:
  Missed: 0 | Late: 2 | Max Lateness: 45ms
  Avg Duration: 120ms | Last: 115ms
  Pub/Sub Publishes: 1,234
  Transport: uWebSockets.js | Connections: 52
```

### Configuration

```typescript
// Tick interval (OSRS-accurate)
const TICK_DURATION_MS = 600;

// Allow tick skipping under load (default: true)
const TICK_ALLOW_SKIP = true;

// Timing thresholds for warnings
const TICK_WARN_THRESHOLD_MS = 20;  // Per-handler warning
const TICK_ERROR_THRESHOLD_MS = 50; // Per-handler error
```

### Impact

- **Drift Correction**: Tick stays aligned with wall clock
- **Missed Tick Tracking**: Logged and displayed in DevStats
- **Per-Handler Timing**: Identifies bottlenecks (mob AI, combat, movement)
- **Real-Time Diagnostics**: F5 panel shows tick health, pub/sub stats, connection count

---

## Configuration Reference

### Environment Variables (New in March 2026)

```bash
# ==========================================
# WEBSOCKET TRANSPORT (NEW March 2026)
# ==========================================

# Enable uWebSockets.js transport (default: true)
UWS_ENABLED=true

# uWS port for game WebSocket traffic (default: 5556)
UWS_PORT=5556

# Client WebSocket URL (update to match UWS_PORT)
PUBLIC_WS_URL=ws://localhost:5556/ws

# ==========================================
# AGENT AI WORKER THREAD (NEW March 2026)
# ==========================================

# Agent behavior tick interval in milliseconds (default: 8000)
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000

# Agent stagger offset in milliseconds (default: 800)
AGENT_STAGGER_OFFSET_MS=800

# Max agents processed per poll cycle (default: 5)
MAX_AGENTS_PER_POLL=5

# Bridge poll interval in milliseconds (default: 1000)
BRIDGE_POLL_INTERVAL_MS=1000

# ==========================================
# BFS PATHFINDING (NEW March 2026)
# ==========================================

# Global BFS iteration budget per tick (default: 12000)
MAX_BFS_ITERATIONS_PER_TICK=12000

# Per-call iteration limit (default: 4000)
DEFAULT_MAX_ITERATIONS=4000

# ==========================================
# TERRAIN SYSTEM (NEW March 2026)
# ==========================================

# Server collision resolution (default: 16 for 16×16 vertices)
SERVER_COLLISION_RESOLUTION=16

# Collision queue budget in milliseconds (default: 8)
COLLISION_BUDGET_MS=8

# Walkability baking budget in milliseconds (default: 4)
WALKABILITY_BUDGET_MS=4

# ==========================================
# TICK SYSTEM (NEW March 2026)
# ==========================================

# Allow tick skipping under load (default: true)
TICK_ALLOW_SKIP=true

# Per-handler timing warning threshold in milliseconds (default: 20)
TICK_WARN_THRESHOLD_MS=20

# Per-handler timing error threshold in milliseconds (default: 50)
TICK_ERROR_THRESHOLD_MS=50
```

### Runtime Requirements (Updated March 2026)

```bash
# Server runtime (REQUIRED)
node >= 22.0.0

# Package manager (REQUIRED)
bun >= 1.3.10

# Database (REQUIRED for production)
postgresql >= 16.0

# Streaming (OPTIONAL)
ffmpeg >= 4.4
google-chrome-beta >= 113  # Linux only
```

---

## Performance Metrics

### Before Optimizations (March 19, 2026)

**Tick Blocking**:
- Bun GC pauses: 500-1200ms (stop-the-world)
- BFS pathfinding: 200-600ms (25 agents × 4000 iterations)
- Agent AI: 200-600ms (main thread behavior loops)
- **Total**: 900-2400ms blocking per tick

**Missed Ticks**: 3-5 per minute under load

**Event Loop**: Blocked 62.5% of the time (5000ms blocking per 8000ms cycle)

### After Optimizations (March 20, 2026)

**Tick Blocking**:
- V8 GC pauses: <10ms (incremental/concurrent)
- BFS pathfinding: 100-190ms (global budget + cache)
- Agent AI: <10ms (worker thread, doesn't block main)
- **Total**: 110-200ms blocking per tick

**Missed Ticks**: 0 under normal load (25 agents, 50 players)

**Event Loop**: Blocked <3% of the time (200ms blocking per 8000ms cycle)

### Scalability

**Before**:
- Max concurrent players: ~20 (with 10 agents)
- Max AI agents: ~10 (before tick blocking)
- Tick reliability: Poor (3-5 missed ticks/min)

**After**:
- Max concurrent players: 50+ (with 25 agents)
- Max AI agents: 25+ (worker thread isolation)
- Tick reliability: Excellent (0 missed ticks under normal load)

---

## Troubleshooting

### Server Won't Start (Node.js Runtime)

**Error**: `Cannot find module '@hyperscape/shared'`

**Cause**: ESM resolution hooks not registered

**Fix**: Ensure start command uses `--import` flag:
```bash
node --import ./scripts/register-hooks.mjs dist/index.js
```

### WebSocket Connection Fails (uWS Port)

**Error**: `WebSocket connection to 'ws://localhost:5556/ws' failed`

**Cause**: uWS server not started or port conflict

**Fix**:
```bash
# Check if uWS is enabled
echo $UWS_ENABLED  # Should be "true" or empty (defaults to true)

# Check port conflicts
lsof -ti:5556 | xargs kill -9

# Fallback to Fastify WebSocket
UWS_ENABLED=false bun run dev
```

### Agent AI Not Working

**Error**: Agents spawn but don't move or make decisions

**Cause**: Worker thread not started or crashed

**Fix**:
```bash
# Check worker thread logs
# Look for "[AgentBehaviorBridge] Started with worker thread"

# Check for worker errors
# Look for "[AgentBehaviorBridge] Worker error:" or "Worker exited with code"

# Verify worker file exists
ls packages/server/build/agentBehaviorWorker.js  # Dev
ls packages/server/dist/agentBehaviorWorker.js   # Prod
```

### BFS Pathfinding Fails

**Error**: Agents or players can't pathfind to distant locations

**Cause**: BFS iteration budget exhausted

**Fix**:
```bash
# Increase global budget
MAX_BFS_ITERATIONS_PER_TICK=20000

# Increase per-call limit
DEFAULT_MAX_ITERATIONS=6000

# Check DevStats (F5) for iteration usage
# Look for "BFS Budget: 12000/12000 (exhausted)"
```

### Terrain Walkability Issues

**Error**: Agents walk on water or steep slopes

**Cause**: Walkability flags not baked yet (tile just generated)

**Fix**: Walkability baking is deferred and spreads across ticks. Wait a few seconds after tile generation for flags to be baked. Check:
```typescript
// In DevStats or logs
console.log("Pending walkability tiles:", terrainSystem.pendingWalkabilityTiles.length);
```

### High Tick Lateness

**Error**: DevStats shows "Late: 10+ | Max Lateness: 200ms+"

**Cause**: Event loop blocked by heavy operations

**Fix**:
1. **Check per-handler timing**: Look for handlers >20ms in logs
2. **Reduce agent count**: Lower `MAX_AGENTS_PER_POLL` from 5 to 3
3. **Increase BFS budget**: More budget = fewer partial paths = less re-pathfinding
4. **Check GC**: Ensure Node.js runtime (not Bun)

### Worker Thread Crashes

**Error**: "[AgentBehaviorBridge] Worker exited with code 1"

**Cause**: Unhandled error in worker thread

**Fix**:
1. **Check worker logs**: Look for error messages before crash
2. **Automatic restart**: Worker restarts automatically after 100ms
3. **Agent recovery**: `tickInProgress` flags are cleared on crash
4. **Persistent crashes**: Check for bad data in agent snapshots (e.g., circular references)

---

## Additional Resources

- **CLAUDE.md**: Complete architecture documentation
- **packages/server/README.md**: Server-specific configuration
- **packages/shared/src/systems/shared/movement/BFSPathfinder.ts**: BFS implementation
- **packages/server/src/eliza/managers/AgentBehaviorBridge.ts**: Worker thread coordinator
- **packages/server/src/eliza/worker/AgentBehaviorEngine.ts**: Pure decision logic
- **packages/server/src/startup/uws-server.ts**: uWebSockets.js server
- **packages/shared/src/systems/shared/world/TerrainSystem.ts**: Terrain generation and walkability baking
