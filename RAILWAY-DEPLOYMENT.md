# Railway Deployment Guide

Complete guide for deploying Hyperscape game server to Railway.

## Overview

Railway provides managed hosting for the Hyperscape game server with:
- **Automatic builds** using Nixpacks
- **Auto-scaling** based on traffic
- **Managed PostgreSQL** via Neon integration
- **GitHub integration** for CI/CD
- **Environment variable management**
- **Deployment monitoring** and logs

## Architecture

```
GitHub (main branch)
     ↓ (push)
GitHub Actions
     ↓ (triggers)
Railway GraphQL API
     ↓ (redeploys)
Railway Build (Nixpacks)
     ↓ (builds)
Production Server
     ↓ (fetches)
Cloudflare R2 (manifests)
```

## Prerequisites

1. **Railway account** - Sign up at https://railway.app/
2. **GitHub repository** - Hyperscape repo with push access
3. **Neon database** - PostgreSQL instance (or Railway PostgreSQL)
4. **Cloudflare R2** - For assets and manifests
5. **Privy account** - For authentication

## Initial Setup

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
```

### 2. Login to Railway

```bash
railway login
```

### 3. Create New Project

**Option A: Via CLI**
```bash
cd /path/to/hyperscape
railway init
```

**Option B: Via Dashboard**
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Hyperscape repository
5. Railway auto-detects Nixpacks configuration

### 4. Link Local Project

```bash
railway link
```

Select your project from the list.

### 5. Configure Environment Variables

```bash
# Set variables via CLI
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=postgresql://...
railway variables set PUBLIC_CDN_URL=https://assets.hyperscape.club
railway variables set PUBLIC_PRIVY_APP_ID=your-app-id
railway variables set PRIVY_APP_SECRET=your-app-secret
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set ADMIN_CODE=your-admin-code
```

**Or via Dashboard:**
1. Go to project → Variables
2. Add each variable manually
3. Click "Deploy" to apply changes

### 6. Deploy

```bash
railway up
```

Railway will:
1. Upload your code
2. Build using Nixpacks
3. Start the server
4. Run health checks
5. Provide deployment URL

## Configuration Files

### nixpacks.toml

Configures the Railway build process.

**Location:** `nixpacks.toml` (repository root)

**Key Sections:**

```toml
[phases.setup]
# System dependencies for native modules
aptPkgs = ["python3", "make", "g++", "libcairo2-dev", ...]

[phases.install]
# Package installation
cmds = ["bun install"]

[phases.build]
# Build commands
cmds = [
  "bun run build:shared",
  "bun run build:server",
  "mkdir -p packages/server/world/assets/manifests"
]

[start]
# Start command
cmd = "cd packages/server && bun dist/index.js"

[variables]
# Build-time environment variables
CI = "true"
SKIP_ASSETS = "true"
NODE_ENV = "production"
```

**Customization:**
- Add system dependencies to `aptPkgs`
- Modify build commands in `phases.build`
- Change start command in `[start]`

### railway.server.json

Railway service configuration.

**Location:** `railway.server.json` (repository root)

**Configuration:**

```json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "nixpacks.toml",
    "watchPatterns": [
      "packages/shared/**",
      "packages/server/**",
      "packages/plugin-hyperscape/**",
      "package.json",
      "bun.lock"
    ]
  },
  "deploy": {
    "startCommand": "cd packages/server && bun dist/index.js",
    "healthcheckPath": "/status",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "numReplicas": 1
  }
}
```

**Key Settings:**
- `watchPatterns` - Files that trigger rebuilds
- `healthcheckPath` - Endpoint for health checks
- `healthcheckTimeout` - Seconds to wait for health check
- `restartPolicyType` - When to restart on failure
- `numReplicas` - Number of instances (1 for free tier)

### .railwayignore

Excludes files from Railway uploads for faster deployments.

**Location:** `.railwayignore` (repository root)

**Excluded:**
```
node_modules/
.git/
packages/server/world/assets/  # Assets served from CDN
test-results/
*.log
```

**Important:** Do NOT ignore `dist/` or `build/` - these are needed for deployment.

## Build Process

### Build Phases

Railway builds in these phases:

1. **Setup** (30-60 seconds)
   - Install system dependencies
   - Install Bun runtime

2. **Install** (60-120 seconds)
   - Run `bun install`
   - Install npm dependencies
   - Skip asset download (CI=true)

3. **Build** (120-180 seconds)
   - Build `physx-js-webidl` (copies prebuilt WASM)
   - Build `shared` package
   - Build `server` package
   - Create manifests directory

4. **Start** (5-10 seconds)
   - Run `bun dist/index.js`
   - Fetch manifests from CDN
   - Connect to database
   - Start HTTP and WebSocket servers

**Total build time:** ~3-5 minutes

### Build Logs

**View logs:**
```bash
railway logs --build
```

**Common build errors:**

**Error:** `lockfile had changes, but lockfile is frozen`
- **Solution:** Run `bun install` locally and commit `bun.lock`

**Error:** `Failed to fetch manifests from CDN`
- **Solution:** Verify `PUBLIC_CDN_URL` is set and accessible

**Error:** `Cannot find module '@hyperscape/shared'`
- **Solution:** Ensure `shared` package builds before `server`

## Runtime Configuration

### Environment Variables

**Required:**

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host/db` |
| `PUBLIC_CDN_URL` | Assets CDN URL | `https://assets.hyperscape.club` |
| `PUBLIC_PRIVY_APP_ID` | Privy app ID | `clxxx...` |
| `PRIVY_APP_SECRET` | Privy app secret | `xxx...` |
| `JWT_SECRET` | JWT signing secret | `random-32-char-string` |

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_CODE` | Admin access code | (none) |
| `PORT` | Server port | `5555` |
| `SAVE_INTERVAL` | Auto-save interval (seconds) | `60` |
| `DISABLE_RATE_LIMIT` | Disable rate limiting | `false` |
| `COMMIT_HASH` | Git commit hash | (auto-set by Railway) |

**Set variables:**
```bash
# Via CLI
railway variables set KEY=value

# Via Dashboard
# Go to project → Variables → Add variable
```

### Secrets Management

**Never commit secrets to git:**
- `PRIVY_APP_SECRET`
- `JWT_SECRET`
- `DATABASE_URL` (contains password)
- `ADMIN_CODE`

**Generate secure secrets:**
```bash
# JWT secret (32 characters)
openssl rand -base64 32

# Admin code (16 characters)
openssl rand -hex 16
```

## Deployment Workflows

### Automatic Deployment (Recommended)

**Setup:**

1. **Add Railway secrets to GitHub:**
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add secret: `RAILWAY_TOKEN`
   - Get token from Railway dashboard → Account → Tokens

2. **Configure workflow:**
   - File: `.github/workflows/deploy-railway.yml`
   - Already configured for Hyperscape

3. **Deploy:**
   - Push to `main` branch
   - GitHub Actions triggers Railway deployment
   - Monitor progress in Actions tab

**Workflow steps:**
1. Checkout code
2. Trigger Railway deployment via GraphQL API
3. Wait for deployment to start
4. Check deployment status
5. Report success/failure

### Manual Deployment

**Deploy via CLI:**
```bash
railway up
```

**Deploy via Dashboard:**
1. Go to Railway project
2. Click "Deploy"
3. Select branch to deploy
4. Monitor build logs

### Rollback

**Via CLI:**
```bash
railway rollback
```

**Via Dashboard:**
1. Go to project → Deployments
2. Find previous successful deployment
3. Click "Redeploy"

## Monitoring

### Deployment Status

**Check deployment:**
```bash
railway status
```

**View logs:**
```bash
railway logs              # Runtime logs
railway logs --build      # Build logs
railway logs --follow     # Stream logs
```

### Metrics

**Railway dashboard provides:**
- CPU usage
- Memory usage
- Network traffic
- Request rate
- Error rate
- Deployment history

**Access:** Railway project → Metrics

### Health Checks

**Endpoint:** `/status`

**Expected response:**
```json
{
  "status": "ok",
  "players": 5,
  "uptime": 3600,
  "version": "1.0.0"
}
```

**Configure:**
```json
// In railway.server.json
"healthcheckPath": "/status",
"healthcheckTimeout": 300
```

**Health check failures:**
- Railway will restart the service
- After 3 failures, deployment is marked as failed
- Check logs for errors

## Scaling

### Vertical Scaling

**Increase resources:**
1. Go to Railway project → Settings
2. Adjust CPU and memory limits
3. Click "Save"
4. Service will restart with new limits

**Recommended specs:**

| Players | CPU | Memory | Cost |
|---------|-----|--------|------|
| 0-50 | 1 vCPU | 1 GB | $10/month |
| 50-200 | 2 vCPU | 2 GB | $20/month |
| 200-500 | 4 vCPU | 4 GB | $40/month |
| 500+ | 8 vCPU | 8 GB | $80/month |

### Horizontal Scaling

**Enable replicas:**
1. Go to Railway project → Settings → Scaling
2. Set `numReplicas` to desired count
3. Railway will load balance across replicas

**Considerations:**
- WebSocket connections are sticky (same replica)
- Database connection pooling must be configured
- Shared state requires Redis or similar

**Not recommended for Hyperscape** due to WebSocket stickiness and shared world state.

### Auto-Scaling

**Configure:**
1. Go to Railway project → Settings → Scaling
2. Enable auto-scaling
3. Set min/max replicas
4. Configure CPU/memory thresholds

**Example:**
- Min replicas: 1
- Max replicas: 3
- Scale up at: 80% CPU
- Scale down at: 20% CPU

## Troubleshooting

### Build Failures

**Error:** `bun: command not found`
- **Solution:** Railway should auto-detect Bun. Check `nixpacks.toml` has correct configuration.

**Error:** `Failed to build shared package`
- **Solution:** Ensure `physx-js-webidl` builds first. Check build order in `nixpacks.toml`.

**Error:** `Cannot find module`
- **Solution:** Run `bun install` locally and commit `bun.lock`.

### Runtime Failures

**Error:** `Failed to fetch manifests from CDN`
- **Solution:** 
  1. Verify `PUBLIC_CDN_URL` is set
  2. Check CDN is accessible: `curl {PUBLIC_CDN_URL}/manifests/npcs.json`
  3. Review Railway logs for fetch errors

**Error:** `Database connection failed`
- **Solution:**
  1. Verify `DATABASE_URL` is correct
  2. Check Neon database is running
  3. Ensure Railway can access Neon (check firewall)

**Error:** `Port already in use`
- **Solution:** Railway auto-assigns ports. Don't hardcode `PORT` in code.

### Deployment Hangs

**Symptoms:**
- Build completes but service doesn't start
- Health check times out

**Solutions:**
1. Check Railway logs for startup errors
2. Verify health check endpoint is accessible
3. Increase `healthcheckTimeout` in `railway.server.json`
4. Check that server binds to `0.0.0.0` (not `localhost`)

### High Memory Usage

**Symptoms:**
- Service crashes with OOM errors
- Memory usage spikes in metrics

**Solutions:**
1. Increase memory limit in Railway settings
2. Check for memory leaks in logs
3. Optimize database queries
4. Enable connection pooling

## Cost Optimization

### Free Tier Usage

**Railway free tier:**
- $5/month credit
- ~500 hours of runtime
- 1 GB RAM, 1 vCPU

**Tips:**
- Use sleep mode for non-production environments
- Deploy only when needed
- Monitor usage in Railway dashboard

### Reducing Costs

1. **Optimize build time:**
   - Use `.railwayignore` to exclude unnecessary files
   - Cache dependencies
   - Minimize build steps

2. **Optimize runtime:**
   - Use connection pooling
   - Enable caching
   - Optimize database queries

3. **Use external services:**
   - Neon for database (free tier)
   - Cloudflare R2 for assets (free tier)
   - Reduces Railway resource usage

## Advanced Configuration

### Custom Build Command

**Override Nixpacks:**

Edit `railway.server.json`:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.server"
  }
}
```

**Use Dockerfile instead:**
- More control over build process
- Multi-stage builds for smaller images
- Custom base images

### Environment-Specific Deployments

**Staging environment:**
```bash
# Create staging service
railway service create hyperscape-staging

# Set staging variables
railway variables set NODE_ENV=staging --service hyperscape-staging

# Deploy to staging
railway up --service hyperscape-staging
```

**Production environment:**
```bash
# Deploy to production
railway up --service hyperscape-production
```

### Database Migrations

**Automatic migrations:**
- Migrations run on server startup
- Defined in `packages/server/src/database/migrations/`
- Uses Drizzle ORM

**Manual migrations:**
```bash
# Connect to Railway shell
railway shell

# Run migrations
cd packages/server
bunx drizzle-kit push
```

### Custom Domains

**Add custom domain:**
1. Go to Railway project → Settings → Domains
2. Click "Add domain"
3. Enter domain: `api.hyperscape.club`
4. Add CNAME record in DNS: `api.hyperscape.club` → `hyperscape-production.up.railway.app`
5. SSL auto-provisions

**Update client configuration:**
```env
PUBLIC_API_URL=https://api.hyperscape.club
PUBLIC_WS_URL=wss://api.hyperscape.club/ws
```

## Monitoring & Debugging

### View Logs

**Real-time logs:**
```bash
railway logs --follow
```

**Build logs:**
```bash
railway logs --build
```

**Filter logs:**
```bash
railway logs | grep ERROR
railway logs | grep "Failed to fetch"
```

### Connect to Shell

**Open shell:**
```bash
railway shell
```

**Useful commands:**
```bash
# Check environment variables
env | grep PUBLIC

# Check manifest directory
ls -la packages/server/world/assets/manifests/

# Test manifest fetch
curl $PUBLIC_CDN_URL/manifests/npcs.json

# Check database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM characters;"
```

### Debugging Deployment Issues

**Check build output:**
1. Go to Railway project → Deployments
2. Click on deployment
3. View build logs
4. Look for errors in each phase

**Check runtime logs:**
1. Go to Railway project → Deployments
2. Click on deployment
3. View runtime logs
4. Look for startup errors

**Common issues:**

**Manifests not loading:**
```
[Config] ⚠️  Failed to fetch npcs.json: HTTP 404
```
- **Solution:** Upload manifests to R2, verify `PUBLIC_CDN_URL`

**Database connection failed:**
```
Error: connect ECONNREFUSED
```
- **Solution:** Check `DATABASE_URL`, verify Neon is running

**Frontend not found:**
```
[HTTP] ⚠️  No index.html found in public directory
```
- **Solution:** Build client and copy to server public directory

## GitHub Actions Integration

### Workflow Configuration

**File:** `.github/workflows/deploy-railway.yml`

**Triggers:**
- Push to `main` branch
- Changes to server-related files
- Manual workflow dispatch

**Environment variables:**
```yaml
env:
  RAILWAY_PROJECT_ID: e5f5ba11-0380-4d71-aa0b-343d89a58c0d
  RAILWAY_SERVICE_ID: f0b42e3b-3001-4ef1-926f-af6c3c138777
  RAILWAY_ENVIRONMENT_ID: 194f3565-ba2f-4c98-87d2-85dfc3a5110b
```

**Get these IDs:**
```bash
railway status --json
```

### Workflow Steps

1. **Checkout code** - Clone repository
2. **Trigger deployment** - Call Railway GraphQL API
3. **Wait for deployment** - Poll deployment status
4. **Check status** - Verify deployment succeeded

### Customizing Workflow

**Add deployment notifications:**

```yaml
- name: Notify deployment
  if: success()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d '{"text":"Hyperscape deployed to production"}'
```

**Add pre-deployment tests:**

```yaml
- name: Run tests
  run: |
    bun install
    bun test
```

## Best Practices

### 1. Use Environment Variables

**Never hardcode:**
- Database credentials
- API keys
- CDN URLs
- Domain names

**Always use:**
```typescript
const cdnUrl = process.env.PUBLIC_CDN_URL;
const dbUrl = process.env.DATABASE_URL;
```

### 2. Enable Health Checks

**Implement health endpoint:**
```typescript
fastify.get('/status', async () => ({
  status: 'ok',
  timestamp: Date.now(),
  players: world.getEntitiesByType('Player').length,
  uptime: process.uptime(),
}));
```

### 3. Monitor Deployments

**Set up alerts:**
1. Go to Railway project → Settings → Notifications
2. Enable deployment notifications
3. Add webhook for Slack/Discord

### 4. Use Staging Environment

**Create staging:**
```bash
railway service create hyperscape-staging
railway variables set NODE_ENV=staging --service hyperscape-staging
```

**Test before production:**
1. Deploy to staging
2. Run integration tests
3. Verify functionality
4. Deploy to production

### 5. Optimize Build Time

**Cache dependencies:**
- Railway caches `node_modules` between builds
- Use `.railwayignore` to exclude large files

**Minimize build steps:**
- Only build necessary packages
- Skip unnecessary steps in CI

### 6. Database Connection Pooling

**Configure in code:**
```typescript
// packages/server/src/database/client.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

**Railway considerations:**
- Free tier: 1 instance = 20 connections max
- Paid tier: Multiple instances = 20 × replicas
- Neon free tier: 100 connections max

## Migration from Other Platforms

### From Heroku

**Differences:**
- Railway uses Nixpacks instead of Buildpacks
- No `Procfile` needed (use `railway.server.json`)
- Environment variables set via CLI or dashboard

**Migration steps:**
1. Export Heroku config: `heroku config -s > .env`
2. Import to Railway: `railway variables set $(cat .env)`
3. Update `DATABASE_URL` to new database
4. Deploy: `railway up`

### From Vercel

**Differences:**
- Vercel is for frontend only
- Railway handles backend + WebSocket
- Split deployment required

**Migration steps:**
1. Keep frontend on Vercel or move to Cloudflare Pages
2. Deploy server to Railway
3. Update frontend env vars to point to Railway
4. Test WebSocket connections

### From AWS

**Differences:**
- Railway is fully managed (no EC2/ECS configuration)
- Automatic SSL and load balancing
- Simpler deployment process

**Migration steps:**
1. Export database from RDS
2. Import to Neon
3. Deploy to Railway
4. Update DNS records
5. Test thoroughly before switching traffic

## Support

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Hyperscape Issues:** https://github.com/HyperscapeAI/hyperscape/issues

## License

MIT - See LICENSE file
