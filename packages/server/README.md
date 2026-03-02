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
- **Object Pooling** - Zero-allocation event emission for combat and movement
- **Memory Management** - Comprehensive leak fixes and resource cleanup

## Quick Start

### Prerequisites

- **Bun** (recommended) or Node.js 22+
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

# Connection pool configuration (production)
POSTGRES_POOL_MAX=3          # Max connections (prevents exhaustion during crash loops)
POSTGRES_POOL_MIN=0          # Min connections (doesn't hold idle connections)
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

### Streaming (Vast.ai Deployment)

```env
# Stream capture configuration
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable  # Explicit Chrome path
STREAM_CAPTURE_MODE=cdp                                     # cdp | webcodecs | mediarecorder
STREAM_LOW_LATENCY=false                                    # true = zerolatency tune
STREAM_GOP_SIZE=60                                          # GOP size in frames
STREAM_AUDIO_ENABLED=true                                   # Enable audio capture
PULSE_AUDIO_DEVICE=chrome_audio.monitor                     # PulseAudio device

# Production client build (recommended for streaming)
NODE_ENV=production                                         # Use production build
DUEL_USE_PRODUCTION_CLIENT=true                             # Serve via vite preview

# Model agent spawning (for empty database)
SPAWN_MODEL_AGENTS=true                                     # Auto-create agents when DB is empty

# RTMP streaming keys (never hardcode)
TWITCH_STREAM_KEY=...
KICK_STREAM_KEY=...
TWITTER_STREAM_KEY=...
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

### Vast.ai GPU Streaming

For WebGPU streaming deployment on Vast.ai:

**Requirements**:
- NVIDIA GPU with display driver support (`gpu_display_active=true`)
- Vast.ai CLI: `pip install vastai`
- API key configured: `vastai set api-key YOUR_API_KEY`

**Provision Instance**:
```bash
./scripts/vast-provision.sh
```

This automatically:
- Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr), disk space (≥120GB)
- Rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands

**Deploy to Instance**:
```bash
# Trigger GitHub Actions workflow
gh workflow run deploy-vast.yml
```

**Check Streaming Status**:
```bash
bun run duel:status
```

See [AGENTS.md](../../AGENTS.md) for complete Vast.ai deployment architecture.

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

## Performance Optimizations

### Object Pooling for Zero-Allocation Event Emission

The server implements comprehensive object pooling to eliminate GC pressure in high-frequency event loops.

**Combat Event Pools** (`packages/shared/src/utils/pools/`):
- **EventPayloadPool.ts**: Factory for creating type-safe event payload pools
- **PositionPool.ts**: Pool for `{x, y, z}` position objects
- **CombatEventPools.ts**: Pre-configured pools for all combat events

**Performance Impact**:
- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor

**Available Pools**:
- `CombatEventPools.damageDealt`, `projectileLaunched`, `faceTarget`, `clearFaceTarget`
- `CombatEventPools.attackFailed`, `followTarget`, `combatStarted`, `combatEnded`
- `CombatEventPools.projectileHit`, `combatKill`
- `positionPool` - Global position pool for `{x, y, z}` objects

**Usage Pattern**:
```typescript
// Acquire from pool
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// MUST release in listener
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process...
  CombatEventPools.damageDealt.release(payload);
});
```

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

### Memory Management

**Recent Fixes** (20+ critical memory leaks addressed):
- **ModelCache** (CRITICAL): Geometry disposal on clear() and remove()
- **EventBridge** (HIGH): Cleanup 50+ world event listeners
- **GameTickProcessor** (HIGH): Store bound event handlers, cleanup in destroy()
- **TradingSystem** (HIGH): Store bound handlers for player lifecycle events
- **AgentManager** (HIGH): Store and cleanup COMBAT_DAMAGE_DEALT listener
- **AutonomousBehaviorManager** (HIGH): Store and cleanup event handlers
- **RTMPBridge** (HIGH): Call removeAllListeners() before closing WebSocket servers
- **ActionQueue** (MEDIUM): Add destroy() method to clear playerQueues
- **ScriptQueue** (MEDIUM): Add destroy() methods to both queue classes
- **Shutdown Process** (HIGH): Call destroyAllRateLimiters() and destroyIdempotencyService()

**Best Practices**:
1. Track all resources (intervals, listeners, handlers)
2. Implement cleanup methods (destroy(), shutdown(), stop())
3. Follow SystemBase pattern for resource cleanup
4. Use object pools for high-frequency allocations

See [AGENTS.md](../../AGENTS.md) for complete memory management documentation.

### Database Connection Pool

**Production Configuration** (optimized for crash loop resilience):
- **Max connections**: 3 (down from 6) - prevents connection exhaustion during crash loops
- **Min connections**: 0 - doesn't hold idle connections during crashes
- **Idle timeout**: 30s
- **Connection timeout**: 5s
- **PM2 restart delay**: 10s (up from 5s) - allows connections to fully close before restart
- **PM2 exp backoff**: 2s - more gradual backoff on repeated failures

This configuration prevents PostgreSQL error 53300 (too many connections) during crash loop scenarios.

**Development Configuration**:
- Max connections: 20
- Adjust in `src/db.ts` and `src/DatabaseSystem.ts` if needed
