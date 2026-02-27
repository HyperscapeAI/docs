# Environment Variables Reference

Comprehensive reference for all environment variables used across Hyperscape packages.

## Server (`packages/server/.env`)

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/hyperscape` |
| `JWT_SECRET` | JWT signing secret (required in prod/staging) | `openssl rand -base64 32` |
| `PRIVY_APP_ID` | Privy authentication app ID | `clabcd1234...` |
| `PRIVY_APP_SECRET` | Privy authentication secret | `abc123...` |
| `ADMIN_CODE` | Admin API access code | Random secure string |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_LOCAL_POSTGRES` | `true` | Use local Docker PostgreSQL |
| `POSTGRES_URL` | - | Alternative to DATABASE_URL |
| `DATABASE_POOL_MAX` | `10` | Max database connections |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5555` | HTTP server port |
| `NODE_ENV` | `development` | Environment (development/production/staging) |
| `DISABLE_RATE_LIMIT` | `false` | Disable rate limiting |
| `ALLOW_DESTRUCTIVE_CHANGES` | `false` | Allow destructive database operations |

### Streaming & GPU Rendering

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAMING_DUEL_ENABLED` | `false` | Enable duel streaming |
| `STREAM_CAPTURE_MODE` | `cdp` | Capture mode (cdp/webcodecs) |
| `STREAM_CAPTURE_WIDTH` | `1280` | Video width |
| `STREAM_CAPTURE_HEIGHT` | `720` | Video height |
| `STREAM_FPS` | `30` | Frame rate |
| `STREAM_VIDEO_BITRATE_KBPS` | `4500` | Video bitrate |
| `STREAM_AUDIO_BITRATE_KBPS` | `128` | Audio bitrate |
| `STREAM_LOW_LATENCY` | `false` | Use zerolatency tune (disables B-frames) |
| `STREAM_CAPTURE_CHANNEL` | `chrome-dev` | Chrome channel (chrome-dev = google-chrome-unstable) |
| `STREAM_CAPTURE_HEADLESS` | `false` | Run headless (false = use Xvfb/Xorg) |
| `STREAM_CAPTURE_ANGLE` | `vulkan` | ANGLE backend (vulkan/swiftshader) |
| `STREAM_CAPTURE_DISABLE_WEBGPU` | `false` | Disable WebGPU rendering |
| `DUEL_CAPTURE_USE_XVFB` | `true` | Use Xvfb instead of Xorg (set dynamically by deploy-vast.sh) |
| `DISPLAY` | `:99` | X server display number |
| `VK_ICD_FILENAMES` | `/usr/share/vulkan/icd.d/nvidia_icd.json` | Force NVIDIA Vulkan ICD |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg binary path |
| `FFMPEG_HWACCEL` | `auto` | Hardware acceleration (auto/nvidia/mac) |

### Audio Capture

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_AUDIO_ENABLED` | `true` | Enable audio capture |
| `PULSE_AUDIO_DEVICE` | `chrome_audio.monitor` | PulseAudio monitor device |
| `PULSE_SERVER` | `unix:/tmp/pulse-runtime/pulse/native` | PulseAudio server socket |
| `XDG_RUNTIME_DIR` | `/tmp/pulse-runtime` | Runtime directory for PulseAudio |

### RTMP Streaming

| Variable | Default | Description |
|----------|---------|-------------|
| `TWITCH_STREAM_KEY` | - | Twitch stream key |
| `TWITCH_RTMP_URL` | `rtmp://live.twitch.tv/app` | Twitch RTMP server |
| `KICK_STREAM_KEY` | - | Kick stream key |
| `KICK_RTMP_URL` | `rtmps://fa723fc1b171.global-contribute.live-video.net/app` | Kick RTMP server |
| `X_STREAM_KEY` | - | X/Twitter stream key |
| `X_RTMP_URL` | `rtmp://sg.pscp.tv:80/x` | X/Twitter RTMP server |
| `YOUTUBE_STREAM_KEY` | `""` | YouTube stream key (empty = disabled) |
| `YOUTUBE_RTMP_URL` | - | YouTube RTMP server |
| `STREAMING_CANONICAL_PLATFORM` | `twitch` | Platform for anti-cheat timing |
| `STREAMING_PUBLIC_DELAY_MS` | `0` | Public data delay (0 = live betting) |

### Stream Recovery

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_CAPTURE_RECOVERY_TIMEOUT_MS` | `30000` | Recovery timeout |
| `STREAM_CAPTURE_RECOVERY_MAX_FAILURES` | `6` | Max recovery failures |

### Solana

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_DEPLOYER_PRIVATE_KEY` | - | Solana keypair (base58 or JSON array) |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | `wss://api.devnet.solana.com/` | Solana WebSocket endpoint |
| `SOLANA_ARENA_AUTHORITY_SECRET` | - | Arena authority keypair (falls back to DEPLOYER) |
| `SOLANA_ARENA_REPORTER_SECRET` | - | Arena reporter keypair (falls back to DEPLOYER) |
| `SOLANA_ARENA_KEEPER_SECRET` | - | Arena keeper keypair (falls back to DEPLOYER) |
| `SOLANA_MM_PRIVATE_KEY` | - | Market maker keypair |
| `MARKET_MINT` | WSOL | Market token mint (defaults to native token) |
| `ENABLE_PERPS_ORACLE` | `false` | Enable perps oracle updates |

### Arena & Betting

| Variable | Default | Description |
|----------|---------|-------------|
| `DUEL_MARKET_MAKER_ENABLED` | `false` | Enable market maker bot |
| `DUEL_BETTING_ENABLED` | `false` | Enable betting system |
| `ARENA_SERVICE_ENABLED` | `false` | Enable arena service |
| `ARENA_EXTERNAL_BET_WRITE_KEY` | - | External betting API key |
| `DUEL_SKIP_CHAIN_SETUP` | `false` | Skip blockchain setup |

### AI Agents

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_START_AGENTS` | `false` | Auto-start agents on server start |
| `AUTO_START_AGENTS_MAX` | `10` | Max agents to auto-start |
| `STREAMING_DUEL_COMBAT_AI_ENABLED` | `false` | Enable DuelCombatAI for streaming |

### CDN & Assets

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_CDN_URL` | `http://localhost:8080` | Asset CDN URL |
| `DUEL_ALLOW_INHERITED_CDN_URL` | `false` | Allow CDN URL inheritance |

### Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_RUNTIME_MAX_TICKS_PER_FRAME` | `1` | Max ticks per frame |
| `SERVER_RUNTIME_MIN_DELAY_MS` | `10` | Min delay between frames |
| `GAME_STATE_POLL_TIMEOUT_MS` | `5000` | Game state poll timeout |
| `GAME_STATE_POLL_INTERVAL_MS` | `3000` | Game state poll interval |
| `DUEL_RUNTIME_HEALTH_INTERVAL_MS` | `15000` | Health check interval |
| `DUEL_RUNTIME_HEALTH_MAX_FAILURES` | `30` | Max health check failures |

### Memory Management

| Variable | Default | Description |
|----------|---------|-------------|
| `MALLOC_TRIM_THRESHOLD_` | `-1` | Disable malloc trimming |
| `MIMALLOC_ALLOW_DECOMMIT` | `0` | Disable memory decommit |
| `MIMALLOC_ALLOW_RESET` | `0` | Disable memory reset |
| `MIMALLOC_PAGE_RESET` | `0` | Disable page reset |
| `MIMALLOC_PURGE_DELAY` | `1000000` | Delay memory purge |

### Game URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `GAME_URL` | `http://localhost:3333/?page=stream` | Primary game URL |
| `GAME_FALLBACK_URLS` | - | Comma-separated fallback URLs |

## Client (`packages/client/.env`)

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_PRIVY_APP_ID` | Privy app ID (must match server) | `clabcd1234...` |

### API Endpoints

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_API_URL` | `http://localhost:5555` | Game server HTTP URL |
| `PUBLIC_WS_URL` | `ws://localhost:5555/ws` | Game server WebSocket URL |
| `PUBLIC_CDN_URL` | `http://localhost:8080` | Asset CDN URL |

### Development

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_PORT` | `3333` | Vite dev server port |

## Plugin Hyperscape (`packages/plugin-hyperscape/.env`)

### LLM Providers

At least one required:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

### Hyperscape Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `HYPERSCAPE_SERVER_URL` | `ws://localhost:5555/ws` | Game server WebSocket URL |
| `HYPERSCAPE_AUTO_RECONNECT` | `true` | Auto-reconnect on disconnect |
| `HYPERSCAPE_AUTH_TOKEN` | - | Optional Privy auth token |
| `HYPERSCAPE_PRIVY_USER_ID` | - | Optional Privy user ID |

## Asset Forge (`packages/asset-forge/.env`)

### AI Services

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (for GPT-4 Vision) |
| `MESHY_API_KEY` | MeshyAI API key (for 3D generation) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (for voice/music) |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ASSET_FORGE_PORT` | `3400` | UI server port |
| `ASSET_FORGE_API_PORT` | `3401` | API server port |

## Ecosystem Config (`ecosystem.config.cjs`)

PM2 configuration for production deployment. Reads from environment or provides defaults.

### Key Variables

All server variables above, plus:

| Variable | Default | Description |
|----------|---------|-------------|
| `DUEL_DISABLE_BRIDGE_CAPTURE` | `false` | Disable RTMP bridge capture |
| `DUEL_FORCE_WEBGL_FALLBACK` | `false` | Force WebGL (removed - WebGPU required) |

## GitHub Secrets (CI/CD)

Required for automated deployments:

### Vast.ai Deployment

| Secret | Description |
|--------|-------------|
| `VAST_HOST` | Vast.ai instance IP |
| `VAST_PORT` | SSH port |
| `VAST_SSH_KEY` | SSH private key |
| `VAST_SERVER_URL` | Public server URL (for maintenance mode API) |

### Streaming

| Secret | Description |
|--------|-------------|
| `TWITCH_STREAM_KEY` | Twitch stream key |
| `KICK_STREAM_KEY` | Kick stream key |
| `KICK_RTMP_URL` | Kick RTMP URL |
| `X_STREAM_KEY` | X/Twitter stream key |
| `X_RTMP_URL` | X/Twitter RTMP URL |

### Database & Security

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_CODE` | Admin API access code |

### Blockchain

| Secret | Description |
|--------|-------------|
| `SOLANA_DEPLOYER_PRIVATE_KEY` | Solana keypair (base58 or JSON array) |
| `ARENA_EXTERNAL_BET_WRITE_KEY` | External betting API key |

### Cloudflare

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (for Pages/R2) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

## Environment-Specific Configurations

### Local Development

Minimal configuration for local development:

```bash
# packages/client/.env
PUBLIC_PRIVY_APP_ID=your-app-id

# packages/server/.env
PUBLIC_PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
JWT_SECRET=your-random-secret
```

All other variables use defaults that work with `bun run dev`.

### Production (Railway)

```bash
# packages/server/.env (Railway environment variables)
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
ADMIN_CODE=...
PUBLIC_CDN_URL=https://assets.hyperscape.club
USE_LOCAL_POSTGRES=false
```

### Production (Vast.ai Streaming)

```bash
# Passed via GitHub Secrets → SSH → /tmp/hyperscape-secrets.env → packages/server/.env
DATABASE_URL=postgresql://...
JWT_SECRET=...
TWITCH_STREAM_KEY=...
KICK_STREAM_KEY=...
KICK_RTMP_URL=...
X_STREAM_KEY=...
X_RTMP_URL=...
YOUTUBE_STREAM_KEY=
SOLANA_DEPLOYER_PRIVATE_KEY=...
ARENA_EXTERNAL_BET_WRITE_KEY=...
```

Plus all ecosystem.config.cjs defaults for streaming configuration.

## Variable Precedence

1. **Environment variables** (highest priority)
2. **`.env` file** in package directory
3. **Default values** in code

Example from `ecosystem.config.cjs`:
```javascript
DATABASE_URL: process.env.DATABASE_URL || 
              process.env.POSTGRES_URL || 
              "postgresql://hyperscape:hyperscape_dev_password@localhost:5488/hyperscape"
```

## Security Best Practices

### Never Commit Secrets

Add to `.gitignore`:
```
.env
.env.local
.env.production
*.env
deployer-keypair.json
```

### Use GitHub Secrets

For CI/CD, store secrets in GitHub repository settings:
- Settings → Secrets and variables → Actions
- Add repository secrets (not environment secrets for better compatibility)

### Rotate Secrets Regularly

- JWT_SECRET: Rotate every 90 days
- API keys: Rotate when team members leave
- Stream keys: Rotate if exposed in logs

### Generate Secure Secrets

```bash
# JWT_SECRET
openssl rand -base64 32

# ADMIN_CODE
openssl rand -hex 32

# Random password
openssl rand -base64 24
```

## Troubleshooting

### Secrets Not Persisting (Vast.ai)

**Problem**: Stream keys or DATABASE_URL not working after deployment.

**Cause**: Git reset overwrites .env file, or stale environment variables override .env values.

**Fix**: Secrets are now written to `/tmp/hyperscape-secrets.env` before git reset, then copied back. Verify:

```bash
# Check /tmp secrets file
cat /tmp/hyperscape-secrets.env

# Check .env file
cat /root/hyperscape/packages/server/.env

# Check environment (should show ***configured***)
grep "STREAM_KEY" /root/hyperscape/logs/duel-out.log
```

### JWT_SECRET Missing Error

**Problem**: Server throws error on startup: "JWT_SECRET is required in production/staging"

**Cause**: JWT_SECRET not set in production environment.

**Fix**:
```bash
# Generate secret
openssl rand -base64 32

# Add to .env
echo "JWT_SECRET=your-generated-secret" >> packages/server/.env

# Or set in Railway/Vast.ai environment
```

### Stream Keys Not Working

**Problem**: Streams not appearing on Twitch/Kick/X.

**Cause**: Stale stream keys in environment override .env file values.

**Fix**: The deploy script now explicitly unsets and re-exports stream keys:

```bash
# In deploy-vast.sh
unset TWITCH_STREAM_KEY X_STREAM_KEY X_RTMP_URL KICK_STREAM_KEY KICK_RTMP_URL
unset YOUTUBE_STREAM_KEY
export YOUTUBE_STREAM_KEY=""
source /root/hyperscape/packages/server/.env
```

Verify keys are configured:
```bash
pm2 logs hyperscape-duel | grep "STREAM_KEY"
# Should show: ***configured*** (not NOT SET)
```

### DATABASE_URL Lost After Git Reset

**Problem**: Database connection fails after deployment.

**Cause**: Git reset overwrites .env file.

**Fix**: Secrets are now written to `/tmp` before git reset:

```bash
# In deploy-vast.yml
cat > /tmp/hyperscape-secrets.env << 'EOF'
DATABASE_URL=${{ secrets.DATABASE_URL }}
# ... other secrets
EOF

# In deploy-vast.sh (after git reset)
cp /tmp/hyperscape-secrets.env /root/hyperscape/packages/server/.env
```

### Solana Keypair Not Found

**Problem**: Keeper bot or Anchor tools fail with "keypair not found".

**Cause**: ~/.config/solana/id.json not created from SOLANA_DEPLOYER_PRIVATE_KEY.

**Fix**:
```bash
# Run decode-key script
cd /root/hyperscape
bun run scripts/decode-key.ts

# Verify keypair exists
ls -la ~/.config/solana/id.json

# Check public key
solana-keygen pubkey ~/.config/solana/id.json
```

## Related Documentation

- [Vast.ai Deployment](vast-deployment.md)
- [Railway Deployment](railway-dev-prod.md)
- [Streaming Audio Capture](streaming-audio-capture.md)
- [Maintenance Mode API](maintenance-mode-api.md)
