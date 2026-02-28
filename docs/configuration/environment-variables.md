# Environment Variables Reference

Complete reference for all Hyperscape environment variables.

## Overview

Hyperscape uses environment variables for configuration across packages. Variables are organized by category and package.

**Configuration Files:**
- `.env.example` - Root-level streaming and deployment
- `packages/server/.env.example` - Server configuration
- `packages/client/.env.example` - Client configuration
- `packages/plugin-hyperscape/.env.example` - AI agent configuration
- `packages/asset-forge/.env.example` - Asset generation tools

## Core Configuration

### Authentication

#### PRIVY_APP_ID
**Package:** Server  
**Required:** Yes (production)  
**Description:** Privy application ID for authentication  
**Example:** `clxxx...`

#### PRIVY_APP_SECRET
**Package:** Server  
**Required:** Yes (production)  
**Description:** Privy application secret  
**Example:** `secret_xxx...`

#### PUBLIC_PRIVY_APP_ID
**Package:** Client  
**Required:** Yes (production)  
**Description:** Privy app ID (must match server)  
**Example:** `clxxx...`

#### JWT_SECRET
**Package:** Server  
**Required:** Yes (production)  
**Description:** Secret for signing JWT tokens  
**Example:** Generate with `openssl rand -base64 32`

### Database

#### DATABASE_URL
**Package:** Server  
**Required:** Yes (production)  
**Description:** PostgreSQL connection string  
**Example:** `postgresql://user:pass@host:5432/hyperscape`  
**Default:** `postgresql://hyperscape:hyperscape_dev_password@localhost:5488/hyperscape`

### Server

#### PORT
**Package:** Server  
**Required:** No  
**Description:** Server HTTP/WebSocket port  
**Default:** `5555`

#### PUBLIC_API_URL
**Package:** Client  
**Required:** No  
**Description:** Server API URL  
**Default:** `http://localhost:5555`

#### PUBLIC_WS_URL
**Package:** Client  
**Required:** No  
**Description:** Server WebSocket URL  
**Default:** `ws://localhost:5555/ws`

## GPU Rendering (Vast.ai)

### Display Configuration

#### DISPLAY
**Package:** Server (streaming)  
**Required:** Yes (streaming)  
**Description:** X display server  
**Example:** `:99` (Xorg/Xvfb), `:0` (local)  
**Auto-configured:** Yes (by deploy script)

#### GPU_RENDERING_MODE
**Package:** Server (streaming)  
**Required:** No  
**Description:** GPU rendering mode  
**Values:** `xorg`, `xvfb-vulkan`  
**Auto-configured:** Yes (by deploy script)

#### DUEL_CAPTURE_USE_XVFB
**Package:** Server (streaming)  
**Required:** No  
**Description:** Use Xvfb virtual display  
**Values:** `true`, `false`  
**Default:** `false`  
**Auto-configured:** Yes (by deploy script)

#### VK_ICD_FILENAMES
**Package:** Server (streaming)  
**Required:** No  
**Description:** Force specific Vulkan ICD  
**Example:** `/usr/share/vulkan/icd.d/nvidia_icd.json`  
**Auto-configured:** Yes (by deploy script)

### Video Capture

#### STREAM_CAPTURE_MODE
**Package:** Server (streaming)  
**Required:** No  
**Description:** Capture mode  
**Values:** `cdp` (recommended), `mediarecorder`, `webcodecs`  
**Default:** `cdp`

#### STREAM_CAPTURE_HEADLESS
**Package:** Server (streaming)  
**Required:** No  
**Description:** Headless mode (WebGPU requires display)  
**Values:** `false`, `true`, `new`  
**Default:** `false`  
**Note:** Always `false` for WebGPU support

#### STREAM_CAPTURE_CHANNEL
**Package:** Server (streaming)  
**Required:** No  
**Description:** Browser channel  
**Values:** `chrome`, `chrome-dev`, `msedge`, etc.  
**Default:** `chrome-dev` (for WebGPU)

#### STREAM_CAPTURE_EXECUTABLE
**Package:** Server (streaming)  
**Required:** No  
**Description:** Custom browser executable path  
**Example:** `/usr/bin/google-chrome-unstable`

#### STREAM_CAPTURE_ANGLE
**Package:** Server (streaming)  
**Required:** No  
**Description:** ANGLE backend for WebGPU  
**Values:** `vulkan`, `metal`, `d3d11`  
**Default:** `vulkan` (Linux), `metal` (macOS)

#### STREAM_CDP_QUALITY
**Package:** Server (streaming)  
**Required:** No  
**Description:** JPEG quality for CDP screencast  
**Range:** 1-100  
**Default:** `80`

#### STREAM_FPS
**Package:** Server (streaming)  
**Required:** No  
**Description:** Target frame rate  
**Default:** `30`

#### STREAM_CAPTURE_WIDTH
**Package:** Server (streaming)  
**Required:** No  
**Description:** Stream width (must be even)  
**Default:** `1280`

#### STREAM_CAPTURE_HEIGHT
**Package:** Server (streaming)  
**Required:** No  
**Description:** Stream height (must be even)  
**Default:** `720`

### Audio Capture

#### STREAM_AUDIO_ENABLED
**Package:** Server (streaming)  
**Required:** No  
**Description:** Enable audio capture via PulseAudio  
**Values:** `true`, `false`  
**Default:** `true`

#### PULSE_AUDIO_DEVICE
**Package:** Server (streaming)  
**Required:** No  
**Description:** PulseAudio monitor device  
**Default:** `chrome_audio.monitor`

#### PULSE_SERVER
**Package:** Server (streaming)  
**Required:** No  
**Description:** PulseAudio server socket  
**Default:** `unix:/tmp/pulse-runtime/pulse/native`  
**Auto-configured:** Yes (by deploy script)

#### XDG_RUNTIME_DIR
**Package:** Server (streaming)  
**Required:** No  
**Description:** PulseAudio runtime directory  
**Default:** `/tmp/pulse-runtime`  
**Auto-configured:** Yes (by deploy script)

### Encoding

#### STREAM_BITRATE
**Package:** Server (streaming)  
**Required:** No  
**Description:** Video bitrate in bits per second  
**Default:** `4500000` (4.5 Mbps)

#### STREAM_BUFFER_SIZE
**Package:** Server (streaming)  
**Required:** No  
**Description:** FFmpeg buffer size  
**Default:** `18000000` (4x bitrate)

#### STREAM_PRESET
**Package:** Server (streaming)  
**Required:** No  
**Description:** x264 encoding preset  
**Values:** `ultrafast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow`  
**Default:** `medium`

#### STREAM_LOW_LATENCY
**Package:** Server (streaming)  
**Required:** No  
**Description:** Enable zerolatency tune (disables B-frames)  
**Values:** `true`, `false`  
**Default:** `false`

#### STREAM_GOP_SIZE
**Package:** Server (streaming)  
**Required:** No  
**Description:** Keyframe interval in frames  
**Default:** `60` (2 seconds at 30fps)  
**Note:** Lower = faster playback start, higher bitrate

### Recovery

#### STREAM_CAPTURE_RECOVERY_TIMEOUT_MS
**Package:** Server (streaming)  
**Required:** No  
**Description:** Recovery timeout in milliseconds  
**Default:** `30000` (30 seconds)

#### STREAM_CAPTURE_RECOVERY_MAX_FAILURES
**Package:** Server (streaming)  
**Required:** No  
**Description:** Max failures before fallback  
**Default:** `6`

## RTMP Streaming

### Twitch

#### TWITCH_STREAM_KEY
**Package:** Server (streaming)  
**Required:** Yes (for Twitch)  
**Description:** Twitch stream key  
**Example:** `live_xxxxx_yyyyy`  
**Get from:** [dashboard.twitch.tv/settings/stream](https://dashboard.twitch.tv/settings/stream)

#### TWITCH_RTMP_URL
**Package:** Server (streaming)  
**Required:** No  
**Description:** Twitch ingest URL  
**Default:** `rtmps://live.twitch.tv/app`

### Kick

#### KICK_STREAM_KEY
**Package:** Server (streaming)  
**Required:** Yes (for Kick)  
**Description:** Kick stream key  
**Get from:** [kick.com/dashboard/settings/stream](https://kick.com/dashboard/settings/stream)

#### KICK_RTMP_URL
**Package:** Server (streaming)  
**Required:** Yes (for Kick)  
**Description:** Kick ingest URL  
**Example:** `rtmps://fa723fc1b171.global-contribute.live-video.net/app`

### X/Twitter

#### X_STREAM_KEY
**Package:** Server (streaming)  
**Required:** Yes (for X)  
**Description:** X/Twitter stream key  
**Get from:** [studio.twitter.com](https://studio.twitter.com)

#### X_RTMP_URL
**Package:** Server (streaming)  
**Required:** Yes (for X)  
**Description:** X/Twitter ingest URL  
**Example:** `rtmp://sg.pscp.tv:80/x`

### YouTube

#### YOUTUBE_STREAM_KEY
**Package:** Server (streaming)  
**Required:** No  
**Description:** YouTube stream key (disabled by default)  
**Default:** `""` (empty = disabled)

## Solana

### Deployment Keys

#### SOLANA_DEPLOYER_PRIVATE_KEY
**Package:** Server  
**Required:** Yes (on-chain features)  
**Description:** Base58-encoded Solana private key (used for all roles)  
**Example:** `5J...` (base58)

#### SOLANA_ARENA_AUTHORITY_SECRET
**Package:** Server  
**Required:** No  
**Description:** Arena authority keypair (fee payer)  
**Default:** Falls back to `SOLANA_DEPLOYER_PRIVATE_KEY`

#### SOLANA_ARENA_REPORTER_SECRET
**Package:** Server  
**Required:** No  
**Description:** Arena reporter keypair  
**Default:** Falls back to `SOLANA_DEPLOYER_PRIVATE_KEY`

#### SOLANA_ARENA_KEEPER_SECRET
**Package:** Server  
**Required:** No  
**Description:** Arena keeper keypair  
**Default:** Falls back to `SOLANA_DEPLOYER_PRIVATE_KEY`

#### SOLANA_MM_PRIVATE_KEY
**Package:** Server  
**Required:** No  
**Description:** Market maker keypair  
**Default:** None

### Network

#### SOLANA_RPC_URL
**Package:** Server  
**Required:** No  
**Description:** Solana RPC endpoint  
**Default:** `https://api.devnet.solana.com`

#### SOLANA_WS_URL
**Package:** Server  
**Required:** No  
**Description:** Solana WebSocket endpoint  
**Default:** `wss://api.devnet.solana.com/`

## AI Agents

### Connection

#### HYPERSCAPE_SERVER_URL
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** WebSocket URL to game server  
**Default:** `ws://localhost:5555/ws`

#### HYPERSCAPE_API_URL
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** HTTP API URL  
**Default:** `http://localhost:5555`

#### HYPERSCAPE_AUTO_RECONNECT
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Auto-reconnect on disconnect  
**Values:** `true`, `false`  
**Default:** `true`

### Authentication

#### HYPERSCAPE_AUTH_TOKEN
**Package:** plugin-hyperscape  
**Required:** Yes (agents)  
**Description:** Agent authentication token  
**Note:** Auto-generated via wallet auth if not set

#### HYPERSCAPE_PRIVY_USER_ID
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Privy user ID for agent  

#### HYPERSCAPE_CHARACTER_ID
**Package:** plugin-hyperscape  
**Required:** Yes (agents)  
**Description:** Character ID for agent to control  
**Note:** Auto-generated via wallet auth if not set

### Behavior

#### HYPERSCAPE_AUTO_ACCEPT_DUELS
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Auto-accept duel challenges (duel bot mode)  
**Values:** `true`, `false`  
**Default:** `false`

#### HYPERSCAPE_SILENT_CHAT
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Disable chat message processing  
**Values:** `true`, `false`  
**Default:** `false`

#### HYPERSCAPE_TICK_INTERVAL
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Normal tick interval in milliseconds  
**Default:** `10000` (10 seconds)

#### HYPERSCAPE_FAST_TICK_ENABLED
**Package:** plugin-hyperscape  
**Required:** No  
**Description:** Enable fast-tick mode  
**Values:** `true`, `false`  
**Default:** `true`

## Asset Generation

### AI APIs

#### OPENAI_API_KEY
**Package:** asset-forge  
**Required:** Yes (asset generation)  
**Description:** OpenAI API key for GPT-4  
**Get from:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

#### MESHY_API_KEY
**Package:** asset-forge  
**Required:** Yes (3D generation)  
**Description:** Meshy AI API key  
**Get from:** [meshy.ai](https://meshy.ai)

## Deprecated Variables

### Removed (v0.2.0)

These variables have been removed and are no longer used:

- `DUEL_FORCE_WEBGL_FALLBACK` - WebGL not supported
- `isWebGLForced` - WebGL forcing removed
- `isWebGLFallbackAllowed` - No fallback path

### Ignored (Still Present)

These variables are kept for backwards compatibility but ignored:

#### STREAM_CAPTURE_DISABLE_WEBGPU
**Status:** Ignored  
**Reason:** WebGPU is required  
**Default:** `false` (always)

#### STREAM_CAPTURE_USE_EGL
**Status:** Ignored  
**Reason:** WebGPU requires display server  
**Default:** `false` (always)

## Variable Precedence

Variables are loaded in this order (later overrides earlier):

1. Package `.env.example` defaults
2. Package `.env` file
3. Root `.env` file
4. Environment variables
5. GitHub Secrets (CI/CD only)

## Security

### Secrets Management

**Never commit secrets to git.** Use:

1. **Local development:** `.env` files (gitignored)
2. **Production:** GitHub Secrets
3. **CI/CD:** Injected via workflow

### Required Secrets

**Production deployment requires:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing
- `PRIVY_APP_SECRET` - Privy authentication
- `TWITCH_STREAM_KEY` - Twitch streaming (if enabled)
- `KICK_STREAM_KEY` + `KICK_RTMP_URL` - Kick streaming (if enabled)
- `X_STREAM_KEY` + `X_RTMP_URL` - X streaming (if enabled)
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana on-chain (if enabled)

## Examples

### Local Development

```bash
# packages/server/.env
PUBLIC_PRIVY_APP_ID=clxxx...
PRIVY_APP_SECRET=secret_xxx...
DATABASE_URL=postgresql://hyperscape:password@localhost:5488/hyperscape
```

```bash
# packages/client/.env
PUBLIC_PRIVY_APP_ID=clxxx...
PUBLIC_API_URL=http://localhost:5555
PUBLIC_WS_URL=ws://localhost:5555/ws
```

### Production (Railway)

```bash
# Set via Railway dashboard
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=xxx...
PUBLIC_PRIVY_APP_ID=clxxx...
PRIVY_APP_SECRET=secret_xxx...
PUBLIC_CDN_URL=https://assets.hyperscape.club
```

### Streaming (Vast.ai)

```bash
# Set via GitHub Secrets
DATABASE_URL=postgresql://...
TWITCH_STREAM_KEY=live_xxx...
KICK_STREAM_KEY=xxx...
KICK_RTMP_URL=rtmps://...
X_STREAM_KEY=xxx...
X_RTMP_URL=rtmp://...
SOLANA_DEPLOYER_PRIVATE_KEY=base58...

# Auto-configured by deploy script
DISPLAY=:99
GPU_RENDERING_MODE=xorg
DUEL_CAPTURE_USE_XVFB=false
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
PULSE_SERVER=unix:/tmp/pulse-runtime/pulse/native
```

### AI Agents

```bash
# packages/plugin-hyperscape/.env
HYPERSCAPE_SERVER_URL=ws://localhost:5555/ws
HYPERSCAPE_API_URL=http://localhost:5555
HYPERSCAPE_CHARACTER_ID=char_xxx...
HYPERSCAPE_AUTH_TOKEN=token_xxx...
```

## Validation

### Required Variables Check

```bash
# Check if required variables are set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET not set"
  exit 1
fi
```

### Streaming Variables Check

```bash
# Check if streaming is configured
if [ -n "$TWITCH_STREAM_KEY" ] || [ -n "$KICK_STREAM_KEY" ] || [ -n "$X_STREAM_KEY" ]; then
  echo "Streaming enabled"
else
  echo "WARNING: No stream keys configured"
fi
```

## Troubleshooting

### Variable Not Loading

1. **Check file location** - `.env` must be in package root
2. **Check syntax** - No spaces around `=`
3. **Check quotes** - Use quotes for values with spaces
4. **Restart server** - Changes require restart

### Secrets Not Injected (CI/CD)

1. **Check GitHub Secrets** - Verify secrets are set in repository settings
2. **Check workflow** - Verify secrets are passed to deployment script
3. **Check deploy script** - Verify secrets are written to `.env` file

### Display Server Not Found

```bash
# Check DISPLAY variable
echo $DISPLAY

# Check if display server is running
xdpyinfo -display $DISPLAY
```

If not running, deploy script should have started it. Check deploy logs.

## References

- [.env.example](../../.env.example) - Root-level variables
- [packages/server/.env.example](../../packages/server/.env.example) - Server variables
- [packages/client/.env.example](../../packages/client/.env.example) - Client variables
- [scripts/deploy-vast.sh](../../scripts/deploy-vast.sh) - Auto-configuration logic
- [ecosystem.config.cjs](../../ecosystem.config.cjs) - PM2 environment
