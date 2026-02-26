# WebGPU Requirements

Hyperscape requires **WebGPU** for rendering. All shaders use Three.js Shading Language (TSL), which only works with WebGPU. WebGL fallback has been removed.

## Why WebGPU?

- **Modern GPU features**: Compute shaders, storage buffers, better performance
- **TSL shaders**: All Hyperscape shaders (grass, fire particles, water, etc.) use TSL
- **Future-proof**: WebGPU is the future of web graphics
- **Better performance**: Lower overhead, more efficient GPU utilization

## Browser Support

### ✅ Supported Browsers

| Browser | Minimum Version | Platform | Notes |
|---------|----------------|----------|-------|
| **Chrome** | 113+ | Windows, macOS, Linux | Recommended |
| **Edge** | 113+ | Windows, macOS, Linux | Recommended |
| **Safari** | 18+ | macOS 15+ only | Limited support |

### ❌ Unsupported Browsers

| Browser | Status | Workaround |
|---------|--------|------------|
| **Firefox** | Experimental | Use Chrome or Edge |
| **Safari (older)** | No support | Update to macOS 15+ and Safari 18+ |
| **Mobile browsers** | Limited | Use desktop for best experience |

## Checking WebGPU Support

### Online Check

Visit [webgpureport.org](https://webgpureport.org) to verify your browser and GPU support WebGPU.

### In-Browser Check

Open your browser's developer console and run:

```javascript
if (navigator.gpu) {
  console.log('✅ WebGPU is supported');
  navigator.gpu.requestAdapter().then(adapter => {
    console.log('GPU:', adapter);
  });
} else {
  console.log('❌ WebGPU is not supported');
}
```

### Hyperscape Error Screen

If WebGPU is not available, Hyperscape shows a user-friendly error screen:

```
WebGPU Not Supported

Hyperscape requires WebGPU to run. Please use:
- Chrome 113+ or Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS 15+ only)

Check your browser support at: webgpureport.org
```

## GPU Requirements

### Minimum GPU

- **Desktop**: Any GPU with Vulkan or DirectX 12 support
- **Laptop**: Integrated graphics (Intel HD 620+, AMD Vega, Apple M1+)
- **Age**: GPUs from 2016 or newer

### Recommended GPU

- **Desktop**: NVIDIA GTX 1060 / AMD RX 580 or better
- **Laptop**: NVIDIA GTX 1650 / AMD RX 5500M or better
- **Apple**: M1 or newer

### Known Issues

**Intel HD Graphics (older):**
- Some older Intel integrated GPUs may have limited WebGPU support
- Update graphics drivers to the latest version
- Consider using a dedicated GPU if available

**AMD GPUs (Windows):**
- Ensure AMD Adrenalin drivers are up to date
- Some older AMD GPUs may have driver issues with WebGPU

**Safari on macOS:**
- Requires macOS 15 (Sequoia) or newer
- Older macOS versions do not support WebGPU in Safari
- Use Chrome or Edge on older macOS versions

## Enabling WebGPU

### Chrome/Edge

WebGPU is enabled by default in Chrome 113+ and Edge 113+.

If disabled, enable it manually:
1. Navigate to `chrome://flags` (or `edge://flags`)
2. Search for "WebGPU"
3. Enable "Unsafe WebGPU" (for development only)
4. Restart browser

### Safari

WebGPU is enabled by default in Safari 18+ on macOS 15+.

If disabled, enable it manually:
1. Safari → Settings → Advanced
2. Check "Show Develop menu in menu bar"
3. Develop → Experimental Features → WebGPU
4. Restart Safari

### Firefox (Experimental)

WebGPU support in Firefox is experimental and not recommended:
1. Navigate to `about:config`
2. Search for `dom.webgpu.enabled`
3. Set to `true`
4. Restart Firefox

**Note**: Firefox WebGPU support is incomplete and may not work with Hyperscape.

## Headless Rendering (Server-Side)

For streaming and server-side rendering, Hyperscape uses:

- **Chrome Dev Channel**: Latest WebGPU features
- **Xvfb**: Virtual framebuffer for headless rendering
- **Vulkan drivers**: GPU acceleration on Linux
- **SwiftShader**: Software rendering fallback (slower)

See [Vast.ai Deployment Guide](vast-deployment.md) for server-side setup.

## Troubleshooting

### "WebGPU not supported" error

**Check browser version:**
```bash
# Chrome/Edge
chrome://version
edge://version

# Safari
Safari → About Safari
```

**Update browser:**
- Chrome: [google.com/chrome](https://www.google.com/chrome/)
- Edge: [microsoft.com/edge](https://www.microsoft.com/edge/)
- Safari: Update macOS to 15+ via System Settings

### WebGPU available but Hyperscape won't load

**Check GPU drivers:**
- NVIDIA: [nvidia.com/drivers](https://www.nvidia.com/drivers)
- AMD: [amd.com/support](https://www.amd.com/support)
- Intel: [intel.com/content/www/us/en/download-center](https://www.intel.com/content/www/us/en/download-center)

**Check browser console:**
1. Open Developer Tools (F12)
2. Check Console tab for errors
3. Look for WebGPU-related errors

**Try incognito/private mode:**
- Browser extensions may interfere with WebGPU
- Test in incognito mode to rule out extensions

### Performance issues

**Check GPU usage:**
- Open Task Manager (Windows) or Activity Monitor (macOS)
- Check GPU usage while running Hyperscape
- If GPU usage is low, check power settings

**Reduce graphics settings:**
- Lower resolution
- Disable shadows or post-processing (if available)
- Close other GPU-intensive applications

**Check thermal throttling:**
- Ensure laptop is plugged in (not on battery)
- Check CPU/GPU temperatures
- Clean dust from vents if overheating

## Development Notes

### Enforcing WebGPU

Hyperscape enforces WebGPU in `ClientGraphics.ts`:

```typescript
if (!this.renderer.capabilities.isWebGPU) {
  throw new Error('WebGPU is required but not available');
}
```

### TSL Shaders

All shaders use Three.js Shading Language (TSL):
- `ProceduralGrass.ts` - Grass rendering
- `FireParticles.ts` - Fire particle system
- `WaterShader.ts` - Water rendering
- `TeleportVFX.ts` - Teleport effects

TSL shaders are compiled to WGSL (WebGPU Shading Language) at runtime.

### WebGL Fallback Removed

The WebGL fallback was removed in commit `aa4d11d`:
- Reason: All shaders use TSL, which requires WebGPU
- Impact: WebGL-only browsers cannot run Hyperscape
- Alternative: Use Chrome/Edge 113+ or Safari 18+

## See Also

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WebGPU Browser Support](https://caniuse.com/webgpu)
- [Vast.ai Deployment Guide](vast-deployment.md) - Server-side WebGPU setup
