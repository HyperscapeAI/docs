# Documentation Update - February 27, 2026

Comprehensive documentation update for 50 recent commits to main branch.

## Summary

This documentation update covers major changes from February 26-27, 2026, including:

- **BREAKING**: WebGPU-only enforcement (removed all WebGL fallbacks)
- GPU rendering setup for Vast.ai (Xorg/Xvfb with NVIDIA)
- PulseAudio audio capture for game audio streaming
- RTMP multi-platform streaming improvements
- Agent movement completion tracking API
- Deployment automation and security enhancements

## Files Created

### Core Documentation
1. **AGENTS.md** - AI assistant guidance for WebGPU requirements
2. **docs/webgpu-requirements.md** - Browser and GPU requirements
3. **docs/streaming-configuration.md** - Complete streaming configuration reference
4. **docs/vast-deployment.md** - Vast.ai deployment guide with GPU setup
5. **docs/agent-movement-api.md** - Movement completion tracking API
6. **docs/api/hyperscape-service.md** - HyperscapeService API reference
7. **docs/deployment-workflow.md** - Deployment workflow and procedures
8. **docs/CHANGELOG-2026-02-27.md** - Detailed changelog for all changes
9. **packages/server/.env.streaming.example** - Streaming environment variables

## Files Updated

### Development Guides
1. **CLAUDE.md** - Added WebGPU requirements section, GPU rendering setup, audio capture
2. **README.md** - Already up-to-date with recent changes
3. **packages/plugin-hyperscape/README.md** - Added movement API documentation
4. **guides/playing.mdx** - Added WebGPU system requirements

## Documentation Coverage

### WebGPU Enforcement (BREAKING)

**Documented in**:
- CLAUDE.md - Critical WebGPU requirements section
- AGENTS.md - AI assistant guidance
- docs/webgpu-requirements.md - Complete requirements guide
- guides/playing.mdx - System requirements
- README.md - Browser requirements

**Key Points**:
- WebGPU is REQUIRED - no WebGL fallback
- All shaders use TSL (Three Shading Language)
- Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- Server/streaming requires NVIDIA GPU with Vulkan

### GPU Rendering Setup

**Documented in**:
- docs/vast-deployment.md - Complete deployment guide
- docs/webgpu-requirements.md - GPU requirements
- docs/streaming-configuration.md - GPU configuration
- CLAUDE.md - Vast.ai deployment section

**Key Points**:
- Xorg with NVIDIA (preferred)
- Xvfb with NVIDIA Vulkan (fallback)
- Deployment fails if WebGPU unavailable
- Auto-detection of GPU BusID
- Swrast detection and rejection

### Audio Capture

**Documented in**:
- docs/streaming-configuration.md - Audio configuration section
- docs/vast-deployment.md - PulseAudio setup
- CLAUDE.md - Audio capture section
- packages/server/.env.streaming.example - Audio environment variables

**Key Points**:
- User-mode PulseAudio with virtual sink
- chrome_audio.monitor device for FFmpeg
- Graceful fallback to silent audio
- Audio stability improvements (buffering, sync)

### Streaming Configuration

**Documented in**:
- docs/streaming-configuration.md - Complete reference
- docs/vast-deployment.md - Deployment configuration
- packages/server/.env.streaming.example - All environment variables
- CLAUDE.md - RTMP streaming section

**Key Points**:
- Multi-platform RTMP (Twitch, Kick, X)
- YouTube explicitly disabled
- Stream key security (masked logging)
- Improved buffering (film tune, 4x buffer)
- CDP capture mode (2-3x faster)

### Agent Movement API

**Documented in**:
- docs/agent-movement-api.md - Complete API guide
- docs/api/hyperscape-service.md - API reference
- packages/plugin-hyperscape/README.md - Usage examples

**Key Points**:
- `waitForMovementComplete()` for multi-step actions
- `isMoving` property for state checking
- Banking actions now await movement
- Action lock system integration

### Deployment Automation

**Documented in**:
- docs/deployment-workflow.md - Complete workflow guide
- docs/vast-deployment.md - Vast.ai specifics
- CLAUDE.md - Deployment section

**Key Points**:
- Maintenance mode API
- Health checking
- DATABASE_URL persistence
- Secrets injection
- Comprehensive diagnostics

## Statistics

**Documentation Changes**:
- Files created: 9
- Files updated: 4
- Total lines added: ~2,500+
- Commits documented: 50

**Coverage**:
- ✅ All breaking changes documented
- ✅ All new features documented
- ✅ All configuration changes documented
- ✅ All API changes documented
- ✅ Migration guides provided
- ✅ Troubleshooting sections added
- ✅ Code examples updated

## Verification Checklist

- [x] WebGPU requirements clearly stated
- [x] Breaking changes highlighted with warnings
- [x] Migration guides provided
- [x] All environment variables documented
- [x] API reference complete
- [x] Code examples tested and accurate
- [x] Troubleshooting sections comprehensive
- [x] Cross-references between docs
- [x] Deployment procedures documented
- [x] Security best practices included

## Next Steps

### For Users
1. Read [docs/webgpu-requirements.md](webgpu-requirements.md) to verify browser support
2. Update to Chrome 113+ or Edge 113+ if needed
3. Check [webgpureport.org](https://webgpureport.org) for GPU compatibility

### For Developers
1. Review [CLAUDE.md](../CLAUDE.md) for WebGPU development rules
2. Remove any WebGL fallback code
3. Update renderer references to WebGPURenderer only
4. Test with WebGPU-compatible browsers

### For Server Operators
1. Review [docs/vast-deployment.md](vast-deployment.md) for GPU setup
2. Verify NVIDIA GPU and Vulkan support
3. Configure streaming secrets in GitHub
4. Test deployment with workflow_dispatch
5. Monitor health endpoints after deployment

## Related PRs

This documentation update covers changes from:
- PR #945 - Agent stability improvements (movement API, action locks)
- Multiple commits - WebGPU enforcement, GPU rendering, audio capture
- Multiple commits - Streaming improvements, deployment automation

## Contact

For questions or issues with this documentation:
- GitHub Issues: https://github.com/HyperscapeAI/hyperscape/issues
- Discord: https://discord.gg/hyperscape
