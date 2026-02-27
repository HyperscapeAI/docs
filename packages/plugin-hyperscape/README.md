# @hyperscape/plugin-hyperscape

ElizaOS plugin for Hyperscape - Connects AI agents to 3D multiplayer RPG worlds as real players.

## Overview

This plugin enables ElizaOS AI agents to play Hyperscape as real players with full access to game mechanics:

- **Real-time state awareness** via providers (health, inventory, nearby entities, skills, equipment)
- **Full action repertoire**: movement, combat, gathering, inventory management, social interactions
- **Event-driven memory storage** for learning from gameplay experiences
- **Automatic reconnection** and robust error handling
- **Movement completion tracking** for multi-step actions

## Architecture

### Service
- **HyperscapeService**: Manages WebSocket connection to game server, maintains cached game state, executes commands

### Providers (Supply Context to Agent)
1. **gameStateProvider**: Player health, stamina, position, combat status
2. **inventoryProvider**: Inventory items, coins, free slots
3. **nearbyEntitiesProvider**: Players, NPCs, and resources nearby
4. **skillsProvider**: Skill levels and XP progression
5. **equipmentProvider**: Currently equipped items
6. **availableActionsProvider**: Context-aware available actions

### Actions (Executable Game Commands)
- **Movement**: MOVE_TO, FOLLOW_ENTITY, STOP_MOVEMENT
- **Combat**: ATTACK_ENTITY, CHANGE_COMBAT_STYLE
- **Skills**: CHOP_TREE, CATCH_FISH, LIGHT_FIRE, COOK_FOOD
- **Inventory**: EQUIP_ITEM, USE_ITEM, DROP_ITEM, PICKUP_ITEM
- **Social**: CHAT_MESSAGE
- **Banking**: BANK_DEPOSIT, BANK_WITHDRAW, BANK_DEPOSIT_ALL

### Event Handlers
Automatically store significant game events as memories:
- Combat encounters (victories, defeats, kills)
- Resource gathering and respawns
- Skill level-ups and XP gains
- Player interactions

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

# Authentication (optional - can use wallet-based auth)
HYPERSCAPE_AUTH_TOKEN=your-jwt-token
HYPERSCAPE_CHARACTER_ID=your-character-id
HYPERSCAPE_PRIVY_USER_ID=your-privy-user-id
```

### Character File

Add the plugin to your ElizaOS character configuration:

```json
{
  "name": "WoodcutterBot",
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "HYPERSCAPE_SERVER_URL": "ws://localhost:5555/ws",
    "HYPERSCAPE_AUTO_RECONNECT": "true",
    "secrets": {
      "HYPERSCAPE_CHARACTER_ID": "your-character-id",
      "HYPERSCAPE_AUTH_TOKEN": "your-jwt-token"
    }
  }
}
```

## Usage Example

Once configured, the agent will:

1. **Connect** to Hyperscape server on startup
2. **Receive context** from providers every decision cycle
3. **Execute actions** based on LLM decisions
4. **Store memories** of important game events
5. **Learn** from past experiences via semantic memory search

### Example Agent Behavior

```typescript
// Agent receives provider context:
// - "You have 75/100 HP and are at position [10, 5, 20]"
// - "Nearby: Oak Tree at [12, 5, 18]"
// - "Inventory: Bronze Axe, 15 free slots"
// - "Available: CHOP_TREE, MOVE_TO, CHAT"

// Agent decides and executes action:
await runtime.processActions({
  action: 'CHOP_TREE',
  target: 'Oak Tree'
});

// Event occurs:
// RESOURCE_GATHERED → Stored as memory:
// "Gathered Oak Logs at [12, 5, 18], gained 25 woodcutting XP"

// Later, agent can search memories:
// "Where did I last chop trees?"
// → Semantic search returns location [12, 5, 18]
```

## Movement API

### `waitForMovementComplete(timeoutMs?: number): Promise<void>`

Wait for the current movement to complete. Critical for multi-step actions.

**Parameters**:
- `timeoutMs` (optional): Maximum time to wait in milliseconds (default: 15000)

**Example - Banking**:
```typescript
// Walk to bank
await service.executeMove({ target: bankPosition, runMode: false });

// Wait for movement to complete
await service.waitForMovementComplete();

// Now we're at the bank, safe to deposit
await service.bankDepositAll();
```

**Example - Resource Gathering**:
```typescript
// Walk to tree
await service.executeMove({ target: treePosition });
await service.waitForMovementComplete();

// Now we're in range, start chopping
await service.executeGatherResource({ resourceEntityId: treeId });
```

### `isMoving: boolean`

Read-only property indicating if the character is currently moving.

```typescript
if (service.isMoving) {
  console.log('Character is moving, waiting...');
  await service.waitForMovementComplete();
}
```

## Memory System Integration

The plugin stores these event types as memories:

- **Combat Memories**: Opponents, outcomes, damage dealt/taken
- **Resource Memories**: Locations, types, XP gained
- **Skill Memories**: Level-ups, progression milestones
- **Social Memories**: Player interactions, messages

Memories are tagged for semantic search:
- Tags: `['hyperscape', 'combat', 'victory']`
- Tags: `['hyperscape', 'resource', 'woodcutting', 'gathered']`
- Tags: `['hyperscape', 'skill', 'levelup', 'fishing']`

## Development

```bash
# Build the plugin
bun run build

# Watch mode for development
bun run dev

# Run tests
bun run test
```

## Plugin Structure

```
src/
├── index.ts              # Plugin export and configuration
├── types.ts              # TypeScript type definitions
├── services/
│   └── HyperscapeService.ts
├── providers/
│   ├── gameState.ts
│   ├── inventory.ts
│   ├── nearbyEntities.ts
│   ├── availableActions.ts
│   ├── skills.ts
│   └── equipment.ts
├── actions/
│   ├── movement.ts       # MOVE_TO, FOLLOW, STOP
│   ├── combat.ts         # ATTACK, COMBAT_STYLE
│   ├── skills.ts         # CHOP, FISH, COOK, LIGHT_FIRE
│   ├── inventory.ts      # EQUIP, USE_ITEM, DROP, PICKUP
│   ├── social.ts         # CHAT
│   └── banking.ts        # DEPOSIT, WITHDRAW, DEPOSIT_ALL
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
7. **Movement Awaiting**: Actions can wait for movement completion before proceeding

## Action Lock System

The plugin includes an action lock system to prevent LLM interference during multi-step actions:

```typescript
// Set a locked goal to prevent autonomous behavior
behaviorManager.setGoal({
  type: 'banking',
  description: 'Banking items',
  locked: true,
  lockedBy: 'banking_action',
});

// Execute multi-step action
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();
await service.bankDepositAll();

// Clear lock to resume autonomous behavior
behaviorManager.clearGoal();
```

**Features**:
- Skip LLM ticks during movement
- Fast-tick mode (2s) after movement/goal changes
- Short-circuit LLM for obvious decisions (repeat resource, banking)

## Differences from Old Plugin

The previous `@elizaos/plugin-hyperscape` was broken. This new implementation:

✅ Follows ElizaOS plugin architecture standards
✅ Properly implements Service, Provider, Action, Event patterns
✅ Uses WebSocket for real-time communication
✅ Stores events as memories for learning
✅ Provides complete game context via providers
✅ Handles reconnection and errors gracefully
✅ Fully typed with TypeScript
✅ Movement completion tracking for multi-step actions
✅ Action lock system to prevent LLM interference

## See Also

- [docs/agent-movement-api.md](../../docs/agent-movement-api.md) - Movement API documentation
- [docs/agent-stability-improvements.md](../../docs/agent-stability-improvements.md) - Agent stability fixes
- [packages/plugin-hyperscape/src/services/HyperscapeService.ts](src/services/HyperscapeService.ts) - Service implementation

## License

MIT - Hyperscape Team
