# Instanced Rendering

Hyperscape uses GPU instancing to render thousands of resource entities (trees, rocks, ores, herbs) with minimal draw calls.

## Overview

Instead of creating individual meshes for each resource entity, Hyperscape pools instances by model path and uses `InstancedMesh` to render all instances of the same model in a single draw call.

**Performance Impact:**
- **Before**: O(n) draw calls per resource type (1000 trees = 1000 draw calls)
- **After**: O(1) draw calls per unique model per LOD level (1000 trees = 3 draw calls for LOD0/1/2)

## Architecture

### GLBResourceInstancer

Core instancing system for non-tree resources (rocks, ores, herbs, plants).

**Features:**
- Pools instances by model path
- Separate `InstancedMesh` per LOD level (LOD0, LOD1, LOD2)
- Distance-based LOD switching with hysteresis
- Dissolve material support for depletion animations
- Automatic cleanup when instances are removed

**Usage:**
```typescript
const instancer = new GLBResourceInstancer(world, {
  modelPath: '/assets/models/rock-iron.glb',
  maxInstances: 1000,
  lodDistances: [15, 30, 60],
  depletedModelPath: '/assets/models/rock-depleted.glb',
  depletedModelScale: 0.8,
});

// Add instance
const instanceId = instancer.addInstance(position, rotation, scale);

// Update instance
instancer.updateInstance(instanceId, newPosition, newRotation, newScale);

// Remove instance
instancer.removeInstance(instanceId);

// Update LODs based on camera position
instancer.update(cameraPosition);
```

### GLBTreeInstancer

Specialized instancer for tree resources with additional features:

**Features:**
- All GLBResourceInstancer features
- Preloads highlight mesh from LOD0 for hover effects
- Separate depleted pool with configurable scale
- Removes stale highlight meshes on state transitions
- Optimized for large tree populations

**Usage:**
```typescript
const treeInstancer = new GLBTreeInstancer(world, {
  modelPath: '/assets/models/tree-oak.glb',
  maxInstances: 5000,
  lodDistances: [20, 40, 80],
  depletedModelPath: '/assets/models/stump-oak.glb',
  depletedModelScale: 0.6,
});
```

### InstancedModelVisualStrategy

Visual strategy that wraps GLBResourceInstancer for use with ResourceEntity.

**Features:**
- Thin wrapper around GLBResourceInstancer
- Invisible collision proxies for raycasting
- Falls back to StandardModelVisualStrategy if instancing fails
- Implements ResourceVisualStrategy interface

**Integration:**
```typescript
// In createVisualStrategy.ts
if (resourceType === 'rock' || resourceType === 'ore' || resourceType === 'herb') {
  return new InstancedModelVisualStrategy(world, {
    modelPath: resourceData.modelPath,
    depletedModelPath: resourceData.depletedModelPath,
    depletedModelScale: resourceData.depletedScale || 1.0,
  });
}
```

## Visual Strategy Interface

All visual strategies implement the `ResourceVisualStrategy` interface:

```typescript
interface ResourceVisualStrategy {
  // Initialize visual representation
  init(entity: ResourceEntity): Promise<void>;
  
  // Clean up resources
  destroy(): void;
  
  // Handle depletion state
  // Returns: true if strategy handles depletion, false if entity should load stump
  onDepleted(): boolean;
  
  // Handle respawn state
  onRespawn(): void;
  
  // Optional: Get highlight mesh for hover effects
  getHighlightMesh?(): Object3D | null;
}
```

## LOD System

Instanced rendering uses distance-based LOD switching:

**LOD Levels:**
- **LOD0**: High detail (0-15m for rocks, 0-20m for trees)
- **LOD1**: Medium detail (15-30m for rocks, 20-40m for trees)
- **LOD2**: Low detail (30-60m for rocks, 40-80m for trees)

**Hysteresis:**
LOD switching includes hysteresis to prevent flickering when the camera is near a LOD boundary:
- Switch to higher LOD at distance `d`
- Switch to lower LOD at distance `d + 2m`

**Update Frequency:**
LOD updates run every frame in the render loop, checking camera distance for all instances.

## Highlight System

Instanced entities support hover highlighting via `EntityHighlightService`:

**Implementation:**
1. Visual strategy implements `getHighlightMesh()` to return highlight geometry
2. GLBTreeInstancer/GLBResourceInstancer preload highlight mesh from LOD0
3. EntityHighlightService adds highlight mesh to scene on hover
4. Highlight mesh removed when hover ends or entity state changes

**Example:**
```typescript
class InstancedModelVisualStrategy implements ResourceVisualStrategy {
  getHighlightMesh(): Object3D | null {
    return this.instancer.getHighlightMesh(this.instanceId);
  }
}
```

## Depletion Handling

Instanced resources support two depletion modes:

**1. Strategy-Managed Depletion** (preferred):
- Visual strategy returns `true` from `onDepleted()`
- Instancer moves instance to depleted pool
- Uses separate depleted model with configurable scale
- Entity preserves collision proxy for raycasting

**2. Entity-Managed Depletion** (fallback):
- Visual strategy returns `false` from `onDepleted()`
- Entity loads depleted model (stump) directly
- Used when instancer doesn't support depletion

**Example:**
```typescript
onDepleted(): boolean {
  // Move to depleted pool
  this.instancer.setDepleted(this.instanceId, true);
  return true; // Strategy handles depletion
}

onRespawn(): void {
  // Move back to normal pool
  this.instancer.setDepleted(this.instanceId, false);
}
```

## Memory Management

Instanced rendering significantly reduces memory usage:

**Per-Instance Memory:**
- **Standard rendering**: ~500KB per entity (mesh + materials + geometry)
- **Instanced rendering**: ~64 bytes per instance (matrix + state)

**Example:**
- 1000 trees with standard rendering: ~500MB
- 1000 trees with instanced rendering: ~64KB + shared geometry (~2MB) = ~2.1MB
- **Memory savings: ~99.6%**

## Collision Detection

Instanced entities use invisible collision proxies for raycasting:

**Implementation:**
1. Create invisible Box3 collision proxy at instance position
2. Add proxy to raycasting layer
3. Raycast hits proxy, returns entity reference
4. Entity handles interaction (gather, attack, etc.)

**Why Proxies:**
- InstancedMesh doesn't support per-instance raycasting
- Proxies provide accurate hit detection without performance cost
- Proxies update position when instance moves

## Debugging

Enable instanced rendering debug mode:

```typescript
// In browser console
window.__DEBUG_INSTANCED_RENDERING__ = true;

// Shows:
// - Instance count per model
// - LOD distribution
// - Memory usage
// - Draw call count
```

## Fallback Behavior

If instancing fails (e.g., WebGL context lost, out of memory), the system automatically falls back to standard rendering:

```typescript
try {
  return new InstancedModelVisualStrategy(world, config);
} catch (err) {
  console.warn('Instancing failed, falling back to standard rendering:', err);
  return new StandardModelVisualStrategy(world, config);
}
```

## Future Improvements

- **GPU culling**: Use compute shaders to cull instances outside frustum
- **Impostor integration**: Automatically switch to impostors at far distances
- **Dynamic batching**: Merge nearby instances into single InstancedMesh
- **Occlusion culling**: Skip instances behind terrain or buildings
