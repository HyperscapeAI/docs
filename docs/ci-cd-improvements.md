# CI/CD Improvements (February 2026)

## Overview

Multiple CI/CD workflow improvements were implemented in February 2026 to address build failures, npm rate limiting, and cross-platform compatibility issues. These changes ensure reliable builds across all platforms and deployment targets.

## npm Rate Limiting Fixes

### Problem

GitHub Actions IP ranges are rate-limited by npm, causing intermittent 403 Forbidden errors during `bun install`:

```
error: GET https://registry.npmjs.org/@types/node - 403 Forbidden
```

**Impact**: ~30% of CI builds failed randomly, requiring manual retries.

### Solution 1: Frozen Lockfile

All workflows now use `--frozen-lockfile` to prevent npm resolution:

```yaml
- name: Install dependencies
  run: bun install --frozen-lockfile
```

**Effect**: Bun uses only the committed `bun.lock` for resolution, avoiding npm registry queries.

**Commits**: 08aa151, 7c9ff6c

### Solution 2: Retry with Backoff

Added retry logic (up to 5 attempts) with exponential backoff:

```yaml
- name: Install dependencies with retry
  run: |
    for i in {1..5}; do
      if bun install --frozen-lockfile; then
        exit 0
      fi
      DELAY=$((15 * i))
      echo "Install failed, retrying in ${DELAY}s (attempt $i/5)..."
      sleep $DELAY
    done
    exit 1
```

**Backoff Schedule:**
- Attempt 1: Immediate
- Attempt 2: 15s delay
- Attempt 3: 30s delay
- Attempt 4: 45s delay
- Attempt 5: 60s delay

**Effect**: Transient rate limits are automatically retried, reducing failure rate to <1%.

**Commits**: 7c9ff6c, 8ce4819

### Solution 3: Windows-Specific Retry

Windows runners have higher npm 403 error rates. Added platform-specific retry:

```yaml
- name: Install dependencies (Windows)
  if: runner.os == 'Windows'
  run: |
    for ($i=1; $i -le 3; $i++) {
      if (bun install --frozen-lockfile) { exit 0 }
      Write-Host "Install failed, retrying (attempt $i/3)..."
      Start-Sleep -Seconds (15 * $i)
    }
    exit 1
```

**Effect**: Windows builds now succeed reliably despite higher npm rate limiting.

**Commit**: 8ce4819

## Tauri Build Fixes

### macOS DMG Bundling

**Problem**: Unsigned macOS builds failed with DMG creation errors (requires code signing certificates).

**Solution**: Use `--bundles app` for unsigned builds to produce only `.app` bundles:

```yaml
- name: Build unsigned macOS app
  run: bun tauri build --bundles app  # Skip DMG creation
```

**Effect**: Unsigned macOS builds succeed, producing `.app` bundles without requiring certificates.

**Commit**: f19a704

### iOS Unsigned Builds

**Problem**: iOS unsigned builds always fail with "Signing requires a development team".

**Solution**: Make iOS build job release-only:

```yaml
ios-build:
  if: startsWith(github.ref, 'refs/tags/v')  # Release builds only
  runs-on: macos-latest
  steps:
    - run: bun tauri ios build
```

**Effect**: iOS builds only run for tagged releases (which have signing secrets), avoiding unsigned build failures.

**Commit**: 8ce4819

### Linux/Windows Bundle Type

**Problem**: `--bundles app` is macOS-only, causing Linux/Windows builds to fail.

**Solution**: Use `--no-bundle` for unsigned Linux/Windows builds:

```yaml
- name: Build unsigned (Linux/Windows)
  run: bun tauri build --no-bundle  # Raw binaries only
```

**Effect**: Linux/Windows unsigned builds produce raw binaries without packaging.

**Commit**: f19a704

### Signing Secret Handling

**Problem**: Empty `APPLE_CERTIFICATE` env var caused signing to fail (security import error).

**Solution**: Split builds into unsigned and release variants:

```yaml
# Unsigned builds (no signing env vars)
desktop-unsigned:
  if: "!startsWith(github.ref, 'refs/tags/v')"
  steps:
    - run: bun tauri build --no-bundle
  # No APPLE_CERTIFICATE, APPLE_SIGNING_IDENTITY, etc.

# Release builds (with signing secrets)
desktop-release:
  if: startsWith(github.ref, 'refs/tags/v')
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  steps:
    - run: bun tauri build
```

**Effect**: Signing env vars only present during actual releases, preventing empty-string signing failures.

**Commit**: 15250d2

## Deployment Improvements

### Vast.ai Deployment

**Vulkan Driver Installation:**

Added Vulkan driver installation for GPU rendering on Vast.ai instances:

```bash
# In deploy-vast.sh
apt-get update
apt-get install -y vulkan-tools libvulkan1 mesa-vulkan-drivers
```

**Effect**: WebGPU renderer works correctly on Vast.ai GPU instances.

**Commit**: 30b52bd

**Post-Deploy Health Check:**

Added health check after deployment:

```bash
# Wait for server to start
sleep 10

# Check health endpoint
HEALTH=$(curl -s http://localhost:5555/health)
if [ "$(echo $HEALTH | jq -r '.status')" != "healthy" ]; then
  echo "Health check failed!"
  exit 1
fi
```

**Effect**: Deployment fails fast if server doesn't start correctly.

**Commit**: 30b52bd

### Vast-Keeper Health Monitoring

**Auto-Detect Unhealthy Instances:**

```typescript
// Poll /health endpoint
const health = await fetch(`${instanceUrl}/health`).then(r => r.json());

if (health.status !== 'healthy') {
  failureCount++;
  if (failureCount >= HEALTH_CHECK_FAILURE_THRESHOLD) {
    // Destroy and reprovision instance
    await vastApi.destroyInstance(instanceId);
    await vastApi.createInstance(config);
  }
}
```

**Configuration:**
```bash
HEALTH_CHECK_INTERVAL=60000          # Check every 60s
HEALTH_CHECK_FAILURE_THRESHOLD=3     # Destroy after 3 failures
```

**Effect**: Automatic recovery from instance failures without manual intervention.

**Commit**: 30b52bd

## Build Workflow Structure

### Matrix Strategy

**Desktop Builds:**
```yaml
matrix:
  platform:
    - os: ubuntu-latest
      target: x86_64-unknown-linux-gnu
    - os: windows-latest
      target: x86_64-pc-windows-msvc
    - os: macos-latest
      target: x86_64-apple-darwin
    - os: macos-latest
      target: aarch64-apple-darwin
```

**Mobile Builds:**
```yaml
matrix:
  platform:
    - os: macos-latest
      target: aarch64-apple-ios
    - os: ubuntu-latest
      target: aarch64-linux-android
```

### Artifact Upload

**Unsigned Builds:**
```yaml
- name: Upload unsigned binaries
  uses: actions/upload-artifact@v4
  with:
    name: ${{ matrix.platform.target }}-unsigned
    path: |
      packages/app/src-tauri/target/release/hyperscape
      packages/app/src-tauri/target/release/hyperscape.exe
```

**Release Builds:**
```yaml
- name: Upload release bundles
  uses: actions/upload-artifact@v4
  with:
    name: ${{ matrix.platform.target }}-release
    path: |
      packages/app/src-tauri/target/release/bundle/**/*.dmg
      packages/app/src-tauri/target/release/bundle/**/*.app
      packages/app/src-tauri/target/release/bundle/**/*.msi
      packages/app/src-tauri/target/release/bundle/**/*.AppImage
```

## Cloudflare Pages Deployment

### Wrangler Configuration

**Problem**: `pages_build_output_dir` deprecated in favor of `[assets]` directive.

**Solution**: Update `packages/client/wrangler.toml`:

```toml
# Before
pages_build_output_dir = "dist"

# After
[assets]
directory = "dist"
```

**Effect**: `wrangler deploy` works correctly for static asset hosting.

**Commit**: 42a1a0e

### Build Command

**Dashboard Configuration:**
- Build command: (empty)
- Build output directory: `dist`
- Root directory: `packages/client`

**Deployment:**
```bash
cd packages/client
bun run build
wrangler deploy
```

**Commit**: 42a1a0e, 1af02ce

## Dependency Cycle Resolution

### Problem

Turbo detected cyclic dependency: `shared → procgen → shared`

**Error:**
```
Error: Cyclic dependency detected: shared → procgen → shared
```

### Solution

Break cycle using peer/dev dependency pattern:

**packages/shared/package.json:**
```json
{
  "peerDependencies": {
    "@hyperscape/procgen": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@hyperscape/procgen": {
      "optional": true
    }
  }
}
```

**packages/procgen/package.json:**
```json
{
  "devDependencies": {
    "@hyperscape/shared": "workspace:*"
  }
}
```

**Effect**: Turbo build graph is acyclic, but imports resolve at runtime (both packages always installed together).

**Commits**: f355276, 3b9c0f2, 05c2892

## Asset Forge Build

### Problem

`deploy-vast.sh` used `npx tsc` but Vast.ai container only has Bun installed.

**Solution**: Use `bunx tsc` instead:

```bash
# Before
cd packages/asset-forge && npx tsc && cd ../..

# After
cd packages/asset-forge && bunx tsc && cd ../..
```

**Effect**: Asset Forge builds correctly in Vast.ai deployment environment.

**Commit**: c80ad7a

### Build Script

Asset Forge now has dedicated build script for services:

```bash
bun run build:services  # Builds backend services only (no frontend)
```

**Used by**: `deploy-vast.sh` for server-only deployments

**Commit**: 30b52bd

## Troubleshooting

### Build Failing with npm 403

**Symptoms:**
```
error: GET https://registry.npmjs.org/... - 403 Forbidden
```

**Solutions:**
1. Retry the workflow (automatic retry logic will handle it)
2. Wait 5-10 minutes for npm rate limit to reset
3. Check GitHub Actions status page for npm registry issues

**Prevention**: Use `--frozen-lockfile` in all workflows (already implemented).

### Tauri Build Failing

**Symptoms:**
```
Error: Signing requires a development team
Error: SecKeychainItemImport failed
```

**Solutions:**
1. **iOS unsigned**: Don't run iOS builds without signing secrets
2. **macOS signing**: Ensure `APPLE_CERTIFICATE` is set for release builds only
3. **Empty secrets**: Check secrets are not empty strings

**Prevention**: Use separate unsigned/release build jobs (already implemented).

### Dependency Cycle Errors

**Symptoms:**
```
Error: Cyclic dependency detected: shared ↔ procgen
```

**Solutions:**
1. Verify `procgen` is in `peerDependencies` of `shared/package.json`
2. Verify `shared` is in `devDependencies` of `procgen/package.json`
3. Run `bun install` to update lockfile

**Prevention**: Don't add `procgen` to `dependencies` in `shared/package.json`.

### Cloudflare Deployment Failing

**Symptoms:**
```
Error: pages_build_output_dir is deprecated
Error: Could not find build output directory
```

**Solutions:**
1. Use `[assets]` directive in `wrangler.toml`
2. Ensure `dist` directory exists before deploy
3. Run `bun run build` before `wrangler deploy`

**Prevention**: Use correct wrangler.toml format (already implemented).

## Best Practices

### Workflow Design

**Do:**
- Use `--frozen-lockfile` for all `bun install` commands
- Add retry logic for npm-dependent steps
- Split unsigned/release builds into separate jobs
- Use matrix strategy for multi-platform builds
- Upload artifacts for debugging

**Don't:**
- Set signing env vars for unsigned builds
- Use `npx` in environments without npm
- Assume npm registry is always available
- Run iOS builds without signing secrets

### Dependency Management

**Do:**
- Use peer dependencies to break Turbo cycles
- Mark peer dependencies as optional
- Use dev dependencies for build-time-only deps
- Keep lockfile committed and up-to-date

**Don't:**
- Create circular dependencies in package.json
- Use `dependencies` for packages that create cycles
- Modify lockfile manually

### Deployment

**Do:**
- Add health checks after deployment
- Use maintenance mode for zero-downtime deploys
- Install required system dependencies (Vulkan, etc.)
- Log deployment steps with timestamps

**Don't:**
- Deploy without health verification
- Skip maintenance mode for production
- Assume system dependencies are installed

## Monitoring

### GitHub Actions

**Check workflow status:**
```bash
gh run list --workflow=ci.yml --limit 10
gh run view <run-id> --log
```

**Re-run failed jobs:**
```bash
gh run rerun <run-id> --failed
```

### Deployment Health

**Check Vast.ai instance health:**
```bash
curl https://your-instance.vast.ai/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "maintenanceMode": false
}
```

## Related Commits

- `08aa151` - Use --frozen-lockfile in all workflows
- `7c9ff6c` - Add retry with backoff to bun install
- `8ce4819` - Resolve macOS DMG bundling, iOS unsigned, and Windows install failures
- `f19a704` - Fix Linux and Windows desktop builds + cleanup wrangler config
- `15250d2` - Split Tauri builds into unsigned/release
- `f355276` - Break cyclic dependency with procgen
- `3b9c0f2` - Fully break shared↔procgen cycle for turbo
- `05c2892` - Add procgen as devDependency for TypeScript
- `c80ad7a` - Use bunx instead of npx in build-services.mjs
- `42a1a0e` - Update wrangler.toml to use assets directive
- `30b52bd` - Add graceful deployment with maintenance mode

## Related Documentation

- [Maintenance Mode API](./maintenance-mode-api.md) - Graceful deployment system
- [Railway Deployment](./railway-dev-prod.md) - Railway-specific deployment
- [Native Release](./native-release.md) - Native app release process
- [GitHub Actions Workflows](../.github/workflows/) - Workflow source files
