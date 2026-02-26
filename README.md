# Hyperscape

**The first AI-native MMORPG where autonomous agents play alongside humans.**

Hyperscape is a RuneScape-inspired MMORPG built on a heavily modified and custom version of [Hyperfy](https://hyperfy.io), an open-source 3D multiplayer engine. The game integrates [ElizaOS](https://elizaos.ai) to enable AI agents to play autonomously in a persistent world. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## What Makes Hyperscape Unique

- **AI Agents as Players**: Autonomous agents powered by ElizaOS that fight, skill, trade, and make decisions using LLMs
- **True OSRS Mechanics**: Authentic tick-based combat (600ms ticks), safespotting, tile-based movement, and classic progression systems
- **Manifest-Driven Design**: Add NPCs, items, and content by editing JSON files—no code changes required
- **Spectator Mode**: Watch agents play in real-time and observe their decision-making process
- **Open Source**: Built on open technology with extensible architecture

## Core Features

| Category | Features |
|----------|----------|
| **Combat** | Tick-based OSRS mechanics (600ms ticks), attack styles, accuracy formulas, death/respawn system |
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
| **Economy** | 480-slot bank, shops, item weights, loot drops |
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics, **WebGPU rendering** |

## System Requirements

**Browser Requirements:**
- **WebGPU support required** - Chrome 113+, Edge 113+, or Safari 18+ (macOS Sonoma+)
- Check compatibility: [webgpureport.org](https://webgpureport.org)
- WebGL fallback removed as of February 2026 (all shaders use TSL which requires WebGPU)

**Development Prerequisites:**
- [Bun](https://bun.sh) (v1.1.38+)
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

## Quick Start

```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### Setup Environment Files

```bash
# Required: Copy both client and server env files
cp packages/client/.env.example packages/client/.env
cp packages/server/.env.example packages/server/.env
```

**Configure Privy Authentication** (required):

1. Create a free account at [Privy Dashboard](https://dashboard.privy.io)
2. Create an app and copy your **App ID** and **App Secret**
3. Set in `packages/client/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   ```
4. Set in `packages/server/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   PRIVY_APP_SECRET=your-app-secret
   JWT_SECRET=your-secure-random-string
   ```

> **⚠️ Without Privy credentials**, the game runs in anonymous mode where users get a new identity on every page refresh. Characters will appear to vanish because they're tied to the old anonymous account.

**Production Security Requirements:**
- **JWT_SECRET** is now **required** in production/staging environments (throws error if not set)
- Generate with: `openssl rand -base64 32`
- **ADMIN_CODE** should be set to prevent unauthorized admin access

**Optional configs:**
```bash
# AI agents (only if using bun run dev:ai)
cp packages/plugin-hyperscape/.env.example packages/plugin-hyperscape/.env

# Asset generation tools (only if using bun run dev:forge)
cp packages/asset-forge/.env.example packages/asset-forge/.env
# Edit and set OPENAI_API_KEY, MESHY_API_KEY
```

### Run the Game

1. **Start Docker** - Open Docker Desktop (macOS/Windows) or start the daemon (`sudo systemctl start docker` on Linux)

2. **Build the project** (required first time):
   ```bash
   bun run build
   ```

3. **Start the CDN** (serves game assets):
   ```bash
   bun run cdn:up
   ```

4. **Start the game**:
   ```bash
   bun run dev          # Game only (client + server)
   # OR
   bun run dev:ai       # Game + AI agents (ElizaOS)
   ```

5. Open **http://localhost:3333** in your browser.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation (trees, rocks, terrain)
├── asset-forge/         # AI asset generation tools
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `procgen` → `shared` → everything else (handled automatically by Turbo)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run build` | Build all packages |
| `bun start` | Start production server |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |

### What `bun run dev` starts

| Service | Port | Description |
|---------|------|-------------|
| Client | 3333 | Vite dev server with hot reload |
| Server | 5555 | Game server (Fastify + WebSockets) |
| CDN | 8080 | Asset server (Docker nginx) |
| PostgreSQL | 5432 | Database (Docker) |

### Run specific services

```bash
bun run dev:client    # Client only (port 3333)
bun run dev:server    # Server only (port 5555)
bun run dev:ai        # Game + ElizaOS agents (adds port 4001)
bun run dev:forge     # AssetForge tools (ports 3400, 3401)
bun run docs:dev      # Documentation site (port 3402)
bun run dev:all       # Everything: game + AI + AssetForge
```

### Docker services

```bash
bun run cdn:up        # Start CDN container (needed for bun start)
bun run cdn:down      # Stop CDN container
```

### Database (Drizzle)

Run from `packages/server/`:

```bash
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

### Assets

Game assets (3D models, textures, audio) source: [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets)

**Local Development**: Assets are auto-downloaded during `bun install` (~200MB via Git LFS).

```bash
bun run assets:sync    # Pull latest assets from repo (local dev only)
```

**Production/CI**: Manifests are committed to the repo at `packages/server/world/assets/manifests/`.

## Configuration

**Required for local development:**
- `packages/client/.env` - Set `PUBLIC_PRIVY_APP_ID`
- `packages/server/.env` - Set `PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `JWT_SECRET`

Both must use the same Privy App ID from [Privy Dashboard](https://dashboard.privy.io).

**Optional configuration** - see `.env.example` files for all options:
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, streaming
- `packages/client/.env.example` - API URLs, Farcaster integration
- `packages/asset-forge/.env.example` - AI API keys (OpenAI, Meshy)
- `packages/plugin-hyperscape/.env.example` - ElizaOS agent config

### Default Ports

| Port | Service | Started By |
|------|---------|------------|
| 5555 | Game Server | `bun run dev` |
| 3333 | Client | `bun run dev` |
| 8080 | Asset CDN | `bun run dev` |
| 3400 | AssetForge UI | `bun run dev:forge` |
| 3401 | AssetForge API | `bun run dev:forge` |
| 4001 | ElizaOS API | `bun run dev:ai` |
| 3402 | Documentation | `bun run docs:dev` |

## Deployment

### Cloudflare Pages (Frontend)

The client is deployed to Cloudflare Pages (hyperscape.gg) using the `[assets]` directive in `packages/client/wrangler.toml`:

```toml
name = "hyperscape"
compatibility_date = "2024-01-01"

[assets]
directory = "dist"
```

**Deployment Methods:**

1. **Automatic (GitHub Integration)**:
   - Connect repository in Cloudflare Dashboard: Workers & Pages → hyperscape (Pages) → Settings → Builds & deployments
   - Build command: Leave empty (handled by GitHub Actions)
   - Build output directory: `packages/client/dist`
   - Pushes to `main` trigger automatic deployments

2. **Manual (Wrangler CLI)**:
   ```bash
   cd packages/client
   bun run build
   bunx wrangler deploy
   ```

**Environment Variables** (set in Cloudflare Dashboard):
- `PUBLIC_PRIVY_APP_ID` - Privy app ID (must match server)
- `PUBLIC_API_URL` - Backend API URL (e.g., https://hyperscape.gg)
- `PUBLIC_WS_URL` - WebSocket URL (e.g., wss://hyperscape.gg/ws)
- `PUBLIC_CDN_URL` - Asset CDN URL (e.g., https://assets.hyperscape.club)

**Important**: The root `wrangler.toml` was removed to avoid deployment confusion. Use `packages/client/wrangler.toml` for Pages configuration.

### Railway (Production)

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

### Vast.ai (Streaming Duels)

Vast.ai deployment runs the streaming duel system with automated maintenance mode coordination:

**Deployment Flow:**
1. CI triggers on successful main branch builds
2. System enters maintenance mode (pauses new duel cycles)
3. Waits for active markets to resolve (up to 5 minutes)
4. Deploys latest code via SSH
5. Exits maintenance mode and resumes operations

**Maintenance Mode API:**

Control deployment safety via admin endpoints (requires `ADMIN_CODE`):

```bash
# Enter maintenance mode (pauses new duels, waits for markets)
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "x-admin-code: your-admin-code" \
  -H "Content-Type: application/json" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'

# Check status
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"

# Exit maintenance mode (resumes operations)
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "x-admin-code: your-admin-code"
```

**Status Response:**
```json
{
  "active": true,
  "enteredAt": 1709000000000,
  "reason": "deployment",
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0
}
```

**Required GitHub Secrets:**
- `VAST_HOST` - Vast.ai instance IP
- `VAST_PORT` - SSH port
- `VAST_SSH_KEY` - SSH private key
- `VAST_SERVER_URL` - Public server URL (e.g., https://hyperscape.gg)
- `ADMIN_CODE` - Admin authentication code

See `.github/workflows/deploy-vast.yml` for full deployment workflow.

## Native App Distribution

- Desktop and mobile build artifacts are published from tagged releases (`v*`) via `.github/workflows/build-app.yml`.
- Public download portal: [https://hyperscapeai.github.io/hyperscape/](https://hyperscapeai.github.io/hyperscape/)
- Release assets and notes: [https://github.com/HyperscapeAI/hyperscape/releases](https://github.com/HyperscapeAI/hyperscape/releases)
- Release setup details and required secrets: `docs/native-release.md`

### Creating a tagged app release

```bash
git tag v1.0.0
git push origin v1.0.0
```

That tag triggers cross-platform native packaging and publishes installers to a GitHub Release.

## Troubleshooting

**WebGPU not supported error:**
Hyperscape requires WebGPU (all shaders use TSL). Check browser compatibility:
- Chrome/Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS Sonoma+ only)
- Firefox: WebGPU support is experimental (not recommended)

Visit [webgpureport.org](https://webgpureport.org) to verify your browser/GPU support.

**Characters vanishing / not appearing on character select:**
This happens when Privy credentials are missing. Each page refresh creates a new anonymous user, orphaning your characters. Fix: Set `PUBLIC_PRIVY_APP_ID` in client `.env` and both `PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` in server `.env`.

**Assets not loading (404 errors for models/avatars):**
The CDN container needs to be running. It starts automatically with `bun run dev`, but if you're running services separately:
```bash
bun run cdn:up
```

**Database schema errors or stale data after pulling updates:**
Migrations only run once, so pulling new code won't fix an outdated database schema. Reset to fresh:
> ⚠️ **Warning:** This will delete all local data (characters, inventory, progress).
```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null; docker rm hyperscape-postgres 2>/dev/null

# Remove postgres volumes
docker volume rm hyperscape-postgres-data 2>/dev/null; docker volume rm server_postgres-data 2>/dev/null

# Remove any remaining hyperscape volumes
docker volume ls | grep -i hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify volumes are gone
docker volume ls | grep -i hyperscape

# Restart with fresh database
bun run dev
```

**Port conflicts:**
```bash
lsof -ti:5555 | xargs kill -9   # Server
lsof -ti:3333 | xargs kill -9   # Client
lsof -ti:8080 | xargs kill -9   # CDN
```

**Build errors:**
```bash
bun run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Missing objects or white textures after browser restart:**
Corrupted model cache. Clear IndexedDB:
```javascript
// In browser console
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page
```

**Players floating or sinking into terrain:**
Update to latest main branch (terrain height cache fix from February 2026). No migration needed.

**RTMP stream keeps restarting:**
Increase stability thresholds in `packages/server/.env`:
```bash
CDP_STALL_THRESHOLD=6                    # Default: 4 (120s before restart)
FFMPEG_MAX_RESTART_ATTEMPTS=10           # Default: 8
CAPTURE_RECOVERY_MAX_FAILURES=5          # Default: 4
```

**Streaming delay configuration:**
Configure platform-specific delays for anti-cheat timing in `packages/server/.env`:
```bash
# Set canonical platform (determines default delay)
STREAMING_CANONICAL_PLATFORM=twitch      # Options: youtube | twitch | hls

# Override delay (optional - only if you've measured platform latency)
# STREAMING_PUBLIC_DELAY_MS=0            # Default: 12000ms for twitch, 15000ms for youtube, 4000ms for hls
```

**February 2026 Update**: Default delay set to 0ms for instant broadcast. Configure `STREAMING_CANONICAL_PLATFORM` and `STREAMING_PUBLIC_DELAY_MS` to add delay for anti-cheat timing alignment with external platform latency.

**CI builds failing with npm 403 errors:**
Retry logic is automatic (up to 5 attempts with exponential backoff: 15s, 30s, 45s, 60s, 75s). All workflows now use `--frozen-lockfile` to prevent npm resolution attempts. If persistent, check GitHub Actions logs.

**Tauri builds failing with signing errors:**
- **Unsigned builds**: Now use `--no-bundle` instead of `--bundles app` (macOS-only)
- **iOS builds**: Only run on release (unsigned always fails with "Signing requires a development team")
- **Windows builds**: Include retry logic for transient NPM registry errors

**macOS DMG creation failing:**
Unsigned builds now produce `.app` bundles only (skip DMG which requires code signing certificates).

**Memory leak in InventoryInteractionSystem:**
Fixed in February 2026 via AbortController for proper event listener cleanup (9 listeners were never removed). Update to latest main branch.

**Production server won't start without JWT_SECRET:**
As of February 2026, `JWT_SECRET` is required in production/staging environments. Generate with:
```bash
openssl rand -base64 32
```
Set in `packages/server/.env`:
```bash
JWT_SECRET=your-generated-secret-here
```

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## Recent Updates (February 2026)

### Breaking Changes
- **WebGPU Required**: All shaders now use TSL (Three.js Shading Language) which requires WebGPU. WebGL fallback removed. User-friendly error screen shown when WebGPU unavailable.
- **JWT_SECRET Required**: Production/staging deployments now throw error if `JWT_SECRET` not set (security hardening)

### Performance & Rendering
- **Arena Performance**: 97% draw call reduction (~846 meshes → ~20 InstancedMesh), eliminated 28 dynamic PointLights, replaced with GPU-driven TSL emissive materials
- **Fire Particles**: Enhanced fire shader with smooth value noise, soft radial falloff, and per-particle turbulent motion for natural flame appearance (removed "torch" preset, unified on enhanced "fire")
- **Teleport VFX**: Complete rewrite with object pooling, multi-phase animation (gather/erupt/sustain/fade), helix spiral particles, and TSL shader materials
- **Model Cache**: Fixed missing objects (duplicate mesh names) and texture persistence (blob URLs → DataTexture with raw RGBA pixels)
- **Terrain Heights**: Fixed 50m offset in cached height lookups via canonical `worldToTerrainTileIndex()` and `localToGridIndex()` helpers

### Deployment & Operations
- **Maintenance Mode API**: Graceful deployment coordination - pauses new duel cycles, waits for markets to resolve, prevents data loss during deployments
- **Vast.ai Health Checks**: Auto-detect unhealthy instances, destroy and reprovision when failures exceed threshold
- **Streaming Stability**: Increased CDP stall threshold (2→4 intervals), soft CDP recovery, FFmpeg restart attempts (5→8)
- **Renderer Initialization**: Best-effort WebGPU limits (tries `maxTextureArrayLayers: 2048`, retries with defaults if GPU rejects)

### Bug Fixes & Stability
- **Memory Leak Fix**: InventoryInteractionSystem now uses AbortController for proper event listener cleanup (9 listeners were never removed)
- **Duel Combat**: Fixed mage staff and 2H sword combat via weapon type propagation, keep-alive re-engagement, and combat timeout refresh
- **Victory Emote**: Delayed by 600ms so combat cleanup doesn't override it
- **Type Safety**: Eliminated explicit `any` types in core game logic (tile-movement.ts, proxy-routes.ts, ClientGraphics.ts)

### CI/CD & Build System
- **npm Retry Logic**: Automatic retry with exponential backoff (15s-75s) for transient npm 403 errors
- **Frozen Lockfile**: All workflows use `--frozen-lockfile` to prevent npm resolution attempts
- **Tauri Build Fixes**: Split unsigned/release builds, macOS `.app`-only for unsigned, iOS release-only, Windows retry logic
- **Dependency Cycles**: Resolved shared↔procgen cycle via peerDependencies + devDependencies pattern
- **Asset Forge**: Fixed TypeScript strict mode (added type annotations for traverse callbacks), updated to `moduleResolution: bundler` for Three.js WebGPU exports

### Asset Forge
- **VFX Catalog Browser**: New tab with live Three.js previews of all game effects (spells, arrows, glow particles, fishing, teleport, combat HUD)
- **Effect Detail Panels**: Color swatches, parameter tables, layer breakdowns, phase timelines for comprehensive VFX documentation

## License

MIT
