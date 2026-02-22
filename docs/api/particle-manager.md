# ParticleManager API Reference

GPU-instanced particle system for efficient visual effects rendering.

## Overview

The ParticleManager provides a unified interface for managing all particle effects in Hyperscape. It uses GPU instancing and TSL NodeMaterials to render thousands of particles with minimal CPU overhead.

**Location:** `packages/shared/src/entities/managers/particleManager/`

**Performance:**
- 4 draw calls total (vs. ~150 before refactor)
- GPU-driven animation (zero CPU cost)
- Supports 264+ concurrent particle instances

## Architecture

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash particles (96 max)
│   ├── Bubble particles (72 max)
│   ├── Shimmer particles (72 max)
│   └── Ripple particles (24 max)
└── GlowParticleManager (fires, altars, torches)
    ├── Fire preset
    ├── Altar preset
    └── Torch preset
```

## ParticleManager

Central router that dispatches particle events to specialized sub-managers.

### Constructor

```typescript
constructor(scene: THREE.Scene)
```

**Parameters:**
- `scene` - Three.js scene to add particle meshes to

**Example:**
```typescript
const particleManager = new ParticleManager(scene);
```

### Methods

#### register()

Register a new particle emitter.

```typescript
register(id: string, config: ParticleConfig): void
```

**Parameters:**
- `id` - Unique identifier for this emitter
- `config` - Particle configuration (discriminated union)

**Config Types:**

**Water Particles (Fishing Spots):**
```typescript
{
  type: 'water',
  position: { x: number, y: number, z: number },
  resourceId: string  // e.g., 'fishing_spot_net'
}
```

**Glow Particles (Fires, Altars, Torches):**
```typescript
{
  type: 'glow',
  preset: 'fire' | 'altar' | 'torch',
  position: { x: number, y: number, z: number },
  color?: number | { core: number, mid: number, outer: number },
  meshRoot?: THREE.Object3D,  // For altar preset
  modelScale?: number,         // Default: 1.0
  modelYOffset?: number,       // Default: 0
}
```

**Examples:**
```typescript
// Fishing spot
particleManager.register('fishing_spot_1', {
  type: 'water',
  position: { x: 10, y: 0, z: 20 },
  resourceId: 'fishing_spot_net'
});

// Campfire
particleManager.register('fire_1', {
  type: 'glow',
  preset: 'fire',
  position: { x: 5, y: 0, z: 10 },
  color: 0xff6600
});

// Altar with geometry-aware sparks
particleManager.register('altar_1', {
  type: 'glow',
  preset: 'altar',
  position: { x: 0, y: 0, z: 0 },
  meshRoot: altarMesh,
  color: { core: 0xffffff, mid: 0x88ccff, outer: 0x4488ff }
});

// Torch
particleManager.register('torch_1', {
  type: 'glow',
  preset: 'torch',
  position: { x: 5, y: 1.5, z: 10 },
  color: 0xff6600
});
```

#### unregister()

Remove a particle emitter and free its instances.

```typescript
unregister(id: string): void
```

**Parameters:**
- `id` - Emitter identifier to remove

**Example:**
```typescript
particleManager.unregister('fishing_spot_1');
```

**Behavior:**
- Automatically routes to correct sub-manager via ownership map
- Frees all particle instances
- No type hint required

#### move()

Move an existing emitter to a new position.

```typescript
move(id: string, newPos: { x: number, y: number, z: number }): void
```

**Parameters:**
- `id` - Emitter identifier to move
- `newPos` - New world position

**Example:**
```typescript
// Move fishing spot after respawn
particleManager.move('fishing_spot_1', { x: 12, y: 0, z: 22 });
```

**Behavior:**
- Updates all particle instances to new position
- Automatically routes to correct sub-manager
- No type hint required

#### update()

Update all particle managers (call once per frame).

```typescript
update(dt: number, camera: THREE.Camera): void
```

**Parameters:**
- `dt` - Delta time in seconds
- `camera` - Active camera for billboard orientation

**Example:**
```typescript
// In your render loop
function animate() {
  const dt = clock.getDelta();
  particleManager.update(dt, camera);
  renderer.render(scene, camera);
}
```

**Behavior:**
- Updates camera right/up vectors for billboarding
- Advances particle ages and respawns expired particles
- Updates InstancedBufferAttributes (GPU upload)
- Triggers burst effects for fishing spots

#### dispose()

Clean up all particle resources.

```typescript
dispose(): void
```

**Example:**
```typescript
// On world cleanup
particleManager.dispose();
```

**Behavior:**
- Removes all meshes from scene
- Disposes geometries and materials
- Disposes textures
- Clears ownership map

## WaterParticleManager

Manages fishing spot particle effects (splash, bubble, shimmer, ripple).

### Particle Types

**Splash:**
- Parabolic arc motion
- 0.6-1.2s lifetime
- 0.05-0.3 tile radius
- 0.12-0.32 tile peak height
- Burst effects every 3-10 seconds

**Bubble:**
- Rising motion with wobble
- 1.2-2.5s lifetime
- 0.04-0.2 tile radius
- 0.3-0.55 tile rise height
- Drift with sine wave

**Shimmer:**
- Surface wandering
- 1.5-3.0s lifetime
- 0.15-0.6 tile radius
- Twinkle effect (sine wave)
- Circular motion

**Ripple:**
- Expanding ring
- Continuous loop
- 0.15-1.45 tile scale
- Ring texture with fade

### Fishing Spot Variants

**Net Fishing:**
```typescript
{
  splashCount: 4,
  bubbleCount: 3,
  shimmerCount: 3,
  rippleCount: 2,
  burstIntervalMin: 5,
  burstIntervalMax: 10,
  burstSplashCount: 2
}
```

**Fly Fishing:**
```typescript
{
  splashCount: 8,
  bubbleCount: 5,
  shimmerCount: 5,
  rippleCount: 2,
  burstIntervalMin: 2,
  burstIntervalMax: 5,
  burstSplashCount: 4
}
```

**Default (Bait):**
```typescript
{
  splashCount: 5,
  bubbleCount: 4,
  shimmerCount: 4,
  rippleCount: 2,
  burstIntervalMin: 3,
  burstIntervalMax: 7,
  burstSplashCount: 3
}
```

## GlowParticleManager

Manages instanced glow billboard particles (fires, altars, torches).

### Glow Presets

#### Fire Preset

Rising embers with heat distortion.

```typescript
{
  preset: 'fire',
  position: { x: 5, y: 0, z: 10 },
  color: 0xff6600  // Orange
}
```

**Behavior:**
- Particles rise from base position
- Chaotic motion with turbulence
- Orange/yellow color gradient
- Suitable for campfires, furnaces

#### Altar Preset

Geometry-aware sparks rising from altar mesh.

```typescript
{
  preset: 'altar',
  position: { x: 0, y: 0, z: 0 },
  meshRoot: altarMesh,
  color: { core: 0xffffff, mid: 0x88ccff, outer: 0x4488ff }
}
```

**Behavior:**
- Particles spawn on altar mesh surface
- Rise upward with slight outward drift
- Three-tone color gradient (core → mid → outer)
- Requires `meshRoot` for bounds detection

#### Torch Preset

Tight flame cluster for wall-mounted torches.

```typescript
{
  preset: 'torch',
  position: { x: 5, y: 1.5, z: 10 },
  color: 0xff6600
}
```

**Behavior:**
- 6 particles per torch
- Tight spread (0.08 radius)
- Concentrated flame effect
- Minimal horizontal drift

### Color Configuration

**Single Color:**
```typescript
color: 0xff6600  // Hex color
```

**Three-Tone Gradient:**
```typescript
color: {
  core: 0xffffff,   // Center (brightest)
  mid: 0x88ccff,    // Middle ring
  outer: 0x4488ff   // Outer edge (dimmest)
}
```

## TSL NodeMaterials

Particles use Three.js Shading Language (TSL) for GPU-driven animation.

### Vertex Shader

**Billboard Orientation:**
```typescript
// Extract camera right/up vectors
const camRight = uniform(new THREE.Vector3(1, 0, 0));
const camUp = uniform(new THREE.Vector3(0, 1, 0));

// Billboard offset
const billboardOffset = add(
  mul(mul(localXY.x, size), camRight),
  mul(mul(localXY.y, size), camUp)
);

// Final position
material.positionNode = add(particleCenter, billboardOffset);
```

**Particle Motion:**
```typescript
// Splash (parabolic arc)
const arcY = mul(peakHeight, mul(float(4), mul(t, sub(float(1), t))));
const ox = mul(cos(angle), radius);
const oz = mul(sin(angle), radius);
particleCenter = add(spotPos, vec3(ox, add(float(0.08), arcY), oz));

// Bubble (rising with wobble)
const riseY = mul(t, peakHeight);
const drift = mul(sin(add(angle, mul(t, wobbleFreq))), radius);
particleCenter = add(spotPos, vec3(drift, add(float(0.03), riseY), driftZ));

// Shimmer (circular wander)
const wanderX = mul(cos(add(angle, mul(t, freq))), radius);
const wanderZ = mul(sin(add(angle, mul(t, freq))), radius);
particleCenter = add(spotPos, vec3(wanderX, float(0.06), wanderZ));
```

### Fragment Shader

**Opacity Envelopes:**
```typescript
// Splash (quick fade in, slow fade out)
const fadeIn = min(mul(t, float(12)), float(1));
const fadeOut = pow(sub(float(1), t), float(1.2));
material.opacityNode = mul(texAlpha, mul(float(0.9), mul(fadeIn, fadeOut)));

// Shimmer (twinkle effect)
const twinkle = max(float(0), mul(
  sin(add(mul(time, float(8)), mul(angle, float(5)))),
  sin(add(mul(time, float(13)), mul(angle, float(3))))
));
const envelope = mul(
  min(mul(t, float(4)), float(1)),
  min(mul(sub(float(1), t), float(4)), float(1))
);
material.opacityNode = mul(texAlpha, mul(float(0.85), mul(twinkle, envelope)));
```

## Instance Attributes

### Particle Layers (Splash, Bubble, Shimmer)

**Vertex Buffer Layout (7 of 8 max):**
1. `position` (vec3) - Base geometry vertex position
2. `uv` (vec2) - Texture coordinates
3. `instanceMatrix` (mat4) - Instance transform (unused, identity)
4. `spotPos` (vec3) - Emitter world position
5. `ageLifetime` (vec2) - Current age (x), total lifetime (y)
6. `angleRadius` (vec2) - Polar angle (x), radial distance (y)
7. `dynamics` (vec4) - Peak height (x), size (y), speed (z), direction (w)

### Ripple Layer

**Vertex Buffer Layout (5 of 8 max):**
1. `position` (vec3) - Base geometry vertex position
2. `uv` (vec2) - Texture coordinates
3. `instanceMatrix` (mat4) - Instance transform (unused, identity)
4. `spotPos` (vec3) - Emitter world position
5. `rippleParams` (vec2) - Phase offset (x), ripple speed (y)

## Integration with ResourceSystem

The ResourceSystem automatically manages particle lifecycle for resource entities.

### Resource Spawning

```typescript
// ResourceSystem creates particles on spawn
this.particleManager.register(entityId, {
  type: 'water',
  position: entity.position,
  resourceId: entity.resourceId
});
```

### Resource Despawning

```typescript
// ResourceSystem removes particles on despawn
this.particleManager.unregister(entityId);
```

### Resource Movement

```typescript
// ResourceSystem moves particles on respawn
this.particleManager.move(entityId, newPosition);
```

### Event Routing

```typescript
// ResourceSystem forwards events to ParticleManager
world.on('RESOURCE_SPAWNED', (data) => {
  this.particleManager.handleResourceEvent(data);
});
```

## Integration with DuelArenaVisualsSystem

The DuelArenaVisualsSystem uses ParticleManager for torch fire effects.

### Torch Placement

```typescript
// Place torches at arena corners
const corners = [
  { x: minX, z: minZ },  // Southwest
  { x: maxX, z: minZ },  // Southeast
  { x: minX, z: maxZ },  // Northwest
  { x: maxX, z: maxZ },  // Northeast
];

for (const [index, corner] of corners.entries()) {
  const torchId = `torch_${arenaId}_${index}`;
  
  particleManager.register(torchId, {
    type: 'glow',
    preset: 'torch',
    position: { x: corner.x, y: 1.5, z: corner.z },
    color: 0xff6600
  });
  
  // Add point light
  const light = new THREE.PointLight(0xff6600, 2.0, 8, 2);
  light.position.set(corner.x, 1.8, corner.z);
  scene.add(light);
}
```

### Torch Cleanup

```typescript
// Remove torches when arena is destroyed
for (let i = 0; i < 4; i++) {
  particleManager.unregister(`torch_${arenaId}_${i}`);
}
```

## Performance Considerations

### Instance Limits

**Hard Limits:**
- Splash: 96 instances
- Bubble: 72 instances
- Shimmer: 72 instances
- Ripple: 24 instances

**Exceeding Limits:**
When all instances are allocated, `register()` will use fewer particles than requested. The system gracefully degrades by allocating as many instances as available.

### Memory Usage

**Per Particle Layer:**
- Geometry: ~2KB (PlaneGeometry with 2 triangles)
- Material: ~1KB (TSL NodeMaterial)
- Instance Data: ~100 bytes per instance
- Total: ~10KB per layer + (100 bytes × instance count)

**Total Memory:**
- 4 particle layers × 10KB = 40KB base
- 264 instances × 100 bytes = 26KB instance data
- Textures: 64×64×4 × 2 = 32KB
- **Total: ~100KB**

### GPU Bandwidth

**Per Frame Upload:**
- Only dirty attributes are uploaded
- Typical: 2-3 attributes per frame
- Splash: ~1KB (96 instances × 2 floats × 4 bytes)
- Bubble: ~750 bytes
- Shimmer: ~750 bytes
- **Total: ~2.5KB per frame**

### Draw Calls

**Before Refactor:**
- 1 draw call per fishing spot
- 30 fishing spots = 30 draw calls
- 5 particles per spot = 150 draw calls total

**After Refactor:**
- 4 draw calls total (4 InstancedMeshes)
- **97% reduction in draw calls**

## Extending the System

### Adding New Particle Types

To add a new particle type (e.g., snow, rain, magic effects):

1. **Create Specialized Manager:**

```typescript
// packages/shared/src/entities/managers/particleManager/SnowParticleManager.ts
export class SnowParticleManager {
  constructor(scene: THREE.Scene) {
    // Create InstancedMesh with TSL material
  }
  
  registerSnow(id: string, config: SnowConfig): void {
    // Allocate instances
  }
  
  unregisterSnow(id: string): void {
    // Free instances
  }
  
  update(dt: number, camera: THREE.Camera): void {
    // Update particle ages and attributes
  }
  
  dispose(): void {
    // Cleanup
  }
}
```

2. **Add Config Type:**

```typescript
// packages/shared/src/entities/managers/particleManager/ParticleManager.ts
export interface SnowParticleConfig {
  type: 'snow';
  position: { x: number, y: number, z: number };
  intensity: number;
}

export type ParticleConfig = 
  | WaterParticleConfig 
  | GlowParticleConfig 
  | SnowParticleConfig;
```

3. **Update ParticleManager:**

```typescript
export class ParticleManager {
  private snowManager: SnowParticleManager;
  
  constructor(scene: THREE.Scene) {
    this.waterManager = new WaterParticleManager(scene);
    this.glowManager = new GlowParticleManager(scene);
    this.snowManager = new SnowParticleManager(scene);
  }
  
  register(id: string, config: ParticleConfig): void {
    switch (config.type) {
      case 'water':
        this.waterManager.registerSpot(config);
        this.ownership.set(id, 'water');
        break;
      case 'glow':
        this.glowManager.registerGlow(id, config);
        this.ownership.set(id, 'glow');
        break;
      case 'snow':
        this.snowManager.registerSnow(id, config);
        this.ownership.set(id, 'snow');
        break;
    }
  }
  
  update(dt: number, camera: THREE.Camera): void {
    this.waterManager.update(dt, camera);
    this.glowManager.update(dt, camera);
    this.snowManager.update(dt, camera);
  }
}
```

### Custom Glow Presets

To add a new glow preset:

1. **Define Preset Configuration:**

```typescript
// In GlowParticleManager.ts
const PRESETS = {
  fire: { particleCount: 12, spread: 0.15, riseSpeed: 0.4 },
  altar: { particleCount: 8, spread: 0.2, riseSpeed: 0.3 },
  torch: { particleCount: 6, spread: 0.08, riseSpeed: 0.3 },
  magic: { particleCount: 16, spread: 0.25, riseSpeed: 0.5 },  // New preset
};
```

2. **Update Preset Type:**

```typescript
export type GlowPreset = 'fire' | 'altar' | 'torch' | 'magic';
```

3. **Use New Preset:**

```typescript
particleManager.register('magic_portal_1', {
  type: 'glow',
  preset: 'magic',
  position: { x: 0, y: 0, z: 0 },
  color: { core: 0xff00ff, mid: 0x8800ff, outer: 0x4400ff }
});
```

## Best Practices

### Registration

- **Unique IDs:** Use entity ID or unique identifier
- **Cleanup:** Always unregister when entity is destroyed
- **Position:** Use world coordinates, not local
- **Type Safety:** Use discriminated union for config

### Performance

- **Batch Operations:** Register multiple emitters before first update
- **Avoid Churn:** Don't register/unregister every frame
- **Reuse IDs:** Unregister before re-registering same ID
- **Limit Instances:** Stay within hard limits (96/72/72/24)

### Visual Quality

- **Color Choice:** Use hex colors matching game aesthetic
- **Preset Selection:** Choose preset matching effect type
- **Position Height:** Adjust Y position for visual alignment
- **Scale:** Use modelScale for size adjustment

## Debugging

### Enable Particle Debug Logging

```typescript
// In ParticleManager.ts
console.log('[ParticleManager] Registered', id, config);
console.log('[ParticleManager] Unregistered', id);
console.log('[ParticleManager] Moved', id, newPos);
```

### Visualize Instance Allocation

```typescript
// Check free slots
console.log('Splash free:', splashLayer.freeSlots.length);
console.log('Bubble free:', bubbleLayer.freeSlots.length);
console.log('Shimmer free:', shimmerLayer.freeSlots.length);
console.log('Ripple free:', rippleLayer.freeSlots.length);
```

### Inspect Particle Attributes

```typescript
// Read instance data
const slot = 0;
const age = ageLifetimeArr[slot * 2];
const lifetime = ageLifetimeArr[slot * 2 + 1];
const angle = angleRadiusArr[slot * 2];
const radius = angleRadiusArr[slot * 2 + 1];
console.log(`Particle ${slot}: age=${age}/${lifetime}, angle=${angle}, radius=${radius}`);
```

## Migration Guide

### From ResourceEntity Particles

**Before (per-entity particles):**
```typescript
// In ResourceEntity.ts
this.createParticles();  // Creates individual meshes
this.updateParticles(dt);  // CPU animation
```

**After (ParticleManager):**
```typescript
// In ResourceSystem.ts
this.particleManager.register(entityId, {
  type: 'water',
  position: entity.position,
  resourceId: entity.resourceId
});

// Particles update automatically in ParticleManager.update()
```

**Benefits:**
- No per-entity particle code
- Automatic GPU instancing
- Centralized particle management
- Consistent visual quality

### From Manual Particle Meshes

**Before (manual mesh creation):**
```typescript
const geometry = new THREE.PlaneGeometry(0.1, 0.1);
const material = new THREE.MeshBasicMaterial({ 
  color: 0xff6600,
  transparent: true 
});
const particle = new THREE.Mesh(geometry, material);
scene.add(particle);

// Manual animation
particle.position.y += dt * 0.5;
particle.material.opacity = 1 - (age / lifetime);
```

**After (ParticleManager):**
```typescript
particleManager.register('fire_1', {
  type: 'glow',
  preset: 'fire',
  position: { x: 0, y: 0, z: 0 },
  color: 0xff6600
});

// Animation handled automatically by GPU
```

**Benefits:**
- No manual animation code
- Automatic billboarding
- GPU-driven updates
- Shared geometry/material
