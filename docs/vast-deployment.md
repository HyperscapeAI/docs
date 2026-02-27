# Vast.ai GPU Streaming Deployment

This guide covers deploying Hyperscape's streaming duel system to Vast.ai with GPU-accelerated rendering.

## Overview

Vast.ai deployment provides:
- **GPU-accelerated WebGPU rendering** via NVIDIA Vulkan drivers
- **Xorg headless display** for GPU access (not Xvfb software rendering)
- **PulseAudio audio capture** for game music and sound effects
- **Multi-platform RTMP streaming** to Twitch, Kick, and X
- **Automated maintenance mode** for graceful deployments
- **PM2 process management** with auto-restart on crash

## Prerequisites

### GitHub Secrets

Configure these in your repository settings → Secrets and variables → Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP | `ssh6.vast.ai` |
| `VAST_PORT` | SSH port | `35143` |
| `VAST_SSH_KEY` | Private SSH key for root access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secure random string (32+ chars) | Generate with `openssl rand -base64 32` |
| `ADMIN_CODE` | Admin access code | Your secure admin password |
| `ARENA_EXTERNAL_BET_WRITE_KEY` | Betting API write key | Random secret token |
| `TWITCH_STREAM_KEY` | Twitch stream key | From dashboard.twitch.tv |
| `KICK_STREAM_KEY` | Kick stream key | From kick.com creator dashboard |
| `KICK_RTMP_URL` | Kick RTMP endpoint | `rtmps://fa723fc1b171.global-contribute.live-video.net/app` |
| `X_STREAM_KEY` | X/Twitter stream key | From Media Studio |
| `X_RTMP_URL` | X RTMP endpoint | `rtmp://sg.pscp.tv:80/x` |
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Solana keypair (base58) | For on-chain market operations |

### Vast.ai Instance Requirements

**Minimum specs:**
- **GPU**: NVIDIA GPU with Vulkan support (GTX 1060+ recommended)
- **RAM**: 16GB+ (32GB recommended for stable long-running streams)
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 20.04+ or Debian 11+
- **Network**: 100 Mbps+ upload for multi-platform streaming

**Recommended instance:**
- NVIDIA RTX 3060 or better
- 32GB RAM
- 100GB NVMe SSD
- Ubuntu 22.04 LTS

## Deployment Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    Vast.ai Instance                      │
├─────────────────────────────────────────────────────────┤
│  Xorg :99 (NVIDIA headless)                             │
│    ↓                                                     │
│  Chrome Dev (WebGPU + Vulkan)                           │
│    ↓                                                     │
│  Game Client (localhost:3333)                           │
│    ↓                                                     │
│  PulseAudio (chrome_audio sink)                         │
│    ↓                                                     │
│  FFmpeg (CDP capture + audio)                           │
│    ↓                                                     │
│  RTMP Mux → Twitch, Kick, X                             │
│                                                          │
│  PM2 (duel-stack.mjs orchestrator)                      │
│    ├─ Game Server (port 5555)                           │
│    ├─ Game Client (port 3333)                           │
│    ├─ RTMP Bridge (port 8765)                           │
│    └─ Duel Bots                                         │
│                                                          │
│  Port Proxies (socat)                                   │
│    ├─ 35143 → 5555 (HTTP)                               │
│    ├─ 35079 → 5555 (WebSocket)                          │
│    └─ 35144 → 8080 (CDN)                                │
└─────────────────────────────────────────────────────────┘
```

### GPU Rendering Pipeline

**Critical**: Hyperscape requires WebGPU (all shaders use TSL). This means:
1. **Xorg with NVIDIA drivers** - Xvfb is software-only and cannot provide GPU access
2. **Vulkan ICD isolation** - Force NVIDIA-only to avoid Mesa conflicts
3. **Chrome Dev channel** - WebGPU enabled by default
4. **ANGLE vulkan backend** - Hardware-accelerated rendering

## Deployment Workflow

### Automatic Deployment

Pushes to `main` trigger automatic deployment after CI passes:

```yaml
# .github/workflows/deploy-vast.yml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

**Deployment steps:**
1. **Enter maintenance mode** - Pauses new duel cycles, waits for markets to resolve
2. **SSH to Vast.ai** - Pull latest code, install dependencies
3. **Setup GPU environment** - Xorg, Vulkan, Chrome Dev, PulseAudio
4. **Database migration** - Push schema changes, warmup connection
5. **Restart PM2** - Kill daemon to pick up new environment variables
6. **Health check** - Wait up to 120s for server to be healthy
7. **Exit maintenance mode** - Resume duel cycles

### Manual Deployment

Trigger manually from GitHub Actions:

```bash
# Go to: Actions → Deploy to Vast.ai → Run workflow
# Or use GitHub CLI:
gh workflow run deploy-vast.yml
```

## Configuration

### Environment Variables

The deployment script writes secrets to `/tmp/hyperscape-secrets.env` before git reset, then copies to `packages/server/.env`:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
ARENA_EXTERNAL_BET_WRITE_KEY=your-bet-write-key
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=sk_...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
YOUTUBE_STREAM_KEY=  # Explicitly disabled
SOLANA_DEPLOYER_PRIVATE_KEY=base58-encoded-key
```

### PM2 Ecosystem Config

`ecosystem.config.cjs` configures the duel stack:

```javascript
{
  name: "hyperscape-duel",
  script: "scripts/duel-stack.mjs",
  interpreter: "bun",
  args: "--skip-betting --skip-bots",
  autorestart: true,
  max_memory_restart: "4G",
  env: {
    // GPU rendering
    DISPLAY: ":99",
    VK_ICD_FILENAMES: "/usr/share/vulkan/icd.d/nvidia_icd.json",
    DUEL_CAPTURE_USE_XVFB: "false",  // Use Xorg, not Xvfb
    STREAM_CAPTURE_CHANNEL: "chrome-dev",
    STREAM_CAPTURE_ANGLE: "vulkan",
    STREAM_CAPTURE_DISABLE_WEBGPU: "false",
    
    // Audio
    STREAM_AUDIO_ENABLED: "true",
    PULSE_AUDIO_DEVICE: "chrome_audio.monitor",
    PULSE_SERVER: "unix:/tmp/pulse-runtime/pulse/native",
    
    // Streaming
    STREAMING_CANONICAL_PLATFORM: "twitch",
    STREAMING_PUBLIC_DELAY_MS: "0",  // Live mode
    
    // Database
    USE_LOCAL_POSTGRES: "false",
    DATABASE_URL: process.env.DATABASE_URL,
    
    // CDN
    PUBLIC_CDN_URL: "https://assets.hyperscape.club",
  }
}
```

## GPU Setup Details

### Xorg Headless Configuration

The deploy script creates `/etc/X11/xorg-nvidia-headless.conf`:

```xorg
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

This enables GPU rendering without a physical display.

### Vulkan Driver Isolation

Force NVIDIA-only Vulkan ICD to avoid conflicts with broken Mesa ICDs:

```bash
export VK_ICD_FILENAMES="/usr/share/vulkan/icd.d/nvidia_icd.json"
```

Verify Vulkan works:
```bash
vulkaninfo --summary
```

### PulseAudio Audio Capture

User-mode PulseAudio with virtual sink for game audio:

```bash
# ~/.config/pulse/default.pa
.fail
load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="ChromeAudio"
set-default-sink chrome_audio
load-module module-native-protocol-unix auth-anonymous=1
```

Start PulseAudio:
```bash
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
```

Verify audio sink:
```bash
pactl list short sinks | grep chrome_audio
```

## Maintenance Mode API

Graceful deployment system that pauses duel cycles and waits for markets to resolve.

### Enter Maintenance Mode

```bash
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{
    "reason": "deployment",
    "timeoutMs": 300000
  }'
```

**Response:**
```json
{
  "success": true,
  "status": {
    "safeToDeploy": true,
    "currentPhase": "IDLE",
    "pendingMarkets": 0,
    "estimatedWaitMs": 0
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
  -H "x-admin-code": your-admin-code"
```

## Monitoring & Debugging

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

# Delete from PM2
bunx pm2 delete hyperscape-duel
```

### Streaming Diagnostics

The deploy script runs comprehensive diagnostics after deployment:

```bash
# Check streaming API
curl http://localhost:5555/api/streaming/state

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check FFmpeg processes
ps aux | grep ffmpeg

# Check GPU status
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check PulseAudio
pactl list short sinks
```

### Common Issues

**WebGPU not available:**
- Verify Xorg is running: `ps aux | grep Xorg`
- Check DISPLAY: `echo $DISPLAY` (should be `:99`)
- Verify Vulkan: `vulkaninfo --summary`
- Check VK_ICD_FILENAMES points to NVIDIA ICD

**No audio in stream:**
- Check PulseAudio: `pulseaudio --check`
- Verify chrome_audio sink: `pactl list short sinks`
- Check PULSE_SERVER env var
- Verify XDG_RUNTIME_DIR permissions (chmod 700)

**Stream not appearing on platforms:**
- Check stream keys are configured (masked in logs)
- Verify RTMP URLs are correct
- Check FFmpeg is running: `ps aux | grep ffmpeg`
- Review PM2 logs for RTMP errors

**Database connection failures:**
- Verify DATABASE_URL is set: `grep DATABASE_URL packages/server/.env`
- Check database warmup succeeded in deploy logs
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

**Stale environment variables:**
- The deploy script explicitly unsets and re-exports stream keys
- PM2 daemon is killed (not just processes deleted) to pick up new env
- Secrets are written to /tmp before git reset to survive code updates

## Port Mappings

Vast.ai uses socat to proxy internal ports to external:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | HTTP API |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

Access your server at: `http://<vast-ip>:35143`

## Streaming Configuration

### RTMP Destinations

Configured in `ecosystem.config.cjs`:

```javascript
// Twitch
TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY,

// Kick (RTMPS)
KICK_STREAM_KEY: process.env.KICK_STREAM_KEY,
KICK_RTMP_URL: "rtmps://fa723fc1b171.global-contribute.live-video.net/app",

// X/Twitter
X_STREAM_KEY: process.env.X_STREAM_KEY,
X_RTMP_URL: "rtmp://sg.pscp.tv:80/x",

// YouTube explicitly disabled
YOUTUBE_STREAM_KEY: "",
```

### FFmpeg Settings

- **Video**: 1280x720, 4500k bitrate, H.264 (x264)
- **Audio**: 128k AAC, 48kHz, stereo
- **Tune**: `film` (not `zerolatency`) for better compression
- **Buffer**: 18000k (4x bitrate) for network stability
- **Audio source**: PulseAudio `chrome_audio.monitor`

### Canonical Platform

Set to `twitch` for 12s default latency (configurable to 0ms for live betting):

```bash
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0  # Override to 0 for live mode
```

## Security

### Secrets Management

- **Never commit secrets** to git
- Secrets are written to `/tmp` before git reset
- Stream keys are masked in logs
- JWT_SECRET is required in production (throws error if not set)
- ADMIN_CODE prevents unauthorized admin access

### Solana Keypair

Automatically configured from `SOLANA_DEPLOYER_PRIVATE_KEY`:

```bash
# The deploy script runs:
bun run scripts/decode-key.ts

# This writes to:
~/.config/solana/id.json
```

Used for:
- Market creation and settlement
- Oracle reporting
- Keeper bot operations

## Performance Tuning

### Memory Limits

PM2 restarts if memory exceeds 4GB:

```javascript
max_memory_restart: "4G"
```

Disable memory allocator features to reduce fragmentation:

```bash
MALLOC_TRIM_THRESHOLD_=-1
MIMALLOC_ALLOW_DECOMMIT=0
MIMALLOC_ALLOW_RESET=0
MIMALLOC_PAGE_RESET=0
MIMALLOC_PURGE_DELAY=1000000
```

### Crash Recovery

PM2 auto-restarts with exponential backoff:

```javascript
autorestart: true,
max_restarts: 999999,
min_uptime: "10s",
restart_delay: 5000,
exp_backoff_restart_delay: 1000
```

If any critical sub-process dies, the orchestrator tears everything down and PM2 restarts from scratch.

## Troubleshooting

### Deployment Fails

**Check GitHub Actions logs:**
1. Go to Actions → Deploy to Vast.ai
2. Review each step for errors
3. Check "Streaming Diagnostics" section

**Common failures:**
- **Bun not installed**: Deploy script auto-installs if missing
- **Git LFS not configured**: `git lfs install` runs automatically
- **Database unreachable**: Check DATABASE_URL secret
- **GPU not detected**: Verify Vast.ai instance has NVIDIA GPU

### Server Won't Start

**Check PM2 logs:**
```bash
bunx pm2 logs hyperscape-duel --lines 200
```

**Common issues:**
- Missing DATABASE_URL
- Invalid JWT_SECRET
- Xorg failed to start (fallback to Xvfb)
- PulseAudio not running

### Stream Quality Issues

**Buffering/stuttering:**
- Increase buffer size (default 18000k)
- Check network upload speed
- Reduce resolution to 720p
- Disable audio if not needed

**No audio:**
- Verify PulseAudio is running
- Check chrome_audio sink exists
- Ensure PULSE_SERVER env var is set
- Review FFmpeg audio input logs

## Advanced Configuration

### Custom Streaming Platforms

Add custom RTMP destinations via environment variables:

```bash
CUSTOM_RTMP_NAME=MyPlatform
CUSTOM_RTMP_URL=rtmp://my-server/live
CUSTOM_STREAM_KEY=my-key
```

Or use JSON fanout config:

```bash
RTMP_DESTINATIONS_JSON='[{"name":"MyMux","url":"rtmp://host/live","key":"stream-key","enabled":true}]'
```

### Disable Specific Features

Speed up startup by disabling heavy features:

```bash
# Disable model agents (fastest startup)
SPAWN_MODEL_AGENTS=false

# Disable auto-start agents from database
AUTO_START_AGENTS=false

# Disable activity logger (reduces DB writes)
DISABLE_ACTIVITY_LOGGER=true

# Disable terrain mesh collision (high memory)
TERRAIN_SERVER_MESH_COLLISION_ENABLED=false
```

## Maintenance

### Database Backups

Backup before deployments:

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Log Rotation

PM2 logs are in `/root/hyperscape/logs/`:

```bash
# Rotate logs manually
bunx pm2 flush

# Or configure log rotation in ecosystem.config.cjs
```

### Monitoring

**Health endpoint:**
```bash
curl http://localhost:5555/health
```

**Streaming state:**
```bash
curl http://localhost:5555/api/streaming/state
```

**Server metrics:**
```bash
curl http://localhost:5555/admin/metrics \
  -H "x-admin-code: your-admin-code"
```

## Cost Optimization

### Instance Selection

- **Development**: GTX 1060, 16GB RAM (~$0.10/hr)
- **Production**: RTX 3060, 32GB RAM (~$0.30/hr)
- **High-quality**: RTX 4090, 64GB RAM (~$1.00/hr)

### Auto-shutdown

Configure Vast.ai to auto-shutdown during low-traffic hours:

```bash
# In Vast.ai dashboard:
# Instance → Edit → Auto-shutdown after X hours idle
```

### Spot Instances

Use interruptible instances for 50-70% cost savings (not recommended for production).

## See Also

- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway deployment
- [docs/duel-stack.md](duel-stack.md) - Duel stack architecture
- [packages/server/.env.example](../packages/server/.env.example) - Full environment variable reference
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script source
