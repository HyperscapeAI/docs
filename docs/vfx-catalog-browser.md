# VFX Catalog Browser (Asset Forge)

## Overview

The VFX Catalog Browser is a new feature in Asset Forge that provides a comprehensive visual reference for all game visual effects. It includes live Three.js previews, detailed parameter breakdowns, and technical specifications for every effect in the game.

## Accessing the VFX Browser

**URL**: `http://localhost:3400/vfx` (when running `bun run dev:forge`)

**Navigation**: Click the **Sparkles** icon in the Asset Forge sidebar

## Features

### Live Effect Previews

All effects render in real-time using Three.js with accurate game shaders:

- **Spell Projectiles**: Orbiting spell orbs with trails and pulsing
- **Arrow Projectiles**: Rotating 3D arrows with metallic materials
- **Glow Particles**: Instanced billboard particles (altar, fire, torch)
- **Fishing Spots**: Water splashes, bubbles, shimmer, and ripple rings
- **Teleport Effect**: Full multi-phase sequence (gather, erupt, sustain, fade)
- **Combat HUD**: Canvas-rendered damage splats and XP drops

### Effect Categories

**Magic Spells** (8 effects)
- Wind Strike, Water Strike, Earth Strike, Fire Strike
- Wind Bolt, Water Bolt, Earth Bolt, Fire Bolt
- Displays: outer/core colors, size, glow intensity, trail parameters

**Arrow Projectiles** (6 effects)
- Default, Bronze, Iron, Steel, Mithril, Adamant
- Displays: shaft/head/fletching colors, length, width, arc height

**Glow Particles** (3 presets)
- Altar (30 particles: pillar, wisp, spark, base layers)
- Fire (18 particles: rising with spread)
- Torch (6 particles: tighter spread, faster speed)
- Displays: layer breakdown, particle counts, lifetimes, blend modes

**Fishing Spots** (3 types)
- Net Fishing, Fly Fishing, Default Fishing
- Displays: base/splash/bubble/shimmer colors, ripple speed, burst intervals

**Teleport** (1 effect)
- Multi-phase sequence: gather → erupt → sustain → fade
- Displays: phase timeline, component breakdown, duration parameters

**Combat HUD** (2 effects)
- Damage Splats (hit/miss variants)
- XP Drops (cubic ease-out animation)
- Displays: colors, durations, canvas sizes, fonts

## Detail Panels

Each effect shows:

### Colors
Color swatches with hex values for all effect colors:
```
Core:    #c4b5fd
Mid:     #8b5cf6
Outer:   #60a5fa
```

### Parameters
Technical specifications table:
```
Size:              0.35
Glow Intensity:    0.45
Trail Length:      3
Pulse Speed:       0
```

### Layers (Glow Effects)
Expandable layer cards showing:
- Pool name and particle count
- Lifetime range
- Scale range
- Sharpness value
- Behavior notes

### Phase Timeline (Teleport)
Visual timeline showing phase progression:
```
[Gather: 0-0.5s] [Erupt: 0.5-0.85s] [Sustain: 0.85-1.7s] [Fade: 1.7-2.5s]
```

### Components (Teleport)
Detailed breakdown of all visual components:
- Ground Rune Circle
- Base Glow Disc
- Inner/Outer Beams
- Core Flash
- Shockwave Rings
- Point Light
- Helix Particles (12)
- Burst Particles (8)

### Variants (Combat HUD)
Color schemes for different states:
- Hit (damage > 0): Red background, white text
- Miss (damage = 0): Blue background, white text

## Technical Implementation

### Data Source

Effect metadata is duplicated in `packages/asset-forge/src/data/vfx-catalog.ts` as plain objects. This avoids importing from `packages/shared` (which would pull in the full game engine).

**Source-of-truth files:**
- `packages/shared/src/data/spell-visuals.ts` - Spell projectile configs
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` - Glow particle presets
- `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts` - Water particle configs
- `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts` - Teleport effect implementation
- `packages/shared/src/systems/client/DamageSplatSystem.ts` - Damage splat rendering
- `packages/shared/src/systems/client/XPDropSystem.ts` - XP drop rendering

### Preview Rendering

**Spell Orbs:**
- Billboarded glow layers (outer + core)
- Trail particles with ring buffer
- Orbiting sparks (bolt-tier only)
- Point light for scene illumination

**Arrows:**
- Cylinder shaft with cone head
- Metallic material with roughness
- Fletching fins (3 planes)
- Rotation animation

**Glow Particles:**
- Instanced billboard particles
- Per-instance color attributes
- Camera-facing billboards
- Procedural motion (pillar sway, wisp orbit, spark rise, base orbit, fire rise/spread)

**Water Particles:**
- Splash arcs (parabolic motion)
- Bubble rise (wobble motion)
- Shimmer twinkle (double sine)
- Ripple rings (expanding circles)

**Teleport:**
- Rune circle (canvas texture with procedural glyphs)
- Dual beams (Hermite elastic curve)
- Shockwave rings (easeOutExpo expansion)
- Helix spiral particles (2 strands × 6)
- Burst particles (gravity simulation)
- Point light (dynamic intensity)

**Combat HUD:**
- Canvas-rendered sprites
- Rounded rectangle backgrounds
- Bold text rendering
- Animation descriptions

## Use Cases

### For Developers

**Reference Implementation:**
- See exact parameter values used in game
- Understand multi-layer particle systems
- Learn TSL shader patterns
- Debug visual effect issues

**Adding New Effects:**
1. Implement effect in game code
2. Add metadata to `vfx-catalog.ts`
3. Add preview component to `VFXPreview.tsx`
4. Test in VFX browser before committing

### For Designers

**Visual Tuning:**
- Compare effect variations side-by-side
- Identify color palette inconsistencies
- Verify timing and duration parameters
- Plan new effect designs

**Documentation:**
- Generate effect specifications for wiki
- Create visual style guides
- Document effect parameters for modders

### For QA

**Visual Regression Testing:**
- Verify effects match specifications
- Compare before/after visual changes
- Identify rendering bugs
- Test effect performance

## Adding New Effects

### Step 1: Add Metadata

Add effect definition to `packages/asset-forge/src/data/vfx-catalog.ts`:

```typescript
export const NEW_EFFECT: MyEffectType = {
  id: 'my_effect',
  name: 'My Effect',
  category: 'spells',
  previewType: 'spell',
  color: 0xff00ff,
  // ... other properties
  colors: [
    { label: 'Primary', hex: '#ff00ff' },
    { label: 'Secondary', hex: '#00ffff' }
  ],
  params: [
    { label: 'Duration', value: '2.0s' },
    { label: 'Intensity', value: 1.5 }
  ]
};

// Add to category
export const VFX_CATEGORIES: EffectCategoryInfo[] = [
  // ...
  { id: 'spells', label: 'Magic Spells', effects: [...SPELL_EFFECTS, NEW_EFFECT] }
];
```

### Step 2: Add Preview Component

Add rendering logic to `packages/asset-forge/src/components/VFX/VFXPreview.tsx`:

```typescript
const MyEffectPreview: React.FC<{ effect: MyEffectType }> = ({ effect }) => {
  // Implement Three.js preview
  return (
    <mesh>
      <sphereGeometry args={[effect.size, 16, 16]} />
      <meshBasicMaterial color={effect.color} />
    </mesh>
  );
};

// Add to main component
export const VFXPreview: React.FC<{ effect: VFXEffect }> = ({ effect }) => {
  if (isMyEffect(effect)) {
    return (
      <Canvas>
        <PreviewScene>
          <MyEffectPreview effect={effect} />
        </PreviewScene>
      </Canvas>
    );
  }
  // ...
};
```

### Step 3: Test

1. Run Asset Forge: `bun run dev:forge`
2. Navigate to VFX page
3. Select your effect from sidebar
4. Verify preview renders correctly
5. Check all detail panels display properly

## Keyboard Shortcuts

- **Arrow Keys**: Navigate between effects
- **Escape**: Deselect current effect
- **Space**: Toggle preview animation (if applicable)

## Browser Compatibility

**Supported:**
- Chrome 90+
- Firefox 88+
- Safari 15+
- Edge 90+

**Requirements:**
- WebGL 2.0 support
- ES2020 JavaScript features
- Canvas 2D API

## Performance

**Preview Rendering:**
- 60 FPS target for all effects
- Instanced rendering for particle systems
- Shared geometries and materials
- Automatic LOD for complex effects

**Memory Usage:**
- ~50-100 MB for all effect previews
- Textures cached and reused
- Geometries shared across instances
- Materials compiled once

## Known Limitations

**Static Previews:**
- Combat HUD effects use canvas screenshots (not animated)
- Some effects simplified for preview performance
- Particle counts may differ from in-game

**Timing:**
- Preview loops continuously (in-game effects are one-shot)
- Phase timings are accurate but loop for demonstration

## Troubleshooting

**Preview not rendering:**
- Check browser console for WebGL errors
- Verify Three.js loaded correctly
- Try refreshing the page
- Check GPU drivers are up to date

**Wrong colors:**
- Verify hex values in `vfx-catalog.ts` match game code
- Check color space (sRGB vs Linear)
- Inspect material properties in browser devtools

**Performance issues:**
- Reduce particle counts in preview
- Disable shadows in preview scene
- Use lower-poly geometries
- Check GPU utilization

## Related Documentation

- [Asset Forge README](../packages/asset-forge/README.md) - Asset Forge overview
- [GlowParticleManager.ts](../packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts) - Particle system implementation
- [ClientTeleportEffectsSystem.ts](../packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts) - Teleport VFX implementation
- [spell-visuals.ts](../packages/shared/src/data/spell-visuals.ts) - Spell visual configurations
