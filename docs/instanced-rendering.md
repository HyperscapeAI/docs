# Instanced Rendering System

Hyperscape uses GPU instancing to efficiently render thousands of identical resources (trees, rocks, ores, herbs) with minimal draw calls.

## Overview

The instanced rendering system replaces per-entity GLB cloning with `THREE.InstancedMesh`-based rendering, reducing draw calls from O(n) per resource type to O(1) per unique model per LOD level.

**Performance Impact:**
- **Before**: 1000 trees = 1000 draw calls
- **After**: 1000 trees = 3 draw calls (LOD0, LOD1, LOD2)

## Architecture

### Components

1. **GLBTreeInstancer** (`packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`)
   - Handles tree resources with GLB models
   - Manages LOD switching based on camera distance
   - Supports depleted state (stumps) via separate instanced pool

2. **GLBResourceInstancer** (`packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`)
   - Handles non-tree resources (rocks, ores, herbs)
   - Same LOD and depletion system as trees
   - Separate from trees to allow different LOD distances

3. **Visual Strategies**:
   - `TreeGLBVisualStrategy` - Integrates with GLBTreeInstancer
   - `InstancedModelVisualStrategy` - Integrates with GLBResourceInstancer
   - `StandardModelVisualStrategy` - Fallback for non-instanced rendering

### How It Works

1. **Model Loading**: Each unique model (e.g., `oak_tree.glb`) is loaded once
2. **Geometry Extraction**: Geometry and materials are extracted by reference
3. **Instance Pooling**: All instances of that model share a single `InstancedMesh`
4. **LOD Management**: Instances automatically switch between LOD0/LOD1/LOD2 based on camera distance
5. **Depletion Handling**: Depleted resources move to a separate instanced pool (stumps)

## Visual Strategy API

### ResourceVisualStrategy Interface

```typescript
export interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  
  /**
   * Called when resource is depleted.
   * @returns true if strategy handled depletion (instanced stump),
   *          false if ResourceEntity should load individual depleted model
   */
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;
  
  /** Return a temporary mesh positioned at this instance for outline rendering */
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

### Breaking Changes (PR #946)

**`onDepleted()` now returns `boolean`:**
- `true` = Strategy handled depletion (instanced stump) - ResourceEntity skips loading individual model
- `false` = ResourceEntity should load individual depleted model (legacy behavior)

**New optional method `getHighlightMesh()`:**
- Returns a positioned mesh for hover outline rendering
- Used by `EntityHighlightService` for instanced entities
- Falls back to entity's scene-graph mesh if not implemented

## LOD System

### LOD Distances

Configured in `GPUVegetation.ts`:

```typescript
const LOD_DISTANCES = {
  resource: {
    lod1Distance: 30,    // Switch to LOD1 at 30 units
    lod2Distance: 60,    // Switch to LOD2 at 60 units
  },
  tree: {
    lod1Distance: 40,
    lod2Distance: 80,
  },
};
```

### LOD File Naming Convention

- **LOD0**: `model.glb` (full detail)
- **LOD1**: `model_lod1.glb` (medium detail)
- **LOD2**: `model_lod2.glb` (low detail)
- **Depleted**: `model_stump.glb` or custom path via `depletedModelPath`

### Hysteresis

LOD switching uses 0.81x hysteresis multiplier to prevent flickering when camera distance oscillates near LOD boundaries.

## Depletion System

### Instanced Depletion

When a resource is depleted:
1. Instance is removed from living LOD pool (LOD0/LOD1/LOD2)
2. Instance is added to depleted pool with `depletedScale` (default 0.3x)
3. Collision proxy `userData.depleted` is set to `true`
4. Collision proxy `userData.interactable` is set to `false`

### Respawn

When a resource respawns:
1. Instance is removed from depleted pool
2. Instance is re-added to LOD0 pool
3. Collision proxy userData is restored

## Hover Highlighting

### Problem

Instanced entities don't have individual scene-graph meshes, so the standard outline pass can't find them.

### Solution

1. **Highlight Mesh Preloading**: Each model pool preloads a highlight mesh from LOD0 geometry
2. **Temporary Positioning**: `getHighlightMesh()` positions the mesh at the instance's world location
3. **Scene Injection**: `EntityHighlightService` temporarily adds the mesh to the scene
4. **Cleanup**: Mesh is removed when hover ends or entity changes state

## Collision Proxies

Instanced entities use invisible collision proxies for raycasting:

```typescript
// Trees: Cylinder (0.5 radius, 2 height)
const geometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 2 * scale, 6);

// Other resources: Box (0.8 size)
const geometry = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);
```

**UserData:**
```typescript
proxy.userData = {
  type: "resource",
  entityId: ctx.id,
  name: ctx.config.name,
  interactable: true,
  resourceType: ctx.config.resourceType,
  depleted: ctx.config.depleted,
};
```

## Configuration

### Resource Manifest

```json
{
  "id": "oak_tree",
  "name": "Oak Tree",
  "resourceType": "tree",
  "model": "trees/oak_tree.glb",
  "modelScale": 3.0,
  "depletedModelPath": "trees/oak_stump.glb",
  "depletedModelScale": 0.3
}
```

### Enabling Instanced Rendering

Instanced rendering is enabled by default for all resources with GLB models:

- **Trees**: Use `TreeGLBVisualStrategy` (automatically selected)
- **Other resources**: Use `InstancedModelVisualStrategy` (automatically selected)

To disable instancing for a specific resource, remove the `model` field from the manifest (falls back to `PlaceholderVisualStrategy`).

## Performance Characteristics

### Memory

- **Geometry**: Shared across all instances (1x memory cost)
- **Materials**: Shared across all instances (1x memory cost)
- **Instance Matrices**: 16 floats per instance (64 bytes)
- **Collision Proxies**: 1 invisible mesh per instance (minimal overhead)

### Draw Calls

- **Without instancing**: N draw calls for N resources
- **With instancing**: 3-4 draw calls per unique model (LOD0, LOD1, LOD2, depleted)

### CPU

- **LOD switching**: O(n) per frame (checks distance for each instance)
- **Optimized**: Early-exit when LOD doesn't change
- **Hysteresis**: Reduces switching frequency

## Limitations

- **Max instances per model**: 512 (configurable via `MAX_INSTANCES`)
- **Fallback**: Automatically falls back to `StandardModelVisualStrategy` if pool is full
- **No per-instance materials**: All instances of a model share the same material
- **No per-instance animations**: Use VAT (Vertex Animation Texture) for animated instances

## Debugging

### Visual Debugging

Enable collision proxy visibility:
```typescript
const proxy = ctx.getMesh();
if (proxy && proxy.material) {
  proxy.material.visible = true;
  proxy.material.wireframe = true;
}
```

### Instance Count

Check active instances per model:
```typescript
import { pools } from './GLBResourceInstancer';

for (const [modelPath, pool] of pools.entries()) {
  console.log(`${modelPath}:`);
  console.log(`  LOD0: ${pool.lod0?.activeCount ?? 0}`);
  console.log(`  LOD1: ${pool.lod1?.activeCount ?? 0}`);
  console.log(`  LOD2: ${pool.lod2?.activeCount ?? 0}`);
  console.log(`  Depleted: ${pool.depleted?.activeCount ?? 0}`);
}
```

### Performance Monitoring

```typescript
// Check draw calls (should be ~3-4 per unique model)
console.log('Draw calls:', renderer.info.render.calls);

// Check triangles rendered
console.log('Triangles:', renderer.info.render.triangles);
```

## Migration Guide

### From StandardModelVisualStrategy to InstancedModelVisualStrategy

No code changes required - the factory automatically selects the instanced strategy for resources with GLB models.

### Custom Visual Strategies

If implementing a custom visual strategy:

1. **Implement `onDepleted()` return value**:
   ```typescript
   async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
     // Handle depletion
     return false; // or true if you handle instanced stumps
   }
   ```

2. **Optional: Implement `getHighlightMesh()`**:
   ```typescript
   getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
     // Return positioned mesh for outline rendering
     return null; // or your highlight mesh
   }
   ```

## Related Files

- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`
- `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- `packages/shared/src/entities/world/visuals/ResourceVisualStrategy.ts`
- `packages/shared/src/entities/world/ResourceEntity.ts`
- `packages/shared/src/systems/client/interaction/services/EntityHighlightService.ts`
