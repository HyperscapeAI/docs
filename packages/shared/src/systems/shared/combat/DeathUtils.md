# DeathUtils API Documentation

Pure utility functions for the player death pipeline. Extracted from `PlayerDeathSystem.ts` for improved testability and SOLID compliance.

## Overview

`DeathUtils.ts` provides stateless, side-effect-free functions for:
- Input sanitization (XSS/injection protection)
- OSRS-style item splitting (keep-3 system)
- Position validation and clamping
- Gravestone entity ID filtering

All functions are pure and can be tested in isolation.

## Constants

### `GRAVESTONE_ID_PREFIX`

```typescript
export const GRAVESTONE_ID_PREFIX = "gravestone_"
```

Prefix for gravestone entity IDs. Used in:
- ID generation (`SafeAreaDeathHandler.spawnGravestone`)
- ID filtering (`PlayerDeathSystem.handlePlayerDeath`)

**Usage**:
```typescript
// Generate gravestone ID
const gravestoneId = `${GRAVESTONE_ID_PREFIX}${playerId}_${Date.now()}`;

// Filter gravestone events
if (entityId.startsWith(GRAVESTONE_ID_PREFIX)) {
  return; // Skip gravestone destruction events
}
```

### `ITEMS_KEPT_ON_DEATH`

```typescript
export const ITEMS_KEPT_ON_DEATH = 3
```

OSRS-style: In safe zones, player keeps their 3 most valuable items on death.

**Reference**: [OSRS Wiki - Items Kept on Death](https://oldschool.runescape.wiki/w/Items_Kept_on_Death)

### `POSITION_VALIDATION`

```typescript
export const POSITION_VALIDATION = {
  WORLD_BOUNDS: 10000,  // Max 10km from origin
  MAX_HEIGHT: 500,      // Max height
  MIN_HEIGHT: -50,      // Allow some underground (caves)
} as const
```

World bounds for position validation and clamping.

## Functions

### `sanitizeKilledBy()`

Sanitize killer name to prevent injection attacks.

```typescript
export function sanitizeKilledBy(killedBy: unknown): string
```

**Security Features**:
- Normalizes Unicode to NFKC form (prevents homograph attacks)
- Removes zero-width characters (U+200B-U+200D, U+FEFF)
- Removes BiDi override characters (U+202A-U+202E)
- Removes control characters (0x00-0x1F, 0x7F)
- Removes dangerous HTML characters (`<>'\"&`)
- Limits length to 64 characters
- Defaults to "unknown" for invalid inputs

**Example**:
```typescript
// Malicious input with BiDi override
const malicious = "Player\u202E\u0000<script>alert(1)</script>";
const safe = sanitizeKilledBy(malicious);
// Returns: "Playerscriptalert1script" (sanitized)

// Invalid input
const invalid = null;
const fallback = sanitizeKilledBy(invalid);
// Returns: "unknown"
```

**Attack Vectors Prevented**:
- **Homograph attacks**: Cyrillic 'а' vs Latin 'a' (normalized to same character)
- **Zero-width characters**: Invisible characters that manipulate display
- **BiDi overrides**: Right-to-left text that reverses display order
- **XSS injection**: HTML/script tags stripped
- **Buffer overflow**: Length capped at 64 characters

### `splitItemsForSafeDeath()`

Split items into "kept" and "dropped" lists for safe zone deaths (OSRS-style).

```typescript
export function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number,
): { kept: InventoryItem[]; dropped: InventoryItem[] }
```

**Algorithm**:
1. Tag each item slot with its unit value (from manifest)
2. Sort descending by value (most valuable first)
3. Greedily assign keep-count without expanding stacks
4. Split into kept/dropped lists with proper quantities

**Complexity**: O(n log n) on unique items — does NOT expand stacks into individual entries, avoiding memory explosion for large quantities (e.g., 10,000 arrows).

**Example**:
```typescript
const allItems = [
  { itemId: "rune_platebody", quantity: 1 },  // value: 40000
  { itemId: "dragon_scimitar", quantity: 1 }, // value: 60000
  { itemId: "shark", quantity: 10 },          // value: 800 each
  { itemId: "coins", quantity: 50000 },       // value: 1 each
];

const { kept, dropped } = splitItemsForSafeDeath(allItems, 3);

// kept = [
//   { itemId: "dragon_scimitar", quantity: 1 },  // Most valuable
//   { itemId: "rune_platebody", quantity: 1 },   // Second most valuable
//   { itemId: "shark", quantity: 1 },            // Third most valuable (1 unit)
// ]
//
// dropped = [
//   { itemId: "shark", quantity: 9 },            // Remaining sharks
//   { itemId: "coins", quantity: 50000 },        // All coins
// ]
```

**Stack Handling**:
- Each unit in a stack counts as one item
- Only the top N units across all stacks are kept
- Remaining units go to dropped list
- No memory explosion for large stacks

**Edge Cases**:
```typescript
// keepCount = 0 (wilderness death)
splitItemsForSafeDeath(allItems, 0);
// Returns: { kept: [], dropped: [...allItems] }

// keepCount > total items
splitItemsForSafeDeath([item1, item2], 10);
// Returns: { kept: [item1, item2], dropped: [] }

// Equal value items (deterministic tiebreaker)
const items = [
  { itemId: "item_a", quantity: 1 }, // value: 100
  { itemId: "item_b", quantity: 1 }, // value: 100
];
splitItemsForSafeDeath(items, 1);
// Returns: { kept: [item_a], dropped: [item_b] }
// Tiebreak on original index for deterministic behavior
```

### `validatePosition()`

Validate and clamp a position to world bounds.

```typescript
export function validatePosition(position: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } | null
```

**Validation**:
1. Check for invalid numbers (NaN, Infinity)
2. Clamp to world bounds if valid

**Returns**:
- Clamped position if valid
- `null` if completely invalid (NaN/Infinity)

**Example**:
```typescript
// Valid position (within bounds)
const pos1 = validatePosition({ x: 100, y: 50, z: -200 });
// Returns: { x: 100, y: 50, z: -200 }

// Out of bounds (clamped)
const pos2 = validatePosition({ x: 20000, y: 1000, z: -100 });
// Returns: { x: 10000, y: 500, z: -100 }

// Invalid (NaN)
const pos3 = validatePosition({ x: NaN, y: 50, z: 100 });
// Returns: null

// Invalid (Infinity)
const pos4 = validatePosition({ x: 100, y: Infinity, z: 200 });
// Returns: null
```

**Bounds**:
- X/Z: ±10,000 (10km from origin)
- Y: -50 to 500 (allows caves, limits sky)

### `isPositionInBounds()`

Check if position is within world bounds without clamping.

```typescript
export function isPositionInBounds(position: {
  x: number;
  y: number;
  z: number;
}): boolean
```

**Returns**: `true` if position is within bounds, `false` otherwise.

**Example**:
```typescript
// Within bounds
isPositionInBounds({ x: 100, y: 50, z: -200 });
// Returns: true

// Out of bounds (X too large)
isPositionInBounds({ x: 20000, y: 50, z: 100 });
// Returns: false

// Out of bounds (Y too high)
isPositionInBounds({ x: 100, y: 1000, z: 200 });
// Returns: false
```

**Use Cases**:
- Logging warnings for out-of-bounds positions
- Detecting suspicious position manipulation
- Validating death positions before clamping

### `isValidPositionNumber()`

Check if a number is valid for position use.

```typescript
export function isValidPositionNumber(n: number): boolean
```

**Returns**: `true` if number is finite (not NaN or Infinity), `false` otherwise.

**Example**:
```typescript
isValidPositionNumber(100);      // true
isValidPositionNumber(0);        // true
isValidPositionNumber(-50);      // true
isValidPositionNumber(NaN);      // false
isValidPositionNumber(Infinity); // false
```

### `getItemValue()`

Get the value of an item from manifest data.

```typescript
export function getItemValue(itemId: string): number
```

**Returns**: Item value from manifest, or 0 for unknown items (they sort to bottom and get dropped first).

**Example**:
```typescript
getItemValue("dragon_scimitar");  // 60000
getItemValue("rune_platebody");   // 40000
getItemValue("shark");            // 800
getItemValue("unknown_item");     // 0 (not in manifest)
```

**Usage**: Called internally by `splitItemsForSafeDeath()` to determine which items to keep.

## Testing

All functions have comprehensive test coverage in `DeathUtils.test.ts`:

| Function | Tests | Coverage |
|----------|-------|----------|
| `sanitizeKilledBy()` | 12 | XSS, Unicode, injection, edge cases |
| `splitItemsForSafeDeath()` | 18 | OSRS keep-3, stack handling, edge cases |
| `validatePosition()` | 8 | Validation, clamping, invalid inputs |
| `isPositionInBounds()` | 6 | Bounds checking, edge cases |
| `isValidPositionNumber()` | 4 | Finite number validation |
| `getItemValue()` | 3 | Manifest lookup, unknown items |

**Total: 51 tests**

## Migration Guide

### From PlayerDeathSystem (Pre-March 2026)

**Old** (inline validation):
```typescript
// In PlayerDeathSystem.ts
const killedBy = typeof killedByRaw === 'string' ? killedByRaw : 'unknown';
const validPosition = { x: pos.x, y: pos.y, z: pos.z };
```

**New** (extracted utilities):
```typescript
import { sanitizeKilledBy, validatePosition } from './DeathUtils';

const killedBy = sanitizeKilledBy(killedByRaw);
const validPosition = validatePosition(pos);
if (!validPosition) {
  // Handle invalid position
}
```

### Adding OSRS Keep-3 to Custom Death Handlers

```typescript
import { splitItemsForSafeDeath, ITEMS_KEPT_ON_DEATH } from './DeathUtils';

// Get all items (inventory + equipment)
const allItems = [...inventoryItems, ...equipmentItems];

// Split into kept/dropped
const { kept, dropped } = splitItemsForSafeDeath(allItems, ITEMS_KEPT_ON_DEATH);

// Store kept items for respawn
this.itemsKeptOnDeath.set(playerId, kept);

// Create gravestone with dropped items
await this.spawnGravestone(playerId, position, dropped, killedBy);
```

## Performance Considerations

### `splitItemsForSafeDeath()` Optimization

**Problem**: Naive implementation expands stacks into individual items (10,000 arrows → 10,000 array entries), causing memory explosion.

**Solution**: Operate on unique item slots with greedy quantity assignment:
```typescript
// Build value-tagged entries (one per unique item slot, not per unit)
const tagged = allItems.map((item, index) => ({
  item,
  index,
  unitValue: getItemValue(item.itemId),
}));

// Sort descending by value
tagged.sort((a, b) => b.unitValue - a.unitValue || a.index - b.index);

// Greedily assign keep-count without expanding stacks
const keptCounts = new Map<number, number>();
let remaining = keepCount;
for (const entry of tagged) {
  if (remaining <= 0) break;
  const toKeep = Math.min(entry.item.quantity, remaining);
  keptCounts.set(entry.index, toKeep);
  remaining -= toKeep;
}
```

**Complexity**: O(n log n) on unique items, not O(n × max_quantity).

**Memory**: Constant overhead per unique item slot, regardless of stack size.

## Security Considerations

### `sanitizeKilledBy()` Attack Vectors

**Homograph Attacks**:
```typescript
// Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061)
const cyrillic = "Plаyer"; // Contains Cyrillic 'а'
const sanitized = sanitizeKilledBy(cyrillic);
// NFKC normalization converts to Latin 'a'
```

**Zero-Width Characters**:
```typescript
// Zero-width space (U+200B)
const invisible = "Player\u200BAdmin";
const sanitized = sanitizeKilledBy(invisible);
// Returns: "PlayerAdmin" (zero-width removed)
```

**BiDi Overrides**:
```typescript
// Right-to-left override (U+202E)
const reversed = "Player\u202Enimda";
const sanitized = sanitizeKilledBy(reversed);
// Returns: "Playernimda" (override removed, text not reversed)
```

**XSS Injection**:
```typescript
// Script tag injection
const xss = "Player<script>alert(1)</script>";
const sanitized = sanitizeKilledBy(xss);
// Returns: "Playerscriptalert1script" (HTML chars removed)
```

### Position Validation Attack Vectors

**NaN Injection**:
```typescript
// Malicious client sends NaN position
const malicious = { x: NaN, y: 50, z: 100 };
const validated = validatePosition(malicious);
// Returns: null (rejected)
```

**Infinity Injection**:
```typescript
// Malicious client sends Infinity position
const malicious = { x: Infinity, y: 50, z: 100 };
const validated = validatePosition(malicious);
// Returns: null (rejected)
```

**Out-of-Bounds Teleport**:
```typescript
// Malicious client sends extreme position
const malicious = { x: 999999, y: 50, z: 999999 };
const validated = validatePosition(malicious);
// Returns: { x: 10000, y: 50, z: 10000 } (clamped to bounds)
```

## Integration Examples

### Custom Death Handler

```typescript
import {
  sanitizeKilledBy,
  validatePosition,
  splitItemsForSafeDeath,
  ITEMS_KEPT_ON_DEATH,
  GRAVESTONE_ID_PREFIX,
} from './DeathUtils';

class CustomDeathHandler {
  async handleDeath(
    playerId: string,
    deathPosition: { x: number; y: number; z: number },
    killedByRaw: string,
  ): Promise<void> {
    // 1. Sanitize inputs
    const killedBy = sanitizeKilledBy(killedByRaw);
    const validPosition = validatePosition(deathPosition);
    
    if (!validPosition) {
      this.logger.error("Invalid death position", { playerId });
      return;
    }

    // 2. Get all items
    const allItems = await this.getAllPlayerItems(playerId);

    // 3. Split into kept/dropped (OSRS keep-3)
    const { kept, dropped } = splitItemsForSafeDeath(allItems, ITEMS_KEPT_ON_DEATH);

    // 4. Store kept items for respawn
    this.itemsKeptOnDeath.set(playerId, kept);

    // 5. Create gravestone with dropped items
    const gravestoneId = `${GRAVESTONE_ID_PREFIX}${playerId}_${Date.now()}`;
    await this.spawnGravestone(gravestoneId, validPosition, dropped, killedBy);
  }
}
```

### Event Filtering

```typescript
import { GRAVESTONE_ID_PREFIX } from './DeathUtils';

// Skip gravestone destruction events (not player deaths)
world.on(EventType.ENTITY_DEATH, (data) => {
  if (data.entityId.startsWith(GRAVESTONE_ID_PREFIX)) {
    return; // Performance optimization - avoid processing gravestone events
  }
  
  // Process player death
  this.handlePlayerDeath(data);
});
```

### Position Validation with Logging

```typescript
import { validatePosition, isPositionInBounds } from './DeathUtils';

async function handleDeath(playerId: string, deathPosition: Position): Promise<void> {
  // Check if position is out of bounds (log warning)
  if (!isPositionInBounds(deathPosition)) {
    this.logger.warn("Death position out of bounds, will be clamped", {
      playerId,
      position: deathPosition,
    });
  }

  // Validate and clamp
  const validPosition = validatePosition(deathPosition);
  if (!validPosition) {
    this.logger.error("Invalid death position (NaN/Infinity)", { playerId });
    return;
  }

  // Use validated position
  await this.processDeathAt(playerId, validPosition);
}
```

## Related Documentation

- [PlayerDeathSystem.ts](./PlayerDeathSystem.ts) - Main death orchestrator
- [DeathTypes.ts](./DeathTypes.ts) - Type definitions for death pipeline
- [SafeAreaDeathHandler.ts](../death/SafeAreaDeathHandler.ts) - Safe zone death handler
- [WildernessDeathHandler.ts](../death/WildernessDeathHandler.ts) - Wilderness death handler
- [DeathStateManager.ts](../death/DeathStateManager.ts) - Death lock persistence

## Changelog

### March 26, 2026 (PR #1094)
- Initial extraction from `PlayerDeathSystem.ts`
- Added `sanitizeKilledBy()` for XSS/injection protection
- Added `splitItemsForSafeDeath()` for OSRS keep-3 system
- Added `validatePosition()` and `isPositionInBounds()` for position validation
- Added `GRAVESTONE_ID_PREFIX` constant for entity ID filtering
- Added `ITEMS_KEPT_ON_DEATH` constant for OSRS keep-3 count
- Added `POSITION_VALIDATION` constants for world bounds
- 51 tests covering all functions and edge cases
