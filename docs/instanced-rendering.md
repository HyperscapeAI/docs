# Instanced Rendering System

Hyperscape uses GPU instancing to efficiently render large numbers of similar resources (trees, rocks, ores, herbs) with minimal draw calls and memory overhead.

## Overview

### Problem
Rendering thousands of individual resources (trees, rocks, ores) as separate meshes causes:
- High draw call count (O(n) per resource)
- GPU bottleneck from state changes
- Memory overhead from duplicate geometry
- Poor performance with large worlds

### Solution
Instanced rendering pools resources by model type:
- Single InstancedMesh per unique model per LOD level
- Draw call count: O(1) per unique model per LOD
- Shared geometry and materials
- GPU-side matrix transforms

### Performance Impact
- **Before**: 1000 trees = 1000 draw calls
- **After**: 1000 trees = 3 draw calls (LOD0 + LOD1 + LOD2)
- **Memory**: ~90% reduction (shared geometry)
- **FPS**: 2-3x improvement with dense vegetation

## Architecture

### Instancer Classes

#### GLBTreeInstancer
Specialized instancer for tree resources with dissolve materials:
- **Location**: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`
- **Features**: LOD switching, depleted state (stumps), dissolve effects
- **Max Instances**: 512 per model per LOD level
- **Materials**: TSL-based dissolve materials with fade/culling

#### GLBResourceInstancer
General-purpose instancer for non-tree GLB resources (rocks, ores, herbs):
- **Location**: `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`
- **Features**: LOD switching, depleted state, highlight mesh support
- **Max Instances**: 512 per model per LOD level
- **Materials**: TSL-based dissolve materials

### Visual Strategies

#### InstancedModelVisualStrategy
Thin wrapper that integrates with GLBResourceInstancer:
- **Location**: `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- **Fallback**: StandardModelVisualStrategy when instancing unavailable
- **Collision**: Invisible proxy mesh for raycasting
- **Highlight**: Temporary mesh for outline rendering

#### TreeGLBVisualStrategy
Integrates with GLBTreeInstancer for tree resources:
- **Location**: `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`
- **Features**: Depleted state (stumps), highlight mesh support
- **Collision**: Cylinder proxy for raycasting

## Resource Configuration

### Basic Resource
```json
{
  "name": "Iron Ore",
  "resourceType": "ore",
  "model": "models/resources/iron_ore.glb",
  "modelScale": 1.0
}
```

### Resource with Depleted Model
```json
{
  "name": "Oak Tree",
  "resourceType": "tree",
  "model": "models/resources/oak_tree.glb",
  "modelScale": 3.0,
  "depletedModelPath": "models/resources/tree_stump.glb",
  "depletedModelScale": 0.3
}
```

**Depleted Model Features**:
- Separate InstancedMesh pool for depleted state
- Automatic transition on resource depletion
- No individual model loading required
- Collision proxy persists across state transitions

## LOD System

### LOD Levels
- **LOD0**: Full detail (close range)
- **LOD1**: Medium detail (mid range)
- **LOD2**: Low detail (far range)

### LOD File Naming
```
models/resources/oak_tree.glb       # LOD0 (required)
models/resources/oak_tree_lod1.glb  # LOD1 (optional)
models/resources/oak_tree_lod2.glb  # LOD2 (optional)
```

### LOD Distances
```typescript
// From GPUVegetation.ts
const resourceLOD = {
  lod1Distance: 30,      // Switch to LOD1 at 30 units
  lod2Distance: 60,      // Switch to LOD2 at 60 units
  lod1DistanceSq: 900,   // Squared for fast comparison
  lod2DistanceSq: 3600
};
```

### Hysteresis
Prevents flickering at LOD boundaries:
```typescript
const hysteresisSq = 0.81;  // 90% of distance threshold
// LOD only switches back when distance < threshold * 0.9
```

## API Reference

### ResourceVisualStrategy Interface

#### onDepleted(ctx: ResourceVisualContext): Promise<boolean>
Called when resource is depleted (e.g., tree chopped down).

**Returns**:
- `true`: Strategy handled depletion (instanced stump loaded)
- `false`: ResourceEntity should load individual depleted model

**Example**:
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  setGLBTreeDepleted(ctx.id, true);
  const proxy = ctx.getMesh();
  if (proxy) {
    proxy.userData.depleted = true;
    proxy.userData.interactable = false;
  }
  return hasGLBTreeDepleted(ctx.id);  // true if instancer has depleted pool
}
```

#### getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null
Returns temporary mesh for outline rendering on hover.

**Returns**:
- `THREE.Object3D`: Positioned highlight mesh
- `null`: No highlight mesh available (use entity's own mesh)

**Example**:
```typescript
getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  return getGLBTreeHighlightMesh(ctx.id);
}
```

### Entity Integration

#### ResourceEntity.getHighlightRoot(): THREE.Object3D | null
Returns highlight mesh for instanced entities.

**Usage**:
```typescript
// In EntityHighlightService
const entity = target.entity as unknown as Record<string, unknown>;
if (typeof entity.getHighlightRoot === "function") {
  const hlRoot = (entity.getHighlightRoot as () => THREE.Object3D | null)();
  if (hlRoot) {
    this.world.stage?.scene?.add?.(hlRoot);
    this.activeHighlightMesh = hlRoot;
    // ... collect meshes and set outline
  }
}
```

### GLBTreeInstancer API

#### addInstance()
```typescript
async function addInstance(
  modelPath: string,
  entityId: string,
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  depletedModelPath?: string | null,
  depletedScale?: number,
): Promise<boolean>
```

**Parameters**:
- `modelPath`: Path to LOD0 model (LOD1/LOD2 inferred automatically)
- `entityId`: Unique entity identifier
- `position`: World position
- `rotation`: Y-axis rotation in radians
- `scale`: Uniform scale factor
- `depletedModelPath`: Optional path to depleted model (e.g., stump)
- `depletedScale`: Scale for depleted model (default: same as scale)

**Returns**: `true` if instance added successfully, `false` if pool full or error

#### removeInstance()
```typescript
function removeInstance(entityId: string): void
```

Removes instance from all pools and cleans up resources.

#### setDepleted()
```typescript
function setDepleted(entityId: string, depleted: boolean): void
```

Transitions instance between normal and depleted state:
- Removes from current pool (LOD0/LOD1/LOD2 or depleted)
- Adds to target pool
- Updates highlight mesh reference
- Removes stale highlight mesh from scene if visible

#### hasDepleted()
```typescript
function hasDepleted(entityId: string): boolean
```

Returns `true` if instancer has a depleted pool for this entity's model.

#### getHighlightMesh()
```typescript
function getHighlightMesh(entityId: string): THREE.Object3D | null
```

Returns positioned highlight mesh for outline rendering.

#### updateGLBTreeInstancer()
```typescript
function updateGLBTreeInstancer(): void
```

Call once per frame to:
- Update LOD levels based on camera distance
- Update dissolve material uniforms (camera/player position)
- Mark dirty instance matrices for GPU upload

### GLBResourceInstancer API

Same API as GLBTreeInstancer, but for non-tree resources:
- `addInstance()`
- `removeInstance()`
- `setDepleted()`
- `hasDepleted()`
- `getHighlightMesh()`
- `updateGLBResourceInstancer()`

## Collision Handling

### Invisible Proxy Mesh
Instanced entities use invisible collision proxies for raycasting:

```typescript
function createCollisionProxy(ctx: ResourceVisualContext, scale: number): void {
  const isTree = ctx.config.resourceType === "tree";
  const geometry = isTree
    ? new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 2 * scale, 6)
    : new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);

  const material = new MeshBasicNodeMaterial();
  material.visible = false;  // Invisible but raycastable

  const proxy = new THREE.Mesh(geometry, material);
  proxy.userData = {
    type: "resource",
    entityId: ctx.id,
    name: ctx.config.name,
    interactable: true,
    resourceType: ctx.config.resourceType,
    depleted: ctx.config.depleted,
  };
  proxy.layers.set(1);  // Raycast layer

  ctx.node.add(proxy);
  ctx.setMesh(proxy);
}
```

**Key Points**:
- Proxy is invisible (`material.visible = false`)
- Proxy is raycastable (layer 1)
- Proxy persists across depletion/respawn
- Proxy userData contains entity metadata

## Highlight System

### EntityHighlightService Integration

The highlight service supports instanced entities via `getHighlightRoot()`:

```typescript
// Try instanced highlight path first
const entity = target.entity as unknown as Record<string, unknown>;
if (typeof entity.getHighlightRoot === "function") {
  const hlRoot = (entity.getHighlightRoot as () => THREE.Object3D | null)();
  if (hlRoot) {
    this.world.stage?.scene?.add?.(hlRoot);
    this.activeHighlightMesh = hlRoot;
    const meshes = this.collectMeshes(hlRoot);
    if (meshes.length > 0) {
      const color = this.getHighlightColor(target.entityType);
      this.composer.setOutlineColor(color);
      this.composer.setOutlineObjects(meshes);
      return;
    }
  }
}

// Fallback: use entity's own scene-graph mesh
const mesh = target.entity.mesh;
// ...
```

### Highlight Mesh Lifecycle
1. **Creation**: Preloaded from LOD0 geometry during pool initialization
2. **Positioning**: Updated on-demand when entity is hovered
3. **Scene Management**: Added to scene by EntityHighlightService, removed on unhover
4. **State Transition**: Removed from scene when entity switches between normal/depleted

## Fallback Behavior

### When Instancing Fails
- Pool is full (>512 instances per model)
- Model load error
- WebGPU not available

**Fallback**: StandardModelVisualStrategy
- Loads individual model for entity
- No instancing benefits
- Higher draw calls and memory usage

### Detecting Fallback
```typescript
export class InstancedModelVisualStrategy implements ResourceVisualStrategy {
  private instanced = false;
  private fallback: StandardModelVisualStrategy | null = null;

  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    const success = await addResourceInstance(/* ... */);
    
    if (success) {
      this.instanced = true;
      createCollisionProxy(ctx, baseScale);
      return;
    }

    // Fallback to individual model
    this.fallback = new StandardModelVisualStrategy();
    await this.fallback.createVisual(ctx);
  }
}
```

## Performance Considerations

### Memory Usage
- **Geometry**: Shared across all instances (single copy in GPU memory)
- **Materials**: Shared across all instances (single shader program)
- **Matrices**: 16 floats per instance (64 bytes)
- **Total**: ~64 bytes per instance + shared geometry/material

### Draw Calls
- **Without Instancing**: 1 draw call per resource
- **With Instancing**: 1 draw call per unique model per LOD level
- **Example**: 1000 oak trees = 3 draw calls (LOD0 + LOD1 + LOD2)

### LOD Switching Cost
- **Per-frame**: O(n) distance checks (cheap)
- **On LOD change**: Matrix swap-and-pop (O(1) per instance)
- **GPU Upload**: Only dirty instance matrices uploaded

### Best Practices
- Keep unique model count low (reuse models with different scales/rotations)
- Use LOD models to reduce vertex count at distance
- Limit max instances per model to 512 (current pool size)
- Batch resource spawning to amortize pool initialization cost

## Debugging

### Visual Debugging
```typescript
// Enable wireframe on instanced meshes
for (const pool of pools.values()) {
  for (const lodPool of [pool.lod0, pool.lod1, pool.lod2, pool.depleted]) {
    if (lodPool) {
      lodPool.material.wireframe = true;
    }
  }
}
```

### Instance Count Logging
```typescript
// Log instance counts per model
for (const [modelPath, pool] of pools.entries()) {
  console.log(`${modelPath}:`, {
    lod0: pool.lod0?.activeCount ?? 0,
    lod1: pool.lod1?.activeCount ?? 0,
    lod2: pool.lod2?.activeCount ?? 0,
    depleted: pool.depleted?.activeCount ?? 0,
    total: pool.instances.size,
  });
}
```

### Common Issues

**Resources not rendering:**
- Check pool is initialized: `initGLBResourceInstancer(scene, world)`
- Verify model path is correct
- Check console for "pool full" warnings
- Ensure `updateGLBResourceInstancer()` is called each frame

**Highlight not working:**
- Verify `getHighlightMesh()` is implemented in strategy
- Check `getHighlightRoot()` is implemented in entity
- Ensure highlight mesh is added to scene
- Verify outline pass is enabled in post-processing

**LOD not switching:**
- Check camera is set: `world.camera`
- Verify `updateGLBTreeInstancer()` is called each frame
- Check LOD distance thresholds in GPUVegetation.ts
- Ensure LOD1/LOD2 models exist (optional but recommended)

## Migration Guide

### From StandardModelVisualStrategy

**Before**:
```typescript
// In createVisualStrategy.ts
if (hasModel(config)) return new StandardModelVisualStrategy();
```

**After**:
```typescript
// In createVisualStrategy.ts
if (hasModel(config)) return new InstancedModelVisualStrategy();
```

### Updating ResourceVisualStrategy

**Before**:
```typescript
interface ResourceVisualStrategy {
  onDepleted(ctx: ResourceVisualContext): Promise<void>;
}
```

**After**:
```typescript
interface ResourceVisualStrategy {
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

**Implementation**:
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  // Handle depletion visuals
  // Return true if strategy handled it, false otherwise
  return false;  // Let ResourceEntity load individual depleted model
}

getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  // Return positioned highlight mesh for outline rendering
  return null;  // Use entity's own mesh for highlighting
}
```

## See Also

- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - Tree instancer implementation
- `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts` - Resource instancer implementation
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts` - Visual strategy
- `packages/shared/src/systems/client/interaction/services/EntityHighlightService.ts` - Highlight integration
- `packages/shared/src/systems/shared/world/GPUVegetation.ts` - Dissolve materials and LOD config
