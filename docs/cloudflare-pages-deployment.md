# Cloudflare Pages Deployment

This document describes the automated Cloudflare Pages deployment workflow for the Hyperscape client.

## Overview

As of February 2026, Hyperscape uses GitHub Actions to automatically deploy the client to Cloudflare Pages on every push to `main`. This replaces the previous GitHub integration method and provides better control over the build process.

## Workflow

### Trigger Conditions

The deployment workflow (`.github/workflows/deploy-pages.yml`) triggers on:

1. **Push to main** with changes to:
   - `packages/client/**`
   - `packages/shared/**`
   - `packages/physx-js-webidl/**`

2. **Manual trigger** via `workflow_dispatch`

### Build Process

```yaml
1. Checkout repository
2. Setup Bun runtime
3. Install dependencies
4. Build physx-js-webidl (if needed)
5. Build shared package
6. Build client package
7. Deploy to Cloudflare Pages via wrangler
```

### Deployment Targets

- **Production**: https://hyperscape.gg (main branch)
- **Preview**: https://<commit-sha>.hyperscape.pages.dev (pull requests)

## Configuration

### GitHub Secrets

Required secrets in repository settings:

```bash
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
```

### Wrangler Configuration

The client uses `wrangler.toml` for Cloudflare Pages configuration:

```toml
# packages/client/wrangler.toml
name = "hyperscape"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"
```

### Build Command

```bash
# Builds shared dependencies first, then client
bun run build:shared
bun run build:client
```

### Environment Variables

Set in Cloudflare Pages dashboard → Settings → Environment variables:

```bash
# Required
PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Production server URLs
PUBLIC_API_URL=https://hyperscape.gg
PUBLIC_WS_URL=wss://hyperscape.gg/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://hyperscape.gg
```

## Multi-Line Commit Message Handling

**Problem**: Commit messages with multiple lines broke the deployment workflow.

**Solution**: Proper escaping in GitHub Actions:

```yaml
# Escape commit message for shell
- name: Deploy to Cloudflare Pages
  env:
    COMMIT_MSG: ${{ github.event.head_commit.message }}
  run: |
    echo "Deploying: $COMMIT_MSG"
```

## Vite Plugin Node Polyfills

**Problem**: Production builds failed with "Failed to resolve module specifier" errors for `vite-plugin-node-polyfills/shims/*`.

**Solution**: Add aliases to resolve shims to actual dist files:

```typescript
// packages/client/vite.config.ts
resolve: {
  alias: {
    'vite-plugin-node-polyfills/shims/buffer': 
      'vite-plugin-node-polyfills/dist/shims/buffer.js',
    'vite-plugin-node-polyfills/shims/global': 
      'vite-plugin-node-polyfills/dist/shims/global.js',
    'vite-plugin-node-polyfills/shims/process': 
      'vite-plugin-node-polyfills/dist/shims/process.js',
  }
}
```

**Also**: Disabled `protocolImports` to avoid unresolved imports:

```typescript
nodePolyfills({
  protocolImports: false,
})
```

## Content Security Policy (CSP)

### Google Fonts Support

**Problem**: Google Fonts were blocked by CSP.

**Solution**: Updated CSP headers to allow Google Fonts:

```
# packages/client/public/_headers

/*
  Content-Security-Policy: 
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
```

### CSP Directives

Full CSP configuration:

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' wss: https:;
worker-src 'self' blob:;
```

## R2 CORS Configuration

**Problem**: Assets loaded from R2 (assets.hyperscape.club) were blocked by CORS.

**Solution**: Automated CORS configuration via workflow and script.

### Workflow Integration

```yaml
# .github/workflows/deploy-cloudflare.yml
- name: Configure R2 CORS
  run: bash scripts/configure-r2-cors.sh
```

### CORS Configuration

```json
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag"],
  "maxAge": 3600
}
```

### Manual Configuration

```bash
# Run script manually
bash scripts/configure-r2-cors.sh

# Or use wrangler directly
wrangler r2 bucket cors set hyperscape-assets \
  --config scripts/r2-cors.json
```

## Deployment Verification

### Check Deployment Status

```bash
# GitHub Actions
# Visit: https://github.com/HyperscapeAI/hyperscape/actions

# Cloudflare Pages dashboard
# Visit: https://dash.cloudflare.com/pages
```

### Test Deployment

```bash
# Production
curl -I https://hyperscape.gg

# Preview (replace with actual commit SHA)
curl -I https://abc123.hyperscape.pages.dev
```

### Verify Assets

```bash
# Check CDN assets load
curl -I https://assets.hyperscape.club/models/player.glb

# Check CORS headers
curl -I https://assets.hyperscape.club/models/player.glb \
  -H "Origin: https://hyperscape.gg"
```

## Troubleshooting

### Deployment Fails

**Check**:
1. GitHub secrets are set correctly
2. Cloudflare API token has Pages permissions
3. Build completes successfully

**Fix**:
```bash
# Test build locally
cd packages/client
bun run build

# Check for errors
echo $?  # Should be 0
```

### Assets Not Loading

**Check**:
1. R2 CORS is configured
2. CDN URL is correct in environment variables
3. Assets exist in R2 bucket

**Fix**:
```bash
# Reconfigure CORS
bash scripts/configure-r2-cors.sh

# Verify CORS
curl -I https://assets.hyperscape.club/models/player.glb \
  -H "Origin: https://hyperscape.gg" \
  | grep -i "access-control"
```

### CSP Violations

**Check**:
1. Browser console for CSP errors
2. `_headers` file is deployed
3. CSP directives are correct

**Fix**:
```bash
# Update CSP in packages/client/public/_headers
# Redeploy
git commit -am "fix: update CSP"
git push origin main
```

### Module Resolution Errors

**Check**:
1. Vite aliases are configured
2. Node polyfills are installed
3. Build output includes all dependencies

**Fix**:
```bash
# Verify aliases in vite.config.ts
# Rebuild
bun run build:client
```

## Performance

### Build Time

| Stage | Duration |
|-------|----------|
| Checkout | ~10s |
| Install dependencies | ~30s |
| Build physx-js-webidl | ~0s (cached) |
| Build shared | ~20s |
| Build client | ~40s |
| Deploy to Pages | ~20s |
| **Total** | **~2 minutes** |

### Cache Optimization

- **Bun cache**: Dependencies cached between runs
- **Turbo cache**: Build outputs cached
- **PhysX**: Pre-built, skipped if unchanged

## Best Practices

### 1. Test Locally First

Always test builds locally before pushing:

```bash
bun run build
cd packages/client/dist
python3 -m http.server 8000
# Visit http://localhost:8000
```

### 2. Use Preview Deployments

Preview deployments are created for pull requests:

```bash
# PR #123 creates:
https://pr-123.hyperscape.pages.dev
```

### 3. Monitor Build Logs

Check GitHub Actions logs for warnings:

```bash
# Visit: https://github.com/HyperscapeAI/hyperscape/actions
# Click on latest "Deploy to Cloudflare Pages" workflow
```

### 4. Verify CSP

Test CSP doesn't block required resources:

```bash
# Open browser console
# Check for CSP violations
# Update _headers if needed
```

## Related Documentation

- [docs/streaming-configuration.md](streaming-configuration.md) - RTMP streaming
- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway deployment
- [packages/client/.env.example](../packages/client/.env.example) - Client configuration
- [packages/client/wrangler.toml](../packages/client/wrangler.toml) - Wrangler config

## References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
