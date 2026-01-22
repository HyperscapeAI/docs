# README.md Update for Hyperscape Repository

## Changes to Make:

### 1. Update Core Features Table - Add Agility and Prayer

**Current:**
```markdown
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
```

**New:**
```markdown
| **Skills** | 13 skills: Combat (Attack, Strength, Defense, Constitution, Prayer), Gathering (Woodcutting, Mining, Fishing, Agility), Artisan (Cooking, Firemaking, Smithing) with XP/leveling |
```

### 2. Add Note About Railway Deployment

After the "Production/CI" section under Assets:

**Add:**
```markdown
**Production Deployment**: Server fetches manifests from CDN at startup (configured via `PUBLIC_CDN_URL`). See `nixpacks.toml` for Railway build configuration.
```

### 3. Update Troubleshooting - Add Railway/Deployment Section

**Add new section:**
```markdown
**Railway deployment issues:**
The server uses Nixpacks for builds (see `nixpacks.toml`). Common issues:
- Manifests not found: Ensure `PUBLIC_CDN_URL` points to your CDN with manifests
- Build failures: Check that `bun run build:shared` and `bun run build:server` succeed locally
- Frontend 404s: Client is deployed separately on Cloudflare Pages, not served by Railway
```

---

## Summary of Documentation Changes Needed:

1. **README.md** (main repo):
   - Update skills count from implicit to explicit "13 skills"
   - Add Railway deployment note
   - Add deployment troubleshooting

2. **CLAUDE.md** (main repo):
   - Add agility skill to architecture overview
   - Update skill count references
   - Add note about Railway deployment configuration

3. **Docs site** (this repo):
   - ✅ Updated wiki/game-systems/skills.mdx - Added Agility skill mechanics
   - ✅ Updated concepts/skills.mdx - Added Agility and Prayer to skill lists
   - ✅ Updated guides/deployment.mdx - Added Railway Nixpacks configuration details
   - Need to add API reference for `/api/data/skill-unlocks` endpoint
