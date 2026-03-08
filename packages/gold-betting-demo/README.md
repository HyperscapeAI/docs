# GOLD Betting Stack (Solana + EVM)

Full-stack betting system for AI agent duels with dual-chain support (Solana + EVM).

## What this includes

- **`anchor/`**: Solana smart contracts (Anchor framework)
  - `programs/fight_oracle`: On-chain match lifecycle and winner posting
  - `programs/gold_clob_market`: CLOB (Central Limit Order Book) for duel outcome betting
  - `programs/gold_perps_market`: Perpetual futures market for agent skill ratings
- **`app/`**: React betting UI (Vite + Solana/EVM wallet integration)
  - Dual-chain betting interface
  - Points system with staking multipliers
  - Referral tracking
  - Leaderboards
- **`keeper/`**: Backend API service (Fastify + SQLite/PostgreSQL)
  - Bet recording and validation
  - Market making automation
  - Oracle resolution
  - RPC proxying (keeps provider keys server-side)
  - Points and referral management
- **`../evm-contracts/`**: EVM smart contracts (Hardhat + Foundry)
  - `GoldClob.sol`: CLOB market for BSC/Base
  - `AgentPerpEngine.sol`: Perpetual futures for EVM chains
- **`../sim-engine/`**: Cross-chain risk simulation and attack fuzzing

## Core Behavior

- **Betting Window**: Created on oracle match creation (300s default)
- **Market Maker**: Seeds equal liquidity on both sides after 10s if no user bets exist
- **Trading Fees**: Collected on every bet, routed to treasury and market maker
- **Fee Recycling**: Market maker can recycle fees into new round liquidity
- **Oracle Separation**: Oracle and betting are separate programs for trustless resolution
- **Dual-Chain**: Unified GOLD token on Solana + EVM (BSC/Base)
- **Payouts**: Settled in GOLD tokens
- **Conversion**: SOL/USDC → GOLD via Jupiter (Solana) or DEX (EVM)

## Programs

**Solana (Mainnet-Beta)**:
- Fight oracle: `6tpRysBFd1yXRipYEYwAw9jxEoVHk15kVXfkDGFLMqcD`
- CLOB market: `ARVJNJp49VZnkB8QBYZAAFJmufvtVSPhnuuenwwSLwpi`
- Perps market: `HbXhqEFevpkfYdZCN6YmJGRmQmj9vsBun2ZHjeeaLRik`
- GOLD mint: `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`

**EVM (BSC Testnet / Base Sepolia)**:
- See `../evm-contracts/deployments/` for deployed contract addresses
- See `deployments/contracts.json` for centralized deployment metadata

**Deployment Metadata**:

All contract addresses and program IDs are managed in a single source of truth:
- `deployments/contracts.json` - Shared deployment manifest
- `deployments/index.ts` - Typed configuration with runtime validation

This manifest is used by:
- Frontend app defaults
- Keeper API defaults
- Local development scripts
- EVM deploy receipt syncing
- Preflight validation checks

## Quick Start

### Local Development (Full Stack)

From `packages/gold-betting-demo`:

```bash
bun install
bun run dev
```

This boots the complete local demo stack:
- Builds Anchor programs
- Starts `solana-test-validator` with oracle + market programs preloaded
- Starts local Anvil for EVM testing
- Seeds local mock GOLD + active market state
- Starts Vite app on `http://127.0.0.1:4179`
- Starts keeper API on `http://127.0.0.1:5555`

### Keeper Service (Production)

The keeper is a standalone Fastify service that provides:
- Betting API endpoints for the frontend
- Market making automation
- Oracle resolution
- RPC proxying (Solana + EVM)
- Points and referral tracking

**Start keeper service**:
```bash
cd keeper
bun install
bun run service
```

**Environment variables** (see `keeper/.env.example`):
- `PORT=8080` - Service port
- `STREAM_STATE_SOURCE_URL` - Upstream duel server URL
- `STREAM_STATE_SOURCE_BEARER_TOKEN` - Auth token for upstream
- `ARENA_EXTERNAL_BET_WRITE_KEY` - Server-to-server auth
- `SOLANA_CLUSTER=mainnet-beta` - Solana cluster
- `SOLANA_RPC_URL` - Solana RPC endpoint (keep provider keys here, not in frontend)
- `BSC_RPC_URL` / `BASE_RPC_URL` - EVM RPC endpoints
- `KEEPER_DB_PATH=./keeper.sqlite` - Database path (ephemeral on Railway without volume)
- `ENABLE_KEEPER_BOT=true` - Enable autonomous market making

**Deployment**: See `docs/betting-production-deploy.md` for Railway + Cloudflare Pages deployment guide.

## Local E2E Tests (Anchor + Mock GOLD)

From `packages/gold-betting-demo/anchor`:

```bash
bun install
bun run build
bun run test
```

Tests use a manual `solana-test-validator` harness (not `anchor test`) for operational stability.

**Passing tests**:
- Market-maker auto seed after 10 seconds when market is empty
- Oracle resolve + winner claim payout flow
- Fee routing to treasury and market maker
- Perps market lifecycle (ACTIVE → CLOSE_ONLY → ARCHIVED)
- Slippage protection
- Insurance fund management

**Rust verification**:
```bash
bun run lint:rust
bun run test:rust
bun run audit
bun run audit:strict
```

Note: `bun run audit` ignores `RUSTSEC-2025-0141` for `bincode` (unmaintained upstream dependency in Anchor/Solana stack).

## UI E2E Tests

### Local (Headless Wallet + Mock GOLD)

From `packages/gold-betting-demo/app`:

```bash
bun run test:e2e
```

This command:
- Builds Anchor programs and EVM contracts
- Starts local validator with demo programs preloaded
- Starts local Anvil (chain id 31337) for EVM
- Seeds deterministic mock GOLD mint + test wallet
- Deploys local `MockERC20` + `GoldClob`, seeds open EVM match
- Runs Playwright headless tests exercising Solana + EVM UI actions
- Verifies transactions on-chain (Solana signatures + EVM receipts)

**Test coverage**:
- Solana: refresh, seed-liquidity, place bet, resolve, claim, start new round
- EVM: refresh, place order, resolve match, claim, create match
- Chain-level validation for both Solana and EVM transactions

### Public Clusters (Testnet/Mainnet)

```bash
bun run test:e2e:testnet
bun run test:e2e:mainnet
```

**Public E2E behavior**:
- Loads keypair from `E2E_HEADLESS_KEYPAIR_PATH` (default: `~/.config/solana/id.json`) or `E2E_HEADLESS_WALLET_SECRET_KEY`
- Verifies oracle + market programs are deployed and executable
- Initializes oracle config (if needed)
- Creates one resolved market (for "last result") and one open market (for bet flow)
- Writes `/app/.env.e2e` for Vite headless wallet auto-connect
- Runs Playwright against live app in headless mode

**Useful env vars**:
- `E2E_CLUSTER`: `testnet` or `mainnet-beta`
- `E2E_HEADLESS_KEYPAIR_PATH`: Wallet keypair path
- `E2E_RPC_URL`: Override RPC endpoint
- `E2E_TESTNET_GOLD_MINT`: Optional existing testnet GOLD-like mint
- `E2E_DEPLOY_TESTNET_PROGRAMS=true`: One-time deploy before testnet E2E

**Balance notes**:
- Mainnet E2E uses real GOLD mint `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`
- If wallet has no GOLD, test uses SOL (swap-to-GOLD path)
- Seed-liquidity requires pre-funded GOLD balance
- Testnet deploy needs ~4 SOL for program deploys

## Run the Vite App

### Local Mode (with validator)
```bash
bun run dev
```

### App-Only (no validator bootstrap)
```bash
bun run dev:app-local
```

### Mainnet Mode
```bash
bun run dev:mainnet
```

### Testnet Mode
```bash
bun run dev:testnet
```

### Build
```bash
bun run build              # Default (localnet)
bun run build:testnet      # Testnet
bun run build:mainnet      # Mainnet-beta
```

## Keeper Scripts

From `packages/gold-betting-demo/keeper`:

### Seed Liquidity
```bash
HELIUS_API_KEY=... \
MARKET_MAKER_KEYPAIR=~/.config/solana/id.json \
bun run seed -- --match-id 123456 --seed-gold 1
```

### Resolve from Oracle
```bash
HELIUS_API_KEY=... \
ORACLE_AUTHORITY_KEYPAIR=~/.config/solana/id.json \
bun run resolve -- --match-id 123456
```

### Run Autonomous Market Bot
```bash
HELIUS_API_KEY=... \
ORACLE_AUTHORITY_KEYPAIR=~/.config/solana/id.json \
MARKET_MAKER_KEYPAIR=~/.config/solana/id.json \
GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump \
BET_FEE_BPS=100 \
BOT_LOOP=true \
bun run keeper:bot
```

### Cluster-Aware Bot Commands
```bash
bun run keeper:bot:mainnet
bun run keeper:bot:testnet
bun run keeper:bot:once
```

**Bot behavior**:
- Ensures oracle + market config are initialized
- Creates new market when no bettable market exists
- Posts oracle result after close and resolves open market
- Auto-seeds empty markets after delay using market-maker wallet balance (including collected fees)

## Environment Files

**Prepared configurations**:
- `.env.mainnet` - Mainnet-beta configuration
- `.env.testnet` - Testnet configuration
- `.env.example` - Template for local development
- `app/.env.mainnet` - Frontend mainnet configuration
- `app/.env.testnet` - Frontend testnet configuration
- `app/.env.example` - Frontend template
- `keeper/.env.example` - Keeper service template

**Security Note**: Provider API keys (Helius, Birdeye) should be kept in Railway/secret managers, not committed to the repository. The tracked `.env.mainnet` file is a public template only.

## Production Deployment

### Preflight Validation

Before deploying to any network, run preflight checks to validate deployment metadata:

```bash
bun run deploy:preflight:testnet    # Validate testnet deployment
bun run deploy:preflight:mainnet    # Validate mainnet deployment
```

**Validation checks:**
- Solana program keypairs match deployment manifest
- Anchor IDL files match deployment manifest
- App and keeper IDL files are in sync with Anchor build output
- EVM deployment environment variables are configured
- EVM RPC URLs are available (configured or using Hardhat fallbacks)
- Contract addresses are present in deployment manifest

### Deploy Solana Programs

Deploy all three Solana betting programs using the checked-in program keypairs:

```bash
cd anchor
bun run deploy:testnet      # Deploy to Solana testnet
bun run deploy:mainnet      # Deploy to Solana mainnet-beta
```

**Programs deployed:**
- `fight_oracle` - Match lifecycle and winner posting
- `gold_clob_market` - GOLD CLOB market for binary prediction trading
- `gold_perps_market` - Perpetual futures market for agent skill ratings

**Requirements:**
- Solana CLI installed
- Deployer wallet with ~4+ SOL for all three programs

### Deploy EVM Contracts

Deploy GoldClob contracts to EVM networks:

```bash
cd ../evm-contracts

# Testnet
bun run deploy:bsc-testnet
bun run deploy:base-sepolia

# Mainnet (requires explicit treasury/market maker addresses)
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Deployment process:**
1. Validates treasury and market maker addresses
2. Deploys GoldClob contract
3. Writes deployment receipt to `deployments/<network>.json`
4. Updates central manifest at `../gold-betting-demo/deployments/contracts.json`

### Full Deployment Guide

See `docs/betting-production-deploy.md` for complete deployment guide covering:
- Keeper deployment to Railway
- Frontend deployment to Cloudflare Pages
- Cloudflare WAF configuration
- Environment variable setup
- Security best practices
- Perps market lifecycle management

**Architecture**:
- Frontend: Cloudflare Pages (static hosting)
- Keeper: Railway (backend API + market making)
- Duel Server: Railway or Vast.ai (upstream stream source)
- Contracts: Solana mainnet-beta, BSC, Base

## CI/CD Workflows

### Betting CI (`betting-ci.yml`)

Runs on every push to betting stack packages:

**Validation steps:**
- Type checking (TypeScript)
- Linting (ESLint)
- Unit tests (Vitest)
- Keeper smoke test (verifies keeper boots and serves health endpoint)
- Environment sanitization (checks for leaked secrets in env files)
- Production build verification (ensures build succeeds with production config)
- Dist hygiene checks (no source maps, no leaked API keys in build output)

**Secret leak detection:**
- Scans tracked env files for provider API keys (Helius, Birdeye)
- Scans production dist for `api-key=` patterns
- Fails build if secrets detected

### Keeper Deployment (`deploy-betting-keeper.yml`)

Automated deployment workflow:

1. Run full test suite
2. Keeper smoke test (verify service boots)
3. Deploy to Railway via `railway up`
4. Endpoint verification (health check on deployed service)

**Endpoints verified:**
- `/status` - Service health
- `/api/streaming/duel-context` - Duel context API
- `/api/streaming/leaderboard/details` - Leaderboard API
- `/api/perps/markets` - Perps markets API

**Recent improvements** (commits 46cd28e, 66a7b23, a4e366c):
- Removed Railway status probe for improved reliability
- Persist Railway user token for authentication
- Simplified deployment flow with direct HTTP health checks

### Pages Deployment (`deploy-betting-pages.yml`)

Automated frontend deployment:

1. Build production bundle (`--mode mainnet-beta`)
2. Dist hygiene checks (verify no leaked secrets in build output)
3. Deploy to Cloudflare Pages
4. Verify `build-info.json` is accessible and matches commit SHA

**Build-time secret detection:**
- Fails build if `VITE_*RPC_URL` contains provider-keyed URLs
- Prevents accidental exposure of Helius, Alchemy, Infura, QuickNode, or dRPC keys
- Enforces RPC proxying through keeper API

## Notes

- App auto-discovers and displays current market + last resolved result with continuous refresh
- App place-bet path auto-creates market when none exists (requires oracle authority wallet)
- Recommended production mode: run `keeper:bot` for autonomous market management
- Market setup inputs removed from UI for streamlined demo path
- App localnet mode uses direct GOLD (no SOL/USDC conversion)
- Jupiter conversion path wired for mainnet
- Anchor build uses vendored `zmij` patch in `anchor/vendor/zmij` for toolchain compatibility
