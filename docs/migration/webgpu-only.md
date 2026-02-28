# Migration Guide: WebGPU-Only Rendering

This guide helps you migrate from the old WebGL fallback system to WebGPU-only rendering.

## Breaking Changes

### Commit: 47782ed (2026-02-27)

**BREAKING:** WebGL support has been completely removed. WebGPU is now REQUIRED.

## Why WebGPU-Only?

All Hyperscape materials use TSL (Three Shading Language) which **only works with WebGPU**. There is no WebGL fallback path - the game simply won't render without WebGPU.

**TSL-dependent features:**
- All material shaders (terrain, water, vegetation, buildings)
- Post-processing effects (bloom, tone mapping, color grading)
- Dissolve animations for resource respawning
- Animated impostor atlases for mobs
- GPU-accelerated grass rendering

## What Changed

### Removed Code

**RendererFactory.ts:**
- ❌ `isWebGLAvailable()` - Removed
- ❌ `isWebGLForced()` - Removed
- ❌ `isWebGLFallbackForced()` - Removed
- ❌ `isWebGLFallbackAllowed()` - Removed
- ❌ `isOffscreenCanvasAvailable()` - Removed
- ❌ `canTransferCanvas()` - Removed
- ❌ `UniversalRenderer` type - Removed
- ❌ WebGL detection and fallback logic - Removed

**deploy-vast.sh:**
- ❌ Headless fallback mode - Removed
- ❌ Software rendering fallback - Removed
- ✅ Deployment now FAILS if WebGPU cannot be initialized

**stream-to-rtmp.ts:**
- ❌ `STREAM_CAPTURE_DISABLE_WEBGPU` logic - Removed
- ❌ `forceWebGL` URL parameter - Removed
- ❌ `disableWebGPU` URL parameter - Removed

**ecosystem.config.cjs:**
- ❌ `DUEL_FORCE_WEBGL_FALLBACK` - Removed (kept as deprecated flag)
- ✅ `STREAM_CAPTURE_HEADLESS` hardcoded to `false`

## Migration Steps

### 1. Update Type Imports

**Before:**
```typescript
import { UniversalRenderer } from '@hyperscape/shared';

const renderer: UniversalRenderer = await createRenderer();
```

**After:**
```typescript
import { WebGPURenderer } from '@hyperscape/shared';

const renderer: WebGPURenderer = await createRenderer();
```

### 2. Remove WebGL Checks

**Before:**
```typescript
if (isWebGLAvailable()) {
  // WebGL fallback code
} else {
  // WebGPU code
}
```

**After:**
```typescript
// WebGPU is always used - no checks needed
const renderer = await createRenderer();
```

### 3. Update Error Handling

**Before:**
```typescript
try {
  const renderer = await createRenderer();
} catch (err) {
  // Try WebGL fallback
  const webglRenderer = createWebGLRenderer();
}
```

**After:**
```typescript
try {
  const renderer = await createRenderer();
} catch (err) {
  // Show error to user - no fallback available
  showWebGPURequiredError(err);
}
```

### 4. Remove Renderer Backend Checks

**Before:**
```typescript
const backend = getRendererBackend(renderer);
if (backend === 'webgl') {
  // WebGL-specific code
} else {
  // WebGPU-specific code
}
```

**After:**
```typescript
// Backend is always WebGPU - no checks needed
const backend = getRendererBackend(renderer); // Always "webgpu"
```

### 5. Update Deployment Scripts

**Before:**
```bash
# deploy-vast.sh
if [ "$GPU_FAILED" = "true" ]; then
  # Fall back to headless mode
  export STREAM_CAPTURE_HEADLESS=true
  export DUEL_FORCE_WEBGL_FALLBACK=true
fi
```

**After:**
```bash
# deploy-vast.sh
if [ "$GPU_FAILED" = "true" ]; then
  # FAIL deployment - no fallback
  echo "FATAL: WebGPU required but GPU setup failed"
  exit 1
fi
```

### 6. Remove WebGL Environment Variables

**Before:**
```bash
# .env
DUEL_FORCE_WEBGL_FALLBACK=true
STREAM_CAPTURE_DISABLE_WEBGPU=true
```

**After:**
```bash
# .env
# These variables are ignored (kept for backwards compatibility)
# DUEL_FORCE_WEBGL_FALLBACK=false
# STREAM_CAPTURE_DISABLE_WEBGPU=false
```

## Browser Requirements

### Minimum Versions

| Browser | Minimum Version | Release Date |
|---------|----------------|--------------|
| Chrome | 113 | May 2023 |
| Edge | 113 | May 2023 |
| Safari | 18 (macOS 15+) | September 2024 |
| Firefox | 121+ (behind flag) | December 2023 |

### Checking Support

**Online:**
- Visit [webgpureport.org](https://webgpureport.org)

**In browser console:**
```javascript
if ('gpu' in navigator) {
  const adapter = await navigator.gpu.requestAdapter();
  console.log('WebGPU:', adapter ? 'Supported' : 'Not supported');
} else {
  console.log('WebGPU: Not supported');
}
```

**In Chrome:**
- Visit `chrome://gpu`
- Look for "WebGPU: Hardware accelerated"

## Server/Streaming Requirements

### Vast.ai Deployment

**REQUIRED:**
- NVIDIA GPU with Vulkan support
- Xorg or Xvfb display server
- Chrome Dev channel (google-chrome-unstable)
- ANGLE/Vulkan backend

**NOT SUPPORTED:**
- Headless mode without display server
- Software rendering (swrast, llvmpipe)
- WebGL fallback

### Validation

The deploy script validates WebGPU availability:

```bash
# Check GPU
nvidia-smi || exit 1

# Check Vulkan
vulkaninfo --summary

# Check display server
xdpyinfo -display $DISPLAY || exit 1

# Deployment FAILS if any check fails
```

## Troubleshooting

### "WebGPU is REQUIRED but not available"

**Cause:** Browser doesn't support WebGPU or hardware acceleration is disabled.

**Solution:**
1. Update browser to minimum version
2. Enable hardware acceleration in browser settings
3. Update GPU drivers
4. Check [webgpureport.org](https://webgpureport.org)

### "Renderer initialization FAILED"

**Cause:** WebGPU is available but initialization failed.

**Solution:**
1. Update GPU drivers
2. Try different browser
3. Check for browser extensions blocking WebGPU
4. Restart browser

### "FATAL: WebGPU required but GPU setup failed" (Vast.ai)

**Cause:** GPU rendering mode could not be established.

**Solution:**
1. Verify NVIDIA GPU: `nvidia-smi`
2. Check Vulkan: `vulkaninfo --summary`
3. Verify display server: `xdpyinfo -display :99`
4. Check deploy logs for specific error
5. Ensure container has GPU access

### "Display :99 is not accessible"

**Cause:** Xorg/Xvfb failed to start.

**Solution:**
1. Clean X lock files: `rm -f /tmp/.X*-lock`
2. Remove X sockets: `rm -rf /tmp/.X11-unix`
3. Restart display server
4. Check Xorg logs: `cat /var/log/Xorg.99.log`

## FAQ

### Can I still use WebGL?

**No.** WebGL is not supported and will not work. All materials use TSL which requires WebGPU.

### What if my users don't have WebGPU?

They must update their browser or use a supported browser. WebGPU is widely available:
- Chrome/Edge 113+ (May 2023)
- Safari 18+ (September 2024)
- ~95% of desktop browsers support WebGPU as of 2026

### Can I run Hyperscape in headless mode?

**No.** WebGPU requires a display server (Xorg or Xvfb). Pure headless mode is not supported.

For server-side rendering (streaming), use Xvfb with NVIDIA Vulkan.

### What about mobile browsers?

Mobile WebGPU support is limited:
- iOS Safari 18+ (iOS 18+)
- Android Chrome 113+ (limited GPU support)

Use the native app (Capacitor) for better mobile performance.

### How do I check if WebGPU is working?

**Browser:**
```javascript
const hasWebGPU = await isWebGPUAvailable();
console.log('WebGPU:', hasWebGPU);
```

**Server (Vast.ai):**
```bash
# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check display
xdpyinfo -display $DISPLAY

# Check Chrome WebGPU
google-chrome-unstable --headless=new --enable-unsafe-webgpu --use-gl=angle --use-angle=vulkan about:blank
```

## Related Documentation

- [RendererFactory API](../api/renderer-factory.md)
- [Vast.ai Streaming](../vast-ai-streaming.md)
- [CLAUDE.md](../../CLAUDE.md) - Development guide
- [AGENTS.md](../../AGENTS.md) - AI assistant instructions
