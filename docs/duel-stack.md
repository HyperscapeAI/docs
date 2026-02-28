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

## WebGPU Requirements

**CRITICAL**: Hyperscape requires WebGPU for rendering. WebGL will NOT work.

- All materials use TSL (Three Shading Language) which only works with WebGPU
- WebGL fallback code has been completely removed
- Deployment fails if WebGPU cannot initialize

**Browser Requirements:**
- Chrome 113+ (recommended)
- Edge 113+
- Safari 18+ (macOS 15+) - Safari 17 support removed
- Check: [webgpureport.org](https://webgpureport.org)

**Server/Streaming Requirements:**
- NVIDIA GPU with Vulkan support
- Xorg or Xvfb display server (headless mode NOT supported)
- Chrome uses ANGLE/Vulkan backend for WebGPU
- `--disable-gpu-sandbox` and `--disable-setuid-sandbox` required for container GPU access

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

- `TWITCH_STREAM_KEY` (or `TWITCH_RTMP_STREAM_KEY`)
  Optional ingest override: `TWITCH_STREAM_URL` / `TWITCH_RTMP_URL` / `TWITCH_RTMP_SERVER`
- `KICK_STREAM_KEY` (+ optional `KICK_RTMP_URL`)
- `X_STREAM_KEY` (+ optional `X_RTMP_URL`)
- `YOUTUBE_STREAM_KEY=""` (explicitly disabled - set to empty string)
- `RTMP_DESTINATIONS_JSON` for additional/custom fanout destinations
- `STREAMING_VIEWER_ACCESS_TOKEN` optional gate for live WebSocket stream/spectator viewers

**BREAKING CHANGE**: All stream keys must be set via environment variables. Hardcoded secrets have been removed from `ecosystem.config.cjs`.

Default anti-cheat timing policy (no env required):

- Canonical platform: `twitch` (changed from `youtube`)
- Default public delay: `0ms` (changed from `15000ms`)
- Optional: `STREAMING_CANONICAL_PLATFORM` (`youtube` | `twitch`)
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

## Stream Capture Configuration

### Capture Modes

- **CDP (default)**: Chrome DevTools Protocol screencast - fastest, most reliable
- **WebCodecs (experimental)**: Native VideoEncoder API with stream copy
- **MediaRecorder (legacy)**: Fallback mode with VP8/VP9 encoding

Set via `STREAM_CAPTURE_MODE=cdp|webcodecs|mediarecorder`

### Stream Quality Settings

```bash
# Resolution (must be even numbers)
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Target FPS
STREAM_FPS=30

# JPEG quality for CDP mode (1-100)
STREAM_CDP_QUALITY=80

# Encoding optimization
STREAM_LOW_LATENCY=false  # false = film tune (better compression), true = zerolatency tune
STREAM_GOP_SIZE=60        # Keyframe interval in frames (60 = 2s at 30fps)
```

### Browser Configuration

**CRITICAL**: WebGPU requires specific browser configuration:

```bash
# Chrome executable path (recommended for reliability)
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable

# Browser channel (alternative to executable path)
STREAM_CAPTURE_CHANNEL=chrome-dev

# Headless mode (always false for WebGPU)
STREAM_CAPTURE_HEADLESS=false

# ANGLE backend (vulkan for NVIDIA, metal for macOS)
STREAM_CAPTURE_ANGLE=vulkan

# Experimental ozone-platform=headless mode
STREAM_CAPTURE_OZONE_HEADLESS=false
```

### Audio Capture

```bash
# Enable audio streaming
STREAM_AUDIO_ENABLED=true

# PulseAudio device (monitor of chrome_audio sink)
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# PulseAudio runtime (user-mode)
XDG_RUNTIME_DIR=/tmp/pulse-runtime
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

### Recovery Settings

```bash
# Timeout for recovery operations (ms)
STREAM_CAPTURE_RECOVERY_TIMEOUT_MS=30000

# Max failures before fallback to MediaRecorder
STREAM_CAPTURE_RECOVERY_MAX_FAILURES=6
```

### Production Client Build

```bash
# Use pre-built client for faster page loads
# Fixes 180s timeout caused by Vite's JIT compilation
DUEL_USE_PRODUCTION_CLIENT=true
```

## GPU Rendering Modes (Vast.ai)

The deployment script (`scripts/deploy-vast.sh`) tries multiple GPU rendering modes in order:

1. **Xorg with NVIDIA** (preferred):
   - Best performance with direct GPU access
   - Requires DRI/DRM device access (`/dev/dri/card0`)
   - Uses NVIDIA Xorg driver with headless configuration
   - Validates GPU rendering (not software fallback)

2. **Xvfb with NVIDIA Vulkan** (fallback):
   - Virtual framebuffer provides X11 protocol
   - Chrome uses NVIDIA GPU via ANGLE/Vulkan
   - CDP captures frames from Chrome's internal GPU rendering
   - Works in containers without DRM access

3. **Ozone Headless with GPU** (experimental):
   - Uses `--ozone-platform=headless` for Wayland-like headless rendering
   - Enabled via `STREAM_CAPTURE_OZONE_HEADLESS=true`
   - May work on systems where X11/Xvfb fails but GPU is accessible

4. **Headless mode (software)**: NOT SUPPORTED
   - WebGPU requires GPU rendering
   - Deployment fails if no GPU-capable mode can be established

**Auto-configured environment variables:**
```bash
DISPLAY=:99                                              # X display
GPU_RENDERING_MODE=xorg|xvfb-vulkan|ozone-headless      # Rendering mode
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json # Force NVIDIA Vulkan
DUEL_CAPTURE_USE_XVFB=true|false                        # Xvfb vs Xorg
```

## WebGPU Diagnostics

The streaming pipeline includes comprehensive WebGPU diagnostics:

### Preflight Testing

- `testWebGpuInit()` runs on blank page before loading game content
- Detects WebGPU initialization hangs early (30s adapter timeout, 60s renderer timeout)
- Provides debugging info when WebGPU fails on remote GPU servers

### GPU Diagnostics

- `captureGpuDiagnostics()` extracts chrome://gpu info at startup
- Logs WebGPU status, Vulkan support, and hardware acceleration
- Helps diagnose GPU driver and display configuration issues

### Probe Timeouts

- 5s timeout on probe evaluate calls to prevent hanging
- Proceeds with capture after 5 consecutive probe timeouts (browser unresponsive)
- Useful when WebGPU is rendering but JavaScript is blocked

### Resolution Tracking

- Automatic detection of resolution mismatches
- Viewport restoration when resolution persists incorrectly
- Logs resolution changes and mismatch counts

## Spectator + Betting URLs

- Game stream view: `http://localhost:3333/?page=stream`
- Embedded spectator: `http://localhost:3333/?embedded=true&mode=spectator`
- Betting app: `http://localhost:4179`
- Betting video source: `VITE_STREAM_EMBED_URL` (Twitch/Kick embed URL)

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

## Troubleshooting

### Black Frames / No Video

1. **Check GPU access**:
   ```bash
   nvidia-smi  # Should show GPU info
   vulkaninfo --summary  # Should show Vulkan support
   ```

2. **Verify display server**:
   ```bash
   echo $DISPLAY  # Should be :99 or :0
   xdpyinfo -display $DISPLAY  # Should show display info
   ```

3. **Check WebGPU diagnostics**:
   ```bash
   bunx pm2 logs hyperscape-duel --lines 500 | grep -A 20 \"GPU Diagnostics\"
   ```

4. **Review preflight test**:
   ```bash
   bunx pm2 logs hyperscape-duel --lines 500 | grep -A 10 \"WebGPU preflight\"
   ```

### Browser Hangs / Timeouts

- **Page load timeout**: Use production client build (`DUEL_USE_PRODUCTION_CLIENT=true`)
- **WebGPU initialization timeout**: Check preflight test logs for adapter/renderer timeouts
- **Probe timeouts**: Capture proceeds after 5 consecutive timeouts (browser unresponsive but rendering)

### No Audio

1. **Check PulseAudio**:
   ```bash
   pulseaudio --check  # Should exit silently if running
   pactl list short sinks  # Should show chrome_audio sink
   ```

2. **Verify audio device**:
   ```bash
   echo $PULSE_AUDIO_DEVICE  # Should be chrome_audio.monitor
   echo $PULSE_SERVER  # Should be unix:/tmp/pulse-runtime/pulse/native
   ```

### Resolution Mismatch

- Automatic viewport recovery enabled
- Check logs for resolution mismatch warnings
- Viewport restoration triggers after 10 consecutive mismatched frames

### Stream Stalls / Recovery

- CDP capture includes automatic recovery with soft/hard restart
- Soft recovery: restart screencast without killing browser
- Hard recovery: full browser teardown and restart
- Falls back to MediaRecorder after max failures (default: 6)
- Browser restart interval: 45 minutes (prevents WebGPU OOM)

### Memory Issues

- Browser restart interval: 45 minutes (prevents WebGPU OOM crashes)
- Damage event cache: cleanup every tick, max 1000 entries
- Activity logger queue: max 1000 entries with 25% eviction
- Session timeout: 30 minutes for zombie sessions
- Agent LLM rate limiting: exponential backoff (5s base, 60s max)

## PM2 Management (Production)

The duel stack runs under PM2 on Vast.ai:

```bash
# View logs
bunx pm2 logs hyperscape-duel --lines 200

# Restart stack
bunx pm2 restart hyperscape-duel

# Stop stack
bunx pm2 stop hyperscape-duel

# View status
bunx pm2 status

# Monitor in real-time
bunx pm2 monit
```

## Environment Variables Reference

See `.env.example` for complete list of streaming and deployment variables.

**Key variables:**
- `STREAM_CAPTURE_MODE` - Capture mode (cdp, webcodecs, mediarecorder)
- `STREAM_CAPTURE_EXECUTABLE` - Chrome executable path (recommended for reliability)
- `STREAM_CAPTURE_WIDTH/HEIGHT` - Stream resolution (must be even)
- `STREAM_FPS` - Target frames per second
- `STREAM_CDP_QUALITY` - JPEG quality for CDP mode (1-100)
- `STREAM_LOW_LATENCY` - Encoding tune (false = film, true = zerolatency)
- `STREAM_GOP_SIZE` - Keyframe interval in frames
- `DUEL_USE_PRODUCTION_CLIENT` - Use pre-built client for faster loads
- `GPU_RENDERING_MODE` - Auto-configured by deploy script
- `VK_ICD_FILENAMES` - Force NVIDIA Vulkan ICD
