# Deployment Workflow

Complete guide to Hyperscape's automated deployment pipeline.

## Overview

Hyperscape uses GitHub Actions for automated deployment to three targets:

1. **Cloudflare Pages** - Static client hosting (https://hyperscape.gg)
2. **Railway** - Game server (dev/prod environments)
3. **Vast.ai** - GPU streaming and duel arena

## Deployment Targets

### Cloudflare Pages (Client)

**Workflow**: `.github/workflows/deploy-pages.yml`

**Triggers**:
- Push to `main` branch
- Changes to `packages/client/**` or `packages/shared/**`

**Process**:
1. Build shared package first (`bun run build` in packages/shared)
2. Build client package (`bun run build` in packages/client)
3. Deploy to Cloudflare Pages via Wrangler
4. Configure R2 CORS for asset loading

**URLs**:
- Production: https://hyperscape.gg
- Preview: https://[commit-hash].hyperscape.pages.dev

**Required Secrets**:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key for CORS configuration
- `R2_SECRET_ACCESS_KEY` - R2 secret key

### Railway (Game Server)

**Workflow**: `.github/workflows/deploy-railway.yml`

**Branch Mapping**:
- `main` → `prod` environment
- `develop` → `dev` environment

**Process**:
1. Detect which environment based on branch
2. Deploy to Railway using railway CLI
3. Railway builds and deploys automatically

**Required Secrets**:
- `RAILWAY_TOKEN` - Railway API token
- `RAILWAY_PROD_ENV_ID` - Production environment ID
- `RAILWAY_DEV_ENV_ID` - Development environment ID

**See**: [docs/railway-dev-prod.md](railway-dev-prod.md)

### Vast.ai (GPU Streaming)

**Workflow**: `.github/workflows/deploy-vast.yml`

**Triggers**:
- Push to `main` branch (after CI passes)
- Manual trigger via `workflow_dispatch`

**Process**:
1. **Enter Maintenance Mode** (300s timeout)
   - Pauses new duel cycles
   - Waits for pending markets to resolve
   - Prevents interrupting active duels

2. **Deploy via SSH**:
   - Write secrets to `/tmp/hyperscape-secrets.env`
   - Run `scripts/deploy-vast.sh`
   - Script handles:
     - Git pull and reset
     - GPU rendering setup (Xorg/Xvfb)
     - PulseAudio configuration
     - Chrome installation
     - Dependency installation
     - Build process
     - Database migration
     - PM2 restart

3. **Health Check** (120s timeout, 5s interval):
   - Wait for server to respond to `/health` endpoint
   - Verify streaming is active
   - Check RTMP connections

4. **Exit Maintenance Mode**:
   - Resume duel cycles
   - Resume normal operations

**Required Secrets**:
- `VAST_SSH_HOST` - SSH hostname (e.g., ssh6.vast.ai)
- `VAST_SSH_PORT` - SSH port for your instance
- `VAST_SSH_KEY` - SSH private key
- `DATABASE_URL` - PostgreSQL connection string
- `TWITCH_STREAM_KEY` - Twitch stream key
- `KICK_STREAM_KEY` - Kick stream key
- `KICK_RTMP_URL` - Kick RTMP URL
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X/Twitter RTMP URL
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana keypair (base58)
- `JWT_SECRET` - JWT signing secret
- `ARENA_EXTERNAL_BET_WRITE_KEY` - External betting API key

**See**: [docs/vast-deployment.md](vast-deployment.md)

## Maintenance Mode

### Purpose

Maintenance mode allows graceful deployments without interrupting active duels or betting markets.

### How It Works

1. **Enter Maintenance**:
   - Sets `maintenanceMode.active = true`
   - Pauses new duel cycle starts
   - Allows current duels to complete
   - Waits for pending markets to resolve

2. **Deploy**:
   - Code is updated
   - Dependencies installed
   - Database migrated
   - Processes restarted

3. **Exit Maintenance**:
   - Sets `maintenanceMode.active = false`
   - Resumes duel cycles
   - Resumes normal operations

### API Endpoints

**Enter Maintenance**:
```bash
POST /admin/maintenance/enter
Headers:
  Content-Type: application/json
  x-admin-code: your-admin-code
Body:
  {
    "reason": "deployment",
    "timeoutMs": 300000
  }
```

**Check Status**:
```bash
GET /admin/maintenance/status
Headers:
  x-admin-code: your-admin-code
```

**Exit Maintenance**:
```bash
POST /admin/maintenance/exit
Headers:
  Content-Type: application/json
  x-admin-code: your-admin-code
```

**See**: [docs/maintenance-mode-api.md](maintenance-mode-api.md)

## Deployment Checklist

### Before Deploying

- [ ] All tests passing (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Build succeeds locally (`bun run build`)
- [ ] Database migrations tested locally
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] Environment variables updated in GitHub secrets

### Cloudflare Pages

- [ ] `PUBLIC_PRIVY_APP_ID` matches server
- [ ] `PUBLIC_API_URL` points to production server
- [ ] `PUBLIC_WS_URL` points to production WebSocket
- [ ] `PUBLIC_CDN_URL` points to R2 bucket
- [ ] R2 CORS configured for hyperscape.gg

### Railway

- [ ] `DATABASE_URL` configured
- [ ] `JWT_SECRET` set (32+ characters)
- [ ] `ADMIN_CODE` set
- [ ] `PRIVY_APP_ID` and `PRIVY_APP_SECRET` configured
- [ ] Environment variables match client

### Vast.ai

- [ ] NVIDIA GPU instance selected
- [ ] SSH access configured
- [ ] All streaming secrets configured
- [ ] `SOLANA_DEPLOYER_PRIVATE_KEY` set
- [ ] Maintenance mode API tested
- [ ] Health check endpoint working

## Rollback Procedures

### Cloudflare Pages

Cloudflare Pages keeps deployment history:

1. Go to Cloudflare Dashboard → Pages → hyperscape
2. Click "View build" on previous successful deployment
3. Click "Rollback to this deployment"

### Railway

Railway keeps deployment history:

1. Go to Railway Dashboard → Project → Environment
2. Click "Deployments" tab
3. Find previous successful deployment
4. Click "Redeploy"

### Vast.ai

Manual rollback via SSH:

```bash
# SSH to instance
ssh -p $VAST_SSH_PORT root@$VAST_SSH_HOST

# Find previous commit
cd /root/hyperscape
git log --oneline -10

# Reset to previous commit
git reset --hard <commit-hash>

# Restart PM2
bunx pm2 restart hyperscape-duel
```

## Monitoring Deployments

### GitHub Actions

Monitor deployment progress:
1. Go to GitHub → Actions tab
2. Click on running workflow
3. View logs for each step

### Cloudflare Pages

Monitor build progress:
1. Go to Cloudflare Dashboard → Pages → hyperscape
2. Click "View build" on latest deployment
3. View build logs

### Railway

Monitor deployment:
1. Go to Railway Dashboard → Project → Environment
2. Click "Deployments" tab
3. View deployment logs

### Vast.ai

Monitor via SSH:

```bash
# PM2 status
bunx pm2 status

# Live logs
bunx pm2 logs hyperscape-duel

# Streaming diagnostics
curl http://localhost:5555/api/streaming/state
```

## Troubleshooting

### Deployment Fails at Build

**Symptoms**:
- GitHub Actions shows build errors
- "Module not found" errors

**Solutions**:
1. Check build order (physx-js-webidl → procgen → shared → others)
2. Verify all dependencies in package.json
3. Clear caches: `bun run clean && bun install`
4. Check for circular dependencies

### Deployment Succeeds but Site Broken

**Symptoms**:
- Deployment completes but site shows errors
- Assets fail to load (404s)

**Solutions**:
1. Check `PUBLIC_CDN_URL` is correct
2. Verify R2 CORS is configured
3. Check browser console for errors
4. Verify environment variables match between client and server

### Vast.ai Deployment Fails

**Symptoms**:
- SSH connection fails
- GPU setup fails
- Health check times out

**Solutions**:
1. Verify SSH credentials in GitHub secrets
2. Check Vast.ai instance is running
3. Review deploy-vast.sh logs in GitHub Actions
4. SSH manually and check GPU: `nvidia-smi`
5. Check Xorg logs: `cat /var/log/Xorg.99.log`

### Maintenance Mode Stuck

**Symptoms**:
- Maintenance mode doesn't exit
- Duels don't resume

**Solutions**:
1. Check maintenance status: `curl .../admin/maintenance/status`
2. Force exit: `curl -X POST .../admin/maintenance/exit`
3. Restart PM2: `bunx pm2 restart hyperscape-duel`
4. Check for pending markets in database

## Best Practices

1. **Test Locally First**: Always test changes locally before deploying
2. **Use Maintenance Mode**: For production deployments, always use maintenance mode
3. **Monitor Deployments**: Watch GitHub Actions and server logs during deployment
4. **Verify Health**: Check health endpoints after deployment
5. **Have Rollback Plan**: Know how to rollback before deploying
6. **Update Secrets Securely**: Rotate secrets regularly, never commit to git
7. **Document Breaking Changes**: Update CHANGELOG.md for breaking changes
8. **Coordinate Deployments**: Client and server should deploy together for breaking changes

## See Also

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment guide
- [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway deployment
- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Maintenance mode API
- [docs/streaming-configuration.md](streaming-configuration.md) - Streaming configuration
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
