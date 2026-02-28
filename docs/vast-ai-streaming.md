# Vast.ai GPU Streaming Architecture

This document describes the GPU-accelerated streaming pipeline for Hyperscape on Vast.ai infrastructure.

## Overview

Hyperscape streams live gameplay to multiple platforms (Twitch, Kick, X/Twitter) using a GPU-accelerated rendering and encoding pipeline. The system requires WebGPU for rendering and uses Chrome DevTools Protocol (CDP) for efficient frame capture.

## Critical Requirements

### WebGPU is REQUIRED

**WebGPU is mandatory** - there is NO WebGL fallback:
- All materials use TSL (Three Shading Language) which only works with WebGPU
- Post-processing effects require WebGPU node material pipeline
- Deployment MUST FAIL if WebGPU cannot be initialized

### GPU Hardware Requirements

- **NVIDIA GPU** with Vulkan support
- **Vulkan ICD** properly configured (`/usr/share/vulkan/icd.d/nvidia_icd.json`)
- **Display server**: Xorg (preferred) or Xvfb (fallback)
- **NO headless mode** - WebGPU requires a display

## Architecture

### GPU Rendering Modes

The deployment script (`scripts/deploy-vast.sh`) tries rendering modes in this order:

1. **Xorg with NVIDIA** (best performance)
   - Requires DRI/DRM device access (`/dev/dri/card0`)
   - Full hardware GPU rendering
   - Lowest latency

2. **Xvfb with NVIDIA Vulkan** (fallback)
   - Virtual framebuffer (no physical display needed)
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures frames from Chrome's internal GPU rendering
   - Slightly higher latency than Xorg

3. **Headless mode** (NOT SUPPORTED)
   - WebGPU will NOT work in headless mode
   - Deployment fails if neither Xorg nor Xvfb can start

### Frame Capture Pipeline

```
Chromium Compositor (WebGPU)
    ↓
CDP Page.startScreencast (JPEG frames)
    ↓
Node.js Buffer Processing
    ↓
FFmpeg stdin (JPEG pipe)
    ↓
H.264 Encoding (hardware accelerated)
    ↓
RTMP Tee Muxer (multi-destination)
    ↓
Twitch / Kick / X/Twitter
```

### Audio Capture

1. **PulseAudio Setup**:
   - Virtual sink: `chrome_audio`
   - Chrome outputs audio to PulseAudio
   - FFmpeg captures from `chrome_audio.monitor`

2. **Configuration**:
   ```bash
   STREAM_AUDIO_ENABLED=true
   PULSE_AUDIO_DEVICE=chrome_audio.monitor
   PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
   ```

### RTMP Multi-Streaming

FFmpeg uses the `tee` muxer for single-encode, multi-output streaming:

```bash
# Simultaneous streaming to 3 platforms
ffmpeg -i input.mp4 \
  -f tee \
  "[f=flv]rtmp://twitch.tv/app/key|[f=flv]rtmps://kick.com/app/key|[f=flv]rtmp://x.com/key"
```

**Supported Platforms**:
- Twitch (RTMP)
- Kick (RTMPS)
- X/Twitter (RTMP)
- YouTube (disabled by default)

## Environment Variables

### Core Streaming Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_MODE` | `cdp` | Capture mode: `cdp`, `mediarecorder`, `webcodecs` |
| `STREAM_CAPTURE_WIDTH` | `1280` | Stream width (must be even) |
| `STREAM_CAPTURE_HEIGHT` | `720` | Stream height (must be even) |
| `STREAM_FPS` | `30` | Target frames per second |
| `STREAM_CDP_QUALITY` | `80` | JPEG quality for CDP (1-100) |

### GPU Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY` | `:99` | X display server (`:0` for Xorg, `:99` for Xvfb) |
| `DUEL_CAPTURE_USE_XVFB` | `false` | Set to `true` when using Xvfb |
| `VK_ICD_FILENAMES` | `/usr/share/vulkan/icd.d/nvidia_icd.json` | Force NVIDIA Vulkan ICD |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | ANGLE backend (`vulkan` for NVIDIA, `metal` for macOS) |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Browser channel (chrome-dev = google-chrome-unstable) |

### Audio Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `PULSE_SERVER` | `unix:/tmp/pulse-runtime/pulse/native` | PulseAudio socket |
| `XDG_RUNTIME_DIR` | `/tmp/pulse-runtime` | PulseAudio runtime directory |

### Encoding Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_GOP_SIZE` | `60` | Keyframe interval (frames) |
| `STREAM_LOW_LATENCY` | `false` | Use zerolatency tune (true) or film tune (false) |

### Recovery Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` | `30000` | Timeout for recovery attempts |
| `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` | `6` | Max failures before fallback |

### Stream Destinations

| Variable | Description |
|----------|-------------|
| `TWITCH_STREAM_KEY` | Twitch stream key |
| `KICK_STREAM_KEY` | Kick stream key |
| `KICK_RTMP_URL` | Kick RTMP URL (default: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`) |
| `X_STREAM_KEY` | X/Twitter stream key |
| `X_RTMP_URL` | X/Twitter RTMP URL (default: `rtmp://sg.pscp.tv:80/x`) |
| `YOUTUBE_STREAM_KEY` | YouTube stream key (disabled by default) |

## Deployment Validation

The `scripts/deploy-vast.sh` script performs these validation steps:

1. **GPU Detection**:
   ```bash
   nvidia-smi  # Verify NVIDIA GPU is accessible
   ```

2. **Vulkan Verification**:
   ```bash
   vulkaninfo --summary  # Check Vulkan ICD
   ```

3. **Display Server Setup**:
   - Try Xorg with NVIDIA driver
   - Fall back to Xvfb if DRI/DRM unavailable
   - Verify display is accessible with `xdpyinfo`

4. **WebGPU Validation**:
   - Deployment FAILS if no display server can start
   - No soft fallback to headless mode

## Capture Modes

### CDP Mode (Default, Recommended)

**Chrome DevTools Protocol screencast capture**

- Fastest capture method (2-3x faster than MediaRecorder)
- Direct JPEG frames from Chromium compositor
- No browser-side encoding overhead
- Hardware-accelerated H.264 encoding in FFmpeg

**How it works**:
```typescript
// Start CDP screencast
await cdpSession.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 80,
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 1
});

// Handle frames
cdpSession.on('Page.screencastFrame', async (params) => {
  const jpegBuffer = Buffer.from(params.data, 'base64');
  bridge.feedFrame(jpegBuffer);  // Pipe to FFmpeg stdin
  await cdpSession.send('Page.screencastFrameAck', { sessionId: params.sessionId });
});
```

### MediaRecorder Mode (Legacy)

**Browser MediaRecorder API with WebSocket**

- Slower than CDP (browser-side VP8/VP9 encoding)
- WebSocket serialization overhead
- Automatic fallback if CDP fails

### WebCodecs Mode (Experimental)

**Native VideoEncoder API**

- Browser-side H.264 encoding
- FFmpeg uses `-c:v copy` (stream copy, no re-encoding)
- Lowest CPU usage but requires WebCodecs support

## Audio Pipeline

### PulseAudio Configuration

1. **Virtual Sink Creation**:
   ```bash
   pactl load-module module-null-sink \
     sink_name=chrome_audio \
     sink_properties=device.description="ChromeAudio"
   ```

2. **Chrome Audio Output**:
   ```bash
   google-chrome-unstable \
     --alsa-output-device=pulse \
     --audio-output-channels=2
   ```

3. **FFmpeg Capture**:
   ```bash
   ffmpeg -f pulse -i chrome_audio.monitor \
     -thread_queue_size 1024 \
     -use_wallclock_as_timestamps 1 \
     ...
   ```

### Audio Stability Features

- `thread_queue_size=1024` prevents buffer underruns
- `use_wallclock_as_timestamps=1` maintains real-time timing
- `aresample=async=1000:first_pts=0` recovers from audio drift

## FFmpeg Encoding

### Video Encoding Settings

```bash
-c:v libx264
-preset veryfast
-tune film              # Better compression (or 'zerolatency' if STREAM_LOW_LATENCY=true)
-profile:v high
-level 4.2
-pix_fmt yuv420p
-b:v 4500k
-maxrate 4500k
-bufsize 18000k         # 4x bitrate for stability
-g 60                   # GOP size (keyframe interval)
-keyint_min 60
-sc_threshold 0
-bf 2
-refs 3
```

### Audio Encoding Settings

```bash
-c:a aac
-b:a 160k
-ar 48000
-ac 2
-af aresample=async=1000:first_pts=0  # Drift recovery
```

### RTMP Output

```bash
-f tee
"[f=flv:flvflags=no_duration_filesize]rtmp://twitch.tv/app/key|
 [f=flv:flvflags=no_duration_filesize]rtmps://kick.com/app/key|
 [f=flv:flvflags=no_duration_filesize]rtmp://x.com/key"
```

## Monitoring and Recovery

### Health Checks

The streaming system monitors:
- **CDP FPS**: Frames per second from screencast
- **Resolution**: Detects viewport mismatches
- **Dropped Frames**: Tracks frames lost to backpressure
- **Bytes Received**: Monitors data flow

### Automatic Recovery

1. **Soft Recovery** (CDP stall):
   - Restart CDP screencast without killing browser
   - No stream gap
   - Triggered after 4 intervals without traffic

2. **Hard Recovery** (soft recovery fails):
   - Full browser teardown and restart
   - Brief stream interruption
   - Triggered after soft recovery fails

3. **Fallback to MediaRecorder**:
   - Triggered after 6 consecutive recovery failures
   - Switches to legacy capture mode
   - Continues streaming with reduced performance

### Resolution Mismatch Recovery

If CDP reports wrong resolution for 10+ consecutive frames:
- Automatically calls `page.setViewportSize()`
- Resets resolution mismatch counter
- Prevents stream quality degradation

## Troubleshooting

### WebGPU Not Available

**Symptoms**:
- Deployment fails with "Cannot establish WebGPU-capable rendering mode"
- Chrome reports "WebGPU not supported"

**Solutions**:
1. Verify NVIDIA GPU: `nvidia-smi`
2. Check Vulkan: `vulkaninfo --summary`
3. Verify display: `xdpyinfo -display :99`
4. Check Xorg logs: `cat /var/log/Xorg.99.log`

### Audio Not Capturing

**Symptoms**:
- Stream has video but no audio
- FFmpeg reports "pulse: Connection refused"

**Solutions**:
1. Check PulseAudio: `pulseaudio --check`
2. List sinks: `pactl list short sinks`
3. Verify chrome_audio sink exists
4. Check permissions: `ls -la /tmp/pulse-runtime`

### Stream Stalls/Buffering

**Symptoms**:
- Viewers experience buffering
- FFmpeg reports "Past duration too large"

**Solutions**:
1. Increase `STREAM_GOP_SIZE` (e.g., 90 for 3-second keyframes)
2. Enable low latency: `STREAM_LOW_LATENCY=true`
3. Reduce bitrate in `ecosystem.config.cjs`
4. Check network bandwidth

### CDP Capture Stalls

**Symptoms**:
- "CDP capture stalled" warnings
- No frames received for 30+ seconds

**Automatic Recovery**:
- System automatically attempts soft recovery
- Falls back to hard recovery if needed
- Switches to MediaRecorder after 6 failures

**Manual Recovery**:
```bash
bunx pm2 restart hyperscape-duel
```

## Performance Optimization

### Capture Mode Comparison

| Mode | CPU Usage | Latency | Quality | Stability |
|------|-----------|---------|---------|-----------|
| CDP | Low | Lowest | High | Excellent |
| WebCodecs | Lowest | Low | Highest | Good |
| MediaRecorder | High | Medium | Medium | Good |

**Recommendation**: Use CDP mode (default) for best balance of performance and stability.

### Encoding Tuning

**For lower latency** (faster playback start):
```bash
STREAM_LOW_LATENCY=true
STREAM_GOP_SIZE=30
```

**For better quality** (smoother playback):
```bash
STREAM_LOW_LATENCY=false
STREAM_GOP_SIZE=60
```

### Memory Management

The browser automatically restarts every 1 hour to prevent WebGPU memory leaks:
- Soft restart (no stream gap)
- Preserves FFmpeg process
- Configurable via `BROWSER_RESTART_INTERVAL_MS` in code

## Deployment Workflow

### 1. GitHub Secrets Configuration

Required secrets in repository settings:

```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
DATABASE_URL=postgresql://user:pass@host:5432/db
SOLANA_DEPLOYER_PRIVATE_KEY=base58-encoded-key
VAST_HOST=ssh.vast.ai
VAST_PORT=12345
VAST_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
```

### 2. Vast.ai Instance Setup

**Minimum requirements**:
- NVIDIA GPU (RTX 3060 or better recommended)
- 16GB RAM
- 50GB storage
- Ubuntu 22.04 or newer

**Template**:
```bash
# Install NVIDIA drivers and CUDA
apt-get update
apt-get install -y nvidia-driver-535 nvidia-cuda-toolkit

# Verify GPU
nvidia-smi
vulkaninfo --summary
```

### 3. Deployment Trigger

Push to `main` branch triggers `.github/workflows/deploy-vast.yml`:

1. SSH into Vast.ai instance
2. Write secrets to `/tmp/hyperscape-secrets.env`
3. Run `scripts/deploy-vast.sh`
4. Script validates GPU/WebGPU availability
5. Starts PM2 with `ecosystem.config.cjs`

### 4. Validation

After deployment, check:

```bash
# PM2 status
bunx pm2 status

# Streaming logs
bunx pm2 logs hyperscape-duel --lines 100

# Health endpoint
curl http://localhost:5555/health

# Streaming state
curl http://localhost:5555/api/streaming/state
```

## Monitoring

### Stream Health Metrics

Logged every 30 seconds:

```
[Stream Health] CDP FPS: 30 | Resolution: 1280x720 | Frames: 54321 | Dropped: 12 | BridgeDrops: 0 | Backpressure: off
```

**Metrics**:
- **CDP FPS**: Frames per second from screencast (should match `STREAM_FPS`)
- **Resolution**: Current frame dimensions (should match `STREAM_CAPTURE_WIDTH x STREAM_CAPTURE_HEIGHT`)
- **Frames**: Total frames captured
- **Dropped**: Frames dropped by CDP (browser too slow)
- **BridgeDrops**: Frames dropped by FFmpeg (encoding too slow)
- **Backpressure**: FFmpeg stdin buffer full

### RTMP Status File

Written to `packages/server/public/live/rtmp-status.json` every 2 seconds:

```json
{
  "active": true,
  "destinations": [
    {"name": "Twitch", "connected": true, "url": "rtmp://live.twitch.tv/app"},
    {"name": "Kick", "connected": true, "url": "rtmps://kick.com/app"},
    {"name": "X", "connected": true, "url": "rtmp://sg.pscp.tv:80/x"}
  ],
  "stats": {
    "bytesReceived": 1234567890,
    "bytesReceivedMB": "1177.38",
    "uptimeSeconds": 3600,
    "droppedFrames": 0,
    "backpressured": false
  },
  "captureMode": "cdp",
  "updatedAt": 1709089234567
}
```

## Security

### Secrets Management

**NEVER commit secrets to git**:
- Stream keys are passed via GitHub Secrets
- Written to `/tmp/hyperscape-secrets.env` (outside git repo)
- Copied to `packages/server/.env` after `git reset --hard`
- All secrets masked in logs

### Secret Rotation

To rotate stream keys:

1. Update GitHub Secrets in repository settings
2. Trigger redeployment (push to main or manual workflow dispatch)
3. Old keys are overwritten automatically

## Common Issues

### "NVIDIA driver failed to initialize"

Xorg started but fell back to software rendering (swrast).

**Fix**: Container needs full DRM access. Use Xvfb fallback:
```bash
# deploy-vast.sh automatically detects this and switches to Xvfb
```

### "Display :99 is not accessible"

Display server failed to start.

**Fix**: Check Xorg/Xvfb logs:
```bash
cat /var/log/Xorg.99.log
# or
ps aux | grep Xvfb
```

### "PulseAudio failed to start"

Audio capture unavailable.

**Fix**: Restart PulseAudio:
```bash
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1
pactl load-module module-null-sink sink_name=chrome_audio
```

### "FFmpeg process died"

Encoding pipeline crashed.

**Fix**: Check FFmpeg logs in PM2:
```bash
bunx pm2 logs hyperscape-duel --err --lines 200
```

Common causes:
- Invalid stream key
- Network connectivity issues
- Insufficient CPU for encoding

## References

- **Deployment Script**: `scripts/deploy-vast.sh`
- **Streaming Bridge**: `packages/server/src/streaming/rtmp-bridge.ts`
- **CDP Capture**: `packages/server/scripts/stream-to-rtmp.ts`
- **PM2 Config**: `ecosystem.config.cjs`
- **GitHub Workflow**: `.github/workflows/deploy-vast.yml`
