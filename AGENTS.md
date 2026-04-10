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
4. **Bun package manager** - Use `bun install`, not npm (client/build tasks)
5. **Node.js 22+ for server** - Server runtime migrated from Bun (March 2026)
6. **Strong typing** - Prefer classes over interfaces
7. **Secrets stay out of git** - Real keys must only come from local `.env` files or secret managers

## Tech Stack

- **Runtime**: 
  - **Client/Build**: Bun v1.3.10+ (upgraded from 1.1.38 for Vite 6+ compatibility)
  - **Server**: Node.js 22+ (migrated from Bun for V8 incremental GC - March 2026)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- **Engine**: Three.js 0.183.2, PhysX (WASM)
- **UI**: React 19.2.0, Tailwind CSS 4.1.14
- **Server**: Fastify (HTTP), uWebSockets.js (game WebSocket), LiveKit (voice)
- **Database**: PostgreSQL (production, connection pool: 20), Docker (local), sqlite3 6.0.1 (dev only)
- **Testing**: Vitest 4.1.0+, Jest 30.3.0, Playwright (WebGPU-enabled browsers only)
- **Build**: Vite 8.0.0, @vitejs/plugin-react 6.0.1, Turbo, esbuild
- **AI**: ElizaOS `alpha` tag (aligned with latest alpha releases)
- **Streaming**: FFmpeg (system preferred over ffmpeg-static), Playwright Chromium, RTMP
- **Mobile**: Capacitor 8.2.0 (Android, iOS)
- **Smart Contracts**: Hardhat 3.1.11+, @nomicfoundation/hardhat-ethers 4.0.6 (ethers.js v6)

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
├── server/          # Game server (Fastify, uWebSockets.js, PostgreSQL)
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

## Recent Changes (April 2026)

### Vegetation Model Caching Fixes (April 10, 2026)

**Change** (PR #1144, Commits aca6e95, a5405da, 8af2566): Fixed mushroom disappearance and tree texture corruption on fresh GLTF load.

**Scope**: 3 files changed, +230 additions, -60 deletions in shared package.

**Problems Fixed**:

1. **Mushroom Disappearance**: GLTF files often store geometry using `InterleavedBufferAttribute`, where multiple attributes share one interleaved `ArrayBuffer`. `serializeScene` was calling `.array` on these attributes and passing the entire interleaved buffer (all attributes combined) as if it were a single attribute. On deserialization, vertex counts were fractional/NaN, bounding boxes were corrupted, and `modelBaseOffset = NaN` caused every instance to be rejected by `addInstanceToChunk`.

2. **Tree Texture Corruption**: Three.js WebGPU has two texture upload paths:
   - `DataTexture` → `writeTexture` (raw byte copy, no transformation)
   - `ImageBitmapTexture` (fresh GLTF) → `copyExternalImageToTexture` (browser applies a color-space decode step)
   
   The `copyExternalImageToTexture` path performs a browser-side sRGB decode during upload, which corrupts the stored values when the destination is an `rgba8unorm-srgb` texture. `DataTexture` (from IndexedDB cache) uses `writeTexture` which copies bytes directly and renders correctly.

**Fixes**:

**ModelCache.ts** (`packages/shared/src/utils/rendering/ModelCache.ts`):
- **`extractAttr()` helper**: Deinterleaves `InterleavedBufferAttribute` by reading each component individually via `getComponent()`, producing contiguous typed arrays. Matches source typed array constructor (e.g., Uint16Array for skinIndex) instead of hardcoding Float32Array.
- **`ensureDataTexture()` helper**: Converts `ImageBitmapTexture` to `DataTexture` so all textures use WebGPU's `writeTexture` upload path (raw byte copy) instead of `copyExternalImageToTexture` (browser-side colorspace decode). Forwards `minFilter`, `magFilter`, `generateMipmaps`, `repeat`, `offset` to prevent mipmap/aliasing regression.
- **Fast DataTexture path**: `textureToPixelData()` now reads DataTexture pixel data directly without canvas round-trip.

**GPUMaterials.ts** (`packages/shared/src/systems/shared/world/GPUMaterials.ts`):
- **Smooth diffuse ramp**: Replaced 4-band toon shading with continuous smoothstep diffuse ramp (warm highlights → cool shadows) plus narrow warm-tinted shadow terminator band.
- **Softened rim light**: Changed from binary step to smoothstep falloff for smoother edge highlights.

**Key Files Changed**:
- `packages/shared/src/utils/rendering/ModelCache.ts` — Interleaved buffer deinterleaving, ImageBitmapTexture → DataTexture conversion
- `packages/shared/src/systems/shared/world/GPUMaterials.ts` — Smooth diffuse ramp tree shader
- `packages/shared/src/systems/shared/world/VegetationSystem.ts` — Consistent bracing, improved logging

**Impact**:
- Mushrooms render correctly after cache clear (no more disappearing vegetation)
- Tree textures render consistently between fresh GLTF loads and cached loads
- Smoother tree lighting with continuous diffuse ramp instead of hard toon bands
- Proper mipmap filtering on all textures (no pixelation at distance)

### Armor Pipeline POC3 (April 6-8, 2026)

**Change** (PR #1142, Commits 87a4c6e-515c48c): Complete armor generation pipeline from VRM avatar to game-ready GLB.

**Scope**: 26 files changed, +12,109 additions, -8 deletions in asset-forge package.

**Core Features**:

#### 1. Shell Extraction System
**New Module**: `packages/asset-forge/src/services/armor-pipeline/ShellExtractionService.ts` (2,058 lines)

Extracts body-fitting armor shells from VRM avatars by bone weight analysis:
- **Exclusive Region Assignment**: Each vertex belongs to exactly one equipment slot (helmet/body/legs/boots/gloves) based on highest bone weight
- **Marching Triangles**: Splits boundary triangles at bone-weight isolines for smooth slot transitions (no jagged edges)
- **Curvature-Adaptive Offset**: Clamps offset at high-curvature areas (armpits, groin) to prevent self-intersection
- **Body-Constrained Laplacian Smooth**: Smooths shell surface while enforcing minimum distance from body
- **Boundary Tapering**: Gradual falloff at shell edges (0.5 → 1.0 over 3 rings) for smooth transitions
- **UV Seam Bridging**: Averages normals and positions across coincident vertices to prevent cracks

**Bulk Classes** (shell thickness):
```typescript
BULK_OFFSETS = {
  skin: 0.001,    // ~1mm
  cloth: 0.005,   // ~5mm
  leather: 0.012, // ~12mm
  plate: 0.03,    // ~30mm
}
```

#### 2. AI Texturing Integration
**Meshy Pipeline** (`ShellTextureService.ts`, `ArmorTextureService.ts`):
- Upload shell GLB as base64 data URI (no public URL needed)
- Retexture via Meshy API with text prompts or style reference images
- Batch tier generation (bronze → dragon) with staggered API calls
- Pre-painting shells with target color improves AI accuracy

**Tripo Pipeline** (`TripoService.ts`, `ArmorTripoService.ts`):
- STS S3 upload with AWS Signature V4 (no SDK dependency)
- Segment → per-part texture → reassemble workflow
- Text-to-model generation for 3D attachments (pauldrons, crests, guards)
- Bone-parented attachments with position/rotation/scale controls
- Session persistence via localStorage for retry resilience

**Material Presets**:
- **OSRS Tiers**: Bronze, Iron, Steel, Black, Mithril, Adamant, Rune, Dragon (solid colors with hex codes for Meshy-6 accuracy)
- **Fantasy Detailed**: Iron Plate, Leather, Cloth Robe, Steel Ornate, Mithril Elven, Dragon Scale (detailed AI prompts)
- **Detail Levels**: Plain → Minimal → Moderate → Ornate → Intricate (controls ornamentation amount)

#### 3. Automatic Rigging System
**New Module**: `packages/asset-forge/src/services/armor-pipeline/ShellRiggingService.ts` (469 lines)

Re-rigs textured shells by transferring bone weights from original shell:
- **Fast Path**: Vertex counts match → direct attribute copy (expected with `enable_original_uv`)
- **Fallback**: Vertex counts differ → nearest-vertex weight transfer by position distance
- **Full Skeleton Export**: Exports complete VRM skeleton with original bone indices preserved so game's simple skeleton swap works correctly
- **Publish to Game**: Writes rigged GLB to `packages/server/world/assets/models/` and updates `armor.json` manifest

#### 4. UI Components
**New Components**:
- `ShellGeneratorTab.tsx` (538 lines) — Extract shells from VRM avatars with region/shell/all-shells view modes
- `TextureGeneratorTab.tsx` (1,566 lines) — Apply solid colors, AI textures, or batch tier generation
- `TierGeneratorTab.tsx` (786 lines) — Batch-generate bronze → dragon tier variants with editable per-tier prompts
- `TripoGeneratorTab.tsx` (1,727 lines) — Experimental Tripo pipeline with segment → texture → attachments wizard
- `ArmorPreviewTab.tsx` (806 lines) — Rig textured armor and preview on animated avatar with publish-to-game
- `ShellPreviewViewer.tsx` (917 lines) — WebGPU 3D viewer with orbit controls, animation retargeting, bone attachments

**Shared Extraction Cache**: Single extraction result shared across Shell, Texture, and Tier tabs to avoid re-extracting the same avatar multiple times.

#### 5. API Endpoints
**New Routes** (`packages/asset-forge/server/routes/`):
- `POST /api/armor-pipeline/texture-shell` — Upload shell GLB + start Meshy retexture
- `POST /api/armor-pipeline/texture-shell-batch` — Batch retexture for multiple tiers
- `GET /api/armor-pipeline/texture-status/:taskId` — Poll texture task status
- `GET /api/armor-pipeline/texture-download/:taskId` — Download textured result (proxied)
- `POST /api/armor-pipeline/publish-to-game` — Publish rigged GLB to game model directory (localhost-only)
- `POST /api/tripo/upload-and-segment` — Upload → import → segment → return part names
- `POST /api/tripo/texture-part` — Texture specific parts with custom prompts
- `POST /api/tripo/complete` — Reassemble model after per-part texturing
- `POST /api/tripo/texture-shell` — Whole-model texture (no segments)
- `POST /api/tripo/text-to-model` — Generate 3D model from text prompt
- `GET /api/tripo/task/:taskId` — Poll Tripo task status
- `GET /api/tripo/download/:taskId` — Download Tripo result (proxied)
- `GET /api/tripo/balance` — Check Tripo account balance

**Security Features**:
- Path traversal prevention via `SAFE_PATH_RE` regex and `path.basename()` sanitization
- SSRF validation on download URLs (domain allowlists for Meshy/Tripo/S3)
- Localhost-only restriction on `/publish-to-game` endpoint via `server.requestIP()`
- Private IP blocking in `isValidPublicUrl()` (RFC 1918, link-local, loopback, CGN)
- Content-Length guards (100MB max) on external downloads
- Task ID format validation before URL interpolation

#### 6. Equipment Visual System Updates
**Updated Module**: `packages/shared/src/systems/client/EquipmentVisualHelpers.ts`

- **Metalness Override**: Zero metalness on all equipment materials (game has no environment map, so metallic PBR materials appear black)
- **Render Order Fix**: Equipment renderOrder set to 100 to render on top of player silhouette (renderOrder 50)
- **Double-Sided Materials**: Ensure DoubleSide rendering on multi-material meshes

**Environment Variables**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MESHY_API_KEY` | — | Meshy AI API key for retexturing (required for Meshy pipeline) |
| `TRIPO_API_KEY` | — | Tripo 3D AI API key (required for Tripo pipeline) |
| `PUBLIC_URL` | — | Public URL for shell GLB hosting (Meshy needs to fetch models) |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS (defaults to false in production if unset) |

**Key Files Changed**:
- `packages/asset-forge/server/routes/armor-pipeline.ts` — Meshy retexture + publish-to-game endpoints (new, 520 lines)
- `packages/asset-forge/server/routes/tripo-pipeline.ts` — Tripo segment/texture/text-to-model endpoints (new, 342 lines)
- `packages/asset-forge/server/services/armor-pipeline/ShellTextureService.ts` — Meshy API wrapper (new, 300 lines)
- `packages/asset-forge/server/services/armor-pipeline/TripoService.ts` — Tripo API wrapper with STS S3 upload (new, 757 lines)
- `packages/asset-forge/src/services/armor-pipeline/ShellExtractionService.ts` — Shell extraction from VRM (new, 2,058 lines)
- `packages/asset-forge/src/services/armor-pipeline/ShellRiggingService.ts` — Automatic rigging (new, 469 lines)
- `packages/asset-forge/src/pages/ArmorPipelinePage.tsx` — Main pipeline UI (new, 295 lines)
- `packages/shared/src/systems/client/EquipmentVisualHelpers.ts` — Metalness override + renderOrder fix

**Impact**:
- Complete armor pipeline from VRM avatar to game-ready GLB
- AI-powered texturing with Meshy and Tripo 3D
- Automatic rigging preserves perfect body fit
- Batch tier generation (8 OSRS tiers in one click)
- 3D bone attachments for unique armor pieces
- One-click publish to game model directory

### Autonomous Agent Quest System + LLM-Driven Behavior (April 8, 2026)

**Change** (PR #1124, Commit c7908a9): Complete autonomous agent system with quest progression, LLM decision-making, dashboard overhaul, and streaming duel enhancements.

**Scope**: 99 files changed, +16,116 additions, -1,943 deletions across server, client, and shared packages.

**Core Features**:

#### 1. Autonomous Quest System
Agents independently progress through all quest stage types without human intervention:
- **kill** — Target selection, combat engagement, prayer management
- **gather** — Resource identification, tool equipping, collection
- **interact** — Station usage (furnace, anvil, range, altar, spinning wheel)
- **craft/smelt/smith/fletch/cook/tan/runecraft** — Full production pipeline
- **dialogue** — NPC conversation progression
- **travel** — World map navigation with stuck detection

Quest stall detection shelves stuck quests after ~96s of no progress and retries after cooldown. Completion failure tracking prevents infinite loops on unreachable NPCs.

#### 2. LLM-Driven Behavior Decisions
**New Module**: `packages/server/src/eliza/llmBehaviorDecision.ts` (1,300 lines)

Replaces `pickBehaviorAction()` with an LLM call that receives:
- Inventory (scored by relevance, capped at 24 items)
- Nearby entities (scored and capped at 16)
- Active/available quests with stage progress
- Station positions, agent identity/vision, skill levels
- Other agents' goals (multi-agent coordination to avoid duplicated effort)
- Recent action history (stuck-loop detection)

Returns structured JSON: `action`, `reasoning`, `goal` update, multi-step `plan[]`, and chain-of-thought `thinking` for the dashboard.

**Fallback Strategy**: Falls back to scripted behavior on timeout (4s), parse failure, or during combat.

**Performance**: LLM calls run non-blocking — fired after each tick, result consumed on the next tick. Zero event loop blocking (was 1.5s/tick before the fix).

#### 3. Dashboard Interop
**New Module**: `packages/server/src/eliza/dashboardInterop.ts` (2,300 lines)

- `recordAgentThought()` — Logs decision points with type (situation/thinking/evaluation/decision/action) and decision path (llm/scripted/planner)
- `syncEmbeddedAgentDashboardForTick()` — Pushes real-time agent state to dashboard clients
- `resolveDashboardIntent()` — Parses operator chat commands into agent actions
- `ensureEmbeddedAgentCharacterVision()` — Initializes agent identity narrative
- `findWorldMapMoveTarget()` — Resolves destination names to world coordinates
- Batched persistence to `agent_thoughts` table (10s flush interval)

#### 4. Agent Worker Thread Overhaul
**Updated Modules**: `AgentBehaviorEngine.ts` (+1,100 lines), `AgentBehaviorBridge.ts` (+650 lines)

- Worker thread handles all scripted decision logic (quest management, inventory, equipment, shopping, eating)
- Bridge applies results on main thread: side effects first, then action execution
- Persistent navigation with stuck detection (position delta + distance-to-target tracking, 4-tick threshold)
- Combat interrupts during navigation (quest mobs and nearby aggro)
- Operator command grace period (30s) skips LLM override

#### 5. Streaming Duel Enhancements

**DuelCombatAI** — LLM combat strategy planning:
- `planStrategy()` generates approach (aggressive/defensive/balanced/outlast), attack style, prayer selection
- Trash talk system: HP milestone taunts, ambient taunts every 5-12 ticks, LLM-generated with scripted fallbacks
- Desperation logic for all combat roles
- Protection prayer switching based on opponent weapon type

**StreamingDuelScheduler** — Expanded lifecycle:
- Per-agent duel eligibility via `agent_mappings.streaming_duel_enabled` DB column
- `streamingDuelEligibilityDb.ts` shared lookup for consistent eligibility checks
- Duel history persistence (`streaming_duel_history` table) with damage stats

**Client streaming overlay**:
- `CombatLog.tsx` — Live fight event feed (hits, heals, criticals, kills)
- `PostFightStatsCard.tsx` — Per-fight stat breakdown
- `StreamingBettingRail.tsx` — Parimutuel betting CTA
- Enhanced `AgentStatsDisplay`, `StreamingOverlay`, `VictoryOverlay`

#### 6. Dashboard & Viewport Fixes

**Spectator viewfinder**:
- Fixed region subscriptions for embedded agents (no socket adapter) — spectators now receive entity updates when agents move
- Fixed `spectatorsByPlayer` map not being passed to `ConnectionHandler` (caused TypeError crash → reconnect flicker loop)
- Dashboard follow mode prevents streaming scheduler from hijacking camera to duel arena
- Entity lookup by character UUID (not just network ID) for spectator snapshots
- Player entities included in spectator snapshots (were missing from `world.entities.players`)

**Dashboard UI**:
- Viewport stays mounted across tab switches (CSS visibility toggle)
- Auto-activates live viewfinder when selected agent is running
- Agent memories, timeline, logs, and runs panels reworked
- `formatDashboardAgentReply.ts` — Normalize API response payloads

#### 7. Shared Package Changes
- **PlayerRemote**: Nametag sprites (floating name above characters, gold for agents)
- **EquipmentVisualSystem**: Hide melee weapon during magic/ranged attack animations
- **ClientCameraSystem**: Dashboard follow mode, cinematic HP-delta camera punch/shake
- **QuestSystem**: Manifest-driven quest definitions, stage-based progression, quest points
- **UIRenderer**: 4x resolution canvas pool for crisp nametag textures
- **ClientNetwork**: Inventory pruner uses setTimeout chain (stops when idle), embedded spectator auth token passthrough

#### 8. API Endpoints (15+ new)
- `POST /api/agents/credentials` — Generate 7-day agent JWT
- `POST /api/agents/wallet-auth` — Wallet-based agent auth
- `GET/POST/PATCH/DELETE /api/agents/mappings` — Full CRUD for agent-account mappings
- `POST /api/agents/:id/message` — Send chat commands to agents
- `GET /api/agents/:id/goal` / `POST .../goal` / `.../goal/unlock` / `.../goal/stop` / `.../goal/resume` — Goal management
- `GET /api/agents/:id/quests` — Quest state with progress
- `GET /api/agents/:id/activity` — Recent activity log
- `GET /api/agents/:id/quick-actions` — Available agent actions
- `POST /api/spectator/token` — Spectator view token generation

#### 9. Database Migrations
- **0052**: `streaming_duel_history` — Duel results with damage stats, indexed for leaderboard queries
- **0053**: `agent_mappings.streaming_duel_enabled` — Per-agent duel opt-out
- **0054**: `agent_thoughts` — Persistent agent reasoning for dashboard + post-game analysis

**Environment Variables**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMBEDDED_AGENT_LLM_BEHAVIOR` | `true` | Set `false` to disable LLM decisions, use pure scripted |
| `STREAMING_AGENT_FORCE_DUEL_LOBBY_SPAWN` | `false` | Override DB eligibility check for local dev |
| `AUTO_START_AGENTS_MAX` | `2` | Cap on auto-started agents from DB |

**Key Files Changed**:
- `packages/server/src/eliza/llmBehaviorDecision.ts` — LLM decision engine (new, 1,300 lines)
- `packages/server/src/eliza/dashboardInterop.ts` — Dashboard integration (new, 2,300 lines)
- `packages/server/src/eliza/managers/AgentBehaviorTicker.ts` — Quest/inventory/equipment management
- `packages/server/src/duel/DuelCombatAI.ts` — LLM combat strategy + trash talk
- `packages/client/src/game/dashboard/AgentViewportChat.tsx` — Live 3D viewfinder + chat sidebar
- `packages/client/src/components/streaming/CombatLog.tsx` — Live fight event feed (new, 361 lines)
- `packages/client/src/components/streaming/PostFightStatsCard.tsx` — Per-fight stats (new, 177 lines)
- `packages/client/src/components/streaming/StreamingBettingRail.tsx` — Betting CTA (new, 107 lines)

**Impact**:
- Agents autonomously complete all 7 quest types without human intervention
- LLM reasoning visible in dashboard for debugging and analysis
- Multi-agent coordination prevents duplicate effort
- Streaming duel system with full combat analytics and betting integration
- Dashboard viewfinder provides live 3D spectator view with chat
- Zero event loop blocking from LLM calls (non-blocking architecture)

### Terrain & Tree Visual Overhaul (April 5-7, 2026)

**Change** (PR #1126, Commits 1bf2342-3bb9875): Complete rewrite of tree rendering system with vertex-color-driven shaders, terrain color tuning, water shader improvements, and grass system simplification.

**Scope**: 82 files changed, +7,099 additions, -5,078 deletions across shared, procgen, server, and client packages.

**Tree System Overhaul**:
- **Vertex-Color Shader**: Trees now use vertex colors (R=leaf mask, G=AO, B=unused) for 4-band toon lighting with SSS, rim highlights, and wind animation
- **Per-Instance Frustum Culling**: `BatchedMesh.setVisibleAt()` provides per-tree frustum + distance culling without breaking instance ordering
- **Dissolve Transparency**: Depleted trees dissolve to ~70% transparency via screen-door dithering, animate back over 0.3s on respawn
- **Model Cache Fix**: Fixed serialization to correctly slice typed-array views instead of copying entire ArrayBuffer
- **Tree Type Cleanup**: Removed unused Willow and Fir tree types, updated biome allocations

**Terrain Shader Updates**:
- **Grass/Dirt Balance**: Lowered `DIRT_THRESHOLD` to show more dirt on flat terrain, updated fallback colors to match new `dirt.png` (sRGB 0.55, 0.48, 0.36)
- **Grass Color Fix**: Fixed yellow grass roots on brown dirt by updating `GrassWorker` hardcoded dirt constants to match new texture
- **Biome Tuning**: Reduced forest tree density, normalized scale variation to [1.0, 1.2], tuned grass configs (maxSlope, minGrassWeight, heightScale, patchScale)

**Water Shader Improvements**:
- **Flow-Mapped Normals**: Replaced fixed 4-layer scrolling normals with two-phase flow crossfade (FlowUVW technique) for organic, non-repeating water motion
- **Color Palette**: Shifted from bright blue to dark green-blue teal (shallow: sRGB 0.276, 0.541, 0.595; deep: darker teal)
- **Texture Loading**: Added `waterNormal.png` and `noise28.png` with procedural fallbacks

**Post-Processing**:
- Disabled color grading and depth blur effects (commented out in `createPostProcessing` config)
- Minimap restored after being accidentally hidden during frustum culling work

**Key Files Changed**:
- `packages/shared/src/systems/shared/world/GLBTreeBatchedInstancer.ts` - Per-instance frustum culling, dissolve system
- `packages/shared/src/systems/shared/world/GLBTreeInstancer.ts` - Dissolve support for InstancedMesh trees
- `packages/shared/src/systems/shared/world/DissolveAnimation.ts` - Shared dissolve state machine
- `packages/shared/src/systems/shared/world/GPUMaterials.ts` - Vertex-color tree shader with toon lighting, SSS, wind
- `packages/shared/src/systems/shared/world/TerrainBiomeTypes.ts` - Updated tree distributions, removed Willow/Fir
- `packages/shared/src/systems/shared/world/TerrainShader.ts` - Grass/dirt color updates
- `packages/shared/src/utils/workers/GrassWorker.ts` - Fixed dirt color constants
- `packages/shared/src/systems/shared/world/WaterSystem.ts` - Flow-mapped normals, teal color palette
- `packages/shared/src/utils/rendering/ModelCache.ts` - Fixed typed-array serialization

**Configuration** (`GPU_VEG_CONFIG` in `GPUMaterials.ts`):
```typescript
DISSOLVE_DURATION: 0.3      // Respawn animation duration (seconds)
DISSOLVE_MAX: 1.0           // Max dissolve progress (animation ceiling)
DISSOLVE_ALPHA_SCALE: 0.7   // Fraction of fragments discarded when dissolved
FADE_START: 1000            // Distance where far fade begins (meters)
FADE_END: 1200              // Distance where fully invisible (meters)
```

**Batch Color Channel Layout** (BatchedMesh trees):
```typescript
// R = highlight intensity (1.0 = normal, >1.0 = highlighted)
// G = biome snow weight (0.0 = no snow, 1.0 = full snow)
// B = 1.0 - dissolveVal (1.0 = fully visible, 0.0 = fully dissolved)
```

**Grass System Simplification**:
- **Replaced Compute Shader Pipeline**: Removed 3 compute shaders + SpriteNodeMaterial with single vertex shader mesh approach
- **New GrassVisualManager**: Centralized grass LOD management, worker-based instance generation, quad-tree integration (`packages/shared/src/systems/shared/world/GrassVisualManager.ts`, 1,232 lines)
- **Worker-Based Generation**: `GrassWorker.ts` generates grass instances off main thread with terrain color matching
- **LOD System**: Multi-tier LOD with distance-based transitions (configurable per biome)
- **Performance**: Reduced GPU overhead by eliminating compute shader dispatch, improved CPU-side culling
- **Terrain Color CPU Mirror**: `computeTerrainColorCPU()` provides CPU-side terrain color calculation matching GPU shader for grass color consistency

**Terrain Constants Centralization**:
- **New Module**: `packages/procgen/src/terrain/constants.ts` — Single source of truth for terrain defaults
- **Water Level Alignment**: `GAME_WATER_LEVEL = 16` matches `TERRAIN_CONSTANTS.WATER_THRESHOLD` in shared package
- **Procgen Defaults**: `DEFAULT_MAX_HEIGHT = 30`, `DEFAULT_WATER_THRESHOLD = 5.4` (standalone procgen scale)
- **Consistent Imports**: All procgen files now import from centralized constants instead of hardcoding values

**Sky & Lighting Improvements**:
- **LightingConfig.ts**: Centralized all lighting constants (sun colors, ambient, toon bands, fog)
- **Day/Night Cycle**: Enhanced sky system with cloud billboards, sun/moon positioning, atmospheric scattering
- **Fog Tuning**: Adjusted fog distances (400-800m) and colors to match new terrain palette
- **Camera Far Plane**: Increased from 800 to 10,000 for distant terrain visibility

**Biome Resource Generation**:
- **Poisson Disk Sampling**: Replaced rejection sampling with Poisson disk for better tree distribution (O(n) vs O(n×attempts))
- **Water Affinity System**: Trees can prefer water-adjacent placement with configurable `waterSearchRadius` (default 40m) and `waterMaxDistance` (default 30m)
- **Species Zoning**: Per-biome tree type distributions with altitude and water proximity rules
- **Tree Type Updates**: Removed Willow/Fir (no assets), added Eucalyptus, General, Magic, Mahogany, Banana, PineDead
- **Forest Density Tuning**: Reduced tree density, normalized scale variation to [1.0, 1.2], tightened cluster spacing (200→100m)

**Visual Manager Architecture**:
- **WaterVisualManager**: Manages water mesh lifecycle, flow-mapped normal updates, quad-tree integration
- **GrassVisualManager**: Handles grass LOD tiers, worker-based generation, chunk visibility
- **TerrainVisualManager**: Coordinates terrain mesh generation, collision baking, walkability processing
- **CompositeQuadTreeListener**: Shared quad-tree for all visual managers (terrain, water, grass)

**Day/Night Cycle Enhancements**:
- **Cloud Billboards**: Procedural cloud sprites with sun/moon positioning
- **Atmospheric Scattering**: Enhanced sky gradient with time-of-day color shifts
- **Fog Tuning**: Adjusted fog distances (400-800m) and colors to match terrain palette
- **Camera Far Plane**: Increased from 800 to 10,000 for distant terrain visibility

**LOD Distance Changes**:
- Tree LOD1: 30m → 800m
- Tree LOD2: 60m → 1000m
- Tree fade: 180m → 1800m
- Fog: 60-150m → 400-800m

**Impact**:
- Photorealistic tree rendering with toon-shaded foliage
- Smooth resource depletion/respawn feedback
- Improved terrain color accuracy matching reference screenshots
- Organic water motion without repetitive patterns
- Better performance via per-instance frustum culling and simplified grass pipeline
- Eliminated tree type confusion (Willow/Fir had no assets)
- Centralized constants prevent drift between procgen and game runtime
- More natural tree placement with Poisson disk sampling

### Resource LOD Asset Inference Fix (April 8, 2026)

**Change** (Commit de65585): Stop inferring missing resource LOD assets to prevent runtime errors.

**Problem**: The resource system was attempting to infer LOD asset paths for resources that don't have LOD models, causing 404 errors and visual glitches when resources were loaded.

**Fix**: Only load explicitly defined LOD assets from the resource manifest. If a resource doesn't have LOD1/LOD2 defined, use the base model for all LOD levels instead of inferring paths.

**Impact**:
- Eliminates 404 errors for missing LOD assets
- Resources without LOD models render correctly at all distances
- Cleaner asset loading pipeline without inference logic

### Client Runtime Environment Hydration (April 7, 2026)

**Change** (Commits 8753bb6, ebbb9ed): Fixed auth configuration to resolve from runtime environment.

**Problem**: Client auth config was reading from build-time environment variables, causing auth failures in production when runtime env differed from build env.

**Fix**: Hydrate runtime environment before auth bootstrap. Auth config now resolves from `window.__RUNTIME_ENV__` injected at runtime via `public/env.js`.

**Key Changes**:
- `packages/client/src/lib/api-config.ts` now reads from runtime env
- Auth bootstrap waits for runtime env hydration
- Production deployments (Railway, Cloudflare) inject runtime config correctly

**Impact**:
- Auth works correctly in production environments
- Runtime configuration overrides build-time defaults
- Fixes "Invalid Privy App ID" errors in deployed environments

### Railway Production Defaults (April 5-6, 2026)

**Change** (Commits ba7f6f4, bc647e3, 4fd1d44): Aligned production runtime defaults for hyperscape.gg deployment.

**Key Changes**:
- Production API defaults to `https://hyperscape.gg` for server runtime
- Local development defaults to `ws://localhost:5556/ws` for agent runtime
- Railway deployment uses Debian Trixie runtime for uWebSockets.js GLIBC 2.38+ requirement
- Restored Railway deployment targets after CI fixes

**Configuration**:
```bash
# Production (Railway)
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws

# Local development
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5556/ws
```

**Impact**:
- Simplified production deployment configuration
- Consistent defaults across environments
- uWebSockets.js works correctly on Railway with Trixie runtime

### Tailwind CSS Updates (April 2026)

**Change** (PR #1105, subsequent updates): Tailwind CSS build pipeline stabilization.

**Timeline**:
- April 4: Temporarily rolled back to Tailwind v3.4.1 due to production artifact issues
- Later: Upgraded to Tailwind v4.1.14 with `@tailwindcss/postcss` plugin

**Current State** (Tailwind v4.1.14):
- Uses official `@tailwindcss/postcss` Vite plugin
- Stable CSS generation across all build environments
- Consistent auth and character screen styling in production Docker images

### Docker Build Fixes (April 6, 2026)

**Change** (Commits fca9ffb-cb237b6): Fixed Docker build failures and CI pipeline issues.

**Key Changes**:
- Added defensive `mkdir -p` for `packages/web3/node_modules` and `packages/client/node_modules` to prevent COPY failures when Bun hoists deps
- Fixed empty downloads handling in CI
- Resolved Railway auth drift issues
- Switched Docker builds to use real Node.js for Vite builds

**Impact**: 
- Reliable Docker image builds
- No more missing node_modules directory errors
- Improved CI/CD stability

### CI/CD Workflow Updates (April 6, 2026)

**Change** (Commits 15e62b9, 9d45fae, 5dbd8b9): Updated GitHub Actions workflows for Node.js 24 runners.

**Key Changes**:
- Upgraded actions to support Node.js 24 runners
- Fixed Claude code review workflow token permissions
- Updated workflow dependencies for latest GitHub Actions environment

**Impact**:
- CI/CD pipelines compatible with latest GitHub infrastructure
- Improved workflow reliability and performance

### UI Panel Tooltip System (March 27, 2026)

**Change** (PR #1102): Unified tooltip styling across all UI panels.

**New Files**:
- `packages/client/src/ui/core/tooltip/tooltipStyles.ts` - Centralized tooltip style utilities

**Key Functions**:
```typescript
getTooltipTitleStyle(theme, accentColor?)  // Title text styling
getTooltipMetaStyle(theme)                 // Metadata/secondary text
getTooltipBodyStyle(theme)                 // Body content
getTooltipDividerStyle(theme, accentColor?) // Section dividers
getTooltipTagStyle(theme)                  // Tag/badge styling
getTooltipStatusStyle(theme, tone)         // Status indicators (success/danger/warning)
```

**Impact**: 
- Consistent tooltip appearance across inventory, equipment, bank, spells, prayer, skills, trade, store, and loot panels
- Eliminated ~500 lines of duplicated styling code
- Better visual hierarchy and readability

### Tree Dissolve Transparency (March 27, 2026)

**Change** (PR #1101): Added screen-door dithered dissolve for depleted trees.

**Features**: Depleted trees become ~70% transparent instantly, animate back to full opacity over 0.3s on respawn.

**New Module**: `packages/shared/src/systems/shared/world/DissolveAnimation.ts`

**Key APIs**:
```typescript
startDissolve(anims, entityId, direction, instant, applyFn)
tickDissolveAnims(anims, deltaTime, applyFn)
```

**Configuration** (`GPU_VEG_CONFIG` in `GPUMaterials.ts`):
```typescript
DISSOLVE_DURATION: 0.3      // Animation duration (seconds)
DISSOLVE_MAX: 1.0           // Max dissolve progress
DISSOLVE_ALPHA_SCALE: 0.7   // Fraction of fragments discarded
```

**Impact**: 
- Visual feedback for resource depletion/respawn
- Stays in opaque render pass (no transparency sorting overhead)
- Smooth LOD transitions without visual pops

### Tree Collision Proxy (March 27, 2026)

**Change** (PR #1100): Use LOD2 model geometry for tree collision instead of oversized cylinder.

**Problem**: Cylinder hitbox (0.4 radius factor) was too large, intercepting ground clicks near trees.

**Fix**: Use actual LOD2 mesh geometry for pixel-accurate collision. Falls back to tighter cylinder (0.25 radius) if LOD unavailable.

**New APIs**:
```typescript
// GLBTreeInstancer.ts, GLBTreeBatchedInstancer.ts
getProxyGeometry(entityId): { geometries, yOffset } | null
clearProxyGeometryCache(): void  // Call during world teardown
```

**Impact**: 
- Clicks only register on visible tree silhouette
- Ground clicks near trees work correctly
- Cached geometry reduces CPU overhead

### Resource Respawn System (March 27, 2026)

**Change** (PR #1099): Made resource respawn purely tick-based, use manifest `depleteChance` for mining.

**Problem**: `setTimeout`-based respawn was non-deterministic. Mining used hardcoded `MINING_DEPLETE_CHANCE` instead of manifest values.

**Fix**: Remove `setTimeout` entirely. Respawn handled by `ResourceSystem.processRespawns()` via tick counting. Mining reads `depleteChance` from manifest.

**Key Changes**:
- Removed `MINING_DEPLETE_CHANCE` and `MINING_REDWOOD_DEPLETE_CHANCE` constants
- Resources with `depleteChance: 0` never deplete (rune essence rocks)
- Deterministic tick-based respawn timing

**Impact**: 
- OSRS-accurate resource mechanics
- Rune essence rocks work correctly (never deplete)
- Predictable respawn timing

## Recent Changes (March 2026)

### Performance & Scalability Overhaul (March 19-20, 2026)

**PR #1064**: Major architectural changes to improve server tick reliability and support 50+ concurrent players with 25+ AI agents.

**Key Changes**:
1. **Server Runtime Migration**: Bun → Node.js 22+ (V8 incremental GC eliminates 500-1200ms stop-the-world pauses)
2. **uWebSockets.js Integration**: Native pub/sub broadcasting on port 5556 (eliminates O(n) socket iteration)
3. **Agent AI Worker Thread**: Decision logic runs off main thread (eliminates 200-600ms blocking)
4. **BFS Pathfinding Optimization**: Global iteration budget, zero-allocation scratch tiles, per-tick walkability cache
5. **Terrain System Optimization**: Low-res collision (16×16), time-budgeted processing, pre-baked walkability flags
6. **Tick System Reliability**: Drift correction, health monitoring, per-handler timing

**Impact**:
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%
- Scalability: 20 players + 10 agents → 50+ players + 25+ agents

**Breaking Changes**:
- Server now requires Node.js 22+ (Bun no longer supported for server runtime)
- WebSocket port changed from 5555 → 5556 (uWS, configurable with `UWS_PORT`)
- Client `PUBLIC_WS_URL` must be updated to `ws://localhost:5556/ws`

**Configuration**:
```bash
# Server runtime (REQUIRED)
node >= 22.0.0

# WebSocket transport
UWS_ENABLED=true          # Enable uWS (default: true)
UWS_PORT=5556             # uWS port (default: 5556)
PUBLIC_WS_URL=ws://localhost:5556/ws

# Agent AI worker thread
EMBEDDED_BEHAVIOR_TICK_INTERVAL=8000  # Agent tick interval (ms)
AGENT_STAGGER_OFFSET_MS=800           # Stagger offset (ms)
MAX_AGENTS_PER_POLL=5                 # Max agents per poll cycle

# BFS pathfinding
MAX_BFS_ITERATIONS_PER_TICK=12000     # Global budget
DEFAULT_MAX_ITERATIONS=4000           # Per-call limit

# Terrain system
SERVER_COLLISION_RESOLUTION=16        # Collision mesh resolution
COLLISION_BUDGET_MS=8                 # Collision queue budget (ms)
WALKABILITY_BUDGET_MS=4               # Walkability baking budget (ms)
```

**Files Changed**: 54 files, 6,502 additions, 1,164 deletions

**Documentation**: See `docs/performance-march-2026.md` for complete details.

### VRM Material Isolation Fix (March 17, 2026)

**Change** (PR #1061, Commit 364d0a5): Isolated VRM clone materials to prevent highlight bleed across mob instances.

**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type. When hovering over a goblin, all goblins in the world would highlight simultaneously.

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Implementation** (`packages/shared/src/rendering/materials/cloneGLB.ts`):
```typescript
// Clone material to prevent shared state across instances
// Textures are shared by reference (memory efficient)
// but outputNode and uniforms are per-instance
const clonedMaterial = new MeshStandardNodeMaterial();
clonedMaterial.copy(originalMaterial);
// ... copy all material properties
mesh.material = clonedMaterial;
```

**Impact**: 
- Each mob instance now has independent highlight state
- Hovering over one goblin no longer highlights all goblins
- Textures remain shared for memory efficiency
- Fixes visual bug where all VRM mobs of same type would highlight together

### Mob AI Tick Processing Fix (March 17, 2026)

**Change** (PR #1060, Commit a55079e): Wired mob AI tick processing into server tick loop to enable mob state machine transitions.

**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Implementation** (`packages/server/src/systems/ServerNetwork/index.ts`):
```typescript
// OSRS-ACCURATE: Process mob AI BEFORE mob movement each tick
// AI state machine (IDLE → WANDER → CHASE → ATTACK → RETURN) decides movement targets,
// then mob tile movement executes the path on the same tick.
// Without this, mobs stand idle forever because MobEntity.serverUpdate() defers
// AI ticking to the tick system for deterministic OSRS ordering.
const MOB_AI_DELTA_SECONDS = TICK_DURATION_MS / 1000;
this.tickSystem.onTick(() => {
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof MobEntity)) continue;
    if (entity.getHealth() <= 0) continue;
    entity.runAITick(MOB_AI_DELTA_SECONDS);
  }
}, TickPriority.MOVEMENT);

// Register mob tile movement to run on each tick (same priority as player movement)
// Runs AFTER mob AI so paths set by AI are executed this tick
this.tickSystem.onTick((tickNumber) => {
  this.mobTileMovementManager.onTick(tickNumber);
}, TickPriority.MOVEMENT);
```

**Impact**: 
- Mob AI state machines now function correctly
- Goblins and other mobs properly transition through IDLE → WANDER → CHASE → ATTACK states
- Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)
- Fixes mobs standing idle forever after spawn

### Dev Server Watcher CPU Fix (March 16, 2026)

**Change** (PR #1034, Commit 7b5bf08): Fixed dev server watcher burning 100% CPU when idle.

**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms — redundant since the script already debounces rebuilds itself
2. Polling fallback does a full recursive directory walk every 1s

**Fix** (`packages/server/scripts/dev.mjs`):
```javascript
// Removed awaitWriteFinish (redundant with existing 200ms debounce)
const watcher = chokidar.watch(watchRoots, {
  ignoreInitial: true,
  // awaitWriteFinish removed - script already debounces via setTimeout
});

// Increased polling fallback interval from 1s to 5s
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

### Docker Build Improvements (March 15, 2026)

**Change** (PR #1033, Commit 7519105): Major Dockerfile improvements for production deployment.

**Key Changes**:
- **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds
- **Client Build**: Added `packages/client` build to Docker image (required for multi-service deployments)
- **Workspace Symlinks**: Manually recreate Bun workspace symlinks after Docker COPY (COPY flattens symlinks)
- **Per-Package node_modules**: Bun 1.3 no longer hoists all deps to root - explicitly copy package-level node_modules
- **better-sqlite3 Removal**: Strip from manifests before install (segfaults under QEMU cross-compilation)
- **Manifest Embedding**: Copy manifests from builder stage to ensure cleaned versions are used

**Implementation** (`packages/server/Dockerfile`):
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

### Dependency Updates (March 19, 2026)

**Major Updates**:
- **Vite**: 6.4.1 → 8.0.0 (major version bump for build system)
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1 (React plugin compatibility)
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (test coverage tooling)
- **jsdom**: 28.1.0 → 29.0.0 (testing environment)
- **jest**: 29.7.0 → 30.3.0 (testing framework)
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6 (smart contract tooling)
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support)
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (mobile wallet integration)
- **sqlite3**: 5.1.7 → 6.0.1 (SQLite database driver)
- **Tailwind CSS**: Upgraded to 4.1.14 (stable, using @tailwindcss/postcss plugin)

**Impact**:
- Latest build tooling with improved performance and faster builds
- Better React 19 compatibility with new Fast Refresh implementation
- Updated testing environment with Jest 30.x and jsdom 29.x
- Latest VRM avatar features and improvements
- Improved mobile wallet support for Solana
- Updated TypeScript definitions matching Three.js 0.183.2
- Enhanced test coverage reporting with Vitest 4.1
- SQLite 6.x with performance improvements and bug fixes
- Stable Tailwind CSS build pipeline

See CLAUDE.md for complete documentation.
