# Docker Deployment Guide

This guide covers Docker deployment for Hyperscape, including recent fixes and best practices for production deployments.

## Overview

Hyperscape uses a multi-stage Docker build that produces a single image containing both the game server and web client. The build process handles several platform-specific challenges related to Bun workspace management, native dependencies, and Vite compilation.

## Dockerfile Architecture

### Build Stages

1. **node-build-tools**: Provides real Node.js binary for Vite builds
2. **builder**: Bun-based build stage that compiles all packages
3. **runtime**: Node.js 22 runtime for production server

### Runtime Requirements

**Critical**: The production server MUST run under Node.js 22+, not Bun.

**Reason**: uWebSockets.js native bindings depend on Node's N-API and fail under Bun's `node` compatibility shim. The March 2026 performance overhaul requires uWS for 50+ concurrent players with 25+ AI agents.

**Runtime Image**: `node:22-trixie-slim`
- **GLIBC Requirement**: uWebSockets.js requires GLIBC ≥ 2.38
- **Debian Trixie**: Provides GLIBC 2.38+ (Bookworm only has 2.36)
- **Slim Variant**: Minimal image size while including required system libraries

## Building the Image

### Basic Build

```bash
# Build from repository root
docker build --platform linux/amd64 -f Dockerfile.server -t hyperscape:latest .
```

### Multi-Platform Build

```bash
# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.server \
  -t ghcr.io/hyperscapeai/hyperscape:v1.0.0 \
  --push \
  .
```

### Build Arguments

```bash
# Custom build with arguments
docker build \
  --platform linux/amd64 \
  --build-arg NODE_ENV=production \
  --build-arg COMMIT_HASH=$(git rev-parse HEAD) \
  -f Dockerfile.server \
  -t hyperscape:latest \
  .
```

## Known Issues and Workarounds

### Issue 1: better-sqlite3 QEMU Segfault

**Problem**: `better-sqlite3` node-gyp build segfaults under QEMU cross-compilation (e.g., building linux/amd64 on macOS ARM).

**Workaround**: Strip `better-sqlite3` from package manifests before install:

```dockerfile
RUN bun -e " \
  const fs = require('fs'); \
  for (const f of ['packages/shared/package.json', 'package.json']) { \
    const p = JSON.parse(fs.readFileSync(f)); \
    delete p.dependencies?.['better-sqlite3']; \
    delete p.devDependencies?.['better-sqlite3']; \
    fs.writeFileSync(f, JSON.stringify(p, null, 2)); \
  }"
```

**Safe**: Hyperscape uses `bun:sqlite` (dev) and PostgreSQL (production), so `better-sqlite3` is not needed.

### Issue 2: Bun Workspace Symlinks Flattened

**Problem**: Docker `COPY` flattens symlinks. Bun workspaces use symlinks in `node_modules/@hyperscape/*` to reference local packages.

**Workaround**: Manually recreate workspace symlinks in runtime stage:

```dockerfile
RUN mkdir -p node_modules/@hyperscape && \
    ln -s ../../packages/shared node_modules/@hyperscape/shared && \
    ln -s ../../packages/server node_modules/@hyperscape/server && \
    # ... other packages ...
```

### Issue 3: Bun Per-Package node_modules

**Problem**: Bun 1.3+ uses per-package `node_modules` (not flat hoisting). When Bun hoists deps without materializing directories, Docker `COPY --from=builder` fails with "file not found".

**Workaround**: Defensively create all required directories before COPY:

```dockerfile
# Create every runtime COPY source explicitly
RUN mkdir -p \
    packages/server/node_modules \
    packages/shared/node_modules \
    packages/procgen/node_modules \
    packages/impostors/node_modules \
    packages/plugin-hyperscape/node_modules \
    packages/web3/node_modules \
    packages/client/node_modules
```

**When Added**: April 6, 2026 (Commits fca9ffb-cb237b6)

### Issue 4: Vite 8 Requires Node 22.12+

**Problem**: Bun 1.1.38 reports Node 22.6.0 when running Vite, but Vite 8 requires Node 22.12+.

**Workaround**: Copy real Node.js binary from `node:22-bookworm-slim` for Vite build steps:

```dockerfile
FROM node:22-bookworm-slim AS node-build-tools

FROM oven/bun:1.1.38-debian AS builder
COPY --from=node-build-tools /usr/local/bin/node /usr/local/bin/node

# Use real Node for Vite builds
RUN cd /app/packages/client && \
    NODE_OPTIONS='--max-old-space-size=4096' \
    node ../../node_modules/vite/bin/vite.js build
```

**When Added**: April 6, 2026 (Commit 58a18df)

## Environment Variables

### Build-Time Variables

```bash
# Skip asset downloads during build
SKIP_ASSETS=true

# Skip Playwright browser installation
HYPERSCAPE_SKIP_BROWSER_INSTALL=true

# CI mode (affects logging and error handling)
CI=true
```

### Runtime Variables

**Required:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-here
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret
```

**Optional:**
```bash
PORT=5555                    # HTTP server port
UWS_PORT=5556                # WebSocket server port
NODE_ENV=production          # Environment mode
PUBLIC_CDN_URL=https://...   # Asset CDN URL
PUBLIC_WS_URL=wss://...      # WebSocket URL for clients
PUBLIC_API_URL=https://...   # HTTP API URL for clients
```

See `packages/server/.env.example` for complete list.

## Running the Container

### Basic Run

```bash
docker run -d \
  --name hyperscape \
  -p 5555:5555 \
  -p 5556:5556 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e PRIVY_APP_ID=... \
  -e PRIVY_APP_SECRET=... \
  hyperscape:latest
```

### With Environment File

```bash
docker run -d \
  --name hyperscape \
  -p 5555:5555 \
  -p 5556:5556 \
  --env-file .env.production \
  hyperscape:latest
```

### With Volume Mounts

```bash
docker run -d \
  --name hyperscape \
  -p 5555:5555 \
  -p 5556:5556 \
  -v $(pwd)/world:/app/packages/server/world \
  -v $(pwd)/logs:/app/logs \
  --env-file .env.production \
  hyperscape:latest
```

## Health Checks

The Dockerfile includes a health check that verifies the server is responding:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
    CMD curl -fsS http://localhost:${PORT:-5555}/status >/dev/null || exit 1
```

**Check Status:**
```bash
docker inspect --format='{{.State.Health.Status}}' hyperscape
```

**View Health Logs:**
```bash
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' hyperscape
```

## Production Deployment

### Railway

Railway deployment uses the Dockerfile automatically:

```bash
# Deploy to Railway (main branch → prod)
git push origin main

# Deploy to Railway (dev branch → dev)
git push origin dev
```

**Configuration**: See `docs/railway-dev-prod.md` for Railway-specific setup.

### Manual Deployment

1. **Build Image:**
   ```bash
   docker build --platform linux/amd64 -f Dockerfile.server -t hyperscape:v1.0.0 .
   ```

2. **Push to Registry:**
   ```bash
   docker tag hyperscape:v1.0.0 ghcr.io/hyperscapeai/hyperscape:v1.0.0
   docker push ghcr.io/hyperscapeai/hyperscape:v1.0.0
   ```

3. **Deploy:**
   ```bash
   docker pull ghcr.io/hyperscapeai/hyperscape:v1.0.0
   docker run -d \
     --name hyperscape \
     -p 5555:5555 \
     -p 5556:5556 \
     --env-file .env.production \
     --restart unless-stopped \
     ghcr.io/hyperscapeai/hyperscape:v1.0.0
   ```

## Troubleshooting

### Build Failures

**Missing node_modules directories:**

**Error:**
```
COPY failed: file not found in build context or excluded by .dockerignore: 
stat packages/client/node_modules: file does not exist
```

**Cause**: Bun hoisted dependencies without materializing per-package `node_modules`.

**Fix**: Update to latest Dockerfile (April 2026) which includes defensive `mkdir -p` commands.

**Verification:**
```bash
# Check Dockerfile includes mkdir for all packages
grep "mkdir -p" Dockerfile.server
```

**Vite build failures:**

**Error:**
```
Error: Cannot find module 'vite'
```

**Cause**: Bun's Node compatibility shim doesn't fully support Vite 8.

**Fix**: Use real Node.js for Vite builds (already in latest Dockerfile):
```dockerfile
COPY --from=node-build-tools /usr/local/bin/node /usr/local/bin/node
RUN node ../../node_modules/vite/bin/vite.js build
```

**better-sqlite3 segfault:**

**Error:**
```
Segmentation fault (core dumped)
```

**Cause**: node-gyp cross-compilation under QEMU.

**Fix**: Strip `better-sqlite3` from manifests before install (already in latest Dockerfile).

### Runtime Failures

**uWebSockets.js binding errors:**

**Error:**
```
Error: Cannot find module 'uWebSockets.js'
or
Error: The module was compiled against a different Node.js version
```

**Cause**: Running under Bun instead of Node.js, or wrong GLIBC version.

**Fix**: 
1. Verify runtime image is `node:22-trixie-slim` (not `oven/bun:*`)
2. Verify GLIBC ≥ 2.38: `ldd --version`
3. Check CMD uses `node`, not `bun`

**Missing workspace symlinks:**

**Error:**
```
Error: Cannot find module '@hyperscape/shared'
```

**Cause**: Workspace symlinks not recreated in runtime stage.

**Fix**: Verify Dockerfile includes symlink creation:
```dockerfile
RUN mkdir -p node_modules/@hyperscape && \
    ln -s ../../packages/shared node_modules/@hyperscape/shared
```

## Performance Optimization

### Build Cache

Use BuildKit cache mounts to speed up rebuilds:

```dockerfile
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache
docker build \
  --cache-from ghcr.io/hyperscapeai/hyperscape:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -f Dockerfile.server \
  -t hyperscape:latest \
  .
```

### Multi-Stage Optimization

The Dockerfile uses multi-stage builds to minimize final image size:

- **Builder stage**: Includes build tools (Python, make, g++, pkg-config)
- **Runtime stage**: Only includes runtime dependencies (libcairo, libpango, etc.)

**Image Size Comparison:**
- Builder stage: ~2.5GB (includes build tools)
- Runtime stage: ~450MB (production-ready)

## Security Considerations

### Secrets Management

**Never bake secrets into the image:**

```bash
# ❌ BAD - secrets in image layers
docker build --build-arg JWT_SECRET=my-secret ...

# ✅ GOOD - secrets via environment at runtime
docker run -e JWT_SECRET=my-secret ...
```

### Non-Root User

The current Dockerfile runs as root. For production, consider adding a non-root user:

```dockerfile
# Add to runtime stage
RUN groupadd -r hyperscape && useradd -r -g hyperscape hyperscape
RUN chown -R hyperscape:hyperscape /app
USER hyperscape
```

### Minimal Attack Surface

The runtime image uses `node:22-trixie-slim` which:
- Excludes unnecessary packages
- Reduces attack surface
- Minimizes image size

## See Also

- `Dockerfile.server` - Production Dockerfile
- `docs/railway-dev-prod.md` - Railway deployment guide
- `packages/server/.env.example` - Environment variable reference
- `.dockerignore` - Files excluded from build context
