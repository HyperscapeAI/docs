# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- PostgreSQL database with automatic migrations
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via uWebSockets.js (port 5556)
- 15 registered game actions

## Recent Changes (March 2026)

### Server Runtime Migration (March 19-20, 2026)

**Breaking Change**: Server now requires **Node.js 22+** (migrated from Bun).

**Why**: V8 incremental GC eliminates 500-1200ms stop-the-world pauses that were blocking game ticks. Bun's GC caused 3-5 missed ticks per minute under load.

**Impact**:
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%
- Scalability: 20 players + 10 agents → 50+ players + 25+ agents

**Migration**:
```bash
# Install Node.js 22+
nvm install 22
nvm use 22

# Server now runs with Node.js
node dist/index.js
```

### uWebSockets.js Integration (March 19-20, 2026)

**Breaking Change**: WebSocket port changed from **5555 → 5556**.

**Why**: Native pub/sub broadcasting eliminates O(n) socket iteration. Fastify WebSocket required iterating all sockets for each broadcast.

**Configuration**:
```bash
# Server (packages/server/.env)
UWS_ENABLED=true          # Enable uWS (default: true)
UWS_PORT=5556             # uWS port (default: 5556)

# Client (packages/client/.env)
PUBLIC_WS_URL=ws://localhost:5556/ws  # Update from 5555 to 5556
```

**Impact**:
- Broadcast performance: O(n) → O(1) with native pub/sub
- Eliminates socket iteration overhead
- Better scalability for 50+ concurrent players

### Player Death System Overhaul (March 26, 2026)

**Change**: Complete rewrite of player death pipeline to fix SQLite deadlock, equipment duplication, and implement OSRS-style "keep 3 most valuable items" for safe zone deaths.

**Key Features**:
- Two-phase persist pattern (in-memory clear inside tx, DB persist after)
- OSRS keep-3 system (safe zone deaths keep 3 most valuable items)
- Death lock recovery (persist kept items for crash recovery)
- Persist retry queue (single-retry for post-tx DB failures)
- Gravestone privacy (loot items hidden from broadcast)

**New Database Table**:
```sql
CREATE TABLE death_locks (
  player_id TEXT PRIMARY KEY,
  death_position_x REAL NOT NULL,
  death_position_y REAL NOT NULL,
  death_position_z REAL NOT NULL,
  kept_items TEXT NOT NULL,  -- JSON array of InventoryItem
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

**Breaking Changes**:
- `PLAYER_DIED` event deprecated → use `PLAYER_SET_DEAD`
- Death lock schema includes `keptItems` field

**Documentation**: See `docs/death-system-architecture.md` for complete details.

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **uWebSockets.js** - High-performance WebSocket transport (port 5556)
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **Agent AI Worker** - Off-thread AI decision processing

## Quick Start

### Prerequisites

- **Node.js 22+** (required for server runtime)
- **Bun 1.3.10+** (for build tasks)
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance

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

**WebSocket Configuration**:
```env
UWS_ENABLED=true          # Enable uWebSockets.js (default: true)
UWS_PORT=5556             # WebSocket port (default: 5556)
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
node dist/index.js  # Use Node.js 22+, not Bun
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
3. Tables are created: users, characters, players, inventory, equipment, death_locks, etc.

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

**Current migrations**: 51 migrations (see `src/database/migrations/`)

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/index.ts`)
- WebSocket connection handling (uWebSockets.js on port 5556)
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting
- Tick system integration

**DatabaseSystem** (`src/systems/DatabaseSystem/index.ts`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**PlayerDeathSystem** (`packages/shared/src/systems/shared/combat/PlayerDeathSystem.ts`)
- Death processing with two-phase persist
- OSRS keep-3 system for safe zone deaths
- Death lock management
- Gravestone creation and loot handling
- Persist retry queue

**TickSystem** (`src/systems/TickSystem.ts`)
- 600ms tick loop (OSRS-accurate)
- Drift correction
- Health monitoring
- Per-handler timing

### Character System

The server supports multiple characters per account:

1. **Account** - Identified by Privy user ID or legacy user ID
2. **Character** - Each account can have multiple characters
3. **Player Session** - Character becomes \"player\" when spawned in world

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

- `GET /ws` - WebSocket connection for real-time gameplay (port 5556)

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
UWS_PORT=5556                # WebSocket server port
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

### WebSocket Transport

```env
UWS_ENABLED=true             # Enable uWebSockets.js (default: true)
UWS_PORT=5556                # WebSocket port (default: 5556)
```

### Agent AI Worker

```env
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000  # Agent tick interval (ms)
AGENT_STAGGER_OFFSET_MS=800           # Stagger offset (ms)
MAX_AGENTS_PER_POLL=5                 # Max agents per poll cycle
```

### BFS Pathfinding

```env
MAX_BFS_ITERATIONS_PER_TICK=12000     # Global budget
DEFAULT_MAX_ITERATIONS=4000           # Per-call limit
```

### Terrain System

```env
SERVER_COLLISION_RESOLUTION=16        # Collision mesh resolution
COLLISION_BUDGET_MS=8                 # Collision queue budget (ms)
WALKABILITY_BUDGET_MS=4               # Walkability baking budget (ms)
```

### Assets

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for static assets
PUBLIC_WS_URL=ws://localhost:5556/ws    # WebSocket URL (port 5556)
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

**Note**: Expose both port 5555 (HTTP) and 5556 (WebSocket).

### Traditional Hosting

Requirements:
- Node.js 22+ (required for server runtime)
- PostgreSQL 16+ (local or managed)
- Reverse proxy (nginx, caddy) for SSL

```bash
# Build
bun run build

# Run with Node.js (not Bun)
node dist/index.js

# Or use process manager
pm2 start dist/index.js --name hyperscape-server
```

### Environment-Specific

**Staging:**
```bash
NODE_ENV=staging node dist/index.js
```

**Production:**
```bash
NODE_ENV=production node dist/index.js
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

Should be at migration 51 or higher. If not, restart server to run migrations.

### Player Death Issues

**Symptoms**: Player stuck in death animation, never respawns.

**Diagnosis**:
1. Check server logs for `DEATH_PERSIST_DESYNC` tag
2. Check for `AUDIT_LOG` events
3. Query death locks: `SELECT * FROM death_locks WHERE player_id = ?`

**Recovery**:
```sql
-- Clear stuck death lock
DELETE FROM death_locks WHERE player_id = 'player_<id>';
```

**Prevention**: Update to latest version (March 26, 2026+). Death system now has robust retry logic and crash recovery.

### WebSocket Connection Issues

**Error:** Client can't connect to WebSocket

**Solutions:**
1. Verify `UWS_PORT=5556` in server `.env`
2. Verify `PUBLIC_WS_URL=ws://localhost:5556/ws` in client `.env`
3. Check firewall allows port 5556
4. Check server logs for uWS startup errors

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

## Development

### Code Structure

```
src/
├── index.ts              # Main server entry point
├── main.ts               # Server initialization
├── startup/              # Startup modules
│   ├── http-server.ts    # Fastify HTTP server (port 5555)
│   ├── uws-server.ts     # uWebSockets.js server (port 5556)
│   ├── database.ts       # Database initialization
│   └── world.ts          # World initialization
├── systems/              # Game systems
│   ├── ServerNetwork/    # Network layer & player lifecycle
│   ├── DatabaseSystem/   # Database operations
│   ├── TickSystem.ts     # 600ms tick loop
│   └── PlayerDeathSystem.ts  # Death processing (in shared)
├── database/             # Database layer
│   ├── client.ts         # PostgreSQL client
│   ├── schema.ts         # Drizzle schema
│   ├── migrations/       # Migration files
│   └── repositories/     # Data access layer
├── eliza/                # ElizaOS agent integration
│   ├── AgentManager.ts   # Agent lifecycle
│   └── worker/           # Agent AI worker thread
└── streaming/            # Streaming & RTMP
    ├── stream-capture.ts # Browser capture
    └── rtmp-bridge.ts    # RTMP streaming
```

### Running Tests

```bash
npm test
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

### Tick System

- Tick rate: 600ms (OSRS-accurate)
- Drift correction: Enabled
- Health monitoring: Logs missed ticks
- Per-handler timing: Tracks slow handlers

### Agent AI Worker

- Runs off main thread (eliminates 200-600ms blocking)
- Tick interval: 8000ms (configurable)
- Stagger offset: 800ms (prevents thundering herd)
- Max agents per poll: 5 (configurable)

### BFS Pathfinding

- Global iteration budget: 12,000 per tick
- Per-call limit: 4,000 iterations
- Zero-allocation scratch tiles
- Per-tick walkability cache

### Terrain System

- Collision resolution: 16×16 (low-res for performance)
- Collision budget: 8ms per tick
- Walkability budget: 4ms per tick
- Pre-baked walkability flags

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

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Rate Limiting

Not implemented yet. Consider adding:
- Connection rate limiting (websocket)
- API endpoint rate limiting
- Upload size limits (currently 50MB)

### Death System Security

- Server-only processing (client attempts logged)
- Input sanitization (`sanitizeKilledBy()` prevents XSS/injection)
- Position validation (prevents NaN/Infinity exploits)
- Duel guard (prevents respawn during active duel)
- Gravestone privacy (loot items hidden from broadcast)

## Support

- **Documentation:** See `docs/` for detailed guides
  - `docs/death-system-architecture.md` - Death system documentation
  - `docs/performance-march-2026.md` - Performance overhaul details
  - `docs/migrations/player-died-event-migration.md` - Event migration guide
- **Issues:** Report bugs in the main Hyperscape repository
- **CLAUDE.md:** Development guidelines and recent changes

## License

MIT - See LICENSE file
