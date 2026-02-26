# Teleport VFX System Improvements

## Overview

The teleport visual effects system was completely rewritten in February 2026 to use object pooling, TSL shaders, and multi-phase animations. The new system provides spectacular visual effects with zero allocations at spawn time and no pipeline compilation stutters.

## Visual Design

### Multi-Phase Sequence

The teleport effect progresses through 4 distinct phases over 2.5 seconds:

**Phase 1: Gather (0.0s - 0.5s)**
- Ground rune circle fades in and scales up (0.5 → 2.0)
- Base glow disc pulses into existence
- Rune circle rotates at 2.0 rad/s
- Cyan color palette

**Phase 2: Erupt (0.5s - 0.85s)**
- Dual beams shoot upward with elastic overshoot
- Core flash pops at beam base (white burst)
- Two shockwave rings expand outward (easeOutExpo)
- Point light intensity peaks at 5.0
- White-cyan color palette

**Phase 3: Sustain (0.85s - 1.7s)**
- Beams hold at full height
- Helix spiral particles rise continuously
- Burst particles arc outward with gravity
- Sustained cyan glow

**Phase 4: Fade (1.7s - 2.5s)**
- All elements fade out with easeInQuad
- Beams thin and shrink
- Particles fade via scale reduction
- Return to dark

### Visual Components

**Ground Rune Circle:**
- Procedural canvas texture with concentric circles, radial spokes, and triangular glyphs
- Additive blending with cyan color
- Rotates continuously during effect
- Scale: 0.5 → 2.0 during gather phase

**Base Glow Disc:**
- Procedural radial glow texture
- Pulses at 6 Hz during sustain phase
- Cyan color with 0.8 opacity

**Inner Beam:**
- White → cyan vertical gradient
- Hermite elastic curve (overshoots to 1.3 at t=0.35, settles to 1.0)
- Scrolling energy pulse (4 Hz)
- Soft fade at base to prevent floor clipping

**Outer Beam:**
- Light cyan → dark blue gradient
- Delayed 0.03s after inner beam
- Slightly shorter and thinner
- Same elastic curve

**Core Flash:**
- White sphere that pops at eruption (t=0.20-0.22s)
- Scale: 0 → 2.5 → 0
- Instant appearance, quick shrink

**Shockwave Rings:**
- Two expanding rings with staggered timing
- Ring 1: White-cyan, scale 1 → 13 over 0.2s
- Ring 2: Cyan, scale 1 → 11 over 0.22s (delayed 0.024s)
- easeOutExpo expansion curve

**Point Light:**
- Cyan color (#66ccff)
- Intensity: 0 → 1.5 (gather) → 5.0 (erupt) → 3.0 (sustain) → 0 (fade)
- Radius: 8 units
- Illuminates surrounding environment

**Helix Spiral Particles (12):**
- 2 counter-rotating strands × 6 particles each
- Rise speed: 2.5 + particleIndex * 0.25
- Spiral radius: 0.8 → 0.1 (tightens as they rise)
- Angular velocity: 3.0 + particleIndex * 0.4
- Recycle when reaching 16 units height
- Cyan and white-cyan colors

**Burst Particles (8):**
- 3 white + 3 cyan + 2 gold particles
- Random horizontal spread (1.0-3.0 units)
- Upward velocity: 4.0-9.0 units/s
- Gravity: 6.0 units/s²
- Fade via scale reduction
- Hide when below ground

## Performance Optimizations

### Object Pooling

**Before (Old System):**
```typescript
// Allocated new objects every teleport
const group = new THREE.Group();
const beam = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({...}));
const particles = [];
for (let i = 0; i < 20; i++) {
  particles.push(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({...})));
}
// Disposed on completion
```

**After (New System):**
```typescript
// Pre-allocated pool (created once in init())
for (let i = 0; i < POOL_SIZE; i++) {
  this.pool.push(this.createPoolEntry());  // All meshes, materials, uniforms
}

// Spawn (zero allocations)
const fx = this.pool.find(e => !e.active);
fx.active = true;
fx.life = 0;
fx.group.position.copy(position);
// Reset uniforms and particle state
```

**Benefits:**
- Zero allocations at spawn time
- Zero garbage collection pressure
- No pipeline compilation stutters
- Instant effect spawning

### TSL Shader Materials

**Before**: Basic materials with CPU-animated opacity
**After**: TSL node materials with GPU-driven animations

**Rune Circle Material:**
```typescript
const material = new MeshBasicNodeMaterial();
material.colorNode = mul(texture(runeTexture, uv()).rgb, colorVec);
material.opacityNode = mul(texture(runeTexture, uv()).a, uRuneOpacity);
```

**Beam Material:**
```typescript
const material = new MeshBasicNodeMaterial();

// Vertical gradient
const gradientColor = mix(baseColor, topColor, positionLocal.y);

// Scrolling energy pulse
const pulse = add(
  float(0.8),
  mul(sin(add(mul(positionLocal.y, float(3.0)), mul(time, float(4.0)))), float(0.2))
);

// Soft fade at base
const bottomFade = sub(
  float(1.0),
  max(sub(float(1.0), mul(positionLocal.y, float(2.0))), float(0.0))
);

material.colorNode = mul(gradientColor, pulse);
material.opacityNode = mul(mul(bottomFade, uOpacity), pulse);
```

**Benefits:**
- GPU-driven animations (zero CPU cost)
- Smooth gradients and pulses
- Per-effect opacity control via uniforms
- No material cloning needed

### Shared Resources

**Geometries (allocated once):**
- Particle plane: `PlaneGeometry(1, 1)`
- Inner beam cylinder: `CylinderGeometry(0.12, 0.25, 18, 12, 1, true)`
- Outer beam cylinder: `CylinderGeometry(0.06, 0.5, 16, 10, 1, true)`
- Disc: `CircleGeometry(0.5, 16)`
- Rune circle: `CircleGeometry(1.5, 32)`
- Shockwave ring: `RingGeometry(0.15, 0.4, 24)`
- Core flash sphere: `SphereGeometry(0.4, 8, 6)`

**Textures (allocated once):**
- Rune circle canvas texture (256×256)

**Materials (2 shared across all pool entries):**
- Cyan particle glow material
- White particle glow material

**Per-Effect Materials (7 per pool entry):**
- Rune circle material (with `uRuneOpacity` uniform)
- Base glow material (with `uGlowOpacity` uniform)
- Inner beam material (with `uInnerBeamOpacity` uniform)
- Outer beam material (with `uOuterBeamOpacity` uniform)
- Core flash material (with `uFlashOpacity` uniform)
- Shockwave ring 1 material (with `uShock1Opacity` uniform)
- Shockwave ring 2 material (with `uShock2Opacity` uniform)

**Pool Size**: 2 concurrent effects (both duel agents can teleport simultaneously)

## Suppressing Effects

Teleport effects can be suppressed for mid-fight proximity corrections:

```typescript
// Server-side
world.emit('player:teleport', {
  playerId: 'player-123',
  position: { x: 100, y: 0, z: 100 },
  rotation: 0,
  suppressEffect: true  // No VFX
});
```

**Use Cases:**
- Duel proximity corrections during combat
- Invisible position adjustments
- Anti-cheat teleports
- Debug teleports

**Behavior:**
- `suppressEffect: true` → No visual effect spawned
- `suppressEffect: false` or omitted → Full visual effect

## Easing Functions

**easeOutQuad**: Smooth deceleration
```typescript
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
```

**easeInQuad**: Smooth acceleration
```typescript
function easeInQuad(t: number): number {
  return t * t;
}
```

**easeOutExpo**: Exponential deceleration (shockwaves)
```typescript
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
```

**Hermite Curve**: Elastic overshoot (beams)
```typescript
const beamElasticCurve = new Curve();
beamElasticCurve.add({ time: 0, value: 0, outTangent: 5.0 });
beamElasticCurve.add({ time: 0.35, value: 1.3, inTangent: 1.0, outTangent: -2.0 });
beamElasticCurve.add({ time: 0.65, value: 0.95, inTangent: -0.3, outTangent: 0.5 });
beamElasticCurve.add({ time: 1.0, value: 1.0, inTangent: 0.2, outTangent: 0 });
```

## Debugging

### Enable Effect Logging

```typescript
// In ClientTeleportEffectsSystem.ts
private onPlayerTeleported = (data: unknown): void => {
  console.log('[TeleportVFX] Spawning effect at', position);
  this.spawnTeleportEffect(vec);
};
```

### Inspect Pool State

```javascript
// In browser console
const system = world.getSystem('client-teleport-effects');
console.log('Pool entries:', system.pool.length);
console.log('Active effects:', system.pool.filter(e => e.active).length);
```

### Disable Pooling (Debug)

Temporarily disable pooling to test single-effect behavior:

```typescript
// In ClientTeleportEffectsSystem.ts init()
// Change POOL_SIZE from 2 to 1
const POOL_SIZE = 1;
```

### Verify Shader Compilation

Check for shader compilation errors:

```javascript
// In browser console
const renderer = world.stage.renderer;
console.log('Shader programs:', renderer.info.programs.length);
// Should not increase during teleport spawns (materials pre-compiled)
```

## Migration from Old System

**No migration needed** - the new system is a drop-in replacement.

**Behavioral Changes:**
- Effect duration: 2.0s → 2.5s (more time to notice)
- Visual complexity: Simple beam + particles → Multi-phase sequence
- Performance: Allocates on spawn → Zero allocations (pooled)

**Compatibility:**
- Same event trigger: `EventType.PLAYER_TELEPORTED`
- Same suppression mechanism: `suppressEffect` flag
- Same positioning: World-space coordinates

## Related Documentation

- [VFX Catalog Browser](./vfx-catalog-browser.md) - Visual effect reference
- [Arena Performance Optimizations](./arena-performance-optimizations.md) - Related rendering improvements
- [ClientTeleportEffectsSystem.ts](../packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts) - Implementation
- [Curve.ts](../packages/shared/src/extras/animation/Curve.ts) - Hermite curve implementation
