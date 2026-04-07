# Tree Collision Proxy System

The tree collision proxy system provides pixel-accurate click detection for trees using actual LOD2 model geometry instead of oversized cylinder hitboxes. This prevents ground clicks near trees from being intercepted by invisible collision volumes.

## Overview

Previously, trees used an invisible cylinder hitbox with 0.4 radius factor, which was much larger than the visible tree silhouette. This caused ground clicks near trees to register as tree interactions instead of ground movement. The new system uses the actual LOD2 mesh geometry for collision detection, ensuring clicks only register on the visible tree model.

## Key Features

- **Geometry-Based Collision**: Uses actual LOD2 model geometry for pixel-accurate hit detection
- **Multi-Part Merging**: Combines bark and leaves into single proxy mesh for efficient raycasting
- **Proxy Geometry Cache**: Caches merged+scaled geometry per `(model, scale)` tuple to avoid redundant work
- **Shared Geometry Safety**: Proxy meshes use shared geometry (read-only) - callers must clone before mutating
- **Fallback Cylinder**: Falls back to tighter cylinder (0.25 radius factor) if LOD geometry unavailable
- **Memory Efficient**: Geometry references are shared, only position/index data is copied

## API Reference

### `getProxyGeometry()`

Returns the lowest-available LOD geometries for use as a collision proxy.

```typescript
// GLBTreeInstancer.ts
function getProxyGeometry(
  entityId: string
): { geometries: THREE.BufferGeometry[]; yOffset: number } | null

// GLBTreeBatchedInstancer.ts
function getProxyGeometry(
  entityId: string
): { geometries: THREE.BufferGeometry[]; yOffset: number } | null
```

**Parameters:**
- `entityId` - Entity ID to get proxy geometry for

**Returns:**
- `geometries` - Array of BufferGeometry objects (one per material slot: bark, leaves, etc.)
- `yOffset` - Y-axis offset to align geometry with visual instance
- `null` - If entity not registered or no LOD data available

**LOD Preference**: LOD2 → LOD1 → LOD0 (uses lowest-poly available)

**Important**: Returned geometries are **shared by the instancer pool**. Callers MUST clone before mutating (e.g., scaling).

**Example:**
```typescript
const proxyData = getProxyGeometry(treeId);
if (proxyData) {
  const merged = mergeGeometries(proxyData.geometries);
  const scaled = merged.clone();  // MUST clone before mutating
  scaled.scale(scale, scale, scale);
  scaled.computeBoundingBox();
  scaled.computeBoundingSphere();
}
```

### `clearProxyGeometryCache()`

Dispose all cached proxy geometries and clear the cache.

```typescript
// TreeGLBVisualStrategy.ts
function clearProxyGeometryCache(): void
```

**When to Call:**
- During world teardown (before destroying tree instancers)
- When unloading tree models
- On scene cleanup

**Purpose:**
- Disposes GPU buffers for cached proxy geometries
- Prevents memory leaks from accumulated cache entries
- Must be called before `destroyGLBTreeInstancer()` / `destroyGLBTreeBatchedInstancer()`

**Example:**
```typescript
// In createClientWorld.ts teardown
destroyGLBTreeInstancer();
destroyGLBTreeBatchedInstancer();
clearProxyGeometryCache();  // Must call after destroying instancers
```

## Implementation Details

### Geometry Merging

Multi-part tree models (bark + leaves) are merged into a single proxy mesh:

```typescript
function mergeGeometries(
  parts: THREE.BufferGeometry[]
): THREE.BufferGeometry | null {
  // Filter out parts missing position data
  const valid = parts.filter(g => g.getAttribute('position'));
  if (valid.length === 0) return null;
  
  // Single-part: return shared geometry directly
  if (valid.length === 1) return valid[0];
  
  // Multi-part: merge positions and indices
  // ... merge logic ...
  
  merged.computeBoundingSphere();
  return merged;
}
```

**Optimization**: Only copies position and index attributes (normals/UVs unnecessary for raycasting).

### Caching Strategy

Proxy geometries are cached per `(sourceGeometries, scale)` tuple:

```typescript
const _proxyGeometryCache = new Map<
  THREE.BufferGeometry[],
  Map<number, THREE.BufferGeometry>
>();

function getOrCreateProxyGeometry(
  sourceGeometries: THREE.BufferGeometry[],
  scale: number
): THREE.BufferGeometry | null {
  // Round scale to 3 decimal places to avoid float-key misses
  const key = Math.round(scale * 1000) / 1000;
  
  let scaleMap = _proxyGeometryCache.get(sourceGeometries);
  if (scaleMap) {
    const cached = scaleMap.get(key);
    if (cached) return cached;
  }
  
  // Merge, clone, scale, and cache
  const merged = mergeGeometries(sourceGeometries);
  if (!merged) return null;
  
  const scaled = merged.clone();
  scaled.scale(scale, scale, scale);
  scaled.computeBoundingBox();
  scaled.computeBoundingSphere();
  
  // Cache for reuse
  if (!scaleMap) {
    scaleMap = new Map();
    _proxyGeometryCache.set(sourceGeometries, scaleMap);
  }
  scaleMap.set(key, scaled);
  return scaled;
}
```

**Cache Growth**: Cache only grows (never shrinks) until `clearProxyGeometryCache()` is called. This is acceptable because:
- Tree scales are discrete (from manifest `modelScale` values)
- Cache is cleared on world teardown
- Memory overhead is minimal (geometry references + small Map structures)

### Collision Proxy Creation

```typescript
function createCollisionProxy(
  ctx: ResourceVisualContext,
  scale: number,
  batched: boolean
): void {
  // Try to use actual LOD2 model geometry
  const proxyData = batched
    ? getBatchedProxyGeometry(ctx.id)
    : getInstancedProxyGeometry(ctx.id);
  
  const cachedGeometry = proxyData
    ? getOrCreateProxyGeometry(proxyData.geometries, scale)
    : null;
  
  let geometry: THREE.BufferGeometry;
  let yPos: number;
  
  if (cachedGeometry && proxyData) {
    // Use actual model geometry (pixel-accurate)
    geometry = cachedGeometry;
    yPos = proxyData.yOffset * scale;
  } else {
    // Fallback: tighter trunk-only cylinder
    console.warn(`[TreeProxy] LOD geometry unavailable for ${ctx.id}, using cylinder fallback`);
    const dims = getDimensions(ctx.id);
    const height = (dims?.height ?? 8) * scale;
    const radius = Math.max((dims?.radius ?? 1) * scale * 0.25, 0.3);
    geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
    yPos = height / 2;
  }
  
  const material = new MeshBasicNodeMaterial();
  material.visible = false;
  
  const proxy = new THREE.Mesh(geometry, material);
  proxy.position.y = yPos;
  proxy.userData = { type: 'resource', entityId: ctx.id };
  ctx.setMesh(proxy);
}
```

### Fallback Cylinder

When LOD geometry is unavailable (rare), falls back to a tighter cylinder:

**Old Cylinder**: `radius = fullRadius * 0.4` (40% of bounding radius)
**New Cylinder**: `radius = fullRadius * 0.25` (25% of bounding radius)

The tighter radius is acceptable because:
- LOD geometry is typically available by the time `createCollisionProxy()` is called
- Fallback only triggers during initial load before LODs are ready
- Tighter cylinder reduces false-positive clicks on empty air

## Performance Characteristics

- **One-Time Cost**: Proxy creation happens once per tree instance on spawn
- **Cached Merges**: Merged geometry cached per `(model, scale)` - no redundant work for trees sharing same model
- **Efficient Raycasting**: LOD2 meshes are low-poly by design (faster than high-poly LOD0)
- **Shared Geometry**: Proxy meshes share cached geometry (read-only) - minimal memory overhead
- **Bulk Copy**: Uses `Float32Array.set()` for efficient position data copying when possible

## Thread Safety

All proxy geometry operations are synchronous and run on the main thread. The cache is not thread-safe and should not be accessed from workers.

## Usage Example

```typescript
import { 
  getProxyGeometry, 
  clearProxyGeometryCache 
} from './GLBTreeInstancer';

// Get proxy geometry for collision detection
const proxyData = getProxyGeometry(treeId);
if (proxyData) {
  const merged = mergeGeometries(proxyData.geometries);
  const scaled = merged.clone();  // MUST clone - geometry is shared
  scaled.scale(scale, scale, scale);
  
  // Use for collision proxy
  const proxy = new THREE.Mesh(scaled, invisibleMaterial);
  proxy.position.y = proxyData.yOffset * scale;
}

// World teardown
function destroyWorld() {
  destroyGLBTreeInstancer();
  destroyGLBTreeBatchedInstancer();
  clearProxyGeometryCache();  // Clear cache after destroying instancers
}
```

## Migration Notes

### From Cylinder Hitbox

The old system used a simple cylinder with tuned radius:

```typescript
// OLD (removed)
const radius = Math.max(fullRadius * 0.4, 0.3);
const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
```

**Problems:**
- Cylinder was much larger than visible tree silhouette
- Ground clicks near trees intercepted by invisible hitbox
- No visual feedback for where clicks would register

**New Approach:**
- Uses actual LOD2 model geometry (bark + leaves merged)
- Clicks only register on visible tree silhouette
- Falls back to tighter cylinder (0.25 radius) if LOD unavailable

### Source Geometry Storage

Both instancers now store `sourceGeometries` on LOD pools:

```typescript
interface LODPool {
  // ... existing fields ...
  
  /**
   * Snapshot of original source geometries (before InstancedBufferAttribute
   * additions). Retained so collision proxies can use the model shape without
   * depending on live InstancedMesh geometry references.
   */
  sourceGeometries: THREE.BufferGeometry[];
}
```

**Cleanup**: `sourceGeometries.length = 0` in `destroyGLBTreeInstancer()` / `destroyGLBTreeBatchedInstancer()` to help GC.

## Troubleshooting

**Cylinder fallback warning appearing:**
```
[TreeProxy] LOD geometry unavailable for tree_123, using cylinder fallback
```

**Cause**: LOD data not loaded when `createCollisionProxy()` was called.

**Fix**: This should be rare - LOD data is typically available after `addInstance()` succeeds. If warnings persist, check:
- LOD model paths are correct in tree manifest
- Model cache is loading LOD variants successfully
- `getProxyGeometry()` is being called after `addInstance()` completes

**Ground clicks still intercepting near trees:**

**Diagnosis**:
1. Verify you're on latest version with PR #1100 merged (March 27, 2026)
2. Check proxy mesh is using LOD2 geometry (not cylinder fallback)
3. Verify `clearProxyGeometryCache()` is called during world teardown

**Memory leak from cached geometries:**

**Symptoms**: Memory usage grows over multiple world load/unload cycles.

**Cause**: `clearProxyGeometryCache()` not called during teardown.

**Fix**: Ensure `clearProxyGeometryCache()` is called in world teardown sequence:
```typescript
destroyGLBTreeInstancer();
destroyGLBTreeBatchedInstancer();
clearProxyGeometryCache();  // Required
```

## See Also

- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - InstancedMesh implementation
- `packages/shared/src/systems/shared/world/GLBTreeBatchedInstancer.ts` - BatchedMesh implementation
- `packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts` - Visual strategy integration
- `packages/shared/src/runtime/createClientWorld.ts` - World teardown sequence
