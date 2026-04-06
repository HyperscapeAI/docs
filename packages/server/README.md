# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend and uWebSockets.js for high-performance WebSocket communication.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to Node.js 22+ with uWebSockets.js and is production-ready with:
- **Node.js 22+ Runtime**: V8 incremental GC eliminates stop-the-world pauses (March 2026)
- **uWebSockets.js**: Native pub/sub broadcasting on port 5556 for efficient multiplayer
- **PostgreSQL Database**: Full persistence with automatic migrations
- **Worker Thread AI**: Agent decision logic runs off main thread (200-600ms blocking eliminated)
- **Tick-Based Systems**: OSRS-accurate resource respawn, combat, and movement
- **54+ mobs + 5 NPCs** spawning at startup  
- **Character creation** and multi-character support
- **Complete persistence** layer (inventory, equipment, skills, position, bank, death locks)
- **Real-time multiplayer** via uWebSockets.js (port 5556)
- **15+ registered game actions**

## Features

- **Node.js 22+ Runtime** - V8 incremental GC for stable tick performance
- **uWebSockets.js** - High-performance WebSocket server on port 5556
- **PostgreSQL Database** - Full persistence with automatic migrations
- **Worker Thread AI** - Agent behavior runs off main thread
- **Tick System** - Deterministic 600ms OSRS-style game ticks
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery via CDN
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **Death System** - OSRS-style keep-3 items with gravestone privacy
- **Resource System** - Tick-based respawn with manifest-driven depletion

## Quick Start

### Prerequisites

- **Node.js 22+** (required for server runtime)
- **Bun 1.3.10+** (for package management and build tasks)
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance

### Installation

```bash\ncd packages/server
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

**WebSocket Configuration:**
```env
UWS_ENABLED=true          # Enable uWebSockets.js (default: true)
UWS_PORT=5556             # WebSocket port (default: 5556)
PUBLIC_WS_URL=ws://localhost:5556/ws  # Client WebSocket URL
```

### Running

**Development:**
```bash
bun run dev
```
This automatically starts:
- CDN Server (nginx on port 8080) - via Docker
- Game Server HTTP (Fastify on port 5555)
- Game Server WebSocket (uWebSockets.js on port 5556)
- Client (Vite on port 3333)

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
3. Tables are created: users, characters, players, inventory, equipment, bank, death_locks, etc.

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

Migrations are managed by Drizzle ORM and run automatically on server start.

**Run migrations manually:**
```bash
cd packages/server
bunx drizzle-kit push      # Push schema changes
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

**Current schema includes:**
- Users and authentication (Privy integration)
- Characters (multi-character support)
- Players (active game sessions)
- Inventory and equipment
- Bank storage with tabs
- Skills and XP tracking
- Death locks (crash recovery)
- Quest progress
- NPC kill tracking
- Activity logs

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/index.ts`)
- uWebSockets.js connection handling (port 5556)
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- Tick system integration (600ms OSRS ticks)
- Mob AI tick processing

**DatabaseSystem** (`src/systems/DatabaseSystem/index.ts`)
- PostgreSQL connection management (pool size: 20)
- Character CRUD operations
- Player data persistence
- Inventory and equipment management
- Bank operations with tab support
- Death lock management

**TickSystem** (`src/systems/TickSystem.ts`)
- Deterministic 600ms game ticks
- Drift correction and health monitoring
- Per-handler timing and diagnostics
- Priority-based tick ordering

**ResourceSystem** (`packages/shared/src/systems/shared/entities/ResourceSystem.ts`)
- Tick-based resource respawn (no setTimeout)
- Manifest-driven depletion chance
- OSRS-accurate gathering mechanics

### Character System

The server supports multiple characters per account:

1. **Account** - Identified by Privy user ID or legacy user ID
2. **Character** - Each account can have multiple characters
3. **Player Session** - Character becomes \"player\" when spawned in world

**Flow:**
```
Login → Character List → Select/Create Character → Enter World → Spawn as Player
```

### Performance Architecture (March 2026)

**Server Runtime**: Node.js 22+ with V8 incremental GC
- Eliminates 500-1200ms stop-the-world GC pauses
- Tick blocking reduced from 900-2400ms to 110-200ms (81-92% reduction)
- Missed ticks reduced from 3-5/min to 0 under normal load

**uWebSockets.js Integration**:
- Native pub/sub broadcasting (eliminates O(n) socket iteration)
- Dedicated WebSocket port 5556 (HTTP on 5555)
- Efficient binary message framing

**Agent AI Worker Thread**:
- Decision logic runs off main thread
- Eliminates 200-600ms blocking from main tick loop
- Supports 25+ concurrent AI agents

**BFS Pathfinding Optimization**:
- Global iteration budget (12,000 per tick)
- Zero-allocation scratch tiles
- Per-tick walkability cache

**Terrain System Optimization**:
- Low-res collision mesh (16×16)
- Time-budgeted processing (8ms collision, 4ms walkability)
- Pre-baked walkability flags

## API Endpoints

### Health & Status

- `GET /health` - Health check (for load balancers)
- `GET /status` - Detailed server status with player count

### Assets

- `GET /*` - Game assets (models, textures, audio)
- `GET /assets/*` - Legacy asset path (backward compatible)

### WebSocket

- `GET /ws` - WebSocket connection for real-time gameplay (uWebSockets.js on port 5556)

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
PORT=5555                    # HTTP server port
UWS_PORT=5556                # WebSocket server port (uWebSockets.js)
WORLD=world                  # World directory path
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
```

### WebSocket

```env
UWS_ENABLED=true                      # Enable uWebSockets.js (default: true)
UWS_PORT=5556                         # WebSocket port (default: 5556)
PUBLIC_WS_URL=ws://localhost:5556/ws  # Client WebSocket URL
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for static assets
```

### Authentication (Optional)

```env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
ADMIN_CODE=your-admin-code          # For /admin command
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

### Agent AI Configuration

```env
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000  # Agent tick interval (ms)
AGENT_STAGGER_OFFSET_MS=800           # Stagger offset (ms)
MAX_AGENTS_PER_POLL=5                 # Max agents per poll cycle
```

### Pathfinding Configuration

```env
MAX_BFS_ITERATIONS_PER_TICK=12000     # Global BFS budget per tick
DEFAULT_MAX_ITERATIONS=4000           # Per-call BFS limit
```

### Terrain System Configuration

```env
SERVER_COLLISION_RESOLUTION=16        # Collision mesh resolution
COLLISION_BUDGET_MS=8                 # Collision queue budget (ms)
WALKABILITY_BUDGET_MS=4               # Walkability baking budget (ms)
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
docker run -p 5555:5555 -p 5556:5556 \
  -e DATABASE_URL=postgresql://... \
  hyperscape-server
```

### Traditional Hosting

Requirements:
- Node.js 22+ (required for server runtime)
- Bun 1.3.10+ (for build tasks)
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

### WebSocket Connection Issues

**Error:** Client can't connect to WebSocket

**Solutions:**
1. Verify `UWS_PORT=5556` in server `.env`
2. Verify `PUBLIC_WS_URL=ws://localhost:5556/ws` in client `.env`
3. Check firewall allows port 5556
4. Ensure uWebSockets.js is enabled: `UWS_ENABLED=true`

### Player Death Issues

**Symptoms**: Player stuck in death animation, never respawns, or equipment duplicates

**Diagnosis**:
1. Check server logs for `DEATH_PERSIST_DESYNC` tag (DB persist failures)
2. Check for `AUDIT_LOG` events (reconnect with active death lock)
3. Verify death lock is cleared: `SELECT * FROM death_locks WHERE player_id = ?`

**Recovery**:
```sql
-- Clear stuck death lock (use player's character ID)
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: Death system has robust retry logic and crash recovery (PR #1094, March 26, 2026).

### Tick Performance Issues

**Symptoms**: Missed ticks, laggy gameplay, high event loop blocking

**Diagnosis**:
1. Check server logs for tick timing diagnostics
2. Monitor event loop lag: `GET /status` endpoint shows tick health
3. Check agent count (reduce if >25 concurrent agents)

**Solutions**:
1. Ensure Node.js 22+ is being used (not Bun for server runtime)
2. Verify uWebSockets.js is enabled (`UWS_ENABLED=true`)
3. Reduce `MAX_BFS_ITERATIONS_PER_TICK` if pathfinding is bottleneck
4. Increase `COLLISION_BUDGET_MS` if terrain processing is slow
5. Check agent worker thread is running (logs should show `[AgentWorker]` messages)

## Development

### Code Structure

```
src/
├── index.ts                      # Main server entry point
├── main.ts                       # Server initialization
├── systems/
│   ├── ServerNetwork/            # Network layer & player lifecycle
│   │   ├── index.ts              # Main network system
│   │   ├── tile-movement.ts      # Tile-based movement
│   │   ├── mob-tile-movement.ts  # Mob movement
│   │   └── handlers/             # Packet handlers
│   ├── DatabaseSystem/           # Database operations
│   ├── TickSystem.ts             # 600ms game tick system
│   ├── DuelSystem/               # Duel arena mechanics
│   └── StreamingDuelScheduler/   # Streaming duel orchestration
├── database/
│   ├── client.ts                 # PostgreSQL connection
│   ├── schema.ts                 # Drizzle schema definitions
│   ├── repositories/             # Data access layer
│   └── migrations/               # Database migrations
├── eliza/                        # ElizaOS AI agent integration
│   ├── AgentManager.ts           # Agent lifecycle
│   ├── EmbeddedHyperscapeService.ts  # Agent game interface
│   └── worker/                   # Worker thread for AI
├── streaming/                    # Streaming infrastructure
│   ├── browser-capture.ts        # Playwright capture
│   ├── rtmp-bridge.ts            # FFmpeg RTMP streaming
│   └── stream-destinations.ts    # Multi-platform streaming
└── startup/                      # Server initialization
    ├── config.ts                 # Environment configuration
    ├── database.ts               # Database initialization
    ├── http-server.ts            # Fastify HTTP server
    ├── uws-server.ts             # uWebSockets.js server
    └── world.ts                  # World initialization
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

- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 5s

Adjust in `src/database/client.ts` if needed.

### Asset Caching

Assets are served with aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

For development, disable browser cache or use incognito mode.

### Tick Performance Targets

- **Tick Duration**: 600ms (OSRS-accurate)
- **Tick Processing**: <200ms (target: 110-200ms)
- **Event Loop Blocking**: <3% (down from 62.5% pre-optimization)
- **Missed Ticks**: 0 under normal load (50 players + 25 agents)

### Scalability Limits

- **Players**: 50+ concurrent (tested)
- **AI Agents**: 25+ concurrent (tested)
- **Mobs**: 100+ active (tested)
- **Resources**: 500+ trees/rocks (tested)

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

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Rate Limiting

Implemented rate limiting:
- Connection rate limiting (WebSocket)
- Action rate limiting (combat, gathering, etc.)
- Upload size limits (50MB)

## Recent Changes

### April 2026

- **Docker Build Fixes**: Added defensive `mkdir -p` for workspace node_modules to prevent COPY failures
- **CI/CD Upgrades**: Migrated to Node.js 24 GitHub Actions runners
- **Production Defaults**: Server defaults to hyperscape.gg for production runtime
- **Tailwind v3 Rollback**: Restored stable Tailwind v3 pipeline after v4 production issues

### March 2026

- **Server Runtime Migration**: Bun → Node.js 22+ for V8 incremental GC (PR #1064)
- **uWebSockets.js Integration**: Native pub/sub on port 5556 (PR #1064)
- **Agent AI Worker Thread**: Off-thread decision logic (PR #1064)
- **Tick System Overhaul**: Drift correction, health monitoring (PR #1064)
- **Resource Respawn**: Tick-based respawn, manifest depleteChance (PR #1099)
- **Death System Rewrite**: Two-phase persist, OSRS keep-3, gravestone privacy (PR #1094)
- **Prayer Sync Fix**: Fixed prayer state synchronization on login (PR #1090)
- **Packet Handlers**: Added 8 missing server→client handlers (PR #1091)

See [CLAUDE.md](../../CLAUDE.md) for complete changelog.

## Support

- **Documentation:** See [CLAUDE.md](../../CLAUDE.md) for detailed development guidelines
- **Performance:** See `docs/performance-march-2026.md` for optimization details
- **Issues:** Report bugs in the main Hyperscape repository

## License

MIT
