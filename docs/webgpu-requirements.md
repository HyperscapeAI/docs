# WebGPU Requirements

Hyperscape requires WebGPU for rendering. All shaders use TSL (Three.js Shading Language), which only works with WebGPU. WebGL fallback was removed in February 2026.

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

**Quick Test:**
```javascript
// Open browser console (F12)
if (navigator.gpu) {
  console.log('✅ WebGPU supported');
} else {
  console.log('❌ WebGPU not supported');
}
```

## GPU Requirements

### Desktop GPUs

**NVIDIA:**
- GTX 1060 or newer
- Driver version 525.60.11+ (Linux) or 527.41+ (Windows)

**AMD:**
- RX 5700 or newer
- Driver version 23.1.1+ (Windows) or Mesa 23.0+ (Linux)

**Intel:**
- Arc A-series (dedicated)
- Iris Xe (integrated, 11th gen+)
- Driver version 31.0.101.4502+ (Windows)

### Mobile GPUs

**iOS:**
- iPhone 12 or newer (A14 Bionic+)
- iPad Pro 2020 or newer (A12Z+)
- iOS 18+ required

**Android:**
- Chrome 113+ with compatible GPU
- Snapdragon 888+ or equivalent
- Vulkan 1.1+ support required

## Error Handling

### User-Facing Error Screen

If WebGPU is unavailable, Hyperscape shows a user-friendly error screen:

```
WebGPU Not Supported

Hyperscape requires WebGPU for rendering.

Your browser or GPU does not support WebGPU.

Please use:
• Chrome 113+ or Edge 113+ (Windows/macOS/Linux)
• Safari 18+ (macOS 15+ only)

Check compatibility: webgpureport.org
```

**Implementation**: See `packages/shared/src/systems/client/ClientGraphics.ts`

### Developer Error Messages

**Console Errors:**
```
[ClientGraphics] WebGPU not available - cannot initialize renderer
[ClientGraphics] All shaders use TSL which requires WebGPU
[ClientGraphics] Visit webgpureport.org to check browser/GPU support
```

**Thrown Error:**
```typescript
throw new Error(
  'WebGPU is required but not available. ' +
  'Please use Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+). ' +
  'Visit webgpureport.org to check compatibility.'
);
```

## Headless/Server Rendering

For streaming and testing, Hyperscape uses headless Chrome with GPU acceleration.

### Requirements

**System Packages:**
```bash
# Vulkan drivers (required for GPU rendering)
apt-get install -y \
    mesa-vulkan-drivers \
    vulkan-tools \
    libvulkan1

# Chrome Dev channel (WebGPU enabled by default)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update && apt-get install -y google-chrome-unstable

# Xvfb (virtual display)
apt-get install -y xvfb

# Playwright
bunx playwright install chromium
bunx playwright install-deps chromium
```

### Environment Variables

```bash
# Use Chrome Dev channel
STREAM_CAPTURE_CHANNEL=chrome-dev

# Use Vulkan ANGLE backend
STREAM_CAPTURE_ANGLE=vulkan

# Run headful with Xvfb
STREAM_CAPTURE_HEADLESS=false
DUEL_CAPTURE_USE_XVFB=true

# Enable WebGPU (required)
STREAM_CAPTURE_DISABLE_WEBGPU=false
```

### Verify GPU Access

```bash
# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Test Chrome WebGPU
google-chrome-unstable --headless --disable-gpu-sandbox \
  --enable-features=Vulkan \
  --use-angle=vulkan \
  --enable-unsafe-webgpu \
  --no-sandbox \
  about:blank
```

## Why WebGPU?

### TSL Shaders

Hyperscape uses TSL (Three.js Shading Language) for all materials:
- **Procedural terrain** - GPU-computed noise and biome blending
- **Procedural grass** - Instanced with wind animation
- **Fire particles** - Value noise with turbulent motion
- **Arena materials** - Sandstone block patterns with mortar
- **Water** - Animated normals and reflections

**TSL requires WebGPU** - it compiles to WGSL (WebGPU Shading Language), not GLSL.

### Performance Benefits

WebGPU provides:
- **Compute shaders** - Terrain generation, grass culling, particle updates
- **Storage buffers** - Efficient large data transfers
- **Indirect drawing** - GPU-driven rendering without CPU readback
- **Modern API** - Lower overhead than WebGL

### Rendering Features

WebGPU enables:
- **InstancedMesh** - 97% draw call reduction in duel arenas
- **GPU particles** - 896 fire particles with zero CPU cost
- **Procedural materials** - All textures generated on GPU
- **Post-processing** - Bloom, color grading, depth of field

## Migration from WebGL

**Breaking Change (February 2026)**: WebGL fallback removed.

**Before:**
```typescript
// Old code had WebGL fallback
const renderer = isWebGPUAvailable 
  ? new WebGPURenderer() 
  : new WebGLRenderer();
```

**After:**
```typescript
// New code requires WebGPU
if (!navigator.gpu) {
  throw new Error('WebGPU required');
}
const renderer = new WebGPURenderer();
```

**Impact**: Users on old browsers (Chrome <113, Safari <18) can no longer play. They see the WebGPU error screen.

## Troubleshooting

### "WebGPU not available" Error

**Symptom**: Error screen on game load

**Solutions**:
1. Update browser to Chrome 113+, Edge 113+, or Safari 18+
2. Enable WebGPU in browser flags (if experimental)
3. Update GPU drivers
4. Check GPU compatibility at [webgpureport.org](https://webgpureport.org)

### Black Screen After Loading

**Symptom**: Game loads but shows black screen

**Causes**:
1. WebGPU initialized but shader compilation failed
2. GPU out of memory
3. Unsupported GPU features

**Solutions**:
```bash
# Check browser console for errors
F12 → Console

# Look for:
# - "Failed to create WebGPU device"
# - "Shader compilation error"
# - "Out of memory"

# Try reducing graphics settings
# (if settings panel is accessible)
```

### Headless Rendering Fails

**Symptom**: Stream shows black screen or crashes

**Solutions**:
```bash
# Verify Vulkan
vulkaninfo --summary

# Check Xvfb
ps aux | grep Xvfb

# Test Chrome WebGPU
google-chrome-unstable --version
google-chrome-unstable --headless --enable-unsafe-webgpu about:blank

# Check logs
bunx pm2 logs hyperscape-duel | grep -i webgpu
```

## See Also

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Can I Use WebGPU](https://caniuse.com/webgpu)
- [docs/vast-deployment.md](vast-deployment.md) - Headless rendering setup
