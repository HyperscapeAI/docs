# Changelog - April 2026

This document tracks all significant changes made to Hyperscape during April 2026.

## Client Runtime Environment Hydration (April 7, 2026)

**Commits**: 8753bb6, ebbb9ed

### Problem
Client auth configuration was reading from build-time environment variables, causing auth failures in production when runtime environment differed from build environment. This made it impossible to change Privy App ID without rebuilding the entire client bundle.

### Solution
- Hydrate runtime environment before auth bootstrap
- Auth config now resolves from `window.__RUNTIME_ENV__` injected at runtime via `public/env.js`
- `packages/client/src/lib/api-config.ts` reads from runtime env instead of build-time `import.meta.env`

### Impact
- ✅ Auth works correctly in production environments
- ✅ Runtime configuration overrides build-time defaults
- ✅ Fixes "Invalid Privy App ID" errors in deployed environments
- ✅ Simplified deployment workflow for auth provider changes

### Files Changed
- `packages/client/src/lib/api-config.ts` - Read from runtime env
- `packages/client/src/index.tsx` - Hydrate runtime env before auth bootstrap
- `packages/client/public/env.js` - Runtime environment injection

---

## Railway Production Defaults (April 5-6, 2026)

**Commits**: ba7f6f4, bc647e3, 4fd1d44

### Changes
- Production API defaults to `https://hyperscape.gg` for server runtime
- Local development defaults to `ws://localhost:5556/ws` for agent runtime
- Railway deployment uses Debian Trixie runtime for uWebSockets.js GLIBC 2.38+ requirement
- Restored Railway deployment targets after CI fixes

### Configuration
```bash
# Production (Railway)
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws

# Local development
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5556/ws
```

### Impact
- ✅ Simplified production deployment configuration
- ✅ Consistent defaults across environments
- ✅ uWebSockets.js works correctly on Railway with Trixie runtime
- ✅ AI agents connect correctly to local game server during development

---

## CI/CD Infrastructure Upgrades (April 6, 2026)

**Commits**: 15e62b9, 9d45fae, 5dbd8b9, 3750589, 58a18df, eece809

### Changes
- **Node.js 24 Runners**: Updated all GitHub Actions workflows to use `node24` runners
- **Workflow Tokens**: Fixed Claude code review workflow token permissions
- **Foundry Removal**: Dropped unused Foundry installations from CI pipeline
- **Docker Build**: Switched to real Node.js for Vite builds instead of Bun compatibility shim
- **Bun Version Alignment**: Aligned Docker builder with pinned Bun v1.3.10

### Impact
- ✅ Faster CI builds with latest GitHub runner infrastructure
- ✅ More reliable Docker image builds with Node.js-based Vite compilation
- ✅ Reduced CI complexity and build times
- ✅ Better automation workflow reliability
- ✅ Consistent Bun version across development and Docker builds

---

## Docker Build Fixes (April 6, 2026)

**Commits**: fca9ffb, cb237b6, 86214e5

### Problem
Docker builds were failing with `COPY failed: file not found` errors for `packages/*/node_modules` directories. Bun's workspace hoisting behavior doesn't always materialize per-package `node_modules` directories, causing COPY operations to fail.

### Solution
Added defensive `mkdir -p` commands in `Dockerfile.server` to create all required directories before COPY operations:

```dockerfile
# Bun may hoist workspace deps without materializing per-package node_modules.
# Create every runtime COPY source explicitly so missing dirs don't break builds.
RUN mkdir -p \
    packages/server/node_modules \
    packages/shared/node_modules \
    packages/procgen/node_modules \
    packages/impostors/node_modules \
    packages/plugin-hyperscape/node_modules \
    packages/web3/node_modules \
    packages/client/node_modules
```

### Additional Fixes
- **Empty Downloads**: Fixed CI pipeline to handle empty download artifacts gracefully
- **Railway Auth Drift**: Resolved Railway authentication drift issues in deployment pipeline
- **TypeScript Compilation**: Call `tsc` directly in Docker build for better error visibility

### Impact
- ✅ Reliable Docker image builds across all environments
- ✅ No more missing node_modules directory errors
- ✅ Improved CI/CD stability
- ✅ Production deployments work consistently
- ✅ Better error messages during Docker builds

---

## Tailwind CSS Stabilization (April 2026)

**PR**: #1105  
**Commits**: 07a8bc7, 5eb078c, 1307fc7

### Timeline
1. **April 4**: Temporarily rolled back to Tailwind v3.4.1 due to production artifact issues
2. **April 28**: Upgraded to Tailwind v4.1.14 with `@tailwindcss/postcss` plugin
3. **Current**: Stable on Tailwind v3.4.19 with standard PostCSS pipeline

### Problem
Tailwind v4 was dropping critical auth and character-screen utilities in linux/amd64 Docker production builds, even after:
- Switching to `@tailwindcss/vite` plugin
- Pinning Tailwind v4 versions
- Forcing the oxide WASI path

Missing utilities included: `inset-0`, `top-4`, `gap-2`, `p-6`, `px-4`, `py-4`, `pr-5`, `h-48`, `bg-black/80`, `bg-white/20`, `border-white/20`, `shadow-2xl`

### Solution
Rolled back to Tailwind v3.4.19 with standard PostCSS pipeline:

**`packages/client/postcss.config.js`**:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**`packages/client/tailwind.config.js`**:
```javascript
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### Verification
Rebuilt dependencies and verified in isolated amd64 Docker builds that all previously missing utilities were emitted correctly.

### Impact
- ✅ Consistent CSS output across development and Docker production builds
- ✅ No more missing utility classes in production
- ✅ Stable build pipeline for deployment
- ✅ Reliable auth and character screen styling
- ✅ All critical utilities reliably generated

---

## Bank Panel Duplicate Hover Handler Fix (April 6, 2026)

**Commit**: 192696d

### Problem
`BankPanel.tsx` had duplicate `onMouseEnter` handlers on bank tab buttons, causing incorrect hover behavior. In React, when duplicate props are specified, only the last one wins, silently ignoring the first handler.

### Solution
Merged duplicate `onMouseEnter` handlers into single implementation that handles both hover state and tooltip display.

### Impact
- ✅ Fixed bank tab hover behavior
- ✅ Tooltips display correctly on bank tabs
- ✅ Cleaner code without duplicate event handlers

---

## Panel Affordances and Test Deploy Flow (April 6, 2026)

**Commit**: 976d075

### Changes
- Restored panel affordances (visual feedback for interactive elements)
- Aligned test deployment flow with production configuration
- Fixed panel interaction states across all UI components

### Impact
- ✅ Better visual feedback for interactive UI elements
- ✅ Consistent test and production deployment behavior
- ✅ Improved user experience with clearer interaction states

---

## Summary

### Breaking Changes
None in April 2026. All changes are backward-compatible improvements.

### New Features
- Runtime environment hydration for auth configuration
- Improved Docker build reliability with defensive directory creation
- Stable Tailwind CSS pipeline with v3.4.19

### Bug Fixes
- Fixed auth failures in production environments
- Fixed Docker build failures with missing node_modules
- Fixed Tailwind CSS missing utilities in production
- Fixed duplicate bank panel hover handlers
- Fixed Railway auth drift issues
- Fixed empty downloads handling in CI

### Performance Improvements
- Faster CI builds with Node.js 24 runners
- Reduced CI complexity by removing unused Foundry installations
- More reliable Docker builds with Node.js-based Vite compilation

### Infrastructure
- Upgraded GitHub Actions to Node.js 24 runners
- Switched Docker runtime to Debian Trixie for uWebSockets.js compatibility
- Improved Railway deployment configuration

### Documentation
- Updated AGENTS.md with April 2026 changes
- Updated CLAUDE.md with April 2026 changes
- Updated README.md with April 2026 changes
- Created comprehensive changelog for April 2026

---

## Migration Guide

### Updating from Pre-April 2026

1. **Pull latest changes**:
   ```bash
   git pull origin main
   bun install
   bun run build
   ```

2. **Update environment variables** (if deploying to production):
   ```bash
   # Client .env - no changes needed, runtime env now used
   # Server .env - verify PRIVY_APP_ID and PRIVY_APP_SECRET are set
   ```

3. **Rebuild Docker images** (if using Docker deployment):
   ```bash
   docker build --platform linux/amd64 -f Dockerfile.server -t hyperscape:latest .
   ```

4. **Verify WebSocket port** (if using custom configuration):
   ```bash
   # Ensure PUBLIC_WS_URL points to port 5556 (uWebSockets.js)
   PUBLIC_WS_URL=ws://localhost:5556/ws  # Local
   PUBLIC_WS_URL=wss://hyperscape.gg/ws  # Production
   ```

5. **Test auth flow**:
   - Clear browser cache and cookies
   - Visit http://localhost:3333
   - Verify Privy auth modal appears
   - Create character and verify persistence

### Known Issues
None. All April 2026 changes are stable and production-ready.

---

## Related Documentation

- [AGENTS.md](../AGENTS.md) - AI coding assistant instructions
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [README.md](../README.md) - Project overview
- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway deployment guide
- [docs/performance-march-2026.md](performance-march-2026.md) - March 2026 performance overhaul
