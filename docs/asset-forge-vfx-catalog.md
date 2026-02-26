# Asset Forge VFX Catalog

Asset Forge now includes a VFX (Visual Effects) catalog browser for previewing and inspecting all game effects.

## Overview

The VFX catalog provides:
- **Live Three.js previews** of all game effects
- **Detailed parameter inspection** (colors, timings, layers)
- **Phase timeline visualization** for multi-stage effects
- **Searchable catalog** of all VFX types

## Accessing the VFX Catalog

```bash
# Start Asset Forge
bun run dev:forge

# Navigate to VFX tab in the UI
# Or visit: http://localhost:3400/#/vfx
```

## Available Effects

### Combat Effects

| Effect | Type | Description |
|--------|------|-------------|
| **Melee Hit** | Impact | Slash/stab impact particles |
| **Ranged Hit** | Impact | Arrow/bolt impact |
| **Magic Hit** | Impact | Spell impact with elemental colors |
| **Block** | Defensive | Shield block effect |
| **Miss** | Feedback | Attack miss indicator |

### Spell Effects

| Spell | Colors | Phases |
|-------|--------|--------|
| **Fire Blast** | Red/Orange | Cast → Travel → Impact |
| **Water Blast** | Blue/Cyan | Cast → Travel → Impact |
| **Earth Blast** | Brown/Green | Cast → Travel → Impact |
| **Air Blast** | White/Gray | Cast → Travel → Impact |

### Projectiles

| Projectile | Type | Trail |
|------------|------|-------|
| **Arrow** | Physical | Motion blur |
| **Bolt** | Physical | Motion blur |
| **Magic Projectile** | Magical | Particle trail |

### Environmental Effects

| Effect | Type | Description |
|--------|------|-------------|
| **Fishing Splash** | Water | Fishing spot particles |
| **Glow Particles** | Ambient | Resource node highlights |
| **Teleport** | Transition | Beam + ring + particles |

### UI Effects

| Effect | Type | Description |
|--------|------|-------------|
| **Damage Splat** | Combat HUD | Floating damage numbers |
| **XP Drop** | Skill HUD | Floating XP gains |
| **Level Up** | Notification | Level up celebration |

## Catalog Features

### Effect Preview

Each effect shows:
- **Live 3D preview** with looping animation
- **Camera controls** (orbit, zoom, pan)
- **Playback controls** (play, pause, restart)
- **Background options** (dark, light, transparent)

### Detail Panel

Inspect effect parameters:

**Colors:**
```typescript
{
  primary: "#ff6600",
  secondary: "#ffaa00",
  accent: "#ffffff"
}
```

**Timing:**
```typescript
{
  duration: 1000,      // Total effect duration (ms)
  fadeIn: 100,         // Fade in time (ms)
  fadeOut: 200,        // Fade out time (ms)
  delay: 0             // Start delay (ms)
}
```

**Layers:**
```typescript
{
  particles: true,     // Particle system enabled
  geometry: true,      // Mesh geometry enabled
  lights: false,       // Dynamic lights enabled
  sound: true          // Audio enabled
}
```

### Phase Timeline

Multi-stage effects show phase breakdown:

**Teleport Effect:**
1. **Charge** (0-500ms) - Beam appears, ring expands
2. **Peak** (500-700ms) - Full intensity
3. **Fade** (700-1000ms) - Beam fades, particles dissipate

**Spell Cast:**
1. **Windup** (0-300ms) - Casting animation
2. **Release** (300-400ms) - Projectile spawns
3. **Travel** (400-1200ms) - Projectile moves to target
4. **Impact** (1200-1500ms) - Hit effect and damage

## Using VFX in Code

### Import Effect

```typescript
import { createTeleportEffect } from '@hyperscape/shared/entities/managers/particleManager';
```

### Spawn Effect

```typescript
// Teleport effect
const effect = createTeleportEffect(world, {
  position: new Vector3(0, 0, 0),
  color: 0x00ffff,
  suppressEffect: false  // Set true to skip visual
});

// Spell effect
const spell = createSpellEffect(world, {
  type: 'fire_blast',
  caster: playerEntity,
  target: mobEntity,
  damage: 15
});
```

### Effect Parameters

All effects support common parameters:

```typescript
interface VFXOptions {
  position: Vector3;           // World position
  color?: number;              // Primary color (hex)
  scale?: number;              // Size multiplier
  duration?: number;           // Override default duration
  suppressEffect?: boolean;    // Skip visual (for network sync)
}
```

## Recent Changes (February 2026)

### Teleport VFX Improvements

- **Beam base fade** - Prevents clipping through floor
- **Scaled geometry** - Fits avatar size better
- **Duplicate suppression** - Fixed race condition causing 3 teleport effects
- **suppressEffect forwarding** - Network sync for mid-fight corrections

### Duel Victory Emote

- **Delayed emote** - 600ms delay so combat cleanup doesn't override wave
- **Idle reset** - Emote stops when agents teleport out

### Arena Fire Particles

- **Instanced meshes** - 97% reduction in draw calls (~846 meshes → InstancedMesh)
- **TSL fire material** - GPU-driven emissive brazier material
- **Removed dynamic lights** - All 28 PointLights replaced with emissive materials
- **Enhanced fire shader** - Smooth value noise, soft radial falloff, turbulent motion

## VFX Performance

### Particle Budgets

| Effect Type | Max Particles | Lifetime |
|-------------|---------------|----------|
| Combat | 50 | 1s |
| Spell | 100 | 2s |
| Environmental | 200 | 5s |
| Ambient | 500 | 10s |

### Optimization Tips

1. **Use instanced rendering** for repeated effects
2. **Limit particle count** - More particles = lower FPS
3. **Use emissive materials** instead of dynamic lights
4. **Batch similar effects** - Combine into single particle system
5. **Cull off-screen effects** - Don't render what players can't see

## Creating Custom VFX

### 1. Define Effect Parameters

```typescript
// packages/shared/src/types/rendering/particles.ts
export interface MyEffectParams {
  color: number;
  intensity: number;
  duration: number;
}
```

### 2. Create Effect Factory

```typescript
// packages/shared/src/entities/managers/particleManager/MyEffect.ts
export function createMyEffect(
  world: World,
  options: MyEffectParams
): ParticleSystem {
  const particles = new ParticleSystem({
    maxParticles: 100,
    lifetime: options.duration,
    // ... particle configuration
  });
  
  return particles;
}
```

### 3. Add to Catalog

```typescript
// packages/asset-forge/src/data/vfx-catalog.ts
export const VFX_CATALOG = [
  // ... existing effects
  {
    id: 'my-effect',
    name: 'My Effect',
    category: 'custom',
    factory: createMyEffect,
    defaultParams: {
      color: 0xff00ff,
      intensity: 1.0,
      duration: 1000
    }
  }
];
```

### 4. Test in Catalog

1. Start Asset Forge: `bun run dev:forge`
2. Navigate to VFX tab
3. Find your effect in the catalog
4. Preview and adjust parameters

## Related Documentation

- [packages/shared/src/entities/managers/particleManager/](../packages/shared/src/entities/managers/particleManager/) - Particle system implementation
- [packages/asset-forge/src/components/VFX/](../packages/asset-forge/src/components/VFX/) - VFX catalog UI
- [packages/asset-forge/src/data/vfx-catalog.ts](../packages/asset-forge/src/data/vfx-catalog.ts) - Effect definitions
