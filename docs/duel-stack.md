# Duel Stack (`bun run duel`)

`bun run duel` now boots the end-to-end agent duel arena stack:

1. Game server + client (streaming duel scheduler enabled)
2. Duel matchmaker bots (`dev:duel:skip-dev`)
3. RTMP bridge fanout to public platforms (Twitch/Kick/X)
4. Betting app (testnet mode)
5. Keeper bot (testnet automation)

## Run

```bash
bun run duel
```

`bun run duel` now bootstraps streaming prerequisites automatically on first run:
- uses bundled `ffmpeg-static` binary by default (or `FFMPEG_PATH` if provided)
- auto-installs Playwright Chromium if the bundled browser is missing

No separate Docker stream container is required for stream fanout.

Recommended fresh-install prep command:

```bash
bun run install
```

This ensures assets are synced and Chromium is installed for local capture.

Optional flags:

```bash
bun run duel --bots=6 --betting-port=4179 --rtmp-port=8765
bun run duel --skip-keeper
bun run duel --skip-stream
bun run duel --verify
```

## Production Client Build (Streaming Optimization)

**Problem**: Vite's dev server uses on-demand JIT compilation, which can take 60-180 seconds to load the game page. This causes browser timeout issues in the RTMP bridge.

**Solution**: When `NODE_ENV=production` or `DUEL_USE_PRODUCTION_CLIENT=true`, the duel stack serves the pre-built client via `vite preview` instead of the dev server.

### Configuration

Set in `.env` or environment:

```bash
# Enable production client build for streaming
DUEL_USE_PRODUCTION_CLIENT=true

# Or set NODE_ENV to production
NODE_ENV=production
```

### Benefits

- **Faster page loads**: Pre-built client loads in <5 seconds (vs 60-180s for dev server)
- **No browser timeouts**: RTMP bridge can load game page within 180s timeout
- **Consistent performance**: No JIT compilation overhead during streaming
- **Production-ready**: Same build used in production deployments

### Build Process

The duel stack automatically:
1. Builds the client if not already built: `bun run build:client`
2. Starts `vite preview` instead of `vite dev`
3. Serves pre-built assets from `packages/client/dist/`

### Troubleshooting

If the production client fails to load:

```bash
# Rebuild client manually
cd packages/client
bun run build

# Verify build output exists
ls -la dist/

# Check for build errors
bun run build 2>&1 | grep -i error
```

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

- `RTMP_MULTIPLEXER_URL` (+ optional `RTMP_MULTIPLEXER_STREAM_KEY`, `RTMP_MULTIPLEXER_NAME`)
- `TWITCH_STREAM_KEY` (or `TWITCH_RTMP_STREAM_KEY`)
  Optional ingest override: `TWITCH_STREAM_URL` / `TWITCH_RTMP_URL` / `TWITCH_RTMP_SERVER`
- `YOUTUBE_STREAM_KEY` (or `YOUTUBE_RTMP_STREAM_KEY`) - **Disabled by default**
  Optional ingest override: `YOUTUBE_STREAM_URL` / `YOUTUBE_RTMP_URL`
- `KICK_STREAM_KEY` (+ optional `KICK_RTMP_URL`)
- `PUMPFUN_RTMP_URL` (+ optional `PUMPFUN_STREAM_KEY`)
- `X_RTMP_URL` (+ optional `X_STREAM_KEY`)
- `RTMP_DESTINATIONS_JSON` for additional/custom fanout destinations
- `STREAMING_VIEWER_ACCESS_TOKEN` optional gate for live WebSocket stream/spectator viewers

### Audio Capture

Audio streaming is enabled by default via PulseAudio:

```bash
# Enable/disable audio capture
STREAM_AUDIO_ENABLED=true

# PulseAudio monitor device
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# PulseAudio server socket
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native

# PulseAudio runtime directory
XDG_RUNTIME_DIR=/tmp/pulse-runtime
```

The deploy script automatically:
1. Installs PulseAudio
2. Creates `chrome_audio` virtual sink
3. Configures Chrome to output to PulseAudio
4. Configures FFmpeg to capture from PulseAudio monitor

### Video Encoding

Configure encoding settings:

```bash
# Video bitrate (default: 4500000 = 4.5 Mbps)
STREAM_BITRATE=4500000

# FFmpeg buffer size (default: 4x bitrate)
STREAM_BUFFER_SIZE=18000000

# x264 preset (ultrafast, veryfast, faster, fast, medium, slow)
STREAM_PRESET=medium

# Low-latency mode (enables zerolatency tune, disables B-frames)
STREAM_LOW_LATENCY=false

# GOP size (keyframe interval in frames, default: 60 = 2s at 30fps)
STREAM_GOP_SIZE=60

# Stream resolution (must be even numbers)
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Target frame rate
STREAM_FPS=30
```

### Capture Modes

The RTMP bridge supports multiple capture modes:

1. **CDP (Chrome DevTools Protocol)** - Default, fastest, most reliable
   - Uses Chrome's built-in screencast API
   - JPEG quality configurable via `STREAM_CDP_QUALITY` (1-100, default: 80)
   - Automatic resolution tracking and viewport recovery
   - 5s timeout on probe evaluate calls to prevent hanging
   - Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)

2. **WebCodecs** - Experimental, native VideoEncoder API
   - Uses browser's native video encoding
   - May have better performance on some systems
   - Set `STREAM_CAPTURE_MODE=webcodecs`

3. **MediaRecorder** - Legacy fallback
   - Browser's MediaRecorder API
   - Set `STREAM_CAPTURE_MODE=mediarecorder`

### Capture Reliability

The capture system includes automatic recovery:

- **Resolution Mismatch Detection**: Tracks CDP frame resolution vs expected dimensions
- **Viewport Recovery**: Automatically restores viewport when resolution mismatch persists
- **Probe Timeouts**: 5s timeout on browser readiness checks
- **Unresponsive Browser Handling**: Proceeds with capture after 5 consecutive probe timeouts
- **Page Load Timeout**: 180s timeout for Vite dev mode compatibility (use production client to avoid)

### Anti-Cheat Timing

Default anti-cheat timing policy (no env required):

- Canonical platform: `twitch` (changed from `youtube` for lower latency)
- Default public delay: `12000ms` for Twitch, `15000ms` for YouTube
- Optional: `STREAMING_CANONICAL_PLATFORM` (`youtube` | `twitch` | `hls`)
- Optional override: `STREAMING_PUBLIC_DELAY_MS`

Optional client-side extra delay (usually keep `0` if server delay is enabled):

- `VITE_UI_SYNC_DELAY_MS`

Website/betting embed input (recommended):

- `NEXT_PUBLIC_ARENA_STREAM_EMBED_URL` (in `packages/website/.env.local`)
- `VITE_STREAM_EMBED_URL` (in `packages/gold-betting-demo/app/.env*`)

When `STREAMING_PUBLIC_DELAY_MS > 0`, live `mode=streaming` WebSocket viewers are restricted to:
- loopback/local capture clients, or
- clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when `STREAMING_VIEWER_ACCESS_TOKEN` is set.

## GPU Rendering (Vast.ai)

**CRITICAL**: WebGPU requires a display server. Headless mode does NOT work.

### Rendering Modes

The deploy script tries rendering modes in order:

1. **Xorg with NVIDIA** (preferred):
   - Direct GPU access via DRI/DRM devices
   - Best performance
   - Requires `/dev/dri/card0` or similar
   - Uses `--disable-gpu-sandbox` and `--disable-setuid-sandbox` for container GPU access

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer provides X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - Works in containers without DRM access
   - Uses `--disable-gpu-sandbox` for container GPU access

3. **Ozone Headless with GPU** (experimental):
   - Uses `--ozone-platform=headless` for Wayland-like headless rendering
   - Enabled via `STREAM_CAPTURE_OZONE_HEADLESS=true`
   - May work on systems where X11/Xvfb fails but GPU is accessible
   - Requires `--disable-gpu-sandbox` for container GPU access

4. **Headless mode (software)**: NOT SUPPORTED
   - Deployment fails if no GPU-capable mode can be established
   - WebGPU requires GPU rendering

### Environment Variables (Auto-Configured)

The deploy script automatically sets:

```bash
DISPLAY=:99                                              # X display
GPU_RENDERING_MODE=xorg|xvfb-vulkan|ozone-headless      # Rendering mode
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json # Force NVIDIA Vulkan
DUEL_CAPTURE_USE_XVFB=true|false                        # Xvfb vs Xorg
STREAM_CAPTURE_HEADLESS=false                           # Always false (WebGPU requires display)
STREAM_CAPTURE_OZONE_HEADLESS=true|false                # Ozone headless mode (experimental)
STREAM_CAPTURE_EXECUTABLE=/path/to/chrome               # Custom Chrome executable
XDG_RUNTIME_DIR=/tmp/pulse-runtime                      # PulseAudio runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native       # PulseAudio socket
```

### Troubleshooting GPU Issues

If streaming produces black frames or fails to start:

```bash
# Check GPU access
nvidia-smi

# Check Vulkan support
vulkaninfo --summary

# Verify display server
echo $DISPLAY
xdpyinfo -display $DISPLAY

# Check PulseAudio
pulseaudio --check
pactl list short sinks

# Review deployment logs
bunx pm2 logs hyperscape-duel --lines 200

# Check RTMP status
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

See `scripts/deploy-vast.sh` for complete deployment logic.

## Spectator + Betting URLs

- Game stream view: `http://localhost:3333/?page=stream`
- Embedded spectator: `http://localhost:3333/?embedded=true&mode=spectator`
- Betting app: `http://localhost:4179`
- Betting video source: `VITE_STREAM_EMBED_URL` (YouTube/Twitch embed URL)

## Open APIs (duel telemetry + monologues)

- `GET /api/streaming/state`
- `GET /api/streaming/duel-context`
- `GET /api/streaming/agent/:characterId/inventory`
- `GET /api/streaming/agent/:characterId/monologues?limit=20`

These endpoints power the betting app live duel telemetry section (inventory, wins/losses, level, HP, and internal monologues).

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,kick
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## PM2 Production Deployment (Vast.ai)

For production deployment on Vast.ai, use PM2 with the ecosystem config:

```bash
# Deploy via GitHub Actions
# Workflow: .github/workflows/deploy-vast.yml
# Triggers on push to main branch

# Manual deployment
ssh root@vast-instance
cd /root/hyperscape
./scripts/deploy-vast.sh
```

The deploy script:
1. Pulls latest code from main
2. Installs system dependencies (FFmpeg, PulseAudio, Vulkan, Chrome Dev)
3. Configures GPU rendering (Xorg or Xvfb)
4. Sets up PulseAudio for audio capture
5. Builds core packages
6. Pushes database schema
7. Starts duel stack via PM2

### PM2 Commands

```bash
# View logs
bunx pm2 logs hyperscape-duel

# Restart stack
bunx pm2 restart hyperscape-duel

# Stop stack
bunx pm2 stop hyperscape-duel

# View status
bunx pm2 status

# Monitor resources
bunx pm2 monit
```

### Health Monitoring

The deploy script waits for server health check:

```bash
# Check server health
curl http://localhost:5555/health

# Check streaming status
curl http://localhost:5555/api/streaming/state

# Check RTMP status file
cat /root/hyperscape/packages/server/public/live/rtmp-status.json
```

## Environment Variables Reference

See `.env.example` for complete list of streaming configuration options.

### Required for Streaming

```bash
# At least one stream destination
TWITCH_STREAM_KEY=live_123456789_abcdefghij
# OR
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
# OR
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
```

### Required for Production

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
JWT_SECRET=your-jwt-secret

# Solana (for on-chain features)
SOLANA_DEPLOYER_PRIVATE_KEY=your-base58-key
```

### Optional Optimizations

```bash
# Use production client build (recommended)
DUEL_USE_PRODUCTION_CLIENT=true

# Disable YouTube streaming (enabled by default)
YOUTUBE_STREAM_KEY=

# Custom FFmpeg path
FFMPEG_PATH=/usr/bin/ffmpeg

# Custom browser executable
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - WebGPU requirements and troubleshooting
- [AGENTS.md](../AGENTS.md) - AI assistant WebGPU guidelines
- [.env.example](../.env.example) - Complete environment variable reference
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
- [ecosystem.config.cjs](../ecosystem.config.cjs) - PM2 configuration
