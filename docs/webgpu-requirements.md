# WebGPU Requirements

Hyperscape requires WebGPU for rendering. This document explains why, what's required, and how to verify support.

## Why WebGPU is Required

### TSL Shaders

All materials in Hyperscape use **TSL (Three Shading Language)**, which is Three.js's node-based shader system. TSL only works with the WebGPU rendering backend.

**Examples of TSL usage**:
- Terrain shaders (height-based blending, triplanar mapping)
- Water shaders (reflections, refractions, foam)
- Vegetation shaders (wind animation, LOD transitions)
- Post-processing (bloom, tone mapping, color grading)
- Impostor materials (octahedral impostors for distant objects)

### No WebGL Fallback

**BREAKING CHANGE (Commit 47782ed)**: All WebGL fallback code was removed.

**Removed**:
- `RendererFactory.ts` - WebGL detection and fallback logic
- `isWebGLForced`, `isWebGLFallbackForced`, `isWebGLFallbackAllowed` flags
- `isWebGLAvailable`, `isOffscreenCanvasAvailable`, `canTransferCanvas` checks
- `UniversalRenderer` type (now only `WebGPURenderer`)
- `forceWebGL` and `disableWebGPU` URL parameters
- `STREAM_CAPTURE_DISABLE_WEBGPU` environment variable
- `DUEL_FORCE_WEBGL_FALLBACK` configuration option

**Why removed**:
- TSL shaders don't compile to WebGL
- Maintaining two rendering paths was causing bugs
- WebGPU is now widely supported (Chrome 113+, Edge 113+, Safari 18+)
- Simplifies codebase and reduces maintenance burden

## Browser Requirements

### Desktop

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 113+ | ✅ Recommended |
| Edge | 113+ | ✅ Recommended |
| Safari | 18+ | ⚠️ Requires macOS 15+ |
| Firefox | Nightly | ⚠️ Behind flag, not recommended |

### Mobile

| Platform | Browser | Notes |
|----------|---------|-------|
| iOS | Safari 18+ | Requires iOS 18+ |
| Android | Chrome 113+ | Most Android devices |

### Verification

Check your browser/GPU support at: **[webgpureport.org](https://webgpureport.org)**

Or check `chrome://gpu` in Chrome/Edge:
- Look for "WebGPU: Hardware accelerated"
- Verify "WebGPU Status" shows enabled features

## Server/Streaming Requirements

### GPU Hardware

**Required**:
- NVIDIA GPU with Vulkan support
- CUDA capability 3.5+ (most GPUs from 2014+)
- Minimum 2GB VRAM (4GB+ recommended)

**Verify**:
```bash
# Check GPU
nvidia-smi

# Check Vulkan support
vulkaninfo --summary

# Check CUDA version
nvcc --version
```

### Software Stack

**Required packages**:
```bash
# NVIDIA drivers
nvidia-driver-XXX              # Match your GPU
nvidia-utils

# Vulkan
mesa-vulkan-drivers
vulkan-tools
libvulkan1

# X Server (for display protocol)
xserver-xorg-core              # For Xorg
xvfb                           # For Xvfb fallback
x11-xserver-utils              # xdpyinfo, etc.

# Chrome
google-chrome-unstable         # Chrome Dev channel
```

### Display Server Setup

Hyperscape streaming requires a display server (Xorg or Xvfb) for Chrome to access WebGPU.

#### Option 1: Xorg with NVIDIA (Preferred)

**Requirements**:
- DRI/DRM device access (`/dev/dri/card0`)
- NVIDIA X driver installed

**Configuration** (`/etc/X11/xorg-nvidia-headless.conf`):
```
Section "ServerLayout"
    Identifier     "Layout0"
    Screen      0  "Screen0"
EndSection

Section "Device"
    Identifier     "Device0"
    Driver         "nvidia"
    BusID          "PCI:X:Y:Z"                    # Auto-detected from nvidia-smi
    Option         "AllowEmptyInitialConfiguration" "True"
    Option         "UseDisplayDevice" "None"
EndSection

Section "Screen"
    Identifier     "Screen0"
    Device         "Device0"
    DefaultDepth    24
    SubSection     "Display"
        Depth       24
        Virtual    1920 1080
    EndSubSection
EndSection
```

**Start Xorg**:
```bash
Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf -noreset &
export DISPLAY=:99
```

**Verify**:
```bash
xdpyinfo -display :99
glxinfo -display :99 | grep "OpenGL renderer"  # Should show NVIDIA GPU
```

#### Option 2: Xvfb with NVIDIA Vulkan (Fallback)

**When to use**:
- Container without DRM device access
- Xorg fails to initialize NVIDIA driver

**How it works**:
- Xvfb provides X11 protocol (virtual framebuffer)
- Chrome uses NVIDIA GPU via ANGLE/Vulkan (not the framebuffer)
- CDP captures frames from Chrome's internal GPU rendering

**Start Xvfb**:
```bash
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99
export DUEL_CAPTURE_USE_XVFB=true
```

**Verify**:
```bash
xdpyinfo -display :99
# Chrome will use Vulkan directly, not the Xvfb framebuffer
```

### Vulkan Configuration

**Force NVIDIA ICD** (avoid Mesa conflicts):
```bash
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

**Why this is needed**:
- Some containers have broken Mesa Vulkan ICDs
- Mesa ICDs can conflict with NVIDIA drivers
- Forcing NVIDIA-only ICD ensures consistent behavior

**Verify Vulkan**:
```bash
vulkaninfo --summary
# Should show NVIDIA GPU, not llvmpipe/lavapipe
```

## Chrome Configuration

### Launch Arguments

Chrome must be launched with specific flags for WebGPU:

```bash
# WebGPU essentials
--enable-unsafe-webgpu
--enable-features=Vulkan,UseSkiaRenderer,WebGPU
--ignore-gpu-blocklist
--enable-gpu-rasterization

# ANGLE/Vulkan backend
--use-gl=angle
--use-angle=vulkan

# Headless mode (if using Xvfb)
--headless=new                 # Chrome's new headless mode with GPU support

# Sandbox & stability
--no-sandbox
--disable-dev-shm-usage
--disable-web-security
```

### Playwright Configuration

```typescript
const browser = await chromium.launch({
  headless: false,              // Must be false for Xorg/Xvfb
  channel: 'chrome-dev',        // Use Chrome Dev channel
  args: [
    '--use-gl=angle',
    '--use-angle=vulkan',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer,WebGPU',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
  env: {
    DISPLAY: ':99',
    VK_ICD_FILENAMES: '/usr/share/vulkan/icd.d/nvidia_icd.json',
  },
});
```

## Troubleshooting

### "WebGPU not supported" Error

**Cause**: Chrome cannot access WebGPU API

**Solutions**:
1. Verify browser version: `google-chrome-unstable --version` (should be 113+)
2. Check `chrome://gpu` - WebGPU should show "Hardware accelerated"
3. Verify Vulkan works: `vulkaninfo --summary`
4. Check display server: `xdpyinfo -display $DISPLAY`
5. Verify `VK_ICD_FILENAMES` is set correctly

### Black Screen / No Rendering

**Cause**: WebGPU initialized but rendering failed

**Solutions**:
1. Check browser console for WebGPU errors
2. Verify shaders compiled: Look for TSL compilation errors
3. Check GPU memory: `nvidia-smi` (should have free VRAM)
4. Verify display server is using GPU: `glxinfo | grep renderer`

### Xorg Falls Back to Software Rendering

**Symptoms**:
- Xorg starts but uses swrast (software rendering)
- `/var/log/Xorg.99.log` shows "IGLX: Loaded and initialized swrast"

**Cause**: NVIDIA driver failed to initialize

**Solutions**:
1. Check NVIDIA driver is installed: `nvidia-smi`
2. Verify DRI devices exist: `ls -la /dev/dri/`
3. Check Xorg config has correct BusID
4. Review Xorg errors: `grep "(EE)" /var/log/Xorg.99.log`
5. Try Xvfb fallback instead

### Vulkan Initialization Failed

**Symptoms**:
- `vulkaninfo` fails or shows no devices
- Chrome shows "Vulkan: Disabled"

**Cause**: Vulkan ICD not found or broken

**Solutions**:
1. Install Vulkan packages: `apt install mesa-vulkan-drivers vulkan-tools libvulkan1`
2. Verify ICD file exists: `ls -la /usr/share/vulkan/icd.d/nvidia_icd.json`
3. Check ICD points to valid library: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
4. Force NVIDIA ICD: `export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json`

## Deployment Checklist

Before deploying to a GPU server (Vast.ai, etc.):

- [ ] NVIDIA GPU with Vulkan support
- [ ] NVIDIA drivers installed (`nvidia-smi` works)
- [ ] Vulkan tools installed (`vulkaninfo` works)
- [ ] X server packages installed (Xorg or Xvfb)
- [ ] Chrome Dev channel installed (`google-chrome-unstable`)
- [ ] Display server starts successfully (`xdpyinfo -display :99`)
- [ ] Vulkan ICD configured (`VK_ICD_FILENAMES` set)
- [ ] WebGPU works in Chrome (`chrome://gpu` shows hardware accelerated)

## See Also

- [CLAUDE.md](../CLAUDE.md#critical-webgpu-required-no-webgl) - WebGPU development rules
- [AGENTS.md](../AGENTS.md#critical-webgpu-required-no-webgl) - AI assistant guidance
- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment with GPU setup
- [docs/streaming-configuration.md](streaming-configuration.md) - Streaming configuration reference
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script with GPU setup
