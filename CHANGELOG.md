# Changelog

All notable changes to Hyperscape are documented in this file.

## [Unreleased] - 2026-03-07

### Added

#### Streaming & Deployment
- **Graceful Restart API** (c76ca516): Zero-downtime deployments for duel arena
  - `POST /admin/graceful-restart` - Request restart after current duel ends
  - `GET /admin/restart-status` - Check if restart is pending
  - Waits for RESOLUTION phase before restarting if duel in progress
  - PM2 automatically restarts with new code
- **Placeholder Frame Mode** (83056565): Prevents 30-minute stream disconnects
  - Set `STREAM_PLACEHOLDER_ENABLED=true` to enable
  - Sends minimal JPEG frames during idle periods
  - Automatically exits when live frames resume
- **Streaming Status Check** (61c14bc8): Quick diagnostic script
  - `bun run duel:status` - Check server health, RTMP bridge, PM2 processes, logs
  - Useful for verifying streaming health on Vast.ai or Railway
- **Model Agent Spawning** (fe6b5354): Auto-create agents for fresh deployments
  - Set `SPAWN_MODEL_AGENTS=true` to enable
  - Allows duels to run even with empty database
- **Page Load Timeout** (b3e096db): Increased to 120s for WebGPU shader compilation

#### Database & Infrastructure
- **Railway Database Detection** (a5a201c, d8c26d2): Automatic Railway proxy detection
  - Detects via `RAILWAY_ENVIRONMENT` env var (most reliable)
  - Also detects `.rlwy.net`, `.railway.app`, `.railway.internal` hostnames
  - Disables prepared statements (not supported by pgbouncer)
  - Uses lower connection pool limits (max: 6)
  - Fixes "too many clients already" errors
- **PostgreSQL Connection Pool** (0c8dbe0f, 454d0ad2): Crash loop protection
  - `POSTGRES_POOL_MAX=3` (down from 6) to prevent connection exhaustion
  - `POSTGRES_POOL_MIN=0` to not hold idle connections
  - `restart_delay=10s` (up from 5s) to allow connections to close
  - `exp_backoff_restart_delay=2s` for gradual backoff
  - Prevents PostgreSQL error 53300 during crash loops

#### Agent System
- **Banking Goal Type** (b61a34e7): Added 'banking' to CurrentGoal interface
  - Enables agent banking behavior
  - Proper quest lifecycle transitions with goal status change detection

#### Branding
- **Git LFS for Binary Assets** (f334c57b): Branding files tracked via Git LFS
  - Binary files (.ai, .eps, .pdf, .png, .jpg) moved to Git LFS (~28MB)
  - Prevents repo bloat
  - Added `.gitattributes` file at repo root
  - Added `publishing/branding/README.md` with usage guidelines

### Changed

#### Runtime & Dependencies
- **Bun Runtime Upgrade** (bc3b1bc): v1.1.38 → v1.3.10
  - Updated Docker image: `oven/bun:1.1.38-alpine` → `oven/bun:1.3.10-alpine`
  - Updated `package.json` engines requirement
- **Vitest Upgrade** (a916e4ee): 2.x → 4.x for Vite 6 compatibility
  - Upgraded `vitest` and `@vitest/coverage-v8` from 2.1.0 to 4.0.6
  - Fixes `__vite_ssr_exportName__` errors during test runs
  - Required for Vite 6 SSR module handling

#### Deployment Process
- **Process Teardown Before Migration** (58d88f4c): Prevents "too many clients" errors
  - Kills processes and waits 30s for DB connections to close before migrations
  - Moved process teardown before database migration step
- **Targeted Process Killing** (087033fa): Avoids killing deploy script
  - Uses specific process names instead of `pkill -f bun`
  - Graceful PM2 shutdown with delays between commands
- **Branch Fix** (dbd4332d): Deploy from main branch instead of hackathon

#### GitHub Actions
- **Workflow Fixes** (f892d0b2):
  - Fixed upload-artifact version (v7 → v4) in ci.yml, integration.yml, build-app.yml
  - Fixed build order: shared must build before impostors/procgen
  - Fixed heredoc variable expansion in deploy-vast.yml
- **Dependency Updates**:
  - actions/configure-pages: 4 → 5 (ab81e50b)
  - actions/upload-artifact: 4 → 7 (7a65a2a8)
  - appleboy/ssh-action: 1.0.3 → 1.2.5 (3040c29f)

### Fixed

#### Test Stability
- **Anchor Test Skip** (8b7d1261): Skip Anchor localnet tests in CI when Solana CLI not installed
  - Prevents false failures in CI environments without Solana CLI
  - Tests run normally when Solana CLI is available
- **Type Errors** (b61a34e7): Resolved typecheck errors and failing tests
  - Added 'banking' goal type to CurrentGoal interface
  - Removed non-existent lootStarterChestAction import
  - Added getDuelHistory stub method to AutonomousBehaviorManager
  - Fixed CombatSystem projectile event property name (flightTimeMs → travelDurationMs)
  - Updated gold-betting-demo IDL files
- **localStorage Mock** (483628c1): Fixed PlayerTokenManager test type error

### Performance

#### Object Pooling (4b64b148)
- **Zero-Allocation Event Emission**: Eliminates GC pressure in combat hot paths
  - New pool infrastructure:
    - `PositionPool.ts`: Pool for {x,y,z} position objects
    - `EventPayloadPool.ts`: Factory for type-safe event payload pools
    - `CombatEventPools.ts`: Pre-configured pools for combat events
  - Combat system migration: Pre-allocated payloads for all combat events
  - Additional optimizations:
    - TerrainSystem: Fixed player position tracking for proper tile unloading
    - PendingGatherManager: Reduced logging, added early-out for repeated gathers
    - AgentBehaviorTicker: Removed per-tick logging allocations
    - ResourceSystem: Added isPlayerGatheringResource() for early-out checks
  - Verified: Memory stays flat during 60s stress test with agents in combat
  - Reduces GC pressure by 90%+ in high-frequency combat scenarios

### Documentation

- Updated AGENTS.md with Bun 1.3.10, Vitest 4.x, object pooling, Railway detection
- Updated README.md with new commands, environment variables, and troubleshooting
- Updated CLAUDE.md with tech stack versions and deployment improvements
- Updated docs/duel-stack.md with streaming features and monitoring commands
- Updated docs/betting-production-deploy.md with Railway configuration and new env vars
- Added publishing/branding/README.md with logo usage guidelines

## Commit References

- bc3b1bc - Bun runtime upgrade (1.1.38 → 1.3.10)
- a916e4ee - Vitest upgrade (2.x → 4.x)
- 4b64b148 - Object pooling for zero-allocation event emission
- a5a201c, d8c26d2 - Railway database detection
- c76ca516 - Graceful restart API
- 83056565 - Placeholder frame mode
- 61c14bc8 - Streaming status check script
- fe6b5354 - Model agent spawning
- 0c8dbe0f, 454d0ad2 - PostgreSQL connection pool configuration
- 58d88f4c - Process teardown before migration
- 087033fa - Targeted process killing
- dbd4332d - Branch fix (main instead of hackathon)
- f892d0b2 - GitHub Actions fixes
- f334c57b - Git LFS for branding assets
- b61a34e7 - Banking goal type and type error fixes
- 8b7d1261 - Anchor test skip in CI
- b3e096db - Page load timeout increase
- ab81e50b, 7a65a2a8, 3040c29f - Dependency updates
- 483628c1 - localStorage mock fix

## Migration Notes

### Vitest 4.x Upgrade

If you see `__vite_ssr_exportName__` errors:

```bash
bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6
```

Vitest 2.x is incompatible with Vite 6.x. No API changes required - tests continue to work as-is.

### Railway Deployments

Railway proxy detection is now automatic. If you previously had manual workarounds for Railway, you can remove them:

```bash
# These are now auto-detected - no manual config needed
# RAILWAY_ENVIRONMENT is set automatically by Railway
# Hostname detection works for .rlwy.net, .railway.app, .railway.internal
```

Set lower connection pool limits to prevent "too many clients" errors:

```bash
POSTGRES_POOL_MAX=6              # Or 3 for crash loop protection
POSTGRES_POOL_MIN=0
```

### Object Pooling

If you're adding new high-frequency events, create a pool to avoid GC pressure:

```typescript
import { createEventPayloadPool, eventPayloadPoolRegistry, type PooledPayload } from './EventPayloadPool';

interface MyEventPayload extends PooledPayload {
  entityId: string;
  value: number;
}

const myEventPool = createEventPayloadPool<MyEventPayload>({
  name: 'MyEvent',
  factory: () => ({ entityId: '', value: 0 }),
  reset: (p) => { p.entityId = ''; p.value = 0; },
  initialSize: 32,
  growthSize: 16,
  warnOnLeaks: true,
});

// Register for monitoring
eventPayloadPoolRegistry.register(myEventPool);
```

**CRITICAL**: Event listeners MUST call `release()` after processing to avoid memory leaks.

### Branding Assets

Binary branding files are now tracked via Git LFS. Ensure Git LFS is installed:

```bash
# macOS
brew install git-lfs

# Linux
apt install git-lfs

# Initialize (one-time)
git lfs install
```

When cloning the repository, Git LFS will automatically download binary assets.
