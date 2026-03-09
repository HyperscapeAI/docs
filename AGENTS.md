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
- **Chrome Beta Channel**: Use `google-chrome-beta` for WebGPU streaming (better stability than Dev/Canary)
- **ANGLE Backend**: Use default ANGLE backend (`--use-angle=default`), NOT native Vulkan
- **Xvfb Virtual Display**: `scripts/deploy-vast.sh` starts Xvfb before PM2 to ensure DISPLAY is available
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards `DISPLAY=:99` and `DATABASE_URL` through PM2
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

### PM2 Secrets Loading Fix (Commit 684b203)

**Problem**: `bunx pm2` doesn't reliably inherit exported environment variables from the deploy shell script.

**Fix**: `ecosystem.config.cjs` now reads `/tmp/hyperscape-secrets.env` directly at config load time.

**Impact**: Ensures `DATABASE_URL` and other secrets are always available to PM2-managed processes.

### Chrome Beta for Streaming (Commit 547714e)

**Change**: Switched from Chrome Unstable to Chrome Beta for streaming capture.

**Updates**:
- `scripts/deploy-vast.sh`: Install `google-chrome-beta` instead of `google-chrome-unstable`
- `ecosystem.config.cjs`: Set `STREAM_CAPTURE_CHANNEL=chrome-beta` and `STREAM_CAPTURE_ANGLE=default`

**Rationale**: Chrome Beta provides better stability than Dev/Canary channels while maintaining WebGPU support.

**Impact**: More reliable streaming capture with fewer crashes and rendering artifacts.

### DATABASE_URL PM2 Forwarding Fix (Commit 5d415fc)

**Problem**: Server crashed with FATAL error when `DATABASE_URL` was not explicitly forwarded through PM2 environment.

**Fix**: `ecosystem.config.cjs` now explicitly forwards `DATABASE_URL` through PM2 environment variables.

**Impact**: Prevents server crashes when using remote PostgreSQL databases with PM2 process management.

### Xvfb DISPLAY Environment Fix (Commit 704b955)

**Problem**: PM2 processes could not access Xvfb virtual display due to missing `DISPLAY` environment variable.

**Fix**: `ecosystem.config.cjs` now explicitly sets `DISPLAY=:99` in PM2 environment.

**Impact**: Ensures streaming processes can access the virtual display for WebGPU rendering.

### Xvfb Virtual Display Fix (Commit 294a36c)

**Change**: Fixed Xvfb startup order to ensure virtual display is available before PM2 starts streaming processes.

**Fix**: `deploy-vast.sh` now starts Xvfb before PM2 and exports `DISPLAY=:99` to environment.

**Impact**: Prevents "cannot open display" errors during RTMP streaming on headless servers.

### Remote Database Auto-Detection (Commit dd51c7f)

**Change**: `deploy-vast.sh` now auto-detects remote database mode from `DATABASE_URL` hostname.

**Logic**:
- If `DATABASE_URL` contains localhost/127.0.0.1/0.0.0.0/::1 → local mode
- Otherwise → remote mode
- Manual override via `DUEL_DATABASE_MODE=remote` environment variable

**Fixes**:
- Added `apt --fix-broken install` to resolve NVIDIA driver conflicts
- Improved database connection cleanup during deployment

**Impact**: Seamless database mode switching without manual configuration.

### Streaming Pipeline Fixes (Commits 41dc606, 71dcba8, 547714e)

**Change**: Fixed RTMP streaming pipeline to correctly enable Twitch and Kick destinations with Chrome Beta.

**Fixes**:
- **Auto-Detection**: `scripts/deploy-vast.sh` now auto-detects enabled destinations from available stream keys using `||` logic
- **PM2 Environment**: `ecosystem.config.cjs` explicitly forwards stream keys, `DISPLAY`, and `DATABASE_URL` through PM2 environment
- **Secret Aliases**: `.github/workflows/deploy-vast.yml` adds `TWITCH_RTMP_STREAM_KEY` alias to secrets file for compatibility
- **Stream Entry Points**: Added dedicated `stream.html` and `stream.tsx` for optimized streaming capture
- **Viewport Mode Detection**: `packages/shared/src/runtime/clientViewportMode.ts` utility automatically detects stream/spectator/normal modes
- **Multi-Page Build**: Vite now builds separate bundles for game and streaming entry points
- **Chrome Beta**: Switched to `google-chrome-beta` with default ANGLE backend for better stability

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

# Streaming capture configuration
STREAM_CAPTURE_CHANNEL=chrome-beta
STREAM_CAPTURE_ANGLE=default
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720
DISPLAY=:99
```

**Impact**: Reliable multi-platform RTMP streaming with automatic destination detection, proper secret forwarding, and stable Chrome Beta rendering.

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

**Files Changed**:
- `packages/server/src/eliza/agentHelpers.ts` - Added `elizacloud` provider to agent configuration
- `packages/server/src/eliza/ModelAgentSpawner.ts` - Updated model agent spawning to use ElizaCloud
- `packages/plugin-hyperscape/src/index.ts` - Added ElizaCloud plugin to type definitions

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

### TypeScript Fixes (Commits 74b9852, 6cdbf2c, b542751)

**Problem**: TS18048 errors for `GAME_API_URL` and other import.meta.env values possibly being undefined.

**Fix**: Switch from `||` to `??` (nullish coalescing) for import.meta.env values so TypeScript can narrow the type through the fallback chain.

**Files Changed**:
- `packages/client/src/lib/api-config.ts` - Added explicit string types to URL exports

**Impact**: Eliminates TypeScript errors without requiring non-null assertions.

See CLAUDE.md for complete documentation.
