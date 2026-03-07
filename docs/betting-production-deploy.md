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

**New Streaming Configuration:**

- `STREAM_PLACEHOLDER_ENABLED=true` - Send placeholder frames during idle periods (prevents 30-minute disconnect)
- `SPAWN_MODEL_AGENTS=true` - Auto-create agents when database is empty (useful for fresh deployments)
- `STREAM_CAPTURE_EXECUTABLE=...` - Explicit Chrome path for WebGPU (e.g., `/usr/bin/google-chrome-unstable`)
- `STREAM_LOW_LATENCY=true` - Use zerolatency tune for faster playback start
- `STREAM_GOP_SIZE=60` - GOP size in frames (default: 60)
- `STREAM_AUDIO_ENABLED=true` - Enable audio capture
- `PULSE_AUDIO_DEVICE=...` - PulseAudio device name

**Database Configuration (Railway):**

Railway uses connection pooling (pgbouncer) which requires special configuration:

- `POSTGRES_POOL_MAX=6` - Lower limit for pooler connections (or 3 for crash loop protection)
- `POSTGRES_POOL_MIN=0` - Don't hold idle connections
- `RAILWAY_ENVIRONMENT=production` - Auto-detected by Railway (enables Railway-specific optimizations)

Railway proxy detection is automatic - the system detects `.rlwy.net`, `.railway.app`, and `.railway.internal` domains and:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits
- Prevents "too many clients already" errors

Detection also works via `RAILWAY_ENVIRONMENT` environment variable for reliable identification.

**Production Client Build:**

- `DUEL_USE_PRODUCTION_CLIENT=true` - Force production client for streaming (significantly faster page loads)

**Solana Runtime Configuration:**

Duel-specific Solana configuration (takes precedence over general SOLANA_* vars):

- `DUEL_SOLANA_RPC_URL=https://api.devnet.solana.com` - Solana RPC endpoint
- `DUEL_SOLANA_WS_URL=wss://api.devnet.solana.com` - Solana WebSocket endpoint
- `DUEL_SOLANA_ARENA_MARKET_PROGRAM_ID=9NdidShnVzy1fc1WHWJTvyuXmH47ynfNGA6QFdyfAuSU` - Fight oracle program ID (default)
- `DUEL_SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump` - Gold token mint (default)
- `DUEL_SOLANA_ARENA_AUTHORITY_SECRET=...` - Solana keypair for arena operations (file path or base58)
- `DUEL_SOLANA_ARENA_REPORTER_SECRET=...` - Solana keypair for reporting results
- `DUEL_SOLANA_ARENA_KEEPER_SECRET=...` - Solana keypair for keeper bot automation

Fallback to general Solana configuration if DUEL_* vars not set:

- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `SOLANA_ARENA_MARKET_PROGRAM_ID`
- `SOLANA_GOLD_MINT`
- `SOLANA_ARENA_AUTHORITY_SECRET` (if on-chain writes/resolve are enabled)

EVM chain wiring (set to your target networks):

- `BSC_RPC_URL`
- `BSC_CHAIN_ID=56` (or your target testnet id)
- `BSC_GOLD_CLOB_ADDRESS`
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

**Streaming Status Check:**

```bash
# Check streaming health (requires SSH access to server)
bun run duel:status
```

This checks:
- Server health endpoint
- Streaming API status
- Duel context (fighting phase)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs

**Graceful Restart:**

```bash
# Request restart after current duel ends
curl -X POST https://api.yourdomain.com/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl https://api.yourdomain.com/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

End-to-end checks from repo root:

```bash
bun run duel:verify --server-url=https://api.yourdomain.com --betting-url=https://bet.yourdomain.com --require-destinations=youtube
```

## 5) Security notes

- Do not expose `ARENA_EXTERNAL_BET_WRITE_KEY` in public frontend env vars.
- Rotate all secrets before production if they were ever committed/shared.
- Keep `TRUST_PROXY=true` (default behavior in production after this patch).
- Keep `DISABLE_RATE_LIMIT` unset in production.

## Railway-Specific Configuration

**Connection Pool Limits:**

Railway uses pgbouncer for connection pooling. Set lower limits to prevent "too many clients" errors:

```bash
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

For crash loop protection, reduce further:

```bash
POSTGRES_POOL_MAX=3              # Prevents connection exhaustion during crash loops
restart_delay=10000              # 10s in ecosystem.config.cjs (allows connections to close)
exp_backoff_restart_delay=2000   # 2s for gradual backoff
```

**Automatic Detection:**

Railway is automatically detected via:
- `RAILWAY_ENVIRONMENT` environment variable (most reliable)
- Hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`

When detected, the system:
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits
- Prevents "too many clients already" errors

No manual configuration required - detection is automatic.

## Deployment Process Improvements

**Process Management:**

Recent improvements to prevent deployment issues:

- **Targeted Process Killing**: Uses specific process names instead of `pkill -f bun` (avoids killing deploy script)
- **Graceful PM2 Shutdown**: Stops PM2 with delays between commands
- **Process Teardown Before Migration**: Kills processes and waits 30s for DB connections to close before running migrations
- Prevents "too many clients" errors during database migrations

**GitHub Actions:**

Fixed in recent commits:
- upload-artifact version (v7 → v4)
- Build order (shared must build before impostors/procgen)
- Heredoc variable expansion in deploy-vast.yml
