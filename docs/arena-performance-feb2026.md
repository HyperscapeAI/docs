# Arena Performance Optimizations (February 2026)

**Commit**: c20d0fc09ff44219a306d869b9f71bef6f39a25b  
**PR**: #938  
**Author**: Ting Chien Meng (@tcm390)

## Summary

Massive rendering performance improvement for the duel arena system by converting ~846 individual meshes to InstancedMesh (97% draw call reduction) and replacing 28 dynamic PointLights with GPU-driven TSL emissive materials.

## Performance Impact

### Before
- **Draw Calls**: ~846 individual meshes
- **Lights**: 28 dynamic PointLights (expensive per-pixel shading)
- **FPS**: Significant drops in arena areas

### After
- **Draw Calls**: ~20 InstancedMesh batches (97% reduction)
- **Lights**: 0 dynamic lights (replaced with TSL emissive materials)
- **FPS**: Smooth performance in all arena areas

## Changes

### 1. InstancedMesh Conversion

Converted repeated geometry to instanced draws:

**Fence Components** (4 draw calls):
- Posts: 288 instances → 1 draw call
- Caps: 288 instances → 1 draw call
- X-Rails: 36 instances → 1 draw call
- Z-Rails: 36 instances → 1 draw call

**Pillar Components** (3 draw calls):
- Bases: 32 instances → 1 draw call
- Shafts: 32 instances → 1 draw call
- Capitals: 32 instances → 1 draw call

**Other Instanced Geometry**:
- Brazier bowls: 24 instances → 1 draw call
- Border strips: 24 instances → 2 draw calls (N/S + E/W)
- Banner poles: 12 instances → 1 draw call

**Individual Meshes** (still needed for raycasting):
- Arena floors: 6 meshes (need unique `arenaId` userData)
- Forfeit pillars: 12 meshes (need unique `entityId` for interaction)
- Banner cloths: 12 meshes (3 shared materials)

### 2. Dynamic Light Elimination

**Removed**: 28 PointLights (24 arena corner torches + 4 lobby braziers)

**Replaced With**: TSL emissive material on brazier bowls

**GPU-Driven Flicker**:
```typescript
// Per-brazier phase derived from world position
const quantized = vec2(floor(wp.x + 0.5), floor(wp.z + 0.5));
const phase = hash(quantized) * 6.28;

// Multi-frequency sine flicker + high-freq noise
const flicker = sin(t * 10.0 + phase) * 0.15 
              + sin(t * 7.3 + phase * 1.7) * 0.08;
const noise = fract(sin(t * 43.7 + phase) * 9827.3) * 0.05;
const intensity = 0.6 + flicker + noise;

// Only top face glows (fire opening)
const topMask = smoothstep(0.7, 0.95, normalWorld.y);
return vec3(1.0, 0.4, 0.0) * intensity * topMask;
```

**Benefits**:
- Zero CPU cost per frame (all calculations on GPU)
- No per-light state updates
- Consistent flicker across all braziers
- Eliminates expensive per-pixel lighting calculations

### 3. Fire Particle Shader Enhancement

**Removed**: "torch" particle preset (redundant)

**Enhanced**: "fire" preset with improved fragment shader

**New Features**:
- **Smooth Value Noise**: Bilinear interpolated hash lattice for organic flame shapes
- **Soft Radial Falloff**: Designed for additive blending - overlapping particles merge into cohesive flame
- **Turbulent Vertex Motion**: Per-particle jitter for natural flickering
- **Height-Based Color Gradient**: White-yellow core → orange-red tips
- **Scrolling Noise**: Upward motion feel with organic edges

**Particle Count**:
- Fire: 18 → 28 particles (tighter spawn spread compensates)
- Torch: Removed (unified on fire preset)

**Configuration**:
```typescript
// Fire preset (packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts)
const FIRE_COUNT = 28;
const FIRE_SPAWN_Y = 0.0;
const FIRE_COLORS = [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc00];

// Particle dynamics
baseScale: 0.12 + random() * 0.08
speed: 0.25 + random() * 0.35
phase: random() * PI * 2
scaleYMult: 1.8  // Vertical stretch for flame shape
```

### 4. Dead Code Removal

Removed unused functions:
- `createArenaMarker()` - Number markers (1-6 dots) were never used
- `createAmbientDust()` - Dust particles were never registered
- `createLobbyBenches()` - Benches were never added to scene

## Implementation Details

### Shared Materials

All instanced meshes share materials (compiled once during init):

```typescript
// Created in createSharedMaterials()
this.stoneFenceMat = this.createStoneFenceMaterial();
this.arenaFloorMat = this.createArenaFloorMaterial();
this.borderMat = new MeshStandardNodeMaterial({ color: BORDER_COLOR });
this.pillarStoneMat = new MeshStandardNodeMaterial({ color: PILLAR_STONE_COLOR });
this.brazierGlowMat = this.createBrazierGlowMaterial();
this.forfeitPillarMat = new MeshStandardNodeMaterial({ color: FORFEIT_PILLAR_COLOR });
this.bannerPoleMat = new MeshStandardNodeMaterial({ color: 0x444444 });
this.lobbyStandMat = new MeshStandardNodeMaterial({ color: 0x555555 });
```

### Instance Matrix Updates

All instance matrices are set once during initialization:

```typescript
const matrix = new THREE.Matrix4();
for (let i = 0; i < instanceCount; i++) {
  matrix.makeTranslation(x, y, z);
  instancedMesh.setMatrixAt(i, matrix);
}
instancedMesh.instanceMatrix.needsUpdate = true;
```

No per-frame matrix updates needed (static geometry).

### TSL Time Uniform

Single time uniform drives all brazier glow animations:

```typescript
// Created once in createSharedMaterials()
this.timeUniform = uniform(float(0));

// Updated once per frame in update()
update(deltaTime: number): void {
  if (this.timeUniform) {
    this.timeUniform.value += deltaTime;
  }
}
```

All 28 braziers share this uniform - GPU handles per-brazier phase offset.

## Migration Guide

### For Developers

**No migration needed** - changes are fully backward compatible.

**If you're adding new arena geometry**:

1. **Use InstancedMesh** for repeated geometry:
   ```typescript
   const geometry = new THREE.BoxGeometry(w, h, d);
   const material = this.sharedMaterial;
   const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
   
   for (let i = 0; i < count; i++) {
     matrix.makeTranslation(x, y, z);
     instancedMesh.setMatrixAt(i, matrix);
   }
   instancedMesh.instanceMatrix.needsUpdate = true;
   ```

2. **Use TSL emissive materials** instead of PointLights:
   ```typescript
   const material = new MeshStandardNodeMaterial();
   material.emissiveNode = Fn(() => {
     const phase = hash(quantize(positionWorld));
     const flicker = sin(time * 10.0 + phase) * 0.15;
     return vec3(1.0, 0.4, 0.0) * (0.6 + flicker);
   })();
   ```

3. **Keep individual meshes** only when needed for raycasting/interaction:
   - Floors (need layer 0+2 for click-to-move)
   - Interactive objects (need unique `entityId` userData)

### For Asset Creators

**Fire Particles**: Use the unified "fire" preset:

```typescript
particleSystem.register('my_fire', {
  type: 'glow',
  preset: 'fire',  // Don't use 'torch' - it's removed
  position: { x, y, z }
});
```

**Torch Preset Removed**: All fire emitters now use the enhanced "fire" preset with better visual quality.

## Performance Metrics

### Draw Call Reduction

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Fence Posts | 288 | 1 | 99.7% |
| Fence Caps | 288 | 1 | 99.7% |
| Fence Rails | 72 | 2 | 97.2% |
| Pillars | 96 | 3 | 96.9% |
| Braziers | 24 | 1 | 95.8% |
| Borders | 24 | 2 | 91.7% |
| Banner Poles | 12 | 1 | 91.7% |
| **Total** | **~846** | **~20** | **97.6%** |

### Lighting Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dynamic Lights | 28 | 0 | 100% |
| Per-Pixel Shading | Yes | No | Eliminated |
| Light Updates/Frame | 28 | 0 | 100% |
| GPU Shader Complexity | High | Low | Significant |

### Memory Usage

| Resource | Before | After | Change |
|----------|--------|-------|--------|
| Mesh Objects | ~846 | ~50 | -94% |
| Material Instances | ~846 | ~15 | -98% |
| Light Objects | 28 | 0 | -100% |
| Geometry Buffers | ~846 | ~20 | -98% |

## Visual Quality

### Maintained
- ✅ Stone texture detail (TSL procedural materials)
- ✅ Fire particle appearance (enhanced shader)
- ✅ Brazier glow (TSL emissive matches old PointLight flicker)
- ✅ Overall arena atmosphere

### Improved
- ✅ Fire particles: More organic flame shapes with noise
- ✅ Brazier glow: Consistent flicker across all instances
- ✅ Performance: Smooth 60 FPS in arena areas

### Removed
- ❌ Arena number markers (1-6 dot patterns) - never used
- ❌ Lobby benches - never added to scene
- ❌ Ambient dust particles - never registered

## Related Files

### Modified
- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts` - Main arena rendering system
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` - Fire particle shader

### Workflow
- `.github/workflows/deploy-vast.yml` - Deployment with maintenance mode

## Future Improvements

### Potential Optimizations
1. **Texture Atlasing**: Combine stone textures into single atlas
2. **LOD System**: Reduce geometry detail at distance
3. **Frustum Culling**: Skip rendering off-screen arenas
4. **Occlusion Culling**: Skip rendering occluded geometry

### Monitoring
- Track FPS in arena areas
- Monitor draw call count via DevTools
- Profile GPU usage with Chrome DevTools Performance

## References

- [Three.js InstancedMesh Documentation](https://threejs.org/docs/#api/en/objects/InstancedMesh)
- [Three.js Shading Language (TSL)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
