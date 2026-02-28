# Vast.ai GPU Streaming Architecture

Hyperscape streams live gameplay to Twitch, Kick, and X/Twitter using GPU-accelerated rendering with WebGPU.

## Overview

The streaming pipeline captures gameplay from a headful Chrome instance running on Vast.ai GPU servers, encodes it with FFmpeg, and streams to multiple RTMP destinations simultaneously.

**Key Components:**
- Chrome Dev with WebGPU enabled
- CDP (Chrome DevTools Protocol) screencast capture
- PulseAudio for game audio capture
- FFmpeg for H.264 encoding and RTMP fanout
- PM2 for process management and auto-restart

## Requirements

### Hardware
- **NVIDIA GPU with Vulkan support** (REQUIRED for WebGPU)
- Minimum 8GB VRAM recommended
- CUDA drivers installed

### Software
- Ubuntu 20.04+ or Debian 11+
- NVIDIA drivers (auto-detected by deploy script)
- Chrome Dev channel (`google-chrome-unstable`)
- FFmpeg with H.264 support
- PulseAudio
- Xorg or Xvfb display server

## Architecture

### GPU Rendering Modes

The deployment script tries rendering modes in order until one succeeds:

#### 1. Xorg with NVIDIA (Preferred)

**Best performance** - Direct GPU access with hardware acceleration.

**Requirements:**
- DRI/DRM devices available (`/dev/dri/card0`)
- NVIDIA Xorg driver installed
- Container has access to GPU devices

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false
```

**How it works:**
1. Deploy script detects DRI devices
2. Generates Xorg config with NVIDIA BusID
3. Starts Xorg on display :99 with headless config
4. Validates GPU rendering (not software fallback)
5. Chrome connects to :99 and uses NVIDIA GPU via ANGLE/Vulkan

#### 2. Xvfb with NVIDIA Vulkan (Fallback)

**Virtual framebuffer** - Works in containers without DRM access.

**Requirements:**
- NVIDIA GPU accessible via `nvidia-smi`
- Vulkan ICD available
- No DRI/DRM devices needed

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=true
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

**How it works:**
1. Xvfb provides virtual X11 display
2. Chrome uses NVIDIA GPU via ANGLE/Vulkan backend
3. CDP captures frames from Chrome's internal GPU rendering
4. No actual framebuffer rendering (CDP bypasses Xvfb)

#### 3. Headless Mode (NOT SUPPORTED)

**WebGPU requires a display server.** Deployment fails if neither Xorg nor Xvfb can start.

### Audio Capture

Game audio (music, sound effects) is captured via PulseAudio.

**Setup:**
1. PulseAudio runs in user mode (`/tmp/pulse-runtime`)
2. Virtual sink `chrome_audio` created automatically
3. Chrome outputs audio to `chrome_audio` sink
4. FFmpeg captures from `chrome_audio.monitor`

**Configuration:**
```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

**Fallback:**
If PulseAudio fails to start, streaming continues with silent audio (anullsrc).

### Video Capture

**CDP Screencast Mode** (default, recommended):
- Chrome DevTools Protocol `Page.startScreencast`
- Captures JPEG frames directly from compositor
- ~2-3x faster than MediaRecorder
- No browser-side encoding overhead

**Configuration:**
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80              # JPEG quality (1-100)
STREAM_FPS=30                      # Target frame rate
STREAM_CAPTURE_WIDTH=1280          # Stream width
STREAM_CAPTURE_HEIGHT=720          # Stream height
```

**MediaRecorder Mode** (legacy fallback):
- Browser-side VP8/VP9 encoding
- WebSocket transfer to FFmpeg
- Slower but more compatible

**Configuration:**
```bash
STREAM_CAPTURE_MODE=mediarecorder
```

### RTMP Multi-Streaming

FFmpeg encodes once and streams to multiple destinations using the `tee` muxer.

**Supported Platforms:**
- Twitch (RTMPS)
- Kick (RTMPS)
- X/Twitter (RTMP)
- YouTube (disabled by default)

**Configuration:**
```bash
# Twitch
TWITCH_STREAM_KEY=live_xxxxx
# Twitch URL auto-detected, or set:
TWITCH_RTMP_URL=rtmps://live.twitch.tv/app

# Kick
KICK_STREAM_KEY=xxxxx
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# X/Twitter
X_STREAM_KEY=xxxxx
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# YouTube (explicitly disabled)
YOUTUBE_STREAM_KEY=
```

### Encoding Settings

**Video:**
- Codec: H.264 (libx264)
- Preset: medium (balanced quality/speed)
- Tune: film (better compression, allows B-frames)
- Bitrate: 4500 kbps
- Buffer: 18000 kbps (4x bitrate for stability)
- GOP size: 60 frames (2 seconds at 30fps)
- Profile: high
- Level: 4.2

**Audio:**
- Codec: AAC
- Bitrate: 128 kbps
- Sample rate: 44100 Hz
- Channels: 2 (stereo)

**Low-Latency Mode:**
```bash
STREAM_LOW_LATENCY=true  # Enables zerolatency tune, disables B-frames
STREAM_GOP_SIZE=30       # Reduce keyframe interval for faster startup
```

## Deployment

### GitHub Actions Workflow

Deployment is automated via `.github/workflows/deploy-vast.yml`:

1. SSH into Vast.ai instance
2. Write secrets to `/tmp/hyperscape-secrets.env`
3. Run `scripts/deploy-vast.sh`
4. Script pulls latest code, builds, and starts via PM2

### Required GitHub Secrets

```bash
# Vast.ai SSH access
VAST_HOST=xxx.xxx.xxx.xxx
VAST_PORT=xxxxx
VAST_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Streaming keys
TWITCH_STREAM_KEY=live_xxxxx
KICK_STREAM_KEY=xxxxx
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=xxxxx
X_RTMP_URL=rtmp://...

# Solana (for on-chain features)
SOLANA_DEPLOYER_PRIVATE_KEY=base58_encoded_key
```

### Manual Deployment

SSH into Vast.ai instance and run:

```bash
cd /root/hyperscape
git pull origin main
bun install
bun run build
bunx pm2 restart ecosystem.config.cjs
```

## Monitoring

### PM2 Commands

```bash
# View logs
bunx pm2 logs hyperscape-duel

# Check status
bunx pm2 status

# Restart
bunx pm2 restart hyperscape-duel

# Stop
bunx pm2 stop hyperscape-duel
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

**RTMP status:**
```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

### Diagnostics

The deploy script includes comprehensive diagnostics at the end:

- Streaming API state
- Game client status (port 3333)
- RTMP status file
- FFmpeg processes
- PM2 logs (filtered for streaming keywords)

## Troubleshooting

### WebGPU Not Available

**Symptoms:**
- Black screen in stream
- "WebGPU not supported" errors in logs
- Chrome falls back to software rendering

**Solutions:**

1. **Check GPU access:**
   ```bash
   nvidia-smi
   ```
   Should show GPU info. If not, GPU drivers not installed.

2. **Check Vulkan:**
   ```bash
   vulkaninfo --summary
   ```
   Should show NVIDIA device. If not, Vulkan ICD misconfigured.

3. **Check display server:**
   ```bash
   xdpyinfo -display :99
   ```
   Should show display info. If not, Xorg/Xvfb not running.

4. **Check Xorg logs:**
   ```bash
   cat /var/log/Xorg.99.log | grep -E "(EE)|(WW)"
   ```
   Look for NVIDIA driver errors or software rendering fallback.

### Audio Not Streaming

**Symptoms:**
- Stream has video but no audio
- FFmpeg shows "silence detected" warnings

**Solutions:**

1. **Check PulseAudio:**
   ```bash
   pulseaudio --check
   pactl list short sinks
   ```
   Should show `chrome_audio` sink.

2. **Restart PulseAudio:**
   ```bash
   pulseaudio --kill
   pulseaudio --start
   pactl load-module module-null-sink sink_name=chrome_audio
   ```

3. **Disable audio streaming:**
   ```bash
   export STREAM_AUDIO_ENABLED=false
   bunx pm2 restart hyperscape-duel
   ```

### Stream Buffering/Stuttering

**Symptoms:**
- Viewers see frequent buffering
- Stream quality drops
- FFmpeg shows "buffer underrun" warnings

**Solutions:**

1. **Increase buffer size:**
   ```bash
   # In ecosystem.config.cjs or .env
   STREAM_BITRATE=6000000      # Increase from 4500000
   STREAM_BUFFER_SIZE=24000000 # 4x bitrate
   ```

2. **Enable low-latency mode:**
   ```bash
   STREAM_LOW_LATENCY=true
   STREAM_GOP_SIZE=30
   ```

3. **Check network:**
   ```bash
   # Test upload speed to Twitch
   ffmpeg -re -f lavfi -i testsrc -t 30 -f flv rtmps://live.twitch.tv/app/YOUR_KEY
   ```

### Resolution Mismatch

**Symptoms:**
- Stream shows wrong resolution
- Logs show "Resolution mismatch" warnings
- Black bars or stretched video

**Solutions:**

1. **Check viewport settings:**
   ```bash
   # In ecosystem.config.cjs
   STREAM_CAPTURE_WIDTH=1280
   STREAM_CAPTURE_HEIGHT=720
   ```

2. **Restart browser:**
   ```bash
   bunx pm2 restart hyperscape-duel
   ```
   Browser rotation happens automatically every hour to prevent memory leaks.

### FFmpeg Not Starting

**Symptoms:**
- No FFmpeg processes running
- RTMP status shows "not streaming"
- Logs show FFmpeg errors

**Solutions:**

1. **Check FFmpeg path:**
   ```bash
   which ffmpeg
   # Should be /usr/bin/ffmpeg
   ```

2. **Test FFmpeg manually:**
   ```bash
   ffmpeg -version
   ```

3. **Check stream keys:**
   ```bash
   # Verify keys are set (masked)
   echo "TWITCH: ${TWITCH_STREAM_KEY:+SET}${TWITCH_STREAM_KEY:-NOT SET}"
   ```

## Performance Optimization

### GPU Memory

Chrome + WebGPU can leak GPU memory over time. The streaming script automatically restarts the browser every hour to prevent OOM.

**Manual restart:**
```bash
bunx pm2 restart hyperscape-duel
```

### CPU Usage

FFmpeg encoding is CPU-intensive. Optimize with:

```bash
# Use faster preset (lower quality)
STREAM_PRESET=veryfast

# Reduce resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Lower frame rate
STREAM_FPS=24
```

### Network Bandwidth

**Recommended upload speeds:**
- 720p30: 5 Mbps minimum, 8 Mbps recommended
- 1080p30: 8 Mbps minimum, 12 Mbps recommended

**Test upload speed:**
```bash
# Install speedtest-cli
apt install speedtest-cli

# Run test
speedtest-cli
```

## Environment Variables Reference

### Display/GPU
- `DISPLAY` - X display (`:99` for Xorg/Xvfb)
- `GPU_RENDERING_MODE` - `xorg` or `xvfb-vulkan`
- `DUEL_CAPTURE_USE_XVFB` - `true` for Xvfb, `false` for Xorg
- `VK_ICD_FILENAMES` - Force NVIDIA Vulkan ICD
- `STREAM_CAPTURE_HEADLESS` - Always `false` (WebGPU requires display)

### Audio
- `STREAM_AUDIO_ENABLED` - `true` to capture audio
- `PULSE_AUDIO_DEVICE` - PulseAudio monitor device
- `PULSE_SERVER` - PulseAudio socket path
- `XDG_RUNTIME_DIR` - PulseAudio runtime directory

### Video Capture
- `STREAM_CAPTURE_MODE` - `cdp` (default) or `mediarecorder`
- `STREAM_CDP_QUALITY` - JPEG quality (1-100, default: 80)
- `STREAM_FPS` - Target frame rate (default: 30)
- `STREAM_CAPTURE_WIDTH` - Stream width (default: 1280)
- `STREAM_CAPTURE_HEIGHT` - Stream height (default: 720)
- `STREAM_CAPTURE_CHANNEL` - Browser channel (`chrome-dev`)
- `STREAM_CAPTURE_ANGLE` - ANGLE backend (`vulkan` or `metal`)

### Encoding
- `STREAM_BITRATE` - Video bitrate in bps (default: 4500000)
- `STREAM_BUFFER_SIZE` - FFmpeg buffer size (default: 4x bitrate)
- `STREAM_PRESET` - x264 preset (default: `medium`)
- `STREAM_LOW_LATENCY` - Enable zerolatency tune (default: `false`)
- `STREAM_GOP_SIZE` - Keyframe interval in frames (default: 60)

### RTMP Destinations
- `TWITCH_STREAM_KEY` - Twitch stream key
- `TWITCH_RTMP_URL` - Twitch ingest URL (optional)
- `KICK_STREAM_KEY` - Kick stream key
- `KICK_RTMP_URL` - Kick ingest URL
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X/Twitter ingest URL
- `YOUTUBE_STREAM_KEY` - YouTube key (set to `""` to disable)

### Recovery
- `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` - Recovery timeout (default: 30000)
- `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` - Max failures before fallback (default: 6)

## Implementation Details

### Deploy Script Flow

`scripts/deploy-vast.sh` performs the following steps:

1. **DNS Configuration** - Set Google DNS for container
2. **Git Pull** - Fetch latest code from main branch
3. **Restore Secrets** - Copy from `/tmp/hyperscape-secrets.env`
4. **Install Dependencies** - System packages, Chrome Dev, Playwright
5. **GPU Detection** - Verify NVIDIA GPU via `nvidia-smi`
6. **Vulkan Setup** - Force NVIDIA ICD, check `vulkaninfo`
7. **Display Server Setup**:
   - Try Xorg if DRI devices available
   - Validate GPU rendering (not swrast)
   - Fall back to Xvfb if Xorg fails
   - FAIL if neither works (WebGPU required)
8. **PulseAudio Setup** - Create virtual sink, start daemon
9. **Build** - Build core packages
10. **Database Migration** - Push schema, warmup connection
11. **PM2 Start** - Launch duel stack via ecosystem.config.cjs
12. **Health Check** - Wait for server to respond
13. **Diagnostics** - Log streaming status

### Streaming Script

`packages/server/scripts/stream-to-rtmp.ts` manages the capture pipeline:

**CDP Mode:**
1. Launch Chrome with WebGPU flags
2. Navigate to game URL (`http://localhost:3333/?page=stream`)
3. Wait for stream readiness
4. Create CDP session
5. Start screencast with JPEG format
6. Pipe frames to FFmpeg stdin
7. FFmpeg encodes H.264 and streams to RTMP

**Recovery:**
- Soft recovery: Restart CDP screencast (no stream gap)
- Hard recovery: Restart browser (brief stream gap)
- Fallback: Switch to MediaRecorder mode after 6 failures

**Browser Rotation:**
- Automatic restart every hour to prevent GPU memory leaks
- Graceful restart with minimal stream interruption

### PM2 Configuration

`ecosystem.config.cjs` defines the PM2 app:

**Process:**
- Name: `hyperscape-duel`
- Script: `scripts/duel-stack.mjs`
- Interpreter: `bun`
- Auto-restart: Yes (infinite retries)
- Memory limit: 4GB (restart if exceeded)

**Environment:**
- All GPU/display settings
- Stream keys and URLs
- Database connection
- Solana keypairs

**Logging:**
- Error log: `logs/duel-error.log`
- Output log: `logs/duel-out.log`
- Merged logs with timestamps

## Security

### Secrets Management

**Never commit secrets to git.** All secrets are:
1. Stored as GitHub Secrets
2. Injected via CI/CD workflow
3. Written to `/tmp/hyperscape-secrets.env`
4. Copied to `packages/server/.env` by deploy script
5. Persisted across git resets

**Required Secrets:**
- `DATABASE_URL` - PostgreSQL connection string
- `TWITCH_STREAM_KEY` - Twitch stream key
- `KICK_STREAM_KEY` - Kick stream key
- `KICK_RTMP_URL` - Kick ingest URL
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X/Twitter ingest URL
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana keypair (base58)

### Stream Key Rotation

To rotate stream keys:

1. Update GitHub Secrets in repository settings
2. Trigger deployment workflow (push to main or manual trigger)
3. New keys automatically injected on next deploy

## Advanced Configuration

### Custom FFmpeg Flags

Edit `packages/server/src/streaming/rtmp-bridge.ts` to customize FFmpeg encoding:

```typescript
const ffmpegArgs = [
  '-f', 'image2pipe',
  '-c:v', 'mjpeg',
  '-i', 'pipe:0',
  // Add custom flags here
  '-c:v', 'libx264',
  '-preset', 'medium',
  // ...
];
```

### Custom RTMP Destinations

Add custom destinations via `RTMP_DESTINATIONS_JSON`:

```bash
RTMP_DESTINATIONS_JSON='[
  {
    "name": "Custom",
    "url": "rtmp://custom.server/app",
    "key": "stream_key"
  }
]'
```

### Viewport Scaling

For higher quality streams:

```bash
STREAM_CAPTURE_WIDTH=1920
STREAM_CAPTURE_HEIGHT=1080
STREAM_BITRATE=8000000
STREAM_BUFFER_SIZE=32000000
```

**Note:** Higher resolutions require more CPU/GPU and bandwidth.

## Monitoring

### Stream Health Metrics

Logged every 30 seconds in PM2 logs:

- **CDP FPS** - Frames captured per second
- **Resolution** - Current capture resolution
- **Frames** - Total frames sent to FFmpeg
- **Dropped** - Frames dropped (backpressure)
- **Backpressure** - FFmpeg buffer full

**Example:**
```
[Stream Health] CDP FPS: 30 | Resolution: 1280x720 | Frames: 54321 | Dropped: 12 | Backpressure: off
```

### RTMP Status

Check `/root/hyperscape/packages/server/public/live/rtmp-status.json`:

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
    "uptimeSeconds": 3600,
    "healthy": true
  }
}
```

### Alerts

Set up monitoring for:
- PM2 process crashes (check `pm2 status`)
- FFmpeg process exits (check `ps aux | grep ffmpeg`)
- Stream health API (`/api/streaming/state`)
- RTMP status file age (should update every 2s)

## Cost Optimization

### Vast.ai Instance Selection

**Recommended specs:**
- GPU: RTX 3060 or better (12GB+ VRAM)
- CPU: 4+ cores
- RAM: 16GB+
- Storage: 50GB+
- Network: 100 Mbps+ upload

**Cost:** ~$0.20-0.40/hour depending on GPU

### Reduce Costs

1. **Lower resolution:**
   ```bash
   STREAM_CAPTURE_WIDTH=1280
   STREAM_CAPTURE_HEIGHT=720
   ```

2. **Lower frame rate:**
   ```bash
   STREAM_FPS=24
   ```

3. **Faster encoding:**
   ```bash
   STREAM_PRESET=veryfast
   ```

4. **Disable audio:**
   ```bash
   STREAM_AUDIO_ENABLED=false
   ```

## References

- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
- [packages/server/scripts/stream-to-rtmp.ts](../packages/server/scripts/stream-to-rtmp.ts) - Streaming script
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [.github/workflows/deploy-vast.yml](../.github/workflows/deploy-vast.yml) - CI/CD workflow
