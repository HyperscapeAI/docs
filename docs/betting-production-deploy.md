# Betting Production Deploy (Cloudflare + Railway)

This is the recommended production topology for the betting stack in this repo:

- Frontend (`/packages/gold-betting-demo/app`): Cloudflare Pages
- Backend (`/packages/server`): Railway (Dockerfile-based)
- DDoS/WAF/edge cache: Cloudflare proxy in front of Railway
- Contracts/state: Solana + EVM (configured by env vars below)

## 1) Deploy backend to Railway

From repo root, deploy the existing server service:

```bash
railway up
```

Use `Dockerfile.server` / `railway.server.json` (already in repo).

Set these Railway variables at minimum:

- `NODE_ENV=production`
- `PORT=5555`
- `DATABASE_URL=...` (managed Postgres recommended)
- `JWT_SECRET=...` (32+ random bytes)
- `ADMIN_CODE=...`
- `PUBLIC_API_URL=https://api.yourdomain.com`
- `PUBLIC_WS_URL=wss://api.yourdomain.com/ws`
- `CLIENT_URL=https://bet.yourdomain.com`
- `PUBLIC_APP_URL=https://bet.yourdomain.com`
- `DUEL_BETTING_ENABLED=true`
- `STREAMING_VIEWER_ACCESS_TOKEN=...` (long random value)
- `ARENA_EXTERNAL_BET_WRITE_KEY=...` (long random value, server-to-server only)

Contracts / chain wiring (set to your target networks):

- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `SOLANA_ARENA_MARKET_PROGRAM_ID`
- `SOLANA_GOLD_MINT`
- `BSC_RPC_URL`
- `BSC_CHAIN_ID=56` (or your target testnet id)
- `BSC_GOLD_CLOB_ADDRESS`
- `SOLANA_ARENA_AUTHORITY_SECRET` (if on-chain writes/resolve are enabled)
- `BIRDEYE_API_KEY` (optional)
- `HELIUS_API_KEY` (recommended for mainnet Solana RPC)

Notes:

- The server now fails closed in production if duel betting is enabled without the required Solana arena env vars above.
- BSC external bet points verification requires both `BSC_RPC_URL` and `BSC_GOLD_CLOB_ADDRESS` on the backend. Do not rely on frontend-only `VITE_*` vars for server verification.

Optional origin lock (recommended):

- `CLOUDFLARE_ORIGIN_SECRET=<random>`

If set, every non-health request must include header:

- `x-hyperscape-origin-secret: <same value>`

Use a Cloudflare Transform Rule to inject this header on traffic forwarded to Railway.

### Railway Database Configuration

Railway uses connection pooling (pgbouncer) which requires special configuration. The server **automatically detects Railway** via:

1. `RAILWAY_ENVIRONMENT` environment variable (most reliable)
2. Hostname patterns: `.rlwy.net` (proxy), `.railway.app` (direct), `.railway.internal` (internal)

When Railway is detected, the server automatically:
- **Disables prepared statements** (not supported by pgbouncer)
- **Uses lower connection pool limits** (max: 6 instead of 20)
- **Prevents "too many clients already" errors**

**Recommended Railway database settings:**

```bash
# In Railway environment variables
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

**For crash loop scenarios** (server restarting frequently):

```bash
POSTGRES_POOL_MAX=3              # Even lower to prevent exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also increase PM2 restart delay to allow connections to close:

```javascript
// In ecosystem.config.cjs
restart_delay: 10000,            // 10s instead of 5s
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

**Note:** Railway detection is automatic - you don't need to set any special flags. The system will log:
```
[DB] Supavisor pooler detected — disabling prepared statements
```

## 2) Put Railway behind Cloudflare

1. Create `api.yourdomain.com` in Cloudflare DNS and point it to Railway target.
2. Enable Cloudflare proxy (orange cloud) for `api.yourdomain.com`.
3. Add WAF rate-limit rules:
- `POST /api/arena/bet/record-external`
- `POST /api/arena/deposit/ingest`
- `/api/arena/payout/jobs*`
- `/api/proxy/solana/rpc`
4. Enable Bot Fight Mode / Super Bot Fight Mode.
5. Keep direct Railway URL private (do not publish it).

## 3) Deploy betting frontend to Cloudflare Pages

Project root:

- `packages/gold-betting-demo/app`

Build/output:

- Build command: `bun install && bun run build`
- Output directory: `dist`

Frontend env vars (Cloudflare Pages):

- `VITE_GAME_API_URL=https://api.yourdomain.com`
- `VITE_GAME_WS_URL=wss://api.yourdomain.com/ws`
- `VITE_SOLANA_CLUSTER=mainnet-beta` (or testnet/devnet)
- `VITE_SOLANA_RPC_URL` (optional override)
- `VITE_BSC_RPC_URL` / `VITE_BASE_RPC_URL`
- `VITE_BSC_GOLD_CLOB_ADDRESS` / `VITE_BASE_GOLD_CLOB_ADDRESS`
- `VITE_BSC_GOLD_TOKEN_ADDRESS` / `VITE_BASE_GOLD_TOKEN_ADDRESS`
- `VITE_STREAM_EMBED_URL=https://www.youtube.com/embed/...` (or Twitch player URL)

Cloudflare Pages headers/SPA rules are already added in:

- `packages/gold-betting-demo/app/public/_headers`
- `packages/gold-betting-demo/app/public/_redirects`

## 4) Verify production

Health:

- `https://api.yourdomain.com/status`
- `https://bet.yourdomain.com`
- `https://api.yourdomain.com/api/streaming/state`

End-to-end checks from repo root:

```bash
bun run duel:verify --server-url=https://api.yourdomain.com --betting-url=https://bet.yourdomain.com --require-destinations=youtube
```

## 5) Zero-Downtime Deployments

Use the graceful restart API to deploy new code without interrupting active duels:

```bash
# Request graceful restart
curl -X POST https://api.yourdomain.com/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Monitor restart status
curl https://api.yourdomain.com/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

The server will:
1. Complete the current duel (if any)
2. Send SIGTERM to itself
3. PM2 automatically restarts with new code
4. Resume duel scheduling with updated code

**Deployment workflow:**
1. Push new code to Railway
2. Railway builds and deploys new container
3. Request graceful restart via API
4. Server completes current duel and restarts
5. New code is live with zero duel interruption

## 6) Security notes

- Do not expose `ARENA_EXTERNAL_BET_WRITE_KEY` in public frontend env vars.
- Rotate all secrets before production if they were ever committed/shared.
- Keep `TRUST_PROXY=true` (default behavior in production after this patch).
- Keep `DISABLE_RATE_LIMIT` unset in production.
- Use `ADMIN_CODE` to protect admin endpoints from unauthorized access.
- Railway proxy detection is automatic - no manual configuration needed.

## 7) Monitoring & Alerting

### Health Checks

Configure your monitoring service (Railway health checks, UptimeRobot, Pingdom, etc.) to poll:

- `GET /health` - Basic uptime check (200 OK = healthy)
- `GET /status` - Detailed status with player count and commit hash

### Streaming Health

Monitor streaming pipeline health:

```bash
# Quick diagnostic
curl https://api.yourdomain.com/api/streaming/state

# Detailed RTMP bridge status
curl https://api.yourdomain.com/admin/pools/stats \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

### Database Connection Pool

Monitor connection pool utilization to prevent exhaustion:

```bash
curl https://api.yourdomain.com/admin/pools/stats \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Healthy pool metrics:**
- `inUse < max` (not at capacity)
- `available > 0` (connections available)
- No "too many clients" errors in logs

**Warning signs:**
- `inUse === max` (pool exhausted)
- Frequent connection errors in logs
- Slow query response times

**Action:** Reduce `POSTGRES_POOL_MAX` if you see connection exhaustion.

### Crash Loop Detection

If the server is crash-looping:

1. Check PM2 logs: `pm2 logs hyperscape-duel`
2. Reduce connection pool: `POSTGRES_POOL_MAX=1`
3. Increase restart delay: `restart_delay: 10000` in ecosystem.config.cjs
4. Check for memory leaks: Monitor heap usage over time

### Placeholder Mode Monitoring

Check if placeholder mode is active (indicates no live frames):

```bash
# Check RTMP bridge stats
curl https://api.yourdomain.com/admin/pools/stats \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

Look for `inPlaceholderMode: true` in the response. If placeholder mode is active for extended periods, investigate:
- Browser capture issues
- WebGPU initialization failures
- Network connectivity problems
