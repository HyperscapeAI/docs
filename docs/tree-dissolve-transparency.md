# Tree Dissolve Transparency

**Added**: March 27, 2026 (PR #1101)  
**Location**: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

## Overview

The tree dissolve transparency system provides visual feedback for resource depletion and respawn. Depleted trees become ~70% transparent instantly using screen-door dithering, then animate back to full opacity over 0.3 seconds on respawn.

## Key Features

- **Instant Depletion**: Trees become transparent immediately when depleted
- **Smooth Respawn**: 0.3-second fade-in animation when tree respawns
- **Opaque Rendering**: Uses screen-door dithering to stay in opaque render pass (no transparency sorting overhead)
- **LOD Preservation**: Dissolve state carries over during LOD transitions to prevent visual pops
- **Dual Backend**: Supports both InstancedMesh and BatchedMesh rendering paths

## Architecture

### DissolveAnimation Module

**File**: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

Shared state machine used by both `GLBTreeInstancer` and `GLBTreeBatchedInstancer` to keep dissolve logic synchronized.

#### DissolveAnim Interface

```typescript
interface DissolveAnim {
  /** 1 = dissolving out (depletion), -1 = appearing in (respawn) */
  direction: 1 | -1;
  /** Current animation progress (0 = fully visible, DISSOLVE_MAX = fully dissolved) */
  progress: number;
}
```

#### Core Functions

##### `startDissolve(anims, entityId, direction, instant, applyFn)`

Start or instantly apply a dissolve animation.

**Parameters**:
- `anims: Map<string, DissolveAnim>` - Animation map to manage
- `entityId: string` - Entity to dissolve
- `direction: 1 | -1` - 1 for depletion, -1 for respawn
- `instant: boolean` - If true, skip animation and apply immediately
- `applyFn: (entityId: string, value: number) => void` - Callback to write dissolve value to rendering backend

**Behavior**:
- If `instant=true`, applies target value immediately and removes from animation map
- If `instant=false`, starts animation from current progress (or 0/DISSOLVE_MAX based on direction)
- If animation already in progress, continues from current progress to avoid visual pop

**Example**:
```typescript
// Instant depletion (tree cut down)
startDissolve(dissolveAnims, treeId, 1, true, applyDissolveValue);

// Animated respawn (tree grows back)
startDissolve(dissolveAnims, treeId, -1, false, applyDissolveValue);
```

##### `tickDissolveAnims(anims, deltaTime, applyFn)`

Advance all active dissolve animations by deltaTime and apply values.

**Parameters**:
- `anims: Map<string, DissolveAnim>` - Animation map to tick
- `deltaTime: number` - Time elapsed since last tick (seconds)
- `applyFn: (entityId: string, value: number) => void` - Callback to write dissolve value to rendering backend

**Behavior**:
- Advances each animation's progress by `(direction * deltaTime) / DISSOLVE_DURATION`
- Clamps progress to `[0, DISSOLVE_MAX]` range
- Removes completed animations from map
- Uses module-level `_completed` array to avoid per-frame allocation

**Example**:
```typescript
// Called every frame in tree instancer update loop
tickDissolveAnims(dissolveAnims, deltaTime, applyDissolveValue);
```

---

## Configuration

**File**: `packages/shared/src/systems/shared/world/GPUMaterials.ts`

```typescript
export const GPU_VEG_CONFIG = {
  // ... other config ...
  
  /**
   * Duration of the respawn dissolve-in animation (seconds). Depletion is instant.
   * NOTE: BatchedMesh encodes dissolve in a Uint8 blue channel (~256 levels).
   * At 60fps this gives ~18 steps over 0.3s, which is smooth enough. Increasing
   * this value significantly may require switching to Float32 encoding to avoid banding.
   */
  DISSOLVE_DURATION: 0.3,
  
  /**
   * Animation progress ceiling (not visual opacity).
   * The actual fraction of fragments discarded is controlled by DISSOLVE_ALPHA_SCALE.
   */
  DISSOLVE_MAX: 1.0,
  
  /**
   * Fraction of fragments discarded when fully dissolved via screen-door dithering.
   * 0.7 = ~70% of the Bayer 4×4 grid cells are discarded, giving a stippled look.
   */
  DISSOLVE_ALPHA_SCALE: 0.7,
};
```

---

## Implementation Details

### Encoding Strategy

#### InstancedMesh
Uses dedicated `instanceDissolve` float attribute per instance:

```typescript
const dissolveData = new Float32Array(MAX_INSTANCES);
const dsAttr = new THREE.InstancedBufferAttribute(dissolveData, 1);
dsAttr.setUsage(THREE.DynamicDrawUsage);
geometry.setAttribute('instanceDissolve', dsAttr);
```

#### BatchedMesh
Encodes dissolve in the **blue channel** of per-instance batch colors:

```typescript
// Batch color channel layout:
// R = highlight intensity (1.0 = normal, >1.0 = highlighted)
// G = highlight intensity (same as R)
// B = 1.0 - dissolveVal (1.0 = fully visible, 0.0 = fully dissolved)

const encoded = 1.0 - dissolveVal;
tmpColor.setRGB(r, g, encoded);
batch.setColorAt(instanceId, tmpColor);
```

**Precision Note**: Uint8 color buffer provides ~256 levels. At 0.3s duration / 60fps (~18 steps), this is sufficient. Longer durations may show banding.

### Shader Integration

**File**: `packages/shared/src/systems/shared/world/GPUMaterials.ts`

The dissolve effect uses Bayer 4×4 screen-door dithering in the `alphaTestNode`:

```typescript
// Depletion dissolve: screen-door dithering for depleted trees.
// Reuses the same Bayer dither value computed for distance fade.
if (options.enableDepletionDissolve) {
  const dissolveVal = options.batched
    ? clamp(
        sub(float(1.0), varyingProperty('vec3', 'vBatchColor').z),
        float(0.0),
        float(1.0),
      )
    : attribute('instanceDissolve', 'float');
  
  const dissolveAmount = mul(
    dissolveVal,
    float(GPU_VEG_CONFIG.DISSOLVE_ALPHA_SCALE),
  );
  
  const hasDissolve = step(float(0.001), dissolveAmount);
  const dissolveDiscard = mul(
    mul(step(ditherValue, dissolveAmount), hasDissolve),
    float(2.0),
  );
  
  threshold = max(threshold, dissolveDiscard);
}
```

**Key Points**:
- Dithering uses Bayer 4×4 pattern (same as distance fade)
- Fragments are discarded via `alphaTestNode`, not alpha blending
- Trees stay in opaque render pass with full early-Z benefits
- No transparency sorting overhead

### LOD Transition Handling

Dissolve state is preserved when trees transition between LOD levels:

```typescript
// Read dissolve state from old pool before removing
let wasDissolve = 0;
if (oldPool && oldPool.slots.has(slot.entityId)) {
  const oldIdx = oldPool.slots.get(slot.entityId)!;
  wasDissolve = oldPool.dissolveData[oldIdx];
}

// Remove from old pool
if (oldPool) removeFromPool(oldPool, slot.entityId);

// Add to new pool with preserved dissolve state
if (newPool) {
  const mat = composeInstanceMatrix(slot.position, slot.rotation, slot.scale, slot.yOffset);
  addToPool(newPool, slot.entityId, mat, wasDissolve);
}
```

### Initial Dissolve State

Trees that spawn already depleted have dissolve applied atomically during instance creation:

```typescript
const initialDissolve = config.depleted ? GPU_VEG_CONFIG.DISSOLVE_MAX : 0;

if (config.modelVariants?.length) {
  success = await addBatchedTree(
    treeType,
    config.modelVariants,
    variantIndex,
    ctx.id,
    worldPos,
    rotation,
    baseScale,
    initialDissolve,  // Passed to addInstance
  );
}
```

This prevents a 1-frame flash of the full tree before dissolve is applied.

---

## API Reference

### TreeGLBVisualStrategy

#### `onDepleted(ctx: ResourceVisualContext): Promise<boolean>`

Called when a tree is depleted (cut down).

**Behavior**:
- Starts instant dissolve animation (direction=1, instant=true)
- Sets `proxy.userData.depleted = true`
- Sets `proxy.userData.interactable = false`
- Always returns `true` (dissolve handles all depletion visuals)

**Example**:
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
  if (isBatched(ctx.id)) {
    startBatchedDissolve(ctx.id, 1, true);
  } else {
    startInstancedDissolve(ctx.id, 1, true);
  }
  
  const proxy = ctx.getMesh();
  if (proxy) {
    proxy.userData.depleted = true;
    proxy.userData.interactable = false;
  }
  
  return true;
}
```

#### `onRespawn(ctx: ResourceVisualContext): Promise<void>`

Called when a tree respawns.

**Behavior**:
- Starts reverse dissolve animation (direction=-1, instant=false)
- Sets `proxy.userData.depleted = false`
- Sets `proxy.userData.interactable = true`
- Animation runs over DISSOLVE_DURATION seconds

**Example**:
```typescript
async onRespawn(ctx: ResourceVisualContext): Promise<void> {
  if (isBatched(ctx.id)) {
    startBatchedDissolve(ctx.id, -1);
  } else {
    startInstancedDissolve(ctx.id, -1);
  }
  
  const proxy = ctx.getMesh();
  if (proxy) {
    proxy.userData.depleted = false;
    proxy.userData.interactable = true;
  }
}
```

#### `update(_ctx: ResourceVisualContext, deltaTime: number): void`

Called every frame to tick dissolve animations.

**Behavior**:
- Calls `updateGLBTreeInstancer(deltaTime)` and `updateGLBTreeBatchedInstancer(deltaTime)`
- Both instancers tick their dissolve animations via `tickDissolveAnims()`
- Dissolve ticks run AFTER LOD transitions to ensure entities are in correct pools

**Example**:
```typescript
update(_ctx: ResourceVisualContext, deltaTime: number): void {
  updateGLBTreeInstancer(deltaTime);
  updateGLBTreeBatchedInstancer(deltaTime);
}
```

---

## Performance Characteristics

### Memory
- **Zero-allocation tick loop**: Reuses module-level `_completed` array
- **Shared geometry**: Textures and base geometry shared across instances
- **Minimal state**: Only active animations stored in map (~0-20 entries typical)

### CPU
- **O(active animations)**: Tick cost scales with animating trees, not total trees
- **Early-out optimization**: Skips tick when animation map is empty
- **Batched GPU uploads**: `dissolveDirty` flag batches attribute updates per pool

### GPU
- **Opaque pass**: Trees stay in opaque render pass (no transparency sorting)
- **Early-Z rejection**: Screen-door dithering preserves depth testing benefits
- **No overdraw penalty**: Discarded fragments don't write to framebuffer

---

## Troubleshooting

### Trees not dissolving on depletion

**Symptoms**: Trees remain fully visible when depleted.

**Causes**:
1. `onDepleted()` not being called by `ResourceEntity`
2. Dissolve animation map not being ticked
3. GPU attribute not being uploaded

**Debug**:
```typescript
// Add logging to TreeGLBVisualStrategy.onDepleted
console.log('[Dissolve] Tree depleted:', ctx.id);

// Add logging to DissolveAnimation.startDissolve
console.log('[Dissolve] Starting dissolve:', entityId, direction, instant);

// Check if animation is ticking
console.log('[Dissolve] Active animations:', dissolveAnims.size);
```

### Trees flashing during LOD transitions

**Symptoms**: Trees briefly appear fully visible when switching LOD levels.

**Cause**: Dissolve state not being preserved during LOD swap.

**Fix**: Verify `wasDissolve` is being read from old pool and passed to `addToPool()` in new pool.

### Dissolve animation too fast/slow

**Symptoms**: Animation completes in wrong duration.

**Cause**: `deltaTime` not being passed correctly to `tickDissolveAnims()`.

**Fix**: Verify `update()` receives real `deltaTime` from game loop, not hardcoded `1/60`.

### Banding/stepping in dissolve animation

**Symptoms**: Dissolve appears to step in discrete increments rather than smooth fade.

**Cause**: Uint8 color buffer precision insufficient for long animation durations.

**Fix**: Reduce `DISSOLVE_DURATION` or switch BatchedMesh to Float32 color buffer.

---

## Related Systems

- **ResourceSystem** (`packages/shared/src/systems/shared/entities/ResourceSystem.ts`) - Calls `onDepleted()` and `onRespawn()`
- **GLBTreeInstancer** (`packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`) - InstancedMesh rendering backend
- **GLBTreeBatchedInstancer** (`packages/shared/src/systems/shared/world/GLBTreeBatchedInstancer.ts`) - BatchedMesh rendering backend
- **GPUMaterials** (`packages/shared/src/systems/shared/world/GPUMaterials.ts`) - TSL shader integration

---

## Code Examples

### Basic Usage

```typescript
import { startDissolve, tickDissolveAnims } from './DissolveAnimation';

const dissolveAnims = new Map<string, DissolveAnim>();

// Deplete a tree (instant)
startDissolve(dissolveAnims, treeId, 1, true, (id, value) => {
  // Apply dissolve value to rendering backend
  applyDissolveToGPU(id, value);
});

// Respawn a tree (animated)
startDissolve(dissolveAnims, treeId, -1, false, (id, value) => {
  applyDissolveToGPU(id, value);
});

// Tick animations every frame
function update(deltaTime: number) {
  tickDissolveAnims(dissolveAnims, deltaTime, (id, value) => {
    applyDissolveToGPU(id, value);
  });
}
```

### Integration with Tree Instancer

```typescript
// GLBTreeInstancer.ts
import { startDissolve as startDissolveAnim, tickDissolveAnims } from './DissolveAnimation';

const dissolveAnims = new Map<string, DissolveAnim>();

function applyDissolveValue(entityId: string, value: number): void {
  const modelPath = entityToModel.get(entityId);
  if (!modelPath) return;
  
  const pool = pools.get(modelPath);
  if (!pool) return;
  
  const slot = pool.instances.get(entityId);
  if (!slot) return;
  
  const lodPool = getLodPool(pool, slot);
  if (!lodPool) return;
  
  const idx = lodPool.slots.get(entityId);
  if (idx === undefined) return;
  
  if (lodPool.dissolveData[idx] === value) return;
  lodPool.dissolveData[idx] = value;
  lodPool.dissolveDirty = true;
}

export function startDissolve(entityId: string, direction: 1 | -1, instant = false): void {
  startDissolveAnim(dissolveAnims, entityId, direction, instant, applyDissolveValue);
}

export function updateGLBTreeInstancer(deltaTime: number): void {
  // ... LOD transitions ...
  
  // Tick dissolve animations AFTER LOD transitions
  tickDissolveAnims(dissolveAnims, deltaTime, applyDissolveValue);
  
  // Flush dirty pools
  for (const pool of pools.values()) {
    for (const lodPool of [pool.lod0, pool.lod1, pool.lod2]) {
      if (!lodPool) continue;
      
      if (lodPool.dissolveDirty) {
        for (const im of lodPool.meshes) {
          const attr = im.geometry.getAttribute('instanceDissolve');
          if (attr) (attr as THREE.InstancedBufferAttribute).needsUpdate = true;
        }
        lodPool.dissolveDirty = false;
      }
    }
  }
}
```

---

## Shader Implementation

### Material Creation

```typescript
// GPUMaterials.ts
export function createTreeDissolveMaterial(
  source: THREE.Material,
  options: DissolveMaterialOptions,
): DissolveMaterial {
  const baseDm = createDissolveMaterial(source, {
    ...options,
    enableRimHighlight: false,
    enableDepletionDissolve: true,  // Enable dissolve dithering
  });
  
  // ... additional tree-specific shader code ...
}
```

### Dithering Logic

The shader uses a Bayer 4×4 dithering pattern to discard fragments:

```typescript
// Read dissolve value from attribute or batch color
const dissolveVal = options.batched
  ? clamp(sub(float(1.0), varyingProperty('vec3', 'vBatchColor').z), float(0.0), float(1.0))
  : attribute('instanceDissolve', 'float');

// Calculate fraction of fragments to discard
const dissolveAmount = mul(dissolveVal, float(GPU_VEG_CONFIG.DISSOLVE_ALPHA_SCALE));

// Discard fragments where dither pattern < dissolve amount
const hasDissolve = step(float(0.001), dissolveAmount);
const dissolveDiscard = mul(
  mul(step(ditherValue, dissolveAmount), hasDissolve),
  float(2.0),
);

// Combine with other discard conditions (distance fade, water culling)
threshold = max(threshold, dissolveDiscard);
```

**Bayer 4×4 Pattern**:
```
 0/16  8/16  2/16 10/16
12/16  4/16 14/16  6/16
 3/16 11/16  1/16  9/16
15/16  7/16 13/16  5/16
```

---

## Performance Optimization

### Batched GPU Uploads

Instead of marking `needsUpdate` per-entity, the system uses a `dissolveDirty` flag per LOD pool:

```typescript
function applyDissolveValue(entityId: string, value: number): void {
  // ... find pool and slot ...
  
  if (lodPool.dissolveData[idx] === value) return;  // Early-out if unchanged
  lodPool.dissolveData[idx] = value;
  lodPool.dissolveDirty = true;  // Mark pool dirty, not individual mesh
}

// Later, flush all dirty pools once per frame
if (lodPool.dissolveDirty) {
  for (const im of lodPool.meshes) {
    const attr = im.geometry.getAttribute('instanceDissolve');
    if (attr) (attr as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
  lodPool.dissolveDirty = false;
}
```

### Zero-Allocation Tick Loop

The `_completed` array is reused across ticks to avoid per-frame allocation:

```typescript
/**
 * Reused across ticks to avoid per-frame allocation.
 * WARNING: Not re-entrant — callers must invoke tickDissolveAnims sequentially
 * on the main thread.
 */
const _completed: string[] = [];

export function tickDissolveAnims(
  anims: Map<string, DissolveAnim>,
  deltaTime: number,
  applyFn: (entityId: string, value: number) => void,
): void {
  if (anims.size === 0) return;
  
  _completed.length = 0;  // Clear without allocating new array
  
  for (const [entityId, anim] of anims) {
    anim.progress += (anim.direction * deltaTime) / DISSOLVE_DURATION;
    anim.progress = Math.max(0, Math.min(DISSOLVE_MAX, anim.progress));
    applyFn(entityId, anim.progress);
    
    if (
      (anim.direction > 0 && anim.progress >= DISSOLVE_MAX) ||
      (anim.direction < 0 && anim.progress <= 0)
    ) {
      _completed.push(entityId);
    }
  }
  
  for (const id of _completed) anims.delete(id);
}
```

---

## Testing

### Unit Tests

No dedicated unit tests for `DissolveAnimation.ts` (pure state machine logic could be tested in isolation).

### Integration Tests

Dissolve behavior is tested indirectly through:
- `packages/shared/src/systems/shared/entities/__tests__/ResourceSystem.integration.test.ts`
- E2E tests that deplete and respawn trees

### Visual Verification

Manual testing checklist:
1. ✅ Deplete a tree → instant transparency
2. ✅ Wait for respawn → smooth fade-in over 0.3s
3. ✅ Trigger LOD transition during dissolve → no visual pop
4. ✅ Deplete multiple trees simultaneously → all dissolve correctly
5. ✅ Verify trees stay in opaque pass (check render stats)

---

## Future Enhancements

Potential improvements:

- **Configurable Dither Patterns**: Support different dithering patterns (8×8, blue noise)
- **Per-Tree Dissolve Speed**: Allow manifest to override `DISSOLVE_DURATION` per tree type
- **Dissolve Direction Control**: Support custom dissolve directions (trunk→canopy, canopy→trunk)
- **Dissolve Events**: Emit events when dissolve starts/completes for audio/particle effects
- **Dissolve Curves**: Support easing functions (ease-in, ease-out) instead of linear

---

## Related Documentation

- [Tree Collision Proxy](tree-collision-proxy.md) - LOD2 geometry for collision detection
- [Resource Respawn System](resource-respawn-system.md) - Tick-based respawn mechanics
- [GPU Materials](../packages/shared/src/systems/shared/world/GPUMaterials.ts) - TSL shader implementation
- [Performance March 2026](performance-march-2026.md) - Server performance overhaul
