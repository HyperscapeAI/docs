# Hyperscape Server

Production-ready game server for Hyperscape 3D multiplayer worlds with PostgreSQL backend and GPU-accelerated streaming.

## ✅ Status: FULLY OPERATIONAL

The server has been successfully migrated to PostgreSQL and is production-ready with:
- PostgreSQL database with automatic migrations
- 54 mobs + 5 NPCs spawning at startup  
- Character creation and multi-character support
- Complete persistence layer (inventory, equipment, skills, position)
- Real-time multiplayer via WebSocket
- Multi-platform RTMP streaming (Twitch, Kick, X/Twitter)
- WebGPU-accelerated rendering with automatic recovery
- 15 registered game actions

## Features

- **PostgreSQL Database** - Full persistence with automatic migrations
- **WebSocket Support** - Real-time multiplayer via Fastify WebSockets
- **GPU Streaming** - Multi-platform RTMP streaming with WebGPU rendering
- **Stream Capture Modes** - CDP (default), WebCodecs (experimental), MediaRecorder (legacy)
- **Automatic Recovery** - Viewport restoration, probe timeouts, soft/hard recovery
- **Docker Integration** - Automatic local PostgreSQL via Docker (optional)
- **Asset Serving** - Efficient static asset delivery
- **Character System** - Multi-character support per account
- **Authentication** - Optional Privy authentication with Farcaster support
- **LiveKit Voice** - Optional voice chat integration

## Quick Start

### Prerequisites

- **Bun** (recommended) or Node.js 22+
- **Docker Desktop** (for local PostgreSQL) OR external PostgreSQL instance
- **For GPU Streaming**: NVIDIA GPU with Vulkan support, Xorg/Xvfb, PulseAudio, FFmpeg

### Installation

```bash
cd packages/server
bun install
```

### Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

**Option 1: Local PostgreSQL (Docker)**
```env
USE_LOCAL_POSTGRES=true
# Docker will automatically start PostgreSQL
```

**Option 2: External PostgreSQL**
```env
DATABASE_URL=postgresql://user:pass@host:5488/dbname
USE_LOCAL_POSTGRES=false
```

### Running

**Development:**
```bash
bun run dev
```
This automatically starts:
- CDN Server (nginx on port 8080) - via Docker
- Game Server (Fastify on port 5555)
- Client (Vite on port 3333)

**Production Build:**
```bash
bun run build
bun run start
```

**GPU Streaming:**
```bash
# Start RTMP streaming to configured platforms
bun run stream:rtmp

# Or use PM2 for production
pm2 start ecosystem.config.cjs
```

### CDN Server

The development script automatically manages a local CDN server via Docker:

**Automatic Management:**
- Starts when you run `bun run dev`
- Stops when you exit the dev server (Ctrl+C)
- Serves game assets from `../../assets/` on port 8080
- Health check at `http://localhost:8080/health`

**Manual CDN Management:**
```bash
# Start CDN only
bun run cdn:up

# Stop CDN
bun run cdn:down

# View CDN logs
bun run cdn:logs

# Verify CDN is working
bun run cdn:verify
```

**Requirements:**
- Docker Desktop must be installed and running
- If Docker is not available, the dev script will skip CDN startup and warn you

**Asset Access:**
- All assets served directly from CDN: `http://localhost:8080/assets/world/music/normal/1.mp3`
- No proxying - client fetches directly from CDN

## Database

### PostgreSQL Setup

The server uses PostgreSQL with automatic migrations. On first run:

1. If `USE_LOCAL_POSTGRES=true`, Docker will start a PostgreSQL container
2. Migrations run automatically on startup
3. Tables are created: users, characters, players, inventory, equipment, etc.

### Manual Database Operations

**Connect to local PostgreSQL:**
```bash
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
```

**Backup database:**
```bash
docker exec hyperscape-postgres pg_dump -U hyperscape hyperscape > backup.sql
```

**Restore database:**
```bash
cat backup.sql | docker exec -i hyperscape-postgres psql -U hyperscape hyperscape
```

### Migrations

Migrations are defined in `src/database/migrations/` and run automatically on server start using Drizzle ORM.

## GPU Streaming

### Architecture

Hyperscape streams live gameplay to multiple platforms using GPU-accelerated rendering:

**Capture Pipeline:**
```
Chrome (WebGPU) → CDP Screencast → FFmpeg (H.264) → RTMP Tee Muxer → Twitch/Kick/X
```

**Capture Modes:**
1. **CDP (default)** - Chrome DevTools Protocol screencast
   - Fastest and most reliable
   - Direct JPEG frame piping to FFmpeg
   - ~2-3x faster than MediaRecorder
   - Automatic viewport recovery on resolution mismatch

2. **WebCodecs (experimental)** - Native VideoEncoder API
   - Uses browser's hardware encoder
   - FFmpeg stream copy (no re-encoding)
   - Falls back to CDP if initialization fails

3. **MediaRecorder (legacy)** - WebRTC MediaRecorder API
   - Fallback mode for compatibility
   - Higher CPU usage due to double encoding

**Audio Capture:**
- PulseAudio virtual sink (`chrome_audio`)
- FFmpeg captures from monitor (`chrome_audio.monitor`)
- Async resampling with buffering

**Multi-Platform Streaming:**
- FFmpeg tee muxer for single-encode multi-output
- Simultaneous streaming to Twitch, Kick, X/Twitter
- YouTube explicitly disabled
- Stream keys from environment variables (never hardcoded)

### Configuration

**Stream Capture:**
```env
# Capture mode
STREAM_CAPTURE_MODE=cdp                    # cdp, webcodecs, mediarecorder

# Resolution (must be even numbers)
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Frame rate
STREAM_FPS=30

# JPEG quality for CDP mode (1-100)
STREAM_CDP_QUALITY=80
```

**Stream Encoding:**
```env
# Encoding optimization
STREAM_LOW_LATENCY=false                   # false = film tune, true = zerolatency
STREAM_GOP_SIZE=60                         # Keyframe interval (frames)

# Audio
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor
```

**Stream Destinations:**
```env
# Twitch
TWITCH_STREAM_KEY=live_...

# Kick (RTMPS)
KICK_STREAM_KEY=...
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app

# X/Twitter
X_STREAM_KEY=...
X_RTMP_URL=rtmp://sg.pscp.tv:80/x

# YouTube (disabled)
YOUTUBE_STREAM_KEY=""
```

**Recovery Settings:**
```env
# Timeout for recovery operations (ms)
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000

# Max failures before fallback to MediaRecorder
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6
```

**GPU Configuration** (auto-configured by `scripts/deploy-vast.sh`):
```env
# Display server
DISPLAY=:99                                # :0 for Xorg, :99 for Xvfb
GPU_RENDERING_MODE=xorg                    # xorg, xvfb-vulkan, ozone-headless
DUEL_CAPTURE_USE_XVFB=false               # true for Xvfb, false for Xorg

# Vulkan
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Browser
STREAM_CAPTURE_CHANNEL=chrome-dev          # Playwright channel
STREAM_CAPTURE_HEADLESS=false              # Always false - WebGPU requires display

# PulseAudio
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

**Production Client:**
```env
# Use pre-built client for faster page loads (fixes 180s timeout)
DUEL_USE_PRODUCTION_CLIENT=true
```

### Deployment (Vast.ai)

GPU streaming requires specific hardware and configuration:

**Requirements:**
- NVIDIA GPU with Vulkan support
- Xorg or Xvfb display server (headless NOT supported)
- PulseAudio for audio capture
- FFmpeg for H.264 encoding
- Chrome Dev channel with WebGPU enabled

**Deployment Script:**
```bash
# Automatic deployment via GitHub Actions
# See .github/workflows/deploy-vast.yml

# Manual deployment
ssh root@<vast-instance-ip>
cd /root/hyperscape
./scripts/deploy-vast.sh
```

**Validation Steps:**
1. Verify NVIDIA GPU: `nvidia-smi`
2. Check Vulkan ICD: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
3. Test display server: `xdpyinfo -display $DISPLAY`
4. Verify PulseAudio: `pactl list short sinks`
5. Run WebGPU preflight test (automatic in deploy script)
6. Extract GPU diagnostics from chrome://gpu (automatic)

**Troubleshooting:**
```bash
# Check PM2 logs
pm2 logs hyperscape-duel --lines 200

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# Check WebGPU diagnostics
pm2 logs hyperscape-duel --lines 500 | grep -A 20 "GPU Diagnostics"

# Common issues:
# - Black frames: WebGPU failed to initialize
# - Browser hangs: WebGPU initialization timeout (capture proceeds after 5 timeouts)
# - Timeout on page load: Use DUEL_USE_PRODUCTION_CLIENT=true
# - Resolution mismatch: Auto-recovery enabled, check viewport logs
```

See `scripts/deploy-vast.sh` for complete deployment logic.

### Stream Health Monitoring

**Automatic Recovery:**
- **Soft recovery**: Restart CDP screencast without killing browser (~2-3s, no gap)
- **Hard recovery**: Full browser teardown and restart (~10-15s, visible gap)
- **Fallback**: Switch to MediaRecorder mode after max CDP failures

**Resolution Tracking:**
- Detects viewport size mismatches
- Automatic viewport restoration after 10 consecutive mismatched frames
- Logs resolution changes for debugging

**Probe Timeouts:**
- 5s timeout on page evaluate calls
- Proceeds with capture after 5 consecutive timeouts
- Prevents hanging when browser is unresponsive

**WebGPU Diagnostics:**
- Preflight test on blank page before loading game
- Extracts chrome://gpu info at startup
- 30s adapter timeout, 60s renderer init timeout
- Helps diagnose GPU driver and display configuration issues

## Architecture

### Core Systems

**ServerNetwork** (`src/systems/ServerNetwork/`)
- WebSocket connection handling
- Player spawning and lifecycle
- Character selection flow
- Message routing and broadcasting

**DatabaseSystem** (`src/systems/DatabaseSystem/`)
- PostgreSQL connection management
- Character CRUD operations
- Player data persistence
- Inventory and equipment management

**StreamingDuelScheduler** (`src/systems/StreamingDuelScheduler/`)
- Automated duel matchmaking for streams
- Camera director for cinematic views
- RTMP capture and broadcast
- Cycle state machine for duel phases

**Streaming System** (`src/streaming/`)
- `stream-capture.ts` - Main capture orchestrator
- `browser-capture.ts` - Chrome CDP integration
- `browser-capture-webcodecs.ts` - WebCodecs encoder
- `rtmp-bridge.ts` - FFmpeg RTMP encoder with tee muxer

### Character System

The server supports multiple characters per account:

1. **Account** - Identified by Privy user ID or legacy user ID
2. **Character** - Each account can have multiple characters
3. **Player Session** - Character becomes "player" when spawned in world

**Flow:**
```
Login → Character List → Select/Create Character → Enter World → Spawn as Player
```

## API Endpoints

### Health & Status

- `GET /health` - Health check (for load balancers)
- `GET /status` - Detailed server status with player count

### Assets

- `GET /*` - Game assets (models, textures, audio)
- `GET /assets/*` - Legacy asset path (backward compatible)

### WebSocket

- `GET /ws` - WebSocket connection for real-time gameplay

### Actions (HTTP API)

- `GET /api/actions` - List all available actions
- `GET /api/actions/available` - Get actions available to player
- `POST /api/actions/:name` - Execute specific action

### Streaming

- `GET /api/streaming/status` - Stream health and uptime
- `GET /api/streaming/state` - Current duel state
- `GET /api/streaming/state/events` - SSE stream of state updates

### Utility

- `GET /env.js` - Public environment variables for client
- `POST /api/upload` - Upload user assets (VRM, textures)
- `GET /api/upload-check` - Check if asset exists

## Environment Variables

See `.env.example` for complete list. Key variables:

### Required

```env
PORT=5555                    # Server port
WORLD=world                   # World directory path
DATABASE_URL=postgresql://... # PostgreSQL connection (production)
```

### Streaming (Optional)

```env
# Capture mode
STREAM_CAPTURE_MODE=cdp                    # cdp, webcodecs, mediarecorder
STREAM_CAPTURE_WIDTH=1280                  # Stream width
STREAM_CAPTURE_HEIGHT=720                  # Stream height
STREAM_FPS=30                              # Target FPS
STREAM_CDP_QUALITY=80                      # JPEG quality (1-100)

# Encoding
STREAM_LOW_LATENCY=false                   # false = film, true = zerolatency
STREAM_GOP_SIZE=60                         # Keyframe interval

# Audio
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# Destinations
TWITCH_STREAM_KEY=live_...
KICK_STREAM_KEY=...
X_STREAM_KEY=...
YOUTUBE_STREAM_KEY=""                      # Disabled

# Recovery
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6
```

### GPU Configuration (Vast.ai)

Auto-configured by `scripts/deploy-vast.sh`:

```env
DISPLAY=:99                                # X display
GPU_RENDERING_MODE=xorg                    # Rendering mode
DUEL_CAPTURE_USE_XVFB=false               # Xvfb vs Xorg
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
STREAM_CAPTURE_CHANNEL=chrome-dev
STREAM_CAPTURE_HEADLESS=false              # Always false
DUEL_USE_PRODUCTION_CLIENT=true           # Pre-built client
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t hyperscape-server .
docker run -p 5555:5555 \
  -e DATABASE_URL=postgresql://... \
  hyperscape-server
```

### Vast.ai (GPU Streaming)

Deploy to Vast.ai for GPU-accelerated streaming:

```bash
# Automatic via GitHub Actions
# See .github/workflows/deploy-vast.yml

# Manual deployment
ssh root@<vast-instance-ip>
cd /root/hyperscape
./scripts/deploy-vast.sh
```

**Validation:**
1. NVIDIA GPU accessible: `nvidia-smi`
2. Vulkan ICD available: `cat /usr/share/vulkan/icd.d/nvidia_icd.json`
3. Display server running: `xdpyinfo -display $DISPLAY`
4. PulseAudio running: `pactl list short sinks`
5. WebGPU preflight test passes (automatic)
6. GPU diagnostics extracted (automatic)

**Monitoring:**
```bash
# PM2 logs
pm2 logs hyperscape-duel --lines 200

# RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json

# WebGPU diagnostics
pm2 logs hyperscape-duel --lines 500 | grep -A 20 "GPU Diagnostics"
```

### Traditional Hosting

Requirements:
- Node.js 22+ or Bun runtime
- PostgreSQL 16+ (local or managed)
- Reverse proxy (nginx, caddy) for SSL

```bash
# Build
bun run build

# Run with process manager
pm2 start dist/index.js --name hyperscape-server
```

### Environment-Specific

**Staging:**
```bash
NODE_ENV=staging bun run start
```

**Production:**
```bash
NODE_ENV=production bun run start
```

## Troubleshooting

### PostgreSQL Connection Failed

**Error:** `ECONNREFUSED` or connection timeout

**Solutions:**
1. Check if Docker is running: `docker ps`
2. Start PostgreSQL: `docker-compose up postgres`
3. Check connection string in .env
4. Verify firewall allows port 5488

### Database Migration Errors

**Error:** Column already exists

**Solution:** This is usually safe to ignore. The migrations use `IF NOT EXISTS` and `ON CONFLICT` to handle re-runs.

**Error:** Foreign key constraint violation

**Solution:** 
```sql
-- Connect to database
docker exec -it hyperscape-postgres psql -U hyperscape hyperscape

-- Drop all tables and re-run migrations
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
```
Then restart the server.

### Streaming Issues

**Black frames or no video:**
1. Check GPU access: `nvidia-smi`
2. Verify Vulkan: `vulkaninfo --summary`
3. Check display: `xdpyinfo -display $DISPLAY`
4. Review WebGPU diagnostics in logs

**Browser hangs on page load:**
- Use production client build: `DUEL_USE_PRODUCTION_CLIENT=true`
- Check WebGPU preflight test logs
- Capture proceeds after 5 consecutive probe timeouts

**Resolution mismatch:**
- Auto-recovery enabled after 10 consecutive mismatched frames
- Check viewport restoration logs
- Verify `STREAM_CAPTURE_WIDTH` and `STREAM_CAPTURE_HEIGHT`

**No audio:**
1. Check PulseAudio: `pulseaudio --check`
2. Verify sink: `pactl list short sinks | grep chrome_audio`
3. Check `PULSE_AUDIO_DEVICE` and `PULSE_SERVER` env vars

**Stream keeps restarting:**
- Increase stability thresholds:
  ```env
  STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=45000
  STREAM_CAPTURE_RECOVERY_MAX_FAILURES=8
  ```
- Check FFmpeg logs for encoding errors
- Verify RTMP destination is reachable

**CDP stalls (no traffic):**
- Soft recovery attempts after 4 intervals without traffic
- Hard recovery after soft recovery fails
- Falls back to MediaRecorder after max failures
- Check logs for recovery attempts

### Docker Issues

**Error:** Docker daemon not running

**Solution:**
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop
3. Restart server

**Alternative:** Use external PostgreSQL instead:
```env
DATABASE_URL=postgresql://user:pass@host:5488/dbname
USE_LOCAL_POSTGRES=false
```

## Development

### Code Structure

```
src/
├── index.ts                      # Main server entry point
├── systems/
│   ├── ServerNetwork/            # Network layer & player lifecycle
│   ├── DatabaseSystem/           # Database operations
│   ├── StreamingDuelScheduler/   # Automated duel streaming
│   └── DuelSystem/               # Duel mechanics
├── streaming/                    # RTMP streaming system
│   ├── stream-capture.ts         # Main capture orchestrator
│   ├── browser-capture.ts        # CDP screencast integration
│   ├── browser-capture-webcodecs.ts # WebCodecs encoder
│   └── rtmp-bridge.ts            # FFmpeg RTMP encoder
├── database/                     # Database layer
│   ├── client.ts                 # Connection pooling
│   ├── schema.ts                 # Drizzle schema
│   └── migrations/               # SQL migrations
└── scripts/
    └── stream-to-rtmp.ts         # Standalone streaming script
```

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint
```

### Building

```bash
bun run build
```

Output: `dist/index.js` (bundled server)

## Performance

### Database Connection Pool

- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 5s

Adjust in `src/database/client.ts` if needed.

### Asset Caching

Assets are served with aggressive caching:
```
Cache-Control: public, max-age=31536000, immutable
```

For development, disable browser cache or use incognito mode.

### Streaming Performance

- **Soft recovery**: ~2-3 seconds (no visible gap)
- **Hard recovery**: ~10-15 seconds (visible gap)
- **CPU usage**: ~15-25% during active streaming
- **Memory**: ~500 MB baseline + ~50 MB per stream
- **GPU usage**: ~30-50% (WebGPU rendering + H.264 encoding)

## Security

### Authentication

Optional Privy authentication provides:
- Wallet-based login
- Farcaster Frame v2 support
- Account-to-character linking

### Admin Access

Admin commands require:
1. `ADMIN_CODE` set in environment
2. `/admin <code>` command in chat

### Database

- Use strong PostgreSQL passwords in production
- Restrict database access to server IP
- Enable SSL for remote PostgreSQL connections

### Streaming Secrets

- **NEVER hardcode stream keys** - use environment variables
- Set via GitHub Secrets for CI/CD
- Store in `.env` file for local development (gitignored)
- All secrets removed from `ecosystem.config.cjs` (commit 47167b6)

### Rate Limiting

Not implemented yet. Consider adding:
- Connection rate limiting (websocket)
- API endpoint rate limiting
- Upload size limits (currently 50MB)

## Support

- **Documentation:** See [CLAUDE.md](../../CLAUDE.md) for development guide
- **Streaming Guide:** See [AGENTS.md](../../AGENTS.md) for GPU streaming architecture
- **Issues:** Report bugs in the main Hyperscape repository

## License

GPL-3.0-only - See LICENSE file
