# Duel Arena Oracle Deployment

This is the standalone duel arena oracle path inside Hyperscape. It is separate from betting and prediction market flows.

## Components

- **EVM oracle package**: `packages/duel-oracle-evm`
- **Solana oracle package**: `packages/duel-oracle-solana`
- **Server publisher**: `packages/server/src/oracle/DuelArenaOraclePublisher.ts`
- **Metadata API**: `GET /api/duel-arena/oracle/duels/:duelId`
- **Database schema**: `arena_rounds` table in `packages/server/src/database/schema.ts`

The production event flow is:

1. `streaming:announcement:start` → publish duel announcement/open state
2. `streaming:fight:start` → publish locked/start state
3. `streaming:resolution:start` → publish result
4. `streaming:cycle:aborted` → publish cancellation

## Oracle Record Fields (March 2026)

### Core Fields

- `duelId` - Unique duel identifier (UUID)
- `cycleId` - Streaming cycle identifier
- `duelKeyHex` - Deterministic duel key (hex-encoded, used as on-chain identifier)
- `status` - Current status: `BETTING_OPEN` | `LOCKED` | `RESOLVED` | `CANCELLED`
- `metadataUri` - URL to duel metadata JSON (e.g., `https://api.hyperscape.gg/api/duel-arena/oracle/duels/<duelId>`)

### Participant Fields

- `participantA` - First participant object:
  - `id` - Character ID
  - `name` - Character name
  - `hashHex` - SHA-256 hash of participant ID (for privacy)
- `participantB` - Second participant object (same structure)

### Timing Fields

- `betOpenTime` - When betting window opens (Unix milliseconds)
- `betCloseTime` - When betting window closes (Unix milliseconds)
- `fightStartTime` - When fight actually starts (Unix milliseconds, null until fight begins)
- `duelEndTime` - When duel ends (Unix milliseconds, null until resolved)

### Outcome Fields (NEW - commit aecab58)

- `winnerId` - Character ID of winner (null until resolved)
- `loserId` - Character ID of loser (null until resolved)
- `winnerSide` - Which side won: `A` | `B` | `null`
- `winnerName` - Winner's character name (null until resolved)
- `loserName` - Loser's character name (null until resolved)
- `winReason` - Reason for victory (e.g., "knockout", "timeout", "forfeit", "draw")
- **`damageA`** - **NEW**: Total damage dealt by participant A (integer, default: 0)
- **`damageB`** - **NEW**: Total damage dealt by participant B (integer, default: 0)

### Verification Fields (NEW - commit aecab58)

- **`seed`** - **NEW**: Cryptographic seed for replay verification (bigint, null until resolved)
- **`replayHashHex`** - **NEW**: Hash of replay data for integrity verification (hex string, null until resolved)
- **`resultHashHex`** - **NEW**: Combined hash of all duel outcome data (hex string, null until resolved)

The `resultHashHex` is computed from:
```typescript
{
  duelId,
  cycleId,
  duelKeyHex,
  winnerId,
  loserId,
  winReason,
  seed,
  replayHashHex,
  duelEndTime
}
```

### Chain State Fields

- `chainState` - Object mapping chain keys to publish status:
  - `target` - Chain identifier (e.g., "baseSepolia", "solanaDevnet")
  - `kind` - "evm" or "solana"
  - `label` - Human-readable chain name
  - `lastAction` - Last action performed: "UPSERT" | "RESOLVE" | "CANCEL"
  - `lastTxHash` - Transaction hash of last publish (null if failed)
  - `lastError` - Error message if publish failed (null if successful)
  - `updatedAt` - ISO timestamp of last update

### Metadata Fields

- `createdAt` - ISO timestamp when record was created
- `updatedAt` - ISO timestamp when record was last modified

## Database Schema

The `arena_rounds` table stores oracle records in PostgreSQL:

```sql
CREATE TABLE arena_rounds (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  agent_a_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  agent_b_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  preview_agent_a_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  preview_agent_b_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  duel_id TEXT,
  scheduled_at BIGINT NOT NULL,
  betting_opens_at BIGINT NOT NULL,
  betting_closes_at BIGINT NOT NULL,
  duel_starts_at BIGINT,
  duel_ends_at BIGINT,
  winner_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  win_reason TEXT,
  damage_a INTEGER NOT NULL DEFAULT 0,  -- NEW
  damage_b INTEGER NOT NULL DEFAULT 0,  -- NEW
  metadata_uri TEXT,
  result_hash TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
```

**New Columns** (commit aecab58):
- `damage_a` - Total damage dealt by agent A
- `damage_b` - Total damage dealt by agent B

These fields are populated during duel resolution and published to all oracle targets.

## Local Wallet Generation

Generate unfunded deploy/reporter wallets and write them into ignored `.env` files:

```bash
bun --cwd packages/server run scripts/generate-duel-oracle-wallets.ts
```

This writes:

- `packages/server/.env`
- `packages/duel-oracle-evm/.env` if you choose to keep EVM deploy env there
- public summary: `.codex-artifacts/duel-arena-oracle-wallets/public-addresses.json`
- Solana keypair files: `.codex-artifacts/duel-arena-oracle-wallets/*.json`

Use the generated public addresses for funding. Keep the `.env` files and `.codex-artifacts` directory private.

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

The publisher only activates targets that have both a deploy key and a contract/program target configured.

## EVM Deploy

EVM deploy config lives in `packages/duel-oracle-evm/.env` if you keep a local deploy file there. The canonical contract source shipped to consumers is under `packages/duel-oracle-evm/contracts/DuelOutcomeOracle.sol`.

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
ANCHOR_WALLET=/absolute/path/to/solana-devnet.json bash scripts/deploy-fight-oracle.sh devnet
ANCHOR_WALLET=/absolute/path/to/solana-mainnet.json bash scripts/deploy-fight-oracle.sh mainnet-beta
```

Program IDs default to:

- Devnet: `6tpRysBFd1yXRipYEYwAw9jxEoVHk15kVXfkDGFLMqcD`
- Mainnet: `6tpRysBFd1yXRipYEYwAw9jxEoVHk15kVXfkDGFLMqcD`

If you change program IDs, update:

- `DUEL_ARENA_ORACLE_SOLANA_DEVNET_PROGRAM_ID`
- `DUEL_ARENA_ORACLE_SOLANA_MAINNET_PROGRAM_ID`

The server publisher auto-initializes the on-chain oracle config when the authority/reporter secrets are present.

## ABI / IDL Usage

EVM ABI:

- package export: `packages/duel-oracle-evm/src/generated/duelOutcomeOracleAbi.ts`

Solana IDL:

- canonical IDL JSON: `packages/duel-oracle-solana/anchor/target/idl/fight_oracle.json`
- generated TS package export: `packages/duel-oracle-solana/src/generated/fightOracleIdl.ts`

EVM `viem` example:

```ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { DUEL_OUTCOME_ORACLE_ABI } from "@hyperscapeai/duel-oracle-evm";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.DUEL_ARENA_ORACLE_BASE_SEPOLIA_RPC_URL),
});

const duel = await client.readContract({
  address: process.env.DUEL_ARENA_ORACLE_BASE_SEPOLIA_CONTRACT_ADDRESS as `0x${string}`,
  abi: DUEL_OUTCOME_ORACLE_ABI,
  functionName: "getDuel",
  args: ["0x..."],
});
```

Solana `web3.js` / Anchor example:

```ts
import { PublicKey } from "@solana/web3.js";
import { FIGHT_ORACLE_IDL } from "@hyperscapeai/duel-oracle-solana";

const programId = new PublicKey(FIGHT_ORACLE_IDL.address);
```

## Oracle Metadata API

The server exposes REST endpoints for duel metadata:

**Get Recent Duels:**
```bash
curl http://localhost:5555/api/duel-arena/oracle/recent?limit=50
```

**Get Specific Duel:**
```bash
curl http://localhost:5555/api/duel-arena/oracle/duels/<duelId>
```

**Response Format:**
```json
{
  "duelId": "uuid-here",
  "cycleId": "cycle-uuid",
  "duelKeyHex": "deadbeef...",
  "status": "RESOLVED",
  "metadataUri": "https://api.hyperscape.gg/api/duel-arena/oracle/duels/uuid-here",
  "participantA": {
    "id": "character-id-a",
    "name": "Agent Alpha",
    "hashHex": "sha256-hash-hex"
  },
  "participantB": {
    "id": "character-id-b",
    "name": "Agent Beta",
    "hashHex": "sha256-hash-hex"
  },
  "betOpenTime": 1709942400000,
  "betCloseTime": 1709942700000,
  "fightStartTime": 1709942700000,
  "duelEndTime": 1709943000000,
  "winnerId": "character-id-a",
  "loserId": "character-id-b",
  "winnerSide": "A",
  "winnerName": "Agent Alpha",
  "loserName": "Agent Beta",
  "winReason": "knockout",
  "damageA": 1250,
  "damageB": 875,
  "seed": "12345678901234567890",
  "replayHashHex": "abcdef1234567890...",
  "resultHashHex": "fedcba0987654321...",
  "chainState": {
    "baseSepolia": {
      "target": "baseSepolia",
      "kind": "evm",
      "label": "Base Sepolia",
      "lastAction": "RESOLVE",
      "lastTxHash": "0x123...",
      "lastError": null,
      "updatedAt": "2026-03-09T02:00:00.000Z"
    },
    "solanaDevnet": {
      "target": "solanaDevnet",
      "kind": "solana",
      "label": "Solana Devnet",
      "lastAction": "RESOLVE",
      "lastTxHash": "5J7...",
      "lastError": null,
      "updatedAt": "2026-03-09T02:00:00.000Z"
    }
  },
  "createdAt": "2026-03-09T01:00:00.000Z",
  "updatedAt": "2026-03-09T02:00:00.000Z"
}
```

### New Fields (commit aecab58)

**Damage Tracking:**
- `damageA` - Total damage dealt by participant A during the duel
- `damageB` - Total damage dealt by participant B during the duel

These fields are used for:
- Tiebreaker logic (higher damage wins if both die simultaneously)
- Betting market insights (damage differential)
- Replay verification
- Analytics and leaderboards

**Verification Fields:**
- `seed` - Cryptographic seed for deterministic replay verification
- `replayHashHex` - Hash of complete replay data (combat log, actions, RNG state)
- `resultHashHex` - SHA-256 hash of all outcome fields for integrity verification

The `resultHashHex` is computed from:
```typescript
crypto.createHash("sha256").update(JSON.stringify({
  duelId,
  cycleId,
  duelKeyHex,
  winnerId,
  loserId,
  winReason,
  seed,
  replayHashHex,
  duelEndTime
})).digest("hex");
```

This hash is published on-chain and can be independently verified by anyone with access to the duel metadata.

## Naming Note

The current on-chain schema still uses `betOpenTs` and `betCloseTs`. In the duel arena oracle flow those fields represent the arena announcement window and lock/start transition, not a betting dependency.

## Production Checklist

1. Generate wallets and fund the correct public addresses for the target profile.
2. Deploy EVM contracts and Solana program.
3. Set the deployed contract/program addresses in `packages/server/.env`.
4. Set `DUEL_ARENA_ORACLE_ENABLED=true` and choose the correct `DUEL_ARENA_ORACLE_PROFILE`.
5. Set `DUEL_ARENA_ORACLE_METADATA_BASE_URL` to the public server URL.
6. Restart the server and verify:
   - `GET /api/duel-arena/oracle/recent`
   - `GET /api/duel-arena/oracle/duels/<duelId>`
   - chain receipts/sigs appear in the returned `chainState`
   - `damageA` and `damageB` fields are populated in resolved duels
   - `seed`, `replayHashHex`, and `resultHashHex` are present in resolved duels

## Integration with Betting Stack

The betting stack ([HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)) consumes oracle data via:

1. **Metadata API**: Polls `/api/duel-arena/oracle/recent` for new duels
2. **Blockchain Events**: Subscribes to oracle contract/program events for settlement
3. **Damage Stats**: Uses `damageA` and `damageB` for market insights and tiebreaker logic
4. **Verification**: Validates `resultHashHex` against metadata for integrity

The oracle is intentionally decoupled from betting to allow:
- Independent oracle deployment without betting infrastructure
- Third-party betting markets to consume oracle data
- Verifiable outcomes without relying on centralized betting APIs

## Troubleshooting

**Oracle not publishing:**
- Check `DUEL_ARENA_ORACLE_ENABLED=true` is set
- Verify contract/program addresses are configured
- Check signer secrets are valid (EVM private key, Solana keypairs)
- Review server logs for oracle publish errors
- Verify RPC URLs are accessible

**Missing damage stats:**
- Ensure server is running commit aecab58 or later
- Check `arena_rounds` table has `damage_a` and `damage_b` columns
- Run database migrations: `bunx drizzle-kit push`

**Chain state shows errors:**
- Check RPC URL connectivity
- Verify signer has sufficient gas/SOL for transactions
- Review `lastError` field in `chainState` for specific error messages
- Check contract/program is deployed at configured address

**Metadata API returns 404:**
- Verify `DUEL_ARENA_ORACLE_METADATA_BASE_URL` is set correctly
- Check duel ID is valid (exists in `arena_rounds` table)
- Ensure server is running with oracle enabled

## Security Considerations

**Participant Privacy:**
- Participant IDs are hashed (SHA-256) before publishing on-chain
- Only hashes are stored in smart contracts/programs
- Full participant details available via metadata API (requires duel ID)

**Replay Verification:**
- `seed` allows deterministic replay of combat RNG
- `replayHashHex` verifies replay data integrity
- `resultHashHex` verifies all outcome fields match
- Anyone can independently verify duel outcomes

**Signer Security:**
- Keep EVM private keys and Solana keypairs secure
- Use separate reporter keys (not deployer keys) for production
- Rotate keys periodically
- Monitor on-chain activity for unauthorized transactions
