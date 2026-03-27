# Home Teleport System Documentation

Comprehensive guide for the home teleport system (polished in PR #1095, March 26, 2026).

## Overview

The home teleport system provides a visual, cooldown-based teleportation mechanic with:
- 10-second interruptible cast time
- 30-second cooldown (server-authoritative)
- Dedicated portal visual effects
- Minimap orb integration
- Terrain-aware effect anchoring

## Architecture

### Components

**Client**:
- `HomeTeleportButton.tsx` - Main teleport button in HUD
- `MinimapHomeTeleportOrb.tsx` - Minimap orb with cooldown display
- `ClientTeleportEffectsSystem.ts` - Portal visual effects
- `homeTeleportUi.ts` - Shared UI utilities

**Server**:
- `home-teleport.ts` - Server-side handler with cooldown enforcement
- `GameConstants.ts` - Teleport timing constants

**Shared**:
- `Events.ts` - Teleport event definitions
- `packets.ts` - Network packet schemas

### Event Flow

```
1. Player clicks teleport button
       ↓
2. Client emits HOME_TELEPORT_CAST_START
   ├── Show cast progress bar
   ├── Spawn portal effect at player position
   └── Start 10-second cast timer
       ↓
3. Client sends homeTeleportRequest packet to server
       ↓
4. Server validates request:
   ├── Check cooldown (30 seconds)
   ├── Check player is alive
   ├── Check player is not in combat
   └── Check player is not in restricted zone
       ↓
5a. If valid:
    ├── Server teleports player to home position
    ├── Server sends playerTeleport packet
    ├── Client emits PLAYER_TELEPORTED event
    ├── Client clears cast effect
    └── Client starts cooldown timer
       ↓
5b. If invalid (cooldown):
    ├── Server sends homeTeleportFailed packet with remainingMs
    ├── Client emits HOME_TELEPORT_FAILED event
    ├── Client shows error message with remaining time
    └── Client clears cast effect
```

## Constants

### `HOME_TELEPORT_CONSTANTS`

```typescript
// packages/shared/src/constants/GameConstants.ts
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 30 * 1000,        // 30 seconds
  CAST_TIME_MS: 10 * 1000,       // 10 seconds (interruptible)
  CAST_TIME_TICKS: 17,           // ~17 ticks at 600ms/tick
} as const;
```

**Tuning**:
- `COOLDOWN_MS`: Time between teleports (reduced from 15 minutes to 30 seconds in PR #1095)
- `CAST_TIME_MS`: Cast duration (interruptible by movement/combat)
- `CAST_TIME_TICKS`: Tick-based cast duration for server validation

## Client Implementation

### HomeTeleportButton

```typescript
// packages/client/src/game/hud/HomeTeleportButton.tsx
export function HomeTeleportButton() {
  const [cooldownProgress, setCooldownProgress] = useState(1);
  const [isCasting, setIsCasting] = useState(false);
  const [castProgress, setCastProgress] = useState(0);

  // Listen for cast start
  useEffect(() => {
    const handleCastStart = () => {
      setIsCasting(true);
      setCastProgress(0);
      // Animate cast progress over CAST_TIME_MS
    };
    world.on(EventType.HOME_TELEPORT_CAST_START, handleCastStart);
    return () => world.off(EventType.HOME_TELEPORT_CAST_START, handleCastStart);
  }, []);

  // Listen for teleport success
  useEffect(() => {
    const handleTeleported = () => {
      setIsCasting(false);
      setCooldownProgress(0);
      // Animate cooldown refill over COOLDOWN_MS
    };
    world.on(EventType.PLAYER_TELEPORTED, handleTeleported);
    return () => world.off(EventType.PLAYER_TELEPORTED, handleTeleported);
  }, []);

  // Listen for teleport failure
  useEffect(() => {
    const handleFailed = (data: { reason: string; remainingMs?: number }) => {
      setIsCasting(false);
      if (data.remainingMs) {
        // Server sent remaining cooldown time
        const progress = 1 - (data.remainingMs / HOME_TELEPORT_CONSTANTS.COOLDOWN_MS);
        setCooldownProgress(Math.max(0, Math.min(1, progress)));
      }
    };
    world.on(EventType.HOME_TELEPORT_FAILED, handleFailed);
    return () => world.off(EventType.HOME_TELEPORT_FAILED, handleFailed);
  }, []);

  const handleClick = () => {
    if (cooldownProgress < 1) {
      // Show cooldown message
      return;
    }
    
    // Emit cast start event (triggers visual effects)
    world.emit(EventType.HOME_TELEPORT_CAST_START, {});
    
    // Send request to server
    world.network.send('homeTeleportRequest', {});
  };

  return (
    <button onClick={handleClick} disabled={cooldownProgress < 1 || isCasting}>
      {isCasting ? `Casting... ${Math.floor(castProgress * 100)}%` : 'Home'}
      {cooldownProgress < 1 && (
        <div className="cooldown-overlay" style={{ height: `${(1 - cooldownProgress) * 100}%` }} />
      )}
    </button>
  );
}
```

### MinimapHomeTeleportOrb

```typescript
// packages/client/src/game/hud/MinimapHomeTeleportOrb.tsx
export function MinimapHomeTeleportOrb() {
  const [cooldownProgress, setCooldownProgress] = useState(1);

  // Same event listeners as HomeTeleportButton
  // Renders as circular orb with radial cooldown fill

  return (
    <div className="minimap-orb" onClick={handleClick}>
      <svg viewBox="0 0 100 100">
        {/* Radial cooldown fill */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="10"
          strokeDasharray={`${cooldownProgress * 283} 283`}
        />
      </svg>
      <HomeIcon />
    </div>
  );
}
```

### ClientTeleportEffectsSystem

```typescript
// packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts
export class ClientTeleportEffectsSystem extends SystemBase {
  private activePortals = new Map<string, PortalEffect>();

  async init(): Promise<void> {
    // Listen for cast start
    this.subscribe(EventType.HOME_TELEPORT_CAST_START, () => {
      this.spawnPortalEffect();
    });

    // Listen for teleport success/failure
    this.subscribe(EventType.PLAYER_TELEPORTED, () => {
      this.clearPortalEffect();
    });
    this.subscribe(EventType.HOME_TELEPORT_FAILED, () => {
      this.clearPortalEffect();
    });
  }

  private spawnPortalEffect(): void {
    const player = this.world.getLocalPlayer();
    if (!player) return;

    // Get player's lowest bone position for grounded appearance
    const anchorPosition = this.getLowestBonePosition(player);

    // Create portal effect with veil and orbital rings
    const portal = new PortalEffect({
      position: anchorPosition,
      duration: HOME_TELEPORT_CONSTANTS.CAST_TIME_MS,
      mode: 'channel', // Continuous effect during cast
    });

    this.activePortals.set(player.id, portal);
    this.world.stage.add(portal.mesh);
  }

  private getLowestBonePosition(player: PlayerEntity): Vector3 {
    // Find lowest bone in VRM skeleton for terrain-aware anchoring
    const vrm = player.avatar?.vrm;
    if (!vrm) return player.position;

    let lowestY = Infinity;
    let lowestBone: Bone | null = null;

    vrm.humanoid.humanBones.forEach((bone) => {
      const worldPos = new Vector3();
      bone.node.getWorldPosition(worldPos);
      if (worldPos.y < lowestY) {
        lowestY = worldPos.y;
        lowestBone = bone.node;
      }
    });

    return lowestBone 
      ? lowestBone.getWorldPosition(new Vector3())
      : player.position;
  }
}
```

## Server Implementation

### Cooldown Enforcement

```typescript
// packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts
export function handleHomeTeleportRequest(
  playerId: string,
  world: World,
): void {
  const player = world.getPlayer(playerId);
  if (!player) return;

  // Check cooldown
  const lastTeleport = this.lastHomeTeleport.get(playerId) || 0;
  const elapsed = Date.now() - lastTeleport;
  const remaining = HOME_TELEPORT_CONSTANTS.COOLDOWN_MS - elapsed;

  if (remaining > 0) {
    // Send failure with remaining time
    world.network.sendTo(playerId, 'homeTeleportFailed', {
      reason: `Home teleport is on cooldown. ${formatCooldownRemaining(remaining)} remaining.`,
      remainingMs: remaining, // Client uses this for cooldown UI
    });
    return;
  }

  // Validate player state
  if (player.getHealth() <= 0) {
    world.network.sendTo(playerId, 'homeTeleportFailed', {
      reason: "You can't teleport while dead.",
    });
    return;
  }

  if (player.isInCombat()) {
    world.network.sendTo(playerId, 'homeTeleportFailed', {
      reason: "You can't teleport while in combat.",
    });
    return;
  }

  // Teleport to home position
  const homePosition = getPlayerHomePosition(playerId);
  player.teleportTo(homePosition);

  // Update cooldown
  this.lastHomeTeleport.set(playerId, Date.now());

  // Send success packet
  world.network.sendTo(playerId, 'playerTeleport', {
    playerId,
    position: [homePosition.x, homePosition.y, homePosition.z],
  });
}

function formatCooldownRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  return `${seconds}s`;
}
```

## Visual Effects

### Portal Effect

**Components**:
- **Veil**: Translucent cylinder with gradient shader
- **Orbital Rings**: Rotating rings around player
- **Particles**: Upward-flowing particles
- **Ground Anchor**: Effect anchored to player's lowest bone position

**Shader** (TSL):
```typescript
// Portal veil material
const veilMaterial = new MeshStandardNodeMaterial({
  transparent: true,
  opacity: 0.6,
  color: new Color(0x4488ff),
  emissive: new Color(0x2244aa),
  emissiveIntensity: 2.0,
});

// Gradient from bottom (opaque) to top (transparent)
veilMaterial.outputNode = mix(
  vec4(0.2, 0.4, 1.0, 0.8), // Bottom color (opaque)
  vec4(0.4, 0.6, 1.0, 0.0), // Top color (transparent)
  positionLocal.y.add(1.0).div(2.0), // Gradient factor
);
```

**Animation**:
```typescript
// Orbital rings rotation
const rotationSpeed = 0.002; // Radians per frame
ring1.rotation.y += rotationSpeed;
ring2.rotation.y -= rotationSpeed * 0.7; // Counter-rotate

// Veil scale pulse
const pulseScale = 1.0 + Math.sin(time * 2.0) * 0.1;
veil.scale.set(pulseScale, 1.0, pulseScale);

// Particle flow
particles.position.y += 0.05; // Upward flow
if (particles.position.y > 2.0) {
  particles.position.y = 0; // Reset to bottom
}
```

### Terrain-Aware Anchoring

**Problem**: Portal effect floats above ground when player is on uneven terrain.

**Solution**: Anchor to player's lowest bone position (usually feet).

```typescript
private getLowestBonePosition(player: PlayerEntity): Vector3 {
  const vrm = player.avatar?.vrm;
  if (!vrm) return player.position;

  let lowestY = Infinity;
  let lowestBone: Bone | null = null;

  vrm.humanoid.humanBones.forEach((bone) => {
    const worldPos = new Vector3();
    bone.node.getWorldPosition(worldPos);
    if (worldPos.y < lowestY) {
      lowestY = worldPos.y;
      lowestBone = bone.node;
    }
  });

  return lowestBone 
    ? lowestBone.getWorldPosition(new Vector3())
    : player.position;
}
```

**Result**: Portal effect stays grounded even on slopes, stairs, or uneven terrain.

## UI Integration

### Cooldown Display

**Progress Calculation**:
```typescript
// packages/client/src/game/hud/homeTeleportUi.ts
export function getHomeTeleportCooldownProgress(
  lastTeleportMs: number,
  currentMs: number,
): number {
  const elapsed = currentMs - lastTeleportMs;
  const progress = elapsed / HOME_TELEPORT_CONSTANTS.COOLDOWN_MS;
  return Math.max(0, Math.min(1, progress));
}
```

**Remaining Time Extraction**:
```typescript
export function readHomeTeleportRemainingMs(
  event: { remainingMs?: number },
): number {
  return typeof event.remainingMs === 'number' && event.remainingMs > 0
    ? event.remainingMs
    : 0;
}
```

**Usage**:
```typescript
// In HomeTeleportButton
const handleFailed = (data: { reason: string; remainingMs?: number }) => {
  const remaining = readHomeTeleportRemainingMs(data);
  if (remaining > 0) {
    const progress = 1 - (remaining / HOME_TELEPORT_CONSTANTS.COOLDOWN_MS);
    setCooldownProgress(Math.max(0, Math.min(1, progress)));
  }
  showMessage(data.reason);
};
```

### Cast Progress Bar

```typescript
// In HomeTeleportButton
const [castProgress, setCastProgress] = useState(0);

useEffect(() => {
  if (!isCasting) return;

  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / HOME_TELEPORT_CONSTANTS.CAST_TIME_MS;
    setCastProgress(Math.min(1, progress));
  }, 16); // 60 FPS

  return () => clearInterval(interval);
}, [isCasting]);

// Render
{isCasting && (
  <div className="cast-progress-bar">
    <div 
      className="cast-progress-fill" 
      style={{ width: `${castProgress * 100}%` }}
    />
  </div>
)}
```

## Network Protocol

### Packets

**Client → Server**:
```typescript
// homeTeleportRequest
{
  // No payload - server uses playerId from socket
}
```

**Server → Client**:
```typescript
// playerTeleport (success)
{
  playerId: string;
  position: [number, number, number];
}

// homeTeleportFailed (failure)
{
  reason: string;
  remainingMs?: number; // Cooldown remaining (if blocked by cooldown)
}
```

### Event Definitions

```typescript
// packages/shared/src/types/events/event-types.ts
export enum EventType {
  HOME_TELEPORT_CAST_START = "HOME_TELEPORT_CAST_START",
  HOME_TELEPORT_FAILED = "HOME_TELEPORT_FAILED",
  PLAYER_TELEPORTED = "PLAYER_TELEPORTED",
}

// Event payloads
export interface EventPayloads {
  [EventType.HOME_TELEPORT_CAST_START]: {};
  [EventType.HOME_TELEPORT_FAILED]: {
    reason: string;
    remainingMs?: number;
  };
  [EventType.PLAYER_TELEPORTED]: {
    playerId: string;
    position: { x: number; y: number; z: number };
  };
}
```

## Configuration

### Home Position

**Default**: Central Haven (starter town at origin)

```typescript
// packages/shared/src/data/world-areas.ts
export const STARTER_TOWNS = {
  central_haven: {
    name: "Central Haven",
    bounds: {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50,
    },
  },
};

// Calculate spawn position (center of town)
const centralHaven = STARTER_TOWNS["central_haven"];
const homePosition = {
  x: (centralHaven.bounds.minX + centralHaven.bounds.maxX) / 2,
  y: 0,
  z: (centralHaven.bounds.minZ + centralHaven.bounds.maxZ) / 2,
};
```

**Custom Home Position** (future feature):
```typescript
// Per-player home position (not yet implemented)
const homePosition = await this.getPlayerHomePosition(playerId);
// Falls back to Central Haven if not set
```

### Cooldown Tuning

**Reduce Cooldown** (for testing):
```typescript
// packages/shared/src/constants/GameConstants.ts
export const HOME_TELEPORT_CONSTANTS = {
  COOLDOWN_MS: 5 * 1000, // 5 seconds (testing only)
  CAST_TIME_MS: 2 * 1000, // 2 seconds (testing only)
  CAST_TIME_TICKS: 4,
} as const;
```

**Disable Cooldown** (for testing):
```typescript
// In server handler
const remaining = 0; // Skip cooldown check
```

## Testing

### Unit Tests

**homeTeleportUi.test.ts**:
```typescript
import { 
  getHomeTeleportCooldownProgress, 
  readHomeTeleportRemainingMs 
} from './homeTeleportUi';

describe('Home Teleport UI Utilities', () => {
  it('calculates cooldown progress correctly', () => {
    const lastTeleport = 1000;
    const current = 1000 + 15000; // 15 seconds elapsed
    const progress = getHomeTeleportCooldownProgress(lastTeleport, current);
    expect(progress).toBe(0.5); // 50% of 30-second cooldown
  });

  it('extracts remaining time from server event', () => {
    const event = { remainingMs: 12000 };
    const remaining = readHomeTeleportRemainingMs(event);
    expect(remaining).toBe(12000);
  });

  it('handles missing remainingMs gracefully', () => {
    const event = { reason: "On cooldown" };
    const remaining = readHomeTeleportRemainingMs(event);
    expect(remaining).toBe(0);
  });
});
```

### Integration Tests

**home-teleport.spec.ts**:
```typescript
import { test, expect } from '@playwright/test';

test('home teleport full flow', async ({ page }) => {
  // 1. Start game and log in
  await page.goto('http://localhost:3333');
  await loginAsTestUser(page);

  // 2. Click home teleport button
  await page.click('[data-testid="home-teleport-button"]');

  // 3. Verify cast effect appears
  await expect(page.locator('.portal-effect')).toBeVisible();

  // 4. Wait for cast to complete
  await page.waitForTimeout(10000);

  // 5. Verify player teleported to home position
  const position = await getPlayerPosition(page);
  expect(position.x).toBeCloseTo(0, 1);
  expect(position.z).toBeCloseTo(0, 1);

  // 6. Verify cooldown active
  const button = page.locator('[data-testid="home-teleport-button"]');
  await expect(button).toBeDisabled();

  // 7. Wait for cooldown to expire
  await page.waitForTimeout(30000);

  // 8. Verify button enabled again
  await expect(button).toBeEnabled();
});

test('home teleport cooldown rejection', async ({ page }) => {
  await page.goto('http://localhost:3333');
  await loginAsTestUser(page);

  // 1. First teleport (should succeed)
  await page.click('[data-testid="home-teleport-button"]');
  await page.waitForTimeout(10000);

  // 2. Second teleport (should fail with cooldown message)
  await page.click('[data-testid="home-teleport-button"]');
  
  // 3. Verify error message shows remaining time
  const message = await page.locator('.error-message').textContent();
  expect(message).toMatch(/cooldown.*\d+s remaining/i);
});
```

## Troubleshooting

### Issue: Cooldown stuck at 0% (never refills)

**Diagnosis**:
```typescript
// Check if PLAYER_TELEPORTED event is firing
world.on(EventType.PLAYER_TELEPORTED, (data) => {
  console.log('Teleport success:', data);
});

// Check if cooldown animation is running
console.log('Cooldown progress:', cooldownProgress);
```

**Causes**:
1. `PLAYER_TELEPORTED` event not firing
2. Cooldown animation not started
3. `setCooldownProgress(0)` not called on teleport success

**Fix**:
```typescript
// Ensure event listener is registered
useEffect(() => {
  const handleTeleported = () => {
    setIsCasting(false);
    setCooldownProgress(0); // Reset to 0%
    // Start cooldown animation
  };
  world.on(EventType.PLAYER_TELEPORTED, handleTeleported);
  return () => world.off(EventType.PLAYER_TELEPORTED, handleTeleported);
}, []);
```

### Issue: Portal effect doesn't appear

**Diagnosis**:
```typescript
// Check if ClientTeleportEffectsSystem is initialized
const system = world.getSystem('client-teleport-effects');
console.log('System initialized:', !!system);

// Check if HOME_TELEPORT_CAST_START event is firing
world.on(EventType.HOME_TELEPORT_CAST_START, () => {
  console.log('Cast start event fired');
});
```

**Causes**:
1. `ClientTeleportEffectsSystem` not registered
2. `HOME_TELEPORT_CAST_START` event not emitted
3. Portal mesh not added to stage

**Fix**:
```typescript
// Ensure system is registered in createClientWorld()
world.registerSystem(new ClientTeleportEffectsSystem(world));

// Ensure event is emitted on button click
const handleClick = () => {
  world.emit(EventType.HOME_TELEPORT_CAST_START, {});
  world.network.send('homeTeleportRequest', {});
};
```

### Issue: Portal floats above ground

**Diagnosis**:
```typescript
// Check anchor position
const anchorPos = this.getLowestBonePosition(player);
console.log('Anchor position:', anchorPos);

// Check terrain height
const terrainHeight = terrainSystem.getHeightAt(player.position.x, player.position.z);
console.log('Terrain height:', terrainHeight);
```

**Causes**:
1. `getLowestBonePosition()` returning player.position instead of bone position
2. VRM skeleton not loaded
3. Terrain system not ready

**Fix**:
```typescript
// Fallback to terrain height if VRM not available
private getGroundedPosition(player: PlayerEntity): Vector3 {
  const bonePos = this.getLowestBonePosition(player);
  
  const terrainSystem = this.world.getSystem('terrain');
  if (terrainSystem?.isReady()) {
    const terrainHeight = terrainSystem.getHeightAt(bonePos.x, bonePos.z);
    if (Number.isFinite(terrainHeight)) {
      bonePos.y = terrainHeight;
    }
  }
  
  return bonePos;
}
```

### Issue: Server sends wrong remainingMs

**Diagnosis**:
```bash
# Check server logs for cooldown calculation
grep "homeTeleportFailed.*remainingMs" logs/server.log
```

**Causes**:
1. `lastHomeTeleport` Map not updated on successful teleport
2. Clock skew between server and client
3. Cooldown constant mismatch

**Fix**:
```typescript
// Ensure lastHomeTeleport is updated on success
this.lastHomeTeleport.set(playerId, Date.now());

// Verify cooldown constant matches client
const COOLDOWN_MS = HOME_TELEPORT_CONSTANTS.COOLDOWN_MS; // 30000
```

## Performance Considerations

### Portal Effect Optimization

**Geometry**:
- Veil: 32 segments (low-poly cylinder)
- Rings: 64 segments each (smooth circles)
- Particles: 50 instances (instanced rendering)

**Materials**:
- TSL node materials (WebGPU-optimized)
- Shared textures across all portals
- No per-frame texture updates

**Cleanup**:
```typescript
// Dispose portal effect on teleport/failure
private clearPortalEffect(): void {
  for (const [playerId, portal] of this.activePortals) {
    portal.mesh.removeFromParent();
    portal.dispose(); // Dispose geometry, materials, textures
  }
  this.activePortals.clear();
}
```

### Cooldown Animation

**RAF-Based** (60 FPS):
```typescript
useEffect(() => {
  if (cooldownProgress >= 1) return;

  let rafId: number;
  const animate = () => {
    const elapsed = Date.now() - cooldownStartTime;
    const progress = elapsed / HOME_TELEPORT_CONSTANTS.COOLDOWN_MS;
    setCooldownProgress(Math.min(1, progress));
    
    if (progress < 1) {
      rafId = requestAnimationFrame(animate);
    }
  };
  
  rafId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(rafId);
}, [cooldownProgress]);
```

**Interval-Based** (alternative):
```typescript
useEffect(() => {
  if (cooldownProgress >= 1) return;

  const interval = setInterval(() => {
    const elapsed = Date.now() - cooldownStartTime;
    const progress = elapsed / HOME_TELEPORT_CONSTANTS.COOLDOWN_MS;
    setCooldownProgress(Math.min(1, progress));
    
    if (progress >= 1) {
      clearInterval(interval);
    }
  }, 100); // 10 FPS (sufficient for cooldown)

  return () => clearInterval(interval);
}, [cooldownProgress]);
```

## Related Documentation

- [HomeTeleportButton.tsx](../packages/client/src/game/hud/HomeTeleportButton.tsx) - Main teleport button
- [MinimapHomeTeleportOrb.tsx](../packages/client/src/game/hud/MinimapHomeTeleportOrb.tsx) - Minimap orb
- [ClientTeleportEffectsSystem.ts](../packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts) - Portal effects
- [home-teleport.ts](../packages/server/src/systems/ServerNetwork/handlers/home-teleport.ts) - Server handler
- [GameConstants.ts](../packages/shared/src/constants/GameConstants.ts) - Timing constants

## Changelog

### March 26, 2026 (PR #1095)
- Polished cast effects with dedicated portal visuals
- Reduced cooldown from 15 minutes to 30 seconds
- Server sends `remainingMs` in cooldown rejection packets
- Added minimap orb integration
- Terrain-aware portal anchoring (lowest bone position)
- Cast progress bar with smooth animation
- Cooldown refill visual with radial progress
- 8 files changed, 649 additions, 53 deletions

### Pre-March 2026
- Basic teleport functionality
- 15-minute cooldown
- No visual effects
- No minimap integration
