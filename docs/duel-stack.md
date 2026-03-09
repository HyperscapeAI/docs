# Duel Stack (`bun run duel`)

`bun run duel` now boots the end-to-end agent duel arena stack:

1. Game server + client (streaming duel scheduler enabled)
2. Duel matchmaker bots (`dev:duel:skip-dev`)
3. RTMP bridge fanout to public platforms (YouTube/Twitch/Kick/etc.)
4. Betting app (testnet mode) - **Note**: Now in separate [hyperbet repository](https://github.com/HyperscapeAI/hyperbet)
5. Keeper bot (testnet automation) - **Note**: Now in separate [hyperbet repository](https://github.com/HyperscapeAI/hyperbet)

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
bun install
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

**Auto-Detection** (March 2026): Stream destinations are now auto-detected from available keys. Set any of the following and `STREAM_ENABLED_DESTINATIONS` will be automatically configured:

- `TWITCH_STREAM_KEY` (or `TWITCH_RTMP_STREAM_KEY`)
  - Optional ingest override: `TWITCH_STREAM_URL` / `TWITCH_RTMP_URL` / `TWITCH_RTMP_SERVER`
  - Default: `rtmp://live.twitch.tv/app`
- `YOUTUBE_STREAM_KEY` (or `YOUTUBE_RTMP_STREAM_KEY`)
  - Optional ingest override: `YOUTUBE_STREAM_URL` / `YOUTUBE_RTMP_URL`
  - Default: `rtmp://a.rtmp.youtube.com/live2`
- `KICK_STREAM_KEY`
  - Optional ingest override: `KICK_RTMP_URL`
  - Default: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`
- `PUMPFUN_RTMP_URL` (+ optional `PUMPFUN_STREAM_KEY`)
- `X_RTMP_URL` (+ optional `X_STREAM_KEY`)
- `RTMP_MULTIPLEXER_URL` (+ optional `RTMP_MULTIPLEXER_STREAM_KEY`, `RTMP_MULTIPLEXER_NAME`)
- `RTMP_DESTINATIONS_JSON` for additional/custom fanout destinations

**Manual Override**: If you need to manually specify destinations, set:
```bash
STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube
```

**Viewer Access Control**:
```bash
# Optional gate for live WebSocket stream/spectator viewers
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

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
- Betting app: `http://localhost:4179` - **Note**: Now in [hyperbet repository](https://github.com/HyperscapeAI/hyperbet)
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

## Streaming Pipeline Architecture (March 2026)

### Entry Points

**Dedicated Streaming Entry Points**:
- `packages/client/src/stream.html` - Streaming-optimized HTML entry point
- `packages/client/src/stream.tsx` - React streaming app with minimal UI
- Multi-page Vite build configuration for separate game/stream bundles

**Viewport Mode Detection**:
```typescript
import { clientViewportMode } from '@hyperscape/shared';

const mode = clientViewportMode(); // 'stream' | 'spectator' | 'normal'
```

### Auto-Detection Logic

The deployment script (`scripts/deploy-vast.sh`) automatically detects enabled destinations:

```bash
# Auto-detect from available keys
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

### PM2 Environment Forwarding

The PM2 ecosystem config (`ecosystem.config.cjs`) explicitly forwards stream keys:

```javascript
env: {
  TWITCH_STREAM_URL: process.env.TWITCH_STREAM_URL || "rtmp://live.twitch.tv/app",
  TWITCH_STREAM_KEY: process.env.TWITCH_STREAM_KEY || process.env.TWITCH_RTMP_STREAM_KEY || "",
  KICK_STREAM_KEY: process.env.KICK_STREAM_KEY || "",
  KICK_RTMP_URL: process.env.KICK_RTMP_URL || "rtmps://fa723fc1b171.global-contribute.live-video.net/app",
  STREAM_ENABLED_DESTINATIONS: process.env.STREAM_ENABLED_DESTINATIONS || process.env.DUEL_STREAM_DESTINATIONS || "",
  YOUTUBE_STREAM_URL: process.env.YOUTUBE_STREAM_URL || "rtmp://a.rtmp.youtube.com/live2",
}
```

### Secret Aliases

The GitHub Actions workflow (`.github/workflows/deploy-vast.yml`) adds secret aliases for compatibility:

```yaml
- name: Write secrets file
  run: |
    cat > /tmp/hyperscape-secrets.env <<'EOF'
    TWITCH_RTMP_STREAM_KEY=${{ secrets.TWITCH_STREAM_KEY }}
    KICK_STREAM_KEY=${{ secrets.KICK_STREAM_KEY }}
    EOF
```

This ensures both `TWITCH_STREAM_KEY` and `TWITCH_RTMP_STREAM_KEY` formats are supported.

## Troubleshooting

### Stream Not Starting

**Check stream keys are set**:
```bash
echo $TWITCH_STREAM_KEY
echo $KICK_STREAM_KEY
echo $YOUTUBE_STREAM_KEY
```

**Verify auto-detection**:
```bash
echo $STREAM_ENABLED_DESTINATIONS
# Should output: twitch,kick (or similar based on available keys)
```

**Check FFmpeg**:
```bash
which ffmpeg
# or
echo $FFMPEG_PATH
```

**Check Playwright Chromium**:
```bash
bunx playwright install chromium
```

### GPU/WebGPU Issues

**Vast.ai Requirements**:
- GPU display driver must be active: `gpu_display_active=true`
- Not just compute access - WebGPU requires display driver support
- Chrome Dev channel with WebGPU enabled
- Xorg or Xvfb for window context

**Verify WebGPU**:
```bash
# Check Chrome version
google-chrome-unstable --version

# Test WebGPU availability
bun run test:webgpu
```

### PM2 Process Issues

**Check process status**:
```bash
bunx pm2 status
bunx pm2 logs hyperscape-duel
```

**Restart stack**:
```bash
bunx pm2 restart ecosystem.config.cjs
```

**Full reset**:
```bash
bunx pm2 delete all
bunx pm2 start ecosystem.config.cjs
```

### RTMP Bridge Status

**Check bridge health**:
```bash
curl http://localhost:5555/api/streaming/state
```

**Verify destinations**:
```bash
bun run duel:verify --require-destinations=twitch,youtube
```

### Database Connection Issues

If seeing "timeout exceeded when trying to connect" errors:
- Check `DUEL_DATABASE_MODE` is set correctly (`local` or `remote`)
- Verify PostgreSQL is running: `pg_isready -h 127.0.0.1 -p 5432`
- Check connection pool settings in `ecosystem.config.cjs`
- Review database logs: `tail -f logs/duel-error.log`

## Recent Changes (March 2026)

### Streaming Pipeline Fixes (Commit 41dc606)

**Auto-Detection**: Stream destinations now auto-detected from available stream keys.

**Changes**:
- `deploy-vast.sh`: Auto-detects `STREAM_ENABLED_DESTINATIONS` from `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, etc.
- `ecosystem.config.cjs`: Explicitly forwards stream keys through PM2 environment
- `deploy-vast.yml`: Adds `TWITCH_RTMP_STREAM_KEY` alias to secrets file

**Impact**: No manual configuration needed - just set stream keys and destinations are auto-detected.

### Dedicated Stream Entry Points (Commit 71dcba8)

**New Files**:
- `packages/client/src/stream.html` - Streaming-optimized HTML entry point
- `packages/client/src/stream.tsx` - React streaming app
- `packages/shared/src/runtime/clientViewportMode.ts` - Viewport mode detection utility

**Multi-Page Build**:
- Vite now builds separate bundles for game and streaming
- Reduced bundle size for streaming entry point
- Optimized for capture performance

**Impact**: Faster streaming startup, reduced memory footprint, better capture performance.

### Stream Viewer Access Control (Commit 71dcba8)

**New Module**: `packages/server/src/streaming/stream-viewer-access-token.ts`

**Configuration**:
```bash
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

**Behavior**:
- When `STREAMING_PUBLIC_DELAY_MS > 0`, live WebSocket viewers are restricted
- Loopback/local capture clients always allowed
- External clients must present `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`
- `stream-to-rtmp` automatically appends token to capture URLs

**Impact**: Secure access control for live stream viewers to prevent anti-cheat bypass.

### Offer Utils (Commit 71dcba8)

**New Module**: `packages/vast-keeper/src/offer-utils.ts`

**Features**:
- Vast.ai GPU instance filtering by display driver support
- Sorting by price, GPU count, and availability
- Automatic selection of optimal streaming instances

**Impact**: Simplified Vast.ai instance selection for streaming deployments.
