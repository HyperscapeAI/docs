# AGENTS.md

Instructions for AI coding assistants (GitHub Copilot, Cursor, etc.) working with this codebase.

## CRITICAL: WebGPU Required (NO WebGL)

**Hyperscape requires WebGPU. WebGL WILL NOT WORK.**

This is a hard requirement. DO NOT:
- Add WebGL fallback code
- Use `--disable-webgpu` flags
- Use `forceWebGL` parameters
- Create headless Chrome configurations without GPU/WebGPU support
- Suggest WebGL as an alternative

### Why WebGPU-Only?
- All materials use TSL (Three Shading Language) which ONLY works with WebGPU
- Post-processing effects use TSL-based node materials
- There is NO WebGL fallback path - the game simply won't render

### Browser Requirements
- Chrome 113+, Edge 113+, Safari 18+ (macOS 15+)
- WebGPU must be available and working
- Check: [webgpureport.org](https://webgpureport.org)
- Note: Safari 17 support was removed - Safari 18+ (macOS 15+) is now required

### Server/Streaming (Vast.ai)
- **NVIDIA GPU with Display Driver REQUIRED**: Must have `gpu_display_active=true` on Vast.ai
- **Display Driver vs Compute**: WebGPU requires GPU display driver support, not just compute access
- Must run non-headless with Xorg or Xvfb (WebGPU requires window context)
- Chrome uses ANGLE/Vulkan for WebGPU
- If WebGPU cannot initialize, deployment MUST FAIL

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on Three.js WebGPURenderer with TSL shaders.

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces

## Tech Stack

- Runtime: Bun v1.3.10+ (updated from v1.1.38)
- Rendering: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- Engine: Three.js 0.182.0, PhysX (WASM)
- UI: React 19.2.0
- Server: Fastify, WebSockets
- Database: PostgreSQL (production), Docker (local)
- Testing: Vitest 4.x (upgraded from 2.x for Vite 6 compatibility)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
bun run duel         # Full duel stack (game + agents + betting + streaming)
npm test             # Run tests
```

## File Structure

```
packages/
├── shared/          # Core engine (ECS, Three.js, PhysX, networking, React UI)
├── server/          # Game server (Fastify, WebSockets, PostgreSQL)
├── client/          # Web client (Vite + React)
├── plugin-hyperscape/ # ElizaOS AI agent plugin
├── physx-js-webidl/ # PhysX WASM bindings
├── procgen/         # Procedural generation
├── asset-forge/     # AI asset generation + VFX catalog
├── gold-betting-demo/ # Solana/EVM betting stack (app + keeper + anchor programs)
├── evm-contracts/   # EVM betting contracts (Hardhat + Foundry)
├── contracts/       # MUD onchain game state (experimental)
├── sim-engine/      # Cross-chain betting risk simulation
└── market-maker-bot/ # Automated market making for betting markets
```

## Agent Memory Management (March 2026)

### InMemoryDatabaseAdapter Migration

**Problem**: Each of 19 agents was allocating ~2-4GB for a PGLite WASM instance they never used (all memory features disabled), causing 38-76GB total memory bloat.

**Solution** (commit 429bfbf): Swap to ElizaOS's built-in InMemoryDatabaseAdapter — zero WASM overhead, all 19 agents still run.

**Changes**:
- ModelAgentSpawner: pass InMemoryDatabaseAdapter to AgentRuntime, remove SQL plugin loading, PGLite retry/reset logic
- ElizaDuelBot: same treatment — InMemoryDatabaseAdapter, no SQL plugin
- agentHelpers: remove PGLITE_DATA_DIR from character secrets
- Add Bun.gc(true) hint after agent stop for faster memory reclaim

**Impact**: Reduced agent memory footprint from 38-76GB to <5GB for 19 agents.

### Memory Accumulation Caps

**Problem**: InMemoryDatabaseAdapter stores every createMemory() call forever in Maps. With 19 agents creating memories on every combat/resource event, this causes unbounded heap growth (~15GB+ within minutes).

**Solution** (commit c2661430): Cap each agent to 50 memories via ring buffer (evict oldest on overflow).

**Why 50 memories**:
- Agents only read last 5+20 memories for LLM context
- 50 provides sufficient history without unbounded growth
- Ring buffer automatically evicts oldest when limit exceeded

**Additional Caps** (commit 5ae4be9):
- **Adapter logs**: Cap at 20 entries (was unbounded) — stores full LLM prompts+responses per useModel() call
- **Adapter cache**: Cap at 100 entries with LRU eviction (was unbounded)
- **Adapter deleteMemory()**: Override to also clean memoriesByRoom (not just memoriesById)
- **Periodic adapter flush**: Every 60s for entities/rooms/worlds/tasks
- **State cache flush**: When over 100 entries per agent runtime
- **Encounter cache**: Cap at 50 entries per agent with LRU eviction
- **Previous mob health map**: Prune at 100 entries to prevent growth

**Periodic Garbage Collection** (commit c2661430):
- Add periodic Bun.gc(false) every 20 ticks (~60s) per agent
- Reclaims short-lived allocations from composeState/useModel calls
- Non-blocking GC (false flag) to avoid frame drops

**Diagnostic Health Logging** (commit 5ae4be9):
- Add adapter verification after initialize() to detect plugin overrides
- Log adapter state monitoring for debugging memory issues

### Database Connection Pool Optimization

**Problem**: 19 agents all requesting bank state simultaneously exhausts the DB pool ("timeout exceeded when trying to connect"), blocking agent initialization.

**Solution** (commit a312abe): Throttle concurrent bank queries and stagger agent refresh intervals.

**Concurrency Limiter**:
- Add concurrency limiter (max 5) to handleRequestBankState handler
- Bank queries queue instead of all hitting the pool at once
- Prevents DB pool exhaustion during agent initialization

**Staggered Refresh Intervals**:
- Add random offset to agent refresh intervals
- Prevents agents from synchronizing their 30s periodic bank/quest state refreshes
- Distributes DB load over time instead of spikes

**DB Pool Sizing** (commit afc15c3):
- Increase serverless PG pool max from 10 to 20
- Increase connection timeout from 30s to 60s
- Prevents pool exhaustion with many agents
- Standard pool: 20→30 for duel prep concurrency

### Sequential Agent Spawning

**Problem**: Spawning all agents in parallel causes concurrent ALTER TABLE races on Neon serverless PostgreSQL during SQL plugin migrations.

**Solution** (commit afc15c3): Spawn first agent sequentially so SQL plugin migrations complete before batching the rest.

**Implementation**:
```typescript
// Spawn first agent sequentially (migrations complete)
await spawnAgent(agents[0]);

// Batch spawn remaining agents in parallel
await Promise.all(agents.slice(1).map(spawnAgent));
```

**Impact**: Prevents concurrent migration conflicts on serverless PostgreSQL.

### Auto-Spawn Configuration

**Auto-spawn model agents when STREAMING_DUEL_ENABLED=true** (commit afc15c3):
- Simplifies duel stack setup (no manual agent spawning)
- Works even in dev mode when streaming duels are enabled
- Ensures agents are always available for duels

**Admin Dashboard Auth Simplification** (commit afc15c3):
- Single fetch attempt on mount instead of 120s polling loop with abort controllers
- Reduces complexity and improves reliability

## Duel System Improvements (March 2026)

### Expanded Model Roster

**19 AI Models** (commit f6a8ba3): Added GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, o4 Mini, o3 Mini (OpenAI), Claude Opus 4, Claude Sonnet 4 (Anthropic), and Llama 3.3 70B (Groq).

**Updated Claude Model IDs**: Opus 4.6 and Sonnet 4.6 (latest versions).

**MAX_MODEL_AGENTS**: Bumped default from 10 to 25 to accommodate expanded roster.

**Missing Anthropic Plugin** (commit 0a3b0af): Added missing `@elizaos/plugin-anthropic` dependency so Claude agents spawn correctly.

### Activity-Aware Idle Camera

**Problem**: Idle camera randomly selected agents, often showing inactive/idle agents instead of interesting gameplay.

**Solution** (commit 0a3b0af): Rewrote CameraDirector idle phase with weighted agent selection based on activity type.

**Activity Weights**:
- Combat: Highest priority (most interesting)
- Skilling: Medium priority (gathering, cooking, etc.)
- Moving: Low priority (traveling)
- Idle: Lowest priority (standing still)
- On-deck duel boost: Extra weight for agents selected for next duel

**Impact**: Camera now focuses on active gameplay instead of idle agents.

### Skill-Based Weapon Selection

**Problem**: Agents were assigned random combat roles regardless of their actual skill levels.

**Solution** (commit b71f512): Replace random combat role assignment with skill-based selection.

**Three-Source Weapon Scoring**:
1. **Equipped gear**: Check what agent is currently wearing
2. **Inventory**: Check what weapons agent is carrying
3. **Item manifest**: Check what weapons agent qualifies for based on levels

**Weapon Tier Scoring**:
- Bronze: Tier 1
- Iron: Tier 2
- Steel: Tier 3
- Mithril: Tier 4
- Adamant: Tier 5
- Rune: Tier 6

**Role Selection**:
- Pick strongest combat style (melee/ranged/mage) based on actual skill levels
- Equip best weapon agent qualifies for from equipped gear, inventory, or manifest
- Fallback to lower-tier weapons if agent doesn't meet level requirements

**Impact**: Agents now use weapons appropriate for their skill levels instead of random assignments.

### Strategic Duel Combat AI

**Problem**: Agents used basic attack loops without strategy, healing, or movement.

**Solution** (commit b71f512): Overhaul duel combat tick in AutonomousBehaviorManager with full strategic combat loop.

**Features**:
- **LLM-Generated Fight Plans**: Agents create combat strategies using their character personality
- **Phase-Aware Healing**: Desperate/trading/finishing/opening phases with different healing thresholds
- **Movement Strategies**: Chase/kite/circle/hold based on combat situation
- **Dynamic Style and Prayer Switching**: Adapt combat style and prayers based on HP and phase
- **Cooldown-Tracked Trash Talk**: Personality-driven LLM taunts with cooldown system
- **Streaming-Duel Awareness**: Avoids cancelling server-managed combat loops

**Combat Phases**:
- **Opening** (100-75% HP): Buff with prayers, establish position
- **Trading** (75-40% HP): Aggressive combat, style switching
- **Finishing** (40-25% HP): Focus on damage output
- **Desperate** (<25% HP): Emergency healing, defensive prayers

**Movement AI**:
- **Chase**: Pursue fleeing opponent (melee vs ranged)
- **Kite**: Maintain distance (ranged vs melee)
- **Circle**: Strafe around opponent (balanced matchup)
- **Hold**: Stand ground (mage with autocast)

**Impact**: Agents now fight strategically instead of mindlessly attacking.

### Duel Event Broadcasting

**New Events** (commit b71f512):
- `duel:start` - Fired when duel begins
- `duel:end` - Fired when duel ends

**Combat Spell/Rune Data Exports**: Exported from shared package for mage spell selection.

### On-Deck Duel Notification

**Problem**: Agents only had ~4s countdown to prepare for duels, not enough time to bank items and withdraw food.

**Solution** (commit 656fdb7): Notify agents when they're selected as the next duel pair so they get the full fight duration (~5+ min) to prepare.

**Preparation State Machine**:
1. Agent receives `duelOnDeck` packet
2. Agent banks items
3. Agent withdraws food
4. Agent moves to arena lobby
5. Countdown starts when both agents ready

**New Packets**:
- `duelOnDeck` - Notifies agent they're selected for next duel
- `duelCountdownStart` - Countdown begins
- `duelCountdownTick` - Countdown tick update
- `duelOpponentDisconnected` - Opponent disconnected during duel
- `duelOpponentReconnected` - Opponent reconnected

**Impact**: Agents have sufficient time to prepare for duels instead of rushing.

### Duel Pipeline Audit Fixes

**18 Audit Findings Fixed** (commit 4c16ea3):

**Prayer ID Fixes**:
- Fixed nonexistent prayer IDs (ultimate_strength/steel_skin → superhuman_strength/rock_skin/hawk_eye/mystic_lore)
- Affected DuelCombatAI, ABM, and tests

**Combat AI Improvements**:
- Prayer reconciliation from entity state
- Movement AI with role-based kiting/chasing
- Context-aware healing
- Finishing phase aggression
- Desperate mode for all roles
- Faster style switching (mod 2 + immediate on phase change)
- Faster LLM replan (4s)
- Weapon-aware style selection (accurate for mid-HP)
- Buff phase prayer activation

**Broadcast Improvements**:
- 200ms fight broadcast during FIGHTING phase for smoother spectator updates

**Simultaneous Death Handling**:
- Via damage comparison (higher damage wins)

**Announcement Early-Exit**:
- After MIN_ANNOUNCEMENT_DURATION when both agents ready

**Combat Stall Nudges**:
- Escalating damage nudges (increasing damage, alternating targets)

**Autocast Spell Validation**:
- After staff fallback to ensure element match

**Draw Outcome**:
- Equal HP + damage = draw (not coin flip)

**Streaming Duel History**:
- New `streaming_duel_history` table
- Async persistence in MatchmakingManager
- `updateDrawStats()` for draw outcomes without affecting win/loss/streak

**Impact**: Duel system is now production-ready with proper edge case handling.

## Server Features (March 2026)

### Graceful Restart API

**Feature** (commit c76ca516): Zero-downtime deployments for the duel arena stream.

**Endpoints**:
- `POST /admin/graceful-restart` - Request restart after current duel
- `GET /admin/restart-status` - Check if restart is pending
- `StreamingDuelScheduler.requestGracefulRestart()` - Programmatic API

**Behavior**:
- If no duel active: restart immediately via SIGTERM
- If duel in progress: wait until RESOLUTION phase completes
- PM2 automatically restarts the server with new code

**Use Case**: Deploy code updates without interrupting live duels.

### Streaming Placeholder Mode

**Feature** (commit 83056565): Prevents stream disconnects during idle periods.

**Configuration**:
```bash
STREAM_PLACEHOLDER_ENABLED=true  # Enable placeholder mode (default: false)
```

**Behavior**:
- Detects when no frames are received for 5 seconds
- Switches to placeholder mode, sending minimal JPEG frames at configured FPS
- Automatically exits placeholder mode when live frames resume
- Keeps Twitch/YouTube streams alive during content gaps
- Prevents 30-minute disconnect that occurs when streams appear "idle"

**Technical Details**:
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size
- Maintains configured FPS to satisfy platform requirements
- Zero impact on live stream quality when frames are flowing

### Railway Database Detection

**Improvements** (commits d8c26d2, a5a201c):

**Detection Methods** (in priority order):
1. `RAILWAY_ENVIRONMENT` env var (most reliable, auto-set by Railway)
2. `.railway.internal` hostname (internal connections)
3. `.rlwy.net` hostname (Railway proxy)
4. `.railway.app` hostname (direct connections)

**Automatic Optimizations**:
- Disables prepared statements when using Railway proxy
- Uses lower connection pool limits (max: 6) for pooler connections
- Detects pgbouncer/Supavisor poolers for compatibility mode

**Impact**: Fixes "too many clients already" errors on Railway deployments.

## Testing & CI Improvements (March 2026)

### Vitest 4.x Upgrade

**Breaking Change** (commit a916e4e): Vitest 2.x is incompatible with Vite 6.x.

**Changes**:
- Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6
- Fixes `__vite_ssr_exportName__` errors during test runs
- All packages using Vitest must use 4.x for Vite 6 compatibility

**Migration**:
- Update `vitest` and `@vitest/coverage-v8` to `^4.0.6` in package.json
- No API changes required - tests continue to work as-is

### CI Stabilization

**Test Fixes** (commits 23323ac, 2ae03b4, 83a3452, 4b47012):
- Fixed client test runner resolution
- Stabilized duel agent tests and client CI builds
- Stabilized vegetation concurrency test
- Fixed asset forge CI module resolution

**Anchor Test Configuration** (commit 8b7d126):
- Skip anchor localnet tests in CI when Solana CLI is not installed
- Prevents false failures in environments without Solana toolchain
- Tests run normally in local development with Solana CLI

## EVM Contract Deployment Infrastructure (March 2026)

### Centralized Deployment Metadata

**Feature** (PR #989): Unified contract address management across Solana and EVM chains.

**Deployment Manifest**:
- `packages/gold-betting-demo/deployments/contracts.json` - Single source of truth for all contract addresses
- `packages/gold-betting-demo/deployments/index.ts` - Typed configuration with runtime validation

**Benefits**:
- Eliminates hardcoded addresses scattered across codebase
- Type-safe access to deployment metadata
- Automatic validation of manifest structure
- Shared across frontend, keeper, deployment scripts, and tests

**EVM Deployment Receipts**:

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

**Feature** (PR #989): Type-safe contract deployment and interaction helpers.

**Module**: `packages/evm-contracts/typed-contracts.ts`

**Deployment Functions**:
```typescript
import { deployGoldClob, deploySkillOracle, deployMockErc20 } from '../typed-contracts';

// Type-safe deployment with IntelliSense
const clob = await deployGoldClob(treasuryAddress, marketMakerAddress, signer);
const oracle = await deploySkillOracle(initialBasePrice, signer);
```

**Contract Interfaces**:
```typescript
interface GoldClobContract {
  createMatch(): Promise<ContractTransactionResponse>;
  placeOrder(matchId, isBuy, price, amount, overrides?): Promise<ContractTransactionResponse>;
  matches(matchId): Promise<GoldClobMatch>;
  positions(matchId, trader): Promise<GoldClobPosition>;
  // ... fully typed methods
}

type GoldClobMatch = {
  status: bigint;
  winner: bigint;
  yesPool: bigint;
  noPool: bigint;
};
```

**Benefits**:
- Compile-time type checking for all contract interactions
- IntelliSense support in tests and scripts
- Prevents common errors (wrong parameter types, missing overrides)
- Consistent deployment patterns across test suites

### Preflight Validation System

**Feature** (PR #989): Pre-deployment validation to catch configuration errors before touching real chains.

**Commands**:
```bash
cd packages/gold-betting-demo
bun run deploy:preflight:testnet    # Validate testnet deployment
bun run deploy:preflight:mainnet    # Validate mainnet deployment
```

**Validation Checks**:
- ✅ Solana program keypairs match deployment manifest addresses
- ✅ Anchor IDL files match deployment manifest addresses
- ✅ App and keeper IDL files are in sync with Anchor build output
- ✅ EVM deployment environment variables are configured
- ✅ EVM RPC URLs are available (configured or using Hardhat fallbacks)
- ✅ Contract addresses are present in deployment manifest

**Warnings vs Failures**:
- **Warnings**: Missing RPC URLs (will use fallbacks), pending contract addresses
- **Failures**: Mismatched program IDs, missing required env vars, invalid addresses

**Impact**: Prevents deployment failures and configuration drift by validating all metadata before deployment.

### Code Quality Improvements

**GLTFExporter Static Imports** (PR #989):

Converted dynamic `import()` calls to static imports across asset-forge package:

**Before**:
```typescript
const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
const exporter = new GLTFExporter();
```

**After**:
```typescript
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
const exporter = new GLTFExporter();
```

**Files Updated**:
- `packages/asset-forge/src/components/ArmorFitting/MeshFittingDebugger/hooks/useExportHandlers.ts`
- `packages/asset-forge/src/services/fitting/ArmorFittingService.ts`
- `packages/asset-forge/src/services/fitting/BoneDiagnostics.ts`

**Benefits**:
- Better tree-shaking (bundler can analyze static imports)
- Cleaner code (no async import boilerplate)
- Faster module loading (no dynamic import overhead)

**VFX Preview Dead Code Removal** (PR #989):

Removed unused variables and code paths in `packages/asset-forge/src/components/VFX/VFXPreview.tsx`:
- Unused `opacity` calculations in glow particles (pillar, wisp, spark, base, riseSpread)
- Unused `primaryColor`, `whiteGlow`, `ringMat` variables
- Unused `effect` prop in `TeleportScene` component
- Added `isCombatHud()` type guard for proper type narrowing

**Impact**: Reduces bundle size and improves code maintainability.

**WeaponHandleDetector Cross-Runtime Compatibility** (PR #989):

Added cross-runtime file writing utility to support both Bun and Node.js:

```typescript
async function writeArrayBufferToFile(
  outputPath: string,
  data: ArrayBuffer,
): Promise<void> {
  const globalObj = globalThis as Record<string, unknown>;
  if (
    globalObj.Bun &&
    typeof (globalObj.Bun as { write: unknown }).write === "function"
  ) {
    const bunRuntime = globalObj.Bun as {
      write: (path: string, data: ArrayBuffer) => Promise<void>;
    };
    await bunRuntime.write(outputPath, data);
    return;
  }

  const fsModuleId = "node:fs/promises";
  const { writeFile } = (await import(
    /* @vite-ignore */ fsModuleId
  )) as typeof import("node:fs/promises");
  await writeFile(outputPath, new Uint8Array(data));
}
```

**Impact**: Asset-forge tools work correctly in both Bun and Node.js environments.

**Client Panel Registry Optimization** (PR #989):

Un-lazified critical game panels for better initial load performance:

```typescript
// Before: Lazy-loaded panels
const InventoryPanel = lazy(() => import("../../game/panels/InventoryPanel"));
const StatsPanel = lazy(() => import("../../game/panels/StatsPanel"));
const PrayerPanel = lazy(() => import("../../game/panels/PrayerPanel"));
const SpellsPanel = lazy(() => import("../../game/panels/SpellsPanel"));

// After: Static imports for critical panels
import { InventoryPanel } from "../../game/panels/InventoryPanel";
import { StatsPanel } from "../../game/panels/StatsPanel";
import { PrayerPanel, PRAYER_PANEL_DIMENSIONS } from "../../game/panels/PrayerPanel";
import { SpellsPanel, SPELLS_PANEL_DIMENSIONS } from "../../game/panels/SpellsPanel";
```

**Rationale**: These panels are always visible or frequently accessed during gameplay, so lazy loading adds unnecessary delay. Other panels (Equipment, Quest, Friends, etc.) remain lazy-loaded.

**Impact**: Faster initial panel rendering, reduced layout shift during gameplay.

**Betting App Lazy Loading** (commit 43911165):

Heavy betting surfaces are now lazy-loaded to reduce initial bundle size:

```typescript
// Lazy-loaded betting components
const EvmBettingPanel = lazy(() => import("./components/EvmBettingPanel"));
const SolanaClobPanel = lazy(() => import("./components/SolanaClobPanel"));
const ModelsMarketView = lazy(() => import("./components/ModelsMarketView"));
const PointsLeaderboard = lazy(() => import("./components/PointsLeaderboard"));
const PointsHistory = lazy(() => import("./components/PointsHistory"));
const ReferralPanel = lazy(() => import("./components/ReferralPanel"));
const AgentStats = lazy(() => import("./components/AgentStats"));

// Usage with Suspense and loading fallback
<Suspense fallback={<PanelFallback label="Loading market" minHeight={360} />}>
  <SolanaClobPanel agent1Name={agent1} agent2Name={agent2} />
</Suspense>
```

**Tab switching optimization:**

```typescript
// Use startTransition for non-urgent UI updates
onClick={() => startTransition(() => setSurfaceMode("MODELS"))}
```

**Impact**: 
- Reduces initial bundle size by deferring heavy components
- Improves time-to-interactive for betting app
- Smoother tab transitions with React 19 concurrent features

**Dashboard Background Styling** (PR #989):

Updated dashboard background from image-based to gradient-based for faster loading:

```css
/* Before */
background-image: url('/assets/background.jpg');

/* After */
background-image:
  radial-gradient(circle at top, rgba(242, 208, 138, 0.14), transparent 36%),
  linear-gradient(180deg, rgba(30, 20, 10, 0.72) 0%, rgba(11, 10, 21, 0.96) 100%);
```

**Impact**: Eliminates HTTP request for background image, faster initial render.

**Custom EVM Chain ID Support** (commits c04770449, d864c738):

Added support for custom local EVM chain IDs in E2E tests:

```typescript
// From packages/gold-betting-demo/app/scripts/run-e2e-local.sh
# Read actual chain ID from Anvil
ACTUAL_EVM_CHAIN_ID="$(read_anvil_chain_id)"
if [[ "$ACTUAL_EVM_CHAIN_ID" != "$EVM_CHAIN_ID" ]]; then
  echo "[e2e] anvil reported chain id ${ACTUAL_EVM_CHAIN_ID} (requested ${EVM_CHAIN_ID})"
fi
EVM_CHAIN_ID="$ACTUAL_EVM_CHAIN_ID"
```

**Impact**: E2E tests work correctly with Anvil's default chain ID (31337) instead of requiring BSC testnet chain ID (97).

**Noble ed25519 Import Alignment** (commit abefb258):

Fixed Solana compatibility issues with noble ed25519 imports:

```typescript
// Ensures consistent cryptographic library usage across betting stack
// Prevents import conflicts between @solana/web3.js and @noble/ed25519
```

**Impact**: Resolves Solana transaction signing issues in betting stack.

**CI Polyfill Shims** (commit bb8ec820):

Added polyfill shims for betting stack tests in CI:

```typescript
// Prevents test failures in headless environments
// Ensures Node.js polyfills work correctly in Vite test environment
```

**Impact**: Betting stack tests pass reliably in CI environments.

## EVM Contract Testing Improvements (March 2026)

### Typed Contract Migration

**Feature** (PR #989): All EVM contract tests now use typed deployment helpers.

**Before:**
```typescript
const GoldClob = await ethers.getContractFactory("GoldClob");
const clob = await GoldClob.deploy(treasury.address, marketMaker.address);
await clob.waitForDeployment();
```

**After:**
```typescript
import { deployGoldClob } from "../typed-contracts";

const clob = await deployGoldClob(treasury.address, marketMaker.address);
await clob.waitForDeployment();
```

**Files updated:**
- `test/GoldClob.ts` - Basic functionality tests
- `test/GoldClob.exploits.ts` - Exploit resistance tests
- `test/GoldClob.fuzz.ts` - Randomized invariant tests
- `test/GoldClob.round2.ts` - Round 2 security fixes
- `test/AgentPerpEngine.ts` - Perps engine tests
- `test/AgentPerpEngineNative.ts` - Native token perps tests

**Benefits:**
- Compile-time type checking for all contract interactions
- IntelliSense support in test files
- Prevents common errors (wrong parameter types, missing overrides)
- Consistent deployment patterns across test suites

### Fee Routing Test Coverage

**New tests** (commits 43911165, 8322b3f):

**GoldClob fee routing test:**
```typescript
it("routes trade fees to treasury and market maker, then routes claim fees to the market maker", async function () {
  // Validates:
  // 1. Trade fees split between treasury and market maker
  // 2. Claim fees route to market maker
  // 3. Fee balances accumulate correctly
  
  const treasuryAfterTrades = await ethers.provider.getBalance(treasury.address);
  const marketMakerAfterTrades = await ethers.provider.getBalance(marketMaker.address);
  
  expect(treasuryAfterTrades - treasuryBefore).to.equal(
    makerTreasuryFee + takerTreasuryFee,
  );
  expect(marketMakerAfterTrades - marketMakerBefore).to.equal(
    makerMmFee + takerMmFee,
  );
  
  // After claim
  const claimFee = (amount * winningsMarketMakerFeeBps) / 10_000n;
  expect(marketMakerAfterClaim - marketMakerAfterTrades).to.equal(claimFee);
});
```

**Impact**: Comprehensive validation of fee routing through full CLOB lifecycle.

### Gas Cost Calculation Fixes

**Fix** (PR #989): Fixed gas cost calculations in tests to handle BigInt properly.

**Before:**
```typescript
const gasCost = receipt!.gasUsed * receipt!.gasPrice;
```

**After:**
```typescript
const gasCost = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice);
```

**Impact**: Prevents type errors and ensures accurate gas cost calculations in tests.

### Anchor Vendor Dependencies

**Feature** (PR #989): Added vendored Solana dependencies to fix Anchor build compatibility.

**Dependencies Added**:
- `solana-loader-v3-interface` (v5.0.0) - Loader v3 interface with bincode support
- `solana-sdk-ids` (v2.2.1) - SDK ID definitions

**Location**: `packages/gold-betting-demo/anchor/vendor/anchor-lang-0.31.1/`

**Changes**:
- Updated `Cargo.toml` to include new dependencies:
  ```toml
  [dependencies.solana-loader-v3-interface]
  version = "5.0.0"
  features = ["bincode"]

  [dependencies.solana-sdk-ids]
  version = "2.2.1"
  ```
- Fixed `system_program::ID` references to use `crate::system_program::ID`
- Added explicit lifetime annotations to `AccountLoader` methods:
  ```rust
  pub fn load(&self) -> Result<Ref<'_, T>>
  pub fn load_mut(&self) -> Result<RefMut<'_, T>>
  pub fn load_init(&self) -> Result<RefMut<'_, T>>
  ```

**Impact**: Resolves Anchor build warnings and ensures compatibility with Solana SDK v2.x.

### Anchor Build Improvements

**Feature** (PR #989): Reduced Anchor build logging noise.

**Changes**:
- Set `RUST_LOG=cargo_build_sbf=error` during Anchor builds
- Suppresses verbose cargo-build-sbf output
- Preserves existing `RUST_LOG` configuration if set

**Implementation**:
```bash
# From packages/gold-betting-demo/anchor/scripts/build-workspace.sh
BASE_RUST_LOG="${RUST_LOG:-}"
ANCHOR_RUST_LOG="${BASE_RUST_LOG:+${BASE_RUST_LOG},}cargo_build_sbf=error"
export RUST_LOG="${ANCHOR_RUST_LOG}"
```

**Script**: `packages/gold-betting-demo/anchor/scripts/build-workspace.sh`

**Impact**: Cleaner build output with better signal-to-noise ratio for debugging build failures.

### Anchor Test Timeout Increases

**Feature** (PR #989): Increased test timeouts for more reliable CI runs.

**Changes**:
- RPC wait timeout: 90s → 180s
- Program deployment wait timeout: 90s → 180s

**Script**: `packages/gold-betting-demo/anchor/scripts/run-localnet-tests.sh`

**Impact**: Prevents false test failures in CI environments with slower disk I/O or network latency.

### Solana Program Deployment Scripts

**Feature** (PR #989): Automated Solana program deployment with wallet auto-discovery.

**Script**: `packages/gold-betting-demo/anchor/scripts/deploy-programs.sh`

**Commands**:
```bash
cd packages/gold-betting-demo/anchor
bun run deploy:testnet      # Deploy to Solana testnet
bun run deploy:mainnet      # Deploy to Solana mainnet-beta
```

**Programs Deployed**:
- `fight_oracle` - Match lifecycle and winner posting
- `gold_clob_market` - GOLD CLOB market for binary prediction trading
- `gold_perps_market` - Perpetual futures market for agent skill ratings

**Wallet Auto-Discovery** (in priority order):
1. `$ANCHOR_WALLET` environment variable
2. `~/.config/solana/hyperscape-keys/deployer.json`
3. `~/.config/solana/id.json`

**Deployment Process**:
1. Builds Anchor workspace (unless `SKIP_BUILD=1`)
2. Verifies program keypairs and binaries exist
3. Deploys each program using `solana program deploy`
4. Verifies deployment with `solana program show`

**Skip Build**:
```bash
SKIP_BUILD=1 bun run deploy:mainnet
```

**Impact**: Streamlines Solana program deployment with automatic validation and consistent deployment process.

### EVM Contract Deployment Automation

**Feature** (PR #989): Automated EVM contract deployment with receipt generation and manifest updates.

**Script**: `packages/evm-contracts/scripts/deploy.ts`

**Commands**:
```bash
cd packages/evm-contracts

# Testnet
bun run deploy:bsc-testnet
bun run deploy:base-sepolia

# Mainnet (requires explicit addresses)
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:bsc
TREASURY_ADDRESS=0x... MARKET_MAKER_ADDRESS=0x... bun run deploy:base
```

**Deployment Process**:
1. Validates treasury and market maker addresses
2. Deploys GoldClob contract
3. Writes deployment receipt to `deployments/<network>.json`
4. Updates central manifest at `../gold-betting-demo/deployments/contracts.json`

**Mainnet Safety**:
- Requires explicit `TREASURY_ADDRESS` and `MARKET_MAKER_ADDRESS` for mainnet
- Validates all addresses before deployment
- Fails if required addresses are missing (prevents accidental use of deployer address)

**Skip Manifest Update** (for testing):
```bash
SKIP_BETTING_MANIFEST_UPDATE=true bun run deploy:bsc-testnet
```

**Impact**: Ensures consistent deployment process with automatic metadata management and safety checks.

## Deployment Improvements (March 2026)

### Vast.ai Deployment Enhancements

**Process Management** (commits e065ef3, fad8885, 087033fa, 58d88f4c):
- **Production Environment Passthrough**: GitHub Actions writes secrets to `/tmp/hyperscape-secrets.env`
- **SSH-Local Health Checks**: Health checks run via SSH instead of HTTP for reliability
- **Targeted Process Killing**: Use specific process names instead of blanket `pkill -f bun`
- **Graceful PM2 Shutdown**: Stop PM2 with delays between commands
- **Process Teardown Before Migration**: Prevents "too many clients" errors during deployment

**Migration Improvements** (commit 46324033):
- **Deterministic Migrations**: Migrations run in sorted order for consistency
- **Sequential First Agent**: Prevents concurrent ALTER TABLE races on serverless PostgreSQL

**Solana Configuration** (commits 7fd94ffe, d4df6a4c, b71796b3, 54eef352):
- **Runtime Defaults**: PM2 config includes default Solana program IDs and gold mint
- **Environment Passthrough**: All deploy-time secrets passed into PM2 runtime
- **Auto-Discovery**: Solana authority auto-discovered from multiple candidate sources

### Betting Stack Integration

**Major Feature** (commits ba5617c through 43911165): Full Solana/EVM betting stack for streaming duels.

**Architecture**:
- **Frontend** (`packages/gold-betting-demo/app`): React betting UI with Solana/EVM wallet integration
- **Keeper** (`packages/gold-betting-demo/keeper`): Backend API for bet recording, market making, and oracle resolution
- **Anchor Programs** (`packages/gold-betting-demo/anchor`): Solana smart contracts for fight oracle, CLOB market, and perps market
- **EVM Contracts** (`packages/evm-contracts`): Hardhat/Foundry contracts for BSC/Base GOLD CLOB and perps
- **Sim Engine** (`packages/sim-engine`): Cross-chain risk simulation and attack fuzzing

**Key Features**:
- Dual-chain betting (Solana + EVM) with unified GOLD token
- CLOB (Central Limit Order Book) market for duel outcomes
- Perpetual futures market for agent skill ratings
- Points system with staking multipliers and referral tracking
- Market maker bot for liquidity seeding
- Oracle system for trustless duel outcome reporting

**Hardening** (commits d8e4d39, 8322b3f, 1043f0a, 43911165):
- Security audit passed for all Anchor programs
- Fuzz testing for exploit resistance
- Deterministic migration ordering for serverless PostgreSQL
- Noble ed25519 import alignment for Solana compatibility
- CI polyfill shims for betting stack tests

**Deployment**:
- Frontend: Cloudflare Pages
- Keeper: Railway with persistent SQLite or external DB
- Contracts: Deployed to Solana mainnet-beta and BSC/Base
- See `docs/betting-production-deploy.md` for full deployment guide

**CI/CD Workflows** (commits 43911165, 46cd28e, 66a7b23, a4e366c):
- **betting-ci.yml**: Type checking, linting, unit tests, keeper smoke test, env sanitization, production build verification
- **deploy-betting-keeper.yml**: Tests → smoke test → Railway deploy → endpoint verification
- **deploy-betting-pages.yml**: Build → dist hygiene → Cloudflare Pages deploy → build-info.json verification

**Security Hardening** (commit 43911165):
- Build-time secret leak detection (fails build if provider-keyed RPC URLs in public env vars)
- RPC proxying through keeper (keeps provider keys server-side)
- Removed committed API keys from tracked env files (keys must be rotated out-of-band)
- CI scans for leaked secrets in both env files and production dist
- Lazy-loading heavy betting surfaces to reduce initial bundle size

**Keeper Architecture**:
- Proxies Solana and EVM JSON-RPC for public app (keeps provider keys server-side)
- Serves betting API endpoints for points, leaderboard, referrals, and perps markets
- Polls upstream duel server for live stream state
- Manages autonomous market maker bot for liquidity seeding
- Defaults to ephemeral SQLite (attach Railway volume or external DB for persistence)

**Perps Market Lifecycle** (commits 43911165, 8322b3f, 1043f0a):
- **ACTIVE**: Normal trading with live oracle updates
- **CLOSE_ONLY**: Model deprecated, only position reductions allowed, frozen settlement price
- **ARCHIVED**: Zero open interest required, market fully wound down
- Supports reactivation (ARCHIVED → ACTIVE) when model returns

**Market Status Transitions**:
- `set_market_status` instruction controls lifecycle transitions
- ACTIVE → CLOSE_ONLY: Freezes settlement price, disables new positions
- CLOSE_ONLY → ARCHIVED: Requires zero open interest and zero open positions
- ARCHIVED → ACTIVE: Reactivates market, resets settlement price and funding time

**Slippage Protection** (commits 43911165, 8322b3f):
- `modify_position` now accepts `acceptable_price` parameter
- Longs: execution price must be ≤ acceptable price
- Shorts: execution price must be ≥ acceptable price
- Set to 0 to disable slippage check (backwards compatible)

**Fee Structure** (commits 43911165, 8322b3f):
- Trade fees split between treasury and market maker (configurable BPS)
- Claim fees route to market maker
- Market maker fees can be recycled into isolated insurance reserves via `recycle_market_maker_fees`
- Treasury fees can be withdrawn via `withdraw_fee_balance`
- Separate fee balance accounting prevents insurance fund contamination
- Fee balances reserved from free liquidity calculations

**Market ID Type Change** (commits 43911165, 8322b3f):
- Market ID changed from `u32` to `u64` for larger ID space
- PDA derivation uses 8-byte encoding (was 4-byte)
- Breaking change for existing deployments - requires fresh program deployment

**Workflow Reliability** (commits 66a7b23, a4e366c):
- Removed Railway status probe from keeper deploy workflow (unreliable)
- Persist Railway user token in keeper workflow for authentication
- Endpoint verification via direct HTTP health checks

**Streaming Configuration Defaults** (commits 2b42826, 4090123):
- Aligned stream defaults with Twitch production requirements
- Updated betting stream defaults for production deployment
- Improved Vast stream bootstrap configuration

## Branding Assets (March 2026)

### Git LFS Integration

**Feature** (commit f334c57): Binary branding files now tracked via Git LFS.

**Files Tracked**:
- `.ai` (Adobe Illustrator)
- `.eps` (Encapsulated PostScript)
- `.pdf` (Portable Document Format)
- `.png` (PNG images)
- `.jpg` (JPEG images)

**Location**: `publishing/branding/` directory

**Documentation**: `publishing/branding/README.md` documents logo variants and usage guidelines.

**Impact**: Prevents repo bloat (~28 MB of design assets) while maintaining version control.

## Network Synchronization (March 2026)

### Network Sync and Interpolation Fixes

**Problem** (commit ef9e68c): Network interpolation regressions caused jittery remote entity movement and position conflicts.

**Fixes**:
- **TileInterpolator Control Flag**: Added `tileInterpolatorControlled` flag to entity data to prevent InterpolationEngine from overriding tile-based movement
- **Dead Entity Skip**: InterpolationEngine now skips entities in `aiState: "dead"` to prevent death animation sliding
- **Proper Quaternion Interpolation**: Use slerp instead of component-wise lerp for smooth rotation interpolation
- **Snapshot Buffer Management**: Fixed circular buffer index calculations for proper chronological ordering

**Impact**: Smooth remote entity movement without position conflicts between tile-based and interpolated movement.

### Plugin World Map Exports

**Fix** (commits ea0aef6, 5599142, b18d561): Restored missing world map exports from plugin-hyperscape and fixed stale location updates.

**Exports Restored**:
- `mapProvider` - World map data provider for agent navigation
- Map-related types and utilities

**Refresh Known Locations** (commit b18d561):
- Added `tileInterpolatorControlled` flag to prevent InterpolationEngine conflicts
- Refresh known world-map locations when map data changes
- Regression test for stale location updates

**Impact**: Agents can now access world map data for navigation and spatial awareness without stale location bugs.

## Runtime Logging (March 2026)

### Reduced Logging Noise

**Changes** (commit 4be5641):
- Reduced excessive runtime logging for cleaner console output
- Improved signal-to-noise ratio for debugging
- Maintains critical error and warning logs

See CLAUDE.md for complete documentation.
