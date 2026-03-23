# Streaming & Betting Integration Guide

**Last Updated**: March 23, 2026  
**PR**: #1065 - Internal bet sync feed and renderer health

## Overview

Hyperscape provides an authenticated internal betting feed that makes the streaming duel lifecycle authoritative for betting market synchronization. This guide covers the betting feed API, renderer health monitoring, and integration patterns for betting consumers.

## Architecture

### Source of Truth

Hyperscape is the **authoritative source** for:
- Duel lifecycle events (announcement, countdown, fight start, resolution)
- Agent state (HP, equipment, position)
- Arena state (positions, phase transitions)
- Renderer health (ready vs degraded states)

Betting consumers (e.g., Hyperbet) subscribe to Hyperscape's internal feed rather than polling public spectator endpoints.

### Components

1. **DuelBettingBridge** (`packages/server/src/systems/DuelScheduler/DuelBettingBridge.ts`)
   - Listens to streaming duel events
   - Creates/syncs/resolves markets with Solana operator
   - Publishes sequence-aware SSE feed

2. **Betting Feed Routes** (`packages/server/src/routes/streaming-betting-routes.ts`)
   - Bootstrap endpoint: `GET /api/internal/bet-sync/state`
   - SSE feed: `GET /api/internal/bet-sync/events`
   - Authentication, rate limiting, CORS

3. **Renderer Health** (`packages/server/src/routes/streaming-betting-health.ts`)
   - Derives health from streaming guardrails + external RTMP status
   - Detects degraded states (loading, invalid positions, etc.)

4. **Streaming Guardrails** (`packages/shared/src/utils/rendering/streamingGuardrails.ts`)
   - Shared validation logic (client + server)
   - Agent snapshot validation
   - Arena position sanity checks

## API Reference

### Bootstrap Endpoint

**Endpoint**: `GET /api/internal/bet-sync/state`

**Authentication**: Required
```bash
Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>
```

**Response**:
```typescript
{
  sourceEpoch: number;        // Server start timestamp
  latestSeq: number;          // Most recent sequence number
  latestFrame: BettingFeedPayload;  // Current state
  replayFrames: BettingFeedPayload[];  // Recent history (up to 2048 frames)
}
```

**Example**:
```bash
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state
```

**Rate Limit**: 240 requests/minute per IP

### SSE Events Feed

**Endpoint**: `GET /api/internal/bet-sync/events`

**Authentication**: Required (Bearer header or `?streamToken=` query param)
```bash
# Preferred (Bearer header)
Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>

# Fallback (query param - for EventSource which can't set headers)
?streamToken=<BETTING_FEED_ACCESS_TOKEN>
```

**Query Parameters**:
- `since=<sequence>` - Resume from specific sequence number (optional)
- `limit=<number>` - Max frames in initial replay (default: 100, max: 2048)

**Response**: Server-Sent Events stream
```
event: betting-feed
data: {"seq":1,"sourceEpoch":1234567890,"phaseVersion":1,"cycle":{...},"rendererHealth":{...}}

event: betting-feed
data: {"seq":2,"sourceEpoch":1234567890,"phaseVersion":2,"cycle":{...},"rendererHealth":{...}}

: heartbeat
```

**Replay Delivery Modes**:
- `"bootstrap"` - Full replay buffer (client is behind or first connection)
- `"incremental"` - Frames since `since` sequence (client is caught up)
- `"reset"` - Client sequence is ahead of server (server restarted)

**Example**:
```typescript
const eventSource = new EventSource(
  `http://localhost:5555/api/internal/bet-sync/events?streamToken=${token}&since=0`
);

eventSource.addEventListener("betting-feed", (event) => {
  const payload: BettingFeedPayload = JSON.parse(event.data);
  console.log(`Seq ${payload.seq}: Phase ${payload.cycle.phase}`);
  
  if (!payload.rendererHealth.ready) {
    console.warn(`Renderer degraded: ${payload.rendererHealth.degradedReason}`);
  }
});

eventSource.addEventListener("error", (err) => {
  console.error("SSE connection error:", err);
  // Reconnect with last received sequence
});
```

**Rate Limit**: 60 requests/minute per IP  
**Max Clients**: 32 concurrent connections (configurable)  
**Heartbeat**: Every 15 seconds

### Payload Structure

```typescript
interface BettingFeedPayload {
  seq: number;              // Monotonic sequence number (per sourceEpoch)
  sourceEpoch: number;      // Server start timestamp (for sequence continuity)
  emittedAt: number;        // Emission timestamp (Date.now())
  phaseVersion: number;     // Increments on phase transitions (idempotent dedup)
  
  cycle: {
    cycleId: string;
    phase: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
    cycleStartTime: number;
    phaseStartTime: number;
    phaseEndTime: number;
    timeRemaining: number;
    
    agent1: {
      id: string;
      name: string;
      provider: string;
      model: string;
      hp: number;
      maxHp: number;
      combatLevel: number;
      wins: number;
      losses: number;
      damageDealtThisFight: number;
      equipment: Record<string, unknown>;
      inventory: unknown[];
      rank: number;
      headToHeadWins: number;
      headToHeadLosses: number;
    };
    
    agent2: { /* same structure as agent1 */ };
    
    countdown: number | null;
    fightStartTime: number | null;
    
    arenaPositions: {
      agent1: [number, number, number];
      agent2: [number, number, number];
    } | null;
    
    winnerId: string | null;
    winnerName: string | null;
    winReason: "kill" | "timeout" | null;
  };
  
  rendererHealth: {
    ready: boolean;
    degradedReason: string | null;
    updatedAt: number;
    phase: string | null;
  };
}
```

## Renderer Health

### Health States

**Healthy** (`ready: true`, `degradedReason: null`):
- All agents present with valid HP
- Arena positions are sane (no overlaps)
- Loading overlay dismissed
- Camera locked to target (if required)
- Active phase (ANNOUNCEMENT, COUNTDOWN, FIGHTING)

**Degraded** (`ready: false`, `degradedReason: <string>`):

**Surface-Level Reasons** (client/server not ready):
- `"socket_disconnected"` - WebSocket connection lost
- `"world_not_ready"` - 3D world not initialized
- `"terrain_not_ready"` - Terrain system not loaded
- `"camera_target_unresolved"` - Camera hasn't locked to target
- `"initialization_failed"` - World init error
- `"renderer_unavailable"` - WebGPU not available

**Streaming Guardrail Reasons** (duel state invalid):
- `"agent1_invalid"` - Agent 1 missing or invalid HP
- `"agent2_invalid"` - Agent 2 missing or invalid HP
- `"arena_positions_invalid"` - Positions overlapping or missing

**Loading/Transition Reasons**:
- `"loading_overlay_active"` - Loading screen still visible
- `"initializing"` - Waiting for duel data (IDLE phase)
- `"waiting_for_duel_data"` - No streaming state yet

### Client-Side Health Monitoring

**Window Globals** (exposed for capture pipeline):
```typescript
// Lightweight boot status (no DOM text computation)
window.__HYPERSCAPE_STREAM_BOOT_STATUS__: string | null
// Values: "connecting" | "initializing" | "loading_assets" | "finalizing"
//         "error:webgpu_required" | "error:init_failed" | "error:http"

// Explicit health object (set by StreamingMode component)
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__: {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}

// Legacy ready flag (for backward compatibility)
window.__HYPERSCAPE_STREAM_READY__: boolean
```

**Derivation** (`packages/client/src/screens/StreamingMode.tsx`):
```typescript
import { deriveStreamingRendererHealth } from "./StreamingMode";

const health = deriveStreamingRendererHealth({
  connected: boolean;
  worldReady: boolean;
  terrainReady: boolean;
  hasStreamingState: boolean;
  initError: string | null;
  needsCameraLock: boolean;
  cameraLocked: boolean;
  loadingDismissed: boolean;
  phase: string | null;
  agent1: AgentInfo | null;
  agent2: AgentInfo | null;
  arenaPositions: { agent1: [x,y,z], agent2: [x,y,z] } | null;
});

// Update window globals
window.__HYPERSCAPE_STREAM_READY__ = health.ready;
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__ = health;
```

### Server-Side Health Monitoring

**Derivation** (`packages/server/src/routes/streaming-betting-health.ts`):
```typescript
import { deriveBettingRendererHealth } from "./streaming-betting-health";

const health = deriveBettingRendererHealth(cycle);
// Combines:
// - Streaming guardrails (agent validity, arena positions)
// - External RTMP status (if available)
// - Capture pipeline stats
```

**External RTMP Status** (`packages/server/src/routes/streaming-external-status.ts`):
```typescript
// Read from RTMP_STATUS_FILE (written by capture pipeline)
const externalStatus = parseExternalRtmpStatusSnapshot(filePath);

// Schema validation (allowlist approach)
interface ExternalRtmpStatusSnapshot {
  destinations?: Array<{ name: string; connected: boolean; url?: string }>;
  stats?: {
    recording?: boolean;
    wsConnected?: boolean;
    chunkCount?: number;
    bytesSent?: number;
    uptime?: number;
  };
  captureMode?: string;
  processRssBytes?: number;
  rendererHealth?: {
    ready?: boolean;
    degradedReason?: string | null;
    updatedAt?: number | null;
    phase?: string | null;
  };
  updatedAt?: number;
  source?: string;
}
```

## DuelBettingBridge Lifecycle

### State Machine

```
IDLE
  ↓ (streaming:announcement)
ANNOUNCEMENT → createOrSyncMarket() → initRound()
  ↓ (streaming:fight:start)
FIGHTING → lockMarket() → lockMarket()
  ↓ (streaming:resolution)
RESOLUTION → resolveMarket() → resolveRound()
  ↓ (streaming:end)
IDLE
```

### Event Handlers

**Announcement** (`handleStreamingAnnouncement`):
```typescript
// Create or sync market with Solana operator
const market = await this.createOrSyncMarket(cycle);
// Sets: onChainInitialized, lockedAt (null), resolvedAt (null)
```

**Fight Start** (`handleStreamingFightStart`):
```typescript
// Lock market (no new bets)
await this.lockMarket(market);
// Sets: lockedAt timestamp
// Calls: solanaOperator.lockMarket(roundId)
```

**Resolution** (`handleStreamingResolution`):
```typescript
// Resolve market with outcome
await this.resolveMarket(market, {
  winnerId: data.winnerId,
  loserId: data.loserId,
  winReason: data.winReason,
});
// Sets: resolvedAt timestamp
// Calls: solanaOperator.resolveRound(roundId, winnerId, loserId)
```

**Abort** (`handleStreamingAbort`):
```typescript
// Clean up local state (on-chain cancellation not yet supported)
this.activeMarkets.delete(duelId);
// Note: If onChainInitialized, the Solana market is orphaned
```

### Reconciliation Loop

Runs every 1 second to ensure market state stays aligned with streaming lifecycle:

```typescript
private async reconcileLiveCycle(): Promise<void> {
  if (this.reconcileInFlight) return;  // Prevent overlapping reconciliation
  this.reconcileInFlight = true;
  
  try {
    const scheduler = getStreamingDuelScheduler();
    if (!scheduler) return;
    
    const cycle = scheduler.getCurrentCycle();
    if (!cycle) return;
    
    // Create/sync market if in valid phase
    if (canCreateMarketForStreamingPhase(cycle.phase)) {
      await this.createOrSyncMarket(cycle);
    }
    
    // Resolve if in RESOLUTION phase
    const market = this.getResolvableStreamingMarket(cycle.duelId);
    if (market && cycle.phase === "RESOLUTION" && cycle.winnerId) {
      await this.resolveMarket(market, cycle);
    }
  } finally {
    this.reconcileInFlight = false;
  }
}
```

**Configuration**:
```bash
# Reconciliation interval (default: 1000ms)
DUEL_BETTING_RECONCILE_INTERVAL_MS=1000
```

## Security

### Authentication

**Timing-Safe Token Comparison** (`packages/server/src/routes/streaming-betting-auth.ts`):
```typescript
import { timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";

export function hasValidBettingFeedToken(
  providedToken: string,
  requiredToken: string
): boolean {
  // Length check (required for timingSafeEqual)
  if (providedToken.length !== requiredToken.length) {
    return false;
  }
  
  // Hash both tokens to fixed-length digests
  const providedDigest = createHash("sha256").update(providedToken).digest();
  const requiredDigest = createHash("sha256").update(requiredToken).digest();
  
  // Constant-time comparison (prevents timing attacks)
  return timingSafeEqual(providedDigest, requiredDigest);
}
```

**Token Extraction**:
```typescript
// Prefer Bearer header
const bearerToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");

// Fallback to query param (for EventSource which can't set headers)
const queryToken = request.query.streamToken || request.query.token;

const token = bearerToken || queryToken;
```

**Development Bypass**:
```bash
# Only effective when NODE_ENV=development AND BETTING_FEED_ACCESS_TOKEN is unset
BETTING_FEED_SKIP_AUTH=true
```

### CORS Configuration

```bash
# Restrict to specific betting consumer origin
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com

# Server sets:
Access-Control-Allow-Origin: https://your-betting-frontend.com
Access-Control-Allow-Credentials: true
```

### Token Handling Best Practices

**Server-Side**:
- Store `BETTING_FEED_ACCESS_TOKEN` in environment variables or secret manager
- Use strong random tokens: `openssl rand -base64 32`
- Rotate tokens periodically
- Never log tokens in access logs (use `redactStreamingSecretsFromUrl`)

**Client-Side** (for embedded streaming):
- Pass tokens in URL hash fragments (not query params): `#streamToken=...`
- Scrub tokens immediately via `history.replaceState`
- Use `getStreamingAccessToken()` to retrieve cached token
- Never send tokens in `Referer` headers (use `<meta name="referrer" content="same-origin">`)

## Renderer Health Monitoring

### Health Derivation

**Client** (`packages/client/src/screens/StreamingMode.tsx`):
```typescript
export function deriveStreamingRendererHealth(params: {
  connected: boolean;
  worldReady: boolean;
  terrainReady: boolean;
  hasStreamingState: boolean;
  initError: string | null;
  needsCameraLock: boolean;
  cameraLocked: boolean;
  loadingDismissed: boolean;
  phase: string | null;
  agent1: AgentInfo | null;
  agent2: AgentInfo | null;
  arenaPositions: { agent1: [x,y,z], agent2: [x,y,z] } | null;
}): StreamingRendererHealth {
  // 1. Check surface-level readiness (socket, world, terrain, camera)
  const blockingReason = deriveStreamingSurfaceBlockReason(params);
  
  // 2. Check streaming guardrails (agent validity, arena positions)
  const guardrailReason = deriveStreamingGuardrailReason({
    phase: params.phase,
    agent1: toGuardrailAgent(params.agent1),
    agent2: toGuardrailAgent(params.agent2),
    arenaPositions: params.arenaPositions,
  });
  
  // 3. Check loading overlay state
  let degradedReason = blockingReason ?? guardrailReason;
  if (!degradedReason && !params.loadingDismissed) {
    degradedReason = activePhase ? "loading_overlay_active" : "initializing";
  }
  
  return {
    ready: degradedReason === null,
    degradedReason,
    updatedAt: Date.now(),
    phase: params.phase,
  };
}
```

**Server** (`packages/server/src/routes/streaming-betting-health.ts`):
```typescript
export function deriveBettingRendererHealth(
  cycle: StreamingCycleState | null
): RendererHealth {
  // 1. Check streaming guardrails
  const guardrailReason = deriveStreamingGuardrailReason({
    phase: cycle?.phase ?? null,
    agent1: toGuardrailAgent(cycle?.agent1),
    agent2: toGuardrailAgent(cycle?.agent2),
    arenaPositions: cycle?.arenaPositions,
  });
  
  // 2. Check external RTMP status (if available)
  const externalStatus = readExternalRtmpStatusSnapshot();
  const externalHealth = externalStatus?.rendererHealth;
  
  // 3. Combine (external takes precedence if more specific)
  const degradedReason = externalHealth?.degradedReason ?? guardrailReason;
  
  return {
    ready: degradedReason === null,
    degradedReason,
    updatedAt: Date.now(),
    phase: cycle?.phase ?? null,
  };
}
```

### Capture Pipeline Integration

**Renderer Health Probe** (`packages/server/scripts/stream-to-rtmp.ts`):
```typescript
async function probeRendererHealth(page: Page): Promise<RendererHealthSnapshot> {
  const probe = await page.evaluate(() => {
    const win = window as StreamingWindow;
    
    // Read explicit health object (preferred)
    const explicitHealth = win.__HYPERSCAPE_STREAM_RENDERER_HEALTH__;
    
    // Read boot status (lightweight, no DOM text computation)
    const bootStatus = win.__HYPERSCAPE_STREAM_BOOT_STATUS__;
    
    return {
      explicitHealth,
      hasCanvas: document.querySelector("canvas") !== null,
      readyFlag: win.__HYPERSCAPE_STREAM_READY__ === true,
      hasStreamingBootUi: bootStatus !== null && !bootStatus.startsWith("error:"),
      hasCriticalErrorUi: bootStatus !== null && bootStatus.startsWith("error:"),
    };
  });
  
  // Derive health from probe results
  if (probe.explicitHealth) {
    return {
      ready: probe.explicitHealth.ready,
      degradedReason: probe.explicitHealth.degradedReason,
      updatedAt: probe.explicitHealth.updatedAt,
      phase: probe.explicitHealth.phase,
    };
  }
  
  // Fallback to heuristic detection
  return {
    ready: probe.readyFlag || (probe.hasCanvas && !probe.hasStreamingBootUi),
    degradedReason: /* ... */,
    updatedAt: Date.now(),
    phase: null,
  };
}
```

**Readiness Acceptance** (`packages/server/src/streaming/captureBrowserPolicy.ts`):
```typescript
export function shouldAcceptCaptureReadiness(params: {
  snapshot: CaptureRendererHealthSnapshot;
  startedAt: number;
  nowMs: number;
}): boolean {
  // Accept if explicitly ready
  if (params.snapshot.ready) return true;
  
  // Hard fallback after 3 minutes to avoid deadlock
  if (params.nowMs - params.startedAt >= 180_000) {
    return true;
  }
  
  return false;
}
```

## Configuration

### Environment Variables

**Server** (`packages/server/.env`):
```bash
# Required
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Optional
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
BETTING_SSE_MAX_CLIENTS=32
STREAMING_SSE_REPLAY_BUFFER=2048
STREAMING_SSE_PUSH_INTERVAL_MS=500
STREAMING_SSE_MAX_PENDING_BYTES=1048576
STREAMING_SSE_HEARTBEAT_MS=15000

# Development-only auth bypass (NEVER enable in production)
BETTING_FEED_SKIP_AUTH=false

# Capture browser security
CAPTURE_DISABLE_SANDBOX=false  # Only enable for Docker/CI

# External RTMP status file (written by capture pipeline)
RTMP_STATUS_FILE=/path/to/rtmp-status.json
```

**Client** (`packages/client/.env`):
```bash
# Embed security (comma-separated allowlist)
PUBLIC_EMBED_ALLOWED_ORIGINS=https://embed.example.com,https://partner.example.com
```

### Rate Limits

**Bootstrap Endpoint**:
- 240 requests/minute per IP
- No concurrent connection limit (stateless)

**SSE Events Endpoint**:
- 60 requests/minute per IP
- Max 32 concurrent connections (configurable via `BETTING_SSE_MAX_CLIENTS`)
- Slow clients evicted when `writableLength > STREAMING_SSE_MAX_PENDING_BYTES`

## Integration Patterns

### Betting Consumer (Hyperbet)

**Bootstrap on Startup**:
```typescript
// 1. Fetch current state + replay buffer
const response = await fetch("http://localhost:5555/api/internal/bet-sync/state", {
  headers: { Authorization: `Bearer ${BETTING_FEED_ACCESS_TOKEN}` },
});
const { sourceEpoch, latestSeq, latestFrame, replayFrames } = await response.json();

// 2. Process replay frames to catch up
for (const frame of replayFrames) {
  processFrame(frame);
}

// 3. Connect to SSE feed
const eventSource = new EventSource(
  `http://localhost:5555/api/internal/bet-sync/events?streamToken=${token}&since=${latestSeq}`
);

eventSource.addEventListener("betting-feed", (event) => {
  const frame: BettingFeedPayload = JSON.parse(event.data);
  processFrame(frame);
});
```

**Frame Processing**:
```typescript
function processFrame(frame: BettingFeedPayload) {
  // 1. Check renderer health
  if (!frame.rendererHealth.ready) {
    console.warn(`Skipping frame ${frame.seq}: ${frame.rendererHealth.degradedReason}`);
    return;  // Don't update market state on degraded frames
  }
  
  // 2. Idempotent deduplication via phaseVersion
  if (frame.phaseVersion <= lastProcessedPhaseVersion) {
    return;  // Already processed this phase transition
  }
  
  // 3. Update market state
  switch (frame.cycle.phase) {
    case "ANNOUNCEMENT":
      createMarket(frame.cycle);
      break;
    case "COUNTDOWN":
      updateCountdown(frame.cycle.countdown);
      break;
    case "FIGHTING":
      updateAgentHP(frame.cycle.agent1.hp, frame.cycle.agent2.hp);
      break;
    case "RESOLUTION":
      resolveMarket(frame.cycle.winnerId, frame.cycle.winReason);
      break;
  }
  
  lastProcessedPhaseVersion = frame.phaseVersion;
}
```

**Reconnection Handling**:
```typescript
eventSource.addEventListener("error", async (err) => {
  console.error("SSE connection lost:", err);
  eventSource.close();
  
  // Wait before reconnecting
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Reconnect with last received sequence
  reconnect(lastReceivedSeq);
});

function reconnect(sinceSeq: number) {
  const eventSource = new EventSource(
    `http://localhost:5555/api/internal/bet-sync/events?streamToken=${token}&since=${sinceSeq}`
  );
  // ... re-attach listeners
}
```

## Troubleshooting

### Authentication Failures

**Symptom**: 401 Unauthorized on betting feed endpoints

**Solutions**:
1. Verify `BETTING_FEED_ACCESS_TOKEN` is set in server `.env`
2. Check token is passed correctly (Bearer header or `?streamToken=`)
3. Ensure token matches exactly (no extra whitespace)
4. Check server logs for "Betting feed auth failed" warnings

**Test**:
```bash
# Bootstrap endpoint
curl -v -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state

# SSE endpoint
curl -v -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/events
```

### Renderer Health Always Degraded

**Symptom**: `rendererHealth.ready` is always `false`

**Solutions**:
1. Check `degradedReason` for specific issue
2. Verify streaming state is present (`hasStreamingState: true`)
3. Check agent snapshots have valid HP (`agent.hp <= agent.maxHp`)
4. Verify arena positions are not overlapping
5. Check loading overlay has dismissed (`loadingDismissed: true`)
6. Verify camera has locked to target (if `needsCameraLock: true`)

**Debug**:
```typescript
// Client-side (browser console)
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__
window.__HYPERSCAPE_STREAM_BOOT_STATUS__

// Server-side (check betting feed payload)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq '.latestFrame.rendererHealth'
```

### SSE Connection Drops

**Symptom**: EventSource closes unexpectedly

**Solutions**:
1. Check server logs for "Slow client evicted" warnings
2. Verify client is consuming frames fast enough
3. Increase `STREAMING_SSE_MAX_PENDING_BYTES` if needed
4. Check network stability (SSE requires persistent connection)
5. Implement reconnection logic with `?since=` parameter

**Monitoring**:
```bash
# Check active SSE clients
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq '.activeClients'
```

### Sequence Gaps

**Symptom**: Missing sequence numbers in SSE feed

**Solutions**:
1. Check `sourceEpoch` - if changed, server restarted (sequence reset)
2. Use bootstrap endpoint to get full replay buffer
3. Implement gap detection and re-bootstrap logic
4. Check `mode` field in SSE delivery:
   - `"bootstrap"` - Full buffer (client is behind)
   - `"incremental"` - Frames since `since` (client is caught up)
   - `"reset"` - Client is ahead (server restarted)

**Example**:
```typescript
let lastSeq = 0;
let sourceEpoch = 0;

eventSource.addEventListener("betting-feed", (event) => {
  const frame: BettingFeedPayload = JSON.parse(event.data);
  
  // Detect server restart (sourceEpoch changed)
  if (frame.sourceEpoch !== sourceEpoch) {
    console.warn("Server restarted, re-bootstrapping...");
    sourceEpoch = frame.sourceEpoch;
    lastSeq = 0;
    eventSource.close();
    bootstrap();  // Re-fetch full state
    return;
  }
  
  // Detect sequence gap
  if (frame.seq !== lastSeq + 1 && lastSeq !== 0) {
    console.warn(`Sequence gap: expected ${lastSeq + 1}, got ${frame.seq}`);
    // Re-bootstrap or request missing frames
  }
  
  lastSeq = frame.seq;
  processFrame(frame);
});
```

## Testing

### Unit Tests

**Betting Feed Auth** (`packages/server/src/routes/__tests__/streaming-betting-auth.test.ts`):
- Token extraction from Bearer header and query params
- Timing-safe comparison
- Development bypass logic
- Production fail-closed behavior

**Betting Feed Payload** (`packages/server/src/routes/__tests__/streaming-betting-feed.test.ts`):
- Payload construction
- Replay delivery modes (bootstrap, incremental, reset)
- Frame ordering and deduplication

**DuelBettingBridge** (`packages/server/src/systems/DuelScheduler/__tests__/DuelBettingBridge.test.ts`):
- Lifecycle transitions (announcement → fight → resolution)
- Reconciliation loop
- Abort handling
- Error recovery

**Streaming Guardrails** (`packages/shared/src/utils/rendering/__tests__/streamingGuardrails.test.ts`):
- Agent snapshot validation
- Arena position validation
- Phase-specific requirements

### Integration Tests

**StreamingMode Component** (`packages/client/tests/unit/screens/StreamingMode.component.test.tsx`):
- Loading overlay dismissal
- Renderer health globals
- Token passing to WebSocket
- Init error handling

**Renderer Health Derivation** (`packages/client/tests/unit/screens/StreamingMode.test.ts`):
- Surface-level blocking reasons
- Streaming guardrail reasons
- Loading overlay state
- Arena position validation

## Migration Guide

### From Public Spectator Polling to Internal Feed

**Old Pattern** (polling public endpoint):
```typescript
// ❌ Deprecated: Polling public spectator endpoint
setInterval(async () => {
  const response = await fetch("http://localhost:5555/api/streaming/state");
  const state = await response.json();
  updateMarket(state);
}, 1000);
```

**New Pattern** (SSE feed):
```typescript
// ✅ Recommended: Subscribe to internal betting feed
const eventSource = new EventSource(
  `http://localhost:5555/api/internal/bet-sync/events?streamToken=${token}`
);

eventSource.addEventListener("betting-feed", (event) => {
  const frame: BettingFeedPayload = JSON.parse(event.data);
  
  // Check renderer health before updating market
  if (!frame.rendererHealth.ready) {
    console.warn(`Degraded: ${frame.rendererHealth.degradedReason}`);
    return;
  }
  
  updateMarket(frame.cycle);
});
```

**Benefits**:
- Real-time updates (no polling delay)
- Renderer health signals (prevent betting on degraded frames)
- Sequence-aware (idempotent deduplication via `phaseVersion`)
- Replay buffer (reconnection support)
- Lower server load (push vs pull)

### Breaking Changes

**Authentication Required**:
- All internal betting endpoints now require `BETTING_FEED_ACCESS_TOKEN`
- Public spectator endpoints remain unauthenticated
- Set `BETTING_FEED_ACCESS_TOKEN` in server `.env` before deploying

**CORS Restrictions**:
- Internal endpoints restrict CORS to `INTERNAL_BET_SYNC_ALLOWED_ORIGIN`
- Public endpoints remain open (wildcard CORS)
- Set `INTERNAL_BET_SYNC_ALLOWED_ORIGIN` to your betting frontend domain

**Sequence Continuity**:
- Sequence numbers reset on server restart (new `sourceEpoch`)
- Clients must detect `sourceEpoch` changes and re-bootstrap
- Replay buffer limited to 2048 frames (older frames are trimmed)

## References

- **PR #1065**: Internal bet sync feed and renderer health
- **Hyperbet Consumer PR**: HyperscapeAI/hyperbet#28
- **Streaming Guardrails**: `packages/shared/src/utils/rendering/streamingGuardrails.ts`
- **DuelBettingBridge**: `packages/server/src/systems/DuelScheduler/DuelBettingBridge.ts`
- **Betting Feed Routes**: `packages/server/src/routes/streaming-betting-routes.ts`
