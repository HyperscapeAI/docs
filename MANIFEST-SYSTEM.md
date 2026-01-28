# Manifest System Documentation

Complete guide to Hyperscape's manifest-driven content system.

## Overview

Hyperscape uses JSON manifest files to define game content (NPCs, items, skills, etc.). This allows content updates without code changes and enables server-authoritative data management.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Manifest System Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Development:                                                │
│  ┌──────────────┐                                           │
│  │ Git LFS Repo │ → bun install → Local manifests           │
│  │ (assets)     │                 (world/assets/manifests/) │
│  └──────────────┘                                           │
│                                                               │
│  Production:                                                 │
│  ┌──────────────┐                                           │
│  │ Cloudflare R2│ → Server startup → Cached manifests       │
│  │ (CDN)        │                    (world/assets/manifests/)│
│  └──────────────┘                                           │
│                                                               │
│  Both:                                                       │
│  ┌──────────────┐                                           │
│  │ DataManager  │ → Loads manifests → Game systems          │
│  │ (shared)     │                                           │
│  └──────────────┘                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Manifest Files

### Root-Level Manifests

Located at `packages/server/world/assets/manifests/`:

| File | Purpose | Used By |
|------|---------|---------|
| `biomes.json` | Terrain biome definitions | TerrainSystem |
| `buildings.json` | Building and structure data | TownSystem |
| `model-bounds.json` | 3D model collision bounds | PhysX integration |
| `music.json` | Background music tracks | MusicSystem |
| `npcs.json` | NPC definitions and dialogue | NPCSystem |
| `prayers.json` | Prayer definitions and effects | PrayerSystem |
| `skill-unlocks.json` | Skill unlock progression | Skill Guide Panel |
| `stations.json` | Crafting station definitions | ProcessingSystem |
| `stores.json` | Shop inventory and prices | StoreSystem |
| `tier-requirements.json` | Equipment tier requirements | EquipmentSystem |
| `tools.json` | Tool definitions and stats | GatheringSystem |
| `vegetation.json` | Tree and plant definitions | VegetationSystem |
| `world-areas.json` | Zone definitions and boundaries | World initialization |

### Subdirectory Manifests

**Items** (`manifests/items/`):
- `food.json` - Consumable food items
- `misc.json` - Miscellaneous items
- `resources.json` - Raw materials and resources
- `tools.json` - Gathering tools
- `weapons.json` - Combat weapons and armor

**Gathering** (`manifests/gathering/`):
- `fishing.json` - Fishing spots and fish
- `mining.json` - Mining rocks and ores
- `woodcutting.json` - Trees and logs

**Recipes** (`manifests/recipes/`):
- `cooking.json` - Cooking recipes
- `firemaking.json` - Firemaking recipes
- `smelting.json` - Ore smelting recipes
- `smithing.json` - Smithing recipes

## Manifest Loading

### Development Mode

**Automatic download:**
1. Run `bun install`
2. Postinstall script (`scripts/ensure-assets.mjs`) runs
3. Checks if `packages/server/world/assets/` has content
4. If empty, clones assets repo via Git LFS
5. Manifests are available locally

**Manual sync:**
```bash
bun run assets:sync
```

**Requirements:**
- Git LFS installed (`brew install git-lfs`)
- Internet connection
- ~200MB disk space

### Production Mode

**Automatic fetch at startup:**
1. Server starts
2. `loadConfig()` calls `fetchManifestsFromCDN()`
3. Downloads all manifests from `{PUBLIC_CDN_URL}/manifests/`
4. Caches locally in `world/assets/manifests/`
5. Compares with existing files (only updates if changed)
6. Skips download if local manifests exist (development mode)

**Configuration:**
```env
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

**Fetch behavior:**
- **Development:** Skips if local manifests exist
- **Production:** Always fetches from CDN
- **CI/Test:** Skips if `SKIP_MANIFESTS=true` or `NODE_ENV=test`

### Error Handling

**No manifests available:**
```
Error: Failed to fetch any manifests from CDN and no local manifests exist.
Set SKIP_MANIFESTS=true to bypass this check in test environments.
```

**Partial fetch failure:**
```
[Config] 📦 Manifests: 20 fetched, 5 updated, 3 failed
[Config] ⚠️  Using 17 existing local manifests
```

**Bypass for testing:**
```env
SKIP_MANIFESTS=true
```

## DataManager Integration

### Loading Manifests

**File:** `packages/shared/src/data/DataManager.ts`

**Initialization:**
```typescript
import { DataManager } from '@hyperscape/shared';

// Load all manifests
await DataManager.initialize();

// Access loaded data
const npcs = DataManager.getNPCs();
const items = DataManager.getItems();
const skillUnlocks = DataManager.getSkillUnlocks();
```

### Accessing Data

**Get all data:**
```typescript
const allNPCs = DataManager.getNPCs();
const allItems = DataManager.getItems();
```

**Get specific data:**
```typescript
const goblin = DataManager.getNPC('goblin');
const bronzeSword = DataManager.getItem('bronze-sword');
```

**Get skill unlocks:**
```typescript
import { getAllSkillUnlocks, getUnlocksAtLevel } from '@hyperscape/shared';

// Get all unlocks for all skills
const allUnlocks = getAllSkillUnlocks();

// Get unlocks for specific skill
const attackUnlocks = allUnlocks.attack;

// Get unlocks at specific level
const level40Unlocks = getUnlocksAtLevel('attack', 40);
```

## Manifest Format Specifications

### skill-unlocks.json

**Structure:**
```json
{
  "skills": {
    "skillName": [
      {
        "level": 1,
        "description": "What is unlocked",
        "type": "item | ability | area | quest | activity"
      }
    ]
  }
}
```

**Example:**
```json
{
  "skills": {
    "attack": [
      {
        "level": 1,
        "description": "Bronze weapons, Iron weapons",
        "type": "item"
      },
      {
        "level": 5,
        "description": "Steel weapons",
        "type": "item"
      },
      {
        "level": 40,
        "description": "Rune weapons",
        "type": "item"
      }
    ],
    "prayer": [
      {
        "level": 1,
        "description": "Thick Skin (Def +5%)",
        "type": "ability"
      },
      {
        "level": 43,
        "description": "Protect from Melee",
        "type": "ability"
      }
    ]
  }
}
```

**Validation:**
- `level` must be 1-99
- `description` should be concise (< 100 characters)
- `type` must be one of: `item`, `ability`, `area`, `quest`, `activity`

### npcs.json

**Structure:**
```json
{
  "npcs": [
    {
      "id": "goblin",
      "name": "Goblin",
      "level": 2,
      "health": 50,
      "model": "models/mobs/goblin.glb",
      "dialogue": ["Hello!", "What do you want?"],
      "drops": [
        { "item": "coins", "min": 1, "max": 10, "chance": 1.0 }
      ]
    }
  ]
}
```

### items/weapons.json

**Structure:**
```json
{
  "items": [
    {
      "id": "bronze-sword",
      "name": "Bronze Sword",
      "type": "weapon",
      "tier": "bronze",
      "attackBonus": 5,
      "strengthBonus": 3,
      "requirements": {
        "attack": 1
      },
      "model": "models/weapons/bronze-sword.glb"
    }
  ]
}
```

## Updating Manifests

### Local Development

**Edit manifest files:**
```bash
# Edit manifest
vim packages/server/world/assets/manifests/npcs.json

# Restart server to reload
bun run dev
```

**Changes take effect immediately** - DataManager reloads on server restart.

### Production

**Update workflow:**

1. **Edit manifests locally:**
   ```bash
   vim packages/server/world/assets/manifests/skill-unlocks.json
   ```

2. **Commit changes:**
   ```bash
   git add packages/server/world/assets/manifests/
   git commit -m "feat: add new skill unlocks"
   git push origin main
   ```

3. **Upload to CDN:**
   ```bash
   bun run sync:r2
   ```

4. **Restart server:**
   ```bash
   railway restart
   ```

5. **Verify:**
   ```bash
   curl https://assets.hyperscape.club/manifests/skill-unlocks.json
   ```

**Server will fetch updated manifests on next startup.**

## CDN Upload

### Uploading to Cloudflare R2

**Command:**
```bash
bun run sync:r2
```

**What it does:**
1. Reads all files from `packages/server/world/assets/`
2. Uploads to R2 bucket
3. Sets public access permissions
4. Configures cache headers

**Options:**
```bash
bun run sync:r2:dry      # Preview without uploading
bun run sync:r2:verbose  # Detailed upload logs
```

**Configuration:**
```env
# In .env or Railway variables
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=hyperscape-assets
```

### Verifying Upload

**Check manifest:**
```bash
curl https://assets.hyperscape.club/manifests/npcs.json
```

**Check asset:**
```bash
curl https://assets.hyperscape.club/models/mobs/goblin.glb
```

**Expected headers:**
```http
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=300, must-revalidate
Access-Control-Allow-Origin: *
```

## Caching Strategy

### Manifest Caching

**Server-side:**
- Manifests cached locally after first fetch
- Cache location: `packages/server/world/assets/manifests/`
- Cache invalidation: Server restart or manual delete

**Client-side:**
- Manifests fetched via API: `/api/data/skill-unlocks`
- Cached in browser for 5 minutes
- Cache header: `Cache-Control: public, max-age=300, must-revalidate`

**CDN-side:**
- Cloudflare R2 caches globally
- Cache TTL: 5 minutes
- Purge cache: Via Cloudflare dashboard or API

### Cache Invalidation

**Force server to refetch:**
```bash
# Delete local cache
rm -rf packages/server/world/assets/manifests/*

# Restart server
railway restart
```

**Force client to refetch:**
```javascript
// Clear browser cache
localStorage.clear();
location.reload(true);
```

**Purge CDN cache:**
```bash
# Via Wrangler CLI
wrangler r2 object delete hyperscape-assets manifests/npcs.json
wrangler r2 object put hyperscape-assets manifests/npcs.json --file=npcs.json
```

## API Endpoints

### GET /api/data/skill-unlocks

**Purpose:** Serve skill unlock data to client

**Response:**
```json
{
  "attack": [...],
  "woodcutting": [...],
  ...
}
```

**Caching:**
- Server: Loaded once at startup
- Client: Cached for 5 minutes
- CDN: Cached globally for 5 minutes

**Usage:**
```typescript
const response = await fetch('/api/data/skill-unlocks');
const unlocks = await response.json();
```

### GET /manifests/:path

**Purpose:** Serve raw manifest files

**Examples:**
- `/manifests/npcs.json`
- `/manifests/items/weapons.json`
- `/manifests/gathering/fishing.json`

**Caching:**
```http
Cache-Control: public, max-age=300, must-revalidate
```

**Usage:**
```typescript
const response = await fetch('/manifests/npcs.json');
const npcs = await response.json();
```

## Adding New Manifests

### 1. Create Manifest File

**Location:** `packages/server/world/assets/manifests/`

**Example:** `new-feature.json`
```json
{
  "features": [
    {
      "id": "feature-1",
      "name": "New Feature",
      "enabled": true
    }
  ]
}
```

### 2. Add to Manifest List

**File:** `packages/server/src/startup/config.ts`

**Add to `MANIFEST_FILES` array:**
```typescript
const MANIFEST_FILES = [
  // ... existing files
  "new-feature.json",
];
```

### 3. Create Data Provider

**File:** `packages/shared/src/data/NewFeatureDataProvider.ts`

```typescript
import type { NewFeature } from '../types';

let features: NewFeature[] = [];

export function loadNewFeatures(manifest: any): void {
  features = manifest.features || [];
  console.log(`[DataManager] Loaded ${features.length} features`);
}

export function getNewFeatures(): readonly NewFeature[] {
  return features;
}

export function getNewFeature(id: string): NewFeature | undefined {
  return features.find(f => f.id === id);
}
```

### 4. Register with DataManager

**File:** `packages/shared/src/data/DataManager.ts`

```typescript
import { loadNewFeatures } from './NewFeatureDataProvider';

export async function loadManifests(): Promise<void> {
  // ... existing manifest loading
  
  // Load new feature manifest
  const newFeatureManifest = await loadManifest('new-feature.json');
  if (newFeatureManifest) {
    loadNewFeatures(newFeatureManifest);
  }
}
```

### 5. Export from Shared Package

**File:** `packages/shared/src/index.ts`

```typescript
export { getNewFeatures, getNewFeature } from './data/NewFeatureDataProvider';
```

### 6. Upload to CDN

```bash
bun run sync:r2
```

### 7. Deploy

```bash
git add .
git commit -m "feat: add new feature manifest"
git push origin main
```

Railway will automatically deploy and fetch the new manifest.

## Manifest Validation

### Schema Validation

**Add JSON schema:**

**File:** `packages/server/world/assets/schemas/new-feature.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "features": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "enabled": { "type": "boolean" }
        },
        "required": ["id", "name"]
      }
    }
  },
  "required": ["features"]
}
```

**Validate manifest:**
```bash
# Install AJV
npm install -g ajv-cli

# Validate
ajv validate -s schemas/new-feature.schema.json -d manifests/new-feature.json
```

### Runtime Validation

**Add validation in data provider:**

```typescript
export function loadNewFeatures(manifest: any): void {
  if (!manifest.features || !Array.isArray(manifest.features)) {
    console.error('[DataManager] Invalid new-feature.json: missing features array');
    return;
  }
  
  features = manifest.features.filter(f => {
    if (!f.id || !f.name) {
      console.warn('[DataManager] Skipping invalid feature:', f);
      return false;
    }
    return true;
  });
  
  console.log(`[DataManager] Loaded ${features.length} features`);
}
```

## Troubleshooting

### Manifests Not Loading

**Symptoms:**
- Server logs show "Failed to fetch manifests"
- Game features missing or broken
- Empty data in DataManager

**Solutions:**

1. **Check CDN URL:**
   ```bash
   echo $PUBLIC_CDN_URL
   curl $PUBLIC_CDN_URL/manifests/npcs.json
   ```

2. **Verify local manifests:**
   ```bash
   ls -la packages/server/world/assets/manifests/
   ```

3. **Check server logs:**
   ```bash
   railway logs | grep "Config"
   ```

4. **Force refetch:**
   ```bash
   rm -rf packages/server/world/assets/manifests/*
   railway restart
   ```

### Manifest Parse Errors

**Symptoms:**
- Server logs show JSON parse errors
- DataManager fails to load

**Solutions:**

1. **Validate JSON:**
   ```bash
   cat manifests/npcs.json | jq .
   ```

2. **Check for syntax errors:**
   - Missing commas
   - Trailing commas
   - Unescaped quotes
   - Invalid UTF-8 characters

3. **Use JSON validator:**
   - https://jsonlint.com/
   - VSCode JSON validation

### Stale Manifest Data

**Symptoms:**
- Changes to manifests not reflected in game
- Old data still showing

**Solutions:**

1. **Clear server cache:**
   ```bash
   rm -rf packages/server/world/assets/manifests/*
   railway restart
   ```

2. **Clear CDN cache:**
   ```bash
   # Re-upload to R2
   bun run sync:r2
   ```

3. **Clear client cache:**
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload(true);
   ```

### Missing Manifest Files

**Symptoms:**
- Server logs show "File not found"
- Specific features not working

**Solutions:**

1. **Check manifest exists:**
   ```bash
   ls packages/server/world/assets/manifests/npcs.json
   ```

2. **Check CDN has file:**
   ```bash
   curl https://assets.hyperscape.club/manifests/npcs.json
   ```

3. **Upload missing file:**
   ```bash
   bun run sync:r2
   ```

4. **Add to MANIFEST_FILES list:**
   ```typescript
   // In packages/server/src/startup/config.ts
   const MANIFEST_FILES = [
     // ... existing
     "missing-file.json",
   ];
   ```

## Best Practices

### 1. Version Manifests

**Add version field:**
```json
{
  "version": "1.2.0",
  "skills": { ... }
}
```

**Check version in code:**
```typescript
if (manifest.version !== EXPECTED_VERSION) {
  console.warn('Manifest version mismatch');
}
```

### 2. Use Descriptive IDs

**Good:**
```json
{ "id": "bronze-sword", "name": "Bronze Sword" }
```

**Bad:**
```json
{ "id": "item-1", "name": "Bronze Sword" }
```

### 3. Document Manifest Changes

**Add changelog:**
```json
{
  "version": "1.2.0",
  "changelog": [
    "Added dragon weapons at level 60",
    "Removed deprecated items"
  ],
  "skills": { ... }
}
```

### 4. Test Locally Before Deploying

**Workflow:**
1. Edit manifest locally
2. Restart dev server
3. Test in game
4. Commit and push
5. Upload to CDN
6. Deploy to production

### 5. Backup Before Major Changes

**Backup manifests:**
```bash
cp -r packages/server/world/assets/manifests/ manifests-backup/
```

**Restore if needed:**
```bash
cp -r manifests-backup/* packages/server/world/assets/manifests/
```

## Performance Optimization

### 1. Minimize Manifest Size

**Compress JSON:**
- Remove whitespace in production
- Use short property names
- Avoid redundant data

**Example:**
```json
// Before (verbose)
{
  "identifier": "bronze-sword",
  "displayName": "Bronze Sword",
  "attackBonusValue": 5
}

// After (compact)
{
  "id": "bronze-sword",
  "name": "Bronze Sword",
  "atk": 5
}
```

### 2. Lazy Load Large Manifests

**Load on demand:**
```typescript
let itemsCache: Item[] | null = null;

export async function getItems(): Promise<Item[]> {
  if (!itemsCache) {
    const manifest = await loadManifest('items/weapons.json');
    itemsCache = manifest.items;
  }
  return itemsCache;
}
```

### 3. Use Manifest Splitting

**Split large manifests:**
- `items.json` → `items/weapons.json`, `items/armor.json`, `items/food.json`
- Load only needed subsets
- Reduces initial load time

### 4. Enable Compression

**Server-side:**
```typescript
// In packages/server/src/startup/http-server.ts
import compress from '@fastify/compress';

await fastify.register(compress, {
  global: true,
  encodings: ['gzip', 'deflate'],
});
```

**CDN-side:**
- Cloudflare R2 automatically compresses
- Brotli compression for text files
- Reduces bandwidth usage

## Migration Guide

### From Hardcoded Data to Manifests

**Before:**
```typescript
// Hardcoded in code
const NPCS = [
  { id: 'goblin', name: 'Goblin', level: 2 },
  { id: 'guard', name: 'Guard', level: 5 },
];
```

**After:**
```typescript
// Load from manifest
import { getNPCs } from '@hyperscape/shared';

const npcs = getNPCs();
```

**Steps:**
1. Create manifest JSON file
2. Move data from code to JSON
3. Create data provider
4. Update code to use data provider
5. Test thoroughly
6. Remove hardcoded data

## References

- **DataManager:** `packages/shared/src/data/DataManager.ts`
- **Config:** `packages/server/src/startup/config.ts`
- **HTTP Server:** `packages/server/src/startup/http-server.ts`
- **Skill Unlocks:** `packages/shared/src/data/skill-unlocks.ts`

## License

MIT - See LICENSE file
