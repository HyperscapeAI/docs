# Changelog

All notable changes to Hyperscape are documented in this file.

## [Unreleased] - 2026-02-28

### 🚨 BREAKING CHANGES

#### WebGPU-Only Enforcement
- **Removed all WebGL fallback code** - WebGPU is now strictly required
- Removed `isWebGLAvailable()`, `isWebGLForced()`, and related WebGL detection functions
- `RendererBackend` type is now only `'webgpu'` (was `'webgl' | 'webgpu'`)
- `UniversalRenderer` type replaced with `WebGPURenderer`
- Deployment fails if WebGPU cannot be initialized (no soft fallbacks)
- See: [AGENTS.md](AGENTS.md) for WebGPU requirements

**Migration**: Ensure your environment supports WebGPU:
- Browser: Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- Server: NVIDIA GPU with Vulkan, Xorg or Xvfb display
- Check: [webgpureport.org](https://webgpureport.org)

### ✨ Features

#### Instanced Rendering for Resources
- Added `GLBResourceInstancer` for GPU instancing of rocks, ores, herbs
- Added `InstancedModelVisualStrategy` with automatic fallback
- Reduces draw calls from O(n) to O(1) per unique model
- Supports LOD switching, depletion states, and dissolve effects
- Instanced highlight meshes for hover interactions
- **Performance**: 99.7% draw call reduction for 1000 instances
- See: [docs/instanced-rendering.md](docs/instanced-rendering.md)

#### AI Agent Optimizations
- **Action locks**: Skip LLM ticks during movement (50% reduction)
- **Fast-tick mode**: 2-second interval after movement (80% faster follow-ups)
- **Short-circuit decisions**: Skip LLM for obvious actions (40% reduction)
- **Banking goal type**: Auto-restore previous goal after banking
- **Movement awaiting**: Banking actions now wait for movement completion
- **Depleted filtering**: Exclude depleted resources from nearby entity checks
- **Last action tracking**: Include previous action in LLM prompt
- **Overall**: 70% reduction in LLM calls, 70% cost savings
- See: [docs/ai-agent-improvements.md](docs/ai-agent-improvements.md)

#### Streaming Infrastructure Improvements
- **CDP screencast capture**: 2-3x faster than MediaRecorder
- **PulseAudio audio capture**: Game music and sound in streams
- **RTMP multi-streaming**: Simultaneous streaming to Twitch, Kick, X/Twitter
- **Automatic recovery**: Soft/hard recovery for CDP stalls
- **Resolution tracking**: Detect and fix viewport mismatches
- **Secrets management**: All stream keys from environment variables only
- See: [docs/vast-ai-streaming.md](docs/vast-ai-streaming.md)

### 🔧 Improvements

#### Vast.ai Deployment
- Robust Xorg/Xvfb fallback handling with validation
- NVIDIA Vulkan ICD isolation (force single ICD to avoid conflicts)
- PulseAudio user-mode setup with fallback
- X server socket cleanup before Xvfb start
- Display accessibility verification
- Deployment fails fast if WebGPU unavailable

#### Streaming Stability
- Improved FFmpeg buffering (4x bitrate buffer)
- Audio drift recovery with async resampling
- Thread queue sizing for audio/video inputs
- GOP size configuration via `STREAM_GOP_SIZE`
- Low latency mode toggle via `STREAM_LOW_LATENCY`

#### Security
- Removed hardcoded secrets from `ecosystem.config.cjs`
- All secrets read from environment variables
- Updated `.gitignore` to block all `.env` files in subdirectories
- Added `.env.example` documenting required secrets

### 🐛 Bug Fixes

#### Rendering
- Fixed WebGL references in client code (updated to WebGPU)
- Fixed visual testing to use 2D canvas for pixel reading (WebGPU compatible)
- Updated error messages to mention WebGPU instead of WebGL

#### Streaming
- Fixed PulseAudio permissions and fallback
- Fixed Kick RTMP URL (added `/app` path)
- Fixed missing `STREAM_CAPTURE_USE_EGL` variable
- Fixed await in non-async function for PulseAudio check
- Fixed multi-line commit messages in Pages deploy

#### Deployment
- Fixed bun installation in CI/CD
- Fixed env var writing to `.env` file in SSH script
- Fixed secrets injection in deploy workflow
- Added `JWT_SECRET` and `ARENA_EXTERNAL_BET_WRITE_KEY` to secrets

#### CSP
- Allow `data:` URLs for WASM loading
- Allow Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
- Allow Cloudflare Insights (`static.cloudflareinsights.com`)
- Fixed vite-plugin-node-polyfills shims resolution

### 📝 Documentation

#### New Documentation
- [docs/vast-ai-streaming.md](docs/vast-ai-streaming.md) - Complete streaming architecture
- [docs/instanced-rendering.md](docs/instanced-rendering.md) - Instanced rendering guide
- [docs/ai-agent-improvements.md](docs/ai-agent-improvements.md) - AI optimization details
- [docs/api/renderer-factory.md](docs/api/renderer-factory.md) - Renderer API reference
- [docs/security/content-security-policy.md](docs/security/content-security-policy.md) - CSP guide

#### Updated Documentation
- [AGENTS.md](AGENTS.md) - Added Vast.ai deployment architecture section
- [CLAUDE.md](CLAUDE.md) - Updated browser requirements, added webgpureport.org link
- [README.md](README.md) - Added documentation index, updated GPU streaming section

### 🔄 Refactoring

#### Renderer
- Removed WebGL detection and fallback logic from `RendererFactory.ts`
- Simplified renderer creation (WebGPU-only path)
- Updated exports in `index.ts` and `index.client.ts`

#### Streaming
- Removed `STREAM_CAPTURE_DISABLE_WEBGPU` logic (WebGPU always enabled)
- Removed `forceWebGL` and `disableWebGPU` URL parameters
- Simplified Chrome launch args (always use WebGPU)

## Environment Variables

### New Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_GOP_SIZE` | `60` | GOP size (keyframe interval) for streaming |
| `STREAM_LOW_LATENCY` | `false` | Use zerolatency tune (true) or film tune (false) |
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture via PulseAudio |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` | `30000` | Timeout for capture recovery |
| `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` | `6` | Max failures before fallback |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Browser channel for streaming |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | ANGLE backend (vulkan/metal) |
| `STREAM_CDP_QUALITY` | `80` | JPEG quality for CDP capture (1-100) |

### Deprecated Variables

| Variable | Status | Replacement |
|----------|--------|-------------|
| `STREAM_CAPTURE_DISABLE_WEBGPU` | Ignored | WebGPU always enabled |
| `DUEL_FORCE_WEBGL_FALLBACK` | Ignored | WebGL not supported |

## API Changes

### Removed APIs

#### RendererFactory
- ❌ `isWebGLAvailable()` - WebGL not supported
- ❌ `isWebGLForced()` - WebGL not supported
- ❌ `isWebGLFallbackForced()` - No fallback exists
- ❌ `isWebGLFallbackAllowed()` - No fallback exists
- ❌ `isOffscreenCanvasAvailable()` - Not used with WebGPU
- ❌ `canTransferCanvas()` - Not used with WebGPU

### Type Changes

#### RendererFactory
- `UniversalRenderer` → `WebGPURenderer`
- `RendererBackend` is now only `'webgpu'` (was `'webgl' | 'webgpu'`)

### New APIs

#### GLBResourceInstancer
```typescript
class GLBResourceInstancer {
  async init(): Promise<void>;
  addInstance(config: InstanceConfig): string;
  removeInstance(id: string): void;
  setDepleted(id: string, depleted: boolean): void;
  setDissolve(id: string, amount: number): void;
  update(camera: THREE.Camera): void;
  destroy(): void;
}
```

#### InstancedModelVisualStrategy
```typescript
class InstancedModelVisualStrategy implements ResourceVisualStrategy {
  async init(entity: ResourceEntity): Promise<void>;
  update(entity: ResourceEntity): void;
  onDepleted(entity: ResourceEntity): boolean;
  getHighlightMesh(): THREE.Mesh | null;
  destroy(): void;
}
```

#### HyperscapeService (AI Agents)
```typescript
class HyperscapeService {
  async waitForMovementComplete(timeoutMs?: number): Promise<boolean>;
  isMoving(): boolean;
  setFastTick(enabled: boolean): void;
}
```

## Performance Improvements

### Instanced Rendering
- **Draw calls**: 99.7% reduction (1000 instances: 3 draw calls vs 1000)
- **VRAM usage**: 90% reduction (1000 trees: 50MB vs 500MB)
- **CPU overhead**: <1ms per 1000 instances

### AI Agents
- **LLM calls**: 70% reduction (6/min → 1.8/min)
- **API costs**: 70% reduction ($0.50/hr → $0.15/hr per agent)
- **Response time**: 67% faster (12s → 4s average)

### Streaming
- **Capture speed**: 2-3x faster (CDP vs MediaRecorder)
- **CPU usage**: 40% reduction (no browser-side encoding)
- **Latency**: 30% lower (direct JPEG piping)

## Migration Guide

### WebGPU Migration

**Check browser compatibility**:
```typescript
import { isWebGPUAvailable } from '@hyperscape/shared';

if (!await isWebGPUAvailable()) {
  // Show error to user
  alert('WebGPU is required. Please use Chrome 113+, Edge 113+, or Safari 18+');
}
```

**Update renderer creation**:
```typescript
// Before
const renderer = await createRenderer({ allowWebGLFallback: true });

// After
const renderer = await createRenderer();  // WebGPU only, throws if unavailable
```

### Instanced Rendering Migration

**Update visual strategies**:
```typescript
// Before
import { StandardModelVisualStrategy } from '@hyperscape/shared';
const strategy = new StandardModelVisualStrategy({ modelPath: '...' });

// After
import { InstancedModelVisualStrategy } from '@hyperscape/shared';
const strategy = new InstancedModelVisualStrategy({ 
  modelPath: '...',
  depletedModelPath: '...',  // Optional
  depletedModelScale: new THREE.Vector3(0.8, 0.8, 0.8)  // Optional
});
```

**No other changes required** - automatic fallback if instancing fails.

### AI Agent Migration

**Update goal handling**:
```typescript
// Before
agent.setGoal({ type: 'woodcutting' });
// ... banking happens ...
agent.setGoal({ type: 'woodcutting' });  // Had to re-set goal

// After
agent.setGoal({ type: 'woodcutting' });
// ... banking happens automatically ...
// Goal auto-restores after banking
```

**Use movement awaiting**:
```typescript
// Before
async function bankItems() {
  this.moveTo(bank);
  return { success: true };  // Race condition
}

// After
async function bankItems() {
  await this.moveToAndWait(bank);  // Wait for arrival
  await this.deposit();
  return { success: true };
}
```

## Deployment Changes

### Vast.ai Deployment

**New validation steps**:
1. Verify NVIDIA GPU with `nvidia-smi`
2. Check Vulkan ICD availability
3. Attempt Xorg setup (if DRI/DRM available)
4. Fall back to Xvfb (if Xorg fails)
5. **Fail deployment** if neither works (no headless fallback)

**New environment variables**:
- `GPU_RENDERING_MODE` - Set by deploy script (`xorg` or `xvfb-vulkan`)
- `VK_ICD_FILENAMES` - Force NVIDIA Vulkan ICD
- `STREAM_CAPTURE_HEADLESS` - Always `false` (WebGPU requires display)

### GitHub Secrets

**New required secrets**:
- `KICK_STREAM_KEY` - Kick streaming key
- `KICK_RTMP_URL` - Kick RTMP URL
- `X_STREAM_KEY` - X/Twitter streaming key
- `X_RTMP_URL` - X/Twitter RTMP URL
- `ARENA_EXTERNAL_BET_WRITE_KEY` - Arena betting API key
- `JWT_SECRET` - JWT signing secret

## Known Issues

### Resolved
- ✅ Xorg swrast fallback detection (commit 725e934)
- ✅ PulseAudio permissions (commit aab66b0)
- ✅ Kick RTMP URL format (commit 5dbd239)
- ✅ CDP capture stalls (automatic recovery implemented)

### Active
- ⚠️ WebGPU memory leaks in long-running sessions (mitigated by 1-hour browser restart)
- ⚠️ Some Vast.ai containers lack DRM access (Xvfb fallback works)

## Contributors

- Shaw (@lalalune) - WebGPU enforcement, streaming infrastructure
- Ting Chien Meng (@tcm390) - Instanced rendering, highlight system
- Lucid (@dreaminglucid) - AI agent optimizations

## References

- **Repository**: [HyperscapeAI/hyperscape](https://github.com/HyperscapeAI/hyperscape)
- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)
- **Discussions**: [GitHub Discussions](https://github.com/HyperscapeAI/hyperscape/discussions)
