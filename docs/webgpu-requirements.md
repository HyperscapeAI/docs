# WebGPU Requirements

As of February 2026, Hyperscape **requires WebGPU** for rendering. All shaders use TSL (Three.js Shading Language), which is WebGPU-only. WebGL fallback has been removed.

## Browser Compatibility

### Supported Browsers

| Browser | Minimum Version | Platform | Notes |
|---------|----------------|----------|-------|
| **Chrome** | 113+ | Windows, macOS, Linux | ✅ Recommended |
| **Edge** | 113+ | Windows, macOS, Linux | ✅ Recommended |
| **Safari** | 18+ | macOS 15+ only | ⚠️ Requires macOS Sequoia |
| **Firefox** | Experimental | All | ❌ Not recommended (unstable) |

### Check Your Browser

Visit [webgpureport.org](https://webgpureport.org) to verify WebGPU support.

## GPU Requirements

### Desktop

**Minimum:**
- NVIDIA GTX 1050 / AMD RX 560 / Intel UHD 630
- 2GB VRAM
- Vulkan 1.1+ or Metal 2+ support

**Recommended:**
- NVIDIA GTX 1660 / AMD RX 5600 / Intel Arc A380
- 4GB+ VRAM
- Vulkan 1.2+ or Metal 3+ support

### Mobile

**iOS:**
- iPhone 12 or newer (A14 Bionic+)
- iOS 18+ (Safari 18+)
- Metal 3 support

**Android:**
- Snapdragon 888+ or equivalent
- Android 12+ with Chrome 113+
- Vulkan 1.1+ support

## Headless/Server Rendering

For streaming and server-side rendering (Vast.ai, Docker):

### Chrome Dev Channel

Chrome Dev (google-chrome-unstable) has WebGPU enabled by default:

```bash
# Install Chrome Dev
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update && apt-get install -y google-chrome-unstable
```

### Vulkan Drivers

WebGPU on Linux requires Vulkan:

```bash
# Install Vulkan drivers
apt-get install -y mesa-vulkan-drivers vulkan-tools libvulkan1

# Verify installation
vulkaninfo --summary
```

### Xvfb (Headless Display)

For headless environments:

```bash
# Install Xvfb
apt-get install -y xvfb

# Start virtual display
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
```

### Environment Configuration

```bash
# Use Chrome Dev channel
STREAM_CAPTURE_CHANNEL=chrome-dev

# Use Vulkan ANGLE backend
STREAM_CAPTURE_ANGLE=vulkan

# Enable WebGPU (required)
STREAM_CAPTURE_DISABLE_WEBGPU=false

# Use Xvfb for headless
DUEL_CAPTURE_USE_XVFB=true
```

## Error Messages

### "WebGPU not supported"

**Cause:** Browser doesn't support WebGPU or GPU is incompatible.

**Solutions:**
1. Update to Chrome 113+ or Edge 113+
2. Enable hardware acceleration in browser settings
3. Update GPU drivers
4. Check [webgpureport.org](https://webgpureport.org) for compatibility

### "Failed to create WebGPU adapter"

**Cause:** GPU doesn't meet minimum requirements or drivers are outdated.

**Solutions:**
1. Update GPU drivers
2. Check GPU meets minimum requirements
3. Verify Vulkan/Metal support:
   - Linux: `vulkaninfo --summary`
   - macOS: Check Metal support in System Information
   - Windows: Update DirectX and GPU drivers

### "requiredLimits not supported"

**Cause:** GPU doesn't support required texture array layers (2048).

**Solution:** The renderer now uses best-effort limits. If this error persists, your GPU is below minimum requirements.

## Why WebGPU?

### Performance Benefits

- **GPU compute shaders** - Terrain generation, particle systems, culling
- **Instanced rendering** - 97% reduction in draw calls for arena meshes
- **TSL materials** - Shader node graphs with automatic optimization
- **Better memory management** - Explicit resource lifetime control

### Technical Requirements

All Hyperscape shaders use TSL (Three.js Shading Language):
- `ProceduralGrass.ts` - GPU-driven grass rendering
- `TerrainShader.ts` - Procedural terrain with triplanar mapping
- `LeafMaterialTSL.ts` - Vegetation with wind animation
- `BuildingMaterialTSL.ts` - Instanced building rendering
- Fire particles, water, sky, and all VFX

TSL compiles to WGSL (WebGPU Shading Language) and cannot run on WebGL.

## Migration from WebGL

If you have old code expecting WebGL:

### Removed Features

- `RendererFactory` WebGL fallback removed
- `?forceWebGL=1` query parameter removed
- `?disableWebGPU=1` query parameter removed
- `STREAM_CAPTURE_DISABLE_WEBGPU=true` no longer disables WebGPU (only used for testing)

### Updated Code

**Before (WebGL fallback):**
```typescript
const renderer = await RendererFactory.create({
  canvas,
  preferWebGPU: true,
  fallbackToWebGL: true
});
```

**After (WebGPU only):**
```typescript
const renderer = await RendererFactory.create({
  canvas,
  // WebGPU is always used, no fallback
});
```

## Testing WebGPU Support

### Browser Console

```javascript
// Check WebGPU availability
if ('gpu' in navigator) {
  const adapter = await navigator.gpu.requestAdapter();
  console.log('WebGPU supported:', !!adapter);
  console.log('Adapter:', adapter);
} else {
  console.log('WebGPU not available');
}
```

### Playwright Tests

```typescript
// Check WebGPU in headless browser
const webgpuSupported = await page.evaluate(async () => {
  if (!('gpu' in navigator)) return false;
  const adapter = await navigator.gpu.requestAdapter();
  return !!adapter;
});

expect(webgpuSupported).toBe(true);
```

## Related Documentation

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [TSL (Three.js Shading Language)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
