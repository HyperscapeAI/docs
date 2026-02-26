# Model Cache Fixes (February 2026)

**Commit**: c98f1cce4240b5d4d7a459f60f47a927fe606d2b  
**PR**: #935  
**Author**: tcm390

## Summary

Fixed two critical bugs in the IndexedDB processed model cache that caused missing objects (altars, trees) and lost textures (white/wrong colors) after browser restart.

## Bug 1: Missing Objects

### Symptoms
- Objects disappear after browser restart
- Common missing objects: altars, trees, rocks
- Models with duplicate mesh names affected most

### Root Cause

`serializeNode()` used `findIndex`-by-name to map hierarchy nodes to mesh data:

```typescript
// BROKEN: Multiple meshes with same name all resolve to same index
const meshIndex = meshes.findIndex(m => m.name === node.name);
```

Models with duplicate mesh names (common: "", "Cube", "Cube") all resolved to the same index. During deserialization, `Three.js add()` auto-removes from previous parent, so only the last reference survived.

### Fix

Use `Map<Object3D, number>` identity map built during traversal:

```typescript
// Build identity map during traversal
const nodeToIndex = new Map<Object3D, number>();
scene.traverse((node, index) => {
  nodeToIndex.set(node, index);
});

// Serialize using identity map
const meshIndex = nodeToIndex.get(node);
```

**Result**: Each node gets unique index regardless of name, all objects preserved.

## Bug 2: Lost Textures

### Symptoms
- Textures appear white or wrong color after browser restart
- Affects all textured models
- Cache appears to load but materials are broken

### Root Cause

Textures were serialized as ephemeral `blob:` URLs but never reloaded during deserialization:

```typescript
// BROKEN: blob: URLs are ephemeral, invalid after restart
const textureUrl = texture.image.src;  // "blob:http://localhost:3333/abc-123"
// ... save to IndexedDB ...
// On reload: blob URL is invalid, texture fails to load
```

### Fix

Extract raw RGBA pixels via canvas `getImageData()` (synchronous) and restore as `THREE.DataTexture`:

```typescript
// Serialize: Extract raw pixels
const canvas = document.createElement('canvas');
canvas.width = texture.image.width;
canvas.height = texture.image.height;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(texture.image, 0, 0);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Save raw RGBA data to IndexedDB
const serialized = {
  width: texture.image.width,
  height: texture.image.height,
  data: Array.from(imageData.data),  // Uint8ClampedArray → Array
  // ... other texture properties
};

// Deserialize: Restore as DataTexture
const data = new Uint8Array(serialized.data);
const texture = new THREE.DataTexture(
  data,
  serialized.width,
  serialized.height,
  THREE.RGBAFormat
);
texture.needsUpdate = true;
```

**Result**: Textures persist correctly across browser restarts, no async loading race conditions.

## Additional Fix: Grey Tree Materials

### Symptom
Trees appear grey instead of green after cache load.

### Root Cause

`createDissolveMaterial()` used `instanceof MeshStandardMaterial` which fails for `MeshStandardNodeMaterial` in the WebGPU build:

```typescript
// BROKEN: instanceof fails for NodeMaterial subclasses
if (originalMaterial instanceof MeshStandardMaterial) {
  // ... copy properties
}
```

### Fix

Replace with duck-type property check:

```typescript
// FIXED: Duck-type check works for all material types
if ('roughness' in originalMaterial && 'metalness' in originalMaterial) {
  // ... copy properties
}
```

## Cache Version Bump

Bumped `PROCESSED_CACHE_VERSION` from 2 to 3 to invalidate broken cache entries:

```typescript
const PROCESSED_CACHE_VERSION = 3;
```

All users will automatically rebuild cache on first load after update.

## Debugging Tools

### Disable Cache

```javascript
// In browser console
localStorage.setItem('disable-model-cache', 'true');
// Reload page - cache will be bypassed
```

### Clear Cache

```javascript
// In browser console
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page - cache will rebuild
```

### Inspect Cache

```javascript
// In browser console
const request = indexedDB.open('hyperscape-processed-models', 3);
request.onsuccess = (event) => {
  const db = event.target.result;
  const tx = db.transaction(['models'], 'readonly');
  const store = tx.objectStore('models');
  const getAllRequest = store.getAll();
  
  getAllRequest.onsuccess = () => {
    console.log('Cached models:', getAllRequest.result);
  };
};
```

### Error Logging

Cache errors are now logged to console:

```typescript
// IndexedDB put failures
console.error('[ModelCache] Failed to cache model:', error);

// Transaction failures
console.error('[ModelCache] Transaction failed:', error);
```

## Performance Impact

### Cache Hit (After Fix)
- **Load Time**: ~50ms (IndexedDB read + deserialization)
- **Texture Restoration**: Synchronous (no async loading)
- **Memory**: Same as uncached (DataTexture uses same memory as Image)

### Cache Miss
- **Load Time**: ~500-2000ms (GLTF parse + processing)
- **Texture Loading**: Async (may cause flicker)
- **Memory**: Same (textures loaded either way)

## Migration Guide

### For Users

**No action needed** - cache version bump triggers automatic rebuild.

**If you see missing objects or white textures**:
1. Clear cache: `indexedDB.deleteDatabase('hyperscape-processed-models')`
2. Reload page
3. Cache will rebuild with fixed serialization

### For Developers

**Testing cache serialization**:
```typescript
// Force cache rebuild
localStorage.setItem('disable-model-cache', 'true');
// Load model
// Re-enable cache
localStorage.removeItem('disable-model-cache');
// Reload page - should load from cache correctly
```

**Adding new texture types**:

Ensure texture serialization handles your texture type:

```typescript
// In serializeTexture()
if (texture instanceof THREE.DataTexture) {
  // Already handled
} else if (texture.image instanceof HTMLImageElement) {
  // Extract pixels via canvas
  const canvas = document.createElement('canvas');
  // ... extract imageData
} else {
  console.warn('Unsupported texture type:', texture);
}
```

## Related Issues

### Duplicate Mesh Names

**Common Patterns**:
- Blender exports: "", "Cube", "Cube.001", "Cube.002"
- GLTF defaults: "Mesh_0", "Mesh_1", "Mesh_1" (duplicate)
- Empty names: "", "", ""

**Why It Happens**: Modeling tools don't enforce unique names, GLTF spec doesn't require them.

**Solution**: Identity map (object reference) instead of name-based lookup.

### Blob URL Lifecycle

**Why blob: URLs fail**:
1. Created via `URL.createObjectURL(blob)`
2. Valid only for current page session
3. Revoked on page unload or manual `URL.revokeObjectURL()`
4. Invalid after browser restart

**Solution**: Store raw pixel data, not URLs.

## Testing

### Test Cases

**packages/shared/src/utils/rendering/__tests__/ModelCache.test.ts**:

```typescript
describe('ModelCache', () => {
  it('preserves all objects with duplicate names', async () => {
    // Create model with duplicate mesh names
    const model = createModelWithDuplicateNames();
    
    // Cache and reload
    await cache.set('test', model);
    const loaded = await cache.get('test');
    
    // Verify all objects present
    expect(countMeshes(loaded)).toBe(countMeshes(model));
  });
  
  it('preserves texture colors after restart', async () => {
    // Create model with textured material
    const model = createTexturedModel();
    
    // Cache and reload
    await cache.set('test', model);
    const loaded = await cache.get('test');
    
    // Verify texture data matches
    const originalPixels = extractPixels(model);
    const loadedPixels = extractPixels(loaded);
    expect(loadedPixels).toEqual(originalPixels);
  });
});
```

## References

- [ModelCache.ts](packages/shared/src/utils/rendering/ModelCache.ts) - Implementation
- [Three.js DataTexture](https://threejs.org/docs/#api/en/textures/DataTexture) - Texture API
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Browser storage
