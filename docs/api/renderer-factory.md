# RendererFactory API Reference

WebGPU renderer creation and configuration for Hyperscape.

## Overview

The `RendererFactory` module provides utilities for creating and configuring WebGPU renderers. **WebGPU is REQUIRED** - there is no WebGL fallback.

## Breaking Changes (v0.180.0)

### WebGPU-Only Enforcement

**BREAKING:** WebGL support has been completely removed. All fallback code and detection logic has been eliminated.

**Removed APIs:**
- `isWebGLAvailable()` - No longer exists
- `isWebGLForced()` - No longer exists
- `isWebGLFallbackForced()` - No longer exists
- `isWebGLFallbackAllowed()` - No longer exists
- `isOffscreenCanvasAvailable()` - No longer exists
- `canTransferCanvas()` - No longer exists
- `UniversalRenderer` type - Use `WebGPURenderer` instead

**Migration:**
```typescript
// Before
import { UniversalRenderer } from './RendererFactory';
const renderer: UniversalRenderer = await createRenderer();

// After
import { WebGPURenderer } from './RendererFactory';
const renderer: WebGPURenderer = await createRenderer();
```

## Types

### WebGPURenderer

```typescript
export type WebGPURenderer = InstanceType<typeof THREE.WebGPURenderer>;
```

The only supported renderer type. All materials use TSL (Three Shading Language) which requires WebGPU.

### RendererBackend

```typescript
export type RendererBackend = "webgpu";
```

Only `"webgpu"` is supported. This type exists for future extensibility.

### RendererOptions

```typescript
export interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: "high-performance" | "low-power" | "default";
  preserveDrawingBuffer?: boolean;
  canvas?: HTMLCanvasElement;
}
```

Configuration options for renderer creation.

### RenderingCapabilities

```typescript
export interface RenderingCapabilities {
  supportsWebGPU: boolean;
  backend: RendererBackend;
}
```

Detected rendering capabilities. `supportsWebGPU` will always be `true` if detection succeeds (otherwise throws).

## Functions

### isWebGPUAvailable

```typescript
async function isWebGPUAvailable(): Promise<boolean>
```

Check if WebGPU is available in the current browser.

**Returns:** `true` if WebGPU is supported, `false` otherwise.

**Example:**
```typescript
const hasWebGPU = await isWebGPUAvailable();
if (!hasWebGPU) {
  throw new Error('WebGPU required');
}
```

### detectRenderingCapabilities

```typescript
async function detectRenderingCapabilities(): Promise<RenderingCapabilities>
```

Detect rendering capabilities.

**Returns:** Capabilities object with `supportsWebGPU` and `backend`.

**Throws:** Error if WebGPU is unavailable.

**Example:**
```typescript
try {
  const caps = await detectRenderingCapabilities();
  console.log('Backend:', caps.backend); // "webgpu"
} catch (err) {
  console.error('WebGPU not supported:', err);
}
```

### createRenderer

```typescript
async function createRenderer(options?: RendererOptions): Promise<WebGPURenderer>
```

Create a WebGPU renderer.

**Parameters:**
- `options` - Optional renderer configuration

**Returns:** Initialized WebGPU renderer.

**Throws:** Error if WebGPU is unavailable or initialization fails.

**Example:**
```typescript
const renderer = await createRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  canvas: document.getElementById('canvas')
});
```

**Extended Limits:**

The renderer attempts to request extended texture array layers (2048) for animated impostor atlases. If the GPU doesn't support this, it falls back to default limits.

```typescript
// First attempt: extended limits
requiredLimits: {
  maxTextureArrayLayers: 2048
}

// Fallback: default limits (no requiredLimits)
```

### configureRenderer

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

Configure renderer with common settings.

**Example:**
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

### configureShadowMaps

```typescript
function configureShadowMaps(
  renderer: WebGPURenderer,
  options?: {
    enabled?: boolean;
    type?: THREE.ShadowMapType;
  }
): void
```

Configure shadow maps.

**Example:**
```typescript
configureShadowMaps(renderer, {
  enabled: true,
  type: THREE.PCFSoftShadowMap
});
```

### isWebGPURenderer

```typescript
function isWebGPURenderer(renderer: WebGPURenderer): renderer is WebGPURenderer
```

Type guard to check if renderer is WebGPU. Always returns `true` since WebGPU is the only supported backend.

**Example:**
```typescript
if (isWebGPURenderer(renderer)) {
  // Always true
  console.log('Using WebGPU');
}
```

### getRendererBackend

```typescript
function getRendererBackend(renderer: WebGPURenderer): RendererBackend
```

Get renderer backend type. Always returns `"webgpu"`.

**Example:**
```typescript
const backend = getRendererBackend(renderer);
console.log(backend); // "webgpu"
```

### getMaxAnisotropy

```typescript
function getMaxAnisotropy(renderer: WebGPURenderer): number
```

Get maximum anisotropic filtering level supported by the GPU.

**Returns:** Max anisotropy (typically 16).

**Example:**
```typescript
const maxAniso = getMaxAnisotropy(renderer);
texture.anisotropy = maxAniso;
```

### getWebGPUCapabilities

```typescript
function getWebGPUCapabilities(renderer: WebGPURenderer): {
  backend: RendererBackend;
  features: string[];
}
```

Get WebGPU capabilities for logging and debugging.

**Returns:** Object with backend type and array of supported features.

**Example:**
```typescript
const caps = getWebGPUCapabilities(renderer);
console.log('Backend:', caps.backend);
console.log('Features:', caps.features);
// Features: ['depth-clip-control', 'texture-compression-bc', ...]
```

### logWebGPUInfo

```typescript
function logWebGPUInfo(renderer: WebGPURenderer): void
```

Log WebGPU info for debugging.

**Example:**
```typescript
logWebGPUInfo(renderer);
// [RendererFactory] WebGPU initialized { features: 42 }
```

### optimizeMaterialForWebGPU

```typescript
function optimizeMaterialForWebGPU(material: THREE.Material): void
```

Optimize materials for WebGPU rendering. Enables anisotropic filtering on all textures.

**Example:**
```typescript
const material = new THREE.MeshStandardMaterial({ map: texture });
optimizeMaterialForWebGPU(material);
// texture.anisotropy = 16
```

### createOptimizedInstancedMesh

```typescript
function createOptimizedInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number
): THREE.InstancedMesh
```

Create optimized instanced mesh with frustum culling enabled.

**Example:**
```typescript
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial();
const mesh = createOptimizedInstancedMesh(geometry, material, 1000);
scene.add(mesh);
```

### mergeStaticMeshes

```typescript
function mergeStaticMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null
```

Merge multiple meshes with the same material into a single mesh. Reduces draw calls for static geometry.

**Parameters:**
- `meshes` - Array of meshes to merge (must share same material)

**Returns:** Single merged mesh, or `null` if merging failed.

**Example:**
```typescript
const trees = scene.children.filter(obj => obj.name.startsWith('tree'));
const merged = mergeStaticMeshes(trees);
if (merged) {
  scene.add(merged);
  trees.forEach(tree => tree.removeFromParent());
}
```

### groupMeshesByMaterial

```typescript
function groupMeshesByMaterial(meshes: THREE.Mesh[]): Map<string, THREE.Mesh[]>
```

Group meshes by material for efficient merging.

**Returns:** Map of material UUID to array of meshes using that material.

**Example:**
```typescript
const allMeshes = scene.children.filter(obj => obj instanceof THREE.Mesh);
const groups = groupMeshesByMaterial(allMeshes);

for (const [materialUuid, meshes] of groups) {
  console.log(`Material ${materialUuid}: ${meshes.length} meshes`);
}
```

### mergeStaticMeshesInGroup

```typescript
function mergeStaticMeshesInGroup(
  parent: THREE.Object3D,
  minMeshesToMerge = 3
): void
```

Merge all static meshes in a scene/group by material. Replaces original meshes with merged versions.

**Parameters:**
- `parent` - The parent object containing meshes to merge
- `minMeshesToMerge` - Minimum meshes with same material before merging (default: 3)

**Example:**
```typescript
// Merge all static meshes in scene
mergeStaticMeshesInGroup(scene, 3);

// Result: Meshes with same material are merged
// - 100 tree meshes → 5 merged meshes (by material)
// - 50 rock meshes → 2 merged meshes (by material)
```

## Error Handling

### WebGPU Unavailable

```typescript
try {
  const renderer = await createRenderer();
} catch (err) {
  // Error message includes:
  // - Browser compatibility info
  // - Hardware acceleration check
  // - GPU driver update instructions
  console.error(err.message);
}
```

**Error message example:**
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

### Initialization Failed

```typescript
try {
  const renderer = await createRenderer();
} catch (err) {
  // Error message includes:
  // - Specific initialization error
  // - Common causes
  // - Troubleshooting steps
  console.error(err.message);
}
```

**Error message example:**
```
Renderer initialization FAILED.

Error: Failed to create GPUDevice

This usually indicates:
  • GPU drivers need updating
  • Browser GPU backend limitations
  • Hardware/backend doesn't fully support required features

Please try:
  1. Update your browser to the latest version
  2. Update your GPU drivers
  3. Try a different browser (Chrome recommended)
```

## Browser Compatibility

### Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 113+ | Recommended, best performance |
| Edge | 113+ | Chromium-based, same as Chrome |
| Safari | 18+ (macOS 15+) | Requires macOS Sequoia |
| Firefox | 121+ | Behind flag, not recommended |

### Checking WebGPU Support

**In browser console:**
```javascript
if ('gpu' in navigator) {
  const adapter = await navigator.gpu.requestAdapter();
  console.log('WebGPU supported:', adapter !== null);
} else {
  console.log('WebGPU not supported');
}
```

**Online checker:**
- [webgpureport.org](https://webgpureport.org)

### Enabling WebGPU

**Chrome/Edge:**
- WebGPU enabled by default in 113+
- Check: `chrome://gpu` → "WebGPU" should show "Hardware accelerated"

**Safari:**
- Requires macOS 15+ (Sequoia)
- Enabled by default in Safari 18+
- Check: Develop → Experimental Features → "WebGPU" (should be checked)

**Firefox:**
- Not recommended (behind flag)
- Enable: `about:config` → `dom.webgpu.enabled` → `true`

## Server-Side Rendering (Vast.ai)

### Requirements

- NVIDIA GPU with Vulkan support
- Xorg or Xvfb display server
- Chrome Dev channel (google-chrome-unstable)
- ANGLE/Vulkan backend

### Configuration

```bash
# Display server
DISPLAY=:99

# GPU rendering mode
GPU_RENDERING_MODE=xorg  # or xvfb-vulkan

# Vulkan ICD
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Chrome configuration
STREAM_CAPTURE_CHANNEL=chrome-dev
STREAM_CAPTURE_ANGLE=vulkan
STREAM_CAPTURE_HEADLESS=false  # Must be false for WebGPU
```

### Validation

The deploy script validates WebGPU availability:

```bash
# Check GPU
nvidia-smi || exit 1

# Check Vulkan
vulkaninfo --summary || echo "WARNING"

# Check display
xdpyinfo -display $DISPLAY || exit 1
```

## Performance Optimization

### Texture Array Limits

The renderer requests extended texture array layers for animated impostor atlases:

```typescript
// Attempt extended limits
requiredLimits: {
  maxTextureArrayLayers: 2048
}

// Fallback to default if GPU doesn't support
```

**Why:** Animated impostor system needs >256 layers for mob atlases.

### Anisotropic Filtering

Enable on all textures for better quality:

```typescript
const maxAniso = getMaxAnisotropy(renderer);
texture.anisotropy = maxAniso; // Typically 16
```

### Instanced Rendering

Use `createOptimizedInstancedMesh` for repeated geometry:

```typescript
const mesh = createOptimizedInstancedMesh(geometry, material, 1000);
// Renders 1000 instances in 1 draw call
```

### Static Mesh Merging

Merge static meshes to reduce draw calls:

```typescript
mergeStaticMeshesInGroup(scene, 3);
// Merges meshes with same material (minimum 3 per group)
```

## Related Documentation

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Three.js WebGPU Renderer](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [TSL (Three Shading Language)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [Instanced Rendering](./instanced-rendering.md)
- [Vast.ai Streaming](./vast-ai-streaming.md)
