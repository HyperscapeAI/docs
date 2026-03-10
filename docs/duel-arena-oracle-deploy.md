# Duel Arena Oracle Deployment

This is the standalone duel arena oracle path inside Hyperscape. It is separate from betting and prediction market flows.

## Components

- EVM oracle package: `packages/duel-oracle-evm`
- Solana oracle package: `packages/duel-oracle-solana`
- Server publisher: `packages/server/src/oracle/DuelArenaOraclePublisher.ts`
- Metadata API: `GET /api/duel-arena/oracle/duels/:duelId`

The production event flow is:

1. `streaming:announcement:start` -> publish duel announcement/open state
2. `streaming:fight:start` -> publish locked/start state
3. `streaming:resolution:start` -> publish result with comprehensive outcome data
4. `streaming:cycle:aborted` -> publish cancellation

## Oracle Data Fields (March 2026)

The oracle now publishes comprehensive duel outcome data for betting market settlement and replay verification:

**Core Fields**:
- `roundId` - Unique duel identifier
- `participantA` / `participantB` - Character IDs
- `winner` - Winning character ID (or empty for draw)
- `timestamp` - Unix timestamp of duel completion

**Combat Statistics** (New in March 2026):
- `damageA` - Total damage dealt by participant A
- `damageB` - Total damage dealt by participant B
- `winReason` - Detailed win reason: `knockout`, `timeout`, `forfeit`, `draw`

**Verification Data** (New in March 2026):
- `seed` - Cryptographic seed for replay verification
- `replayHashHex` - Hash of replay data for integrity verification
- `resultHashHex` - Combined hash of all duel outcome data

These fields are stored in the `arena_rounds` database table and published to all configured oracle targets (EVM + Solana).

## Oracle Data Fields (March 2026)

The oracle now publishes comprehensive duel outcome data:

**Core Fields**:
- `duelId` - Unique duel identifier (hashed)
- `participantAId` - Participant A identifier (hashed)
- `participantBId` - Participant B identifier (hashed)
- `betOpenTs` - Betting window open timestamp (announcement start)
- `betCloseTs` - Betting window close timestamp (fight start)
- `fightStartTs` - Fight start timestamp
- `winnerId` - Winner identifier (hashed)
- `loserId` - Loser identifier (hashed)

**New Fields (Commit aecab58)**:
- `damageA` - Total damage dealt by participant A
- `damageB` - Total damage dealt by participant B
- `winReason` - Reason for victory (e.g., "knockout", "timeout", "forfeit", "draw")
- `seed` - Cryptographic seed for replay verification
- `replayHashHex` - Hash of replay data for integrity verification
- `resultHashHex` - Combined hash of all duel outcome data

**Database Schema**:
These fields are stored in the `arena_rounds` table and published to all configured oracle targets (EVM + Solana).

**Impact**: Provides comprehensive duel outcome data for betting market settlement, replay verification, and anti-cheat validation.

## Local Wallet Generation

Generate unfunded deploy/reporter wallets and write them into ignored `.env` files:

```bash
bun --cwd packages/server run scripts/generate-duel-oracle-wallets.ts
```

This writes:

- `packages/server/.env`
- `packages/duel-oracle-evm/.env`
- public summary: `.codex-artifacts/duel-arena-oracle-wallets/public-addresses.json`
- Solana keypair file: `.codex-artifacts/duel-arena-oracle-wallets/solana-shared.json`

The generator creates:

- one shared EVM signer for Base, BSC, and AVAX
- one shared Solana signer for devnet and mainnet-beta

Use the generated public addresses for funding. The address string is the same across all EVM chains, but you still need to fund native gas separately on Base, BSC, and AVAX. Keep the `.env` files and `.codex-artifacts` directory private.

## Local End-to-End Verification

Run the full local duel, streaming, and oracle publish flow against Anvil and Solana localnet:

```bash
bun run duel:oracle:verify:local
```

This command:

1. Starts or reuses local Anvil on `http://127.0.0.1:8545`
2. Starts or reuses `solana-test-validator` on `http://127.0.0.1:8899`
3. Deploys `DuelOutcomeOracle` to Anvil
4. Builds and deploys `fight_oracle` to localnet
5. Starts the local duel stack
6. Verifies streaming combat
7. Confirms the resolved duel record exists on both local chains

## Server Runtime Config

Server config lives in `packages/server/.env`.

Core toggles:

```dotenv
DUEL_ARENA_ORACLE_ENABLED=true
DUEL_ARENA_ORACLE_PROFILE=testnet
DUEL_ARENA_ORACLE_METADATA_BASE_URL=https://your-domain.example/api/duel-arena/oracle
DUEL_ARENA_ORACLE_STORE_PATH=/var/lib/hyperscape/duel-arena-oracle/records.json
```

Profiles:

- `testnet`: Base Sepolia, BSC Testnet, Avalanche Fuji, Solana Devnet
- `mainnet`: Base, BSC, Avalanche C-Chain, Solana Mainnet
- `all`: publish to every configured target

Shared signer env vars:

```dotenv
DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY=0x...
DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET=base64:...
DUEL_ARENA_ORACLE_SOLANA_REPORTER_SECRET=base64:...
DUEL_ARENA_ORACLE_SOLANA_KEYPAIR_PATH=/absolute/path/to/solana-shared.json
```

Per-target private key env vars still work and override the shared signer when set. The publisher only activates targets that have both signer material and a contract/program target configured.

## EVM Deploy

EVM deploy config lives in `packages/duel-oracle-evm/.env`. The default pattern is one shared `PRIVATE_KEY` for Base, BSC, and AVAX, with optional per-network overrides. See `packages/duel-oracle-evm/.env.example`. The canonical contract source shipped to consumers is under `packages/duel-oracle-evm/contracts/DuelOutcomeOracle.sol`.

Compile:

```bash
bun --cwd packages/duel-oracle-evm run compile
```

Deploy testnets:

```bash
bun --cwd packages/duel-oracle-evm run deploy:base-sepolia
bun --cwd packages/duel-oracle-evm run deploy:bsc-testnet
bun --cwd packages/duel-oracle-evm run deploy:avax-fuji
```

Deploy mainnets:

```bash
bun --cwd packages/duel-oracle-evm run deploy:base
bun --cwd packages/duel-oracle-evm run deploy:bsc
bun --cwd packages/duel-oracle-evm run deploy:avax
```

Receipts are written to:

- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/baseSepolia.json`
- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/bscTestnet.json`
- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/avaxFuji.json`
- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/base.json`
- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/bsc.json`
- `packages/duel-oracle-evm/deployments/duel-outcome-oracle/avax.json`

After deployment, copy the deployed contract address into the matching server env var:

- `DUEL_ARENA_ORACLE_BASE_SEPOLIA_CONTRACT_ADDRESS`
- `DUEL_ARENA_ORACLE_BSC_TESTNET_CONTRACT_ADDRESS`
- `DUEL_ARENA_ORACLE_AVAX_FUJI_CONTRACT_ADDRESS`
- `DUEL_ARENA_ORACLE_BASE_MAINNET_CONTRACT_ADDRESS`
- `DUEL_ARENA_ORACLE_BSC_MAINNET_CONTRACT_ADDRESS`
- `DUEL_ARENA_ORACLE_AVAX_MAINNET_CONTRACT_ADDRESS`

## Solana Deploy

The canonical oracle program source now lives in the dedicated oracle package.

Build:

```bash
bun --cwd packages/duel-oracle-solana run anchor:build
```

Deploy oracle-only:

```bash
cd packages/duel-oracle-solana/anchor
ANCHOR_WALLET=/absolute/path/to/solana-shared.json bash scripts/deploy-fight-oracle.sh devnet
ANCHOR_WALLET=/absolute/path/to/solana-shared.json bash scripts/deploy-fight-oracle.sh mainnet-beta
```

Program IDs default to:

- Localnet: `6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV`
- Devnet: `6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV`
- Mainnet: `6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV`

If you change program IDs, update:

- `DUEL_ARENA_ORACLE_SOLANA_DEVNET_PROGRAM_ID`
- `DUEL_ARENA_ORACLE_SOLANA_MAINNET_PROGRAM_ID`

The server publisher auto-initializes the on-chain oracle config when the authority/reporter secrets are present.

## ABI / IDL Usage

EVM ABI:

- package export: `packages/duel-oracle-evm/src/generated/duelOutcomeOracleAbi.ts`
- published public config manifest: `@hyperscapeai/duel-oracle-evm/config.json`

Solana IDL:

- canonical IDL JSON: `packages/duel-oracle-solana/anchor/target/idl/fight_oracle.json`
- generated TS package export: `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`
- published public config manifest: `@hyperscapeai/duel-oracle-solana/config.json`

EVM `viem` example:

```ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { DUEL_OUTCOME_ORACLE_ABI } from "../packages/duel-oracle-evm/dist/index.js";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.DUEL_ARENA_ORACLE_BASE_SEPOLIA_RPC_URL),
});

const duel = await client.readContract({
  address: process.env
    .DUEL_ARENA_ORACLE_BASE_SEPOLIA_CONTRACT_ADDRESS as `0x${string}`,
  abi: DUEL_OUTCOME_ORACLE_ABI,
  functionName: "getDuel",
  args: ["0x..."],
});

// Access new fields (March 2026)
console.log("Damage A:", duel.damageA);
console.log("Damage B:", duel.damageB);
console.log("Win Reason:", duel.winReason);
console.log("Seed:", duel.seed);
console.log("Replay Hash:", duel.replayHashHex);
console.log("Result Hash:", duel.resultHashHex);
```

Published config manifest example:

```ts
import duelOracleConfig from "@hyperscapeai/duel-oracle-evm/config.json";
import duelOracleSolanaConfig from "@hyperscapeai/duel-oracle-solana/config.json";

const baseMainnetOracle = duelOracleConfig.deployments.base.address;
const solanaMainnetProgram = duelOracleSolanaConfig.programIds.mainnet;
```

Solana `web3.js` / Anchor example:

```ts
import { PublicKey } from "@solana/web3.js";
import { FIGHT_ORACLE_IDL } from "../packages/duel-oracle-solana/dist/index.js";

const programId = new PublicKey(FIGHT_ORACLE_IDL.address);

// Fetch duel record
const duelAccount = await program.account.duel.fetch(duelPda);

// Access new fields (March 2026)
console.log("Damage A:", duelAccount.damageA);
console.log("Damage B:", duelAccount.damageB);
console.log("Win Reason:", duelAccount.winReason);
console.log("Seed:", duelAccount.seed);
console.log("Replay Hash:", duelAccount.replayHash);
console.log("Result Hash:", duelAccount.resultHash);
```

## Naming Note

The current on-chain schema still uses `betOpenTs` and `betCloseTs`. In the duel arena oracle flow those fields represent the arena announcement window and lock/start transition, not a betting dependency.

## Production Checklist

1. Generate wallets and fund the shared EVM address on each destination EVM chain plus the shared Solana pubkey on the target cluster.
2. Deploy EVM contracts and Solana program.
3. Set the deployed contract/program addresses in `packages/server/.env`.
4. Set `DUEL_ARENA_ORACLE_ENABLED=true` and choose the correct `DUEL_ARENA_ORACLE_PROFILE`.
5. Set `DUEL_ARENA_ORACLE_METADATA_BASE_URL` to the public server URL.
6. Restart the server and verify:
   - `GET /api/duel-arena/oracle/recent`
   - `GET /api/duel-arena/oracle/duels/<duelId>`
   - chain receipts/sigs appear in the returned `chainState`
   - New fields (`damageA`, `damageB`, `winReason`, `seed`, `replayHashHex`, `resultHashHex`) are populated

## Metadata API Response Format (March 2026)

**GET /api/duel-arena/oracle/duels/:duelId**:

```json
{
  "duelId": "0x...",
  "participantAId": "0x...",
  "participantBId": "0x...",
  "betOpenTs": 1709876543,
  "betCloseTs": 1709876603,
  "fightStartTs": 1709876603,
  "winnerId": "0x...",
  "loserId": "0x...",
  "damageA": 245,
  "damageB": 189,
  "winReason": "knockout",
  "seed": "0x1234567890abcdef...",
  "replayHashHex": "0xabcdef1234567890...",
  "resultHashHex": "0x9876543210fedcba...",
  "chainState": {
    "baseSepolia": {
      "txHash": "0x...",
      "blockNumber": 12345678,
      "status": "confirmed"
    },
    "solanaDevnet": {
      "signature": "...",
      "slot": 123456789,
      "status": "confirmed"
    }
  }
}
```

**Win Reason Values**:
- `"knockout"` - One participant's HP reached 0
- `"timeout"` - Fight duration exceeded maximum time limit
- `"forfeit"` - One participant disconnected or forfeited
- `"draw"` - Both participants died simultaneously or fight ended in a tie

## Integration with Betting Stack

The betting stack (now in [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)) consumes oracle data via:

1. **REST API**: Polls `GET /api/duel-arena/oracle/recent` for new duel outcomes
2. **Blockchain Events**: Subscribes to oracle contract events for settlement triggers
3. **Metadata Verification**: Fetches full duel metadata from `GET /api/duel-arena/oracle/duels/:duelId`

**Separation of Concerns**:
- **Hyperscape Oracle**: Publishes verifiable duel outcomes to blockchain
- **Hyperbet Betting**: Consumes oracle data for market settlement and payout calculation

**Cross-Repository Integration**:
- Oracle metadata API is public and versioned
- Betting stack subscribes to blockchain events for real-time settlement
- No direct code dependencies between repositories

## Recent Changes (March 2026)

### Damage Tracking (Commit aecab58)

**New Fields**: `damageA` and `damageB` track total damage dealt by each participant.

**Use Cases**:
- Betting market settlement (verify fight was legitimate)
- Replay verification (ensure damage totals match replay data)
- Anti-cheat validation (detect impossible damage values)

**Database Schema**:
```sql
ALTER TABLE arena_rounds ADD COLUMN damage_a INTEGER;
ALTER TABLE arena_rounds ADD COLUMN damage_b INTEGER;
```

### Replay Verification (Commit aecab58)

**New Fields**: `seed`, `replayHashHex`, `resultHashHex` enable deterministic replay verification.

**Verification Flow**:
1. Oracle publishes `seed` and `replayHashHex` to blockchain
2. Betting markets can request replay data from metadata API
3. Replay data is hashed and compared to `replayHashHex`
4. Combined outcome data is hashed and compared to `resultHashHex`

**Use Cases**:
- Dispute resolution (verify fight outcome matches replay)
- Anti-cheat validation (detect manipulated fight data)
- Audit trail (cryptographic proof of fight integrity)

### Win Reason Tracking (Commit aecab58)

**New Field**: `winReason` provides detailed context for fight outcome.

**Values**:
- `"knockout"` - Normal combat victory (HP reached 0)
- `"timeout"` - Fight exceeded maximum duration
- `"forfeit"` - Participant disconnected or forfeited
- `"draw"` - Simultaneous death or tie

**Use Cases**:
- Betting market rules (some markets may exclude timeouts/forfeits)
- Fight statistics (track knockout rate vs timeout rate)
- Anti-cheat validation (detect suspicious forfeit patterns)

### Oracle Config Unit Tests (Commit 71dcba8)

**New Tests**: `packages/server/tests/unit/oracle/config.test.ts`

**Coverage**:
- Oracle configuration validation
- Target activation logic
- Signer material detection
- Profile resolution (testnet/mainnet/all)

**Impact**: Ensures oracle configuration is validated before deployment.

## Troubleshooting

### Oracle Not Publishing

**Check configuration**:
```bash
# Verify oracle is enabled
echo $DUEL_ARENA_ORACLE_ENABLED

# Check profile
echo $DUEL_ARENA_ORACLE_PROFILE

# Verify signers are set
echo $DUEL_ARENA_ORACLE_EVM_PRIVATE_KEY
echo $DUEL_ARENA_ORACLE_SOLANA_AUTHORITY_SECRET
```

**Check target activation**:
```bash
# Review server logs for oracle initialization
tail -f logs/server.log | grep -i oracle
```

**Verify contract addresses**:
```bash
# Check EVM contract addresses are set
echo $DUEL_ARENA_ORACLE_BASE_SEPOLIA_CONTRACT_ADDRESS
echo $DUEL_ARENA_ORACLE_BSC_TESTNET_CONTRACT_ADDRESS

# Check Solana program IDs are set
echo $DUEL_ARENA_ORACLE_SOLANA_DEVNET_PROGRAM_ID
echo $DUEL_ARENA_ORACLE_SOLANA_MAINNET_PROGRAM_ID
```

### Missing Oracle Data

If oracle records are missing `damageA`, `damageB`, or other new fields:
- Verify server is running commit aecab58 or later
- Check database schema includes new columns
- Run migrations: `bunx drizzle-kit migrate` from `packages/server/`
- Review `arena_rounds` table schema

### Replay Verification Failures

If replay hash verification fails:
- Ensure `seed` is consistent between oracle record and replay data
- Verify `replayHashHex` matches hash of replay data
- Check `resultHashHex` matches combined hash of all outcome fields
- Review server logs for hash calculation errors

## API Reference

### GET /api/duel-arena/oracle/recent

Returns recent duel oracle records (last 100).

**Response**:
```json
{
  "duels": [
    {
      "duelId": "0x...",
      "participantAId": "0x...",
      "participantBId": "0x...",
      "winnerId": "0x...",
      "loserId": "0x...",
      "damageA": 245,
      "damageB": 189,
      "winReason": "knockout",
      "fightStartTs": 1709876603,
      "chainState": { ... }
    }
  ]
}
```

### GET /api/duel-arena/oracle/duels/:duelId

Returns full duel metadata including replay verification data.

**Response**: See "Metadata API Response Format" section above.

**New Fields (March 2026)**:
- `damageA` - Total damage dealt by participant A
- `damageB` - Total damage dealt by participant B
- `winReason` - Reason for victory
- `seed` - Cryptographic seed
- `replayHashHex` - Replay data hash
- `resultHashHex` - Combined outcome hash
