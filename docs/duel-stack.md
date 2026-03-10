# Duel Stack (`bun run duel`)

`bun run duel` boots the end-to-end agent duel arena stack:

1. Game server + client (streaming duel scheduler enabled)
2. Duel matchmaker bots with ElizaCloud AI models
3. RTMP bridge fanout to public platforms (Twitch/Kick/YouTube)
4. Duel arena oracle publisher (EVM + Solana)

**Note**: The betting app and keeper bot have been moved to a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

## Run

```bash
bun run duel
```

`bun run duel` bootstraps streaming prerequisites automatically on first run:
- Uses bundled `ffmpeg-static` binary by default (or `FFMPEG_PATH` if provided)
- Auto-installs Playwright Chromium if the bundled browser is missing
- No separate Docker stream container required

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

## Streaming Configuration

### Auto-Detection (March 2026)

Stream destinations are now **auto-detected** from available stream keys. Just set the keys you want to use:

```bash
# packages/server/.env
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
```

The deployment script automatically detects enabled destinations and sets `STREAM_ENABLED_DESTINATIONS=twitch,kick,youtube`.

### Supported Platforms

**Twitch**:
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
# or
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij

# Optional ingest override
TWITCH_STREAM_URL=rtmp://live.twitch.tv/app
```

**Kick**:
```bash
KICK_STREAM_KEY=your-kick-stream-key

# Optional ingest override
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
```

**YouTube**:
```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
# or
YOUTUBE_RTMP_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx

# Optional ingest override
YOUTUBE_STREAM_URL=rtmp://a.rtmp.youtube.com/live2
```

**Custom/Multiplexer**:
```bash
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://your-multiplexer/live
RTMP_MULTIPLEXER_STREAM_KEY=your-key

# Or JSON config for multiple custom destinations
RTMP_DESTINATIONS_JSON=[{"name":"Custom","url":"rtmp://host/live","key":"key","enabled":true}]
```

### Streaming Capture Settings

**Chrome Beta (Recommended)**:
```bash
STREAM_CAPTURE_CHANNEL=chrome-beta  # Better stability than unstable/dev
STREAM_CAPTURE_ANGLE=default        # Auto-selects best backend (Vulkan/OpenGL/D3D11)
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

**Xvfb Virtual Display** (Vast.ai/headless servers):
```bash
DISPLAY=:99  # Set by deploy-vast.sh automatically
```

### Anti-Cheat Timing

**Default Policy**:
```bash
STREAMING_CANONICAL_PLATFORM=youtube  # or twitch
STREAMING_PUBLIC_DELAY_MS=15000       # Auto-set based on platform (youtube=15s, twitch=12s)
```

**Viewer Access Control**:
```bash
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

When `STREAMING_PUBLIC_DELAY_MS > 0`, live WebSocket viewers are restricted to:
- Loopback/local capture clients (always allowed)
- External clients with `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

The `stream-to-rtmp` script automatically appends the token to capture URLs.

## ElizaCloud AI Models (March 2026)

All duel arena agents now use ElizaCloud for unified model access.

**Configuration**:
```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

**13 Frontier Models**:

**American Models**:
- `openai/gpt-5` - GPT-5
- `anthropic/claude-sonnet-4.6` - Claude Sonnet 4.6
- `anthropic/claude-opus-4.6` - Claude Opus 4.6
- `google/gemini-3.1-pro-preview` - Gemini 3.1 Pro
- `xai/grok-4` - Grok 4
- `meta/llama-4-maverick` - Llama 4 Maverick
- `mistral/magistral-medium` - Magistral Medium

**Chinese Models**:
- `deepseek/deepseek-v3.2` - DeepSeek V3.2
- `alibaba/qwen3-max` - Qwen 3 Max
- `minimax/minimax-m2.5` - Minimax M2.5
- `zai/glm-5` - GLM-5
- `moonshotai/kimi-k2.5` - Kimi K2.5
- `bytedance/seed-1.8` - Seed 1.8

**Benefits**:
- Single API key for all models
- No need for separate OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY
- Consistent error handling and retry logic
- Access to 13 frontier models from 13 different providers

## Duel Arena Oracle

The oracle publisher listens to streaming duel events and publishes verifiable outcomes to blockchain.

**Configuration**:
```bash
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle

# EVM chains (Base, BSC, Avalanche)
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...

# Solana (devnet, mainnet-beta)
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
DUEL_ARENA_ORACLE_SOLANA_REPORTER_SECRET=base64:...
```

**Oracle Data Fields**:
- `roundId` - Unique duel identifier
- `participantA` / `participantB` - Character IDs
- `winner` - Winning character ID
- `damageA` / `damageB` - Total damage dealt
- `winReason` - Detailed win reason (knockout, timeout, forfeit, draw)
- `seed` - Cryptographic seed for replay verification
- `replayHashHex` - Hash of replay data
- `resultHashHex` - Combined hash of all outcome data
- `timestamp` - Unix timestamp of duel completion

**Metadata API**:
- `GET /api/duel-arena/oracle/:roundId` - Full oracle record with metadata
- Used by betting markets for outcome verification

See [docs/duel-arena-oracle-deploy.md](duel-arena-oracle-deploy.md) for deployment guide.

## Spectator URLs

**Stream View** (optimized for capture):
```
http://localhost:3333/?page=stream
http://localhost:3333/stream.html
```

**Embedded Spectator** (for betting app):
```
http://localhost:3333/?embedded=true&mode=spectator
```

**Normal Game**:
```
http://localhost:3333/
```

## Open APIs

### Duel Telemetry

- `GET /api/streaming/state` - Current duel state (participants, HP, round info)
- `GET /api/streaming/duel-context` - Full duel context with agent stats
- `GET /api/streaming/agent/:characterId/inventory` - Agent inventory snapshot
- `GET /api/streaming/agent/:characterId/monologues?limit=20` - Agent internal thoughts

These endpoints power the betting app live duel telemetry section.

### Oracle Metadata

- `GET /api/duel-arena/oracle/:roundId` - Oracle record with full duel outcome data
- Used by betting markets for outcome verification and settlement

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

This validates:
- Server/client uptime
- Active duel combat
- RTMP bridge status
- Telemetry endpoints
- Oracle publisher health

RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Recent Changes (March 2026)

### Streaming Pipeline Fixes (Commit 41dc606, 71dcba8, 547714e)

**Auto-Detection**: Stream destinations now auto-detected from available stream keys.

**Changes**:
- `deploy-vast.sh`: Auto-detects `STREAM_ENABLED_DESTINATIONS` from available keys
- `ecosystem.config.cjs`: Explicitly forwards stream keys, `DISPLAY`, and `DATABASE_URL` through PM2
- `deploy-vast.yml`: Adds `TWITCH_RTMP_STREAM_KEY` alias to secrets file
- `stream.html` / `stream.tsx`: Dedicated streaming entry points
- `clientViewportMode()`: Utility to detect stream/spectator/normal modes
- Multi-page Vite build: Separate bundles for game and streaming
- Chrome Beta: Switched to `google-chrome-beta` with default ANGLE backend

**Impact**: Reliable multi-platform RTMP streaming with automatic destination detection.

### Chrome Beta for Streaming (Commit 547714e)

**Change**: Switched from Chrome Unstable to Chrome Beta for better stability.

**Updates**:
- `STREAM_CAPTURE_CHANNEL=chrome-beta` (was `chrome-unstable`)
- `STREAM_CAPTURE_ANGLE=default` (was `vulkan`)

**Rationale**: Chrome Beta provides better stability while maintaining WebGPU support. Default ANGLE backend automatically selects the best backend for the system.

### PM2 Secrets Loading (Commit 684b203, 3df4370)

**Fix**: `ecosystem.config.cjs` now reads `/tmp/hyperscape-secrets.env` directly at config load time.

**Database Mode Auto-Detection**: Automatically detects `DUEL_DATABASE_MODE` from `DATABASE_URL` hostname.

**Impact**: Ensures secrets are always available to PM2-managed processes, prevents server crashes.

### ElizaCloud Integration (Commit 4d1eb53)

**Change**: All duel arena agents now use `@elizaos/plugin-elizacloud`.

**Configuration**:
```bash
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

**Impact**: Single API key for 13 frontier models, simplified agent configuration.

### Betting Stack Split (Commit 428329d)

**Separate Repository**: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

**Moved**: Betting frontend, keeper API, EVM contracts, sim-engine, market-maker-bot

**Remaining**: Duel arena oracle (EVM + Solana) for verifiable outcome publishing

**Impact**: Independent deployment, cleaner separation, reduced monorepo complexity.
