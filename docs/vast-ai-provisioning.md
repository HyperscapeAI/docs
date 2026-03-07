# Vast.ai Provisioning and Monitoring

Hyperscape provides automated tools for provisioning and monitoring GPU instances on Vast.ai for WebGPU streaming deployments.

## Overview

Vast.ai is a GPU marketplace that provides affordable NVIDIA GPUs for cloud computing. Hyperscape's streaming pipeline requires specific GPU configurations to support WebGPU rendering.

**Key Requirement**: Instances MUST have `gpu_display_active=true` to support WebGPU. This ensures the GPU has display driver support, not just compute access.

## Automated Provisioning

### Vast.ai Provisioner Script

The provisioner script (`./scripts/vast-provision.sh`) automatically searches for and rents WebGPU-capable instances.

**Usage:**
```bash
VAST_API_KEY=xxx bun run vast:provision
```

**What it does:**
1. Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
2. Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr)
3. Rents the best available instance
4. Waits for instance to be ready
5. Outputs SSH connection details and GitHub secret commands
6. Saves configuration to `/tmp/vast-instance-config.env`

**Requirements:**
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

### Search Criteria

The provisioner uses the following filters:

| Filter | Value | Rationale |
|--------|-------|-----------|
| `gpu_display_active` | `true` | REQUIRED for WebGPU display driver support |
| `reliability` | ≥95% | Minimize downtime and connection issues |
| `gpu_ram` | ≥20GB | Sufficient VRAM for WebGPU rendering |
| `disk_space` | ≥120GB | Room for builds, assets, and logs |
| `dph_total` | ≤$2/hr | Cost control |

### Output

After successful provisioning, the script outputs:

```bash
✅ Instance 12345678 is ready!

SSH Connection:
  ssh root@ssh4.vast.ai -p 12345 -L 5555:localhost:5555

GitHub Secrets (add to repository settings):
  VAST_SSH_HOST=ssh4.vast.ai
  VAST_SSH_PORT=12345
  VAST_SSH_USER=root
  VAST_INSTANCE_ID=12345678

Configuration saved to: /tmp/vast-instance-config.env
```

## Vast.ai Commands

### Search for Instances

Search for WebGPU-capable instances without renting:

```bash
VAST_API_KEY=xxx bun run vast:search
```

This displays available instances matching the search criteria.

### Check Instance Status

Check the status of your current instance:

```bash
VAST_API_KEY=xxx bun run vast:status
```

Output includes:
- Instance ID
- Status (running, stopped, etc.)
- GPU model and VRAM
- Disk space
- Price per hour
- Uptime

### Destroy Instance

Destroy your current instance to stop billing:

```bash
VAST_API_KEY=xxx bun run vast:destroy
```

**Warning**: This permanently deletes the instance and all data. Make sure to backup any important data first.

### Vast-Keeper Monitoring Service

Run the vast-keeper monitoring service to automatically manage instances:

```bash
VAST_API_KEY=xxx bun run vast:keeper
```

The keeper service:
- Monitors instance health
- Automatically restarts failed instances
- Sends alerts on critical failures
- Manages instance lifecycle

## Streaming Health Monitoring

### Quick Status Check

Check streaming health on a running Vast.ai instance:

```bash
bun run duel:status
```

This checks:
- Server health endpoint
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs

**Example Output:**
```
✅ Server Health: OK (200)
✅ Streaming API: OK
✅ Duel Context: FIGHTING (Agent1 vs Agent2)
✅ RTMP Bridge: Active (1.2 GB streamed)
✅ PM2 Processes: 2 running
📋 Recent Logs:
  [2026-03-07 10:30:15] Combat tick processed
  [2026-03-07 10:30:16] Frame captured (1920x1080)
  [2026-03-07 10:30:17] RTMP packet sent (15.2 KB)
```

### Detailed Diagnostics

For more detailed diagnostics, SSH into the instance and check:

**GPU Status:**
```bash
nvidia-smi
```

Should show display mode (not just compute):
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 525.60.13    Driver Version: 525.60.13    CUDA Version: 12.0     |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|                               |                      |               MIG M. |
|===============================+======================+======================|
|   0  NVIDIA RTX 3090    Off  | 00000000:01:00.0  On |                  N/A |
| 30%   45C    P2    75W / 350W |   8192MiB / 24576MiB |     15%      Default |
|                               |                      |                  N/A |
+-------------------------------+----------------------+----------------------+
```

Note the `Disp.A` column shows `On` - this indicates display driver is active.

**WebGPU Initialization:**
```bash
# Check deployment logs for WebGPU test results
cat /var/log/deploy-vast.log | grep "WebGPU"
```

Should show successful WebGPU initialization:
```
[INFO] WebGPU preflight test: PASSED
[INFO] navigator.gpu: available
[INFO] Adapter: NVIDIA RTX 3090
[INFO] Backend: Vulkan
```

**PM2 Processes:**
```bash
pm2 status
```

Should show all processes running:
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┬────────┬──────┐
│ id  │ name             │ mode    │ ↺       │ status   │ cpu    │ mem  │
├─────┼──────────────────┼─────────┼─────────┼──────────┼────────┼──────┤
│ 0   │ hyperscape-duel  │ fork    │ 0       │ online   │ 45%    │ 2.1G │
│ 1   │ rtmp-bridge      │ fork    │ 0       │ online   │ 12%    │ 512M │
└─────┴──────────────────┴─────────┴─────────┴──────────┴────────┴──────┘
```

## Deployment Validation

The deployment script (`scripts/deploy-vast.sh`) performs extensive validation:

### GPU Display Driver Check

**Early validation:**
```bash
# Check nvidia_drm kernel module
lsmod | grep nvidia_drm

# Check DRM device nodes
ls -la /dev/dri/

# Query GPU display mode
nvidia-smi --query-gpu=display_mode --format=csv,noheader
```

If any check fails, deployment aborts with guidance to rent instances with `gpu_display_active=true`.

### WebGPU Pre-Check Tests

The deployment runs 6 WebGPU tests with different Chrome configurations:

1. **Headless Vulkan**: `--headless=new --use-vulkan --use-angle=vulkan`
2. **Headless EGL**: `--headless=new --use-gl=egl`
3. **Xvfb Vulkan**: Non-headless Chrome with Xvfb display
4. **Ozone Headless**: `--ozone-platform=headless`
5. **SwiftShader**: Software Vulkan fallback
6. **Playwright Xvfb**: Playwright-managed browser with Xvfb

The first successful configuration is used for streaming.

### Vulkan ICD Verification

**Check Vulkan ICD availability:**
```bash
ls -la /usr/share/vulkan/icd.d/nvidia_icd.json
cat /usr/share/vulkan/icd.d/nvidia_icd.json
```

**Expected output:**
```json
{
    "file_format_version": "1.0.0",
    "ICD": {
        "library_path": "libGLX_nvidia.so.0",
        "api_version": "1.3.0"
    }
}
```

### Display Server Verification

**Check X server:**
```bash
# Socket check (more reliable than xdpyinfo)
ls -la /tmp/.X11-unix/X99

# DISPLAY environment variable
echo $DISPLAY
```

**Expected:**
- Socket exists: `/tmp/.X11-unix/X99`
- DISPLAY set: `:99` or `:99.0`

## Troubleshooting

### WebGPU Not Initializing

**Symptom**: Deployment fails with "WebGPU initialization failed"

**Causes:**
1. Instance doesn't have `gpu_display_active=true`
2. NVIDIA display driver not installed
3. Vulkan ICD not configured
4. X server not running

**Solutions:**

1. **Use the provisioner** (ensures correct instance type):
   ```bash
   VAST_API_KEY=xxx bun run vast:provision
   ```

2. **Verify GPU display driver**:
   ```bash
   nvidia-smi --query-gpu=display_mode --format=csv,noheader
   ```
   
   Should output `Enabled` or `Enabled, Validated`

3. **Check Vulkan ICD**:
   ```bash
   VK_LOADER_DEBUG=all vulkaninfo 2>&1 | head -50
   ```
   
   Should show NVIDIA ICD loading successfully

4. **Verify X server**:
   ```bash
   ls -la /tmp/.X11-unix/X99
   echo $DISPLAY
   ```

### Browser Timeout During Page Load

**Symptom**: Browser times out (180s limit) when loading game page

**Cause**: Vite dev server JIT compilation is too slow for WebGPU shader compilation

**Solution**: Use production client build:
```bash
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

This serves pre-built client via `vite preview` instead of dev server, significantly faster page loads.

### Stream Disconnects After 30 Minutes

**Symptom**: Twitch/YouTube disconnects stream after 30 minutes of idle content

**Cause**: Streaming platforms disconnect streams that appear "idle"

**Solution**: Enable placeholder frame mode:
```bash
STREAM_PLACEHOLDER_ENABLED=true
```

This sends minimal JPEG frames during idle periods to keep the stream alive.

### Database Connection Errors

**Symptom**: "too many clients already" errors during crash loops

**Cause**: PostgreSQL connection pool exhaustion

**Solution**: Reduce connection pool size:
```bash
POSTGRES_POOL_MAX=3              # Down from default 6
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also increase PM2 restart delay in `ecosystem.config.cjs`:
```javascript
restart_delay: 10000,            // 10s instead of 5s
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

## Environment Variables

### Required for Vast.ai Deployment

```bash
# GPU Display Driver (CRITICAL)
# Instances must have gpu_display_active=true

# Database Configuration (for crash loop resilience)
POSTGRES_POOL_MAX=3              # Prevent connection exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections

# Model Agent Spawning
SPAWN_MODEL_AGENTS=true          # Auto-create agents when database is empty

# Stream Keep-Alive
STREAM_PLACEHOLDER_ENABLED=true  # Prevent 30-minute disconnects

# Production Client Build
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

### Optional Configuration

```bash
# Stream Capture
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
STREAM_LOW_LATENCY=true          # Use zerolatency tune
STREAM_GOP_SIZE=60               # GOP size in frames

# Audio Capture
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

## Deployment Workflow

### 1. Provision Instance

```bash
VAST_API_KEY=xxx bun run vast:provision
```

### 2. Configure GitHub Secrets

Add the output secrets to your GitHub repository:

- `VAST_SSH_HOST`
- `VAST_SSH_PORT`
- `VAST_SSH_USER`
- `VAST_INSTANCE_ID`

### 3. Deploy via GitHub Actions

The `.github/workflows/deploy-vast.yml` workflow automatically:
1. Connects to the instance via SSH
2. Pulls latest code from main branch
3. Runs deployment script (`scripts/deploy-vast.sh`)
4. Validates WebGPU initialization
5. Starts PM2 processes
6. Verifies streaming health

### 4. Monitor Deployment

Check streaming health:
```bash
bun run duel:status
```

Or SSH into the instance:
```bash
ssh root@ssh4.vast.ai -p 12345
pm2 logs hyperscape-duel
```

### 5. Graceful Restart (Zero-Downtime Updates)

Request a restart after the current duel ends:
```bash
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

The server waits for the duel RESOLUTION phase before restarting, ensuring no interruption to active duels or streams.

## Cost Optimization

### Instance Selection

The provisioner automatically selects the cheapest instance that meets requirements:

**Typical costs** (as of March 2026):
- RTX 3090 (24GB): $0.30-0.50/hr
- RTX 4090 (24GB): $0.50-0.80/hr
- A6000 (48GB): $0.80-1.20/hr

**Cost control:**
- Maximum price: $2/hr (configurable in script)
- Automatic selection of cheapest qualifying instance
- Destroy instances when not in use

### Billing

Vast.ai bills by the hour. To minimize costs:

1. **Destroy instances when not streaming:**
   ```bash
   VAST_API_KEY=xxx bun run vast:destroy
   ```

2. **Use spot instances** (cheaper but can be interrupted)

3. **Monitor usage** with `bun run vast:status`

## Advanced Configuration

### Custom Search Criteria

Edit `scripts/vast-provision.sh` to customize search criteria:

```bash
# Increase GPU RAM requirement
MIN_GPU_RAM=40  # Default: 20

# Increase reliability requirement
MIN_RELIABILITY=98  # Default: 95

# Adjust price limit
MAX_PRICE=1.50  # Default: 2.00

# Increase disk space
MIN_DISK_SPACE=200  # Default: 120
```

### Manual Instance Selection

If you prefer to manually select an instance:

1. **Search for instances:**
   ```bash
   vastai search offers 'gpu_display_active=true reliability>=0.95 gpu_ram>=20 disk_space>=120 dph_total<=2'
   ```

2. **Rent specific instance:**
   ```bash
   vastai create instance <instance_id> --image nvidia/cuda:12.0.0-devel-ubuntu22.04 --disk 120
   ```

3. **Get SSH details:**
   ```bash
   vastai show instance <instance_id>
   ```

## Related Documentation

- **AGENTS.md**: Vast.ai Deployment Architecture section
- **docs/duel-stack.md**: Duel stack deployment guide
- **scripts/deploy-vast.sh**: Deployment script source code
- **scripts/check-streaming-status.sh**: Health check script

## Commit History

Vast.ai provisioner was introduced in commit `8591248d` (March 1, 2026):

> fix(vast): require gpu_display_active=true for WebGPU streaming
>
> WebGPU requires GPU display driver support, not just compute.
> This was causing deployment failures because Xorg/Xvfb couldn't
> start without proper display driver access.
>
> Changes:
> - vast-keeper: Add gpu_display_active=true to search query (CRITICAL)
> - vast-keeper: Add CLI commands (provision, status, search, destroy)
> - deploy-vast.yml: Add preflight check for GPU display support
> - deploy-vast.yml: Add force_deploy input to override GPU check
> - vast-provision.sh: Update disk size to 120GB
> - package.json: Add vast:* convenience scripts
