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
- CDN manifest fetching for production deployments
- Railway deployment with Nixpacks and Docker support

See `FIXES-COMPLETE.md` for detailed migration changelog.

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery with CDN support
- **Manifest Fetching** - Automatic download of game data from CDN at startup
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration
- **Railway Deployment** - Production-ready deployment with auto-scaling

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

**CDN Configuration:**
```env
# Development: Local CDN server
PUBLIC_CDN_URL=http://localhost:8080

# Production: Cloudflare R2 or other CDN
PUBLIC_CDN_URL=https://assets.hyperscape.club
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
- PostgreSQL (Docker on port 5432)

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

## Manifest System

### Overview

Game data (NPCs, items, skills, etc.) is defined in JSON manifest files. The server loads these manifests at startup to configure the game world.

### Development Mode

**Local manifests** are used when available:
- Located at `packages/server/world/assets/manifests/`
- Auto-downloaded during `bun install` via Git LFS
- Updated with `bun run assets:sync`

### Production Mode

**CDN manifests** are fetched at server startup:
1. Server calls `fetchManifestsFromCDN()` on boot
2. Downloads all JSON files from `{PUBLIC_CDN_URL}/manifests/`
3. Caches locally in `world/assets/manifests/`
4. Compares with existing files to avoid unnecessary updates
5. Skips download if local manifests exist (development mode)

**Manifest Files:**
- **Root**: `biomes.json`, `npcs.json`, `prayers.json`, `skill-unlocks.json`, `stores.json`, etc.
- **Items**: `items/food.json`, `items/weapons.json`, `items/tools.json`, etc.
- **Gathering**: `gathering/fishing.json`, `gathering/mining.json`, `gathering/woodcutting.json`
- **Recipes**: `recipes/cooking.json`, `recipes/smithing.json`, `recipes/smelting.json`, `recipes/firemaking.json`

**Environment Variables:**
```env
# CDN URL for manifest fetching
PUBLIC_CDN_URL=https://assets.hyperscape.club

# Skip manifest fetch (testing only)
SKIP_MANIFESTS=true
```

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
cd packages/server
bunx drizzle-kit push      # Push schema changes
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

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**Database Layer** (`src/database/`)
- Connection pooling (pg)
- Drizzle ORM schema
- Repository pattern for data access

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

### Game Data

- `GET /api/data/skill-unlocks` - Get skill unlock definitions (server-authoritative)

### Assets

- `GET /*` - Game assets (models, textures, audio)
- `GET /assets/*` - Legacy asset path (backward compatible)
- `GET /manifests/*` - JSON manifest files (cached from CDN)

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
- `GET /debug/public` - Debug endpoint showing public directory contents

## Environment Variables

### Required

```env
PORT=5555                    # Server port
WORLD=world                  # World directory path
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

### Assets & CDN

```env
PUBLIC_CDN_URL=http://localhost:8080    # CDN URL for assets and manifests
PUBLIC_WS_URL=ws://localhost:5555/ws    # WebSocket URL
PUBLIC_API_URL=http://localhost:5555    # API base URL
```

### Authentication (Optional)

```env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
ADMIN_CODE=your-admin-code          # For /admin command
JWT_SECRET=your-jwt-secret          # For token signing
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

## Production Deployment

### Railway Deployment

Hyperscape server deploys to Railway using Nixpacks for automatic builds.

**Build Process:**
1. Install system dependencies (Python, Cairo, Pango for native modules)
2. Run `bun install`
3. Build `shared` package
4. Build `server` package
5. Fetch manifests from CDN at startup
6. Start server with `bun dist/index.js`

**Configuration Files:**
- `nixpacks.toml` - Railway build configuration
- `Dockerfile.server` - Alternative Docker build (multi-stage)
- `.github/workflows/deploy-railway.yml` - Auto-deployment on push to main
- `railway.server.json` - Railway service configuration

**Environment Variables** (set in Railway dashboard):
```env
NODE_ENV=production
DATABASE_URL=postgresql://...           # Neon PostgreSQL
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
JWT_SECRET=...
ADMIN_CODE=...
```

**Deployment Workflow:**
1. Push to `main` branch
2. GitHub Actions triggers Railway deployment
3. Railway builds using Nixpacks
4. Server starts and fetches manifests from CDN
5. Health check confirms deployment success

### Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -f Dockerfile.server -t hyperscape-server .

# Run container
docker run -p 5555:5555 \
  -e DATABASE_URL=postgresql://... \
  -e PUBLIC_CDN_URL=https://assets.hyperscape.club \
  -e PUBLIC_PRIVY_APP_ID=... \
  -e PRIVY_APP_SECRET=... \
  hyperscape-server
```

**Multi-stage build:**
- Stage 1: Builder - Installs dependencies and builds packages
- Stage 2: Runtime - Minimal production image with only runtime dependencies

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

Should be at version 15 or higher. If not, restart server to run migrations.

### Manifests Not Loading

**Error:** Failed to fetch manifests from CDN

**Solutions:**
1. Check that `PUBLIC_CDN_URL` is set correctly
2. Verify CDN is accessible: `curl {PUBLIC_CDN_URL}/manifests/npcs.json`
3. Check server startup logs for fetch errors
4. In development, ensure local manifests exist at `world/assets/manifests/`
5. For testing, set `SKIP_MANIFESTS=true` to bypass manifest requirement

### Frontend Not Found

**Error:** 503 Frontend not available

**Solutions:**
1. Build the client: `cd packages/client && bun run build`
2. Copy client build to server: `cp -r packages/client/dist/* packages/server/public/`
3. Verify `public/index.html` exists
4. Check server logs for public directory path

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

### CORS Errors

**Error:** CORS policy blocked request

**Solutions:**
1. Verify client domain is in CORS allowlist (see `src/startup/http-server.ts`)
2. Check that `PUBLIC_PRIVY_APP_ID` matches between client and server
3. Ensure WebSocket URL uses correct protocol (ws:// or wss://)
4. For Cloudflare Pages, ensure domain is in allowlist:
   - `https://hyperscape.club`
   - `https://www.hyperscape.club`
   - `https://hyperscape.pages.dev`
   - `https://*.hyperscape.pages.dev` (preview deployments)

## Development

### Code Structure

```
src/
├── index.ts                    # Main server entry point
├── startup/
│   ├── config.ts              # Environment and path resolution
│   ├── http-server.ts         # Fastify setup and static serving
│   ├── database.ts            # Database initialization
│   ├── world.ts               # World initialization
│   ├── websocket.ts           # WebSocket setup
│   ├── api-routes.ts          # API route registration
│   └── routes/                # Individual route modules
├── systems/
│   ├── ServerNetwork/         # Network layer & player lifecycle
│   ├── DatabaseSystem/        # Database operations
│   └── GameTickProcessor.ts   # Game loop
├── database/
│   ├── client.ts              # PostgreSQL connection
│   ├── schema.ts              # Drizzle schema definitions
│   ├── repositories/          # Data access layer
│   └── migrations/            # SQL migration files
├── infrastructure/
│   ├── auth/                  # Privy authentication
│   ├── docker/                # Docker management
│   └── rate-limit/            # Rate limiting config
└── eliza/                     # ElizaOS integration
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

Manifests use shorter cache times:
```
Cache-Control: public, max-age=300, must-revalidate
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

Configured in `src/infrastructure/rate-limit/rate-limit-config.ts`:
- Global: 100 requests/min per IP
- Disabled in development by default
- Enable with `DISABLE_RATE_LIMIT=false`

## Deployment

### Railway (Recommended)

**Automatic Deployment:**
1. Push to `main` branch
2. GitHub Actions triggers Railway deployment
3. Railway builds using Nixpacks
4. Server starts and fetches manifests from CDN
5. Health check confirms deployment

**Manual Deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

**Environment Variables** (set in Railway dashboard):
```env
NODE_ENV=production
DATABASE_URL=postgresql://...           # Neon PostgreSQL
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
JWT_SECRET=...
ADMIN_CODE=...
```

### Docker

**Build:**
```bash
docker build -f Dockerfile.server -t hyperscape-server .
```

**Run:**
```bash
docker run -p 5555:5555 \
  -e DATABASE_URL=postgresql://... \
  -e PUBLIC_CDN_URL=https://assets.hyperscape.club \
  -e PUBLIC_PRIVY_APP_ID=... \
  -e PRIVY_APP_SECRET=... \
  hyperscape-server
```

### Traditional Hosting

**Build and run:**
```bash
bun run build
NODE_ENV=production bun run start
```

**With PM2:**
```bash
pm2 start dist/index.js --name hyperscape-server
```

## API Reference

### New Endpoints

**GET /api/data/skill-unlocks**
- Returns skill unlock definitions for all skills
- Used by client Skill Guide Panel
- Server-authoritative data (not bundled in client)
- Response: `Record<string, SkillUnlock[]>`

**GET /debug/public**
- Debug endpoint showing public directory contents
- Lists files in `public/` and `public/assets/`
- Useful for troubleshooting deployment issues

### Existing Endpoints

See main documentation for complete API reference.

## Support

- **Documentation:** See `MIGRATION-FIXES.md` for recent changes
- **Deployment Guide:** See `CLAUDE.md` for Railway deployment details
- **Issues:** Report bugs in the main Hyperscape repository

## License

MIT - See LICENSE file
