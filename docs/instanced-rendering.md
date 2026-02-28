# Instanced Rendering System

Hyperscape uses GPU instancing to render thousands of resources (trees, rocks, ores, herbs) with minimal draw calls.

## Overview

Instead of creating individual meshes for each resource entity, the instanced rendering system:
- Loads each unique model once
- Extracts geometry and materials
- Renders all instances via `THREE.InstancedMesh`
- Switches LOD levels per-instance based on camera distance
- Supports depleted states with separate models

**Performance:**
- Reduces draw calls from O(n) to O(1) per unique model
- Handles 1000+ resources with <10 draw calls
- Distance-based LOD switching with hysteresis
- Dissolve materials for fade effects

## Architecture

### Components

#### GLBTreeInstancer
Handles tree resources with procedural and GLB models.

**Features:**
- Separate InstancedMesh per LOD level (LOD0, LOD1, LOD2)
- Depleted state with stump models
- Highlight mesh support for hover effects
- Distance-based LOD switching

**Location:** `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`

#### GLBResourceInstancer
Handles non-tree resources (rocks, ores, herbs).

**Features:**
- Same LOD system as trees
- Depleted model support with custom scale
- Collision proxies for raycasting
- Highlight mesh for selected resources

**Location:** `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`

#### Visual Strategies

**TreeGLBVisualStrategy:**
- Integrates with GLBTreeInstancer
- Falls back to StandardModelVisualStrategy if pool full

**InstancedModelVisualStrategy:**
- Integrates with GLBResourceInstancer
- Creates invisible collision proxy for raycasting
- Falls back to StandardModelVisualStrategy if instancing fails

**Location:** `packages/shared/src/entities/world/visuals/`

### Data Flow

```
ResourceEntity.createVisual()
  ↓
createVisualStrategy() → InstancedModelVisualStrategy
  ↓
GLBResourceInstancer.addInstance()
  ↓
ensureModelPool() → Load model, extract geometry
  ↓
createLODPool() → Create InstancedMesh
  ↓
addToPool() → Set instance matrix
```

## Usage

### Initialization

Instancers are initialized in `createClientWorld()`:

```typescript
import { 
  initGLBTreeInstancer,
  initGLBResourceInstancer 
} from '@hyperscape/shared';

// In world setup
initGLBTreeInstancer(scene, world);
initGLBResourceInstancer(scene, world);
```

### Adding Instances

Resources automatically use instanced rendering when created:

```typescript
// ResourceEntity.ts
const strategy = createVisualStrategy(config);
await strategy.createVisual(context);
// → Automatically uses InstancedModelVisualStrategy for GLB models
```

### LOD Levels

Models should follow naming convention:
- `model.glb` - LOD0 (high detail, near camera)
- `model_lod1.glb` - LOD1 (medium detail)
- `model_lod2.glb` - LOD2 (low detail, far from camera)

**LOD Distances:**
```typescript
// For resources (rocks, ores, herbs)
LOD0: 0-40m
LOD1: 40-80m
LOD2: 80m+

// For trees
LOD0: 0-50m
LOD1: 50-100m
LOD2: 100m+
```

**Hysteresis:**
LOD switching uses 0.81x distance multiplier to prevent flickering when camera is near threshold.

### Depleted States

Resources can have separate depleted models:

```typescript
await addInstance(
  'models/rock.glb',           // Base model
  entityId,
  position,
  rotation,
  scale,
  'models/rock_depleted.glb',  // Depleted model (optional)
  0.3                          // Depleted scale (optional)
);

// Later, when resource is depleted
setDepleted(entityId, true);

// When resource respawns
setDepleted(entityId, false);
```

### Highlight Meshes

Instanced resources support hover highlights:

```typescript
// Get highlight mesh for entity
const highlightMesh = getHighlightMesh(entityId);

if (highlightMesh) {
  // Position is automatically set to instance position
  scene.add(highlightMesh);
  
  // Apply highlight material
  highlightMesh.material = highlightMaterial;
}

// Remove when no longer highlighted
scene.remove(highlightMesh);
```

## Implementation Details

### Instance Pooling

Each unique model gets a `ModelPool`:

```typescript
interface ModelPool {
  modelPath: string;
  lod0: LODPool | null;      // High detail
  lod1: LODPool | null;      // Medium detail
  lod2: LODPool | null;      // Low detail
  depleted: LODPool | null;  // Depleted state
  instances: Map<string, ResourceSlot>;
  yOffset: number;           // Ground alignment
  highlightMesh: THREE.Mesh | null;
}
```

### LOD Pool

Each LOD level has its own `InstancedMesh`:

```typescript
interface LODPool {
  mesh: THREE.InstancedMesh;
  material: DissolveMaterial;
  slots: Map<string, number>;  // entityId → instance index
  activeCount: number;
  dirty: boolean;              // Needs matrix update
}
```

### Instance Slot

Per-instance data:

```typescript
interface ResourceSlot {
  entityId: string;
  position: THREE.Vector3;
  rotation: number;
  scale: number;
  depletedScale: number;
  yOffset: number;
  currentLOD: 0 | 1 | 2;
  depleted: boolean;
}
```

### LOD Switching

Every frame, `updateGLBResourceInstancer()`:

1. Calculates distance from camera to each instance
2. Determines target LOD based on distance
3. Applies hysteresis to prevent flickering
4. Moves instance between LOD pools if needed
5. Updates instance matrices

**Algorithm:**
```typescript
const distSq = dx * dx + dz * dz;
const hysteresisSq = 0.81;

if (distSq < lod1DistSq * hysteresisSq) {
  targetLOD = 0;
} else if (distSq < lod1DistSq) {
  targetLOD = currentLOD === 0 ? 0 : 1;  // Hysteresis
} else if (distSq < lod2DistSq * hysteresisSq) {
  targetLOD = 1;
} else if (distSq < lod2DistSq) {
  targetLOD = currentLOD <= 1 ? 1 : 2;   // Hysteresis
} else {
  targetLOD = 2;
}
```

### Matrix Management

Instances are stored as 4x4 transformation matrices:

```typescript
// Compose matrix from position, rotation, scale
const matrix = new THREE.Matrix4();
matrix.compose(
  new THREE.Vector3(x, y + yOffset * scale, z),
  new THREE.Quaternion().setFromAxisAngle(upVector, rotation),
  new THREE.Vector3(scale, scale, scale)
);

// Set on InstancedMesh
instancedMesh.setMatrixAt(index, matrix);
instancedMesh.instanceMatrix.needsUpdate = true;
```

### Swap-and-Pop Removal

When removing an instance, use swap-and-pop to avoid array gaps:

```typescript
function removeFromPool(pool: LODPool, entityId: string) {
  const index = pool.slots.get(entityId);
  const lastIndex = pool.activeCount - 1;
  
  if (index !== lastIndex) {
    // Swap with last instance
    pool.mesh.getMatrixAt(lastIndex, swapMatrix);
    pool.mesh.setMatrixAt(index, swapMatrix);
    
    // Update slot mapping
    for (const [eid, eidIdx] of pool.slots) {
      if (eidIdx === lastIndex) {
        pool.slots.set(eid, index);
        break;
      }
    }
  }
  
  pool.slots.delete(entityId);
  pool.activeCount--;
  pool.mesh.count = pool.activeCount;
}
```

## Configuration

### Max Instances

Default: 512 instances per model per LOD level.

To increase:

```typescript
// In GLBResourceInstancer.ts or GLBTreeInstancer.ts
const MAX_INSTANCES = 1024;
```

**Note:** Higher limits use more GPU memory.

### LOD Distances

Configure in `GPUVegetation.ts`:

```typescript
export function getLODDistances(type: 'tree' | 'resource') {
  if (type === 'tree') {
    return {
      lod1Distance: 50,
      lod1DistanceSq: 2500,
      lod2Distance: 100,
      lod2DistanceSq: 10000,
    };
  }
  return {
    lod1Distance: 40,
    lod1DistanceSq: 1600,
    lod2Distance: 80,
    lod2DistanceSq: 6400,
  };
}
```

### Dissolve Materials

Instanced meshes use dissolve materials for fade effects:

```typescript
const material = createDissolveMaterial(baseMaterial, {
  fadeStart: 200,           // Start fade at 200m
  fadeEnd: 250,             // Fully transparent at 250m
  enableNearFade: false,    // Disable near-camera fade
  enableWaterCulling: false,
  enableOcclusionDissolve: false,
});
```

## Performance

### Benchmarks

**Before instancing:**
- 1000 trees = 1000 draw calls
- 500 rocks = 500 draw calls
- Total: 1500 draw calls
- FPS: ~30-40

**After instancing:**
- 1000 trees = 3 draw calls (LOD0, LOD1, LOD2)
- 500 rocks = 3 draw calls
- Total: 6 draw calls
- FPS: ~55-60

**Improvement:** ~40% FPS increase with 1500 resources.

### Memory Usage

**Per model:**
- Geometry: Shared (1x)
- Material: Shared (1x)
- Instance matrices: 64 bytes × instance count

**Example:**
- 1000 tree instances = 64KB matrix data
- 3 LOD levels = 192KB total
- Geometry/materials: ~2MB (shared)

**Total:** ~2.2MB for 1000 trees (vs ~20MB without instancing).

### Optimization Tips

1. **Use LOD models** - Reduce geometry complexity for distant instances
2. **Limit instance count** - Stay under 512 per model per LOD
3. **Share materials** - Use same material for multiple models
4. **Batch updates** - Set `dirty` flag, update matrices once per frame
5. **Frustum culling** - InstancedMesh handles this automatically

## Debugging

### Visual Debugging

Enable collision proxies to see instance positions:

```typescript
// In InstancedModelVisualStrategy.ts
material.visible = true;  // Make collision proxy visible
```

### Instance Count

Check active instances:

```typescript
import { pools } from './GLBResourceInstancer';

for (const [modelPath, pool] of pools) {
  console.log(`${modelPath}:`);
  console.log(`  LOD0: ${pool.lod0?.activeCount || 0}`);
  console.log(`  LOD1: ${pool.lod1?.activeCount || 0}`);
  console.log(`  LOD2: ${pool.lod2?.activeCount || 0}`);
  console.log(`  Depleted: ${pool.depleted?.activeCount || 0}`);
}
```

### LOD Distribution

Log LOD distribution to verify switching:

```typescript
const lodCounts = { lod0: 0, lod1: 0, lod2: 0 };

for (const slot of pool.instances.values()) {
  if (slot.currentLOD === 0) lodCounts.lod0++;
  else if (slot.currentLOD === 1) lodCounts.lod1++;
  else lodCounts.lod2++;
}

console.log('LOD distribution:', lodCounts);
```

## Migration Guide

### From StandardModelVisualStrategy

**Before:**
```typescript
// ResourceEntity.ts
const strategy = new StandardModelVisualStrategy();
await strategy.createVisual(context);
```

**After:**
```typescript
// ResourceEntity.ts
const strategy = createVisualStrategy(config);
await strategy.createVisual(context);
// → Automatically uses InstancedModelVisualStrategy for GLB models
```

**No code changes required** - the factory handles strategy selection.

### Adding New Resource Types

1. **Create GLB model** with LOD variants:
   ```
   models/new_resource.glb
   models/new_resource_lod1.glb
   models/new_resource_lod2.glb
   models/new_resource_depleted.glb  (optional)
   ```

2. **Add to resource manifest:**
   ```json
   {
     "id": "new_resource",
     "name": "New Resource",
     "model": "models/new_resource.glb",
     "depletedModelPath": "models/new_resource_depleted.glb",
     "depletedModelScale": 0.3,
     "resourceType": "mining"
   }
   ```

3. **Instancing happens automatically** - no code changes needed.

## Limitations

### Max Instances

Each model is limited to 512 instances per LOD level (1536 total per model).

**Workaround:** Use multiple model variants:
```
rock_01.glb
rock_02.glb
rock_03.glb
```

### Raycasting

InstancedMesh doesn't support per-instance raycasting. We use invisible collision proxies:

```typescript
// Collision proxy for raycasting
const proxy = new THREE.Mesh(geometry, invisibleMaterial);
proxy.userData.entityId = entityId;
proxy.layers.set(1);  // Raycasting layer
```

### Material Sharing

All instances of a model share the same material. Per-instance material properties not supported.

**Workaround:** Use vertex colors or texture atlases for variation.

### Animation

InstancedMesh doesn't support skeletal animation. For animated resources, use:
- Vertex Animation Textures (VAT)
- Shader-based animation
- Standard mesh instances (not instanced)

## Future Improvements

### Planned Features

1. **GPU Culling** - Frustum culling on GPU via compute shaders
2. **Occlusion Culling** - Hide instances behind terrain/buildings
3. **Impostor Fallback** - Switch to impostors at extreme distances
4. **Dynamic Batching** - Merge nearby instances into single mesh
5. **Texture Arrays** - Pack multiple textures for material variation

### Performance Targets

- 10,000 resources at 60 FPS
- <20 draw calls for all resources
- <100MB GPU memory for instance data

## API Reference

### GLBResourceInstancer

#### initGLBResourceInstancer(scene, world)
Initialize the instancer system.

**Parameters:**
- `scene: THREE.Scene` - Scene to add InstancedMeshes to
- `world: World` - World instance for material setup

#### addInstance(modelPath, entityId, position, rotation, scale, depletedModelPath?, depletedScale?)
Add a new instance.

**Parameters:**
- `modelPath: string` - Path to GLB model
- `entityId: string` - Unique entity ID
- `position: THREE.Vector3` - World position
- `rotation: number` - Y-axis rotation in radians
- `scale: number` - Uniform scale
- `depletedModelPath?: string` - Optional depleted model path
- `depletedScale?: number` - Scale for depleted model (default: same as scale)

**Returns:** `Promise<boolean>` - True if added, false if pool full

#### removeInstance(entityId)
Remove an instance.

**Parameters:**
- `entityId: string` - Entity ID to remove

#### setDepleted(entityId, depleted)
Set depleted state.

**Parameters:**
- `entityId: string` - Entity ID
- `depleted: boolean` - Depleted state

#### getHighlightMesh(entityId)
Get highlight mesh for entity.

**Parameters:**
- `entityId: string` - Entity ID

**Returns:** `THREE.Object3D | null` - Highlight mesh positioned at instance

#### updateGLBResourceInstancer()
Update LOD levels and matrices. Call once per frame.

#### destroyGLBResourceInstancer()
Clean up all resources.

### InstancedModelVisualStrategy

#### createVisual(context)
Create instanced visual for resource.

**Parameters:**
- `context: ResourceVisualContext` - Resource context

**Behavior:**
- Attempts to add instance to GLBResourceInstancer
- Falls back to StandardModelVisualStrategy if instancing fails
- Creates collision proxy for raycasting

#### onDepleted(context)
Handle resource depletion.

**Returns:** `Promise<boolean>` - True if instancer handles depletion

#### getHighlightMesh(context)
Get highlight mesh for hover effects.

**Returns:** `THREE.Object3D | null`

#### onRespawn(context)
Handle resource respawn.

#### update(context, deltaTime)
Update instance (LOD switching).

#### destroy(context)
Remove instance and clean up.

## Examples

### Basic Resource

```typescript
// Manifest entry
{
  "id": "iron_ore",
  "name": "Iron Ore",
  "model": "models/ores/iron_ore.glb",
  "modelScale": 1.0,
  "resourceType": "mining"
}
```

**Result:** Automatically uses instanced rendering with 3 LOD levels.

### Resource with Depleted State

```typescript
// Manifest entry
{
  "id": "oak_tree",
  "name": "Oak Tree",
  "model": "models/trees/oak.glb",
  "depletedModelPath": "models/trees/oak_stump.glb",
  "depletedModelScale": 0.4,
  "resourceType": "tree"
}
```

**Result:** 
- Normal state: Full tree with LOD switching
- Depleted state: Small stump (separate InstancedMesh)

### Custom Highlight

```typescript
// In EntityHighlightService.ts
const highlightMesh = strategy.getHighlightMesh(context);

if (highlightMesh) {
  // Apply custom highlight material
  const material = new MeshBasicNodeMaterial();
  material.colorNode = color(0x00ff00);
  material.transparent = true;
  material.opacity = 0.3;
  
  highlightMesh.material = material;
  scene.add(highlightMesh);
}
```

## Testing

### Visual Tests

Test instanced rendering with Playwright:

```typescript
test('instanced resources render correctly', async ({ page }) => {
  await page.goto('http://localhost:3333');
  
  // Wait for resources to load
  await page.waitForTimeout(5000);
  
  // Check instance count via Three.js scene
  const instanceCount = await page.evaluate(() => {
    const scene = window.__HYPERSCAPE_SCENE__;
    let count = 0;
    
    scene.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        count += obj.count;
      }
    });
    
    return count;
  });
  
  expect(instanceCount).toBeGreaterThan(100);
});
```

### Performance Tests

Measure draw calls:

```typescript
test('instanced rendering reduces draw calls', async ({ page }) => {
  const drawCalls = await page.evaluate(() => {
    const renderer = window.__HYPERSCAPE_RENDERER__;
    return renderer.info.render.calls;
  });
  
  // Should be <20 draw calls for 1000+ resources
  expect(drawCalls).toBeLessThan(20);
});
```

## References

- [GLBResourceInstancer.ts](../packages/shared/src/systems/shared/world/GLBResourceInstancer.ts)
- [GLBTreeInstancer.ts](../packages/shared/src/systems/shared/world/GLBTreeInstancer.ts)
- [InstancedModelVisualStrategy.ts](../packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts)
- [TreeGLBVisualStrategy.ts](../packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts)
- [GPUVegetation.ts](../packages/shared/src/systems/shared/world/GPUVegetation.ts)
