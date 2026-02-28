# Instanced Rendering API

Hyperscape uses instanced rendering for resource entities (rocks, ores, herbs, trees) to dramatically reduce draw calls and improve performance.

## Overview

**Instanced rendering** pools multiple instances of the same 3D model into a single `THREE.InstancedMesh`, reducing draw calls from O(n) per resource to O(1) per unique model per LOD level.

**Key Benefits:**
- Reduces draw calls by 100-1000x for resource-heavy scenes
- Distance-based LOD switching with hysteresis to prevent flickering
- Automatic depleted model transitions (e.g., tree → stump)
- Highlight mesh support for hover/selection on instanced entities
- Falls back to individual models if instancing fails

## Architecture

### Components

1. **GLBResourceInstancer** - Pools instances for rocks, ores, herbs (non-tree resources)
2. **GLBTreeInstancer** - Specialized instancer for tree resources with dissolve materials
3. **InstancedModelVisualStrategy** - Visual strategy that uses instancers
4. **ResourceVisualStrategy** - Base interface for resource rendering

### Model Pools

Each unique model path gets a **ModelPool** with:
- **LOD0, LOD1, LOD2 pools**: Separate `InstancedMesh` for each LOD level
- **Depleted pool**: Separate pool for depleted state (e.g., tree stump)
- **Highlight meshes**: Pre-loaded meshes for hover/selection highlighting
- **Instance tracking**: Maps entity IDs to matrix indices

### LOD System

**Distance-based LOD switching:**
- LOD0: < 30m (high detail)
- LOD1: 30-60m (medium detail)
- LOD2: > 60m (low detail)
- **Hysteresis**: 0.81x multiplier prevents flickering at LOD boundaries

**LOD file naming convention:**
- LOD0: `model.glb`
- LOD1: `model_lod1.glb` (auto-inferred)
- LOD2: `model_lod2.glb` (auto-inferred)

## API Reference

### GLBResourceInstancer

#### `initGLBResourceInstancer(scene: THREE.Scene, world: World): void`

Initialize the instancer system. Must be called before using any other functions.

**Parameters:**
- `scene` - Three.js scene to add instanced meshes to
- `world` - Hyperscape world instance

**Example:**
```typescript
import { initGLBResourceInstancer } from '@hyperscape/shared';

initGLBResourceInstancer(scene, world);
```

#### `addInstance(modelPath, entityId, position, rotation, scale, depletedModelPath?, depletedScale?): Promise<boolean>`

Add a new instance to the pool.

**Parameters:**
- `modelPath: string` - Path to GLB model (LOD0)
- `entityId: string` - Unique entity identifier
- `position: THREE.Vector3` - World position
- `rotation: number` - Y-axis rotation in radians
- `scale: number` - Uniform scale factor
- `depletedModelPath?: string | null` - Optional path to depleted model (e.g., stump)
- `depletedScale?: number` - Scale for depleted model (defaults to `scale`)

**Returns:** `Promise<boolean>` - `true` if instance was added successfully

**Example:**
```typescript
const success = await addInstance(
  '/assets/models/tree_oak.glb',
  'tree_123',
  new THREE.Vector3(10, 0, 20),
  Math.PI / 4,  // 45° rotation
  1.2,          // 120% scale
  '/assets/models/stump_oak.glb',  // Depleted model
  0.8           // Stump is 80% scale
);
```

#### `removeInstance(entityId: string): void`

Remove an instance from the pool.

**Parameters:**
- `entityId: string` - Entity identifier to remove

**Example:**
```typescript
removeInstance('tree_123');
```

#### `setDepleted(entityId: string, depleted: boolean): void`

Toggle instance between normal and depleted state.

**Parameters:**
- `entityId: string` - Entity identifier
- `depleted: boolean` - `true` for depleted state, `false` for normal

**Example:**
```typescript
// Tree was chopped down - show stump
setDepleted('tree_123', true);

// Tree respawned - show full tree
setDepleted('tree_123', false);
```

#### `hasInstance(entityId: string): boolean`

Check if an entity is managed by the instancer.

**Returns:** `boolean` - `true` if entity is instanced

#### `hasDepleted(entityId: string): boolean`

Check if an entity has a depleted model configured.

**Returns:** `boolean` - `true` if depleted model is available

#### `getHighlightMesh(entityId: string): THREE.Object3D | null`

Get a highlight mesh for hover/selection effects.

**Returns:** `THREE.Object3D | null` - Positioned highlight mesh, or `null` if not available

**Example:**
```typescript
const highlightMesh = getHighlightMesh('tree_123');
if (highlightMesh) {
  scene.add(highlightMesh);
  highlightMesh.material.opacity = 0.3;
}
```

#### `updateGLBResourceInstancer(): void`

Update LOD levels and materials. Call once per frame.

**Example:**
```typescript
// In your render loop
function tick() {
  updateGLBResourceInstancer();
  renderer.render(scene, camera);
}
```

#### `destroyGLBResourceInstancer(): void`

Clean up all resources. Call when shutting down.

**Example:**
```typescript
destroyGLBResourceInstancer();
```

### GLBTreeInstancer

Same API as `GLBResourceInstancer` but specialized for trees:
- Uses dissolve materials for fade effects
- Optimized for tree-specific rendering
- Separate namespace to avoid conflicts

**Functions:**
- `initGLBTreeInstancer(scene, world)`
- `addTreeInstance(modelPath, entityId, position, rotation, scale, depletedModelPath?, depletedScale?)`
- `removeTreeInstance(entityId)`
- `setTreeDepleted(entityId, depleted)`
- `hasTreeInstance(entityId)`
- `hasTreeDepleted(entityId)`
- `getTreeHighlightMesh(entityId)`
- `updateGLBTreeInstancer()`
- `destroyGLBTreeInstancer()`

## Visual Strategy Integration

### ResourceVisualStrategy Interface

```typescript
interface ResourceVisualStrategy {
  /**
   * Called when resource is depleted.
   * @returns true if strategy handled depletion (e.g., instanced stump)
   *          false if ResourceEntity should load individual depleted model
   */
  onDepleted(): boolean;

  /**
   * Optional: Get highlight mesh for hover/selection.
   * @returns Positioned highlight mesh, or null if not supported
   */
  getHighlightMesh?(ctx: ResourceContext): THREE.Object3D | null;
}
```

### InstancedModelVisualStrategy

Visual strategy that uses `GLBResourceInstancer` for rendering.

**Constructor:**
```typescript
new InstancedModelVisualStrategy(
  modelPath: string,
  depletedModelPath?: string | null,
  depletedModelScale?: number
)
```

**Methods:**
- `onDepleted(): boolean` - Returns `true` (instancer handles depletion)
- `getHighlightMesh(ctx): THREE.Object3D | null` - Returns highlight mesh from instancer

**Example:**
```typescript
import { InstancedModelVisualStrategy } from '@hyperscape/shared';

const strategy = new InstancedModelVisualStrategy(
  '/assets/models/rock_granite.glb',
  null,  // No depleted model for rocks
  1.0
);
```

### TreeGLBVisualStrategy

Visual strategy for trees using `GLBTreeInstancer`.

**Constructor:**
```typescript
new TreeGLBVisualStrategy(
  modelPath: string,
  depletedModelPath?: string | null,
  depletedModelScale?: number
)
```

**Example:**
```typescript
import { TreeGLBVisualStrategy } from '@hyperscape/shared';

const strategy = new TreeGLBVisualStrategy(
  '/assets/models/tree_oak.glb',
  '/assets/models/stump_oak.glb',
  0.8  // Stump is 80% of tree scale
);
```

## ResourceEntity Integration

### getHighlightRoot()

ResourceEntity now provides `getHighlightRoot()` method for instanced highlighting:

```typescript
class ResourceEntity {
  /**
   * Get the root object for highlighting (collision proxy or highlight mesh).
   * For instanced resources, returns the highlight mesh from the instancer.
   * For standard resources, returns the collision proxy.
   */
  getHighlightRoot(): THREE.Object3D | null {
    // Try to get highlight mesh from strategy
    if (this.visualStrategy?.getHighlightMesh) {
      const highlightMesh = this.visualStrategy.getHighlightMesh(this);
      if (highlightMesh) return highlightMesh;
    }
    // Fallback to collision proxy
    return this.collisionProxy;
  }
}
```

### EntityHighlightService

The highlight service now supports instanced meshes:

```typescript
// EntityHighlightService.ts
const highlightRoot = entity.getHighlightRoot?.() ?? entity.node;
if (highlightRoot) {
  // Apply highlight effect to instanced mesh or collision proxy
  applyHighlight(highlightRoot);
}
```

## Configuration

### Resource Manifest

Configure instanced rendering in resource manifests:

```json
{
  "id": "tree_oak",
  "name": "Oak Tree",
  "modelPath": "/assets/models/tree_oak.glb",
  "depletedModelPath": "/assets/models/stump_oak.glb",
  "depletedModelScale": 0.8,
  "useInstancing": true,
  "skill": "woodcutting",
  "level": 1
}
```

**Fields:**
- `modelPath` - Path to LOD0 model (required)
- `depletedModelPath` - Path to depleted model (optional)
- `depletedModelScale` - Scale multiplier for depleted model (optional, defaults to 1.0)
- `useInstancing` - Enable instanced rendering (optional, defaults to true for resources)

### LOD Configuration

LOD distances are configured in `GPUVegetation.ts`:

```typescript
export const GPU_VEG_CONFIG = {
  RESOURCE_LOD1_DISTANCE: 30,  // Switch to LOD1 at 30m
  RESOURCE_LOD2_DISTANCE: 60,  // Switch to LOD2 at 60m
  TREE_LOD1_DISTANCE: 40,      // Trees use different distances
  TREE_LOD2_DISTANCE: 80,
};
```

## Performance Characteristics

### Draw Call Reduction

**Without instancing:**
- 1000 trees = 1000 draw calls
- 500 rocks = 500 draw calls
- **Total: 1500 draw calls**

**With instancing:**
- 1000 oak trees = 3 draw calls (LOD0, LOD1, LOD2)
- 500 granite rocks = 3 draw calls (LOD0, LOD1, LOD2)
- **Total: 6 draw calls** (250x reduction!)

### Memory Usage

**Geometry sharing:**
- Each unique model loaded once
- All instances share the same geometry
- Only matrix data (16 floats) stored per instance

**Typical savings:**
- 1000 trees without instancing: ~500MB geometry data
- 1000 trees with instancing: ~500KB geometry + 64KB matrices = ~564KB (1000x reduction!)

### LOD Switching Performance

- LOD updates run once per frame
- O(n) complexity where n = number of instances
- Hysteresis prevents flickering (0.81x multiplier)
- Typical cost: ~0.1ms for 1000 instances

## Limitations

### Maximum Instances

- **MAX_INSTANCES = 512** per model per LOD level
- If exceeded, new instances fall back to `StandardModelVisualStrategy`
- Logged as warning: `"LOD0 pool full for {modelPath}, cannot add {entityId}"`

### Collision Proxies

- Instanced meshes are not raycastable
- Each instance has an invisible collision proxy for raycasting
- Collision proxy persists across state transitions (normal ↔ depleted)

### Material Limitations

- All instances of a model share the same material
- Per-instance material variations not supported
- Use different models for material variants

## Troubleshooting

### Instances Not Rendering

**Check:**
1. `initGLBResourceInstancer()` was called
2. Model path is correct and file exists
3. Model has valid geometry (check with `extractGeometryAndMaterial`)
4. Instance count < MAX_INSTANCES (512)

**Debug:**
```typescript
import { hasInstance } from '@hyperscape/shared';

if (!hasInstance('tree_123')) {
  console.error('Instance not found - check addInstance() return value');
}
```

### LOD Not Switching

**Check:**
1. `updateGLBResourceInstancer()` is called every frame
2. Camera is set on world: `world.camera`
3. LOD files exist (`model_lod1.glb`, `model_lod2.glb`)

**Debug:**
```typescript
// Check LOD pool status
const pool = pools.get('/assets/models/tree_oak.glb');
console.log('LOD0 count:', pool?.lod0?.activeCount);
console.log('LOD1 count:', pool?.lod1?.activeCount);
console.log('LOD2 count:', pool?.lod2?.activeCount);
```

### Depleted Models Not Showing

**Check:**
1. `depletedModelPath` was provided to `addInstance()`
2. Depleted model file exists
3. `setDepleted(entityId, true)` was called

**Debug:**
```typescript
import { hasDepleted } from '@hyperscape/shared';

if (!hasDepleted('tree_123')) {
  console.error('No depleted model configured for this instance');
}
```

### Highlight Not Working

**Check:**
1. Strategy implements `getHighlightMesh()` method
2. `getHighlightRoot()` is called instead of accessing `entity.node` directly
3. Highlight mesh is added to scene

**Debug:**
```typescript
const highlightMesh = entity.getHighlightRoot();
if (!highlightMesh) {
  console.error('No highlight mesh available');
} else {
  console.log('Highlight mesh:', highlightMesh);
  scene.add(highlightMesh);
}
```

## Migration Guide

### From StandardModelVisualStrategy to InstancedModelVisualStrategy

**Before:**
```typescript
// Old approach - individual model per resource
const strategy = new StandardModelVisualStrategy(
  '/assets/models/tree_oak.glb',
  '/assets/models/stump_oak.glb'
);
```

**After:**
```typescript
// New approach - instanced rendering
const strategy = new InstancedModelVisualStrategy(
  '/assets/models/tree_oak.glb',
  '/assets/models/stump_oak.glb',
  0.8  // Stump scale
);
```

### Updating ResourceVisualStrategy Implementations

**Before:**
```typescript
class MyVisualStrategy implements ResourceVisualStrategy {
  onDepleted(): void {
    // Load depleted model
    this.loadDepletedModel();
  }
}
```

**After:**
```typescript
class MyVisualStrategy implements ResourceVisualStrategy {
  onDepleted(): boolean {
    // Return true if strategy handles depletion
    if (this.hasDepletedModel) {
      this.loadDepletedModel();
      return true;
    }
    // Return false to let ResourceEntity load individual model
    return false;
  }

  // Optional: Provide highlight mesh for instanced entities
  getHighlightMesh?(ctx: ResourceContext): THREE.Object3D | null {
    return getHighlightMesh(ctx.entityId);
  }
}
```

### Updating EntityHighlightService

**Before:**
```typescript
// Old approach - always use entity.node
const targetObject = entity.node;
applyHighlight(targetObject);
```

**After:**
```typescript
// New approach - use getHighlightRoot() for instanced support
const targetObject = entity.getHighlightRoot?.() ?? entity.node;
applyHighlight(targetObject);
```

## Best Practices

### 1. Use Instancing for Repeated Models

**Good:**
```typescript
// 100 oak trees - use instancing
for (let i = 0; i < 100; i++) {
  const strategy = new InstancedModelVisualStrategy(
    '/assets/models/tree_oak.glb',
    '/assets/models/stump_oak.glb',
    0.8
  );
}
```

**Bad:**
```typescript
// 100 oak trees - individual models (1000x more draw calls!)
for (let i = 0; i < 100; i++) {
  const strategy = new StandardModelVisualStrategy(
    '/assets/models/tree_oak.glb',
    '/assets/models/stump_oak.glb'
  );
}
```

### 2. Provide LOD Models

**Good:**
```
/assets/models/tree_oak.glb       (LOD0 - high detail)
/assets/models/tree_oak_lod1.glb  (LOD1 - medium detail)
/assets/models/tree_oak_lod2.glb  (LOD2 - low detail)
```

**Acceptable:**
```
/assets/models/tree_oak.glb       (LOD0 only)
```
Instancer will use LOD0 for all distances if LOD1/LOD2 don't exist.

### 3. Configure Depleted Models

**Good:**
```typescript
// Provide depleted model for smooth transitions
new InstancedModelVisualStrategy(
  '/assets/models/tree_oak.glb',
  '/assets/models/stump_oak.glb',
  0.8
);
```

**Acceptable:**
```typescript
// No depleted model - instance is removed when depleted
new InstancedModelVisualStrategy(
  '/assets/models/rock_granite.glb',
  null,
  1.0
);
```

### 4. Use Appropriate Scales

**Good:**
```typescript
// Stump is smaller than tree
depletedScale: 0.8  // 80% of original scale
```

**Bad:**
```typescript
// Stump same size as tree (unrealistic)
depletedScale: 1.0
```

### 5. Call Update Every Frame

**Good:**
```typescript
function tick() {
  updateGLBResourceInstancer();
  updateGLBTreeInstancer();
  renderer.render(scene, camera);
}
```

**Bad:**
```typescript
function tick() {
  // Missing update - LOD won't switch!
  renderer.render(scene, camera);
}
```

## Advanced Usage

### Custom LOD Distances

Modify `GPU_VEG_CONFIG` in `GPUVegetation.ts`:

```typescript
export const GPU_VEG_CONFIG = {
  RESOURCE_LOD1_DISTANCE: 40,  // Increase LOD1 distance
  RESOURCE_LOD2_DISTANCE: 80,  // Increase LOD2 distance
};
```

### Custom Highlight Materials

```typescript
const highlightMesh = getHighlightMesh('tree_123');
if (highlightMesh instanceof THREE.Mesh) {
  highlightMesh.material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    opacity: 0.3,
    transparent: true,
  });
}
```

### Monitoring Instance Counts

```typescript
// Access internal pools for debugging (not recommended for production)
import { pools } from './GLBResourceInstancer';

for (const [modelPath, pool] of pools.entries()) {
  console.log(`${modelPath}:`);
  console.log(`  LOD0: ${pool.lod0?.activeCount ?? 0} instances`);
  console.log(`  LOD1: ${pool.lod1?.activeCount ?? 0} instances`);
  console.log(`  LOD2: ${pool.lod2?.activeCount ?? 0} instances`);
  console.log(`  Depleted: ${pool.depleted?.activeCount ?? 0} instances`);
}
```

## Related Documentation

- [Model Cache Integrity](./model-cache-integrity.md) - Index buffer type preservation
- [GPU Vegetation System](../packages/shared/src/systems/shared/world/GPUVegetation.ts) - Dissolve materials and LOD configuration
- [Resource System](../packages/shared/src/entities/world/ResourceEntity.ts) - Resource entity implementation
- [Visual Strategies](../packages/shared/src/entities/world/visuals/) - All visual strategy implementations
