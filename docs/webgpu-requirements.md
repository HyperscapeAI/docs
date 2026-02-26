# WebGPU Requirements

Hyperscape requires **WebGPU** for 3D rendering. All shaders use Three.js Shading Language (TSL), which is WebGPU-only. WebGL is not supported.

## Browser Requirements

### Supported Browsers

| Browser | Minimum Version | WebGPU Support |
|---------|----------------|----------------|
| **Chrome** | 113+ | ✅ Enabled by default |
| **Edge** | 113+ | ✅ Enabled by default |
| **Firefox** | 121+ | ⚠️ Requires flag (see below) |
| **Safari** | 18+ (macOS 15+) | ✅ Enabled by default |
| **Opera** | 99+ | ✅ Enabled by default |

### Unsupported Browsers

- **Safari < 18** (macOS < 15) - No WebGPU support
- **Firefox < 121** - No WebGPU support
- **Mobile browsers** - Limited WebGPU support (varies by device)
- **Internet Explorer** - Not supported

## Enabling WebGPU

### Chrome/Edge (Recommended)

WebGPU is enabled by default in Chrome 113+ and Edge 113+. No configuration needed.

**Verify WebGPU is available:**

1. Open DevTools (F12)
2. Run in console:
   ```javascript
   navigator.gpu !== undefined
   ```
3. Should return `true`

### Firefox

WebGPU requires enabling a flag in Firefox 121+:

1. Navigate to `about:config`
2. Search for `dom.webgpu.enabled`
3. Set to `true`
4. Restart Firefox

**Note**: Firefox WebGPU support is experimental and may have rendering issues.

### Safari

WebGPU is available in Safari 18+ (macOS 15 Sequoia or later):

- **macOS 15+**: WebGPU enabled by default
- **macOS 14 or earlier**: Not supported (upgrade required)

## GPU Requirements

### Desktop

**Minimum:**
- **NVIDIA**: GTX 1060 (6GB VRAM) or newer
- **AMD**: RX 580 (8GB VRAM) or newer
- **Intel**: Arc A380 or newer

**Recommended:**
- **NVIDIA**: RTX 3060 (12GB VRAM) or newer
- **AMD**: RX 6700 XT (12GB VRAM) or newer
- **Intel**: Arc A770 (16GB VRAM) or newer

### Laptop

**Minimum:**
- **NVIDIA**: GTX 1650 (4GB VRAM) or newer
- **AMD**: RX 5500M (4GB VRAM) or newer
- **Intel**: Iris Xe Graphics (integrated)

**Recommended:**
- **NVIDIA**: RTX 3060 Mobile (6GB VRAM) or newer
- **AMD**: RX 6600M (8GB VRAM) or newer

### Integrated Graphics

**Supported:**
- Intel Iris Xe (11th gen or newer)
- AMD Radeon Graphics (Ryzen 5000+ series)
- Apple M1/M2/M3 (Safari only)

**Not Supported:**
- Intel HD Graphics (10th gen or older)
- AMD Vega Graphics (Ryzen 3000 series or older)

## Operating System Requirements

### Windows

- **Windows 10** (version 1903 or later) or **Windows 11**
- **DirectX 12** support required
- **Graphics drivers**: Latest from GPU manufacturer

### macOS

- **macOS 15 Sequoia** or later (for Safari WebGPU)
- **macOS 13+** with Chrome/Edge (WebGPU via Metal)
- **Apple Silicon** (M1/M2/M3) recommended for best performance

### Linux

- **Ubuntu 22.04+**, **Fedora 38+**, or equivalent
- **Vulkan 1.3+** support required
- **Mesa 23.0+** for AMD/Intel GPUs
- **NVIDIA drivers 525+** for NVIDIA GPUs

**Install Vulkan on Ubuntu:**

```bash
sudo apt-get update
sudo apt-get install -y mesa-vulkan-drivers vulkan-tools libvulkan1
```

**Verify Vulkan:**

```bash
vulkaninfo --summary
```

## Error Handling

### WebGPU Unavailable Error

If WebGPU is not available, Hyperscape shows a user-friendly error screen:

```
WebGPU Not Available

Hyperscape requires WebGPU for 3D rendering.

Your browser or GPU does not support WebGPU.

Please try:
• Update to Chrome 113+ or Edge 113+
• Update your graphics drivers
• Use a device with a modern GPU

For more information, visit:
https://github.com/HyperscapeAI/hyperscape/blob/main/docs/webgpu-requirements.md
```

### Common Error Messages

**"WebGPU is not supported in this browser"**
- **Cause**: Browser doesn't support WebGPU
- **Solution**: Update browser or switch to Chrome/Edge 113+

**"Failed to request GPU adapter"**
- **Cause**: GPU drivers outdated or incompatible
- **Solution**: Update graphics drivers from manufacturer

**"GPU adapter does not support required features"**
- **Cause**: GPU too old or missing required features
- **Solution**: Use a newer GPU (see minimum requirements above)

## Development

### Local Development

WebGPU works out-of-the-box in local development with Chrome/Edge:

```bash
bun run dev
# Open http://localhost:3333 in Chrome 113+
```

### Headless Rendering (Server-Side)

For server-side rendering (streaming, screenshots), use Chrome with Xvfb:

```bash
# Install dependencies
sudo apt-get install -y xvfb google-chrome-unstable mesa-vulkan-drivers

# Run with Xvfb
xvfb-run -a -s "-screen 0 1280x720x24" \
  google-chrome-unstable \
  --enable-features=Vulkan,UseSkiaRenderer \
  --use-angle=vulkan \
  --enable-unsafe-webgpu \
  --headless=new
```

**Environment variables for headless:**

```bash
STREAM_CAPTURE_HEADLESS=false  # Use Xvfb, not headless mode
STREAM_CAPTURE_CHANNEL=chrome-dev  # Use google-chrome-unstable
STREAM_CAPTURE_ANGLE=vulkan  # Use Vulkan backend
STREAM_CAPTURE_DISABLE_WEBGPU=false  # Enable WebGPU
```

### Testing WebGPU

Check if WebGPU is available in your environment:

```javascript
// Browser console
if (navigator.gpu) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  console.log('WebGPU available:', device);
} else {
  console.error('WebGPU not available');
}
```

## Performance Considerations

### VRAM Usage

Hyperscape uses approximately:

- **Minimum**: 2GB VRAM (low settings, small world)
- **Recommended**: 4GB VRAM (medium settings, full world)
- **High-end**: 8GB+ VRAM (high settings, multiple players)

### Frame Rate

Expected performance:

| GPU Tier | Resolution | FPS |
|----------|-----------|-----|
| Integrated (Iris Xe) | 1280x720 | 30-45 |
| Mid-range (RTX 3060) | 1920x1080 | 60-90 |
| High-end (RTX 4080) | 2560x1440 | 90-120 |

### Optimization Tips

1. **Lower resolution** if FPS is low
2. **Disable shadows** in settings (if available)
3. **Reduce view distance** to decrease draw calls
4. **Close other GPU-intensive applications**

## Why WebGPU Only?

Hyperscape uses WebGPU exclusively because:

1. **TSL Shaders**: All shaders use Three.js Shading Language, which compiles to WGSL (WebGPU Shading Language)
2. **Compute Shaders**: Terrain generation, grass rendering, and particle systems use GPU compute
3. **Modern Features**: WebGPU provides better performance and features than WebGL
4. **Future-proof**: WebGPU is the future of web graphics

**No WebGL fallback** is provided because TSL shaders cannot run on WebGL.

## Browser Compatibility Table

| Feature | Chrome 113+ | Firefox 121+ | Safari 18+ | Edge 113+ |
|---------|-------------|--------------|------------|-----------|
| WebGPU API | ✅ | ⚠️ Flag required | ✅ | ✅ |
| Compute Shaders | ✅ | ⚠️ Limited | ✅ | ✅ |
| TSL Shaders | ✅ | ⚠️ Experimental | ✅ | ✅ |
| Texture Arrays | ✅ | ⚠️ Limited | ✅ | ✅ |
| **Recommended** | ✅ **Yes** | ❌ No | ✅ **Yes** | ✅ **Yes** |

## Troubleshooting

### Black Screen on Load

**Cause**: WebGPU initialization failed

**Solutions**:
1. Check browser console for WebGPU errors
2. Update graphics drivers
3. Try Chrome/Edge instead of Firefox
4. Verify GPU meets minimum requirements

### "WebGPU adapter request failed"

**Cause**: GPU doesn't support required features

**Solutions**:
1. Update graphics drivers to latest version
2. Check if GPU supports Vulkan 1.3+ (Linux) or DirectX 12 (Windows)
3. Try a different browser (Chrome recommended)

### Poor Performance

**Cause**: GPU under minimum requirements or drivers outdated

**Solutions**:
1. Lower resolution in browser (zoom out)
2. Update graphics drivers
3. Close other GPU-intensive applications
4. Use a device with a more powerful GPU

## Related Documentation

- [Vast.ai Deployment](./vast-deployment.md) - Server-side WebGPU rendering
- [README.md](../README.md) - Quick start guide
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
