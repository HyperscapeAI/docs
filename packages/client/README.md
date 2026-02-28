# Hyperscape Client

Web client for Hyperscape, a RuneScape-inspired MMORPG with AI agents.

## Overview

The Hyperscape client is a persistent multiplayer RPG featuring:
- Real-time combat with melee, ranged, and magic
- Skill-based progression system (17 skills)
- Resource gathering and artisan skills
- Banking and trading systems
- Mob spawning and AI entities
- Comprehensive UI with inventory, equipment, and banking interfaces

## Quick Start

### TL;DR - Get Playing Fast

```bash
cd packages/client
bun install
bun run dev
# Open http://localhost:3333 and start playing!
# (No auth setup needed for local development)
```

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Bun recommended for fastest installation
- 4GB+ RAM (for 3D rendering)
- **Modern browser with WebGPU support** (Chrome 113+, Edge 113+, Safari 18+)
- Check WebGPU availability: [webgpureport.org](https://webgpureport.org)

> **Note**: Hyperscape requires WebGPU. WebGL is not supported. All materials and post-processing effects use TSL (Three.js Shading Language), which only works with WebGPU.

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperscapeai/hyperscape
cd hyperscape/packages/client

# Install dependencies
bun install

# Start the development server (Privy auth is OPTIONAL)
bun run dev
```

The frontend will start on `http://localhost:3333` and backend on `http://localhost:5555`

> **Note**: Authentication with Privy is **optional**. The app works perfectly fine without it for development/testing. Users will be anonymous but can still play. See \"Authentication Setup\" below to enable persistent accounts.

## Game Systems

### Combat System

- **Melee Combat**: Equip weapons and click on enemies to attack
- **Ranged Combat**: Requires bow + arrows equipped
- **Magic Combat**: Cast spells with runes, autocast support
- **Auto-Attack**: Combat continues automatically when in range
- **Damage System**: Based on Attack/Strength/Ranged/Magic levels and equipment
- **Death Mechanics**: Items drop at death location, respawn at nearest town

### Skills System

17 core skills with XP-based progression:

**Combat Skills:**
1. **Attack** - Determines weapon accuracy and requirements
2. **Strength** - Increases melee damage
3. **Defense** - Reduces incoming damage, armor requirements
4. **Constitution** - Determines health points
5. **Ranged** - Bow accuracy and damage
6. **Magic** - Spell accuracy and damage
7. **Prayer** - Prayer bonuses and drain rate

**Gathering Skills:**
8. **Woodcutting** - Tree harvesting with hatchet
9. **Mining** - Ore gathering with pickaxe
10. **Fishing** - Fish gathering at water edges

**Artisan Skills:**
11. **Firemaking** - Create fires from logs
12. **Cooking** - Process raw fish into food
13. **Smithing** - Smelt ores and smith equipment
14. **Crafting** - Create leather armor, dragonhide, jewelry, cut gems
15. **Fletching** - Create bows and arrows

**Support Skills:**
16. **Agility** - Movement speed and shortcuts
17. **Runecrafting** - Convert essence into runes at altars

### Equipment System

11-slot equipment system (OSRS-style paperdoll):
- Weapon, Shield, Helmet, Body, Legs
- Boots, Gloves, Cape, Amulet, Ring
- Arrows (ammunition slot)

**Equipment Tiers:**
- **Bronze** (Level 1+)
- **Iron** (Level 1+)
- **Steel** (Level 10+)
- **Mithril** (Level 20+)
- **Adamant** (Level 30+)
- **Rune** (Level 40+)

**Armor Types:**
- **Melee Armor**: High physical defense, negative magic bonuses
- **Ranged Armor**: Leather, dragonhide with ranged/magic bonuses
- **Magic Armor**: Wizard robes, mystic robes with magic bonuses

### Artisan Skills

**Crafting:**
- Leather crafting (needle + thread)
- Dragonhide armor (needle + thread)
- Jewelry crafting (furnace + moulds)
- Gem cutting (chisel)
- Tanning (instant hide-to-leather conversion)

**Fletching:**
- Arrow shafts (knife + logs, 15 per action)
- Headless arrows (shafts + feathers, 15 per action)
- Arrows (arrowtips + headless arrows, 15 per action)
- Bows (knife + logs, then string with bowstring)

**Runecrafting:**
- Instant essence-to-rune conversion at altars
- Multi-rune multipliers at higher levels
- Two essence types (rune_essence, pure_essence)

### Economy

- **Banking**: 480-slot storage with tabs
- **General Store**: Purchase tools and arrows
- **Loot Drops**: Coins and equipment from defeated enemies
- **Trading**: Player-to-player trading system
- **Duel Arena**: Stake items in PvP duels

## User Interface

### Core UI Elements

- **Account panel** (👤) - Login status, user info, logout, character name
- **Combat panel** (⚔️) - Attack styles and combat stats
- **Skills panel** (🧠) - Level progression and XP tracking
- **Inventory** (🎒) - 28 slots, drag-and-drop items
- **Equipment panel** (🛡️) - Worn items and stats
- **Settings panel** (⚙️) - Graphics, audio, and display options
- **Health/Stamina bars** - Displayed on minimap
- **Banking interface** - Store/retrieve items (at banks)
- **Store interface** - Purchase tools and supplies (at stores)

### Controls

- **Movement**: WASD keys or click-to-move
- **Camera**: Mouse look (hold right-click to rotate, scroll to zoom)
- **Interact**: Left-click on objects/NPCs
- **Context menu**: Right-click for advanced actions
- **UI Panels**: Click icons on left side of screen

## Authentication Architecture

### Privy Integration

The authentication system uses Privy for secure, Web3-native user management:

**Client-Side Components:**
- `PrivyAuthManager.ts` - Authentication state management
- `PrivyAuthProvider.tsx` - React context provider for Privy
- `LoginScreen.tsx` - Pre-game login UI
- `farcaster-frame-config.ts` - Farcaster Frame v2 metadata

**Authentication Flow:**

```
User Opens App
     ↓
Check Farcaster Context
     ↓
[Farcaster] → Auto-login    [Web/Mobile] → Show Login Screen
     ↓                              ↓
Privy Authentication (wallet, email, social, or Farcaster)
     ↓
Receive Access Token
     ↓
Connect to Server via WebSocket
     ↓
Server Verifies Token with Privy
     ↓
Load/Create User Account
     ↓
Spawn Player in World
```

**Key Features:**
- Zero-knowledge authentication (no passwords stored)
- Multi-device account access
- Wallet, email, and social login support
- Farcaster integration for seamless Frame experience
- Backward compatible with legacy anonymous users

## Development

### Architecture

The client is built using Hyperscape's Entity Component System:

- **Systems**: Handle game logic (combat, inventory, etc.)
- **Entities**: Players, mobs, items, world objects
- **Components**: Data containers attached to entities
- **Actions**: Player-initiated activities (attack, gather, etc.)

### Key Systems

- **ClientNetwork**: WebSocket communication
- **ClientGraphics**: 3D rendering with Three.js WebGPURenderer
- **ClientInput**: Keyboard/mouse controls
- **ClientInterface**: UI panel management
- **ClientAudio**: Sound effects and music
- **ClientCameraSystem**: Camera controls and positioning

### File Structure

```
src/
├── game/
│   ├── panels/           # UI panels (inventory, equipment, etc.)
│   ├── components/       # Reusable UI components
│   ├── systems/          # Game systems
│   └── hud/              # HUD elements
├── screens/              # Screen components (login, character select)
├── ui/                   # Core UI framework
├── auth/                 # Authentication providers
└── lib/                  # Utilities and helpers
```

## Testing

Run all tests:

```bash
bun run test
```

Test categories:

```bash
bun run test:e2e          # End-to-end tests
bun run test:unit         # Unit tests
```

## Production Deployment

### Build

```bash
bun run build
```

Output: `dist/` directory with optimized assets

### Environment Variables

```bash
# Required
PUBLIC_API_URL=https://your-server.com
PUBLIC_WS_URL=wss://your-server.com/ws

# Optional
PUBLIC_CDN_URL=https://your-cdn.com
PUBLIC_PRIVY_APP_ID=your-app-id
PUBLIC_ENABLE_FARCASTER=true
PUBLIC_APP_URL=https://your-domain.com
```

### Deployment Platforms

**Vercel:**
```bash
vercel deploy
```

**Netlify:**
```bash
netlify deploy --prod
```

**Cloudflare Pages:**
```bash
wrangler pages deploy dist
```

## Troubleshooting

### Common Issues

**Black screen / game not loading**
- WebGPU is required. Check [webgpureport.org](https://webgpureport.org) to verify WebGPU is available
- Use Chrome 113+, Edge 113+, or Safari 18+ (macOS 15+)
- Check browser console for WebGPU errors
- Try Chrome Canary/Dev channel for latest WebGPU fixes

**Server won't connect**
- Verify WebSocket connection (check browser dev tools)
- Confirm server is running on correct port
- Check firewall settings

**Authentication issues**
- Verify `PUBLIC_PRIVY_APP_ID` is set correctly in `.env`
- Ensure Privy app is configured to allow your domain in redirect URLs
- For Farcaster: Enable Farcaster login in Privy dashboard settings
- For mobile: Add `hyperscape://` scheme to Privy allowed redirect URIs

**Performance problems**
- Reduce graphics settings in Settings panel
- Close other browser tabs
- Check system meets minimum requirements (4GB RAM)
- Ensure GPU drivers are up to date

### Debug Mode

Enable debug logging:

```bash
# Start with debug output
DEBUG=hyperscape:* bun run dev
```

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: GitHub Issues for bug reports
- **Documentation**: In-code comments and this README
- **Community**: Discord server for discussions

---

Built with ❤️ using Hyperscape, Three.js WebGPURenderer, and modern web technologies.
