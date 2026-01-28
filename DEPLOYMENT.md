# Hyperscape Deployment Guide

Complete guide for deploying Hyperscape to production using the split deployment architecture.

## Architecture Overview

Hyperscape uses a **split deployment** model for optimal performance and scalability:

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐                                        │
│  │   Cloudflare    │  Frontend (Static)                     │
│  │     Pages       │  - React SPA (Vite build)              │
│  │ hyperscape.club │  - Global CDN distribution             │
│  └────────┬────────┘  - Automatic HTTPS                     │
│           │                                                   │
│           │ WebSocket (wss://) + HTTP (https://)            │
│           ▼                                                   │
│  ┌─────────────────┐                                        │
│  │    Railway      │  Game Server (API)                     │
│  │  Game Server    │  - Fastify + WebSockets                │
│  │   (Nixpacks)    │  - Auto-scaling                        │
│  └────────┬────────┘  - Managed PostgreSQL (Neon)          │
│           │                                                   │
│           │ Fetches manifests at startup                     │
│           ▼                                                   │
│  ┌─────────────────┐                                        │
│  │  Cloudflare R2  │  Assets & CDN                          │
│  │   Assets CDN    │  - 3D models, textures, audio          │
│  │                 │  - JSON manifests                       │
│  │                 │  - Global CDN distribution              │
│  └─────────────────┘                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

| Component | Platform | URL | Purpose | Auto-Deploy |
|-----------|----------|-----|---------|-------------|
| **Frontend** | Cloudflare Pages | https://hyperscape.club | Static React SPA | ✅ Yes (on push to main) |
| **Game Server** | Railway | https://hyperscape-production.up.railway.app | API + WebSocket | ✅ Yes (via GitHub Actions) |
| **Assets/CDN** | Cloudflare R2 | https://assets.hyperscape.club | Models, audio, textures, manifests | ❌ Manual (`bun run sync:r2`) |
| **Database** | Neon | (internal) | PostgreSQL database | N/A |

## Prerequisites

### Required Accounts

1. **Cloudflare** - For Pages (frontend) and R2 (assets)
   - Sign up: https://dash.cloudflare.com/sign-up
   - Free tier available

2. **Railway** - For game server hosting
   - Sign up: https://railway.app/
   - Free tier: $5/month credit

3. **Neon** - For PostgreSQL database
   - Sign up: https://neon.tech/
   - Free tier available

4. **Privy** - For authentication
   - Sign up: https://dashboard.privy.io/
   - Free tier available

### Required Tools

```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Install Bun (package manager)
curl -fsSL https://bun.sh/install | bash
```

## Step-by-Step Deployment

### 1. Database Setup (Neon)

1. **Create Neon project:**
   - Go to https://console.neon.tech/
   - Click "New Project"
   - Name: "hyperscape-production"
   - Region: Choose closest to your users

2. **Get connection string:**
   - Copy the connection string from project dashboard
   - Format: `postgresql://user:password@host/database?sslmode=require`

3. **Save for later:**
   - You'll need this for Railway environment variables

### 2. Assets Setup (Cloudflare R2)

1. **Create R2 bucket:**
   - Go to Cloudflare dashboard → R2
   - Click "Create bucket"
   - Name: "hyperscape-assets"
   - Region: Automatic

2. **Configure public access:**
   - Go to bucket settings
   - Enable "Public access"
   - Note the public URL (e.g., `https://pub-xxx.r2.dev`)

3. **Upload assets:**
   ```bash
   # Configure Wrangler
   wrangler login
   
   # Upload assets to R2
   bun run sync:r2
   ```

4. **Custom domain (optional):**
   - Go to R2 bucket → Settings → Custom Domains
   - Add domain: `assets.hyperscape.club`
   - Add CNAME record in Cloudflare DNS

### 3. Server Setup (Railway)

1. **Create Railway project:**
   ```bash
   railway login
   railway init
   ```

2. **Link to GitHub:**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your Hyperscape fork
   - Railway will auto-detect the Nixpacks configuration

3. **Configure environment variables:**
   
   Go to Railway project → Variables and add:
   
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://...           # From Neon (step 1)
   PUBLIC_CDN_URL=https://assets.hyperscape.club
   PUBLIC_PRIVY_APP_ID=your-privy-app-id
   PRIVY_APP_SECRET=your-privy-app-secret
   JWT_SECRET=your-secure-random-string   # Generate with: openssl rand -base64 32
   ADMIN_CODE=your-admin-code
   PORT=5555
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Get deployment URL:**
   - Railway will provide a URL like: `hyperscape-production.up.railway.app`
   - Save this for frontend configuration

### 4. Frontend Setup (Cloudflare Pages)

1. **Create Pages project:**
   - Go to Cloudflare dashboard → Pages
   - Click "Create a project"
   - Connect to GitHub
   - Select your Hyperscape repository

2. **Configure build settings:**
   - **Build command:** `cd packages/client && bun run build`
   - **Build output directory:** `packages/client/dist`
   - **Root directory:** `/` (repository root)
   - **Environment variables:** See below

3. **Set environment variables:**
   
   Go to Pages project → Settings → Environment variables:
   
   ```env
   PUBLIC_PRIVY_APP_ID=your-privy-app-id        # Must match server
   PUBLIC_API_URL=https://hyperscape-production.up.railway.app
   PUBLIC_WS_URL=wss://hyperscape-production.up.railway.app/ws
   PUBLIC_CDN_URL=https://assets.hyperscape.club
   PUBLIC_APP_URL=https://hyperscape.club
   ```

4. **Custom domain:**
   - Go to Pages project → Custom domains
   - Add domain: `hyperscape.club`
   - Add CNAME record in Cloudflare DNS

5. **Deploy:**
   - Push to `main` branch
   - Cloudflare Pages auto-deploys

### 5. Privy Configuration

1. **Configure allowed domains:**
   - Go to Privy dashboard → Settings → Basics
   - Add allowed domains:
     - `https://hyperscape.club`
     - `https://www.hyperscape.club`
     - `https://hyperscape.pages.dev` (for preview deployments)

2. **Configure redirect URIs:**
   - Add redirect URIs:
     - `https://hyperscape.club`
     - `https://www.hyperscape.club`

3. **Enable login methods:**
   - Go to Settings → Login Methods
   - Enable desired methods (wallet, email, social, Farcaster)

### 6. Verify Deployment

1. **Check server health:**
   ```bash
   curl https://hyperscape-production.up.railway.app/status
   ```

2. **Check frontend:**
   - Open https://hyperscape.club
   - Should load login screen
   - Check browser console for errors

3. **Check assets:**
   ```bash
   curl https://assets.hyperscape.club/manifests/npcs.json
   ```

4. **Test authentication:**
   - Login with Privy
   - Create character
   - Verify character appears in world

## Deployment Workflows

### Automatic Deployments

**On push to `main`:**

1. **Frontend** (Cloudflare Pages):
   - Automatically builds and deploys
   - No configuration needed
   - Preview deployments for PRs

2. **Server** (Railway):
   - GitHub Actions triggers deployment
   - Workflow: `.github/workflows/deploy-railway.yml`
   - Uses Railway GraphQL API
   - Monitors deployment status

3. **Assets** (Cloudflare R2):
   - Manual upload required
   - Run `bun run sync:r2` when assets change

### Manual Deployments

**Deploy server manually:**
```bash
railway up
```

**Deploy frontend manually:**
```bash
cd packages/client
bun run build
wrangler pages deploy dist --project-name=hyperscape
```

**Upload assets manually:**
```bash
bun run sync:r2
```

## Environment Variables Reference

### Server (Railway)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | ✅ | Environment mode | `production` |
| `DATABASE_URL` | ✅ | PostgreSQL connection | `postgresql://...` |
| `PUBLIC_CDN_URL` | ✅ | Assets CDN URL | `https://assets.hyperscape.club` |
| `PUBLIC_PRIVY_APP_ID` | ✅ | Privy app ID | `clxxx...` |
| `PRIVY_APP_SECRET` | ✅ | Privy app secret | `xxx...` |
| `JWT_SECRET` | ✅ | JWT signing secret | `random-32-char-string` |
| `ADMIN_CODE` | ⚠️ | Admin access code | `your-secret-code` |
| `PORT` | ❌ | Server port | `5555` (default) |
| `SAVE_INTERVAL` | ❌ | Auto-save interval (seconds) | `60` (default) |

### Client (Cloudflare Pages)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PUBLIC_PRIVY_APP_ID` | ✅ | Privy app ID (must match server) | `clxxx...` |
| `PUBLIC_API_URL` | ✅ | Server HTTP API | `https://hyperscape-production.up.railway.app` |
| `PUBLIC_WS_URL` | ✅ | Server WebSocket | `wss://hyperscape-production.up.railway.app/ws` |
| `PUBLIC_CDN_URL` | ✅ | Assets CDN | `https://assets.hyperscape.club` |
| `PUBLIC_APP_URL` | ✅ | Frontend URL | `https://hyperscape.club` |

## Monitoring & Maintenance

### Health Checks

**Server health:**
```bash
curl https://hyperscape-production.up.railway.app/status
```

**Expected response:**
```json
{
  "status": "ok",
  "players": 5,
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Logs

**Railway logs:**
```bash
railway logs
```

**Cloudflare Pages logs:**
- Go to Pages project → Deployments → View logs

### Database Backups

**Neon automatic backups:**
- Neon provides automatic daily backups
- Retention: 7 days (free tier), 30 days (paid)

**Manual backup:**
```bash
# Export from Neon
pg_dump $DATABASE_URL > backup.sql

# Restore to Neon
psql $DATABASE_URL < backup.sql
```

### Asset Updates

**When to update:**
- New 3D models added
- Audio files changed
- Manifest data updated

**How to update:**
```bash
# 1. Update assets in local repo
git pull origin main

# 2. Upload to R2
bun run sync:r2

# 3. Verify upload
curl https://assets.hyperscape.club/manifests/npcs.json

# 4. Server will fetch new manifests on next restart
railway restart
```

## Scaling

### Horizontal Scaling

**Railway auto-scaling:**
- Go to Railway project → Settings → Scaling
- Enable auto-scaling
- Set min/max replicas
- Configure CPU/memory thresholds

**Load balancing:**
- Railway provides automatic load balancing
- WebSocket connections are sticky (same server)

### Database Scaling

**Neon scaling:**
- Free tier: 0.5 GB storage, 1 compute unit
- Paid tier: Auto-scaling compute, up to 200 GB storage
- Connection pooling: Built-in (max 100 connections)

**Optimization:**
- Add indexes for frequently queried columns
- Use connection pooling (configured in `src/database/client.ts`)
- Monitor slow queries with Neon dashboard

### CDN Scaling

**Cloudflare R2:**
- Unlimited bandwidth (no egress fees)
- Global CDN distribution
- Automatic caching and optimization

## Troubleshooting

### Deployment Failures

**Railway build fails:**
1. Check Railway logs for build errors
2. Verify `nixpacks.toml` configuration
3. Ensure all dependencies are in `package.json`
4. Check that `PUBLIC_CDN_URL` is accessible

**Cloudflare Pages build fails:**
1. Check build logs in Pages dashboard
2. Verify build command is correct
3. Ensure environment variables are set
4. Check that `packages/client/dist` is created

### Runtime Errors

**Server crashes on startup:**
1. Check Railway logs
2. Verify `DATABASE_URL` is correct
3. Ensure manifests are accessible from CDN
4. Check that all required environment variables are set

**CORS errors:**
1. Verify client domain is in CORS allowlist
2. Check `packages/server/src/startup/http-server.ts`
3. Ensure `PUBLIC_PRIVY_APP_ID` matches between client and server
4. Add your domain to the allowlist if needed

**WebSocket connection fails:**
1. Verify `PUBLIC_WS_URL` uses `wss://` (not `ws://`)
2. Check Railway logs for WebSocket errors
3. Ensure Railway service is running
4. Test WebSocket connection: `wscat -c wss://your-server.up.railway.app/ws`

**Manifests not loading:**
1. Check that CDN is accessible from server
2. Verify manifests exist at `{CDN_URL}/manifests/*.json`
3. Review server startup logs for fetch errors
4. Check R2 bucket permissions (should be public)

### Performance Issues

**High latency:**
1. Check Railway region (should be close to users)
2. Monitor database query performance in Neon
3. Enable Railway auto-scaling
4. Consider adding Redis cache

**High memory usage:**
1. Monitor Railway metrics
2. Check for memory leaks in logs
3. Increase Railway memory allocation
4. Optimize database queries

**Database connection errors:**
1. Check Neon connection limits
2. Verify connection pooling is configured
3. Monitor active connections in Neon dashboard
4. Consider upgrading Neon tier

## Cost Estimation

### Free Tier (Development/Testing)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Railway | $5/month credit | ~500 hours/month |
| Cloudflare Pages | Unlimited | 500 builds/month |
| Cloudflare R2 | 10 GB storage | 1M reads/month |
| Neon | 0.5 GB storage | 1 compute unit |
| **Total** | **~$0-5/month** | Suitable for testing |

### Production (100-500 CCU)

| Service | Cost | Specs |
|---------|------|-------|
| Railway | $20-50/month | 2-4 GB RAM, auto-scaling |
| Cloudflare Pages | $0 | Unlimited bandwidth |
| Cloudflare R2 | $5-10/month | 50 GB storage |
| Neon | $20-40/month | Auto-scaling compute |
| **Total** | **$45-100/month** | Production-ready |

### Enterprise (1000+ CCU)

| Service | Cost | Specs |
|---------|------|-------|
| Railway | $100-200/month | 8-16 GB RAM, multiple replicas |
| Cloudflare Pages | $0 | Unlimited bandwidth |
| Cloudflare R2 | $20-30/month | 200 GB storage |
| Neon | $100-200/month | Dedicated compute |
| **Total** | **$220-430/month** | High-scale production |

## Security Checklist

### Pre-Deployment

- [ ] Generate secure `JWT_SECRET` (32+ characters)
- [ ] Set strong `ADMIN_CODE`
- [ ] Configure `PRIVY_APP_SECRET` (never commit to git)
- [ ] Use strong PostgreSQL password
- [ ] Enable SSL for database connections
- [ ] Review CORS allowlist in `http-server.ts`

### Post-Deployment

- [ ] Verify HTTPS is working (Cloudflare auto-provisions)
- [ ] Test authentication flow
- [ ] Verify WebSocket connections use WSS
- [ ] Check that admin commands require `ADMIN_CODE`
- [ ] Monitor Railway logs for suspicious activity
- [ ] Enable Railway auto-scaling
- [ ] Set up monitoring alerts

### Ongoing

- [ ] Rotate `JWT_SECRET` periodically
- [ ] Monitor database access logs
- [ ] Review Railway metrics for anomalies
- [ ] Keep dependencies updated
- [ ] Monitor Cloudflare security events

## Rollback Procedures

### Server Rollback

**Railway:**
1. Go to Railway project → Deployments
2. Find previous successful deployment
3. Click "Redeploy"

**Via CLI:**
```bash
railway rollback
```

### Frontend Rollback

**Cloudflare Pages:**
1. Go to Pages project → Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"

### Database Rollback

**Restore from backup:**
```bash
# Download backup from Neon
neon backup download <backup-id> > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Advanced Configuration

### Custom Domains

**Frontend (Cloudflare Pages):**
1. Add CNAME record: `hyperscape.club` → `hyperscape.pages.dev`
2. Add to Pages custom domains
3. SSL auto-provisions

**Server (Railway):**
1. Add CNAME record: `api.hyperscape.club` → `hyperscape-production.up.railway.app`
2. Update `PUBLIC_API_URL` and `PUBLIC_WS_URL` in client
3. Update CORS allowlist in server

### Multi-Region Deployment

**Railway regions:**
- US West (Oregon)
- US East (Virginia)
- Europe (Frankfurt)

**Strategy:**
1. Deploy server to region closest to users
2. Use Cloudflare Pages for global frontend distribution
3. Use Cloudflare R2 for global asset distribution

### CI/CD Customization

**Modify deployment workflow:**
Edit `.github/workflows/deploy-railway.yml`:

```yaml
# Add deployment notifications
- name: Notify deployment
  run: |
    curl -X POST $SLACK_WEBHOOK \
      -d '{"text":"Hyperscape deployed to production"}'
```

## Monitoring

### Railway Metrics

- CPU usage
- Memory usage
- Network traffic
- Request rate
- Error rate

**Access:** Railway dashboard → Metrics

### Cloudflare Analytics

- Page views
- Bandwidth usage
- Cache hit rate
- Geographic distribution

**Access:** Cloudflare dashboard → Analytics

### Database Monitoring

**Neon metrics:**
- Connection count
- Query performance
- Storage usage
- Compute usage

**Access:** Neon dashboard → Monitoring

### Custom Monitoring

**Add health check endpoint:**
```typescript
// In packages/server/src/startup/routes/health-routes.ts
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: Date.now(),
  players: world.getEntitiesByType('Player').length,
  uptime: process.uptime(),
}));
```

**Monitor with external service:**
- UptimeRobot: https://uptimerobot.com/
- Pingdom: https://www.pingdom.com/
- Better Uptime: https://betteruptime.com/

## Support

- **Railway Support:** https://railway.app/help
- **Cloudflare Support:** https://support.cloudflare.com/
- **Neon Support:** https://neon.tech/docs
- **Hyperscape Issues:** https://github.com/HyperscapeAI/hyperscape/issues

## License

MIT - See LICENSE file
