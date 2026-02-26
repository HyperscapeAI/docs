# CI/CD Improvements (February 2026)

Recent improvements to Hyperscape's CI/CD pipelines for better reliability and cross-platform support.

## Build System Fixes

### Tauri Build Improvements

**Problem:** macOS code signing was failing on unsigned builds due to empty `APPLE_CERTIFICATE` environment variable.

**Solution:** Split builds into separate unsigned and release variants:

```yaml
# Unsigned builds (no signing env vars)
- name: Build Desktop (Unsigned)
  run: bunx tauri build --no-bundle

# Release builds (with signing)
- name: Build Desktop (Release)
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    # ... other signing secrets
  run: bunx tauri build --bundles app
```

**Platforms affected:**
- Desktop (macOS, Linux, Windows)
- iOS
- Android

### Linux/Windows Build Fixes

**Problem:** Linux and Windows builds were failing with "app bundle type is macOS-only" error.

**Solution:** Use `--no-bundle` for unsigned builds instead of `--bundles app`:

```bash
# macOS only
bunx tauri build --bundles app

# Cross-platform
bunx tauri build --no-bundle
```

### iOS Build Optimization

**Problem:** Unsigned iOS builds always fail with "Signing requires a development team".

**Solution:** Make iOS build job release-only (skip unsigned builds):

```yaml
ios-release:
  if: startsWith(github.ref, 'refs/tags/v')
  # ... build steps
```

## Dependency Installation Resilience

### NPM Rate Limiting

**Problem:** GitHub Actions IP ranges are rate-limited by npm, causing intermittent 403 Forbidden errors.

**Solutions implemented:**

#### 1. Frozen Lockfile

```bash
# Always use committed lockfile (no fresh resolution)
bun install --frozen-lockfile
```

#### 2. Retry with Backoff

```bash
# Retry up to 5 times with increasing delays
for i in {1..5}; do
  bun install --frozen-lockfile && break
  DELAY=$((i * 15))
  echo "Retry $i/5 after ${DELAY}s..."
  sleep $DELAY
done
```

**Backoff schedule:**
- Attempt 1: Immediate
- Attempt 2: 15s delay
- Attempt 3: 30s delay
- Attempt 4: 45s delay
- Attempt 5: 60s delay

#### 3. Windows-Specific Retry

Windows runners have higher npm 403 failure rates:

```yaml
- name: Install dependencies (Windows)
  shell: bash
  run: |
    for i in {1..3}; do
      bun install --frozen-lockfile && break || {
        echo "Install failed, retry $i/3..."
        sleep 15
      }
    done
```

## Monorepo Dependency Fixes

### Circular Dependency Resolution

**Problem:** Turbo detected circular dependency: `shared → procgen → shared`

**Solution:** Move `@hyperscape/procgen` from dependencies to optional peerDependencies in `shared/package.json`:

```json
{
  "peerDependencies": {
    "@hyperscape/procgen": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@hyperscape/procgen": {
      "optional": true
    }
  }
}
```

And add as devDependency in `shared/package.json` for TypeScript resolution:

```json
{
  "devDependencies": {
    "@hyperscape/procgen": "workspace:*"
  }
}
```

**Why this works:**
- Turbo doesn't follow devDependencies for build ordering
- Runtime resolution still works (both packages always installed together)
- TypeScript can find type declarations

### ESLint Compatibility

**Problem:** `eslint-plugin-import@2.32.0` incompatible with ESLint 10 (uses removed `sourceCode.getTokenOrCommentBefore` API).

**Solution:** Disable cascaded `import/order` rule in affected packages:

```javascript
// packages/asset-forge/eslint.config.mjs
export default [
  ...rootConfig,
  {
    rules: {
      'import/order': 'off'  // Disable crashing rule
    }
  }
];
```

**Affected packages:**
- `asset-forge`

### TypeScript Module Resolution

**Problem:** Three.js WebGPU subpath exports require `moduleResolution: bundler` or `node16`.

**Solution:** Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"  // Changed from "node"
  }
}
```

**Affected packages:**
- `asset-forge`

## Deployment Improvements

### Vast.ai Deployment

**New features:**
1. **Maintenance mode integration** - Graceful deployments
2. **DATABASE_URL persistence** - Survives git reset operations
3. **Vulkan driver installation** - GPU rendering support
4. **Health checking** - Verifies server is ready post-deploy

**Key changes:**

```bash
# Write DATABASE_URL AFTER git reset (not before)
git reset --hard origin/main
echo "DATABASE_URL=$DATABASE_URL" > packages/server/.env

# Install Vulkan drivers for GPU rendering
apt-get install -y mesa-vulkan-drivers vulkan-tools libvulkan1
```

### Cloudflare Pages

**Problem:** Root `wrangler.toml` conflicted with Pages project.

**Solution:** Remove root `wrangler.toml`, use only `packages/client/wrangler.toml`:

```toml
# packages/client/wrangler.toml
name = "hyperscape"

[assets]
directory = "dist"
```

**Deployment:**
```bash
cd packages/client
bunx wrangler pages deploy dist --project-name=hyperscape
```

### R2 CORS Configuration

**Problem:** R2 bucket CORS used incorrect wrangler API format.

**Solution:** Use nested structure with `allowed` object:

```json
{
  "allowed": {
    "origins": ["*"],
    "methods": ["GET", "HEAD"],
    "headers": ["*"]
  },
  "exposed": ["ETag"],
  "maxAge": 3600
}
```

**Apply:**
```bash
bunx wrangler r2 bucket cors set hyperscape-assets --config cors-config.json
```

## Security Improvements

### JWT Secret Enforcement

**Problem:** Production servers running without JWT_SECRET (security risk).

**Solution:** Throw error in production/staging if JWT_SECRET not set:

```typescript
if (!process.env.JWT_SECRET) {
  if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
    throw new Error('JWT_SECRET is required in production/staging');
  }
  console.warn('JWT_SECRET not set - using insecure default');
}
```

### CSRF Cross-Origin Handling

**Problem:** CSRF middleware blocking legitimate cross-origin requests from Cloudflare Pages to Railway backend.

**Solution:** Skip CSRF validation for known cross-origin clients:

```typescript
// Known cross-origin client patterns
const KNOWN_CROSS_ORIGIN_CLIENTS = [
  /^https?:\/\/([a-z0-9-]+\.)?hyperscape\.gg$/,
  /^https?:\/\/([a-z0-9-]+\.)?hyperbet\.win$/,
  /^https?:\/\/([a-z0-9-]+\.)?hyperscape\.bet$/,
];

// Skip CSRF for cross-origin requests (already protected by Origin + JWT)
if (isKnownCrossOriginClient(origin)) {
  return; // Skip CSRF validation
}
```

**Why this is safe:**
- Cross-origin requests already protected by Origin header validation
- JWT bearer token authentication required
- CSRF cookies don't work cross-origin anyway (SameSite=Strict)

## Type Safety Improvements

### Explicit Any Type Elimination

**Reduced from 142 to ~46** explicit `any` types across codebase.

**Key fixes:**

#### 1. Tile Movement

```typescript
// Before
const collisionService: any = world.getSystem('buildingCollision');

// After
const collisionService = world.getSystem('buildingCollision') as BuildingCollisionService;
```

#### 2. WebSocket Types

```typescript
// Before
const ws: any = connection.socket;

// After
import type { WebSocket } from 'ws';
const ws = connection.socket as WebSocket;
```

#### 3. Error Handlers

```typescript
// Before
catch (error: any) {
  console.error(error);
}

// After
catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
}
```

### Type Annotations for Callbacks

```typescript
// Before
model.traverse((node) => {
  // TypeScript strict mode error
});

// After
model.traverse((node: Object3D) => {
  // Explicit type annotation
});
```

## Performance Improvements

### Memory Leak Fixes

**Problem:** InventoryInteractionSystem had 9 event listeners that were never removed.

**Solution:** Use AbortController for automatic cleanup:

```typescript
const abortController = new AbortController();

world.on('inventory:add', handler, { signal: abortController.signal });
world.on('inventory:remove', handler, { signal: abortController.signal });

// Cleanup
destroy() {
  abortController.abort();
}
```

### Dead Code Removal

**Removed:**
- `PacketHandlers.ts` - 3098 lines of dead code (never imported)
- `createArenaMarker` - Unused arena function
- `createAmbientDust` - Unused particle function
- `createLobbyBenches` - Unused lobby function

## Testing Improvements

### Cross-Platform Test Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [20.x]
```

### Visual Regression Testing

All Playwright tests now save screenshots to `__screenshots__/` for visual verification.

## Related Documentation

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment
- [docs/maintenance-mode-api.md](maintenance-mode-api.md) - Maintenance mode API
- [.github/workflows/](../.github/workflows/) - CI/CD workflows
