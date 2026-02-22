# Duel Arena Visual Enhancements

This document describes the visual improvements made to the duel arena system.

## Overview

The duel arena has received significant visual upgrades to create a more immersive medieval combat atmosphere:

1. **Procedural Stone Tile Floors** - Randomized sandstone texture for each arena
2. **Lit Torches with Fire Particles** - Corner torches with flickering flames
3. **GPU-Instanced Particle System** - Efficient fire rendering via ParticleManager

## Procedural Stone Tile Texture

**Commit:** `f8c585e`  
**Location:** `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`

Each duel arena floor now features a unique procedurally-generated sandstone tile pattern for OSRS medieval aesthetic.

### Features

- **Canvas-Generated Texture** - Created at runtime, no texture files needed
- **Randomized Per Arena** - Each arena gets unique tile variation
- **Sandstone Aesthetic** - Warm beige/tan colors matching OSRS style
- **Grout Lines** - Dark lines between tiles for depth
- **Color Variation** - Subtle per-tile color shifts
- **Speckle Noise** - Fine grain detail for realism

### Implementation

```typescript
// Generate unique texture for each arena
const texture = this.generateStoneTileTexture(512, 512, arenaIndex);

// Apply to arena floor mesh
const floorMaterial = new THREE.MeshStandardMaterial({
  map: texture,
  roughness: 0.9,
  metalness: 0.1,
});
```

### Texture Parameters

- **Resolution:** 512x512 pixels
- **Tile Grid:** 8x8 tiles
- **Base Color:** `#d4c4a8` (warm sandstone)
- **Grout Color:** `#8b7355` (dark brown)
- **Grout Width:** 2-3 pixels
- **Color Variation:** ±10% per tile
- **Speckle Density:** 0.15 (15% of pixels)

### Performance

- One texture per arena (not per tile)
- Texture generated once at arena creation
- No runtime texture updates
- Minimal memory footprint (~1MB per arena)

## Lit Torches with Fire Particles

**Commit:** `cef09c5`  
**Location:** `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`

Torches with flickering fire particles are placed at all 4 corners of each duel arena.

### Features

- **Corner Placement** - One torch at each arena fence corner
- **Fire Particles** - Rising embers with heat distortion
- **Point Lights** - Dynamic lighting from torch flames
- **Flicker Animation** - Realistic flame movement
- **Glow Preset** - "torch" preset with tight particle spread

### Torch Configuration

```typescript
// Torch glow preset
{
  preset: 'torch',
  position: { x, y, z },  // Arena corner position
  color: 0xff6600,        // Orange fire color
  particleCount: 6,       // Particles per torch
  spread: 0.08,           // Tight cluster
  riseSpeed: 0.3,         // Upward velocity
}
```

### Particle Behavior

- **Rise Spread:** 6 particles per torch
- **Tight Spread:** 0.08 radius (concentrated flame)
- **Upward Motion:** Particles rise with slight wobble
- **Respawn:** Particles respawn at base when reaching peak
- **Flicker:** Random intensity variation for flame effect

### Lighting

Each torch includes a PointLight:
- **Color:** Orange (#ff6600)
- **Intensity:** 2.0 (with flicker variation)
- **Distance:** 8 units
- **Decay:** 2.0 (realistic falloff)
- **Position:** Slightly above torch base

### Performance

- **GPU Instancing:** All torch particles use shared InstancedMesh
- **4 Torches per Arena:** Minimal draw call overhead
- **Shared Geometry:** One particle geometry for all torches
- **TSL Materials:** GPU-driven animation, no CPU updates

## GPU-Instanced Particle System

**Commit:** `4168f2f`  
**Location:** `packages/shared/src/entities/managers/particleManager/`

The particle system was completely refactored to use GPU instancing for massive performance improvements.

### Architecture

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash particles (96 instances)
│   ├── Bubble particles (72 instances)
│   ├── Shimmer particles (72 instances)
│   └── Ripple particles (24 instances)
└── GlowParticleManager (fires, altars, torches)
    ├── Fire preset (rising embers)
    ├── Altar preset (geometry-aware sparks)
    └── Torch preset (tight flame cluster)
```

### Performance Impact

**Before Refactor:**
- ~150 draw calls for fishing spot particles
- ~450 lines of per-entity CPU animation code
- Individual mesh per particle emitter
- CPU-driven particle updates every frame

**After Refactor:**
- 4 draw calls total (4 InstancedMeshes)
- GPU-driven animation via TSL NodeMaterials
- Centralized particle management
- Zero CPU cost for particle animation

### Usage Example

```typescript
// Get particle manager from ResourceSystem
const particleManager = world.getSystem('resource').particleManager;

// Register fishing spot particles
particleManager.register('fishing_spot_1', {
  type: 'water',
  position: { x: 10, y: 0, z: 20 },
  resourceId: 'fishing_spot_net'
});

// Register torch particles
particleManager.register('torch_1', {
  type: 'glow',
  preset: 'torch',
  position: { x: 5, y: 1.5, z: 10 },
  color: 0xff6600
});

// Move emitter (e.g., resource respawn)
particleManager.move('fishing_spot_1', { x: 12, y: 0, z: 22 });

// Cleanup
particleManager.unregister('fishing_spot_1');
```

### TSL NodeMaterials

Particles use Three.js Shading Language (TSL) for GPU-driven animation:

**Vertex Shader Features:**
- Billboard orientation (always face camera)
- Polar coordinate motion (angle + radius)
- Parabolic arcs for splash particles
- Sine wave wobble for bubble particles
- Circular wandering for shimmer particles

**Fragment Shader Features:**
- Texture-based alpha (glow/ring textures)
- Fade in/out envelopes
- Twinkle effects (shimmer)
- Additive blending for glow

**Per-Instance Attributes:**
- `spotPos` (vec3) - Emitter world position
- `ageLifetime` (vec2) - Current age, total lifetime
- `angleRadius` (vec2) - Polar angle, radial distance
- `dynamics` (vec4) - Peak height, size, speed, direction

### Glow Presets

**Altar Preset:**
- Geometry-aware spark placement
- Particles rise from altar mesh surface
- Requires `meshRoot` parameter for bounds detection
- Upward motion with slight outward drift

**Fire Preset:**
- Rising embers with heat distortion
- Orange/yellow color gradient
- Chaotic motion with turbulence
- Suitable for campfires, furnaces

**Torch Preset:**
- Tight particle cluster (0.08 spread)
- 6 particles per torch
- Concentrated flame effect
- Minimal horizontal drift

### Memory Budget

**Vertex Buffer Attributes (per particle layer):**
- Particle layers: 7 of 8 max attributes
  - position (1)
  - uv (1)
  - instanceMatrix (1)
  - spotPos (1)
  - ageLifetime (1)
  - angleRadius (1)
  - dynamics (1)

- Ripple layer: 5 of 8 max attributes
  - position (1)
  - uv (1)
  - instanceMatrix (1)
  - spotPos (1)
  - rippleParams (1)

### Extensibility

To add new particle types:

1. Create specialized manager (e.g., `SnowParticleManager.ts`)
2. Add type to `ParticleConfig` union in `ParticleManager.ts`
3. Add case to `register()`, `unregister()`, `move()` switch statements
4. Call `update()` in `ParticleManager.update()`

Example:
```typescript
// Add to ParticleConfig union
export interface SnowParticleConfig {
  type: 'snow';
  position: { x: number; y: number; z: number };
  intensity: number;
}

export type ParticleConfig = 
  | WaterParticleConfig 
  | GlowParticleConfig 
  | SnowParticleConfig;

// Add to ParticleManager constructor
this.snowManager = new SnowParticleManager(scene);

// Add to register() switch
case 'snow':
  this.snowManager.registerSnow(id, config);
  this.ownership.set(id, 'snow');
  break;
```

## Visual Quality Settings

### Particle Density

Particle counts are tuned for performance vs. visual quality:

**Fishing Spots:**
- Splash: 4-8 particles (depends on spot type)
- Bubble: 3-5 particles
- Shimmer: 3-5 particles
- Ripple: 2 particles

**Torches:**
- Fire: 6 particles per torch
- 4 torches per arena = 24 particles total

**Total Budget:**
- Max splash: 96 instances
- Max bubble: 72 instances
- Max shimmer: 72 instances
- Max ripple: 24 instances
- Total: 264 particle instances across all fishing spots

### Texture Quality

**Glow Texture:**
- 64x64 pixels
- Radial gradient with power falloff
- Sharpness: 2.0 (concentrated glow)
- Alpha channel for soft edges

**Ring Texture:**
- 64x64 pixels
- Ring radius: 0.65
- Ring width: 0.22
- Exponential falloff for smooth edges

## Future Enhancements

Potential additions to the particle system:

1. **Weather Effects** - Rain, snow, fog particles
2. **Magic Spell Effects** - Spell-specific particle trails
3. **Combat Hit Effects** - Impact particles on damage
4. **Environmental Ambience** - Dust motes, fireflies, leaves
5. **Celebration Effects** - Victory fireworks, confetti

All can be added following the ParticleManager pattern with minimal performance impact due to GPU instancing.
