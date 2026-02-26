# Streaming Configuration

Hyperscape supports multi-platform RTMP streaming to Twitch, Kick, X (Twitter), and custom destinations.

## Overview

The streaming system uses:
- **FFmpeg**: Video encoding and RTMP multiplexing
- **Chrome headless**: WebGPU rendering with Xvfb
- **Puppeteer**: Browser automation and capture
- **PM2**: Process management

## Quick Start

### 1. Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

### 2. Configure Stream Keys

Edit `packages/server/.env`:

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

# X/Twitter
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
```

### 3. Start Streaming

```bash
# Production streaming
bun run stream:rtmp

# Local test (requires nginx-rtmp)
bun run stream:test
```

## Streaming Platforms

### Twitch

**Get your stream key:**
1. Go to [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream)
2. Copy "Primary Stream Key"

**Configuration:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
```

**Ingest servers:**
- US West: `rtmp://live-sjc.twitch.tv/app`
- US East: `rtmp://live-iad.twitch.tv/app`
- EU: `rtmp://live-fra.twitch.tv/app`
- Asia: `rtmp://live-sin.twitch.tv/app`

### X (Twitter)

**Get your stream key:**
1. Go to [Media Studio](https://studio.twitter.com)
2. Producer → Create Broadcast → Create Source
3. Copy RTMP URL and Stream Key

**Requirements:**
- X Premium subscription
- Desktop streaming enabled

**Configuration:**
```bash
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path
```

### Kick

**Get your stream key:**
1. Go to [Kick Creator Dashboard](https://kick.com/dashboard/settings/stream)
2. Copy "Stream Key"

**Configuration:**
```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
```

### YouTube

**Get your stream key:**
1. Go to [YouTube Studio](https://studio.youtube.com)
2. Go Live → Stream
3. Copy "Stream key"

**Configuration:**
```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

### Custom RTMP Server

**Configuration:**
```bash
CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key
```

## Stream Quality Settings

### Video Encoding

```bash
# Codec (libx264 recommended)
STREAM_VIDEO_CODEC=libx264

# Bitrate (higher = better quality, more bandwidth)
STREAM_VIDEO_BITRATE=2500k  # 2.5 Mbps

# Preset (faster = lower CPU, lower quality)
# Options: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
STREAM_VIDEO_PRESET=veryfast

# Frame rate
STREAM_VIDEO_FPS=30

# Resolution (set in browser capture)
STREAM_VIDEO_WIDTH=1280
STREAM_VIDEO_HEIGHT=720
```

### Audio Encoding

```bash
# Codec
STREAM_AUDIO_CODEC=aac

# Bitrate
STREAM_AUDIO_BITRATE=128k

# Sample rate
STREAM_AUDIO_SAMPLE_RATE=44100
```

### Quality Presets

**Low (720p30, 1.5 Mbps):**
```bash
STREAM_VIDEO_BITRATE=1500k
STREAM_VIDEO_PRESET=ultrafast
STREAM_VIDEO_FPS=30
STREAM_VIDEO_WIDTH=1280
STREAM_VIDEO_HEIGHT=720
```

**Medium (720p30, 2.5 Mbps):**
```bash
STREAM_VIDEO_BITRATE=2500k
STREAM_VIDEO_PRESET=veryfast
STREAM_VIDEO_FPS=30
STREAM_VIDEO_WIDTH=1280
STREAM_VIDEO_HEIGHT=720
```

**High (1080p30, 4.5 Mbps):**
```bash
STREAM_VIDEO_BITRATE=4500k
STREAM_VIDEO_PRESET=fast
STREAM_VIDEO_FPS=30
STREAM_VIDEO_WIDTH=1920
STREAM_VIDEO_HEIGHT=1080
```

**Ultra (1080p60, 6 Mbps):**
```bash
STREAM_VIDEO_BITRATE=6000k
STREAM_VIDEO_PRESET=medium
STREAM_VIDEO_FPS=60
STREAM_VIDEO_WIDTH=1920
STREAM_VIDEO_HEIGHT=1080
```

## Streaming Delay

For betting fairness, configure public streaming delay:

```bash
# Canonical platform (youtube, twitch, or hls)
STREAMING_CANONICAL_PLATFORM=twitch

# Override default delay (ms)
# Default: youtube=15000, twitch=12000, hls=4000
STREAMING_PUBLIC_DELAY_MS=0  # Set to 0 for live betting
```

**Default delays:**
- YouTube: 15 seconds (15000ms)
- Twitch: 12 seconds (12000ms)
- HLS: 4 seconds (4000ms)

**Custom delay:**
```bash
# 5 second delay
STREAMING_PUBLIC_DELAY_MS=5000

# No delay (live)
STREAMING_PUBLIC_DELAY_MS=0
```

## Multi-Platform Streaming

Stream to multiple platforms simultaneously using FFmpeg tee muxer:

```bash
# Enable all platforms
TWITCH_STREAM_KEY=your-twitch-key
X_STREAM_KEY=your-x-key
KICK_STREAM_KEY=your-kick-key
YOUTUBE_STREAM_KEY=your-youtube-key
```

FFmpeg automatically detects configured platforms and streams to all of them.

## Local Testing

### Setup nginx-rtmp

```bash
# Start nginx-rtmp container
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure test stream
CUSTOM_RTMP_URL=rtmp://localhost:1935/live
CUSTOM_STREAM_KEY=test

# Start streaming
bun run stream:test
```

### View Test Stream

```bash
# Using ffplay
ffplay rtmp://localhost:1935/live/test

# Using VLC
vlc rtmp://localhost:1935/live/test

# Using OBS
# Add Media Source → Network Stream
# URL: rtmp://localhost:1935/live/test
```

## HLS Output

Generate HLS playlist for web playback:

```bash
# Enable HLS output
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts

# HLS settings
HLS_TIME_SECONDS=2              # Segment duration
HLS_LIST_SIZE=24                # Playlist size
HLS_DELETE_THRESHOLD=96         # Delete old segments
HLS_START_NUMBER=1700000000     # Starting segment number
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

**Access HLS stream:**
```
http://localhost:5555/live/stream.m3u8
```

## Troubleshooting

### Stream Not Appearing

**Check FFmpeg process:**
```bash
# View logs
pm2 logs stream-capture

# Check if running
ps aux | grep ffmpeg
```

**Test RTMP connection:**
```bash
# Test with static image
ffmpeg -loop 1 -i test.png -f flv "rtmp://live.twitch.tv/app/$TWITCH_STREAM_KEY"
```

**Check stream key:**
```bash
# Verify key is set
echo $TWITCH_STREAM_KEY

# Test key validity (Twitch)
curl -H "Client-ID: your-client-id" \
  -H "Authorization: Bearer your-token" \
  https://api.twitch.tv/helix/streams/key
```

### Poor Stream Quality

**Increase bitrate:**
```bash
STREAM_VIDEO_BITRATE=4500k
```

**Use slower preset:**
```bash
STREAM_VIDEO_PRESET=fast
```

**Check CPU usage:**
```bash
htop
```

**Use hardware encoding (if available):**
```bash
# NVIDIA GPU
STREAM_VIDEO_CODEC=h264_nvenc

# AMD GPU
STREAM_VIDEO_CODEC=h264_amf

# Intel GPU
STREAM_VIDEO_CODEC=h264_qsv
```

### High CPU Usage

**Use faster preset:**
```bash
STREAM_VIDEO_PRESET=ultrafast
```

**Lower resolution:**
```bash
STREAM_VIDEO_WIDTH=1280
STREAM_VIDEO_HEIGHT=720
```

**Lower frame rate:**
```bash
STREAM_VIDEO_FPS=30
```

### Stream Buffering/Stuttering

**Check upload bandwidth:**
```bash
# Test upload speed
speedtest-cli --upload-only
```

**Reduce bitrate:**
```bash
STREAM_VIDEO_BITRATE=1500k
```

**Check network latency:**
```bash
# Ping Twitch ingest
ping live.twitch.tv

# Traceroute
traceroute live.twitch.tv
```

### Audio/Video Desync

**Check audio buffer:**
```bash
STREAM_AUDIO_BUFFER=512
```

**Use constant frame rate:**
```bash
STREAM_VIDEO_FPS=30
```

**Check system time:**
```bash
# Sync system clock
ntpdate -s time.nist.gov
```

## Advanced Configuration

### Custom FFmpeg Flags

```bash
# Add custom FFmpeg flags
FFMPEG_CUSTOM_FLAGS="-tune zerolatency -profile:v baseline"
```

### Multiple Outputs

```bash
# JSON array of destinations
RTMP_DESTINATIONS_JSON='[
  {
    "name": "Twitch",
    "url": "rtmp://live.twitch.tv/app",
    "key": "your-key",
    "enabled": true
  },
  {
    "name": "YouTube",
    "url": "rtmp://a.rtmp.youtube.com/live2",
    "key": "your-key",
    "enabled": true
  }
]'
```

### RTMP Multiplexer

Use a multiplexer service (Restream, Livepeer) to fan out to multiple platforms:

```bash
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-restream-key
```

## Monitoring

### Stream Health

```bash
# Check stream status
curl http://localhost:5555/api/streaming/status

# Check FFmpeg stats
pm2 logs stream-capture | grep fps
```

### Bandwidth Usage

```bash
# Monitor network usage
iftop -i eth0

# Check FFmpeg bandwidth
pm2 logs stream-capture | grep bitrate
```

### Viewer Count

**Twitch:**
```bash
curl -H "Client-ID: your-client-id" \
  -H "Authorization: Bearer your-token" \
  "https://api.twitch.tv/helix/streams?user_login=your-username"
```

**YouTube:**
```bash
curl "https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=your-video-id&key=your-api-key"
```

## See Also

- [Vast.ai Deployment Guide](vast-deployment.md)
- [Maintenance Mode API](maintenance-mode-api.md)
- [WebGPU Requirements](webgpu-requirements.md)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Twitch Broadcast Guidelines](https://help.twitch.tv/s/article/broadcast-guidelines)
