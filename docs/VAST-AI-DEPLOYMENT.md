# Vast.ai GPU Streaming Deployment Guide

Complete guide for deploying Hyperscape GPU streaming to Vast.ai with WebGPU rendering.

## Overview

Hyperscape streams live gameplay to Twitch, Kick, and X/Twitter using GPU-accelerated WebGPU rendering. This guide covers the complete deployment process for Vast.ai GPU instances.

## Requirements

### Hardware
- **NVIDIA GPU** with Vulkan support (RTX 3060 or better recommended)
- **8GB+ VRAM** for WebGPU rendering
- **16GB+ RAM** for Chrome, FFmpeg, and game server
- **50GB+ storage** for Docker images and game assets

### Software
- **Ubuntu 22.04** or newer
- **NVIDIA drivers** 525+ with Vulkan support
- **Docker** for PostgreSQL
- **Xorg or Xvfb** display server (headless NOT supported)
- **PulseAudio** for audio capture
- **FFmpeg** with H.264 encoding support
- **Chrome Dev channel** with WebGPU enabled

## Architecture

### Rendering Pipeline

```
Chrome (WebGPU) → CDP Screencast → FFmpeg (H.264) → RTMP Tee → Twitch/Kick/X
                                                              ↓
                                                         PulseAudio (Audio)
```

### GPU Rendering Modes

The deployment script tries these modes in order:

1. **Xorg with NVIDIA** (preferred):
   - Direct GPU access via DRI/DRM devices
   - Best performance and compatibility
   - Requires `/dev/dri/card0` access

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer for X11 protocol
   - Chrome uses GPU via ANGLE/Vulkan
   - Works without DRM device access

3. **Ozone Headless with GPU** (experimental):
   - Wayland-like headless rendering
   - May work when X11/Xvfb fails
   - Requires GPU sandbox bypass

4. **Headless mode**: NOT SUPPORTED
   - WebGPU requires display server
   - Deployment FAILS if no GPU mode works

## Deployment Steps

### 1. Create Vast.ai Instance

**Recommended specs:**
- GPU: RTX 3060 or better
- RAM: 16GB+
- Storage: 50GB+
- Image: Ubuntu 22.04 with NVIDIA drivers

**Template:**
```bash
# Search for instances
vast search offers 'gpu_name=RTX 3060 gpu_ram>=8 ram>=16 disk_space>=50'

# Create instance
vast create instance <offer_id> --image nvidia/cuda:12.0.0-devel-ubuntu22.04
```

### 2. Configure GitHub Secrets

Set these secrets in your GitHub repository (Settings → Secrets → Actions):

**Required:**
- `VAST_HOST` - Instance IP address
- `VAST_PORT` - SSH port (usually 22)
- `VAST_SSH_KEY` - Private SSH key for authentication
- `DATABASE_URL` - PostgreSQL connection string
- `TWITCH_STREAM_KEY` - Twitch stream key
- `KICK_STREAM_KEY` - Kick stream key
- `KICK_RTMP_URL` - Kick RTMP URL
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X/Twitter RTMP URL
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana keypair (base58)

**Optional:**
- `JWT_SECRET` - JWT signing secret
- `ARENA_EXTERNAL_BET_WRITE_KEY` - Arena betting API key

### 3. Deploy via GitHub Actions

**Automatic deployment:**
```bash
# Push to main branch
git push origin main

# GitHub Actions will:
# 1. SSH into Vast.ai instance
# 2. Clone/update repository
# 3. Run scripts/deploy-vast.sh
# 4. Start PM2 with ecosystem.config.cjs
```

**Manual deployment:**
```bash
# SSH into instance
ssh -p <port> root@<host>

# Clone repository
cd /root
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape

# Run deployment script
./scripts/deploy-vast.sh
```

### 4. Verify Deployment

**Check GPU access:**
```bash
nvidia-smi
# Should show GPU info (name, memory, driver version)

vulkaninfo --summary
# Should show Vulkan support
```

**Check display server:**
```bash
echo $DISPLAY
# Should be :99 (Xvfb) or :0 (Xorg)

xdpyinfo -display $DISPLAY
# Should show display info (screen dimensions, etc.)
```

**Check PulseAudio:**
```bash
pulseaudio --check
# Should exit silently if running

pactl list short sinks
# Should show chrome_audio sink
```

**Check PM2:**
```bash
pm2 status
# Should show hyperscape-duel running

pm2 logs hyperscape-duel --lines 50
# Should show startup logs
```

**Check WebGPU:**
```bash
pm2 logs hyperscape-duel --lines 500 | grep -A 20 "GPU Diagnostics"
# Should show:
# ✅ WebGPU Status: Hardware accelerated
# ✅ Vulkan Support: true
# ✅ HW Acceleration: true
```

**Check RTMP status:**
```bash
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
# Should show active streams to Twitch, Kick, X
```

## Configuration

### Environment Variables

The deployment script auto-configures these variables in `.env`:

**GPU Configuration:**
```bash
DISPLAY=:99                                              # X display
GPU_RENDERING_MODE=xorg                                  # xorg, xvfb-vulkan, ozone-headless
DUEL_CAPTURE_USE_XVFB=false                             # true for Xvfb, false for Xorg
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json # Force NVIDIA Vulkan
```

**Browser Configuration:**
```bash
STREAM_CAPTURE_CHANNEL=chrome-dev                        # Playwright channel
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable # Chrome path
STREAM_CAPTURE_HEADLESS=false                            # Always false
STREAM_CAPTURE_USE_EGL=false                             # Always false
STREAM_CAPTURE_OZONE_HEADLESS=false                      # Experimental mode
```

**Stream Configuration:**
```bash
STREAM_CAPTURE_MODE=cdp                                  # cdp, webcodecs, mediarecorder
STREAM_CAPTURE_WIDTH=1280                                # Stream width
STREAM_CAPTURE_HEIGHT=720                                # Stream height
STREAM_FPS=30                                            # Target FPS
STREAM_CDP_QUALITY=80                                    # JPEG quality
STREAM_LOW_LATENCY=false                                 # false = film, true = zerolatency
STREAM_GOP_SIZE=60                                       # Keyframe interval
```

**Audio Configuration:**
```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
PULSE_SINK=chrome_audio
```

**Production Client:**
```bash
DUEL_USE_PRODUCTION_CLIENT=true                          # Pre-built client for faster loads
```

**Stream Destinations:**
```bash
TWITCH_STREAM_KEY=live_...                               # From GitHub Secrets
KICK_STREAM_KEY=...                                      # From GitHub Secrets
KICK_RTMP_URL=rtmps://...                                # From GitHub Secrets
X_STREAM_KEY=...                                         # From GitHub Secrets
X_RTMP_URL=rtmp://...                                    # From GitHub Secrets
YOUTUBE_STREAM_KEY=""                                    # Explicitly disabled
```

### PM2 Configuration

**ecosystem.config.cjs** is pre-configured with optimal settings:
- Auto-restart on crash
- Memory limit: 4GB
- Crash-loop protection
- Log rotation
- Environment variable passthrough

**Commands:**
```bash
pm2 start ecosystem.config.cjs          # Start
pm2 restart ecosystem.config.cjs        # Restart
pm2 stop ecosystem.config.cjs           # Stop
pm2 delete ecosystem.config.cjs         # Remove
pm2 logs hyperscape-duel                # View logs
pm2 logs hyperscape-duel --lines 200    # Last 200 lines
```

## Monitoring

### Health Checks

**RTMP Status:**
```bash
# Check stream status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Expected output:
{
  "active": true,
  "destinations": [
    {"name": "Twitch", "connected": true},
    {"name": "Kick", "connected": true},
    {"name": "X", "connected": true}
  ],
  "stats": {
    "bytesReceived": 123456789,
    "uptimeSeconds": 3600,
    "healthy": true
  }
}
```

**PM2 Status:**
```bash
pm2 status
# Should show:
# hyperscape-duel | online | 0 | 0s | 0 | 500 MB

pm2 monit
# Real-time monitoring (CPU, memory, logs)
```

**GPU Usage:**
```bash
nvidia-smi
# Check GPU utilization (should be 30-50% during streaming)

watch -n 1 nvidia-smi
# Real-time GPU monitoring
```

**Stream Health:**
```bash
# Check logs for stream health
pm2 logs hyperscape-duel --lines 50 | grep "Stream Health"

# Expected output:
# [Stream Health] CDP FPS: 30 | Resolution: 1280x720 | Frames: 12345 | Dropped: 0
```

### Alerts

**Webhook alerts** (optional):
```bash
# Set in .env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Alerts trigger on:
- Server crash
- Database connection failure
- RTMP stream failure
- WebGPU initialization failure

## Troubleshooting

### WebGPU Initialization Failed

**Symptoms:**
- Black frames in stream
- Browser hangs on page load
- "WebGPU preflight FAILED" in logs

**Diagnosis:**
```bash
# Check GPU access
nvidia-smi
# Should show GPU info

# Check Vulkan
vulkaninfo --summary
# Should show Vulkan support

# Check Vulkan ICD
cat /usr/share/vulkan/icd.d/nvidia_icd.json
# Should exist and contain NVIDIA driver path

# Check display server
xdpyinfo -display $DISPLAY
# Should show display info

# Check WebGPU diagnostics
pm2 logs hyperscape-duel --lines 500 | grep -A 20 "GPU Diagnostics"
# Should show "WebGPU Status: Hardware accelerated"
```

**Solutions:**
1. **Update NVIDIA drivers**:
   ```bash
   apt update
   apt install nvidia-driver-535  # Or latest version
   reboot
   ```

2. **Reinstall Vulkan ICD**:
   ```bash
   apt install nvidia-vulkan-icd
   ```

3. **Restart display server**:
   ```bash
   # For Xvfb
   killall Xvfb
   Xvfb :99 -screen 0 1280x720x24 &
   
   # For Xorg
   killall Xorg
   # Xorg will restart automatically
   ```

4. **Re-run deployment**:
   ```bash
   ./scripts/deploy-vast.sh
   ```

### Browser Timeout on Page Load

**Symptoms:**
- "Navigation timeout" in logs
- Page takes >180s to load
- Stream never starts

**Cause**: Vite dev server JIT compilation is too slow for streaming.

**Solution**: Use production client build:
```bash
# Set in .env
DUEL_USE_PRODUCTION_CLIENT=true

# Restart PM2
pm2 restart ecosystem.config.cjs
```

### Resolution Mismatch

**Symptoms:**
- Stream shows wrong resolution
- "Resolution mismatch" warnings in logs
- Viewport size doesn't match stream dimensions

**Diagnosis:**
```bash
pm2 logs hyperscape-duel --lines 100 | grep "Resolution"
# Look for: "Resolution mismatch: got 1920x1080, expected 1280x720"
```

**Solution**: Auto-recovery is enabled. Wait for viewport restoration:
```bash
# Monitor logs for recovery
pm2 logs hyperscape-duel --lines 50 | grep "Viewport"
# Should show: "Viewport resized to 1280x720"
```

If auto-recovery fails:
```bash
# Restart PM2
pm2 restart ecosystem.config.cjs
```

### No Audio in Stream

**Symptoms:**
- Video works but no audio
- FFmpeg shows audio stream as silent

**Diagnosis:**
```bash
# Check PulseAudio
pulseaudio --check
# Should exit silently if running

# Check sinks
pactl list short sinks
# Should show chrome_audio sink

# Check audio device
pactl list short sources
# Should show chrome_audio.monitor source
```

**Solutions:**
1. **Restart PulseAudio**:
   ```bash
   pulseaudio --kill
   pulseaudio --start --daemonize=no --exit-idle-time=-1 &
   ```

2. **Recreate audio sink**:
   ```bash
   pactl load-module module-null-sink sink_name=chrome_audio sink_properties=device.description="Chrome_Audio"
   ```

3. **Verify environment**:
   ```bash
   echo $XDG_RUNTIME_DIR
   # Should be /tmp/pulse-runtime
   
   echo $PULSE_SERVER
   # Should be unix:/tmp/pulse-runtime/pulse/native
   ```

4. **Restart PM2**:
   ```bash
   pm2 restart ecosystem.config.cjs
   ```

### CDP Capture Stalls

**Symptoms:**
- Stream freezes
- "CDP capture stalled" in logs
- No traffic for 30+ seconds

**Diagnosis:**
```bash
pm2 logs hyperscape-duel --lines 100 | grep "CDP"
# Look for: "CDP capture stalled (4 intervals without traffic)"
```

**Automatic Recovery:**
- **Soft recovery**: Restart CDP screencast (~2-3s, no gap)
- **Hard recovery**: Full browser restart (~10-15s, visible gap)
- **Fallback**: Switch to MediaRecorder after max failures

**Manual Recovery:**
```bash
# Restart PM2
pm2 restart ecosystem.config.cjs
```

### RTMP Connection Failed

**Symptoms:**
- "RTMP connection failed" in logs
- Stream not visible on platform
- FFmpeg errors

**Diagnosis:**
```bash
# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check FFmpeg logs
pm2 logs hyperscape-duel --lines 200 | grep "FFmpeg"
```

**Solutions:**
1. **Verify stream keys**:
   ```bash
   # Check environment variables
   echo $TWITCH_STREAM_KEY
   echo $KICK_STREAM_KEY
   echo $X_STREAM_KEY
   ```

2. **Test RTMP connection**:
   ```bash
   # Test Twitch
   ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
     -c:v libx264 -preset veryfast -b:v 3000k \
     -f flv "rtmp://live.twitch.tv/app/$TWITCH_STREAM_KEY"
   ```

3. **Check firewall**:
   ```bash
   # Ensure RTMP ports are open (1935, 443)
   ufw status
   ```

4. **Restart PM2**:
   ```bash
   pm2 restart ecosystem.config.cjs
   ```

### High Memory Usage

**Symptoms:**
- PM2 restarts due to memory limit
- "max_memory_restart" in logs
- System OOM killer

**Diagnosis:**
```bash
# Check memory usage
pm2 status
# Look at memory column

# Check system memory
free -h
```

**Solutions:**
1. **Increase memory limit**:
   ```javascript
   // ecosystem.config.cjs
   max_memory_restart: "6G",  // Increase from 4G
   ```

2. **Enable memory trimming**:
   ```bash
   # Set in .env
   MALLOC_TRIM_THRESHOLD_=-1
   MIMALLOC_ALLOW_DECOMMIT=0
   ```

3. **Reduce stream quality**:
   ```bash
   # Set in .env
   STREAM_CAPTURE_WIDTH=1280
   STREAM_CAPTURE_HEIGHT=720
   STREAM_CDP_QUALITY=70  # Reduce from 80
   ```

4. **Restart browser periodically**:
   - Automatic browser rotation every 1 hour (built-in)
   - Clears WebGPU memory leaks

## Performance Tuning

### Low Latency Streaming

For faster playback start (higher bitrate):
```bash
# Set in .env
STREAM_LOW_LATENCY=true
STREAM_GOP_SIZE=30  # Reduce from 60
```

### High Quality Streaming

For better compression (slower playback start):
```bash
# Set in .env
STREAM_LOW_LATENCY=false
STREAM_GOP_SIZE=60
STREAM_CDP_QUALITY=90  # Increase from 80
```

### Stability Tuning

For more stable streaming (slower recovery):
```bash
# Set in .env
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=45000  # Increase from 30000
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=8    # Increase from 6
```

### CPU Optimization

For lower CPU usage:
```bash
# Set in .env
STREAM_FPS=24  # Reduce from 30
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

## Monitoring

### Real-Time Monitoring

**PM2 Dashboard:**
```bash
pm2 monit
# Shows CPU, memory, logs in real-time
```

**GPU Monitoring:**
```bash
watch -n 1 nvidia-smi
# Real-time GPU usage
```

**Stream Health:**
```bash
# Tail logs
pm2 logs hyperscape-duel --lines 0

# Look for:
# [Stream Health] CDP FPS: 30 | Resolution: 1280x720 | Frames: 12345
# [Status] Destinations: Twitch: OK, Kick: OK, X: OK
```

### Log Analysis

**WebGPU Diagnostics:**
```bash
pm2 logs hyperscape-duel --lines 500 | grep -A 20 "GPU Diagnostics"
```

**Stream Status:**
```bash
pm2 logs hyperscape-duel --lines 100 | grep "Status"
```

**Errors:**
```bash
pm2 logs hyperscape-duel --err --lines 100
```

**Recovery Events:**
```bash
pm2 logs hyperscape-duel --lines 200 | grep -E "(recovery|Recovery|RECOVERY)"
```

## Maintenance

### Update Deployment

**Via GitHub Actions:**
```bash
# Push to main branch
git push origin main
# Automatic deployment via .github/workflows/deploy-vast.yml
```

**Manual update:**
```bash
ssh -p <port> root@<host>
cd /root/hyperscape
git pull
./scripts/deploy-vast.sh
```

### Restart Services

**Restart PM2:**
```bash
pm2 restart ecosystem.config.cjs
```

**Restart display server:**
```bash
# Xvfb
killall Xvfb
Xvfb :99 -screen 0 1280x720x24 &

# Xorg
killall Xorg
# Xorg restarts automatically
```

**Restart PulseAudio:**
```bash
pulseaudio --kill
pulseaudio --start --daemonize=no --exit-idle-time=-1 &
```

### Clean Up

**Clear logs:**
```bash
pm2 flush
```

**Clear cache:**
```bash
rm -rf /root/hyperscape/packages/server/public/live/*.ts
rm -rf /root/hyperscape/packages/server/public/live/*.m3u8
```

**Reset database:**
```bash
# WARNING: Deletes all data
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data
```

## Security

### SSH Access

**Use SSH keys** (not passwords):
```bash
# Generate key
ssh-keygen -t ed25519 -C "vast-deployment"

# Add to GitHub Secrets
# VAST_SSH_KEY = <private key content>

# Add public key to Vast.ai instance
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

### Stream Keys

**NEVER commit stream keys** to repository:
- Set via GitHub Secrets
- Store in `.env` file (gitignored)
- Rotate keys regularly

**Verify secrets:**
```bash
# Check environment (should show masked values)
pm2 env 0 | grep STREAM_KEY
```

### Firewall

**Open required ports:**
```bash
# RTMP (outbound)
ufw allow out 1935/tcp
ufw allow out 443/tcp

# SSH (inbound)
ufw allow 22/tcp

# Game server (inbound, if exposing)
ufw allow 5555/tcp
```

## Cost Optimization

### Instance Selection

**Recommended specs:**
- RTX 3060: ~$0.20/hour
- RTX 3070: ~$0.25/hour
- RTX 3080: ~$0.30/hour

**Cost-saving tips:**
- Use spot instances (cheaper but can be interrupted)
- Stop instance when not streaming
- Use lower resolution (720p vs 1080p)

### Resource Usage

**Typical usage:**
- CPU: 15-25%
- GPU: 30-50%
- RAM: 2-3GB
- Network: 5-10 Mbps upload

## Advanced Configuration

### Custom Chrome Executable

```bash
# Set in .env
STREAM_CAPTURE_EXECUTABLE=/path/to/custom/chrome
```

### Custom RTMP Destinations

```bash
# Set in .env
RTMP_DESTINATIONS_JSON='[{"name":"Custom","url":"rtmp://host/live","key":"key","enabled":true}]'
```

### WebCodecs Mode (Experimental)

```bash
# Set in .env
STREAM_CAPTURE_MODE=webcodecs
```

**Benefits:**
- Native browser encoding
- FFmpeg stream copy (no re-encoding)
- Lower CPU usage

**Limitations:**
- Experimental API
- May not work on all GPUs
- Falls back to CDP if initialization fails

### Ozone Headless Mode (Experimental)

```bash
# Set in .env
STREAM_CAPTURE_OZONE_HEADLESS=true
```

**Benefits:**
- GPU rendering without X11
- May work when Xorg/Xvfb fails

**Limitations:**
- Experimental
- Requires GPU sandbox bypass
- Not all GPUs support it

## Support

- **Deployment Issues**: Check `scripts/deploy-vast.sh` logs
- **Streaming Issues**: See [AGENTS.md](../AGENTS.md) for architecture details
- **WebGPU Issues**: See [WEBGPU-MIGRATION.md](WEBGPU-MIGRATION.md) for migration guide
- **Bug Reports**: [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)

## Related Documentation

- [AGENTS.md](../AGENTS.md) - GPU streaming architecture
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [WEBGPU-MIGRATION.md](WEBGPU-MIGRATION.md) - WebGPU migration guide
- [packages/server/README.md](../packages/server/README.md) - Server configuration
- [.env.example](../.env.example) - Environment variables reference

## Related Commits

- `47782ed` - Enforce WebGPU-only mode
- `ff45217` - Add WebGPU initialization timeout
- `d5c6884` - Add WebGPU diagnostics and preflight test
- `47167b6` - Remove hardcoded secrets, add resolution tracking
- `4be263a` - Use production client build for faster page loads
- `432ff84` - Proceed with capture after 5 consecutive probe timeouts
- `37ad042` - Add Playwright WebGPU test and DOM-based result capture
