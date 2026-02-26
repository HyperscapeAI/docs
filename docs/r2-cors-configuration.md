# Cloudflare R2 CORS Configuration

This guide explains how to configure CORS (Cross-Origin Resource Sharing) for Cloudflare R2 buckets to enable cross-origin asset loading in Hyperscape.

## Overview

Hyperscape serves game assets (3D models, textures, audio) from Cloudflare R2 at `assets.hyperscape.club`. These assets must be accessible from multiple domains:

- `hyperscape.gg` (main game)
- `hyperscape.club` (Cloudflare Pages)
- `hyperbet.win` (betting interface)
- `hyperscape.bet` (betting interface)
- `localhost:3333` (local development)

Without proper CORS configuration, browsers block cross-origin asset requests, causing missing models, textures, and audio.

## Automatic Configuration (CI/CD)

CORS is automatically configured during Cloudflare deployments via `.github/workflows/deploy-cloudflare.yml`:

```yaml
- name: Configure R2 CORS
  run: |
    chmod +x scripts/configure-r2-cors.sh
    ./scripts/configure-r2-cors.sh
  env:
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    R2_BUCKET_NAME: hyperscape-assets
```

This runs automatically on every push to `main` that modifies client or asset files.

## Manual Configuration

If you need to configure CORS manually (e.g., for a new bucket or domain):

### Prerequisites

1. **Cloudflare API Token** with R2 permissions:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → My Profile → API Tokens
   - Create token with `R2 Edit` permissions
   - Save token securely

2. **Account ID**:
   - Found in Cloudflare Dashboard → R2 → Overview
   - Format: 32-character hex string

### Run Configuration Script

```bash
# Set environment variables
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token
export R2_BUCKET_NAME=hyperscape-assets

# Run configuration script
chmod +x scripts/configure-r2-cors.sh
./scripts/configure-r2-cors.sh
```

### CORS Configuration Details

The script applies this CORS policy to the R2 bucket:

```json
[
  {
    "AllowedOrigins": [
      "https://hyperscape.gg",
      "https://*.hyperscape.gg",
      "https://hyperscape.club",
      "https://*.hyperscape.club",
      "https://hyperbet.win",
      "https://*.hyperbet.win",
      "https://hyperscape.bet",
      "https://*.hyperscape.bet",
      "http://localhost:3333",
      "http://localhost:5555"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

**Key Settings:**
- **AllowedOrigins**: All known Hyperscape domains (apex + subdomains) plus localhost for development
- **AllowedMethods**: Read-only (GET, HEAD) - no write operations from browser
- **AllowedHeaders**: All headers allowed for flexibility
- **ExposeHeaders**: ETag and Content-Length for caching and progress tracking
- **MaxAgeSeconds**: 1 hour cache for preflight requests (reduces OPTIONS requests)

## Verification

After configuration, verify CORS is working:

```bash
# Test from command line
curl -I -H "Origin: https://hyperscape.gg" \
  https://assets.hyperscape.club/models/avatar.glb

# Should include these headers:
# access-control-allow-origin: https://hyperscape.gg
# access-control-expose-headers: ETag, Content-Length
```

**Browser Test:**
1. Open https://hyperscape.gg
2. Open browser DevTools → Network tab
3. Filter by "glb" or "png"
4. Check Response Headers for `access-control-allow-origin`
5. Verify no CORS errors in Console

## Troubleshooting

**CORS errors still appearing:**
1. Verify bucket name matches: `hyperscape-assets`
2. Check API token has R2 Edit permissions
3. Wait 1-2 minutes for CORS policy propagation
4. Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+R)

**Script fails with authentication error:**
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct (32-character hex)
- Verify `CLOUDFLARE_API_TOKEN` has R2 Edit permissions
- Check token hasn't expired

**Assets load from some domains but not others:**
- Verify all domains are in `AllowedOrigins` list
- Check for typos in domain names (e.g., `hyperscape.gg` vs `hyperscape.club`)
- Ensure both apex domain and wildcard subdomain are included

**Localhost not working:**
- Verify `http://localhost:3333` and `http://localhost:5555` are in `AllowedOrigins`
- Check you're using HTTP (not HTTPS) for localhost
- Ensure port numbers match your local development setup

## Adding New Domains

To add a new domain to CORS configuration:

1. Edit `scripts/configure-r2-cors.sh`
2. Add domain to `AllowedOrigins` array:
   ```json
   "https://newdomain.com",
   "https://*.newdomain.com",
   ```
3. Run script manually or push to trigger CI/CD
4. Verify with curl test (see Verification section)

## Security Considerations

**Read-Only Access:**
- CORS policy only allows GET and HEAD methods
- No write operations (PUT, POST, DELETE) permitted from browser
- Asset uploads must go through authenticated server endpoints

**Origin Validation:**
- Only known Hyperscape domains are allowed
- Wildcard `*` origin is NOT used (would allow any site to load assets)
- Localhost origins only for development convenience

**Cache Duration:**
- 1-hour preflight cache reduces OPTIONS requests
- Doesn't affect asset caching (controlled by Cache-Control headers)
- Safe to increase if domains rarely change

## Related Documentation

- **Deployment**: See `docs/railway-dev-prod.md` for full deployment workflow
- **Asset Management**: See `README.md` → Assets section
- **CDN Configuration**: See `packages/server/.env.example` → `PUBLIC_CDN_URL`

## Implementation

**Script**: `scripts/configure-r2-cors.sh`
**Workflow**: `.github/workflows/deploy-cloudflare.yml`
**Commit**: `143914d` (February 26, 2026)
