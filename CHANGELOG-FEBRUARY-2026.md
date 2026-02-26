# Changelog - February 2026

Comprehensive list of all changes pushed to main branch in February 2026, organized by category with commit references.

## Table of Contents

- [Breaking Changes](#breaking-changes)
- [New Features](#new-features)
- [Performance Improvements](#performance-improvements)
- [Bug Fixes](#bug-fixes)
- [CI/CD & Build System](#cicd--build-system)
- [Code Quality & Refactoring](#code-quality--refactoring)
- [Documentation](#documentation)

## Breaking Changes

### WebGPU Required (No WebGL Fallback)

**Commit**: `3bc59db` (February 26, 2026)

All shaders now use TSL (Three.js Shading Language) which requires WebGPU. WebGL fallback removed.

**Impact**:
- Users must use Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+)
- Older browsers show user-friendly error screen with upgrade instructions
- Server-side rendering requires Vulkan drivers and WebGPU-capable Chrome

**Migration**: No code changes needed. Update browser or GPU drivers if WebGPU unavailable.

**Documentation**: [docs/webgpu-requirements.md](docs/webgpu-requirements.md)

### JWT_SECRET Required in Production

**Commit**: `3bc59db` (February 26, 2026)

`JWT_SECRET` is now **required** in production/staging environments. Server throws error on startup if not set.

**Impact**:
- Production deployments fail without `JWT_SECRET`
- Development environments show warning (but don't throw)

**Migration**:
```bash
# Generate secure JWT secret
openssl rand -base64 32

# Add to packages/server/.env
JWT_SECRET=your-generated-secret-here
```

**Documentation**: See `packages/server/.env.example`

## New Features

### Maintenance Mode API

**Commits**: `30b52bd`, `deploy-vast.yml` updates (February 26, 2026)

Graceful deployment coordination for streaming duel system.

**Features**:
- Pause new duel cycles while allowing active markets to resolve
- API endpoints for enter/exit/status with admin authentication
- Automatic timeout protection (force-proceed after 5 minutes)
- CI/CD integration for zero-downtime deployments

**API Endpoints**:
```bash
POST /admin/maintenance/enter   # Enter maintenance mode
POST /admin/maintenance/exit    # Exit maintenance mode
GET  /admin/maintenance/status  # Check current status
```

**Documentation**: [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md)

### Vast.ai Deployment Target

**Commits**: `dda4396`, `30b52bd`, `690ede5` (February 26, 2026)

Automated deployment to Vast.ai GPU instances with:
- DATABASE_URL support for external PostgreSQL
- Maintenance mode coordination
- Health checking with auto-reprovisioning
- PM2 process management with auto-restart
- Vulkan driver installation for GPU rendering

**Workflow**: `.github/workflows/deploy-vast.yml`

**Documentation**: [docs/vast-deployment.md](docs/vast-deployment.md)

### VFX Catalog Browser (Asset Forge)

**Commit**: `69105229` (February 25, 2026)

New VFX page in Asset Forge with:
- Sidebar catalog of all game effects (spells, arrows, particles, teleport, combat HUD)
- Live Three.js previews with interactive controls
- Detail panels showing colors, parameters, layers, and phase timelines

**Location**: `packages/asset-forge/src/pages/VFXPage.tsx`

### Gold Betting Demo Mobile UI

**Commit**: `210f6bd` (PR #942, February 26, 2026)

Mobile-responsive UI overhaul with real-data integration:
- Resizable panels (desktop) with `useResizePanel` hook
- Mobile-responsive layout with aspect-ratio 16/9 video, bottom-sheet sidebar
- Live SSE feed from game server (devnet mode)
- Trader field added to Trade interface
- Keeper database persistence layer

**Location**: `packages/gold-betting-demo/app/`

## Performance Improvements

### Arena Rendering Optimization

**Commit**: `c20d0fc` (PR #938, February 25, 2026)

**97% draw call reduction** by converting ~846 individual meshes to InstancedMesh:

**Instanced Components**:
- Fence posts + caps: 288 instances → 2 draw calls
- Fence rails (X/Z): 72 instances → 2 draw calls
- Stone pillars (base/shaft/capital): 96 instances → 3 draw calls
- Brazier bowls: 24 instances → 1 draw call
- Floor border trim: 24 instances → 2 draw calls
- Banner poles: 12 instances → 1 draw call

**Lighting Optimization**:
- Eliminated all 28 PointLights (CPU cost per frame)
- Replaced with GPU-driven TSL emissive brazier material
- Per-instance flicker phase derived from world position (quantized)
- Multi-frequency sine + noise for natural flame appearance

**Fire Particles**:
- Enhanced shader with smooth value noise (bilinear interpolated hash lattice)
- Soft radial falloff for additive blending
- Turbulent vertex motion for natural flame flickering
- Height-based color gradient (yellow → orange → red)
- Removed "torch" preset, unified on enhanced "fire" preset

**Dead Code Removal**:
- Deleted `createArenaMarker()`, `createAmbientDust()`, `createLobbyBenches()`

**Location**: `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`

### Streaming Stability Improvements

**Commit**: `14a1e1b` (February 25, 2026)

Increased resilience for long-running RTMP streams:

**CDP (Chrome DevTools Protocol)**:
- Stall threshold: 2 → 4 intervals (120s total before restart)
- Added soft CDP recovery: restart screencast without browser/FFmpeg teardown (no stream gap)

**FFmpeg**:
- Max restart attempts: 5 → 8
- Added `resetRestartAttempts()` for recovery counter reset

**Capture Recovery**:
- Max failures: 2 → 4 (allows more soft recovery attempts before full teardown)

**Renderer Initialization**:
- Best-effort `requiredLimits`: tries `maxTextureArrayLayers: 2048` first
- Retries with default limits if GPU rejects
- Always WebGPU, never WebGL

**Location**: `packages/server/src/streaming/stream-capture.ts`

## Bug Fixes

### Memory Leak in InventoryInteractionSystem

**Commit**: `3bc59db` (February 26, 2026)

Fixed memory leak where 9 event listeners were never removed.

**Solution**: Uses `AbortController` for proper event listener cleanup:
```typescript
const abortController = new AbortController();
world.on('event', handler, { signal: abortController.signal });
// Later: abortController.abort() removes all listeners
```

**Location**: `packages/shared/src/systems/shared/interaction/InventoryInteractionSystem.ts`

### CSRF Token Errors (Cross-Origin Requests)

**Commit**: `cd29a76` (February 26, 2026)

Fixed POST/PUT/DELETE requests from Cloudflare Pages frontend to Railway backend failing with "Missing CSRF token" error.

**Root Cause**: CSRF middleware uses `SameSite=Strict` cookies which cannot be sent in cross-origin requests.

**Solution**: Skip CSRF validation for known cross-origin clients (already protected by Origin header validation + JWT bearer tokens):
- `hyperscape.gg` (apex domain)
- `*.hyperscape.gg` (subdomains)
- `hyperbet.win`, `hyperscape.bet` (apex domains + subdomains)

**Location**: `packages/server/src/middleware/csrf.ts`

### Duel Victory Emote Timing

**Commit**: `645137386` (PR #940, February 25, 2026)

Fixed winning agent's wave emote being immediately overwritten by stale "idle" resets from combat animation system.

**Solution**: Delay emote by 600ms so all death/combat cleanup finishes first. Also reset emote to idle in `stopCombat` so wave stops when agents teleport out.

**Location**: `packages/shared/src/systems/shared/combat/CombatAnimationManager.ts`

### Duplicate Teleport VFX

**Commit**: `7bf0e14` (PR #939, February 25, 2026)

Fixed duplicate teleport effects and race condition causing spurious 3rd teleport.

**Root Causes**:
1. Premature `clearDuelFlagsForCycle()` in `endCycle()` created race with `ejectNonDuelingPlayersFromCombatArenas()`
2. `suppressEffect` not forwarded through ServerNetwork → ClientNetwork → VFX system
3. Duplicate PLAYER_TELEPORTED emit from PlayerRemote.modify() and local player path

**Solutions**:
- Flags stay true until `cleanupAfterDuel()` completes teleports (cleared via microtask)
- Forward `suppressEffect` to clients so mid-fight corrections are suppressed
- Remove duplicate PLAYER_TELEPORTED emits
- Scale down teleport beam/ring/particle geometry to fit avatar size

**Location**: `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

### Type Safety Improvements

**Commit**: `d9113595` (February 26, 2026)

Eliminated explicit `any` types in core game logic:

**tile-movement.ts**: Removed 13 `any` casts by properly typing BuildingCollisionService and ICollisionMatrix method calls

**proxy-routes.ts**: Replaced `any` with proper types:
- Error handlers: `unknown`
- WebSocket message handlers: `Buffer | string`
- Error events: `Error`

**ClientGraphics.ts**: Added cast for `setupGPUCompute` after WebGPU verification (WebGPU is now required, so cast is safe)

**Remaining `any` types** (acceptable):
- TSL shader code (ProceduralGrass.ts) - @types/three limitation
- Browser polyfills (polyfills.ts) - intentional mock implementations
- Test files - acceptable for test fixtures

**Locations**: 
- `packages/shared/src/systems/ServerNetwork/tile-movement.ts`
- `packages/server/src/routes/proxy-routes.ts`
- `packages/shared/src/systems/client/ClientGraphics.ts`

### WebSocket Type Fixes

**Commits**: `efba5a0`, `fcd21eb` (February 26, 2026)

Fixed TypeScript errors in WebSocket handling:

**efba5a0**: Use `ws` WebSocket type for Fastify websocket connections (not browser WebSocket). Fixes missing `removeAllListeners` and `on` methods.

**fcd21eb**: Simplify WebSocket readyState check to avoid type error. Use numeric constant `1` (WebSocket.OPEN) instead of redundant comparison.

**Location**: `packages/server/src/startup/websocket.ts`

### R2 CORS Configuration Fix

**Commits**: `143914d`, `055779a` (February 26, 2026)

Fixed R2 bucket CORS configuration for cross-origin asset loading.

**143914d**: Added `configure-r2-cors.sh` script and CORS configuration step to deploy-cloudflare workflow

**055779a**: Updated to correct Wrangler API format:
- Use nested `allowed.origins/methods/headers` structure
- Use `exposed` array and `maxAge` integer
- Fixes `wrangler r2 bucket cors set` command

**Location**: `scripts/configure-r2-cors.sh`, `.github/workflows/deploy-cloudflare.yml`

**Documentation**: [docs/r2-cors-configuration.md](docs/r2-cors-configuration.md)

### Asset Forge TypeScript Fixes

**Commits**: `82f97dad`, `42e52af`, `b5c762c`, `cadd3d5` (February 26, 2026)

Fixed multiple TypeScript and ESLint issues in asset-forge package:

**82f97dad**: Added type annotations for traverse callbacks (TypeScript strict mode requirement)

**42e52af**: Updated to `moduleResolution: bundler` for Three.js WebGPU exports (previous 'node' setting couldn't resolve exports map)

**b5c762c**: Disabled crashing `import/order` rule from root config (eslint-plugin-import@2.32.0 incompatible with ESLint 10)

**cadd3d5**: Fixed ESLint crash from deprecated `--ext` flag - use `eslint src` instead of `eslint . --ext .ts,.tsx`

**Locations**: 
- `packages/asset-forge/tsconfig.json`
- `packages/asset-forge/eslint.config.mjs`
- `packages/asset-forge/package.json`

## CI/CD & Build System

### npm Retry Logic

**Commits**: `7c9ff6c`, `08aa151` (February 25, 2026)

Added retry logic for transient npm 403 Forbidden errors from GitHub Actions IP rate limiting.

**7c9ff6c**: Retry with exponential backoff (15s, 30s, 45s, 60s, 75s) - up to 5 attempts

**08aa151**: Use `--frozen-lockfile` in all workflows to prevent npm resolution attempts that trigger rate limits

**Locations**: All `.github/workflows/*.yml` files

### Tauri Build Fixes

**Commits**: `15250d2`, `8ce4819`, `f19a7042` (February 25-26, 2026)

Fixed multiple Tauri build issues across platforms:

**15250d2**: Split builds into unsigned/release variants to prevent empty APPLE_CERTIFICATE crash. Signing env vars only present during actual releases.

**8ce4819**: 
- iOS: Make build job release-only (unsigned iOS always fails with "Signing requires a development team")
- Windows: Add retry logic (3 attempts) for transient NPM registry 403 errors

**f19a7042**:
- Linux/Windows: Replace `--bundles app` with `--no-bundle` for unsigned builds (app bundle type is macOS-only)
- Make `beforeBuildCommand` cross-platform using Node.js instead of Unix shell
- Split artifact upload: release builds upload bundles, unsigned builds upload raw binaries

**Location**: `.github/workflows/build-app.yml`

### Dependency Cycle Resolution

**Commits**: `f355276`, `3b9c0f2`, `05c2892` (February 25-26, 2026)

Resolved circular dependency between `shared` and `procgen` packages.

**Problem**: Turbo detected cycle: `shared → procgen → shared`

**Solution**:
- `procgen` is an **optional peerDependency** in `shared/package.json`
- `shared` is a **devDependency** in `procgen/package.json`
- This breaks Turbo graph cycle while allowing imports to resolve at runtime

**Locations**:
- `packages/shared/package.json`
- `packages/procgen/package.json`

### Cloudflare Pages Configuration

**Commits**: `42a1a0e`, `1af02ce`, `f19a7042` (February 26, 2026)

Fixed Cloudflare Pages deployment configuration:

**42a1a0e**: Updated `wrangler.toml` to use `[assets]` directive instead of `pages_build_output_dir`

**1af02ce**: Specified `pages_build_output_dir` to prevent worker deployment error

**f19a7042**: Removed root `wrangler.toml` to avoid deployment confusion (correct config is in `packages/client/wrangler.toml`)

**Locations**:
- `packages/client/wrangler.toml`
- Deleted: `wrangler.toml` (root)

## Code Quality & Refactoring

### Dead Code Removal

**Commit**: `7c3dc98` (February 26, 2026)

Deleted 3098 lines of dead code and corrected architectural TODOs:

**PacketHandlers.ts**: Deleted entire file (3098 lines, never imported, completely unused)

**Architectural TODO Updates**:
- AUDIT-002: ServerNetwork already decomposed into 30+ modules (actual size ~3K lines, not 116K)
- AUDIT-003: ClientNetwork handlers are intentional thin wrappers (extraction not needed)
- AUDIT-005: Any types reduced from 142 to ~46 (68% reduction)

**Location**: Deleted `packages/server/src/systems/ServerNetwork/PacketHandlers.ts`

### Type Safety Cleanup

**Commit**: `d9113595` (February 26, 2026)

Eliminated explicit `any` types in core game logic (see [Bug Fixes](#type-safety-improvements) above).

## Deployment & Operations

### Streaming Configuration Updates

**Commits**: `7f1b1fd`, `b00aa23` (February 26, 2026)

**7f1b1fd**: Configured Twitch, Kick, and X streaming destinations:
- Added Twitch stream key
- Added Kick stream key with RTMPS URL
- Added X/Twitter stream key with RTMP URL
- Removed YouTube (not needed)
- Set canonical platform to twitch for anti-cheat timing

**b00aa23**: Set public data delay to 0ms (no delay between game events and public broadcast)

**Location**: `ecosystem.config.cjs`, `packages/server/.env.example`

### Deploy Script Improvements

**Commits**: `690ede5`, `c80ad7a`, `b9a7c3b`, `674cb11` (February 25-26, 2026)

**690ede5**: Pull from main branch and use funded deployer keypair (5JB9hqEzKqCiptLSBi4fHCVPJVb3gpb3AgRyHcJvc4u4)

**c80ad7a**: Use `bunx` instead of `npx` in build-services.mjs (Vast.ai container only has bun)

**b9a7c3b**: Explicitly checkout main before running deploy script (breaks cycle where deploy script kept pulling from hackathon branch)

**674cb11**: Use env vars instead of secrets in workflow conditions (GitHub Actions doesn't allow accessing secrets in 'if' conditions)

**Locations**:
- `scripts/deploy-vast.sh`
- `packages/asset-forge/scripts/build-services.mjs`
- `.github/workflows/deploy-vast.yml`

### Cloudflare Origin Lock Disabled

**Commit**: `3ec9826` (February 25, 2026)

Disabled Cloudflare origin lock preventing direct frontend API access.

**Impact**: Frontend can now make direct API calls to backend without origin restrictions.

**Location**: Server configuration (specific file not identified in commit message)

## Documentation

### New Documentation Files

Created comprehensive documentation for new features:

1. **[docs/vast-deployment.md](docs/vast-deployment.md)** - Vast.ai deployment guide
2. **[docs/maintenance-mode-api.md](docs/maintenance-mode-api.md)** - Maintenance mode API reference
3. **[docs/webgpu-requirements.md](docs/webgpu-requirements.md)** - Browser and GPU requirements
4. **[docs/r2-cors-configuration.md](docs/r2-cors-configuration.md)** - R2 CORS setup guide

### Updated Documentation

1. **README.md** - Added WebGPU requirements, deployment targets, troubleshooting
2. **CLAUDE.md** - Added WebGPU notes, maintenance mode, recent fixes
3. **packages/server/.env.example** - Updated with streaming stability tuning, maintenance mode notes

## Migration Guide

### Upgrading from Pre-February 2026

**Required Actions**:

1. **Set JWT_SECRET** (production/staging only):
   ```bash
   openssl rand -base64 32
   # Add to packages/server/.env
   ```

2. **Verify WebGPU Support**:
   - Visit [webgpureport.org](https://webgpureport.org)
   - Update browser to Chrome 113+ or Edge 113+ if needed
   - Update GPU drivers if WebGPU unavailable

3. **Clear Model Cache** (if experiencing missing objects or white textures):
   ```javascript
   // In browser console
   indexedDB.deleteDatabase('hyperscape-processed-models');
   // Reload page
   ```

**Optional Actions**:

1. **Configure Maintenance Mode** (if using Vast.ai deployment):
   - Set `ADMIN_CODE` in server `.env`
   - Add `ADMIN_CODE` GitHub secret
   - See [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md)

2. **Update Streaming Configuration** (if using RTMP streaming):
   - Configure Twitch/Kick/X stream keys in server `.env`
   - Set `STREAMING_CANONICAL_PLATFORM=twitch`
   - Set `STREAMING_PUBLIC_DELAY_MS=0` for instant broadcast
   - See `packages/server/.env.example`

3. **Configure R2 CORS** (if using Cloudflare R2 for assets):
   - Run `bash scripts/configure-r2-cors.sh`
   - Or configure manually via Cloudflare Dashboard
   - See [docs/r2-cors-configuration.md](docs/r2-cors-configuration.md)

## Commit Reference

All commits from February 25-26, 2026 (newest first):

| Date | Commit | Description |
|------|--------|-------------|
| Feb 26 | `dda4396` | fix(deploy): add DATABASE_URL support for Vast.ai deployment |
| Feb 26 | `70b90e4` | chore: touch client entry point to ensure Pages rebuild |
| Feb 26 | `85da919` | chore: force Cloudflare Pages rebuild for packet sync |
| Feb 26 | `055779a` | fix(cors): update R2 CORS config to use correct wrangler API format |
| Feb 26 | `143914d` | fix(cors): add R2 bucket CORS configuration for cross-origin asset loading |
| Feb 26 | `ca18a60` | Merge pull request #943 from HyperscapeAI/hackathon |
| Feb 26 | `f317ec5` | chore: trigger Cloudflare Pages rebuild for packet sync and CSRF fix |
| Feb 26 | `210f6bd` | feat(gold-betting-demo): mobile-responsive UI overhaul + real-data integration (PR #942) |
| Feb 26 | `cd29a76` | fix(csrf): skip CSRF validation for known cross-origin clients |
| Feb 26 | `30b52bd` | feat(deploy): add graceful deployment with maintenance mode |
| Feb 26 | `f19a704` | fix(ci): fix Linux and Windows desktop builds + cleanup wrangler config |
| Feb 26 | `42a1a0e` | fix(client): update wrangler.toml to use assets directive for Pages deploy |
| Feb 26 | `b5c762c` | fix(asset-forge): disable crashing import/order rule from root config |
| Feb 26 | `cadd3d5` | fix(asset-forge): fix ESLint crash from deprecated --ext flag |
| Feb 26 | `05c2892` | fix(shared): add procgen as devDependency for TypeScript type resolution |
| Feb 26 | `3b9c0f2` | fix(deps): fully break shared↔procgen cycle for turbo |
| Feb 25 | `8b8fa59` | Merge pull request #940 from HyperscapeAI/fix/duel-victory-emote-timing |
| Feb 25 | `6451373` | fix(duel): delay victory emote so combat cleanup doesn't override it |
| Feb 25 | `1fa595b` | Merge pull request #939 from HyperscapeAI/fix/duel-teleport-vfx |
| Feb 25 | `061e631` | Merge remote-tracking branch 'origin/main' into fix/duel-teleport-vfx |
| Feb 25 | `96e939a` | Merge pull request #938 from HyperscapeAI/tcm/instanced-arena-fire-particles |
| Feb 25 | `ceb8909` | fix(duel): fade beam base to prevent teleport VFX clipping through floor |
| Feb 25 | `c20d0fc` | perf(arena): instance arena meshes and replace dynamic lights with TSL fire particles |
| Feb 25 | `6910522` | feat(asset-forge): add VFX catalog browser tab |
| Feb 25 | `7bf0e14` | fix(duel): fix duplicate teleport VFX and forward suppressEffect to clients |
| Feb 25 | `f355276` | fix(shared): break cyclic dependency with procgen |
| Feb 25 | `8ce4819` | fix(ci): resolve macOS DMG bundling, iOS unsigned, and Windows install failures |
| Feb 25 | `14a1e1b` | fix: stabilize RTMP streaming and WebGPU renderer init |
| Feb 25 | `7c9ff6c` | fix(ci): add retry with backoff to bun install for npm 403 resilience |
| Feb 25 | `08aa151` | fix(ci): use --frozen-lockfile in all workflows to prevent npm 403 |
| Feb 25 | `c80ad7a` | fix(deploy): use bunx instead of npx in build-services.mjs |
| Feb 25 | `15250d2` | fix(ci): split Tauri builds into unsigned/release to prevent empty APPLE_CERTIFICATE crash |
| Feb 25 | `3ec9826` | fix(server): disable cloudflare origin lock preventing direct frontend api access |
| Feb 25 | `1af02ce` | fix(cf): specify pages build output dir to prevent worker deployment error |
| Feb 25 | `d21ae9b` | Merge branch 'develop' |

## Summary Statistics

**Total Commits Analyzed**: 50+ commits from February 25-26, 2026

**Lines Changed**:
- **Added**: ~5,000+ lines (new documentation, features, tests)
- **Removed**: ~3,500+ lines (dead code removal, refactoring)
- **Net**: ~1,500+ lines added

**Files Changed**: 100+ files across:
- Core engine (packages/shared/)
- Game server (packages/server/)
- Web client (packages/client/)
- Asset Forge (packages/asset-forge/)
- CI/CD workflows (.github/workflows/)
- Documentation (docs/, README.md, CLAUDE.md)

**Categories**:
- 🚀 New Features: 4 major (Maintenance Mode API, Vast.ai deployment, VFX catalog, Gold betting mobile UI)
- ⚡ Performance: 2 major (Arena rendering 97% reduction, Streaming stability)
- 🐛 Bug Fixes: 10+ (Memory leaks, CSRF, teleport VFX, type safety, WebSocket types, R2 CORS)
- 🔧 CI/CD: 8+ (npm retry, frozen lockfile, Tauri builds, dependency cycles)
- 📚 Documentation: 4 new docs + 3 major updates

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai deployment guide
- [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) - Maintenance mode API reference
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - Browser and GPU requirements
- [docs/r2-cors-configuration.md](docs/r2-cors-configuration.md) - R2 CORS setup guide
- [README.md](README.md) - Updated quick start guide
- [CLAUDE.md](CLAUDE.md) - Updated development guide
