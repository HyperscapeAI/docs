# Solana Market Updates (Feb 2026)

Recent changes to Solana betting markets and keeper bot configuration.

## WSOL as Default Market Token

### Change (Commit 34255ee)

Markets now use the native token (WSOL - Wrapped SOL) instead of GOLD by default.

**Before:**
```typescript
const GOLD_MINT = "DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump";
```

**After:**
```typescript
const MARKET_MINT = process.env.MARKET_MINT || "So11111111111111111111111111111111111111112"; // WSOL
```

### Rationale

- **Native Token**: WSOL is the native token on Solana (wrapped SOL)
- **Better Liquidity**: More liquidity than custom tokens
- **Lower Fees**: No token swap fees
- **Cross-Chain**: Each chain uses its native token by default

### Configuration

Override the default market token:

```bash
# Use GOLD instead of WSOL
MARKET_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

### Migration

Existing markets using GOLD will continue to work. New markets will use WSOL unless `MARKET_MINT` is explicitly set.

## Perps Oracle Disabled

### Change (Commit 34255ee)

Perps oracle updates are now disabled by default.

**Reason:**
The perps program is not deployed on devnet, causing oracle update failures.

**Configuration:**
```bash
# Enable perps oracle (only if program is deployed)
ENABLE_PERPS_ORACLE=true
```

### Impact

- **Devnet**: No impact (program not deployed)
- **Mainnet**: Re-enable when perps program is deployed
- **Local**: No impact (program not deployed)

### Related Code

```typescript
// packages/gold-betting-demo/keeper/src/service.ts
const ENABLE_PERPS_ORACLE = process.env.ENABLE_PERPS_ORACLE === 'true';

if (ENABLE_PERPS_ORACLE) {
  // Update perps oracle
} else {
  // Skip perps oracle updates
}
```

## Environment Variables

### New Variables

```bash
# Market token mint (defaults to WSOL)
MARKET_MINT=So11111111111111111111111111111111111111112

# Enable perps oracle updates (defaults to false)
ENABLE_PERPS_ORACLE=false
```

### Deprecated Variables

```bash
# Replaced by MARKET_MINT
# GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

## Keeper Bot Configuration

### Solana Keypairs

The keeper bot uses three keypairs for different operations:

1. **Authority**: Initializes config/oracle/market, resolves payouts
2. **Reporter**: Reports duel outcomes
3. **Keeper**: Locks/resolves/claims-for

**Simplified Configuration:**
```bash
# Set all three keypairs at once (base58 private key)
SOLANA_DEPLOYER_PRIVATE_KEY=your-base58-private-key
```

**Individual Configuration:**
```bash
# Or set individually
SOLANA_ARENA_AUTHORITY_SECRET=authority-private-key
SOLANA_ARENA_REPORTER_SECRET=reporter-private-key
SOLANA_ARENA_KEEPER_SECRET=keeper-private-key
```

### Market Maker

The market maker seeds initial liquidity:

```bash
# Market maker keypair
SOLANA_MM_PRIVATE_KEY=mm-private-key

# Wallet address for seeding
DUEL_KEEPER_WALLET=your-solana-wallet-address
```

## Testing

### Local Testing

```bash
# Start local Solana validator
solana-test-validator

# Run keeper bot
cd packages/gold-betting-demo/keeper
bun run src/service.ts
```

### Devnet Testing

```bash
# Configure for devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com

# Run keeper bot
bun run src/service.ts
```

## Related Files

- `packages/gold-betting-demo/keeper/src/service.ts` - Keeper bot service
- `packages/gold-betting-demo/keeper/src/common.ts` - Market configuration
- `packages/server/.env.example` - Environment variable documentation
- `docs/betting-production-deploy.md` - Production deployment guide

## Migration Checklist

If you're upgrading from GOLD to WSOL markets:

- [ ] Update `MARKET_MINT` to WSOL address
- [ ] Update market maker to use WSOL
- [ ] Update betting UI to display SOL instead of GOLD
- [ ] Update price feeds (if using Jupiter/Birdeye)
- [ ] Test on devnet before mainnet deployment

## References

- [Solana Token Program](https://spl.solana.com/token)
- [WSOL Documentation](https://spl.solana.com/token#wrapping-sol)
- [Jupiter Aggregator](https://jup.ag/)
