# WebGPU-Only Migration Guide

**BREAKING CHANGE**: As of commit `47782ed` (2026-02-27), Hyperscape requires WebGPU. WebGL is no longer supported.

## Why WebGPU-Only?

All Hyperscape materials and post-processing effects use **TSL (Three Shading Language)**, which only works with Three.js's WebGPU node material pipeline. There is no WebGL fallback path.

### What Changed

1. **Renderer**: `WebGLRenderer` → `WebGPURenderer` (always)
2. **Materials**: All materials use TSL node materials
3. **Post-processing**: Bloom, tone mapping, etc. use TSL-based effects
4. **Fallback code**: All WebGL detection and fallback code removed

## Browser Compatibility

### Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 113+ | Recommended, best performance |
| Edge | 113+ | Chromium-based, same as Chrome |
| Safari | 18+ | **Requires macOS 15+** |
| Firefox | Nightly only | Behind flag, not recommended |

### Check WebGPU Support

Visit [webgpureport.org](https://webgpureport.org) to verify your browser supports WebGPU.

### Safari 18+ Requirement

**Important**: Safari 18 requires **macOS 15 (Sequoia)** or later. Earlier macOS versions cannot run Safari 18.

- macOS 14 (Sonoma): Safari 17 (no WebGPU)
- macOS 15 (Sequoia): Safari 18+ (WebGPU supported)

If you're on macOS 14 or earlier, you must:
1. Upgrade to macOS 15+, OR
2. Use Chrome 113+ or Edge 113+

## Code Changes

### Removed APIs

The following APIs and flags have been removed:

```typescript
// ❌ REMOVED - No longer exists
RendererFactory.isWebGLForced()
RendererFactory.isWebGLFallbackForced()
RendererFactory.isWebGLFallbackAllowed()
RendererFactory.isWebGLAvailable()
RendererFactory.isOffscreenCanvasAvailable()
RendererFactory.canTransferCanvas()

// ❌ REMOVED - No longer exists
type RendererBackend = 'webgl' | 'webgpu'; // Now only 'webgpu'

// ❌ REMOVED - No longer exists
UniversalRenderer // Now always WebGPURenderer
```

### Updated APIs

```typescript
// ✅ CORRECT - Always returns WebGPURenderer
import { RendererFactory } from '@hyperscape/shared';

const renderer = RendererFactory.createRenderer(canvas);
// Type: WebGPURenderer (not UniversalRenderer)
```

### Environment Variables

The following environment variables are **ignored** (kept for backwards compatibility):

```bash
# ❌ IGNORED - WebGPU is always enabled
STREAM_CAPTURE_DISABLE_WEBGPU=false
DUEL_FORCE_WEBGL_FALLBACK=false
```

### URL Parameters

The following URL parameters are **ignored**:

```
# ❌ IGNORED - WebGPU is always enabled
?forceWebGL=true
?disableWebGPU=true
```

## Deployment Changes

### Vast.ai Streaming

**CRITICAL**: Headless mode no longer works. WebGPU requires a display server.

#### Before (Broken)

```bash
# ❌ BROKEN - Headless mode doesn't support WebGPU
google-chrome --headless=new --disable-gpu
```

#### After (Correct)

```bash
# ✅ CORRECT - Use Xorg or Xvfb with GPU access
# Option 1: Xorg with NVIDIA (best performance)
Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf

# Option 2: Xvfb with NVIDIA Vulkan (fallback)
Xvfb :99 -screen 0 1920x1080x24 +extension GLX
export DISPLAY=:99
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Launch Chrome with GPU access
google-chrome-unstable --use-gl=angle --use-angle=vulkan
```

See `scripts/deploy-vast.sh` for complete implementation.

### Docker Containers

If running in Docker, ensure:

1. **GPU access**: Container has access to NVIDIA GPU
   ```bash
   docker run --gpus all ...
   ```

2. **Display server**: Xvfb or Xorg running inside container
   ```dockerfile
   RUN apt-get install -y xvfb mesa-utils
   ENV DISPLAY=:99
   CMD Xvfb :99 -screen 0 1920x1080x24 & your-app
   ```

3. **Vulkan ICD**: NVIDIA Vulkan driver accessible
   ```bash
   apt-get install -y vulkan-tools libvulkan1
   export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
   ```

## Testing Changes

### Visual Tests

All visual tests now require WebGPU:

```typescript
// ✅ CORRECT - Tests use real browser with WebGPU
test('renders player model', async ({ page }) => {
  await page.goto('http://localhost:3333');
  // WebGPU is available in Playwright's Chromium
});
```

### Headless Testing

Playwright's headless mode **does not support WebGPU**. Use headful mode:

```typescript
// playwright.config.ts
export default {
  use: {
    headless: false, // Required for WebGPU
  },
};
```

Or use Xvfb in CI:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    Xvfb :99 -screen 0 1920x1080x24 &
    export DISPLAY=:99
    npm test
```

## Error Messages

### "WebGPU is not supported"

**Cause**: Browser doesn't support WebGPU or hardware acceleration is disabled.

**Fix**:
1. Update browser to Chrome 113+, Edge 113+, or Safari 18+
2. Enable hardware acceleration in browser settings
3. Update GPU drivers
4. Check [webgpureport.org](https://webgpureport.org) for compatibility

### "Failed to create WebGPU device"

**Cause**: GPU is blocked or drivers are outdated.

**Fix**:
1. Update GPU drivers (NVIDIA, AMD, Intel)
2. Check browser flags: `chrome://flags/#enable-unsafe-webgpu`
3. Disable browser extensions that might block WebGPU
4. Try a different browser (Chrome recommended)

### "Execution context was destroyed"

**Cause**: Page navigation or reload during WebGPU initialization.

**Fix**: This is usually transient. The game will retry automatically.

### "No screens found" (Vast.ai)

**Cause**: Xorg cannot access GPU or DRI devices.

**Fix**:
1. Check GPU access: `nvidia-smi`
2. Check DRI devices: `ls -la /dev/dri/`
3. Fall back to Xvfb: `Xvfb :99 -screen 0 1920x1080x24`
4. Verify Vulkan: `vulkaninfo --summary`

## Rollback (Not Recommended)

If you absolutely must use an older version with WebGL support, checkout commit before the breaking change:

```bash
git checkout 47782ed~1  # One commit before WebGPU-only enforcement
```

**Warning**: This version is no longer maintained and missing critical features and bug fixes.

## Support

If you encounter issues after this migration:

1. Check browser compatibility at [webgpureport.org](https://webgpureport.org)
2. Review [CLAUDE.md](../../CLAUDE.md) troubleshooting section
3. Open an issue at [github.com/HyperscapeAI/hyperscape/issues](https://github.com/HyperscapeAI/hyperscape/issues)
4. Join our Discord for community support

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - WebGPU requirements and troubleshooting
- [AGENTS.md](../../AGENTS.md) - AI assistant WebGPU guidelines
- [docs/duel-stack.md](../duel-stack.md) - GPU streaming setup
- [packages/shared/src/utils/rendering/RendererFactory.ts](../../packages/shared/src/utils/rendering/RendererFactory.ts) - Renderer implementation
