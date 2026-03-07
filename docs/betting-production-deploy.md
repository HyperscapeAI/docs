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

**Railway Database Configuration (NEW):**

Railway uses pgbouncer connection pooling which requires special configuration:

```bash
# Railway auto-detects via RAILWAY_ENVIRONMENT env var
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Railway proxy detection is automatic - the system detects `.rlwy.net`, `.railway.app`, and `.railway.internal` domains and:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits
- Prevents "too many clients already" errors

**Streaming Duel Configuration (NEW):**

For crash loop resilience and optimal streaming performance:

```bash
# Connection Pool (for streaming deployments with crash loop risk)
POSTGRES_POOL_MAX=3              # Prevent connection exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections

# Model Agent Spawning
SPAWN_MODEL_AGENTS=true          # Auto-create agents when database is empty

# Stream Keep-Alive
STREAM_PLACEHOLDER_ENABLED=true  # Prevent 30-minute disconnects

# Production Client Build
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

Also update PM2 configuration in `ecosystem.config.cjs`:

```javascript
restart_delay: 10000,            // 10s instead of 5s (allow connections to close)
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

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

**Streaming Health Check (NEW):**

```bash
bun run duel:status
```

Quick diagnostic for verifying streaming health:
- Server health check
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs

## 5) Zero-Downtime Deployments (NEW)

Use the graceful restart API to deploy new code without interrupting active duels:

```bash
# Request graceful restart (requires ADMIN_CODE)
curl -X POST https://api.yourdomain.com/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl https://api.yourdomain.com/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

When graceful restart is requested:
- If no duel active: restarts immediately via SIGTERM
- If duel in progress: waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

## 6) Security notes

- Do not expose `ARENA_EXTERNAL_BET_WRITE_KEY` in public frontend env vars.
- Rotate all secrets before production if they were ever committed/shared.
- Keep `TRUST_PROXY=true` (default behavior in production after this patch).
- Keep `DISABLE_RATE_LIMIT` unset in production.

## 7) Monitoring & Troubleshooting

### Railway "too many clients already" Errors

If you encounter PostgreSQL error 53300 (too many connections):

**Solution:**
Set lower connection pool limits in Railway environment variables:
```bash
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections (Railway auto-detected)
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

For streaming duel deployments with crash loop risk:
```bash
POSTGRES_POOL_MAX=3              # Prevent connection exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

Also update PM2 configuration in `ecosystem.config.cjs`:
```javascript
restart_delay: 10000,            // 10s instead of 5s (allow connections to close)
exp_backoff_restart_delay: 2000, // 2s for gradual backoff
```

Railway is auto-detected via `RAILWAY_ENVIRONMENT` env var or hostname patterns (`.rlwy.net`, `.railway.app`, `.railway.internal`).

### Stream Disconnects After 30 Minutes

Enable placeholder frame mode to prevent Twitch/YouTube disconnects during idle periods:

```bash
STREAM_PLACEHOLDER_ENABLED=true
```

This sends minimal JPEG frames when no live frames are received for 5 seconds, keeping the stream alive during content gaps.

### Browser Timeout During Page Load

Use pre-built client for significantly faster page loads:

```bash
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

This serves pre-built client via `vite preview` instead of dev server, eliminating on-demand module compilation that can cause browser timeouts (180s limit).

### Streaming Health Monitoring

Use the streaming status check script to verify all components:

```bash
bun run duel:status
```

This checks:
- Server health endpoint
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs
