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
- `STREAM_PUBLISH_KEY` - Streaming state push endpoint auth
- `SOLANA_CLUSTER=mainnet-beta` - Solana cluster
- `SOLANA_RPC_URL` - Solana RPC endpoint (keep provider keys here, not in frontend)
- `BSC_RPC_URL` / `BASE_RPC_URL` - EVM RPC endpoints (keep provider keys server-side)
- `KEEPER_DB_PATH=./keeper.sqlite` - Database path (ephemeral on Railway without volume)
- `ENABLE_KEEPER_BOT=true` - Enable autonomous market making
- `ENABLE_PERPS_ORACLE=false` - Enable perps oracle updates (requires deployed program)
- `ENABLE_PERPS_LIQUIDATOR=false` - Enable perps liquidations

**RPC Proxying:**

The keeper proxies Solana and EVM JSON-RPC for the public app:
- `/api/proxy/solana/rpc` - Solana RPC proxy
- `/api/proxy/evm/rpc?chain=bsc` - EVM RPC proxy (BSC)
- `/api/proxy/evm/rpc?chain=base` - EVM RPC proxy (Base)

**Benefits:**
- Keeps provider API keys server-side (not exposed in frontend builds)
- Prevents accidental credential leaks in public builds
- Centralized rate limiting and monitoring

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
- Fee routing to treasury and market maker (trade fees + claim fees)
- Perps market lifecycle (ACTIVE → CLOSE_ONLY → ARCHIVED)
- Perps market reactivation (ARCHIVED → ACTIVE)
- Slippage protection (acceptable_price parameter)
- Insurance fund management
- Fee recycling (market maker fees → isolated insurance)
- Fee withdrawal (treasury and market maker fee balances)
- Reduce-only logic (CLOSE_ONLY mode)

**CLOB fee routing test** (commits 43911165, 8322b3f):

New comprehensive test validates fee routing through full lifecycle:

```typescript
// Test validates:
// 1. Trade fees split between treasury and market maker
// 2. Claim fees route to market maker
// 3. Fee balances accumulate correctly
// 4. Fees are transferred to correct accounts
```

**Perps fee management tests** (commits 43911165, 8322b3f):

New tests validate fee operations:

```typescript
// recycle_market_maker_fees test
// - Verifies market maker fees can be recycled into insurance
// - Validates fee balance accounting

// withdraw_fee_balance test
// - Verifies treasury can withdraw treasury fees
// - Verifies market maker can withdraw market maker fees
// - Validates recipient address matches configured authority
```

**Rust verification**:
```bash
bun run lint:rust
bun run test:rust
bun run audit
bun run audit:strict
```

Note: `bun run audit` ignores `RUSTSEC-2025-0141` for `bincode` (unmaintained upstream dependency in Anchor/Solana stack).

**Test helper improvements** (commits 43911165, 8322b3f):

New test helpers for perps market testing:

```typescript
// Market ID encoding (u32 → u64)
export function marketIdBn(marketId: number): anchor.BN {
  return new anchor.BN(String(marketId));
}

// Trade fee calculation
export function tradeFeeLamports(sizeDeltaLamports: number): number {
  return Math.floor(
    (Math.abs(sizeDeltaLamports) * TOTAL_TRADE_FEE_BPS) / 10_000,
  );
}

// Market status constants
export const PERPS_STATUS_ACTIVE = 0;
export const PERPS_STATUS_CLOSE_ONLY = 1;
export const PERPS_STATUS_ARCHIVED = 2;
```

**PDA derivation updates:**

```typescript
// Market PDA (8-byte market ID, was 4-byte)
export function marketPda(programId: PublicKey, marketId: number): PublicKey {
  const marketIdBytes = Buffer.alloc(8);
  marketIdBytes.writeBigUInt64LE(BigInt(marketId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketIdBytes],
    programId,
  )[0];
}

// Position PDA (8-byte market ID, was 4-byte)
export function positionPda(
  programId: PublicKey,
  trader: PublicKey,
  marketId: number,
): PublicKey {
  const marketIdBytes = Buffer.alloc(8);
  marketIdBytes.writeBigUInt64LE(BigInt(marketId), 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), trader.toBuffer(), marketIdBytes],
    programId,
  )[0];
}
```

**Impact**: Tests correctly handle u64 market IDs and validate fee accounting.

**CLOB test improvements** (commit 43911165):

New comprehensive fee routing test validates full lifecycle:

```typescript
// Test flow:
// 1. Initialize config with treasury and market maker addresses
// 2. Create oracle match
// 3. Initialize CLOB match state
// 4. Place maker order (NO side)
// 5. Place taker order (YES side) - matches maker order
// 6. Verify trade fees routed to treasury and market maker
// 7. Resolve match (YES wins)
// 8. Claim winnings
// 9. Verify claim fees routed to market maker

// Fee validation
assert.strictEqual(treasuryAfterTrades - treasuryBefore, 10_000);
assert.strictEqual(marketMakerAfterTrades - marketMakerBefore, 10_000);
assert.strictEqual(marketMakerAfterClaim - marketMakerAfterTrades, 20_000);
```

**New test helpers:**

```typescript
// Derive user balance PDA
function deriveUserBalancePda(
  programId: PublicKey,
  matchState: PublicKey,
  user: PublicKey,
): PublicKey

// Derive order PDA
function deriveOrderPda(
  programId: PublicKey,
  matchState: PublicKey,
  user: PublicKey,
  orderId: anchor.BN,
): PublicKey

// Airdrop helper
async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol = 2,
)
```

**Impact**: Comprehensive validation of fee routing through full CLOB lifecycle.

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
- Keeper API integration (points, leaderboard, referrals, perps markets)
- Tab navigation and UI state management
- Wallet connection and authentication flows

**E2E infrastructure improvements** (commit 43911165):
- Keeper API seeding via `setup-api-local.ts` and `seed-api-local.ts`
- Custom EVM chain ID support (works with Anvil's default 31337)
- Keeper database initialization for local testing
- Comprehensive tab and API endpoint testing

**Test data attributes** (commit 43911165):

Added `data-testid` attributes throughout the betting app for reliable E2E testing:

```typescript
// Points display
data-testid="points-display"
data-testid="points-display-total"
data-testid="points-display-rank"
data-testid="points-display-gold"
data-testid="points-display-tier"
data-testid="points-display-boost"

// Points drawer
data-testid="points-drawer-overlay"
data-testid="points-drawer"
data-testid="points-drawer-close"
data-testid="points-drawer-tab-leaderboard"
data-testid="points-drawer-tab-history"
data-testid="points-drawer-tab-referral"

// Referral panel
data-testid="referral-panel"
data-testid="referral-panel-invite-code"
data-testid="referral-panel-redeem-input"
data-testid="referral-panel-redeem-button"
data-testid="referral-panel-link-wallets"

// Duels bottom tabs
data-testid="duels-bottom-tab-trades"
data-testid="duels-bottom-panel-trades"
data-testid="duels-bottom-panel-orders"
data-testid="duels-bottom-panel-topTraders"
```

**Impact**: Enables robust Playwright tests without brittle CSS selectors.

**Perps Market UI Improvements** (commits 43911165, 8322b3f, 1043f0a):

The Models Market View now displays market status and enforces lifecycle constraints:

```typescript
// Market status display
{selectedEntry.status === "ACTIVE"
  ? selectedOracleFresh
    ? `Rank #${selectedEntry.rank}`
    : "Oracle Stale"
  : selectedEntry.status === "CLOSE_ONLY"
    ? "Close Only"
    : "Archived"}

// Trading constraints
const selectedCanOpen = Boolean(selectedMarketActive && selectedOracleFresh);
const selectedCanClose = Boolean(
  selectedPosition &&
  ((selectedMarketActive && selectedOracleFresh) || selectedMarketCloseOnly),
);
```

**Status column in market table:**
- ACTIVE - Normal trading
- CLOSE ONLY - Reduce-only mode
- ARCHIVED - Market wound down

**Trading button states:**
- Open position: Disabled if market not ACTIVE or oracle stale
- Close position: Enabled if market ACTIVE (with fresh oracle) or CLOSE_ONLY

**Slippage protection:**
- Longs: `acceptable_price = quoted_price * 1.02` (2% slippage tolerance)
- Shorts: `acceptable_price = quoted_price * 0.98` (2% slippage tolerance)
- Passed to `modify_position` instruction

**Impact**: Users can safely close positions in deprecated markets without requiring live oracle updates.

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

## EVM Contract Development

### Typed Contract Helpers

The `../evm-contracts/typed-contracts.ts` module provides type-safe contract deployment and interaction helpers:

```typescript
import { deployGoldClob, deploySkillOracle, deployMockErc20 } from '../typed-contracts';

// Type-safe deployment with IntelliSense
const clob = await deployGoldClob(treasuryAddress, marketMakerAddress, signer);
const oracle = await deploySkillOracle(initialBasePrice, signer);

// Fully typed contract interfaces
const match: GoldClobMatch = await clob.matches(matchId);
const position: GoldClobPosition = await clob.positions(matchId, trader);
```

**Benefits:**
- Compile-time type checking for all contract interactions
- IntelliSense support in tests and scripts
- Prevents common errors (wrong parameter types, missing overrides)
- Consistent deployment patterns across test suites

**Contract interfaces:**
- `GoldClobContract` - CLOB market with typed methods
- `SkillOracleContract` - Oracle with typed skill updates
- `MockERC20Contract` - Test token with typed mint/approve
- `AgentPerpEngineContract` - Perps engine with typed position management
- `AgentPerpEngineNativeContract` - Native token perps engine

### Local Simulation

Run local EVM simulation with PnL reporting:

```bash
cd ../evm-contracts
bun run simulate:localnet
```

**Simulation scenarios:**
- Whale round trip (large position open/close)
- Funding rate drift
- Isolated insurance containment
- Positive equity liquidation
- Local insurance shortfall
- Fee recycling into isolated insurance
- Model deprecation lifecycle

**Output**: `simulations/gold-clob-localnet-report.json`

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

## Security Hardening

**Build-Time Secret Detection** (commit 43911165):

The betting app build fails if provider-keyed RPC URLs are detected in `VITE_*` environment variables:

- Helius (`helius-rpc.com`)
- Alchemy (`alchemy.com`)
- Infura (`infura.io`)
- QuickNode (`quiknode.pro`)
- dRPC (`drpc.org`)

**Solution**: Use RPC proxying through the keeper API:

```bash
# ❌ Don't do this (build will fail)
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...

# ✅ Do this instead
VITE_USE_GAME_RPC_PROXY=true
# Keep provider URL on Railway keeper (server-side):
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

**CI Secret Scanning:**

CI workflows scan for leaked secrets in:
- Environment files (`.env`, `.env.example`, `.env.mainnet`, etc.)
- Production build output (`dist/`)
- Fails build if secrets detected

**Credential Rotation:**

If API keys were previously committed to git history, they must be rotated out-of-band even after removal from tracked files. Git history preserves all previous commits.

## Environment Files

**Prepared configurations**:
- `.env.mainnet` - Mainnet-beta configuration (public template only)
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

## Perps Market Lifecycle

**Market States:**

- **ACTIVE**: Normal trading with live oracle updates
  - New positions allowed
  - Position increases/decreases allowed
  - Requires fresh oracle updates
  - Funding rate drifts based on market skew

- **CLOSE_ONLY**: Model deprecated, reduce-only mode
  - New positions blocked
  - Position increases blocked
  - Position reductions and closes allowed
  - Settlement price frozen (no oracle updates required)
  - Funding rate frozen

- **ARCHIVED**: Market fully wound down
  - All trading blocked
  - Requires zero open interest and zero open positions
  - Can be reactivated to ACTIVE if model returns

**Fee Management:**

- Trade fees split between treasury and market maker (configurable BPS)
- Claim fees route to market maker
- Market maker can recycle fees into isolated insurance reserves via `recycle_market_maker_fees`
- Treasury and market maker can withdraw fee balances via `withdraw_fee_balance`
- Fee balances reserved from free liquidity calculations

**Slippage Protection:**

The `modify_position` instruction accepts an `acceptable_price` parameter:
- Longs: execution price must be ≤ acceptable price
- Shorts: execution price must be ≥ acceptable price
- Set to 0 to disable slippage check

## Notes

- App auto-discovers and displays current market + last resolved result with continuous refresh
- App place-bet path auto-creates market when none exists (requires oracle authority wallet)
- Recommended production mode: run `keeper:bot` for autonomous market management
- Market setup inputs removed from UI for streamlined demo path
- App localnet mode uses direct GOLD (no SOL/USDC conversion)
- Jupiter conversion path wired for mainnet
- Anchor build uses vendored `zmij` patch in `anchor/vendor/zmij` for toolchain compatibility
- Market ID type changed from `u32` to `u64` (breaking change for PDA derivation)
- Account sizes increased for new fee tracking fields (requires fresh deployment)
