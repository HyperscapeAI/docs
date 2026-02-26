# Asset Forge VFX Catalog

The VFX Catalog is a browser-based tool in Asset Forge for previewing and documenting all visual effects used in Hyperscape.

## Overview

The VFX Catalog provides:
- **Live previews** of all game effects using Three.js
- **Detailed specifications** for each effect (colors, parameters, layers)
- **Phase timelines** showing effect progression over time
- **Interactive controls** for testing and iteration

## Accessing the Catalog

### Start Asset Forge

```bash
# From repository root
bun run dev:forge
```

This starts:
- **UI**: http://localhost:3400
- **API**: http://localhost:3401

### Navigate to VFX Tab

1. Open http://localhost:3400
2. Click the **VFX** tab in the navigation bar
3. Browse effects in the sidebar catalog

## Effect Categories

### Combat Effects

**Spells**:
- Fire Blast
- Ice Barrage
- Wind Strike
- Earth Bind

**Projectiles**:
- Arrow (ranged combat)
- Magic projectile trails
- Impact effects

**Combat HUD**:
- Damage splats (red numbers)
- XP drops (floating text)
- Health bar animations

### World Effects

**Teleportation**:
- Teleport beam (vertical cylinder)
- Particle swirl
- Flash effect
- Sound cue

**Fishing**:
- Water ripples
- Splash particles
- Bobber animation

**Firemaking**:
- Fire particles (TSL emissive)
- Smoke trails
- Ember glow

### UI Effects

**Glow Particles**:
- Item highlights
- Quest markers
- Interaction indicators

**Level Up**:
- Fireworks burst
- Skill icon glow
- XP orb fill animation

## Effect Details

### Viewing Effect Details

Click any effect in the sidebar to view:

**Preview Panel**:
- Live Three.js scene with effect
- Orbit controls (drag to rotate)
- Auto-rotation toggle
- Reset camera button

**Detail Panel**:
- **Colors**: Primary, secondary, accent colors with hex codes
- **Parameters**: Duration, intensity, scale, speed
- **Layers**: Particle systems, meshes, lights
- **Phase Timeline**: Effect progression over time

### Example: Teleport Effect

**Colors**:
- Primary: `#4a90e2` (blue)
- Secondary: `#ffffff` (white)
- Accent: `#00ffff` (cyan)

**Parameters**:
- Duration: 2000ms
- Beam height: 10 units
- Particle count: 100
- Rotation speed: 2 rad/s

**Layers**:
1. Beam cylinder (vertical)
2. Particle swirl (spiral motion)
3. Flash sphere (fade in/out)
4. Ground ring (expanding)

**Phase Timeline**:
- 0-500ms: Beam fade in, particles spawn
- 500-1500ms: Full effect, particles swirl
- 1500-2000ms: Beam fade out, particles despawn

## Using the Catalog

### For Designers

**Document new effects**:
1. Create effect in code
2. Add to `packages/asset-forge/src/data/vfx-catalog.ts`
3. Preview in catalog
4. Document colors, parameters, phases

**Iterate on effects**:
1. View effect in catalog
2. Note parameters to adjust
3. Edit code
4. Refresh catalog to see changes

### For Developers

**Reference implementation**:
1. Browse catalog for similar effect
2. View detail panel for parameters
3. Copy implementation pattern
4. Adjust colors/parameters for new effect

**Debug effects**:
1. Preview effect in isolation
2. Check phase timeline for timing issues
3. Verify colors match design
4. Test with different parameters

## Effect Data Structure

### Catalog Entry

```typescript
interface VFXCatalogEntry {
  id: string;
  name: string;
  category: 'combat' | 'world' | 'ui';
  description: string;
  colors: {
    primary: string;    // Hex color
    secondary?: string;
    accent?: string;
  };
  parameters: {
    duration?: number;  // Milliseconds
    intensity?: number; // 0-1
    scale?: number;     // Multiplier
    speed?: number;     // Units per second
    [key: string]: any;
  };
  layers: Array<{
    type: 'particles' | 'mesh' | 'light';
    name: string;
    config: any;
  }>;
  phases?: Array<{
    time: number;       // Milliseconds
    description: string;
  }>;
}
```

### Example Entry

```typescript
{
  id: 'teleport',
  name: 'Teleport Effect',
  category: 'world',
  description: 'Vertical beam with particle swirl for player teleportation',
  colors: {
    primary: '#4a90e2',
    secondary: '#ffffff',
    accent: '#00ffff'
  },
  parameters: {
    duration: 2000,
    beamHeight: 10,
    particleCount: 100,
    rotationSpeed: 2
  },
  layers: [
    {
      type: 'mesh',
      name: 'Beam Cylinder',
      config: { height: 10, radius: 0.5, opacity: 0.7 }
    },
    {
      type: 'particles',
      name: 'Swirl Particles',
      config: { count: 100, lifetime: 2000, spiralRadius: 1.5 }
    }
  ],
  phases: [
    { time: 0, description: 'Beam fade in, particles spawn' },
    { time: 500, description: 'Full effect, particles swirl' },
    { time: 1500, description: 'Beam fade out, particles despawn' }
  ]
}
```

## Adding New Effects

### 1. Create Effect Implementation

```typescript
// packages/shared/src/systems/shared/presentation/Particles.ts
export function createMyEffect(scene: Scene, position: Vector3) {
  // Create effect geometry, materials, particles
  // Return cleanup function
}
```

### 2. Add to Catalog

```typescript
// packages/asset-forge/src/data/vfx-catalog.ts
export const vfxCatalog: VFXCatalogEntry[] = [
  // ... existing effects
  {
    id: 'my-effect',
    name: 'My Effect',
    category: 'combat',
    description: 'Description of my effect',
    colors: {
      primary: '#ff0000',
      secondary: '#00ff00'
    },
    parameters: {
      duration: 1000,
      intensity: 0.8
    },
    layers: [
      {
        type: 'particles',
        name: 'Main Particles',
        config: { count: 50 }
      }
    ]
  }
];
```

### 3. Create Preview Component

```typescript
// packages/asset-forge/src/components/VFX/VFXPreview.tsx
// Add case for your effect
case 'my-effect':
  return <MyEffectPreview effect={effect} />;
```

### 4. Test in Catalog

1. Start Asset Forge: `bun run dev:forge`
2. Navigate to VFX tab
3. Find your effect in sidebar
4. Verify preview and details

## Recent Changes (February 2026)

### New VFX Catalog Tab

**Commit**: `69105229` (feat(asset-forge): add VFX catalog browser tab)

**Features**:
- Sidebar catalog of all game effects
- Live Three.js previews
- Detail panels for colors, parameters, layers
- Phase timelines

**Effects cataloged**:
- Spells (fire, ice, wind, earth)
- Arrows (ranged combat)
- Glow particles (highlights)
- Fishing (water effects)
- Teleport (beam + swirl)
- Combat HUD (damage splats, XP drops)

### Instanced Arena Fire Particles

**Commit**: `c20d0fc` (perf(arena): instance arena meshes and replace dynamic lights with TSL fire particles)

**Changes**:
- Removed 28 PointLights (performance impact)
- Replaced with GPU-driven TSL emissive brazier material
- Enhanced fire particle shader with:
  - Smooth value noise
  - Soft radial falloff
  - Additive-blend-friendly design
  - Per-particle turbulent vertex motion

**Performance impact**:
- 97% draw call reduction (~846 meshes → InstancedMesh)
- No dynamic lights (better performance)
- GPU-driven particle motion (no CPU overhead)

## Related Documentation

- [packages/asset-forge/README.md](../packages/asset-forge/README.md) - Asset Forge overview
- [packages/asset-forge/src/data/vfx-catalog.ts](../packages/asset-forge/src/data/vfx-catalog.ts) - Catalog data
- [packages/asset-forge/src/components/VFX/](../packages/asset-forge/src/components/VFX/) - VFX components
- [packages/shared/src/systems/shared/presentation/Particles.ts](../packages/shared/src/systems/shared/presentation/Particles.ts) - Particle system
