# Dissolve Animation System

The dissolve animation system provides smooth visual transitions for tree depletion and respawn using screen-door dithering. This system is shared between `GLBTreeInstancer` and `GLBTreeBatchedInstancer` to ensure consistent behavior.

## Overview

When a tree is depleted (chopped down), it instantly becomes ~70% transparent using screen-door dithering. When the tree respawns, it smoothly fades back to full opacity over 0.3 seconds. This provides clear visual feedback without requiring expensive alpha blending or transparency sorting.

## Key Features

- **Screen-Door Dithering**: Uses Bayer 4×4 dithering pattern to discard fragments, keeping trees in the opaque render pass
- **Opaque Pass Rendering**: No transparency sorting overhead, full early-Z rejection benefits
- **LOD Transition Preservation**: Dissolve state carries over during LOD swaps to prevent visual pops
- **Atomic Initial State**: Trees loaded in depleted state have dissolve applied atomically (no 1-frame flash)
- **Interrupt Handling**: Reversing an in-progress animation continues from current progress (no visual pop)

## API Reference

### Module: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

#### `DissolveAnim` Interface

```typescript
interface DissolveAnim {
  /** 1 = dissolving out (depletion), -1 = appearing in (respawn) */
  direction: 1 | -1;
  /** Current animation progress (0.0 to DISSOLVE_MAX) */
  progress: number;
}
```

#### `startDissolve()`

Start or instantly apply a dissolve animation.

```typescript
function startDissolve(
  anims: Map<string, DissolveAnim>,
  entityId: string,
  direction: 1 | -1,
  instant: boolean,
  applyFn: (entityId: string, value: number) => void,
): void
```

**Parameters:**
- `anims` - The animation map to manage
- `entityId` - Entity to animate
- `direction` - `1` for dissolve out (depletion), `-1` for appear in (respawn)
- `instant` - If `true`, jump to target value immediately; if `false`, animate over `DISSOLVE_DURATION`
- `applyFn` - Callback that writes the dissolve value to the rendering backend

**Behavior:**
- If `instant=true`: Immediately sets dissolve to target value and removes from animation map
- If `instant=false`: Starts animation from current progress (or 0/DISSOLVE_MAX if not animating)
- If already animating in opposite direction: Continues from current progress to avoid visual pop

**Example:**
```typescript
// Instant depletion (tree chopped down)
startDissolve(dissolveAnims, treeId, 1, true, applyDissolveValue);

// Animated respawn (tree grows back)
startDissolve(dissolveAnims, treeId, -1, false, applyDissolveValue);
```

#### `tickDissolveAnims()`

Advance all active dissolve animations by deltaTime and apply values.

```typescript
function tickDissolveAnims(
  anims: Map<string, DissolveAnim>,
  deltaTime: number,
  applyFn: (entityId: string, value: number) => void,
): void
```

**Parameters:**
- `anims` - The animation map to tick
- `deltaTime` - Time elapsed since last tick (seconds)
- `applyFn` - Callback that writes the dissolve value to the rendering backend

**Behavior:**
- Advances each animation's progress by `(direction * deltaTime) / DISSOLVE_DURATION`
- Clamps progress to `[0, DISSOLVE_MAX]` range
- Calls `applyFn` for each animating entity
- Removes completed animations from the map

**Performance:**
- Early-out if `anims.size === 0` (no allocations)
- Reuses module-level `_completed` array to avoid per-frame allocation
- O(active animations), not O(total instances)

**Example:**
```typescript
// In your update loop
export function updateGLBTreeInstancer(deltaTime: number): void {
  // ... LOD transitions ...
  
  // Tick dissolve animations AFTER LOD transitions
  tickDissolveAnims(dissolveAnims, deltaTime, applyDissolveValue);
  
  // ... flush GPU uploads ...
}
```

## Configuration

Dissolve behavior is controlled by `GPU_VEG_CONFIG` in `packages/shared/src/systems/shared/world/GPUMaterials.ts`:

```typescript
GPU_VEG_CONFIG = {
  /** Duration of the respawn dissolve-in animation (seconds). Depletion is instant. */
  DISSOLVE_DURATION: 0.3,
  
  /** Animation progress ceiling (not visual opacity). */
  DISSOLVE_MAX: 1.0,
  
  /** Fraction of fragments discarded when fully dissolved via screen-door dithering.
   *  0.7 = ~70% of the Bayer 4×4 grid cells are discarded. */
  DISSOLVE_ALPHA_SCALE: 0.7,
}
```

## Implementation Details

### Encoding

**InstancedMesh** (GLBTreeInstancer):
- Uses dedicated `instanceDissolve` Float32 attribute per instance
- Direct per-instance control with full precision

**BatchedMesh** (GLBTreeBatchedInstancer):
- Encodes dissolve in **blue channel** of per-instance batch color
- `blue = 1.0 - dissolveVal` (1.0 = fully visible, 0.0 = fully dissolved)
- R/G channels reserved for highlight intensity
- Uint8 precision (~256 levels) is sufficient for 0.3s animations at 60fps (~18 steps)

### Shader Integration

The dissolve effect is implemented in `createDissolveMaterial()` with `enableDepletionDissolve: true`:

```typescript
// Read dissolve value from attribute or batch color
const dissolveVal = options.batched
  ? clamp(sub(float(1.0), vBatchColor.z), float(0.0), float(1.0))
  : attribute('instanceDissolve', 'float');

// Apply screen-door dithering
const dissolveAmount = mul(dissolveVal, float(DISSOLVE_ALPHA_SCALE));
const hasDissolve = step(float(0.001), dissolveAmount);
const dissolveDiscard = mul(
  mul(step(ditherValue, dissolveAmount), hasDissolve),
  float(2.0)
);

// Combine with distance fade and water culling
const threshold = max(ditherThreshold, waterCullValue, dissolveDiscard);
return threshold; // Used in alphaTestNode
```

### LOD Transition Handling

When a tree transitions between LOD levels, the dissolve state must be preserved:

```typescript
// Read dissolve from old pool before removing
let wasDissolve = 0;
if (oldPool) {
  const oldIdx = oldPool.slots.get(entityId);
  if (oldIdx !== undefined) {
    wasDissolve = oldPool.dissolveData[oldIdx];
  }
  removeFromPool(oldPool, entityId);
}

// Apply to new pool
if (newPool) {
  addToPool(newPool, entityId, matrix, wasDissolve);
}
```

### Initial Depleted State

Trees that spawn already depleted must have dissolve applied atomically:

```typescript
// Pass initial dissolve through addInstance → addToPool
const initialDissolve = config.depleted ? GPU_VEG_CONFIG.DISSOLVE_MAX : 0;

await addBatchedTree(
  treeType,
  variantPaths,
  variantIndex,
  worldPos,
  rotation,
  baseScale,
  initialDissolve  // Applied atomically at pool insertion
);
```

## Performance Characteristics

- **Opaque Pass**: Trees stay in opaque render pass with full early-Z rejection (no transparency sorting)
- **Zero Allocation**: Reuses module-level `_completed` array to avoid per-frame allocation
- **Batched GPU Uploads**: `dissolveDirty` flag batches attribute uploads per pool per frame
- **Early-Out**: `if (anims.size === 0) return` skips work when no animations active
- **O(active animations)**: Tick cost scales with animating trees, not total tree count

## Thread Safety

**WARNING**: The `_completed` array is a module-level singleton reused across ticks. This is safe because:
- Both instancers call `tickDissolveAnims()` sequentially on the main thread
- Never called concurrently or from workers
- Each instancer has its own `dissolveAnims` map

**Breaking this assumption** (e.g., calling from a worker or async context) would silently corrupt the `_completed` array.

## Usage Example

```typescript
import { startDissolve, tickDissolveAnims } from './DissolveAnimation';

const dissolveAnims = new Map<string, DissolveAnim>();

// Tree depleted - instant dissolve
export function onTreeDepleted(entityId: string): void {
  startDissolve(dissolveAnims, entityId, 1, true, applyDissolveValue);
}

// Tree respawning - animated fade-in
export function onTreeRespawn(entityId: string): void {
  startDissolve(dissolveAnims, entityId, -1, false, applyDissolveValue);
}

// Update loop
export function update(deltaTime: number): void {
  // ... LOD transitions ...
  
  // Tick dissolve animations AFTER LOD transitions
  tickDissolveAnims(dissolveAnims, deltaTime, applyDissolveValue);
  
  // ... flush GPU uploads ...
}

// Apply dissolve value to rendering backend
function applyDissolveValue(entityId: string, value: number): void {
  const pool = getPoolForEntity(entityId);
  if (!pool) return;
  
  const idx = pool.slots.get(entityId);
  if (idx === undefined) return;
  
  pool.dissolveData[idx] = value;
  pool.dissolveDirty = true;
}
```

## Migration Notes

### From Depleted Model Pool Approach

The old system used separate "depleted" model pools with stump meshes. This has been completely removed:

**Removed APIs:**
- `setDepleted(entityId, depleted)` - Use `startDissolve()` instead
- `hasDepleted(entityId)` - No longer needed
- `loadDepletedPool()` - Depleted models no longer loaded
- `pool.depleted` - Depleted pool removed from TreeTypePool/ModelPool

**Migration:**
```typescript
// OLD (removed)
setDepleted(treeId, true);   // Depletion
setDepleted(treeId, false);  // Respawn

// NEW
startDissolve(dissolveAnims, treeId, 1, true, applyDissolveValue);   // Depletion
startDissolve(dissolveAnims, treeId, -1, false, applyDissolveValue); // Respawn
```

**Benefits:**
- Eliminates ~316 lines of depleted pool management code
- No separate model loading for depleted state
- Smoother visual transitions
- Simpler architecture

## See Also

- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - InstancedMesh implementation
- `packages/shared/src/systems/shared/world/GLBTreeBatchedInstancer.ts` - BatchedMesh implementation
- `packages/shared/src/systems/shared/world/GPUMaterials.ts` - Shader configuration
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts` - Visual strategy integration
