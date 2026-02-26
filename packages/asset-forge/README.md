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

### ✨ **VFX Catalog Browser** (New - February 2026)
- Live Three.js previews of all game visual effects
- Comprehensive effect documentation with color palettes, parameters, and layer breakdowns
- Categories: Magic spells, arrow projectiles, glow particles, fishing spots, teleport effects, combat HUD
- Interactive phase timelines for complex effects (teleport sequence visualization)
- Real-time particle system previews with accurate shader rendering

### 🔧 **Processing Tools**
- Sprite generation from 3D models
- Vertex color extraction
- T-pose extraction from animated models
- Asset normalization and optimization

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **3D Graphics**: Three.js (WebGPU), React Three Fiber, Drei
- **State Management**: Zustand, Immer
- **AI Integration**: OpenAI API, Meshy.ai API
- **ML/Computer Vision**: TensorFlow.js, MediaPipe (hand detection)
- **Backend**: Elysia (Bun-native server)
- **Styling**: Tailwind CSS
- **Build Tool**: Bun
- **Rendering**: WebGPU with TSL (Three.js Shading Language)

## Getting Started

### Prerequisites
- Bun runtime (v1.1.38+)
- API keys for OpenAI and Meshy.ai

### Installation

1. Clone the repository
```bash
git clone https://github.com/HyperscapeAI/hyperscape.git
cd hyperscape/packages/asset-forge
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

# Or from packages/asset-forge:
bun run dev:all

# Or run separately:
bun run dev           # Terminal 1: Frontend only (port 3400)
bun run dev:backend   # Terminal 2: Backend services (port 3401)
```

The app will be available at `http://localhost:3400`

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   │   ├── VFX/           # VFX catalog browser components (NEW)
│   │   ├── Generation/    # Asset generation UI
│   │   ├── Equipment/     # Equipment system
│   │   ├── ArmorFitting/  # Armor fitting tools
│   │   └── HandRigging/   # Hand rigging tools
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   ├── data/              # Static data and catalogs
│   │   └── vfx-catalog.ts # VFX effect metadata (NEW)
│   ├── hooks/             # Custom React hooks
│   └── store/             # Zustand state management
├── server/                # Elysia backend
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

### 6. VFX Catalog (`/vfx`) - **New February 2026**
- Browse all game visual effects with live Three.js previews
- **Magic Spells**: Wind/Water/Earth/Fire strikes and bolts with orbiting sparks and trails
- **Arrow Projectiles**: Material-specific arrows (bronze, iron, steel, mithril, adamant) with metallic finishes
- **Glow Particles**: Altar glow (4-layer system), fire, and torch presets with detailed layer breakdowns
- **Fishing Spots**: Water particle effects with splash arcs, bubble rise, shimmer twinkle, and ripple rings
- **Teleport Effects**: Multi-phase animation (gather/erupt/sustain/fade) with rune circles, beams, shockwaves, helix spirals, and burst particles
- **Combat HUD**: Damage splats (hit/miss variants) and XP drops with easing curves
- **Effect Details**: Color swatches, parameter tables, phase timelines, component lists

## API Endpoints

- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `POST /api/generation/start` - Start new generation
- `POST /api/retexture/start` - Generate material variants
- `POST /api/fitting/preview` - Preview armor fitting
- `POST /api/hand-rigging/process` - Process hand rigging
- `GET /api/health` - Health check endpoint

## Scripts

- `bun run dev` - Start frontend development server (port 3400)
- `bun run dev:all` - Start both frontend and backend development servers
- `bun run dev:backend` - Start backend services only (port 3401)
- `bun run build` - Build for production
- `bun run start` - Start production backend services
- `bun run assets:audit` - Audit asset library
- `bun run assets:normalize` - Normalize 3D models
- `bun run assets:extract-tpose` - Extract T-poses from models

## Configuration

The system uses JSON-based configuration for:
- Material presets (`public/prompts/material-presets.json`)
- Asset metadata (stored with each asset)
- Generation prompts and styles (`public/prompts/`)
- VFX effect catalog (`src/data/vfx-catalog.ts`)

## Browser Requirements

**WebGPU Required** (as of February 2026):
- Chrome/Edge 113+ (Windows/macOS/Linux)
- Safari 18+ (macOS Sonoma+ only)
- Check compatibility: [webgpureport.org](https://webgpureport.org)

All Three.js rendering uses TSL (Three.js Shading Language) which requires WebGPU. WebGL is not supported.

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
