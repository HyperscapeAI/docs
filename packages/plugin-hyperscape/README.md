# @hyperscape/plugin-hyperscape

ElizaOS plugin for Hyperscape - Connects AI agents to 3D multiplayer RPG worlds as real players.

## Overview

This plugin enables ElizaOS AI agents to play Hyperscape as real players with full access to game mechanics:

- **Real-time state awareness** via providers (health, inventory, nearby entities, skills, equipment, world map)
- **Full action repertoire**: movement, combat, gathering, inventory management, social interactions
- **Event-driven memory storage** for learning from gameplay experiences
- **Automatic reconnection** and robust error handling
- **Memory-optimized**: InMemoryDatabaseAdapter with caps (50 memories per agent, 20 adapter logs, 100 cache entries)

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
7. **mapProvider**: World map data for navigation and spatial awareness

### Actions (Executable Game Commands)
- **Movement**: MOVE_TO, FOLLOW_ENTITY, STOP_MOVEMENT
- **Combat**: ATTACK_ENTITY, CHANGE_COMBAT_STYLE
- **Skills**: CHOP_TREE, CATCH_FISH, LIGHT_FIRE, COOK_FOOD
- **Inventory**: EQUIP_ITEM, USE_ITEM, DROP_ITEM
- **Social**: CHAT_MESSAGE
- **Banking**: BANK_DEPOSIT, BANK_WITHDRAW

### Event Handlers
Automatically store significant game events as memories:
- Combat encounters (victories, defeats, kills)
- Resource gathering and respawns
- Skill level-ups and XP gains
- Player interactions

### Memory Management

**InMemoryDatabaseAdapter** (no PGLite):
- Zero WASM overhead (eliminates 2-4GB per agent)
- Ring buffer memory cap (50 memories per agent)
- Adapter log cap (20 entries for LLM prompts+responses)
- Cache cap (100 entries with LRU eviction)
- Periodic flush (every 60s for entities/rooms/worlds/tasks)
- Periodic GC (every 60s to reclaim short-lived allocations)

**Why 50 memories**:
- Agents only read last 5+20 memories for LLM context
- 50 provides sufficient history without unbounded growth
- Ring buffer automatically evicts oldest when limit exceeded

**Expected Memory Usage**:
- Single agent: <300MB (down from 2-4GB with PGLite)
- 19 agents: <5GB total (down from 38-76GB)

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

# Direct model provider API keys (as of March 12, 2026)
# Interleaved provider selection for model diversity
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# Alternative: ElizaCloud for unified model access (deprecated)
# ELIZAOS_CLOUD_API_KEY=your-elizacloud-api-key
```

### Character File

Add the plugin to your ElizaOS character configuration:

```json
{
  "name": "WoodcutterBot",
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "modelProvider": "anthropic",
  "settings": {
    "model": "claude-sonnet-4-6",
    "secrets": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "HYPERSCAPE_SERVER_URL": "ws://localhost:5555/ws",
      "HYPERSCAPE_AUTO_RECONNECT": "true"
    }
  }
}
```

**Direct Model Providers** (as of March 12, 2026):

Hyperscape now uses direct Anthropic and Groq providers with interleaved selection for model diversity:

**Anthropic Models**:
- `claude-sonnet-4-6` - Claude Sonnet 4.6
- `claude-opus-4-6` - Claude Opus 4.6
- `claude-haiku-4-5-20251001` - Claude Haiku 4.5
- `claude-opus-4-20250514` - Claude Opus 4
- `claude-sonnet-4-20250514` - Claude Sonnet 4

**Groq Models**:
- `meta-llama/llama-4-scout-17b-16e-instruct` - Llama 4 Scout
- `meta-llama/llama-4-maverick-17b-128e-instruct` - Llama 4 Maverick
- `llama-3.3-70b-versatile` - Llama 3.3 70B
- `moonshotai/kimi-k2-instruct` - Kimi K2
- `qwen/qwen3-32b` - Qwen 3 30B

**Model Selection**: Agents are spawned with interleaved provider selection (Anthropic → Groq → Anthropic → Groq...) to ensure model diversity and reduce dependency on single provider.

## Usage Example

Once configured, the agent will:

1. **Connect** to Hyperscape server on startup
2. **Receive context** from providers every decision cycle
3. **Execute actions** based on LLM decisions
4. **Store memories** of important game events (capped at 50 per agent)
5. **Learn** from past experiences via semantic memory search

### Example Agent Behavior

```typescript
// Agent receives provider context:
// - "You have 75/100 HP and are at position [10, 5, 20]"
// - "Nearby: Oak Tree at [12, 5, 18]"
// - "Inventory: Bronze Axe, 15 free slots"
// - "Available: CHOP_TREE, MOVE_TO, CHAT"
// - "World Map: Lumbridge (safe zone), Wilderness (PvP zone)"

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

## Memory System Integration

The plugin stores these event types as memories (capped at 50 per agent):

- **Combat Memories**: Opponents, outcomes, damage dealt/taken
- **Resource Memories**: Locations, types, XP gained
- **Skill Memories**: Level-ups, progression milestones
- **Social Memories**: Player interactions, messages

Memories are tagged for semantic search:
- Tags: `['hyperscape', 'combat', 'victory']`
- Tags: `['hyperscape', 'resource', 'woodcutting', 'gathered']`
- Tags: `['hyperscape', 'skill', 'levelup', 'fishing']`

**Memory Eviction**: When memory count exceeds 50, oldest memories are automatically evicted (ring buffer).

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
│   ├── equipment.ts
│   └── mapProvider.ts    # World map data for navigation
├── actions/
│   ├── movement.ts       # MOVE_TO, FOLLOW, STOP
│   ├── combat.ts         # ATTACK, COMBAT_STYLE
│   ├── skills.ts         # CHOP, FISH, COOK, LIGHT_FIRE
│   ├── inventory.ts      # EQUIP, USE_ITEM, DROP
│   ├── social.ts         # CHAT
│   └── banking.ts        # DEPOSIT, WITHDRAW
└── events/
    └── handlers.ts       # Event → Memory mappings
```

## Key Design Principles

1. **Event-Driven**: Game events flow into agent context automatically
2. **Stateless Actions**: Actions use Service for state, no internal state
3. **Rich Context**: Providers give agent full game awareness (including world map)
4. **Memory-Based Learning**: Agents learn from experiences via Memory system (capped at 50)
5. **Type-Safe**: Full TypeScript types from both ElizaOS and Hyperscape
6. **Modular**: Clean separation - Service → Providers → Actions
7. **Memory-Efficient**: InMemoryDatabaseAdapter with automatic eviction and periodic cleanup

## Differences from Old Plugin

The previous `@elizaos/plugin-hyperscape` was broken. This new implementation:

✅ Follows ElizaOS plugin architecture standards
✅ Properly implements Service, Provider, Action, Event patterns
✅ Uses WebSocket for real-time communication
✅ Stores events as memories for learning (with 50-memory cap)
✅ Provides complete game context via providers (including world map)
✅ Handles reconnection and errors gracefully
✅ Fully typed with TypeScript
✅ Memory-optimized with InMemoryDatabaseAdapter (no PGLite WASM overhead)
✅ Automatic memory eviction and periodic cleanup

## Performance Characteristics

**Memory Usage** (per agent):
- With InMemoryDatabaseAdapter: <300MB
- With PGLite (old): 2-4GB

**Memory Caps**:
- Memories: 50 (ring buffer eviction)
- Adapter logs: 20 (LLM prompts+responses)
- Cache entries: 100 (LRU eviction)
- Encounter cache: 50 per agent
- Previous mob health: 100 entries

**Periodic Cleanup**:
- Non-blocking GC every 60s
- Adapter flush every 60s
- State cache flush when over 100 entries

## Troubleshooting

### Agent Memory Issues

**Symptom**: Agent consuming >500MB memory

**Solutions**:
1. Verify InMemoryDatabaseAdapter is being used (not PGLite)
2. Check memory caps are in place (50 memories per agent)
3. Monitor periodic GC is running (every 60s)
4. Check adapter logs are capped at 20 entries

### Connection Issues

**Symptom**: Agent fails to connect to Hyperscape server

**Solutions**:
1. Verify `HYPERSCAPE_SERVER_URL` is correct
2. Check server is running and accessible
3. Verify WebSocket endpoint is `/ws`
4. Check firewall allows WebSocket connections

### World Map Not Available

**Symptom**: Agent cannot access world map data

**Solutions**:
1. Verify `mapProvider` is exported from plugin
2. Check world map data is loaded on server
3. Refresh known locations when map data changes

## License

MIT - Hyperscape Team
