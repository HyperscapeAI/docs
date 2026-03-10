# Duel Stack (`bun run duel`)

`bun run duel` now boots the end-to-end agent duel arena stack:

1. Game server + client (streaming duel scheduler enabled)
2. Duel matchmaker bots (`dev:duel:skip-dev`)
3. RTMP bridge fanout to public platforms (YouTube/Twitch/Kick/etc.)
4. ElizaOS AI agents (13 frontier models via ElizaCloud)

**Note**: The betting app and keeper bot have been moved to [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet). The duel arena oracle remains in Hyperscape for verifiable outcome publishing.

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
bun run duel --bots=6 --rtmp-port=8765
bun run duel --skip-stream
bun run duel --verify
```

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

### Auto-Detection (Recommended)

Stream destinations are auto-detected from available stream keys. Just set the keys you want to use:

```bash
# Twitch (multiple formats supported)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij  # Alias supported

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx  # Alias supported

# Auto-detected destinations (no manual config needed)
# STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube
```

### Manual Configuration

Override auto-detection with explicit destination list:

```bash
STREAM_ENABLED_DESTINATIONS=twitch,youtube
```

### Streaming Capture Configuration

```bash
# Chrome channel (chrome-beta recommended for stability)
STREAM_CAPTURE_CHANNEL=chrome-beta

# ANGLE backend (default recommended for compatibility)
STREAM_CAPTURE_ANGLE=default

# Capture resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Xvfb virtual display (for headless servers)
DISPLAY=:99
```

### Additional Streaming Options

- `RTMP_MULTIPLEXER_URL` (+ optional `RTMP_MULTIPLEXER_STREAM_KEY`, `RTMP_MULTIPLEXER_NAME`)
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

When `STREAMING_PUBLIC_DELAY_MS > 0`, live `mode=streaming` WebSocket viewers are restricted to:
- loopback/local capture clients, or
- clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when `STREAMING_VIEWER_ACCESS_TOKEN` is set.

## Spectator URLs

- **Game stream view**: `http://localhost:3333/?page=stream`
- **Embedded spectator**: `http://localhost:3333/?embedded=true&mode=spectator`
- **Dedicated streaming entry**: `http://localhost:3333/stream.html`

### Viewport Mode Detection

The client automatically detects viewport mode using `clientViewportMode.ts`:

```typescript
import { isStreamPageRoute, isEmbeddedSpectatorViewport, isStreamingLikeViewport } from '@hyperscape/shared';

// Detect streaming capture mode
if (isStreamPageRoute(window)) {
  // Optimized for streaming capture
}

// Detect embedded spectator
if (isEmbeddedSpectatorViewport(window)) {
  // Embedded spectator UI
}

// Detect any streaming-like viewport
if (isStreamingLikeViewport(window)) {
  // Minimal UI overhead
}
```

## Open APIs (duel telemetry + monologues)

- `GET /api/streaming/state`
- `GET /api/streaming/duel-context`
- `GET /api/streaming/agent/:characterId/inventory`
- `GET /api/streaming/agent/:characterId/monologues?limit=20`

These endpoints power betting app live duel telemetry (inventory, wins/losses, level, HP, and internal monologues).

## Duel Arena Oracle

The duel arena oracle publishes verifiable duel outcomes to EVM and Solana:

```bash
# Enable oracle
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet, all

# Metadata API
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle

# Shared signers
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
```

**Oracle Endpoints:**
- `GET /api/duel-arena/oracle/recent` - Recent duel outcomes
- `GET /api/duel-arena/oracle/duels/:duelId` - Specific duel outcome with chain state

**Oracle Fields:**
- `damageA`, `damageB` - Total damage dealt by each participant
- `winReason` - Detailed win reason (knockout, timeout, forfeit, draw)
- `seed` - Cryptographic seed for replay verification
- `replayHashHex` - Hash of replay data
- `resultHashHex` - Combined hash of all outcome data

See `docs/duel-arena-oracle-deploy.md` for deployment guide.

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates server/client uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Recent Improvements (March 2026)

### Streaming Enhancements
- **Chrome Beta**: Switched to `google-chrome-beta` for better stability (commit 547714e)
- **ANGLE Backend**: Default ANGLE backend for better GPU compatibility (commit 547714e)
- **Auto-Detection**: Stream destinations auto-detected from available keys (commit 41dc606)
- **Streaming Entry Points**: Dedicated `stream.html` and `stream.tsx` for optimized capture (commit 71dcba8)
- **Viewport Detection**: Automatic stream/spectator mode detection (commit 71dcba8)

### Deployment Fixes
- **PM2 Secrets**: Direct secrets loading in `ecosystem.config.cjs` (commit 684b203)
- **Database Mode**: Auto-detection from `DATABASE_URL` hostname (commit 3df4370)
- **Xvfb Display**: Fixed startup order for virtual display (commits 294a36c, 704b955)
- **Environment Forwarding**: Explicit `DATABASE_URL` and `DISPLAY` forwarding (commits 5d415fc, 704b955)
- **CDN URL**: Production CDN URL for Vast deployments (commit 2b3cbcb)

### AI & Oracle
- **ElizaCloud**: Unified access to 13 frontier models (commit 4d1eb53)
- **Oracle Fields**: Added damage, winReason, seed, replay/result hashes (commit aecab58)
- **Betting Split**: Moved to [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) (commit 428329d)

## Troubleshooting

### Streaming Issues

**RTMP stream not starting:**
- Verify stream keys are set: `TWITCH_STREAM_KEY`, `KICK_STREAM_KEY`, `YOUTUBE_STREAM_KEY`
- Check `STREAM_ENABLED_DESTINATIONS` is set or auto-detected
- Ensure FFmpeg is installed: `which ffmpeg`
- Verify Playwright Chromium: `bunx playwright install chromium`

**WebGPU errors:**
- Check GPU display driver is active (Vast.ai: `gpu_display_active=true`)
- Verify Chrome Beta is installed: `google-chrome-beta --version`
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment: `echo $DISPLAY` (should be `:99`)

**Database connection errors:**
- Check `DATABASE_URL` is set correctly
- Verify connection pool settings: `POSTGRES_POOL_MAX=20`
- Review PM2 logs: `bunx pm2 logs hyperscape-duel`

### Agent Issues

**Agents not spawning:**
- Verify `ELIZAOS_CLOUD_API_KEY` is set
- Check `SPAWN_MODEL_AGENTS=true` and `MAX_MODEL_AGENTS=13`
- Review agent logs in ElizaOS API

**High memory usage:**
- Ensure InMemoryDatabaseAdapter is being used (not PGLite)
- Verify memory caps are in place (50 memories, 20 logs, 100 cache entries)
- Check periodic GC is running (every 60s)

## Related Documentation

- `AGENTS.md` - AI agent features and recent changes
- `CLAUDE.md` - Development guidelines
- `docs/duel-arena-oracle-deploy.md` - Oracle deployment guide
- [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) - Betting stack (separate repository)
