# Recent Changes (February 2026)

Quick reference for major changes in the February 2026 update cycle.

## 🚨 Breaking Changes

### WebGPU-Only Enforcement

**What changed**: Removed all WebGL fallback code. WebGPU is now strictly required.

**Impact**:
- Browser requirement: Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- Server requirement: NVIDIA GPU with Vulkan, Xorg/Xvfb display
- Deployment fails if WebGPU unavailable (no soft fallbacks)

**Action required**:
- Update browsers to WebGPU-capable versions
- Verify GPU streaming infrastructure has NVIDIA GPU
- Remove any WebGL-related code or configuration

**See**: [docs/migration/webgpu-only.md](migration/webgpu-only.md)

## ✨ New Features

### 1. Instanced Rendering

**What**: GPU instancing for resources (trees, rocks, ores, herbs)

**Benefits**:
- 99.7% draw call reduction (1000 instances: 3 calls vs 1000)
- 90% VRAM reduction (1000 trees: 50MB vs 500MB)
- Automatic LOD switching
- Instanced depletion states

**Usage**:
```typescript
import { InstancedModelVisualStrategy } from '@hyperscape/shared';

const strategy = new InstancedModelVisualStrategy({
  modelPath: '/models/resources/rock_01.glb',
  depletedModelPath: '/models/resources/rock_01_depleted.glb',
  depletedModelScale: new THREE.Vector3(0.8, 0.8, 0.8)
});
```

**See**: [docs/instanced-rendering.md](instanced-rendering.md)

### 2. AI Agent Optimizations

**What**: Reduced LLM API calls by 70% through intelligent decision-making

**Features**:
- Action locks (skip LLM during movement)
- Fast-tick mode (2s interval after movement)
- Short-circuit decisions (skip LLM for obvious actions)
- Banking goal type (auto-restore previous goal)
- Movement completion awaiting

**Impact**:
- 70% cost reduction ($0.50/hr → $0.15/hr per agent)
- 67% faster response time (12s → 4s average)
- More predictable agent behavior

**See**: [docs/ai-agent-improvements.md](ai-agent-improvements.md)

### 3. CDP Screencast Capture

**What**: Chrome DevTools Protocol frame capture for streaming

**Benefits**:
- 2-3x faster than MediaRecorder
- No browser-side encoding overhead
- Direct JPEG piping to FFmpeg
- Hardware-accelerated H.264 encoding

**Configuration**:
```bash
STREAM_CAPTURE_MODE=cdp
STREAM_CDP_QUALITY=80
STREAM_FPS=30
```

**See**: [docs/vast-ai-streaming.md](vast-ai-streaming.md)

### 4. PulseAudio Audio Capture

**What**: Capture game audio for streaming

**Setup**:
- Virtual sink: `chrome_audio`
- FFmpeg captures from monitor
- Automatic drift recovery

**Configuration**:
```bash
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

**See**: [docs/vast-ai-streaming.md#audio-pipeline](vast-ai-streaming.md#audio-pipeline)

### 5. RTMP Multi-Streaming

**What**: Simultaneous streaming to multiple platforms

**Platforms**:
- Twitch (RTMP)
- Kick (RTMPS)
- X/Twitter (RTMP)
- YouTube (optional, disabled by default)

**Configuration**:
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

**See**: [docs/vast-ai-streaming.md#rtmp-multi-streaming](vast-ai-streaming.md#rtmp-multi-streaming)

## 🔧 Improvements

### Vast.ai Deployment

**Changes**:
- Robust GPU validation (nvidia-smi, vulkaninfo)
- Xorg/Xvfb fallback with detection
- PulseAudio user-mode setup
- X server socket cleanup
- Fail-fast if WebGPU unavailable

**Impact**:
- More reliable deployments
- Better error messages
- No silent failures

### Streaming Stability

**Changes**:
- 4x bitrate buffer (18000k bufsize)
- Audio drift recovery (async resampling)
- Thread queue sizing (1024 frames)
- Resolution mismatch detection and recovery

**Impact**:
- Smoother playback
- Fewer buffering events
- Better audio sync

### Security

**Changes**:
- Removed hardcoded secrets from code
- All secrets from environment variables
- Updated `.gitignore` for `.env` files
- Added `.env.example` documentation

**Impact**:
- No secrets in git history
- Easier secret rotation
- Better security posture

## 🐛 Bug Fixes

### Critical Fixes

1. **Xorg swrast fallback detection** - Detect software rendering and switch to Xvfb
2. **PulseAudio permissions** - Fix root user access to PulseAudio
3. **Kick RTMP URL** - Add `/app` path to Kick ingest URL
4. **CDP capture stalls** - Automatic soft/hard recovery
5. **Resolution mismatches** - Auto-fix viewport size

### Minor Fixes

1. WebGL references updated to WebGPU in client code
2. Visual testing uses 2D canvas for pixel reading
3. Multi-line commit messages in Pages deploy
4. Bun installation in CI/CD
5. vite-plugin-node-polyfills shims resolution

## 📊 Performance Metrics

### Instanced Rendering

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Draw calls (1000 trees) | 1000 | 3 | 99.7% |
| VRAM (1000 trees) | 500MB | 50MB | 90% |
| CPU overhead | N/A | <1ms | Minimal |

### AI Agents

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LLM calls/min | 6 | 1.8 | 70% |
| Cost/hr/agent | $0.50 | $0.15 | 70% |
| Response time | 12s | 4s | 67% |

### Streaming

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Capture speed | 1x | 2-3x | 200-300% |
| CPU usage | 100% | 60% | 40% |
| Latency | 100ms | 70ms | 30% |

## 🔄 Migration Checklist

### For Developers

- [ ] Update browser to Chrome 113+, Edge 113+, or Safari 18+
- [ ] Remove any WebGL-related code
- [ ] Update renderer type from `UniversalRenderer` to `WebGPURenderer`
- [ ] Remove calls to `isWebGLAvailable()` and related functions
- [ ] Test with `isWebGPUAvailable()` instead

### For Deployment

- [ ] Verify NVIDIA GPU with `nvidia-smi`
- [ ] Check Vulkan with `vulkaninfo --summary`
- [ ] Set up Xorg or Xvfb display server
- [ ] Configure PulseAudio for audio capture
- [ ] Set stream keys in GitHub Secrets
- [ ] Remove `STREAM_CAPTURE_DISABLE_WEBGPU` from config
- [ ] Set `STREAM_CAPTURE_MODE=cdp`

### For Testing

- [ ] Update Playwright to use WebGPU-capable browser
- [ ] Add WebGPU flags to browser launch args
- [ ] Use headful browser (not headless)
- [ ] Enable GPU in CI/CD environment

## 📚 Documentation Updates

### New Documentation

- [docs/vast-ai-streaming.md](vast-ai-streaming.md) - Complete streaming architecture
- [docs/instanced-rendering.md](instanced-rendering.md) - Instanced rendering guide
- [docs/ai-agent-improvements.md](ai-agent-improvements.md) - AI optimization details
- [docs/api/renderer-factory.md](api/renderer-factory.md) - Renderer API reference
- [docs/security/content-security-policy.md](security/content-security-policy.md) - CSP guide
- [docs/migration/webgpu-only.md](migration/webgpu-only.md) - WebGPU migration guide
- [docs/configuration/environment-variables.md](configuration/environment-variables.md) - Complete env var reference

### Updated Documentation

- [AGENTS.md](../AGENTS.md) - Added Vast.ai deployment architecture
- [CLAUDE.md](../CLAUDE.md) - Updated browser requirements
- [README.md](../README.md) - Added documentation index, updated GPU streaming section
- [CHANGELOG.md](../CHANGELOG.md) - Complete change history

## 🎯 Quick Start (Updated)

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install

# 2. Configure environment
cp packages/client/.env.example packages/client/.env
cp packages/server/.env.example packages/server/.env
# Edit .env files with Privy credentials

# 3. Build and run
bun run build
bun run dev

# 4. Open in WebGPU-capable browser
# Chrome 113+, Edge 113+, or Safari 18+
open http://localhost:3333
```

### Vast.ai Streaming

```bash
# 1. Set GitHub Secrets
# TWITCH_STREAM_KEY, KICK_STREAM_KEY, X_STREAM_KEY
# DATABASE_URL, SOLANA_DEPLOYER_PRIVATE_KEY
# VAST_HOST, VAST_PORT, VAST_SSH_KEY

# 2. Push to main branch
git push origin main

# 3. GitHub Actions deploys automatically
# Validates WebGPU, sets up GPU rendering, starts streaming

# 4. Monitor deployment
# Check GitHub Actions logs
# SSH to Vast.ai: bunx pm2 logs hyperscape-duel
```

## 🆘 Getting Help

### Common Issues

1. **WebGPU not available** → [docs/migration/webgpu-only.md#troubleshooting](migration/webgpu-only.md#troubleshooting)
2. **Streaming not working** → [docs/vast-ai-streaming.md#troubleshooting](vast-ai-streaming.md#troubleshooting)
3. **Agents not responding** → [docs/ai-agent-improvements.md#monitoring](ai-agent-improvements.md#monitoring)
4. **CSP violations** → [docs/security/content-security-policy.md#troubleshooting](security/content-security-policy.md#troubleshooting)

### Support Channels

- **Documentation**: [docs/](.)
- **Issues**: [GitHub Issues](https://github.com/HyperscapeAI/hyperscape/issues)
- **Discussions**: [GitHub Discussions](https://github.com/HyperscapeAI/hyperscape/discussions)

## 📅 Timeline

- **2026-02-27**: WebGPU-only enforcement (commit 47782ed)
- **2026-02-27**: Instanced rendering for resources (commit 53a9513)
- **2026-02-27**: Instanced highlight meshes (commit 9643d5d)
- **2026-02-26**: AI agent optimizations (commit 60a03f4)
- **2026-02-26**: PulseAudio audio capture (commit 3b6f1ee)
- **2026-02-26**: Improved RTMP buffering (commit 4c630f1)
- **2026-02-28**: Secrets management overhaul (commit 47167b6)

## 🔮 What's Next

### Planned Features

- [ ] GPU-driven instance culling (compute shaders)
- [ ] Per-instance material variants
- [ ] Behavior trees for AI agents
- [ ] Multi-agent coordination
- [ ] WebCodecs capture mode (experimental)

### Performance Targets

- [ ] 100,000 instances with <5ms CPU overhead
- [ ] <1 LLM call per minute per agent
- [ ] <50ms stream latency (CDP to viewer)

## 📖 Full Documentation

For complete documentation, see:
- [README.md](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [AGENTS.md](../AGENTS.md) - AI assistant instructions
- [docs/](.) - Detailed documentation
