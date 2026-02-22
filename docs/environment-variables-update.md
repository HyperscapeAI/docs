# Environment Variables Update (Feb 2026)

## New Environment Variables

### SKIP_MIGRATIONS

**Added in**: Commit `eb8652a` (Feb 22, 2026)  
**Location**: `packages/server/.env`  
**Purpose**: Skip server's built-in migration system when using drizzle-kit push

```bash
# Skip server's built-in migration system (advanced use only)
# Set to "true" when using drizzle-kit push for declarative schema creation
# Useful in CI/test environments to avoid migration journal conflicts
# WARNING: Only use this if you know what you're doing
SKIP_MIGRATIONS=true
```

**Use Case**: Integration tests in CI

The server's built-in migration system has FK ordering issues (migration 0050 references arena_rounds from older migrations). In CI environments, `drizzle-kit push` creates the schema declaratively without these problems. Setting `SKIP_MIGRATIONS=true` bypasses the server's migration runner after push.

**Workflow**:
```bash
# In CI (e.g., .github/workflows/integration.yml)
bunx drizzle-kit push              # Create schema declaratively
SKIP_MIGRATIONS=true bun run test  # Skip server migrations
```

**Migration 0050 Fix** (commit e4b6489):
Migration 0050 duplicated CREATE TABLE statements from earlier migrations (e.g., agent_duel_stats from 0039). Added `IF NOT EXISTS` to prevent 42P07 errors on fresh databases.

### Database Connection Tuning

**Added in**: Commit `8aaaf28` / `f7ab9f7` (Feb 22, 2026)

```bash
# Disable prepared statements for Supavisor pooler compatibility
# Required when using Supabase connection pooling (Supavisor)
# Prevents XX000 errors from prepared statement conflicts
# DATABASE_PREPARED_STATEMENTS=false
```

**Context**: Supavisor (Supabase's connection pooler) doesn't support prepared statements in transaction mode. Disabling them prevents `XX000` errors.

## Updated Documentation Locations

### Server Environment Variables

**File**: `packages/server/.env.example`

Add the following to the DATABASE CONFIGURATION section (after DATABASE_URL):

```bash
# Skip server's built-in migration system (advanced use only)
# Set to "true" when using drizzle-kit push for declarative schema creation
# Useful in CI/test environments to avoid migration journal conflicts
# WARNING: Only use this if you know what you're doing
# SKIP_MIGRATIONS=true

# Disable prepared statements for Supavisor pooler compatibility
# Required when using Supabase connection pooling (Supavisor)
# Prevents XX000 errors from prepared statement conflicts
# DATABASE_PREPARED_STATEMENTS=false
```

### CI/CD Configuration

**File**: `.github/workflows/integration.yml`

The integration workflow now uses:
```yaml
- name: Push database schema
  run: bunx drizzle-kit push
  env:
    DATABASE_URL: ${{ env.DATABASE_URL }}

- name: Run integration tests
  run: bun test:integration
  env:
    SKIP_MIGRATIONS: true  # Skip server migrations after push
```

## Migration Best Practices

### Local Development

Use server's built-in migrations (default):
```bash
bun run dev  # Server runs migrations automatically
```

### CI/Test Environments

Use drizzle-kit push + SKIP_MIGRATIONS:
```bash
bunx drizzle-kit push
SKIP_MIGRATIONS=true bun run test
```

### Production

Use server's built-in migrations:
```bash
# Migrations run automatically on server startup
bun start
```

Or use drizzle-kit migrate for manual control:
```bash
cd packages/server
bunx drizzle-kit migrate
```

## Related Commits

- `eb8652a` - Add SKIP_MIGRATIONS env var for CI integration tests
- `e4b6489` - Add IF NOT EXISTS to migration 0050 tables/indexes
- `8aaaf28` / `f7ab9f7` - Disable prepared statements for Supavisor pooler
- `b5d2494` - Remove drizzle-kit push from integration workflow
- `034f9c9` - Skip chain setup in CI, exclude evm-contracts tests
