# Changelog

All notable changes to Hyperscape are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- VRM material isolation to prevent highlight bleed across mob instances (PR #1061)
- Mob AI tick processing integration into server tick loop (PR #1060)
- Comprehensive Docker build improvements for production deployments (PR #1033)

### Changed
- **BREAKING**: Upgraded Bun from 1.1.38 to 1.3.10 for Vite 6+ compatibility
- **BREAKING**: Upgraded Vite from 6.4.1 to 8.0.0
- **BREAKING**: Upgraded jsdom from 28.1.0 to 29.0.0
- **BREAKING**: Upgraded @vitejs/plugin-react from 5.2.0 to 6.0.1
- **BREAKING**: Upgraded @nomicfoundation/hardhat-ethers from 3.1.3 to 4.0.6
- Upgraded @pixiv/three-vrm from 3.4.3 to 3.5.1
- Upgraded @solana-mobile/wallet-standard-mobile from 0.4.4 to 0.5.0
- Dev server watcher now uses 5s polling interval instead of 1s (PR #1034)
- Removed redundant `awaitWriteFinish` from file watcher (PR #1034)
- Docker images now include client build for multi-service deployments
- Docker runtime now uses Bun 1.3.10 with proper workspace symlink restoration

### Fixed
- VRM mob highlight bleed where hovering one mob highlighted all mobs of same type (PR #1061)
- Mob AI state machines not transitioning from IDLE state (PR #1060)
- Dev server consuming 100% CPU when idle (PR #1034)
- Docker workspace symlinks being flattened by COPY command
- Docker builds failing with Vite 6+ due to old Bun version
- better-sqlite3 segfaults under QEMU cross-compilation in Docker

### Performance
- Reduced dev server CPU usage from 100% to near-zero when idle
- Eliminated redundant file system polling in dev watcher
- Optimized Docker build with proper layer caching

## [March 17, 2026] - VRM Material Isolation & Mob AI Fixes

### Fixed - VRM Material Isolation (PR #1061, Commit 364d0a5)

**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type. When hovering over a goblin, all goblins in the world would highlight simultaneously.

**Solution**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Technical Details**:
```typescript
// packages/shared/src/rendering/materials/cloneGLB.ts
const clonedMaterial = new MeshStandardNodeMaterial();
clonedMaterial.copy(originalMaterial);
// Copy all material properties while keeping textures shared
mesh.material = clonedMaterial;
```

**Impact**:
- Each mob instance now has independent highlight state
- Hovering over one goblin no longer highlights all goblins
- Textures remain shared for memory efficiency
- Fixes visual bug where all VRM mobs of same type would highlight together

### Fixed - Mob AI Tick Processing (PR #1060, Commit a55079e)

**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Solution**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Technical Details**:
```typescript
// packages/server/src/systems/ServerNetwork/index.ts
const MOB_AI_DELTA_SECONDS = TICK_DURATION_MS / 1000;
this.tickSystem.onTick(() => {
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof MobEntity)) continue;
    if (entity.getHealth() <= 0) continue;
    entity.runAITick(MOB_AI_DELTA_SECONDS);
  }
}, TickPriority.MOVEMENT);
```

**Impact**:
- Mob AI state machines now function correctly
- Goblins and other mobs properly transition through IDLE → WANDER → CHASE → ATTACK states
- Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)
- Fixes mobs standing idle forever after spawn

## [March 16, 2026] - Dev Server Performance Fix

### Fixed - Dev Server CPU Usage (PR #1034, Commit 7b5bf08)

**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms — redundant since the script already debounces rebuilds itself
2. Polling fallback does a full recursive directory walk every 1s

**Solution**: 
- Removed `awaitWriteFinish` option (redundant with existing 200ms debounce)
- Increased polling fallback interval from 1s to 5s

**Technical Details**:
```javascript
// packages/server/scripts/dev.mjs
const watcher = chokidar.watch(watchRoots, {
  ignoreInitial: true,
  // awaitWriteFinish removed - script already debounces via setTimeout
});

async function startPollingFallback() {
  pollFallbackInterval = setInterval(() => {
    // ... scan for changes
  }, 5000); // Was 1000ms
}
```

**Impact**:
- Eliminates 100% CPU usage when dev server is idle
- Reduces unnecessary file system polling
- Better developer experience with lower resource consumption
- No impact on rebuild responsiveness (200ms debounce still active)

## [March 15, 2026] - Docker Build Improvements

### Changed - Docker Build System (PR #1033, Commit 7519105)

**Problem**: Docker builds were failing with Vite 6+ due to old Bun version, workspace symlinks were broken, and better-sqlite3 caused segfaults under QEMU.

**Solution**: Comprehensive Dockerfile rewrite with multiple improvements:

1. **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds
2. **Client Build**: Added `packages/client` build to Docker image (required for multi-service deployments)
3. **Workspace Symlinks**: Manually recreate Bun workspace symlinks after Docker COPY (COPY flattens symlinks)
4. **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root - explicitly copy package-level node_modules
5. **better-sqlite3 Removal**: Strip from manifests before install (segfaults under QEMU cross-compilation)
6. **Manifest Embedding**: Copy manifests from builder stage to ensure cleaned versions are used

**Technical Details**:
```dockerfile
# Builder stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS builder

# Build client (required for multi-service template)
WORKDIR /app/packages/client
RUN bun run build

# Runtime stage - Bun 1.3.10
FROM oven/bun:1.3.10-alpine AS runtime

# Copy per-package node_modules (Bun 1.3 doesn't hoist)
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Restore workspace symlinks (Docker COPY flattens them)
RUN bun install --production
```

**Impact**:
- Production Docker images now build successfully with Vite 6+
- Client and server can run from same image (multi-service deployments)
- Workspace dependencies resolve correctly at runtime
- No more QEMU segfaults from better-sqlite3
- Cleaner build process with proper layer caching

## [March 19, 2026] - Dependency Updates

### Changed - Major Dependency Upgrades

**Build System**:
- **Vite**: 6.4.1 → 8.0.0 (major version bump)
  - Improved build performance
  - Better tree-shaking
  - Enhanced HMR (Hot Module Replacement)
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1
  - React 19 compatibility improvements
  - Better Fast Refresh support

**Testing**:
- **jsdom**: 28.1.0 → 29.0.0
  - Updated DOM implementation
  - Better standards compliance
  - Performance improvements

**Smart Contracts**:
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6
  - Ethers.js v6 compatibility
  - Improved type safety
  - Better error messages

**3D Avatars**:
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1
  - New VRM features
  - Performance optimizations
  - Bug fixes

**Mobile Wallet**:
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0
  - Improved mobile wallet integration
  - Better error handling
  - Updated wallet standard compliance

**Impact**:
- Latest build tooling with improved performance
- Better React 19 compatibility
- Updated testing environment
- Latest VRM avatar features
- Improved mobile wallet support

## Migration Guide

### Upgrading to Bun 1.3.10

If you're upgrading from Bun 1.1.38:

1. **Update Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   bun --version  # Should show 1.3.10 or higher
   ```

2. **Clean Install**:
   ```bash
   rm -rf node_modules packages/*/node_modules
   bun install
   ```

3. **Rebuild**:
   ```bash
   bun run build
   ```

### Upgrading to Vite 8.0.0

Vite 8.0.0 includes breaking changes:

1. **Update Dependencies**:
   ```bash
   bun install
   ```

2. **Check Vite Config**: Review `vite.config.ts` files for deprecated options
3. **Test Build**: Run `bun run build` to ensure no build errors
4. **Test Dev Server**: Run `bun run dev` to verify HMR works correctly

### Docker Deployment

If you're deploying with Docker:

1. **Rebuild Images**: The Dockerfile has changed significantly
   ```bash
   docker build -t hyperscape-server -f packages/server/Dockerfile .
   ```

2. **Update Compose**: If using docker-compose, ensure you're pulling latest images
3. **Verify Symlinks**: Check that workspace dependencies resolve correctly in container

## Known Issues

### Dev Server Watcher

- On some systems, the file watcher may fall back to polling mode
- This is expected behavior and will log a warning
- Polling interval is 5 seconds to minimize CPU usage

### Docker Builds

- Cross-platform builds (e.g., ARM on x86) may be slower due to QEMU
- better-sqlite3 is intentionally excluded to prevent segfaults
- If you need SQLite in Docker, use bun:sqlite instead

### VRM Materials

- Material cloning adds slight memory overhead per mob instance
- Textures are still shared, so impact is minimal
- If you have thousands of mobs, monitor memory usage

## Deprecations

### Removed in This Release

- **better-sqlite3**: Removed from Docker builds due to QEMU incompatibility
  - Use `bun:sqlite` or PostgreSQL instead
- **awaitWriteFinish**: Removed from dev watcher (redundant with debouncing)

### Planned Deprecations

None at this time.

## Contributors

Thank you to all contributors who helped with these releases:

- @dreaminglucid - VRM material isolation, mob AI fixes
- @mavisakalyan - Dev server performance, Docker improvements
- @lalalune - Deployment fixes, dependency updates

## Links

- [GitHub Repository](https://github.com/HyperscapeAI/hyperscape)
- [Documentation](https://github.com/HyperscapeAI/hyperscape/blob/main/AGENTS.md)
- [Issue Tracker](https://github.com/HyperscapeAI/hyperscape/issues)
- [Discord Community](https://discord.gg/hyperscape)
