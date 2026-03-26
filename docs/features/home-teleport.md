# Home Teleport Feature

**Added**: March 26, 2026  
**Related PR**: #1095

## Overview

The home teleport feature allows players to quickly return to their home location with a polished visual cast effect and cooldown system. The feature is accessible via the minimap orb and provides smooth teleport animation with camera transition.

## Features

### Visual Cast Effects

- **Particle Animation**: Swirling particles during cast
- **Cast Bar**: Progress indicator showing cast time
- **Sound Effects**: Audio feedback for cast start and completion
- **Camera Shake**: Subtle shake on teleport completion

### Cooldown System

- **Cooldown Duration**: 30 seconds (configurable)
- **UI Feedback**: Cooldown timer displayed on minimap orb
- **Visual Indicator**: Orb dims during cooldown
- **Tooltip**: Shows remaining cooldown time on hover

### Minimap Integration

- **Minimap Orb**: Dedicated orb for home teleport
- **Quick Access**: Single click to initiate teleport
- **Visual State**: Different appearance for ready/cooldown/casting states
- **Tooltip**: Shows "Teleport Home" or cooldown time

## User Experience

### Teleport Flow

```
1. Player clicks home teleport orb on minimap
   ↓
2. Check cooldown (if on cooldown, show tooltip and return)
   ↓
3. Check combat (if in combat, show error and return)
   ↓
4. Start cast animation (3 seconds)
   ├─ Show cast bar
   ├─ Play particle effects
   ├─ Play cast sound
   └─ Lock player movement
   ↓
5. Cast completes
   ├─ Teleport player to home location
   ├─ Play completion sound
   ├─ Camera transition
   └─ Start cooldown (30 seconds)
   ↓
6. Cooldown expires → ready to teleport again
```

### Interruption

Cast can be interrupted by:
- Taking damage
- Moving
- Clicking cancel button
- Logging out

**On Interruption**:
- Cast bar disappears
- Particle effects stop
- Player movement unlocked
- Cooldown NOT triggered (can retry immediately)

## Implementation

### Client-Side

#### MinimapHomeTeleportOrb Component

```typescript
// packages/client/src/game/hud/MinimapHomeTeleportOrb.tsx
interface MinimapHomeTeleportOrbProps {
  world: World;
  playerId: string;
  theme: Theme;
}

export function MinimapHomeTeleportOrb({ world, playerId, theme }: MinimapHomeTeleportOrbProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isCasting, setIsCasting] = useState(false);

  const handleClick = () => {
    if (cooldownRemaining > 0) {
      // Show tooltip with remaining time
      return;
    }

    if (isCasting) {
      // Cancel cast
      world.emit("HOME_TELEPORT_CANCEL", { playerId });
      return;
    }

    // Start cast
    world.emit("HOME_TELEPORT_START", { playerId });
  };

  // ... render orb with state-based styling
}
```

#### Cast Effects

```typescript
// packages/client/src/game/hud/homeTeleportUi.ts
export function createHomeTeleportCastEffect(world: World, playerId: string) {
  const player = world.getEntity(playerId) as PlayerEntity;
  
  // Create particle system
  const particles = new ParticleSystem({
    position: player.position,
    count: 100,
    lifetime: 3.0,
    color: new Color(0x4a9eff),
    // ... particle config
  });

  // Create cast bar
  const castBar = new CastBar({
    duration: 3000,
    label: "Teleporting...",
    // ... cast bar config
  });

  return { particles, castBar };
}
```

### Server-Side

#### HomeTeleportManager

```typescript
// packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts
export class HomeTeleportManager {
  private castingSessions = new Map<string, CastSession>();
  private cooldowns = new Map<string, number>();

  handleTeleportStart(playerId: string) {
    // Check cooldown
    if (this.isOnCooldown(playerId)) {
      this.sendError(playerId, "Home teleport is on cooldown");
      return;
    }

    // Check combat
    if (this.isInCombat(playerId)) {
      this.sendError(playerId, "You can't teleport during combat");
      return;
    }

    // Start cast session
    this.startCast(playerId);
  }

  private startCast(playerId: string) {
    const session: CastSession = {
      playerId,
      startTime: Date.now(),
      duration: 3000,
    };

    this.castingSessions.set(playerId, session);

    // Schedule completion
    setTimeout(() => {
      this.completeCast(playerId);
    }, 3000);
  }

  private completeCast(playerId: string) {
    const session = this.castingSessions.get(playerId);
    if (!session) return;

    // Teleport player
    const player = this.world.getEntity(playerId) as PlayerEntity;
    player.position.copy(this.getHomeLocation(playerId));

    // Start cooldown
    this.cooldowns.set(playerId, Date.now() + 30000);

    // Cleanup
    this.castingSessions.delete(playerId);

    // Notify client
    this.world.emit("HOME_TELEPORT_COMPLETE", { playerId });
  }

  handleTeleportCancel(playerId: string) {
    this.castingSessions.delete(playerId);
    // No cooldown on cancel
  }

  private isOnCooldown(playerId: string): boolean {
    const cooldownEnd = this.cooldowns.get(playerId);
    if (!cooldownEnd) return false;
    
    const now = Date.now();
    if (now >= cooldownEnd) {
      this.cooldowns.delete(playerId);
      return false;
    }
    
    return true;
  }
}
```

## Configuration

### Constants

```typescript
// Cast duration
const CAST_DURATION_MS = 3000;  // 3 seconds

// Cooldown duration
const COOLDOWN_DURATION_MS = 30000;  // 30 seconds

// Particle count
const PARTICLE_COUNT = 100;

// Camera transition duration
const CAMERA_TRANSITION_MS = 500;
```

### Home Location

Home location is determined by:
1. Player's set home (if configured)
2. Last respawn point (if died recently)
3. Default spawn point (Lumbridge equivalent)

**Future**: Allow players to set custom home location at specific objects (beds, portals, etc.)

## Events

### HOME_TELEPORT_START

Emitted when player initiates teleport.

```typescript
world.emit("HOME_TELEPORT_START", { playerId: string });
```

**Payload**:
- `playerId` - Player entity ID

**Subscribers**:
- `HomeTeleportManager` (server) - Validates and starts cast
- `MinimapHomeTeleportOrb` (client) - Updates UI state

### HOME_TELEPORT_CANCEL

Emitted when player cancels teleport.

```typescript
world.emit("HOME_TELEPORT_CANCEL", { playerId: string });
```

**Payload**:
- `playerId` - Player entity ID

**Subscribers**:
- `HomeTeleportManager` (server) - Cancels cast session
- `MinimapHomeTeleportOrb` (client) - Resets UI state

### HOME_TELEPORT_COMPLETE

Emitted when teleport completes successfully.

```typescript
world.emit("HOME_TELEPORT_COMPLETE", { playerId: string });
```

**Payload**:
- `playerId` - Player entity ID

**Subscribers**:
- `MinimapHomeTeleportOrb` (client) - Starts cooldown timer
- `ClientCameraSystem` (client) - Triggers camera transition

### HOME_TELEPORT_INTERRUPTED

Emitted when teleport is interrupted (damage, movement, etc.).

```typescript
world.emit("HOME_TELEPORT_INTERRUPTED", { playerId: string; reason: string });
```

**Payload**:
- `playerId` - Player entity ID
- `reason` - Interruption reason ("damage", "movement", "logout")

**Subscribers**:
- `HomeTeleportManager` (server) - Cancels cast session
- `MinimapHomeTeleportOrb` (client) - Shows error message

## UI Components

### MinimapHomeTeleportOrb

Minimap orb for home teleport.

**Location**: Bottom-right of minimap (below compass)

**States**:
- **Ready**: Blue orb, clickable
- **Cooldown**: Gray orb, shows remaining time
- **Casting**: Pulsing animation, shows progress

**Tooltip**:
- Ready: "Teleport Home"
- Cooldown: "Teleport Home (15s)"
- Casting: "Teleporting... (click to cancel)"

### HomeTeleportButton

Alternative button for home teleport (not on minimap).

**Location**: Can be placed in action bar or quick access menu

**Features**:
- Same functionality as minimap orb
- Drag-to-action-bar support
- Keyboard shortcut support (future)

## Testing

### Unit Tests

```typescript
// Test cooldown system
test("home teleport cooldown prevents spam", () => {
  const manager = new HomeTeleportManager(world);
  
  manager.handleTeleportStart("player_1");
  manager.completeCast("player_1");
  
  // Should be on cooldown
  expect(manager.isOnCooldown("player_1")).toBe(true);
  
  // Should reject second teleport
  manager.handleTeleportStart("player_1");
  expect(manager.castingSessions.has("player_1")).toBe(false);
});

// Test combat guard
test("home teleport blocked during combat", () => {
  const manager = new HomeTeleportManager(world);
  const player = world.getEntity("player_1") as PlayerEntity;
  
  player.combat.inCombat = true;
  
  manager.handleTeleportStart("player_1");
  expect(manager.castingSessions.has("player_1")).toBe(false);
});

// Test interruption
test("home teleport interrupted by damage", () => {
  const manager = new HomeTeleportManager(world);
  
  manager.handleTeleportStart("player_1");
  expect(manager.castingSessions.has("player_1")).toBe(true);
  
  // Take damage
  world.emit("PLAYER_DAMAGED", { playerId: "player_1", damage: 5 });
  
  // Cast should be interrupted
  expect(manager.castingSessions.has("player_1")).toBe(false);
});
```

### Integration Tests

```typescript
// Test full teleport flow
test("home teleport flow end-to-end", async () => {
  const { world, player } = await createTestWorld();
  
  // Set initial position
  player.position.set(100, 0, 100);
  
  // Start teleport
  world.emit("HOME_TELEPORT_START", { playerId: player.id });
  
  // Wait for cast duration
  await sleep(3000);
  
  // Verify teleport completed
  expect(player.position.x).toBeCloseTo(0);
  expect(player.position.z).toBeCloseTo(0);
  
  // Verify cooldown active
  const manager = world.getSystem("homeTeleport") as HomeTeleportManager;
  expect(manager.isOnCooldown(player.id)).toBe(true);
});
```

## Future Enhancements

### Planned Features

- [ ] **Custom Home Location**: Set home at specific objects (beds, portals)
- [ ] **Multiple Home Locations**: Unlock additional teleport destinations
- [ ] **Teleport Tablets**: Consumable items for instant teleport
- [ ] **Group Teleport**: Teleport party members together
- [ ] **Teleport History**: Track recent teleport locations

### Potential Improvements

- [ ] **Reduced Cooldown**: Unlock shorter cooldowns via achievements
- [ ] **Instant Teleport**: Premium feature or high-level unlock
- [ ] **Teleport Animations**: More visual variety (portal, beam, etc.)
- [ ] **Sound Variety**: Different sounds for different home locations
- [ ] **Teleport Restrictions**: Prevent teleport in certain zones (dungeons, etc.)

## Configuration

### Environment Variables

```bash
# Home teleport (no specific env vars - uses game constants)
# Cast duration: 3 seconds (hardcoded)
# Cooldown duration: 30 seconds (hardcoded)
```

### Customization

To customize teleport behavior, edit constants in:

```typescript
// packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts
const CAST_DURATION_MS = 3000;      // Cast time
const COOLDOWN_DURATION_MS = 30000; // Cooldown time

// packages/client/src/game/hud/homeTeleportUi.ts
const PARTICLE_COUNT = 100;         // Particle count
const CAMERA_TRANSITION_MS = 500;   // Camera transition time
```

## Troubleshooting

### Issue: Teleport doesn't work

**Symptoms**: Clicking orb does nothing.

**Diagnosis**:
1. Check if player is in combat
2. Check if teleport is on cooldown
3. Check server logs for errors

**Solution**: Ensure player is not in combat and cooldown has expired.

### Issue: Cast interrupted immediately

**Symptoms**: Cast starts but cancels instantly.

**Diagnosis**:
1. Check if player is moving
2. Check if player is taking damage
3. Check for conflicting actions

**Solution**: Stand still and ensure no damage sources nearby.

### Issue: Cooldown not resetting

**Symptoms**: Cooldown timer stuck, never resets.

**Diagnosis**:
1. Check server logs for cooldown errors
2. Verify cooldown map is being cleaned up

**Solution**: Restart server. Cooldowns are in-memory and reset on server restart.

## API Reference

### HomeTeleportManager

```typescript
class HomeTeleportManager {
  // Start teleport cast
  handleTeleportStart(playerId: string): void

  // Cancel active cast
  handleTeleportCancel(playerId: string): void

  // Check if player is on cooldown
  isOnCooldown(playerId: string): boolean

  // Get remaining cooldown time (ms)
  getCooldownRemaining(playerId: string): number

  // Check if player is currently casting
  isCasting(playerId: string): boolean
}
```

### Events

```typescript
// Start teleport
world.emit("HOME_TELEPORT_START", { playerId: string });

// Cancel teleport
world.emit("HOME_TELEPORT_CANCEL", { playerId: string });

// Teleport completed
world.emit("HOME_TELEPORT_COMPLETE", { playerId: string });

// Teleport interrupted
world.emit("HOME_TELEPORT_INTERRUPTED", { 
  playerId: string;
  reason: "damage" | "movement" | "logout";
});
```

## References

- **PR #1095**: Home teleport polish
- **MinimapHomeTeleportOrb.tsx**: Minimap orb component
- **homeTeleportUi.ts**: Cast effects and UI utilities
- **home-teleport.ts**: Server-side handler
