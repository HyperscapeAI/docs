# PM2 Deployment Guide

This guide covers PM2-based deployment for Hyperscape, including secrets management, database mode detection, and streaming configuration.

## Overview

Hyperscape uses PM2 for production process management on Vast.ai and other GPU servers. The deployment system includes:
- Automatic secrets loading from `/tmp/hyperscape-secrets.env`
- Database mode auto-detection (local vs remote)
- Xvfb virtual display for WebGPU streaming
- Chrome Beta for stable streaming capture
- Multi-platform RTMP streaming with auto-detection

## Quick Start

### Deploy to Vast.ai

```bash
# On Vast.ai instance
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

This script:
1. Pulls latest code from `origin/main`
2. Installs system dependencies (Chrome Beta, FFmpeg, Xvfb)
3. Loads secrets from `/tmp/hyperscape-secrets.env`
4. Auto-detects database mode from `DATABASE_URL`
5. Builds core packages
6. Applies database migrations
7. Starts Xvfb virtual display
8. Launches duel stack via PM2

### PM2 Commands

```bash
# View process status
bunx pm2 status

# View logs
bunx pm2 logs hyperscape-duel

# Restart stack
bunx pm2 restart hyperscape-duel

# Stop stack
bunx pm2 stop hyperscape-duel

# Delete from PM2
bunx pm2 delete hyperscape-duel
```

## Secrets Management

### Secrets File Format

PM2 loads secrets from `/tmp/hyperscape-secrets.env` at config load time:

```bash
# /tmp/hyperscape-secrets.env
DATABASE_URL=postgresql://user:pass@host:5432/db
ELIZAOS_CLOUD_API_KEY=your-elizacloud-key
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-key
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
```

### Why Direct File Loading?

**Problem**: `bunx pm2` doesn't reliably inherit exported environment variables from the deploy shell script.

**Solution**: `ecosystem.config.cjs` reads the secrets file directly at config load time:

```javascript
const fs = require("fs");
const SECRETS_FILES = [
  "/tmp/hyperscape-secrets.env",
  require("path").join(__dirname, ".env.production"),
];

for (const secretsPath of SECRETS_FILES) {
  if (fs.existsSync(secretsPath)) {
    const lines = fs.readFileSync(secretsPath, "utf-8").split("\n");
    for (const line of lines) {
      // Parse and load into process.env
    }
  }
}
```

### Creating Secrets File

**GitHub Actions** (`.github/workflows/deploy-vast.yml`):
```yaml
- name: Create secrets file
  run: |
    cat > /tmp/hyperscape-secrets.env << 'EOF'
    DATABASE_URL=${{ secrets.DATABASE_URL }}
    ELIZAOS_CLOUD_API_KEY=${{ secrets.ELIZAOS_CLOUD_API_KEY }}
    TWITCH_STREAM_KEY=${{ secrets.TWITCH_STREAM_KEY }}
    TWITCH_RTMP_STREAM_KEY=${{ secrets.TWITCH_STREAM_KEY }}
    KICK_STREAM_KEY=${{ secrets.KICK_STREAM_KEY }}
    EOF
```

**Manual Deployment**:
```bash
# SSH into server
ssh root@your-vast-instance

# Create secrets file
cat > /tmp/hyperscape-secrets.env << 'EOF'
DATABASE_URL=postgresql://...
ELIZAOS_CLOUD_API_KEY=...
TWITCH_STREAM_KEY=...
EOF

# Deploy
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

## Database Mode Auto-Detection

### How It Works

The deployment system automatically detects whether to use local or remote PostgreSQL:

```javascript
// ecosystem.config.cjs
if (!process.env.DUEL_DATABASE_MODE && process.env.DATABASE_URL) {
  const dbHost = new URL(process.env.DATABASE_URL).hostname;
  const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(dbHost);
  process.env.DUEL_DATABASE_MODE = isLocal ? "local" : "remote";
}
```

### Local Mode

**Triggers**:
- `DATABASE_URL` contains `localhost`, `127.0.0.1`, `0.0.0.0`, or `::1`
- OR `DUEL_DATABASE_MODE=local` explicitly set

**Behavior**:
- Starts local PostgreSQL via `pg_ctlcluster`
- Creates database and user if needed
- Sets `USE_LOCAL_POSTGRES=true`

### Remote Mode

**Triggers**:
- `DATABASE_URL` contains any other hostname
- OR `DUEL_DATABASE_MODE=remote` explicitly set

**Behavior**:
- Uses external PostgreSQL (Neon, Railway, etc.)
- Skips local PostgreSQL setup
- Sets `USE_LOCAL_POSTGRES=false`

### Manual Override

```bash
# Force remote mode even with localhost URL
export DUEL_DATABASE_MODE=remote

# Force local mode even with remote URL
export DUEL_DATABASE_MODE=local
```

## PostgreSQL Connection Pool

### Configuration

```javascript
// ecosystem.config.cjs
env: {
  POSTGRES_POOL_MAX: "20",  // Increased from 10 (March 2026)
  POSTGRES_POOL_MIN: "2",
}
```

### Why 20 Connections?

- **Concurrent Agents**: Up to 10 AI agents querying database simultaneously
- **Bank Queries**: Each agent can make 5 concurrent bank queries
- **Server Queries**: Game server needs connections for player data
- **Headroom**: Extra capacity for spikes and migrations

### Tuning

If you see "timeout exceeded when trying to connect" errors:

```bash
# Increase pool size
export POSTGRES_POOL_MAX=30

# Increase timeout
export POSTGRES_POOL_TIMEOUT_MS=90000
```

## Xvfb Virtual Display

### Why Xvfb?

WebGPU requires a window context, even on headless servers. Xvfb provides a virtual X11 display.

### Startup Order

**Critical**: Xvfb must start BEFORE PM2:

```bash
# deploy-vast.sh
echo "[deploy] Starting Xvfb virtual display..."
pkill -f "Xvfb :99" || true
sleep 1
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
echo "[deploy] Xvfb started on DISPLAY=$DISPLAY"

# Then start PM2
bunx pm2 start ecosystem.config.cjs --update-env
```

### PM2 Environment

`ecosystem.config.cjs` explicitly forwards `DISPLAY`:

```javascript
env: {
  DISPLAY: process.env.DISPLAY || ":99",
  // ... other vars
}
```

### Troubleshooting

**Error**: `cannot open display`

**Solution**:
```bash
# Check if Xvfb is running
ps aux | grep Xvfb

# Restart Xvfb
pkill -f "Xvfb :99"
Xvfb :99 -screen 0 1280x720x24 &

# Verify DISPLAY
echo $DISPLAY  # Should output :99

# Restart PM2
bunx pm2 restart hyperscape-duel
```

## Chrome Beta Streaming

### Why Chrome Beta?

- **Stability**: More stable than Dev/Canary channels
- **WebGPU Support**: Full WebGPU support with ANGLE backend
- **Compatibility**: Better driver compatibility than native Vulkan

### Installation

```bash
# deploy-vast.sh
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update && apt-get install -y google-chrome-beta
```

### Configuration

```javascript
// ecosystem.config.cjs
env: {
  STREAM_CAPTURE_CHANNEL: "chrome-beta",
  STREAM_CAPTURE_ANGLE: "default",  // Auto-select best backend
  STREAM_CAPTURE_WIDTH: "1280",
  STREAM_CAPTURE_HEIGHT: "720",
}
```

### ANGLE Backend Selection

**Default** (Recommended):
- Automatically selects best backend for the system
- Tries Vulkan → OpenGL → D3D11 in order
- Most compatible across different GPUs

**Vulkan** (Legacy):
- Native Vulkan backend
- Can crash on incompatible drivers
- Not recommended for production

## RTMP Streaming

### Auto-Detection

Stream destinations are auto-detected from available keys:

```bash
# deploy-vast.sh
DESTS=""
if [ -n "${TWITCH_STREAM_KEY:-${TWITCH_RTMP_STREAM_KEY:-}}" ]; then
    DESTS="twitch"
fi
if [ -n "${KICK_STREAM_KEY:-}" ]; then
    DESTS="${DESTS:+${DESTS},}kick"
fi
export STREAM_ENABLED_DESTINATIONS="$DESTS"
```

### Supported Platforms

| Platform | Key Variable | URL Variable |
|----------|--------------|--------------|
| Twitch | `TWITCH_STREAM_KEY` or `TWITCH_RTMP_STREAM_KEY` | `TWITCH_STREAM_URL` (default: `rtmp://live.twitch.tv/app`) |
| Kick | `KICK_STREAM_KEY` | `KICK_RTMP_URL` (default: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`) |
| YouTube | `YOUTUBE_STREAM_KEY` or `YOUTUBE_RTMP_STREAM_KEY` | `YOUTUBE_STREAM_URL` (default: `rtmp://a.rtmp.youtube.com/live2`) |

### Manual Configuration

```bash
# Override auto-detection
export STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube

# Or disable streaming
export STREAM_ENABLED_DESTINATIONS=
```

## Health Checks

### Local Services

The deploy script waits for services to become healthy:

```bash
# Server health
curl -fsS http://127.0.0.1:5555/health

# Streaming state
curl -fsS http://127.0.0.1:5555/api/streaming/state

# CDN health (if using local CDN)
curl -fsS http://127.0.0.1:8080/health
```

### PM2 Status

```bash
# Check process status
bunx pm2 status

# Expected output:
# ┌─────┬──────────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ mode    │ ↺       │ status  │ cpu      │
# ├─────┼──────────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ hyperscape-duel  │ fork    │ 0       │ online  │ 45%      │
# └─────┴──────────────────┴─────────┴─────────┴─────────┴──────────┘
```

## Port Proxying

Vast.ai requires port proxying for external access:

```bash
# deploy-vast.sh
# Game server: internal 5555 -> external 35143
nohup socat TCP-LISTEN:35143,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &

# WebSocket: internal 5555 -> external 35079
nohup socat TCP-LISTEN:35079,reuseaddr,fork TCP:127.0.0.1:5555 > /dev/null 2>&1 &

# CDN: internal 8080 -> external 35144
nohup socat TCP-LISTEN:35144,reuseaddr,fork TCP:127.0.0.1:8080 > /dev/null 2>&1 &
```

## Logs

### PM2 Logs

```bash
# Tail all logs
bunx pm2 logs hyperscape-duel

# Tail error logs only
bunx pm2 logs hyperscape-duel --err

# Tail output logs only
bunx pm2 logs hyperscape-duel --out

# View last 200 lines
bunx pm2 logs hyperscape-duel --lines 200
```

### Log Files

```bash
# Error log
tail -f logs/duel-error.log

# Output log
tail -f logs/duel-out.log
```

## Troubleshooting

### Server Crashes on Startup

**Check logs**:
```bash
bunx pm2 logs hyperscape-duel --lines 500
tail -n 200 logs/duel-error.log
```

**Common causes**:
- Missing `DATABASE_URL` → Check `/tmp/hyperscape-secrets.env`
- Database connection timeout → Increase `POSTGRES_POOL_MAX`
- WebGPU initialization failed → Check GPU driver and Xvfb

### Streaming Not Starting

**Check streaming state**:
```bash
curl http://127.0.0.1:5555/api/streaming/state
```

**Common causes**:
- Missing stream keys → Check `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`
- Xvfb not running → `ps aux | grep Xvfb`
- Chrome Beta not installed → `google-chrome-beta --version`
- DISPLAY not set → `echo $DISPLAY` (should be `:99`)

### Database Connection Errors

**Error**: `timeout exceeded when trying to connect`

**Solutions**:
1. Increase connection pool:
   ```bash
   export POSTGRES_POOL_MAX=30
   ```

2. Check database is accessible:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

3. Verify connection string:
   ```bash
   echo $DATABASE_URL
   ```

### PM2 Not Forwarding Environment Variables

**Problem**: Environment variables set in shell are not available to PM2 processes.

**Solution**: Use `/tmp/hyperscape-secrets.env` instead of shell exports:

```bash
# ❌ Don't rely on shell exports
export DATABASE_URL=postgresql://...
bunx pm2 start ecosystem.config.cjs

# ✅ Use secrets file
cat > /tmp/hyperscape-secrets.env << 'EOF'
DATABASE_URL=postgresql://...
EOF
bunx pm2 start ecosystem.config.cjs
```

## Advanced Configuration

### Custom Database Mode

```bash
# Force remote mode
export DUEL_DATABASE_MODE=remote

# Force local mode
export DUEL_DATABASE_MODE=local
```

### Custom Streaming Configuration

```bash
# Use different Chrome channel
export STREAM_CAPTURE_CHANNEL=chrome-dev

# Use specific ANGLE backend
export STREAM_CAPTURE_ANGLE=vulkan  # or opengl, d3d11

# Custom resolution
export STREAM_CAPTURE_WIDTH=1920
export STREAM_CAPTURE_HEIGHT=1080
```

### Custom Xvfb Display

```bash
# Use different display number
export DISPLAY=:100

# Start Xvfb on custom display
Xvfb :100 -screen 0 1920x1080x24 &
```

## Monitoring

### Process Health

```bash
# Check if process is running
bunx pm2 status | grep hyperscape-duel

# Check uptime
bunx pm2 show hyperscape-duel | grep uptime

# Check memory usage
bunx pm2 show hyperscape-duel | grep memory
```

### Service Health

```bash
# Server health
curl http://127.0.0.1:5555/health

# Streaming state
curl http://127.0.0.1:5555/api/streaming/state

# Duel context
curl http://127.0.0.1:5555/api/streaming/duel-context
```

### Auto-Restart Configuration

```javascript
// ecosystem.config.cjs
{
  autorestart: true,
  max_restarts: 999999,
  min_uptime: "10s",
  restart_delay: 10000,
  exp_backoff_restart_delay: 2000,
  max_memory_restart: "4G",
}
```

## Deployment Checklist

- [ ] Secrets file created at `/tmp/hyperscape-secrets.env`
- [ ] `DATABASE_URL` set (local or remote)
- [ ] Stream keys set (if streaming enabled)
- [ ] Chrome Beta installed
- [ ] FFmpeg installed
- [ ] Xvfb running on `:99`
- [ ] GPU display driver active (`gpu_display_active=true` on Vast.ai)
- [ ] Port proxies configured (35143, 35079, 35144)
- [ ] PM2 process started
- [ ] Health checks passing

## Related Files

- `ecosystem.config.cjs` - PM2 configuration
- `scripts/deploy-vast.sh` - Deployment script
- `.github/workflows/deploy-vast.yml` - CI/CD workflow
- `packages/server/.env.example` - Environment variable documentation
- `docs/duel-stack.md` - Duel stack documentation
