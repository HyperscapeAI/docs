# Cloudflare R2 CORS Configuration

Hyperscape serves game assets (3D models, textures, audio) from Cloudflare R2 at `assets.hyperscape.club`. Cross-origin asset loading requires proper CORS configuration.

## Problem

Without CORS configuration, browsers block asset loading from R2 with errors like:

```
Access to fetch at 'https://assets.hyperscape.club/models/tree.glb' from origin 'https://hyperscape.gg' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution

Configure R2 bucket CORS to allow cross-origin requests from all Hyperscape domains.

## Automatic Configuration (CI/CD)

The `.github/workflows/deploy-cloudflare.yml` workflow automatically configures CORS during deployment:

```yaml
- name: Configure R2 CORS
  run: bash scripts/configure-r2-cors.sh
  env:
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    R2_BUCKET_NAME: hyperscape-assets
```

## Manual Configuration

If you need to configure CORS manually:

### Using Wrangler CLI

```bash
# Set CORS configuration
bunx wrangler r2 bucket cors set hyperscape-assets \
  --config scripts/r2-cors-config.json
```

### CORS Configuration File

The `scripts/r2-cors-config.json` file contains:

```json
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag", "Content-Length", "Content-Type"],
  "maxAge": 3600
}
```

**Configuration Details:**

| Field | Value | Description |
|-------|-------|-------------|
| `allowed.origins` | `["*"]` | Allow requests from any origin |
| `allowed.methods` | `["GET", "HEAD"]` | Allow GET and HEAD requests (read-only) |
| `allowed.headers` | `["*"]` | Allow all request headers |
| `exposed` | `["ETag", "Content-Length", "Content-Type"]` | Headers exposed to JavaScript |
| `maxAge` | `3600` | Cache preflight responses for 1 hour |

### Using Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **hyperscape-assets** bucket
3. Go to **Settings** → **CORS Policy**
4. Add CORS rule:
   - **Allowed Origins**: `*`
   - **Allowed Methods**: `GET`, `HEAD`
   - **Allowed Headers**: `*`
   - **Exposed Headers**: `ETag`, `Content-Length`, `Content-Type`
   - **Max Age**: `3600`
5. Click **Save**

## Verification

Test CORS configuration:

```bash
# Test from command line
curl -I -H "Origin: https://hyperscape.gg" \
  https://assets.hyperscape.club/models/test.glb

# Should include headers:
# Access-Control-Allow-Origin: *
# Access-Control-Expose-Headers: ETag, Content-Length, Content-Type
```

Or test in browser console:

```javascript
fetch('https://assets.hyperscape.club/models/test.glb', {
  method: 'HEAD',
  headers: { 'Origin': 'https://hyperscape.gg' }
})
.then(r => console.log('CORS OK:', r.headers.get('access-control-allow-origin')))
.catch(e => console.error('CORS Error:', e));
```

## Allowed Domains

The CORS configuration allows requests from:

- `hyperscape.gg` (production frontend)
- `*.hyperscape.gg` (subdomains)
- `hyperbet.win` (betting frontend)
- `*.hyperbet.win` (subdomains)
- `hyperscape.bet` (alternative domain)
- `*.hyperscape.bet` (subdomains)
- `localhost:*` (local development)
- Any other origin (wildcard `*`)

## Security Considerations

### Why Wildcard Origin?

R2 assets are **public read-only** resources (3D models, textures, audio). There's no security risk in allowing cross-origin access from any domain because:

1. **No authentication required** - Assets are publicly accessible
2. **Read-only access** - Only GET/HEAD methods allowed (no PUT/POST/DELETE)
3. **No sensitive data** - Assets are game content, not user data

### Alternative: Restricted Origins

If you want to restrict origins to specific domains:

```json
{
  "allowed": {
    "origins": [
      "https://hyperscape.gg",
      "https://hyperbet.win",
      "https://hyperscape.bet",
      "http://localhost:3333"
    ],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag", "Content-Length", "Content-Type"],
  "maxAge": 3600
}
```

**Trade-offs:**
- ✅ More restrictive (only listed domains can load assets)
- ❌ Requires updating config when adding new domains
- ❌ Breaks local development on non-standard ports

## Troubleshooting

### CORS Errors Persist After Configuration

**Cause**: Browser cached old CORS preflight responses

**Solution**: Hard refresh (Ctrl+Shift+R) or clear browser cache

### Wrangler CORS Command Fails

**Symptoms**: `wrangler r2 bucket cors set` returns error

**Common Issues:**

1. **Invalid JSON format**:
   ```bash
   # Verify JSON is valid
   cat scripts/r2-cors-config.json | jq .
   ```

2. **Missing authentication**:
   ```bash
   # Set Cloudflare credentials
   export CLOUDFLARE_ACCOUNT_ID=your-account-id
   export CLOUDFLARE_API_TOKEN=your-api-token
   ```

3. **Bucket doesn't exist**:
   ```bash
   # List buckets
   bunx wrangler r2 bucket list
   
   # Create bucket if needed
   bunx wrangler r2 bucket create hyperscape-assets
   ```

### Assets Still Not Loading

**Symptoms**: 404 errors or CORS errors persist

**Checklist:**

1. **Verify CORS is configured**:
   ```bash
   bunx wrangler r2 bucket cors get hyperscape-assets
   ```

2. **Check asset exists in R2**:
   ```bash
   bunx wrangler r2 object get hyperscape-assets/models/test.glb
   ```

3. **Verify CDN URL is correct**:
   - Client `.env`: `PUBLIC_CDN_URL=https://assets.hyperscape.club`
   - Server `.env`: `PUBLIC_CDN_URL=https://assets.hyperscape.club`

4. **Check R2 custom domain**:
   - R2 bucket → Settings → Custom Domains
   - Verify `assets.hyperscape.club` is connected

## Related Documentation

- [Cloudflare Deployment](./cloudflare-deployment.md) - Full Cloudflare Pages deployment guide
- [Vast.ai Deployment](./vast-deployment.md) - GPU streaming deployment
- [README.md](../README.md) - Quick start guide

## Implementation Details

### CORS Configuration Script

The `scripts/configure-r2-cors.sh` script:

1. Reads CORS config from `scripts/r2-cors-config.json`
2. Uses Wrangler CLI to apply configuration
3. Verifies configuration was applied successfully

**Script Location**: `scripts/configure-r2-cors.sh`

**CORS Config**: `scripts/r2-cors-config.json`

### Wrangler API Format

The correct Wrangler R2 CORS API format (as of February 2026):

```json
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag", "Content-Length", "Content-Type"],
  "maxAge": 3600
}
```

**Previous format** (deprecated):
```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

The new format uses:
- Nested `allowed.origins/methods/headers` structure
- `exposed` array (not `ExposeHeaders`)
- `maxAge` integer (not `MaxAgeSeconds`)

**Fix Commit**: `055779a` (February 26, 2026)
