# Database Migrations Guide

This guide documents the database schema changes and migration process for Hyperscape.

## Overview

Hyperscape uses **Drizzle ORM** for database schema management and migrations. The database stores persistent game data including characters, inventory, skills, bank, and world state.

**Database**: PostgreSQL (production), SQLite (local development fallback)

**Migration Tool**: Drizzle Kit

**Migration Location**: `packages/server/src/database/migrations/`

## Recent Migrations

### Migration 0029: Crafting Skill (PR #698)

**Date**: 2026-01-30

**Changes**:
```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingXp" integer DEFAULT 0;
```

**Purpose**: Add crafting skill columns to support leather armor, jewelry, and gem cutting.

**Impact**:
- All existing characters get crafting level 1, XP 0
- New characters start with crafting level 1, XP 0
- No data loss or character reset required

### Migration 0030: Fletching Skill (PR #699)

**Date**: 2026-01-31

**Changes**:
```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "fletchingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "fletchingXp" integer DEFAULT 0;
```

**Purpose**: Add fletching skill columns to support bow and arrow crafting.

**Impact**:
- All existing characters get fletching level 1, XP 0
- New characters start with fletching level 1, XP 0
- No data loss or character reset required

### Migration 0031: Runecrafting Skill (PR #703)

**Date**: 2026-01-31

**Changes**:
```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "runecraftingLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "runecraftingXp" integer DEFAULT 0;
```

**Purpose**: Add runecrafting skill columns to support rune creation at altars.

**Impact**:
- All existing characters get runecrafting level 1, XP 0
- New characters start with runecrafting level 1, XP 0
- No data loss or character reset required

## Complete Skill Schema

The `characters` table now includes 17 skills (34 columns total):

### Combat Skills (14 columns)

```sql
attackLevel integer DEFAULT 1
attackXp integer DEFAULT 0
strengthLevel integer DEFAULT 1
strengthXp integer DEFAULT 0
defenseLevel integer DEFAULT 1
defenseXp integer DEFAULT 0
constitutionLevel integer DEFAULT 10
constitutionXp integer DEFAULT 1154
rangedLevel integer DEFAULT 1
rangedXp integer DEFAULT 0
magicLevel integer DEFAULT 1
magicXp integer DEFAULT 0
prayerLevel integer DEFAULT 1
prayerXp integer DEFAULT 0
```

**Note**: Constitution starts at level 10 with 1154 XP (OSRS-accurate).

### Gathering Skills (6 columns)

```sql
woodcuttingLevel integer DEFAULT 1
woodcuttingXp integer DEFAULT 0
miningLevel integer DEFAULT 1
miningXp integer DEFAULT 0
fishingLevel integer DEFAULT 1
fishingXp integer DEFAULT 0
```

### Production Skills (14 columns)

```sql
firemakingLevel integer DEFAULT 1
firemakingXp integer DEFAULT 0
cookingLevel integer DEFAULT 1
cookingXp integer DEFAULT 0
smithingLevel integer DEFAULT 1
smithingXp integer DEFAULT 0
agilityLevel integer DEFAULT 1
agilityXp integer DEFAULT 0
craftingLevel integer DEFAULT 1
craftingXp integer DEFAULT 0
fletchingLevel integer DEFAULT 1
fletchingXp integer DEFAULT 0
runecraftingLevel integer DEFAULT 1
runecraftingXp integer DEFAULT 0
```

## Running Migrations

### Automatic Migration (Development)

Migrations run automatically when the server starts in development mode:

```bash
bun run dev
```

The server checks for pending migrations and applies them on startup.

### Manual Migration (Production)

For production deployments, run migrations manually before deploying:

```bash
cd packages/server
bunx drizzle-kit migrate
```

### Generate New Migration

When you modify the schema in `packages/server/src/database/schema.ts`:

```bash
cd packages/server
bunx drizzle-kit generate
```

This creates a new migration file in `packages/server/src/database/migrations/`.

### Push Schema Changes (Development Only)

For rapid iteration in development, push schema changes directly without migrations:

```bash
cd packages/server
bunx drizzle-kit push
```

**⚠️ Warning**: This bypasses migrations and can cause data loss. Only use in development.

## Migration Best Practices

### 1. Always Use `IF NOT EXISTS`

```sql
-- ✅ GOOD: Safe for re-running
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer DEFAULT 1;

-- ❌ BAD: Fails if column exists
ALTER TABLE "characters" ADD COLUMN "craftingLevel" integer DEFAULT 1;
```

### 2. Provide Default Values

All new columns should have sensible defaults:

```sql
-- ✅ GOOD: Existing characters get level 1
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer DEFAULT 1;

-- ❌ BAD: Existing characters get NULL
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer;
```

### 3. Test Migrations Locally First

Before deploying:

1. Reset local database:
   ```bash
   docker stop hyperscape-postgres
   docker rm hyperscape-postgres
   docker volume rm hyperscape-postgres-data
   ```

2. Start fresh and verify migration:
   ```bash
   bun run dev
   ```

3. Check migration logs in console

4. Verify schema in database:
   ```bash
   docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
   \d characters
   ```

### 4. Keep Migrations Small and Focused

Each migration should do ONE thing:
- ✅ Add crafting skill columns
- ❌ Add crafting skill columns + modify inventory table + add new items

### 5. Document Breaking Changes

If a migration requires data transformation or has breaking changes, document it:

```sql
-- Migration 0032: Rename skill columns (BREAKING)
-- 
-- BREAKING CHANGE: Renames all skill columns from camelCase to snake_case.
-- Requires data migration script to preserve existing XP/levels.
-- 
-- Run before deploying:
--   bun run scripts/migrate-skill-columns.ts

ALTER TABLE "characters" RENAME COLUMN "craftingLevel" TO "crafting_level";
-- ... etc.
```

## Schema Conventions

### Naming

- **Tables**: Lowercase, plural (e.g., `characters`, `items`, `bank_items`)
- **Columns**: camelCase (e.g., `craftingLevel`, `fletchingXp`)
- **Indexes**: `{table}_{column}_idx` (e.g., `characters_username_idx`)
- **Foreign Keys**: `{table}_{column}_fkey` (e.g., `bank_items_characterId_fkey`)

### Skill Columns

Each skill has two columns:
- `{skill}Level` - Current level (1-99)
- `{skill}Xp` - Current XP (0-200,000,000)

**Example**:
```sql
craftingLevel integer DEFAULT 1
craftingXp integer DEFAULT 0
```

### Data Types

- **Levels**: `integer` (1-99)
- **XP**: `integer` (0-200,000,000)
- **IDs**: `text` (UUIDs or custom IDs)
- **Timestamps**: `timestamp` (with timezone)
- **Booleans**: `boolean`
- **JSON**: `jsonb` (for complex data like equipment stats)

## Migration History

### Skills Migrations

| Migration | Date | Skill | Columns Added |
|-----------|------|-------|---------------|
| 0014 | 2024-12-XX | Mining | miningLevel, miningXp |
| 0015 | 2024-12-XX | Smithing | smithingLevel, smithingXp |
| 0021 | 2025-01-XX | Agility | agilityLevel, agilityXp |
| 0026 | 2025-01-XX | Magic | magicLevel, magicXp |
| 0029 | 2026-01-30 | Crafting | craftingLevel, craftingXp |
| 0030 | 2026-01-31 | Fletching | fletchingLevel, fletchingXp |
| 0031 | 2026-01-31 | Runecrafting | runecraftingLevel, runecraftingXp |

### Other Notable Migrations

| Migration | Date | Purpose |
|-----------|------|---------|
| 0000 | Initial | Base schema (characters, inventory, bank) |
| 0008 | 2024-XX-XX | Bank storage system |
| 0011 | 2024-XX-XX | Bank tabs |
| 0016 | 2024-XX-XX | Prayer system |
| 0028 | 2025-XX-XX | Inventory quantity constraint |

## Rollback Procedure

Drizzle does not support automatic rollbacks. To rollback a migration:

### 1. Identify the Migration

Find the migration file in `packages/server/src/database/migrations/`.

### 2. Write Reverse SQL

Create a reverse migration manually:

```sql
-- Reverse of migration 0031 (runecrafting)
ALTER TABLE "characters" DROP COLUMN IF EXISTS "runecraftingLevel";
ALTER TABLE "characters" DROP COLUMN IF EXISTS "runecraftingXp";
```

### 3. Apply Reverse Migration

```bash
# Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape

# Run reverse SQL
ALTER TABLE "characters" DROP COLUMN IF EXISTS "runecraftingLevel";
ALTER TABLE "characters" DROP COLUMN IF EXISTS "runecraftingXp";
```

### 4. Update Migration Journal

Edit `packages/server/src/database/migrations/meta/_journal.json` to remove the migration entry.

**⚠️ Warning**: Manual rollbacks can cause data loss. Always backup before rolling back.

## Adding a New Skill

To add a new skill to the database:

### 1. Update Schema

Edit `packages/server/src/database/schema.ts`:

```typescript
export const characters = pgTable("characters", {
  // ... existing columns
  
  // Add new skill columns
  herbloreLevel: integer("herbloreLevel").default(1),
  herbloreXp: integer("herbloreXp").default(0),
});
```

### 2. Generate Migration

```bash
cd packages/server
bunx drizzle-kit generate
```

This creates a new migration file like `0032_add_herblore_skill.sql`.

### 3. Review Migration

Check the generated SQL:

```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "herbloreLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "herbloreXp" integer DEFAULT 0;
```

### 4. Test Migration

```bash
# Reset local database
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data

# Start server (runs migrations)
bun run dev

# Verify columns exist
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
\d characters
```

### 5. Update Repository Code

Update `CharacterRepository.ts` to load/save new skill:

```typescript
// In loadCharacter()
herblore: {
  level: row.herbloreLevel ?? 1,
  xp: row.herbloreXp ?? 0,
},

// In saveCharacter()
herbloreLevel: character.skills.herblore.level,
herbloreXp: Math.round(character.skills.herblore.xp),
```

### 6. Commit Migration

Commit both the schema change and generated migration:

```bash
git add packages/server/src/database/schema.ts
git add packages/server/src/database/migrations/0032_add_herblore_skill.sql
git add packages/server/src/database/migrations/meta/
git commit -m "feat(db): add herblore skill columns"
```

## Database Reset (Development)

To completely reset your local database:

```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null
docker rm hyperscape-postgres 2>/dev/null

# Remove postgres volumes
docker volume rm hyperscape-postgres-data 2>/dev/null
docker volume rm server_postgres-data 2>/dev/null

# Remove any remaining hyperscape volumes
docker volume ls | grep -i hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify volumes are gone
docker volume ls | grep -i hyperscape

# Restart with fresh database (migrations run automatically)
bun run dev
```

**⚠️ Warning**: This deletes ALL local data (characters, inventory, bank, progress).

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Schema changes reviewed
- [ ] Default values set for new columns
- [ ] Backward compatibility verified
- [ ] Rollback plan documented

### Deployment Steps

1. **Backup Database**:
   ```bash
   pg_dump -h your-db-host -U your-user -d hyperscape > backup.sql
   ```

2. **Run Migrations**:
   ```bash
   cd packages/server
   bunx drizzle-kit migrate
   ```

3. **Verify Schema**:
   ```bash
   psql -h your-db-host -U your-user -d hyperscape
   \d characters
   ```

4. **Deploy Application**:
   ```bash
   bun run build
   bun start
   ```

5. **Monitor Logs**:
   Check for migration errors or schema issues.

### Rollback Plan

If deployment fails:

1. **Restore Database**:
   ```bash
   psql -h your-db-host -U your-user -d hyperscape < backup.sql
   ```

2. **Revert Code**:
   ```bash
   git revert <commit-hash>
   git push
   ```

3. **Redeploy Previous Version**

## Migration Troubleshooting

### Migration Already Applied

**Symptom**: Migration fails with "column already exists" error.

**Cause**: Migration was already applied but journal not updated.

**Fix**: Use `IF NOT EXISTS` in migrations (already done for all skill migrations).

### Migration Fails Midway

**Symptom**: Some columns added, others failed.

**Cause**: SQL error in migration file.

**Fix**:
1. Check error message for specific SQL issue
2. Fix migration file
3. Manually drop partially-added columns
4. Re-run migration

### Schema Out of Sync

**Symptom**: Code expects columns that don't exist in database.

**Cause**: Migrations not run after pulling updates.

**Fix**:
```bash
cd packages/server
bunx drizzle-kit migrate
```

Or reset database (development only):
```bash
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data
bun run dev
```

### Wrong Default Value

**Symptom**: New characters have incorrect starting skill levels.

**Cause**: Default value in migration doesn't match game logic.

**Fix**: Create a new migration to update the default:

```sql
-- Migration 0032: Fix crafting default level
ALTER TABLE "characters" ALTER COLUMN "craftingLevel" SET DEFAULT 1;
```

## Schema Documentation

### Characters Table

**Primary Key**: `id` (text, UUID)

**Core Columns**:
- `username` - Character name (unique)
- `userId` - Owner's user ID (foreign key)
- `createdAt` - Creation timestamp
- `lastLogin` - Last login timestamp
- `isAgent` - Boolean flag for AI agents

**Position Columns**:
- `x`, `y`, `z` - World position (real)
- `rotationX`, `rotationY`, `rotationZ`, `rotationW` - Quaternion rotation

**Combat Columns**:
- `health` - Current HP (integer)
- `maxHealth` - Max HP (integer)
- `combatLevel` - Calculated combat level (integer)
- `attackStyle` - Current attack style (text)
- `autoRetaliate` - Auto-retaliate flag (boolean)

**Skill Columns**: 34 columns (17 skills × 2 columns each)
- See [Complete Skill Schema](#complete-skill-schema) above

**Equipment Columns**:
- `equippedWeapon`, `equippedShield`, `equippedHelmet`, etc. (text, item IDs)

**Misc Columns**:
- `coins` - Coin pouch amount (integer)
- `avatarUrl` - VRM avatar URL (text)
- `walletAddress` - Blockchain wallet (text)
- `templateConfig` - AI agent template (jsonb)

### Inventory Table

**Primary Key**: `id` (text, UUID)

**Columns**:
- `characterId` - Owner character ID (foreign key)
- `itemId` - Item type ID (text)
- `quantity` - Stack size (integer, >= 1)
- `slot` - Inventory slot (integer, 0-27)
- `metadata` - Item metadata (jsonb)

**Constraints**:
- Unique: `(characterId, slot)` - One item per slot
- Check: `quantity >= 1` - No zero-quantity items

### Bank Items Table

**Primary Key**: `id` (text, UUID)

**Columns**:
- `characterId` - Owner character ID (foreign key)
- `itemId` - Item type ID (text)
- `quantity` - Stack size (integer)
- `slot` - Bank slot (integer, 0-479)
- `tab` - Bank tab (integer, 0-8)
- `isPlaceholder` - Placeholder flag (boolean)

**Constraints**:
- Unique: `(characterId, slot)` - One item per slot

## Drizzle Kit Commands

### Generate Migration

Create a new migration from schema changes:

```bash
cd packages/server
bunx drizzle-kit generate
```

**Output**: New migration file in `src/database/migrations/`

### Apply Migrations

Run pending migrations:

```bash
cd packages/server
bunx drizzle-kit migrate
```

### Push Schema (Dev Only)

Push schema changes directly without migrations:

```bash
cd packages/server
bunx drizzle-kit push
```

**⚠️ Warning**: Bypasses migrations, can cause data loss.

### Introspect Database

Generate schema from existing database:

```bash
cd packages/server
bunx drizzle-kit introspect
```

### Studio (Database GUI)

Open Drizzle Studio to browse database:

```bash
cd packages/server
bunx drizzle-kit studio
```

Opens web UI at `https://local.drizzle.studio`

## Environment Variables

### Development

```bash
# packages/server/.env
DATABASE_URL=postgresql://hyperscape:hyperscape@localhost:5432/hyperscape
```

**Default**: Uses Docker PostgreSQL container (auto-started by server).

### Production

```bash
# packages/server/.env
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Providers**:
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Supabase](https://supabase.com) - PostgreSQL with extras
- [Railway](https://railway.app) - PostgreSQL + hosting
- [Fly.io](https://fly.io) - PostgreSQL + hosting

## Migration File Format

### File Naming

Format: `{number}_{description}.sql`

**Examples**:
- `0029_add_crafting_skill.sql`
- `0030_add_fletching_skill.sql`
- `0031_add_runecrafting_skill.sql`

### File Structure

```sql
-- Migration description
-- Optional: Breaking changes, prerequisites, rollback instructions

ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingLevel" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "craftingXp" integer DEFAULT 0;--> statement-breakpoint
```

**Note**: `--> statement-breakpoint` is required between statements for Drizzle to parse correctly.

### Meta Files

Drizzle generates metadata files in `migrations/meta/`:

- `_journal.json` - Migration history
- `{number}_snapshot.json` - Schema snapshot after migration

**Do not edit these files manually** - they are auto-generated.

## Common Migration Patterns

### Add Skill Columns

```sql
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "{skill}Level" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "{skill}Xp" integer DEFAULT 0;--> statement-breakpoint
```

### Add Table

```sql
CREATE TABLE IF NOT EXISTS "herblore_potions" (
  "id" text PRIMARY KEY NOT NULL,
  "characterId" text NOT NULL,
  "potionId" text NOT NULL,
  "doses" integer DEFAULT 4,
  FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE
);--> statement-breakpoint
```

### Add Index

```sql
CREATE INDEX IF NOT EXISTS "characters_username_idx" ON "characters" ("username");--> statement-breakpoint
```

### Add Constraint

```sql
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_check" CHECK ("quantity" >= 1);--> statement-breakpoint
```

### Modify Column

```sql
-- Add new column with default
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "newColumn" integer DEFAULT 0;--> statement-breakpoint

-- Copy data from old column
UPDATE "characters" SET "newColumn" = "oldColumn";--> statement-breakpoint

-- Drop old column
ALTER TABLE "characters" DROP COLUMN IF EXISTS "oldColumn";--> statement-breakpoint
```

## Data Integrity

### Foreign Keys

All foreign keys use `ON DELETE CASCADE` to maintain referential integrity:

```sql
FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE
```

**Effect**: When a character is deleted, all related data (inventory, bank, etc.) is automatically deleted.

### Constraints

**Inventory Quantity**:
```sql
CHECK ("quantity" >= 1)
```

**Effect**: Prevents zero-quantity items in inventory.

**Bank Slot Range**:
```sql
CHECK ("slot" >= 0 AND "slot" < 480)
```

**Effect**: Enforces 480-slot bank limit.

## Performance Considerations

### Indexes

Add indexes for frequently queried columns:

```sql
CREATE INDEX IF NOT EXISTS "characters_userId_idx" ON "characters" ("userId");
CREATE INDEX IF NOT EXISTS "inventory_characterId_idx" ON "inventory" ("characterId");
CREATE INDEX IF NOT EXISTS "bank_items_characterId_idx" ON "bank_items" ("characterId");
```

### JSONB Columns

Use JSONB for complex data that doesn't need relational queries:

```sql
"templateConfig" jsonb
"metadata" jsonb
```

**Benefits**:
- Flexible schema
- No joins required
- GIN indexes for fast queries

**Drawbacks**:
- Can't enforce constraints
- Harder to query specific fields

## See Also

- [README.md](README.md) - Project documentation
- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [SKILLS.md](SKILLS.md) - Skills system overview
- [Drizzle ORM Docs](https://orm.drizzle.team) - Official documentation
