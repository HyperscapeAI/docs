# Internal Betting Feed API Reference

**Version**: 1.0  
**Last Updated**: March 23, 2026  
**PR**: #1065

## Overview

The Internal Betting Feed provides authenticated, sequence-aware access to Hyperscape's duel lifecycle events and renderer health signals. This API is designed for betting market synchronization and should be used by trusted consumers only.

## Base URL

```
Development: http://localhost:5555
Production:  https://hyperscape.gg
```

## Authentication

All endpoints require authentication via Bearer token or query parameter.

### Bearer Header (Recommended)

```http
Authorization: Bearer <BETTING_FEED_ACCESS_TOKEN>
```

### Query Parameter (EventSource Fallback)

```http
?streamToken=<BETTING_FEED_ACCESS_TOKEN>
```

**Note**: Query parameters appear in server logs. Use Bearer header when possible.

### Token Configuration

**Server** (`.env`):
```bash
# Required - generate with: openssl rand -base64 32
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Optional - restrict CORS to specific origin
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
```

**Security**:
- Tokens are compared using timing-safe `timingSafeEqual` on SHA-256 digests
- Development bypass available via `BETTING_FEED_SKIP_AUTH=true` (NEVER in production)
- Production fails closed when `BETTING_FEED_ACCESS_TOKEN` is unset

## Endpoints

### GET /api/internal/bet-sync/state

Bootstrap endpoint providing current state and replay buffer.

**Authentication**: Required (Bearer header only, no query param)

**Response**:
```typescript
{
  sourceEpoch: number;        // Server start timestamp (for sequence continuity)
  latestSeq: number;          // Most recent sequence number
  latestFrame: BettingFeedPayload;  // Current state
  replayFrames: BettingFeedPayload[];  // Recent history (up to 2048 frames)
}
```

**Rate Limit**: 240 requests/minute per IP

**Example**:
```bash
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state
```

**Use Cases**:
- Initial connection (get current state)
- Reconnection after long disconnect (catch up via replay buffer)
- Sequence gap recovery (re-bootstrap when gaps detected)

### GET /api/internal/bet-sync/events

Server-Sent Events (SSE) feed for real-time duel lifecycle updates.

**Authentication**: Required (Bearer header or `?streamToken=` query param)

**Query Parameters**:
- `since=<sequence>` (optional) - Resume from specific sequence number
- `limit=<number>` (optional) - Max frames in initial replay (default: 100, max: 2048)

**Response**: SSE stream
```
event: betting-feed
data: {"seq":1,"sourceEpoch":1234567890,"phaseVersion":1,"cycle":{...},"rendererHealth":{...}}

event: betting-feed
data: {"seq":2,"sourceEpoch":1234567890,"phaseVersion":2,"cycle":{...},"rendererHealth":{...}}

: heartbeat

event: betting-feed
data: {"seq":3,"sourceEpoch":1234567890,"phaseVersion":3,"cycle":{...},"rendererHealth":{...}}
```

**Heartbeat**: Every 15 seconds (configurable via `STREAMING_SSE_HEARTBEAT_MS`)

**Rate Limit**: 60 requests/minute per IP  
**Max Clients**: 32 concurrent connections (configurable via `BETTING_SSE_MAX_CLIENTS`)

**Example**:
```typescript
const eventSource = new EventSource(
  `http://localhost:5555/api/internal/bet-sync/events?streamToken=${token}&since=0`
);

eventSource.addEventListener("betting-feed", (event) => {
  const payload: BettingFeedPayload = JSON.parse(event.data);
  console.log(`Seq ${payload.seq}: Phase ${payload.cycle.phase}`);
});

eventSource.addEventListener("error", (err) => {
  console.error("SSE error:", err);
  // Implement reconnection logic
});
```

**Replay Delivery Modes**:
- `"bootstrap"` - Client is behind or first connection (full buffer)
- `"incremental"` - Client is caught up (frames since `since`)
- `"reset"` - Client is ahead of server (server restarted, re-bootstrap needed)

**Slow Client Eviction**:
- Clients with `writableLength > STREAMING_SSE_MAX_PENDING_BYTES` are disconnected
- Default threshold: 1MB (configurable)
- Prevents slow clients from blocking the feed

## Data Types

### BettingFeedPayload

```typescript
interface BettingFeedPayload {
  seq: number;              // Monotonic sequence number (per sourceEpoch)
  sourceEpoch: number;      // Server start timestamp (for sequence continuity)
  emittedAt: number;        // Emission timestamp (Date.now())
  phaseVersion: number;     // Increments on phase transitions (idempotent dedup)
  
  cycle: StreamingCycleState;
  rendererHealth: RendererHealth;
}
```

### StreamingCycleState

```typescript
interface StreamingCycleState {
  cycleId: string;
  phase: "IDLE" | "ANNOUNCEMENT" | "COUNTDOWN" | "FIGHTING" | "RESOLUTION";
  cycleStartTime: number;
  phaseStartTime: number;
  phaseEndTime: number;
  timeRemaining: number;
  
  agent1: AgentSnapshot;
  agent2: AgentSnapshot;
  
  countdown: number | null;
  fightStartTime: number | null;
  
  arenaPositions: {
    agent1: [number, number, number];
    agent2: [number, number, number];
  } | null;
  
  winnerId: string | null;
  winnerName: string | null;
  winReason: "kill" | "timeout" | null;
}
```

### AgentSnapshot

```typescript
interface AgentSnapshot {
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
}
```

### RendererHealth

```typescript
interface RendererHealth {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}
```

**Degraded Reasons**:

**Surface-Level** (client/server not ready):
- `"socket_disconnected"` - WebSocket connection lost
- `"world_not_ready"` - 3D world not initialized
- `"terrain_not_ready"` - Terrain system not loaded
- `"camera_target_unresolved"` - Camera hasn't locked to target
- `"initialization_failed"` - World init error
- `"renderer_unavailable"` - WebGPU not available

**Streaming Guardrails** (duel state invalid):
- `"agent1_invalid"` - Agent 1 missing or invalid HP
- `"agent2_invalid"` - Agent 2 missing or invalid HP
- `"arena_positions_invalid"` - Positions overlapping or missing

**Loading/Transition**:
- `"loading_overlay_active"` - Loading screen still visible
- `"initializing"` - Waiting for duel data (IDLE phase)
- `"waiting_for_duel_data"` - No streaming state yet

## Configuration

### Server Environment Variables

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
```

### Rate Limits

**Bootstrap Endpoint** (`/api/internal/bet-sync/state`):
- 240 requests/minute per IP
- No concurrent connection limit (stateless)

**SSE Events Endpoint** (`/api/internal/bet-sync/events`):
- 60 requests/minute per IP
- Max 32 concurrent connections
- Slow clients evicted at 1MB pending bytes

## Integration Examples

### TypeScript Client

```typescript
import { EventSource } from "eventsource";  // For Node.js

class BettingFeedClient {
  private eventSource: EventSource | null = null;
  private lastSeq = 0;
  private sourceEpoch = 0;
  
  constructor(
    private baseUrl: string,
    private token: string,
    private onFrame: (frame: BettingFeedPayload) => void
  ) {}
  
  async connect(): Promise<void> {
    // 1. Bootstrap - get current state
    const response = await fetch(`${this.baseUrl}/api/internal/bet-sync/state`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    
    if (!response.ok) {
      throw new Error(`Bootstrap failed: ${response.status}`);
    }
    
    const { sourceEpoch, latestSeq, replayFrames } = await response.json();
    this.sourceEpoch = sourceEpoch;
    this.lastSeq = latestSeq;
    
    // 2. Process replay buffer
    for (const frame of replayFrames) {
      this.onFrame(frame);
    }
    
    // 3. Connect to SSE feed
    this.connectSSE(latestSeq);
  }
  
  private connectSSE(sinceSeq: number): void {
    this.eventSource = new EventSource(
      `${this.baseUrl}/api/internal/bet-sync/events?streamToken=${this.token}&since=${sinceSeq}`
    );
    
    this.eventSource.addEventListener("betting-feed", (event) => {
      const frame: BettingFeedPayload = JSON.parse(event.data);
      
      // Detect server restart
      if (frame.sourceEpoch !== this.sourceEpoch) {
        console.warn("Server restarted, re-bootstrapping...");
        this.disconnect();
        this.connect();
        return;
      }
      
      // Detect sequence gap
      if (frame.seq !== this.lastSeq + 1 && this.lastSeq !== 0) {
        console.warn(`Sequence gap: expected ${this.lastSeq + 1}, got ${frame.seq}`);
        // Could re-bootstrap here
      }
      
      this.lastSeq = frame.seq;
      this.onFrame(frame);
    });
    
    this.eventSource.addEventListener("error", (err) => {
      console.error("SSE error:", err);
      this.disconnect();
      
      // Reconnect after delay
      setTimeout(() => this.connectSSE(this.lastSeq), 1000);
    });
  }
  
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const client = new BettingFeedClient(
  "http://localhost:5555",
  process.env.BETTING_FEED_ACCESS_TOKEN!,
  (frame) => {
    // Check renderer health
    if (!frame.rendererHealth.ready) {
      console.warn(`Degraded: ${frame.rendererHealth.degradedReason}`);
      return;
    }
    
    // Update market state
    switch (frame.cycle.phase) {
      case "ANNOUNCEMENT":
        createMarket(frame.cycle);
        break;
      case "FIGHTING":
        updateAgentHP(frame.cycle.agent1.hp, frame.cycle.agent2.hp);
        break;
      case "RESOLUTION":
        resolveMarket(frame.cycle.winnerId, frame.cycle.winReason);
        break;
    }
  }
);

await client.connect();
```

### Browser Client

```typescript
class BrowserBettingFeedClient {
  private eventSource: EventSource | null = null;
  
  async connect(token: string): Promise<void> {
    // 1. Bootstrap
    const response = await fetch("/api/internal/bet-sync/state", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { latestSeq, replayFrames } = await response.json();
    
    // 2. Process replay
    for (const frame of replayFrames) {
      this.processFrame(frame);
    }
    
    // 3. Connect SSE (EventSource can't set headers, use query param)
    this.eventSource = new EventSource(
      `/api/internal/bet-sync/events?streamToken=${token}&since=${latestSeq}`
    );
    
    this.eventSource.addEventListener("betting-feed", (event) => {
      const frame = JSON.parse(event.data);
      this.processFrame(frame);
    });
  }
  
  private processFrame(frame: BettingFeedPayload): void {
    // Your market update logic
  }
}
```

## Error Handling

### HTTP Errors

**401 Unauthorized**:
- Missing or invalid `BETTING_FEED_ACCESS_TOKEN`
- Check token is set in server `.env`
- Verify token matches exactly (no whitespace)

**403 Forbidden**:
- CORS origin not allowed
- Set `INTERNAL_BET_SYNC_ALLOWED_ORIGIN` to your domain

**429 Too Many Requests**:
- Rate limit exceeded
- Bootstrap: 240 req/min per IP
- SSE: 60 req/min per IP

**503 Service Unavailable**:
- Max concurrent SSE clients reached (32 default)
- Wait for slot to open or increase `BETTING_SSE_MAX_CLIENTS`

### SSE Errors

**Connection Closed**:
- Slow client evicted (pending bytes > 1MB)
- Network interruption
- Server restart

**Reconnection Strategy**:
```typescript
let reconnectAttempts = 0;
const maxReconnectDelay = 30000;  // 30 seconds

function reconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
  reconnectAttempts++;
  
  setTimeout(() => {
    try {
      connectSSE(lastReceivedSeq);
      reconnectAttempts = 0;  // Reset on successful connection
    } catch (err) {
      console.error("Reconnection failed:", err);
      reconnect();  // Try again
    }
  }, delay);
}
```

## Best Practices

### Idempotent Processing

Use `phaseVersion` for idempotent deduplication:

```typescript
let lastProcessedPhaseVersion = 0;

function processFrame(frame: BettingFeedPayload) {
  // Skip if already processed this phase transition
  if (frame.phaseVersion <= lastProcessedPhaseVersion) {
    return;
  }
  
  // Process frame
  updateMarket(frame.cycle);
  
  lastProcessedPhaseVersion = frame.phaseVersion;
}
```

### Renderer Health Checks

Always check renderer health before updating market state:

```typescript
function processFrame(frame: BettingFeedPayload) {
  // Skip degraded frames
  if (!frame.rendererHealth.ready) {
    console.warn(`Skipping frame ${frame.seq}: ${frame.rendererHealth.degradedReason}`);
    return;
  }
  
  // Safe to update market
  updateMarket(frame.cycle);
}
```

### Sequence Continuity

Detect server restarts via `sourceEpoch` changes:

```typescript
let currentSourceEpoch = 0;

function processFrame(frame: BettingFeedPayload) {
  // Detect server restart
  if (frame.sourceEpoch !== currentSourceEpoch) {
    if (currentSourceEpoch !== 0) {
      console.warn("Server restarted, re-bootstrapping...");
      eventSource.close();
      bootstrap();  // Re-fetch full state
      return;
    }
    currentSourceEpoch = frame.sourceEpoch;
  }
  
  // Process frame
  updateMarket(frame.cycle);
}
```

### Gap Detection

Monitor for missing sequence numbers:

```typescript
let lastSeq = 0;

function processFrame(frame: BettingFeedPayload) {
  // Detect gap
  if (frame.seq !== lastSeq + 1 && lastSeq !== 0) {
    const gap = frame.seq - lastSeq - 1;
    console.warn(`Sequence gap detected: ${gap} frames missing`);
    
    // Re-bootstrap if gap is large
    if (gap > 10) {
      eventSource.close();
      bootstrap();
      return;
    }
  }
  
  lastSeq = frame.seq;
  updateMarket(frame.cycle);
}
```

## Monitoring

### Health Checks

**Server Health**:
```bash
# Check server is running
curl http://localhost:5555/health

# Check betting feed is accessible
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state
```

**Renderer Health**:
```bash
# Check current renderer health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq '.latestFrame.rendererHealth'
```

### Metrics

**SSE Client Count**:
```typescript
// Server-side (internal)
const clientCount = bettingClients.size;
```

**Replay Buffer Size**:
```bash
# Check replay buffer depth
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq '.replayFrames | length'
```

**Sequence Numbers**:
```bash
# Check latest sequence
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq '.latestSeq'
```

## Troubleshooting

### Authentication Failures

**Symptom**: 401 Unauthorized

**Solutions**:
1. Verify `BETTING_FEED_ACCESS_TOKEN` is set in server `.env`
2. Check token is passed correctly (Bearer header or `?streamToken=`)
3. Ensure token matches exactly (no extra whitespace)
4. Check server logs for "Betting feed auth failed" warnings

### Renderer Always Degraded

**Symptom**: `rendererHealth.ready` is always `false`

**Solutions**:
1. Check `degradedReason` for specific issue
2. Verify streaming state is present
3. Check agent snapshots have valid HP
4. Verify arena positions are not overlapping
5. Check loading overlay has dismissed

**Debug**:
```bash
# Check renderer health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | \
  jq '.latestFrame.rendererHealth'
```

### SSE Connection Drops

**Symptom**: EventSource closes unexpectedly

**Solutions**:
1. Check server logs for "Slow client evicted" warnings
2. Verify client is consuming frames fast enough
3. Increase `STREAMING_SSE_MAX_PENDING_BYTES` if needed
4. Implement reconnection logic with exponential backoff

### Sequence Gaps

**Symptom**: Missing sequence numbers

**Solutions**:
1. Check `sourceEpoch` - if changed, server restarted
2. Use bootstrap endpoint to get full replay buffer
3. Implement gap detection and re-bootstrap logic
4. Check network stability (SSE requires persistent connection)

## Migration from Public Polling

### Old Pattern (Deprecated)

```typescript
// ❌ Polling public spectator endpoint
setInterval(async () => {
  const response = await fetch("http://localhost:5555/api/streaming/state");
  const state = await response.json();
  updateMarket(state);
}, 1000);
```

**Problems**:
- Polling delay (1 second minimum)
- No renderer health signals
- No sequence continuity
- Higher server load
- No replay buffer for reconnection

### New Pattern (Recommended)

```typescript
// ✅ Subscribe to internal betting feed
const client = new BettingFeedClient(
  "http://localhost:5555",
  process.env.BETTING_FEED_ACCESS_TOKEN!,
  (frame) => {
    // Check renderer health
    if (!frame.rendererHealth.ready) {
      return;  // Skip degraded frames
    }
    
    // Idempotent deduplication
    if (frame.phaseVersion <= lastProcessedPhaseVersion) {
      return;
    }
    
    updateMarket(frame.cycle);
    lastProcessedPhaseVersion = frame.phaseVersion;
  }
);

await client.connect();
```

**Benefits**:
- Real-time updates (no polling delay)
- Renderer health signals
- Sequence-aware (idempotent deduplication)
- Replay buffer (reconnection support)
- Lower server load

## Security Considerations

### Token Storage

**Server**:
- Store in environment variables or secret manager
- Never commit to git
- Rotate periodically
- Use strong random tokens: `openssl rand -base64 32`

**Client**:
- Store in secure backend (never in browser localStorage)
- Pass to frontend via secure session
- Never expose in client-side JavaScript

### Logging

**Server**:
- Use `redactStreamingSecretsFromUrl` for all log output
- Never log `BETTING_FEED_ACCESS_TOKEN` in access logs
- Redact `streamToken` query params from logs

**Example**:
```typescript
import { redactStreamingSecretsFromUrl } from "./redactStreamingUrl";

console.log(`Request: ${redactStreamingSecretsFromUrl(req.url)}`);
// Output: Request: /api/internal/bet-sync/events?streamToken=***REDACTED***&since=0
```

### CORS

**Restrict to Specific Origin**:
```bash
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
```

**Server Response**:
```http
Access-Control-Allow-Origin: https://your-betting-frontend.com
Access-Control-Allow-Credentials: true
```

**Never Use Wildcard** (`*`) for authenticated endpoints.

## References

- **PR #1065**: Internal bet sync feed and renderer health
- **Hyperbet Consumer PR**: HyperscapeAI/hyperbet#28
- **Streaming Guardrails**: `packages/shared/src/utils/rendering/streamingGuardrails.ts`
- **DuelBettingBridge**: `packages/server/src/systems/DuelScheduler/DuelBettingBridge.ts`
- **Betting Feed Routes**: `packages/server/src/routes/streaming-betting-routes.ts`
- **Integration Guide**: `docs/streaming-betting-integration.md`
