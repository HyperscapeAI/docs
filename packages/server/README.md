# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- **Runtime**: Node.js 22+ (migrated from Bun for V8 incremental GC - March 2026)
- **WebSocket**: Dual-port architecture (Fastify HTTP + uWebSockets.js game traffic - March 2026)
- **AI Agents**: Worker thread architecture supporting 25+ agents without tick blocking (March 2026)
- **Pathfinding**: Global BFS iteration budget with pre-baked terrain walkability (March 2026)
- PostgreSQL database with automatic migrations (connection pool: 20)
- 54 mobs + 5 NPCs spawning at startup with functional AI state machines
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket (uWS pub/sub for 50+ concurrent players)
- 15 registered game actions
- RTMP streaming pipeline with CDP capture mode
- Duel arena oracle publisher (EVM + Solana)
- ElizaOS AI agent integration with 10+ frontier models (OpenAI, Anthropic, Groq)

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

- **Node.js Runtime** - V8 incremental GC for <10ms pauses (migrated from Bun - March 2026)
- **uWebSockets.js** - Native pub/sub broadcasting for 50+ concurrent players (March 2026)
- **Worker Thread AI** - Agent behavior runs off main thread, supports 25+ agents (March 2026)
- **Optimized Pathfinding** - Global BFS budget, pre-baked walkability, per-tick caching (March 2026)
- **PostgreSQL Database** - Full persistence with automatic migrations (connection pool: 20)
- **Dual WebSocket Ports** - Fastify (5555) for HTTP, uWS (5556) for game traffic
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery via CDN
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **RTMP Streaming** - Multi-platform streaming (Twitch, Kick, YouTube) with CDP capture
- **Duel Arena Oracle** - Verifiable duel outcome publishing to EVM and Solana
- **AI Agents** - ElizaOS integration with 10+ frontier models (OpenAI, Anthropic, Groq)

## Quick Start

### Prerequisites

- **Node.js 22+** (REQUIRED for server runtime as of March 2026)
- **Bun 1.3.10+** (for package management and build scripts)
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance
- **Chrome Beta** (for streaming capture on Linux) - `google-chrome-beta` (as of March 20, 2026)
- **FFmpeg** (for RTMP streaming) - `apt install ffmpeg` or `brew install ffmpeg`

**Important**: The server runtime was migrated from Bun to Node.js in March 2026 to eliminate stop-the-world GC pauses. Bun is still used for package management and build scripts, but the production server runs on Node.js.

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
# Database mode auto-detected from hostname (local vs remote)
```

**Streaming Configuration (Optional)**
```env
# Streaming capture mode (default: cdp)
STREAM_CAPTURE_MODE=cdp

# Chrome channel (default: chrome-canary for Linux, as of March 13, 2026)
STREAM_CAPTURE_CHANNEL=chrome-canary

# ANGLE backend (default: vulkan for Linux NVIDIA)
STREAM_CAPTURE_ANGLE=vulkan

# Stream keys (auto-detected destinations)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
YOUTUBE_STREAM_KEY=your-youtube-stream-key

# Display (for Xvfb virtual display)
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true
```

**ElizaCloud AI (Optional)**
```env
# Single API key for 13 frontier models
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
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

**Production Build:**
```bash
bun run build
bun run start
```

**Duel Stack (Game + Agents + Streaming):**
```bash
bun run duel
```
This starts:
- Game server and client
- ElizaOS AI agents
- RTMP streaming pipeline
- Duel arena oracle publisher

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
- Production CDN: `https://assets.hyperscape.club`

## Database

### PostgreSQL Setup

The server uses PostgreSQL with automatic migrations. On first run:

1. If `USE_LOCAL_POSTGRES=true`, Docker will start a PostgreSQL container
2. Migrations run automatically on startup
3. Tables are created: users, characters, players, inventory, equipment, etc.

**Connection Pool Configuration (March 2026)**:
- Max connections: 20 (increased from 10)
- Min connections: 2
- Prevents timeout errors under high load from concurrent agent queries

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
cd packages/server
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

## Architecture

### Runtime Architecture (Updated March 2026)

**Node.js Runtime**: Server runs on Node.js 22+ (migrated from Bun)
- **Why**: V8 incremental GC keeps pauses <10ms vs Bun's JSC stop-the-world GC (500-1200ms)
- **ESM Hooks**: `scripts/node-esm-hooks.mjs` resolves Bun workspace package imports
- **Start Command**: `node --import ./scripts/register-hooks.mjs dist/index.js`

**Dual WebSocket Ports**: Optimized for different traffic patterns
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints, file uploads
- **Port 5556** (uWebSockets.js): Game WebSocket traffic (real-time multiplayer)
- **Pub/Sub Topics**: `global`, `region:<key>`, `spectator` for native C++ fan-out
- **Fallback**: Set `UWS_ENABLED=false` to use Fastify WebSocket on port 5555

**Worker Thread AI**: Agent behavior runs off main thread
- **AgentBehaviorBridge** (main thread): Collects snapshots, applies results
- **AgentBehaviorEngine** (worker thread): Pure decision logic (no World access)
- **Batch Processing**: Up to 5 agents per 1000ms poll cycle
- **Staggered Scheduling**: 800ms offset between agents to prevent simultaneous ticks
- **Shared Snapshot**: Entity scan once per second across ALL agents (not per-agent)

**Optimized Pathfinding**: Global BFS iteration budget
- **Budget**: 12,000 iterations/tick shared across all callers
- **Scratch Tiles**: Zero-allocation neighbor checks
- **Walkability Cache**: Per-tick cache (first check expensive, rest O(1))
- **Pre-Baked Flags**: WATER and STEEP_SLOPE baked into collision matrix at terrain generation

**Tick System**: 600ms OSRS-accurate ticks
- **Drift Correction**: setTimeout adjusted for accumulated drift
- **Health Monitoring**: Tracks missed ticks, lateness, duration
- **Per-Handler Timing**: Identifies bottlenecks (mob AI, combat, movement)
- **Named Handlers**: `onTick(handler, priority, "mobAI")` for diagnostics

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- Dual WebSocket transport (Fastify + uWS)
- Native pub/sub broadcasting (region-based topics)
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- CSRF protection for cross-origin clients
- Spatial indexing for nearby entity queries

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management (pool: 20)
- Character CRUD operations
- Player data persistence
- Inventory and equipment management
- Activity logging with ring buffer

**AgentManager** (`src/eliza/AgentManager.ts`)
- Agent lifecycle management (start, stop, pause, resume)
- Worker thread coordination via AgentBehaviorBridge
- Combat damage event handling
- Model agent spawning (OpenAI, Anthropic, Groq)

**StreamingDuelScheduler** (`src/systems/StreamingDuelScheduler/`)
- Automated duel matchmaking
- Camera director for spectator views
- Cycle state machine (matchmaking → countdown → combat → results)
- RTMP streaming integration

**DuelArenaOraclePublisher** (`src/oracle/`)
- Publishes duel outcomes to EVM and Solana
- Comprehensive outcome data (damage, win reason, replay hash)
- Metadata API for betting markets
- Settlement delay for stream sync (7s default)

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

### Assets

- `GET /*` - Game assets (models, textures, audio)
- `GET /assets/*` - Legacy asset path (backward compatible)

### WebSocket

- `GET /ws` - WebSocket connection for real-time gameplay (Fastify on port 5555 or uWS on port 5556)

### Actions (HTTP API)

- `GET /api/actions` - List all available actions
- `GET /api/actions/available` - Get actions available to player
- `POST /api/actions/:name` - Execute specific action

### Duel Arena Oracle

- `GET /api/duel-arena/oracle/metadata/:roundId` - Get duel outcome metadata
- `POST /api/duel-arena/oracle/publish` - Publish duel outcome (internal)

### Internal Betting Feed (March 2026)

**Authentication Required**: All endpoints require `Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>` header or `?streamToken=<token>` query parameter (SSE only).

- `GET /api/internal/bet-sync/state` - Bootstrap endpoint with current state + replay buffer
  - Returns: Current duel cycle state, renderer health, and recent frame history
  - Rate limit: 240 requests/minute per IP
  
- `GET /api/internal/bet-sync/events` - Server-Sent Events (SSE) feed for real-time updates
  - Query params: `?since=<sequence>` for replay from specific sequence number
  - Returns: Stream of `BettingFeedPayload` events with sequence numbers
  - Rate limit: 60 requests/minute per IP
  - Max clients: 32 concurrent connections
  - Heartbeat: Every 15 seconds
  - Replay buffer: 2048 frames

**Payload Structure**:
```typescript
interface BettingFeedPayload {
  seq: number;              // Monotonic sequence number
  sourceEpoch: number;      // Server start timestamp
  emittedAt: number;        // Emission timestamp
  phaseVersion: number;     // Increments on phase transitions
  cycle: StreamingCycleState;
  rendererHealth: {
    ready: boolean;
    degradedReason: string | null;
    updatedAt: number;
    phase: string | null;
  };
}
```

**Configuration**:
```bash
# Required
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Optional
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
```

### Admin Endpoints

- `GET /admin/logs` - Fetch recent server logs (requires admin auth)
- `POST /admin/restart` - Restart server process (requires PM2)
- `GET /admin/maintenance/status` - Get maintenance mode status
- `POST /admin/maintenance/enter` - Enter maintenance mode
- `POST /admin/maintenance/exit` - Exit maintenance mode

### Utility

- `GET /env.js` - Public environment variables for client
- `POST /api/upload` - Upload user assets (VRM, textures)
- `GET /api/upload-check` - Check if asset exists

## Environment Variables

### Required

```env
PORT=5555                    # Server HTTP port (Fastify)
UWS_PORT=5556                # Game WebSocket port (uWebSockets.js) - NEW March 2026
UWS_ENABLED=true             # Enable uWS transport (default: true) - NEW March 2026
WORLD=world                  # World directory path
NODE_ENV=development         # Environment (development, production, staging, test)
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
# Database mode auto-detected from hostname (local vs remote)

# Connection pool (increased March 2026)
POSTGRES_POOL_MAX=20         # Max connections (up from 10)
POSTGRES_POOL_MIN=2          # Min idle connections
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for static assets
PUBLIC_WS_URL=ws://localhost:5556/ws    # WebSocket URL (uWS port) - UPDATED March 2026
PUBLIC_API_URL=http://localhost:5555    # HTTP API URL (Fastify port)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club  # Production CDN for duel stack
```

**WebSocket URL Configuration** (March 2026):
- **Default**: `ws://localhost:5556/ws` (uWebSockets.js on port 5556)
- **Fallback**: `ws://localhost:5555/ws` (Fastify WebSocket when `UWS_ENABLED=false`)
- **Production**: `wss://hyperscape.gg/ws` (load balancer routes to uWS port)

### Authentication (Optional)

```env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
ADMIN_CODE=your-admin-code          # For /admin command
```

### Streaming (Optional)

```env
# Capture mode (default: cdp)
STREAM_CAPTURE_MODE=cdp

# Chrome channel (default: chrome-beta for Linux, as of March 20, 2026)
STREAM_CAPTURE_CHANNEL=chrome-beta

# ANGLE backend (default: vulkan for Linux NVIDIA)
STREAM_CAPTURE_ANGLE=vulkan

# Capture browser security (March 2026)
CAPTURE_DISABLE_SANDBOX=false  # Only enable for Docker/CI

# Stream keys (auto-detected destinations)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-stream-key
YOUTUBE_STREAM_KEY=your-youtube-stream-key

# Display (for Xvfb virtual display)
DISPLAY=:99
DUEL_CAPTURE_USE_XVFB=true

# Streaming viewer access token (optional)
# Passed as #streamToken in URL hash (not query params)
STREAMING_VIEWER_ACCESS_TOKEN=your-viewer-token
```

### Internal Betting Feed (March 2026)

```env
# Required for betting feed access
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# CORS origin for betting consumers
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com

# SSE feed configuration
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
STREAMING_SSE_PUSH_INTERVAL_MS=500
STREAMING_SSE_MAX_PENDING_BYTES=1048576
STREAMING_SSE_HEARTBEAT_MS=15000

# Development-only auth bypass (NEVER enable in production)
BETTING_FEED_SKIP_AUTH=false
```

### AI Agents (Optional)

```env
# Direct model provider API keys (as of March 20, 2026)
ANTHROPIC_API_KEY=your-anthropic-api-key
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key  # NEW: Added March 20, 2026

# Auto-spawn model agents with interleaved provider selection
SPAWN_MODEL_AGENTS=true
DUEL_BOT_COUNT=10  # Increased from 4 to 10 (March 20, 2026)

# Available models (as of March 20, 2026):
# - OpenAI: GPT-4o, GPT-4.1, GPT-4o Mini, o4-mini
# - Anthropic: Claude Sonnet 4.6, Claude Opus 4.6, Claude Haiku 4.5, Claude Opus 4, Claude Sonnet 4
# - Groq: Llama 4 Scout, Llama 4 Maverick, Llama 3.3 70B, Kimi K2, Qwen 3 30B

# Agent behavior configuration (March 2026)
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000  # Agent tick interval (ms)
AGENT_STAGGER_OFFSET_MS=800           # Stagger offset between agents (ms)
MAX_AGENTS_PER_POLL=5                 # Max agents per poll cycle
```

### Duel Arena Oracle (Optional)

```env
# Oracle toggle
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet  # or mainnet

# Metadata API
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://api.hyperscape.gg/api/duel-arena/oracle

# Signers
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
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

### Docker

Build and run with Docker:

```bash
docker build -t hyperscape-server -f Dockerfile.server .
docker run -p 5555:5555 \
  -e DATABASE_URL=postgresql://... \
  hyperscape-server
```

**Docker Improvements (March 12-13, 2026)**:
- **Manifest Embedding**: Manifests are now embedded in Docker image at build time (eliminates CDN dependency for server startup)
- **Workspace Symlinks**: `bun install --production` runs in runtime stage to restore workspace symlinks for externalized packages (@hyperscape/decimation, @hyperscape/impostors, @hyperscape/physx-js-webidl, @hyperscape/procgen)
- **Cache Invalidation**: Manifest copy layer is invalidated on every build to ensure fresh manifests (prevents stale biome configs)
- **Fresh Asset Fetch**: Assets folder is removed before `ensure-assets.mjs` to prevent Docker build cache from storing stale manifests

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

### Vast.ai Streaming Deployment

For GPU-accelerated streaming deployments on Vast.ai:

```bash
# Deploy via GitHub Actions
# Set required secrets in repository settings:
# - DATABASE_URL
# - TWITCH_STREAM_KEY
# - KICK_STREAM_KEY
# - VAST_HOST, VAST_PORT, VAST_SSH_KEY

# Or deploy manually:
./scripts/deploy-vast.sh
```

**Requirements**:
- NVIDIA GPU with display driver (`gpu_display_active=true`)
- Chrome Canary installed (`google-chrome-unstable`, as of March 13, 2026)
- Xvfb virtual display
- FFmpeg for RTMP encoding (system FFmpeg preferred over ffmpeg-static)

**Deployment Improvements (March 13, 2026)**:
- **Fresh Asset Fetch**: Deployment script forcefully removes cached `packages/server/world/assets` folder before `bun install` to ensure latest manifests are fetched from Git LFS
- **Orphaned Process Cleanup**: Explicit `pkill` commands kill ghost bun server processes before deployment to prevent database deadlocks
- **SSH Timeout Fix**: Background processes (Xvfb, socat) are disowned to prevent 30-minute SSH hangs
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
- **Docker Workspace Symlinks**: `bun install --production` runs in Docker runtime stage to restore workspace symlinks for externalized packages

**Configuration**:
- `ecosystem.config.cjs` - PM2 configuration with streaming settings
- `scripts/deploy-vast.sh` - Deployment script with auto-detection and cleanup
- See `docs/duel-stack.md` for detailed streaming setup

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

### Database Connection Pool Exhaustion

**Error:** "timeout exceeded when trying to connect"

**Solution:** Connection pool increased to 20 (March 2026). If still seeing errors:
```env
# Increase pool size
POSTGRES_POOL_MAX=30
POSTGRES_POOL_MIN=5
```

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

Should be at version 15 or higher. If not, restart server to run migrations.

### CSRF 403 Errors

**Error:** "CSRF validation failed" when creating account from localhost client against deployed server

**Solution:** Fixed in commit 0b1a0bd (March 2026). Ensure:
- Client includes Privy auth token in Authorization header
- Server CSRF middleware allows localhost/private IP origins
- Both `{ token }` and `{ csrfToken }` response formats are supported

### Streaming Issues

**Error:** Stream freezing or stalling under Xvfb + WebGPU

**Solution:** Use CDP mode (default since March 2026):
```env
STREAM_CAPTURE_MODE=cdp
```

**Error:** Stream buffering or viewer lag

**Solution:** Verify frame pacing configuration (fixed March 11, 2026):
- Xvfb runs at 30fps (no vsync)
- `everyNthFrame: 1` in CDP screencast config (no frame skipping)
- Output resolution matches capture viewport (1280x720)
- GOP size is 60 frames (2s at 30fps) per Twitch/YouTube recommendations

**Error:** "cannot open display"

**Solution:** Ensure Xvfb is running and DISPLAY is set:
```bash
# Check Xvfb process
ps aux | grep Xvfb

# Verify DISPLAY environment
echo $DISPLAY  # Should be :99

# Start Xvfb manually if needed
Xvfb :99 -screen 0 1280x720x24 &
export DISPLAY=:99
```

**Error:** WebGPU initialization failed

**Solution:** Verify GPU display driver is active:
- Vast.ai: Ensure `gpu_display_active=true` in instance configuration
- Check Chrome Beta is installed: `google-chrome-beta --version` (recommended as of March 20, 2026)
- Verify ANGLE backend: `STREAM_CAPTURE_ANGLE=vulkan` on Linux NVIDIA (required for WebGPU stability)
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment: `echo $DISPLAY` (should be `:99`)
- Verify curl health checks have `--max-time 10` timeout to prevent hangs

**Error:** Renderer health shows degraded (March 2026)

**Solution:** Check renderer health diagnostics:
```bash
# Query renderer health from capture pipeline
curl http://localhost:3333/stream.html
# Then in browser console:
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__
```

Common `degradedReason` values:
- `"loading_overlay_active"` - Loading screen hasn't dismissed yet (wait or check for init errors)
- `"arena_positions_invalid"` - Agents spawned at overlapping positions (server bug)
- `"initialization_failed"` - World init error (check browser console for details)
- `"camera_target_unresolved"` - Camera hasn't locked to target (usually resolves automatically)
- `"renderer_unavailable"` - WebGPU not available (check GPU drivers)

**Error:** Betting feed authentication failures (March 2026)

**Solution:** Verify token configuration:
```bash
# Check token is set
echo $BETTING_FEED_ACCESS_TOKEN

# Test bootstrap endpoint
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state

# Test SSE endpoint
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/events
```

**Error:** Embedded client not receiving auth bootstrap (March 2026)

**Solution:** Verify origin allowlist:
```bash
# Check client .env
PUBLIC_EMBED_ALLOWED_ORIGINS=https://embed.example.com

# Verify parent origin is in allowlist
# Check browser console for "Ignoring HYPERSCAPE_AUTH from untrusted origin" warnings
```

### Manifest & CDN Issues

**Error:** Canyon biome fails to load or \"Failed to load manifest\" errors

**Solution:** Manifests are now embedded in Docker images (March 13, 2026):
- **Docker**: Rebuild image to pick up latest manifests: `docker build -f Dockerfile.server .`
- **Local Dev**: Ensure assets are synced: `bun run assets:sync`
- **CDN**: Cache busting is automatically applied (no manual purging needed)
- **Vast.ai**: Deployment script forcefully removes cached assets folder before install

**Error:** Stale game data (outdated items, NPCs, terrain configs)

**Solution:** Cache busting is now automatic (March 13, 2026):
- **Client**: Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- **Server**: Manifests embedded in Docker - rebuild image
- **CDN**: Manifests uploaded with cache-busting timestamps
- **R2 Upload**: Wrangler uses `--remote` flag to target remote Cloudflare bucket

**Error:** R2 uploads failing silently

**Solution:** Ensure `--remote` flag is used (fixed March 13, 2026):
```bash
wrangler r2 object put --remote <bucket>/<key> --file <path>
```

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

**Error:** \"Cannot find module @hyperscape/decimation\" in Docker

**Solution:** Workspace symlinks are now restored (March 12, 2026):
- Verify Dockerfile includes `RUN bun install --production` after COPY steps
- This restores workspace symlinks that Docker COPY flattens
- Affects externalized packages: @hyperscape/decimation, @hyperscape/impostors, @hyperscape/physx-js-webidl, @hyperscape/procgen

**Error:** Deployment hangs for 30 minutes on Vast.ai

**Solution:** SSH timeout fixed (March 11, 2026):
- Background processes (Xvfb, socat) are now disowned to allow SSH to exit cleanly
- Deployment should complete in ~1 minute
- Check `scripts/deploy-vast.sh` includes `disown` after background processes

**Error:** Database connection deadlocks after deployment

**Solution:** Orphaned process cleanup added (March 11, 2026):
- Deployment script now kills ghost bun server processes before starting new deployment
- Prevents database connection leaks from orphaned processes
- Check `scripts/deploy-vast.sh` includes `pkill -f "bun.*packages/server"` commands

## Development

### Code Structure

```
src/
├── index.ts              # Main server entry point
├── main.ts               # Server initialization
├── startup/              # Startup modules
│   ├── config.ts         # Configuration loading
│   ├── database.ts       # Database initialization
│   ├── http-server.ts    # Fastify HTTP server
│   ├── websocket.ts      # WebSocket setup
│   └── routes/           # HTTP route handlers
├── systems/              # Game systems
│   ├── ServerNetwork/    # Network layer & player lifecycle
│   ├── DatabaseSystem/   # Database operations
│   ├── DuelScheduler/    # Duel matchmaking
│   └── StreamingDuelScheduler/  # Streaming duel automation
├── database/             # Database layer
│   ├── client.ts         # PostgreSQL connection
│   ├── schema.ts         # Drizzle schema
│   ├── migrations/       # SQL migrations
│   └── repositories/     # Data access layer
├── eliza/                # ElizaOS integration
│   ├── AgentManager.ts   # Agent lifecycle
│   ├── ModelAgentSpawner.ts  # Model agent spawning
│   └── agentHelpers.ts   # Agent configuration
├── oracle/               # Duel arena oracle
│   ├── DuelArenaOraclePublisher.ts  # Oracle publisher
│   ├── config.ts         # Oracle configuration
│   └── types.ts          # Oracle types
├── streaming/            # RTMP streaming
│   ├── browser-capture.ts  # MediaRecorder capture
│   ├── rtmp-bridge.ts    # WebSocket → FFmpeg
│   └── stream-destinations.ts  # Multi-platform streaming
├── middleware/           # HTTP middleware
│   └── csrf.ts           # CSRF protection
└── utils.ts              # Utilities (JWT, hashing)
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

## Streaming & Betting Integration (March 2026)

### Internal Betting Feed

The server provides an authenticated SSE feed for betting market synchronization:

**Architecture**:
- **Source of Truth**: Hyperscape is authoritative for duel lifecycle events
- **Sequence-Aware**: Monotonic sequence numbers enable idempotent deduplication
- **Renderer Health**: Signals distinguish healthy frames from degraded/loading states
- **Replay Buffer**: 2048-frame buffer supports SSE reconnection with `?since=<seq>`

**Endpoints**:
```bash
# Bootstrap - get current state + replay buffer
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state

# SSE feed - real-time updates
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/events?since=0
```

**DuelBettingBridge Lifecycle**:
1. **Announcement**: Creates or syncs market with Solana operator
2. **Fight Start**: Locks market (no new bets)
3. **Resolution**: Resolves market with winner/loser data
4. **Reconciliation**: 1-second loop ensures market stays aligned with streaming lifecycle

**Configuration**:
```bash
# Required
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Optional
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
STREAMING_SSE_PUSH_INTERVAL_MS=500
```

**Renderer Health Monitoring**:
```typescript
// Server-side health derivation
function deriveBettingRendererHealth(cycle: StreamingCycleState): {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}

// Checks:
// - Active streaming phase (ANNOUNCEMENT, COUNTDOWN, FIGHTING)
// - Agent presence and HP validity
// - Arena position sanity (no overlaps, within bounds)
// - External RTMP status (if available)
// - Capture pipeline health
```

**Security**:
- Timing-safe token comparison (SHA-256 + `timingSafeEqual`)
- CORS restricted to `INTERNAL_BET_SYNC_ALLOWED_ORIGIN`
- Rate limiting: 240 req/min (bootstrap), 60 req/min (SSE)
- Fails closed in production when `BETTING_FEED_ACCESS_TOKEN` is unset

### Streaming Capture Pipeline

**Renderer Health Probes** (`packages/server/scripts/stream-to-rtmp.ts`):
```typescript
// Lightweight window global probe (no DOM text computation)
window.__HYPERSCAPE_STREAM_BOOT_STATUS__: string | null
// Values: "connecting" | "initializing" | "loading_assets" | "finalizing"
//         "error:webgpu_required" | "error:init_failed" | "error:http"

// Explicit health object (set by StreamingMode component)
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__: {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}
```

**Capture Browser Policy** (`packages/server/src/streaming/captureBrowserPolicy.ts`):
```typescript
// Default launch args (secure by default)
buildDefaultCaptureLaunchArgs({
  angleBackend: "vulkan",  // or "metal" on macOS
  featureFlags: "--enable-features=Vulkan,UseSkiaRenderer,WebGPU",
  disableSandbox: false,   // Opt-in via CAPTURE_DISABLE_SANDBOX=true
})

// Navigation allowlist (prevents redirect attacks)
resolveAllowedCaptureOrigins(gameUrlCandidates)
assertAllowedCaptureNavigation(rawUrl)
```

**Configuration**:
```bash
# Capture mode
STREAM_CAPTURE_MODE=cdp  # or webcodecs, mediarecorder

# Browser security
CAPTURE_DISABLE_SANDBOX=false  # Only enable for Docker/CI

# Renderer health probe
STREAMING_SSE_HEARTBEAT_MS=15000
```

## Performance

### Database Connection Pool

- Max connections: 20 (increased March 2026)
- Min connections: 2
- Idle timeout: 30s
- Connection timeout: 60s

Adjust in `.env` or `ecosystem.config.cjs`:
```env
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
```

### Asset Caching

Assets are served with aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

For development, disable browser cache or use incognito mode.

### Streaming Performance

**CDP Mode** (default as of March 2026):
- Chrome DevTools Protocol for reliable frame capture
- Better frame pacing control (30fps enforcement)
- More predictable latency

**Chrome Canary** (Linux, as of March 13, 2026):
- Best WebGPU stability on Linux NVIDIA GPUs
- Fewer rendering artifacts than Beta/Stable channels
- Required for production streaming on Vast.ai

**Vulkan ANGLE Backend** (Linux NVIDIA):
- Only ANGLE backend that works reliably with WebGPU on Linux NVIDIA
- ANGLE OpenGL ES (`--use-angle=gl`) fails with "Invalid visual ID"
- Native Vulkan (`--use-vulkan`) crashes
- Use `STREAM_CAPTURE_ANGLE=vulkan` for Linux NVIDIA deployments

**System FFmpeg**:
- Preferred over ffmpeg-static to avoid segfaults
- Resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static
- Install via package manager: `apt install ffmpeg` (Linux) or `brew install ffmpeg` (macOS)

## Security

### Authentication

Optional Privy authentication provides:
- Wallet-based login
- Farcaster Frame v2 support
- Account-to-character linking

### CSRF Protection

Cross-origin requests are protected with CSRF tokens:
- Requests with `Authorization: Bearer` header skip CSRF validation
- Cookie-based CSRF validation for unauthenticated requests
- Localhost and private IP origins are allowed for development

### Admin Access

Admin commands require:
1. `ADMIN_CODE` set in environment
2. `/admin <code>` command in chat

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Betting Feed Security (March 2026)

**Timing-Safe Token Comparison**:
- Uses `timingSafeEqual` on SHA-256 digests to prevent timing attacks
- Constant-time comparison for `BETTING_FEED_ACCESS_TOKEN`

**Token Handling**:
- Tokens moved to URL hash fragments (not sent to servers in HTTP requests)
- Immediate scrubbing via `history.replaceState` prevents browser history leakage
- Log redaction via `redactStreamingSecretsFromUrl` for all log output

**Embedded Client Security**:
- Origin validation for `postMessage` auth bootstrap
- Rejects wildcard (`*`), `null`, and non-http(s) origins
- Explicit allowlist via `PUBLIC_EMBED_ALLOWED_ORIGINS`
- `HYPERSCAPE_READY` no longer broadcasts with wildcard in production

**Capture Browser Hardening**:
- Removed `--disable-web-security` from default Chromium args
- Made `--no-sandbox` opt-in via `CAPTURE_DISABLE_SANDBOX` environment variable
- Navigation allowlist prevents redirect-to-malicious-origin attacks
- Capture browser only navigates to allowed game origins

**Shell Injection Prevention**:
- Migrated from `exec` (shell-interpreted) to `execFile` (no shell)
- Container names passed as array args, not interpolated into command strings

### Rate Limiting

**Betting Feed Endpoints** (March 2026):
- Bootstrap endpoint: 240 requests/minute per IP
- SSE events endpoint: 60 requests/minute per IP
- Max concurrent SSE clients: 32 (configurable via `BETTING_SSE_MAX_CLIENTS`)

**General Endpoints**:
- Upload size limits: 50MB (configurable via `PUBLIC_MAX_UPLOAD_SIZE`)
- WebSocket connection limits enforced by `ConnectionHandler`

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Cloudflare Deployment:** See `CLOUDFLARE.md` (currently disabled)
- **Duel Stack:** See `docs/duel-stack.md` for streaming setup
- **Oracle Deployment:** See `docs/duel-arena-oracle-deploy.md`
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
