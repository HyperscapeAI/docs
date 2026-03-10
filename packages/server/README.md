# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend, streaming duel arena, and betting integration.

## ✅ Status: FULLY OPERATIONAL

The server is production-ready with:
- PostgreSQL database with automatic migrations (connection pool: 20)
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket
- 15 registered game actions
- Streaming duel arena with WebGPU capture (Chrome Beta + default ANGLE backend)
- Duel arena oracle (EVM + Solana outcome publishing)
- ElizaOS AI agent support (13 frontier models via ElizaCloud)

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **AI Agents** - ElizaCloud integration with 13 frontier LLM models (GPT-5, Claude 4.6, Gemini 3.1, etc.)
- **RTMP Streaming** - Multi-platform streaming to Twitch, Kick, YouTube with auto-detection
- **Duel Arena Oracle** - Verifiable duel outcome publishing to EVM and Solana
- **Streaming Duel Arena** - WebGPU-based browser capture with Chrome Beta and RTMP streaming
- **Graceful Restart** - Zero-downtime deployments via admin API

## Quick Start

### Prerequisites

- **Bun** (v1.3.10+) or Node.js 22+
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance
- **WebGPU-compatible browser** - Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)

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
DATABASE_URL=postgresql://user:pass@host:5432/dbname
USE_LOCAL_POSTGRES=false
```

**Streaming Duel Arena (Optional)**
```env
STREAMING_DUEL_ENABLED=true
STREAM_PLACEHOLDER_ENABLED=true  # Prevents stream disconnects during idle
STREAM_DESTINATIONS=youtube,twitch  # Comma-separated list
YOUTUBE_STREAM_KEY=...
TWITCH_STREAM_KEY=...
```

**Betting Integration (Optional)**
```env
DUEL_BETTING_ENABLED=true
ARENA_EXTERNAL_BET_WRITE_KEY=...  # Server-to-server auth
SOLANA_RPC_URL=...
BSC_RPC_URL=...
BSC_GOLD_CLOB_ADDRESS=...
```

**AI Agents (Optional)**
```env
SPAWN_MODEL_AGENTS=true  # Auto-spawn agents when STREAMING_DUEL_ENABLED=true
MAX_MODEL_AGENTS=19      # Number of AI agents to spawn
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
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
- PostgreSQL (Docker)

**Development with AI Agents:**
```bash
bun run dev:ai
```
Adds ElizaOS API on port 4001.

**Full Duel Stack:**
```bash
bun run duel
```
Starts game + agents + betting + streaming.

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

Migrations are in `src/database/migrations/` and run automatically on server start using Drizzle Kit.

**Run migrations manually:**
```bash
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

**Current schema includes:**
- Users and authentication
- Characters (multi-character support)
- Players (active sessions)
- Inventory and equipment
- Skills and XP
- Bank storage (480 slots)
- Quest progress
- Duel history
- Streaming duel history
- Arena points and staking
- Arena fee shares and referrals

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- Combat system
- Duel system

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**StreamingDuelScheduler** (`src/systems/StreamingDuelScheduler/`)
- Automated duel matchmaking
- Camera director (activity-aware agent selection)
- Cycle state machine (IDLE → ANNOUNCEMENT → COUNTDOWN → FIGHTING → RESOLUTION)
- Duel orchestrator
- Betting integration

**ElizaOS Integration** (`src/eliza/`)
- AgentManager - Manages AI agent lifecycle
- ModelAgentSpawner - Spawns 19 AI model agents
- ElizaDuelBot - Duel-specific agent behavior
- EmbeddedHyperscapeService - Game API for agents

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

### Admin

- `POST /admin/graceful-restart` - Request restart after current duel (requires `x-admin-code` header)
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

### Streaming

- `GET /api/streaming/state` - Current duel state (for betting integration)
- `GET /api/streaming/duel-context` - Detailed duel context
- `GET /api/streaming/rtmp/status` - RTMP bridge status
- `GET /live/stream.m3u8` - HLS stream endpoint

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
POSTGRES_PORT=5432

# Option 2: External PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Database Mode (auto-detected from DATABASE_URL hostname)
DUEL_DATABASE_MODE=remote  # or local (auto-detected)

# Connection Pool (increased March 2026)
POSTGRES_POOL_MAX=20       # Default: 20 (up from 10)
POSTGRES_POOL_MIN=2        # Default: 2

# Railway-specific (auto-detected)
RAILWAY_ENVIRONMENT=production  # Auto-set by Railway
POSTGRES_POOL_MAX=6             # Lower limit for pooler connections
POSTGRES_POOL_MIN=0             # Don't hold idle connections
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080              # CDN URL for static assets (local dev)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club  # Production CDN (Vast.ai streaming)
PUBLIC_WS_URL=ws://localhost:5555/ws              # WebSocket URL
```

### Authentication (Optional)

```env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
ADMIN_CODE=your-admin-code          # For /admin command
```

### Streaming Duel Arena (Optional)

```env
STREAMING_DUEL_ENABLED=true

# Stream destinations (auto-detected from available keys)
STREAM_ENABLED_DESTINATIONS=twitch,kick  # Auto-detected if not set
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij  # Alias supported
KICK_STREAM_KEY=your-kick-stream-key
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx

# Streaming capture (Vast.ai deployment)
STREAM_CAPTURE_CHANNEL=chrome-beta  # Chrome Beta for stability
STREAM_CAPTURE_ANGLE=default        # Default ANGLE backend
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
DISPLAY=:99                         # Xvfb virtual display

# Optional settings
STREAM_PLACEHOLDER_ENABLED=true     # Prevents stream disconnects
STREAM_LOW_LATENCY=true
STREAM_GOP_SIZE=60
STREAM_AUDIO_ENABLED=true
```

### Duel Arena Oracle (Optional)

```env
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet, all
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle

# Shared signers (one EVM key for Base/BSC/AVAX, one Solana key for all clusters)
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
DUEL_ARENA_ORACLE_SOLANA_REPORTER_SECRET=base64:...
DUEL_ARENA_ORACLE_SOLANA_KEYPAIR_PATH=/path/to/solana-shared.json

# Per-target contract addresses (testnet)
DUEL_ARENA_ORACLE_BASE_SEPOLIA_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_BSC_TESTNET_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_AVAX_FUJI_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_SOLANA_DEVNET_PROGRAM_ID=6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV

# Per-target contract addresses (mainnet)
DUEL_ARENA_ORACLE_BASE_MAINNET_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_BSC_MAINNET_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_AVAX_MAINNET_CONTRACT_ADDRESS=0x...
DUEL_ARENA_ORACLE_SOLANA_MAINNET_PROGRAM_ID=6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV
```

**Note**: Betting integration has been moved to [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet). The oracle remains in Hyperscape for verifiable outcome publishing.

### AI Agents (Optional)

```env
# ElizaCloud (recommended - single key for 13 frontier models)
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key

# Agent spawning
SPAWN_MODEL_AGENTS=true             # Auto-spawn when STREAMING_DUEL_ENABLED=true
MAX_MODEL_AGENTS=13                 # Number of AI agents (matches ElizaCloud models)
AUTO_START_AGENTS=true              # Auto-start agents from database
AUTO_START_AGENTS_MAX=10            # Max auto-started agents

# Legacy provider keys (optional - ElizaCloud is preferred)
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
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

Railway deployment is automated via GitHub Actions:

- `main` branch → production
- `develop` or `dev` branch → development

See `docs/railway-dev-prod.md` for setup details.

**Railway-Specific Optimizations:**

Railway is automatically detected via:
- `RAILWAY_ENVIRONMENT` environment variable (most reliable)
- Hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`

When detected, the system:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits (max: 6)
- Prevents "too many clients already" errors

### Vast.ai (Streaming Duel Arena)

For GPU-accelerated streaming deployment:

```bash
# Deploy via GitHub Actions
# See .github/workflows/deploy-vast.yml
```

Requirements:
- NVIDIA GPU with display driver (`gpu_display_active=true`)
- WebGPU support (Chrome with ANGLE/Vulkan)
- Xorg or Xvfb (non-headless)

See `ecosystem.config.cjs` for PM2 process configuration.

### Docker

Build and run with Docker:

```bash
docker build -t hyperscape-server -f Dockerfile.server .
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
4. Verify firewall allows port 5432

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

Should be at latest migration version. If not, restart server to run migrations.

### Docker Issues

**Error:** Docker daemon not running

**Solution:**
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop
3. Restart server

**Alternative:** Use external PostgreSQL instead:
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
USE_LOCAL_POSTGRES=false
```

### Agent Memory Issues

**Error:** High memory usage with many agents

**Solution:** Agent memory management is optimized with:
- InMemoryDatabaseAdapter (no PGLite WASM overhead)
- Memory caps (50 memories per agent, 20 log entries, 100 cache entries)
- Periodic garbage collection (every 60s)
- Concurrency limiting (max 5 concurrent bank queries)

See `AGENTS.md` for detailed memory management documentation.

### Railway "Too Many Clients" Errors

**Error:** `timeout exceeded when trying to connect` or `too many clients already`

**Solution:** Railway uses pgbouncer connection pooling. Set lower limits:

```env
POSTGRES_POOL_MAX=6   # Lower limit for pooler connections
POSTGRES_POOL_MIN=0   # Don't hold idle connections
```

Railway is automatically detected - no manual configuration needed.

## Development

### Code Structure

```
src/
├── index.ts                      # Main server entry point
├── main.ts                       # Server initialization
├── startup/                      # Startup configuration
│   ├── config.ts                 # Environment configuration
│   ├── database.ts               # Database initialization
│   ├── http-server.ts            # Fastify server setup
│   ├── websocket.ts              # WebSocket setup
│   ├── world.ts                  # World initialization
│   └── routes/                   # API route definitions
├── systems/                      # Game systems
│   ├── ServerNetwork/            # Network layer & player lifecycle
│   ├── DatabaseSystem/           # Database operations
│   ├── DuelSystem/               # Duel mechanics
│   ├── StreamingDuelScheduler/   # Streaming duel automation
│   └── TradingSystem/            # Player trading
├── database/                     # Database layer
│   ├── client.ts                 # Connection & migrations
│   ├── schema.ts                 # Drizzle schema
│   ├── repositories/             # Data access layer
│   └── migrations/               # SQL migrations
├── eliza/                        # ElizaOS integration
│   ├── AgentManager.ts           # Agent lifecycle
│   ├── ModelAgentSpawner.ts      # AI model agent spawning
│   ├── ElizaDuelBot.ts           # Duel-specific agent behavior
│   └── EmbeddedHyperscapeService.ts  # Game API for agents
├── arena/                        # Betting integration
│   ├── ArenaService.ts           # Betting API
│   ├── SolanaArenaOperator.ts    # Solana contract integration
│   └── services/                 # Arena subsystems
└── streaming/                    # Streaming capture
    ├── browser-capture.ts        # WebGPU capture
    ├── rtmp-bridge.ts            # RTMP streaming
    └── stream-capture.ts         # Capture orchestration
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

**Standard Pool:**
- Max connections: 20 (increased from 10 in March 2026)
- Idle timeout: 30s
- Connection timeout: 5s

**Serverless Pool (Railway/Neon):**
- Max connections: 20 (increased from 10)
- Connection timeout: 60s (increased from 30s)
- Prevents pool exhaustion with many agents

**Agent Concurrency:**
- Bank queries: Max 5 concurrent (prevents pool exhaustion)
- Staggered refresh intervals (prevents synchronized DB spikes)

**PM2 Configuration:**
- `ecosystem.config.cjs` sets `POSTGRES_POOL_MAX=20` and `POSTGRES_POOL_MIN=2`
- Auto-detects database mode from `DATABASE_URL` hostname
- Explicitly forwards `DATABASE_URL` and `DISPLAY` environment variables

Adjust in `src/database/client.ts` or `ecosystem.config.cjs` if needed.

### Asset Caching

Assets are served with aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

For development, disable browser cache or use incognito mode.

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

Admin API endpoints require `x-admin-code` header:
- `POST /admin/graceful-restart`
- `GET /admin/restart-status`

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Rate Limiting

Built-in rate limiting for:
- WebSocket connections
- API endpoints
- Upload endpoints (50MB limit)

Disable in development with `DISABLE_RATE_LIMIT=true` (not recommended for production).

### Betting Security

- `ARENA_EXTERNAL_BET_WRITE_KEY` - Server-to-server authentication (never expose in frontend)
- RPC proxying - Keep provider-keyed RPC URLs server-side
- Build-time secret detection - Fails build if secrets detected in public env vars

## Recent Improvements (March 2026)

### Database & Performance (March 10, 2026)
- **Connection Pool Increase**: PostgreSQL pool increased from 10 to 20 connections (commit 24fa8a5)
- **Auto-Detection**: Database mode auto-detected from `DATABASE_URL` hostname (commit 3df4370)
- **PM2 Secrets**: `ecosystem.config.cjs` reads secrets directly from `/tmp/hyperscape-secrets.env` (commit 684b203)
- **Environment Forwarding**: Explicit `DATABASE_URL` and `DISPLAY` forwarding through PM2 (commits 5d415fc, 704b955)

### Streaming & Deployment (March 9-10, 2026)
- **Chrome Beta**: Switched to `google-chrome-beta` for better stability (commit 547714e)
- **ANGLE Backend**: Changed from Vulkan to default ANGLE backend for compatibility (commit 547714e)
- **Xvfb Display**: Fixed startup order to ensure virtual display before PM2 (commit 294a36c)
- **Stream Auto-Detection**: Destinations auto-detected from available stream keys (commit 41dc606)
- **CDN URL Fix**: Production CDN URL for Vast streaming deployments (commit 2b3cbcb)
- **Streaming Entry Points**: Dedicated `stream.html` and `stream.tsx` for optimized capture (commit 71dcba8)
- **Viewport Detection**: `clientViewportMode.ts` utility for stream/spectator mode detection (commit 71dcba8)

### AI & ElizaOS (March 9, 2026)
- **ElizaCloud Integration**: Unified access to 13 frontier models via single API key (commit 4d1eb53)
- **Alpha Packages**: Aligned all ElizaOS packages to `alpha` tag for stable releases (commit 6d67ec1)
- **InMemoryDatabaseAdapter**: Replaced PGLite (38-76GB → <5GB for agents)
- **Memory Caps**: 50 memories per agent, 20 log entries, 100 cache entries
- **Periodic GC**: Every 60s to prevent memory leaks

### Security & CSRF (March 9, 2026)
- **Cross-Origin Fix**: CSRF validation now works for localhost/private IP clients (commit 0b1a0bd)
- **Auth Header**: `UsernameSelectionScreen` includes Privy token in Authorization header
- **Token Parsing**: Accept both `{ token }` and `{ csrfToken }` response formats

### Oracle & Betting (March 9, 2026)
- **Betting Stack Split**: Moved to [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) (commit 428329d)
- **Oracle Fields**: Added `damageA`, `damageB`, `winReason`, `seed`, `replayHashHex`, `resultHashHex` (commit aecab58)
- **Oracle Scripts**: Added `verify-duel-oracle-local` for local testing
- **Oracle Deployment**: EVM and Solana deploy scripts with receipt generation

### Code Quality (March 8-9, 2026)
- **TypeScript Fixes**: Nullish coalescing for import.meta.env (commits 74b9852, 6cdbf2c, b542751)
- **Static Imports**: GLTFExporter and Logger converted to static imports
- **Bundle Size**: Increased limits for WebGPU/PhysX bundles (8000KB client, 9000KB asset-forge)
- **Panel Optimization**: Un-lazified critical panels for faster initial load

### Testing & CI (March 9, 2026)
- **Vitest 4.x Upgrade**: Required for Vite 6 compatibility
- **CI Stabilization**: Fixed workflow dependency resolution
- **Anchor Tests**: Skip localnet tests without Solana CLI

## Support

- **Documentation:** 
  - `AGENTS.md` - AI agent features and recent changes
  - `CLAUDE.md` - Development guidelines and architecture
  - `docs/duel-arena-oracle-deploy.md` - Oracle deployment guide
  - `docs/duel-stack.md` - Duel stack documentation
  - [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet) - Betting stack (separate repository)
- **Issues:** Report bugs in the main Hyperscape repository

## License

MIT
