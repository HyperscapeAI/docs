# NPC Configuration Guide

This guide explains how to configure NPCs (Non-Player Characters) and mobs in Hyperscape using JSON manifests.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic NPC Structure](#basic-npc-structure)
3. [Combat Configuration](#combat-configuration)
4. [Attack Types](#attack-types)
5. [Visual Configuration](#visual-configuration)
6. [Complete Examples](#complete-examples)

---

## Overview

NPCs in Hyperscape are configured via JSON manifest files. All NPCs are data-driven—you can add new mobs, adjust stats, and configure behaviors without touching code.

**Manifest Location:** `packages/server/world/assets/manifests/npcs/`

---

## Basic NPC Structure

```json
{
  "id": "goblin",
  "name": "Goblin",
  "description": "A small, green creature",
  "category": "mob",
  "faction": "enemy",
  "stats": {
    "level": 2,
    "health": 5,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "ranged": 1,
    "magic": 1
  },
  "combat": { ... },
  "movement": { ... },
  "appearance": { ... },
  "drops": { ... },
  "position": { "x": 0, "y": 0, "z": 0 }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (used in code) |
| `name` | string | Display name |
| `category` | string | `"mob"`, `"npc"`, or `"boss"` |
| `stats` | object | Combat and skill levels |
| `combat` | object | Combat behavior configuration |
| `appearance` | object | Visual model and scale |

---

## Combat Configuration

### Combat Object Schema

```json
{
  "combat": {
    "attackable": true,
    "aggressive": true,
    "retaliates": true,
    "aggroRange": 5,
    "combatRange": 1,
    "leashRange": 15,
    "attackSpeedTicks": 4,
    "attackType": "melee",
    "spellId": "wind_strike",
    "arrowId": "bronze_arrow",
    "respawnTime": 30000,
    "xpReward": 20,
    "poisonous": false,
    "immuneToPoison": false
  }
}
```

### Combat Fields Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `attackable` | boolean | `true` | Can players attack this NPC? |
| `aggressive` | boolean | `false` | Auto-aggro nearby players? |
| `retaliates` | boolean | `true` | Fight back when attacked? |
| `aggroRange` | number | `4` | Detection range in tiles |
| `combatRange` | number | `1` | Maximum attack range in tiles |
| `leashRange` | number | `42` | Max distance from spawn before returning |
| `attackSpeedTicks` | number | `4` | Ticks between attacks (4 = 2.4s) |
| `attackType` | string | `"melee"` | `"melee"`, `"ranged"`, or `"magic"` |
| `spellId` | string | - | Required for magic mobs |
| `arrowId` | string | - | Required for ranged mobs |
| `respawnTime` | number | `30000` | Respawn delay in milliseconds |
| `xpReward` | number | `0` | XP awarded on kill |

---

## Attack Types

### Melee (Default)

Close-range combat with 1-2 tile range.

```json
{
  "combat": {
    "attackType": "melee",
    "combatRange": 1,
    "attackSpeedTicks": 4
  }
}
```

**Characteristics:**
- Range: 1 tile (standard) or 2 tiles (halberd)
- No projectile
- Instant hit (0 tick delay)
- Uses `attack` and `strength` stats

### Ranged

Bow and arrow combat with up to 10 tile range.

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

**Characteristics:**
- Range: Up to 10 tiles (configurable via `combatRange`)
- Arrow projectile visual
- Hit delay: `1 + floor((3 + distance) / 6)` ticks
- Uses `ranged` stat for damage
- Arrow type determines projectile visual

**Available Arrows:**
- `bronze_arrow` - Basic arrows
- `iron_arrow` - Improved damage
- `steel_arrow` - Higher damage
- `mithril_arrow` - Advanced damage
- `adamant_arrow` - High damage
- `rune_arrow` - Maximum damage

### Magic

Spell casting with up to 10 tile range.

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

**Characteristics:**
- Range: Up to 10 tiles (configurable via `combatRange`)
- Spell projectile visual (element-based)
- Hit delay: `1 + floor((1 + distance) / 3)` ticks
- Uses `magic` stat for damage
- Spell type determines projectile element

**Available Spells:**
- `wind_strike` - Air element (level 1)
- `water_strike` - Water element (level 5)
- `earth_strike` - Earth element (level 9)
- `fire_strike` - Fire element (level 13)
- `wind_bolt` - Air element (level 17)
- `water_bolt` - Water element (level 23)
- `earth_bolt` - Earth element (level 29)
- `fire_bolt` - Fire element (level 35)

---

## Visual Configuration

### Appearance Object Schema

```json
{
  "appearance": {
    "modelPath": "goblin/goblin_rigged.glb",
    "iconPath": "goblin/icon.png",
    "scale": 1.0,
    "tint": "#00ff00",
    "heldWeaponModel": "asset://weapons/bow_shortbow.glb"
  }
}
```

### Appearance Fields

| Field | Type | Description |
|-------|------|-------------|
| `modelPath` | string | Path to VRM/GLB model (relative to assets) |
| `iconPath` | string | Path to icon image |
| `scale` | number | Model scale multiplier (1.0 = normal) |
| `tint` | string | Hex color tint (optional) |
| `heldWeaponModel` | string | Weapon GLB to attach to hand bone |

### Held Weapon Models

The `heldWeaponModel` field attaches a weapon GLB to the mob's VRM hand bone:

**Format:** `"asset://weapons/weapon_name.glb"`

**Supported Weapons:**
- `asset://weapons/bow_shortbow.glb` - Shortbow
- `asset://weapons/bow_longbow.glb` - Longbow
- `asset://weapons/staff_basic.glb` - Basic staff
- `asset://weapons/staff_fire.glb` - Fire staff
- `asset://weapons/sword_bronze.glb` - Bronze sword
- `asset://weapons/sword_iron.glb` - Iron sword

**How It Works:**
1. Weapon GLB is loaded asynchronously
2. Cached by URL (shared across mobs of same type)
3. Cloned per mob instance
4. Attached to VRM `rightHand` bone (or bone specified in GLB metadata)
5. Cleaned up on mob destroy and world teardown

**Asset Forge Metadata:**
Weapons exported from Asset Forge include attachment metadata:
```json
{
  "hyperscape": {
    "vrmBoneName": "rightHand",
    "version": 2,
    "relativeMatrix": [1, 0, 0, 0, ...]
  }
}
```

---

## Complete Examples

### Example 1: Melee Mob (Goblin)

```json
{
  "id": "goblin",
  "name": "Goblin",
  "description": "A small, aggressive creature",
  "category": "mob",
  "faction": "enemy",
  "stats": {
    "level": 2,
    "health": 5,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "ranged": 1,
    "magic": 1
  },
  "combat": {
    "attackable": true,
    "aggressive": true,
    "retaliates": true,
    "aggroRange": 5,
    "combatRange": 1,
    "leashRange": 15,
    "attackSpeedTicks": 4,
    "attackType": "melee",
    "respawnTime": 30000,
    "xpReward": 5
  },
  "movement": {
    "type": "wander",
    "speed": 1,
    "wanderRadius": 3
  },
  "appearance": {
    "modelPath": "goblin/goblin_rigged.glb",
    "iconPath": "goblin/icon.png",
    "scale": 1.0
  },
  "drops": {
    "defaultDrop": {
      "itemId": "bones",
      "quantity": 1,
      "enabled": true
    },
    "always": [],
    "common": [
      { "itemId": "coins", "minQuantity": 1, "maxQuantity": 5, "chance": 0.5 }
    ]
  },
  "position": { "x": 10, "y": 0, "z": 10 }
}
```

### Example 2: Ranged Mob (Dark Ranger)

```json
{
  "id": "dark_ranger",
  "name": "Dark Ranger",
  "description": "A skilled archer",
  "category": "mob",
  "faction": "enemy",
  "stats": {
    "level": 12,
    "health": 22,
    "attack": 1,
    "strength": 1,
    "defense": 8,
    "ranged": 15,
    "magic": 1
  },
  "combat": {
    "attackable": true,
    "aggressive": true,
    "retaliates": true,
    "aggroRange": 6,
    "combatRange": 7,
    "leashRange": 20,
    "attackSpeedTicks": 4,
    "attackType": "ranged",
    "arrowId": "iron_arrow",
    "respawnTime": 45000,
    "xpReward": 35
  },
  "movement": {
    "type": "wander",
    "speed": 1,
    "wanderRadius": 5
  },
  "appearance": {
    "modelPath": "dark_ranger/dark_ranger.glb",
    "iconPath": "dark_ranger/icon.png",
    "scale": 1.0,
    "heldWeaponModel": "asset://weapons/bow_shortbow.glb"
  },
  "drops": {
    "defaultDrop": {
      "itemId": "bones",
      "quantity": 1,
      "enabled": true
    },
    "common": [
      { "itemId": "bronze_arrow", "minQuantity": 5, "maxQuantity": 15, "chance": 0.7 }
    ],
    "uncommon": [
      { "itemId": "iron_arrow", "minQuantity": 3, "maxQuantity": 8, "chance": 0.3 }
    ]
  },
  "position": { "x": 50, "y": 0, "z": 50 }
}
```

### Example 3: Magic Mob (Dark Wizard)

```json
{
  "id": "dark_wizard",
  "name": "Dark Wizard",
  "description": "A practitioner of dark magic",
  "category": "mob",
  "faction": "enemy",
  "stats": {
    "level": 7,
    "health": 9,
    "attack": 1,
    "strength": 1,
    "defense": 1,
    "ranged": 1,
    "magic": 8
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
  "movement": {
    "type": "wander",
    "speed": 1,
    "wanderRadius": 4
  },
  "appearance": {
    "modelPath": "dark_wizard/dark_wizard.glb",
    "iconPath": "dark_wizard/icon.png",
    "scale": 1.0,
    "heldWeaponModel": "asset://weapons/staff_basic.glb"
  },
  "drops": {
    "defaultDrop": {
      "itemId": "bones",
      "quantity": 1,
      "enabled": true
    },
    "common": [
      { "itemId": "air_rune", "minQuantity": 2, "maxQuantity": 6, "chance": 0.6 },
      { "itemId": "mind_rune", "minQuantity": 1, "maxQuantity": 3, "chance": 0.4 }
    ]
  },
  "position": { "x": 30, "y": 0, "z": 30 }
}
```

---

## Attack Type Configuration

### Melee Configuration

**Required Fields:**
- `attackType`: `"melee"`
- `combatRange`: `1` (standard) or `2` (halberd)

**Optional Fields:**
- `heldWeaponModel`: Visual weapon (sword, axe, etc.)

**Stats Used:**
- `attack`: Hit chance
- `strength`: Damage
- `defense`: Damage reduction

### Ranged Configuration

**Required Fields:**
- `attackType`: `"ranged"`
- `arrowId`: Arrow type (e.g., `"bronze_arrow"`)
- `combatRange`: Attack range in tiles (typically 7-10)

**Optional Fields:**
- `heldWeaponModel`: Bow model (e.g., `"asset://weapons/bow_shortbow.glb"`)

**Stats Used:**
- `ranged`: Hit chance and damage
- `defense`: Damage reduction

**Important Notes:**
- Mobs have infinite arrows (no consumption)
- Arrow type affects projectile visual and damage
- Recommended `combatRange`: 7 tiles
- Recommended `attackSpeedTicks`: 4 (2.4 seconds)

### Magic Configuration

**Required Fields:**
- `attackType`: `"magic"`
- `spellId`: Spell to cast (e.g., `"wind_strike"`)
- `combatRange`: Attack range in tiles (typically 10)

**Optional Fields:**
- `heldWeaponModel`: Staff model (e.g., `"asset://weapons/staff_basic.glb"`)

**Stats Used:**
- `magic`: Hit chance and damage
- `defense`: Damage reduction

**Important Notes:**
- Mobs have infinite runes (no consumption)
- Spell type determines projectile element (air, water, earth, fire)
- Recommended `combatRange`: 10 tiles
- Recommended `attackSpeedTicks`: 5 (3.0 seconds)

---

## Visual Configuration

### Model Path

```json
{
  "appearance": {
    "modelPath": "goblin/goblin_rigged.glb"
  }
}
```

**Requirements:**
- Must be a VRM-compatible GLB file
- Must have humanoid skeleton for animations
- Path is relative to assets directory

### Held Weapon Models

```json
{
  "appearance": {
    "heldWeaponModel": "asset://weapons/bow_shortbow.glb"
  }
}
```

**How Weapon Attachment Works:**

1. **Asset Protocol**: Use `asset://` prefix for all weapon paths
2. **Caching**: Weapons are cached by URL and shared across mobs
3. **Attachment**: Attached to VRM `rightHand` bone automatically
4. **Metadata**: Asset Forge exports include bone and transform data
5. **Cleanup**: Weapons are properly disposed on mob destroy

**Performance Optimization:**
- First mob loads weapon from network
- Subsequent mobs clone from cache (shared geometry)
- Concurrent loads deduplicated via promise cache
- Cache cleared on world teardown

### Scale and Tint

```json
{
  "appearance": {
    "scale": 1.5,
    "tint": "#ff0000"
  }
}
```

- `scale`: Multiplier for model size (1.0 = normal, 2.0 = double size)
- `tint`: Hex color overlay (optional)

---

## Troubleshooting

### Mob Not Attacking

**Check:**
1. `attackable: true` in combat config
2. `aggressive: true` or player attacked first
3. `combatRange` is appropriate for attack type
4. For ranged: `arrowId` is specified
5. For magic: `spellId` is specified

**Console Warnings:**
- `"Mob X has no spellId configured"` - Add `spellId` to combat config
- `"Mob X has no arrowId configured"` - Add `arrowId` to combat config

### Weapon Not Showing

**Check:**
1. `heldWeaponModel` uses `asset://` prefix
2. Weapon GLB file exists in assets directory
3. Weapon GLB has Asset Forge attachment metadata
4. VRM model has `rightHand` bone

**Debug:**
- Check browser console for GLTF load errors
- Verify weapon path: `asset://weapons/bow_shortbow.glb`
- Ensure CDN is running (`bun run cdn:up`)

### Wrong Projectile Visual

**For Ranged:**
- Verify `arrowId` matches an entry in ammunition data
- Check `packages/shared/src/data/ammunition.ts`

**For Magic:**
- Verify `spellId` matches an entry in spell data
- Check `packages/shared/src/data/combat-spells.ts`
- Spell element determines projectile color:
  - Air = cyan/white
  - Water = blue
  - Earth = brown/green
  - Fire = red/orange

---

## Best Practices

### Combat Balance

**Attack Speed Guidelines:**
- Fast mobs (3-4 ticks): Low damage, low HP
- Medium mobs (5 ticks): Balanced stats
- Slow mobs (6-7 ticks): High damage, high HP

**Range Guidelines:**
- Melee: `combatRange: 1` (standard) or `2` (large weapons)
- Ranged: `combatRange: 7` (typical) to `10` (maximum)
- Magic: `combatRange: 10` (standard for spells)

### Stat Recommendations

**Low-Level Mobs (1-10):**
```json
{
  "stats": {
    "level": 5,
    "health": 10,
    "attack": 3,
    "strength": 3,
    "defense": 2,
    "ranged": 3,
    "magic": 3
  }
}
```

**Mid-Level Mobs (11-30):**
```json
{
  "stats": {
    "level": 20,
    "health": 40,
    "attack": 15,
    "strength": 15,
    "defense": 12,
    "ranged": 15,
    "magic": 15
  }
}
```

**High-Level Mobs (31+):**
```json
{
  "stats": {
    "level": 50,
    "health": 100,
    "attack": 40,
    "strength": 40,
    "defense": 35,
    "ranged": 40,
    "magic": 40
  }
}
```

---

*NPC Configuration Guide for Hyperscape v3.0*
