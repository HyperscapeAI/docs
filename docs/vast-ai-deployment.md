# Vast.ai GPU Streaming Deployment

Complete guide for deploying Hyperscape's streaming duel system on Vast.ai GPU instances.

## Prerequisites

- Vast.ai account with GPU instance
- NVIDIA GPU with Vulkan support (required for WebGPU)
- GitHub repository access
- Stream keys for target platforms (Twitch, Kick, X/Twitter)

## Critical Requirements

### WebGPU is REQUIRED

Hyperscape uses TSL (Three.js Shading Language) for all materials and post-processing, which **only works with WebGPU**. There is NO WebGL fallback.

**GPU Requirements:**
- NVIDIA GPU with Vulkan support
- Vulkan ICD must be accessible at `/usr/share/vulkan/icd.d/nvidia_icd.json`
- GPU must be accessible via `nvidia-smi`
- DRI/DRM devices preferred but not required

**Display Server Requirements:**
- Must run headful (NOT headless Chrome)
- Supports Xorg, Xvfb, or headless EGL modes
- Chrome uses ANGLE/Vulkan backend for WebGPU
- `--disable-gpu-sandbox` and `--disable-setuid-sandbox` flags required for container GPU access

## Deployment Architecture

The `scripts/deploy-vast.sh` script automatically configures the optimal GPU rendering mode:

### GPU Rendering Modes (tried in order)

1. **Xorg with NVIDIA** (best performance)
   - Requires DRI/DRM device access (`/dev/dri/card0`)
   - Direct GPU rendering via NVIDIA X driver
   - Automatically configured if DRI devices are available
   - Falls back to Xvfb if NVIDIA driver fails to initialize

2. **Xvfb with NVIDIA Vulkan** (most common on Vast.ai)
   - Virtual framebuffer provides X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures frames from Chrome's internal GPU rendering
   - Works without DRI/DRM device access

3. **Ozone Headless with GPU** (experimental)
   - Uses `--ozone-platform=headless` with GPU rendering
   - Wayland-like headless compositor
   - Enabled via `STREAM_CAPTURE_OZONE_HEADLESS=true`

4. **Headless EGL** (fallback)
   - Uses `--use-gl=egl` for GPU access without X server
   - Enabled via `STREAM_CAPTURE_USE_EGL=true`
   - Less reliable than Xvfb mode

**CRITICAL**: If no GPU rendering mode can be established, deployment FAILS. Headless software rendering does NOT support WebGPU.

### WebGPU Validation

The deployment script runs comprehensive WebGPU tests before starting services:

1. **GPU Accessibility Check**: Verifies `nvidia-smi` works
2. **Vulkan ICD Detection**: Checks for NVIDIA Vulkan ICD files
3. **Display Server Verification**: Ensures Xorg/Xvfb is accessible
4. **WebGPU Pre-check Tests**: Runs Chrome with multiple configurations to find working setup
5. **GPU Diagnostics**: Extracts chrome://gpu info for debugging

**Test Configurations:**
- Test 1: Chrome headless=new with native Vulkan
- Test 2: Chrome headless=new with EGL
- Test 3: Chrome with Xvfb display
- Test 4: Chrome with ozone-platform=headless
- Test 5: Chrome with SwiftShader (software Vulkan, last resort)
- Test 6: Playwright non-headless with Xvfb (matches actual streaming config)

### Audio Capture

PulseAudio configuration for game audio streaming:

- **Virtual Sink**: `chrome_audio` null sink for Chrome audio output
- **FFmpeg Capture**: Captures from `chrome_audio.monitor` device
- **User-Mode PulseAudio**: Runs with XDG_RUNTIME_DIR at `/tmp/pulse-runtime`
- **Auto-Configuration**: PulseAudio config created automatically by deploy script

**Environment Variables:**
- `STREAM_AUDIO_ENABLED`: Enable/disable audio capture (default: true)
- `PULSE_AUDIO_DEVICE`: PulseAudio device name (default: `chrome_audio.monitor`)

### RTMP Multi-Streaming

Simultaneous streaming to multiple platforms using FFmpeg tee muxer:

- **Supported Platforms**: Twitch, Kick, X/Twitter
- **YouTube**: Disabled by default (set `YOUTUBE_STREAM_KEY=""` in deploy script)
- **Single-Encode Multi-Output**: FFmpeg tee muxer for efficient streaming
- **Secret Management**: All stream keys read from environment variables (never hardcoded)

**Stream Key Configuration:**
Set these in GitHub Secrets or `/tmp/hyperscape-secrets.env`:
- `TWITCH_STREAM_KEY`
- `KICK_STREAM_KEY` and `KICK_RTMP_URL`
- `X_STREAM_KEY` and `X_RTMP_URL`

## Environment Variables

### GPU Configuration

Auto-configured by `deploy-vast.sh` and persisted to `.env`:

```bash
# Display configuration
DISPLAY=:99                                    # X display number
GPU_RENDERING_MODE=xorg|xvfb-vulkan|ozone-headless  # Detected mode
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json  # Vulkan ICD path
DUEL_CAPTURE_USE_XVFB=true|false              # Whether using Xvfb

# Stream capture settings
STREAM_CAPTURE_HEADLESS=false                  # Must be false for WebGPU
STREAM_CAPTURE_USE_EGL=false                   # EGL mode (fallback)
STREAM_CAPTURE_OZONE_HEADLESS=false            # Ozone headless mode
```

### Streaming Configuration

```bash
# Production client build (recommended for streaming)
NODE_ENV=production                            # Use production build
DUEL_USE_PRODUCTION_CLIENT=true               # Serve pre-built client via vite preview

# Chrome executable path (optional but recommended)
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable

# Stream encoding
STREAM_GOP_SIZE=60                            # GOP size in frames (default: 60)
STREAM_LOW_LATENCY=false                      # Enable zerolatency tune (default: false)

# Browser management
# Browser restarts every 45 minutes to prevent WebGPU OOM crashes
# Configured in stream-to-rtmp.ts, not via environment variable

# Audio configuration
STREAM_AUDIO_ENABLED=true                     # Enable audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor       # PulseAudio device name
XDG_RUNTIME_DIR=/tmp/pulse-runtime            # PulseAudio runtime directory
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native  # PulseAudio socket
```

### Stream Keys

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app     # Optional override

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live

# X/Twitter (requires X Premium)
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path

# YouTube (disabled by default)
YOUTUBE_STREAM_KEY=                           # Empty to disable
```

## Deployment Process

### 1. Setup GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
DATABASE_URL=postgresql://user:password@host:5432/database
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path
SOLANA_DEPLOYER_PRIVATE_KEY=your-base64-encoded-keypair
```

### 2. Trigger Deployment

The `.github/workflows/deploy-vast.yml` workflow handles deployment:

```bash
# Automatic deployment on push to main
git push origin main

# Manual deployment via GitHub Actions
# Go to Actions → Deploy to Vast.ai → Run workflow
```

### 3. Deployment Steps

The `deploy-vast.sh` script performs these steps:

1. **DNS Configuration**: Sets Google DNS (8.8.8.8, 8.8.4.4) for container
2. **Code Update**: Pulls latest from `origin/main`
3. **Environment Restoration**: Copies secrets from `/tmp/hyperscape-secrets.env`
4. **System Dependencies**: Installs build tools, FFmpeg, PulseAudio, Vulkan tools
5. **GPU Validation**: Checks NVIDIA GPU and Vulkan ICD availability
6. **Display Server Setup**: Configures Xorg or Xvfb for WebGPU
7. **WebGPU Testing**: Runs 6 test configurations to find working setup
8. **Chrome Installation**: Installs Chrome Dev channel for WebGPU support
9. **Playwright Installation**: Installs Playwright Chromium for capture
10. **PulseAudio Setup**: Configures audio capture virtual sink
11. **Dependency Installation**: Runs `bun install`
12. **Package Build**: Builds physx-js-webidl, decimation, impostors, procgen, asset-forge, shared
13. **Database Migration**: Runs `drizzle-kit push` to update schema
14. **Solana Keypair**: Decodes `SOLANA_DEPLOYER_PRIVATE_KEY` to `~/.config/solana/id.json`
15. **Process Cleanup**: Kills existing PM2 daemon and legacy processes
16. **Port Proxies**: Starts socat proxies for external access
17. **Environment Persistence**: Saves GPU/display settings to `.env`
18. **PM2 Startup**: Starts duel stack via `ecosystem.config.cjs`
19. **Health Check**: Waits up to 120s for server to respond

### 4. Port Mappings

Vast.ai instances expose these ports:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | Game Server (HTTP) |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

## Monitoring & Debugging

### Check Deployment Status

```bash
# SSH into Vast.ai instance
ssh root@<instance-ip> -p <ssh-port>

# Check PM2 status
bunx pm2 status

# View logs
bunx pm2 logs hyperscape-duel --lines 100

# Check GPU status
nvidia-smi

# Check display server
echo $DISPLAY
xdpyinfo -display $DISPLAY

# Check Vulkan
vulkaninfo --summary
```

### Common Issues

**WebGPU not available:**
- Check `nvidia-smi` output - GPU must be accessible
- Verify Vulkan ICD: `ls /usr/share/vulkan/icd.d/nvidia_icd.json`
- Check display server: `xdpyinfo -display $DISPLAY`
- Review deployment logs for WebGPU test results
- Ensure `--disable-gpu-sandbox` flag is set

**Stream not starting:**
- Check PM2 logs: `bunx pm2 logs hyperscape-duel`
- Verify stream keys are set in environment
- Check FFmpeg is installed: `ffmpeg -version`
- Verify PulseAudio is running: `pulseaudio --check`

**Browser timeout (180s):**
- Set `DUEL_USE_PRODUCTION_CLIENT=true` to use pre-built client
- Production build loads much faster than Vite dev server
- Vite's JIT compilation can exceed 180s timeout

**WebGPU initialization hangs:**
- 30s timeout on `navigator.gpu.requestAdapter()`
- 60s timeout on `renderer.init()`
- Check chrome://gpu diagnostics in deployment logs
- May indicate GPU driver issues or misconfiguration

## Performance Tuning

### Stream Encoding

```bash
# Low latency mode (faster playback start, lower compression)
STREAM_LOW_LATENCY=true

# GOP size (default: 60 frames)
STREAM_GOP_SIZE=30  # Smaller = more frequent keyframes, higher bitrate

# Bitrate buffer multiplier (default: 2x)
# Reduced from 4x to prevent backpressure buildup
# Configured in stream-to-rtmp.ts, not via environment variable
```

### Browser Stability

- **Automatic Restart**: Browser restarts every 45 minutes to prevent WebGPU OOM crashes
- **Probe Timeout**: 5s timeout on evaluate calls to prevent hanging
- **Recovery Mode**: Proceeds with capture after 5 consecutive probe timeouts
- **Viewport Recovery**: Automatic recovery when resolution mismatch detected

### Health Monitoring

- **Health Check Timeout**: 5s (data timeout: 15s) for faster failure detection
- **Buffer Multiplier**: 2x bitrate buffer (reduced from 4x)
- **Audio Buffering**: `thread_queue_size=1024` with async resampling

## Troubleshooting

### Deployment Fails at WebGPU Test

**Symptoms:**
- All 6 WebGPU tests fail
- Deployment exits with "FATAL ERROR: Cannot establish WebGPU-capable rendering mode"

**Solutions:**
1. Verify NVIDIA drivers are installed: `nvidia-smi`
2. Check Vulkan ICD exists: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
3. Ensure GPU is accessible in container (not just CUDA)
4. Try different Vast.ai instance with better GPU support

### Xorg Falls Back to Software Rendering

**Symptoms:**
- Deployment logs show "Xorg started but using SOFTWARE RENDERING (swrast)"
- Script automatically switches to Xvfb mode

**Cause:**
- NVIDIA driver failed to initialize (common in containers without full DRM access)
- Xorg fell back to modesetting with swrast (software rendering)

**Solution:**
- Xvfb mode is automatically enabled as fallback
- Chrome still uses NVIDIA GPU via ANGLE/Vulkan
- No action needed - this is expected behavior

### Stream Keys Not Working

**Symptoms:**
- RTMP bridge starts but no streams appear on platforms
- Logs show "TWITCH_STREAM_KEY: NOT SET"

**Solutions:**
1. Verify secrets are set in GitHub Secrets
2. Check `/tmp/hyperscape-secrets.env` exists on instance
3. Verify `.env` file was created: `cat /root/hyperscape/packages/server/.env`
4. Re-run deployment to restore environment variables

### Browser Crashes or OOM

**Symptoms:**
- PM2 logs show browser crashes
- WebGPU errors in logs
- Stream stops after extended runtime

**Solutions:**
- Browser automatically restarts every 45 minutes (configured in code)
- Check available GPU memory: `nvidia-smi`
- Consider instance with more GPU memory
- Reduce stream resolution if needed

### Audio Not Captured

**Symptoms:**
- Stream has video but no audio
- FFmpeg logs show audio device errors

**Solutions:**
1. Check PulseAudio is running: `pulseaudio --check`
2. Verify chrome_audio sink exists: `pactl list short sinks`
3. Check PulseAudio logs: `journalctl -u pulseaudio --no-pager`
4. Restart PulseAudio: `pulseaudio --kill && pulseaudio --start`

## Advanced Configuration

### Custom Chrome Executable

```bash
# Set explicit Chrome path for reliable WebGPU
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

### Production Client Build

```bash
# Use pre-built client for faster page loads (recommended)
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

This serves the client via `vite preview` instead of the dev server, which:
- Eliminates 180s browser timeout issues
- Significantly faster page loads
- No on-demand module compilation

### Stream Capture Modes

```bash
# CDP (default) - Chrome DevTools Protocol screencast
# Most reliable, fastest, recommended

# WebCodecs (experimental) - Native VideoEncoder API
# Set in code, not via environment variable

# MediaRecorder (legacy fallback)
# Set in code, not via environment variable
```

### Encoding Optimization

Default encoding uses `film` tune with B-frames for better compression:
- GOP size: 60 frames (configurable via `STREAM_GOP_SIZE`)
- Bitrate buffer: 2x multiplier (reduced from 4x)
- Audio buffering: `thread_queue_size=1024`

For low-latency streaming:
```bash
STREAM_LOW_LATENCY=true  # Uses zerolatency tune, faster playback start
```

## Monitoring

### PM2 Commands

```bash
# View process status
bunx pm2 status

# View logs (live tail)
bunx pm2 logs hyperscape-duel

# View logs (last 100 lines)
bunx pm2 logs hyperscape-duel --lines 100

# Restart stack
bunx pm2 restart hyperscape-duel

# Stop stack
bunx pm2 stop hyperscape-duel

# Delete process
bunx pm2 delete hyperscape-duel
```

### Health Endpoints

```bash
# Server health
curl http://localhost:5555/health

# Game client
curl http://localhost:3333

# Streaming state
curl http://localhost:5555/api/streaming/state

# Duel context
curl http://localhost:5555/api/streaming/duel-context
```

### GPU Monitoring

```bash
# GPU utilization
nvidia-smi

# Continuous monitoring (1s refresh)
watch -n 1 nvidia-smi

# GPU memory usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

## Security Best Practices

1. **Never commit secrets to git**
   - Use GitHub Secrets for CI/CD
   - Store secrets in `/tmp/hyperscape-secrets.env` on instance
   - Secrets are copied to `packages/server/.env` during deployment

2. **Rotate stream keys regularly**
   - Update GitHub Secrets
   - Re-run deployment to apply new keys

3. **Limit SSH access**
   - Use Vast.ai's SSH key management
   - Disable password authentication
   - Use firewall rules to restrict access

4. **Monitor resource usage**
   - Set up alerts for high GPU/CPU usage
   - Monitor disk space (logs can grow large)
   - Use PM2 monitoring for process health

## Cost Optimization

1. **Choose appropriate instance**
   - RTX 3060 or better recommended
   - 8GB+ GPU memory for stable streaming
   - 16GB+ system RAM

2. **Stop when not streaming**
   - Vast.ai charges by the hour
   - Stop instance when not actively streaming
   - Use on-demand instances for testing

3. **Monitor bandwidth**
   - Streaming to multiple platforms uses significant bandwidth
   - Consider single platform for testing
   - Use lower bitrate for cost savings

## References

- Deployment script: `scripts/deploy-vast.sh`
- PM2 config: `ecosystem.config.cjs`
- RTMP bridge: `packages/server/scripts/stream-to-rtmp.ts`
- Environment variables: `packages/server/.env.example`
