# CLAUDE.md Updates for Hyperscape Repository

## Changes to Make:

### 1. Update Project Overview

**Add to the skills list:**
```markdown
Hyperscape features 12 skills including combat (Attack, Strength, Defense, Constitution, Prayer), gathering (Woodcutting, Mining, Fishing, Agility), and artisan (Firemaking, Cooking, Smithing) skills.
```

### 2. Add Railway Deployment Section

Add a new section after "Environment Variables":

```markdown
## Deployment

### Railway (Production Server)

The game server deploys to Railway using Nixpacks for building:

**Configuration Files:**
- `nixpacks.toml` - Nixpacks build configuration
- `railway.server.json` - Railway service configuration
- `.github/workflows/deploy-railway.yml` - Automated deployment workflow

**Build Process:**
1. Installs system dependencies (Python, Cairo, Pango for native modules)
2. Runs `bun install`
3. Builds `shared` and `server` packages only (frontend is on Cloudflare Pages)
4. Fetches manifests from CDN instead of bundling them
5. Starts with: `cd packages/server && bun dist/index.js`

**Environment Variables:**
Railway deployments require:
- `DATABASE_URL` - PostgreSQL connection (auto-linked from Railway Postgres service)
- `JWT_SECRET` - Random secret for token signing
- `PRIVY_APP_ID` / `PRIVY_APP_SECRET` - Authentication credentials
- `PUBLIC_CDN_URL` - Cloudflare R2 or asset CDN URL
- `NODE_ENV=production`

**Automated Deployment:**
GitHub Actions automatically triggers Railway deployments on pushes to `main` that affect:
- `packages/shared/**`
- `packages/server/**`
- `packages/plugin-hyperscape/**`
- `package.json`, `bun.lock`
- Deployment config files

### Cloudflare Pages (Production Client)

The web client deploys to Cloudflare Pages:

**Build Configuration:**
- Root directory: `packages/client`
- Build command: `bun run build`
- Output directory: `dist`

**Environment Variables:**
- `PUBLIC_PRIVY_APP_ID` - Must match server's `PRIVY_APP_ID`
- `PUBLIC_API_URL` - Railway server URL (https://hyperscape-production.up.railway.app)
- `PUBLIC_WS_URL` - Railway WebSocket URL (wss://hyperscape-production.up.railway.app/ws)
- `PUBLIC_CDN_URL` - Cloudflare R2 CDN URL

**CORS Configuration:**
The server's CORS allowlist includes:
- `https://hyperscape.pages.dev` - Production domain
- `https://*.hyperscape.pages.dev` - Preview deployments (wildcard subdomain)

Preview deployments are automatically created for all pull requests.

### Asset Management

**Local Development:**
- Assets downloaded via Git LFS during `bun install`
- Served by local Docker CDN on port 8080

**Production:**
- Assets hosted on Cloudflare R2
- Manifests fetched from CDN at server startup (not bundled in deployment)
- Configured via `PUBLIC_CDN_URL` environment variable

**Manifest Fetching:**
The server fetches manifests from `${PUBLIC_CDN_URL}/manifests/` at startup when running in CI/production environments. This reduces deployment size and allows manifest updates without redeploying the server.
```

### 3. Update Troubleshooting Section

Add Railway-specific troubleshooting:

```markdown
### Railway Deployment Issues

**Build fails with "lockfile had changes":**
```bash
# Regenerate lockfile locally
bun install
git add bun.lock
git commit -m "chore: update bun.lock"
```

**Frontend not loading (404 errors):**
The server no longer serves the frontend in production. Ensure:
- Frontend is deployed to Cloudflare Pages separately
- `PUBLIC_API_URL` and `PUBLIC_WS_URL` in client env point to Railway server
- CORS allowlist includes your Cloudflare Pages domain

**Manifests not loading:**
Ensure `PUBLIC_CDN_URL` is set and points to a CDN with manifests uploaded to `/manifests/` directory.
```

### 4. Update Port Allocation Table

**Add note about production:**
```markdown
| Port | Service | Env Var | Started By | Production |
|------|---------|---------|------------|------------|
| 5555 | Game Server | `PORT` | `bun run dev` | Railway |
| 3333 | Client | `VITE_PORT` | `bun run dev` | Cloudflare Pages |
| 8080 | Asset CDN | (hardcoded) | `bun run dev` | Cloudflare R2 |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` | N/A |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` | N/A |
| 4001 | ElizaOS API | (hardcoded) | `bun run dev:ai` | N/A |
| 3402 | Documentation | (hardcoded) | `bun run docs:dev` | Mintlify |
```
