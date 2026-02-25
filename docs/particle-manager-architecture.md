# ParticleManager Architecture

## Overview

The ParticleManager is a centralized GPU-instanced particle rendering system that replaced per-entity CPU-animated particles. This refactor (PR #877, commit 4168f2f) achieved a 97% reduction in draw calls and doubled FPS for fishing spot rendering.

## Performance Impact

**Before Refactor:**
- ~150 draw calls for fishing spot particles
- ~450 lines of per-entity CPU animation code
- FPS: 65-70 on reference hardware
- Each fishing spot created 10-21 individual THREE.Mesh objects

**After Refactor:**
- 4 draw calls total (one per particle layer)
- GPU-computed animation via TSL shaders
- FPS: 120 on reference hardware
- All fishing spots share 4 InstancedMesh objects

## Architecture

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash layer (InstancedMesh, parabolic arcs)
│   ├── Bubble layer (InstancedMesh, rise + wobble)
│   ├── Shimmer layer (InstancedMesh, surface twinkle)
│   └── Ripple layer (InstancedMesh, expanding rings)
├── GlowParticleManager (altars, fires, torches)
│   ├── Glow billboards (InstancedMesh)
│   ├── Rise particles (InstancedMesh)
│   └── Spark particles (InstancedMesh)
└── [Future managers: magic, dust, etc.]
```

## Core Components

### 1. ParticleManager

**Location**: `packages/shared/src/entities/managers/particleManager/ParticleManager.ts`

**Purpose**: Central entry point and router for all particle systems.

**Key Features:**
- Discriminated union config (`ParticleConfig`) for type-safe registration
- Ownership tracking via internal map (no type hints needed for unregister/move)
- Event routing to specialized sub-managers
- Extensible architecture for new particle types

**API:**
```typescript
// Register a particle emitter
register(id: string, config: ParticleConfig): void

// Unregister (no type hint required)
unregister(id: string): void

// Move to new position (no type hint required)
move(id: string, newPos: {x, y, z}): void

// Handle resource events
handleResourceEvent(data: ParticleResourceEvent): void

// Per-frame update
update(dt: number, camera: THREE.Camera): void
```

**Config Types:**
```typescript
// Water particles (fishing spots)
type WaterParticleConfig = {
  type: "water";
  position: {x, y, z};
  resourceId: string;
}

// Glow particles (altars, fires, torches)
type GlowParticleConfig = {
  type: "glow";
  preset: "altar" | "fire" | "torch" | "default";
  position: {x, y, z};
  color?: number | {core, mid, outer};
  meshRoot?: THREE.Object3D;
  modelScale?: number;
  modelYOffset?: number;
}
```

### 2. WaterParticleManager

**Location**: `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`

**Purpose**: GPU-instanced rendering for fishing spot effects.

**Pool Sizes:**
- MAX_SPLASH: 96 instances
- MAX_BUBBLE: 72 instances
- MAX_SHIMMER: 72 instances
- MAX_RIPPLE: 24 instances

**Per-Instance Data (InstancedBufferAttributes):**

Particle layers (splash, bubble, shimmer):
- `spotPos` (vec3) - fishing spot world center
- `ageLifetime` (vec2) - current age (x), total lifetime (y)
- `angleRadius` (vec2) - polar angle (x), radial distance (y)
- `dynamics` (vec4) - peakHeight (x), size (y), speed (z), direction (w)

Ripple layer:
- `spotPos` (vec3) - fishing spot world center
- `rippleParams` (vec2) - phase offset (x), ripple speed (y)

**Vertex Buffer Budget:**
- Particle layers: 7 of 8 max attributes
  - position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + ageLifetime(1) + angleRadius(1) + dynamics(1)
- Ripple layer: 5 of 8 max attributes
  - position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + rippleParams(1)

**TSL Shader Features:**
- Billboard orientation (camera-facing)
- Parabolic arc motion (splash)
- Wobble + rise animation (bubbles)
- Twinkle effect (shimmer)
- Ring expansion (ripples)
- Fade in/out envelopes
- All computed on GPU per frame

**Fishing Spot Variants:**

| Variant | Ripples | Splash | Bubble | Shimmer | Burst Interval | Description |
|---------|---------|--------|--------|---------|----------------|-------------|
| Net | 2 | 4 | 3 | 3 | 5-10s | Calm, gentle (shallow water) |
| Bait | 2 | 5 | 4 | 4 | 3-7s | Medium activity (default) |
| Fly | 2 | 8 | 5 | 5 | 2-5s | Active (river/moving water) |

### 3. GlowParticleManager

**Location**: `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`

**Purpose**: GPU-instanced rendering for glow effects (altars, fires, torches).

**Presets:**
- `altar`: Vertical rise particles with geometry-aware spark placement
- `fire`: Standard fire glow with rise particles
- `torch`: Tight spread (6 particles, 0.08 spread) for fence-mounted torches
- `default`: General-purpose glow effect

**Features:**
- PointLight integration with flicker animation
- Preset-aware respawn spread
- Color override support (single hex or three-tone palette)
- Model-aware positioning (scale + Y offset)

### 4. ResourceSystem Integration

**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

**Responsibilities:**
- Creates ParticleManager on client startup
- Forwards resource events via `handleResourceEvent()`
- Calls `particleManager.update(dt, camera)` per frame
- Retroactively registers fishing spots created before system start

**Event Routing:**
```typescript
// Listen for resource events
this.subscribe(EventType.RESOURCE_SPAWNED, (data) => {
  this.particleManager?.handleResourceEvent(data);
});
```

### 5. ResourceEntity Delegation

**Location**: `packages/shared/src/entities/world/ResourceEntity.ts`

**Changes:**
- Removed ~450 lines of per-entity particle animation code
- Delegates to ParticleManager via `tryRegisterWithParticleManager()`
- Retains only lightweight glow mesh for interaction detection
- Lazy registration pattern handles timing/lifecycle edge cases

**Lazy Registration Pattern:**
```typescript
// Try to register during visual creation
this.tryRegisterWithParticleManager();

// Retry from clientUpdate if manager wasn't ready yet
if (!this._registeredWithParticleManager) {
  if (this.tryRegisterWithParticleManager()) {
    console.log(`Late registration succeeded for ${this.id}`);
  }
}
```

## Adding New Particle Types

To add a new particle type (e.g., fire, magic, dust):

1. **Create sub-manager class** in `packages/shared/src/entities/managers/particleManager/`
   ```typescript
   export class FireParticleManager {
     constructor(scene: THREE.Scene) { ... }
     registerFire(id: string, config: FireConfig): void { ... }
     unregisterFire(id: string): void { ... }
     moveFire(id: string, newPos: {x, y, z}): void { ... }
     update(dt: number, camera: THREE.Camera): void { ... }
     dispose(): void { ... }
   }
   ```

2. **Instantiate in ParticleManager constructor**
   ```typescript
   constructor(scene: THREE.Scene) {
     this.waterManager = new WaterParticleManager(scene);
     this.glowManager = new GlowParticleManager(scene);
     this.fireManager = new FireParticleManager(scene); // NEW
   }
   ```

3. **Add routing logic** in register/unregister/move methods
   ```typescript
   register(id: string, config: ParticleConfig): void {
     switch (config.type) {
       case "water": ...
       case "glow": ...
       case "fire": // NEW
         this.fireManager.registerFire(id, config);
         this.ownership.set(id, "fire");
         break;
     }
   }
   ```

4. **Call update() and dispose()** from ParticleManager
   ```typescript
   update(dt: number, camera: THREE.Camera): void {
     this.waterManager.update(dt, camera);
     this.glowManager.update(dt, camera);
     this.fireManager.update(dt, camera); // NEW
   }

   dispose(): void {
     this.waterManager.dispose();
     this.glowManager.dispose();
     this.fireManager.dispose(); // NEW
   }
   ```

5. **Add config type** to discriminated union
   ```typescript
   export interface FireParticleConfig {
     type: "fire";
     intensity: number;
     position: {x, y, z};
   }

   export type ParticleConfig = 
     | WaterParticleConfig 
     | GlowParticleConfig 
     | FireParticleConfig; // NEW
   ```

## GPU Instancing Best Practices

### Vertex Buffer Limits

WebGL/WebGPU has a maximum of 8 vertex attributes per shader. When using InstancedMesh:
- 1 attribute for position (built-in)
- 1 attribute for uv (built-in)
- 1 attribute for instanceMatrix (built-in)
- **5 remaining for custom InstancedBufferAttributes**

**Current Usage:**
- Particle layers: 4 custom attributes (spotPos, ageLifetime, angleRadius, dynamics)
- Ripple layer: 2 custom attributes (spotPos, rippleParams)

### Memory Management

**Typed Arrays:**
- Use Float32Array for position/animation data
- Use Uint8Array for discrete types/flags
- Pre-allocate arrays at max pool size
- Mark attributes with `DynamicDrawUsage` for frequent updates

**Update Flags:**
- Only set `needsUpdate = true` when data actually changes
- Batch updates per frame (don't update per particle)
- Use dirty flags to track which attributes changed

**Free Slot Management:**
- Maintain a stack of free slots for O(1) allocation
- Push freed slots back onto stack for reuse
- Initialize free slots in reverse order (pop from end)

### TSL Shader Patterns

**Billboard Orientation:**
```typescript
const camRight = uniform(new THREE.Vector3(1, 0, 0));
const camUp = uniform(new THREE.Vector3(0, 1, 0));

// Update per frame
camera.matrixWorld.extractBasis(right, up, fwd);
this.uCameraRight.value.copy(right);
this.uCameraUp.value.copy(up);

// In shader
const billboardOffset = add(
  mul(mul(localXY.x, size), camRight),
  mul(mul(localXY.y, size), camUp)
);
material.positionNode = add(particleCenter, billboardOffset);
```

**Parabolic Arc Motion:**
```typescript
// y = peakHeight * 4 * t * (1-t), peaks at t=0.5
const arcY = mul(peakHeight, mul(float(4), mul(t, sub(float(1), t))));
```

**Fade Envelopes:**
```typescript
// Fast fade in, smooth fade out
const fadeIn = min(mul(t, float(12)), float(1));
const fadeOut = pow(sub(float(1), t), float(1.2));
material.opacityNode = mul(texAlpha, mul(fadeIn, fadeOut));
```

**Twinkle Effect:**
```typescript
// Dual-frequency sine product for organic sparkle
const twinkle = max(
  float(0),
  mul(
    sin(add(mul(time, float(8)), mul(angle, float(5)))),
    sin(add(mul(time, float(13)), mul(angle, float(3))))
  )
);
```

## Texture Generation

### Glow Texture

**Purpose**: Soft radial gradient for particle billboards

**Parameters:**
- `size`: Texture resolution (64x64 typical)
- `sharpness`: Falloff exponent (2.0 = soft, 3.5 = sharp)

**Algorithm:**
```typescript
const dist = Math.sqrt(dx*dx + dy*dy);
const falloff = Math.max(0, 1 - dist);
const strength = Math.pow(falloff, sharpness);
alpha = strength;
```

### Ring Texture

**Purpose**: Gaussian ring pattern for water ripples

**Parameters:**
- `size`: Texture resolution (64x64 typical)
- `ringRadius`: Ring center distance (0.65 = outer ring)
- `ringWidth`: Ring thickness (0.22 = medium band)

**Algorithm:**
```typescript
const ringDist = Math.abs(dist - ringRadius) / ringWidth;
const strength = Math.exp(-ringDist * ringDist * 4);
const edgeFade = Math.min(Math.max((1 - dist) * 5, 0), 1);
alpha = strength * edgeFade;
```

## Lifecycle Management

### Registration Flow

1. **Entity Creation**: ResourceEntity creates fishing spot visual
2. **Lazy Registration**: Entity calls `tryRegisterWithParticleManager()`
3. **Manager Routing**: ParticleManager routes to WaterParticleManager
4. **Slot Allocation**: WaterParticleManager allocates slots from free pools
5. **Data Write**: Per-instance data written to InstancedBufferAttributes
6. **Update Flag**: Attributes marked `needsUpdate = true`

### Timing Edge Cases

**Problem**: Entity initialization may run before ResourceSystem.start() creates ParticleManager.

**Solution**: Lazy registration pattern
- Try registration during `createFishingSpotVisual()`
- Retry from `clientUpdate()` if manager wasn't ready
- Log success: "Late registration succeeded for {id}"

### Cleanup Flow

1. **Entity Disposal**: ResourceEntity calls `unregister()`
2. **Manager Routing**: ParticleManager routes to correct sub-manager
3. **Slot Release**: Sub-manager clears particle data and returns slots to free pool
4. **Ownership Clear**: ParticleManager removes from ownership map

## Integration Points

### ResourceSystem

**Initialization:**
```typescript
// Create particle manager on client
if (!this.world.isServer) {
  const scene = this.world.stage?.scene;
  if (scene) {
    this.particleManager = new ParticleManager(scene);
    
    // Retroactively register existing fishing spots
    const existingEntities = this.world.entities?.getByType?.("resource") || [];
    for (const entity of existingEntities) {
      if (entity instanceof ResourceEntity && 
          entity.config?.resourceType === "fishing_spot") {
        entity.tryRegisterWithParticleManager();
      }
    }
  }
}
```

**Event Subscription:**
```typescript
this.subscribe(EventType.RESOURCE_SPAWNED, (data) => {
  this.particleManager?.handleResourceEvent(data);
});
```

**Per-Frame Update:**
```typescript
update(dt: number): void {
  if (this.particleManager) {
    const camera = this.world.camera;
    if (camera) {
      this.particleManager.update(dt, camera);
    }
  }
}
```

### ResourceEntity

**Registration:**
```typescript
private createFishingSpotVisual(): void {
  // Create glow indicator (interaction hitbox)
  this.createGlowIndicator();
  
  // Register with centralized particle manager
  this.tryRegisterWithParticleManager();
  
  // Register for frame updates (glow pulse + lazy registration)
  this.world.setHot(this, true);
}

public tryRegisterWithParticleManager(): boolean {
  if (this._registeredWithParticleManager) return true;
  
  const pm = this.getParticleManager();
  if (!pm) return false;
  
  const pos = this.getPosition();
  pm.registerSpot({
    entityId: this.id,
    position: {x: pos.x, y: pos.y, z: pos.z},
    resourceType: this.config.resourceType || "",
    resourceId: this.config.resourceId || "",
  });
  this._registeredWithParticleManager = true;
  return true;
}
```

**Cleanup:**
```typescript
dispose(): void {
  if (this.config.resourceType === "fishing_spot") {
    if (this._registeredWithParticleManager) {
      const pm = this.getParticleManager();
      if (pm) {
        pm.unregisterSpot(this.id, this.config.resourceType || "");
      }
      this._registeredWithParticleManager = false;
    }
    this.world.setHot(this, false);
  }
  
  // Clean up glow mesh
  if (this.glowMesh) {
    this.glowMesh.geometry.dispose();
    (this.glowMesh.material as THREE.Material).dispose();
    this.node.remove(this.glowMesh);
    this.glowMesh = undefined;
  }
}
```

## Fishing Spot Burst System

**Purpose**: Periodic fish activity bursts for visual interest

**Mechanism:**
- Each fishing spot has a `burstTimer` countdown
- When timer expires, fires `burstSplashCount` particles simultaneously
- Particles cluster around a random point with slight spread
- Timer resets to random interval between `burstIntervalMin` and `burstIntervalMax`

**Implementation:**
```typescript
// Update burst timer
spot.burstTimer -= dt;
if (spot.burstTimer <= 0) {
  const v = spot.variant;
  spot.burstTimer = v.burstIntervalMin + 
    Math.random() * (v.burstIntervalMax - v.burstIntervalMin);
  this.fireBurst(spot);
}

// Fire burst
private fireBurst(spot: ActiveSpot): void {
  const burstAngle = Math.random() * Math.PI * 2;
  const burstR = 0.05 + Math.random() * 0.15;
  const cx = Math.cos(burstAngle) * burstR;
  const cz = Math.sin(burstAngle) * burstR;
  
  // Reset splash particles that are >60% through their lifetime
  for (const s of spot.splashSlots) {
    const t = L.ageLifetimeArr[s*2] / L.ageLifetimeArr[s*2+1];
    if (t > 0.6) {
      L.ageLifetimeArr[s*2] = 0; // Reset age
      // Cluster around burst center with spread
      L.angleRadiusArr[s*2] = Math.atan2(
        cz + (Math.random()-0.5)*0.06,
        cx + (Math.random()-0.5)*0.06
      );
      // ... update other attributes
    }
  }
}
```

## Texture Caching

**Purpose**: Avoid duplicate DataTexture creation for identical parameters

**Implementation:**
```typescript
private static textureCache = new Map<string, THREE.DataTexture>();

private static createGlowTexture(size: number, sharpness: number): THREE.DataTexture {
  const key = `glow:${size}:${sharpness}`;
  const cached = ResourceEntity.textureCache.get(key);
  if (cached) return cached;
  
  // Generate texture...
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  ResourceEntity.textureCache.set(key, tex);
  return tex;
}

// Cleanup on world teardown
static disposeSharedResources(): void {
  for (const tex of ResourceEntity.textureCache.values()) {
    tex.dispose();
  }
  ResourceEntity.textureCache.clear();
}
```

## Migration Guide

### From Per-Entity Particles to ParticleManager

**Before:**
```typescript
// ResourceEntity.ts
private particleMeshes: THREE.Mesh[] = [];
private particleState: FishingParticleState | null = null;

private createFishingSpotParticles(variant): void {
  for (let i = 0; i < variant.splashCount; i++) {
    const particle = new THREE.Mesh(geometry, material);
    scene.add(particle);
    this.particleMeshes.push(particle);
  }
}

protected clientUpdate(deltaTime: number): void {
  for (let i = 0; i < this.particleState.ages.length; i++) {
    this.particleState.ages[i] += deltaTime;
    const particle = this.particleMeshes[i];
    // CPU animation: position, rotation, opacity...
  }
}
```

**After:**
```typescript
// ResourceEntity.ts
private _registeredWithParticleManager = false;

private createFishingSpotVisual(): void {
  this.createGlowIndicator();
  this.tryRegisterWithParticleManager();
  this.world.setHot(this, true);
}

public tryRegisterWithParticleManager(): boolean {
  if (this._registeredWithParticleManager) return true;
  const pm = this.getParticleManager();
  if (!pm) return false;
  
  pm.register(this.id, {
    type: "water",
    position: this.getPosition(),
    resourceId: this.config.resourceId || "",
  });
  this._registeredWithParticleManager = true;
  return true;
}

protected clientUpdate(_deltaTime: number): void {
  // Only glow pulse animation remains
  if (this.glowMesh) {
    const pulse = 0.18 + Math.sin(Date.now() * 0.0015) * 0.04;
    this.glowMesh.material.opacity = pulse;
  }
}
```

## Performance Characteristics

### Draw Call Reduction

**Before:**
- 10 fishing spots × 15 meshes/spot = 150 draw calls
- Each mesh: separate material, geometry, transform

**After:**
- 4 draw calls total (splash, bubble, shimmer, ripple layers)
- All fishing spots share 4 InstancedMesh objects
- GPU handles per-instance transforms

### CPU Savings

**Before:**
- Per-frame loops over all particles
- Trigonometry (sin, cos, atan2) per particle
- Quaternion copies for billboard orientation
- Opacity writes per particle

**After:**
- Single attribute buffer update per layer
- All math computed in GPU shader
- No per-particle CPU overhead

### Memory Footprint

**Before:**
- 10-21 THREE.Mesh objects per fishing spot
- 10-21 THREE.Material instances per spot
- Shared geometry (1 CircleGeometry)

**After:**
- 4 InstancedMesh objects total (shared by all spots)
- 4 TSL NodeMaterial instances total
- Per-spot data: ~200 bytes (slot indices + variant config)

## Debugging

### Visual Inspection

**Check particle counts:**
```typescript
console.log(`Splash: ${splashLayer.maxInstances - splashLayer.freeSlots.length}/${splashLayer.maxInstances}`);
console.log(`Bubble: ${bubbleLayer.maxInstances - bubbleLayer.freeSlots.length}/${bubbleLayer.maxInstances}`);
```

**Verify registration:**
```typescript
console.log(`Active spots: ${this.activeSpots.size}`);
for (const [id, spot] of this.activeSpots) {
  console.log(`  ${id}: ${spot.splashSlots.length}S + ${spot.bubbleSlots.length}B`);
}
```

### Common Issues

**Particles not appearing:**
- Check if ParticleManager was created (client-only)
- Verify ResourceSystem.start() was called
- Check console for "Late registration succeeded" messages
- Ensure camera is passed to update()

**Particles frozen:**
- Verify update() is called per frame
- Check if dt (deltaTime) is non-zero
- Ensure ageLifetime attributes are being updated

**Particles in wrong location:**
- Check if spotPos attributes are updated on move
- Verify position normalization in register/move calls
- Check for stale position data in entity

## Future Enhancements

### Planned Particle Types

- **Fire**: Flame particles for campfires, torches, furnaces
- **Magic**: Spell effects, enchantment glows, rune altars
- **Dust**: Mining debris, woodcutting chips, smithing sparks
- **Weather**: Rain, snow, fog particles
- **Combat**: Blood splatter, impact effects, projectile trails

### Optimization Opportunities

- **Compute Shaders**: Move particle simulation to compute shaders for even better performance
- **Texture Atlasing**: Pack multiple particle textures into single atlas
- **LOD System**: Reduce particle count/quality at distance
- **Frustum Culling**: Disable particles outside camera view
- **Occlusion Culling**: Disable particles behind terrain/buildings

## References

- **PR #877**: Original particle system refactor
- **Commit 4168f2f**: Centralized ParticleManager implementation
- **WaterParticleManager**: `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`
- **GlowParticleManager**: `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`
- **ParticleManager**: `packages/shared/src/entities/managers/particleManager/ParticleManager.ts`
- **ResourceSystem**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`
- **ResourceEntity**: `packages/shared/src/entities/world/ResourceEntity.ts`
