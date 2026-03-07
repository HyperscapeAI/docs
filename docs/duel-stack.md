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

### Placeholder Frame Mode

**Prevents 30-minute stream disconnects during idle periods:**

```bash
# In packages/server/.env or root .env
STREAM_PLACEHOLDER_ENABLED=true
```

When enabled, the RTMP bridge will:
- Detect when no frames are received for 5 seconds
- Switch to placeholder mode, sending minimal JPEG frames at configured FPS
- Automatically exit placeholder mode when live frames resume

This keeps Twitch/YouTube streams alive during content gaps and prevents the 30-minute disconnect that occurs when streams appear "idle".

**How it works:**
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size
- Sends frames at configured FPS (default: 30fps)
- Zero CPU overhead - just pipes pre-generated JPEG buffer
- Automatically exits when live game frames resume

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

## Zero-Downtime Deployments

### Graceful Restart API

Request a server restart after the current duel ends (requires `ADMIN_CODE`):

```bash
# Request graceful restart
curl -X POST http://localhost:5555/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://localhost:5555/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Behavior:**
- If no duel active (IDLE/ANNOUNCEMENT): restarts immediately via SIGTERM
- If duel in progress (FIGHTING/RESOLUTION): waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

**Response:**
```json
{
  "success": true,
  "message": "Graceful restart scheduled after current duel (phase: FIGHTING)",
  "pendingRestart": true,
  "currentPhase": "FIGHTING"
}
```

**Use cases:**
- Deploy new code without interrupting active duels
- Update server configuration during live streams
- Restart after memory leak detection
- Apply security patches with minimal disruption

### Programmatic API

```typescript
import { getStreamingDuelScheduler } from './systems/StreamingDuelScheduler';

const scheduler = getStreamingDuelScheduler();

// Request graceful restart
const scheduled = scheduler.requestGracefulRestart();

// Check if restart is pending
const isPending = scheduler.isPendingRestart();
```

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Monitoring

### Streaming Health Check

Quick diagnostic for verifying streaming health on Vast.ai or other deployments:

```bash
bun run duel:status
```

This checks:
- Server health endpoint (`/health`)
- Streaming API status (`/api/streaming/state`)
- Duel context (fighting phase, contestants)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs (last 50 lines)

**Output example:**
```
[✓] Server health: OK
[✓] Streaming API: OK (phase: FIGHTING)
[✓] RTMP bridge: 3 destinations, 45.2 MB streamed
[✓] PM2 processes: 2 running
[✓] Recent logs: No errors in last 50 lines
```

### Database Connection Monitoring

For Railway and other managed PostgreSQL deployments, monitor connection pool health:

```bash
# Check current pool stats
curl http://localhost:5555/admin/pools/stats \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Railway-specific notes:**
- Railway auto-detects via `RAILWAY_ENVIRONMENT` env var
- Uses lower connection pool limits (max: 6) for pgbouncer compatibility
- Disables prepared statements automatically
- Prevents "too many clients already" errors

## Troubleshooting

### Stream Disconnects After 30 Minutes

**Symptom:** Twitch/YouTube disconnects stream after ~30 minutes of idle content

**Solution:** Enable placeholder frame mode:
```bash
STREAM_PLACEHOLDER_ENABLED=true
```

This sends minimal frames during idle periods to keep the stream alive.

### Database Connection Exhaustion

**Symptom:** "too many clients already" errors, especially during crash loops

**Solution:** Reduce connection pool size:
```bash
POSTGRES_POOL_MAX=3              # Down from default 6
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also increase PM2 restart delay:
```javascript
// In ecosystem.config.cjs
restart_delay: 10000,            // 10s instead of 5s
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

### Deployment Interrupts Active Duel

**Symptom:** Deploying new code kills active duels mid-fight

**Solution:** Use graceful restart API:
```bash
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

The server will wait for the current duel to complete before restarting.

### WebGPU Not Initializing on Vast.ai

**Symptom:** Browser timeout or black screen during page load

**Solutions:**
1. Ensure instance has `gpu_display_active=true` (use `bun run vast:provision`)
2. Check deployment logs for GPU display driver detection
3. Run `bun run duel:status` to check streaming health
4. Verify NVIDIA display driver: `nvidia-smi` should show display mode
5. Set `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true` for faster page loads

### Browser Timeout During Page Load

**Symptom:** Page load takes >180s and times out

**Solution:** Use production client build:
```bash
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

This serves pre-built client via `vite preview` instead of dev server, eliminating on-demand module compilation.
