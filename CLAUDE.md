# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```

## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── SQLite/PostgreSQL persistence
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── procgen/             # Procedural generation (trees, rocks, terrain)
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **procgen** - Procedural generation library
3. **shared** - Depends on physx-js-webidl and procgen
4. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

**Note**: `shared` and `procgen` have a peer dependency relationship (not a hard dependency) to avoid circular dependency issues with Turbo's build graph.

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### RPG Implementation Architecture

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or "will fill this out later" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 5555 | Game Server | `PORT` | `bun run dev` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------| 
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.1.38+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.1.38+
- **Engine**: Three.js 0.180.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: SQLite (local), PostgreSQL (production via Neon)
- **Testing**: Playwright, Vitest
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### Model Cache Issues

**Symptoms**: Missing objects (altars, trees) or white/grey textures after browser restart.

**Cause**: Corrupted IndexedDB cache from pre-February 2026 builds.

**Solution**:
```javascript
// Clear cache in browser console
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page - cache will rebuild with fixed serialization
```

**Disable cache for debugging**:
```javascript
localStorage.setItem('disable-model-cache', 'true');
```

See [docs/model-cache-fixes.md](docs/model-cache-fixes.md) for details.

### Terrain Height Issues

**Symptoms**: Players floating 50m above ground, incorrect pathfinding, resources spawning in air.

**Cause**: Terrain height cache offset bug (fixed February 2026).

**Solution**: Update to latest main branch. No migration needed - fix is automatic.

See [docs/terrain-height-cache-fix.md](docs/terrain-height-cache-fix.md) for technical details.

### Streaming Issues

**Symptoms**: RTMP stream keeps restarting, frequent disconnections, or WebGPU initialization failures in headless environments.

**Cause**: CDP stall threshold too aggressive, FFmpeg crashes, or WebGPU unavailable in Docker/vast.ai.

**Solutions** (improved February 2026):

**Stability Tuning** - Increase thresholds in `packages/server/.env`:
```bash
CDP_STALL_THRESHOLD=6                    # Default: 4 (120s total before restart)
FFMPEG_MAX_RESTART_ATTEMPTS=10           # Default: 8
CAPTURE_RECOVERY_MAX_FAILURES=5          # Default: 4
```

**WebGPU Fallback** - For headless environments (Docker, vast.ai):
```bash
STREAM_CAPTURE_DISABLE_WEBGPU=true       # Forces WebGL fallback
```
Or use query params: `?page=stream&forceWebGL=1` or `?page=stream&disableWebGPU=1`

**Improvements**:
- **Soft CDP Recovery**: Restarts screencast without browser/FFmpeg teardown (no stream gap)
- **Best-Effort WebGPU Init**: Tries `maxTextureArrayLayers: 2048` first, retries with default limits if GPU rejects
- **WebGL Fallback**: RendererFactory automatically falls back to WebGL when WebGPU fails or is disabled
- **Swiftshader ANGLE**: ecosystem.config.cjs uses swiftshader backend for reliable software rendering

**Ecosystem Config** (`ecosystem.config.cjs`):
```javascript
env: {
  STREAM_CAPTURE_DISABLE_WEBGPU: 'true',  // Reliable software rendering
  // ... other vars
}
```

### CI Build Failures

**Symptoms**: GitHub Actions builds fail with npm 403 errors, signing failures, or platform-specific errors.

**Cause**: npm rate limiting, missing signing certificates, or platform-specific build configuration issues.

**Solutions** (all fixed February 2026):

1. **npm 403 errors**: Automatic retry with exponential backoff (15s, 30s, 45s, 60s, 75s) - up to 5 attempts
2. **Frozen lockfile**: All workflows use `bun install --frozen-lockfile` to prevent npm resolution attempts that trigger rate limits
3. **Signing failures**: Build workflows split into separate unsigned/release jobs - signing env vars only present during actual releases
4. **macOS unsigned builds**: Use `--no-bundle` instead of `--bundles app` (app bundle type is macOS-only, causing Linux/Windows to fail)
5. **iOS builds**: Release-only (unsigned iOS builds always fail with "Signing requires a development team")
6. **Windows install failures**: Retry logic (3 attempts) for transient NPM registry 403 errors on Windows runners

**Workflow Files**:
- `.github/workflows/build-app.yml` - Native app builds (desktop + mobile)
- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/deploy-vast.yml` - Vast.ai deployment with maintenance mode

### Dependency Cycle Errors

**Symptoms**: Turbo build fails with "cyclic dependency detected: shared ↔ procgen".

**Cause**: Turbo treats peerDependencies as graph edges.

**Solution**: Already fixed (February 2026) - `procgen` is an **optional peerDependency** in `shared/package.json`, and `shared` is a **devDependency** in `procgen/package.json`. This breaks the Turbo graph cycle while allowing imports to resolve at runtime (both packages are always installed together in the workspace).

**Technical Details**: `devDependencies` are not followed by Turbo's `^build` topological ordering, so this doesn't create a cycle. The devDependency in procgen ensures bun links the package so TypeScript can find `@hyperscape/procgen` module declarations during type checking.

**If you see this error**:
```bash
# Verify package.json configurations
cat packages/shared/package.json | grep procgen
# Should show: "peerDependencies": { "@hyperscape/procgen": "workspace:*" }

cat packages/procgen/package.json | grep shared
# Should show: "devDependencies": { "@hyperscape/shared": "workspace:*" }
```

### Deployment & Maintenance Mode

**Maintenance Mode** - Graceful deployment coordination for streaming duel system.

**Purpose**: Prevents data loss and market inconsistency during deployments by:
1. Pausing new duel cycles (current cycle completes)
2. Locking betting markets (no new bets accepted)
3. Waiting for current market to resolve
4. Reporting "safe to deploy" status

**API Endpoints** (require `ADMIN_CODE` authentication):
```bash
# Enter maintenance mode
POST /admin/maintenance/enter
Body: {"reason": "deployment", "timeoutMs": 300000}

# Check status
GET /admin/maintenance/status

# Exit maintenance mode
POST /admin/maintenance/exit
```

**Status Response**:
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

**Safe to Deploy When**:
- `safeToDeploy: true`
- No active duel phases (FIGHTING, COUNTDOWN, ANNOUNCEMENT)
- All betting markets resolved

**CI/CD Integration**: `.github/workflows/deploy-vast.yml` automatically enters/exits maintenance mode during deployments.

**Implementation**: `packages/server/src/startup/maintenance-mode.ts`

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`

### February 2026 Technical Documentation
- Arena Performance: InstancedMesh conversion, TSL emissive materials replacing PointLights
- Model Cache: Fixed duplicate mesh name serialization and texture blob URL persistence
- Terrain Heights: Canonical `worldToTerrainTileIndex()` and `localToGridIndex()` helpers
- Streaming: CDP soft recovery, WebGPU best-effort init, WebGL fallback
- CI/CD: npm retry logic, frozen lockfile, Tauri build splitting
- VFX System: Object pooling, TSL shader materials, multi-phase teleport animation
- Maintenance Mode: Deployment coordination API with market resolution waiting
