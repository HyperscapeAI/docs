# Streaming Configuration Guide

This guide covers the complete streaming configuration for Hyperscape, including GPU rendering, audio capture, video encoding, and multi-platform RTMP streaming.

## Overview

Hyperscape streams live gameplay to multiple platforms (Twitch, Kick, X/Twitter) using:

- **CDP (Chrome DevTools Protocol)** for frame capture
- **WebGPU** for GPU-accelerated rendering
- **PulseAudio** for audio capture
- **FFmpeg** for H.264 encoding and RTMP fanout

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Chrome (WebGPU)                                             │
│ ┌─────────────────┐                                         │
│ │ Game Client     │                                         │
│ │ (Three.js)      │                                         │
│ └────────┬────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│ ┌─────────────────┐      ┌──────────────┐                  │
│ │ WebGPU Renderer │─────▶│ PulseAudio   │                  │
│ │ (TSL Shaders)   │      │ chrome_audio │                  │
│ └────────┬────────┘      └──────┬───────┘                  │
└──────────┼────────────────────────┼──────────────────────────┘
           │                        │
           ▼                        ▼
    ┌──────────────┐         ┌──────────────┐
    │ CDP Session  │         │ FFmpeg Audio │
    │ screencast   │         │ Capture      │
    └──────┬───────┘         └──────┬───────┘
           │                        │
           ▼                        ▼
    ┌──────────────────────────────────┐
    │ FFmpeg H.264 Encoder             │
    │ (Hardware Accelerated)           │
    └──────┬───────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ RTMP Tee Muxer                   │
    │ (Single encode, multi-output)    │
    └──────┬───────────────────────────┘
           │
           ├─────▶ Twitch
           ├─────▶ Kick
           └─────▶ X/Twitter
```

## GPU Rendering Setup

### Requirements

- **NVIDIA GPU** with Vulkan support
- **Display server**: Xorg or Xvfb (headless mode NOT supported)
- **Vulkan ICD**: NVIDIA Vulkan driver
- **Chrome Dev channel**: For WebGPU support

### Rendering Modes

The deploy script tries modes in order:

1. **Xorg with NVIDIA** (best performance):
   ```bash
   # Requires DRI/DRM device access
   ls -la /dev/dri/card0
   
   # Start Xorg
   Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf
   export DISPLAY=:99
   ```

2. **Xvfb with NVIDIA Vulkan** (fallback):
   ```bash
   # Virtual framebuffer + GPU rendering
   Xvfb :99 -screen 0 1920x1080x24 +extension GLX
   export DISPLAY=:99
   export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
   ```

3. **Headless mode**: NOT SUPPORTED
   - WebGPU requires a display server
   - Deployment fails if neither Xorg nor Xvfb works

### Environment Variables

```bash
# Display configuration (auto-set by deploy script)
DISPLAY=:99
GPU_RENDERING_MODE=xorg  # or xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=false  # true for Xvfb, false for Xorg

# Vulkan configuration
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Stream capture settings
STREAM_CAPTURE_HEADLESS=false  # Must be false for WebGPU
STREAM_CAPTURE_CHANNEL=chrome-dev  # Use Chrome Dev for WebGPU
STREAM_CAPTURE_ANGLE=vulkan  # ANGLE backend (vulkan for NVIDIA)
```

### Verification

```bash
# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check display server
echo $DISPLAY
xdpyinfo -display $DISPLAY

# Check Chrome
google-chrome-unstable --version
```

## Audio Capture Setup

### PulseAudio Configuration

Audio is captured via PulseAudio virtual sink:

```bash
# Install PulseAudio
apt-get install -y pulseaudio pulseaudio-utils

# Create virtual sink
pactl load-module module-null-sink sink_name=chrome_audio

# Set as default
pactl set-default-sink chrome_audio

# Verify
pactl list short sinks
```

### Environment Variables

```bash
# Enable audio capture
STREAM_AUDIO_ENABLED=true

# PulseAudio monitor device
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# PulseAudio server socket
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Runtime directory
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

### Troubleshooting Audio

```bash
# Check PulseAudio status
pulseaudio --check

# List sinks
pactl list short sinks

# Test audio capture
ffmpeg -f pulse -i chrome_audio.monitor -t 5 test.wav

# Check Chrome audio output
pactl list sink-inputs
```

## Video Capture Modes

### CDP Mode (Recommended)

**Chrome DevTools Protocol** screencast capture - fastest and most reliable.

```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80  # JPEG quality (1-100)
STREAM_FPS=30
```

**How it works**:
1. CDP `Page.startScreencast` captures frames from compositor
2. Frames delivered as base64 JPEG
3. Decoded and piped directly to FFmpeg stdin
4. No browser-side encoding overhead

**Performance**: ~2-3x faster than MediaRecorder mode

### MediaRecorder Mode (Legacy)

**MediaRecorder API** with WebSocket transfer - legacy fallback.

```bash
STREAM_CAPTURE_MODE=mediarecorder
```

**How it works**:
1. Browser encodes frames with MediaRecorder (VP8/VP9)
2. Chunks sent via WebSocket to Node.js
3. FFmpeg re-encodes to H.264
4. Double encoding overhead

**Use when**: CDP mode fails or for debugging

### WebCodecs Mode (Experimental)

**VideoEncoder API** with direct H.264 encoding - experimental.

```bash
STREAM_CAPTURE_MODE=webcodecs
```

**Status**: Experimental, may not work on all platforms

## Video Encoding Settings

### Basic Settings

```bash
# Resolution (must be even numbers)
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Frame rate
STREAM_FPS=30

# Bitrate (bits per second)
STREAM_BITRATE=4500000  # 4.5 Mbps

# x264 preset (speed vs quality tradeoff)
STREAM_PRESET=veryfast  # ultrafast | veryfast | fast | medium | slow
```

### Advanced Settings

```bash
# Low-latency mode (faster playback start, higher bitrate)
STREAM_LOW_LATENCY=false  # true = tune=zerolatency, false = tune=film

# GOP size (keyframe interval in frames)
STREAM_GOP_SIZE=60  # 2 seconds at 30fps

# Buffer size (default: 4x bitrate)
STREAM_BUFFER_SIZE=18000000  # 18 Mbps for 4.5 Mbps bitrate
```

### Preset Comparison

| Preset | Speed | Quality | CPU Usage | Bitrate Efficiency |
|--------|-------|---------|-----------|-------------------|
| ultrafast | Fastest | Lowest | Low | Poor |
| veryfast | Very Fast | Low | Medium | Fair |
| fast | Fast | Medium | Medium | Good |
| medium | Medium | High | High | Very Good |
| slow | Slow | Very High | Very High | Excellent |

**Recommendation**: Use `veryfast` for streaming (good balance of speed and quality).

## RTMP Destinations

### Twitch

```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app  # Optional override
```

Get your stream key from: [dashboard.twitch.tv/settings/stream](https://dashboard.twitch.tv/settings/stream)

### Kick

```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
```

Get your stream key from: [kick.com/dashboard/settings/stream](https://kick.com/dashboard/settings/stream)

### X/Twitter

```bash
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

Get RTMP URL from: Media Studio → Producer → Create Broadcast → Create Source

**Note**: Requires X Premium subscription for desktop streaming.

### YouTube (Disabled by Default)

```bash
# Explicitly disable YouTube
YOUTUBE_STREAM_KEY=
```

To enable YouTube streaming:

```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

Get your stream key from: [studio.youtube.com](https://studio.youtube.com) → Go Live → Stream

### Custom Destinations

```bash
# Single custom destination
CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key

# Multiple destinations via JSON
RTMP_DESTINATIONS_JSON=[
  {
    "name": "Custom1",
    "url": "rtmp://server1/live",
    "key": "key1",
    "enabled": true
  },
  {
    "name": "Custom2",
    "url": "rtmp://server2/live",
    "key": "key2",
    "enabled": true
  }
]
```

## Production Client Build

**Problem**: Vite's dev server uses JIT compilation, causing 60-180s page load times that trigger browser timeouts.

**Solution**: Use pre-built client for streaming.

### Configuration

```bash
# Enable production client build
DUEL_USE_PRODUCTION_CLIENT=true

# Or set NODE_ENV
NODE_ENV=production
```

### How It Works

1. Duel stack checks if client is built: `packages/client/dist/`
2. If not built, runs: `bun run build:client`
3. Starts `vite preview` instead of `vite dev`
4. Serves pre-built assets (loads in <5s vs 60-180s)

### Benefits

- **Faster page loads**: <5 seconds (vs 60-180s for dev server)
- **No browser timeouts**: RTMP bridge loads within 180s limit
- **Consistent performance**: No JIT compilation during streaming
- **Production-ready**: Same build used in production

## Stream Health Monitoring

### Status Endpoints

```bash
# Streaming state
curl http://localhost:5555/api/streaming/state

# Duel context
curl http://localhost:5555/api/streaming/duel-context

# RTMP status file
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

### Health Checks

The streaming system monitors:

- **Frame rate**: Target 30 FPS
- **Resolution**: 1280x720 (configurable)
- **Audio sync**: PulseAudio monitor active
- **RTMP connections**: All destinations connected
- **Memory usage**: Process RSS and heap
- **Dropped frames**: CDP and FFmpeg drops

### Recovery Mechanisms

1. **CDP Stall Recovery**:
   - Detects no-traffic periods (4x 30s intervals)
   - Soft recovery: Restart CDP screencast
   - Hard recovery: Restart browser
   - Fallback: Switch to MediaRecorder mode

2. **Resolution Mismatch Recovery**:
   - Detects frame size != viewport size
   - Auto-resizes viewport after 10 mismatched frames
   - Logs resolution changes

3. **Browser Rotation**:
   - Restarts browser every hour to clear memory leaks
   - Prevents WebGPU memory accumulation
   - Configurable via `BROWSER_RESTART_INTERVAL_MS`

### Monitoring Commands

```bash
# PM2 logs
bunx pm2 logs hyperscape-duel

# Filter for streaming events
bunx pm2 logs hyperscape-duel | grep -iE "rtmp|ffmpeg|stream|capture"

# Check process status
bunx pm2 status

# Monitor resources
bunx pm2 monit
```

## Anti-Cheat Timing

### Default Delays

| Platform | Default Delay | Notes |
|----------|--------------|-------|
| Twitch | 12000ms | Lower latency |
| YouTube | 15000ms | Higher latency |
| HLS | 4000ms | Local streaming |

### Configuration

```bash
# Set canonical platform
STREAMING_CANONICAL_PLATFORM=twitch  # youtube | twitch | hls

# Override delay
STREAMING_PUBLIC_DELAY_MS=12000

# Viewer access token (optional)
STREAMING_VIEWER_ACCESS_TOKEN=your-secret-token
```

### Gated Viewers

When `STREAMING_PUBLIC_DELAY_MS > 0`, live WebSocket viewers are restricted to:

- **Loopback clients**: `localhost` or `127.0.0.1`
- **Authenticated clients**: Provide `streamToken` query parameter

The RTMP bridge automatically appends `streamToken` to capture URLs.

## Troubleshooting

### Black Frames / No Video

1. **Check GPU access**:
   ```bash
   nvidia-smi
   vulkaninfo --summary
   ```

2. **Verify display server**:
   ```bash
   echo $DISPLAY
   xdpyinfo -display $DISPLAY
   ```

3. **Check Chrome launch**:
   ```bash
   google-chrome-unstable --version
   ps aux | grep chrome
   ```

4. **Review logs**:
   ```bash
   bunx pm2 logs hyperscape-duel --lines 200 | grep -i error
   ```

### No Audio

1. **Check PulseAudio**:
   ```bash
   pulseaudio --check
   pactl list short sinks | grep chrome_audio
   ```

2. **Verify Chrome audio output**:
   ```bash
   pactl list sink-inputs
   ```

3. **Test audio capture**:
   ```bash
   ffmpeg -f pulse -i chrome_audio.monitor -t 5 test.wav
   ```

4. **Check environment**:
   ```bash
   echo $PULSE_SERVER
   echo $XDG_RUNTIME_DIR
   ```

### RTMP Connection Failures

1. **Verify stream keys**:
   ```bash
   # Check environment (masked)
   env | grep -E "TWITCH|KICK|X_" | sed 's/=.*/=***/'
   ```

2. **Test RTMP endpoint**:
   ```bash
   # Test Twitch
   ffmpeg -re -f lavfi -i testsrc -t 10 \
     -f flv "rtmp://live.twitch.tv/app/$TWITCH_STREAM_KEY"
   ```

3. **Check FFmpeg logs**:
   ```bash
   bunx pm2 logs hyperscape-duel | grep -i "rtmp\|ffmpeg"
   ```

4. **Verify RTMP status**:
   ```bash
   cat /root/hyperscape/packages/server/public/live/rtmp-status.json
   ```

### High CPU Usage

1. **Lower encoding preset**:
   ```bash
   STREAM_PRESET=ultrafast  # Fastest, lowest quality
   ```

2. **Reduce resolution**:
   ```bash
   STREAM_CAPTURE_WIDTH=1280
   STREAM_CAPTURE_HEIGHT=720
   ```

3. **Disable audio**:
   ```bash
   STREAM_AUDIO_ENABLED=false
   ```

4. **Use hardware encoding** (if available):
   ```bash
   # NVIDIA NVENC (requires CUDA)
   STREAM_ENCODER=h264_nvenc
   ```

### Memory Leaks

1. **Enable browser rotation**:
   ```bash
   BROWSER_RESTART_INTERVAL_MS=3600000  # 1 hour
   ```

2. **Monitor memory**:
   ```bash
   bunx pm2 monit
   ```

3. **Check for leaks**:
   ```bash
   # Process RSS should stabilize after initial ramp-up
   watch -n 5 'ps aux | grep chrome | grep -v grep'
   ```

## Performance Tuning

### Low-Latency Streaming

For minimal latency (e.g., interactive streams):

```bash
STREAM_LOW_LATENCY=true
STREAM_GOP_SIZE=30  # 1 second at 30fps
STREAM_PRESET=ultrafast
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0
```

**Tradeoffs**: Higher bitrate, lower quality, faster playback start

### High-Quality Streaming

For best quality (e.g., VODs, highlights):

```bash
STREAM_LOW_LATENCY=false
STREAM_GOP_SIZE=60  # 2 seconds at 30fps
STREAM_PRESET=medium
STREAM_BITRATE=6000000  # 6 Mbps
```

**Tradeoffs**: Higher CPU usage, slower playback start, better compression

### Balanced (Recommended)

```bash
STREAM_LOW_LATENCY=false
STREAM_GOP_SIZE=60
STREAM_PRESET=veryfast
STREAM_BITRATE=4500000  # 4.5 Mbps
STREAM_AUDIO_ENABLED=true
```

## Related Documentation

- [docs/duel-stack.md](duel-stack.md) - Duel stack overview
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [packages/server/scripts/stream-to-rtmp.ts](../packages/server/scripts/stream-to-rtmp.ts) - Streaming implementation
- [.env.example](../.env.example) - Root environment variables
- [packages/server/.env.example](../packages/server/.env.example) - Server environment variables

## Examples

### Local Testing

```bash
# Start local RTMP server
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure test destination
export CUSTOM_RTMP_URL=rtmp://localhost:1935/live
export CUSTOM_STREAM_KEY=test

# Start streaming
bun run stream:rtmp

# View stream
ffplay rtmp://localhost:1935/live/test
```

### Production Deployment

```bash
# Set stream keys
export TWITCH_STREAM_KEY=live_123456789_abcdefghij
export KICK_STREAM_KEY=your-kick-key
export KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
export X_STREAM_KEY=your-x-key
export X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Disable YouTube
export YOUTUBE_STREAM_KEY=

# Enable production client build
export DUEL_USE_PRODUCTION_CLIENT=true

# Start duel stack
bun run duel
```

### Vast.ai Deployment

```bash
# Deploy via GitHub Actions
# Workflow: .github/workflows/deploy-vast.yml

# Or manually
ssh root@vast-instance
cd /root/hyperscape
./scripts/deploy-vast.sh
```

The deploy script automatically:
1. Configures GPU rendering (Xorg or Xvfb)
2. Sets up PulseAudio
3. Installs Chrome Dev
4. Configures environment variables
5. Starts duel stack via PM2
