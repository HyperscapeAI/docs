# Deployment Best Practices

This guide covers best practices for deploying Hyperscape to production, including maintenance mode coordination, health checks, and zero-downtime deployments.

## Table of Contents

1. [Maintenance Mode](#maintenance-mode)
2. [Deployment Workflow](#deployment-workflow)
3. [Health Checks](#health-checks)
4. [Rollback Procedures](#rollback-procedures)
5. [Security Checklist](#security-checklist)
6. [Monitoring](#monitoring)

## Maintenance Mode

Maintenance mode provides graceful deployment coordination for the streaming duel system, preventing data loss and market inconsistency during deployments.

### When to Use Maintenance Mode

**Required for:**
- Code deployments that restart the server
- Database schema migrations
- Configuration changes affecting duel system
- Infrastructure maintenance (server moves, scaling)

**Not required for:**
- Static asset updates (CDN only)
- Client-only deployments (Cloudflare Pages)
- Documentation updates

### Maintenance Mode API

**Authentication**: All endpoints require `ADMIN_CODE` header:
```bash
-H "x-admin-code: your-admin-code"
```

#### Enter Maintenance Mode

```bash
POST /admin/maintenance/enter
Content-Type: application/json

{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**
- `reason` (string): Reason for maintenance (logged for audit)
- `timeoutMs` (number): Maximum wait time for markets to resolve (default: 300000 = 5 minutes)

**Behavior:**
1. Pauses new duel cycles (current cycle completes)
2. Locks betting markets (no new bets accepted)
3. Waits for current market to resolve
4. Returns when safe to deploy or timeout reached

**Response:**
```json
{
  "success": true,
  "message": "Maintenance mode activated",
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0
}
```

#### Check Status

```bash
GET /admin/maintenance/status
```

**Response:**
```json
{
  "active": true,
  "enteredAt": 1709000000000,
  "reason": "deployment",
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0
}
```

**Safe to Deploy When:**
- `safeToDeploy: true`
- `currentPhase: "IDLE"` (no active duel)
- `marketStatus: "resolved"` (all markets settled)
- `pendingMarkets: 0`

#### Exit Maintenance Mode

```bash
POST /admin/maintenance/exit
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance mode deactivated"
}
```

**Behavior:**
- Resumes duel cycle scheduling
- Unlocks betting markets
- Normal operations resume

### Helper Scripts

**Pre-Deployment:**
```bash
# Enter maintenance mode and wait for safe state
./scripts/pre-deploy-maintenance.sh

# Required environment variables:
# - VAST_SERVER_URL (e.g., https://hyperscape.gg)
# - ADMIN_CODE
```

**Post-Deployment:**
```bash
# Exit maintenance mode and resume operations
./scripts/post-deploy-resume.sh

# Required environment variables:
# - VAST_SERVER_URL
# - ADMIN_CODE
```

### CI/CD Integration

The Vast.ai deployment workflow (`.github/workflows/deploy-vast.yml`) automatically coordinates maintenance mode:

```yaml
- name: Enter maintenance mode
  run: ./scripts/pre-deploy-maintenance.sh
  
- name: Deploy to Vast.ai
  run: ./scripts/deploy-vast.sh
  
- name: Exit maintenance mode
  run: ./scripts/post-deploy-resume.sh
```

**Workflow Steps:**
1. Enter maintenance mode (pauses new duels)
2. Wait for active markets to resolve (up to 5 minutes)
3. Deploy latest code via SSH
4. Verify deployment health
5. Exit maintenance mode (resumes operations)

**Timeout Handling:**
- If markets don't resolve within timeout, deployment proceeds anyway
- Manual intervention may be required to resolve stuck markets
- Check `/admin/maintenance/status` after deployment

## Deployment Workflow

### Railway (Production Server)

**Automatic Deployment:**
- Push to `main` → deploys to `prod` environment
- Push to `develop` → deploys to `dev` environment

**Manual Deployment:**
1. Go to GitHub Actions → Deploy to Railway
2. Select environment: `prod` or `dev`
3. Click "Run workflow"

**Environment Variables** (set in Railway dashboard):
- `JWT_SECRET` - **Required** (throws error if not set)
- `ADMIN_CODE` - **Required** for security
- `DATABASE_URL` - PostgreSQL connection string
- `PRIVY_APP_ID` - Privy app ID
- `PRIVY_APP_SECRET` - Privy app secret
- `PUBLIC_CDN_URL` - Asset CDN URL (e.g., https://assets.hyperscape.club)

**Post-Deployment:**
1. Check `/health` endpoint: `https://hyperscape.gg/health`
2. Verify WebSocket: `wss://hyperscape.gg/ws`
3. Monitor logs for errors
4. Test character creation and login

### Cloudflare Pages (Frontend)

**Automatic Deployment:**
- Push to `main` → deploys to production
- Pull requests → preview deployments

**Manual Deployment:**
```bash
cd packages/client
bun run build
bunx wrangler deploy
```

**Environment Variables** (set in Cloudflare dashboard):
- `PUBLIC_PRIVY_APP_ID` - Must match server's `PRIVY_APP_ID`
- `PUBLIC_API_URL` - Backend API URL (e.g., https://hyperscape.gg)
- `PUBLIC_WS_URL` - WebSocket URL (e.g., wss://hyperscape.gg/ws)
- `PUBLIC_CDN_URL` - Asset CDN URL (e.g., https://assets.hyperscape.club)

**Post-Deployment:**
1. Test asset loading (check Network tab for 404s)
2. Verify WebSocket connection
3. Test authentication flow
4. Check for CORS errors in Console

### Vast.ai (Streaming Duels)

**Automatic Deployment:**
- Triggered on successful main branch builds
- Includes maintenance mode coordination
- Automatic health checks and recovery

**Manual Deployment:**
```bash
# SSH into Vast.ai instance
ssh -p $VAST_PORT root@$VAST_HOST

# Pull latest code
cd /root/hyperscape
git fetch origin
git checkout main
git pull origin main

# Install dependencies
bun install --frozen-lockfile

# Build
bun run build

# Restart services
pm2 restart ecosystem.config.cjs
```

**Post-Deployment:**
1. Check PM2 status: `pm2 status`
2. Verify stream health: `curl http://localhost:5555/health`
3. Check RTMP output: `ffplay rtmp://your-rtmp-server/live/stream`
4. Monitor logs: `pm2 logs`

## Health Checks

### Server Health Endpoint

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "version": "1.0.0",
  "commit": "abc123def456",
  "database": "connected",
  "websocket": "active",
  "maintenance": false,
  "streaming": {
    "active": true,
    "phase": "FIGHTING",
    "uptime": 1800000
  }
}
```

**Health Indicators:**
- `status: "healthy"` - All systems operational
- `database: "connected"` - PostgreSQL connection active
- `websocket: "active"` - WebSocket server running
- `maintenance: false` - Not in maintenance mode
- `streaming.active: true` - Streaming duel system running

### Vast.ai Health Checks

The Vast.ai keeper (`packages/vast-keeper`) automatically monitors instance health:

**Health Check Criteria:**
- HTTP `/health` endpoint responds with 200
- Response time < 5 seconds
- Database connection active
- WebSocket server running

**Failure Handling:**
1. Detect unhealthy instance (3 consecutive failures)
2. Destroy failed instance
3. Provision new instance
4. Deploy latest code
5. Resume operations

**Configuration** (`.env`):
```bash
# Health check interval (seconds)
HEALTH_CHECK_INTERVAL=60

# Failure threshold before reprovisioning
HEALTH_CHECK_FAILURE_THRESHOLD=3

# Health check timeout (milliseconds)
HEALTH_CHECK_TIMEOUT=5000
```

### Manual Health Checks

**Server:**
```bash
# Check server health
curl https://hyperscape.gg/health

# Check WebSocket
wscat -c wss://hyperscape.gg/ws

# Check database
psql $DATABASE_URL -c "SELECT 1"
```

**Streaming:**
```bash
# Check RTMP output
ffplay rtmp://your-rtmp-server/live/stream

# Check FFmpeg process
ps aux | grep ffmpeg

# Check browser capture
curl http://localhost:5555/api/streaming/state
```

## Rollback Procedures

### Railway Rollback

**Via Dashboard:**
1. Go to Railway dashboard → Deployments
2. Find last known good deployment
3. Click "Redeploy"

**Via CLI:**
```bash
# List recent deployments
railway deployments

# Rollback to specific deployment
railway rollback <deployment-id>
```

### Cloudflare Pages Rollback

**Via Dashboard:**
1. Go to Cloudflare dashboard → Pages → hyperscape
2. Click "Deployments" tab
3. Find last known good deployment
4. Click "Rollback to this deployment"

**Via Git:**
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or force push to previous commit (use with caution)
git reset --hard <commit-hash>
git push --force origin main
```

### Vast.ai Rollback

**Via SSH:**
```bash
# SSH into instance
ssh -p $VAST_PORT root@$VAST_HOST

# Checkout previous commit
cd /root/hyperscape
git log --oneline -10  # Find last known good commit
git checkout <commit-hash>

# Rebuild and restart
bun install --frozen-lockfile
bun run build
pm2 restart ecosystem.config.cjs
```

**Via Keeper:**
```bash
# Destroy current instance and provision new one
# Keeper will deploy latest main branch
# Manually checkout previous commit after provisioning
```

## Security Checklist

### Pre-Deployment

- [ ] `JWT_SECRET` set and secure (32+ characters)
- [ ] `ADMIN_CODE` set and not committed to git
- [ ] `PRIVY_APP_SECRET` set and not exposed to client
- [ ] Database credentials rotated (if compromised)
- [ ] API tokens reviewed and scoped appropriately
- [ ] Environment variables match between client and server
- [ ] CORS configuration includes only known domains
- [ ] Rate limiting enabled (`DISABLE_RATE_LIMIT=false`)

### Post-Deployment

- [ ] `/health` endpoint returns 200
- [ ] Authentication flow works (Privy login)
- [ ] Admin commands require `ADMIN_CODE`
- [ ] CSRF protection active for same-origin requests
- [ ] CORS errors not present in browser console
- [ ] WebSocket connections establish successfully
- [ ] Database migrations applied successfully
- [ ] No sensitive data in client-side logs

### Production Environment Variables

**Required:**
```bash
NODE_ENV=production
JWT_SECRET=<32+ character random string>
ADMIN_CODE=<secure admin code>
DATABASE_URL=postgresql://...
PRIVY_APP_ID=<privy app id>
PRIVY_APP_SECRET=<privy app secret>
```

**Recommended:**
```bash
ALERT_WEBHOOK_URL=<slack/discord webhook>
COMMIT_HASH=<git commit hash>
DISABLE_RATE_LIMIT=false
LOAD_TEST_MODE=false
```

**Generate Secrets:**
```bash
# JWT_SECRET
openssl rand -base64 32

# ADMIN_CODE
openssl rand -base64 16
```

## Monitoring

### Key Metrics

**Server:**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- WebSocket connections (active, total)
- Database query time
- Memory usage
- CPU usage

**Streaming:**
- RTMP uptime
- FFmpeg restarts
- CDP stall events
- Frame rate (target: 30 FPS)
- Bitrate (target: 2500 kbps)

**Duel System:**
- Duel cycle duration
- Market resolution time
- Bet placement rate
- Payout success rate

### Logging

**Server Logs:**
```bash
# Railway
railway logs

# Vast.ai
ssh -p $VAST_PORT root@$VAST_HOST
pm2 logs

# Local
tail -f packages/server/logs/server.log
```

**Streaming Logs:**
```bash
# FFmpeg output
pm2 logs ffmpeg

# Browser capture
pm2 logs capture

# RTMP bridge
pm2 logs rtmp-bridge
```

### Alerts

**Critical Alerts** (configure `ALERT_WEBHOOK_URL`):
- Server crash or restart
- Database connection lost
- WebSocket server down
- Streaming pipeline failure
- Maintenance mode timeout

**Warning Alerts:**
- High error rate (> 5%)
- Slow response time (> 1s p95)
- Memory usage > 80%
- FFmpeg restart (> 3 in 10 minutes)

## Common Deployment Issues

### JWT_SECRET Not Set

**Symptom**: Server throws error on startup in production/staging.

**Cause**: `JWT_SECRET` is required as of February 2026 (security hardening).

**Solution**:
```bash
# Generate secure secret
openssl rand -base64 32

# Set in Railway/Vast.ai environment
JWT_SECRET=<generated-secret>
```

### CORS Errors After Deployment

**Symptom**: Assets fail to load with CORS errors in browser console.

**Cause**: R2 bucket CORS not configured or domains missing.

**Solution**:
1. Run `scripts/configure-r2-cors.sh` (see `docs/r2-cors-configuration.md`)
2. Verify all domains in `AllowedOrigins` list
3. Wait 1-2 minutes for propagation
4. Hard reload browser (Cmd+Shift+R / Ctrl+Shift+R)

### Maintenance Mode Timeout

**Symptom**: Deployment proceeds but markets still active.

**Cause**: Markets didn't resolve within timeout (default 5 minutes).

**Solution**:
1. Check market status: `GET /admin/maintenance/status`
2. Manually resolve stuck markets (if safe)
3. Exit maintenance mode: `POST /admin/maintenance/exit`
4. Monitor for data inconsistencies

### Database Migration Failures

**Symptom**: Server fails to start after deployment with schema errors.

**Cause**: Migration failed or partially applied.

**Solution**:
```bash
# Check migration status
cd packages/server
bunx drizzle-kit status

# Manually apply migrations
bunx drizzle-kit migrate

# If corrupted, rollback and reapply
bunx drizzle-kit drop
bunx drizzle-kit push
```

### WebSocket Connection Failures

**Symptom**: Clients can't connect to WebSocket after deployment.

**Cause**: WebSocket URL misconfigured or server not listening.

**Solution**:
1. Verify `PUBLIC_WS_URL` in client `.env` matches server domain
2. Check server logs for WebSocket initialization errors
3. Test WebSocket manually: `wscat -c wss://hyperscape.gg/ws`
4. Verify Railway/Cloudflare WebSocket support enabled

## Zero-Downtime Deployment

### Strategy

1. **Blue-Green Deployment** (Railway):
   - Deploy to new instance
   - Health check new instance
   - Switch traffic to new instance
   - Keep old instance for rollback

2. **Maintenance Mode Coordination** (Vast.ai):
   - Enter maintenance mode
   - Wait for safe state
   - Deploy new code
   - Exit maintenance mode

### Implementation

**Railway** (automatic):
- Railway handles blue-green deployment automatically
- Old instance kept for 30 seconds after new instance healthy
- Traffic switches when new instance passes health checks

**Vast.ai** (manual coordination):
```bash
# 1. Enter maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/enter \
  -H "x-admin-code: $ADMIN_CODE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'

# 2. Wait for safe state
while true; do
  STATUS=$(curl -s https://hyperscape.gg/admin/maintenance/status \
    -H "x-admin-code: $ADMIN_CODE")
  SAFE=$(echo $STATUS | jq -r '.safeToDeploy')
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy"
    break
  fi
  echo "Waiting for safe state..."
  sleep 10
done

# 3. Deploy
./scripts/deploy-vast.sh

# 4. Health check
curl https://hyperscape.gg/health

# 5. Exit maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: $ADMIN_CODE"
```

## Database Migrations

### Safe Migration Workflow

1. **Backup Database:**
   ```bash
   # Railway
   railway run pg_dump > backup.sql
   
   # Manual
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Test Migration Locally:**
   ```bash
   # Create test database
   createdb hyperscape_test
   
   # Restore backup
   psql hyperscape_test < backup.sql
   
   # Test migration
   DATABASE_URL=postgresql://localhost/hyperscape_test \
     bunx drizzle-kit migrate
   ```

3. **Apply to Production:**
   ```bash
   # Enter maintenance mode
   ./scripts/pre-deploy-maintenance.sh
   
   # Apply migration
   cd packages/server
   bunx drizzle-kit migrate
   
   # Verify schema
   bunx drizzle-kit status
   
   # Exit maintenance mode
   ./scripts/post-deploy-resume.sh
   ```

4. **Rollback if Needed:**
   ```bash
   # Restore from backup
   psql $DATABASE_URL < backup.sql
   
   # Redeploy previous code version
   railway rollback <deployment-id>
   ```

### Migration Best Practices

- **Always backup** before migrations
- **Test locally** with production data copy
- **Use transactions** for multi-step migrations
- **Avoid breaking changes** (add columns as nullable, deprecate instead of drop)
- **Monitor performance** after migrations (check query plans)

## Streaming Deployment

### RTMP Configuration

**Environment Variables** (set in Vast.ai/Railway):
```bash
# Twitch
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live

# X/Twitter
X_STREAM_KEY=your-x-stream-key
X_RTMP_URL=rtmp://x-media-studio/your-path
```

**Verify Streaming:**
```bash
# Check FFmpeg process
pm2 logs ffmpeg

# Test RTMP output
ffplay rtmp://live.twitch.tv/app/your-stream-key

# Check stream health
curl http://localhost:5555/api/streaming/state
```

### Streaming Stability

**Tuning Parameters** (`.env`):
```bash
# CDP stall threshold (intervals before restart)
CDP_STALL_THRESHOLD=6                    # Default: 4 (120s total)

# FFmpeg restart attempts before giving up
FFMPEG_MAX_RESTART_ATTEMPTS=10           # Default: 8

# Capture recovery failures before full restart
CAPTURE_RECOVERY_MAX_FAILURES=5          # Default: 4

# Canonical platform for delay defaults
STREAMING_CANONICAL_PLATFORM=twitch      # Options: youtube | twitch | hls

# Public data delay (milliseconds)
STREAMING_PUBLIC_DELAY_MS=0              # Default: 0ms (instant broadcast)
```

**February 2026 Improvements:**
- **Soft CDP Recovery**: Restarts screencast without browser/FFmpeg teardown (no stream gap)
- **Increased Thresholds**: CDP stall (2→4 intervals), FFmpeg restarts (5→8), recovery failures (2→4)
- **Best-Effort WebGPU**: Tries `maxTextureArrayLayers: 2048`, retries with defaults if GPU rejects

## Troubleshooting

### Deployment Hangs

**Symptom**: Deployment stuck in "Building" or "Starting" state.

**Cause**: Build timeout, dependency installation failure, or startup error.

**Solution**:
1. Check Railway/GitHub Actions logs for errors
2. Verify `bun install --frozen-lockfile` succeeds locally
3. Check for npm 403 errors (retry logic should handle)
4. Increase build timeout in Railway settings (if needed)

### Database Connection Errors

**Symptom**: Server starts but can't connect to database.

**Cause**: `DATABASE_URL` misconfigured or database not accessible.

**Solution**:
1. Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
2. Check database is running and accessible
3. Test connection manually: `psql $DATABASE_URL -c "SELECT 1"`
4. Verify firewall rules allow connections from server IP

### Asset 404 Errors

**Symptom**: Models, textures, or audio fail to load with 404 errors.

**Cause**: CDN URL misconfigured or assets not uploaded.

**Solution**:
1. Verify `PUBLIC_CDN_URL` in both client and server `.env`
2. Check R2 bucket contains assets: `aws s3 ls s3://hyperscape-assets/`
3. Upload missing assets: `bun run assets:sync` (see README)
4. Verify CORS configuration (see `docs/r2-cors-configuration.md`)

## Related Documentation

- **R2 CORS**: `docs/r2-cors-configuration.md`
- **Railway Setup**: `docs/railway-dev-prod.md`
- **Native Releases**: `docs/native-release.md`
- **Duel Stack**: `docs/duel-stack.md`
- **Environment Variables**: `packages/server/.env.example`, `packages/client/.env.example`

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and tested locally
- [ ] All tests passing (`bun test`)
- [ ] Database backup created
- [ ] Migration tested on copy of production data
- [ ] Environment variables verified
- [ ] Security checklist completed
- [ ] Rollback plan documented

### During Deployment

- [ ] Maintenance mode entered (if applicable)
- [ ] Safe state confirmed (`safeToDeploy: true`)
- [ ] Deployment triggered
- [ ] Health checks passing
- [ ] Logs monitored for errors

### Post-Deployment

- [ ] `/health` endpoint returns 200
- [ ] WebSocket connections working
- [ ] Authentication flow tested
- [ ] Asset loading verified
- [ ] Database queries performing well
- [ ] Streaming active (if applicable)
- [ ] Maintenance mode exited
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

## Emergency Contacts

**Critical Issues:**
1. Check #hyperscape-alerts Slack channel
2. Page on-call engineer via PagerDuty
3. Rollback immediately if user-facing

**Non-Critical Issues:**
1. Create GitHub issue with logs
2. Post in #hyperscape-dev Slack channel
3. Schedule fix for next deployment

## Commit References

- **Maintenance Mode**: `30b52bd` (February 26, 2026)
- **CORS Configuration**: `143914d` (February 26, 2026)
- **Streaming Stability**: `14a1e1b` (February 25, 2026)
- **JWT Security**: `3bc59db` (February 26, 2026)
