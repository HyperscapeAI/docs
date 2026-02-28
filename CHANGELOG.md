# Changelog

All notable changes to Hyperscape are documented in this file.

## [Unreleased]

### Breaking Changes

#### WebGPU-Only Rendering (2026-02-27)
- **BREAKING**: WebGPU is now REQUIRED. WebGL will NOT work.
- Removed all WebGL fallback code from RendererFactory
- Removed `isWebGLForced`, `isWebGLFallbackForced`, `isWebGLFallbackAllowed` flags
- Removed `--disable-webgpu` and `forceWebGL` URL parameters
- Changed `UniversalRenderer` to `WebGPURenderer` throughout codebase
- `RendererBackend` type is now only `"webgpu"`

**Migration:**
- Update browser to Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+)
- Verify WebGPU support at [webgpureport.org](https://webgpureport.org)
- Remove any WebGL-specific code or configuration
- Update GPU drivers if WebGPU is unavailable

**Rationale:**
All materials use TSL (Three Shading Language) which only works with WebGPU. There is no WebGL fallback path.

### Added

#### Instanced Rendering for Resources (2026-02-27)
- Added `GLBResourceInstancer` for rocks, ores, herbs, and plants
- Added `GLBTreeInstancer` for tree resources with dissolve materials
- Added `InstancedModelVisualStrategy` for ResourceEntity integration
- Reduces draw calls from O(n) to O(1) per unique model per LOD level
- Distance-based LOD switching with hysteresis
- Preloaded highlight meshes for hover effects
- Separate depleted pools with configurable scale
- Falls back to `StandardModelVisualStrategy` if instancing fails

**Performance Impact:**
- 1000 trees: 1000 draw calls → 3 draw calls (LOD0/1/2)
- Memory savings: ~99.6% (500MB → 2.1MB for 1000 trees)

#### Production Client Build Mode (2026-02-28)
- Added production client build mode for faster page loads
- When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
- Serves pre-built client via `vite preview` instead of dev server
- Fixes browser timeout issues (180s limit) caused by Vite's JIT compilation
- Page loads in <5 seconds (was 60-180 seconds with dev server)

**Configuration:**
```bash
NODE_ENV=production
# OR
DUEL_USE_PRODUCTION_CLIENT=true
```

#### PulseAudio Audio Capture (2026-02-26)
- Added PulseAudio integration for game music and sound effects
- Created `chrome_audio` virtual sink for Chrome output
- FFmpeg captures from PulseAudio monitor instead of silent audio
- Configurable via `STREAM_AUDIO_ENABLED` and `PULSE_AUDIO_DEVICE`
- User-mode PulseAudio (more reliable than system mode)

**Configuration:**
```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

#### Stream Encoding Improvements (2026-02-26)
- Changed default x264 tune from `zerolatency` to `film` for better compression
- Increased buffer multiplier from 2x to 4x bitrate (18000k for 4500k bitrate)
- Added `STREAM_LOW_LATENCY` flag to restore old behavior
- Added `STREAM_GOP_SIZE` environment variable (default: 60 frames)
- Added FLV flags for RTMP stability
- Improved input buffering with `thread_queue_size`

**Configuration:**
```bash
STREAM_LOW_LATENCY=false     # tune=film (quality) vs tune=zerolatency (speed)
STREAM_GOP_SIZE=60           # Keyframe interval in frames
STREAM_BUFFER_SIZE=18000k    # 4x bitrate buffer
```

#### CDP Frame Resolution Tracking (2026-02-28)
- Added CDP frame resolution tracking and mismatch detection
- Automatic viewport recovery when resolution mismatch persists (10+ frames)
- Logs resolution changes and mismatches
- Prevents black frames from viewport size issues

#### Stream Readiness Probe Timeout (2026-02-28)
- Added 5s timeout to probe evaluate calls to prevent hanging
- Prevents deployment stalls when game page is slow to load
- Logs probe status every 10 seconds for debugging

### Fixed

#### Vast.ai Deployment Stability (2026-02-27 - 2026-02-28)
- Fixed Xorg/Xvfb fallback handling for containers without DRM access
- Fixed X server socket cleanup before starting Xvfb
- Fixed PulseAudio permissions and fallback for audio capture
- Fixed secrets injection to survive `git reset --hard` in deploy script
- Fixed GPU/display settings persistence to `.env` for PM2 restarts
- Fixed headless EGL mode detection and configuration

#### Streaming Reliability (2026-02-26 - 2026-02-28)
- Fixed audio stability with better buffering and sync
- Fixed PulseAudio `await` in non-async function
- Fixed Kick RTMP URL default to working endpoint
- Fixed YouTube stream key explicitly disabled to prevent stale keys
- Fixed multi-line commit messages in Pages deploy workflow

#### Client Fixes (2026-02-26 - 2026-02-27)
- Fixed vite-plugin-node-polyfills shims resolution in production
- Fixed CSP to allow Google Fonts and Cloudflare Insights
- Fixed CSP to allow `data:` URLs for WASM loading
- Updated WebGL references to WebGPU in client code
- Fixed context lost handler comments
- Updated SettingsPanel to always show 'WebGPU'
- Updated errorCodes.ts to mention WebGPU instead of WebGL
- Fixed visualTesting.ts to use 2D canvas for pixel reading (WebGPU compatible)

### Changed

#### Streaming Configuration (2026-02-28)
- Removed hardcoded stream keys from `ecosystem.config.cjs`
- All secrets now read from environment variables only
- Added `.env.example` documenting required secrets
- Updated `.gitignore` to block all `.env` files in subdirectories

#### Deployment Process (2026-02-26 - 2026-02-28)
- Secrets written to `/tmp/hyperscape-secrets.env` to survive git reset
- GPU/display settings persisted to `.env` for PM2 restarts
- Database warmup step added after schema push
- Improved error messages and diagnostic logging
- Added comprehensive streaming diagnostics at end of deployment

#### Browser Configuration (2026-02-27)
- Use Chrome Dev channel (google-chrome-unstable) for WebGPU support
- Force NVIDIA-only Vulkan ICD via `VK_ICD_FILENAMES`
- Use ANGLE/Vulkan backend for WebGPU
- Removed SwiftShader and Lavapipe software rendering attempts
- Disabled frame rate limit for smoother capture

### Deprecated

#### WebGL Support (2026-02-27)
- All WebGL-related code and configuration removed
- `STREAM_CAPTURE_DISABLE_WEBGPU` flag ignored (kept for backwards compatibility)
- `DUEL_FORCE_WEBGL_FALLBACK` flag ignored (kept for backwards compatibility)
- `STREAM_CAPTURE_USE_EGL` flag ignored (headless EGL not supported)

## Version History

### v0.9.0 (2026-02-28)
- WebGPU-only rendering enforcement
- Instanced rendering for resources
- Production client build mode
- PulseAudio audio capture
- Stream encoding improvements
- CDP resolution tracking
- Vast.ai deployment stability fixes

### v0.8.0 (2026-02-20)
- ElizaOS AI agent integration
- Duel arena betting system
- Multi-platform RTMP streaming
- Solana on-chain markets

### v0.7.0 (2026-02-10)
- Tick-based combat system
- Skills and progression
- Banking and economy
- Quest system

## Migration Guides

### Upgrading to WebGPU-Only (v0.9.0)

**Before:**
```typescript
// WebGL fallback code
if (!isWebGPUAvailable()) {
  renderer = new WebGLRenderer();
}
```

**After:**
```typescript
// WebGPU only
if (!navigator.gpu) {
  throw new Error('WebGPU is required. Please update your browser.');
}
renderer = new WebGPURenderer();
```

**Environment variables:**
```bash
# Remove these (no longer used)
DUEL_FORCE_WEBGL_FALLBACK=false
STREAM_CAPTURE_DISABLE_WEBGPU=false

# Add these for streaming
STREAM_CAPTURE_MODE=cdp
STREAM_CAPTURE_CHANNEL=chrome-dev
```

### Upgrading Streaming Configuration (v0.9.0)

**Before:**
```bash
# Hardcoded in ecosystem.config.cjs
TWITCH_STREAM_KEY=live_123...
```

**After:**
```bash
# In .env file (gitignored)
TWITCH_STREAM_KEY=live_123...
KICK_STREAM_KEY=...
X_STREAM_KEY=...
```

**Migration steps:**
1. Copy stream keys from `ecosystem.config.cjs` to `.env`
2. Remove hardcoded keys from `ecosystem.config.cjs`
3. Verify keys are loaded: `echo $TWITCH_STREAM_KEY`
4. Restart: `bunx pm2 restart hyperscape-duel`

## Known Issues

### WebGPU Compatibility
- Safari 18+ requires macOS 15+ (Sequoia)
- Firefox WebGPU support is behind flag (not recommended)
- Some Linux distributions may need Vulkan driver updates

### Streaming
- CDP capture may stall on some GPU configurations (auto-recovery enabled)
- Resolution mismatch can occur on window minimize (auto-recovery enabled)
- Memory leaks in long-running streams (browser restarts every hour)

### Instanced Rendering
- Highlight meshes may flicker during LOD transitions (hysteresis reduces this)
- Raycasting uses collision proxies (not actual mesh geometry)
- Fallback to standard rendering if instancing fails

## Roadmap

### v0.10.0 (Planned)
- GPU culling for instanced rendering
- Impostor integration for far-distance rendering
- WebCodecs capture mode stabilization
- Multi-region streaming support

### v1.0.0 (Planned)
- Public beta launch
- Mobile app release
- Cross-platform voice chat
- Player housing system
