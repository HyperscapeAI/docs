# Anchor Testing Configuration

## Localnet vs Devnet

The `Anchor.toml` configuration file is set to use **localnet** by default for testing. This means `anchor test` will spin up a local Solana validator with free SOL instead of trying to deploy to devnet (which requires real SOL funding).

### Running Tests

```bash
# Run tests on localnet (default, free SOL)
anchor test

# Deploy to devnet (requires funded wallet)
anchor deploy --provider.cluster devnet

# Deploy to mainnet (requires funded wallet)
anchor deploy --provider.cluster mainnet
```

### Why Localnet?

**Benefits**:
- **Free SOL**: Local validator provides unlimited test SOL
- **Fast iteration**: No network latency or rate limits
- **Isolated testing**: Tests don't interfere with devnet state
- **No funding required**: No need to airdrop or fund test wallets

**Devnet/Mainnet Deployment**:
- Use the `--provider.cluster` flag to override the default cluster
- Ensure your wallet has sufficient SOL for deployment
- Update program IDs in your code after deployment

### Configuration

The `Anchor.toml` file in `packages/gold-betting-demo/anchor/` contains:

```toml
[provider]
cluster = "localnet"  # Default for anchor test
wallet = "~/.config/solana/id.json"

[programs.localnet]
fight_oracle = "..."
gold_clob_market = "..."
gold_perps_market = "..."
```

### Wallet Setup

For production deployments, configure your Solana keypair:

```bash
# Set SOLANA_DEPLOYER_PRIVATE_KEY in .env
# The deploy script will create ~/.config/solana/id.json automatically
bun run scripts/decode-key.ts
```

See `packages/server/.env.example` for `SOLANA_DEPLOYER_PRIVATE_KEY` configuration.
