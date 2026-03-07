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
- uses bundled `ffmpeg-static` binary by default (or `FFMPEG_PATH` if provided)
- auto-installs Playwright Chromium if the bundled browser is missing

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

Default anti-cheat timing policy (no env required):

- Canonical platform: `youtube`
- Default public delay: `15000ms`
- Optional: `STREAMING_CANONICAL_PLATFORM` (`youtube` | `twitch`)
- Optional override: `STREAMING_PUBLIC_DELAY_MS`

Optional client-side extra delay (usually keep `0` if server delay is enabled):

- `VITE_UI_SYNC_DELAY_MS`

Website/betting embed input (recommended):

- `NEXT_PUBLIC_ARENA_STREAM_EMBED_URL` (in `packages/website/.env.local`)
- `VITE_STREAM_EMBED_URL` (in `packages/gold-betting-demo/app/.env*`)

When `STREAMING_PUBLIC_DELAY_MS > 0`, live `mode=streaming` WebSocket viewers are restricted to:
- loopback/local capture clients, or
- clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when `STREAMING_VIEWER_ACCESS_TOKEN` is set.

## New Streaming Configuration (March 2026)

### Model Agent Spawning

Auto-create agents when database is empty (useful for fresh deployments):

```bash
SPAWN_MODEL_AGENTS=true
```

### Stream Keep-Alive (Placeholder Frame Mode)

Prevent 30-minute disconnects during idle periods:

```bash
STREAM_PLACEHOLDER_ENABLED=true
```

When enabled:
- Detects when no frames received for 5 seconds
- Switches to minimal JPEG frames at configured FPS
- Automatically exits when live frames resume
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size

### Production Client Build

Use pre-built client for significantly faster page loads:

```bash
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

Benefits:
- Serves pre-built client via `vite preview` instead of dev server
- Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
- Significantly faster page loads (no on-demand module compilation)

### Stream Capture Configuration

Advanced stream capture settings:

```bash
# Explicit Chrome executable path for reliable WebGPU support
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable

# Use zerolatency tune for faster playback start (default: film tune with B-frames)
STREAM_LOW_LATENCY=true

# GOP size in frames (default: 60)
STREAM_GOP_SIZE=60

# Enable audio capture from browser
STREAM_AUDIO_ENABLED=true

# PulseAudio device name for audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

### Database Configuration

For crash loop resilience:

```bash
POSTGRES_POOL_MAX=3              # Prevent connection exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also update PM2 configuration in `ecosystem.config.cjs`:

```javascript
restart_delay: 10000,            // 10s instead of 5s (allow connections to close)
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

## Spectator + Betting URLs

- Game stream view: `http://localhost:3333/?page=stream`
- Embedded spectator: `http://localhost:3333/?embedded=true&mode=spectator`
- Betting app: `http://localhost:4179`
- Betting video source: `VITE_STREAM_EMBED_URL` (YouTube/Twitch embed URL)

## Open APIs (duel telemetry + monologues)

- `GET /api/streaming/state`
- `GET /api/streaming/duel-context`
- `GET /api/streaming/agent/:characterId/inventory`
- `GET /api/streaming/agent/:characterId/monologues?limit=20`

These endpoints power the betting app live duel telemetry section (inventory, wins/losses, level, HP, and internal monologues).

## Admin APIs (NEW)

### Graceful Restart (Zero-Downtime Deployments)

Request server restart after current duel ends:

```bash
# Request graceful restart (requires ADMIN_CODE)
curl -X POST http://localhost:5555/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://localhost:5555/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active: restarts immediately via SIGTERM
- If duel in progress: waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

**Programmatic API:**
```typescript
import { StreamingDuelScheduler } from './systems/StreamingDuelScheduler';

// Request graceful restart
scheduler.requestGracefulRestart();
```

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Streaming Health Check (NEW)

Quick diagnostic for verifying streaming health:

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

Useful for debugging streaming issues on Vast.ai or other production deployments.

## Troubleshooting

### WebGPU Not Initializing

**Symptoms:**
- Browser timeout during page load
- Stream capture fails to start
- GPU diagnostics show WebGPU unavailable

**Solutions:**

1. **Use Vast.ai Provisioner** (ensures WebGPU support):
   ```bash
   VAST_API_KEY=xxx bun run vast:provision
   ```
   
   This automatically searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU).

2. **Check GPU Display Driver**:
   ```bash
   nvidia-smi  # Should show display mode, not just compute
   ```

3. **Verify WebGPU Initialization**:
   - Check deployment logs for GPU display driver detection
   - Run `bun run duel:status` to check streaming health
   - Ensure instance has NVIDIA display driver support

4. **Use Production Client Build**:
   ```bash
   NODE_ENV=production
   DUEL_USE_PRODUCTION_CLIENT=true
   ```
   
   Significantly faster page loads (no on-demand module compilation).

### Stream Disconnects

**30-minute disconnect during idle periods:**

Enable placeholder frame mode:
```bash
STREAM_PLACEHOLDER_ENABLED=true
```

**Frequent disconnects during active duels:**

Check RTMP bridge status:
```bash
bun run duel:status
```

Verify stream keys are correctly configured in `.env`.

### Database Connection Issues

**"too many clients already" errors:**

Set lower connection pool limits:
```bash
POSTGRES_POOL_MAX=3              # For streaming deployments
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Update PM2 restart delays:
```javascript
// In ecosystem.config.cjs
restart_delay: 10000,            // 10s instead of 5s
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

**Railway-specific issues:**

Railway is auto-detected via `RAILWAY_ENVIRONMENT` env var. The system automatically:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits (max: 6)
- Prevents connection exhaustion

### Deployment Issues

**Deploy script kills itself:**

Fixed in commit 087033fa - now uses targeted process killing instead of blanket `pkill -f bun`.

**"too many clients" during migrations:**

Fixed in commit 58d88f4c - process teardown happens before database migrations.

**Branch mismatch:**

Fixed in commit dbd4332d - deploys from main branch instead of hackathon branch.
