# Recent Improvements - March 2026

This document summarizes all major improvements, bug fixes, and new features added to Hyperscape in early March 2026.

## Table of Contents

- [Branding & Assets](#branding--assets)
- [Object Pooling & Memory Management](#object-pooling--memory-management)
- [Streaming & Deployment](#streaming--deployment)
- [Database & Infrastructure](#database--infrastructure)
- [Testing & Stability](#testing--stability)
- [Dependency Updates](#dependency-updates)

## Branding & Assets

### Git LFS for Branding Files (PR #981)

**Commits**: f334c57b, 468da2ee, 2dd85d34

Binary branding assets (~28MB) are now tracked via Git LFS to prevent repository bloat:

**New Files**:
- `publishing/branding/` - Official logo files in multiple formats
- `.gitattributes` - Git LFS configuration for binary assets

**Logo Variants**:
- `hyperscape_logo_color` - Full wordmark with gold gradient (primary)
- `hyperscape_logo_black` - Solid black for print/light backgrounds
- `hyperscape_logo_white` - Solid white for dark backgrounds
- `hyperscape_logo_icon_color` - "HS" icon for favicons/app icons

**Formats**:
- **SVG** (text, tracked by Git): Source of truth for digital use
- **EPS, PDF, PNG, JPG, AI** (binary, tracked by Git LFS): Print and raster formats

**Setup**:
```bash
git lfs install
git clone https://github.com/HyperscapeAI/hyperscape.git
```

See `publishing/branding/README.md` for complete usage guidelines.

## Object Pooling & Memory Management

### Zero-Allocation Event Emission (Commit 4b64b148)

**Problem**: Combat system fires events every 600ms tick per combatant, causing significant GC pressure from object allocations.

**Solution**: Comprehensive object pooling for event payloads eliminates hot-path allocations.

**New Infrastructure**:
- `packages/shared/src/utils/pools/EventPayloadPool.ts` - Factory for type-safe event payload pools
- `packages/shared/src/utils/pools/PositionPool.ts` - Pool for `{x, y, z}` position objects
- `packages/shared/src/utils/pools/CombatEventPools.ts` - Pre-configured pools for combat events

**Usage Pattern**:
```typescript
// In event emitter (CombatSystem, etc.)
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attacker.id;
payload.targetId = target.id;
payload.damage = 15;
this.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In event listener - MUST call release()
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  // Process damage...
  CombatEventPools.damageDealt.release(payload);
});
```

**Available Pools**:
- `damageDealt` (64 initial, 32 growth)
- `projectileLaunched` (32 initial, 16 growth)
- `faceTarget` (64 initial, 32 growth)
- `clearFaceTarget` (64 initial, 32 growth)
- `attackFailed` (32 initial, 16 growth)
- `followTarget` (32 initial, 16 growth)
- `combatStarted` (32 initial, 16 growth)
- `combatEnded` (32 initial, 16 growth)
- `projectileHit` (32 initial, 16 growth)
- `combatKill` (16 initial, 8 growth)

**Features**:
- Automatic growth when exhausted (warns every 60s)
- Leak detection (warns when payloads not released, max 10 warnings then suppressed)
- Statistics tracking (acquire/release counts, peak usage)
- Global registry for monitoring all pools

**Performance Impact**:
- Eliminates per-tick object allocations in combat hot paths
- Memory stays flat during 60s stress test with agents in combat
- Verified zero-allocation event emission in CombatSystem and CombatTickProcessor
- Reduces GC pressure by 90%+ in high-frequency combat scenarios

**Monitoring**:
```typescript
// Get statistics for all combat pools
const stats = CombatEventPools.getAllStats();

// Check for leaked payloads (call at end of tick)
const leakCount = CombatEventPools.checkAllLeaks();

// Global registry for all pools
import { eventPayloadPoolRegistry } from '@hyperscape/shared/utils/pools';
const allStats = eventPayloadPoolRegistry.getAllStats();
const allLeaks = eventPayloadPoolRegistry.checkAllLeaks();
```

**Creating New Pools**:
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

**CRITICAL**: Event listeners MUST call `release()` after processing. Failure to release causes pool exhaustion and memory leaks.

## Streaming & Deployment

### Graceful Restart API (Commit c76ca516)

**Problem**: Deploying new code during an active duel interrupts the stream and breaks the viewer experience.

**Solution**: Zero-downtime deployment API that waits for the current duel to complete before restarting.

**New Endpoints**:
- `POST /admin/graceful-restart` - Request restart after current duel ends
- `GET /admin/restart-status` - Check if restart is pending

**Programmatic API**:
```typescript
// In StreamingDuelScheduler
scheduler.requestGracefulRestart(); // Returns boolean (true if scheduled)
scheduler.isPendingRestart();        // Returns boolean
```

**Behavior**:
- If no duel active (IDLE/ANNOUNCEMENT): restart immediately via SIGTERM
- If duel in progress (FIGHTING/RESOLUTION): wait until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

**Response Format**:
```json
{
  "success": true,
  "message": "Graceful restart scheduled after current duel (phase: FIGHTING)",
  "pendingRestart": true,
  "currentPhase": "FIGHTING"
}
```

**Use Case**: Deploy code updates to the duel arena stream without interrupting active fights.

### Placeholder Frame Mode (Commit 83056565)

**Problem**: Twitch/YouTube disconnect streams after 30 minutes of "idle" content (no significant visual changes).

**Solution**: Send minimal placeholder frames during idle periods to keep the stream alive.

**Configuration**:
```bash
STREAM_PLACEHOLDER_ENABLED=true  # Enable placeholder mode (default: false)
```

**Behavior**:
- Detects when no frames received for 5 seconds
- Switches to placeholder mode, sending minimal JPEG frames at configured FPS
- Automatically exits placeholder mode when live frames resume
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size

**Implementation**:
- `RTMPBridge.startPlaceholderMode()` - Start sending placeholder frames
- `RTMPBridge.stopPlaceholderMode()` - Resume live frames
- `RTMPBridge.generatePlaceholderJpeg()` - Generate minimal JPEG buffer

**Use Case**: Prevent stream disconnects during announcement/resolution phases or when no combat is happening.

### Streaming Status Check Script (Commit 61c14bc8)

**New Script**: `scripts/check-streaming-status.sh`

Quick diagnostic for verifying streaming health on Vast.ai deployments.

**Usage**:
```bash
bun run duel:status
# OR
bash scripts/check-streaming-status.sh [server_url]
```

**Checks**:
1. Server health endpoint
2. Streaming API status
3. Duel context (fighting phase, contestants)
4. RTMP bridge status and bytes streamed
5. PM2 process status
6. Recent logs (last 20 lines)

**Output**:
- ✓ Green checkmarks for healthy services
- ⚠ Yellow warnings for idle/waiting states
- ✗ Red errors for failures
- Summary of stream status (LIVE, ACTIVE, or issues)

**Use Case**: Quick health check during deployments or when debugging streaming issues.

### Model Agent Spawning (Commit fe6b5354)

**Problem**: Fresh deployments with empty databases can't run duels because no agents exist.

**Solution**: Automatic agent creation when database is empty.

**Configuration**:
```bash
SPAWN_MODEL_AGENTS=true  # Enable automatic agent creation (default: false)
```

**Behavior**:
- Checks if database has any agents on startup
- If empty, spawns model agents automatically
- Allows duels to run immediately on fresh deployments
- Useful for testing and demo environments

**Use Case**: Fresh Vast.ai deployments, testing environments, demo instances.

### WebGPU Initialization Improvements

**Secure Context Fix** (Commit 579124b6, ebd197f2):
- Changed WebGPU preflight test from `about:blank` to `localhost:3333`
- `about:blank` is NOT a secure context, causing `navigator.gpu` to be undefined
- Localhost HTTP server ensures proper WebGPU API exposure

**Adapter Info Compatibility** (Commit cb3cbfe9, f38a76c5):
- Falls back to direct adapter properties when `requestAdapterInfo()` unavailable
- Older Chromium versions don't have `adapter.requestAdapterInfo()`
- Ensures WebGPU diagnostics work across all Chrome versions

**Page Navigation Timeout** (Commit b3e096db):
- Increased from 60s to 120s for WebGPU shader compilation on first load
- Prevents timeout errors during initial shader compilation

**Chrome Flag Consolidation** (Commit 969441510):
- Consolidate multiple `--enable-features` flags into single comma-separated flag
- Add `isSecureContext` check to understand WebGPU availability
- Add `hasGpuProperty` check to distinguish undefined vs falsy `navigator.gpu`
- Add Dawn swiftshader backend for SwiftShader mode
- Print navigator GPU-related properties for debugging

**PM2 Log Capture** (Commit 712516c9):
- Wait 60s for streaming bridge to initialize after PM2 start
- Capture PM2 logs to diagnose streaming issues
- Detect crash loops and dump error logs automatically

## Database & Infrastructure

### Railway Database Detection (Commits a5a201c0, d8c26d2f)

**Problem**: Railway uses pgbouncer connection pooling which doesn't support prepared statements, causing XX000 errors.

**Solution**: Automatic detection of Railway proxy connections with appropriate configuration.

**Detection Methods**:
1. `RAILWAY_ENVIRONMENT` env var (most reliable, auto-set by Railway)
2. Hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`

**Configuration Changes**:
- Disables prepared statements when using Railway proxy
- Uses lower connection pool limits (max: 6 instead of 10-20)
- Prevents "too many clients already" errors

**Implementation**:
```typescript
// In packages/server/src/database/client.ts
function isServerlessDatabase(connectionString: string): boolean {
  return (
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes(".rlwy.net") ||
    connectionString.includes(".railway.app") ||
    connectionString.includes(".railway.internal") ||
    process.env.RAILWAY_ENVIRONMENT !== undefined
  );
}

function isSupavisorPooler(connectionString: string): boolean {
  const isRailwayProxy =
    process.env.RAILWAY_ENVIRONMENT !== undefined ||
    connectionString.includes(".proxy.rlwy.net") ||
    connectionString.includes(".railway.internal");

  return (
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("pgbouncer=true") ||
    isRailwayProxy
  );
}
```

**Use Case**: Automatic Railway deployment without manual configuration.

### PostgreSQL Connection Pool Optimization (Commits 0c8dbe0f, 454d0ad2, 56f9067e)

**Problem**: Crash loops cause connection exhaustion, leading to "too many clients already" errors.

**Solution**: Reduced connection pool size and increased restart delays.

**Configuration Changes**:
```bash
POSTGRES_POOL_MAX=3              # Down from 6 (or 1 for duel deployments)
POSTGRES_POOL_MIN=0              # Don't hold idle connections during crashes
```

**PM2 Configuration**:
```javascript
// In ecosystem.config.cjs
restart_delay: 10000,            // 10s (up from 5s) to allow connections to close
exp_backoff_restart_delay: 2000, // 2s for gradual backoff on repeated failures
```

**Impact**: Prevents PostgreSQL error 53300 during crash loop scenarios.

### Deployment Process Improvements (Commits 087033fa, 58d88f4c, dbd4332d)

**Targeted Process Killing** (Commit 087033fa):
- Use specific process names instead of blanket `pkill -f bun`
- Prevents deploy script from killing itself
- Graceful PM2 shutdown with delays between commands

**Process Teardown Before Migration** (Commit 58d88f4c):
- Kill processes and wait 30s for DB connections to close before running migrations
- Prevents "too many clients" errors during database migrations
- Ensures clean state before schema changes

**Branch Fix** (Commit dbd4332d):
- Deploy from `main` branch instead of `hackathon` branch
- Ensures production deployments use stable code

**GitHub Actions Fixes** (Commit f892d0b2):
- Fixed `upload-artifact` version (v7 → v4) for compatibility
- Fixed build order (shared must build before impostors/procgen)
- Fixed heredoc variable expansion in deploy-vast.yml

## Testing & Stability

### Vitest 4.x Upgrade (Commit a916e4ee)

**Problem**: Vitest 2.x is incompatible with Vite 6.x, causing `__vite_ssr_exportName__` errors.

**Solution**: Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6.

**Migration**:
```json
{
  "devDependencies": {
    "vitest": "^4.0.6",
    "@vitest/coverage-v8": "^4.0.6"
  }
}
```

**Impact**: All packages using Vitest now work with Vite 6.x. No API changes required - tests continue to work as-is.

### Anchor Test Skip (Commit 8b7d1261)

**Problem**: Anchor localnet tests fail in CI when Solana CLI is not installed, causing false failures.

**Solution**: Automatically skip Anchor localnet tests in CI when Solana CLI is unavailable.

**Implementation**:
- Check for `solana` command availability before running tests
- Skip tests with clear message if Solana CLI not found
- Prevents CI failures on environments without Solana toolchain

### Type Fixes (Commit b61a34e7)

**Fixed Issues**:
- Added 'banking' goal type to `CurrentGoal` interface
- Removed non-existent `lootStarterChestAction` import
- Added `getDuelHistory` stub method to `AutonomousBehaviorManager`
- Fixed CombatSystem projectile event using wrong property name (`flightTimeMs` → `travelDurationMs`)
- Updated gold-betting-demo IDL files

## API Documentation

### Admin Routes

**Graceful Restart Endpoints**:

```typescript
// Request graceful restart
POST /admin/graceful-restart
Headers: { "x-admin-code": "YOUR_ADMIN_CODE" }
Response: {
  success: true,
  message: "Graceful restart scheduled after current duel (phase: FIGHTING)",
  pendingRestart: true,
  currentPhase: "FIGHTING"
}

// Check restart status
GET /admin/restart-status
Headers: { "x-admin-code": "YOUR_ADMIN_CODE" }
Response: {
  pendingRestart: boolean,
  currentPhase: "FIGHTING" | "IDLE" | "ANNOUNCEMENT" | "RESOLUTION"
}
```

**Use Case**: Zero-downtime deployments for duel arena stream.

### StreamingDuelScheduler API

**New Methods**:

```typescript
class StreamingDuelScheduler {
  /**
   * Request a graceful server restart after the current duel ends.
   * @returns Whether the restart was scheduled (false if already pending)
   */
  requestGracefulRestart(): boolean;

  /**
   * Check if a graceful restart is pending
   */
  isPendingRestart(): boolean;
}
```

**Behavior**:
- If no active duel: triggers immediate restart via SIGTERM
- If duel in progress: waits for RESOLUTION phase to complete
- PM2 handles the actual restart
- Returns false if restart already pending

## Environment Variables

### New Variables

**Streaming Configuration**:
```bash
STREAM_PLACEHOLDER_ENABLED=true  # Send placeholder frames during idle periods
STREAM_LOW_LATENCY=true          # Use zerolatency tune for faster playback
STREAM_GOP_SIZE=60               # GOP size in frames (default: 60)
STREAM_AUDIO_ENABLED=true        # Enable audio capture
PULSE_AUDIO_DEVICE=...           # PulseAudio device name (default: chrome_audio.monitor)
STREAM_CAPTURE_EXECUTABLE=...    # Explicit Chrome path for WebGPU
```

**Database Configuration**:
```bash
POSTGRES_POOL_MAX=3              # Max connections (3 for crash loops, 1 for duels)
POSTGRES_POOL_MIN=0              # Min connections (0 to not hold idle)
RAILWAY_ENVIRONMENT=...          # Auto-detected by Railway (most reliable detection)
```

**Agent Configuration**:
```bash
SPAWN_MODEL_AGENTS=true          # Auto-create agents when database is empty
```

**Production Client**:
```bash
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

## Scripts & Commands

### New Commands

**Streaming Status Check**:
```bash
bun run duel:status
# OR
bash scripts/check-streaming-status.sh [server_url]
```

**Vast.ai Provisioning**:
```bash
VAST_API_KEY=xxx bun run vast:provision
```

## Migration Notes

### Breaking Changes

**Vitest 4.x Required**:
- All packages using Vitest must upgrade to 4.x for Vite 6 compatibility
- Update `vitest` and `@vitest/coverage-v8` to `^4.0.6`
- No API changes - tests work as-is

**Event Payload Pools**:
- Event listeners MUST call `release()` after processing pooled payloads
- Failure to release causes pool exhaustion and memory leaks
- Add `CombatEventPools.{poolName}.release(payload)` to all combat event listeners

### Recommended Actions

**For Railway Deployments**:
1. Set `POSTGRES_POOL_MAX=6` (or lower) in `.env`
2. Set `POSTGRES_POOL_MIN=0` to not hold idle connections
3. Increase `restart_delay=10s` in PM2 config
4. Railway detection is automatic - no manual configuration needed

**For Vast.ai Deployments**:
1. Use `bun run vast:provision` to automatically rent WebGPU-capable instances
2. Ensure instances have `gpu_display_active=true`
3. Set `STREAM_PLACEHOLDER_ENABLED=true` to prevent 30-minute disconnects
4. Use `bun run duel:status` to monitor streaming health

**For Production Streaming**:
1. Set `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`
2. Use pre-built client for faster page loads
3. Enable placeholder frames to prevent disconnects
4. Use graceful restart API for zero-downtime deployments

## Performance Metrics

### Object Pooling Impact

**Before**:
- ~1000 object allocations per second during active combat
- Heap growth of ~50MB over 60s stress test
- Frequent GC pauses (10-20ms)

**After**:
- Zero allocations in combat hot paths after warmup
- Flat memory usage during 60s stress test
- GC pressure reduced by 90%+

### Streaming Improvements

**Page Load Time**:
- Dev server: 30-180s (JIT compilation)
- Production build: 5-10s (pre-compiled)

**Stream Stability**:
- Placeholder mode prevents 30-minute disconnects
- Graceful restart enables zero-downtime deployments
- Automatic recovery from WebGPU initialization failures

## Dependency Updates

### Major Version Updates

**Bun Runtime**:
- Updated from v1.1.38 to v1.3.10 (Commit bc3b1bcf)
- Docker image: `oven/bun:1.3.10-alpine`

**Vitest**:
- Updated from v2.1.0 to v4.0.6 (Commit a916e4ee)
- Required for Vite 6.x compatibility

**GitHub Actions**:
- `actions/configure-pages`: v4 → v5 (Commit ab81e50b)
- `actions/upload-artifact`: v4 → v7 (Commit 7a65a2a8)
- `appleboy/ssh-action`: v1.0.3 → v1.2.5 (Commit 3040c29f)

## Summary

This release focused on three main areas:

1. **Memory Management**: Object pooling eliminates GC pressure in combat hot paths
2. **Streaming Reliability**: Placeholder frames, graceful restarts, and improved WebGPU initialization
3. **Infrastructure**: Railway detection, connection pool optimization, deployment process improvements

**Total Changes**: 50+ commits across 100+ files with comprehensive improvements to stability, performance, and developer experience.

**Key Metrics**:
- 90%+ reduction in GC pressure during combat
- Zero-downtime deployments for duel arena
- Automatic Railway/Vast.ai configuration
- Improved test stability with Vitest 4.x

See individual commit messages for detailed technical information.
