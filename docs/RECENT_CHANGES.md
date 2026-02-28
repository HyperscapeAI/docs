# Recent Changes (February 2026)

Major updates and improvements to Hyperscape.

## Breaking Changes

### WebGPU-Only Rendering (v0.2.0)

**BREAKING:** WebGL support has been completely removed. WebGPU is now REQUIRED.

**Reason:** All materials use TSL (Three Shading Language) which only works with WebGPU. There is no WebGL fallback path.

**Impact:**
- Minimum browser versions: Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- Removed: `isWebGLAvailable()`, `isWebGLForced()`, `forceWebGL` parameter
- Removed: All WebGL fallback code in RendererFactory
- Removed: `--disable-webgpu` and `forceWebGL` flags from streaming

**Migration:**
```typescript
// Before
const renderer = await createRenderer({ forceWebGL: false });

// After
const renderer = await createRenderer();
// Always WebGPU, no options needed
```

**See:** [docs/api/renderer-factory.md](api/renderer-factory.md) for API changes.

## New Features

### Instanced Rendering for Resources

**Added:** GPU instancing for rocks, ores, herbs, and other non-tree resources.

**Benefits:**
- Reduces draw calls from O(n) to O(1) per unique model
- 40% FPS improvement with 1500+ resources
- Distance-based LOD switching with hysteresis
- Depleted state support with separate models
- Highlight mesh support for hover effects

**Components:**
- `GLBResourceInstancer` - Instance pool manager
- `InstancedModelVisualStrategy` - Visual strategy for resources
- Automatic fallback to `StandardModelVisualStrategy` if pool full

**Usage:**
```typescript
// Automatic - no code changes needed
// Resources with GLB models automatically use instancing
```

**See:** [docs/instanced-rendering.md](instanced-rendering.md) for details.

### AI Agent Improvements

**Added:** Action locks, fast-tick mode, and short-circuit decision making.

**Features:**
1. **Action Locks** - Prevent LLM ticks during movement/actions
2. **Fast-Tick Mode** - 2s interval for 30s after action completion
3. **Short-Circuit LLM** - Skip LLM for obvious decisions (repeat resource, banking)
4. **Banking Goal Type** - Auto-restore previous goal after banking
5. **Movement Awaiting** - `waitForMovementComplete()` for reliable action chains
6. **Depleted Filtering** - Skip depleted resources in nearby entity checks

**Benefits:**
- 65% reduction in LLM API costs
- 60% faster action chains
- More predictable behavior
- Reliable banking/gathering loops

**API:**
```typescript
// Wait for movement
await service.executeMove({ target: [100, 0, 200] });
await service.waitForMovementComplete();

// Check movement status
if (service.isMoving) {
  // Still moving
}
```

**See:** [docs/ai-agent-improvements.md](ai-agent-improvements.md) for details.

### GPU Streaming Architecture

**Added:** Comprehensive Vast.ai deployment with WebGPU support.

**Features:**
1. **Xorg/Xvfb GPU Rendering** - Automatic mode detection
2. **PulseAudio Audio Capture** - Game music and sound effects
3. **CDP Screencast Capture** - 2-3x faster than MediaRecorder
4. **RTMP Multi-Streaming** - Twitch, Kick, X/Twitter simultaneously
5. **Automatic Recovery** - Soft/hard restart on capture stall
6. **Browser Rotation** - Hourly restart to prevent GPU memory leaks

**Configuration:**
```bash
# GPU rendering (auto-configured)
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false

# Audio capture
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# Video capture
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80
STREAM_FPS=30
```

**See:** [docs/vast-ai-streaming.md](vast-ai-streaming.md) for complete guide.

## Improvements

### Streaming Enhancements

**Audio Capture:**
- PulseAudio virtual sink (`chrome_audio`)
- FFmpeg captures from monitor device
- Fallback to silent audio if PulseAudio fails
- User-mode PulseAudio (more reliable)

**Video Capture:**
- CDP screencast mode (default, 2-3x faster)
- Resolution tracking and mismatch detection
- Automatic viewport recovery
- Frame rate monitoring

**Encoding:**
- Configurable GOP size (`STREAM_GOP_SIZE`)
- Low-latency mode option (`STREAM_LOW_LATENCY`)
- Improved buffering (4x bitrate)
- Film tune for better compression

**Recovery:**
- Soft recovery: Restart CDP without stream gap
- Hard recovery: Restart browser with brief gap
- Fallback to MediaRecorder after 6 failures
- Configurable timeouts and retry limits

### Deployment Improvements

**Vast.ai:**
- Automatic GPU mode detection (Xorg vs Xvfb)
- Vulkan ICD validation
- Display server verification
- Fail-fast if WebGPU unavailable
- Persist GPU settings to `.env` for PM2 restarts
- Comprehensive diagnostics at end of deploy

**Secrets Management:**
- Secrets written to `/tmp` before git reset
- Automatic fallback to environment variables
- Explicit YouTube disabling
- JWT_SECRET and ARENA_EXTERNAL_BET_WRITE_KEY added

**Database:**
- Connection warmup with retries
- Explicit schema push with `--force`
- Better error handling

### Client Improvements

**CSP Updates:**
- Allow `data:` URLs for WASM loading
- Allow Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
- Allow Cloudflare Insights
- Remove broken report-uri

**Rendering:**
- Updated WebGL references to WebGPU in comments
- Settings panel always shows "WebGPU"
- Visual testing uses 2D canvas for pixel reading (WebGPU compatible)

### Resource System

**Instanced Highlight Meshes:**
- Preload highlight mesh from LOD0
- Support for depleted highlight meshes
- Automatic cleanup on state transition
- `getHighlightMesh()` method on visual strategies

**Depleted Models:**
- Separate depleted model pool
- Configurable depleted scale
- Automatic transition on depletion/respawn
- Preserve collision proxy on respawn

## Bug Fixes

### Streaming

- Fixed PulseAudio permissions (add root to pulse-access group)
- Fixed missing `STREAM_CAPTURE_USE_EGL` variable
- Fixed X server socket cleanup before Xvfb start
- Fixed headless EGL env var passing to PM2
- Fixed Xorg swrast fallback detection
- Fixed resolution mismatch recovery

### Deployment

- Fixed secrets injection (use `/tmp` to survive git reset)
- Fixed bun installation (install unzip first)
- Fixed first-time Vast.ai setup (clone repo if missing)
- Fixed multi-line commit messages in Pages deploy

### Client

- Fixed vite-plugin-node-polyfills shims resolution
- Fixed Google Fonts CSP blocking
- Fixed WASM loading with data: URLs

## Deprecations

### Removed

- `isWebGLAvailable()` - WebGL no longer supported
- `isWebGLForced()` - WebGL forcing removed
- `isWebGLFallbackAllowed()` - No fallback path
- `UniversalRenderer` type - Use `WebGPURenderer`
- `forceWebGL` parameter - Ignored if present
- `STREAM_CAPTURE_DISABLE_WEBGPU` - Ignored (WebGPU required)
- `DUEL_FORCE_WEBGL_FALLBACK` - Ignored (WebGPU required)

### Deprecated (Still Present)

These environment variables are kept for backwards compatibility but ignored:

- `STREAM_CAPTURE_DISABLE_WEBGPU` - Always false
- `DUEL_FORCE_WEBGL_FALLBACK` - Always false
- `STREAM_CAPTURE_USE_EGL` - Not supported (WebGPU requires display)

## Environment Variables

### New Variables

**GPU/Display:**
- `GPU_RENDERING_MODE` - Auto-detected rendering mode
- `VK_ICD_FILENAMES` - Force NVIDIA Vulkan ICD
- `XDG_RUNTIME_DIR` - PulseAudio runtime directory

**Audio:**
- `STREAM_AUDIO_ENABLED` - Enable audio capture
- `PULSE_AUDIO_DEVICE` - PulseAudio monitor device
- `PULSE_SERVER` - PulseAudio socket path

**Video Capture:**
- `STREAM_CAPTURE_MODE` - Capture mode (cdp/mediarecorder)
- `STREAM_CDP_QUALITY` - JPEG quality for CDP
- `STREAM_CAPTURE_CHANNEL` - Browser channel
- `STREAM_CAPTURE_EXECUTABLE` - Custom browser path
- `STREAM_CAPTURE_ANGLE` - ANGLE backend

**Encoding:**
- `STREAM_LOW_LATENCY` - Enable zerolatency tune
- `STREAM_GOP_SIZE` - Keyframe interval

**Recovery:**
- `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` - Recovery timeout
- `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` - Max failures

**Secrets:**
- `JWT_SECRET` - JWT signing secret
- `ARENA_EXTERNAL_BET_WRITE_KEY` - Arena betting API key

### Changed Variables

- `DISPLAY` - Now auto-configured by deploy script
- `DUEL_CAPTURE_USE_XVFB` - Now auto-configured
- `STREAM_CAPTURE_HEADLESS` - Always false (WebGPU requires display)

## Performance

### Rendering

**Before instancing:**
- 1500 resources = 1500 draw calls
- ~30-40 FPS

**After instancing:**
- 1500 resources = 6 draw calls
- ~55-60 FPS

**Improvement:** 40% FPS increase.

### AI Agents

**Before optimizations:**
- 360 LLM calls/hour
- ~$0.50/hour (GPT-4)
- 30s banking round trip

**After optimizations:**
- 126 LLM calls/hour
- ~$0.18/hour (GPT-4)
- 12s banking round trip

**Improvement:** 65% cost reduction, 60% faster actions.

### Streaming

**CDP vs MediaRecorder:**
- CDP: 2-3x faster frame capture
- CDP: No browser-side encoding overhead
- CDP: Single encode step (JPEG → H.264)
- MediaRecorder: Browser encodes VP8/VP9, then FFmpeg re-encodes

## Known Issues

### WebGPU Compatibility

- Firefox WebGPU is behind flag (not recommended)
- Safari 18 requires macOS 15+
- Some WebViews may block WebGPU

**Workaround:** Use Chrome 113+ or Edge 113+.

### GPU Memory Leaks

Chrome + WebGPU can leak GPU memory over time.

**Workaround:** Automatic browser rotation every hour (streaming only).

### Instanced Rendering Limits

- Max 512 instances per model per LOD level
- No per-instance material properties
- No skeletal animation support

**Workaround:** Use multiple model variants or standard mesh instances.

## Upgrade Guide

### From v0.1.x to v0.2.0

1. **Update browser** to Chrome 113+, Edge 113+, or Safari 18+
2. **Remove WebGL code** - No longer supported
3. **Update renderer creation**:
   ```typescript
   // Before
   const renderer = await createRenderer({ forceWebGL: false });
   
   // After
   const renderer = await createRenderer();
   ```
4. **Update materials** - Use TSL node materials:
   ```typescript
   // Before
   import { MeshStandardMaterial } from 'three';
   
   // After
   import { MeshStandardNodeMaterial } from 'three/webgpu';
   ```
5. **Test WebGPU** - Verify at [webgpureport.org](https://webgpureport.org)

### Streaming Setup

1. **Set stream keys** in GitHub Secrets:
   - `TWITCH_STREAM_KEY`
   - `KICK_STREAM_KEY` + `KICK_RTMP_URL`
   - `X_STREAM_KEY` + `X_RTMP_URL`

2. **Configure Vast.ai** instance:
   - NVIDIA GPU (RTX 3060+ recommended)
   - Ubuntu 20.04+
   - 16GB+ RAM

3. **Deploy** via GitHub Actions or manual SSH

4. **Monitor** via PM2 logs and RTMP status file

## Contributors

- [@lalalune](https://github.com/lalalune) - WebGPU enforcement, streaming architecture
- [@tcm390](https://github.com/tcm390) - Instanced rendering, highlight meshes
- [@dreaminglucid](https://github.com/dreaminglucid) - AI agent improvements

## References

- [Commit 47782ed](https://github.com/HyperscapeAI/hyperscape/commit/47782ed95690bfb2dd4c91798fb02e734f6efa57) - WebGPU-only enforcement
- [Commit 53a9513](https://github.com/HyperscapeAI/hyperscape/commit/53a9513a6526386e675f299ec3f87fe0554e0a92) - Instanced rendering
- [Commit 60a03f4](https://github.com/HyperscapeAI/hyperscape/commit/60a03f49d48f6956dc447eceb1bda5e7554b1ad1) - AI agent improvements
- [Commit 3b6f1ee](https://github.com/HyperscapeAI/hyperscape/commit/3b6f1ee24ebc7473bdee1363a4eea1bdbd801f51) - Audio capture
- [Commit 47167b6](https://github.com/HyperscapeAI/hyperscape/commit/47167b6c35348bbf98b692bf1379a466550f7246) - Secrets management
