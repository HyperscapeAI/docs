# @hyperscape/shared

Core 3D multiplayer engine for Hyperscape. Provides Entity Component System (ECS), Three.js WebGPU rendering, PhysX physics, real-time networking, and React UI components.

## Overview

The shared package is the heart of Hyperscape, containing all core game systems that run on both client and server. It's designed for deterministic gameplay with client-side prediction and server-side authority.

## Features

### Rendering (WebGPU Only)
- **Three.js 0.183.2** with WebGPURenderer
- **TSL Shaders** (Three Shading Language) for all materials
- **Post-Processing** - Bloom, tone mapping, color grading
- **VRM Avatars** - Full VRM 1.0 support with animations
- **Impostor System** - LOD optimization for distant entities
- **Procedural Generation** - Terrain, vegetation, buildings

### Physics
- **PhysX WASM** - High-performance physics simulation
- **Tile-Based Movement** - OSRS-style grid movement
- **Collision Detection** - Character controllers, raycasting
- **Pathfinding** - BFS pathfinding with walkability cache

### Networking
- **Client-Side Prediction** - Smooth movement with rollback
- **Server Authority** - All game logic validated server-side
- **Entity Interpolation** - Smooth remote player movement
- **Event System** - Type-safe event bus for game events

### Game Systems
- **Combat System** - Tick-based OSRS combat (600ms ticks)
- **Skills System** - XP-based progression (9+ skills)
- **Inventory System** - 28-slot inventory with drag-and-drop
- **Equipment System** - Paperdoll with stat bonuses
- **Banking System** - 480-slot bank with tabs
- **Death System** - OSRS keep-3 with gravestone loot
- **Prayer System** - Prayer points and active prayers
- **Quest System** - Quest tracking and progression

### UI Components
- **React 19.2.0** - Modern React with hooks
- **Themed UI** - Consistent design system
- **Drag-and-Drop** - dnd-kit integration
- **Modal System** - Window management
- **Skilling Panels** - Unified crafting/processing UI
- **Dialogue System** - NPC dialogue with live portraits

## Installation

```bash
# From monorepo root
bun install

# Build shared package
bun run build:shared
```

## Usage

### Client-Side

```typescript
import { createClientWorld } from "@hyperscape/shared";

const world = await createClientWorld({
  canvas: document.getElementById("game-canvas"),
  isServer: false,
});

// Start game loop
function animate() {
  requestAnimationFrame(animate);
  world.update(deltaTime);
}
animate();
```

### Server-Side

```typescript
import { createServerWorld } from "@hyperscape/shared";

const world = await createServerWorld({
  isServer: true,
  worldPath: "./world",
});

// Start tick loop (600ms OSRS ticks)
setInterval(() => {
  world.update(0.6);
}, 600);
```

## Architecture

### Entity Component System (ECS)

```typescript
// Entities are game objects
class PlayerEntity extends Entity {
  health: number;
  position: Vector3;
  inventory: InventoryComponent;
}

// Systems process entities
class CombatSystem extends SystemBase {
  update(deltaTime: number) {
    for (const entity of this.world.entities.values()) {
      if (entity instanceof CombatantEntity) {
        this.processCombat(entity, deltaTime);
      }
    }
  }
}

// Components are data containers
interface InventoryComponent {
  items: InventoryItem[];
  capacity: number;
}
```

### Event System

```typescript
// Type-safe event bus
world.on("PLAYER_SET_DEAD", (data: { playerId: string; killedBy?: string }) => {
  console.log(`Player ${data.playerId} died`);
});

world.emit("PLAYER_SET_DEAD", { playerId: "player_123", killedBy: "Goblin" });
```

### System Registration

```typescript
// Systems are registered in world creation
const world = await createServerWorld({
  systems: [
    PlayerSystem,
    CombatSystem,
    InventorySystem,
    SkillsSystem,
    // ... more systems
  ],
});
```

## Key Systems

### PlayerDeathSystem

Handles player death with OSRS-accurate mechanics:

- **Keep-3 System**: Safe zone deaths keep 3 most valuable items
- **Two-Phase Persist**: In-memory clear inside tx, DB persist after
- **Death Locks**: Prevent state desync during death-to-respawn window
- **Gravestone Privacy**: Loot items hidden from broadcast
- **Crash Recovery**: Persist kept items for server crash scenarios

**Documentation**: See `docs/death-system-architecture.md`

### CombatSystem

Tick-based OSRS combat:

- **600ms Ticks**: All combat actions aligned to tick boundaries
- **Attack Styles**: Accurate, Aggressive, Defensive, Controlled
- **Damage Calculation**: Based on Attack/Strength levels and equipment
- **Auto-Retaliate**: Automatic counter-attacks
- **Prayer System**: Prayer points and active prayers

### InventorySystem

28-slot inventory with OSRS mechanics:

- **Stack Handling**: Stackable items (arrows, coins) vs non-stackable (equipment)
- **Weight System**: Item weights affect movement speed
- **Drag-and-Drop**: Reorder items, drop to ground
- **Transaction Locks**: Prevent item duplication during trades/banking

### BankingSystem

480-slot bank with tabs:

- **Tab System**: Organize items into tabs
- **Placeholders**: Reserve slots for specific items
- **Equipment Storage**: Store/retrieve equipped items
- **Coin Pouch**: Separate coin storage

### TerrainSystem

Procedural terrain generation:

- **Biome System**: Multiple biomes with unique vegetation
- **Height Mapping**: Realistic terrain with hills and valleys
- **Walkability**: Pre-baked walkability flags for pathfinding
- **Collision**: Low-res collision mesh (16×16) for performance
- **Streaming**: Chunk-based loading for large worlds

## Recent Changes (March 2026)

### Player Death System Overhaul (March 26, 2026)

Complete rewrite to fix SQLite deadlock, equipment duplication, and implement OSRS keep-3.

**New Files**:
- `src/systems/shared/combat/DeathUtils.ts` - Pure utility functions
- `src/systems/shared/combat/DeathTypes.ts` - Type definitions
- `src/systems/shared/death/DeathStateManager.ts` - Death lock CRUD

**Breaking Changes**:
- `PLAYER_DIED` event deprecated → use `PLAYER_SET_DEAD`
- Death lock schema includes `keptItems` field

**Documentation**: See `docs/death-system-architecture.md` and `docs/migrations/player-died-event-migration.md`

### UI Improvements (March 26, 2026)

**Skilling Panels** (PR #1093):
- Unified layouts across all skilling panels
- Shared components: `SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector`
- Consistent styling with `getSkillingSelectableStyle()` and `getSkillingBadgeStyle()`

**Dialogue System** (PR #1093):
- `DialoguePopupShell` - Dedicated modal for NPC dialogue
- `DialogueCharacterPortrait` - Live 3D VRM portrait rendering
- Service handoff fix (bank/store/tanner closes dialogue)

**Documentation**: See `docs/ui-improvements-march-2026.md`

### Performance Optimizations (March 19-20, 2026)

**BFS Pathfinding**:
- Global iteration budget (12,000 per tick)
- Zero-allocation scratch tiles
- Per-tick walkability cache

**Terrain System**:
- Low-res collision (16×16)
- Time-budgeted processing
- Pre-baked walkability flags

**Documentation**: See `docs/performance-march-2026.md`

## API Reference

### Core Classes

#### World

Main game world container:

```typescript
class World {
  entities: Map<string, Entity>;
  systems: Map<string, System>;
  
  getEntity(id: string): Entity | undefined;
  getSystem(name: string): System | undefined;
  update(deltaTime: number): void;
  on(event: string, handler: Function): void;
  emit(event: string, data: unknown): void;
}
```

#### Entity

Base class for all game objects:

```typescript
class Entity {
  id: string;
  type: string;
  position: Vector3;
  
  update(deltaTime: number): void;
  serialize(): EntityData;
  deserialize(data: EntityData): void;
}
```

#### SystemBase

Base class for all game systems:

```typescript
class SystemBase {
  world: World;
  logger: Logger;
  
  init(): void;
  update(deltaTime: number): void;
  destroy(): void;
}
```

### Utility Functions

#### DeathUtils

```typescript
// XSS/Unicode/injection protection
function sanitizeKilledBy(killedBy: unknown): string

// OSRS keep-3 with stack handling
function splitItemsForSafeDeath(
  allItems: InventoryItem[],
  keepCount: number
): { kept: InventoryItem[]; dropped: InventoryItem[] }

// Position validation
function validatePosition(position: Position3D): Position3D | null
function isPositionInBounds(position: Position3D): boolean
```

#### CombatCalculations

```typescript
// Calculate max hit for melee
function calculateMaxHit(
  strengthLevel: number,
  strengthBonus: number,
  prayerMultiplier: number
): number

// Calculate accuracy roll
function calculateAccuracyRoll(
  attackLevel: number,
  attackBonus: number,
  prayerMultiplier: number
): number

// Calculate defense roll
function calculateDefenseRoll(
  defenseLevel: number,
  defenseBonus: number,
  prayerMultiplier: number
): number
```

## Testing

### Unit Tests

```bash
# Run all shared package tests
npm test --workspace=packages/shared

# Run specific test file
npm test --workspace=packages/shared -- DeathUtils.test.ts
```

### Integration Tests

Tests use real Hyperscape instances with Playwright:

```bash
# Run integration tests
npm test --workspace=packages/shared -- --grep "integration"
```

## Contributing

### Code Standards

- **No `any` types** - ESLint will reject them
- **Prefer classes over interfaces** - For type definitions
- **No mocks in tests** - Use real Hyperscape instances
- **WebGPU only** - No WebGL code or fallbacks
- **Strong typing** - Make type assumptions based on context

### File Organization

- **Systems**: `src/systems/shared/` (shared), `src/systems/client/` (client-only), `src/systems/server/` (server-only)
- **Entities**: `src/entities/player/`, `src/entities/npc/`, `src/entities/world/`
- **Types**: `src/types/` with subdirectories for categories
- **Utils**: `src/utils/` with subdirectories for categories

### Adding New Systems

1. Create system class extending `SystemBase`
2. Implement `init()`, `update()`, `destroy()` methods
3. Register in world creation (`createClientWorld` or `createServerWorld`)
4. Add tests in `__tests__/` directory
5. Document in system file with JSDoc comments

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
bun run clean
rm -rf node_modules
bun install
bun run build
```

### PhysX Errors

PhysX WASM is pre-built. If you need to rebuild:

```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Type Errors

```bash
# Check types without building
bun run typecheck
```

### WebGPU Not Available

**Error**: `navigator.gpu is undefined`

**Solutions**:
1. Use Chrome 113+, Edge 113+, or Safari 18+
2. Check [webgpureport.org](https://webgpureport.org) for browser support
3. Enable WebGPU in browser flags (if behind flag)
4. Update graphics drivers

## License

MIT - See LICENSE file
