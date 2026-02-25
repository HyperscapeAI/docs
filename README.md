# Hyperscape

**The first AI-native MMORPG where autonomous agents play alongside humans.**

Hyperscape is a RuneScape-inspired MMORPG built on a heavily modified and custom version of [Hyperfy](https://hyperfy.io), an open-source 3D multiplayer engine. The game integrates [ElizaOS](https://elizaos.ai) to enable AI agents to play autonomously in a persistent world. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## What Makes Hyperscape Unique

- **AI Agents as Players**: Autonomous agents powered by ElizaOS that fight, skill, trade, and make decisions using LLMs
- **True OSRS Mechanics**: Authentic tick-based combat (600ms ticks), safespotting, tile-based movement, and classic progression systems
- **Manifest-Driven Design**: Add NPCs, items, and content by editing JSON files—no code changes required
- **Spectator Mode**: Watch agents play in real-time and observe their decision-making process
- **Live Streaming Duels**: AI vs AI combat streamed to Twitch/YouTube with real-time betting
- **Open Source**: Built on open technology with extensible architecture

## Core Features

| Category | Features |
|----------|----------|
| **Combat** | Tick-based OSRS mechanics (600ms ticks), attack styles, accuracy formulas, death/respawn system |
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
| **Economy** | 480-slot bank, shops, item weights, loot drops |
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode |
| **AI Combat** | DuelCombatAI with LLM tactics, health-triggered trash talk, weapon speed awareness |
| **Streaming** | Live AI duels with trash talk, RTMP multi-platform streaming, HLS playback |
| **Betting** | Solana CLOB market integration for duel betting (mainnet ready) |
| **Rendering** | GPU-instanced ParticleManager (97% draw call reduction), TSL shaders, WebGPU support |
| **Performance** | Fishing spot particles: 150→4 draw calls, 65→120 FPS improvement |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.1.38+)
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

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
   ```

> **⚠️ Without Privy credentials**, the game runs in anonymous mode where users get a new identity on every page refresh. Characters will appear to vanish because they're tied to the old anonymous account.

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

## Production Domains

Hyperscape is deployed across multiple domains:

- **hyperscape.gg** - Primary game domain (main game client)
- **hyperscape.bet** - Betting platform for agent duels
- **hyperbet.win** - Additional betting domain with subdomain support

All domains have CORS support configured in the main server and betting keeper.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation tools
├── gold-betting-demo/   # Solana betting integration
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `shared` → everything else (handled automatically by Turbo)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run build` | Build all packages |
| `bun start` | Start production server |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |
| `bun run duel` | Start full duel arena stack (game + bots + streaming + betting) |

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

### Streaming Duel Arena

Start the complete streaming duel stack with one command:

```bash
bun run duel          # Full stack: game + bots + RTMP streaming + betting app
```

This starts:
- Game server with streaming duel scheduler
- Duel matchmaker bots (AI agents fighting each other)
- RTMP bridge for multi-platform streaming (Twitch, YouTube, etc.)
- Local HLS stream for web playback
- Betting app with Solana integration (devnet)
- Keeper bot for automated market operations

**Streaming Options:**
```bash
bun run duel --bots=8              # Start with 8 duel bots
bun run duel --skip-betting        # Skip betting app (stream only)
bun run duel --skip-stream         # Skip RTMP/HLS (betting only)
bun run duel --with-mm             # Enable market maker bots
bun run duel --fresh               # Force fresh restart
bun run duel --verify              # Run startup verification
```

**RTMP Configuration:**
Set stream keys in `packages/server/.env`:
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
```

See `packages/server/.env.example` for full RTMP configuration options.

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

**Production/CI**: Manifests are cloned from HyperscapeAI/assets repo during build (commit 12c01c2).

**Important**: The `packages/server/world/assets/` directory is now fully gitignored. All asset changes must be made in the [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets) repository, not in the main hyperscape repo.

## Configuration

**Required for local development:**
- `packages/client/.env` - Set `PUBLIC_PRIVY_APP_ID`
- `packages/server/.env` - Set `PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`

Both must use the same Privy App ID from [Privy Dashboard](https://dashboard.privy.io).

**Optional configuration** - see `.env.example` files for all options:
- `packages/server/.env.example` - Database, ports, LiveKit voice chat, RTMP streaming
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
| 4179 | Betting App | `bun run duel` |
| 8765 | RTMP Bridge | `bun run duel` |

## Deployment

### Production Domains

Hyperscape is deployed across multiple domains:

- **hyperscape.gg** - Main game client (Cloudflare Pages)
- **hyperscape.bet** - Betting platform (Cloudflare Pages)
- **hyperbet.win** - Alternative betting domain
- **hyperscape.club** - Marketing website

All domains have CORS configured on the game server for cross-origin requests.

### Railway Deployment

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

### Solana Mainnet

The betting system is configured for Solana mainnet with CLOB (Central Limit Order Book) market program:

**Mainnet Program IDs:**
- Fight Oracle: `Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1`
- GOLD CLOB Market: `GCLoBfbkz8Z4xz3yzs9gpump` (example)
- GOLD Token Mint: `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`

See `packages/gold-betting-demo/anchor/programs/` for program source code.

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

**Database migration errors on fresh install (42P07 - relation already exists):**
If you see errors like `ERROR: relation "agent_duel_stats" already exists (42P07)` when running migrations on a fresh database, this was fixed in commit `e4b6489`. Migration 0050 duplicated CREATE TABLE statements from earlier migrations. The fix added `IF NOT EXISTS` to all CREATE TABLE and CREATE INDEX statements. Update to the latest code to resolve.

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

**MUD deploy fails with "mud: command not found":**
If contract deployment fails because the MUD binary cannot be found, this was fixed in commit `113a85a`. The setup script now checks for MUD in the local contracts `node_modules/.bin/` first (for bun's non-hoisting behavior) before falling back to the root. Update to the latest code to resolve.

**Client crashes with React version mismatch:**
If the client throws exceptions related to React version conflicts, this was fixed in commit `3322e78`. All packages now use unified React 19.2.4 and react-dom 19.2.4 versions across the monorepo. The issue was caused by mismatched React versions between packages. Update to the latest code to resolve.

**TypeScript build fails with override conflicts:**
If you see build errors related to TypeScript version overrides or cyclic dependencies, this was fixed in commit `113a85a`. The root package.json no longer forces TypeScript overrides that conflict with package-specific requirements. Update to the latest code to resolve.

**Cloudflare deployment fails with EOVERRIDE error:**
If Cloudflare Pages deployment fails with `EOVERRIDE` errors related to Playwright version conflicts, this was fixed in commit `64db27f`. The npm override for Playwright (>=1.55.1) conflicted with the direct dependency (^1.55.1) in Cloudflare's build environment. The override was removed to allow Cloudflare's dependency resolution to work correctly. Update to the latest code to resolve.

**ESLint crashes with ajv TypeError:**
If ESLint crashes with `TypeError: Class extends value undefined is not a constructor or null` related to ajv, this was fixed in commit `b344d9e`. The issue was caused by forcing ajv@8 on @eslint/eslintrc which requires ajv@6 for Draft-04 schema support. Update to the latest code to resolve.

**Integration tests fail with "anvil: command not found":**
If integration tests fail because the anvil binary is missing, this was fixed in commit `b344d9e`. The CI workflow now installs `foundry-rs/foundry-toolchain` before running integration tests. For local development, install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`

**CI build failures with hls.js or dependency resolution errors:**
If CI builds fail with missing `hls.js` dependency in gold-betting-demo, this was fixed in commit `cfdabf3`. The package now properly declares hls.js in its dependencies. Some packages are temporarily excluded from CI tests due to dependency conflicts:
- `@hyperscape/contracts` (MUD CLI compatibility) - commit 99dec96
- `@hyperscape/gold-betting-demo` (workspace hoisting) - commit 93f9633
- `@hyperscape/evm-contracts` (anvil not in CI) - commit 034f9c9

**Players spawning below duel arena floor:**
Fixed in commit `75d0aa6`. Arena spawn heights were corrected to match visual mesh positions. Update to the latest code if you see players falling through the arena floor.

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Security

### Recent Vulnerability Fixes

**Resolved in commit `a390b79` (Feb 22, 2026):**
- ✅ Fixed 14 of 16 security audit vulnerabilities
- ✅ Upgraded Playwright to ^1.55.1 (fixes GHSA-7mvr-c777-76hp, high severity)
- ✅ Upgraded Vite to ^6.4.1 (fixes GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ Upgraded ajv to ^8.18.0 (fixes GHSA-2g4f-4pwh-qvx6)
- ✅ Added root overrides for: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Remaining vulnerabilities (no upstream patches available):**
- ⚠️ bigint-buffer (high severity) - no patched version available
- ⚠️ elliptic (moderate severity) - no patched version available

**CI Audit Policy:**
The CI audit threshold has been lowered to `critical` only (from `high`) to allow builds to pass while waiting for upstream fixes for bigint-buffer.

## Recent Updates (February 2026)

### Critical Bug Fixes (February 25, 2026)

**Terrain Height Cache Offset Fix (commit 21e0860):**
- Fixed consistent 50m offset in cached terrain height lookups
- **Issue 1**: `getHeightAtCached` used `Math.floor(worldX/TILE_SIZE)` which doesn't account for centered geometry
- **Issue 2**: Grid index formula omitted the halfSize offset from PlaneGeometry's [-50,+50] range
- **Fix**: Added canonical helpers `worldToTerrainTileIndex()` and `localToGridIndex()` that properly handle centered tile geometry
- **Impact**: Terrain tile N now correctly covers world coords [(N-0.5)*SIZE, (N+0.5)*SIZE) instead of [N*SIZE, (N+1)*SIZE)
- Also fixed `getTerrainColorAt()` which had comma-vs-underscore key typo preventing it from ever finding tiles
- File: `packages/shared/src/systems/shared/world/TerrainSystem.ts`

**Model Cache Texture Serialization Fix (commit c98f1cc, PR #935):**
- Fixed two pre-existing bugs in IndexedDB processed model cache causing missing objects and lost textures
- **Bug 1 - Missing Objects**: `serializeNode` used `findIndex-by-name` to map hierarchy nodes to mesh data. Models with duplicate mesh names (common: "", "Cube", "Cube") all resolved to the same index. During deserialization, Three.js `add()` auto-removes from previous parent, so only the last reference survived. Fixed by using `Map<Object3D, number>` identity map built during traversal.
- **Bug 2 - Lost Textures**: Textures were serialized as ephemeral `blob:` URLs but never reloaded during deserialization. Fixed by extracting raw RGBA pixels via canvas `getImageData` (synchronous) and restoring as `THREE.DataTexture` — no async loading race conditions.
- **Bug 3 - Grey Tree Materials**: `createDissolveMaterial` used `instanceof MeshStandardMaterial` which fails for `MeshStandardNodeMaterial` in the WebGPU build. Replaced with duck-type property check.
- **Impact**: Altars, trees, and other complex models now render correctly after page reload with proper textures and hierarchy
- Files: `packages/shared/src/utils/rendering/ModelCache.ts`, `packages/shared/src/systems/shared/world/GPUVegetation.ts`

**Duel Combat Fixes (commit 029456, PR #934):**
- Fixed mage staff and 2H sword combat in streaming duels
- **Keep-alive re-engagement**: Added periodic re-engagement in DuelCombatAI to prevent agents idling when combat state times out (fixes 2H sword attacks)
- **Weapon type propagation**: Propagate weapon type (mage/ranged/melee) through DuelOrchestrator into `startCombat` so correct attack speeds are used
- **Rune inventory readiness**: Added polling and validation bypass for duel bot agents to prevent rune loading race conditions
- **Combat state starvation guard**: Prevent repeated `startCombat` resets on slow weapons from starving auto-attack loop
- **Combat timeout refresh**: Refresh combat timeout after ranged/magic attacks in both CombatSystem and CombatTickProcessor
- **PvP zone bypass**: Bypass PvP zone checks for streaming duel combatants
- **Safe zone aggro block**: Block aggro and chase on players in safe zones via AggroSystem
- Files: `packages/server/src/arena/DuelCombatAI.ts`, `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`, `packages/shared/src/systems/shared/combat/CombatSystem.ts`, `packages/shared/src/systems/shared/combat/CombatTickProcessor.ts`, `packages/shared/src/systems/shared/combat/AggroSystem.ts`

**ArenaPointsService Connection Timeout Fix (commit 99cd3f7):**
- Resolved connection timeouts in ArenaPointsService database operations
- **Issue**: Database queries were timing out due to improper connection handling
- **Fix**: Added proper connection pool management, query timeouts, and error handling
- **Impact**: Arena points system now operates reliably without connection timeouts
- File: `packages/server/src/arena/services/ArenaPointsService.ts`

### Rendering Optimizations

**GLBTreeInstancer - InstancedMesh Tree Rendering (commit 0871acb):**
- Replaced per-tree `scene.clone(true)` with shared InstancedMesh pools per LOD level
- Trees now render via shared geometry references instead of deep-cloning buffers on each spawn
- Eliminated FPS drops when approaching tree chunks
- Performance: ~15-20% FPS improvement in dense forest areas
- Memory: ~80% reduction in geometry buffer allocations
- Draw calls: Reduced from N trees to 3 (one per LOD level)
- Implementation: `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`

**ResourceEntity Visual Strategy Pattern (commit bc60264):**
- Refactored ResourceEntity (~1700 lines removed) into delegated visual strategies
- Strategy Pattern separates rendering logic from entity lifecycle management
- 5 visual strategies: TreeGLBVisualStrategy, TreeProcgenVisualStrategy, StandardModelVisualStrategy, FishingSpotVisualStrategy, PlaceholderVisualStrategy
- Factory pattern in `createVisualStrategy()` selects strategy based on resource type and model path
- Benefits: Single Responsibility, Open/Closed principle, improved testability and maintainability

**PlaceholderInstancer (commit bc60264):**
- Instanced rendering for placeholder resources (trees/ores with missing models)
- Color-coded: green (trees), brown (ores), blue (fishing spots)
- Prevents individual BoxGeometry creation per resource
- Max 1000 instances per resource type

**Bug Fixes:**
- Fixed fishing spot particles persisting after depletion (commit bc60264)
- Fixed placeholder trees not rendering due to "null" string in modelPath (commit bc60264)
- Fixed DEV_UNLIMITED_GATHERING flag bypass (commit c182b4b) - re-enabled level checks, tool checks, inventory capacity guards

**GPU-Instanced Particle System (PR #877, commit 4168f2f):**
- Centralized ParticleManager architecture for all particle effects
- Fishing spot particles refactored to use 4 GPU InstancedMeshes (splash, bubble, shimmer, ripple)
- Draw calls reduced from ~150 to 4 (97% reduction)
- Removed ~450 lines of per-entity CPU animation code
- FPS improvement: 65-70 → 120 on reference hardware
- TSL NodeMaterials with GPU-computed billboard orientation, parabolic arcs, wobble, twinkle
- Extensible architecture for future particle types (fire, magic, dust)

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

### Duel System Improvements

**Combat Roles (PR #933, commit 82ff784):**
- Added weighted random combat role selection: 50% melee, 25% ranged, 25% mage
- Full gear equip/cleanup lifecycle in DuelOrchestrator
- Melee: Random bronze weapon (longsword, scimitar, 2h sword)
- Ranged: Shortbow + bronze arrows (500 qty), uses "rapid" attack style
- Mage: Staff of air + wind strike autocast + runes (500 mind, 500 air)
- DuelCombatAI adapts style switching based on combat role
- Gear cleanup after duel: unequips weapons/arrows, clears autocast, removes leftover runes

**Critical Bug Fixes (PR #933, commit 82ff784):**

1. **Combat State Key Mismatch:**
   - Issue: CombatStateService syncs abbreviated keys (`data.c`/`data.ct`) but `getGameState()` only read full keys (`data.inCombat`/`data.combatTarget`)
   - Impact: DuelCombatAI always saw `inCombat=false` and flooded `executeAttack` every tick
   - Fix: EmbeddedHyperscapeService now reads both abbreviated and full keys
   - File: `packages/server/src/eliza/EmbeddedHyperscapeService.ts`

2. **Magic Attack TOCTOU Race:**
   - Issue: Cooldown checked early but claimed after async `consumeRunesForSpell` call
   - Impact: Duplicate magic projectiles, double rune consumption
   - Fix: Moved cooldown claim and `enterCombat` before async rune consumption
   - File: `packages/shared/src/systems/shared/combat/CombatSystem.ts`

**Terrain Flat Zones for Duel Arenas (commit 7a60135):**
- Fixed players/agents sinking ~0.4m into duel arena floors
- DuelArenaVisualsSystem now registers flat zones programmatically for all 8 floor areas (6 arenas + lobby + hospital)
- Terrain height queries return correct floor-level values
- Terrain mesh carved under floors to prevent grass/vegetation clipping

**Arena Click Targeting & Minimap (commit 24354238):**
- Fixed click target going underground in duel arenas (skip building footprint validation for arena-floor raycast hits)
- Fixed minimap showing duel arenas as black holes (enable layer 0 on arena/lobby/hospital floor meshes)
- Removed 96 non-functional wall sconce meshes from arena fences

### Database & CI Improvements

**Migration 0050 Idempotency Fix (commit e4b6489):**
- Added `IF NOT EXISTS` to all CREATE TABLE and CREATE INDEX statements
- Prevents `42P07` errors on fresh database installs
- Migration 0050 previously duplicated tables from earlier migrations (e.g., agent_duel_stats from 0039)

**SKIP_MIGRATIONS Environment Variable (commit 6a5f4ee, eb8652a):**
- New `SKIP_MIGRATIONS=true` flag for external schema management
- Skips built-in migration execution, table validation, and recovery loop
- Use with `drizzle-kit push` for declarative schema creation (avoids FK ordering issues)
- Required for CI integration tests

**CI Test Reliability (commits 034f9c9, 93f9633, 99dec96, cfdabf3):**
- Fixed missing `hls.js` dependency in gold-betting-demo
- Excluded packages with dependency conflicts from CI tests
- Chain setup skipped when `CI=true` (anvil/mud not available)
- Foundry toolchain installed for integration tests

### Streaming Infrastructure

**RTX 4090 WebGPU Support (commit 80bb06e):**
- Switched ANGLE from GL to Vulkan backend for RTX 4090 GPUs
- Improves WebGPU rendering performance in streaming capture
- Chrome launch args: `--use-angle=vulkan --use-vulkan --enable-features=Vulkan`

**Duel Arena Spawn Fix (commit 75d0aa6):**
- Corrected arena spawn heights to match visual mesh positions
- Prevents players from spawning below arena floor

### Dependency Updates (February 2026)

Major version updates from dependabot:
- Three.js: 0.182.0 → 0.183.1
- @types/node: 24.10.13 → 25.3.0
- @ai-sdk/anthropic: 1.2.12 → 3.0.46
- @capacitor/cli: 7.5.0 → 8.1.0
- @coral-xyz/anchor: 0.31.1 → 0.32.1
- @elizaos/core: 2.0.0-alpha.11 → 2.0.0-alpha.12
- @playwright/test: 1.54.2 → 1.58.2
- chai: 4.5.0 → 6.2.2
- dotenv: 16.6.1 → 17.3.1
- eslint: 9.39.3 → 10.0.2
- framer-motion: 11.18.2 → 12.34.3
- lucide-react: 0.553.0 → 0.575.0
- three-mesh-bvh: 0.8.3 → 0.9.8
- vite-plugin-node-polyfills: 0.24.0 → 0.25.0
- zod: 3.25.76 → 4.3.6

## Architecture Documentation

- **[CLAUDE.md](CLAUDE.md)** - Development guidelines, architecture, coding standards
- **[docs/particle-manager-architecture.md](docs/particle-manager-architecture.md)** - GPU-instanced particle system architecture
- **[docs/duel-trash-talk-system.md](docs/duel-trash-talk-system.md)** - AI agent trash talk during combat
- **[docs/duel-stack.md](docs/duel-stack.md)** - Streaming duel arena stack setup
- **[docs/railway-dev-prod.md](docs/railway-dev-prod.md)** - Railway deployment guide

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
