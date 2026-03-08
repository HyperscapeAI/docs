# EVM Contracts Deployment Guide

This guide covers deploying the Hyperscape betting stack EVM contracts (GoldClob, AgentPerpEngine, SkillOracle) to BSC and Base networks.

## Overview

The EVM contracts package (`packages/evm-contracts`) provides:

- **GoldClob**: Central Limit Order Book for binary prediction markets
- **AgentPerpEngine**: Perpetual futures engine for agent skill ratings (ERC20 margin)
- **AgentPerpEngineNative**: Perpetual futures engine (native token margin)
- **SkillOracle**: TrueSkill-based skill rating oracle for agents
- **MockERC20**: Test token for local development

## Supported Networks

| Network | Chain ID | Hardhat Network Name | RPC Fallback |
|---------|----------|---------------------|--------------|
| BSC Testnet | 97 | `bscTestnet` | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| BSC Mainnet | 56 | `bsc` | `https://bsc-dataseed.binance.org` |
| Base Sepolia | 84532 | `baseSepolia` | `https://sepolia.base.org` |
| Base Mainnet | 8453 | `base` | `https://mainnet.base.org` |

## Prerequisites

1. **Bun runtime** (v1.3.10+)
2. **Deployer wallet** with private key
3. **Native tokens** for gas:
   - BSC Testnet: Get tBNB from [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)
   - Base Sepolia: Get ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
   - BSC Mainnet: BNB
   - Base Mainnet: ETH
4. **RPC endpoints** (optional - uses public fallbacks if not configured):
   - Recommended: [Alchemy](https://alchemy.com), [Infura](https://infura.io), or [QuickNode](https://quicknode.com)

## Environment Configuration

Create `packages/evm-contracts/.env`:

```bash
# Required
PRIVATE_KEY=0x...                    # Deployer wallet private key

# Required for mainnet deployments
TREASURY_ADDRESS=0x...               # Treasury address for fee collection
MARKET_MAKER_ADDRESS=0x...           # Market maker address for fee collection

# Optional - GOLD token address (recorded in deployment receipt)
GOLD_TOKEN_ADDRESS=0x...

# Optional - RPC endpoints (uses public fallbacks if not set)
BSC_RPC_URL=https://...
BSC_TESTNET_RPC_URL=https://...
BASE_RPC_URL=https://...
BASE_SEPOLIA_RPC_URL=https://...

# Optional - skip manifest update (for testing)
SKIP_BETTING_MANIFEST_UPDATE=true
```

**Security Notes:**
- Never commit `.env` files with real private keys
- Use separate deployer wallets for testnet and mainnet
- Rotate keys if they are ever exposed

## Preflight Validation

Before deploying, run preflight checks to validate deployment readiness:

```bash
# From packages/gold-betting-demo
bun run deploy:preflight:testnet    # Validate testnet deployment
bun run deploy:preflight:mainnet    # Validate mainnet deployment
```

**Preflight checks:**
- ✅ Solana program keypairs match deployment manifest
- ✅ Anchor IDL files match deployment manifest
- ✅ App and keeper IDL files are in sync
- ✅ EVM deployment environment variables are configured
- ✅ EVM RPC URLs are available (configured or fallback)
- ✅ Contract addresses are present in deployment manifest

**Warnings vs Failures:**
- **Warnings**: Missing RPC URLs (will use fallbacks), pending contract addresses
- **Failures**: Mismatched program IDs, missing required env vars, invalid addresses

## Deployment Process

### 1. Testnet Deployment

Deploy to BSC Testnet and Base Sepolia for testing:

```bash
# From packages/evm-contracts

# Deploy to BSC Testnet
bun run deploy:bsc-testnet

# Deploy to Base Sepolia
bun run deploy:base-sepolia
```

**What happens:**
1. Validates deployer wallet and network connection
2. Deploys GoldClob contract with treasury and market maker addresses
3. Writes deployment receipt to `deployments/bscTestnet.json` or `deployments/baseSepolia.json`
4. Updates central manifest at `../gold-betting-demo/deployments/contracts.json`

**Default addresses** (testnet):
- Treasury: Deployer address
- Market Maker: Deployer address

### 2. Mainnet Deployment

Deploy to BSC Mainnet and Base Mainnet:

```bash
# From packages/evm-contracts

# Deploy to BSC Mainnet
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc

# Deploy to Base Mainnet
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Mainnet Safety:**
- Requires explicit `TREASURY_ADDRESS` and `MARKET_MAKER_ADDRESS` environment variables
- Deployment fails if these are not set (prevents accidental use of deployer address)
- Validates all addresses before deployment
- Prompts for confirmation before deploying to production networks

**Optional: Specify GOLD token address:**
```bash
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... GOLD_TOKEN_ADDRESS=0x... bun run deploy:bsc
```

### 3. Local Development

Test contracts locally using Hardhat's built-in network:

```bash
# From packages/evm-contracts

# Run all tests
bun test

# Run specific test suites
bun test test/GoldClob.ts
bun test test/GoldClob.exploits.ts
bun test test/GoldClob.fuzz.ts

# Run local simulation
bun run simulate:localnet
```

**Local simulation** (`simulate:localnet`):
- Deploys contracts to Hardhat local network
- Simulates 1000 rounds of betting activity
- Tests order matching, fee collection, and claim mechanics
- Generates PnL report at `simulations/evm-localnet-pnl.json`

## Deployment Receipts

Each deployment writes a JSON receipt to `packages/evm-contracts/deployments/<network>.json`:

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

**Manifest Update:**

After successful deployment, the script automatically updates `packages/gold-betting-demo/deployments/contracts.json`:

```json
{
  "evm": {
    "bsc": {
      "label": "BSC Mainnet",
      "chainId": 56,
      "goldClobAddress": "0x...",
      "goldTokenAddress": "0x...",
      "rpcEnvVar": "BSC_RPC_URL"
    }
  }
}
```

**Skip manifest update** (for testing):
```bash
SKIP_BETTING_MANIFEST_UPDATE=true bun run deploy:bsc-testnet
```

## Typed Contract Helpers

The `typed-contracts.ts` module provides type-safe deployment and interaction helpers:

### Deployment Functions

```typescript
import {
  deployGoldClob,
  deploySkillOracle,
  deployMockErc20,
  deployAgentPerpEngine,
  deployAgentPerpEngineNative,
} from '../typed-contracts';

// Deploy GoldClob
const clob = await deployGoldClob(treasuryAddress, marketMakerAddress, signer);

// Deploy SkillOracle
const oracle = await deploySkillOracle(initialBasePrice, signer);

// Deploy test token
const token = await deployMockErc20('USDC', 'USDC', signer);

// Deploy perps engines
const perpEngine = await deployAgentPerpEngine(
  oracleAddress,
  marginTokenAddress,
  skewScale,
  signer
);

const nativePerpEngine = await deployAgentPerpEngineNative(
  oracleAddress,
  skewScale,
  signer
);
```

### Contract Interfaces

All contract interfaces include full type safety for methods and return types:

```typescript
// GoldClob interface
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

type GoldClobPosition = {
  yesShares: bigint;
  noShares: bigint;
};
```

**Benefits:**
- Compile-time type checking for all contract interactions
- IntelliSense support in tests and scripts
- Prevents common errors (wrong parameter types, missing overrides)
- Consistent deployment patterns across test suites

## Verification

After deployment, verify contracts are working:

### On-Chain Verification

```bash
# Check contract deployment
npx hardhat verify --network bsc <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Example: Verify GoldClob on BSC
npx hardhat verify --network bsc 0x... 0xTREASURY 0xMARKET_MAKER
```

### Functional Testing

```bash
# Run test suite against deployed contracts
bun test

# Run exploit tests
bun test test/GoldClob.exploits.ts

# Run fuzz tests
bun test test/GoldClob.fuzz.ts
```

### Manual Testing

Use Hardhat console to interact with deployed contracts:

```bash
npx hardhat console --network bsc

# In console:
const clob = await ethers.getContractAt('GoldClob', '0x...');
await clob.createMatch();
```

## Troubleshooting

**Deployment fails with "Invalid TREASURY_ADDRESS":**
- Ensure `TREASURY_ADDRESS` is set for mainnet deployments
- Verify address is a valid Ethereum address (checksummed)

**Deployment fails with "insufficient funds":**
- Check deployer wallet balance: `npx hardhat run scripts/check-balances.js --network <network>`
- Ensure wallet has enough native tokens for gas

**RPC connection errors:**
- Verify RPC URL is correct and accessible
- Check RPC provider rate limits
- Try using Hardhat fallback RPC (remove custom RPC_URL env var)

**Manifest update fails:**
- Verify `packages/gold-betting-demo/deployments/contracts.json` exists
- Check file permissions (must be writable)
- Ensure network key exists in manifest (bsc, bscTestnet, base, baseSepolia)

**Type errors in tests:**
- Ensure `typed-contracts.ts` is up to date with contract ABIs
- Regenerate types if contract interfaces changed: `npx hardhat typechain`

## Network-Specific Notes

### BSC (Binance Smart Chain)

- **Gas Price**: BSC uses fixed gas price (3 gwei typical)
- **Block Time**: ~3 seconds
- **Finality**: 15 blocks (~45 seconds)
- **Explorer**: [BscScan](https://bscscan.com)

### Base

- **Gas Price**: Dynamic (EIP-1559)
- **Block Time**: ~2 seconds
- **Finality**: ~12 seconds (optimistic rollup)
- **Explorer**: [BaseScan](https://basescan.org)

## Advanced Configuration

### Custom Chain IDs

For local development with custom EVM chains:

```bash
# Hardhat config supports custom local chain IDs
# See hardhat.config.ts for configuration
```

### Gas Optimization

Deployment gas costs (approximate):

| Contract | BSC Gas | Base Gas |
|----------|---------|----------|
| GoldClob | ~2.5M | ~2.5M |
| SkillOracle | ~800K | ~800K |
| AgentPerpEngine | ~3M | ~3M |

### Multi-Network Deployment

Deploy to all networks in sequence:

```bash
# Testnet sweep
bun run deploy:bsc-testnet && bun run deploy:base-sepolia

# Mainnet sweep (with confirmation prompts)
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

## Integration with Betting Stack

After deploying EVM contracts, update the betting app and keeper configuration:

### Update Betting App

Edit `packages/gold-betting-demo/app/.env.mainnet`:

```bash
VITE_BSC_GOLD_CLOB_ADDRESS=0x...
VITE_BASE_GOLD_CLOB_ADDRESS=0x...
VITE_BSC_GOLD_TOKEN_ADDRESS=0x...
VITE_BASE_GOLD_TOKEN_ADDRESS=0x...
```

### Update Keeper

Edit `packages/gold-betting-demo/keeper/.env`:

```bash
BSC_GOLD_CLOB_ADDRESS=0x...
BASE_GOLD_CLOB_ADDRESS=0x...
BSC_RPC_URL=https://...
BASE_RPC_URL=https://...
```

### Verify Integration

```bash
# From packages/gold-betting-demo
bun test tests/deployments.test.ts
```

This test validates:
- Deployment manifest structure
- Contract address format
- Network configuration
- Cluster normalization

## Security Audit

All EVM contracts have passed security audits:

- **GoldClob**: Exploit resistance tests, fuzz testing, round 2 security fixes
- **AgentPerpEngine**: PnL calculation tests, liquidation tests, margin safety
- **SkillOracle**: Access control tests, skill update validation

**Test suites:**
- `test/GoldClob.ts` - Core functionality
- `test/GoldClob.exploits.ts` - Exploit PoC tests (post-fix)
- `test/GoldClob.fuzz.ts` - Randomized invariant testing
- `test/GoldClob.round2.ts` - Round 2 security fixes
- `test/AgentPerpEngine.ts` - Perps engine tests
- `test/AgentPerpEngineNative.ts` - Native token perps tests

## Deployment Checklist

Before deploying to mainnet:

- [ ] Run preflight validation: `bun run deploy:preflight:mainnet`
- [ ] Test on testnet first (BSC Testnet, Base Sepolia)
- [ ] Verify treasury and market maker addresses
- [ ] Ensure deployer wallet has sufficient gas
- [ ] Run full test suite: `bun test`
- [ ] Run exploit tests: `bun test test/GoldClob.exploits.ts`
- [ ] Run fuzz tests: `bun test test/GoldClob.fuzz.ts`
- [ ] Verify RPC endpoints are working
- [ ] Backup deployment receipts
- [ ] Update betting app and keeper configuration
- [ ] Test integration with betting stack

## Post-Deployment

After successful deployment:

1. **Save deployment receipts** from `packages/evm-contracts/deployments/`
2. **Verify contracts on block explorers** (BscScan, BaseScan)
3. **Update betting app configuration** with new contract addresses
4. **Update keeper configuration** with new contract addresses
5. **Test end-to-end betting flow** on testnet before mainnet
6. **Monitor contract events** for first 24 hours after mainnet deployment

## Rollback Procedure

If deployment fails or contracts need to be replaced:

1. **Do not delete deployment receipts** - they contain deployment history
2. **Deploy new contracts** with corrected configuration
3. **Update manifest** with new addresses
4. **Migrate liquidity** from old contracts to new contracts (if applicable)
5. **Update frontend and keeper** to point to new contracts
6. **Deprecate old contracts** (mark as inactive in manifest)

## Support

For deployment issues:
- Check deployment receipts in `packages/evm-contracts/deployments/`
- Review Hardhat logs for error details
- Verify network connectivity and RPC endpoints
- Check block explorer for transaction status
- Review contract events for deployment confirmation
