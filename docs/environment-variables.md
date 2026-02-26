# Environment Variables Reference

Complete reference for all environment variables used in Hyperscape.

## Server Variables

Location: `packages/server/.env`

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Environment: `development`, `production`, `staging`, `test` |
| `PORT` | number | `5555` | HTTP server port |
| `WORLD` | string | `world` | World folder to load (relative to server root) |

### Security & Authentication

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `JWT_SECRET` | string | *(required in prod)* | JWT signing secret (generate with `openssl rand -base64 32`) |
| `ADMIN_CODE` | string | *(required in prod)* | Admin access code for `/admin` endpoints |
| `GRANT_DEV_ADMIN` | boolean | `false` | Grant admin to all users in development (only if `ADMIN_CODE` not set) |
| `PUBLIC_PRIVY_APP_ID` | string | - | Privy application ID (public, exposed to clients) |
| `PRIVY_APP_SECRET` | string | - | Privy application secret (private, server-only) |

**Security notes:**
- `JWT_SECRET` is **required** in production/staging (throws error if not set)
- `ADMIN_CODE` should always be set in production
- Never commit secrets to git

### Database Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `USE_LOCAL_POSTGRES` | boolean | `true` | Use Docker PostgreSQL (true) or external database (false) |
| `DATABASE_URL` | string | - | PostgreSQL connection string (takes precedence over `USE_LOCAL_POSTGRES`) |
| `POSTGRES_CONTAINER` | string | `hyperscape-postgres` | Docker container name |
| `POSTGRES_USER` | string | `hyperscape` | PostgreSQL username |
| `POSTGRES_PASSWORD` | string | `hyperscape_dev_password` | PostgreSQL password |
| `POSTGRES_DB` | string | `hyperscape` | PostgreSQL database name |
| `POSTGRES_PORT` | number | `5488` | PostgreSQL port |
| `POSTGRES_IMAGE` | string | `postgres:16-alpine` | Docker image |

**Example DATABASE_URL:**
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Assets & CDN

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_CDN_URL` | string | `http://localhost:8080` | CDN base URL for game assets |
| `PUBLIC_WS_URL` | string | `ws://localhost:5555/ws` | WebSocket URL for client connections |
| `PUBLIC_API_URL` | string | `http://localhost:5555` | API base URL for client HTTP requests |

**Production example:**
```bash
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_WS_URL=wss://hyperscape.gg/ws
PUBLIC_API_URL=https://hyperscape.gg
```

### Game Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SAVE_INTERVAL` | number | `60` | Auto-save interval in seconds (0 to disable) |
| `PUBLIC_PLAYER_COLLISION` | boolean | `false` | Enable player-to-player collision physics |
| `PUBLIC_MAX_UPLOAD_SIZE` | number | `12` | Maximum file upload size in megabytes |

### Streaming Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STREAMING_CANONICAL_PLATFORM` | string | `youtube` | Canonical platform: `youtube`, `twitch`, or `hls` |
| `STREAMING_PUBLIC_DELAY_MS` | number | *(auto)* | Public streaming delay (ms). Default: youtube=15000, twitch=12000, hls=4000 |
| `STREAMING_VIEWER_ACCESS_TOKEN` | string | - | Secret token for trusted live viewers |
| `STREAMING_DUEL_ENABLED` | boolean | `true` | Enable/disable streaming duel scheduler |

**SSE Configuration:**
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STREAMING_SSE_REPLAY_BUFFER` | number | `2048` | Replay frame capacity for resume support |
| `STREAMING_SSE_REPLAY_MAX_BYTES` | number | `33554432` | Total replay payload bytes cap (32MB) |
| `STREAMING_SSE_PUSH_INTERVAL_MS` | number | `500` | Push cadence for live state fanout |
| `STREAMING_SSE_HEARTBEAT_MS` | number | `15000` | Keepalive heartbeat cadence |
| `STREAMING_SSE_MAX_PENDING_BYTES` | number | `1048576` | Per-client pending bytes threshold (1MB) |

### RTMP Streaming

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TWITCH_STREAM_KEY` | string | - | Twitch stream key |
| `TWITCH_RTMP_URL` | string | `rtmp://live.twitch.tv/app` | Twitch RTMP URL |
| `X_STREAM_KEY` | string | - | X/Twitter stream key |
| `X_RTMP_URL` | string | - | X/Twitter RTMP URL |
| `KICK_STREAM_KEY` | string | - | Kick stream key |
| `KICK_RTMP_URL` | string | `rtmp://ingest.kick.com/live` | Kick RTMP URL |
| `YOUTUBE_STREAM_KEY` | string | - | YouTube stream key |
| `YOUTUBE_RTMP_URL` | string | `rtmp://a.rtmp.youtube.com/live2` | YouTube RTMP URL |
| `CUSTOM_RTMP_NAME` | string | - | Custom RTMP destination name |
| `CUSTOM_RTMP_URL` | string | - | Custom RTMP URL |
| `CUSTOM_STREAM_KEY` | string | - | Custom stream key |
| `RTMP_DESTINATIONS_JSON` | string | - | JSON array of additional destinations |

**Example RTMP_DESTINATIONS_JSON:**
```json
[
  {
    "name": "Restream",
    "url": "rtmp://live.restream.io/live",
    "key": "your-key",
    "enabled": true
  }
]
```

### HLS Output

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HLS_OUTPUT_PATH` | string | `packages/server/public/live/stream.m3u8` | HLS playlist path |
| `HLS_SEGMENT_PATTERN` | string | `packages/server/public/live/stream-%09d.ts` | Segment filename pattern |
| `HLS_TIME_SECONDS` | number | `2` | Segment duration |
| `HLS_LIST_SIZE` | number | `24` | Playlist size |
| `HLS_DELETE_THRESHOLD` | number | `96` | Delete old segments threshold |
| `HLS_START_NUMBER` | number | `1700000000` | Starting segment number |
| `HLS_FLAGS` | string | *(see below)* | HLS flags |

**Default HLS_FLAGS:**
```
delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

### Duel Bot Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DUEL_BOT_FOOD_ITEM` | string | `shark` | Food item given to bots |
| `DUEL_BOT_FOOD_COUNT` | number | `10` | Number of food items (0-28) |
| `DUEL_BOT_EAT_THRESHOLD` | number | `40` | HP% to eat at (10-80) |
| `DUEL_KEEPER_WALLET` | string | - | Wallet address for seeding market liquidity |

### Solana Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOLANA_RPC_URL` | string | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | string | `wss://api.mainnet-beta.solana.com` | Solana WebSocket endpoint |
| `SOLANA_ARENA_MARKET_PROGRAM_ID` | string | - | Arena market program ID |
| `SOLANA_GOLD_MINT` | string | - | GOLD token mint address |
| `SOLANA_ARENA_AUTHORITY_SECRET` | string | - | Authority keypair (JSON/base64) |
| `SOLANA_ARENA_REPORTER_SECRET` | string | - | Reporter keypair (falls back to authority) |
| `SOLANA_ARENA_KEEPER_SECRET` | string | - | Keeper keypair (falls back to authority) |
| `SOLANA_MARKET_FEE_BPS` | number | `100` | Platform fee in basis points (1% = 100) |
| `SOLANA_ARENA_CLOSE_SLOT_LEAD` | number | `20` | Extra safety slots for market close |
| `ARENA_EXTERNAL_BET_WRITE_KEY` | string | - | Secret for external bet recording |

**Solana keypair formats:**
- JSON array: `[1,2,3,...]`
- Comma-separated: `1,2,3,...`
- Base64: `base64-encoded-string`

### RPC Proxy Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RPC_PROXY_CACHE_MAX_ENTRIES` | number | `512` | Max cached RPC responses |
| `RPC_PROXY_CACHE_MAX_TOTAL_BYTES` | number | `67108864` | Total cache size (64MB) |
| `RPC_PROXY_CACHE_MAX_ENTRY_BYTES` | number | `262144` | Max single entry size (256KB) |
| `RPC_PROXY_REQUEST_TIMEOUT_MS` | number | `15000` | Upstream HTTP timeout |
| `WS_PROXY_MAX_PENDING_OPEN_MESSAGES` | number | `64` | Max queued WS messages before open |

### AI Model Providers

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENAI_API_KEY` | string | - | OpenAI API key (recommended) |
| `ANTHROPIC_API_KEY` | string | - | Anthropic API key |
| `OPENROUTER_API_KEY` | string | - | OpenRouter API key |
| `ELIZAOS_API_URL` | string | `http://localhost:4001` | ElizaOS API URL |

**Provider priority:**
1. OpenAI (if `OPENAI_API_KEY` set)
2. Anthropic (if `ANTHROPIC_API_KEY` set)
3. OpenRouter (if `OPENROUTER_API_KEY` set)
4. Ollama (local, no API key needed)

### LiveKit Voice Chat

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LIVEKIT_URL` | string | - | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | string | - | LiveKit API key |
| `LIVEKIT_API_SECRET` | string | - | LiveKit API secret |

### Monitoring & Alerting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ALERT_WEBHOOK_URL` | string | - | Webhook for critical alerts (Slack/Discord) |
| `COMMIT_HASH` | string | - | Git commit hash (auto-populated by CI/CD) |

### WebSocket Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WS_PING_INTERVAL_SEC` | number | `5` | Ping interval in seconds |
| `WS_PING_MISS_TOLERANCE` | number | `3` | Missed pongs before disconnect |
| `WS_PING_GRACE_MS` | number | `5000` | Grace period for new connections |

### Development Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DISABLE_RATE_LIMIT` | boolean | `false` | Disable rate limiting (dev only!) |
| `LOAD_TEST_MODE` | boolean | `false` | Enable load test mode (dev only!) |
| `SPAWN_MODEL_AGENTS` | boolean | `true` | Spawn AI model agents |
| `AUTO_START_AGENTS` | boolean | `true` | Auto-start agents from database |
| `DISABLE_ACTIVITY_LOGGER` | boolean | `false` | Disable activity logging |
| `TOWN_COLLISION_DEEP_VALIDATION` | boolean | `false` | Enable deep collision validation |
| `TERRAIN_SERVER_MESH_COLLISION_ENABLED` | boolean | *(auto)* | Enable server-side terrain collision (true in prod) |
| `DUEL_ARENA_VISUALS_ENABLED` | boolean | `true` | Enable duel arena visuals system |
| `LOGGER_MAX_ENTRIES` | number | `2000` | Max in-memory logger entries |

**Lean mode overrides:**
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SERVER_DEV_LEAN_ALLOW_DUEL_BETTING` | boolean | `false` | Keep duel betting in lean mode |
| `SERVER_DEV_LEAN_ALLOW_STREAMING_DUEL` | boolean | `false` | Keep streaming duels in lean mode |
| `SERVER_DEV_LEAN_ALLOW_STREAMING_CAPTURE` | boolean | `false` | Keep stream capture in lean mode |
| `SERVER_DEV_LEAN_ALLOW_DUEL_SCHEDULER` | boolean | `false` | Keep duel scheduler in lean mode |
| `SERVER_DEV_LEAN_ALLOW_MODEL_AGENTS` | boolean | `false` | Keep model agents in lean mode |
| `SERVER_DEV_LEAN_ALLOW_AUTO_AGENTS` | boolean | `false` | Keep auto-started agents in lean mode |
| `SERVER_DEV_LEAN_ALLOW_TERRAIN_MESH_COLLISION` | boolean | `false` | Keep terrain collision in lean mode |
| `SERVER_DEV_LEAN_ALLOW_DUEL_ARENA_VISUALS` | boolean | `false` | Keep arena visuals in lean mode |

### Advanced Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SYSTEMS_PATH` | string | - | Custom systems path for loading additional game systems |
| `JUPITER_QUOTE_URL` | string | `https://lite-api.jup.ag/swap/v1/quote` | Jupiter quote endpoint |
| `ARENA_STAKING_SWEEP_ENABLED` | boolean | `false` | Enable staking accrual sweep |
| `ARENA_STAKING_SWEEP_BATCH_SIZE` | number | `100` | Wallets per staking sweep batch (1-1000) |
| `ARENA_HOLD_DAYS_SCAN_ENABLED` | boolean | `false` | Enable deep signature-history scan |
| `ARENA_HOLD_DAYS_SCAN_MAX_PAGES` | number | `0` | Max signature pages for hold-day scan |
| `ARENA_HOLD_DAYS_SCAN_PAGE_SIZE` | number | `1000` | Signatures per page (1-1000) |
| `ARENA_SOLANA_RPC_TIMEOUT_MS` | number | `3000` | Solana RPC timeout for arena fetches |

## Client Variables

Location: `packages/client/.env`

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_PRIVY_APP_ID` | string | - | Privy app ID (must match server) |
| `PUBLIC_API_URL` | string | `http://localhost:5555` | Game server HTTP API |
| `PUBLIC_WS_URL` | string | `ws://localhost:5555/ws` | Game server WebSocket |
| `PUBLIC_CDN_URL` | string | `http://localhost:8080` | CDN for game assets |
| `PUBLIC_APP_URL` | string | `http://localhost:3333` | Public URL for deployed app |

### Optional Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_ELIZAOS_URL` | string | - | ElizaOS API for AI agent dashboard |
| `PUBLIC_ENABLE_FARCASTER` | boolean | `false` | Enable Farcaster Frame V2 |
| `VITE_PORT` | number | `3333` | Vite dev server port |
| `DEBUG_RPG` | boolean | `false` | Enable debug logging for RPG systems |
| `CAP_SERVER_URL` | string | - | Capacitor live reload URL (e.g., `http://192.168.1.100:3333`) |

## Asset Forge Variables

Location: `packages/asset-forge/.env`

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENAI_API_KEY` | string | - | OpenAI API key for AI generation |
| `MESHY_API_KEY` | string | - | MeshyAI API key for 3D model generation |
| `ASSET_FORGE_PORT` | number | `3400` | AssetForge UI port |
| `ASSET_FORGE_API_PORT` | number | `3401` | AssetForge API port |

## Plugin Hyperscape Variables

Location: `packages/plugin-hyperscape/.env`

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENAI_API_KEY` | string | - | OpenAI API key for agent LLM |
| `ANTHROPIC_API_KEY` | string | - | Anthropic API key for agent LLM |
| `OPENROUTER_API_KEY` | string | - | OpenRouter API key for agent LLM |

## Environment-Specific Configurations

### Local Development

```bash
# Server
NODE_ENV=development
PORT=5555
USE_LOCAL_POSTGRES=true
PUBLIC_CDN_URL=http://localhost:8080
PUBLIC_WS_URL=ws://localhost:5555/ws
PUBLIC_API_URL=http://localhost:5555

# Client
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5555/ws
PUBLIC_CDN_URL=http://localhost:8080
```

### Production (Railway + Cloudflare)

```bash
# Server (Railway)
NODE_ENV=production
PORT=5555
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secure-jwt-secret
ADMIN_CODE=your-secure-admin-code
USE_LOCAL_POSTGRES=false
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_WS_URL=wss://hyperscape.gg/ws
PUBLIC_API_URL=https://hyperscape.gg

# Client (Cloudflare Pages)
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://hyperscape.gg
```

### Vast.ai (GPU Streaming)

```bash
# Server
NODE_ENV=production
PORT=5555
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secure-jwt-secret
ADMIN_CODE=your-secure-admin-code
USE_LOCAL_POSTGRES=false

# Streaming
TWITCH_STREAM_KEY=your-twitch-key
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://x-media-studio/path
STREAMING_PUBLIC_DELAY_MS=0

# Solana
SOLANA_ARENA_AUTHORITY_SECRET=your-keypair-json
```

## See Also

- [Server .env.example](../packages/server/.env.example)
- [Client .env.example](../packages/client/.env.example)
- [Vast.ai Deployment Guide](vast-deployment.md)
- [Cloudflare Deployment Guide](cloudflare-deployment.md)
- [Streaming Configuration](streaming-configuration.md)
