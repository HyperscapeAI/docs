# Agent Movement API

Documentation for the movement completion tracking API added to HyperscapeService.

## Overview

The HyperscapeService now provides movement completion tracking, allowing actions to wait for movement to finish before proceeding. This is critical for multi-step actions like banking (walk to bank → deposit items).

## API Reference

### `waitForMovementComplete(timeoutMs?: number): Promise<void>`

Wait for the current movement to complete. Resolves immediately if not moving.

**Parameters**:
- `timeoutMs` (optional): Maximum time to wait in milliseconds (default: 15000)

**Returns**: Promise that resolves when movement completes or timeout expires

**Example**:
```typescript
// Walk to bank
await service.executeMove({ target: bankPosition, runMode: false });

// Wait for movement to complete before depositing
await service.waitForMovementComplete();

// Now we're at the bank, safe to deposit
await service.bankDeposit('logs', 10);
```

### `isMoving: boolean`

Read-only property indicating if the character is currently moving.

**Example**:
```typescript
if (service.isMoving) {
  console.log('Character is moving, waiting...');
  await service.waitForMovementComplete();
}
```

## Implementation Details

### Movement State Tracking

The service tracks movement state using two internal properties:

- `_isMoving`: Boolean flag set when `executeMove()` is called
- `_movementResolve`: Promise resolver called when `tileMovementEnd` packet received

### Packet Flow

1. **Movement Start**:
   ```typescript
   service.executeMove({ target: [x, y, z], runMode: false });
   // Sets _isMoving = true
   // Sends moveRequest packet to server
   ```

2. **Server Processing**:
   - Server validates movement
   - Sends `tileMovementStart` packet
   - Sends `entityTileUpdate` packets during movement
   - Sends `tileMovementEnd` packet when complete

3. **Movement Complete**:
   ```typescript
   // tileMovementEnd packet received
   // Sets _isMoving = false
   // Calls _movementResolve() to resolve waiting promises
   ```

### Timeout Handling

If movement doesn't complete within the timeout period:
- Promise resolves anyway (doesn't reject)
- `_isMoving` flag is cleared
- Prevents actions from hanging indefinitely

## Use Cases

### Banking Actions

Banking requires the character to be at the bank before depositing:

```typescript
// Old way (broken - deposits before arriving)
await service.executeMove({ target: bankPosition });
await service.bankDeposit('logs', 10);  // ❌ Executes immediately

// New way (correct - waits for arrival)
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();  // ✅ Waits for movement
await service.bankDeposit('logs', 10);    // ✅ Executes after arrival
```

### Resource Gathering

Approach a resource before gathering:

```typescript
// Walk to tree
await service.executeMove({ target: treePosition });
await service.waitForMovementComplete();

// Now we're in range, start chopping
await service.executeGatherResource({ resourceEntityId: treeId });
```

### Combat Positioning

Move into attack range before attacking:

```typescript
// Move to attack range
await service.executeMove({ target: mobPosition });
await service.waitForMovementComplete();

// Now we're in range, attack
await service.executeAttack({ targetEntityId: mobId });
```

## Action Lock Integration

The movement API integrates with the action lock system to prevent LLM ticks during movement:

```typescript
// Action sets a locked goal
behaviorManager.setGoal({
  type: 'banking',
  description: 'Banking items',
  locked: true,
  lockedBy: 'banking_action',
});

// Execute movement
await service.executeMove({ target: bankPosition });

// Wait for movement (LLM ticks are skipped while moving)
await service.waitForMovementComplete();

// Movement complete, perform banking
await service.bankDepositAll();

// Clear lock to resume autonomous behavior
behaviorManager.clearGoal();
```

## Fast-Tick Mode

After movement completes, the autonomous behavior manager enters "fast-tick mode" for 2 seconds:

- Normal tick interval: 10 seconds
- Fast-tick interval: 2 seconds
- Triggered by: Movement completion, goal changes

This allows quick follow-up actions without waiting for the full tick interval.

## Migration Guide

### Before (Broken)

```typescript
// Banking action (old)
async function bankItems(service: HyperscapeService) {
  const bank = findNearestBank();
  await service.executeMove({ target: bank.position });
  await service.bankDepositAll();  // ❌ Executes before arrival
  return { success: true };
}
```

### After (Fixed)

```typescript
// Banking action (new)
async function bankItems(service: HyperscapeService) {
  const bank = findNearestBank();
  await service.executeMove({ target: bank.position });
  await service.waitForMovementComplete();  // ✅ Wait for arrival
  await service.bankDepositAll();
  return { success: true };
}
```

## Related Changes

This API was added as part of the agent stability improvements (PR #945):

- **Action locks**: Skip LLM ticks during movement
- **Fast-tick mode**: 2s interval after movement/goal changes
- **Short-circuit LLM**: Obvious decisions bypass LLM
- **Banking protocol**: Proper sequence with movement awaiting

See [docs/agent-stability-improvements.md](agent-stability-improvements.md) for full details.

## See Also

- [packages/plugin-hyperscape/src/services/HyperscapeService.ts](../packages/plugin-hyperscape/src/services/HyperscapeService.ts) - Implementation
- [packages/plugin-hyperscape/src/actions/banking.ts](../packages/plugin-hyperscape/src/actions/banking.ts) - Banking action example
- [docs/agent-stability-improvements.md](agent-stability-improvements.md) - Agent stability fixes
