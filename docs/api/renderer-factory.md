# RendererFactory API Reference

The `RendererFactory` provides a centralized API for creating and managing Three.js WebGPU renderers in Hyperscape.

**Location**: `packages/shared/src/utils/rendering/RendererFactory.ts`

## Overview

As of commit `47782ed` (2026-02-27), Hyperscape **only supports WebGPU**. All WebGL fallback code has been removed.

### Breaking Changes

- `UniversalRenderer` type removed (always `WebGPURenderer`)
- `RendererBackend` type now only accepts `"webgpu"`
- All WebGL detection methods removed
- WebGL fallback flags ignored

## API

### createRenderer

Creates a WebGPU renderer instance.

```typescript
static createRenderer(
  canvas: HTMLCanvasElement,
  options?: {
    antialias?: boolean;
    alpha?: boolean;
    powerPreference?: 'high-performance' | 'low-power' | 'default';
  }
): WebGPURenderer
```

**Parameters**:
- `canvas` - HTMLCanvasElement to render to
- `options` - Optional renderer configuration
  - `antialias` - Enable antialiasing (default: `true`)
  - `alpha` - Enable alpha channel (default: `false`)
  - `powerPreference` - GPU power preference (default: `'high-performance'`)

**Returns**: `WebGPURenderer` instance

**Throws**: Error if WebGPU is not available

**Example**:

```typescript
import { RendererFactory } from '@hyperscape/shared';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = RendererFactory.createRenderer(canvas, {
  antialias: true,
  powerPreference: 'high-performance',
});

// Renderer is always WebGPURenderer
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
```

### getBackend

Returns the current renderer backend (always `"webgpu"`).

```typescript
static getBackend(): 'webgpu'
```

**Returns**: `"webgpu"` (string literal)

**Example**:

```typescript
const backend = RendererFactory.getBackend();
console.log(backend); // "webgpu"
```

## Error Handling

### WebGPU Not Available

If WebGPU is not available, `createRenderer` throws an error:

```typescript
try {
  const renderer = RendererFactory.createRenderer(canvas);
} catch (error) {
  console.error('WebGPU not available:', error);
  // Show error message to user
  showWebGPUError();
}
```

### Recommended Error Handling

```typescript
import { RendererFactory } from '@hyperscape/shared';

function initializeRenderer(canvas: HTMLCanvasElement) {
  // Check WebGPU support before creating renderer
  if (!navigator.gpu) {
    throw new Error(
      'WebGPU is not supported in this browser. ' +
      'Please use Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+).'
    );
  }

  try {
    return RendererFactory.createRenderer(canvas);
  } catch (error) {
    console.error('Failed to create WebGPU renderer:', error);
    throw new Error(
      'Failed to initialize WebGPU. Please check:\n' +
      '1. Browser version (Chrome 113+, Edge 113+, Safari 18+)\n' +
      '2. Hardware acceleration enabled\n' +
      '3. GPU drivers up to date\n' +
      '4. Visit webgpureport.org for compatibility check'
    );
  }
}
```

## Migration from WebGL

### Before (WebGL Fallback)

```typescript
// ❌ OLD CODE - No longer works
import { RendererFactory } from '@hyperscape/shared';

const renderer = RendererFactory.createRenderer(canvas);
// Type: UniversalRenderer (WebGLRenderer | WebGPURenderer)

if (RendererFactory.isWebGLFallbackForced()) {
  console.log('Using WebGL fallback');
}
```

### After (WebGPU Only)

```typescript
// ✅ NEW CODE - WebGPU only
import { RendererFactory } from '@hyperscape/shared';

const renderer = RendererFactory.createRenderer(canvas);
// Type: WebGPURenderer (always)

// No fallback checks needed - WebGPU is required
```

## Type Definitions

```typescript
import type { WebGPURenderer } from 'three/webgpu';

// Renderer backend (always 'webgpu')
type RendererBackend = 'webgpu';

// Renderer options
interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'low-power' | 'default';
}

// RendererFactory class
class RendererFactory {
  static createRenderer(
    canvas: HTMLCanvasElement,
    options?: RendererOptions
  ): WebGPURenderer;
  
  static getBackend(): 'webgpu';
}
```

## Related Documentation

- [docs/migration/webgpu-only.md](../migration/webgpu-only.md) - WebGPU migration guide
- [CLAUDE.md](../../CLAUDE.md) - WebGPU requirements and troubleshooting
- [AGENTS.md](../../AGENTS.md) - AI assistant WebGPU guidelines

## Browser Compatibility

| Browser | Minimum Version | WebGPU Support | Notes |
|---------|----------------|----------------|-------|
| Chrome | 113+ | ✅ Full | Recommended |
| Edge | 113+ | ✅ Full | Chromium-based |
| Safari | 18+ | ✅ Full | **Requires macOS 15+** |
| Firefox | Nightly | ⚠️ Partial | Behind flag, not recommended |
| Opera | 99+ | ✅ Full | Chromium-based |
| Brave | 1.52+ | ✅ Full | Chromium-based |

Check compatibility at [webgpureport.org](https://webgpureport.org).

## Performance Considerations

### GPU Selection

WebGPU automatically selects the best available GPU:

```typescript
// Request high-performance GPU
const renderer = RendererFactory.createRenderer(canvas, {
  powerPreference: 'high-performance',
});
```

### Memory Management

WebGPU uses GPU memory more efficiently than WebGL:

- **Shared buffers**: Geometry and textures shared across instances
- **Automatic cleanup**: GPU resources freed when renderer is destroyed
- **Memory limits**: Respects GPU memory limits (no overallocation)

### Render Pipeline

WebGPU uses a modern render pipeline:

- **Compute shaders**: For particle systems, grass, terrain
- **Storage buffers**: For large datasets (vegetation, NPCs)
- **Indirect rendering**: For instanced meshes (trees, rocks)

## Examples

### Basic Setup

```typescript
import { RendererFactory } from '@hyperscape/shared';
import { Scene, PerspectiveCamera } from 'three';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = RendererFactory.createRenderer(canvas);

const scene = new Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
```

### With Error Handling

```typescript
import { RendererFactory } from '@hyperscape/shared';

function setupRenderer(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) {
    showError('WebGPU not supported. Please use Chrome 113+, Edge 113+, or Safari 18+.');
    return null;
  }

  try {
    const renderer = RendererFactory.createRenderer(canvas, {
      antialias: true,
      powerPreference: 'high-performance',
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    return renderer;
  } catch (error) {
    console.error('WebGPU initialization failed:', error);
    showError('Failed to initialize WebGPU. Please check your GPU drivers and browser settings.');
    return null;
  }
}
```

### Cleanup

```typescript
function cleanup(renderer: WebGPURenderer) {
  // Dispose renderer resources
  renderer.dispose();
  
  // Clear canvas
  const canvas = renderer.domElement;
  const context = canvas.getContext('webgpu');
  if (context) {
    context.unconfigure();
  }
}
```
