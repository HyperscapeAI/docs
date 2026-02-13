# Combat System Documentation

> **The Complete Technical Reference for Hyperscape's OSRS-Accurate Combat System**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Attack Types & Handlers](#2-attack-types--handlers)
3. [Mob Combat Configuration](#3-mob-combat-configuration)
4. [Combat Flow](#4-combat-flow)
5. [Damage Calculation](#5-damage-calculation)
6. [Animation & Timing](#6-animation--timing)
7. [Projectile System](#7-projectile-system)
8. [Configuration Reference](#8-configuration-reference)

---

## 1. Architecture Overview

### Combat System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMBAT SYSTEM ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   CombatSystem (Main)                    │    │
│  │                                                          │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────┐ │    │
│  │  │ StateService   │  │ AnimationMgr   │  │RotationMgr│ │    │
│  │  └────────────────┘  └────────────────┘  └───────────┘ │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │MeleeAttack   │    │RangedAttack  │    │MagicAttack   │      │
│  │Handler       │    │Handler       │    │Handler       │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐         │
│    │         │         │         │         │         │         │
│    ▼         ▼         ▼         ▼         ▼         ▼         │
│  Player    Mob      Player    Mob      Player    Mob            │
│  Path      Path     Path      Path     Path      Path           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Attack Types & Handlers

### 2.1 Supported Attack Types

Hyperscape supports three attack types for **both players and mobs**:

| Attack Type | Range | Projectile | Resource Cost |
|-------------|-------|------------|---------------|
| **Melee** | 1-2 tiles | None | None |
| **Ranged** | Up to 10 tiles | Arrows | Arrows (players only) |
| **Magic** | Up to 10 tiles | Spells | Runes (players only) |

### 2.2 Attack Handler Architecture

Each attack type has a dedicated handler that supports both player and mob attackers:

```typescript
// MeleeAttackHandler
class MeleeAttackHandler {
  handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
  }): void;
}

// RangedAttackHandler
class RangedAttackHandler {
  handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    arrowId?: string;  // Optional for event-carried arrow type
  }): void;
  
  private handlePlayerRangedAttack(data): void;
  private handleMobRangedAttack(data): void;
}

// MagicAttackHandler
class MagicAttackHandler {
  async handle(data: {
    attackerId: string;
    targetId: string;
    attackerType: "player" | "mob";
    targetType: "player" | "mob";
    spellId?: string;  // Optional for event-carried spell type
  }): Promise<void>;
  
  private async handlePlayerMagicAttack(data): Promise<void>;
  private handleMobMagicAttack(data): void;
}
```

### 2.3 Player vs. Mob Attack Paths

**Player Attack Path:**
- Equipment bonuses applied (weapon, armor stats)
- Resource consumption (arrows, runes)
- Combat style bonuses (accurate, aggressive, defensive)
- Prayer bonuses
- XP rewards on successful hits

**Mob Attack Path:**
- Stats from NPC manifest (`magic`, `ranged`, `attack`, `strength`)
- Infinite resources (no arrow/rune consumption)
- No equipment bonuses
- No XP rewards
- Spell/arrow type from NPC configuration

### 2.4 Shared Attack Preparation

The `prepareMobAttack()` utility consolidates common validation logic for mob projectile attacks:

```typescript
// packages/shared/src/systems/shared/combat/handlers/AttackContext.ts

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
2. Alive checks
3. Range validation
4. Position validation
5. Cooldown check
6. Face target
7. Play animation

Returns `MobAttackContext` with all validated data, or `null` if any check fails.

---

## 3. Mob Combat Configuration

### 3.1 NPC Manifest Schema

Mobs can be configured with any attack type via JSON manifest:

```json
{
  "id": "dark_wizard",
  "name": "Dark Wizard",
  "category": "mob",
  "stats": {
    "level": 7,
    "health": 9,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "magic": 8,
    "ranged": 1
  },
  "combat": {
    "attackable": true,
    "aggressive": true,
    "retaliates": true,
    "aggroRange": 5,
    "combatRange": 10,
    "leashRange": 15,
    "attackSpeedTicks": 5,
    "attackType": "magic",
    "spellId": "wind_strike",
    "respawnTime": 30000,
    "xpReward": 20
  },
  "appearance": {
    "modelPath": "dark_wizard/dark_wizard.glb",
    "heldWeaponModel": "asset://weapons/staff_basic.glb",
    "scale": 1.0
  }
}
```

### 3.2 Combat Configuration Fields

**Required Fields:**
- `attackable`: Can players attack this NPC?
- `aggressive`: Does NPC auto-aggro players?
- `retaliates`: Does NPC fight back when attacked?
- `combatRange`: Maximum attack range in tiles
- `attackSpeedTicks`: Ticks between attacks (4 = 2.4 seconds)

**Attack Type Fields:**
- `attackType`: `"melee"` (default), `"ranged"`, or `"magic"`
- `spellId`: Required for magic mobs (e.g., `"wind_strike"`, `"fire_bolt"`)
- `arrowId`: Required for ranged mobs (e.g., `"bronze_arrow"`, `"iron_arrow"`)

**Visual Fields:**
- `heldWeaponModel`: Optional GLB model path for visual weapon (bow, staff, sword)
  - Format: `"asset://weapons/bow_shortbow.glb"`
  - Attached to VRM hand bone using Asset Forge metadata
  - Cached and shared across mobs of same type

### 3.3 Attack Type Examples

**Melee Mob (Default):**
```json
{
  "combat": {
    "attackType": "melee",
    "combatRange": 1,
    "attackSpeedTicks": 4
  }
}
```

**Ranged Mob:**
```json
{
  "combat": {
    "attackType": "ranged",
    "arrowId": "bronze_arrow",
    "combatRange": 7,
    "attackSpeedTicks": 4
  },
  "appearance": {
    "heldWeaponModel": "asset://weapons/bow_shortbow.glb"
  }
}
```

**Magic Mob:**
```json
{
  "combat": {
    "attackType": "magic",
    "spellId": "wind_strike",
    "combatRange": 10,
    "attackSpeedTicks": 5
  },
  "appearance": {
    "heldWeaponModel": "asset://weapons/staff_basic.glb"
  }
}
```

### 3.4 Weapon Visual System

The `MobVisualManager` handles weapon attachment for mobs:

```typescript
class MobVisualManager {
  // Static weapon cache (shared across all mobs)
  private static _weaponCache = new Map<string, THREE.Object3D>();
  private static _pendingLoads = new Map<string, Promise<THREE.Object3D>>();
  
  // Per-instance weapon tracking
  private _heldWeapon: THREE.Object3D | null = null;
  
  // Attach weapon GLB to VRM hand bone
  private attachHeldWeapon(): void;
  
  // Clear cache on world teardown
  static clearWeaponCache(): void;
}
```

**Features:**
- Weapons cached by URL to avoid duplicate loads
- Concurrent load deduplication via `_pendingLoads`
- Geometry/material sharing via `clone(true)`
- Proper cleanup on mob destroy and world teardown
- Supports Asset Forge attachment metadata (V1 and V2 formats)

---

## 4. Combat Flow

### 4.1 Mob Attack Routing

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOB ATTACK ROUTING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Initial Attack (Event-Based):                                   │
│  ─────────────────────────────                                  │
│  MobEntity.performAttackAction()                                │
│         │                                                        │
│         ▼                                                        │
│  COMBAT_MOB_NPC_ATTACK event                                    │
│  {                                                               │
│    mobId, targetId,                                              │
│    attackType: "melee" | "ranged" | "magic",                    │
│    spellId?, arrowId?                                            │
│  }                                                               │
│         │                                                        │
│         ▼                                                        │
│  CombatSystem.handleMobAttack()                                 │
│         │                                                        │
│         ▼                                                        │
│  switch (attackType) {                                           │
│    case "magic":  → magicHandler.handle()                       │
│    case "ranged": → rangedHandler.handle()                      │
│    case "melee":  → meleeHandler.handle()                       │
│    default:       → meleeHandler.handle()  // Fallback          │
│  }                                                               │
│         │                                                        │
│         ▼                                                        │
│  enterCombat(attackerId, targetId, speed, weaponType)           │
│  // Stores weaponType in combat state                           │
│                                                                  │
│  Auto-Attack Ticks (Tick Processor):                            │
│  ────────────────────────────────────                           │
│  CombatTickProcessor.processAutoAttackOnTick()                  │
│         │                                                        │
│         ▼                                                        │
│  Read combatState.weaponType                                    │
│  // Mobs: Use stored weaponType                                 │
│  // Players: Resolve from equipped weapon                       │
│         │                                                        │
│         ▼                                                        │
│  Route to correct handler based on weaponType                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Mob Magic Attack Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOB MAGIC ATTACK FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Resolve mob entity and NPC data                             │
│  2. Get spellId (event data OR NPC manifest)                    │
│  3. prepareMobAttack() - shared validation                      │
│     • Entity resolution                                          │
│     • Alive checks                                               │
│     • Range check (MAGIC_RANGE = 10 tiles)                      │
│     • Cooldown check                                             │
│     • Face target                                                │
│     • Play SPELL_CAST animation                                  │
│  4. Calculate damage using mob's magic stat                     │
│  5. Create projectile with spell element                        │
│  6. Emit COMBAT_PROJECTILE_LAUNCHED event                       │
│     • projectileType: spell.element (air, water, earth, fire)   │
│     • delayMs: SPELL_LAUNCH_DELAY_MS (600ms)                    │
│     • travelDurationMs: Based on distance                       │
│  7. Enter combat with weaponType = MAGIC                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Mob Ranged Attack Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOB RANGED ATTACK FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Resolve mob entity and NPC data                             │
│  2. Get arrowId (event data OR NPC manifest)                    │
│  3. prepareMobAttack() - shared validation                      │
│     • Entity resolution                                          │
│     • Alive checks                                               │
│     • Range check (RANGED_RANGE = 10 tiles)                     │
│     • Cooldown check                                             │
│     • Face target                                                │
│     • Play RANGE animation                                       │
│  4. Calculate damage using mob's ranged stat                    │
│  5. Create projectile with arrow type                           │
│  6. Emit COMBAT_PROJECTILE_LAUNCHED event                       │
│     • projectileType: "arrow"                                    │
│     • arrowId: Arrow type for visual                            │
│     • delayMs: ARROW_LAUNCH_DELAY_MS (400ms)                    │
│     • travelDurationMs: Based on distance                       │
│  7. Enter combat with weaponType = RANGED                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Damage Calculation

### 5.1 Mob Magic Damage

```typescript
// Mob magic damage calculation (no equipment bonuses)
function calculateMobMagicDamage(
  target: Entity | MobEntity,
  targetType: "player" | "mob",
  magicLevel: number,  // From NPC manifest stats.magic
  spell: Spell,
): number {
  // Target stats
  const targetMagicLevel = targetType === "mob" ? 1 : getPlayerSkillLevel(target, "magic");
  const targetDefenseLevel = targetType === "mob" 
    ? target.getMobData().defense 
    : getPlayerSkillLevel(target, "defense");
  const targetMagicDefense = targetType === "mob" 
    ? 0 
    : getPlayerEquipmentStats(target).magicDefense;
  
  // Damage params (pre-allocated, zero GC)
  const params = {
    magicLevel,
    magicAttackBonus: 0,  // Mobs don't have equipment
    style: "accurate",
    spellBaseMaxHit: spell.baseMaxHit,
    targetType: targetType === "mob" ? "npc" : "player",
    targetMagicLevel,
    targetDefenseLevel,
    targetMagicDefenseBonus: targetMagicDefense,
    prayerBonuses: undefined,  // Mobs don't use prayer
    targetPrayerBonuses: getTargetPrayerBonuses(target, targetType),
  };
  
  return calculateMagicDamage(params, rng).damage;
}
```

### 5.2 Mob Ranged Damage

```typescript
// Mob ranged damage calculation (no equipment bonuses)
function calculateMobRangedDamage(
  target: Entity | MobEntity,
  targetType: "player" | "mob",
  rangedLevel: number,  // From NPC manifest stats.ranged
  arrowId: string,
): number {
  // Target stats
  const targetDefenseLevel = targetType === "mob"
    ? target.getMobData().defense
    : getPlayerSkillLevel(target, "defense");
  const targetRangedDefense = targetType === "mob"
    ? 0
    : getPlayerEquipmentStats(target).defenseRanged;
  
  // Arrow strength from ammunition service
  const arrowStrength = ammunitionService.getArrowData(arrowId)?.rangedStrength ?? 7;
  
  // Damage params (pre-allocated, zero GC)
  const params = {
    rangedLevel,
    rangedAttackBonus: 0,  // Mobs don't have equipment
    rangedStrengthBonus: arrowStrength,
    style: "accurate",
    targetDefenseLevel,
    targetRangedDefenseBonus: targetRangedDefense,
    prayerBonuses: undefined,  // Mobs don't use prayer
    targetPrayerBonuses: getTargetPrayerBonuses(target, targetType),
  };
  
  return calculateRangedDamage(params, rng).damage;
}
```

---

## 6. Animation & Timing

### 6.1 Combat Animations

The `CombatAnimationManager` routes animations based on attack type:

```typescript
// Animation mapping
const EMOTE_MAP = {
  melee: {
    player: Emotes.SWORD_SWING,  // Or weapon-specific
    mob: Emotes.COMBAT,
  },
  ranged: {
    player: Emotes.RANGE,
    mob: Emotes.RANGE,
  },
  magic: {
    player: Emotes.SPELL_CAST,
    mob: Emotes.SPELL_CAST,
  },
};
```

**Animation Timing:**
- Animation starts immediately on attack
- Held for `attackSpeedTicks - 1` ticks
- Returns to idle/movement animation on final tick

### 6.2 Combat Emote Priority

```typescript
// Priority emotes override AI-driven animations
function isPriorityEmote(emoteUrl: string | null): boolean {
  return (
    emoteUrl === Emotes.COMBAT ||
    emoteUrl === Emotes.SWORD_SWING ||
    emoteUrl === Emotes.RANGE ||
    emoteUrl === Emotes.SPELL_CAST ||
    emoteUrl === Emotes.DEATH
  );
}
```

---

## 7. Projectile System

### 7.1 Projectile Creation

Both magic and ranged attacks create projectiles for visual synchronization:

```typescript
interface CreateProjectileParams {
  sourceId: string;
  targetId: string;
  attackType: AttackType;
  damage: number;
  currentTick: number;
  sourcePosition: { x: number; z: number };
  targetPosition: { x: number; z: number };
  spellId?: string;   // For magic projectiles
  arrowId?: string;   // For ranged projectiles
  xpReward: number;
}
```

### 7.2 Projectile Launch Timing

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECTILE TIMING                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Magic Projectile:                                               │
│  ─────────────────                                              │
│  T0: Attack starts, SPELL_CAST animation begins                 │
│  T0 + 600ms: Projectile spawns (SPELL_LAUNCH_DELAY_MS)         │
│  T0 + 600ms + travel: Projectile hits, damage applies           │
│                                                                  │
│  Ranged Projectile:                                              │
│  ──────────────────                                             │
│  T0: Attack starts, RANGE animation begins                      │
│  T0 + 400ms: Arrow spawns (ARROW_LAUNCH_DELAY_MS)              │
│  T0 + 400ms + travel: Arrow hits, damage applies                │
│                                                                  │
│  Travel Duration Calculation:                                    │
│  ────────────────────────────                                   │
│  hitDelayTicks = calculateHitDelay(attackType, distance)        │
│  travelDurationMs = max(200, hitDelayTicks × 600 - launchDelay) │
│                                                                  │
│  This ensures visual projectile arrival coincides with          │
│  server-side damage application.                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Hit Delay Formulas

```typescript
// OSRS-accurate hit delay calculation
const HIT_DELAY = {
  // Melee: Instant
  MELEE_BASE: 0,
  
  // Ranged: 1 + floor((3 + distance) / 6)
  RANGED_BASE: 1,
  RANGED_DISTANCE_OFFSET: 3,
  RANGED_DISTANCE_DIVISOR: 6,
  
  // Magic: 1 + floor((1 + distance) / 3)
  MAGIC_BASE: 1,
  MAGIC_DISTANCE_OFFSET: 1,
  MAGIC_DISTANCE_DIVISOR: 3,
  
  MAX_HIT_DELAY: 10,
};
```

**Examples:**

| Attack Type | Distance | Hit Delay (ticks) | Hit Delay (ms) |
|-------------|----------|-------------------|----------------|
| Melee | Any | 0 | 0 |
| Ranged | 1 tile | 1 | 600 |
| Ranged | 5 tiles | 2 | 1200 |
| Ranged | 10 tiles | 3 | 1800 |
| Magic | 1 tile | 1 | 600 |
| Magic | 5 tiles | 3 | 1800 |
| Magic | 10 tiles | 4 | 2400 |

---

## 8. Configuration Reference

### 8.1 Combat Constants

```typescript
// packages/shared/src/constants/CombatConstants.ts

export const COMBAT_CONSTANTS = {
  // === Ranges (tiles) ===
  RANGED_RANGE: 10,
  MAGIC_RANGE: 10,
  MELEE_RANGE_STANDARD: 1,
  MELEE_RANGE_HALBERD: 2,
  
  // === Projectile Launch Delays (ms) ===
  SPELL_LAUNCH_DELAY_MS: 600,   // Spell cast wind-up
  ARROW_LAUNCH_DELAY_MS: 400,   // Bow draw wind-up
  
  // === Tick System ===
  TICK_DURATION_MS: 600,
  DEFAULT_ATTACK_SPEED_TICKS: 4,
  COMBAT_TIMEOUT_TICKS: 17,
  
  // === Hit Delay Formulas ===
  HIT_DELAY: {
    MELEE_BASE: 0,
    RANGED_BASE: 1,
    RANGED_DISTANCE_OFFSET: 3,
    RANGED_DISTANCE_DIVISOR: 6,
    MAGIC_BASE: 1,
    MAGIC_DISTANCE_OFFSET: 1,
    MAGIC_DISTANCE_DIVISOR: 3,
    MAX_HIT_DELAY: 10,
  },
};
```

### 8.2 NPC Combat Defaults

```typescript
export const COMBAT_CONSTANTS = {
  DEFAULTS: {
    NPC: {
      ATTACK_SPEED_TICKS: 4,
      AGGRO_RANGE: 4,
      COMBAT_RANGE: 1,
      LEASH_RANGE: 42,
      RESPAWN_TICKS: 25,
      WANDER_RADIUS: 5,
    },
  },
};
```

---

## Summary

The combat system now supports **full melee/ranged/magic combat for both players and mobs**:

### Key Features

✅ **Three attack types**: Melee, Ranged, Magic  
✅ **Mob projectile attacks**: Mobs can cast spells and fire arrows  
✅ **Visual weapon system**: Bows, staves, and weapons attach to mob hands  
✅ **Shared attack preparation**: `prepareMobAttack()` eliminates code duplication  
✅ **Proper animation routing**: SPELL_CAST, RANGE, SWORD_SWING emotes  
✅ **OSRS-accurate timing**: Hit delays, projectile travel, launch delays  
✅ **Resource management**: Weapon model caching, proper cleanup  
✅ **Zero-allocation hot paths**: Pre-allocated damage params  

### Combat Handler Files

- `CombatSystem.ts` - Main orchestration and attack routing
- `handlers/MeleeAttackHandler.ts` - Melee combat
- `handlers/RangedAttackHandler.ts` - Ranged combat (players and mobs)
- `handlers/MagicAttackHandler.ts` - Magic combat (players and mobs)
- `handlers/AttackContext.ts` - Shared utilities (`prepareMobAttack`, `checkProjectileRange`)
- `CombatAnimationManager.ts` - Animation routing by attack type
- `ProjectileService.ts` - Projectile creation and tracking
- `entities/managers/MobVisualManager.ts` - Weapon attachment and caching

---

*Document updated for Hyperscape Combat System v3.0 - Mob Projectile Attacks*
