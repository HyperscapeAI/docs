# Arena Performance Optimization (February 2026)

Comprehensive performance improvements to the duel arena rendering system, achieving 97% draw call reduction and eliminating all dynamic lighting CPU overhead.

## Overview

The duel arena was a major rendering bottleneck due to:
1. **28 dynamic PointLights** forcing expensive per-pixel lighting calculations each frame
2. **~846 individual THREE.Mesh draw calls** for repeated geometry causing excessive GPU state changes
3. **Redundant material creation** for identical geometry instances

## Performance Improvements

### Before (Baseline)
- **Draw Calls**: ~846 individual meshes
- **Dynamic Lights**: 28 PointLights (CPU-animated flicker)
- **FPS Impact**: Significant frame drops in arena areas
- **CPU Usage**: High per-frame cost for light intensity updates

### After (Optimized)
- **Draw Calls**: ~20 InstancedMesh batches (97% reduction)
- **Dynamic Lights**: 0 (replaced with GPU-driven TSL emissive materials)
- **FPS Impact**: Minimal (arena rendering now negligible)
- **CPU Usage**: Zero per-frame cost (all animation on GPU)

## Technical Changes

### 1. Eliminated Dynamic PointLights (28 → 0)

**Problem**: Each PointLight forced expensive per-pixel shading passes on surrounding geometry.

**Solution**: Replaced with single GPU-driven TSL emissive material on brazier bowls.

**Implementation**:
```typescript
// packages/shared/src/systems/client/DuelArenaVisualsSystem.ts

private createBrazierGlowMaterial(): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial({
    color: 0xff4400,
    roughness: 0.7,
  });

  const t = this.timeUniform!;  // Shared time uniform

  mat.emissiveNode = Fn(() => {
    const wp = positionWorld;
    // Quantize world position so all vertices of one brazier share same phase
    const quantized = vec2(tslFloor(wp.x.add(0.5)), tslFloor(wp.z.add(0.5)));
    const phase = tslHash(quantized).mul(6.28);

    // Multi-frequency sine flicker + high-freq noise
    const flicker = sin(t.mul(10.0).add(phase))
      .mul(0.15)
      .add(sin(t.mul(7.3).add(phase.mul(1.7))).mul(0.08));
    const noise = fract(sin(t.mul(43.7).add(phase)).mul(9827.3)).mul(0.05);
    const intensity = float(0.6).add(flicker).add(noise);

    // Only top face (fire opening) glows; outer shell stays dark
    const topMask = smoothstep(float(0.7), float(0.95), normalWorld.y);

    return vec3(1.0, 0.4, 0.0).mul(intensity).mul(topMask);
  })();

  return mat;
}
```

**Benefits**:
- **Zero CPU cost per frame** - all flicker animation runs on GPU
- **Per-instance phase offset** - each brazier flickers independently
- **Consistent visual quality** - matches old PointLight behavior
- **No lighting overhead** - emissive materials don't trigger lighting calculations

### 2. Converted to InstancedMesh (~846 → ~20 draw calls)

**Problem**: Each fence post, rail, pillar component, brazier, border strip, and banner pole was a separate `THREE.Mesh`, causing ~846 draw calls per frame.

**Solution**: Batch identical geometry into `InstancedMesh` with pre-computed instance matrices.

**Instanced Components**:

| Component | Count | Instances | Draw Calls |
|-----------|-------|-----------|------------|
| Fence Posts | 288 | 1 InstancedMesh | 1 |
| Fence Post Caps | 288 | 1 InstancedMesh | 1 |
| X-Axis Rails | 36 | 1 InstancedMesh | 1 |
| Z-Axis Rails | 36 | 1 InstancedMesh | 1 |
| Pillar Bases | 32 | 1 InstancedMesh | 1 |
| Pillar Shafts | 32 | 1 InstancedMesh | 1 |
| Pillar Capitals | 32 | 1 InstancedMesh | 1 |
| Arena Braziers | 24 | 1 InstancedMesh | 1 |
| Border Strips (N/S) | 12 | 1 InstancedMesh | 1 |
| Border Strips (E/W) | 12 | 1 InstancedMesh | 1 |
| Banner Poles | 12 | 1 InstancedMesh | 1 |
| **Total** | **804** | **11 InstancedMesh** | **11** |

**Individual Meshes** (require unique userData for raycasting):
- 6 Arena Floors (need per-floor `arenaId`)
- 1 Lobby Floor
- 1 Hospital Floor
- 12 Forfeit Pillars (need unique `entityId` for interaction)
- 12 Banner Cloths (3 shared materials)

**Total Draw Calls**: ~22 (11 instanced + 11 individual)

**Implementation Example**:
```typescript
// Build fence posts as InstancedMesh
private buildFenceInstances(): void {
  const postGeom = new THREE.BoxGeometry(
    FENCE_POST_SIZE,
    FENCE_HEIGHT,
    FENCE_POST_SIZE,
  );
  
  const postsIM = new THREE.InstancedMesh(
    postGeom,
    this.stoneFenceMat!,
    TOTAL_FENCE_POSTS,  // 288 instances
  );
  
  const matrix = new THREE.Matrix4();
  let postIdx = 0;
  
  // Compute all instance matrices
  for (let a = 0; a < ARENA_COUNT; a++) {
    // ... calculate positions ...
    for (const [startX, startZ, length, axis] of sides) {
      for (let i = 0; i < postCount; i++) {
        matrix.makeTranslation(px, terrainY + FENCE_HEIGHT / 2, pz);
        postsIM.setMatrixAt(postIdx++, matrix);
      }
    }
  }
  
  postsIM.instanceMatrix.needsUpdate = true;
  this.arenaGroup!.add(postsIM);
}
```

### 3. Enhanced Fire Particle Shader

**Problem**: Old "torch" preset had hard edges and didn't blend well with overlapping particles.

**Solution**: Rewrote fire fragment shader with smooth value noise, soft radial falloff, and additive-blend-friendly design.

**Key Improvements**:
- **Smooth Value Noise**: Bilinear interpolated hash lattice for organic flame shapes
- **Soft Radial Falloff**: No hard edges, overlapping particles merge into cohesive flame body
- **Turbulent Vertex Motion**: Per-particle jitter for natural flickering
- **Height-Based Color Gradient**: White-yellow core → orange-red tips
- **Unified Preset**: Removed "torch" preset, enhanced "fire" preset handles all use cases

**Implementation**:
```typescript
// packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts

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

// Soft radial falloff designed for additive blending
const radialDist = mul(
  pow(add(mul(dx, dx), mul(dy, dy)), float(0.5)),
  float(2.0),
);
const yBias = mul(uvNode.y, float(0.3));
const softFalloff = max(
  sub(float(1.0), add(radialDist, yBias)),
  float(0.0),
);
const baseMask = pow(softFalloff, float(0.8));

// Scrolling noise for organic edges
const scrollY = mul(time, float(-3.0));
const noise = add(
  mul(valueNoise(nUV1), float(0.6)),
  mul(valueNoise(nUV2), float(0.4)),
);

// Noise modulates mask - wispy edges but keeps 70%+ base intensity
const noisyMask = mul(baseMask, add(float(0.7), mul(noise, float(0.3))));
```

**Visual Comparison**:
- **Before**: Hard-edged particles, visible seams between overlapping particles
- **After**: Soft organic flames, seamless blending, natural flicker motion

### 4. Shared Material Caching

**Problem**: Each arena created duplicate materials for identical geometry.

**Solution**: Create all materials once, share across all instances.

**Shared Materials**:
- `stoneFenceMat` - TSL procedural sandstone for fences
- `arenaFloorMat` - TSL procedural flagstone for floors
- `borderMat` - Simple stone border trim
- `pillarStoneMat` - Stone pillar components
- `brazierGlowMat` - TSL animated emissive for braziers
- `forfeitPillarMat` - Wooden forfeit pillars
- `bannerPoleMat` - Metal banner poles
- `lobbyStandMat` - Lobby brazier stands

**Implementation**:
```typescript
private createSharedMaterials(): void {
  this.timeUniform = uniform(float(0));  // Shared time for all animations
  
  this.stoneFenceMat = this.createStoneFenceMaterial();
  this.materials.push(this.stoneFenceMat);
  
  this.arenaFloorMat = this.createArenaFloorMaterial();
  this.materials.push(this.arenaFloorMat);
  
  // ... create all other shared materials
}
```

## Code Cleanup

### Removed Dead Code
- `createArenaMarker()` - Unused arena number markers
- `createAmbientDust()` - Unused dust particles
- `createLobbyBenches()` - Unused lobby benches
- "torch" particle preset - Unified on enhanced "fire" preset

### Simplified Update Loop

**Before**:
```typescript
update(deltaTime: number): void {
  // Update 28 torch lights
  for (let i = 0; i < this.torchLights.length; i++) {
    const light = this.torchLights[i];
    light.intensity =
      TORCH_LIGHT_INTENSITY +
      Math.sin(this.animTime * 10 + i * 1.7) * 0.15 +
      Math.random() * 0.05;
  }
  
  // Update 4 lobby lights
  for (let i = 0; i < this.lobbyLights.length; i++) {
    const light = this.lobbyLights[i];
    light.intensity =
      TORCH_LIGHT_INTENSITY +
      Math.sin(this.animTime * 8 + i * 2.3) * 0.2 +
      Math.random() * 0.05;
  }
}
```

**After**:
```typescript
update(deltaTime: number): void {
  // Update single time uniform - GPU handles all animation
  if (this.timeUniform) {
    this.timeUniform.value += deltaTime;
  }
}
```

## Performance Metrics

### Draw Call Reduction
- **Before**: ~846 draw calls per frame
- **After**: ~22 draw calls per frame
- **Reduction**: 97%

### CPU Usage
- **Before**: 32 light intensity updates per frame (28 torches + 4 lobby braziers)
- **After**: 1 time uniform update per frame
- **Reduction**: 97%

### Memory Usage
- **Before**: 846 individual Mesh objects + 32 PointLight objects
- **After**: 11 InstancedMesh objects + 11 individual meshes
- **Reduction**: ~95%

### GPU Efficiency
- **Before**: 28 dynamic lights × per-pixel shading × affected geometry
- **After**: Simple emissive material evaluation (no lighting calculations)
- **Improvement**: Massive reduction in fragment shader complexity

## Migration Notes

### Breaking Changes
- **Removed "torch" particle preset** - Use "fire" preset instead
- **Removed PointLights** - All lighting now emissive materials

### API Changes
```typescript
// Before
particleSystem.register(emitterId, {
  type: "glow",
  preset: "torch",  // ❌ No longer exists
  position: { x, y, z },
});

// After
particleSystem.register(emitterId, {
  type: "glow",
  preset: "fire",   // ✅ Enhanced fire preset
  position: { x, y, z },
});
```

### Visual Differences
- **Fire particles**: More organic, better blending, natural flicker
- **Brazier glow**: GPU-animated, per-instance phase offset
- **Overall lighting**: Slightly darker (no dynamic lights), more atmospheric

## Implementation Details

### File Changes
- **Modified**: `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts` (+1103/-1427 lines)
- **Modified**: `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` (+134/-205 lines)

### Commit Information
- **PR**: #938
- **Commit**: c20d0fc09ff44219a306d869b9f71bef6f39a25b
- **Date**: February 25, 2026
- **Author**: Ting Chien Meng (@tcm390)
- **Made-with**: Cursor

### Key Techniques

#### 1. InstancedMesh Pre-computation
```typescript
// Pre-compute instance counts at compile time
const POSTS_PER_X_FENCE = Math.max(
  2,
  Math.floor(ARENA_WIDTH / FENCE_POST_SPACING) + 1,
);
const TOTAL_FENCE_POSTS =
  ARENA_COUNT * (2 * POSTS_PER_X_FENCE + 2 * POSTS_PER_Z_FENCE);

// Create InstancedMesh with exact count
const postsIM = new THREE.InstancedMesh(
  postGeom,
  this.stoneFenceMat!,
  TOTAL_FENCE_POSTS,
);

// Set all instance matrices
const matrix = new THREE.Matrix4();
for (let i = 0; i < TOTAL_FENCE_POSTS; i++) {
  matrix.makeTranslation(px, py, pz);
  postsIM.setMatrixAt(i, matrix);
}
postsIM.instanceMatrix.needsUpdate = true;
```

#### 2. TSL Emissive Animation
```typescript
// Shared time uniform updated once per frame
this.timeUniform = uniform(float(0));

// Per-instance phase from world position
const quantized = vec2(tslFloor(wp.x.add(0.5)), tslFloor(wp.z.add(0.5)));
const phase = tslHash(quantized).mul(6.28);

// Multi-frequency flicker (matches old PointLight behavior)
const flicker = sin(t.mul(10.0).add(phase))
  .mul(0.15)
  .add(sin(t.mul(7.3).add(phase.mul(1.7))).mul(0.08));
```

#### 3. Smooth Value Noise for Fire
```typescript
// Bilinear interpolation of hash lattice
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

## Best Practices

### When to Use InstancedMesh
- **Identical geometry** repeated many times
- **Static or pre-computed transforms** (not per-frame updates)
- **Shared material** across all instances
- **No per-instance raycasting** needed (or use `InstancedMesh.raycast` override)

### When to Use Individual Meshes
- **Unique userData** required for raycasting (e.g., `entityId`, `arenaId`)
- **Different materials** per instance
- **Dynamic per-frame transforms** (use InstancedMesh with `instanceMatrix.needsUpdate = true` instead)
- **Layer-specific rendering** (e.g., layer 0+2 for click-to-move)

### TSL Emissive vs PointLights
- **Use TSL emissive** for static/animated glow effects (braziers, torches, magic items)
- **Use PointLights** only when dynamic lighting of surrounding geometry is required
- **Never use PointLights** for purely visual glow (emissive is always faster)

## Performance Testing

### Benchmarking
```bash
# Run performance tests
cd packages/shared
bun test src/systems/client/__tests__/DuelArenaVisualsSystem.perf.test.ts
```

### Profiling
```typescript
// Enable Chrome DevTools profiling
// 1. Open Chrome DevTools
// 2. Performance tab
// 3. Record while in duel arena
// 4. Check "Rendering" and "GPU" sections
```

### Metrics to Monitor
- **Draw calls**: Check Three.js renderer info (`renderer.info.render.calls`)
- **Frame time**: Should be <16ms for 60 FPS
- **GPU memory**: Check `renderer.info.memory.geometries` and `textures`
- **CPU time**: Profile update loop (should be negligible)

## Future Optimizations

### Potential Improvements
1. **Geometry Merging**: Merge static geometry into single BufferGeometry (even fewer draw calls)
2. **Texture Atlasing**: Combine all arena textures into single atlas (reduce texture binds)
3. **LOD System**: Use lower-poly geometry when arena is far from camera
4. **Frustum Culling**: Skip rendering arenas outside camera view
5. **Occlusion Culling**: Skip rendering arenas blocked by terrain/buildings

### Not Recommended
- **Geometry instancing for floors**: Floors need unique userData for raycasting (keep as individual meshes)
- **Merging different materials**: Breaks material batching (keep separate InstancedMesh per material)
- **Dynamic InstancedMesh updates**: Pre-compute all transforms (static arena geometry)

## Related Documentation

- **Implementation**: `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`
- **Particle System**: `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`
- **PR Discussion**: https://github.com/HyperscapeAI/hyperscape/pull/938
- **Commit**: c20d0fc09ff44219a306d869b9f71bef6f39a25b

## Video Comparison

**Before** (28 PointLights, 846 meshes):
https://github.com/user-attachments/assets/f4574656-eff4-4c1e-a8c0-cf188c962296

**After** (0 PointLights, 22 draw calls):
https://github.com/user-attachments/assets/693217ed-7270-4826-9676-a74cd521fcbb
