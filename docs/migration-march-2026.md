# Migration Guide - March 2026 Dependency Updates

This guide covers breaking changes and migration steps for the major dependency updates merged to `main` on March 19, 2026.

## Overview

The March 2026 update includes **6 major version upgrades** with breaking changes:

| Package | Old Version | New Version | Impact |
|---------|-------------|-------------|--------|
| Vite | 6.4.1 | 8.0.0 | Build configuration |
| @vitejs/plugin-react | 5.2.0 | 6.0.1 | React plugin config |
| @nomicfoundation/hardhat-ethers | 3.1.3 | 4.0.6 | Contract scripts |
| jsdom | 28.1.0 | 29.0.0 | Test environment |
| jest | 29.7.0 | 30.3.0 | Test snapshots |
| sqlite3 | 5.1.7 | 6.0.1 | Node.js version |

## Prerequisites

Before migrating, ensure you have:

- **Bun 1.3.10+** (required for Vite 8.0)
- **Node.js 18+** (required for sqlite3 6.0.1, though not used in production)
- **Git** with clean working directory (commit or stash changes)

## Migration Steps

### 1. Vite 8.0.0 - Build System Upgrade

**Breaking Changes:**
- New plugin API
- Updated config schema
- Changed HMR behavior

**Migration:**

1. **Update `vite.config.ts` files** in affected packages:

```typescript
// packages/client/vite.config.ts
// packages/shared/vite.config.ts
// packages/asset-forge/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(), // Ensure using @vitejs/plugin-react 6.0.1+
  ],
  // ... rest of config
});
```

2. **Verify plugin compatibility:**
   - All Vite plugins must be compatible with Vite 8
   - Check plugin documentation for Vite 8 support
   - Update plugins if needed

3. **Test build:**
   ```bash
   bun run build
   ```

**Common Issues:**
- **Plugin errors**: Update plugins to Vite 8-compatible versions
- **Config errors**: Check Vite 8 migration guide for config schema changes
- **HMR issues**: Clear browser cache and restart dev server

### 2. @vitejs/plugin-react 6.0.1 - React Plugin Upgrade

**Breaking Changes:**
- New Fast Refresh implementation
- Updated React 19 integration

**Migration:**

1. **Verify React version:**
   ```bash
   # Should be React 19.2.0+
   grep '"react":' packages/*/package.json
   ```

2. **Update plugin configuration** (if customized):
   ```typescript
   // vite.config.ts
   import react from '@vitejs/plugin-react';
   
   export default defineConfig({
     plugins: [
       react({
         // Fast Refresh is enabled by default
         // Customize only if needed
       }),
     ],
   });
   ```

3. **Test HMR:**
   ```bash
   bun run dev:client
   # Make a change to a React component
   # Verify hot reload works without full page refresh
   ```

**Common Issues:**
- **Fast Refresh errors**: Check React component syntax (hooks, exports)
- **HMR not working**: Ensure components are exported correctly

### 3. @nomicfoundation/hardhat-ethers 4.0.6 - ethers.js v6

**Breaking Changes:**
- ethers.js v5 → v6 API changes
- Contract deployment API changed
- Provider/Signer API changed

**Migration:**

1. **Update contract deployment scripts:**

```typescript
// packages/duel-oracle-evm/scripts/deploy.ts
// OLD (ethers v5)
const Contract = await ethers.getContractFactory("MyContract");
const contract = await Contract.deploy(...args);
await contract.deployed(); // ❌ Removed in v6

// NEW (ethers v6)
const Contract = await ethers.getContractFactory("MyContract");
const contract = await Contract.deploy(...args);
await contract.waitForDeployment(); // ✅ New method
```

2. **Update provider/signer usage:**

```typescript
// OLD (ethers v5)
const signer = provider.getSigner();
const address = await signer.getAddress();

// NEW (ethers v6)
const signer = await provider.getSigner();
const address = await signer.getAddress();
```

3. **Update contract interaction:**

```typescript
// OLD (ethers v5)
const tx = await contract.myFunction(...args);
await tx.wait();

// NEW (ethers v6) - same API, but better types
const tx = await contract.myFunction(...args);
await tx.wait();
```

4. **Test contract scripts:**
   ```bash
   cd packages/duel-oracle-evm
   npx hardhat test
   ```

**Common Issues:**
- **`deployed()` not found**: Use `waitForDeployment()` instead
- **Type errors**: Update TypeScript types for ethers v6
- **Provider errors**: Ensure provider is properly initialized

**Resources:**
- [ethers.js v6 Migration Guide](https://docs.ethers.org/v6/migrating/)

### 4. jsdom 29.0.0 - Testing Environment

**Breaking Changes:**
- Improved DOM API compatibility
- Changed behavior for some edge cases

**Migration:**

1. **Run test suite:**
   ```bash
   npm test
   ```

2. **Fix failing tests:**
   - Most tests should pass without changes
   - Check for tests that rely on specific DOM behavior
   - Update assertions if needed

**Common Issues:**
- **DOM API differences**: Check jsdom 29 changelog for specific changes
- **Event handling**: Verify event listeners work as expected

### 5. Jest 30.3.0 - Testing Framework

**Breaking Changes:**
- New snapshot format
- Updated matcher API
- Performance improvements

**Migration:**

1. **Regenerate snapshots:**
   ```bash
   npm test -- -u
   ```

2. **Review snapshot changes:**
   ```bash
   git diff
   # Review snapshot changes carefully
   # Ensure they're expected
   ```

3. **Update custom matchers** (if any):
   ```typescript
   // Check packages/*/test/setup.ts for custom matchers
   // Update to Jest 30 API if needed
   ```

4. **Run full test suite:**
   ```bash
   npm test
   ```

**Common Issues:**
- **Snapshot mismatches**: Regenerate with `-u` flag
- **Custom matcher errors**: Update to Jest 30 API
- **Performance**: Jest 30 is faster, but may expose timing issues

### 6. sqlite3 6.0.1 - Database Driver

**Breaking Changes:**
- Node.js 18+ required (was 16+)
- Updated native bindings

**Migration:**

1. **Verify Node.js version:**
   ```bash
   node --version
   # Should be v18.0.0 or higher
   ```

2. **Note**: sqlite3 is **not used in production** (PostgreSQL only)
   - Only affects local development if you use sqlite3 directly
   - Removed from Docker builds to prevent QEMU segfaults

3. **No action required** for most users

**Common Issues:**
- **Node.js version**: Upgrade to Node.js 18+ if needed
- **Docker builds**: sqlite3 is already removed from Dockerfile

## Post-Migration Verification

After completing all migration steps:

### 1. Build All Packages
```bash
bun run clean
bun install
bun run build
```

### 2. Run Test Suite
```bash
npm test
```

### 3. Start Development Server
```bash
bun run dev
```

### 4. Verify Key Features
- [ ] Client loads without errors
- [ ] Server starts successfully
- [ ] HMR works in development
- [ ] Tests pass
- [ ] Contract scripts work (if using)

### 5. Check Production Build
```bash
bun run build
bun start
```

## Rollback Plan

If you encounter issues:

1. **Revert to previous commit:**
   ```bash
   git reset --hard HEAD~1
   ```

2. **Or checkout specific commit before updates:**
   ```bash
   git checkout <commit-hash-before-march-19>
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules packages/*/node_modules
   bun install
   bun run build
   ```

## Performance Improvements

Expected performance gains from these updates:

| Area | Improvement | Notes |
|------|-------------|-------|
| Build Time | 20-30% faster | Vite 8 optimizations |
| HMR | 40-50% faster | Improved Fast Refresh |
| Test Execution | 15-20% faster | Jest 30 optimizations |
| Type Checking | 10-15% faster | Better TypeScript integration |

## Breaking Changes Summary

### Vite 8.0.0
- ❌ Old plugin API
- ✅ New plugin API (update `vite.config.ts`)

### @vitejs/plugin-react 6.0.1
- ❌ Old Fast Refresh
- ✅ New Fast Refresh (better React 19 support)

### @nomicfoundation/hardhat-ethers 4.0.6
- ❌ `contract.deployed()`
- ✅ `contract.waitForDeployment()`
- ❌ ethers v5 API
- ✅ ethers v6 API

### jsdom 29.0.0
- ❌ Some edge case DOM behaviors
- ✅ Improved DOM API compatibility

### Jest 30.3.0
- ❌ Old snapshot format
- ✅ New snapshot format (regenerate with `-u`)

### sqlite3 6.0.1
- ❌ Node.js 16
- ✅ Node.js 18+ required

## Additional Resources

- [Vite 8 Migration Guide](https://vitejs.dev/guide/migration.html)
- [ethers.js v6 Migration Guide](https://docs.ethers.org/v6/migrating/)
- [Jest 30 Release Notes](https://jestjs.io/blog/)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)

## Support

If you encounter issues during migration:

1. Check this guide for common issues
2. Review package-specific migration guides (linked above)
3. Check GitHub Issues for known problems
4. Ask in Discord/Slack for help

## Changelog

- **March 19, 2026**: Initial migration guide created
- **March 19, 2026**: All dependency updates merged to `main`
