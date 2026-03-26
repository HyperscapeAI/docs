# Hyperscape

**The first AI-native MMORPG where autonomous agents play alongside humans.**

Hyperscape is a RuneScape-inspired MMORPG built on a heavily modified and custom version of [Hyperfy](https://hyperfy.io), an open-source 3D multiplayer engine. The game integrates [ElizaOS](https://elizaos.ai) to enable AI agents to play autonomously in a persistent world. Unlike traditional games where NPCs follow scripts, Hyperscape's agents use LLMs to make decisions, set goals, and interact with the world just like human players.

## What Makes Hyperscape Unique

- **AI Agents as Players**: Autonomous agents powered by ElizaOS that fight, skill, trade, and make decisions using LLMs
- **True OSRS Mechanics**: Authentic tick-based combat (600ms ticks), safespotting, tile-based movement, and classic progression systems
- **Manifest-Driven Design**: Add NPCs, items, and content by editing JSON files—no code changes required
- **Spectator Mode**: Watch agents play in real-time and observe their decision-making process
- **Open Source**: Built on open technology with extensible architecture

## Core Features

| Category | Features |
|----------|----------|
| **Combat** | Tick-based OSRS mechanics (600ms ticks), attack styles, accuracy formulas, death/respawn system |
| **Skills** | Woodcutting, Mining, Fishing, Cooking, Firemaking + combat skills with XP/leveling |
| **Economy** | 480-slot bank, shops, item weights, loot drops |
| **AI Agents** | ElizaOS-powered autonomous gameplay, LLM decision-making, spectator mode |
| **Content** | JSON manifests for NPCs, items, stores, world areas—no code required |
| **Tech** | VRM avatars, WebSocket networking, PostgreSQL persistence, PhysX physics |

## Quick Start

**Prerequisites:**
- [Bun](https://bun.sh) (v1.3.10+) - **Updated from 1.1.38 for Vite 6+ compatibility**
- [Git LFS](https://git-lfs.com) - `brew install git-lfs` (macOS) or `apt install git-lfs` (Linux)
- Docker - [Docker Desktop](https://docker.com/products/docker-desktop) for macOS/Windows, or `apt install docker.io` on Linux
- [Privy](https://privy.io) account (required for authentication)

```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape
bun install
```

### Setup Environment Files

> **⚠️ WebGPU Linux / Streaming Note**: When running Hyperscape on Linux (e.g. Vast.ai), you must use headful Chrome with Xorg/Xvfb. You MUST use the ANGLE backend for WebGPU, **NOT** Vulkan (`--use-vulkan`). Using the native Vulkan backend with WebGPU currently will crash.

```bash
# Required: Copy both client and server env files
cp packages/client/.env.example packages/client/.env
cp packages/server/.env.example packages/server/.env
```

**Configure Privy Authentication** (required):

1. Create a free account at [Privy Dashboard](https://dashboard.privy.io)
2. Create an app and copy your **App ID** and **App Secret**
3. Set in `packages/client/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   ```
4. Set in `packages/server/.env`:
   ```
   PUBLIC_PRIVY_APP_ID=your-app-id
   PRIVY_APP_SECRET=your-app-secret
   ```

> **⚠️ Without Privy credentials**, the game runs in anonymous mode where users get a new identity on every page refresh. Characters will appear to vanish because they're tied to the old anonymous account.

**Optional configs:**
```bash
# AI agents (only if using bun run dev:ai)
cp packages/plugin-hyperscape/.env.example packages/plugin-hyperscape/.env

# Asset generation tools (only if using bun run dev:forge)
cp packages/asset-forge/.env.example packages/asset-forge/.env
# Edit and set OPENAI_API_KEY, MESHY_API_KEY
```

### Run the Game

1. **Start Docker** - Open Docker Desktop (macOS/Windows) or start the daemon (`sudo systemctl start docker` on Linux)

2. **Build the project** (required first time):
   ```bash
   bun run build
   ```

3. **Start the CDN** (serves game assets):
   ```bash
   bun run cdn:up
   ```

4. **Start the game**:
   ```bash
   bun run dev          # Game only (client + server)
   # OR
   bun run dev:ai       # Game + AI agents (ElizaOS)
   ```

5. Open **http://localhost:3333** in your browser.

> PostgreSQL starts automatically via Docker when the server starts.

## Project Structure

```
packages/
├── shared/              # Core 3D engine (ECS, Three.js, PhysX, networking)
├── server/              # Game server (Fastify, WebSockets, database)
├── client/              # Web client (Vite, React)
├── plugin-hyperscape/   # ElizaOS AI agent plugin
├── physx-js-webidl/     # PhysX WASM bindings
├── asset-forge/         # AI asset generation tools
└── docs-site/           # Documentation (Docusaurus)
```

Build order: `physx-js-webidl` → `shared` → everything else (handled automatically by Turbo)

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run build` | Build all packages |
| `bun start` | Start production server |
| `bun test` | Run test suite |
| `bun run lint` | Lint codebase |

### What `bun run dev` starts

| Service | Port | Description |
|---------|------|-------------|
| Client | 3333 | Vite dev server with hot reload |
| Server (HTTP) | 5555 | Game server HTTP API (Fastify) |
| Server (WebSocket) | 5556 | Game WebSocket (uWebSockets.js) |
| CDN | 8080 | Asset server (Docker nginx) |
| PostgreSQL | 5432 | Database (Docker) |

**Note**: As of March 2026, the server uses **dual ports**:
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints
- **Port 5556** (uWebSockets.js): Game WebSocket traffic for real-time multiplayer (can be disabled with `UWS_ENABLED=false`)

### Run specific services

```bash
bun run dev:client    # Client only (port 3333)
bun run dev:server    # Server only (port 5555)
bun run dev:ai        # Game + ElizaOS agents (adds port 4001)
bun run dev:forge     # AssetForge tools (ports 3400, 3401)
bun run docs:dev      # Documentation site (port 3402)
bun run dev:all       # Everything: game + AI + AssetForge
```

### Docker services

```bash
bun run cdn:up        # Start CDN container (needed for bun start)
bun run cdn:down      # Stop CDN container
```

### Database (Drizzle)

Run from `packages/server/`:

```bash
bunx drizzle-kit push      # Push schema changes to database
bunx drizzle-kit generate  # Generate migration files
bunx drizzle-kit migrate   # Run pending migrations
```

### Assets

Game assets (3D models, textures, audio) source: [HyperscapeAI/assets](https://github.com/HyperscapeAI/assets)

**Local Development**: Assets are auto-downloaded during `bun install` (~200MB via Git LFS).

```bash
bun run assets:sync    # Pull latest assets from repo (local dev only)
```

**Production/CI**: Manifests are committed to the repo at `packages/server/world/assets/manifests/`.

## Configuration

**Required for local development:**
- `packages/client/.env` - Set `PUBLIC_PRIVY_APP_ID`
- `packages/server/.env` - Set `PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET`

Both must use the same Privy App ID from [Privy Dashboard](https://dashboard.privy.io).

**Optional configuration** - see `.env.example` files for all options:
- `packages/server/.env.example` - Database, ports, LiveKit voice chat
- `packages/client/.env.example` - API URLs, Farcaster integration
- `packages/asset-forge/.env.example` - AI API keys (OpenAI, Meshy)
- `packages/plugin-hyperscape/.env.example` - ElizaOS agent config

### Default Ports

| Port | Service | Started By |
|------|---------|------------|
| 5555 | Game Server (HTTP) | `bun run dev` |
| 5556 | Game WebSocket (uWS) | `bun run dev` |
| 3333 | Client | `bun run dev` |
| 8080 | Asset CDN | `bun run dev` |
| 3400 | AssetForge UI | `bun run dev:forge` |
| 3401 | AssetForge API | `bun run dev:forge` |
| 4001 | ElizaOS API | `bun run dev:ai` |
| 3402 | Documentation | `bun run docs:dev` |

**WebSocket Configuration**:
- **Default**: Game WebSocket runs on port 5556 (uWebSockets.js for high performance)
- **Fallback**: Set `UWS_ENABLED=false` to use port 5555 (Fastify WebSocket)
- **Client**: Update `PUBLIC_WS_URL` in `packages/client/.env` to match your configuration

## Deployment (Railway)

Railway deployment is set up for separate development and production targets:

- `main` branch deploys to `prod`
- `develop` or `dev` branch deploys to `dev`

For setup details (GitHub vars/secrets, Railway environment IDs, and DNS steps for `hyperscape.gg`), see:

- `docs/railway-dev-prod.md`

## Native App Distribution

- Desktop and mobile build artifacts are published from tagged releases (`v*`) via `.github/workflows/build-app.yml`.
- Public download portal: [https://hyperscapeai.github.io/hyperscape/](https://hyperscapeai.github.io/hyperscape/)
- Release assets and notes: [https://github.com/HyperscapeAI/hyperscape/releases](https://github.com/HyperscapeAI/hyperscape/releases)
- Release setup details and required secrets: `docs/native-release.md`

### Creating a tagged app release

```bash
git tag v1.0.0
git push origin v1.0.0
```

That tag triggers cross-platform native packaging and publishes installers to a GitHub Release.

## Troubleshooting

**Characters vanishing / not appearing on character select:**
This happens when Privy credentials are missing. Each page refresh creates a new anonymous user, orphaning your characters. Fix: Set `PUBLIC_PRIVY_APP_ID` in client `.env` and both `PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` in server `.env`.

**Assets not loading (404 errors for models/avatars):**
The CDN container needs to be running. It starts automatically with `bun run dev`, but if you're running services separately:
```bash
bun run cdn:up
```

**Database schema errors or stale data after pulling updates:**
Migrations only run once, so pulling new code won't fix an outdated database schema. Reset to fresh:
> ⚠️ **Warning:** This will delete all local data (characters, inventory, progress).
```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null; docker rm hyperscape-postgres 2>/dev/null

# Remove postgres volumes
docker volume rm hyperscape-postgres-data 2>/dev/null; docker volume rm server_postgres-data 2>/dev/null

# Remove any remaining hyperscape volumes
docker volume ls | grep -i hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify volumes are gone
docker volume ls | grep -i hyperscape

# Restart with fresh database
bun run dev
```

**Port conflicts:**
```bash
lsof -ti:5555 | xargs kill -9   # Server HTTP
lsof -ti:5556 | xargs kill -9   # Server WebSocket (uWS)
lsof -ti:3333 | xargs kill -9   # Client
lsof -ti:8080 | xargs kill -9   # CDN
```

**Build errors:**
```bash
bun run clean
rm -rf node_modules packages/*/node_modules
bun install
bun run build
```

**Vite 8 / React plugin 6 errors (after March 19, 2026 updates):**
If you see plugin errors or HMR issues after updating:
```bash
# Clear Vite cache
rm -rf packages/client/.vite packages/shared/.vite packages/asset-forge/.vite

# Reinstall dependencies
bun install

# Rebuild
bun run build
```

**ethers.js v6 contract errors (after March 19, 2026 updates):**
If contract deployment fails with `deployed() is not a function`:
```typescript
// Update contract scripts to use ethers v6 API
// OLD: await contract.deployed()
// NEW: await contract.waitForDeployment()
```
See `docs/migration-march-2026.md` for complete migration guide.

**Jest snapshot errors (after March 19, 2026 updates):**
If tests fail with snapshot mismatches:
```bash
# Regenerate snapshots with new Jest 30 format
npm test -- -u
```

**No Docker?** You need external services:
- Set `DATABASE_URL` in `packages/server/.env` to an external PostgreSQL (e.g., [Neon](https://neon.tech))
- Set `PUBLIC_CDN_URL` in both server and client `.env` to your asset hosting URL

## Recent Updates (March 2026)

### Player Death System Overhaul (March 26, 2026)

**Complete rewrite of player death pipeline** (PR #1094) to fix critical bugs and add OSRS-style death mechanics.

**Critical Fixes**:
- **SQLite Deadlock**: Fixed nested DB transactions causing players to never respawn (two-phase clear pattern)
- **Item Duplication**: Eliminated gravestone item duplication exploits with network sync and atomic operations
- **Death State Softlock**: Added `deathProcessingInProgress` guard to prevent respawn race conditions
- **Duel Escape Exploit**: Blocked respawn during active duels (defense-in-depth in two locations)

**New Features**:
- **OSRS Keep-3**: Players keep their 3 most valuable items on death in safe zones (returned on respawn)
- **Event Migration**: `PLAYER_DIED` deprecated → use `PLAYER_SET_DEAD` (client UI) or `ENTITY_DEATH` (server processing)
- **Crash Recovery**: Death locks persist dropped/kept items to DB for server restart recovery
- **Persist Retry Queue**: Single-retry mechanism for post-transaction DB failures (bounded to 100 entries)

**New Utilities** (`packages/shared/src/systems/shared/combat/DeathUtils.ts`):
- `sanitizeKilledBy()` - XSS prevention, Unicode normalization, BiDi override removal
- `splitItemsForSafeDeath()` - OSRS keep-3 logic (O(n log n) on unique items, no stack expansion)
- `validatePosition()` - Position validation and world-bounds clamping
- `ITEMS_KEPT_ON_DEATH` constant (3), `GRAVESTONE_ID_PREFIX` constant

**Security Improvements**:
- Input sanitization for `killedBy` strings (prevents homograph attacks, XSS, injection)
- Gravestone privacy (loot items not broadcast to all clients)
- Client-side death processing blocked (server-only transaction)
- Duel escape prevention (respawn blocked during active duels)

**Test Coverage**: 1,534 lines of new tests
- `DeathUtils.test.ts` (502 lines): Sanitization, keep-3 logic, position validation
- `PlayerDeathFlow.test.ts` (1,032 lines): Death guards, transaction recovery, tick-based respawn

**Impact**: Players no longer stuck in death state, item duplication exploits eliminated, OSRS-authentic death mechanics, robust crash recovery.

**Files Changed**: 23 files, 2,574 additions, 566 deletions.

**Breaking Changes**: External plugins listening for `PLAYER_DIED` must migrate to `ENTITY_DEATH` with `entityType === "player"` filter.

### Dialogue and Skilling Panel Polish (March 26, 2026)

**Comprehensive UI improvements** (PR #1093) for skilling interfaces and NPC dialogue system.

**Skilling Panel Unification**:
- Extracted shared components (`SkillingPanelBody`, `SkillingSection`, `SkillingQuantitySelector`) to eliminate ~500 lines of duplicated code
- Unified visual treatment across Fletching, Cooking, Smelting, Smithing, Crafting, and Tanning panels
- Consistent spacing, borders, and responsive behavior
- Reusable quantity selector with preset buttons (1, 5, 10, All, X) and custom input mode

**NPC Dialogue Redesign**:
- New `DialoguePopupShell` component with proper focus management and Escape key handling
- Live 3D character portraits using `DialogueCharacterPortrait` component (renders NPC's VRM model)
- Horizontal layout: portrait on left, dialogue text and responses on right
- Lighter shell chrome for better readability

**Service Handoff Fix**:
- Opening bank/store/tanner from dialogue now properly closes the dialogue panel
- Added `isImmediateHandoffEffect()` check in `DialogueSystem` to detect service panel transitions
- Prevents orphaned "Click to continue" dialogue steps after service opens

**Files Changed**: 15 files, 1,623 additions, 1,265 deletions.

### Missing Packet Handlers Fix (March 26, 2026)

**Change** (PR #1091): Added 8 missing server→client packet handlers in `ClientNetwork` to eliminate console errors.

**Problem**: Server was sending packets via event-bridge that the client had no handler for, causing "No handler for packet" console errors. These packets were being queued but never processed, leading to UI systems missing important events.

**Missing Handlers Added**:
- `onFletchingComplete` - Fletching batch finished notification
- `onCookingComplete` - Cooking result with burn check
- `onSmeltingComplete` - Smelting batch finished notification
- `onSmithingComplete` - Smithing batch finished notification
- `onCraftingComplete` - Crafting batch finished notification
- `onTanningComplete` - Tanning batch finished notification
- `onCombatEnded` - Combat session ended notification
- `onQuestStarted` - Quest begun notification

**Implementation** (`packages/shared/src/systems/client/ClientNetwork.ts`):
```typescript
onCookingComplete = (data: {
  rawItemId: string;
  resultItemId: string;
  wasBurnt: boolean;
  xpGained: number;
}) => {
  this.world.emit(EventType.COOKING_COMPLETE, {
    playerId: this.world?.entities?.player?.id || "",
    ...data,
  });
};

onSmeltingComplete = (data: {
  barItemId: string;
  totalSmelted: number;
  totalFailed: number;
  totalXp: number;
}) => {
  this.world.emit(EventType.SMELTING_COMPLETE, {
    playerId: this.world?.entities?.player?.id || "",
    ...data,
  });
};

// ... similar pattern for other handlers
```

**Impact**:
- Eliminates "No handler for packet" console errors
- UI systems can now react to skill completion events
- Quest notifications work correctly
- Combat end events properly trigger UI updates
- Each handler forwards packet data to client world event bus for UI consumption

**Files Changed**: 1 file, 81 additions, 0 deletions. See PR #1091 for complete details.

### Prayer Login Sync Fix (March 26, 2026)

**Change** (PR #1090): Fixed prayer state synchronization on player login and reconnection.

**Problem**: Prayer state wasn't properly syncing when players logged in. The client bootstrap path was overwriting authoritative cached prayer state with local entity fallback values before real prayer data had finished hydrating, causing the HUD and prayer panel to show stale state until the player toggled a prayer.

**Root Cause**: `usePlayerData` hook was unconditionally seeding prayer points from entity data, overwriting the authoritative cache from `lastPrayerStateByPlayerId`.

**Fix**: 
- Only use entity prayer fallback when both `prayerPoints` and `maxPrayerPoints` are explicitly present and finite
- Preserve authoritative prayer cache during initial player-data hydration
- Rerun initial hydration when local player becomes available via `PLAYER_SPAWNED` event
- Re-emit authoritative `PRAYER_STATE_SYNC` on `PLAYER_JOINED` from `PrayerSystem`

**Implementation** (`packages/client/src/hooks/usePlayerData.ts`):
```typescript
function isFiniteNumber(value: unknown): value is number {
  return typeof value === \"number\" && Number.isFinite(value);
}

const prayerPoints = entityData.data?.prayerPoints;
const maxPrayerPoints = entityData.data?.maxPrayerPoints;
const hasExplicitPrayerPoints =
  isFiniteNumber(prayerPoints) && isFiniteNumber(maxPrayerPoints);

// Only seed entity prayer points when both values are finite
if (hasExplicitPrayerPoints) {
  setPlayerStats((prev) => {
    const merged = mergePlayerStats(prev, {
      prayerPoints: { current: prayerPoints, max: maxPrayerPoints },
    });
    return arePlayerStatsEqual(prev, merged) ? prev : merged;
  });
}
```

**PrayerSystem Changes** (`packages/shared/src/systems/shared/character/PrayerSystem.ts`):
```typescript
// Re-emit authoritative prayer snapshot on PLAYER_JOINED
private readonly onPlayerJoined = async (event: unknown): Promise<void> => {
  if (!this.world.isServer) return;
  
  const payload = event as Partial<PlayerJoinedPayload>;
  if (!payload.playerId || typeof payload.playerId !== \"string\") return;
  
  const state = await this.ensurePlayerPrayerInitialized(payload.playerId);
  if (!state) return;
  
  this.emitPrayerStateSync(payload.playerId, state);
};
```

**Impact**:
- Prayer points display correctly on login without requiring a prayer toggle
- Active prayers sync properly between sessions and reconnections
- Eliminates prayer state desync issues
- Authoritative cache takes precedence over entity fallback values
- Better player experience with consistent prayer state

**Test Coverage**:
- E2E test: `packages/client/tests/e2e/prayer-sync.spec.ts` - Verifies prayer state persists across reload
- Unit test: `packages/client/tests/unit/hooks/usePlayerData.test.ts` - Tests cache preservation and finite number guards
- System test: `packages/shared/src/systems/shared/character/__tests__/PrayerSystem.sync.test.ts` - Tests PLAYER_REGISTERED → PLAYER_JOINED sync flow

**Files Changed**: 5 files, 520 additions, 30 deletions.

### UI Panel Modernization (March 25-26, 2026)

**Comprehensive UI panel redesign** with unified layout system, optimistic updates, and cross-player data leak fixes.

**Key Features**:
- **Combat Panel Redesign**: Horizontal heraldic shield banners with SVG shields, protruding icons, and theme gradients
- **Equipment Panel Paperdoll**: Live 3D character preview with equipped gear (interactive rotation and zoom)
- **Unified Panel Layout**: Shared constants (`PANEL_PADDING`, `PANEL_GRID_GAP`, `PANEL_ICON_SIZE`) across all panels
- **CursorTooltip Component**: Reusable portal-based tooltip with auto-measurement and viewport-edge flipping
- **Tab Persistence**: Tabs stay mounted with `display:none/flex` toggling (preserves scroll position and state)
- **Optimistic UI Updates**: Combat controls and inventory actions update instantly before server confirmation
- **Spells Panel**: Added to default layout alongside Prayer panel

**Combat UI Improvements**:
- Instant feedback for attack style changes and auto-retaliate toggles
- Heraldic shield banners with filled geometric icons (accurate, aggressive, defensive, controlled, rapid, longrange, autocast)
- Theme-derived gradients and style-colored tints
- Horizontal layout fits more styles in compact space

**Equipment Panel Enhancements**:
- Live 3D paperdoll portrait with equipped gear
- Interactive rotation (drag) and zoom (scroll)
- Equipment visual helpers extracted for reuse (`EquipmentVisualHelpers.ts`)
- Fallback to stylized silhouette when avatar unavailable
- Improved slot layout with better spacing and visual hierarchy

**Inventory & Targeting**:
- Optimistic removal for firemaking (logs disappear instantly)
- Consolidated rollback logic in `ClientNetwork` (single shared tracker)
- Immediate targeting state clear after selection
- Fixed grey flash on filled slots when entering targeting mode

**Bug Fixes**:
- **Cross-Player Equipment Leak**: Equipment panel now filters by `playerId` (no longer shows AI agents' gear)
- **Combat Damage Deduplication**: Eliminates duplicate damage splats near region boundaries
- **Starter Equipment**: Fixed `bronze_sword` → `bronze_shortsword` reference
- **Fire Model Path**: Corrected asset path to `models/misc/firemaking-fire/`
- **Panel Data Sync**: Added `panelDataVersion` counter to break through React.memo barriers

**Code Quality**:
- Removed attack style cooldown system (was hardcoded to 0ms, ~200 lines of dead code)
- Auto-initialization guards for event ordering races
- Weapon change auto-style switching (OSRS-accurate)
- Event type consistency (replaced string literals with `EventType` enum)

**Files Changed**: 54 files, ~4,600 additions, ~2,700 deletions across PR #1088, #1089, #1087.

### Equipment Panel & Combat UI Fixes (March 25-26, 2026)

**Major combat UI improvements** (PR #1089) to fix cross-player data leaks, improve responsiveness, and remove dead code.

#### Equipment Panel Cross-Player Leak Fix
**Problem**: Equipment panel was displaying AI agents' weapons (e.g., bronze_longsword) because `equipmentUpdated` broadcasts hit all players and the UI had no `playerId` filter. When an AI agent equipped a weapon, all players' equipment panels would show that weapon.

**Fix**: Filter equipment UI updates by local `playerId` in `usePlayerData.ts`:
```typescript
// Only update if this equipment belongs to the local player
if (playerId && equipmentPayload.playerId && equipmentPayload.playerId !== playerId) {
  return;
}
```

**Impact**: 
- Equipment panel now shows only the local player's gear
- Eliminates visual bug where AI agent equipment appeared in player UI
- Server includes `playerId` in all equipment update broadcasts

#### Combat Style & Auto-Retaliate Optimistic Updates
**Changes**:
- **Instant Feedback**: Combat style and auto-retaliate toggles now update UI immediately (OSRS-accurate zero-delay feel)
- **Server Confirmation**: Server sends authoritative value via `attackStyleChanged` / `autoRetaliateChanged` packets
- **Cache Management**: Module-level caches (`combatStyleCache`, `autoRetaliateCache`) for late-mounting UI hydration

**Implementation** (`packages/client/src/game/panels/CombatPanel.tsx`):
```typescript
const handleStyleChange = (next: string) => {
  // Optimistic: update UI instantly (OSRS has zero visible delay)
  combatStyleCache.set(playerId, next);
  setStyle(next);

  // Send to server — server confirms via attackStyleChanged packet
  actions.actionMethods.changeAttackStyle(playerId, next);
};

const handleAutoRetaliateToggle = () => {
  const newValue = !autoRetaliate;
  
  // Optimistic: update UI instantly
  autoRetaliateCache.set(playerId, newValue);
  setAutoRetaliate(newValue);
  
  // Send to server — server confirms via autoRetaliateChanged packet
  actions.actionMethods.setAutoRetaliate(playerId, newValue);
};
```

**Impact**:
- Combat controls feel instant and responsive
- Matches OSRS behavior (zero visible delay on style/retaliate changes)
- Server remains authoritative (can reject invalid changes)

#### Attack Style Cooldown System Removed
**Changes**:
- Removed `STYLE_CHANGE_COOLDOWN` (was hardcoded to 0ms)
- Removed `styleChangeTimers` Map and timer cleanup logic
- Removed `combatStyleHistory` tracking (write-only, never displayed)
- Removed dead API methods: `canPlayerChangeStyle()`, `getRemainingStyleCooldown()`, `getPlayerStyleHistory()`

**Impact**:
- Cleaner codebase with ~200 lines of dead code removed
- No functional changes (cooldown was already 0ms)
- Simpler attack style system without unnecessary complexity

#### Combat Damage Deduplication
**Problem**: `sendToNearby` publishes to 9 region topics, causing players near region boundaries to receive the same damage packet 2-3 times, resulting in duplicate damage splats.

**Fix**: Deduplicate `combatDamageDealt` packets using tick-based keys:
```typescript
// ClientNetwork.ts
const tick = data.tick ?? Math.floor(performance.now() / 125);
const dedupKey = `${data.attackerId}|${data.targetId}|${data.damage}|${tick}`;

if (this._recentDamageKeys.has(dedupKey)) {
  return; // Already processed this damage event
}

this._recentDamageKeys.set(dedupKey, now);
```

**Dedup Strategy**:
- **Soft Sweep**: Clears entries >500ms old when map exceeds 150 entries
- **Hard Cap**: Trims to 100 entries if map exceeds 200 (prevents unbounded growth)
- **Tick-Based Keys**: Distinguishes same-damage rapid hits on different ticks
- **Rolling Deploy Fallback**: Uses `performance.now() / 125` when server tick field is missing

**Impact**:
- Eliminates duplicate damage splats near region boundaries
- Bounded memory usage (max 200 entries)
- Graceful handling during rolling deploys

#### Starter Equipment Fix
**Change**: Fixed `STARTER_EQUIPMENT` referencing non-existent `bronze_sword` → `bronze_shortsword`.

**Files Changed**:
- `packages/shared/src/systems/shared/character/InventorySystem.ts`
- `packages/shared/src/systems/shared/character/PlayerSystem.ts`
- `packages/shared/src/systems/shared/entities/ItemSpawnerSystem.ts`

**Impact**: New players receive correct starter weapon, eliminates item lookup failures.

#### Auto-Initialization for Event Ordering Races
**Changes**:
- **Attack Style**: Auto-initialize with weapon-appropriate default if player exists but `onPlayerRegister` hasn't fired yet
- **Auto-Retaliate**: Auto-initialize with default `true` if player exists but not registered
- **Equipment**: Made `initializePlayerEquipment` idempotent to prevent reconnection from wiping gear
- **Weapon Change**: Auto-switch attack style when weapon changes and current style is invalid

**Implementation** (`packages/shared/src/systems/shared/character/PlayerSystem.ts`):
```typescript
// Auto-initialize if player exists but wasn't registered yet (event ordering)
if (!playerState) {
  if (this.isKnownPlayer(playerId)) {
    const weaponType = this.getPlayerWeaponType(playerId);
    const defaultStyle = getDefaultStyleForWeapon(weaponType);
    this.initializePlayerAttackStyle(playerId, defaultStyle);
    playerState = this.playerAttackStyles.get(playerId);
  }
}
```

**Impact**:
- Eliminates "no state for player" errors from event ordering races
- Player choices take precedence over DB-saved values during session
- Reconnection preserves in-session equipment and combat preferences

#### Event Type Consistency
**Change**: Replaced raw string event names with `EventType` enum constants in `Entities.ts`:
```typescript
// Old (string literals - error-prone)
this.emitTypedEvent("PLAYER_JOINED", { ... });
this.emitTypedEvent("PLAYER_REGISTERED", { ... });

// New (typed enum - type-safe)
this.world.emit(EventType.PLAYER_JOINED, { ... });
this.world.emit(EventType.PLAYER_REGISTERED, { ... });
```

**Impact**: Better type safety, prevents typo bugs, improves grep-ability.

**Files Changed**: 12 files, 250 additions, 194 deletions. See PR #1089 for complete details.

### Inventory UI & Firemaking Fixes (March 25, 2026)

**Inventory interaction improvements** (PR #1087) to fix firemaking, targeting mode, and optimistic inventory updates.

#### Optimistic Inventory Rollback Consolidation
**Change**: Moved `PendingActionTracker` and rollback logic from `InventoryActionDispatcher` into `ClientNetwork` as shared infrastructure.

**Old Pattern** (duplicate trackers):
```typescript
// InventoryActionDispatcher had its own tracker
const inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);

// InventoryInteractionSystem had its own tracker
private inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);
```

**New Pattern** (single shared tracker):
```typescript
// ClientNetwork owns the tracker
export class ClientNetwork extends SystemBase {
  private inventoryTracker = new PendingActionTracker<InventorySnapshot>(5000);
  
  applyOptimisticRemoval(playerId: string, slot: number, quantity: number): void {
    // Auto-snapshots before mutation, manages rollback internally
    const snapshot = this.snapshotInventory(playerId);
    if (snapshot) this.inventoryTracker.add(snapshot);
    
    // Apply optimistic removal
    // ... mutation logic
    
    this.world.emit(EventType.INVENTORY_UPDATED, { ...cached });
  }
}
```

**Callers** (simplified to one line):
```typescript
// InventoryActionDispatcher
network?.applyOptimisticRemoval(localPlayer.id, slot, 1);

// InventoryInteractionSystem (firemaking)
this.clientNetwork?.applyOptimisticRemoval(playerId, logsSlot, 1);
```

**Impact**:
- Eliminates duplicate tracker instances and timers
- Single source of truth for optimistic inventory mutations
- Reduced ~70 lines of boilerplate across callers
- Proper cleanup on disconnect (no leaked intervals)

#### Firemaking Optimistic Removal
**Change**: Added optimistic inventory removal for firemaking so logs disappear instantly.

**Implementation**:
```typescript
// InventoryInteractionSystem.ts
this.applyOptimisticRemoval(playerId, logsSlot, 1);

// Server's authoritative inventoryUpdated packet replaces cache within ~100-200ms
// If server never confirms, PendingActionTracker rolls back after 5 seconds
```

**Impact**: Logs disappear from inventory immediately when firemaking starts, matching eat/drop/bury behavior.

#### Fire Model Asset Path Fix
**Change**: Corrected fire model path from `models/firemaking-fire/` to `models/misc/firemaking-fire/`.

**Files Changed**:
- `packages/shared/src/systems/shared/interaction/ProcessingSystem.ts`

**Impact**: Eliminates 404 errors when spawning firemaking fires.

#### Targeting Mode UI Fixes
**Changes**:
- **Immediate Clear**: Targeting state clears immediately after target selection (no server round-trip wait)
- **Hover State**: Removed `isTargetingActive` from slot hover condition to prevent grey flash on all filled slots
- **System Registration**: Registered `InventoryInteractionSystem` on client for targeting support

**Implementation**:
```typescript
// InventoryPanel.tsx
if (targetingState.active && targetingState.sourceItem) {
  this.world.emit(EventType.TARGETING_SELECT, {
    targetType: "inventory_item",
    targetSlot: slotIndex,
  });
  // Clear targeting immediately — action is committed
  setTargetingState(initialTargetingState);
}
```

**Impact**: 
- Targeting mode feels more responsive
- No stale highlights after target selection
- Cleaner visual feedback

#### Panel Data Synchronization Fix
**Change**: Added `panelDataVersion` counter to break through React.memo barriers in `WindowRenderer`/`WindowItem`.

**Problem**: `WindowRenderer` and `WindowItem` are wrapped in `React.memo()`, which blocked prop updates when inventory/equipment/stats changed. The `renderPanel` function stayed stable (ref-based late binding), but panels never re-rendered with fresh data.

**Solution**:
```typescript
// InterfaceManager.tsx
const panelDataVersionRef = useRef(0);
const panelDataVersion = useMemo(() => {
  return ++panelDataVersionRef.current;
}, [inventory, coins, playerStats, equipment]);

// Pass to WindowRenderer
<WindowRenderer
  renderPanel={renderPanel}
  panelDataVersion={panelDataVersion}  // Breaks memo barrier
/>
```

**Impact**:
- Inventory panels update in real-time when data changes
- Lightweight counter (number) breaks memo without forcing panel re-mount
- `renderPanel` stays stable (no unnecessary panel recreation)

**Files Changed**: 9 files, 149 additions, 171 deletions. See PR #1087 for complete details.

### Client UI Modernization & Startup Hardening (March 23-24, 2026)

**Major client-side refactoring** (PR #1067) to modernize the UI shell, improve startup reliability, and fix gameplay regressions.

#### UI Shell & Design System
**Changes**:
- **Premium Shell Foundation**: Unified design language for windows, tabs, modals, overlays, and HUD framing
- **Onyx/Graphite Palette**: Moved from warm brown tones to cooler graphite surfaces with restrained metallic accents
- **Layer Hierarchy**: Normalized z-index system with proper elevation for focused windows, overlays, and modals
- **Panel Internals**: Improved styling across inventory, action bar, skills, prayers, spells, bank, store, trade, quests, and betting panels
- **Icon-Only Tabs**: Restored icon-only window tab presentation for compact UI

**New Design Tokens** (`packages/client/src/constants/tokens.ts`):
```typescript
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  sidebar: 300,
  panel: 400,
  panelActive: 500,
  chat: 600,
  overlay: 800,
  modalBackdrop: 999,
  modal: 1000,
  tooltip: 1100,
  toast: 1200,        // NEW: Toast notifications layer
  contextMenu: 1300,  // NEW: Context menu layer
  critical: 10000,
  // Mobile HUD layers (7000-8000 range)
  mobileStatusHud: 7000,
  mobileMinimap: 7200,
  mobileActionBar: 7500,
  mobileChatOverlay: 7800,
  mobileDrawer: 8000,
};
```

**UI Constants** (`packages/client/src/constants/ui.ts`):
```typescript
export const UI = {
  Z_INDEX: {
    // ... existing layers
    OVERLAY: zIndex.overlay,
    TOAST: zIndex.toast,           // NEW: Alias for toast layer
    CONTEXT_MENU: zIndex.contextMenu,  // NEW: Alias for context menu layer
    CRITICAL: zIndex.critical,
  },
};
```

#### Gameplay HUD & Minimap
**Minimap Modularization**:
- **useMinimapTerrainCache**: Terrain rendering, biome coloring, zoom behavior, cache updates
- **useMinimapEntityPips**: Entity markers (players, NPCs, resources) with icon caching
- **useMinimapWorldCaches**: Road and town network caching with event-driven updates

**HUD Improvements**:
- Status bars, XP cluster composition, action progress updates
- Death/disconnect overlays with proper layering
- Context menu z-index fixes (now uses `zIndex.contextMenu` instead of hardcoded values)
- Combat panel composition and auto-retaliate presentation

**Minimap Features**:
- Improved terrain detail and biome coloring
- Better zoom scaling and camera controls
- Resize with drag handles (bottom-right corner)
- Collapse/expand with compass button
- Event-driven cache updates for roads and towns

#### Client Startup & Readiness
**Auth Hardening**:
- **Auth-Authoritative Login**: Startup gating now derives from Privy SDK state, not localStorage
- **Storage Restoration**: `restoreFromStorage()` hydrates cached metadata without asserting authenticated session
- **Farcaster Auto-Login**: Added try/catch to prevent permanent spinner on auto-login failure

**Loading Gates**:
- **Live World State**: Derives readiness from actual world state instead of stale React state
- **Terrain Timeout**: 20-second timeout for terrain initialization (spectator mode shows error, player mode continues)
- **Loading Overlay**: Fades out after readiness with 220ms delay for smooth transition
- **Error Recovery**: Shows actionable error screen with reload button on initialization failure

**Readiness Checks**:
```typescript
// Hydrates from live world state instead of stale React state
const livePlayerReady = playerReady || Boolean(world.entities.player?.avatar);
const livePhysReady = physReady || Boolean(world.physics?.isInitialized?.());
const liveTerrainReady = terrainReady || terrainTimedOut || Boolean(world.getSystem?.("terrain")?.isReady?.());

// Gates presentation on all subsystems + loading complete
const canPresent = livePlayerReady && livePhysReady && liveTerrainReady &&
  (loadingComplete || systemsComplete || assetsProgress >= 100);
```

#### Runtime Hardening
**Polling Reduction**:
- **Dashboard Panels**: Adaptive polling (10s visible → 30s background) with visibility-aware scheduling
- **Window Manager**: Reduced render churn with proper memoization
- **Modal State**: Eliminated unnecessary re-renders with equality checks
- **HUD Timers**: Stable `setInterval` instead of chained `setTimeout` (prevents stalls)

**Configuration Sync**:
- **Manifest Loading**: Hardened asset-base resolution with runtime configuration paths
- **API Config**: `getRuntimeAssetBaseUrl()` replaces hardcoded `GAME_API_URL` for manifest icons
- **Debug Logging**: Cleaned up noisy success-path logging across client/shared surfaces

**Type Safety**:
- **Frontend Typecheck**: Brought clean across `packages/client`, `packages/shared`, and `packages/website`
- **SetStateAction Narrowing**: Fixed `SetStateAction<number>` type narrowing for coins setter
- **Unknown Catch Variables**: Fixed unknown catch variable passed to logger.warn

#### Gameplay System Fixes
**Combat & Prayer**:
- **Combat Controls**: Restored combat style and prayer interactions
- **Prayer Initialization**: Added lazy initialization recovery to prevent missed lifecycle events
- **Altar Pray Path**: Fixed altar interaction flow with proper network packet handling
- **Prayer State Backfill**: Prevents gameplay breakage from missed initialization

**UI Sync**:
- **Panel Sync**: Restored realtime panel synchronization with server state
- **Combat Flow**: Fixed combat target health display with conditional rendering
- **Prayer System**: Converted async event handlers to sync with `.then()/.catch()` to prevent unhandled promise rejections

**Modal Window**:
- **Body Overflow**: Ref-counted body overflow management fixes stacked modal close ordering
- **Focus Trap**: Proper focus management for accessibility
- **Resize Listeners**: Store resize listeners for cleanup on unmount during mid-drag

#### New React Hooks
**usePlayerData** (`packages/client/src/hooks/usePlayerData.ts`):
- Centralized player data subscription (inventory, equipment, stats, coins)
- Eliminates duplicate event listeners across components
- Proper equality checks prevent cascading re-renders
- Used by both `InterfaceManager` and `MobileInterfaceManager`

**PlayerDataProvider** (React Context):
```typescript
import { PlayerDataProvider, usePlayerDataContext, usePlayerStatsContext } from '@/hooks';

// Wrap your component tree
<PlayerDataProvider world={world}>
  <YourComponent />
</PlayerDataProvider>

// Access player data in child components
const { inventory, equipment, playerStats, coins } = usePlayerDataContext();

// Or just stats
const playerStats = usePlayerStatsContext();
```

**useModalPanels** (`packages/client/src/hooks/useModalPanels.ts`):
- Centralized modal panel state (bank, store, dialogue, smelting, smithing, etc.)
- Eliminates duplicate event listeners
- Provides close handlers for all modal types
- Shared between desktop and mobile interfaces

**useMinimapTerrainCache** (`packages/client/src/game/hud/useMinimapTerrainCache.ts`):
- Terrain rendering with biome coloring
- Chunked generation with cancellation support
- LRU biome color cache (max 256 entries)
- Zoom-aware detail levels

**useMinimapEntityPips** (`packages/client/src/game/hud/useMinimapEntityPips.ts`):
- Entity marker rendering (players, NPCs, resources)
- Icon caching with `OffscreenCanvas`
- Quest status indicators (available, in-progress, completed)
- Spectator target highlighting

**useMinimapWorldCaches** (`packages/client/src/game/hud/useMinimapWorldCaches.ts`):
- Road and town network caching
- Event-driven updates (`roads:generated`, `towns:generated`)
- Proper cleanup on unmount

#### Component Deletions
**Removed** (consolidated into modular architecture):
- `Sidebar.tsx` (1,345 lines) - Replaced by `InterfaceManager` with windowed panels
- Inline minimap logic (772 lines) - Extracted to dedicated hooks

**Impact**:
- Cleaner codebase with better separation of concerns
- Easier to maintain and extend
- No broken imports or orphaned code

#### Breaking Changes
**WebSocket Port**:
- Default changed from `ws://localhost:5555/ws` to `ws://localhost:5556/ws`
- Update `PUBLIC_WS_URL` in `packages/client/.env` if using custom configuration
- Fallback to port 5555 available with `UWS_ENABLED=false`

**Files Changed**: 166 files, 9,162 additions, 6,454 deletions. See PR #1067 for complete details.

### Internal Bet Sync Feed & Renderer Health (March 20-23, 2026)

**Major streaming infrastructure upgrade** to make Hyperscape the authoritative source for duel lifecycle events and betting market synchronization.

#### Authenticated Internal Bet Sync API
**New Endpoints**:
- `GET /api/internal/bet-sync/state` - Bootstrap endpoint for betting consumers (authenticated)
- `GET /api/internal/bet-sync/events` - Server-Sent Events (SSE) feed with sequence-aware payloads (authenticated)

**Features**:
- **Sequence-Aware Payloads**: Monotonic `phaseVersion` counter enables idempotent deduplication
- **Renderer Health Signals**: Distinguishes healthy live arena frames from degraded initialization shells
- **Replay Buffer**: 2048-frame buffer with byte-size limits for SSE reconnection support
- **Source Epoch Persistence**: Database-backed sequence continuity across server restarts

**Authentication**:
```bash
# Required for internal betting feed access
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Fallback to viewer token (temporary - will be deprecated)
STREAMING_VIEWER_ACCESS_TOKEN=your-viewer-token

# CORS configuration for betting consumers
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
```

**Security Improvements**:
- **Timing-Safe Token Comparison**: Uses `timingSafeEqual` on SHA-256 digests to prevent timing attacks
- **Token Scrubbing**: Stream tokens moved to URL hash fragments (not sent to servers) and immediately scrubbed via `history.replaceState`
- **Origin Validation**: Embedded auth validates `postMessage` origins against explicit allowlist
- **Capture Browser Hardening**: Removed `--disable-web-security`, made `--no-sandbox` opt-in via `CAPTURE_DISABLE_SANDBOX`
- **Shell Injection Fix**: Migrated from `exec` to `execFile` in Docker manager

**Configuration**:
```bash
# Betting feed settings
BETTING_FEED_ACCESS_TOKEN=your-secret-token
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
STREAMING_SSE_PUSH_INTERVAL_MS=500

# Renderer health probe interval
STREAMING_SSE_HEARTBEAT_MS=15000

# Capture browser security
CAPTURE_DISABLE_SANDBOX=false  # Only enable if required for Docker/CI

# Embed security (client)
PUBLIC_EMBED_ALLOWED_ORIGINS=https://embed.example.com,https://partner.example.com
```

**Renderer Health API**:
```typescript
// Client-side global (exposed for capture pipeline)
window.__HYPERSCAPE_STREAM_READY__: boolean
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__: {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}
window.__HYPERSCAPE_STREAM_BOOT_STATUS__: string | null
```

**DuelBettingBridge Lifecycle**:
- **Announcement Phase**: Creates or syncs market with Solana operator
- **Fight Start**: Locks market (no new bets)
- **Resolution**: Resolves market with winner/loser data
- **Abort Handling**: Cleans up local state (on-chain cancellation not yet supported)
- **Reconciliation Loop**: 1-second interval ensures market state stays aligned with streaming lifecycle

**Impact**:
- Betting consumers can reliably sync to Hyperscape's duel lifecycle
- Renderer health signals prevent betting on degraded/loading frames
- Sequence-aware payloads enable idempotent deduplication on consumer side
- Source epoch persistence ensures sequence continuity across restarts
- **Breaking**: Requires `BETTING_FEED_ACCESS_TOKEN` for internal betting endpoints

**Files Changed**: 71 files, 6,875 additions, 541 deletions. See PR #1065 for complete details.

### Performance & Scalability Overhaul (March 19-20, 2026)

**Major architectural changes** to improve server tick reliability and support 50+ concurrent players with 25+ AI agents:

#### Server Runtime Migration: Bun → Node.js
**Problem**: Bun's JavaScriptCore (JSC) uses stop-the-world GC causing 500-1200ms pauses that destroyed the 600ms game tick.

**Solution**: Migrated to Node.js 22+ which uses V8's incremental/concurrent GC (pauses <10ms).

**Impact**: Eliminated missed ticks and rubber-banding under load. **Breaking**: Server now requires Node.js 22+ (Bun no longer supported for server runtime).

#### uWebSockets.js Integration
**Problem**: Fastify WebSocket broadcast iterated all sockets in JavaScript (O(n) bottleneck with 50+ connections).

**Solution**: Replaced with uWebSockets.js using native pub/sub topics. C++ kernel handles per-subscriber delivery.

**Architecture**:
- **Dual Ports**: Port 5555 (Fastify HTTP), Port 5556 (uWS game WebSocket)
- **Pub/Sub Topics**: `global`, `region:<key>`, `spectator`
- **Configuration**: `UWS_ENABLED=true` (default), `UWS_PORT=5556`

**Impact**: Eliminates O(n) socket iteration, supports 50+ concurrent connections without event loop blocking.

#### Agent AI Worker Thread
**Problem**: 25+ AI agents running behavior ticks on main thread blocked event loop for 200-600ms per tick.

**Solution**: Moved agent decision logic to worker thread. Main thread collects snapshots, worker makes decisions, main thread executes actions.

**Features**:
- Batch processing (up to 5 agents per 1000ms poll)
- Staggered scheduling (800ms offset between agents)
- Shared entity snapshot (scanned once per second across ALL agents)

**Impact**: Agent AI no longer blocks game tick, tick blocking reduced from 200-600ms → <10ms.

#### BFS Pathfinding Optimization
**Problem**: 25+ agents each triggering 4000-iteration BFS with expensive walkability checks monopolized event loop.

**Solutions**:
- **Global iteration budget**: 12,000 iterations/tick shared across ALL callers
- **Zero-allocation scratch tiles**: Reuse instance fields instead of allocating per iteration
- **Per-tick walkability cache**: First check expensive, remaining 24 are O(1)
- **Pre-baked terrain walkability**: WATER and STEEP_SLOPE flags baked into collision matrix

**Impact**: BFS cost reduced by ~70% (200-600ms → 100-190ms per tick), 25 agents can pathfind simultaneously.

#### Terrain System Server Optimization
**Changes**:
- **Low-res collision mesh**: 16×16 vertices (512 triangles) instead of 64×64 (8192 triangles) — ~16x faster PhysX cooking
- **Time-budgeted processing**: Multiple tiles per tick within 8ms budget
- **Deferred walkability baking**: Spreads 10,000-iteration work across ticks (4ms budget)
- **Server-only lightweight tiles**: Skip client-only data (~80% memory reduction per tile)

**Impact**: PhysX cooking ~16x faster, collision queue processes multiple tiles per tick, server terrain memory reduced by ~80%.

**Configuration**:
```bash\n# Enable/disable uWS (default: enabled)\nUWS_ENABLED=true\nUWS_PORT=5556\n\n# Client WebSocket URL\nPUBLIC_WS_URL=ws://localhost:5556/ws  # uWS (default)\n# or\nPUBLIC_WS_URL=ws://localhost:5555/ws  # Fastify fallback\n```\n\n**Files Changed**: 54 files, 6,502 additions, 1,164 deletions. See PR #1064 for complete details.

## Recent Updates (March 2026)

### VRM Material Isolation Fix (March 17, 2026)
**Problem**: `SkeletonUtils.clone()` shares material instances across all VRM clones, causing hover highlight on one mob to affect all mobs of the same type (hovering over one goblin highlighted all goblins).

**Fix**: Create fresh `MeshStandardNodeMaterial` per mesh in `cloneGLB()` so each entity has independent `outputNode`/uniforms. Textures remain shared by reference for memory efficiency.

**Impact**: Each mob instance now has independent highlight state, fixes visual bug where all VRM mobs of same type would highlight together.

### Mob AI Tick Processing Fix (March 17, 2026)
**Problem**: `MobEntity.serverUpdate()` defers AI to `GameTickProcessor.runAITick()`, but `GameTickProcessor` was never instantiated — so mob AI state machines never received `update()` calls. Goblins entered IDLE on spawn and never transitioned to WANDER, CHASE, or ATTACK.

**Fix**: Register mob AI tick handler at MOVEMENT priority in `ServerNetwork`, before mob tile movement, so AI decides movement targets and the movement system executes paths on the same tick.

**Impact**: Mob AI state machines now function correctly, goblins properly transition through IDLE → WANDER → CHASE → ATTACK states, deterministic OSRS-style tick ordering.

### Dev Server Performance Fix (March 16, 2026)
**Problem**: Two compounding issues caused the dev script to consume 100% CPU core while completely idle:
1. `awaitWriteFinish` polls every watched file at 100ms (redundant since script already debounces rebuilds)
2. Polling fallback does a full recursive directory walk every 1s

**Fix**: Removed `awaitWriteFinish` config and increased polling fallback interval from 1s to 5s.

**Impact**: Eliminates 100% CPU usage when dev server is idle, reduces unnecessary file system polling, better developer experience with lower resource consumption, no impact on rebuild responsiveness (200ms debounce still active).

### Docker Build Improvements (March 15-18, 2026)
**Key Changes:**
- **Bun 1.3.10 Upgrade**: Updated from 1.1.38 to support Vite 6+ builds in Docker
- **Multi-Service Support**: Added `packages/client` build to Docker image (required for multi-service deployments)
- **Workspace Symlinks**: Fixed Docker COPY flattening workspace symlinks with `bun install --production` in runtime stage
- **Per-Package node_modules**: Properly handles Bun 1.3's per-package dependency structure (no longer hoists to root)
- **better-sqlite3 Removal**: Stripped from manifests during build to prevent QEMU cross-compilation segfaults
- **Manifest Embedding**: Copies cleaned manifests from builder stage to ensure consistency

**Impact**: Multi-service deployments work correctly, Vite 6+ builds succeed, workspace packages (@hyperscape/*) resolve at runtime, no more QEMU segfaults.

### Dependency Updates (March 19, 2026)
**Major Version Upgrades (Breaking Changes):**
- **Vite**: 6.4.1 → 8.0.0
  - New plugin API and config schema
  - Faster builds, improved HMR, better tree-shaking
  - **Migration**: Update `vite.config.ts` for Vite 8 plugin API
- **@vitejs/plugin-react**: 5.2.0 → 6.0.1
  - New Fast Refresh implementation for React 19
  - **Migration**: Update plugin configuration in `vite.config.ts`
- **@nomicfoundation/hardhat-ethers**: 3.1.3 → 4.0.6
  - ethers.js v6 integration
  - **Migration**: Update contract deployment scripts for ethers v6 API
- **jsdom**: 28.1.0 → 29.0.0
  - Improved DOM API compatibility and performance
  - Better test environment for React 19 components
- **jest**: 29.7.0 → 30.3.0
  - New snapshot format and improved performance
  - **Migration**: Regenerate snapshots with `npm test -- -u`
- **sqlite3**: 5.1.7 → 6.0.1
  - Node.js 18+ required
  - Performance improvements
  - **Note**: Removed from Docker builds to prevent QEMU segfaults (production uses PostgreSQL)

**Minor/Patch Updates:**
- **@pixiv/three-vrm**: 3.4.3 → 3.5.1 (VRM avatar support improvements)
- **@solana-mobile/wallet-standard-mobile**: 0.4.4 → 0.5.0 (enhanced mobile wallet integration)
- **@vitest/coverage-v8**: 4.0.18 → 4.1.0 (improved coverage reporting)
- **@types/three**: 0.182.0 → 0.183.1 (TypeScript definitions for Three.js 0.183.2)

**Impact**: 
- **Performance**: Faster builds, improved HMR, better test execution
- **Compatibility**: Better React 19 support, latest VRM features, enhanced mobile wallet integration
- **Type Safety**: Improved TypeScript definitions for Three.js WebGPU renderer
- **Breaking Changes**: Requires migration for Vite configs, contract scripts, and test snapshots

**Migration Checklist**:
1. Update `vite.config.ts` plugin configurations for Vite 8 API
2. Ensure Fast Refresh configuration is compatible with React plugin 6
3. Update contract deployment scripts to use ethers v6 API
4. Regenerate Jest snapshots: `npm test -- -u`
5. Verify Node.js 18+ is installed (for sqlite3 6, though not used in production)

**📖 Complete Migration Guide**: See [`docs/migration-march-2026.md`](docs/migration-march-2026.md) for detailed migration steps, code examples, and troubleshooting.

## Performance & Architecture

### Server Requirements (Updated March 2026)

**Runtime**: Node.js 22+ (migrated from Bun for V8 incremental GC)

**Why Node.js?** Bun's JavaScriptCore uses stop-the-world GC causing 500-1200ms pauses that destroyed the 600ms game tick. Node.js V8 has incremental/concurrent GC keeping pauses <10ms.

**WebSocket Architecture**: Dual-port design for optimal performance
- **Port 5555** (Fastify): HTTP API, health checks, admin endpoints
- **Port 5556** (uWebSockets.js): Game WebSocket traffic (real-time multiplayer)

**AI Agent Architecture**: Worker thread isolation
- Agent decision logic runs in worker thread (doesn't block game tick)
- Main thread collects snapshots, worker makes decisions, main thread executes actions
- Supports 25+ AI agents without event loop starvation

**Pathfinding**: Global BFS iteration budget
- 12,000 iterations/tick shared across all pathfinding callers
- Zero-allocation scratch tiles
- Per-tick walkability cache
- Pre-baked terrain walkability flags

**Tick System**: 600ms OSRS-accurate ticks
- Drift-corrected setTimeout for precise timing
- Tick health monitoring (missed ticks, lateness, duration)
- Per-handler timing for bottleneck identification
- F5 DevStats panel for real-time diagnostics

## More Info

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, architecture documentation, and coding standards.

## License

MIT
