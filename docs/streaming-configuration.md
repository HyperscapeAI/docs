# Streaming Configuration Guide

This guide covers RTMP streaming configuration for broadcasting Hyperscape gameplay to multiple platforms simultaneously (Twitch, Kick, X/Twitter, YouTube, custom destinations).

## Overview

Hyperscape supports multi-platform RTMP streaming using FFmpeg's tee muxer for efficient single-encode multi-output. The streaming system captures gameplay via headless browser (Puppeteer + Chrome DevTools Protocol) and broadcasts to configured RTMP destinations.

## Quick Start

### Prerequisites

1. **FFmpeg** installed:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Linux
   apt install ffmpeg
   
   # Verify installation
   ffmpeg -version
   ```

2. **Stream Keys** from your platforms:
   - Twitch: https://dashboard.twitch.tv/settings/stream
   - Kick: Creator Dashboard → Stream Settings
   - X/Twitter: Media Studio → Producer → Create Broadcast
   - YouTube: https://studio.youtube.com → Go Live → Stream

### Basic Configuration

1. Copy environment file:
   ```bash
   cp packages/server/.env.example packages/server/.env
   ```

2. Add stream keys to `packages/server/.env`:
   ```bash
   # Twitch
   TWITCH_STREAM_KEY=live_123456789_abcdefghij
   TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
   
   # Kick
   KICK_STREAM_KEY=your-kick-stream-key
   KICK_RTMP_URL=rtmp://ingest.kick.com/live
   
   # X/Twitter
   X_STREAM_KEY=your-x-stream-key
   X_RTMP_URL=rtmp://x-media-studio/your-path
   ```

3. Start streaming:
   ```bash
   bun run stream:rtmp
   ```

## Platform Configuration

### Twitch

**Get Stream Key:**
1. Go to https://dashboard.twitch.tv/settings/stream
2. Copy "Primary Stream Key"

**Configuration:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
```

**Ingest Servers** (optional - for lower latency):
- US West: `rtmp://live-sjc.twitch.tv/app`
- US East: `rtmp://live-iad.twitch.tv/app`
- EU: `rtmp://live-fra.twitch.tv/app`
- Asia: `rtmp://live-sin.twitch.tv/app`

**Recommended Settings:**
- Resolution: 1920x1080 (1080p)
- Frame Rate: 30 FPS
- Bitrate: 2500 kbps
- Keyframe Interval: 2 seconds

### Kick

**Get Stream Key:**
1. Go to Kick Creator Dashboard
2. Navigate to Stream Settings
3. Copy "Stream Key"

**Configuration:**
```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
```

**Note**: Kick uses RTMPS (RTMP over TLS) for secure streaming. The URL format is:
```bash
# Standard RTMP
KICK_RTMP_URL=rtmp://ingest.kick.com/live

# Secure RTMPS (recommended)
KICK_RTMP_URL=rtmps://ingest.kick.com:443/live
```

**Recommended Settings:**
- Resolution: 1920x1080 (1080p)
- Frame Rate: 30 FPS
- Bitrate: 3000 kbps
- Keyframe Interval: 2 seconds

### X/Twitter

**Requirements:**
- X Premium subscription (required for desktop streaming)
- Media Studio access

**Get Stream Key:**
1. Go to https://studio.twitter.com
2. Click "Producer" → "Create Broadcast"
3. Click "Create Source"
4. Copy RTMP URL and Stream Key

**Configuration:**
```bash
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path
```

**Recommended Settings:**
- Resolution: 1280x720 (720p) - X has lower bitrate limits
- Frame Rate: 30 FPS
- Bitrate: 2000 kbps
- Keyframe Interval: 2 seconds

**Note**: X/Twitter streaming is currently limited to ~5% of users (as of February 2026). Check your account eligibility before configuring.

### YouTube

**Get Stream Key:**
1. Go to https://studio.youtube.com
2. Click "Go Live" → "Stream"
3. Copy "Stream Key"

**Configuration:**
```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

**Ingest Servers** (optional):
- Primary: `rtmp://a.rtmp.youtube.com/live2`
- Backup: `rtmp://b.rtmp.youtube.com/live2`

**Recommended Settings:**
- Resolution: 1920x1080 (1080p)
- Frame Rate: 30 FPS
- Bitrate: 3000-4500 kbps
- Keyframe Interval: 2 seconds

**Note**: YouTube was removed from default configuration (February 2026) but can be re-added via environment variables.

### Custom RTMP Destination

**Configuration:**
```bash
CUSTOM_RTMP_NAME=My Custom Server
CUSTOM_RTMP_URL=rtmp://your-server.com/live
CUSTOM_STREAM_KEY=your-stream-key
```

**Use Cases:**
- Self-hosted nginx-rtmp server
- Private streaming infrastructure
- Custom CDN endpoints
- Testing and development

### RTMP Multiplexer (Restream/Livepeer)

Instead of configuring each platform individually, use a multiplexer service:

**Configuration:**
```bash
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-restream-key
```

**Benefits:**
- Single stream to multiplexer
- Multiplexer fans out to all platforms
- Reduced server bandwidth
- Centralized platform management

**Supported Services:**
- Restream.io
- Livepeer
- Custom fanout servers

### JSON Fanout Configuration

For advanced multi-destination setups, use JSON configuration:

```bash
RTMP_DESTINATIONS_JSON='[
  {
    "name": "Twitch",
    "url": "rtmp://live.twitch.tv/app",
    "key": "live_123456789_abcdefghij",
    "enabled": true
  },
  {
    "name": "Kick",
    "url": "rtmp://ingest.kick.com/live",
    "key": "your-kick-key",
    "enabled": true
  },
  {
    "name": "YouTube",
    "url": "rtmp://a.rtmp.youtube.com/live2",
    "key": "xxxx-xxxx-xxxx-xxxx",
    "enabled": false
  }
]'
```

**Format:**
- `name`: Display name for logging
- `url`: RTMP server URL
- `key`: Stream key
- `enabled`: Toggle destination on/off

## Streaming Delay & Anti-Cheat

### Canonical Platform

Set the canonical platform for default delay calculation:

```bash
STREAMING_CANONICAL_PLATFORM=twitch  # Options: youtube | twitch | hls
```

**Default Delays:**
- `youtube`: 15000ms (15 seconds)
- `twitch`: 12000ms (12 seconds)
- `hls`: 4000ms (4 seconds)

**February 2026 Update**: Default delay set to **0ms** for instant broadcast. Configure delays only if you need anti-cheat timing alignment with external platform latency.

### Custom Delay

Override the default delay:

```bash
STREAMING_PUBLIC_DELAY_MS=0  # Instant broadcast (no delay)
# or
STREAMING_PUBLIC_DELAY_MS=12000  # 12 second delay
```

**Use Cases:**
- **0ms**: Instant broadcast for maximum engagement
- **12000ms**: Match Twitch latency for anti-cheat timing
- **15000ms**: Match YouTube latency for anti-cheat timing

### Viewer Access Control

When using delayed public mode, configure access token for trusted viewers:

```bash
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

**Access Levels:**
- **Public**: Delayed stream (respects `STREAMING_PUBLIC_DELAY_MS`)
- **Trusted**: Instant stream (requires access token)
- **Loopback**: Always instant (localhost connections)

## Stability Configuration

### CDP (Chrome DevTools Protocol) Settings

```bash
# Stall threshold (intervals before restart)
# Each interval is 30 seconds, so 4 = 120 seconds total
CDP_STALL_THRESHOLD=6  # Default: 4 (increased February 2026)
```

**Behavior:**
- Monitors CDP connection for stalls
- Restarts screencast if stalled for threshold duration
- **Soft recovery** (February 2026): Restarts screencast without browser/FFmpeg teardown (no stream gap)

### FFmpeg Settings

```bash
# Maximum restart attempts before giving up
FFMPEG_MAX_RESTART_ATTEMPTS=10  # Default: 8 (increased February 2026)

# Recovery failure threshold before full restart
CAPTURE_RECOVERY_MAX_FAILURES=5  # Default: 4 (increased February 2026)
```

**Behavior:**
- FFmpeg automatically restarts on crashes
- Soft recovery attempted first (no stream gap)
- Full restart if soft recovery fails repeatedly
- Gives up after max attempts (requires manual intervention)

### WebGPU Renderer Settings

**Best-Effort Limits** (February 2026):
- Tries `maxTextureArrayLayers: 2048` first
- Retries with default limits if GPU rejects
- Always WebGPU, never WebGL (no fallback)

**Configuration**: Automatic - no environment variables needed

## HLS Output (Optional)

For local HLS output (useful for website video embed or betting interface):

```bash
# Output path
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8

# Segment pattern (use wide numeric pattern to avoid wraparound)
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts

# Segment duration (seconds)
HLS_TIME_SECONDS=2

# Playlist size (number of segments)
HLS_LIST_SIZE=24

# Delete threshold (segments to keep)
HLS_DELETE_THRESHOLD=96

# Start number (avoid cache collisions)
HLS_START_NUMBER=1700000000

# HLS flags
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

**Use Cases:**
- Embed stream on website
- Betting interface video player
- Local playback and testing
- CDN distribution

## Testing

### Local RTMP Server

Test streaming without external platforms:

```bash
# Start nginx-rtmp server
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure custom destination
CUSTOM_RTMP_NAME=Local Test
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# Start streaming
bun run stream:test

# View stream
ffplay rtmp://localhost:1935/live/test
```

### Stream Health Check

```bash
# Check streaming status
curl http://localhost:5555/api/streaming/state

# Check FFmpeg process
ps aux | grep ffmpeg

# Check PM2 status (production)
pm2 status
pm2 logs ffmpeg
```

## Monitoring

### Key Metrics

**Stream Health:**
- Uptime (target: > 99%)
- Frame rate (target: 30 FPS)
- Bitrate (target: 2500 kbps)
- Dropped frames (target: < 1%)

**System Health:**
- CPU usage (target: < 80%)
- Memory usage (target: < 4GB)
- FFmpeg restarts (target: < 3 per hour)
- CDP stalls (target: < 1 per hour)

### Logs

**FFmpeg Output:**
```bash
# PM2 logs
pm2 logs ffmpeg

# Direct logs
tail -f packages/server/logs/ffmpeg.log
```

**Browser Capture:**
```bash
pm2 logs capture
tail -f packages/server/logs/capture.log
```

**RTMP Bridge:**
```bash
pm2 logs rtmp-bridge
tail -f packages/server/logs/rtmp-bridge.log
```

## Troubleshooting

### Stream Keeps Restarting

**Symptom**: FFmpeg restarts every 1-2 minutes.

**Cause**: CDP stall threshold too aggressive or network issues.

**Solution**:
```bash
# Increase stability thresholds
CDP_STALL_THRESHOLD=6                    # Default: 4
FFMPEG_MAX_RESTART_ATTEMPTS=10           # Default: 8
CAPTURE_RECOVERY_MAX_FAILURES=5          # Default: 4
```

### Stream Not Appearing on Platform

**Symptom**: Stream starts but doesn't appear on Twitch/Kick/etc.

**Cause**: Invalid stream key or RTMP URL.

**Solution**:
1. Verify stream key is correct (copy-paste from platform)
2. Check RTMP URL format (no trailing slashes)
3. Test with ffplay: `ffplay rtmp://platform-url/app/stream-key`
4. Check platform dashboard for stream status

### Low Frame Rate

**Symptom**: Stream shows < 30 FPS.

**Cause**: CPU overload or GPU rendering issues.

**Solution**:
1. Check CPU usage: `top` or `htop`
2. Reduce game complexity (fewer NPCs, lower graphics settings)
3. Increase server resources (more CPU cores)
4. Check WebGPU renderer initialization (see logs)

### High Bitrate / Buffering

**Symptom**: Stream buffers frequently for viewers.

**Cause**: Bitrate too high for platform or network.

**Solution**:
1. Reduce bitrate in FFmpeg settings (default: 2500 kbps)
2. Check platform bitrate limits:
   - Twitch: 6000 kbps max
   - Kick: 8000 kbps max
   - X/Twitter: 2000 kbps max
   - YouTube: 9000 kbps max
3. Test network upload speed: `speedtest-cli`

### WebGPU Initialization Failures

**Symptom**: "WebGPU is not supported" in headless browser.

**Cause**: WebGPU unavailable in Docker/vast.ai environments.

**Solution** (February 2026 improvements):
- **Best-effort limits**: Renderer tries `maxTextureArrayLayers: 2048`, retries with defaults if GPU rejects
- **Swiftshader backend**: Use software rendering (set in ecosystem.config.cjs)
- **Vulkan drivers**: Install on Vast.ai instances (see `scripts/deploy-vast.sh`)

**Verify WebGPU:**
```bash
# Check Chrome flags
google-chrome --headless --enable-features=Vulkan,UseSkiaRenderer --use-angle=vulkan

# Check GPU info
google-chrome --headless --print-to-pdf=test.pdf https://webgpureport.org
```

## Advanced Configuration

### Streaming SSE (Server-Sent Events)

Configure SSE fanout for betting interface and spectators:

```bash
# Replay buffer capacity (frames)
STREAMING_SSE_REPLAY_BUFFER=2048

# Replay payload bytes cap
STREAMING_SSE_REPLAY_MAX_BYTES=33554432  # 32 MB

# Push interval (milliseconds)
STREAMING_SSE_PUSH_INTERVAL_MS=500

# Heartbeat interval (milliseconds)
STREAMING_SSE_HEARTBEAT_MS=15000

# Max pending bytes per client
STREAMING_SSE_MAX_PENDING_BYTES=1048576  # 1 MB
```

**Use Cases:**
- Real-time duel updates for betting interface
- Spectator mode with live stats
- Agent HP bars and combat stats
- Phase transitions and market status

### RTMP Bridge Settings

```bash
# Bridge port (internal)
RTMP_BRIDGE_PORT=8765

# Game URL for capture
GAME_URL=http://localhost:3333/?page=stream
```

**Architecture:**
1. Browser capture → CDP → FFmpeg
2. FFmpeg → RTMP bridge → Platform destinations
3. SSE fanout → Betting interface / spectators

### Solana RPC Proxy

Configure RPC proxy for betting interface:

```bash
# Cache settings
RPC_PROXY_CACHE_MAX_ENTRIES=512
RPC_PROXY_CACHE_MAX_TOTAL_BYTES=67108864  # 64 MB
RPC_PROXY_CACHE_MAX_ENTRY_BYTES=262144    # 256 KB

# Timeout settings
RPC_PROXY_REQUEST_TIMEOUT_MS=15000

# WebSocket settings
WS_PROXY_MAX_PENDING_OPEN_MESSAGES=64
```

**Purpose**: Reduces RPC load by caching responses and proxying WebSocket connections.

## Production Deployment

### Environment Variables

**Required:**
```bash
# At least one streaming destination
TWITCH_STREAM_KEY=...
TWITCH_RTMP_URL=...

# Or use multiplexer
RTMP_MULTIPLEXER_URL=...
RTMP_MULTIPLEXER_STREAM_KEY=...
```

**Recommended:**
```bash
# Stability settings
CDP_STALL_THRESHOLD=6
FFMPEG_MAX_RESTART_ATTEMPTS=10
CAPTURE_RECOVERY_MAX_FAILURES=5

# Platform settings
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0

# Monitoring
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

### PM2 Configuration

The streaming system uses PM2 for process management (see `ecosystem.config.cjs`):

**Processes:**
- `server`: Game server
- `ffmpeg`: FFmpeg encoder
- `capture`: Browser capture
- `rtmp-bridge`: RTMP multiplexer

**Commands:**
```bash
# Start all processes
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs
pm2 logs ffmpeg
pm2 logs capture

# Restart streaming
pm2 restart ffmpeg
pm2 restart capture
```

### Health Monitoring

**Automatic Health Checks** (Vast.ai keeper):
- HTTP `/health` endpoint (every 60 seconds)
- FFmpeg process monitoring
- CDP connection status
- Frame rate tracking

**Manual Checks:**
```bash
# Check stream health
curl http://localhost:5555/api/streaming/state

# Check FFmpeg
ps aux | grep ffmpeg

# Check browser
ps aux | grep chrome
```

## Streaming Commands

### Development

```bash
# Start streaming to configured destinations
bun run stream:rtmp

# Test with local nginx-rtmp
bun run stream:test

# Stream with custom config
TWITCH_STREAM_KEY=... bun run stream:rtmp
```

### Production

```bash
# Start via PM2
pm2 start ecosystem.config.cjs

# Restart streaming only
pm2 restart ffmpeg
pm2 restart capture

# Stop streaming
pm2 stop ffmpeg
pm2 stop capture
```

## Recent Updates (February 2026)

### Streaming Platform Configuration (Commit `7f1b1fd`)
- Added Twitch stream key configuration
- Added Kick stream key with RTMPS URL support
- Added X/Twitter stream key with RTMP URL
- Removed YouTube from default configuration (can be re-added via env vars)
- Set canonical platform to Twitch for anti-cheat timing

### Public Data Delay (Commit `b00aa23`)
- **Default delay set to 0ms** (instant broadcast)
- No delay between game events and public broadcast
- Configure `STREAMING_PUBLIC_DELAY_MS` to add delay if needed

### Stability Improvements (Commit `14a1e1b`)
- **CDP Stall Threshold**: Increased from 2 to 4 intervals (120s total)
- **Soft CDP Recovery**: Restart screencast without browser/FFmpeg teardown (no stream gap)
- **FFmpeg Restart Attempts**: Increased from 5 to 8
- **Recovery Failures**: Increased from 2 to 4
- **Reset Counter**: Added `resetRestartAttempts()` for recovery counter reset

### WebGPU Renderer (Commit `14a1e1b`)
- **Best-Effort Limits**: Tries `maxTextureArrayLayers: 2048` first, retries with defaults if GPU rejects
- **Always WebGPU**: No WebGL fallback (all shaders use TSL)
- **Error Handling**: User-friendly error screen when WebGPU unavailable

## Related Documentation

- **Deployment**: `docs/deployment-best-practices.md`
- **Environment Variables**: `packages/server/.env.example`
- **Duel Stack**: `docs/duel-stack.md`
- **Betting Production**: `docs/betting-production-deploy.md`

## Troubleshooting Reference

| Issue | Solution | Commit |
|-------|----------|--------|
| Stream restarts frequently | Increase `CDP_STALL_THRESHOLD` to 6 | `14a1e1b` |
| WebGPU not available | Install Vulkan drivers, use swiftshader | `14a1e1b` |
| Platform not receiving stream | Verify stream key and RTMP URL | `7f1b1fd` |
| High CPU usage | Reduce game complexity, increase resources | - |
| Buffering for viewers | Reduce bitrate, check network speed | - |

## Implementation Files

- **Streaming System**: `packages/server/src/streaming/`
- **Browser Capture**: `packages/server/src/streaming/browser-capture.ts`
- **RTMP Bridge**: `packages/server/src/streaming/rtmp-bridge.ts`
- **Stream Capture**: `packages/server/src/streaming/stream-capture.ts`
- **PM2 Config**: `ecosystem.config.cjs`
- **Deploy Script**: `scripts/deploy-vast.sh`
