# EVM Contracts

Solidity smart contracts for the Hyperscape betting stack on EVM-compatible chains (BSC, Base).

## Contracts

### GoldClob

Central Limit Order Book (CLOB) for binary prediction markets on AI agent duels.

**Features:**
- Order book with price-time priority matching
- Binary YES/NO markets for duel outcomes
- Fee routing to treasury and market maker
- Claim mechanism for winning positions
- Garbage collection for expired orders

**Deployment:**
```bash
bun run deploy:bsc-testnet
bun run deploy:base-sepolia
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

### AgentPerpEngine

Perpetual futures engine for agent skill ratings with ERC20 margin.

**Features:**
- Long/short positions on agent skill ratings
- TrueSkill-based oracle integration
- Margin requirements and liquidation
- Funding rate mechanism
- PnL settlement

### AgentPerpEngineNative

Perpetual futures engine with native token (BNB/ETH) margin.

**Features:**
- Same as AgentPerpEngine but uses native tokens
- No ERC20 approval required
- Direct ETH/BNB deposits

### SkillOracle

TrueSkill-based skill rating oracle for AI agents.

**Features:**
- Mu (mean skill) and sigma (uncertainty) tracking
- Owner-controlled skill updates
- Base price configuration
- Integration with perps engines

### MockERC20

Test token for local development and testing.

## Development

### Setup

```bash
bun install
```

### Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun test test/GoldClob.ts
bun test test/GoldClob.exploits.ts
bun test test/GoldClob.fuzz.ts
bun test test/AgentPerpEngine.ts
bun test test/AgentPerpEngineNative.ts

# Run with coverage
bun test --coverage
```

### Local Simulation

Run local simulation with PnL reporting:

```bash
bun run simulate:localnet
```

**Output:**
- Simulates 1000 rounds of betting activity
- Tests order matching, fee collection, and claim mechanics
- Generates PnL report at `simulations/evm-localnet-pnl.json`

### Compilation

```bash
# Compile contracts
npx hardhat compile

# Clean and recompile
npx hardhat clean
npx hardhat compile
```

## Deployment

### Preflight Validation

Before deploying, validate deployment readiness:

```bash
# From packages/gold-betting-demo
bun run deploy:preflight:testnet
bun run deploy:preflight:mainnet
```

### Testnet Deployment

```bash
bun run deploy:bsc-testnet      # Deploy to BSC Testnet
bun run deploy:base-sepolia     # Deploy to Base Sepolia
```

**Default configuration:**
- Treasury: Deployer address
- Market Maker: Deployer address

### Mainnet Deployment

```bash
# Required environment variables
TREASURY_ADDRESS=0x...
MARKET_MAKER_ADDRESS=0x...

# Optional
GOLD_TOKEN_ADDRESS=0x...

# Deploy
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Mainnet safety:**
- Requires explicit treasury and market maker addresses
- Validates all addresses before deployment
- Fails if required addresses are missing

### Deployment Receipts

Each deployment writes a receipt to `deployments/<network>.json`:

```json
{
  "network": "bsc",
  "chainId": 56,
  "deployer": "0x...",
  "goldClobAddress": "0x...",
  "treasuryAddress": "0x...",
  "marketMakerAddress": "0x...",
  "goldTokenAddress": "0x...",
  "deploymentTxHash": "0x...",
  "deployedAt": "2026-03-08T12:00:00.000Z"
}
```

**Automatic manifest update:**

The deploy script updates `../gold-betting-demo/deployments/contracts.json` with the new contract address.

**Skip manifest update** (for testing):
```bash
SKIP_BETTING_MANIFEST_UPDATE=true bun run deploy:bsc-testnet
```

## Typed Contract Helpers

The `typed-contracts.ts` module provides type-safe deployment and interaction helpers.

### Deployment Functions

```typescript
import {
  deployGoldClob,
  deploySkillOracle,
  deployMockErc20,
  deployAgentPerpEngine,
  deployAgentPerpEngineNative,
} from './typed-contracts';

// Deploy contracts with type safety
const clob = await deployGoldClob(treasuryAddress, marketMakerAddress, signer);
const oracle = await deploySkillOracle(initialBasePrice, signer);
const token = await deployMockErc20('USDC', 'USDC', signer);
```

### Contract Interfaces

```typescript
// Fully typed contract interfaces
interface GoldClobContract {
  createMatch(): Promise<ContractTransactionResponse>;
  placeOrder(matchId, isBuy, price, amount, overrides?): Promise<ContractTransactionResponse>;
  resolveMatch(matchId, winner): Promise<ContractTransactionResponse>;
  claim(matchId): Promise<ContractTransactionResponse>;
  matches(matchId): Promise<GoldClobMatch>;
  positions(matchId, trader): Promise<GoldClobPosition>;
  // ... and more
}

// Type-safe structs
type GoldClobMatch = {
  status: bigint;
  winner: bigint;
  yesPool: bigint;
  noPool: bigint;
};
```

**Benefits:**
- Compile-time type checking
- IntelliSense support
- Prevents parameter type errors
- Consistent deployment patterns

## Supported Networks

| Network | Chain ID | Hardhat Name | RPC Fallback |
|---------|----------|--------------|--------------|
| BSC Testnet | 97 | `bscTestnet` | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| BSC Mainnet | 56 | `bsc` | `https://bsc-dataseed.binance.org` |
| Base Sepolia | 84532 | `baseSepolia` | `https://sepolia.base.org` |
| Base Mainnet | 8453 | `base` | `https://mainnet.base.org` |
| Localhost | 31337 | `localhost` | `http://127.0.0.1:8545` |

**Custom chain IDs:**

The Hardhat configuration supports custom local chain IDs for development. See `hardhat.config.ts` for configuration.

## Environment Variables

Create `.env` file:

```bash
# Required
PRIVATE_KEY=0x...                    # Deployer wallet private key

# Required for mainnet
TREASURY_ADDRESS=0x...               # Treasury address for fee collection
MARKET_MAKER_ADDRESS=0x...           # Market maker address for fee collection

# Optional
GOLD_TOKEN_ADDRESS=0x...             # GOLD token address
BSC_RPC_URL=https://...              # BSC RPC endpoint
BSC_TESTNET_RPC_URL=https://...      # BSC Testnet RPC endpoint
BASE_RPC_URL=https://...             # Base RPC endpoint
BASE_SEPOLIA_RPC_URL=https://...     # Base Sepolia RPC endpoint
SKIP_BETTING_MANIFEST_UPDATE=true    # Skip manifest update (testing only)
```

**RPC Fallbacks:**

If RPC URLs are not configured, Hardhat uses public fallback endpoints. For production deployments, configure dedicated RPC endpoints for better reliability.

## Security

### Audit Status

All contracts have passed security audits:

- **GoldClob**: Exploit resistance tests, fuzz testing, round 2 security fixes
- **AgentPerpEngine**: PnL calculation tests, liquidation tests, margin safety
- **SkillOracle**: Access control tests, skill update validation

### Test Suites

| Test Suite | Purpose |
|------------|---------|
| `test/GoldClob.ts` | Core functionality tests |
| `test/GoldClob.exploits.ts` | Exploit PoC tests (post-fix validation) |
| `test/GoldClob.fuzz.ts` | Randomized invariant testing |
| `test/GoldClob.round2.ts` | Round 2 security fixes |
| `test/AgentPerpEngine.ts` | Perps engine tests |
| `test/AgentPerpEngineNative.ts` | Native token perps tests |

### Security Best Practices

- Never commit private keys to version control
- Use separate deployer wallets for testnet and mainnet
- Rotate keys if they are ever exposed
- Validate all addresses before deployment
- Run full test suite before mainnet deployment
- Monitor contract events after deployment

## Integration

### With Betting App

After deploying contracts, update `packages/gold-betting-demo/app/.env.mainnet`:

```bash
VITE_BSC_GOLD_CLOB_ADDRESS=0x...
VITE_BASE_GOLD_CLOB_ADDRESS=0x...
VITE_BSC_GOLD_TOKEN_ADDRESS=0x...
VITE_BASE_GOLD_TOKEN_ADDRESS=0x...
```

### With Keeper

Update `packages/gold-betting-demo/keeper/.env`:

```bash
BSC_GOLD_CLOB_ADDRESS=0x...
BASE_GOLD_CLOB_ADDRESS=0x...
BSC_RPC_URL=https://...
BASE_RPC_URL=https://...
```

### Verification

```bash
# From packages/gold-betting-demo
bun test tests/deployments.test.ts
```

This validates:
- Deployment manifest structure
- Contract address format
- Network configuration
- Cluster normalization

## Troubleshooting

**Deployment fails with "Invalid TREASURY_ADDRESS":**
- Ensure `TREASURY_ADDRESS` is set for mainnet deployments
- Verify address is a valid Ethereum address

**Deployment fails with "insufficient funds":**
- Check deployer wallet balance
- Ensure wallet has enough native tokens for gas

**RPC connection errors:**
- Verify RPC URL is correct and accessible
- Check RPC provider rate limits
- Try using Hardhat fallback RPC

**Manifest update fails:**
- Verify `../gold-betting-demo/deployments/contracts.json` exists
- Check file permissions
- Ensure network key exists in manifest

**Type errors in tests:**
- Ensure `typed-contracts.ts` is up to date
- Regenerate types if contract interfaces changed

## Documentation

For complete deployment guides, see:
- [docs/betting-production-deploy.md](../../docs/betting-production-deploy.md) - Full betting stack deployment
- [docs/evm-contracts-deployment.md](../../docs/evm-contracts-deployment.md) - Detailed EVM deployment guide
