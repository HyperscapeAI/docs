# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hyperscape is a RuneScape-style MMORPG built on a custom 3D multiplayer engine. The project features a real-time 3D metaverse engine (Hyperscape) in a persistent world.

## Essential Commands

### Development Workflow
```bash
# Install dependencies
bun install

# Build all packages (required before first run)
bun run build

# Development mode with hot reload
bun run dev

# Start game server (production mode)
bun start               # or: cd packages/server && bun run start

# Run all tests
npm test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

### Package-Specific Commands
```bash
# Build individual packages
bun run build:shared    # Core engine (must build first)
bun run build:client    # Web client
bun run build:server    # Game server

# Development mode for specific packages
bun run dev:shared      # Shared package with watch mode
bun run dev:client      # Client with Vite HMR
bun run dev:server      # Server with auto-restart
```

### Testing
```bash
# Run all tests (uses Playwright for real gameplay testing)
npm test

# Run tests for specific package
npm test --workspace=packages/server

# Tests MUST use real Hyperscape instances - NO MOCKS ALLOWED
# Visual testing with screenshots and Three.js scene introspection
```

**Test Suite Status (as of Feb 22, 2026):**
- ✅ 1569 tests passing
- ⏭️ 85 tests skipped (pending deeper refactoring)
- 🔧 WebGPU mocks added for Three.js WebGPU renderer compatibility

**Recent Test Infrastructure Improvements:**

- **WebGPU Mocks** (commit 25ba63c): Added `vitest.setup.ts` to mock WebGPU browser globals
  - Mocks: GPUShaderStage, GPUBufferUsage, GPUTextureUsage, GPUTextureFormat, etc.
  - Required by Three.js WebGPU renderer in test environment
  - Prevents "GPUShaderStage is not defined" errors
  - Location: `packages/server/vitest.setup.ts`

- **ArenaService Test Helpers** (commit 25ba63c): Added protected passthrough methods for test spying
  - Methods: getDb, getEligibleAgents, findReferralMappingForWalletNetwork
  - Methods: listIdentityWallets, listLinkedWallets, recordFeeShare, awardPoints
  - Database mock helper: `setDbMock` properly configures world.getSystem("database") mock

- **Skipped Tests** (pending refactoring):
  - ArenaService lifecycle tests (need createBetOpenRound fix)
  - ArenaService simulation tests (need architecture updates)
  - ArenaService referrals tests (sub-services call ctx directly)
  - StreamingDuelScheduler unit tests (internal methods moved)
  - Admin index integration tests (need DB migrations)

- **CI Reliability Improvements**:
  - Foundry toolchain installed for anvil binary (commit b344d9e)
  - Chain setup skipped when CI=true (commit 034f9c9)
  - EVM contracts excluded from turbo test filter
  - Docs update failures handled gracefully (continue-on-error)
  - Assets directory removed before clone to avoid conflicts (commit 6ce05cc)

### Mobile Development
```bash
# iOS
npm run ios             # Build, sync, and open Xcode
npm run ios:dev         # Sync and open without rebuild
npm run ios:build       # Production build

# Android
npm run android         # Build, sync, and open Android Studio
npm run android:dev     # Sync and open without rebuild
npm run android:build   # Production build

# Capacitor sync (copy web build to native projects)
npm run cap:sync        # Sync both platforms
npm run cap:sync:ios    # iOS only
npm run cap:sync:android # Android only
```

### Documentation
```bash
# Generate API documentation (TypeDoc)
npm run docs:generate

# Start docs dev server (http://localhost:3402)
bun run docs:dev

# Build production docs
npm run docs:build
```

## Architecture Overview

### Monorepo Structure

This is a **Turbo monorepo** with packages:

```
packages/
├── shared/              # Core Hyperscape 3D engine
│   ├── Entity Component System (ECS)
│   ├── Three.js + PhysX integration
│   ├── Real-time multiplayer networking
│   ├── GPU-instanced ParticleManager (fishing spots, future effects)
│   └── React UI components
├── server/              # Game server (Fastify + WebSockets)
│   ├── World management
│   ├── PostgreSQL persistence
│   ├── Duel trash talk system (LLM + scripted fallbacks)
│   └── LiveKit voice chat integration
├── client/              # Web client (Vite + React)
│   ├── 3D rendering
│   ├── Player controls
│   └── UI/HUD
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation (GPT-4, MeshyAI)
├── gold-betting-demo/   # Solana CLOB betting integration (mainnet)
└── docs-site/           # Docusaurus documentation site
```

### Build Dependency Graph

**Critical**: Packages must build in this order due to dependencies:

1. **physx-js-webidl** - PhysX WASM (takes longest, ~5-10 min first time)
2. **shared** - Depends on physx-js-webidl
3. **All other packages** - Depend on shared

The `turbo.json` configuration handles this automatically via `dependsOn: ["^build"]`.

### Entity Component System (ECS)

The RPG is built using Hyperscape's ECS architecture:

- **Entities**: Game objects (players, mobs, items, trees)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (combat, skills, movement)

All game logic runs through systems, not entity methods. Entities are just data containers.

### Model Cache Improvements

**IndexedDB Processed Model Cache Fixes (commit c98f1cc, PR #935, Feb 25 2026):**

Fixed three critical bugs in the IndexedDB processed model cache that caused missing objects and lost textures after page reload.

**Bug 1 - Missing Objects (e.g., altars):**

**Issue**: `serializeNode` used `findIndex-by-name` to map hierarchy nodes to mesh data. Models with duplicate mesh names (common: "", "Cube", "Cube") all resolved to the same index. During deserialization, Three.js `add()` auto-removes from previous parent, so only the last reference survived.

**Fix**: Use `Map<Object3D, number>` identity map built during traversal instead of name-based lookup:

```typescript\n// Build identity map during mesh collection\nconst meshNodeToIndex = new Map<THREE.Object3D, number>();\nscene.traverse((node) => {\n  if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {\n    meshNodeToIndex.set(node, meshes.length);\n    // ... collect mesh data\n  }\n});\n\n// Use identity map during hierarchy serialization\nprivate serializeNode(\n  node: THREE.Object3D,\n  meshNodeToIndex: Map<THREE.Object3D, number>,\n): SerializedNode {\n  let meshIndex: number | undefined;\n  if (node instanceof THREE.SkinnedMesh || node instanceof THREE.Mesh) {\n    meshIndex = meshNodeToIndex.get(node); // Object identity, not name\n  }\n  // ...\n}\n```\n\n**Bug 2 - Lost Textures (white/wrong colors after restart):**\n\n**Issue**: Textures were serialized as ephemeral `blob:` URLs but never reloaded during deserialization. The blob URLs become invalid after page reload, causing textures to fail loading silently.\n\n**Fix**: Extract raw RGBA pixels via canvas `getImageData` (synchronous) and restore as `THREE.DataTexture` — no async loading race conditions:\n\n```typescript\nprivate textureToPixelData(texture: THREE.Texture): SerializedTextureData | null {\n  const image = texture.source?.data ?? texture.image;\n  if (!image) return null;\n\n  const canvas = document.createElement(\"canvas\");\n  canvas.width = image.naturalWidth || image.width;\n  canvas.height = image.naturalHeight || image.height;\n  const ctx = canvas.getContext(\"2d\");\n  ctx.drawImage(image, 0, 0);\n  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);\n  return { pixels: imageData.data.buffer, width: canvas.width, height: canvas.height };\n}\n\n// Restore during deserialization\nconst restoreTex = (td: SerializedTextureData, srgb: boolean): THREE.DataTexture => {\n  const tex = new THREE.DataTexture(\n    new Uint8ClampedArray(td.pixels),\n    td.width,\n    td.height,\n    THREE.RGBAFormat,\n  );\n  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;\n  tex.needsUpdate = true;\n  return tex;\n};\n```\n\n**Bug 3 - Grey Tree Materials (WebGPU build):**\n\n**Issue**: `createDissolveMaterial` used `instanceof MeshStandardMaterial` which fails for `MeshStandardNodeMaterial` in the WebGPU build where they are separate classes.\n\n**Fix**: Replace `instanceof` check with duck-type property check:\n\n```typescript\n// Before\nif (source instanceof THREE.MeshStandardMaterial) {\n  material.color.copy(source.color);\n  // ...\n}\n\n// After\nconst src = source as THREE.MeshStandardMaterial & { map?: THREE.Texture | null; /* ... */ };\nif (src.color && src.roughness !== undefined) {\n  material.color.copy(src.color);\n  // ...\n}\n```\n\n**Impact:**\n- Altars, trees, and other complex models now render correctly after page reload\n- Textures persist across sessions with proper colors\n- WebGPU build materials work correctly\n- Cache version bumped to 3 to invalidate broken entries\n\n**Files**: \n- `packages/shared/src/utils/rendering/ModelCache.ts` (texture serialization)\n- `packages/shared/src/systems/shared/world/GPUVegetation.ts` (material duck-typing)\n\n**Cache Control:**\n- Set `localStorage.setItem('disable-model-cache', 'true')` to bypass cache for debugging\n- Error logging on IndexedDB put/transaction failures\n- Cache version bumped to 3 to invalidate broken entries\n\n### Rendering Optimization Architecture\n\n**GLBTreeInstancer** (commit 0871acb) - InstancedMesh-based tree rendering

Replaces per-tree `scene.clone(true)` with shared InstancedMesh pools per LOD level. Trees from woodcutting.json now render via shared geometry references instead of deep-cloning all buffers on each spawn, eliminating FPS drops when approaching tree chunks.

**Key Components:**

1. **GLBTreeInstancer** (`packages/shared/src/systems/shared/world/GLBTreeInstancer.ts`)
   - Manages LOD0/LOD1/LOD2 InstancedMesh pools per model
   - Allocates instance slots from pre-sized pools (max 1000 instances per LOD)
   - Handles depleted/stump/destroy lifecycle via no-op-safe calls
   - Initialized in `createClientWorld.ts` when stage scene is ready

2. **ResourceEntity Integration** (`packages/shared/src/entities/world/ResourceEntity.ts`)
   - Routes GLB trees through instancer instead of scene.clone()
   - Calls `instancer.allocate()` on spawn, `instancer.free()` on destroy
   - Handles stump state by freeing instance and spawning separate stump mesh
   - Falls back to traditional rendering for non-GLB trees (procgen, fishing spots)

3. **Performance Impact:**
   - Eliminated per-tree geometry cloning (saves ~2-5ms per tree spawn)
   - Reduced draw calls from N trees to 3 (one per LOD level)
   - FPS improvement: ~15-20% in dense forest areas
   - Memory savings: ~80% reduction in geometry buffer allocations

**ResourceEntity Visual Strategy Pattern** (commit bc60264) - Delegated visual strategies

Refactored ResourceEntity (~1700 lines removed) into delegated visual strategies using the Strategy Pattern. This separates rendering logic from entity lifecycle management.

**Visual Strategies:**

1. **TreeGLBVisualStrategy** - GLB tree models with LOD support
   - Uses GLBTreeInstancer for instanced rendering
   - Handles LOD transitions based on camera distance
   - Manages stump state transitions

2. **TreeProcgenVisualStrategy** - Procedurally generated trees
   - Uses ProcgenTreeInstancer for procedural geometry
   - Supports runtime tree generation with L-system parameters
   - Handles leaf/branch color variations

3. **StandardModelVisualStrategy** - Generic 3D models (rocks, ores)
   - Loads GLB models via ModelCache
   - Handles scale and rotation from manifest
   - Supports depleted model swapping

4. **FishingSpotVisualStrategy** - Fishing spot particles
   - Registers with ParticleManager for GPU-instanced water effects
   - Handles ripple/splash/bubble animations
   - Manages particle lifecycle on depletion

5. **PlaceholderVisualStrategy** - Fallback for missing models
   - Uses PlaceholderInstancer for instanced colored cubes
   - Color-coded by resource type (green=tree, brown=ore, blue=fishing)
   - Automatically used when modelPath is null or "null" string

**Factory Pattern:**

`createVisualStrategy()` factory (`packages/shared/src/entities/world/visuals/createVisualStrategy.ts`) selects strategy based on:
- Resource type (tree, ore, fishing_spot)
- Model path (GLB, procgen, null)
- Manifest configuration

**Benefits:**
- Single Responsibility: Each strategy handles one rendering approach
- Open/Closed: Add new strategies without modifying ResourceEntity
- Testability: Strategies can be tested in isolation
- Maintainability: ~1700 lines of conditional logic replaced with clean delegation

**PlaceholderInstancer** (commit bc60264) - Instanced rendering for placeholder meshes

Manages InstancedMesh pools for placeholder resources (trees/ores with missing models). Prevents individual BoxGeometry creation per resource.

- Initialized in `createClientWorld.ts` alongside GLBTreeInstancer
- Color-coded: green (trees), brown (ores), blue (fishing spots)
- Lifecycle: `allocate()` on spawn, `free()` on destroy
- Max 1000 instances per resource type

**Bug Fixes:**
- Fixed fishing spot particles persisting after depletion (commit bc60264)
  - Guard re-registration when depleted
  - Zero ripple phase offset on unregister for full transparency
- Fixed placeholder trees not rendering due to "null" string in modelPath (commit bc60264)
  - Sanitize in ResourceSystem + createVisualStrategy factory
  - Fixed woodcutting.json to use null instead of "null" string

### GPU-Instanced Rendering Architecture

**Duel Arena InstancedMesh Optimization** (commit c20d0fc, PR #938, Feb 25 2026) - 97% draw call reduction

Converted the duel arena from individual meshes to InstancedMesh architecture, eliminating the rendering bottleneck caused by 28 dynamic PointLights and ~846 individual draw calls.

**Performance Impact:**
- Draw calls: 846 → 22 (97% reduction)
- Removed all 28 dynamic PointLights (primary FPS killer — each light forced expensive per-pixel shading passes)
- Replaced with single GPU-driven TSL emissive material on brazier bowls
- Significant FPS improvement in duel arenas, especially with multiple active duels

**InstancedMesh Batching:**
- Fence posts: 288 instances → 1 draw call
- Fence caps: 288 instances → 1 draw call
- Fence rails (X-axis): 36 instances → 1 draw call
- Fence rails (Z-axis): 36 instances → 1 draw call
- Pillar bases: 32 instances → 1 draw call
- Pillar shafts: 32 instances → 1 draw call
- Pillar capitals: 32 instances → 1 draw call
- Brazier bowls: 24 instances → 1 draw call (with TSL glow)
- Border strips (N/S): 12 instances → 1 draw call
- Border strips (E/W): 12 instances → 1 draw call
- Banner poles: 12 instances → 1 draw call

**TSL Brazier Glow Material:**
- GPU-animated emissive flicker replaces 28 CPU-animated PointLights
- Per-instance phase offset derived from world position (quantized so all vertices of one brazier share same phase)
- Multi-frequency sine flicker + high-freq noise matches old PointLight behavior
- Only top face (fire opening) glows; outer shell stays dark via normal-based masking
- Zero CPU cost per frame — all animation runs on GPU via `emissiveNode`

**Enhanced Fire Particle Preset:**
- Removed `"torch"` preset, unified on enhanced `"fire"` preset
- Smooth value noise fragment shader (bilinear interpolated hash lattice) for organic flame shapes
- Soft radial falloff designed for additive blending — overlapping particles merge into cohesive flame body
- Per-particle turbulent vertex motion for natural flickering
- Height-based color gradient (white-yellow core → orange-red tips)
- Scrolling noise gives organic edges and upward motion feel

**Individual Meshes (still needed for raycasting):**
- Arena floors: 6 meshes (need per-floor arenaId and layer 0+2 for click-to-move)
- Forfeit pillars: 12 meshes (need unique entityId userData for interaction)
- Banner cloths: 12 meshes (3 shared color materials)

**Removed Dead Code:**
- `createArenaMarker()` — arena number markers were unused
- `createAmbientDust()` — ambient dust particles were unused
- `createLobbyBenches()` — lobby benches were unused

**Files**: 
- `packages/shared/src/systems/client/DuelArenaVisualsSystem.ts` (arena rendering)
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts` (fire particles)

**ParticleManager** (commit 4168f2f, PR #877) - Centralized GPU-instanced particle rendering

**Performance Impact:**
- Reduced fishing spot draw calls from ~150 to 4 (97% reduction)
- Removed ~450 lines of per-entity CPU animation code
- FPS improvement: 65-70 → 120 on reference hardware

**Architecture:**

```
ParticleManager (central router)
├── WaterParticleManager (fishing spots)
│   ├── Splash layer (InstancedMesh, parabolic arcs)
│   ├── Bubble layer (InstancedMesh, rise + wobble)
│   ├── Shimmer layer (InstancedMesh, surface twinkle)
│   └── Ripple layer (InstancedMesh, expanding rings)
└── [Future managers: fire, magic, dust, etc.]
```

**Key Components:**

1. **ParticleManager** (`packages/shared/src/entities/managers/particleManager/ParticleManager.ts`)
   - Central entry point for all particle systems
   - Routes events to specialized sub-managers based on resource type
   - Extensible architecture for adding new particle types

2. **WaterParticleManager** (`packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`)
   - 4 GPU InstancedMeshes (splash, bubble, shimmer, ripple)
   - TSL NodeMaterials with InstancedBufferAttributes
   - Per-instance data: spotPos (vec3), ageLifetime (vec2), angleRadius (vec2), dynamics (vec4)
   - GPU-computed: billboard orientation, parabolic arcs, wobble, twinkle, ring expansion

3. **ResourceSystem Integration** (`packages/shared/src/systems/shared/entities/ResourceSystem.ts`)
   - Creates ParticleManager on client startup
   - Forwards resource events via `handleResourceEvent()`
   - Calls `particleManager.update(dt, camera)` per frame

4. **ResourceEntity Delegation** (`packages/shared/src/entities/world/ResourceEntity.ts`)
   - Registers fishing spots with ParticleManager via `tryRegisterWithParticleManager()`
   - Retains only lightweight glow mesh for interaction detection
   - Lazy registration pattern handles timing/lifecycle edge cases

**Vertex Buffer Budget:**
- Particle layers: 7 of 8 max attributes (position, uv, instanceMatrix, spotPos, ageLifetime, angleRadius, dynamics)
- Ripple layer: 5 of 8 max attributes (position, uv, instanceMatrix, spotPos, rippleParams)

**Adding New Particle Types:**
1. Create sub-manager class in `packages/shared/src/entities/managers/particleManager/`
2. Instantiate in ParticleManager constructor
3. Add routing logic in register/unregister/move/handleEvent methods
4. Call update() and dispose() from ParticleManager

**Fishing Spot Variants:**
- Net fishing: calm/gentle (2 ripples, 4 splash, 3 bubble, 3 shimmer)
- Bait fishing: medium activity (2 ripples, 5 splash, 4 bubble, 4 shimmer)
- Fly fishing: active (2 ripples, 8 splash, 5 bubble, 5 shimmer)

### Duel Combat Role System

**Combat Roles** (PR #933, commit 82ff784) - Weighted random role selection with full gear lifecycle

The duel system now supports three combat roles with automatic gear provisioning:

**Combat Roles:**
- **Melee** (50% weight): Traditional melee combat with bronze weapons (longsword, scimitar, 2h sword)
- **Ranged** (25% weight): Shortbow + bronze arrows (500 qty), uses "rapid" attack style
- **Mage** (25% weight): Staff of air + wind strike autocast + runes (500 mind, 500 air)

**Implementation:**

1. **DuelOrchestrator** (`packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`)
   - `pickCombatRole()`: Weighted random selection from DUEL_COMBAT_ROLE_WEIGHTS
   - `ensureAgentCombatSetup()`: Routes to role-specific gear equip methods
   - `equipMeleeWeapon()`: Random bronze weapon from DUEL_BRONZE_WEAPON_IDS (longsword, scimitar, 2h sword)
   - `equipRangedGear()`: Shortbow + bronze arrows (500 qty)
   - `equipMageGear()`: Staff of air + wind strike autocast + runes (500 mind, 500 air)
   - `cleanupAgentCombatSetup()`: Full gear removal after duel (weapons, arrows, runes, autocast)

2. **DuelCombatAI** (`packages/server/src/arena/DuelCombatAI.ts`)
   - Receives `combatRole` in config
   - **Melee**: Uses existing phase-based style switching (aggressive/controlled/defensive)
   - **Ranged**: Forces "rapid" style for faster attack speed (-1 tick)
   - **Mage**: Skips style switching entirely (magic auto-casts via selectedSpell)

3. **Gear Lifecycle:**
   - **Pre-duel**: Role selected → gear equipped → food filled → health restored
   - **Post-duel**: Gear removed → food removed → health restored → teleport back
   - **Cleanup**: Unequips weapon/arrows, clears autocast, removes leftover runes

**Weapon Type Filtering:**

Only weapon types with new models in `swords/` directory are eligible for duel arenas:
- LONGSWORD, SCIMITAR, TWO_HAND_SWORD
- Filtered via `DUEL_WEAPON_TYPES` Set in DuelOrchestrator
- Prevents equipping weapons without proper 3D models

**Critical Bug Fixes (PR #933, #934):**

1. **Combat State Key Mismatch** (commit 82ff784, PR #933)
   - **Issue**: CombatStateService syncs abbreviated keys (`data.c`/`data.ct`) but `getGameState()` only read full keys (`data.inCombat`/`data.combatTarget`)
   - **Impact**: DuelCombatAI always saw `inCombat=false` and flooded `executeAttack` every tick instead of letting auto-attacks drive combat
   - **Fix**: EmbeddedHyperscapeService now reads both abbreviated and full keys: `data.c || data.inCombat` and `data.ct || data.combatTarget`
   - **File**: `packages/server/src/eliza/EmbeddedHyperscapeService.ts`

2. **Magic Attack TOCTOU Race** (commit 82ff784, PR #933)
   - **Issue**: Cooldown was checked early but claimed after async `consumeRunesForSpell` call. With bug #1 flooding attacks, two concurrent invocations could both pass the cooldown check before either claimed it
   - **Impact**: Duplicate magic projectiles, double rune consumption
   - **Fix**: Moved cooldown claim and `enterCombat` before async rune consumption to close the race window
   - **File**: `packages/shared/src/systems/shared/combat/CombatSystem.ts` (handleMagicAttack)

3. **Mage Staff and 2H Sword Combat** (commit 029456, PR #934, Feb 25 2026)
   - **Keep-alive re-engagement**: Added periodic re-engagement in DuelCombatAI every 5 ticks (~3s) to prevent agents idling when combat state times out. Fixes 2H sword attacks where slow weapon speed (7 ticks) combined with combat timeout caused agents to stand idle.
   - **Weapon type propagation**: Propagate weapon type (mage/ranged/melee) through DuelOrchestrator into `startCombat` so CombatSystem creates correct state with proper attack speeds. Without this, all agents defaulted to MELEE, preventing magic and ranged agents from firing projectile-based attacks.
   - **Rune inventory readiness**: Added polling loop (up to 2 seconds) to wait for inventory to finish loading from DB before adding runes. Without this, `getOrCreateInventory` returns a disposable placeholder (not stored in the Map) and runes are silently lost.
   - **Combat state starvation guard**: Don't replace existing combat state if agent already has valid state targeting correct opponent. `createAttackerState` replaces the state Map entry which resets `nextAttackTick` — for slow weapons (2H swords, attackSpeed 7) the auto-attack loop never reaches `nextAttackTick` because repeated re-engagement keeps pushing it forward (starvation pattern).
   - **Combat timeout refresh**: Refresh combat timeout after ranged/magic attacks in both CombatSystem and CombatTickProcessor. The handler may have replaced the state via `enterCombat` → `createAttackerState`, so fetch fresh state from Map (old reference may be stale).
   - **PvP zone bypass**: Bypass PvP zone checks for streaming duel combatants (matches `enterCombat` behavior). Prevents combat from ending when agents are in duel arenas which are technically safe zones.
   - **Safe zone aggro block**: Block aggro and chase on players in safe zones via AggroSystem. Hostile mobs won't auto-aggro players in safe zones, and will stop chasing if player enters safe zone.
   - **Rune validation bypass**: Streaming duel agents bypass rune validation since inventory-based rune addition is unreliable for bot agents (race conditions, manifest loading timing). Staff provides infinite elemental runes; only catalytic runes (mind/chaos) would fail. Since these are AI bots with no real economy, let the attack proceed.
   - **Files**: `packages/server/src/arena/DuelCombatAI.ts`, `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`, `packages/shared/src/systems/shared/combat/CombatSystem.ts`, `packages/shared/src/systems/shared/combat/CombatTickProcessor.ts`, `packages/shared/src/systems/shared/combat/AggroSystem.ts`

### Duel Trash Talk System

**DuelCombatAI Trash Talk** (commit 8ff3ad3) - AI agents taunt during combat

**Features:**
- Health threshold detection at 75%, 50%, 25%, 10% for self and opponent
- LLM-generated taunts using agent character bio/style via TEXT_SMALL model
- Scripted fallback taunt pools when no LLM runtime available
- Ambient periodic taunts every 15-25 ticks
- 8-second cooldown between messages
- Fire-and-forget message delivery (non-blocking)

**Implementation:**

1. **DuelCombatAI** (`packages/server/src/arena/DuelCombatAI.ts`)
   - Health monitoring with threshold tracking
   - LLM taunt generation with character-specific prompts
   - Fallback taunt pools for offline/no-runtime scenarios
   - Ambient taunt timer with randomized intervals

2. **DuelOrchestrator Integration** (`packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`)
   - Wires `sendChatMessage` callbacks into combat AIs
   - Passes through to social system for broadcast

3. **Social System** (`packages/shared/src/systems/shared/character/social.ts`)
   - CHAT_MESSAGE action now allowed during combat
   - Broadcasts taunts to spectators and participants

**Taunt Categories:**
- Self health thresholds: 75%, 50%, 25%, 10%
- Opponent health thresholds: 75%, 50%, 25%, 10%
- Ambient taunts (periodic, no trigger)

**Testing:**
- 5 new trash talk tests added (14/14 passing)
- Tests verify LLM generation, fallback pools, cooldowns, and health triggers

**Combat AI Improvements (commit 7a60135):**
- Simplified DuelCombatAI attack loop to remove redundant manual attack-speed tracking
- Combat system's auto-attack loop already drives attack cadence
- AI only needs to re-engage when combat drops or target changes
- Added missing TWO_HAND_SWORD default attack style to prevent undefined style errors
- Fixes 2H sword attack timing issues where attacks were silently dropped

### RPG Implementation Architecture

**Important**: Despite references to "Hyperscape apps (.hyp)" in development rules, `.hyp` files **do not currently exist**. This is an aspirational architecture pattern for future development.

**Current Implementation**:
The RPG is built directly into [packages/shared/src/](packages/shared/src/) using:
- **Entity Classes**: [PlayerEntity.ts](packages/shared/src/entities/player/PlayerEntity.ts), [MobEntity.ts](packages/shared/src/entities/npc/MobEntity.ts), [ItemEntity.ts](packages/shared/src/entities/world/ItemEntity.ts)
- **ECS Systems**: Combat, inventory, skills, AI in [src/systems/](packages/shared/src/systems/)
- **Components**: Data containers for stats, health, equipment, etc.

**Design Principle** (from development rules):
- Keep RPG game logic **conceptually isolated** from core Hyperscape engine
- Use existing Hyperscape abstractions (ECS, networking, physics)
- Don't reinvent systems that Hyperscape already provides
- Separation of concerns: core engine vs. game content

## Critical Development Rules

### TypeScript Strong Typing

**NO `any` types are allowed** - ESLint will reject them.

- **Prefer classes over interfaces** for type definitions
- Use type assertions when you know the type: `entity as Player`
- Share types from `types.ts` files - don't recreate them
- Use `import type` for type-only imports
- Make strong type assumptions based on context (don't over-validate)

```typescript
// ❌ FORBIDDEN
const player: any = getEntity(id);
if ('health' in player) { ... }

// ✅ CORRECT
const player = getEntity(id) as Player;
player.health -= damage;
```

### File Management

**Don't create new files unless absolutely necessary.**

- Revise existing files instead of creating `_v2.ts` variants
- Delete old files when replacing them
- Update all imports when moving code
- Clean up test files immediately after use
- Don't create temporary `check-*.ts`, `test-*.mjs`, `fix-*.js` files

### Testing Philosophy

**NO MOCKS** - Use real Hyperscape instances with Playwright.

Every feature MUST have tests that:
1. Start a real Hyperscape server
2. Open a real browser with Playwright
3. Execute actual gameplay actions
4. Verify with screenshots + Three.js scene queries
5. Save error logs to `/logs/` folder

Visual testing uses colored cube proxies:
- 🔴 Players
- 🟢 Goblins
- 🔵 Items
- 🟡 Trees
- 🟣 Banks

### Production Code Only

- No TODOs or "will fill this out later" - implement completely
- No hardcoded data - use JSON files and general systems
- No shortcuts or workarounds - fix root causes
- Build toward the general case (many items, players, mobs)

### Separation of Concerns

- **Data vs Logic**: Never hardcode data into logic files
- **RPG vs Engine**: Keep RPG isolated from Hyperscape core
- **Types**: Define in `types.ts`, import everywhere
- **Systems**: Use existing Hyperscape systems before creating new ones

## Working with the Codebase

### Understanding Hyperscape Systems

Before creating new abstractions, research existing Hyperscape systems:

1. Check [packages/shared/src/systems/](packages/shared/src/systems/)
2. Look for similar patterns in existing code
3. Use Hyperscape's built-in features (ECS, networking, physics)
4. Read entity/component definitions in `types/` folders

### Common Patterns

**Getting Systems:**
```typescript
const combatSystem = world.getSystem('combat') as CombatSystem;
```

**Entity Queries:**
```typescript
const players = world.getEntitiesByType('Player');
```

**Event Handling:**
```typescript
world.on('inventory:add', (event: InventoryAddEvent) => {
  // Handle event - assume properties exist
});
```

### Development Server

The dev server provides:
- Hot module replacement (HMR) for client
- Auto-rebuild and restart for server
- Watch mode for shared package
- Colored logs for debugging

**Commands:**
```bash
bun run dev        # Core game (client + server + shared)
bun run dev:forge  # AssetForge (standalone)
bun run docs:dev   # Documentation site (standalone)
bun run duel       # Full duel stack (game + bots + streaming + betting)
```

### Port Allocation

All services have unique default ports to avoid conflicts:

| Port | Service | Env Var | Started By |
|------|---------|---------|------------|
| 3333 | Game Client | `VITE_PORT` | `bun run dev` |
| 3400 | AssetForge UI | `ASSET_FORGE_PORT` | `bun run dev:forge` |
| 3401 | AssetForge API | `ASSET_FORGE_API_PORT` | `bun run dev:forge` |
| 3402 | Docusaurus | (hardcoded) | `bun run docs:dev` |
| 4001 | ElizaOS API | `ELIZA_PORT` | `bun run dev:ai` |
| 4179 | Betting App | `VITE_PORT` | `bun run duel` |
| 5555 | Game Server | `PORT` | `bun run dev` |
| 8765 | RTMP Bridge | `RTMP_PORT` | `bun run duel` |

### Environment Variables

**Zero-config local development**: The defaults work out of the box. Just run `bun run dev`.

**Package-specific `.env` files**: Each package has its own `.env.example` with deployment documentation:

| Package | File | Purpose |
|---------|------|---------|
| Server | `packages/server/.env.example` | Server deployment (Railway, Fly.io, Docker) |
| Client | `packages/client/.env.example` | Client deployment (Vercel, Netlify, Pages) |
| AssetForge | `packages/asset-forge/.env.example` | AssetForge deployment |
| Plugin | `packages/plugin-hyperscape/.env.example` | ElizaOS agent config |

**Common variables**:
```bash
# Server (packages/server/.env)
DATABASE_URL=postgresql://...    # Required for production
JWT_SECRET=...                   # Required for production
PRIVY_APP_ID=...                 # For Privy auth
PRIVY_APP_SECRET=...             # For Privy auth

# Database migrations (CI/testing)
SKIP_MIGRATIONS=true             # Skip server migration when schema created externally

# Streaming (optional)
TWITCH_STREAM_KEY=live_...       # For Twitch streaming
YOUTUBE_STREAM_KEY=xxxx-...      # For YouTube streaming

# Client (packages/client/.env)
PUBLIC_PRIVY_APP_ID=...          # Must match server's PRIVY_APP_ID
PUBLIC_API_URL=https://...       # Point to your server
PUBLIC_WS_URL=wss://...          # Point to your server WebSocket
```

**SKIP_MIGRATIONS Environment Variable:**

When `SKIP_MIGRATIONS=true`, the server skips:
- Built-in migration execution
- `hasRequiredPublicTables` validation check
- Migration recovery loop

**Use Cases:**
- CI/testing environments using `drizzle-kit push` for declarative schema creation
- External schema management (avoids FK ordering issues in migration files)
- Integration tests that create schema before server startup

**Important**: When using `SKIP_MIGRATIONS=true`, you MUST create the database schema externally (e.g., via `drizzle-kit push`) before starting the server. The server will not create tables or run migrations.

**Example CI Workflow** (from `.github/workflows/integration.yml`):
```yaml
- name: Setup database schema
  working-directory: packages/server
  run: bunx drizzle-kit push
  env:
    DATABASE_URL: postgresql://hyperscape:hyperscape_test@localhost:5432/hyperscape_test

- name: Start server in background
  working-directory: packages/server
  run: bun run start > logs/server.log 2>&1 &
  env:
    SKIP_MIGRATIONS: "true"  # Schema already created by drizzle-kit push
    DATABASE_URL: postgresql://hyperscape:hyperscape_test@localhost:5432/hyperscape_test
```

**Why use drizzle-kit push instead of server migrations?**
- Server's built-in migration has FK ordering issues (migration 0050 references arena_rounds from older migrations)
- `drizzle-kit push` creates schema declaratively without these problems
- Avoids `42P07` errors (relation already exists) on fresh database installs

**Split deployment** (client and server on different hosts):
- `PUBLIC_PRIVY_APP_ID` (client) must equal `PRIVY_APP_ID` (server)
- `PUBLIC_WS_URL` and `PUBLIC_API_URL` must point to your server

## Package Manager

This project uses **Bun** (v1.1.38+) as the package manager and runtime.

- Install: `bun install` (NOT `npm install`)
- Run scripts: `bun run <script>` or `bun <file>`
- Some commands use `npm` prefix for Turbo workspace filtering

## Tech Stack

- **Runtime**: Bun v1.1.38+
- **TypeScript**: 5.9.3
- **Engine**: Three.js 0.183.1 (WebGPU + TSL shaders), PhysX (WASM)
- **UI**: React 19.2.14, styled-components, Framer Motion 12.34.3
- **Server**: Fastify, WebSockets, LiveKit
- **Database**: PostgreSQL (production via Neon/Supabase), Drizzle ORM
- **Testing**: Playwright 1.58.2, Vitest, Chai 6.2.2
- **Build**: Turbo, esbuild, Vite 6.4.1
- **Mobile**: Capacitor 8.1.0, Tauri
- **Blockchain**: Solana (mainnet), Anchor 0.32.1, CLOB market program
- **AI**: @elizaos/core 2.0.0-alpha.26 (server), @ai-sdk/anthropic 3.0.46
- **Streaming**: RTMP (Twitch, YouTube), HLS, FFmpeg
- **Validation**: Zod 4.3.6
- **Icons**: lucide-react 0.575.0
- **Environment**: dotenv 17.3.1
- **Linting**: ESLint 10.0.2
- **3D Optimization**: three-mesh-bvh 0.9.8

**Recent Dependency Updates (Feb 24-25, 2026):**

Commits 7a60135e through 55c57ed5 updated dependencies across all packages:

| Package | Old Version | New Version | Type |
|---------|-------------|-------------|------|
| `typescript` | 5.9.2 | 5.9.3 | Patch |
| `@types/node` | 24.8.0 | 25.3.0 | Major |
| `@types/react` | 19.2.2 | 19.2.14 | Patch |
| `@types/react-dom` | 19.2.2 | 19.2.3 | Patch |
| `three` | 0.182.0 | 0.183.1 | Minor |
| `@types/three` | 0.180.0 | 0.183.1 | Minor |
| `three-mesh-bvh` | 0.8.3 | 0.9.8 | Minor |
| `@elizaos/core` | 2.0.0-alpha.11 | 2.0.0-alpha.26 | Patch |
| `@ai-sdk/anthropic` | 1.2.12 | 3.0.46 | Major |
| `@vitejs/plugin-react` | 5.0.4 | 5.1.4 | Minor |
| `@capacitor/cli` | 7.5.0 | 8.1.0 | Major |
| `@coral-xyz/anchor` | 0.31.1 | 0.32.1 | Minor |
| `@playwright/test` | 1.54.2 | 1.58.2 | Minor |
| `chai` | 4.5.0 | 6.2.2 | Major |
| `dotenv` | 16.6.1 | 17.3.1 | Major |
| `eslint` | 9.39.3 | 10.0.2 | Major |
| `framer-motion` | 11.18.2 | 12.34.3 | Major |
| `lucide-react` | 0.553.0 | 0.575.0 | Minor |
| `vite-plugin-node-polyfills` | 0.24.0 | 0.25.0 | Minor |
| `zod` | 3.25.76 | 4.3.6 | Major |

## Security & CI/CD

### Security Audit Status

**Recent Fixes (commit a390b79, Feb 22 2026):**
- ✅ Resolved 14 of 16 npm audit vulnerabilities
- ✅ Playwright ^1.55.1 (fixes GHSA-7mvr-c777-76hp, high)
- ✅ Vite ^6.4.1 (fixes GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7)
- ✅ ajv ^8.18.0 (fixes GHSA-2g4f-4pwh-qvx6)
- ✅ Root overrides for: @trpc/server, minimatch, cookie, undici, jsondiffpatch, tmp, diff, bn.js, ai

**Remaining vulnerabilities (no upstream patches):**
- ⚠️ bigint-buffer (high) - no patched version available
- ⚠️ elliptic (moderate) - no patched version available

**CI Audit Policy:**
```bash
# Audit threshold lowered to critical (from high)
npm audit --audit-level=critical
```

### Database Configuration

**Supavisor Pooler Compatibility (commits 8aaaf28, f7ab9f7):**

When using Supabase's Supavisor connection pooler, prepared statements must be disabled to avoid `XX000` errors. The database client automatically detects Supavisor and disables prepared statements:

```typescript
// packages/server/src/database/client.ts
function isSupavisorPooler(connectionString: string): boolean {
  return connectionString.includes('pooler.supabase.com');
}

const useSupavisor = isSupavisorPooler(connectionString);
const db = drizzle(pool, {
  schema,
  ...(useSupavisor ? { prepare: false } : {}),
});
```

**Why**: Supavisor's transaction pooling mode doesn't support prepared statements. The `{ prepare: false }` option tells Drizzle ORM to use simple queries instead of prepared statements, preventing `ERROR: prepared statement "..." does not exist (XX000)` errors.

**Detection**: Automatic - checks if connection string contains `pooler.supabase.com`

**Pool Configuration**: Supavisor connections use reduced pool size (max: 6 vs 20) due to pooler limitations

### CI/CD Best Practices

**Chain Setup:**
- `setup-chain.mjs` skips when `CI=true` (anvil/mud not available in CI)
- Exclude `@hyperscape/evm-contracts` from turbo test filter
- Install Foundry toolchain for integration tests: `foundry-rs/foundry-toolchain@v1`

**Database Migrations:**
- Server handles migrations during startup by default
- Set `SKIP_MIGRATIONS=true` when using `drizzle-kit push` for schema creation
- Do NOT run `drizzle-kit push` in CI then start server (creates tables without migration journal)
- Running push separately causes server migration code to fail on re-creation attempts

**Migration 0050 Duplicate Table Fix (commit e4b6489):**
- Migration 0050 duplicated CREATE TABLE statements from earlier migrations
- Example: `agent_duel_stats` was created in migration 0039 and again in 0050
- On fresh databases, running all migrations sequentially caused `42P07` errors (relation already exists)
- **Fix**: Added `IF NOT EXISTS` to all CREATE TABLE and CREATE INDEX statements in migration 0050
- This allows migrations to run idempotently without errors on fresh database installs

**Migration FK Ordering Issues:**
- Migration 0050 references tables from older migrations (e.g., arena_rounds)
- On fresh databases, sequential migration execution can cause FK errors
- Solution: Use `drizzle-kit push` for declarative schema creation + `SKIP_MIGRATIONS=true`
- Fixed in commit eb8652a (CI integration tests)

**Package Exclusions:**
- `@hyperscape/contracts` excluded from CI test run (MUD CLI + @trpc/server compatibility issue) - commit 99dec96
- `@hyperscape/gold-betting-demo` excluded from CI (hls.js dependency resolution issue) - commit 93f9633
  - The hls.js dependency in gold-betting-demo app is not resolving correctly in CI due to workspace hoisting issues
  - `hls.js` was added to package.json (commit cfdabf3) but workspace resolution still fails in CI
  - Package excluded until dependency resolution is fixed
  - Local development works correctly
- `@hyperscape/evm-contracts` excluded from CI (foundry/anvil not available in CI) - commit 034f9c9
- Tests will be re-enabled when dependency conflicts are resolved

**Missing Dependencies Fixed:**
- `hls.js` added to gold-betting-demo package.json (commit cfdabf3)
  - StreamPlayer.tsx imports hls.js but it was not declared
  - Caused build failures in CI where bun resolves dependencies strictly
  - Dependency added but workspace hoisting still causes CI issues (package excluded for now)

**Documentation Updates:**
- `update-docs.yml` has `continue-on-error: true` for Mintlify API calls
- Prevents CI failures from Mintlify service outages

**ESLint Configuration:**
- Do NOT override ajv version in root package.json
- @eslint/eslintrc requires ajv@6 for Draft-04 schema support
- Forcing ajv@8 causes `TypeError: Class extends value undefined is not a constructor or null`

## Troubleshooting

### Build Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

### PhysX Build Fails

PhysX is pre-built and committed. If it needs rebuilding:
```bash
cd packages/physx-js-webidl
./make.sh  # Requires emscripten toolchain
```

### Port Conflicts

```bash
# Kill processes on common Hyperscape ports
lsof -ti:3333 | xargs kill -9  # Game Client
lsof -ti:5555 | xargs kill -9  # Game Server
lsof -ti:4179 | xargs kill -9  # Betting App
lsof -ti:8765 | xargs kill -9  # RTMP Bridge
```

See [Port Allocation](#port-allocation) section for full port list.

### Tests Failing

- Ensure server is not running before tests
- Check `/logs/` folder for error details
- Tests spawn their own Hyperscape instances
- Visual tests require headless browser support

### ESLint Crashes

**Symptom**: `TypeError: Class extends value undefined is not a constructor or null` related to ajv

**Cause**: Forcing ajv@8 on @eslint/eslintrc which requires ajv@6 for Draft-04 schema support

**Fix**: Remove any ajv version overrides from root `package.json`. Fixed in commit `b344d9e`.

### Integration Tests Fail (anvil missing)

**Symptom**: Integration tests fail with "anvil: command not found"

**Cause**: Foundry toolchain not installed in CI environment

**Fix**: Install Foundry locally or ensure CI workflow includes `foundry-rs/foundry-toolchain@v1`. Fixed in commit `b344d9e`.

```bash
# Install Foundry locally (macOS/Linux)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Asset Management

**Asset Manifest Migration** (commit 12c01c2) - HyperscapeAI/assets as source of truth

Manifests were previously committed directly to the hyperscape repo to fix CI, causing divergence with the assets repo. The assets directory is now fully gitignored and populated exclusively by cloning HyperscapeAI/assets.

**Changes:**
- Untracked all 40+ manifest files (git rm --cached)
- Updated `.gitignore` to ignore entire `packages/server/world/assets/` directory
- Updated `ensure-assets.mjs` to clone assets repo in CI (shallow, no LFS) so CI gets manifests from source of truth
- Local dev unchanged: `bun install` clones full assets with LFS

**Asset Directory Structure:**
```
packages/server/world/assets/
├── manifests/           # JSON manifests (from HyperscapeAI/assets)
│   ├── items/          # Item definitions
│   ├── gathering/      # Resource nodes (trees, ores, fishing)
│   ├── recipes/        # Processing recipes
│   └── ...
├── models/             # 3D models (GLB, VRM) - Git LFS
├── textures/           # Texture files - Git LFS
└── audio/              # Sound effects and music - Git LFS
```

**Important**: Never commit files in `packages/server/world/assets/`. All changes must go to the [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets) repository.

**Updating Assets:**
```bash
# Local development - pull latest assets
bun run assets:sync

# CI/Production - assets cloned automatically during build
# See scripts/ensure-assets.mjs for implementation
```

### Terrain System Improvements

**Terrain Height Cache Offset Fix (commit 21e0860, Feb 25 2026):**

Fixed a critical bug in `getHeightAtCached` causing a consistent 50m offset in height lookups. This affected all terrain-based positioning including player movement, building placement, and resource spawning.

**Root Causes:**
1. **Tile Index Calculation**: Used `Math.floor(worldX/TILE_SIZE)` which doesn't account for centered geometry. Terrain tiles are centered at `(tileX * TILE_SIZE, 0, tileZ * TILE_SIZE)` with PlaneGeometry vertices ranging from `-TILE_SIZE/2` to `+TILE_SIZE/2`. This means tile N covers world coords `[(N-0.5)*SIZE, (N+0.5)*SIZE)`, not `[N*SIZE, (N+1)*SIZE)`.

2. **Grid Index Formula**: Omitted the `halfSize` offset from PlaneGeometry's `[-50,+50]` range when converting local coordinates to grid indices.

**Solution:**

Added two canonical helper functions in TerrainSystem:

```typescript\n// World coordinate → terrain tile index (accounts for centered geometry)\nprivate worldToTerrainTileIndex(worldCoord: number): number {\n  return Math.floor(\n    (worldCoord + this.CONFIG.TILE_SIZE * 0.5) / this.CONFIG.TILE_SIZE,\n  );\n}\n\n// Geometry-local coordinate → heightData grid index\n// localCoord is worldCoord - tileIndex * TILE_SIZE, ranging [-SIZE/2, +SIZE/2]\n// Returns a float in [0, RESOLUTION-1] suitable for bilinear interpolation\nprivate localToGridIndex(localCoord: number): number {\n  const gridStep = this.CONFIG.TILE_SIZE / (this.CONFIG.TILE_RESOLUTION - 1);\n  return (localCoord + this.CONFIG.TILE_SIZE * 0.5) / gridStep;\n}\n```\n\n**Additional Fixes:**\n- Fixed `getTerrainColorAt()` which had a comma-vs-underscore key typo (`${tileX},${tileZ}` instead of `${tileX}_${tileZ}`) preventing it from ever finding tiles\n- Updated all terrain coordinate conversions to use the canonical helpers\n\n**Impact:**\n- Terrain height queries now return correct values at all world positions\n- Eliminates 50m vertical offset that was causing positioning errors\n- Fixes bilinear interpolation seams at tile boundaries\n\n**File**: `packages/shared/src/systems/shared/world/TerrainSystem.ts`\n\n### Duel Arena Issues\n\n**Players/agents sinking into arena floors:**\nFixed in commits 7a60135 and 75d0aa6. Two separate issues were resolved:

1. **Terrain flat zones** (commit 7a60135): Players/agents were sinking ~0.4m into duel arena floors because flat zones were removed from the terrain system. This caused `getHeightAt()` to return raw procedural terrain height instead of floor-level height, and allowed grass to grow through floor surfaces.
   - **Fix**: DuelArenaVisualsSystem (`packages/shared/src/systems/client/DuelArenaVisualsSystem.ts`) now registers flat zones programmatically for all 8 floor areas (6 arenas + lobby + hospital)
   - Flat zones are registered via `TerrainSystem.registerFlatZone()` during system initialization
   - Each flat zone specifies: center position, width, depth, height, and blend radius
   - Terrain height queries now return correct floor-level values
   - Terrain mesh is carved under the floors to prevent grass/vegetation clipping
   - **Implementation**: Flat zones are registered in `DuelArenaVisualsSystem.start()` after arena meshes are created, ensuring terrain respects building floor heights

2. **Arena spawn heights** (commit 75d0aa6): Arena spawn heights were corrected to match visual mesh positions.

If you see players falling through the arena floor, ensure you're on the latest code.

**Arena click targeting and minimap rendering** (commit 24354238):
- Fixed click target going underground in duel arenas by skipping building footprint validation for arena-floor raycast hits (RaycastService)
- Fixed minimap showing duel arenas as black holes by enabling layer 0 on arena/lobby/hospital floor meshes so minimap camera can render them
- Removed non-functional wall sconce geometry from arena fences (96 dead meshes across 6 arenas with no lights attached)

### Streaming Mode Issues

**RTMP Streaming Resilience (commit 14a1e1b, Feb 25 2026):**

The streaming infrastructure has been hardened against transient network issues and GPU initialization failures:

**CDP Stall Detection:**
- Increased CDP stall threshold from 2 to 4 intervals (120s) to reduce false restarts
- Added soft CDP recovery: restart screencast without browser/FFmpeg teardown (no stream gap)
- Prevents unnecessary full stream restarts from temporary network hiccups

**FFmpeg Resilience:**
- Increased MAX_RESTART_ATTEMPTS from 5 to 8
- Added `resetRestartAttempts()` for recovery counter reset
- Increased CAPTURE_RECOVERY_MAX_FAILURES default from 2 to 4

**WebGPU Renderer Initialization:**
- Make `requiredLimits` best-effort: try `maxTextureArrayLayers: 2048` first, retry with default limits if GPU rejects
- Always use WebGPU renderer, never fall back to WebGL
- Handles GPU configurations that don't support high texture array layer counts

**Files**: 
- `packages/server/src/streaming/browser-capture.ts`
- `packages/server/src/streaming/rtmp-bridge.ts`
- `packages/server/src/streaming/stream-capture.ts`
- `packages/shared/src/utils/rendering/RendererFactory.ts`

**WebGPU crashes on RTX 5060 Ti:**
The streaming infrastructure has been updated to use GL ANGLE backend instead of Vulkan due to broken Vulkan ICD on RTX 5060 Ti GPUs. If you encounter crashes:

- Use Chrome Dev channel for WebGPU support (commit ba8bd53)
- Switch to GL ANGLE backend (commit 0257563)
- Use system FFmpeg instead of static build (commits 55a07bd, 536763d)
- Remove aggressive GPU optimization flags (commit f3aa787)

**Headless rendering issues:**
Switch to headful mode with Xvfb for GPU compositing (commit 5e4c6f1), or use swiftshader + headless + WebGL fallback (commit ae42beb).

**RTX 4090 WebGPU (commit 80bb06e):**
For RTX 4090 GPUs, switch ANGLE from GL to Vulkan backend for optimal WebGPU performance:

```bash
# In streaming infrastructure (packages/server/src/streaming/browser-capture.ts)
# Chrome launch args updated to use Vulkan ANGLE backend:
--use-angle=vulkan
--use-vulkan
--enable-features=Vulkan
```

This change improves WebGPU rendering performance on RTX 4090 GPUs by using the native Vulkan backend instead of the GL translation layer.

**Vast.ai GPU Compatibility:**
- RTX 5060 Ti removed from GPU search (broken Vulkan ICD) - commit 30cacb0
- Use system FFmpeg to avoid static build SIGSEGV - commit 30cacb0
- Use GL ANGLE backend for stability - commit 30cacb0

## Additional Resources

- [README.md](README.md) - Full project documentation
- [.cursor/rules/](.cursor/rules/) - Detailed development rules
- [packages/shared/](packages/shared/) - Core engine source
- Game Design Document: See `.cursor/rules/gdd.mdc`
