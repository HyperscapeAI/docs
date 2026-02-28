# Environment Variables Reference

Complete reference for all environment variables used in Hyperscape.

## Quick Links

- [Core Configuration](#core-configuration)
- [Streaming & GPU](#streaming--gpu)
- [Database](#database)
- [Authentication](#authentication)
- [AI Agents](#ai-agents)
- [Deployment](#deployment)

## Core Configuration

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment: `development`, `production`, `test` |
| `PORT` | `5555` | HTTP server port |
| `WORLD` | `world` | World folder to load |
| `SAVE_INTERVAL` | `60` | Auto-save interval (seconds) |

### Client

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_PORT` | `3333` | Vite dev server port |
| `PUBLIC_API_URL` | `http://localhost:5555` | Game server API URL |
| `PUBLIC_WS_URL` | `ws://localhost:5555/ws` | WebSocket URL |
| `PUBLIC_CDN_URL` | `http://localhost:8080` | Asset CDN URL |

## Streaming & GPU

### Capture Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_MODE` | `cdp` | Capture mode: `cdp`, `mediarecorder`, `webcodecs` |
| `STREAM_CAPTURE_WIDTH` | `1280` | Stream width (must be even) |
| `STREAM_CAPTURE_HEIGHT` | `720` | Stream height (must be even) |
| `STREAM_FPS` | `30` | Target frames per second |
| `STREAM_CDP_QUALITY` | `80` | JPEG quality for CDP (1-100) |

### GPU Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY` | `:99` | X display server |
| `DUEL_CAPTURE_USE_XVFB` | `false` | Use Xvfb virtual display |
| `VK_ICD_FILENAMES` | `/usr/share/vulkan/icd.d/nvidia_icd.json` | Vulkan ICD path |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | ANGLE backend (`vulkan`, `metal`) |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Browser channel |
| `STREAM_CAPTURE_EXECUTABLE` | - | Custom browser path |
| `STREAM_CAPTURE_HEADLESS` | `false` | Headless mode (NOT supported for WebGPU) |
| `STREAM_CAPTURE_USE_EGL` | `false` | Use EGL (NOT supported for WebGPU) |
| `GPU_RENDERING_MODE` | `xorg` | Rendering mode: `xorg`, `xvfb-vulkan` |

### Audio Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `PULSE_SERVER` | `unix:/tmp/pulse-runtime/pulse/native` | PulseAudio socket |
| `XDG_RUNTIME_DIR` | `/tmp/pulse-runtime` | PulseAudio runtime dir |

### Encoding Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_GOP_SIZE` | `60` | GOP size (keyframe interval) |
| `STREAM_LOW_LATENCY` | `false` | Low latency mode (zerolatency tune) |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg executable path |

### Recovery Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` | `30000` | Recovery timeout (ms) |
| `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` | `6` | Max failures before fallback |

### Stream Destinations

| Variable | Default | Description |
|----------|---------|-------------|
| `TWITCH_STREAM_KEY` | - | Twitch stream key |
| `TWITCH_RTMP_URL` | `rtmp://live.twitch.tv/app` | Twitch ingest URL |
| `KICK_STREAM_KEY` | - | Kick stream key |
| `KICK_RTMP_URL` | `rtmps://fa723fc1b171.global-contribute.live-video.net/app` | Kick ingest URL |
| `X_STREAM_KEY` | - | X/Twitter stream key |
| `X_RTMP_URL` | `rtmp://sg.pscp.tv:80/x` | X/Twitter ingest URL |
| `YOUTUBE_STREAM_KEY` | - | YouTube stream key (disabled by default) |
| `YOUTUBE_RTMP_URL` | `rtmp://a.rtmp.youtube.com/live2` | YouTube ingest URL |

## Database

### PostgreSQL

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `USE_LOCAL_POSTGRES` | `true` | Use Docker PostgreSQL (dev only) |
| `POSTGRES_CONTAINER` | `hyperscape-postgres` | Docker container name |
| `POSTGRES_USER` | `hyperscape` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `hyperscape_dev_password` | PostgreSQL password |
| `POSTGRES_DB` | `hyperscape` | Database name |
| `POSTGRES_PORT` | `5488` | PostgreSQL port |

## Authentication

### Privy

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_PRIVY_APP_ID` | - | Privy app ID (public) |
| `PRIVY_APP_SECRET` | - | Privy app secret (private) |
| `JWT_SECRET` | - | JWT signing secret |

### Admin

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_CODE` | - | Admin access code |
| `GRANT_DEV_ADMIN` | `false` | Grant admin to all users (dev only) |

## AI Agents

### ElizaOS

| Variable | Default | Description |
|----------|---------|-------------|
| `ELIZAOS_API_URL` | `http://localhost:4001` | ElizaOS API URL |
| `AUTO_START_AGENTS` | `true` | Auto-start agents from database |
| `AUTO_START_AGENTS_MAX` | `10` | Max agents to auto-start |
| `SPAWN_MODEL_AGENTS` | `true` | Spawn LLM-powered agents |

### AI Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENROUTER_API_KEY` | - | OpenRouter API key |

## Deployment

### Vast.ai

| Variable | Default | Description |
|----------|---------|-------------|
| `VAST_HOST` | - | Vast.ai SSH host |
| `VAST_PORT` | - | Vast.ai SSH port |
| `VAST_SSH_KEY` | - | Vast.ai SSH private key |

### Solana

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_DEPLOYER_PRIVATE_KEY` | - | Base58 private key (sets all roles) |
| `SOLANA_ARENA_AUTHORITY_SECRET` | - | Arena authority key |
| `SOLANA_ARENA_REPORTER_SECRET` | - | Arena reporter key |
| `SOLANA_ARENA_KEEPER_SECRET` | - | Arena keeper key |
| `SOLANA_MM_PRIVATE_KEY` | - | Market maker key |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | `wss://api.mainnet-beta.solana.com` | Solana WebSocket endpoint |

### Arena Betting

| Variable | Default | Description |
|----------|---------|-------------|
| `ARENA_EXTERNAL_BET_WRITE_KEY` | - | External bet API key |
| `SOLANA_MARKET_FEE_BPS` | `100` | Platform fee (basis points) |

## Deprecated Variables

### Removed (February 2026)

| Variable | Status | Reason |
|----------|--------|--------|
| `STREAM_CAPTURE_DISABLE_WEBGPU` | Ignored | WebGPU always enabled |
| `DUEL_FORCE_WEBGL_FALLBACK` | Ignored | WebGL not supported |

## Variable Precedence

Environment variables are loaded in this order (highest priority first):

1. **System environment** (highest)
2. **Package `.env` file** (`packages/server/.env`)
3. **Parent `.env` file** (`packages/.env`)
4. **Root `.env` file** (`./.env`)
5. **Defaults in code** (lowest)

## Security Best Practices

### 1. Never Commit Secrets

❌ **Bad**:
```bash
# .env (committed to git)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
```

✅ **Good**:
```bash
# .env.example (committed to git)
TWITCH_STREAM_KEY=

# .env (in .gitignore)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
```

### 2. Use GitHub Secrets for CI/CD

```yaml
# .github/workflows/deploy-vast.yml
env:
  TWITCH_STREAM_KEY: ${{ secrets.TWITCH_STREAM_KEY }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 3. Rotate Secrets Regularly

- Stream keys: Rotate monthly
- Database passwords: Rotate quarterly
- JWT secrets: Rotate on suspected compromise
- API keys: Rotate when team members leave

### 4. Validate Required Variables

```typescript
// In startup/config.ts
const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'PRIVY_APP_SECRET'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

## Examples

### Local Development

```bash
# packages/server/.env
NODE_ENV=development
PORT=5555
USE_LOCAL_POSTGRES=true
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret
```

### Production (Railway)

```bash
# Set via Railway dashboard
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-jwt-secret
PUBLIC_CDN_URL=https://assets.hyperscape.club
PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-secret
```

### Vast.ai Streaming

```bash
# Set via GitHub Secrets
DATABASE_URL=postgresql://user:pass@host:5432/db
TWITCH_STREAM_KEY=live_123456789_abcdefghij
KICK_STREAM_KEY=your-kick-key
KICK_RTMP_URL=rtmps://fa723fc1b171.global-contribute.live-video.net/app
X_STREAM_KEY=your-x-key
X_RTMP_URL=rtmp://sg.pscp.tv:80/x
SOLANA_DEPLOYER_PRIVATE_KEY=base58-encoded-key
```

## Validation

### Check Configuration

```bash
# Run configuration check script
bun run packages/server/scripts/check-config.mjs
```

**Checks**:
- Required variables are set
- Database connection works
- CDN is accessible
- Stream keys are valid format

### Test Streaming Configuration

```bash
# Test RTMP bridge locally
bun run packages/server/scripts/test-rtmp-local.ts
```

## References

- **Server .env.example**: `packages/server/.env.example`
- **Client .env.example**: `packages/client/.env.example`
- **Root .env.example**: `.env.example`
- **Config Validation**: `packages/server/src/startup/config.ts`
