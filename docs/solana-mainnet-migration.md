# Solana Mainnet Migration Guide

## Overview

This guide documents the migration from binary market to CLOB (Central Limit Order Book) market program on Solana mainnet for Hyperscape's duel betting system.

**Migration Commits**:
- `dba3e03` / `35c14f9` - Adapt bot + IDLs for CLOB market program on mainnet
- `2c17000` - Merge CLOB bot + IDL fixes for mainnet

## Program Changes

### Mainnet Program IDs

**Fight Oracle** (unchanged):
```rust
// packages/gold-betting-demo/anchor/programs/fight_oracle/src/lib.rs
declare_id!("Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1");
```

**GOLD CLOB Market** (new):
```rust
// packages/gold-betting-demo/anchor/programs/gold_clob_market/src/lib.rs
declare_id!("GCLoBfbkz8Z4xz3yzs9gpump");  // Example mainnet address
```

**GOLD Token Mint**:
```
DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

### IDL Updates

All IDL files updated with mainnet program addresses:

**Files Updated**:
- `packages/gold-betting-demo/keeper/src/idl/fight_oracle.json`
- `packages/gold-betting-demo/keeper/src/idl/gold_binary_market.json` (deprecated)
- `packages/gold-betting-demo/app/src/idl/fight_oracle.json`
- `packages/gold-betting-demo/app/src/idl/gold_clob_market.json` (new)

**IDL Address Field**:
```json
{
  "address": "Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1",
  "metadata": {
    "name": "fight_oracle",
    "version": "0.1.0"
  }
}
```

## Bot Rewrite (Binary → CLOB)

### Binary Market Instructions (Removed)

```typescript
// OLD: Binary market seeding
await program.methods.initializeVault()
  .accounts({ ... })
  .rpc();

await program.methods.seedMarket(new BN(initialLiquidity))
  .accounts({ ... })
  .rpc();
```

### CLOB Market Instructions (New)

```typescript
// NEW: CLOB market initialization
await program.methods.initializeConfig(configParams)
  .accounts({ config, authority })
  .rpc();

await program.methods.initializeMatch(matchId)
  .accounts({ match, config, oracle, authority })
  .rpc();

await program.methods.initializeOrderBook(matchId)
  .accounts({ orderBook, match, authority })
  .rpc();

await program.methods.resolveMatch(winner)
  .accounts({ match, oracle, authority })
  .rpc();
```

### Keeper Bot Changes

**File**: `packages/gold-betting-demo/keeper/src/bot.ts`

**Removed**:
- Binary market vault logic
- Seeding/liquidity provision
- Binary outcome resolution

**Added**:
- CLOB config initialization
- Match + order book creation
- CLOB-specific resolution flow

## Server Configuration Updates

### Arena Config Fallback

**File**: `packages/server/src/arena/config.ts`

```typescript
// Updated fallback to mainnet fight oracle
export const DEFAULT_FIGHT_ORACLE_PROGRAM_ID = 
  "Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1";
```

### Keeper Common Fallbacks

**File**: `packages/gold-betting-demo/keeper/src/common.ts`

```typescript
// Updated fallback program IDs to mainnet
const FIGHT_ORACLE_PROGRAM_ID = 
  process.env.FIGHT_ORACLE_PROGRAM_ID || 
  "Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1";

const GOLD_CLOB_MARKET_PROGRAM_ID = 
  process.env.GOLD_CLOB_MARKET_PROGRAM_ID || 
  "GCLoBfbkz8Z4xz3yzs9gpump";
```

## Frontend Configuration

### Mainnet Environment File

**File**: `packages/gold-betting-demo/app/.env.mainnet`

All `VITE_*` variables updated for mainnet:

```bash
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
VITE_FIGHT_ORACLE_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
VITE_GOLD_CLOB_MARKET_PROGRAM_ID=GCLoBfbkz8Z4xz3yzs9gpump
VITE_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

## Migration Checklist

### Pre-Migration

- [ ] Deploy fight oracle program to mainnet
- [ ] Deploy CLOB market program to mainnet
- [ ] Update all IDL files with mainnet addresses
- [ ] Test CLOB instructions on devnet
- [ ] Verify keeper bot logic with CLOB flow

### Migration Steps

1. **Update Program IDs**:
   ```bash
   # Update declare_id! in Rust programs
   cd packages/gold-betting-demo/anchor/programs/fight_oracle
   # Edit src/lib.rs with mainnet address
   
   cd ../gold_clob_market
   # Edit src/lib.rs with mainnet address
   ```

2. **Rebuild Programs**:
   ```bash
   cd packages/gold-betting-demo/anchor
   anchor build
   ```

3. **Update IDLs**:
   ```bash
   # Copy generated IDLs to keeper and app
   cp target/idl/fight_oracle.json ../keeper/src/idl/
   cp target/idl/gold_clob_market.json ../keeper/src/idl/
   cp target/idl/fight_oracle.json ../app/src/idl/
   cp target/idl/gold_clob_market.json ../app/src/idl/
   ```

4. **Update Environment Files**:
   ```bash
   # Update .env.mainnet in app and keeper
   # Set all VITE_* and program ID variables
   ```

5. **Deploy Programs**:
   ```bash
   anchor deploy --provider.cluster mainnet
   ```

6. **Initialize On-Chain State**:
   ```bash
   # Run keeper bot to initialize config
   cd packages/gold-betting-demo/keeper
   bun run src/bot.ts
   ```

7. **Verify**:
   ```bash
   # Check on-chain accounts exist
   solana account <config-pubkey> --url mainnet-beta
   solana account <oracle-pubkey> --url mainnet-beta
   ```

### Post-Migration

- [ ] Monitor keeper bot logs for errors
- [ ] Verify first match creation succeeds
- [ ] Test order book initialization
- [ ] Confirm resolution flow works
- [ ] Update frontend to point to mainnet

## Breaking Changes

### Removed APIs

Binary market instructions no longer available:
- `initializeVault`
- `seedMarket`
- `placeBet` (replaced by CLOB order placement)
- `resolveBinaryMarket` (replaced by `resolveMatch`)

### New APIs

CLOB market instructions:
- `initializeConfig` - One-time config setup
- `initializeMatch` - Create new duel match
- `initializeOrderBook` - Create order book for match
- `placeOrder` - Place buy/sell order
- `cancelOrder` - Cancel existing order
- `resolveMatch` - Resolve match outcome
- `settleOrders` - Settle matched orders

## Testing

### Devnet Testing

```bash
# Use devnet environment
cd packages/gold-betting-demo/app
cp .env.devnet .env

# Start local validator (optional)
solana-test-validator

# Run keeper bot
cd ../keeper
bun run src/bot.ts
```

### Mainnet Testing

```bash
# Use mainnet environment
cd packages/gold-betting-demo/app
cp .env.mainnet .env

# Run keeper bot (with real SOL!)
cd ../keeper
bun run src/bot.ts
```

**⚠️ WARNING**: Mainnet operations use real SOL. Test thoroughly on devnet first.

## Rollback Plan

If mainnet migration fails:

1. **Revert Program IDs**:
   ```bash
   git revert dba3e03  # Revert CLOB changes
   ```

2. **Redeploy Binary Market**:
   ```bash
   cd packages/gold-betting-demo/anchor
   git checkout <previous-commit>
   anchor build
   anchor deploy --provider.cluster mainnet
   ```

3. **Update IDLs**:
   ```bash
   # Copy old binary market IDLs back
   ```

4. **Restart Keeper**:
   ```bash
   cd packages/gold-betting-demo/keeper
   bun run src/bot.ts
   ```

## Monitoring

### On-Chain Metrics

Monitor these accounts for health:
- Config account (global settings)
- Oracle account (fight outcomes)
- Match accounts (per-duel state)
- Order book accounts (CLOB state)

### Keeper Bot Logs

Watch for:
- `[Bot] Initialized config` - Config created successfully
- `[Bot] Created match` - Match creation working
- `[Bot] Initialized order book` - Order book ready
- `[Bot] Resolved match` - Resolution successful

### Error Patterns

Common issues:
- `Account not found` - Program not deployed or wrong address
- `Invalid instruction data` - IDL mismatch with deployed program
- `Insufficient funds` - Keeper wallet needs SOL
- `Transaction simulation failed` - Check program logs

## References

- **Commit dba3e03**: Adapt bot + IDLs for CLOB market program on mainnet
- **Commit 35c14f9**: Adapt bot + configs for CLOB market program on mainnet
- **Commit 2c17000**: Merge CLOB bot + IDL fixes for mainnet
- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Cookbook**: https://solanacookbook.com/
