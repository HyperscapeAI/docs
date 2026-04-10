# AssetForge

AI-powered 3D asset generation and armor pipeline for Hyperscape. Built with React, Vite, and Elysia, this system combines OpenAI, Meshy AI, and Tripo 3D to create game-ready 3D models from text descriptions.

## Features

### 🎨 **AI-Powered Asset Generation**
- Generate 3D models from text descriptions using GPT-4 and Meshy.ai
- Automatic concept art creation with DALL-E
- Support for various asset types: weapons, armor, characters, items
- Material variant generation (bronze, steel, mithril, etc.)
- Batch generation capabilities

### 🛡️ **Armor Pipeline (POC3)**
Complete armor generation pipeline from VRM avatar to game-ready GLB:

**Shell Extraction**:
- Extract body-fitting armor shells from VRM avatars by bone weight analysis
- Marching triangles algorithm for smooth slot boundaries
- Curvature-adaptive offset with body-constrained Laplacian smoothing
- Multiple bulk classes: skin (1mm), cloth (5mm), leather (12mm), plate (30mm)
- UV seam bridging to prevent cracks

**AI Texturing**:
- **Meshy Pipeline**: Upload shell as base64 data URI, retexture with text prompts or style reference images
- **Tripo Pipeline**: Segment → per-part texture → reassemble workflow with STS S3 upload
- **Batch Tier Generation**: Generate all 8 OSRS tiers (bronze → dragon) in one click
- **Material Presets**: OSRS solid colors + fantasy detailed styles
- **Detail Levels**: Plain → Minimal → Moderate → Ornate → Intricate

**Automatic Rigging**:
- Transfer bone weights from original shell to textured mesh
- Fast path (vertex count match) or fallback (nearest-vertex transfer)
- Full skeleton export with original bone indices preserved
- Publish to game model directory + update armor manifest

**3D Bone Attachments** (Tripo):
- Generate 3D armor pieces from text prompts (pauldrons, crests, guards)
- Parent to VRM skeleton bones with position/rotation/scale controls
- Text-to-model generation for unique armor pieces

### 🎮 **3D Asset Management**
- Interactive 3D viewer with Three.js WebGPU renderer
- Asset library with categorization and filtering
- Metadata management and asset organization
- GLB/GLTF format support

### 🔧 **Processing Tools**
- Sprite generation from 3D models
- Vertex color extraction
- T-pose extraction from animated models
- Asset normalization and optimization
- Procedural terrain/vegetation generation

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8.0
- **3D Graphics**: Three.js 0.183.2 (WebGPU), OrbitControls
- **Backend**: Elysia (Bun), Node.js 22+
- **AI Integration**: OpenAI API, Meshy AI, Tripo 3D
- **3D Processing**: @gltf-transform/core, @pixiv/three-vrm
- **Styling**: Tailwind CSS 4.1.14
- **Build Tool**: Bun 1.3.10+

## Getting Started

### Prerequisites
- Bun 1.3.10+ (for client/build tasks)
- Node.js 22+ (for server runtime)
- API keys for OpenAI, Meshy AI, and/or Tripo 3D

### Installation

1. Install dependencies from monorepo root:
```bash
bun install
```

2. Create `.env` file:
```bash
cp packages/asset-forge/.env.example packages/asset-forge/.env
```

3. Add your API keys to `.env`:
```bash
# Required for AI texturing
MESHY_API_KEY=your_meshy_api_key

# Required for Tripo pipeline
TRIPO_API_KEY=your_tripo_api_key

# Required for text generation
OPENAI_API_KEY=your_openai_api_key
# OR
AI_GATEWAY_API_KEY=your_vercel_api_key
```

### Running the Application

From monorepo root:
```bash
bun run dev:forge       # AssetForge only (ports 3400, 3401)
# OR
bun run dev:with-forge  # Game + AssetForge (client + server + forge)
```

The app will be available at `http://localhost:3400`

## Project Structure

```
asset-forge/
├── src/                          # React application source
│   ├── components/
│   │   └── ArmorPipeline/       # Armor pipeline UI components
│   │       ├── ShellGeneratorTab.tsx      # Shell extraction
│   │       ├── TextureGeneratorTab.tsx    # AI texturing
│   │       ├── TierGeneratorTab.tsx       # Batch tier generation
│   │       ├── TripoGeneratorTab.tsx      # Tripo experimental pipeline
│   │       ├── ArmorPreviewTab.tsx        # Rigging + preview
│   │       └── ShellPreviewViewer.tsx     # WebGPU 3D viewer
│   ├── services/
│   │   └── armor-pipeline/      # Armor pipeline services
│   │       ├── ShellExtractionService.ts  # Shell extraction (2,058 lines)
│   │       ├── ShellRiggingService.ts     # Automatic rigging (469 lines)
│   │       ├── ArmorTextureService.ts     # Meshy client (190 lines)
│   │       ├── ArmorTripoService.ts       # Tripo client (306 lines)
│   │       ├── types.ts                   # Shared types
│   │       └── constants.ts               # Material presets, avatars
│   ├── pages/                   # Main application pages
│   └── utils/                   # Utilities
├── server/                      # Elysia backend
│   ├── api-elysia.ts           # Main API server
│   ├── routes/
│   │   ├── armor-pipeline.ts   # Meshy retexture + publish (520 lines)
│   │   └── tripo-pipeline.ts   # Tripo segment/texture/text-to-model (342 lines)
│   └── services/
│       └── armor-pipeline/
│           ├── ShellTextureService.ts  # Meshy API wrapper (300 lines)
│           └── TripoService.ts         # Tripo API wrapper (757 lines)
├── gdd-assets/                 # Generated 3D assets
├── temp-images/                # Temporary image storage
├── temp-shells/                # Temporary shell GLB storage
└── public/
    └── game-assets/avatars/    # VRM avatars (symlink to server assets)
```

## Main Features

### 1. Armor Pipeline (`/armor-pipeline`)

**Step 1: Extract** — Extract body-fitting shells from VRM avatars
- Select avatar (male/female variants)
- Choose equipment slots (helmet, body, legs, boots, gloves)
- Select bulk class (skin, cloth, leather, plate)
- View regions, single shell, or all shells
- Export shells as GLB

**Step 2: Texture** — Apply materials and AI textures
- **Solid Color**: Instant programmatic PBR materials (OSRS tier colors)
- **AI Texture**: Meshy retexture with text prompts (OSRS or fantasy presets)
- **All Tiers**: Generate all 8 OSRS tiers side-by-side for comparison
- Detail level control (plain → intricate)
- Add textured pieces to armor kit

**Step 3: Tiers** — Batch-generate bronze → dragon tier variants
- Same shell geometry, different tier textures
- Editable per-tier prompts
- Parallel Meshy API calls (~$0.20/tier, 2-5 min each)
- Preview and download individual tiers

**Step 4: Rig & Preview** — Re-rig textured armor and preview on animated avatar
- Rig all kit pieces with one click
- Preview on animated avatar (walk, run, T-pose)
- Publish to game model directory + update armor manifest
- Export rigged GLBs

**Tripo Lab** (Experimental) — Tripo AI texturing & 3D attachments
- Upload → segment → per-part texture → reassemble
- Text-to-model generation for 3D attachments
- Bone-parented attachments (pauldrons, crests, guards)
- Position/rotation/scale controls per attachment
- Session persistence for retry resilience

### 2. Asset Generation (`/generation`)
- Text-to-3D model pipeline
- Prompt enhancement with GPT-4
- Concept art generation
- 3D model creation via Meshy.ai
- Material variant generation

### 3. Asset Library (`/assets`)
- Browse and manage generated assets
- Filter by type, tier, and category
- 3D preview with rotation controls
- Export and download assets

### 4. Procedural Generators
- **Building Generator**: Procedural building generation
- **Vegetation Generator**: Tree and plant placement
- **Grass Generator**: Grass instance generation
- **Flower Generator**: Flower placement
- **Roads Generator**: Road network generation

### 5. World Builder (`/world`)
- Visual world editing
- Terrain manipulation
- Asset placement
- Export world data

## API Endpoints

### Armor Pipeline
- `POST /api/armor-pipeline/texture-shell` - Upload shell + start Meshy retexture
- `POST /api/armor-pipeline/texture-shell-batch` - Batch retexture for multiple tiers
- `GET /api/armor-pipeline/texture-status/:taskId` - Poll texture task status
- `GET /api/armor-pipeline/texture-download/:taskId` - Download textured result
- `POST /api/armor-pipeline/publish-to-game` - Publish rigged GLB to game (localhost-only)

### Tripo Pipeline
- `POST /api/tripo/upload-and-segment` - Upload → import → segment → return part names
- `POST /api/tripo/texture-part` - Texture specific parts with custom prompts
- `POST /api/tripo/complete` - Reassemble model after per-part texturing
- `POST /api/tripo/texture-shell` - Whole-model texture (no segments)
- `POST /api/tripo/text-to-model` - Generate 3D model from text prompt
- `GET /api/tripo/task/:taskId` - Poll Tripo task status
- `GET /api/tripo/download/:taskId` - Download Tripo result (proxied)
- `GET /api/tripo/balance` - Check Tripo account balance

### Legacy Endpoints
- `GET /api/assets` - List all assets
- `GET /api/assets/:id/model` - Download asset model
- `POST /api/generation/start` - Start new generation
- `POST /api/retexture/start` - Generate material variants

## Scripts

```bash
# Development
bun run dev              # Start frontend dev server (port 3400)
bun run dev:backend      # Start backend API server (port 3401)
bun run dev:all          # Start both frontend and backend

# Production
bun run build            # Build for production
bun run start            # Start production backend

# Asset Management
bun run assets:audit     # Audit asset library
bun run assets:normalize # Normalize 3D models
bun run assets:extract-tpose # Extract T-poses from models
```

## Configuration

### Environment Variables

See `.env.example` for all available options. Key variables:

```bash
# AI Services (Backend)
MESHY_API_KEY=your_meshy_api_key
TRIPO_API_KEY=your_tripo_api_key
OPENAI_API_KEY=your_openai_api_key
AI_GATEWAY_API_KEY=your_vercel_api_key  # Alternative to OpenAI

# Server Configuration
ASSET_FORGE_API_PORT=3401
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Armor Pipeline
PUBLIC_URL=https://your-server.example.com  # For Meshy shell hosting (optional)

# AI Services (Frontend - must be prefixed with VITE_)
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_MESHY_API_KEY=your_meshy_api_key
VITE_GENERATION_API_URL=/api
```

### Material Presets

The armor pipeline includes predefined material presets:

**OSRS Tiers** (solid colors with hex codes):
- Bronze (#cd7f32), Iron (#6b6b6b), Steel (#b8b8b8), Black (#2a2a2a)
- Mithril (#4a7ab5), Adamant (#2d6b3f), Rune (#3db8c4), Dragon (#8b1a1a)

**Fantasy Detailed** (AI-generated textures):
- Iron Plate, Leather, Cloth Robe, Steel Ornate, Mithril Elven, Dragon Scale

## Security

The armor pipeline includes multiple security layers:
- Path traversal prevention via `SAFE_PATH_RE` regex and `path.basename()` sanitization
- SSRF validation on download URLs (domain allowlists for Meshy/Tripo/S3)
- Localhost-only restriction on `/publish-to-game` endpoint
- Private IP blocking (RFC 1918, link-local, loopback, CGN)
- Content-Length guards (100MB max) on external downloads
- Task ID format validation before URL interpolation

## Troubleshooting

**Meshy API errors:**
- Verify `MESHY_API_KEY` is set in `.env`
- Check Meshy account balance at https://www.meshy.ai
- Review server logs for detailed error messages

**Tripo API errors:**
- Verify `TRIPO_API_KEY` is set in `.env`
- Check Tripo account balance: `GET /api/tripo/balance`
- Tripo download URLs expire quickly (60s-5min) — always re-fetch task status before downloading

**Shell extraction fails:**
- Ensure VRM avatars are in `packages/server/world/assets/avatars/`
- Create symlink: `ln -s ../../../server/world/assets/avatars packages/asset-forge/public/game-assets/avatars`
- Verify VRM file is valid (not corrupted)

**Publish to game fails:**
- Endpoint is localhost-only for security
- Verify you're running AssetForge on the same machine as the game server
- Check `packages/server/world/assets/models/` directory permissions

## License

MIT
