# Gold Betting Demo - Mobile UI Guide

This guide documents the mobile-responsive UI overhaul completed in February 2026 (PR #942).

## Overview

The gold betting demo now features a fully responsive mobile-first UI with:
- **Resizable panels** on desktop (drag to resize)
- **Bottom-sheet sidebar** on mobile (touch-friendly)
- **Live SSE feed** from game server (replaces mock data in dev mode)
- **Dual wallet support** (SOL + EVM) with mobile-optimized layout
- **Real-time duel streaming** with agent stats overlay

## Mobile Layout Features

### Responsive Breakpoints

The UI adapts to screen size using the `useIsMobile` hook:

```typescript
// Mobile: < 768px
// Desktop: >= 768px
const isMobile = useIsMobile();
```

**Mobile-specific behaviors:**
- JavaScript inline styles are gated (CSS media queries control layout)
- Bottom-sheet sidebar replaces side-by-side panels
- Stacked header layout (logo above phase strip)
- Touch-friendly tab targets (48px minimum)
- `dvh` units for proper mobile viewport height

### Video Player

**Desktop:**
- Resizable panels with drag handles
- Video + sidebar side-by-side
- Minimum 400px video width

**Mobile:**
- Fixed 16:9 aspect ratio video
- Full-width video at top
- Bottom-sheet sidebar below
- No resize handles (CSS controls layout)

### Header Layout

**Desktop:**
- Horizontal layout: `HYPERSCAPE | MARKET` logo, phase strip, wallet buttons
- Tabs below header (Trades, Leaderboard, Points, Referrals)

**Mobile:**
- Stacked layout:
  - `HYPERSCAPE` logo (centered)
  - `MARKET` subtitle (centered)
  - Phase strip above video (full width)
  - SOL wallet button (full width)
  - EVM wallet button (full width)
- Tabs reordered: Trades first (most important on mobile)

### Sidebar Tabs

**Tab Order (Mobile-Optimized):**
1. **Trades** - Recent trades and order book (most important)
2. **Leaderboard** - Top traders by points
3. **Points** - User points and history
4. **Referrals** - Referral links and rewards

**Desktop**: All tabs visible, side-by-side with video
**Mobile**: Bottom-sheet tabs, swipe-friendly, full-width content

## Real Data Integration

### SSE Feed (Server-Sent Events)

**Development Mode** (`bun run dev`):
- Connects to live SSE feed from game server
- Endpoint: `http://localhost:5555/api/streaming/state/events`
- Real-time duel updates, agent stats, HP bars

**Stream UI Mode** (`bun run dev:stream-ui`):
- Uses mock streaming engine for UI development
- No game server required
- Simulated duel data for testing layouts

**Mode Routing** (`AppRoot.tsx`):
```typescript
// MODE=stream-ui → StreamUIApp (mock data)
// All other modes → App (real SSE feed)
```

### Data Flow

1. **Game Server** → SSE endpoint (`/api/streaming/state/events`)
2. **Client** → `useDuelContext()` hook subscribes to SSE
3. **Components** → Consume real-time state:
   - Agent HP bars
   - Combat stats (hits, damage, accuracy)
   - Phase transitions (IDLE, COUNTDOWN, FIGHTING, ANNOUNCEMENT)
   - Market status (open, locked, resolved)

### Keeper Database Persistence

The keeper bot now includes a persistence layer (`keeper/src/db.ts`) for tracking:
- Market history
- Bet records
- Resolution outcomes
- Fee collection

**Configuration** (`.env.example`):
```bash
# Database URL (optional - defaults to in-memory SQLite)
DATABASE_URL=postgresql://user:password@host:5432/database
```

## Development Modes

### Local Development (Real Data)

```bash
cd packages/gold-betting-demo
bun run dev
```

**What starts:**
- Solana test validator with programs deployed
- Mock GOLD mint + funded test wallet
- Vite dev server at `http://127.0.0.1:4179`
- **Real SSE feed** from game server (if running)

**Note**: Simulation/mock data only available via `bun run dev:stream-ui`

### Stream UI Development (Mock Data)

```bash
cd packages/gold-betting-demo/app
bun run dev:stream-ui
```

**What starts:**
- Vite dev server with mock streaming engine
- Simulated duel data (no game server required)
- Useful for UI development and layout testing

### Production Modes

```bash
# Testnet
bun run dev:testnet

# Mainnet
bun run dev:mainnet
```

## Mobile Testing

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Cmd+Shift+M / Ctrl+Shift+M)
3. Select device preset:
   - iPhone 12 Pro (390x844)
   - iPhone 14 Pro Max (430x932)
   - iPad Air (820x1180)
   - Galaxy S20 (360x800)

### Physical Device Testing

**iOS (via Tauri):**
```bash
cd packages/app
npm run ios:dev
```

**Android (via Tauri):**
```bash
cd packages/app
npm run android:dev
```

**Web (via local network):**
1. Find your local IP: `ipconfig getifaddr en0` (Mac) or `hostname -I` (Linux)
2. Start dev server: `bun run dev`
3. Open `http://YOUR_IP:4179` on mobile device

## Responsive Design Patterns

### useResizePanel Hook

Desktop-only resizable panels:

```typescript
const { panelRef, handleRef, panelWidth } = useResizePanel({
  minWidth: 400,
  maxWidth: 800,
  defaultWidth: 600,
  enabled: !isMobile, // Disable on mobile
});
```

**Mobile**: Hook returns fixed width, no drag handlers

### CSS Media Queries

Mobile-specific styles (gated by `!isMobile` in JS):

```css
@media (max-width: 767px) {
  .video-container {
    aspect-ratio: 16 / 9;
    width: 100%;
  }
  
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
  }
}
```

### Touch-Friendly Targets

All interactive elements meet 48px minimum touch target:

```css
.tab-button {
  min-height: 48px;
  padding: 12px 16px;
}

.wallet-button {
  min-height: 56px;
  font-size: 16px;
}
```

## Component Updates

### StreamPlayer.tsx

**Changes:**
- Removed `isStreamUIMode` checks (mode routing now in AppRoot.tsx)
- Always uses real SSE feed in dev mode
- Mock data only in stream-ui mode

### Sidebar.tsx

**Changes:**
- Responsive layout with `useIsMobile` hook
- Bottom-sheet on mobile, side panel on desktop
- Tab reordering (Trades first on mobile)

### AgentStats.tsx

**Changes:**
- Upgraded HP bars with gradient fills
- Real-time stat updates from SSE feed
- Mobile-optimized spacing and font sizes

### Trade Interface

**New Field:**
```typescript
interface Trade {
  trader: string;  // Wallet address of trader
  side: 'YES' | 'NO';
  amount: number;
  timestamp: number;
}
```

**Pre-existing type error fixed**: Added `trader` field to Trade interface

## Testing Checklist

### Desktop (Chrome/Edge/Safari)

- [ ] Video resizes smoothly with drag handle
- [ ] Sidebar maintains minimum 300px width
- [ ] Tabs switch without layout shift
- [ ] Wallet buttons fit in header
- [ ] Phase strip displays correctly

### Mobile (< 768px)

- [ ] Video maintains 16:9 aspect ratio
- [ ] Sidebar appears below video (not side-by-side)
- [ ] Header stacks vertically (logo, phase, wallets)
- [ ] Tabs are touch-friendly (48px height)
- [ ] No horizontal scrolling
- [ ] Bottom-sheet tabs swipe smoothly

### Tablet (768px - 1024px)

- [ ] Layout switches to desktop mode at 768px
- [ ] Resize handles appear
- [ ] Sidebar returns to side-by-side layout

### Data Integration

- [ ] SSE feed connects in dev mode
- [ ] Agent HP bars update in real-time
- [ ] Combat stats reflect actual game state
- [ ] Phase transitions trigger UI updates
- [ ] Market status syncs with game server

## Implementation Details

### Files Changed (PR #942)

**Frontend:**
- `app/src/App.tsx` - Removed simulation mode checks
- `app/src/AppRoot.tsx` - Mode routing (stream-ui vs dev)
- `app/src/components/StreamPlayer.tsx` - Real SSE feed integration
- `app/src/components/Sidebar.tsx` - Responsive layout
- `app/src/components/AgentStats.tsx` - Upgraded HP bars
- `app/src/lib/useResizePanel.ts` - New hook for resizable panels
- `app/src/lib/useMockStreamingEngine.ts` - Mock data for stream-ui mode

**Backend:**
- `keeper/src/db.ts` - Database persistence layer
- `keeper/.env.example` - Database configuration

**Styles:**
- Mobile-first CSS with media queries
- `dvh` units for proper mobile viewport
- Touch-friendly spacing (48px minimum)

### Breaking Changes

**Mode Environment Variable:**
- `MODE=stream-ui` → StreamUIApp (mock data)
- `MODE=devnet` or any other → App (real SSE feed)

**Previous Behavior:**
- `isStreamUIMode` prop passed through components
- Mock data mixed with real data in dev mode

**New Behavior:**
- Mode routing at app root (AppRoot.tsx)
- Clean separation: stream-ui = mock, dev = real
- No mode checks in child components

## Future Improvements

**Planned:**
- [ ] Swipe gestures for tab navigation on mobile
- [ ] Pull-to-refresh for market data
- [ ] Haptic feedback for bet placement
- [ ] Offline mode with cached data
- [ ] Progressive Web App (PWA) support

**Performance:**
- [ ] Virtual scrolling for large trade lists
- [ ] Lazy loading for historical data
- [ ] Image optimization for agent avatars
- [ ] Service worker for asset caching

## Related Documentation

- **Main README**: `packages/gold-betting-demo/README.md`
- **Deployment**: `docs/betting-production-deploy.md`
- **Duel Stack**: `docs/duel-stack.md`
- **Keeper Bot**: `packages/gold-betting-demo/keeper/README.md`

## Commit Reference

- **PR #942**: Mobile-responsive UI overhaul + real-data integration
- **Commit**: `210f6bd` (February 26, 2026)
- **Author**: SYMBiEX
