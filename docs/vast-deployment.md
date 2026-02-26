# Vast.ai Deployment Guide

Hyperscape uses Vast.ai for GPU-accelerated streaming and duel arena hosting. This guide covers setup, deployment, and maintenance.

## Overview

Vast.ai provides on-demand GPU instances for:
- **WebGPU rendering** - Hardware-accelerated 3D graphics
- **RTMP streaming** - Multi-platform broadcasting (Twitch, Kick, X)
- **Duel arena** - Automated AI vs AI combat streaming
- **Headless capture** - Chrome Dev + Xvfb for reliable frame capture

## Prerequisites

- Vast.ai account with GPU instance provisioned
- SSH access to your Vast.ai instance
- GitHub repository secrets configured (see below)

## Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

### SSH Access
- `VAST_HOST` - Your Vast.ai instance IP address
- `VAST_PORT` - SSH port (usually 22 or custom)
- `VAST_SSH_KEY` - Private SSH key for authentication

### Database
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:password@host:port/database`)

### Maintenance Mode (Optional)
- `VAST_SERVER_URL` - Public URL of your deployed server (e.g., `https://your-instance.vast.ai`)
- `ADMIN_CODE` - Admin authentication code for maintenance API

### Streaming Keys (Optional)
- `TWITCH_STREAM_KEY` - From [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream)
- `KICK_STREAM_KEY` - From Kick Creator Dashboard
- `X_STREAM_KEY` - From X Media Studio

## Deployment Process

### Automatic Deployment

Pushes to `main` branch trigger automatic deployment via `.github/workflows/deploy-vast.yml`:

1. **Enter Maintenance Mode** - Pauses new duel cycles, waits for active markets to resolve
2. **SSH Deploy** - Pulls latest code, builds, restarts PM2
3. **Exit Maintenance Mode** - Resumes normal operations

### Manual Deployment

SSH into your Vast.ai instance and run:

```bash
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

The deploy script:
1. Pulls latest code from `main` branch
2. Installs system dependencies (Vulkan drivers, Chrome Dev, FFmpeg)
3. Installs Node dependencies
4. Builds core packages (physx, procgen, shared, asset-forge)
5. Runs database migrations
6. Restarts PM2 process manager

## Configuration

### Environment Variables

The deployment uses `ecosystem.config.cjs` for PM2 configuration. Key environment variables:

#### Database
```bash
DATABASE_URL=postgresql://user:password@host:port/database
USE_LOCAL_POSTGRES=false
```

#### Streaming
```bash
STREAMING_DUEL_ENABLED=true
STREAMING_CANONICAL_PLATFORM=twitch
STREAMING_PUBLIC_DELAY_MS=0

# Platform keys
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=sk_...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
```

#### Capture Settings
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CAPTURE_HEADLESS=false
STREAM_CAPTURE_CHANNEL=chrome-dev
STREAM_CAPTURE_ANGLE=vulkan
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
STREAM_CAPTURE_DISABLE_WEBGPU=false
DUEL_CAPTURE_USE_XVFB=true
```

#### Resource Limits
```bash
# PM2 auto-restart if memory exceeds 4GB
max_memory_restart=4G

# Crash-loop protection
max_restarts=999999
min_uptime=10s
restart_delay=5000
```

### Port Mapping

Vast.ai instances use `socat` to proxy internal ports to external:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | HTTP API |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

## Maintenance Mode API

Graceful deployments use the maintenance mode API to prevent market disruption.

### Enter Maintenance Mode

```bash
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: YOUR_ADMIN_CODE" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'
```

Response:
```json
{
  "success": true,
  "status": {
    "maintenanceMode": true,
    "safeToDeploy": true,
    "currentPhase": "idle",
    "pendingMarkets": 0
  }
}
```

### Check Status

```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

### Exit Maintenance Mode

```bash
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

## Monitoring

### View Logs

```bash
# SSH into instance
ssh root@your-instance.vast.ai

# View PM2 logs
bunx pm2 logs hyperscape-duel

# View specific log files
tail -f /root/hyperscape/logs/duel-out.log
tail -f /root/hyperscape/logs/duel-error.log
```

### Check Process Status

```bash
bunx pm2 status
bunx pm2 describe hyperscape-duel
```

### Health Check

```bash
curl http://localhost:5555/health
```

Response includes maintenance mode status:
```json
{
  "status": "ok",
  "uptime": 12345,
  "maintenanceMode": false
}
```

## Troubleshooting

### Deployment Fails

**Check logs:**
```bash
bunx pm2 logs hyperscape-duel --lines 100
```

**Common issues:**
- DATABASE_URL not set → Check `/root/hyperscape/packages/server/.env`
- Build failures → Check system dependencies installed
- Port conflicts → Restart socat proxies

### Stream Not Starting

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

### Database Connection Issues

**Verify DATABASE_URL:**
```bash
cat /root/hyperscape/packages/server/.env
```

**Test connection:**
```bash
cd /root/hyperscape/packages/server
bunx drizzle-kit push --force
```

### Memory Issues

PM2 automatically restarts if memory exceeds 4GB. Check memory usage:

```bash
bunx pm2 describe hyperscape-duel | grep memory
```

Adjust `max_memory_restart` in `ecosystem.config.cjs` if needed.

## Manual Operations

### Restart Stack

```bash
bunx pm2 restart ecosystem.config.cjs
```

### Stop Stack

```bash
bunx pm2 stop ecosystem.config.cjs
```

### Delete from PM2

```bash
bunx pm2 delete ecosystem.config.cjs
```

### Rebuild from Scratch

```bash
cd /root/hyperscape
git pull origin main
bun install
bun run build
bunx pm2 restart ecosystem.config.cjs
```

## Performance Tuning

### Reduce Memory Usage

Edit `ecosystem.config.cjs`:

```javascript
env: {
  // Disable features for lower memory footprint
  AUTO_START_AGENTS_MAX: "5",  // Reduce from 10
  STREAMING_DUEL_COMBAT_AI_ENABLED: "false",
  
  // Memory allocator tuning
  MALLOC_TRIM_THRESHOLD_: "-1",
  MIMALLOC_ALLOW_DECOMMIT: "0",
  MIMALLOC_PURGE_DELAY: "1000000",
}
```

### Optimize Stream Quality

```javascript
env: {
  STREAM_CAPTURE_WIDTH: "1280",   // Lower from 1920
  STREAM_CAPTURE_HEIGHT: "720",   // Lower from 1080
}
```

## Security Notes

- **Never commit secrets** to git
- **DATABASE_URL** is written to `.env` after git operations to prevent overwriting
- **ADMIN_CODE** gates maintenance mode API access
- **Solana keypairs** in `ecosystem.config.cjs` are for devnet only (replace for mainnet)

## Related Documentation

- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Maintenance mode API reference
- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway deployment
- [docs/webgpu-requirements.md](webgpu-requirements.md) - WebGPU browser requirements
