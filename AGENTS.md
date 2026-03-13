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
- **Chrome Beta Channel**: Use `google-chrome-beta` (Chrome Beta) for WebGPU streaming on Linux NVIDIA (best stability and WebGPU support)
- **ANGLE Backend**: Use Vulkan ANGLE backend (`--use-angle=vulkan`) on Linux NVIDIA for WebGPU stability
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
- **Capture Mode**: Default to `STREAM_CAPTURE_MODE=cdp` (Chrome DevTools Protocol) for reliable frame capture
- **FFmpeg**: Prefer system ffmpeg over ffmpeg-static to avoid segfaults (resolution order: `/usr/bin/ffmpeg` → `/usr/local/bin/ffmpeg` → PATH → ffmpeg-static)
- **Playwright**: Block `--enable-unsafe-swiftshader` injection to prevent CPU software rendering
- **Health Check Timeouts**: All curl commands use `--max-time 10` to prevent indefinite hangs
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

### Chrome Canary for Linux WebGPU Support (March 13, 2026)

**Change** (Commit d37bbe3): Switched from Chrome Beta to Chrome Canary for Linux WebGPU streaming support.

**Problem**: Chrome Beta on Linux was experiencing WebGPU initialization failures and rendering artifacts on NVIDIA GPUs with Vulkan ANGLE backend.

**Fix**: Updated `scripts/deploy-vast.sh` to install `google-chrome-unstable` (Chrome Canary) instead of `google-chrome-beta`:
```bash
# Install Chrome Canary channel (Required for WebGPU on Linux)
echo "[deploy] Installing Chrome Canary for WebGPU support..."
if ! command -v google-chrome-unstable &> /dev/null; then
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - || true
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update && apt-get install -y google-chrome-unstable || true
fi
```

**Configuration**:
- **Linux NVIDIA**: Use Chrome Canary (`google-chrome-unstable`) with Vulkan ANGLE backend
- **macOS**: Continue using stable Chrome with Metal ANGLE backend
- **Deployment**: `scripts/deploy-vast.sh` now installs Chrome Canary by default on Linux

**Impact**: More reliable WebGPU initialization on Linux NVIDIA GPUs, eliminates rendering artifacts, better streaming stability.

### Curl Timeout Configuration (March 13, 2026)

**Change** (Commit d37bbe3): Added `--max-time 10` timeout to all curl health check commands in deployment scripts.

**Problem**: Health check curl commands could hang indefinitely if services were unresponsive, causing deployment scripts to stall.

**Fix**: Added explicit 10-second timeout to all curl commands in `scripts/deploy-vast.sh`:
```bash
# Before
curl -fsS http://127.0.0.1:5555/health > /dev/null 2>&1

# After
curl -fsS --max-time 10 http://127.0.0.1:5555/health > /dev/null 2>&1
```

**Impact**: Deployment scripts fail fast when services are unresponsive, prevents indefinite hangs during health checks.

### OSRS-Accurate Movement Rotation (March 13, 2026)

**Change** (Commit 24ed839): Fixed player rotation to ignore combat target rotation while moving, restoring OSRS-accurate movement behavior.

**Problem**: Players were rotating to face their combat target even while moving, which differs from Old School RuneScape behavior where movement direction takes priority over combat facing.

**Fix**: Modified movement system to ignore combat rotation updates while the player is actively moving:
```typescript
// Movement rotation takes priority over combat rotation
if (isMoving) {
  // Ignore combat target rotation updates
  return;
}
```

**Impact**: 
- Movement feels more responsive and natural
- Matches OSRS behavior where players face their movement direction
- Combat rotation only applies when standing still
- Better player control during kiting and tactical movement

### Fresh Asset Fetching on Vast.ai Deploy (March 13, 2026)

**Change** (Commit ef42c3d): Force fresh asset download on every Vast.ai deployment to prevent stale biome manifests.

**Problem**: Vast.ai VM cache was persisting old `packages/server/world/assets` directory across deployments, causing stale biome manifests to be used even after CDN updates.

**Fix**: Added explicit asset cleanup in `scripts/deploy-vast.sh` before `bun install`:
```bash
# Clean up assets folder to forcefully redownload the latest biomes manifest over the VM cache.
rm -rf packages/server/world/assets
bun install
```

**Impact**: 
- Eliminates stale manifest issues on Vast.ai deployments
- Ensures latest biome configs are always used
- Fixes canyon biome errors from outdated manifests
- Forces fresh download from CDN on every deploy

### Docker Build Cache Invalidation (March 13, 2026)

**Change** (Commits a522949, 207fd8a): Prevent Docker build cache from storing old biomes.json and other manifest files.

**Problem**: Docker layer caching was preserving old manifest files across builds, causing production deployments to use stale biome configurations even after manifest updates.

**Fix**: Modified `packages/server/Dockerfile` to invalidate cache for manifest copy operations:
```dockerfile
# Create world directory structure and copy manifests where server expects them
RUN mkdir -p ./packages/server/world/assets/manifests

# Copy manifests (small JSON files needed for server-side logic)
# This layer is invalidated on every build to ensure fresh manifests
COPY assets/manifests ./packages/server/world/assets/manifests
```

**Additional Changes**:
- Added cache-busting comments to force rebuild of manifest layers
- Ensured `bun install --production` runs after manifest copy to restore workspace symlinks

**Impact**: 
- Docker images always contain latest manifest files
- Eliminates production errors from stale biome configs
- Consistent manifest versions across all deployment targets
- No manual cache clearing required

### Docker Workspace Symlinks Fix (March 12, 2026)

**Change** (Commit 7f1af94): Added `bun install --production` in Docker runtime stage to restore workspace symlinks.

**Problem**: Docker COPY flattens workspace symlinks in `node_modules`, breaking runtime module resolution for externalized workspace packages (`@hyperscape/decimation`, `@hyperscape/impostors`, `@hyperscape/physx-js-webidl`, `@hyperscape/procgen`). The server's `framework.js` externalizes these packages, expecting them to be resolvable at runtime.

**Fix**: Added `bun install --production` in the Docker runtime stage after COPY to restore the workspace symlinks.

**Dockerfile Changes**:
```dockerfile
# Runtime stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Restore workspace symlinks that COPY flattened
RUN bun install --production
```

**Impact**: Server can now resolve externalized workspace packages at runtime in Docker, fixes module resolution errors in production deployments.

### Model Provider Diversity (March 12, 2026)

**Change** (PR #1018, Commit 2751b26): Switched from ElizaCloud to direct Anthropic/Groq providers with interleaved selection.

**Problem**: All agents were using ElizaCloud as a proxy, reducing model diversity and creating a single point of failure.

**Solution**: 
- Direct integration with Anthropic and Groq providers
- Interleaved provider selection ensures diversity (Anthropic → Groq → Anthropic → Groq...)
- Updated `@elizaos/plugin-elizacloud` to `alpha` tag for compatibility

**Model Lineup** (`packages/server/src/eliza/ModelAgentSpawner.ts`):
```typescript
export const MODEL_AGENTS: ModelProviderConfig[] = [
  { provider: "anthropic", model: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct", displayName: "Llama 4 Scout" },
  { provider: "anthropic", model: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
  { provider: "groq", model: "meta-llama/llama-4-maverick-17b-128e-instruct", displayName: "Llama 4 Maverick" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
  { provider: "groq", model: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B" },
  { provider: "anthropic", model: "claude-opus-4-20250514", displayName: "Claude Opus 4" },
  { provider: "groq", model: "moonshotai/kimi-k2-instruct", displayName: "Kimi K2" },
  { provider: "anthropic", model: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4" },
  { provider: "groq", model: "qwen/qwen3-32b", displayName: "Qwen 3 30B" },
];
```

**Impact**: Better model diversity, reduced dependency on single provider, more resilient agent spawning.

### Procgen Circular Dependency Resolution (March 12, 2026)

**Change** (PR #1018, Commit 6295345): Resolved circular dependency between `@hyperscape/shared` and `@hyperscape/procgen`.

**Problem**: `procgen` imported `TileCoord` type from `shared`, while `shared` imported procgen for terrain generation, creating a circular dependency that prevented clean builds.

**Fix**: Defined `TileCoord` interface locally in `packages/procgen/src/building/viewer/index.ts`:
```typescript
// packages/procgen/src/building/viewer/index.ts
export interface TileCoord {
  x: number;
  z: number;
}
```

**Files Changed**:
- `packages/procgen/src/building/viewer/index.ts` - Added local TileCoord definition
- `packages/procgen/src/building/viewer/BuildingViewer.tsx` - Import from local index instead of shared
- `packages/procgen/src/building/viewer/TownViewer.tsx` - Import from local index instead of shared

**Impact**: Cleaner package boundaries, procgen can now build without TypeScript errors, eliminates circular dependency warnings.

### Biome System Refactoring (March 12, 2026)

**Change** (PR #1018, Commits 2751b26, dd8d6ad): Refactored biome system to remove hardcoded biome definitions and support explicit biome centers.

**Key Changes**:
- **Removed Hardcoded Biomes**: Deleted `DEFAULT_BIOMES` and `BIOME_IDS` constants from `BiomeSystem.ts`
- **Dynamic Biome IDs**: Biome IDs are now auto-assigned at runtime based on provided biome definitions
- **Explicit Centers Support**: Added `explicitCenters` option to `BiomeConfig` for pre-computed biome placement
- **Polygon Center Helper**: Added `BiomeSystem.computePolygonCenters()` for regular polygon biome layouts
- **Fallback Handling**: Improved fallback logic when no biome definitions are provided

**API Changes**:
```typescript
// Old (hardcoded biomes)
const biomeSystem = new BiomeSystem(seed, worldSize);

// New (explicit biome definitions required)
const biomeSystem = new BiomeSystem(seed, worldSize, {}, {
  forest: { id: "forest", name: "Forest", color: 0x2f7d32, ... },
  canyon: { id: "canyon", name: "Canyon", color: 0xdaa520, ... },
  tundra: { id: "tundra", name: "Tundra", color: 0xb0c4de, ... },
});

// With explicit centers (skips grid-jitter placement)
const centers = BiomeSystem.computePolygonCenters(
  ["forest", "canyon", "tundra"],
  5000,  // radius
  3000   // influence
);
const biomeSystem = new BiomeSystem(seed, worldSize, { explicitCenters: centers }, biomes);
```

**Impact**: More flexible biome system, supports custom biome definitions, cleaner API for terrain generation.

### Tree Placement Slope Rejection (March 12, 2026)

**Change** (PR #1018, Commit dd8d6ad): Added slope-based tree placement rejection to prevent trees on steep terrain.

**Feature**: Trees are now rejected on steep slopes using central-difference gradient estimation.

**Configuration** (`packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts`):
```typescript
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  // ...
  maxSlope: 1.5,  // Gradient threshold (1.5 ≈ 56° max slope)
};

const CANYON_TREE_CONFIG: BiomeTreeConfig = {
  // ...
  maxSlope: 2.0,  // Canyon allows steeper placement
};
```

**Implementation**:
- Estimates terrain gradient at each candidate position using 4 height samples (central differences)
- Skips placement when slope exceeds `maxSlope` threshold
- Efficient: O(4) height queries per candidate position

**Impact**: More realistic tree placement, no trees on cliffs or steep hillsides, better visual quality.

### Tree Configuration Unification (March 12, 2026)

**Change** (PR #1018, Commit 6295345): Merged `distribution` and `placements` into single `trees` map in `BiomeTreeConfig`.

**Problem**: Tree spawn weights and placement rules were defined in separate maps, causing duplication and maintenance overhead.

**Fix**: Combined into unified `TreeSpawnConfig` per tree type:
```typescript
// Old (separate maps)
const FOREST_TREE_CONFIG = {
  distribution: {
    [TreeId.Oak]: 20,
    [TreeId.Maple]: 40,
  },
  placements: {
    [TreeId.Oak]: { minHeight: 0, maxHeight: 30 },
    [TreeId.Maple]: { minHeight: 0, maxHeight: 30 },
  },
};

// New (unified)
const FOREST_TREE_CONFIG = {
  trees: {
    [TreeId.Oak]: { 
      weight: 20, 
      minHeight: 0, 
      maxHeight: 30 
    },
    [TreeId.Maple]: { 
      weight: 40, 
      minHeight: 0, 
      maxHeight: 30 
    },
  },
};
```

**Impact**: Cleaner API, eliminates duplicate tree definitions, easier to maintain biome configs.

### Wrangler R2 Deployment Fix (March 13, 2026)

**Change** (Commit 94e3a1d): Added `--remote` flag to Wrangler R2 object put command in Cloudflare deploy action.

**Problem**: R2 uploads were failing silently because Wrangler was attempting to upload to local R2 bucket instead of the remote Cloudflare R2 bucket.

**Fix**: Added `--remote` flag to `wrangler r2 object put` command in `.github/workflows/deploy-cloudflare.yml`.

**Impact**: R2 asset uploads now correctly target the remote Cloudflare bucket, fixing deployment failures.

### Solana Oracle IDL Type Formatting (March 13, 2026)

**Change** (Commits in `packages/duel-oracle-solana/src/generated/`): Reformatted Solana oracle IDL types from JSON-style to TypeScript-style object literals.

**Technical Details**:
```typescript
// Old (JSON-style)
export const FIGHT_ORACLE_IDL = {
  "address": "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  "metadata": {
    "name": "fight_oracle",
    // ...
  }
}

// New (TypeScript-style)
export const FIGHT_ORACLE_IDL = {
  address: "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV",
  metadata: {
    name: "fight_oracle",
    // ...
  }
} as const;
```

**Impact**: Better TypeScript type inference, cleaner code style, no functional changes.

### CDN Cache Busting (March 13, 2026)

**Change** (Commit db6581f): Added cache busting to CDN requests and manifest uploads to prevent stale asset issues.

**Problem**: Cloudflare R2 CDN was serving stale manifests and assets even after new versions were uploaded, causing clients to load outdated game data (items, NPCs, terrain configs, etc.).

**Fix**:
- **Client-side**: Added `?v=<timestamp>` query parameter to all CDN manifest requests
- **Server-side**: Appended `?v=<timestamp>` to manifest uploads to R2 to force cache invalidation
- **Deployment**: `scripts/upload-to-r2.sh` now includes cache-busting timestamps on all manifest uploads

**Implementation**:
```typescript
// Client-side (packages/shared/src/data/DataManager.ts)
const cacheBuster = `?v=${Date.now()}`;
const manifestUrl = `${CDN_URL}/manifests/${filename}${cacheBuster}`;

// Server-side (scripts/upload-to-r2.sh)
aws s3 cp "manifests/${file}" "s3://${BUCKET}/manifests/${file}?v=$(date +%s)" \
  --endpoint-url "${ENDPOINT}" \
  --content-type "application/json"
```

**Impact**: 
- Eliminates stale manifest issues across deployments
- Ensures clients always fetch latest game data
- Prevents canyon biome errors from outdated manifests
- No manual CDN cache purging required

### Manifest Embedding in Docker (March 13, 2026)

**Change** (Commit efa8021): Server Docker image now embeds manifests to bypass CDN and fix canyon biome errors.

**Problem**: Server was fetching manifests from CDN at runtime, which could fail if CDN was unavailable or manifests were stale. Canyon biome was failing due to missing manifest data.

**Fix**: 
- Manifests are now embedded directly in the Docker image at build time
- Server reads manifests from local filesystem instead of CDN
- Ensures manifests are always available and match the deployed code version

**Impact**: More reliable server startup, eliminates CDN dependency for manifests, fixes canyon biome loading errors.

### Deployment Manifest Upload Improvements (March 13, 2026)

**Changes** (Commits eb28eb1, 2d4e2ae, 8b5c5d2, 05b1d67): Fixed manifest upload workflow to prevent stale manifests in production.

**Problems**:
1. **Submodule Overwrite**: `assets/manifests` submodule was overwriting updated manifests during R2 upload
2. **Missing Manifests**: Manifests weren't being generated before R2 upload, causing 404s
3. **Stale CDN Cache**: Vast.ai deployments were fetching stale manifests from CDN instead of embedded versions

**Fixes**:
- **Prevent Submodule Overwrite**: Modified `scripts/upload-to-r2.sh` to skip `assets/manifests` directory during upload (manifests are now uploaded separately with cache busting)
- **Ensure Manifests Exist**: Added `node scripts/ensure-assets.mjs` before R2 upload in GitHub Actions workflow
- **Force Fresh Fetch**: Vast.ai deployment now clears CDN cache and forces re-fetch of manifests with cache-busting timestamps
- **Removed Broken CORS Config**: Removed R2 CORS configuration step that was failing (CORS is now configured via Cloudflare dashboard)

**Deployment Workflow**:
```bash
# GitHub Actions (.github/workflows/deploy-r2.yml)
1. Checkout code
2. Run ensure-assets.mjs to generate manifests
3. Upload manifests to R2 with cache-busting timestamps
4. Skip assets/manifests submodule to prevent overwrite

# Vast.ai Deployment (scripts/deploy-vast.sh)
1. Pull latest code
2. Manifests are embedded in Docker image (no CDN dependency)
3. Server reads from local filesystem instead of CDN
```

**Impact**:
- Reliable manifest availability across all deployment targets
- No more 404 errors from missing manifests
- Consistent manifest versions between Docker and CDN
- Simplified deployment workflow (no manual CORS config)

### Workbox Service Worker Fix (March 13, 2026)

**Change** (Commit 9312a96): Inline workbox runtime to prevent MIME type errors on PWA update.

**Problem**: Service worker was failing to update due to MIME type errors when loading workbox runtime from external CDN.

**Fix**: Workbox runtime is now inlined directly into the service worker bundle instead of being loaded from external source.

**Impact**: Eliminates service worker update failures, more reliable PWA updates, better offline support.

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

### Tree Collision & Fog Tweaks (March 12, 2026)

**Tree Collision Proxy** (Commit 214c729):
- Reduced raycast proxy radius from 100% to 40% of bounding box
- **Problem**: Full bounding radius included the canopy, making invisible collision cylinder catch clicks far from trunk
- **Impact**: More precise tree interaction, clicks only register near actual trunk

**Fog Distance Adjustments** (Commits 5898f43, 7b2655a):
- Reduced `FOG_FAR` from 180m to 150m for denser atmosphere
- Creates more immersive depth perception
- **Impact**: Better visual depth, more atmospheric world rendering

**Forest Tree Spacing** (Commit 927edde):
- Increased `maxHeight` from 25m to 30m for forest biome
- Increased `minSpacing` from 8m to 12m between trees
- **Impact**: Less cluttered forests, better navigation, more realistic tree distribution

### Biome Terrain Generation & Quadtree LOD (March 12, 2026)

**Change** (PR #1018, Commits 82a5365, 6c14c8e): Merged biome-based terrain generation with hierarchical quadtree LOD system.

**New Features**:

#### TerrainQuadTree - Hierarchical LOD System
Replaces flat 100m grid for **rendering only** (gameplay logic, physics, resource spawning, and server sync continue to use flat grid):
- Near chunks: small, high-resolution (100m at max depth)
- Far chunks: large, low-resolution (1600m at root)
- Uniform 32x32 vertex resolution across all LOD levels
- Skirt geometry to hide LOD seams
- Config flags in `TerrainSystem.CONFIG`:
  - `USE_QUADTREE_LOD` - enables quad-tree LOD (set to `false` for flat grid)
  - `QUADTREE_DEBUG_WIREFRAME` - renders wireframe with depth-colored chunks

#### GLBTreeBatchedInstancer - Multi-Variant Tree Rendering
BatchedMesh-based instancer for tree types with multiple model variants:
- **Why BatchedMesh over InstancedMesh**: `InstancedMesh` binds a single geometry, requiring N separate instances per material slot per LOD level for N variants. `BatchedMesh` registers all variant geometries via `addGeometry()` and each instance picks its variant via `addInstance(geometryId)`, keeping it to **1 draw call per material slot** regardless of variant count.
- One BatchedMesh per material slot per LOD level
- Supports multiple model variants per tree type (e.g., 5 dead tree models, 8 cactus variants)
- Minimal draw calls regardless of variant count
- Texture fingerprinting for automatic material slot matching across variants
- Old `GLBTreeInstancer` (InstancedMesh-based) still used for single-model resources

#### TreeId Enum - Type-Safe Tree Identifiers
Centralized tree type identifiers replacing magic strings:
```typescript
// packages/shared/src/systems/shared/world/TreeId.ts
export enum TreeId {
  Oak = "tree_oak",
  Maple = "tree_maple",
  Knotwood = "tree_knotwood",
  Palm = "tree_palm",
  Cactus = "tree_cactus",
  Dead = "tree_dead",
  WindPine = "tree_wind_pine",
}
```
- Provides type safety and refactoring confidence
- Used throughout biome configs and tree placement logic
- Helper function `treeIdToSubType()` converts enum to subtype string

#### Biome System - Data-Driven Terrain Generation
Terrain generation now uses biome-specific parameters:
- **3 biomes**: Forest, Canyon, Tundra (defined in `TerrainBiomeTypes.ts`)
- **2 landscape types**: Mountain, Pond (defined in `TerrainHeightParams.ts`)
- Per-biome tree distribution, density, spacing, and placement rules
- Biome-aware terrain textures and cliff colors
- Per-tree placement rules support:
  - `waterAffinity` - preference for spawning near water
  - `avoidsWaterBelow` - minimum height above water
  - `minHeight` / `maxHeight` - elevation constraints
  - `maxSlope` - slope rejection threshold

#### Batched Entity Spawning - Network Optimization
Reduces network overhead by batching all entities for a tile into single packet:
- New `entitiesBatchAdded` packet type replaces per-entity `entityAdded` packets
- `EntityManager.spawnEntity()` now accepts `suppressBroadcast` option for batching
- `ResourceSystem` collects all tile entities and sends single HIGH-priority batch
- Typical tile with 15 trees: 1 packet instead of 15 packets
- Entity cleanup on tile unload prevents memory leaks and duplicate-ID errors

#### Performance Optimizations
- Reduced per-frame allocations in TerrainQuadTree (numeric grid coords instead of string keys)
- Optimized GLBTreeBatchedInstancer fingerprinting (deterministic fallback prevents silent matching failures)
- Entity cleanup on tile unload prevents memory leaks
- Batched entity spawning reduces network overhead by ~93% for typical tiles

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
const FOREST_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Knotwood]: { weight: 40, maxHeight: 30 },
    [TreeId.Oak]: { weight: 20, maxHeight: 30 },
    [TreeId.Maple]: { weight: 40, maxHeight: 30 },
  },
  density: 15,
  minSpacing: 12,
  clustering: false,
  scaleVariation: [0.8, 1.2],
  maxSlope: 1.5,
};

const CANYON_TREE_CONFIG: BiomeTreeConfig = {
  enabled: true,
  trees: {
    [TreeId.Cactus]: { weight: 20, avoidsWaterBelow: 3 },
    [TreeId.Dead]: { weight: 20, minHeight: 20 },
    [TreeId.Palm]: {
      weight: 20,
      waterAffinity: 0.3,
      waterProximityHeight: 9,
      maxHeight: 15,
    },
  },
  density: 15,
  minSpacing: 18,
  clustering: false,
  scaleVariation: [0.7, 1.3],
  maxSlope: 2.0,
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

**Configuration** (from `ecosystem.config.cjs`):
```bash
ORACLE_SETTLEMENT_DELAY_MS=7000  # Delay oracle publish to sync with stream (default: 7s)
STREAM_CAPTURE_MODE=cdp          # CDP (Chrome DevTools Protocol) for reliable capture
STREAM_CAPTURE_CHANNEL=chrome-canary  # Chrome Canary for WebGPU stability on Linux
STREAM_CAPTURE_ANGLE=vulkan      # Vulkan ANGLE backend on Linux NVIDIA
STREAM_CAPTURE_WIDTH=1280        # Match capture viewport
STREAM_CAPTURE_HEIGHT=720
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

### SSH Keepalive & Maintenance Timeout (March 13, 2026)

**Change** (PR #1028, Commit fb0d154): Added strict SSH keepalive settings and reduced maintenance mode timeout for faster deployments.

**SSH Keepalive Configuration**:
- Added `ServerAliveInterval=15` and `ServerAliveCountMax=3` to SSH commands in `.github/workflows/deploy-vast.yml`
- Prevents SSH connection drops during long-running maintenance mode operations
- SSH will detect dead connections within 45 seconds (15s × 3 retries)

**Maintenance Mode Timeout**:
- Reduced timeout from 300 seconds (5 minutes) to 30 seconds
- Reduced curl timeout from 600 seconds to 30 seconds
- Faster deployment cycles when waiting for current duel to complete

**Configuration**:
```bash
# SSH keepalive flags\nssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3\n\n# Maintenance mode API call\ncurl -X POST 'http://127.0.0.1:5555/admin/maintenance/enter' \\\n  -d '{\"reason\":\"deployment\",\"timeoutMs\":30000}' \\\n  --max-time 30\n```\n\n**Impact**: More reliable SSH connections during deployments, faster deployment cycles, prevents connection drops during maintenance mode.\n\n### Deployment Fixes (March 11, 2026)\n\n**Change** (Commits a65a308, 9e6f5bb): Fixed SSH session timeout and orphaned process deadlocks during Vast.ai deployments.

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
