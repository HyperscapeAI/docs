# AGENTS.md

Instructions for AI coding assistants (GitHub Copilot, Cursor, etc.) working with this codebase.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement. DO NOT:
- Add WebGL fallback code
- Use `--disable-webgpu` flags
- Use `forceWebGL` parameters
- Create headless Chrome configurations without GPU/WebGPU support
- Suggest WebGL as an alternative

### Why WebGPU-Only?
- All materials use TSL (Three Shading Language) which ONLY works with WebGPU
- Post-processing effects use TSL-based node materials
- There is NO WebGL fallback path - the game simply won't render

### Browser Requirements
- Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- WebGPU must be available and working
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### Server/Streaming (Vast.ai)
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- Must run non-headless with Xorg or Xvfb (WebGPU requires window context)
- **Chrome Beta Channel**: Use `google-chrome-beta` for WebGPU streaming (better stability than Dev/Canary)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- If WebGPU cannot initialize, deployment MUST FAIL

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on Three.js WebGPURenderer with TSL shaders.

## CRITICAL: Secrets and Private Keys

**Never put private keys, seed phrases, API keys, tokens, RPC secrets, or wallet secrets into any file that could be committed.**

- ALWAYS use local untracked `.env` files for real secrets
- NEVER hardcode secrets in source files, tests, docs, JSON fixtures, scripts, config files, or workflow YAML
- NEVER put real secrets in `.env.example`; placeholders only
- If a secret is needed in production or CI, use the platform secret store, not a tracked file
- If a task requires a new secret, document the variable name and load it from `.env`, `.env.local`, or deployment secrets

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces
6. **Secrets stay out of git** - Real keys must only come from local `.env` files or secret managers

## Tech Stack

- Runtime: Bun v1.1.38+
- Rendering: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- Engine: Three.js 0.183.2, PhysX (WASM)
- UI: React 19.2.0
- Server: Fastify, WebSockets
- Database: PostgreSQL (production, connection pool: 20), Docker (local)
- Testing: Vitest 4.x (upgraded from 2.x for Vite 6 compatibility), Playwright (WebGPU-enabled browsers only)
- AI: ElizaOS `alpha` tag (aligned with latest alpha releases)
- Streaming: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- Mobile: Capacitor 8.2.0 (Android, iOS)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
bun run duel         # Full duel stack (game + agents + streaming)
npm test             # Run tests
```

## File Structure

```
packages/
├── shared/          # Core engine (ECS, Three.js, PhysX, networking, React UI)
├── server/          # Game server (Fastify, WebSockets, PostgreSQL)
├── client/          # Web client (Vite + React)
├── plugin-hyperscape/ # ElizaOS AI agent plugin
├── physx-js-webidl/ # PhysX WASM bindings
├── procgen/         # Procedural generation
├── asset-forge/     # AI asset generation + VFX catalog
├── duel-oracle-evm/ # EVM duel outcome oracle contracts
├── duel-oracle-solana/ # Solana duel outcome oracle program
└── contracts/       # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

## Recent Changes (March 2026)

### Streaming Frame Pacing Fix (March 11, 2026)

**Change** (Commits 522fe37, e2c9fbf): Enforced 30fps frame pacing to eliminate stream buffering.

**Problem**: CDP screencast was delivering frames at ~60fps while FFmpeg expected 30fps input, causing buffer buildup and viewer lag. Initial fix (522fe37) set `everyNthFrame: 2` to halve compositor delivery, but this was incorrect - Xvfb compositor runs at 30fps (no vsync), not 60fps.

**Fix**:
- **Reverted everyNthFrame to 1** (commit e2c9fbf) - Xvfb compositor delivers at 30fps, so no frame skipping needed
- **Frame Pacing Guard**: Skip frames arriving faster than 85% of the 33.3ms target interval (prevents burst-feeding FFmpeg)
- **Output Resolution**: Default changed from 1920x1080→1280x720 to match capture viewport and eliminate unnecessary upscaling

**Configuration**:
```bash
# New defaults in ecosystem.config.cjs
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
```

**Technical Details**:
- Xvfb runs at 30fps without vsync (game is capped at 30fps)
- `everyNthFrame: 2` would halve 30fps delivery to 15fps, causing FFmpeg underflow
- Frame pacing guard handles edge cases where compositor exceeds TARGET_FPS
- 1280x720 matches capture viewport, eliminating upscaling overhead

**Impact**: Eliminates stream buffering, smoother playback for viewers, reduced bandwidth usage, correct frame delivery rate (30fps).

### BankTabBar Test Updates (March 11, 2026)

**Change** (Commits 297539f, be2503f): Fixed BankTabBar tests to be environment-agnostic for color formats.

**Problem**: Tests were failing due to browser differences in CSS color representation (hex vs rgb).

**Fix**: Updated test assertions to handle both hex and rgb color formats, matching the gradient background style.

**Impact**: More reliable tests across different browser environments.

### Test Infrastructure Updates (March 11, 2026)

**Change** (Commit cd253d5, 97b7a4e): Fixed monorepo test failures and excluded WebGPU-dependent packages from CI.

**Key Changes**:
- **CI Test Exclusions**: Excluded `@hyperscape/impostor` from headless CI test runs (requires WebGPU, unavailable on GitHub Actions runners)
- **Test Timeouts**: Increased `sim-engine` guarded MEV fee sweep test timeout from 60s to 120s to prevent flaky CI failures
- **Cyclic Dependencies**: Resolved circular dependency issues in monorepo package structure
- **Port Conflicts**: Fixed port allocation conflicts between test suites

**Impact**: More reliable CI test runs, eliminates false negatives from WebGPU-unavailable environments.

**Testing Strategy**:
- WebGPU-dependent packages (`impostor`, `client`) require local testing with GPU-enabled browsers
- Headless CI focuses on server-side logic, data processing, and non-rendering systems
- Full integration tests run locally or on GPU-enabled CI runners (not GitHub Actions)

### Manifest File Loading Fix (March 10, 2026)

**Change** (Commit c0898fa): Fixed legacy manifest entries that 404 on CDN.

**Problem**: `DataManager` was attempting to fetch `items.json` and `resources.json` as root-level files, but these never existed - items are stored as split category files (`items/weapons.json`, `items/armor.json`, etc.).

**Fix**: 
- Removed legacy `items.json` and `resources.json` from manifest fetch list
- Added missing newer manifests to `MANIFEST_FILES` fetch list:
  - `ammunition.json`
  - `combat-spells.json`
  - `duel-arenas.json`
  - `lod-settings.json`
  - `quests.json`
  - `runes.json`

**Impact**: Eliminates 404 errors during manifest loading, ensures all current manifests are properly fetched.

### Three.js 0.183.2 Upgrade (March 10, 2026)

**Change** (Commit 8b93772): Upgraded Three.js from 0.182.0 to 0.183.2 across all packages.

**Breaking Changes**:
- **TSL API Change**: `atan2` renamed to `atan` in TSL exports
- **Type Compatibility**: Updated TSL typed node aliases (TSLNodeFloat/Vec2/Vec3/Vec4)

**Migration**:
```typescript
// Old (0.182.0)
import { atan2 } from 'three/tsl';

// New (0.183.2)
import { atan } from 'three/tsl';
```

**Impact**: Latest Three.js features, improved WebGPU performance and stability.

### Streaming Pipeline Optimization (March 10, 2026)

**Change** (Commits c0e7313, 796b61f): Major streaming pipeline overhaul with CDP default, default ANGLE backend, and FFmpeg improvements.

**Key Changes**:
- **Default Capture Mode**: CDP (Chrome DevTools Protocol) everywhere for reliability
- **Chrome Beta Channel**: Switched from Chrome Unstable to Chrome Beta for better stability
- **ANGLE Backend**: Default ANGLE backend (`--use-angle=default`) for automatic best-backend selection
- **FFmpeg Resolution**: Prefer system ffmpeg (`/usr/bin`, `/usr/local/bin`) over ffmpeg-static to avoid segfaults
- **x264 Tuning**: Default to `zerolatency` tune for live streaming (was `film`)
- **GOP Size**: Set to 30 frames (1s at 30fps) to match HLS segment boundaries
- **Playwright Fix**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Dead Code Removal**: Deleted `dev-final.mjs` (875 lines), removed `SERVER_DEV_LEAN_MODE` system

**ANGLE Backend Evolution**:
- **Initial (commit 796b61f)**: Vulkan ANGLE on Linux NVIDIA (`--use-angle=vulkan`)
- **Current (commit c0e7313)**: Default ANGLE backend (`--use-angle=default`) for auto-selection
- **Why Default**: Better compatibility across different GPU configurations and driver versions

**ANGLE Backend Selection**:
```bash
# Default (auto-select) - RECOMMENDED
STREAM_CAPTURE_ANGLE=default
--use-angle=default

# macOS (explicit)
STREAM_CAPTURE_ANGLE=metal
--use-angle=metal

# Linux NVIDIA (explicit, if default fails)
STREAM_CAPTURE_ANGLE=vulkan
--use-angle=vulkan --enable-features=DefaultANGLEVulkan,Vulkan,VulkanFromANGLE
```

**FFmpeg Improvements**:
```bash
# Resolution order (avoids ffmpeg-static segfaults)
/usr/bin/ffmpeg → /usr/local/bin/ffmpeg → PATH → ffmpeg-static
```

**Impact**: More reliable streaming across diverse GPU hardware, lower latency, eliminates FFmpeg segfaults, fewer crashes and rendering artifacts.

### Physics Optimization for Streaming (March 10, 2026)

**Change** (Commit c0e7313): Skip client-side PhysX initialization for streaming/spectator viewports.

**Rationale**: Streaming and spectator clients don't need physics simulation - they only render the world state.

**Impact**: Faster streaming client startup, reduced memory footprint for spectator views.

### Service Worker Cache Strategy (March 10, 2026)

**Change** (Commit 796b61f): Switched Workbox caching from `CacheFirst` to `NetworkFirst` for JS/CSS.

**Problem**: Stale service worker serving old HTML for JS chunks after rebuild.

**Solution**: `NetworkFirst` strategy - always fetch latest, fallback to cache.

**Impact**: Eliminates stale module errors after rebuilds, better dev experience.

### WebSocket Connection Stability (March 10, 2026)

**Change** (Commit 3b4dc66): Fixed WebSocket disconnects under load.

**Impact**: More stable multiplayer connections during high-load scenarios.

### CDN URL Unification (Commit 2173086)

**Change**: Replaced `DUEL_PUBLIC_CDN_URL` with unified `PUBLIC_CDN_URL` environment variable.

**Rationale**: Simplifies CDN configuration by using a single environment variable across all contexts instead of separate duel-specific and general CDN URLs.

**Configuration**:
```bash
# Old (deprecated)
DUEL_PUBLIC_CDN_URL=https://assets.hyperscape.club

# New (unified)
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

**Impact**: 
- Cleaner environment variable naming
- Consistent CDN URL across client, server, and streaming contexts
- Reduces configuration complexity

### Dependency Updates (March 10, 2026)

**Major Updates**:
- **Capacitor**: 7.6.0 → 8.2.0 (Android, iOS, Core)
- **lucide-react**: → 0.577.0 (icon library)
- **three-mesh-bvh**: 0.8.3 → 0.9.9 (BVH acceleration)
- **eslint**: → 10.0.3 (linting)
- **jsdom**: → 28.1.0 (testing)
- **@ai-sdk/openai**: → 3.0.41 (AI SDK)
- **hardhat**: → 3.1.11 (smart contracts)
- **@nomicfoundation/hardhat-chai-matchers**: → 3.0.0 (testing)
- **globals**: → 17.4.0 (TypeScript globals)

**Impact**:
- Latest mobile platform features (Capacitor 8.2.0)
- Improved icon library with new icons
- Better BVH performance for collision detection
- Latest linting rules and TypeScript support
- Bug fixes and security updates

### Deployment Fixes (March 11, 2026)

**Change** (Commits a65a308, 9e6f5bb): Fixed SSH session timeout and orphaned process deadlocks during Vast.ai deployments.

**Problem 1 - SSH Timeout**: Background processes (Xvfb, socat) were keeping SSH session file descriptors open, causing `appleboy/ssh-action` to hang for 30 minutes until `command_timeout` killed it - even though deployment completed in ~1 minute.

**Fix 1**: Added `disown` after each background process in `scripts/deploy-vast.sh` to detach them from the shell's job table, allowing SSH to exit cleanly.

**Problem 2 - Orphaned Bun Processes**: PM2 `kill` command was failing to terminate orphaned bun child processes (game server instances), causing them to hold database connections and deadlock subsequent deployments.

**Fix 2**: Added explicit `pkill` commands in `scripts/deploy-vast.sh` to kill orphaned bun server processes before starting new deployment:
```bash
# Kill ORPHANED bun child processes that pm2 kill failed to terminate
pkill -f "bun.*packages/server.*dist/index.js" || true
pkill -f "bun.*packages/server.*start" || true
pkill -f "bun.*dev-duel.mjs" || true
pkill -f "bun.*preview.*3333" || true
```

**Impact**: 
- Deployment completes in ~1 minute instead of hanging for 30 minutes
- Eliminates database connection deadlocks from ghost game servers
- CI/CD pipeline runs faster and more reliably
- No more false timeout failures or deployment hangs

**CI Test Filter Updates** (Commit d7a7995): Updated Turbo test filter to exclude deleted packages from main branch.

See CLAUDE.md for complete documentation.
