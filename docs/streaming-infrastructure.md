# Streaming Infrastructure

Comprehensive documentation for Hyperscape's WebGPU streaming infrastructure on Vast.ai GPU servers.

## Overview

Hyperscape supports live streaming of AI agent duels to Twitch, Kick, and X/Twitter using WebGPU rendering on NVIDIA GPU servers. The streaming pipeline captures browser output via Chrome DevTools Protocol and encodes to RTMP.

**Critical Requirements**:
- NVIDIA GPU with display driver support (`gpu_display_active=true`)
- Non-headless Chrome with Xorg or Xvfb
- WebGPU initialization (no fallbacks)
- Production client build (recommended)

## Architecture

### Components

**Stream Capture** (`packages/server/src/streaming/stream-capture.ts`):
- Launches Chrome with WebGPU flags
- Navigates to game URL
- Captures frames via CDP screencast
- Handles browser lifecycle and restarts

**RTMP Bridge** (`packages/server/src/streaming/rtmp-bridge.ts`):
- Receives frames from stream capture
- Encodes to H.264 via FFmpeg
- Multiplexes to multiple RTMP destinations
- Monitors stream health and bitrate

**Duel Stack** (`scripts/duel-stack.mjs`):
- Orchestrates game server + streaming bridge
- Manages display environment (Xorg/Xvfb)
- Configures audio capture (PulseAudio)
- Handles graceful shutdown

**Vast.ai Provisioner** (`scripts/vast-provision.sh`):
- Searches for GPU instances with display driver
- Filters by reliability, price, and specs
- Rents and configures instance
- Outputs SSH connection details

## Vast.ai Deployment

### GPU Requirements

**CRITICAL**: `gpu_display_active=true` is REQUIRED for WebGPU.

WebGPU requires GPU display driver support, not just compute access. Instances without display driver will fail WebGPU initialization.

**Minimum Specs**:
- GPU RAM: ≥20GB (RTX 4090, RTX 3090, RTX A6000, A100)
- Reliability: ≥95%
- Disk space: ≥120GB (for builds and assets)
- Price: ≤$2/hour (configurable)

### Provisioning Instance

**Automated Provisioning**:
```bash
./scripts/vast-provision.sh
```

This script:
1. Searches for instances with `gpu_display_active=true`
2. Filters by reliability, GPU RAM, price, disk space
3. Rents best available instance
4. Waits for instance to be ready
5. Outputs SSH connection details
6. Saves configuration to `/tmp/vast-instance-config.env`

**Manual Provisioning**:
```bash
# Search for instances
vastai search offers "gpu_display_active=true reliability>=0.95 gpu_ram>=20 disk_space>=120 dph<=2.0"

# Rent instance
vastai create instance OFFER_ID --image nvidia/cuda:12.2.0-devel-ubuntu22.04 --disk 100 --ssh

# Get SSH details
vastai show instance INSTANCE_ID
```

**Requirements**:
- Vast.ai CLI: `pip install vastai`
- API key: `vastai set api-key YOUR_API_KEY`

### Deployment Script

**Deploy to Vast.ai**:
```bash
# Trigger GitHub Actions workflow
gh workflow run deploy-vast.yml
```

**What it does**:
1. Verifies NVIDIA GPU is accessible (`nvidia-smi`)
2. Checks display driver support (nvidia_drm kernel module, /dev/dri/ device nodes)
3. Queries GPU display_mode via nvidia-smi
4. Checks Vulkan ICD availability (`/usr/share/vulkan/icd.d/nvidia_icd.json`)
5. Sets up display server (Xorg or Xvfb on :99)
6. Configures PulseAudio for audio capture
7. Runs 6 WebGPU pre-check tests with different Chrome configurations
8. Extracts Chrome GPU info (chrome://gpu diagnostics)
9. Starts game server + streaming bridge via PM2
10. Waits 60s for streaming bridge to initialize
11. Captures PM2 logs for diagnostics
12. Fails deployment if WebGPU cannot be initialized

**Deployment Validation**:
- Early display driver check with clear guidance on failure
- 6-stage WebGPU testing (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
- Verbose Chrome GPU logging (`--enable-logging=stderr --v=1`)
- PM2 log capture with crash loop detection
- Persists GPU/display settings to `.env` for PM2 restarts

## WebGPU Initialization

### Preflight Testing

**testWebGpuInit()** runs before loading game content:

```typescript
async function testWebGpuInit(page: Page): Promise<boolean> {
  // Navigate to localhost (secure context)
  await page.goto('http://localhost:3333');
  
  // Test WebGPU availability
  const result = await page.evaluate(async () => {
    if (!navigator.gpu) {
      return { success: false, error: 'navigator.gpu undefined' };
    }
    
    // Request adapter with 30s timeout
    const adapter = await Promise.race([
      navigator.gpu.requestAdapter(),
      new Promise((_, reject) => setTimeout(() => reject('Adapter timeout'), 30000)),
    ]);
    
    if (!adapter) {
      return { success: false, error: 'No adapter available' };
    }
    
    // Request device with 60s timeout
    const device = await Promise.race([
      adapter.requestDevice(),
      new Promise((_, reject) => setTimeout(() => reject('Device timeout'), 60000)),
    ]);
    
    return { success: true, adapter: adapter.info, device: device.label };
  });
  
  return result.success;
}
```

**Why Localhost**:
- WebGPU requires secure context (HTTPS or localhost)
- about:blank is NOT a secure context
- Localhost HTTP server provides secure context

**Timeouts**:
- Adapter request: 30s (prevents indefinite hangs)
- Device request: 60s (allows for driver initialization)
- Total preflight: ~90s max

### GPU Diagnostics

**captureGpuDiagnostics()** extracts chrome://gpu info:

```typescript
async function captureGpuDiagnostics(page: Page): Promise<GpuDiagnostics> {
  await page.goto('chrome://gpu');
  
  const diagnostics = await page.evaluate(() => {
    const infoDiv = document.querySelector('#basic-info');
    const problemsDiv = document.querySelector('#problems-list');
    const featuresDiv = document.querySelector('#feature-status-list');
    
    return {
      basicInfo: infoDiv?.textContent || '',
      problems: problemsDiv?.textContent || '',
      features: featuresDiv?.textContent || '',
    };
  });
  
  return diagnostics;
}
```

**Diagnostic Info**:
- GPU vendor and model
- Driver version
- WebGPU status (enabled/disabled)
- Vulkan status
- ANGLE backend
- Known problems

### Adapter Info Compatibility

**Problem**: Older Chromium versions don't have `adapter.requestAdapterInfo()`.

**Solution**: Fall back to direct adapter properties.

**Implementation**:
```typescript
let adapterInfo;
try {
  adapterInfo = await adapter.requestAdapterInfo();
} catch (e) {
  // Fallback for older Chromium
  adapterInfo = {
    vendor: adapter.vendor || 'unknown',
    architecture: adapter.architecture || 'unknown',
    device: adapter.device || 'unknown',
    description: adapter.description || 'unknown',
  };
}
```

## Display Server Configuration

### GPU Rendering Modes

Deployment tries modes in order until WebGPU works:

1. **Xorg with NVIDIA** (best performance):
   - Real X server with DRI/DRM device access
   - Requires nvidia_drm kernel module
   - Requires /dev/dri/ device nodes
   - Chrome uses NVIDIA GPU directly

2. **Xvfb with NVIDIA Vulkan** (recommended):
   - Virtual framebuffer on :99
   - Non-headless Chrome connects to virtual display
   - Chrome uses ANGLE/Vulkan for GPU rendering
   - Requires VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

3. **Headless Vulkan**:
   - Chrome `--headless=new` with `--use-vulkan` and `--use-angle=vulkan`
   - Direct Vulkan access without X server
   - May not work in all container environments

4. **Headless EGL**:
   - Chrome `--headless=new --use-gl=egl`
   - Direct EGL rendering without X server
   - Requires XDG_RUNTIME_DIR=/tmp/runtime-root

5. **Ozone Headless**:
   - Chrome `--ozone-platform=headless` with GPU rendering
   - Experimental mode
   - May have compatibility issues

6. **SwiftShader** (last resort):
   - Software Vulkan implementation
   - Poor performance (CPU rendering)
   - Only for debugging

### Display Environment Setup

**Xvfb Configuration**:
```bash
# Start Xvfb on :99
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

# Set Vulkan ICD
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Set XDG runtime dir
export XDG_RUNTIME_DIR=/tmp/runtime-root
mkdir -p $XDG_RUNTIME_DIR

# Set X authority
export XAUTHORITY=/tmp/.Xauthority
touch $XAUTHORITY
xauth add :99 . $(xxd -l 16 -p /dev/urandom)
```

**Display Environment Reuse**:
- `duel-stack.mjs` checks if DISPLAY is already set
- Reuses existing display from `deploy-vast.sh`
- Prevents spawning new Xvfb that lacks Vulkan ICD configuration

**X Server Detection**:
- Uses socket check (`/tmp/.X11-unix/X99`) instead of xdpyinfo
- More reliable and doesn't require additional packages
- Prevents false negatives when xdpyinfo is not installed

## Stream Capture

### Capture Modes

**CDP (Chrome DevTools Protocol)** - Default, recommended:
- Fastest and most reliable
- Uses `Page.startScreencast()` API
- Receives frames as JPEG data URLs
- Automatic resolution handling

**WebCodecs** - Experimental:
- Native VideoEncoder API
- Hardware-accelerated encoding
- Lower latency
- May have compatibility issues

**MediaRecorder** - Legacy fallback:
- Browser MediaRecorder API
- Software encoding
- Higher latency
- Most compatible

### Chrome Configuration

**WebGPU Flags**:
```typescript
const args = [
  '--enable-features=Vulkan,UseSkiaRenderer,VulkanFromANGLE',
  '--use-angle=vulkan',
  '--use-vulkan',
  '--enable-unsafe-webgpu',
  '--enable-webgpu-developer-features',
  '--enable-dawn-features=allow_unsafe_apis,disable_blob_cache',
  '--disable-gpu-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--no-sandbox',
];
```

**macOS Flags** (Metal backend):
```typescript
const args = [
  '--enable-features=UseSkiaRenderer',  // No Vulkan on macOS
  '--enable-unsafe-webgpu',
  '--enable-webgpu-developer-features',
  // ... other flags
];
```

**Verbose Logging**:
```typescript
const args = [
  '--enable-logging=stderr',
  '--v=1',
  '--vmodule=*/gpu/*=2,*/dawn/*=2,*/vulkan/*=2',
  // ... other flags
];
```

### Browser Lifecycle

**Automatic Restart**:
- Browser restarts every 45 minutes
- Prevents WebGPU OOM crashes
- Graceful shutdown and reconnect

**Page Navigation Timeout**:
- Increased to 180s for Vite dev mode
- Allows for WebGPU shader compilation on first load
- Production build recommended (faster page loads)

**Crash Detection**:
- Monitors browser process
- Captures crash dumps
- Restarts automatically
- Logs crash info for debugging

## Audio Capture

### PulseAudio Configuration

**Setup**:
```bash
# Start PulseAudio in user mode
pulseaudio --start --exit-idle-time=-1

# Create virtual sink for Chrome audio
pactl load-module module-null-sink sink_name=chrome_audio sink_properties=device.description=ChromeAudio

# Set default sink
pactl set-default-sink chrome_audio
```

**FFmpeg Capture**:
```bash
# Capture from PulseAudio monitor
ffmpeg -f pulse -i chrome_audio.monitor \
  -thread_queue_size 1024 \
  -async 1 \
  # ... encoding options
```

**Configuration**:
- `STREAM_AUDIO_ENABLED=true` - Enable audio capture
- `PULSE_AUDIO_DEVICE=chrome_audio.monitor` - PulseAudio device
- `XDG_RUNTIME_DIR=/tmp/pulse-runtime` - User-mode PulseAudio runtime

## RTMP Streaming

### Multi-Streaming

Simultaneous streaming to multiple platforms:

**Platforms**:
- Twitch
- Kick
- X/Twitter
- YouTube (disabled by default)

**FFmpeg Tee Muxer**:
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset veryfast -tune film -g 60 \
  -c:a aac -b:a 128k \
  -f tee \
  "[f=flv]rtmp://live.twitch.tv/app/$TWITCH_KEY|[f=flv]rtmp://fa.kick.com:1935/app/$KICK_KEY|[f=flv]rtmp://live.x.com/app/$TWITTER_KEY"
```

**Benefits**:
- Single encode, multiple outputs
- Synchronized streams
- Efficient CPU usage

### Stream Keys

**NEVER hardcode stream keys**. Always use environment variables:

```env
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
TWITTER_STREAM_KEY=...
```

**GitHub Secrets**:
- Set in repository settings → Secrets and variables → Actions
- Accessed in workflow via `${{ secrets.TWITCH_STREAM_KEY }}`
- Never logged or exposed

## Encoding Configuration

### Video Encoding

**Default Settings**:
```bash
-c:v libx264           # H.264 codec
-preset veryfast       # Encoding speed
-tune film             # Optimize for film content
-g 60                  # GOP size (60 frames)
-b:v 6000k             # Bitrate (6 Mbps)
-maxrate 6000k         # Max bitrate
-bufsize 12000k        # Buffer size (2x bitrate)
-pix_fmt yuv420p       # Pixel format
-r 30                  # Frame rate
```

**Low Latency Mode** (`STREAM_LOW_LATENCY=true`):
```bash
-tune zerolatency      # Optimize for low latency
-g 30                  # Smaller GOP (30 frames)
-b:v 4000k             # Lower bitrate
```

**Configurable Options**:
- `STREAM_GOP_SIZE` - GOP size in frames (default: 60)
- `STREAM_LOW_LATENCY` - Enable zerolatency tune (default: false)
- `STREAM_BITRATE` - Video bitrate in kbps (default: 6000)

### Audio Encoding

**Settings**:
```bash
-c:a aac               # AAC codec
-b:a 128k              # Bitrate (128 kbps)
-ar 44100              # Sample rate
-ac 2                  # Stereo
-thread_queue_size 1024  # Buffer size
-async 1               # Async resampling
```

### Buffer Configuration

**Bitrate Buffer Multiplier**: 2x (reduced from 4x)

**Rationale**: 4x buffer caused backpressure buildup during network issues. 2x provides adequate buffering without excessive delay.

**Implementation**:
```bash
-bufsize $(($BITRATE * 2))k  # 2x bitrate
```

## Health Monitoring

### Stream Health Checks

**Health Check Timeout**: 5s (data timeout: 15s)

**Checks**:
- Frame data received within timeout
- Bitrate within expected range
- No encoding errors
- RTMP connection active

**Failure Detection**:
- Faster failure detection (5s vs 15s)
- Automatic recovery attempts
- Logs detailed error info

### Resolution Tracking

**Mismatch Detection**:
- Tracks expected vs actual resolution
- Detects resolution changes
- Triggers automatic viewport recovery

**Viewport Recovery**:
```typescript
if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
  console.warn(`Resolution mismatch: ${actualWidth}×${actualHeight} vs ${expectedWidth}×${expectedHeight}`);
  await page.setViewport({ width: expectedWidth, height: expectedHeight });
}
```

### PM2 Log Capture

**Deployment Monitoring**:
```bash
# Wait 60s for streaming bridge to initialize
sleep 60

# Capture PM2 logs
pm2 logs hyperscape-duel --lines 100 --nostream

# Detect crash loops
if pm2 list | grep -q "errored"; then
  echo "Crash loop detected!"
  pm2 logs hyperscape-duel --err --lines 500
  exit 1
fi
```

**Benefits**:
- Diagnose streaming issues during deployment
- Detect crash loops early
- Dump error logs automatically

## Production Client Build

### Why Production Build

**Problem**: Vite dev server JIT compilation can take >180s on first load, causing browser timeout.

**Solution**: Serve pre-built client via `vite preview`.

**Configuration**:
```env
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

**Benefits**:
- Significantly faster page loads (<10s vs >180s)
- No on-demand module compilation
- Stable performance
- Recommended for all streaming deployments

### Build Process

**Build Client**:
```bash
cd packages/client
bun run build
```

**Serve via Preview**:
```bash
cd packages/client
vite preview --port 3333 --host 0.0.0.0
```

**Automatic in Deployment**:
- `deploy-vast.sh` builds client if `NODE_ENV=production`
- `duel-stack.mjs` uses `vite preview` if `DUEL_USE_PRODUCTION_CLIENT=true`
- PM2 ecosystem.config.cjs includes build step

## Model Agent Spawning

### Auto-Create Agents

**Problem**: Duels can't run with empty database.

**Solution**: Automatically spawn model agents when database is empty.

**Configuration**:
```env
SPAWN_MODEL_AGENTS=true
```

**Behavior**:
- Checks database for existing agents on startup
- Creates 2 model agents if none exist
- Agents use default character templates
- Allows duels to run immediately after deployment

**Agent Templates**:
- Completionist: Balanced skills, explores all content
- Ironman: Self-sufficient, no trading
- PVMer: Combat-focused, hunts monsters
- Skiller: Non-combat, focuses on gathering/crafting

## Streaming Status Check

### Quick Diagnostics

**Script**: `bun run duel:status` or `bash scripts/check-streaming-status.sh`

**Checks**:
1. Server health (`GET /health`)
2. Streaming API status (`GET /api/streaming/status`)
3. Duel context (`GET /api/duel/context`)
4. RTMP bridge status and bytes streamed
5. PM2 process status
6. Recent logs (last 50 lines)

**Output**:
```
═══════════════════════════════════════════════════════════════════
Hyperscape Streaming Status Check
═══════════════════════════════════════════════════════════════════

[✓] Server Health: OK
[✓] Streaming API: Active
[✓] Duel Context: Fighting phase
[✓] RTMP Bridge: Streaming (1.2 GB sent)
[✓] PM2 Processes: All running

Recent Logs:
  [2026-03-02 18:00:00] Frame captured: 1920x1080
  [2026-03-02 18:00:00] RTMP: 6.2 Mbps
  [2026-03-02 18:00:01] Health check: OK

═══════════════════════════════════════════════════════════════════
```

**Usage**:
```bash
# Local check
bun run duel:status

# Remote check (SSH)
ssh -p $VAST_PORT root@$VAST_HOST "cd /root/hyperscape && bun run duel:status"
```

## Environment Variables

### Stream Capture

```env
# Chrome executable path (explicit for reliable WebGPU)
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable

# Capture mode (cdp | webcodecs | mediarecorder)
STREAM_CAPTURE_MODE=cdp

# Low latency mode (zerolatency tune)
STREAM_LOW_LATENCY=false

# GOP size in frames
STREAM_GOP_SIZE=60

# Audio capture
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

### Production Client

```env
# Use production build (recommended)
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

### Model Agents

```env
# Auto-create agents when DB is empty
SPAWN_MODEL_AGENTS=true
```

### RTMP Streaming

```env
# Stream keys (never hardcode)
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
TWITTER_STREAM_KEY=...

# Stream settings
STREAM_BITRATE=6000        # Video bitrate in kbps
STREAM_AUDIO_BITRATE=128   # Audio bitrate in kbps
STREAM_FRAMERATE=30        # Frame rate
```

### PostgreSQL

```env
# Connection pool (optimized for crash loops)
POSTGRES_POOL_MAX=3        # Max connections
POSTGRES_POOL_MIN=0        # Min connections
```

## Troubleshooting

### WebGPU Initialization Fails

**Symptoms**: `navigator.gpu` is undefined or adapter request fails.

**Causes**:
- Instance doesn't have `gpu_display_active=true`
- Display driver not loaded
- Vulkan ICD not configured
- Chrome flags incorrect

**Solutions**:
1. Verify instance has `gpu_display_active=true` (check Vast.ai listing)
2. Check nvidia_drm kernel module: `lsmod | grep nvidia_drm`
3. Check DRM device nodes: `ls -la /dev/dri/`
4. Verify Vulkan ICD: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
5. Check chrome://gpu diagnostics in deployment logs
6. Try different GPU rendering mode (Xvfb, headless-vulkan, etc.)

### Browser Timeout on Page Load

**Symptoms**: Browser times out after 180s during page navigation.

**Causes**:
- Vite dev server JIT compilation too slow
- WebGPU shader compilation on first load
- Network latency

**Solutions**:
1. Use production client build (`NODE_ENV=production`)
2. Increase page navigation timeout (already 180s)
3. Pre-warm browser with preflight test
4. Check network connectivity

### Stream Stops After 45 Minutes

**Symptoms**: Stream goes offline after exactly 45 minutes.

**Causes**:
- Automatic browser restart (intentional)
- Prevents WebGPU OOM crashes

**Solutions**:
- This is expected behavior
- Browser restarts gracefully
- Stream reconnects automatically
- Increase restart interval if needed (not recommended)

### RTMP Connection Fails

**Symptoms**: FFmpeg can't connect to RTMP server.

**Causes**:
- Invalid stream key
- Network firewall blocking RTMP port (1935)
- RTMP server down

**Solutions**:
1. Verify stream keys are correct
2. Test RTMP connection: `ffmpeg -re -i test.mp4 -f flv rtmp://...`
3. Check firewall rules: `iptables -L | grep 1935`
4. Verify RTMP server is reachable: `telnet live.twitch.tv 1935`

### PostgreSQL Connection Exhaustion

**Symptoms**: `PostgreSQL error 53300: too many connections`

**Causes**:
- Crash loop creating new connections faster than they close
- Pool max too high
- Restart delay too short

**Solutions**:
1. Reduce `POSTGRES_POOL_MAX` to 3 (already done)
2. Set `POSTGRES_POOL_MIN` to 0 (already done)
3. Increase PM2 `restart_delay` to 10s (already done)
4. Check for crash loop: `pm2 logs --err`

## Monitoring

### PM2 Commands

```bash
# Check process status
pm2 status

# View logs
pm2 logs hyperscape-duel

# View error logs only
pm2 logs hyperscape-duel --err

# Restart process
pm2 restart hyperscape-duel

# Stop process
pm2 stop hyperscape-duel

# Delete process
pm2 delete hyperscape-duel
```

### Stream Metrics

**RTMP Bridge Metrics**:
- Bytes streamed
- Current bitrate
- Frame count
- Dropped frames
- Encoding errors

**Access Metrics**:
```bash
# Via API
curl http://localhost:5555/api/streaming/status

# Via status script
bun run duel:status
```

### GPU Metrics

**NVIDIA SMI**:
```bash
# GPU utilization
nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader

# Memory usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader

# Temperature
nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader

# Display mode
nvidia-smi --query-gpu=display_mode --format=csv,noheader
```

**Watch GPU**:
```bash
watch -n 1 nvidia-smi
```

## Best Practices

### Deployment Checklist

- [ ] Rent instance with `gpu_display_active=true`
- [ ] Verify NVIDIA display driver loaded (`nvidia-smi`)
- [ ] Check Vulkan ICD available (`ls /usr/share/vulkan/icd.d/`)
- [ ] Run WebGPU preflight test
- [ ] Use production client build (`NODE_ENV=production`)
- [ ] Set `SPAWN_MODEL_AGENTS=true` for empty database
- [ ] Configure stream keys in GitHub Secrets
- [ ] Set PostgreSQL pool config (POOL_MAX=3, POOL_MIN=0)
- [ ] Monitor PM2 logs for first 5 minutes
- [ ] Verify stream is live on platforms
- [ ] Check `bun run duel:status` for health

### Security

**Stream Keys**:
- Never commit stream keys to git
- Use GitHub Secrets for CI/CD
- Use `.env` file for local testing (gitignored)
- Rotate keys if exposed

**SSH Access**:
- Use SSH keys, not passwords
- Restrict SSH to specific IPs if possible
- Keep SSH port non-standard (Vast.ai assigns random port)

**Database**:
- Use strong PostgreSQL password
- Restrict database access to localhost
- Enable SSL for remote connections (if applicable)

### Cost Optimization

**GPU Instance**:
- Rent only when streaming (don't leave running 24/7)
- Use `vastai destroy instance` when done
- Monitor hourly cost: `vastai show instance INSTANCE_ID`

**Bandwidth**:
- Optimize bitrate for quality vs cost
- Use lower bitrate for non-peak hours
- Disable audio if not needed

## References

- **Implementation**: `packages/server/src/streaming/`
- **Deployment**: `scripts/deploy-vast.sh`
- **Provisioner**: `scripts/vast-provision.sh`
- **Duel Stack**: `scripts/duel-stack.mjs`
- **Status Check**: `scripts/check-streaming-status.sh`
- **Documentation**: [AGENTS.md](../AGENTS.md#vastai-deployment-architecture)
