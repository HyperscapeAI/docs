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

## Production Client Build

For faster page loads and to fix browser timeout issues (>180s), enable production client build mode:

```bash
# In packages/server/.env or root .env
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
```

**Benefits**:
- Serves pre-built client via `vite preview` instead of dev server
- Page loads in <10s instead of >180s
- No on-demand module compilation
- Fixes browser navigation timeout errors

## Stream Capture Configuration

### Chrome Executable
```bash
# Explicit Chrome path for reliable WebGPU
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

### Capture Modes
- **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
- **WebCodecs**: Native VideoEncoder API (experimental)
- **MediaRecorder**: Legacy fallback mode

### Timeouts & Recovery
```bash
# Probe timeout: 5s on evaluate calls
# Probe retry: Proceeds after 5 consecutive timeouts
# Viewport recovery: Automatic on resolution mismatch
# Browser restart: Every 45 minutes (prevents WebGPU OOM)
```

### Encoding Settings
```bash
# Low-latency mode (zerolatency tune)
STREAM_LOW_LATENCY=true

# GOP size (default: 60 frames)
STREAM_GOP_SIZE=60

# Buffer multiplier: 2x (reduced from 4x)
# Health check: 5s (data timeout: 15s)
```

## Audio Capture

```bash
# Enable audio capture
STREAM_AUDIO_ENABLED=true

# PulseAudio device
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# User-mode PulseAudio runtime
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

## WebGPU Requirements

**CRITICAL**: Streaming requires WebGPU support. The browser must have:
- Chrome 113+ (recommended: google-chrome-unstable)
- NVIDIA GPU with Vulkan support
- Display server (Xorg or Xvfb) or Ozone headless mode
- GPU sandbox bypass flags for containers

See [streaming-configuration.md](streaming-configuration.md) for complete WebGPU setup.

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

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Troubleshooting

### Browser Timeout (>180s)
**Solution**: Enable production client build mode (see above)

### WebGPU Not Available
**Solution**: Check GPU diagnostics:
```bash
nvidia-smi  # Verify GPU
google-chrome-unstable --version  # Verify Chrome
echo $DISPLAY  # Verify display server
```

### Stream Not Starting
**Solution**: Check RTMP bridge logs:
```bash
pm2 logs rtmp-bridge
```

### Audio Not Captured
**Solution**: Verify PulseAudio:
```bash
pactl info  # Check PulseAudio is running
pactl list sinks | grep chrome_audio  # Verify virtual sink
```

## See Also

- [streaming-configuration.md](streaming-configuration.md) - Complete streaming configuration guide
- [vast-ai-deployment.md](vast-ai-deployment.md) - Vast.ai GPU deployment guide
- `scripts/stream-to-rtmp.ts` - Stream capture implementation
- `ecosystem.config.cjs` - PM2 process configuration
