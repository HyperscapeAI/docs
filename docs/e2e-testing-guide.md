# E2E Testing Guide

Hyperscape uses comprehensive end-to-end (E2E) testing with real browser sessions and actual WebGPU rendering. Per project rules: **NO MOCKS** - all tests use real Hyperscape instances with Playwright.

## Complete Journey Tests

The `complete-journey.spec.ts` test suite validates the full player experience from login to gameplay.

### Test Coverage

1. **Full Journey Test**: `login → loading → spawn → walk`
   - Completes Privy wallet authentication
   - Navigates through character selection
   - Waits for loading screen to hide
   - Verifies player spawns in world
   - Tests keyboard movement in multiple directions
   - Captures screenshots at each stage
   - Validates visual changes (game is rendering)

2. **Loading Progress Test**: Validates loading screen behavior
   - Ensures loading screen appears during world initialization
   - Waits for loading screen to hide (with timeout)
   - Verifies game is playable after loading completes

3. **Multi-Direction Movement Test**: Tests navigation system
   - Moves player in all four cardinal directions (up, right, down, left)
   - Logs position after each movement
   - Verifies movement capability is available

4. **WebSocket Connection Test**: Validates network stability
   - Checks WebSocket connection status throughout journey
   - Verifies connection maintains during movement
   - Logs reconnect attempts and errors

5. **World State Verification Test**: Validates game world initialization
   - Checks world object exists
   - Verifies player entity is spawned
   - Validates scene, camera, and network objects
   - Logs entity count and loading state

6. **Screenshot Verification Test**: Ensures game is rendering correctly
   - Captures 5 screenshots during different movement actions
   - Compares consecutive screenshots for differences
   - Requires at least 0.001% pixel difference between frames
   - Validates the scene is updating (not frozen)

7. **Continuous Movement Test**: Tests sustained movement
   - Holds down movement key for 2 seconds
   - Captures before/after screenshots
   - Requires visual change (at least 0.01% difference)

### Test Utilities

Located in `packages/client/tests/e2e/utils/testWorld.ts`:

#### Loading Screen Detection
```typescript
waitForLoadingScreenHidden(page, timeout): Promise<void>
```
- Waits for loading screen to hide with configurable timeout
- Polls every 500ms checking for loading screen visibility
- Throws error if loading screen doesn't hide within timeout
- Default timeout: 90 seconds

```typescript
isLoadingScreenVisible(page): Promise<boolean>
```
- Checks if loading screen is currently visible
- Uses multiple selectors to detect loading state
- Returns true if any loading indicator is found

#### Player Spawn Detection
```typescript
waitForPlayerSpawn(page, timeout): Promise<void>
```
- Waits for player entity to spawn in world
- Checks for valid player position (finite x, y, z coordinates)
- Default timeout: 60 seconds

```typescript
getPlayerPosition(page): Promise<{x: number, y: number, z: number}>
```
- Retrieves current player world position
- Accesses `window.world.entities.player.position`
- Returns coordinates or throws if player not found

#### Movement Simulation
```typescript
simulateMovement(page, direction, duration): Promise<void>
```
- Simulates keyboard movement in specified direction
- Directions: 'up' (W), 'down' (S), 'left' (A), 'right' (D)
- Holds key down for specified duration (milliseconds)
- Automatically releases key after duration

#### Screenshot Comparison
```typescript
takeGameScreenshot(page, name): Promise<Buffer>
```
- Captures screenshot of game canvas
- Saves to `packages/client/tests/e2e/__screenshots__/`
- Returns screenshot buffer for comparison
- Filename format: `{name}.png`

```typescript
assertScreenshotsDifferent(buffer1, buffer2, name1, name2, threshold)
```
- Compares two screenshot buffers pixel-by-pixel
- Calculates percentage of different pixels
- Throws assertion error if difference is below threshold
- Default threshold: 0.01% (very sensitive to any change)
- Logs actual difference percentage for debugging

```typescript
takeAndCompareScreenshot(page, name, previousBuffer, threshold): Promise<Buffer>
```
- Convenience method combining capture and comparison
- Takes new screenshot and compares to previous
- Returns new screenshot buffer for chaining

#### WebSocket Status
```typescript
getWebSocketStatus(page): Promise<{isConnected: boolean, reconnectAttempts: number, lastError: string | null}>
```
- Retrieves current WebSocket connection state
- Accesses `window.world.network` object
- Returns connection status, reconnect count, and last error

#### UI State
```typescript
getUIState(page): Promise<{isLoading: boolean}>
```
- Checks current UI loading state
- Accesses `window.__HYPERSCAPE_LOADING__` object
- Note: May still be true even after gameplay starts (CSS detection)

#### Error Capture
```typescript
setupErrorCapture(page): {errors: Array<{type: string, message: string}>}
```
- Sets up console error and page error listeners
- Captures all console errors during test execution
- Returns array reference that accumulates errors

```typescript
assertNoConsoleErrors(errors): void
```
- Validates no critical console errors occurred
- Allows warnings (only fails on errors)
- Logs all captured errors if assertion fails

#### Game Load Helpers
```typescript
waitForGameLoad(page, timeout): Promise<void>
```
- Waits for game client to fully load
- Checks for canvas element visibility
- Verifies world object exists

```typescript
waitForGameClient(page, timeout): Promise<boolean>
```
- Waits for game client initialization
- From `packages/client/tests/e2e/fixtures/privy-helpers.ts`
- Returns true if game client loaded successfully

```typescript
waitForAppReady(page, url): Promise<void>
```
- Navigates to app URL and waits for initial load
- Sets up page with extended timeouts
- Waits for network idle state

## Test Configuration

### Timeouts

Recent stability improvements have adjusted test timeouts:

- **Complete Journey Tests**: 6 minutes (360,000ms)
- **Default Navigation**: 120 seconds
- **Loading Screen Hide**: 90 seconds
- **Player Spawn**: 60 seconds
- **Game Client Load**: 60 seconds
- **WebSocket Connection**: 30 seconds

### Browser Configuration

Tests use Playwright with actual WebGPU rendering:

- **Headful Mode**: Tests run with visible browser (WebGPU requires window context)
- **WebGPU Enabled**: All tests require WebGPU support
- **Real Rendering**: No mocks - actual Three.js scene rendering
- **Screenshot Capture**: Visual regression testing with pixel comparison

### Test Isolation

Each test:
1. Starts a fresh Hyperscape server instance
2. Opens a new browser context
3. Completes full authentication flow
4. Spawns a new character
5. Cleans up after completion

## Running E2E Tests

```bash
# Run all E2E tests
npm test

# Run specific test file
npx playwright test packages/client/tests/e2e/complete-journey.spec.ts

# Run with UI mode (visual debugging)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug packages/client/tests/e2e/complete-journey.spec.ts
```

## Visual Testing Best Practices

### Screenshot Comparison Thresholds

- **0.001%**: Very sensitive - detects even minor scene updates
- **0.01%**: Standard threshold - confirms game is rendering
- **0.1%**: Loose threshold - allows for minor rendering variations

### When to Use Screenshot Comparison

✅ **Good use cases:**
- Verifying game is rendering (not frozen)
- Detecting movement/animation
- Validating UI state changes
- Regression testing for visual bugs

❌ **Avoid for:**
- Exact pixel-perfect matching (rendering may vary slightly)
- Comparing across different GPUs/drivers
- Time-based animations (use fixed timestamps)

### Debugging Failed Screenshot Tests

If screenshot comparison fails:

1. Check `packages/client/tests/e2e/__screenshots__/` for captured images
2. Compare visually to identify what changed
3. Adjust threshold if change is acceptable
4. Investigate if game is actually frozen (0% difference)

## Test Fixtures

### Wallet Fixtures

Located in `packages/client/tests/e2e/fixtures/wallet-fixtures.ts`:

- **evmTest**: Extended Playwright test with EVM wallet support
- Provides mock wallet for authentication
- Handles Privy wallet connection flow

### Privy Helpers

Located in `packages/client/tests/e2e/fixtures/privy-helpers.ts`:

- **completeFullLoginFlow**: Automates entire login process
- **waitForAppReady**: Waits for app to be interactive
- **waitForGameClient**: Waits for game client initialization

### Test Config

Located in `packages/client/tests/e2e/fixtures/test-config.ts`:

- **BASE_URL**: Default test server URL (http://localhost:3333)
- **TIMEOUT_CONFIG**: Centralized timeout configuration
- **TEST_CREDENTIALS**: Mock credentials for testing

## Common Test Patterns

### Basic Journey Test Structure

```typescript
test('my journey test', async ({ page, wallet }) => {
  // Setup
  page.setDefaultTimeout(120000);
  await waitForAppReady(page, BASE_URL);
  
  // Login
  const loggedIn = await completeFullLoginFlow(page, wallet);
  expect(loggedIn).toBe(true);
  
  // Wait for game
  await waitForGameClient(page, 60_000);
  await waitForLoadingScreenHidden(page, 90_000);
  await waitForPlayerSpawn(page, 60_000);
  
  // Test gameplay
  await simulateMovement(page, 'right', 1000);
  const position = await getPlayerPosition(page);
  
  // Verify
  expect(position).toBeDefined();
});
```

### Screenshot Comparison Pattern

```typescript
// Capture initial state
const before = await takeGameScreenshot(page, 'before-action');

// Perform action
await simulateMovement(page, 'right', 1500);

// Capture after state
const after = await takeGameScreenshot(page, 'after-action');

// Verify visual change
assertScreenshotsDifferent(before, after, 'before-action', 'after-action', 0.01);
```

### Error Capture Pattern

```typescript
// Setup error capture at test start
const { errors } = setupErrorCapture(page);

// ... run test ...

// Check for errors at test end
assertNoConsoleErrors(errors);
```

## Troubleshooting

### Loading Screen Never Hides

If `waitForLoadingScreenHidden` times out:

1. Check if WebGPU is available (`chrome://gpu`)
2. Verify assets are loading (check network tab)
3. Check browser console for errors
4. Increase timeout if server is slow
5. Verify database migrations are up to date

### Player Never Spawns

If `waitForPlayerSpawn` times out:

1. Check WebSocket connection status
2. Verify character was created successfully
3. Check server logs for spawn errors
4. Ensure database has character data
5. Verify world initialization completed

### Screenshots Are Identical (0% Difference)

If screenshots don't change:

1. Verify movement input is being sent (check network tab)
2. Check if player is stuck on collision
3. Verify tick system is running (check server logs)
4. Ensure canvas is focused for keyboard input
5. Try clicking canvas before movement

### WebGPU Not Available in Tests

If tests fail with WebGPU errors:

1. Update to Chrome 113+, Edge 113+, or Safari 18+
2. Check `chrome://gpu` for GPU feature status
3. Update graphics drivers
4. Run tests in headed mode (WebGPU requires window context)
5. Verify Playwright is using correct browser channel

## CI/CD Integration

E2E tests run automatically in CI:

- **GitHub Actions**: `.github/workflows/integration.yml`
- **Headful Mode**: Uses Xvfb for virtual display
- **WebGPU Support**: CI runners have GPU access
- **Screenshot Artifacts**: Saved on test failure
- **Parallel Execution**: Tests run in parallel for speed

### CI Environment Variables

```bash
CI=true                    # Enables CI-specific behavior
DISPLAY=:99                # Xvfb display for headful tests
PLAYWRIGHT_BROWSERS_PATH=0 # Use system browsers
```

## Performance Considerations

### Test Execution Time

- **Full Journey**: ~2-3 minutes per test
- **Screenshot Capture**: ~100-200ms per screenshot
- **Movement Simulation**: ~1-2 seconds per direction
- **Loading Screen**: ~10-30 seconds (varies by hardware)

### Optimization Tips

1. **Reuse Browser Context**: Share context across related tests
2. **Parallel Execution**: Run independent tests in parallel
3. **Skip Redundant Waits**: Don't wait for loading screen if already hidden
4. **Batch Screenshots**: Capture multiple screenshots in one test
5. **Use Production Build**: Faster page loads with `DUEL_USE_PRODUCTION_CLIENT=true`

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development guidelines and testing philosophy
- [AGENTS.md](../AGENTS.md) - AI assistant guidance for testing
- [packages/client/tests/e2e/](../packages/client/tests/e2e/) - E2E test source code
- [Playwright Documentation](https://playwright.dev) - Official Playwright docs
