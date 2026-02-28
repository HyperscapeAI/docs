# Instanced Rendering API Reference

This document describes the instanced rendering system for resource entities (trees, rocks, ores, herbs) in Hyperscape.

## Overview

Hyperscape uses instanced rendering to dramatically reduce draw calls for resource entities. Instead of O(n) draw calls per resource, the system uses O(1) draw calls per unique model per LOD level.

## Architecture

### GLBResourceInstancer

**Location**: `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`

Pools instances by model path with separate `InstancedMesh` per LOD level.

#### Constructor

```typescript
constructor(
  world: World,
  modelPath: string,
  maxInstances: number = 1000
)
```

#### Methods

##### `addInstance(entity: ResourceEntity, lodLevel: number): number`
Adds an entity instance at the specified LOD level.

**Returns**: Instance index

**Example**:
```typescript
const instancer = new GLBResourceInstancer(world, 'models/rock.glb');
const index = instancer.addInstance(rockEntity, 0); // LOD 0
```

##### `removeInstance(entity: ResourceEntity): void`
Removes an entity instance from all LOD levels.

##### `updateInstance(entity: ResourceEntity, lodLevel: number): void`
Updates instance transform and visibility.

##### `setLODLevel(entity: ResourceEntity, newLOD: number): void`
Switches entity to a different LOD level with hysteresis to prevent flickering.

##### `dispose(): void`
Cleans up all instanced meshes and releases GPU resources.

### GLBTreeInstancer

**Location**: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`

Specialized instancer for tree resources with dissolve materials and depleted model support.

#### Depleted Models (NEW)

Trees can specify `depletedModelPath` and `depletedModelScale` in their resource configuration:

```json
{
  "id": "tree_oak",
  "modelPath": "models/tree_oak.glb",
  "depletedModelPath": "models/stump_oak.glb",
  "depletedModelScale": 0.8
}
```

The instancer maintains separate pools for normal and depleted states:

```typescript
// Automatic transition on depletion
treeInstancer.transitionToDepleted(treeEntity);
```

#### Methods

##### `transitionToDepleted(entity: ResourceEntity): boolean`
Transitions entity from tree to stump model.

**Returns**: `true` if transition succeeded, `false` if depleted model not configured

**Example**:
```typescript
if (treeInstancer.transitionToDepleted(entity)) {
  // Instancer handled depletion (tree → stump)
} else {
  // Load individual depleted model
  await entity.loadDepletedModel();
}
```

##### `getHighlightMesh(entity: ResourceEntity): Mesh | null` (NEW)
Returns a highlight mesh for hover/selection on instanced entities.

**Usage**:
```typescript
const highlightMesh = treeInstancer.getHighlightMesh(entity);
if (highlightMesh) {
  scene.add(highlightMesh);
}
```

### InstancedModelVisualStrategy

**Location**: `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`

Thin wrapper strategy that uses instancers with invisible collision proxies for raycasting.

#### Constructor

```typescript
constructor(
  instancer: GLBResourceInstancer | GLBTreeInstancer,
  config: ResourceConfig
)
```

#### Methods

##### `onDepleted(): boolean` (CHANGED)
Handles resource depletion.

**Returns**:
- `true` = strategy handled depletion (instanced stump)
- `false` = ResourceEntity should load individual depleted model

**Breaking Change**: Return type changed from `void` to `boolean`

**Migration**:
```typescript
// Before
onDepleted() {
  // Handle depletion
}

// After
onDepleted(): boolean {
  if (this.instancer.transitionToDepleted(this.entity)) {
    return true; // Instancer handled it
  }
  return false; // Entity should load depleted model
}
```

##### `getHighlightMesh(ctx: RenderContext): Mesh | null` (NEW)
Returns highlight mesh for instanced entity.

**Usage**:
```typescript
const highlightMesh = strategy.getHighlightMesh(ctx);
```

### ResourceEntity

**Location**: `packages/shared/src/entities/world/ResourceEntity.ts`

#### Methods

##### `getHighlightRoot(): Object3D` (NEW)
Returns the root object for highlighting (supports instanced meshes).

**Usage**:
```typescript
const root = entity.getHighlightRoot();
// Returns instanced highlight mesh if available, otherwise entity mesh
```

**Impact**: `EntityHighlightService` now supports instanced entity highlighting.

## Configuration

### Resource Manifest

Add `depletedModelPath` and `depletedModelScale` to resource configs:

```json
{
  "resources": [
    {
      "id": "tree_willow",
      "name": "Willow tree",
      "modelPath": "models/trees/willow.glb",
      "depletedModelPath": "models/trees/willow_stump.glb",
      "depletedModelScale": 0.75,
      "respawnTime": 60,
      "skill": "woodcutting",
      "level": 30
    }
  ]
}
```

## Performance Benefits

### Draw Call Reduction

**Before** (individual meshes):
- 1000 oak trees = 1000 draw calls
- 500 willow trees = 500 draw calls
- **Total**: 1500 draw calls

**After** (instanced rendering):
- 1000 oak trees = 1 draw call (per LOD level)
- 500 willow trees = 1 draw call (per LOD level)
- **Total**: 2-6 draw calls (depending on LOD levels active)

### Memory Efficiency

- Single geometry shared across all instances
- Minimal per-instance data (transform matrix)
- Automatic LOD switching reduces vertex count at distance

## LOD System Integration

Instanced rendering integrates with distance-based LOD:

```typescript
// LOD levels automatically managed
const distance = entity.position.distanceTo(camera.position);

if (distance < 50) {
  instancer.setLODLevel(entity, 0); // High detail
} else if (distance < 100) {
  instancer.setLODLevel(entity, 1); // Medium detail
} else {
  instancer.setLODLevel(entity, 2); // Low detail
}
```

**Hysteresis**: LOD switching includes hysteresis to prevent flickering at LOD boundaries.

## Fallback Behavior

If instancing fails (e.g., model loading error), the system automatically falls back to `StandardModelVisualStrategy`:

```typescript
try {
  return new InstancedModelVisualStrategy(instancer, config);
} catch (error) {
  console.warn('Instancing failed, using standard strategy:', error);
  return new StandardModelVisualStrategy(config);
}
```

## Collision Proxies

Instanced entities use invisible collision proxies for raycasting:

- Proxy persists across state transitions (tree → stump)
- Enables mouse hover and selection on instanced meshes
- Minimal performance overhead

## Model Cache Integration

### Index Buffer Type Preservation (CRITICAL FIX)

**Location**: `packages/shared/src/utils/rendering/ModelCache.ts`

**Issue**: Model cache was not preserving original index buffer type (Uint16Array vs Uint32Array), causing silent geometry corruption and RangeError crashes.

**Fix**: Cache version bumped to 4, now preserves index buffer type:

```typescript
// Cache entry now includes index buffer type
interface CachedModel {
  geometry: BufferGeometry;
  indexType: 'uint16' | 'uint32'; // NEW
  // ... other fields
}
```

**Impact**: Affects all GLB models loaded via ModelCache (resources, NPCs, items).

**Migration**: Existing cache entries are automatically invalidated (version 4).

## Related APIs

### EntityHighlightService

**Location**: `packages/shared/src/systems/client/interaction/services/EntityHighlightService.ts`

Now supports instanced highlight meshes via `getHighlightRoot()`:

```typescript
const root = entity.getHighlightRoot();
// Returns instanced highlight mesh if available
```

### ResourceVisualStrategy

**Location**: `packages/shared/src/entities/world/visuals/ResourceVisualStrategy.ts`

Base interface for all resource visual strategies.

#### `onDepleted(): boolean`
Called when resource is depleted.

**Returns**:
- `true` = strategy handled depletion
- `false` = entity should load depleted model

#### `getHighlightMesh(ctx: RenderContext): Mesh | null` (OPTIONAL)
Returns highlight mesh for entity.

**Default**: Returns `null` (no custom highlight)

## Example: Creating a Custom Instanced Resource

```typescript
import { GLBResourceInstancer } from '@hyperscape/shared';

// 1. Create instancer for your model
const rockInstancer = new GLBResourceInstancer(
  world,
  'models/rocks/granite.glb',
  500 // max instances
);

// 2. Create visual strategy
const strategy = new InstancedModelVisualStrategy(
  rockInstancer,
  resourceConfig
);

// 3. Assign to resource entity
resourceEntity.setVisualStrategy(strategy);

// 4. Instancer automatically manages LOD and rendering
// 5. Clean up on world shutdown
rockInstancer.dispose();
```

## Debugging

### Check Instance Counts

```typescript
console.log('Active instances:', instancer.getInstanceCount());
console.log('LOD 0 instances:', instancer.getLODInstanceCount(0));
```

### Verify Geometry Disposal

```typescript
// Check if geometry is disposed after cache clear
modelCache.clear();
// All geometries should have geometry.dispose() called
```

### Monitor Draw Calls

Use Chrome DevTools Performance tab:
1. Record performance
2. Look for "Draw calls" in GPU section
3. Should see dramatic reduction with instancing

## Performance Considerations

### When to Use Instancing

**Good candidates**:
- Many instances of same model (>10)
- Static or infrequently updated transforms
- Shared material properties

**Poor candidates**:
- Unique models (only 1-2 instances)
- Frequently changing materials
- Per-instance material variations

### Memory Trade-offs

**Pros**:
- Reduced draw calls (major GPU performance win)
- Shared geometry (reduced VRAM)
- Efficient transform updates

**Cons**:
- All instances share same material
- Matrix updates require buffer uploads
- Collision proxies add minimal overhead

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Performance Optimizations section
- [AGENTS.md](../AGENTS.md) - Instanced Rendering section
- [Model Cache Integrity](../CLAUDE.md#model-cache-integrity)
