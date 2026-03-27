# ToolUtils API Documentation

Pure utility functions for tool validation and categorization. Extracted from `ResourceSystem.ts` for SOLID compliance (Single Responsibility Principle).

## Overview

`ToolUtils.ts` provides manifest-based tool validation to prevent cross-skill tool usage. The `tools.json` manifest is the single source of truth for tool-to-skill mappings.

**Key Features**:
- Manifest-first validation (prevents cross-skill usage)
- Fallback guards for unmanifested tools
- Warn-once logging (bounded to prevent log flooding)
- OSRS-accurate fishing tool exact matching

## Problem Solved

**Before** (substring matching):
```typescript
// ❌ BROKEN: "pickaxe" contains "axe" → matches hatchet category
itemMatchesToolCategory("bronze_pickaxe", "hatchet"); // true (WRONG!)

// ❌ BROKEN: "battleaxe" contains "axe" → matches hatchet category
itemMatchesToolCategory("rune_battleaxe", "hatchet"); // true (WRONG!)
```

**After** (manifest-based):
```typescript
// ✅ CORRECT: Manifest lookup shows pickaxe.skill = "mining"
itemMatchesToolCategory("bronze_pickaxe", "hatchet"); // false

// ✅ CORRECT: Manifest lookup shows battleaxe.skill = "combat"
itemMatchesToolCategory("rune_battleaxe", "hatchet"); // false
```

## Constants

### `EXACT_FISHING_TOOLS`

```typescript
export const EXACT_FISHING_TOOLS = [
  "small_fishing_net",
  "fishing_rod",
  "fly_fishing_rod",
  "harpoon",
  "lobster_pot",
  "big_fishing_net",
] as const;

export type FishingToolId = (typeof EXACT_FISHING_TOOLS)[number];
```

OSRS fishing tools that require exact matching (not interchangeable like pickaxe tiers).

**Why Exact Match?**
- `small_fishing_net` catches shrimp/anchovies (level 1)
- `fishing_rod` + bait catches sardine/herring/pike (level 5+)
- `fly_fishing_rod` + feathers catches trout/salmon (level 20+)

These are NOT interchangeable — each tool catches different fish.

### `CATEGORY_TO_SKILL`

```typescript
const CATEGORY_TO_SKILL: Partial<Record<string, GatheringSkill>> = {
  hatchet: "woodcutting",
  pickaxe: "mining",
};
```

Map from tool category to the skill it belongs to.

**When to Update**: Add an entry here when adding a new gathering skill (e.g., "secateurs" → "herbalism").

**Note**: Fishing tools bypass this map via the exact-match path.

### `MAX_FALLBACK_WARNINGS`

```typescript
const MAX_FALLBACK_WARNINGS = 50;
```

Maximum number of unique items that can trigger fallback warnings. Prevents unbounded Set growth on long-running servers.

## Functions

### `itemMatchesToolCategory()`

Check if an item ID matches the required tool category.

```typescript
export function itemMatchesToolCategory(
  itemId: string,
  category: string,
): boolean
```

**Validation Flow**:
1. Reject noted items (bank notes cannot be used as tools)
2. If category is exact fishing tool, require exact match
3. Manifest lookup: compare tool's declared skill against expected skill
4. Fallback: substring matching with cross-skill guards
5. Unknown category: reject (forces manifest completeness)

**Example**:
```typescript
// Manifest-based validation (primary path)
itemMatchesToolCategory("bronze_hatchet", "hatchet");
// 1. getExternalTool("bronze_hatchet") → { skill: "woodcutting" }
// 2. CATEGORY_TO_SKILL["hatchet"] → "woodcutting"
// 3. "woodcutting" === "woodcutting" → true

// Cross-skill rejection
itemMatchesToolCategory("bronze_pickaxe", "hatchet");
// 1. getExternalTool("bronze_pickaxe") → { skill: "mining" }
// 2. CATEGORY_TO_SKILL["hatchet"] → "woodcutting"
// 3. "mining" !== "woodcutting" → false

// Fishing exact match
itemMatchesToolCategory("fishing_rod", "fishing_rod");
// 1. isExactMatchFishingTool("fishing_rod") → true
// 2. "fishing_rod" === "fishing_rod" → true

itemMatchesToolCategory("fly_fishing_rod", "fishing_rod");
// 1. isExactMatchFishingTool("fishing_rod") → true
// 2. "fly_fishing_rod" !== "fishing_rod" → false

// Fallback with guards (tool not in manifest)
itemMatchesToolCategory("custom_hatchet", "hatchet");
// 1. getExternalTool("custom_hatchet") → null
// 2. Fallback: "custom_hatchet".includes("hatchet") → true
// 3. Warn once: "Item not found in tools manifest"

// Combat weapon rejection (fallback guard)
itemMatchesToolCategory("rune_battleaxe", "hatchet");
// 1. getExternalTool("rune_battleaxe") → null
// 2. Fallback: "rune_battleaxe".includes("hatchet") → false (contains "axe" but not "hatchet")
// 3. Returns: false
```

**Warn-Once Logging**:
```typescript
// First call for unmanifested tool
itemMatchesToolCategory("custom_hatchet", "hatchet");
// Logs: "Item 'custom_hatchet' not found in tools manifest — using fallback matching"

// Second call for same tool
itemMatchesToolCategory("custom_hatchet", "hatchet");
// No log (already warned)

// 51st unique unmanifested tool
itemMatchesToolCategory("tool_51", "hatchet");
// No log (MAX_FALLBACK_WARNINGS reached)
```

### `getToolCategory()`

Extract tool category from `toolRequired` field.

```typescript
export function getToolCategory(toolRequired: string): string
```

**Examples**:
```typescript
getToolCategory("bronze_hatchet");     // "hatchet"
getToolCategory("rune_pickaxe");       // "pickaxe"
getToolCategory("small_fishing_net");  // "small_fishing_net" (exact)
getToolCategory("fishing_rod");        // "fishing_rod" (exact)
getToolCategory("custom_tool_axe");    // "axe" (last segment)
```

**Logic**:
1. Fishing tools → return exact ID (not category)
2. Contains "pickaxe"/"pick" → "pickaxe"
3. Contains "hatchet"/"axe" → "hatchet"
4. Fallback → last segment after underscore

**Note**: Check pickaxe before axe since "pickaxe" contains "axe".

### `getToolDisplayName()`

Get human-readable display name for tool category.

```typescript
export function getToolDisplayName(category: string): string
```

**Examples**:
```typescript
getToolDisplayName("hatchet");              // "hatchet"
getToolDisplayName("pickaxe");              // "pickaxe"
getToolDisplayName("small_fishing_net");    // "small fishing net"
getToolDisplayName("fly_fishing_rod");      // "fly fishing rod"
getToolDisplayName("custom_tool");          // "custom tool" (underscores → spaces)
```

**Usage**: Error messages, UI tooltips, debug logs.

### `isExactMatchFishingTool()`

Check if a tool category is a fishing tool that requires exact matching.

```typescript
export function isExactMatchFishingTool(category: string): boolean
```

**Examples**:
```typescript
isExactMatchFishingTool("fishing_rod");        // true
isExactMatchFishingTool("small_fishing_net");  // true
isExactMatchFishingTool("hatchet");            // false
isExactMatchFishingTool("pickaxe");            // false
```

**Usage**: Internal helper for `itemMatchesToolCategory()` to determine validation path.

### `_resetFallbackWarnings()`

Reset the fallback warning cache.

```typescript
export function _resetFallbackWarnings(): void
```

**⚠️ Internal Use Only**: Exported for test isolation. Do NOT call in production code.

**Usage** (tests only):
```typescript
import { _resetFallbackWarnings } from './ToolUtils';

describe('ToolUtils fallback warnings', () => {
  afterEach(() => {
    _resetFallbackWarnings(); // Prevent test pollution
  });

  it('warns once per item', () => {
    const spy = vi.spyOn(console, 'warn');
    
    itemMatchesToolCategory("custom_tool", "hatchet");
    expect(spy).toHaveBeenCalledTimes(1);
    
    itemMatchesToolCategory("custom_tool", "hatchet");
    expect(spy).toHaveBeenCalledTimes(1); // No second warning
  });
});
```

## Manifest Integration

### tools.json Schema

```json
{
  "id": "bronze_hatchet",
  "skill": "woodcutting",
  "levelRequired": 1,
  "successRateLow": 0.25,
  "successRateHigh": 0.75
}
```

**Required Fields**:
- `id`: Tool item ID (must match item manifest)
- `skill`: Gathering skill ("woodcutting", "mining", "fishing")
- `levelRequired`: Minimum skill level to use tool
- `successRateLow`: Base success rate at level 1 (woodcutting only)
- `successRateHigh`: Max success rate at level 99 (woodcutting only)

### Adding a New Tool

1. **Add to tools.json**:
```json
{
  "id": "mithril_pickaxe",
  "skill": "mining",
  "levelRequired": 21,
  "successRateLow": 0.35,
  "successRateHigh": 0.85
}
```

2. **Add to items.json** (if not already present):
```json
{
  "id": "mithril_pickaxe",
  "name": "Mithril pickaxe",
  "value": 1300,
  "weight": 2.267,
  "equipSlot": "weapon"
}
```

3. **No code changes required** - manifest-based validation handles it automatically.

### Adding a New Gathering Skill

1. **Add tools to tools.json**:
```json
{
  "id": "bronze_secateurs",
  "skill": "herbalism",
  "levelRequired": 1,
  "successRateLow": 0.3,
  "successRateHigh": 0.8
}
```

2. **Update CATEGORY_TO_SKILL** in `ToolUtils.ts`:
```typescript
const CATEGORY_TO_SKILL: Partial<Record<string, GatheringSkill>> = {
  hatchet: "woodcutting",
  pickaxe: "mining",
  secateurs: "herbalism", // Add new category
};
```

3. **Update GatheringSkill type**:
```typescript
type GatheringSkill = "woodcutting" | "mining" | "fishing" | "herbalism";
```

**Important**: If you skip step 2, the fallback will compare `category === skill` directly. This works but triggers a warning log. For production, always add the category to `CATEGORY_TO_SKILL`.

## Testing

Comprehensive test coverage in `ToolUtils.test.ts`:

| Test Category | Tests | Coverage |
|---------------|-------|----------|
| Manifest validation | 4 | Primary path with tools.json lookup |
| Cross-skill rejection | 3 | Pickaxe for woodcutting, hatchet for mining |
| Fishing exact match | 2 | Exact ID required, no substring match |
| Fallback warnings | 3 | Warn-once, bounded Set, test isolation |
| Unknown categories | 1 | Reject rather than substring match |
| Edge cases | 2 | Noted items, empty strings |

**Total: 15 tests**

**Test Setup**:
```typescript
import { _resetFallbackWarnings } from './ToolUtils';

describe('ToolUtils', () => {
  afterEach(() => {
    _resetFallbackWarnings(); // Prevent test pollution
    vi.restoreAllMocks();     // Clean up spies
  });

  it('rejects cross-skill usage', () => {
    // Populate manifest
    globalThis.EXTERNAL_TOOLS = {
      bronze_pickaxe: { skill: "mining", levelRequired: 1 },
    };

    // Pickaxe should not work for woodcutting
    expect(itemMatchesToolCategory("bronze_pickaxe", "hatchet")).toBe(false);
  });
});
```

## Performance Considerations

### Manifest Lookup

**Complexity**: O(1) hash map lookup via `getExternalTool()`.

**Memory**: Manifest loaded once at startup, shared across all validation calls.

**Caching**: No per-call caching needed — manifest lookup is already O(1).

### Fallback Warning Set

**Growth**: Bounded to `MAX_FALLBACK_WARNINGS` (50 entries).

**Memory**: ~50 strings × ~20 bytes = ~1KB max.

**Cleanup**: Persists for process lifetime (intentional — warnings should not repeat).

## Migration Guide

### From Substring Matching (Pre-March 2026)

**Old** (substring matching):
```typescript
// ❌ BROKEN: Allows cross-skill usage
function itemMatchesToolCategory(itemId: string, category: string): boolean {
  return itemId.toLowerCase().includes(category.toLowerCase());
}

itemMatchesToolCategory("bronze_pickaxe", "hatchet"); // true (WRONG!)
```

**New** (manifest-based):
```typescript
import { itemMatchesToolCategory } from './ToolUtils';

// ✅ CORRECT: Manifest lookup prevents cross-skill usage
itemMatchesToolCategory("bronze_pickaxe", "hatchet"); // false
```

### Adding Custom Tools

**Before**: Tools worked via substring matching (no manifest required).

**After**: Tools must be in `tools.json` manifest for proper validation.

**Migration Steps**:
1. Identify all custom tools in your codebase
2. Add each tool to `packages/server/world/assets/manifests/tools.json`
3. Specify the correct `skill` field for each tool
4. Test with `itemMatchesToolCategory()` to verify

**Example**:
```json
// Add to tools.json
{
  "id": "custom_hatchet",
  "skill": "woodcutting",
  "levelRequired": 1,
  "successRateLow": 0.25,
  "successRateHigh": 0.75
}
```

## Error Handling

### Fallback Path Warnings

When a tool is not in the manifest, the fallback path logs a warning:

```typescript
itemMatchesToolCategory("custom_hatchet", "hatchet");
// Console: "[ToolUtils] Item 'custom_hatchet' not found in tools manifest — using fallback matching for category 'hatchet'"
```

**Action Required**: Add the tool to `tools.json` to eliminate the warning and ensure proper validation.

### Unknown Category Rejection

Unknown categories reject rather than substring match (forces manifest completeness):

```typescript
itemMatchesToolCategory("custom_tool", "unknown_category");
// Returns: false (no manifest entry, no fallback for unknown categories)
```

**Action Required**: 
1. Add the tool to `tools.json` with the correct skill
2. Add the category to `CATEGORY_TO_SKILL` if it's a new gathering skill

## Integration Examples

### Resource Validation

```typescript
import { itemMatchesToolCategory, getToolCategory } from './ToolUtils';

class ResourceSystem {
  canGatherResource(
    playerId: string,
    resourceId: string,
  ): { canGather: boolean; reason?: string } {
    const resource = this.getResource(resourceId);
    if (!resource) {
      return { canGather: false, reason: "Resource not found" };
    }

    // Check tool requirement
    if (resource.toolRequired) {
      const category = getToolCategory(resource.toolRequired);
      const hasTool = this.playerHasMatchingTool(playerId, category);
      
      if (!hasTool) {
        return { 
          canGather: false, 
          reason: `You need a ${getToolDisplayName(category)} to gather this resource.`
        };
      }
    }

    return { canGather: true };
  }

  private playerHasMatchingTool(playerId: string, category: string): boolean {
    const inventory = this.getPlayerInventory(playerId);
    const equipment = this.getPlayerEquipment(playerId);
    
    // Check equipped weapon first
    if (equipment.weapon && itemMatchesToolCategory(equipment.weapon.itemId, category)) {
      return true;
    }

    // Check inventory
    for (const item of inventory.items) {
      if (itemMatchesToolCategory(item.itemId, category)) {
        return true;
      }
    }

    return false;
  }
}
```

### Tool Tier Detection

```typescript
import { itemMatchesToolCategory } from './ToolUtils';

function getToolTier(itemId: string, category: string): number {
  if (!itemMatchesToolCategory(itemId, category)) {
    return 0; // Not a valid tool for this category
  }

  // Extract tier from item ID
  const lowerItemId = itemId.toLowerCase();
  if (lowerItemId.includes("bronze")) return 1;
  if (lowerItemId.includes("iron")) return 2;
  if (lowerItemId.includes("steel")) return 3;
  if (lowerItemId.includes("mithril")) return 4;
  if (lowerItemId.includes("adamant")) return 5;
  if (lowerItemId.includes("rune")) return 6;
  if (lowerItemId.includes("dragon")) return 7;
  
  return 1; // Default to bronze tier
}

// Usage
const tier = getToolTier("rune_pickaxe", "pickaxe");
// Returns: 6

const invalidTier = getToolTier("rune_pickaxe", "hatchet");
// Returns: 0 (not a hatchet)
```

### Error Messages

```typescript
import { getToolDisplayName, getToolCategory } from './ToolUtils';

function showToolRequirementError(resourceId: string): void {
  const resource = this.getResource(resourceId);
  const category = getToolCategory(resource.toolRequired);
  const displayName = getToolDisplayName(category);
  
  this.showMessage(`You need a ${displayName} to gather this resource.`);
}

// Examples:
// "You need a hatchet to gather this resource."
// "You need a pickaxe to gather this resource."
// "You need a small fishing net to gather this resource."
```

## Debugging

### Enable Debug Logging

```bash
# Enable gathering debug logs
HYPERSCAPE_DEBUG_GATHERING=true bun run dev
```

**Logs Include**:
- Tool validation results
- Manifest lookup hits/misses
- Fallback path warnings
- Category-to-skill mappings

### Common Issues

**Issue**: "Item not found in tools manifest" warnings

**Cause**: Tool is not in `tools.json` manifest.

**Fix**: Add the tool to manifest:
```json
{
  "id": "your_tool_id",
  "skill": "woodcutting",
  "levelRequired": 1,
  "successRateLow": 0.25,
  "successRateHigh": 0.75
}
```

**Issue**: Pickaxe works for woodcutting (or vice versa)

**Cause**: Tool is not in manifest, fallback has a bug, or manifest has wrong skill.

**Fix**: 
1. Check manifest: `getExternalTool("bronze_pickaxe")` should return `{ skill: "mining" }`
2. If missing, add to manifest
3. If present with wrong skill, fix the skill field

**Issue**: New gathering skill tools not working

**Cause**: Category not in `CATEGORY_TO_SKILL` map.

**Fix**: Add to map in `ToolUtils.ts`:
```typescript
const CATEGORY_TO_SKILL: Partial<Record<string, GatheringSkill>> = {
  hatchet: "woodcutting",
  pickaxe: "mining",
  secateurs: "herbalism", // Add new category
};
```

## Related Documentation

- [ResourceSystem.ts](../../ResourceSystem.ts) - Main gathering orchestrator
- [README.md](./README.md) - Gathering system architecture
- [tools.json](../../../../../server/world/assets/manifests/tools.json) - Tool manifest
- [resources.json](../../../../../server/world/assets/manifests/resources.json) - Resource manifest

## Changelog

### March 27, 2026 (PR #1098)
- **BREAKING**: Switched from substring matching to manifest-based validation
- Added `CATEGORY_TO_SKILL` map for category-to-skill resolution
- Added warn-once logging with bounded Set (max 50 entries)
- Added symmetric fallback guards (hatchet rejects pickaxe, pickaxe rejects hatchet)
- Added `_resetFallbackWarnings()` test helper
- Added 15 comprehensive tests covering all validation paths
- Fixed cross-skill tool usage exploit (pickaxe for woodcutting, hatchet for mining)
- Fixed combat weapon false positives (battleaxe, greataxe)

### Pre-March 2026
- Original substring matching implementation
- No manifest integration
- No cross-skill guards
