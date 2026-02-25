# Duel Trash Talk System

## Overview

The Duel Trash Talk System (commit 8ff3ad3) enables AI agents to generate contextual taunts during combat. Agents respond to health thresholds, combat events, and periodically fire ambient taunts to create engaging spectator experiences.

## Features

- **Health Threshold Detection**: Triggers at 90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 10% for both self and opponent
- **LLM-Generated Taunts**: Uses agent character bio/style via TEXT_SMALL model for personality-driven messages
- **Scripted Fallbacks**: Pre-written taunt pools when no LLM runtime available
- **Ambient Taunts**: Periodic taunts every 15-25 ticks (9-15 seconds) with no specific trigger
- **Opening Taunts**: Special taunt fired at fight start
- **Victory Taunts**: Closing taunt from winner after resolution
- **Cooldown System**: 8-second minimum between messages to prevent spam
- **Fire-and-Forget**: All taunt generation is non-blocking (never delays combat ticks)

## Architecture

### 1. DuelCombatAI

**Location**: `packages/server/src/arena/DuelCombatAI.ts`

**Trash Talk State:**
```typescript
private sendChat: ((text: string) => void) | null = null;
private firedOwnThresholds: Set<number> = new Set();
private firedOpponentThresholds: Set<number> = new Set();
private lastTrashTalkTime = 0;
private _trashTalkInFlight = false;
private nextAmbientTauntTick = 0;
```

**Constants:**
```typescript
const TRASH_TALK_THRESHOLDS = [90, 80, 70, 60, 50, 40, 30, 20, 10];
const TRASH_TALK_COOLDOWN_MS = 4_000;
const AMBIENT_TAUNT_MIN_TICKS = 5;
const AMBIENT_TAUNT_MAX_TICKS = 12;
const LLM_TIMEOUT_MS = 3000;
```

### 2. DuelOrchestrator Integration

**Location**: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`

**Wiring:**
```typescript
async startCombatAIs(): Promise<void> {
  const service1 = manager?.getAgentService(agent1.characterId);
  const runtime1 = getAgentRuntimeByCharacterId(agent1.characterId);
  
  if (service1) {
    const ai1 = new DuelCombatAI(
      service1,
      agent2.characterId,
      { useLlmTactics: llmTacticsEnabled && !!runtime1 },
      runtime1 ?? undefined,
      // Trash talk callback
      (text) => {
        service1.sendChatMessage(text).catch(() => {});
      }
    );
    ai1.setContext(agent1.name, agent2.combatLevel, agent2.name);
    ai1.start();
  }
}
```

### 3. Social System

**Location**: `packages/shared/src/systems/shared/character/social.ts`

**Change**: CHAT_MESSAGE action now allowed during combat

**Before:**
```typescript
// Chat was blocked during combat
if (player.data.inCombat) {
  return { success: false, error: "Cannot chat during combat" };
}
```

**After:**
```typescript
// Chat allowed during combat for trash talk
// No combat check - messages broadcast normally
```

## Taunt Categories

### 1. Opening Taunts

**Trigger**: Fight start (immediately when combat begins)

**LLM Prompt:**
```
The duel has just begun! Taunt your opponent {opponentName} with an opening line.
```

**Fallback Pool:**
```typescript
const FALLBACK_TAUNTS_OPENING = [
  "You're going down",
  "Let's dance",
  "Ready to lose?",
  "This won't take long",
  "Easy fight",
  "Hope you said bye",
  "Prepare yourself",
  "No mercy",
];
```

### 2. Self Health Thresholds

**Trigger**: Own health drops below threshold (90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 10%)

**LLM Prompt:**
```
Your health just dropped to {healthPct}%! You're at {threshold}% threshold.
```

**Fallback Pool:**
```typescript
const FALLBACK_TAUNTS_OWN_LOW = [
  "Not even close!",
  "I've had worse",
  "Is that all?",
  "Still standing",
  "Come on then!",
  "You call that damage?",
  "Barely a scratch",
  "Try harder",
];
```

### 3. Opponent Health Thresholds

**Trigger**: Opponent health drops below threshold (90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 10%)

**LLM Prompt:**
```
Your opponent {opponentName}'s health just dropped to {oppPct}%! They hit the {threshold}% mark.
```

**Fallback Pool:**
```typescript
const FALLBACK_TAUNTS_OPPONENT_LOW = [
  "GG soon",
  "You're done!",
  "Sit down",
  "One more hit...",
  "Almost there!",
  "Easy money",
  "Lights out",
  "Get rekt",
];
```

### 4. Ambient Taunts

**Trigger**: Periodic (every 5-12 ticks, randomized)

**LLM Prompt:**
```
It's an ongoing duel — taunt your opponent!
```

**Fallback Pool:**
```typescript
const FALLBACK_TAUNTS_AMBIENT = [
  "Let's go!",
  "Fight me!",
  "Too slow",
  "Bring it",
  "Nice try lol",
  "*yawns*",
  "Is this PvP?",
  "Warming up",
  "You're trash",
  "Catch these hands",
];
```

### 5. Victory Taunts

**Trigger**: Fight resolution (winner only)

**Fallback Pool:**
```typescript
const VICTORY_TAUNTS = [
  "GG EZ",
  "Too easy",
  "Get good",
  "Was that it?",
  "Next!",
  "Sit down kid",
  "Another one bites the dust",
  "Unmatched",
];
```

## LLM Taunt Generation

### Prompt Construction

**Character Context:**
```typescript
const character = this.runtime.character;
const bioText = character?.bio
  ? Array.isArray(character.bio)
    ? character.bio.slice(0, 3).join(" ")
    : String(character.bio).slice(0, 200)
  : "";
const styleHints = character?.style?.all?.slice(0, 3).join(", ") || "";
```

**Full Prompt:**
```typescript
const prompt = [
  `You are ${this.agentName} in a PvP duel against ${this.opponentName}.`,
  bioText ? `Your personality: ${bioText}` : "",
  styleHints ? `Your communication style: ${styleHints}` : "",
  `Your HP: ${healthPct.toFixed(0)}%. Opponent HP: ${oppPct}.`,
  `Situation: ${situation}`,
  ``,
  `Generate a SHORT trash talk message (under 40 characters) for the overhead chat bubble.`,
  `Stay in character. Be creative, funny, competitive. No quotes. Just the message.`,
].filter(Boolean).join("\n");
```

**Model Parameters:**
```typescript
const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
  prompt,
  maxTokens: 30,
  temperature: 0.9,
});
```

### Timeout Protection

**Problem**: LLM calls can hang indefinitely, blocking combat ticks

**Solution**: Race LLM call against timeout
```typescript
const llmPromise = this.runtime.useModel(ModelType.TEXT_SMALL, {...});
const timeoutPromise = new Promise<never>((_, reject) => {
  timerId = setTimeout(
    () => reject(new Error("Trash talk LLM timeout")),
    LLM_TIMEOUT_MS
  );
});

Promise.race([llmPromise, timeoutPromise])
  .then((response) => {
    clearTimeout(timerId);
    const text = response.trim().replace(/^["']|["']$/g, "");
    if (text && text.length <= 60) {
      sendChat(text);
    }
  })
  .catch(() => {
    clearTimeout(timerId);
    // Use scripted fallback
    const msg = pool[Math.floor(Math.random() * pool.length)];
    sendChat(msg);
  })
  .finally(() => {
    this._trashTalkInFlight = false;
  });
```

### Fire-and-Forget Pattern

**Critical**: Trash talk must NEVER block combat ticks

**Implementation:**
```typescript
private fireTrashTalk(
  kind: "own_low" | "opponent_low" | "ambient" | "opening",
  situation: string,
  healthPct: number,
  opponentData: OpponentData | null
): void {
  if (!this.sendChat) return;
  
  // Mark as in-flight to prevent overlapping calls
  this._trashTalkInFlight = true;
  this.lastTrashTalkTime = Date.now();
  
  // Fire LLM call in background (Promise not awaited)
  Promise.race([llmPromise, timeoutPromise])
    .then(...)
    .catch(...)
    .finally(() => {
      this._trashTalkInFlight = false;
    });
  
  // Tick continues immediately - no await
}
```

## Health Threshold Detection

### Monitoring

**Per-Tick Health Tracking:**
```typescript
private async tick(): Promise<void> {
  const healthPct = (state.health / state.maxHealth) * 100;
  const prevHealthPct = this.lastHealthPct;
  
  const opponentData = this.getOpponentData(state);
  const oppHealthPct = opponentData
    ? (opponentData.health / opponentData.maxHealth) * 100
    : 100;
  const prevOpponentHealthPct = this.opponentLastHealthPct;
  
  // Check thresholds with previous values
  this.checkHealthMilestones(
    healthPct,
    prevHealthPct,
    opponentData,
    prevOpponentHealthPct
  );
  
  // Update for next tick
  this.lastHealthPct = healthPct;
  this.opponentLastHealthPct = oppHealthPct;
}
```

### Threshold Crossing Detection

**Algorithm:**
```typescript
private checkHealthMilestones(
  healthPct: number,
  prevHealthPct: number,
  opponentData: OpponentData | null,
  prevOpponentHealthPct: number
): void {
  // Cooldown check
  const now = Date.now();
  if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;
  if (this._trashTalkInFlight) return;
  
  // Check own health thresholds (descending order)
  for (const threshold of TRASH_TALK_THRESHOLDS) {
    if (healthPct <= threshold && 
        prevHealthPct > threshold &&
        !this.firedOwnThresholds.has(threshold)) {
      this.firedOwnThresholds.add(threshold);
      this.fireTrashTalk("own_low", ...);
      return; // One per tick maximum
    }
  }
  
  // Check opponent health thresholds
  if (opponentData && opponentData.maxHealth > 0) {
    const oppPct = (opponentData.health / opponentData.maxHealth) * 100;
    for (const threshold of TRASH_TALK_THRESHOLDS) {
      if (oppPct <= threshold &&
          prevOpponentHealthPct > threshold &&
          !this.firedOpponentThresholds.has(threshold)) {
        this.firedOpponentThresholds.add(threshold);
        this.fireTrashTalk("opponent_low", ...);
        return;
      }
    }
  }
}
```

**Key Points:**
- Thresholds checked in descending order (90% → 10%)
- Only fires once per threshold (tracked in Set)
- Compares current vs previous health to detect crossing
- Maximum one taunt per tick to prevent spam
- Cooldown enforced between all taunt types

## Ambient Taunt System

### Timing

**Randomized Intervals:**
```typescript
// Initialize next taunt tick
this.nextAmbientTauntTick = 
  AMBIENT_TAUNT_MIN_TICKS + 
  Math.floor(Math.random() * (AMBIENT_TAUNT_MAX_TICKS - AMBIENT_TAUNT_MIN_TICKS));

// Check each tick
private maybeAmbientTrashTalk(...): void {
  if (this.tickCount < this.nextAmbientTauntTick) return;
  if (this._trashTalkInFlight) return;
  
  const now = Date.now();
  if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;
  
  // Schedule next ambient taunt
  this.nextAmbientTauntTick = this.tickCount + 
    AMBIENT_TAUNT_MIN_TICKS + 
    Math.floor(Math.random() * (AMBIENT_TAUNT_MAX_TICKS - AMBIENT_TAUNT_MIN_TICKS));
  
  this.fireTrashTalk("ambient", ...);
}
```

**Timing:**
- Minimum: 5 ticks (3 seconds at 600ms/tick)
- Maximum: 12 ticks (7.2 seconds)
- Average: ~8.5 ticks (5.1 seconds)

### Purpose

Ambient taunts keep the chat active during long fights where health thresholds aren't being crossed. They create a more engaging spectator experience and showcase agent personality.

## Message Delivery

### Chat Service Integration

**Callback Setup:**
```typescript
// DuelOrchestrator.ts
const ai1 = new DuelCombatAI(
  service1,
  agent2.characterId,
  { useLlmTactics: llmTacticsEnabled && !!runtime1 },
  runtime1 ?? undefined,
  // Trash talk callback
  (text) => {
    service1.sendChatMessage(text).catch(() => {});
  }
);
```

**EmbeddedHyperscapeService:**
```typescript
async sendChatMessage(text: string): Promise<void> {
  const state = this.getGameState();
  if (!state) throw new Error("No game state");
  
  // Emit chat event via world
  this.world.emit("chat:message", {
    playerId: this.characterId,
    message: text,
    channel: "local",
  });
}
```

**Social System Broadcast:**
```typescript
// Social system receives chat:message event
// Broadcasts to nearby players and spectators
// Displays as overhead chat bubble in client
```

### Error Handling

**Swallow All Errors:**
```typescript
try {
  sendChat(text);
} catch {
  // Swallow - chat failure must not break combat
}
```

**Rationale**: Chat is cosmetic. Combat tick must continue even if chat fails.

## Cooldown System

### Global Cooldown

**Purpose**: Prevent message spam from multiple trigger sources

**Implementation:**
```typescript
const now = Date.now();
if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;
if (this._trashTalkInFlight) return;

// Mark cooldown start
this.lastTrashTalkTime = Date.now();
this._trashTalkInFlight = true;

// Fire taunt (background)
Promise.race([llmPromise, timeoutPromise])
  .finally(() => {
    this._trashTalkInFlight = false;
  });
```

**Cooldown Duration**: 4 seconds (4000ms)

**In-Flight Guard**: `_trashTalkInFlight` prevents overlapping LLM calls

### Priority Order

When multiple triggers fire simultaneously:
1. Health threshold taunts (self or opponent)
2. Ambient taunts
3. Opening taunts (only at fight start)
4. Victory taunts (only at resolution)

Only one taunt fires per tick due to early returns in `checkHealthMilestones()`.

## LLM vs Scripted Fallback

### Decision Logic

```typescript
private fireTrashTalk(...): void {
  if (!this.sendChat) return;
  
  // Scripted path (no runtime / LLM)
  if (!this.runtime) {
    const pool = this.selectFallbackPool(kind);
    const msg = pool[Math.floor(Math.random() * pool.length)];
    this.lastTrashTalkTime = Date.now();
    try {
      sendChat(msg);
    } catch {
      // Swallow
    }
    return;
  }
  
  // LLM path - fire in background
  this.generateLLMTaunt(...);
}
```

### When to Use Scripted Fallbacks

**Automatic Fallback Scenarios:**
1. No ElizaOS runtime available
2. LLM call times out (>3 seconds)
3. LLM call throws error
4. LLM response is empty or too long (>60 chars)

**Manual Fallback:**
Set `useLlmTactics: false` in DuelCombatAI config to always use scripted taunts.

## Character Personality Integration

### Bio Extraction

**Source**: ElizaOS agent character definition

**Extraction:**
```typescript
const character = this.runtime.character;
const bioText = character?.bio
  ? Array.isArray(character.bio)
    ? character.bio.slice(0, 3).join(" ")
    : String(character.bio).slice(0, 200)
  : "";
```

**Usage**: Included in LLM prompt to maintain character voice

### Style Hints

**Source**: ElizaOS character style.all array

**Extraction:**
```typescript
const styleHints = character?.style?.all?.slice(0, 3).join(", ") || "";
```

**Examples:**
- "aggressive, competitive, trash-talking"
- "calm, analytical, strategic"
- "humorous, sarcastic, playful"

**Usage**: Guides LLM tone and word choice

## Testing

### Test Coverage

**Location**: `packages/server/src/arena/__tests__/DuelCombatAI.test.ts`

**Tests (14/14 passing):**
1. LLM taunt generation with character context
2. Scripted fallback pool selection
3. Cooldown enforcement
4. Health threshold detection
5. Ambient taunt timing
6. Opening taunt at fight start
7. Victory taunt at resolution
8. Fire-and-forget non-blocking behavior
9. Timeout protection
10. Error handling (swallow all errors)
11. In-flight guard (prevent overlapping calls)
12. Threshold tracking (no duplicates)
13. Message length validation
14. Chat service integration

### Example Test

```typescript
it("should fire opening taunt at fight start", async () => {
  const messages: string[] = [];
  const sendChat = (text: string) => messages.push(text);
  
  const ai = new DuelCombatAI(
    service,
    opponentId,
    {},
    runtime,
    sendChat
  );
  
  ai.setContext("TestAgent", 50, "Opponent");
  ai.start();
  
  // Wait for async taunt
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(messages.length).toBeGreaterThan(0);
  expect(messages[0].length).toBeLessThan(60);
});
```

## Configuration

### Environment Variables

**Enable/Disable Trash Talk:**
```bash
# In packages/server/.env
STREAMING_DUEL_COMBAT_AI_ENABLED=true  # Enable combat AI (includes trash talk)
```

**Note**: There is no separate trash talk toggle. Trash talk is part of DuelCombatAI and enabled whenever combat AI is enabled.

### DuelCombatAI Config

```typescript
interface DuelCombatConfig {
  healThresholdPct: number;
  aggressiveThresholdPct: number;
  defensiveThresholdPct: number;
  maxTicksWithoutAttack: number;
  useLlmTactics: boolean;  // Also controls LLM taunts
}

const DEFAULT_CONFIG: DuelCombatConfig = {
  healThresholdPct: 40,
  aggressiveThresholdPct: 70,
  defensiveThresholdPct: 30,
  maxTicksWithoutAttack: 5,
  useLlmTactics: false,  // Scripted by default
};
```

## Troubleshooting

### Taunts Not Appearing

**Check:**
1. Is `STREAMING_DUEL_COMBAT_AI_ENABLED=true`?
2. Is the agent's ElizaOS runtime available?
3. Are chat messages being broadcast by social system?
4. Check console for "Combat AI started for {name}" messages
5. Verify sendChat callback is wired correctly

**Debug Logging:**
```typescript
// Enable debug logging in DuelCombatAI
console.log(`[DuelCombatAI] Firing ${kind} taunt: ${situation}`);
```

### LLM Taunts Timing Out

**Symptoms:**
- Only scripted fallbacks appear
- Console shows "Trash talk LLM timeout" errors

**Causes:**
- LLM provider slow/unavailable
- Network latency
- Model overloaded

**Solutions:**
1. Increase `LLM_TIMEOUT_MS` (default 3000ms)
2. Use faster model (TEXT_SMALL is already the fastest)
3. Switch to scripted fallbacks: `useLlmTactics: false`
4. Check LLM provider status

### Taunts Too Frequent

**Symptoms:**
- Messages spam chat
- Cooldown not working

**Check:**
1. Verify `TRASH_TALK_COOLDOWN_MS = 4000` (4 seconds)
2. Check `lastTrashTalkTime` is being updated
3. Ensure `_trashTalkInFlight` guard is working
4. Look for multiple DuelCombatAI instances (should be one per agent)

### Taunts Not Character-Appropriate

**Symptoms:**
- Generic messages
- Doesn't match agent personality

**Causes:**
- Character bio/style not set in ElizaOS character definition
- LLM not using character context

**Solutions:**
1. Add bio to character.json: `"bio": ["Aggressive warrior", "Loves trash talk"]`
2. Add style hints: `"style": {"all": ["competitive", "aggressive"]}`
3. Verify character is loaded: check `this.runtime.character`

## Performance Considerations

### Non-Blocking Design

**Critical**: Trash talk must never delay combat ticks

**Guarantees:**
1. All LLM calls are fire-and-forget (no await in tick loop)
2. Timeout protection prevents indefinite hangs
3. In-flight guard prevents accumulation
4. Errors are swallowed (never throw)

### Memory Usage

**Per-Agent Overhead:**
- `firedOwnThresholds`: Set<number> (~9 entries max)
- `firedOpponentThresholds`: Set<number> (~9 entries max)
- `lastTrashTalkTime`: number (8 bytes)
- `_trashTalkInFlight`: boolean (1 byte)
- `nextAmbientTauntTick`: number (8 bytes)

**Total**: ~200 bytes per agent (negligible)

### Network Bandwidth

**Message Size:**
- LLM taunts: <60 characters (validated)
- Scripted taunts: 8-30 characters
- Overhead: ~100 bytes per message (JSON + metadata)

**Frequency:**
- Maximum: 1 message per 4 seconds per agent
- Typical: 1 message per 8-10 seconds (ambient + thresholds)

**Bandwidth**: ~25 bytes/second per agent (negligible)

## Future Enhancements

### Planned Features

- **Context-Aware Taunts**: Reference specific combat events (dodges, crits, combos)
- **Opponent Response**: Agents respond to opponent's taunts
- **Emote Integration**: Trigger emotes alongside taunts
- **Spectator Reactions**: Crowd cheers/boos based on taunt quality
- **Taunt History**: Track and avoid repeating recent taunts
- **Multi-Language**: Localized taunt pools

### Optimization Opportunities

- **Taunt Caching**: Cache LLM-generated taunts for reuse
- **Batch Generation**: Pre-generate taunts during idle time
- **Streaming Responses**: Use streaming LLM API for faster first token
- **Local Models**: Use local LLM for zero-latency taunts

## References

- **Commit 8ff3ad3**: Duel trash talk system implementation
- **PR #877**: Particle system refactor (includes trash talk)
- **DuelCombatAI**: `packages/server/src/arena/DuelCombatAI.ts`
- **DuelOrchestrator**: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
- **Social System**: `packages/shared/src/systems/shared/character/social.ts`
- **Tests**: `packages/server/src/arena/__tests__/DuelCombatAI.test.ts`
