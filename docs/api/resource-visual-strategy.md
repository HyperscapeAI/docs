# ResourceVisualStrategy API Reference

Interface for resource entity visual rendering strategies.

## Interface

```typescript
export interface ResourceVisualStrategy {
  createVisual(ctx: ResourceVisualContext): Promise<void>;
  onDepleted(ctx: ResourceVisualContext): Promise<boolean>;
  onRespawn(ctx: ResourceVisualContext): Promise<void>;
  update(ctx: ResourceVisualContext, deltaTime: number): void;
  destroy(ctx: ResourceVisualContext): void;
  getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null;
}
```

## Methods

### `createVisual(ctx: ResourceVisualContext): Promise<void>`

Creates the visual representation for a resource entity.

**Parameters:**
- `ctx` - Resource visual context containing entity data, node, and configuration

**Called:**
- Once when resource entity is created
- After respawn (if visual was destroyed)

**Example:**
```typescript
async createVisual(ctx: ResourceVisualContext): Promise<void> {
  const { config, node, position } = ctx;
  const model = await loadModel(config.model);
  node.add(model);
  ctx.setMesh(model);
}
```

---

### `onDepleted(ctx: ResourceVisualContext): Promise<boolean>`

Called when a resource is depleted (e.g., tree chopped down, ore mined).

**Parameters:**
- `ctx` - Resource visual context

**Returns:**
- `true` - Strategy handled depletion visuals (e.g., instanced stump). ResourceEntity will skip loading individual depleted model.
- `false` - ResourceEntity should load individual depleted model (legacy behavior).

**Breaking Change (PR #946):**
Previously returned `Promise<void>`. Now returns `Promise<boolean>` to indicate whether the strategy handles depletion.

**Example:**
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  // Instanced strategy - move to depleted pool
  setInstanceDepleted(ctx.id, true);
  return true; // We handled it
}

// OR

async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  // Non-instanced strategy - hide mesh
  const mesh = ctx.getMesh();
  if (mesh) mesh.visible = false;
  return false; // ResourceEntity should load stump model
}
```

---

### `onRespawn(ctx: ResourceVisualContext): Promise<void>`

Called when a depleted resource respawns.

**Parameters:**
- `ctx` - Resource visual context

**Called:**
- After resource respawn timer completes
- Before resource becomes interactable again

**Example:**
```typescript
async onRespawn(ctx: ResourceVisualContext): Promise<void> {
  // Instanced strategy - move back to living pool
  setInstanceDepleted(ctx.id, false);
  
  // Update collision proxy
  const proxy = ctx.getMesh();
  if (proxy) {
    proxy.userData.depleted = false;
    proxy.userData.interactable = true;
  }
}
```

---

### `update(ctx: ResourceVisualContext, deltaTime: number): void`

Called every frame to update visual state.

**Parameters:**
- `ctx` - Resource visual context
- `deltaTime` - Time since last frame in seconds

**Use cases:**
- LOD switching
- Animation updates
- Material parameter updates
- Particle effects

**Example:**
```typescript
update(ctx: ResourceVisualContext, deltaTime: number): void {
  // Update instancer (handles LOD switching)
  updateGLBResourceInstancer();
  
  // Update glow effect
  if (this.glowMesh) {
    this.glowMesh.material.opacity = Math.sin(Date.now() * 0.001) * 0.5 + 0.5;
  }
}
```

---

### `destroy(ctx: ResourceVisualContext): void`

Called when resource entity is destroyed (e.g., world cleanup, chunk unload).

**Parameters:**
- `ctx` - Resource visual context

**Responsibilities:**
- Remove meshes from scene
- Dispose geometries and materials
- Remove from instancer pools
- Clean up event listeners

**Example:**
```typescript
destroy(ctx: ResourceVisualContext): void {
  // Remove from instancer
  removeInstance(ctx.id);
  
  // Clean up collision proxy
  const proxy = ctx.getMesh();
  if (proxy) {
    const mesh = proxy as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) (mesh.material as THREE.Material).dispose();
    ctx.node.remove(proxy);
    ctx.setMesh(null);
  }
}
```

---

### `getHighlightMesh?(ctx: ResourceVisualContext): THREE.Object3D | null` (Optional)

Returns a temporary mesh positioned at this instance for hover outline rendering.

**Parameters:**
- `ctx` - Resource visual context

**Returns:**
- `THREE.Object3D` - Positioned mesh for outline pass
- `null` - No highlight mesh available (falls back to entity's scene-graph mesh)

**Added in:** PR #946

**Use case:**
Instanced entities don't have individual scene-graph meshes, so the outline pass can't find them. This method provides a temporary mesh that `EntityHighlightService` adds to the scene for the duration of the hover.

**Example:**
```typescript
getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  const mesh = getInstanceHighlightMesh(ctx.id);
  if (!mesh) return null;
  
  // Position mesh at instance location
  const instance = getInstance(ctx.id);
  mesh.position.copy(instance.position);
  mesh.rotation.y = instance.rotation;
  mesh.scale.setScalar(instance.scale);
  mesh.updateMatrixWorld(true);
  
  return mesh;
}
```

## ResourceVisualContext

Context object passed to all strategy methods:

```typescript
export interface ResourceVisualContext {
  id: string;                          // Entity ID
  config: ResourceEntityConfig;        // Resource configuration
  node: THREE.Object3D;                // Scene graph node
  position: { x: number; y: number; z: number };
  getMesh: () => THREE.Object3D | null;
  setMesh: (mesh: THREE.Object3D | null) => void;
  hashString: (str: string) => number; // For deterministic randomness
}
```

## Built-in Strategies

### TreeGLBVisualStrategy

For tree resources with GLB models.

**Features:**
- Integrates with `GLBTreeInstancer`
- Automatic LOD switching (LOD0/LOD1/LOD2)
- Instanced depletion (stumps)
- Highlight mesh support

**Returns from `onDepleted()`:** `true` (handles instanced stumps)

---

### InstancedModelVisualStrategy

For non-tree resources with GLB models (rocks, ores, herbs).

**Features:**
- Integrates with `GLBResourceInstancer`
- Automatic LOD switching
- Instanced depletion
- Highlight mesh support
- Falls back to `StandardModelVisualStrategy` if instancing fails

**Returns from `onDepleted()`:** `true` if instanced, `false` if fallback

---

### StandardModelVisualStrategy

Legacy strategy for non-instanced resources.

**Features:**
- Loads individual GLB model per entity
- No LOD switching
- No instancing
- Higher draw call count

**Returns from `onDepleted()`:** `false` (ResourceEntity loads stump)

---

### FishingSpotVisualStrategy

For fishing spot resources.

**Features:**
- Glow particle effect
- Water particle manager integration
- No depletion visuals (fishing spots don't deplete)

**Returns from `onDepleted()`:** `false`

---

### PlaceholderVisualStrategy

For resources without models (uses colored cubes).

**Features:**
- Integrates with `PlaceholderInstancer`
- Colored cube based on resource type
- Minimal memory footprint

**Returns from `onDepleted()`:** `false`

---

### TreeProcgenVisualStrategy

For procedurally generated trees.

**Features:**
- Integrates with `ProcgenTreeInstancer`
- L-system based tree generation
- Instanced rendering
- LOD support

**Returns from `onDepleted()`:** `false`

## Strategy Selection

Strategies are automatically selected by `createVisualStrategy()`:

```typescript
export function createVisualStrategy(
  config: ResourceEntityConfig,
): ResourceVisualStrategy {
  // Fishing spots use particle effects
  if (config.resourceType === "fishing")
    return new FishingSpotVisualStrategy();

  // Procedural trees
  if (config.resourceType === "tree" && config.procgenPreset)
    return new TreeProcgenVisualStrategy();

  // GLB trees
  if (config.resourceType === "tree" && config.model)
    return new TreeGLBVisualStrategy();

  // GLB resources (rocks, ores, herbs)
  if (config.model)
    return new InstancedModelVisualStrategy();

  // Fallback to colored cubes
  return new PlaceholderVisualStrategy();
}
```

## Migration Guide

### Updating Existing Strategies

If you have custom visual strategies, update them for the new API:

**1. Update `onDepleted()` signature:**
```typescript
// Old
async onDepleted(ctx: ResourceVisualContext): Promise<void> {
  // Hide visual
}

// New
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  // Hide visual
  return false; // or true if you handle instanced depletion
}
```

**2. Optional: Add `getHighlightMesh()`:**
```typescript
getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
  // Return positioned mesh for outline rendering
  return null; // or your highlight mesh
}
```

### Creating New Strategies

```typescript
export class MyCustomVisualStrategy implements ResourceVisualStrategy {
  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    // Load and setup visual
  }

  async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
    // Handle depletion
    return false; // or true if instanced
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    // Restore visual
  }

  update(ctx: ResourceVisualContext, deltaTime: number): void {
    // Per-frame updates
  }

  destroy(ctx: ResourceVisualContext): void {
    // Cleanup
  }

  // Optional
  getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
    return null;
  }
}
```

## Related Documentation

- [Instanced Rendering System](../instanced-rendering.md)
- [Entity System](../entity-system.md)
- [LOD System](../lod-system.md)
