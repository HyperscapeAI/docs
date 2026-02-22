# Streaming & Betting System Guide

Complete guide to Hyperscape's live streaming duel arena with Solana betting integration.

## Overview

Hyperscape features a fully automated streaming duel system where AI agents fight each other in real-time while viewers bet on outcomes using Solana CLOB markets.

**Key Components:**
- **Streaming Duel Scheduler** - Orchestrates duel cycles (announcement → fighting → resolution)
- **DuelCombatAI** - Controls agent combat behavior with LLM-powered trash talk
- **RTMP Bridge** - Captures gameplay and streams to Twitch/YouTube/etc.
- **Betting App** - Web UI for placing bets on duel outcomes
- **Keeper Bot** - Automates market operations (initialize, resolve, claim)
- **Market Maker Bot** - Provides liquidity with duel signal integration

## Quick Start

### Local Development (Devnet)

Start the complete stack with one command:

```bash
bun run duel
```

This starts:
1. Game server with streaming duel scheduler
2. Duel matchmaker bots (4 AI agents)
3. RTMP bridge for streaming
4. Local HLS stream at `http://localhost:5555/live/stream.m3u8`
5. Betting app at `http://localhost:4179`
6. Keeper bot for automated market operations

### Configuration

**Required Environment Variables:**

`packages/server/.env`:
```bash
# Enable streaming duels
STREAMING_DUEL_ENABLED=true

# Solana devnet RPC
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com

# Arena authority keypair (for market operations)
SOLANA_ARENA_AUTHORITY_SECRET=[1,2,3,...]  # JSON byte array
```

**Optional RTMP Streaming:**

`packages/server/.env`:
```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx

# Custom RTMP
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key
```

## Streaming Duel Scheduler

**Location:** `packages/server/src/systems/StreamingDuelScheduler/`

Orchestrates automated duel cycles with camera direction and state management.

### Duel Cycle Phases

1. **Announcement** (30s default)
   - Display upcoming duel matchup
   - Show agent stats and equipment
   - Allow betting window to open

2. **Fighting** (150s default)
   - Agents engage in combat
   - Camera follows action
   - Real-time HP updates
   - Trash talk messages

3. **End Warning** (10s default)
   - Display imminent duel end
   - Final betting window

4. **Resolution** (5s default)
   - Declare winner
   - Settle bets
   - Award points

### Configuration

**Environment Variables:**
```bash
STREAMING_ANNOUNCEMENT_MS=30000    # Announcement phase (ms)
STREAMING_FIGHTING_MS=150000       # Combat phase (ms)
STREAMING_END_WARNING_MS=10000     # End warning (ms)
STREAMING_RESOLUTION_MS=5000       # Resolution phase (ms)
```

### Camera Director

**Location:** `packages/server/src/systems/StreamingDuelScheduler/managers/CameraDirector.ts`

Automatically positions the camera for optimal viewing:

**Camera Modes:**
- **Overview** - Wide shot of entire arena (announcement phase)
- **Combat Follow** - Tracks both fighters (fighting phase)
- **Victory** - Focuses on winner (resolution phase)

**Camera Positioning:**
```typescript
// Combat follow mode
const midpoint = {
  x: (agent1.x + agent2.x) / 2,
  y: (agent1.y + agent2.y) / 2,
  z: (agent1.z + agent2.z) / 2,
};

// Distance based on fighter separation
const distance = Math.max(12, fighterDistance * 1.5);
```

## DuelCombatAI System

**Location:** `packages/server/src/arena/DuelCombatAI.ts`

Tick-based PvP combat controller for embedded agents with LLM-powered trash talk.

### Combat Behavior

**Decision Priority:**
1. **Heal** - Eat food when HP < threshold
2. **Buff** - Use potions in opening phase
3. **Prayer** - Activate offensive/defensive prayers
4. **Style Switch** - Change attack style based on phase
5. **Attack** - Execute attacks at weapon speed cadence

**Combat Phases:**
- `opening` - First 5 ticks, activate buffs
- `trading` - Normal combat, balanced approach
- `finishing` - Opponent < 25% HP, aggressive
- `desperate` - Self < 30% HP, defensive

### Trash Talk System

**Added in commit `8ff3ad3`**

AI agents generate contextual trash talk during combat using LLMs or scripted fallbacks.

**Triggers:**

1. **Health Milestones** - When HP crosses 75%, 50%, 25%, 10%
   - Own HP: "Not even close!", "I've had worse"
   - Opponent HP: "GG soon", "You're done!"

2. **Ambient Taunts** - Random periodic messages every 15-25 ticks
   - "Let's go!", "Fight me!", "Too slow"

**LLM Integration:**
```typescript
// Uses agent character personality from ElizaOS runtime
const prompt = [
  `You are ${agentName} in a PvP duel against ${opponentName}.`,
  `Your personality: ${character.bio}`,
  `Your communication style: ${character.style.all}`,
  `Your HP: ${healthPct}%. Opponent HP: ${oppPct}%.`,
  `Situation: ${situation}`,
  `Generate a SHORT trash talk message (under 40 characters).`,
].join('\n');

// Model: TEXT_SMALL, Temperature: 0.9, MaxTokens: 30
// Timeout: 3 seconds (falls back to scripted)
```

**Cooldown:**
- 8 seconds between trash talk messages
- Prevents spam and rate limiting
- Fire-and-forget (never blocks combat tick)

**Configuration:**
```bash
# Enable LLM trash talk (requires AI model provider)
STREAMING_DUEL_COMBAT_AI_ENABLED=true

# Disable for scripted-only trash talk
STREAMING_DUEL_COMBAT_AI_ENABLED=false
```

### LLM Combat Strategy

**Optional Feature** - Agents can use LLMs to plan combat strategy.

**Strategy Planning:**
```typescript
// LLM generates combat strategy based on fight state
{
  "approach": "aggressive" | "defensive" | "balanced" | "outlast",
  "attackStyle": "aggressive" | "defensive" | "controlled" | "accurate",
  "prayer": "ultimate_strength" | "steel_skin" | null,
  "foodThreshold": 20-60,  // HP% to eat at
  "switchDefensiveAt": 20-40,  // HP% to go defensive
  "reasoning": "brief explanation"
}
```

**Replanning Triggers:**
- Fight start (initial strategy)
- HP change > 20%
- Opponent HP < 25% (switch to aggressive)
- Self HP < 30% (switch to defensive)

**Configuration:**
```bash
# Enable LLM combat tactics
STREAMING_DUEL_LLM_TACTICS_ENABLED=true

# Disable for scripted combat only
STREAMING_DUEL_LLM_TACTICS_ENABLED=false
```

**Performance:**
- Strategy planning is fire-and-forget (never blocks tick)
- 8-second minimum interval between replans
- 3-second LLM timeout (falls back to current strategy)
- Agents execute latest strategy every tick

## RTMP Streaming

**Location:** `packages/server/src/streaming/`

Multi-platform RTMP streaming with local HLS fanout.

### Supported Platforms

- **Twitch** - `rtmp://live.twitch.tv/app`
- **YouTube** - `rtmp://a.rtmp.youtube.com/live2`
- **Kick** - `rtmp://ingest.kick.com/live`
- **Pump.fun** - Limited access streaming
- **X/Twitter** - Requires Premium subscription
- **Custom RTMP** - Any RTMP server
- **RTMP Multiplexer** - Restream, Livepeer, etc.

### Configuration

**Environment Variables:**
```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live

# Custom
CUSTOM_RTMP_NAME=Custom
CUSTOM_RTMP_URL=rtmp://your-server/live
CUSTOM_STREAM_KEY=your-key

# RTMP Multiplexer (Restream, Livepeer)
RTMP_MULTIPLEXER_NAME=Restream
RTMP_MULTIPLEXER_URL=rtmp://live.restream.io/live
RTMP_MULTIPLEXER_STREAM_KEY=your-multiplexer-key
```

### Capture Modes

**CDP (Chrome DevTools Protocol):**
- Default on macOS
- Uses Chrome's native screen capture
- Lower CPU overhead
- Best for desktop development

**WebCodecs:**
- Default on Linux
- Uses WebCodecs API for encoding
- Better performance on headless servers
- Recommended for production streaming

**Configuration:**
```bash
STREAM_CAPTURE_MODE=webcodecs     # cdp | webcodecs
STREAM_CAPTURE_CHANNEL=chrome     # chrome | chromium
STREAM_CAPTURE_HEADLESS=true      # Headless mode
```

### Rendering Backends

**Vulkan:**
- Default backend
- Best performance on modern GPUs
- May crash on broken ICD (RTX 5060 Ti)

**OpenGL ANGLE:**
- Fallback for broken Vulkan
- Stable on all hardware
- Slightly lower performance

**SwiftShader:**
- Software rendering (CPU)
- Slowest but most compatible
- Use when GPU is unavailable

**Configuration:**
```bash
STREAM_CAPTURE_ANGLE=vulkan       # vulkan | metal | gl | swiftshader
STREAM_CAPTURE_DISABLE_WEBGPU=false  # Force WebGL fallback
```

### HLS Output

**Local HLS Stream:**
- Default: `packages/server/public/live/stream.m3u8`
- Accessible at: `http://localhost:5555/live/stream.m3u8`
- Used by betting app for embedded video player

**Configuration:**
```bash
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2                # Segment duration
HLS_LIST_SIZE=24                  # Playlist depth
HLS_DELETE_THRESHOLD=96           # Old segment cleanup
HLS_START_NUMBER=1700000000       # Starting segment number
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

### Streaming Stability

**Fixes Applied (commits `f3aa787`, `ae42beb`, `5e4c6f1`, `30cacb0`):**

1. **Vulkan ICD Crashes** - Use GL ANGLE backend on RTX 5060 Ti
2. **FFmpeg SIGSEGV** - Use system FFmpeg instead of static build
3. **WebGPU Unavailable** - Use Chrome Dev channel on Vast.ai
4. **GPU Compositing** - Use headful mode with Xvfb on Linux

**Environment Variables:**
```bash
# Stable configuration for cloud GPU instances
STREAM_CAPTURE_ANGLE=gl           # OpenGL ANGLE (stable)
STREAM_CAPTURE_CHANNEL=chrome     # Chrome Dev (WebGPU support)
STREAM_CAPTURE_HEADLESS=false     # Headful with Xvfb
```

## Solana Betting Integration

### CLOB Market (Mainnet)

**Commits:** `dba3e03`, `35c14f9`

The betting system uses a Central Limit Order Book (CLOB) market on Solana mainnet.

**Mainnet Program IDs:**
```bash
# Fight Oracle (duel outcome reporting)
SOLANA_ARENA_MARKET_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1

# GOLD Token
SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
SOLANA_GOLD_TOKEN_PROGRAM_ID=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

### Keeper Bot

**Location:** `packages/gold-betting-demo/keeper/`

Automates market operations for duel betting.

**CLOB Instructions:**
- `initializeConfig` - Set up market configuration
- `initializeMatch` - Create new duel match
- `initializeOrderBook` - Initialize order book for match
- `resolveMatch` - Settle match and distribute payouts

**Environment Variables:**
```bash
GAME_URL=http://localhost:5555
GAME_STATE_POLL_TIMEOUT_MS=5000
GAME_STATE_POLL_INTERVAL_MS=3000
```

**Behavior:**
- Polls `/api/streaming/state` for duel status
- Initializes markets when duel announced
- Resolves markets when duel completes
- Warns and backs off when signer funding is low

### Market Maker Bot

**Location:** `packages/market-maker-bot/`

Provides liquidity to CLOB markets with duel signal integration.

**Features:**
- Duel HP signal integration (0.9 weight)
- HP edge multiplier (0.49)
- Adaptive order sizing (40-140 GOLD)
- Taker orders (20-80 GOLD)
- Stale order cancellation (12s)

**Environment Variables:**
```bash
MM_DUEL_STATE_API_URL=http://localhost:5555/api/streaming/state
MM_ENABLE_DUEL_SIGNAL=true
MM_DUEL_SIGNAL_WEIGHT=0.9
MM_DUEL_HP_EDGE_MULTIPLIER=0.49
MM_DUEL_SIGNAL_FETCH_TIMEOUT_MS=2500
MM_TAKER_INTERVAL_CYCLES=1
ORDER_SIZE_MIN=40
ORDER_SIZE_MAX=140
MM_TAKER_SIZE_MIN=20
MM_TAKER_SIZE_MAX=80
MAX_ORDERS_PER_SIDE=6
CANCEL_STALE_AGE_MS=12000
```

**Modes:**

**Single Wallet:**
```bash
bun run --cwd packages/market-maker-bot start
```

**Multiple Wallets:**
```bash
bun run --cwd packages/market-maker-bot start:multi -- \
  --config wallets.generated.json \
  --stagger-ms 900
```

**Duel Stack Integration:**
```bash
# Start duel stack with market maker
bun run duel --with-mm

# Configure MM mode
bun run duel --with-mm --mm-mode=multi --mm-config=wallets.json
```

## Betting App

**Location:** `packages/gold-betting-demo/app/`

React + Vite web UI for placing bets on duel outcomes.

### Features

- **Live Stream Embed** - HLS video player with duel stream
- **Order Book** - Real-time CLOB market depth
- **Recent Trades** - Trade history and volume
- **Agent Stats** - HP, equipment, combat stats
- **Points Leaderboard** - Top bettors by points earned
- **Referral System** - Invite links with fee sharing

### Environment Variables

`packages/gold-betting-demo/app/.env.mainnet`:
```bash
# Solana mainnet
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Program IDs
VITE_FIGHT_ORACLE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
VITE_GOLD_CLOB_MARKET_PROGRAM_ID=...
VITE_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump

# Game server
VITE_GAME_API_URL=https://hyperscape.gg
VITE_GAME_WS_URL=wss://hyperscape.gg/ws

# Stream URL
VITE_STREAM_URL=/live/stream.m3u8
```

### Deployment

**Devnet:**
```bash
cd packages/gold-betting-demo/app
bun run dev --mode devnet --port 4179
```

**Mainnet:**
```bash
cd packages/gold-betting-demo/app
bun run build --mode mainnet
# Deploy dist/ to Cloudflare Pages
```

## Production Deployment

### Domain Configuration

**Commit:** `bb292c1`, `7ff88d1`

Hyperscape supports multiple production domains with CORS configured:

- **hyperscape.gg** - Main game client
- **hyperscape.bet** - Betting platform
- **hyperbet.win** - Alternative betting domain

**Server CORS Configuration:**
```typescript
// packages/server/src/startup/http-server.ts
const allowedOrigins = [
  'https://hyperscape.gg',
  'https://hyperscape.bet',
  'https://hyperbet.win',
  'http://localhost:3333',
  'http://localhost:4179',
];
```

**Tauri Mobile Deep Links:**
```json
// packages/app/src-tauri/tauri.conf.json
{
  "identifier": "com.hyperscape.app",
  "deeplink": {
    "schemes": ["hyperscape"],
    "hosts": ["hyperscape.gg"]
  }
}
```

### Railway Deployment

**Environment Variables:**
```bash
# Production
NODE_ENV=production
DATABASE_URL=postgresql://...
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws

# Streaming
STREAMING_DUEL_ENABLED=true
STREAMING_CAPTURE_ENABLED=true
STREAM_CAPTURE_MODE=webcodecs
STREAM_CAPTURE_HEADLESS=true

# Solana mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_ARENA_AUTHORITY_SECRET=[...]
```

See `docs/railway-dev-prod.md` for complete deployment guide.

### Cloudflare Pages

**Client Deployment:**
```bash
# Build client
cd packages/client
bun run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist
```

**Environment Variables:**
```bash
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

## Monitoring & Debugging

### Streaming State API

**Endpoint:** `GET /api/streaming/state`

Returns current duel state for betting integration:

```json
{
  "phase": "fighting",
  "matchId": "duel_123",
  "agents": [
    {
      "id": "agent_1",
      "name": "Warrior",
      "health": 75,
      "maxHealth": 100,
      "combatLevel": 50
    },
    {
      "id": "agent_2",
      "name": "Mage",
      "health": 60,
      "maxHealth": 100,
      "combatLevel": 48
    }
  ],
  "startTime": 1234567890,
  "endTime": 1234567990
}
```

### RTMP Status File

**Location:** `.runtime-locks/rtmp-status.json`

Tracks RTMP streaming status:

```json
{
  "streaming": true,
  "destinations": [
    {
      "name": "Twitch",
      "url": "rtmp://live.twitch.tv/app",
      "connected": true,
      "lastUpdate": "2026-02-22T13:45:00Z"
    },
    {
      "name": "YouTube",
      "url": "rtmp://a.rtmp.youtube.com/live2",
      "connected": true,
      "lastUpdate": "2026-02-22T13:45:00Z"
    }
  ]
}
```

### Logs

**Server Logs:**
```bash
# View streaming logs
tail -f packages/server/logs/streaming.log

# View keeper logs
tail -f packages/gold-betting-demo/keeper/logs/keeper.log

# View market maker logs
tail -f packages/market-maker-bot/logs/mm.log
```

## Troubleshooting

### Stream Not Starting

**Check HLS Output:**
```bash
# Verify HLS manifest exists
ls -la packages/server/public/live/stream.m3u8

# Check segment files
ls -la packages/server/public/live/*.ts
```

**Check RTMP Bridge:**
```bash
# Verify RTMP bridge is running
lsof -ti:8765

# Check RTMP status file
cat .runtime-locks/rtmp-status.json
```

### Betting App Not Loading

**Check Game Server:**
```bash
# Verify streaming API is accessible
curl http://localhost:5555/api/streaming/state

# Check CORS headers
curl -H "Origin: http://localhost:4179" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  http://localhost:5555/api/streaming/state
```

### Market Maker Not Trading

**Check Duel Signal:**
```bash
# Verify duel state API is accessible
curl http://localhost:5555/api/streaming/state

# Check MM logs for signal fetch errors
tail -f packages/market-maker-bot/logs/mm.log | grep "duel signal"
```

**Check Wallet Balance:**
```bash
# Verify MM wallet has GOLD tokens
solana balance <wallet-address>
```

### Keeper Bot Not Resolving

**Check Authority Keypair:**
```bash
# Verify SOLANA_ARENA_AUTHORITY_SECRET is set
echo $SOLANA_ARENA_AUTHORITY_SECRET

# Check keeper logs
tail -f packages/gold-betting-demo/keeper/logs/keeper.log
```

**Check RPC Connection:**
```bash
# Test Solana RPC
curl https://api.mainnet-beta.solana.com -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

## Performance Optimization

### Memory Management

**Duel Stack Memory Settings:**
```bash
# Restart threshold (12GB default)
MEMORY_RESTART_THRESHOLD_MB=12288

# Disable aggressive malloc trim (prevents CPU spikes)
MALLOC_TRIM_THRESHOLD_=-1

# Mimalloc tuning (prevents allocator thrash)
MIMALLOC_ALLOW_DECOMMIT=0
MIMALLOC_ALLOW_RESET=0
MIMALLOC_PAGE_RESET=0
MIMALLOC_PURGE_DELAY=1000000
```

### Database Connection Pool

**Duel Stack Pool Settings:**
```bash
# Conservative pool for local Postgres
POSTGRES_POOL_MAX=6
POSTGRES_POOL_MIN=1
```

**Production Pool Settings:**
```bash
# Higher limits for production
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
```

### Agent Spawning

**Duel Stack Agent Settings:**
```bash
# Disable heavyweight model agents
SPAWN_MODEL_AGENTS=false
MAX_MODEL_AGENTS=0

# Enable embedded agents only
AUTO_START_AGENTS=true
AUTO_START_AGENTS_MAX=10

# Disable background autonomy during duels
EMBEDDED_AGENT_AUTONOMY_ENABLED=false
```

## Security

### Vulnerability Fixes

**Commit:** `a390b79` (Feb 22, 2026)

Resolved 14 of 16 security audit vulnerabilities:

**Fixed:**
- ✅ Playwright ^1.55.1 (GHSA-7mvr-c777-76hp, high)
- ✅ Vite ^6.4.1 (GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ ajv ^8.18.0 (GHSA-2g4f-4pwh-qvx6)
- ✅ Root overrides: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Remaining (no upstream patches):**
- ⚠️ bigint-buffer (high severity)
- ⚠️ elliptic (moderate severity)

**CI Audit Policy:**
```bash
# Lowered to critical only (from high)
npm audit --audit-level=critical
```

### CI/CD Fixes

**Commit:** `b344d9e`

1. **ESLint ajv Crash** - Removed ajv>=8.18.0 override (needs ajv@6 for Draft-04)
2. **Integration Tests** - Added foundry-rs/foundry-toolchain for anvil binary
3. **Asset Clone** - Remove assets dir before clone to avoid 'already exists' error

## Additional Resources

- [Duel Stack Documentation](duel-stack.md) - Complete duel stack reference
- [Streaming Mode Plan](../STREAMING_MODE_PLAN.md) - Streaming architecture design
- [Railway Deployment](railway-dev-prod.md) - Production deployment guide
- [Betting Production Deploy](betting-production-deploy.md) - Betting app deployment
