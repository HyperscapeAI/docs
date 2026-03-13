# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- PostgreSQL database with automatic migrations
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket
- 15 registered game actions
- RTMP streaming pipeline with MediaRecorder capture mode
- Duel arena oracle publisher (EVM + Solana)
- ElizaOS AI agent integration with 10 frontier models (direct Anthropic/Groq providers)

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations (connection pool: 20)
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery via CDN
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **RTMP Streaming** - Multi-platform streaming (Twitch, Kick, YouTube) with MediaRecorder capture
- **Duel Arena Oracle** - Verifiable duel outcome publishing to EVM and Solana
- **AI Agents** - ElizaOS integration with 10 frontier models via direct Anthropic/Groq providers (interleaved selection)

## Quick Start

### Prerequisites

- **Bun** (recommended) or Node.js 22+
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance
- **Chrome Canary** (for streaming capture on Linux) - `google-chrome-unstable` (as of March 13, 2026)
- **FFmpeg** (for RTMP streaming) - `apt install ffmpeg` or `brew install ffmpeg`

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

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- CSRF protection for cross-origin clients

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**StreamingDuelScheduler** (`src/systems/StreamingDuelScheduler/`)
- Automated duel matchmaking
- Camera director for spectator views
- Cycle state machine (matchmaking → countdown → combat → results)
- RTMP streaming integration

**DuelArenaOraclePublisher** (`src/oracle/`)
- Publishes duel outcomes to EVM and Solana
- Comprehensive outcome data (damage, win reason, replay hash)
- Metadata API for betting markets

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

- `GET /ws` - WebSocket connection for real-time gameplay

### Actions (HTTP API)

- `GET /api/actions` - List all available actions
- `GET /api/actions/available` - Get actions available to player
- `POST /api/actions/:name` - Execute specific action

### Duel Arena Oracle

- `GET /api/duel-arena/oracle/metadata/:roundId` - Get duel outcome metadata
- `POST /api/duel-arena/oracle/publish` - Publish duel outcome (internal)

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
# Database mode auto-detected from hostname (local vs remote)

# Connection pool (increased March 2026)
POSTGRES_POOL_MAX=20         # Max connections (up from 10)
POSTGRES_POOL_MIN=2          # Min idle connections
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for static assets
PUBLIC_WS_URL=ws://localhost:5555/ws    # WebSocket URL
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club  # Production CDN for duel stack
```

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

### AI Agents (Optional)

```env
# Direct model provider API keys (as of March 12, 2026)
ANTHROPIC_API_KEY=your-anthropic-api-key
GROQ_API_KEY=your-groq-api-key

# Auto-spawn model agents with interleaved provider selection
SPAWN_MODEL_AGENTS=true
MAX_MODEL_AGENTS=4

# Models: Claude Sonnet 4.6, Llama 4 Scout, Claude Opus 4.6, Llama 4 Maverick,
#         Claude Haiku 4.5, Llama 3.3 70B, Kimi K2, Qwen 3 30B
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
- Check Chrome Canary is installed: `google-chrome-unstable --version` (required as of March 13, 2026)
- Verify ANGLE backend: `STREAM_CAPTURE_ANGLE=vulkan` on Linux NVIDIA (required for WebGPU stability)
- Check Xvfb is running: `ps aux | grep Xvfb`
- Verify DISPLAY environment: `echo $DISPLAY` (should be `:99`)
- Verify curl health checks have `--max-time 10` timeout to prevent hangs

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

### Rate Limiting

Not implemented yet. Consider adding:
- Connection rate limiting (websocket)
- API endpoint rate limiting
- Upload size limits (currently 50MB)

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Cloudflare Deployment:** See `CLOUDFLARE.md` (currently disabled)
- **Duel Stack:** See `docs/duel-stack.md` for streaming setup
- **Oracle Deployment:** See `docs/duel-arena-oracle-deploy.md`
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
