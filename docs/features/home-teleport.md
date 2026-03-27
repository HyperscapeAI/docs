# Home Teleport System

The home teleport system allows players to return to their spawn location with a 10-second interruptible cast time and 30-second cooldown.

## Overview

**Added**: March 26, 2026 (PR #1095)

**Features**:
- 10-second cast time (interruptible by movement/combat)
- 30-second cooldown (reduced from 15 minutes)
- Visual cast effects with portal animation
- Server-authoritative cooldown tracking
- Minimap orb integration for quick access
- Dual UI: dedicated button + minimap orb

## Constants

```typescript
// packages/shared/src/constants/GameConstants.ts
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30 * 1000,        // 30 seconds
  CAST_TIME_MS: 10 * 1000,       // 10 seconds (interruptible)
  CAST_TIME_TICKS: 17,           // ~17 ticks at 600ms/tick
} as const;
```

## Client Components

### HomeTeleportButton

Dedicated teleport button with cast progress and cooldown visualization.

**Location**: `packages/client/src/game/hud/HomeTeleportButton.tsx`

**States**:
- `ready` - Available to cast
- `casting` - Cast in progress (shows progress bar)
- `cooldown` - On cooldown (shows remaining time + refill visual)

**Usage**:
```typescript
import { HomeTeleportButton } from '@/game/hud/HomeTeleportButton';

<HomeTeleportButton world={world} />
```

**Features**:
- Click to start cast
- Progress bar during 10-second cast
- Cooldown refill visual (bottom-to-top gradient)
- Displays remaining cooldown time ("25s", "1m 5s")

### MinimapHomeTeleportOrb

Minimap orb for quick teleport access.

**Location**: `packages/client/src/game/hud/MinimapHomeTeleportOrb.tsx`

**Features**:
- Circular progress indicator (SVG-based)
- Color-coded states (purple=ready, blue=casting, gray=cooldown)
- Cooldown refill animation
- Compact design for minimap integration

**Usage**:
```typescript
import { MinimapHomeTeleportOrb } from '@/game/hud/MinimapHomeTeleportOrb';

<MinimapHomeTeleportOrb world={world} />
```

### Shared Utilities

**Location**: `packages/client/src/game/hud/homeTeleportUi.ts`

#### `readHomeTeleportRemainingMs()`

Extract remaining cooldown milliseconds from server event.

```typescript
export function readHomeTeleportRemainingMs(event?: unknown): number
```

**Parameters**:
- `event` - Event payload from `HOME_TELEPORT_FAILED`

**Returns**: Remaining cooldown in milliseconds, or 0 if not on cooldown

**Example**:
```typescript
const onFailed = (event?: unknown) => {
  const remainingMs = readHomeTeleportRemainingMs(event);
  if (remainingMs > 0) {
    // Enter cooldown state
    setState("cooldown");
    setCooldownEndTime(performance.now() + remainingMs);
  }
};
```

#### `getHomeTeleportCooldownProgress()`

Calculate cooldown progress percentage for UI visualization.

```typescript
export function getHomeTeleportCooldownProgress(
  cooldownRemaining: number,
): number
```

**Parameters**:
- `cooldownRemaining` - Remaining cooldown in milliseconds

**Returns**: Progress percentage (0-100), clamped

**Example**:
```typescript
const cooldownProgress = getHomeTeleportCooldownProgress(15000);
// 50 (halfway through 30-second cooldown)
```

## Server Implementation

### HomeTeleportManager

**Location**: `packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts`

#### `formatCooldownRemaining()`

Format cooldown duration as human-readable string.

```typescript
export function formatCooldownRemaining(remainingMs: number): string
```

**Parameters**:
- `remainingMs` - Remaining cooldown in milliseconds

**Returns**: Formatted string ("Xs", "Xm", "Xm Ys")

**Examples**:
```typescript
formatCooldownRemaining(0);      // "1s" (rounds up to minimum 1s)
formatCooldownRemaining(999);    // "1s"
formatCooldownRemaining(5000);   // "5s"
formatCooldownRemaining(60000);  // "1m"
formatCooldownRemaining(90500);  // "1m 31s"
```

#### Server Validation

The server validates teleport requests and sends detailed rejection reasons:

```typescript
// Cooldown rejection includes remaining time
if (this.isOnCooldown(playerId)) {
  const remainingMs = this.getCooldownRemaining(playerId);
  return `Home teleport on cooldown (${formatCooldownRemaining(remainingMs)} remaining)`;
}

// Send to client with remainingMs field
socket.send("homeTeleportFailed", {
  reason: error,
  remainingMs: remainingMs > 0 ? remainingMs : undefined,
});
```

**Rejection Reasons**:
- Already casting
- On cooldown (includes `remainingMs`)
- In combat
- Dead
- In duel arena

## Visual Effects

### Cast Effect (Channel Mode)

**Location**: `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`

**Components**:
- Portal veil (cylinder with gradient)
- Lower orbital ring (bronze, rotating)
- Upper orbital ring (gold, counter-rotating)
- Crown ring (parchment, top of portal)

**Lifecycle**:
1. `HOME_TELEPORT_CAST_START` → spawn channel effect
2. Update every frame with progress-based animations
3. `HOME_TELEPORT_FAILED` or `HOME_TELEPORT_CAST_CANCEL` → stop effect
4. `PLAYER_TELEPORTED` → transition to arrival burst

**Terrain Anchoring**:
- Portal anchored to player's lowest bone position (feet/hips)
- Falls back to terrain height if bones unavailable
- Small ground clearance (0.015m) for visual grounding

### Arrival Effect (Burst Mode)

Separate burst effect when teleport completes:
- Rune circle
- Beam eruption
- Particle helix
- Shockwave rings

**Trigger**: `PLAYER_TELEPORTED` event with `position` field

## Events

### `HOME_TELEPORT_CAST_START`

Fired when player begins casting home teleport.

**Payload**:
```typescript
{
  castTimeMs: number;  // Cast duration (typically 10000)
}
```

**Subscribers**:
- `ClientTeleportEffectsSystem` - Spawns channel-mode portal effect
- `HomeTeleportButton` - Enters casting state
- `MinimapHomeTeleportOrb` - Enters casting state

### `HOME_TELEPORT_FAILED`

Fired when teleport is rejected or interrupted.

**Payload**:
```typescript
{
  reason: string;       // Human-readable rejection reason
  remainingMs?: number; // Remaining cooldown (if rejected due to cooldown)
}
```

**Subscribers**:
- `ClientTeleportEffectsSystem` - Stops channel effect
- `HomeTeleportButton` - Enters cooldown or ready state
- `MinimapHomeTeleportOrb` - Enters cooldown or ready state

### `HOME_TELEPORT_CAST_CANCEL`

Fired when player cancels cast (movement/combat).

**Payload**: None

**Subscribers**:
- `ClientTeleportEffectsSystem` - Stops channel effect
- `HomeTeleportButton` - Returns to ready state
- `MinimapHomeTeleportOrb` - Returns to ready state

### `PLAYER_TELEPORTED`

Fired when teleport completes successfully.

**Payload**:
```typescript
{
  playerId: string;
  position: { x: number; y: number; z: number };
  suppressEffect?: boolean;
}
```

**Subscribers**:
- `ClientTeleportEffectsSystem` - Spawns arrival burst effect, stops channel effect
- `HomeTeleportButton` - Enters cooldown state
- `MinimapHomeTeleportOrb` - Enters cooldown state

## Network Protocol

### Client → Server

#### `homeTeleport`

Request to start home teleport cast.

**Payload**: Empty object `{}`

**Response**: 
- Success: `homeTeleportCastStart` packet
- Failure: `homeTeleportFailed` packet with reason

#### `homeTeleportCancel`

Request to cancel active cast.

**Payload**: Empty object `{}`

**Response**: `homeTeleportCastCancel` packet

### Server → Client

#### `homeTeleportCastStart`

Cast started successfully.

**Payload**:
```typescript
{
  castTimeMs: number;  // Cast duration
}
```

#### `homeTeleportFailed`

Teleport rejected or interrupted.

**Payload**:
```typescript
{
  reason: string;       // Rejection reason
  remainingMs?: number; // Remaining cooldown (if applicable)
}
```

#### `homeTeleportCastCancel`

Cast cancelled (movement/combat).

**Payload**: Empty object `{}`

#### `playerTeleported`

Teleport completed (also used for other teleport types).

**Payload**:
```typescript
{
  playerId: string;
  position: { x: number; y: number; z: number };
  suppressEffect?: boolean;
}
```

## Server-Side Logic

### Cast State Machine

**States**:
1. **Idle** - Not casting
2. **Casting** - Cast in progress (10 seconds)
3. **Cooldown** - Recently teleported (30 seconds)

**Transitions**:
```
Idle → Casting (on homeTeleport request)
Casting → Cooldown (on cast complete)
Casting → Idle (on cancel/fail)
Cooldown → Idle (after 30 seconds)
```

### Interruption Conditions

Cast is interrupted if:
- Player moves
- Player enters combat
- Player takes damage
- Player dies

**Implementation**: Server tracks cast start tick and validates on each tick. If player state changes, cast is cancelled.

### Cooldown Tracking

**Per-Player State**:
```typescript
private castStates = new Map<string, {
  startTick: number;
  castTimeMs: number;
}>();

private cooldowns = new Map<string, number>(); // playerId → cooldown end tick
```

**Cooldown Check**:
```typescript
isOnCooldown(playerId: string): boolean {
  const endTick = this.cooldowns.get(playerId);
  if (!endTick) return false;
  return this.getCurrentTick() < endTick;
}

getCooldownRemaining(playerId: string): number {
  const endTick = this.cooldowns.get(playerId);
  if (!endTick) return 0;
  const currentTick = this.getCurrentTick();
  if (currentTick >= endTick) return 0;
  return (endTick - currentTick) * TICK_DURATION_MS;
}
```

## Testing

### Unit Tests

**Location**: `packages/server/tests/unit/teleport/HomeTeleportManager.test.ts`

**Coverage**:
- Cast start and completion
- Cooldown enforcement (30 seconds)
- Interruption by movement/combat
- Multiple players casting simultaneously
- Cooldown expiration
- `remainingMs` field in rejection packets
- `formatCooldownRemaining()` edge cases

**Run**:
```bash
bunx vitest run packages/server/tests/unit/teleport/HomeTeleportManager.test.ts
```

### Integration Tests

Use Playwright to test full teleport flow:
1. Click teleport button
2. Verify cast progress bar appears
3. Wait 10 seconds
4. Verify player teleports to spawn
5. Verify cooldown state
6. Wait 30 seconds
7. Verify ready state

## Performance Considerations

### Channel Effect Pool

Channel effects reuse the same object pool as burst teleport effects. If all pool entries are active, channel effect spawn returns `null` and cast visual is silently missing.

**Pool Size**: 8 entries (configurable via `POOL_SIZE` constant)

**Mitigation**: Channel effect has timeout buffer (1.5 seconds) to auto-deactivate if server completion is delayed.

### Bone Iteration

`getLocalPlayerTeleportAnchor()` iterates up to 12 bones per frame during cast to find lowest bone position for grounding. This is acceptable for a single-player effect at 60fps.

**Bones Checked**:
```typescript
const TELEPORT_GROUND_CONTACT_BONES = [
  "leftFoot", "rightFoot",
  "leftToes", "rightToes",
  "leftLowerLeg", "rightLowerLeg",
  "leftUpperLeg", "rightUpperLeg",
  "hips", "spine", "chest", "upperChest",
] as const;
```

**Optimization**: Pre-allocated `Vector3` scratch objects avoid per-frame allocations.

## Troubleshooting

### Cast Effect Not Appearing

**Diagnosis**:
1. Check browser console for `HOME_TELEPORT_CAST_START` event
2. Verify `ClientTeleportEffectsSystem` is initialized
3. Check object pool availability (may be exhausted)

**Fix**:
```typescript
// Increase pool size if needed
const POOL_SIZE = 12; // Was 8
```

### Cooldown Stuck

**Symptoms**: Button shows cooldown but server allows teleport, or vice versa.

**Diagnosis**:
1. Check server logs for cooldown state
2. Verify `remainingMs` field in `homeTeleportFailed` packet
3. Check client is reading `remainingMs` correctly

**Fix**: Server is authoritative - client should always sync to server state via `remainingMs` field.

### Portal Not Grounded

**Symptoms**: Portal floats above or sinks below player.

**Diagnosis**:
1. Verify terrain system is ready (`terrain.isReady()`)
2. Check `getHeightAt()` returns valid values
3. Verify bone transforms are available

**Fix**: Portal uses fallback chain:
1. Lowest bone position (if avatar has bones)
2. Terrain height (if terrain system ready)
3. Player position + small offset (final fallback)

## See Also

- [ClientTeleportEffectsSystem](../../packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts) - Visual effects implementation
- [HomeTeleportManager](../../packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts) - Server-side logic
- [GameConstants](../../packages/shared/src/constants/GameConstants.ts) - Cooldown and cast time constants
