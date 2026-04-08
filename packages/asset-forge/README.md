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

### 🛡️ **Armor Pipeline** (New - April 2026)
Complete armor generation pipeline from VRM avatar to game-ready GLB:

**POC-1: Shell Extraction**
- Extract body-fitting armor shells from VRM avatars by bone weight analysis
- Curvature-adaptive offset prevents self-intersection at concavities
- Boundary tapering for smooth transitions at shell edges
- Four bulk classes (skin, cloth, leather, plate) + custom thickness support
- Marching triangles algorithm for smooth slot boundaries

**POC-2: AI Texturing**
- Meshy AI retexture integration with base64 data URI upload (no ngrok needed)
- Pre-painting with target color for accurate AI interpretation
- OSRS tier presets (bronze → dragon) with hex codes for color consistency
- Detail levels (plain → intricate) control ornamentation amount
- Batch tier generation (8 tiers from one shell in ~5 minutes)
- Solid color mode for instant uniform materials (no API cost)

**POC-3: Shell Re-Rigging**
- Automatic bone weight transfer from original shell to textured mesh
- Fast-path direct copy when vertex counts match
- Nearest-vertex fallback for Meshy-modified geometry
- Bounding box alignment handles Meshy centering/normalization
- Full skeleton export with original bone indices for game compatibility
- Multi-piece armor kit with per-piece visibility toggles
- Animation preview (Mixamo walk/run retargeted to VRM)

**Tripo 3D Pipeline** (Experimental)
- Mesh segmentation discovers armor parts automatically
- Per-part texturing with custom prompts (e.g., "ornate pauldrons" for shoulders)
- 3D attachment generation via text-to-model (pauldrons, crests, guards)
- Bone-parented attachments with position/rotation/scale controls
- Granular retry with localStorage session caching (no credit waste)

**Publish to Game**
- One-click export to game's model directory
- Automatic armor manifest updates
- Metadata embedding for equipment system integration

### 🤖 **Advanced Rigging & Fitting**
- **Hand Rigging**: AI-powered hand pose detection and weapon rigging
- Weight transfer and mesh deformation
- Bone mapping and skeleton alignment

### ✨ **VFX Catalog Browser** (New - February 2026)
- Live Three.js previews of all game effects
- Comprehensive effect library:
  - Combat spells (fire, ice, lightning)
  - Projectiles (arrows, magic bolts)
  - Particle systems (glow, fishing, teleport)
  - Combat HUD effects (damage splats, XP drops)
- **Detail Panels** for each effect:
  - Color swatches and gradients
  - Parameter tables (lifetime, scale, velocity)
  - Layer breakdowns (particles, beams, rings)
  - Phase timelines (gather, erupt, sustain, fade)
- **Interactive Controls**:
  - Play/pause animations
  - Adjust camera angle
  - Toggle effect layers
  - Export effect configurations

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
- **Database**: SQLite (via Drizzle ORM)

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

2. Install dependencies
```bash
bun install
```

3. Create a `.env` file from the example
```bash
cp .env.example .env
```

4. Add your API keys to `.env`
```bash
OPENAI_API_KEY=your-openai-api-key
MESHY_API_KEY=your-meshy-api-key
```

### Running the Application

Start both frontend and backend services:
```bash
# Start everything (frontend + backend)
bun run dev

# Or run separately:
bun run dev:ui        # Frontend only (port 3400)
bun run dev:api       # Backend only (port 3401)
```

The app will be available at `http://localhost:3400`

## Project Structure

```
asset-forge/
├── src/                    # React application source
│   ├── components/         # UI components
│   │   ├── VFX/           # VFX catalog components (NEW)
│   │   ├── Generation/    # Asset generation UI
│   │   ├── ArmorFitting/  # Armor fitting tools
│   │   └── HandRigging/   # Hand rigging tools
│   ├── services/          # Core services (AI, fitting, rigging)
│   ├── pages/             # Main application pages
│   │   └── VFXPage.tsx    # VFX catalog browser (NEW)
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand state management
│   └── data/              # Static data
│       └── vfx-catalog.ts # VFX effect definitions (NEW)
├── server/                # Elysia backend
│   ├── api-elysia.ts     # API endpoints
│   ├── services/         # Backend services
│   ├── routes/           # API routes
│   └── db/               # Database layer (NEW)
│       ├── db.ts         # Drizzle client
│       └── schema/       # Database schemas
├── gdd-assets/           # Generated 3D assets
│   └── [asset-name]/     # Individual asset folders
│       ├── *.glb         # 3D model files
│       ├── concept-art.png
│       └── metadata.json
└── scripts/              # Utility scripts
    └── build-services.mjs # Service build script
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
- **Live Three.js Previews**: Real-time rendering of all game effects
- **Sidebar Catalog**: Organized by category (spells, projectiles, particles, combat HUD)
- **Effect Categories**:
  - **Combat Spells**: Fire blast, ice shard, lightning bolt, earth spike
  - **Projectiles**: Arrows (wood, iron, steel, mithril, adamant, rune)
  - **Glow Particles**: Fishing spots, resource nodes, interactive objects
  - **Teleport Effects**: Multi-phase beam with helix spirals and shockwaves
  - **Combat HUD**: Damage splats, XP drops, level-up notifications
- **Detail Panels**:
  - **Colors**: Gradient swatches with hex codes
  - **Parameters**: Lifetime, scale, velocity, particle count
  - **Layers**: Breakdown of visual components (beams, rings, particles)
  - **Phases**: Timeline of animation stages (gather, erupt, sustain, fade)
- **Interactive Controls**:
  - Play/pause effect animations
  - Rotate camera view
  - Toggle individual layers
  - Copy effect configurations
  - Export to JSON

**Implementation**: `src/pages/VFXPage.tsx`, `src/components/VFX/`, `src/data/vfx-catalog.ts`

## API Endpoints

- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `POST /api/generation/start` - Start new generation
- `POST /api/retexture/start` - Generate material variants
- `POST /api/fitting/preview` - Preview armor fitting
- `POST /api/hand-rigging/process` - Process hand rigging
- `GET /api/health` - Health check endpoint

## Scripts

- `bun run dev` - Start both frontend and backend development servers
- `bun run dev:ui` - Start frontend only (port 3400)
- `bun run dev:api` - Start backend only (port 3401)
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
- VFX effect definitions (`src/data/vfx-catalog.ts`)

## TypeScript Configuration

**Module Resolution**: Uses `moduleResolution: "bundler"` to support Three.js WebGPU exports.

**Strict Mode**: Enabled - all callback parameters require explicit type annotations.

**Example** (traverse callbacks):
```typescript
// ❌ FORBIDDEN (TypeScript strict mode error)
object.traverse((child) => {
  if (child.isMesh) { ... }
});

// ✅ CORRECT
import type { Object3D } from 'three';
object.traverse((child: Object3D) => {
  if (child.isMesh) { ... }
});
```

## ESLint Configuration

**Known Issue**: `eslint-plugin-import@2.32.0` is incompatible with ESLint 10 (uses removed `sourceCode.getTokenOrCommentBefore` API).

**Workaround**: The `import/order` rule is disabled in `eslint.config.mjs`:
```javascript
rules: {
  'import/order': 'off', // Disabled due to ESLint 10 incompatibility
}
```

**Lint Command**: Uses `eslint src` instead of `eslint . --ext .ts,.tsx` (deprecated `--ext` flag).

## Database Integration (New - February 2026)

Asset Forge now includes a SQLite database for persistent storage:

**Features:**
- Asset metadata persistence
- Generation history tracking
- User preferences storage
- Batch operation logging

**Schema**: `server/db/schema/assets.schema.ts`

**Migrations**: `server/db/migrations/`

**Usage**:
```typescript
import { db } from './server/db/db';
import { assets } from './server/db/schema';

// Query assets
const allAssets = await db.select().from(assets);

// Insert asset
await db.insert(assets).values({
  name: 'Iron Sword',
  type: 'weapon',
  tier: 'iron',
  // ...
});
```

## Development Notes

### Build Process

The backend services are built using `scripts/build-services.mjs`:

**Changes (February 2026)**:
- Uses `bunx tsc` instead of `npx tsc` (Vast.ai deployment containers only have Bun installed)
- Ensures TypeScript compiler is available via Bun's package runner

**Build Command**:
```bash
bun run build:services
```

### Hot Reload

- **Frontend**: Vite HMR (instant updates)
- **Backend**: Manual restart required (or use `--watch` flag)

### Port Configuration

| Port | Service | Env Var |
|------|---------|---------|
| 3400 | Frontend UI | `ASSET_FORGE_PORT` |
| 3401 | Backend API | `ASSET_FORGE_API_PORT` |

## Troubleshooting

### ESLint Crashes

**Symptom**: `eslint . --ext .ts,.tsx` crashes with "sourceCode.getTokenOrCommentBefore is not a function"

**Cause**: `eslint-plugin-import@2.32.0` incompatible with ESLint 10

**Solution**: Use `bun run lint` (runs `eslint src` without `--ext` flag)

### TypeScript Errors in Three.js Code

**Symptom**: "Parameter 'child' implicitly has an 'any' type"

**Cause**: TypeScript strict mode requires explicit types for callback parameters

**Solution**: Add type annotations:
```typescript
import type { Object3D } from 'three';
object.traverse((child: Object3D) => { ... });
```

### Three.js WebGPU Import Errors

**Symptom**: "Cannot find module 'three/webgpu'"

**Cause**: `moduleResolution: "node"` can't resolve Three.js exports map

**Solution**: Already fixed - `tsconfig.json` uses `moduleResolution: "bundler"`

### Build Fails on Vast.ai

**Symptom**: "tsc: command not found" during `bun run build:services`

**Cause**: Vast.ai containers only have Bun installed (no npm/npx)

**Solution**: Already fixed - `scripts/build-services.mjs` uses `bunx tsc` instead of `npx tsc`

## Recent Updates (February 2026)

### VFX Catalog Browser (PR #939)
- New `/vfx` page with live Three.js effect previews
- Sidebar catalog of all game effects organized by category
- Detail panels showing colors, parameters, layers, and phase timelines
- Interactive controls for playing, pausing, and exporting effects

### TypeScript Strict Mode Fixes
- Added explicit type annotations for all traverse callbacks
- Updated `moduleResolution` to `"bundler"` for Three.js WebGPU support
- Fixed implicit `any` types throughout codebase

### ESLint Configuration
- Disabled incompatible `import/order` rule (eslint-plugin-import@2.32.0 + ESLint 10)
- Updated lint command to use `eslint src` (removed deprecated `--ext` flag)

### Build System
- Updated `build-services.mjs` to use `bunx tsc` for Vast.ai compatibility
- Ensures TypeScript compiler available via Bun's package runner

### Database Integration
- Added SQLite database via Drizzle ORM
- Asset metadata persistence
- Generation history tracking
- Migration system for schema updates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `bun test && bun run lint`
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built for the Hyperscape RPG project
- Powered by OpenAI and Meshy.ai APIs
- Uses Three.js (WebGPU) for 3D visualization
- VFX catalog inspired by Unity VFX Graph and Unreal Niagara

## Related Documentation

- **Main Project**: `../../README.md`
- **Development Guide**: `../../CLAUDE.md`
- **VFX System**: `src/data/vfx-catalog.ts`
- **Database Schema**: `server/db/schema/`
