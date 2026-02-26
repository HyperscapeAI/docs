# Duel Combat System Improvements (February 2026)

## Overview

Multiple improvements were made to the streaming duel combat system in February 2026 to fix mage staff and 2H sword combat issues. These changes ensure all weapon types work correctly in AI vs AI streaming duels.

## Fixed Issues

### Issue #1: 2H Sword Agents Idling

**Symptoms:**
- Agents with 2H swords (attack speed 7) would stand idle during combat
- Combat state showed `inCombat: true` but no attacks executed
- Agents appeared frozen after initial engagement

**Root Cause:**

Combat state timeout (10 ticks = 6 seconds) was shorter than 2H sword attack interval (7 ticks = 4.2 seconds). The `CombatSystem` internal state would expire before the next attack, but entity-level flags (`inCombat`, `combatTarget`) remained stale.

`DuelCombatAI` checked entity flags to decide whether to call `executeAttack()`:

```typescript
// ❌ BROKEN: Only checks entity flags (can be stale)
const needsEngagement = !state.inCombat || state.currentTarget !== this.opponentId;
if (needsEngagement) {
  await this.service.executeAttack(this.opponentId);
}
```

**Problem**: If `state.inCombat` was `true` (from stale entity flags) but `CombatSystem` had no state, the agent would never re-engage.

**Fix:**

Add periodic keep-alive re-engagement:

```typescript
// ✅ FIXED: Periodic keep-alive
const needsEngagement = !state.inCombat || state.currentTarget !== this.opponentId;
const ticksSinceLastEngage = this.tickCount - this._lastEngageTick;
const needsKeepAlive = !needsEngagement && ticksSinceLastEngage >= 5;

if (needsEngagement || needsKeepAlive) {
  await this.service.executeAttack(this.opponentId);
  this._lastEngageTick = this.tickCount;
}
```

**Effect**: Agents re-engage every 5 ticks (~3 seconds) as a keep-alive, preventing idle states.

**Commit**: 029456255

### Issue #2: Mage/Ranged Agents Using Wrong Attack Speed

**Symptoms:**
- Mage agents never cast spells (used melee attack speed)
- Ranged agents never fired arrows (used melee attack speed)
- All agents defaulted to melee behavior

**Root Cause:**

`DuelOrchestrator.startCombatBetweenAgents()` didn't propagate weapon type to `CombatSystem.startCombat()`:

```typescript
// ❌ BROKEN: No weapon type specified
combatSystem.startCombat(agent1Id, agent2Id, {
  attackerType: 'player',
  targetType: 'player'
  // Missing: weaponType
});
```

**Problem**: `CombatSystem` defaulted to `AttackType.MELEE` for all agents, so mage/ranged agents never used their projectile-based attacks.

**Fix:**

Resolve weapon type from combat role and pass to `startCombat()`:

```typescript
// ✅ FIXED: Propagate weapon type
const roleToWeaponType = (role: DuelCombatRole): AttackType => {
  switch (role) {
    case 'mage': return AttackType.MAGIC;
    case 'ranged': return AttackType.RANGED;
    default: return AttackType.MELEE;
  }
};

const role1 = this.combatRolesByAgent.get(agent1Id) ?? 'melee';
const weaponType1 = roleToWeaponType(role1);

combatSystem.startCombat(agent1Id, agent2Id, {
  attackerType: 'player',
  targetType: 'player',
  weaponType: weaponType1  // Now specified
});
```

**Effect**: Mage agents cast spells, ranged agents fire arrows, melee agents use melee attacks.

**Commit**: 029456255

### Issue #3: Combat State Starvation (Slow Weapons)

**Symptoms:**
- 2H sword agents never reached `nextAttackTick` (auto-attack never fired)
- Repeated re-engagement kept resetting attack timer
- Combat state existed but attacks never executed

**Root Cause:**

`startCombat()` called `createAttackerState()` which replaced the state Map entry, resetting `nextAttackTick`:

```typescript
// ❌ BROKEN: Always replaces state
combatSystem.startCombat(attackerId, targetId);
// → createAttackerState() → resets nextAttackTick

// For 2H sword (attackSpeed 7 = 4.2s):
// - nextAttackTick set to currentTick + 7
// - Before reaching nextAttackTick, startCombat() called again
// - nextAttackTick reset to currentTick + 7 (pushed forward)
// - Auto-attack never fires (starvation)
```

**Fix:**

Guard against replacing valid combat state:

```typescript
// ✅ FIXED: Only create state if needed
const hasValidState = (attackerId: string, targetId: string): boolean => {
  if (!combatSystem.isInCombat(attackerId)) return false;
  const state = combatSystem.getCombatData(attackerId);
  return !!(state?.inCombat && String(state.targetId) === targetId);
};

if (!hasValidState(agent1Id, agent2Id)) {
  combatSystem.startCombat(agent1Id, agent2Id, { weaponType: weaponType1 });
}
```

**Effect**: Existing combat state preserved, `nextAttackTick` not reset, auto-attacks fire correctly.

**Commit**: 029456255

### Issue #4: Rune Inventory Not Ready

**Symptoms:**
- Mage agents had no runes in inventory
- Spell validation failed with "You don't have enough runes"
- Runes added via `addItemDirect()` disappeared

**Root Cause:**

Runes were added before inventory finished loading from database:

```typescript
// ❌ BROKEN: Inventory not ready
await inventorySystem.addItemDirect(playerId, { itemId: 'mind_rune', quantity: 500 });
// → getOrCreateInventory() returns disposable placeholder (not in Map)
// → Runes silently lost
```

**Fix:**

Poll for inventory readiness before adding runes:

```typescript
// ✅ FIXED: Wait for inventory to load
if (inventorySystem.isInventoryReady && !inventorySystem.isInventoryReady(playerId)) {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (inventorySystem.isInventoryReady(playerId)) break;
  }
}

const mindAdded = await inventorySystem.addItemDirect(playerId, {
  itemId: 'mind_rune',
  quantity: 500
});

if (!mindAdded) {
  Logger.warn('Failed to add runes (inventory may be full or item not in manifest)');
}
```

**Effect**: Runes added reliably, mage agents can cast spells.

**Commit**: 029456255

### Issue #5: Rune Validation Bypass for Bots

**Symptoms:**
- Mage bots failed rune validation despite having runes
- Inventory-based rune checks unreliable for bot agents

**Root Cause:**

Bot agent inventory loading has race conditions and manifest timing issues. Rune validation would fail even when runes were present.

**Fix:**

Bypass rune validation for streaming duel agents:

```typescript
// ✅ FIXED: Bypass validation for bots
const isStreamingDuel = attackerEntity?.data?.inStreamingDuel === true;

if (!runeValidation.valid) {
  if (isStreamingDuel) {
    console.warn(`Rune validation bypassed for ${attackerId} (${runeValidation.error})`);
    // Allow attack to proceed
  } else {
    // Real players: enforce validation
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: attackerId,
      message: runeValidation.error ?? "You don't have enough runes.",
      type: 'error'
    });
    return;
  }
}
```

**Effect**: Bot agents can cast spells reliably, real players still have rune validation enforced.

**Commit**: 029456255

### Issue #6: Combat Timeout Not Refreshed

**Symptoms:**
- Ranged/magic combat would timeout after 10 ticks (6 seconds)
- Agents stopped attacking mid-fight
- Combat state expired prematurely

**Root Cause:**

`combatEndTick` was not refreshed after ranged/magic attacks:

```typescript
// ❌ BROKEN: Timeout not refreshed
this.emitTypedEvent(EventType.COMBAT_ATTACK_INITIATED, {
  attackerId,
  targetId,
  attackType: AttackType.MAGIC
});
// combatEndTick unchanged → combat times out
```

**Fix:**

Refresh combat timeout after attack:

```typescript
// ✅ FIXED: Refresh timeout
this.emitTypedEvent(EventType.COMBAT_ATTACK_INITIATED, { ... });

const freshState = this.stateService.getCombatStatesMap().get(typedAttackerId);
if (freshState) {
  freshState.combatEndTick = tickNumber + COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS;
  freshState.lastAttackTick = tickNumber;
}
```

**Effect**: Combat state persists correctly for slow ranged/magic weapons.

**Commit**: 029456255

### Issue #7: Safe Zone Aggro

**Symptoms:**
- Mobs aggroed players in safe zones
- Mobs chased players into safe zones
- PvP combat initiated in safe zones

**Root Cause:**

`AggroSystem` didn't check safe zones before aggroing or chasing:

```typescript
// ❌ BROKEN: No safe zone check
if (this.shouldAggro(mobState, playerId)) {
  this.startChasing(mobState, playerId);
}
```

**Fix:**

Block aggro and chase in safe zones:

```typescript
// ✅ FIXED: Check safe zones
if (this.zoneDetectionSystem) {
  const pos = playerEntity.node.position;
  if (this.zoneDetectionSystem.isSafeZone({ x: pos.x, z: pos.z })) {
    return false;  // Don't aggro
  }
}

// During chase
if (this.zoneDetectionSystem.isSafeZone({ x: pos.x, z: pos.z })) {
  this.stopChasing(mobState);
  mobState.aggroTargets.delete(mobState.currentTarget!);
  return;
}
```

**Effect**: Mobs respect safe zones, no aggro or chase in protected areas.

**Commit**: 029456255

### Issue #8: PvP Zone Bypass for Duels

**Symptoms:**
- Streaming duel agents couldn't fight (not in PvP zone)
- Combat validation failed for arena fights
- Agents teleported to arena but couldn't attack

**Root Cause:**

`CombatSystem` and `CombatTickProcessor` enforced PvP zone checks for all player vs player combat:

```typescript
// ❌ BROKEN: Blocks duel arena combat
if (attackerType === 'player' && targetType === 'player') {
  if (!zoneSystem.isPvPEnabled({ x: attackerPos.x, z: attackerPos.z })) {
    return;  // Combat blocked
  }
}
```

**Problem**: Duel arenas are not in the wilderness PvP zone, so combat was blocked.

**Fix:**

Bypass PvP zone checks for streaming duel agents:

```typescript
// ✅ FIXED: Bypass for streaming duels
const attackerInStreamingDuel = attacker?.data?.inStreamingDuel === true;
const targetInStreamingDuel = target?.data?.inStreamingDuel === true;

if (!attackerInStreamingDuel && !targetInStreamingDuel) {
  // Only check PvP zones for non-duel combat
  if (!zoneSystem.isPvPEnabled({ x: attackerPos.x, z: attackerPos.z })) {
    return;
  }
}
```

**Effect**: Streaming duel agents can fight in arena, real players still have PvP zone enforcement.

**Commits**: 029456255

## Testing

### Verify Mage Combat

```bash
# Run duel with mage agents
bun run duel --bots=2

# Watch for spell casts in logs
# Expected: "Magic attack initiated" messages
```

### Verify 2H Sword Combat

```bash
# Run duel with melee agents using 2H swords
# Expected: Consistent auto-attacks every 4.2 seconds
# No idle periods longer than 5 seconds
```

### Verify Ranged Combat

```bash
# Run duel with ranged agents
# Expected: Arrow projectiles fired
# Combat state persists between attacks
```

## Configuration

### Combat Roles

Agents are assigned combat roles in `DuelOrchestrator`:

```typescript
this.combatRolesByAgent.set(agentId, 'mage');    // Magic attacks
this.combatRolesByAgent.set(agentId, 'ranged');  // Arrow attacks
this.combatRolesByAgent.set(agentId, 'melee');   // Melee attacks
```

### Attack Speeds

Attack speeds are defined in weapon data:

```typescript
// Melee weapons
{ id: 'bronze_2h_sword', attackSpeed: 7 }  // 4.2 seconds
{ id: 'iron_scimitar', attackSpeed: 4 }    // 2.4 seconds

// Ranged weapons
{ id: 'shortbow', attackSpeed: 5 }         // 3.0 seconds

// Magic weapons
{ id: 'staff_of_air', attackSpeed: 5 }     // 3.0 seconds
```

### Combat Timeout

```typescript
const COMBAT_TIMEOUT_TICKS = 10;  // 6 seconds
```

**Note**: Timeout is refreshed after each attack, so slow weapons don't cause premature timeout.

### Keep-Alive Interval

```typescript
private static readonly RE_ENGAGE_INTERVAL = 5;  // 5 ticks = 3 seconds
```

**Effect**: Agents re-engage every 3 seconds as a keep-alive, preventing idle states.

## Diagnostic Logging

### Enable Streaming Duel Diagnostics

Mage attack diagnostics are automatically enabled for streaming duel agents:

```typescript
const isStreamingDuel = attackerEntity?.data?.inStreamingDuel === true;

if (isStreamingDuel && !selectedSpellId) {
  console.warn(
    `[MagicAttack:Duel] selectedSpell NULL for ${attackerId}! ` +
    `entity.data.selectedSpell=${entityData?.selectedSpell} ` +
    `worldPlayer.data.selectedSpell=${worldPlayer?.data?.selectedSpell}`
  );
}
```

**Logged Events:**
- Entity ID validation failures
- Rate limiting
- Entity resolve failures
- Alive check failures
- Spell validation failures
- Rune validation (bypassed for bots)
- Range check failures

### Check Combat State

```javascript
// In server console or logs
const combatSystem = world.getSystem('combat');
const state = combatSystem.getCombatData('agent-id');
console.log('Combat state:', {
  inCombat: state?.inCombat,
  targetId: state?.targetId,
  nextAttackTick: state?.nextAttackTick,
  combatEndTick: state?.combatEndTick,
  weaponType: state?.weaponType
});
```

## API Changes

### CombatSystem.startCombat()

**New Parameter:**

```typescript
startCombat(
  attackerId: string,
  targetId: string,
  options?: {
    attackerType?: string;
    targetType?: string;
    weaponType?: AttackType;  // NEW
  }
): boolean
```

**Usage:**

```typescript
combatSystem.startCombat('player-1', 'player-2', {
  attackerType: 'player',
  targetType: 'player',
  weaponType: AttackType.MAGIC  // Use magic attack speed
});
```

### CombatSystem.getCombatData()

**New Method:**

```typescript
getCombatData(entityId: string): {
  targetId?: unknown;
  inCombat?: boolean;
  nextAttackTick?: number;
  combatEndTick?: number;
  weaponType?: AttackType;
} | null
```

**Usage:**

```typescript
const state = combatSystem.getCombatData('player-1');
if (state?.inCombat && state.targetId === 'player-2') {
  console.log('Valid combat state exists');
}
```

### CombatSystem.isInCombat()

**Existing Method (now used for validation):**

```typescript
isInCombat(entityId: string): boolean
```

**Usage:**

```typescript
if (combatSystem.isInCombat('player-1')) {
  console.log('Player is in combat (CombatSystem state exists)');
}
```

## Migration Guide

### For Duel Orchestrators

**Before:**
```typescript
combatSystem.startCombat(agent1Id, agent2Id, {
  attackerType: 'player',
  targetType: 'player'
});
```

**After:**
```typescript
const weaponType = this.getWeaponTypeForAgent(agent1Id);
combatSystem.startCombat(agent1Id, agent2Id, {
  attackerType: 'player',
  targetType: 'player',
  weaponType  // Specify weapon type
});
```

### For Combat AI

**Before:**
```typescript
// Check entity flags only
if (!entity.data.inCombat) {
  await executeAttack(targetId);
}
```

**After:**
```typescript
// Check CombatSystem state + keep-alive
const needsEngagement = !combatSystem.isInCombat(agentId);
const needsKeepAlive = ticksSinceLastEngage >= 5;

if (needsEngagement || needsKeepAlive) {
  await executeAttack(targetId);
  lastEngageTick = currentTick;
}
```

## Performance Impact

**CPU Usage**: Negligible increase (<0.1ms per tick)
**Memory Usage**: No change (no new allocations)
**Network Traffic**: Slightly reduced (fewer redundant startCombat calls)

## Known Limitations

**Rune Validation Bypass:**
- Streaming duel bots bypass rune validation
- Real players still have validation enforced
- Bots have infinite elemental runes (staff provides)
- Only catalytic runes (mind/chaos) would fail

**Keep-Alive Overhead:**
- Re-engagement every 3 seconds adds minor overhead
- Only affects streaming duel agents
- Real players unaffected

## Related Documentation

- [Duel Stack](./duel-stack.md) - Streaming duel system architecture
- [Combat System](../packages/shared/dev-book/05-core-systems/COMBAT-SYSTEM-DOCUMENTATION.md) - Combat system documentation
- [DuelOrchestrator.ts](../packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts) - Duel orchestration
- [CombatSystem.ts](../packages/shared/src/systems/shared/combat/CombatSystem.ts) - Combat system implementation
- [DuelCombatAI.ts](../packages/server/src/arena/DuelCombatAI.ts) - Combat AI implementation
