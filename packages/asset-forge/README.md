# 3D Asset Forge

A comprehensive React/Vite application for AI-powered 3D asset generation, rigging, and fitting. Built for the Hyperscape RPG, this system combines OpenAI's GPT-4 and DALL-E with Meshy.ai to create game-ready 3D models from text descriptions.

## Features

### 🎨 **AI-Powered Asset Generation**
- Generate 3D models from text descriptions using GPT-4 and Meshy.ai
- Automatic concept art creation with DALL-E
- Support for various asset types: weapons, armor, characters, items
- Material variant generation (bronze, steel, mithril, etc.)
- Batch generation capabilities

### 🎮 **3D Asset Management**
- Interactive 3D viewer with Three.js
- Asset library with categorization and filtering
- Metadata management and asset organization
- GLB/GLTF format support

### 🤖 **Advanced Rigging & Fitting**
- **Armor Fitting System**: Automatically fit armor pieces to character models
- **Hand Rigging**: AI-powered hand pose detection and weapon rigging
- Weight transfer and mesh deformation
- Bone mapping and skeleton alignment

### ✨ **VFX Catalog Browser** (New)
- **Live Three.js Previews**: Real-time rendering of all game visual effects
- **Effect Categories**: Spells, arrows, glow particles, fishing spots, teleport, combat HUD
- **Interactive Viewer**: Orbit controls, animated effects, dark/light scene modes
- **Detailed Documentation**: Color palettes, parameter tables, layer breakdowns, phase timelines
- **Comprehensive Coverage**: 
  - 8 spell projectiles (strikes & bolts with trail effects)
  - 6 arrow types (bronze, iron, steel, mithril, adamant)
  - 3 glow particle presets (altar, fire, torch)
  - 3 fishing spot effects (net, fly, default)
  - Teleport effect (multi-phase with helix particles)
  - Combat HUD effects (damage splats, XP drops)

### 🔧 **Processing Tools**
- Sprite generation from 3D models
- Vertex color extraction
- T-pose extraction from animated models
- Asset normalization and optimization

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **State Management**: Zustand, Immer
- **AI Integration**: OpenAI API, Meshy.ai API
- **ML/Computer Vision**: TensorFlow.js, MediaPipe (hand detection)
- **Backend**: Express.js, Node.js
- **Styling**: Tailwind CSS
- **Build Tool**: Bun

## Getting Started

### Prerequisites
- Node.js 18+ or Bun runtime
- API keys for OpenAI and Meshy.ai

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd packages/asset-forge
```

2. Install dependencies using Bun
```bash
bun install
```

3. Create a `.env` file from the example
```bash
cp .env.example .env
```

4. Add your API keys to `.env`
```
OPENAI_API_KEY=your-openai-api-key
MESHY_API_KEY=your-meshy-api-key
```

### Running the Application

Start both frontend and backend services:
```bash
# From repository root:
bun run dev:forge

# Or run from asset-forge directory:
bun run dev:all

# Or run separately:
bun run dev           # Terminal 1: Frontend only
bun run dev:backend   # Terminal 2: Backend services
```

The app will be available at:
- **Frontend**: `http://localhost:3400`
- **Backend API**: `http://localhost:3401`

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   │   ├── VFX/           # VFX catalog browser components
│   │   ├── Generation/    # Asset generation UI
│   │   ├── Equipment/     # Equipment system
│   │   └── ...
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   │   ├── VFXPage.tsx   # VFX catalog browser
│   │   └── ...
│   ├── data/              # Static data and catalogs
│   │   └── vfx-catalog.ts # VFX effect metadata
│   ├── hooks/             # Custom React hooks
│   └── store/             # Zustand state management
├── server/                # Express.js backend
│   ├── api-elysia.ts     # API endpoints
│   └── services/         # Backend services
├── gdd-assets/           # Generated 3D assets
│   └── [asset-name]/     # Individual asset folders
│       ├── *.glb         # 3D model files
│       ├── concept-art.png
│       └── metadata.json
└── scripts/              # Utility scripts
```

## Main Features

### 1. Asset Generation (`/generation`)
- Text-to-3D model pipeline
- Prompt enhancement with GPT-4
- Concept art generation
- 3D model creation via Meshy.ai
- Material variant generation

### 2. Asset Library (`/assets`)
- Browse and manage generated assets
- Filter by type, tier, and category
- 3D preview with rotation controls
- Export and download assets

### 3. Equipment System (`/equipment`)
- Manage weapon and armor sets
- Preview equipment combinations
- Configure equipment properties

### 4. Armor Fitting (`/armor-fitting`)
- Upload character models
- Automatically fit armor pieces
- Adjust positioning and scaling
- Export fitted models

### 5. Hand Rigging (`/hand-rigging`)
- Upload weapon models
- AI-powered hand pose detection
- Automatic grip point calculation
- Export rigged weapons

### 6. VFX Catalog Browser (`/vfx`)
- **Browse All Game Effects**: Organized by category (spells, arrows, glow, fishing, teleport, combat HUD)
- **Live Previews**: Real-time Three.js rendering with animated effects
- **Effect Details**: 
  - Color palettes with hex values
  - Parameter tables (size, intensity, duration, etc.)
  - Layer breakdowns for particle systems
  - Phase timelines for multi-stage effects
  - Component lists for complex effects
- **Interactive Controls**: Orbit camera, zoom, pan
- **Technical Reference**: Shader parameters, blend modes, particle counts

## API Endpoints

- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `POST /api/generation/start` - Start new generation
- `POST /api/retexture/start` - Generate material variants
- `POST /api/fitting/preview` - Preview armor fitting
- `POST /api/hand-rigging/process` - Process hand rigging

## Scripts

- `bun run dev` - Start frontend development server
- `bun run dev:all` - Start both frontend and backend development servers
- `bun run dev:backend` - Start backend services only
- `bun run build` - Build for production
- `bun run start` - Start production backend services
- `bun run assets:audit` - Audit asset library
- `bun run assets:normalize` - Normalize 3D models
- `bun run assets:extract-tpose` - Extract T-poses from models

## Configuration

The system uses JSON-based configuration for:
- Material presets (`public/prompts/material-presets.json`)
- Asset metadata (stored with each asset)
- Generation prompts and styles
- VFX effect definitions (`src/data/vfx-catalog.ts`)

## VFX Catalog

The VFX catalog browser provides comprehensive documentation of all visual effects used in Hyperscape:

### Effect Categories

1. **Magic Spells** (8 effects)
   - Wind/Water/Earth/Fire Strikes (tier 1)
   - Wind/Water/Earth/Fire Bolts (tier 2 with pulse animation)
   - Billboarded glow orbs with trail particles and orbiting sparks

2. **Arrow Projectiles** (6 effects)
   - Default, Bronze, Iron, Steel, Mithril, Adamant
   - 3D mesh rendering with shaft, head, and fletching components

3. **Glow Particles** (3 presets)
   - Altar: 30 particles across 4 layers (pillar, wisp, spark, base)
   - Fire: 18 rising particles with turbulent motion
   - Torch: 6 tighter flame particles

4. **Fishing Spots** (3 effects)
   - Net, Fly, Default fishing
   - Splash arcs, bubble rise, shimmer twinkle, ripple rings

5. **Teleport** (1 effect)
   - Multi-phase animation: gather → erupt → sustain → fade
   - Ground rune circle, dual beams, shockwave rings
   - Helix spiral particles, burst particles with gravity
   - Dynamic point lighting

6. **Combat HUD** (2 effects)
   - Damage splats (hit/miss variants)
   - XP drops with cubic ease-out animation

### Technical Implementation

VFX catalog data is duplicated in `src/data/vfx-catalog.ts` as plain objects (no game engine imports). Source-of-truth files:
- `packages/shared/src/data/spell-visuals.ts`
- `packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts`
- `packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts`
- `packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts`
- `packages/shared/src/systems/client/DamageSplatSystem.ts`
- `packages/shared/src/systems/client/XPDropSystem.ts`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built for the Hyperscape RPG project
- Powered by OpenAI and Meshy.ai APIs
- Uses Three.js for 3D visualization
