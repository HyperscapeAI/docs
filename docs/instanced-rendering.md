# Instanced Rendering System

Hyperscape uses GPU instancing to efficiently render large numbers of resource entities (trees, rocks, ores, herbs) with minimal draw calls.

## Overview

The instanced rendering system pools identical models into shared `InstancedMesh` objects, reducing draw calls from O(n) per resource to O(1) per unique model per LOD level.

### Key Components

- **GLBResourceInstancer**: General-purpose instancer for rocks, ores, herbs
- **GLBTreeInstancer**: Specialized instancer for trees with dissolve materials
- **InstancedModelVisualStrategy**: Visual strategy wrapper for instanced entities
- **TreeGLBVisualStrategy**: Tree-specific strategy with depleted model support

## Architecture

### Instance Pooling

Each instancer maintains separate pools for:
- **Normal state**: Active resources (trees, rocks, etc.)
- **Depleted state**: Harvested resources (stumps, empty ore veins)
- **LOD levels**: Distance-based level of detail (LOD0, LOD1, LOD2)

```typescript
// Example: Tree with 3 LOD levels
GLBTreeInstancer {
  pools: {
    'tree.glb': {
      LOD0: InstancedMesh (high detail, near camera)
      LOD1: InstancedMesh (medium detail, mid distance)
      LOD2: InstancedMesh (low detail, far distance)
    }
  },
  depletedPools: {
    'stump.glb': {
      LOD0: InstancedMesh (depleted state)
      LOD1: InstancedMesh (depleted state)
      LOD2: InstancedMesh (depleted state)
    }
  }
}
```

### LOD System Integration

- **Distance-based switching**: Automatically switches LOD levels based on camera distance
- **Hysteresis**: Prevents flickering by using different thresholds for switching up vs down
- **Per-instance tracking**: Each instance tracks its current LOD level independently

### Collision Handling

Instanced entities use **invisible collision proxies** for raycasting:
- Proxy mesh positioned at instance location
- Invisible to camera (renderOrder = -1, no material rendering)
- Enables mouse hover and click detection
- Persists across state transitions (normal → depleted)

## Depleted Models Feature

Resources can specify depleted models that display after harvesting:

```typescript
// Resource configuration
{
  "modelPath": "tree.glb",
  "depletedModelPath": "stump.glb",  // NEW
  "depletedModelScale": 0.8,         // NEW (optional, default: 1.0)
  "respawnTime": 60000
}
```

### State Transitions

When a resource is depleted:
1. Instancer removes instance from normal pool
2. Instancer adds instance to depleted pool (if `depletedModelPath` configured)
3. Collision proxy remains in place
4. Highlight mesh updates to match new state

When a resource respawns:
1. Instancer removes instance from depleted pool
2. Instancer adds instance back to normal pool
3. Collision proxy persists (no recreation needed)

## Highlight Mesh Support

Instanced entities support hover/selection highlighting:

```typescript
// EntityHighlightService integration
class InstancedModelVisualStrategy {
  getHighlightMesh(ctx: RenderContext): Mesh | null {
    // Returns preloaded highlight mesh from instancer
    return this.instancer.getHighlightMesh(this.modelPath);
  }
}

// ResourceEntity integration
getHighlightRoot(): Object3D {
  const highlightMesh = this.visualStrategy?.getHighlightMesh?.(ctx);
  return highlightMesh || this.mesh || this.group;
}
```

The highlight mesh is:
- Preloaded from LOD0 geometry
- Shared across all instances of the same model
- Positioned/scaled to match the hovered instance
- Removed from scene when hover ends

## API Changes

### ResourceVisualStrategy.onDepleted()

**Breaking Change**: Return type changed from `void` to `boolean`

```typescript
// OLD (void)
onDepleted(ctx: RenderContext): void {
  // Strategy handles depletion internally
}

// NEW (boolean)
onDepleted(ctx: RenderContext): boolean {
  // Return true if strategy handled depletion (instanced stump)
  // Return false if ResourceEntity should load individual depleted model
  return true;
}
```

**Migration**:
- Strategies that handle depletion internally (instanced): return `true`
- Strategies that don't handle depletion: return `false`
- ResourceEntity only loads individual depleted model if strategy returns `false`

### ResourceVisualStrategy.getHighlightMesh()

**New Optional Method**:

```typescript
getHighlightMesh?(ctx: RenderContext): Mesh | null;
```

Implement this method to provide a highlight mesh for instanced entities. Return `null` if highlighting is not supported or should use default behavior.

## Performance Benefits

### Draw Call Reduction

**Before instancing** (1000 trees):
- 1000 draw calls (1 per tree)
- High CPU overhead from draw call submission
- GPU state changes per tree

**After instancing** (1000 trees, 3 LOD levels):
- 3 draw calls (1 per LOD level)
- Minimal CPU overhead
- Single GPU state change per LOD level

### Memory Efficiency

- **Geometry sharing**: Single geometry buffer shared across all instances
- **Material sharing**: Single material shared across all instances
- **Transform matrices**: Stored in GPU-side instance buffer
- **Collision proxies**: Lightweight Box3 bounds, no full geometry duplication

## Configuration

### Resource Manifest

```json
{
  "id": "oak_tree",
  "type": "tree",
  "modelPath": "trees/oak.glb",
  "depletedModelPath": "trees/oak_stump.glb",
  "depletedModelScale": 0.75,
  "skill": "woodcutting",
  "level": 1,
  "xp": 25,
  "respawnTime": 60000,
  "loot": [
    { "itemId": "logs", "quantity": 1, "chance": 1.0 }
  ]
}
```

### Visual Strategy Selection

The system automatically selects the appropriate strategy:

```typescript
// createVisualStrategy.ts
if (config.modelPath?.endsWith('.glb')) {
  if (config.type === 'tree') {
    return new TreeGLBVisualStrategy(config);  // Uses GLBTreeInstancer
  } else {
    return new InstancedModelVisualStrategy(config);  // Uses GLBResourceInstancer
  }
}
```

## Fallback Behavior

If instancing fails (e.g., model loading error), the system automatically falls back to `StandardModelVisualStrategy`:

```typescript
// GLBResourceInstancer.ts
async addInstance(entity: ResourceEntity): Promise<void> {
  try {
    // Attempt instanced rendering
    await this.loadModel(modelPath);
    this.createInstance(entity);
  } catch (error) {
    console.warn('Instancing failed, falling back to standard model');
    // ResourceEntity will use StandardModelVisualStrategy
    throw error;
  }
}
```

## Debugging

### Visual Debugging

Enable debug visualization to see instance bounds:

```typescript
// In browser console
window.DEBUG_INSTANCED_RENDERING = true;
```

This will:
- Draw wireframe boxes around each instance
- Color-code by LOD level (green=LOD0, yellow=LOD1, red=LOD2)
- Show instance count per pool

### Performance Monitoring

Check instance statistics:

```typescript
// In browser console
const instancer = world.getSystem('GLBTreeInstancer');
console.log(instancer.getStats());
// Output:
// {
//   totalInstances: 1000,
//   poolCount: 3,
//   drawCalls: 3,
//   memoryUsage: '2.4 MB'
// }
```

## Limitations

- **Maximum instances per mesh**: 65,536 (WebGPU limit)
- **Uniform materials only**: All instances of a model share the same material
- **No per-instance animations**: Use Vertex Animation Textures (VAT) for animated instances
- **Static geometry**: Instance geometry cannot be modified at runtime

## Future Improvements

- [ ] Frustum culling per instance (currently culls entire InstancedMesh)
- [ ] Occlusion culling integration
- [ ] Dynamic instance addition/removal without full rebuild
- [ ] Per-instance material variations via vertex colors
- [ ] GPU-driven LOD selection
