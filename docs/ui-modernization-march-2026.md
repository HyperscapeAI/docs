# Client UI Modernization & Startup Hardening (March 23-24, 2026)

**PR #1067**: Comprehensive client-side refactoring to modernize UI shell, improve startup reliability, and fix gameplay regressions.

## Summary

Modernized post-login client UI shell, panel internals, HUD composition, and minimap presentation. Hardened client startup/readiness, polling behavior, auth/bootstrap flow, and runtime sync with shared/server state. Fixed gameplay-facing regressions in combat controls, prayer initialization, altar praying, context menu layering, and related UI behaviors.

**Files Changed**: 166 files, 9,162 additions, 6,454 deletions

## Key Architectural Changes

### 1. Sidebar Deletion & Interface Manager Migration

**Removed**: `Sidebar.tsx` (1,345 lines) - Monolithic component managing all UI panels

**Replaced With**: `InterfaceManager` architecture with modular hooks and windowed panels

#### Before (Sidebar.tsx)
- Single 1,345-line component managing all panels
- Duplicate event listeners for inventory, equipment, stats
- Hardcoded radial menu positioning
- No window management or customization
- Tightly coupled panel state management

#### After (InterfaceManager)
- Modular hook-based architecture
- `usePlayerData` - Centralized player data subscription
- `useModalPanels` - Centralized modal panel state
- Draggable/resizable windows with `useWindowStore`
- Edit mode for interface customization
- Clean separation of concerns

### 2. Minimap Modularization

**Extracted** 772 lines of inline minimap logic into dedicated hooks:

#### useMinimapTerrainCache
**File**: `packages/client/src/game/hud/useMinimapTerrainCache.ts`

**Features**:
- Terrain rendering with biome coloring
- Chunked generation with cancellation support
- LRU biome color cache (max 256 entries)
- Zoom-aware detail levels
- Proper cleanup on unmount

**API**:
```typescript
export function useMinimapTerrainCache(params: {
  world: ClientWorld;
  width: number;
  height: number;
  zoom: number;
  isVisible: boolean;
}): {
  terrainCanvasRef: React.RefObject<HTMLCanvasElement>;
  clearTerrainCache: () => void;
}
```

**Implementation Details**:
- Uses `OffscreenCanvas` for terrain generation
- Chunked processing with `requestIdleCallback` for non-blocking generation
- Version-based cache invalidation
- Biome color caching with LRU eviction (256 entry limit)
- Cancellation support via version ref

#### useMinimapEntityPips
**File**: `packages/client/src/game/hud/useMinimapEntityPips.ts`

**Features**:
- Entity marker rendering (players, NPCs, resources)
- Icon caching with `OffscreenCanvas`
- Quest status indicators (available, in-progress, completed)
- Spectator target highlighting
- Extent culling for performance

**API**:
```typescript
export function useMinimapEntityPips(params: {
  world: ClientWorld;
  width: number;
  height: number;
  zoom: number;
  isVisible: boolean;
}): {
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  clearEntityCache: () => void;
}
```

**Implementation Details**:
- RAF-throttled updates (~30fps)
- Icon caching prevents redundant image loading
- Quest status detection from world state
- Spectator target highlighting with distinct styling
- Entity cache with `lastSeenTick` pruning

#### useMinimapWorldCaches
**File**: `packages/client/src/game/hud/useMinimapWorldCaches.ts`

**Features**:
- Road and town network caching
- Event-driven updates (`roads:generated`, `towns:generated`)
- Proper cleanup on unmount

**API**:
```typescript
export function useMinimapWorldCaches(params: {
  world: ClientWorld;
}): {
  roads: Array<{ from: TileCoord; to: TileCoord }>;
  towns: Array<{ name: string; position: TileCoord }>;
}
```

**Implementation Details**:
- Listens for world generation events
- Caches road/town data for minimap rendering
- Proper event listener cleanup

### 3. Player Data Context Provider

**New Hook**: `usePlayerData` eliminates duplicate event listeners across components

#### Before (duplicate subscriptions)
- `Sidebar.tsx` subscribed to inventory/equipment/stats events
- `CoreUI.tsx` subscribed to same events for StatusBars
- `Chat.tsx` subscribed to inventory events for item linking
- Each component had its own state management
- No coordination between components
- Cascading re-renders on every update

#### After (centralized subscription)

**File**: `packages/client/src/hooks/usePlayerData.ts`

**API**:
```typescript
// Provider component
export function PlayerDataProvider({ world, children }) {
  const value = usePlayerDataState(world);
  return (
    <PlayerDataContext.Provider value={value}>
      <PlayerStatsContext.Provider value={value.playerStats}>
        {children}
      </PlayerStatsContext.Provider>
    </PlayerDataContext.Provider>
  );
}

// Usage in CoreUI
<PlayerDataProvider world={world}>
  <CoreUIContent world={world} />
</PlayerDataProvider>

// Access in child components
const { inventory, equipment, playerStats, coins } = usePlayerDataContext();
const playerStats = usePlayerStatsContext();  // Stats only
```

**Equality Checks** (prevent unnecessary re-renders):
```typescript
function areInventoryItemsEqual(left, right): boolean;
function areEquipmentItemsEqual(left, right): boolean;
function arePlayerStatsEqual(left, right): boolean;
function areSkillsEqual(left, right): boolean;
function areStatusValuesEqual(left, right): boolean;
```

**Event Handling**:
- `INVENTORY_UPDATED` - Inventory items and coins
- `INVENTORY_UPDATE_COINS` - Coin count only
- `UI_EQUIPMENT_UPDATE` - Equipment changes
- `UI_UPDATE` - Player stats (health, prayer, combat level)
- `STATS_UPDATE` - Alternative stats event
- `SKILLS_UPDATED` - Skill XP and levels
- `PRAYER_STATE_SYNC` - Full prayer state
- `PRAYER_POINTS_CHANGED` - Prayer points only

**Benefits**:
- Single subscription per event type (eliminates duplicates)
- Proper equality checks prevent cascading re-renders
- Centralized state management
- Type-safe event payloads with guards
- Defensive cloning prevents shared reference bugs

### 4. Modal Panels Hook

**New Hook**: `useModalPanels` centralizes modal panel state management

**File**: `packages/client/src/hooks/useModalPanels.ts`

**API**:
```typescript
export function useModalPanels(world: ClientWorld): ModalPanelsState {
  // Returns state and setters for all modal panels
  return {
    // Panel data
    bankData,
    storeData,
    dialogueData,
    smeltingData,
    smithingData,
    craftingData,
    fletchingData,
    tanningData,
    lootWindowData,
    questStartData,
    questCompleteData,
    xpLampData,
    duelData,
    duelResultData,
    tradeData,
    
    // Setters
    setBankData,
    setStoreData,
    // ... etc
    
    // Close handlers
    closeBank,
    closeStore,
    // ... etc
  };
}
```

**Supported Panels**:
- **Bank**: RS3-style with placeholders (qty=0 items)
- **Store**: NPC shops with buy/sell
- **Dialogue**: NPC conversations with response options
- **Smelting**: Furnace interface for ore → bar
- **Smithing**: Anvil interface for bar → equipment
- **Crafting**: General crafting station
- **Fletching**: Arrow/bow crafting
- **Tanning**: Hide → leather processing
- **Loot Window**: Corpse/gravestone looting
- **Quest Start**: Quest acceptance screen
- **Quest Complete**: Quest reward screen
- **XP Lamp**: Skill selection for XP lamps
- **Duel**: Duel setup (rules, stakes, confirmation)
- **Duel Result**: Post-duel outcome screen
- **Trade**: Player-to-player trading

**Event Handling**:
- World events: `BANK_OPEN`, `STORE_OPEN`, `DIALOGUE_START`, etc.
- Network events: `smeltingClose`, `smithingClose`, `duelError`, etc.
- Legacy `UI_UPDATE` events for backwards compatibility

**Benefits**:
- Shared between `InterfaceManager` and `MobileInterfaceManager`
- Eliminates duplicate modal state management
- Consistent close handlers
- Type-safe panel data structures

### 5. Auth-Authoritative Startup

**Problem**: `restoreFromStorage()` was setting `isAuthenticated: true` from localStorage, causing invalid "loading" state when SDK later corrected it.

**Fix**: Only hydrate cached metadata, let Privy SDK be authoritative for session state

**File**: `packages/client/src/auth/PrivyAuthManager.ts`

**Implementation**:
```typescript
restoreFromStorage(): { token: string | null; userId: string | null } {
  const token = this.getValueFromKnownStorages("privy_auth_token");
  const userId = this.getValueFromKnownStorages("privy_user_id");
  const fid = this.getValueFromKnownStorages("farcaster_fid");
  
  if (token || userId) {
    this.updateState({
      // isAuthenticated NOT set - SDK is authoritative
      privyUserId: userId,
      privyToken: token,
      farcasterFid: fid,
    });
  }
  
  return { token, userId };
}

// Search across sessionStorage, localStorage, and configured storage
private getValueFromKnownStorages(key: string): string | null {
  const storages: Storage[] = [];
  const configuredStorage = this.getStorage();
  if (configuredStorage) storages.push(configuredStorage);
  if (typeof sessionStorage !== "undefined") storages.push(sessionStorage);
  if (typeof localStorage !== "undefined") storages.push(localStorage);
  
  for (const storage of storages) {
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // Ignore unavailable storage
    }
  }
  
  return null;
}
```

**Impact**:
- Prevents invalid "loading" state from stale localStorage
- Privy SDK is single source of truth for authentication
- Cached tokens useful for transitional UI
- No more startup stuck in loading state

### 6. Live World State Readiness

**Problem**: React state for `playerReady`, `physReady`, `terrainReady` could become stale and not reflect actual world state.

**Fix**: Derive readiness from live world state each render

**File**: `packages/client/src/game/CoreUI.tsx`

**Implementation**:
```typescript
// Hydrates from live world state instead of stale React state
const livePlayerReady = playerReady || 
  Boolean(world.entities.player?.avatar);
const livePhysReady = physReady || 
  Boolean(world.physics?.isInitialized?.());
const liveTerrainReady = terrainReady || terrainTimedOut || 
  Boolean(world.getSystem?.("terrain")?.isReady?.());

// Gate presentation on all subsystems + loading complete
const canPresent = livePlayerReady && livePhysReady && liveTerrainReady &&
  (loadingComplete || systemsComplete || assetsProgress >= 100);
```

**Terrain Timeout Handling**:
```typescript
// 20-second timeout for terrain initialization
if (performance.now() - startTime >= 20000) {
  if (isSpectatorMode) {
    // Spectator mode: show error screen with reload button
    setReadinessError("Timed out waiting for terrain to initialize. Refresh to retry.");
    return;
  }
  // Player mode: continue startup (terrain may load late)
  console.warn("[CoreUI] Terrain readiness timeout after 20s; continuing startup for player mode");
  setTerrainTimedOut(true);
  setTerrainReady(true);
}
```

**Loading Overlay Fade**:
```typescript
// Fade out loading overlay after readiness with 220ms delay
useEffect(() => {
  if (!ready) {
    setLoadingOverlayVisible(true);
    return;
  }
  
  loadingOverlayTimeoutRef.current = setTimeout(() => {
    setLoadingOverlayVisible(false);
  }, 220);
  
  return () => {
    if (loadingOverlayTimeoutRef.current) {
      clearTimeout(loadingOverlayTimeoutRef.current);
    }
  };
}, [ready]);
```

**Impact**:
- Startup gates are truthful and auth-authoritative
- No more stuck loading screens
- Graceful error recovery with actionable UI
- Smooth loading transitions

### 7. Dashboard Polling Optimization

**Problem**: Dashboard panels polling every 2-5s regardless of visibility, causing unnecessary network traffic and CPU usage.

**Fix**: Adaptive polling with visibility-aware scheduling

**Pattern** (used across all dashboard panels):
```typescript
// packages/client/src/game/dashboard/AgentGoalPanel.tsx
const fetchGoal = useCallback(async () => {
  if (inFlightRef.current) return;  // Prevent concurrent requests
  inFlightRef.current = true;
  try {
    // ... fetch logic
  } finally {
    inFlightRef.current = false;
  }
}, [agent.id]);

useEffect(() => {
  let cancelled = false;
  const schedule = (delay: number) => {
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    pollTimeoutRef.current = window.setTimeout(run, delay);
  };
  const run = async () => {
    await fetchGoal();
    if (!cancelled) {
      // Adaptive interval: 10s visible → 20s background
      schedule(!document.hidden && isViewportActive ? 10000 : 20000);
    }
  };
  const onVisibilityChange = () => {
    if (!cancelled) schedule(document.hidden ? 20000 : 1000);
  };
  
  void run();
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
  };
}, [agent.status, fetchGoal, isViewportActive]);
```

**Polling Intervals**:
| Panel | Active (Visible) | Background (Hidden) |
|-------|------------------|---------------------|
| Agent Goal | 10s | 20s |
| Agent Position | 5s | 10s |
| Agent Skills | 10s | 30s |
| Agent Summary | 10s | 30s |
| Agent Logs | 5s | 20s |
| Agent Thoughts | 3s | 6s |
| Agent Quests | 10s | 20s |

**Benefits**:
- Reduced network traffic when tab hidden
- Lower CPU usage in background
- Immediate poll on visibility change
- In-flight guards prevent concurrent requests
- Proper cleanup on unmount

### 8. UI Design System Updates

#### Z-Index Hierarchy
**File**: `packages/client/src/constants/tokens.ts`

```typescript
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  sidebar: 300,
  panel: 400,
  panelActive: 500,
  chat: 600,
  overlay: 800,
  modalBackdrop: 999,
  modal: 1000,
  tooltip: 1100,
  toast: 1200,        // NEW: Toast notifications
  contextMenu: 1300,  // NEW: Context menus
  critical: 10000,
  // Mobile HUD layers (7000-8000)
  mobileStatusHud: 7000,
  mobileMinimap: 7200,
  mobileActionBar: 7500,
  mobileChatOverlay: 7800,
  mobileDrawer: 8000,
};
```

#### UI Constants
**File**: `packages/client/src/constants/ui.ts`

```typescript
export const UI = {
  Z_INDEX: {
    CHAT_COLLAPSED: 35,
    CHAT_EXPANDED: zIndex.chat,
    OVERLAY: zIndex.overlay,      // NEW
    MODAL: zIndex.modal,
    TOOLTIP: zIndex.tooltip,
    TOAST: zIndex.toast,          // NEW
    CONTEXT_MENU: zIndex.contextMenu,  // NEW
    CRITICAL: zIndex.critical,    // NEW
  },
};
```

**Design Tokens**:
- Onyx/graphite color palette (moved from warm brown tones)
- Restrained metallic accents for better readability
- Unified panel styling across all UI surfaces
- Proper layer hierarchy for modals, overlays, and context menus

## Bug Fixes

### Combat Panel
**File**: `packages/client/src/game/panels/CombatPanel.tsx`

**Fixes**:
- Fixed target health display with conditional rendering (prevents "Cannot read properties of null")
- Streamlined style button and stat display layouts
- Proper null checks before accessing `targetHealth.current`

**Before**:
```typescript
<div style={{ display: targetHealth ? "block" : "none" }}>
  {targetHealth.current} / {targetHealth.max}  // Crashes if targetHealth is null
</div>
```

**After**:
```typescript
{targetHealth && (
  <div>
    {targetHealth.current} / {targetHealth.max}
  </div>
)}
```

### UI Visibility
**File**: `packages/client/src/game/CoreUI.tsx`

**Problem**: Broken `UI_UPDATE` listener hid entire UI overlay on first health/inventory update

**Fix**: Removed broken listener, overlay now always `display: block`

**Before**:
```typescript
const [ui, setUi] = useState({ visible: true });

const handleUI = (raw: unknown) => {
  setUi(raw as { visible: boolean });  // Most events don't have 'visible' property
};

world.on(EventType.UI_UPDATE, handleUI);

// CSS
<div style={{ display: resolveGameClientUiDisplay(ui.visible) }}>
  // ui.visible becomes undefined → display: none
</div>
```

**After**:
```typescript
// Removed broken listener and dead state
// Overlay is always display: block
// Per-component visibility handled by hideUI prop and filtered handlers
<div style={{ display: "block" }}>
  {/* Component-level visibility */}
</div>
```

### Prayer System
**File**: `packages/shared/src/systems/shared/character/PrayerSystem.ts`

**Fixes**:
1. **Async Event Handlers**: Converted to sync with `.then()/.catch()` to prevent unhandled promise rejections on EventEmitter3
2. **Prayer Level Calculation**: Fixed `getPlayerPrayerLevel()` usage with fallback instead of `Math.max()` which could bypass level checks
3. **Lazy Initialization**: Added recovery to prevent missed lifecycle events

**Before**:
```typescript
// Async handler on sync emitter - promise rejections not caught
private async onPrayerToggle(data: unknown) {
  await this.ensurePlayerPrayerInitialized(playerId);
  this.handlePrayerToggle(playerId, prayerId);
}

// Math.max could bypass level requirements
const prayerLevel = Math.max(
  state.maxPoints,
  getPlayerPrayerLevel(player)
);
```

**After**:
```typescript
// Sync handler with promise chain
private onPrayerToggle(data: unknown) {
  this.ensurePlayerPrayerInitialized(playerId)
    .then(() => this.handlePrayerToggle(playerId, prayerId))
    .catch((err) => console.error("[PrayerSystem] Toggle failed:", err));
}

// Proper fallback without bypassing level checks
const prayerLevel = getPlayerPrayerLevel(player) ?? state.maxPoints ?? 1;
```

### Modal Window
**File**: `packages/client/src/ui/components/ModalWindow.tsx`

**Fixes**:
1. **Body Overflow**: Ref-counted management fixes stacked modal close ordering
2. **Resize Listeners**: Store listeners for cleanup on unmount during mid-drag

**Before**:
```typescript
// Each modal captures originalOverflow on mount
// If modals close out-of-order, wrong overflow is restored
useEffect(() => {
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, []);
```

**After**:
```typescript
// Ref-counted overflow management
let modalCount = 0;
let originalOverflow: string | null = null;

useEffect(() => {
  if (modalCount === 0) {
    originalOverflow = document.body.style.overflow;
  }
  modalCount++;
  document.body.style.overflow = "hidden";
  
  return () => {
    modalCount--;
    if (modalCount === 0 && originalOverflow !== null) {
      document.body.style.overflow = originalOverflow;
    }
  };
}, []);
```

### Minimap
**File**: `packages/client/src/game/hud/Minimap.tsx`

**Fixes**:
1. **Resize Listeners**: Store listeners for cleanup on unmount during mid-drag
2. **Towns Event**: Added missing `towns:generated` event listener
3. **Terrain Generation**: Added `.catch()` on fire-and-forget promises

**Before**:
```typescript
// Listeners not stored - can't clean up on unmount during drag
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);

// Missing towns event
world.on("roads:generated", refreshCaches);
// towns:generated not handled

// Fire-and-forget promise - errors swallowed
void generateTerrainChunked(...).then(...);
```

**After**:
```typescript
// Store listeners for cleanup
const listeners = {
  pointermove: handlePointerMove,
  pointerup: handlePointerUp,
};
window.addEventListener("pointermove", listeners.pointermove);
window.addEventListener("pointerup", listeners.pointerup);

// Cleanup on unmount
useEffect(() => {
  return () => {
    window.removeEventListener("pointermove", listeners.pointermove);
    window.removeEventListener("pointerup", listeners.pointerup);
  };
}, []);

// Added towns event
world.on("roads:generated", refreshCaches);
world.on("towns:generated", refreshCaches);  // NEW

// Catch errors
void generateTerrainChunked(...)
  .then(...)
  .catch((err) => console.error("[Minimap] Terrain generation failed:", err));
```

### Other Component Fixes

**DeathScreen**: Use stable `setInterval` instead of chained `setTimeout` that stalls

**LevelUpNotification**: Restore periodic `setInterval` for `processedRef` cleanup

**LoadingScreen**: Sync `loadingStage` state when `message` prop changes

**NotificationContainer**: Use `TOAST` z-index layer instead of `TOOLTIP`

**PlayerRemote**: Cache `isRemoteDeathTraceEnabled()` to avoid per-frame allocation

**Window**: Remove unused `viewportEdgeMargin` from useMemo deps

## Type Safety Improvements

### Frontend Typecheck Clean
**Resolved all type errors** across:
- `packages/client`
- `packages/shared`
- `packages/website`

**Key Fixes**:
- Fixed `SetStateAction<number>` type narrowing for coins setter
- Fixed unknown catch variable passed to `logger.warn`
- Proper type guards for all event payloads
- Removed unsafe type assertions

### Asset-Forge Build
**File**: `packages/asset-forge/src/services/hand-rigging/HandPoseDetectionService.ts`

**Fixes**:
- Made builds portable with lazy-load hand detection
- Fixed TensorFlow.js import path to use explicit `/dist/index.js`
- Lazy-loaded `@mediapipe/hands` and `@tensorflow-models/hand-pose-detection`

**Before**:
```typescript
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import "@mediapipe/hands";  // Eager load causes build errors
```

**After**:
```typescript
import type { HandDetector, MediaPipeHandsMediaPipeModelConfig } from "@tensorflow-models/hand-pose-detection";

// Lazy load to prevent build errors
const [{ default: _unused }, handPoseDetection] = await Promise.all([
  import(/* @vite-ignore */ "@mediapipe/hands"),
  import(/* @vite-ignore */ "@tensorflow-models/hand-pose-detection"),
]);
```

### Website Build
**File**: `packages/website/src/index.tsx`

**Fixes**:
- Made production build offline-safe
- Fixed manifest loading and asset-base resolution
- Proper error handling for missing manifests

## Configuration Changes

### WebSocket Port Default
**File**: `packages/client/.env.example`

**Change**:
```bash
# OLD: ws://localhost:5555/ws
# NEW: ws://localhost:5556/ws (uWS port)

PUBLIC_WS_URL=ws://localhost:5556/ws

# Fallback to Fastify WebSocket (if UWS_ENABLED=false)
PUBLIC_WS_URL=ws://localhost:5555/ws
```

**Impact**: Clients now connect to uWS port by default for better performance

### Asset Base URL
**File**: `packages/client/src/lib/api-config.ts`

**New Function**:
```typescript
export function getRuntimeAssetBaseUrl(): string {
  // Replaces hardcoded GAME_API_URL for manifest icon resolution
  // Priority: window.__ASSETS_URL > PUBLIC_CDN_URL > PUBLIC_API_URL
  
  if (typeof window !== "undefined" && window.__ASSETS_URL) {
    return window.__ASSETS_URL;
  }
  
  if (import.meta.env.PUBLIC_CDN_URL) {
    return import.meta.env.PUBLIC_CDN_URL;
  }
  
  return import.meta.env.PUBLIC_API_URL || "http://localhost:5555";
}
```

**Usage**:
```typescript
// packages/client/src/components/streaming/AgentStatsDisplay.tsx
// OLD: const base = GAME_API_URL.replace(/\/$/, "");
// NEW: const base = getRuntimeAssetBaseUrl().replace(/\/$/, "");

const iconPath = `${base}/${relativePath}`;
```

**Impact**: Proper asset URL resolution respecting runtime configuration

## Performance Optimizations

### Render Optimization
- **InterfaceModalsRenderer**: Wrapped in `React.memo()` with memoized `compactInventory`
- **StatusBars**: Replaced 500ms polling with `CustomEvent` listener
- **Chat Inventory**: Added `isInventoryEqual()` check to prevent unnecessary updates
- **PlayerRemote**: Cached `isRemoteDeathTraceEnabled()` to avoid per-frame allocation

### Polling Reduction
**Files**: All dashboard components

**Changes**:
- Adaptive polling intervals based on document visibility
- In-flight guards prevent concurrent fetch requests
- Visibility change triggers immediate poll
- Proper cleanup on unmount

**Example** (AgentActivityPanel):
```typescript
// OLD: setInterval(fetchActivity, 10000)
// NEW: Adaptive setTimeout with visibility awareness

useEffect(() => {
  let cancelled = false;
  const schedule = (delay: number) => {
    pollTimeoutRef.current = window.setTimeout(run, delay);
  };
  const run = async () => {
    await fetchActivity();
    if (!cancelled) {
      const nextDelay = !document.hidden && isViewportActive ? 10000 : 20000;
      schedule(nextDelay);
    }
  };
  
  void run();
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    cancelled = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
  };
}, [agent.status, fetchActivity, isViewportActive]);
```

## Breaking Changes

### WebSocket Port
**Default changed from 5555 → 5556**

**Migration**:
```bash
# Update packages/client/.env
PUBLIC_WS_URL=ws://localhost:5556/ws

# Or fallback to Fastify (set in packages/server/.env)
UWS_ENABLED=false
PUBLIC_WS_URL=ws://localhost:5555/ws
```

### Removed Components
- `Sidebar.tsx` - Use `InterfaceManager` instead
- Inline minimap logic - Use minimap hooks instead

**Migration**: No action required - components automatically use new architecture

## New Files

### Hooks
- `packages/client/src/hooks/usePlayerData.ts` - Centralized player data subscription
- `packages/client/src/hooks/useModalPanels.ts` - Centralized modal panel state

### Minimap Hooks
- `packages/client/src/game/hud/useMinimapTerrainCache.ts` - Terrain rendering
- `packages/client/src/game/hud/useMinimapEntityPips.ts` - Entity markers
- `packages/client/src/game/hud/useMinimapWorldCaches.ts` - Road/town caching

### Utilities
- `packages/client/src/lib/api-config.ts` - Added `getRuntimeAssetBaseUrl()`

## Modified Files Summary

**UI Panels** (40+ files):
- Inventory, Skills, Combat, Equipment, Settings, Account
- Bank, Store, Dialogue, Smelting, Smithing, Crafting, Fletching, Tanning
- Quest Journal, Quest Complete, Quest Start
- Trade, Duel, Duel Result
- Loot Window, XP Lamp

**Dashboard Components** (15+ files):
- AgentActivityPanel, AgentGoalPanel, AgentPositionPanel
- AgentSkillsPanel, AgentSummaryCard, AgentLogs
- AgentMemories, AgentRuns, AgentSettings
- AgentThoughtsOverlay, AgentThoughtsPanel, AgentTimeline
- AgentViewport, AgentViewportChat

**Core UI** (20+ files):
- CoreUI, GameClient, StreamingMode, EmbeddedGameClient
- InterfaceManager, InterfaceModals, MobileInterfaceManager
- LoadingScreen, LoginScreen, CharacterSelectScreen
- StatusBars, ActionProgressBar, EntityContextMenu
- Minimap, MinimapCompass

**Hooks and Utilities** (10+ files):
- usePlayerData, useModalPanels, useInterfaceEvents
- useMinimapTerrainCache, useMinimapEntityPips, useMinimapWorldCaches
- api-config, equipment utils, type guards

**Type Definitions** (5+ files):
- Event type guards, player data types, modal panel types
- Equipment types, inventory types

## Testing

**Validation**:
- Targeted eslint passes on each touched slice during development
- Frontend-relevant typecheck brought clean across `packages/client`, `packages/shared`, and `packages/website`
- Repo build issues addressed for website and asset-forge

**No New Tests**: This PR intentionally modernizes and repairs existing architecture rather than adding new features. Integration tests for prayer system, combat controls, and minimap rendering would be valuable additions.

## Migration Guide

### For Developers

**No action required** - the changes are backwards compatible:
- Old panel references automatically route to new architecture
- Event listeners work with both old and new systems
- No API changes for game logic

**Recommended**:
1. Update `PUBLIC_WS_URL` in `packages/client/.env` to use port 5556
2. Clear browser cache after pulling changes (Cmd+Shift+R / Ctrl+Shift+R)
3. Restart dev server to pick up new hooks

### For Custom UI Extensions

**If you've customized UI panels**:
1. Check for direct `Sidebar.tsx` imports - replace with `InterfaceManager`
2. Update z-index values to use `zIndex` constants from `tokens.ts`
3. Use `usePlayerDataContext()` instead of subscribing to events directly
4. Use `useModalPanels()` for modal panel state

**Example Migration**:
```typescript
// OLD: Direct event subscription
const [inventory, setInventory] = useState([]);
useEffect(() => {
  world.on(EventType.INVENTORY_UPDATED, (data) => {
    setInventory(data.items);
  });
}, [world]);

// NEW: Use context
const { inventory } = usePlayerDataContext();
```

## Known Issues

**None** - All known issues from PR review have been addressed:
- DeathScreen countdown stall fixed
- LevelUpNotification cleanup restored
- LoadingScreen message sync fixed
- NotificationContainer z-index corrected
- Prayer system async handlers fixed
- Modal window body overflow fixed
- Minimap resize listener cleanup fixed
- Window viewportEdgeMargin deps fixed

## Future Improvements

**Potential Enhancements**:
1. Add Playwright tests for prayer system and combat controls
2. Extract minimap icon caching to shared utility
3. Consolidate duplicate `getSpectatorTarget` implementations
4. Add focus trap hook to eliminate duplication between ModalWindow and InterfaceModals
5. Consider `useReducer` for modal panel state (currently 15 separate `useState` hooks)

## References

- **PR #1067**: https://github.com/HyperscapeAI/hyperscape/pull/1067
- **Commits**: 73 commits from March 23, 2026
- **Review Comments**: 6 detailed code reviews with 50+ findings addressed
