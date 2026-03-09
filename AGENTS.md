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

## CRITICAL: Secrets and Private Keys

**Never put private keys, seed phrases, API keys, tokens, RPC secrets, or wallet secrets into any file that could be committed.**

- ALWAYS use local untracked `.env` files for real secrets
- NEVER hardcode secrets in source files, tests, docs, JSON fixtures, scripts, config files, or workflow YAML
- NEVER put real secrets in `.env.example`; placeholders only
- If a secret is needed in production or CI, use the platform secret store, not a tracked file
- If a task requires a new secret, document the variable name and load it from `.env`, `.env.local`, or deployment secrets

## Key Rules

1. **No `any` types** - ESLint will reject them
2. **WebGPU only** - No WebGL code or fallbacks
3. **No mocks in tests** - Use real Playwright browser sessions
4. **Bun package manager** - Use `bun install`, not npm
5. **Strong typing** - Prefer classes over interfaces
6. **Secrets stay out of git** - Real keys must only come from local `.env` files or secret managers

## Tech Stack

- Runtime: Bun v1.3.10+ (updated from v1.1.38)
- Rendering: WebGPU ONLY (Three.js WebGPURenderer + TSL)
- Engine: Three.js 0.182.0, PhysX (WASM)
- UI: React 19.2.0
- Server: Fastify, WebSockets
- Database: PostgreSQL (production), Docker (local)
- Testing: Vitest 4.x (upgraded from 2.x for Vite 6 compatibility)
- AI: ElizaOS `alpha` tag (commit 6d67ec1 - aligned with latest alpha releases)

## Common Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run dev          # Development mode
bun run duel         # Full duel stack (game + agents + streaming)
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
├── duel-oracle-evm/ # EVM duel outcome oracle contracts
├── duel-oracle-solana/ # Solana duel outcome oracle program
└── contracts/       # MUD onchain game state (experimental)
```

**Note**: The betting stack (`gold-betting-demo`, `evm-contracts`, `sim-engine`, `market-maker-bot`) has been split into a separate repository: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

## Recent Changes (March 2026)

### Streaming Pipeline Fixes (Commits 41dc606, 71dcba8)

**Change**: Fixed RTMP streaming pipeline to correctly enable Twitch and Kick destinations.

**Fixes**:
- **Auto-Detection**: `deploy-vast.sh` now auto-detects enabled destinations from available stream keys using `||` logic
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards stream keys through PM2 environment
- **Secret Aliases**: `deploy-vast.yml` adds `TWITCH_RTMP_STREAM_KEY` alias to secrets file for compatibility
- **Stream Entry Points**: Added dedicated `stream.html` and `stream.tsx` for optimized streaming capture
- **Viewport Mode Detection**: `clientViewportMode` utility automatically detects stream/spectator/normal modes
- **Multi-Page Build**: Vite now builds separate bundles for game and streaming entry points

**Environment Variables**:
```bash
# Auto-detected from available keys
STREAM_ENABLED_DESTINATIONS=twitch,kick

# Twitch (multiple key formats supported)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij

# Kick
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
```

**Impact**: Reliable multi-platform RTMP streaming with automatic destination detection and proper secret forwarding.

### CSRF Fix for Cross-Origin Clients (Commit 0b1a0bd, PR #991)

**Problem**: Account creation failed with "CSRF validation failed" (403) when client runs on localhost:3333 against a deployed server proxied through cloud-api.

**Root Cause**: 
- `UsernameSelectionScreen` used raw `fetch()` without Authorization header
- Server's CSRF middleware skips validation for requests with `Authorization: Bearer ...`
- Without auth token, fell through to cookie-based CSRF validation which fails cross-origin (SameSite=Strict)
- CSRF token response shape mismatch: server returns `{ token }` but client expected `{ csrfToken }`

**Fixes**:
- **Auth Header**: `UsernameSelectionScreen.tsx` now includes Privy auth token as `Authorization: Bearer` header on POST /api/users/create
- **Token Parsing**: `api-client.ts` accepts both `{ token }` and `{ csrfToken }` from CSRF endpoint
- **Origin Patterns**: Added localhost and private-IP patterns to `KNOWN_CROSS_ORIGIN_PATTERNS` in `csrf.ts`

**Files Changed**:
- `packages/client/src/screens/UsernameSelectionScreen.tsx`
- `packages/client/src/lib/api-client.ts`
- `packages/server/src/middleware/csrf.ts`

**Impact**: Cross-origin local development now works correctly without CSRF 403 errors.

### ElizaCloud Plugin Integration (Commit 4d1eb53)

**Change**: All duel arena AI agents now route through `@elizaos/plugin-elizacloud` for unified model access.

**New Dependency**:
- `@elizaos/plugin-elizacloud`: `^1.8.0`

**13 Frontier Models** (all via ElizaCloud):

**American Models**:
- `openai/gpt-5` - GPT-5
- `anthropic/claude-sonnet-4.6` - Claude Sonnet 4.6
- `anthropic/claude-opus-4.6` - Claude Opus 4.6
- `google/gemini-3.1-pro-preview` - Gemini 3.1 Pro
- `xai/grok-4` - Grok 4
- `meta/llama-4-maverick` - Llama 4 Maverick
- `mistral/magistral-medium` - Magistral Medium

**Chinese Models**:
- `deepseek/deepseek-v3.2` - DeepSeek V3.2
- `alibaba/qwen3-max` - Qwen 3 Max
- `minimax/minimax-m2.5` - Minimax M2.5
- `zai/glm-5` - GLM-5
- `moonshotai/kimi-k2.5` - Kimi K2.5
- `bytedance/seed-1.8` - Seed 1.8

**Configuration**:
```bash
# packages/server/.env
ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

**Impact**: 
- Simplified configuration (one API key instead of multiple provider keys)
- Access to 13 frontier models from 7 American and 6 Chinese providers
- Consistent model routing and error handling
- Reduced dependency complexity

**Migration**: Individual provider plugins (`@elizaos/plugin-openai`, `@elizaos/plugin-anthropic`, `@elizaos/plugin-groq`) are still installed for backward compatibility but are no longer used by duel arena agents.

### ElizaOS Alpha Package Alignment (Commit 6d67ec1)

**Change**: Aligned all ElizaOS packages to `alpha` tag for stable releases.

**Packages Updated**:
- `@elizaos/core`: `^2.0.0-alpha.33`
- `@elizaos/plugin-anthropic`: `^2.0.0-alpha.7`
- `@elizaos/plugin-groq`: `^2.0.0-alpha.8`
- `@elizaos/plugin-openai`: `^2.0.0-alpha.9`
- `@elizaos/prompts`: `^2.0.0-alpha.33`

**Previous Changes**:
- Commit 378058a: Upgraded to `next` tag for latest features
- Commit 788036d: Removed `@elizaos/plugin-sql` dependency (replaced with InMemoryDatabaseAdapter)

**Impact**: Access to stable ElizaOS alpha releases with versioned packages. Ensures compatibility with latest LLM provider APIs while maintaining version control.

**Migration**: No code changes required - ElizaOS maintains backward compatibility across alpha releases.

### NPM Override Conflicts Fixed (Commit 80d667a)

**Problem**: NPM overrides for alpha packages conflicted with package.json dependencies.

**Solution**: Resolved override conflicts to ensure consistent package resolution across the monorepo.

**Impact**: Eliminates dependency resolution errors during `bun install`.

### Betting Stack Split (Commit 428329d)

**Change**: The betting stack has been split into a separate repository for independent development and deployment.

**New Repository**: [HyperscapeAI/hyperbet](https://github.com/HyperscapeAI/hyperbet)

**Moved Packages**:
- `gold-betting-demo` - Betting frontend and keeper API
- `evm-contracts` - EVM smart contracts (GoldClob, AgentPerpEngine, SkillOracle)
- `sim-engine` - Cross-chain risk simulation and attack fuzzing
- `market-maker-bot` - Automated liquidity seeding

**Remaining in Hyperscape**:
- `duel-oracle-evm` - EVM duel outcome oracle contracts (separate from betting)
- `duel-oracle-solana` - Solana duel outcome oracle program (separate from betting)
- Oracle publisher and metadata API in `packages/server/src/oracle/`

**Rationale**:
- **Independent Deployment**: Betting stack can be deployed and updated separately from game server
- **Cleaner Separation**: Oracle (verifiable duel outcomes) vs Betting (financial markets)
- **Reduced Complexity**: Smaller monorepo with focused scope
- **Better CI/CD**: Separate workflows for game vs betting deployments

**Migration Notes**:
- Oracle functionality remains in Hyperscape for duel outcome verification
- Betting markets consume oracle data from Hyperscape's metadata API
- Cross-repository integration via REST APIs and blockchain events

### Duel Oracle Completion Fields (Commit aecab58)

**New Fields** added to oracle records:
- `damageA` - Total damage dealt by participant A
- `damageB` - Total damage dealt by participant B
- `winReason` - Reason for victory (e.g., "knockout", "timeout", "forfeit")
- `seed` - Cryptographic seed for replay verification
- `replayHashHex` - Hash of replay data for integrity verification
- `resultHashHex` - Combined hash of all duel outcome data

These fields are stored in the `arena_rounds` table and published to all configured oracle targets (EVM + Solana).

**Impact**: Provides comprehensive duel outcome data for betting market settlement and replay verification.

### Network Sync and Interpolation Fixes (Commit ef9e68c)

**Problem**: Network interpolation regressions caused jittery remote entity movement and position conflicts.

**Fixes**:
- **TileInterpolator Control Flag**: Added `tileInterpolatorControlled` flag to entity data to prevent InterpolationEngine from overriding tile-based movement
- **Dead Entity Skip**: InterpolationEngine now skips entities in `aiState: "dead"` to prevent death animation sliding
- **Proper Quaternion Interpolation**: Use slerp instead of component-wise lerp for smooth rotation interpolation
- **Snapshot Buffer Management**: Fixed circular buffer index calculations for proper chronological ordering

**Impact**: Smooth remote entity movement without position conflicts between tile-based and interpolated movement.

### Plugin World Map Exports (Commits ea0aef6, 5599142, b18d561)

**Fix**: Restored missing world map exports from plugin-hyperscape and fixed stale location updates.

**Exports Restored**:
- `mapProvider` - World map data provider for agent navigation
- Map-related types and utilities

**Refresh Known Locations** (Commit b18d561):
- Added `tileInterpolatorControlled` flag to prevent InterpolationEngine conflicts
- Refresh known world-map locations when map data changes
- Regression test for stale location updates

**Impact**: Agents can now access world map data for navigation and spatial awareness without stale location bugs.

### Duel Memory Leak Fixes (Commit 555a782)

**Problem**: Agent memory leaks and insufficient diagnostics for debugging.

**Fixes**:
- Memory leak fixes in duel system
- Enhanced agent diagnostics for memory tracking
- Improved memory monitoring and reporting

**Impact**: Reduced memory footprint and better visibility into agent memory usage.

### CI Stabilization (Commits dd991f4, 2d63ce1)

**Fixes**:
- Stabilized CI test workflows
- Fixed workflow dependency resolution
- Improved test reliability across packages

**Impact**: More reliable CI/CD pipeline with consistent builds.

### Streaming Configuration Improvements (Commits c6d31b2, 2b42826, 4090123)

**Changes**:
- Aligned stream defaults with Twitch production
- Updated betting stream defaults for production deployment
- Improved Vast stream bootstrap configuration

**Impact**: Codified vast stream deployment parity with production settings.

### Code Quality Improvements (PR #989)

**GLTFExporter Static Imports**:

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

**VFX Preview Dead Code Removal**:

Removed unused variables and code paths in `packages/asset-forge/src/components/VFX/VFXPreview.tsx`:
- Unused `opacity` calculations in glow particles (pillar, wisp, spark, base, riseSpread)
- Unused `primaryColor`, `whiteGlow`, `ringMat` variables
- Unused `effect` prop in `TeleportScene` component
- Added `isCombatHud()` type guard for proper type narrowing

**Impact**: Reduces bundle size and improves code maintainability.

**WeaponHandleDetector Cross-Runtime Compatibility**:

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

**Client Panel Registry Optimization**:

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

**Logger Import Optimization**:

Converted dynamic logger import to static import in client entry point:

**Before:**
```typescript
import("./lib/logger").then(({ logger }) => {
  logger.config("[Hyperscape] Configured from validated URL params:", {
    ...config,
    authToken: config.authToken ? "[REDACTED]" : "[PENDING]",
  });
});
```

**After:**
```typescript
import { logger } from "./lib/logger";

logger.config("[Hyperscape] Configured from validated URL params:", {
  ...config,
  authToken: config.authToken ? "[REDACTED]" : "[PENDING]",
});
```

**Impact**: Faster module loading, cleaner code, better tree-shaking.

**Dashboard Background Optimization**:

Replaced image-based background with CSS gradients:

**Before:**
```css
background-image: url('/assets/background.jpg');
```

**After:**
```css
background-image:
  radial-gradient(circle at top, rgba(242, 208, 138, 0.14), transparent 36%),
  linear-gradient(180deg, rgba(30, 20, 10, 0.72) 0%, rgba(11, 10, 21, 0.96) 100%);
```

**Impact**: Eliminates HTTP request for background image, faster initial render, smaller bundle size.

**Bundle Size Limits**:

Increased `chunkSizeWarningLimit` to suppress warnings for intentionally large WebGPU/PhysX bundles:

- `packages/client/vite.config.ts`: 8000 KB (up from 2000 KB)
- `packages/asset-forge/vite.config.ts`: 9000 KB (new)

**Rationale**: WebGPU renderer, TSL shader system, and PhysX WASM bindings create large bundles. These limits are intentional until deeper code splitting is implemented.

**Tech Debt**: Track deeper code splitting as future optimization to reduce initial bundle size.

### Vitest 4.x Upgrade

**Breaking Change** (Commit a916e4e): Vitest 2.x is incompatible with Vite 6.x.

**Changes**:
- Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6
- Fixes `__vite_ssr_exportName__` errors during test runs
- All packages using Vitest must use 4.x for Vite 6 compatibility

**Migration**:
- Update `vitest` and `@vitest/coverage-v8` to `^4.0.6` in package.json
- No API changes required - tests continue to work as-is

## EVM Contract Improvements (PR #989)

### Typed Contract Helpers

**Feature**: Added type-safe deployment helpers for Hardhat contracts.

**New File**: `packages/evm-contracts/typed-contracts.ts`

**Exports**:
- `GoldClobContract` - Type-safe GoldClob contract interface
- `SkillOracleContract` - Type-safe SkillOracle contract interface
- `MockERC20Contract` - Type-safe MockERC20 contract interface
- `AgentPerpEngineContract` - Type-safe AgentPerpEngine contract interface
- `AgentPerpEngineNativeContract` - Type-safe AgentPerpEngineNative contract interface
- `deployGoldClob()` - Type-safe deployment helper
- `deploySkillOracle()` - Type-safe deployment helper
- `deployMockErc20()` - Type-safe deployment helper
- `deployAgentPerpEngine()` - Type-safe deployment helper
- `deployAgentPerpEngineNative()` - Type-safe deployment helper

**Usage**:
```typescript
import { deployGoldClob } from "../typed-contracts";

const clob = await deployGoldClob(treasury.address, marketMaker.address);
await clob.waitForDeployment();
const clobAddress = await clob.getAddress();
```

**Impact**: Eliminates manual type casting and provides compile-time type safety for contract interactions.

### Deployment Metadata Centralization

**Feature**: Centralized deployment metadata and receipt management.

**New Files**:
- `packages/evm-contracts/scripts/deploy.ts` - Enhanced deploy script with receipt writing
- `packages/evm-contracts/deployments/<network>.json` - Per-network deployment receipts

**Deployment Receipt Format**:
```json
{
  "network": "bscTestnet",
  "chainId": 97,
  "deployer": "0x...",
  "goldClobAddress": "0x...",
  "treasuryAddress": "0x...",
  "marketMakerAddress": "0x...",
  "goldTokenAddress": "0x...",
  "deploymentTxHash": "0x...",
  "deployedAt": "2026-03-08T11:42:55.000Z"
}
```

**Impact**: Provides auditable deployment history and simplifies contract address management.

### TypeScript Fixes (Commits 74b9852, 6cdbf2c, b542751)

**Problem**: TS18048 errors for `GAME_API_URL` and other import.meta.env values possibly being undefined.

**Fix**: Switch from `||` to `??` (nullish coalescing) for import.meta.env values so TypeScript can narrow the type through the fallback chain.

**Files Changed**:
- `packages/client/src/lib/api-config.ts` - Added explicit string types to URL exports

**Impact**: Eliminates TypeScript errors without requiring non-null assertions.

See CLAUDE.md for complete documentation.
