# ParticleManager Architecture

**GPU-Instanced Particle System for Hyperscape**

## Overview

The ParticleManager is a centralized GPU-instanced particle rendering system introduced in PR #877 (commit 4168f2f). It replaces per-entity CPU particle animation with a unified architecture that dramatically reduces draw calls and improves performance.

## Performance Impact

**Before ParticleManager:**
- Each fishing spot created 10-21 individual `THREE.Mesh` objects
- ~150 draw calls for particle rendering
- ~450 lines of per-frame CPU animation code (trig, quaternion copies, opacity writes)
- FPS: 65-70 on reference hardware

**After ParticleManager:**
- 4 GPU InstancedMeshes for all fishing spots
- 4 draw calls total (97% reduction)
- All animation computed on GPU via TSL shaders
- FPS: 120 on reference hardware

## Architecture

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash layer (InstancedMesh, parabolic arcs)
│   ├── Bubble layer (InstancedMesh, rise + wobble)
│   ├── Shimmer layer (InstancedMesh, surface twinkle)
│   └── Ripple layer (InstancedMesh, expanding rings)
├── GlowParticleManager (altar, fire, etc.)
│   └── Glow billboards (InstancedMesh, additive blending)
└── [Future managers: fire, magic, dust, etc.]
```

## Core Components

### 1. ParticleManager

**Location:** `packages/shared/src/entities/managers/particleManager/ParticleManager.ts`

**Purpose:** Central entry point and router for all particle systems.

**Key Features:**
- Discriminated union config (`ParticleConfig`) for type-safe registration
- Ownership map tracks which sub-manager owns each emitter
- No type hints required for `unregister()` or `move()` - ownership map resolves automatically
- Extensible architecture for adding new particle types

**API:**
```typescript
// Register a particle emitter
particleManager.register(id: string, config: ParticleConfig): void

// Unregister (no type hint needed)
particleManager.unregister(id: string): void

// Move to new position (no type hint needed)
particleManager.move(id: string, newPos: {x, y, z}): void

// Per-frame update
particleManager.update(dt: number, camera: THREE.Camera): void

// Cleanup
particleManager.dispose(): void
```

**Config Types:**
```typescript
// Water particles (fishing spots)
interface WaterParticleConfig {
  type: "water";
  position: { x: number; y: number; z: number };
  resourceId: string;
}

// Glow particles (altar, fire, etc.)
interface GlowParticleConfig {
  type: "glow";
  preset: GlowPreset;
  position: { x: number; y: number; z: number };
  color?: number | { core: number; mid: number; outer: number };
  meshRoot?: THREE.Object3D;
  modelScale?: number;
  modelYOffset?: number;
}

type ParticleConfig = WaterParticleConfig | GlowParticleConfig;
```

### 2. WaterParticleManager

**Location:** `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`

**Purpose:** GPU-instanced rendering for fishing spot water effects.

**Layers:**

1. **Splash Layer** (MAX_SPLASH = 96 instances)
   - Parabolic arc animation: `y = peakHeight * 4 * t * (1-t)`
   - Radial distribution from spot center
   - Fast fade-in, smooth fade-out
   - Burst system: periodic fish activity clusters

2. **Bubble Layer** (MAX_BUBBLE = 72 instances)
   - Gentle rise from below water surface
   - Lateral wobble with frequency modulation
   - Longer lifetime than splash (1.2-2.5s)

3. **Shimmer Layer** (MAX_SHIMMER = 72 instances)
   - Surface sparkle on water plane
   - Fast twinkle using global time + per-particle phase
   - Circular wander pattern

4. **Ripple Layer** (MAX_RIPPLE = 24 instances)
   - Expanding ring geometry (CircleGeometry)
   - Phase-based scale and opacity animation
   - Ring texture with Gaussian falloff

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
- Billboard orientation computed on GPU using camera right/up vectors
- Parabolic arcs for splash particles
- Wobble/drift for bubbles
- Twinkle animation for shimmer
- Ring expansion and fade for ripples
- All opacity/fade curves computed in shader

**Fishing Spot Variants:**

Based on `resourceId` string matching:

| Variant | Ripples | Splash | Bubble | Shimmer | Burst Interval | Activity |
|---------|---------|--------|--------|---------|----------------|----------|
| Net (`resourceId.includes("net")`) | 2 | 4 | 3 | 3 | 5-10s | Calm/gentle |
| Bait (default) | 2 | 5 | 4 | 4 | 3-7s | Medium |
| Fly (`resourceId.includes("fly")`) | 2 | 8 | 5 | 5 | 2-5s | Active |

**Burst System:**
- Periodic fish activity creates simultaneous splash clusters
- Timer countdown per fishing spot
- Fires 2-4 splash particles from a random point near spot center
- Adds visual variety and liveliness

### 3. GlowParticleManager

**Location:** `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`

**Purpose:** GPU-instanced glow billboards for altars, fires, and other glowing effects.

**Features:**
- Additive blending for glow effect
- Preset-based configuration (altar, fire, etc.)
- Color override support (single hex or three-tone palette)
- Geometry-aware spark placement for altar preset
- Model scale and Y-offset support

### 4. ResourceSystem Integration

**Location:** `packages/shared/src/systems/shared/entities/ResourceSystem.ts`

**Changes:**
- Creates `ParticleManager` on client startup
- Retroactively registers any fishing spot entities created before system started
- Listens for `RESOURCE_SPAWNED` events and routes to particle manager
- Calls `particleManager.update(dt, camera)` per frame
- Disposes particle manager on system stop

**Code:**
```typescript
// CLIENT: Create centralized particle hub
if (!this.world.isServer) {
  const scene = this.world.stage?.scene;
  if (scene) {
    this.particleManager = new ParticleManager(scene as any);

    // Retroactively register existing fishing spots
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

  // Listen for resource events
  this.subscribe(EventType.RESOURCE_SPAWNED, (data) => {
    this.particleManager?.handleResourceEvent(data);
  });
}

// Per-frame update
update(dt: number): void {
  if (this.particleManager) {
    const camera = this.world.camera;
    if (camera) {
      this.particleManager.update(dt, camera);
    }
  }
}
```

### 5. ResourceEntity Delegation

**Location:** `packages/shared/src/entities/world/ResourceEntity.ts`

**Changes:**
- Removed per-entity particle meshes and animation state
- Removed ripple ring meshes
- Retained only lightweight glow mesh for interaction detection
- Delegates to ParticleManager via `tryRegisterWithParticleManager()`
- Lazy registration pattern handles timing/lifecycle edge cases

**Lifecycle:**
```typescript
// On creation (fishing spots only)
private createFishingSpotVisual(): void {
  this.createGlowIndicator();  // Keep for interaction hitbox
  this.tryRegisterWithParticleManager();  // Delegate particles
  this.world.setHot(this, true);  // Register for frame updates
}

// Lazy registration (retry if manager not ready)
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

// Per-frame update (glow pulse + lazy registration retry)
protected clientUpdate(_deltaTime: number): void {
  super.clientUpdate(_deltaTime);

  // Retry registration if manager wasn't ready during creation
  if (
    !this._registeredWithParticleManager &&
    this.config.resourceType === "fishing_spot"
  ) {
    if (this.tryRegisterWithParticleManager()) {
      console.log(`[FishingSpot] Late registration succeeded for ${this.id}`);
    }
  }

  // Glow pulse animation
  if (this.glowMesh) {
    const now = Date.now();
    const slow = Math.sin(now * 0.0015) * 0.04;
    const fast = Math.sin(now * 0.004 + 1.3) * 0.02;
    const pulse = 0.18 + slow + fast;
    (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
  }
}

// Cleanup
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
  // ... rest of cleanup
}
```

## Adding New Particle Types

To add a new particle type (e.g., fire, magic, dust):

1. **Create Sub-Manager Class**
   - Location: `packages/shared/src/entities/managers/particleManager/`
   - Example: `FireParticleManager.ts`
   - Implement: `registerSpot()`, `unregisterSpot()`, `moveSpot()`, `update()`, `dispose()`

2. **Update ParticleManager**
   ```typescript
   // Constructor
   constructor(scene: THREE.Scene) {
     this.waterManager = new WaterParticleManager(scene);
     this.glowManager = new GlowParticleManager(scene);
     this.fireManager = new FireParticleManager(scene);  // NEW
   }

   // Register routing
   register(id: string, config: ParticleConfig): void {
     switch (config.type) {
       case "water": /* ... */ break;
       case "glow": /* ... */ break;
       case "fire":  // NEW
         this.fireManager.registerFire(id, config);
         this.ownership.set(id, "fire");
         break;
     }
   }

   // Update
   update(dt: number, camera: THREE.Camera): void {
     this.waterManager.update(dt, camera);
     this.glowManager.update(dt, camera);
     this.fireManager.update(dt, camera);  // NEW
   }

   // Dispose
   dispose(): void {
     this.waterManager.dispose();
     this.glowManager.dispose();
     this.fireManager.dispose();  // NEW
   }
   ```

3. **Add Config Type**
   ```typescript
   interface FireParticleConfig {
     type: "fire";
     position: { x: number; y: number; z: number };
     intensity: number;
     color?: number;
   }

   type ParticleConfig = WaterParticleConfig | GlowParticleConfig | FireParticleConfig;
   ```

4. **Export from Index**
   ```typescript
   // packages/shared/src/entities/managers/particleManager/index.ts
   export { FireParticleManager } from "./FireParticleManager";
   ```

## Technical Details

### TSL Shader Node System

The particle system uses Three.js Shading Language (TSL) for GPU-computed animation:

```typescript
// Example: Splash particle billboard positioning
const spotPos = attribute("spotPos", "vec3");
const ageLifetime = attribute("ageLifetime", "vec2");
const age = ageLifetime.x;
const lifetime = ageLifetime.y;
const t = div(age, lifetime);

const angleRadius = attribute("angleRadius", "vec2");
const angle = angleRadius.x;
const radius = angleRadius.y;

const dynamics = attribute("dynamics", "vec4");
const peakHeight = dynamics.x;
const size = dynamics.y;

// Parabolic arc
const arcY = mul(peakHeight, mul(float(4), mul(t, sub(float(1), t))));
const ox = mul(cos(angle), radius);
const oz = mul(sin(angle), radius);
const particleCenter = add(spotPos, vec3(ox, add(float(0.08), arcY), oz));

// Billboard offset
const camRight = uniform(new THREE.Vector3(1, 0, 0));
const camUp = uniform(new THREE.Vector3(0, 1, 0));
const localXY = positionLocal.xy;
const billboardOffset = add(
  mul(mul(localXY.x, size), camRight),
  mul(mul(localXY.y, size), camUp)
);

material.positionNode = add(particleCenter, billboardOffset);
```

### Texture Generation

**Glow Texture:**
- Procedurally generated DataTexture with Gaussian falloff
- Configurable sharpness parameter
- Cached by generation parameters to avoid duplicates

**Ring Texture:**
- Gaussian ring pattern with transparent center
- Configurable ring radius and width
- Soft edge fade for natural look

### Memory Management

**Slot Allocation:**
- Free slot stacks (LIFO) for efficient allocation/deallocation
- Slots recycled when particles respawn
- No dynamic allocation during runtime

**Update Flags:**
- Dirty flags track which InstancedBufferAttributes need GPU upload
- Only modified attributes are marked `needsUpdate = true`
- Minimizes GPU bandwidth usage

**Example:**
```typescript
let splashALDirty = false;
let splashARDirty = false;
let splashDynDirty = false;

for (const spot of this.activeSpots.values()) {
  for (const s of spot.splashSlots) {
    const L = this.splashLayer;
    const al = L.ageLifetimeArr;
    al[s * 2] += dt;
    if (al[s * 2] >= al[s * 2 + 1]) {
      // Respawn particle
      al[s * 2] -= al[s * 2 + 1];
      al[s * 2 + 1] = 0.6 + Math.random() * 0.6;
      L.angleRadiusArr[s * 2] = Math.random() * Math.PI * 2;
      L.angleRadiusArr[s * 2 + 1] = 0.05 + Math.random() * 0.3;
      L.dynamicsArr[s * 4] = 0.12 + Math.random() * 0.2;
      splashARDirty = true;
      splashDynDirty = true;
    }
    splashALDirty = true;
  }
}

if (splashALDirty) this.splashLayer.ageLifetimeAttr.needsUpdate = true;
if (splashARDirty) this.splashLayer.angleRadiusAttr.needsUpdate = true;
if (splashDynDirty) this.splashLayer.dynamicsAttr.needsUpdate = true;
```

## Integration Points

### ResourceSystem

**Startup:**
```typescript
// Create particle manager on client
if (!this.world.isServer) {
  const scene = this.world.stage?.scene;
  if (scene) {
    this.particleManager = new ParticleManager(scene as any);
  }
}
```

**Event Routing:**
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
// Try to register with particle manager
private createFishingSpotVisual(): void {
  this.createGlowIndicator();
  this.tryRegisterWithParticleManager();
  this.world.setHot(this, true);
}
```

**Lazy Registration:**
```typescript
// Retry if manager wasn't ready during creation
protected clientUpdate(_deltaTime: number): void {
  if (
    !this._registeredWithParticleManager &&
    this.config.resourceType === "fishing_spot"
  ) {
    if (this.tryRegisterWithParticleManager()) {
      console.log(`[FishingSpot] Late registration succeeded for ${this.id}`);
    }
  }
}
```

**Cleanup:**
```typescript
dispose(): void {
  if (this._registeredWithParticleManager) {
    const pm = this.getParticleManager();
    if (pm) {
      pm.unregisterSpot(this.id, this.config.resourceType || "");
    }
    this._registeredWithParticleManager = false;
  }
}
```

## Performance Characteristics

**Draw Calls:**
- Before: ~150 draw calls (10-21 meshes per fishing spot × ~10 spots)
- After: 4 draw calls (1 per particle layer, shared across all spots)
- Reduction: 97%

**CPU Usage:**
- Before: Per-frame trig, quaternion copies, opacity writes for each particle
- After: Only age increment and dirty flag tracking
- GPU handles all position/rotation/opacity computation

**Memory:**
- Before: Individual mesh + material + geometry per particle
- After: Shared geometry + material, per-instance attribute arrays
- Reduction: ~80% memory footprint

**FPS:**
- Before: 65-70 FPS with 10 fishing spots
- After: 120 FPS with 10 fishing spots
- Improvement: 75% FPS increase

## Future Enhancements

**Planned Particle Types:**
- Fire particles (campfires, torches, explosions)
- Magic particles (spell effects, enchantments)
- Dust particles (footsteps, mining, woodcutting)
- Weather particles (rain, snow, fog)
- Combat particles (blood splatter, impact effects)

**Optimization Opportunities:**
- Frustum culling for particle layers
- LOD system for distant particle spots (reduce instance count)
- Particle pooling across multiple managers
- Compute shader for particle updates (WebGPU)

## References

- **PR #877**: [GPU-instanced fishing spot particles via centralized ParticleManager](https://github.com/HyperscapeAI/hyperscape/pull/877)
- **Commit 4168f2f**: Main implementation
- **Files Changed**: 6 files, +1161 lines, -597 lines
- **Performance Video**: See PR description for before/after comparison

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture overview
- [ResourceSystem](../packages/shared/src/systems/shared/entities/ResourceSystem.ts) - Resource spawning and management
- [ResourceEntity](../packages/shared/src/entities/world/ResourceEntity.ts) - Resource entity implementation
