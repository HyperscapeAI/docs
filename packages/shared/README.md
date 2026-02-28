# @hyperscape/shared

Core 3D multiplayer engine for Hyperscape. Provides Entity Component System (ECS), Three.js WebGPU rendering, PhysX physics, real-time networking, and React UI components.

## Features

- **Entity Component System (ECS)** - Flexible game object architecture
- **WebGPU Rendering** - Modern GPU-accelerated graphics with TSL shaders
- **Instanced Rendering** - Optimized rendering for resources (trees, rocks, ores, herbs)
- **PhysX Physics** - WASM-based physics simulation
- **Real-time Networking** - WebSocket-based multiplayer synchronization
- **React UI Components** - Game interface panels and HUD elements
- **Procedural Integration** - Terrain, vegetation, and building generation

## Installation

```bash
cd packages/shared
bun install
bun run build
```

## Architecture

### Entity Component System

The engine uses a pure ECS architecture:

- **Entities**: Game objects (players, mobs, items, resources)
- **Components**: Data containers (position, health, inventory, combat stats)
- **Systems**: Logic processors (combat, movement, rendering, networking)

All game logic runs through systems. Entities are just data containers with no behavior.

### Key Systems

**Client Systems** (`src/systems/client/`):
- `ClientGraphics` - WebGPU rendering, post-processing, LOD management
- `ClientInput` - Keyboard, mouse, touch input handling
- `ClientNetwork` - Server synchronization, interpolation
- `ClientCameraSystem` - Camera controls and positioning
- `EquipmentVisualSystem` - Equipment rendering on player avatars
- `HealthBars` - 3D health bar rendering above entities
- `ProjectileRenderer` - Arrow/spell projectile visualization

**Server Systems** (`src/systems/server/`):
- `ServerRuntime` - Game loop, tick processing
- `ServerLoader` - World loading, entity spawning
- `PersistenceSystem` - Database save/load operations

**Shared Systems** (`src/systems/shared/`):
- `CombatSystem` - Tick-based combat mechanics
- `InventorySystem` - Item management, stacking, transactions
- `SkillsSystem` - XP tracking, leveling, skill unlocks
- `TileSystem` - Tile-based movement and pathfinding
- `ResourceSystem` - Resource gathering (woodcutting, mining, fishing)
- `TerrainSystem` - Procedural terrain generation and rendering
- `VegetationSystem` - GPU-accelerated grass and vegetation

### Rendering Pipeline

**WebGPU-Only Rendering:**
- All materials use Three.js Shading Language (TSL)
- Post-processing effects (bloom, tone mapping) use TSL node materials
- No WebGL fallback - WebGPU is required

**Instanced Rendering:**
- `GLBResourceInstancer` - Rocks, ores, herbs (non-tree resources)
- `GLBTreeInstancer` - Trees with dissolve materials
- `PlaceholderInstancer` - Colored cube proxies for missing models
- Reduces draw calls from O(n) to O(1) per unique model
- Distance-based LOD switching (LOD0/LOD1/LOD2)
- Automatic depleted state transitions (tree → stump)

**Model Cache:**
- IndexedDB-based model caching for faster loads
- Preserves index buffer types (Uint16Array vs Uint32Array)
- Cache version 4 (invalidates corrupt entries from v3)

## Performance Optimizations

### Instanced Rendering

Resources (trees, rocks, ores, herbs) use instanced rendering for optimal performance:

**GLBResourceInstancer** (`src/systems/shared/world/GLBResourceInstancer.ts`):
- Pools instances by model path
- Separate `InstancedMesh` per LOD level (LOD0, LOD1, LOD2)
- Max 512 instances per model per LOD
- Distance-based LOD switching with hysteresis to prevent flickering
- Automatic depleted model transitions (e.g., tree → stump)

**GLBTreeInstancer** (`src/systems/shared/world/GLBTreeInstancer.ts`):
- Specialized instancer for tree resources
- Dissolve materials for fade effects
- Supports depleted models (stumps) with separate scale

**InstancedModelVisualStrategy** (`src/entities/world/visuals/InstancedModelVisualStrategy.ts`):
- Thin wrapper around GLBResourceInstancer
- Creates invisible collision proxy for raycasting
- Falls back to StandardModelVisualStrategy if instancing fails

**Depleted Models** (NEW):
- Resources can specify `depletedModelPath` and `depletedModelScale` in config
- Instancer maintains separate pools for normal and depleted states
- Automatic transition on resource depletion without individual model loading
- Collision proxy persists across state transitions
- Highlight mesh support for hover/selection on instanced entities

**API Changes**:
- `ResourceVisualStrategy.onDepleted()` now returns `boolean`
  - `true` = strategy handled depletion (instanced stump)
  - `false` = ResourceEntity should load individual depleted model
- New optional method: `getHighlightMesh(ctx)` for instanced entity highlighting
- `EntityHighlightService` supports instanced highlight meshes via `getHighlightRoot()`

### Model Cache Integrity

**Index Buffer Type Preservation** (Cache v4):
- Model cache now preserves original index buffer type (Uint16Array vs Uint32Array)
- Fixes silent geometry corruption and RangeError crashes on cached model restore
- Three.js uses Uint16Array for meshes with <65536 vertices
- Previous cache versions always deserialized as Uint32Array, causing corruption
- Cache version bumped to 4 to invalidate corrupt entries
- Affects all GLB models loaded via ModelCache (resources, NPCs, items)

## Usage

### Creating a World

```typescript
import { createClientWorld } from '@hyperscape/shared';

const world = createClientWorld();
await world.init();
```

### Spawning Entities

```typescript
import { PlayerEntity } from '@hyperscape/shared';

const player = new PlayerEntity(world, {
  id: 'player-1',
  position: { x: 0, y: 0, z: 0 },
  name: 'TestPlayer',
});

world.addEntity(player);
```

### Using Systems

```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
combatSystem.startAttack(attackerId, targetId);
```

### Instanced Resources

Resources automatically use instanced rendering when a GLB model is specified:

```typescript
// In resource config JSON
{
  "id": "oak_tree",
  "name": "Oak tree",
  "resourceType": "tree",
  "model": "/assets/world/resources/trees/oak.glb",
  "modelScale": 3.0,
  "depletedModelPath": "/assets/world/resources/trees/oak_stump.glb",
  "depletedModelScale": 0.3,
  "skill": "woodcutting",
  "level": 1,
  "xp": 25
}
```

The `InstancedModelVisualStrategy` will:
1. Load the model once and create an instanced mesh pool
2. Add this tree as an instance (no individual mesh)
3. Create an invisible collision proxy for raycasting
4. Automatically transition to stump model when depleted
5. Support hover highlighting via temporary highlight mesh

## Development

### Building

```bash
bun run build        # Production build
bun run dev          # Watch mode with hot reload
```

### Testing

```bash
npm test             # Run all tests
npm test -- --ui     # Run with Vitest UI
```

Tests use real Playwright browser sessions with WebGPU support. No mocks allowed.

### Linting

```bash
npm run lint         # Check for issues
npm run lint:fix     # Auto-fix issues
```

## API Reference

### Core Classes

- `World` - Main world container, manages entities and systems
- `Entity` - Base entity class
- `PlayerEntity` - Player character with inventory, skills, equipment
- `MobEntity` - NPC mob with AI and combat
- `ResourceEntity` - Gatherable resource (tree, rock, ore, herb)
- `ItemEntity` - Dropped item in the world

### Visual Strategies

Resource entities use pluggable visual strategies:

- `InstancedModelVisualStrategy` - Instanced rendering for GLB models (default)
- `TreeGLBVisualStrategy` - Instanced trees with dissolve materials
- `TreeProcgenVisualStrategy` - Procedurally generated trees
- `StandardModelVisualStrategy` - Individual mesh per resource (fallback)
- `PlaceholderVisualStrategy` - Colored cube proxy
- `FishingSpotVisualStrategy` - Fishing spot with glow effect

### Instancing API

**GLBResourceInstancer** (`src/systems/shared/world/GLBResourceInstancer.ts`):

```typescript
// Initialize (called by createClientWorld)
initGLBResourceInstancer(scene: THREE.Scene, world: World): void

// Add instance
addInstance(
  modelPath: string,
  entityId: string,
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  depletedModelPath?: string | null,
  depletedScale?: number
): Promise<boolean>

// Remove instance
removeInstance(entityId: string): void

// Set depleted state
setDepleted(entityId: string, depleted: boolean): void

// Check if entity is instanced
hasInstance(entityId: string): boolean

// Check if instancer has depleted model
hasDepleted(entityId: string): boolean

// Get highlight mesh for outlining
getHighlightMesh(entityId: string): THREE.Object3D | null

// Update LOD switching (called every frame)
updateGLBResourceInstancer(): void

// Cleanup
destroyGLBResourceInstancer(): void
```

**GLBTreeInstancer** (`src/systems/shared/world/GLBTreeInstancer.ts`):

Same API as GLBResourceInstancer, with tree-specific dissolve materials.

### ResourceVisualStrategy Interface

```typescript
interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  
  /**
   * @returns true if strategy handled depletion (instanced stump),
   *          false if ResourceEntity should load individual depleted model
   */
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;
  
  /** Return a temporary mesh positioned at this instance for the outline pass. */
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

## Dependencies

- `three` (0.180.0) - 3D rendering engine
- `@webgpu/types` - WebGPU TypeScript definitions
- `physx-js-webidl` - PhysX WASM bindings
- `react` (19.2.0) - UI components
- `@hyperscape/procgen` - Procedural generation

## Browser Requirements

- **WebGPU support is REQUIRED**
- Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- Check: [webgpureport.org](https://webgpureport.org)

## License

MIT
