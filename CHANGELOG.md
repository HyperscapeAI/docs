# Changelog

All notable changes to Hyperscape are documented in this file.

## [Unreleased] - 2026-02-26

### Added

#### Deployment & Infrastructure
- **Maintenance Mode API** - Graceful deployment coordination for streaming duel system
  - `POST /admin/maintenance/enter` - Pause new duel cycles, wait for market resolution
  - `POST /admin/maintenance/exit` - Resume normal operations
  - `GET /admin/maintenance/status` - Check current status
  - Integrated into `.github/workflows/deploy-vast.yml` for zero-downtime deployments
  - See [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md)

- **DATABASE_URL persistence** - Survives git reset operations in deployment scripts
  - Write `.env` file AFTER git reset (not before)
  - Prevents database connection loss during CI/CD

- **Vast.ai deployment improvements**
  - Vulkan driver installation for GPU rendering
  - Chrome Dev channel installation (WebGPU enabled by default)
  - Post-deploy health checking (waits up to 120s for server ready)
  - Port proxy setup (socat for internal → external mapping)

- **R2 CORS configuration** - Automated setup for cross-origin asset loading
  - `scripts/configure-r2-cors.sh` - One-command CORS setup
  - Integrated into `.github/workflows/deploy-cloudflare.yml`

#### Features
- **VFX Catalog** - Asset Forge browser for all game effects
  - Live Three.js previews with camera controls
  - Detail panels for colors, parameters, layers, phase timelines
  - Searchable catalog of combat, spell, projectile, environmental, and UI effects
  - See [docs/asset-forge-vfx-catalog.md](docs/asset-forge-vfx-catalog.md)

- **Mobile-responsive UI** - Gold betting demo overhaul
  - Resizable panels with `useResizePanel` hook
  - Mobile-first design with aspect-ratio 16/9 video
  - Bottom-sheet sidebar, touch-friendly tabs
  - Real-data integration (live SSE feed from game server)

#### Streaming
- **Multi-platform RTMP** - Twitch, Kick, X (Twitter) support
  - Removed YouTube (not needed)
  - Canonical platform set to Twitch for lower latency
  - Public delay configurable (set to 0ms for live betting)

- **Streaming stability improvements**
  - CDP stall threshold increased from 2 to 4 intervals (120s)
  - FFmpeg max restart attempts increased from 5 to 8
  - Capture recovery max failures increased from 2 to 4
  - Soft CDP recovery (restart screencast without browser/FFmpeg teardown)

### Changed

#### Rendering
- **WebGPU enforcement** - WebGL fallback removed
  - All shaders use TSL (Three.js Shading Language)
  - User-friendly error screen when WebGPU unavailable
  - Renderer limits now best-effort (retry with defaults if GPU rejects)

- **Instanced arena meshes** - 97% draw call reduction
  - ~846 individual meshes → single InstancedMesh per type
  - ~846 draw calls → ~25 draw calls

- **TSL fire particles** - GPU-driven emissive materials
  - Removed all 28 PointLights from arena
  - Enhanced fire shader with smooth value noise, soft radial falloff
  - Turbulent vertex motion for natural flame flickering

#### Security
- **JWT_SECRET enforcement** - Now required in production/staging
  - Throws error if not set (was warning only)
  - Prevents insecure deployments

- **CSRF cross-origin handling** - Apex domain support
  - Skip CSRF validation for known cross-origin clients
  - Allows Cloudflare Pages → Railway requests
  - Still protected by Origin header validation + JWT

#### Type Safety
- **Reduced explicit `any` types** - From 142 to ~46
  - Fixed tile movement types (BuildingCollisionService, ICollisionMatrix)
  - Fixed WebSocket types (use `ws` library, not browser WebSocket)
  - Fixed error handler types (`unknown` instead of `any`)
  - Added type annotations for Three.js traverse callbacks

#### CI/CD
- **Frozen lockfile** - All workflows use `bun install --frozen-lockfile`
  - Prevents npm rate limiting (403 Forbidden errors)
  - Ensures reproducible builds

- **Retry logic** - Exponential backoff for npm install
  - 5 attempts with 15s, 30s, 45s, 60s, 75s delays
  - Windows-specific retry (3 attempts, 15s delay)

- **Split unsigned/release builds** - Separate jobs for Tauri builds
  - Prevents empty APPLE_CERTIFICATE errors on unsigned builds
  - iOS build now release-only (unsigned always fails)

#### Dependencies
- **Circular dependency fix** - `shared ↔ procgen` resolved
  - `procgen` now optional peerDependency in `shared`
  - `shared` now devDependency in `procgen`
  - Breaks Turbo build cycle while preserving runtime imports

- **ESLint compatibility** - Disabled crashing `import/order` rule
  - `eslint-plugin-import@2.32.0` incompatible with ESLint 10
  - Disabled in `asset-forge` package

- **TypeScript module resolution** - `bundler` mode for Three.js WebGPU
  - Required for `three/webgpu` subpath exports
  - Changed from `node` to `bundler` in `asset-forge`

### Fixed

#### VFX
- **Duplicate teleport effects** - Was showing 3x, now shows 1x
  - Fixed race condition in `clearDuelFlagsForCycle()`
  - Proper cleanup ordering via microtask

- **Victory emote timing** - Wave emote now visible
  - Delayed by 600ms to avoid combat cleanup override
  - Reset to idle in `stopCombat()` when agents teleport

- **Teleport beam clipping** - Fade beam base to prevent floor clipping

#### Deployment
- **Vast.ai branch stuck** - Server was stuck on hackathon branch
  - Workflow now explicitly checks out main before deploy
  - Deploy script pulls from main (not hackathon)

- **Cloudflare Pages conflict** - Root wrangler.toml removed
  - Use only `packages/client/wrangler.toml`
  - Prevents Worker/Pages deployment confusion

- **R2 CORS format** - Fixed wrangler API format
  - Use nested `allowed.origins/methods/headers` structure
  - Use `exposed` array and `maxAge` integer

#### CI/CD
- **Linux/Windows builds** - Fixed "app bundle type is macOS-only" error
  - Use `--no-bundle` for unsigned builds
  - Use `--bundles app` only for macOS release builds

- **iOS unsigned builds** - Skip (always fail with "Signing requires development team")
  - iOS build job now release-only

- **npm 403 errors** - Retry logic with exponential backoff
  - Handles GitHub Actions IP rate limiting
  - Windows-specific retry (higher failure rate)

#### Type Safety
- **WebSocket types** - Use `ws` library types (not browser WebSocket)
  - Fixes missing `removeAllListeners` and `on` methods

- **Traverse callbacks** - Explicit type annotations
  - Required by TypeScript strict mode

- **Error handlers** - Use `unknown` instead of `any`
  - Proper error type narrowing

### Removed

- **WebGL fallback** - All rendering now WebGPU-only
  - Removed `RendererFactory` WebGL code path
  - Removed `?forceWebGL=1` and `?disableWebGPU=1` query params

- **YouTube streaming** - Not needed for current use case
  - Removed from ecosystem.config.cjs
  - Twitch/Kick/X remain supported

- **Dead code** - 3098 lines removed
  - `PacketHandlers.ts` (never imported)
  - `createArenaMarker`, `createAmbientDust`, `createLobbyBenches`

- **Dynamic arena lights** - All 28 PointLights removed
  - Replaced with emissive TSL materials
  - Better performance, same visual quality

## Documentation Added

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai deployment guide
- [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) - Maintenance mode API reference
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - Browser and GPU requirements
- [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md) - Cloudflare Pages setup
- [docs/streaming-configuration.md](docs/streaming-configuration.md) - RTMP streaming configuration
- [docs/asset-forge-vfx-catalog.md](docs/asset-forge-vfx-catalog.md) - VFX catalog guide
- [docs/ci-cd-improvements.md](docs/ci-cd-improvements.md) - CI/CD improvements reference
- [docs/performance-optimizations.md](docs/performance-optimizations.md) - Performance improvements

## Migration Guide

### WebGPU Migration

If you have code expecting WebGL:

**Remove:**
```typescript
// ❌ No longer supported
const renderer = await RendererFactory.create({
  fallbackToWebGL: true
});
```

**Update:**
```typescript
// ✅ WebGPU only
const renderer = await RendererFactory.create({
  canvas
});
```

**Browser requirements:**
- Chrome 113+ or Edge 113+ (all platforms)
- Safari 18+ (macOS 15+ only)

### JWT_SECRET Required

Production deployments now require JWT_SECRET:

```bash
# Generate secure secret
openssl rand -base64 32

# Set in .env
JWT_SECRET=your-generated-secret
```

### DATABASE_URL for Vast.ai

Vast.ai deployments now require DATABASE_URL:

```bash
# Add to GitHub secrets
DATABASE_URL=postgresql://user:password@host:port/database

# Or set in packages/server/.env on instance
echo "DATABASE_URL=postgresql://..." > packages/server/.env
```

## Breaking Changes

### WebGPU Required

- **WebGL no longer supported** - All users must have WebGPU-capable browser
- **Minimum browser versions** - Chrome 113+, Edge 113+, Safari 18+
- **GPU requirements** - See [docs/webgpu-requirements.md](docs/webgpu-requirements.md)

### JWT_SECRET Required in Production

- **Production/staging** - Server throws error if JWT_SECRET not set
- **Development** - Warning only (uses insecure default)

## Commit Range

This changelog covers commits from `ca18a60` (2026-02-26) to `eec04b0` (2026-02-26).

See [GitHub Commits](https://github.com/HyperscapeAI/hyperscape/commits/main) for full commit history.
