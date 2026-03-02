# Changelog

All notable changes to Hyperscape are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Object Pooling System (PR #hackathon)
- **EventPayloadPool**: Factory for creating type-safe event payload pools
- **PositionPool**: Global pool for `{x, y, z}` position objects with O(1) acquire/release
- **CombatEventPools**: Pre-configured pools for all combat events (damageDealt, projectileLaunched, faceTarget, clearFaceTarget, attackFailed, followTarget, combatStarted, combatEnded, projectileHit, combatKill)
- **Pool Configuration**: Initial size 16-64 objects, growth size 8-32 objects, automatic growth when exhausted
- **Leak Detection**: Warns when payloads not released at end of tick
- **Statistics Tracking**: Track acquire/release counts, peak usage, leak warnings
- **Performance**: Eliminates per-tick object allocations in combat hot paths, memory stays flat during 60s stress test

#### Streaming Commands
- **`bun run duel:status`**: Quick diagnostic for streaming health on Vast.ai (checks server health, streaming API, duel context, RTMP bridge, PM2 processes, recent logs)
- **`bun run vast:search`**: Search for WebGPU-capable Vast.ai instances
- **`bun run vast:provision`**: Provision new Vast.ai instance automatically
- **`bun run vast:status`**: Check current Vast.ai instance status
- **`bun run vast:destroy`**: Destroy current Vast.ai instance
- **`bun run vast:keeper`**: Run vast-keeper monitoring service

#### Vast.ai Provisioner Script
- **`./scripts/vast-provision.sh`**: Automated provisioner for Vast.ai instances
- Searches for instances with `gpu_display_active=true` (REQUIRED for WebGPU)
- Filters by reliability (≥95%), GPU RAM (≥20GB), price (≤$2/hr), disk space (≥120GB)
- Automatically rents best available instance
- Waits for instance to be ready
- Outputs SSH connection details and GitHub secret commands
- Saves configuration to `/tmp/vast-instance-config.env`

#### Streaming Status Check Script
- **`./scripts/check-streaming-status.sh`**: Quick diagnostic for verifying streaming health
- Checks server health, streaming API status, duel context (fighting phase)
- Checks RTMP bridge status and bytes streamed
- Checks PM2 process status and recent logs
- Color-coded output for easy diagnosis

#### E2E Journey Tests (PR #950)
- **`complete-journey.spec.ts`**: Full login→loading→spawn→walk gameplay tests
- Screenshot comparison utilities to verify game is rendering correctly
- Loading screen detection helpers (`waitForLoadingScreenHidden`)
- Real browser testing with Playwright and actual WebGPU rendering (no mocks)

#### Environment Variables
- **`SPAWN_MODEL_AGENTS`**: Enable automatic agent creation when database is empty (allows duels to run with empty DB)
- **`STREAM_CAPTURE_EXECUTABLE`**: Explicit Chrome path for reliable WebGPU (e.g., `/usr/bin/google-chrome-unstable`)
- **`STREAM_LOW_LATENCY`**: Enable `zerolatency` tune for faster playback start (default: false)
- **`STREAM_GOP_SIZE`**: Configurable GOP size in frames (default: 60)
- **`DUEL_USE_PRODUCTION_CLIENT`**: Serve pre-built client via `vite preview` instead of dev server
- **`POSTGRES_POOL_MAX`**: Maximum PostgreSQL connection pool size (default: 3, down from 6)
- **`POSTGRES_POOL_MIN`**: Minimum PostgreSQL connection pool size (default: 0)

### Changed

#### Performance Optimizations (PR #950)

**Movement System**:
- Immediate move processing bypasses ActionQueue (eliminates 0-600ms latency)
- Pathfinding rate limit raised from 5/sec to 15/sec to match tile movement limiter
- BFS iterations increased from 2000 to 8000 (~44 tile radius vs ~22 tile)
- Path continuation for seamless long-distance movement with automatic re-pathfinding
- Skating fix with server-side pre-computation + client-side path appending
- Multi-click feel with optimistic target pivoting + pending move queue
- Per-frame allocation elimination with pre-allocated buffers and squared distance comparisons

**Minimap Rendering**:
- Async terrain generation (50×50 grid) runs off RAF callback via setTimeout(0) yields
- Zero RAF blocking - terrain generation happens in background macrotasks
- Canvas rotation transform decouples regeneration from camera rotation
- Reduced terrain sampling from up to 40,000 pixels to 2,500 (16× reduction)
- Layer synchronization - all layers use same camera snapshot
- Cached contexts to avoid getContext() DOM queries
- Rotation threshold raised from 0.01 to 0.087 (~5°) to prevent regeneration on every tiny angular change

**GPU Resource Hygiene**:
- Object pools for XPDropSystem and DuelCountdownSplatSystem
- Proper destroy() methods for HealthBars and ProjectileRenderer
- Machine ID caching and activity debouncing (500ms)
- Stale health bar sweep for despawned entities (reverse iteration)
- World initialization race condition fix with two-flag handshake (initComplete + needsCleanup)
- ThreeResourceManager teardown() to stop dev monitor interval

#### Combat System
- Zero-allocation event emission with object pooling (CombatEventPools)
- Combat retry timer aligned with tick system (3000ms = 5 ticks)
- Phase timeout reduced from 30s to 10s for faster failure detection
- Combat stall nudge tracks last nudge timestamp for re-nudging
- Damage event cache cleanup every tick, cap lowered to 1000, evict 75%
- TerrainSystem player position tracking fixed for proper tile unloading
- PendingGatherManager reduced logging, added early-out for repeated gathers
- ResourceSystem added `isPlayerGatheringResource()` for early-out checks

#### Agent System
- LLM rate limiting with exponential backoff (5s base, max 60s)
- Dynamic combat escalation (goblins → bandits → barbarians as combat level grows)
- Combat style rotation (attack → strength → defense, train lowest skill)
- Cooking phase for immediate food preparation
- Gear upgrade phase for smithing better equipment
- Combat food threshold increased from 5 → 10 for better survival
- Quest goal status change detection for proper quest lifecycle transitions

#### WebGPU & Streaming
- Safari 18+ (macOS 15+) now required (Safari 17 support removed)
- WebGPU initialization with 30s adapter timeout and 60s renderer timeout
- Preflight testing on localhost server (secure context, not about:blank)
- Adapter info compatibility fallback for older Chromium (requestAdapterInfo() not available)
- Production client build support (fixes 180s browser timeout caused by Vite JIT compilation)
- Stream encoding with 2x bitrate buffer multiplier (reduced from 4x to prevent backpressure)
- Health check timeout: 5s (data timeout: 15s) for faster failure detection
- Browser restart every 45 minutes to prevent WebGPU OOM crashes
- Page navigation timeout increased to 180s for Vite dev mode (production build recommended)

#### Vast.ai Deployment
- GPU display driver requirement (`gpu_display_active=true`) - CRITICAL for WebGPU
- Early display driver check with nvidia_drm kernel module and /dev/dri/ device node verification
- 6-stage WebGPU testing during deployment (headless-vulkan, headless-egl, xvfb-vulkan, ozone-headless, swiftshader, playwright-xvfb)
- Verbose Chrome GPU logging for diagnostics (`--enable-logging=stderr --v=1`)
- PM2 log capture with 60s initialization wait and crash loop detection
- Display environment reuse to prevent Vulkan ICD configuration loss
- X server detection via socket check (`/tmp/.X11-unix/X99`) instead of xdpyinfo
- Chrome flag consolidation (multiple `--enable-features` into single comma-separated flag)

#### PostgreSQL Connection Pool (PR #951)
- `POSTGRES_POOL_MAX=3` (down from 6) to prevent connection exhaustion during crash loops
- `POSTGRES_POOL_MIN=0` to not hold idle connections during crashes
- `restart_delay=10s` (up from 5s) to allow connections to fully close before PM2 restart
- `exp_backoff_restart_delay=2s` for more gradual backoff on repeated failures
- Prevents PostgreSQL error 53300 (too many connections) during crash loop scenarios

#### Gold Betting Demo (PR #944)
- Mobile responsive UI with resizable panels for desktop
- Mobile detection with `useIsMobile` hook gates JS inline styles
- 16:9 aspect-ratio video, bottom-sheet sidebar, touch-friendly tab targets, dvh units
- Mobile header: stacked HYPERSCAPE/MARKET logo, phase strip above video
- Tab reordering: Trades tab moved first for better mobile UX
- Real data integration via live SSE feed from game server (devnet mode replaces mock data)
- Simulation mode available via `bun run dev:stream-ui`
- Recharts warning fix: raised `.hm-chart-container` min-height to 120px
- EventSource auto-reconnect prevention: close EventSource on onerror
- Exponential backoff: `useDuelContext` switched from fixed setInterval to setTimeout with backoff (3s → 6s → 60s cap)

#### Bun Version
- Updated from v1.1.38 to v1.3.10

#### Test Stability
- GoldClob fuzz tests with 120s timeout (4 seeds × 140 operations)
- Precision fixes for gas cost calculations (use 10000n amounts)
- Dynamic import timeout for service tests (60s for EmbeddedHyperscapeService)
- Anchor test configuration using localnet instead of devnet for free SOL
- SlidingWindowRateLimiter test updated to expect 15/sec for pathfind (was 5/sec)
- TradingSystem test guards world.off calls for test environments
- ScriptQueue test uses `handlers.clear()` not `this.handler = null`
- Mob tile movement test adds missing TileMovementState properties

### Fixed

#### Critical Memory Leaks (PR #950, PR #951)
- **ModelCache** (CRITICAL): Add geometry disposal on clear() and remove() - prevents GPU memory accumulation
- **EventBridge** (HIGH): Add destroy() method to clean up 50+ world event listeners
- **Logger** (MEDIUM): Store cleanup interval, add destroy() method
- **PlayerTokenManager** (MEDIUM): Add stopHeartbeat() method, call on logout/clear
- **Connection Handler** (MEDIUM): Track and cleanup error handler during auth cleanup
- **DuelBot** (MEDIUM): Track world.on() handlers and clean up on disconnect
- **AgentManager** (HIGH): Store and cleanup COMBAT_DAMAGE_DEALT listener in shutdown()
- **AutonomousBehaviorManager** (HIGH): Store and cleanup event handlers in stop()
- **ColliderComponent** (MEDIUM): Track collision event handlers and unsubscribe in destroy()
- **MobEntity** (MEDIUM): Track PLAYER_SET_DEAD listener and remove on destroy
- **Socket** (MEDIUM): Track WebSocket event handlers and clean up in disconnect()
- **ClientLiveKit** (MEDIUM): Clean up voices Map and room listeners in destroy()
- **AggroSystem** (MEDIUM): Clean up playerSkills, combatLevelCache, and aggro maps on player disconnect
- **StarterChestEntity** (MEDIUM): Add size limit (10k) with LRU pruning for lootedByCharacters Set
- **GameTickProcessor** (HIGH): Store bound event handlers, cleanup in destroy()
- **TradingSystem** (HIGH): Store bound handlers for PLAYER_LEFT/LOGOUT/DIED events, cleanup in destroy()
- **RTMPBridge** (HIGH): Call removeAllListeners() before closing WebSocket servers
- **ActionQueue** (MEDIUM): Add destroy() method to clear playerQueues
- **ScriptQueue** (MEDIUM): Add destroy() methods to PlayerScriptQueue and NPCScriptQueue
- **Shutdown Process** (HIGH): Call destroyAllRateLimiters() and destroyIdempotencyService() in shutdown.ts
- **XP Drop Listener**: Store bound handler so destroy() can call world.off()
- **PlayerTokenManager Disposal**: Call dispose() in index.tsx cleanup so beforeunload listener is removed

#### Agent System Crashes
- **Critical Crash Fix**: Fixed `weapon.toLowerCase is not a function` crash in getEquippedWeaponTier that broke ALL agents every tick

#### TypeScript Errors
- **ScriptQueue**: Change `this.handler = null` to `this.handlers.clear()` in PlayerScriptQueue.destroy()
- **Mob Tile Movement**: Add missing TileMovementState properties (requestedDestination, lastPathPartial, nextSegmentPrecomputed)

#### GitHub Actions Workflows
- **deploy-vast.yml**: Remove quotes from heredoc to enable variable expansion
- **ci.yml**: Fix build order (shared must build before impostors/procgen)
- **ci.yml, integration.yml, build-app.yml**: Fix upload-artifact@v7 to v4

#### Streaming Issues
- **Page Load Timeout**: Increased to 120s for WebGPU shader compilation on first load
- **Adapter Info Compatibility**: Falls back to direct adapter properties when requestAdapterInfo() unavailable (older Chromium)
- **Secure Context Fix**: Changed WebGPU preflight test from about:blank to localhost:3333 for proper navigator.gpu exposure
- **Display Environment Reuse**: duel-stack.mjs checks if DISPLAY is already set before spawning new Xvfb
- **X Server Detection**: Uses socket check (`/tmp/.X11-unix/X99`) instead of xdpyinfo
- **XDG_RUNTIME_DIR**: Required for Vulkan/EGL initialization (set to `/tmp/runtime-root`)
- **Stream-to-RTMP Readiness Probe**: Readiness probe text must match exactly between deployment script and rtmp-bridge

### Breaking Changes

#### Goal Type Addition
- **`CurrentGoal` interface**: Added 'banking' goal type
- **Migration**: Update any code that exhaustively checks goal types to include 'banking'

#### Projectile Event Property Rename
- **`COMBAT_PROJECTILE_LAUNCHED` event**: Property renamed from `flightTimeMs` to `travelDurationMs`
- **Migration**: Update any code that reads the `flightTimeMs` property to use `travelDurationMs` instead

#### TileMovementState Interface
- **New required fields**: `requestedDestination`, `lastPathPartial`, `nextSegmentPrecomputed`
- **Migration**: Update any code that creates TileMovementState objects to include these fields

#### ResourceVisualStrategy API
- **`onDepleted()` return type**: Now returns `boolean` instead of `void`
  - `true` = strategy handled depletion (instanced stump)
  - `false` = ResourceEntity should load individual depleted model
- **New optional method**: `getHighlightMesh(ctx)` for instanced entity highlighting
- **Migration**: Update any custom ResourceVisualStrategy implementations to return boolean from onDepleted()

### Deprecated

None

### Removed

- **Safari 17 Support**: Safari 18+ (macOS 15+) is now required for WebGPU

### Security

None

## [1.0.0] - 2024-XX-XX

Initial release.

[Unreleased]: https://github.com/HyperscapeAI/hyperscape/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/HyperscapeAI/hyperscape/releases/tag/v1.0.0
