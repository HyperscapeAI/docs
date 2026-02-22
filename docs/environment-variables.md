# Environment Variables Reference

Complete reference for all Hyperscape environment variables across packages.

## Overview

Hyperscape uses package-specific `.env` files for configuration. Each package has an `.env.example` file documenting all available variables.

**Environment Variable Loading Order:**
1. Package-specific `.env` file (e.g., `packages/server/.env`)
2. Parent directory `.env` file (e.g., `packages/.env`)
3. Workspace root `.env` file (e.g., `./.env`)
4. System environment variables (highest priority)

## Server Environment Variables

**File:** `packages/server/.env`  
**Example:** `packages/server/.env.example`

### Core Configuration

```bash
# World folder to load
WORLD=world

# HTTP port
PORT=5555

# Node environment
NODE_ENV=development  # development | production | staging | test
```

### Security & Authentication

```bash
# JWT secret for signing tokens (REQUIRED in production)
JWT_SECRET=your-secret-here

# Admin code for in-game admin access
ADMIN_CODE=your-admin-code

# Grant admin to all users in dev mode (opt-in)
GRANT_DEV_ADMIN=true

# Privy authentication
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret
```

### Database Configuration

```bash
# Use local PostgreSQL via Docker
USE_LOCAL_POSTGRES=true

# Docker PostgreSQL settings
POSTGRES_CONTAINER=hyperscape-postgres
POSTGRES_USER=hyperscape
POSTGRES_PASSWORD=hyperscape_dev_password
POSTGRES_DB=hyperscape
POSTGRES_PORT=5488
POSTGRES_IMAGE=postgres:16-alpine

# External PostgreSQL (production)
DATABASE_URL=postgresql://user:password@host:5488/database

# Connection pool settings
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
```

### Assets & CDN

```bash
# CDN base URL for game assets
PUBLIC_CDN_URL=http://localhost:8080

# WebSocket URL for client connections
PUBLIC_WS_URL=ws://localhost:5555/ws

# API base URL for client HTTP requests
PUBLIC_API_URL=http://localhost:5555
```

### Game Configuration

```bash
# Auto-save interval (seconds)
SAVE_INTERVAL=60

# Player collision physics
PUBLIC_PLAYER_COLLISION=false

# Max upload size (MB)
PUBLIC_MAX_UPLOAD_SIZE=12
```

### AI Model Providers

```bash
# OpenAI (recommended)
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# ElizaOS API
ELIZAOS_API_URL=http://localhost:4001
```

### Streaming Duel System

**Added in commits `68c0020`, `8ff3ad3`**

```bash
# Enable/disable streaming duels
STREAMING_DUEL_ENABLED=true

# Duel cycle timing
STREAMING_ANNOUNCEMENT_MS=30000    # Announcement phase (30s)
STREAMING_FIGHTING_MS=150000       # Combat phase (150s)
STREAMING_END_WARNING_MS=10000     # End warning (10s)
STREAMING_RESOLUTION_MS=5000       # Resolution phase (5s)

# Combat AI configuration
STREAMING_DUEL_LLM_TACTICS_ENABLED=false      # Use LLM for combat strategy
STREAMING_DUEL_COMBAT_AI_ENABLED=false        # Enable DuelCombatAI trash talk
EMBEDDED_AGENT_AUTONOMY_ENABLED=false         # Disable background questing

# Agent spawning
SPAWN_MODEL_AGENTS=false           # Disable heavyweight model agents
MAX_MODEL_AGENTS=0                 # Max model agents to spawn
AUTO_START_AGENTS=true             # Auto-load embedded agents from DB
AUTO_START_AGENTS_MAX=10           # Max embedded agents to auto-start

# Memory management
MEMORY_RESTART_THRESHOLD_MB=12288  # Restart threshold (12GB)
```

### RTMP Streaming

**Added in commits `f3aa787`, `ae42beb`, `5e4c6f1`**

```bash
# Capture configuration
STREAM_CAPTURE_MODE=webcodecs        # cdp | webcodecs
STREAM_CAPTURE_CHANNEL=chrome        # chrome | chromium
STREAM_CAPTURE_ANGLE=vulkan          # vulkan | metal | gl | swiftshader
STREAM_CAPTURE_DISABLE_WEBGPU=false  # Force WebGL fallback
STREAM_CAPTURE_HEADLESS=true         # Headless mode

# HLS output
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2
HLS_LIST_SIZE=24
HLS_DELETE_THRESHOLD=96
HLS_START_NUMBER=1700000000
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file

# RTMP destinations
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2

KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live

CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key

# RTMP multiplexer (Restream, Livepeer)
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-multiplexer-key

# RTMP bridge settings
RTMP_BRIDGE_PORT=8765
GAME_URL=http://localhost:3333/?page=stream
RTMP_STATUS_FILE=.runtime-locks/rtmp-status.json
```

### Solana Arena Betting

**Added in commits `dba3e03`, `35c14f9`**

```bash
# Solana RPC endpoints
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Program IDs (mainnet)
SOLANA_ARENA_MARKET_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
SOLANA_GOLD_TOKEN_PROGRAM_ID=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID=ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL

# Signer keypairs (JSON byte array or base64)
SOLANA_ARENA_AUTHORITY_SECRET=[1,2,3,...]
SOLANA_ARENA_REPORTER_SECRET=[1,2,3,...]
SOLANA_ARENA_KEEPER_SECRET=[1,2,3,...]

# Market configuration
SOLANA_MARKET_FEE_BPS=100          # 1% platform fee
SOLANA_ARENA_CLOSE_SLOT_LEAD=20    # Safety slots before close
ARENA_EXTERNAL_BET_WRITE_KEY=your-secret-key

# Staking configuration
ARENA_STAKING_SWEEP_ENABLED=false
ARENA_STAKING_SWEEP_BATCH_SIZE=100
ARENA_HOLD_DAYS_SCAN_ENABLED=false
ARENA_HOLD_DAYS_SCAN_MAX_PAGES=0
ARENA_HOLD_DAYS_SCAN_PAGE_SIZE=1000
ARENA_SOLANA_RPC_TIMEOUT_MS=3000

# Jupiter integration
JUPITER_QUOTE_URL=https://lite-api.jup.ag/swap/v1/quote
```

### Development Flags

**Added in commit `68c0020`**

```bash
# Disable AI model agents (fastest startup)
SPAWN_MODEL_AGENTS=false

# Disable agent auto-start from database
AUTO_START_AGENTS=false

# Disable activity logger (reduces DB writes)
DISABLE_ACTIVITY_LOGGER=true

# Enable town/building collision validation
TOWN_COLLISION_DEEP_VALIDATION=true

# Lean mode overrides (keep features enabled in lean mode)
SERVER_DEV_LEAN_ALLOW_DUEL_BETTING=true
SERVER_DEV_LEAN_ALLOW_STREAMING_DUEL=true
SERVER_DEV_LEAN_ALLOW_STREAMING_CAPTURE=true
SERVER_DEV_LEAN_ALLOW_DUEL_SCHEDULER=true
SERVER_DEV_LEAN_ALLOW_MODEL_AGENTS=true
SERVER_DEV_LEAN_ALLOW_AUTO_AGENTS=true
SERVER_DEV_LEAN_ALLOW_TERRAIN_MESH_COLLISION=true
SERVER_DEV_LEAN_ALLOW_DUEL_ARENA_VISUALS=true

# Server-side PhysX terrain collision
TERRAIN_SERVER_MESH_COLLISION_ENABLED=true

# Duel arena visuals system
DUEL_ARENA_VISUALS_ENABLED=true

# Logger memory limit
LOGGER_MAX_ENTRIES=2000

# Disable rate limiting (dev only!)
DISABLE_RATE_LIMIT=false

# Load test mode (dev only!)
LOAD_TEST_MODE=false
```

### WebSocket Health Monitoring

```bash
# Ping interval (seconds)
WS_PING_INTERVAL_SEC=5

# Missed pongs before disconnect
WS_PING_MISS_TOLERANCE=3

# Grace period for new connections (ms)
WS_PING_GRACE_MS=5000
```

### Monitoring & Alerting

```bash
# Webhook for critical alerts (Slack/Discord)
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

## Client Environment Variables

**File:** `packages/client/.env`  
**Example:** `packages/client/.env.example`

### Authentication

```bash
# Privy App ID (REQUIRED)
PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

### Server Connection

```bash
# Game server HTTP API
PUBLIC_API_URL=http://localhost:5555

# Game server WebSocket
PUBLIC_WS_URL=ws://localhost:5555/ws

# CDN for game assets
PUBLIC_CDN_URL=http://localhost:8080

# Public app URL
PUBLIC_APP_URL=http://localhost:3333
```

### Optional Features

```bash
# ElizaOS API for AI dashboard
PUBLIC_ELIZAOS_URL=http://localhost:4001

# Farcaster Frame V2
PUBLIC_ENABLE_FARCASTER=true

# Vite dev server port
VITE_PORT=3333

# Debug logging
DEBUG_RPG=1
```

### Mobile Development

```bash
# Capacitor live reload (use your local IP)
CAP_SERVER_URL=http://192.168.1.100:3333
```

## Betting App Environment Variables

**File:** `packages/gold-betting-demo/app/.env.mainnet`  
**Example:** `packages/gold-betting-demo/app/.env.example`

### Solana Configuration

```bash
# Solana mainnet
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Program IDs
VITE_FIGHT_ORACLE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
VITE_GOLD_CLOB_MARKET_PROGRAM_ID=...
VITE_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

### Game Server Connection

```bash
# Game server API
VITE_GAME_API_URL=https://hyperscape.gg
VITE_GAME_WS_URL=wss://hyperscape.gg/ws

# Stream URL
VITE_STREAM_URL=/live/stream.m3u8
```

## Market Maker Bot Environment Variables

**File:** `packages/market-maker-bot/.env`  
**Example:** `packages/market-maker-bot/.env.example`

### Duel Signal Integration

**Added in commit `68c0020`**

```bash
# Duel state API
MM_DUEL_STATE_API_URL=http://localhost:5555/api/streaming/state

# Enable duel signal
MM_ENABLE_DUEL_SIGNAL=true

# Signal weight (0.0-1.0)
MM_DUEL_SIGNAL_WEIGHT=0.9

# HP edge multiplier
MM_DUEL_HP_EDGE_MULTIPLIER=0.49

# Signal fetch timeout (ms)
MM_DUEL_SIGNAL_FETCH_TIMEOUT_MS=2500
```

### Order Configuration

```bash
# Maker order sizing
ORDER_SIZE_MIN=40
ORDER_SIZE_MAX=140

# Taker order sizing
MM_TAKER_SIZE_MIN=20
MM_TAKER_SIZE_MAX=80

# Taker interval (cycles)
MM_TAKER_INTERVAL_CYCLES=1

# Max orders per side
MAX_ORDERS_PER_SIDE=6

# Stale order cancellation (ms)
CANCEL_STALE_AGE_MS=12000
```

## Duel Stack Environment Variables

**Script:** `scripts/duel-stack.mjs`

These variables control the `bun run duel` command behavior.

### Stack Configuration

```bash
# Force fresh restart
DUEL_FORCE_FRESH=true

# Skip chain setup (anvil)
DUEL_SKIP_CHAIN_SETUP=true

# Public CDN URL override
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club

# Allow inherited PUBLIC_CDN_URL
DUEL_ALLOW_INHERITED_CDN_URL=true

# Server health check path
DUEL_SERVER_HEALTH_PATH=/health

# Startup timeout (ms)
DUEL_STARTUP_TIMEOUT_MS=420000

# Streaming state timeout (ms)
DUEL_STREAMING_STATE_TIMEOUT_MS=30000

# Stream ready timeout (ms)
DUEL_STREAM_READY_TIMEOUT_MS=180000

# Verification timeout (ms)
DUEL_VERIFY_TIMEOUT_MS=240000
```

### Market Maker Integration

```bash
# Enable market maker
DUEL_WITH_MM=true

# MM mode (auto | single | multi)
DUEL_MM_MODE=auto

# MM config path
DUEL_MM_CONFIG=packages/market-maker-bot/wallets.generated.json

# MM startup stagger (ms)
DUEL_MM_STAGGER_MS=900

# MM start delay (ms)
DUEL_MM_START_DELAY_MS=1000
```

### Capture Configuration

```bash
# Force WebGL fallback
DUEL_FORCE_WEBGL_FALLBACK=false

# Disable bridge capture
DUEL_DISABLE_BRIDGE_CAPTURE=false

# Use Xvfb for capture
DUEL_CAPTURE_USE_XVFB=true

# Enable madvise EAGAIN shim (Linux)
DUEL_ENABLE_MADVISE_EAGAIN_SHIM=true
```

### Database Management

```bash
# Skip DB session cleanup
DUEL_SKIP_DB_SESSION_CLEANUP=false
```

### Keeper Configuration

```bash
# Keeper game API URL
DUEL_KEEPER_GAME_URL=http://localhost:5555
KEEPER_GAME_URL=http://localhost:5555

# Game state polling
GAME_STATE_POLL_TIMEOUT_MS=5000
GAME_STATE_POLL_INTERVAL_MS=3000
```

## Memory Management Variables

**Added in commit `68c0020`**

### Malloc Tuning

```bash
# Disable aggressive malloc trim (prevents CPU spikes)
MALLOC_TRIM_THRESHOLD_=-1
```

### Mimalloc Tuning

```bash
# Prevent allocator thrash under sustained load
MIMALLOC_ALLOW_DECOMMIT=0
MIMALLOC_ALLOW_RESET=0
MIMALLOC_PAGE_RESET=0
MIMALLOC_PURGE_DELAY=1000000
```

**Purpose:**
Bun/mimalloc can enter high-CPU madvise loops under sustained stream load. These settings keep pages resident longer to avoid allocator thrash stalls.

## Database Resilience Variables

**Added in commit `68c0020`**

```bash
# Keep stream runtime alive through transient DB outages
DB_WRITE_ERRORS_NON_FATAL=true

# Disable world chunk persistence (streaming mode)
DISABLE_WORLD_CHUNK_PERSISTENCE=true

# Skip death recovery on startup (streaming mode)
SKIP_DEATH_RECOVERY_ON_STARTUP=true
DEATH_RECOVERY_STARTUP_TIMEOUT_MS=5000
```

**Purpose:**
Streaming duel instances don't need mutable world chunk persistence and should stay alive through transient remote DB outages.

## Streaming Delay & Anti-Cheat

```bash
# Canonical platform for timing defaults
STREAMING_CANONICAL_PLATFORM=youtube  # youtube | twitch | hls

# Public delay (ms) - auto-selected by platform if unset
# youtube => 15000ms, twitch => 12000ms, hls => 4000ms
STREAMING_PUBLIC_DELAY_MS=15000

# Viewer access token for trusted live viewers
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

## Streaming SSE Configuration

```bash
# Replay buffer capacity
STREAMING_SSE_REPLAY_BUFFER=2048

# Replay max bytes
STREAMING_SSE_REPLAY_MAX_BYTES=33554432

# Push interval (ms)
STREAMING_SSE_PUSH_INTERVAL_MS=500

# Heartbeat interval (ms)
STREAMING_SSE_HEARTBEAT_MS=15000

# Max pending bytes per client
STREAMING_SSE_MAX_PENDING_BYTES=1048576
```

## Solana Proxy Configuration

```bash
# RPC cache settings
RPC_PROXY_CACHE_MAX_ENTRIES=512
RPC_PROXY_CACHE_MAX_TOTAL_BYTES=67108864
RPC_PROXY_CACHE_MAX_ENTRY_BYTES=262144

# Request timeout (ms)
RPC_PROXY_REQUEST_TIMEOUT_MS=15000

# WebSocket proxy settings
WS_PROXY_MAX_PENDING_OPEN_MESSAGES=64
```

## Production Checklist

### Required Variables

**Server:**
- ✅ `NODE_ENV=production`
- ✅ `JWT_SECRET` (32+ characters)
- ✅ `ADMIN_CODE` (prevent unauthorized admin)
- ✅ `DATABASE_URL` (production database)
- ✅ `PUBLIC_CDN_URL` (CDN domain)
- ✅ `PUBLIC_WS_URL` (wss:// with SSL)
- ✅ `PUBLIC_API_URL` (https:// with SSL)
- ✅ `PRIVY_APP_ID` and `PRIVY_APP_SECRET`

**Client:**
- ✅ `PUBLIC_PRIVY_APP_ID` (must match server)
- ✅ `PUBLIC_API_URL` (production server)
- ✅ `PUBLIC_WS_URL` (production WebSocket)
- ✅ `PUBLIC_CDN_URL` (production CDN)

### Security Variables

**Never commit to git:**
- `JWT_SECRET`
- `PRIVY_APP_SECRET`
- `SOLANA_ARENA_AUTHORITY_SECRET`
- `SOLANA_ARENA_REPORTER_SECRET`
- `SOLANA_ARENA_KEEPER_SECRET`
- `ADMIN_CODE`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- Stream keys (Twitch, YouTube, etc.)

**Use environment variable injection:**
- Railway: Environment variables in dashboard
- Cloudflare Pages: Environment variables in settings
- GitHub Actions: Repository secrets

## Variable Naming Conventions

### Prefixes

- `PUBLIC_` - Exposed to client via /env.js endpoint
- `VITE_` - Exposed to Vite client build
- `DUEL_` - Duel stack specific configuration
- `MM_` - Market maker bot configuration
- `STREAM_` - Streaming capture configuration
- `RTMP_` - RTMP streaming configuration
- `HLS_` - HLS output configuration
- `SOLANA_` - Solana blockchain configuration
- `ARENA_` - Arena betting system configuration

### Suffixes

- `_URL` - HTTP/WebSocket endpoint
- `_KEY` - API key or secret
- `_SECRET` - Private secret (never expose)
- `_MS` - Milliseconds
- `_ENABLED` - Boolean flag
- `_MAX` - Maximum value
- `_MIN` - Minimum value
- `_TIMEOUT_MS` - Timeout in milliseconds

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
USE_LOCAL_POSTGRES=true
DISABLE_RATE_LIMIT=true
GRANT_DEV_ADMIN=true
PUBLIC_CDN_URL=http://localhost:8080
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5555/ws
```

### Staging

```bash
NODE_ENV=staging
DATABASE_URL=postgresql://staging-db...
PUBLIC_CDN_URL=https://staging-assets.hyperscape.club
PUBLIC_API_URL=https://staging.hyperscape.gg
PUBLIC_WS_URL=wss://staging.hyperscape.gg/ws
```

### Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://prod-db...
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws
STREAMING_DUEL_ENABLED=true
STREAMING_CAPTURE_ENABLED=true
```

## Troubleshooting

### Variable Not Taking Effect

**Check loading order:**
1. Restart dev server after changing `.env`
2. Verify variable is in correct package's `.env` file
3. Check for typos in variable name
4. Ensure no conflicting system environment variable

**Vite variables:**
- Must restart Vite dev server
- Only `PUBLIC_` and `VITE_` prefixed variables are exposed
- Check `vite.config.ts` for `envPrefix` configuration

### Missing Required Variables

**Server won't start:**
- Check `PRIVY_APP_ID` and `PRIVY_APP_SECRET` are set
- Verify `DATABASE_URL` or `USE_LOCAL_POSTGRES=true`
- Ensure `JWT_SECRET` is set in production

**Client can't connect:**
- Verify `PUBLIC_PRIVY_APP_ID` matches server
- Check `PUBLIC_API_URL` and `PUBLIC_WS_URL` point to server
- Ensure CORS is configured for client domain

### Streaming Not Working

**RTMP not streaming:**
- Verify stream keys are set (TWITCH_STREAM_KEY, etc.)
- Check RTMP_BRIDGE_PORT is not in use
- Ensure FFmpeg is installed
- Check RTMP_STATUS_FILE for connection status

**HLS not playing:**
- Verify HLS_OUTPUT_PATH directory exists
- Check HLS manifest has segments
- Ensure server is serving /live/ directory
- Verify CORS headers for HLS requests
