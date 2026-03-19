# Migration Guide

This guide helps you upgrade Hyperscape to the latest version with minimal disruption.

## Table of Contents

- [Upgrading to March 2026 Release](#upgrading-to-march-2026-release)
  - [Bun 1.3.10 Upgrade](#bun-1310-upgrade)
  - [Vite 8.0.0 Upgrade](#vite-800-upgrade)
  - [Docker Changes](#docker-changes)
  - [Dependency Updates](#dependency-updates)
- [Breaking Changes](#breaking-changes)
- [Troubleshooting](#troubleshooting)

## Upgrading to March 2026 Release

### Prerequisites

Before upgrading, ensure you have:
- Git LFS installed (`brew install git-lfs` or `apt install git-lfs`)
- Docker Desktop running (for local development)
- Backup of your local database (if you have important data)

### Step 1: Update Bun

The March 2026 release requires Bun 1.3.10 or higher (upgraded from 1.1.38).

**Why?** Bun 1.3.10 is required for Vite 6+ compatibility and includes important fixes for workspace dependency resolution.

```bash
# Update Bun to latest version
curl -fsSL https://bun.sh/install | bash

# Verify version (should be 1.3.10 or higher)
bun --version
```

### Step 2: Pull Latest Code

```bash
# Pull latest changes
git pull origin main

# Update Git LFS assets
git lfs pull
```

### Step 3: Clean Install Dependencies

**Important**: You must do a clean install due to Bun's changed dependency hoisting behavior in 1.3.x.

```bash
# Remove all node_modules
rm -rf node_modules packages/*/node_modules

# Clean Bun cache (optional but recommended)
rm -rf ~/.bun/install/cache

# Fresh install
bun install
```

### Step 4: Rebuild All Packages

```bash
# Build all packages in correct order
bun run build
```

This will build:
1. `physx-js-webidl` (PhysX WASM bindings)
2. `shared` (core engine)
3. All other packages (server, client, etc.)

### Step 5: Reset Database (Optional)

If you encounter database schema errors, reset your local database:

> ⚠️ **Warning**: This will delete all local data (characters, inventory, progress).

```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null
docker rm hyperscape-postgres 2>/dev/null

# Remove postgres volumes
docker volume rm hyperscape-postgres-data 2>/dev/null
docker volume rm server_postgres-data 2>/dev/null

# Remove any remaining hyperscape volumes
docker volume ls | grep -i hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify volumes are gone
docker volume ls | grep -i hyperscape
```

### Step 6: Start Development Server

```bash
# Start CDN (serves game assets)
bun run cdn:up

# Start game server and client
bun run dev
```

Open http://localhost:3333 in your browser.

## Bun 1.3.10 Upgrade

### What Changed

Bun 1.3.10 introduces several changes that affect Hyperscape:

1. **Dependency Hoisting**: Bun 1.3 no longer hoists all dependencies to the root `node_modules`. Each package now has its own `node_modules` directory.

2. **Workspace Symlinks**: Workspace dependencies (e.g., `@hyperscape/shared`) are now symlinked differently, which affects Docker builds.

3. **Vite Compatibility**: Bun 1.3.10 includes fixes required for Vite 6+ to work correctly.

### Migration Steps

1. **Clean Install** (required):
   ```bash
   rm -rf node_modules packages/*/node_modules
   bun install
   ```

2. **Update Docker Builds** (if deploying):
   - The Dockerfile has been updated to handle Bun 1.3's workspace structure
   - Rebuild your Docker images:
     ```bash
     docker build -t hyperscape-server -f packages/server/Dockerfile .
     ```

3. **Verify Workspace Dependencies**:
   ```bash
   # Check that shared package is accessible
   cd packages/server
   bun run -e "import('@hyperscape/shared').then(() => console.log('✓ Workspace deps OK'))"
   ```

### Common Issues

**Issue**: `Cannot find module '@hyperscape/shared'`

**Solution**: Clean install dependencies:
```bash
rm -rf node_modules packages/*/node_modules
bun install
```

**Issue**: Build fails with "Cannot resolve module"

**Solution**: Ensure you're using Bun 1.3.10+:
```bash
bun --version  # Should be 1.3.10 or higher
```

## Vite 8.0.0 Upgrade

### What Changed

Vite 8.0.0 includes several breaking changes:

1. **Build Output**: Changed default build output structure
2. **Plugin API**: Some plugin APIs have changed
3. **HMR**: Improved Hot Module Replacement with new protocol

### Migration Steps

1. **Update Dependencies**:
   ```bash
   bun install
   ```

2. **Check Vite Config**: Review `vite.config.ts` files for deprecated options
   - Most configs should work without changes
   - If you have custom plugins, check their Vite 8 compatibility

3. **Test Build**:
   ```bash
   bun run build
   ```

4. **Test Dev Server**:
   ```bash
   bun run dev
   ```

### Common Issues

**Issue**: Build fails with "Unknown option"

**Solution**: Check `vite.config.ts` for deprecated options. Common culprits:
- `build.polyfillDynamicImport` (removed)
- `optimizeDeps.include` (syntax changed)

**Issue**: HMR not working in dev mode

**Solution**: Clear Vite cache and restart:
```bash
rm -rf packages/client/.vite
bun run dev
```

## Docker Changes

### What Changed

The Dockerfile has been significantly updated:

1. **Bun 1.3.10**: Both builder and runtime stages now use Bun 1.3.10
2. **Client Build**: Docker image now includes client build (required for multi-service deployments)
3. **Workspace Symlinks**: Added `bun install --production` in runtime stage to restore symlinks
4. **Per-Package node_modules**: Explicitly copy package-level node_modules directories
5. **better-sqlite3 Removal**: Stripped from manifests to prevent QEMU segfaults

### Migration Steps

1. **Rebuild Docker Images**:
   ```bash
   docker build -t hyperscape-server -f packages/server/Dockerfile .
   ```

2. **Update Docker Compose** (if using):
   ```yaml
   services:
     server:
       image: hyperscape-server:latest
       # ... rest of config
   ```

3. **Verify Container Startup**:
   ```bash
   docker run -p 5555:5555 hyperscape-server
   ```

### Common Issues

**Issue**: Container fails with "Cannot find module"

**Solution**: Ensure you rebuilt the image after pulling latest code:
```bash
docker build --no-cache -t hyperscape-server -f packages/server/Dockerfile .
```

**Issue**: better-sqlite3 errors in Docker

**Solution**: This is expected - better-sqlite3 has been removed from Docker builds. Use PostgreSQL or `bun:sqlite` instead.

## Dependency Updates

### Major Version Bumps

The following dependencies have major version updates:

| Package | Old Version | New Version | Breaking Changes |
|---------|-------------|-------------|------------------|
| Vite | 6.4.1 | 8.0.0 | Plugin API changes, build output structure |
| @vitejs/plugin-react | 5.2.0 | 6.0.1 | React 19 compatibility |
| jsdom | 28.1.0 | 29.0.0 | DOM API updates |
| @nomicfoundation/hardhat-ethers | 3.1.3 | 4.0.6 | Ethers.js v6 compatibility |

### Migration Steps

1. **Update Dependencies**:
   ```bash
   bun install
   ```

2. **Test Your Code**:
   ```bash
   # Run tests
   bun test

   # Run linter
   bun run lint

   # Build all packages
   bun run build
   ```

3. **Check for Deprecation Warnings**: Review console output for any deprecation warnings

### Common Issues

**Issue**: Tests fail with jsdom errors

**Solution**: jsdom 29.0.0 has stricter DOM compliance. Update your tests to use proper DOM APIs.

**Issue**: Hardhat tests fail

**Solution**: @nomicfoundation/hardhat-ethers 4.x requires Ethers.js v6. Update your contract tests:
```typescript
// Old (Ethers v5)
const [owner] = await ethers.getSigners();

// New (Ethers v6)
const [owner] = await ethers.getSigners();
// API is mostly the same, but check Ethers v6 migration guide for details
```

## Breaking Changes

### Bun 1.3.10

- **Workspace Dependencies**: No longer hoisted to root `node_modules`
  - **Impact**: Docker builds must explicitly copy per-package node_modules
  - **Migration**: Use updated Dockerfile or run `bun install --production` in runtime stage

### Vite 8.0.0

- **Plugin API**: Some plugin hooks have changed
  - **Impact**: Custom Vite plugins may need updates
  - **Migration**: Check Vite 8 plugin migration guide

- **Build Output**: Default output structure changed
  - **Impact**: Minimal - Hyperscape uses custom output config
  - **Migration**: No action needed if using default config

### jsdom 29.0.0

- **DOM API**: Stricter standards compliance
  - **Impact**: Some tests may fail if using non-standard DOM APIs
  - **Migration**: Update tests to use proper DOM APIs

## Troubleshooting

### Build Errors

**Symptom**: Build fails with "Cannot resolve module"

**Solution**:
```bash
# Clean install
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Symptom**: Build fails with "Unknown option in vite.config.ts"

**Solution**: Check for deprecated Vite options and remove them.

### Runtime Errors

**Symptom**: Server crashes with "Cannot find module '@hyperscape/shared'"

**Solution**: Workspace symlinks are broken. Reinstall:
```bash
bun install
```

**Symptom**: Docker container fails to start

**Solution**: Rebuild image with no cache:
```bash
docker build --no-cache -t hyperscape-server -f packages/server/Dockerfile .
```

### Dev Server Issues

**Symptom**: Dev server uses 100% CPU

**Solution**: This was fixed in PR #1034. Ensure you're on latest code:
```bash
git pull origin main
```

**Symptom**: File watcher not detecting changes

**Solution**: The watcher may have fallen back to polling mode. Check console for warnings. This is expected behavior on some systems.

### Database Issues

**Symptom**: Database schema errors after upgrade

**Solution**: Reset database (see Step 5 above).

**Symptom**: Characters vanishing after upgrade

**Solution**: This is likely due to Privy credentials missing. Set `PUBLIC_PRIVY_APP_ID` in both client and server `.env` files.

## Getting Help

If you encounter issues not covered in this guide:

1. **Check GitHub Issues**: [github.com/HyperscapeAI/hyperscape/issues](https://github.com/HyperscapeAI/hyperscape/issues)
2. **Join Discord**: [discord.gg/hyperscape](https://discord.gg/hyperscape)
3. **Review AGENTS.md**: Detailed technical documentation
4. **Check CHANGELOG.md**: Complete list of changes

## Rollback Instructions

If you need to rollback to the previous version:

```bash
# Checkout previous version
git checkout <previous-commit-hash>

# Downgrade Bun (if needed)
curl -fsSL https://bun.sh/install | bash -s "bun-v1.1.38"

# Clean install
rm -rf node_modules packages/*/node_modules
bun install

# Rebuild
bun run build

# Reset database (optional)
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data

# Start server
bun run dev
```

## Next Steps

After successfully upgrading:

1. **Test Core Features**: Verify combat, movement, inventory, etc.
2. **Check AI Agents**: Ensure ElizaOS agents are working correctly
3. **Review Logs**: Check for any warnings or errors
4. **Update Documentation**: If you maintain custom docs, update them for new versions

## Additional Resources

- [AGENTS.md](AGENTS.md) - Development guidelines
- [CHANGELOG.md](CHANGELOG.md) - Complete changelog
- [README.md](README.md) - Quick start guide
- [Bun 1.3 Release Notes](https://bun.sh/blog/bun-v1.3)
- [Vite 8 Migration Guide](https://vitejs.dev/guide/migration)
