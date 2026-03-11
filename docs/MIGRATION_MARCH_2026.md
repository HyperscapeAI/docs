# Migration Guide - March 2026 Updates

This guide covers breaking changes and migration steps for updates pushed to main in March 2026.

## Three.js 0.183.2 Upgrade

### Breaking Changes

**TSL API Change**: `atan2` has been renamed to `atan` in Three.js TSL exports.

### Migration Steps

1. **Update Three.js imports** in custom shader code:

```typescript
// ❌ Old (0.182.0)
import { atan2 } from 'three/tsl';

const angle = atan2(y, x);

// ✅ New (0.183.2)
import { atan } from 'three/tsl';

const angle = atan(y, x);
```

2. **Update package.json** if you have Three.js version pinned:

```json
{
  "dependencies": {
    "three": "0.183.2"
  },
  "overrides": {
    "three": "0.183.2"
  }
}
```

3. **Rebuild your project**:

```bash
bun run clean
bun install
bun run build
```

### Files Affected

- `packages/procgen/src/geometry/LeafMaterialTSL.ts` - Updated `atan2` → `atan`
- All packages with Three.js dependency upgraded to 0.183.2

### New Features

- **TSL Typed Node Aliases**: New type exports for better TypeScript support:
  ```typescript
  import type { TSLNodeFloat, TSLNodeVec2, TSLNodeVec3, TSLNodeVec4 } from '@hyperscape/shared';
  ```

## Environment Variable Changes

### Removed Variables

The following environment variables have been **removed** and are no longer supported:

#### Streaming Configuration (Removed)
- `STREAM_CAPTURE_DISABLE_WEBGPU` - WebGPU is now required, no fallback
- `DUEL_FORCE_WEBGL_FALLBACK` - WebGL fallback removed (WebGPU-only)
- `DUEL_CAPTURE_USE_XVFB` - Xvfb is now auto-detected on Linux
- `DUEL_DISABLE_BRIDGE_CAPTURE` - Bridge capture is now always enabled

#### Development Mode (Removed)
- `SERVER_DEV_LEAN_MODE` - Lean mode system removed entirely
- `SERVER_DEV_LEAN_ALLOW_DUEL_BETTING` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_STREAMING_DUEL` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_STREAMING_CAPTURE` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_DUEL_SCHEDULER` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_MODEL_AGENTS` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_AUTO_AGENTS` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_TERRAIN_MESH_COLLISION` - No longer needed
- `SERVER_DEV_LEAN_ALLOW_DUEL_ARENA_VISUALS` - No longer needed

#### Betting/Market Maker (Removed)
- `BOT_KEYPAIR` - Moved to hyperbet repository
- `ORACLE_AUTHORITY_KEYPAIR` - Moved to hyperbet repository
- `MARKET_MAKER_KEYPAIR` - Moved to hyperbet repository
- `DUEL_MARKET_MAKER_ENABLED` - Moved to hyperbet repository
- `ARENA_SERVICE_ENABLED` - Moved to hyperbet repository
- `DUEL_SKIP_CHAIN_SETUP` - Moved to hyperbet repository

#### Runtime Health (Removed)
- `GAME_STATE_POLL_TIMEOUT_MS` - No longer used
- `GAME_STATE_POLL_INTERVAL_MS` - No longer used
- `DUEL_RUNTIME_HEALTH_INTERVAL_MS` - No longer used
- `DUEL_RUNTIME_HEALTH_MAX_FAILURES` - No longer used

### Changed Variables

#### CDN Configuration (Unified)
```bash
# ❌ Old (deprecated)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club
DUEL_ALLOW_INHERITED_CDN_URL=true

# ✅ New (unified)
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

**Migration**: Replace all instances of `DUEL_PUBLIC_CDN_URL` with `PUBLIC_CDN_URL` in your `.env` files.

#### Streaming Configuration (Updated Defaults)
```bash
# Updated defaults (March 2026)
STREAM_CAPTURE_MODE=cdp                    # Was: mediarecorder on Linux
STREAM_CAPTURE_CHANNEL=chrome-beta         # Was: chrome-unstable
STREAM_CAPTURE_ANGLE=vulkan                # Was: default (Linux NVIDIA)
STREAM_CAPTURE_WIDTH=1280                  # Was: 1920
STREAM_CAPTURE_HEIGHT=720                  # Was: 1080
FFMPEG_PATH=ffmpeg                         # Was: /usr/bin/ffmpeg (now auto-resolved)
```

**Migration**: Remove explicit overrides if you were using defaults. The new defaults are optimized for production streaming.

#### HLS Configuration (Updated Defaults)
```bash
# Updated defaults (March 2026)
HLS_TIME_SECONDS=1                         # Was: 2
HLS_LIST_SIZE=30                           # Was: 24
HLS_DELETE_THRESHOLD=120                   # Was: 96
```

**Migration**: No action needed unless you explicitly set these values. New defaults provide better segment alignment and replay buffer.

## Streaming Pipeline Changes

### ANGLE Backend Selection

**Change**: Default ANGLE backend changed from explicit `vulkan` to `default` for automatic best-backend selection.

**Migration**:
```bash
# ❌ Old (explicit Vulkan)
STREAM_CAPTURE_ANGLE=vulkan
--use-angle=vulkan --enable-features=DefaultANGLEVulkan,Vulkan,VulkanFromANGLE

# ✅ New (auto-select)
STREAM_CAPTURE_ANGLE=default
--use-angle=default

# ✅ macOS (explicit Metal)
STREAM_CAPTURE_ANGLE=metal
--use-angle=metal
```

**Rationale**: Auto-selection provides better compatibility across different GPU configurations and driver versions.

### FFmpeg Resolution Order

**Change**: System FFmpeg is now preferred over ffmpeg-static to avoid segfaults.

**Resolution Order**:
1. `/usr/bin/ffmpeg` (system package manager)
2. `/usr/local/bin/ffmpeg` (Homebrew, manual install)
3. `ffmpeg` on PATH
4. `ffmpeg-static` npm package (fallback)

**Migration**: Install system FFmpeg for best reliability:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Vast.ai (auto-installed by deploy script)
# No action needed
```

### Chrome Channel

**Change**: Switched from Chrome Unstable to Chrome Beta for better stability.

**Migration**:
```bash
# ❌ Old
STREAM_CAPTURE_CHANNEL=chrome-unstable

# ✅ New
STREAM_CAPTURE_CHANNEL=chrome-beta
```

**Installation**:
```bash
# macOS
brew install --cask google-chrome-beta

# Linux (auto-installed by deploy script)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-beta
```

### Frame Pacing (March 11, 2026)

**Change**: Enforced 30fps frame pacing to eliminate stream buffering.

**New Behavior**:
- CDP `everyNthFrame` changed from 1→2 (halves compositor delivery from ~60fps to ~30fps)
- Frame pacing skips frames arriving faster than 85% of 33.3ms target interval
- Output resolution default changed from 1920x1080→1280x720

**Migration**: No action needed. New defaults eliminate buffering and reduce bandwidth.

**Override** (if you need higher resolution):
```bash
STREAM_CAPTURE_WIDTH=1920
STREAM_CAPTURE_HEIGHT=1080
```

## Service Worker Changes

### Cache Strategy

**Change**: Switched from `CacheFirst` to `NetworkFirst` for JS/CSS.

**Impact**: Eliminates stale module errors after rebuilds.

**Migration**: Clear browser cache after updating:
```bash
# Chrome DevTools
1. Open DevTools (F12)
2. Application tab → Storage → Clear site data
3. Hard reload (Ctrl+Shift+R / Cmd+Shift+R)

# Or use incognito mode for testing
```

### Cache Clearing (Development)

**Change**: Aggressive cache clearing added for local development.

**Behavior**: Service worker and cache buckets are automatically cleared on localhost/127.0.0.1 to prevent stale module errors.

**Migration**: No action needed. Development experience is now smoother.

## Test Infrastructure Changes

### WebGPU Test Exclusions

**Change**: `@hyperscape/impostor` excluded from headless CI test runs.

**Rationale**: WebGPU is unavailable on GitHub Actions runners. Package requires GPU-enabled browsers.

**Migration**: Run impostor tests locally:
```bash
# Local testing (requires GPU)
cd packages/impostors
bun test

# CI testing (excluded automatically)
# No action needed
```

### Test Timeouts

**Change**: Increased `sim-engine` guarded MEV fee sweep test timeout from 60s to 120s.

**Rationale**: Prevents flaky CI failures on slower runners.

**Migration**: No action needed. Tests are now more reliable.

## Deployment Changes

### SSH Session Timeout Fix

**Change**: Background processes now use `disown` to prevent SSH session timeout.

**Impact**: Vast.ai deployments complete in ~1 minute instead of hanging for 30 minutes.

**Migration**: Update `scripts/deploy-vast.sh` if you have custom deployment scripts:
```bash
# ❌ Old (hangs SSH)
Xvfb :99 -screen 0 1280x720x24 &

# ✅ New (detaches from shell)
Xvfb :99 -screen 0 1280x720x24 & disown
```

## Database Changes

### Connection Pool

**Change**: PostgreSQL connection pool increased from 10 to 20 connections.

**Rationale**: Prevents timeout errors under load.

**Migration**: No action needed. Pool size is auto-configured.

**Override** (if needed):
```bash
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
```

## Physics Optimization

### Streaming/Spectator Viewports

**Change**: Client-side PhysX initialization skipped for streaming/spectator viewports.

**Rationale**: Streaming clients don't need physics simulation - they only render world state.

**Impact**: Faster startup, reduced memory footprint for spectator views.

**Migration**: No action needed. Optimization is automatic based on URL parameters (`?page=stream`, `?mode=spectator`).

## Dependency Updates

### Major Version Bumps

- **Capacitor**: 7.6.0 → 8.2.0 (Android, iOS, Core)
- **lucide-react**: → 0.577.0
- **three-mesh-bvh**: 0.8.3 → 0.9.9
- **eslint**: → 10.0.3
- **jsdom**: → 28.1.0

**Migration**: Run `bun install` to update dependencies. No code changes required.

## Verification Checklist

After migrating, verify the following:

### Local Development
- [ ] `bun install` completes without errors
- [ ] `bun run build` succeeds
- [ ] `bun run dev` starts all services
- [ ] Game loads at http://localhost:3333
- [ ] No console errors related to Three.js or TSL
- [ ] Service worker clears cache on localhost

### Streaming (if applicable)
- [ ] `bun run dev:duel` starts streaming pipeline
- [ ] Chrome Beta is installed and detected
- [ ] FFmpeg is system-installed (not ffmpeg-static)
- [ ] ANGLE backend is set to `default` (or `metal` on macOS)
- [ ] Stream resolution is 1280x720 (or custom override)
- [ ] No buffering or frame drops on stream output
- [ ] Playwright doesn't inject `--enable-unsafe-swiftshader`

### Production Deployment
- [ ] `PUBLIC_CDN_URL` is set (not `DUEL_PUBLIC_CDN_URL`)
- [ ] Database connection pool is 20 (or custom override)
- [ ] Removed environment variables are not set
- [ ] Service worker uses `NetworkFirst` strategy
- [ ] Xvfb starts before PM2 on Linux
- [ ] Background processes use `disown` in deploy scripts

## Rollback Instructions

If you encounter issues after migrating:

### Three.js Rollback
```bash
# Revert to 0.182.0
cd packages/shared
npm install three@0.182.0 @types/three@0.182.0
cd ../client
npm install three@0.182.0
cd ../..
bun run build
```

### Environment Variable Rollback
```bash
# Restore old CDN variable (temporary)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_CDN_URL=https://assets.hyperscape.club  # Keep both during transition
```

### Streaming Rollback
```bash
# Revert to old streaming defaults
STREAM_CAPTURE_MODE=mediarecorder
STREAM_CAPTURE_CHANNEL=chrome-unstable
STREAM_CAPTURE_ANGLE=vulkan
STREAM_CAPTURE_WIDTH=1920
STREAM_CAPTURE_HEIGHT=1080
```

## Support

If you encounter migration issues:

1. Check [AGENTS.md](../AGENTS.md) for recent changes documentation
2. Review [CLAUDE.md](../CLAUDE.md) for detailed architecture notes
3. Search closed issues: https://github.com/HyperscapeAI/hyperscape/issues
4. Open a new issue with migration context and error logs

## Timeline

- **March 10, 2026**: Three.js 0.183.2 upgrade, streaming pipeline overhaul
- **March 11, 2026**: Frame pacing fix, deployment timeout fix, test infrastructure updates
