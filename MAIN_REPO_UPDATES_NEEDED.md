# Main Repository Documentation Updates Required

This document outlines all documentation updates needed in the main Hyperscape repository (HyperscapeAI/hyperscape) based on recent commits to main branch.

## Analysis Summary

**Commits Analyzed**: 50 most recent commits (Jan 21-22, 2026)
**Major Features Added**:
1. Agility Skill System (PR #599) - Movement-based XP, weight-stamina mechanics
2. Skill Guide Panel (PR #601) - OSRS-style UI for viewing skill unlocks
3. Railway Deployment Infrastructure - Nixpacks configuration, CDN manifest fetching
4. Prayer Skill Integration - Added to missing type interfaces

---

## 1. README.md Updates

### Location: `README.md` (repository root)

### Change 1: Update Core Features Table

**Line**: ~18 (Core Features table)

**Current:**
```markdown
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
```

**Replace with:**
```markdown
| **Skills** | 13 skills total: Combat (Attack, Strength, Defense, Constitution, Prayer), Gathering (Woodcutting, Mining, Fishing, Agility), Artisan (Cooking, Firemaking, Smithing) with OSRS-accurate XP curves |
```

**Rationale**: Explicitly lists all 13 skills including newly-integrated Agility and Prayer.

---

### Change 2: Add Railway Deployment Note

**Location**: After line ~95 (under "Production/CI" in Assets section)

**Add:**
```markdown

**Production Deployment**: 
- Server fetches manifests from CDN at startup (configured via `PUBLIC_CDN_URL`)
- Railway deployment uses Nixpacks (see `nixpacks.toml` for build configuration)
- Frontend is deployed separately on Cloudflare Pages
- See [Railway Deployment](#railway-deployment) section below for details
```

---

### Change 3: Add Railway Deployment Section

**Location**: After "Configuration" section, before "Troubleshooting"

**Add:**
```markdown
## Railway Deployment

The server is configured for Railway deployment using Nixpacks. Configuration is in `nixpacks.toml`.

**Build Process**:
1. **Setup Phase**: Installs system dependencies (Python, Cairo, etc.)
2. **Install Phase**: Runs `bun install`
3. **Build Phase**: Builds `shared` and `server` packages only
4. **Start**: Runs `cd packages/server && bun dist/index.js`

**Environment Variables**:
- `CI=true` - Skips local asset download
- `SKIP_ASSETS=true` - Skips Git LFS asset clone
- `NODE_ENV=production` - Production mode
- `PUBLIC_CDN_URL` - CDN URL for assets and manifests

**Manifest Fetching**:
The server automatically fetches manifests from `PUBLIC_CDN_URL` at startup:
- Downloads to `packages/server/world/assets/manifests/`
- Skipped in development if local manifests exist
- Required in production (CI=true)

**GitHub Actions**:
Automatic deployment is configured in `.github/workflows/deploy-railway.yml`:
- Triggers on push to `main` for server-related paths
- Uses Railway GraphQL API
- Requires `RAILWAY_TOKEN` secret

**Frontend Deployment**:
The client is deployed separately on Cloudflare Pages, not served by Railway. Railway only serves the game server API and WebSocket endpoints.
```

---

### Change 4: Update Troubleshooting Section

**Location**: In existing Troubleshooting section

**Add new subsection:**
```markdown

**Railway deployment issues:**

The server uses Nixpacks for builds (see `nixpacks.toml`). Common issues:

- **Manifests not found**: Ensure `PUBLIC_CDN_URL` points to your CDN with manifests uploaded
- **Build failures**: Check that `bun run build:shared` and `bun run build:server` succeed locally
- **Frontend 404s**: Client is deployed separately on Cloudflare Pages (hyperscape.club), not served by Railway
- **Database connection errors**: Verify `DATABASE_URL` is set correctly in Railway environment variables
- **Asset loading failures**: Verify CDN is accessible and manifests are present at `PUBLIC_CDN_URL/manifests/`

**Debug endpoints** (added in recent commits):
- `GET /debug/public` - Lists contents of public directory (verify frontend build copied correctly)
- Build timestamp file created during build to verify builds are running
```

---

## 2. CLAUDE.md Updates

### Location: `CLAUDE.md` (repository root)

### Change 1: Update Architecture Overview

**Line**: ~30 (Project Overview section)

**Current mentions 11 skills implicitly**

**Add after "Project Overview" section:**
```markdown

### Skills System

Hyperscape features **13 skills** with OSRS-accurate progression:

**Combat Skills** (5): Attack, Strength, Defense, Constitution, Prayer
**Gathering Skills** (4): Woodcutting, Mining, Fishing, Agility
**Artisan Skills** (4): Firemaking, Cooking, Smithing, (Ranged - hidden in MVP)

**New in Recent Updates**:
- **Agility**: Trained by moving through the world (1 XP per 2 tiles). Affects stamina regeneration (+1% per level). Weight affects stamina drain (+0.5% per kg).
- **Prayer**: Fully integrated into type system and database (was partially implemented).
- **Skill Guide Panel**: Click any skill in Skills panel to view level-based unlocks (OSRS-style UI).
```

---

### Change 2: Add Railway Deployment Section

**Location**: After "Environment Variables" section

**Add:**
```markdown

## Railway Deployment

The project is configured for Railway deployment using Nixpacks (`nixpacks.toml`).

**Key Configuration**:
- Frontend (client) is deployed separately on Cloudflare Pages
- Railway only serves the game server (API + WebSocket)
- Assets are served from Cloudflare R2 CDN
- Manifests are fetched from CDN at server startup

**Build Commands**:
```bash
# Railway build (via nixpacks.toml)
bun run build:shared
bun run build:server

# Local production build
bun run build
cd packages/server && bun dist/index.js
```

**Environment Variables for Railway**:
- `CI=true` - Skips local asset download
- `SKIP_ASSETS=true` - Skips Git LFS clone
- `PUBLIC_CDN_URL` - Required for manifest fetching
- `DATABASE_URL` - Auto-set by Railway PostgreSQL service

**Manifest Fetching**:
The server fetches manifests from CDN at startup (see `packages/server/src/startup/config.ts`):
- Function: `fetchManifestsFromCDN()`
- Downloads from `${PUBLIC_CDN_URL}/manifests/`
- Saves to `packages/server/world/assets/manifests/`
- Skipped in development if local manifests exist
```

---

### Change 3: Update Troubleshooting Section

**Location**: In existing Troubleshooting section

**Add:**
```markdown

### Railway Deployment Issues

**Manifests not loading:**
```bash
# Verify CDN is accessible
curl ${PUBLIC_CDN_URL}/manifests/items.json

# Check server logs for manifest fetch errors
# Manifests are fetched at startup in packages/server/src/startup/config.ts
```

**Build failures on Railway:**
- Ensure `bun run build:shared` succeeds locally
- Check nixpacks.toml configuration
- Verify all dependencies are in package.json (not just devDependencies)
- Railway uses Bun 1.1.38 - ensure local version matches

**Frontend not loading:**
- Client is deployed separately on Cloudflare Pages
- Railway only serves `/api/*` and `/ws` endpoints
- Verify `PUBLIC_API_URL` and `PUBLIC_WS_URL` in client .env point to Railway server
```

---

## 3. Package-Specific README Updates

### packages/server/README.md

**If this file exists**, add:

```markdown
## Railway Deployment

This package is configured for Railway deployment using Nixpacks.

**Build Configuration**: See `nixpacks.toml` in repository root

**Environment Variables**: See `.env.example` for all configuration options

**Manifest Fetching**: 
The server automatically fetches manifests from `PUBLIC_CDN_URL` at startup. This is configured in `src/startup/config.ts` via the `fetchManifestsFromCDN()` function.

**Production Checklist**:
- [ ] `DATABASE_URL` set to production PostgreSQL
- [ ] `PUBLIC_CDN_URL` points to CDN with manifests
- [ ] `PRIVY_APP_ID` and `PRIVY_APP_SECRET` configured
- [ ] `JWT_SECRET` set to secure random value
- [ ] `NODE_ENV=production`
```

---

## 4. New API Endpoint Documentation

### Location: Create or update API documentation

**Endpoint**: `GET /api/data/skill-unlocks`

**Description**: Returns skill unlock definitions for all skills

**Authentication**: None required (public endpoint)

**Response**:
```typescript
{
  [skillName: string]: Array<{
    level: number;
    description: string;
    type: "item" | "ability" | "area" | "quest" | "activity";
  }>
}
```

**Example**:
```json
{
  "attack": [
    { "level": 1, "description": "Bronze weapons", "type": "item" },
    { "level": 40, "description": "Rune weapons", "type": "item" }
  ],
  "agility": [
    { "level": 1, "description": "Basic stamina regeneration (+1% per level)", "type": "ability" },
    { "level": 50, "description": "+50% stamina regeneration", "type": "ability" }
  ]
}
```

**Usage**: Used by Skill Guide Panel to display level-based unlocks

**Implementation**: `packages/server/src/startup/routes/data-routes.ts`

---

## 5. Migration Guide (Optional)

### For Existing Players/Servers

**Database Migration Required**: Migration `0018_add_agility_skill.sql` adds agility columns

**Steps**:
1. Pull latest code
2. Run `cd packages/server && bunx drizzle-kit push`
3. Restart server
4. Existing characters will have agility at level 1, 0 XP

**No Data Loss**: Existing skills and progress are preserved

---

## Summary of Changes

### Files to Update in Main Repo:

1. **README.md**:
   - Update skills count to 13
   - Add Railway deployment section
   - Add deployment troubleshooting

2. **CLAUDE.md**:
   - Add skills system overview with Agility details
   - Add Railway deployment configuration section
   - Add Railway troubleshooting

3. **packages/server/README.md** (if exists):
   - Add Railway deployment notes
   - Add manifest fetching documentation

### Documentation Scope:

- **Lines Changed**: ~150-200 lines of documentation
- **New Sections**: 3 (Railway deployment, Agility mechanics, Skill Guide Panel)
- **Updated Sections**: 5 (Skills list, API reference, Troubleshooting, Configuration, Architecture)

### Key Documentation Points:

1. **Agility Skill**:
   - Movement-based XP (1 XP per 2 tiles)
   - Stamina regeneration bonus (+1% per level)
   - Weight-based stamina drain (+0.5% per kg)
   - Death penalty (lose accumulated tile progress)

2. **Skill Guide Panel**:
   - Click skills to view unlocks
   - Server-authoritative data from `/api/data/skill-unlocks`
   - Visual distinction between locked/unlocked

3. **Railway Deployment**:
   - Nixpacks configuration
   - Manifest fetching from CDN
   - Split deployment (server on Railway, client on Cloudflare Pages)
   - GitHub Actions integration

4. **Prayer Skill**:
   - Now fully integrated into all type systems
   - Was partially implemented, now complete

---

## Implementation Notes

These updates should be made to the main Hyperscape repository (HyperscapeAI/hyperscape), not the docs repository. The docs repository updates have been completed in this PR.

**Estimated Impact**: ~150-200 lines of documentation changes across 2-3 files in the main repository.
