# Documentation Index

Complete index of all Hyperscape documentation, organized by topic.

## Getting Started

- **[README.md](../README.md)** - Project overview, quick start, installation
- **[CLAUDE.md](../CLAUDE.md)** - Development guide, architecture, coding standards
- **[CHANGELOG-FEBRUARY-2026.md](../CHANGELOG-FEBRUARY-2026.md)** - Complete changelog for February 2026
- **[docs/FEBRUARY-2026-UPDATES.md](FEBRUARY-2026-UPDATES.md)** - Quick reference for February 2026 changes

## Deployment & Operations

- **[docs/deployment-best-practices.md](deployment-best-practices.md)** - Production deployment workflows, maintenance mode, health checks, rollback procedures
- **[docs/railway-dev-prod.md](railway-dev-prod.md)** - Railway deployment setup (dev/prod environments)
- **[docs/native-release.md](native-release.md)** - Native app release process (desktop + mobile)
- **[docs/r2-cors-configuration.md](r2-cors-configuration.md)** - Cloudflare R2 CORS setup for asset loading

## Streaming & Broadcasting

- **[docs/streaming-configuration.md](streaming-configuration.md)** - RTMP streaming setup (Twitch, Kick, X, YouTube)
- **[docs/duel-stack.md](duel-stack.md)** - Duel system architecture and betting integration
- **[docs/betting-production-deploy.md](betting-production-deploy.md)** - Production betting system deployment

## API Reference

- **[docs/api/maintenance-mode.md](api/maintenance-mode.md)** - Maintenance mode API endpoints (enter, status, exit)

## Package-Specific Documentation

### Asset Forge
- **[packages/asset-forge/README.md](../packages/asset-forge/README.md)** - AI asset generation, VFX catalog, rigging tools
- **[packages/asset-forge/dev-book/](../packages/asset-forge/dev-book/)** - Comprehensive developer documentation

### Gold Betting Demo
- **[packages/gold-betting-demo/README.md](../packages/gold-betting-demo/README.md)** - Betting demo overview, setup, testing
- **[packages/gold-betting-demo/MOBILE-UI-GUIDE.md](../packages/gold-betting-demo/MOBILE-UI-GUIDE.md)** - Mobile-responsive UI patterns and testing

### Server
- **[packages/server/README.md](../packages/server/README.md)** - Game server architecture and setup
- **[packages/server/.env.example](../packages/server/.env.example)** - Complete environment variable reference

### Client
- **[packages/client/README.md](../packages/client/README.md)** - Web client architecture and setup
- **[packages/client/.env.example](../packages/client/.env.example)** - Client environment variables

### Shared (Core Engine)
- **[packages/shared/dev-book/](../packages/shared/dev-book/)** - Core engine documentation
- **[packages/shared/dev-book/05-core-systems/COMBAT-SYSTEM-DOCUMENTATION.md](../packages/shared/dev-book/05-core-systems/COMBAT-SYSTEM-DOCUMENTATION.md)** - Combat system deep dive

### Plugin Hyperscape (ElizaOS)
- **[packages/plugin-hyperscape/README.md](../packages/plugin-hyperscape/README.md)** - AI agent plugin for ElizaOS

## Testing & Quality

- **[docs/gameplay-test-environment.md](gameplay-test-environment.md)** - Gameplay testing setup and procedures
- **[packages/client/tests/](../packages/client/tests/)** - Client test suite
- **[packages/server/tests/](../packages/server/tests/)** - Server test suite

## Architecture & Design

- **[CLAUDE.md](../CLAUDE.md)** - Architecture overview, ECS design, development rules
- **[docs/duel-stack.md](duel-stack.md)** - Duel system architecture
- **[docs/agent-duel-arena-invite-referral-handoff.md](agent-duel-arena-invite-referral-handoff.md)** - Agent duel invitation system

## Environment Configuration

### Server Environment Variables
- **[packages/server/.env.example](../packages/server/.env.example)** - Complete reference with descriptions

**Key Sections:**
- Core configuration (port, world, environment)
- Security & authentication (JWT, Privy, admin)
- Database configuration (PostgreSQL, Docker)
- Assets & CDN (R2, asset URLs)
- Game configuration (save interval, collision)
- Monitoring & alerting (webhooks)
- AI model providers (OpenAI, Anthropic, OpenRouter)
- ElizaOS integration
- Privy authentication
- Farcaster integration
- LiveKit voice chat
- RTMP streaming (Twitch, Kick, X, YouTube)
- Streaming duel system
- Arena Solana betting
- Development flags

### Client Environment Variables
- **[packages/client/.env.example](../packages/client/.env.example)** - Client configuration reference

**Key Sections:**
- Authentication (Privy)
- Server connection (API, WebSocket, CDN)
- AI dashboard (ElizaOS)
- Farcaster Frame V2
- Development (debug, ports)
- Mobile/Capacitor (live reload)

## Troubleshooting Guides

### README.md Troubleshooting
- WebGPU not supported
- Characters vanishing (Privy credentials)
- Assets not loading (CDN)
- Database schema errors
- Port conflicts
- Build errors
- Missing objects (model cache)
- Terrain height issues
- RTMP stream restarts
- Streaming delay configuration
- CI build failures (npm 403)
- Tauri build failures
- Memory leaks
- Production startup errors

### CLAUDE.md Troubleshooting
- Build issues
- PhysX build failures
- Port conflicts
- Test failures
- WebGPU issues
- Model cache issues
- Terrain height issues
- Memory leaks
- Streaming issues
- CSRF token errors
- CI build failures
- Dependency cycle errors
- Asset Forge TypeScript issues
- Deployment & maintenance mode

## Recent Updates (February 2026)

### New Documentation
1. **[docs/r2-cors-configuration.md](r2-cors-configuration.md)** - R2 CORS setup
2. **[docs/deployment-best-practices.md](deployment-best-practices.md)** - Deployment workflows
3. **[docs/streaming-configuration.md](streaming-configuration.md)** - RTMP streaming
4. **[docs/api/maintenance-mode.md](api/maintenance-mode.md)** - Maintenance mode API
5. **[packages/gold-betting-demo/MOBILE-UI-GUIDE.md](../packages/gold-betting-demo/MOBILE-UI-GUIDE.md)** - Mobile UI patterns
6. **[CHANGELOG-FEBRUARY-2026.md](../CHANGELOG-FEBRUARY-2026.md)** - Complete changelog
7. **[docs/FEBRUARY-2026-UPDATES.md](FEBRUARY-2026-UPDATES.md)** - Quick reference

### Updated Documentation
1. **[README.md](../README.md)** - Added WebGPU requirements, JWT security, maintenance mode, CORS, streaming
2. **[CLAUDE.md](../CLAUDE.md)** - Added architectural audits, troubleshooting sections, February 2026 updates
3. **[packages/asset-forge/README.md](../packages/asset-forge/README.md)** - Added VFX catalog, TypeScript/ESLint fixes, database integration

## Documentation Standards

### File Naming
- Use kebab-case: `deployment-best-practices.md`
- Use descriptive names: `r2-cors-configuration.md` not `cors.md`
- Group related docs in subdirectories: `docs/api/`, `docs/guides/`

### Content Structure
- Start with overview/purpose
- Include table of contents for long docs
- Use code examples with syntax highlighting
- Include troubleshooting sections
- Link to related documentation
- Add commit references for changes

### Markdown Style
- Use ATX headers (`#`, `##`, `###`)
- Use fenced code blocks with language tags
- Use tables for structured data
- Use blockquotes for warnings/notes
- Use relative links for internal docs

## Contributing to Documentation

### Adding New Documentation

1. Create file in appropriate directory:
   - Guides: `docs/`
   - API reference: `docs/api/`
   - Package-specific: `packages/<package>/`

2. Follow documentation standards (see above)

3. Update this index file

4. Add references in related docs:
   - README.md (if user-facing)
   - CLAUDE.md (if developer-facing)
   - Package README (if package-specific)

### Updating Existing Documentation

1. Read existing content first
2. Maintain consistent style and tone
3. Update related documentation
4. Add changelog entry if significant
5. Test all code examples

### Documentation Review Checklist

- [ ] Clear and concise writing
- [ ] Code examples tested and working
- [ ] All links valid (internal and external)
- [ ] Proper markdown formatting
- [ ] Consistent with existing docs
- [ ] Troubleshooting section included
- [ ] Related docs updated
- [ ] Index updated (if new file)

## External Resources

- **GitHub Repository**: https://github.com/HyperscapeAI/hyperscape
- **Issues**: https://github.com/HyperscapeAI/hyperscape/issues
- **Discussions**: https://github.com/HyperscapeAI/hyperscape/discussions
- **Releases**: https://github.com/HyperscapeAI/hyperscape/releases
- **Download Portal**: https://hyperscapeai.github.io/hyperscape/

## Quick Links by Topic

### For New Users
1. [README.md](../README.md) - Start here
2. [Quick Start](../README.md#quick-start) - Get running in 5 minutes
3. [Troubleshooting](../README.md#troubleshooting) - Common issues

### For Developers
1. [CLAUDE.md](../CLAUDE.md) - Development guide
2. [Architecture Overview](../CLAUDE.md#architecture-overview) - System design
3. [Development Rules](../CLAUDE.md#critical-development-rules) - Coding standards

### For DevOps
1. [docs/deployment-best-practices.md](deployment-best-practices.md) - Deployment workflows
2. [docs/api/maintenance-mode.md](api/maintenance-mode.md) - Maintenance mode API
3. [docs/railway-dev-prod.md](railway-dev-prod.md) - Railway setup

### For Content Creators
1. [docs/streaming-configuration.md](streaming-configuration.md) - RTMP streaming
2. [packages/asset-forge/README.md](../packages/asset-forge/README.md) - Asset generation

## Documentation Metrics

**Total Documentation Files**: 50+ files
**Total Documentation Lines**: 15,000+ lines
**Last Major Update**: February 2026
**Documentation Coverage**: ~85% of codebase

## Feedback

Found missing or incorrect documentation?
1. Check if issue already exists: https://github.com/HyperscapeAI/hyperscape/issues
2. Create new issue with:
   - What's missing or incorrect
   - Where you expected to find it
   - Suggested improvements
3. Or submit a PR with documentation updates

## License

All documentation is licensed under MIT (same as code).
