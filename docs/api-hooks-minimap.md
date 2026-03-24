# Minimap Hooks API Reference

**Files**: 
- `packages/client/src/game/hud/useMinimapTerrainCache.ts`
- `packages/client/src/game/hud/useMinimapEntityPips.ts`
- `packages/client/src/game/hud/useMinimapWorldCaches.ts`

**Added**: March 2026 (PR #1067)

## Overview

Modular React hooks for minimap rendering, extracted from 772 lines of inline logic in `Minimap.tsx`. Provides terrain rendering, entity markers, and world caches (roads/towns) with proper cleanup and performance optimizations.

## useMinimapTerrainCache

**File**: `packages/client/src/game/hud/useMinimapTerrainCache.ts`

### Purpose

Handles terrain rendering with biome coloring, chunked generation, and zoom-aware detail levels.

### API

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

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `world` | `ClientWorld` | Game world instance |
| `width` | `number` | Minimap width in pixels |
| `height` | `number` | Minimap height in pixels |
| `zoom` | `number` | Zoom level (tiles visible) |
| `isVisible` | `boolean` | Whether minimap is visible |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `terrainCanvasRef` | `React.RefObject<HTMLCanvasElement>` | Ref to terrain canvas element |
| `clearTerrainCache` | `() => void` | Function to clear terrain cache |

### Features

**Chunked Generation**:
- Uses `requestIdleCallback` for non-blocking terrain generation
- Processes terrain in chunks to avoid blocking main thread
- Cancellable via version ref

**Biome Coloring**:
- LRU cache for biome colors (max 256 entries)
- Automatic eviction when cache exceeds limit
- Consistent colors across terrain tiles

**Zoom-Aware Detail**:
- Adjusts terrain detail based on zoom level
- Higher zoom = more detail
- Lower zoom = less detail for performance

**Version-Based Cache Invalidation**:
- Increments version on camera move or zoom change
- Cancels in-flight generation when version changes
- Prevents stale terrain from rendering

### Usage Example

```typescript
import { useMinimapTerrainCache } from '@/game/hud/useMinimapTerrainCache';

function Minimap({ world, width, height, zoom, isVisible }) {
  const { terrainCanvasRef, clearTerrainCache } = useMinimapTerrainCache({
    world,
    width,
    height,
    zoom,
    isVisible,
  });
  
  return (
    <div className="minimap">
      <canvas ref={terrainCanvasRef} width={width} height={height} />
      <button onClick={clearTerrainCache}>Clear Cache</button>
    </div>
  );
}
```

### Implementation Details

**OffscreenCanvas**:
```typescript
const offscreenCanvas = new OffscreenCanvas(width, height);
const ctx = offscreenCanvas.getContext("2d");
```

**Biome Color Cache**:
```typescript
const biomeColorCache = new Map<string, CachedBiomeColor | null>();

// LRU eviction when cache exceeds 256 entries
if (biomeColorCache.size > 256) {
  const firstKey = biomeColorCache.keys().next().value;
  biomeColorCache.delete(firstKey);
}
```

**Chunked Generation**:
```typescript
async function generateTerrainChunked(
  world: ClientWorld,
  centerX: number,
  centerZ: number,
  zoom: number,
  width: number,
  height: number,
  version: number
): Promise<ImageData> {
  // Process in chunks with requestIdleCallback
  for (let chunk = 0; chunk < totalChunks; chunk++) {
    if (versionRef.current !== version) {
      // Cancelled - new request started
      return null;
    }
    
    // Process chunk
    await new Promise((resolve) => requestIdleCallback(resolve));
  }
  
  return ctx.getImageData(0, 0, width, height);
}
```

### Cleanup

```typescript
useEffect(() => {
  // ... setup
  
  return () => {
    // Clear terrain cache on unmount
    clearTerrainCache();
  };
}, []);
```

## useMinimapEntityPips

**File**: `packages/client/src/game/hud/useMinimapEntityPips.ts`

### Purpose

Handles entity marker rendering (players, NPCs, resources) with icon caching and quest status indicators.

### API

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

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `world` | `ClientWorld` | Game world instance |
| `width` | `number` | Minimap width in pixels |
| `height` | `number` | Minimap height in pixels |
| `zoom` | `number` | Zoom level (tiles visible) |
| `isVisible` | `boolean` | Whether minimap is visible |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `overlayCanvasRef` | `React.RefObject<HTMLCanvasElement>` | Ref to overlay canvas element |
| `clearEntityCache` | `() => void` | Function to clear entity cache |

### Features

**Icon Caching**:
- Uses `OffscreenCanvas` to cache entity icons
- Prevents redundant image loading
- Shared cache across all entity instances

**Quest Status Indicators**:
- Quest available (yellow exclamation mark)
- Quest in progress (blue question mark)
- Quest completed (green checkmark)
- Detects quest status from world state

**Spectator Target Highlighting**:
- Highlights spectated player with distinct styling
- Larger pip size for visibility
- Different color for spectator target

**Extent Culling**:
- Only renders entities within minimap bounds
- Improves performance with many entities
- Automatic culling based on camera position and zoom

**Entity Cache Pruning**:
- Tracks `lastSeenTick` for each entity
- Prunes stale entries (not seen in 100 ticks)
- Prevents unbounded cache growth

### Usage Example

```typescript
import { useMinimapEntityPips } from '@/game/hud/useMinimapEntityPips';

function Minimap({ world, width, height, zoom, isVisible }) {
  const { overlayCanvasRef, clearEntityCache } = useMinimapEntityPips({
    world,
    width,
    height,
    zoom,
    isVisible,
  });
  
  return (
    <div className="minimap">
      <canvas ref={overlayCanvasRef} width={width} height={height} />
      <button onClick={clearEntityCache}>Clear Cache</button>
    </div>
  );
}
```

### Implementation Details

**RAF-Throttled Updates**:
```typescript
useEffect(() => {
  if (!isVisible) return;
  
  let rafId: number;
  const update = () => {
    renderEntityPips();
    rafId = requestAnimationFrame(update);
  };
  
  rafId = requestAnimationFrame(update);
  
  return () => {
    cancelAnimationFrame(rafId);
  };
}, [isVisible, world, width, height, zoom]);
```

**Icon Caching**:
```typescript
const iconCache = new Map<string, OffscreenCanvas>();

function getOrCreateIcon(iconPath: string): OffscreenCanvas {
  if (iconCache.has(iconPath)) {
    return iconCache.get(iconPath)!;
  }
  
  const canvas = new OffscreenCanvas(16, 16);
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = iconPath;
  img.onload = () => ctx.drawImage(img, 0, 0, 16, 16);
  
  iconCache.set(iconPath, canvas);
  return canvas;
}
```

**Quest Status Detection**:
```typescript
function getQuestSubType(entity: Entity): string | null {
  const quests = world.getSystem("quest")?.getQuestsForNPC?.(entity.id);
  if (!quests || quests.length === 0) return null;
  
  const hasAvailable = quests.some((q) => q.status === "available");
  const hasActive = quests.some((q) => q.status === "active");
  const allCompleted = quests.every((q) => q.status === "completed");
  
  if (hasAvailable) return "quest_available";
  if (hasActive) return "quest_in_progress";
  if (allCompleted) return "quest_completed";
  
  return null;
}
```

### Cleanup

```typescript
useEffect(() => {
  // ... setup
  
  return () => {
    // Clear entity cache on unmount
    clearEntityCache();
    iconCache.clear();
  };
}, []);
```

## useMinimapWorldCaches

**File**: `packages/client/src/game/hud/useMinimapWorldCaches.ts`

### Purpose

Handles road and town network caching with event-driven updates.

### API

```typescript
export function useMinimapWorldCaches(params: {
  world: ClientWorld;
}): {
  roads: Array<{ from: TileCoord; to: TileCoord }>;
  towns: Array<{ name: string; position: TileCoord }>;
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `world` | `ClientWorld` | Game world instance |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `roads` | `Array<{ from: TileCoord; to: TileCoord }>` | Road network segments |
| `towns` | `Array<{ name: string; position: TileCoord }>` | Town locations |

### Features

**Event-Driven Updates**:
- Listens for `roads:generated` event
- Listens for `towns:generated` event
- Automatically refreshes caches when world data changes

**Proper Cleanup**:
- Removes event listeners on unmount
- Prevents memory leaks

### Usage Example

```typescript
import { useMinimapWorldCaches } from '@/game/hud/useMinimapWorldCaches';

function Minimap({ world }) {
  const { roads, towns } = useMinimapWorldCaches({ world });
  
  return (
    <div className="minimap">
      {roads.map((road, i) => (
        <RoadSegment key={i} from={road.from} to={road.to} />
      ))}
      {towns.map((town, i) => (
        <TownMarker key={i} name={town.name} position={town.position} />
      ))}
    </div>
  );
}
```

### Implementation Details

**Event Listeners**:
```typescript
useEffect(() => {
  const refreshCaches = () => {
    const roadSystem = world.getSystem("road");
    const townSystem = world.getSystem("town");
    
    setRoads(roadSystem?.getRoads?.() || []);
    setTowns(townSystem?.getTowns?.() || []);
  };
  
  world.on("roads:generated", refreshCaches);
  world.on("towns:generated", refreshCaches);
  
  // Initial load
  refreshCaches();
  
  return () => {
    world.off("roads:generated", refreshCaches);
    world.off("towns:generated", refreshCaches);
  };
}, [world]);
```

### Cleanup

```typescript
useEffect(() => {
  // ... setup
  
  return () => {
    // Remove event listeners on unmount
    world.off("roads:generated", refreshCaches);
    world.off("towns:generated", refreshCaches);
  };
}, [world]);
```

## Common Patterns

### Combining All Minimap Hooks

```typescript
import {
  useMinimapTerrainCache,
  useMinimapEntityPips,
  useMinimapWorldCaches,
} from '@/game/hud';

function Minimap({ world, width, height, zoom, isVisible }) {
  // Terrain rendering
  const { terrainCanvasRef, clearTerrainCache } = useMinimapTerrainCache({
    world,
    width,
    height,
    zoom,
    isVisible,
  });
  
  // Entity markers
  const { overlayCanvasRef, clearEntityCache } = useMinimapEntityPips({
    world,
    width,
    height,
    zoom,
    isVisible,
  });
  
  // Road/town caching
  const { roads, towns } = useMinimapWorldCaches({ world });
  
  return (
    <div className="minimap" style={{ width, height }}>
      {/* Terrain layer */}
      <canvas
        ref={terrainCanvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      
      {/* Entity layer */}
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      
      {/* Road/town overlays */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {roads.map((road, i) => (
          <line
            key={i}
            x1={worldToScreen(road.from.x)}
            y1={worldToScreen(road.from.z)}
            x2={worldToScreen(road.to.x)}
            y2={worldToScreen(road.to.z)}
            stroke="rgba(139, 69, 19, 0.6)"
            strokeWidth="2"
          />
        ))}
        {towns.map((town, i) => (
          <circle
            key={i}
            cx={worldToScreen(town.position.x)}
            cy={worldToScreen(town.position.z)}
            r="4"
            fill="rgba(242, 208, 138, 0.8)"
          />
        ))}
      </svg>
    </div>
  );
}
```

### Clearing All Caches

```typescript
function Minimap({ world, width, height, zoom, isVisible }) {
  const terrain = useMinimapTerrainCache({ world, width, height, zoom, isVisible });
  const entities = useMinimapEntityPips({ world, width, height, zoom, isVisible });
  
  const clearAllCaches = () => {
    terrain.clearTerrainCache();
    entities.clearEntityCache();
  };
  
  return (
    <div>
      {/* ... minimap rendering */}
      <button onClick={clearAllCaches}>Clear All Caches</button>
    </div>
  );
}
```

## Performance Considerations

### Terrain Cache

**Chunked Generation**:
- Processes terrain in small chunks
- Uses `requestIdleCallback` to avoid blocking
- Cancellable when camera moves

**Biome Color Cache**:
- LRU eviction prevents unbounded growth
- Max 256 entries (sufficient for most use cases)
- Shared across all terrain tiles

**Version-Based Invalidation**:
- Increments version on camera move
- Cancels in-flight generation
- Prevents rendering stale terrain

### Entity Pips

**RAF-Throttled Updates**:
- Updates at ~30fps (requestAnimationFrame)
- Only when minimap is visible
- Automatic pause when hidden

**Icon Caching**:
- Prevents redundant image loading
- Shared cache across all entity instances
- Cleared on unmount

**Extent Culling**:
- Only renders entities within minimap bounds
- Improves performance with many entities
- Automatic culling based on camera position

**Entity Cache Pruning**:
- Tracks `lastSeenTick` for each entity
- Prunes entries not seen in 100 ticks
- Prevents unbounded cache growth

### World Caches

**Event-Driven Updates**:
- Only updates when `roads:generated` or `towns:generated` events fire
- No polling or continuous updates
- Minimal CPU usage

## Migration from Old Pattern

### Before (Inline Logic)

```typescript
// Minimap.tsx (772 lines of inline logic)
function Minimap({ world, width, height, zoom }) {
  const [terrainCanvas, setTerrainCanvas] = useState<HTMLCanvasElement | null>(null);
  const [overlayCanvas, setOverlayCanvas] = useState<HTMLCanvasElement | null>(null);
  const [roads, setRoads] = useState([]);
  const [towns, setTowns] = useState([]);
  
  // 200+ lines of terrain rendering logic
  useEffect(() => {
    // ... terrain generation
  }, [world, width, height, zoom]);
  
  // 150+ lines of entity pip logic
  useEffect(() => {
    // ... entity rendering
  }, [world, width, height, zoom]);
  
  // 50+ lines of road/town caching
  useEffect(() => {
    // ... road/town caching
  }, [world]);
  
  // ... 400+ more lines
}
```

### After (Modular Hooks)

```typescript
// Minimap.tsx (clean component)
function Minimap({ world, width, height, zoom, isVisible }) {
  const { terrainCanvasRef } = useMinimapTerrainCache({
    world, width, height, zoom, isVisible
  });
  const { overlayCanvasRef } = useMinimapEntityPips({
    world, width, height, zoom, isVisible
  });
  const { roads, towns } = useMinimapWorldCaches({ world });
  
  return (
    <div className="minimap">
      <canvas ref={terrainCanvasRef} width={width} height={height} />
      <canvas ref={overlayCanvasRef} width={width} height={height} />
      {/* ... road/town rendering */}
    </div>
  );
}
```

## Benefits

1. **Modular Architecture**: Each hook has single responsibility
2. **Reusable Logic**: Hooks can be used independently
3. **Better Testing**: Easier to test individual hooks
4. **Proper Cleanup**: All resources cleaned up on unmount
5. **Performance**: Optimized with caching, throttling, and culling
6. **Type Safety**: Strongly typed parameters and returns
7. **Maintainability**: Easier to understand and modify

## Known Issues

**None** - All known issues from PR review have been addressed:
- Resize listeners properly cleaned up
- `towns:generated` event listener added
- `.catch()` added to terrain generation promises
- Biome color cache has LRU eviction
- Entity cache has pruning logic

## Future Improvements

**Potential Enhancements**:
1. Extract icon caching to shared utility
2. Add configurable cache sizes
3. Support custom entity pip renderers
4. Add minimap overlay layers (fog of war, etc.)
5. Support minimap zoom animation

## Related Hooks

- **usePlayerData** - Centralized player data subscription
- **useModalPanels** - Centralized modal panel state

## See Also

- [UI Modernization Guide](./ui-modernization-march-2026.md) - Complete UI modernization details
- [usePlayerData API](./api-hooks-player-data.md) - Player data hook reference
- [useModalPanels API](./api-hooks-modal-panels.md) - Modal panel hook reference
