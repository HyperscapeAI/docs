# Streaming Troubleshooting Guide

This guide covers common issues with the Hyperscape streaming pipeline and their solutions.

## Quick Diagnostics

### Check Streaming Status

```bash
# Check if streaming is enabled
curl http://localhost:5555/api/streaming/state

# Verify duel stack is running
bun run duel:verify

# Check PM2 process status
bunx pm2 status
bunx pm2 logs hyperscape-duel
```

### Verify Stream Destinations

```bash
# Check auto-detected destinations
echo $STREAM_ENABLED_DESTINATIONS

# Verify stream keys are set
echo $TWITCH_STREAM_KEY
echo $KICK_STREAM_KEY
echo $YOUTUBE_STREAM_KEY
```

## Common Issues

### Stream Not Starting

**Symptom**: RTMP bridge fails to start or stream doesn't appear on Twitch/YouTube/Kick.

**Causes**:

1. **Missing stream keys**:
   ```bash
   # Check keys are set
   echo $TWITCH_STREAM_KEY
   echo $TWITCH_RTMP_STREAM_KEY
   echo $KICK_STREAM_KEY
   echo $YOUTUBE_STREAM_KEY
   ```
   
   **Fix**: Set at least one stream key in `packages/server/.env` or deployment secrets.

2. **Auto-detection failed**:
   ```bash
   # Check if destinations were detected
   echo $STREAM_ENABLED_DESTINATIONS
   ```
   
   **Fix**: Manually set `STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube` if auto-detection fails.

3. **FFmpeg not found**:
   ```bash
   # Check FFmpeg installation
   which ffmpeg
   
   # Or check custom path
   echo $FFMPEG_PATH
   ```
   
   **Fix**: Install FFmpeg (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux) or set `FFMPEG_PATH`.

4. **Playwright Chromium missing**:
   ```bash
   # Install Chromium
   bunx playwright install chromium
   ```

### WebGPU Initialization Failures

**Symptom**: Stream capture fails with "WebGPU not available" or renderer initialization errors.

**Causes**:

1. **GPU display driver not active** (Vast.ai):
   - **Requirement**: `gpu_display_active=true` on Vast.ai instance
   - **Not sufficient**: Compute-only GPU access won't work
   - **Fix**: Select Vast.ai instance with display driver support

2. **Headless mode**:
   - **Requirement**: WebGPU requires window context (Xorg or Xvfb)
   - **Fix**: Ensure `DUEL_CAPTURE_USE_XVFB=true` in `ecosystem.config.cjs`

3. **Chrome version**:
   ```bash
   # Check Chrome version
   google-chrome-unstable --version
   ```
   
   **Fix**: Install Chrome Dev channel:
   ```bash
   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
   echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
   apt-get update && apt-get install -y google-chrome-unstable
   ```

4. **ANGLE backend**:
   - **Requirement**: Chrome must use ANGLE/Vulkan for WebGPU
   - **Check**: Review capture logs for ANGLE initialization
   - **Fix**: Ensure `STREAM_CAPTURE_ANGLE=vulkan` in `ecosystem.config.cjs`

### CSRF 403 Errors

**Symptom**: Account creation fails with "CSRF validation failed" (403) when running client on localhost against deployed server.

**Cause**: Missing Authorization header or CSRF token response shape mismatch.

**Fix** (commit 0b1a0bd):
1. Ensure `UsernameSelectionScreen` includes Privy auth token:
   ```typescript
   const authToken = privyAuthManager.getToken() || localStorage.getItem("privy_auth_token");
   const headers: Record<string, string> = {
     "Content-Type": "application/json",
   };
   if (authToken) {
     headers["Authorization"] = `Bearer ${authToken}`;
   }
   ```

2. Verify `api-client.ts` accepts both response formats:
   ```typescript
   const data = await response.json() as { csrfToken?: string; token?: string };
   const token = data.csrfToken ?? data.token;
   ```

3. Check CSRF middleware allows localhost origins:
   ```typescript
   const KNOWN_CROSS_ORIGIN_PATTERNS = [
     /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/,
     // ...
   ];
   ```

### Stream Destination Auto-Detection Not Working

**Symptom**: `STREAM_ENABLED_DESTINATIONS` is empty even though stream keys are set.

**Cause**: Auto-detection logic in `deploy-vast.sh` not running or environment variables not forwarded.

**Fix**:

1. **Check PM2 environment forwarding** (`ecosystem.config.cjs`):
   ```javascript
   env: {
     TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY || process.env.TWITCH_RTMP_STREAM_KEY || "",
     KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
     STREAM_ENABLED_DESTINATIONS: process.env.STREAM_ENABLED_DESTINATIONS || process.env.DUEL_STREAM_DESTINATIONS || "",
   }
   ```

2. **Manually set destinations**:
   ```bash
   # In packages/server/.env or deployment secrets
   STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube
   ```

3. **Verify secret aliases** (`.github/workflows/deploy-vast.yml`):
   ```yaml
   - name: Write secrets file
     run: |
       cat > /tmp/hyperscape-secrets.env <<'EOF'
       TWITCH_RTMP_STREAM_KEY=${{ secrets.TWITCH_STREAM_KEY }}
       KICK_STREAM_KEY=${{ secrets.KICK_STREAM_KEY }}
       EOF
   ```

### Database Connection Pool Exhaustion

**Symptom**: "timeout exceeded when trying to connect" errors during streaming.

**Cause**: Too many concurrent database queries from agents.

**Fix**:

1. **Increase pool size** (`packages/server/.env`):
   ```bash
   POSTGRES_POOL_MAX=20
   POSTGRES_POOL_MIN=2
   ```

2. **Enable concurrency limiting** (already enabled in `ecosystem.config.cjs`):
   ```javascript
   env: {
     POSTGRES_POOL_MAX: "1",
     POSTGRES_POOL_MIN: "0",
   }
   ```

3. **Stagger agent refresh intervals**:
   - Agents refresh at different intervals to distribute load
   - Check `packages/server/src/eliza/AgentManager.ts` for refresh logic

### Agent Memory Leaks

**Symptom**: Memory usage grows over time, eventually causing OOM crashes.

**Cause**: PGLite WASM overhead or unbounded memory growth.

**Fix** (commit 788036d):

1. **Verify InMemoryDatabaseAdapter is used**:
   ```typescript
   // packages/server/src/eliza/agentHelpers.ts
   import { InMemoryDatabaseAdapter } from "@elizaos/core";
   
   const runtime = new AgentRuntime({
     databaseAdapter: new InMemoryDatabaseAdapter(),
     // ...
   });
   ```

2. **Check memory caps are in place**:
   - 50 memories per agent (ring buffer)
   - 20 adapter log entries
   - 100 cache entries with LRU eviction

3. **Verify periodic GC is running**:
   - Non-blocking GC every 60s
   - Check server logs for GC events

4. **Monitor memory usage**:
   ```bash
   # Check PM2 memory stats
   bunx pm2 status
   
   # Check system memory
   free -h
   ```

### Stream Quality Issues

**Symptom**: Stream is laggy, pixelated, or dropping frames.

**Causes**:

1. **Insufficient GPU**:
   - **Requirement**: NVIDIA GPU with display driver support
   - **Fix**: Select higher-tier Vast.ai instance with better GPU

2. **Bitrate too high**:
   ```bash
   # Check bitrate settings
   echo $STREAMING_BITRATE
   ```
   
   **Fix**: Reduce bitrate in `packages/server/.env`:
   ```bash
   STREAMING_BITRATE=4000k  # Down from 6000k
   ```

3. **Resolution too high**:
   ```bash
   # Check resolution
   echo $STREAM_CAPTURE_WIDTH
   echo $STREAM_CAPTURE_HEIGHT
   ```
   
   **Fix**: Reduce resolution:
   ```bash
   STREAM_CAPTURE_WIDTH=1280
   STREAM_CAPTURE_HEIGHT=720
   ```

4. **FPS too high**:
   ```bash
   # Check FPS
   echo $STREAMING_FPS
   ```
   
   **Fix**: Reduce FPS:
   ```bash
   STREAMING_FPS=30  # Down from 60
   ```

### Viewer Access Token Issues

**Symptom**: Stream viewers can't connect or get "unauthorized" errors.

**Cause**: Missing or incorrect `STREAMING_VIEWER_ACCESS_TOKEN`.

**Fix**:

1. **Set viewer access token** (`packages/server/.env`):
   ```bash
   STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
   ```

2. **Verify token is appended to capture URLs**:
   - `stream-to-rtmp` automatically appends `streamToken=<token>` when token is set
   - Check capture URL includes `?streamToken=...` parameter

3. **Check loopback exemption**:
   - Loopback/local capture clients are always allowed
   - External clients must present valid token

### PM2 Process Crashes

**Symptom**: `hyperscape-duel` process keeps restarting or crashing.

**Causes**:

1. **Memory limit exceeded**:
   ```bash
   # Check memory limit
   bunx pm2 show hyperscape-duel | grep "max_memory_restart"
   ```
   
   **Fix**: Increase memory limit in `ecosystem.config.cjs`:
   ```javascript
   max_memory_restart: "8G",  // Up from 4G
   ```

2. **Sub-process died**:
   - Orchestrator tears down entire stack if any critical sub-process dies
   - Check logs for which sub-process failed:
   ```bash
   tail -f logs/duel-error.log
   ```

3. **Database connection failures**:
   - Check PostgreSQL is running: `pg_isready -h 127.0.0.1 -p 5432`
   - Verify `DATABASE_URL` is correct
   - Check connection pool settings

### TypeScript Errors (TS18048)

**Symptom**: `import.meta.env.GAME_API_URL` is possibly undefined.

**Cause**: TypeScript can't narrow type through `||` operator.

**Fix** (commits 74b9852, 6cdbf2c, b542751):

**Before**:
```typescript
const url = import.meta.env.GAME_API_URL || "http://localhost:5555";
```

**After**:
```typescript
const url = import.meta.env.GAME_API_URL ?? "http://localhost:5555";
```

Use nullish coalescing (`??`) instead of logical OR (`||`) for import.meta.env values.

## Environment Variable Reference

### Streaming Configuration

```bash
# Auto-detected destinations (set any stream key and it's auto-detected)
STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube

# Twitch (multiple formats supported)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij
TWITCH_STREAM_URL=rtmp://live.twitch.tv/app
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
TWITCH_RTMP_SERVER=live.twitch.tv/app

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_STREAM_URL=rtmp://a.rtmp.youtube.com/live2
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# Custom RTMP
CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key

# RTMP Multiplexer (Restream, Livepeer, etc.)
RTMP_MULTIPLEXER_NAME=RTMP Multiplexer
RTMP_MULTIPLEXER_URL=rtmp://your-multiplexer/live
RTMP_MULTIPLEXER_STREAM_KEY=your-multiplexer-key

# JSON fanout config
RTMP_DESTINATIONS_JSON=[{"name":"MyMux","url":"rtmp://host/live","key":"stream-key","enabled":true}]
```

### Capture Configuration

```bash
# Capture mode: cdp (Chrome DevTools Protocol) or playwright
STREAM_CAPTURE_MODE=cdp

# Headless mode (must be false for WebGPU)
STREAM_CAPTURE_HEADLESS=false

# Chrome channel: chrome-dev, chrome-canary, chromium
STREAM_CAPTURE_CHANNEL=chrome-dev

# ANGLE backend: vulkan, metal (macOS), default
STREAM_CAPTURE_ANGLE=vulkan

# Resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Disable WebGPU (NOT RECOMMENDED - game won't render)
STREAM_CAPTURE_DISABLE_WEBGPU=false

# FFmpeg path
FFMPEG_PATH=/usr/bin/ffmpeg

# Disable bridge capture (for testing)
DUEL_DISABLE_BRIDGE_CAPTURE=false

# Use Xvfb for virtual display
DUEL_CAPTURE_USE_XVFB=true
```

### Viewer Access Control

```bash
# Viewer access token (optional)
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token

# Canonical platform for timing defaults
STREAMING_CANONICAL_PLATFORM=youtube  # or twitch

# Public delay (milliseconds)
STREAMING_PUBLIC_DELAY_MS=15000  # youtube default
# STREAMING_PUBLIC_DELAY_MS=12000  # twitch default
```

### Game URLs

```bash
# Primary game URL for capture
GAME_URL=http://localhost:3333/?page=stream

# Fallback URLs (comma-separated)
GAME_FALLBACK_URLS=http://localhost:3333/?page=stream,http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/
```

## Advanced Troubleshooting

### Enable Debug Logging

```bash
# Enable verbose logging
DEBUG=hyperscape:*

# Enable streaming-specific logs
DEBUG=hyperscape:streaming:*

# Enable RTMP bridge logs
DEBUG=hyperscape:rtmp:*
```

### Check Capture Process

```bash
# Find capture process
ps aux | grep chromium
ps aux | grep chrome

# Check Xvfb process
ps aux | grep Xvfb

# Check FFmpeg process
ps aux | grep ffmpeg
```

### Verify WebGPU Support

```bash
# Test WebGPU availability
bun run test:webgpu

# Check WebGPU report
# Open https://webgpureport.org in Chrome
```

### Review Logs

```bash
# PM2 logs
bunx pm2 logs hyperscape-duel

# Error logs
tail -f logs/duel-error.log

# Output logs
tail -f logs/duel-out.log

# Server logs
tail -f packages/server/logs/server.log
```

### Network Diagnostics

```bash
# Check port availability
lsof -ti:5555  # Game server
lsof -ti:3333  # Client
lsof -ti:8765  # RTMP bridge

# Test RTMP connection
ffplay rtmp://localhost:1935/live/test

# Test HTTP endpoints
curl http://localhost:5555/health
curl http://localhost:5555/api/streaming/state
```

## Known Issues

### Safari 17 Not Supported

**Issue**: Safari 17 does not have full WebGPU support.

**Fix**: Upgrade to Safari 18+ (macOS 15+) or use Chrome 113+.

### Bundle Size Warnings

**Issue**: Vite warns about large chunk sizes (8000KB+ for client, 9000KB+ for asset-forge).

**Cause**: WebGPU renderer, TSL shader system, and PhysX WASM bindings create large bundles.

**Status**: Intentional until deeper code splitting is implemented. See `packages/client/vite.config.ts` and `packages/asset-forge/vite.config.ts`.

### Vitest 2.x Incompatibility

**Issue**: Vitest 2.x throws `__vite_ssr_exportName__` errors with Vite 6.

**Fix**: Upgrade to Vitest 4.x (commit a916e4e):
```bash
bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6
```

### PGLite Memory Overhead

**Issue**: Agents consume 38-76GB memory with PGLite WASM.

**Fix**: Use InMemoryDatabaseAdapter (commit 788036d):
```typescript
import { InMemoryDatabaseAdapter } from "@elizaos/core";

const runtime = new AgentRuntime({
  databaseAdapter: new InMemoryDatabaseAdapter(),
  // ...
});
```

**Impact**: Reduces memory footprint from 38-76GB to <5GB for 19 agents.

## Recent Fixes (March 2026)

### Streaming Pipeline Auto-Detection (Commit 41dc606)

**Change**: Stream destinations now auto-detected from available stream keys.

**Before**:
```bash
# Manual configuration required
STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube
```

**After**:
```bash
# Auto-detected from available keys
# Just set stream keys and destinations are auto-configured
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
# STREAM_ENABLED_DESTINATIONS is set automatically
```

**Implementation** (`scripts/deploy-vast.sh`):
```bash
if [ -z "${STREAM_ENABLED_DESTINATIONS:-}" ]; then
    DESTS=""
    if [ -n "${TWITCH_STREAM_KEY:-${TWITCH_RTMP_STREAM_KEY:-}}" ]; then
        DESTS="twitch"
    fi
    if [ -n "${KICK_STREAM_KEY:-}" ]; then
        DESTS="${DESTS:+${DESTS},}kick"
    fi
    if [ -n "$DESTS" ]; then
        export STREAM_ENABLED_DESTINATIONS="$DESTS"
    fi
fi
```

### PM2 Environment Forwarding (Commit 41dc606)

**Change**: `ecosystem.config.cjs` now explicitly forwards stream keys through PM2 environment.

**Impact**: Stream keys are properly available to sub-processes managed by PM2.

### Secret Aliases (Commit 41dc606)

**Change**: GitHub Actions workflow adds `TWITCH_RTMP_STREAM_KEY` alias for compatibility.

**Impact**: Supports both `TWITCH_STREAM_KEY` and `TWITCH_RTMP_STREAM_KEY` formats.

### Dedicated Stream Entry Points (Commit 71dcba8)

**New Files**:
- `packages/client/src/stream.html` - Streaming-optimized HTML
- `packages/client/src/stream.tsx` - React streaming app

**Benefits**:
- Separate Vite bundle for streaming (smaller, faster)
- Optimized for capture performance
- Reduced memory footprint

### Viewport Mode Detection (Commit 71dcba8)

**New Utility**: `packages/shared/src/runtime/clientViewportMode.ts`

**Usage**:
```typescript
import { clientViewportMode } from '@hyperscape/shared';

const mode = clientViewportMode(); // 'stream' | 'spectator' | 'normal'

if (mode === 'stream') {
  // Streaming-specific optimizations
}
```

**Impact**: Automatic detection of stream/spectator/normal modes for conditional rendering.

## Support

For additional help:
- Review [docs/duel-stack.md](duel-stack.md) for duel stack documentation
- Check [CLAUDE.md](../CLAUDE.md) for development guidelines
- See [AGENTS.md](../AGENTS.md) for AI coding assistant instructions
- Join the community Discord for live support
