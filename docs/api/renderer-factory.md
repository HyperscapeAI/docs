# RendererFactory API

The `RendererFactory` module provides utilities for creating and configuring WebGPU renderers in Hyperscape.

## Overview

**WebGPU is REQUIRED** - there is no WebGL fallback. All rendering uses Three.js WebGPURenderer with TSL (Three Shading Language) shaders.

## Core Functions

### createRenderer()

Creates a WebGPU renderer with the specified options.

```typescript
async function createRenderer(
  options?: RendererOptions
): Promise<WebGPURenderer>
```

**Parameters**:
- `options.antialias` (boolean, default: `true`) - Enable antialiasing
- `options.alpha` (boolean, default: `false`) - Enable alpha channel
- `options.powerPreference` (string, default: `'high-performance'`) - GPU power preference
- `options.canvas` (HTMLCanvasElement, optional) - Target canvas element

**Returns**: Promise<WebGPURenderer>

**Throws**: Error if WebGPU is unavailable or initialization fails

**Example**:
```typescript
import { createRenderer } from '@hyperscape/shared';

const renderer = await createRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
```

### isWebGPUAvailable()

Checks if WebGPU is available in the current browser.

```typescript
async function isWebGPUAvailable(): Promise<boolean>
```

**Returns**: Promise<boolean> - `true` if WebGPU is supported

**Example**:
```typescript
const hasWebGPU = await isWebGPUAvailable();
if (!hasWebGPU) {
  throw new Error('WebGPU is required but not available');
}
```

### detectRenderingCapabilities()

Detects rendering capabilities and validates WebGPU support.

```typescript
async function detectRenderingCapabilities(): Promise<RenderingCapabilities>
```

**Returns**: Promise<RenderingCapabilities>
```typescript
interface RenderingCapabilities {
  supportsWebGPU: boolean;
  backend: 'webgpu';
}
```

**Throws**: Error if WebGPU is unavailable

**Example**:
```typescript
const capabilities = await detectRenderingCapabilities();
console.log('Backend:', capabilities.backend);  // Always 'webgpu'
```

### configureRenderer()

Configures renderer with common settings.

```typescript
function configureRenderer(
  renderer: WebGPURenderer,
  options: {
    clearColor?: number;
    clearAlpha?: number;
    pixelRatio?: number;
    width?: number;
    height?: number;
    toneMapping?: THREE.ToneMapping;
    toneMappingExposure?: number;
    outputColorSpace?: THREE.ColorSpace;
  }
): void
```

**Example**:
```typescript
configureRenderer(renderer, {
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  outputColorSpace: THREE.SRGBColorSpace
});
```

### configureShadowMaps()

Configures shadow map settings.

```typescript
function configureShadowMaps(
  renderer: WebGPURenderer,
  options?: {
    enabled?: boolean;
    type?: THREE.ShadowMapType;
  }
): void
```

**Example**:
```typescript
configureShadowMaps(renderer, {
  enabled: true,
  type: THREE.PCFSoftShadowMap
});
```

## Utility Functions

### getMaxAnisotropy()

Gets maximum anisotropy supported by the GPU.

```typescript
function getMaxAnisotropy(renderer: WebGPURenderer): number
```

**Returns**: number (typically 16)

### getWebGPUCapabilities()

Gets WebGPU device capabilities for debugging.

```typescript
function getWebGPUCapabilities(renderer: WebGPURenderer): {
  backend: 'webgpu';
  features: string[];
}
```

**Example**:
```typescript
const caps = getWebGPUCapabilities(renderer);
console.log('WebGPU features:', caps.features);
// ['depth-clip-control', 'texture-compression-bc', ...]
```

### logWebGPUInfo()

Logs WebGPU information to console.

```typescript
function logWebGPUInfo(renderer: WebGPURenderer): void
```

### optimizeMaterialForWebGPU()

Optimizes a material for WebGPU rendering.

```typescript
function optimizeMaterialForWebGPU(material: THREE.Material): void
```

**Optimizations**:
- Enables anisotropic filtering (16x) on all textures
- Applies to: map, normalMap, roughnessMap, metalnessMap, emissiveMap

**Example**:
```typescript
const material = new THREE.MeshStandardMaterial({ map: texture });
optimizeMaterialForWebGPU(material);
// texture.anisotropy is now 16
```

## Mesh Utilities

### createOptimizedInstancedMesh()

Creates an optimized instanced mesh.

```typescript
function createOptimizedInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number
): THREE.InstancedMesh
```

**Example**:
```typescript
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial();
const instances = createOptimizedInstancedMesh(geometry, material, 1000);
```

### mergeStaticMeshes()

Merges multiple meshes with the same material into a single mesh.

```typescript
function mergeStaticMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null
```

**Returns**: Merged mesh, or `null` if merging failed

**Example**:
```typescript
const rocks = scene.children.filter(c => c.name.startsWith('rock_'));
const merged = mergeStaticMeshes(rocks);
if (merged) {
  scene.add(merged);
  rocks.forEach(r => r.removeFromParent());
}
```

### groupMeshesByMaterial()

Groups meshes by material UUID for efficient merging.

```typescript
function groupMeshesByMaterial(
  meshes: THREE.Mesh[]
): Map<string, THREE.Mesh[]>
```

**Example**:
```typescript
const allMeshes = scene.children.filter(c => c instanceof THREE.Mesh);
const groups = groupMeshesByMaterial(allMeshes);

for (const [materialId, meshes] of groups) {
  console.log(`Material ${materialId}: ${meshes.length} meshes`);
}
```

### mergeStaticMeshesInGroup()

Merges all static meshes in a scene/group by material.

```typescript
function mergeStaticMeshesInGroup(
  parent: THREE.Object3D,
  minMeshesToMerge?: number
): void
```

**Parameters**:
- `parent` - Parent object containing meshes to merge
- `minMeshesToMerge` (default: 3) - Minimum meshes with same material before merging

**Example**:
```typescript
// Merge all static meshes in the scene
mergeStaticMeshesInGroup(scene, 5);
// Only merges groups with 5+ meshes
```

## Type Definitions

### RendererBackend

```typescript
type RendererBackend = 'webgpu';
```

**Note**: Only `'webgpu'` is supported. WebGL is not available.

### WebGPURenderer

```typescript
type WebGPURenderer = InstanceType<typeof THREE.WebGPURenderer>;
```

### RendererOptions

```typescript
interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
  preserveDrawingBuffer?: boolean;
  canvas?: HTMLCanvasElement;
}
```

### RenderingCapabilities

```typescript
interface RenderingCapabilities {
  supportsWebGPU: boolean;
  backend: RendererBackend;
}
```

## Error Handling

### WebGPU Unavailable

```typescript
try {
  const renderer = await createRenderer();
} catch (error) {
  // Error message includes:
  // - Browser compatibility info
  // - Troubleshooting steps
  // - Links to supported browsers
  console.error(error.message);
}
```

**Error message**:
```
WebGPU is REQUIRED but not available in this browser.

Hyperscape requires WebGPU for rendering. Please use a supported browser:
  - Chrome 113+ (recommended)
  - Edge 113+
  - Safari 18+ (macOS 15+)

If you're using a supported browser, ensure:
  - Hardware acceleration is enabled in browser settings
  - Your GPU drivers are up to date
  - You're not running in a WebView that blocks WebGPU
```

### Initialization Failure

```typescript
try {
  const renderer = await createRenderer();
} catch (error) {
  // Initialization failed after WebGPU was detected
  // Usually indicates GPU driver issues
}
```

**Error message**:
```
Renderer initialization FAILED.

Error: [specific error from GPU]

This usually indicates:
  • GPU drivers need updating
  • Browser GPU backend limitations
  • Hardware/backend doesn't fully support required features

Please try:
  1. Update your browser to the latest version
  2. Update your GPU drivers
  3. Try a different browser (Chrome recommended)
```

## Migration from WebGL

### Removed APIs

The following WebGL-related functions have been **removed**:

- ❌ `isWebGLAvailable()` - No longer needed
- ❌ `isWebGLForced()` - WebGL is not supported
- ❌ `isWebGLFallbackForced()` - No fallback exists
- ❌ `isWebGLFallbackAllowed()` - No fallback exists
- ❌ `isOffscreenCanvasAvailable()` - Not used with WebGPU
- ❌ `canTransferCanvas()` - Not used with WebGPU

### Type Changes

- `UniversalRenderer` → `WebGPURenderer`
- `RendererBackend` is now only `'webgpu'` (was `'webgl' | 'webgpu'`)

### Migration Example

**Before** (WebGL fallback):
```typescript
const renderer = await createRenderer({
  preferWebGPU: true,
  allowWebGLFallback: true
});

if (isWebGLRenderer(renderer)) {
  console.log('Using WebGL fallback');
}
```

**After** (WebGPU only):
```typescript
const renderer = await createRenderer();
// Always WebGPU - no fallback
// Throws error if WebGPU unavailable
```

## Best Practices

### Renderer Initialization

✅ **Good**:
```typescript
async function initRenderer() {
  try {
    const renderer = await createRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    configureRenderer(renderer, {
      pixelRatio: window.devicePixelRatio,
      width: window.innerWidth,
      height: window.innerHeight
    });
    
    return renderer;
  } catch (error) {
    // Show user-friendly error message
    showWebGPUError(error.message);
    throw error;
  }
}
```

❌ **Bad**:
```typescript
// Don't try to create WebGL fallback
const renderer = await createRenderer().catch(() => {
  return new THREE.WebGLRenderer();  // This won't work!
});
```

### Material Optimization

✅ **Good**:
```typescript
const material = new THREE.MeshStandardMaterial({ map: texture });
optimizeMaterialForWebGPU(material);  // Enable anisotropic filtering
```

❌ **Bad**:
```typescript
// Don't manually set anisotropy on every texture
texture.anisotropy = 16;  // Use optimizeMaterialForWebGPU instead
```

### Mesh Merging

✅ **Good**:
```typescript
// Merge static geometry to reduce draw calls
mergeStaticMeshesInGroup(scene, 3);
```

❌ **Bad**:
```typescript
// Don't merge dynamic/animated meshes
mergeStaticMeshesInGroup(animatedCharacters);  // Will break animations
```

## Performance Tips

### 1. Use Instancing for Repeated Geometry

```typescript
// Instead of 1000 separate meshes
for (let i = 0; i < 1000; i++) {
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}

// Use instanced mesh (1 draw call)
const instances = createOptimizedInstancedMesh(geometry, material, 1000);
scene.add(instances);
```

### 2. Merge Static Meshes

```typescript
// Merge all static environment meshes
const staticMeshes = scene.children.filter(c => 
  c instanceof THREE.Mesh && c.userData.static === true
);
const merged = mergeStaticMeshes(staticMeshes);
```

### 3. Enable Frustum Culling

```typescript
mesh.frustumCulled = true;  // Default for optimized meshes
```

### 4. Optimize Materials

```typescript
// Apply to all materials in scene
scene.traverse(obj => {
  if (obj instanceof THREE.Mesh) {
    optimizeMaterialForWebGPU(obj.material);
  }
});
```

## References

- **Source**: `packages/shared/src/utils/rendering/RendererFactory.ts`
- **Tests**: `packages/shared/src/utils/rendering/__tests__/RendererFactory.test.ts`
- **WebGPU Docs**: [WebGPU Fundamentals](https://webgpufundamentals.org/)
- **Three.js WebGPU**: [Three.js WebGPU Examples](https://threejs.org/examples/?q=webgpu)
