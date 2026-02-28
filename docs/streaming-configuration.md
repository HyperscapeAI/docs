# Streaming Configuration Guide

Comprehensive guide for configuring Hyperscape's RTMP streaming pipeline for live broadcasting to Twitch, Kick, X/Twitter, and other platforms.

## Overview

Hyperscape's streaming system captures gameplay using Chrome DevTools Protocol (CDP) and broadcasts to multiple RTMP destinations simultaneously using FFmpeg's tee muxer for efficient single-encode multi-output.

## Stream Capture Modes

### 1. CDP (Chrome DevTools Protocol) - Default
- **Method**: Chrome screencast API
- **Performance**: Fastest, most reliable
- **Latency**: ~100-200ms
- **Recommended**: Yes (default mode)

### 2. WebCodecs (Experimental)
- **Method**: Native VideoEncoder API
- **Performance**: Good, lower CPU usage
- **Latency**: ~50-100ms
- **Recommended**: Experimental, not production-ready

### 3. MediaRecorder (Legacy)
- **Method**: Browser MediaRecorder API
- **Performance**: Slower, higher CPU
- **Latency**: ~200-300ms
- **Recommended**: Fallback only

## Production Client Build

### Problem
Vite dev server uses JIT compilation, causing:
- Slow initial page loads (>180s)
- Browser navigation timeouts
- High CPU usage during module compilation

### Solution
Enable production client build mode:

```bash
# In packages/server/.env or root .env
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

**Benefits**:
- Pre-built assets served via `vite preview`
- Page loads in <10s instead of >180s
- No on-demand module compilation
- Significantly lower CPU usage

## WebGPU Configuration

### Browser Requirements
- Chrome 113+ (recommended)
- Edge 113+
- Safari 18+ (macOS 15+)
- WebGPU must be enabled and working

### Chrome Executable Path
Specify explicit Chrome path for reliable WebGPU:

```bash
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

**Common paths**:
- Ubuntu/Debian: `/usr/bin/google-chrome-unstable`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`

### GPU Sandbox Bypass (Containers)
Required for GPU access in Docker/Vast.ai:

```bash
# Chrome flags (automatically added by stream-to-rtmp.ts)
--disable-gpu-sandbox
--disable-setuid-sandbox
```

### WebGPU Initialization Timeouts
Prevent indefinite hangs on misconfigured GPU servers:

```bash
# Adapter request timeout: 30s
# Renderer init timeout: 60s
# Preflight test: Runs on blank page before game load
```

## Display Configuration

### Xorg (Best Performance)
```bash
DISPLAY=:0
DUEL_CAPTURE_USE_XVFB=false
STREAM_CAPTURE_HEADLESS=false
```

**Requirements**:
- DRI/DRM device access (`/dev/dri/card*`)
- NVIDIA X driver installed
- Real X server running

### Xvfb (Virtual Framebuffer)
```bash
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
STREAM_CAPTURE_HEADLESS=false
```

**Requirements**:
- Xvfb installed
- NVIDIA GPU accessible via Vulkan
- Chrome uses ANGLE/Vulkan backend

### Ozone Headless (Experimental)
```bash
DISPLAY=
STREAM_CAPTURE_OZONE_HEADLESS=true
STREAM_CAPTURE_USE_EGL=false
```

**Requirements**:
- NVIDIA GPU with Vulkan
- Chrome's `--ozone-platform=headless` support
- No X server needed

## Audio Capture

### PulseAudio Setup
```bash
# Enable audio capture
STREAM_AUDIO_ENABLED=true

# Virtual sink device
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# User-mode PulseAudio runtime
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

### Audio Configuration
```bash
# Create virtual audio sink
pactl load-module module-null-sink sink_name=chrome_audio

# Verify sink exists
pactl list sinks | grep chrome_audio

# FFmpeg captures from monitor source
# (automatically configured by stream-to-rtmp.ts)
```

## Encoding Settings

### Video Encoding
```bash
# Codec: H.264
# Preset: veryfast (default)
# Tune: film (default) or zerolatency (low-latency mode)

# Low-latency mode (faster playback start)
STREAM_LOW_LATENCY=true

# GOP size in frames (default: 60)
STREAM_GOP_SIZE=60

# Bitrate (default: 6000k)
STREAM_BITRATE=6000k

# Resolution (default: 1920x1080)
STREAM_WIDTH=1920
STREAM_HEIGHT=1080

# Frame rate (default: 30)
STREAM_FPS=30
```

### Audio Encoding
```bash
# Codec: AAC
# Bitrate: 128k (default)
# Sample rate: 44100 Hz
# Channels: 2 (stereo)

# Audio buffering
# thread_queue_size=1024
# Async resampling enabled
```

### Buffer Configuration
```bash
# Buffer multiplier: 2x (default)
# Reduced from 4x to prevent backpressure buildup

# Health check timeout: 5s
# Data timeout: 15s
# Faster failure detection
```

## RTMP Destinations

### Twitch
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij

# Optional ingest override
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
```

Get your stream key from: https://dashboard.twitch.tv/settings/stream

### Kick
```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
```

Get your stream key from: https://kick.com/dashboard/settings/stream

### X/Twitter
```bash
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path
```

Get RTMP URL from: Media Studio → Producer → Create Broadcast → Create Source

**Note**: Requires X Premium subscription for desktop streaming

### YouTube (Optional)
```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

**Note**: YouTube has higher latency (~15-20s) compared to Twitch/Kick (~3-5s)

### Custom Destinations
```bash
# JSON array format
RTMP_DESTINATIONS_JSON=[
  {
    "name": "Custom Server",
    "url": "rtmp://your-server/live",
    "key": "your-stream-key",
    "enabled": true
  }
]
```

## Stability Features

### Automatic Browser Restart
Prevents WebGPU OOM crashes:

```bash
# Restart interval (default: 45 minutes)
BROWSER_RESTART_INTERVAL_MS=2700000
```

**Behavior**:
- Browser closes gracefully
- New browser instance launches
- Stream reconnects automatically
- Brief interruption (~2-3 seconds)

### Viewport Recovery
Automatic recovery on resolution mismatch:

```bash
# Detects CDP frame resolution changes
# Restores viewport to target resolution
# Prevents stretched/corrupted video
```

### Probe Timeout Handling
Prevents hanging on unresponsive browser:

```bash
# Probe timeout: 5s per evaluate call
# Retry limit: 5 consecutive timeouts
# Behavior: Proceeds with capture after limit
```

### CDP Session Recovery
```bash
# Recovery mode flag prevents double-handling
# Automatic session cleanup on recovery
# Prevents memory leaks during reconnection
```

## Health Monitoring

### Stream Health Endpoint
```bash
# Check RTMP bridge status
curl http://localhost:8765/health

# Response includes:
# - Capture status
# - FFmpeg process status
# - Resolution
# - Uptime
```

### Streaming State API
```bash
# Get current duel state
curl http://localhost:5555/api/streaming/state

# Response includes:
# - Current duel info
# - Agent stats
# - Combat status
# - Cycle phase
```

### Logs
```bash
# PM2 logs
pm2 logs rtmp-bridge
pm2 logs duel-stack

# FFmpeg output
# Logged to PM2 rtmp-bridge process
```

## Performance Optimization

### Reduce Latency
```bash
# Enable low-latency mode
STREAM_LOW_LATENCY=true

# Reduce GOP size
STREAM_GOP_SIZE=30

# Use zerolatency tune
# (automatically enabled when STREAM_LOW_LATENCY=true)
```

### Reduce CPU Usage
```bash
# Use production client build
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true

# Lower resolution
STREAM_WIDTH=1280
STREAM_HEIGHT=720

# Lower frame rate
STREAM_FPS=24
```

### Reduce Bandwidth
```bash
# Lower bitrate
STREAM_BITRATE=4000k

# Lower resolution
STREAM_WIDTH=1280
STREAM_HEIGHT=720
```

## Testing

### Local Testing
```bash
# Start local RTMP server
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure test destination
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# View test stream
ffplay rtmp://localhost:1935/live/test
```

### Verify Stream Quality
```bash
# Check stream info
ffprobe rtmp://localhost:1935/live/test

# Monitor bitrate
ffmpeg -i rtmp://localhost:1935/live/test -f null - 2>&1 | grep bitrate
```

## See Also

- [vast-ai-deployment.md](vast-ai-deployment.md) - Vast.ai GPU server deployment
- [duel-stack.md](duel-stack.md) - Local duel stack setup
- `scripts/stream-to-rtmp.ts` - Stream capture implementation
- `packages/server/.env.example` - Complete environment variable reference
