# ResourceVisualStrategy API Documentation

**Breaking Changes**: ResourceVisualStrategy API updated to support instanced rendering and depleted models.

## Overview

The `ResourceVisualStrategy` interface defines how resource entities (trees, rocks, fishing spots, herbs) are rendered. Each resource type has its own strategy that handles mesh creation, LOD, animation, depletion visuals, and cleanup.

## Interface

```typescript
interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  
  /**
   * Handle resource depletion visuals.
   * 
   * @returns true if the strategy handled depletion (e.g., instanced stump)
   *          false if ResourceEntity should load an individual depleted model
   */
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;
  
  /**
   * Optional: Return a temporary mesh positioned at this instance for the outline pass.
   * Used for hover/selection highlighting on instanced entities.
   */
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

## Breaking Changes

### onDepleted() Return Type

**Before** (commit 4c55f45 and earlier):
```typescript
onDepleted(ctx: ResourceVisualContext): Promise<void>;
```

**After** (commit 9643d5d):
```typescript
onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
```

**Migration:**
```typescript
// ❌ OLD
async onDepleted(ctx: ResourceVisualContext): Promise<void> {
  // Load depleted model
  const stump = await loadModel(ctx.config.depletedModelPath);
  ctx.setMesh(stump);
}

// ✅ NEW
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  // For instanced strategies: handle depletion internally
  this.instancer.setDepleted(ctx.id, true);
  return true; // Strategy handled depletion
  
  // For non-instanced strategies: let ResourceEntity load depleted model
  return false; // ResourceEntity should load depleted model
}
```

### getHighlightMesh() Method

**New optional method** (commit 9643d5d):
```typescript
getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
```

**Purpose**: Return a positioned mesh for the outline pass on instanced entities.

**Implementation:**
```typescript
// For instanced strategies
getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  return this.instancer.getHighlightMesh(ctx.id);
}

// For non-instanced strategies
getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  return ctx.getMesh(); // Return the main mesh
}
```

## Implementations

### InstancedModelVisualStrategy

**File**: `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts`

**Features**:
- GPU instancing for resources (rocks, ores, herbs)
- Separate instance pools per LOD level
- Depleted model support (e.g., empty rock)
- Highlight mesh for hover/selection
- Invisible collision proxy for raycasting

**Usage**:
```typescript
const strategy = new InstancedModelVisualStrategy(instancer);
await strategy.createVisual(ctx);

// Depletion
const handled = await strategy.onDepleted(ctx); // Returns true

// Highlight
const highlightMesh = strategy.getHighlightMesh(ctx);
```

### TreeGLBVisualStrategy

**File**: `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`

**Features**:
- GPU instancing for trees
- Dissolve material for tree cutting animation
- Depleted model support (tree → stump)
- Highlight mesh for hover/selection
- Invisible collision proxy for raycasting

**Usage**:
```typescript
const strategy = new TreeGLBVisualStrategy(treeInstancer);
await strategy.createVisual(ctx);

// Depletion (tree → stump)
const handled = await strategy.onDepleted(ctx); // Returns true

// Highlight
const highlightMesh = strategy.getHighlightMesh(ctx);
```

### StandardModelVisualStrategy

**File**: `packages/shared/src/entities/world/visuals/StandardModelVisualStrategy.ts`

**Features**:
- Non-instanced rendering (one mesh per entity)
- Fallback for resources that don't support instancing
- Individual depleted model loading

**Usage**:
```typescript
const strategy = new StandardModelVisualStrategy();
await strategy.createVisual(ctx);

// Depletion (loads individual depleted model)
const handled = await strategy.onDepleted(ctx); // Returns false
```

### PlaceholderVisualStrategy

**File**: `packages/shared/src/entities/world/visuals/PlaceholderVisualStrategy.ts`

**Features**:
- Colored cube proxies for testing
- No model loading
- Fast initialization

**Usage**:
```typescript
const strategy = new PlaceholderVisualStrategy();
await strategy.createVisual(ctx);

// Depletion (changes cube color)
const handled = await strategy.onDepleted(ctx); // Returns true
```

## ResourceVisualContext

The context provides controlled access to entity state without circular dependencies:

```typescript
interface ResourceVisualContext {
  readonly world: World;
  readonly config: ResourceEntityConfig;
  readonly id: string;
  readonly node: THREE.Object3D;
  readonly position: { x: number; y: number; z: number };

  getMesh(): THREE.Object3D | null;
  setMesh(mesh: THREE.Object3D | null): void;

  getLod1Mesh(): THREE.Object3D | undefined;
  setLod1Mesh(mesh: THREE.Object3D | undefined): void;

  getLod2Mesh(): THREE.Object3D | undefined;
  setLod2Mesh(mesh: THREE.Object3D | undefined): void;

  hashString(input: string): number;

  /** Proxy to Entity.initHLOD for impostor support */
  initHLOD(
    modelId: string,
    options: { category: string; atlasSize: number; hemisphere: boolean },
  ): Promise<void>;
}
```

## ResourceEntity Integration

### getHighlightRoot()

**New method** (commit 9643d5d):
```typescript
getHighlightRoot(): THREE.Object3D | null {
  // For instanced entities, get highlight mesh from strategy
  if (this.visualStrategy?.getHighlightMesh) {
    return this.visualStrategy.getHighlightMesh(this.getVisualContext());
  }
  // For non-instanced entities, return main mesh
  return this.getMesh();
}
```

**Purpose**: Used by `EntityHighlightService` to get the correct mesh for outline rendering.

### Depletion Flow

**Before** (commit 4c55f45 and earlier):
```typescript
async onDepleted() {
  await this.visualStrategy?.onDepleted(this.getVisualContext());
  // Always load depleted model
  if (this.config.depletedModelPath) {
    await this.loadDepletedModel();
  }
}
```

**After** (commit 9643d5d):
```typescript
async onDepleted() {
  const handled = await this.visualStrategy?.onDepleted(this.getVisualContext());
  
  // Only load depleted model if strategy didn't handle it
  if (!handled && this.config.depletedModelPath) {
    await this.loadDepletedModel();
  }
}
```

**Benefit**: Instanced strategies can handle depletion internally (e.g., switch to stump instance pool) without loading individual models.

## Configuration

### Resource Manifest

**Depleted Models**:
```json
{
  "id": "oak-tree",
  "type": "tree",
  "modelPath": "/assets/world/resources/trees/oak.glb",
  "depletedModelPath": "/assets/world/resources/trees/oak-stump.glb",
  "depletedModelScale": 0.8,
  "respawnTime": 60000
}
```

**Fields**:
- `depletedModelPath` - Path to depleted model (e.g., stump)
- `depletedModelScale` - Scale multiplier for depleted model (default: 1.0)

### Instancer Configuration

**GLBResourceInstancer**:
```typescript
const instancer = new GLBResourceInstancer(world, {
  lod0Distance: 50,
  lod1Distance: 100,
  lod2Distance: 200,
  hysteresis: 5,
});
```

**GLBTreeInstancer**:
```typescript
const treeInstancer = new GLBTreeInstancer(world, {
  lod0Distance: 50,
  lod1Distance: 100,
  lod2Distance: 200,
  hysteresis: 5,
  dissolveDuration: 1.0, // Tree cutting animation
});
```

## EntityHighlightService Integration

**Before** (commit 4c55f45 and earlier):
```typescript
const mesh = entity.getMesh();
if (mesh) {
  this.addOutline(mesh);
}
```

**After** (commit 9643d5d):
```typescript
const highlightRoot = entity.getHighlightRoot?.() || entity.getMesh();
if (highlightRoot) {
  this.addOutline(highlightRoot);
}
```

**Benefit**: Supports instanced entities by getting highlight mesh from strategy instead of main mesh.

## Examples

### Creating a Custom Strategy

```typescript
class CustomResourceVisualStrategy implements ResourceVisualStrategy {
  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    // Load and setup mesh
    const mesh = await loadModel(ctx.config.modelPath);
    ctx.setMesh(mesh);
    ctx.node.add(mesh);
  }

  async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
    // Option 1: Handle depletion internally (return true)
    const mesh = ctx.getMesh();
    if (mesh) {
      mesh.material.opacity = 0.5; // Make semi-transparent
    }
    return true; // Strategy handled depletion

    // Option 2: Let ResourceEntity load depleted model (return false)
    // return false;
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    // Restore original visuals
    const mesh = ctx.getMesh();
    if (mesh) {
      mesh.material.opacity = 1.0;
    }
  }

  update(ctx: ResourceVisualContext, deltaTime: number): void {
    // Update animations, LOD, etc.
  }

  destroy(ctx: ResourceVisualContext): void {
    // Cleanup
    const mesh = ctx.getMesh();
    if (mesh) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }

  getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
    // Return mesh for outline rendering
    return ctx.getMesh();
  }
}
```

### Using Instanced Rendering

```typescript
// Initialize instancer in createClientWorld()
const resourceInstancer = new GLBResourceInstancer(world, {
  lod0Distance: 50,
  lod1Distance: 100,
  lod2Distance: 200,
  hysteresis: 5,
});

// Create strategy
const strategy = new InstancedModelVisualStrategy(resourceInstancer);

// ResourceEntity will use this strategy automatically
// based on createVisualStrategy() factory
```

## Testing

### Visual Testing

```typescript
// Test instanced rendering
const resource = world.getEntity(resourceId) as ResourceEntity;
const mesh = resource.getMesh();
expect(mesh).toBeInstanceOf(THREE.InstancedMesh);

// Test depletion
await resource.onDepleted();
const highlightMesh = resource.getHighlightRoot();
expect(highlightMesh).not.toBeNull();

// Test highlight mesh
const strategy = resource.visualStrategy;
if (strategy?.getHighlightMesh) {
  const highlight = strategy.getHighlightMesh(resource.getVisualContext());
  expect(highlight).toBeInstanceOf(THREE.Object3D);
}
```

### Integration Testing

```typescript
// Test full depletion flow
const resource = world.getEntity(resourceId) as ResourceEntity;

// Deplete resource
await resource.onDepleted();

// Verify strategy handled depletion
const handled = await resource.visualStrategy?.onDepleted(
  resource.getVisualContext()
);
expect(handled).toBe(true);

// Verify collision proxy persists
const collisionProxy = resource.node.children.find(
  child => child.userData.isCollisionProxy
);
expect(collisionProxy).toBeDefined();
```

## Performance Considerations

### Instanced Rendering

**Benefits**:
- Reduces draw calls from O(n) to O(1) per unique model per LOD level
- Supports thousands of resources with minimal performance impact
- Automatic LOD switching based on distance

**Limitations**:
- All instances share the same material
- Cannot have per-instance animations (use vertex animation textures)
- Raycasting requires collision proxies

### Depleted Models

**Instanced Approach** (recommended):
- Maintains separate instance pools for normal and depleted states
- No individual model loading on depletion
- Instant transition (no loading delay)
- Lower memory usage

**Non-Instanced Approach** (fallback):
- Loads individual depleted model per entity
- Higher memory usage
- Loading delay on depletion
- More flexible (per-entity customization)

## Related Files

- `packages/shared/src/entities/world/visuals/ResourceVisualStrategy.ts` - Interface definition
- `packages/shared/src/entities/world/visuals/InstancedModelVisualStrategy.ts` - Instanced implementation
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts` - Tree-specific instancing
- `packages/shared/src/entities/world/visuals/StandardModelVisualStrategy.ts` - Non-instanced fallback
- `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts` - Resource instancer
- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - Tree instancer
- `packages/shared/src/entities/world/ResourceEntity.ts` - Entity integration
- `packages/shared/src/systems/client/interaction/services/EntityHighlightService.ts` - Highlight integration

## Related Commits

- `9643d5d` - Add instanced highlight mesh and instanced depleted models
- `53a9513` - Add instanced rendering for StandardModel resources
- `4c55f45` - Merge PR #946 (instanced rendering for GLB resources)

## References

- [Three.js InstancedMesh](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Hyperscape Instanced Rendering](../packages/shared/README.md#instanced-rendering-system)
- [WebGPU Performance](https://www.w3.org/TR/webgpu/#performance)
