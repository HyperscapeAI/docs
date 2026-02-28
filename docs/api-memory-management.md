# Memory Management API Reference

This document describes the memory management APIs added to prevent memory leaks in long-running Hyperscape sessions.

## Overview

Recent stability improvements added proper resource cleanup across the codebase. All cleanup methods follow the established patterns in `SystemBase` for consistent resource management.

## Core Pattern

All systems and managers that allocate resources (intervals, listeners, handlers) must implement cleanup methods:

```typescript
class MySystem {
  private listeners: Array<() => void> = [];
  private intervals: NodeJS.Timeout[] = [];

  init() {
    const listener = world.on('event', this.handleEvent);
    this.listeners.push(listener);
    
    const interval = setInterval(this.tick, 1000);
    this.intervals.push(interval);
  }

  destroy() {
    // Clean up listeners
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    
    // Clear intervals
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }
}
```

## API Changes

### ModelCache

**Location**: `packages/shared/src/utils/rendering/ModelCache.ts`

#### `clear(): void`
Clears all cached models and disposes GPU resources.

**Changes**:
- Now properly disposes geometry on all cached models
- Prevents GPU memory leaks during cache invalidation

```typescript
// Before: GPU memory leaked
modelCache.clear();

// After: Geometry properly disposed
modelCache.clear(); // Calls geometry.dispose() on all cached models
```

#### `remove(path: string): void`
Removes a specific model from cache and disposes its geometry.

**Changes**:
- Now disposes geometry before removing from cache
- Prevents GPU memory accumulation

### EventBridge

**Location**: `packages/server/src/systems/ServerNetwork/event-bridge.ts`

#### `destroy(): void` (NEW)
Cleans up all registered world event listeners.

**Usage**:
```typescript
const bridge = new EventBridge(world);
// ... use bridge ...
bridge.destroy(); // Clean up 50+ event listeners
```

**Impact**: Prevents listener accumulation on hot reload and server restart.

### Logger

**Location**: `packages/shared/src/utils/Logger.ts`

#### `destroy(): void` (NEW)
Stops cleanup interval and releases resources.

**Usage**:
```typescript
const logger = new Logger();
// ... use logger ...
logger.destroy(); // Stop cleanup interval
```

### PlayerTokenManager

**Location**: `packages/client/src/auth/PlayerTokenManager.ts`

#### `stopHeartbeat(): void` (NEW)
Stops the token refresh heartbeat interval.

**Usage**:
```typescript
playerTokenManager.stopHeartbeat(); // Called on logout/clear
```

**Impact**: Prevents heartbeat interval from continuing after logout.

### AgentManager

**Location**: `packages/server/src/eliza/AgentManager.ts`

#### `shutdown(): void`
Enhanced to clean up COMBAT_DAMAGE_DEALT listener.

**Changes**:
- Now stores and removes combat damage listener
- Prevents memory accumulation during agent lifecycle

```typescript
// Listener is now tracked and cleaned up
private damageListener?: () => void;

shutdown() {
  if (this.damageListener) {
    this.damageListener(); // Remove listener
    this.damageListener = undefined;
  }
}
```

### AutonomousBehaviorManager

**Location**: `packages/plugin-hyperscape/src/managers/autonomous-behavior-manager.ts`

#### `stop(): void`
Enhanced to clean up event handlers.

**Changes**:
- Now stores and removes all event handlers
- Prevents memory leaks during agent stop/start cycles

```typescript
private eventHandlers: Array<() => void> = [];

stop() {
  this.eventHandlers.forEach(remove => remove());
  this.eventHandlers = [];
}
```

### DuelBot

**Location**: `packages/shared/src/testing/DuelBot.ts`

Enhanced disconnect handling to clean up world event handlers.

**Changes**:
- Tracks `world.on()` handler references
- Removes all handlers on disconnect

## Best Practices

### 1. Track All Resources

Store references to all allocated resources:

```typescript
class MyManager {
  private intervals: NodeJS.Timeout[] = [];
  private listeners: Array<() => void> = [];
  private handlers: Map<string, () => void> = new Map();
}
```

### 2. Implement Cleanup Methods

Add `destroy()`, `shutdown()`, or `stop()` methods:

```typescript
destroy() {
  this.intervals.forEach(clearInterval);
  this.intervals = [];
  
  this.listeners.forEach(remove => remove());
  this.listeners = [];
  
  this.handlers.forEach(remove => remove());
  this.handlers.clear();
}
```

### 3. Call Cleanup on Lifecycle Events

Ensure cleanup is called during:
- Hot reload (development)
- System shutdown
- Component unmount
- Session end

### 4. Follow SystemBase Pattern

Use the same cleanup patterns as `SystemBase` for consistency:

```typescript
class MySystem extends SystemBase {
  private cleanupFns: Array<() => void> = [];

  init() {
    const remove = world.on('event', this.handler);
    this.cleanupFns.push(remove);
  }

  destroy() {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    super.destroy();
  }
}
```

## Testing for Memory Leaks

Monitor memory usage during long-running sessions:

```bash
# Run memory leak check script
bun run scripts/dev-memory-leak-check.mjs

# Monitor heap usage
node --expose-gc --inspect your-script.js
```

Look for:
- Increasing heap size over time
- Growing listener counts
- Accumulating interval handles
- GPU memory growth (check chrome://gpu)

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Memory Management section
- [AGENTS.md](../AGENTS.md) - Memory Management Best Practices
- [SystemBase](../packages/shared/src/systems/shared/infrastructure/SystemBase.ts) - Base cleanup pattern
