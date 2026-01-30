# Ranged & Magic Combat System

> **F2P Ranged and Magic Combat Implementation Guide**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Attack Type System](#2-attack-type-system)
3. [Ranged Combat](#3-ranged-combat)
4. [Magic Combat](#4-magic-combat)
5. [Projectile System](#5-projectile-system)
6. [Damage Calculators](#6-damage-calculators)
7. [Ammunition & Runes](#7-ammunition--runes)
8. [Combat Styles](#8-combat-styles)
9. [UI Components](#9-ui-components)
10. [Network Protocol](#10-network-protocol)

---

## 1. Overview

Hyperscape implements OSRS-accurate ranged and magic combat with F2P content (levels 1-40).

### 1.1 Implemented Features

**Ranged Combat:**
- ✅ Bows (shortbow, oak, willow, maple)
- ✅ Arrows (bronze, iron, steel, mithril, adamant)
- ✅ Combat styles (accurate, rapid, longrange)
- ✅ Ammunition consumption (1 arrow per shot)
- ✅ Projectile visuals with 3D arrow meshes
- ✅ OSRS-accurate hit delay formulas
- ✅ Ranged XP distribution

**Magic Combat:**
- ✅ Combat spells (Strike and Bolt tiers, levels 1-35)
- ✅ Rune system (air, water, earth, fire, mind, chaos)
- ✅ Elemental staves (infinite runes)
- ✅ Autocast system
- ✅ Staffless casting support
- ✅ Spell projectile visuals
- ✅ OSRS-accurate magic defense formulas
- ✅ Magic XP distribution

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              RANGED/MAGIC COMBAT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   CombatSystem                            │   │
│  │                 (Attack Routing)                          │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│         ┌─────────────┼─────────────┐                           │
│         │             │             │                           │
│         ▼             ▼             ▼                           │
│    ┌────────┐   ┌─────────┐   ┌────────┐                       │
│    │ MELEE  │   │ RANGED  │   │ MAGIC  │                       │
│    └────────┘   └────┬────┘   └────┬───┘                       │
│                       │             │                           │
│                       ▼             ▼                           │
│              ┌─────────────────────────────┐                    │
│              │   ProjectileService         │                    │
│              │   (Hit Delay Tracking)      │                    │
│              └──────────┬──────────────────┘                    │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         │               │               │                       │
│         ▼               ▼               ▼                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                    │
│  │Ammunition│   │   Rune   │   │  Spell   │                    │
│  │ Service  │   │ Service  │   │ Service  │                    │
│  └──────────┘   └──────────┘   └──────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Attack Type System

### 2.1 Attack Type Enum

```typescript
// packages/shared/src/types/game/item-types.ts

export enum AttackType {
  MELEE = "melee",
  RANGED = "ranged",
  MAGIC = "magic",
}
```

### 2.2 Attack Type Routing

The combat system routes attacks based on weapon type and selected spell:

```typescript
// Routing logic in ServerNetwork/index.ts

function getPlayerAttackType(playerId: string): AttackType {
  // 1. Check if player has spell selected (highest priority)
  const selectedSpell = playerEntity.data.selectedSpell;
  if (selectedSpell) {
    return AttackType.MAGIC;  // Spell overrides weapon
  }

  // 2. Check equipped weapon type
  const weapon = equipment?.weapon?.item;
  if (weapon) {
    if (weapon.attackType) {
      return weapon.attackType;  // Explicit attackType
    }
    
    // Fallback to weaponType
    if (weapon.weaponType === WeaponType.BOW) {
      return AttackType.RANGED;
    }
    if (weapon.weaponType === WeaponType.STAFF || weapon.weaponType === WeaponType.WAND) {
      return AttackType.MAGIC;
    }
  }

  // 3. Default to melee (unarmed)
  return AttackType.MELEE;
}
```

**OSRS-Accurate Behavior:**
- You can cast spells without a staff (lower accuracy)
- Elemental staves provide infinite runes for their element
- Staff provides magic attack bonus but is not required

### 2.3 Range Calculation

```typescript
// Melee: Cardinal-only for range 1
if (attackType === AttackType.MELEE) {
  return tilesWithinMeleeRange(attackerTile, targetTile, range);
}

// Ranged/Magic: Chebyshev distance (8-directional)
const distance = tileChebyshevDistance(attackerTile, targetTile);
return distance <= range && distance > 0;
```

---

## 3. Ranged Combat

### 3.1 Ranged Weapons

| Weapon | Level | Attack Bonus | Range | Speed |
|--------|-------|--------------|-------|-------|
| Shortbow | 1 | +8 | 7 tiles | 4 ticks |
| Oak shortbow | 5 | +14 | 7 tiles | 4 ticks |
| Willow shortbow | 20 | +20 | 7 tiles | 4 ticks |
| Maple shortbow | 30 | +29 | 7 tiles | 4 ticks |

### 3.2 Ammunition

| Arrow | Level | Ranged Strength | Required Bow |
|-------|-------|-----------------|--------------|
| Bronze arrow | 1 | +7 | Any |
| Iron arrow | 1 | +10 | Any |
| Steel arrow | 5 | +16 | Oak+ |
| Mithril arrow | 20 | +22 | Willow+ |
| Adamant arrow | 30 | +31 | Maple+ |

### 3.3 Ranged Damage Formula

```
┌─────────────────────────────────────────────────────────────────┐
│                RANGED DAMAGE CALCULATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Calculate Effective Ranged Level                       │
│  effectiveRanged = floor(rangedLevel × prayer) + style + 8      │
│                                                                  │
│  Style Bonuses:                                                  │
│    Accurate = +3, Rapid = +0, Longrange = +0                    │
│                                                                  │
│  Step 2: Calculate Attack Roll                                   │
│  attackRoll = effectiveRanged × (equipmentBonus + 64)           │
│                                                                  │
│  Step 3: Calculate Defense Roll                                  │
│  defenseRoll = (defenseLevel + 9) × (rangedDefense + 64)        │
│                                                                  │
│  Step 4: Hit Chance (same as melee)                             │
│  if (attackRoll > defenseRoll):                                 │
│    hitChance = 1 - (defenseRoll + 2) / (2 × (attackRoll + 1))  │
│  else:                                                           │
│    hitChance = attackRoll / (2 × (defenseRoll + 1))             │
│                                                                  │
│  Step 5: Calculate Max Hit                                       │
│  maxHit = floor(0.5 + effectiveStr × (arrowStrength + 64) / 640)│
│                                                                  │
│  Step 6: Roll Damage                                             │
│  damage = random(0, maxHit)                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Combat Styles

| Style | Speed | Accuracy | Range | XP Distribution |
|-------|-------|----------|-------|-----------------|
| Accurate | Normal | +3 ranged | Normal | 4 Ranged, 1.33 HP |
| Rapid | -1 tick | Normal | Normal | 4 Ranged, 1.33 HP |
| Longrange | Normal | Normal | +2 tiles | 2 Ranged, 2 Def, 1.33 HP |

### 3.5 Ammunition Consumption

```typescript
// AmmunitionService.ts

class AmmunitionService {
  // Validate arrows are equipped and compatible
  validateArrows(bow: Item, arrowSlot: EquipmentSlot | null): {
    valid: boolean;
    error?: string;
  };

  // Consume 1 arrow per shot (no Ava's devices in F2P)
  consumeArrow(playerId: string, world: World): {
    success: boolean;
    rangedStrengthBonus: number;
    remainingQuantity: number;
  };

  // Check if player has arrows
  hasArrows(playerId: string, world: World): boolean;

  // Get arrow strength bonus for damage calculation
  getArrowStrengthBonus(playerId: string, world: World): number;
}
```

**F2P Scope:**
- 100% consumption rate (1 arrow per shot)
- No Ava's devices (no retrieval)
- Future: Ava's attractor (60%), accumulator (72%), assembler (80%)

---

## 4. Magic Combat

### 4.1 Combat Spells

**Strike Tier (Levels 1-13):**
| Spell | Level | Max Hit | XP | Runes |
|-------|-------|---------|----|----|
| Wind Strike | 1 | 2 | 5.5 | 1 air, 1 mind |
| Water Strike | 5 | 4 | 7.5 | 1 air, 1 water, 1 mind |
| Earth Strike | 9 | 6 | 9.5 | 1 air, 2 earth, 1 mind |
| Fire Strike | 13 | 8 | 11.5 | 2 air, 3 fire, 1 mind |

**Bolt Tier (Levels 17-35):**
| Spell | Level | Max Hit | XP | Runes |
|-------|-------|---------|----|----|
| Wind Bolt | 17 | 9 | 13.5 | 2 air, 1 chaos |
| Water Bolt | 23 | 10 | 16.5 | 2 air, 2 water, 1 chaos |
| Earth Bolt | 29 | 11 | 19.5 | 2 air, 3 earth, 1 chaos |
| Fire Bolt | 35 | 12 | 22.5 | 3 air, 4 fire, 1 chaos |

### 4.2 Magic Damage Formula

```
┌─────────────────────────────────────────────────────────────────┐
│                MAGIC DAMAGE CALCULATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Calculate Effective Magic Level                        │
│  effectiveMagic = floor(magicLevel × prayer) + style + 8        │
│                                                                  │
│  Style Bonuses:                                                  │
│    Accurate = +3, Longrange = +1, Autocast = +0                 │
│                                                                  │
│  Step 2: Calculate Attack Roll                                   │
│  attackRoll = effectiveMagic × (magicAttackBonus + 64)          │
│                                                                  │
│  Step 3: Calculate Defense Roll                                  │
│  PLAYERS:                                                        │
│    effectiveDef = floor(0.7 × magic + 0.3 × defense) + 9        │
│    defenseRoll = effectiveDef × (magicDefense + 64)             │
│                                                                  │
│  NPCs:                                                           │
│    defenseRoll = (magicLevel + 9) × (magicDefense + 64)         │
│    (Defense level does NOT affect magic defense for NPCs)       │
│                                                                  │
│  Step 4: Hit Chance (same formula as melee/ranged)             │
│  if (attackRoll > defenseRoll):                                 │
│    hitChance = 1 - (defenseRoll + 2) / (2 × (attackRoll + 1))  │
│  else:                                                           │
│    hitChance = attackRoll / (2 × (defenseRoll + 1))             │
│                                                                  │
│  Step 5: Max Hit (from spell, not equipment)                    │
│  maxHit = spell.baseMaxHit                                       │
│                                                                  │
│  Step 6: Roll Damage                                             │
│  damage = random(0, maxHit)                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Difference from Melee/Ranged:**
- Magic defense uses 70% magic level + 30% defense level (players only)
- NPCs use only magic level for defense
- Max hit comes from spell, not equipment bonuses

### 4.3 Elemental Staves

| Staff | Infinite Runes | Magic Attack |
|-------|----------------|--------------|
| Staff | None | +4 |
| Magic staff | None | +10 |
| Staff of air | Air runes | +10 |
| Staff of water | Water runes | +10 |
| Staff of earth | Earth runes | +10 |
| Staff of fire | Fire runes | +10 |

### 4.4 Autocast System

```typescript
// Player can select a spell to auto-cast
// Spell selection persists in database

interface PlayerData {
  selectedSpell: string | null;  // Spell ID or null
}

// When attacking with autocast enabled:
// 1. Check if player has selected spell
// 2. Validate runes are available
// 3. Cast spell instead of melee attack
// 4. Consume runes (accounting for elemental staff)
```

**OSRS-Accurate Behavior:**
- Autocast cleared on weapon swap
- Can cast spells manually without autocast
- Staffless casting allowed (lower accuracy)

### 4.5 Rune Consumption

```typescript
// RuneService.ts

class RuneService {
  // Check if player has required runes
  hasRequiredRunes(
    playerId: string,
    requirements: RuneRequirement[],
    world: World
  ): { valid: boolean; missing?: RuneRequirement[] };

  // Consume runes for spell cast
  consumeRunes(
    playerId: string,
    requirements: RuneRequirement[],
    world: World
  ): { success: boolean; error?: string };

  // Get infinite runes from equipped staff
  getInfiniteRunesFromStaff(playerId: string, world: World): string[];
}

interface RuneRequirement {
  runeId: string;
  quantity: number;
}
```

**Elemental Staff Logic:**
```typescript
// Example: Fire Strike requires 2 air + 3 fire + 1 mind
// With Staff of Fire equipped:
// - Fire runes: infinite (not consumed)
// - Air runes: 2 consumed
// - Mind runes: 1 consumed
```

---

## 5. Projectile System

### 5.1 Hit Delay Formulas

```
┌─────────────────────────────────────────────────────────────────┐
│                    HIT DELAY FORMULAS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MELEE:                                                          │
│  delay = 0 ticks (immediate)                                     │
│                                                                  │
│  RANGED:                                                         │
│  delay = 1 + floor((3 + distance) / 6) ticks                    │
│                                                                  │
│  Examples:                                                       │
│    Distance 1: 1 + floor(4/6) = 1 tick                          │
│    Distance 5: 1 + floor(8/6) = 2 ticks                         │
│    Distance 10: 1 + floor(13/6) = 3 ticks                       │
│                                                                  │
│  MAGIC:                                                          │
│  delay = 1 + floor((1 + distance) / 3) ticks                    │
│                                                                  │
│  Examples:                                                       │
│    Distance 1: 1 + floor(2/3) = 1 tick                          │
│    Distance 5: 1 + floor(6/3) = 3 ticks                         │
│    Distance 10: 1 + floor(11/3) = 4 ticks                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 ProjectileService

```typescript
// packages/shared/src/systems/shared/combat/ProjectileService.ts

class ProjectileService {
  private activeProjectiles: Map<string, Projectile> = new Map();

  // Create projectile with hit delay
  createProjectile(params: {
    sourceId: string;
    targetId: string;
    attackType: AttackType;
    distance: number;
    damage: number;
    currentTick: number;
  }): Projectile;

  // Process tick: check for projectiles that should hit
  processTick(currentTick: number): Projectile[];

  // Cancel projectiles for dead target
  cancelProjectilesForTarget(targetId: string): void;
}

interface Projectile {
  id: string;
  sourceId: string;
  targetId: string;
  attackType: AttackType;
  launchTick: number;
  hitTick: number;
  distance: number;
  damage: number;
}
```

### 5.3 Projectile Rendering

```typescript
// packages/shared/src/systems/client/ProjectileRenderer.ts

class ProjectileRenderer extends System {
  // Arrow projectiles: 3D mesh with arc trajectory
  private renderArrow(projectile: Projectile, progress: number): void;

  // Spell projectiles: Colored orbs with delayed spawn
  private renderSpell(projectile: Projectile, progress: number): void;
}
```

**Visual Effects:**

**Arrows:**
- 3D arrow mesh (brown shaft, metal tip)
- Straight-line trajectory
- 400ms delay before visual spawn (OSRS-accurate)
- Rotates to face direction

**Spells:**
- Colored sphere based on element
- Homing trajectory (tracks moving targets)
- Delayed spawn based on hit delay
- Additive blending for glow effect

### 5.4 Spell Visual Configuration

```typescript
// packages/shared/src/data/spell-visuals.ts

export const SPELL_VISUALS: Record<string, SpellVisualConfig> = {
  wind_strike: { color: 0xcccccc, size: 0.25, glowIntensity: 0.25 },
  water_strike: { color: 0x3b82f6, size: 0.25, glowIntensity: 0.35 },
  earth_strike: { color: 0x8b4513, size: 0.25, glowIntensity: 0.2 },
  fire_strike: { color: 0xff4500, size: 0.25, glowIntensity: 0.5 },
  wind_bolt: { color: 0xcccccc, size: 0.35, glowIntensity: 0.35 },
  water_bolt: { color: 0x3b82f6, size: 0.35, glowIntensity: 0.45 },
  earth_bolt: { color: 0x8b4513, size: 0.35, glowIntensity: 0.3 },
  fire_bolt: { color: 0xff4500, size: 0.35, glowIntensity: 0.6 },
};
```

---

## 6. Damage Calculators

### 6.1 RangedDamageCalculator

```typescript
// packages/shared/src/systems/shared/combat/RangedDamageCalculator.ts

export interface RangedDamageParams {
  rangedLevel: number;
  rangedAttackBonus: number;
  rangedStrengthBonus: number;  // From arrows
  style: RangedCombatStyle;
  targetDefenseLevel: number;
  targetRangedDefenseBonus: number;
  prayerBonuses?: PrayerCombatBonuses;
}

export interface RangedDamageResult {
  damage: number;
  maxHit: number;
  didHit: boolean;
  hitChance: number;
}

export function calculateRangedDamage(
  params: RangedDamageParams,
  rng: SeededRandom
): RangedDamageResult;
```

### 6.2 MagicDamageCalculator

```typescript
// packages/shared/src/systems/shared/combat/MagicDamageCalculator.ts

export interface MagicDamageParams {
  magicLevel: number;
  magicAttackBonus: number;
  style: MagicCombatStyle;
  spellBaseMaxHit: number;
  targetType: "player" | "npc";
  targetMagicLevel: number;
  targetDefenseLevel: number;
  targetMagicDefenseBonus: number;
  prayerBonuses?: PrayerCombatBonuses;
}

export interface MagicDamageResult {
  damage: number;
  maxHit: number;
  didHit: boolean;
  hitChance: number;
  splashed: boolean;  // Hit but 0 damage
}

export function calculateMagicDamage(
  params: MagicDamageParams,
  rng: SeededRandom
): MagicDamageResult;
```

---

## 7. Ammunition & Runes

### 7.1 Ammunition Manifest

```json
// packages/server/world/assets/manifests/ammunition.json

{
  "arrows": [
    {
      "id": "bronze_arrow",
      "name": "Bronze arrow",
      "rangedStrength": 7,
      "requiredBowTier": 1,
      "stackable": true
    },
    {
      "id": "iron_arrow",
      "name": "Iron arrow",
      "rangedStrength": 10,
      "requiredBowTier": 1,
      "stackable": true
    }
  ]
}
```

### 7.2 Runes Manifest

```json
// packages/server/world/assets/manifests/runes.json

{
  "runes": [
    { "id": "air_rune", "name": "Air rune", "element": "air", "stackable": true },
    { "id": "water_rune", "name": "Water rune", "element": "water", "stackable": true },
    { "id": "earth_rune", "name": "Earth rune", "element": "earth", "stackable": true },
    { "id": "fire_rune", "name": "Fire rune", "element": "fire", "stackable": true },
    { "id": "mind_rune", "name": "Mind rune", "element": null, "stackable": true },
    { "id": "chaos_rune", "name": "Chaos rune", "element": null, "stackable": true }
  ],
  "elementalStaves": [
    { "id": "staff_of_air", "providesInfinite": ["air_rune"] },
    { "id": "staff_of_water", "providesInfinite": ["water_rune"] },
    { "id": "staff_of_earth", "providesInfinite": ["earth_rune"] },
    { "id": "staff_of_fire", "providesInfinite": ["fire_rune"] }
  ]
}
```

### 7.3 Combat Spells Manifest

```json
// packages/server/world/assets/manifests/combat-spells.json

{
  "standard": {
    "strike": [
      {
        "id": "wind_strike",
        "name": "Wind Strike",
        "level": 1,
        "baseMaxHit": 2,
        "baseXp": 5.5,
        "element": "air",
        "attackSpeed": 5,
        "runes": [
          { "runeId": "air_rune", "quantity": 1 },
          { "runeId": "mind_rune", "quantity": 1 }
        ]
      }
    ],
    "bolt": [
      {
        "id": "wind_bolt",
        "name": "Wind Bolt",
        "level": 17,
        "baseMaxHit": 9,
        "baseXp": 13.5,
        "element": "air",
        "attackSpeed": 5,
        "runes": [
          { "runeId": "air_rune", "quantity": 2 },
          { "runeId": "chaos_rune", "quantity": 1 }
        ]
      }
    ]
  }
}
```

---

## 8. Combat Styles

### 8.1 Ranged Styles

```typescript
// packages/shared/src/constants/WeaponStyleConfig.ts

[WeaponType.BOW]: ["accurate", "rapid", "longrange"]

// Style bonuses
export const RANGED_STYLE_BONUSES = {
  accurate: { attackBonus: 3, speedModifier: 0, rangeModifier: 0 },
  rapid: { attackBonus: 0, speedModifier: -1, rangeModifier: 0 },
  longrange: { attackBonus: 0, speedModifier: 0, rangeModifier: 2 },
};
```

### 8.2 Magic Styles

```typescript
[WeaponType.STAFF]: ["accurate", "longrange", "autocast"]
[WeaponType.WAND]: ["accurate", "longrange", "autocast"]

// Style bonuses
export const MAGIC_STYLE_BONUSES = {
  accurate: { attackBonus: 3, speedModifier: 0, rangeModifier: 0 },
  longrange: { attackBonus: 1, speedModifier: 0, rangeModifier: 2 },
  autocast: { attackBonus: 0, speedModifier: 0, rangeModifier: 0 },
};
```

---

## 9. UI Components

### 9.1 SpellsPanel

```typescript
// packages/client/src/game/panels/SpellsPanel.tsx

export function SpellsPanel({ stats, world }: SpellsPanelProps) {
  // Display all available spells in grid
  // Click to select autocast spell
  // Right-click for context menu (autocast, cast once)
  // Shows level requirements and rune costs
}
```

**Features:**
- 2-4 column adaptive grid based on panel width
- Element-colored spell icons (💨 💧 🪨 🔥)
- Locked spells show level requirement
- Selected spell highlighted with glow effect
- Tooltip shows max hit, XP, and rune cost

### 9.2 Equipment Panel Updates

**Ammo Slot Added:**
- New equipment slot for arrows
- Displays arrow quantity
- Drag-and-drop support
- Shows ranged strength bonus in tooltip

**Layout:**
```
┌─────────────────────────────────┐
│  [empty]  [Head]    [Ammo]      │
│  [Weapon] [Body]    [Shield]    │
│  [empty]  [Legs]    [empty]     │
└─────────────────────────────────┘
```

### 9.3 Combat Panel Updates

**New Combat Styles:**
- Rapid (⚡) - Ranged only
- Longrange (🎯) - Ranged and Magic
- Autocast (✨) - Magic only

**Style Icons:**
```typescript
// CombatPanel.tsx

const RANGED_STYLES = [
  { id: "accurate", icon: "🎯", description: "+3 Ranged levels" },
  { id: "rapid", icon: "⚡", description: "Attack 1 tick faster" },
  { id: "longrange", icon: "🔭", description: "+2 Attack range" },
];

const MAGIC_STYLES = [
  { id: "accurate", icon: "🎯", description: "+3 Magic levels" },
  { id: "longrange", icon: "🔭", description: "+2 Attack range" },
];
```

---

## 10. Network Protocol

### 10.1 Client → Server Packets

```typescript
// Set autocast spell
interface SetAutocastPacket {
  type: "onSetAutocast";
  spellId: string | null;  // null = clear autocast
  timestamp: number;       // For replay attack prevention
}

// Attack with ranged/magic (uses same packet as melee)
interface AttackPacket {
  type: "onAttackMob" | "onAttackPlayer";
  targetId: string;
  timestamp: number;
}
```

### 10.2 Server → Client Packets

```typescript
// Projectile launched (for visual rendering)
interface ProjectileLaunchedPacket {
  type: "projectileLaunched";
  attackerId: string;
  targetId: string;
  projectileType: "arrow" | "spell";
  sourcePosition: { x: number; y: number; z: number };
  targetPosition: { x: number; y: number; z: number };
  spellId?: string;  // For spell projectiles
  delayMs?: number;  // Visual delay before spawn
}

// Autocast spell changed
interface AutocastSetPacket {
  type: "autocastSet";
  playerId: string;
  spellId: string | null;
}

// Arrow consumed
interface ArrowConsumedPacket {
  type: "arrowConsumed";
  playerId: string;
  arrowId: string;
  remainingQuantity: number;
}

// Runes consumed
interface RunesConsumedPacket {
  type: "runesConsumed";
  playerId: string;
  consumed: Array<{ runeId: string; quantity: number }>;
}
```

### 10.3 Server Handlers

```typescript
// packages/server/src/systems/ServerNetwork/handlers/magic.ts

export function handleSetAutocast(
  socket: ServerSocket,
  data: unknown,
  world: World
): void {
  // 1. Validate spell ID format
  // 2. Validate timestamp (replay attack prevention)
  // 3. Verify spell exists via SpellService
  // 4. Emit PLAYER_SET_AUTOCAST event
}
```

**Security Measures:**
- Spell ID validation (lowercase letters and underscores only, max 50 chars)
- Timestamp validation (prevents replay attacks)
- Server-side spell existence verification
- Rate limiting (same as combat requests)

---

## Implementation Files

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `RangedDamageCalculator.ts` | ~200 | OSRS ranged damage formulas |
| `MagicDamageCalculator.ts` | ~250 | OSRS magic damage formulas |
| `AmmunitionService.ts` | ~150 | Arrow validation and consumption |
| `RuneService.ts` | ~180 | Rune validation and consumption |
| `SpellService.ts` | ~120 | Spell data and validation |
| `ProjectileService.ts` | ~200 | Projectile tracking |
| `ProjectileRenderer.ts` | ~400 | Client-side projectile visuals |
| `SpellsPanel.tsx` | ~800 | Spellbook UI component |
| `spell-visuals.ts` | ~280 | Spell visual configurations |
| `handlers/magic.ts` | ~95 | Server magic request handlers |

### Modified Files

| File | Changes |
|------|---------|
| `item-types.ts` | Uncommented RANGED and MAGIC in AttackType enum |
| `combat-types.ts` | Added RangedCombatStyle and MagicCombatStyle types |
| `event-types.ts` | Added projectile and spell events |
| `prayer-types.ts` | Added ranged/magic prayer bonuses |
| `WeaponStyleConfig.ts` | Added ranged/magic combat styles |
| `CombatSystem.ts` | Attack type routing logic |
| `ServerNetwork/index.ts` | Attack type detection, range calculation |
| `PendingAttackManager.ts` | Support for ranged/magic range checks |
| `tile-movement.ts` | Ranged/magic pathfinding (Chebyshev distance) |
| `EquipmentPanel.tsx` | Added ammo slot |
| `CombatPanel.tsx` | Added ranged/magic style icons |
| `PanelRegistry.tsx` | Registered SpellsPanel |
| `schema.ts` | Added magicLevel, magicXp, selectedSpell columns |
| `PlayerRepository.ts` | Save/load magic skill and autocast |
| `MobEntity.ts` | XP distribution for ranged/magic kills |

---

## Database Schema Changes

### Migration 0026: Add Magic Skill

```sql
-- Add magic level column (combat skill)
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "magicLevel" integer DEFAULT 1;

-- Add magic XP column
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "magicXp" integer DEFAULT 0;

-- Add selected spell column for autocast spell selection (null = no autocast)
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "selectedSpell" text;
```

---

## Testing

### Unit Tests

- ✅ RangedDamageCalculator: effective level formula
- ✅ RangedDamageCalculator: attack roll formula
- ✅ RangedDamageCalculator: max hit formula
- ✅ MagicDamageCalculator: player defense = 0.7 × magic + 0.3 × defense
- ✅ MagicDamageCalculator: NPC defense uses only magic level
- ✅ AmmunitionService: arrow validation and consumption
- ✅ RuneService: rune validation with elemental staff support
- ✅ SpellService: spell validation and level requirements
- ✅ ProjectileService: hit delay formulas

### Integration Tests

- ✅ Equip bow + arrows, attack mob, verify damage and consumption
- ✅ Equip staff, cast Fire Strike, verify rune consumption
- ✅ Equip staff of fire, cast Fire Strike, verify only mind runes consumed
- ✅ Run out of arrows → attack stops
- ✅ Run out of runes → spell fails
- ✅ Rapid style → attacks faster
- ✅ Longrange style → +2 range

---

## Future Enhancements

**Not in F2P Scope (Future Implementation):**
- Crossbows and bolts
- Enchanted bolts with special effects
- Thrown weapons (darts, knives, javelins)
- Ava's devices (arrow retrieval)
- Blast/Wave/Surge spell tiers
- Ancient Magicks, Lunar spells
- Powered staves (Trident, etc.)
- Magic damage % equipment bonuses
- Chinchompas (AoE ranged)
- Special attacks

---

*Document generated for Hyperscape Ranged/Magic Combat System v1.0*
