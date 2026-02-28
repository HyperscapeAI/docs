# WebGPU Troubleshooting Guide

Hyperscape requires WebGPU for rendering. This guide helps diagnose and fix WebGPU-related issues.

## Quick Diagnostics

### Check WebGPU Availability

**Browser**:
1. Navigate to [webgpureport.org](https://webgpureport.org)
2. Check if WebGPU is supported
3. Review adapter info and feature flags

**Console**:
```javascript
// In browser console
navigator.gpu ? 'WebGPU available' : 'WebGPU NOT available'

// Get adapter info
const adapter = await navigator.gpu.requestAdapter();
console.log(adapter);
```

**Chrome GPU Status**:
1. Navigate to `chrome://gpu`
2. Check "WebGPU" row - should show "Hardware accelerated"
3. Check "Vulkan" row - should show driver version
4. Review "Problems Detected" section

### Server/Streaming Diagnostics

**GPU Hardware**:
```bash
nvidia-smi  # Verify NVIDIA GPU is accessible
```

**Vulkan ICD**:
```bash
ls /usr/share/vulkan/icd.d/nvidia_icd.json  # Check ICD exists
cat /usr/share/vulkan/icd.d/nvidia_icd.json  # View ICD content
VK_LOADER_DEBUG=all vulkaninfo  # Test Vulkan loader
```

**Display Server**:
```bash
echo $DISPLAY  # Should be :0 (Xorg) or :99 (Xvfb)
xdpyinfo -display $DISPLAY  # Verify X server responds
```

**WebGPU Test**:
```bash
# Run preflight test
google-chrome-unstable --headless=new \
  --enable-unsafe-webgpu \
  --enable-features=WebGPU \
  --use-vulkan \
  --dump-dom about:blank
```

## Common Issues

### Issue: "WebGPU not supported"

**Symptoms**:
- Game shows error: "WebGPU is required but not available"
- Black screen on game load
- Console error: `navigator.gpu is undefined`

**Solutions**:

1. **Update Browser**:
   - Chrome/Edge: Update to 113+
   - Safari: Update to 18+ (requires macOS 15+)
   - Firefox: Not recommended (WebGPU behind flag)

2. **Enable WebGPU** (if disabled):
   - Chrome: Navigate to `chrome://flags/#enable-unsafe-webgpu`
   - Set to "Enabled"
   - Restart browser

3. **Update GPU Drivers**:
   - NVIDIA: Download latest drivers from nvidia.com
   - AMD: Download latest drivers from amd.com
   - Intel: Update via Windows Update or intel.com

4. **Check GPU Blocklist**:
   - Navigate to `chrome://gpu`
   - Check "Problems Detected" section
   - If GPU is blocklisted, use `--ignore-gpu-blocklist` flag

### Issue: WebGPU Initialization Hangs

**Symptoms**:
- Browser freezes on game load
- No error message, just infinite loading
- Console shows "Initializing WebGPU..." but never completes

**Solutions**:

1. **Check Timeouts** (should be automatic):
   - Adapter request timeout: 30s
   - Renderer init timeout: 60s
   - If hanging, these timeouts will trigger error

2. **Verify GPU Access**:
   ```bash
   nvidia-smi  # Should show GPU
   ```

3. **Check Vulkan**:
   ```bash
   vulkaninfo  # Should show Vulkan support
   ```

4. **Review GPU Diagnostics**:
   - Check `gpu-diagnostics.log` (created during deployment)
   - Look for "WebGPU: Disabled" or "Vulkan: Disabled"

5. **Try Different Display Mode**:
   ```bash
   # Try Xvfb instead of Xorg
   DISPLAY=:99
   DUEL_CAPTURE_USE_XVFB=true
   
   # Or try Ozone headless
   STREAM_CAPTURE_OZONE_HEADLESS=true
   DISPLAY=
   ```

### Issue: "GPU process crashed"

**Symptoms**:
- Browser crashes immediately on game load
- Console error: "GPU process crashed"
- Chrome shows "Aw, Snap!" error page

**Solutions**:

1. **GPU Sandbox Bypass** (containers only):
   ```bash
   # Add to Chrome flags
   --disable-gpu-sandbox
   --disable-setuid-sandbox
   ```

2. **Check GPU Memory**:
   ```bash
   nvidia-smi  # Check VRAM usage
   ```
   - If VRAM is full, restart browser or reduce resolution

3. **Update GPU Drivers**:
   - Outdated drivers can cause crashes
   - Download latest from nvidia.com

4. **Reduce Graphics Settings**:
   ```bash
   # Lower resolution
   STREAM_WIDTH=1280
   STREAM_HEIGHT=720
   ```

### Issue: WebGPU Works Locally but Not on Server

**Symptoms**:
- Game works on local machine
- Fails on Vast.ai or remote server
- Error: "WebGPU not available"

**Solutions**:

1. **Verify NVIDIA GPU**:
   ```bash
   nvidia-smi  # Must show NVIDIA GPU
   ```

2. **Check Vulkan ICD**:
   ```bash
   ls /usr/share/vulkan/icd.d/nvidia_icd.json
   ```
   - If missing, install: `apt install nvidia-vulkan-icd`

3. **Verify Display Server**:
   ```bash
   # For Xorg
   ps aux | grep Xorg
   xdpyinfo -display :0
   
   # For Xvfb
   ps aux | grep Xvfb
   xdpyinfo -display :99
   ```

4. **Check Chrome Executable**:
   ```bash
   # Verify Chrome is installed
   which google-chrome-unstable
   
   # Set explicit path
   STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
   ```

5. **Review Deployment Logs**:
   - Check `deploy-vast.sh` output
   - Look for "WebGPU preflight test: PASSED"
   - Review GPU diagnostics section

### Issue: Headless Mode Not Working

**Symptoms**:
- Error: "WebGPU requires a display"
- Headless Chrome shows black screen
- `navigator.gpu` is undefined in headless mode

**Solution**:
**DO NOT USE HEADLESS MODE** - WebGPU requires a display server.

Use one of these instead:
1. **Xorg**: Real X server (best performance)
2. **Xvfb**: Virtual framebuffer (good compatibility)
3. **Ozone Headless**: Experimental GPU mode (may work)

```bash
# Xorg mode
DISPLAY=:0
STREAM_CAPTURE_HEADLESS=false

# Xvfb mode
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
STREAM_CAPTURE_HEADLESS=false

# Ozone headless (experimental)
STREAM_CAPTURE_OZONE_HEADLESS=true
STREAM_CAPTURE_USE_EGL=false
DISPLAY=
```

### Issue: "Failed to create WebGPU adapter"

**Symptoms**:
- Error: "Failed to create WebGPU adapter"
- Timeout after 30s
- `navigator.gpu.requestAdapter()` returns null

**Solutions**:

1. **Check GPU Blocklist**:
   ```bash
   # Add to Chrome flags
   --ignore-gpu-blocklist
   ```

2. **Verify Vulkan**:
   ```bash
   vulkaninfo  # Should show Vulkan support
   VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json vulkaninfo
   ```

3. **Check GPU Permissions** (containers):
   ```bash
   # Verify GPU device access
   ls -l /dev/nvidia*
   ls -l /dev/dri/card*
   ```

4. **Try Different Backend**:
   ```bash
   # Force Vulkan backend
   --use-vulkan
   
   # Or try ANGLE
   --use-gl=angle --use-angle=vulkan
   ```

### Issue: "Renderer initialization timeout"

**Symptoms**:
- Error: "Renderer initialization timed out after 60s"
- Adapter created successfully
- `renderer.init()` never completes

**Solutions**:

1. **Check GPU Memory**:
   ```bash
   nvidia-smi  # Check VRAM usage
   ```
   - If VRAM is full, free up memory or use smaller resolution

2. **Verify Shader Compilation**:
   - TSL shaders compile on first use
   - May take longer on slow GPUs
   - Check Chrome console for shader errors

3. **Increase Timeout** (temporary):
   ```typescript
   // In RendererFactory.ts
   const RENDERER_INIT_TIMEOUT = 120000;  // 120s instead of 60s
   ```

4. **Check GPU Load**:
   ```bash
   nvidia-smi dmon  # Monitor GPU utilization
   ```
   - If GPU is at 100%, other processes may be blocking

## Browser-Specific Issues

### Chrome

**Issue**: WebGPU disabled by default
**Solution**: Enable at `chrome://flags/#enable-unsafe-webgpu`

**Issue**: GPU process crashes
**Solution**: Update to Chrome 113+ and latest GPU drivers

**Issue**: Vulkan not available
**Solution**: Install Vulkan runtime from nvidia.com

### Edge

**Issue**: Same as Chrome (Chromium-based)
**Solution**: Same as Chrome solutions

### Safari

**Issue**: WebGPU only on macOS 15+
**Solution**: Update to macOS 15+ and Safari 18+

**Issue**: Safari 17 not supported
**Reason**: Safari 17 WebGPU implementation has compatibility issues with TSL
**Solution**: Update to Safari 18+ (macOS 15+)

### Firefox

**Issue**: WebGPU behind flag
**Solution**: Not recommended - use Chrome/Edge instead

## Server/Container Issues

### Docker Containers

**Issue**: GPU not accessible in container
**Solution**: Use `--gpus all` flag:
```bash
docker run --gpus all ...
```

**Issue**: Vulkan not available
**Solution**: Install nvidia-container-toolkit:
```bash
apt install nvidia-container-toolkit
systemctl restart docker
```

### Vast.ai

**Issue**: DRI/DRM devices not accessible
**Solution**: Use Xvfb mode instead of Xorg:
```bash
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
```

**Issue**: Xorg fails with "no screens found"
**Solution**: Deployment script automatically falls back to Xvfb

**Issue**: WebGPU preflight test fails
**Solution**: Check deployment logs for specific error:
```bash
# SSH into Vast.ai instance
ssh -p $VAST_PORT root@$VAST_HOST

# Check logs
cat gpu-diagnostics.log
pm2 logs duel-stack --lines 100
```

## Performance Issues

### Low FPS with WebGPU

**Symptoms**:
- Game runs but FPS is low (<30)
- GPU utilization is low
- CPU utilization is high

**Solutions**:

1. **Check GPU Acceleration**:
   - Navigate to `chrome://gpu`
   - Verify "WebGPU: Hardware accelerated"
   - If "Software only", GPU is not being used

2. **Disable Software Rendering**:
   ```bash
   # Add to Chrome flags
   --disable-software-rasterizer
   ```

3. **Check Instanced Rendering**:
   - Verify instanced rendering is enabled
   - Check console for "pool full" warnings
   - Reduce unique model count

4. **Reduce Draw Calls**:
   - Use LOD models
   - Enable instanced rendering
   - Reduce visible entity count

### High Memory Usage

**Symptoms**:
- Browser uses >4GB RAM
- OOM crashes after extended play
- Memory usage grows over time

**Solutions**:

1. **Enable Browser Restart**:
   ```bash
   # Automatic restart every 45 minutes
   BROWSER_RESTART_INTERVAL_MS=2700000
   ```

2. **Check Memory Leaks**:
   - Review event listener cleanup
   - Verify geometry/material disposal
   - Check instance matrix updates

3. **Reduce Cache Size**:
   ```bash
   # Model cache
   MODEL_CACHE_MAX_SIZE=100
   
   # Texture cache
   TEXTURE_CACHE_MAX_SIZE=50
   ```

## Diagnostic Tools

### GPU Diagnostics Capture
```typescript
// Automatically captured during deployment
async function captureGpuDiagnostics(): Promise<string> {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU'],
  });
  
  const page = await browser.newPage();
  await page.goto('chrome://gpu');
  const content = await page.content();
  
  await browser.close();
  return content;
}
```

### WebGPU Preflight Test
```typescript
// Runs on blank page before game load
async function testWebGpuInit(): Promise<boolean> {
  const page = await browser.newPage();
  await page.goto('about:blank');
  
  const hasWebGPU = await page.evaluate(async () => {
    if (!navigator.gpu) return false;
    
    try {
      const adapter = await Promise.race([
        navigator.gpu.requestAdapter(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Adapter timeout')), 30000)
        ),
      ]);
      return !!adapter;
    } catch {
      return false;
    }
  });
  
  await page.close();
  return hasWebGPU;
}
```

### Manual Testing

**Test WebGPU in Browser**:
```javascript
// Open browser console
const adapter = await navigator.gpu.requestAdapter();
console.log('Adapter:', adapter);

const device = await adapter.requestDevice();
console.log('Device:', device);

// Test basic rendering
const canvas = document.createElement('canvas');
const context = canvas.getContext('webgpu');
console.log('Context:', context);
```

**Test Vulkan**:
```bash
# Check Vulkan support
vulkaninfo | grep -A 5 "Vulkan Instance"

# Check ICD loader
VK_LOADER_DEBUG=all vulkaninfo 2>&1 | grep -i "icd"

# List Vulkan devices
vulkaninfo | grep -A 10 "VkPhysicalDeviceProperties"
```

## Environment Variables Reference

### Display Configuration
```bash
# Xorg mode (best performance)
DISPLAY=:0
DUEL_CAPTURE_USE_XVFB=false
STREAM_CAPTURE_HEADLESS=false

# Xvfb mode (good compatibility)
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
STREAM_CAPTURE_HEADLESS=false

# Ozone headless (experimental)
STREAM_CAPTURE_OZONE_HEADLESS=true
STREAM_CAPTURE_USE_EGL=false
DISPLAY=
```

### Chrome Configuration
```bash
# Explicit Chrome path
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable

# Chrome flags (automatically added)
--enable-unsafe-webgpu
--enable-features=WebGPU
--use-vulkan
--ignore-gpu-blocklist
--disable-gpu-sandbox  # Containers only
--disable-setuid-sandbox  # Containers only
```

### Timeout Configuration
```bash
# Adapter request timeout (default: 30s)
WEBGPU_ADAPTER_TIMEOUT_MS=30000

# Renderer init timeout (default: 60s)
WEBGPU_RENDERER_TIMEOUT_MS=60000

# Page navigation timeout (default: 180s)
PAGE_NAVIGATION_TIMEOUT_MS=180000
```

## Platform-Specific Guides

### macOS

**Requirements**:
- macOS 15+ (for Safari 18)
- Metal-capable GPU
- Latest GPU drivers (via macOS update)

**Chrome Setup**:
```bash
# Install Chrome
brew install --cask google-chrome

# Verify WebGPU
open -a "Google Chrome" https://webgpureport.org
```

### Linux (Ubuntu/Debian)

**Requirements**:
- NVIDIA GPU with proprietary drivers
- Vulkan runtime installed
- X server or Xvfb

**Setup**:
```bash
# Install NVIDIA drivers
apt install nvidia-driver-535

# Install Vulkan
apt install nvidia-vulkan-icd vulkan-tools

# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb
apt install ./google-chrome-unstable_current_amd64.deb

# Install Xvfb (if needed)
apt install xvfb

# Verify
nvidia-smi
vulkaninfo
google-chrome-unstable --version
```

### Windows

**Requirements**:
- NVIDIA/AMD GPU with latest drivers
- Windows 10 20H1+ or Windows 11
- Chrome 113+

**Setup**:
1. Update GPU drivers from nvidia.com or amd.com
2. Install Chrome from google.com/chrome
3. Verify WebGPU at webgpureport.org

### Vast.ai

**Requirements**:
- NVIDIA GPU instance
- Ubuntu 20.04+ or Debian 11+
- SSH access

**Automated Setup**:
```bash
# Deployment script handles everything
./scripts/deploy-vast.sh
```

**Manual Setup**:
```bash
# Install dependencies
apt update
apt install -y nvidia-driver-535 nvidia-vulkan-icd vulkan-tools xvfb

# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-unstable_current_amd64.deb
apt install ./google-chrome-unstable_current_amd64.deb

# Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Test WebGPU
google-chrome-unstable --headless=new --enable-unsafe-webgpu \
  --enable-features=WebGPU --use-vulkan --dump-dom about:blank
```

## Advanced Debugging

### Enable Verbose Logging
```bash
# Chrome GPU logging
--enable-logging --v=1

# Vulkan loader debug
VK_LOADER_DEBUG=all

# WebGPU validation layers
--enable-dawn-features=enable_validation_layers
```

### Capture GPU Trace
```bash
# Chrome tracing
--trace-startup --trace-startup-file=gpu-trace.json

# Analyze trace
chrome://tracing
# Load gpu-trace.json
```

### Check GPU Capabilities
```javascript
// In browser console
const adapter = await navigator.gpu.requestAdapter();
const features = Array.from(adapter.features);
const limits = adapter.limits;

console.log('Features:', features);
console.log('Limits:', limits);
```

## Getting Help

### Information to Provide

When reporting WebGPU issues, include:

1. **Browser Info**:
   - Browser name and version
   - Operating system and version
   - GPU model and driver version

2. **chrome://gpu Output**:
   - Copy entire page content
   - Include "Problems Detected" section

3. **Console Errors**:
   - Any error messages in browser console
   - Network errors (if any)

4. **Diagnostic Logs** (server):
   - `gpu-diagnostics.log`
   - `pm2 logs duel-stack --lines 100`
   - `nvidia-smi` output

5. **Environment Variables**:
   - `DISPLAY`
   - `STREAM_CAPTURE_*` variables
   - `DUEL_CAPTURE_*` variables

### Support Channels

- GitHub Issues: [HyperscapeAI/hyperscape/issues](https://github.com/HyperscapeAI/hyperscape/issues)
- Discord: [Hyperscape Discord](https://discord.gg/hyperscape)
- Documentation: [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md)

## See Also

- [streaming-configuration.md](streaming-configuration.md) - Stream capture setup
- [vast-ai-deployment.md](vast-ai-deployment.md) - Vast.ai deployment guide
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [webgpureport.org](https://webgpureport.org) - WebGPU compatibility checker
