# Vast.ai GPU Streaming Architecture

Hyperscape streams live gameplay to Twitch, Kick, and X/Twitter using GPU-accelerated rendering on Vast.ai instances.

## Overview

The streaming pipeline captures WebGPU-rendered gameplay from Chrome and encodes it to RTMP using FFmpeg. This requires careful GPU setup because **WebGPU is mandatory** - there is no WebGL fallback.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Vast.ai Container (NVIDIA GPU)                              │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Xorg/Xvfb    │─────▶│ Chrome       │                    │
│  │ Display :99  │      │ (WebGPU)     │                    │
│  └──────────────┘      └──────┬───────┘                    │
│                               │                             │
│                               │ CDP Screencast              │
│                               ▼                             │
│                        ┌──────────────┐                    │
│                        │ FFmpeg       │                    │
│                        │ (H.264)      │                    │
│                        └──────┬───────┘                    │
│                               │                             │
│                               │ RTMP Tee Muxer             │
│                ┌──────────────┼──────────────┐             │
│                ▼              ▼              ▼             │
│           ┌────────┐     ┌────────┐    ┌────────┐         │
│           │ Twitch │     │  Kick  │    │   X    │         │
│           └────────┘     └────────┘    └────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## GPU Rendering Modes

The deployment script (`scripts/deploy-vast.sh`) tries multiple approaches in order:

### 1. Xorg with NVIDIA (Preferred)

**Requirements:**
- DRI/DRM devices available (`/dev/dri/card0`)
- NVIDIA drivers installed
- X server can initialize with GPU

**Configuration:**
```bash
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=false
GPU_RENDERING_MODE=xorg
```

**How it works:**
- Xorg runs headless with `AllowEmptyInitialConfiguration`
- Chrome connects to X display and uses NVIDIA GPU via GLX
- WebGPU uses ANGLE/Vulkan backend
- Best performance, lowest latency

### 2. Xvfb with NVIDIA Vulkan (Fallback)

**Requirements:**
- NVIDIA GPU accessible via Vulkan
- Xvfb installed
- No DRI/DRM devices needed

**Configuration:**
```bash
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
GPU_RENDERING_MODE=xvfb-vulkan
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

**How it works:**
- Xvfb provides virtual X11 display (software framebuffer)
- Chrome uses NVIDIA GPU for rendering via ANGLE/Vulkan
- CDP captures frames from Chrome's internal GPU compositor
- Slightly higher latency than Xorg but still GPU-accelerated

### 3. Headless Mode (NOT SUPPORTED)

**Why it doesn't work:**
- Chrome's headless mode uses software rendering
- WebGPU requires hardware GPU access
- Deployment script will FAIL if neither Xorg nor Xvfb can start

## Audio Capture

### PulseAudio Setup

The deployment script configures PulseAudio for game audio capture:

1. **Virtual Sink**: Creates `chrome_audio` null sink
2. **Chrome Output**: Chrome outputs audio to `chrome_audio`
3. **FFmpeg Input**: FFmpeg captures from `chrome_audio.monitor`

**Configuration:**
```bash
# PulseAudio runs in user mode
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Chrome uses PulseAudio
--alsa-output-device=pulse
--audio-output-channels=2

# FFmpeg captures from monitor
-f pulse -i chrome_audio.monitor
```

### Audio Sync

FFmpeg uses these settings to maintain audio/video sync:

```bash
# Audio input buffering
-thread_queue_size 1024
-use_wallclock_as_timestamps 1

# Async resampling to recover from drift
-af aresample=async=1000:first_pts=0
```

## RTMP Multi-Streaming

### Destinations

The streaming bridge supports simultaneous streaming to multiple platforms:

- **Twitch**: `rtmp://live.twitch.tv/app/{TWITCH_STREAM_KEY}`
- **Kick**: `rtmps://fa723fc1b171.global-contribute.live-video.net/app/{KICK_STREAM_KEY}`
- **X/Twitter**: `rtmp://sg.pscp.tv:80/x/{X_STREAM_KEY}`
- **YouTube**: Explicitly disabled (set `YOUTUBE_STREAM_KEY=""`)

### FFmpeg Tee Muxer

Single encode, multiple outputs:

```bash
ffmpeg -i input.jpeg \
  -f flv -c:v libx264 -preset veryfast -tune film \
  -b:v 4500k -maxrate 4500k -bufsize 18000k \
  -f tee \
  "[f=flv]rtmp://twitch|[f=flv]rtmps://kick|[f=flv]rtmp://x"
```

**Benefits:**
- Single H.264 encode (saves CPU)
- Consistent quality across platforms
- Automatic retry on individual platform failures

## Environment Variables

### Required Secrets

Set via GitHub Actions secrets and injected by `deploy-vast.yml`:

```bash
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=sk_...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
SOLANA_DEPLOYER_PRIVATE_KEY=...  # Base58 private key
JWT_SECRET=...
ARENA_EXTERNAL_BET_WRITE_KEY=...
```

### GPU Configuration

```bash
# Display server
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=false  # or true for Xvfb mode
GPU_RENDERING_MODE=xorg      # or xvfb-vulkan

# Vulkan
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# WebGPU (always enabled)
STREAM_CAPTURE_DISABLE_WEBGPU=false
```

### Streaming Configuration

```bash
# Capture mode
STREAM_CAPTURE_MODE=cdp              # CDP screencast (fastest)
STREAM_CAPTURE_CHANNEL=chrome-dev    # Use Chrome Dev for WebGPU
STREAM_CAPTURE_ANGLE=vulkan          # ANGLE backend
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Audio
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Quality
STREAM_CDP_QUALITY=80                # JPEG quality (1-100)
STREAM_FPS=30                        # Target FPS
```

## Deployment Process

### 1. GPU Validation

```bash
# Check NVIDIA GPU
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader

# Check Vulkan
vulkaninfo --summary
```

### 2. Display Server Setup

```bash
# Try Xorg first (if DRI devices exist)
if [ -d "/dev/dri" ]; then
  Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf
fi

# Fallback to Xvfb
if [ "$RENDERING_MODE" = "unknown" ]; then
  Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX
fi

# Verify display is accessible
xdpyinfo -display :99
```

### 3. PulseAudio Setup

```bash
# Create virtual sink
pulseaudio --start
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

### 4. Database Migration

```bash
cd packages/server
bunx drizzle-kit push --force
```

### 5. PM2 Startup

```bash
bunx pm2 start ecosystem.config.cjs
bunx pm2 save
```

## Troubleshooting

### WebGPU Not Available

**Symptoms:**
- Black screen in stream
- Console errors: "WebGPU not supported"
- Chrome falls back to software rendering

**Diagnosis:**
```bash
# Check if Xorg is using NVIDIA
grep -i nvidia /var/log/Xorg.99.log

# Check for software rendering fallback
grep -i swrast /var/log/Xorg.99.log

# Check Vulkan
vulkaninfo | grep -i nvidia
```

**Fix:**
- Ensure NVIDIA drivers are installed
- Verify `VK_ICD_FILENAMES` points to NVIDIA ICD
- Check that `DISPLAY` is set and accessible

### Audio Not Streaming

**Symptoms:**
- Video works but no audio
- FFmpeg errors: "Cannot open audio device"

**Diagnosis:**
```bash
# Check PulseAudio status
pulseaudio --check && echo "Running" || echo "Not running"

# List sinks
pactl list short sinks

# Check for chrome_audio sink
pactl list short sinks | grep chrome_audio
```

**Fix:**
```bash
# Restart PulseAudio
pulseaudio --kill
pulseaudio --start

# Recreate sink
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

### Stream Buffering/Stalling

**Symptoms:**
- Viewers see buffering
- Inconsistent frame rate

**Diagnosis:**
```bash
# Check FFmpeg logs
pm2 logs hyperscape-duel | grep -i ffmpeg

# Check for dropped frames
pm2 logs hyperscape-duel | grep -i "drop"
```

**Fix:**
- Increase bitrate buffer: `STREAM_BITRATE_BUFFER_MULTIPLIER=4`
- Use `tune=film` instead of `tune=zerolatency`
- Increase `thread_queue_size` for input buffering

### Deployment Fails

**Common causes:**
1. **No GPU**: `nvidia-smi` fails
2. **No Vulkan**: `vulkaninfo` fails
3. **No Display**: Both Xorg and Xvfb fail to start
4. **Missing Secrets**: `DATABASE_URL` or stream keys not set

**Recovery:**
```bash
# Check deployment logs
cat /root/hyperscape/logs/duel-out.log

# Check PM2 status
bunx pm2 status

# Restart deployment
bunx pm2 restart hyperscape-duel
```

## Performance Tuning

### Video Encoding

```bash
# Faster encoding (lower quality)
STREAM_PRESET=ultrafast

# Better quality (higher CPU)
STREAM_PRESET=fast

# Low latency (for interactive streams)
STREAM_LOW_LATENCY=true  # Uses tune=zerolatency

# Smooth playback (for VODs)
STREAM_LOW_LATENCY=false # Uses tune=film
```

### Audio Buffering

```bash
# Increase audio buffer (reduces dropouts)
STREAM_AUDIO_THREAD_QUEUE_SIZE=2048

# Disable audio (video only)
STREAM_AUDIO_ENABLED=false
```

### GPU Memory

```bash
# Restart browser every hour to clear WebGPU memory leaks
BROWSER_RESTART_INTERVAL_MS=3600000
```

## Monitoring

### Health Checks

```bash
# Server health
curl http://localhost:5555/health

# Streaming state
curl http://localhost:5555/api/streaming/state

# RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

### Logs

```bash
# All logs
pm2 logs hyperscape-duel

# Streaming only
pm2 logs hyperscape-duel | grep -iE "rtmp|ffmpeg|stream|capture"

# Errors only
pm2 logs hyperscape-duel --err
```

### Metrics

```bash
# Process stats
pm2 show hyperscape-duel

# GPU usage
nvidia-smi dmon -s u

# Network bandwidth
iftop -i eth0
```

## Related Files

- `scripts/deploy-vast.sh` - Deployment script with GPU setup
- `packages/server/scripts/stream-to-rtmp.ts` - Streaming bridge
- `ecosystem.config.cjs` - PM2 configuration
- `.github/workflows/deploy-vast.yml` - CI/CD workflow
- `packages/server/src/streaming/rtmp-bridge.ts` - RTMP multiplexer
