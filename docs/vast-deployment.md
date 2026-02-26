# Vast.ai Deployment

Hyperscape supports automated deployment to [Vast.ai](https://vast.ai) GPU instances for production streaming and duel arena hosting. This deployment target is optimized for cost-effective GPU rendering with WebGPU support.

## Overview

The Vast.ai deployment provides:

- **Automated CI/CD**: Deploys automatically when CI passes on `main` branch
- **Maintenance Mode**: Graceful deployments with zero-downtime market resolution
- **GPU Rendering**: WebGPU-accelerated 3D rendering with Vulkan drivers
- **Health Monitoring**: Automatic health checks and recovery
- **PM2 Process Management**: Self-healing process supervision with automatic restarts

## Architecture

```
GitHub Actions (deploy-vast.yml)
    ↓
SSH to Vast.ai Instance
    ↓
deploy-vast.sh Script
    ↓
PM2 Ecosystem (ecosystem.config.cjs)
    ↓
Duel Stack (scripts/duel-stack.mjs)
    ├── Game Server (port 5555)
    ├── Stream Capture (Chrome + FFmpeg)
    └── RTMP Bridge (multi-platform streaming)
```

## Prerequisites

### 1. Vast.ai Instance Setup

Rent a GPU instance on Vast.ai with:

- **GPU**: NVIDIA GPU with Vulkan support (RTX 3060+ recommended)
- **OS**: Ubuntu 22.04 or later
- **RAM**: 16GB+ recommended
- **Storage**: 50GB+ SSD
- **Ports**: Open ports 35143 (HTTP), 35079 (WebSocket), 35144 (CDN)

### 2. GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `VAST_HOST` | Vast.ai instance IP address | `123.45.67.89` |
| `VAST_PORT` | SSH port (usually 22) | `22` |
| `VAST_SSH_KEY` | Private SSH key for authentication | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `VAST_SERVER_URL` | Public URL for health checks | `http://123.45.67.89:35143` |
| `ADMIN_CODE` | Admin code for maintenance mode API | `your-secret-admin-code` |

### 3. Initial Instance Setup

SSH into your Vast.ai instance and run initial setup:

```bash
# Clone repository
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="/root/.bun/bin:$PATH"

# Run initial deployment
bash scripts/deploy-vast.sh
```

## Deployment Process

### Automatic Deployment

Deployments trigger automatically when:

1. Code is pushed to `main` branch
2. CI workflow passes successfully
3. `deploy-vast.yml` workflow executes

The deployment follows this sequence:

1. **Enter Maintenance Mode** - Pauses new duel cycles, waits for active markets to resolve
2. **Deploy Code** - Pulls latest code, builds packages, migrates database
3. **Restart Services** - Restarts PM2-managed processes
4. **Health Check** - Waits for server to become healthy
5. **Exit Maintenance Mode** - Resumes normal operations

### Manual Deployment

To deploy manually via GitHub Actions:

1. Go to Actions → Deploy to Vast.ai
2. Click "Run workflow"
3. Select `main` branch
4. Click "Run workflow"

Or SSH directly to the instance:

```bash
ssh root@<VAST_IP>
cd /root/hyperscape
bash scripts/deploy-vast.sh
```

## Configuration

### Environment Variables

The deployment uses environment variables from:

1. `/root/hyperscape/packages/server/.env` (created by deploy script)
2. GitHub Secrets (passed via workflow)
3. `ecosystem.config.cjs` defaults

Key variables set by deployment:

```bash
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/hyperscape

# Streaming destinations
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=sk_...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# Solana keypairs (base58 encoded)
SOLANA_ARENA_AUTHORITY_SECRET=...
SOLANA_ARENA_REPORTER_SECRET=...
SOLANA_ARENA_KEEPER_SECRET=...
```

### Port Mapping

Vast.ai instances use `socat` to proxy internal ports to external ports:

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | Game Server HTTP |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

Access your deployment at: `http://<VAST_IP>:35143`

### PM2 Configuration

The deployment uses PM2 for process management with:

- **Auto-restart**: Restarts on crash (up to 999,999 times)
- **Memory limit**: Restarts if memory exceeds 4GB
- **Crash protection**: Exponential backoff after 15 rapid restarts
- **Logging**: Logs to `/root/hyperscape/logs/`

View PM2 status:

```bash
bunx pm2 status
bunx pm2 logs hyperscape-duel
bunx pm2 restart hyperscape-duel
```

## Maintenance Mode

The deployment uses maintenance mode for graceful updates:

### What Maintenance Mode Does

1. **Pauses new duel cycles** - No new duels start
2. **Waits for active markets** - Existing duels complete normally
3. **Timeout protection** - Force-proceeds after 5 minutes if markets don't resolve

### Maintenance Mode API

```bash
# Enter maintenance mode
curl -X POST http://<VAST_IP>:35143/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: YOUR_ADMIN_CODE" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'

# Check status
curl http://<VAST_IP>:35143/admin/maintenance/status \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Exit maintenance mode
curl -X POST http://<VAST_IP>:35143/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

See [docs/maintenance-mode-api.md](./maintenance-mode-api.md) for full API documentation.

## Troubleshooting

### Deployment Fails

Check GitHub Actions logs:

1. Go to Actions → Deploy to Vast.ai
2. Click the failed workflow run
3. Expand the failed step to see error details

Common issues:

- **SSH connection failed**: Check `VAST_HOST`, `VAST_PORT`, and `VAST_SSH_KEY` secrets
- **Database connection failed**: Verify `DATABASE_URL` secret is set correctly
- **Build errors**: Check if dependencies are installed (`bun install`)

### Server Not Healthy After Deployment

SSH to the instance and check logs:

```bash
ssh root@<VAST_IP>
cd /root/hyperscape
bunx pm2 logs hyperscape-duel --lines 100
```

Common issues:

- **Database migration failed**: Check `DATABASE_URL` is accessible
- **WebGPU initialization failed**: Verify Vulkan drivers are installed
- **Port conflicts**: Check if ports 5555, 8080 are available

### Stream Not Working

Check stream capture logs:

```bash
bunx pm2 logs hyperscape-duel | grep -i "stream\|ffmpeg\|capture"
```

Common issues:

- **Chrome not found**: Verify `google-chrome-unstable` is installed
- **WebGPU unavailable**: Check Vulkan drivers with `vulkaninfo --summary`
- **RTMP connection failed**: Verify stream keys and URLs are correct

### Memory Issues

If the server restarts frequently due to memory:

```bash
# Check current memory usage
bunx pm2 status

# Increase memory limit in ecosystem.config.cjs
# Change: max_memory_restart: "4G" to "8G"

# Restart PM2
bunx pm2 restart ecosystem.config.cjs
```

### GPU Not Detected

Verify GPU and Vulkan support:

```bash
# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Reinstall Vulkan drivers if needed
apt-get update
apt-get install -y mesa-vulkan-drivers vulkan-tools libvulkan1
```

## Monitoring

### Health Endpoint

Check server health:

```bash
curl http://<VAST_IP>:35143/health
```

Response includes:

```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "abc123",
  "maintenance": {
    "active": false,
    "reason": null
  }
}
```

### PM2 Monitoring

```bash
# Process status
bunx pm2 status

# Live logs
bunx pm2 logs hyperscape-duel

# Resource usage
bunx pm2 monit

# Restart count
bunx pm2 show hyperscape-duel
```

### Stream Health

Monitor stream health via logs:

```bash
bunx pm2 logs hyperscape-duel | grep -i "stream health\|ffmpeg\|rtmp"
```

## Cost Optimization

### Instance Selection

- **Development**: RTX 3060 (6GB VRAM) - $0.10-0.20/hour
- **Production**: RTX 3080 (10GB VRAM) - $0.20-0.40/hour
- **High-end**: RTX 4090 (24GB VRAM) - $0.50-1.00/hour

### Resource Tuning

Reduce costs by disabling unused features in `ecosystem.config.cjs`:

```javascript
env: {
  // Disable AI agents if not needed
  AUTO_START_AGENTS: "false",
  
  // Reduce stream quality
  STREAM_CAPTURE_WIDTH: "1280",  // or 854 for lower quality
  STREAM_CAPTURE_HEIGHT: "720",  // or 480 for lower quality
  
  // Disable unused streaming destinations
  // (comment out KICK_STREAM_KEY, X_STREAM_KEY, etc.)
}
```

## Comparison with Other Deployment Targets

| Feature | Vast.ai | Railway | Cloudflare Pages |
|---------|---------|---------|------------------|
| **GPU Support** | ✅ Native | ❌ No | ❌ No |
| **WebGPU** | ✅ Yes | ❌ No | ✅ Yes (client-side) |
| **Cost** | $0.10-1.00/hr | $5-20/mo | Free (bandwidth limits) |
| **Auto-scaling** | ❌ Manual | ✅ Yes | ✅ Yes |
| **Best For** | Streaming, GPU rendering | Game server, API | Static client hosting |

## Related Documentation

- [Maintenance Mode API](./maintenance-mode-api.md) - Graceful deployment API
- [WebGPU Requirements](./webgpu-requirements.md) - Browser and GPU requirements
- [Railway Deployment](./railway-dev-prod.md) - Alternative deployment target
- [Duel Stack](./duel-stack.md) - Duel system architecture
