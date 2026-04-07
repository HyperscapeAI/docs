# Resource Respawn System

**Updated**: March 27, 2026 (PR #1099)  
**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

## Overview

The resource respawn system provides deterministic, tick-based respawn mechanics for gathering resources (trees, rocks, fishing spots). It eliminates non-deterministic `setTimeout`-based respawn in favor of OSRS-accurate tick counting.

## Key Changes (March 2026)

### Before (Non-Deterministic)

Resources used `setTimeout` for respawn timing:

```typescript
// ResourceEntity.ts (OLD)
async deplete(): Promise<void> {
  this.depleted = true;
  await this.visualStrategy.onDepleted(this.visualContext);
  
  // Non-deterministic setTimeout
  setTimeout(() => {
    this.respawn();
  }, this.respawnTime);
}
```

**Problems**:
- Respawn timing varied based on server load and event loop congestion
- Not OSRS-accurate (OSRS uses deterministic tick-based respawn)
- Difficult to test and reproduce timing issues

### After (Tick-Based)

Resources use tick counting for deterministic respawn:

```typescript
// ResourceEntity.ts (NEW)
async deplete(): Promise<void> {
  this.depleted = true;
  this.depletedAtTick = this.world.tickNumber;  // Record depletion tick
  await this.visualStrategy.onDepleted(this.visualContext);
  // No setTimeout - respawn handled by ResourceSystem.processRespawns()
}
```

**Benefits**:
- ✅ Deterministic respawn timing (exact tick count)
- ✅ OSRS-accurate mechanics
- ✅ Testable and reproducible
- ✅ No event loop dependency

---

## Architecture

### ResourceSystem

**File**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

#### `processRespawns()`

Processes pending resource respawns based on tick count.

**Behavior**:
- Called every tick by the tick system
- Iterates all depleted resources
- Checks if `currentTick - depletedAtTick >= respawnTicks`
- Calls `resource.respawn()` when ready

**Implementation**:
```typescript
processRespawns(): void {
  const currentTick = this.world.tickNumber;
  
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof ResourceEntity)) continue;
    if (!entity.depleted) continue;
    if (entity.depletedAtTick === null) continue;
    
    const ticksSinceDepleted = currentTick - entity.depletedAtTick;
    const respawnTicks = Math.ceil(entity.respawnTime / TICK_DURATION_MS);
    
    if (ticksSinceDepleted >= respawnTicks) {
      entity.respawn();
    }
  }
}
```

### ResourceEntity

#### `deplete(): Promise<void>`

Marks resource as depleted and records depletion tick.

**Behavior**:
- Sets `depleted = true`
- Records `depletedAtTick = world.tickNumber`
- Calls `visualStrategy.onDepleted()` for visual feedback
- **Does NOT schedule respawn** (handled by `ResourceSystem.processRespawns()`)

**Example**:
```typescript
async deplete(): Promise<void> {
  this.depleted = true;
  this.depletedAtTick = this.world.tickNumber;
  
  const handled = await this.visualStrategy.onDepleted(this.visualContext);
  if (!handled) {
    // Fallback: load depleted model if strategy didn't handle it
    await this.loadDepletedModel();
  }
}
```

#### `respawn(): void`

Respawns the resource and resets depletion state.

**Behavior**:
- Sets `depleted = false`
- Resets `depletedAtTick = null`
- Calls `visualStrategy.onRespawn()` for visual feedback
- Emits `RESOURCE_RESPAWNED` event

**Example**:
```typescript
respawn(): void {
  this.depleted = false;
  this.depletedAtTick = null;
  
  this.visualStrategy.onRespawn(this.visualContext);
  
  this.world.emit('resource:respawned', {
    entityId: this.id,
    resourceType: this.resourceType,
  });
}
```

---

## Depletion Chance System

### Manifest Configuration

Resources can specify a `depleteChance` in their manifest to control depletion probability:

```json
{
  "id": "copper_rock",
  "type": "rock",
  "skill": "mining",
  "level": 1,
  "xp": 17.5,
  "respawnTime": 2400,
  "depleteChance": 1.0,
  "drops": [
    { "itemId": "copper_ore", "quantity": 1, "chance": 1.0 }
  ]
}
```

**`depleteChance` Values**:
- `1.0` - Always depletes on successful gather (default for most resources)
- `0.5` - 50% chance to deplete on successful gather
- `0.0` - Never depletes (e.g., rune essence rocks in OSRS)

### Mining Integration

**File**: `packages/server/src/systems/ServerNetwork/handlers/resources.ts`

Mining now reads `depleteChance` from manifest instead of using hardcoded constants:

```typescript
// OLD (hardcoded)
const MINING_DEPLETE_CHANCE = 1.0;
const MINING_REDWOOD_DEPLETE_CHANCE = 0.1;

if (Math.random() < MINING_DEPLETE_CHANCE) {
  await resource.deplete();
}

// NEW (manifest-based)
const resourceData = getResource(resource.resourceType);
const depleteChance = resourceData?.depleteChance ?? 1.0;

if (Math.random() < depleteChance) {
  await resource.deplete();
}
```

**Removed Constants**:
- `MINING_DEPLETE_CHANCE` - No longer used
- `MINING_REDWOOD_DEPLETE_CHANCE` - No longer used

**Impact**:
- ✅ Rune essence rocks work correctly (never deplete with `depleteChance: 0`)
- ✅ Consistent depletion behavior across all gathering skills
- ✅ Manifest-driven design (no code changes for new resources)

---

## Tick Calculation

### Respawn Timing

Respawn time is converted from milliseconds to ticks:

```typescript
const respawnTicks = Math.ceil(entity.respawnTime / TICK_DURATION_MS);
```

**Example** (600ms tick duration):
- `respawnTime: 2400ms` → `4 ticks`
- `respawnTime: 3000ms` → `5 ticks`
- `respawnTime: 1800ms` → `3 ticks`

### Tick Counting

Depletion tick is recorded when resource is depleted:

```typescript
this.depletedAtTick = this.world.tickNumber;
```

Respawn check compares current tick to depletion tick:

```typescript
const ticksSinceDepleted = currentTick - entity.depletedAtTick;
if (ticksSinceDepleted >= respawnTicks) {
  entity.respawn();
}
```

**Precision**: Respawn timing is accurate to ±1 tick (±600ms with default tick rate).

---

## OSRS Accuracy

### Tick-Based Mechanics

OSRS uses a 600ms game tick for all timing:
- Combat attacks
- Resource respawns
- Skill actions
- Movement

Hyperscape matches this with `TICK_DURATION_MS = 600`.

### Depletion Mechanics

**OSRS Behavior**:
- Most resources deplete on every successful gather
- Some resources (rune essence) never deplete
- Some resources (redwood trees) have low depletion chance

**Hyperscape Implementation**:
```typescript
// Manifest-driven depletion
const depleteChance = resourceData?.depleteChance ?? 1.0;

if (Math.random() < depleteChance) {
  await resource.deplete();
}
```

**Examples**:
- Copper rock: `depleteChance: 1.0` (always depletes)
- Rune essence: `depleteChance: 0` (never depletes)
- Redwood tree: `depleteChance: 0.1` (10% chance to deplete)

---

## API Reference

### ResourceEntity

#### Properties

```typescript
class ResourceEntity extends InteractableEntity {
  depleted: boolean;              // Is resource currently depleted?
  depletedAtTick: number | null;  // Tick number when depleted (null if not depleted)
  respawnTime: number;             // Respawn time in milliseconds
  resourceType: string;            // Resource type ID (e.g., "oak_tree")
}
```

#### Methods

##### `deplete(): Promise<void>`

Depletes the resource and records depletion tick.

**Behavior**:
- Sets `depleted = true`
- Records `depletedAtTick = world.tickNumber`
- Calls `visualStrategy.onDepleted()` for visual feedback
- Falls back to `loadDepletedModel()` if visual strategy doesn't handle depletion

**Example**:
```typescript
// Called by gathering handler when resource is successfully gathered
if (Math.random() < depleteChance) {
  await resource.deplete();
}
```

##### `respawn(): void`

Respawns the resource and resets depletion state.

**Behavior**:
- Sets `depleted = false`
- Resets `depletedAtTick = null`
- Calls `visualStrategy.onRespawn()` for visual feedback
- Emits `RESOURCE_RESPAWNED` event

**Example**:
```typescript
// Called by ResourceSystem.processRespawns() when respawn time elapsed
if (ticksSinceDepleted >= respawnTicks) {
  entity.respawn();
}
```

### ResourceSystem

#### Methods

##### `processRespawns(): void`

Processes pending resource respawns based on tick count.

**Behavior**:
- Iterates all entities in world
- Filters for depleted `ResourceEntity` instances
- Checks if respawn time has elapsed (tick-based)
- Calls `resource.respawn()` when ready

**Called By**: Tick system (every tick)

**Example**:
```typescript
// ServerNetwork/index.ts
this.tickSystem.onTick(() => {
  resourceSystem.processRespawns();
}, TickPriority.RESOURCE_RESPAWN);
```

---

## Configuration

### Manifest Schema

**File**: `packages/server/world/assets/manifests/resources.json`

```json
{
  "id": "oak_tree",
  "type": "tree",
  "skill": "woodcutting",
  "level": 15,
  "xp": 37.5,
  "respawnTime": 4800,
  "depleteChance": 1.0,
  "drops": [
    { "itemId": "oak_logs", "quantity": 1, "chance": 1.0 }
  ],
  "model": "models/trees/oak.glb",
  "modelScale": 1.0
}
```

**Fields**:
- `respawnTime` - Respawn time in milliseconds (converted to ticks)
- `depleteChance` - Probability of depletion on successful gather (0.0-1.0)
  - `1.0` - Always depletes (default)
  - `0.0` - Never depletes (rune essence rocks)
  - `0.1` - 10% chance (redwood trees)

### Constants

**File**: `packages/shared/src/constants/GameConstants.ts`

```typescript
export const TICK_DURATION_MS = 600;  // OSRS-accurate tick duration
```

---

## Testing

### Unit Tests

**File**: `packages/shared/src/systems/shared/entities/gathering/__tests__/ToolUtils.test.ts`

```typescript
describe('depleteChance: 0 (essence rock)', () => {
  it('never depletes across multiple gather cycles', () => {
    const resource = createResource({
      resourceType: 'rune_essence',
      depleteChance: 0,
    });
    
    // Gather 100 times
    for (let i = 0; i < 100; i++) {
      handleGather(resource);
    }
    
    // Resource should never deplete
    expect(resource.depleted).toBe(false);
  });
});

describe('depleteChance: 1.0 (regular ore)', () => {
  it('always depletes on first successful gather', () => {
    const resource = createResource({
      resourceType: 'copper_rock',
      depleteChance: 1.0,
    });
    
    handleGather(resource);
    
    expect(resource.depleted).toBe(true);
  });
});
```

### Integration Tests

**File**: `packages/shared/src/systems/shared/entities/__tests__/ResourceSystem.integration.test.ts`

```typescript
describe('tick-based respawn', () => {
  it('respawns after exact tick count', () => {
    const resource = createResource({
      respawnTime: 2400,  // 4 ticks at 600ms/tick
    });
    
    resource.deplete();
    expect(resource.depleted).toBe(true);
    expect(resource.depletedAtTick).toBe(world.tickNumber);
    
    // Advance 3 ticks (not enough)
    for (let i = 0; i < 3; i++) {
      world.tick();
      resourceSystem.processRespawns();
    }
    expect(resource.depleted).toBe(true);
    
    // Advance 1 more tick (total 4 ticks)
    world.tick();
    resourceSystem.processRespawns();
    expect(resource.depleted).toBe(false);
  });
});
```

---

## Migration Guide

### Updating from setTimeout-Based Respawn

**Before**:
```typescript
// ResourceEntity.ts (OLD)
async deplete(): Promise<void> {
  this.depleted = true;
  await this.visualStrategy.onDepleted(this.visualContext);
  
  setTimeout(() => {
    this.respawn();
  }, this.respawnTime);
}
```

**After**:
```typescript
// ResourceEntity.ts (NEW)
async deplete(): Promise<void> {
  this.depleted = true;
  this.depletedAtTick = this.world.tickNumber;
  await this.visualStrategy.onDepleted(this.visualContext);
  // Respawn handled by ResourceSystem.processRespawns()
}

// ResourceSystem.ts
processRespawns(): void {
  const currentTick = this.world.tickNumber;
  
  for (const entity of this.world.entities.values()) {
    if (!(entity instanceof ResourceEntity)) continue;
    if (!entity.depleted) continue;
    if (entity.depletedAtTick === null) continue;
    
    const ticksSinceDepleted = currentTick - entity.depletedAtTick;
    const respawnTicks = Math.ceil(entity.respawnTime / TICK_DURATION_MS);
    
    if (ticksSinceDepleted >= respawnTicks) {
      entity.respawn();
    }
  }
}
```

### Updating Depletion Chance Logic

**Before** (hardcoded constants):
```typescript
// resources.ts (OLD)
const MINING_DEPLETE_CHANCE = 1.0;
const MINING_REDWOOD_DEPLETE_CHANCE = 0.1;

if (resource.resourceType === 'redwood_tree') {
  if (Math.random() < MINING_REDWOOD_DEPLETE_CHANCE) {
    await resource.deplete();
  }
} else {
  if (Math.random() < MINING_DEPLETE_CHANCE) {
    await resource.deplete();
  }
}
```

**After** (manifest-based):
```typescript
// resources.ts (NEW)
const resourceData = getResource(resource.resourceType);
const depleteChance = resourceData?.depleteChance ?? 1.0;

if (Math.random() < depleteChance) {
  await resource.deplete();
}
```

---

## Manifest Examples

### Standard Tree (Always Depletes)

```json
{
  "id": "oak_tree",
  "type": "tree",
  "skill": "woodcutting",
  "level": 15,
  "xp": 37.5,
  "respawnTime": 4800,
  "depleteChance": 1.0,
  "drops": [
    { "itemId": "oak_logs", "quantity": 1, "chance": 1.0 }
  ]
}
```

### Rune Essence Rock (Never Depletes)

```json
{
  "id": "rune_essence_rock",
  "type": "rock",
  "skill": "mining",
  "level": 1,
  "xp": 5,
  "respawnTime": 0,
  "depleteChance": 0,
  "drops": [
    { "itemId": "rune_essence", "quantity": 1, "chance": 1.0 }
  ]
}
```

**Note**: `respawnTime: 0` is ignored since `depleteChance: 0` means the resource never depletes.

### Redwood Tree (Low Depletion Chance)

```json
{
  "id": "redwood_tree",
  "type": "tree",
  "skill": "woodcutting",
  "level": 90,
  "xp": 380,
  "respawnTime": 60000,
  "depleteChance": 0.1,
  "drops": [
    { "itemId": "redwood_logs", "quantity": 1, "chance": 1.0 }
  ]
}
```

**Behavior**: 10% chance to deplete on each successful gather. On average, depletes after 10 gathers.

---

## Tick Priority

Resource respawn processing runs at `TickPriority.RESOURCE_RESPAWN` priority:

```typescript
// ServerNetwork/index.ts
this.tickSystem.onTick(() => {
  resourceSystem.processRespawns();
}, TickPriority.RESOURCE_RESPAWN);
```

**Tick Order** (from `TickPriority` enum):
1. `MOVEMENT` - Player/mob movement
2. `COMBAT` - Combat processing
3. `RESOURCE_RESPAWN` - Resource respawns
4. `CLEANUP` - Entity cleanup

This ensures resources respawn after movement and combat, but before cleanup.

---

## Performance Characteristics

### CPU
- **O(resources)**: Iterates all resources every tick
- **Early-out**: Skips non-depleted resources immediately
- **Typical Cost**: ~0.01-0.1ms for 100-1000 resources

### Memory
- **No Timers**: No `setTimeout` handles to track
- **Minimal State**: Only `depletedAtTick` number per resource
- **No Leaks**: Tick-based approach has no timer cleanup issues

---

## Troubleshooting

### Resources not respawning

**Symptoms**: Depleted resources never respawn.

**Causes**:
1. `ResourceSystem.processRespawns()` not being called
2. `depletedAtTick` not being set on depletion
3. `respawnTime` set to 0 or invalid value

**Debug**:
```typescript
// Add logging to ResourceSystem.processRespawns
console.log('[Respawn] Checking respawns, tick:', currentTick);
console.log('[Respawn] Depleted resources:', depletedCount);

// Add logging to ResourceEntity.deplete
console.log('[Deplete] Resource depleted:', this.id, 'at tick:', this.depletedAtTick);

// Add logging to ResourceEntity.respawn
console.log('[Respawn] Resource respawned:', this.id);
```

### Resources respawning too fast/slow

**Symptoms**: Respawn timing doesn't match manifest `respawnTime`.

**Cause**: Tick duration mismatch or incorrect respawn time calculation.

**Fix**: Verify `TICK_DURATION_MS = 600` and respawn time is in milliseconds:

```typescript
// Correct calculation
const respawnTicks = Math.ceil(entity.respawnTime / TICK_DURATION_MS);

// Example: 2400ms respawn time
// 2400 / 600 = 4 ticks
// Math.ceil(4) = 4 ticks
```

### Rune essence rocks depleting

**Symptoms**: Rune essence rocks deplete when they shouldn't.

**Cause**: `depleteChance` not set to 0 in manifest, or depletion logic not reading from manifest.

**Fix**: Verify manifest has `depleteChance: 0` and gathering handler reads from manifest:

```json
{
  "id": "rune_essence_rock",
  "depleteChance": 0
}
```

```typescript
const depleteChance = resourceData?.depleteChance ?? 1.0;
if (Math.random() < depleteChance) {
  await resource.deplete();
}
```

---

## Code Examples

### Basic Resource Depletion

```typescript
// Gathering handler
async function handleGather(player: PlayerEntity, resource: ResourceEntity) {
  // Check if player can gather
  if (!canGather(player, resource)) return;
  
  // Roll for success
  if (!rollGatherSuccess(player, resource)) return;
  
  // Give XP and items
  giveXP(player, resource.xp);
  giveItems(player, resource.drops);
  
  // Roll for depletion
  const resourceData = getResource(resource.resourceType);
  const depleteChance = resourceData?.depleteChance ?? 1.0;
  
  if (Math.random() < depleteChance) {
    await resource.deplete();
  }
}
```

### Tick-Based Respawn Processing

```typescript
// ResourceSystem.ts
export class ResourceSystem extends SystemBase {
  processRespawns(): void {
    const currentTick = this.world.tickNumber;
    
    for (const entity of this.world.entities.values()) {
      if (!(entity instanceof ResourceEntity)) continue;
      if (!entity.depleted) continue;
      if (entity.depletedAtTick === null) continue;
      
      const ticksSinceDepleted = currentTick - entity.depletedAtTick;
      const respawnTicks = Math.ceil(entity.respawnTime / TICK_DURATION_MS);
      
      if (ticksSinceDepleted >= respawnTicks) {
        entity.respawn();
      }
    }
  }
}
```

### Registering Respawn Tick Handler

```typescript
// ServerNetwork/index.ts
export class ServerNetwork extends SystemBase {
  init(): void {
    const resourceSystem = this.world.getSystem('resource') as ResourceSystem;
    
    // Register respawn processing to run every tick
    this.tickSystem.onTick(() => {
      resourceSystem.processRespawns();
    }, TickPriority.RESOURCE_RESPAWN);
  }
}
```

---

## Related Systems

- **TickSystem** (`packages/server/src/systems/TickSystem.ts`) - Manages game tick loop
- **ResourceEntity** (`packages/shared/src/entities/world/ResourceEntity.ts`) - Resource entity implementation
- **GatheringSystem** (`packages/server/src/systems/ServerNetwork/handlers/resources.ts`) - Handles gathering actions
- **TreeGLBVisualStrategy** (`packages/shared/src/entities/world/visuals/TreeGLBVisualStrategy.ts`) - Tree visual feedback

---

## Related Documentation

- [Tree Dissolve Transparency](tree-dissolve-transparency.md) - Visual feedback for depletion/respawn
- [Tree Collision Proxy](tree-collision-proxy.md) - LOD2 geometry for collision detection
- [Performance March 2026](performance-march-2026.md) - Server performance overhaul
- [Tick System](../packages/server/src/systems/TickSystem.ts) - Game tick implementation
