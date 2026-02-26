# RTMP Streaming Configuration

This guide covers configuring multi-platform RTMP streaming for Hyperscape duel broadcasts to Twitch, Kick, and X (Twitter).

## Overview

Hyperscape streams gameplay to multiple platforms simultaneously using FFmpeg's tee muxer:

```
┌──────────────────────────────────────────────────────────┐
│ Game Client (Headless Chrome + WebGPU)                   │
│  - Captures 1280x720 @ 30fps                             │
│  - WebCodecs H.264 encoding                              │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ RTMP Bridge (FFmpeg tee muxer)                           │
│  - Single encode, multiple outputs                       │
│  - H.264 video, AAC audio                                │
└──────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌────────┐        ┌────────┐       ┌────────┐
   │ Twitch │        │  Kick  │       │   X    │
   └────────┘        └────────┘       └────────┘
```

## Environment Variables

### Twitch

```bash
# Get from: https://dashboard.twitch.tv/settings/stream
TWITCH_STREAM_KEY=live_123456789_abcdefghij

# RTMP URL (hardcoded in code)
# rtmp://live.twitch.tv/app
```

**Ingest servers** (auto-selected by Twitch):
- Primary: `rtmp://live.twitch.tv/app`
- Backup: `rtmp://live-backup.twitch.tv/app`

### Kick

```bash
# Get from: Kick Creator Dashboard → Stream Settings
KICK_STREAM_KEY=sk_us-west-2_OrgZh8XyN0Qs_DKZE46VeaiqkczE5ZMTx63ct25wZ7q

# RTMP URL (RTMPS for Kick)
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net
```

**Note**: Kick uses RTMPS (RTMP over TLS) instead of plain RTMP.

### X (Twitter)

```bash
# Get from: Media Studio → Producer → Create Broadcast → Create Source
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

**Requirements**:
- X Premium subscription
- Desktop streaming enabled
- RTMP URL is unique per broadcast

**Regional servers**:
- Singapore: `rtmp://sg.pscp.tv:80/x`
- US East: `rtmp://va.pscp.tv:80/x`
- US West: `rtmp://ca.pscp.tv:80/x`

## Configuration Files

### ecosystem.config.cjs

PM2 configuration for production deployment:

```javascript
env: {
  // Twitch
  TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY || "",
  
  // Kick (RTMPS)
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
  KICK_RTMP_URL: process.env.KICK_RTMP_URL || "rtmps://...",
  
  // X/Twitter
  X_STREAM_KEY: process.env.X_STREAM_KEY || "",
  X_RTMP_URL: process.env.X_RTMP_URL || "rtmp://sg.pscp.tv:80/x",
  
  // Canonical platform for anti-cheat timing
  STREAMING_CANONICAL_PLATFORM: "twitch",
  
  // Public data delay (0 = no delay for live betting)
  STREAMING_PUBLIC_DELAY_MS: "0",
}
```

### packages/server/.env.example

Full streaming configuration options:

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

# Kick
KICK_STREAM_KEY=sk_us-west-2_...
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net

# X/Twitter
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Canonical platform (youtube | twitch | hls)
STREAMING_CANONICAL_PLATFORM=twitch

# Public delay override (milliseconds)
# Default by platform: youtube=15000, twitch=12000, hls=4000
STREAMING_PUBLIC_DELAY_MS=0

# Stream capture settings
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_MODE=cdp
STREAM_CAPTURE_CHANNEL=chrome-dev
STREAM_CAPTURE_ANGLE=vulkan
```

## Stream Settings

### Resolution

**Default**: 1280x720 (720p)

**Supported resolutions**:
- 1920x1080 (1080p) - requires more bandwidth
- 1280x720 (720p) - recommended
- 854x480 (480p) - lower quality

**Configure**:
```bash
STREAM_CAPTURE_WIDTH=1920
STREAM_CAPTURE_HEIGHT=1080
```

### Frame Rate

**Default**: 30 FPS

**Supported frame rates**:
- 60 FPS - smoother but requires more bandwidth
- 30 FPS - recommended for most platforms
- 24 FPS - cinematic look

**Note**: Frame rate is determined by browser capture, not configurable via env var.

### Bitrate

**Default**: Auto-selected by FFmpeg based on resolution

**Twitch recommendations**:
- 1080p @ 30fps: 4500 kbps
- 720p @ 30fps: 3000 kbps
- 480p @ 30fps: 1500 kbps

**Kick recommendations**:
- 1080p @ 30fps: 6000 kbps
- 720p @ 30fps: 4000 kbps

**X recommendations**:
- 720p @ 30fps: 2500-4000 kbps

## Platform-Specific Configuration

### Twitch

**Stream key format**: `live_<user_id>_<random_string>`

**Ingest servers**: Auto-selected by Twitch based on location

**Latency modes**:
- Normal: 15-20 seconds
- Low Latency: 3-5 seconds (default)
- Ultra Low Latency: <2 seconds (not recommended for RTMP)

**Get stream key**:
1. Go to https://dashboard.twitch.tv/settings/stream
2. Copy "Primary Stream key"
3. Set as `TWITCH_STREAM_KEY`

### Kick

**Stream key format**: `sk_<region>_<random_string>`

**RTMPS required**: Kick uses RTMPS (RTMP over TLS) instead of plain RTMP.

**Ingest servers**: Provided in Creator Dashboard

**Get stream key**:
1. Go to Kick Creator Dashboard
2. Navigate to Stream Settings
3. Copy "Stream Key" and "Server URL"
4. Set as `KICK_STREAM_KEY` and `KICK_RTMP_URL`

### X (Twitter)

**Stream key format**: Unique per broadcast

**RTMP URL**: Unique per broadcast, includes stream key in path

**Requirements**:
- X Premium subscription ($8/month)
- Desktop streaming enabled
- Create new broadcast for each stream

**Get RTMP URL**:
1. Go to https://studio.twitter.com
2. Click "Producer" → "Create Broadcast"
3. Click "Create Source" → Copy RTMP URL
4. Extract stream key from URL path
5. Set as `X_STREAM_KEY` and `X_RTMP_URL`

**Note**: X RTMP URLs expire after ~24 hours. You'll need to create a new broadcast for each stream session.

## Streaming Timing

### Canonical Platform

The `STREAMING_CANONICAL_PLATFORM` determines anti-cheat timing:

```bash
STREAMING_CANONICAL_PLATFORM=twitch  # or youtube, hls
```

**Default delays by platform**:
- `youtube`: 15000ms (15 seconds)
- `twitch`: 12000ms (12 seconds)
- `hls`: 4000ms (4 seconds)

### Public Delay Override

Override the default delay for all platforms:

```bash
STREAMING_PUBLIC_DELAY_MS=0  # No delay (live betting)
```

**Use cases**:
- `0`: Live betting (no delay)
- `5000`: 5-second delay for moderation
- `15000`: 15-second delay for anti-cheat

**Impact**:
- Delays all public streaming/arena API state
- Prevents betting on future outcomes
- Aligns with external platform latency

## Testing Locally

### Test RTMP Server

Use nginx-rtmp for local testing:

```bash
# Start nginx-rtmp container
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure test destination
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# Start streaming
bun run stream:test

# View stream
ffplay rtmp://localhost:1935/live/test
```

### Test Stream Health

```bash
# Check FFmpeg process
ps aux | grep ffmpeg

# View FFmpeg logs
pm2 logs hyperscape-duel | grep ffmpeg

# Test RTMP connection
ffprobe rtmp://localhost:1935/live/test
```

## Troubleshooting

### Stream not appearing on platform

**Symptoms**:
- Stream key accepted but no video
- "Offline" status on platform
- No errors in logs

**Causes**:
1. Incorrect stream key
2. Expired X RTMP URL
3. FFmpeg not running
4. Network/firewall blocking RTMP

**Fix**:
```bash
# 1. Verify stream keys
echo $TWITCH_STREAM_KEY
echo $KICK_STREAM_KEY
echo $X_STREAM_KEY

# 2. Check FFmpeg process
ps aux | grep ffmpeg

# 3. Test RTMP connection
telnet live.twitch.tv 1935
telnet sg.pscp.tv 80

# 4. View FFmpeg logs
pm2 logs hyperscape-duel --lines 100 | grep ffmpeg
```

### Stream stuttering/buffering

**Symptoms**:
- Choppy playback
- Frequent buffering
- Low quality

**Causes**:
1. Insufficient upload bandwidth
2. CPU/GPU overload
3. Network congestion

**Fix**:
```bash
# 1. Check bandwidth
speedtest-cli

# 2. Monitor CPU/GPU
htop
nvidia-smi

# 3. Reduce resolution
STREAM_CAPTURE_WIDTH=854
STREAM_CAPTURE_HEIGHT=480

# 4. Reduce frame rate (requires code change)
```

### FFmpeg errors

**Common errors**:

**"Connection refused"**:
```
[rtmp @ 0x...] Connection to tcp://live.twitch.tv:1935 failed
```
- Check network connectivity
- Verify RTMP URL is correct
- Check firewall rules

**"Invalid stream key"**:
```
[rtmp @ 0x...] Server error: Invalid stream key
```
- Verify stream key is correct
- Check for extra whitespace
- Regenerate stream key on platform

**"Encoder overloaded"**:
```
[h264 @ 0x...] Encoder buffer too small
```
- Reduce resolution
- Reduce frame rate
- Upgrade GPU

### Platform-specific issues

**Twitch**:
- Stream key must start with `live_`
- Maximum bitrate: 6000 kbps
- Maximum resolution: 1080p @ 60fps

**Kick**:
- Must use RTMPS (not RTMP)
- Stream key format: `sk_<region>_...`
- Check Creator Dashboard for server status

**X**:
- RTMP URL expires after ~24 hours
- Requires X Premium subscription
- Create new broadcast for each session
- Regional servers may have different latency

## Advanced Configuration

### Custom Destinations

Add custom RTMP destinations via JSON:

```bash
RTMP_DESTINATIONS_JSON='[
  {
    "name": "Custom Server",
    "url": "rtmp://your-server.com/live",
    "key": "your-stream-key",
    "enabled": true
  }
]'
```

### HLS Output

Enable local HLS output for website embedding:

```bash
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2
HLS_LIST_SIZE=24
HLS_DELETE_THRESHOLD=96
HLS_FLAGS=delete_segments+append_list+independent_segments
```

**Access HLS stream**:
```html
<video controls>
  <source src="https://your-server.com/live/stream.m3u8" type="application/x-mpegURL">
</video>
```

### RTMP Multiplexer

Use a multiplexer service (Restream, Livepeer) to fan out to multiple platforms:

```bash
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-restream-key
```

**Benefits**:
- Single RTMP connection from server
- Multiplexer handles fanout
- Easier to add/remove platforms
- Better reliability

## Monitoring

### Stream Health

The duel stack monitors stream health automatically:

```bash
# Recovery settings
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000  # 30 seconds
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6    # 6 consecutive failures
```

**Behavior**:
- Detects stream failures (no frames, FFmpeg crash)
- Attempts soft recovery (restart capture)
- Hard restart after max failures exceeded
- PM2 restarts entire stack on critical failure

### Platform Dashboards

Monitor stream health on each platform:
- **Twitch**: https://dashboard.twitch.tv/stream-manager
- **Kick**: Kick Creator Dashboard
- **X**: https://studio.twitter.com

**Metrics to watch**:
- Viewer count
- Bitrate stability
- Frame drops
- Buffering ratio

### FFmpeg Logs

```bash
# View FFmpeg output
pm2 logs hyperscape-duel | grep ffmpeg

# Common log patterns
# [rtmp @ ...] Handshake successful
# [h264 @ ...] Encoding frame
# [rtmp @ ...] Connection closed
```

## Performance Optimization

### Bandwidth Requirements

**Per platform** (720p @ 30fps, 3000 kbps):
- Twitch: 3000 kbps
- Kick: 3000 kbps
- X: 3000 kbps
- **Total**: ~9000 kbps (9 Mbps upload)

**Recommendations**:
- 15+ Mbps upload for stable streaming
- 25+ Mbps for 1080p streaming
- Use wired connection (not WiFi)

### CPU/GPU Usage

**CPU** (FFmpeg encoding):
- 720p @ 30fps: ~20-30% of modern CPU
- 1080p @ 30fps: ~40-50% of modern CPU

**GPU** (WebGPU rendering):
- 720p @ 30fps: ~30-40% of RTX 3060
- 1080p @ 30fps: ~50-60% of RTX 3060

**Optimization**:
- Use hardware encoding (NVENC, QuickSync)
- Reduce resolution if CPU/GPU overloaded
- Close unnecessary processes

## Security

### Stream Key Protection

**Never commit stream keys to git**:
- Use environment variables
- Use GitHub Secrets for CI/CD
- Rotate keys regularly

**If stream key is leaked**:
1. Regenerate key on platform immediately
2. Update GitHub Secret
3. Redeploy to Vast.ai

### RTMPS vs RTMP

**RTMPS** (RTMP over TLS):
- Encrypted connection
- Prevents stream key interception
- Required by Kick

**RTMP** (plain):
- Unencrypted connection
- Stream key visible in network traffic
- Used by Twitch, X

**Recommendation**: Use RTMPS when available.

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai deployment with streaming
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [packages/server/.env.example](../packages/server/.env.example) - Full environment variable reference
- [packages/server/src/streaming/](../packages/server/src/streaming/) - Streaming implementation
