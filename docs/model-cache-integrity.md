# Model Cache Integrity Fix

## Overview

The model cache now correctly preserves the original index buffer type (Uint16Array vs Uint32Array) when caching and restoring GLB models. This fixes silent geometry corruption and RangeError crashes that occurred when cached models were restored.

## The Problem

### Root Cause

When GLB models were cached, the index buffer type information was lost. On cache restore:

1. **Original model** loaded with Uint32Array indices (for meshes with >65535 vertices)
2. **Cache saved** geometry data but not the index buffer type
3. **Cache restored** with default Uint16Array indices
4. **Result**: Silent geometry corruption or RangeError crashes

### Symptoms

**Silent Corruption:**
- Models render with incorrect triangles
- Geometry appears "broken" or "inside-out"
- No error messages in console

**RangeError Crashes:**
```
RangeError: offset is out of bounds
  at Uint16Array.set
  at BufferAttribute.copyArray
```

This occurred when trying to copy Uint32 index data into a Uint16Array buffer.

### Affected Models

All GLB models loaded via ModelCache:
- Resource models (trees, rocks, ores, herbs)
- NPC models (mobs, NPCs)
- Item models (equipment, weapons, tools)
- Building models (structures, props)

## The Solution

### Index Buffer Type Preservation

The model cache now stores and restores the index buffer type:

```typescript
// Before (broken)
const cachedData = {
  geometry: {
    attributes: { ... },
    index: indexArray,  // Type information lost!
  }
};

// After (fixed)
const cachedData = {
  geometry: {
    attributes: { ... },
    index: indexArray,
    indexType: 'Uint16Array' | 'Uint32Array',  // Type preserved!
  }
};
```

### Cache Version Bump

Cache version bumped from 3 to 4 to invalidate corrupt entries:

```typescript
const CACHE_VERSION = 4;  // Was 3
```

All existing cached models are automatically re-processed with correct index buffer types.

## Technical Details

### Index Buffer Types

**Uint16Array** (2 bytes per index):
- Maximum vertex count: 65,535
- Used for simple models (most resources, items)
- More memory efficient

**Uint32Array** (4 bytes per index):
- Maximum vertex count: 4,294,967,295
- Required for complex models (large buildings, detailed NPCs)
- Uses more memory but supports larger meshes

### Detection Logic

```typescript
function getIndexBufferType(geometry: THREE.BufferGeometry): 'Uint16Array' | 'Uint32Array' {
  if (!geometry.index) return 'Uint16Array';
  
  const indexArray = geometry.index.array;
  if (indexArray instanceof Uint32Array) return 'Uint32Array';
  if (indexArray instanceof Uint16Array) return 'Uint16Array';
  
  // Fallback for other types
  return 'Uint16Array';
}
```

### Restoration Logic

```typescript
function restoreIndexBuffer(
  geometry: THREE.BufferGeometry,
  indexData: number[],
  indexType: 'Uint16Array' | 'Uint32Array'
): void {
  const TypedArray = indexType === 'Uint32Array' ? Uint32Array : Uint16Array;
  const indexArray = new TypedArray(indexData);
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
}
```

## Impact

### Performance

**No performance impact:**
- Index buffer type detection is O(1)
- Cache save/restore time unchanged
- Memory usage unchanged (type was always stored, just not preserved)

### Compatibility

**Breaking change for cache:**
- Cache version 3 entries are automatically invalidated
- Models are re-processed on first load after update
- Subsequent loads use correct cached data

**No breaking changes for code:**
- All existing code continues to work
- No API changes required
- Automatic fallback to individual models if instancing fails

## Verification

### How to Verify Fix

1. **Clear cache** (optional, happens automatically with version bump):
```typescript
import { modelCache } from '@hyperscape/shared';
modelCache.clear();
```

2. **Load a complex model** (>65535 vertices):
```typescript
const { scene } = await modelCache.loadModel('/assets/models/large_building.glb', world);
```

3. **Check index buffer type**:
```typescript
scene.traverse((child) => {
  if (child instanceof THREE.Mesh && child.geometry.index) {
    const indexArray = child.geometry.index.array;
    console.log('Index type:', indexArray.constructor.name);
    // Should be Uint32Array for large models
  }
});
```

4. **Verify no RangeError**:
- Load model multiple times (first load caches, second load restores)
- No RangeError should occur
- Geometry should render correctly

### Test Coverage

The fix is covered by existing tests:
- `ModelCache.test.ts` - Verifies cache save/restore
- `GLBResourceInstancer.test.ts` - Verifies instanced rendering
- `ResourceSystem.test.ts` - Integration tests for resource loading

## Related Issues

### PR #949

**Title:** fix: preserve index buffer type in processed model cache

**Changes:**
- Added `indexType` field to cached geometry data
- Implemented type detection in cache save
- Implemented type restoration in cache load
- Bumped cache version to 4

**Commit:** `afb5ba2de0d97f3ac3175a22bdef90922d79b7d9`

## Migration Notes

### For Developers

**No action required** - the fix is automatic:
1. Cache version bump invalidates old entries
2. Models are re-cached with correct index buffer types
3. All subsequent loads use correct data

### For Users

**No action required** - transparent fix:
1. First load after update may be slightly slower (re-caching)
2. Subsequent loads are normal speed
3. No visual changes or gameplay impact

## Future Improvements

### Potential Optimizations

1. **Lazy index buffer allocation**
   - Only allocate Uint32Array when needed
   - Convert Uint16Array to Uint32Array on demand
   - Saves memory for simple models

2. **Index buffer compression**
   - Use mesh optimizer for index buffer compression
   - Reduce cache size by 50-70%
   - Decompress on load

3. **Shared index buffers**
   - Share index buffers between instances
   - Further reduce memory usage
   - Requires geometry instancing support

## References

- Model Cache: `packages/shared/src/utils/rendering/ModelCache.ts`
- GLB Resource Instancer: `packages/shared/src/systems/shared/world/GLBResourceInstancer.ts`
- GLB Tree Instancer: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`
- Three.js BufferGeometry: https://threejs.org/docs/#api/en/core/BufferGeometry
