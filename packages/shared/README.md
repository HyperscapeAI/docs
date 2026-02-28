# @hyperscape/shared

Core 3D multiplayer engine for Hyperscape - Entity Component System (ECS), Three.js WebGPU rendering, PhysX physics, and real-time networking.

## Overview

This package contains the shared game engine code used by both client and server. It provides:

- **Entity Component System (ECS)** - Flexible architecture for game objects
- **WebGPU Rendering** - Modern GPU-accelerated graphics with TSL shaders
- **PhysX Physics** - WASM-based physics simulation
- **Networking** - Real-time multiplayer synchronization
- **React UI** - Game interface components
- **Instanced Rendering** - High-performance rendering for thousands of entities

## Key Features

### WebGPU-Only Rendering

**CRITICAL**: This package requires WebGPU. WebGL is NOT supported.

- All materials use TSL (Three Shading Language)
- Post-processing effects use WebGPU node materials
- No WebGL fallback path exists
- Supported browsers: Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)

See `src/utils/rendering/RendererFactory.ts` for implementation.

### Instanced Rendering System

High-performance rendering for resource entities (rocks, ores, herbs, trees):

**Components:**
- `GLBResourceInstancer` - Pools instances by model path, separate InstancedMesh per LOD level
- `GLBTreeInstancer` - Specialized instancer for trees with dissolve materials
- `InstancedModelVisualStrategy` - Visual strategy with collision proxies for raycasting
- `StandardModelVisualStrategy` - Fallback for non-instanced rendering

**Benefits:**
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis
- Depleted model support (tree → stump transitions)
- Highlight mesh support for hover/selection

**Usage:**
```typescript
// Instancing is automatic for resource entities
// Configure in resource manifest:
{
  "modelPath": "/assets/world/resources/trees/oak.glb",
  "depletedModelPath": "/assets/world/resources/trees/oak-stump.glb",
  "depletedModelScale": 0.8
}
```

**API:**
```typescript
// ResourceVisualStrategy interface
interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  
  // Returns true if strategy handled depletion (instanced stump)
  // Returns false if ResourceEntity should load individual depleted model
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;
  
  // Optional: Return highlight mesh for instanced entities
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

**Files:**
- `src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- `src/systems/shared/world/GLBResourceInstancer.ts`
- `src/systems/shared/world/GLBTreeInstancer.ts`

### Model Cache Integrity

**Index Buffer Type Preservation:**
- Model cache preserves original index buffer type (Uint16Array vs Uint32Array)
- Fixes silent geometry corruption and RangeError crashes
- Cache version: 4 (invalidates old corrupt entries)

**Technical Details:**
- THREE.js uses Uint16Array for meshes with <65536 vertices
- Previous cache always deserialized as Uint32Array
- Caused corruption (even-count) or crashes (odd-count)
- Now stores and restores correct typed array type

**Implementation:**
- `src/utils/rendering/ModelCache.ts`

### Entity Component System

**Core Concepts:**
- **Entities** - Game objects (players, mobs, items, resources)
- **Components** - Data containers (position, health, inventory)
- **Systems** - Logic processors (combat, skills, movement)

**Entity Types:**
- `PlayerEntity` - Human and AI players
- `MobEntity` - Hostile NPCs
- `NPCEntity` - Friendly NPCs
- `ResourceEntity` - Gatherable resources (trees, rocks, fishing spots)
- `ItemEntity` - Dropped items
- `InteractableEntity` - Banks, altars, furnaces, etc.

**System Categories:**
- `client/` - Client-only systems (rendering, input, audio)
- `server/` - Server-only systems (persistence, AI, monitoring)
- `shared/` - Shared systems (combat, skills, movement, world)

### Physics Integration

**PhysX WASM:**
- Character controllers for player movement
- Rigid bodies for physics objects
- Collision detection and response
- Raycasting for interaction

**Collision Layers:**
- Player layer
- NPC layer
- World layer
- Item layer
- Trigger layer

**Files:**
- `src/physics/PhysXManager.ts`
- `src/physics/Layers.ts`

### Networking

**Real-time Multiplayer:**
- WebSocket-based communication
- Entity state synchronization
- Client-side prediction
- Server reconciliation
- Interpolation for smooth movement

**Packet Types:**
- Entity updates (position, rotation, animation)
- Action requests (attack, gather, interact)
- Inventory operations
- Chat messages
- System events

**Files:**
- `src/platform/shared/Socket.ts`
- `src/platform/shared/packets.ts`
- `src/systems/client/ClientNetwork.ts`

## Installation

```bash
# From repository root
bun install

# Build shared package (required before other packages)
bun run build:shared
```

## Development

```bash
# Watch mode with auto-rebuild
bun run dev:shared

# Run tests
npm test --workspace=packages/shared

# Lint
npm run lint --workspace=packages/shared
```

## Usage

### Client-Side

```typescript
import { createClientWorld } from '@hyperscape/shared';

const world = await createClientWorld({
  canvas: document.querySelector('canvas'),
  // ... options
});

// Start game loop
world.start();
```

### Server-Side

```typescript
import { createServerWorld } from '@hyperscape/shared';

const world = await createServerWorld({
  worldPath: './world',
  // ... options
});

// Start server tick
world.start();
```

## API Reference

### Core Classes

**World** (`src/core/World.ts`):
- `getSystem(name)` - Get system by name
- `getEntity(id)` - Get entity by ID
- `getEntitiesByType(type)` - Query entities by type
- `on(event, handler)` - Subscribe to events
- `emit(event, data)` - Emit events

**Entity** (`src/entities/Entity.ts`):
- Base class for all game objects
- Component management
- Transform hierarchy
- Event emitters

**System** (`src/systems/shared/infrastructure/System.ts`):
- Base class for all systems
- Lifecycle hooks (init, update, destroy)
- World access
- Event handling

### Visual Strategies

**ResourceVisualStrategy** (`src/entities/world/visuals/ResourceVisualStrategy.ts`):
- Interface for resource rendering strategies
- Handles mesh creation, LOD, depletion, and cleanup
- Supports instanced and non-instanced rendering

**Implementations:**
- `InstancedModelVisualStrategy` - GPU instancing for resources
- `TreeGLBVisualStrategy` - Tree-specific instancing with dissolve
- `StandardModelVisualStrategy` - Non-instanced fallback
- `PlaceholderVisualStrategy` - Colored cube proxies for testing

### Rendering Utilities

**RendererFactory** (`src/utils/rendering/RendererFactory.ts`):
- `createRenderer(options)` - Create WebGPU renderer
- `isWebGPUAvailable()` - Check WebGPU support (with timeout)
- `detectRenderingCapabilities()` - Get rendering capabilities
- `configureRenderer(renderer, options)` - Configure renderer settings

**ModelCache** (`src/utils/rendering/ModelCache.ts`):
- `loadModel(path)` - Load and cache GLB models
- `clearCache()` - Clear cached models
- Preserves index buffer types (Uint16Array vs Uint32Array)
- Cache version: 4

**LODManager** (`src/utils/rendering/LODManager.ts`):
- Distance-based LOD switching
- Hysteresis to prevent flickering
- Per-entity LOD configuration

## Testing

Tests use real Hyperscape instances with Playwright - NO MOCKS.

```bash
# Run all tests
npm test --workspace=packages/shared

# Run specific test file
npm test --workspace=packages/shared -- src/systems/shared/combat/__tests__/CombatSystem.test.ts

# Visual tests require WebGPU support
# Screenshots saved to __screenshots__/ directories
```

## Performance Considerations

### Instanced Rendering
- Use for entities with many instances (>10 of same model)
- Automatic LOD switching reduces GPU load
- Collision proxies enable raycasting on instanced meshes

### Model Cache
- Models cached in IndexedDB for fast loading
- Cache version bumped when format changes
- Clear cache if seeing geometry corruption

### Memory Management
- Dispose geometries and materials when removing entities
- Use object pools for frequently created/destroyed objects
- Monitor memory usage in DevStats panel

## Breaking Changes

### WebGL Removal (commit 47782ed)
- All WebGL fallback code removed
- `RendererFactory` only supports WebGPU
- `--disable-webgpu` and `forceWebGL` flags ignored
- Deployment fails if WebGPU unavailable

### ResourceVisualStrategy API (commit 9643d5d)
- `onDepleted()` now returns `Promise<boolean>` instead of `Promise<void>`
- New optional method: `getHighlightMesh(ctx)`
- `ResourceEntity.getHighlightRoot()` added for instanced highlights

### Model Cache Format (commit 6fd626a)
- Cache version bumped to 4
- Index buffer type now preserved
- Old cache entries automatically invalidated

## Contributing

See [CLAUDE.md](../../CLAUDE.md) for development guidelines and coding standards.

## License

MIT
