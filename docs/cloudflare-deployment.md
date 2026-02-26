# Cloudflare Pages Deployment

This guide covers deploying the Hyperscape client to Cloudflare Pages.

## Overview

Cloudflare Pages provides:
- **Global CDN**: Fast content delivery worldwide
- **Automatic builds**: Deploy on push to `main`
- **Preview deployments**: Test changes before production
- **Custom domains**: Use your own domain (e.g., hyperscape.gg)
- **Free tier**: Generous limits for most projects

## Prerequisites

1. **Cloudflare account**: [dash.cloudflare.com](https://dash.cloudflare.com)
2. **GitHub repository**: HyperscapeAI/hyperscape
3. **Cloudflare API token**: For CI/CD deployment

## Automatic Deployment (CI/CD)

The GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) automatically deploys on push to `main`.

### Workflow Configuration

**Triggers:**
- Push to `main` branch
- Changes to `packages/client/**` or `packages/shared/**`
- Manual trigger via `workflow_dispatch`

**Build steps:**
1. Checkout code
2. Setup Bun
3. Install dependencies
4. Build client (includes shared + physx)
5. Deploy to Cloudflare Pages

### Required GitHub Secrets

Configure in repository settings (Settings → Secrets and variables → Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | `your-api-token` |
| `PUBLIC_PRIVY_APP_ID` | Privy app ID | `cmgk4zu56005kjj0bcaae0rei` |

**Optional secrets:**
- `PUBLIC_API_URL` - Game server URL (default: Railway production)
- `PUBLIC_WS_URL` - WebSocket URL (default: Railway production)
- `PUBLIC_CDN_URL` - Asset CDN URL (default: R2)

### Deployment URLs

**Production:**
- https://hyperscape.gg (custom domain)
- https://hyperscape.pages.dev (Cloudflare subdomain)

**Preview:**
- https://\<commit-hash\>.hyperscape.pages.dev

## Manual Deployment

### 1. Install Wrangler

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Build Client

```bash
# From repository root
bun install
bun run build:client
```

### 3. Deploy

```bash
cd packages/client

# Deploy to production
npx wrangler pages deploy dist \
  --project-name=hyperscape \
  --branch=main

# Deploy to preview
npx wrangler pages deploy dist \
  --project-name=hyperscape \
  --branch=preview
```

## Configuration

### Environment Variables

Set in Cloudflare Dashboard (Pages → Settings → Environment variables):

**Production:**
```bash
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=https://hyperscape-production.up.railway.app
PUBLIC_WS_URL=wss://hyperscape-production.up.railway.app/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://hyperscape.gg
```

**Preview:**
```bash
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=https://hyperscape-dev.up.railway.app
PUBLIC_WS_URL=wss://hyperscape-dev.up.railway.app/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://preview.hyperscape.gg
```

### Build Configuration

The build is configured in `packages/client/wrangler.toml`:

```toml
name = "hyperscape"
compatibility_date = "2024-01-01"

[assets]
directory = "dist"
```

### Custom Domain

**Add custom domain:**
1. Cloudflare Dashboard → Pages → hyperscape
2. Custom domains → Set up a custom domain
3. Enter domain: `hyperscape.gg`
4. Follow DNS setup instructions

**DNS configuration:**
```
CNAME hyperscape.gg hyperscape.pages.dev
```

## Asset CDN (R2)

Hyperscape uses Cloudflare R2 for asset storage.

### Setup R2 Bucket

```bash
# Create bucket
wrangler r2 bucket create hyperscape-assets

# Configure CORS
bash scripts/configure-r2-cors.sh
```

### CORS Configuration

The CORS configuration allows cross-origin asset loading:

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

**Apply CORS:**
```bash
cd scripts
bash configure-r2-cors.sh
```

### Upload Assets

```bash
# Upload all assets
wrangler r2 object put hyperscape-assets/models/player.glb \
  --file=packages/server/world/assets/models/player.glb

# Upload directory
wrangler r2 object put hyperscape-assets/models/ \
  --file=packages/server/world/assets/models/ \
  --recursive
```

### Custom Domain for R2

**Setup:**
1. R2 → hyperscape-assets → Settings → Public access
2. Enable public access
3. Add custom domain: `assets.hyperscape.club`

**DNS configuration:**
```
CNAME assets.hyperscape.club hyperscape-assets.r2.cloudflarestorage.com
```

## Troubleshooting

### Build Fails

**Check build logs:**
```bash
# View in GitHub Actions
# Repository → Actions → Deploy Client to Cloudflare Pages

# Or deploy manually to see errors
cd packages/client
bun run build
```

**Common issues:**
- Missing dependencies: `bun install`
- TypeScript errors: `bun run lint`
- Out of memory: Increase `NODE_OPTIONS=--max-old-space-size=4096`

### Assets Not Loading

**Check CDN URL:**
```bash
# Verify PUBLIC_CDN_URL is set
echo $PUBLIC_CDN_URL

# Test asset loading
curl https://assets.hyperscape.club/models/player.glb
```

**Check CORS:**
```bash
# Test CORS headers
curl -I -H "Origin: https://hyperscape.gg" \
  https://assets.hyperscape.club/models/player.glb
```

**Reconfigure CORS:**
```bash
bash scripts/configure-r2-cors.sh
```

### WebSocket Connection Fails

**Check WS URL:**
```bash
# Verify PUBLIC_WS_URL is set
echo $PUBLIC_WS_URL

# Test WebSocket connection
wscat -c wss://hyperscape-production.up.railway.app/ws
```

**Check CORS:**
- Ensure server allows origin: `https://hyperscape.gg`
- Check `packages/server/src/http-server.ts` CORS config

### Custom Domain Not Working

**Check DNS:**
```bash
# Verify CNAME record
dig hyperscape.gg CNAME

# Check DNS propagation
nslookup hyperscape.gg
```

**Check SSL:**
- Cloudflare automatically provisions SSL certificates
- Wait 5-10 minutes for certificate issuance
- Check Pages → Custom domains → SSL status

### Preview Deployment Not Working

**Check branch:**
- Preview deployments use commit hash, not branch name
- URL format: `https://<commit-hash>.hyperscape.pages.dev`

**Check build:**
- Preview builds use same configuration as production
- Check GitHub Actions logs for errors

## Performance Optimization

### Build Optimization

**Enable minification:**
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
});
```

**Code splitting:**
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react': ['react', 'react-dom'],
        },
      },
    },
  },
});
```

### Caching

**Configure cache headers:**
```toml
# wrangler.toml
[[headers]]
for = "/*"
[headers.values]
Cache-Control = "public, max-age=3600"

[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
```

### Compression

Cloudflare automatically compresses responses:
- Brotli compression for modern browsers
- Gzip fallback for older browsers
- No configuration needed

## Monitoring

### Analytics

**View in Cloudflare Dashboard:**
1. Pages → hyperscape → Analytics
2. View requests, bandwidth, errors

**Metrics:**
- Requests per second
- Bandwidth usage
- Error rate
- Geographic distribution

### Logs

**Real-time logs:**
```bash
wrangler pages deployment tail
```

**View in dashboard:**
1. Pages → hyperscape → Deployments
2. Click deployment → View logs

### Alerts

**Setup alerts:**
1. Cloudflare Dashboard → Notifications
2. Create notification → Pages deployment
3. Configure alert conditions

## Cost Optimization

### Free Tier Limits

Cloudflare Pages free tier includes:
- **Builds**: 500 builds/month
- **Bandwidth**: Unlimited
- **Requests**: Unlimited
- **Storage**: 20,000 files

### Paid Tier

If you exceed free tier:
- **Builds**: $0.50 per 500 builds
- **Storage**: $0.50 per 1,000 files

### Optimization Tips

1. **Reduce build frequency**: Only build on `main` branch
2. **Use preview deployments sparingly**: Disable for draft PRs
3. **Optimize assets**: Compress images, minify code
4. **Use R2 for large files**: Cheaper than Pages storage

## See Also

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Railway Deployment Guide](railway-dev-prod.md)
- [Vast.ai Deployment Guide](vast-deployment.md)
