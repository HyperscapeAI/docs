# Streaming Configuration Guide

Hyperscape supports multi-platform RTMP streaming to Twitch, Kick, and X (Twitter) simultaneously using FFmpeg's tee muxer for efficient single-encode multi-output.

## Overview

**Streaming Stack:**
- **Capture**: Headless Chrome with WebGPU + Vulkan
- **Encode**: FFmpeg with H.264 + AAC
- **Output**: RTMP to multiple platforms (Twitch, Kick, X)
- **Anti-cheat**: Configurable public data delay (0-15s)

**Supported Platforms:**
- ✅ Twitch (primary, 12s default delay)
- ✅ Kick (RTMPS)
- ✅ X/Twitter (RTMP)
- ❌ YouTube (removed, not needed)

## Quick Start

### 1. Get Stream Keys

**Twitch:**
1. Go to [dashboard.twitch.tv/settings/stream](https://dashboard.twitch.tv/settings/stream)
2. Copy your **Primary Stream Key**
3. Format: `live_123456789_abcdefghij`

**Kick:**
1. Go to Kick Creator Dashboard → Stream Settings
2. Copy **Stream Key** and **Server URL**
3. Format: `sk_us-west-2_...` (key) and `rtmps://...` (URL)

**X/Twitter:**
1. Go to Media Studio → Producer → Create Broadcast → Create Source
2. Copy **RTMP URL** and **Stream Key**
3. Requires X Premium subscription

### 2. Configure Environment Variables

Add to `packages/server/.env` or `ecosystem.config.cjs`:

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij

# Kick (uses RTMPS)
KICK_STREAM_KEY=sk_us-west-2_OrgZh8XyN0Qs_DKZE46VeaiqkczE5ZMTx63ct25wZ7q
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net

# X/Twitter
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Anti-cheat timing
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0  # 0 for live betting, 12000 for Twitch delay
```

### 3. Start Streaming

```bash
# Production (PM2)
bunx pm2 start ecosystem.config.cjs

# Development
bun run dev:all
```

## Platform Configuration

### Twitch

**Default Settings:**
- **Server**: `rtmp://live.twitch.tv/app`
- **Delay**: 12 seconds (configurable)
- **Resolution**: 1280x720 @ 30fps
- **Bitrate**: 2500 kbps

**Environment Variables:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app  # Optional, uses default
```

**Ingest Servers:**
- Primary: `rtmp://live.twitch.tv/app`
- Backup: `rtmp://live-sjc.twitch.tv/app` (San Jose)
- Backup: `rtmp://live-lax.twitch.tv/app` (Los Angeles)

### Kick

**Default Settings:**
- **Server**: `rtmps://fa723fc1b171.global-contribute.live-video.net`
- **Protocol**: RTMPS (secure RTMP)
- **Resolution**: 1280x720 @ 30fps
- **Bitrate**: 2500 kbps

**Environment Variables:**
```bash
KICK_STREAM_KEY=sk_us-west-2_OrgZh8XyN0Qs_DKZE46VeaiqkczE5ZMTx63ct25wZ7q
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net
```

**Note**: Kick uses RTMPS (port 443) instead of RTMP (port 1935).

### X (Twitter)

**Default Settings:**
- **Server**: `rtmp://sg.pscp.tv:80/x`
- **Region**: Singapore (sg) or US (va)
- **Resolution**: 1280x720 @ 30fps
- **Bitrate**: 2500 kbps

**Environment Variables:**
```bash
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

**Requirements**:
- X Premium subscription
- Desktop streaming enabled in Media Studio

**Alternative Servers:**
- US East: `rtmp://va.pscp.tv:80/x`
- Singapore: `rtmp://sg.pscp.tv:80/x`

## Anti-Cheat Configuration

### Public Data Delay

To prevent stream sniping in betting markets, Hyperscape delays public data broadcast.

**Canonical Platform Defaults:**
```bash
# YouTube (removed)
STREAMING_CANONICAL_PLATFORM=youtube
STREAMING_PUBLIC_DELAY_MS=15000  # 15 seconds

# Twitch (current default)
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=12000  # 12 seconds

# HLS (local)
STREAMING_CANONICAL_PLATFORM=hls
STREAMING_PUBLIC_DELAY_MS=4000   # 4 seconds
```

**Override Delay:**
```bash
# Set to 0 for live betting (no delay)
STREAMING_PUBLIC_DELAY_MS=0

# Or custom delay
STREAMING_PUBLIC_DELAY_MS=8000  # 8 seconds
```

**What Gets Delayed:**
- `/api/streaming/state` endpoint
- `/api/streaming/state/events` SSE feed
- `/api/arena/*` betting endpoints

**What's NOT Delayed:**
- Trusted viewers with `STREAMING_VIEWER_ACCESS_TOKEN`
- Loopback connections (localhost)
- Internal game server communication

## Stream Capture Settings

### Resolution & Quality

```bash
# Resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Frame rate (30fps recommended for stability)
# Controlled by FFmpeg encoder settings
```

### Capture Mode

```bash
# CDP mode (recommended for reliability)
STREAM_CAPTURE_MODE=cdp

# Recovery settings
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6
```

### Browser Configuration

```bash
# Use Chrome Dev channel (WebGPU support)
STREAM_CAPTURE_CHANNEL=chrome-dev

# Use Vulkan ANGLE backend (GPU rendering)
STREAM_CAPTURE_ANGLE=vulkan

# Run headful with Xvfb (GPU access)
STREAM_CAPTURE_HEADLESS=false
DUEL_CAPTURE_USE_XVFB=true

# Enable WebGPU (required for TSL shaders)
STREAM_CAPTURE_DISABLE_WEBGPU=false
```

## FFmpeg Configuration

### Encoder Settings

**Video:**
- Codec: H.264 (libx264)
- Preset: veryfast
- Bitrate: 2500 kbps
- Keyframe interval: 2 seconds
- Profile: main
- Level: 4.0

**Audio:**
- Codec: AAC
- Bitrate: 128 kbps
- Sample rate: 44100 Hz
- Channels: 2 (stereo)

### Tee Muxer

FFmpeg uses the tee muxer to send one stream to multiple destinations:

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset veryfast -b:v 2500k \
  -c:a aac -b:a 128k \
  -f tee \
  "[f=flv]rtmp://live.twitch.tv/app/live_123|[f=flv]rtmps://kick.com/live/sk_456|[f=flv]rtmp://sg.pscp.tv:80/x/sp789"
```

**Benefits:**
- Single encode (efficient)
- Multiple outputs (parallel)
- Independent failure handling

## Custom Destinations

### Add Custom RTMP Server

```bash
# In packages/server/.env
CUSTOM_RTMP_NAME=MyPlatform
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key
```

### JSON Fanout Config

For advanced multi-destination setups:

```bash
RTMP_DESTINATIONS_JSON='[
  {
    "name": "MyMux",
    "url": "rtmp://host/live",
    "key": "stream-key",
    "enabled": true
  }
]'
```

### RTMP Multiplexer

Use a multiplexer service (Restream, Livepeer) to fan out to many platforms:

```bash
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-restream-key
```

## Local HLS Output

For local testing or website embedding:

```bash
# Enable HLS output
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts

# HLS settings
HLS_TIME_SECONDS=2           # Segment duration
HLS_LIST_SIZE=24             # Playlist depth
HLS_DELETE_THRESHOLD=96      # Delete old segments
HLS_START_NUMBER=1700000000  # Avoid wraparound
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

**Access HLS Stream:**
```bash
# Local
http://localhost:5555/live/stream.m3u8

# Production
https://your-server.com/live/stream.m3u8
```

## Monitoring

### Check Stream Status

```bash
# Streaming state API
curl http://localhost:5555/api/streaming/state | jq

# Expected response
{
  "cycle": {
    "phase": "FIGHTING",
    "agent1": { "name": "AgentA", "hp": 85 },
    "agent2": { "name": "AgentB", "hp": 72 }
  }
}
```

### View FFmpeg Logs

```bash
# PM2 logs
bunx pm2 logs hyperscape-duel | grep -i ffmpeg

# Look for:
# - "Stream #0:0: Video: h264"
# - "Stream #0:1: Audio: aac"
# - "Opening 'rtmp://...' for writing"
```

### Test RTMP Locally

```bash
# Start nginx-rtmp test server
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure test destination
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# View test stream
ffplay rtmp://localhost:1935/live/test
```

## Troubleshooting

### Stream Not Appearing on Platform

**Symptom**: FFmpeg reports success but stream doesn't show on Twitch/Kick/X

**Solutions**:
1. **Verify stream key**: Check for typos, expired keys
2. **Check platform status**: Platform may be down
3. **Test with OBS**: Use same key in OBS to isolate issue
4. **Check bitrate**: Some platforms reject streams >6000 kbps

```bash
# Test stream key with ffmpeg
ffmpeg -re -i test.mp4 \
  -c:v libx264 -preset veryfast -b:v 2500k \
  -c:a aac -b:a 128k \
  -f flv rtmp://live.twitch.tv/app/your-key
```

### FFmpeg Crashes or Restarts

**Symptom**: Stream drops, FFmpeg process dies

**Solutions**:
```bash
# Check FFmpeg logs
bunx pm2 logs hyperscape-duel | grep -i ffmpeg

# Common errors:
# - "Connection refused" → Platform down or wrong URL
# - "Invalid stream key" → Wrong key or expired
# - "Broken pipe" → Network issue

# Increase restart attempts
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=10  # was 6
```

### High CPU Usage

**Symptom**: Server CPU at 100%, stream stutters

**Solutions**:
```bash
# Use faster preset
# In FFmpeg encoder: -preset ultrafast

# Reduce resolution
STREAM_CAPTURE_WIDTH=960
STREAM_CAPTURE_HEIGHT=540

# Reduce bitrate
# In FFmpeg encoder: -b:v 1500k
```

### Audio Out of Sync

**Symptom**: Audio lags behind video

**Solutions**:
```bash
# Add audio offset in FFmpeg
-itsoffset 0.5  # 500ms delay

# Or adjust capture timing
STREAM_CAPTURE_AUDIO_OFFSET_MS=500
```

## Advanced Configuration

### Custom FFmpeg Flags

Edit `packages/server/src/streaming/rtmp-bridge.ts` to customize FFmpeg:

```typescript
const ffmpegArgs = [
  '-f', 'rawvideo',
  '-pix_fmt', 'rgb24',
  '-s', `${width}x${height}`,
  '-r', '30',
  '-i', '-',
  '-c:v', 'libx264',
  '-preset', 'veryfast',  // Change to 'ultrafast' for lower CPU
  '-b:v', '2500k',        // Change bitrate
  '-maxrate', '2500k',
  '-bufsize', '5000k',
  '-pix_fmt', 'yuv420p',
  '-g', '60',             // Keyframe interval
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '44100',
  '-f', 'tee',
  teeOutput
];
```

### Streaming to Multiple Regions

For global audience, stream to regional ingest servers:

```bash
# Twitch US West
TWITCH_RTMP_URL=rtmp://live-lax.twitch.tv/app

# Twitch EU
TWITCH_RTMP_URL=rtmp://live-fra.twitch.tv/app

# Twitch Asia
TWITCH_RTMP_URL=rtmp://live-sin.twitch.tv/app
```

### Adaptive Bitrate

For unstable connections, use adaptive bitrate:

```bash
# Lower bitrate for reliability
-b:v 1500k -maxrate 1800k -bufsize 3000k

# Or use CBR (constant bitrate)
-b:v 2500k -minrate 2500k -maxrate 2500k -bufsize 2500k
```

## SSE Fanout Configuration

The streaming state is broadcast to spectators via Server-Sent Events (SSE).

### Tuning Parameters

```bash
# Replay buffer for resume support
STREAMING_SSE_REPLAY_BUFFER=2048

# Max replay payload bytes (oldest frames trimmed first)
STREAMING_SSE_REPLAY_MAX_BYTES=33554432  # 32MB

# Push cadence for live state fanout
STREAMING_SSE_PUSH_INTERVAL_MS=500

# Keepalive heartbeat cadence
STREAMING_SSE_HEARTBEAT_MS=15000

# Per-client pending bytes threshold (drop slow consumers)
STREAMING_SSE_MAX_PENDING_BYTES=1048576  # 1MB
```

### SSE Endpoints

**Live State Stream:**
```bash
# Connect to SSE feed
curl -N http://localhost:5555/api/streaming/state/events

# With resume support
curl -N http://localhost:5555/api/streaming/state/events?lastEventId=12345
```

**Snapshot:**
```bash
# Get current state (no streaming)
curl http://localhost:5555/api/streaming/state
```

## Performance Optimization

### Reduce Stream Latency

```bash
# Set public delay to 0
STREAMING_PUBLIC_DELAY_MS=0

# Use HLS with short segments
HLS_TIME_SECONDS=1
HLS_LIST_SIZE=6

# Use faster FFmpeg preset
-preset ultrafast
```

### Reduce CPU Usage

```bash
# Lower resolution
STREAM_CAPTURE_WIDTH=960
STREAM_CAPTURE_HEIGHT=540

# Lower frame rate
-r 24  # 24fps instead of 30fps

# Faster preset
-preset ultrafast

# Lower bitrate
-b:v 1500k
```

### Reduce Memory Usage

```bash
# Limit SSE replay buffer
STREAMING_SSE_REPLAY_BUFFER=512
STREAMING_SSE_REPLAY_MAX_BYTES=8388608  # 8MB

# Reduce HLS playlist size
HLS_LIST_SIZE=12
HLS_DELETE_THRESHOLD=48
```

## Testing

### Local RTMP Server

```bash
# Start nginx-rtmp
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure Hyperscape
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# View stream
ffplay rtmp://localhost:1935/live/test
```

### Stream Health Check

```bash
# Check if stream is live
curl http://localhost:5555/api/streaming/state

# Check FFmpeg process
ps aux | grep ffmpeg

# Check network
netstat -an | grep 1935  # RTMP port
```

## See Also

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai GPU streaming setup
- [packages/server/.env.example](../packages/server/.env.example) - Full environment variable reference
- [packages/server/src/streaming/](../packages/server/src/streaming/) - Streaming implementation
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 streaming configuration
