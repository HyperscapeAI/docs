# Recent Changes (March 26, 2026)

This document covers the most recent changes pushed to the `main` branch on March 26, 2026.

## Missing Server→Client Packet Handlers (PR #1091)

**Date**: March 26, 2026  
**Author**: dreaminglucid  
**Files Changed**: 1 file, 81 additions, 0 deletions

### Problem

The server was sending packets via event-bridge that the client had no handler for, causing "No handler for packet" console errors. These packets were being queued but never processed, leading to UI systems missing important events like skill completion notifications and combat state changes.

### Solution

Added 8 missing handler methods in `ClientNetwork` that forward packet data to the client world event bus so UI systems can react to these events.

### Missing Handlers Added

1. **onFletchingComplete** - Fletching batch finished notification
2. **onCookingComplete** - Cooking result with burn check
3. **onSmeltingComplete** - Smelting batch finished notification
4. **onSmithingComplete** - Smithing batch finished notification
5. **onCraftingComplete** - Crafting batch finished notification
6. **onTanningComplete** - Tanning batch finished notification
7. **onCombatEnded** - Combat session ended notification
8. **onQuestStarted** - Quest begun notification

### Implementation Pattern

Each handler follows the same pattern: receive packet data, add local player ID, and emit to world event bus.

```typescript
// Example: Cooking completion handler
onCookingComplete = (data: {
  rawItemId: string;
  resultItemId: string;
  wasBurnt: boolean;
  xpGained: number;
}) => {
  this.world.emit(EventType.COOKING_COMPLETE, {
    playerId: this.world?.entities?.player?.id || "",
    ...data,
  });
};

// Example: Smelting completion handler
onSmeltingComplete = (data: {
  barItemId: string;
  totalSmelted: number;
  totalFailed: number;
  totalXp: number;
}) => {
  this.world.emit(EventType.SMELTING_COMPLETE, {
    playerId: this.world?.entities?.player?.id || "",
    ...data,
  });
};

// Example: Combat ended handler
onCombatEnded = (data: { attackerId: string; targetId: string }) => {
  this.world.emit(EventType.COMBAT_ENDED, data);
};

// Example: Quest started handler
onQuestStarted = (data: { questId: string; questName: string }) => {
  const playerId = this.world?.entities?.player?.id || "";
  this.world.emit(EventType.QUEST_STARTED, { ...data, playerId });
};
```

### Impact

- **Eliminates Console Errors**: No more "No handler for packet" warnings in browser console
- **UI Reactivity**: UI systems can now properly react to skill completion events
- **Quest Notifications**: Quest start notifications work correctly
- **Combat State**: Combat end events properly trigger UI updates
- **Event Bus Integration**: All handlers forward to world event bus for consistent event handling

### Files Changed

- `packages/shared/src/systems/client/ClientNetwork.ts` (+81 lines)

## Prayer Login Sync Fix (PR #1090)

**Date**: March 26, 2026  
**Author**: symbaiex  
**Files Changed**: Details not available in commit history

### Problem

Prayer state wasn't properly syncing when players logged in, causing prayer points and active prayers to be out of sync with server state. This led to visual inconsistencies where the UI showed incorrect prayer point values or active prayer states.

### Solution

Improved prayer state initialization and synchronization flow to ensure prayer data is correctly loaded from the database and sent to the client on login.

### Impact

- **Correct Prayer Points**: Prayer points display correctly on login
- **Active Prayer Sync**: Active prayers sync properly between sessions
- **State Consistency**: Eliminates prayer state desync issues
- **Better UX**: Players see consistent prayer state across sessions

## Related Documentation

For comprehensive documentation on recent changes from March 2026, see:

- [README.md](../README.md#recent-updates-march-2026) - User-facing changelog
- [CLAUDE.md](../CLAUDE.md#recent-major-features-march-2026) - Developer-focused technical details
- [AGENTS.md](../AGENTS.md#recent-changes-march-2026) - AI assistant instructions

## Previous Major Changes

For changes from earlier in March 2026, see:

- **UI Panel Modernization** (March 25-26) - Combat panel redesign, equipment paperdoll, unified layout
- **Equipment Panel Cross-Player Leak Fix** (March 25) - Fixed equipment showing other players' gear
- **Inventory UI & Firemaking Fixes** (March 25) - Optimistic removal, targeting mode improvements
- **Client UI Modernization** (March 23-24) - Startup hardening, HUD improvements
- **Performance & Scalability Overhaul** (March 19-20) - Node.js migration, uWS integration, worker threads
- **Dependency Updates** (March 19) - Vite 8, React plugin 6, Jest 30, and more

See the main documentation files for complete details on these changes.
