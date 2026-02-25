# CI/CD Troubleshooting Guide

## Overview

This guide documents common CI/CD issues, their root causes, and solutions based on recent fixes to the Hyperscape build pipeline.

## Database Migration Issues

### Issue: Migration 0050 Duplicate Table Errors

**Symptom:**
```
ERROR: relation "agent_duel_stats" already exists (42P07)
```

**Cause** (commit e4b6489):
- Migration 0050 duplicated CREATE TABLE statements from earlier migrations
- Example: `agent_duel_stats` was created in migration 0039 and again in 0050
- On fresh databases, running all migrations sequentially caused duplicate table errors

**Solution:**
Added `IF NOT EXISTS` to all CREATE TABLE and CREATE INDEX statements in migration 0050:

```sql
-- Before
CREATE TABLE agent_duel_stats (...);

-- After
CREATE TABLE IF NOT EXISTS agent_duel_stats (...);
```

**Prevention:**
- Always use `IF NOT EXISTS` for CREATE TABLE in migrations
- Check migration history before adding new tables
- Test migrations on fresh database before committing

### Issue: FK Ordering in Sequential Migrations

**Symptom:**
```
ERROR: relation "arena_rounds" does not exist
```

**Cause** (commit eb8652a):
- Migration 0050 references tables from older migrations (e.g., arena_rounds)
- On fresh databases, FK constraints may fail if tables aren't created in dependency order
- Sequential migration execution doesn't guarantee FK ordering

**Solution:**
Use `drizzle-kit push` for declarative schema creation + `SKIP_MIGRATIONS=true`:

```bash
# CI integration tests
bunx drizzle-kit push
SKIP_MIGRATIONS=true bun run start
```

**Why This Works:**
- `drizzle-kit push` creates schema declaratively (no ordering issues)
- `SKIP_MIGRATIONS=true` tells server to skip built-in migration execution
- Server starts with pre-created schema

### Issue: drizzle-kit push + Server Migration Conflict

**Symptom:**
```
ERROR: relation "users" already exists
Server migration fails after drizzle-kit push
```

**Cause** (commit b5d2494):
- Running `drizzle-kit push` creates tables without populating migration journal
- Server's built-in migration code tries to create tables again
- Results in duplicate table errors

**Solution:**
Do NOT run `drizzle-kit push` separately in CI. Let server handle migrations:

```bash
# ❌ WRONG
bunx drizzle-kit push
bun run start  # Server tries to migrate again

# ✅ CORRECT (Option 1: Server migrations)
bun run start  # Server runs migrations automatically

# ✅ CORRECT (Option 2: External schema + skip)
bunx drizzle-kit push
SKIP_MIGRATIONS=true bun run start
```

### SKIP_MIGRATIONS Environment Variable

**Purpose**: Skip server migration when schema is created externally

**When to Use:**
- CI/testing environments using `drizzle-kit push`
- External schema management tools
- Integration tests that create schema before server startup

**What It Skips** (commit 6a5f4ee):
- Built-in migration execution
- `hasRequiredPublicTables` validation check
- Migration recovery loop

**Important**: You MUST create the database schema externally before starting the server with `SKIP_MIGRATIONS=true`.

**Example:**
```bash
# Integration test workflow
bunx drizzle-kit push
SKIP_MIGRATIONS=true bun run test:integration
```

## Dependency Issues

### Issue: ESLint ajv TypeError

**Symptom:**
```
TypeError: Class extends value undefined is not a constructor or null
```

**Cause** (commit b344d9e):
- Root package.json forced ajv@8 via overrides
- @eslint/eslintrc requires ajv@6 for Draft-04 schema support
- Version conflict caused constructor chain to break

**Solution:**
Remove ajv version overrides from root package.json:

```json
// ❌ WRONG
{
  "overrides": {
    "ajv": "^8.18.0"  // Breaks @eslint/eslintrc
  }
}

// ✅ CORRECT
{
  "overrides": {
    // No ajv override - let packages use their required versions
  }
}
```

**Prevention:**
- Don't force major version upgrades via overrides
- Check package peer dependencies before overriding
- Test ESLint after adding overrides

### Issue: Missing hls.js Dependency

**Symptom:**
```
ERROR: Cannot find module 'hls.js'
Build fails in CI for gold-betting-demo
```

**Cause** (commit cfdabf3):
- StreamPlayer.tsx imports hls.js but it was not declared in package.json
- Works locally due to workspace hoisting
- Fails in CI where bun resolves dependencies strictly

**Solution:**
Add missing dependency to package.json:

```json
{
  "dependencies": {
    "hls.js": "^1.4.0"
  }
}
```

**Prevention:**
- Run `bun install --frozen-lockfile` to catch missing deps
- Test builds in clean environment (Docker)
- Use `bun run build` before committing

### Issue: Foundry/Anvil Not Available in CI

**Symptom:**
```
anvil: command not found
Integration tests fail
```

**Cause** (commit b344d9e):
- Integration tests require anvil binary for local Ethereum node
- Foundry toolchain not installed in CI environment

**Solution:**
Add Foundry toolchain to CI workflow:

```yaml
# .github/workflows/integration.yml
- name: Install Foundry
  uses: foundry-rs/foundry-toolchain@v1
  
- name: Run integration tests
  run: bun run test:integration
```

**Local Development:**
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
anvil --version
```

## Package Exclusions

### Excluded from CI Tests

**Packages:**
1. `@hyperscape/contracts` (commit 99dec96)
2. `@hyperscape/gold-betting-demo` (commit 93f9633)
3. `@hyperscape/evm-contracts` (commit 034f9c9)

**Reasons:**
- `contracts`: MUD CLI + @trpc/server compatibility issue
- `gold-betting-demo`: hls.js dependency resolution issue (fixed in cfdabf3, but still excluded)
- `evm-contracts`: Foundry/anvil not available in CI

**Turbo Filter:**
```bash
# Exclude from test run
turbo run test --filter='!@hyperscape/contracts' --filter='!@hyperscape/evm-contracts'
```

**Re-enabling:**
Tests will be re-enabled when dependency conflicts are resolved.

## Chain Setup Issues

### Issue: Chain Setup Fails in CI

**Symptom:**
```
setup-chain.mjs fails: anvil not found
MUD contracts tests fail
```

**Cause** (commit 034f9c9):
- `setup-chain.mjs` tries to start anvil and deploy MUD contracts
- Anvil binary not available in CI environment
- MUD CLI has compatibility issues

**Solution:**
Skip chain setup when `CI=true`:

```javascript
// scripts/setup-chain.mjs
if (process.env.CI === 'true') {
  console.log('Skipping chain setup in CI environment');
  process.exit(0);
}
```

**Local Development:**
```bash
# Install Foundry first
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Then run setup
bun run setup-chain
```

## Asset Management

### Issue: Assets Directory Already Exists

**Symptom:**
```
fatal: destination path 'assets' already exists and is not an empty directory
```

**Cause** (commit 6ce05cc):
- CI workflow clones assets repo
- Previous run left assets directory
- Git clone fails on non-empty directory

**Solution:**
Remove assets directory before cloning:

```bash
# .github/workflows/ci.yml
- name: Clone assets
  run: |
    rm -rf assets
    git clone https://github.com/HyperscapeAI/assets.git assets
```

**Prevention:**
- Always clean up in CI workflows
- Use `rm -rf` before git clone
- Consider using `git clone --depth 1` for faster clones

## Security Audit

### Issue: Build Fails on High Severity Vulnerabilities

**Symptom:**
```
npm audit found 2 high severity vulnerabilities
CI build fails
```

**Cause** (commit 19bebe2):
- bigint-buffer has high severity vulnerability
- No upstream patch available
- CI audit threshold set to `high`

**Solution:**
Lower audit threshold to `critical`:

```yaml
# .github/workflows/security.yml
- name: Security audit
  run: npm audit --audit-level=critical
```

**Rationale:**
- Allows builds to pass while waiting for upstream fixes
- Critical vulnerabilities still block builds
- High/moderate vulnerabilities logged but don't fail CI

**Remaining Vulnerabilities:**
- bigint-buffer (high) - no patched version available
- elliptic (moderate) - no patched version available

### Recent Security Fixes (commit a390b79)

**Resolved:**
- ✅ Playwright ^1.55.1 (fixes GHSA-7mvr-c777-76hp, high)
- ✅ Vite ^6.4.1 (fixes GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ ajv ^8.18.0 (fixes GHSA-2g4f-4pwh-qvx6)
- ✅ Root overrides for: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Total**: 14 of 16 vulnerabilities resolved

## Documentation Updates

### Issue: Mintlify API Failures Block CI

**Symptom:**
```
Mintlify API call failed
CI workflow fails
```

**Cause** (commit 034f9c9):
- Mintlify service outages
- API rate limits
- Network issues

**Solution:**
Add `continue-on-error` to docs update step:

```yaml
# .github/workflows/update-docs.yml
- name: Update documentation
  continue-on-error: true
  run: npm run docs:update
```

**Rationale:**
- Documentation updates are not critical for build success
- Allows CI to continue even if docs API is down
- Docs can be updated manually if needed

## Build Resilience

### Issue: Circular Dependencies Break Clean Builds

**Symptom:**
```
tsc fails: Cannot find module '@hyperscape/shared'
procgen and plugin-hyperscape builds fail
```

**Cause** (commit 5666ece):
- Circular dependencies between packages
- `@hyperscape/shared` imports from `@hyperscape/procgen`
- `@hyperscape/procgen` peer-depends on `@hyperscape/shared`
- When turbo runs clean build, tsc fails because the other package's dist/ doesn't exist yet

**Solution:**
Use `tsc || echo` pattern for resilient builds:

```json
// packages/procgen/package.json
{
  "scripts": {
    "build": "tsc || echo 'Build completed with circular dep warnings'"
  }
}
```

**Why This Works:**
- Build exits 0 even with circular dep errors
- Packages produce partial output sufficient for downstream consumers
- Turbo can continue build pipeline

**Prevention:**
- Avoid circular dependencies when possible
- Use peer dependencies carefully
- Test clean builds: `bun run clean && bun run build`

## TypeScript Errors

### Issue: Type Errors Block CI

**Symptom:**
```
AgentManager.ts: Type 'EmbeddedHyperscapeService' is not assignable to type 'HyperscapeService'
ArenaService.ts: Argument of type 'unknown' is not assignable to parameter
```

**Cause** (commit 5e60439):
- Type mismatches after refactoring
- Missing type casts
- Private methods called from tests

**Solutions:**

**Type Casts:**
```typescript
// AgentManager.ts
const service = embeddedService as HyperscapeService;
```

**Parameters Utility:**
```typescript
// ArenaService.ts
type PositionParam = Parameters<typeof teleportToArena>[2];
const position = unknownParam as PositionParam;
```

**Visibility Changes:**
```typescript
// ArenaRoundService.ts
// Change from private to public for test access
public getEligibleAgents(): string[] { ... }
```

## Test Infrastructure

### WebGPU Mocks for Three.js

**Issue**: Three.js WebGPU renderer requires browser globals

**Symptom:**
```
ReferenceError: GPUShaderStage is not defined
```

**Solution** (commit 25ba63c):
Create `vitest.setup.ts` with WebGPU mocks:

```typescript
// packages/server/vitest.setup.ts
globalThis.GPUShaderStage = {
  VERTEX: 1,
  FRAGMENT: 2,
  COMPUTE: 4,
};

globalThis.GPUBufferUsage = {
  MAP_READ: 1,
  MAP_WRITE: 2,
  COPY_SRC: 4,
  COPY_DST: 8,
  INDEX: 16,
  VERTEX: 32,
  UNIFORM: 64,
  STORAGE: 128,
  INDIRECT: 256,
  QUERY_RESOLVE: 512,
};

// ... more WebGPU globals
```

**Configure in vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

### ArenaService Test Helpers

**Issue**: Cannot spy on private methods

**Solution** (commit 25ba63c):
Add protected passthrough methods:

```typescript
// ArenaService.ts
protected getDb() {
  return this.world.getSystem("database");
}

protected getEligibleAgents() {
  return this.arenaRoundService.getEligibleAgents();
}

// Test file
const dbSpy = vi.spyOn(arenaService as any, 'getDb');
```

**Database Mock Helper:**
```typescript
function setDbMock(world: World, mockDb: any) {
  vi.spyOn(world, 'getSystem').mockImplementation((name) => {
    if (name === 'database') return mockDb;
    return null;
  });
}
```

## Streaming Infrastructure

### Issue: WebGPU Crashes on RTX 5060 Ti

**Symptom:**
```
Chrome crashes during WebGPU initialization
Vulkan ICD errors in logs
```

**Cause** (commits 0257563, 30cacb0):
- RTX 5060 Ti has broken Vulkan ICD on Vast.ai
- WebGPU defaults to Vulkan backend
- Vulkan initialization crashes Chrome

**Solutions:**

**1. Use GL ANGLE Backend:**
```typescript
// Chrome launch args
'--use-angle=gl',
'--use-gl=angle',
```

**2. Remove RTX 5060 Ti from GPU Search:**
```typescript
// vast-keeper GPU filter
const excludedGPUs = ['RTX 5060 Ti'];
```

**3. Use System FFmpeg:**
```bash
# Dockerfile
RUN apt-get install -y ffmpeg
# Don't use static FFmpeg build (causes SIGSEGV)
```

### Issue: RTX 4090 WebGPU Performance

**Symptom:**
- WebGPU works but performance is suboptimal
- GL backend used instead of Vulkan

**Solution** (commit 80bb06e):
Switch ANGLE to Vulkan backend for RTX 4090:

```typescript
// Chrome launch args for RTX 4090
'--use-angle=vulkan',
'--use-vulkan',
'--enable-features=Vulkan',
```

**GPU-Specific Configuration:**
```typescript
const gpuModel = detectGPU();
const angleBackend = gpuModel.includes('RTX 4090') ? 'vulkan' : 'gl';
args.push(`--use-angle=${angleBackend}`);
```

### Issue: Static FFmpeg Build SIGSEGV

**Symptom:**
```
Segmentation fault (core dumped)
FFmpeg crashes during encoding
```

**Cause** (commits 55a07bd, 536763d):
- Static FFmpeg builds have compatibility issues
- SIGSEGV during H.264 encoding

**Solution:**
Use system FFmpeg instead of static build:

```bash
# Dockerfile
RUN apt-get update && apt-get install -y ffmpeg

# Don't use ffmpeg-static npm package
```

**Verification:**
```bash
which ffmpeg  # Should be /usr/bin/ffmpeg
ffmpeg -version
```

## Vast.ai Deployment

### Issue: vastai CLI Not on PATH

**Symptom:**
```
vastai: command not found
```

**Cause** (commits 3ce7d64, 5c2a566):
- vastai installed via pip but not on PATH
- Python venv not activated

**Solution:**
Use python venv for vastai install:

```bash
# Dockerfile
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install vastai
```

**Alternative:**
```bash
# Use python module invocation
python3 -m vastai search offers
```

### Issue: Python Version Too Old

**Symptom:**
```
vastai-sdk requires Python 3.10+
Current: Python 3.9
```

**Cause** (commit 621ae67):
- Debian bullseye-slim has Python 3.9
- vastai-sdk requires Python 3.10+

**Solution:**
Upgrade to Debian bookworm-slim:

```dockerfile
# Before
FROM debian:bullseye-slim

# After
FROM debian:bookworm-slim
```

### Issue: PEP 668 Externally Managed Environment

**Symptom:**
```
error: externally-managed-environment
pip install fails on Debian 12
```

**Cause** (commit d9e9111):
- Debian 12 enforces PEP 668
- System Python is externally managed
- pip install blocked by default

**Solution:**
Use `--break-system-packages` flag:

```bash
pip3 install --break-system-packages vastai
```

**Better Solution:**
Use python venv (see above)

## Playwright Issues

### Issue: Chromium Not Installed

**Symptom:**
```
Error: Executable doesn't exist at /path/to/chromium
```

**Cause**:
- Playwright browsers not installed
- CI environment missing browser binaries

**Solution:**
```bash
# Install Playwright browsers
bunx playwright install chromium

# Or install all browsers
bunx playwright install

# With dependencies (Linux)
bunx playwright install --with-deps chromium
```

**CI Workflow:**
```yaml
- name: Install Playwright
  run: bunx playwright install --with-deps chromium
```

## Docker Issues

### Issue: DNS Resolution Fails in Container

**Symptom:**
```
getaddrinfo ENOTFOUND
npm install fails in Docker
```

**Cause** (commit fd17248):
- Container DNS not configured
- Default resolv.conf doesn't work

**Solution:**
Overwrite resolv.conf with Google DNS:

```dockerfile
# Dockerfile
RUN echo "nameserver 8.8.8.8" > /etc/resolv.conf
RUN echo "nameserver 8.8.4.4" >> /etc/resolv.conf
```

**Note**: Use `>` for first line (overwrite), `>>` for subsequent lines (append)

### Issue: Build Context Too Large

**Symptom:**
```
Sending build context to Docker daemon: 5.2GB
Build times out
```

**Solution:**
Add comprehensive `.dockerignore`:

```
node_modules
.git
.github
dist
build
*.log
.env
.env.*
packages/*/node_modules
packages/*/dist
packages/*/build
```

## CI Workflow Best Practices

### Graceful Degradation

**Principle**: Non-critical steps should not fail the entire build

**Examples:**

**Documentation Updates:**
```yaml
- name: Update docs
  continue-on-error: true
  run: npm run docs:update
```

**Asset Sync:**
```yaml
- name: Sync assets
  continue-on-error: true
  run: bun run assets:sync
```

### Conditional Execution

**Skip Steps in CI:**
```typescript
// setup-chain.mjs
if (process.env.CI === 'true') {
  console.log('Skipping in CI');
  process.exit(0);
}
```

**Skip Steps Locally:**
```bash
# Only run in CI
if [ "$CI" = "true" ]; then
  npm run ci-only-task
fi
```

### Caching Strategies

**Bun Dependencies:**
```yaml
- name: Cache bun dependencies
  uses: actions/cache@v3
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
```

**Playwright Browsers:**
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v3
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package.json') }}
```

## Debugging CI Failures

### Enable Debug Logging

**GitHub Actions:**
```yaml
- name: Run tests
  env:
    DEBUG: '*'
    VERBOSE: 'true'
  run: bun run test
```

**Bun:**
```bash
BUN_DEBUG=1 bun run build
```

### Reproduce Locally

**Use CI Environment:**
```bash
# Set CI flag
export CI=true

# Use same Node/Bun version
bun --version  # Should match CI

# Clean install
rm -rf node_modules
bun install --frozen-lockfile

# Run CI commands
bun run build
bun run test
```

**Docker Reproduction:**
```bash
# Build CI image
docker build -t hyperscape-ci -f Dockerfile.ci .

# Run CI commands
docker run hyperscape-ci bun run test
```

### Inspect Artifacts

**Save Logs:**
```yaml
- name: Upload logs
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-logs
    path: logs/
```

**Save Screenshots:**
```yaml
- name: Upload screenshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-screenshots
    path: packages/*/tests/**/__screenshots__/
```

## Common Error Patterns

### Pattern: "Cannot find module"

**Causes:**
1. Missing dependency in package.json
2. Incorrect import path
3. Build order issue (dependency not built yet)

**Solutions:**
1. Add to dependencies: `bun add <package>`
2. Fix import path
3. Check turbo.json dependsOn

### Pattern: "ECONNREFUSED"

**Causes:**
1. Service not started
2. Wrong port
3. Service crashed

**Solutions:**
1. Check service startup logs
2. Verify port in .env
3. Check for port conflicts: `lsof -ti:5555`

### Pattern: "Timeout"

**Causes:**
1. Service slow to start
2. Network latency
3. Deadlock

**Solutions:**
1. Increase timeout
2. Add retry logic
3. Check for circular waits

## Monitoring & Alerts

### CI Failure Notifications

**Slack Integration:**
```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Discord Integration:**
```yaml
- name: Notify on failure
  if: failure()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

### Health Checks

**Server Health Endpoint:**
```typescript
// packages/server/src/routes/health-routes.ts
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.COMMIT_HASH,
  };
});
```

**CI Health Check:**
```yaml
- name: Wait for server
  run: |
    timeout 60 bash -c 'until curl -f http://localhost:5555/health; do sleep 1; done'
```

## Performance Optimization

### Parallel Builds

**Turbo Configuration:**
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Benefits:**
- Builds packages in parallel when possible
- Respects dependency order
- Caches outputs for incremental builds

### Incremental Testing

**Run Only Changed Tests:**
```bash
# Turbo automatically detects changes
turbo run test --filter='...[HEAD^]'
```

**Skip Unchanged Packages:**
```bash
turbo run test --filter='[HEAD^]'
```

## Rollback Procedures

### Revert Failed Deployment

**Railway:**
```bash
# Rollback to previous deployment
railway rollback

# Or deploy specific commit
railway up --commit abc123
```

**Cloudflare Pages:**
```bash
# Rollback via dashboard
# Or redeploy previous commit
git revert HEAD
git push
```

### Database Rollback

**Drizzle Migrations:**
```bash
# Rollback last migration
bunx drizzle-kit drop

# Restore from backup
pg_restore -d hyperscape backup.sql
```

**Important**: Always backup before migrations in production

## References

- **Commit e4b6489**: Migration 0050 IF NOT EXISTS fix
- **Commit eb8652a**: drizzle-kit push + SKIP_MIGRATIONS
- **Commit b344d9e**: ESLint ajv fix + Foundry toolchain
- **Commit 25ba63c**: WebGPU mocks + test helpers
- **Commit 034f9c9**: Chain setup skip + docs continue-on-error
- **Commit 5666ece**: Circular dependency resilience
- **Commit a390b79**: Security audit fixes
- **CI Workflows**: `.github/workflows/`
