# Streaming Configuration

Hyperscape supports multi-platform RTMP streaming to Twitch, Kick, X (Twitter), and custom destinations.

## Overview

The streaming system uses:
- **Chrome Dev** with WebGPU for hardware-accelerated rendering
- **Xvfb** for headless display server
- **FFmpeg** for video encoding and RTMP output
- **CDP (Chrome DevTools Protocol)** for reliable frame capture

## Supported Platforms

As of February 2026, Hyperscape streams to:

| Platform | Protocol | Default Ingest | Notes |
|----------|----------|----------------|-------|
| **Twitch** | RTMP | `rtmp://live.twitch.tv/app` | ✅ Recommended (lowest latency) |
| **Kick** | RTMPS | `rtmps://fa723fc1b171.global-contribute.live-video.net` | ✅ Supported |
| **X (Twitter)** | RTMP | `rtmp://sg.pscp.tv:80/x` | ✅ Requires X Premium |
| **YouTube** | RTMP | `rtmp://a.rtmp.youtube.com/live2` | ⚠️ Removed (not needed) |
| **Custom** | RTMP/RTMPS | Your server | ✅ Any RTMP server |

## Configuration

### Environment Variables

Set in `packages/server/.env` or `ecosystem.config.cjs`:

#### Twitch

```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
```

Get your stream key from [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream).

#### Kick

```bash
KICK_STREAM_KEY=sk_us-west-2_...
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net
```

Get your stream key from Kick Creator Dashboard.

#### X (Twitter)

```bash
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

Get RTMP URL from **Media Studio → Producer → Create Broadcast → Create Source**.

**Requirements:**
- X Premium subscription
- Desktop streaming enabled

#### Custom RTMP Server

```bash
CUSTOM_RTMP_NAME=My Server
CUSTOM_RTMP_URL=rtmp://your-server.com/live
CUSTOM_STREAM_KEY=your-key
```

### Canonical Platform

The canonical platform determines anti-cheat timing and default public delay:

```bash
# Options: youtube | twitch | hls
STREAMING_CANONICAL_PLATFORM=twitch
```

**Default Delays:**
- `youtube` → 15000ms (15 seconds)
- `twitch` → 12000ms (12 seconds)
- `hls` → 4000ms (4 seconds)

**Override delay:**
```bash
# Set to 0 for no delay (live betting)
STREAMING_PUBLIC_DELAY_MS=0
```

## Capture Settings

### Resolution

```bash
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

Supported resolutions:
- 1920x1080 (1080p) - High quality, high bandwidth
- 1280x720 (720p) - Recommended for most streams
- 854x480 (480p) - Low bandwidth

### Rendering Backend

```bash
# Use Chrome Dev channel (has WebGPU enabled)
STREAM_CAPTURE_CHANNEL=chrome-dev

# Use Vulkan ANGLE backend for GPU rendering
STREAM_CAPTURE_ANGLE=vulkan

# Enable WebGPU (required for TSL shaders)
STREAM_CAPTURE_DISABLE_WEBGPU=false
```

### Headless Mode

```bash
# Use CDP mode for reliable frame capture
STREAM_CAPTURE_MODE=cdp

# Run headful with Xvfb (required for GPU access)
STREAM_CAPTURE_HEADLESS=false

# Enable Xvfb virtual display
DUEL_CAPTURE_USE_XVFB=true
```

## Stability Tuning

Recent improvements (February 2026) for long-running streams:

### CDP Stall Detection

```bash
# Intervals before considering stream stalled (default: 4 = 120 seconds)
# Increased from 2 to reduce false restarts
CDP_STALL_THRESHOLD=4
```

### FFmpeg Restart Limits

```bash
# Maximum restart attempts before giving up (default: 8)
# Increased from 5 for better resilience
FFMPEG_MAX_RESTART_ATTEMPTS=8
```

### Capture Recovery

```bash
# Maximum soft recovery failures before full teardown (default: 4)
# Increased from 2 to allow more recovery attempts
CAPTURE_RECOVERY_MAX_FAILURES=4

# Recovery timeout in milliseconds (default: 30000)
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000
```

### Soft Recovery

The system now attempts soft CDP recovery (restart screencast without browser/FFmpeg teardown) before full restart. This eliminates stream gaps during recovery.

## FFmpeg Configuration

### Output Format

Hyperscape uses FFmpeg's `tee` muxer for efficient multi-platform streaming:

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset veryfast -b:v 3000k \
  -c:a aac -b:a 128k \
  -f tee \
  "[f=flv]rtmp://live.twitch.tv/app/live_key|[f=flv]rtmps://kick.com/live/kick_key"
```

### Encoding Settings

Default settings optimized for 720p streaming:

```bash
# Video
-c:v libx264           # H.264 codec
-preset veryfast       # Encoding speed
-b:v 3000k            # 3 Mbps bitrate
-maxrate 3000k        # Max bitrate
-bufsize 6000k        # Buffer size
-g 60                 # Keyframe interval (2 seconds at 30fps)
-r 30                 # Frame rate

# Audio
-c:a aac              # AAC codec
-b:a 128k             # 128 kbps bitrate
-ar 44100             # Sample rate
```

## Monitoring

### Stream Health

Check stream status via health endpoint:

```bash
curl http://localhost:5555/health
```

Response includes streaming status:
```json
{
  "status": "ok",
  "uptime": 12345,
  "streaming": {
    "active": true,
    "platforms": ["twitch", "kick", "x"],
    "uptime": 3600
  }
}
```

### Logs

```bash
# PM2 logs (Vast.ai deployment)
bunx pm2 logs hyperscape-duel

# Direct logs
tail -f logs/duel-out.log
tail -f logs/duel-error.log
```

## Troubleshooting

### Stream not starting

**Check Chrome installation:**
```bash
google-chrome-unstable --version
```

**Check Vulkan support:**
```bash
vulkaninfo --summary
nvidia-smi
```

**Check Xvfb:**
```bash
ps aux | grep Xvfb
```

### Black screen / no video

**Cause:** WebGPU not available or GPU drivers missing.

**Solutions:**
1. Install Vulkan drivers: `apt-get install mesa-vulkan-drivers vulkan-tools`
2. Verify GPU access: `nvidia-smi`
3. Check WebGPU enabled: `STREAM_CAPTURE_DISABLE_WEBGPU=false`

### Stream stuttering / frame drops

**Reduce resolution:**
```bash
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

**Reduce bitrate:**
```bash
# Edit FFmpeg settings in stream-to-rtmp.ts
-b:v 2000k  # Lower from 3000k
```

### Frequent restarts

**Increase stall threshold:**
```bash
CDP_STALL_THRESHOLD=6  # Increase from 4
```

**Increase recovery failures:**
```bash
CAPTURE_RECOVERY_MAX_FAILURES=6  # Increase from 4
```

### Platform-specific issues

**Twitch:**
- Verify stream key is correct
- Check ingest server: `rtmp://live.twitch.tv/app`
- Test with: `ffplay rtmp://live.twitch.tv/app/your_key`

**Kick:**
- Use RTMPS (not RTMP)
- Verify stream key format: `sk_us-west-2_...`
- Check ingest URL matches your region

**X (Twitter):**
- Requires X Premium subscription
- Verify RTMP URL from Media Studio
- Test connection before going live

## Performance Optimization

### Reduce CPU Usage

```bash
# Use faster encoding preset
-preset ultrafast  # Instead of veryfast

# Reduce frame rate
-r 24  # Instead of 30
```

### Reduce Memory Usage

```bash
# Disable combat AI state polling (reduces per-agent overhead)
STREAMING_DUEL_COMBAT_AI_ENABLED=false

# Reduce max agents
AUTO_START_AGENTS_MAX=5
```

### Reduce Bandwidth

```bash
# Lower bitrate
-b:v 2000k  # Instead of 3000k

# Lower resolution
STREAM_CAPTURE_WIDTH=854
STREAM_CAPTURE_HEIGHT=480
```

## Related Documentation

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment guide
- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Graceful deployment API
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [packages/server/src/streaming/](../packages/server/src/streaming/) - Streaming implementation
