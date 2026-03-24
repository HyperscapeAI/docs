# useModalPanels Hook API Reference

**File**: `packages/client/src/hooks/useModalPanels.ts`

**Added**: March 2026 (PR #1067)

## Overview

Centralized React hook for subscribing to modal panel events (bank, store, dialogue, smelting, smithing, crafting, fletching, tanning, loot, quests, duels, trades). Provides state management and close handlers for all modal types. Shared between desktop and mobile interfaces.

## Usage

### Basic Usage

```typescript
import { useModalPanels } from '@/hooks';

function InterfaceManager({ world }: { world: ClientWorld }) {
  const {
    // Panel data
    bankData,
    storeData,
    dialogueData,
    lootWindowData,
    questStartData,
    duelData,
    tradeData,
    
    // Close handlers
    closeBank,
    closeStore,
    closeDialogue,
    closeLootWindow,
    closeQuestStart,
    closeDuel,
    closeTrade,
  } = useModalPanels(world);
  
  return (
    <>
      {bankData?.visible && (
        <BankPanel
          {...bankData}
          onClose={closeBank}
          world={world}
        />
      )}
      
      {storeData?.visible && (
        <StorePanel
          {...storeData}
          onClose={closeStore}
          world={world}
        />
      )}
      
      {/* ... other panels */}
    </>
  );
}
```

## API

### useModalPanels

**Parameters**:
```typescript
function useModalPanels(world: ClientWorld | null): ModalPanelsState
```

**Returns**: `ModalPanelsState` (see [Types](#types) section)

## Types

### ModalPanelsState

```typescript
interface ModalPanelsState {
  // Panel data
  bankData: BankData | null;
  storeData: StoreData | null;
  dialogueData: DialogueData | null;
  smeltingData: SmeltingData | null;
  smithingData: SmithingData | null;
  craftingData: CraftingData | null;
  fletchingData: FletchingData | null;
  tanningData: TanningData | null;
  lootWindowData: LootWindowData | null;
  questStartData: QuestStartData | null;
  questCompleteData: QuestCompleteData | null;
  xpLampData: XpLampData | null;
  duelData: DuelData | null;
  duelResultData: DuelResultData | null;
  tradeData: TradeData | null;

  // Setters
  setBankData: React.Dispatch<React.SetStateAction<BankData | null>>;
  setStoreData: React.Dispatch<React.SetStateAction<StoreData | null>>;
  setDialogueData: React.Dispatch<React.SetStateAction<DialogueData | null>>;
  setSmeltingData: React.Dispatch<React.SetStateAction<SmeltingData | null>>;
  setSmithingData: React.Dispatch<React.SetStateAction<SmithingData | null>>;
  setCraftingData: React.Dispatch<React.SetStateAction<CraftingData | null>>;
  setFletchingData: React.Dispatch<React.SetStateAction<FletchingData | null>>;
  setTanningData: React.Dispatch<React.SetStateAction<TanningData | null>>;
  setLootWindowData: React.Dispatch<React.SetStateAction<LootWindowData | null>>;
  setQuestStartData: React.Dispatch<React.SetStateAction<QuestStartData | null>>;
  setQuestCompleteData: React.Dispatch<React.SetStateAction<QuestCompleteData | null>>;
  setXpLampData: React.Dispatch<React.SetStateAction<XpLampData | null>>;
  setDuelData: React.Dispatch<React.SetStateAction<DuelData | null>>;
  setDuelResultData: React.Dispatch<React.SetStateAction<DuelResultData | null>>;
  setTradeData: React.Dispatch<React.SetStateAction<TradeData | null>>;

  // Close handlers
  closeBank: () => void;
  closeStore: () => void;
  closeDialogueData: () => void;
  closeSmelting: () => void;
  closeSmithing: () => void;
  closeCrafting: () => void;
  closeFletching: () => void;
  closeTanning: () => void;
  closeLootWindow: () => void;
  closeQuestStart: () => void;
  closeQuestComplete: () => void;
  closeXpLamp: () => void;
  closeDuel: () => void;
  closeDuelResult: () => void;
  closeTrade: () => void;
}
```

### Panel Data Types

#### BankData

```typescript
interface BankData {
  visible: boolean;
  bankId: string;
  items: BankItem[];
  tabs: BankTab[];
  alwaysSetPlaceholder?: boolean;
  maxSlots: number;
}

interface BankItem {
  itemId: string;
  quantity: number;
  slot: number;
  tabIndex: number;
}

interface BankTab {
  tabIndex: number;
  iconItemId: string | null;
}
```

**Note**: RS3-style bank where placeholders are items with `quantity: 0`

#### StoreData

```typescript
interface StoreData {
  visible: boolean;
  storeId: string;
  storeName: string;
  buybackRate: number;
  items: StoreItem[];
  npcEntityId?: string;
}

interface StoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  stockQuantity: number;
  description?: string;
  category?: string;
}
```

#### DialogueData

```typescript
interface DialogueData {
  visible: boolean;
  npcId: string;
  npcName: string;
  text: string;
  responses: DialogueResponse[];
  npcEntityId?: string;
}

interface DialogueResponse {
  text: string;
  nextNodeId: string;
  effect?: string;
}
```

#### SmeltingData

```typescript
interface SmeltingData {
  visible: boolean;
  furnaceId: string;
  availableBars: SmeltingBar[];
}

interface SmeltingBar {
  barItemId: string;
  levelRequired: number;
  primaryOre: string;
  secondaryOre: string | null;
  coalRequired: number;
}
```

#### SmithingData

```typescript
interface SmithingData {
  visible: boolean;
  anvilId: string;
  availableRecipes: SmithingRecipe[];
}

interface SmithingRecipe {
  itemId: string;
  name: string;
  barType: string;
  barsRequired: number;
  levelRequired: number;
  xp: number;
  category: string;
  outputQuantity?: number;
}
```

#### CraftingData

```typescript
interface CraftingData {
  visible: boolean;
  availableRecipes: CraftingRecipeData[];
  station: string;
}

interface CraftingRecipeData {
  output: string;
  name: string;
  category: string;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}
```

#### FletchingData

```typescript
interface FletchingData {
  visible: boolean;
  availableRecipes: FletchingRecipeData[];
}

interface FletchingRecipeData {
  recipeId: string;
  output: string;
  name: string;
  category: string;
  outputQuantity: number;
  inputs: Array<{ item: string; amount: number }>;
  tools: string[];
  level: number;
  xp: number;
  meetsLevel: boolean;
  hasInputs: boolean;
}
```

#### TanningData

```typescript
interface TanningData {
  visible: boolean;
  availableRecipes: TanningRecipeData[];
}

interface TanningRecipeData {
  input: string;
  output: string;
  cost: number;
  name: string;
  hasHide: boolean;
  hideCount: number;
}
```

#### LootWindowData

```typescript
interface LootWindowData {
  visible: boolean;
  corpseId: string;
  corpseName: string;
  lootItems: InventoryItem[];
}
```

#### QuestStartData

```typescript
interface QuestStartData {
  visible: boolean;
  questId: string;
  questName: string;
  description: string;
  difficulty: string;
  requirements: {
    quests: string[];
    skills: Record<string, number>;
    items: string[];
  };
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}
```

#### QuestCompleteData

```typescript
interface QuestCompleteData {
  visible: boolean;
  questName: string;
  rewards: {
    questPoints: number;
    items: Array<{ itemId: string; quantity: number }>;
    xp: Record<string, number>;
  };
}
```

#### XpLampData

```typescript
interface XpLampData {
  visible: boolean;
  itemId: string;
  slot: number;
  xpAmount: number;
}
```

#### DuelData

```typescript
interface DuelData {
  visible: boolean;
  duelId: string;
  opponentId: string;
  opponentName: string;
  isChallenger: boolean;
  screenState: "RULES" | "STAKES" | "CONFIRMING";
  rules: {
    noRanged: boolean;
    noMelee: boolean;
    noMagic: boolean;
    noSpecialAttack: boolean;
    noPrayer: boolean;
    noPotions: boolean;
    noFood: boolean;
    noForfeit: boolean;
    noMovement: boolean;
    funWeapons: boolean;
  };
  equipmentRestrictions: {
    head: boolean;
    cape: boolean;
    amulet: boolean;
    weapon: boolean;
    body: boolean;
    shield: boolean;
    legs: boolean;
    gloves: boolean;
    boots: boolean;
    ring: boolean;
    ammo: boolean;
  };
  myAccepted: boolean;
  opponentAccepted: boolean;
  myStakes: Array<{
    inventorySlot: number;
    itemId: string;
    quantity: number;
    value: number;
  }>;
  opponentStakes: Array<{
    inventorySlot: number;
    itemId: string;
    quantity: number;
    value: number;
  }>;
  opponentModifiedStakes: boolean;
}
```

#### DuelResultData

```typescript
interface DuelResultData {
  visible: boolean;
  won: boolean;
  opponentName: string;
  itemsReceived: Array<{
    itemId: string;
    quantity: number;
    value: number;
  }>;
  itemsLost: Array<{
    itemId: string;
    quantity: number;
    value: number;
  }>;
  totalValueWon: number;
  totalValueLost: number;
  forfeit: boolean;
}
```

#### TradeData

```typescript
interface TradeData {
  visible: boolean;
  tradeId: string;
  partnerId: string;
  partnerName: string;
  partnerLevel: number;
  myOffer: TradeOfferItem[];
  myAccepted: boolean;
  theirOffer: TradeOfferItem[];
  theirAccepted: boolean;
  myOfferValue: number;
  theirOfferValue: number;
  partnerFreeSlots: number;
  screen: "offer" | "confirm";
}
```

## Event Handling

### World Events

| Event | Description | Handler |
|-------|-------------|---------|
| `BANK_OPEN` | Bank interface opened | `handleBankOpen` |
| `BANK_CLOSE` | Bank interface closed | `handleBankClose` |
| `STORE_OPEN` | Store interface opened | `handleStoreOpen` |
| `STORE_CLOSE` | Store interface closed | `handleStoreClose` |
| `DIALOGUE_START` | NPC dialogue started | `handleDialogueStart` |
| `DIALOGUE_END` | NPC dialogue ended | `handleDialogueEnd` |
| `SMELTING_INTERFACE_OPEN` | Smelting interface opened | `handleSmeltingOpen` |
| `SMITHING_INTERFACE_OPEN` | Smithing interface opened | `handleSmithingOpen` |
| `CRAFTING_INTERFACE_OPEN` | Crafting interface opened | `handleCraftingOpen` |
| `FLETCHING_INTERFACE_OPEN` | Fletching interface opened | `handleFletchingOpen` |
| `TANNING_INTERFACE_OPEN` | Tanning interface opened | `handleTanningOpen` |
| `CORPSE_CLICK` | Player clicked corpse/gravestone | `handleCorpseClick` |
| `QUEST_START_CONFIRM` | Quest start confirmation | `handleQuestStartConfirm` |
| `QUEST_COMPLETED` | Quest completed | `handleQuestCompleted` |
| `XP_LAMP_USE_REQUEST` | XP lamp skill selection | `handleXpLampUseRequest` |
| `UI_UPDATE` | Legacy UI update (backwards compat) | `handleUIUpdate` |

### Network Events

| Event | Description | Handler |
|-------|-------------|---------|
| `smeltingClose` | Server closed smelting interface | `handleSmeltingClose` |
| `smithingClose` | Server closed smithing interface | `handleSmithingClose` |
| `craftingClose` | Server closed crafting interface | `handleCraftingClose` |
| `fletchingClose` | Server closed fletching interface | `handleFletchingClose` |
| `tanningClose` | Server closed tanning interface | `handleTanningClose` |
| `duelError` | Duel error from server | `handleDuelError` |

### Legacy UI_UPDATE Events

The hook handles legacy `UI_UPDATE` events for backwards compatibility:

**Economy Panels**:
- `component: "bank"` - Bank state updates
- `component: "store"` - Store state updates
- `component: "dialogue"` - Dialogue state updates
- `component: "dialogueEnd"` - Dialogue ended
- `component: "smelting"` - Smelting interface updates
- `component: "smithing"` - Smithing interface updates
- `component: "crafting"` - Crafting interface updates
- `component: "fletching"` - Fletching interface updates
- `component: "tanning"` - Tanning interface updates

**Duel Panels**:
- `component: "duel"` - Duel interface opened
- `component: "duelRulesUpdate"` - Duel rules changed
- `component: "duelEquipmentUpdate"` - Equipment restrictions changed
- `component: "duelAcceptanceUpdate"` - Acceptance state changed
- `component: "duelStakesUpdate"` - Stakes changed
- `component: "duelStateChange"` - Screen state changed
- `component: "duelClose"` - Duel closed
- `component: "duelCancelled"` - Duel cancelled
- `component: "duelCompleted"` - Duel completed (shows result screen)

**Trade Panels**:
- `component: "trade"` - Trade interface opened
- `component: "tradeUpdate"` - Trade offer updated
- `component: "tradeConfirm"` - Trade confirmation screen
- `component: "tradeClose"` - Trade closed

## Close Handlers

All close handlers are memoized with `useCallback` for stable references:

```typescript
const closeBank = useCallback(() => setBankData(null), []);
const closeStore = useCallback(() => setStoreData(null), []);
const closeDialogue = useCallback(() => setDialogueData(null), []);
const closeSmelting = useCallback(() => setSmeltingData(null), []);
const closeSmithing = useCallback(() => setSmithingData(null), []);
const closeCrafting = useCallback(() => setCraftingData(null), []);
const closeFletching = useCallback(() => setFletchingData(null), []);
const closeTanning = useCallback(() => setTanningData(null), []);
const closeLootWindow = useCallback(() => setLootWindowData(null), []);
const closeQuestStart = useCallback(() => setQuestStartData(null), []);
const closeQuestComplete = useCallback(() => setQuestCompleteData(null), []);
const closeXpLamp = useCallback(() => setXpLampData(null), []);
const closeDuel = useCallback(() => setDuelData(null), []);
const closeDuelResult = useCallback(() => setDuelResultData(null), []);
const closeTrade = useCallback(() => setTradeData(null), []);
```

## Panel-Specific Details

### Bank Panel

**Features**:
- RS3-style placeholders (items with `quantity: 0`)
- Multi-tab support (up to 10 tabs)
- Tab icons (set via right-click menu)
- Always-set-placeholder toggle
- Max 480 slots (expandable)

**State Management**:
```typescript
// Open or update bank state
if (data.isOpen || data.items !== undefined) {
  setBankData((prev) => ({
    visible: true,
    items: data.items !== undefined ? itemsWithTabIndex : prev?.items || [],
    tabs: data.tabs !== undefined ? data.tabs : prev?.tabs || [],
    alwaysSetPlaceholder: data.alwaysSetPlaceholder ?? prev?.alwaysSetPlaceholder ?? false,
    maxSlots: data.maxSlots ?? prev?.maxSlots ?? 480,
    bankId: data.bankId ?? prev?.bankId ?? "spawn_bank",
  }));
}

// Server-authoritative close (player walked too far)
if (data.isOpen === false) {
  setBankData(null);
}
```

### Store Panel

**Features**:
- Buy/sell items
- Stock quantity tracking
- Buyback rate (default 0.5 = 50% of value)
- Category filtering
- NPC entity tracking

**State Management**:
```typescript
if (data.isOpen) {
  setStoreData({
    visible: true,
    storeId: data.storeId,
    storeName: data.storeName,
    buybackRate: data.buybackRate || 0.5,
    npcEntityId: data.npcEntityId,
    items: data.items || [],
  });
} else {
  setStoreData(null);
}
```

### Dialogue Panel

**Features**:
- NPC conversations
- Multiple response options
- Response effects (quest start, shop open, etc.)
- NPC entity tracking for camera focus

**State Management**:
```typescript
setDialogueData((prev) => ({
  visible: true,
  npcId: data.npcId,
  npcName: data.npcName || prev?.npcName || "NPC",  // Preserve name on node changes
  text: data.text,
  responses: data.responses || [],
  npcEntityId: data.npcEntityId || prev?.npcEntityId,  // Preserve entity ID
}));
```

### Duel Panel

**Features**:
- Three-screen flow: RULES → STAKES → CONFIRMING
- Combat rules (no ranged, no prayer, etc.)
- Equipment restrictions (no weapon, no armor, etc.)
- Stake items with value calculation
- Acceptance tracking for both players
- Opponent stake modification detection

**State Management**:
```typescript
// Rules update
setDuelData((prev) => {
  if (!prev || prev.duelId !== data.duelId) return prev;
  return {
    ...prev,
    rules: { ...prev.rules, ...data.rules },
    myAccepted: isChallenger ? data.challengerAccepted : data.targetAccepted,
    opponentAccepted: isChallenger ? data.targetAccepted : data.challengerAccepted,
  };
});

// Stakes update
setDuelData((prev) => {
  if (!prev || prev.duelId !== data.duelId) return prev;
  return {
    ...prev,
    myStakes: isChallenger ? data.challengerStakes : data.targetStakes,
    opponentStakes: isChallenger ? data.targetStakes : data.challengerStakes,
    opponentModifiedStakes: data.modifiedBy === prev.opponentId,
  };
});
```

### Trade Panel

**Features**:
- Two-screen flow: offer → confirm
- Item offer/remove
- Acceptance tracking
- Value calculation
- Partner free slots tracking

**State Management**:
```typescript
// Trade update (offer screen)
setTradeData((prev) => {
  if (!prev || prev.tradeId !== data.tradeId) return prev;
  return {
    ...prev,
    myOffer: data.myOffer || prev.myOffer,
    myAccepted: data.myAccepted,
    theirOffer: data.theirOffer || prev.theirOffer,
    theirAccepted: data.theirAccepted,
  };
});

// Trade confirm (confirmation screen)
setTradeData((prev) => {
  if (!prev || prev.tradeId !== data.tradeId) return prev;
  return {
    ...prev,
    screen: "confirm",
    myOfferValue: data.myOfferValue ?? prev.myOfferValue,
    theirOfferValue: data.theirOfferValue ?? prev.theirOfferValue,
  };
});
```

## Cleanup

The hook properly cleans up all event listeners on unmount:

```typescript
useEffect(() => {
  // ... register listeners
  
  return () => {
    // Unregister world event listeners
    world.off(EventType.BANK_OPEN, handleBankOpen);
    world.off(EventType.BANK_CLOSE, handleBankClose);
    // ... all other world events
    
    // Unregister network event listeners
    if (world.network) {
      world.network.off("smeltingClose", handleSmeltingClose);
      world.network.off("smithingClose", handleSmithingClose);
      // ... all other network events
    }
  };
}, [world]);
```

## Benefits

1. **Centralized State**: Single source of truth for all modal panels
2. **Shared Logic**: Used by both `InterfaceManager` and `MobileInterfaceManager`
3. **Consistent Close Handlers**: Memoized callbacks for stable references
4. **Type Safety**: Strongly typed panel data structures
5. **Backwards Compatibility**: Handles legacy `UI_UPDATE` events
6. **Proper Cleanup**: All listeners removed on unmount
7. **Player ID Filtering**: Quest/XP lamp events only for local player

## Related Hooks

- **usePlayerData** - Centralized player data subscription (inventory, equipment, stats, coins)
- **useMinimapTerrainCache** - Minimap terrain rendering
- **useMinimapEntityPips** - Minimap entity markers
- **useMinimapWorldCaches** - Minimap road/town caching

## See Also

- [UI Modernization Guide](./ui-modernization-march-2026.md) - Complete UI modernization details
- [usePlayerData API](./api-hooks-player-data.md) - Player data hook reference
- [Minimap Hooks API](./api-hooks-minimap.md) - Minimap hook reference
