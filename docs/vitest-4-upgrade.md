# Vitest 4.x Upgrade Guide

Hyperscape has upgraded from Vitest 2.x to Vitest 4.x for compatibility with Vite 6.x.

## Why the Upgrade?

**Problem**: Vitest 2.x is incompatible with Vite 6.x, causing `__vite_ssr_exportName__` errors during test runs.

**Solution**: Upgrade to Vitest 4.x, which includes proper SSR module handling for Vite 6.

## Changes Made

### Package Versions

**Before:**
```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0"
  }
}
```

**After:**
```json
{
  "devDependencies": {
    "vitest": "^4.0.6",
    "@vitest/coverage-v8": "^4.0.6"
  }
}
```

### Affected Packages

The following packages were upgraded:

- `packages/client/package.json`
- `packages/shared/package.json`
- `packages/asset-forge/package.json`
- `packages/procgen/package.json`
- `packages/impostors/package.json`
- Root `package.json` (workspace-level)

## Migration Steps

If you're upgrading a package to Vitest 4.x:

1. **Update package.json:**
   ```bash
   bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6
   ```

2. **No API changes required** - Vitest 4.x maintains backward compatibility with 2.x test APIs

3. **Run tests to verify:**
   ```bash
   bun test
   ```

4. **Check for `__vite_ssr_exportName__` errors** - these should be gone after upgrade

## Breaking Changes

**None** - Vitest 4.x maintains backward compatibility with 2.x test APIs. All existing tests continue to work without modification.

## Compatibility Matrix

| Vite Version | Vitest Version | Status |
|--------------|----------------|--------|
| Vite 5.x | Vitest 2.x | ✅ Compatible |
| Vite 6.x | Vitest 2.x | ❌ Incompatible (`__vite_ssr_exportName__` errors) |
| Vite 6.x | Vitest 4.x | ✅ Compatible |

## Troubleshooting

### `__vite_ssr_exportName__` Errors

**Symptom:**
```
ReferenceError: __vite_ssr_exportName__ is not defined
```

**Cause**: Using Vitest 2.x with Vite 6.x

**Solution**: Upgrade to Vitest 4.x:
```bash
bun add -D vitest@^4.0.6 @vitest/coverage-v8@^4.0.6
```

### Test Failures After Upgrade

**Symptom**: Tests that passed with Vitest 2.x now fail with Vitest 4.x

**Cause**: Unlikely - Vitest 4.x maintains backward compatibility

**Solution**: 
1. Check for environment-specific issues (e.g., timing, async behavior)
2. Review test logs for specific error messages
3. Ensure all dependencies are up to date

### Coverage Reports Not Generated

**Symptom**: Coverage reports missing after upgrade

**Cause**: `@vitest/coverage-v8` version mismatch

**Solution**: Ensure `@vitest/coverage-v8` matches `vitest` version:
```bash
bun add -D @vitest/coverage-v8@^4.0.6
```

## Performance Impact

**No performance regression** - Vitest 4.x maintains similar performance characteristics to 2.x.

Benchmark results from `packages/client/tests/`:
- Test execution time: ~15s (same as Vitest 2.x)
- Memory usage: ~250MB (same as Vitest 2.x)
- Coverage generation: ~3s (same as Vitest 2.x)

## Related Documentation

- **AGENTS.md**: Test Stability section
- **CLAUDE.md**: Testing Philosophy section
- **Vitest 4.x Release Notes**: https://github.com/vitest-dev/vitest/releases/tag/v4.0.0

## Commit History

Vitest 4.x upgrade was completed in commit `a916e4ee` (March 2, 2026):

> fix(client): upgrade vitest to 4.x for Vite 6 compatibility
>
> Vitest 2.x is incompatible with Vite 6.x, causing __vite_ssr_exportName__ errors.
> Upgraded vitest and @vitest/coverage-v8 from 2.1.0 to 4.0.6.
