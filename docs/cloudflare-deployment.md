# Cloudflare Pages Deployment

This guide covers deploying the Hyperscape web client to Cloudflare Pages with automatic builds and R2 asset hosting.

## Overview

The Cloudflare deployment consists of:
- **Client**: Static site hosted on Cloudflare Pages
- **Assets**: 3D models, textures, audio hosted on Cloudflare R2
- **CORS**: Configured for cross-origin asset loading

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Cloudflare Pages (hyperscape.gg)                         │
│  - Static HTML/CSS/JS                                    │
│  - Vite production build                                 │
│  - Connects to Railway game server via WebSocket        │
└──────────────────────────────────────────────────────────┘
                          │
                          ├─ WebSocket → wss://hyperscape-production.up.railway.app/ws
                          ├─ HTTP API → https://hyperscape-production.up.railway.app
                          └─ Assets → https://assets.hyperscape.club (R2)

┌──────────────────────────────────────────────────────────┐
│ Cloudflare R2 (assets.hyperscape.club)                   │
│  - 3D models (.glb, .gltf)                               │
│  - Textures (.png, .jpg, .ktx2)                          │
│  - Audio (.mp3, .ogg)                                    │
│  - Manifests (.json)                                     │
└──────────────────────────────────────────────────────────┘
```

## Prerequisites

### Cloudflare Account

1. Sign up at [Cloudflare](https://cloudflare.com)
2. Create a Pages project named `hyperscape`
3. Create an R2 bucket named `hyperscape-assets`

### GitHub Secrets

Configure in repository settings (`Settings → Secrets and variables → Actions`):

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | API token with Pages and R2 permissions | Cloudflare Dashboard → My Profile → API Tokens |
| `PUBLIC_PRIVY_APP_ID` | Privy app ID (optional, has default) | Privy Dashboard |

### Cloudflare API Token Permissions

Create a token with these permissions:
- **Account** → **Cloudflare Pages** → **Edit**
- **Account** → **R2** → **Edit**

## Automatic Deployment

### Workflow Trigger

The client deploys automatically on push to `main` when these paths change:
- `packages/client/**`
- `packages/shared/**` (contains packet definitions)
- `package.json`
- `bun.lockb`

### Workflow File

`.github/workflows/deploy-pages.yml`

### Build Process

1. **Checkout code** with submodules
2. **Setup Bun** (latest version)
3. **Install dependencies** (`bun install --frozen-lockfile`)
4. **Build client** (`bun run build:client`):
   - Builds `packages/shared` first (via Turbo)
   - Builds `packages/physx-js-webidl` (WASM bindings)
   - Builds `packages/client` (Vite production build)
5. **Deploy to Pages** using Wrangler:
   - Project: `hyperscape`
   - Branch: `main`
   - Commit hash and message included

### Build Environment Variables

Set during build (in workflow):

```yaml
PUBLIC_PRIVY_APP_ID: cmgk4zu56005kjj0bcaae0rei  # Default
PUBLIC_API_URL: https://hyperscape-production.up.railway.app
PUBLIC_WS_URL: wss://hyperscape-production.up.railway.app/ws
PUBLIC_CDN_URL: https://assets.hyperscape.club
PUBLIC_APP_URL: https://hyperscape.gg
```

## Manual Deployment

### From Local Machine

```bash
# Build client
bun run build:client

# Deploy to Pages
cd packages/client
npx wrangler pages deploy dist \
  --project-name=hyperscape \
  --branch=main \
  --commit-hash=$(git rev-parse HEAD) \
  --commit-message="Manual deployment"
```

### From GitHub Actions

1. Go to **Actions** → **Deploy Client to Cloudflare Pages**
2. Click **Run workflow**
3. Select `main` branch
4. Choose environment: `production` or `preview`
5. Click **Run workflow**

## R2 Asset Hosting

### Bucket Setup

1. **Create R2 bucket**:
   - Name: `hyperscape-assets`
   - Location: Automatic (Cloudflare chooses optimal location)

2. **Configure custom domain**:
   - Go to R2 bucket → Settings → Custom Domains
   - Add `assets.hyperscape.club`
   - Create DNS record as instructed by Cloudflare

3. **Configure CORS**:
   ```bash
   # Run from repository root
   bash scripts/configure-r2-cors.sh
   ```

   Or manually via Wrangler:
   ```bash
   wrangler r2 bucket cors set hyperscape-assets \
     --cors-config='{
       "allowed": {
         "origins": ["*"],
         "methods": ["GET", "HEAD"],
         "headers": ["*"]
       },
       "exposed": ["ETag"],
       "maxAge": 3600
     }'
   ```

### Upload Assets

Assets are uploaded separately (not part of client deployment):

```bash
# Upload all assets to R2
bun run scripts/sync-r2-assets.mjs
```

This uploads:
- `packages/server/world/assets/` → R2 bucket
- Preserves directory structure
- Skips unchanged files (checksum comparison)

## Custom Domains

### Primary Domain (hyperscape.gg)

1. **In Cloudflare Pages**:
   - Go to project → Settings → Custom domains
   - Add `hyperscape.gg`
   - Add `www.hyperscape.gg` (optional redirect)

2. **DNS Configuration**:
   - Cloudflare will show required DNS records
   - If using Cloudflare DNS, records are added automatically
   - If using external DNS, create CNAME records as shown

3. **SSL/TLS**:
   - Cloudflare automatically provisions SSL certificates
   - Wait for certificate status to become "Active"

### Asset Domain (assets.hyperscape.club)

1. **In R2 bucket**:
   - Go to Settings → Custom Domains
   - Add `assets.hyperscape.club`

2. **DNS Configuration**:
   - Create CNAME record: `assets.hyperscape.club` → `<bucket-id>.r2.cloudflarestorage.com`
   - Cloudflare will show the exact target

## CORS Configuration

### Why CORS is Needed

The client (hyperscape.gg) loads assets from a different origin (assets.hyperscape.club), requiring CORS headers.

### R2 CORS Configuration

The `scripts/configure-r2-cors.sh` script configures:

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

**Allowed origins**: `*` (all origins) - safe for public read-only assets

**Allowed methods**: `GET`, `HEAD` - read-only access

**Exposed headers**: `ETag` - for cache validation

**Max age**: 3600 seconds (1 hour) - browser caches CORS preflight

### Verify CORS

```bash
# Test CORS from browser origin
curl -I https://assets.hyperscape.club/models/player/human.glb \
  -H "Origin: https://hyperscape.gg"

# Should include:
# Access-Control-Allow-Origin: *
# Access-Control-Expose-Headers: ETag
```

## Environment Variables

### Build-Time Variables

Set in `.github/workflows/deploy-pages.yml`:

```yaml
PUBLIC_PRIVY_APP_ID: cmgk4zu56005kjj0bcaae0rei
PUBLIC_API_URL: https://hyperscape-production.up.railway.app
PUBLIC_WS_URL: wss://hyperscape-production.up.railway.app/ws
PUBLIC_CDN_URL: https://assets.hyperscape.club
PUBLIC_APP_URL: https://hyperscape.gg
```

These are baked into the build and cannot be changed at runtime.

### Runtime Variables

Cloudflare Pages does not support runtime environment variables for static sites. All configuration must be set at build time.

## Deployment URLs

### Production

- **Client**: https://hyperscape.gg
- **Assets**: https://assets.hyperscape.club
- **Game Server**: https://hyperscape-production.up.railway.app
- **WebSocket**: wss://hyperscape-production.up.railway.app/ws

### Preview

Each commit gets a preview URL:
- **Format**: `https://<commit-hash>.hyperscape.pages.dev`
- **Example**: `https://50f1a285aa6782ead0066d21616d98a238ea1ae3.hyperscape.pages.dev`

Preview deployments use the same build configuration as production.

## Troubleshooting

### Assets not loading (404 errors)

**Symptom**: Console errors like `Failed to load resource: https://assets.hyperscape.club/models/player/human.glb`

**Causes**:
1. Assets not uploaded to R2
2. CORS not configured
3. Custom domain not set up

**Fix**:
```bash
# 1. Upload assets
bun run scripts/sync-r2-assets.mjs

# 2. Configure CORS
bash scripts/configure-r2-cors.sh

# 3. Verify custom domain
curl -I https://assets.hyperscape.club/models/player/human.glb
```

### CORS errors

**Symptom**: Console error `Access to fetch at 'https://assets.hyperscape.club/...' from origin 'https://hyperscape.gg' has been blocked by CORS policy`

**Fix**:
```bash
# Reconfigure CORS
bash scripts/configure-r2-cors.sh

# Verify CORS headers
curl -I https://assets.hyperscape.club/models/player/human.glb \
  -H "Origin: https://hyperscape.gg"
```

### Build failures

**Symptom**: GitHub Actions workflow fails during build

**Common causes**:
1. TypeScript errors
2. Missing dependencies
3. Out of memory

**Fix**:
```bash
# Test build locally
bun run build:client

# Check for TypeScript errors
bun run typecheck

# Increase Node memory (already set in workflow)
NODE_OPTIONS='--max-old-space-size=4096' bun run build:client
```

### WebSocket connection failures

**Symptom**: Client cannot connect to game server

**Causes**:
1. `PUBLIC_WS_URL` pointing to wrong server
2. Railway server not running
3. CORS/Origin validation failing

**Fix**:
1. Verify `PUBLIC_WS_URL` in workflow matches Railway server
2. Check Railway deployment status
3. Verify server allows `hyperscape.gg` origin (see [docs/csrf-cross-origin.md](docs/csrf-cross-origin.md))

## Advanced Configuration

### Multiple Environments

To deploy to staging/preview environments:

1. **Create separate Pages project**: `hyperscape-staging`
2. **Update workflow** to deploy to different project based on branch:
   ```yaml
   - name: Deploy to Pages
     run: |
       PROJECT_NAME=${{ github.ref == 'refs/heads/main' && 'hyperscape' || 'hyperscape-staging' }}
       npx wrangler pages deploy dist --project-name=$PROJECT_NAME
   ```

### Custom Build Configuration

Edit `packages/client/vite.config.ts` to customize:
- Output directory
- Asset optimization
- Code splitting
- Source maps

### Caching Strategy

Cloudflare Pages automatically caches:
- **HTML**: No cache (always fresh)
- **JS/CSS**: Immutable (hashed filenames)
- **Assets**: Long cache (1 year)

Configure via `packages/client/public/_headers`:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

## Monitoring

### Deployment Status

Check deployment status in:
- **GitHub Actions**: Actions tab → Deploy Client to Cloudflare Pages
- **Cloudflare Dashboard**: Pages → hyperscape → Deployments

### Analytics

Cloudflare Pages provides:
- **Web Analytics**: Visitor stats, page views, bandwidth
- **Real User Monitoring**: Performance metrics, Core Web Vitals
- **Error tracking**: JavaScript errors, failed requests

Access via: Cloudflare Dashboard → Pages → hyperscape → Analytics

### Logs

View deployment logs:
- **GitHub Actions**: Click on workflow run → View logs
- **Cloudflare**: Pages → hyperscape → Deployments → View build log

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai GPU streaming deployment
- [docs/railway-dev-prod.md](docs/railway-dev-prod.md) - Railway game server deployment
- [docs/webgpu-requirements.md](docs/webgpu-requirements.md) - Browser requirements
- [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml) - Deployment workflow
- [packages/client/wrangler.toml](../packages/client/wrangler.toml) - Wrangler configuration
- [scripts/configure-r2-cors.sh](../scripts/configure-r2-cors.sh) - CORS setup script
