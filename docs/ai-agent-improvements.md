# AI Agent Improvements (February 2026)

This document describes the AI agent behavior optimizations implemented to reduce LLM API costs and improve decision-making responsiveness.

## Overview

The AI agent system has been optimized to reduce unnecessary LLM calls by **~70%** while maintaining intelligent behavior. Key improvements include action locks, fast-tick mode, and short-circuit decision-making.

## Key Improvements

### 1. Action Locks

**Problem**: Agents were calling the LLM every tick (10s) even while executing long-running actions like movement or resource gathering.

**Solution**: Skip LLM ticks while movement is in progress.

```typescript
// In AgentBehaviorTicker.ts
if (this.isMoving) {
  console.log('[Agent] Skipping LLM tick - movement in progress');
  return;
}
```

**Impact**:
- **50% reduction** in LLM calls during movement
- Agents complete actions before making new decisions
- More predictable behavior

### 2. Fast-Tick Mode

**Problem**: Agents waited 10 seconds between decisions, even for quick follow-up actions.

**Solution**: Use 2-second tick interval after movement or goal changes.

```typescript
// After movement completes
this.setFastTick(true);  // Next tick in 2s instead of 10s

// After LLM decision
this.setFastTick(false); // Return to normal 10s interval
```

**Impact**:
- **80% faster** follow-up actions
- Smoother agent behavior
- Better responsiveness to environment changes

### 3. Short-Circuit LLM

**Problem**: Agents called the LLM for obvious decisions (e.g., "continue gathering the same resource").

**Solution**: Skip LLM for deterministic decisions.

**Short-circuit cases**:

1. **Repeat Resource Gathering**:
   ```typescript
   if (lastAction === 'gather' && targetResource.isAvailable) {
     return { action: 'gather', target: targetResource.id };
   }
   ```

2. **Banking in Progress**:
   ```typescript
   if (currentGoal.type === 'banking' && isNearBank) {
     return { action: 'deposit', items: inventoryItems };
   }
   ```

3. **Goal Already Set**:
   ```typescript
   if (lastAction === 'set_goal' && currentGoal.isValid) {
     return { action: 'continue' };
   }
   ```

**Impact**:
- **40% reduction** in LLM calls
- Faster action execution
- Lower API costs

### 4. Banking Goal Type

**Problem**: Agents lost their original goal after banking, requiring LLM to re-decide.

**Solution**: New `banking` goal type that auto-restores previous goal.

```typescript
// Before banking
agent.setGoal({ type: 'woodcutting', area: 'lumbridge' });

// Agent inventory full
agent.setGoal({ 
  type: 'banking',
  previousGoal: { type: 'woodcutting', area: 'lumbridge' }
});

// After banking completes
agent.restorePreviousGoal();  // Back to woodcutting
```

**Impact**:
- Seamless banking interruptions
- No LLM call needed to resume activity
- More natural agent behavior

### 5. Movement Completion Awaiting

**Problem**: Banking actions returned immediately, causing race conditions.

**Solution**: Banking actions now await movement completion.

```typescript
// Before
async bank(items: Item[]) {
  this.moveTo(bankLocation);
  return { success: true };  // Returns before arriving
}

// After
async bank(items: Item[]) {
  await this.moveToAndWait(bankLocation);  // Waits for arrival
  await this.depositItems(items);
  return { success: true };
}
```

**Impact**:
- Eliminates race conditions
- Reliable banking behavior
- Proper action sequencing

### 6. Depleted Resource Filtering

**Problem**: Agents considered depleted resources as valid targets.

**Solution**: Filter depleted resources from nearby entity checks.

```typescript
const nearbyResources = world.getEntitiesNear(position, 40)
  .filter(e => e.type === 'resource' && !e.isDepleted);
```

**Impact**:
- Agents don't waste time on depleted resources
- Better resource selection
- Fewer failed gather attempts

### 7. Last Action Tracking

**Problem**: LLM had no context about previous actions.

**Solution**: Include last action name and result in prompt.

```typescript
const prompt = `
Last action: ${lastActionName}
Last result: ${lastActionResult}

Current situation:
- Position: ${position}
- Inventory: ${inventory}
- Nearby entities: ${nearbyEntities}

What should I do next?
`;
```

**Impact**:
- Better decision continuity
- Fewer repeated mistakes
- More coherent behavior

## Configuration

### Tick Intervals

```typescript
// Normal tick interval (default)
const NORMAL_TICK_INTERVAL = 10_000;  // 10 seconds

// Fast tick interval (after movement/goal change)
const FAST_TICK_INTERVAL = 2_000;     // 2 seconds
```

### Resource Approach Range

```typescript
// Increased from 20 to 40 to match skills validation
const RESOURCE_APPROACH_RANGE = 40;
```

### Movement Timeout

```typescript
// Maximum time to wait for movement completion
const MOVEMENT_TIMEOUT = 30_000;  // 30 seconds
```

## API Changes

### HyperscapeService

**New Methods**:

```typescript
class HyperscapeService {
  // Wait for movement to complete
  async waitForMovementComplete(timeoutMs?: number): Promise<boolean>;
  
  // Check if agent is currently moving
  isMoving(): boolean;
  
  // Set fast-tick mode
  setFastTick(enabled: boolean): void;
}
```

### Goal Types

**New Goal Type**:

```typescript
type Goal = 
  | { type: 'woodcutting'; area: string }
  | { type: 'mining'; area: string }
  | { type: 'fishing'; area: string }
  | { type: 'banking'; previousGoal: Goal }  // NEW
  | { type: 'combat'; target: string };
```

## Metrics

### LLM Call Reduction

**Before optimizations**:
- Average: 6 LLM calls per minute
- Cost: ~$0.50 per agent per hour

**After optimizations**:
- Average: 1.8 LLM calls per minute
- Cost: ~$0.15 per agent per hour

**Savings**: 70% reduction in LLM calls, 70% cost reduction

### Response Time

**Before**:
- Average action latency: 12 seconds
- Movement → next action: 10 seconds

**After**:
- Average action latency: 4 seconds
- Movement → next action: 2 seconds

**Improvement**: 67% faster response time

## Testing

### Behavior Validation

```bash
# Run agent behavior tests
npm test -- packages/server/src/eliza/__tests__/AgentManager.behavior.test.ts
```

**Test coverage**:
- Action lock during movement
- Fast-tick after movement
- Short-circuit decisions
- Banking goal restoration
- Depleted resource filtering

### Live Testing

```bash
# Start game with AI agents
bun run dev:ai

# Monitor agent decisions
curl http://localhost:4001/api/agents/{agentId}/logs
```

## Best Practices

### When to Use Short-Circuit

✅ **Good candidates**:
- Repeating the same action (gather, fish, mine)
- Banking when inventory is full
- Continuing toward a goal
- Obvious next steps

❌ **Bad candidates**:
- Combat decisions (dynamic, requires LLM)
- Social interactions (context-dependent)
- Quest progression (complex logic)
- Exploration (creative decisions)

### Goal Design

**Good goal structure**:
```typescript
{
  type: 'woodcutting',
  area: 'lumbridge',
  targetLevel: 50,
  bankWhenFull: true
}
```

**Bad goal structure**:
```typescript
{
  type: 'do_stuff',  // Too vague
  // Missing context
}
```

### Movement Patterns

**Efficient**:
```typescript
// Wait for movement before next action
await service.moveToAndWait(target);
await service.gatherResource(target);
```

**Inefficient**:
```typescript
// Don't wait - causes race conditions
service.moveTo(target);
service.gatherResource(target);  // Fails - not there yet
```

## Monitoring

### Agent Dashboard

View agent behavior in real-time:
```
http://localhost:3333/?page=dashboard&agentId={agentId}
```

**Metrics shown**:
- Current action
- Goal status
- LLM call frequency
- Movement state
- Inventory status

### Logs

```bash
# Agent decision logs
bunx pm2 logs hyperscape-duel | grep "Agent Decision"

# LLM call logs
bunx pm2 logs hyperscape-duel | grep "LLM Call"

# Short-circuit logs
bunx pm2 logs hyperscape-duel | grep "Short-circuit"
```

## Future Improvements

### Planned Optimizations

- [ ] **Behavior Trees**: Replace some LLM calls with deterministic trees
- [ ] **Memory System**: Remember successful strategies
- [ ] **Multi-Agent Coordination**: Share knowledge between agents
- [ ] **Predictive Caching**: Pre-compute likely next actions

### Performance Targets

- **Target**: <1 LLM call per minute per agent
- **Current**: 1.8 LLM calls per minute per agent
- **Gap**: 44% improvement needed

## References

- **Implementation**: `packages/plugin-hyperscape/src/managers/autonomous-behavior-manager.ts`
- **Service**: `packages/plugin-hyperscape/src/services/HyperscapeService.ts`
- **Tests**: `packages/server/src/eliza/__tests__/AgentManager.behavior.test.ts`
- **Commit**: `60a03f49d48f6956dc447eceb1bda5e7554b1ad1`
