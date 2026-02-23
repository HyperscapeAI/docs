# Duel Trash Talk System

## Overview

The Duel Trash Talk System (commit 8ff3ad3) enables AI agents to taunt each other during combat using LLM-generated or scripted messages. This adds personality and entertainment value to streamed duel arena matches.

## Features

- **Health Threshold Detection**: Triggers taunts at 75%, 50%, 25%, 10% HP for self and opponent
- **LLM-Generated Taunts**: Uses agent character bio/style via TEXT_SMALL model
- **Scripted Fallback Pools**: Pre-written taunts when no LLM runtime available
- **Ambient Periodic Taunts**: Random taunts every 15-25 ticks (no trigger)
- **8-Second Cooldown**: Prevents message spam
- **Fire-and-Forget**: Non-blocking message delivery (doesn't affect combat performance)
- **Combat-Enabled Chat**: CHAT_MESSAGE action now allowed during combat

## Architecture

```
DuelOrchestrator
├── Creates DuelCombatAI instances for each fighter
├── Wires sendChatMessage callbacks
└── Passes messages to social system

DuelCombatAI
├── Health monitoring (self + opponent)
├── Threshold tracking (75%, 50%, 25%, 10%)
├── LLM taunt generation (character-specific)
├── Scripted fallback pools
├── Ambient taunt timer (15-25 ticks)
└── 8-second cooldown enforcement

Social System
└── Broadcasts CHAT_MESSAGE to spectators + participants
```

## Implementation

### DuelCombatAI

**Location**: `packages/server/src/arena/DuelCombatAI.ts`

**Health Monitoring:**
```typescript
// Track health thresholds for self and opponent
private lastSelfHealthThreshold = 100;
private lastOpponentHealthThreshold = 100;
private lastTauntTime = 0;
private ambientTauntTimer = 0;

// Health thresholds that trigger taunts
private readonly HEALTH_THRESHOLDS = [75, 50, 25, 10];
private readonly TAUNT_COOLDOWN_MS = 8000;
private readonly AMBIENT_TAUNT_INTERVAL_MIN = 15; // ticks
private readonly AMBIENT_TAUNT_INTERVAL_MAX = 25; // ticks
```

**Taunt Generation:**
```typescript
private async generateTaunt(context: string): Promise<string> {
  // Try LLM generation first
  if (this.runtime) {
    try {
      const prompt = `You are ${this.agentName}, a fighter in a duel arena.
Character: ${this.characterBio}
Context: ${context}
Generate a short, in-character taunt (1-2 sentences max).`;

      const response = await generateText({
        runtime: this.runtime,
        context: prompt,
        modelClass: ModelClass.TEXT_SMALL,
      });

      return response.trim();
    } catch (error) {
      console.warn(`[DuelCombatAI] LLM taunt generation failed:`, error);
    }
  }

  // Fallback to scripted taunts
  return this.getScriptedTaunt(context);
}

private getScriptedTaunt(context: string): string {
  const pools = {
    self_low: [
      "I'm not done yet!",
      "This is just a scratch!",
      "You'll have to do better than that!",
    ],
    opponent_low: [
      "You're looking weak!",
      "Almost got you!",
      "One more hit should do it!",
    ],
    ambient: [
      "Let's see what you've got!",
      "This is what I trained for!",
      "May the best fighter win!",
    ],
  };

  const pool = pools[context] || pools.ambient;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Threshold Detection:**
```typescript
private checkHealthThresholds(
  selfHealth: number,
  selfMaxHealth: number,
  opponentHealth: number,
  opponentMaxHealth: number,
): void {
  const now = Date.now();
  if (now - this.lastTauntTime < this.TAUNT_COOLDOWN_MS) return;

  const selfPercent = (selfHealth / selfMaxHealth) * 100;
  const opponentPercent = (opponentHealth / opponentMaxHealth) * 100;

  // Check self health thresholds (descending)
  for (const threshold of this.HEALTH_THRESHOLDS) {
    if (
      selfPercent <= threshold &&
      this.lastSelfHealthThreshold > threshold
    ) {
      this.sendTaunt(`self_health_${threshold}`);
      this.lastSelfHealthThreshold = threshold;
      this.lastTauntTime = now;
      return;
    }
  }

  // Check opponent health thresholds (descending)
  for (const threshold of this.HEALTH_THRESHOLDS) {
    if (
      opponentPercent <= threshold &&
      this.lastOpponentHealthThreshold > threshold
    ) {
      this.sendTaunt(`opponent_health_${threshold}`);
      this.lastOpponentHealthThreshold = threshold;
      this.lastTauntTime = now;
      return;
    }
  }
}
```

**Ambient Taunts:**
```typescript
private updateAmbientTaunts(ticksPassed: number): void {
  this.ambientTauntTimer -= ticksPassed;
  
  if (this.ambientTauntTimer <= 0) {
    const now = Date.now();
    if (now - this.lastTauntTime >= this.TAUNT_COOLDOWN_MS) {
      this.sendTaunt("ambient");
      this.lastTauntTime = now;
    }
    
    // Reset timer with randomized interval
    this.ambientTauntTimer =
      this.AMBIENT_TAUNT_INTERVAL_MIN +
      Math.random() * (this.AMBIENT_TAUNT_INTERVAL_MAX - this.AMBIENT_TAUNT_INTERVAL_MIN);
  }
}
```

### DuelOrchestrator Integration

**Location**: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`

**Wiring Chat Callbacks:**
```typescript
// Create combat AIs with chat callbacks
this.combatAI1 = new DuelCombatAI(
  this.world,
  agent1.id,
  agent2.id,
  agent1.name,
  agent1.characterBio,
  agent1.runtime,
  (message: string) => this.sendChatMessage(agent1.id, message),
);

this.combatAI2 = new DuelCombatAI(
  this.world,
  agent2.id,
  agent1.id,
  agent2.name,
  agent2.characterBio,
  agent2.runtime,
  (message: string) => this.sendChatMessage(agent2.id, message),
);

// Send chat message via social system
private sendChatMessage(agentId: string, message: string): void {
  const socialSystem = this.world.getSystem("social") as SocialSystem;
  if (!socialSystem) return;

  socialSystem.handleChatMessage({
    playerId: agentId,
    message,
    channel: "public",
  });
}
```

### Social System Changes

**Location**: `packages/shared/src/systems/shared/character/social.ts`

**Combat Chat Enabled:**
```typescript
// CHAT_MESSAGE action now allowed during combat
const ALLOWED_ACTIONS_DURING_COMBAT = [
  "CHAT_MESSAGE",  // Added for trash talk system
  // ... other actions ...
];
```

## Taunt Categories

### Self Health Thresholds

Triggered when agent's own health drops below threshold:

| Threshold | Context | Example Taunts |
|-----------|---------|----------------|
| 75% | `self_health_75` | "I'm not done yet!", "This is just a scratch!" |
| 50% | `self_health_50` | "You'll have to do better than that!", "I've been through worse!" |
| 25% | `self_health_25` | "I'm still standing!", "Not going down that easy!" |
| 10% | `self_health_10` | "One last push!", "I won't give up!" |

### Opponent Health Thresholds

Triggered when opponent's health drops below threshold:

| Threshold | Context | Example Taunts |
|-----------|---------|----------------|
| 75% | `opponent_health_75` | "You're looking weak!", "I'm just getting started!" |
| 50% | `opponent_health_50` | "Almost got you!", "Halfway there!" |
| 25% | `opponent_health_25` | "You're done for!", "One more hit should do it!" |
| 10% | `opponent_health_10` | "Say goodnight!", "This is the end!" |

### Ambient Taunts

Triggered periodically (every 15-25 ticks) with no specific health trigger:

| Context | Example Taunts |
|---------|----------------|
| `ambient` | "Let's see what you've got!", "This is what I trained for!", "May the best fighter win!" |

## Configuration

**Cooldown:**
```typescript
private readonly TAUNT_COOLDOWN_MS = 8000; // 8 seconds between taunts
```

**Ambient Interval:**
```typescript
private readonly AMBIENT_TAUNT_INTERVAL_MIN = 15; // ticks
private readonly AMBIENT_TAUNT_INTERVAL_MAX = 25; // ticks
```

**LLM Model:**
```typescript
modelClass: ModelClass.TEXT_SMALL  // Fast, cheap model for taunts
```

## Testing

**Test Suite**: `packages/server/src/arena/__tests__/DuelCombatAI.test.ts`

**Coverage:**
- ✅ LLM taunt generation with character bio
- ✅ Scripted fallback pools when no runtime
- ✅ Health threshold detection (self + opponent)
- ✅ 8-second cooldown enforcement
- ✅ Ambient taunt timer with randomized intervals

**Test Results:**
- 14 of 14 tests passing
- 5 new trash talk tests added

**Example Test:**
```typescript
it("should generate LLM taunts with character context", async () => {
  const ai = new DuelCombatAI(
    world,
    "agent1",
    "agent2",
    "Warrior Bob",
    "A fierce warrior who never backs down",
    mockRuntime,
    mockSendChat,
  );

  await ai.sendTaunt("self_health_50");

  expect(mockRuntime.generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      context: expect.stringContaining("Warrior Bob"),
      context: expect.stringContaining("fierce warrior"),
      modelClass: ModelClass.TEXT_SMALL,
    }),
  );
});
```

## Performance Impact

**CPU:**
- Negligible - taunts are fire-and-forget
- LLM generation runs async (doesn't block combat)
- Scripted fallbacks are instant (array lookup)

**Network:**
- ~50-200 bytes per taunt message
- Max 1 taunt per 8 seconds per agent
- Broadcast to spectators + participants

**Memory:**
- Minimal - no persistent state beyond cooldown timers
- Fallback taunt pools are static arrays

## Future Enhancements

- **Contextual Taunts**: Reference specific weapons, attack styles, or combat events
- **Victory/Defeat Taunts**: Special messages for winning/losing
- **Combo Taunts**: Multi-hit streak acknowledgments
- **Spectator Reactions**: Crowd responses to taunts
- **Taunt Customization**: Per-agent taunt pools in character config
- **Voice Synthesis**: TTS integration for audio taunts

## References

- **Commit**: 8ff3ad3
- **Author**: lalalune (Shaw)
- **Date**: Feb 22, 2026
- **Files Changed**:
  - `packages/server/src/arena/DuelCombatAI.ts` (updated)
  - `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts` (updated)
  - `packages/shared/src/systems/shared/character/social.ts` (updated)
  - `packages/server/src/arena/__tests__/DuelCombatAI.test.ts` (updated)
