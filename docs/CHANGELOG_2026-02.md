# Changelog - February 2026

Comprehensive changelog for all changes in February 2026.

## [0.2.0] - 2026-02-28

### 🚨 Breaking Changes

#### WebGPU-Only Rendering
- **BREAKING:** Removed all WebGL support - WebGPU is now REQUIRED
- Removed `isWebGLAvailable()`, `isWebGLForced()`, `isWebGLFallbackAllowed()`
- Removed `UniversalRenderer` type - use `WebGPURenderer`
- Removed `forceWebGL` parameter from renderer creation
- Removed `--disable-webgpu` and `forceWebGL` flags from streaming
- Updated all WebGL references to WebGPU in client code
- Minimum browser versions: Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)

**Commits:** [47782ed](https://github.com/HyperscapeAI/hyperscape/commit/47782ed), [205f964](https://github.com/HyperscapeAI/hyperscape/commit/205f964)

### ✨ New Features

#### Instanced Rendering for Resources
- Added `GLBResourceInstancer` for rocks, ores, herbs
- Added `InstancedModelVisualStrategy` with automatic fallback
- Separate InstancedMesh per LOD level (LOD0, LOD1, LOD2)
- Distance-based LOD switching with hysteresis
- Depleted model support with separate pool
- Highlight mesh support for instanced resources
- Collision proxies for raycasting
- 40% FPS improvement with 1500+ resources

**Commits:** [53a9513](https://github.com/HyperscapeAI/hyperscape/commit/53a9513), [9643d5d](https://github.com/HyperscapeAI/hyperscape/commit/9643d5d)

#### AI Agent Improvements
- Added action locks to prevent LLM ticks during movement
- Added fast-tick mode (2s interval for 30s after actions)
- Added short-circuit LLM for obvious decisions
- Added banking goal type with auto-restore of previous goal
- Added `waitForMovementComplete()` for reliable action chains
- Added depleted resource filtering in nearby entity checks
- Increased resource approach range from 20m to 40m
- Track last action name/result in LLM prompt
- 65% reduction in LLM API costs
- 60% faster action chains

**Commits:** [60a03f4](https://github.com/HyperscapeAI/hyperscape/commit/60a03f4)

#### GPU Streaming Architecture
- Added Xorg/Xvfb automatic GPU mode detection
- Added PulseAudio audio capture with `chrome_audio` virtual sink
- Added CDP screencast capture (2-3x faster than MediaRecorder)
- Added RTMP multi-streaming to Twitch, Kick, X/Twitter
- Added automatic recovery (soft/hard restart)
- Added browser rotation every hour to prevent GPU memory leaks
- Added resolution tracking and mismatch detection
- Added comprehensive deployment validation

**Commits:** [263bfc5](https://github.com/HyperscapeAI/hyperscape/commit/263bfc5), [30bdaf0](https://github.com/HyperscapeAI/hyperscape/commit/30bdaf0), [3b6f1ee](https://github.com/HyperscapeAI/hyperscape/commit/3b6f1ee), [b9d2e41](https://github.com/HyperscapeAI/hyperscape/commit/b9d2e41)

### 🔧 Improvements

#### Streaming Enhancements
- Improved FFmpeg buffering with 4x bitrate buffer
- Added configurable GOP size (`STREAM_GOP_SIZE`)
- Added low-latency mode option (`STREAM_LOW_LATENCY`)
- Changed default x264 tune from `zerolatency` to `film` (better compression)
- Added audio buffering with `thread_queue_size`
- Added async audio resampling for drift recovery
- Added frame resolution tracking from CDP metadata
- Added automatic viewport recovery on resolution mismatch

**Commits:** [4c630f1](https://github.com/HyperscapeAI/hyperscape/commit/4c630f1), [b9d2e41](https://github.com/HyperscapeAI/hyperscape/commit/b9d2e41), [47167b6](https://github.com/HyperscapeAI/hyperscape/commit/47167b6)

#### Deployment Improvements
- Persist GPU/display settings to `.env` for PM2 restarts
- Remove hardcoded secrets from `ecosystem.config.cjs`
- All secrets now read from environment variables only
- Added `.env.example` documenting required secrets
- Updated `.gitignore` to block all `.env` files in subdirectories
- Added database warmup step with retries
- Fixed PulseAudio permissions (add root to pulse-access group)
- Fixed X server socket cleanup before Xvfb start
- Fixed bun installation (install unzip first)
- Handle first-time Vast.ai setup by cloning repo

**Commits:** [abd2783](https://github.com/HyperscapeAI/hyperscape/commit/abd2783), [47167b6](https://github.com/HyperscapeAI/hyperscape/commit/47167b6), [d66d13a](https://github.com/HyperscapeAI/hyperscape/commit/d66d13a), [84d598f](https://github.com/HyperscapeAI/hyperscape/commit/84d598f), [6302fa4](https://github.com/HyperscapeAI/hyperscape/commit/6302fa4)

#### Client Improvements
- Allow Cloudflare Insights in CSP `script-src`
- Allow Google Fonts in CSP (`fonts.googleapis.com`, `fonts.gstatic.com`)
- Allow `data:` URLs for WASM loading in CSP
- Remove broken `report-uri` from CSP
- Fix vite-plugin-node-polyfills shims resolution
- Update WebGL references to WebGPU in comments
- Settings panel always shows "WebGPU"
- Visual testing uses 2D canvas for pixel reading (WebGPU compatible)

**Commits:** [1b2e230](https://github.com/HyperscapeAI/hyperscape/commit/1b2e230), [8626299](https://github.com/HyperscapeAI/hyperscape/commit/8626299), [e012ed2](https://github.com/HyperscapeAI/hyperscape/commit/e012ed2), [205f964](https://github.com/HyperscapeAI/hyperscape/commit/205f964)

### 🐛 Bug Fixes

#### Streaming Fixes
- Fixed PulseAudio permissions and fallback for audio capture
- Fixed missing `STREAM_CAPTURE_USE_EGL` variable causing crash
- Fixed Xorg swrast fallback detection
- Fixed headless EGL env var passing to PM2
- Fixed `--headless=new` passing via args (not Playwright option)
- Fixed Xorg/Xvfb fallback handling with diagnostic logging
- Removed `--ozone-platform=headless` (breaks WebGPU)
- Fixed resolution mismatch recovery

**Commits:** [aab66b0](https://github.com/HyperscapeAI/hyperscape/commit/aab66b0), [77403a2](https://github.com/HyperscapeAI/hyperscape/commit/77403a2), [725e934](https://github.com/HyperscapeAI/hyperscape/commit/725e934), [7140966](https://github.com/HyperscapeAI/hyperscape/commit/7140966), [dd649da](https://github.com/HyperscapeAI/hyperscape/commit/dd649da), [eac4e5c](https://github.com/HyperscapeAI/hyperscape/commit/eac4e5c)

#### Deployment Fixes
- Fixed secrets injection (write to `/tmp` to survive git reset)
- Fixed env var writing to `.env` file in SSH script
- Fixed multi-line commit messages in Pages deploy
- Fixed X server lock file cleanup
- Added `ARENA_EXTERNAL_BET_WRITE_KEY` to secrets
- Added `JWT_SECRET` to secrets file

**Commits:** [4a6aaaf](https://github.com/HyperscapeAI/hyperscape/commit/4a6aaaf), [b754d5a](https://github.com/HyperscapeAI/hyperscape/commit/b754d5a), [50f8bec](https://github.com/HyperscapeAI/hyperscape/commit/50f8bec), [3e4bb48](https://github.com/HyperscapeAI/hyperscape/commit/3e4bb48), [1025071](https://github.com/HyperscapeAI/hyperscape/commit/1025071), [8575215](https://github.com/HyperscapeAI/hyperscape/commit/8575215), [55f93c6](https://github.com/HyperscapeAI/hyperscape/commit/55f93c6), [b56b0fd](https://github.com/HyperscapeAI/hyperscape/commit/b56b0fd)

#### Client Fixes
- Fixed vite-plugin-node-polyfills shims resolution
- Fixed Google Fonts loading errors
- Fixed CSP blocking WASM loading

**Commits:** [e012ed2](https://github.com/HyperscapeAI/hyperscape/commit/e012ed2), [8626299](https://github.com/HyperscapeAI/hyperscape/commit/8626299)

### 📝 Documentation

#### New Documentation
- Added `docs/vast-ai-streaming.md` - GPU streaming architecture
- Added `docs/instanced-rendering.md` - Instanced rendering system
- Added `docs/ai-agent-improvements.md` - AI agent optimizations
- Added `docs/api/renderer-factory.md` - Renderer API reference
- Added `docs/migration/webgpu-only.md` - WebGPU migration guide
- Added `docs/configuration/environment-variables.md` - Complete env var reference
- Added `docs/RECENT_CHANGES.md` - Recent updates summary
- Updated `AGENTS.md` - Vast.ai deployment architecture
- Updated `CLAUDE.md` - WebGPU requirements and troubleshooting
- Updated `README.md` - New features and breaking changes
- Updated `.env.example` - All streaming and GPU variables

#### Updated Documentation
- AGENTS.md: Added Vast.ai deployment architecture section
- CLAUDE.md: Added WebGPU troubleshooting section
- README.md: Added WebGPU requirements, instanced rendering, streaming

## Performance Metrics

### Rendering
- **Draw calls:** 1500 → 6 (99.6% reduction)
- **FPS:** 30-40 → 55-60 (40% improvement)
- **GPU memory:** 20MB → 2.2MB per 1000 instances (89% reduction)

### AI Agents
- **LLM calls:** 360/hour → 126/hour (65% reduction)
- **API costs:** $0.50/hour → $0.18/hour (64% reduction)
- **Action latency:** 30s → 12s (60% improvement)

### Streaming
- **Capture speed:** 2-3x faster (CDP vs MediaRecorder)
- **Encoding:** Single-pass (JPEG → H.264)
- **Latency:** ~2-3s (with low-latency mode)

## Migration Guide

### From v0.1.x to v0.2.0

1. **Update browser** to Chrome 113+, Edge 113+, or Safari 18+
2. **Remove WebGL code** - No longer supported
3. **Update renderer creation** - Remove `forceWebGL` parameter
4. **Update materials** - Use TSL node materials
5. **Test WebGPU** - Verify at [webgpureport.org](https://webgpureport.org)

See [docs/migration/webgpu-only.md](migration/webgpu-only.md) for detailed migration guide.

## Contributors

- [@lalalune](https://github.com/lalalune) - WebGPU enforcement, streaming architecture, deployment fixes
- [@tcm390](https://github.com/tcm390) - Instanced rendering, highlight meshes
- [@dreaminglucid](https://github.com/dreaminglucid) - AI agent improvements

## Links

- [GitHub Repository](https://github.com/HyperscapeAI/hyperscape)
- [Documentation](https://github.com/HyperscapeAI/hyperscape/tree/main/docs)
- [Issues](https://github.com/HyperscapeAI/hyperscape/issues)
- [Pull Requests](https://github.com/HyperscapeAI/hyperscape/pulls)
