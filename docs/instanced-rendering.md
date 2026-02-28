# Instanced Rendering System

Hyperscape uses GPU instancing to render thousands of resources (trees, rocks, ores, herbs) with minimal draw calls. This document explains the instanced rendering architecture and how to use it.

## Overview

**Problem**: Rendering 1000+ individual resources (trees, rocks, etc.) with separate draw calls causes severe performance degradation.

**Solution**: Use `THREE.InstancedMesh` to batch all instances of the same model into a single draw call per LOD level.

**Performance Impact**:
- **Before**: O(n) draw calls per resource type (1000 trees = 1000 draw calls)
- **After**: O(1) draw calls per unique model per LOD level (1000 trees = 3 draw calls for LOD0/LOD1/LOD2)

## Architecture

### Components

1. **GLBTreeInstancer** (`packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`)
   - Handles tree-specific instancing
   - Supports dissolve materials for fade effects
   - Distance-based LOD switching with hysteresis

2. **GLBResourceInstancer** (`packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`)
   - Handles rocks, ores, herbs, and other non-tree resources
   - Separate depleted model pool for harvested resources
   - Invisible collision proxies for raycasting

3. **Visual Strategies**:
   - **TreeGLBVisualStrategy** - Uses GLBTreeInstancer
   - **InstancedModelVisualStrategy** - Uses GLBResourceInstancer
   - **StandardModelVisualStrategy** - Fallback for non-instanced rendering

### How It Works

1. **Model Loading**:
   - Each unique model path creates a pool
   - LOD0, LOD1, LOD2 variants loaded automatically
   - Geometry extracted by reference (shared across instances)

2. **Instance Management**:
   - Each entity calls `addInstance(modelPath, entityId, position, rotation, scale)`
   - Instance matrix stored in `InstancedMesh.instanceMatrix`
   - Entities tracked in `Map<entityId, ResourceSlot>`

3. **LOD Switching**:
   - Every frame, check distance from camera to each instance
   - Move instances between LOD pools (swap-and-pop algorithm)
   - Hysteresis prevents LOD thrashing at boundaries

4. **Depleted State**:
   - Resources can transition to depleted model (e.g., tree stump)
   - Separate `InstancedMesh` for depleted instances
   - Collision proxy remains for interaction

## Usage

### Adding Instanced Rendering to a Resource

1. **Set visual strategy** in `createVisualStrategy.ts`:

```typescript
import { InstancedModelVisualStrategy } from './InstancedModelVisualStrategy';

export function createVisualStrategy(config: ResourceConfig): ResourceVisualStrategy {
  if (config.model && config.resourceType !== 'tree') {
    return new InstancedModelVisualStrategy();
  }
  // ... other strategies
}
```

2. **Configure resource manifest** with LOD models:

```json
{
  "id": "iron_ore",
  "name": "Iron ore",
  "model": "rocks/iron_ore.glb",
  "modelScale": 1.0,
  "depletedModelPath": "rocks/iron_ore_depleted.glb",
  "depletedModelScale": 0.3
}
```

3. **LOD models** (auto-detected):
   - `iron_ore.glb` → LOD0 (high detail)
   - `iron_ore_lod1.glb` → LOD1 (medium detail)
   - `iron_ore_lod2.glb` → LOD2 (low detail)

### Initialization

Instancers are initialized in `createClientWorld.ts`:

```typescript
import { initGLBTreeInstancer } from './systems/shared/world/GLBTreeInstancer';
import { initGLBResourceInstancer } from './systems/shared/world/GLBResourceInstancer';

export function createClientWorld() {
  // ... world setup
  
  initGLBTreeInstancer(scene, world);
  initGLBResourceInstancer(scene, world);
  
  // ... rest of setup
}
```

### API Reference

#### GLBResourceInstancer

```typescript
// Initialize (called once at world creation)
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

// Check if depleted model is available
hasDepleted(entityId: string): boolean

// Get highlight mesh for hover effects
getHighlightMesh(entityId: string): THREE.Object3D | null

// Update LOD switching (called every frame)
updateGLBResourceInstancer(): void

// Cleanup
destroyGLBResourceInstancer(): void
```

#### InstancedModelVisualStrategy

```typescript
class InstancedModelVisualStrategy implements ResourceVisualStrategy {
  // Create visual (adds instance to pool)
  async createVisual(ctx: ResourceVisualContext): Promise<void>
  
  // Handle depletion (switches to depleted pool)
  async onDepleted(ctx: ResourceVisualContext): Promise<boolean>
  
  // Get highlight mesh for hover effects
  getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null
  
  // Handle respawn (switches back to normal pool)
  async onRespawn(ctx: ResourceVisualContext): Promise<void>
  
  // Update (calls updateGLBResourceInstancer)
  update(ctx: ResourceVisualContext, deltaTime: number): void
  
  // Cleanup (removes instance from pool)
  destroy(ctx: ResourceVisualContext): void
}
```

## LOD Configuration

LOD distances are configured in `GPUVegetation.ts`:

```typescript
export const GPU_VEG_CONFIG = {
  // Resource LOD distances
  RESOURCE_LOD1_DISTANCE: 30,  // Switch to LOD1 at 30 units
  RESOURCE_LOD2_DISTANCE: 60,  // Switch to LOD2 at 60 units
  
  // Tree LOD distances
  TREE_LOD1_DISTANCE: 40,
  TREE_LOD2_DISTANCE: 80,
  
  // Fade distances for dissolve materials
  FADE_START: 100,
  FADE_END: 120,
};
```

### Hysteresis

LOD switching uses hysteresis to prevent thrashing at boundaries:

```typescript
const hysteresisSq = 0.81; // 90% of distance

if (distSq < lod1DistSq * hysteresisSq) {
  targetLOD = 0; // Stay in LOD0
} else if (distSq < lod1DistSq) {
  targetLOD = currentLOD === 0 ? 0 : 1; // Don't downgrade immediately
}
```

## Performance Characteristics

### Memory Usage

- **Per Model Pool**: ~2-5 MB (geometry + materials for 3 LOD levels)
- **Per Instance**: ~64 bytes (4x4 matrix in `instanceMatrix` buffer)
- **1000 instances**: ~64 KB + model pool overhead

### Draw Calls

- **Without instancing**: 1000 resources = 1000 draw calls
- **With instancing**: 1000 resources = 3 draw calls (LOD0 + LOD1 + LOD2)
- **Reduction**: 99.7% fewer draw calls

### CPU Overhead

- **LOD switching**: O(n) per frame (checks distance for each instance)
- **Matrix updates**: Only when instances move between LOD pools
- **Typical cost**: <1ms for 1000 instances on modern CPUs

## Limitations

1. **Max instances per pool**: 512 (configurable via `MAX_INSTANCES`)
2. **Static instances**: Instances cannot move after creation
3. **Shared materials**: All instances of a model share the same material
4. **No per-instance colors**: Use vertex colors in the model instead

## Fallback Behavior

If instancing fails (pool full, model load error), the strategy automatically falls back to `StandardModelVisualStrategy`:

```typescript
const success = await addResourceInstance(...);

if (success) {
  this.instanced = true;
  createCollisionProxy(ctx, baseScale);
  return;
}

// Fallback to standard rendering
this.fallback = new StandardModelVisualStrategy();
await this.fallback.createVisual(ctx);
```

## Debugging

### Enable Instancer Logging

Set `DEBUG=hyperscape:instancer` to see detailed logs:

```bash
DEBUG=hyperscape:instancer bun run dev
```

### Check Instance Counts

```typescript
// In browser console
const world = window.__HYPERSCAPE_WORLD__;
const stats = world.getSystem('vegetation').getInstancerStats();
console.log(stats);
// {
//   trees: { lod0: 234, lod1: 456, lod2: 310 },
//   resources: { lod0: 123, lod1: 234, lod2: 345, depleted: 45 }
// }
```

### Visual Debugging

Enable wireframe mode to see instanced meshes:

```typescript
// In browser console
const scene = window.__HYPERSCAPE_WORLD__.scene;
scene.traverse((obj) => {
  if (obj instanceof THREE.InstancedMesh) {
    obj.material.wireframe = true;
  }
});
```

## Migration Guide

### Converting from Standard to Instanced Rendering

1. **Update visual strategy factory**:

```diff
// packages/shared/src/entities/world/visuals/createVisualStrategy.ts
+ import { InstancedModelVisualStrategy } from './InstancedModelVisualStrategy';

  export function createVisualStrategy(config: ResourceConfig) {
+   if (config.model && config.resourceType !== 'tree') {
+     return new InstancedModelVisualStrategy();
+   }
    // ... existing strategies
  }
```

2. **Add LOD models** (optional but recommended):
   - Create `model_lod1.glb` and `model_lod2.glb` variants
   - Use decimation tools: `bun run scripts/optimize-models-full.mjs`

3. **Test performance**:
   - Spawn 100+ instances of the resource
   - Check FPS and draw calls in DevTools Performance panel
   - Verify LOD switching works correctly

## Best Practices

1. **Use LOD models**: Provide LOD1 and LOD2 variants for better performance
2. **Optimize geometry**: Keep triangle count low (LOD0: <5k, LOD1: <2k, LOD2: <500)
3. **Share textures**: Use texture atlases to reduce memory usage
4. **Batch similar resources**: Group resources by model to maximize instancing benefits
5. **Monitor pool usage**: If pools fill up (512 instances), consider splitting into sub-types

## Related Files

- `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts` - Resource instancer implementation
- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - Tree instancer implementation
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts` - Visual strategy wrapper
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts` - Tree visual strategy
- `packages/shared/src/systems/shared/world/GPUVegetation.ts` - LOD configuration and dissolve materials
- `packages/shared/src/runtime/createClientWorld.ts` - Instancer initialization
