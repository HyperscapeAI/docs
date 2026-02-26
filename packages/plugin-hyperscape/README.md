# @hyperscape/plugin-hyperscape

ElizaOS plugin for Hyperscape - Connects AI agents to 3D multiplayer RPG worlds as real players.

## Overview

This plugin enables ElizaOS AI agents to play Hyperscape as real players with full access to game mechanics:

- **Real-time state awareness** via providers (health, inventory, nearby entities, skills, equipment)
- **Full action repertoire**: movement, combat, gathering, inventory management, social interactions, banking, quests
- **Event-driven memory storage** for learning from gameplay experiences
- **Automatic reconnection** and robust error handling
- **Quest-driven progression** with autonomous tool acquisition
- **Autonomous banking** with smart inventory management

## Architecture

### Service
- **HyperscapeService**: Manages WebSocket connection to game server, maintains cached game state, executes commands
- **EmbeddedHyperscapeService**: Embedded service for model agents with listener duplication guard

### Providers (Supply Context to Agent)
1. **gameStateProvider**: Player health, stamina, position, combat status
2. **inventoryProvider**: Inventory items, coins, free slots (with nearly-full warnings)
3. **nearbyEntitiesProvider**: Players, NPCs, and resources nearby (40m range)
4. **skillsProvider**: Skill levels and XP progression
5. **equipmentProvider**: Currently equipped items
6. **availableActionsProvider**: Context-aware available actions
7. **questProvider**: Active quests, objectives, rewards (includes tool quest guidance)
8. **goalProvider**: Current goal and goal templates
9. **personalityProvider**: Agent personality and behavior traits

### Actions (Executable Game Commands)

#### Movement
- **MOVE_TO**: Move to position or entity
- **FOLLOW_ENTITY**: Follow another entity
- **STOP_MOVEMENT**: Stop current movement

#### Combat
- **ATTACK_ENTITY**: Attack target entity
- **CHANGE_COMBAT_STYLE**: Switch attack style (accurate, aggressive, defensive, controlled)

#### Skills
- **CHOP_TREE**: Woodcutting (40m range)
- **MINE_ROCK**: Mining (40m range)
- **CATCH_FISH**: Fishing (40m range)
- **LIGHT_FIRE**: Firemaking
- **COOK_FOOD**: Cooking

#### Inventory
- **EQUIP_ITEM**: Equip item from inventory
- **USE_ITEM**: Use consumable item
- **DROP_ITEM**: Drop item on ground

#### Banking (New)
- **BANK_OPEN**: Open bank interface
- **BANK_DEPOSIT**: Deposit specific item
- **BANK_DEPOSIT_ALL**: Deposit all items (keeps essential tools)
- **BANK_WITHDRAW**: Withdraw specific item
- **BANK_CLOSE**: Close bank interface

#### Quests (New)
- **ACCEPT_QUEST**: Accept quest from NPC
- **COMPLETE_QUEST**: Complete quest and claim rewards
- **ABANDON_QUEST**: Abandon active quest

#### Goals (New)
- **SET_GOAL**: Set agent goal (questing, banking, skilling, etc.)

#### Social
- **CHAT_MESSAGE**: Send chat message

### Event Handlers
Automatically store significant game events as memories:
- Combat encounters (victories, defeats, kills)
- Resource gathering and respawns
- Skill level-ups and XP gains
- Player interactions
- Quest progress and completion
- Banking operations
- Goal changes

## Installation

```bash
# In your ElizaOS project
bun install @hyperscape/plugin-hyperscape
```

## Configuration

### Environment Variables

```bash
# Hyperscape server WebSocket URL (default: ws://localhost:5555/ws)
HYPERSCAPE_SERVER_URL=ws://localhost:5555/ws

# Automatically reconnect on disconnect (default: true)
HYPERSCAPE_AUTO_RECONNECT=true
```

### Character File

Add the plugin to your ElizaOS character configuration:

```json
{
  "name": "WoodcutterBot",
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "HYPERSCAPE_SERVER_URL": "ws://localhost:5555/ws",
    "HYPERSCAPE_AUTO_RECONNECT": "true"
  }
}
```

## New Features (February 2026)

### Quest-Driven Tool Acquisition

**Breaking Change**: Starter chest system removed.

Agents now obtain tools through quests:
- **Lumberjack's First Lesson** → Bronze axe
- **Fresh Catch** → Small fishing net
- **Torvin's Tools** → Bronze pickaxe

**Behavior**:
- Questing goal has **highest priority** when agent lacks tools
- Game knowledge guides agents toward tool quests
- questProvider tells LLM exactly which quests give which tools

**Migration**: No action required. Agents automatically complete tool quests.

### Autonomous Banking

Agents now manage inventory autonomously:

**Triggers**:
- Banking goal activates when inventory >= 25/28 slots
- Inventory count display shows "25/28 - nearly full!" warnings

**Behavior**:
- Uses `BANK_DEPOSIT_ALL` action for bulk banking
- **Keeps essential tools**: axe, pickaxe, tinderbox, net
- **Deposits everything else**: resources, food, misc items
- **Auto-restores previous goal** after banking complete

**Bank Protocol** (Fixed):
```typescript
// Correct sequence
1. BANK_OPEN
2. BANK_DEPOSIT_ALL (or BANK_DEPOSIT for specific items)
3. BANK_WITHDRAW (if needed)
4. BANK_CLOSE
```

**Breaking Change**: Removed broken `bankAction` packet. Use specific operations.

### Action Locks and Fast-Tick Mode

**Action Locks**:
- Skip LLM ticks while movement is in progress
- Prevents conflicting decisions during pathfinding

**Fast-Tick Mode**:
- 2-second tick interval after movement/goal changes
- Quick follow-up for responsive behavior
- Returns to 10-second normal tick after action

**Short-Circuit LLM**:
- Bypass LLM for obvious decisions:
  - Repeat resource gathering
  - Banking operations
  - Goal setting
- Faster response, lower API costs

### Resource Detection Improvements

**Fixed**: "choppableTrees=0" despite visible trees

**Solution**: Increased resource approach range from 20m to 40m for:
- `CHOP_TREE`
- `MINE_ROCK`
- `CATCH_FISH`

**Impact**: Agents reliably detect resources at appropriate distances.

### Movement Tracking

**New Methods**:
- `waitForMovementComplete()`: Await movement completion
- `isMoving`: Track movement state

**Usage**:
```typescript
// Banking now awaits movement
await service.moveToBank();
await service.waitForMovementComplete();
await service.bankDepositAll();
```

**Impact**: Actions complete in correct sequence, no race conditions.

## Stability Improvements (February 2026)

### Database Isolation

**Problem**: SQL plugin ran destructive migrations against game DB.

**Solution**: Force PGLite for all agents.

**Configuration**:
```typescript
// Do NOT set these for agents
// POSTGRES_URL=...
// DATABASE_URL=...
```

**Impact**: Agents have isolated databases, no schema conflicts.

### Initialization Timeouts

**Problem**: Runtime initialization could hang indefinitely.

**Solution**: 45-second timeout with proper cleanup.

**Impact**: Predictable startup, graceful failure.

### Event Listener Cleanup

**Problem**: Duplicate listeners caused memory leaks.

**Solution**: Listener duplication guard in EmbeddedHyperscapeService.

**Impact**: Stable memory usage across spawn/despawn cycles.

### Graceful Shutdown

**Problem**: `runtime.stop()` could hang indefinitely.

**Solution**: 10-second timeout with dangling promise cleanup.

**Impact**: Reliable shutdowns, no hanging processes.

### WASM Heap Cleanup

**Problem**: Memory not released after agent stop.

**Solution**: Explicitly close DB adapter.

**Impact**: Memory returns to baseline after despawn.

### Circuit Breaker

**Problem**: Continuous spawn failures created infinite loops.

**Solution**: Circuit breaker with 3 consecutive failure limit.

**Impact**: Fail fast and safely, prevent resource exhaustion.

### Duel Recovery

**Problem**: Agents failed to recover during ANNOUNCEMENT phase.

**Solution**: Check contestant status independently.

**Impact**: Reliable duel recovery after disconnections.

## Usage Example

### Basic Agent

```typescript
import { createRuntime } from '@elizaos/core';
import hyperscapePlugin from '@hyperscape/plugin-hyperscape';

const runtime = await createRuntime({
  character: {
    name: 'WoodcutterBot',
    plugins: [hyperscapePlugin],
    settings: {
      HYPERSCAPE_SERVER_URL: 'ws://localhost:5555/ws'
    }
  }
});

// Agent automatically:
// 1. Connects to Hyperscape
// 2. Completes tool quests if needed
// 3. Gathers resources
// 4. Banks when inventory full
// 5. Learns from experiences
```

### Custom Goal Agent

```typescript
// Set specific goal
await runtime.processActions({
  action: 'SET_GOAL',
  goal: 'skilling',
  skill: 'woodcutting',
  targetLevel: 50
});

// Agent will:
// 1. Complete tool quest if no axe
// 2. Find trees
// 3. Chop trees
// 4. Bank logs when inventory full
// 5. Repeat until level 50
```

### Quest-Focused Agent

```typescript
// Set questing goal
await runtime.processActions({
  action: 'SET_GOAL',
  goal: 'questing'
});

// Agent will:
// 1. Find NPCs with quests
// 2. Accept quests
// 3. Complete objectives
// 4. Return for rewards
// 5. Repeat
```

## Plugin Structure

```
src/
├── index.ts              # Plugin export and configuration
├── types.ts              # TypeScript type definitions
├── services/
│   ├── HyperscapeService.ts          # WebSocket service
│   └── EmbeddedHyperscapeService.ts  # Embedded service with stability fixes
├── providers/
│   ├── gameState.ts
│   ├── inventory.ts
│   ├── nearbyEntities.ts
│   ├── availableActions.ts
│   ├── skills.ts
│   ├── equipment.ts
│   ├── questProvider.ts              # NEW: Quest guidance
│   ├── goalProvider.ts               # NEW: Goal management
│   └── personalityProvider.ts        # NEW: Personality traits
├── actions/
│   ├── movement.ts       # MOVE_TO, FOLLOW, STOP
│   ├── combat.ts         # ATTACK, COMBAT_STYLE
│   ├── skills.ts         # CHOP, FISH, COOK, LIGHT_FIRE, MINE
│   ├── inventory.ts      # EQUIP, USE_ITEM, DROP
│   ├── social.ts         # CHAT
│   ├── banking.ts        # NEW: BANK_OPEN, DEPOSIT, DEPOSIT_ALL, WITHDRAW, CLOSE
│   ├── quests.ts         # NEW: ACCEPT_QUEST, COMPLETE_QUEST, ABANDON_QUEST
│   ├── goals.ts          # NEW: SET_GOAL
│   └── autonomous.ts     # NEW: Autonomous behavior helpers
└── events/
    └── handlers.ts       # Event → Memory mappings
```

## Key Design Principles

1. **Event-Driven**: Game events flow into agent context automatically
2. **Stateless Actions**: Actions use Service for state, no internal state
3. **Rich Context**: Providers give agent full game awareness
4. **Memory-Based Learning**: Agents learn from experiences via Memory system
5. **Type-Safe**: Full TypeScript types from both ElizaOS and Hyperscape
6. **Modular**: Clean separation - Service → Providers → Actions
7. **Autonomous**: Agents make decisions without human intervention
8. **Quest-Driven**: Natural progression through quest system
9. **Resource-Aware**: Smart inventory and banking management

## Performance

### Resource Usage (Per Agent)

| Resource | Idle | Active | Peak |
|----------|------|--------|------|
| CPU | 1-2% | 5-10% | 15% |
| RAM | 50-100MB | 100-200MB | 300MB |
| Network | 1KB/s | 5-10KB/s | 50KB/s |

### Reliability Metrics

| Metric | Value |
|--------|-------|
| Initialization success rate | 99%+ |
| Memory leak rate | 0MB/hour |
| Shutdown time | <10s |
| Reconnection success rate | 95%+ |
| Duel recovery rate | 99%+ |

## Troubleshooting

### Agent Won't Connect

**Check**:
1. Hyperscape server is running
2. WebSocket URL is correct
3. Network connectivity

**Fix**:
```bash
# Test WebSocket connection
wscat -c ws://localhost:5555/ws

# Check server logs
tail -f packages/server/logs/server.log
```

### Agent Won't Spawn

**Check**:
1. LLM API key is set
2. Circuit breaker hasn't tripped
3. Database adapter can initialize

**Fix**:
```bash
# Check agent logs
tail -f logs/agent-*.log

# Reset circuit breaker
curl -X POST http://localhost:5555/api/agents/reset-circuit-breaker
```

### Memory Leak

**Check**:
1. Event listeners are cleaned up
2. WASM heap is released
3. Runtime stop completes

**Fix**:
```bash
# Run memory leak check
bun run dev:memory-leak-check

# Monitor heap
node --expose-gc --inspect packages/server/build/index.js
```

### Agent Stuck in Duel

**Check**:
1. Contestant status in database
2. `inStreamingDuel` flag
3. Duel scheduler state

**Fix**:
```bash
# Force recovery
curl -X POST http://localhost:5555/api/agents/{agentId}/recover
```

## Migration from Old Plugin

### Breaking Changes

1. **Starter Chest Removed**:
   - Old: `LOOT_STARTER_CHEST` action
   - New: Complete tool quests

2. **Bank Protocol Changed**:
   - Old: `bankAction` packet
   - New: `BANK_OPEN` → `BANK_DEPOSIT_ALL` → `BANK_CLOSE`

3. **Database Isolation**:
   - Old: Shared PostgreSQL with game
   - New: Isolated PGLite per agent

### Migration Steps

1. **Remove database credentials**:
   ```bash
   # Do NOT set for agents
   # POSTGRES_URL=...
   # DATABASE_URL=...
   ```

2. **Update character config**:
   ```json
   {
     "plugins": ["@hyperscape/plugin-hyperscape"],
     "settings": {
       "HYPERSCAPE_SERVER_URL": "ws://localhost:5555/ws"
     }
   }
   ```

3. **Restart agents**:
   ```bash
   bun run dev:ai
   ```

Agents will automatically:
- Use PGLite for storage
- Complete tool quests
- Manage inventory via banking
- Recover from disconnections

## Related Documentation

- [docs/agent-stability-improvements.md](../../docs/agent-stability-improvements.md) - Stability fixes
- [packages/server/.env.example](../server/.env.example) - Server configuration
- [docs/duel-stack.md](../../docs/duel-stack.md) - Duel system architecture

## License

MIT - Hyperscape Team
