# Testing Guide

Hyperscape uses Playwright for end-to-end testing with real browser sessions and game instances. **No mocks are allowed** - all tests must use actual gameplay.

## Testing Philosophy

### Real Gameplay Testing
Every test must:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

### No Mocks Policy
- **Forbidden**: Mock objects, stub functions, fake data
- **Required**: Real server, real browser, real gameplay
- **Reason**: Ensures tests match production behavior exactly

### Visual Testing
Tests use colored cube proxies for visual verification:
- 🔴 Players (red)
- 🟢 Goblins (green)
- 🔵 Items (blue)
- 🟡 Trees (yellow)
- 🟣 Banks (purple)

## Test Timeouts

### Standard Timeouts
```typescript
// Default test timeout: 30s
test('basic gameplay', async ({ page }) => {
  // Test code
});

// Extended timeout for complex tests: 60s
test('complex integration', async ({ page }) => {
  // Test code
}, { timeout: 60000 });
```

### Increased Timeouts (Recent Changes)

#### GoldClob Fuzz Tests
**File**: `packages/evm-contracts/test/GoldClob.fuzz.ts`

**Timeout**: 120s (120000ms)

**Reason**: Randomized invariant tests process:
- 4 random seeds
- 140 operations per seed
- Plus claim operations
- Total: ~560 operations with gas calculations

```typescript
describe("GoldClob Fuzz Tests", () => {
  it("should maintain invariants across random operations", async () => {
    // 4 seeds × 140 operations + claims
  }, { timeout: 120000 });  // 120s timeout
});
```

#### EmbeddedHyperscapeService Tests
**File**: `packages/server/src/eliza/__tests__/EmbeddedHyperscapeService.test.ts`

**Timeout**: 60s (60000ms) for `beforeEach` hooks

**Reason**: Dynamic import of Hyperscape service takes time:
- Module loading
- World initialization
- Asset loading
- PhysX WASM initialization

```typescript
beforeEach(async () => {
  // Dynamic import and world setup
}, { timeout: 60000 });  // 60s timeout
```

#### Precision Fixes
**File**: `packages/evm-contracts/test/GoldClob.round2.ts`

**Change**: Use larger amounts (10000n) to avoid gas cost precision issues

**Before**:
```typescript
const amount = 100n;  // Too small, gas costs cause precision errors
```

**After**:
```typescript
const amount = 10000n;  // Larger amounts avoid precision issues
const gasCost = BigInt(Math.floor(Number(gasCostRaw)));  // Explicit BigInt conversion
```

## Test Configuration

### Playwright Configuration
**File**: `packages/client/playwright.config.ts`

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,  // Default 30s
  expect: {
    timeout: 5000,  // Assertion timeout
  },
  use: {
    headless: false,  // Headful for WebGPU support
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### Vitest Configuration
**File**: `packages/shared/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    timeout: 30000,  // Default 30s
    hookTimeout: 60000,  // beforeEach/afterEach: 60s
    testTimeout: 30000,  // Individual test: 30s
  },
});
```

## WebGPU Testing Requirements

### Browser Requirements
- **Headless**: NOT supported (WebGPU requires display)
- **Headful**: Required with GPU access
- **Display**: Xorg, Xvfb, or Ozone headless with GPU

### Playwright WebGPU Setup
```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,  // WebGPU requires headful
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=WebGPU',
    '--use-vulkan',
    '--ignore-gpu-blocklist',
  ],
});
```

### CI/CD Considerations
- **GitHub Actions**: Use `ubuntu-latest` with GPU support
- **Docker**: Requires GPU passthrough and display server
- **Vast.ai**: Full GPU support with Xorg/Xvfb

## Test Patterns

### Basic Gameplay Test
```typescript
test('player can move and interact', async ({ page }) => {
  await page.goto('http://localhost:3333');
  
  // Wait for game to load
  await page.waitForSelector('canvas');
  
  // Execute gameplay action
  await page.keyboard.press('w');  // Move forward
  await page.click('canvas');  // Click to interact
  
  // Verify with screenshot
  await page.screenshot({ path: 'logs/movement-test.png' });
  
  // Verify with Three.js scene query
  const playerPosition = await page.evaluate(() => {
    return window.world.getPlayers()[0].node.position;
  });
  
  expect(playerPosition.z).toBeLessThan(0);  // Moved forward
});
```

### Visual Verification Test
```typescript
test('resource renders correctly', async ({ page }) => {
  await page.goto('http://localhost:3333');
  
  // Wait for resource to spawn
  await page.waitForTimeout(1000);
  
  // Query Three.js scene
  const treeCount = await page.evaluate(() => {
    const trees = window.world.getEntitiesByType('Resource')
      .filter(r => r.config.resourceType === 'tree');
    return trees.length;
  });
  
  expect(treeCount).toBeGreaterThan(0);
  
  // Visual verification
  await page.screenshot({ path: 'logs/tree-render-test.png' });
});
```

### Combat Test with Timeout
```typescript
test('combat completes successfully', async ({ page }) => {
  await page.goto('http://localhost:3333');
  
  // Start combat
  await page.evaluate(() => {
    const mob = window.world.getEntitiesByType('Mob')[0];
    window.world.getSystem('combat').startCombat(player, mob);
  });
  
  // Wait for combat to complete (may take 30+ seconds)
  await page.waitForFunction(() => {
    const combat = window.world.getSystem('combat');
    return !combat.isInCombat(player.id);
  }, { timeout: 60000 });  // 60s timeout for long combat
  
  // Verify outcome
  const mobHealth = await page.evaluate(() => {
    const mob = window.world.getEntitiesByType('Mob')[0];
    return mob.health;
  });
  
  expect(mobHealth).toBe(0);  // Mob defeated
}, { timeout: 90000 });  // 90s total test timeout
```

## Debugging Failed Tests

### Screenshot Analysis
```bash
# Failed tests save screenshots to logs/
ls logs/*.png

# View screenshot
open logs/combat-test-failure.png
```

### Video Recording
```bash
# Failed tests save videos (if configured)
ls test-results/*/video.webm

# Play video
vlc test-results/*/video.webm
```

### Console Logs
```typescript
// Capture browser console in test
page.on('console', msg => {
  console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
});

// Capture errors
page.on('pageerror', error => {
  console.error(`[Browser Error] ${error.message}`);
});
```

### Three.js Scene Inspection
```typescript
// Dump entire scene graph
const sceneGraph = await page.evaluate(() => {
  const scene = window.world.stage.scene;
  const dump = (obj, depth = 0) => {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${obj.type} "${obj.name}"`);
    obj.children.forEach(child => dump(child, depth + 1));
  };
  dump(scene);
});
```

## Performance Testing

### Benchmark Tests
```typescript
test('combat system scales linearly', async ({ page }) => {
  const results = [];
  
  for (const mobCount of [10, 50, 100, 200]) {
    const startTime = Date.now();
    
    // Spawn mobs and run combat
    await page.evaluate((count) => {
      // Spawn N mobs and start combat
    }, mobCount);
    
    const duration = Date.now() - startTime;
    results.push({ mobCount, duration });
  }
  
  // Verify linear scaling
  const slope = calculateSlope(results);
  expect(slope).toBeLessThan(2.0);  // Less than 2x slowdown per 2x mobs
});
```

### Memory Leak Detection
```typescript
test('no memory leaks during combat', async ({ page }) => {
  const initialHeap = await page.evaluate(() => {
    return performance.memory.usedJSHeapSize;
  });
  
  // Run 100 combat cycles
  for (let i = 0; i < 100; i++) {
    await page.evaluate(() => {
      // Start and complete combat
    });
  }
  
  const finalHeap = await page.evaluate(() => {
    return performance.memory.usedJSHeapSize;
  });
  
  const heapGrowth = finalHeap - initialHeap;
  expect(heapGrowth).toBeLessThan(10 * 1024 * 1024);  // <10MB growth
});
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: npm test
  env:
    CI: true
    HEADLESS: false  # WebGPU requires headful
```

### Test Artifacts
```yaml
- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      logs/
      test-results/
```

## Best Practices

### Test Isolation
- Each test should start with a fresh world
- Clean up entities after test
- Reset game state between tests

### Timeout Guidelines
- **Simple tests**: 30s (default)
- **Complex integration**: 60s
- **Fuzz/randomized**: 120s
- **beforeEach hooks**: 60s (for world initialization)

### Error Handling
```typescript
test('handles errors gracefully', async ({ page }) => {
  try {
    // Test code that might fail
  } catch (error) {
    // Save diagnostic info
    await page.screenshot({ path: 'logs/error-state.png' });
    const sceneState = await page.evaluate(() => {
      return window.world.getDebugState();
    });
    console.error('Scene state:', sceneState);
    throw error;  // Re-throw for test failure
  }
});
```

### Flaky Test Prevention
- Use `waitForFunction()` instead of `waitForTimeout()`
- Add retry logic for network-dependent operations
- Increase timeouts for slow operations (combat, pathfinding)
- Use deterministic random seeds for reproducibility

## See Also

- `packages/client/playwright.config.ts` - Playwright configuration
- `packages/shared/vitest.config.ts` - Vitest configuration
- `packages/client/tests/e2e/` - End-to-end test examples
- `packages/shared/src/systems/shared/combat/__tests__/` - Combat system tests
- `packages/evm-contracts/test/` - Smart contract tests
