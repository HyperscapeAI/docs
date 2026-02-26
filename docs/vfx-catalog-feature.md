# VFX Catalog Feature (February 2026)

**Commit**: 69105229a905d1621820c119877e982ea328ddb6  
**Author**: dreaminglucid

## Overview

New VFX catalog browser tab in Asset Forge with sidebar navigation, live Three.js effect previews, and comprehensive detail panels for all game visual effects.

## Features

### Effect Categories

**6 Categories, 27 Total Effects**:

1. **Magic Spells** (8 effects)
   - Wind Strike, Water Strike, Earth Strike, Fire Strike
   - Wind Bolt, Water Bolt, Earth Bolt, Fire Bolt

2. **Arrow Projectiles** (6 effects)
   - Default, Bronze, Iron, Steel, Mithril, Adamant

3. **Glow Particles** (3 effects)
   - Altar, Fire, Torch

4. **Fishing Spots** (3 effects)
   - Net Fishing, Fly Fishing, Default Fishing

5. **Teleport** (1 effect)
   - Multi-phase teleport sequence

6. **Combat HUD** (2 effects)
   - Damage Splats, XP Drops

### Live Previews

**Three.js Animated Previews**:
- **Spell Orbs**: Orbiting projectiles with trailing particles and pulsing glow
- **Arrows**: Rotating 3D models with shaft, head, and fletching
- **Glow Particles**: Instanced billboards with realistic fire/altar behavior
- **Water Effects**: Splash arcs, bubble rise, shimmer twinkle, ripple rings
- **Teleport**: Full multi-phase sequence with beams, particles, and shockwaves

**Canvas Previews**:
- **Damage Splats**: Hit (red) and Miss (blue) rounded rectangles
- **XP Drops**: Floating "+XP" text with gold border

### Detail Panels

**Color Swatches**:
- Hex color codes
- Visual color chips
- Labeled by component (Core, Mid, Outer, etc.)

**Parameter Tables**:
- Effect-specific parameters
- Numeric values and units
- Configuration references

**Layer Breakdowns** (Glow Effects):
- Particle pool types (pillar, wisp, spark, base, riseSpread)
- Count per layer
- Lifetime ranges
- Scale ranges
- Sharpness values
- Behavior notes

**Phase Timelines** (Teleport):
- Visual timeline bar
- Phase durations (Gather, Erupt, Sustain, Fade)
- Color-coded phases
- Timestamp markers

**Component Lists** (Teleport):
- All effect components (rune circle, beams, particles, lights)
- Color indicators
- Behavior descriptions

**Variants** (Combat HUD):
- Hit vs Miss damage splats
- Color schemes per variant

## Implementation

### Data Source

**File**: `packages/asset-forge/src/data/vfx-catalog.ts`

**Design**: Standalone effect metadata (no imports from packages/shared)

**Rationale**: Asset Forge should never import from packages/shared (would pull in full game engine). VFX data is duplicated as plain objects.

**Source of Truth**:
- `packages/shared/src/data/spell-visuals.ts` - Spell effects
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` - Glow particles
- `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts` - Water particles
- `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts` - Teleport effect
- `packages/shared/src/systems/client/DamageSplatSystem.ts` - Damage splats
- `packages/shared/src/systems/client/XPDropSystem.ts` - XP drops

### Component Structure

**VFXPage** (`src/pages/VFXPage.tsx`):
- Main page component
- Sidebar navigation
- Detail panel routing
- Empty state

**Sidebar** (`src/pages/VFXPage.tsx`):
- Collapsible category groups
- Effect count badges
- Category icons (Lucide)
- Selection state

**VFXPreview** (`src/components/VFX/VFXPreview.tsx`):
- Three.js Canvas wrapper
- Effect-specific preview components
- Camera positioning
- Lighting setup

**EffectDetailPanel** (`src/components/VFX/EffectDetailPanel.tsx`):
- ColorSwatch, ColorSwatchRow
- ParameterTable
- LayerBreakdown
- PhaseTimeline
- TeleportComponents
- VariantsPanel

### Preview Components

**SpellOrb**:
- Billboarded glow layers (outer + core)
- Orbiting path with vertical oscillation
- Pulse animation (bolts only)
- Trail particles (ring buffer)
- Orbiting sparks (bolt-tier)
- Point light for scene illumination

**ArrowMesh**:
- Cylinder shaft (wood brown)
- Cone head (metallic)
- 3 fletching fins (rotated planes)
- Rotation animation

**GlowParticles**:
- Instanced billboards
- Per-particle color attributes
- Type-specific motion (pillar, wisp, spark, base, riseSpread)
- Lifetime-based fade
- Camera-facing billboards

**WaterParticles**:
- Splash arcs (parabolic motion)
- Bubble rise (wobble + vertical)
- Shimmer twinkle (double sine)
- Ripple rings (expanding circles)
- Water surface disc

**TeleportScene**:
- Rune circle (canvas texture)
- Base glow disc (pulsing)
- Inner/outer beams (Hermite elastic curve)
- Core flash (pop at eruption)
- Shockwave rings (easeOutExpo expansion)
- Helix particles (spiral upward)
- Burst particles (gravity simulation)
- Point light (dynamic intensity)

**DamageSplatCanvas**:
- Canvas 2D rendering
- Rounded rectangle backgrounds
- Hit (red) vs Miss (blue)
- Text rendering

**XPDropCanvas**:
- Canvas 2D rendering
- Rounded rectangle with gold border
- "+XP" text examples
- Animation description

### Procedural Textures

**Glow Texture** (radial gradient):
```typescript
function createGlowTexture(color: number, size = 64, sharpness = 3.0): THREE.DataTexture {
  // Generate RGBA data with radial falloff
  const strength = Math.pow(Math.max(0, 1 - dist), sharpness);
  // Return DataTexture
}
```

**Ring Texture** (annular gradient):
```typescript
function createRingTexture(
  color: number,
  size = 64,
  ringRadius = 0.65,
  ringWidth = 0.22
): THREE.DataTexture {
  // Generate RGBA data with ring pattern
  const ringDist = Math.abs(dist - ringRadius) / ringWidth;
  const strength = Math.exp(-ringDist * ringDist * 4);
  // Return DataTexture
}
```

**Rune Circle** (canvas-based):
```typescript
// Concentric circles, radial spokes, triangular glyphs
const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
// ... draw circles, spokes, glyphs
return new THREE.CanvasTexture(canvas);
```

## Navigation

### Routes

**Added**: `/vfx` route

**Navigation Constants** (`src/constants/navigation.ts`):
```typescript
export const NAVIGATION_VIEWS = {
  // ... existing views
  VFX: "vfx",
};

export const ROUTES = {
  // ... existing routes
  VFX: "/vfx",
};
```

**Navigation Component** (`src/components/shared/Navigation.tsx`):
```tsx
<Link to={ROUTES.VFX} className={navLinkClass(ROUTES.VFX)}>
  <Sparkles size={18} />
  <span>VFX</span>
</Link>
```

### Icon

**Lucide Icon**: `Sparkles`

**Category Icons**:
- Spells: `Sparkles`
- Arrows: `Target`
- Glow: `Flame`
- Fishing: `Waves`
- Teleport: `Sparkles`
- Combat HUD: `Sword`

## Usage

### Browsing Effects

1. Open Asset Forge: `bun run dev:forge`
2. Navigate to VFX tab (Sparkles icon)
3. Click category to expand
4. Click effect to view details

### Viewing Details

**Effect Details Include**:
- Live animated preview (or canvas preview for HUD effects)
- Color palette with hex codes
- Parameter table with values
- Layer breakdown (glow effects)
- Phase timeline (teleport)
- Component list (teleport)
- Variants (combat HUD)

### Copying Effect Data

**Use Case**: Implementing new effects in game code

**Steps**:
1. Browse to desired effect
2. Note color hex codes from swatches
3. Copy parameter values from table
4. Reference layer configuration (glow effects)
5. Implement in game using same values

**Example** (Fire Glow):
```typescript
// From VFX catalog:
// - Palette: #ff4400, #ff6600, #ff8800, #ffaa00, #ffcc00
// - Particles: 28
// - Speed: 0.25-0.35 u/s
// - Spawn Y: 0.0
// - Spread: ±0.04

particleSystem.register('my_fire', {
  type: 'glow',
  preset: 'fire',
  position: { x: 10, y: 0.5, z: 20 }
});
```

## Data Synchronization

### Keeping Catalog Updated

**When game VFX changes**, update catalog data:

1. **Spell Effects**: Update `SPELL_EFFECTS` array in `vfx-catalog.ts`
2. **Arrow Effects**: Update `ARROW_EFFECTS` array
3. **Glow Effects**: Update `GLOW_EFFECTS` array
4. **Fishing Effects**: Update `FISHING_EFFECTS` array
5. **Teleport Effect**: Update `TELEPORT_EFFECT` object
6. **Combat HUD**: Update `COMBAT_HUD_EFFECTS` array

**Verification**:
```bash
# Compare catalog data with game source
diff packages/asset-forge/src/data/vfx-catalog.ts \
     packages/shared/src/data/spell-visuals.ts
```

### Adding New Effects

**Steps**:

1. **Add to game** (packages/shared):
   ```typescript
   // In spell-visuals.ts
   export const NEW_SPELL = {
     color: 0xff00ff,
     coreColor: 0xffffff,
     // ... other properties
   };
   ```

2. **Add to catalog** (packages/asset-forge):
   ```typescript
   // In vfx-catalog.ts
   export const SPELL_EFFECTS: SpellEffect[] = [
     // ... existing spells
     makeSpell('new_spell', 'New Spell', 0xff00ff, 0xffffff, 0.8, BOLT_BASE),
   ];
   ```

3. **Add preview** (if needed):
   ```typescript
   // In VFXPreview.tsx
   {isNewSpell(effect) && <NewSpellPreview effect={effect} />}
   ```

4. **Test**:
   ```bash
   bun run dev:forge
   # Navigate to VFX tab, verify new effect appears
   ```

## Technical Details

### Preview Performance

**Optimization Strategies**:
- Shared geometries (allocated once)
- Shared materials (compiled once)
- Instanced rendering (particles)
- Billboard optimization (camera-facing)
- Texture caching (Map-based)

**Frame Budget**:
- Target: 60 FPS
- Typical: 1-2ms per preview
- Max concurrent: 1 preview at a time (only selected effect)

### Memory Management

**Texture Cache**:
```typescript
const textureCache = new Map<string, THREE.DataTexture>();

function createGlowTexture(color: number, size: number, sharpness: number) {
  const key = `glow-${color}-${size}-${sharpness}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  
  // Generate texture
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  textureCache.set(key, tex);
  return tex;
}
```

**Cleanup**: Textures persist for app lifetime (small memory footprint, ~64KB per texture)

### Animation Loops

**useFrame Hook** (React Three Fiber):
```typescript
useFrame(({ clock, camera }) => {
  const t = clock.getElapsedTime();
  
  // Update effect state
  updatePosition(t);
  updateScale(t);
  updateOpacity(t);
  
  // Billboard toward camera
  mesh.quaternion.copy(camera.quaternion);
});
```

**Loop Timing**:
- Spell orbs: Continuous orbit
- Arrows: Continuous rotation
- Glow particles: Lifetime-based recycling
- Water effects: Continuous cycles
- Teleport: 2.5s loop with 0.8s pause

## Limitations

### No Real-Time Editing

**Current**: Catalog is read-only (browse and view only)

**Future**: Could add:
- Color picker for live editing
- Parameter sliders
- Export to game format
- Save custom presets

### No Effect Comparison

**Current**: View one effect at a time

**Future**: Could add:
- Side-by-side comparison
- Diff view for variants
- Performance comparison

### No Search/Filter

**Current**: Browse by category only

**Future**: Could add:
- Text search
- Color filter
- Parameter range filter
- Tag-based filtering

## Related Files

### New Files
- `packages/asset-forge/src/pages/VFXPage.tsx` - Main page component
- `packages/asset-forge/src/components/VFX/VFXPreview.tsx` - Preview components (1691 lines)
- `packages/asset-forge/src/components/VFX/EffectDetailPanel.tsx` - Detail panel components
- `packages/asset-forge/src/data/vfx-catalog.ts` - Effect metadata (663 lines)

### Modified Files
- `packages/asset-forge/src/App.tsx` - Added VFX route
- `packages/asset-forge/src/components/shared/Navigation.tsx` - Added VFX nav link
- `packages/asset-forge/src/constants/navigation.ts` - Added VFX constants
- `packages/asset-forge/src/types/navigation.ts` - Added VFX type

## Usage Examples

### Viewing Spell Effects

1. Open Asset Forge: `bun run dev:forge`
2. Click VFX tab (Sparkles icon)
3. Expand "Magic Spells" category
4. Click "Fire Bolt"
5. View live preview with orbiting projectile
6. See color palette: Outer (#ff4500), Core (#ffff00)
7. See parameters: Size (0.7), Glow Intensity (0.9), Pulse Speed (5)

### Viewing Teleport Effect

1. Navigate to VFX tab
2. Expand "Teleport" category
3. Click "Teleport"
4. View full 2.5s animated sequence
5. See phase timeline: Gather (0-20%), Erupt (20-34%), Sustain (34-68%), Fade (68-100%)
6. See component list: 10 components with colors and descriptions

### Viewing Glow Particles

1. Navigate to VFX tab
2. Expand "Glow Particles" category
3. Click "Altar"
4. View live particle simulation
5. See palette: Core (#c4b5fd), Mid (#8b5cf6), Outer (#60a5fa)
6. See layer breakdown: 4 layers (pillar, wisp, spark, base) with counts and lifetimes

## Future Enhancements

### Planned Features

1. **Export to Game Format**:
   - Generate TypeScript code from catalog data
   - Export JSON configuration
   - Copy to clipboard

2. **Custom Presets**:
   - Create custom effect variants
   - Save to local storage
   - Share via URL

3. **Performance Metrics**:
   - Draw call count
   - Particle count
   - Memory usage
   - FPS impact

4. **Effect Comparison**:
   - Side-by-side preview
   - Parameter diff view
   - Visual diff

5. **Search & Filter**:
   - Text search by name
   - Color-based filter
   - Parameter range filter
   - Tag system

### Technical Improvements

1. **WebGPU Rendering**:
   - Use WebGPU for previews (better performance)
   - Compute shader particles
   - Advanced post-processing

2. **LOD System**:
   - Reduce particle count at distance
   - Simplify geometry for thumbnails
   - Adaptive quality

3. **Recording**:
   - Export preview as video
   - GIF generation
   - Screenshot capture

## References

- [VFXPage.tsx](packages/asset-forge/src/pages/VFXPage.tsx) - Main page
- [VFXPreview.tsx](packages/asset-forge/src/components/VFX/VFXPreview.tsx) - Preview components
- [vfx-catalog.ts](packages/asset-forge/src/data/vfx-catalog.ts) - Effect metadata
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - 3D rendering library
- [Lucide Icons](https://lucide.dev/) - Icon library
