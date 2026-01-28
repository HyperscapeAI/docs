# Changelog

All notable changes to Hyperscape are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation for Railway deployment architecture
- API reference documentation (API.md)
- CORS configuration guide (CORS-CONFIGURATION.md)
- Manifest system documentation (MANIFEST-SYSTEM.md)
- Railway deployment guide (RAILWAY-DEPLOYMENT.md)
- Skill Guide Panel feature documentation (packages/client/SKILL-GUIDE-PANEL.md)

### Changed
- Updated README.md with production deployment architecture
- Updated CLAUDE.md with deployment workflows and manifest system
- Updated packages/server/README.md with manifest fetching and Railway deployment
- Improved environment variable documentation in .env.example files

## [1.1.0] - 2026-01-22

### Added
- **Skill Guide Panel** - OSRS-style UI for viewing skill unlocks (#601)
  - Click any skill in Skills Panel to open guide
  - Shows all unlocks with level requirements
  - Visual distinction between unlocked and locked content
  - Next unlock highlighting
  - Progress tracking (X of Y unlocked)
  - Smooth animations and keyboard support
- **New API Endpoint:** `GET /api/data/skill-unlocks` - Server-authoritative skill unlock data
- **CDN Manifest Fetching** - Server automatically downloads manifests from CDN at startup
  - Fetches from `PUBLIC_CDN_URL` in production
  - Caches locally for performance
  - Skips download in development if local manifests exist
- **Railway Deployment** - Complete deployment workflow with Nixpacks
  - Automatic builds on push to main
  - GitHub Actions integration
  - Health checks and auto-restart
  - Multi-stage Docker build support
- **Frontend Build Integration** - Server now builds and serves client application
  - Client build copied to server public directory
  - SPA routing with catch-all handler
  - Proper cache headers for static assets
- **Debug Endpoint:** `GET /debug/public` - Shows public directory contents for troubleshooting

### Changed
- **CORS Configuration** - Expanded allowlist for production domains
  - Added `https://hyperscape.club`
  - Added `https://www.hyperscape.club`
  - Added `https://hyperscape.pages.dev`
  - Added regex for Cloudflare Pages preview deployments
  - Added HTTP fallback for testing
- **Asset Serving** - Improved static file serving logic
  - Conditional `/assets/` route registration (avoids conflicts with client assets)
  - Separate routes for world assets (`/assets/world/`) and client assets (`/assets/`)
  - Manual music route for better compatibility
- **Manifest Caching** - Optimized manifest loading
  - 5-minute cache with revalidation
  - Comparison with existing files to avoid unnecessary updates
  - Detailed logging for fetch status
- **Environment Detection** - Improved CI/production detection
  - Checks for Railway, Vercel, Netlify, GitHub Actions
  - Skips asset download in CI environments
  - Proper handling of `SKIP_ASSETS` flag

### Fixed
- **Build Errors** - Fixed lockfile frozen errors in Railway deployment
  - Updated `bun.lock` to sync with `package.json`
  - Proper dependency resolution
- **Asset Path Resolution** - Fixed asset serving in production
  - Correct path resolution for built vs. dev environments
  - Proper handling of `__dirname` in ES modules
- **Index.html Serving** - Fixed SPA routing
  - Proper fallback for client-side routes
  - No-cache headers for HTML files
  - 503 error with helpful message when frontend not built
- **CORS Issues** - Fixed cross-origin requests from Cloudflare Pages
  - Added all required origins to allowlist
  - Proper regex patterns for preview deployments
  - HTTP and HTTPS support

### Deprecated
- **AWS Deployment** - Removed AWS deployment workflow (using Railway instead)
  - Deleted `.github/workflows/deploy-aws.yml`
  - Railway provides better developer experience

## [1.0.0] - 2026-01-15

### Added
- Initial release of Hyperscape MMORPG
- **Core Features:**
  - Tick-based combat system (600ms ticks)
  - 12 skills with XP progression
  - Resource gathering (woodcutting, mining, fishing)
  - Crafting systems (cooking, firemaking, smithing)
  - Banking system (480 slots)
  - Store system
  - Death and respawn mechanics
  - Prayer system
  - Agility system
- **AI Integration:**
  - ElizaOS plugin for autonomous agents
  - AI decision-making and goal setting
  - Spectator mode for watching agents
- **Technical:**
  - Entity Component System (ECS)
  - Three.js 3D rendering
  - PhysX physics engine
  - PostgreSQL persistence
  - WebSocket networking
  - Privy authentication
  - VRM avatar support
- **Deployment:**
  - Docker support
  - PostgreSQL migrations
  - Asset CDN integration

### Changed
- Migrated from SQLite to PostgreSQL
- Improved character system with multi-character support
- Enhanced combat mechanics with OSRS-accurate formulas

### Fixed
- Numerous bug fixes and performance improvements
- Database migration issues
- Asset loading problems
- Combat synchronization issues

## Migration Notes

### Upgrading to 1.1.0

**Server:**
1. Update environment variables:
   ```env
   PUBLIC_CDN_URL=https://assets.hyperscape.club  # Required for manifest fetching
   ```

2. Manifests will be fetched automatically on first startup

3. No database migrations required

**Client:**
1. Update environment variables:
   ```env
   PUBLIC_API_URL=https://hyperscape-production.up.railway.app
   PUBLIC_WS_URL=wss://hyperscape-production.up.railway.app/ws
   PUBLIC_CDN_URL=https://assets.hyperscape.club
   ```

2. Rebuild client:
   ```bash
   cd packages/client
   bun run build
   ```

**Assets:**
1. Upload to CDN:
   ```bash
   bun run sync:r2
   ```

### Breaking Changes

**None** - Version 1.1.0 is fully backward compatible with 1.0.0.

## Roadmap

### Planned for 1.2.0
- Player trading system
- Quest system
- Achievement tracking
- Leaderboards
- Guild system
- PvP zones
- More skills (Runecrafting, Herblore, Thieving)

### Planned for 2.0.0
- Mobile app (iOS/Android)
- Voice chat integration
- Advanced AI behaviors
- Procedural content generation
- Mod support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Hyperscape.

## License

MIT - See [LICENSE](LICENSE) file for details.
