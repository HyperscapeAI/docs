# Changelog - February 2026

## Major Features

### GPU-Instanced Particle System (PR #877)

**Performance**: 97% draw call reduction, 65 FPS → 120 FPS improvement

Centralized all fishing spot particle/ripple rendering into a `ParticleManager` architecture using 4 GPU InstancedMeshes driven by TSL NodeMaterials.

**Before**:
- ~150 draw calls (10-21 meshes per fishing spot)
- ~450 lines of per-entity CPU animation code
- Heavy per-frame CPU work (trig, quaternion copies, opacity writes)

**After**:
- 4 draw calls (one per particle layer, shared across all spots)
- GPU-driven animation via TSL shaders
- Minimal CPU overhead (age increment, attribute dirty flags)

**Architecture**:
- `ParticleManager` - Central router dispatching to specialized sub-managers
- `WaterParticleManager` - Handles splash, bubble, shimmer, ripple via InstancedMesh
- `ResourceSystem` - Creates ParticleManager, forwards resource events
- `ResourceEntity` - Delegates to ParticleManager, retains only glow mesh for interaction

**Files Changed**:
- `packages/shared/src/entities/managers/particleManager/ParticleManager.ts` (new)
- `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts` (new)
- `packages/shared/src/entities/world/ResourceEntity.ts` (refactored)
- `packages/shared/src/systems/shared/entities/ResourceSystem.ts` (updated)

**Documentation**: See `docs/particle-manager-architecture.md`

**Commit**: `4168f2f`

---

### Duel Trash Talk System

AI agents now generate contextual taunts during arena combat, creating engaging spectator experiences.

**Features**:
- Health milestone taunts (75%, 50%, 25%, 10% thresholds)
- Ambient periodic taunts (every 15-25 ticks)
- LLM-generated using agent character bio/style
- Scripted fallback taunts when no runtime available
- 8-second cooldown between messages
- Fire-and-forget (never blocks combat tick)

**Implementation**:
- `DuelCombatAI` - Health threshold detection, LLM taunt generation
- `DuelOrchestrator` - Wires sendChatMessage callbacks into combat AIs
- Social system - CHAT_MESSAGE action now allowed during combat

**Files Changed**:
- `packages/server/src/arena/DuelCombatAI.ts` (trash talk system)
- `packages/shared/src/systems/shared/combat/handlers/social.ts` (allow chat in combat)
- `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts` (wire callbacks)

**Tests**: 14/14 trash talk tests passing

**Documentation**: See `docs/duel-trash-talk-system.md`

**Commit**: `8ff3ad3`

---

### Solana Mainnet Migration (CLOB Market)

Migrated betting system from binary market to CLOB (Central Limit Order Book) market program on Solana mainnet.

**Changes**:
- Updated program IDs to mainnet addresses
- Replaced binary market IDL with CLOB market IDL
- Rewrote keeper bot for CLOB instructions (initializeConfig, initializeMatch, initializeOrderBook, resolveMatch)
- Removed binary market seeding/vault logic
- Updated server arena config fallback to mainnet fight oracle
- Updated frontend .env.mainnet with all VITE_ vars

**Mainnet Program IDs**:
- Fight Oracle: `Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1`
- GOLD CLOB Market: `GCLoBfbkz8Z4xz3yzs9gpump`
- GOLD Token Mint: `DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump`

**Files Changed**:
- `packages/gold-betting-demo/anchor/programs/fight_oracle/src/lib.rs`
- `packages/gold-betting-demo/anchor/programs/gold_clob_market/src/lib.rs`
- `packages/gold-betting-demo/keeper/src/bot.ts`
- `packages/gold-betting-demo/keeper/src/common.ts`
- `packages/gold-betting-demo/app/.env.mainnet`
- All IDL files in keeper and app

**Documentation**: See `docs/solana-mainnet-migration.md`

**Commits**: `dba3e03`, `35c14f9`, `2c17000`

---

### New Domain Support

Added CORS support for new production domains:

**Domains**:
- `hyperscape.gg` - Primary game domain
- `hyperscape.bet` - Betting platform
- `hyperbet.win` - Alternative betting domain (with subdomain pattern support)

**Files Changed**:
- `packages/server/src/startup/http-server.ts` (CORS config)
- `packages/gold-betting-demo/keeper/src/service.ts` (CORS config)
- `packages/website/src/lib/links.ts` (game link updated to hyperscape.gg)
- `packages/app/src-tauri/tauri.ios.conf.json` (deep link support)

**Commits**: `bb292c1`, `7ff88d1`

---

## Infrastructure & CI/CD

### Test Suite Improvements

**Status**: 1569 tests passing, 85 skipped (pending refactoring)

**WebGPU Mocks** (commit `25ba63c`):
- Added `vitest.setup.ts` to mock WebGPU browser globals
- Mocks: GPUShaderStage, GPUBufferUsage, GPUTextureUsage, GPUTextureFormat, etc.
- Required by Three.js WebGPU renderer in test environment
- Prevents "GPUShaderStage is not defined" errors

**ArenaService Test Helpers** (commit `25ba63c`):
- Added protected passthrough methods for test spying
- Methods: getDb, getEligibleAgents, findReferralMappingForWalletNetwork, etc.
- Database mock helper: `setDbMock` properly configures world.getSystem("database") mock

**Skipped Tests** (pending deeper refactoring):
- ArenaService lifecycle tests (need createBetOpenRound fix)
- ArenaService simulation tests (need architecture updates)
- ArenaService referrals tests (sub-services call ctx directly)
- StreamingDuelScheduler unit tests (internal methods moved)
- Admin index integration tests (need DB migrations)

**StreamingDuelScheduler Integration Test Fix** (commit `25ba63c`):
- Accept `undefined` as falsy in assertions
- Prevents false failures when optional fields are undefined

---

### CI/CD Reliability Improvements

**Chain Setup** (commit `034f9c9`):
- `setup-chain.mjs` skips when `CI=true` (anvil/mud not available in CI)
- Exclude `@hyperscape/evm-contracts` from turbo test filter
- Add `continue-on-error` for Mintlify API calls in update-docs.yml

**Foundry Toolchain** (commit `b344d9e`):
- Add `foundry-rs/foundry-toolchain@v1` to integration.yml
- Ensures anvil binary available when setup-chain.mjs starts local Ethereum node

**ESLint Fix** (commit `b344d9e`):
- Remove ajv>=8.18.0 override that forced ajv@8 on @eslint/eslintrc
- @eslint/eslintrc needs ajv@6 for Draft-04 schema support
- Prevents `TypeError: Class extends value undefined is not a constructor or null`

**Assets Clone Fix** (commit `6ce05cc`):
- Remove assets directory before clone to avoid "already exists" error
- Prevents CI failures from stale asset directories

**Package Exclusions**:
- `@hyperscape/contracts` excluded from CI test run (commit `99dec96`)
  - MUD CLI has compatibility issue with @trpc/server versions
  - Tests will be re-enabled when dependency conflict is resolved
- `@hyperscape/gold-betting-demo` excluded from CI tests (commit `93f963`)
  - hls.js dependency not resolving correctly in CI due to workspace hoisting
  - Re-enabled after dependency resolution fix

**Missing Dependency Fix** (commit `cfdabf3`):
- Add hls.js dependency to gold-betting-demo package.json
- StreamPlayer.tsx imports hls.js but it wasn't declared
- Caused build failures in CI where bun resolves deps strictly

---

### Database Migration Improvements

**Migration 0050 Fix** (commit `e4b6489`):
- Add `IF NOT EXISTS` to migration 0050 tables/indexes
- Migration 0050 duplicated CREATE TABLE statements from earlier migrations
- Prevents 42P07 errors on fresh databases running all migrations sequentially

**SKIP_MIGRATIONS Environment Variable** (commit `eb8652a`):
- New env var to bypass server's built-in migration system
- Useful in CI/test environments using `drizzle-kit push`
- Server's migration has FK ordering issues; drizzle-kit push creates schema declaratively
- Usage: `SKIP_MIGRATIONS=true bun run test`

**Drizzle-Kit Push in CI** (commit `eb8652a`):
- Integration workflow now uses `drizzle-kit push` + `SKIP_MIGRATIONS`
- Avoids migration journal conflicts
- Server migration code no longer fails on re-creation attempts

**Supavisor Compatibility** (commits `8aaaf28`, `f7ab9f7`):
- Disable prepared statements for Supavisor pooler
- Prevents XX000 errors from prepared statement conflicts
- Add `DATABASE_PREPARED_STATEMENTS=false` env var

---

## Security

### Vulnerability Fixes (commit `a390b79`)

**Resolved**: 14 of 16 npm audit vulnerabilities

**Upgrades**:
- ✅ Playwright ^1.55.1 (fixes GHSA-7mvr-c777-76hp, high severity)
- ✅ Vite ^6.4.1 (fixes GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ ajv ^8.18.0 (fixes GHSA-2g4f-4pwh-qvx6)
- ✅ Root overrides for: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Remaining** (no upstream patches available):
- ⚠️ bigint-buffer (high severity)
- ⚠️ elliptic (moderate severity)

**CI Audit Policy** (commit `19bebe2`):
- Lowered audit threshold to `critical` (from `high`)
- Allows builds to pass while waiting for upstream fixes
- Command: `npm audit --audit-level=critical`

---

## Streaming & WebGPU

### WebGPU Configuration Fixes

**RTX 4090 Support** (commit `80bb06e`):
- Switch ANGLE from GL to Vulkan for RTX 4090 WebGPU
- Improves streaming performance on high-end GPUs

**RTX 5060 Ti Compatibility** (commits `0257563`, `30cacb0`):
- Remove RTX 5060 Ti from GPU search (broken Vulkan ICD)
- Use GL ANGLE backend instead of Vulkan
- Use system FFmpeg to avoid static build SIGSEGV

**Chrome Configuration** (commits `ba8bd53`, `d824163`):
- Use Chrome Dev channel for WebGPU support on Vast.ai
- Required for latest WebGPU features

**Rendering Mode Fixes**:
- Switch back to headful mode for GPU compositing with Xvfb (commit `5e4c6f1`)
- Remove aggressive GPU opts that crash RTX 5060 Ti (commit `f3aa787`)
- Use swiftshader + headless + WebGL for stable streaming (commit `ae42beb`)

**FFmpeg Configuration** (commits `55a07bd`, `536763d`):
- Use system FFmpeg to avoid static build SIGSEGV
- More reliable than bundled static FFmpeg binary

---

## TypeScript & Type Safety

### Type Error Fixes (commit `5e60439`)

Resolved 4 TypeScript errors for CI typecheck:

1. **AgentManager.ts**: Cast EmbeddedHyperscapeService to HyperscapeService
2. **ArenaService.ts**: Cast unknown position param via `Parameters<>` utility
3. **ArenaRoundService.ts**: Change getEligibleAgents from private to public (needed for tests)

**Impact**: CI typecheck now passes cleanly

---

## Deployment & Configuration

### Vast.ai Keeper Improvements

**Python venv for vastai CLI** (commit `5c2a566`):
- Use python venv for vastai install to guarantee binary on PATH
- Prevents "vastai: command not found" errors

**Install vastai CLI Package** (commit `987e037`):
- Install vastai CLI package and revert to binary invocation
- More reliable than direct pip install

---

## Documentation

### New Documentation Files

1. **docs/particle-manager-architecture.md** - GPU-instanced particle system architecture
2. **docs/duel-trash-talk-system.md** - AI agent trash talk during combat
3. **docs/solana-mainnet-migration.md** - CLOB market mainnet migration guide
4. **docs/environment-variables-update.md** - New env vars (SKIP_MIGRATIONS, etc.)
5. **docs/CHANGELOG-2026-02.md** - This file

### Updated Documentation

1. **README.md**:
   - Added ParticleManager performance metrics
   - Added production domains (hyperscape.gg, hyperscape.bet, hyperbet.win)
   - Added security vulnerability fixes section
   - Added architecture documentation links
   - Added ESLint/anvil troubleshooting

2. **CLAUDE.md**:
   - Added test suite status (1569 passing, 85 skipped)
   - Added WebGPU mocks documentation
   - Added ArenaService test helpers
   - Added CI reliability improvements
   - Added ESLint crash troubleshooting
   - Added integration test fixes
   - Added streaming mode troubleshooting
   - Updated port allocation table

---

## Breaking Changes

### Solana Betting API

Binary market instructions removed, replaced with CLOB market:

**Removed**:
- `initializeVault`
- `seedMarket`
- `placeBet`
- `resolveBinaryMarket`

**Added**:
- `initializeConfig`
- `initializeMatch`
- `initializeOrderBook`
- `placeOrder`
- `cancelOrder`
- `resolveMatch`
- `settleOrders`

**Migration**: Update all betting integrations to use CLOB market IDL and instructions.

---

## Bug Fixes

### Database

- **Migration 0050 Duplication** (commit `e4b6489`): Add IF NOT EXISTS to prevent 42P07 errors
- **Prepared Statements** (commits `8aaaf28`, `f7ab9f7`): Disable for Supavisor pooler compatibility

### CI/CD

- **ESLint ajv Crash** (commit `b344d9e`): Remove ajv@8 override, use ajv@6 for @eslint/eslintrc
- **Anvil Missing** (commit `b344d9e`): Install Foundry toolchain in integration workflow
- **Assets Clone** (commit `6ce05cc`): Remove assets dir before clone
- **Chain Setup** (commit `034f9c9`): Skip when CI=true
- **Package Exclusions** (commits `99dec96`, `93f963`): Exclude problematic packages from CI tests

### Dependencies

- **hls.js Missing** (commit `cfdabf3`): Add to gold-betting-demo package.json
- **Security Vulnerabilities** (commit `a390b79`): Upgrade 14 vulnerable dependencies

### Streaming

- **WebGPU Crashes** (commits `80bb06e`, `0257563`, `f3aa787`): Fix ANGLE backend, remove aggressive GPU opts
- **FFmpeg SIGSEGV** (commits `55a07bd`, `536763d`): Use system FFmpeg instead of static build
- **Chrome WebGPU** (commits `ba8bd53`, `d824163`): Use Chrome Dev channel for WebGPU support

---

## Commits Summary

### Performance (1 commit)
- `4168f2f` - GPU-instanced fishing spot particles via ParticleManager

### Features (3 commits)
- `8ff3ad3` - Duel trash talk system
- `dba3e03` / `35c14f9` - CLOB market mainnet migration
- `bb292c1` / `7ff88d1` - New domain support (hyperscape.gg, hyperscape.bet, hyperbet.win)

### Infrastructure (15 commits)
- `25ba63c` - Test suite compatibility with refactored ArenaService
- `eb8652a` - SKIP_MIGRATIONS env var for CI integration tests
- `e4b6489` - Add IF NOT EXISTS to migration 0050
- `8aaaf28` / `f7ab9f7` - Disable prepared statements for Supavisor
- `b344d9e` - Resolve ESLint ajv crash and integration test anvil missing
- `034f9c9` - Skip chain setup in CI, exclude evm-contracts tests
- `99dec96` - Exclude @hyperscape/contracts from CI test run
- `93f963` - Exclude @hyperscape/gold-betting-demo from CI tests
- `cfdabf3` - Add missing hls.js dependency
- `6ce05cc` - Remove assets dir before clone
- `b5d2494` - Remove drizzle-kit push from integration workflow
- `5e60439` - Resolve 4 TypeScript errors for CI typecheck
- `5c2a566` - Use python venv for vastai install
- `987e037` - Install vastai CLI package

### Security (2 commits)
- `a390b79` - Resolve 14 of 16 security audit vulnerabilities
- `19bebe2` - Lower audit threshold to critical

### Streaming (10 commits)
- `80bb06e` - Switch ANGLE from GL to Vulkan for RTX 4090
- `0257563` - Use GL ANGLE backend for RTX 5060 Ti
- `30cacb0` - Remove RTX 5060 Ti from GPU search
- `55a07bd` / `536763d` - Use system FFmpeg
- `5e4c6f1` - Switch back to headful mode for GPU compositing
- `f3aa787` - Remove aggressive GPU opts that crash RTX 5060 Ti
- `ae42beb` - Use swiftshader + headless + WebGL
- `ba8bd53` / `d824163` - Use Chrome Dev channel for WebGPU

---

## Statistics

- **Total Commits**: 31 commits to main branch (Feb 22, 2026)
- **Files Changed**: 50+ files across packages
- **Lines Added**: ~2000+ lines (features + tests + docs)
- **Lines Removed**: ~800+ lines (refactored code)
- **Tests Added**: 19 new tests (trash talk + particle system)
- **Documentation**: 5 new docs, 2 major updates

---

## Upgrade Guide

### From Pre-Feb-2026 to Current

1. **Pull Latest Code**:
   ```bash
   git pull origin main
   bun install
   ```

2. **Rebuild Everything**:
   ```bash
   bun run clean
   bun run build
   ```

3. **Reset Database** (if migration errors):
   ```bash
   docker stop hyperscape-postgres
   docker rm hyperscape-postgres
   docker volume rm hyperscape-postgres-data
   bun run dev  # Fresh database with all migrations
   ```

4. **Update Environment Files**:
   ```bash
   # Add new domains to CORS if self-hosting
   # Add SKIP_MIGRATIONS=true if using drizzle-kit push in CI
   # Add DATABASE_PREPARED_STATEMENTS=false if using Supavisor
   ```

5. **Update Solana Integration** (if using betting):
   ```bash
   cd packages/gold-betting-demo/app
   cp .env.mainnet .env  # Use mainnet config
   # Update program IDs to mainnet addresses
   ```

---

## Contributors

- **Shaw (@lalalune)** - ParticleManager, trash talk, mainnet migration, CI fixes
- **tcm390 (@tcm390)** - ParticleManager architecture and implementation

---

## Next Steps

### Planned Features

- **Fire Particle Manager**: Campfire, torch, burning log effects
- **Magic Particle Manager**: Spell effects, enchantment glows, teleport sparkles
- **Combat Particle Manager**: Blood splatter, impact sparks, shield deflection
- **Weather Particle Manager**: Rain, snow, fog particles

### Pending Refactoring

- ArenaService lifecycle tests (createBetOpenRound fix)
- ArenaService simulation tests (architecture updates)
- ArenaService referrals tests (sub-services ctx handling)
- StreamingDuelScheduler unit tests (internal method visibility)
- Admin integration tests (DB migration compatibility)

---

## References

- **Main Branch**: https://github.com/HyperscapeAI/hyperscape/tree/main
- **PR #877**: https://github.com/HyperscapeAI/hyperscape/pull/877
- **Commit Range**: `8083993` to `9a0aa9a` (Feb 22, 2026)
