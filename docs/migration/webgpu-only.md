# Migration Guide: WebGPU-Only Enforcement

This guide helps you migrate to Hyperscape's WebGPU-only rendering system.

## Overview

As of **February 2026**, Hyperscape requires WebGPU and does not support WebGL. This is a **breaking change** that affects:

- Browser compatibility requirements
- Renderer initialization code
- Deployment configurations
- Testing environments

## Why WebGPU-Only?

### Technical Reasons

1. **TSL Shaders**: All materials use Three.js Shading Language (TSL), which only works with WebGPU's node material pipeline
2. **Post-Processing**: Bloom, tone mapping, and effects use TSL-based materials
3. **Performance**: WebGPU provides better performance and lower overhead
4. **Future-Proof**: WebGL is deprecated in favor of WebGPU

### No Fallback Path

There is **NO WebGL fallback** because:
- TSL shaders cannot be transpiled to GLSL
- Post-processing effects require WebGPU node materials
- Maintaining two rendering paths is not feasible
- WebGL would provide a broken experience (black screen)

## Browser Compatibility

### Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 113+ | ✅ Recommended |
| Edge | 113+ | ✅ Recommended |
| Safari | 18+ (macOS 15+) | ✅ Supported |
| Firefox | 121+ | ⚠️ Behind flag, not recommended |

### Checking Compatibility

**User-facing check**:
```typescript
import { isWebGPUAvailable } from '@hyperscape/shared';

async function checkBrowserCompatibility() {
  if (!await isWebGPUAvailable()) {
    showError(
      'WebGPU is required but not available.\n\n' +
      'Please use Chrome 113+, Edge 113+, or Safari 18+.\n\n' +
      'Check compatibility: https://webgpureport.org'
    );
    return false;
  }
  return true;
}
```

**Server-side check** (for streaming):
```bash
# Verify WebGPU is available in Chrome
google-chrome-unstable --headless=new --enable-unsafe-webgpu \
  --use-gl=angle --use-angle=vulkan \
  --enable-features=Vulkan,UseSkiaRenderer,WebGPU \
  about:blank
```

## Code Migration

### 1. Renderer Creation

**Before** (with WebGL fallback):
```typescript
import { createRenderer, isWebGLRenderer } from '@hyperscape/shared';

const renderer = await createRenderer({
  preferWebGPU: true,
  allowWebGLFallback: true
});

if (isWebGLRenderer(renderer)) {
  console.log('Using WebGL fallback');
  // Apply WebGL-specific settings
}
```

**After** (WebGPU only):
```typescript
import { createRenderer } from '@hyperscape/shared';

try {
  const renderer = await createRenderer();
  // Always WebGPU - no need to check
} catch (error) {
  // WebGPU unavailable - show error to user
  showWebGPUError(error.message);
  throw error;
}
```

### 2. Type Definitions

**Before**:
```typescript
import type { UniversalRenderer, RendererBackend } from '@hyperscape/shared';

let renderer: UniversalRenderer;  // Could be WebGL or WebGPU
let backend: RendererBackend;     // 'webgl' | 'webgpu'
```

**After**:
```typescript
import type { WebGPURenderer, RendererBackend } from '@hyperscape/shared';

let renderer: WebGPURenderer;  // Always WebGPU
let backend: RendererBackend;  // Only 'webgpu'
```

### 3. Removed Functions

**Before**:
```typescript
import { 
  isWebGLAvailable,
  isWebGLForced,
  isWebGLFallbackAllowed,
  isOffscreenCanvasAvailable,
  canTransferCanvas
} from '@hyperscape/shared';

if (isWebGLAvailable()) {
  // Use WebGL
}
```

**After**:
```typescript
// All removed - use isWebGPUAvailable() instead
import { isWebGPUAvailable } from '@hyperscape/shared';

if (!await isWebGPUAvailable()) {
  throw new Error('WebGPU is required');
}
```

### 4. URL Parameters

**Before**:
```typescript
// Force WebGL via URL parameter
const url = 'http://localhost:3333/?forceWebGL=true';
```

**After**:
```typescript
// No WebGL parameters - WebGPU is always used
const url = 'http://localhost:3333/';
```

## Deployment Migration

### Local Development

**Before**:
```bash
# Any browser worked (WebGL fallback)
bun run dev
```

**After**:
```bash
# Requires WebGPU-capable browser
bun run dev

# Check browser: https://webgpureport.org
```

### Vast.ai Streaming

**Before** (soft fallback to headless):
```bash
# deploy-vast.sh would fall back to headless if Xorg failed
# This silently broke WebGPU
```

**After** (fail-fast validation):
```bash
# deploy-vast.sh validates WebGPU availability
# Deployment FAILS if Xorg/Xvfb cannot provide WebGPU
# No silent fallback to broken state
```

**New validation**:
```bash
# Script checks:
1. nvidia-smi works
2. Vulkan ICD exists
3. Display server (Xorg/Xvfb) starts
4. Display is accessible (xdpyinfo)
5. FAIL if any check fails
```

### CI/CD

**Before**:
```yaml
# Tests could run in any browser
- name: Run tests
  run: npm test
```

**After**:
```yaml
# Tests require WebGPU-capable browser
- name: Install Playwright
  run: bunx playwright install chromium

- name: Run tests
  run: npm test
  env:
    # Ensure WebGPU is available
    BROWSER: chromium
```

## Testing Migration

### Unit Tests

**Before**:
```typescript
// Tests could mock renderer
const mockRenderer = {
  render: vi.fn(),
  setSize: vi.fn()
};
```

**After**:
```typescript
// Tests use real WebGPU renderer
import { createRenderer } from '@hyperscape/shared';

const renderer = await createRenderer();
// Real WebGPU renderer - no mocks
```

### E2E Tests

**Before**:
```typescript
// Playwright could use any browser
const browser = await chromium.launch();
```

**After**:
```typescript
// Playwright must use WebGPU-capable browser
const browser = await chromium.launch({
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer,WebGPU'
  ]
});
```

## Environment-Specific Changes

### macOS

**Before**: WebGL worked everywhere

**After**: Requires macOS 15+ for Safari 18 WebGPU support

**Recommendation**: Use Chrome 113+ on older macOS versions

### Linux

**Before**: WebGL worked with Mesa drivers

**After**: Requires:
- NVIDIA GPU with Vulkan support (for streaming)
- Chrome 113+ or Edge 113+
- Vulkan ICD properly configured

### Windows

**Before**: WebGL worked with any GPU

**After**: Requires:
- Chrome 113+ or Edge 113+
- GPU drivers with Vulkan support
- Hardware acceleration enabled

### Docker/Containers

**Before**: Could use software rendering (swrast)

**After**: Requires:
- NVIDIA GPU passthrough
- Xorg or Xvfb display server
- Vulkan ICD mounted
- **NO headless mode**

## Troubleshooting

### "WebGPU is REQUIRED but not available"

**Cause**: Browser doesn't support WebGPU

**Solutions**:
1. Update browser to latest version
2. Check: https://webgpureport.org
3. Enable hardware acceleration in browser settings
4. Update GPU drivers

### "Renderer initialization FAILED"

**Cause**: WebGPU detected but initialization failed

**Solutions**:
1. Update GPU drivers
2. Try different browser (Chrome recommended)
3. Check GPU compatibility: https://webgpureport.org
4. Disable browser extensions that might interfere

### "Cannot establish WebGPU-capable rendering mode" (Vast.ai)

**Cause**: Display server (Xorg/Xvfb) failed to start

**Solutions**:
1. Check NVIDIA drivers: `nvidia-smi`
2. Check Vulkan: `vulkaninfo --summary`
3. Check Xorg logs: `cat /var/log/Xorg.99.log`
4. Verify DRI devices: `ls -la /dev/dri/`

### Tests Failing with WebGPU Errors

**Cause**: Test environment doesn't support WebGPU

**Solutions**:
1. Use headful browser (not headless)
2. Enable GPU in CI/CD environment
3. Use Xvfb with GPU passthrough
4. Skip visual tests in environments without GPU

## Rollback Plan

If you need to temporarily revert to a version with WebGL support:

```bash
# Checkout commit before WebGPU-only enforcement
git checkout 205f9649^  # Parent of WebGPU-only commit

# Or use a specific tag
git checkout v1.0.0  # Replace with last WebGL-supporting version
```

**Note**: This is not recommended as newer features require WebGPU.

## FAQ

### Q: Can I use WebGL for development?

**A**: No. WebGL will not work because all shaders use TSL, which requires WebGPU.

### Q: What if my users don't have WebGPU?

**A**: Show a clear error message directing them to upgrade their browser. WebGPU is widely supported in modern browsers (Chrome 113+, Edge 113+, Safari 18+).

### Q: Can I run Hyperscape in headless mode?

**A**: No. WebGPU requires a display server (Xorg or Xvfb). Headless Chrome does not support WebGPU.

### Q: What about mobile devices?

**A**: 
- iOS: Requires iOS 18+ (Safari 18)
- Android: Requires Chrome 113+ or Edge 113+
- Most modern devices support WebGPU

### Q: Can I use software rendering?

**A**: No. WebGPU requires hardware GPU. Software rendering (swrast, llvmpipe) does not support WebGPU.

## Support

If you encounter issues migrating to WebGPU-only:

1. Check browser compatibility: https://webgpureport.org
2. Review error messages (they include troubleshooting steps)
3. Check documentation: [docs/](../README.md)
4. Open an issue: [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)

## References

- **Commit**: `47782ed95690bfb2dd4c91798fb02e734f6efa57`
- **AGENTS.md**: [AGENTS.md](../../AGENTS.md)
- **CLAUDE.md**: [CLAUDE.md](../../CLAUDE.md)
- **Renderer API**: [docs/api/renderer-factory.md](../api/renderer-factory.md)
- **WebGPU Spec**: [W3C WebGPU](https://www.w3.org/TR/webgpu/)
