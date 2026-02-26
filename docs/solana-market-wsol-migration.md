# Solana Market WSOL Migration

This document describes the migration from GOLD token to WSOL (Wrapped SOL) as the default market token for Hyperscape's prediction markets.

## Overview

As of February 2026, Hyperscape's Solana prediction markets use **WSOL (Wrapped SOL)** as the default market token instead of a custom GOLD token. This change simplifies deployment and allows markets to use the native token of each chain.

## What Changed

### Environment Variables

**Before**:
```bash
GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

**After**:
```bash
MARKET_MINT=So11111111111111111111111111111111111111112  # WSOL
```

### Default Behavior

- **Markets now use native token by default** (WSOL on Solana)
- **GOLD_MINT variable removed** - use `MARKET_MINT` instead
- **Backward compatible** - can still use custom tokens by setting `MARKET_MINT`

## Configuration

### Use WSOL (Default)

No configuration needed. WSOL is used automatically:

```bash
# packages/server/.env
# MARKET_MINT not set = uses WSOL
```

### Use Custom Token

Set `MARKET_MINT` to your token address:

```bash
# packages/server/.env
MARKET_MINT=YourTokenMintAddress...
```

### Token Program IDs

```bash
# packages/server/.env
SOLANA_GOLD_TOKEN_PROGRAM_ID=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID=ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
```

## Perps Oracle Changes

**What Changed**: Perps oracle updates are now **disabled by default** because the program is not deployed on devnet.

### Configuration

```bash
# packages/server/.env

# Disable perps oracle (default)
ENABLE_PERPS_ORACLE=false

# Enable when program is deployed
# ENABLE_PERPS_ORACLE=true
```

### Impact

- **Devnet**: Perps oracle disabled (program not available)
- **Mainnet**: Can be enabled when program is deployed
- **No errors**: Gracefully skips oracle updates when disabled

## Migration Guide

### From GOLD to WSOL

1. **Update environment variables**:
   ```bash
   # packages/server/.env
   
   # Remove old variable
   # GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
   
   # Add new variable (or leave unset for WSOL default)
   MARKET_MINT=So11111111111111111111111111111111111111112
   ```

2. **Update market maker configuration**:
   ```bash
   # Ensure market maker wallet has WSOL
   # No GOLD token needed
   ```

3. **Restart server**:
   ```bash
   bunx pm2 restart hyperscape-duel
   ```

### Existing Markets

**Important**: Existing markets using GOLD token will continue to work. This change only affects **new markets** created after the migration.

**To continue using GOLD**:
```bash
# packages/server/.env
MARKET_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

## Benefits of WSOL

### 1. Simplified Deployment

- **No custom token required** - uses native SOL
- **No token minting** - WSOL is always available
- **No liquidity bootstrapping** - SOL is liquid on all DEXs

### 2. Better UX

- **Familiar token** - users already have SOL
- **No wrapping needed** - automatic SOL ↔ WSOL conversion
- **Lower friction** - no need to acquire custom token

### 3. Cross-Chain Compatibility

- **Native token per chain** - WSOL on Solana, WETH on Ethereum, etc.
- **Consistent pattern** - always use wrapped native token
- **Easy bridging** - native tokens have best bridge support

## Technical Details

### WSOL Address

```
So11111111111111111111111111111111111111112
```

This is the canonical WSOL (Wrapped SOL) mint address on Solana.

### Token Program

WSOL uses the standard SPL Token program:

```
TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

### Associated Token Program

```
ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
```

## Code Changes

### Keeper Bot

The keeper bot now uses `MARKET_MINT` instead of `GOLD_MINT`:

```typescript
// Before
const goldMint = process.env.GOLD_MINT;

// After
const marketMint = process.env.MARKET_MINT || WSOL_MINT;
```

### Market Creation

Markets are created with the configured market mint:

```typescript
// Uses MARKET_MINT from environment
const marketMint = new PublicKey(
  process.env.MARKET_MINT || 'So11111111111111111111111111111111111111112'
);
```

## Troubleshooting

### Market creation fails

**Check**:
1. `MARKET_MINT` is valid Solana address
2. Token program ID is correct
3. Authority wallet has SOL for transaction fees

**Fix**:
```bash
# Verify mint address
solana account $MARKET_MINT

# Check authority balance
solana balance ~/.config/solana/id.json
```

### Perps oracle errors

**Check**:
1. `ENABLE_PERPS_ORACLE` is set correctly
2. Perps program is deployed on your network

**Fix**:
```bash
# Disable perps oracle
ENABLE_PERPS_ORACLE=false
```

### Token not found

**Check**:
1. Using correct network (devnet/mainnet)
2. WSOL mint address is correct
3. Token program ID matches network

**Fix**:
```bash
# Verify on devnet
solana config set --url https://api.devnet.solana.com
solana account So11111111111111111111111111111111111111112

# Verify on mainnet
solana config set --url https://api.mainnet-beta.solana.com
solana account So11111111111111111111111111111111111111112
```

## Related Documentation

- [packages/server/.env.example](../packages/server/.env.example) - Configuration reference
- [docs/duel-stack.md](duel-stack.md) - Duel system architecture
- [packages/gold-betting-demo/README.md](../packages/gold-betting-demo/README.md) - Betting demo

## References

- [Solana Token Program](https://spl.solana.com/token)
- [WSOL Documentation](https://spl.solana.com/token#wrapping-sol)
- [Associated Token Account Program](https://spl.solana.com/associated-token-account)
