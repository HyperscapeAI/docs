# HyperscapeService API Reference

Complete API reference for the HyperscapeService class in `@hyperscape/plugin-hyperscape`.

## Overview

HyperscapeService is the core service that manages WebSocket connection to the Hyperscape game server. It provides:

- Real-time game state synchronization
- Command execution (movement, combat, inventory, etc.)
- Event broadcasting to registered handlers
- Automatic reconnection on disconnect
- Movement completion tracking

## Class: HyperscapeService

### Constructor

```typescript
constructor(runtime?: IAgentRuntime)
```

**Parameters**:
- `runtime` (optional): ElizaOS runtime instance

**Note**: Use `HyperscapeService.start(runtime)` instead of direct construction.

### Static Methods

#### `start(runtime: IAgentRuntime): Promise<Service>`

Start the service for a given runtime. Returns existing instance if already started.

**Parameters**:
- `runtime`: ElizaOS runtime instance

**Returns**: Promise resolving to HyperscapeService instance

**Example**:
```typescript
const service = await HyperscapeService.start(runtime);
```

### Connection Methods

#### `connect(serverUrl: string): Promise<void>`

Connect to Hyperscape server via WebSocket.

**Parameters**:
- `serverUrl`: WebSocket URL (e.g., `ws://localhost:5555/ws`)

**Throws**: Error if connection fails

**Example**:
```typescript
await service.connect('ws://localhost:5555/ws');
```

#### `disconnect(): Promise<void>`

Disconnect from server (intentional disconnect, won't auto-reconnect).

**Example**:
```typescript
await service.disconnect();
```

#### `isConnected(): boolean`

Check if currently connected to server.

**Returns**: `true` if connected, `false` otherwise

**Example**:
```typescript
if (service.isConnected()) {
  await service.executeMove({ target: [10, 0, 20] });
}
```

#### `setAuthToken(authToken: string, privyUserId?: string): void`

Set authentication tokens for future connections.

**Parameters**:
- `authToken`: JWT authentication token
- `privyUserId` (optional): Privy user ID

**Example**:
```typescript
service.setAuthToken('eyJhbGc...', 'privy-user-123');
```

### State Access Methods

#### `getPlayerEntity(): PlayerEntity | null`

Get the current player entity.

**Returns**: PlayerEntity or null if not spawned

**Example**:
```typescript
const player = service.getPlayerEntity();
if (player) {
  console.log(`HP: ${player.health.current}/${player.health.max}`);
  console.log(`Position: ${player.position}`);
}
```

#### `getNearbyEntities(): Entity[]`

Get all nearby entities (players, NPCs, resources, items).

**Returns**: Array of Entity objects

**Example**:
```typescript
const entities = service.getNearbyEntities();
const trees = entities.filter(e => e.type === 'resource' && e.resourceType === 'tree');
```

#### `getGameState(): GameStateCache`

Get complete game state snapshot.

**Returns**: GameStateCache object

**Example**:
```typescript
const state = service.getGameState();
console.log(`World ID: ${state.worldId}`);
console.log(`Nearby entities: ${state.nearbyEntities.size}`);
console.log(`Last update: ${state.lastUpdate}`);
```

#### `getQuestState(): QuestData[]`

Get current quest list.

**Returns**: Array of QuestData objects

**Example**:
```typescript
const quests = service.getQuestState();
const activeQuests = quests.filter(q => q.status === 'in_progress');
```

#### `getWorldMap(): WorldMapData | undefined`

Get world map data (towns and POIs).

**Returns**: WorldMapData or undefined if not loaded

**Example**:
```typescript
const worldMap = service.getWorldMap();
if (worldMap) {
  console.log(`Towns: ${worldMap.towns.length}`);
  console.log(`POIs: ${worldMap.pois.length}`);
}
```

#### `getLocalChatMessages(): Array<{from, fromId, text, timestamp, distance}>`

Get recent chat messages from nearby players (within 50m).

**Returns**: Array of chat message objects (newest first, max 10)

**Example**:
```typescript
const recentChat = service.getLocalChatMessages();
for (const msg of recentChat) {
  console.log(`${msg.from} (${msg.distance.toFixed(1)}m): ${msg.text}`);
}
```

### Movement Methods

#### `executeMove(command: MoveToCommand): Promise<void>`

Execute movement command.

**Parameters**:
- `command.target`: Target position `[x, y, z]`
- `command.runMode` (optional): Run instead of walk (default: false)
- `command.cancel` (optional): Cancel current movement (default: false)

**Example**:
```typescript
// Walk to position
await service.executeMove({ target: [10, 0, 20], runMode: false });

// Run to position
await service.executeMove({ target: [50, 0, 100], runMode: true });

// Cancel movement
await service.executeMove({ target: [0, 0, 0], cancel: true });
```

**Note**: Long-distance moves (>180 units) are automatically clamped to prevent server rejection.

#### `waitForMovementComplete(timeoutMs?: number): Promise<void>`

Wait for current movement to complete. Resolves immediately if not moving.

**Parameters**:
- `timeoutMs` (optional): Maximum wait time in milliseconds (default: 15000)

**Returns**: Promise that resolves when movement completes or timeout expires

**Example**:
```typescript
// Walk to bank
await service.executeMove({ target: bankPosition });

// Wait for arrival
await service.waitForMovementComplete();

// Now we're at the bank
await service.bankDepositAll();
```

#### `isMoving: boolean`

Read-only property indicating if character is currently moving.

**Example**:
```typescript
if (service.isMoving) {
  console.log('Waiting for movement to complete...');
  await service.waitForMovementComplete();
}
```

### Combat Methods

#### `executeAttack(command: AttackEntityCommand): Promise<void>`

Execute attack command.

**Parameters**:
- `command.targetEntityId`: Entity ID to attack
- `command.combatStyle` (optional): Combat style (melee, ranged, magic)

**Example**:
```typescript
await service.executeAttack({
  targetEntityId: 'goblin-123',
  combatStyle: 'melee'
});
```

#### `executeChangeAttackStyle(newStyle: string): Promise<void>`

Change attack style.

**Parameters**:
- `newStyle`: New combat style (attack, strength, defense, ranged, magic)

**Example**:
```typescript
await service.executeChangeAttackStyle('ranged');
```

#### `executeTogglePrayer(prayerId: string): Promise<void>`

Toggle a prayer on/off.

**Parameters**:
- `prayerId`: Prayer ID to toggle

**Example**:
```typescript
await service.executeTogglePrayer('protect_from_melee');
```

### Inventory Methods

#### `executeUseItem(command: UseItemCommand): Promise<void>`

Use an item from inventory.

**Parameters**:
- `command.itemId`: Item type ID
- `command.slot` (optional): Specific inventory slot

**Example**:
```typescript
await service.executeUseItem({ itemId: 'shark', slot: 5 });
```

#### `executeEquipItem(command: EquipItemCommand): Promise<void>`

Equip an item from inventory.

**Parameters**:
- `command.itemId`: Item type ID
- `command.slot` (optional): Specific inventory slot

**Example**:
```typescript
await service.executeEquipItem({ itemId: 'bronze_sword' });
```

#### `executePickupItem(itemId: string): Promise<void>`

Pick up an item from the ground.

**Parameters**:
- `itemId`: Entity ID of the ground item

**Example**:
```typescript
await service.executePickupItem('item-entity-123');
```

#### `executeDropItem(itemId: string, quantity?: number, slot?: number): Promise<void>`

Drop an item from inventory to the ground.

**Parameters**:
- `itemId`: Item type ID
- `quantity` (optional): How many to drop (default: 1)
- `slot` (optional): Specific inventory slot

**Example**:
```typescript
// Drop 10 logs
await service.executeDropItem('logs', 10);

// Drop specific item from slot 5
await service.executeDropItem('bronze_sword', 1, 5);
```

### Resource Gathering Methods

#### `executeGatherResource(command: GatherResourceCommand): Promise<void>`

Gather from a resource (tree, rock, fishing spot).

**Parameters**:
- `command.resourceEntityId`: Entity ID of the resource

**Example**:
```typescript
await service.executeGatherResource({ resourceEntityId: 'tree-123' });
```

### Banking Methods

#### `openBank(bankId: string): Promise<void>`

Open a bank session.

**Parameters**:
- `bankId`: Entity ID of the bank

**Example**:
```typescript
await service.openBank('bank-varrock');
```

#### `bankDeposit(itemId: string, quantity: number): Promise<void>`

Deposit items into bank.

**Parameters**:
- `itemId`: Item type ID
- `quantity`: How many to deposit

**Example**:
```typescript
await service.bankDeposit('logs', 10);
```

#### `bankDepositAll(): Promise<void>`

Deposit all inventory items into bank.

**Example**:
```typescript
await service.bankDepositAll();
```

#### `bankWithdraw(itemId: string, quantity: number): Promise<void>`

Withdraw items from bank.

**Parameters**:
- `itemId`: Item type ID
- `quantity`: How many to withdraw

**Example**:
```typescript
await service.bankWithdraw('shark', 5);
```

#### `closeBank(): Promise<void>`

Close the current bank session.

**Example**:
```typescript
await service.closeBank();
```

**Complete Banking Example**:
```typescript
// Walk to bank
await service.executeMove({ target: bankPosition });
await service.waitForMovementComplete();

// Open bank session
await service.openBank('bank-varrock');

// Deposit all items
await service.bankDepositAll();

// Withdraw food
await service.bankWithdraw('shark', 10);

// Close bank
await service.closeBank();
```

### Social Methods

#### `executeChatMessage(command: ChatMessageCommand): Promise<void>`

Send a chat message.

**Parameters**:
- `command.message`: Message text

**Example**:
```typescript
await service.executeChatMessage({ message: 'Hello, world!' });
```

#### `playEmote(emoteName: string): Promise<void>`

Play an emote animation.

**Parameters**:
- `emoteName`: Emote name (e.g., 'wave', 'dance', 'cry')

**Example**:
```typescript
await service.playEmote('wave');
```

### Duel Methods

#### `executeDuelChallenge(command: {targetPlayerId: string}): Promise<void>`

Challenge another player to a duel.

**Parameters**:
- `command.targetPlayerId`: Character ID of player to challenge

**Example**:
```typescript
await service.executeDuelChallenge({ targetPlayerId: 'player-456' });
```

#### `executeDuelChallengeResponse(command: {challengeId: string, accept: boolean}): Promise<void>`

Respond to a duel challenge.

**Parameters**:
- `command.challengeId`: Challenge ID from incoming challenge
- `command.accept`: Accept (true) or decline (false)

**Example**:
```typescript
const challenge = service.getPendingDuelChallenge();
if (challenge) {
  await service.executeDuelChallengeResponse({
    challengeId: challenge.challengeId,
    accept: true
  });
}
```

#### `getPendingDuelChallenge(): PendingDuelChallenge | null`

Get current pending duel challenge (if any).

**Returns**: PendingDuelChallenge or null

**Example**:
```typescript
const challenge = service.getPendingDuelChallenge();
if (challenge) {
  console.log(`Challenge from ${challenge.challengerName}`);
  console.log(`Expires in ${challenge.expiresAt - Date.now()}ms`);
}
```

### Quest Methods

#### `requestQuestList(): void`

Request quest list from server. Response arrives via `questList` packet.

**Example**:
```typescript
service.requestQuestList();
// Wait for questList packet, then check service.getQuestState()
```

#### `requestQuestDetail(questId: string): void`

Request detailed quest information.

**Parameters**:
- `questId`: Quest ID

**Example**:
```typescript
service.requestQuestDetail('cooks_assistant');
```

#### `sendQuestAccept(questId: string): void`

Accept a quest.

**Parameters**:
- `questId`: Quest ID

**Example**:
```typescript
service.sendQuestAccept('cooks_assistant');
```

#### `sendQuestComplete(questId: string): void`

Complete a quest (must be in ready_to_complete status).

**Parameters**:
- `questId`: Quest ID

**Example**:
```typescript
service.sendQuestComplete('cooks_assistant');
```

### Interaction Methods

#### `interactWithEntity(entityId: string, interactionType: string): void`

Interact with a world entity (chest, NPC, etc.).

**Parameters**:
- `entityId`: Entity ID
- `interactionType`: Type of interaction

**Example**:
```typescript
service.interactWithEntity('chest-123', 'open');
```

### Event Handling

#### `onGameEvent(eventType: EventType, handler: (data: unknown) => void | Promise<void>): void`

Register an event handler.

**Parameters**:
- `eventType`: Event type to listen for
- `handler`: Callback function

**Event Types**:
- `ENTITY_JOINED` - Entity entered nearby area
- `ENTITY_UPDATED` - Entity state changed
- `ENTITY_LEFT` - Entity left nearby area
- `INVENTORY_UPDATED` - Inventory changed
- `SKILLS_UPDATED` - Skill levels/XP changed
- `CHAT_MESSAGE` - Chat message received
- `COMBAT_DAMAGE_DEALT` - Damage dealt in combat
- `DUEL_FIGHT_START` - Duel fight started
- `DUEL_COMPLETED` - Duel finished

**Example**:
```typescript
service.onGameEvent('CHAT_MESSAGE', (data) => {
  const msg = data as { from: string; text: string };
  console.log(`${msg.from}: ${msg.text}`);
});

service.onGameEvent('ENTITY_LEFT', (data) => {
  const entity = service.getLastRemovedEntity();
  if (entity) {
    console.log(`${entity.name} left the area`);
  }
});
```

#### `offGameEvent(eventType: EventType, handler: Function): void`

Unregister an event handler.

**Parameters**:
- `eventType`: Event type
- `handler`: Handler function to remove

**Example**:
```typescript
const handler = (data) => console.log(data);
service.onGameEvent('CHAT_MESSAGE', handler);
// Later...
service.offGameEvent('CHAT_MESSAGE', handler);
```

#### `getLastRemovedEntity(): Entity | null`

Get the last removed entity (for ENTITY_LEFT handlers).

**Returns**: Entity or null

**Note**: This is cleared after reading, so call it immediately in your ENTITY_LEFT handler.

**Example**:
```typescript
service.onGameEvent('ENTITY_LEFT', () => {
  const entity = service.getLastRemovedEntity();
  if (entity) {
    console.log(`${entity.name} left`);
  }
});
```

### Autonomous Behavior Methods

#### `startAutonomousBehavior(): void`

Start autonomous behavior (full ElizaOS decision loop).

**Example**:
```typescript
service.startAutonomousBehavior();
```

#### `stopAutonomousBehavior(): void`

Stop autonomous behavior.

**Example**:
```typescript
service.stopAutonomousBehavior();
```

#### `isAutonomousBehaviorRunning(): boolean`

Check if autonomous behavior is running.

**Returns**: `true` if running, `false` otherwise

**Example**:
```typescript
if (!service.isAutonomousBehaviorRunning()) {
  service.startAutonomousBehavior();
}
```

#### `setAutonomousBehaviorEnabled(enabled: boolean): void`

Enable or disable autonomous behavior.

**Parameters**:
- `enabled`: Enable (true) or disable (false)

**Example**:
```typescript
service.setAutonomousBehaviorEnabled(false);  // Pause autonomous behavior
```

#### `getBehaviorManager(): AutonomousBehaviorManager | null`

Get the autonomous behavior manager.

**Returns**: AutonomousBehaviorManager or null

**Example**:
```typescript
const manager = service.getBehaviorManager();
if (manager) {
  const goal = manager.getGoal();
  console.log(`Current goal: ${goal?.description}`);
}
```

### Goal Management Methods

#### `syncGoalToServer(): void`

Sync current goal to server for dashboard display.

**Example**:
```typescript
const manager = service.getBehaviorManager();
manager?.setGoal({
  type: 'woodcutting',
  description: 'Chop oak trees',
  target: 10,
  progress: 5
});
service.syncGoalToServer();
```

#### `unlockGoal(): void`

Unlock the current goal, allowing autonomous behavior to change it.

**Example**:
```typescript
service.unlockGoal();
```

#### `syncAgentThought(type: string, content: string): void`

Sync agent thought to server for dashboard display.

**Parameters**:
- `type`: Thought type (situation, evaluation, thinking, decision)
- `content`: Thought content (markdown supported)

**Example**:
```typescript
service.syncAgentThought('thinking', 'I should chop trees to level woodcutting');
service.syncAgentThought('decision', 'Moving to oak tree at [12, 5, 18]');
```

#### `syncThoughtsToServer(thinking: string): void`

Simplified wrapper for syncing LLM reasoning.

**Parameters**:
- `thinking`: LLM reasoning/thought process

**Example**:
```typescript
service.syncThoughtsToServer('Analyzing nearby resources...');
```

### Utility Methods

#### `getLogs(): Array<{timestamp, type, data}>`

Get recent game event logs.

**Returns**: Array of log entries (newest first, max 100)

**Example**:
```typescript
const logs = service.getLogs();
for (const log of logs.slice(0, 10)) {
  console.log(`[${new Date(log.timestamp).toISOString()}] ${log.type}`);
}
```

## Types

### PlayerEntity

```typescript
interface PlayerEntity {
  id: string;
  name: string;
  position: [number, number, number];
  health: { current: number; max: number };
  stamina: { current: number; max: number };
  items: Array<{ itemId: string; quantity: number; slot: number }>;
  equipment: Record<string, string>;
  skills: Record<string, { level: number; xp: number }>;
  coins: number;
  alive: boolean;
  inCombat: boolean;
  combatTarget: string | null;
}
```

### Entity

```typescript
interface Entity {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  // Additional properties vary by entity type
}
```

### GameStateCache

```typescript
interface GameStateCache {
  playerEntity: PlayerEntity | null;
  nearbyEntities: Map<string, Entity>;
  currentRoomId: string | null;
  worldId: string | null;
  lastUpdate: number;
  quests: QuestData[];
  worldMap?: WorldMapData;
}
```

### QuestData

```typescript
interface QuestData {
  questId: string;
  name?: string;
  status: string;
  description?: string;
  stageProgress?: Record<string, number>;
}
```

### WorldMapData

```typescript
interface WorldMapData {
  towns: Array<{
    name: string;
    position: [number, number, number];
    radius: number;
  }>;
  pois: Array<{
    name: string;
    position: [number, number, number];
    type: string;
  }>;
}
```

## See Also

- [docs/agent-movement-api.md](../agent-movement-api.md) - Movement API guide
- [packages/plugin-hyperscape/README.md](../../packages/plugin-hyperscape/README.md) - Plugin overview
- [packages/plugin-hyperscape/src/services/HyperscapeService.ts](../../packages/plugin-hyperscape/src/services/HyperscapeService.ts) - Implementation
