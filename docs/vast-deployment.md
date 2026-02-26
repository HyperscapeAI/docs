# Vast.ai Deployment Guide

This guide covers deploying Hyperscape to Vast.ai for GPU-accelerated streaming and duel rendering.

## Overview

Vast.ai provides affordable GPU instances for:
- **Headless rendering**: Chrome + Xvfb + WebGPU
- **RTMP streaming**: Multi-platform streaming (Twitch, Kick, X)
- **Duel automation**: AI vs AI combat with betting markets
- **Cost efficiency**: ~$0.10-0.30/hour for GPU instances

## Prerequisites

1. **Vast.ai account**: [vast.ai](https://vast.ai)
2. **GitHub repository access**: HyperscapeAI/hyperscape
3. **SSH key**: For connecting to Vast instances
4. **GitHub Secrets**: Required for CI/CD deployment

## Required GitHub Secrets

Configure these in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP | `123.45.67.89` |
| `VAST_PORT` | SSH port | `12345` |
| `VAST_SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VAST_SERVER_URL` | Public server URL | `https://hyperscape-vast.example.com` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `ADMIN_CODE` | Admin API access | `your-secure-admin-code` |
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Solana keypair | `[1,2,3,...]` or base64 |
| `TWITCH_STREAM_KEY` | Twitch stream key | `live_123456789_abcdef` |
| `X_STREAM_KEY` | X/Twitter stream key | `your-x-stream-key` |
| `X_RTMP_URL` | X RTMP URL | `rtmp://x-media-studio/path` |

## Manual Setup

### 1. Rent a Vast.ai Instance

**Recommended specs:**
- **GPU**: NVIDIA GTX 1060 or better (6GB+ VRAM)
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Disk**: 50GB+ SSD
- **Bandwidth**: 100+ Mbps upload (for streaming)

**Search filters:**
```
gpu_ram >= 6
num_gpus >= 1
cpu_cores >= 4
cpu_ram >= 16
disk_space >= 50
inet_up >= 100
```

**Template**: Use `pytorch/pytorch:latest` or `nvidia/cuda:12.1.0-devel-ubuntu22.04`

### 2. Connect via SSH

```bash
ssh -p <port> root@<host>
```

### 3. Install Dependencies

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="/root/.bun/bin:$PATH"

# Install Chrome Dev (for WebGPU support)
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-unstable

# Install Xvfb (virtual framebuffer)
apt-get install -y xvfb

# Install Vulkan drivers (for GPU acceleration)
apt-get install -y vulkan-tools mesa-vulkan-drivers

# Install FFmpeg (for RTMP streaming)
apt-get install -y ffmpeg

# Install PM2 (process manager)
npm install -g pm2
```

### 4. Clone Repository

```bash
cd /root
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### 5. Configure Environment

```bash
# Create server .env file
cat > packages/server/.env << EOF
NODE_ENV=production
PORT=5555
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_CODE=your-secure-admin-code
USE_LOCAL_POSTGRES=false

# Streaming
TWITCH_STREAM_KEY=your-twitch-key
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://x-media-studio/path

# Solana (optional)
SOLANA_ARENA_AUTHORITY_SECRET=your-keypair-json
EOF
```

### 6. Build and Start

```bash
# Build all packages
bun run build

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Automated Deployment (CI/CD)

The GitHub Actions workflow (`.github/workflows/deploy-vast.yml`) automates deployment:

### Workflow Triggers

- **Automatic**: After CI passes on `main` branch
- **Manual**: Via workflow_dispatch in GitHub Actions UI

### Deployment Steps

1. **Enter Maintenance Mode**
   - Pauses new duel cycles
   - Waits for active markets to resolve
   - Ensures safe deployment window

2. **SSH to Vast Instance**
   - Connects via SSH using secrets
   - Checks out `main` branch explicitly
   - Writes environment variables to `.env`

3. **Run Deployment Script**
   - Pulls latest code
   - Installs dependencies
   - Builds packages
   - Restarts PM2 processes

4. **Health Check**
   - Waits for server to be healthy (up to 5 minutes)
   - Checks `/health` endpoint

5. **Exit Maintenance Mode**
   - Resumes duel cycles
   - Restarts normal operations

### Deployment Script

The deployment script (`scripts/deploy-vast.sh`) handles:

```bash
#!/bin/bash
set -e

echo "[deploy] Starting Vast.ai deployment..."

# Pull latest code
git fetch origin
git checkout main
git reset --hard origin/main

# Restore DATABASE_URL (git reset overwrites .env)
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL=$DATABASE_URL" >> packages/server/.env
fi

# Setup Solana keypair
if [ -n "$SOLANA_DEPLOYER_PRIVATE_KEY" ]; then
  mkdir -p ~/.config/solana
  bun run packages/server/scripts/decode-key.ts \
    "$SOLANA_DEPLOYER_PRIVATE_KEY" \
    ~/.config/solana/id.json
fi

# Install dependencies
bun install

# Build packages
bun run build

# Restart PM2
pm2 restart ecosystem.config.cjs --update-env
pm2 save

echo "[deploy] Deployment complete!"
```

## Streaming Configuration

### RTMP Destinations

Configure in `packages/server/.env`:

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdef
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

# X/Twitter
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/path

# Kick
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live

# Custom
CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key
```

### Streaming Delay

Configure public streaming delay (for betting fairness):

```bash
# Canonical platform (youtube, twitch, or hls)
STREAMING_CANONICAL_PLATFORM=twitch

# Override default delay (ms)
# Default: youtube=15000, twitch=12000, hls=4000
STREAMING_PUBLIC_DELAY_MS=0  # Set to 0 for live betting
```

### Stream Quality

FFmpeg settings in `ecosystem.config.cjs`:

```javascript
env: {
  // Video encoding
  STREAM_VIDEO_CODEC: 'libx264',
  STREAM_VIDEO_BITRATE: '2500k',
  STREAM_VIDEO_PRESET: 'veryfast',
  STREAM_VIDEO_FPS: '30',
  
  // Audio encoding
  STREAM_AUDIO_CODEC: 'aac',
  STREAM_AUDIO_BITRATE: '128k',
  STREAM_AUDIO_SAMPLE_RATE: '44100',
}
```

## Troubleshooting

### WebGPU Not Available

**Symptoms:**
- Black screen in stream
- "WebGPU not supported" errors in logs

**Solutions:**
1. Ensure Chrome Dev is installed (not stable)
2. Check Vulkan drivers: `vulkaninfo`
3. Verify GPU is accessible: `nvidia-smi`
4. Check Xvfb is running: `ps aux | grep Xvfb`

### Stream Not Appearing

**Check stream keys:**
```bash
# View current environment
pm2 env 0

# Check if keys are set
echo $TWITCH_STREAM_KEY
echo $X_STREAM_KEY
```

**Check FFmpeg process:**
```bash
# View FFmpeg logs
pm2 logs stream-capture

# Check FFmpeg is running
ps aux | grep ffmpeg
```

**Test RTMP connection:**
```bash
# Test Twitch
ffmpeg -re -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -f flv "rtmp://live.twitch.tv/app/$TWITCH_STREAM_KEY"
```

### Database Connection Issues

**Check DATABASE_URL:**
```bash
# View server environment
pm2 env server

# Test connection
psql "$DATABASE_URL" -c "SELECT 1"
```

**Common issues:**
- Firewall blocking port 5432
- Incorrect credentials
- Database not accepting external connections

### High CPU/Memory Usage

**Check resource usage:**
```bash
# Overall system
htop

# Per-process
pm2 monit
```

**Optimize settings:**
```bash
# Reduce stream quality
STREAM_VIDEO_BITRATE=1500k
STREAM_VIDEO_PRESET=ultrafast

# Disable features
SPAWN_MODEL_AGENTS=false
AUTO_START_AGENTS=false
DISABLE_ACTIVITY_LOGGER=true
```

### Deployment Fails

**Check logs:**
```bash
# View deployment logs in GitHub Actions
# Settings → Actions → Deploy to Vast.ai → View logs

# View server logs
pm2 logs server

# View all logs
pm2 logs
```

**Common issues:**
- SSH connection timeout: Check VAST_HOST and VAST_PORT
- Git pull fails: Check repository access
- Build fails: Check disk space (`df -h`)
- PM2 restart fails: Check PM2 status (`pm2 status`)

### Maintenance Mode Stuck

**Check status:**
```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

**Force exit:**
```bash
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

**Restart server:**
```bash
pm2 restart server
```

## Performance Optimization

### GPU Acceleration

Ensure Vulkan is working:
```bash
# Check Vulkan devices
vulkaninfo | grep deviceName

# Test GPU rendering
vkcube
```

### Chrome Flags

Optimize Chrome for headless rendering:
```bash
--disable-gpu-sandbox
--enable-unsafe-webgpu
--use-vulkan
--enable-features=Vulkan
--disable-software-rasterizer
```

### PM2 Configuration

Optimize PM2 settings in `ecosystem.config.cjs`:
```javascript
{
  name: 'server',
  script: 'bun',
  args: 'run start',
  cwd: './packages/server',
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '2G',
  env: {
    NODE_ENV: 'production',
    // ... other env vars
  }
}
```

## Monitoring

### Health Checks

```bash
# Server health
curl https://your-server.com/health

# Maintenance status
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

### PM2 Monitoring

```bash
# Process status
pm2 status

# Real-time monitoring
pm2 monit

# View logs
pm2 logs

# View specific process
pm2 logs server
pm2 logs stream-capture
```

### Resource Monitoring

```bash
# CPU/Memory/GPU
htop

# GPU usage
nvidia-smi

# Disk usage
df -h

# Network usage
iftop
```

## Cost Optimization

### Instance Selection

- **Development**: GTX 1060 (~$0.10/hour)
- **Production**: RTX 3060 (~$0.20/hour)
- **High quality**: RTX 4090 (~$0.50/hour)

### Auto-Shutdown

Configure auto-shutdown when idle:
```bash
# Add to crontab
0 * * * * [ $(pm2 jlist | jq '.[0].pm2_env.status' -r) = "stopped" ] && shutdown -h now
```

### Spot Instances

Use interruptible instances for lower cost:
- Enable "Interruptible" in Vast.ai search
- Implement auto-restart on interruption
- Use PM2 startup script for auto-recovery

## See Also

- [Maintenance Mode API](maintenance-mode-api.md)
- [Streaming Configuration](streaming-configuration.md)
- [WebGPU Requirements](webgpu-requirements.md)
- [CI/CD Improvements](ci-cd-improvements.md)
