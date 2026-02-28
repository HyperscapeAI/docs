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

### WebGPU Initialization
- **Adapter Request Timeout**: 30s timeout on `navigator.gpu.requestAdapter()` to prevent indefinite hangs
- **Renderer Init Timeout**: 60s timeout on `renderer.init()` to detect GPU driver issues
- **Preflight Testing**: `testWebGpuInit()` runs on blank page before loading game content
- **GPU Diagnostics**: `captureGpuDiagnostics()` extracts chrome://gpu info for debugging
- Timeouts help diagnose misconfigured GPU servers where WebGPU initialization hangs

### Server/Streaming (Vast.ai)
- NVIDIA GPU with Vulkan support is REQUIRED
- Must run headful with Xorg or Xvfb (NOT headless Chrome)
- Chrome uses ANGLE/Vulkan for WebGPU
- If WebGPU cannot initialize, deployment MUST FAIL

#### Vast.ai Deployment Architecture
The streaming pipeline requires specific GPU setup:

1. **GPU Rendering Modes** (tried in order):
   - **Xorg with NVIDIA**: Best performance, requires DRI/DRM device access
   - **Xvfb with NVIDIA Vulkan**: Virtual framebuffer + GPU rendering via ANGLE/Vulkan
   - **Ozone Headless with GPU**: Experimental mode using `--ozone-platform=headless` with GPU rendering
   - **Headless mode (software)**: NOT SUPPORTED - WebGPU will not work

2. **Audio Capture**:
   - PulseAudio with `chrome_audio` virtual sink
   - FFmpeg captures from PulseAudio monitor (`chrome_audio.monitor`)
   - Configurable via `STREAM_AUDIO_ENABLED` and `PULSE_AUDIO_DEVICE`
   - User-mode PulseAudio with XDG_RUNTIME_DIR at `/tmp/pulse-runtime`

3. **RTMP Multi-Streaming**:
   - Simultaneous streaming to Twitch, Kick, X/Twitter (YouTube disabled)
   - FFmpeg tee muxer for single-encode multi-output
   - Stream keys configured via environment variables (never hardcoded)
   - All secrets read from `.env` file or GitHub Secrets

4. **Deployment Validation**:
   - Script verifies NVIDIA GPU is accessible via `nvidia-smi`
   - Checks Vulkan ICD availability at `/usr/share/vulkan/icd.d/nvidia_icd.json`
   - Logs actual ICD content and VK_LOADER_DEBUG output for diagnostics
   - Ensures display server (Xorg/Xvfb) is running and accessible
   - Runs WebGPU pre-check test with Chrome to verify navigator.gpu availability
   - Extracts Chrome GPU info (WebGPU/Vulkan status) during deployment
   - Fails deployment if WebGPU cannot be initialized (no soft fallbacks)
   - Persists GPU/display settings to `.env` for PM2 restarts
   - Exports working GPU mode (Xorg/Xvfb/ozone-headless) for ecosystem.config.cjs

5. **Production Client Build**:
   - When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
   - Serves pre-built client via `vite preview` instead of dev server
   - Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
   - Significantly faster page loads for streaming (no on-demand module compilation)

6. **Stream Capture Modes**:
   - **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
   - **WebCodecs**: Native VideoEncoder API (experimental)
   - **MediaRecorder**: Legacy fallback mode
   - Automatic recovery with viewport restoration on resolution mismatch
   - 5s timeout on probe evaluate calls to prevent hanging
   - Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)

7. **Stream Encoding Optimization**:
   - Default: `film` tune with B-frames for better compression
   - Set `STREAM_LOW_LATENCY=true` for `zerolatency` tune (faster playback start)
   - Configurable GOP size via `STREAM_GOP_SIZE` (default: 60 frames)
   - 4x bitrate buffer multiplier for smoother playback
   - Audio buffering with `thread_queue_size=1024` and async resampling

8. **WebGPU Diagnostics**:
   - `captureGpuDiagnostics()` extracts chrome://gpu info at startup
   - `testWebGpuInit()` preflight test detects WebGPU hangs early
   - Runs on blank page before loading heavy game content
   - Provides debugging info when WebGPU fails on remote GPU servers
   - 30s adapter timeout and 60s renderer init timeout prevent indefinite hangs

See `scripts/deploy-vast.sh` for complete setup logic.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on Three.js WebGPURenderer with TSL shaders.

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces

## Tech Stack

- Runtime: Bun v1.1.38+
- Rendering: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- Engine: Three.js 0.180.0, PhysX (WASM)
- UI: React 19.2.0
- Server: Fastify, WebSockets
- Database: PostgreSQL (production), Docker (local)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
npm test             # Run tests
```

## File Structure

```
packages/
├── shared/          # Core engine (ECS, Three.js, networking)
├── server/          # Game server (Fastify)
├── client/          # Web client (Vite + React)
├── physx-js-webidl/ # PhysX WASM bindings
├── procgen/         # Procedural generation
└── asset-forge/     # AI asset generation + VFX catalog
```

## Performance Optimizations

### Instanced Rendering
Hyperscape uses instanced rendering for resource entities (rocks, ores, herbs, trees):
- **GLBResourceInstancer**: Pools instances by model path, separate InstancedMesh per LOD level
- **GLBTreeInstancer**: Specialized instancer for tree resources with dissolve materials
- **InstancedModelVisualStrategy**: Thin wrapper with invisible collision proxies for raycasting
- Reduces draw calls from O(n) per resource to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis to prevent flickering
- Falls back to StandardModelVisualStrategy if instancing fails

**Depleted Models** (NEW):
- Resources can specify `depletedModelPath` and `depletedModelScale` in config
- Instancer maintains separate pools for normal and depleted states (e.g., tree → stump)
- Automatic transition on resource depletion without individual model loading
- Collision proxy persists across state transitions
- Highlight mesh support for hover/selection on instanced entities

**API Changes**:
- `ResourceVisualStrategy.onDepleted()` now returns `boolean`
  - `true` = strategy handled depletion (instanced stump)
  - `false` = ResourceEntity should load individual depleted model
- New optional method: `getHighlightMesh(ctx)` for instanced entity highlighting
- `EntityHighlightService` supports instanced highlight meshes via `getHighlightRoot()`

### Model Cache Integrity
- **Index Buffer Type Preservation**: Model cache now preserves original index buffer type (Uint16Array vs Uint32Array)
- Fixes silent geometry corruption and RangeError crashes on cached model restore
- Cache version bumped to 4 to invalidate corrupt entries
- Affects all GLB models loaded via ModelCache (resources, NPCs, items)

See CLAUDE.md for complete documentation.
