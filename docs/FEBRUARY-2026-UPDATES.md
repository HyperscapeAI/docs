# February 2026 Updates - Quick Reference

This document provides a quick reference for all major changes in February 2026. For complete details, see [CHANGELOG-FEBRUARY-2026.md](../CHANGELOG-FEBRUARY-2026.md).

## 🚨 Breaking Changes

### WebGPU Required
- **What**: WebGL fallback removed, WebGPU now mandatory
- **Why**: All shaders use TSL (Three.js Shading Language)
- **Action**: Upgrade to Chrome 113+, Edge 113+, or Safari 18+
- **Check**: [webgpureport.org](https://webgpureport.org)

### JWT_SECRET Required in Production
- **What**: Production/staging throw error if `JWT_SECRET` not set
- **Why**: Security hardening
- **Action**: Generate with `openssl rand -base64 32` and set in `.env`

## 🎉 New Features

### Maintenance Mode API
- **What**: Graceful deployment coordination
- **Endpoints**: `/admin/maintenance/enter`, `/admin/maintenance/status`, `/admin/maintenance/exit`
- **Use**: Zero-downtime deployments, safe database migrations
- **Docs**: [docs/deployment-best-practices.md](deployment-best-practices.md)

### VFX Catalog Browser
- **What**: Live Three.js previews of all game effects
- **Where**: Asset Forge → `/vfx` tab
- **Features**: Color swatches, parameter tables, layer breakdowns, phase timelines
- **Docs**: [packages/asset-forge/README.md](../packages/asset-forge/README.md)

### Multi-Platform Streaming
- **What**: RTMP streaming to Twitch, Kick, X/Twitter simultaneously
- **Config**: `packages/server/.env` → RTMP section
- **Docs**: [docs/streaming-configuration.md](streaming-configuration.md)

### Mobile UI (Gold Betting Demo)
- **What**: Fully responsive mobile-first betting interface
- **Features**: Resizable panels (desktop), bottom-sheet (mobile), live SSE feed
- **Docs**: [packages/gold-betting-demo/MOBILE-UI-GUIDE.md](../packages/gold-betting-demo/MOBILE-UI-GUIDE.md)

## ⚡ Performance Improvements

### Arena Rendering (97% Draw Call Reduction)
- **Before**: ~846 individual meshes, 28 dynamic lights
- **After**: ~20 InstancedMesh draw calls, 0 dynamic lights
- **Impact**: Massive FPS improvement, lower GPU load
- **Commit**: `c20d0fc`

### Teleport VFX Rewrite
- **What**: Object pooling, multi-phase animation, TSL shaders
- **Impact**: Zero-allocation spawning, smooth animations
- **Commit**: `7bf0e14`

### Streaming Stability
- **What**: Increased thresholds, soft CDP recovery
- **Impact**: Fewer stream restarts, no stream gaps
- **Commit**: `14a1e1b`

## 🐛 Critical Bug Fixes

### Memory Leak (InventoryInteractionSystem)
- **Symptom**: Server memory grows unbounded
- **Fix**: AbortController for event listener cleanup
- **Action**: Update to latest main
- **Commit**: `3bc59db`

### Model Cache Corruption
- **Symptom**: Missing objects, white textures after reload
- **Fix**: Identity map + DataTexture serialization
- **Action**: Clear cache: `indexedDB.deleteDatabase('hyperscape-processed-models')`

### Terrain Height Offset
- **Symptom**: Players floating 50m above ground
- **Fix**: Canonical tile/grid index helpers
- **Action**: Update to latest main (automatic fix)

### Duplicate Teleport VFX
- **Symptom**: 3 teleport effects instead of 1
- **Fix**: Race condition resolved, duplicate emits removed
- **Commit**: `7bf0e14`

## 🔒 Security Enhancements

### JWT Secret Enforcement
- **What**: Required in production/staging
- **Why**: Prevent weak authentication
- **Action**: Set `JWT_SECRET` in `.env`

### CSRF Cross-Origin Handling
- **What**: Skip CSRF for known cross-origin clients
- **Why**: Already protected by Origin + JWT auth
- **Impact**: Fixes Cloudflare Pages → Railway requests
- **Commit**: `cd29a76`

## 🔧 CI/CD Improvements

### npm 403 Retry Logic
- **What**: Automatic retry with exponential backoff
- **Impact**: Fewer CI build failures
- **Commits**: `7c9ff6c`, `08aa151`

### Tauri Build Fixes
- **What**: Split unsigned/release builds, platform-specific flags
- **Impact**: Reliable cross-platform builds
- **Commits**: `15250d2`, `8ce4819`, `f19a704`

### Dependency Cycle Resolution
- **What**: Resolved shared ↔ procgen cycle
- **How**: peerDependencies + devDependencies pattern
- **Commits**: `3b9c0f2`, `05c2892`, `f355276`

## 📚 New Documentation

1. **R2 CORS Configuration** - [docs/r2-cors-configuration.md](r2-cors-configuration.md)
2. **Deployment Best Practices** - [docs/deployment-best-practices.md](deployment-best-practices.md)
3. **Streaming Configuration** - [docs/streaming-configuration.md](streaming-configuration.md)
4. **Mobile UI Guide** - [packages/gold-betting-demo/MOBILE-UI-GUIDE.md](../packages/gold-betting-demo/MOBILE-UI-GUIDE.md)
5. **February 2026 Changelog** - [CHANGELOG-FEBRUARY-2026.md](../CHANGELOG-FEBRUARY-2026.md)

## 🚀 Quick Migration Checklist

### For All Users

- [ ] Update browser to Chrome 113+, Edge 113+, or Safari 18+
- [ ] Clear model cache: `indexedDB.deleteDatabase('hyperscape-processed-models')`
- [ ] Run `bun install && bun run build`

### For Production Deployments

- [ ] Generate and set `JWT_SECRET`: `openssl rand -base64 32`
- [ ] Set `ADMIN_CODE` for security
- [ ] Configure R2 CORS (run `scripts/configure-r2-cors.sh`)
- [ ] Review streaming configuration (if using RTMP)
- [ ] Test maintenance mode API (if using Vast.ai)

### For Developers

- [ ] Update to latest main branch
- [ ] Review architectural audit TODOs in CLAUDE.md
- [ ] Check for explicit `any` types in new code
- [ ] Use `bun install --frozen-lockfile` in CI

## 📊 Impact Summary

**Code Changes:**
- ~15,000+ lines changed
- ~200+ files modified
- 30+ commits in February 2026

**Performance:**
- 97% draw call reduction (arena rendering)
- 68% reduction in explicit `any` types
- 0ms default streaming delay (instant broadcast)

**Reliability:**
- Fewer stream restarts (increased thresholds)
- Memory leak fixed (event listener cleanup)
- Model cache corruption resolved

**Security:**
- JWT_SECRET enforcement
- CSRF cross-origin handling
- ADMIN_CODE requirement

**Developer Experience:**
- Comprehensive documentation (5 new guides)
- Improved error messages
- Better troubleshooting guides

## 🔗 Quick Links

- **Main README**: [README.md](../README.md)
- **Development Guide**: [CLAUDE.md](../CLAUDE.md)
- **Full Changelog**: [CHANGELOG-FEBRUARY-2026.md](../CHANGELOG-FEBRUARY-2026.md)
- **Deployment Guide**: [docs/deployment-best-practices.md](deployment-best-practices.md)
- **Streaming Guide**: [docs/streaming-configuration.md](streaming-configuration.md)
- **R2 CORS Guide**: [docs/r2-cors-configuration.md](r2-cors-configuration.md)

## 💬 Support

- **Issues**: https://github.com/HyperscapeAI/hyperscape/issues
- **Discussions**: https://github.com/HyperscapeAI/hyperscape/discussions
- **Discord**: [Join our community](https://discord.gg/hyperscape)

## 🙏 Contributors

Special thanks to:
- **Shaw** (@lalalune) - Streaming, deployment, security
- **SYMBiEX** (@SYMBaiEX) - Mobile UI, betting interface
- **Ting Chien Meng** (@tcm390) - Arena performance, instancing
- **Lucid** (@dreaminglucid) - VFX systems, teleport effects
