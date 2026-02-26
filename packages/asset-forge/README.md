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

### 🎬 **VFX Catalog Browser**
- Browse all game visual effects in a live catalog
- Real-time Three.js previews of spells, arrows, particles, teleport effects
- Detailed parameter panels showing colors, layers, and phase timelines
- Combat HUD effects, fishing particles, and glow effects
- Interactive preview controls for testing VFX in isolation

### 🤖 **Advanced Rigging & Fitting**
- **Armor Fitting System**: Automatically fit armor pieces to character models
- **Hand Rigging**: AI-powered hand pose detection and weapon rigging
- Weight transfer and mesh deformation
- Bone mapping and skeleton alignment

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
cd packages/generation
```

2. Install dependencies using Bun
```bash
bun install
```

3. Create a `.env` file from the example
```bash
cp env.example .env
```

4. Add your API keys to `.env`
```
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_MESHY_API_KEY=your-meshy-api-key
```

### Running the Application

Start both frontend and backend services:
```bash
# Terminal 1: Start the React app
bun run dev:all

# Or run separately:
bun run dev           # Terminal 1: Frontend only
bun run dev:backend   # Terminal 2: Backend services
```

The app will be available at `http://localhost:3400`

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   │   ├── VFX/           # VFX catalog browser components
│   │   ├── Generation/    # Asset generation UI
│   │   ├── ArmorFitting/  # Armor fitting tools
│   │   └── HandRigging/   # Hand rigging tools
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   │   └── VFXPage.tsx    # VFX catalog browser page
│   ├── hooks/             # Custom React hooks
│   ├── data/              # Static data
│   │   └── vfx-catalog.ts # VFX effect definitions
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

### 3. VFX Catalog (`/vfx`)
- Browse all game visual effects
- Live Three.js previews with interactive controls
- Detailed effect parameters (colors, layers, phases)
- Effect categories: spells, arrows, particles, teleport, combat HUD, fishing
- Test effects in isolation before integrating into game

### 4. Equipment System (`/equipment`)
- Manage weapon and armor sets
- Preview equipment combinations
- Configure equipment properties

### 5. Armor Fitting (`/armor-fitting`)
- Upload character models
- Automatically fit armor pieces
- Adjust positioning and scaling
- Export fitted models

### 6. Hand Rigging (`/hand-rigging`)
- Upload weapon models
- AI-powered hand pose detection
- Automatic grip point calculation
- Export rigged weapons

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
- Material presets (`public/material-presets.json`)
- Asset metadata (stored with each asset)
- Generation prompts and styles
- VFX effect definitions (`src/data/vfx-catalog.ts`)

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
