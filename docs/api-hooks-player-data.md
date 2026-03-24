# usePlayerData Hook API Reference

**File**: `packages/client/src/hooks/usePlayerData.ts`

**Added**: March 2026 (PR #1067)

## Overview

Centralized React hook for subscribing to player data events (inventory, equipment, stats, coins). Eliminates duplicate event listeners across components and provides proper equality checks to prevent cascading re-renders.

## Usage

### Basic Usage with Context Provider

```typescript
import { PlayerDataProvider, usePlayerDataContext, usePlayerStatsContext } from '@/hooks';

// Wrap your component tree
function App() {
  return (
    <PlayerDataProvider world={world}>
      <GameUI />
    </PlayerDataProvider>
  );
}

// Access player data in child components
function GameUI() {
  const { inventory, equipment, playerStats, coins } = usePlayerDataContext();
  
  return (
    <div>
      <InventoryPanel items={inventory} coins={coins} />
      <EquipmentPanel equipment={equipment} />
      <StatusBars stats={playerStats} />
    </div>
  );
}

// Or access just stats
function HealthBar() {
  const playerStats = usePlayerStatsContext();
  
  return (
    <div>
      HP: {playerStats?.health.current} / {playerStats?.health.max}
    </div>
  );
}
```

### Direct Hook Usage (without context)

```typescript
import { usePlayerDataState } from '@/hooks';

function MyComponent({ world }: { world: ClientWorld }) {
  const { inventory, equipment, playerStats, coins } = usePlayerDataState(world);
  
  // ... use player data
}
```

## API

### PlayerDataProvider

React context provider that wraps `usePlayerDataState` and provides data to child components.

**Props**:
```typescript
interface PlayerDataProviderProps {
  world: ClientWorld | null;
  children: React.ReactNode;
}
```

**Example**:
```typescript
<PlayerDataProvider world={world}>
  {children}
</PlayerDataProvider>
```

### usePlayerDataContext

Hook to access player data from context. Must be used within `PlayerDataProvider`.

**Returns**: `PlayerDataState`

**Throws**: Error if used outside `PlayerDataProvider`

**Example**:
```typescript
const { inventory, equipment, playerStats, coins } = usePlayerDataContext();
```

### usePlayerStatsContext

Hook to access only player stats from context. Must be used within `PlayerDataProvider`.

**Returns**: `PlayerStats | null`

**Example**:
```typescript
const playerStats = usePlayerStatsContext();
```

### usePlayerDataState

Low-level hook that subscribes to player data events. Use `usePlayerDataContext` instead when possible.

**Parameters**:
```typescript
function usePlayerDataState(world: ClientWorld | null): PlayerDataState
```

**Returns**: `PlayerDataState`

## Types

### PlayerDataState

```typescript
interface PlayerDataState {
  /** Inventory items (28 slots) */
  inventory: InventorySlotViewItem[];
  
  /** Player equipment (weapon, armor, etc.) */
  equipment: PlayerEquipmentItems | null;
  
  /** Player stats (health, prayer, skills, combat level) */
  playerStats: PlayerStats | null;
  
  /** Coin count */
  coins: number;
  
  /** Setter for inventory */
  setInventory: React.Dispatch<React.SetStateAction<InventorySlotViewItem[]>>;
  
  /** Setter for equipment */
  setEquipment: React.Dispatch<React.SetStateAction<PlayerEquipmentItems | null>>;
  
  /** Setter for player stats */
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerStats | null>>;
  
  /** Setter for coins */
  setCoins: React.Dispatch<React.SetStateAction<number>>;
}
```

### InventorySlotViewItem

```typescript
interface InventorySlotViewItem {
  slot: number;
  itemId: string;
  quantity: number;
}
```

### PlayerEquipmentItems

```typescript
interface PlayerEquipmentItems {
  weapon: InventoryItem | null;
  shield: InventoryItem | null;
  helmet: InventoryItem | null;
  body: InventoryItem | null;
  legs: InventoryItem | null;
  boots: InventoryItem | null;
  gloves: InventoryItem | null;
  cape: InventoryItem | null;
  amulet: InventoryItem | null;
  ring: InventoryItem | null;
  arrows: InventoryItem | null;
}
```

### PlayerStats

```typescript
interface PlayerStats {
  level: number;
  combatLevel: number;
  inCombat: boolean;
  health: {
    current: number;
    max: number;
  };
  prayerPoints: {
    current: number;
    max: number;
  };
  skills: {
    attack: { level: number; xp: number };
    strength: { level: number; xp: number };
    defense: { level: number; xp: number };
    constitution: { level: number; xp: number };
    ranged: { level: number; xp: number };
    woodcutting: { level: number; xp: number };
    fishing: { level: number; xp: number };
    firemaking: { level: number; xp: number };
    cooking: { level: number; xp: number };
  };
  equipment: PlayerEquipmentItems;
}
```

## Event Handling

The hook subscribes to the following events:

| Event | Description | Payload |
|-------|-------------|---------|
| `UI_UPDATE` | Primary source for player stats | `{ component: "player", data: Partial<PlayerStats> }` |
| `INVENTORY_UPDATED` | Inventory items and coins | `{ playerId, items, coins }` |
| `INVENTORY_UPDATE_COINS` | Coin count only | `{ playerId, coins }` |
| `UI_EQUIPMENT_UPDATE` | Equipment changes | `{ equipment: RawEquipmentData }` |
| `STATS_UPDATE` | Alternative stats event | `Partial<PlayerStats>` |
| `SKILLS_UPDATED` | Skill XP and levels | `{ playerId, skills }` |
| `PRAYER_STATE_SYNC` | Full prayer state | `{ playerId, points, maxPoints }` |
| `PRAYER_POINTS_CHANGED` | Prayer points only | `{ playerId, points, maxPoints }` |

## Equality Checks

The hook uses custom equality functions to prevent unnecessary re-renders:

### areInventoryItemsEqual

Compares two inventory arrays by slot, itemId, and quantity.

```typescript
function areInventoryItemsEqual(
  left: InventorySlotViewItem[],
  right: InventorySlotViewItem[]
): boolean
```

**Returns**: `true` if inventories are equal, `false` otherwise

### areEquipmentItemsEqual

Compares two equipment objects by item id, quantity, and name for each slot.

```typescript
function areEquipmentItemsEqual(
  left: PlayerEquipmentItems | null,
  right: PlayerEquipmentItems | null
): boolean
```

**Returns**: `true` if equipment is equal, `false` otherwise

### arePlayerStatsEqual

Compares two player stats objects including health, prayer, skills, and combat level.

```typescript
function arePlayerStatsEqual(
  left: PlayerStats | null,
  right: PlayerStats | null
): boolean
```

**Returns**: `true` if stats are equal, `false` otherwise

### areSkillsEqual

Compares skill levels and XP for all skills.

```typescript
function areSkillsEqual(
  left: PlayerStats["skills"],
  right: PlayerStats["skills"]
): boolean
```

**Returns**: `true` if skills are equal, `false` otherwise

### areStatusValuesEqual

Compares status values (health, prayer) by current and max.

```typescript
function areStatusValuesEqual(
  left?: { current?: number; max?: number },
  right?: { current?: number; max?: number }
): boolean
```

**Returns**: `true` if status values are equal, `false` otherwise

## Initial Data Loading

The hook automatically requests initial data from the network cache on mount:

1. **Check for player ID** - Waits for `world.entities.player.id` to be available
2. **Load from cache** - Reads `lastInventoryByPlayerId`, `lastSkillsByPlayerId`, `lastEquipmentByPlayerId`, `lastPrayerStateByPlayerId`
3. **Request fresh data** - Emits `INVENTORY_REQUEST` event to server
4. **Retry on failure** - Retries after 400ms if player not ready

## Performance Optimizations

### Defensive Cloning

Inventory items are defensively cloned to prevent shared reference bugs:

```typescript
function cloneInventoryItems(
  items: InventorySlotViewItem[] | undefined | null
): InventorySlotViewItem[] {
  if (!items || items.length === 0) return [];
  return items.map((item) => ({ ...item }));
}
```

### Equality Checks

All state updates use equality checks to prevent unnecessary re-renders:

```typescript
setInventory((prev) =>
  areInventoryItemsEqual(prev, newItems) ? prev : cloneInventoryItems(newItems)
);

setEquipment((prev) =>
  areEquipmentItemsEqual(prev, newEquipment) ? prev : newEquipment
);

setPlayerStats((prev) => {
  const merged = mergePlayerStats(prev, updates);
  return arePlayerStatsEqual(prev, merged) ? prev : merged;
});
```

### Merge Strategy

Player stats are merged instead of replaced to preserve data from different event sources:

```typescript
function mergePlayerStats(
  previous: PlayerStats | null,
  updates: Partial<PlayerStats>
): PlayerStats {
  if (!previous) return updates as PlayerStats;
  
  const next = { ...previous, ...updates };
  
  // Preserve nested objects
  if (updates.health) next.health = updates.health;
  if (updates.skills) next.skills = updates.skills;
  if (updates.prayerPoints) next.prayerPoints = updates.prayerPoints;
  
  return next;
}
```

## Type Guards

The hook uses type guards to validate event payloads:

```typescript
import {
  isInventoryUpdateEvent,
  isCoinUpdateWithPlayerEvent,
  isUIUpdateEvent,
  isPlayerStatsData,
  isSkillsUpdateEvent,
  isPrayerStateSyncEvent,
  isPrayerPointsChangedEvent,
  isObject,
} from "../types/guards";
```

**Example**:
```typescript
const handleInventory = (data: unknown) => {
  if (!isInventoryUpdateEvent(data)) {
    console.warn("[usePlayerData] Invalid inventory update event:", data);
    return;
  }
  // ... safe to use data.items, data.coins, data.playerId
};
```

## Cleanup

The hook properly cleans up all event listeners on unmount:

```typescript
useEffect(() => {
  // ... register listeners
  
  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    world.off(EventType.UI_UPDATE, handleUIUpdate);
    world.off(EventType.INVENTORY_UPDATED, handleInventory);
    world.off(EventType.INVENTORY_UPDATE_COINS, handleCoins);
    world.off(EventType.UI_EQUIPMENT_UPDATE, handleEquipment);
    world.off(EventType.STATS_UPDATE, handleStats);
    world.off(EventType.SKILLS_UPDATED, handleSkillsUpdate);
    world.off(EventType.PRAYER_STATE_SYNC, handlePrayerStateSync);
    world.off(EventType.PRAYER_POINTS_CHANGED, handlePrayerPointsChanged);
  };
}, [world, playerId]);
```

## Migration from Old Pattern

### Before (Duplicate Subscriptions)

```typescript
// Sidebar.tsx
const [inventory, setInventory] = useState([]);
const [equipment, setEquipment] = useState(null);
const [playerStats, setPlayerStats] = useState(null);

useEffect(() => {
  world.on(EventType.INVENTORY_UPDATED, (data) => setInventory(data.items));
  world.on(EventType.UI_UPDATE, (data) => setPlayerStats(data));
  // ... more listeners
}, [world]);

// CoreUI.tsx (duplicate subscription)
const [playerStats, setPlayerStats] = useState(null);

useEffect(() => {
  world.on(EventType.UI_UPDATE, (data) => setPlayerStats(data));
  // ... duplicate listener
}, [world]);
```

### After (Centralized Subscription)

```typescript
// App.tsx
<PlayerDataProvider world={world}>
  <InterfaceManager world={world}>
    <CoreUI world={world} />
  </InterfaceManager>
</PlayerDataProvider>

// Any child component
function MyComponent() {
  const { inventory, equipment, playerStats, coins } = usePlayerDataContext();
  // ... use data
}
```

## Benefits

1. **Eliminates Duplicate Listeners**: Single subscription per event type across entire app
2. **Prevents Cascading Re-renders**: Equality checks ensure components only re-render when data actually changes
3. **Type Safety**: Type guards validate all event payloads
4. **Defensive Cloning**: Prevents shared reference bugs
5. **Proper Cleanup**: All listeners removed on unmount
6. **Cache Integration**: Automatically loads from network cache on mount
7. **Player ID Filtering**: Only processes events for local player (prevents cross-tab updates)

## Related Hooks

- **useModalPanels** - Centralized modal panel state (bank, store, dialogue, etc.)
- **useMinimapTerrainCache** - Minimap terrain rendering
- **useMinimapEntityPips** - Minimap entity markers
- **useMinimapWorldCaches** - Minimap road/town caching

## See Also

- [UI Modernization Guide](./ui-modernization-march-2026.md) - Complete UI modernization details
- [useModalPanels API](./api-hooks-modal-panels.md) - Modal panel hook reference
- [Minimap Hooks API](./api-hooks-minimap.md) - Minimap hook reference
