# Vast.ai Deployment Guide

Complete guide for deploying Hyperscape to Vast.ai GPU instances for streaming and duel arena.

## Overview

Vast.ai provides affordable GPU instances for running Hyperscape's streaming pipeline. The deployment uses:

- **NVIDIA GPU** for hardware-accelerated WebGPU rendering
- **Xorg or Xvfb** for display server (WebGPU requires a display)
- **Chrome Dev** with Vulkan backend for WebGPU support
- **PulseAudio** for game audio capture
- **FFmpeg** for H.264 encoding and RTMP streaming
- **PM2** for process management and auto-restart

## Prerequisites

### Vast.ai Instance Requirements

**GPU**:
- NVIDIA GPU with Vulkan support
- CUDA capability 3.5+ (most GPUs from 2014+)
- Minimum 2GB VRAM (4GB+ recommended)
- Examples: RTX 3060, RTX 4070, A4000, A5000

**Template**:
- Ubuntu 20.04+ or 22.04
- NVIDIA drivers pre-installed
- CUDA toolkit (optional but recommended)

**Resources**:
- 4+ CPU cores
- 16GB+ RAM
- 50GB+ disk space

### GitHub Secrets

Configure these secrets in your GitHub repository (Settings → Secrets → Actions):

```bash
# SSH Access
VAST_SSH_HOST=ssh6.vast.ai
VAST_SSH_PORT=12345                    # Your instance's SSH port
VAST_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Streaming Keys
TWITCH_STREAM_KEY=live_xxxxx_yyyyy
KICK_STREAM_KEY=sk_us-west-2_xxxxx
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=xxxxx
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Solana (for betting/arena features)
SOLANA_DEPLOYER_PRIVATE_KEY=base58-encoded-private-key

# Security
JWT_SECRET=your-secure-random-string
ARENA_EXTERNAL_BET_WRITE_KEY=your-bet-write-key
```

## Automated Deployment

### GitHub Actions Workflow

The deployment is automated via `.github/workflows/deploy-vast.yml`:

**Triggers**:
- Push to `main` branch (after CI passes)
- Manual trigger via `workflow_dispatch`

**Process**:
1. Enter maintenance mode (pauses duel cycles)
2. Wait for pending markets to resolve (300s timeout)
3. SSH to Vast.ai instance
4. Write secrets to `/tmp/hyperscape-secrets.env`
5. Run `scripts/deploy-vast.sh`
6. Wait for server health check (120s, 30 retries)
7. Exit maintenance mode (resumes operations)

### Manual Deployment

Trigger manually from GitHub Actions tab:
1. Go to Actions → Deploy to Vast.ai
2. Click "Run workflow"
3. Select branch (usually `main`)
4. Click "Run workflow"

## Deployment Script

The `scripts/deploy-vast.sh` script performs the full deployment:

### 1. Code Update

```bash
git fetch origin
git reset --hard origin/main
git pull origin main
```

### 2. Secrets Restoration

Secrets are written to `/tmp/hyperscape-secrets.env` before git reset, then copied back:

```bash
cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env
```

### 3. System Dependencies

```bash
apt-get install -y \
  build-essential \
  python3 \
  socat \
  xvfb \
  git-lfs \
  ffmpeg \
  pulseaudio \
  pulseaudio-utils \
  mesa-vulkan-drivers \
  vulkan-tools \
  libvulkan1
```

### 4. GPU Rendering Setup

**Xorg Attempt** (if DRI devices available):

```bash
# Auto-detect GPU BusID
GPU_BUS_ID=$(nvidia-smi --query-gpu=pci.bus_id --format=csv,noheader | head -1)

# Generate Xorg config
cat > /etc/X11/xorg-nvidia-headless.conf << EOF
Section "ServerLayout"
    Identifier     "Layout0"
    Screen      0  "Screen0"
EndSection

Section "Device"
    Identifier     "Device0"
    Driver         "nvidia"
    BusID          "$XORG_BUS_ID"
    Option         "AllowEmptyInitialConfiguration" "True"
    Option         "UseDisplayDevice" "None"
EndSection

Section "Screen"
    Identifier     "Screen0"
    Device         "Device0"
    DefaultDepth    24
    SubSection     "Display"
        Depth       24
        Virtual    1920 1080
    EndSubSection
EndSection
EOF

# Start Xorg
Xorg :99 -config /etc/X11/xorg-nvidia-headless.conf -noreset &
export DISPLAY=:99
export GPU_RENDERING_MODE=xorg
```

**Xvfb Fallback** (if Xorg fails):

```bash
# Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99
export DUEL_CAPTURE_USE_XVFB=true
export GPU_RENDERING_MODE=xvfb-vulkan
```

**Failure Mode**:

If neither Xorg nor Xvfb can provide WebGPU, deployment exits with error:

```
FATAL ERROR: Cannot establish WebGPU-capable rendering mode
WebGPU is REQUIRED for Hyperscape - there is NO WebGL fallback.
```

### 5. Chrome Installation

```bash
# Add Google Chrome repository
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Chrome Dev channel (has WebGPU enabled)
apt-get update && apt-get install -y google-chrome-unstable
```

### 6. PulseAudio Setup

```bash
# Create runtime directory
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

# Verify sink exists
pactl list short sinks | grep chrome_audio
```

### 7. Build & Database

```bash
# Install dependencies
bun install

# Build packages
cd packages/physx-js-webidl && bun run build && cd ../..
cd packages/decimation && bun run build && cd ../..
cd packages/impostors && bun run build && cd ../..
cd packages/procgen && bun run build && cd ../..
cd packages/asset-forge && bun run build:services && cd ../..
cd packages/shared && bun run build && cd ../..

# Push database schema
cd packages/server
bunx drizzle-kit push --force

# Warmup database connection (3 retries)
for i in 1 2 3; do
  bun -e "..." && break || sleep 3
done
```

### 8. Process Management

```bash
# Kill existing PM2 daemon (ensures new env vars are picked up)
bunx pm2 kill

# Start duel stack
bunx pm2 start ecosystem.config.cjs

# Save for reboot survival
bunx pm2 save
```

### 9. Port Proxies

Vast.ai exposes different ports externally, so we use socat to proxy:

```bash
# Game server: internal 5555 -> external 35143
socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 &

# WebSocket: internal 5555 -> external 35079
socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 &

# CDN: internal 8080 -> external 35144
socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 &
```

### 10. Health Check

```bash
# Wait for server to be healthy (120s timeout, 5s interval)
while [ $WAITED -lt 120 ]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5555/health")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "Server is healthy!"
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
done
```

### 11. Streaming Diagnostics

After deployment, the script runs comprehensive diagnostics:

```bash
# Wait for streaming to initialize
sleep 30

# Check streaming API
curl http://localhost:5555/api/streaming/state

# Check RTMP status file
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check FFmpeg processes
ps aux | grep ffmpeg

# Check PM2 logs (filtered for streaming)
bunx pm2 logs hyperscape-duel --lines 200 | grep -iE "rtmp|ffmpeg|stream"
```

## Environment Variables

The deployment script exports these environment variables for PM2:

```bash
# GPU & Display
export DISPLAY=:99
export GPU_RENDERING_MODE=xorg                                    # or xvfb-vulkan
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
export DUEL_CAPTURE_USE_XVFB=false                                # or true for Xvfb

# WebGPU Enforcement
export STREAM_CAPTURE_HEADLESS=false
export STREAM_CAPTURE_USE_EGL=false

# PulseAudio
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
export PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Stream Keys (explicitly unset stale values first)
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL
unset YOUTUBE_STREAM_KEY  # Explicitly disable YouTube
export YOUTUBE_STREAM_KEY=""

# Re-source .env to get correct values
source /root/hyperscape/packages/server/.env
```

## PM2 Configuration

The `ecosystem.config.cjs` file configures the duel stack:

```javascript
{
  name: "hyperscape-duel",
  script: "scripts/duel-stack.mjs",
  interpreter: "bun",
  autorestart: true,
  max_restarts: 999999,
  env: {
    // GPU Configuration
    DISPLAY: process.env.DISPLAY || ":99",
    GPU_RENDERING_MODE: process.env.GPU_RENDERING_MODE || "xorg",
    VK_ICD_FILENAMES: "/usr/share/vulkan/icd.d/nvidia_icd.json",
    DUEL_CAPTURE_USE_XVFB: process.env.DUEL_CAPTURE_USE_XVFB || "false",
    
    // WebGPU Enforcement
    STREAM_CAPTURE_HEADLESS: "false",
    STREAM_CAPTURE_DISABLE_WEBGPU: "false",
    DUEL_FORCE_WEBGL_FALLBACK: "false",
    
    // Chrome Configuration
    STREAM_CAPTURE_CHANNEL: "chrome-dev",
    STREAM_CAPTURE_ANGLE: "vulkan",
    STREAM_CAPTURE_MODE: "cdp",
    
    // Audio
    STREAM_AUDIO_ENABLED: "true",
    PULSE_AUDIO_DEVICE: "chrome_audio.monitor",
    PULSE_SERVER: "unix:/tmp/pulse-runtime/pulse/native",
    XDG_RUNTIME_DIR: "/tmp/pulse-runtime",
    
    // Streaming
    TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY,
    KICK_STREAM_KEY: process.env.KICK_STREAM_KEY,
    KICK_RTMP_URL: process.env.KICK_RTMP_URL,
    X_STREAM_KEY: process.env.X_STREAM_KEY,
    X_RTMP_URL: process.env.X_RTMP_URL,
    YOUTUBE_STREAM_KEY: "",  // Explicitly disabled
  }
}
```

## Troubleshooting

### Deployment Fails at GPU Setup

**Error**: "FATAL ERROR: Cannot establish WebGPU-capable rendering mode"

**Causes**:
- NVIDIA drivers not installed
- GPU not accessible in container
- DRI/DRM devices not available

**Solutions**:
1. Verify instance has NVIDIA GPU: `nvidia-smi`
2. Check Vast.ai instance template includes NVIDIA drivers
3. Try different Vast.ai instance with better GPU support
4. Check Xorg logs: `cat /var/log/Xorg.99.log`

### Stream Not Appearing on Platforms

**Symptoms**:
- Deployment succeeds but no stream on Twitch/Kick/X
- RTMP status shows disconnected

**Solutions**:
1. Verify stream keys are correct in GitHub secrets
2. Check RTMP URLs are correct (especially Kick)
3. Review PM2 logs: `bunx pm2 logs hyperscape-duel`
4. Check FFmpeg processes: `ps aux | grep ffmpeg`
5. Verify network connectivity to RTMP servers

### Audio Not in Stream

**Symptoms**:
- Video works but no audio
- FFmpeg shows audio input errors

**Solutions**:
1. Check PulseAudio is running: `pulseaudio --check`
2. Verify chrome_audio sink: `pactl list short sinks`
3. Check monitor device: `pactl list short sources | grep monitor`
4. Review PulseAudio logs in PM2 output
5. Restart PulseAudio: `pulseaudio --kill && pulseaudio --start`

### PM2 Process Crashes

**Symptoms**:
- PM2 shows "errored" or "stopped" status
- Frequent restarts

**Solutions**:
1. Check error logs: `bunx pm2 logs hyperscape-duel --err`
2. Verify all environment variables are set: `bunx pm2 env 0`
3. Check memory usage: `bunx pm2 status` (should be under 4GB)
4. Review crash-loop protection: Check restart count
5. Manually restart: `bunx pm2 restart hyperscape-duel`

### Database Connection Fails

**Symptoms**:
- "Database warmup failed" errors
- Server fails to start

**Solutions**:
1. Verify `DATABASE_URL` is set: `echo $DATABASE_URL`
2. Check database is accessible: `psql $DATABASE_URL -c "SELECT 1"`
3. Verify secrets file exists: `cat /tmp/hyperscape-secrets.env`
4. Check network connectivity to database host
5. Review database logs for connection errors

## Maintenance Mode API

For graceful deployments without interrupting active duels:

### Enter Maintenance Mode

```bash
curl -X POST https://your-vast-instance.com:35143/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'
```

**Response**:
```json
{
  "success": true,
  "message": "Maintenance mode enabled",
  "pendingMarkets": 2,
  "estimatedWaitMs": 45000
}
```

### Check Status

```bash
curl https://your-vast-instance.com:35143/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

### Exit Maintenance Mode

```bash
curl -X POST https://your-vast-instance.com:35143/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

## Monitoring

### PM2 Commands

```bash
# View status
bunx pm2 status

# View logs (live tail)
bunx pm2 logs hyperscape-duel

# View logs (last 200 lines)
bunx pm2 logs hyperscape-duel --lines 200

# Restart process
bunx pm2 restart hyperscape-duel

# Stop process
bunx pm2 stop hyperscape-duel

# Delete process
bunx pm2 delete hyperscape-duel
```

### Streaming Diagnostics

```bash
# Check streaming state
curl http://localhost:5555/api/streaming/state

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check FFmpeg processes
ps aux | grep ffmpeg

# Check PulseAudio
pactl list short sinks
pactl list short sources

# Check GPU usage
nvidia-smi

# Check display server
xdpyinfo -display :99
```

### Log Files

```bash
# PM2 logs
/root/hyperscape/logs/duel-out.log
/root/hyperscape/logs/duel-error.log

# Xorg logs
/var/log/Xorg.99.log

# PulseAudio logs (in PM2 output)
bunx pm2 logs hyperscape-duel | grep -i pulse
```

## Performance Optimization

### GPU Memory

Monitor GPU memory usage:
```bash
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

If running low on VRAM:
- Reduce stream resolution: `STREAM_CAPTURE_WIDTH=1280 STREAM_CAPTURE_HEIGHT=720`
- Lower CDP quality: `STREAM_CDP_QUALITY=70`
- Reduce concurrent agents: `AUTO_START_AGENTS_MAX=5`

### CPU Usage

Monitor CPU usage:
```bash
top -b -n 1 | grep hyperscape
```

If CPU is maxed:
- Reduce stream FPS: `STREAM_FPS=24`
- Use faster x264 preset: `STREAM_X264_PRESET=ultrafast`
- Reduce concurrent agents

### Network Bandwidth

Monitor network usage:
```bash
iftop -i eth0
```

If bandwidth is saturated:
- Reduce stream bitrate: `STREAM_BITRATE=3000k`
- Reduce resolution: `STREAM_CAPTURE_WIDTH=1280 STREAM_CAPTURE_HEIGHT=720`
- Disable some RTMP destinations

## Security Best Practices

1. **Rotate stream keys regularly** - Update GitHub secrets monthly
2. **Use strong JWT_SECRET** - Generate with `openssl rand -base64 32`
3. **Restrict admin access** - Set `ADMIN_CODE` and keep it secret
4. **Monitor logs** - Check for unauthorized access attempts
5. **Update dependencies** - Run `bun update` regularly
6. **Firewall rules** - Only expose necessary ports (35143, 35079, 35144)

## Cost Optimization

### Instance Selection

- **RTX 3060** - Good balance of performance and cost (~$0.20/hr)
- **RTX 4070** - Better performance, higher cost (~$0.35/hr)
- **A4000** - Professional GPU, stable but expensive (~$0.50/hr)

### Auto-Shutdown

Configure Vast.ai to auto-shutdown during low usage:
- Set max idle time in Vast.ai dashboard
- Use `pm2 stop` before shutdown to save state

### Spot Instances

Use Vast.ai "interruptible" instances for lower cost:
- ~50% cheaper than on-demand
- May be interrupted with 30s notice
- Good for development/testing

## See Also

- [docs/streaming-configuration.md](streaming-configuration.md) - Streaming configuration reference
- [docs/webgpu-requirements.md](webgpu-requirements.md) - WebGPU requirements
- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Maintenance mode API
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
