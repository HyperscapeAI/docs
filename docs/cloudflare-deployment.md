# Cloudflare Pages Deployment

Hyperscape's web client is deployed to Cloudflare Pages with assets served from Cloudflare R2.

## Architecture

- **Frontend**: Cloudflare Pages (hyperscape.gg)
- **Game Server**: Railway (api.hyperscape.gg)
- **Assets/CDN**: Cloudflare R2 (assets.hyperscape.club)

## Automatic Deployment

Pushes to `main` branch trigger automatic deployment via `.github/workflows/deploy-cloudflare.yml`.

## Cloudflare Pages Setup

### 1. Create Pages Project

1. Go to **Workers & Pages** → **Create application** → **Pages**
2. Connect to GitHub repository: `HyperscapeAI/hyperscape`
3. Configure build settings:
   - **Build command**: Leave empty (GitHub Actions handles build)
   - **Build output directory**: `packages/client/dist`
   - **Root directory**: `/`

### 2. Configure Environment Variables

In **Pages → Settings → Environment variables**, set:

```bash
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PUBLIC_API_URL=https://api.hyperscape.gg
PUBLIC_WS_URL=wss://api.hyperscape.gg/ws
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_APP_URL=https://hyperscape.gg
```

### 3. Configure Custom Domain

1. Go to **Pages → Custom domains**
2. Add `hyperscape.gg`
3. Add DNS records at your provider:
   - `CNAME hyperscape.gg → your-pages-project.pages.dev`
4. Wait for SSL certificate provisioning

## Cloudflare R2 Setup (Assets)

### 1. Create R2 Bucket

1. Go to **R2** → **Create bucket**
2. Name: `hyperscape-assets`
3. Location: Automatic

### 2. Configure Custom Domain

1. Go to bucket **Settings** → **Public access**
2. Add custom domain: `assets.hyperscape.club`
3. Add DNS record:
   - `CNAME assets.hyperscape.club → <bucket-url>`

### 3. Configure CORS

R2 buckets need CORS configuration to serve assets to the game client:

```bash
# Run from repository root
bash scripts/configure-r2-cors.sh
```

Or manually via Wrangler:

```bash
cd packages/client
bunx wrangler r2 bucket cors set hyperscape-assets --config cors-config.json
```

**cors-config.json:**
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

### 4. Upload Assets

```bash
# From repository root
bun run assets:upload
```

This uploads all assets from `packages/server/world/assets/` to R2.

## CSRF and Cross-Origin Requests

Hyperscape uses CSRF protection with SameSite=Strict cookies. Cross-origin requests from Cloudflare Pages to Railway backend are protected by:

1. **Origin header validation** - Checks request origin against allowed domains
2. **JWT bearer tokens** - Authorization header authentication
3. **CSRF skip for known origins** - Apex domains (hyperscape.gg, hyperbet.win) bypass CSRF cookie validation

### Allowed Origins

The server automatically allows cross-origin requests from:
- `*.hyperscape.gg` (all subdomains)
- `hyperscape.gg` (apex domain)
- `*.hyperbet.win` (all subdomains)
- `hyperbet.win` (apex domain)
- `*.hyperscape.bet` (all subdomains)
- `hyperscape.bet` (apex domain)
- `localhost:*` (development)

## Troubleshooting

### "Missing CSRF token" errors

**Cause:** CSRF middleware rejecting cross-origin POST/PUT/DELETE requests.

**Solution:** Verify your domain is in the allowed origins list in `packages/server/src/middleware/csrf.ts`.

### Assets not loading (CORS errors)

**Cause:** R2 bucket CORS not configured.

**Solution:**
```bash
bash scripts/configure-r2-cors.sh
```

### Build failures in Pages

**Cause:** Pages trying to build instead of using pre-built artifacts from GitHub Actions.

**Solution:** Ensure **Build command** is empty in Pages settings. GitHub Actions handles the build.

### Environment variables not updating

**Cause:** Pages caches environment variables.

**Solution:**
1. Update variables in Pages dashboard
2. Trigger a new deployment (push to main or manual redeploy)

## Manual Deployment

If automatic deployment fails, deploy manually:

```bash
# Build locally
cd packages/client
bun run build

# Deploy to Pages
bunx wrangler pages deploy dist --project-name=hyperscape
```

## Related Documentation

- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway server deployment
- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai GPU streaming
- [packages/client/wrangler.toml](../packages/client/wrangler.toml) - Wrangler configuration
