# ParticleManager Architecture

## Overview

The ParticleManager is a centralized GPU-instanced particle rendering system introduced in PR #877 (commit 4168f2f). It replaces per-entity CPU particle animation with a unified GPU-driven architecture, achieving massive performance improvements.

## Performance Impact

**Before (per-entity CPU particles):**
- ~150 draw calls for fishing spot effects
- ~450 lines of per-frame CPU animation code
- Heavy CPU usage: trig calculations, quaternion copies, opacity writes
- FPS: 65-70 on reference hardware

**After (GPU-instanced ParticleManager):**
- 4 draw calls total (97% reduction)
- GPU-computed animations via TSL shaders
- Zero per-frame CPU overhead for particle animation
- FPS: 120 on reference hardware (74% improvement)

## Architecture

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash layer (InstancedMesh, parabolic arcs)
│   ├── Bubble layer (InstancedMesh, rise + wobble)
│   ├── Shimmer layer (InstancedMesh, surface twinkle)
│   └── Ripple layer (InstancedMesh, expanding rings)
└── [Future managers: fire, magic, dust, etc.]
```

## Components

### 1. ParticleManager

**Location**: `packages/shared/src/entities/managers/particleManager/ParticleManager.ts`

**Responsibilities:**
- Central entry point for all particle systems
- Routes events to specialized sub-managers based on resource type
- Manages lifecycle (register, unregister, move, update, dispose)
- Extensible architecture for adding new particle types

**API:**
```typescript
// Register a particle-emitting spot
registerSpot(config: ParticleSpotConfig): void

// Unregister a spot
unregisterSpot(entityId: string, resourceType: string): void

// Move an existing spot's position
moveSpot(entityId: string, resourceType: string, newPos: Vector3): void

// Handle resource events (e.g., RESOURCE_SPAWNED)
handleResourceEvent(data: ParticleResourceEvent): void

// Per-frame update (drives all sub-managers)
update(dt: number, camera: THREE.Camera): void

// Cleanup
dispose(): void
```

### 2. WaterParticleManager

**Location**: `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`

**Responsibilities:**
- GPU-instanced rendering for fishing spot effects
- 4 InstancedMeshes with TSL NodeMaterials
- Per-instance animation data via InstancedBufferAttributes
- Fishing spot variant management (net, bait, fly)

**Particle Layers:**

| Layer | Count | Animation | Purpose |
|-------|-------|-----------|---------|
| Splash | 96 max | Parabolic arcs | Water droplets popping up |
| Bubble | 72 max | Rise + wobble | Gentle rise from below surface |
| Shimmer | 72 max | Surface twinkle | Sparkles on water plane |
| Ripple | 24 max | Expanding rings | Concentric water ripples |

**Per-Instance Data:**

Each particle instance stores:
- `spotPos` (vec3) - Fishing spot world center
- `ageLifetime` (vec2) - Current age (x), total lifetime (y)
- `angleRadius` (vec2) - Polar angle (x), radial distance (y)
- `dynamics` (vec4) - Peak height (x), size (y), speed (z), direction (w)

Ripple instances store:
- `spotPos` (vec3) - Fishing spot world center
- `rippleParams` (vec2) - Phase offset (x), ripple speed (y)

**Vertex Buffer Budget:**
- Particle layers: 7 of 8 max attributes
  - position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + ageLifetime(1) + angleRadius(1) + dynamics(1)
- Ripple layer: 5 of 8 max attributes
  - position(1) + uv(1) + instanceMatrix(1) + spotPos(1) + rippleParams(1)

**TSL Shader Features:**
- Billboard orientation (camera-facing)
- Parabolic arc trajectories (splash)
- Lateral wobble (bubbles)
- Twinkle animation (shimmer)
- Ring expansion with fade (ripples)
- All computed on GPU per frame

**Fishing Spot Variants:**

| Variant | Ripples | Splash | Bubble | Shimmer | Burst Interval | Description |
|---------|---------|--------|--------|---------|----------------|-------------|
| Net | 2 | 4 | 3 | 3 | 5-10s | Calm, gentle (shallow water) |
| Bait | 2 | 5 | 4 | 4 | 3-7s | Medium activity (default) |
| Fly | 2 | 8 | 5 | 5 | 2-5s | Active (river/moving water) |

### 3. ResourceSystem Integration

**Location**: `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

**Changes:**
- Creates `ParticleManager` on client startup (in `start()` method)
- Retroactively registers existing fishing spot entities
- Subscribes to `RESOURCE_SPAWNED` events and routes to ParticleManager
- Calls `particleManager.update(dt, camera)` per frame
- Disposes ParticleManager on system shutdown

**Code:**
```typescript
// CLIENT: Create centralized particle hub for all particle effects
if (!this.world.isServer) {
  const scene = this.world.stage?.scene;
  if (scene) {
    this.particleManager = new ParticleManager(scene as any);

    // Retroactively register any fishing spot entities created before this system started
    const existingEntities = this.world.entities?.getByType?.("resource") || [];
    for (const entity of existingEntities) {
      if (
        entity instanceof ResourceEntity &&
        entity.config?.resourceType === "fishing_spot"
      ) {
        entity.tryRegisterWithParticleManager();
      }
    }
  }

  // Listen for resource events and route them through the particle hub
  this.subscribe(
    EventType.RESOURCE_SPAWNED,
    (data: { id?: string; type?: string; position?: Vector3 }) => {
      this.particleManager?.handleResourceEvent(data);
    },
  );
}
```

### 4. ResourceEntity Delegation

**Location**: `packages/shared/src/entities/world/ResourceEntity.ts`

**Changes:**
- Removed ~450 lines of CPU particle animation code
- Removed per-entity particle meshes and ripple rings
- Delegates to ParticleManager via `tryRegisterWithParticleManager()`
- Retains only lightweight glow mesh for interaction detection
- Lazy registration pattern handles timing/lifecycle edge cases

**Lifecycle:**
1. `createFishingSpotVisual()` - Creates glow mesh, attempts ParticleManager registration
2. `tryRegisterWithParticleManager()` - Registers with ParticleManager if available
3. `clientUpdate()` - Retries registration if manager wasn't ready, animates glow pulse
4. `dispose()` - Unregisters from ParticleManager, cleans up glow mesh

**Lazy Registration Pattern:**

The entity attempts registration during `createFishingSpotVisual()`, but the ParticleManager may not exist yet (timing/lifecycle issue where entity init runs before ResourceSystem.start()). The entity retries registration from `clientUpdate()` until successful.

```typescript
protected clientUpdate(_deltaTime: number): void {
  super.clientUpdate(_deltaTime);

  // Lazy registration: retry if particle manager wasn't ready during createFishingSpotVisual
  if (
    !this._registeredWithParticleManager &&
    this.config.resourceType === "fishing_spot"
  ) {
    if (this.tryRegisterWithParticleManager()) {
      console.log(`[FishingSpot] Late registration succeeded for ${this.id}`);
    }
  }

  // Organic glow pulse — two frequencies layered for natural breathing
  if (this.glowMesh) {
    const now = Date.now();
    const slow = Math.sin(now * 0.0015) * 0.04;
    const fast = Math.sin(now * 0.004 + 1.3) * 0.02;
    const pulse = 0.18 + slow + fast;
    (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
  }
}
```

## Adding New Particle Types

To add a new particle type (e.g., fire, magic, dust):

1. **Create a sub-manager class** in `packages/shared/src/entities/managers/particleManager/`
   ```typescript
   export class FireParticleManager {
     constructor(scene: THREE.Scene) { ... }
     registerSpot(config: ParticleSpotConfig): void { ... }
     unregisterSpot(entityId: string): void { ... }
     moveSpot(entityId: string, newPos: Vector3): void { ... }
     update(dt: number, camera: THREE.Camera): void { ... }
     dispose(): void { ... }
   }
   ```

2. **Instantiate in ParticleManager constructor**
   ```typescript
   constructor(scene: THREE.Scene) {
     this.waterManager = new WaterParticleManager(scene);
     this.fireManager = new FireParticleManager(scene);
   }
   ```

3. **Add routing logic** in ParticleManager methods
   ```typescript
   registerSpot(config: ParticleSpotConfig): void {
     if (this.isWaterType(config.resourceType)) {
       this.waterManager.registerSpot(config);
       return;
     }
     if (this.isFireType(config.resourceType)) {
       this.fireManager.registerSpot(config);
       return;
     }
   }
   ```

4. **Call update() and dispose()** from ParticleManager
   ```typescript
   update(dt: number, camera: THREE.Camera): void {
     this.waterManager.update(dt, camera);
     this.fireManager.update(dt, camera);
   }

   dispose(): void {
     this.waterManager.dispose();
     this.fireManager.dispose();
   }
   ```

## Technical Details

### TSL Shader Implementation

The WaterParticleManager uses Three.js Shading Language (TSL) NodeMaterials for GPU-computed animations:

**Splash Particles:**
```typescript
// Parabolic arc trajectory
const arcY = mul(peakHeight, mul(float(4), mul(t, sub(float(1), t))));
const ox = mul(cos(angle), radius);
const oz = mul(sin(angle), radius);
particleCenter = add(spotPos, vec3(ox, add(float(0.08), arcY), oz));

// Snappy pop-in, smooth fade-out
const fadeIn = min(mul(t, float(12)), float(1));
const fadeOut = pow(sub(float(1), t), float(1.2));
material.opacityNode = mul(texAlpha, mul(float(0.9), mul(fadeIn, fadeOut)));
```

**Bubble Particles:**
```typescript
// Gentle rise with lateral wobble
const riseY = mul(t, peakHeight);
const wobbleFreq = mul(direction, float(4.0));
const drift = mul(sin(add(angle, mul(t, wobbleFreq))), radius);
particleCenter = add(spotPos, vec3(drift, add(float(0.03), riseY), driftZ));
```

**Shimmer Particles:**
```typescript
// Fast twinkle using global time
const twinkle = max(
  float(0),
  mul(
    sin(add(mul(time, float(8)), mul(angle, float(5)))),
    sin(add(mul(time, float(13)), mul(angle, float(3)))),
  ),
);
const envelope = mul(
  min(mul(t, float(4)), float(1)),
  min(mul(sub(float(1), t), float(4)), float(1)),
);
material.opacityNode = mul(texAlpha, mul(float(0.85), mul(twinkle, envelope)));
```

**Ripple Rings:**
```typescript
// Expanding ring with phase-based fade
const phase = fract(add(mul(time, mul(rippleSpeed, float(0.5))), phaseOffset));
const scale = add(float(0.15), mul(phase, float(1.3)));

// Early fade-in, late fade-out
const earlyFade = mul(div(phase, float(0.15)), float(0.55));
const lateFade = mul(
  float(0.55),
  pow(sub(float(1), div(sub(phase, float(0.15)), float(0.85))), float(1.5)),
);
const rippleOpacity = mix(earlyFade, lateFade, step(float(0.15), phase));
```

### Billboard Orientation

All particle layers use camera-facing billboards:

```typescript
const camRight = uniform(new THREE.Vector3(1, 0, 0));
const camUp = uniform(new THREE.Vector3(0, 1, 0));

// Update per frame
camera.matrixWorld.extractBasis(right, up, fwd);
this.uCameraRight.value.copy(right);
this.uCameraUp.value.copy(up);

// Shader: billboard offset
const billboardOffset = add(
  mul(mul(localXY.x, size), camRight),
  mul(mul(localXY.y, size), camUp),
);
material.positionNode = add(particleCenter, billboardOffset);
```

### Texture Generation

**Glow Texture** (soft radial gradient):
```typescript
private createGlowTexture(size: number, sharpness: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - dist);
      const strength = Math.pow(falloff, sharpness);
      // ... write RGBA data
    }
  }
  return new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
}
```

**Ring Texture** (Gaussian ring pattern):
```typescript
private createRingTexture(
  size: number,
  ringRadius: number,
  ringWidth: number,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Gaussian falloff around ring radius
      const ringDist = Math.abs(dist - ringRadius) / ringWidth;
      const strength = Math.exp(-ringDist * ringDist * 4);
      
      // Soft fade at outer boundary
      const edgeFade = Math.min(Math.max((1 - dist) * 5, 0), 1);
      const alpha = strength * edgeFade;
      // ... write RGBA data
    }
  }
  return new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
}
```

## Integration Points

### ResourceSystem

**Initialization:**
```typescript
// packages/shared/src/systems/shared/entities/ResourceSystem.ts
start(): void {
  // ... existing code ...

  // CLIENT: Create centralized particle hub for all particle effects
  if (!this.world.isServer) {
    const scene = this.world.stage?.scene;
    if (scene) {
      this.particleManager = new ParticleManager(scene as any);

      // Retroactively register any fishing spot entities created before this system started
      const existingEntities = this.world.entities?.getByType?.("resource") || [];
      for (const entity of existingEntities) {
        if (
          entity instanceof ResourceEntity &&
          entity.config?.resourceType === "fishing_spot"
        ) {
          entity.tryRegisterWithParticleManager();
        }
      }
    }

    // Listen for resource events and route them through the particle hub
    this.subscribe(
      EventType.RESOURCE_SPAWNED,
      (data: { id?: string; type?: string; position?: Vector3 }) => {
        this.particleManager?.handleResourceEvent(data);
      },
    );
  }
}

update(dt: number): void {
  if (this.particleManager) {
    const camera = this.world.camera;
    if (camera) {
      this.particleManager.update(dt, camera);
    }
  }
}

dispose(): void {
  // ... existing code ...

  // Dispose centralized particle manager (client only)
  if (this.particleManager) {
    this.particleManager.dispose();
    this.particleManager = undefined;
  }

  // Dispose shared GPU resources (cached textures) used by fishing spot glow
  ResourceEntity.disposeSharedResources();
}
```

### ResourceEntity

**Delegation Pattern:**
```typescript
// packages/shared/src/entities/world/ResourceEntity.ts
private createFishingSpotVisual(): void {
  // Create the glow indicator (interaction hitbox + distant visibility)
  this.createGlowIndicator();

  // Try to register with centralized particle manager (may not exist yet)
  this.tryRegisterWithParticleManager();

  // Register for frame updates (glow pulse + lazy particle registration)
  this.world.setHot(this, true);
}

public tryRegisterWithParticleManager(): boolean {
  if (this._registeredWithParticleManager) return true;

  const pm = this.getParticleManager();
  if (!pm) return false;

  const pos = this.getPosition();
  pm.registerSpot({
    entityId: this.id,
    position: { x: pos.x, y: pos.y, z: pos.z },
    resourceType: this.config.resourceType || "",
    resourceId: this.config.resourceId || "",
  });
  this._registeredWithParticleManager = true;
  return true;
}

private getParticleManager(): ParticleManager | undefined {
  const sys = this.world.getSystem("resource") as {
    particleManager?: ParticleManager;
  } | null;
  return sys?.particleManager;
}

dispose(): void {
  // ... existing code ...

  // Clean up fishing spot resources
  if (this.config.resourceType === "fishing_spot") {
    // Unregister from centralized particle manager
    if (this._registeredWithParticleManager) {
      const pm = this.getParticleManager();
      if (pm) {
        pm.unregisterSpot(this.id, this.config.resourceType || "");
      }
      this._registeredWithParticleManager = false;
    }

    // Unregister from frame updates (glow pulse)
    this.world.setHot(this, false);
  }

  // ... existing code ...
}
```

## Future Extensions

The ParticleManager architecture is designed to be extensible. Planned particle types:

- **Fire particles** - Campfires, torches, explosions
- **Magic particles** - Spell effects, enchantments, teleports
- **Dust particles** - Mining, woodcutting, footsteps
- **Weather particles** - Rain, snow, fog
- **Combat particles** - Blood splatter, impact effects

Each new particle type follows the same pattern:
1. Create specialized manager class
2. Implement InstancedMesh + TSL materials
3. Add routing logic to ParticleManager
4. Wire into relevant systems (combat, skills, weather, etc.)

## Performance Considerations

**Memory:**
- Each InstancedMesh pre-allocates max instances (96 splash, 72 bubble, 72 shimmer, 24 ripple)
- Total memory: ~264 instances × 7-8 attributes × 4 bytes = ~7-9 KB per fishing spot type
- Shared across all fishing spots (not per-entity)

**CPU:**
- Zero per-frame CPU overhead for particle animation (all GPU-computed)
- Only CPU work: updating InstancedBufferAttribute needsUpdate flags
- Burst system: occasional particle respawn (every 3-10 seconds)

**GPU:**
- 4 draw calls total (vs. ~150 before)
- Vertex shader computes: billboard orientation, trajectories, wobble, twinkle
- Fragment shader computes: fade curves, opacity, color

**Scalability:**
- Supports up to 264 concurrent fishing spots before hitting instance limits
- Can increase MAX_SPLASH/BUBBLE/SHIMMER/RIPPLE constants if needed
- GPU memory usage scales linearly with max instances, not active spots

## Testing

**Test Coverage:**
- ParticleManager registration/unregister lifecycle
- WaterParticleManager particle allocation/deallocation
- Lazy registration pattern (entity init before ResourceSystem.start)
- Fishing spot variant configuration
- GPU resource cleanup on dispose

**Visual Testing:**
- Verify particle animations match previous CPU implementation
- Check billboard orientation (camera-facing)
- Validate fade curves and opacity
- Confirm no visual artifacts or flickering

## Migration Notes

**Breaking Changes:**
- None - fully backward compatible
- Existing fishing spots automatically use new ParticleManager
- No changes required to world data or manifests

**Performance Impact:**
- Immediate 97% draw call reduction
- 74% FPS improvement on reference hardware
- Zero CPU overhead for particle animation

**Rollback:**
- If issues arise, revert PR #877 (commit 4168f2f)
- Old CPU particle code is preserved in git history

## References

- **PR #877**: https://github.com/HyperscapeAI/hyperscape/pull/877
- **Commit**: 4168f2f
- **Author**: tcm390
- **Files Changed**: 6 files (+1161/-597 lines)
  - `packages/shared/src/entities/managers/index.ts`
  - `packages/shared/src/entities/managers/particleManager/ParticleManager.ts` (new)
  - `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts` (new)
  - `packages/shared/src/entities/managers/particleManager/index.ts` (new)
  - `packages/shared/src/entities/world/ResourceEntity.ts` (refactored)
  - `packages/shared/src/systems/shared/entities/ResourceSystem.ts` (updated)
