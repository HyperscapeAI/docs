# Vast.ai GPU Streaming Deployment

This guide covers deploying Hyperscape's streaming duel arena on Vast.ai GPU servers for live RTMP broadcasting to Twitch, Kick, X/Twitter, and other platforms.

## Prerequisites

### Required
- Vast.ai account with GPU instance
- NVIDIA GPU with Vulkan support (verified via `nvidia-smi`)
- GitHub repository with secrets configured
- Stream keys for target platforms (Twitch, Kick, X/Twitter)

### GPU Requirements
- **NVIDIA GPU**: Required for WebGPU via ANGLE/Vulkan backend
- **Vulkan ICD**: Must be available at `/usr/share/vulkan/icd.d/nvidia_icd.json`
- **DRI/DRM Access**: Optional but recommended for best performance (Xorg mode)

## Deployment Architecture

The deployment script (`scripts/deploy-vast.sh`) attempts GPU rendering modes in this order:

### 1. Xorg with NVIDIA (Best Performance)
- **Requirements**: DRI/DRM device access (`/dev/dri/card*`)
- **Display**: Real X server with NVIDIA GLX driver
- **WebGPU**: Direct GPU access via NVIDIA driver
- **Status**: `DUEL_CAPTURE_USE_XVFB=false`, `DISPLAY=:0`

### 2. Xvfb with NVIDIA Vulkan (Fallback)
- **Requirements**: NVIDIA GPU accessible, no DRI/DRM needed
- **Display**: Virtual framebuffer (Xvfb) on `:99`
- **WebGPU**: Chrome uses ANGLE/Vulkan to access GPU
- **Status**: `DUEL_CAPTURE_USE_XVFB=true`, `DISPLAY=:99`

### 3. Ozone Headless with GPU (Experimental)
- **Requirements**: NVIDIA GPU with Vulkan
- **Display**: No X server, Chrome's `--ozone-platform=headless`
- **WebGPU**: Direct Vulkan access via Chrome
- **Status**: `STREAM_CAPTURE_OZONE_HEADLESS=true`, `DISPLAY=` (empty)

### 4. Headless Software Rendering (NOT SUPPORTED)
- **WebGPU**: WILL NOT WORK
- **Deployment**: FAILS with error message
- **Reason**: WebGPU requires hardware GPU acceleration

## WebGPU Validation

The deployment script performs comprehensive WebGPU validation:

### 1. GPU Hardware Check
```bash
nvidia-smi  # Verify NVIDIA GPU is accessible
```

### 2. Vulkan ICD Verification
```bash
ls /usr/share/vulkan/icd.d/nvidia_icd.json  # Check ICD file exists
cat /usr/share/vulkan/icd.d/nvidia_icd.json  # Log ICD content
VK_LOADER_DEBUG=all vulkaninfo  # Verify Vulkan loader works
```

### 3. Display Server Check
```bash
xdpyinfo -display :0  # Verify X server responds (Xorg mode)
xdpyinfo -display :99  # Verify Xvfb responds (Xvfb mode)
```

### 4. WebGPU Preflight Test
- Launches Chrome with GPU flags
- Navigates to blank page
- Tests `navigator.gpu.requestAdapter()` with 30s timeout
- Tests `renderer.init()` with 60s timeout
- Extracts chrome://gpu diagnostics
- **Deployment fails if WebGPU cannot initialize**

### 5. GPU Diagnostics Capture
```bash
# Captured during deployment for debugging:
- WebGPU adapter info
- Vulkan backend status
- GPU vendor/renderer
- Feature support flags
```

## Environment Persistence

Settings are persisted to `.env` for PM2 restarts:

```bash
# GPU/Display configuration
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
STREAM_CAPTURE_OZONE_HEADLESS=false
STREAM_CAPTURE_USE_EGL=false

# Chrome executable path
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

## Stream Capture Configuration

### Chrome Flags (GPU Sandbox Bypass)
Required for container GPU access:
```bash
--disable-gpu-sandbox
--disable-setuid-sandbox
```

### Capture Modes
- **CDP (default)**: Chrome DevTools Protocol screencast
- **WebCodecs**: Native VideoEncoder API (experimental)
- **MediaRecorder**: Legacy fallback

### Timeouts & Recovery
- **Probe Timeout**: 5s on evaluate calls to prevent hanging
- **Probe Retry**: Proceeds after 5 consecutive timeouts (browser unresponsive)
- **Viewport Recovery**: Automatic restoration on resolution mismatch
- **Browser Restart**: Every 45 minutes to prevent WebGPU OOM crashes

### Production Client Build
Enable for faster page loads (fixes 180s timeout issues):
```bash
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

Serves pre-built client via `vite preview` instead of JIT dev server.

## Audio Capture

### PulseAudio Configuration
```bash
# User-mode PulseAudio
XDG_RUNTIME_DIR=/tmp/pulse-runtime

# Virtual audio sink
pactl load-module module-null-sink sink_name=chrome_audio

# FFmpeg capture source
PULSE_AUDIO_DEVICE=chrome_audio.monitor
STREAM_AUDIO_ENABLED=true
```

## RTMP Multi-Streaming

### Supported Platforms
- **Twitch**: `TWITCH_STREAM_KEY`
- **Kick**: `KICK_STREAM_KEY`, `KICK_RTMP_URL`
- **X/Twitter**: `X_STREAM_KEY`, `X_RTMP_URL`
- **YouTube**: Disabled by default (high latency)

### FFmpeg Tee Muxer
Single-encode multi-output for efficiency:
```bash
ffmpeg -i input \
  -f tee \
  "[f=flv]rtmp://twitch|[f=flv]rtmp://kick|[f=flv]rtmp://x"
```

### Stream Encoding
```bash
# Default: film tune with B-frames
# Low-latency mode: zerolatency tune
STREAM_LOW_LATENCY=true

# GOP size (default: 60 frames)
STREAM_GOP_SIZE=60

# Buffer multiplier (default: 2x)
# Reduced from 4x to prevent backpressure buildup
```

### Health Monitoring
```bash
# Health check timeout: 5s
# Data timeout: 15s
# Faster failure detection than previous 10s/30s
```

## GitHub Secrets Configuration

Set these in your repository's Settings → Secrets and variables → Actions:

### Required Secrets
```bash
# Streaming keys
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://x-media-studio/your-path

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Solana
SOLANA_DEPLOYER_PRIVATE_KEY=[1,2,3,...]

# Vast.ai SSH
VAST_HOST=ssh5.vast.ai
VAST_PORT=12345
VAST_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
```

## Deployment Workflow

### Automated Deployment (GitHub Actions)
```bash
# Triggered on push to main
.github/workflows/deploy-vast.yml
```

### Manual Deployment
```bash
# From local machine
./scripts/deploy-vast.sh
```

### Deployment Steps
1. **GPU Validation**: Verify NVIDIA GPU and Vulkan ICD
2. **Display Setup**: Try Xorg → Xvfb → Ozone headless
3. **WebGPU Test**: Preflight check with Chrome
4. **Environment Persistence**: Save settings to `.env`
5. **PM2 Configuration**: Export GPU mode to ecosystem.config.cjs
6. **Service Start**: Launch game server + RTMP bridge via PM2

## Monitoring & Diagnostics

### Check Deployment Status
```bash
# SSH into Vast.ai instance
ssh -p $VAST_PORT root@$VAST_HOST

# Check PM2 processes
pm2 status

# View logs
pm2 logs duel-stack
pm2 logs rtmp-bridge

# Check GPU
nvidia-smi

# Check display
echo $DISPLAY
xdpyinfo -display $DISPLAY
```

### WebGPU Diagnostics
```bash
# Check chrome://gpu output (captured during deployment)
cat /root/hyperscape/gpu-diagnostics.log

# Test WebGPU manually
google-chrome-unstable --headless=new --enable-unsafe-webgpu \
  --enable-features=WebGPU --use-vulkan \
  --dump-dom about:blank
```

### Common Issues

**WebGPU initialization hangs:**
- Check GPU diagnostics log
- Verify Vulkan ICD is present
- Ensure display server is running
- Review Chrome flags in ecosystem.config.cjs

**Stream not starting:**
- Check RTMP bridge logs: `pm2 logs rtmp-bridge`
- Verify stream keys are set correctly
- Test with single destination first
- Check FFmpeg is installed: `which ffmpeg`

**Browser crashes immediately:**
- GPU sandbox bypass flags missing
- Check Chrome executable path
- Verify GPU is accessible: `nvidia-smi`

**Audio not captured:**
- Check PulseAudio is running: `pactl info`
- Verify virtual sink exists: `pactl list sinks`
- Check XDG_RUNTIME_DIR is set

## Performance Tuning

### Stream Quality
```bash
# Bitrate (default: 6000k)
STREAM_BITRATE=6000k

# Resolution (default: 1920x1080)
STREAM_WIDTH=1920
STREAM_HEIGHT=1080

# Frame rate (default: 30)
STREAM_FPS=30
```

### Browser Performance
```bash
# Restart interval (default: 45 minutes)
# Prevents WebGPU OOM crashes
BROWSER_RESTART_INTERVAL_MS=2700000

# Page navigation timeout (default: 180s)
# Increased for production client build
PAGE_NAVIGATION_TIMEOUT_MS=180000
```

### Resource Limits
```bash
# Activity logger queue (default: 1000)
LOGGER_MAX_ENTRIES=1000

# Session timeout (default: 30 minutes)
MAX_SESSION_TICKS=3000

# Damage event cache (default: 1000)
DAMAGE_CACHE_MAX_SIZE=1000
```

## Security Best Practices

### Never Commit Secrets
- All stream keys must be in `.env` or GitHub Secrets
- Never hardcode credentials in code
- Use `.gitignore` to block `.env` files

### Secret Rotation
```bash
# Rotate these regularly:
- TWITCH_STREAM_KEY
- KICK_STREAM_KEY
- X_STREAM_KEY
- STREAMING_VIEWER_ACCESS_TOKEN
- ARENA_EXTERNAL_BET_WRITE_KEY
```

### Access Control
```bash
# Restrict SSH access to Vast.ai instance
# Use SSH keys, not passwords
# Disable root login after setup
```

## Troubleshooting

### Deployment Fails at WebGPU Test
**Symptom**: Deployment exits with "WebGPU initialization failed"

**Solutions**:
1. Check GPU is accessible: `nvidia-smi`
2. Verify Vulkan ICD: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
3. Check display server: `echo $DISPLAY && xdpyinfo -display $DISPLAY`
4. Review GPU diagnostics: `cat gpu-diagnostics.log`
5. Try different GPU mode: Set `STREAM_CAPTURE_OZONE_HEADLESS=true`

### Stream Stops After 45 Minutes
**Symptom**: Browser restarts, stream briefly interrupts

**Explanation**: Automatic browser restart prevents WebGPU OOM crashes

**Solutions**:
1. This is expected behavior (prevents crashes)
2. Increase interval: `BROWSER_RESTART_INTERVAL_MS=3600000` (1 hour)
3. Monitor memory usage: `pm2 monit`

### Page Load Timeout (>180s)
**Symptom**: Browser times out loading game page

**Solutions**:
1. Enable production client build:
   ```bash
   NODE_ENV=production
   DUEL_USE_PRODUCTION_CLIENT=true
   ```
2. Increase timeout: `PAGE_NAVIGATION_TIMEOUT_MS=300000`
3. Check network latency to CDN

### Audio Not Captured
**Symptom**: Stream has video but no audio

**Solutions**:
1. Check PulseAudio: `pactl info`
2. Verify sink: `pactl list sinks | grep chrome_audio`
3. Check device: `PULSE_AUDIO_DEVICE=chrome_audio.monitor`
4. Enable audio: `STREAM_AUDIO_ENABLED=true`

## Advanced Configuration

### Custom Chrome Executable
```bash
# Use specific Chrome version
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

### Low-Latency Streaming
```bash
# Enable zerolatency tune (faster playback start)
STREAM_LOW_LATENCY=true

# Reduce GOP size
STREAM_GOP_SIZE=30
```

### Multiple RTMP Destinations
```bash
# JSON array format
RTMP_DESTINATIONS_JSON=[
  {"name":"Custom","url":"rtmp://host/live","key":"key","enabled":true}
]
```

## Monitoring

### PM2 Dashboard
```bash
pm2 monit  # Real-time monitoring
pm2 status  # Process status
pm2 logs --lines 100  # Recent logs
```

### Resource Usage
```bash
nvidia-smi  # GPU utilization
htop  # CPU/RAM usage
df -h  # Disk space
```

### Stream Health
```bash
# Check RTMP bridge status
curl http://localhost:8765/health

# Check game server
curl http://localhost:5555/status

# Check streaming state
curl http://localhost:5555/api/streaming/state
```

## Cost Optimization

### GPU Selection
- **Minimum**: GTX 1060 (6GB VRAM)
- **Recommended**: RTX 3060 (12GB VRAM)
- **Optimal**: RTX 4070 (12GB VRAM)

### Instance Configuration
- **vCPUs**: 4-8 cores recommended
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 50GB minimum for assets + logs

### Spot vs On-Demand
- **Spot**: Cheaper but can be interrupted
- **On-Demand**: More expensive but guaranteed uptime
- **Recommendation**: Use on-demand for production streams

## See Also

- [duel-stack.md](duel-stack.md) - Local duel stack setup
- [betting-production-deploy.md](betting-production-deploy.md) - Cloudflare + Railway deployment
- `scripts/deploy-vast.sh` - Deployment automation script
- `ecosystem.config.cjs` - PM2 process configuration
