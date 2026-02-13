# Migration Guide: v2.x to v3.0

This guide helps you migrate to Hyperscape v3.0, which introduces mob magic and ranged attacks.

---

## Overview

**Version 3.0** adds support for mob projectile attacks (magic and ranged). All changes are **backward compatible**—existing mobs continue to work without modification.

---

## What's New

### Mob Attack Types

Mobs can now use three attack types:
- **Melee** (default) - Close-range combat
- **Ranged** (new) - Bow and arrow attacks
- **Magic** (new) - Spell casting

### New NPC Configuration Fields

```typescript
interface NPCCombatConfig {
  // Existing fields (unchanged)
  attackable: boolean;
  aggressive: boolean;
  combatRange: number;
  attackSpeedTicks: number;
  
  // NEW in v3.0
  attackType?: "melee" | "ranged" | "magic";  // Default: "melee"
  spellId?: string;   // Required for magic mobs
  arrowId?: string;   // Required for ranged mobs
}

interface NPCAppearanceConfig {
  // Existing fields (unchanged)
  modelPath: string;
  scale: number;
  
  // NEW in v3.0
  heldWeaponModel?: string;  // Visual weapon GLB
}
```

---

## Breaking Changes

**None.** All changes are backward compatible.

---

## Deprecations

**None.** All existing APIs remain unchanged.

---

## Migration Steps

### Step 1: Update Dependencies

```bash
cd hyperscape
git pull origin main
bun install
bun run build
```

### Step 2: Review Existing Mobs (Optional)

All existing mobs default to `attackType: "melee"` and continue to work without changes.

**No action required** unless you want to convert mobs to ranged/magic.

### Step 3: Add Ranged/Magic Mobs (Optional)

To convert an existing mob to ranged or magic:

**Before (v2.x):**
```json
{
  "id": "dark_wizard",
  "combat": {
    "attackable": true,
    "aggressive": true,
    "combatRange": 1,
    "attackSpeedTicks": 4
  }
}
```

**After (v3.0) - Magic:**
```json
{
  "id": "dark_wizard",
  "combat": {
    "attackable": true,
    "aggressive": true,
    "combatRange": 10,
    "attackSpeedTicks": 5,
    "attackType": "magic",
    "spellId": "wind_strike"
  },
  "appearance": {
    "heldWeaponModel": "asset://weapons/staff_basic.glb"
  }
}
```

**After (v3.0) - Ranged:**
```json
{
  "id": "dark_ranger",
  "combat": {
    "attackable": true,
    "aggressive": true,
    "combatRange": 7,
    "attackSpeedTicks": 4,
    "attackType": "ranged",
    "arrowId": "bronze_arrow"
  },
  "appearance": {
    "heldWeaponModel": "asset://weapons/bow_shortbow.glb"
  }
}
```

### Step 4: Test Your Changes

```bash
# Start the game
bun run dev

# Test in-game:
# 1. Spawn your modified mob
# 2. Verify it attacks with correct animation
# 3. Verify projectile appears (for ranged/magic)
# 4. Verify held weapon shows (if configured)
```

---

## API Changes

### New Functions

#### prepareMobAttack()

Shared utility for mob projectile attack validation.

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

**Use Case:** Called by `MagicAttackHandler` and `RangedAttackHandler` to validate mob attacks.

#### getMobAttackType()

Type guard for safely reading mob attack type.

```typescript
// packages/shared/src/utils/typeGuards.ts

function getMobAttackType(
  entity: unknown
): "melee" | "ranged" | "magic" | undefined;
```

**Use Case:** Resolving mob attack type for retaliation and auto-attacks.

### Modified Functions

#### MagicAttackHandler.handle()

Now supports mob attackers:

```typescript
// Before (v2.x)
async handle(data: {
  attackerId: string;  // Players only
  targetId: string;
  attackerType: "player";
  targetType: "player" | "mob";
}): Promise<void>;

// After (v3.0)
async handle(data: {
  attackerId: string;  // Players AND mobs
  targetId: string;
  attackerType: "player" | "mob";  // ← Changed
  targetType: "player" | "mob";
  spellId?: string;  // ← New: event-carried spell
}): Promise<void>;
```

#### RangedAttackHandler.handle()

Now supports mob attackers:

```typescript
// Before (v2.x)
handle(data: {
  attackerId: string;  // Players only
  targetId: string;
  attackerType: "player";
  targetType: "player" | "mob";
}): void;

// After (v3.0)
handle(data: {
  attackerId: string;  // Players AND mobs
  targetId: string;
  attackerType: "player" | "mob";  // ← Changed
  targetType: "player" | "mob";
  arrowId?: string;  // ← New: event-carried arrow
}): void;
```

#### CombatSystem.handleAttack()

Now requires `attackType` parameter:

```typescript
// Before (v2.x)
async handleAttack(data: {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType?: AttackType;  // Optional
}): Promise<void>;

// After (v3.0)
async handleAttack(data: {
  attackerId: string;
  targetId: string;
  attackerType: "player" | "mob";
  targetType: "player" | "mob";
  attackType: AttackType;  // ← Now required
}): Promise<void>;
```

**Migration:** All callers must provide `attackType`. The `CombatTickProcessor` automatically resolves this from combat state.

---

## Event Changes

### COMBAT_MOB_NPC_ATTACK

**Added Fields:**
```typescript
{
  attackType?: "melee" | "ranged" | "magic";  // NEW
  spellId?: string;   // NEW: for magic attacks
  arrowId?: string;   // NEW: for ranged attacks
}
```

**Removed Fields:**
```typescript
{
  damage: number;  // REMOVED: handlers calculate damage
}
```

**Reason:** Damage is now calculated by attack handlers using NPC stats, not passed in events.

### COMBAT_PROJECTILE_LAUNCHED

**Added Fields:**
```typescript
{
  arrowId?: string;         // NEW: arrow type for visuals
  travelDurationMs: number; // NEW: projectile travel time
}
```

---

## Configuration Changes

### Combat Constants

**New Constants:**
```typescript
export const COMBAT_CONSTANTS = {
  MAGIC_RANGE: 10,              // NEW
  SPELL_LAUNCH_DELAY_MS: 600,   // NEW
  ARROW_LAUNCH_DELAY_MS: 400,   // NEW
};
```

**Existing Constants (Unchanged):**
```typescript
export const COMBAT_CONSTANTS = {
  RANGED_RANGE: 10,
  MELEE_RANGE_STANDARD: 1,
  MELEE_RANGE_HALBERD: 2,
  DEFAULT_ATTACK_SPEED_TICKS: 4,
  TICK_DURATION_MS: 600,
};
```

---

## Code Examples

### Creating a Magic Mob

```json
{
  "id": "fire_mage",
  "name": "Fire Mage",
  "stats": {
    "level": 15,
    "health": 25,
    "magic": 20
  },
  "combat": {
    "attackType": "magic",
    "spellId": "fire_strike",
    "combatRange": 10,
    "attackSpeedTicks": 5
  },
  "appearance": {
    "modelPath": "fire_mage/fire_mage.glb",
    "heldWeaponModel": "asset://weapons/staff_fire.glb"
  }
}
```

### Creating a Ranged Mob

```json
{
  "id": "archer",
  "name": "Archer",
  "stats": {
    "level": 12,
    "health": 20,
    "ranged": 18
  },
  "combat": {
    "attackType": "ranged",
    "arrowId": "iron_arrow",
    "combatRange": 7,
    "attackSpeedTicks": 4
  },
  "appearance": {
    "modelPath": "archer/archer.glb",
    "heldWeaponModel": "asset://weapons/bow_longbow.glb"
  }
}
```

### Handling Mob Attacks in Custom Code

```typescript
// Listen to mob attack events
world.on(EventType.COMBAT_MOB_NPC_ATTACK, (data) => {
  console.log(`Mob ${data.mobId} attacked ${data.targetId}`);
  console.log(`Attack type: ${data.attackType ?? "melee"}`);
  
  if (data.attackType === "magic") {
    console.log(`Spell: ${data.spellId}`);
  } else if (data.attackType === "ranged") {
    console.log(`Arrow: ${data.arrowId}`);
  }
});

// Listen to projectile launches
world.on(EventType.COMBAT_PROJECTILE_LAUNCHED, (data) => {
  console.log(`Projectile: ${data.projectileType}`);
  console.log(`Travel time: ${data.travelDurationMs}ms`);
  console.log(`Launch delay: ${data.delayMs}ms`);
});
```

---

## Performance Notes

### Weapon Model Caching

Weapon GLB models are cached statically and shared across all mobs:

```typescript
// First mob of type loads weapon
const mob1 = new MobEntity({ heldWeaponModel: "asset://weapons/bow.glb" });
// → Loads bow.glb from network, caches it

// Second mob of same type reuses cache
const mob2 = new MobEntity({ heldWeaponModel: "asset://weapons/bow.glb" });
// → Clones from cache (no network request)
```

**Benefits:**
- Reduces network requests
- Shares geometry/material buffers
- Concurrent loads deduplicated

**Cleanup:**
- Cache cleared on world teardown
- Individual mobs only remove from scene graph (no disposal)

### Pre-Allocated Damage Params

Attack handlers reuse pre-allocated parameter objects:

```typescript
class MagicAttackHandler {
  // Shared between player and mob paths
  private readonly _magicParams: MagicDamageParams = { ... };
}
```

**Safety Invariant:**
- Tick loop is single-threaded
- Mob paths are synchronous
- Player paths claim cooldown before any `await`

**⚠️ Do NOT** add `await` between params mutation and damage calculation.

---

## Troubleshooting

### Mob Not Using Ranged/Magic

**Symptoms:**
- Mob uses melee animation instead of ranged/magic
- No projectile appears

**Fixes:**
1. Verify `attackType` is set in NPC combat config
2. For magic: Verify `spellId` is specified
3. For ranged: Verify `arrowId` is specified
4. Check console for warnings:
   - `"Mob X has no spellId configured"`
   - `"Mob X has no arrowId configured"`

### Weapon Not Showing on Mob

**Symptoms:**
- Mob attacks correctly but no weapon visible

**Fixes:**
1. Verify `heldWeaponModel` uses `asset://` prefix
2. Verify weapon GLB exists in assets directory
3. Check browser console for GLTF load errors
4. Ensure CDN is running (`bun run cdn:up`)

### Wrong Projectile Visual

**Symptoms:**
- Projectile appears but wrong color/type

**Fixes:**
1. For magic: Verify `spellId` matches spell data
   - Check `packages/shared/src/data/combat-spells.ts`
2. For ranged: Verify `arrowId` matches ammunition data
   - Check `packages/shared/src/data/ammunition.ts`

---

## Rollback Instructions

If you need to rollback to v2.x:

```bash
# Checkout previous version
git checkout v2.0.0

# Rebuild
bun install
bun run build

# Reset database (if schema changed)
docker stop hyperscape-postgres
docker rm hyperscape-postgres
docker volume rm hyperscape-postgres-data

# Restart
bun run dev
```

**Note:** Rolling back will disable mob ranged/magic attacks. Existing NPC manifests with `attackType: "ranged"` or `attackType: "magic"` will fall back to melee.

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/HyperscapeAI/hyperscape/issues
- Discord: https://discord.gg/hyperscape

---

*Migration Guide for Hyperscape v3.0*
