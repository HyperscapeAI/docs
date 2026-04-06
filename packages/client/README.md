# Hyperscape Client

Web client for Hyperscape 3D multiplayer MMORPG, built with Vite, React 19, and Three.js WebGPU renderer.

## Overview

The Hyperscape client is a modern web-based 3D game client featuring:
- **WebGPU Rendering**: Three.js 0.183.2 with TSL (Three Shading Language) shaders
- **React 19 UI**: Modern React with hooks and concurrent features
- **Real-time Multiplayer**: WebSocket connection to game server (uWebSockets.js on port 5556)
- **VRM Avatars**: Custom player avatars with live 3D portraits
- **Unified Tooltips**: Consistent tooltip styling across all UI panels
- **Visual Effects**: Tree dissolve transparency, damage splats, teleport effects
- **Mobile Support**: Capacitor integration for iOS and Android

## Quick Start

### Prerequisites

- **Bun 1.3.10+** (for package management and build)
- **Modern Browser** with WebGPU support:
  - Chrome 113+
  - Edge 113+
  - Safari 18+ (macOS 15+)
  - Check support: [webgpureport.org](https://webgpureport.org)

### Installation

```bash
cd packages/client
bun install
```

### Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

**Required Configuration:**
```env
# Privy Authentication (required for persistent accounts)
PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Server URLs
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5556/ws  # Note: port 5556 for WebSocket

# CDN URL
PUBLIC_CDN_URL=http://localhost:8080
```

**Optional Configuration:**
```env
# Farcaster Frame v2
PUBLIC_ENABLE_FARCASTER=false
PUBLIC_APP_URL=http://localhost:3333

# LiveKit Voice Chat
PUBLIC_LIVEKIT_URL=wss://your-livekit-server

# Development
VITE_PORT=3333
```

### Running

**Development:**
```bash
bun run dev
```
Opens on `http://localhost:3333` with hot module replacement.

**Production Build:**
```bash
bun run build
bun run preview  # Preview production build
```

## Features

### UI Systems

- **Unified Tooltips** (March 2026): Consistent tooltip styling across all panels using centralized style utilities
- **Bank System**: 480-slot bank with tabs, equipment deposit/withdraw, coin management
- **Inventory**: 28-slot inventory with drag-and-drop, coin pouch, item stacking
- **Equipment**: Paperdoll view with live 3D portrait, stat bonuses, drag-and-drop equipping
- **Skills**: XP tracking, level progression, skill unlocks
- **Prayer**: Prayer point management, active prayer tracking, drain rate display
- **Spells**: Magic spellbook with rune requirements, autocast selection
- **Combat**: Attack style selection, auto-retaliate toggle, combat level display
- **Dialogue**: NPC dialogue with live 3D VRM portraits
- **Home Teleport**: Visual cast effects, 30s cooldown, minimap orb integration
- **Action Bar**: Drag-and-drop action slots with keyboard shortcuts (1-9, 0)

### Visual Systems

- **Tree Dissolve** (March 2026): Depleted trees become ~70% transparent with screen-door dithering, animate back to full opacity on respawn
- **Damage Splats**: Floating damage numbers with color-coded hit types
- **XP Drops**: Floating XP notifications with skill icons
- **Teleport Effects**: Portal effects with terrain-aware anchoring
- **Health Bars**: Overhead health bars for mobs and players
- **Equipment Visuals**: Real-time equipment rendering on player avatars
- **Projectiles**: Arrow and spell projectile rendering

### Interaction Systems

- **Context Menus**: Right-click menus for entities with action options
- **Raycasting**: Accurate click detection using LOD2 geometry for trees (March 2026)
- **Hover Highlights**: Entity highlighting on mouse hover
- **Drag-and-Drop**: Inventory, equipment, bank, and action bar item management
- **Keyboard Shortcuts**: Action bar slots (1-9, 0), panel hotkeys

## Architecture

### Core Components

**GameClient** (`src/screens/GameClient.tsx`)
- Main game container
- World initialization
- System coordination
- Event handling

**InterfaceManager** (`src/game/interface/InterfaceManager.tsx`)
- Window management
- Panel rendering
- Modal coordination
- Drag-and-drop context

**ClientNetwork** (`packages/shared/src/systems/client/ClientNetwork.ts`)
- WebSocket connection management
- Packet handling
- Network interpolation
- Connection quality monitoring

### UI Architecture

**Tooltip System** (`src/ui/core/tooltip/`)
- `CursorTooltip.tsx` - Cursor-following tooltip component
- `tooltipStyles.ts` - Centralized style utilities (March 2026)
  - `getTooltipTitleStyle()` - Title text styling
  - `getTooltipMetaStyle()` - Metadata/secondary text
  - `getTooltipBodyStyle()` - Body content
  - `getTooltipDividerStyle()` - Section dividers
  - `getTooltipTagStyle()` - Tag/badge styling
  - `getTooltipStatusStyle()` - Status indicators

**Panel System** (`src/game/panels/`)
- Modular panel components
- Shared styling utilities
- Consistent layouts
- Drag-and-drop integration

**Theme System** (`src/ui/theme/`)
- Centralized theme configuration
- Dark mode support
- Responsive breakpoints
- Accessibility features

### Rendering Pipeline

**Three.js WebGPU** (`packages/shared/src/`)
- WebGPURenderer (TSL shaders only)
- Post-processing (bloom, tone mapping)
- LOD system (3 levels for trees, buildings)
- Instanced rendering (trees, rocks, grass)
- Batched rendering (vegetation)

**Visual Effects** (`packages/shared/src/systems/client/`)
- `DamageSplatSystem.ts` - Floating damage numbers
- `XPDropSystem.ts` - Floating XP notifications
- `ClientTeleportEffectsSystem.ts` - Teleport portal effects
- `ProjectileRenderer.ts` - Arrow and spell projectiles
- `HealthBars.ts` - Overhead health bars

**Material Systems** (`packages/shared/src/systems/shared/world/`)
- `GPUMaterials.ts` - TSL shader materials
- `DissolveAnimation.ts` - Tree dissolve transparency (March 2026)
- `TreeLODMaterials.ts` - LOD-specific tree materials

## Development

### File Structure

```
src/
├── screens/                  # Top-level screens
│   ├── GameClient.tsx        # Main game screen
│   ├── LoginScreen.tsx       # Authentication screen
│   ├── CharacterSelectScreen.tsx  # Character selection
│   └── LoadingScreen.tsx     # Loading screen
├── game/
│   ├── interface/            # Interface management
│   │   ├── InterfaceManager.tsx
│   │   ├── WindowRenderer.tsx
│   │   └── DragDropCoordinator.tsx
│   ├── panels/               # UI panels
│   │   ├── InventoryPanel.tsx
│   │   ├── EquipmentPanel.tsx
│   │   ├── BankPanel.tsx
│   │   ├── SkillsPanel.tsx
│   │   ├── PrayerPanel.tsx
│   │   ├── SpellsPanel.tsx
│   │   └── ...
│   ├── hud/                  # HUD elements
│   │   ├── Minimap.tsx
│   │   ├── StatusBars.tsx
│   │   ├── ContextMenu.tsx
│   │   └── HomeTeleportButton.tsx
│   └── systems/              # Client-side systems
│       ├── InventoryActionDispatcher.ts
│       └── ...
├── ui/                       # Shared UI components
│   ├── core/
│   │   ├── tooltip/          # Tooltip system
│   │   ├── drag/             # Drag-and-drop
│   │   ├── window/           # Window management
│   │   └── responsive/       # Responsive utilities
│   ├── components/           # Reusable components
│   ├── stores/               # Zustand stores
│   └── theme/                # Theme configuration
├── auth/                     # Authentication
│   ├── PrivyAuthProvider.tsx
│   ├── PrivyAuthManager.ts
│   └── PlayerTokenManager.ts
└── lib/                      # Utilities
    ├── websocket-manager.ts
    ├── api-client.ts
    └── ...
```

### Key Technologies

- **Vite 8.0.0**: Build tool with HMR
- **React 19.2.0**: UI framework
- **Tailwind CSS 3.4.1**: Utility-first CSS (rolled back from v4 in April 2026)
- **Three.js 0.183.2**: 3D rendering (WebGPU only)
- **@pixiv/three-vrm 3.5.1**: VRM avatar support
- **Zustand**: State management
- **@dnd-kit**: Drag-and-drop
- **Privy**: Authentication

### Build Configuration

**Vite Config** (`vite.config.ts`):
- WebGPU polyfills
- Asset optimization
- Code splitting
- Environment variable injection

**Tailwind Config** (`tailwind.config.js`):
- Custom color palette
- Responsive breakpoints
- Custom utilities
- PostCSS pipeline (v3 stable)

## Testing

### E2E Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run specific test
bun run test:e2e -- combat.spec.ts

# Run with visible browser
bun run test:e2e:headed
```

### Unit Tests

```bash
# Run unit tests
bun run test:unit

# Run with coverage
bun run test:coverage
```

### Visual Testing

Tests use Playwright with WebGPU-enabled browsers:
- Screenshot comparison
- Three.js scene introspection
- Entity position verification
- UI state validation

## Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables** (set in Vercel dashboard):
- `PUBLIC_PRIVY_APP_ID`
- `PUBLIC_API_URL`
- `PUBLIC_WS_URL`
- `PUBLIC_CDN_URL`

### Cloudflare Pages

```bash
# Build
bun run build

# Deploy
wrangler pages deploy dist
```

### Netlify

```bash
# Build
bun run build

# Deploy
netlify deploy --prod --dir=dist
```

### Static Hosting

The client is a static SPA that can be hosted anywhere:

```bash
# Build
bun run build

# Output: dist/
# Upload dist/ to any static host (S3, GCS, Azure Storage, etc.)
```

**Requirements:**
- Serve `index.html` for all routes (SPA routing)
- Set CORS headers if API/WS on different domain
- Configure environment variables via `env.js` or build-time injection

## Configuration

### Environment Variables

**Required:**
```env
PUBLIC_PRIVY_APP_ID=your-app-id      # Privy authentication
PUBLIC_API_URL=http://localhost:5555  # Game server HTTP
PUBLIC_WS_URL=ws://localhost:5556/ws  # Game server WebSocket (port 5556!)
PUBLIC_CDN_URL=http://localhost:8080  # Asset CDN
```

**Optional:**
```env
PUBLIC_ENABLE_FARCASTER=false         # Farcaster Frame v2
PUBLIC_APP_URL=http://localhost:3333  # App URL for Farcaster
PUBLIC_LIVEKIT_URL=wss://...          # LiveKit voice chat
VITE_PORT=3333                        # Dev server port
```

### WebSocket Connection

**Important**: The WebSocket server runs on port **5556** (uWebSockets.js), not 5555 (HTTP).

```env
# Correct WebSocket URL
PUBLIC_WS_URL=ws://localhost:5556/ws

# For production
PUBLIC_WS_URL=wss://your-domain.com/ws
```

## Troubleshooting

### WebGPU Not Available

**Error:** "WebGPU is not supported in this browser"

**Solutions:**
1. Update browser to latest version (Chrome 113+, Edge 113+, Safari 18+)
2. Check [webgpureport.org](https://webgpureport.org) for browser support
3. Enable WebGPU in browser flags (if behind flag)
4. Verify GPU drivers are up to date

**Note:** WebGL is NOT supported. The game requires WebGPU.

### WebSocket Connection Failed

**Error:** "Failed to connect to game server"

**Solutions:**
1. Verify server is running on port 5556 (WebSocket)
2. Check `PUBLIC_WS_URL` in `.env` points to port 5556
3. Verify firewall allows WebSocket connections
4. Check browser console for detailed error messages

### Assets Not Loading

**Error:** 404 errors for models/textures

**Solutions:**
1. Verify CDN is running: `curl http://localhost:8080/health`
2. Start CDN: `bun run cdn:up` (from root directory)
3. Check `PUBLIC_CDN_URL` in `.env`
4. Verify assets exist in `../../assets/` directory

### Tailwind CSS Missing Utilities

**Error:** Missing utility classes in production build

**Solution:** This was fixed in April 2026 by rolling back to Tailwind v3. If you're on an older version:
1. Update to latest: `git pull origin main`
2. Reinstall dependencies: `bun install`
3. Rebuild: `bun run build`

The client now uses Tailwind CSS 3.4.1 with standard PostCSS pipeline for consistent production builds.

### Authentication Issues

**Error:** Characters vanish on page refresh

**Cause:** Missing Privy credentials - each refresh creates new anonymous user

**Solution:**
1. Get Privy App ID from [dashboard.privy.io](https://dashboard.privy.io)
2. Set `PUBLIC_PRIVY_APP_ID` in `.env`
3. Restart dev server

### Performance Issues

**Symptoms:** Low FPS, stuttering, high memory usage

**Solutions:**
1. Check GPU is being used (not software rendering)
2. Reduce graphics settings in-game
3. Close other GPU-intensive applications
4. Update GPU drivers
5. Check browser task manager for memory leaks

### Mobile Build Issues

**Error:** Capacitor sync fails

**Solutions:**
1. Build client first: `bun run build`
2. Sync Capacitor: `npm run cap:sync`
3. Verify Capacitor config in `capacitor.config.ts`

## Recent Changes

### April 2026

- **Tailwind v3 Rollback** (PR #1105): Restored stable Tailwind v3 pipeline after v4 production issues
  - Consistent CSS output across all build environments
  - No more missing utility classes in Docker builds
  - Standard PostCSS pipeline for reliability

- **Unified Tooltips** (PR #1102): Centralized tooltip styling across all UI panels
  - New `tooltipStyles.ts` with style utility functions
  - Consistent appearance across inventory, equipment, bank, spells, prayer, skills, trade, store, loot
  - Eliminated ~500 lines of duplicated styling code

- **Bank Equipment Layout**: Improved equipment panel integration in bank interface
  - Reuses shared `EquipmentPanel` component
  - Bank-specific deposit actions
  - Live 3D portrait preview
  - Consistent layout with standalone equipment panel

### March 2026

- **Tree Dissolve Transparency** (PR #1101): Visual feedback for resource depletion/respawn
  - Screen-door dithering (stays in opaque render pass)
  - 0.3s smooth animation on respawn
  - LOD transition preservation

- **Tree Collision Improvements** (PR #1100): Accurate click detection using LOD2 geometry
  - Clicks only register on visible tree silhouette
  - Ground clicks near trees work correctly
  - Geometry caching for performance

- **Home Teleport Polish** (PR #1095): Visual effects and cooldown system
  - 30s cooldown (reduced from 15 minutes)
  - Portal effects with terrain anchoring
  - Minimap orb integration

- **Dialogue System Redesign** (PR #1093): Live NPC portraits and improved dialogue flow
  - `DialoguePopupShell` - Dedicated modal for NPC dialogue
  - `DialogueCharacterPortrait` - Live 3D VRM rendering
  - Proper service handoff (bank/store/tanner)

- **Arrow Key Fix** (PR #1092): Arrow keys no longer consumed by panel tabs
  - Camera controls work even when tabs have focus
  - Added `reserveArrowKeys` prop to game windows

## API Reference

### Tooltip Style Utilities

```typescript
import {
  getTooltipTitleStyle,
  getTooltipMetaStyle,
  getTooltipBodyStyle,
  getTooltipDividerStyle,
  getTooltipTagStyle,
  getTooltipStatusStyle,
} from '@/ui/core/tooltip/tooltipStyles';

// Title text
const titleStyle = getTooltipTitleStyle(theme, accentColor?);

// Metadata/secondary text
const metaStyle = getTooltipMetaStyle(theme);

// Body content
const bodyStyle = getTooltipBodyStyle(theme);

// Section dividers
const dividerStyle = getTooltipDividerStyle(theme, accentColor?);

// Tag/badge styling
const tagStyle = getTooltipTagStyle(theme);

// Status indicators (success/danger/warning/default)
const statusStyle = getTooltipStatusStyle(theme, 'success');
```

### Equipment Panel Props

```typescript
interface EquipmentPanelProps {
  equipment: PlayerEquipmentItems | null;
  world?: ClientWorld;
  slotActionLabel?: string;           // "Remove" or "Deposit"
  onSlotAction?: (slotKey: string) => void;
  footerButtons?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  showBonuses?: boolean;              // Show stat bonuses
  layoutVariant?: 'default' | 'bank'; // Layout mode
  isVisible?: boolean;                // Visibility state
}
```

### Dialogue System

```typescript
// DialoguePopupShell - Modal shell for NPC dialogue
<DialoguePopupShell
  isOpen={isOpen}
  onClose={onClose}
  npcName="Shopkeeper"
  npcId="npc_lumbridge_shopkeeper"
>
  {/* Dialogue content */}
</DialoguePopupShell>

// DialogueCharacterPortrait - Live 3D VRM portrait
<DialogueCharacterPortrait
  npcId="npc_lumbridge_shopkeeper"
  world={world}
  compact={false}
/>
```

## Performance

### Optimization Strategies

- **Code Splitting**: Lazy-loaded routes and panels
- **Asset Optimization**: Compressed textures, LOD models
- **Instanced Rendering**: Trees, rocks, grass use GPU instancing
- **Batched Rendering**: Vegetation uses BatchedMesh for efficiency
- **Memoization**: React.memo on expensive components
- **Virtual Scrolling**: Large lists use virtual scrolling

### Performance Targets

- **Initial Load**: <5s on broadband
- **FPS**: 60fps on mid-range hardware
- **Memory**: <500MB for typical gameplay
- **Network**: <100KB/s average bandwidth

### Profiling

```bash
# Build with profiling
bun run build --mode=profiling

# Analyze bundle
bun run analyze
```

## Mobile Development

### Capacitor Setup

```bash
# Sync web build to native projects
npm run cap:sync

# Open in Xcode (iOS)
npm run ios:dev

# Open in Android Studio
npm run android:dev
```

### Mobile-Specific Features

- Touch controls
- Responsive UI scaling
- Mobile-optimized layouts
- Reduced graphics settings
- Battery optimization

### Mobile Configuration

```typescript
// capacitor.config.ts
{
  appId: 'com.hyperscape.game',
  appName: 'Hyperscape',
  webDir: 'dist',
  server: {
    url: process.env.CAP_SERVER_URL,  // For local dev
    cleartext: true
  }
}
```

## Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-ui`
3. Make changes
4. Run tests: `bun run test`
5. Build: `bun run build`
6. Commit: `git commit -am 'Add new UI feature'`
7. Push: `git push origin feature/new-ui`
8. Create Pull Request

### Code Standards

- **TypeScript**: All new code must be TypeScript
- **No `any` types**: ESLint will reject them
- **React 19 patterns**: Use hooks, avoid class components
- **Accessibility**: ARIA labels, keyboard navigation
- **Performance**: Memoize expensive components
- **Testing**: E2E tests for new features

### UI Guidelines

- Use centralized tooltip styles from `tooltipStyles.ts`
- Follow existing panel layout patterns
- Maintain consistent spacing and colors
- Support both desktop and mobile layouts
- Test with keyboard navigation

## License

MIT

## Support

- **Documentation**: See [CLAUDE.md](../../CLAUDE.md) for development guidelines
- **Issues**: Report bugs in main Hyperscape repository
- **Discord**: Join community for support

---

Built with ❤️ using Vite, React, Three.js, and WebGPU.
