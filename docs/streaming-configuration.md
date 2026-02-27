# Streaming Configuration Reference

Complete reference for Hyperscape's RTMP streaming system with WebGPU rendering.

## Overview

Hyperscape's streaming pipeline captures gameplay via Chrome DevTools Protocol (CDP) and streams to multiple platforms simultaneously (Twitch, Kick, X/Twitter). The system requires WebGPU for rendering and uses NVIDIA GPU acceleration via Vulkan.

## Critical Requirements

### WebGPU is REQUIRED
- **NO WebGL fallback** - All shaders use TSL (Three Shading Language)
- Chrome must have WebGPU enabled and working
- NVIDIA GPU with Vulkan support required for server/streaming
- Headless Chrome modes that don't support WebGPU will NOT work

### GPU Rendering Modes

The deployment script (`scripts/deploy-vast.sh`) tries multiple approaches in order:

1. **Xorg with NVIDIA** (preferred):
   - Full hardware acceleration
   - Best performance and quality
   - Requires DRI/DRM device access
   - Config: `/etc/X11/xorg-nvidia-headless.conf`

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer for X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures from Chrome's internal GPU rendering
   - Works in containers without DRM access

3. **Deployment FAILS** if neither works:
   - No soft fallback to headless mode
   - WebGPU is non-negotiable

## Environment Variables

### GPU & Display Configuration

```bash
# X Server Display
DISPLAY=:99                                                    # X server display number

# Vulkan Driver (Force NVIDIA-only to avoid Mesa conflicts)
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json     # NVIDIA Vulkan ICD path

# Rendering Mode (set automatically by deploy script)
GPU_RENDERING_MODE=xorg                                       # xorg | xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=false                                   # true if using Xvfb

# WebGPU Enforcement
STREAM_CAPTURE_HEADLESS=false                                 # Must be false for WebGPU
STREAM_CAPTURE_DISABLE_WEBGPU=false                           # Deprecated, always false
DUEL_FORCE_WEBGL_FALLBACK=false                               # Removed, always false
```

### Chrome Configuration

```bash
# Browser Channel (Chrome Dev has WebGPU enabled by default)
STREAM_CAPTURE_CHANNEL=chrome-dev                             # Playwright channel name

# ANGLE Backend (Vulkan required for WebGPU)
STREAM_CAPTURE_ANGLE=vulkan                                   # vulkan | metal (macOS only)

# Capture Mode
STREAM_CAPTURE_MODE=cdp                                       # cdp | mediarecorder | webcodecs

# Viewport Resolution
STREAM_CAPTURE_WIDTH=1280                                     # Must be even number
STREAM_CAPTURE_HEIGHT=720                                     # Must be even number

# Frame Rate
STREAM_FPS=30                                                 # Target FPS (default: 30)

# CDP Quality (JPEG compression for CDP mode)
STREAM_CDP_QUALITY=80                                         # 1-100 (default: 80)
```

### Audio Configuration

```bash
# PulseAudio Setup
XDG_RUNTIME_DIR=/tmp/pulse-runtime                            # PulseAudio runtime directory
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native             # PulseAudio socket path

# Audio Capture
STREAM_AUDIO_ENABLED=true                                     # Enable audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor                       # PulseAudio monitor device
```

### RTMP Destinations

```bash
# Twitch
TWITCH_STREAM_KEY=live_xxxxx_yyyyy                           # Twitch stream key
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app                    # Optional (auto-detected)

# Kick (uses RTMPS)
KICK_STREAM_KEY=sk_us-west-2_xxxxx                           # Kick stream key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# X/Twitter
X_STREAM_KEY=xxxxx                                            # X stream key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x                            # X RTMP ingest URL

# YouTube (explicitly disabled)
YOUTUBE_STREAM_KEY=                                           # Empty string disables YouTube
```

### Streaming Behavior

```bash
# Platform Selection
STREAMING_CANONICAL_PLATFORM=twitch                           # Primary platform for timing

# Latency & Buffering
STREAMING_PUBLIC_DELAY_MS=0                                   # Public data delay (0 for live betting)
STREAM_LOW_LATENCY=false                                      # Use 'zerolatency' tune (default: false)

# Recovery & Health
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000                      # CDP recovery timeout
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6                        # Max failures before fallback

# Game URL
GAME_URL=http://localhost:3333/?page=stream                   # Primary game URL
GAME_FALLBACK_URLS=http://localhost:3333/?embedded=true&mode=spectator  # Fallback URLs
```

## Audio Capture Setup

### PulseAudio Configuration

The deployment script sets up PulseAudio in user mode with a virtual sink:

1. **Create runtime directory**:
   ```bash
   export XDG_RUNTIME_DIR=/tmp/pulse-runtime
   mkdir -p "$XDG_RUNTIME_DIR"
   chmod 700 "$XDG_RUNTIME_DIR"
   ```

2. **Create PulseAudio config** (`~/.config/pulse/default.pa`):
   ```
   .fail
   load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
   set-default-sink chrome_audio
   load-module module-native-protocol-unix auth-anonymous=1
   ```

3. **Start PulseAudio**:
   ```bash
   pulseaudio --start --exit-idle-time=-1 --daemonize=yes
   ```

4. **Verify sink exists**:
   ```bash
   pactl list short sinks | grep chrome_audio
   ```

### FFmpeg Audio Capture

FFmpeg captures from the PulseAudio monitor device:

```bash
# Audio input configuration
-f pulse -i chrome_audio.monitor \
-thread_queue_size 1024 \
-use_wallclock_as_timestamps 1 \
-af "aresample=async=1000:first_pts=0"
```

**Parameters**:
- `thread_queue_size=1024` - Prevents buffer underruns
- `use_wallclock_as_timestamps=1` - Real-time timing
- `aresample=async=1000:first_pts=0` - Recovers from audio drift (22ms threshold)

## FFmpeg Encoding Configuration

### Video Encoding

```bash
# H.264 encoding with hardware acceleration
-c:v libx264 \
-preset veryfast \
-tune film \                    # Changed from 'zerolatency' for better compression
-profile:v high \
-level 4.2 \
-pix_fmt yuv420p \
-b:v 4500k \
-maxrate 4500k \
-bufsize 18000k \               # 4x bitrate (was 2x)
-g 60 \                         # 2-second GOP at 30fps
-keyint_min 60 \
-sc_threshold 0 \
-thread_queue_size 1024         # Input buffering
```

### Audio Encoding

```bash
# AAC audio encoding
-c:a aac \
-b:a 128k \
-ar 44100 \
-ac 2 \
-thread_queue_size 1024         # Prevents buffer underruns
```

### Output Flags

```bash
# FLV/RTMP flags
-f flv \
-flvflags no_duration_filesize \  # Prevents FLV header issues
-fflags +genpts+discardcorrupt    # Stream recovery
```

## Capture Modes

### CDP Mode (Default)

Chrome DevTools Protocol screencast capture:

```bash
STREAM_CAPTURE_MODE=cdp
```

**Advantages**:
- 2-3x faster than MediaRecorder
- No browser-side encoding overhead
- Single encode step: JPEG → H.264
- Works in headful and headless modes
- Hardware accelerated on supported platforms

**How it works**:
1. CDP `Page.startScreencast` captures compositor frames
2. Frames sent as base64 JPEG to Node.js
3. Decoded and piped to FFmpeg stdin
4. FFmpeg encodes to H.264 and sends to RTMP

### MediaRecorder Mode (Legacy)

Browser MediaRecorder API with WebSocket:

```bash
STREAM_CAPTURE_MODE=mediarecorder
```

**Fallback mode** - Used if CDP capture fails or stalls.

### WebCodecs Mode (Experimental)

Native VideoEncoder API with stream copy:

```bash
STREAM_CAPTURE_MODE=webcodecs
```

**Experimental** - Falls back to CDP if no traffic within 20s.

## Troubleshooting

### WebGPU Not Available

**Symptoms**:
- Black screen in stream
- "WebGPU not supported" errors
- Chrome falls back to software rendering

**Solutions**:
1. Verify NVIDIA GPU is accessible: `nvidia-smi`
2. Check Vulkan support: `vulkaninfo --summary`
3. Verify X server is running: `xdpyinfo -display :99`
4. Check Chrome WebGPU: Navigate to `chrome://gpu` in browser
5. Verify `VK_ICD_FILENAMES` points to NVIDIA ICD

### Audio Not Captured

**Symptoms**:
- Stream has video but no audio
- FFmpeg shows audio input errors

**Solutions**:
1. Verify PulseAudio is running: `pulseaudio --check`
2. Check chrome_audio sink exists: `pactl list short sinks`
3. Verify monitor device: `pactl list short sources | grep monitor`
4. Check FFmpeg can access PulseAudio: `ffmpeg -f pulse -list_devices true -i dummy`
5. Verify `PULSE_SERVER` environment variable is set

### Stream Buffering/Stuttering

**Symptoms**:
- Viewers see buffering
- Inconsistent frame rate
- Audio/video desync

**Solutions**:
1. Increase buffer size: `STREAM_BUFFER_MULTIPLIER=4` (or higher)
2. Use film tune for better compression: `STREAM_LOW_LATENCY=false`
3. Check network bandwidth to RTMP servers
4. Verify CDP FPS matches target: Check logs for "CDP FPS: X"
5. Monitor dropped frames: Check logs for "Dropped: X"

### Xorg/Xvfb Failures

**Symptoms**:
- Deployment fails with "Cannot establish WebGPU-capable rendering mode"
- Xorg falls back to swrast (software rendering)

**Solutions**:
1. Verify NVIDIA drivers are installed: `nvidia-smi`
2. Check DRI devices exist: `ls -la /dev/dri/`
3. Review Xorg logs: `cat /var/log/Xorg.99.log`
4. Verify GPU BusID is correct in xorg config
5. Check for conflicting X servers: `pkill -9 Xorg; pkill -9 Xvfb`
6. Clean up lock files: `rm -f /tmp/.X99-lock`

## Performance Tuning

### Low Latency Mode

For minimal latency (at cost of compression efficiency):

```bash
STREAM_LOW_LATENCY=true          # Use 'zerolatency' tune
STREAM_BUFFER_MULTIPLIER=2       # Smaller buffer (was 4)
STREAMING_PUBLIC_DELAY_MS=0      # No artificial delay
```

### High Quality Mode

For better compression and smoother playback:

```bash
STREAM_LOW_LATENCY=false         # Use 'film' tune (default)
STREAM_BUFFER_MULTIPLIER=4       # Larger buffer (default)
STREAM_CDP_QUALITY=90            # Higher JPEG quality (default: 80)
```

### Resource Optimization

For lower CPU/memory usage:

```bash
STREAM_CAPTURE_WIDTH=1280        # Lower resolution
STREAM_CAPTURE_HEIGHT=720        # 720p (default)
STREAM_FPS=30                    # Lower FPS (default: 30)
STREAM_CDP_QUALITY=70            # Lower JPEG quality
```

## Monitoring & Diagnostics

### Health Checks

The streaming system exposes health endpoints:

```bash
# Streaming state
curl http://localhost:5555/api/streaming/state

# RTMP status file
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

### Log Monitoring

```bash
# PM2 logs (filtered for streaming)
bunx pm2 logs hyperscape-duel --lines 200 | grep -iE "rtmp|ffmpeg|stream|capture"

# FFmpeg processes
ps aux | grep ffmpeg

# PulseAudio status
pactl list short sinks
pactl list short sources
```

### Diagnostic Commands

```bash
# Check GPU rendering mode
echo $GPU_RENDERING_MODE

# Verify display is accessible
xdpyinfo -display $DISPLAY

# Check Vulkan ICD
echo $VK_ICD_FILENAMES
vulkaninfo --summary

# Verify PulseAudio
pulseaudio --check
pactl info
```

## See Also

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment guide
- [docs/streaming-audio-capture.md](streaming-audio-capture.md) - Audio capture setup
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
