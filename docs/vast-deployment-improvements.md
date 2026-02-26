# Vast.ai Deployment Improvements (February 2026)

This document describes the comprehensive improvements made to Vast.ai deployment for GPU-accelerated streaming and duel hosting.

## Overview

The Vast.ai deployment has been significantly enhanced with better reliability, audio capture, database persistence, and diagnostic capabilities. These changes ensure stable 24/7 streaming with automatic recovery.

## Major Improvements

### 1. PulseAudio Audio Capture

**What**: Capture game audio (music and sound effects) for streaming.

**Implementation**:
- User-mode PulseAudio (more reliable than system mode)
- Virtual sink (`chrome_audio`) for audio routing
- Automatic fallback to silent audio if PulseAudio fails
- XDG runtime directory at `/tmp/pulse-runtime`

**Configuration**:
```bash
# Automatic in deploy-vast.sh
export XDG_RUNTIME_DIR=/tmp/pulse-runtime
export PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

**See**: [docs/streaming-audio-capture.md](streaming-audio-capture.md)

### 2. DATABASE_URL Persistence

**Problem**: `DATABASE_URL` was lost during `git reset` operations in deployment.

**Solution**: Write secrets to `/tmp` before git reset, restore after:

```bash
# Before git reset
cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env

# After git reset
if [ -f "/tmp/hyperscape-secrets.env" ]; then
    cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env
fi
```

**Impact**: Database connection survives deployment updates.

### 3. Database Warmup

**Problem**: Cold start issues with PostgreSQL connection pool.

**Solution**: Warmup step after schema push with 3 retry attempts:

```bash
# Warmup database connection
for i in 1 2 3; do
    if bun -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1').then(() => { 
            console.log('DB warmup successful'); 
            pool.end(); 
        });
    "; then
        break
    fi
    sleep 3
done
```

**Impact**: Eliminates cold start connection failures.

### 4. Stream Key Management

**Problem**: Stale stream keys in environment overrode correct values from secrets.

**Solution**: Explicit unset and re-export before PM2 start:

```bash
# Clear stale keys
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL
unset YOUTUBE_STREAM_KEY  # Explicitly disable

# Re-source from .env
source /root/hyperscape/packages/server/.env

# Verify (masked)
echo "TWITCH_STREAM_KEY: ${TWITCH_STREAM_KEY:+***configured***}"
```

**Impact**: Correct stream keys always used, no more wrong-platform streaming.

### 5. YouTube Removal

**What**: YouTube streaming explicitly disabled from default destinations.

**Why**: Focusing on Twitch, Kick, and X for lower latency and better live betting experience.

**Implementation**:
```bash
# Explicitly unset YouTube keys
unset YOUTUBE_STREAM_KEY YOUTUBE_RTMP_STREAM_KEY
export YOUTUBE_STREAM_KEY=""
```

**To re-enable**:
```bash
# packages/server/.env
YOUTUBE_STREAM_KEY=your-youtube-key
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

### 6. Streaming Diagnostics

**What**: Comprehensive diagnostic output after deployment.

**Includes**:
- Streaming API state
- Game client status (port 3333)
- RTMP status file
- FFmpeg processes
- PM2 logs (filtered for streaming keywords)

**Example Output**:
```bash
[deploy] ═══ STREAMING DIAGNOSTICS ═══
[deploy] Streaming state: {"active":true,"destinations":["twitch","kick","x"]}
[deploy] Game client status: 200
[deploy] RTMP status: {"twitch":"connected","kick":"connected","x":"connected"}
[deploy] FFmpeg processes: 3 running
[deploy] ═══ END DIAGNOSTICS ═══
```

**Impact**: Faster troubleshooting of streaming issues.

### 7. Solana Keypair Setup

**What**: Automated Solana keypair configuration from environment variable.

**Implementation**:
```bash
# Setup keypair from SOLANA_DEPLOYER_PRIVATE_KEY
if [ -n "$SOLANA_DEPLOYER_PRIVATE_KEY" ]; then
    bun run scripts/decode-key.ts
fi
```

**Output**: Keypair written to `~/.config/solana/id.json`

**Impact**: Keeper bot and Anchor tools work without manual keypair setup.

### 8. Health Checking

**What**: Wait for server health before considering deployment successful.

**Implementation**:
```bash
# Wait up to 120 seconds for health check
while [ $WAITED -lt 120 ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        "http://localhost:5555/health" --max-time 5)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "Server is healthy!"
        break
    fi
    
    sleep 5
    WAITED=$((WAITED + 5))
done
```

**Impact**: Deployment only succeeds if server is actually running and healthy.

## Deployment Flow

### Complete Deployment Sequence

```bash
1. Pull latest code from main
2. Restore DATABASE_URL from /tmp
3. Install system dependencies (PulseAudio, FFmpeg, Chrome Dev, etc.)
4. Setup PulseAudio virtual sink
5. Install Playwright and dependencies
6. Install Bun dependencies
7. Build core packages (physx, decimation, impostors, procgen, asset-forge, shared)
8. Load database configuration
9. Setup Solana keypair
10. Push database schema (with warmup)
11. Tear down existing processes
12. Start port proxies (socat)
13. Export stream keys
14. Start duel stack via PM2
15. Save PM2 process list
16. Wait for server health
17. Show PM2 status
18. Run streaming diagnostics
```

### Port Mappings

| Internal | External | Service |
|----------|----------|---------|
| 5555 | 35143 | HTTP API |
| 5555 | 35079 | WebSocket |
| 8080 | 35144 | CDN |

## Configuration

### GitHub Secrets

Required secrets for Vast.ai deployment:

```bash
VAST_SSH_KEY=your-ssh-private-key
VAST_HOST=your-vast-instance-ip
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=sk_...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=...
X_RTMP_URL=rtmp://...
SOLANA_DEPLOYER_PRIVATE_KEY=[1,2,3,...]
```

### Workflow Triggers

```yaml
# .github/workflows/deploy-vast.yml

# Automatic after CI passes
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

# Manual trigger
on:
  workflow_dispatch:
```

### Environment Variables

```bash
# ecosystem.config.cjs
env: {
  NODE_ENV: "production",
  DATABASE_URL: process.env.DATABASE_URL,
  PUBLIC_CDN_URL: "https://assets.hyperscape.club",
  
  # Audio
  STREAM_AUDIO_ENABLED: "true",
  PULSE_AUDIO_DEVICE: "chrome_audio.monitor",
  PULSE_SERVER: "unix:/tmp/pulse-runtime/pulse/native",
  XDG_RUNTIME_DIR: "/tmp/pulse-runtime",
  
  # Streaming
  STREAMING_CANONICAL_PLATFORM: "twitch",
  STREAMING_PUBLIC_DELAY_MS: "0",
  
  # Capture
  STREAM_CAPTURE_MODE: "cdp",
  STREAM_CAPTURE_HEADLESS: "false",
  STREAM_CAPTURE_CHANNEL: "chrome-dev",
  STREAM_CAPTURE_ANGLE: "vulkan",
  DUEL_CAPTURE_USE_XVFB: "true",
}
```

## Monitoring

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
```

### Health Checks

```bash
# Server health
curl http://localhost:5555/health

# Streaming state
curl http://localhost:5555/api/streaming/state

# RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

### Diagnostic Logs

```bash
# Streaming-specific logs
bunx pm2 logs hyperscape-duel --nostream --lines 200 | \
  grep -iE "rtmp|ffmpeg|stream|capture|destination|twitch|kick"

# Error logs
bunx pm2 logs hyperscape-duel --err --lines 50
```

## Troubleshooting

### Deployment Fails

**Check**:
1. SSH connection to Vast instance
2. GitHub secrets are set
3. Vast instance has enough disk space

**Fix**:
```bash
# SSH to Vast instance
ssh root@your-vast-ip

# Check disk space
df -h

# Check deployment logs
tail -f /root/hyperscape/logs/deploy.log
```

### Database Connection Fails

**Check**:
1. `DATABASE_URL` is set in `/tmp/hyperscape-secrets.env`
2. Database is accessible from Vast instance
3. Warmup step completed successfully

**Fix**:
```bash
# Verify DATABASE_URL
cat /tmp/hyperscape-secrets.env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Re-run warmup
cd /root/hyperscape/packages/server
bunx drizzle-kit push --force
```

### PulseAudio Not Working

**Check**:
1. PulseAudio is running
2. `chrome_audio` sink exists
3. XDG_RUNTIME_DIR is set

**Fix**:
```bash
# Check PulseAudio
pulseaudio --check

# Restart PulseAudio
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes

# Verify sink
pactl list short sinks | grep chrome_audio
```

### Stream Not Appearing

**Check**:
1. Stream keys are configured
2. FFmpeg is running
3. RTMP connection is established

**Fix**:
```bash
# Check stream keys
echo ${TWITCH_STREAM_KEY:+configured}

# Check FFmpeg
ps aux | grep ffmpeg

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Restart streaming
bunx pm2 restart hyperscape-duel
```

### Health Check Timeout

**Check**:
1. Server is actually starting
2. No port conflicts
3. Database connection works

**Fix**:
```bash
# Check server logs
bunx pm2 logs hyperscape-duel --err

# Check port
lsof -i:5555

# Manual health check
curl http://localhost:5555/health
```

## Performance

### Resource Usage

| Resource | Idle | Streaming | Peak |
|----------|------|-----------|------|
| CPU | 10-15% | 30-40% | 60% |
| RAM | 2GB | 3GB | 4GB |
| GPU | 5% | 20-30% | 50% |
| Network | 1Mbps | 5Mbps | 10Mbps |

### Optimization Tips

1. **Reduce video bitrate** for lower bandwidth:
   ```bash
   STREAM_VIDEO_BITRATE=3000
   ```

2. **Disable audio** if not needed:
   ```bash
   STREAM_AUDIO_ENABLED=false
   ```

3. **Use lower resolution**:
   ```bash
   STREAM_WIDTH=1024
   STREAM_HEIGHT=576
   ```

4. **Disable model agents** for lower CPU:
   ```bash
   SPAWN_MODEL_AGENTS=false
   ```

## Best Practices

### 1. Monitor Logs

Always monitor logs after deployment:

```bash
bunx pm2 logs hyperscape-duel --lines 100
```

### 2. Verify Health

Check health endpoint before considering deployment successful:

```bash
curl http://localhost:5555/health
```

### 3. Test Streaming

Verify stream is live on all platforms:

```bash
# Check Twitch
# Visit: https://twitch.tv/your-channel

# Check Kick
# Visit: https://kick.com/your-channel

# Check X
# Visit: https://x.com/your-account
```

### 4. Backup Secrets

Keep backup of secrets file:

```bash
# Backup
cp /tmp/hyperscape-secrets.env /root/hyperscape-secrets.backup

# Restore if needed
cp /root/hyperscape-secrets.backup /tmp/hyperscape-secrets.env
```

## Related Documentation

- [docs/streaming-audio-capture.md](streaming-audio-capture.md) - PulseAudio setup
- [docs/streaming-improvements-feb-2026.md](streaming-improvements-feb-2026.md) - Streaming changes
- [docs/duel-stack.md](duel-stack.md) - Duel system architecture
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration

## References

- [Vast.ai Documentation](https://vast.ai/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Vulkan on Linux](https://www.khronos.org/vulkan/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
