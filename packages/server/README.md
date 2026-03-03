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

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **Graceful Restart** - Zero-downtime deployments for duel arena streaming
- **Railway Detection** - Automatic connection pooling configuration for Railway deployments

## Quick Start

### Prerequisites

- **Bun** (v1.3.10+) or Node.js 22+
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance

### Installation

```bash
cd packages/server
bun install
```

### Configuration

Copy the example environment file:
```bash
cp env.example .env
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

**Option 3: Railway (Auto-Detected)**
```env
DATABASE_URL=postgresql://...railway.app/...
# Railway proxy detection is automatic
# Prepared statements are disabled automatically
# Connection pool limits are lowered automatically (max: 6)
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

### Railway Database Configuration

Railway uses connection pooling (pgbouncer) which requires special configuration. The server automatically detects Railway deployments via:

- `RAILWAY_ENVIRONMENT` environment variable (most reliable)
- Hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`

When Railway is detected, the server automatically:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits (max: 6)
- Prevents "too many clients already" errors

**Recommended Railway Configuration:**
```env
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

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

Migrations are defined in `src/db.ts` and run automatically on server start. The migration system tracks version in the `config` table.

**Current migrations:**
1. Users table
2. VRM/avatar column migration
3. Settings config migration
4. Entities scale field update
5. Entities table creation
6. Privy authentication columns
7. RPG tables (players, items, inventory, equipment)
8. World chunks and sessions
9. Characters table (for multi-character support)

**Migration Process Improvements:**

The deployment process now tears down existing processes and closes database connections **before** running migrations to prevent "too many clients already" errors. This is especially important for Neon and other serverless PostgreSQL providers.

## Architecture

### Core Systems

**ServerNetwork** (`src/ServerNetwork.ts`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting

**DatabaseSystem** (`src/DatabaseSystem.ts`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**Database Layer** (`src/db.ts`)
- Connection pooling (pg)
- Migration runner
- Query builder for shared code
- Railway proxy detection and configuration

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

### Admin Endpoints (NEW)

- `POST /admin/graceful-restart` - Request server restart after current duel ends (requires `x-admin-code` header)
- `GET /admin/restart-status` - Check if graceful restart is pending (requires `x-admin-code` header)

**Graceful Restart:**

The graceful restart feature enables zero-downtime deployments for the duel arena stream:

```bash
# Request restart (waits for current duel to complete)
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active: restarts immediately via SIGTERM
- If duel in progress: waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

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

# Connection pool configuration (for production/streaming deployments)
POSTGRES_POOL_MAX=3              # Maximum connections (down from 6, use 1 for duel deployments)
POSTGRES_POOL_MIN=0              # Minimum idle connections (don't hold during crashes)
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
ADMIN_CODE=your-admin-code          # For /admin command and graceful restart
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

### Streaming Configuration (Optional)

```env
# Auto-spawn model agents when database is empty
SPAWN_MODEL_AGENTS=false

# Use production client build (vite preview) instead of dev server
DUEL_USE_PRODUCTION_CLIENT=false

# Placeholder frames during idle periods (prevents 30-min disconnect)
STREAM_PLACEHOLDER_ENABLED=false

# Stream encoding settings
STREAM_LOW_LATENCY=false          # Use zerolatency tune (faster playback start)
STREAM_GOP_SIZE=60                # GOP size in frames (default: 60)

# Stream capture settings
STREAM_AUDIO_ENABLED=true         # Enable audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor  # PulseAudio device to capture
STREAM_CAPTURE_EXECUTABLE=...     # Explicit Chrome path for WebGPU

# Browser restart interval (minutes) to prevent WebGPU OOM
STREAM_BROWSER_RESTART_INTERVAL=45

# Page navigation timeout (seconds) for Vite dev mode
STREAM_PAGE_NAVIGATION_TIMEOUT=120
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

### Railway "too many clients already" Errors

**Error:** PostgreSQL error 53300 (too many connections)

**Solutions:**
1. Set lower connection pool limits:
   ```env
   POSTGRES_POOL_MAX=3
   POSTGRES_POOL_MIN=0
   ```
2. Increase PM2 restart delay:
   ```javascript
   // In ecosystem.config.cjs
   restart_delay: 10000,            // 10s instead of 5s
   exp_backoff_restart_delay: 2000, // 2s for gradual backoff
   ```
3. Ensure Railway detection is working (check logs for "Railway proxy detected")

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

**Error:** "too many clients already" during migration

**Solution:** The deployment script now tears down existing processes before running migrations. If running manually:
```bash
# Stop all PM2 processes first
pm2 stop all

# Run migrations
bunx drizzle-kit push

# Restart processes
pm2 start ecosystem.config.cjs
```

### Character Creation Fails

**Error:** Missing columns when creating character

**Solution:** The characters table migration may not have run. Check:
```sql
SELECT * FROM config WHERE key = 'version';
```

Should be at version 15 or higher. If not, restart server to run migrations.

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

## Development

### Code Structure

```
src/
├── index.ts              # Main server entry point
├── ServerNetwork.ts      # Network layer & player lifecycle
├── DatabaseSystem.ts     # Database operations
├── db.ts                 # Connection & migrations
├── docker-manager.ts     # Docker PostgreSQL automation
├── Storage.ts            # File storage
├── utils.ts              # Utilities (JWT, hashing)
├── privy-auth.ts        # Privy authentication
├── polyfills.ts         # Node.js polyfills
└── systems/
    └── StreamingDuelScheduler/  # Duel arena streaming system
        ├── index.ts             # Main scheduler facade
        └── managers/
            ├── MatchmakingManager.ts  # Agent registration & pairing
            ├── CameraDirector.ts      # Camera targeting
            ├── DuelOrchestrator.ts    # Combat execution
            └── CycleStateMachine.ts   # Phase transitions
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

**Default Configuration:**
- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 5s

**Railway/Serverless Configuration:**
- Max connections: 6 (auto-detected)
- Prepared statements: disabled (auto-detected)
- Idle timeout: 30s

**Streaming/Duel Configuration:**
- Max connections: 1-3 (to minimize connection usage)
- Min connections: 0 (don't hold idle)

Adjust in `src/db.ts` and `src/DatabaseSystem.ts` if needed.

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
2. `/admin <code>` command in chat OR `x-admin-code` header for API endpoints

**Admin API Endpoints:**
- `POST /admin/graceful-restart` - Request zero-downtime restart
- `GET /admin/restart-status` - Check restart status

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Rate Limiting

Not implemented yet. Consider adding:
- Connection rate limiting (websocket)
- API endpoint rate limiting
- Upload size limits (currently 50MB)

## New Features (March 2026)

### Graceful Restart API

Zero-downtime deployments for the duel arena stream:

```typescript
// Programmatic API
import { getStreamingDuelScheduler } from './systems/StreamingDuelScheduler';

const scheduler = getStreamingDuelScheduler();
scheduler?.requestGracefulRestart();
```

```bash
# HTTP API
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active: restarts immediately via SIGTERM
- If duel in progress: waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code

### Placeholder Frame Mode

Prevents Twitch/YouTube 30-minute disconnect during idle periods:

```env
STREAM_PLACEHOLDER_ENABLED=true
```

When enabled:
- Detects when no frames received for 5 seconds
- Switches to minimal JPEG frames at configured FPS
- Automatically exits placeholder mode when live frames resume
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size

### Model Agent Spawning

Auto-create agents when database is empty:

```env
SPAWN_MODEL_AGENTS=true
```

Useful for:
- Fresh deployments
- Testing duel arena without manual agent creation
- Ensuring duels can run even with empty database

### Railway Database Detection

Automatic detection and configuration for Railway deployments:

- Detects via `RAILWAY_ENVIRONMENT` env var (most reliable)
- Also detects hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`
- Automatically disables prepared statements (not supported by pgbouncer)
- Automatically uses lower connection pool limits (max: 6)
- Fixes "too many clients already" errors

No manual configuration required - detection is automatic.

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Cloudflare Deployment:** See `CLOUDFLARE.md` (currently disabled)
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
