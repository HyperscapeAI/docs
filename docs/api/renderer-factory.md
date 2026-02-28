# RendererFactory API Reference

Factory for creating WebGPU renderers in Hyperscape.

## Overview

`RendererFactory` provides utilities for creating and configuring WebGPU renderers. **WebGPU is REQUIRED** - there is no WebGL fallback.

**Location:** `packages/shared/src/utils/rendering/RendererFactory.ts`

## Breaking Changes

### v0.2.0 (February 2026)

**WebGL support removed** - WebGPU is now required.

**Removed:**
- `isWebGLAvailable()` - No longer needed
- `isWebGLForced()` - WebGL forcing removed
- `isWebGLFallbackAllowed()` - No fallback path
- `UniversalRenderer` type - Now just `WebGPURenderer`
- `forceWebGL` parameter - Ignored if present

**Migration:**
```typescript
// Before (v0.1.x)
const renderer = await createRenderer({ forceWebGL: false });
if (isWebGLRenderer(renderer)) {
  // Handle WebGL
} else {
  // Handle WebGPU
}

// After (v0.2.0)
const renderer = await createRenderer();
// Always WebGPU, no type checking needed
```

## Types

### RendererBackend

```typescript
type RendererBackend = "webgpu";
```

Only WebGPU is supported.

### WebGPURenderer

```typescript
type WebGPURenderer = InstanceType<typeof THREE.WebGPURenderer>;
```

The renderer type used across the app.

### RendererOptions

```typescript
interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: "high-performance" | "low-power" | "default";
  preserveDrawingBuffer?: boolean;
  canvas?: HTMLCanvasElement;
}
```

**Properties:**
- `antialias` - Enable MSAA (default: true)
- `alpha` - Enable alpha channel (default: false)
- `powerPreference` - GPU power preference (default: "high-performance")
- `preserveDrawingBuffer` - Preserve buffer for screenshots (default: false)
- `canvas` - Existing canvas element (optional)

### RenderingCapabilities

```typescript
interface RenderingCapabilities {
  supportsWebGPU: boolean;
  backend: RendererBackend;
}
```

**Properties:**
- `supportsWebGPU` - Always true (throws if false)
- `backend` - Always "webgpu"

## Functions

### isWebGPUAvailable()

Check if WebGPU is available in the current browser.

```typescript
async function isWebGPUAvailable(): Promise<boolean>
```

**Returns:** `Promise<boolean>` - True if WebGPU is available

**Example:**
```typescript
const available = await isWebGPUAvailable();
if (!available) {
  alert('WebGPU not supported. Please use Chrome 113+');
}
```

### detectRenderingCapabilities()

Detect rendering capabilities.

```typescript
async function detectRenderingCapabilities(): Promise<RenderingCapabilities>
```

**Returns:** `Promise<RenderingCapabilities>` - Capabilities object

**Throws:** `Error` if WebGPU is unavailable

**Example:**
```typescript
try {
  const caps = await detectRenderingCapabilities();
  console.log('Backend:', caps.backend);  // "webgpu"
} catch (error) {
  console.error('WebGPU not available:', error.message);
}
```

### createRenderer()

Create a WebGPU renderer.

```typescript
async function createRenderer(
  options?: RendererOptions
): Promise<WebGPURenderer>
```

**Parameters:**
- `options` - Renderer options (optional)

**Returns:** `Promise<WebGPURenderer>` - Initialized WebGPU renderer

**Throws:** `Error` if WebGPU is unavailable or initialization fails

**Example:**
```typescript
const renderer = await createRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});

await renderer.init();
```

**Extended Limits:**

The renderer attempts to request extended texture array layers (2048) for animated impostor atlases. If the GPU doesn't support this, it falls back to default limits.

```typescript
// First attempt: Extended limits
renderer = new THREE.WebGPURenderer({
  requiredLimits: {
    maxTextureArrayLayers: 2048,
  },
});

// Fallback: Default limits
if (init fails) {
  renderer = new THREE.WebGPURenderer(baseOptions);
}
```

### configureRenderer()

Configure renderer with common settings.

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

**Parameters:**
- `renderer` - WebGPU renderer
- `options` - Configuration options

**Example:**
```typescript
configureRenderer(renderer, {
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  outputColorSpace: THREE.SRGBColorSpace,
});
```

### configureShadowMaps()

Configure shadow maps.

```typescript
function configureShadowMaps(
  renderer: WebGPURenderer,
  options?: {
    enabled?: boolean;
    type?: THREE.ShadowMapType;
  }
): void
```

**Parameters:**
- `renderer` - WebGPU renderer
- `options` - Shadow map options

**Example:**
```typescript
configureShadowMaps(renderer, {
  enabled: true,
  type: THREE.PCFSoftShadowMap,
});
```

### getMaxAnisotropy()

Get maximum anisotropy from renderer.

```typescript
function getMaxAnisotropy(renderer: WebGPURenderer): number
```

**Returns:** `number` - Max anisotropy (typically 16)

**Example:**
```typescript
const maxAniso = getMaxAnisotropy(renderer);
texture.anisotropy = maxAniso;
```

### getWebGPUCapabilities()

Get WebGPU capabilities for logging and debugging.

```typescript
function getWebGPUCapabilities(renderer: WebGPURenderer): {
  backend: RendererBackend;
  features: string[];
}
```

**Returns:** Object with backend and feature list

**Example:**
```typescript
const caps = getWebGPUCapabilities(renderer);
console.log('Backend:', caps.backend);
console.log('Features:', caps.features);
// Features: ['depth-clip-control', 'texture-compression-bc', ...]
```

### logWebGPUInfo()

Log WebGPU info for debugging.

```typescript
function logWebGPUInfo(renderer: WebGPURenderer): void
```

**Example:**
```typescript
logWebGPUInfo(renderer);
// [RendererFactory] WebGPU initialized { features: 42 }
```

### optimizeMaterialForWebGPU()

Optimize materials for WebGPU rendering.

```typescript
function optimizeMaterialForWebGPU(material: THREE.Material): void
```

**Optimizations:**
- Sets anisotropy to 16 on all textures
- Enables texture filtering

**Example:**
```typescript
const material = new THREE.MeshStandardMaterial({ map: texture });
optimizeMaterialForWebGPU(material);
// texture.anisotropy now 16
```

### Mesh Utilities

#### createOptimizedInstancedMesh()

Create optimized instanced mesh.

```typescript
function createOptimizedInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number
): THREE.InstancedMesh
```

**Example:**
```typescript
const mesh = createOptimizedInstancedMesh(geometry, material, 1000);
mesh.frustumCulled = true;  // Auto-enabled
```

#### mergeStaticMeshes()

Merge multiple meshes with same material into single mesh.

```typescript
function mergeStaticMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null
```

**Returns:** Merged mesh or null if merging failed

**Example:**
```typescript
const rocks = scene.children.filter(c => c.name.startsWith('rock'));
const merged = mergeStaticMeshes(rocks);

if (merged) {
  scene.add(merged);
  rocks.forEach(r => scene.remove(r));
}
```

#### groupMeshesByMaterial()

Group meshes by material for efficient merging.

```typescript
function groupMeshesByMaterial(
  meshes: THREE.Mesh[]
): Map<string, THREE.Mesh[]>
```

**Returns:** Map of material UUID to mesh array

**Example:**
```typescript
const groups = groupMeshesByMaterial(allMeshes);

for (const [materialId, meshes] of groups) {
  console.log(`Material ${materialId}: ${meshes.length} meshes`);
}
```

#### mergeStaticMeshesInGroup()

Merge all static meshes in a scene/group by material.

```typescript
function mergeStaticMeshesInGroup(
  parent: THREE.Object3D,
  minMeshesToMerge?: number
): void
```

**Parameters:**
- `parent` - Parent object containing meshes
- `minMeshesToMerge` - Minimum meshes before merging (default: 3)

**Example:**
```typescript
// Merge all static meshes in scene
mergeStaticMeshesInGroup(scene, 3);
// Meshes with same material (3+) are merged
```

## Error Handling

### WebGPU Not Available

```typescript
try {
  const renderer = await createRenderer();
} catch (error) {
  // Error message includes:
  // - Browser requirements (Chrome 113+, etc.)
  // - Hardware acceleration check
  // - GPU driver update instructions
  console.error(error.message);
}
```

### Initialization Failed

```typescript
try {
  const renderer = await createRenderer();
  await renderer.init();
} catch (error) {
  // Error message includes:
  // - GPU driver update instructions
  // - Browser version check
  // - Hardware/backend limitations
  console.error(error.message);
}
```

### Backend Mismatch

```typescript
const backend = getRendererBackend(renderer);
if (backend !== 'webgpu') {
  throw new Error('Expected WebGPU but got ' + backend);
}
```

This should never happen - if it does, it indicates a browser/driver issue.

## Usage Examples

### Basic Setup

```typescript
import { createRenderer, configureRenderer } from '@hyperscape/shared';

// Create renderer
const renderer = await createRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});

// Configure
configureRenderer(renderer, {
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight,
  toneMapping: THREE.ACESFilmicToneMapping,
});

// Add to DOM
document.body.appendChild(renderer.domElement);
```

### With Shadow Maps

```typescript
const renderer = await createRenderer();

configureShadowMaps(renderer, {
  enabled: true,
  type: THREE.PCFSoftShadowMap,
});
```

### With Custom Canvas

```typescript
const canvas = document.getElementById('game-canvas');

const renderer = await createRenderer({
  canvas: canvas as HTMLCanvasElement,
  antialias: true,
});
```

### Capability Detection

```typescript
// Check WebGPU availability before creating app
const available = await isWebGPUAvailable();

if (!available) {
  showErrorMessage('WebGPU not supported. Please use Chrome 113+');
  return;
}

// Create renderer
const renderer = await createRenderer();

// Log capabilities
const caps = getWebGPUCapabilities(renderer);
console.log('WebGPU features:', caps.features);
```

### Material Optimization

```typescript
// Load model
const { scene } = await loadModel('model.glb');

// Optimize all materials
scene.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    optimizeMaterialForWebGPU(child.material);
  }
});
```

### Mesh Merging

```typescript
// Load multiple static objects
const trees = await loadTrees();

// Group by material
const groups = groupMeshesByMaterial(trees);

// Merge each group
for (const [materialId, meshes] of groups) {
  if (meshes.length >= 3) {
    const merged = mergeStaticMeshes(meshes);
    if (merged) {
      scene.add(merged);
      meshes.forEach(m => scene.remove(m));
    }
  }
}
```

## Performance Tips

1. **Use high-performance power preference** - Ensures GPU is used
2. **Enable frustum culling** - Automatically enabled on InstancedMesh
3. **Optimize materials** - Call `optimizeMaterialForWebGPU()` on all materials
4. **Merge static meshes** - Reduces draw calls for static geometry
5. **Use instanced rendering** - For repeated geometry (trees, rocks, etc.)

## Browser Compatibility

### Supported Browsers

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 113+ | Recommended, best performance |
| Edge | 113+ | Chromium-based, same as Chrome |
| Safari | 18+ | Requires macOS 15+ |
| Firefox | 121+ | Behind flag, not recommended |

### Checking Compatibility

```typescript
const available = await isWebGPUAvailable();

if (!available) {
  // Show browser upgrade message
  const message = `
    WebGPU is required but not available.
    
    Please use a supported browser:
    - Chrome 113+ (recommended)
    - Edge 113+
    - Safari 18+ (macOS 15+)
    
    Check your browser: https://webgpureport.org
  `;
  alert(message);
}
```

### Feature Detection

```typescript
const caps = getWebGPUCapabilities(renderer);

// Check for specific features
if (caps.features.includes('texture-compression-bc')) {
  // Use BC texture compression
}

if (caps.features.includes('depth-clip-control')) {
  // Use depth clip control
}
```

## Troubleshooting

### "WebGPU is REQUIRED but not available"

**Causes:**
- Browser too old (need Chrome 113+)
- Hardware acceleration disabled
- GPU drivers outdated
- Running in WebView that blocks WebGPU

**Solutions:**
1. Update browser to latest version
2. Enable hardware acceleration in browser settings
3. Update GPU drivers
4. Check [webgpureport.org](https://webgpureport.org) for compatibility

### "Renderer initialization FAILED"

**Causes:**
- GPU drivers need updating
- Browser GPU backend limitations
- Hardware doesn't support required features

**Solutions:**
1. Update GPU drivers
2. Try different browser (Chrome recommended)
3. Check GPU compatibility at [webgpureport.org](https://webgpureport.org)

### "Expected WebGPU backend but got..."

This should never happen. If it does:
1. Check browser version
2. Verify WebGPU is enabled (not disabled via flags)
3. Check for browser extensions that might interfere

## Testing

### Unit Tests

```typescript
import { createRenderer, isWebGPUAvailable } from './RendererFactory';

test('WebGPU is available', async () => {
  const available = await isWebGPUAvailable();
  expect(available).toBe(true);
});

test('creates WebGPU renderer', async () => {
  const renderer = await createRenderer();
  expect(renderer).toBeInstanceOf(THREE.WebGPURenderer);
});

test('configures renderer correctly', async () => {
  const renderer = await createRenderer();
  
  configureRenderer(renderer, {
    pixelRatio: 2,
    width: 1920,
    height: 1080,
  });
  
  expect(renderer.getPixelRatio()).toBe(2);
  expect(renderer.getSize(new THREE.Vector2())).toEqual({ x: 1920, y: 1080 });
});
```

### Integration Tests

```typescript
test('renderer works with scene', async () => {
  const renderer = await createRenderer();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  
  // Add test geometry
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  
  // Render
  await renderer.renderAsync(scene, camera);
  
  // Verify render info
  expect(renderer.info.render.calls).toBeGreaterThan(0);
});
```

## Migration Guide

### From WebGL/Universal Renderer

**Before (v0.1.x):**
```typescript
import { createRenderer, isWebGLRenderer } from './RendererFactory';

const renderer = await createRenderer({ forceWebGL: false });

if (isWebGLRenderer(renderer)) {
  // WebGL-specific code
  renderer.setPixelRatio(window.devicePixelRatio);
} else {
  // WebGPU-specific code
  await renderer.init();
}
```

**After (v0.2.0):**
```typescript
import { createRenderer } from './RendererFactory';

const renderer = await createRenderer();
// Always WebGPU, no type checking needed
// renderer.init() called automatically by createRenderer
```

### Removing WebGL Fallbacks

**Before:**
```typescript
// Check if WebGL is forced
if (isWebGLForced()) {
  // Use WebGL renderer
} else {
  // Use WebGPU renderer
}
```

**After:**
```typescript
// Always WebGPU
const renderer = await createRenderer();
```

### Updating Material Code

**Before:**
```typescript
// Different materials for WebGL vs WebGPU
const material = isWebGLRenderer(renderer)
  ? new THREE.MeshStandardMaterial()
  : new MeshStandardNodeMaterial();
```

**After:**
```typescript
// Always use TSL node materials
import { MeshStandardNodeMaterial } from 'three/webgpu';

const material = new MeshStandardNodeMaterial();
```

## References

- [RendererFactory.ts](../../packages/shared/src/utils/rendering/RendererFactory.ts) - Source code
- [Three.js WebGPU Docs](https://threejs.org/docs/#api/en/renderers/WebGPURenderer) - Three.js documentation
- [WebGPU Spec](https://gpuweb.github.io/gpuweb/) - WebGPU specification
- [webgpureport.org](https://webgpureport.org) - Browser compatibility checker
