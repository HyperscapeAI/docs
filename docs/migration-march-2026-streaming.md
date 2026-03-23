# Migration Guide: Streaming & Betting Integration (March 2026)

**Last Updated**: March 23, 2026  
**PRs**: #1064 (Performance), #1065 (Betting Feed)

## Overview

This guide covers breaking changes and migration steps for the March 2026 streaming and betting integration updates.

## Breaking Changes

### 1. Betting Feed Authentication Required

**Change**: All internal betting endpoints now require authentication.

**Impact**: Unauthenticated requests to `/api/internal/bet-sync/*` will receive 401 Unauthorized.

**Migration**:
```bash
# Server .env - add betting feed token
BETTING_FEED_ACCESS_TOKEN=your-random-secret-token

# Generate token
openssl rand -base64 32
```

**Client Code**:
```typescript
// Old (no auth)
const response = await fetch("/api/internal/bet-sync/state");

// New (Bearer header)
const response = await fetch("/api/internal/bet-sync/state", {
  headers: { Authorization: `Bearer ${BETTING_FEED_ACCESS_TOKEN}` },
});

// New (query param for EventSource)
const eventSource = new EventSource(
  `/api/internal/bet-sync/events?streamToken=${BETTING_FEED_ACCESS_TOKEN}`
);
```

### 2. CORS Restrictions on Internal Endpoints

**Change**: Internal betting endpoints restrict CORS to specific origin.

**Impact**: Cross-origin requests from non-allowed origins will receive CORS errors.

**Migration**:
```bash
# Server .env - set allowed origin
INTERNAL_BET_SYNC_ALLOWED_ORIGIN=https://your-betting-frontend.com
```

**Server Response**:
```http
Access-Control-Allow-Origin: https://your-betting-frontend.com
Access-Control-Allow-Credentials: true
```

### 3. Embedded Client Origin Validation

**Change**: Embedded clients now validate `postMessage` origins against explicit allowlist.

**Impact**: `HYPERSCAPE_AUTH` messages from untrusted origins are rejected.

**Migration**:
```bash
# Client .env - set trusted embed origins
PUBLIC_EMBED_ALLOWED_ORIGINS=https://embed.example.com,https://partner.example.com
```

**Client Code**:
```typescript
// Old (accepts from any origin)
window.addEventListener("message", (event) => {
  if (event.data?.type === "HYPERSCAPE_AUTH") {
    config.authToken = event.data.authToken;
  }
});

// New (validates origin)
import { isTrustedEmbedOrigin, parseHyperscapeAuthMessage } from "@/lib/embeddedAuth";

const trustedOrigins = resolveTrustedEmbedOrigins({
  currentOrigin: window.location.origin,
  publicAppUrl: import.meta.env.PUBLIC_APP_URL,
  embedAllowedOrigins: import.meta.env.PUBLIC_EMBED_ALLOWED_ORIGINS,
});

window.addEventListener("message", (event) => {
  if (!isTrustedEmbedOrigin(event.origin, trustedOrigins)) {
    console.warn("Ignoring message from untrusted origin:", event.origin);
    return;
  }
  
  const message = parseHyperscapeAuthMessage(event.data);
  if (message) {
    applyHyperscapeAuthMessage(config, message);
  }
});
```

### 4. Streaming Token in URL Hash (Not Query)

**Change**: Streaming tokens moved from query params to URL hash fragments.

**Impact**: Tokens in query params are deprecated and will be removed in future versions.

**Migration**:
```typescript
// Old (query param - appears in server logs)
const url = `http://localhost:3333/stream?streamToken=${token}`;

// New (hash fragment - not sent to server)
const url = `http://localhost:3333/stream#streamToken=${token}`;
```

**Client Code**:
```typescript
import { getStreamingAccessToken, primeStreamingAccessTokenFromWindow } from "@/lib/streamingAccessToken";

// Scrub token from URL before React mounts
primeStreamingAccessTokenFromWindow(window);

// Get cached token
const token = getStreamingAccessToken();
```

### 5. Vite 8 Polyfill Changes

**Change**: Removed `vite-plugin-node-polyfills`, manual Buffer injection required.

**Impact**: Solana and crypto libraries need manual Buffer global.

**Migration**:
```typescript
// packages/client/src/polyfills/buffer-shim.ts
import { Buffer } from "buffer";

// Inject Buffer global for libraries that expect it
(globalThis as Record<string, unknown>).Buffer = Buffer;

export default Buffer;
```

**Vite Config**:
```typescript
// vite.config.ts

// REMOVED
import { nodePolyfills } from "vite-plugin-node-polyfills";
plugins: [
  nodePolyfills({ include: ["buffer"], globals: { Buffer: true } }),
]

// ADDED
// Import buffer-shim.ts in your entry point
import "./polyfills/buffer-shim";
```

### 6. Manual Chunk Splitting Function

**Change**: Vite 8 (Rolldown) requires `manualChunks` as function, not object.

**Impact**: Build errors if using object-style `manualChunks`.

**Migration**:
```typescript
// vite.config.ts

// Old (object - no longer works)
manualChunks: {
  "vendor-react": ["react", "react-dom"],
  "vendor-three": ["three"],
}

// New (function - required for Rolldown)
manualChunks(id: string) {
  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
    return "vendor-react";
  }
  if (id.includes("node_modules/three/")) {
    return "vendor-three";
  }
}
```

## New Features

### Renderer Health Monitoring

**Client-Side Globals**:
```typescript
// Exposed for capture pipeline health probes
window.__HYPERSCAPE_STREAM_READY__: boolean
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__: {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
}
window.__HYPERSCAPE_STREAM_BOOT_STATUS__: string | null
```

**Usage**:
```typescript
// Check if stream is ready for capture
if (window.__HYPERSCAPE_STREAM_READY__) {
  startCapture();
}

// Check detailed health
const health = window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__;
if (!health.ready) {
  console.warn(`Renderer degraded: ${health.degradedReason}`);
}
```

### Streaming Guardrails

**Shared Validation** (`packages/shared/src/utils/rendering/streamingGuardrails.ts`):
```typescript
import { deriveStreamingGuardrailReason } from "@hyperscape/shared";

const degradedReason = deriveStreamingGuardrailReason({
  phase: cycle.phase,
  agent1: { id: "a", name: "Agent A", hp: 10, maxHp: 10 },
  agent2: { id: "b", name: "Agent B", hp: 8, maxHp: 10 },
  arenaPositions: { agent1: [1, 0, 1], agent2: [4, 0, 4] },
});

if (degradedReason) {
  console.warn(`Streaming guardrail failed: ${degradedReason}`);
}
```

**Validation Rules**:
- Agents must have valid `id`, `name`, `hp`, `maxHp`
- `hp` must be in range `[0, maxHp]`
- Arena positions required for COUNTDOWN and FIGHTING phases
- Positions must not overlap (different tiles)

### DuelBettingBridge

**Lifecycle Management**:
```typescript
import { DuelBettingBridge } from "./DuelBettingBridge";

const bridge = new DuelBettingBridge(world, solanaOperator, config);

// Bridge listens to streaming events automatically
world.on("streaming:announcement", handleStreamingAnnouncement);
world.on("streaming:fight:start", handleStreamingFightStart);
world.on("streaming:resolution", handleStreamingResolution);
world.on("streaming:abort", handleStreamingAbort);

// Reconciliation loop runs every 1s
// Ensures market state stays aligned with streaming lifecycle
```

**Configuration**:
```bash
# Reconciliation interval (default: 1000ms)
DUEL_BETTING_RECONCILE_INTERVAL_MS=1000

# Market history size (default: 100)
DUEL_BETTING_MARKET_HISTORY_SIZE=100
```

## Testing

### Unit Tests

**Betting Feed Auth**:
```bash
npm test packages/server/src/routes/__tests__/streaming-betting-auth.test.ts
```

**Betting Feed Payload**:
```bash
npm test packages/server/src/routes/__tests__/streaming-betting-feed.test.ts
```

**DuelBettingBridge**:
```bash
npm test packages/server/src/systems/DuelScheduler/__tests__/DuelBettingBridge.test.ts
```

**Streaming Guardrails**:
```bash
npm test packages/shared/src/utils/rendering/__tests__/streamingGuardrails.test.ts
```

### Integration Tests

**StreamingMode Component**:
```bash
npm test packages/client/tests/unit/screens/StreamingMode.component.test.tsx
```

**Renderer Health Derivation**:
```bash
npm test packages/client/tests/unit/screens/StreamingMode.test.ts
```

### Manual Testing

**1. Start Server**:
```bash
bun run dev
```

**2. Test Bootstrap Endpoint**:
```bash
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/state | jq
```

**3. Test SSE Feed**:
```bash
curl -H "Authorization: Bearer $BETTING_FEED_ACCESS_TOKEN" \
  http://localhost:5555/api/internal/bet-sync/events
```

**4. Check Renderer Health**:
```bash
# Open stream in browser
open http://localhost:3333/stream.html

# Check console
window.__HYPERSCAPE_STREAM_RENDERER_HEALTH__
```

## Rollback

If you need to rollback to pre-March 2026 behavior:

### 1. Disable Betting Feed

```bash
# Server .env
BETTING_FEED_ACCESS_TOKEN=  # Leave empty to disable
```

### 2. Revert to Public Polling

```typescript
// Use public spectator endpoint (no auth required)
const response = await fetch("http://localhost:5555/api/streaming/state");
const state = await response.json();
```

### 3. Disable Embedded Auth Validation

```bash
# Client .env
PUBLIC_EMBED_ALLOWED_ORIGINS=  # Leave empty to allow all origins (dev only)
```

**Note**: This is NOT recommended for production. Use explicit allowlist.

## Support

- **Issues**: Report bugs in main Hyperscape repository
- **Documentation**: See `docs/streaming-betting-integration.md` for detailed guide
- **API Reference**: See `docs/api-betting-feed.md` for complete API documentation
- **Hyperbet Integration**: See HyperscapeAI/hyperbet#28 for consumer-side implementation
