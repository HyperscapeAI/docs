# CI/CD Improvements (February 2026)

**Commits**: 7c9ff6c, 08aa151, 8ce4819, f19a704, 15250d2, a095ba1, cb57325  
**Authors**: Shaw (@lalalune)

## Summary

Comprehensive CI/CD reliability improvements addressing npm rate limiting, Tauri build platform issues, and GitHub Actions workflow configuration errors.

## Changes

### 1. npm Retry Logic with Exponential Backoff

**Problem**: npm rate-limits GitHub Actions IP ranges, causing intermittent 403 Forbidden errors.

**Solution**: Retry `bun install` up to 5 times with increasing backoff (15s, 30s, 45s, 60s, 75s).

**Implementation** (.github/workflows/ci.yml, build-app.yml):

```yaml
- name: Install dependencies with retry
  run: |
    for i in 1 2 3 4 5; do
      if bun install --frozen-lockfile; then
        echo "Install successful on attempt $i"
        exit 0
      fi
      
      if [ $i -lt 5 ]; then
        DELAY=$((i * 15))
        echo "Install failed, retrying in ${DELAY}s... (attempt $i/5)"
        sleep $DELAY
      fi
    done
    
    echo "Install failed after 5 attempts"
    exit 1
```

**Backoff Schedule**:
- Attempt 1: Immediate
- Attempt 2: 15s delay
- Attempt 3: 30s delay
- Attempt 4: 45s delay
- Attempt 5: 60s delay

**Total Max Time**: 150s (2.5 minutes)

### 2. Frozen Lockfile

**Problem**: `bun install` without `--frozen-lockfile` tries to resolve packages fresh from npm, triggering rate limits.

**Solution**: All workflows now use `--frozen-lockfile`:

```yaml
- name: Install dependencies
  run: bun install --frozen-lockfile
```

**Benefits**:
- Uses only committed lockfile (no npm resolution)
- Faster installs (no dependency resolution)
- Deterministic builds (exact versions from lockfile)
- Avoids npm rate limiting

### 3. Tauri Build Splitting

**Problem**: Tauri bundler attempts macOS code signing whenever `APPLE_CERTIFICATE` env var exists, even if empty. Non-release builds set it to `''` which caused `SecKeychainItemImport` errors.

**Solution**: Split builds into separate Unsigned and Release jobs:

**Before** (broken):
```yaml
- name: Build Desktop
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE || '' }}  # Empty string breaks
```

**After** (fixed):
```yaml
# Unsigned builds (no signing env vars)
- name: Build Desktop (Unsigned)
  if: github.event_name != 'release'
  # No APPLE_CERTIFICATE env var

# Release builds (signing env vars present)
- name: Build Desktop (Release)
  if: github.event_name == 'release'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
```

**Platforms Affected**:
- Desktop (macOS, Linux, Windows)
- iOS
- Android

### 4. macOS Unsigned Build Fix

**Problem**: `--bundles app` is macOS-only, causing Linux/Windows unsigned builds to fail.

**Solution**: Use `--no-bundle` for unsigned builds:

```yaml
# Unsigned builds (all platforms)
- name: Build Desktop (Unsigned)
  run: bun run tauri build --no-bundle

# Release builds (macOS gets DMG)
- name: Build Desktop (Release)
  run: bun run tauri build
```

**Result**:
- macOS unsigned: `.app` bundle only (no DMG)
- Linux unsigned: Binary only
- Windows unsigned: `.exe` only

### 5. iOS Build Configuration

**Problem**: Unsigned iOS builds always fail with "Signing requires a development team".

**Solution**: Make iOS build job release-only:

```yaml
- name: Build iOS
  if: github.event_name == 'release'  # Only run on releases
```

**Rationale**: iOS requires signing for all builds (even debug). No point running unsigned iOS builds - they always fail.

### 6. Windows Install Retry Logic

**Problem**: Windows runners experience transient NPM registry 403 errors during `bun install`.

**Solution**: Add retry logic specifically for Windows:

```yaml
- name: Install dependencies (Windows)
  if: matrix.platform == 'windows-latest'
  run: |
    for ($i = 1; $i -le 3; $i++) {
      bun install --frozen-lockfile
      if ($LASTEXITCODE -eq 0) {
        Write-Host "Install successful on attempt $i"
        exit 0
      }
      
      if ($i -lt 3) {
        Write-Host "Install failed, retrying in 30s... (attempt $i/3)"
        Start-Sleep -Seconds 30
      }
    }
    
    Write-Host "Install failed after 3 attempts"
    exit 1
```

**Backoff**: 30s between attempts (3 attempts total)

### 7. Artifact Upload Splitting

**Problem**: Release builds upload bundles, unsigned builds upload raw binaries - different artifact types.

**Solution**: Conditional artifact upload based on build type:

```yaml
# Release builds: Upload bundles (DMG, MSI, AppImage)
- name: Upload Release Artifacts
  if: github.event_name == 'release'
  uses: actions/upload-artifact@v4
  with:
    name: release-${{ matrix.platform }}
    path: packages/app/src-tauri/target/release/bundle/

# Unsigned builds: Upload raw binaries
- name: Upload Unsigned Artifacts
  if: github.event_name != 'release'
  uses: actions/upload-artifact@v4
  with:
    name: unsigned-${{ matrix.platform }}
    path: packages/app/src-tauri/target/release/hyperscape*
```

### 8. Matrix Job Filtering Fix

**Problem**: Job-level `if` condition cannot reference matrix variables (matrix context not available until job runs).

**Solution**: Remove invalid matrix reference from job-level condition:

```yaml
# BROKEN
jobs:
  build:
    if: matrix.platform != 'ios'  # matrix not available here
    strategy:
      matrix:
        platform: [macos, linux, windows, ios]

# FIXED
jobs:
  build:
    strategy:
      matrix:
        platform: [macos, linux, windows, ios]
    steps:
      - name: Build
        if: matrix.platform != 'ios'  # matrix available in steps
```

## Environment Variables

### New Variables

**STREAM_CAPTURE_DISABLE_WEBGPU** (boolean):
- Purpose: Force WebGL fallback for streaming
- Default: `false`
- Use: Docker/headless environments

**CDP_STALL_THRESHOLD** (number):
- Purpose: Intervals before CDP restart
- Default: `4` (120s)
- Range: 2-10

**FFMPEG_MAX_RESTART_ATTEMPTS** (number):
- Purpose: Max FFmpeg restart attempts
- Default: `8`
- Range: 5-20

**CAPTURE_RECOVERY_MAX_FAILURES** (number):
- Purpose: Max soft recovery failures before full restart
- Default: `4`
- Range: 2-10

### Updated Variables

**HEALTH_CHECK_DATABASE** (boolean):
- Purpose: Enable deep DB checks in /health endpoint
- Default: `false` (lightweight health checks)
- Use: Production monitoring

**HEALTH_CHECK_STRICT_DB** (boolean):
- Purpose: Return 503 if DB unhealthy
- Default: `false` (return 200 with degraded status)
- Use: Strict health requirements

**HEALTH_CHECK_DB_TIMEOUT_MS** (number):
- Purpose: DB health check timeout
- Default: `1500` (1.5s)
- Range: 250-5000

## Workflow Files

### .github/workflows/ci.yml

**Changes**:
- Added npm retry logic with exponential backoff
- Added `--frozen-lockfile` to all `bun install` commands
- Improved error logging

### .github/workflows/build-app.yml

**Changes**:
- Split Desktop/iOS/Android builds into Unsigned and Release variants
- Fixed macOS unsigned builds (`--no-bundle` instead of `--bundles app`)
- Made iOS build release-only
- Added Windows install retry logic
- Split artifact upload (release vs unsigned)

### .github/workflows/deploy-vast.yml

**Changes**:
- Added maintenance mode enter/exit steps
- Added health check wait loop
- Added Vulkan driver installation
- Improved logging with timestamps

## Testing

### Test npm Retry Logic

```bash
# Simulate npm failure
export BUN_INSTALL_FAIL=true

# Run install (should retry)
bun install --frozen-lockfile

# Should see retry attempts in logs
```

### Test Tauri Unsigned Build

```bash
# macOS
bun run tauri build --no-bundle
# Should produce .app bundle only (no DMG)

# Linux
bun run tauri build --no-bundle
# Should produce binary only

# Windows
bun run tauri build --no-bundle
# Should produce .exe only
```

### Test WebGL Fallback

```bash
# Start client with WebGL forced
STREAM_CAPTURE_DISABLE_WEBGPU=true bun run dev:client

# Open http://localhost:3333/?page=stream
# Check console for "Using WebGL fallback"
```

## Migration Guide

### For CI/CD Maintainers

**Update workflow files** to use new patterns:

1. **Add retry logic** to `bun install` steps
2. **Use `--frozen-lockfile`** in all workflows
3. **Split Tauri builds** into unsigned/release variants
4. **Remove matrix references** from job-level conditions

### For Developers

**No changes needed** - improvements are transparent.

**If you add new workflows**:
- Copy retry logic from `.github/workflows/ci.yml`
- Always use `--frozen-lockfile`
- Split Tauri builds if using signing

## Monitoring

### GitHub Actions Metrics

**Track**:
- npm retry frequency (should be <10% of builds)
- Build success rate (should be >95%)
- Average build time (should be <15 minutes)

**Alerts**:
- npm retry rate >20% (investigate rate limiting)
- Build success rate <90% (investigate failures)
- Build time >30 minutes (investigate performance)

### Deployment Health

**Track**:
- Deployment success rate (should be >98%)
- Maintenance mode duration (should be <5 minutes)
- Post-deploy health check time (should be <2 minutes)

## Best Practices

### Workflow Design

1. **Always use `--frozen-lockfile`** - prevents npm resolution
2. **Add retry logic** for network operations
3. **Split signing workflows** - unsigned vs release
4. **Use conditional steps** - skip unnecessary work
5. **Log timestamps** - easier debugging

### Dependency Management

1. **Commit lockfile** - ensures deterministic builds
2. **Update dependencies** in separate PRs
3. **Test locally** before pushing
4. **Monitor npm registry** status

### Secrets Management

1. **Never commit secrets** - use GitHub Secrets
2. **Rotate secrets** regularly
3. **Use minimal permissions** - least privilege
4. **Audit secret access** - review logs

## Troubleshooting

### npm 403 Errors Persist

**Symptoms**: Builds fail with 403 even after retry logic.

**Causes**:
1. GitHub Actions IP range blocked by npm
2. npm registry outage
3. Lockfile corruption

**Solutions**:
```bash
# Check npm registry status
curl https://status.npmjs.org/

# Regenerate lockfile
rm bun.lock
bun install
git add bun.lock
git commit -m "chore: regenerate lockfile"
```

### Tauri Signing Failures

**Symptoms**: Release builds fail with signing errors.

**Causes**:
1. Missing `APPLE_CERTIFICATE` secret
2. Invalid certificate password
3. Certificate expired

**Solutions**:
```bash
# Verify secrets are set
gh secret list

# Test certificate locally
security find-identity -v -p codesigning
```

### Workflow Syntax Errors

**Symptoms**: Workflow fails to parse, doesn't run.

**Causes**:
1. Invalid YAML syntax
2. Matrix reference in job-level condition
3. Missing required fields

**Solutions**:
```bash
# Validate workflow syntax
gh workflow view build-app.yml

# Check for matrix references in job-level conditions
grep -n "if:.*matrix" .github/workflows/*.yml
```

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Workflow syntax
- [Tauri Documentation](https://tauri.app/v1/guides/) - Build configuration
- [Bun Documentation](https://bun.sh/docs) - Package manager
- [npm Registry Status](https://status.npmjs.org/) - Service status
