# Vast.ai Deployment Guide

Hyperscape uses Vast.ai for GPU-accelerated streaming and duel arena rendering. This guide covers the automated deployment pipeline with maintenance mode, health checking, and multi-platform RTMP streaming.

## Overview

**Vast.ai** provides GPU instances for:
- WebGPU rendering with Vulkan backend
- Headless browser capture (Chrome Dev + Xvfb)
- Multi-platform RTMP streaming (Twitch, Kick, X)
- Automated duel scheduling and betting integration

**Deployment Architecture:**
- **Trigger**: Automatic on push to `main` (after CI passes) or manual via `workflow_dispatch`
- **Maintenance Mode**: Pauses new duels, waits for markets to resolve before deploying
- **Health Checking**: Waits up to 5 minutes for server to be healthy after restart
- **Process Manager**: PM2 with auto-restart and crash-loop protection

## Prerequisites

### 1. Vast.ai Instance Setup

Rent a GPU instance with:
- **GPU**: NVIDIA GPU with Vulkan support (RTX 3060+ recommended)
- **OS**: Ubuntu 22.04 or newer
- **RAM**: 16GB+ recommended
- **Storage**: 50GB+ for dependencies and assets
- **Ports**: Expose 35143 (HTTP), 35079 (WebSocket), 35144 (CDN)

### 2. GitHub Secrets

Configure these secrets in your repository settings (`Settings` → `Secrets and variables` → `Actions`):

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP address | `123.45.67.89` |
| `VAST_PORT` | SSH port (usually 22) | `22` |
| `VAST_SSH_KEY` | Private SSH key for root access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Base58 Solana keypair | `5JB9hqEzKqCiptLSBi4fHCVPJVb3gpb3AgRyHcJvc4u4...` |
| `VAST_SERVER_URL` | Public server URL (for maintenance API) | `https://your-server.com` |
| `ADMIN_CODE` | Admin code for maintenance API | `your-secure-admin-code` |

### 3. Initial Instance Setup

SSH into your Vast.ai instance and run initial setup:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="/root/.bun/bin:$PATH"

# Clone repository
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Install system dependencies
apt-get update && apt-get install -y \
    build-essential \
    python3 \
    socat \
    xvfb \
    git-lfs \
    ffmpeg \
    wget \
    gnupg \
    curl \
    jq \
    mesa-vulkan-drivers \
    vulkan-tools \
    libvulkan1

# Install Chrome Dev channel (WebGPU support)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update && apt-get install -y google-chrome-unstable

# Install Playwright
bunx playwright install chromium
bunx playwright install-deps chromium

# Create .env file with DATABASE_URL
mkdir -p packages/server
echo "DATABASE_URL=your-postgresql-url" > packages/server/.env

# Initial build
bun install
bun run build
```

## Deployment Workflow

### Automatic Deployment

The `.github/workflows/deploy-vast.yml` workflow runs automatically:

1. **Trigger**: Push to `main` after CI passes
2. **Enter Maintenance Mode**: Pauses new duels, waits for markets to resolve
3. **Deploy**: SSH to Vast.ai, pull latest code, build, restart PM2
4. **Exit Maintenance Mode**: Resumes duel scheduling after health check

### Manual Deployment

Trigger manually from GitHub Actions:

```bash
# Via GitHub UI
Actions → Deploy to Vast.ai → Run workflow → main

# Via GitHub CLI
gh workflow run deploy-vast.yml
```

### Deployment Script

The `scripts/deploy-vast.sh` script handles:

1. **DNS Configuration**: Sets Google DNS (8.8.8.8) for container networking
2. **Code Update**: Pulls latest from `main` branch
3. **DATABASE_URL Restoration**: Writes env var after git reset
4. **System Dependencies**: Installs build tools, Vulkan drivers, Chrome Dev
5. **Solana Keypair Setup**: Decodes `SOLANA_DEPLOYER_PRIVATE_KEY` to `~/.config/solana/id.json`
6. **Build**: Builds physx, decimation, impostors, procgen, asset-forge, shared
7. **Database Migration**: Runs `drizzle-kit push --force`
8. **Process Cleanup**: Stops existing PM2 processes and legacy watchdog scripts
9. **Port Proxies**: Starts socat proxies (internal → external ports)
10. **PM2 Start**: Launches duel stack via `ecosystem.config.cjs`
11. **Health Check**: Waits up to 120s for `/health` endpoint to return 200

## Maintenance Mode API

The maintenance mode system prevents data loss during deployments by coordinating with the streaming duel scheduler and betting markets.

### Endpoints

**Enter Maintenance Mode**
```bash
POST /admin/maintenance/enter
Headers:
  Content-Type: application/json
  x-admin-code: your-admin-code
Body:
  {
    "reason": "deployment",
    "timeoutMs": 300000  # 5 minutes
  }
```

**Exit Maintenance Mode**
```bash
POST /admin/maintenance/exit
Headers:
  Content-Type: application/json
  x-admin-code: your-admin-code
```

**Check Status**
```bash
GET /admin/maintenance/status
Headers:
  x-admin-code: your-admin-code
```

### Response Format

```json
{
  "success": true,
  "status": {
    "active": true,
    "enteredAt": 1709000000000,
    "reason": "deployment",
    "safeToDeploy": true,
    "currentPhase": "IDLE",
    "marketStatus": "resolved",
    "pendingMarkets": 0
  }
}
```

### Safe Deploy Conditions

The system reports `safeToDeploy: true` when:
- No active duel phase (not FIGHTING, COUNTDOWN, or ANNOUNCEMENT)
- All betting markets are resolved
- No pending market settlements

## PM2 Configuration

The `ecosystem.config.cjs` file configures the duel stack process:

```javascript
{
  name: "hyperscape-duel",
  script: "scripts/duel-stack.mjs",
  interpreter: "bun",
  args: "--skip-betting --skip-bots",
  autorestart: true,
  max_restarts: 999999,
  min_uptime: "10s",
  restart_delay: 5000,
  max_memory_restart: "4G"
}
```

**Key Features:**
- **Auto-restart**: Infinite restarts on crash
- **Memory limit**: Restarts if exceeds 4GB
- **Crash-loop protection**: Exponential backoff after 15 rapid restarts
- **Logs**: `logs/duel-error.log` and `logs/duel-out.log`

### PM2 Commands

```bash
# View status
bunx pm2 status

# View logs
bunx pm2 logs hyperscape-duel

# Restart
bunx pm2 restart hyperscape-duel

# Stop
bunx pm2 stop hyperscape-duel

# Delete from PM2
bunx pm2 delete hyperscape-duel
```

## Port Mapping

Vast.ai instances use socat to proxy internal ports to external:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | Game Server HTTP |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | Asset CDN |

**Why socat?** Vast.ai doesn't support direct port mapping, so we use socat TCP proxies.

## Streaming Configuration

### Supported Platforms

The deployment configures RTMP streaming to:
- **Twitch**: Primary platform (12s delay for anti-cheat)
- **Kick**: RTMPS endpoint
- **X (Twitter)**: RTMP endpoint

YouTube was removed (not needed for current use case).

### Environment Variables

Set these in `ecosystem.config.cjs` or as GitHub secrets:

```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij

# Kick (uses RTMPS)
KICK_STREAM_KEY=sk_us-west-2_...
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net

# X/Twitter
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Anti-cheat timing
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0  # Set to 0 for live betting
```

### Stream Capture Settings

```bash
# Use CDP mode for reliable frame capture
STREAM_CAPTURE_MODE=cdp

# Run headful with Xvfb for GPU access
STREAM_CAPTURE_HEADLESS=false
DUEL_CAPTURE_USE_XVFB=true

# Use Chrome Dev channel for WebGPU
STREAM_CAPTURE_CHANNEL=chrome-dev

# Use Vulkan ANGLE backend for GPU rendering
STREAM_CAPTURE_ANGLE=vulkan

# Resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Enable WebGPU (required for TSL shaders)
STREAM_CAPTURE_DISABLE_WEBGPU=false
```

## Solana Keypair Setup

The deployment script automatically sets up Solana keypairs from environment variables.

### How It Works

1. **GitHub Secret**: Set `SOLANA_DEPLOYER_PRIVATE_KEY` (base58 private key)
2. **Deploy Script**: Runs `bun run scripts/decode-key.ts`
3. **Output**: Writes keypair to `~/.config/solana/id.json`
4. **Usage**: Used by Anchor tools and keeper bot

### Manual Setup

If you need to set up keypairs manually:

```bash
# Decode base58 private key to JSON keypair
bun run scripts/decode-key.ts

# Verify keypair
solana-keygen pubkey ~/.config/solana/id.json
```

## Health Checking

The deployment script waits for the server to be healthy before exiting maintenance mode.

### Health Check Logic

```bash
# Check internal health endpoint
curl -s http://localhost:5555/health

# Expected response (HTTP 200)
{
  "status": "ok",
  "uptime": 12345,
  "maintenanceMode": false
}
```

**Timeout**: 120 seconds (24 attempts × 5s intervals)

**Failure Handling**: If health check times out, deployment continues but logs a warning. Check PM2 logs for errors.

## Troubleshooting

### Deployment Fails at Build Step

**Symptom**: `bun run build` fails during deployment

**Solutions**:
```bash
# SSH to instance
ssh root@your-vast-ip

# Check build logs
cd /root/hyperscape
bunx pm2 logs hyperscape-duel --lines 200

# Manual build
bun install
bun run build
```

### Server Not Healthy After Deployment

**Symptom**: Health check times out, server doesn't respond

**Solutions**:
```bash
# Check PM2 status
bunx pm2 status

# View logs
bunx pm2 logs hyperscape-duel

# Check if ports are listening
netstat -tlnp | grep -E '(5555|3333|8080)'

# Restart manually
bunx pm2 restart hyperscape-duel
```

### DATABASE_URL Not Persisting

**Symptom**: Server crashes with "DATABASE_URL not set" after deployment

**Cause**: Git reset overwrites `.env` file

**Solution**: The deploy script now writes `DATABASE_URL` **after** git reset. Verify:
```bash
cat /root/hyperscape/packages/server/.env
# Should contain: DATABASE_URL=postgresql://...
```

### Streaming Not Working

**Symptom**: Stream shows black screen or doesn't start

**Solutions**:
```bash
# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check Chrome Dev
google-chrome-unstable --version

# Check Xvfb
ps aux | grep Xvfb

# View streaming diagnostics
curl http://localhost:5555/api/streaming/state
```

### Memory Leaks / High Memory Usage

**Symptom**: PM2 restarts process due to exceeding 4GB limit

**Solutions**:
```bash
# Check memory usage
bunx pm2 status

# Increase memory limit in ecosystem.config.cjs
max_memory_restart: "8G"

# Enable memory profiling
MALLOC_TRIM_THRESHOLD_=-1
MIMALLOC_ALLOW_DECOMMIT=0
```

## Manual Maintenance Mode

You can manually enter/exit maintenance mode for deployments:

```bash
# Enter maintenance mode
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# Check status
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"

# Exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

## Monitoring

### View Live Logs

```bash
# SSH to instance
ssh root@your-vast-ip

# Tail PM2 logs
bunx pm2 logs hyperscape-duel --lines 100

# Check streaming state
curl http://localhost:5555/api/streaming/state | jq
```

### Check Process Status

```bash
# PM2 status
bunx pm2 status

# Port proxies
ps aux | grep socat

# Xvfb display
ps aux | grep Xvfb
```

## Advanced Configuration

### Custom Stream Destinations

Edit `ecosystem.config.cjs` to add custom RTMP destinations:

```javascript
env: {
  // Add custom destination
  CUSTOM_RTMP_NAME: "MyPlatform",
  CUSTOM_RTMP_URL: "rtmp://your-server/live",
  CUSTOM_STREAM_KEY: "your-key"
}
```

### Adjust Health Check Timeout

Edit `.github/workflows/deploy-vast.yml`:

```yaml
# Wait up to 10 minutes instead of 5
for i in {1..60}; do  # was {1..30}
  # ... health check logic
  sleep 10
done
```

### Skip Maintenance Mode

For emergency deployments, skip maintenance mode:

```yaml
# In deploy-vast.yml, comment out maintenance steps
# - name: Enter Maintenance Mode
#   continue-on-error: true
#   ...
```

## See Also

- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Maintenance mode API reference
- [docs/streaming-configuration.md](streaming-configuration.md) - RTMP streaming setup
- [packages/server/.env.example](../packages/server/.env.example) - Full environment variable reference
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
