# Instanced Rendering System

Hyperscape uses GPU instancing to render thousands of resources (trees, rocks, ores, herbs) with minimal draw calls and excellent performance.

## Overview

**Instanced rendering** replaces per-entity GLB cloning with `InstancedMesh`-based rendering, reducing draw calls from **O(n) per resource type** to **O(1) per unique model per LOD level**.

### Performance Benefits

- **Draw Call Reduction**: 1000 trees = 1 draw call (was 1000)
- **Memory Efficiency**: Shared geometry and materials
- **LOD Support**: Automatic distance-based level-of-detail switching
- **Depletion States**: Instanced stumps for depleted resources

## Architecture

### Component Overview

```
GLBResourceInstancer
├── Model Loading & Caching
├── LOD Management (LOD0, LOD1, LOD2)
├── Instance Pools (active, depleted)
├── Distance-Based LOD Switching
└── Dissolve Material Support

InstancedModelVisualStrategy
├── Wraps GLBResourceInstancer
├── Invisible Collision Proxies
└── Fallback to StandardModelVisualStrategy
```

### Supported Resource Types

Instanced rendering is used for:
- **Trees**: Via `TreeGLBVisualStrategy` + `GLBTreeInstancer`
- **Rocks**: Via `InstancedModelVisualStrategy` + `GLBResourceInstancer`
- **Ores**: Via `InstancedModelVisualStrategy` + `GLBResourceInstancer`
- **Herbs**: Via `InstancedModelVisualStrategy` + `GLBResourceInstancer`
- **Other Resources**: Any resource with `modelPath` in manifest

## GLBResourceInstancer

### Initialization

```typescript
import { GLBResourceInstancer } from '@hyperscape/shared';

const instancer = new GLBResourceInstancer(world);
await instancer.init();
```

### Adding Instances

```typescript
const instanceId = instancer.addInstance({
  modelPath: '/models/resources/rock_01.glb',
  position: new THREE.Vector3(10, 0, 5),
  rotation: new THREE.Quaternion(),
  scale: new THREE.Vector3(1, 1, 1),
  lodDistances: [50, 100, 200],  // Optional: custom LOD distances
});
```

### Depletion Support

Resources can transition to a depleted state (e.g., tree → stump):

```typescript
instancer.setDepleted(instanceId, true);  // Show depleted model
instancer.setDepleted(instanceId, false); // Restore active model
```

**Configuration**:
```typescript
const instanceId = instancer.addInstance({
  modelPath: '/models/trees/oak_tree.glb',
  depletedModelPath: '/models/trees/oak_stump.glb',  // Optional
  depletedModelScale: new THREE.Vector3(0.8, 0.8, 0.8),  // Optional
  // ...
});
```

### LOD System

Each model has 3 LOD levels loaded from the GLB file:

- **LOD0**: Full detail (closest)
- **LOD1**: Medium detail
- **LOD2**: Low detail (farthest)

**Distance Thresholds** (default):
```typescript
const DEFAULT_LOD_DISTANCES = [50, 100, 200];
```

**LOD Switching**:
- Automatic based on camera distance
- Hysteresis prevents flickering (10% threshold)
- Per-instance LOD tracking

### Dissolve Effect

Resources support dissolve transitions (fade in/out):

```typescript
instancer.setDissolve(instanceId, 0.5);  // 50% dissolved
instancer.setDissolve(instanceId, 0.0);  // Fully visible
instancer.setDissolve(instanceId, 1.0);  // Fully dissolved
```

## InstancedModelVisualStrategy

### Usage in Resource Entities

```typescript
import { createVisualStrategy } from '@hyperscape/shared';

const strategy = createVisualStrategy({
  type: 'instanced-model',
  modelPath: '/models/resources/iron_ore.glb',
  depletedModelPath: '/models/resources/iron_ore_depleted.glb',
  depletedModelScale: new THREE.Vector3(0.7, 0.7, 0.7),
});

// In ResourceEntity
this.visualStrategy = strategy;
await this.visualStrategy.init(this);
```

### Collision Proxies

Instanced resources use **invisible collision proxies** for raycasting:

- Proxy mesh matches resource bounds
- `visible = false` (not rendered)
- Used for click detection and interaction
- Automatically positioned at instance location

### Fallback Behavior

If instancing fails (e.g., model load error):
- Automatically falls back to `StandardModelVisualStrategy`
- Logs warning but continues rendering
- Per-entity fallback (doesn't affect other instances)

## Highlight System

### Instanced Highlight Meshes

Resources support hover highlighting while instanced:

```typescript
// ResourceEntity.getHighlightRoot()
getHighlightRoot(): THREE.Object3D | null {
  if (this.visualStrategy?.getHighlightMesh) {
    return this.visualStrategy.getHighlightMesh();
  }
  return this.mesh;  // Fallback to main mesh
}
```

**How it works**:
1. Instancer preloads highlight mesh from LOD0
2. Highlight mesh is added to scene on hover
3. Positioned at instance location
4. Removed when hover ends

### EntityHighlightService Integration

```typescript
// Automatically uses getHighlightRoot() for instanced entities
const highlightRoot = entity.getHighlightRoot();
if (highlightRoot) {
  this.applyHighlight(highlightRoot);
}
```

## Performance Characteristics

### Memory Usage

**Before Instancing** (1000 trees):
- 1000 separate meshes
- 1000 geometry buffers
- 1000 material instances
- ~500MB VRAM

**After Instancing** (1000 trees):
- 3 InstancedMesh objects (LOD0, LOD1, LOD2)
- 3 geometry buffers (shared)
- 3 material instances (shared)
- ~50MB VRAM

**Savings**: ~90% VRAM reduction

### Draw Calls

**Before**: 1000 draw calls per frame
**After**: 3 draw calls per frame (one per LOD level)

**Improvement**: 99.7% reduction

### CPU Overhead

Instancing adds minimal CPU overhead:
- LOD distance calculations: ~0.1ms per 1000 instances
- Matrix updates: ~0.2ms per 1000 instances
- Total: ~0.3ms per 1000 instances

## Implementation Details

### Instance Data Structure

```typescript
interface InstanceData {
  id: string;
  modelPath: string;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  lodDistances?: number[];
  depletedModelPath?: string;
  depletedModelScale?: THREE.Vector3;
  currentLod: number;
  isDepleted: boolean;
  dissolve: number;
}
```

### Pool Management

Each model path has separate pools:

```typescript
class GLBResourceInstancer {
  private pools = new Map<string, {
    active: InstancePool;      // Active resources
    depleted: InstancePool;    // Depleted resources (stumps)
    highlight: THREE.Mesh;     // Shared highlight mesh
  }>();
}
```

### LOD Switching Algorithm

```typescript
function updateLOD(instance: InstanceData, cameraPosition: THREE.Vector3) {
  const distance = instance.position.distanceTo(cameraPosition);
  const lodDistances = instance.lodDistances || DEFAULT_LOD_DISTANCES;
  
  let targetLod = 0;
  for (let i = 0; i < lodDistances.length; i++) {
    if (distance > lodDistances[i]) {
      targetLod = i + 1;
    }
  }
  
  // Hysteresis: only switch if distance change is significant
  const currentThreshold = lodDistances[instance.currentLod] || Infinity;
  const hysteresis = currentThreshold * 0.1;  // 10% threshold
  
  if (Math.abs(distance - currentThreshold) > hysteresis) {
    instance.currentLod = targetLod;
    // Move instance to new LOD pool
    moveInstanceToLOD(instance, targetLod);
  }
}
```

## Migration Guide

### Converting to Instanced Rendering

**Before** (StandardModelVisualStrategy):
```typescript
const strategy = new StandardModelVisualStrategy({
  modelPath: '/models/resources/rock_01.glb',
  depletedModelPath: '/models/resources/rock_01_depleted.glb',
});
```

**After** (InstancedModelVisualStrategy):
```typescript
const strategy = new InstancedModelVisualStrategy({
  modelPath: '/models/resources/rock_01.glb',
  depletedModelPath: '/models/resources/rock_01_depleted.glb',
  depletedModelScale: new THREE.Vector3(0.8, 0.8, 0.8),
});
```

**Changes**:
- No code changes required in ResourceEntity
- Automatic fallback if instancing fails
- Collision proxies handled automatically
- Highlight system works transparently

### Resource Manifest Updates

No manifest changes required - instancing is automatic based on visual strategy selection.

## Debugging

### Enable Instancing Debug Logs

```typescript
// In GLBResourceInstancer.ts
const DEBUG = true;
```

Logs:
- Instance additions/removals
- LOD switches
- Pool statistics
- Model loading

### Visualize Instance Bounds

```typescript
// Add bounding box helpers
for (const [modelPath, pool] of instancer.pools) {
  const box = new THREE.BoxHelper(pool.active.mesh, 0x00ff00);
  scene.add(box);
}
```

### Check Instance Count

```typescript
const stats = instancer.getStats();
console.log('Active instances:', stats.activeCount);
console.log('Depleted instances:', stats.depletedCount);
console.log('Total draw calls:', stats.drawCalls);
```

## Best Practices

### Model Requirements

For optimal instancing:
- **LOD levels**: Include LOD0, LOD1, LOD2 in GLB
- **Naming**: Use `_LOD0`, `_LOD1`, `_LOD2` suffixes
- **Materials**: Share materials across LOD levels
- **Geometry**: Keep vertex counts reasonable (LOD0: <5k, LOD1: <2k, LOD2: <500)

### LOD Distance Tuning

Adjust based on resource size:

```typescript
// Small resources (herbs, flowers)
lodDistances: [30, 60, 120]

// Medium resources (rocks, ores)
lodDistances: [50, 100, 200]

// Large resources (trees, buildings)
lodDistances: [100, 200, 400]
```

### Depletion Scale

Match depleted model size to visual expectations:

```typescript
// Tree → stump (much smaller)
depletedModelScale: new THREE.Vector3(0.6, 0.6, 0.6)

// Rock → rubble (slightly smaller)
depletedModelScale: new THREE.Vector3(0.8, 0.8, 0.8)

// Ore → depleted ore (same size)
depletedModelScale: new THREE.Vector3(1.0, 1.0, 1.0)
```

## Limitations

### Current Limitations

1. **No per-instance materials**: All instances share the same material
2. **No per-instance animations**: Use separate entities for animated resources
3. **Fixed LOD distances**: Cannot change after instance creation
4. **No runtime model swapping**: Model path is fixed at creation

### Workarounds

**Per-instance colors**:
```typescript
// Use vertex colors in the GLB model
// Instancer preserves vertex colors
```

**Animated resources**:
```typescript
// Use StandardModelVisualStrategy for animated resources
// Or use separate InstancedMesh per animation frame
```

## Future Improvements

### Planned Features

- [ ] Per-instance material variants (color tinting)
- [ ] Dynamic LOD distance adjustment
- [ ] Frustum culling optimization
- [ ] Occlusion culling integration
- [ ] GPU-driven instance culling (compute shaders)

### Performance Targets

- **10,000 instances**: <1ms CPU overhead
- **100,000 instances**: <5ms CPU overhead
- **1,000,000 instances**: <50ms CPU overhead (with GPU culling)

## References

- **Implementation**: `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`
- **Strategy**: `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`
- **Tree Instancer**: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`
- **Tests**: `packages/shared/src/systems/shared/world/__tests__/ProcgenTreeInstancer.test.ts`
