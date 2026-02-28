# Test Timeout Configuration

## Overview

Recent updates have adjusted test timeouts to improve stability and prevent false failures in CI/CD environments and local development.

## Updated Timeouts

### GoldClob Fuzz Tests

**File:** `packages/evm-contracts/test/GoldClob.fuzz.ts`

**Timeout:** 120 seconds (120,000ms)

**Reason:**
- Randomized invariant tests process 4 seeds × 140 operations plus claims
- Each operation involves EVM state changes and validation
- Total execution time can exceed 60s in CI environments

**Configuration:**
```typescript
describe('GoldClob Fuzz Tests', () => {
  it('should maintain invariants across random operations', async () => {
    // Test implementation
  }).timeout(120000);  // 120 seconds
});
```

### GoldClob Round 2 Tests

**File:** `packages/evm-contracts/test/GoldClob.round2.ts`

**Changes:**
- Use larger amounts (10000n) to avoid gas cost precision issues
- Add explicit BigInt conversion for gasCost calculations

**Example:**
```typescript
// Before (precision issues with small amounts)
const amount = 100n;
const gasCost = estimateGas(amount);  // May lose precision

// After (larger amounts avoid precision issues)
const amount = 10000n;
const gasCost = BigInt(estimateGas(amount));  // Explicit conversion
```

### EmbeddedHyperscapeService Tests

**File:** `packages/server/src/eliza/__tests__/EmbeddedHyperscapeService.test.ts`

**Timeout:** 60 seconds (60,000ms) for `beforeEach` hooks

**Reason:**
- Dynamic imports of Hyperscape service modules
- World initialization and system setup
- Asset loading and PhysX initialization

**Configuration:**
```typescript
beforeEach(async () => {
  // Setup code
}, 60000);  // 60 seconds
```

## Timeout Best Practices

### When to Increase Timeouts

1. **Randomized/Fuzz Tests**
   - Multiple iterations with random inputs
   - Each iteration has variable execution time
   - Use 2-3x the average execution time

2. **Integration Tests**
   - Multiple system initialization
   - Asset loading and caching
   - Network operations
   - Use 60-120s for complex setups

3. **CI/CD Environments**
   - Slower than local development
   - Shared resources and CPU throttling
   - Add 50-100% buffer over local times

### When NOT to Increase Timeouts

1. **Unit Tests**
   - Should complete in <1s
   - If slower, refactor to use mocks or smaller test cases

2. **Simple Integration Tests**
   - Single system tests should complete in <10s
   - If slower, check for unnecessary setup

3. **Flaky Tests**
   - Don't mask flakiness with longer timeouts
   - Fix the root cause instead

## Timeout Configuration

### Vitest (Default Test Runner)

**Global timeout:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000,  // 30 seconds default
  },
});
```

**Per-test timeout:**
```typescript
it('should complete quickly', async () => {
  // Test code
}, { timeout: 5000 });  // 5 seconds
```

**Per-suite timeout:**
```typescript
describe('Slow tests', () => {
  beforeEach(() => {
    // Setup
  }, 60000);  // 60 seconds for setup

  it('test 1', async () => {
    // Test code
  }, { timeout: 120000 });  // 120 seconds for test
});
```

### Playwright (E2E Tests)

**Global timeout:**
```typescript
// playwright.config.ts
export default defineConfig({
  timeout: 60000,  // 60 seconds per test
  expect: {
    timeout: 10000,  // 10 seconds for assertions
  },
});
```

**Per-test timeout:**
```typescript
test('should load game', async ({ page }) => {
  test.setTimeout(120000);  // 120 seconds
  await page.goto('http://localhost:3333');
});
```

## Common Timeout Issues

### Issue: Tests Timeout in CI but Pass Locally

**Cause:**
- CI environments are slower (shared CPU, throttling)
- Asset loading takes longer on cold cache
- Network latency for external services

**Solution:**
```typescript
// Use environment-aware timeouts
const timeout = process.env.CI ? 120000 : 60000;

it('should initialize world', async () => {
  // Test code
}, { timeout });
```

### Issue: Fuzz Tests Timeout Randomly

**Cause:**
- Random inputs create variable execution paths
- Some paths are much slower than others
- Timeout set for average case, not worst case

**Solution:**
```typescript
// Use 3x the average execution time for fuzz tests
const FUZZ_TIMEOUT = 120000;  // 120 seconds

it('should maintain invariants', async () => {
  for (let seed = 0; seed < 4; seed++) {
    // Fuzz test with seed
  }
}, { timeout: FUZZ_TIMEOUT });
```

### Issue: Dynamic Import Timeouts

**Cause:**
- Dynamic imports can be slow on first load
- Module initialization may trigger heavy setup
- Bun's module cache may not be warm

**Solution:**
```typescript
// Increase beforeEach timeout for dynamic imports
beforeEach(async () => {
  const { EmbeddedHyperscapeService } = await import('../EmbeddedHyperscapeService');
  service = new EmbeddedHyperscapeService();
  await service.initialize();
}, 60000);  // 60 seconds
```

## Debugging Timeout Issues

### 1. Add Timing Logs

```typescript
it('should complete', async () => {
  const start = Date.now();
  
  console.log('[Test] Starting setup...');
  await setup();
  console.log(`[Test] Setup took ${Date.now() - start}ms`);
  
  console.log('[Test] Running test...');
  await runTest();
  console.log(`[Test] Test took ${Date.now() - start}ms`);
}, { timeout: 60000 });
```

### 2. Use Vitest's --reporter=verbose

```bash
# See detailed timing for each test
npm test -- --reporter=verbose
```

### 3. Profile Slow Tests

```typescript
it('should complete', async () => {
  const timings: Record<string, number> = {};
  
  const time = async (label: string, fn: () => Promise<void>) => {
    const start = Date.now();
    await fn();
    timings[label] = Date.now() - start;
  };
  
  await time('setup', async () => await setup());
  await time('test', async () => await runTest());
  await time('teardown', async () => await teardown());
  
  console.log('Timings:', timings);
  // Identify the slowest operation
}, { timeout: 60000 });
```

## Timeout Reference

### Current Timeouts by Test Type

| Test Type | Timeout | File Pattern |
|-----------|---------|--------------|
| Unit Tests | 5-10s | `*.test.ts` |
| Integration Tests | 30-60s | `*.integration.test.ts` |
| E2E Tests | 60-120s | `*.spec.ts` |
| Fuzz Tests | 120s | `*.fuzz.ts` |
| Performance Tests | 60-120s | `*.bench.test.ts` |

### Specific Test Timeouts

| Test File | Timeout | Reason |
|-----------|---------|--------|
| `GoldClob.fuzz.ts` | 120s | 4 seeds × 140 operations |
| `EmbeddedHyperscapeService.test.ts` | 60s (beforeEach) | Dynamic imports + world init |
| `AgentDuelArena.integration.test.ts` | 120s | Full duel simulation |
| `StreamingDuelScheduler.test.ts` | 90s | Streaming pipeline setup |

## Related Documentation

- [Testing Philosophy](../CLAUDE.md#testing-philosophy) - NO MOCKS rule
- [Vitest Configuration](../packages/shared/vitest.config.ts) - Global test config
- [Playwright Configuration](../packages/client/playwright.config.ts) - E2E test config
