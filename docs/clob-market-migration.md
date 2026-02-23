# CLOB Market Program Migration

## Overview

The betting system has been migrated from a binary market program to a CLOB (Central Limit Order Book) market program for Solana mainnet deployment (commits dba3e03, 35c14f9).

## Changes

### Program Addresses (Mainnet)

**Fight Oracle:**
- Program ID: `Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1`
- Location: `packages/gold-betting-demo/anchor/programs/fight_oracle/src/lib.rs`

**GOLD CLOB Market:**
- Program ID: Updated to mainnet address
- Location: `packages/gold-betting-demo/anchor/programs/gold_clob_market/src/lib.rs`
- Replaces: `gold_binary_market` program (deprecated)

**GOLD Token:**
- Mint: `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`
- Token Program: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
- Associated Token Program: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`

### IDL Updates

**Updated Files:**
- `packages/gold-betting-demo/keeper/src/idl/fight_oracle.json` - Mainnet program ID
- `packages/gold-betting-demo/app/src/idl/fight_oracle.json` - Mainnet program ID
- `packages/gold-betting-demo/app/src/idl/gold_clob_market.json` - New CLOB market IDL
- Removed: `gold_binary_market.json` (deprecated)

### Bot Rewrite

**Location**: `packages/gold-betting-demo/keeper/src/bot.ts`

**Old Instructions (Binary Market):**
- `initializeMarket`
- `seedMarket`
- `createVault`
- `placeBet`
- `resolveMarket`

**New Instructions (CLOB Market):**
- `initializeConfig` - Initialize global market configuration
- `initializeMatch` - Create a new duel match
- `initializeOrderBook` - Create order book for a match
- `placeBuyOrder` - Place buy order (bet on fighter A)
- `placeSellOrder` - Place sell order (bet on fighter B)
- `resolveMatch` - Resolve match outcome and settle orders

**Key Differences:**
- CLOB uses order book matching instead of binary yes/no pools
- Supports limit orders with price discovery
- More complex settlement logic (match buyers/sellers)
- No vault seeding required (liquidity provided by market makers)

### Server Configuration

**Location**: `packages/server/src/arena/config.ts`

**Fallback Program IDs:**
```typescript
// Updated to mainnet fight oracle
export const DEFAULT_FIGHT_ORACLE_PROGRAM_ID = 
  "Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1";
```

### Keeper Common

**Location**: `packages/gold-betting-demo/keeper/src/common.ts`

**Fallback Program IDs:**
```typescript
// Updated to mainnet program IDs
export const FIGHT_ORACLE_PROGRAM_ID = 
  process.env.SOLANA_FIGHT_ORACLE_PROGRAM_ID || 
  "Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1";

export const GOLD_CLOB_MARKET_PROGRAM_ID = 
  process.env.SOLANA_ARENA_MARKET_PROGRAM_ID || 
  "GCLoBfbkz8Z4xz3yzs9gpump"; // Example mainnet address
```

### Frontend Configuration

**Location**: `packages/gold-betting-demo/app/.env.mainnet`

**Updated Variables:**
```bash
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
VITE_FIGHT_ORACLE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
VITE_GOLD_CLOB_MARKET_PROGRAM_ID=<mainnet-clob-program-id>
VITE_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

## Migration Guide

### For Developers

**1. Update Environment Variables:**

```bash
# packages/server/.env
SOLANA_ARENA_MARKET_PROGRAM_ID=<mainnet-clob-program-id>
SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
```

**2. Update Keeper Bot:**

The keeper bot now uses CLOB instructions:
```typescript
// Old (binary market)
await program.methods.seedMarket(amount).rpc();

// New (CLOB market)
await program.methods.initializeConfig(feeConfig).rpc();
await program.methods.initializeMatch(matchId).rpc();
await program.methods.initializeOrderBook(matchId).rpc();
```

**3. Update Frontend:**

Replace binary market IDL imports:
```typescript
// Old
import binaryMarketIdl from "./idl/gold_binary_market.json";

// New
import clobMarketIdl from "./idl/gold_clob_market.json";
```

**4. Remove Binary Market Code:**

- Delete `gold_binary_market` program references
- Remove vault seeding logic
- Update PDA derivations for CLOB accounts

### For Operators

**1. Deploy CLOB Program:**

```bash
cd packages/gold-betting-demo/anchor
anchor build
anchor deploy --provider.cluster mainnet
```

**2. Initialize Configuration:**

```bash
# Run keeper bot to initialize config
cd packages/gold-betting-demo/keeper
bun run src/bot.ts
```

**3. Update Environment:**

Set mainnet program IDs in production environment variables.

**4. Verify Deployment:**

```bash
# Check program deployment
solana program show <program-id> --url mainnet-beta

# Verify config account
solana account <config-pda> --url mainnet-beta
```

## CLOB Market Architecture

### Account Structure

```
Config Account (PDA)
├── authority: Pubkey
├── fee_bps: u16
└── paused: bool

Match Account (PDA)
├── match_id: String
├── fighter_a: Pubkey
├── fighter_b: Pubkey
├── start_time: i64
├── end_time: i64
├── winner: Option<u8>
└── resolved: bool

OrderBook Account (PDA)
├── match_id: String
├── buy_orders: Vec<Order>
├── sell_orders: Vec<Order>
└── total_volume: u64

Order
├── user: Pubkey
├── amount: u64
├── price: u64
├── filled: u64
└── timestamp: i64
```

### Instruction Flow

**1. Initialize Config** (one-time setup):
```rust
pub fn initialize_config(
  ctx: Context<InitializeConfig>,
  fee_bps: u16,
) -> Result<()>
```

**2. Initialize Match** (per duel):
```rust
pub fn initialize_match(
  ctx: Context<InitializeMatch>,
  match_id: String,
  fighter_a: Pubkey,
  fighter_b: Pubkey,
  start_time: i64,
  end_time: i64,
) -> Result<()>
```

**3. Initialize Order Book** (per match):
```rust
pub fn initialize_order_book(
  ctx: Context<InitializeOrderBook>,
  match_id: String,
) -> Result<()>
```

**4. Place Orders** (users):
```rust
pub fn place_buy_order(
  ctx: Context<PlaceBuyOrder>,
  match_id: String,
  amount: u64,
  price: u64,
) -> Result<()>

pub fn place_sell_order(
  ctx: Context<PlaceSellOrder>,
  match_id: String,
  amount: u64,
  price: u64,
) -> Result<()>
```

**5. Resolve Match** (keeper):
```rust
pub fn resolve_match(
  ctx: Context<ResolveMatch>,
  match_id: String,
  winner: u8, // 0 = fighter_a, 1 = fighter_b
) -> Result<()>
```

## Testing

**Local Testing:**
```bash
# Start local validator
solana-test-validator

# Deploy programs
cd packages/gold-betting-demo/anchor
anchor build
anchor deploy --provider.cluster localnet

# Run tests
anchor test --skip-local-validator
```

**Integration Tests:**
```bash
cd packages/gold-betting-demo/anchor
bun test
```

**E2E Tests:**
```bash
cd packages/gold-betting-demo/app
bun run test:e2e:local   # Local validator
bun run test:e2e:public  # Devnet/mainnet
```

## Troubleshooting

**Program deployment fails:**
- Ensure you have enough SOL for deployment (~5 SOL)
- Check program size: `ls -lh target/deploy/*.so`
- Verify keypair: `solana address --keypair <keypair-path>`

**Order matching fails:**
- Check order book account exists
- Verify match is not resolved
- Ensure sufficient token balance
- Check price/amount validity

**Keeper bot errors:**
- Verify authority keypair is set: `SOLANA_ARENA_AUTHORITY_SECRET`
- Check RPC endpoint is responsive
- Ensure program accounts are initialized

## References

- **Commits**: dba3e03, 35c14f9
- **Author**: lalalune (Shaw)
- **Date**: Feb 22, 2026
- **Files Changed**:
  - `packages/gold-betting-demo/anchor/programs/fight_oracle/src/lib.rs`
  - `packages/gold-betting-demo/anchor/programs/gold_clob_market/src/lib.rs`
  - `packages/gold-betting-demo/keeper/src/bot.ts`
  - `packages/gold-betting-demo/keeper/src/common.ts`
  - `packages/gold-betting-demo/app/src/idl/fight_oracle.json`
  - `packages/gold-betting-demo/app/src/idl/gold_clob_market.json`
  - `packages/server/src/arena/config.ts`
  - `packages/gold-betting-demo/app/.env.mainnet`
