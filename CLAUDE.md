# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world with autonomous AI agents powered by ElizaOS.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement due to our use of TSL (Three Shading Language) for all materials and post-processing effects. TSL only works with the WebGPU node material pipeline.

### Why WebGPU-Only?
- **TSL Shaders**: All materials use Three.js Shading Language (TSL) which requires WebGPU
- **Post-Processing**: Bloom, tone mapping, and other effects use TSL-based node materials
- **No Fallback**: There is NO WebGL fallback - the game will not render without WebGPU

### Browser Requirements
- Chrome 113+ (recommended)
- Edge 113+
- Safari 18+ (macOS 15+) - Safari 17 support was removed
- Firefox (behind flag, not recommended)

### Server/Streaming Requirements
For Vast.ai and other GPU servers running the streaming pipeline:
- **NVIDIA GPU with Display Driver REQUIRED** - Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- **Must run non-headless** with Xorg or Xvfb (WebGPU requires window context)
- Chrome uses ANGLE/Vulkan backend to access WebGPU
- If GPU cannot initialize WebGPU, deployment MUST FAIL (no soft fallbacks)

### Development Rules for WebGPU
- **NEVER add WebGL fallback code** - it will not work with TSL shaders
- **NEVER use `--disable-webgpu`** or `forceWebGL` flags
- **NEVER use headless Chrome modes** that don't support WebGPU
- All renderer code must assume WebGPU availability
- If WebGPU is unavailable, throw an error immediately

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Full duel stack (game + agents + streaming)
bun run duel

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
bun run dev:ai          # Game + ElizaOS agents
bun run dev:forge       # AssetForge tools
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```



## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence
│   ├── LiveKit voice chat integration
│   └── Streaming duel scheduler
├── client/              # Web client (Vite + React)
│   ├── 3D rendering (WebGPU only)
│   ├── Player controls
│   └── UI/HUD
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── contracts/           # MUD onchain game state (experimental)
├── physx-js-webidl/     # PhysX WASM bindings
├── procgen/             # Procedural generation
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

> **TODO(AUDIT-004): CIRCULAR DEPENDENCY - shared ↔ procgen**
>
> There is a circular dependency between `@hyperscape/shared` and `@hyperscape/procgen`.
> - shared imports procgen for vegetation/terrain generation
> - procgen imports shared for TileCoord type in viewers
>
> **Current workaround**: procgen build ignores TypeScript errors.
>
> **Recommended fix**: Extract shared types to `@hyperscape/types` package:
> - Create new package with only type definitions (no runtime code)
> - Both shared and procgen depend on types (no circular dep)
> - Move TileCoord, Position3D, EntityData to types package

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### RPG Implementation Architecture

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or "will fill this out later" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:ai     # Game + ElizaOS agents
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
bun run duel       # Full duel stack (game + agents + streaming)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | (hardcoded) | `bun run dev:ai` |
| 5555 | Game Server | `PORT` | `bun run dev` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent configuration |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.3.10+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.3.10+ (updated from v1.1.38)
- **Rendering**: WebGPU ONLY (Three.js WebGPURenderer + TSL shaders) - NO WebGL
- **Engine**: Three.js 0.182.0, PhysX (WASM)
- **UI**: React 19.2.0, styled-components
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon/Railway), Docker (local)
- **Testing**: Playwright, Vitest 4.x (upgraded from 2.x for Vite 6 compatibility)
- **Build**: Turbo, esbuild, Vite
- **Mobile**: Capacitor
- **AI Agents**: ElizaOS with InMemoryDatabaseAdapter (no PGLite)
- **Blockchain**: Solana (Anchor), EVM (Hardhat + Foundry)

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Bundle Size Warnings:**

The client and asset-forge packages have increased `chunkSizeWarningLimit` to suppress warnings for intentionally large WebGPU/PhysX bundles:

- `packages/client/vite.config.ts`: 8000 KB (WebGPU/PhysX bundles)
- `packages/asset-forge/vite.config.ts`: 9000 KB (Asset tooling with WebGPU)

These limits are intentional until deeper code splitting is implemented. The large bundles are due to:
- Three.js WebGPU renderer and TSL shader system
- PhysX WASM bindings
- Asset processing tools (GLB decimation, impostor baking, etc.)

**Tech Debt**: Track deeper code splitting as future optimization to reduce initial bundle size.



### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
lsof -ti:4001 | xargs kill -9  # ElizaOS API
lsof -ti:4179 | xargs kill -9  # Betting App
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require WebGPU support (headful browser with GPU access)

### Agent Memory Issues

If agents are consuming excessive memory:
- Check that InMemoryDatabaseAdapter is being used (not PGLite)
- Verify memory caps are in place (50 memories per agent, 20 adapter logs, 100 cache entries)
- Monitor periodic GC is running (every 60s)
- Check DB connection pool isn't exhausted (max 5 concurrent bank queries)

### Database Connection Pool Exhaustion

If seeing "timeout exceeded when trying to connect" errors:
- Increase serverless PG pool max (default: 20)
- Increase connection timeout (default: 60s)
- Enable concurrency limiting for bank queries (max 5)
- Stagger agent refresh intervals to distribute load

### EVM Contract Deployment Issues

**Deployment fails with "Invalid TREASURY_ADDRESS":**
- Ensure `TREASURY_ADDRESS` is set for mainnet deployments
- Verify address is a valid Ethereum address (checksummed)

**Deployment fails with "insufficient funds":**
- Check deployer wallet balance
- Ensure wallet has enough native tokens for gas (BNB for BSC, ETH for Base)

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
- Regenerate types if contract interfaces changed

### Betting Stack Deployment Issues

**Preflight validation fails:**
- Check that Solana program keypairs match deployment manifest
- Verify Anchor IDL files are in sync with build output
- Ensure EVM environment variables are configured
- Run `bun run deploy:preflight:testnet` or `bun run deploy:preflight:mainnet` for detailed error messages

**Keeper returns fallback duel data:**
- Verify `STREAM_STATE_SOURCE_URL` is set and the upstream duel server is responding
- Test upstream endpoint: `curl https://your-stream-source.example/api/streaming/state`

**Points/referrals not persisting:**
- Keeper uses ephemeral SQLite by default on Railway
- For persistence: attach Railway persistent volume and set `KEEPER_DB_PATH=/mnt/data/keeper.sqlite`
- Or migrate to external database (PostgreSQL, MySQL, etc.)

**Build fails with "Leaked secret detected":**
- Remove provider-keyed RPC URLs from `VITE_*` environment variables
- Use RPC proxying instead: set `VITE_USE_GAME_RPC_PROXY=true` and `VITE_USE_GAME_EVM_RPC_PROXY=true`
- Keep provider URLs on Railway keeper (server-side only)
- Build-time validation checks for Helius, Alchemy, Infura, QuickNode, and dRPC patterns

**EVM contract tests fail with type errors:**
- Ensure `typed-contracts.ts` is imported correctly
- Use typed deployment helpers: `deployGoldClob()`, `deploySkillOracle()`, etc.
- Check that contract ABIs haven't changed (regenerate types if needed)

## Betting Stack Architecture

### Deployment Metadata System

**Centralized Contract Management** (PR #989):

All contract addresses and program IDs are managed in a single source of truth:
- `packages/gold-betting-demo/deployments/contracts.json` - Shared deployment manifest
- `packages/gold-betting-demo/deployments/index.ts` - Typed configuration with runtime validation

**Benefits:**
- Single source of truth for all contract addresses
- Type-safe access to deployment metadata
- Automatic validation of manifest structure
- Shared across frontend, keeper, and deployment scripts

**EVM Deployment Receipts:**

Each EVM deployment writes a detailed receipt to `packages/evm-contracts/deployments/<network>.json`:

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

The deploy script automatically updates the central `contracts.json` manifest after successful deployment.

### Typed Contract Helpers

**Type-Safe Contract Deployment** (PR #989):

The `packages/evm-contracts/typed-contracts.ts` module provides fully typed deployment helpers:

```typescript
import { 
  deployGoldClob, 
  deploySkillOracle, 
  deployMockErc20,
  deployAgentPerpEngine,
  deployAgentPerpEngineNative 
} from '../typed-contracts';

// Type-safe deployment with IntelliSense
const clob = await deployGoldClob(treasuryAddress, marketMakerAddress, signer);
const oracle = await deploySkillOracle(initialBasePrice, signer);
const mockToken = await deployMockErc20("USDC", "USDC", signer);
const perpEngine = await deployAgentPerpEngine(oracleAddress, marginTokenAddress, skewScale, signer);

// Typed contract interfaces
const match: GoldClobMatch = await clob.matches(matchId);
const position: GoldClobPosition = await clob.positions(matchId, trader);
const order: GoldClobOrder = await clob.orders(orderId);
```

**Available contract interfaces:**
- `GoldClobContract` - CLOB market with typed methods
- `SkillOracleContract` - Oracle with typed skill updates
- `MockERC20Contract` - Test token with typed mint/approve
- `AgentPerpEngineContract` - Perps engine with typed position management
- `AgentPerpEngineNativeContract` - Native token perps engine

**Benefits:**
- Compile-time type checking for all contract interactions
- IntelliSense support in tests and scripts
- Prevents common errors (wrong parameter types, missing overrides)
- Consistent deployment patterns across test suites

**Usage in tests:**

All EVM contract tests now use typed helpers instead of raw `ethers.getContractFactory()`:

```typescript
// Before
const GoldClob = await ethers.getContractFactory("GoldClob");
const clob = await GoldClob.deploy(treasury.address, marketMaker.address);

// After
const clob = await deployGoldClob(treasury.address, marketMaker.address);
```

### Perps Market Lifecycle

**Market States** (commits 43911165, 8322b3f, 1043f0a):

The perpetual futures markets support three lifecycle states for managing model deprecation:

**ACTIVE** - Normal trading:
- New positions allowed
- Position increases/decreases allowed
- Requires fresh oracle updates (within `max_oracle_staleness_seconds`)
- Funding rate drifts based on market skew
- Uses live `spot_index` for pricing

**CLOSE_ONLY** - Model deprecated:
- New positions blocked (`MarketCloseOnly` error)
- Position increases blocked
- Position reductions and closes allowed
- Settlement price frozen at `settlement_spot_index`
- No oracle updates required (uses frozen price)
- Funding rate frozen

**ARCHIVED** - Market fully wound down:
- All trading blocked (`MarketArchived` error)
- Requires zero `total_long_oi`, zero `total_short_oi`, and zero `open_positions`
- Can be reactivated to ACTIVE if model returns

**State Transition Instructions:**

```rust
// Deprecate a model (freeze settlement price)
set_market_status(market_id, CLOSE_ONLY, settlement_spot_index)

// Archive a fully-closed market
set_market_status(market_id, ARCHIVED, 0)

// Reactivate an archived market
set_market_status(market_id, ACTIVE, 0)
```

**Fee Management:**

Trade fees are split between treasury and market maker:

```rust
// Configure fee rates (BPS)
initialize_config(
  keeper_authority,
  treasury_authority,
  market_maker_authority,
  // ... other params
  trade_treasury_fee_bps: 25,      // 0.25% to treasury
  trade_market_maker_fee_bps: 25,  // 0.25% to market maker
)
```

**Fee operations:**
- `recycle_market_maker_fees(market_id, amount)` - Recycle market maker fees into isolated insurance
- `withdraw_fee_balance(market_id, fee_bucket, amount)` - Withdraw treasury or market maker fees
- Fee balances are reserved from free liquidity calculations (prevents insurance fund contamination)

**Slippage Protection:**

The `modify_position` instruction now accepts an `acceptable_price` parameter:

```rust
modify_position(
  market_id,
  margin_delta,
  size_delta,
  acceptable_price,  // New parameter
)
```

- Longs: execution price must be ≤ acceptable price
- Shorts: execution price must be ≥ acceptable price
- Set to 0 to disable slippage check (backwards compatible)

**Breaking Changes:**

- Market ID type changed from `u32` to `u64` (larger ID space)
- PDA derivation uses 8-byte encoding (was 4-byte)
- Account sizes increased for new fee tracking fields
- Requires fresh program deployment (incompatible with existing markets)

### Preflight Validation

Before deploying to any network, run preflight checks:

```bash
cd packages/gold-betting-demo
bun run deploy:preflight:testnet    # Validate testnet deployment
bun run deploy:preflight:mainnet    # Validate mainnet deployment
```

**Validation checks:**
- ✅ Solana program keypairs match deployment manifest
- ✅ Anchor IDL files match deployment manifest
- ✅ App and keeper IDL files are in sync
- ✅ EVM deployment environment variables are configured
- ✅ EVM RPC URLs are available (configured or fallback)
- ✅ Contract addresses are present in deployment manifest

**Warnings vs Failures:**
- **Warnings**: Missing RPC URLs (will use fallbacks), pending contract addresses
- **Failures**: Mismatched program IDs, missing required env vars, invalid addresses

### Solana Program Deployment

Deploy all three Solana betting programs:

```bash
cd packages/gold-betting-demo/anchor
bun run deploy:testnet      # Deploy to Solana testnet
bun run deploy:mainnet      # Deploy to Solana mainnet-beta
```

**Programs deployed:**
- `fight_oracle` - Match lifecycle and winner posting
- `gold_clob_market` - GOLD CLOB market for binary prediction trading
- `gold_perps_market` - Perpetual futures market for agent skill ratings

**Wallet auto-discovery** (in priority order):
1. `$ANCHOR_WALLET` environment variable
2. `~/.config/solana/hyperscape-keys/deployer.json`
3. `~/.config/solana/id.json`

**Requirements:**
- Solana CLI installed
- Deployer wallet with ~4+ SOL for all three programs
- Program keypairs in `target/deploy/`

**Skip build** (if already built):
```bash
SKIP_BUILD=1 bun run deploy:mainnet
```

### EVM Contract Deployment

Deploy GoldClob contracts to EVM networks:

```bash
cd packages/evm-contracts

# Testnet
bun run deploy:bsc-testnet
bun run deploy:base-sepolia

# Mainnet (requires explicit addresses)
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Deployment process:**
1. Validates treasury and market maker addresses
2. Deploys GoldClob contract
3. Writes deployment receipt to `deployments/<network>.json`
4. Updates central manifest at `../gold-betting-demo/deployments/contracts.json`

**Mainnet safety:**
- Requires explicit `TREASURY_ADDRESS` and `MARKET_MAKER_ADDRESS`
- Fails if required addresses are missing (prevents accidental use of deployer address)

**Skip manifest update** (for testing):
```bash
SKIP_BETTING_MANIFEST_UPDATE=true bun run deploy:bsc-testnet
```

## Additional Resources

- [README.md](README.md) - Full project documentation
- [AGENTS.md](AGENTS.md) - AI coding assistant instructions and feature documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- [docs/betting-production-deploy.md](docs/betting-production-deploy.md) - Betting stack deployment guide (Cloudflare + Railway)
- [docs/evm-contracts-deployment.md](docs/evm-contracts-deployment.md) - EVM contract deployment guide (BSC, Base)
- [docs/duel-stack.md](docs/duel-stack.md) - Duel stack documentation
- Game Design Document: See `.cursor/rules/gdd.mdc`
