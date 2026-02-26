# Model Cache Fixes (February 2026)

## Overview

Fixed two critical bugs in the IndexedDB processed model cache that caused missing objects and lost textures after browser restart.

## Bug #1: Missing Objects (Duplicate Mesh Names)

### Problem
Models with duplicate mesh names (common: `""`, `"Cube"`, `"Cube"`) had objects disappear after cache reload. For example, altars and other multi-mesh models would only show one component.

### Root Cause
`serializeNode()` used `findIndex` by name to map hierarchy nodes to mesh data:

```typescript
// OLD (BROKEN)
meshIndex = meshes.findIndex((m) => m.name === node.name);
```

When multiple meshes shared the same name, they all resolved to the **same index**. During deserialization, Three.js `add()` auto-removes objects from their previous parent, so only the last reference survived in the scene graph.

### Fix
Use a `Map<Object3D, number>` identity map built during traversal:

```typescript
// NEW (FIXED)
const meshNodeToIndex = new Map<THREE.Object3D, number>();

scene.traverse((node) => {
  if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
    meshNodeToIndex.set(node, meshes.length);
    meshes.push(serializeMesh(node));
  }
});

// Later in serializeNode:
meshIndex = meshNodeToIndex.get(node);
```

This ensures each mesh gets a unique index regardless of name collisions.

## Bug #2: Lost Textures (Blob URL Serialization)

### Problem
Textures appeared white or wrong colors after browser restart. The cache was storing ephemeral `blob:` URLs that became invalid after page reload.

### Root Cause
Textures were serialized as URLs:

```typescript
// OLD (BROKEN)
const mapSrc = (m.map as TexWithSrc)?.source?.data?.src;
if (mapSrc) props.mapUrl = mapSrc;
```

Blob URLs like `blob:http://localhost:3333/abc-123` are only valid for the current page session. After restart, these URLs pointed to nothing.

### Fix
Extract raw RGBA pixel data via canvas and store as `ArrayBuffer`:

```typescript
// NEW (FIXED)
private textureToPixelData(texture: THREE.Texture): SerializedTextureData | null {
  const image = texture.source?.data ?? texture.image;
  if (!image) return null;

  const w = (image as HTMLImageElement).naturalWidth || 
            (image as ImageBitmap).width || 0;
  const h = (image as HTMLImageElement).naturalHeight || 
            (image as ImageBitmap).height || 0;
  if (w === 0 || h === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  
  return { 
    pixels: imageData.data.buffer, 
    width: w, 
    height: h 
  };
}
```

On deserialization, restore as `THREE.DataTexture`:

```typescript
const restoreTex = (td: SerializedTextureData, srgb: boolean): THREE.DataTexture => {
  const tex = new THREE.DataTexture(
    new Uint8ClampedArray(td.pixels),
    td.width,
    td.height,
    THREE.RGBAFormat,
  );
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

if (props.mapData) mat.map = restoreTex(props.mapData, true);
if (props.normalMapData) mat.normalMap = restoreTex(props.normalMapData, false);
```

**Benefits**:
- Synchronous texture restoration (no async loading race conditions)
- Textures persist across browser restarts
- No dependency on external blob URLs

## Bug #3: Grey Tree Materials (WebGPU Build)

### Problem
Trees appeared grey in WebGPU builds after cache reload.

### Root Cause
`createDissolveMaterial()` used `instanceof MeshStandardMaterial` which fails for `MeshStandardNodeMaterial` in WebGPU builds (separate class hierarchy):

```typescript
// OLD (BROKEN)
if (source instanceof THREE.MeshStandardMaterial) {
  material.color.copy(source.color);
  // ...
}
```

### Fix
Duck-type property check instead of instanceof:

```typescript
// NEW (FIXED)
const src = source as THREE.MeshStandardMaterial & {
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  // ...
};

if (src.color && src.roughness !== undefined) {
  material.color.copy(src.color);
  material.roughness = src.roughness;
  // ...
}
```

## Cache Version Bump

Cache version incremented from `2` to `3` to invalidate broken entries:

```typescript
const PROCESSED_CACHE_VERSION = 3;
```

All users will automatically rebuild their cache on first load after this update.

## Debugging

### Disable Cache for Testing

Add to localStorage in browser console:

```javascript
localStorage.setItem('disable-model-cache', 'true');
```

Reload the page. Models will load fresh from GLB files, bypassing the cache.

### Verify Cache Contents

```javascript
// Open IndexedDB in DevTools → Application → IndexedDB
// Database: hyperscape-processed-models
// Store: models
// Check that entries have:
//   - meshes[].material.mapData (not mapUrl)
//   - meshes[].material.mapData.pixels (ArrayBuffer)
```

### Error Logging

The cache now logs IndexedDB errors:

```typescript
putReq.onerror = () =>
  console.warn(`[ModelCache] IndexedDB put failed for ${url}:`, putReq.error);
tx.onerror = () =>
  console.warn(`[ModelCache] IndexedDB tx failed for ${url}:`, tx.error);
```

Check browser console for cache write failures.

## Performance Impact

### Cache Size
- **Before**: ~2-5 MB per model (URLs only)
- **After**: ~10-20 MB per model (includes pixel data)
- **Trade-off**: Larger cache, but eliminates texture loading on restart

### Load Time
- **Before**: Fast cache read, slow texture reload from network
- **After**: Slightly slower cache read (more data), instant texture availability
- **Net result**: Faster overall load time (no network requests)

## Related Files

- `packages/shared/src/utils/rendering/ModelCache.ts` - Main cache implementation
- `packages/shared/src/systems/shared/world/GPUVegetation.ts` - Dissolve material fix

## References

- PR #935: [fix: processed model cache - missing objects and lost textures](https://github.com/HyperscapeAI/hyperscape/pull/935)
- Commit c98f1cc: Model cache fixes implementation
