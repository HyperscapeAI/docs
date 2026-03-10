# Migration Guide: Three.js 0.182.0 → 0.183.2

**Date**: March 10, 2026  
**Commit**: 8b93772

This guide covers breaking changes and migration steps for upgrading from Three.js 0.182.0 to 0.183.2.

## Overview

Hyperscape upgraded to Three.js 0.183.2 to gain access to the latest WebGPU features, performance improvements, and bug fixes. This upgrade includes one breaking change in the TSL (Three Shading Language) API.

## Breaking Changes

### 1. TSL API: `atan2` renamed to `atan`

**Change**: The `atan2` function in TSL exports has been renamed to `atan` to match GLSL/WGSL conventions.

**Migration**:

```typescript
// ❌ Old (0.182.0)
import { atan2 } from 'three/tsl';

const angle = atan2(y, x);

// ✅ New (0.183.2)
import { atan } from 'three/tsl';

const angle = atan(y, x);
```

**Files Changed in Hyperscape**:
- `packages/shared/src/materials/LeafMaterialTSL.ts` - Updated `atan2` → `atan`

**Impact**: If you have custom TSL shaders using `atan2`, you must update them to use `atan` instead.

### 2. TSL Type Aliases

**Change**: Added typed node aliases for better TypeScript support in TSL shaders.

**New Exports** (added to `packages/shared/src/extras/three/three.ts`):
```typescript
export type TSLNodeFloat = ShaderNodeObject<Node>;
export type TSLNodeVec2 = ShaderNodeObject<Node>;
export type TSLNodeVec3 = ShaderNodeObject<Node>;
export type TSLNodeVec4 = ShaderNodeObject<Node>;
```

**Usage**:
```typescript
import type { TSLNodeFloat, TSLNodeVec3 } from '@hyperscape/shared';

// Use in TSL shader functions
function myShaderNode(input: TSLNodeVec3): TSLNodeFloat {
  // ...
}
```

**Impact**: Better type safety for custom TSL shaders. No migration required unless you want to adopt the new type aliases.

### 3. InstancedBufferAttribute Type Cast

**Change**: Fixed type compatibility for `InstancedBufferAttribute` in HealthBars system.

**Migration**:
```typescript
// ❌ Old (0.182.0)
const attribute = new InstancedBufferAttribute(array, itemSize);
geometry.setAttribute('name', attribute);

// ✅ New (0.183.2)
const attribute = new InstancedBufferAttribute(array, itemSize) as BufferAttribute;
geometry.setAttribute('name', attribute);
```

**Files Changed in Hyperscape**:
- `packages/shared/src/systems/client/HealthBars.ts` - Added type cast for instancedBufferAttribute

**Impact**: Only affects code using `InstancedBufferAttribute` with Three.js geometry. Add type cast if you encounter type errors.

## Package Updates

All packages have been updated to use Three.js 0.183.2:

```json
{
  "dependencies": {
    "three": "0.183.2"
  },
  "devDependencies": {
    "@types/three": "0.183.1"
  }
}
```

**Affected Packages**:
- `packages/shared/package.json`
- `packages/client/package.json`
- `packages/asset-forge/package.json`
- `packages/impostors/package.json`
- `packages/procgen/package.json`
- Root `package.json` (overrides)

## Benefits of Upgrade

### Performance Improvements
- Faster WebGPU shader compilation
- Improved memory management for large scenes
- Better GPU resource utilization

### WebGPU Enhancements
- More stable WebGPU device handling
- Better error messages for GPU issues
- Improved compatibility with latest GPU drivers

### TSL Improvements
- Better TSL shader compilation
- More consistent GLSL/WGSL naming conventions
- Improved type safety for shader nodes

### Bug Fixes
- Fixed various WebGPU rendering artifacts
- Improved texture handling
- Better geometry attribute management

## Testing Your Migration

After upgrading, verify your custom shaders and materials:

1. **Check for `atan2` usage**:
   ```bash
   grep -r "atan2" packages/*/src --include="*.ts" --include="*.tsx"
   ```

2. **Run the test suite**:
   ```bash
   npm test
   ```

3. **Visual verification**:
   - Start the game: `bun run dev`
   - Check that all materials render correctly
   - Verify post-processing effects (bloom, tone mapping) work
   - Test in both development and production builds

4. **Check for TypeScript errors**:
   ```bash
   npm run typecheck
   ```

## Rollback Instructions

If you need to rollback to Three.js 0.182.0:

1. **Update package.json files**:
   ```json
   {
     "dependencies": {
       "three": "0.182.0"
     },
     "devDependencies": {
       "@types/three": "0.182.0"
     }
   }
   ```

2. **Revert TSL changes**:
   ```typescript
   // Change back to atan2
   import { atan2 } from 'three/tsl';
   ```

3. **Reinstall dependencies**:
   ```bash
   bun install
   bun run build
   ```

## Additional Resources

- [Three.js 0.183.0 Release Notes](https://github.com/mrdoob/three.js/releases/tag/r183)
- [Three.js 0.183.1 Release Notes](https://github.com/mrdoob/three.js/releases/tag/r183.1)
- [Three.js 0.183.2 Release Notes](https://github.com/mrdoob/three.js/releases/tag/r183.2)
- [Three.js TSL Documentation](https://threejs.org/docs/#api/en/nodes/Nodes)
- [CLAUDE.md](../CLAUDE.md) - Development guide with recent changes
- [AGENTS.md](../AGENTS.md) - AI assistant instructions with changelog

## Support

If you encounter issues with the upgrade:
1. Check the [Troubleshooting](#testing-your-migration) section above
2. Review the [Three.js GitHub Issues](https://github.com/mrdoob/three.js/issues)
3. Check Hyperscape Discord for community support
4. File an issue in the [Hyperscape repository](https://github.com/HyperscapeAI/hyperscape/issues)
