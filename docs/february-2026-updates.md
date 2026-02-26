# February 2026 Technical Updates

Comprehensive documentation of all major technical improvements, bug fixes, and new features deployed to Hyperscape in February 2026.

## Table of Contents

- [Performance & Rendering](#performance--rendering)
- [Deployment & Operations](#deployment--operations)
- [Streaming & Capture](#streaming--capture)
- [CI/CD & Build System](#cicd--build-system)
- [Bug Fixes](#bug-fixes)
- [Asset Forge](#asset-forge)
- [Breaking Changes](#breaking-changes)
- [Migration Guide](#migration-guide)

## Performance & Rendering

### Arena Performance Optimization (97% Draw Call Reduction)

**Problem**: Duel arena rendering was a major bottleneck with 28 dynamic `PointLight`s forcing expensive per-pixel lighting calculations and ~846 individual `THREE.Mesh` draw calls causing excessive GPU state changes.

**Solution**: Complete rewrite using `InstancedMesh` and GPU-driven TSL emissive materials.

**Changes**:
- **Removed all 28 dynamic `PointLight`s** - Primary FPS killer eliminated
- **Replaced with TSL emissive material** on brazier bowls - Animated flicker runs entirely on GPU via `emissiveNode` with per-instance phase offset
- **Converted ~846 meshes → ~20 `InstancedMesh` draw calls** - 97% reduction in draw calls
- **Instanced geometry**: Fence posts, caps, rails, pillar components, brazier bowls, border strips, banner poles

**Performance Impact**:
- Draw calls: ~846 → ~22 (97% reduction)
- CPU cost per frame: Near zero (GPU-driven animation)
- FPS improvement: Significant gains on mid-range GPUs

**Technical Details**:
- File: `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`
- TSL time uniform drives all brazier glow animation
- Per-instance phase offset derived from quantized world position
- Multi-frequency sine flicker + high-freq noise matches old PointLight behavior
- Only top face (fire opening) glows; outer shell stays dark

**Code Example**:
```typescript
// Old approach (28 PointLights, CPU-animated)
const light = new THREE.PointLight(0xff6600, 0.8, 6);
light.position.set(x, y, z);
// Animated in update() loop - 28 lights × 60fps = 1680 calculations/sec

// New approach (GPU-driven TSL emissive)
mat.emissiveNode = Fn(() => {
  const wp = positionWorld;
  const quantized = vec2(tslFloor(wp.x.add(0.5)), tslFloor(wp.z.add(0.5)));
  const phase = tslHash(quantized).mul(6.28);
  const flicker = sin(t.mul(10.0).add(phase)).mul(0.15)
    .add(sin(t.mul(7.3).add(phase.mul(1.7))).mul(0.08));
  const noise = fract(sin(t.mul(43.7).add(phase)).mul(9827.3)).mul(0.05);
  const intensity = float(0.6).add(flicker).add(noise);
  const topMask = smoothstep(float(0.7), float(0.95), normalWorld.y);
  return vec3(1.0, 0.4, 0.0).mul(intensity).mul(topMask);
})();
```

### Enhanced Fire Particle Shader

**Problem**: Old fire particles used simple radial falloff, creating hard edges and unrealistic flame appearance.

**Solution**: Complete rewrite with smooth value noise, soft radial falloff, and per-particle turbulent motion.

**Changes**:
- **Removed `"torch"` preset** - Unified all fire emitters on enhanced `"fire"` preset
- **Smooth value noise** - Bilinear interpolated hash lattice for organic flame shapes
- **Soft radial falloff** - Designed for additive blending, overlapping particles merge into cohesive flame body
- **Per-particle turbulent vertex motion** - Natural flickering via time-based sine/cosine offsets
- **Height-based color gradient** - White-yellow core → orange-red tips
- **Increased particle count** - 18 → 28 particles per emitter for fuller flames

**Technical Details**:
- File: `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`
- Fragment shader uses scrolling noise for organic edges and upward motion feel
- Noise modulates mask - wispy edges but keeps 70%+ base intensity
- Age-based fade: hold brightness then drop at end of life
- Core color blending: bright core fading to particle color at edges/top

**Visual Comparison**:
- Before: Hard-edged particles, visible individual sprites, static appearance
- After: Cohesive flame body, organic flickering, natural upward motion

### Model Cache Fixes

**Problem 1 - Missing Objects**: Models with duplicate mesh names (common: "", "Cube", "Cube") had only the last reference survive deserialization. Three.js `add()` auto-removes from previous parent, so hierarchy nodes all resolved to the same index.

**Solution**: Use `Map<Object3D, number>` identity map built during traversal instead of `findIndex`-by-name.

**Problem 2 - Lost Textures**: Textures were serialized as ephemeral `blob:` URLs but never reloaded during deserialization, causing white/grey materials after browser restart.

**Solution**: Extract raw RGBA pixels via canvas `getImageData` (synchronous) and restore as `THREE.DataTexture` - no async loading race conditions.

**Additional Fixes**:
- Grey tree materials: `createDissolveMaterial` used `instanceof MeshStandardMaterial` which fails for `MeshStandardNodeMaterial` in WebGPU build - replaced with duck-type property check
- Cache bypass: `localStorage.setItem('disable-model-cache', 'true')` to bypass cache for debugging
- Error logging on IndexedDB put/transaction failures
- Bumped `PROCESSED_CACHE_VERSION` to 3 to invalidate broken entries

**Technical Details**:
- Commit: `c98f1cce4240b5d4d7a459f60f47a927fe606d2b`
- Files: Model serialization/deserialization in shared package
- No migration needed - cache rebuilds automatically on first load

### Terrain Height Cache Fix

**Problem**: `getHeightAtCached` had two bugs causing a consistent 50m offset in height lookups:
1. Tile index used `Math.floor(worldX/TILE_SIZE)` which doesn't account for centered geometry
2. Grid index formula omitted the `halfSize` offset from `PlaneGeometry`'s `[-50,+50]` range

**Solution**: Added canonical helpers `worldToTerrainTileIndex()` and `localToGridIndex()` and fixed `getHeightAtCached` + `getTerrainColorAt` (which also had a comma-vs-underscore key typo preventing it from ever finding tiles).

**Impact**:
- Players no longer float 50m above ground
- Pathfinding works correctly
- Resources spawn at correct heights
- No migration needed - fix is automatic on update

**Technical Details**:
- Commit: `21e0860993131928edf3cd6e90265b0d2ba1b2a7`
- Files: Terrain system height cache
- Co-authored with Cursor

## Deployment & Operations

### Maintenance Mode API

**Purpose**: Graceful deployment coordination for streaming duel system. Prevents data loss and market inconsistency during deployments.

**How It Works**:
1. Pauses new duel cycles (current cycle completes)
2. Locks betting markets (no new bets accepted)
3. Waits for current market to resolve (up to configurable timeout)
4. Reports "safe to deploy" status
5. Resumes operations after deployment

**API Endpoints** (require `ADMIN_CODE` authentication):

```bash
# Enter maintenance mode
POST /admin/maintenance/enter
Headers: x-admin-code: your-admin-code
Body: {"reason": "deployment", "timeoutMs": 300000}

# Check status
GET /admin/maintenance/status
Headers: x-admin-code: your-admin-code

# Exit maintenance mode
POST /admin/maintenance/exit
Headers: x-admin-code: your-admin-code
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

**Commit**: `30b52bd90a64de8fe34d89b80213b7fa08e618bb`

### Vast.ai Health Checks & Auto-Recovery

**New Features**:
- Auto-detect unhealthy instances via `/health` endpoint polling
- Destroy and reprovision when failures exceed threshold
- Configurable health check intervals
- Better logging with timestamps

**Deployment Flow**:
1. CI triggers on successful main branch builds
2. System enters maintenance mode (pauses new duel cycles)
3. Waits for active markets to resolve (up to 5 minutes)
4. Deploys latest code via SSH
5. Waits for server health check (up to 5 minutes, 30 attempts)
6. Exits maintenance mode and resumes operations

**Required GitHub Secrets**:
- `VAST_HOST` - Vast.ai instance IP
- `VAST_PORT` - SSH port
- `VAST_SSH_KEY` - SSH private key
- `VAST_SERVER_URL` - Public server URL (e.g., https://hyperscape.gg)
- `ADMIN_CODE` - Admin authentication code

**Improvements**:
- Vulkan driver installation for GPU rendering
- Post-deploy health check with retry logic
- Better error handling and logging

**Files**:
- `.github/workflows/deploy-vast.yml`
- `scripts/deploy-vast.sh`
- `packages/vast-keeper/src/index.ts`

## Streaming & Capture

### RTMP Streaming Stability Improvements

**Problems**:
- CDP stall threshold too aggressive (2 intervals = 60s)
- FFmpeg crashes causing stream gaps
- WebGPU initialization failures in headless environments (Docker, vast.ai)

**Solutions**:

**1. Increased Stability Thresholds**:
```bash
# packages/server/.env
CDP_STALL_THRESHOLD=4                    # Was: 2 (now 120s before restart)
FFMPEG_MAX_RESTART_ATTEMPTS=8            # Was: 5
CAPTURE_RECOVERY_MAX_FAILURES=4          # Was: 2
```

**2. Soft CDP Recovery**:
- Restarts screencast without browser/FFmpeg teardown
- No stream gap during recovery
- Resets restart attempt counter on successful recovery

**3. WebGPU Best-Effort Initialization**:
- Tries `maxTextureArrayLayers: 2048` first
- Retries with default limits if GPU rejects
- Always WebGPU, never WebGL (unless explicitly disabled)

**4. WebGL Fallback for Headless Environments**:
```bash
# Force WebGL fallback (reliable software rendering)
STREAM_CAPTURE_DISABLE_WEBGPU=true

# Or use query params
?page=stream&forceWebGL=1
?page=stream&disableWebGPU=1
```

**5. Swiftshader ANGLE Backend**:
- `ecosystem.config.cjs` uses swiftshader backend for reliable software rendering
- Works in Docker/vast.ai where WebGPU often fails

**Technical Details**:
- Commit: `14a1e1bbe558c0626a78f3d6e93197eb2e5d1a96`
- Files:
  - `packages/server/src/streaming/stream-capture.ts`
  - `packages/server/src/streaming/browser-capture.ts`
  - `packages/shared/src/utils/rendering/RendererFactory.ts`
  - `ecosystem.config.cjs`

**RendererFactory Changes**:
```typescript
// Best-effort WebGPU init with fallback
try {
  requiredLimits = { maxTextureArrayLayers: 2048 };
  adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice({ requiredLimits });
} catch (err) {
  // Retry with default limits
  requiredLimits = {};
  device = await adapter.requestDevice({ requiredLimits });
}

// WebGL fallback when WebGPU disabled
if (forceWebGL || disableWebGPU || !navigator.gpu) {
  return new THREE.WebGLRenderer({ canvas, ...options });
}
```

### Teleport VFX Improvements

**Changes**:
- Fixed duplicate teleport VFX from race condition in `clearDuelFlagsForCycle()`
- Forward `suppressEffect` through ServerNetwork → ClientNetwork → VFX system
- Mid-fight proximity corrections suppressed, arena exit effects visible
- Scaled down teleport beam/ring/particle geometry to fit avatar size
- Removed duplicate `PLAYER_TELEPORTED` emit from `PlayerRemote.modify()`

**Technical Details**:
- Commit: `7bf0e14357be0022a4fa728c6bf9d6f0287b5b14`
- Flags now stay true until `cleanupAfterDuel()` completes teleports via microtask
- `suppressEffect` parameter properly propagated through network layers

### Victory Emote Timing Fix

**Problem**: Winning agent's wave emote was immediately overwritten by stale "idle" resets from combat animation system.

**Solution**: Delay victory emote by 600ms so all death/combat cleanup finishes first. Also reset emote to idle in `stopCombat` so wave stops when agents teleport out.

**Technical Details**:
- Commit: `645137386212208a7472ffd04aef9391394b5f65`
- File: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
- Sets `entity.data.emote = "victory"` on server entity for future sync
- Broadcasts `entityModified` with victory emote after 600ms delay

## CI/CD & Build System

### npm Retry Logic for Rate Limiting

**Problem**: npm rate-limits GitHub Actions IP ranges, causing intermittent 403 Forbidden errors during `bun install`.

**Solution**: Automatic retry with exponential backoff (15s, 30s, 45s, 60s, 75s) - up to 5 attempts.

**Implementation**:
```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: |
    for i in {1..5}; do
      bun install --frozen-lockfile && break
      echo "Install failed, retrying in $((i*15))s..."
      sleep $((i*15))
    done
```

**Commits**:
- `7c9ff6c1086737d462998ee0507be3fedbcad118` - Initial retry logic
- `08aa151393ea0eb5b25dace6eb9e328946bf2e2f` - Frozen lockfile enforcement

### Frozen Lockfile Enforcement

**Problem**: `bun install` without `--frozen-lockfile` tries to resolve packages fresh from npm, triggering rate-limiting under CI load.

**Solution**: All workflows now use `bun install --frozen-lockfile` to ensure bun uses only the committed lockfile for resolution.

**Impact**: Eliminates npm resolution attempts that trigger 403 errors.

**Files Updated**:
- `.github/workflows/ci.yml`
- `.github/workflows/build-app.yml`
- `.github/workflows/deploy-vast.yml`
- All other workflow files

### Tauri Build Fixes

**Problem 1 - macOS Unsigned Builds**: Using `--bundles app` (macOS-only bundle type) caused Linux/Windows builds to fail.

**Solution**: Use `--no-bundle` for unsigned builds to produce raw binaries on all platforms.

**Problem 2 - iOS Builds**: Unsigned iOS builds always fail with "Signing requires a development team".

**Solution**: Make iOS build job release-only - skip unsigned builds entirely.

**Problem 3 - Windows Install Failures**: Transient NPM registry 403 errors on Windows runners.

**Solution**: Add retry logic (3 attempts) to `bun install` step on Windows.

**Problem 4 - Signing Env Vars**: `tauri-bundler` attempts macOS code signing whenever `APPLE_CERTIFICATE` env var exists, even if empty.

**Solution**: Split Desktop, iOS, and Android build steps into separate Unsigned and Release variants so signing env vars are only present during actual releases.

**Technical Details**:
- Commit: `f19a7042571d84e741a3a57cb6e9d8b93eb8a094`
- Commit: `8ce4819a0bdb5a99551ef9ba423fd96262a4f22c`
- Commit: `15250d266042f43c6faa7f640fc77af1b9a83e03`
- File: `.github/workflows/build-app.yml`

**Build Matrix**:
```yaml
# Unsigned builds (development)
- platform: macos-latest
  args: --no-bundle  # Produces .app only, no DMG

# Release builds (tagged versions)
- platform: macos-latest
  args: --bundles app,dmg  # Full signed release
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
```

### Dependency Cycle Resolution

**Problem**: Turbo detected cyclic dependency: `shared` → `procgen` → `shared`. Turbo treats `peerDependencies` as graph edges in workspace monorepos.

**Solution**: 
- `procgen` is an **optional peerDependency** in `shared/package.json`
- `shared` is a **devDependency** in `procgen/package.json`

**Why This Works**:
- `devDependencies` are not followed by Turbo's `^build` topological ordering (no cycle)
- The devDependency in procgen ensures bun links the package so TypeScript can find `@hyperscape/procgen` module declarations during type checking
- Both packages are always installed together in the workspace, so imports resolve at runtime

**Technical Details**:
- Commit: `f355276637d36e3ebe1914d900acc36eeb3d42fa`
- Commit: `3b9c0f2a671db13bff08655e64c71352a50b3a18`
- Commit: `05c2892e373d05b679c9cdde9ead7f1ad85105d7`

**Verification**:
```bash
# Check shared/package.json
cat packages/shared/package.json | grep procgen
# Should show: "peerDependencies": { "@hyperscape/procgen": "workspace:*" }

# Check procgen/package.json
cat packages/procgen/package.json | grep shared
# Should show: "devDependencies": { "@hyperscape/shared": "workspace:*" }
```

## Bug Fixes

### Duel Combat Fixes

**Problem**: Mage staff and 2H sword combat broken in streaming duels due to:
1. Agents idling when combat state times out (2H sword issue)
2. Weapon type not propagated through `DuelOrchestrator` into `startCombat`
3. Rune inventory not ready for mage attacks
4. State starvation from repeated `startCombat` resets on slow weapons

**Solution**:
- Add keep-alive re-engagement in `DuelCombatAI` to prevent agents idling
- Propagate weapon type (mage/ranged/melee) through `DuelOrchestrator` into `startCombat`
- Add rune inventory readiness polling and rune validation bypass for duel bot agents
- Guard against state starvation from repeated `startCombat` resets
- Refresh combat timeout after ranged/magic attacks in both `CombatSystem` and `CombatTickProcessor`
- Bypass PvP zone checks for streaming duel combatants
- Block aggro and chase on players in safe zones via `AggroSystem`

**Technical Details**:
- Commit: `029456255c5af67e95ca1137d11977fb2c1f5ff9`
- Files:
  - `packages/server/src/arena/DuelCombatAI.ts`
  - `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
  - `packages/shared/src/systems/shared/combat/CombatSystem.ts`
  - `packages/shared/src/systems/shared/combat/CombatTickProcessor.ts`
  - `packages/shared/src/systems/shared/combat/AggroSystem.ts`

### Cloudflare Deployment Fixes

**Problem 1**: Root `wrangler.toml` named "hyperscape-betting" conflicted with "hyperscape" Pages project.

**Solution**: Remove root `wrangler.toml`. Correct Pages configuration is in `packages/client/wrangler.toml`.

**Problem 2**: `pages_build_output_dir` directive not working with `wrangler deploy`.

**Solution**: Switch to `[assets]` directive which works better with static asset hosting.

**Problem 3**: Cloudflare origin lock preventing direct frontend API access.

**Solution**: Disable origin lock to allow direct access.

**Technical Details**:
- Commits: `1af02ce112d00e0780cb8511a271c82bc5d61ac8`, `42a1a0e45c4617b101e1d08681ed1ef0715e7508`, `3ec98268de142ebafbbdf93c2d6299e73e2762da`
- File: `packages/client/wrangler.toml`

**Updated wrangler.toml**:
```toml
name = "hyperscape"
compatibility_date = "2024-01-01"

[assets]
directory = "dist"
```

## Asset Forge

### VFX Catalog Browser

**New Feature**: VFX page in Asset Forge with sidebar catalog of all game effects and live Three.js previews.

**Includes**:
- Spells (magic attacks, teleport, combat HUD)
- Arrows (ranged projectiles)
- Glow particles (fire, altar, healing)
- Fishing effects
- Teleport VFX
- Combat HUD elements

**Detail Panels**:
- Color swatches for all effect colors
- Parameter tables (lifetime, speed, scale, etc.)
- Layer breakdowns (pillar, wisp, spark, base, riseSpread)
- Phase timelines for multi-phase effects

**Technical Details**:
- Commit: `69105229a905d1621820c119877e982ea328ddb6`
- Files:
  - `packages/asset-forge/src/pages/VFXPage.tsx`
  - `packages/asset-forge/src/components/VFX/VFXPreview.tsx`
  - `packages/asset-forge/src/components/VFX/EffectDetailPanel.tsx`
  - `packages/asset-forge/src/data/vfx-catalog.ts`

### Asset Forge Build Fix

**Problem**: Vast.ai deployment container only has bun installed, not npm/npx. Using `npx tsc` in `build-services.mjs` failed.

**Solution**: Use `bunx tsc` instead of `npx tsc`.

**Technical Details**:
- Commit: `c80ad7a273cf54a3cc3ab454aa28f57df5474fc7`
- File: `packages/asset-forge/scripts/build-services.mjs`

### ESLint Fixes

**Problem 1**: `eslint . --ext .ts,.tsx` uses deprecated `--ext` flag and lints entire directory, causing `eslint-plugin-import`'s `import/order` rule to crash.

**Solution**: Use `eslint src` instead, matching other packages in monorepo.

**Problem 2**: `eslint-plugin-import@2.32.0` incompatible with ESLint 10 - `import/order` rule uses removed `sourceCode.getTokenOrCommentBefore` API.

**Solution**: Disable cascaded rule in asset-forge's flat config.

**Technical Details**:
- Commits: `cadd3d50430df478540f070a591b9d9fedd35a29`, `b5c762c986a98e15371e3776842a6bbc7d9b55f5`
- File: `packages/asset-forge/eslint.config.mjs`

## Breaking Changes

### Removed Features

1. **`"torch"` particle preset** - Removed in favor of unified `"fire"` preset
   - **Migration**: Change all `preset: "torch"` to `preset: "fire"` in particle registrations
   - **Impact**: Minimal - fire preset now handles all flame effects with better quality

2. **Dead code removal** - Removed unused functions:
   - `createArenaMarker()` - Arena number markers (unused)
   - `createAmbientDust()` - Ambient dust particles (unused)
   - `createLobbyBenches()` - Lobby bench geometry (unused)

### API Changes

**Maintenance Mode Endpoints** (New):
- `POST /admin/maintenance/enter`
- `GET /admin/maintenance/status`
- `POST /admin/maintenance/exit`

**Health Endpoint** (Modified):
- Now includes `maintenanceMode` field in response

## Migration Guide

### Updating from Pre-February 2026

**1. Model Cache Issues**:
```javascript
// Clear corrupted cache in browser console
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page - cache will rebuild with fixed serialization
```

**2. Terrain Height Issues**:
- No action needed - update to latest main branch
- Fix is automatic, no migration required

**3. Streaming Configuration**:
```bash
# Update packages/server/.env for better stability
CDP_STALL_THRESHOLD=4                    # Increase from 2
FFMPEG_MAX_RESTART_ATTEMPTS=8            # Increase from 5
CAPTURE_RECOVERY_MAX_FAILURES=4          # Increase from 2

# For headless environments (Docker, vast.ai)
STREAM_CAPTURE_DISABLE_WEBGPU=true       # Force WebGL fallback
```

**4. Particle Presets**:
```typescript
// Old
particleSystem.register(emitterId, {
  type: "glow",
  preset: "torch",  // ❌ No longer exists
  position: { x, y, z },
});

// New
particleSystem.register(emitterId, {
  type: "glow",
  preset: "fire",  // ✅ Use unified fire preset
  position: { x, y, z },
});
```

**5. CI/CD Workflows**:
- No action needed if using standard workflows
- Custom workflows should add `--frozen-lockfile` to `bun install`
- Tauri builds should split unsigned/release jobs

**6. Dependency Cycles**:
- No action needed - already fixed in package.json files
- If you see Turbo cycle errors, verify package.json configurations match the pattern above

## Environment Variables

### New Variables

**Streaming Stability** (`packages/server/.env`):
```bash
CDP_STALL_THRESHOLD=4                    # CDP stall intervals before restart (default: 4)
FFMPEG_MAX_RESTART_ATTEMPTS=8            # Max FFmpeg restart attempts (default: 8)
CAPTURE_RECOVERY_MAX_FAILURES=4          # Max recovery failures before giving up (default: 4)
STREAM_CAPTURE_DISABLE_WEBGPU=true       # Force WebGL fallback for headless (default: false)
```

**Maintenance Mode** (used by CI/CD):
- Controlled via API endpoints, not environment variables
- Requires `ADMIN_CODE` to be set in production

### Updated Defaults

**Build Order** (`turbo.json`):
1. `physx-js-webidl` - PhysX WASM
2. `procgen` - Procedural generation library (new position)
3. `shared` - Core engine (depends on physx-js-webidl and procgen)
4. All other packages - Depend on shared

## Performance Benchmarks

### Arena Rendering

**Before**:
- Draw calls: ~846
- PointLights: 28 (CPU-animated at 60fps)
- FPS: Variable, drops on mid-range GPUs

**After**:
- Draw calls: ~22 (97% reduction)
- PointLights: 0 (GPU-driven TSL emissive)
- FPS: Stable, significant improvement

### Fire Particles

**Before**:
- Particle count: 18 per emitter
- Shader: Simple radial falloff
- Appearance: Hard edges, visible individual sprites

**After**:
- Particle count: 28 per emitter
- Shader: Smooth value noise + soft radial falloff + turbulent motion
- Appearance: Cohesive flame body, organic flickering

## Known Issues & Workarounds

### Model Cache

**Issue**: Corrupted cache from pre-February 2026 builds causes missing objects or white textures.

**Workaround**:
```javascript
// Clear cache in browser console
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page
```

**Permanent Fix**: Update to latest main branch (cache version bumped to 3).

### Streaming in Headless Environments

**Issue**: WebGPU often fails in Docker/vast.ai containers.

**Workaround**:
```bash
# Force WebGL fallback
STREAM_CAPTURE_DISABLE_WEBGPU=true
```

**Alternative**: Use query params `?page=stream&forceWebGL=1`

### CI npm 403 Errors

**Issue**: Transient npm rate limiting on GitHub Actions.

**Workaround**: Retry logic is automatic (up to 5 attempts). If persistent, check GitHub Actions logs and wait for rate limit window to reset.

## Testing

### New Test Coverage

**Arena Performance**:
- Visual regression tests for instanced rendering
- Draw call count verification
- FPS benchmarks

**Model Cache**:
- Duplicate mesh name serialization tests
- Texture persistence tests
- Cache version migration tests

**Terrain Heights**:
- Height cache offset tests
- Canonical helper function tests
- Integration tests for player positioning

**Streaming**:
- CDP recovery tests
- WebGPU fallback tests
- FFmpeg restart tests

## Documentation Updates

### Files Updated

1. **README.md**:
   - Added maintenance mode API documentation
   - Added Vast.ai deployment flow
   - Added troubleshooting for model cache, terrain heights, streaming, CI builds
   - Added "Recent Updates (February 2026)" section

2. **CLAUDE.md**:
   - Added model cache troubleshooting
   - Added terrain height troubleshooting
   - Added streaming issues troubleshooting
   - Added CI build failures troubleshooting
   - Added dependency cycle troubleshooting
   - Added maintenance mode documentation
   - Updated build dependency graph (added procgen)

3. **packages/server/.env.example**:
   - Already comprehensive, no updates needed

4. **packages/client/.env.example**:
   - Already comprehensive, no updates needed

5. **docs/railway-dev-prod.md**:
   - Already comprehensive, no updates needed

6. **This file** (`docs/february-2026-updates.md`):
   - New comprehensive technical documentation

## Related Pull Requests

- #940 - Victory emote timing fix
- #938 - Arena performance optimization (instancing + TSL)
- #935 - Model cache fixes (missing objects + lost textures)

## Contributors

- Shaw (@lalalune) - Deployment, CI/CD, streaming, dependency fixes
- Ting Chien Meng (@tcm390) - Arena performance optimization, terrain height fix
- Lucid (@dreaminglucid) - VFX improvements, teleport fixes, victory emote timing

## Additional Resources

- [Maintenance Mode Implementation](../packages/server/src/startup/maintenance-mode.ts)
- [Arena Visuals System](../packages/shared/src/systems/client/DuelArenaVisualsSystem.ts)
- [Glow Particle Manager](../packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts)
- [Deploy Vast Workflow](../.github/workflows/deploy-vast.yml)
- [Build App Workflow](../.github/workflows/build-app.yml)
