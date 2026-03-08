# Betting Production Deploy (Cloudflare + Railway)

This is the recommended production topology for the betting stack in this repo:

- Frontend (`/packages/gold-betting-demo/app`): Cloudflare Pages
- Betting API (`/packages/gold-betting-demo/keeper`): Railway
- Live duel/stream source (`/packages/server` or Vast duel stack): separate upstream that the keeper polls
- DDoS/WAF/edge cache: Cloudflare proxy in front of the betting API
- Contracts/state: Solana + EVM (configured by env vars below, proxied server-side)

## Deployment Metadata

**Centralized Contract Addresses**: All contract addresses and program IDs are now managed in a single source of truth:

- `packages/gold-betting-demo/deployments/contracts.json` - Shared deployment manifest
- `packages/gold-betting-demo/deployments/index.ts` - Typed deployment configuration with runtime validation

This manifest is used by:
- Frontend app defaults
- Keeper API defaults
- Local development scripts
- EVM deploy receipt syncing
- Preflight validation checks

**EVM Deployment Receipts**: Each EVM deployment writes a receipt to `packages/evm-contracts/deployments/<network>.json` containing:
- Network name and chain ID
- Deployer address
- Contract addresses (GoldClob, GOLD token)
- Treasury and market maker addresses
- Deployment transaction hash
- Deployment timestamp

The EVM deploy script automatically updates the central `contracts.json` manifest after successful deployment.

## 1) Deploy the betting keeper to Railway

From repo root, deploy the keeper service path:

```bash
railway up packages/gold-betting-demo/keeper --path-as-root -s gold-betting-keeper
```

Use `packages/gold-betting-demo/keeper/railway.json`.

Set these Railway variables at minimum:

- `NODE_ENV=production`
- `PORT=8080` (or let Railway inject its port if you proxy through the service domain)
- `STREAM_STATE_SOURCE_URL=https://your-stream-source.example/api/streaming/state`
- `STREAM_STATE_SOURCE_BEARER_TOKEN=...` if the upstream streaming state is protected
- `ARENA_EXTERNAL_BET_WRITE_KEY=...`
- `STREAM_PUBLISH_KEY=...` if you use `/api/streaming/state/publish`
- `SOLANA_CLUSTER=mainnet-beta`
- `SOLANA_RPC_URL=...`
- `BSC_RPC_URL=...`
- `BSC_GOLD_CLOB_ADDRESS=...`
- `BASE_RPC_URL=...`
- `BASE_GOLD_CLOB_ADDRESS=...`
- `BIRDEYE_API_KEY=...` if token-price proxying is enabled

Persistence:

- The keeper defaults to a local SQLite file (`KEEPER_DB_PATH=./keeper.sqlite`).
- On Railway that file is ephemeral unless you attach a persistent volume or move the keeper state to an external database.
- Do not treat points history, referrals, or oracle history as durable unless persistence is configured explicitly.

Notes:

- The keeper serves the Pages app's read/write betting APIs. It is not the same process as the Hyperscape duel server.
- The keeper also proxies Solana and EVM JSON-RPC for the public app. Keep provider-keyed RPC URLs on Railway, not in Cloudflare Pages build vars.
- The keeper will return boot fallback duel data until `STREAM_STATE_SOURCE_URL` is set and the upstream duel server responds.
- The autonomous keeper bot also needs a funded signer wallet on Solana to create/resolve markets in production.

## 2) Deploy the live duel server / stream source

This can be the Railway `hyperscape` service or the Vast.ai duel stack. It must expose:

- `/api/streaming/state`
- `/api/streaming/duel-context`
- `/api/streaming/rtmp/status`
- `/live/stream.m3u8`

If you run the Vast.ai stack, verify it before pointing the keeper at it:

```bash
./scripts/check-streaming-status.sh http://127.0.0.1:5555
```

## 3) Put the betting API behind Cloudflare

1. Create `api.yourdomain.com` in Cloudflare DNS and point it to the keeper Railway target.
2. Enable Cloudflare proxy (orange cloud) for `api.yourdomain.com`.
3. Add WAF rate-limit rules:
- `POST /api/arena/bet/record-external`
- `POST /api/arena/deposit/ingest`
- `/api/arena/points/*`
4. Keep the direct Railway URL private if you introduce a public API domain.

## 4) Deploy betting frontend to Cloudflare Pages

Project root:

- `packages/gold-betting-demo/app`

Build/output:

- Build command: `bun install && bun run build --mode mainnet-beta`
- Output directory: `dist`

Frontend env vars (Cloudflare Pages):

- `VITE_GAME_API_URL=https://api.yourdomain.com`
- `VITE_GAME_WS_URL=wss://api.yourdomain.com/ws` if the keeper exposes websocket features you use
- `VITE_SOLANA_CLUSTER=mainnet-beta` (or testnet/devnet)
- `VITE_USE_GAME_RPC_PROXY=true`
- `VITE_USE_GAME_EVM_RPC_PROXY=true`
- `VITE_BSC_GOLD_CLOB_ADDRESS` / `VITE_BASE_GOLD_CLOB_ADDRESS`
- `VITE_BSC_GOLD_TOKEN_ADDRESS` / `VITE_BASE_GOLD_TOKEN_ADDRESS`
- `VITE_STREAM_SOURCES=https://your-hls-or-embed-source,...`

Do not set provider-keyed values in any `VITE_*RPC_URL` variable for production builds. The betting app build fails intentionally if a public RPC URL looks like a Helius / Alchemy / Infura / QuickNode / dRPC secret endpoint.

Cloudflare Pages headers/SPA rules are already added in:

- `packages/gold-betting-demo/app/public/_headers`
- `packages/gold-betting-demo/app/public/_redirects`

Deployment metadata:

- `build-info.json` is emitted into `dist/` on every build and should be served with `Cache-Control: no-store`.

## 5) Verify production

Health:

- `https://api.yourdomain.com/status`
- `https://bet.yourdomain.com`
- `https://api.yourdomain.com/api/streaming/state`
- `https://api.yourdomain.com/api/streaming/duel-context`
- `https://api.yourdomain.com/api/perps/markets`
- `https://api.yourdomain.com/api/proxy/evm/rpc?chain=bsc` (POST JSON-RPC smoke test)
- `https://bet.yourdomain.com/build-info.json`

End-to-end checks from repo root:

```bash
bun run duel:verify --server-url=https://your-stream-source.example --betting-url=https://bet.yourdomain.com --require-destinations=youtube
```

## 6) Security notes

- Do not expose `ARENA_EXTERNAL_BET_WRITE_KEY` in public frontend env vars.
- Do not ship provider-keyed RPC URLs in public frontend env vars. Keep them on Railway and let the keeper proxy them.
- Rotate all secrets before production if they were ever committed/shared.
- Keep `DISABLE_RATE_LIMIT` unset in production.

## CI/CD Workflows

### Betting CI (`betting-ci.yml`)

Runs on every push to betting stack packages:

- Type checking (TypeScript)
- Linting (ESLint)
- Unit tests (Vitest)
- Keeper smoke test (verifies keeper boots and serves health endpoint)
- Environment sanitization (checks for leaked secrets in env files)
- Production build verification (ensures build succeeds with production config)

### Keeper Deployment (`deploy-betting-keeper.yml`)

Automated deployment workflow:

1. Run full test suite
2. Keeper smoke test (verify service boots)
3. Deploy to Railway via `railway up`
4. Endpoint verification (health check on deployed service)

**Recent Improvements** (commits 46cd28e, 66a7b23):
- Removed Railway status probe for improved reliability
- Simplified deployment flow (removed redundant health checks)

### Pages Deployment (`deploy-betting-pages.yml`)

Automated frontend deployment:

1. Build production bundle (`--mode mainnet-beta`)
2. Dist hygiene checks (verify no leaked secrets in build output)
3. Deploy to Cloudflare Pages
4. Verify `build-info.json` is accessible

## Security Hardening

**Build-Time Secret Detection** (commit 43911165):

The build process fails if provider-keyed RPC URLs are detected in public environment variables:

- Helius (`helius-rpc.com`)
- Alchemy (`alchemy.com`)
- Infura (`infura.io`)
- QuickNode (`quiknode.pro`)
- dRPC (`drpc.org`)

**Solution**: Use RPC proxying through the keeper API instead of exposing provider URLs in frontend builds.

**RPC Proxying**:

Frontend makes requests to:
- `https://api.yourdomain.com/api/proxy/solana/rpc` (Solana)
- `https://api.yourdomain.com/api/proxy/evm/rpc?chain=bsc` (EVM)

Keeper proxies to provider-keyed RPC URLs configured server-side.

**CI Secret Scanning**:

CI scans for leaked secrets in:
- Environment files (`.env`, `.env.example`, `.env.mainnet`, etc.)
- Production build output (`dist/`)
- Fails build if secrets detected

## Deployment Process Improvements

**Keeper Workflow Stabilization** (commits 46cd28e, 66a7b23):

- Removed Railway status probe (was causing false failures)
- Simplified health check flow
- Improved deployment reliability

**Noble ed25519 Import Alignment** (commit abefb258):

- Fixed Solana compatibility issues with noble ed25519 imports
- Ensures consistent cryptographic library usage across betting stack

**CI Polyfill Shims** (commit bb8ec820):

- Added polyfill shims for betting stack tests in CI
- Prevents test failures in headless environments

## Troubleshooting

**Keeper fails to deploy:**

Check Railway logs for:
- Missing environment variables (SOLANA_RPC_URL, BSC_RPC_URL, etc.)
- Database connection errors
- Port binding issues

**Frontend build fails with "Leaked secret detected":**

Remove provider-keyed RPC URLs from `VITE_*` environment variables. Use RPC proxying instead:

```bash
# ❌ Don't do this
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...

# ✅ Do this instead
VITE_USE_GAME_RPC_PROXY=true
# Keep provider URL on Railway keeper:
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

**Keeper returns fallback duel data:**

Verify `STREAM_STATE_SOURCE_URL` is set and the upstream duel server is responding:

```bash
curl https://your-stream-source.example/api/streaming/state
```

**Points/referrals not persisting:**

Keeper uses ephemeral SQLite by default on Railway. For persistence:

1. Attach Railway persistent volume and set `KEEPER_DB_PATH=/mnt/data/keeper.sqlite`
2. Or migrate to external database (PostgreSQL, MySQL, etc.)
