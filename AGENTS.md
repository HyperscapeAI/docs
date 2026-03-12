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
├── procgen/         # Procedural generation (terrain, biomes, vegetation)
├── asset-forge/     # AI asset generation + VFX catalog
├── duel-oracle-evm/ # EVM duel outcome oracle contracts
├── duel-oracle-solana/ # Solana duel outcome oracle program
└── contracts/       # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

## Recent Changes (March 2026)

### Tree Shader Lighting Fix (March 12, 2026)

**Change** (PR #1022, Commits c9eaaae, f5fe2b5, e53eab9): Fixed tree lighting to use vertex sphere normals instead of normal maps.

**Problem**: Tree models have sphere normals baked into the vertex normal attribute for volumetric foliage shading, but the shader was using `normalWorld` which goes through the TSL normal map pipeline, ignoring the correct vertex data. This caused incorrect lighting on tree canopies.

**Fix**: 
- Use `normalLocal` + `modelNormalMatrix` to read raw sphere normals directly from vertex attributes
- Removed normal map clearing (BatchNode already transforms `normalLocal` per-instance)
- Uniform night dimming for consistent tree light-shadow contrast at all times of day

**Technical Details**:
```typescript
// Old (incorrect - uses normal map pipeline)
const N = normalize(normalWorld);

// New (correct - uses vertex sphere normals)
const N = normalize(mul(modelNormalMatrix, normalLocal));
```

**Night Lighting Improvements**:
- Uniform `nightDim` multiplier darkens entire tree evenly (maintains ~1.35x lit-to-shadow ratio)
- SSS (subsurface scattering), edge brightening, and saturation boost now scale with `dayFactor`
- Night foliage stays muted and cool-toned
- Eliminates 4.8x contrast variance between day and night (was causing overly bright shadows at night)

**Impact**: Correct volumetric foliage lighting, consistent tree appearance across day/night cycle, better visual quality.

### Biome Terrain Generation & Quadtree LOD (March 12, 2026)

**Change** (PR #1018, Commits 82a5365, 6c14c8e): Merged biome-based terrain generation with hierarchical quadtree LOD system.

**New Features**:
- **TerrainQuadTree**: Hierarchical LOD system that splits/unsplits terrain chunks based on camera distance
  - Near chunks: small, high-resolution (100m at max depth)
  - Far chunks: large, low-resolution (1600m at root)
  - Uniform 32x32 vertex resolution across all LOD levels
  - Skirt geometry to hide LOD seams
- **GLBTreeBatchedInstancer**: BatchedMesh-based rendering for multi-variant trees
  - One BatchedMesh per material slot per LOD level
  - Supports multiple model variants per tree type (e.g., 5 dead tree models, 8 cactus variants)
  - Minimal draw calls regardless of variant count
  - Texture fingerprinting for automatic material slot matching across variants
- **Biome System**: Terrain generation now uses biome-specific parameters
  - 3 biomes: Forest, Canyon, Tundra (defined in `TerrainBiomeTypes.ts`)
  - 2 landscape types: Mountain, Pond (defined in `TerrainHeightParams.ts`)
  - Per-biome tree distribution, density, spacing, and placement rules
  - Biome-aware terrain textures and cliff colors
- **TreeId Enum**: Centralized tree type identifiers replacing magic strings
- **Batched Entity Spawning**: Reduces network overhead by batching all entities for a tile into single packet
- **Performance Optimizations**:
  - Reduced per-frame allocations in TerrainQuadTree (numeric grid coords instead of string keys)
  - Optimized GLBTreeBatchedInstancer fingerprinting (deterministic fallback prevents silent matching failures)
  - Entity cleanup on tile unload prevents memory leaks

**Configuration**:
```typescript
// TerrainQuadTree config (packages/shared/src/systems/shared/world/TerrainQuadTree.ts)
{
  minSize: 100,           // Smallest chunk (matches TILE_SIZE)
  maxDepth: 4,            // Max subdivision depth
  splitRatio: 1.5,        // Split when distance < size * splitRatio
  unsplitMultiplier: 1.2, // Prevents thrashing at LOD boundaries
  resolution: 32,         // Uniform vertex resolution
  skirtDrop: 15,          // Skirt depth in meters
}

// Biome-specific tree placement (packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts)
export const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  density: 0.15,
  minSpacing: 8,
  trees: {
    [TreeId.OAK]: {
      spawnWeight: 3,
      placement: { minHeight: 0, maxHeight: 100 }
    },
    [TreeId.WILLOW]: {
      spawnWeight: 2,
      placement: { minHeight: 0, maxHeight: 50, waterAffinity: 0.8 }
    }
  }
};
```

**Impact**: Infinite terrain rendering with dynamic LOD, biome-specific visuals, improved performance through reduced draw calls and smarter chunk management.

### Admin Live Controls & Maintenance Mode (March 12, 2026)

**Change** (PR #1015): Added admin dashboard with live controls, maintenance mode, and log streaming.

**New Features**:
- **Maintenance Mode System**: Graceful server pause/resume for deployments
  - `POST /admin/maintenance/enter` - Pause game after current duel
  - `POST /admin/maintenance/exit` - Resume game
  - `GET /admin/maintenance/status` - Check maintenance state
  - Safe-to-deploy flag prevents mid-duel restarts
- **Live Controls Dashboard**: Real-time admin panel with:
  - HLS stream preview
  - Maintenance mode toggle
  - Server restart button
  - Live log streaming (1000-entry ring buffer)
  - Auto-refresh (3s interval)
- **Maintenance Banner**: Client-side banner polls `/health` every 5s, displays warning when maintenance is active
- **Admin API Endpoints**:
  - `GET /admin/logs` - Fetch recent server logs from in-memory ring buffer
  - `POST /admin/restart` - Restart server process (requires PM2)

**Configuration**:
```bash
# ecosystem.config.cjs
ORACLE_SETTLEMENT_DELAY_MS=7000  # Delay oracle publish to sync with stream
```

**Impact**: Zero-downtime deployments, better operational visibility, safer server restarts.

### Oracle Settlement Delay & Stream Sync (March 11, 2026)

**Change** (Commit 38c8c89): Added configurable settlement delay to sync oracle publishing with stream delivery.

**Problem**: Oracle was publishing duel outcomes immediately after resolution, but stream viewers were still watching the duel (7-10s behind live).

**Fix**: Added `ORACLE_SETTLEMENT_DELAY_MS` (default 7000ms) to delay oracle publishing until stream catches up.

**Configuration**:
```bash
# ecosystem.config.cjs or .env
ORACLE_SETTLEMENT_DELAY_MS=7000  # 7 seconds to match typical stream latency
```

**Impact**: Stream viewers see duel outcome before oracle publishes, better UX for betting/spectating.

### Agent Autonomous Behavior Restoration (March 11, 2026)

**Change** (Commit 82a5365, ElizaDuelBot.ts changes): Fixed agent T-pose and re-enabled autonomous behavior between duels.

**Fixes**:
- **Physics Null Guards**: Added null checks in `RigidBody.ts` and `Collider.ts` for stream mode viewports where physics system is removed
- **Autonomous Behavior**: Re-enabled mining, chopping, fishing for duel bot agents between duels (was suppressed)
- **Post-Duel Roaming**: Relaxed restore position from 120-unit lobby radius to 2000-unit world boundary
- **Model Provider Diversity**: Switched from ElizaCloud to direct Anthropic/Groq providers
  - Interleaved provider selection ensures diversity (Anthropic → Groq → Anthropic → Groq...)
  - Models: Claude Sonnet 4.6, Llama 4 Scout, Claude Opus 4.6, Llama 4 Maverick, Claude Haiku 4.5, etc.
- **Bank State Request**: Request bank state on player spawn so goal planner has item data

**Impact**: Agents now behave naturally between duels, no more T-pose in stream mode, better goal planning with bank awareness.

### Streaming Frame Pacing Fix (March 11, 2026)

**Change** (Commits 522fe37, e2c9fbf): Enforced 30fps frame pacing to eliminate stream buffering.

**Problem**: CDP screencast was delivering frames at ~60fps while FFmpeg expected 30fps input, causing buffer buildup and viewer lag. Initial fix (522fe37) set `everyNthFrame: 2` to halve compositor delivery, but this was incorrect - Xvfb compositor runs at 30fps (no vsync), not 60fps.

**Fix**:
- **Reverted everyNthFrame to 1** (commit e2c9fbf) - Xvfb compositor delivers at 30fps, so no frame skipping needed
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
- 1280x720 matches capture viewport, eliminating upscaling overhead

**Impact**: Eliminates stream buffering, smoother playback for viewers, reduced bandwidth usage, correct frame delivery rate (30fps).

### RTMP Muxer Improvements (March 12, 2026)

**Change** (PR #1015): Switched RTMP muxer from `flv` to `fifo` with overflow handling.

**Problem**: Network stalls to RTMP endpoints would block the encoder, causing frame drops and stream interruptions.

**Fix**: Changed muxer to `fifo` format with `drop_pkts_on_overflow=1` and `attempt_recovery=1` to absorb network stalls without blocking the encoder.

**Configuration**:
```bash
# RTMP output format (in rtmp-bridge.ts)
[f=fifo:fifo_format=flv:drop_pkts_on_overflow=1:attempt_recovery=1:recovery_wait_time=1]
```

**Impact**: More resilient streaming to RTMP endpoints, fewer encoder stalls during network issues.

### GOP Size Adjustment (March 12, 2026)

**Change** (PR #1015): Increased GOP size from 30 to 60 frames (2s at 30fps).

**Rationale**: Twitch and YouTube recommend 2-second keyframe intervals for live streaming stability.

**Impact**: Better stream stability on platforms, slightly higher latency for tune-in and seeking.

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
- **RTMP Muxer**: Changed from `flv` to `fifo` muxer with `drop_pkts_on_overflow=1` to absorb network stalls without blocking encoder
- **GOP Size**: Changed from 30→60 frames (2s at 30fps) per Twitch/YouTube recommendations for stability
- **Playwright Fix**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Dead Code Removal**: Deleted `dev-final.mjs` (875 lines), removed `SERVER_DEV_LEAN_MODE` system

**ANGLE Backend Selection**:
```bash
# Linux NVIDIA - RECOMMENDED for production streaming
STREAM_CAPTURE_ANGLE=vulkan
--use-angle=vulkan --enable-features=DefaultANGLEVulkan,Vulkan,VulkanFromANGLE

# macOS
STREAM_CAPTURE_ANGLE=metal
--use-angle=metal

# Auto-select (fallback)
STREAM_CAPTURE_ANGLE=default
--use-angle=default
```

**Why Vulkan ANGLE on Linux**: ANGLE OpenGL ES (`--use-angle=gl`) fails with "Invalid visual ID" on NVIDIA GPUs. Native Vulkan (`--use-vulkan`) crashes. Only ANGLE's Vulkan backend works reliably for WebGPU streaming on Linux NVIDIA hardware.

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

### Procgen Package Circular Dependency Fix (March 12, 2026)

**Change** (PR #1018): Resolved circular dependency between `@hyperscape/shared` and `@hyperscape/procgen`.

**Problem**: `procgen` imported `TileCoord` type from `shared`, while `shared` imported procgen for terrain generation, creating a circular dependency.

**Fix**: Defined `TileCoord` interface locally in `packages/procgen/src/building/viewer/index.ts` to break the cycle.

**Impact**: Cleaner package boundaries, procgen can now build without TypeScript errors.

See CLAUDE.md for complete documentation.
