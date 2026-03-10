# Duel Stack (`bun run duel`)

`bun run duel` now boots the end-to-end agent duel arena stack:

1. Game server + client (streaming duel scheduler enabled)
2. Duel matchmaker bots (`dev:duel:skip-dev`)
3. RTMP bridge fanout to public platforms (YouTube/Twitch/etc.)
4. Betting app (testnet mode)
5. Keeper bot (testnet automation)

## Run

```bash
bun run duel
```

`bun run duel` now bootstraps streaming prerequisites automatically on first run:
- uses system FFmpeg by default (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → `ffmpeg-static`)
- auto-installs Playwright Chromium if the bundled browser is missing
- installs Chrome Beta on Linux for WebGPU streaming (via `deploy-vast.sh`)

No separate Docker stream container is required for stream fanout.

Recommended fresh-install prep command:

```bash
bun run install
```

This ensures assets are synced and Chromium is installed for local capture.

Optional flags:

```bash
bun run duel --bots=6 --betting-port=4179 --rtmp-port=8765
bun run duel --skip-keeper
bun run duel --skip-stream
bun run duel --verify
```

## Streaming Capture Configuration

### Capture Modes

**CDP Mode** (default, recommended as of March 10, 2026):
- Uses Chrome DevTools Protocol `Page.startScreencast`
- Most reliable for production streaming
- Works well with Chrome Beta + default ANGLE backend
- Lower overhead than MediaRecorder mode

**MediaRecorder Mode** (legacy):
- Uses native browser `canvas.captureStream()` API
- WebSocket transport to FFmpeg
- Requires `internalCapture=1` URL parameter
- May have compatibility issues with some GPU configurations

**Configuration**:
```bash
# Streaming capture mode (default: cdp)
STREAM_CAPTURE_MODE=cdp  # or mediarecorder

# Chrome channel (default: chrome-beta)
STREAM_CAPTURE_CHANNEL=chrome-beta

# ANGLE backend (default: default)
STREAM_CAPTURE_ANGLE=default

# Stream resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Display (for Xvfb virtual display on Linux)
DISPLAY=:99
```

### Chrome Channel Selection

- **chrome-beta** (recommended): Better stability than unstable/canary, reliable WebGPU support
- **chrome** (macOS): Standard Chrome on macOS
- **chrome-dev**: Development channel (less stable than beta)
- **chromium**: Playwright bundled Chromium (fallback)

### ANGLE Backend Selection

- **default** (recommended): Auto-selects best backend (Vulkan, OpenGL, or D3D11) for the system
- **metal** (macOS): Metal backend for macOS
- **vulkan** (Linux NVIDIA): Vulkan ANGLE backend (use if default fails on NVIDIA GPUs)
- **gl**: OpenGL backend (fallback for older GPUs)

**Why Default ANGLE Backend**:
- Automatically selects the best backend for your GPU and driver configuration
- Better cross-platform compatibility
- Reduces rendering artifacts and crashes
- Simpler configuration - no platform-specific logic needed

### FFmpeg Configuration

**FFmpeg Resolution Order** (March 10, 2026):
```bash
/usr/bin/ffmpeg → /usr/local/bin/ffmpeg → PATH → ffmpeg-static
```

**Why System FFmpeg**:
- Avoids segfaults that occur with ffmpeg-static on some systems
- Better performance with native system libraries
- More reliable for long-running streams

**Override FFmpeg Path**:
```bash
FFMPEG_PATH=/usr/local/bin/ffmpeg  # Explicit path
```

### Playwright Configuration

**Critical**: Block Playwright's `--enable-unsafe-swiftshader` injection to prevent CPU software rendering:

```typescript
// In browser launch configuration
ignoreDefaultArgs: ['--enable-unsafe-swiftshader']
```

**Why**: Playwright injects `--enable-unsafe-swiftshader` by default, forcing Chrome to use CPU-based software rendering instead of GPU acceleration. This blocks the WebGPU compositor pipeline and causes rendering failures.

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

- `RTMP_MULTIPLEXER_URL` (+ optional `RTMP_MULTIPLEXER_STREAM_KEY`, `RTMP_MULTIPLEXER_NAME`)
- `TWITCH_STREAM_KEY` (or `TWITCH_RTMP_STREAM_KEY`)
  Optional ingest override: `TWITCH_STREAM_URL` / `TWITCH_RTMP_URL` / `TWITCH_RTMP_SERVER`
- `YOUTUBE_STREAM_KEY` (or `YOUTUBE_RTMP_STREAM_KEY`)
  Optional ingest override: `YOUTUBE_STREAM_URL` / `YOUTUBE_RTMP_URL`
- `KICK_STREAM_KEY` (+ optional `KICK_RTMP_URL`)
- `PUMPFUN_RTMP_URL` (+ optional `PUMPFUN_STREAM_KEY`)
- `X_RTMP_URL` (+ optional `X_STREAM_KEY`)
- `RTMP_DESTINATIONS_JSON` for additional/custom fanout destinations
- `STREAMING_VIEWER_ACCESS_TOKEN` optional gate for live WebSocket stream/spectator viewers

**Auto-Detection**: Stream destinations are automatically detected from available stream keys. Set `STREAM_ENABLED_DESTINATIONS` to override (e.g., `twitch,kick,youtube`).

Default anti-cheat timing policy (no env required):

- Canonical platform: `youtube`
- Default public delay: `15000ms`
- Optional: `STREAMING_CANONICAL_PLATFORM` (`youtube` | `twitch`)
- Optional override: `STREAMING_PUBLIC_DELAY_MS`

Optional client-side extra delay (usually keep `0` if server delay is enabled):

- `VITE_UI_SYNC_DELAY_MS`

Website/betting embed input (recommended):

- `NEXT_PUBLIC_ARENA_STREAM_EMBED_URL` (in `packages/website/.env.local`)
- `VITE_STREAM_EMBED_URL` (in the Hyperbet app `.env*` files if you boot the sibling repo locally)

When `STREAMING_PUBLIC_DELAY_MS > 0`, live `mode=streaming` WebSocket viewers are restricted to:
- loopback/local capture clients, or
- clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when `STREAMING_VIEWER_ACCESS_TOKEN` is set.

## Spectator + Betting URLs

- Game stream view: `http://localhost:3333/?page=stream`
- Embedded spectator: `http://localhost:3333/?embedded=true&mode=spectator`
- Betting app: `http://localhost:4179` (see [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet))
- Betting video source: `VITE_STREAM_EMBED_URL` (YouTube/Twitch embed URL)

**Note**: The betting stack has been split into a separate repository. See [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) for betting app deployment.

## Open APIs (duel telemetry + monologues)

- `GET /api/streaming/state`
- `GET /api/streaming/duel-context`
- `GET /api/streaming/agent/:characterId/inventory`
- `GET /api/streaming/agent/:characterId/monologues?limit=20`

These endpoints power the betting app live duel telemetry section (inventory, wins/losses, level, HP, and internal monologues).

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Troubleshooting

### Stream Freezing or Stalling

**Problem**: Stream freezes or stalls under Xvfb + WebGPU on Vast instances.

**Solution**: Use MediaRecorder mode (default since March 2026):
```bash
STREAM_CAPTURE_MODE=mediarecorder
```

**Why**: CDP screencast can stall under Xvfb virtual displays with WebGPU rendering. MediaRecorder uses native browser `canvas.captureStream()` which is more reliable.

### WebGPU Initialization Failed

**Problem**: "WebGPU not available" or rendering artifacts.

**Solution**: Verify GPU display driver and Chrome Beta configuration:
```bash
# Check Chrome Beta is installed
google-chrome-beta --version

# Verify ANGLE backend (should be 'default', not 'vulkan')
STREAM_CAPTURE_ANGLE=default

# Check Xvfb is running
ps aux | grep Xvfb

# Verify DISPLAY environment
echo $DISPLAY  # Should be :99
```

**Vast.ai Requirements**:
- GPU instance with `gpu_display_active=true`
- NVIDIA GPU with display driver support (not just compute)
- Xvfb virtual display running before PM2 starts

### Stream Destinations Not Detected

**Problem**: RTMP streams not starting despite stream keys being set.

**Solution**: Verify stream key environment variables:
```bash
# Check stream keys are set
echo $TWITCH_STREAM_KEY
echo $KICK_STREAM_KEY
echo $YOUTUBE_STREAM_KEY

# Check auto-detected destinations
echo $STREAM_ENABLED_DESTINATIONS  # Should be: twitch,kick,youtube
```

**Auto-Detection Logic**: Destinations are detected from available stream keys. If `STREAM_ENABLED_DESTINATIONS` is not set, it's auto-detected from:
- `TWITCH_STREAM_KEY` or `TWITCH_RTMP_STREAM_KEY` → adds `twitch`
- `KICK_STREAM_KEY` → adds `kick`
- `YOUTUBE_STREAM_KEY` or `YOUTUBE_RTMP_STREAM_KEY` → adds `youtube`

### Database Connection Errors

**Problem**: "timeout exceeded when trying to connect" or FATAL database errors.

**Solution**: Connection pool increased to 20 (March 2026). Verify configuration:
```bash
# Check database mode (auto-detected from DATABASE_URL)
echo $DUEL_DATABASE_MODE  # Should be 'remote' for external PostgreSQL

# Verify DATABASE_URL is set
echo $DATABASE_URL

# Check connection pool settings
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
```

**PM2 Environment**: Ensure `ecosystem.config.cjs` explicitly forwards `DATABASE_URL` through PM2 environment.

### CSRF 403 Errors

**Problem**: Account creation fails with "CSRF validation failed" when running client on localhost against deployed server.

**Solution**: Fixed in March 2026 (commit 0b1a0bd). Ensure:
- Client includes Privy auth token in Authorization header
- Server CSRF middleware allows localhost/private IP origins
- Both `{ token }` and `{ csrfToken }` response formats are supported

### CDN Asset Loading Issues

**Problem**: Assets fail to load (404 errors) in production streaming deployments.

**Solution**: Verify CDN URL configuration:
```bash
# Check CDN URL (should be production CDN, not localhost)
echo $DUEL_PUBLIC_CDN_URL  # Should be: https://assets.hyperscape.club

# Verify in ecosystem.config.cjs
DUEL_PUBLIC_CDN_URL: process.env.PUBLIC_CDN_URL || "https://assets.hyperscape.club"
```

## Recent Changes (March 2026)

### MediaRecorder Streaming Capture (March 10, 2026)

**Change**: Switched from CDP screencast to MediaRecorder mode for streaming capture.

**Rationale**: CDP screencast stalls under Xvfb + WebGPU on Vast instances. MediaRecorder uses `canvas.captureStream()` → WebSocket → FFmpeg which is more reliable for headed Linux environments.

**Configuration**:
```bash
STREAM_CAPTURE_MODE=mediarecorder  # Default (changed from 'cdp')
```

### Chrome Beta for Streaming (March 9, 2026)

**Change**: Switched from Chrome Unstable to Chrome Beta for better stability.

**Configuration**:
```bash
STREAM_CAPTURE_CHANNEL=chrome-beta  # Changed from 'chrome-unstable'
STREAM_CAPTURE_ANGLE=default        # Changed from 'vulkan'
```

### Database Auto-Detection (March 9-10, 2026)

**Change**: Database mode now auto-detected from `DATABASE_URL` hostname.

**Logic**:
- localhost/127.0.0.1/0.0.0.0/::1 → local mode
- All other hostnames → remote mode
- Manual override via `DUEL_DATABASE_MODE=remote`

### PostgreSQL Connection Pool Increase (March 10, 2026)

**Change**: Increased connection pool from 10 to 20 connections.

**Configuration**:
```bash
POSTGRES_POOL_MAX=20  # Up from 10
POSTGRES_POOL_MIN=2
```

**Impact**: Prevents database timeout errors under high load from concurrent agent queries.

### PM2 Secrets Loading (March 9, 2026)

**Change**: `ecosystem.config.cjs` now reads `/tmp/hyperscape-secrets.env` directly at config load time.

**Rationale**: `bunx pm2` doesn't reliably inherit exported environment variables from deploy shell scripts.

**Impact**: Ensures `DATABASE_URL` and stream keys are always available to PM2-managed processes.

### Xvfb Display Environment (March 9, 2026)

**Change**: `ecosystem.config.cjs` explicitly sets `DISPLAY=:99` in PM2 environment.

**Impact**: Ensures streaming processes can access Xvfb virtual display for WebGPU rendering.

### Stream Destination Auto-Detection (March 9, 2026)

**Change**: Stream destinations now auto-detected from available stream keys.

**Logic**: `deploy-vast.sh` detects enabled destinations using `||` logic:
```bash
DESTS=""
if [ -n "${TWITCH_STREAM_KEY:-${TWITCH_RTMP_STREAM_KEY:-}}" ]; then
    DESTS="twitch"
fi
if [ -n "${KICK_STREAM_KEY:-}" ]; then
    DESTS="${DESTS:+${DESTS},}kick"
fi
export STREAM_ENABLED_DESTINATIONS="$DESTS"
```

**Impact**: No manual configuration needed - just set stream keys and destinations are auto-detected.
