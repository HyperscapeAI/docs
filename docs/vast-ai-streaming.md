# Vast.ai GPU Streaming Guide

This guide covers deploying Hyperscape on Vast.ai for live streaming to Twitch, Kick, and X/Twitter with GPU-accelerated WebGPU rendering.

## Overview

Hyperscape uses a sophisticated streaming pipeline that captures gameplay from a Chrome browser running on an NVIDIA GPU and encodes it to RTMP streams using FFmpeg.

**Key Components:**
- **WebGPU Rendering**: Chrome with NVIDIA GPU via ANGLE/Vulkan
- **Display Server**: Xorg (preferred) or Xvfb (fallback)
- **Audio Capture**: PulseAudio with virtual sink
- **Video Capture**: Chrome DevTools Protocol (CDP) screencast
- **Encoding**: FFmpeg with H.264 (x264)
- **Distribution**: RTMP tee muxer for multi-platform streaming

## Requirements

### Hardware
- **NVIDIA GPU** with Vulkan support (GTX 1060 or better recommended)
- **8GB+ RAM** (16GB recommended for stable streaming)
- **50GB+ storage** for Docker images and game assets

### Software (Auto-installed by deploy script)
- Ubuntu 20.04+ or Debian 11+
- NVIDIA drivers (auto-detected version)
- Docker
- Chrome Dev channel (google-chrome-unstable)
- FFmpeg
- PulseAudio
- Xorg or Xvfb

## Architecture

### GPU Rendering Modes

The deployment script tries rendering modes in this order:

#### 1. Xorg with NVIDIA (Preferred)
- **Best performance** with direct GPU access
- Requires DRI/DRM device access (`/dev/dri/card0`)
- Uses NVIDIA Xorg driver with headless configuration
- Validates GPU rendering (not software fallback)

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

#### 2. Xvfb with NVIDIA Vulkan (Fallback)
- Virtual framebuffer provides X11 protocol
- Chrome uses NVIDIA GPU via ANGLE/Vulkan
- CDP captures frames from Chrome's internal GPU rendering
- Works in containers without DRM access

**Configuration:**
```bash
DISPLAY=:99
GPU_RENDERING_MODE=xvfb-vulkan
DUEL_CAPTURE_USE_XVFB=true
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
```

#### 3. Headless Mode (NOT SUPPORTED)
- WebGPU requires a display server
- Deployment **fails** if neither Xorg nor Xvfb can start
- No soft fallback to headless mode

### Audio Capture

PulseAudio provides audio capture from Chrome:

1. **Virtual Sink**: `chrome_audio` null sink created by deploy script
2. **Monitor Device**: `chrome_audio.monitor` captures audio output
3. **User Mode**: PulseAudio runs in user mode (more reliable than system mode)
4. **Runtime Directory**: `/tmp/pulse-runtime` for socket communication

**Configuration:**
```bash
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

### Video Capture

Chrome DevTools Protocol (CDP) screencast provides frame capture:

1. **CDP Connection**: Playwright connects to Chrome via CDP
2. **Screencast**: `Page.startScreencast()` with JPEG encoding
3. **Frame Piping**: Direct JPEG frames to FFmpeg stdin
4. **Resolution Tracking**: Automatic viewport recovery on mismatch
5. **Timeout Handling**: 5s timeout on probe evaluate calls
6. **Recovery**: Proceeds with capture after 5 consecutive probe timeouts

**Configuration:**
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80
STREAM_FPS=30
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

### Encoding

FFmpeg encodes video with H.264 (x264):

**Default Settings (Optimized for Quality):**
```bash
STREAM_BITRATE=4500000          # 4.5 Mbps
STREAM_BUFFER_SIZE=18000000     # 4x bitrate buffer
STREAM_PRESET=medium            # Balanced quality/speed
STREAM_LOW_LATENCY=false        # film tune with B-frames
STREAM_GOP_SIZE=60              # 2s keyframe interval at 30fps
```

**Low-Latency Settings (Faster Playback Start):**
```bash
STREAM_LOW_LATENCY=true         # zerolatency tune, no B-frames
STREAM_GOP_SIZE=30              # 1s keyframe interval
```

**Audio Settings:**
```bash
# Input buffering
thread_queue_size=1024
use_wallclock_as_timestamps=1

# Resampling for drift recovery
aresample=async=1000:first_pts=0
```

### RTMP Multi-Streaming

FFmpeg tee muxer enables simultaneous streaming to multiple platforms:

**Supported Platforms:**
- **Twitch**: `rtmps://live.twitch.tv/app`
- **Kick**: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`
- **X/Twitter**: `rtmp://sg.pscp.tv:80/x`
- **YouTube**: Disabled by default (set `YOUTUBE_STREAM_KEY=""`)

**Configuration:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
YOUTUBE_STREAM_KEY=  # Explicitly disabled
```

### Production Client Build

When streaming, use production client build for faster page loads:

**Problem:** Vite dev server uses JIT compilation, causing 180s+ page load times that exceed browser timeout.

**Solution:** Pre-build client and serve via `vite preview`:

```bash
NODE_ENV=production
# OR
DUEL_USE_PRODUCTION_CLIENT=true
```

**Benefits:**
- No on-demand module compilation
- Significantly faster page loads (< 10s)
- Prevents browser timeout issues
- Reduces CPU usage during streaming

## Deployment

### GitHub Secrets

Set these secrets in your GitHub repository (Settings → Secrets → Actions):

**Required:**
```
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
DATABASE_URL=postgresql://user:pass@host:5432/db
SOLANA_DEPLOYER_PRIVATE_KEY=your-base58-private-key
JWT_SECRET=your-jwt-secret
ARENA_EXTERNAL_BET_WRITE_KEY=your-bet-write-key
```

**Vast.ai SSH:**
```
VAST_HOST=ssh.vast.ai
VAST_PORT=12345
VAST_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
```

### Deployment Script

The `scripts/deploy-vast.sh` script handles complete setup:

**Steps:**
1. **DNS Configuration**: Sets Google DNS (8.8.8.8, 8.8.4.4)
2. **Code Update**: Pulls latest from `main` branch
3. **Secrets Restoration**: Copies secrets from `/tmp/hyperscape-secrets.env`
4. **System Dependencies**: Installs build tools, FFmpeg, PulseAudio, Vulkan
5. **GPU Validation**: Verifies NVIDIA GPU via `nvidia-smi`
6. **Vulkan Setup**: Forces NVIDIA ICD, checks `vulkaninfo`
7. **Display Server**: Tries Xorg, falls back to Xvfb
8. **Chrome Installation**: Installs Chrome Dev channel
9. **PulseAudio Setup**: Creates `chrome_audio` sink, starts daemon
10. **Playwright Installation**: Installs Chromium and dependencies
11. **Build**: Builds core packages (physx, shared, etc.)
12. **Database Migration**: Pushes schema with `drizzle-kit`
13. **Port Proxies**: Sets up socat proxies (35143, 35079, 35144)
14. **Environment Persistence**: Writes GPU/display settings to `.env`
15. **PM2 Startup**: Starts duel stack via `ecosystem.config.cjs`
16. **Health Check**: Waits for server to respond on port 5555
17. **Diagnostics**: Checks streaming status, FFmpeg processes, logs

**Usage:**
```bash
# Triggered automatically by GitHub Actions on push to main
# Or run manually on Vast.ai instance:
cd /root/hyperscape
./scripts/deploy-vast.sh
```

### Port Mapping

Vast.ai requires port mapping for external access:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | HTTP API |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

**Socat Proxies:**
```bash
socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 &
socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 &
socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 &
```

## Troubleshooting

### GPU Not Detected

**Symptoms:**
- `nvidia-smi` fails or shows no GPU
- Deployment script exits with "FATAL: nvidia-smi failed"

**Solutions:**
1. **Check Vast.ai instance**: Ensure you selected an NVIDIA GPU instance
2. **Verify drivers**: `nvidia-smi` should show GPU info
3. **Check CUDA**: `nvcc --version` should show CUDA version
4. **Restart instance**: Sometimes drivers need initialization

### Vulkan Not Available

**Symptoms:**
- `vulkaninfo` fails or shows no devices
- Chrome logs "Vulkan not available"

**Solutions:**
1. **Check ICD**: `ls /usr/share/vulkan/icd.d/nvidia_icd.json`
2. **Force NVIDIA ICD**: `export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json`
3. **Install Vulkan tools**: `apt install vulkan-tools mesa-vulkan-drivers`
4. **Check GPU**: `vulkaninfo --summary` should show NVIDIA device

### Display Server Fails

**Symptoms:**
- Xorg fails to start
- Xvfb fails to start
- Deployment exits with "FATAL ERROR: Cannot establish WebGPU-capable rendering mode"

**Solutions:**
1. **Check DRI devices**: `ls -la /dev/dri/`
2. **Check X logs**: `cat /var/log/Xorg.99.log`
3. **Kill stale processes**: `pkill -9 Xorg; pkill -9 Xvfb`
4. **Clean lock files**: `rm -f /tmp/.X*-lock; rm -rf /tmp/.X11-unix`
5. **Verify display**: `xdpyinfo -display :99`

### PulseAudio Issues

**Symptoms:**
- No audio in stream
- FFmpeg errors about PulseAudio device
- `pactl` commands fail

**Solutions:**
1. **Check daemon**: `pulseaudio --check` (should exit silently if running)
2. **List sinks**: `pactl list short sinks` (should show `chrome_audio`)
3. **Restart PulseAudio**:
   ```bash
   pulseaudio --kill
   rm -rf /tmp/pulse-runtime
   mkdir -p /tmp/pulse-runtime
   chmod 700 /tmp/pulse-runtime
   pulseaudio --start --exit-idle-time=-1
   ```
4. **Create sink manually**:
   ```bash
   pactl load-module module-null-sink sink_name=chrome_audio
   pactl set-default-sink chrome_audio
   ```

### Stream Not Starting

**Symptoms:**
- No FFmpeg processes running
- RTMP status file shows errors
- PM2 logs show capture failures

**Solutions:**
1. **Check game client**: `curl http://localhost:3333` (should return 200)
2. **Check streaming API**: `curl http://localhost:5555/api/streaming/state`
3. **Check RTMP status**: `cat /root/hyperscape/packages/server/public/live/rtmp-status.json`
4. **Review PM2 logs**: `bunx pm2 logs hyperscape-duel --lines 200`
5. **Check FFmpeg**: `ps aux | grep ffmpeg`
6. **Restart stack**: `bunx pm2 restart hyperscape-duel`

### Black Frames / No Video

**Symptoms:**
- Stream shows black screen
- CDP capture returns empty frames
- Chrome not rendering

**Solutions:**
1. **Check WebGPU**: Open `http://localhost:3333` in Chrome, check console for WebGPU errors
2. **Verify GPU rendering**: `glxinfo | grep "OpenGL renderer"` (should show NVIDIA)
3. **Check display**: `echo $DISPLAY` (should be `:99` or `:0`)
4. **Test X server**: `xdpyinfo -display $DISPLAY`
5. **Check Chrome flags**: Review `stream-to-rtmp.ts` for correct GPU flags
6. **Enable production build**: Set `DUEL_USE_PRODUCTION_CLIENT=true`

### Browser Timeout

**Symptoms:**
- "Navigation timeout" errors in logs
- Page takes > 180s to load
- Vite dev server slow

**Solutions:**
1. **Enable production build**: Set `DUEL_USE_PRODUCTION_CLIENT=true` or `NODE_ENV=production`
2. **Pre-build client**: `cd packages/client && bun run build`
3. **Check Vite**: Ensure `vite preview` is used, not `vite dev`
4. **Increase timeout**: Modify `stream-to-rtmp.ts` navigation timeout (not recommended)

### Resolution Mismatch

**Symptoms:**
- CDP reports different resolution than expected
- Viewport restoration messages in logs
- Frames appear stretched or cropped

**Solutions:**
1. **Check configuration**:
   ```bash
   echo $STREAM_CAPTURE_WIDTH  # Should be 1280
   echo $STREAM_CAPTURE_HEIGHT # Should be 720
   ```
2. **Verify viewport**: CDP automatically recovers viewport on mismatch
3. **Check browser zoom**: Ensure Chrome zoom is 100%
4. **Review logs**: Look for "Resolution mismatch detected" messages

### Audio Desync

**Symptoms:**
- Audio ahead or behind video
- Audio dropouts
- Crackling or stuttering

**Solutions:**
1. **Check buffering**: Ensure `thread_queue_size=1024` for audio input
2. **Enable async resampling**: `aresample=async=1000:first_pts=0`
3. **Use wallclock timestamps**: `use_wallclock_as_timestamps=1`
4. **Increase buffer**: Set `STREAM_BUFFER_SIZE=18000000` (4x bitrate)
5. **Check PulseAudio**: `pactl list short sinks` should show `chrome_audio`

### High CPU Usage

**Symptoms:**
- CPU at 100%
- Dropped frames
- Laggy gameplay

**Solutions:**
1. **Use hardware encoding**: Ensure NVIDIA GPU is used (not software)
2. **Lower preset**: Set `STREAM_PRESET=veryfast` or `ultrafast`
3. **Reduce bitrate**: Set `STREAM_BITRATE=3000000` (3 Mbps)
4. **Lower resolution**: Set `STREAM_CAPTURE_WIDTH=960` and `STREAM_CAPTURE_HEIGHT=540`
5. **Enable low-latency**: Set `STREAM_LOW_LATENCY=true`

### Memory Leaks

**Symptoms:**
- RAM usage grows over time
- OOM killer terminates processes
- System becomes unresponsive

**Solutions:**
1. **Restart PM2**: `bunx pm2 restart hyperscape-duel`
2. **Check for zombie processes**: `ps aux | grep -E "chrome|ffmpeg"`
3. **Monitor memory**: `watch -n 1 free -h`
4. **Increase swap**: Add swap file if RAM < 16GB
5. **Review logs**: Look for memory warnings in PM2 logs

## Monitoring

### Health Checks

**Server Health:**
```bash
curl http://localhost:5555/health
# Should return: {"status":"ok"}
```

**Streaming State:**
```bash
curl http://localhost:5555/api/streaming/state
# Returns JSON with streaming status
```

**RTMP Status:**
```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
# Shows FFmpeg status and stream destinations
```

### PM2 Management

**View Logs:**
```bash
bunx pm2 logs hyperscape-duel          # Live tail
bunx pm2 logs hyperscape-duel --lines 200  # Last 200 lines
bunx pm2 logs hyperscape-duel --err    # Error logs only
```

**Process Status:**
```bash
bunx pm2 status                        # All processes
bunx pm2 show hyperscape-duel          # Detailed info
```

**Restart/Stop:**
```bash
bunx pm2 restart hyperscape-duel       # Restart
bunx pm2 stop hyperscape-duel          # Stop
bunx pm2 delete hyperscape-duel        # Remove
```

**Save Configuration:**
```bash
bunx pm2 save                          # Save process list
bunx pm2 startup                       # Enable auto-start on boot
```

### System Monitoring

**GPU Usage:**
```bash
watch -n 1 nvidia-smi
```

**CPU/Memory:**
```bash
htop
```

**Network:**
```bash
iftop -i eth0
```

**Disk:**
```bash
df -h
du -sh /root/hyperscape
```

## Performance Tuning

### Encoding Presets

| Preset | CPU Usage | Quality | Latency | Use Case |
|--------|-----------|---------|---------|----------|
| ultrafast | Very Low | Low | Very Low | Testing, low-end GPU |
| veryfast | Low | Medium | Low | Budget streaming |
| faster | Medium | Good | Medium | Balanced |
| fast | Medium-High | Good | Medium | Balanced |
| medium | High | Very Good | Medium | **Default** |
| slow | Very High | Excellent | High | High-quality archive |

**Recommendation:** Use `medium` for live streaming, `slow` for recording.

### Bitrate Guidelines

| Resolution | Bitrate | Buffer | Use Case |
|------------|---------|--------|----------|
| 1920x1080 | 6000 kbps | 24000k | Full HD streaming |
| 1280x720 | 4500 kbps | 18000k | **Default** HD streaming |
| 960x540 | 2500 kbps | 10000k | Low-bandwidth |
| 640x360 | 1500 kbps | 6000k | Mobile/testing |

**Recommendation:** Use 1280x720 @ 4.5 Mbps for most streams.

### GOP Size

| GOP Size | Keyframe Interval | Latency | Seeking | Use Case |
|----------|-------------------|---------|---------|----------|
| 30 | 1s @ 30fps | Very Low | Excellent | Low-latency |
| 60 | 2s @ 30fps | Low | Good | **Default** |
| 120 | 4s @ 30fps | Medium | Fair | High compression |
| 240 | 8s @ 30fps | High | Poor | Archive |

**Recommendation:** Use 60 for live streaming, 120 for recording.

## Advanced Configuration

### Custom FFmpeg Flags

Edit `packages/server/src/streaming/stream-to-rtmp.ts` to add custom FFmpeg flags:

```typescript
const ffmpegArgs = [
  '-f', 'image2pipe',
  '-framerate', fps.toString(),
  '-i', 'pipe:0',
  // Add custom flags here
  '-preset', 'medium',
  '-tune', 'film',
  // ...
];
```

### Multiple RTMP Destinations

Add custom destinations via environment variables:

```bash
# Custom RTMP server
CUSTOM_RTMP_NAME=MyServer
CUSTOM_RTMP_URL=rtmp://my-server.com/live
CUSTOM_STREAM_KEY=my-stream-key

# JSON array for multiple custom destinations
RTMP_DESTINATIONS_JSON='[{"name":"Server1","url":"rtmp://host1/live","key":"key1","enabled":true},{"name":"Server2","url":"rtmp://host2/live","key":"key2","enabled":true}]'
```

### HLS Output

Enable HLS output for local playback:

```bash
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2
HLS_LIST_SIZE=24
HLS_DELETE_THRESHOLD=96
HLS_START_NUMBER=1700000000
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

**Access:** `http://your-server:5555/live/stream.m3u8`

## Security

### Secrets Management

**NEVER commit secrets to git:**
- Use GitHub Secrets for CI/CD
- Store secrets in `/tmp/hyperscape-secrets.env` on server
- Secrets are copied to `packages/server/.env` by deploy script
- `.gitignore` blocks all `.env` files

**Required Secrets:**
- Stream keys (Twitch, Kick, X)
- Database URL
- JWT secret
- Solana private keys
- Arena bet write key

### SSH Access

**Vast.ai SSH:**
```bash
ssh -p $VAST_PORT root@$VAST_HOST -i ~/.ssh/vast_id_rsa
```

**GitHub Actions SSH:**
- Uses `appleboy/ssh-action`
- SSH key stored in `VAST_SSH_KEY` secret
- Secrets written to `/tmp/hyperscape-secrets.env` before deploy

### Firewall

**Vast.ai Firewall:**
- Only expose required ports (35143, 35079, 35144)
- Use socat proxies for port mapping
- Internal services (5555, 8080) not directly accessible

## References

- **Deployment Script**: `scripts/deploy-vast.sh`
- **Streaming Code**: `packages/server/src/streaming/stream-to-rtmp.ts`
- **PM2 Config**: `packages/server/ecosystem.config.cjs`
- **Environment Variables**: `.env.example`, `packages/server/.env.example`
- **Architecture**: [AGENTS.md](../AGENTS.md#vastai-deployment-architecture)
- **Development Guide**: [CLAUDE.md](../CLAUDE.md)

## Support

For issues or questions:
- **GitHub Issues**: [HyperscapeAI/hyperscape/issues](https://github.com/HyperscapeAI/hyperscape/issues)
- **Discord**: [Join our Discord](https://discord.gg/hyperscape)
- **Documentation**: [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md)
