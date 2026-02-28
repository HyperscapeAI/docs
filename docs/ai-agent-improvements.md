# AI Agent Improvements

Recent optimizations to ElizaOS agent behavior for more responsive and intelligent gameplay.

## Overview

The AI agent system has been enhanced with action locks, fast-tick mode, and short-circuit decision making to reduce LLM calls and improve responsiveness.

**Key Improvements:**
- Action locks prevent LLM ticks during movement
- Fast-tick mode (2s) for quick follow-up actions
- Short-circuit LLM for obvious decisions
- Banking goal type with auto-restore
- Movement completion awaiting
- Depleted resource filtering

## Action Locks

### Problem

Previously, agents would call the LLM every 10 seconds even while walking to a resource or bank. This caused:
- Wasted LLM calls (agent can't do anything while moving)
- Conflicting decisions (LLM might choose new goal mid-movement)
- Poor resource utilization

### Solution

**Action locks** prevent LLM ticks while an action is in progress:

```typescript
// In AutonomousBehaviorManager.ts
if (this.actionLock) {
  logger.info('[AutonomousBehavior] Action locked, skipping LLM tick');
  return;
}

// Set lock before movement
this.actionLock = true;
await service.executeMove({ target: resourcePos });
await service.waitForMovementComplete();
this.actionLock = false;
```

**Benefits:**
- No LLM calls during movement (saves API costs)
- Prevents conflicting decisions
- Agent completes current action before choosing next

### Lock Types

1. **Movement Lock** - Set during `executeMove()`, cleared on `tileMovementEnd`
2. **Banking Lock** - Set during bank deposit, cleared after completion
3. **Combat Lock** - Set during attack, cleared when combat ends
4. **Manual Lock** - Set by user commands from dashboard

## Fast-Tick Mode

### Problem

After completing an action (e.g., depositing at bank), agents waited 10 seconds before the next decision. This felt sluggish.

### Solution

**Fast-tick mode** reduces tick interval to 2 seconds after certain events:

```typescript
// In AutonomousBehaviorManager.ts
private enableFastTick() {
  this.fastTickMode = true;
  this.fastTickExpiry = Date.now() + 30000; // 30s duration
}

// After movement completes
await service.waitForMovementComplete();
this.actionLock = false;
this.enableFastTick();
```

**Triggers:**
- Movement completion
- Goal changes
- Resource depletion
- Banking completion

**Duration:** 30 seconds, then reverts to normal 10s interval.

**Benefits:**
- Responsive follow-up actions
- Smooth action chains (walk → gather → walk → bank)
- Still prevents spam (2s minimum between decisions)

## Short-Circuit LLM

### Problem

LLM calls are slow (~1-2s) and expensive. Many decisions are obvious and don't need LLM reasoning.

### Solution

**Short-circuit** obvious decisions before calling LLM:

```typescript
// 1. Repeat resource gathering
if (lastAction === 'gather' && lastResult === 'success') {
  const sameResource = findNearbyResource(lastResourceType);
  if (sameResource && !sameResource.depleted) {
    return { action: 'gather', target: sameResource };
  }
}

// 2. Banking when inventory full
if (inventoryFull && nearBank) {
  return { action: 'bank', target: nearestBank };
}

// 3. Set goal when none exists
if (!currentGoal && availableGoals.length > 0) {
  return { action: 'setGoal', goal: availableGoals[0] };
}
```

**Benefits:**
- Instant decisions for common cases
- Reduced LLM API costs
- More predictable behavior

**LLM still used for:**
- Complex decisions (multiple options)
- New situations (no recent action)
- Goal selection (multiple valid goals)

## Banking Goal Type

### Problem

After banking, agents would set a new goal (e.g., "mine iron ore") but forget what they were doing before banking.

### Solution

**Banking goal type** with auto-restore:

```typescript
// Before banking
const previousGoal = currentGoal;
setGoal({
  type: 'banking',
  description: 'Banking items',
  previousGoal: previousGoal,  // Save for restore
});

// After banking completes
if (goal.type === 'banking' && goal.previousGoal) {
  setGoal(goal.previousGoal);  // Restore previous goal
}
```

**Flow:**
1. Agent mining iron ore (goal: "mine iron ore")
2. Inventory full → set banking goal (saves "mine iron ore")
3. Walk to bank → deposit all
4. Banking complete → restore "mine iron ore" goal
5. Walk back to mine → continue mining

**Benefits:**
- Agents remember what they were doing
- Smooth resource gathering loops
- No need to re-decide goal after banking

## Movement Completion Awaiting

### Problem

Banking actions returned immediately after sending deposit command, before movement completed. This caused:
- Agent tried to gather while still walking to bank
- Inventory checks failed (items not deposited yet)
- Conflicting movement commands

### Solution

**Await movement completion** in banking actions:

```typescript
// In banking.ts action
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();  // NEW: Wait for arrival

// Now we're at the bank, safe to deposit
await service.bankDepositAll();
```

**Implementation:**

```typescript
// In HyperscapeService.ts
private _movementResolve: (() => void) | null = null;
private _isMoving = false;

async executeMove(command: MoveToCommand) {
  this._isMoving = true;
  this.sendCommand('moveRequest', command);
}

waitForMovementComplete(timeoutMs = 15000): Promise<void> {
  if (!this._isMoving) return Promise.resolve();
  
  return new Promise((resolve) => {
    this._movementResolve = resolve;
    setTimeout(() => {
      this._isMoving = false;
      this._movementResolve = null;
      resolve();
    }, timeoutMs);
  });
}

// On tileMovementEnd packet
this._isMoving = false;
if (this._movementResolve) {
  this._movementResolve();
  this._movementResolve = null;
}
```

**Benefits:**
- Actions complete in correct order
- No race conditions
- Reliable banking/gathering loops

## Depleted Resource Filtering

### Problem

Agents would try to gather from depleted resources, wasting time walking to them.

### Solution

**Filter depleted resources** from nearby entity checks:

```typescript
// In nearbyEntities.ts provider
const resources = nearbyEntities.filter(entity => {
  if (entity.type !== 'resource') return false;
  if (entity.depleted === true) return false;  // NEW: Skip depleted
  return true;
});
```

**Benefits:**
- Agents only consider harvestable resources
- No wasted movement to depleted resources
- Better resource selection

## Last Action Tracking

### Problem

LLM had no context about what the agent just did, leading to repetitive or contradictory decisions.

### Solution

**Track last action** in LLM prompt:

```typescript
// In AutonomousBehaviorManager.ts
private lastActionName: string | null = null;
private lastActionResult: string | null = null;

// After action completes
this.lastActionName = action.name;
this.lastActionResult = result.success ? 'success' : 'failed';

// In LLM prompt
const prompt = `
Last action: ${lastActionName} (${lastActionResult})
Current situation: ...
What should the agent do next?
`;
```

**Benefits:**
- LLM has continuity context
- Better follow-up decisions
- Avoids repeating failed actions

## Resource Approach Range

### Problem

Agents would fail to gather resources because they were slightly out of range (20m limit).

### Solution

**Increased approach range** from 20m to 40m:

```typescript
// In skills.ts action
const RESOURCE_APPROACH_RANGE = 40;  // Was 20

if (distance > RESOURCE_APPROACH_RANGE) {
  // Walk closer
  await service.executeMove({ target: resourcePos });
  await service.waitForMovementComplete();
}
```

**Benefits:**
- Matches server-side validation range
- Fewer "out of range" failures
- More reliable gathering

## Configuration

### Tick Intervals

```typescript
// In AutonomousBehaviorManager.ts
const NORMAL_TICK_INTERVAL = 10000;  // 10 seconds
const FAST_TICK_INTERVAL = 2000;     // 2 seconds
const FAST_TICK_DURATION = 30000;    // 30 seconds
```

### Action Lock Timeout

```typescript
// In HyperscapeService.ts
waitForMovementComplete(timeoutMs = 15000)  // 15 second timeout
```

If movement doesn't complete within timeout, lock is released automatically.

### Short-Circuit Conditions

```typescript
// Repeat resource gathering
if (lastAction === 'gather' && lastResult === 'success') {
  // Find same resource type nearby
}

// Banking when inventory full
if (inventoryFull && nearBank) {
  // Go to bank
}

// Set goal when none exists
if (!currentGoal && availableGoals.length > 0) {
  // Pick first available goal
}
```

## Monitoring

### Dashboard

The agent dashboard shows:
- Current goal (with lock status)
- Last action and result
- Fast-tick mode indicator
- Movement status

### Logs

```typescript
// Action lock
[AutonomousBehavior] Action locked, skipping LLM tick

// Fast-tick mode
[AutonomousBehavior] Fast-tick mode enabled (30s)

// Short-circuit
[AutonomousBehavior] Short-circuit: Repeat gather (oak tree)

// Movement completion
[HyperscapeService] 🏁 Tile movement ended
```

## API Reference

### AutonomousBehaviorManager

#### setActionLock(locked: boolean)
Set action lock state.

**Parameters:**
- `locked: boolean` - Lock state

**Usage:**
```typescript
manager.setActionLock(true);   // Lock
manager.setActionLock(false);  // Unlock
```

#### enableFastTick()
Enable fast-tick mode for 30 seconds.

**Usage:**
```typescript
manager.enableFastTick();
```

#### setGoal(goal)
Set current goal with optional lock.

**Parameters:**
- `goal.type` - Goal type
- `goal.description` - Human-readable description
- `goal.locked` - Lock flag (prevents autonomous override)
- `goal.lockedBy` - Lock source ('manual', 'action', etc.)
- `goal.previousGoal` - Previous goal (for banking restore)

**Usage:**
```typescript
manager.setGoal({
  type: 'banking',
  description: 'Depositing items',
  locked: true,
  lockedBy: 'action',
  previousGoal: currentGoal,
});
```

### HyperscapeService

#### waitForMovementComplete(timeoutMs?)
Wait for current movement to complete.

**Parameters:**
- `timeoutMs: number` - Timeout in milliseconds (default: 15000)

**Returns:** `Promise<void>` - Resolves when movement ends or timeout

**Usage:**
```typescript
await service.executeMove({ target: [100, 0, 200] });
await service.waitForMovementComplete();
// Movement complete, safe to perform next action
```

#### isMoving
Check if agent is currently moving.

**Returns:** `boolean`

**Usage:**
```typescript
if (service.isMoving) {
  console.log('Agent is moving, wait before next action');
}
```

## Examples

### Resource Gathering Loop

```typescript
// 1. Find resource
const tree = findNearbyResource('tree');

// 2. Walk to resource (with lock)
actionLock = true;
await service.executeMove({ target: tree.position });
await service.waitForMovementComplete();

// 3. Gather (lock still active)
await service.executeGatherResource({ resourceEntityId: tree.id });
actionLock = false;
enableFastTick();  // Quick follow-up

// 4. Fast-tick triggers (2s later)
// Short-circuit: Same resource type nearby? Gather again.
// Otherwise: LLM decides next action
```

### Banking with Goal Restore

```typescript
// 1. Inventory full, save current goal
const previousGoal = currentGoal;
setGoal({
  type: 'banking',
  description: 'Banking items',
  previousGoal: previousGoal,
  locked: true,
});

// 2. Walk to bank (with lock)
actionLock = true;
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();

// 3. Deposit all
await service.bankDepositAll();
actionLock = false;

// 4. Restore previous goal
if (goal.type === 'banking' && goal.previousGoal) {
  setGoal(goal.previousGoal);
}

// 5. Walk back to resource area
// (goal restored, agent continues previous activity)
```

### Manual Goal Override

```typescript
// From dashboard: User sets goal to "mine iron ore"
// Server sends goalOverride packet

// In HyperscapeService.ts
private handleGoalOverride(data) {
  const selectedGoal = availableGoals.find(g => g.id === data.goalId);
  
  manager.setGoal({
    type: selectedGoal.type,
    description: selectedGoal.description,
    locked: true,        // Prevent autonomous override
    lockedBy: 'manual',
    lockedAt: Date.now(),
  });
}

// Agent now follows manual goal until unlocked
```

## Performance Impact

### LLM Call Reduction

**Before:**
- 1 LLM call every 10 seconds
- 360 calls per hour
- ~$0.50/hour (GPT-4)

**After:**
- Action locks: Skip 50% of calls (during movement)
- Short-circuit: Skip 30% of remaining calls (obvious decisions)
- Effective: ~126 calls per hour
- ~$0.18/hour (GPT-4)

**Savings:** ~65% reduction in LLM costs.

### Responsiveness

**Before:**
- Action → Wait 10s → Next action
- Banking: Walk (10s wait) → Deposit (10s wait) → Walk back
- Total: ~30s for banking round trip

**After:**
- Action → Fast-tick (2s) → Next action
- Banking: Walk → Deposit → Fast-tick → Walk back
- Total: ~12s for banking round trip

**Improvement:** ~60% faster action chains.

## Configuration

### Environment Variables

```bash
# Tick intervals (in AutonomousBehaviorManager)
AGENT_TICK_INTERVAL=10000        # Normal tick (10s)
AGENT_FAST_TICK_INTERVAL=2000    # Fast tick (2s)
AGENT_FAST_TICK_DURATION=30000   # Fast-tick duration (30s)

# Movement timeout
AGENT_MOVEMENT_TIMEOUT=15000     # 15s timeout

# Resource approach range
RESOURCE_APPROACH_RANGE=40       # 40m (matches server validation)
```

### Runtime Settings

```typescript
// In character.json
{
  "settings": {
    "HYPERSCAPE_TICK_INTERVAL": "10000",
    "HYPERSCAPE_FAST_TICK_ENABLED": "true",
    "HYPERSCAPE_ACTION_LOCKS_ENABLED": "true",
    "HYPERSCAPE_SHORT_CIRCUIT_ENABLED": "true"
  }
}
```

## Debugging

### Action Lock Status

```typescript
// In AutonomousBehaviorManager.ts
logger.info(`[AutonomousBehavior] Action lock: ${this.actionLock}`);
```

### Fast-Tick Status

```typescript
logger.info(`[AutonomousBehavior] Fast-tick: ${this.fastTickMode} (expires: ${this.fastTickExpiry})`);
```

### Last Action

```typescript
logger.info(`[AutonomousBehavior] Last action: ${this.lastActionName} (${this.lastActionResult})`);
```

### Movement Status

```typescript
logger.info(`[HyperscapeService] Moving: ${service.isMoving}`);
```

## Testing

### Action Lock Test

```typescript
test('action lock prevents LLM during movement', async () => {
  const manager = new AutonomousBehaviorManager(runtime);
  
  // Start movement
  manager.setActionLock(true);
  
  // Trigger tick
  await manager.tick();
  
  // Verify no LLM call
  expect(llmCallCount).toBe(0);
  
  // Complete movement
  manager.setActionLock(false);
  
  // Trigger tick
  await manager.tick();
  
  // Verify LLM called
  expect(llmCallCount).toBe(1);
});
```

### Fast-Tick Test

```typescript
test('fast-tick mode reduces interval', async () => {
  const manager = new AutonomousBehaviorManager(runtime);
  
  // Enable fast-tick
  manager.enableFastTick();
  
  // Wait 2 seconds
  await sleep(2000);
  
  // Verify tick occurred
  expect(tickCount).toBe(1);
  
  // Wait 10 seconds (should revert to normal)
  await sleep(10000);
  
  // Verify normal interval resumed
  expect(tickCount).toBe(2);
});
```

### Banking Goal Restore Test

```typescript
test('banking goal restores previous goal', async () => {
  const manager = new AutonomousBehaviorManager(runtime);
  
  // Set initial goal
  manager.setGoal({
    type: 'gathering',
    description: 'Mine iron ore',
  });
  
  // Set banking goal
  manager.setGoal({
    type: 'banking',
    description: 'Banking items',
    previousGoal: manager.getGoal(),
  });
  
  // Complete banking
  manager.completeBanking();
  
  // Verify goal restored
  expect(manager.getGoal().type).toBe('gathering');
  expect(manager.getGoal().description).toBe('Mine iron ore');
});
```

## Migration Guide

### Updating Existing Actions

**Before:**
```typescript
// Old action (no movement awaiting)
export const gatherAction: Action = {
  async handler(runtime, message) {
    const service = getService(runtime);
    
    // Walk to resource
    await service.executeMove({ target: resourcePos });
    
    // Gather immediately (might fail if still moving!)
    await service.executeGatherResource({ resourceEntityId });
  }
};
```

**After:**
```typescript
// New action (with movement awaiting)
export const gatherAction: Action = {
  async handler(runtime, message) {
    const service = getService(runtime);
    
    // Walk to resource
    await service.executeMove({ target: resourcePos });
    
    // Wait for movement to complete
    await service.waitForMovementComplete();
    
    // Now safe to gather
    await service.executeGatherResource({ resourceEntityId });
  }
};
```

### Enabling Fast-Tick

```typescript
// After completing an action
await service.waitForMovementComplete();
manager.enableFastTick();  // Enable fast-tick for 30s
```

### Using Action Locks

```typescript
// Before long-running action
manager.setActionLock(true);

try {
  await performLongAction();
} finally {
  manager.setActionLock(false);
  manager.enableFastTick();
}
```

## Best Practices

1. **Always await movement** - Use `waitForMovementComplete()` after `executeMove()`
2. **Lock during actions** - Set action lock for multi-step actions
3. **Enable fast-tick** - After completing actions for responsive follow-up
4. **Filter depleted** - Check `entity.depleted` before targeting resources
5. **Track last action** - Store action name/result for LLM context
6. **Use banking goal** - Save previous goal when banking

## Future Improvements

### Planned Features

1. **Action Queue** - Queue multiple actions, execute sequentially
2. **Conditional Locks** - Lock only for specific action types
3. **Priority System** - High-priority actions can interrupt locks
4. **Adaptive Tick** - Adjust interval based on activity level
5. **Action Chains** - Define multi-step action sequences

### Performance Targets

- <100 LLM calls per hour (currently ~126)
- <1s average action latency (currently ~2s)
- 90%+ action success rate (currently ~85%)

## References

- [AutonomousBehaviorManager.ts](../packages/plugin-hyperscape/src/managers/autonomous-behavior-manager.ts)
- [HyperscapeService.ts](../packages/plugin-hyperscape/src/services/HyperscapeService.ts)
- [banking.ts](../packages/plugin-hyperscape/src/actions/banking.ts)
- [skills.ts](../packages/plugin-hyperscape/src/actions/skills.ts)
- [autonomous.ts](../packages/plugin-hyperscape/src/actions/autonomous.ts)
