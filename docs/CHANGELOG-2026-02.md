# Changelog - February 2026

Comprehensive documentation of all major changes pushed to main in February 2026.

## 🎨 Rendering & Performance

### Instanced Rendering System (PR #946)

**Impact:** Massive performance improvement for resource rendering

**Changes:**
- Implemented `GLBResourceInstancer` for rocks, ores, herbs
- Extended `GLBTreeInstancer` with depleted model support
- Added `InstancedModelVisualStrategy` as default for GLB resources
- Reduced draw calls from O(n) to O(1) per unique model

**Performance:**
- 1000 trees: 1000 draw calls → 3 draw calls (LOD0/LOD1/LOD2)
- Instanced depletion (stumps) for zero-cost state changes
- Automatic LOD switching with hysteresis

**API Changes:**
- `ResourceVisualStrategy.onDepleted()` now returns `Promise<boolean>`
- Added optional `getHighlightMesh()` method for instanced entities
- `EntityHighlightService` supports instanced hover outlines

**Documentation:**
- `docs/instanced-rendering.md` - Complete system documentation
- `docs/api/resource-visual-strategy.md` - API reference

---

## 🖥️ WebGPU Enforcement (Commit 47782ed)

**Impact:** Removed all WebGL fallback code - WebGPU is now strictly required

**Changes:**
- Removed `isWebGLForced`, `isWebGLFallbackForced`, `isWebGLFallbackAllowed`
- Removed `isWebGLAvailable`, `isOffscreenCanvasAvailable`, `canTransferCanvas`
- Changed `UniversalRenderer` to `WebGPURenderer` throughout
- `RendererBackend` is now only `"webgpu"`
- Removed `--disable-webgpu` and `forceWebGL` flags from streaming

**Rationale:**
- All materials use TSL (Three Shading Language) which ONLY works with WebGPU
- Post-processing effects use TSL-based node materials
- No WebGL fallback path exists

**Documentation:**
- Updated `AGENTS.md` with WebGPU requirements
- Updated `CLAUDE.md` with browser requirements
- Created `docs/vast-ai-streaming.md` for GPU streaming architecture

---

## 🎮 Vast.ai GPU Streaming

**Impact:** Production-ready GPU streaming to Twitch, Kick, X/Twitter

### GPU Rendering Modes

**Xorg with NVIDIA** (preferred):
- Requires DRI/DRM device access
- Best performance, lowest latency
- Falls back to Xvfb if DRI unavailable

**Xvfb with NVIDIA Vulkan** (fallback):
- Virtual framebuffer + GPU rendering via ANGLE/Vulkan
- Works in containers without DRM access
- CDP captures from Chrome's GPU compositor

**Headless mode**: NOT SUPPORTED (WebGPU requires display)

### Audio Capture (Commits 3b6f1ee, aab66b0)

**Added:**
- PulseAudio with `chrome_audio` virtual sink
- FFmpeg captures from PulseAudio monitor
- Configurable via `STREAM_AUDIO_ENABLED`

**Configuration:**
```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

### RTMP Multi-Streaming (Commits 5dbd239, d66d13a)

**Added:**
- Simultaneous streaming to Twitch, Kick, X/Twitter
- FFmpeg tee muxer for single-encode multi-output
- YouTube explicitly disabled (set `YOUTUBE_STREAM_KEY=""`)

**Fixed:**
- Kick RTMP URL: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`
- Added `KICK_STREAM_KEY` and `KICK_RTMP_URL` to CI/CD secrets

### Stream Quality Improvements (Commit 4c630f1)

**Changed:**
- Default x264 tune: `zerolatency` → `film` (better compression)
- Buffer multiplier: 2x → 4x bitrate (18000k for 4500k bitrate)
- Added FLV flags for RTMP stability
- Improved input buffering with `thread_queue_size`

**Configuration:**
```bash
# Restore old low-latency behavior
STREAM_LOW_LATENCY=true

# Adjust buffer size
STREAM_BITRATE_BUFFER_MULTIPLIER=4
```

### Deployment Validation (Commits 47782ed, 30bdaf0)

**Added:**
- GPU validation: Fails if `nvidia-smi` fails
- Vulkan validation: Checks ICD availability
- Display validation: Ensures Xorg/Xvfb is accessible
- No soft fallbacks: Deployment FAILS if WebGPU cannot initialize

**Documentation:**
- `docs/vast-ai-streaming.md` - Complete architecture guide
- `scripts/deploy-vast.sh` - Deployment script with inline docs

---

## 🤖 AI Agent Improvements (Commit 60a03f4)

**Impact:** 67% reduction in LLM API calls, 70% faster decision-making

### Action Locks

**Added:**
- Action lock prevents LLM ticks during movement
- `waitForMovementComplete()` for synchronous actions
- `isMoving` tracking in `HyperscapeService`

**Benefits:**
- Reduces LLM calls by ~70%
- Prevents decision conflicts
- Improves responsiveness

### Fast-Tick Mode

**Added:**
- 2s interval after movement/goal changes
- 3 fast ticks, then returns to 10s interval

**Triggers:**
- Movement completed
- Goal changed
- Resource depleted
- Banking completed

### Short-Circuit LLM

**Added:**
- Skip LLM for obvious decisions
- Repeat resource gathering
- Banking when inventory full
- Goal execution immediately after setting

**Benefits:**
- Reduces LLM calls by ~40%
- Faster decision-making
- More predictable behavior

### Banking Improvements

**Changed:**
- Banking actions now await movement completion
- New `banking` goal type auto-restores previous goal
- Filter depleted resources from nearby entity checks

**Configuration:**
```bash
# Resource approach range (increased from 20 to 40)
RESOURCE_APPROACH_RANGE=40
```

**Documentation:**
- `docs/ai-agent-improvements.md` - Complete guide

---

## 🔒 Security Updates

### CSP Changes (Commits e012ed2, 1b2e230, 8626299)

**Added:**
- `fonts.googleapis.com` to `style-src` (Google Fonts)
- `fonts.gstatic.com` to `font-src` (Google Fonts)
- `static.cloudflareinsights.com` to `script-src` (Analytics)
- `data:` to `script-src` (WASM loading)

**Removed:**
- `report-uri` directive (broken endpoint)

**Documentation:**
- `docs/security/csp-updates.md` - CSP configuration guide

### Deployment Secrets (Commits b466233, 4a6aaaf, b754d5a)

**Added:**
- `SOLANA_DEPLOYER_PRIVATE_KEY` to secrets file
- `JWT_SECRET` to secrets file
- `ARENA_EXTERNAL_BET_WRITE_KEY` to secrets file
- `KICK_STREAM_KEY` and `KICK_RTMP_URL` to CI/CD

**Fixed:**
- Secrets now written to `/tmp` to survive `git reset`
- PM2 uses `pm2 kill` instead of `pm2 delete` to pick up new env vars
- YouTube explicitly disabled to prevent stale keys

---

## 🎯 Solana Markets

### WSOL as Default (Commit 34255ee)

**Changed:**
- `GOLD_MINT` → `MARKET_MINT` (defaults to WSOL)
- Markets use native token of each chain
- Perps oracle disabled by default (`ENABLE_PERPS_ORACLE=false`)

**Configuration:**
```bash
# Use WSOL (default)
MARKET_MINT=So11111111111111111111111111111111111111112

# Or use GOLD
MARKET_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

**Documentation:**
- `docs/solana-market-updates.md` - Migration guide

---

## 🐛 Bug Fixes

### Client Rendering (Commit 205f964)

**Fixed:**
- Updated WebGL references to WebGPU in comments
- `SettingsPanel.tsx` always shows 'WebGPU' instead of conditional
- `errorCodes.ts` updated to mention WebGPU
- `visualTesting.ts` uses 2D canvas for pixel reading (WebGPU compatible)

### Deployment Stability (Commits 8575215, 1025071, 77403a2)

**Fixed:**
- Clean up X server sockets before starting Xvfb
- Remove `/tmp/.X11-unix` directory and recreate
- Kill all X processes (Xorg, Xvfb, X) before restart
- Added `STREAM_CAPTURE_USE_EGL` variable (was missing)
- Added `STREAM_CAPTURE_EXECUTABLE` for custom browser path

### PulseAudio Permissions (Commit aab66b0)

**Fixed:**
- Add root user to `pulse-access` group
- Create `/run/pulse` with proper permissions (777)
- Export `PULSE_SERVER` in both deploy script and PM2 config
- Add `pactl` check before using PulseAudio

---

## 📊 Performance Metrics

### Instanced Rendering

- **Draw calls**: 1000 trees = 3 draw calls (99.7% reduction)
- **Memory**: Shared geometry/materials (1x cost vs. Nx cost)
- **LOD switching**: O(n) per frame with early-exit optimization

### AI Agents

- **LLM calls**: 6/min → 2/min (67% reduction)
- **API cost**: $0.02/hr → $0.007/hr (65% reduction)
- **Decision latency**: 10s → 3s (70% improvement)

### Streaming

- **Encoding**: Single H.264 encode for all platforms
- **Latency**: Twitch ~12s, Kick ~15s, X ~18s
- **Quality**: 1280x720 @ 30fps, 4500kbps bitrate

---

## 🔄 Breaking Changes

### ResourceVisualStrategy API

**Before:**
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<void>
```

**After:**
```typescript
async onDepleted(ctx: ResourceVisualContext): Promise<boolean>
```

**Migration:**
All custom visual strategies must update `onDepleted()` to return `boolean`.

### WebGPU Requirement

**Before:**
- WebGL fallback available
- `forceWebGL` parameter supported
- Headless mode worked (software rendering)

**After:**
- WebGPU strictly required
- No WebGL fallback
- Headless mode NOT supported
- Deployment fails if WebGPU unavailable

**Migration:**
- Ensure browser supports WebGPU (Chrome 113+, Edge 113+, Safari 18+)
- Vast.ai deployments must have NVIDIA GPU with Vulkan
- Update CI/CD to validate WebGPU availability

---

## 📝 Documentation Added

### New Files

- `docs/instanced-rendering.md` - Instanced rendering system guide
- `docs/vast-ai-streaming.md` - GPU streaming architecture
- `docs/ai-agent-improvements.md` - AI agent optimization guide
- `docs/api/resource-visual-strategy.md` - API reference
- `docs/security/csp-updates.md` - CSP configuration guide
- `docs/solana-market-updates.md` - Market token migration guide
- `docs/CHANGELOG-2026-02.md` - This file

### Updated Files

- `AGENTS.md` - Added Vast.ai deployment architecture
- `CLAUDE.md` - Updated browser requirements (Safari 18+)
- `README.md` - Added recent updates section, WebGPU requirement
- `packages/server/.env.example` - Added GPU streaming variables
- `packages/client/.env.example` - Updated streaming canonical platform

---

## 🔗 Related Pull Requests

- [#946](https://github.com/HyperscapeAI/hyperscape/pull/946) - Instanced rendering for GLB resources
- [#948](https://github.com/HyperscapeAI/hyperscape/pull/948) - Instanced highlight depleted fix
- [#945](https://github.com/HyperscapeAI/hyperscape/pull/945) - Model agent stability audit

---

## 📚 Additional Resources

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Three.js TSL Documentation](https://threejs.org/docs/#api/en/nodes/Nodes)
- [FFmpeg RTMP Streaming](https://trac.ffmpeg.org/wiki/StreamingGuide)
- [PulseAudio Documentation](https://www.freedesktop.org/wiki/Software/PulseAudio/)
- [Vulkan on Linux](https://vulkan.lunarg.com/doc/view/latest/linux/getting_started.html)
