# Arena Performance Optimizations

## Overview

The duel arena rendering system underwent major performance optimizations in February 2026, reducing draw calls by ~97% and eliminating expensive per-pixel lighting calculations.

## Performance Improvements

### Before Optimization
- **~846 individual mesh draw calls** - Each fence post, rail, pillar component rendered separately
- **28 dynamic PointLights** - Per-pixel lighting calculations every frame
- **Severe FPS drops** - Especially noticeable with multiple arenas visible

### After Optimization
- **~22 draw calls** - InstancedMesh batching for repeated geometry
- **0 dynamic lights** - Replaced with GPU-driven TSL emissive materials
- **Smooth 60 FPS** - Consistent performance across all arena views

## Technical Changes

### 1. InstancedMesh Conversion

Converted ~846 individual meshes to InstancedMesh batches:

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Fence posts | 288 meshes | 1 InstancedMesh | 99.7% |
| Fence caps | 288 meshes | 1 InstancedMesh | 99.7% |
| Fence rails (X) | 36 meshes | 1 InstancedMesh | 97.2% |
| Fence rails (Z) | 36 meshes | 1 InstancedMesh | 97.2% |
| Pillar bases | 32 meshes | 1 InstancedMesh | 96.9% |
| Pillar shafts | 32 meshes | 1 InstancedMesh | 96.9% |
| Pillar capitals | 32 meshes | 1 InstancedMesh | 96.9% |
| Brazier bowls | 24 meshes | 1 InstancedMesh | 95.8% |
| Border strips (N/S) | 12 meshes | 1 InstancedMesh | 91.7% |
| Border strips (E/W) | 12 meshes | 1 InstancedMesh | 91.7% |
| Banner poles | 12 meshes | 1 InstancedMesh | 91.7% |

**Total**: 846 meshes → ~22 draw calls (97% reduction)

### 2. Dynamic Lighting Removal

Replaced all 28 PointLights with GPU-driven TSL emissive materials:

**Old approach** (CPU-intensive):
```typescript
// 28 PointLights updated every frame
for (let i = 0; i < this.torchLights.length; i++) {
  const light = this.torchLights[i];
  light.intensity = BASE_INTENSITY + 
    Math.sin(this.animTime * 10 + i * 1.7) * 0.15 +
    Math.random() * 0.05;
}
```

**New approach** (GPU-driven):
```typescript
// Single TSL shader node, runs on GPU
mat.emissiveNode = Fn(() => {
  const wp = positionWorld;
  const quantized = vec2(tslFloor(wp.x.add(0.5)), tslFloor(wp.z.add(0.5)));
  const phase = tslHash(quantized).mul(6.28);
  
  const flicker = sin(t.mul(10.0).add(phase))
    .mul(0.15)
    .add(sin(t.mul(7.3).add(phase.mul(1.7))).mul(0.08));
  const noise = fract(sin(t.mul(43.7).add(phase)).mul(9827.3)).mul(0.05);
  const intensity = float(0.6).add(flicker).add(noise);
  
  const topMask = smoothstep(float(0.7), float(0.95), normalWorld.y);
  return vec3(1.0, 0.4, 0.0).mul(intensity).mul(topMask);
})();
```

**Benefits**:
- Zero CPU cost per frame
- Per-instance phase offset for natural variation
- Runs entirely on GPU via emissiveNode

### 3. Fire Particle Improvements

Unified fire rendering on enhanced "fire" preset:

**Removed**:
- `"torch"` particle preset (redundant)
- Separate torch/fire particle systems

**Enhanced fire preset features**:
- Smooth value noise fragment shader (bilinear interpolated hash lattice)
- Soft radial falloff designed for additive blending
- Per-particle turbulent vertex motion for natural flickering
- Height-based color gradient (white-yellow core → orange-red tips)
- Overlapping particles merge into cohesive flame body

**Shader implementation**:
```typescript
// Smooth value noise via bilinear interpolation
const hash2d = (p: ShaderNode) =>
  fract(mul(sin(dot(p, vec2(127.1, 311.7))), float(43758.5453)));

const valueNoise = (p: ShaderNode) => {
  const i = vec2(tslFloor(p.x), tslFloor(p.y));
  const f = vec2(fract(p.x), fract(p.y));
  const u = mul(mul(f, f), sub(vec2(3.0, 3.0), mul(f, float(2.0))));
  const a = hash2d(i);
  const b = hash2d(add(i, vec2(1.0, 0.0)));
  const c = hash2d(add(i, vec2(0.0, 1.0)));
  const d = hash2d(add(i, vec2(1.0, 1.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
};
```

### 4. Dead Code Removal

Removed unused functions:
- `createArenaMarker()` - Arena number markers (unused)
- `createAmbientDust()` - Dust particles (unused)
- `createLobbyBenches()` - Lobby benches (unused)

## Performance Metrics

### Draw Call Reduction
- **Before**: ~846 draw calls per frame
- **After**: ~22 draw calls per frame
- **Improvement**: 97% reduction

### Lighting Performance
- **Before**: 28 PointLights × per-pixel calculations
- **After**: 0 dynamic lights (GPU emissive only)
- **Improvement**: Eliminated per-pixel lighting overhead

### Frame Rate
- **Before**: Variable FPS, drops to 30-40 FPS in arena areas
- **After**: Consistent 60 FPS across all arena views
- **Improvement**: 50-100% FPS increase in arena areas

## Implementation Details

### InstancedMesh Pattern

```typescript
// Pre-compute instance count
const TOTAL_FENCE_POSTS = ARENA_COUNT * (2 * POSTS_PER_X_FENCE + 2 * POSTS_PER_Z_FENCE);

// Create instanced mesh
const postsIM = new THREE.InstancedMesh(
  postGeom,
  stoneFenceMat,
  TOTAL_FENCE_POSTS
);

// Set instance transforms
const matrix = new THREE.Matrix4();
for (let i = 0; i < TOTAL_FENCE_POSTS; i++) {
  matrix.makeTranslation(x, y, z);
  postsIM.setMatrixAt(i, matrix);
}
postsIM.instanceMatrix.needsUpdate = true;
```

### TSL Emissive Animation

```typescript
// Create time uniform (updated once per frame)
this.timeUniform = uniform(float(0));

// Use in material emissiveNode
mat.emissiveNode = Fn(() => {
  const t = this.timeUniform;
  const phase = tslHash(quantizedPosition).mul(6.28);
  const flicker = sin(t.mul(10.0).add(phase)).mul(0.15);
  return baseColor.mul(intensity.add(flicker));
})();

// Update in tick (single uniform update, not per-light)
update(deltaTime: number): void {
  if (this.timeUniform) {
    this.timeUniform.value += deltaTime;
  }
}
```

## Migration Notes

### Breaking Changes
- `GlowPreset` type no longer includes `"torch"` - use `"fire"` instead
- `MAX_RISE_SPREAD` particle pool increased from 256 to 896 (supports more fire particles)

### API Changes
- `GlowParticleManager.registerTorch()` removed - use `registerFire()` instead
- Fire particles now use turbulent vertex motion (phase parameter in dynamics array)

## Troubleshooting

### Grey/White Materials After Update
If braziers or pillars appear grey after updating:
1. Clear browser cache and IndexedDB
2. Restart the client
3. Materials should restore with proper colors

### Missing Fire Effects
If fire particles don't appear:
1. Check that particle system is initialized
2. Verify `MAX_RISE_SPREAD` pool has capacity (now 896)
3. Ensure emitter IDs are unique

### Performance Still Poor
If FPS is still low after update:
1. Check GPU compatibility (WebGPU required for TSL)
2. Verify InstancedMesh is being used (check draw calls in DevTools)
3. Ensure old PointLights were removed (check scene graph)

## Related Files

- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts` - Main arena rendering system
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` - Fire particle system
- `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts` - Victory emote timing

## References

- PR #938: [perf(arena): instance arena meshes and replace dynamic lights with TSL fire particles](https://github.com/HyperscapeAI/hyperscape/pull/938)
- Commit c20d0fc: Arena instancing implementation
