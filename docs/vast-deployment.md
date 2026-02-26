# Vast.ai GPU Streaming Deployment

This guide covers deploying Hyperscape's streaming duel system to Vast.ai for GPU-accelerated rendering and multi-platform RTMP streaming.

## Overview

The Vast.ai deployment runs the complete duel stack with:
- Game server + client (headless Chrome with WebGPU)
- RTMP streaming to Twitch, Kick, and X (Twitter)
- Automated maintenance mode for graceful deployments
- Health monitoring and auto-recovery
- PM2 process management with infinite restart

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Vast.ai GPU Instance (Ubuntu + NVIDIA GPU)              │
├─────────────────────────────────────────────────────────┤
│ PM2 (hyperscape-duel)                                   │
│  └─ scripts/duel-stack.mjs                              │
│      ├─ Game Server (port 5555)                         │
│      ├─ Client (headless Chrome Dev + Xvfb)             │
│      ├─ RTMP Bridge (FFmpeg → Twitch/Kick/X)            │
│      └─ Health Monitor (auto-restart on failure)        │
├─────────────────────────────────────────────────────────┤
│ PostgreSQL (external - Neon/Railway)                    │
│ Assets CDN (Cloudflare R2)                              │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

### GitHub Secrets

Configure these in your repository settings (`Settings → Secrets and variables → Actions`):

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP | `123.45.67.89` |
| `VAST_PORT` | SSH port | `22` |
| `VAST_SSH_KEY` | Private SSH key for root access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Base58 Solana keypair | `5JB9hqEzKqCiptLSBi4fHCVPJVb3gpb3AgRyHcJvc4u4...` |
| `TWITCH_STREAM_KEY` | Twitch stream key | `live_123456789_abcdefghij` |
| `X_STREAM_KEY` | X/Twitter stream key | `sp16tpmtyqws` |
| `X_RTMP_URL` | X/Twitter RTMP URL | `rtmp://sg.pscp.tv:80/x` |
| `VAST_SERVER_URL` | (Optional) Server URL for maintenance mode | `https://your-server.com` |
| `ADMIN_CODE` | (Optional) Admin code for maintenance mode | `your-admin-code` |

### Vast.ai Instance Setup

1. **Rent a GPU instance** on [Vast.ai](https://vast.ai):
   - **GPU**: NVIDIA RTX 3060+ (for WebGPU + Vulkan)
   - **RAM**: 16GB+ recommended
   - **Disk**: 50GB+ (for repo + dependencies)
   - **Image**: `nvidia/cuda:12.1.0-devel-ubuntu22.04` or similar

2. **Configure SSH access**:
   - Add your public SSH key to the instance
   - Note the instance IP and SSH port
   - Test connection: `ssh root@<IP> -p <PORT>`

3. **Initial setup** (run once on new instance):
   ```bash
   # Install Bun
   curl -fsSL https://bun.sh/install | bash
   export PATH="/root/.bun/bin:$PATH"
   
   # Clone repository
   cd /root
   git clone https://github.com/HyperscapeAI/hyperscape.git
   cd hyperscape
   
   # Install dependencies
   bun install
   
   # Build project
   bun run build
   ```

## Deployment Workflow

### Automatic Deployment

The deployment runs automatically after CI passes on `main`:

1. **CI passes** → Triggers `deploy-vast.yml` workflow
2. **Enter maintenance mode** (if configured):
   - Pauses new duel cycles
   - Waits for active markets to resolve (up to 5 minutes)
3. **SSH to Vast.ai** and run `scripts/deploy-vast.sh`:
   - Pulls latest code from `main`
   - Writes environment variables to `packages/server/.env`
   - Installs Vulkan drivers (if needed)
   - Restarts PM2 with `ecosystem.config.cjs`
4. **Health check** - Waits for server to be ready (up to 5 minutes)
5. **Exit maintenance mode** - Resumes duel cycles

### Manual Deployment

Trigger manually from GitHub Actions:

1. Go to **Actions** → **Deploy to Vast.ai**
2. Click **Run workflow**
3. Select branch (usually `main`)
4. Click **Run workflow**

Or deploy directly via SSH:

```bash\n# SSH to Vast.ai instance
ssh root@<VAST_HOST> -p <VAST_PORT>

# Run deploy script
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

## Configuration

### ecosystem.config.cjs

PM2 configuration for the duel stack. Key environment variables:

```javascript
env: {
  NODE_ENV: "production",
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://...",
  USE_LOCAL_POSTGRES: "false",
  
  // CDN (required - local /game-assets/ serves Git LFS pointers)
  PUBLIC_CDN_URL: "https://assets.hyperscape.club",
  
  // Solana keypairs (base58 encoded)
  SOLANA_ARENA_AUTHORITY_SECRET: process.env.SOLANA_DEPLOYER_PRIVATE_KEY || "",
  SOLANA_ARENA_REPORTER_SECRET: process.env.SOLANA_DEPLOYER_PRIVATE_KEY || "",
  SOLANA_ARENA_KEEPER_SECRET: process.env.SOLANA_DEPLOYER_PRIVATE_KEY || "",
  
  // Streaming destinations
  TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY || "",
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
  KICK_RTMP_URL: process.env.KICK_RTMP_URL || "rtmps://...",
  X_STREAM_KEY: process.env.X_STREAM_KEY || "",
  X_RTMP_URL: process.env.X_RTMP_URL || "rtmp://sg.pscp.tv:80/x",
  
  // Stream capture (Chrome Dev + Xvfb + Vulkan)
  STREAM_CAPTURE_MODE: "cdp",
  STREAM_CAPTURE_HEADLESS: "false",  // Use Xvfb
  STREAM_CAPTURE_CHANNEL: "chrome-dev",  // google-chrome-unstable
  STREAM_CAPTURE_ANGLE: "vulkan",
  STREAM_CAPTURE_DISABLE_WEBGPU: "false",
  DUEL_CAPTURE_USE_XVFB: "true",
  
  // Streaming timing
  STREAMING_CANONICAL_PLATFORM: "twitch",
  STREAMING_PUBLIC_DELAY_MS: "0",  // No delay for live betting
}
```

### scripts/deploy-vast.sh

The deployment script handles:

1. **Git operations**:
   - Fetches latest code
   - Checks out `main` branch
   - Resets to `origin/main`

2. **Environment persistence**:
   - Writes `DATABASE_URL` to `packages/server/.env` AFTER git reset
   - Prevents environment variables from being overwritten

3. **Solana keypair setup**:
   - Decodes `SOLANA_DEPLOYER_PRIVATE_KEY` from env
   - Writes to `~/.config/solana/id.json`

4. **System dependencies**:
   - Installs Vulkan drivers for GPU rendering
   - Installs Chrome Dev channel for WebGPU support

5. **PM2 restart**:
   - Stops existing processes
   - Starts `ecosystem.config.cjs`
   - Verifies health

## Maintenance Mode

### Purpose

Maintenance mode enables zero-downtime deployments by:
- Pausing new duel cycles before deployment
- Waiting for active markets to resolve
- Preventing data loss or incomplete transactions
- Resuming operations after deployment completes

### API Endpoints

See [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) for full API reference.

**Enter maintenance mode:**
```bash
POST /admin/maintenance/enter
Headers:
  Content-Type: application/json
  x-admin-code: <ADMIN_CODE>
Body:
  {
    "reason": "deployment",
    "timeoutMs": 300000  // 5 minutes
  }
```

**Check status:**
```bash
GET /admin/maintenance/status
Headers:
  x-admin-code: <ADMIN_CODE>
```

**Exit maintenance mode:**
```bash
POST /admin/maintenance/exit
Headers:
  Content-Type: application/json
  x-admin-code: <ADMIN_CODE>
```

### Workflow Integration

The GitHub Actions workflow (`.github/workflows/deploy-vast.yml`) automatically:

1. Enters maintenance mode before deployment
2. Waits for `safeToDeploy: true` (up to 5 minutes)
3. Deploys code via SSH
4. Waits for server health check (up to 5 minutes)
5. Exits maintenance mode

## Stream Capture Configuration

### Chrome Dev Channel

Uses `google-chrome-unstable` for WebGPU support:

```bash
# Installed by deploy-vast.sh
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-unstable
```

Playwright channel mapping: `chrome-dev` → `google-chrome-unstable`

### Xvfb (Virtual Display)

Runs Chrome headful with virtual display for GPU access:

```bash
# Started by duel-stack.mjs
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
```

### Vulkan Backend

Uses Vulkan ANGLE backend for GPU rendering:

```bash
# Environment variable
STREAM_CAPTURE_ANGLE=vulkan

# Requires Vulkan drivers (installed by deploy-vast.sh)
apt-get install -y mesa-vulkan-drivers vulkan-tools
```

## Streaming Destinations

### Twitch

```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
# RTMP URL is hardcoded: rtmp://live.twitch.tv/app
```

Get your stream key from: https://dashboard.twitch.tv/settings/stream

### Kick

```bash
KICK_STREAM_KEY=sk_us-west-2_...
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net
```

Get your stream key from Kick Creator Dashboard.

### X (Twitter)

```bash
X_STREAM_KEY=sp16tpmtyqws
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

Get RTMP URL from: Media Studio → Producer → Create Broadcast → Create Source

**Note**: Requires X Premium subscription for desktop streaming.

## Monitoring

### PM2 Logs

```bash
# SSH to Vast.ai instance
ssh root@<VAST_HOST> -p <VAST_PORT>

# View logs
pm2 logs hyperscape-duel

# View specific log files
tail -f /root/hyperscape/logs/duel-out.log
tail -f /root/hyperscape/logs/duel-error.log
```

### Health Endpoint

```bash
curl https://your-server.com/health
```

Response includes:
- `maintenanceMode`: Current maintenance status
- `uptime`: Server uptime in seconds
- `version`: Git commit hash

### Stream Health

The duel stack includes automatic health monitoring:
- **Recovery timeout**: 30 seconds (configurable via `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS`)
- **Max failures**: 6 consecutive failures before restart (configurable via `STREAM_CAPTURE_RECOVERY_MAX_FAILURES`)
- **Auto-restart**: PM2 restarts the entire stack on critical failures

## Troubleshooting

### Stream not appearing on Twitch/Kick/X

1. **Check stream keys are correct**:
   ```bash
   # SSH to instance
   cat /root/hyperscape/packages/server/.env | grep STREAM_KEY
   ```

2. **Verify FFmpeg is running**:
   ```bash
   ps aux | grep ffmpeg
   ```

3. **Check RTMP connection**:
   ```bash
   # View FFmpeg logs
   pm2 logs hyperscape-duel | grep ffmpeg
   ```

4. **Test stream locally**:
   ```bash
   # From your machine
   ffplay rtmp://localhost:1935/live/test
   ```

### WebGPU not working

1. **Verify Vulkan drivers**:
   ```bash
   vulkaninfo | head -20
   ```

2. **Check Chrome version**:
   ```bash
   google-chrome-unstable --version
   ```

3. **Test WebGPU in Chrome**:
   ```bash
   # Visit chrome://gpu in headful Chrome
   DISPLAY=:99 google-chrome-unstable --no-sandbox chrome://gpu
   ```

### Database connection errors

1. **Verify DATABASE_URL is set**:
   ```bash
   cat /root/hyperscape/packages/server/.env | grep DATABASE_URL
   ```

2. **Test connection**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

### Assets not loading (404 errors)

The server was loading assets from `localhost/game-assets` which served Git LFS pointer files. This is now fixed:

1. **Verify PUBLIC_CDN_URL is set**:
   ```bash
   cat /root/hyperscape/packages/server/.env | grep PUBLIC_CDN_URL
   # Should be: PUBLIC_CDN_URL=https://assets.hyperscape.club
   ```

2. **Test CDN access**:
   ```bash
   curl -I https://assets.hyperscape.club/models/player/human.glb
   # Should return 200 OK
   ```

### PM2 process crash-looping

1. **Check PM2 status**:
   ```bash
   pm2 status
   pm2 logs hyperscape-duel --lines 100
   ```

2. **Check for common issues**:
   - Missing environment variables
   - Database connection failures
   - Port conflicts
   - Out of memory (check `max_memory_restart: "4G"`)

3. **Restart manually**:
   ```bash
   pm2 restart ecosystem.config.cjs
   ```

## GitHub Actions Workflow

### Workflow File

`.github/workflows/deploy-vast.yml`

### Trigger Conditions

- **Automatic**: After CI passes on `main` branch
- **Manual**: `workflow_dispatch` (Run workflow button)

### Workflow Steps

1. **Enter Maintenance Mode** (optional):
   - Skipped if `VAST_SERVER_URL` or `ADMIN_CODE` not configured
   - Pauses new duel cycles
   - Waits for active markets to resolve

2. **SSH and Deploy**:
   - Explicitly checks out `main` branch
   - Resets to `origin/main`
   - Writes environment variables to `packages/server/.env`
   - Runs `scripts/deploy-vast.sh`

3. **Exit Maintenance Mode** (optional):
   - Waits for server health check (up to 5 minutes)
   - Exits maintenance mode
   - Logs success/failure

### Environment Variable Passing

Environment variables are passed through SSH using the `envs` parameter:

```yaml
envs: DATABASE_URL,SOLANA_DEPLOYER_PRIVATE_KEY,TWITCH_STREAM_KEY,X_STREAM_KEY,X_RTMP_URL
```

These are then written to `packages/server/.env` AFTER git reset to prevent overwriting.

## Best Practices

### Security

- **Never commit secrets** to the repository
- Use GitHub Secrets for all sensitive data
- Rotate stream keys regularly
- Use strong `ADMIN_CODE` for maintenance mode API

### Monitoring

- Set up alerts for PM2 crashes (use `ALERT_WEBHOOK_URL` in server `.env`)
- Monitor stream health via Twitch/Kick/X dashboards
- Check server logs regularly for errors

### Deployment Timing

- Deploy during low-traffic periods
- Use maintenance mode for production deployments
- Allow 5-10 minutes for graceful shutdown and restart

### Resource Management

- Monitor GPU memory usage (`nvidia-smi`)
- Check disk space regularly (`df -h`)
- PM2 will restart if memory exceeds 4GB (`max_memory_restart`)

## Advanced Configuration

### Custom Stream Settings

Edit `ecosystem.config.cjs` to customize:

```javascript
// Stream resolution
STREAM_CAPTURE_WIDTH: "1920",
STREAM_CAPTURE_HEIGHT: "1080",

// Recovery settings
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS: "60000",  // 1 minute
STREAM_CAPTURE_RECOVERY_MAX_FAILURES: "10",

// Disable specific platforms
TWITCH_STREAM_KEY: "",  // Disable Twitch
```

### Multiple Instances

To run multiple Vast.ai instances:

1. Create separate GitHub environments (e.g., `vast-1`, `vast-2`)
2. Configure separate secrets for each instance
3. Modify workflow to target specific environment

## Related Documentation

- [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) - Maintenance mode API reference
- [docs/streaming-configuration.md](docs/streaming-configuration.md) - RTMP streaming setup
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - WebGPU requirements
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
