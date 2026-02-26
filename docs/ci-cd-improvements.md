# CI/CD Improvements (February 2026)

This document summarizes recent CI/CD improvements and fixes applied to the Hyperscape build and deployment pipelines.

## Overview

Recent commits have significantly improved CI/CD reliability, security, and deployment workflows across multiple platforms.

## GitHub Actions Improvements

### Retry Logic for npm Install

**Commit**: `f19a7042` (fix(ci): fix Linux and Windows desktop builds + cleanup wrangler config)

**Problem**: GitHub Actions hitting npm rate limits causing build failures.

**Solution**: Added retry logic with exponential backoff:

```yaml
- name: Install dependencies with retry
  run: |
    for i in 1 2 3 4 5; do
      bun install --frozen-lockfile && break
      DELAY=$((15 * i))
      echo "Install failed, retrying in ${DELAY}s..."
      sleep $DELAY
    done
```

**Retry delays**: 15s, 30s, 45s, 60s, 75s

**Impact**: Eliminates transient npm registry failures.

### Frozen Lockfile

**Commit**: Multiple commits enforcing `--frozen-lockfile`

**Change**: All CI workflows now use `bun install --frozen-lockfile`

**Benefits**:
- Prevents dependency drift
- Ensures reproducible builds
- Fails fast on lockfile mismatches

### Desktop Build Fixes

**Commit**: `f19a7042` (fix(ci): fix Linux and Windows desktop builds in CI)

**Problem**: Linux/Windows builds failing with "app bundle type is macOS-only"

**Solution**:
- Use `--no-bundle` for unsigned builds (Linux/Windows)
- Use `--bundles app` only for macOS
- Split artifact upload: release builds vs unsigned builds

**Cross-platform beforeBuildCommand**:
```json
{
  "beforeBuildCommand": "node -e \"process.exit(require('fs').existsSync('dist') ? 0 : 1)\" || bun run build:client"
}
```

## Deployment Workflows

### Cloudflare Pages Deployment

**Commit**: `37c3629` (ci: add GitHub Actions workflow for Cloudflare Pages deployment)

**New workflow**: `.github/workflows/deploy-pages.yml`

**Features**:
- Automatic deployment on push to `main`
- Triggers on changes to `packages/client/**` or `packages/shared/**`
- Uses `wrangler pages deploy` instead of GitHub integration
- Includes proper build steps (shared → physx → client)

**Build command**:
```bash
bun run build:client  # Builds shared + physx dependencies via turbo
```

### Vast.ai Deployment

**Commit**: `30b52bd` (feat(deploy): add graceful deployment with maintenance mode)

**New features**:
- Maintenance mode API for safe deployments
- Wait for active markets to resolve
- Health checking before exit
- DATABASE_URL persistence through git reset

**Workflow steps**:
1. Enter maintenance mode
2. Wait for `safeToDeploy: true`
3. Deploy via SSH
4. Wait for health check
5. Exit maintenance mode

**Commit**: `b1f41d5` (feat(deploy): add workflow_dispatch for manual Vast.ai deployments)

**Manual trigger**: Added `workflow_dispatch` for on-demand deployments.

### Railway Deployment

**Existing**: Branch-based deployment (`main` → `prod`, `develop` → `dev`)

**No changes** in recent commits.

## Secret Management

### GitHub Secrets

**Commit**: `7ee730d` (fix(deploy): pass correct stream keys through CI/CD to Vast.ai)

**New secrets**:
- `TWITCH_STREAM_KEY`
- `X_STREAM_KEY`
- `X_RTMP_URL`
- `SOLANA_DEPLOYER_PRIVATE_KEY`

**Passing to deployment**:
```yaml
envs: DATABASE_URL,SOLANA_DEPLOYER_PRIVATE_KEY,TWITCH_STREAM_KEY,X_STREAM_KEY,X_RTMP_URL
```

### Environment Variable Persistence

**Commit**: `eec04b0` (fix(deploy): preserve DATABASE_URL after git reset operations)

**Problem**: `git reset --hard` was overwriting `.env` file with environment variables.

**Solution**: Write environment variables AFTER git reset:

```bash
# Workflow writes to .env AFTER git reset
git reset --hard origin/main
echo "DATABASE_URL=$DATABASE_URL" > packages/server/.env

# Deploy script also restores DATABASE_URL after its git reset
```

### Solana Keypair Setup

**Commit**: `8a677dc` (fix(solana): setup keypair from env var, remove hardcoded secrets)

**Changes**:
- Added `scripts/decode-key.ts` to decode base58 keypair
- Writes to `~/.config/solana/id.json`
- Removed hardcoded private keys from `ecosystem.config.cjs`
- Added `deployer-keypair.json` to `.gitignore`

**Usage**:
```bash
# Set in GitHub Secrets
SOLANA_DEPLOYER_PRIVATE_KEY=5JB9hqEzKqCiptLSBi4fHCVPJVb3gpb3AgRyHcJvc4u4...

# Deploy script decodes and writes to ~/.config/solana/id.json
bun run scripts/decode-key.ts
```

## Build Improvements

### Asset-Forge ESLint Fixes

**Commit**: `b5c762c` (fix(asset-forge): disable crashing import/order rule from root config)

**Problem**: `eslint-plugin-import@2.32.0` incompatible with ESLint 10.

**Solution**: Disable `import/order` rule in `packages/asset-forge/eslint.config.mjs`.

**Commit**: `cadd3d5` (fix(asset-forge): fix ESLint crash from deprecated --ext flag)

**Problem**: `eslint . --ext .ts,.tsx` uses deprecated `--ext` flag.

**Solution**: Use `eslint src` instead (matches other packages).

### Type Safety Improvements

**Commit**: `d9113595` (fix(types): eliminate explicit any types in core game logic)

**Changes**:
- `tile-movement.ts`: Removed 13 `any` casts by properly typing BuildingCollisionService
- `proxy-routes.ts`: Replaced `any` with proper types (unknown, Buffer | string, Error)
- `ClientGraphics.ts`: Added cast for setupGPUCompute after WebGPU verification

**Impact**: Reduced explicit `any` types from 142 to ~46.

### Circular Dependency Fixes

**Commit**: `3b9c0f2` (fix(deps): fully break shared↔procgen cycle for turbo)

**Problem**: Turbo treats peerDependencies as graph edges, creating circular dependency.

**Solution**: Remove cross-references from both `package.json` files. Imports still resolve via bun workspace resolution.

**Commit**: `05c2892` (fix(shared): add procgen as devDependency for TypeScript type resolution)

**Solution**: Add procgen as devDependency (not followed by turbo's ^build ordering).

## Security Improvements

### JWT Secret Enforcement

**Commit**: `3bc59db` (fix(audit): address critical issues from code audit)

**Change**: JWT_SECRET now required in production/staging.

**Behavior**:
- **Production/Staging**: Throws error if JWT_SECRET not set
- **Development**: Warns if JWT_SECRET not set
- **Unknown environments**: Warns

**Code**:
```typescript
if ((NODE_ENV === 'production' || NODE_ENV === 'staging') && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production/staging');
}
```

### CSRF Cross-Origin Handling

**Commit**: `cd29a76` (fix(csrf): skip CSRF validation for known cross-origin clients)

**Problem**: CSRF middleware uses SameSite=Strict cookies which cannot be sent in cross-origin requests (Cloudflare Pages → Railway).

**Solution**: Skip CSRF validation for known cross-origin clients:
- hyperscape.gg
- hyperscape.club
- hyperbet.win
- hyperscape.bet

**Rationale**: Cross-origin requests already protected by:
1. Origin header validation
2. JWT bearer token authentication

### Solana Keypair Security

**Commit**: `8a677dce` (fix(solana): setup keypair from env var, remove hardcoded secrets)

**Changes**:
- Removed hardcoded private keys from `ecosystem.config.cjs`
- Added `deployer-keypair.json` to `.gitignore`
- Setup keypair from `SOLANA_DEPLOYER_PRIVATE_KEY` env var

## Error Handling

### Memory Leak Fixes

**Commit**: `3bc59db` (fix(audit): address critical issues from code audit)

**Problem**: InventoryInteractionSystem had 9 event listeners that were never removed.

**Solution**: Use AbortController for proper cleanup:

```typescript
const abortController = new AbortController();

world.on('inventory:add', handler, { signal: abortController.signal });

// Cleanup
abortController.abort();
```

### WebGPU Enforcement

**Commit**: `3bc59db` (fix(audit): address critical issues from code audit)

**Change**: Added user-friendly error screen when WebGPU unavailable.

**Rationale**: All shaders use TSL which requires WebGPU. No WebGL fallback possible.

## Workflow Optimizations

### Concurrency Control

All workflows now use concurrency groups to prevent duplicate runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Impact**: Saves CI minutes by canceling outdated runs.

### Conditional Execution

**Commit**: `674cb11` (fix(ci): use env vars instead of secrets in workflow conditions)

**Problem**: GitHub Actions doesn't allow accessing secrets in `if` conditions.

**Solution**: Move secret checks inside run blocks using environment variables:

```yaml
# Before (doesn't work)
if: ${{ secrets.VAST_SERVER_URL != '' }}

# After (works)
- name: Enter Maintenance Mode
  env:
    VAST_SERVER_URL: ${{ secrets.VAST_SERVER_URL }}
  run: |
    if [ -z "$VAST_SERVER_URL" ]; then
      echo "Skipping - secret not configured"
      exit 0
    fi
    # ... actual work
```

### Branch Checkout

**Commit**: `b9a7c3b` (fix(ci): explicitly checkout main before running deploy script)

**Problem**: Deploy script was stuck on old branch because it kept pulling from that branch.

**Solution**: Explicitly fetch and checkout `main` before running deploy script:

```yaml
- name: SSH and Deploy
  script: |
    git fetch origin
    git checkout main
    git reset --hard origin/main
    bash scripts/deploy-vast.sh
```

## Testing Improvements

### Playwright Configuration

**No recent changes** - existing Playwright setup remains stable.

### Visual Testing

**No recent changes** - screenshot-based testing continues to work well.

## Future Improvements

### Planned

- [ ] Parallel builds for faster CI
- [ ] Caching for node_modules and build artifacts
- [ ] Separate test/build/deploy workflows
- [ ] Preview deployments for PRs

### Under Consideration

- [ ] Docker-based CI for consistency
- [ ] Self-hosted runners for GPU tests
- [ ] Automated performance benchmarks
- [ ] Deployment rollback automation

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai deployment
- [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md) - Cloudflare Pages deployment
- [docs/maintenance-mode-api.md](docs/maintenance-mode-api.md) - Maintenance mode API
- [.github/workflows/](../.github/workflows/) - All workflow files
