# Combat System API Reference

Complete API reference for Hyperscape's combat system, including the new mob magic and ranged attack features.

---

## Table of Contents

1. [Attack Handlers](#attack-handlers)
2. [Attack Context Utilities](#attack-context-utilities)
3. [Combat Constants](#combat-constants)
4. [Type Definitions](#type-definitions)
5. [Mob Visual Manager](#mob-visual-manager)

---

## Attack Handlers

### MeleeAttackHandler

Handles close-range melee combat for players and mobs.

```typescript
class MeleeAttackHandler {
  constructor(ctx: CombatAttackContext);
  
  /**
   * Handle a melee attack request
   * @param data - Attack data with attacker/target IDs and types
   */
  handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
  }): void;
}
```

**Range:** 1 tile (standard) or 2 tiles (halberd)  
**Hit Delay:** 0 ticks (instant)  
**Stats Used:** `attack`, `strength`, `defense`

---

### RangedAttackHandler

Handles bow and arrow combat for players and mobs.

```typescript
class RangedAttackHandler {
  constructor(ctx: CombatAttackContext);
  
  /**
   * Handle a ranged attack request
   * Routes to player or mob path based on attackerType
   * @param data - Attack data including optional arrowId
   */
  handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    arrowId?: string;  // Optional: event-carried arrow type
  }): void;
  
  /**
   * Handle player ranged attack
   * - Validates equipped bow and arrows
   * - Consumes one arrow from inventory
   * - Applies equipment bonuses
   * - Awards XP on hit
   */
  private handlePlayerRangedAttack(data): void;
  
  /**
   * Handle mob ranged attack
   * - Resolves arrow from NPC data or event
   * - No arrow consumption (infinite ammo)
   * - Uses mob's ranged stat
   * - No XP reward
   */
  private handleMobRangedAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "mob";
    targetType: "player" | "mob";
    arrowId?: string;
  }): void;
}
```

**Range:** Up to 10 tiles (configurable via NPC `combatRange`)  
**Hit Delay:** `1 + floor((3 + distance) / 6)` ticks  
**Stats Used:** `ranged`, `defense`  
**Resource:** Arrows (players only)

---

### MagicAttackHandler

Handles spell casting for players and mobs.

```typescript
class MagicAttackHandler {
  constructor(ctx: CombatAttackContext);
  
  /**
   * Handle a magic attack request
   * Routes to player or mob path based on attackerType
   * @param data - Attack data including optional spellId
   * @returns Promise that resolves when attack completes
   */
  async handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    spellId?: string;  // Optional: event-carried spell type
  }): Promise<void>;
  
  /**
   * Handle player magic attack
   * - Validates selected spell
   * - Validates and consumes runes
   * - Applies equipment bonuses
   * - Awards XP on hit
   */
  private async handlePlayerMagicAttack(data): Promise<void>;
  
  /**
   * Handle mob magic attack
   * - Resolves spell from NPC data or event
   * - No rune consumption (infinite runes)
   * - Uses mob's magic stat
   * - No XP reward
   */
  private handleMobMagicAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "mob";
    targetType: "player" | "mob";
    spellId?: string;
  }): void;
}
```

**Range:** Up to 10 tiles (configurable via NPC `combatRange`)  
**Hit Delay:** `1 + floor((1 + distance) / 3)` ticks  
**Stats Used:** `magic`, `defense`  
**Resource:** Runes (players only)

---

## Attack Context Utilities

### prepareMobAttack()

Shared utility for mob projectile attack preparation. Consolidates entity resolution, range checking, cooldown management, and animation for both magic and ranged handlers.

```typescript
/**
 * Prepare a mob projectile attack (magic or ranged)
 * Validates all preconditions and returns attack context
 * 
 * @param ctx - Combat attack context
 * @param data - Attack data with mob attacker
 * @param combatRange - Fallback range if NPC data missing
 * @param animationType - Animation to play
 * @param fallbackAttackSpeed - Fallback attack speed in ticks
 * @param preResolved - Optional pre-resolved mob entity and NPC data
 * @returns MobAttackContext if all checks pass, null otherwise
 */
function prepareMobAttack(
  ctx: CombatAttackContext,
  data: {
    attackerId: string;
    targetId: string;
    attackerType: "mob";
    targetType: "player" | "mob";
  },
  combatRange: number,
  animationType: "melee" | "ranged" | "magic",
  fallbackAttackSpeed: number,
  preResolved?: { attacker: MobEntity; npcData: NPCData },
): MobAttackContext | null;
```

**Validation Steps:**
1. Entity resolution (attacker and target)
2. Alive checks for both entities
3. Range validation using `checkProjectileRange()`
4. Position validation
5. Cooldown check
6. Cooldown claim (sets next attack tick)
7. Face target (rotation)
8. Play combat animation

**Returns:**
```typescript
interface MobAttackContext {
  attacker: Entity | MobEntity;
  target: Entity | MobEntity;
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  typedAttackerId: EntityID;
  npcData: NPCData;
  attackerPos: Position3D;
  targetPos: Position3D;
  distance: number;
  currentTick: number;
  attackSpeedTicks: number;
}
```

**Usage Example:**
```typescript
// In RangedAttackHandler
const mobCtx = prepareMobAttack(
  this.ctx,
  data,
  COMBAT_CONSTANTS.RANGED_RANGE,  // Fallback: 10 tiles
  "ranged",                        // Animation type
  COMBAT_CONSTANTS.DEFAULTS.NPC.ATTACK_SPEED_TICKS,  // Fallback: 4 ticks
  { attacker: mobEntity, npcData },  // Pre-resolved to avoid double lookup
);

if (!mobCtx) return;  // Attack aborted (out of range, on cooldown, etc.)

// All validation passed - proceed with damage calculation
const damage = this.calculateMobRangedDamage(...);
```

---

### checkProjectileRange()

Shared range validation for ranged and magic attacks.

```typescript
/**
 * Check if target is within projectile attack range
 * Emits COMBAT_ATTACK_FAILED event if out of range
 * 
 * @param ctx - Combat attack context
 * @param attackerId - Attacker entity ID
 * @param targetId - Target entity ID
 * @param attacker - Attacker entity
 * @param target - Target entity
 * @param attackRange - Maximum attack range in tiles
 * @returns Chebyshev distance if in range, -1 if out of range
 */
function checkProjectileRange(
  ctx: CombatAttackContext,
  attackerId: string,
  targetId: string,
  attacker: Entity | MobEntity,
  target: Entity | MobEntity,
  attackRange: number,
): number;
```

**Range Check Logic:**
1. Get entity positions
2. Convert to tile coordinates
3. Calculate Chebyshev distance (max of dx, dz)
4. Check `distance > attackRange` or `distance === 0`
5. Emit failure event if out of range
6. Return distance or -1

---

## Combat Constants

### Attack Ranges

```typescript
export const COMBAT_CONSTANTS = {
  // Projectile ranges
  RANGED_RANGE: 10,  // Maximum ranged attack range
  MAGIC_RANGE: 10,   // Maximum magic attack range
  
  // Melee ranges
  MELEE_RANGE_STANDARD: 1,  // Standard melee weapons
  MELEE_RANGE_HALBERD: 2,   // Halberds and spears
};
```

### Projectile Launch Delays

```typescript
export const COMBAT_CONSTANTS = {
  /**
   * Delay before spell projectile spawns (ms)
   * Allows cast animation wind-up before projectile appears
   */
  SPELL_LAUNCH_DELAY_MS: 600,
  
  /**
   * Delay before arrow projectile spawns (ms)
   * Allows bow draw animation wind-up before arrow appears
   */
  ARROW_LAUNCH_DELAY_MS: 400,
};
```

### Hit Delay Formulas

```typescript
export const COMBAT_CONSTANTS = {
  HIT_DELAY: {
    // Melee: Instant hit
    MELEE_BASE: 0,
    
    // Ranged: 1 + floor((3 + distance) / 6)
    RANGED_BASE: 1,
    RANGED_DISTANCE_OFFSET: 3,
    RANGED_DISTANCE_DIVISOR: 6,
    
    // Magic: 1 + floor((1 + distance) / 3)
    MAGIC_BASE: 1,
    MAGIC_DISTANCE_OFFSET: 1,
    MAGIC_DISTANCE_DIVISOR: 3,
    
    // Maximum hit delay cap
    MAX_HIT_DELAY: 10,
  },
};
```

---

## Type Definitions

### NPCCombatConfig

```typescript
interface NPCCombatConfig {
  attackable: boolean;
  aggressive: boolean;
  retaliates: boolean;
  aggroRange: number;
  combatRange: number;
  leashRange: number;
  attackSpeedTicks: number;
  respawnTime: number;
  xpReward: number;
  poisonous: boolean;
  immuneToPoison: boolean;
  
  // Attack type configuration (new in v3.0)
  attackType?: "melee" | "ranged" | "magic";  // Default: "melee"
  spellId?: string;   // Required for magic mobs
  arrowId?: string;   // Required for ranged mobs
}
```

### NPCAppearanceConfig

```typescript
interface NPCAppearanceConfig {
  modelPath: string;
  iconPath?: string;
  scale: number;
  tint?: string;  // Hex color
  
  // Held weapon model (new in v3.0)
  heldWeaponModel?: string;  // e.g., "asset://weapons/bow_shortbow.glb"
}
```

### MobEntityConfig

```typescript
interface MobEntityConfig extends EntityConfig {
  // ... base entity fields ...
  
  // Attack type configuration (new in v3.0)
  attackType?: "melee" | "ranged" | "magic";
  spellId?: string;   // Spell ID for magic mobs
  arrowId?: string;   // Arrow ID for ranged mobs
}
```

### CombatAttackContext

```typescript
interface CombatAttackContext {
  // Core dependencies
  readonly world: World;
  readonly logger: SystemLogger;
  readonly antiCheat: CombatAntiCheat;
  readonly entityIdValidator: EntityIdValidator;
  readonly rateLimiter: CombatRateLimiter;
  readonly entityResolver: CombatEntityResolver;
  
  // Combat services
  readonly animationManager: CombatAnimationManager;
  readonly rotationManager: CombatRotationManager;
  readonly projectileService: ProjectileService;
  
  // Cached systems
  playerSystem?: PlayerSystem;
  prayerSystem?: PrayerSystem | null;
  equipmentSystem?: EquipmentSystem;
  inventorySystem?: InventorySystem;
  terrainSystem?: TerrainSystem;
  
  // Mutable state
  nextAttackTicks: Map<EntityID, number>;
  readonly playerEquipmentStats: Map<string, EquipmentStatsCache>;
  
  // Pooled objects (zero GC)
  readonly _attackerTile: PooledTile;
  readonly _targetTile: PooledTile;
  
  // Methods
  validateAttackerPosition(...): boolean;
  checkAttackCooldown(...): boolean;
  applyDamage(...): void;
  enterCombat(...): void;
  emitTypedEvent(...): void;
  calculateMeleeDamage(...): number;
  handleMeleeAttack(...): void;
  getPlayerSkillLevel(...): number;
  getEquippedWeapon(...): Item | null;
  getEquippedArrows(...): EquipmentSlot | null;
}
```

---

## Mob Visual Manager

### MobVisualManager

Manages mob visual state including VRM avatars, animations, and held weapons.

```typescript
class MobVisualManager {
  /**
   * Clear weapon cache - call during world teardown
   * Disposes all cached weapon geometry and materials
   */
  static clearWeaponCache(): void;
  
  /**
   * Attach held weapon GLB to mob's VRM hand bone
   * Uses Asset Forge attachment metadata for positioning
   * Weapons are cached and shared across mobs of same type
   * @private
   */
  private attachHeldWeapon(): void;
  
  /**
   * Check if emote is a priority emote (overrides AI animations)
   * @param emoteUrl - Emote URL to check
   * @returns true if emote is combat/death related
   */
  isPriorityEmote(emoteUrl: string | null): boolean;
  
  /**
   * Check if emote is a combat emote
   * @param emoteUrl - Emote URL to check
   * @returns true if emote is combat-related
   */
  isCombatEmote(emoteUrl: string | null): boolean;
  
  /**
   * Clean up visual resources
   * Removes held weapon, disposes raycast proxy, cleans up VRM
   */
  destroy(): void;
}
```

**Static Properties:**
```typescript
class MobVisualManager {
  // Shared GLTFLoader for all weapon loads
  private static _weaponLoader: GLTFLoader | null = null;
  
  // Weapon cache: URL → THREE.Object3D
  // Shared across all mobs to avoid duplicate loads
  private static _weaponCache = new Map<string, THREE.Object3D>();
  
  // In-flight load promises: URL → Promise<THREE.Object3D>
  // Deduplicates concurrent loads for same weapon
  private static _pendingLoads = new Map<string, Promise<THREE.Object3D>>();
}
```

**Instance Properties:**
```typescript
class MobVisualManager {
  // VRM avatar instance
  private _avatarInstance: VRMAvatarInstance | null = null;
  
  // Current emote state
  private _currentEmote: string | null = null;
  private _pendingServerEmote: string | null = null;
  
  // Held weapon reference (for cleanup)
  private _heldWeapon: THREE.Object3D | null = null;
  
  // Destroyed flag (prevents async weapon attach after destroy)
  private _destroyed = false;
}
```

---

## Combat System Methods

### Attack Routing

```typescript
class CombatSystem {
  /**
   * Handle mob attack event (initial attack)
   * Routes to appropriate handler based on attackType
   * @param data - Mob attack event data
   * @private
   */
  private handleMobAttack(data: {
    mobId: string;
    targetId: string;
    attackType?: "melee" | "ranged" | "magic";
    spellId?: string;
    arrowId?: string;
  }): void;
  
  /**
   * Handle generic attack (auto-attack tick path)
   * Routes based on attacker type and weapon/attack type
   * @param data - Attack data
   */
  async handleAttack(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    attackType: AttackType;
  }): Promise<void>;
}
```

### Combat State

```typescript
class CombatSystem {
  /**
   * Enter combat state
   * Stores combat data and weapon type for auto-attacks
   * @param attackerId - Attacker entity ID
   * @param targetId - Target entity ID
   * @param speed - Attack speed in ticks
   * @param type - Weapon/attack type (MELEE, RANGED, or MAGIC)
   */
  enterCombat(
    attackerId: EntityID,
    targetId: EntityID,
    speed: number,
    type?: AttackType,
  ): void;
  
  /**
   * Check if entity is in combat
   * @param entityId - Entity ID to check
   * @returns true if entity has active combat state
   */
  isInCombat(entityId: string): boolean;
  
  /**
   * Get combat data for entity
   * @param entityId - Entity ID
   * @returns Combat data or null if not in combat
   */
  getCombatData(entityId: string): CombatData | null;
}
```

---

## Type Guards

### Mob Type Guards

```typescript
/**
 * Get mob attack type from entity config
 * @param entity - Entity to check
 * @returns Attack type or undefined if not a mob
 */
function getMobAttackType(
  entity: unknown
): "melee" | "ranged" | "magic" | undefined;

/**
 * Check if entity is a mob
 * @param entity - Entity to check
 * @returns true if entity is a MobEntity
 */
function isMobEntity(entity: unknown): entity is MobEntityLike;

/**
 * Check if entity has server emote method
 * @param entity - Entity to check
 * @returns true if entity has setServerEmote method
 */
function hasServerEmote(entity: unknown): entity is { setServerEmote(emote: string): void };
```

---

## Events

### COMBAT_MOB_NPC_ATTACK

Emitted when a mob initiates an attack.

```typescript
{
  event: EventType.COMBAT_MOB_NPC_ATTACK,
  data: {
    mobId: string;
    targetId: string;
    attackerType: "mob";
    targetType: "player";
    attackType?: "melee" | "ranged" | "magic";
    spellId?: string;   // For magic attacks
    arrowId?: string;   // For ranged attacks
  }
}
```

### COMBAT_PROJECTILE_LAUNCHED

Emitted when a projectile (spell or arrow) is created.

```typescript
{
  event: EventType.COMBAT_PROJECTILE_LAUNCHED,
  data: {
    attackerId: string;
    targetId: string;
    projectileType: string;  // "arrow" or spell element ("air", "water", etc.)
    sourcePosition: { x: number; y: number; z: number };
    targetPosition: { x: number; y: number; z: number };
    spellId?: string;        // For magic projectiles
    arrowId?: string;        // For ranged projectiles
    delayMs: number;         // Launch delay (600ms for spells, 400ms for arrows)
    travelDurationMs: number; // Travel time based on distance
  }
}
```

### COMBAT_ATTACK_FAILED

Emitted when an attack fails validation.

```typescript
{
  event: EventType.COMBAT_ATTACK_FAILED,
  data: {
    attackerId: string;
    targetId: string;
    reason: "out_of_range" | "on_cooldown" | "invalid_target" | ...;
  }
}
```

---

## Performance Considerations

### Pre-Allocated Damage Params

Both `MagicAttackHandler` and `RangedAttackHandler` use pre-allocated parameter objects to avoid per-attack heap allocations:

```typescript
class MagicAttackHandler {
  /**
   * Pre-allocated params object - mutated in-place
   * SAFETY: Single-threaded tick loop prevents concurrent mutation
   * DO NOT introduce await between mutation and damage calculation
   */
  private readonly _magicParams: MagicDamageParams = {
    magicLevel: 0,
    magicAttackBonus: 0,
    style: "accurate",
    spellBaseMaxHit: 0,
    targetType: "player",
    targetMagicLevel: 0,
    targetDefenseLevel: 0,
    targetMagicDefenseBonus: 0,
    prayerBonuses: undefined,
    targetPrayerBonuses: undefined,
  };
}
```

**Critical Invariant:**
The mob and player attack paths share the same pre-allocated params object. This is safe because:
1. The tick loop is single-threaded
2. Mob paths are synchronous (no `await`)
3. Player paths claim cooldown before any `await`

**⚠️ Warning:** Do NOT add `await` between params mutation and damage calculation, or concurrent attacks could corrupt shared state.

### Weapon Model Caching

```typescript
class MobVisualManager {
  // Static cache shared across all mobs
  private static _weaponCache = new Map<string, THREE.Object3D>();
  
  // Deduplicates concurrent loads
  private static _pendingLoads = new Map<string, Promise<THREE.Object3D>>();
}
```

**Cache Behavior:**
1. First mob loads weapon GLB from network
2. Weapon scene cached by URL
3. Subsequent mobs clone from cache (shared geometry/materials)
4. Concurrent loads for same URL share single promise
5. Cache cleared on world teardown via `clearWeaponCache()`

**Memory Efficiency:**
- Geometry and materials shared via `clone(true)`
- Only Object3D hierarchy duplicated per mob
- Failed loads cleaned from `_pendingLoads` to allow retries

---

## Migration Notes

### Upgrading from v2.x to v3.0

**Breaking Changes:**
- None - all changes are backward compatible

**New Features:**
- Mobs can now use `attackType: "ranged"` and `attackType: "magic"`
- New NPC fields: `spellId`, `arrowId`, `heldWeaponModel`
- New combat constants: `MAGIC_RANGE`, `SPELL_LAUNCH_DELAY_MS`, `ARROW_LAUNCH_DELAY_MS`

**Existing Mobs:**
- All existing mobs default to `attackType: "melee"`
- No changes required to existing NPC manifests
- Held weapons are optional

**To Add Ranged/Magic Mobs:**
1. Set `attackType` in combat config
2. Add `spellId` (magic) or `arrowId` (ranged)
3. Optionally add `heldWeaponModel` for visual weapon
4. Adjust `combatRange` to appropriate value (7-10 tiles)

---

*Combat API Reference for Hyperscape v3.0*
