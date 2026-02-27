# Vast.ai Deployment Guide

Hyperscape uses Vast.ai for GPU-accelerated streaming and duel arena hosting. This guide covers the automated deployment pipeline, GPU rendering setup, and troubleshooting.

## Overview

The Vast.ai deployment provides:
- **GPU-accelerated WebGPU rendering** via NVIDIA + Xorg headless
- **Multi-platform RTMP streaming** to Twitch, Kick, and X
- **PulseAudio audio capture** for game music and sound effects
- **Automated maintenance mode** for graceful deployments
- **Health monitoring** and diagnostic logging

## Deployment Workflow

### Automatic Deployment

The deployment is triggered automatically:
1. **After CI passes** on `main` branch
2. **Manual trigger** via GitHub Actions `workflow_dispatch`

Workflow file: `.github/workflows/deploy-vast.yml`

### Deployment Steps

1. **Enter Maintenance Mode** (optional, if secrets configured)
   - Pauses new duel cycles
   - Waits for pending markets to resolve (300s timeout)
   - Returns `safeToDeploy` status

2. **SSH Deploy**
   - Installs bun if not present (with unzip dependency)
   - Clones repo on first-time setup
   - Pulls latest code from `main`
   - Writes secrets to `/tmp/hyperscape-secrets.env`
   - Runs `scripts/deploy-vast.sh`

3. **Exit Maintenance Mode**
   - Waits for server health (120s, 30 retries)
   - Resumes duel cycles

## GPU Rendering Setup

### Xorg Headless Configuration

The deployment attempts Xorg first for hardware GPU rendering:

```bash
# NVIDIA headless Xorg config (/etc/X11/xorg-nvidia-headless.conf)
Section "ServerLayout"
    Identifier     "Layout0"
    Screen      0  "Screen0"
EndSection

Section "Device"
    Identifier     "Device0"
    Driver         "nvidia"
    VendorName     "NVIDIA Corporation"
    Option         "AllowEmptyInitialConfiguration" "True"
    Option         "UseDisplayDevice" "None"
EndSection

Section "Screen"
    Identifier     "Screen0"
    Device         "Device0"
    DefaultDepth    24
    SubSection     "Display"
        Depth       24
        Modes      "1920x1080" "1280x720"
    EndSubSection
EndSection
```

**Xorg startup:**
```bash
Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf -noreset -logfile /var/log/Xorg.99.log
```

**Verification:**
- Check if Xorg process is alive
- Verify X server responds with `xdpyinfo -display :99`
- Check for GPU rendering with `glxinfo -display :99 | grep NVIDIA`

### Xvfb Fallback

If Xorg fails to start or doesn't respond:
```bash
Xvfb :99 -screen 0 1920x1080x24 &
export DUEL_CAPTURE_USE_XVFB="true"
```

**Note**: Xvfb is software-only rendering. WebGPU may not work without hardware GPU access.

### Vulkan Driver Configuration

Force NVIDIA-only Vulkan ICD to avoid conflicts with Mesa ICDs:

```bash
export VK_ICD_FILENAMES="/usr/share/vulkan/icd.d/nvidia_icd.json"
```

This prevents issues with broken Mesa Lavapipe or SwiftShader ICDs that may be present on the system.

### Environment Variables

Set by `deploy-vast.sh` and passed to PM2:

| Variable | Value | Purpose |
|----------|-------|---------|
| `DISPLAY` | `:99` | X server display number |
| `VK_ICD_FILENAMES` | `/usr/share/vulkan/icd.d/nvidia_icd.json` | Force NVIDIA Vulkan ICD |
| `DUEL_CAPTURE_USE_XVFB` | `true` or `false` | Set dynamically based on Xorg success |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Use Chrome Dev channel (google-chrome-unstable) |
| `STREAM_CAPTURE_HEADLESS` | `false` | Run headful with Xvfb/Xorg |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | Use Vulkan ANGLE backend |
| `STREAM_CAPTURE_DISABLE_WEBGPU` | `false` | Enable WebGPU rendering |

## Audio Capture Setup

### PulseAudio Configuration

User-mode PulseAudio with virtual sink for audio capture:

```bash
# Setup XDG runtime directory
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Create PulseAudio config
mkdir -p /root/.config/pulse
cat > /root/.config/pulse/default.pa << 'EOF'
.fail
load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
set-default-sink chrome_audio
load-module module-native-protocol-unix auth-anonymous=1
EOF

# Start PulseAudio
pulseaudio --start --exit-idle-time=-1 --daemonize=yes

# Export for child processes
export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
```

### Audio Capture in FFmpeg

FFmpeg captures from the PulseAudio monitor:

```bash
-thread_queue_size 1024 \
-use_wallclock_as_timestamps 1 \
-f pulse \
-ac 2 \
-ar 44100 \
-i chrome_audio.monitor
```

**Audio filter for stability:**
```bash
-af aresample=async=1000:first_pts=0
```

This resamples audio if drift exceeds 1000 samples (22ms at 44.1kHz), preventing dropouts.

### Fallback to Silent Audio

If PulseAudio is not accessible:
```bash
-f lavfi -i anullsrc=r=44100:cl=stereo
```

## RTMP Streaming Configuration

### Supported Platforms

| Platform | URL | Key Source |
|----------|-----|------------|
| **Twitch** | `rtmp://live.twitch.tv/app` | `TWITCH_STREAM_KEY` |
| **Kick** | `rtmps://fa723fc1b171.global-contribute.live-video.net/app` | `KICK_STREAM_KEY` |
| **X/Twitter** | `rtmp://sg.pscp.tv:80/x` | `X_STREAM_KEY` |
| **YouTube** | Disabled | `YOUTUBE_STREAM_KEY=""` |

### Stream Key Management

Stream keys are passed through GitHub Secrets → SSH → .env file:

```bash
# In deploy-vast.yml
cat > /tmp/hyperscape-secrets.env << 'EOF'
TWITCH_STREAM_KEY=${{ secrets.TWITCH_STREAM_KEY }}
X_STREAM_KEY=${{ secrets.X_STREAM_KEY }}
X_RTMP_URL=${{ secrets.X_RTMP_URL }}
KICK_STREAM_KEY=${{ secrets.KICK_STREAM_KEY }}
KICK_RTMP_URL=${{ secrets.KICK_RTMP_URL }}
YOUTUBE_STREAM_KEY=
EOF

# In deploy-vast.sh
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL
unset YOUTUBE_STREAM_KEY
export YOUTUBE_STREAM_KEY=""
source /root/hyperscape/packages/server/.env
```

This prevents stale keys from persisting in the environment.

### FFmpeg Encoding Settings

**Video encoding** (configurable via STREAM_LOW_LATENCY):

```bash
# Default (film tune, better quality)
-c:v libx264 \
-preset ultrafast \
-tune film \
-b:v 4500k \
-maxrate 5400k \
-bufsize 18000k \
-pix_fmt yuv420p \
-g 60 \
-bf 2

# Low latency mode (STREAM_LOW_LATENCY=true)
-c:v libx264 \
-preset ultrafast \
-tune zerolatency \
-b:v 4500k \
-maxrate 5400k \
-bufsize 9000k \
-pix_fmt yuv420p \
-g 60
```

**Audio encoding:**
```bash
-af aresample=async=1000:first_pts=0 \
-c:a aac \
-b:a 128k \
-ar 44100 \
-flags +global_header
```

**FLV flags for RTMP stability:**
```bash
-f tee [f=flv:onfail=ignore:flvflags=no_duration_filesize]rtmp://...
```

## Required GitHub Secrets

Configure these in your GitHub repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP | `123.45.67.89` |
| `VAST_PORT` | SSH port | `12345` |
| `VAST_SSH_KEY` | SSH private key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VAST_SERVER_URL` | Public server URL | `https://your-server.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing secret | `openssl rand -base64 32` |
| `ADMIN_CODE` | Admin API access code | Random secure string |
| `TWITCH_STREAM_KEY` | Twitch stream key | `live_123456789_...` |
| `KICK_STREAM_KEY` | Kick stream key | `sk_us-west-2_...` |
| `KICK_RTMP_URL` | Kick RTMP URL | `rtmps://fa723fc1b171...` |
| `X_STREAM_KEY` | X/Twitter stream key | `sp16tpmtyqws` |
| `X_RTMP_URL` | X/Twitter RTMP URL | `rtmp://sg.pscp.tv:80/x` |
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Solana keypair (base58) | `[1,2,3,...]` or base58 string |
| `ARENA_EXTERNAL_BET_WRITE_KEY` | External betting API key | Random secure string |

## Port Mappings

Vast.ai uses socat to proxy internal ports to external ports:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | HTTP (Game Server) |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN (Assets) |

**Socat commands:**
```bash
socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 &  # HTTP
socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 &  # WebSocket
socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 &  # CDN
```

## PM2 Process Management

The deployment uses PM2 for process supervision:

```bash
# Start duel stack
pm2 start ecosystem.config.cjs

# View logs
pm2 logs hyperscape-duel

# Restart
pm2 restart hyperscape-duel

# Stop
pm2 stop hyperscape-duel

# Status
pm2 status
```

**PM2 configuration** (`ecosystem.config.cjs`):
- Auto-restart on crash (max_restarts: 999999)
- Min uptime: 10s before considered healthy
- Restart delay: 5s between restarts
- Exponential backoff: 1s base delay after rapid restarts
- Memory limit: 4GB (restart if exceeded)
- Logs: `logs/duel-error.log`, `logs/duel-out.log`

## Diagnostics

### Streaming Diagnostics

After deployment, the script runs comprehensive diagnostics:

```bash
# Streaming API state
curl http://localhost:5555/api/streaming/state

# Game client status
curl http://localhost:3333

# RTMP status file
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# FFmpeg processes
ps aux | grep ffmpeg

# Stream processes
ps aux | grep -E "stream-to-rtmp|rtmp-bridge"

# PM2 logs (filtered for streaming)
pm2 logs hyperscape-duel --nostream --lines 200 | grep -iE "rtmp|ffmpeg|stream|capture"
```

### Health Checks

**Server health endpoint:**
```bash
curl http://localhost:5555/health
```

**Expected response:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-02-27T04:18:23.288Z"
}
```

**Maintenance mode status:**
```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

## Troubleshooting

### Xorg Fails to Start

**Check logs:**
```bash
cat /var/log/Xorg.99.log
```

**Common issues:**
- NVIDIA driver not installed: `apt-get install nvidia-driver-535`
- Display already in use: `pkill -9 Xorg; pkill -9 Xvfb`
- Missing xserver-xorg-core: `apt-get install xserver-xorg-core`

**Fallback**: The deployment automatically falls back to Xvfb if Xorg fails.

### WebGPU Not Available

**Check Vulkan:**
```bash
vulkaninfo --summary
```

**Check NVIDIA:**
```bash
nvidia-smi
```

**Check ICD:**
```bash
echo $VK_ICD_FILENAMES
# Should be: /usr/share/vulkan/icd.d/nvidia_icd.json
```

**Verify in Chrome:**
```bash
# In browser console
navigator.gpu
# Should not be undefined
```

### PulseAudio Not Working

**Check PulseAudio status:**
```bash
pulseaudio --check && echo "Running" || echo "Not running"
```

**List sinks:**
```bash
pactl list short sinks
# Should include: chrome_audio
```

**Restart PulseAudio:**
```bash
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio
```

**Check environment:**
```bash
echo $PULSE_SERVER
# Should be: unix:/tmp/pulse-runtime/pulse/native

echo $XDG_RUNTIME_DIR
# Should be: /tmp/pulse-runtime
```

### Stream Not Appearing on Platforms

**Check RTMP status:**
```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

**Check FFmpeg processes:**
```bash
ps aux | grep ffmpeg
```

**Check stream keys:**
```bash
# In deploy-vast.sh logs
grep "STREAM_KEY" /root/hyperscape/logs/duel-out.log
# Should show: ***configured*** (not NOT SET)
```

**Verify destinations in ecosystem.config.cjs:**
```bash
grep -A 5 "TWITCH_STREAM_KEY\|KICK_STREAM_KEY\|X_STREAM_KEY" ecosystem.config.cjs
```

### Database Connection Fails

**Check DATABASE_URL:**
```bash
cat /root/hyperscape/packages/server/.env | grep DATABASE_URL
```

**Test connection:**
```bash
cd /root/hyperscape/packages/server
bun -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e));
"
```

**Check warmup logs:**
```bash
grep "Database warmup" /root/hyperscape/logs/duel-out.log
```

### PM2 Process Crashes

**Check logs:**
```bash
pm2 logs hyperscape-duel --lines 500
```

**Check error logs:**
```bash
pm2 logs hyperscape-duel --err --lines 100
```

**Restart manually:**
```bash
pm2 restart hyperscape-duel
```

**Check memory usage:**
```bash
pm2 status
# Look for memory column - should be < 4GB
```

### Secrets Not Persisting

**Check /tmp secrets file:**
```bash
cat /tmp/hyperscape-secrets.env
# Should contain DATABASE_URL, stream keys, etc.
```

**Check .env file:**
```bash
cat /root/hyperscape/packages/server/.env
```

**Manual fix:**
```bash
# Copy secrets from /tmp to .env
cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env

# Or recreate manually
cat > /root/hyperscape/packages/server/.env << 'EOF'
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_...
# etc.
EOF
```

## Manual Deployment

To deploy manually without GitHub Actions:

```bash
# SSH into Vast.ai instance
ssh -p <port> root@<host>

# Run deploy script
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

## Monitoring

### Real-time Logs

```bash
# Tail all logs
pm2 logs hyperscape-duel

# Tail errors only
pm2 logs hyperscape-duel --err

# Filter for streaming
pm2 logs hyperscape-duel | grep -iE "rtmp|ffmpeg|stream"
```

### Process Status

```bash
pm2 status
pm2 describe hyperscape-duel
```

### Resource Usage

```bash
# CPU and memory
pm2 monit

# Detailed process info
pm2 show hyperscape-duel
```

### Streaming Health

```bash
# Check streaming API
curl http://localhost:5555/api/streaming/state

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

## Environment Variables Reference

See `ecosystem.config.cjs` for full list. Key variables:

### Database
- `DATABASE_URL` - PostgreSQL connection string (required)
- `USE_LOCAL_POSTGRES` - Set to `false` for production

### Streaming
- `STREAMING_DUEL_ENABLED` - Enable duel streaming (`true`)
- `STREAM_CAPTURE_MODE` - Capture mode (`cdp`)
- `STREAM_CAPTURE_WIDTH` - Video width (`1280`)
- `STREAM_CAPTURE_HEIGHT` - Video height (`720`)
- `STREAM_FPS` - Frame rate (`30`)
- `STREAM_VIDEO_BITRATE_KBPS` - Video bitrate (`4500`)
- `STREAM_AUDIO_BITRATE_KBPS` - Audio bitrate (`128`)
- `STREAM_LOW_LATENCY` - Use zerolatency tune (`false`)

### Audio
- `STREAM_AUDIO_ENABLED` - Enable audio capture (`true`)
- `PULSE_AUDIO_DEVICE` - PulseAudio device (`chrome_audio.monitor`)
- `PULSE_SERVER` - PulseAudio server (`unix:/tmp/pulse-runtime/pulse/native`)
- `XDG_RUNTIME_DIR` - Runtime directory (`/tmp/pulse-runtime`)

### GPU & Display
- `DISPLAY` - X server display (`:99`)
- `VK_ICD_FILENAMES` - Vulkan ICD path (`/usr/share/vulkan/icd.d/nvidia_icd.json`)
- `DUEL_CAPTURE_USE_XVFB` - Use Xvfb instead of Xorg (`true` or `false`)
- `STREAM_CAPTURE_CHANNEL` - Chrome channel (`chrome-dev`)
- `STREAM_CAPTURE_HEADLESS` - Headless mode (`false`)
- `STREAM_CAPTURE_ANGLE` - ANGLE backend (`vulkan`)
- `STREAM_CAPTURE_DISABLE_WEBGPU` - Disable WebGPU (`false`)

### RTMP Destinations
- `TWITCH_STREAM_KEY` - Twitch stream key
- `KICK_STREAM_KEY` - Kick stream key
- `KICK_RTMP_URL` - Kick RTMP URL
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X/Twitter RTMP URL
- `YOUTUBE_STREAM_KEY` - YouTube stream key (set to `""` to disable)

### Solana
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana keypair (base58 or JSON array)
- `SOLANA_RPC_URL` - Solana RPC endpoint (`https://api.devnet.solana.com`)
- `SOLANA_WS_URL` - Solana WebSocket endpoint (`wss://api.devnet.solana.com/`)

### CDN
- `PUBLIC_CDN_URL` - Asset CDN URL (`https://assets.hyperscape.club`)

## Performance Tuning

### Memory Management

```bash
# Disable memory trimming (prevents fragmentation)
export MALLOC_TRIM_THRESHOLD_="-1"
export MIMALLOC_ALLOW_DECOMMIT="0"
export MIMALLOC_ALLOW_RESET="0"
export MIMALLOC_PAGE_RESET="0"
export MIMALLOC_PURGE_DELAY="1000000"
```

### Server Runtime

```bash
# Tick rate limiting
export SERVER_RUNTIME_MAX_TICKS_PER_FRAME="1"
export SERVER_RUNTIME_MIN_DELAY_MS="10"

# Game state polling
export GAME_STATE_POLL_TIMEOUT_MS="5000"
export GAME_STATE_POLL_INTERVAL_MS="3000"

# Health monitoring
export DUEL_RUNTIME_HEALTH_INTERVAL_MS="15000"
export DUEL_RUNTIME_HEALTH_MAX_FAILURES="30"
```

### Stream Recovery

```bash
# Recovery timeout and max failures
export STREAM_CAPTURE_RECOVERY_TIMEOUT_MS="30000"
export STREAM_CAPTURE_RECOVERY_MAX_FAILURES="6"
```

## Maintenance Mode API

### Enter Maintenance Mode

```bash
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'
```

**Response:**
```json
{
  "success": true,
  "status": {
    "safeToDeploy": true,
    "currentPhase": "IDLE",
    "pendingMarkets": 0
  }
}
```

### Check Status

```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

### Exit Maintenance Mode

```bash
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

## Best Practices

1. **Always use maintenance mode** for production deployments
2. **Monitor health checks** after deployment (wait for 200 status)
3. **Check streaming diagnostics** in deployment logs
4. **Verify stream keys** are configured (not "NOT SET")
5. **Test Xorg** before relying on hardware GPU rendering
6. **Keep secrets in GitHub Secrets** - never commit to repo
7. **Use pm2 logs** for debugging streaming issues
8. **Monitor memory usage** - PM2 will restart if > 4GB

## Related Documentation

- [Streaming Improvements (Feb 2026)](streaming-improvements-feb-2026.md)
- [Streaming Audio Capture](streaming-audio-capture.md)
- [Maintenance Mode API](maintenance-mode-api.md)
- [Railway Deployment](railway-dev-prod.md)
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md)
