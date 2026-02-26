# Gold Betting Demo - Mobile UI Guide

The Gold Betting Demo received a comprehensive mobile-responsive UI overhaul in February 2026, replacing mock data with live SSE feeds and adding resizable panels for desktop.

## Overview

**Key Changes:**
- ✅ **Real-data integration** - Live SSE feed from game server (no mock data in dev mode)
- ✅ **Resizable panels** - Desktop drag-to-resize for viewport, bottom, and sidebar
- ✅ **Mobile-responsive layout** - Bottom-sheet sidebar, 16:9 video, touch-friendly controls
- ✅ **Agent stats overlay** - HP bars, equipment icons, inventory grid from manifest data
- ✅ **Keeper persistence** - SQLite database for bet tracking and referrals

## Architecture Changes

### Mode Routing

**Before**: Single `App.tsx` with `isStreamUIMode` flag for mock data

**After**: Separate apps routed in `AppRoot.tsx`

```typescript
// AppRoot.tsx
const IS_STREAM_UI = import.meta.env.MODE === 'stream-ui';

<WalletProvider>
  {IS_STREAM_UI ? <StreamUIApp /> : <App />}
</WalletProvider>
```

**Modes:**
- `bun run dev` (devnet) → `App.tsx` with live SSE data
- `bun run dev:stream-ui` → `StreamUIApp.tsx` with mock simulation
- `bun run dev:local` → Local Solana validator

### Data Sources

**Live Mode** (`App.tsx`):
- **Streaming state**: `/api/streaming/state/events` (SSE)
- **Duel context**: `/api/streaming/duel-context` (polling every 3s)
- **Chain data**: Solana RPC / EVM RPC (when wallet connected)

**Stream UI Mode** (`StreamUIApp.tsx`):
- **Mock engine**: `useMockStreamingEngine` hook
- **Simulated fights**: Deterministic HP decay, phase transitions
- **No RPC calls**: Pure frontend simulation

## Mobile Layout

### Breakpoint

**Mobile**: `≤768px` (matches CSS media queries)

**Detection**:
```typescript
const isMobile = useIsMobile(768);  // Hook tracks window.innerWidth
```

### Header (Mobile)

**Row 1**: Brand + quick controls
```
┌─────────────────────────────────────┐
│ HYPERSCAPE     🏆 [SOL] [EVM]      │
│ MARKET                              │
│ [Chain ▼]                           │
└─────────────────────────────────────┘
```

**Row 2**: Match strip
```
┌─────────────────────────────────────┐
│ AgentA vs AgentB                    │
│ [AgentA 0.65] [AgentB 0.35]         │
└─────────────────────────────────────┘
```

### Viewport Row

**Phase Strip** (mobile only):
```
┌─────────────────────────────────────┐
│ [LIVE] AgentA vs AgentB             │
└─────────────────────────────────────┘
```

**Video** (16:9 aspect ratio):
```
┌─────────────────────────────────────┐
│                                     │
│         Game Stream                 │
│         (16:9 video)                │
│                                     │
│ [🔇] [Source 1/2]                   │
└─────────────────────────────────────┘
```

### Bottom Panel

**Tabs** (horizontal scroll on mobile):
```
[Trades] [Order Book] [Match Log] [Agents] [Leaderboard] [Positions]
```

**Content**: Full-width table or grid

### Sidebar (Mobile)

**Bottom Sheet** with:
- Drag handle at top
- Close button (never overlaps agent names)
- Matchup header with phase badge
- Betting controls (full-width)
- Safe area insets for notched devices

**Open/Close**:
- **Open**: Tap floating action button (FAB) or agent chip
- **Close**: Tap backdrop, close button, or swipe down

## Desktop Layout

### Resizable Panels

**Three Panels**:
1. **Stream Panel** (left) - Game viewport + chart
2. **Bottom Panel** - Trades, order book, agents, leaderboard
3. **Sidebar** (right) - Betting controls

**Resize Handles**:
- Vertical bar between stream and chart (drag left/right)
- Horizontal bar above bottom panel (drag up/down)
- Vertical bar left of sidebar (drag left/right)

**Persistence**: Panel sizes saved to `localStorage`:
- `hs-panel-stream` - Stream width (default: 520px, min: 180px, max: 1400px)
- `hs-panel-sidebar` - Sidebar width (default: 320px, min: 200px, max: 640px)
- `hs-panel-bottom` - Bottom height (default: 240px, min: 80px, max: 560px)

### useResizePanel Hook

```typescript
const { size, startDrag, reset } = useResizePanel({
  initial: 520,
  min: 180,
  max: 1400,
  storageKey: 'hs-panel-stream'
});

// Apply size (only on desktop)
<div style={isMobile ? undefined : { width: size }}>
  {/* Panel content */}
</div>

// Attach drag handler
<ResizeHandle 
  direction="h" 
  onMouseDown={(e) => startDrag(e, 'x')} 
/>
```

**Important**: Inline styles must NOT apply on mobile (they override CSS media queries).

## Agent Stats Display

### Data Sources

**Priority** (highest to lowest):
1. **Duel context** (`/api/streaming/duel-context`) - Full data with inventory + monologues
2. **Streaming state** (`/api/streaming/state/events`) - Basic HP, wins, losses
3. **On-chain match** - Agent names from Solana/EVM contracts
4. **Fallback** - "Agent A" / "Agent B"

### HP Bar

**Fighting-game style** with skewed clip-path:

```css
/* Outer frame (white border) */
clip-path: polygon(2% 0, 100% 0, 98% 100%, 0 100%);  /* Left side */
clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);  /* Right side */

/* Inner fill (colored HP) */
clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%);  /* Left side */
clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%);  /* Right side */
```

**Colors**:
- HP ≥20%: `#00ffcc` (cyan)
- HP <20%: `#ff0d3c` (red, critical)

### Equipment + Inventory Grid

**Layout**: 17 columns × 2 rows
- **Columns 1-3** (or 15-17): Equipment slots (6 visible)
- **Columns 4-17** (or 1-14): Inventory slots (28 total)

**Direction-aware**: Equipment on left for left agent, right for right agent.

**Item Icons**:
1. Load manifest from `/game-assets/manifests/items/*.json`
2. Resolve `iconPath` (handle `asset://` prefix)
3. Fallback to deterministic emoji if icon fails to load

**Fallback Emojis**: `🗡️ 🪓 🛡️ 🏹 🧪 💎 🪙 📜 🪄 🧿` (deterministic hash from itemId + slot)

## Keeper Service

### SQLite Persistence

**File**: `packages/gold-betting-demo/keeper/src/db.ts`

**Tables**:
- `bets` - Bet records (id, wallet, chain, amount, tx, invite code)
- `wallet_display` - Wallet display names (normalized → display)
- `wallet_points` - Points by wallet (self, win, referral, staking)
- `wallet_canonical` - Canonical wallet mapping (for identity merging)
- `identity_members` - Identity group members
- `invite_codes` - Invite codes by wallet
- `referrals` - Referral relationships
- `invited_wallets` - Invitee tracking
- `referral_fees` - Fee share tracking

**Strategy**: Load-on-start + write-through
- All data loaded from SQLite at startup
- Every mutation calls `save*()` function
- Rate-limit buckets and SSE clients remain ephemeral

### Environment Variables

**File**: `packages/gold-betting-demo/keeper/.env.example`

**Required**:
```bash
# Game server URL for streaming state
STREAM_STATE_SOURCE_URL=http://localhost:5555/api/streaming/state

# Database path
KEEPER_DB_PATH=./keeper.sqlite
```

**Optional**:
```bash
# Auth tokens
STREAM_STATE_SOURCE_BEARER_TOKEN=
ARENA_EXTERNAL_BET_WRITE_KEY=

# Solana
SOLANA_RPC_URL=
BOT_KEYPAIR=~/.config/solana/id.json

# EVM
BSC_RPC_URL=
BASE_RPC_URL=

# Birdeye (token prices)
BIRDEYE_API_KEY=
```

## Development Workflow

### Running Locally

**Dev Mode** (connects to real game server):
```bash
cd packages/gold-betting-demo/app
bun run dev --mode devnet
```

**Stream UI Mode** (mock simulation):
```bash
bun run dev --mode stream-ui
```

**Local Validator** (full stack):
```bash
bash app/scripts/run-local-demo.sh
```

### Testing

**E2E Tests**:
```bash
# Local validator
bash app/scripts/run-e2e-local.sh

# Public devnet
bash app/scripts/run-e2e-public.sh
```

**Test Files**:
- `app/tests/e2e/solana-clob-ui.spec.ts` - UI interaction tests
- `app/tests/unit/invite.test.ts` - Invite code logic
- `app/tests/unit/invite-extended.test.ts` - Extended invite scenarios

## Mobile Optimizations

### Touch Targets

All interactive elements have minimum 44px touch targets:

```css
.hm-header-mob-wallet-btn {
  min-height: 44px;
  padding: 8px 14px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

### Font Sizing

Inputs use `max(16px, 15px)` to prevent iOS zoom:

```css
.pm-compact .gm-amount-input {
  font-size: max(16px, 15px) !important;
}
```

### Safe Area Insets

Bottom sheet respects notched devices:

```css
.hm-sidebar {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Viewport Units

Uses `dvh` (dynamic viewport height) for mobile browsers:

```css
.hm-main {
  height: calc(100dvh - var(--hm-header-height));
}
```

## Styling System

### CSS Variables

**File**: `packages/gold-betting-demo/app/src/styles.css`

**Key Variables**:
```css
:root {
  --hm-header-height: 120px;  /* Mobile: 2 rows */
  --hm-font-display: 'Orbitron', monospace;
  --hm-font-mono: 'IBM Plex Mono', monospace;
  --hm-stone-dark: rgba(10, 12, 18, 0.95);
  --hm-stone-mid: rgba(229, 184, 74, 0.2);
  --hm-gold: #e5b84a;
}

@media (min-width: 769px) {
  :root {
    --hm-header-height: 64px;  /* Desktop: 1 row */
  }
}
```

### Theme Classes

**Phase Badges**:
```css
.hm-phase-badge--fighting { background: #22c55e; }
.hm-phase-badge--countdown { background: #f59e0b; }
.hm-phase-badge--resolution { background: #3b82f6; }
.hm-phase-badge--idle { background: #6b7280; }
```

**Side Chips**:
```css
.hm-side-chip--yes { border-color: #22c55e; }
.hm-side-chip--no { border-color: #ef4444; }
.hm-side-chip--active { background: rgba(34, 197, 94, 0.2); }
```

## API Integration

### SSE Streaming State

**Endpoint**: `GET /api/streaming/state/events`

**Response** (Server-Sent Events):
```
event: state
data: {"type":"STREAMING_STATE_UPDATE","cycle":{...}}

event: state
data: {"type":"STREAMING_STATE_UPDATE","cycle":{...}}
```

**Hook**: `useStreamingState()`

```typescript
const { state } = useStreamingState();

// state.cycle.phase: "IDLE" | "FIGHTING" | "COUNTDOWN" | "ANNOUNCEMENT" | "RESOLUTION"
// state.cycle.agent1: { name, hp, maxHp, wins, losses, ... }
// state.cycle.agent2: { name, hp, maxHp, wins, losses, ... }
// state.leaderboard: [{ rank, name, wins, losses, winRate, ... }]
```

### Duel Context Polling

**Endpoint**: `GET /api/streaming/duel-context`

**Response** (JSON):
```json
{
  "type": "STREAMING_DUEL_CONTEXT",
  "cycle": {
    "agent1": {
      "id": "agent1",
      "name": "AgentA",
      "hp": 85,
      "maxHp": 100,
      "inventory": [
        { "slot": 0, "itemId": "bronze_sword", "quantity": 1 },
        { "slot": 1, "itemId": "wooden_shield", "quantity": 1 }
      ],
      "monologues": [
        { "id": "m1", "type": "action", "content": "Attacking with sword", "timestamp": 1709000000 }
      ]
    }
  }
}
```

**Hook**: `useDuelContext()`

```typescript
const { context } = useDuelContext();

// context.cycle.agent1.inventory: Array<{ slot, itemId, quantity }>
// context.cycle.agent1.monologues: Array<{ id, type, content, timestamp }>
```

## Compact Mode (Sidebar)

### PredictionMarketPanel Compact Prop

**Usage**:
```typescript
<PredictionMarketPanel
  compact={true}  // Enables sidebar mode
  agent1Name="AgentA"
  agent2Name="AgentB"
  // ... other props
/>
```

**Changes in Compact Mode**:
- Hides chart, order book, and trades columns
- Single-column layout (full-width)
- Square corners (`border-radius: 2px`)
- Gold theme colors (matches hm-* classes)
- Touch-friendly buttons (min-height: 44px)
- Prevents iOS zoom (font-size: max(16px, 15px))

### CSS Overrides

```css
/* Square corners everywhere */
.pm-compact * { border-radius: 2px !important; }

/* Full-width fluid layout */
.pm-compact { width: 100%; }
.pm-compact > div { width: 100%; min-width: 0; }

/* Hide stats mini-buttons */
.pm-compact .gm-btn-sm { display: none !important; }

/* Touch-friendly submit button */
.pm-compact .gm-btn-submit {
  height: 46px !important;
  min-height: 44px !important;
  touch-action: manipulation;
}
```

## Performance Considerations

### Conditional Rendering

**Desktop**: All panels visible, resizable
**Mobile**: Sidebar hidden by default, opens as bottom sheet

```typescript
{!isSidebarOpen && (
  <button className="hm-bet-fab" onClick={() => setIsSidebarOpen(true)}>
    Place Bet
  </button>
)}
```

### Lazy Loading

Item icons loaded on demand:

```typescript
useEffect(() => {
  let isMounted = true;
  void loadItemIconMap().then((iconMap) => {
    if (!isMounted) return;
    setItemIconMap(iconMap);
  });
  return () => { isMounted = false; };
}, []);
```

### Polling Optimization

Only poll chain data when wallet connected:

```typescript
const shouldPollChainData = Boolean(
  isE2eMode || wallet.publicKey || wallet.connected
);
```

## Troubleshooting

### Sidebar Not Opening on Mobile

**Symptom**: Tap FAB but sidebar doesn't appear

**Solutions**:
1. Check `isSidebarOpen` state
2. Verify backdrop click handler
3. Check z-index (sidebar: 49, backdrop: 48)

### Resize Handles Not Working

**Symptom**: Can't drag resize handles on desktop

**Solutions**:
1. Verify `isMobile` is false
2. Check `startDrag` handler is attached
3. Verify cursor changes to `col-resize` or `row-resize`

### Item Icons Not Loading

**Symptom**: Inventory shows emoji fallbacks instead of icons

**Solutions**:
1. Check manifest URL: `${GAME_API_URL}/game-assets/manifests/items/*.json`
2. Verify CORS headers on CDN
3. Check browser console for 404 errors
4. Verify `iconPath` in manifest (should be `asset://icons/...`)

### Agent Stats Not Updating

**Symptom**: HP bars frozen, stats don't change

**Solutions**:
1. Check SSE connection: Network tab → `state/events` (should be pending)
2. Verify duel context polling: Network tab → `duel-context` (every 3s)
3. Check game server is running: `curl http://localhost:5555/health`

## See Also

- [packages/gold-betting-demo/app/src/App.tsx](../packages/gold-betting-demo/app/src/App.tsx) - Main app component
- [packages/gold-betting-demo/app/src/lib/useResizePanel.ts](../packages/gold-betting-demo/app/src/lib/useResizePanel.ts) - Resize hook
- [packages/gold-betting-demo/app/src/spectator/useDuelContext.ts](../packages/gold-betting-demo/app/src/spectator/useDuelContext.ts) - Duel context hook
- [packages/gold-betting-demo/keeper/.env.example](../packages/gold-betting-demo/keeper/.env.example) - Keeper configuration
