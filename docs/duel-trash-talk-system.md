# Duel Trash Talk System

## Overview

The duel trash talk system enables AI agents to generate contextual taunts during arena combat. Agents yap at health milestones, respond to opponent damage, and periodically fire ambient taunts to create engaging spectator experiences.

**Implementation**: `packages/server/src/arena/DuelCombatAI.ts`

## Features

- **Health Milestone Taunts**: Triggered when own or opponent HP crosses 75%, 50%, 25%, or 10%
- **Ambient Periodic Taunts**: Random taunts every 15-25 ticks (9-15 seconds)
- **LLM-Generated**: Uses agent character bio/style for personality-driven trash talk
- **Scripted Fallbacks**: Pre-written taunts when no LLM runtime available
- **Fire-and-Forget**: Never blocks combat tick loop (all async, background)
- **Cooldown Protection**: 8-second minimum between messages
- **Combat-Allowed**: `CHAT_MESSAGE` action now permitted during combat (see `packages/shared/src/systems/shared/combat/handlers/social.ts`)

## Architecture

### Trash Talk State

```typescript
class DuelCombatAI {
  private sendChat: ((text: string) => void) | null;
  private firedOwnThresholds: Set<number>;      // Tracks 75/50/25/10% milestones
  private firedOpponentThresholds: Set<number>;
  private lastTrashTalkTime: number;            // Cooldown timestamp
  private _trashTalkInFlight: boolean;          // Prevents overlapping LLM calls
  private nextAmbientTauntTick: number;         // Scheduled ambient taunt
}
```

### Trigger Points

#### 1. Health Milestones

Checked every tick in `checkHealthMilestones()`:

```typescript
const TRASH_TALK_THRESHOLDS = [75, 50, 25, 10] as const;

// Own health drops below threshold
if (healthPct <= threshold && prevHealthPct > threshold && !this.firedOwnThresholds.has(threshold)) {
  this.firedOwnThresholds.add(threshold);
  this.fireTrashTalk("own_low", `Your health just dropped to ${healthPct}%!`, ...);
}

// Opponent health drops below threshold
if (oppPct <= threshold && prevOpponentHealthPct > threshold && !this.firedOpponentThresholds.has(threshold)) {
  this.firedOpponentThresholds.add(threshold);
  this.fireTrashTalk("opponent_low", `Opponent's health dropped to ${oppPct}%!`, ...);
}
```

#### 2. Ambient Taunts

Periodic taunts with randomized timing:

```typescript
const AMBIENT_TAUNT_MIN_TICKS = 15;  // 9 seconds at 600ms/tick
const AMBIENT_TAUNT_MAX_TICKS = 25;  // 15 seconds

// Schedule next ambient taunt
this.nextAmbientTauntTick = this.tickCount + 
  AMBIENT_TAUNT_MIN_TICKS + 
  Math.floor(Math.random() * (AMBIENT_TAUNT_MAX_TICKS - AMBIENT_TAUNT_MIN_TICKS));

// Fire when tick count reaches scheduled time
if (this.tickCount >= this.nextAmbientTauntTick) {
  this.fireTrashTalk("ambient", "It's an ongoing duel — taunt your opponent!", ...);
}
```

### Cooldown System

Prevents message spam:

```typescript
const TRASH_TALK_COOLDOWN_MS = 8_000;  // 8 seconds

// Check cooldown before firing
const now = Date.now();
if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;
if (this._trashTalkInFlight) return;  // Skip if LLM call in progress

// Update timestamp immediately to prevent overlapping calls
this.lastTrashTalkTime = Date.now();
```

## LLM Integration

### Prompt Construction

Trash talk prompts include agent personality and combat context:

```typescript
const character = this.runtime.character;
const bioText = Array.isArray(character.bio) 
  ? character.bio.slice(0, 3).join(" ")
  : String(character.bio).slice(0, 200);
const styleHints = character.style?.all?.slice(0, 3).join(", ") || "";

const prompt = [
  `You are ${this.agentName} in a PvP duel${this.opponentName ? ` against ${this.opponentName}` : ""}.`,
  bioText ? `Your personality: ${bioText}` : "",
  styleHints ? `Your communication style: ${styleHints}` : "",
  `Your HP: ${healthPct.toFixed(0)}%. Opponent HP: ${oppPctStr}.`,
  `Situation: ${situation}`,
  ``,
  `Generate a SHORT trash talk message (under 40 characters) for the overhead chat bubble.`,
  `Stay in character. Be creative, funny, competitive. No quotes. Just the message.`
].filter(Boolean).join("\n");
```

### LLM Call with Timeout

Prevents indefinite blocking:

```typescript
const LLM_TIMEOUT_MS = 3000;

const llmPromise = this.runtime.useModel(ModelType.TEXT_SMALL, {
  prompt,
  maxTokens: 30,
  temperature: 0.9
});

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error("Trash talk LLM timeout")), LLM_TIMEOUT_MS);
});

Promise.race([llmPromise, timeoutPromise])
  .then(response => {
    const text = response.trim().replace(/^["']|["']$/g, "");
    if (text && text.length <= 60) {
      sendChat(text);
    }
  })
  .catch(() => {
    // Fallback to scripted taunt
    const msg = FALLBACK_TAUNTS[Math.floor(Math.random() * FALLBACK_TAUNTS.length)];
    sendChat(msg);
  });
```

## Scripted Fallbacks

When no LLM runtime is available, the system uses pre-written taunt pools:

```typescript
const FALLBACK_TAUNTS_OWN_LOW = [
  "Not even close!",
  "I've had worse",
  "Is that all?",
  "Still standing",
  "Come on then!",
  "You call that damage?"
];

const FALLBACK_TAUNTS_OPPONENT_LOW = [
  "GG soon",
  "You're done!",
  "Sit down",
  "One more hit...",
  "Almost there!",
  "Easy money"
];

const FALLBACK_TAUNTS_AMBIENT = [
  "Let's go!",
  "Fight me!",
  "Too slow",
  "Bring it",
  "Nice try lol",
  "*yawns*",
  "Is this PvP?",
  "Warming up"
];
```

## Integration with DuelOrchestrator

The `StreamingDuelScheduler` wires trash talk into combat AIs:

```typescript
// packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts

const sendChatA = (text: string) => {
  this.world.emit(EventType.CHAT_MESSAGE, {
    playerId: agentA.id,
    message: text,
    channel: "local"
  });
};

const combatAIA = new DuelCombatAI(
  serviceA,
  agentB.id,
  config,
  runtimeA,
  sendChatA  // Pass chat callback
);

combatAIA.setContext(
  agentA.name,
  agentB.combatLevel,
  agentB.name  // Opponent name for personalized taunts
);
```

## Chat System Changes

To allow trash talk during combat, the social action handler was updated:

**File**: `packages/shared/src/systems/shared/combat/handlers/social.ts`

```typescript
// CHAT_MESSAGE now allowed during combat
case "CHAT_MESSAGE":
  // No combat state check — agents can taunt while fighting
  break;
```

Previously, chat was blocked during combat to prevent action queue conflicts. The trash talk system uses fire-and-forget messaging that doesn't interfere with combat actions.

## Performance Considerations

### Non-Blocking Design

All trash talk operations are fire-and-forget:

```typescript
// ❌ WRONG: Blocking tick loop
async tick() {
  const taunt = await generateTrashTalk();  // Blocks for 1-3 seconds!
  sendChat(taunt);
  await this.tryAttack();  // Combat delayed
}

// ✅ CORRECT: Fire-and-forget
tick() {
  this.maybeFireTrashTalk();  // Returns immediately
  await this.tryAttack();     // Combat proceeds
}

maybeFireTrashTalk() {
  if (shouldTaunt) {
    this._trashTalkInFlight = true;
    generateTrashTalk()
      .then(sendChat)
      .finally(() => this._trashTalkInFlight = false);
  }
}
```

### Memory Safety

- LLM calls race against timeout to prevent memory leaks
- In-flight flag prevents overlapping calls
- Cooldown prevents message spam
- Failed LLM calls fall back to scripted taunts (never silent)

## Configuration

Trash talk behavior can be tuned via constants:

```typescript
// Health thresholds that trigger taunts
const TRASH_TALK_THRESHOLDS = [75, 50, 25, 10];

// Minimum milliseconds between trash talk messages
const TRASH_TALK_COOLDOWN_MS = 8_000;

// Ambient taunt frequency (ticks)
const AMBIENT_TAUNT_MIN_TICKS = 15;
const AMBIENT_TAUNT_MAX_TICKS = 25;

// LLM timeout (milliseconds)
const LLM_TIMEOUT_MS = 3000;
```

## Testing

Trash talk system is validated via:

**File**: `packages/server/src/arena/__tests__/DuelCombatAI.test.ts`

```typescript
describe("Trash Talk System", () => {
  it("fires own-health-low taunt at 50% threshold", async () => {
    // ... test implementation
  });

  it("fires opponent-health-low taunt at 25% threshold", async () => {
    // ... test implementation
  });

  it("fires ambient taunts periodically", async () => {
    // ... test implementation
  });

  it("respects 8s cooldown between messages", async () => {
    // ... test implementation
  });

  it("uses scripted fallback when no LLM runtime", async () => {
    // ... test implementation
  });
});
```

All 14 trash talk tests pass (see commit 8ff3ad3).

## Example Output

### LLM-Generated (with character personality)

Agent with bio "A cocky warrior who loves to showboat":
- At 50% HP: "Still got plenty left in the tank 💪"
- Opponent at 25% HP: "Time to finish this, champ"
- Ambient: "Is that your best combo?"

### Scripted Fallback

- At 50% HP: "I've had worse"
- Opponent at 25% HP: "One more hit..."
- Ambient: "Too slow"

## Future Enhancements

Planned improvements:
- **Combo Recognition**: Taunt after landing 3+ hits in a row
- **Comeback Taunts**: Special messages when recovering from low HP
- **Victory Taunts**: Final message when opponent dies
- **Emote Integration**: Trigger emote animations with certain taunts
- **Crowd Reactions**: Spectator chat responds to epic moments

## References

- **Commit 8ff3ad3**: Duel trash talk system implementation
- **PR Context**: Merged from `hackathon` branch (Feb 22, 2026)
- **Test Coverage**: 14/14 trash talk tests passing
