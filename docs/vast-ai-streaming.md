# Vast.ai GPU Streaming Architecture

This document describes the GPU-accelerated streaming pipeline for Hyperscape on Vast.ai instances.

## Overview

Hyperscape streams live gameplay to Twitch, Kick, and X/Twitter using GPU-accelerated WebGPU rendering with hardware H.264 encoding. The pipeline captures frames directly from Chrome's compositor via CDP (Chrome DevTools Protocol) and pipes them to FFmpeg for multi-platform RTMP distribution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Vast.ai Instance (NVIDIA GPU + Vulkan)                          │
│                                                                  │
│  ┌──────────────┐    CDP Screencast    ┌──────────────┐        │
│  │ Chrome       │ ──────────────────→   │ Node.js      │        │
│  │ (WebGPU)     │    JPEG frames        │ RTMP Bridge  │        │
│  │              │                       │              │        │
│  │ Xorg/Xvfb    │                       │ FFmpeg       │        │
│  │ + NVIDIA     │                       │ (H.264)      │        │
│  │ Vulkan       │                       │              │        │
│  └──────────────┘                       └──────┬───────┘        │
│                                                │                 │
│  ┌──────────────┐                             │                 │
│  │ PulseAudio   │ ──────────────────→         │                 │
│  │ chrome_audio │    Audio monitor            │                 │
│  └──────────────┘                             │                 │
│                                                ↓                 │
│                                         FFmpeg Tee Muxer         │
│                                                │                 │
└────────────────────────────────────────────────┼─────────────────┘
                                                 │
                    ┌────────────────────────────┼────────────────┐
                    │                            │                │
                    ↓                            ↓                ↓
              Twitch RTMP                  Kick RTMPS        X RTMP
```

## Requirements

### Hardware
- **NVIDIA GPU** with Vulkan support (WebGPU required)
- Minimum 8GB VRAM recommended
- CUDA drivers installed

### Software
- Ubuntu 20.04+ or Debian 11+
- NVIDIA drivers (auto-installed by deploy script)
- Vulkan ICD (auto-configured)
- Xorg or Xvfb display server
- PulseAudio for audio capture
- FFmpeg with H.264 support
- Chrome Dev channel (google-chrome-unstable)
- Bun runtime

## GPU Rendering Modes

The deployment script tries multiple rendering modes in order of preference:

### 1. Xorg with NVIDIA (Preferred)

**Best performance** with direct GPU access.

**Requirements:**
- DRI/DRM device access (`/dev/dri/card0`)
- NVIDIA Xorg driver
- Proper GPU BusID configuration

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false
```

**How it works:**
- Xorg runs with NVIDIA driver in headless mode
- Chrome connects to X display :99
- WebGPU uses NVIDIA GPU via ANGLE/Vulkan
- CDP captures frames from compositor

### 2. Xvfb with NVIDIA Vulkan (Fallback)

**Virtual framebuffer** with GPU rendering via Vulkan.

**Requirements:**
- NVIDIA GPU accessible via Vulkan
- Xvfb virtual display server
- No DRI/DRM device access needed

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=true
```

**How it works:**
- Xvfb provides X11 protocol (virtual framebuffer)
- Chrome uses NVIDIA GPU for rendering via ANGLE/Vulkan
- CDP captures frames from Chrome's internal GPU rendering
- Works in containers without DRM access

### 3. Headless Mode (NOT SUPPORTED)

**WebGPU requires a display server.** Deployment fails if neither Xorg nor Xvfb can start.

## Audio Capture

### PulseAudio Configuration

The deploy script sets up PulseAudio in user mode with a virtual sink:

```bash
# PulseAudio runtime directory
XDG_RUNTIME_DIR=/tmp/pulse-runtime

# PulseAudio socket
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Virtual sink for Chrome audio
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

### FFmpeg Audio Capture

FFmpeg captures from the PulseAudio monitor:

```bash
# Audio input device
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# Enable audio streaming
STREAM_AUDIO_ENABLED=true
```

**Audio pipeline:**
1. Chrome outputs to `chrome_audio` PulseAudio sink
2. FFmpeg captures from `chrome_audio.monitor`
3. Audio is mixed with video in H.264 stream
4. Synchronized output to all RTMP destinations

## Video Capture

### CDP (Chrome DevTools Protocol) Mode

**Recommended** for best performance and reliability.

**How it works:**
1. Chrome DevTools Protocol `Page.startScreencast` captures frames
2. Frames are JPEG-encoded by Chrome compositor
3. Base64 JPEG data sent via CDP events
4. Node.js decodes and pipes raw JPEG to FFmpeg stdin
5. FFmpeg re-encodes to H.264 with hardware acceleration

**Configuration:**
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80        # JPEG quality (1-100)
STREAM_FPS=30                # Target frame rate
STREAM_CAPTURE_WIDTH=1280    # Must be even
STREAM_CAPTURE_HEIGHT=720    # Must be even
```

**Advantages:**
- 2-3x faster than MediaRecorder
- No browser-side VP8/VP9 encoding
- No WebSocket serialization overhead
- Single encode step: JPEG → H.264
- Works in headful and headless modes

### MediaRecorder Mode (Legacy)

**Fallback** if CDP fails or for debugging.

**How it works:**
1. Browser MediaRecorder API encodes to VP8/VP9
2. Chunks sent via WebSocket to Node.js
3. FFmpeg transcodes VP8/VP9 → H.264
4. Output to RTMP destinations

**Configuration:**
```bash
STREAM_CAPTURE_MODE=mediarecorder
RTMP_BRIDGE_PORT=8765
```

**Disadvantages:**
- Double encoding (VP8 → H.264)
- WebSocket overhead
- Higher CPU usage
- More latency

## RTMP Multi-Streaming

### FFmpeg Tee Muxer

Single-encode, multi-output streaming using FFmpeg's tee muxer:

```bash
# Stream to Twitch, Kick, and X simultaneously
ffmpeg -i input.mp4 \
  -c:v libx264 -preset veryfast -b:v 4500k \
  -c:a aac -b:a 128k \
  -f tee \
  "[f=flv]rtmp://live.twitch.tv/app/STREAM_KEY|\
   [f=flv]rtmps://kick.com/live/STREAM_KEY|\
   [f=flv]rtmp://x.com/live/STREAM_KEY"
```

### Supported Platforms

| Platform | Protocol | Default URL |
|----------|----------|-------------|
| Twitch | RTMPS | `rtmps://live.twitch.tv/app` |
| Kick | RTMPS | `rtmps://fa723fc1b171.global-contribute.live-video.net/app` |
| X/Twitter | RTMP | `rtmp://sg.pscp.tv:80/x` |
| YouTube | RTMP | Disabled by default |

### Stream Keys

Set via environment variables or GitHub Secrets:

```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
X_STREAM_KEY=your-x-stream-key

# YouTube explicitly disabled (set to empty string)
YOUTUBE_STREAM_KEY=
```

## Encoding Settings

### Video Encoding

```bash
# Bitrate and buffer
STREAM_BITRATE=4500000              # 4.5 Mbps
STREAM_BUFFER_SIZE=18000000         # 4x bitrate

# x264 preset (quality vs speed tradeoff)
STREAM_PRESET=veryfast              # ultrafast | veryfast | fast | medium

# Latency tuning
STREAM_LOW_LATENCY=false            # false = tune=film (better quality)
                                    # true = tune=zerolatency (faster playback)

# GOP size (keyframe interval)
STREAM_GOP_SIZE=60                  # 60 frames = 2s at 30fps
```

### Audio Encoding

```bash
# Audio codec and bitrate
-c:a aac -b:a 128k

# Audio buffering
-thread_queue_size 1024
-use_wallclock_as_timestamps 1

# Async resampling for drift recovery
-af aresample=async=1000:first_pts=0
```

## Deployment Process

### Automated Deployment

The `.github/workflows/deploy-vast.yml` workflow handles deployment:

1. SSH into Vast.ai instance
2. Run `scripts/deploy-vast.sh`
3. Script performs:
   - Git pull latest code
   - Install system dependencies
   - Setup GPU rendering (Xorg or Xvfb)
   - Configure PulseAudio
   - Install Chrome Dev
   - Build project
   - Push database schema
   - Start PM2 process

### Manual Deployment

```bash
# SSH into Vast.ai instance
ssh root@<vast-instance-ip> -p <port>

# Clone repository
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Run deployment script
./scripts/deploy-vast.sh
```

### Environment Variables

The deploy script writes secrets to `/tmp/hyperscape-secrets.env` before git reset:

```bash
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
X_STREAM_KEY=...
SOLANA_DEPLOYER_PRIVATE_KEY=...
JWT_SECRET=...
```

These are copied to `packages/server/.env` after git reset.

## Monitoring

### PM2 Process Management

```bash
# View status
bunx pm2 status

# View logs
bunx pm2 logs hyperscape-duel

# Restart
bunx pm2 restart hyperscape-duel

# Stop
bunx pm2 stop hyperscape-duel
```

### RTMP Status

The bridge writes status to a JSON file every 2 seconds:

```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

**Status fields:**
- `active` - Bridge is running
- `clientConnected` - Game client connected
- `destinations` - RTMP connection status per platform
- `stats.bytesReceived` - Total bytes from capture
- `stats.droppedFrames` - Frames dropped due to backpressure
- `stats.healthy` - All destinations connected
- `captureMode` - Active capture mode (cdp | mediarecorder | webcodecs)
- `processRssBytes` - Process memory usage

### Health Checks

The deploy script includes health monitoring:

```bash
# Wait for server to be healthy
curl http://localhost:5555/health

# Check streaming state
curl http://localhost:5555/api/streaming/state
```

## Troubleshooting

### GPU Not Accessible

**Symptom:** `nvidia-smi` fails or shows no GPU

**Solution:**
1. Verify Vast.ai instance has GPU allocated
2. Check NVIDIA drivers: `nvidia-smi`
3. Reinstall drivers if needed

### Vulkan Not Working

**Symptom:** `vulkaninfo` fails or shows no devices

**Solution:**
1. Check Vulkan ICD: `ls /usr/share/vulkan/icd.d/`
2. Force NVIDIA ICD: `export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json`
3. Test: `vulkaninfo --summary`

### Display Server Fails

**Symptom:** Xorg/Xvfb won't start, deployment fails

**Solution:**
1. Check X lock files: `ls /tmp/.X*-lock`
2. Clean up: `rm -f /tmp/.X*-lock && rm -rf /tmp/.X11-unix`
3. Verify DRI devices: `ls /dev/dri/`
4. Check Xorg logs: `cat /var/log/Xorg.99.log`

### PulseAudio Not Running

**Symptom:** No audio in stream, FFmpeg audio errors

**Solution:**
1. Check PulseAudio: `pulseaudio --check`
2. List sinks: `pactl list short sinks`
3. Restart: `pulseaudio --kill && pulseaudio --start`
4. Verify chrome_audio sink exists

### WebGPU Not Available

**Symptom:** Black screen, "WebGPU not supported" errors

**Solution:**
1. Verify display: `echo $DISPLAY` (should be :99 or :0)
2. Test display: `xdpyinfo -display $DISPLAY`
3. Check Chrome flags in `ecosystem.config.cjs`
4. Ensure `STREAM_CAPTURE_HEADLESS=false`
5. Verify Vulkan: `vulkaninfo --summary`

### Stream Not Starting

**Symptom:** PM2 shows running but no stream output

**Solution:**
1. Check logs: `bunx pm2 logs hyperscape-duel --lines 200`
2. Check RTMP status: `cat /root/hyperscape/packages/server/public/live/rtmp-status.json`
3. Verify stream keys are set: `grep STREAM_KEY packages/server/.env`
4. Check FFmpeg process: `ps aux | grep ffmpeg`

### Black Frames / No Video

**Symptom:** Stream shows black screen or frozen frame

**Solution:**
1. Check CDP capture: Look for "CDP FPS" in logs
2. Verify resolution: Should match `STREAM_CAPTURE_WIDTH x STREAM_CAPTURE_HEIGHT`
3. Check GPU rendering mode: `echo $GPU_RENDERING_MODE`
4. Restart browser: `bunx pm2 restart hyperscape-duel`

### Audio Missing

**Symptom:** Stream has video but no audio

**Solution:**
1. Check PulseAudio: `pactl list short sinks | grep chrome_audio`
2. Verify FFmpeg audio input: Look for "chrome_audio.monitor" in logs
3. Check `STREAM_AUDIO_ENABLED=true`
4. Test audio device: `pactl info`

### High Memory Usage

**Symptom:** Process RSS grows over time, OOM kills

**Solution:**
1. Browser restarts automatically every hour (configurable)
2. Check `BROWSER_RESTART_INTERVAL_MS` in `ecosystem.config.cjs`
3. Monitor: `bunx pm2 monit`
4. Adjust PM2 memory limit: `max_memory_restart: "4G"`

### Stream Buffering / Stuttering

**Symptom:** Viewers see buffering or choppy playback

**Solution:**
1. Increase bitrate buffer: `STREAM_BUFFER_SIZE=18000000` (4x bitrate)
2. Use faster preset: `STREAM_PRESET=veryfast`
3. Enable low-latency mode: `STREAM_LOW_LATENCY=true`
4. Reduce GOP size: `STREAM_GOP_SIZE=30`
5. Check network bandwidth to RTMP servers

## Performance Optimization

### CPU Usage

- Use `veryfast` or `ultrafast` preset for lower CPU usage
- Reduce resolution: `1280x720` → `960x540`
- Lower frame rate: `30fps` → `24fps`

### Memory Usage

- Browser restarts every hour by default
- Adjust `BROWSER_RESTART_INTERVAL_MS` if needed
- Monitor with `bunx pm2 monit`

### Network Bandwidth

- Reduce bitrate: `STREAM_BITRATE=3000000` (3 Mbps)
- Use lower quality preset: `STREAM_PRESET=ultrafast`
- Disable audio: `STREAM_AUDIO_ENABLED=false`

## Environment Variables Reference

### GPU Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY` | `:99` | X display server |
| `GPU_RENDERING_MODE` | `xorg` | Rendering mode (xorg \| xvfb-vulkan) |
| `DUEL_CAPTURE_USE_XVFB` | `false` | Use Xvfb instead of Xorg |
| `VK_ICD_FILENAMES` | `/usr/share/vulkan/icd.d/nvidia_icd.json` | Force NVIDIA Vulkan ICD |

### Video Capture

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_MODE` | `cdp` | Capture mode (cdp \| mediarecorder \| webcodecs) |
| `STREAM_CAPTURE_HEADLESS` | `false` | Headless mode (must be false for WebGPU) |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Browser channel |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | ANGLE backend (vulkan \| metal) |
| `STREAM_CDP_QUALITY` | `80` | JPEG quality for CDP (1-100) |
| `STREAM_FPS` | `30` | Target frame rate |
| `STREAM_CAPTURE_WIDTH` | `1280` | Stream width (must be even) |
| `STREAM_CAPTURE_HEIGHT` | `720` | Stream height (must be even) |

### Audio Capture

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `PULSE_SERVER` | `unix:/tmp/pulse-runtime/pulse/native` | PulseAudio socket |
| `XDG_RUNTIME_DIR` | `/tmp/pulse-runtime` | PulseAudio runtime directory |

### Encoding

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_BITRATE` | `4500000` | Video bitrate (bits/sec) |
| `STREAM_BUFFER_SIZE` | `18000000` | FFmpeg buffer (4x bitrate) |
| `STREAM_PRESET` | `veryfast` | x264 preset |
| `STREAM_LOW_LATENCY` | `false` | Enable zerolatency tune |
| `STREAM_GOP_SIZE` | `60` | Keyframe interval (frames) |

### Stream Keys

| Variable | Description |
|----------|-------------|
| `TWITCH_STREAM_KEY` | Twitch stream key |
| `KICK_STREAM_KEY` | Kick stream key |
| `X_STREAM_KEY` | X/Twitter stream key |
| `YOUTUBE_STREAM_KEY` | YouTube stream key (disabled) |

## Deployment Validation

The deploy script validates the environment before starting:

### 1. GPU Check
```bash
nvidia-smi || exit 1
```

### 2. Vulkan Check
```bash
vulkaninfo --summary || echo "WARNING: Vulkan may not be available"
```

### 3. Display Server Check
```bash
xdpyinfo -display $DISPLAY || exit 1
```

### 4. PulseAudio Check
```bash
pulseaudio --check || echo "WARNING: PulseAudio not running"
pactl list short sinks | grep chrome_audio || echo "WARNING: chrome_audio sink missing"
```

### 5. Health Check
```bash
curl http://localhost:5555/health || echo "WARNING: Server not healthy"
```

## Production Checklist

Before deploying to production:

- [ ] Set all required stream keys (Twitch, Kick, X)
- [ ] Configure `DATABASE_URL` for production PostgreSQL
- [ ] Set `JWT_SECRET` (generate with `openssl rand -base64 32`)
- [ ] Set `ARENA_EXTERNAL_BET_WRITE_KEY` if using betting
- [ ] Configure `SOLANA_DEPLOYER_PRIVATE_KEY` for on-chain features
- [ ] Verify NVIDIA GPU is accessible (`nvidia-smi`)
- [ ] Verify Vulkan support (`vulkaninfo --summary`)
- [ ] Test display server (`xdpyinfo -display :99`)
- [ ] Test PulseAudio (`pactl list short sinks`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure PM2 memory limits in `ecosystem.config.cjs`
- [ ] Set up monitoring and alerting
- [ ] Test stream on all platforms before going live

## Related Documentation

- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment automation
- [packages/server/scripts/stream-to-rtmp.ts](../packages/server/scripts/stream-to-rtmp.ts) - Streaming implementation
- [.env.example](../.env.example) - Environment variable reference
- [CLAUDE.md](../CLAUDE.md) - Development guide
