# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend, AI agent support, and streaming duel arena.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- PostgreSQL database with automatic migrations
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket
- 15 registered game actions
- ElizaOS AI agent integration
- Streaming duel arena with RTMP fanout
- Betting stack integration (Solana + EVM)

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

### Core Game Server
- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration

### AI Agent Features
- **ElizaOS Integration** - Autonomous AI agents powered by LLMs
- **19 AI Models** - GPT-4.1, o4 Mini, o3 Mini, Claude Opus 4, Claude Sonnet 4, Llama 3.3 70B, and more
- **Memory Management** - InMemoryDatabaseAdapter with caps (50 memories per agent, 20 adapter logs, 100 cache entries)
- **DB Pool Optimization** - Concurrency limiting (max 5 concurrent bank queries), staggered refresh intervals
- **Auto-Spawn** - Agents automatically spawn when `STREAMING_DUEL_ENABLED=true`

### Streaming Duel Arena
- **Streaming Scheduler** - Automated duel matchmaking and camera direction
- **RTMP Fanout** - Multi-platform streaming (YouTube, Twitch, Kick, etc.)
- **Graceful Restart** - Zero-downtime deployments via `POST /admin/graceful-restart`
- **Placeholder Mode** - Prevents stream disconnects during idle periods
- **Activity-Aware Camera** - Weighted agent selection prioritizing combat > skilling > moving > idle

### Betting Stack Integration
- **Duel Betting Bridge** - Connects streaming duels to betting markets
- **Oracle Integration** - Trustless duel outcome reporting to Solana/EVM
- **Points System** - Tracks betting activity with staking multipliers
- **Referral System** - Invite tracking and rewards
- **Streaming Duel History** - Persistent duel outcome tracking

## Quick Start

### Prerequisites

- **Bun** (v1.3.10+) or Node.js 22+
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance
- **Git LFS** (for branding assets) - `brew install git-lfs` or `apt install git-lfs`

### Installation

```bash
cd packages/server
bun install
```

### Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

**Option 1: Local PostgreSQL (Docker)**
```env
USE_LOCAL_POSTGRES=true
# Docker will automatically start PostgreSQL
```

**Option 2: External PostgreSQL**
```env
DATABASE_URL=postgresql://user:pass@host:5488/dbname
USE_LOCAL_POSTGRES=false
```

**Optional: Enable AI Agents**
```env
STREAMING_DUEL_ENABLED=true  # Auto-spawns 19 AI model agents
MAX_MODEL_AGENTS=19          # Number of agents to spawn
```

**Optional: Enable Streaming**
```env
STREAMING_DUEL_ENABLED=true
RTMP_MULTIPLEXER_URL=rtmp://your-server/live
TWITCH_STREAM_KEY=your-key
YOUTUBE_STREAM_KEY=your-key
```

### Running

**Development:**
```bash
bun run dev
```
This automatically starts:
- CDN Server (nginx on port 8080) - via Docker
- Game Server (Fastify on port 5555)
- Client (Vite on port 3333)
- 3D Asset Forge API (port 3001) & UI (port 3003)

**Development with AI Agents:**
```bash
bun run dev:ai
```
Adds ElizaOS API on port 4001.

**Full Duel Stack:**
```bash
bun run duel
```
Starts game + agents + betting app + streaming.

**Production Build:**
```bash
bun run build
bun run start
```

### CDN Server

The development script automatically manages a local CDN server via Docker:

**Automatic Management:**
- Starts when you run `bun run dev`
- Stops when you exit the dev server (Ctrl+C)
- Serves game assets from `../../assets/` on port 8080
- Health check at `http://localhost:8080/health`

**Manual CDN Management:**
```bash
# Start CDN only
bun run cdn:up

# Stop CDN
bun run cdn:down

# View CDN logs
bun run cdn:logs

# Verify CDN is working
bun run cdn:verify
```

**Requirements:**
- Docker Desktop must be installed and running
- If Docker is not available, the dev script will skip CDN startup and warn you

**Asset Access:**
- All assets served directly from CDN: `http://localhost:8080/assets/world/music/normal/1.mp3`
- No proxying - client fetches directly from CDN

## Database

### PostgreSQL Setup

The server uses PostgreSQL with automatic migrations. On first run:

1. If `USE_LOCAL_POSTGRES=true`, Docker will start a PostgreSQL container
2. Migrations run automatically on startup
3. Tables are created: users, characters, players, inventory, equipment, etc.

### Manual Database Operations

**Connect to local PostgreSQL:**
```bash
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
```

**Backup database:**
```bash
docker exec hyperscape-postgres pg_dump -U hyperscape hyperscape > backup.sql
```

**Restore database:**
```bash
cat backup.sql | docker exec -i hyperscape-postgres psql -U hyperscape hyperscape
```

### Migrations

Migrations are defined in `src/database/migrations/` and run automatically on server start using Drizzle ORM.

**Run migrations manually:**
```bash
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

**Current schema includes**:
- Users and authentication
- Characters (multi-character support)
- Players (active sessions)
- Inventory and equipment
- Skills and XP
- Bank storage (480 slots)
- Quest progress
- Duel history
- Streaming duel history
- Arena points and referrals

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- Duel system management

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**StreamingDuelScheduler** (`src/systems/StreamingDuelScheduler/`)
- Automated duel matchmaking
- Camera direction (activity-aware)
- Cycle state machine (IDLE → ANNOUNCEMENT → COUNTDOWN → FIGHTING → RESOLUTION)
- Duel outcome persistence

**DuelBettingBridge** (`src/systems/DuelScheduler/DuelBettingBridge.ts`)
- Connects streaming duels to betting markets
- Oracle outcome reporting
- Bet validation and settlement

### Character System

The server supports multiple characters per account:

1. **Account** - Identified by Privy user ID or legacy user ID
2. **Character** - Each account can have multiple characters
3. **Player Session** - Character becomes "player" when spawned in world

**Flow:**
```
Login → Character List → Select/Create Character → Enter World → Spawn as Player
```

## API Endpoints

### Health & Status

- `GET /health` - Health check (for load balancers)
- `GET /status` - Detailed server status with player count

### Streaming & Duel Arena

- `GET /api/streaming/state` - Current duel state (SSE)
- `GET /api/streaming/duel-context` - Detailed duel context
- `GET /api/streaming/leaderboard/details` - Agent leaderboard with duel history
- `GET /api/streaming/agent/:characterId/inventory` - Agent inventory
- `GET /api/streaming/agent/:characterId/monologues` - Agent internal monologues
- `GET /api/streaming/rtmp/status` - RTMP bridge status
- `GET /live/stream.m3u8` - HLS stream manifest
- `POST /admin/graceful-restart` - Request restart after current duel
- `GET /admin/restart-status` - Check if restart is pending

### Assets

- `GET /*` - Game assets (models, textures, audio)
- `GET /assets/*` - Legacy asset path (backward compatible)

### WebSocket

- `GET /ws` - WebSocket connection for real-time gameplay

### Actions (HTTP API)

- `GET /api/actions` - List all available actions
- `GET /api/actions/available` - Get actions available to player
- `POST /api/actions/:name` - Execute specific action

### Utility

- `GET /env.js` - Public environment variables for client
- `POST /api/upload` - Upload user assets (VRM, textures)
- `GET /api/upload-check` - Check if asset exists

## Environment Variables

### Required

```env
PORT=5555                    # Server port
WORLD=world                   # World directory path
```

### Database

```env
# Option 1: Docker PostgreSQL
USE_LOCAL_POSTGRES=true
POSTGRES_CONTAINER=hyperscape-postgres
POSTGRES_USER=hyperscape
POSTGRES_PASSWORD=hyperscape_dev_password
POSTGRES_DB=hyperscape
POSTGRES_PORT=5488

# Option 2: External PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5488/dbname

# Railway Detection (automatic)
RAILWAY_ENVIRONMENT=production  # Auto-set by Railway
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for static assets
PUBLIC_WS_URL=ws://localhost:5555/ws # WebSocket URL
```

### Authentication (Optional)

```env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
ADMIN_CODE=your-admin-code          # For /admin command
```

### AI Agents (Optional)

```env
STREAMING_DUEL_ENABLED=true         # Enable streaming duel arena
MAX_MODEL_AGENTS=19                 # Number of AI agents to spawn
OPENAI_API_KEY=your-key             # For GPT models
ANTHROPIC_API_KEY=your-key          # For Claude models
GROQ_API_KEY=your-key               # For Llama models
```

### Streaming (Optional)

```env
STREAMING_DUEL_ENABLED=true
RTMP_MULTIPLEXER_URL=rtmp://your-server/live
TWITCH_STREAM_KEY=your-key
YOUTUBE_STREAM_KEY=your-key
KICK_STREAM_KEY=your-key
STREAMING_VIEWER_ACCESS_TOKEN=your-token  # Gate for live WebSocket viewers
STREAMING_PUBLIC_DELAY_MS=15000           # Anti-cheat delay (default: 15s)
STREAM_PLACEHOLDER_ENABLED=true           # Prevent idle disconnects
```

### Betting Integration (Optional)

```env
DUEL_BETTING_ENABLED=true
ARENA_EXTERNAL_BET_WRITE_KEY=your-key     # Server-to-server auth
SOLANA_ARENA_MARKET_PROGRAM_ID=your-program-id
SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
SOLANA_ARENA_AUTHORITY_SECRET=your-keypair  # For oracle writes
```

### Farcaster Frame v2 (Optional)

```env
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_APP_URL=https://your-domain.com
```

### LiveKit Voice (Optional)

```env
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
PUBLIC_LIVEKIT_URL=wss://your-livekit-server
```

### Monitoring & Alerting (Optional)

```env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Monitoring endpoints:
- `GET /health` - basic uptime/timestamp (use for uptime checks)
- `GET /status` - connected users + commit hash

Configure your monitoring service (Railway health checks, UptimeRobot, Pingdom, etc.)
to poll `/health` and trigger alerts on non-200 responses or elevated latency.

## Deployment

### Railway

**Recommended for production**. Railway provides:
- Automatic PostgreSQL provisioning
- Zero-downtime deployments
- Environment variable management
- Health check monitoring

See `docs/railway-dev-prod.md` for setup guide.

**Railway-specific optimizations**:
- Automatic connection pool sizing for Railway proxy
- Prepared statement disabling for pgbouncer compatibility
- Detection via `RAILWAY_ENVIRONMENT`, `.railway.internal`, `.rlwy.net`, `.railway.app` hostnames

### Vast.ai (Streaming Duel Arena)

**Recommended for GPU-accelerated streaming**. Vast.ai provides:
- NVIDIA GPU with display driver support
- WebGPU rendering for browser capture
- Cost-effective GPU instances

See `docs/duel-stack.md` and `.github/workflows/deploy-vast.yml` for deployment guide.

**Vast.ai requirements**:
- `gpu_display_active=true` (display driver, not just compute)
- Xorg or Xvfb (WebGPU requires window context)
- NVIDIA GPU with Vulkan support

### Docker

Build and run with Docker:

```bash
docker build -t hyperscape-server .
docker run -p 5555:5555 \
  -e DATABASE_URL=postgresql://... \
  hyperscape-server
```

### Traditional Hosting

Requirements:
- Node.js 22+ or Bun runtime
- PostgreSQL 16+ (local or managed)
- Reverse proxy (nginx, caddy) for SSL

```bash
# Build
bun run build

# Run with process manager
pm2 start dist/index.js --name hyperscape-server
```

### Environment-Specific

**Staging:**
```bash
NODE_ENV=staging bun run start
```

**Production:**
```bash
NODE_ENV=production bun run start
```

### Rollback

Rollback uses the same deployment workflows with an explicit ref:

1. Railway API (server): run the **Deploy to Railway** workflow and set
   `deploy_ref` to the previous commit SHA or tag.
2. Cloudflare R2 assets: run **Deploy Assets to Cloudflare R2** with
   `deploy_ref` pointing at the same commit to keep assets in sync.

## Troubleshooting

### PostgreSQL Connection Failed

**Error:** `ECONNREFUSED` or connection timeout

**Solutions:**
1. Check if Docker is running: `docker ps`
2. Start PostgreSQL: `docker-compose up postgres`
3. Check connection string in .env
4. Verify firewall allows port 5488

### Database Migration Errors

**Error:** Column already exists

**Solution:** This is usually safe to ignore. The migrations use `IF NOT EXISTS` and `ON CONFLICT` to handle re-runs.

**Error:** Foreign key constraint violation

**Solution:** 
```sql
-- Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape hyperscape

-- Drop all tables and re-run migrations
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
```
Then restart the server.

### Character Creation Fails

**Error:** Missing columns when creating character

**Solution:** The characters table migration may not have run. Check:
```sql
SELECT * FROM config WHERE key = 'version';
```

Should be at version 51 or higher. If not, restart server to run migrations.

### Agent Memory Issues

**Error:** Agents consuming excessive memory (>10GB for 19 agents)

**Solutions:**
1. Verify InMemoryDatabaseAdapter is being used (not PGLite)
2. Check memory caps are in place (50 memories per agent)
3. Monitor periodic GC is running (every 60s)
4. Check adapter logs are capped at 20 entries

### Database Connection Pool Exhaustion

**Error:** "timeout exceeded when trying to connect"

**Solutions:**
1. Increase serverless PG pool max (default: 20)
2. Increase connection timeout (default: 60s)
3. Enable concurrency limiting for bank queries (max 5)
4. Stagger agent refresh intervals to distribute load

**Railway-specific**: Connection pool automatically optimized when Railway environment detected.

### Docker Issues

**Error:** Docker daemon not running

**Solution:**
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop
3. Restart server

**Alternative:** Use external PostgreSQL instead:
```env
DATABASE_URL=postgresql://user:pass@host:5488/dbname
USE_LOCAL_POSTGRES=false
```

### Streaming Issues

**Error:** RTMP bridge not connecting

**Solutions:**
1. Verify `RTMP_MULTIPLEXER_URL` or platform-specific stream keys are set
2. Check FFmpeg is installed (`ffmpeg -version`)
3. Verify Playwright Chromium is installed (`bunx playwright install chromium`)
4. Check WebGPU is available in browser capture

**Error:** Stream disconnects during idle periods

**Solution:** Enable placeholder mode:
```env
STREAM_PLACEHOLDER_ENABLED=true
```

## Development

### Code Structure

```
src/
├── index.ts              # Main server entry point
├── main.ts               # Server initialization
├── startup/              # Startup configuration
│   ├── config.ts        # Environment configuration
│   ├── database.ts      # Database initialization
│   ├── http-server.ts   # Fastify server setup
│   ├── websocket.ts     # WebSocket setup
│   └── routes/          # API route definitions
├── systems/              # Game systems
│   ├── ServerNetwork/   # Network layer & player lifecycle
│   ├── DatabaseSystem/  # Database operations
│   ├── StreamingDuelScheduler/  # Duel arena automation
│   └── DuelScheduler/   # Duel betting bridge
├── eliza/                # ElizaOS integration
│   ├── ModelAgentSpawner.ts  # AI agent spawning
│   ├── ElizaDuelBot.ts       # Duel bot implementation
│   └── agentHelpers.ts       # Agent utilities
├── streaming/            # Streaming infrastructure
│   ├── browser-capture.ts    # WebGPU browser capture
│   ├── rtmp-bridge.ts        # RTMP fanout
│   └── stream-capture.ts     # Stream management
├── arena/                # Betting integration
│   ├── ArenaService.ts       # Betting API
│   └── SolanaArenaOperator.ts # Oracle integration
├── database/             # Database layer
│   ├── client.ts        # Connection pooling
│   ├── schema.ts        # Drizzle schema
│   └── migrations/      # Migration files
└── infrastructure/       # Infrastructure utilities
    ├── docker/          # Docker management
    └── auth/            # Authentication
```

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint
```

### Building

```bash
bun run build
```

Output: `dist/index.js` (bundled server)

## Performance

### Database Connection Pool

**Standard Pool**:
- Max connections: 30 (increased from 20 for duel prep concurrency)
- Idle timeout: 30s
- Connection timeout: 5s

**Serverless Pool** (Railway/Neon):
- Max connections: 20 (increased from 10)
- Connection timeout: 60s (increased from 30s)
- Automatic detection via `RAILWAY_ENVIRONMENT` or hostname patterns

**Concurrency Limiting**:
- Bank queries: max 5 concurrent (prevents pool exhaustion during agent initialization)
- Staggered refresh intervals: random offset to distribute load

### Asset Caching

Assets are served with aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

For development, disable browser cache or use incognito mode.

### Agent Memory Management

**Memory Caps**:
- 50 memories per agent (ring buffer eviction)
- 20 adapter log entries (LLM prompts+responses)
- 100 cache entries (LRU eviction)
- 50 encounter cache entries per agent
- 100 previous mob health map entries

**Periodic Cleanup**:
- Non-blocking GC every 60s per agent
- Adapter flush every 60s for entities/rooms/worlds/tasks
- State cache flush when over 100 entries

**Expected Memory Usage**:
- 19 agents: <5GB total (down from 38-76GB with PGLite)

## Security

### Authentication

Optional Privy authentication provides:
- Wallet-based login
- Farcaster Frame v2 support
- Account-to-character linking

### Admin Access

Admin commands require:
1. `ADMIN_CODE` set in environment
2. `/admin <code>` command in chat

Admin endpoints:
- `POST /admin/graceful-restart` - Zero-downtime restart
- `GET /admin/restart-status` - Check restart status

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Streaming Security

- `STREAMING_VIEWER_ACCESS_TOKEN` gates live WebSocket viewers
- Public delay (`STREAMING_PUBLIC_DELAY_MS`) prevents betting advantage
- Canonical platform (`STREAMING_CANONICAL_PLATFORM`) for timing reference

### Rate Limiting

Not implemented yet. Consider adding:
- Connection rate limiting (websocket)
- API endpoint rate limiting
- Upload size limits (currently 50MB)

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Betting Deployment:** See `docs/betting-production-deploy.md`
- **Duel Stack:** See `docs/duel-stack.md`
- **Railway Deployment:** See `docs/railway-dev-prod.md`
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
