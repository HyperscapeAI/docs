# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- PostgreSQL database with automatic migrations
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket
- 17 skills with full persistence (Attack, Strength, Defence, Constitution, Ranged, Magic, Prayer, Woodcutting, Mining, Fishing, Cooking, Firemaking, Smithing, Agility, Crafting, Fletching, Runecrafting)
- 15+ registered game actions

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **Artisan Skills** - Crafting, Fletching, Runecrafting with recipe manifests
- **Equipment System** - 11-slot equipment with arrow quantity tracking

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
DATABASE_URL=postgresql://user:pass@host:5432/dbname
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

Migrations are managed by Drizzle ORM in `src/database/migrations/`. Run from `packages/server/`:

```bash
bunx drizzle-kit generate  # Create migration from schema changes
bunx drizzle-kit migrate   # Apply pending migrations
bunx drizzle-kit push      # Push schema directly (dev only)
```

**Recent migrations:**
- 0029: Add crafting skill columns
- 0030: Add fletching skill columns
- 0031: Add runecrafting skill columns

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**Database Layer** (`src/database/`)
- Connection pooling (pg)
- Migration runner (Drizzle)
- Repository pattern for data access
- Schema definitions

### Character System

The server supports multiple characters per account:

1. **Account** - Identified by Privy user ID or legacy user ID
2. **Character** - Each account can have multiple characters
3. **Player Session** - Character becomes "player" when spawned in world

**Flow:**
```
Login → Character List → Select/Create Character → Enter World → Spawn as Player
```

### Artisan Skills

The server implements three artisan skills with manifest-driven recipes:

**Crafting System:**
- Leather crafting (needle + thread)
- Dragonhide armor (needle + thread)
- Jewelry crafting (furnace + moulds)
- Gem cutting (chisel)
- Tanning (instant hide-to-leather conversion)

**Fletching System:**
- Arrow shafts (knife + logs, 15 per action)
- Headless arrows (shafts + feathers, 15 per action)
- Arrows (arrowtips + headless arrows, 15 per action)
- Bows (knife + logs, then string with bowstring)

**Runecrafting System:**
- Instant essence-to-rune conversion at altars
- Multi-rune multipliers at higher levels
- Two essence types (rune_essence, pure_essence)

All recipes are defined in JSON manifests at `world/assets/manifests/recipes/`.

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
POSTGRES_PASSWORD=hyperscape_dev
POSTGRES_DB=hyperscape
POSTGRES_PORT=5432

# Option 2: External PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/dbname
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

Should be at version 31 or higher (includes crafting, fletching, runecrafting). If not, restart server to run migrations.

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
├── systems/
│   ├── ServerNetwork/    # Network layer & player lifecycle
│   ├── DatabaseSystem/   # Database operations
│   └── DuelSystem/       # Duel arena implementation
├── database/
│   ├── client.ts         # PostgreSQL connection
│   ├── migrations/       # Drizzle migrations
│   ├── repositories/     # Data access layer
│   └── schema.ts         # Database schema
├── startup/
│   ├── config.ts         # Server configuration
│   ├── database.ts       # Database initialization
│   ├── http-server.ts    # HTTP server setup
│   ├── websocket.ts      # WebSocket setup
│   └── world.ts          # World initialization
├── infrastructure/
│   ├── auth/             # Privy authentication
│   ├── docker/           # Docker management
│   └── rate-limit/       # Rate limiting
└── eliza/                # ElizaOS agent integration
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

Implemented for critical operations:
- Crafting interact: 1 request per 500ms
- Combat actions: 1 request per tick (600ms)
- Movement: Anti-cheat validation

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Cloudflare Deployment:** See `CLOUDFLARE.md` (currently disabled)
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
