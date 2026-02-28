# WebGPU-Only Migration Guide

Guide for migrating from WebGL/Universal renderer to WebGPU-only.

## Overview

As of v0.2.0 (February 2026), Hyperscape requires WebGPU. WebGL support has been completely removed.

**Reason:** All materials use TSL (Three Shading Language) which only works with WebGPU's node material pipeline. There is no WebGL fallback path.

## Browser Requirements

### Minimum Versions

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 113+ | Recommended, best performance |
| Edge | 113+ | Chromium-based, same as Chrome |
| Safari | 18+ | Requires macOS 15+ |
| Firefox | 121+ | Behind flag, not recommended |

### Checking Compatibility

Visit [webgpureport.org](https://webgpureport.org) to check if your browser supports WebGPU.

## Code Changes

### Renderer Creation

**Before:**
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

**After:**
```typescript
import { createRenderer } from './RendererFactory';

const renderer = await createRenderer();
// Always WebGPU, no type checking needed
// renderer.init() called automatically
```

### Material Creation

**Before:**
```typescript
import { MeshStandardMaterial } from 'three';

const material = new MeshStandardMaterial({
  color: 0xff0000,
  metalness: 0.5,
  roughness: 0.5,
});
```

**After:**
```typescript
import { MeshStandardNodeMaterial } from 'three/webgpu';

const material = new MeshStandardNodeMaterial({
  color: 0xff0000,
  metalness: 0.5,
  roughness: 0.5,
});
```

### Custom Shaders

**Before (GLSL):**
```typescript
const material = new THREE.ShaderMaterial({
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `,
});
```

**After (TSL):**
```typescript
import { MeshBasicNodeMaterial, color } from 'three/webgpu';

const material = new MeshBasicNodeMaterial();
material.colorNode = color(0xff0000);
```

### Renderer Type Checking

**Before:**
```typescript
import { isWebGLRenderer, isWebGPURenderer } from './RendererFactory';

if (isWebGLRenderer(renderer)) {
  // WebGL path
} else if (isWebGPURenderer(renderer)) {
  // WebGPU path
}
```

**After:**
```typescript
// No type checking needed - always WebGPU
const renderer = await createRenderer();
```

### Capability Detection

**Before:**
```typescript
import { isWebGLAvailable, isWebGPUAvailable } from './RendererFactory';

const hasWebGL = await isWebGLAvailable();
const hasWebGPU = await isWebGPUAvailable();

if (hasWebGPU) {
  // Use WebGPU
} else if (hasWebGL) {
  // Fallback to WebGL
} else {
  // Error
}
```

**After:**
```typescript
import { isWebGPUAvailable } from './RendererFactory';

const hasWebGPU = await isWebGPUAvailable();

if (!hasWebGPU) {
  throw new Error('WebGPU required. Please use Chrome 113+');
}

const renderer = await createRenderer();
```

## Environment Variables

### Removed

- `DUEL_FORCE_WEBGL_FALLBACK` - No longer used
- `STREAM_CAPTURE_DISABLE_WEBGPU` - Ignored (WebGPU required)

### Changed

- `STREAM_CAPTURE_HEADLESS` - Always `false` (WebGPU requires display)
- `STREAM_CAPTURE_USE_EGL` - Not supported (WebGPU requires display)

## Streaming Changes

### Chrome Flags

**Before:**
```bash
# Could disable WebGPU for WebGL fallback
--disable-webgpu
--force-webgl
```

**After:**
```bash
# WebGPU always enabled
--enable-unsafe-webgpu
--enable-features=Vulkan,UseSkiaRenderer,WebGPU
--use-gl=angle
--use-angle=vulkan
```

### Headless Mode

**Before:**
```bash
# Could run in pure headless mode
STREAM_CAPTURE_HEADLESS=true
```

**After:**
```bash
# WebGPU requires display server (Xorg or Xvfb)
STREAM_CAPTURE_HEADLESS=false
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true  # or false for Xorg
```

## Testing Changes

### Visual Tests

**Before:**
```typescript
// Could use WebGL readPixels
const pixels = new Uint8Array(4);
renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixels);
```

**After:**
```typescript
// Use 2D canvas for pixel reading
const canvas2d = document.createElement('canvas');
const ctx = canvas2d.getContext('2d');
ctx.drawImage(renderer.domElement, 0, 0);
const imageData = ctx.getImageData(0, 0, 1, 1);
const pixels = imageData.data;
```

## Troubleshooting

### "WebGPU is REQUIRED but not available"

**Cause:** Browser doesn't support WebGPU.

**Solution:**
1. Update to Chrome 113+, Edge 113+, or Safari 18+
2. Check compatibility at [webgpureport.org](https://webgpureport.org)

### "Renderer initialization FAILED"

**Cause:** GPU drivers outdated or WebGPU blocked.

**Solution:**
1. Update GPU drivers
2. Enable hardware acceleration in browser settings
3. Check for browser extensions that might block WebGPU

### "Expected WebGPU backend but got..."

**Cause:** Browser/driver issue with WebGPU.

**Solution:**
1. Restart browser
2. Update GPU drivers
3. Try different browser (Chrome recommended)

### Streaming: Black Screen

**Cause:** WebGPU not available in streaming environment.

**Solution:**
1. Verify NVIDIA GPU: `nvidia-smi`
2. Check Vulkan: `vulkaninfo --summary`
3. Check display: `xdpyinfo -display :99`
4. Check Xorg logs: `cat /var/log/Xorg.99.log | grep -E "(EE)"`

## Rollback

If you need to rollback to WebGL support:

```bash
# Checkout commit before WebGPU-only enforcement
git checkout 205f9649  # Last commit with WebGL support

# Rebuild
bun install
bun run build
```

**Note:** This is not recommended. WebGL support will not be maintained.

## Support

### Getting Help

1. **Check browser compatibility** - [webgpureport.org](https://webgpureport.org)
2. **Update GPU drivers** - See manufacturer website
3. **Enable hardware acceleration** - Browser settings
4. **Check documentation** - [docs/api/renderer-factory.md](../api/renderer-factory.md)
5. **Open issue** - [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)

### Common Questions

**Q: Can I use WebGL instead of WebGPU?**
A: No. WebGL is not supported. All materials use TSL which requires WebGPU.

**Q: What if my GPU doesn't support WebGPU?**
A: You need a WebGPU-capable GPU. Check [webgpureport.org](https://webgpureport.org) for compatibility.

**Q: Can I run Hyperscape on a server without GPU?**
A: No. WebGPU requires a GPU. For streaming, use Vast.ai with NVIDIA GPU.

**Q: Does WebGPU work in Electron/Tauri?**
A: Yes, but you need to enable WebGPU in the WebView configuration.

## References

- [RendererFactory.ts](../../packages/shared/src/utils/rendering/RendererFactory.ts) - Source code
- [docs/api/renderer-factory.md](../api/renderer-factory.md) - API reference
- [Three.js WebGPU](https://threejs.org/docs/#api/en/renderers/WebGPURenderer) - Three.js docs
- [WebGPU Spec](https://gpuweb.github.io/gpuweb/) - WebGPU specification
- [webgpureport.org](https://webgpureport.org) - Compatibility checker
