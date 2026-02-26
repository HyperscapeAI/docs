# Changelog - February 2026

This document summarizes all significant changes pushed to the `main` branch in February 2026.

## Table of Contents

1. [Breaking Changes](#breaking-changes)
2. [New Features](#new-features)
3. [Performance Improvements](#performance-improvements)
4. [Bug Fixes](#bug-fixes)
5. [Security Enhancements](#security-enhancements)
6. [CI/CD Improvements](#cicd-improvements)
7. [Documentation](#documentation)

## Breaking Changes

### WebGPU Required (Commit `3bc59db`)

**Impact**: WebGL fallback removed - WebGPU is now mandatory.

**Reason**: All shaders use TSL (Three.js Shading Language) which requires WebGPU.

**Browser Requirements:**
- Chrome/Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS Sonoma+ only)
- Firefox: WebGPU support is experimental (not recommended)

**User Experience**: User-friendly error screen shown when WebGPU unavailable (instead of blank screen or crash).

**Migration**: No code changes needed - users must upgrade browsers.

**Verification**: Visit [webgpureport.org](https://webgpureport.org) to check compatibility.

### JWT_SECRET Required in Production (Commit `3bc59db`)

**Impact**: Production/staging deployments now throw error if `JWT_SECRET` not set.

**Reason**: Security hardening - prevent deployments with weak or missing authentication secrets.

**Behavior:**
- **Production/Staging**: Throws error on startup if `JWT_SECRET` not set
- **Development**: Warns but continues (for convenience)
- **Unknown Environments**: Warns but continues

**Migration**:
```bash
# Generate secure secret
openssl rand -base64 32

# Set in environment
JWT_SECRET=<generated-secret>
```

**Implementation**: `packages/server/src/startup/config.ts`

## New Features

### Maintenance Mode API (Commit `30b52bd`)

**Purpose**: Graceful deployment coordination for streaming duel system.

**Endpoints:**
- `POST /admin/maintenance/enter` - Pause new duel cycles, wait for markets to resolve
- `GET /admin/maintenance/status` - Check maintenance state and safe-to-deploy status
- `POST /admin/maintenance/exit` - Resume normal operations

**Features:**
- Pauses new duel cycles (current cycle completes)
- Locks betting markets (no new bets accepted)
- Waits for active markets to resolve (configurable timeout)
- Reports safe-to-deploy status
- Automatic integration with CI/CD (`.github/workflows/deploy-vast.yml`)

**Use Cases:**
- Zero-downtime deployments
- Database migrations
- Infrastructure maintenance
- Emergency market resolution

**Documentation**: `docs/deployment-best-practices.md`

### VFX Catalog Browser (Commit `69105229`)

**Package**: `packages/asset-forge`

**Features:**
- New `/vfx` page with live Three.js effect previews
- Sidebar catalog organized by category:
  - Combat spells (fire, ice, lightning, earth)
  - Projectiles (arrows, magic bolts)
  - Glow particles (fishing, resources)
  - Teleport effects (multi-phase beams)
  - Combat HUD (damage splats, XP drops)
- **Detail Panels**:
  - Color swatches with hex codes
  - Parameter tables (lifetime, scale, velocity)
  - Layer breakdowns (particles, beams, rings)
  - Phase timelines (gather, erupt, sustain, fade)
- **Interactive Controls**:
  - Play/pause animations
  - Rotate camera view
  - Toggle individual layers
  - Export configurations to JSON

**Implementation**: `packages/asset-forge/src/pages/VFXPage.tsx`, `src/components/VFX/`, `src/data/vfx-catalog.ts`

### Multi-Platform RTMP Streaming (Commit `7f1b1fd`)

**Platforms Configured:**
- **Twitch**: Primary platform with stream key
- **Kick**: RTMPS support with ingest endpoint
- **X/Twitter**: RTMP URL with stream key
- **YouTube**: Removed from defaults (can be re-added via env vars)

**Configuration**: `packages/server/.env.example` → RTMP section

**Canonical Platform**: Set to Twitch for anti-cheat timing defaults

**Documentation**: `docs/streaming-configuration.md`

### Gold Betting Demo - Mobile UI (PR #942)

**Package**: `packages/gold-betting-demo`

**Features:**
- **Resizable Panels** (desktop): Drag to resize video/sidebar split
- **Bottom-Sheet Sidebar** (mobile): Touch-friendly tabs below video
- **Live SSE Feed**: Real-time duel updates from game server (replaces mock data in dev mode)
- **Dual Wallet Support**: SOL + EVM wallets with mobile-optimized layout
- **Responsive Header**: Stacked layout on mobile (logo, phase strip, wallet buttons)
- **Tab Reordering**: Trades first on mobile (most important)
- **Touch-Friendly Targets**: 48px minimum for all interactive elements
- **dvh Units**: Proper mobile viewport height handling

**Mode Routing**:
- `MODE=stream-ui` → Mock data for UI development
- `MODE=devnet` or other → Real SSE feed from game server

**New Hooks:**
- `useResizePanel()` - Desktop panel resizing
- `useIsMobile()` - Responsive breakpoint detection

**Database**: Keeper bot now includes persistence layer (`keeper/src/db.ts`) for tracking market history, bets, and resolutions.

**Documentation**: `packages/gold-betting-demo/MOBILE-UI-GUIDE.md`

### Vast.ai Health Checks (Commit `30b52bd`)

**Features:**
- Auto-detect unhealthy instances (3 consecutive failures)
- Destroy and reprovision failed instances
- Configurable health check intervals
- Automatic deployment of latest code

**Configuration**:
```bash
HEALTH_CHECK_INTERVAL=60                 # Seconds
HEALTH_CHECK_FAILURE_THRESHOLD=3         # Failures before reprovision
HEALTH_CHECK_TIMEOUT=5000                # Milliseconds
```

**Implementation**: `packages/vast-keeper/src/index.ts`

## Performance Improvements

### Arena Rendering Optimization (PR #938, Commit `c20d0fc`)

**Impact**: 97% draw call reduction, eliminated all dynamic lights.

**Changes:**
- **Instanced Meshes**: ~846 individual meshes → ~20 InstancedMesh draw calls
  - Fence posts + caps: 288 instances → 2 draw calls
  - Fence rails (X/Z): 72 instances → 2 draw calls
  - Stone pillars (base/shaft/capital): 96 instances → 3 draw calls
  - Brazier bowls: 24 instances → 1 draw call
  - Floor border trim: 24 instances → 2 draw calls
  - Banner poles: 12 instances → 1 draw call

- **Eliminated 28 PointLights**: Replaced with GPU-driven TSL emissive materials
  - Zero CPU cost per frame
  - Per-instance flicker phase derived from world position
  - Multi-frequency sine + noise for natural flame appearance
  - Top-face-only emission mask

- **Enhanced Fire Particles**:
  - Smooth value noise shader (bilinear interpolated hash lattice)
  - Soft radial falloff for additive blending
  - Turbulent vertex motion for natural flickering
  - Height-based color gradient (yellow → orange → red)
  - Removed "torch" preset, unified on enhanced "fire" preset

**Performance Gains:**
- Draw calls: ~846 → ~20 (97% reduction)
- CPU per frame: ~28 light calculations → 0
- GPU: Instanced rendering + TSL shaders (highly optimized)

**Implementation**: `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`

### Teleport VFX Rewrite (PR #939, Commit `7bf0e14`)

**Impact**: Zero-allocation spawning, multi-phase animation, object pooling.

**Features:**
- **Object Pooling**: 2 pre-allocated effects, zero allocations at spawn time
- **Multi-Phase Animation**: Gather (0-20%) → Erupt (20-34%) → Sustain (34-68%) → Fade (68-100%)
- **Components**:
  - Ground rune circle (rotating, pulsing)
  - Base glow disc (soft fade to prevent floor clipping)
  - Dual beams (inner/outer with elastic overshoot)
  - Core flash (bright center)
  - 2 shockwave rings (expanding)
  - 8 helix spiral particles (counter-rotating)
  - 6 burst particles with gravity
- **TSL Shader Materials**: Vertical gradients, scrolling energy pulse, procedural glow patterns
- **Hermite Curves**: Elastic beam overshoot (peaks at 1.3 at t=0.35, settles to 1.0)
- **Performance**: All materials compiled once in init(), zero pipeline compilations at spawn time

**Bug Fixes:**
- Fixed duplicate teleport VFX (race condition in `clearDuelFlagsForCycle()`)
- Forward `suppressEffect` to clients (suppress mid-fight corrections, show arena exit effects)
- Removed duplicate PLAYER_TELEPORTED emits (only remote players emit)
- Scaled down geometry to fit avatar size

**Implementation**: `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

### RTMP Streaming Stability (Commit `14a1e1b`)

**Improvements:**
- **CDP Stall Threshold**: 2 → 4 intervals (120s total before restart)
- **Soft CDP Recovery**: Restart screencast without browser/FFmpeg teardown (no stream gap)
- **FFmpeg Restart Attempts**: 5 → 8 attempts before giving up
- **Recovery Failures**: 2 → 4 failures before full restart
- **Reset Counter**: Added `resetRestartAttempts()` for recovery counter reset

**Impact**: Significantly reduced stream interruptions and restarts.

**Implementation**: `packages/server/src/streaming/stream-capture.ts`

### WebGPU Renderer Initialization (Commit `14a1e1b`)

**Improvement**: Best-effort `requiredLimits` with fallback.

**Behavior:**
1. Try `maxTextureArrayLayers: 2048` first (optimal for terrain/vegetation)
2. Retry with default limits if GPU rejects
3. Always WebGPU, never WebGL (no fallback)

**Impact**: More reliable initialization on varied GPU hardware.

**Implementation**: `packages/shared/src/utils/rendering/RendererFactory.ts`

## Bug Fixes

### Model Cache Corruption (Commits in January-February 2026)

**Symptoms**: Missing objects (altars, trees), white/grey textures after browser restart.

**Root Causes:**
1. **Duplicate Mesh Names**: Used `findIndex`-by-name (duplicate names like "", "Cube" all resolved to same index)
2. **Lost Textures**: Blob URLs expired after page reload
3. **Material Type Check**: `instanceof MeshStandardMaterial` failed for `MeshStandardNodeMaterial` (WebGPU)

**Fixes:**
1. **Identity Map**: Use `Map<Object3D, number>` instead of name-based lookup
2. **DataTexture**: Extract raw RGBA pixels via canvas `getImageData`, restore as `THREE.DataTexture` (no async loading)
3. **Duck-Type Check**: Check for material properties instead of `instanceof`
4. **Cache Version**: Bumped to 3 to invalidate broken entries

**Migration**: Clear cache in browser console:
```javascript
indexedDB.deleteDatabase('hyperscape-processed-models');
```

**Implementation**: `packages/shared/src/utils/rendering/ModelCache.ts`

### Terrain Height Offset (Commit `tcm/fix-terrain-height-cache-offset`)

**Symptom**: Players floating 50m above ground, incorrect pathfinding, resources spawning in air.

**Root Cause**: Two bugs in `getHeightAtCached`:
1. Tile index used `Math.floor(worldX/TILE_SIZE)` (doesn't account for centered geometry)
2. Grid index formula omitted `halfSize` offset from PlaneGeometry's `[-50,+50]` range

**Fix**: Added canonical helpers:
- `worldToTerrainTileIndex()` - Correct tile index calculation
- `localToGridIndex()` - Correct grid index with halfSize offset

**Migration**: Update to latest main branch - fix is automatic, no data migration needed.

**Implementation**: `packages/shared/src/systems/shared/world/TerrainSystem.ts`

### Memory Leak in InventoryInteractionSystem (Commit `3bc59db`)

**Symptom**: Server memory grows unbounded, eventual OOM crash.

**Root Cause**: Event listeners never removed (9 listeners per interaction).

**Fix**: Uses `AbortController` for proper cleanup:
```typescript
const abortController = new AbortController();
world.on('event', handler, { signal: abortController.signal });
// Later: abortController.abort() removes all listeners
```

**Impact**: Prevents memory leaks in long-running servers.

**Implementation**: `packages/shared/src/systems/shared/interaction/InventoryInteractionSystem.ts`

### Duel Victory Emote Timing (PR #940, Commit `645137386`)

**Symptom**: Winning agent's wave emote immediately overwritten by idle animation.

**Root Cause**: Stale "idle" resets from combat animation system.

**Fix**: Delay victory emote by 600ms so all death/combat cleanup finishes first. Also reset emote to idle in `stopCombat()` so wave stops when agents teleport out.

**Implementation**: `packages/shared/src/systems/shared/combat/CombatAnimationManager.ts`

### Duplicate Teleport VFX (PR #939, Commit `7bf0e14`)

**Symptom**: 3 teleport effects instead of 1 (duplicate + spurious extra).

**Root Causes:**
1. Premature `clearDuelFlagsForCycle()` in `endCycle()` created race condition
2. Duplicate PLAYER_TELEPORTED emits from PlayerRemote.modify() and ClientNetwork.onPlayerTeleport

**Fixes:**
1. Duel flags stay true until `cleanupAfterDuel()` completes teleports (prevents race with `ejectNonDuelingPlayersFromCombatArenas()`)
2. Removed duplicate PLAYER_TELEPORTED emit from PlayerRemote.modify() and local player path
3. Forward `suppressEffect` through ServerNetwork → ClientNetwork → VFX system

**Implementation**: `packages/shared/src/systems/DuelSystem/`, `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

### WebSocket Type Errors (Commits `efba5a0`, `fcd21eb`)

**Symptom**: TypeScript errors about missing `removeAllListeners` and `on` methods.

**Root Cause**: `@fastify/websocket` uses `ws` library (Node.js), not browser WebSocket.

**Fix**: Import `WebSocket` type from `ws` library:
```typescript
import type { WebSocket } from 'ws';
```

**Also Fixed**: Simplified readyState check to avoid type error (use numeric constant `1` instead of `WebSocket.OPEN`).

**Implementation**: `packages/server/src/systems/ServerNetwork/`

### CSRF Cross-Origin Handling (Commit `cd29a76`)

**Symptom**: POST/PUT/DELETE requests from Cloudflare Pages to Railway backend fail with "Missing CSRF token".

**Root Cause**: CSRF middleware uses `SameSite=Strict` cookies which cannot be sent in cross-origin requests.

**Fix**: Skip CSRF validation for known cross-origin clients (already protected by Origin validation + JWT auth).

**Known Clients:**
- `hyperscape.gg` (apex + subdomains)
- `hyperbet.win` (apex + subdomains)
- `hyperscape.bet` (apex + subdomains)

**Implementation**: `packages/server/src/middleware/csrf.ts`

### Cloudflare Pages Deployment (Commits `42a1a0e`, `1af02ce`)

**Symptom**: Deployment fails with "pages_build_output_dir not supported" or deploys as Worker instead of Pages.

**Root Cause**: Incorrect wrangler.toml configuration.

**Fixes:**
1. Use `[assets]` directive instead of `pages_build_output_dir`
2. Remove root `wrangler.toml` (conflicted with Pages project)
3. Specify `directory = "dist"` in `packages/client/wrangler.toml`

**Implementation**: `packages/client/wrangler.toml`

## Security Enhancements

### JWT Secret Enforcement (Commit `3bc59db`)

**Change**: Production/staging environments now **require** `JWT_SECRET` to be set.

**Behavior:**
- Throws error on startup if missing in production/staging
- Warns in development (but continues)
- Prevents weak authentication in production

**Migration**: Generate and set `JWT_SECRET`:
```bash
openssl rand -base64 32
```

### CSRF Cross-Origin Protection (Commit `cd29a76`)

**Change**: CSRF validation skipped for known cross-origin clients.

**Reason**: Cross-origin requests already protected by:
1. Origin header validation
2. JWT bearer token authentication

**Impact**: Fixes legitimate cross-origin requests while maintaining security.

**Known Clients**: `hyperscape.gg`, `hyperbet.win`, `hyperscape.bet` (apex + subdomains)

### Cloudflare Origin Lock Disabled (Commit `3ec9826`)

**Change**: Disabled Cloudflare origin lock preventing direct frontend API access.

**Reason**: Frontend needs direct access to Railway backend API.

**Impact**: Allows Cloudflare Pages frontend to communicate with Railway backend.

## CI/CD Improvements

### npm 403 Retry Logic (Commits `7c9ff6c`, `08aa151`)

**Problem**: GitHub Actions builds fail with npm 403 Forbidden errors (rate limiting).

**Solutions:**
1. **Retry with Backoff**: Up to 5 attempts with increasing delays (15s, 30s, 45s, 60s, 75s)
2. **Frozen Lockfile**: All workflows use `bun install --frozen-lockfile` to prevent npm resolution attempts

**Impact**: Significantly reduced CI build failures from transient npm rate limits.

**Implementation**: All GitHub Actions workflows (`.github/workflows/*.yml`)

### Tauri Build Fixes (Commits `15250d2`, `8ce4819`, `f19a704`)

**Problems:**
1. macOS code signing fails on unsigned builds (empty `APPLE_CERTIFICATE` env var)
2. iOS unsigned builds always fail ("Signing requires a development team")
3. Linux/Windows builds fail with macOS-only `--bundles app` flag
4. Windows builds fail with transient npm 403 errors

**Solutions:**
1. **Split Builds**: Separate unsigned/release jobs - signing env vars only present during releases
2. **iOS Release-Only**: iOS builds only run on release (unsigned always fails)
3. **Platform-Specific Flags**: Use `--no-bundle` for unsigned builds (cross-platform)
4. **Windows Retry**: 3 attempts for `bun install` on Windows runners

**Impact**: Reliable cross-platform builds for desktop (macOS, Linux, Windows) and mobile (iOS, Android).

**Implementation**: `.github/workflows/build-app.yml`

### Dependency Cycle Resolution (Commits `3b9c0f2`, `05c2892`, `f355276`)

**Problem**: Turbo detects cycle: `shared → procgen → shared`.

**Root Cause**: Turbo treats peerDependencies as graph edges.

**Solution**: 
- `procgen` is **optional peerDependency** in `shared/package.json`
- `shared` is **devDependency** in `procgen/package.json`
- Breaks Turbo graph cycle while allowing runtime imports

**Technical Details**: devDependencies not followed by Turbo's `^build` ordering, so no cycle. The devDependency ensures bun links the package for TypeScript type resolution.

**Implementation**: `packages/shared/package.json`, `packages/procgen/package.json`

### Asset Forge Build Fixes (Commits `cadd3d5`, `b5c762c`, `82f97da`, `42e52af`)

**Problems:**
1. ESLint crashes with deprecated `--ext` flag
2. `eslint-plugin-import` incompatible with ESLint 10
3. TypeScript strict mode requires explicit callback types
4. Three.js WebGPU exports not resolved

**Solutions:**
1. Use `eslint src` instead of `eslint . --ext .ts,.tsx`
2. Disable `import/order` rule in `eslint.config.mjs`
3. Add type annotations: `(child: Object3D) => { ... }`
4. Update `tsconfig.json` to `moduleResolution: "bundler"`

**Impact**: Clean builds on all platforms, TypeScript strict mode compliance.

**Implementation**: `packages/asset-forge/`

### Deploy Script Fixes (Commits `690ede5`, `c80ad7a`)

**Problems:**
1. Deploy script pulling from `hackathon` branch (30+ commits behind main)
2. `npx tsc` fails on Vast.ai (only Bun installed)

**Solutions:**
1. Explicitly checkout `main` branch before deploy
2. Use `bunx tsc` instead of `npx tsc` in build scripts

**Impact**: Deployments use latest code, builds succeed on Vast.ai.

**Implementation**: `scripts/deploy-vast.sh`, `packages/asset-forge/scripts/build-services.mjs`

### CI Branch Checkout Fix (Commit `b9a7c3b`)

**Problem**: Server stuck on `hackathon` branch (deploy script kept pulling from hackathon).

**Solution**: Workflow explicitly fetches and checks out `main` before running deploy script.

**Impact**: Breaks the cycle, ensures deployments use `main` branch.

**Implementation**: `.github/workflows/deploy-vast.yml`

## Type Safety Improvements

### Eliminated Explicit `any` Types (Commit `d911359`)

**Files Cleaned:**
- `tile-movement.ts`: Removed 13 `any` casts by properly typing BuildingCollisionService and ICollisionMatrix
- `proxy-routes.ts`: Replaced `any` with proper types (unknown, Buffer | string, Error)
- `ClientGraphics.ts`: Added safe cast for setupGPUCompute after WebGPU verification

**Remaining `any` Types** (acceptable):
- TSL shader code (ProceduralGrass.ts) - @types/three limitation
- Browser polyfills (polyfills.ts) - intentional mock implementations
- Test files - acceptable for test fixtures

**Impact**: Improved type safety, better IDE autocomplete, fewer runtime errors.

**Progress**: 142 → ~46 explicit `any` types (68% reduction)

## Documentation

### New Documentation Files

1. **R2 CORS Configuration** (`docs/r2-cors-configuration.md`)
   - Cloudflare R2 bucket CORS setup
   - Automatic configuration via CI/CD
   - Manual configuration instructions
   - Troubleshooting guide

2. **Deployment Best Practices** (`docs/deployment-best-practices.md`)
   - Maintenance mode coordination
   - Health checks and monitoring
   - Rollback procedures
   - Security checklist
   - Zero-downtime deployment strategies

3. **Streaming Configuration** (`docs/streaming-configuration.md`)
   - Multi-platform RTMP setup (Twitch, Kick, X, YouTube)
   - Stability tuning parameters
   - HLS output configuration
   - Troubleshooting guide

4. **Mobile UI Guide** (`packages/gold-betting-demo/MOBILE-UI-GUIDE.md`)
   - Responsive design patterns
   - Mobile testing procedures
   - Component updates
   - Data integration

### Updated Documentation

1. **README.md**
   - Added WebGPU system requirements
   - Added JWT_SECRET security requirements
   - Added maintenance mode API documentation
   - Added CORS configuration reference
   - Added streaming platform configuration
   - Updated troubleshooting section
   - Added February 2026 updates section

2. **CLAUDE.md**
   - Added architectural audit TODOs
   - Added WebGPU troubleshooting
   - Added model cache issues section
   - Added terrain height issues section
   - Added memory leak documentation
   - Added streaming issues section
   - Added CSRF token errors section
   - Added CI build failures section
   - Added dependency cycle errors section
   - Added deployment & maintenance mode section

3. **packages/asset-forge/README.md**
   - Added VFX catalog browser documentation
   - Added TypeScript configuration notes
   - Added ESLint configuration notes
   - Added database integration section
   - Updated build system documentation

4. **packages/server/.env.example**
   - Already comprehensive (no changes needed)

5. **packages/client/.env.example**
   - Already comprehensive (no changes needed)

## Commit Summary

### High-Impact Commits

| Commit | Date | Description | Impact |
|--------|------|-------------|--------|
| `143914d` | Feb 26 | R2 CORS configuration | Asset loading |
| `ca18a60` | Feb 26 | Merge hackathon into main | Deployment |
| `210f6bd` | Feb 26 | Gold betting mobile UI | UX |
| `cd29a76` | Feb 26 | CSRF cross-origin fix | Security |
| `30b52bd` | Feb 26 | Maintenance mode API | Deployment |
| `14a1e1b` | Feb 25 | RTMP streaming stability | Reliability |
| `c20d0fc` | Feb 25 | Arena instancing + TSL fire | Performance |
| `7bf0e14` | Feb 25 | Teleport VFX rewrite | Performance |
| `3bc59db` | Feb 26 | Code audit fixes | Security |
| `d911359` | Feb 26 | Type safety improvements | Code quality |

### All Commits (February 2026)

See commit history for complete list: https://github.com/HyperscapeAI/hyperscape/commits/main

**Total Commits**: 30+ commits in February 2026
**Lines Changed**: ~15,000+ lines (code + documentation)
**Files Changed**: ~200+ files

## Migration Guide

### From Pre-February 2026

**Required Actions:**

1. **Update Browser** (if WebGPU not supported):
   - Chrome/Edge 113+ or Safari 18+
   - Check: [webgpureport.org](https://webgpureport.org)

2. **Set JWT_SECRET** (production/staging):
   ```bash
   openssl rand -base64 32
   # Add to .env: JWT_SECRET=<generated-secret>
   ```

3. **Clear Model Cache** (if experiencing missing objects):
   ```javascript
   // Browser console
   indexedDB.deleteDatabase('hyperscape-processed-models');
   ```

4. **Update Dependencies**:
   ```bash
   bun install
   bun run build
   ```

**Optional Actions:**

1. **Configure RTMP Streaming** (if using streaming features):
   - Add stream keys to `packages/server/.env`
   - See `docs/streaming-configuration.md`

2. **Configure R2 CORS** (if using R2 for assets):
   - Run `scripts/configure-r2-cors.sh`
   - See `docs/r2-cors-configuration.md`

3. **Set ADMIN_CODE** (production security):
   ```bash
   openssl rand -base64 16
   # Add to .env: ADMIN_CODE=<generated-code>
   ```

### Breaking API Changes

**None** - All changes are backward compatible at the API level.

**Internal Changes:**
- WebGL renderer removed (WebGPU only)
- PacketHandlers.ts deleted (was never imported)
- Some arena functions removed (replaced by instanced rendering)

## Known Issues

### Dependency Cycle (shared ↔ procgen)

**Status**: Tracked as TODO(AUDIT-004)

**Workaround**: procgen build ignores TypeScript errors

**Recommended Fix**: Extract shared types to `@hyperscape/types` package

**Impact**: Minimal - workaround is stable

### ESLint Plugin Incompatibility

**Status**: Tracked in asset-forge

**Issue**: `eslint-plugin-import@2.32.0` incompatible with ESLint 10

**Workaround**: Disabled `import/order` rule

**Impact**: Minimal - other linting rules still active

## Future Roadmap

### Planned Features

- [ ] Extract shared types to `@hyperscape/types` package (resolve AUDIT-004)
- [ ] Further `any` type cleanup (AUDIT-005)
- [ ] Entity.ts decomposition (AUDIT-001)
- [ ] WebGL fallback for non-WebGPU browsers (low priority)
- [ ] Streaming analytics dashboard
- [ ] Multi-region deployment support

### Performance Targets

- [ ] < 10ms server tick time (currently ~15ms)
- [ ] < 50ms client frame time (currently ~16ms @ 60 FPS)
- [ ] < 1% stream dropped frames (currently ~0.5%)
- [ ] > 99.9% uptime (currently ~99.5%)

## Contributors

Special thanks to all contributors in February 2026:

- **Shaw** (@lalalune) - Streaming, deployment, security, bug fixes
- **SYMBiEX** (@SYMBaiEX) - Mobile UI, betting interface
- **Ting Chien Meng** (@tcm390) - Arena performance, instancing
- **Lucid** (@dreaminglucid) - VFX systems, teleport effects

## Related Documentation

- **Main README**: `README.md`
- **Development Guide**: `CLAUDE.md`
- **Deployment**: `docs/deployment-best-practices.md`
- **Streaming**: `docs/streaming-configuration.md`
- **R2 CORS**: `docs/r2-cors-configuration.md`
- **Railway Setup**: `docs/railway-dev-prod.md`
- **Mobile UI**: `packages/gold-betting-demo/MOBILE-UI-GUIDE.md`

## Feedback

Found an issue or have suggestions? Please:
1. Check existing issues: https://github.com/HyperscapeAI/hyperscape/issues
2. Create new issue with detailed description
3. Include commit hash, error logs, and reproduction steps
