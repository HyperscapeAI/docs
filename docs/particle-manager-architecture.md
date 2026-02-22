# ParticleManager Architecture

## Overview

The ParticleManager system provides centralized, GPU-instanced particle rendering for Hyperscape. It replaces per-entity CPU particle animation with a unified architecture that dramatically reduces draw calls and improves performance.

**Performance Impact**: Fishing spot particles went from ~150 draw calls (65-70 FPS) to 4 draw calls (120 FPS) by consolidating all particle rendering into GPU-instanced meshes.

## Architecture

### Component Hierarchy

```
ParticleManager (Central Router)
├── WaterParticleManager (Fishing spots)
│   ├── Splash Layer (InstancedMesh)
│   ├── Bubble Layer (InstancedMesh)
│   ├── Shimmer Layer (InstancedMesh)
│   └── Ripple Layer (InstancedMesh)
└── [Future: FireParticleManager, MagicParticleManager, etc.]
```

### Key Components

#### ParticleManager
**Location**: `packages/shared/src/entities/managers/particleManager/ParticleManager.ts`

Central routing hub that:
- Dispatches particle events to specialized sub-managers based on resource type
- Provides unified API for entity lifecycle (register/unregister/move)
- Drives all sub-managers via single `update()` call per frame

#### WaterParticleManager
**Location**: `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`

Manages all fishing spot visual effects using 4 GPU-instanced meshes:

| Layer | Max Instances | Purpose | Animation |
|-------|---------------|---------|-----------|
| Splash | 96 | Water droplets | Parabolic arcs (GPU) |
| Bubble | 72 | Rising bubbles | Wobble + rise (GPU) |
| Shimmer | 72 | Surface glints | Twinkle (GPU) |
| Ripple | 24 | Expanding rings | Ring expansion (GPU) |

#### ResourceSystem Integration
**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

- Creates `ParticleManager` on client startup
- Forwards `RESOURCE_SPAWNED` events to particle manager
- Calls `particleManager.update(dt, camera)` every frame
- Retroactively registers fishing spots created before system initialization

#### ResourceEntity Delegation
**Location**: `packages/shared/src/entities/world/ResourceEntity.ts`

Fishing spot entities now:
- Retain only lightweight glow mesh for interaction detection
- Delegate all particle/ripple rendering to centralized `ParticleManager`
- Use lazy registration pattern (retry if manager not ready during entity init)

## GPU Instancing Implementation

### Per-Instance Data (InstancedBufferAttributes)

Each particle layer uses named attributes to store per-instance state:

```typescript
// Particle layers (splash, bubble, shimmer)
spotPos: vec3        // Fishing spot world center
ageLifetime: vec2    // Current age (x), total lifetime (y)
angleRadius: vec2    // Polar angle (x), radial distance (y)
dynamics: vec4       // peakHeight (x), size (y), speed (z), direction (w)

// Ripple layer
spotPos: vec3        // Fishing spot world center
rippleParams: vec2   // Phase offset (x), ripple speed (y)
```

**Vertex Buffer Budget**:
- Particle layers: 7 of 8 max attributes
  - `position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + ageLifetime(1) + angleRadius(1) + dynamics(1)`
- Ripple layer: 5 of 8 max attributes
  - `position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + rippleParams(1)`

### TSL Shader Materials

All animation logic runs on GPU via Three.js Shading Language (TSL) NodeMaterials:

**Splash Particles**:
```typescript
// Parabolic arc trajectory
const arcY = mul(peakHeight, mul(float(4), mul(t, sub(float(1), t))));
const particleCenter = add(spotPos, vec3(ox, add(float(0.08), arcY), oz));

// Snappy fade-in, smooth fade-out
const fadeIn = min(mul(t, float(12)), float(1));
const fadeOut = pow(sub(float(1), t), float(1.2));
```

**Bubble Particles**:
```typescript
// Gentle rise with lateral wobble
const riseY = mul(t, peakHeight);
const wobbleFreq = mul(direction, float(4.0));
const drift = mul(sin(add(angle, mul(t, wobbleFreq))), radius);
```

**Shimmer Particles**:
```typescript
// Fast twinkle using time-based sine waves
const twinkle = max(float(0), mul(
  sin(add(mul(time, float(8)), mul(angle, float(5)))),
  sin(add(mul(time, float(13)), mul(angle, float(3))))
));
```

**Ripple Rings**:
```typescript
// Expanding ring with phase-based opacity
const phase = fract(add(mul(time, mul(rippleSpeed, float(0.5))), phaseOffset));
const scale = add(float(0.15), mul(phase, float(1.3)));
```

## Fishing Spot Variants

Different fishing methods have distinct visual characteristics:

| Variant | Ripple Speed | Splash Count | Bubble Count | Shimmer Count | Burst Interval |
|---------|--------------|--------------|--------------|---------------|----------------|
| **Net** (calm) | 0.8 | 4 | 3 | 3 | 5-10s |
| **Bait** (default) | 1.0 | 5 | 4 | 4 | 3-7s |
| **Fly** (active) | 1.5 | 8 | 5 | 5 | 2-5s |

Variants are determined by `resourceId` string matching in `getFishingSpotVariant()`.

## Burst System

Periodic "fish activity" bursts create clusters of splash particles:

1. Each fishing spot has a countdown timer (`burstTimer`)
2. When timer expires, fire `burstSplashCount` splash particles simultaneously
3. Particles cluster around a random point with slight spread
4. Burst splashes have taller arcs (`peakHeight: 0.25-0.6` vs normal `0.12-0.32`)
5. Timer resets to random interval between `burstIntervalMin` and `burstIntervalMax`

## Lifecycle Management

### Registration Flow

```typescript
// 1. ResourceEntity creates fishing spot visual
createFishingSpotVisual() {
  this.createGlowIndicator();  // Local glow mesh for interaction
  this.tryRegisterWithParticleManager();  // Register with centralized manager
  this.world.setHot(this, true);  // Enable frame updates
}

// 2. ParticleManager routes to WaterParticleManager
registerSpot(config) {
  if (this.isWaterType(config.resourceType)) {
    this.waterManager.registerSpot(config);
  }
}

// 3. WaterParticleManager allocates instance slots
registerSpot(config) {
  const splashSlots = this.allocSlots(this.splashLayer, variant.splashCount);
  const bubbleSlots = this.allocSlots(this.bubbleLayer, variant.bubbleCount);
  // ... write initial particle state to InstancedBufferAttributes
}
```

### Lazy Registration Pattern

Entities may initialize before `ResourceSystem.start()` creates the `ParticleManager`. To handle this:

```typescript
// ResourceEntity.clientUpdate() retries registration
if (!this._registeredWithParticleManager && this.config.resourceType === "fishing_spot") {
  if (this.tryRegisterWithParticleManager()) {
    console.log(`[FishingSpot] Late registration succeeded for ${this.id}`);
  }
}
```

### Cleanup Flow

```typescript
// 1. ResourceEntity disposes
dispose() {
  const pm = this.getParticleManager();
  if (pm) {
    pm.unregisterSpot(this.id, this.config.resourceType);
  }
}

// 2. ParticleManager routes to sub-manager
unregisterSpot(entityId, resourceType) {
  if (this.isWaterType(resourceType)) {
    this.waterManager.unregisterSpot(entityId);
  }
}

// 3. WaterParticleManager frees instance slots
unregisterSpot(entityId) {
  // Zero out particle sizes, return slots to free pool
  for (const s of spot.splashSlots) {
    layer.dynamicsArr[s * 4 + 1] = 0;  // size = 0 (invisible)
    layer.freeSlots.push(s);
  }
}
```

## Per-Frame Update

```typescript
// ResourceSystem.update() drives all particle managers
update(dt: number) {
  if (this.particleManager) {
    const camera = this.world.camera;
    if (camera) {
      this.particleManager.update(dt, camera);
    }
  }
}

// ParticleManager routes to sub-managers
update(dt, camera) {
  this.waterManager.update(dt, camera);
  // Future: this.fireManager.update(dt, camera);
}

// WaterParticleManager updates all active particles
update(dt, camera) {
  // Update camera billboarding vectors
  camera.matrixWorld.extractBasis(right, up, fwd);
  this.uCameraRight.value.copy(right);
  this.uCameraUp.value.copy(up);

  // Age all particles, respawn when lifetime expires
  for (const spot of this.activeSpots.values()) {
    for (const s of spot.splashSlots) {
      al[s * 2] += dt;  // Increment age
      if (al[s * 2] >= al[s * 2 + 1]) {
        // Respawn with new random parameters
      }
    }
  }

  // Mark dirty attributes for GPU upload
  if (splashALDirty) this.splashLayer.ageLifetimeAttr.needsUpdate = true;
}
```

## Adding New Particle Types

To add a new particle system (e.g., fire, magic, dust):

### 1. Create Sub-Manager Class

```typescript
// packages/shared/src/entities/managers/particleManager/FireParticleManager.ts
export class FireParticleManager {
  constructor(scene: THREE.Scene) {
    // Create InstancedMeshes with TSL materials
  }

  registerSpot(config: { entityId: string; position: vec3; ... }) {
    // Allocate instance slots, write initial state
  }

  unregisterSpot(entityId: string) {
    // Free instance slots
  }

  update(dt: number, camera: THREE.Camera) {
    // Age particles, update attributes
  }

  dispose() {
    // Clean up meshes and textures
  }
}
```

### 2. Integrate with ParticleManager

```typescript
// ParticleManager.ts
export class ParticleManager {
  private waterManager: WaterParticleManager;
  private fireManager: FireParticleManager;  // Add new manager

  constructor(scene: THREE.Scene) {
    this.waterManager = new WaterParticleManager(scene);
    this.fireManager = new FireParticleManager(scene);  // Instantiate
  }

  registerSpot(config: ParticleSpotConfig): void {
    if (this.isWaterType(config.resourceType)) {
      this.waterManager.registerSpot(config);
    } else if (this.isFireType(config.resourceType)) {  // Add routing
      this.fireManager.registerSpot(config);
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    this.waterManager.update(dt, camera);
    this.fireManager.update(dt, camera);  // Drive new manager
  }

  dispose(): void {
    this.waterManager.dispose();
    this.fireManager.dispose();  // Clean up new manager
  }

  private isFireType(resourceType: string): boolean {
    return resourceType === "fire" || resourceType === "campfire";
  }
}
```

### 3. Update Entity Classes

Entities that need fire particles call `particleManager.registerSpot()` with appropriate `resourceType`.

## Performance Characteristics

### Before (Per-Entity CPU Animation)

- **Draw Calls**: ~150 (10-21 meshes per fishing spot × ~10 spots)
- **CPU Work**: Per-frame trig, quaternion copies, opacity writes for every particle
- **Memory**: Individual `THREE.Mesh` + `THREE.Material` per particle
- **FPS**: 65-70 on test machine

### After (GPU-Instanced Centralized)

- **Draw Calls**: 4 (one per particle layer, shared across all fishing spots)
- **CPU Work**: Minimal (age increment, attribute dirty flags)
- **Memory**: Shared geometry + material, typed arrays for instance data
- **FPS**: 120 on test machine

### Scalability

The system scales to hundreds of fishing spots with minimal performance impact:
- Instance slot allocation is O(1) (pop from free list)
- Per-frame update is O(n) where n = total active particles across all spots
- GPU handles all animation math (billboarding, trajectories, opacity)

## Technical Details

### Texture Generation

**Glow Texture** (soft radial gradient):
```typescript
const dist = Math.sqrt(dx * dx + dy * dy);
const falloff = Math.max(0, 1 - dist);
const strength = Math.pow(falloff, sharpness);  // sharpness = 2.0
```

**Ring Texture** (Gaussian ring band):
```typescript
const ringDist = Math.abs(dist - ringRadius) / ringWidth;
const strength = Math.exp(-ringDist * ringDist * 4);
const edgeFade = Math.min(Math.max((1 - dist) * 5, 0), 1);
const alpha = strength * edgeFade;
```

Textures are cached in `ResourceEntity.textureCache` to avoid duplicates.

### Billboard Rendering

Particles always face the camera using extracted basis vectors:

```typescript
// Extract camera right/up vectors
camera.matrixWorld.extractBasis(right, up, fwd);

// TSL shader applies billboard offset
const billboardOffset = add(
  mul(mul(localXY.x, size), camRight),
  mul(mul(localXY.y, size), camUp)
);
material.positionNode = add(particleCenter, billboardOffset);
```

### Instance Slot Management

Free slots are managed via stack (LIFO):

```typescript
// Allocation
const freeSlots: number[] = [];
for (let i = maxInstances - 1; i >= 0; i--) freeSlots.push(i);

// Allocate
const slot = layer.freeSlots.pop();

// Free
layer.freeSlots.push(slot);
```

## Migration Guide

### Old Pattern (Per-Entity)

```typescript
class ResourceEntity {
  private particleMeshes: THREE.Mesh[] = [];
  
  createFishingSpotParticles() {
    for (let i = 0; i < splashCount; i++) {
      const particle = new THREE.Mesh(geometry, material);
      scene.add(particle);
      this.particleMeshes.push(particle);
    }
  }

  clientUpdate(dt) {
    for (const particle of this.particleMeshes) {
      // CPU animation: trig, quaternion, position, opacity
      particle.position.set(x, y, z);
      particle.quaternion.copy(camera.quaternion);
      particle.material.opacity = fadeIn * fadeOut;
    }
  }
}
```

### New Pattern (Centralized)

```typescript
class ResourceEntity {
  createFishingSpotVisual() {
    this.createGlowIndicator();  // Local interaction mesh only
    this.tryRegisterWithParticleManager();  // Delegate to manager
  }

  tryRegisterWithParticleManager() {
    const pm = this.getParticleManager();
    if (!pm) return false;
    
    pm.registerSpot({
      entityId: this.id,
      position: this.getPosition(),
      resourceType: this.config.resourceType,
      resourceId: this.config.resourceId
    });
    return true;
  }

  dispose() {
    const pm = this.getParticleManager();
    if (pm) {
      pm.unregisterSpot(this.id, this.config.resourceType);
    }
  }
}
```

## Testing

Particle system behavior is validated via:

1. **Visual Tests**: Playwright screenshots verify particle rendering
2. **Performance Tests**: FPS benchmarks measure draw call reduction
3. **Integration Tests**: ResourceSystem tests verify manager lifecycle

See `packages/shared/src/systems/shared/entities/__tests__/ResourceSystem.test.ts`

## Future Enhancements

Planned particle types for centralized management:

- **Fire**: Campfires, torches, burning logs (ember particles + smoke)
- **Magic**: Spell effects, enchantment glows, teleport sparkles
- **Dust**: Mining debris, woodcutting sawdust, footstep clouds
- **Weather**: Rain, snow, fog particles
- **Combat**: Blood splatter, impact sparks, shield deflection

Each will follow the same pattern: dedicated sub-manager, GPU-instanced rendering, TSL shaders.

## References

- **PR #877**: [GPU-instanced fishing spot particles](https://github.com/HyperscapeAI/hyperscape/pull/877)
- **Commit 4168f2f**: Centralize fishing spot particles into ParticleManager
- **Three.js TSL**: [Shading Language Documentation](https://threejs.org/docs/#api/en/nodes/Nodes)
