# Cloudflare Pages Deployment Guide

Hyperscape's web client is deployed to Cloudflare Pages for global CDN distribution with automatic builds on every push to `main`.

## Overview

**Cloudflare Pages** hosts the static web client with:
- **URL**: https://hyperscape.gg (production)
- **Preview URLs**: `https://<commit-sha>.hyperscape.pages.dev`
- **Assets**: Served from Cloudflare R2 (https://assets.hyperscape.club)
- **Build**: Automatic via GitHub Actions on push to `main`

**Architecture:**
- **Frontend**: Cloudflare Pages (static hosting)
- **Backend**: Railway (game server)
- **Assets**: Cloudflare R2 (CDN)
- **CORS**: Configured for cross-origin requests

## Prerequisites

### 1. Cloudflare Account Setup

1. Create a Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Note your **Account ID** (found in dashboard URL or account settings)
3. Create an **API Token** with permissions:
   - Account → Cloudflare Pages → Edit
   - Zone → DNS → Edit (if using custom domain)

### 2. GitHub Secrets

Configure these secrets in your repository (`Settings` → `Secrets and variables` → `Actions`):

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | API token for Pages deployment | Cloudflare Dashboard → My Profile → API Tokens |
| `PUBLIC_PRIVY_APP_ID` | Privy app ID for authentication | [dashboard.privy.io](https://dashboard.privy.io) |

### 3. Cloudflare Pages Project

Create a Pages project in the Cloudflare dashboard:

1. Go to **Workers & Pages** → **Create application** → **Pages**
2. **Project name**: `hyperscape`
3. **Production branch**: `main`
4. **Build command**: Leave empty (GitHub Actions handles builds)
5. **Build output directory**: Leave empty

**Important**: Do NOT connect GitHub integration in Cloudflare dashboard. The GitHub Actions workflow handles deployment via `wrangler pages deploy`.

## Deployment Workflow

### Automatic Deployment

The `.github/workflows/deploy-pages.yml` workflow runs automatically on:
- Push to `main` branch
- Changes to `packages/client/**` or `packages/shared/**`

**Build Steps:**
1. Checkout code with submodules
2. Setup Bun
3. Install dependencies (`bun install --frozen-lockfile`)
4. Build client (`bun run build:client`)
5. Deploy to Cloudflare Pages (`wrangler pages deploy`)

### Manual Deployment

Trigger manually from GitHub Actions:

```bash
# Via GitHub UI
Actions → Deploy Client to Cloudflare Pages → Run workflow → main

# Via GitHub CLI
gh workflow run deploy-pages.yml
```

### Local Deployment

Deploy from your local machine:

```bash
# Build client
bun run build:client

# Deploy to Pages
cd packages/client
npx wrangler pages deploy dist \
  --project-name=hyperscape \
  --branch=main
```

## Configuration

### Environment Variables

The build injects these environment variables at build time:

```bash
# Authentication
PUBLIC_PRIVY_APP_ID=cmgk4zu56005kjj0bcaae0rei

# Backend URLs (Railway production)
PUBLIC_API_URL=https://hyperscape-production.up.railway.app
PUBLIC_WS_URL=wss://hyperscape-production.up.railway.app/ws

# Assets (Cloudflare R2)
PUBLIC_CDN_URL=https://assets.hyperscape.club

# App URL
PUBLIC_APP_URL=https://hyperscape.gg
```

**Note**: These are set in the GitHub Actions workflow, not in Cloudflare dashboard.

### Custom Domain Setup

To use `hyperscape.gg` instead of `hyperscape.pages.dev`:

1. **Add domain in Cloudflare Pages**:
   - Pages project → Custom domains → Add domain
   - Enter `hyperscape.gg`
   - Follow DNS setup instructions

2. **Configure DNS**:
   - Add CNAME record: `hyperscape.gg` → `hyperscape.pages.dev`
   - Or use Cloudflare's automatic setup

3. **SSL/TLS**:
   - Cloudflare automatically provisions SSL certificates
   - Use "Full (strict)" SSL mode for Railway backend

## CORS Configuration

### R2 Bucket CORS

The client loads assets from R2, which requires CORS configuration.

**Automated Setup:**
```bash
# Run from repository root
bash scripts/configure-r2-cors.sh
```

**Manual Setup:**
```bash
# Create cors.json
cat > cors.json << 'EOF'
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag"],
  "maxAge": 3600
}
EOF

# Apply to R2 bucket
wrangler r2 bucket cors set hyperscape-assets --cors-file cors.json
```

### Backend CORS

The Railway backend allows requests from:
- `https://hyperscape.gg`
- `https://hyperscape.club`
- `https://*.hyperscape.pages.dev`
- `https://hyperbet.win`
- `https://hyperscape.bet`

**CSRF Handling**: Apex domains (hyperscape.gg, hyperbet.win) bypass CSRF validation since cross-origin requests are already protected by Origin header validation and JWT authentication.

## Build Optimization

### Build Performance

The client build includes:
- **Turbo caching**: Reuses shared package builds
- **PhysX WASM**: Bundled via `build:client` (includes dependencies)
- **Node memory**: `--max-old-space-size=4096` for large builds

**Build Time**: ~2-3 minutes on GitHub Actions runners

### Bundle Size

The client bundle includes:
- Three.js + WebGPU renderer
- PhysX WASM (~2MB)
- React + UI libraries
- Game logic from shared package

**Total**: ~8-12MB (gzipped)

## Troubleshooting

### Build Fails with "Out of Memory"

**Symptom**: Build crashes with heap out of memory error

**Solution**: Increase Node memory in workflow:
```yaml
env:
  NODE_OPTIONS: '--max-old-space-size=8192'  # was 4096
```

### Assets Not Loading (404 Errors)

**Symptom**: Client loads but assets return 404

**Causes**:
1. R2 CORS not configured
2. Wrong `PUBLIC_CDN_URL`
3. Assets not uploaded to R2

**Solutions**:
```bash
# Check CORS
wrangler r2 bucket cors get hyperscape-assets

# Upload assets
bun run scripts/sync-r2-assets.mjs

# Verify CDN URL
curl https://assets.hyperscape.club/manifests/items/weapons.json
```

### WebSocket Connection Fails

**Symptom**: Client loads but can't connect to game server

**Causes**:
1. Wrong `PUBLIC_WS_URL`
2. Railway backend not running
3. CORS/Origin validation failing

**Solutions**:
```bash
# Test WebSocket endpoint
wscat -c wss://hyperscape-production.up.railway.app/ws

# Check Railway logs
railway logs --service hyperscape-production

# Verify origin is allowed
curl -H "Origin: https://hyperscape.gg" \
  https://hyperscape-production.up.railway.app/health
```

### Deployment Succeeds but Site Shows Old Version

**Symptom**: Deployment completes but site doesn't update

**Causes**:
1. Browser cache
2. Cloudflare edge cache
3. Service worker cache

**Solutions**:
```bash
# Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (macOS)

# Purge Cloudflare cache
Cloudflare Dashboard → Caching → Purge Everything

# Check deployment
curl -I https://hyperscape.gg
# Look for: cf-cache-status, cf-ray headers
```

### CSRF Token Errors

**Symptom**: POST requests fail with "Missing CSRF token"

**Cause**: CSRF middleware uses SameSite=Strict cookies which don't work cross-origin

**Solution**: The backend now skips CSRF validation for known cross-origin clients (hyperscape.gg, hyperbet.win). Verify your domain is in the allowed list:

```typescript
// packages/server/src/middleware/csrf.ts
const KNOWN_CROSS_ORIGIN_CLIENTS = [
  /^https:\/\/hyperscape\.gg$/,
  /^https:\/\/hyperbet\.win$/,
  /^https:\/\/.*\.hyperscape\.pages\.dev$/,
];
```

## Preview Deployments

Every commit to `main` creates a preview deployment:

**URL Format**: `https://<commit-sha>.hyperscape.pages.dev`

**Use Cases**:
- Test changes before promoting to production domain
- Share specific versions with team
- Debug deployment-specific issues

**Accessing Previews**:
```bash
# Get commit SHA
git rev-parse HEAD

# Preview URL
https://<sha>.hyperscape.pages.dev
```

## Rollback

To rollback to a previous deployment:

1. **Via Cloudflare Dashboard**:
   - Pages project → Deployments
   - Find working deployment
   - Click "Rollback to this deployment"

2. **Via Git**:
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   
   # Or reset to specific commit
   git reset --hard <commit-sha>
   git push --force origin main
   ```

## Monitoring

### Deployment Status

Check deployment status:
```bash
# Via GitHub Actions
https://github.com/HyperscapeAI/hyperscape/actions/workflows/deploy-pages.yml

# Via Cloudflare Dashboard
Workers & Pages → hyperscape → Deployments
```

### Analytics

Cloudflare Pages provides:
- **Web Analytics**: Page views, unique visitors, bandwidth
- **Real User Monitoring**: Core Web Vitals, performance metrics
- **Error Tracking**: JavaScript errors, failed requests

Access via: Cloudflare Dashboard → Pages → hyperscape → Analytics

## See Also

- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway backend deployment
- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai streaming deployment
- [packages/client/.env.example](../packages/client/.env.example) - Client environment variables
- [packages/client/wrangler.toml](../packages/client/wrangler.toml) - Wrangler configuration
