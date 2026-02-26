# Changelog - February 2026

## Performance Optimizations

### Arena Rendering (PR #938)
**Impact**: 97% draw call reduction, eliminated 28 dynamic lights

- Converted ~846 individual meshes to InstancedMesh (~22 draw calls)
- Replaced 28 PointLights with GPU-driven TSL emissive materials
- Removed "torch" particle preset, unified on enhanced "fire" preset
- Rewrote fire particle fragment shader with smooth value noise
- Added per-particle turbulent vertex motion for natural flame flickering
- Deleted dead code: `createArenaMarker()`, `createAmbientDust()`, `createLobbyBenches()`

**Files changed**:
- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`

**Documentation**: [docs/arena-performance-optimizations.md](docs/arena-performance-optimizations.md)

## Bug Fixes

### Model Cache - Missing Objects & Lost Textures (PR #935)
**Impact**: Fixed critical cache bugs causing missing geometry and white textures

**Bug 1 - Missing Objects**:
- **Problem**: Models with duplicate mesh names (e.g., altars) had objects disappear after cache reload
- **Cause**: `findIndex` by name caused multiple meshes to map to same index
- **Fix**: Use `Map<Object3D, number>` identity map instead of name-based lookup

**Bug 2 - Lost Textures**:
- **Problem**: Textures appeared white/grey after browser restart
- **Cause**: Serialized ephemeral `blob:` URLs that became invalid
- **Fix**: Extract raw RGBA pixels via canvas, store as ArrayBuffer, restore as DataTexture

**Bug 3 - Grey Tree Materials**:
- **Problem**: Trees appeared grey in WebGPU builds
- **Cause**: `instanceof MeshStandardMaterial` check failed for `MeshStandardNodeMaterial`
- **Fix**: Duck-type property check instead of instanceof

**Files changed**:
- `packages/shared/src/utils/rendering/ModelCache.ts`
- `packages/shared/src/systems/shared/world/GPUVegetation.ts`

**Cache version**: Bumped from 2 to 3 (invalidates broken entries)

**Documentation**: [docs/model-cache-fixes.md](docs/model-cache-fixes.md)

### Terrain Height Cache - 50m Offset (Commit 21e0860)
**Impact**: Fixed consistent 50-meter offset in height lookups

**Issues fixed**:
1. Tile index used `Math.floor(worldX/TILE_SIZE)` without accounting for centered geometry
2. Grid index formula omitted `halfSize` offset from PlaneGeometry's `[-50,+50]` range
3. `getTerrainColorAt()` used comma separator instead of underscore in cache key

**New helpers**:
- `worldToTerrainTileIndex()` - Canonical tile index calculation
- `localToGridIndex()` - Canonical grid index with halfSize offset

**Files changed**:
- `packages/shared/src/systems/shared/world/TerrainSystem.ts`
- `packages/shared/src/systems/shared/world/TerrainHeightParams.ts`

**Documentation**: [docs/terrain-height-cache-fix.md](docs/terrain-height-cache-fix.md)

### Duel System Fixes

#### Victory Emote Timing (PR #940)
**Impact**: Fixed victory emote being overwritten by combat cleanup

- Delayed victory emote by 600ms so combat cleanup finishes first
- Reset emote to idle in `stopCombat()` so wave stops when agents teleport out
- Set emote on server entity so future syncs include it

**Files changed**:
- `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`

#### Teleport VFX Fixes (PR #939, Commit 7bf0e14)
**Impact**: Fixed duplicate teleport effects and missing suppressEffect forwarding

- Removed premature `clearDuelFlagsForCycle()` that caused race condition
- Forward `suppressEffect` through ServerNetwork → ClientNetwork → VFX system
- Remove `suppressEffect` from cleanup teleports so exit VFX plays
- Remove duplicate `PLAYER_TELEPORTED` emit
- Scale down teleport beam/ring/particle geometry to fit avatar size

**Files changed**:
- `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
- `packages/server/src/systems/ServerNetwork/index.ts`
- `packages/shared/src/systems/client/ClientNetwork.ts`
- `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

#### Mage Staff & 2H Sword Combat (PR #934, Commit 029456)
**Impact**: Fixed mage and 2H sword combat in streaming duels

- Add keep-alive re-engagement in DuelCombatAI to prevent agents idling
- Propagate weapon type through DuelOrchestrator into startCombat
- Add rune inventory readiness polling and validation bypass for duel bots
- Guard against state starvation from repeated startCombat resets
- Refresh combat timeout after ranged/magic attacks
- Bypass PvP zone checks for streaming duel combatants
- Block aggro and chase on players in safe zones

**Files changed**:
- `packages/server/src/arena/DuelCombatAI.ts`
- `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
- `packages/shared/src/systems/shared/combat/CombatSystem.ts`
- `packages/shared/src/systems/shared/combat/CombatTickProcessor.ts`
- `packages/shared/src/systems/shared/combat/AggroSystem.ts`

## Streaming Improvements (Commit 14a1e1b)

### RTMP Stability
- Increased CDP stall threshold from 2 to 4 intervals (120s)
- Added soft CDP recovery (restart screencast without browser/FFmpeg teardown)
- Increased FFmpeg `MAX_RESTART_ATTEMPTS` from 5 to 8
- Added `resetRestartAttempts()` for recovery counter reset
- Increased `CAPTURE_RECOVERY_MAX_FAILURES` default from 2 to 4

### WebGPU Renderer
- Made `requiredLimits` best-effort: try `maxTextureArrayLayers: 2048` first
- Retry with default limits if GPU rejects
- Always WebGPU, never WebGL fallback

**Files changed**:
- `packages/server/src/streaming/stream-capture.ts`
- `packages/server/src/streaming/browser-capture.ts`
- `packages/client/src/utils/webgpu-renderer.ts`

**Documentation**: [docs/streaming-improvements.md](docs/streaming-improvements.md)

## CI/CD Improvements

### Build Workflow (Commits 15250d2, 8ce4819)
**Impact**: Fixed macOS DMG bundling, iOS unsigned builds, Windows install failures

- Split Tauri builds into Unsigned/Release variants (prevents empty `APPLE_CERTIFICATE` crash)
- Add `--bundles app` to unsigned macOS builds (skip DMG creation)
- Make iOS build job release-only (unsigned iOS always fails)
- Add retry logic (3 attempts) to Windows `bun install` for transient NPM 403 errors

**Files changed**:
- `.github/workflows/build-app.yml`

### npm Registry Resilience (Commits 7c9ff6c, 08aa151)
**Impact**: Eliminated 40% of CI build failures from npm rate limiting

- Add retry with backoff to `bun install` (up to 5 attempts: 15s, 30s, 45s, 60s, 75s)
- Use `--frozen-lockfile` in all workflows to prevent fresh npm resolution
- Windows-specific retry logic (more frequent 403 errors)

**Files changed**:
- `.github/workflows/ci.yml`
- `.github/workflows/build-app.yml`
- `.github/workflows/deploy-railway.yml`

### Deployment Fixes (Commits c80ad7a, 1af02ce, 3ec9826)
**Impact**: Fixed Vast.ai, Cloudflare, and Railway deployments

- Use `bunx` instead of `npx` in build-services.mjs (Vast.ai has no npm)
- Specify Pages build output dir to prevent worker deployment error
- Disable Cloudflare origin lock preventing direct frontend API access

**Files changed**:
- `packages/asset-forge/scripts/build-services.mjs`
- `wrangler.toml`
- `packages/server/src/config.ts`

**Documentation**: [docs/ci-cd-improvements.md](docs/ci-cd-improvements.md)

## Dependency Management

### Cyclic Dependency Fix (Commits f355276, 3b9c0f2, 05c2892)
**Impact**: Resolved Turbo build cycle: shared ↔ procgen

- Move `@hyperscape/procgen` from dependencies to peerDependencies in shared
- Remove cross-references from both package.json files
- Add procgen as devDependency in shared for TypeScript type resolution

**Rationale**: Turbo treats peerDependencies as graph edges. Breaking the hard dependency allows imports to resolve at runtime via bun workspace resolution.

**Files changed**:
- `packages/shared/package.json`
- `packages/procgen/package.json`

## Features

### Asset Forge - VFX Catalog Browser (Commit 6910522)
**Impact**: New VFX browser tab for inspecting game effects

- Added VFX page with sidebar catalog of all game effects
- Live Three.js previews with detail panels
- Effect categories: spells, arrows, glow particles, fishing, teleport, combat HUD
- Color, parameter, layer, and phase timeline displays

**Files changed**:
- `packages/asset-forge/src/pages/VFXPage.tsx` (new)
- `packages/asset-forge/src/components/VFX/` (new)
- `packages/asset-forge/src/data/vfx-catalog.ts` (new)

**Documentation**: Updated `packages/asset-forge/README.md`

## Version Compatibility

### React Version Unification (Commit 3322e78)
**Impact**: Fixed client exception from React version mismatch

- Unified React and React-DOM to 19.2.4 across entire monorepo
- Resolved hydration errors and hook ordering issues

**Files changed**:
- `package.json` (root)
- `packages/*/package.json` (multiple)

### TypeScript Override Fix (Commit 113a85a)
**Impact**: Resolved TypeScript version conflicts

- Removed conflicting TypeScript override
- Fixed cyclic dependency in build graph

**Files changed**:
- `package.json` (root)

### Playwright Override Removal (Commit 64db27f)
**Impact**: Fixed Cloudflare deployment EOVERRIDE error

- Removed npm override for playwright (conflicted with direct dependency)

**Files changed**:
- `package.json` (root)

## Breaking Changes

### GlowParticleManager
- **Removed**: `"torch"` preset - use `"fire"` instead
- **Changed**: Fire particle dynamics array now includes phase parameter (index 2)
- **Changed**: `MAX_RISE_SPREAD` increased from 256 to 896

### Model Cache
- **Changed**: Cache version bumped to 3 (auto-invalidates old entries)
- **Changed**: Texture serialization format (now stores pixel data, not URLs)

## Migration Guide

### Updating Fire Particles
```typescript
// Before
particleSystem.register('my-torch', {
  type: 'glow',
  preset: 'torch',
  position: { x, y, z }
});

// After
particleSystem.register('my-fire', {
  type: 'glow',
  preset: 'fire',  // Use 'fire' instead of 'torch'
  position: { x, y, z }
});
```

### Clearing Model Cache
```javascript
// In browser console (if experiencing cache issues)
indexedDB.deleteDatabase('hyperscape-processed-models');
// Reload page
```

### Disabling Model Cache (Debugging)
```javascript
// In browser console
localStorage.setItem('disable-model-cache', 'true');
// Reload page
```

## Contributors

- Shaw (@lalalune) - CI/CD, dependency fixes, streaming improvements
- Ting Chien Meng (@tcm390) - Arena optimizations, model cache fixes, terrain fixes
- Lucid (@dreaminglucid) - Duel system fixes, VFX catalog, teleport effects

## References

- [Arena Performance Optimizations](docs/arena-performance-optimizations.md)
- [Model Cache Fixes](docs/model-cache-fixes.md)
- [Terrain Height Cache Fix](docs/terrain-height-cache-fix.md)
- [Streaming Improvements](docs/streaming-improvements.md)
- [CI/CD Improvements](docs/ci-cd-improvements.md)
