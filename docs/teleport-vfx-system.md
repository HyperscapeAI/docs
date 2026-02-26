# Teleport VFX System (February 2026)

**Commits**: 7bf0e14, ceb8909, 061e631  
**PR**: #939  
**Author**: dreaminglucid

## Overview

Complete rewrite of the teleport visual effects system with object pooling, multi-phase animation, and TSL shader materials. Replaces the simple beam/ring/particles effect with a spectacular multi-component sequence featuring ground rune circles, dual beams with elastic overshoot, shockwave rings, helix spiral particles, burst particles with gravity, and dynamic point lighting.

## Visual Design

### Phase Timeline

The effect runs for 2.5 seconds with 4 distinct phases:

| Phase | Duration | Progress | Description |
|-------|----------|----------|-------------|
| **Gather** | 0.0s - 0.5s | 0% - 20% | Rune circle appears and scales, base glow fades in |
| **Erupt** | 0.5s - 0.85s | 20% - 34% | Beams shoot upward with elastic overshoot, core flash, shockwaves |
| **Sustain** | 0.85s - 1.7s | 34% - 68% | Full effect sustained, helix particles spiral, burst particles launched |
| **Fade** | 1.7s - 2.5s | 68% - 100% | All components fade out, beams thin and shrink |

### Components

**Structural Elements** (7 meshes per pool entry):
1. **Ground Rune Circle** - Procedural canvas texture with concentric circles, radial spokes, and triangular glyphs
2. **Base Glow Disc** - Pulsing cyan glow at ground level
3. **Inner Beam** - White→cyan gradient cylinder with elastic height curve
4. **Outer Beam** - Light cyan→dark blue cylinder, delayed 0.03s
5. **Core Flash** - White sphere that pops at eruption (0.20-0.22s)
6. **Shockwave Ring 1** - Expanding ring with easeOutExpo (scale 1→13)
7. **Shockwave Ring 2** - Second ring delayed 0.024s (scale 1→11)

**Particle Systems**:
- **Helix Particles** (8): 2 strands of 4, spiral upward with decreasing radius
- **Burst Particles** (6): 3 white + 3 cyan, launched with gravity simulation

**Lighting**:
- **Point Light**: Dynamic intensity (0→5.0 at eruption, fades to 0)

## Technical Implementation

### Object Pooling

**Pool Size**: 2 concurrent effects (both duel agents can teleport simultaneously)

**Zero Allocations**: All materials compiled during `init()`, no pipeline compilations at spawn time

**Pool Entry Structure**:
```typescript
interface PooledEffect {
  group: THREE.Group;
  
  // Structural meshes (7)
  runeCircle: THREE.Mesh;
  baseGlow: THREE.Mesh;
  innerBeam: THREE.Mesh;
  outerBeam: THREE.Mesh;
  coreFlash: THREE.Mesh;
  shockwave1: THREE.Mesh;
  shockwave2: THREE.Mesh;
  
  // Per-effect materials with own uniforms (7)
  perEffectMaterials: MeshBasicNodeMaterial[];
  uRuneOpacity: ReturnType<typeof uniform>;
  uGlowOpacity: ReturnType<typeof uniform>;
  uInnerBeamOpacity: ReturnType<typeof uniform>;
  uOuterBeamOpacity: ReturnType<typeof uniform>;
  uFlashOpacity: ReturnType<typeof uniform>;
  uShock1Opacity: ReturnType<typeof uniform>;
  uShock2Opacity: ReturnType<typeof uniform>;
  
  // Particles (share materials across pool)
  helixParticles: HelixParticle[];
  burstParticles: BurstParticle[];
  
  // Runtime state
  active: boolean;
  life: number;
}
```

### Shared Resources

**Geometries** (allocated once, shared by all pool entries):
- `particleGeo`: PlaneGeometry(1, 1)
- `beamInnerGeo`: CylinderGeometry with bottom pivot
- `beamOuterGeo`: CylinderGeometry with bottom pivot
- `discGeo`: CircleGeometry(0.5, 16)
- `runeCircleGeo`: CircleGeometry(1.5, 32)
- `shockwaveGeo`: RingGeometry(0.15, 0.4, 24)
- `sphereGeo`: SphereGeometry(0.4, 8, 6)

**Textures** (allocated once):
- `runeTexture`: CanvasTexture with procedural rune pattern

**Particle Materials** (2 total, shared by all pool entries):
- `particleCyanMat`: Cyan glow for helix particles
- `particleWhiteMat`: White glow for burst particles

### TSL Shader Materials

**Particle Glow Material** (no per-instance opacity):
```typescript
const center = vec2(0.5, 0.5);
const dist = length(sub(uv(), center));
const glow = pow(max(sub(1.0, mul(dist, 2.0)), 0.0), 3.0);

material.colorNode = mul(colorVec, glow);
material.opacityNode = mul(glow, 0.8);
```

Particles fade by scaling down - glow pattern handles soft edges.

**Beam Material** (vertical gradient + scrolling pulse):
```typescript
const gradientColor = mix(baseColor, topColor, positionLocal.y);
const pulse = add(0.8, mul(sin(add(mul(positionLocal.y, 3.0), mul(time, 4.0))), 0.2));

// Soft fade at beam base (emerges from rune circle)
const bottomFade = sub(1.0, max(sub(1.0, mul(yNorm, 2.0)), 0.0));

material.colorNode = mul(gradientColor, pulse);
material.opacityNode = mul(mul(mul(sub(1.0, mul(yNorm, 0.3)), bottomFade), uOpacity), pulse);
```

**Structural Glow Material** (per-effect opacity uniform):
```typescript
const glow = pow(max(sub(1.0, mul(dist, 2.0)), 0.0), 3.0);
material.colorNode = mul(colorVec, glow);
material.opacityNode = mul(glow, uOpacity);
```

### Animation Curves

**Beam Elastic Curve** (Hermite interpolation):
```typescript
beamElasticCurve.add({ time: 0, value: 0, outTangent: 5.0 });
beamElasticCurve.add({ time: 0.35, value: 1.3, inTangent: 1.0, outTangent: -2.0 });  // Overshoot
beamElasticCurve.add({ time: 0.65, value: 0.95, inTangent: -0.3, outTangent: 0.5 });  // Settle
beamElasticCurve.add({ time: 1.0, value: 1.0, inTangent: 0.2, outTangent: 0 });
```

Creates elastic "pop" effect - beams overshoot to 1.3× height at 35% progress, then settle to 1.0×.

### Easing Functions

```typescript
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
```

- **Gather Phase**: easeOutQuad (smooth fade-in)
- **Fade Phase**: easeInQuad (smooth fade-out)
- **Shockwaves**: easeOutExpo (fast expansion, slow deceleration)

## Particle Behavior

### Helix Spiral Particles

**Count**: 8 (2 strands of 4 particles each)

**Motion**:
```typescript
// Spiral upward
angle += dt * (3.0 + particleIndex * 0.4);
const riseSpeed = 2.5 + particleIndex * 0.25;
const radius = max(0.1, 0.8 - localTime * 0.15);  // Decreasing radius

position.set(
  cos(angle) * radius,
  localTime * riseSpeed,
  sin(angle) * radius
);
```

**Recycling**: When height > 16, particle resets to bottom (continuous spiral effect)

**Fade**: Via scale (not opacity) - `baseScale * heightFade`

### Burst Particles

**Count**: 6 (3 white + 3 cyan)

**Motion**:
```typescript
// Gravity simulation
velocity.y -= 6.0 * dt;
position.addScaledVector(velocity, dt);

// Initial velocity (randomized on spawn)
const angle = random() * PI * 2;
const upSpeed = 4.0 + random() * 5.0;
const spread = 1.0 + random() * 2.0;
velocity.set(cos(angle) * spread, upSpeed, sin(angle) * spread);
```

**Fade**: Via scale - `baseScale * (1.0 - localTime / 1.8)`

**Culling**: Hidden when below ground (y < -0.5)

## Event Handling

### Suppressing Effects

Teleport effects can be suppressed via `suppressEffect` flag:

```typescript
world.emit('player:teleport', {
  playerId: 'player-123',
  position: { x: 10, y: 0, z: 20 },
  rotation: 0,
  suppressEffect: true  // Skip VFX
});
```

**Use Cases**:
- Mid-fight proximity corrections (duel system)
- Frequent position adjustments
- Invisible teleports

### Network Propagation

The `suppressEffect` flag is forwarded through the network stack:

```typescript
// ServerNetwork → ClientNetwork → VFX system
const teleportPacket = {
  playerId,
  position: [x, y, z],
  rotation,
  ...(suppressEffect ? { suppressEffect: true } : {})
};
```

### Duplicate Effect Prevention

**Fixed**: Removed duplicate `PLAYER_TELEPORTED` emits that caused ghost effects:

1. **PlayerRemote.modify()**: Removed emit (position may be stale)
2. **ClientNetwork.onPlayerTeleport()**: Only emits for remote players (local player already emitted in `localPlayer.teleport()`)

## Performance Characteristics

### Spawn Cost
- **Before**: ~20 material compilations, ~20 geometry allocations
- **After**: 0 allocations (grab from pool, reset state)

### Update Cost
- **Before**: ~20 material opacity updates, ~20 particle position updates
- **After**: 7 uniform updates, 14 particle position updates (phase-gated)

### Memory
- **Before**: ~20 materials × 2 concurrent effects = 40 materials
- **After**: 7 materials × 2 pool entries + 2 shared particle materials = 16 materials

### Draw Calls
- **Before**: ~20 draw calls per effect
- **After**: ~20 draw calls per effect (same, but zero allocation overhead)

## Debugging

### Disable Cache for Testing

```javascript
// In browser console
localStorage.setItem('disable-teleport-pool', 'true');
// Reload page - effects will allocate fresh each time
```

### Visual Debugging

```typescript
// Show pool entry bounding boxes
for (const fx of this.pool) {
  const helper = new THREE.BoxHelper(fx.group, 0xff0000);
  this.world.stage.scene.add(helper);
}
```

### Performance Profiling

```javascript
// In browser console
performance.mark('teleport-spawn-start');
// Trigger teleport
performance.mark('teleport-spawn-end');
performance.measure('teleport-spawn', 'teleport-spawn-start', 'teleport-spawn-end');
console.log(performance.getEntriesByName('teleport-spawn'));
```

## Related Systems

### ClientTeleportEffectsSystem

**File**: `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

**Responsibilities**:
- Listen for `PLAYER_TELEPORTED` events
- Spawn effects from object pool
- Update all active effects each frame
- Deactivate effects when complete

### DuelOrchestrator

**File**: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`

**Changes**:
- Removed `suppressEffect: true` from cleanup teleports (exit VFX now plays)
- Victory emote delayed 600ms to prevent combat cleanup override
- Emote reset to "idle" in `stopCombat()` so wave stops when agents teleport out

### ServerNetwork

**File**: `packages/shared/src/systems/client/ClientNetwork.ts`

**Changes**:
- Forward `suppressEffect` through network packets
- Removed duplicate `PLAYER_TELEPORTED` emits

## Migration Guide

### For Developers

**No migration needed** - changes are fully backward compatible.

**Triggering teleport effects**:
```typescript
// With effect (default)
world.emit('player:teleport', {
  playerId: 'player-123',
  position: { x: 10, y: 0, z: 20 },
  rotation: 0
});

// Without effect (suppress)
world.emit('player:teleport', {
  playerId: 'player-123',
  position: { x: 10, y: 0, z: 20 },
  rotation: 0,
  suppressEffect: true
});
```

### For Asset Creators

**Rune Circle Texture**: Procedurally generated via canvas - no external assets needed.

**Colors**: Hardcoded cyan/white theme - modify in `createRuneTexture()` and material factories if needed.

## Known Issues

### Beam Base Clipping

**Symptom**: Beam base clips through floor on uneven terrain.

**Cause**: Beam geometry starts at y=0, floor may be below.

**Fix** (commit ceb8909): Fade beam base to prevent VFX clipping through floor:
```typescript
const bottomFade = sub(1.0, max(sub(1.0, mul(yNorm, 2.0)), 0.0));
material.opacityNode = mul(mul(bottomFade, uOpacity), pulse);
```

### Duplicate Teleport VFX

**Symptom**: 3 teleport effects play when agents exit arena (should be 2).

**Cause**: Race condition - `clearDuelFlagsForCycle()` called before `cleanupAfterDuel()` teleports, causing `DuelSystem.ejectNonDuelingPlayersFromCombatArenas()` to emit spurious extra teleport.

**Fix** (commit 7bf0e14): Defer flag clear until cleanup teleports complete:
```typescript
// In StreamingDuelScheduler.endCycle()
// NOTE: Duel flags stay true until cleanupAfterDuel() completes teleports
// and clears via microtask. Clearing flags before teleport creates race.
```

## References

- [ClientTeleportEffectsSystem.ts](packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts) - Implementation
- [DuelOrchestrator.ts](packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts) - Duel system integration
- [Three.js Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) - TSL documentation
