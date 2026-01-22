# README.md Updates for Hyperscape Repository

## Changes to Make:

### 1. Update Core Features Table

**Current:**
```markdown
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
```

**Updated:**
```markdown
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking, Agility + combat skills with XP/leveling |
```

### 2. Add Agility to Skills List

In the "Core Features" section, update the skills description to include agility as a movement-based skill that affects stamina regeneration.

### 3. Update Production Architecture Note

Add a note about the production deployment architecture:

```markdown
## Production Deployment

The official production deployment uses:
- **Frontend**: Cloudflare Pages (hyperscape.pages.dev)
- **Server**: Railway (hyperscape-production.up.railway.app)
- **Assets**: Cloudflare R2 CDN
- **Database**: Neon PostgreSQL

See [Deployment Guide](https://docs.hyperscape.club/guides/deployment) for detailed setup instructions.
```

### 4. Update Asset Handling Documentation

**Current mentions:**
- Assets auto-downloaded during `bun install` (~200MB via Git LFS)
- Production/CI: Manifests committed to repo

**Update to:**
- **Local Development**: Assets auto-downloaded during `bun install` (~200MB via Git LFS)
- **Production/CI**: Manifests fetched from CDN at server startup (configured in `nixpacks.toml`)

### 5. Add Railway Deployment Section

Add a new section after "Configuration":

```markdown
## Deployment

### Railway (Server)

The server deploys to Railway using Nixpacks:

```bash
# Automated via GitHub Actions on push to main
# Or manually trigger via Railway dashboard
```

Configuration files:
- `nixpacks.toml` - Build configuration
- `railway.server.json` - Service configuration
- `.github/workflows/deploy-railway.yml` - CI/CD workflow

### Cloudflare Pages (Client)

The client deploys to Cloudflare Pages:

```bash
# Automated on push to main
# Preview deployments for all PRs
```

See [Deployment Guide](https://docs.hyperscape.club/guides/deployment) for complete setup instructions.
```

### 6. Update Troubleshooting Section

Add CORS troubleshooting:

```markdown
**CORS errors when connecting to server:**
If deploying client and server separately, ensure your client domain is in the server's CORS allowlist:
```typescript
// packages/server/src/startup/http-server.ts
const allowedOrigins = [
  'https://your-frontend-domain.com',
  'https://*.your-preview-domain.com',  // For preview deployments
];
```
```
