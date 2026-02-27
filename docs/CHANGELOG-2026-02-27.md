# Changelog - February 27, 2026

Major updates to WebGPU enforcement, GPU rendering, audio capture, and agent stability.

## Breaking Changes

### WebGPU-Only Rendering (Commit 47782ed)

**BREAKING**: Removed ALL WebGL fallback code. WebGPU is now REQUIRED.

**Removed**:
- `RendererFactory.ts` - WebGL detection and fallback logic
- `isWebGLForced`, `isWebGLFallbackForced`, `isWebGLFallbackAllowed` flags
- `isWebGLAvailable`, `isOffscreenCanvasAvailable`, `canTransferCanvas` checks
- `UniversalRenderer` type (now only `WebGPURenderer`)
- `forceWebGL` and `disableWebGPU` URL parameters
- `STREAM_CAPTURE_DISABLE_WEBGPU` environment variable (now always false)
- `DUEL_FORCE_WEBGL_FALLBACK` configuration option (removed)

**Why**:
- All materials use TSL (Three Shading Language) which ONLY works with WebGPU
- Post-processing effects use TSL-based node materials
- No WebGL fallback path exists - game won't render without WebGPU
- Simplifies codebase and reduces maintenance burden

**Migration**:
- Ensure browser supports WebGPU (Chrome 113+, Edge 113+, Safari 18+)
- Check compatibility at [webgpureport.org](https://webgpureport.org)
- For server/streaming: Must use Xorg or Xvfb with NVIDIA GPU

**Files Changed**:
- `CLAUDE.md` - Added WebGPU requirement section
- `AGENTS.md` - Created with WebGPU guidance
- `packages/shared/src/renderer/RendererFactory.ts` - Removed (WebGL code deleted)
- `packages/server/scripts/stream-to-rtmp.ts` - Removed WebGL flags
- `ecosystem.config.cjs` - Removed WebGL fallback options

## GPU Rendering & Streaming

### Xorg/Xvfb GPU Setup (Commits 263bfc5, 5fe4a18, 30bdaf0, 725e934, e51a332)

**Added**: Robust GPU rendering setup for Vast.ai deployment with WebGPU support.

**Features**:
1. **Xorg with NVIDIA** (preferred):
   - Headless Xorg configuration with NVIDIA driver
   - Auto-detects GPU BusID via `nvidia-smi`
   - Config: `/etc/X11/xorg-nvidia-headless.conf`
   - Options: `AllowEmptyInitialConfiguration`, `UseDisplayDevice=None`
   - Verifies with `xdpyinfo` before use
   - Detects swrast fallback (software rendering) and rejects it

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer for X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures frames from Chrome's internal GPU rendering
   - Works in containers without DRM access

3. **Failure Mode**:
   - Deployment FAILS if neither Xorg nor Xvfb can provide WebGPU
   - No soft fallback to headless mode (doesn't support WebGPU)
   - Explicit error message with troubleshooting steps

**Environment Variables**:
- `DISPLAY=:99` - X server display number
- `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json` - Force NVIDIA Vulkan ICD
- `GPU_RENDERING_MODE=xorg|xvfb-vulkan` - Rendering mode indicator
- `DUEL_CAPTURE_USE_XVFB=true/false` - Dynamically set based on GPU setup

**Files Changed**:
- `scripts/deploy-vast.sh` - GPU rendering setup logic
- `ecosystem.config.cjs` - GPU environment variables
- `docs/vast-deployment.md` - Deployment guide
- `docs/webgpu-requirements.md` - WebGPU requirements

### Vulkan Driver Management (Commits 89b78e3, ba1cf0a, ef8033c, e5aa1e7)

**Fixed**: Force NVIDIA-only Vulkan ICD to avoid conflicts with broken Mesa ICDs.

**Changes**:
- Set `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json`
- Prevents libGLX_nvidia.so.0 driver conflicts
- Ensures consistent Vulkan behavior across containers

**Why**:
- Some Vast.ai containers have misconfigured Mesa Vulkan ICDs
- Mesa ICDs can conflict with NVIDIA drivers
- Forcing NVIDIA-only ICD ensures WebGPU works reliably

### Chrome Dev Channel (Commits 47782ed, 92ee48e)

**Added**: Use Chrome Dev channel (google-chrome-unstable) for WebGPU support.

**Changes**:
- Install `google-chrome-unstable` in deploy script
- Set `STREAM_CAPTURE_CHANNEL=chrome-dev` in ecosystem config
- Playwright channel mapping: `chrome-dev` → `google-chrome-unstable`

**Why**:
- Chrome Dev has WebGPU enabled by default
- Stable Chrome may have WebGPU behind flags
- Ensures consistent WebGPU availability

## Audio Capture

### PulseAudio Setup (Commits 3b6f1ee, aab66b0, 7a5fcbc, d66d13a)

**Added**: Game audio capture via PulseAudio virtual sink.

**Features**:
- User-mode PulseAudio with `chrome_audio` virtual sink
- FFmpeg captures from `chrome_audio.monitor` device
- Graceful fallback to silent audio if PulseAudio unavailable
- Automatic sink creation and verification

**Configuration**:
```bash
# PulseAudio runtime directory
XDG_RUNTIME_DIR=/tmp/pulse-runtime

# PulseAudio server socket
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# Audio capture settings
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

**Files Changed**:
- `scripts/deploy-vast.sh` - PulseAudio setup
- `ecosystem.config.cjs` - Audio environment variables
- `packages/server/scripts/stream-to-rtmp.ts` - Chrome audio output config
- `docs/streaming-configuration.md` - Audio configuration reference

### Audio Stability Improvements (Commits b9d2e41, 4c630f1)

**Fixed**: Audio buffering and synchronization issues.

**Changes**:
- `thread_queue_size=1024` for audio input (prevents buffer underruns)
- `use_wallclock_as_timestamps=1` for PulseAudio (real-time timing)
- `aresample=async=1000:first_pts=0` filter (recovers from audio drift >22ms)
- Increased video `thread_queue_size` from 512 to 1024 (better a/v sync)
- Removed `-shortest` flag (caused audio dropouts during video buffering)

**Why**:
- Prevents intermittent audio dropouts
- Maintains audio/video synchronization
- Recovers from audio drift automatically

## Streaming Configuration

### RTMP Multi-Platform (Commits 5dbd239, 7ee730d, a71d4ba, 50f8bec)

**Fixed**: Stream key management and multi-platform RTMP streaming.

**Changes**:
- Twitch, Kick, X/Twitter streaming (YouTube explicitly disabled)
- Kick URL corrected: `rtmps://fa723fc1b171.global-contribute.live-video.net/app`
- Explicit unset/re-export of stream keys (prevents stale environment values)
- Masked logging for security (`***configured***` instead of plaintext)
- Stream keys passed through GitHub secrets → SSH → `.env` file

**Environment Variables**:
```bash
TWITCH_STREAM_KEY=live_xxxxx_yyyyy
KICK_STREAM_KEY=sk_us-west-2_xxxxx
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=xxxxx
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
YOUTUBE_STREAM_KEY=                # Empty string disables YouTube
```

**Files Changed**:
- `scripts/deploy-vast.sh` - Stream key management
- `ecosystem.config.cjs` - RTMP destination configuration
- `packages/server/src/streaming/rtmp-bridge.ts` - Kick URL fix

### Improved Buffering (Commits 4c630f1, b9d2e41)

**Changed**: FFmpeg encoding configuration for smoother playback.

**Changes**:
- Changed x264 tune from `zerolatency` to `film` (allows B-frames)
- Increased buffer from 2x to 4x bitrate (18000k bufsize)
- Added FLV flags: `flvflags=no_duration_filesize`
- Added input buffering: `thread_queue_size` for frame queueing
- Added stream recovery: `genpts+discardcorrupt` flags

**Why**:
- Better compression efficiency
- Smoother bitrate for viewers
- Reduces buffering during network hiccups
- Better stream recovery from errors

**Revert to Low Latency**:
```bash
STREAM_LOW_LATENCY=true  # Use 'zerolatency' tune
```

### Canonical Platform Change (Commit 34255ee)

**Changed**: Canonical platform from YouTube to Twitch.

**Changes**:
- `STREAMING_CANONICAL_PLATFORM=twitch` (was youtube)
- `STREAMING_PUBLIC_DELAY_MS=0` (was 12-15s)

**Why**:
- Twitch has lower latency than YouTube
- Live betting requires minimal delay
- YouTube explicitly disabled in production

## Agent Improvements

### Movement Completion Tracking (Commit 60a03f4)

**Added**: `waitForMovementComplete()` API for multi-step actions.

**Features**:
- `waitForMovementComplete(timeoutMs?: number): Promise<void>` - Wait for movement
- `isMoving: boolean` - Check if currently moving
- Movement state tracked via `tileMovementEnd` packet
- Timeout handling (default: 15s)

**Example**:
```typescript
// Walk to bank
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();

// Now we're at the bank
await service.bankDepositAll();
```

**Files Changed**:
- `packages/plugin-hyperscape/src/services/HyperscapeService.ts` - Movement tracking
- `packages/plugin-hyperscape/src/actions/banking.ts` - Banking actions now await movement
- `docs/agent-movement-api.md` - API documentation
- `docs/api/hyperscape-service.md` - API reference

### Action Locks & Fast-Tick Mode (Commit 60a03f4)

**Added**: Action lock system to prevent LLM interference during multi-step actions.

**Features**:
- Skip LLM ticks while movement is in progress
- Fast-tick mode (2s) for quick follow-up after movement/goal changes
- Short-circuit LLM for obvious decisions (repeat resource, banking, set goal)
- Banking actions now await movement completion

**Why**:
- Prevents LLM from changing goals mid-action
- Faster response for obvious decisions
- More reliable multi-step actions (walk → bank → deposit)

### Resource Detection Range (Commit 60a03f4)

**Changed**: Increased resource approach range from 20m to 40m.

**Why**:
- Matches skills validation range
- Prevents "too far away" errors
- More reliable resource gathering

## Deployment Automation

### Vast.ai Improvements (Commits 1025071, 4a6aaaf, b754d5a, bb5f174, 50f8bec)

**Added**: Comprehensive deployment automation and diagnostics.

**Features**:
- Clean up X lock files before starting Xvfb (prevents startup failures)
- DATABASE_URL persistence through git reset (via `/tmp/hyperscape-secrets.env`)
- Secrets injection overhaul (pm2 kill instead of delete)
- Database warmup (3 retry attempts after schema push)
- Bun installation automation (with unzip dependency)
- First-time setup (auto-clone repo if not present)
- Solana keypair setup from `SOLANA_DEPLOYER_PRIVATE_KEY`
- Comprehensive streaming diagnostics (FFmpeg, RTMP, PulseAudio checks)

**Files Changed**:
- `scripts/deploy-vast.sh` - Deployment script
- `.github/workflows/deploy-vast.yml` - CI/CD workflow
- `docs/vast-deployment.md` - Deployment guide

### Cloudflare Pages Workflow (Commits 3e4bb48, e012ed2)

**Added**: Automated client deployment on push to main.

**Features**:
- Triggers on changes to `packages/client/**` or `packages/shared/**`
- Uses wrangler pages deploy (not GitHub integration)
- Proper build steps (shared package first)
- Multi-line commit message handling
- R2 CORS configuration

**Files Changed**:
- `.github/workflows/deploy-pages.yml` - Workflow
- `packages/client/scripts/deploy-cloudflare.mjs` - Deploy script

## Security

### JWT_SECRET Enforcement (Commit b56b0fd)

**Added**: JWT_SECRET now required in production/staging.

**Changes**:
- Throws error if JWT_SECRET not set in production
- Generate with: `openssl rand -base64 32`

**Why**:
- Prevents session hijacking
- Enforces secure token signing

### Stream Key Security (Commits 7ee730d, a71d4ba, 50f8bec)

**Added**: Masked logging and explicit unset of stale stream keys.

**Changes**:
- Keys logged as `***configured***` instead of plaintext
- Explicit unset before re-sourcing `.env`
- Prevents accidental exposure in logs

### Secrets Management (Commits b466233, 8e6ae8d, 55f93c6, b56b0fd)

**Added**: Comprehensive secrets injection for CI/CD.

**Changes**:
- `SOLANA_DEPLOYER_PRIVATE_KEY` added to secrets
- `ARENA_EXTERNAL_BET_WRITE_KEY` added to secrets
- `JWT_SECRET` added to secrets
- pm2 kill instead of delete (ensures daemon picks up new env vars)

## Configuration Changes

### Solana Markets (Commit 34255ee)

**Changed**: Markets now use native token (WSOL) instead of custom GOLD.

**Changes**:
- `MARKET_MINT` env var replaces `GOLD_MINT`
- Defaults to WSOL on each chain
- Perps oracle disabled by default (`ENABLE_PERPS_ORACLE=false`)

**Why**:
- Simplifies market setup
- Uses native token for better liquidity
- Perps program not deployed on devnet yet

### Client Fixes (Commits e012ed2, 1b2e230, 8626299)

**Fixed**: Vite polyfills, CSP, and CORS issues.

**Changes**:
- Vite polyfills: Aliases resolve `vite-plugin-node-polyfills/shims/*` to dist files
- CSP: Allow Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
- CSP: Allow `data:` URLs for WASM loading
- CSP: Allow Cloudflare Insights (`static.cloudflareinsights.com`)
- Disabled `protocolImports` in nodePolyfills plugin

**Why**:
- Fixes "Failed to resolve module specifier" error in production
- Allows Google Fonts to load
- Allows WASM modules to load

## Documentation

### New Documentation Files

- `AGENTS.md` - AI assistant guidance for WebGPU requirements
- `docs/webgpu-requirements.md` - Browser and GPU requirements
- `docs/streaming-configuration.md` - Streaming configuration reference
- `docs/vast-deployment.md` - Vast.ai deployment guide
- `docs/agent-movement-api.md` - Movement API documentation
- `docs/api/hyperscape-service.md` - HyperscapeService API reference
- `docs/deployment-workflow.md` - Deployment workflow guide
- `packages/server/.env.streaming.example` - Streaming environment variables

### Updated Documentation

- `CLAUDE.md` - Added WebGPU requirements section
- `README.md` - Updated with WebGPU requirements and recent changes
- `packages/plugin-hyperscape/README.md` - Added movement API documentation
- `guides/playing.mdx` - Added WebGPU system requirements

## Commit Summary

Total commits analyzed: 50 (from 2026-02-26 to 2026-02-27)

**Categories**:
- WebGPU enforcement: 1 breaking change
- GPU rendering: 10 commits (Xorg, Xvfb, Vulkan)
- Audio capture: 5 commits (PulseAudio, buffering)
- Streaming: 8 commits (RTMP, keys, buffering)
- Deployment: 12 commits (Vast.ai, secrets, automation)
- Agent improvements: 1 commit (movement API, action locks)
- Security: 4 commits (JWT, secrets, stream keys)
- Client fixes: 3 commits (Vite, CSP, CORS)
- Configuration: 2 commits (Solana, markets)
- Miscellaneous: 4 commits (CDN, debugging)

## Migration Guide

### For Developers

1. **Update browser**: Ensure Chrome 113+, Edge 113+, or Safari 18+
2. **Remove WebGL code**: Delete any WebGL fallback logic
3. **Update renderer references**: Use `WebGPURenderer` only
4. **Test WebGPU**: Verify at [webgpureport.org](https://webgpureport.org)

### For Server Operators

1. **GPU Setup**: Ensure NVIDIA GPU with Vulkan support
2. **Install drivers**: NVIDIA drivers + Vulkan tools
3. **Configure display**: Xorg or Xvfb with GPU access
4. **Update secrets**: Add streaming keys to GitHub secrets
5. **Test deployment**: Run manual deployment via workflow_dispatch
6. **Monitor health**: Check `/health` endpoint after deployment

### For Agent Developers

1. **Update actions**: Use `waitForMovementComplete()` for multi-step actions
2. **Banking protocol**: Follow proper sequence (open → deposit → close)
3. **Movement awaiting**: Await movement before interacting with entities
4. **Action locks**: Use locked goals for multi-step actions

## See Also

- [CLAUDE.md](../CLAUDE.md) - Development guide
- [README.md](../README.md) - Project overview
- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment
- [docs/webgpu-requirements.md](webgpu-requirements.md) - WebGPU requirements
- [docs/streaming-configuration.md](streaming-configuration.md) - Streaming config
- [docs/agent-movement-api.md](agent-movement-api.md) - Movement API
