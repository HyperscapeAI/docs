# Deployment Troubleshooting Guide

Comprehensive troubleshooting guide for Hyperscape deployments across Cloudflare Pages, Railway, and Vast.ai.

## Table of Contents

- [Cloudflare Pages](#cloudflare-pages)
- [Railway](#railway)
- [Vast.ai](#vastai)
- [Database Issues](#database-issues)
- [Streaming Issues](#streaming-issues)
- [Security & Secrets](#security--secrets)

## Cloudflare Pages

### Build Fails with Module Resolution Errors

**Symptoms:**
```
Failed to resolve module specifier "vite-plugin-node-polyfills/shims/buffer"
```

**Cause**: Vite polyfills shims not resolving to dist files.

**Fix** (commit e012ed2):
```javascript
// vite.config.ts
resolve: {
  alias: {
    'vite-plugin-node-polyfills/shims/buffer': 'vite-plugin-node-polyfills/dist/shims/buffer',
    'vite-plugin-node-polyfills/shims/global': 'vite-plugin-node-polyfills/dist/shims/global',
    'vite-plugin-node-polyfills/shims/process': 'vite-plugin-node-polyfills/dist/shims/process',
  }
}
```

### CSP Errors Loading Google Fonts

**Symptoms:**
```
Refused to load the stylesheet 'https://fonts.googleapis.com/...' because it violates CSP
```

**Cause**: Content Security Policy doesn't allow Google Fonts.

**Fix** (commit e012ed2):
```javascript
// public/_headers
/*
  Content-Security-Policy: style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com
```

### CORS Errors Loading Assets from R2

**Symptoms:**
```
Access to fetch at 'https://assets.hyperscape.club/...' from origin 'https://hyperscape.gg' has been blocked by CORS policy
```

**Cause**: R2 bucket CORS not configured.

**Fix** (commit 143914d):
```bash
# Run CORS configuration script
bash scripts/configure-r2-cors.sh

# Or manually with wrangler
wrangler r2 bucket cors set hyperscape-assets --cors-config cors-config.json
```

**CORS config format:**
```json
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag"],
  "maxAge": 3600
}
```

### Multi-line Commit Messages Break Deploy

**Symptoms:**
```
Error: Invalid commit message format
```

**Cause**: Workflow doesn't handle multi-line commit messages.

**Fix** (commit 3e4bb48):
```yaml
# .github/workflows/deploy-pages.yml
- name: Get commit message
  id: commit
  run: |
    COMMIT_MSG=$(git log -1 --pretty=%B | head -1)
    echo "message=$COMMIT_MSG" >> $GITHUB_OUTPUT
```

## Railway

### Database Connection Fails

**Symptoms:**
```
Error: connect ECONNREFUSED
```

**Cause**: DATABASE_URL not set or incorrect.

**Fix**:
1. Get DATABASE_URL from Railway dashboard (PostgreSQL plugin)
2. Add to Railway environment variables
3. Redeploy

**Verify:**
```bash
# In Railway logs
grep "DATABASE_URL" /app/logs/server.log
# Should show: configured (not NOT SET)
```

### CSRF Errors from Cloudflare Pages

**Symptoms:**
```
403 Forbidden: CSRF token validation failed
```

**Cause**: Cross-origin requests from Cloudflare Pages to Railway server.

**Fix**: CSRF validation now skipped for known clients (commit 8626299):
```typescript
// Server already protected by Origin header + JWT
// Skip CSRF for cross-origin requests from trusted domains
```

### Port Conflicts

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::5555
```

**Cause**: Port 5555 already in use.

**Fix**:
```bash
# Railway uses PORT environment variable
# Don't hardcode port 5555 in production
const port = process.env.PORT || 5555;
```

## Vast.ai

### Xorg Fails to Start

**Symptoms:**
```
[deploy] Xorg failed to start (check /var/log/Xorg.99.log)
```

**Cause**: NVIDIA driver issues, display already in use, or missing dependencies.

**Fix**:
```bash
# Check NVIDIA driver
nvidia-smi

# Install Xorg components
apt-get install -y xserver-xorg-core

# Kill existing display servers
pkill -9 Xorg; pkill -9 Xvfb
sleep 2

# Check Xorg logs
cat /var/log/Xorg.99.log
```

**Fallback**: Deployment automatically falls back to Xvfb (software rendering).

### WebGPU Not Available

**Symptoms:**
```
WebGPU is not supported in this browser
```

**Cause**: Vulkan not working, wrong Chrome channel, or Xvfb fallback.

**Fix**:
```bash
# Check Vulkan
vulkaninfo --summary

# Check VK_ICD_FILENAMES
echo $VK_ICD_FILENAMES
# Should be: /usr/share/vulkan/icd.d/nvidia_icd.json

# Check Chrome version
google-chrome-unstable --version
# Should be: Google Chrome 1xx.x.xxxx.xx dev

# Check DUEL_CAPTURE_USE_XVFB
pm2 show hyperscape-duel | grep DUEL_CAPTURE_USE_XVFB
# Should be: false (for Xorg) or true (for Xvfb)
```

### PulseAudio Not Working

**Symptoms:**
```
[RTMPBridge] PulseAudio not accessible, falling back to silent audio
```

**Cause**: PulseAudio not running, chrome_audio sink missing, or permission errors.

**Fix**:
```bash
# Check PulseAudio status
pulseaudio --check && echo "Running" || echo "Not running"

# Restart PulseAudio
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes

# Create chrome_audio sink
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio

# Verify
pactl list short sinks | grep chrome_audio
```

See [Streaming Audio Capture](streaming-audio-capture.md) for full guide.

### Stream Not Appearing on Platforms

**Symptoms:**
- Stream key configured but no stream on Twitch/Kick/X
- FFmpeg running but no output

**Cause**: Wrong stream key, wrong RTMP URL, or network issues.

**Fix**:
```bash
# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check FFmpeg processes
ps aux | grep ffmpeg

# Check stream keys (masked)
pm2 logs hyperscape-duel | grep "STREAM_KEY"
# Should show: ***configured***

# Check FFmpeg logs for RTMP errors
pm2 logs hyperscape-duel | grep -iE "rtmp|error|failed"

# Verify RTMP URLs
pm2 logs hyperscape-duel | grep -E "KICK_RTMP_URL|X_RTMP_URL|TWITCH"
```

**Correct URLs** (commit 5dbd239):
- Twitch: `rtmp://live.twitch.tv/app`
- Kick: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`
- X: `rtmp://sg.pscp.tv:80/x`

### DATABASE_URL Not Persisting

**Symptoms:**
```
Error: connect ECONNREFUSED (database connection)
```

**Cause**: Git reset overwrites .env file.

**Fix** (commit eec04b0):
Secrets are now written to `/tmp/hyperscape-secrets.env` before git reset, then copied back after.

**Verify:**
```bash
# Check /tmp secrets
cat /tmp/hyperscape-secrets.env | grep DATABASE_URL

# Check .env
cat /root/hyperscape/packages/server/.env | grep DATABASE_URL

# Check PM2 environment
pm2 show hyperscape-duel | grep DATABASE_URL
```

### PM2 Process Crashes Immediately

**Symptoms:**
```
[PM2] Process exited with code 1
```

**Cause**: Missing dependencies, database connection failure, or configuration errors.

**Fix**:
```bash
# Check PM2 logs
pm2 logs hyperscape-duel --lines 100

# Check error logs
pm2 logs hyperscape-duel --err --lines 50

# Common issues:
# 1. DATABASE_URL not set
# 2. JWT_SECRET missing (required in production)
# 3. Bun not installed
# 4. Dependencies not installed

# Verify environment
pm2 show hyperscape-duel | grep -E "DATABASE_URL|JWT_SECRET|NODE_ENV"
```

### Maintenance Mode Fails

**Symptoms:**
```
Warning: Failed to exit maintenance mode
```

**Cause**: Server not healthy, ADMIN_CODE wrong, or server URL incorrect.

**Fix**:
```bash
# Check server health
curl http://localhost:5555/health

# Check maintenance status
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"

# Manually exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### Bun Not Found

**Symptoms:**
```
bash: bun: command not found
```

**Cause**: Bun not installed or not in PATH.

**Fix** (commit abfe0ce):
```bash
# Install unzip (required for bun)
apt-get update && apt-get install -y unzip

# Install bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH
export PATH="/root/.bun/bin:$PATH"

# Verify
bun --version
```

The deploy script now checks for bun and installs automatically.

## Database Issues

### Schema Migration Fails

**Symptoms:**
```
Error: relation "players" does not exist
```

**Cause**: Database schema not pushed or migrations not run.

**Fix**:
```bash
cd packages/server
bunx drizzle-kit push --force

# Or run migrations
bunx drizzle-kit migrate
```

### Database Connection Timeout

**Symptoms:**
```
Error: Connection timeout
```

**Cause**: Database cold start or network issues.

**Fix** (commit dda4396):
Database warmup with 3 retry attempts:

```bash
# In deploy-vast.sh
for i in 1 2 3; do
  if bun -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    pool.query('SELECT 1').then(() => { console.log('DB warmup successful'); pool.end(); process.exit(0); }).catch(e => { console.error('DB warmup failed:', e.message); pool.end(); process.exit(1); });
  "; then
    echo "Database connection verified"
    break
  else
    echo "Database warmup attempt $i failed, retrying..."
    sleep 3
  fi
done
```

### Stale Schema After Pull

**Symptoms:**
- Missing columns
- Type errors
- Constraint violations

**Cause**: Local database schema doesn't match code.

**Fix**:
```bash
# Reset local database (WARNING: deletes all data)
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data server_postgres-data

# Restart with fresh schema
bun run dev
```

## Streaming Issues

### No Audio in Stream

**Symptoms:**
- Video works but no audio
- Silent stream

**Cause**: PulseAudio not running, chrome_audio sink missing, or FFmpeg not capturing.

**Fix**:
```bash
# Check PulseAudio
pulseaudio --check && echo "OK" || echo "FAILED"

# Check chrome_audio sink
pactl list short sinks | grep chrome_audio

# Restart PulseAudio
pulseaudio --kill
pulseaudio --start --exit-idle-time=-1 --daemonize=yes
pactl load-module module-null-sink sink_name=chrome_audio
pactl set-default-sink chrome_audio

# Verify FFmpeg is capturing
pm2 logs hyperscape-duel | grep -i pulse
```

See [Streaming Audio Capture](streaming-audio-capture.md) for full guide.

### Audio/Video Desync

**Symptoms:**
- Audio plays ahead or behind video
- Gradual drift over time

**Cause**: Missing wall clock timestamps or async resampling.

**Fix** (commit b9d2e41):
```bash
# Ensure these flags are in FFmpeg args:
-use_wallclock_as_timestamps 1
-af aresample=async=1000:first_pts=0

# Verify in logs
pm2 logs hyperscape-duel | grep -E "use_wallclock|aresample"
```

### Stream Buffering on Viewers

**Symptoms:**
- Viewers experience frequent buffering
- Stream quality drops

**Cause**: Insufficient buffer size or zerolatency tune.

**Fix** (commit 4c630f1):
```bash
# Use film tune instead of zerolatency
export STREAM_LOW_LATENCY=false

# Increase buffer size to 4x bitrate
# This is now the default (18000k for 4500k bitrate)

# Verify in logs
pm2 logs hyperscape-duel | grep -E "tune|bufsize"
# Should see: -tune film -bufsize 18000k
```

### FFmpeg Crashes

**Symptoms:**
```
[RTMPBridge] FFmpeg exited with code=1
```

**Cause**: Invalid arguments, missing codecs, or RTMP connection failure.

**Fix**:
```bash
# Check FFmpeg logs
pm2 logs hyperscape-duel | grep -A 20 "FFmpeg"

# Check FFmpeg version
ffmpeg -version

# Test FFmpeg manually
ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i anullsrc=r=44100:cl=stereo \
  -t 10 \
  -c:v libx264 -preset ultrafast -tune film \
  -c:a aac -b:a 128k \
  -f flv test-output.flv
```

## Security & Secrets

### JWT_SECRET Missing Error

**Symptoms:**
```
Error: JWT_SECRET is required in production/staging environments
```

**Cause**: JWT_SECRET not set in production.

**Fix**:
```bash
# Generate secret
openssl rand -base64 32

# Add to .env or Railway environment
JWT_SECRET=your-generated-secret
```

**Note**: This is now enforced in production/staging (commit b56b0fd).

### Stream Keys Not Working

**Symptoms:**
- Stream keys configured but streams don't appear
- FFmpeg shows "Connection refused"

**Cause**: Stale stream keys in environment override .env values.

**Fix** (commit a71d4ba):
```bash
# The deploy script now explicitly unsets and re-exports
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL
unset YOUTUBE_STREAM_KEY
export YOUTUBE_STREAM_KEY=""
source /root/hyperscape/packages/server/.env

# Verify keys are configured
pm2 logs hyperscape-duel | grep "STREAM_KEY"
# Should show: ***configured*** (not NOT SET)
```

### Solana Keypair Not Found

**Symptoms:**
```
Error: Keypair file not found: ~/.config/solana/id.json
```

**Cause**: SOLANA_DEPLOYER_PRIVATE_KEY not set or decode-key.ts not run.

**Fix** (commit 8a677dc):
```bash
# Set environment variable
export SOLANA_DEPLOYER_PRIVATE_KEY="[1,2,3,...]"  # JSON array
# OR
export SOLANA_DEPLOYER_PRIVATE_KEY="base58string"

# Run decode script
bun run scripts/decode-key.ts

# Verify
ls -la ~/.config/solana/id.json
solana-keygen pubkey ~/.config/solana/id.json
```

### Secrets Lost After Git Reset

**Symptoms:**
- DATABASE_URL works initially but fails after deployment
- Stream keys stop working after git pull

**Cause**: Git reset overwrites .env file.

**Fix** (commit eec04b0):
Secrets are now written to `/tmp/hyperscape-secrets.env` before git reset:

```bash
# In deploy-vast.yml
cat > /tmp/hyperscape-secrets.env << 'EOF'
DATABASE_URL=${{ secrets.DATABASE_URL }}
# ... other secrets
EOF

# In deploy-vast.sh (after git reset)
cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env
```

## Common Error Messages

### "Failed to resolve module specifier"

**Fix**: Update Vite config with polyfill aliases (commit e012ed2).

### "WebGPU is not supported"

**Fix**: Use Chrome 113+, Edge 113+, or Safari 18+. Check [webgpureport.org](https://webgpureport.org).

### "CSRF token validation failed"

**Fix**: CSRF now skipped for cross-origin (commit 8626299). Update server code.

### "Connection refused" (database)

**Fix**: Set DATABASE_URL, run database warmup (commit dda4396).

### "Keypair file not found"

**Fix**: Set SOLANA_DEPLOYER_PRIVATE_KEY, run decode-key.ts (commit 8a677dc).

### "PulseAudio: Connection refused"

**Fix**: Start PulseAudio, create chrome_audio sink. See [Streaming Audio Capture](streaming-audio-capture.md).

### "FFmpeg: No such file or directory"

**Fix**: Install FFmpeg (`apt-get install ffmpeg`) or set FFMPEG_PATH.

### "Port already in use"

**Fix**: Kill process on port (`lsof -ti:5555 | xargs kill -9`) or use different port.

## Diagnostic Commands

### Check All Services

```bash
# Server health
curl http://localhost:5555/health

# Database connection
cd packages/server && bun -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e));"

# PulseAudio
pulseaudio --check && pactl list short sinks | grep chrome_audio

# Vulkan
vulkaninfo --summary

# NVIDIA
nvidia-smi

# FFmpeg
ffmpeg -version

# Chrome
google-chrome-unstable --version

# PM2
pm2 status
```

### Check Environment Variables

```bash
# Server
pm2 show hyperscape-duel | grep -E "DATABASE_URL|JWT_SECRET|STREAM_KEY|DISPLAY|VK_ICD"

# Or check .env directly
cat /root/hyperscape/packages/server/.env
```

### Check Logs

```bash
# PM2 logs
pm2 logs hyperscape-duel --lines 200

# Error logs only
pm2 logs hyperscape-duel --err --lines 100

# Filter for specific issues
pm2 logs hyperscape-duel | grep -iE "error|failed|warning"

# Streaming logs
pm2 logs hyperscape-duel | grep -iE "rtmp|ffmpeg|stream|pulse"

# Xorg logs
cat /var/log/Xorg.99.log
```

## Performance Issues

### High CPU Usage

**Symptoms:**
- CPU > 90%
- Lag or frame drops

**Cause**: Too many agents, high encoding quality, or inefficient code.

**Fix**:
```bash
# Reduce video bitrate
export STREAM_VIDEO_BITRATE_KBPS=3000  # Reduce from 4500

# Reduce resolution
export STREAM_CAPTURE_WIDTH=1024
export STREAM_CAPTURE_HEIGHT=576

# Reduce FPS
export STREAM_FPS=24  # Reduce from 30

# Disable audio
export STREAM_AUDIO_ENABLED=false

# Limit agents
export AUTO_START_AGENTS_MAX=5  # Reduce from 10
```

### High Memory Usage

**Symptoms:**
- Memory > 4GB
- PM2 restarts process

**Cause**: Memory leaks, too many agents, or large buffers.

**Fix**:
```bash
# Check memory usage
pm2 status
pm2 show hyperscape-duel | grep memory

# Reduce agents
export AUTO_START_AGENTS_MAX=5

# Enable memory management
export MALLOC_TRIM_THRESHOLD_="-1"
export MIMALLOC_ALLOW_DECOMMIT="0"

# Restart to clear memory
pm2 restart hyperscape-duel
```

### Stream Lag or Stuttering

**Symptoms:**
- Choppy video
- Audio dropouts
- Frame drops

**Cause**: Insufficient buffering, network issues, or CPU overload.

**Fix**:
```bash
# Increase buffer size
export STREAM_LOW_LATENCY=false  # Enables 4x buffer (18000k)

# Increase thread queue size
# Edit rtmp-bridge.ts:
-thread_queue_size 2048  # Increase from 1024

# Check CPU usage
top
# If > 90%, reduce encoding quality or resolution
```

## Network Issues

### WebSocket Connection Fails

**Symptoms:**
```
WebSocket connection failed
```

**Cause**: Wrong URL, firewall, or server not running.

**Fix**:
```bash
# Check server is running
curl http://localhost:5555/health

# Check WebSocket port
lsof -i :5555

# Test WebSocket
wscat -c ws://localhost:5555/ws

# Check firewall (Vast.ai)
# Ensure port 35079 is exposed
```

### CORS Errors

**Symptoms:**
```
Access to fetch at '...' has been blocked by CORS policy
```

**Cause**: Missing CORS headers or R2 CORS not configured.

**Fix**:
```bash
# For R2 assets
bash scripts/configure-r2-cors.sh

# For API endpoints
# Server already has CORS enabled for known origins
```

## Related Documentation

- [Vast.ai Deployment](vast-deployment.md)
- [Railway Deployment](railway-dev-prod.md)
- [Cloudflare Pages Deployment](cloudflare-pages-deployment.md)
- [Streaming Audio Capture](streaming-audio-capture.md)
- [Environment Variables](environment-variables.md)
- [Maintenance Mode API](maintenance-mode-api.md)
