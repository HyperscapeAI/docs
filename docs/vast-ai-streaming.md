# Vast.ai GPU Streaming

Hyperscape streams live gameplay to Twitch, Kick, and X/Twitter using GPU-accelerated rendering with WebGPU on Vast.ai instances.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Vast.ai Container (NVIDIA GPU)                                  │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Xorg/Xvfb    │───▶│ Chrome       │───▶│ CDP          │     │
│  │ Display :99  │    │ WebGPU       │    │ Screencast   │     │
│  └──────────────┘    └──────────────┘    └──────┬───────┘     │
│                             │                     │              │
│                             │                     │              │
│                      ┌──────▼──────┐       ┌─────▼──────┐      │
│                      │ PulseAudio  │       │ FFmpeg     │      │
│                      │ chrome_audio│       │ H.264      │      │
│                      └──────┬──────┘       └─────┬──────┘      │
│                             │                     │              │
│                             └─────────┬───────────┘              │
│                                       │                          │
│                                ┌──────▼──────┐                  │
│                                │ RTMP Tee    │                  │
│                                │ Muxer       │                  │
│                                └──────┬──────┘                  │
│                                       │                          │
│         ┌─────────────────────────────┼──────────────┐          │
│         │                             │              │          │
│    ┌────▼────┐                  ┌────▼────┐    ┌───▼────┐     │
│    │ Twitch  │                  │ Kick    │    │ X      │     │
│    │ RTMP    │                  │ RTMPS   │    │ RTMP   │     │
│    └─────────┘                  └─────────┘    └────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Requirements

### Hardware
- **NVIDIA GPU** with Vulkan support (GTX 1060 or better recommended)
- **8GB+ RAM** (16GB recommended for stable streaming)
- **50GB+ storage** for game assets and recordings

### Software
- **Ubuntu 20.04+** or compatible Linux distribution
- **NVIDIA drivers** (version 470+)
- **Vulkan ICD** at `/usr/share/vulkan/icd.d/nvidia_icd.json`
- **Xorg or Xvfb** for display server
- **PulseAudio** for audio capture
- **FFmpeg** with H.264 support
- **Chrome Dev channel** (google-chrome-unstable) for WebGPU

## Deployment

### Automatic Deployment (GitHub Actions)

Push to `main` branch triggers automatic deployment:

```bash
git push origin main
```

The workflow:
1. SSHs into Vast.ai instance
2. Writes secrets to `/tmp/hyperscape-secrets.env`
3. Runs `scripts/deploy-vast.sh`
4. Starts services via PM2

### Manual Deployment

```bash
# SSH into Vast.ai instance
ssh root@<vast-instance-ip>

# Clone repository (first time only)
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Create .env file with secrets
cat > packages/server/.env << EOF
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
SOLANA_DEPLOYER_PRIVATE_KEY=...
JWT_SECRET=...
EOF

# Run deployment script
./scripts/deploy-vast.sh
```

## GPU Rendering Modes

The deployment script tries GPU rendering modes in order:

### 1. Xorg with NVIDIA (Preferred)

**Requirements:**
- DRI/DRM device access (`/dev/dri/card0`)
- NVIDIA Xorg driver installed

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false
```

**Validation:**
- Checks for `/dev/dri/card0`
- Starts Xorg with NVIDIA driver
- Verifies GPU rendering (not software fallback)
- Checks for `swrast` in Xorg logs (indicates software rendering)

### 2. Xvfb with NVIDIA Vulkan (Fallback)

**Requirements:**
- NVIDIA GPU accessible via `nvidia-smi`
- Vulkan ICD available

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=true
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

**How it works:**
- Xvfb provides X11 protocol (virtual framebuffer)
- Chrome uses NVIDIA GPU via ANGLE/Vulkan
- CDP captures frames from Chrome's internal GPU rendering
- Works in containers without DRM access

### 3. Headless Mode (NOT SUPPORTED)

WebGPU requires a display server. Deployment fails if neither Xorg nor Xvfb can start.

## Audio Capture

### PulseAudio Setup

The deployment script configures PulseAudio in user mode:

**Configuration:**
```bash
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

**Virtual Sink:**
```bash
# Created by deploy script
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

**Chrome Configuration:**
```bash
--alsa-output-device=pulse
--audio-output-channels=2
```

**FFmpeg Capture:**
```bash
-f pulse -i chrome_audio.monitor
```

### Audio Troubleshooting

**No audio in stream:**
```bash
# Check PulseAudio is running
pulseaudio --check

# List sinks
pactl list short sinks

# Should show:
# 0  chrome_audio  module-null-sink.c  s16le 2ch 44100Hz  RUNNING
```

**Audio crackling/dropouts:**
- Increase `thread_queue_size` in FFmpeg args
- Enable async resampling: `aresample=async=1000:first_pts=0`
- Check CPU usage (audio encoding is CPU-intensive)

## Video Capture

### CDP Screencast (Default)

Chrome DevTools Protocol screencast captures frames directly from the compositor.

**Advantages:**
- 2-3x faster than MediaRecorder
- No browser-side encoding overhead
- Single encode step: JPEG → H.264
- Works in headless and headful modes

**Configuration:**
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80        # JPEG quality (1-100)
STREAM_FPS=30                # Target frame rate
STREAM_CAPTURE_WIDTH=1280    # Must be even
STREAM_CAPTURE_HEIGHT=720    # Must be even
```

**How it works:**
1. CDP `Page.startScreencast` captures compositor frames
2. Frames delivered as base64 JPEG via CDP events
3. Decoded and piped to FFmpeg stdin
4. FFmpeg encodes to H.264 and muxes to RTMP

### MediaRecorder (Legacy Fallback)

Browser-side MediaRecorder API with WebSocket transfer.

**Configuration:**
```bash
STREAM_CAPTURE_MODE=mediarecorder
```

**When to use:**
- CDP capture fails or stalls
- Debugging browser-side encoding
- Testing WebCodecs compatibility

### WebCodecs (Experimental)

Native VideoEncoder API with stream copy.

**Configuration:**
```bash
STREAM_CAPTURE_MODE=webcodecs
```

**Status:** Experimental, may fall back to CDP if no traffic detected within 20s.

## Encoding Settings

### Video Encoding

**Default (Quality Mode):**
```bash
STREAM_PRESET=medium         # x264 preset
STREAM_LOW_LATENCY=false     # tune=film (allows B-frames)
STREAM_BITRATE=4500k         # 4.5 Mbps
STREAM_GOP_SIZE=60           # 2s keyframe interval at 30fps
```

**Low-Latency Mode:**
```bash
STREAM_LOW_LATENCY=true      # tune=zerolatency (no B-frames)
STREAM_GOP_SIZE=30           # 1s keyframe interval
```

**Buffer Settings:**
```bash
STREAM_BUFFER_SIZE=18000k    # 4x bitrate (prevents buffering)
```

### Audio Encoding

**Settings:**
- Codec: AAC
- Bitrate: 128k
- Sample rate: 44100 Hz
- Channels: 2 (stereo)

**Buffering:**
```bash
-thread_queue_size 1024                    # Input buffer
-use_wallclock_as_timestamps 1             # Real-time timing
-filter:a aresample=async=1000:first_pts=0 # Async resampling
```

## RTMP Destinations

### Twitch

**Configuration:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmps://live.twitch.tv/app  # Optional override
```

**Default ingest:** `rtmps://live.twitch.tv/app`

### Kick

**Configuration:**
```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
```

**Note:** Kick uses RTMPS (secure RTMP).

### X/Twitter

**Configuration:**
```bash
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

**Requirements:**
- X Premium subscription
- Media Studio access

### YouTube (Disabled)

YouTube streaming is explicitly disabled by default:

```bash
YOUTUBE_STREAM_KEY=  # Empty string prevents stale keys
```

To enable YouTube, set a valid stream key.

## Production Client Build

### Problem

Vite dev server uses on-demand module compilation (JIT), which can take 60-180 seconds to load the game page. This causes browser timeout errors during streaming.

### Solution

Use production client build mode:

```bash
NODE_ENV=production
# OR
DUEL_USE_PRODUCTION_CLIENT=true
```

**How it works:**
1. Client is pre-built during deployment: `bun run build:client`
2. Server serves pre-built client via `vite preview` instead of dev server
3. Page loads in <5 seconds (no JIT compilation)
4. Prevents browser timeout errors

**When to use:**
- Always use in production/streaming environments
- Optional in development (slower builds, faster page loads)

## Monitoring

### PM2 Logs

```bash
# Tail live logs
bunx pm2 logs hyperscape-duel

# Show last 200 lines
bunx pm2 logs hyperscape-duel --lines 200

# Filter for streaming-related logs
bunx pm2 logs hyperscape-duel --lines 200 | grep -iE "rtmp|ffmpeg|stream|capture"
```

### RTMP Status File

The streaming bridge writes status to a JSON file:

```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

**Example output:**
```json
{
  "active": true,
  "destinations": [
    {"name": "Twitch", "connected": true},
    {"name": "Kick", "connected": true},
    {"name": "X", "connected": true}
  ],
  "stats": {
    "bytesReceived": 1234567890,
    "bytesReceivedMB": "1177.38",
    "uptimeSeconds": 3600,
    "droppedFrames": 0,
    "backpressured": false
  },
  "captureMode": "cdp",
  "updatedAt": 1709123456789
}
```

### Health Checks

**Server health:**
```bash
curl http://localhost:5555/health
```

**Streaming state:**
```bash
curl http://localhost:5555/api/streaming/state
```

**Game client:**
```bash
curl http://localhost:3333
```

## Troubleshooting

### Black Frames / No Video

**Symptoms:** Stream shows black screen or frozen frame.

**Diagnosis:**
```bash
# Check GPU access
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check display server
echo $DISPLAY
xdpyinfo -display $DISPLAY

# Check Xorg logs (if using Xorg)
tail -100 /var/log/Xorg.99.log
```

**Common causes:**
1. **Display server not running**: Xorg/Xvfb failed to start
2. **Software rendering**: Xorg fell back to `swrast` (check logs)
3. **WebGPU disabled**: Check Chrome flags in `stream-to-rtmp.ts`
4. **Viewport mismatch**: Resolution doesn't match stream dimensions

**Fix:**
```bash
# Restart deployment
./scripts/deploy-vast.sh

# Check GPU rendering mode
echo $GPU_RENDERING_MODE  # Should be 'xorg' or 'xvfb-vulkan'
```

### No Audio

**Symptoms:** Stream has video but no audio.

**Diagnosis:**
```bash
# Check PulseAudio
pulseaudio --check
pactl list short sinks

# Should show chrome_audio sink
```

**Fix:**
```bash
# Restart PulseAudio
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1

# Recreate chrome_audio sink
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

### Resolution Mismatch

**Symptoms:** CDP logs show resolution mismatch warnings.

**Diagnosis:**
```bash
# Check CDP logs
bunx pm2 logs hyperscape-duel | grep "Resolution mismatch"
```

**Automatic recovery:**
- System detects persistent mismatches (10+ frames)
- Automatically calls `page.setViewportSize()` to restore correct resolution
- Logs recovery attempts

**Manual fix:**
```bash
# Restart streaming
bunx pm2 restart hyperscape-duel
```

### Stream Stalls / Dropped Frames

**Symptoms:** Stream freezes or shows buffering.

**Diagnosis:**
```bash
# Check FFmpeg stats
bunx pm2 logs hyperscape-duel | grep -E "fps=|bitrate=|drop="

# Check backpressure
cat /root/hyperscape/packages/server/public/live/rtmp-status.json | jq '.stats.backpressured'
```

**Common causes:**
1. **CPU overload**: Encoding too slow for target bitrate
2. **Network congestion**: Upstream bandwidth insufficient
3. **Buffer underrun**: Increase `STREAM_BUFFER_SIZE`

**Fix:**
```bash
# Reduce bitrate
export STREAM_BITRATE=3000k

# Use faster preset
export STREAM_PRESET=veryfast

# Enable low-latency mode
export STREAM_LOW_LATENCY=true

# Restart
bunx pm2 restart hyperscape-duel
```

### Page Load Timeout

**Symptoms:** Browser times out loading game page (180s limit).

**Cause:** Vite dev server JIT compilation is too slow.

**Fix:**
```bash
# Enable production client build
export NODE_ENV=production
# OR
export DUEL_USE_PRODUCTION_CLIENT=true

# Rebuild and restart
bun run build:client
bunx pm2 restart hyperscape-duel
```

### Memory Leaks

**Symptoms:** Process RSS grows over time, eventually crashes.

**Diagnosis:**
```bash
# Monitor memory usage
bunx pm2 logs hyperscape-duel | grep "Process RSS"
```

**Automatic mitigation:**
- Browser restarts every hour (`BROWSER_RESTART_INTERVAL_MS=3600000`)
- PM2 restarts process if RSS exceeds 4GB (`max_memory_restart: "4G"`)

**Manual fix:**
```bash
# Restart immediately
bunx pm2 restart hyperscape-duel
```

### CDP Capture Stalls

**Symptoms:** CDP FPS drops to 0, no frames received.

**Automatic recovery:**
1. Detects stall after 4 status intervals (120s)
2. Attempts soft recovery (restart CDP screencast)
3. Falls back to hard recovery (restart browser)
4. Falls back to MediaRecorder mode after 6 failures

**Manual recovery:**
```bash
# Restart streaming
bunx pm2 restart hyperscape-duel
```

## Environment Variables

### Required Secrets

Set these as GitHub Secrets for CI/CD:

```bash
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
DATABASE_URL=postgresql://...
SOLANA_DEPLOYER_PRIVATE_KEY=...
JWT_SECRET=...
VAST_HOST=<ip-address>
VAST_PORT=22
VAST_SSH_KEY=<private-key>
```

### GPU Configuration (Auto-Configured)

These are set by `deploy-vast.sh`:

```bash
DISPLAY=:99
GPU_RENDERING_MODE=xorg|xvfb-vulkan
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
DUEL_CAPTURE_USE_XVFB=true|false
STREAM_CAPTURE_HEADLESS=false
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

### Stream Capture

```bash
STREAM_CAPTURE_MODE=cdp              # cdp | mediarecorder | webcodecs
STREAM_CAPTURE_CHANNEL=chrome-dev    # Browser channel
STREAM_CAPTURE_ANGLE=vulkan          # ANGLE backend
STREAM_CDP_QUALITY=80                # JPEG quality (1-100)
STREAM_FPS=30                        # Target FPS
STREAM_CAPTURE_WIDTH=1280            # Must be even
STREAM_CAPTURE_HEIGHT=720            # Must be even
```

### Audio Capture

```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

### Encoding

```bash
STREAM_PRESET=medium                 # x264 preset
STREAM_LOW_LATENCY=false             # tune=film (quality) vs tune=zerolatency (speed)
STREAM_BITRATE=4500k                 # Video bitrate
STREAM_GOP_SIZE=60                   # Keyframe interval (frames)
STREAM_BUFFER_SIZE=18000k            # 4x bitrate
```

### Recovery

```bash
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6
BROWSER_RESTART_INTERVAL_MS=3600000  # 1 hour
```

## Performance Tuning

### CPU Usage

**High CPU usage (>80%):**
- Use faster x264 preset: `STREAM_PRESET=veryfast`
- Reduce bitrate: `STREAM_BITRATE=3000k`
- Lower resolution: `STREAM_CAPTURE_WIDTH=1280 STREAM_CAPTURE_HEIGHT=720`

### Memory Usage

**High memory usage (>3GB):**
- Enable production client build: `NODE_ENV=production`
- Reduce browser restart interval: `BROWSER_RESTART_INTERVAL_MS=1800000` (30 min)
- Disable unused features in server `.env`

### Network Bandwidth

**Upstream bandwidth requirements:**
- 4.5 Mbps video + 128 kbps audio = ~4.7 Mbps per destination
- 3 destinations (Twitch, Kick, X) = ~14 Mbps total
- Add 20% overhead for RTMP protocol = ~17 Mbps recommended

**Reduce bandwidth:**
```bash
STREAM_BITRATE=3000k         # 3 Mbps video
STREAM_PRESET=faster         # Better compression
```

## Monitoring Commands

```bash
# PM2 status
bunx pm2 status

# Tail logs
bunx pm2 logs hyperscape-duel

# Restart
bunx pm2 restart hyperscape-duel

# Stop
bunx pm2 stop hyperscape-duel

# View process list
bunx pm2 list

# Monitor resources
bunx pm2 monit
```

## Security

### Secrets Management

**NEVER commit secrets to git:**
- Use GitHub Secrets for CI/CD
- Use `.env` files locally (gitignored)
- Secrets written to `/tmp/hyperscape-secrets.env` during deployment
- Copied to `packages/server/.env` after `git reset --hard`

### Stream Keys

**Rotation:**
1. Generate new stream key on platform
2. Update GitHub Secret
3. Push to trigger redeployment
4. Old key invalidated automatically

### Access Control

**Viewer access token:**
```bash
STREAMING_VIEWER_ACCESS_TOKEN=random-secret-token
```

Appends `?streamToken=...` to game URL for gated WebSocket access.

## Cost Optimization

### Vast.ai Instance Selection

**Recommended specs:**
- GPU: NVIDIA GTX 1660 or better
- RAM: 16GB
- Storage: 50GB
- Network: 100 Mbps upload

**Cost:** ~$0.20-0.40/hour depending on GPU model.

### Reduce Costs

1. **Use spot instances** (cheaper but can be interrupted)
2. **Lower resolution**: 720p instead of 1080p
3. **Reduce bitrate**: 3 Mbps instead of 4.5 Mbps
4. **Disable unused destinations**: Only stream to one platform
5. **Use on-demand**: Start/stop streaming as needed

## Advanced Configuration

### Custom FFmpeg Args

Edit `packages/server/src/streaming/rtmp-bridge.ts`:

```typescript
const ffmpegArgs = [
  '-f', 'image2pipe',
  '-c:v', 'mjpeg',
  // Add custom args here
  '-preset', process.env.STREAM_PRESET || 'medium',
  // ...
];
```

### Custom Browser Flags

Edit `packages/server/scripts/stream-to-rtmp.ts`:

```typescript
const launchConfig = {
  args: [
    '--enable-unsafe-webgpu',
    // Add custom flags here
    '--custom-flag=value',
  ],
};
```

### Custom Capture Script

Override capture script in `packages/server/src/streaming/stream-capture.ts`:

```typescript
export function generateCaptureScript(config: CaptureConfig): string {
  return `
    // Custom capture implementation
  `;
}
```

## References

- **Deployment script:** `scripts/deploy-vast.sh`
- **Streaming bridge:** `packages/server/src/streaming/rtmp-bridge.ts`
- **Capture script:** `packages/server/scripts/stream-to-rtmp.ts`
- **PM2 config:** `ecosystem.config.cjs`
- **Environment variables:** `.env.example`, `packages/server/.env.example`
