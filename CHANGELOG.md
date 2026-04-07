# Changelog

All notable changes to Hyperscape will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation for April 2026 changes
- API documentation for DissolveAnimation system
- API documentation for tree collision proxy system
- API documentation for UI tooltip system
- Docker deployment guide with troubleshooting

### Changed
- Updated CLAUDE.md with April 2026 changes
- Updated README.md with recent features and troubleshooting

## [April 2026] - 2026-04-07

### Fixed
- **Client Auth Config** (ebbb9ed): Resolve auth config from runtime environment instead of build-time, allowing production deployments to update Privy App ID without rebuilding
- **Docker Runtime** (4fd1d44): Use Debian Trixie runtime for uWebSockets.js GLIBC ≥ 2.38 requirement
- **Production Defaults** (bc647e3): Restore Railway deployment targets and production API defaults for hyperscape.gg
- **CI Pipeline** (fca9ffb): Handle empty downloads and Railway auth drift in deployment pipeline
- **Bank Panel** (192696d): Remove duplicate bank tab hover handler
- **Panel Affordances** (976d075): Restore panel affordances and align test deploy flow

### Changed
- **CI Infrastructure** (15e62b9-9d45fae): Upgrade GitHub Actions workflows to Node.js 24 runners for improved performance
- **Docker Builds** (58a18df-cb237b6): Use real Node.js for Vite builds instead of Bun's compatibility shim, add defensive `mkdir -p` for all workspace packages to prevent COPY failures

## [April 2026 - Early] - 2026-04-04

### Changed
- **Tailwind CSS** (031372f): Temporarily rolled back to Tailwind v3.4.19 from v4 due to production artifact issues with missing utility classes in linux/amd64 Docker builds
- **Build Pipeline**: Restored stable PostCSS pipeline for consistent CSS generation across all environments

## [March 2026 - Late] - 2026-03-27

### Added
- **UI Tooltip System** (PR #1102): Unified tooltip styling across all UI panels
  - New `tooltipStyles.ts` module with centralized style utilities
  - Consistent appearance for inventory, equipment, bank, spells, prayer, skills, trade, store, and loot panels
  - Eliminated ~500 lines of duplicated styling code
  - Better visual hierarchy and readability

- **Tree Dissolve Transparency** (PR #1101): Screen-door dithered dissolve for depleted trees
  - New `DissolveAnimation.ts` shared state machine
  - Depleted trees become ~70% transparent instantly
  - Smooth fade-in animation over 0.3s on respawn
  - Stays in opaque render pass (no transparency sorting overhead)
  - Dissolve state preserved across LOD transitions
  - Configuration via `GPU_VEG_CONFIG` (DISSOLVE_DURATION, DISSOLVE_MAX, DISSOLVE_ALPHA_SCALE)

- **Tree Collision Proxy** (PR #1100): LOD2 geometry-based collision detection
  - Replaced oversized cylinder hitbox with actual LOD2 mesh geometry
  - Pixel-accurate click detection on tree silhouettes
  - Multi-part geometry merging (bark + leaves)
  - Proxy geometry caching per (model, scale) tuple
  - Falls back to tighter cylinder (0.25 radius) if LOD unavailable
  - New `getProxyGeometry()` and `clearProxyGeometryCache()` APIs

### Fixed
- **Resource Respawn** (PR #1099): Made resource respawn purely tick-based
  - Removed non-deterministic `setTimeout`-based respawn
  - Mining now reads `depleteChance` from manifest instead of hardcoded constants
  - Rune essence rocks (depleteChance: 0) never deplete (OSRS-accurate)
  - Deterministic tick-based respawn timing

### Removed
- Depleted model pool system (replaced by dissolve transparency)
- `setDepleted()` and `hasDepleted()` APIs (replaced by `startDissolve()`)
- Hardcoded `MINING_DEPLETE_CHANCE` and `MINING_REDWOOD_DEPLETE_CHANCE` constants

## [March 2026 - Mid] - 2026-03-19

### Changed
- **Performance Overhaul** (PR #1064): Major architectural changes for 50+ concurrent players with 25+ AI agents
  - Server runtime migration: Bun → Node.js 22+ (V8 incremental GC eliminates 500-1200ms stop-the-world pauses)
  - uWebSockets.js integration on port 5556 (native pub/sub broadcasting, eliminates O(n) socket iteration)
  - Agent AI worker thread (decision logic off main thread, eliminates 200-600ms blocking)
  - BFS pathfinding optimization (global iteration budget, zero-allocation scratch tiles)
  - Terrain system optimization (low-res collision 16×16, time-budgeted processing)
  - Tick system reliability (drift correction, health monitoring, per-handler timing)
  - **Breaking**: Server requires Node.js 22+, WebSocket port changed 5555 → 5556

### Performance
- Tick blocking: 900-2400ms → 110-200ms (81-92% reduction)
- Missed ticks: 3-5/min → 0 under normal load
- Event loop blocking: 62.5% → <3%
- Scalability: 20 players + 10 agents → 50+ players + 25+ agents

## [March 2026 - Early] - 2026-03-17

### Fixed
- **VRM Material Isolation** (PR #1061): Isolated VRM clone materials to prevent highlight bleed across mob instances
  - Each mob instance now has independent `outputNode`/uniforms
  - Textures remain shared by reference for memory efficiency
  - Fixes visual bug where hovering one goblin highlighted all goblins

- **Mob AI Tick Processing** (PR #1060): Wired mob AI tick processing into server tick loop
  - Registered mob AI tick handler at MOVEMENT priority
  - Mob state machines now properly transition through IDLE → WANDER → CHASE → ATTACK states
  - Deterministic OSRS-style tick ordering (AI decides, movement executes, same tick)

## [March 2026 - Early] - 2026-03-16

### Fixed
- **Dev Server Watcher CPU** (PR #1034): Fixed dev server watcher burning 100% CPU when idle
  - Removed redundant `awaitWriteFinish` polling (script already debounces rebuilds)
  - Increased polling fallback interval from 1s to 5s
  - Eliminates 100% CPU usage when dev server is idle

## [March 2026 - Mid] - 2026-03-15

### Changed
- **Docker Build Improvements** (PR #1033): Major Dockerfile improvements for production deployment
  - Upgraded to Bun 1.3.10 (from 1.1.38) for Vite 6+ support
  - Added `packages/client` build to Docker image (required for multi-service deployments)
  - Manually recreate Bun workspace symlinks after Docker COPY (COPY flattens symlinks)
  - Explicitly copy per-package node_modules (Bun 1.3 no longer hoists all deps to root)
  - Strip better-sqlite3 from manifests before install (segfaults under QEMU cross-compilation)
  - Copy manifests from builder stage to ensure cleaned versions are used

### Performance
- Reliable Docker image builds
- No more missing node_modules directory errors
- Improved CI/CD stability

## See Also

- [CLAUDE.md](CLAUDE.md) - Development guidelines and architecture
- [README.md](README.md) - Project overview and quick start
- [docs/](docs/) - Detailed documentation
