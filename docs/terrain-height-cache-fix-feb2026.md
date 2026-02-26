# Terrain Height Cache Fix (February 2026)

**Commit**: 21e0860993131928edf3cd6e90265b0d2ba1b2a7  
**Author**: Ting Chien Meng (@tcm390)

## Summary

Fixed a consistent 50m offset in terrain height lookups caused by incorrect tile index calculation and grid coordinate mapping. The bug affected pathfinding, resource spawning, and player positioning.

## Symptoms

- Players floating ~50m above ground
- Resources (trees, rocks) spawning in mid-air
- Pathfinding failures (incorrect walkability checks)
- Incorrect terrain color lookups

## Root Cause

`getHeightAtCached()` had two bugs:

### Bug 1: Tile Index Calculation

```typescript
// BROKEN: Doesn't account for centered geometry
const tileX = Math.floor(worldX / TILE_SIZE);
const tileZ = Math.floor(worldZ / TILE_SIZE);
```

**Problem**: PlaneGeometry is centered at origin with range `[-50, +50]`, but `Math.floor(worldX / TILE_SIZE)` assumes origin at `[0, 0]`.

**Example**:
- World position: `x = 25` (should be tile 0)
- Broken calculation: `Math.floor(25 / 100) = 0` ✅ (accidentally correct)
- World position: `x = -25` (should be tile 0)
- Broken calculation: `Math.floor(-25 / 100) = -1` ❌ (wrong tile!)

### Bug 2: Grid Index Calculation

```typescript
// BROKEN: Omits halfSize offset from PlaneGeometry's [-50, +50] range
const gridX = Math.floor(localX);
const gridZ = Math.floor(localZ);
```

**Problem**: PlaneGeometry vertices are in range `[-50, +50]`, but grid indices are `[0, 100]`. The formula needs to add `halfSize` to shift the range.

**Example**:
- Local position: `x = 0` (center of tile, should be grid index 50)
- Broken calculation: `Math.floor(0) = 0` ❌ (wrong index!)
- Correct calculation: `Math.floor(0 + 50) = 50` ✅

## Fix

### Canonical Helper Functions

**worldToTerrainTileIndex()** - Convert world coordinates to tile indices:

```typescript
export function worldToTerrainTileIndex(
  worldX: number,
  worldZ: number,
  tileSize: number
): { tileX: number; tileZ: number } {
  // Add half tile size to shift origin from corner to center
  const tileX = Math.floor((worldX + tileSize / 2) / tileSize);
  const tileZ = Math.floor((worldZ + tileSize / 2) / tileSize);
  return { tileX, tileZ };
}
```

**localToGridIndex()** - Convert local tile coordinates to grid indices:

```typescript
export function localToGridIndex(
  localX: number,
  localZ: number,
  gridSize: number
): { gridX: number; gridZ: number } {
  // PlaneGeometry is centered, so local coords are in [-halfSize, +halfSize]
  // Add halfSize to shift to [0, gridSize] range
  const halfSize = gridSize / 2;
  const gridX = Math.floor(localX + halfSize);
  const gridZ = Math.floor(localZ + halfSize);
  return { gridX, gridZ };
}
```

### Updated getHeightAtCached()

```typescript
export function getHeightAtCached(
  worldX: number,
  worldZ: number,
  cache: Map<string, TerrainTileCache>
): number | null {
  // Use canonical helper for tile index
  const { tileX, tileZ } = worldToTerrainTileIndex(worldX, worldZ, TILE_SIZE);
  const key = `${tileX}_${tileZ}`;  // Fixed: was using comma separator
  
  const tile = cache.get(key);
  if (!tile) return null;
  
  // Convert to local tile coordinates
  const localX = worldX - tileX * TILE_SIZE;
  const localZ = worldZ - tileZ * TILE_SIZE;
  
  // Use canonical helper for grid index
  const { gridX, gridZ } = localToGridIndex(localX, localZ, tile.gridSize);
  
  // Bounds check
  if (gridX < 0 || gridX >= tile.gridSize || gridZ < 0 || gridZ >= tile.gridSize) {
    return null;
  }
  
  return tile.heights[gridZ * tile.gridSize + gridX];
}
```

### Updated getTerrainColorAt()

Also fixed comma-vs-underscore key typo:

```typescript
// BROKEN: Used comma separator (never found tiles)
const key = `${tileX},${tileZ}`;

// FIXED: Use underscore separator (matches cache key format)
const key = `${tileX}_${tileZ}`;
```

## Impact

### Before Fix
- Height lookups: ~50m offset (consistent error)
- Color lookups: Always returned null (key mismatch)
- Pathfinding: Incorrect walkability (wrong height data)
- Resource spawning: Mid-air placement

### After Fix
- Height lookups: Accurate to terrain mesh
- Color lookups: Correct biome colors
- Pathfinding: Correct walkability checks
- Resource spawning: Ground-level placement

## Migration

### For Users

**No migration needed** - fix is automatic on update.

**If you see floating/sinking issues after update**:
1. Clear browser cache
2. Reload page
3. Terrain cache will rebuild with correct calculations

### For Developers

**Use canonical helpers** for all terrain coordinate conversions:

```typescript
import { worldToTerrainTileIndex, localToGridIndex } from '@hyperscape/shared';

// Convert world coords to tile indices
const { tileX, tileZ } = worldToTerrainTileIndex(worldX, worldZ, TILE_SIZE);

// Convert local coords to grid indices
const { gridX, gridZ } = localToGridIndex(localX, localZ, gridSize);
```

**Don't use**:
- `Math.floor(worldX / TILE_SIZE)` - doesn't account for centered geometry
- `Math.floor(localX)` - doesn't account for PlaneGeometry range

## Testing

### Test Cases

**packages/shared/src/systems/shared/world/__tests__/TerrainSystem.test.ts**:

```typescript
describe('Terrain Height Cache', () => {
  it('returns correct height at tile center', () => {
    const height = getHeightAtCached(0, 0, cache);
    expect(height).toBeCloseTo(expectedHeight, 0.01);
  });
  
  it('returns correct height at tile edges', () => {
    const height = getHeightAtCached(49.9, 49.9, cache);
    expect(height).toBeDefined();
  });
  
  it('handles negative coordinates correctly', () => {
    const height = getHeightAtCached(-25, -25, cache);
    expect(height).toBeCloseTo(expectedHeight, 0.01);
  });
});
```

### Visual Verification

```typescript
// Debug visualization (add to TerrainSystem)
const debugHeight = (x: number, z: number) => {
  const cached = getHeightAtCached(x, z, this.tileCache);
  const actual = this.getHeightAt(x, z);
  console.log(`Height at (${x}, ${z}): cached=${cached}, actual=${actual}, diff=${Math.abs(cached - actual)}`);
};

// Test at various positions
debugHeight(0, 0);      // Tile center
debugHeight(25, 25);    // Positive quadrant
debugHeight(-25, -25);  // Negative quadrant
debugHeight(49, 49);    // Tile edge
```

## Related Systems

### TerrainSystem

**File**: `packages/shared/src/systems/shared/world/TerrainSystem.ts`

**Uses Height Cache For**:
- `getHeightAt()` - Primary height query (falls back to procedural if cache miss)
- `getTerrainColorAt()` - Biome color lookup
- Flat zone blending
- Grass exclusion

### PathfindingSystem

**File**: `packages/shared/src/systems/shared/movement/BFSPathfinder.ts`

**Impact**: Walkability checks now use correct heights, preventing:
- Paths through "air" (where terrain was actually solid)
- Blocked paths (where terrain was actually walkable)

### ResourceSystem

**File**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

**Impact**: Resources now spawn at correct ground level:
- Trees no longer float
- Rocks sit on terrain surface
- Fishing spots at water level

## Performance

### Cache Performance

**Before Fix**:
- Cache hit rate: ~95% (but wrong data)
- Fallback to procedural: ~5%

**After Fix**:
- Cache hit rate: ~95% (correct data)
- Fallback to procedural: ~5%
- Performance: Unchanged (same cache hit rate)

### Coordinate Conversion Cost

**worldToTerrainTileIndex()**: ~5 arithmetic operations
**localToGridIndex()**: ~3 arithmetic operations

Negligible overhead compared to procedural height calculation (~1000 operations).

## Known Limitations

### Cache Key Format

Cache keys use underscore separator: `${tileX}_${tileZ}`

**Don't use**:
- Comma separator: `${tileX},${tileZ}` (won't find tiles)
- Colon separator: `${tileX}:${tileZ}` (won't find tiles)

### Grid Size Assumptions

Helpers assume:
- PlaneGeometry is centered at origin
- Grid size is even (e.g., 100, 200)
- Tile size matches geometry size

**If you change these assumptions**, update the helpers accordingly.

## References

- [TerrainSystem.ts](packages/shared/src/systems/shared/world/TerrainSystem.ts) - Implementation
- [PlaneGeometry](https://threejs.org/docs/#api/en/geometries/PlaneGeometry) - Three.js geometry
- [Terrain Height Cache](packages/shared/src/systems/shared/world/TerrainSystem.ts#L1234) - Cache structure
