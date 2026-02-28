# WebGPU-Only Migration Guide

**Breaking Change**: Hyperscape now requires WebGPU. All WebGL fallback code has been removed.

## What Changed

### Commit 47782ed (2026-02-27)

**Title**: `fix(rendering): enforce WebGPU-only mode, remove all WebGL fallbacks`

**Summary**: WebGPU is now REQUIRED. WebGL will NOT work. All TSL (Three Shading Language) materials require WebGPU and there is no fallback path.

### Removed Code

**RendererFactory.ts**:
- ❌ `isWebGLForced` - Removed
- ❌ `isWebGLFallbackForced` - Removed
- ❌ `isWebGLFallbackAllowed` - Removed
- ❌ `isWebGLAvailable()` - Removed
- ❌ `isOffscreenCanvasAvailable()` - Removed
- ❌ `canTransferCanvas()` - Removed
- ❌ `UniversalRenderer` type - Removed (use `WebGPURenderer`)
- ❌ `RendererBackend` - Now only `"webgpu"` (was `"webgpu" | "webgl"`)

**stream-to-rtmp.ts**:
- ❌ `STREAM_CAPTURE_DISABLE_WEBGPU` - Ignored (warning logged)
- ❌ `forceWebGL` URL parameter - Removed
- ❌ `disableWebGPU` URL parameter - Removed

**deploy-vast.sh**:
- ❌ Headless fallback mode - Removed (deployment fails if Xorg/Xvfb cannot provide WebGPU)
- ❌ Soft fallback to headless - Removed (explicit display accessibility verification required)

**ecosystem.config.cjs**:
- ❌ `DUEL_FORCE_WEBGL_FALLBACK` - Deprecated (always false)
- ✅ `STREAM_CAPTURE_HEADLESS` - Hardcoded to `false` (WebGPU requires display)

## Why WebGPU-Only?

### Technical Reasons

1. **TSL Shaders**: All materials use Three.js Shading Language (TSL)
   - TSL only works with WebGPU node material pipeline
   - No WebGL equivalent exists

2. **Post-Processing**: Bloom, tone mapping, color grading use TSL
   - WebGPU-only node materials
   - Cannot be ported to WebGL

3. **Performance**: WebGPU provides better performance
   - Compute shaders for vegetation, terrain, particles
   - Instanced rendering optimizations
   - Better memory management

### Root Cause of Streaming Issues

The headless fallback in `deploy-vast.sh` was silently falling back to a mode that doesn't support WebGPU when Xorg/Xvfb setup failed. This caused:
- Black frames (no rendering)
- Browser hangs (WebGPU initialization timeout)
- Silent failures (no error messages)

**Fix**: Deployment now FAILS if WebGPU cannot be initialized. No soft fallbacks.

## Migration Steps

### For Developers

1. **Update browser**:
   - Chrome 113+ (recommended)
   - Edge 113+
   - Safari 18+ (macOS 15+) - Safari 17 support removed
   - Check: [webgpureport.org](https://webgpureport.org)

2. **Enable hardware acceleration**:
   - Chrome: `chrome://settings` → System → "Use hardware acceleration"
   - Safari: Preferences → Advanced → Experimental Features → "WebGPU"

3. **Update GPU drivers**:
   - NVIDIA: [nvidia.com/drivers](https://nvidia.com/drivers)
   - AMD: [amd.com/support](https://amd.com/support)
   - Intel: [intel.com/download-center](https://intel.com/download-center)

4. **Remove WebGL code**:
   ```typescript
   // ❌ REMOVE
   if (isWebGLRenderer(renderer)) { ... }
   
   // ✅ REPLACE WITH
   // WebGPU is always available - no checks needed
   ```

5. **Update renderer creation**:
   ```typescript
   // ❌ OLD
   const renderer = await createRenderer({ backend: 'webgpu' });
   
   // ✅ NEW
   const renderer = await createRenderer(); // Always WebGPU
   ```

6. **Remove fallback flags**:
   ```typescript
   // ❌ REMOVE
   const url = `${baseUrl}?forceWebGL=true`;
   const url = `${baseUrl}?disableWebGPU=true`;
   
   // ✅ REPLACE WITH
   const url = baseUrl; // WebGPU is always enabled
   ```

### For Deployment (Vast.ai)

1. **Verify GPU requirements**:
   - NVIDIA GPU with Vulkan support
   - Check: `nvidia-smi` and `vulkaninfo --summary`

2. **Ensure display server**:
   - Xorg (preferred) or Xvfb (fallback)
   - NOT headless mode
   - Verify: `xdpyinfo -display $DISPLAY`

3. **Update environment variables**:
   ```bash
   # ❌ REMOVE
   STREAM_CAPTURE_DISABLE_WEBGPU=true
   DUEL_FORCE_WEBGL_FALLBACK=true
   
   # ✅ ADD/UPDATE
   STREAM_CAPTURE_HEADLESS=false  # Always false
   DUEL_CAPTURE_USE_XVFB=false    # Set by deploy script
   GPU_RENDERING_MODE=xorg        # Set by deploy script
   ```

4. **Run deployment script**:
   ```bash
   ./scripts/deploy-vast.sh
   ```
   
   Script will:
   - Detect GPU and display capabilities
   - Configure Xorg or Xvfb
   - Verify WebGPU initialization
   - FAIL if WebGPU cannot be initialized

5. **Monitor deployment**:
   ```bash
   pm2 logs hyperscape-duel --lines 200
   
   # Look for:
   # ✅ "WebGPU preflight PASSED"
   # ✅ "GPU Diagnostics: WebGPU Status: Hardware accelerated"
   # ❌ "WebGPU preflight FAILED"
   # ❌ "WebGPU may not be working properly"
   ```

### For CI/CD

1. **Update GitHub Secrets**:
   - Remove any `FORCE_WEBGL` or `DISABLE_WEBGPU` secrets
   - Ensure `VAST_HOST`, `VAST_PORT`, `VAST_SSH_KEY` are set

2. **Update workflows**:
   - `.github/workflows/deploy-vast.yml` already updated
   - No changes needed if using latest workflow

3. **Verify deployment**:
   - Check GitHub Actions logs for WebGPU preflight test
   - Verify GPU diagnostics in deployment output

## Breaking Changes

### API Changes

**RendererFactory**:
```typescript
// ❌ REMOVED
type RendererBackend = "webgpu" | "webgl";
type UniversalRenderer = WebGPURenderer | WebGLRenderer;
function isWebGLAvailable(): Promise<boolean>;
function isWebGLRenderer(renderer): boolean;

// ✅ NEW
type RendererBackend = "webgpu";
type WebGPURenderer = InstanceType<typeof THREE.WebGPURenderer>;
// No WebGL detection functions
```

**Exports**:
```typescript
// ❌ REMOVED from index.ts and index.client.ts
export { isWebGLAvailable, isWebGLRenderer, UniversalRenderer };

// ✅ KEPT
export { WebGPURenderer, createRenderer, isWebGPUAvailable };
```

### Environment Variables

**Deprecated** (ignored with warning):
- `STREAM_CAPTURE_DISABLE_WEBGPU` - Logs warning, WebGPU always enabled
- `DUEL_FORCE_WEBGL_FALLBACK` - Deprecated, always false

**Removed**:
- `forceWebGL` URL parameter
- `disableWebGPU` URL parameter

**Required**:
- `STREAM_CAPTURE_HEADLESS=false` - WebGPU requires display
- `DUEL_CAPTURE_USE_XVFB` - Set by deploy script (true for Xvfb, false for Xorg)
- `GPU_RENDERING_MODE` - Set by deploy script (xorg, xvfb-vulkan, ozone-headless)

### Deployment Changes

**deploy-vast.sh**:
- ❌ Removed headless fallback (line ~200)
- ✅ Added explicit WebGPU validation
- ✅ Added GPU diagnostics extraction
- ✅ Added WebGPU preflight test
- ✅ Deployment FAILS if WebGPU cannot initialize

**ecosystem.config.cjs**:
- ❌ Removed `DUEL_FORCE_WEBGL_FALLBACK=true`
- ✅ Added `STREAM_CAPTURE_HEADLESS=false` (hardcoded)
- ✅ Added `STREAM_CAPTURE_DISABLE_WEBGPU=false` (diagnostic only)

## Compatibility

### Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 113+ | ✅ Recommended |
| Edge | 113+ | ✅ Recommended |
| Safari | 18+ (macOS 15+) | ⚠️ Safari 17 support removed |
| Firefox | 121+ | ⚠️ Behind flag, not recommended |

### Unsupported Environments

- ❌ WebGL-only browsers (IE, old Safari)
- ❌ Headless Chrome without GPU
- ❌ Software rendering (SwiftShader, llvmpipe)
- ❌ Containers without GPU access
- ❌ WebViews that block WebGPU

## Rollback

If you need to rollback to WebGL support:

1. **Revert to commit before 47782ed**:
   ```bash
   git checkout 1b2e230  # Last commit before WebGL removal
   ```

2. **Note**: This is NOT recommended
   - WebGL support was broken (TSL shaders don't work)
   - Streaming was producing black frames
   - No active maintenance of WebGL code path

3. **Better solution**: Fix WebGPU availability
   - Update browser
   - Update GPU drivers
   - Enable hardware acceleration
   - Use supported deployment environment

## Testing

### Verify WebGPU Support

**Browser:**
```javascript
// Open browser console
const adapter = await navigator.gpu?.requestAdapter();
console.log('WebGPU available:', adapter !== null);
```

**Automated:**
```bash
# Run WebGPU preflight test
bun run packages/server/scripts/stream-to-rtmp.ts

# Look for:
# ✅ "WebGPU preflight PASSED"
# ❌ "WebGPU preflight FAILED"
```

### Visual Testing

All visual tests now require WebGPU:
```bash
npm test --workspace=packages/shared

# Tests will fail if WebGPU is unavailable
# Check test logs for WebGPU initialization errors
```

## FAQ

**Q: Can I use WebGL as a fallback?**
A: No. TSL shaders only work with WebGPU. There is no WebGL equivalent.

**Q: What if my users don't have WebGPU?**
A: They need to update their browser or use a supported browser. WebGPU is widely available (Chrome 113+, Edge 113+, Safari 18+).

**Q: Can I run Hyperscape in headless mode?**
A: No. WebGPU requires a display server (Xorg or Xvfb). Pure headless mode does not support WebGPU.

**Q: What about mobile devices?**
A: WebGPU is supported on iOS 18+ (Safari) and Android (Chrome 113+). Older devices are not supported.

**Q: Can I use software rendering?**
A: No. WebGPU requires hardware GPU rendering. Software renderers (SwiftShader, llvmpipe) do not support WebGPU.

**Q: What if deployment fails with "WebGPU preflight FAILED"?**
A: Check GPU access (`nvidia-smi`), Vulkan support (`vulkaninfo`), and display server (`xdpyinfo`). Deployment will not proceed without WebGPU.

## Support

- **WebGPU Issues**: Check [webgpureport.org](https://webgpureport.org) for browser compatibility
- **GPU Streaming**: See [AGENTS.md](../AGENTS.md) for Vast.ai deployment architecture
- **Development**: See [CLAUDE.md](../CLAUDE.md) for development guidelines
- **Bug Reports**: [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)

## Related Commits

- `47782ed` - Enforce WebGPU-only mode, remove all WebGL fallbacks
- `ff45217` - Add timeout to WebGPU initialization
- `d5c6884` - Add WebGPU diagnostics and preflight test
- `205f964` - Update WebGL references to WebGPU in client code
- `6fd626a` - Fix model cache index buffer type preservation

## References

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [TSL (Three Shading Language)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [WebGPU Browser Support](https://caniuse.com/webgpu)
