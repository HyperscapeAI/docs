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

**New Streaming Features:**

- `STREAM_PLACEHOLDER_ENABLED=true` - Send placeholder frames during idle periods (prevents 30-minute disconnect)
- `SPAWN_MODEL_AGENTS=true` - Auto-create agents when database is empty (useful for fresh deployments)
- `STREAM_CAPTURE_EXECUTABLE=...` - Explicit Chrome path for WebGPU (e.g., `/usr/bin/google-chrome-unstable`)
- `STREAM_LOW_LATENCY=true` - Use zerolatency tune for faster playback start
- `STREAM_GOP_SIZE=60` - GOP size in frames (default: 60)
- `STREAM_AUDIO_ENABLED=true` - Enable audio capture
- `PULSE_AUDIO_DEVICE=...` - PulseAudio device name

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

## Monitoring & Diagnostics

**Streaming Status Check** (NEW):

```bash
bun run duel:status
```

Quick diagnostic for verifying streaming health on Vast.ai or Railway:
- Server health endpoint
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs

**Graceful Restart** (Zero-Downtime Deployments):

Request a server restart after the current duel ends:

```bash
# Via API (requires ADMIN_CODE)
curl -X POST http://localhost:5555/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://localhost:5555/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active (IDLE/ANNOUNCEMENT): restart immediately via SIGTERM
- If duel in progress (FIGHTING/RESOLUTION): wait until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

Returns: `{ success: true, pendingRestart: boolean, currentPhase: string }`

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Troubleshooting

**Stream disconnects after 30 minutes:**
- Enable placeholder frame mode: `STREAM_PLACEHOLDER_ENABLED=true`
- Sends minimal JPEG frames during idle periods to keep stream alive
- Automatically exits when live frames resume

**WebGPU not initializing:**
- For Vast.ai: Ensure instance has `gpu_display_active=true` (use `bun run vast:provision`)
- Check deployment logs for GPU display driver detection
- Run `bun run duel:status` to check streaming health
- Verify NVIDIA display driver: `nvidia-smi` should show display mode

**Browser timeout during page load:**
- Set `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
- Use pre-built client via `vite preview` instead of dev server
- Significantly faster page loads (no on-demand module compilation)

**Database "too many clients" errors:**
- Set `POSTGRES_POOL_MAX=3` (or 1 for duel deployments)
- Set `POSTGRES_POOL_MIN=0` to not hold idle connections
- Increase `restart_delay=10s` in PM2 config
- Railway is auto-detected via `RAILWAY_ENVIRONMENT` env var

**Deploy script killing itself:**
- Fixed in recent commits - now uses targeted process killing
- Avoids `pkill -f bun` which killed the deploy script
- Uses specific process names for graceful shutdown
