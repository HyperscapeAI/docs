# WebGPU Requirements

Hyperscape requires WebGPU for rendering. All shaders use Three.js Shading Language (TSL), which only works with WebGPU. WebGL fallback has been removed.

## Why WebGPU is Required

**All rendering uses TSL shaders:**
- Terrain rendering (procedural noise, biome blending)
- Vegetation (grass, trees, flowers with GPU instancing)
- Fire particles (emissive materials, turbulent motion)
- Water (reflections, refractions, caustics)
- Post-processing (bloom, color grading, fog)

**TSL only compiles to WebGPU** - there is no WebGL backend.

## Browser Compatibility

### Supported Browsers

| Browser | Minimum Version | Platform | Notes |
|---------|----------------|----------|-------|
| **Chrome** | 113+ | Windows, macOS, Linux | ✅ Recommended |
| **Edge** | 113+ | Windows, macOS, Linux | ✅ Recommended |
| **Safari** | 18+ | macOS 15+ only | ⚠️ macOS 15+ required |
| **Firefox** | Experimental | All | ❌ Not recommended |

### Check Your Browser

Visit [webgpureport.org](https://webgpureport.org) to verify WebGPU support.

Or check manually:
```javascript
// Open browser console (F12)
if (navigator.gpu) {
  console.log('✅ WebGPU is supported');
  navigator.gpu.requestAdapter().then(adapter => {
    console.log('Adapter:', adapter);
  });
} else {
  console.log('❌ WebGPU is not supported');
}
```

## GPU Requirements

### Minimum Requirements

- **GPU**: Any GPU with Vulkan 1.1+ or Metal 2+ support
- **VRAM**: 2GB+ recommended
- **Drivers**: Up-to-date graphics drivers

### Recommended GPUs

**Desktop:**
- NVIDIA GTX 1060 or newer
- AMD RX 580 or newer
- Intel Arc A380 or newer

**Laptop:**
- NVIDIA GTX 1650 or newer
- AMD RX 5500M or newer
- Intel Iris Xe or newer

**macOS:**
- M1/M2/M3 (Apple Silicon) - ✅ Excellent
- Intel Macs with Metal 2+ - ⚠️ Requires macOS 15+

### Integrated Graphics

Most modern integrated GPUs work:
- **Intel**: Iris Xe (11th gen+), UHD Graphics 770 (12th gen+)
- **AMD**: Radeon Vega (Ryzen 2000+)
- **Apple**: M1/M2/M3 integrated GPU

## Platform-Specific Notes

### Windows

**Chrome/Edge 113+** with up-to-date NVIDIA/AMD drivers.

**Enable WebGPU** (usually enabled by default):
1. Visit `chrome://flags`
2. Search for "WebGPU"
3. Enable "Unsafe WebGPU" (if needed)
4. Restart browser

### macOS

**Safari 18+** requires **macOS 15 (Sequoia)** or later.

**Chrome/Edge 113+** works on macOS 12+ with Metal 2+ GPUs.

**Apple Silicon (M1/M2/M3)**: Excellent WebGPU support in all browsers.

### Linux

**Chrome/Edge 113+** with Vulkan 1.1+ drivers.

**Install Vulkan drivers**:
```bash
# Ubuntu/Debian
sudo apt-get install mesa-vulkan-drivers vulkan-tools

# Verify Vulkan
vulkaninfo | head -20
```

**NVIDIA GPUs**: Install proprietary drivers for best performance:
```bash
sudo ubuntu-drivers autoinstall
```

## Error Handling

### WebGPU Not Available

If WebGPU is not available, Hyperscape shows a user-friendly error screen:

```
WebGPU Not Supported

Hyperscape requires WebGPU for rendering.

Your browser or GPU does not support WebGPU.

Please use:
- Chrome 113+ or Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS 15+ only)

Check compatibility: webgpureport.org
```

**No fallback rendering** - the game will not run without WebGPU.

### Why No WebGL Fallback?

Previous attempts to support WebGL fallback failed because:
1. **TSL shaders don't compile to WebGL** - would require rewriting all shaders
2. **Performance degradation** - WebGL lacks compute shaders, storage buffers, and other features
3. **Maintenance burden** - maintaining two rendering pipelines doubles complexity
4. **WebGPU adoption** - Chrome/Edge 113+ (May 2023) have >90% market share

## Headless Rendering (Server-Side)

### Vast.ai Deployment

The Vast.ai deployment uses headless Chrome with WebGPU for stream capture:

**Configuration:**
```bash
STREAM_CAPTURE_CHANNEL=chrome-dev  # google-chrome-unstable
STREAM_CAPTURE_ANGLE=vulkan        # Vulkan ANGLE backend
STREAM_CAPTURE_HEADLESS=false      # Use Xvfb for GPU access
DUEL_CAPTURE_USE_XVFB=true         # Virtual display
```

**Requirements:**
- NVIDIA GPU with Vulkan 1.1+ support
- Vulkan drivers installed
- Chrome Dev channel (google-chrome-unstable)
- Xvfb for virtual display

See [docs/vast-deployment.md](docs/vast-deployment.md) for full setup.

### Docker

WebGPU in Docker requires:
- GPU passthrough (`--gpus all`)
- Vulkan drivers in container
- X11 or Xvfb for display

**Not recommended** - use Vast.ai or bare metal for GPU rendering.

## Testing WebGPU Support

### Browser Test

```javascript
// Check WebGPU availability
async function testWebGPU() {
  if (!navigator.gpu) {
    console.error('WebGPU not supported');
    return;
  }
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error('No WebGPU adapter found');
    return;
  }
  
  console.log('✅ WebGPU is supported');
  console.log('Adapter:', adapter);
  
  const device = await adapter.requestDevice();
  console.log('Device:', device);
  console.log('Limits:', device.limits);
}

testWebGPU();
```

### Feature Detection

Hyperscape checks for WebGPU on startup:

```typescript
// packages/shared/src/systems/client/ClientGraphics.ts
if (!navigator.gpu) {
  throw new Error('WebGPU is not supported. Please use Chrome 113+ or Edge 113+.');
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error('No WebGPU adapter found. Please update your graphics drivers.');
}
```

## Migration from WebGL

**Breaking change** (commit `3bc59db`): WebGL fallback removed.

**Impact:**
- Users on old browsers (Chrome <113) cannot play
- Users without WebGPU-capable GPUs cannot play
- Error screen shown instead of degraded experience

**Rationale:**
- TSL shaders require WebGPU (no WebGL compilation)
- WebGPU adoption is high enough (Chrome 113+ = May 2023)
- Maintaining two rendering pipelines is not sustainable

## Future Considerations

### WebGPU Adoption

As of February 2026:
- **Chrome/Edge**: 113+ (May 2023) - ~95% of users
- **Safari**: 18+ (September 2024) - macOS 15+ only
- **Firefox**: Experimental - not recommended

### Mobile Support

**iOS**: Safari 18+ on iOS 18+ (September 2024)
- iPhone 12 and newer
- iPad Pro 2020 and newer

**Android**: Chrome 113+ (May 2023)
- Most devices with Vulkan 1.1+ support
- Requires Android 10+ with compatible GPU

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Headless WebGPU rendering
- [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md) - Client deployment
- [packages/shared/src/systems/client/ClientGraphics.ts](../packages/shared/src/systems/client/ClientGraphics.ts) - WebGPU initialization
- [packages/shared/src/utils/rendering/RendererFactory.ts](../packages/shared/src/utils/rendering/RendererFactory.ts) - Renderer creation
