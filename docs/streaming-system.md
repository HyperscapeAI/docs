# Streaming System

Hyperscape includes a dedicated streaming capture system for broadcasting AI agent duels to platforms like Twitch and YouTube.

## Architecture

The streaming system consists of three main components:

### 1. Stream Entry Point (`stream.html` / `stream.tsx`)

Dedicated entry point optimized for streaming capture:

- **Minimal UI**: No HUD, panels, or interactive elements
- **Spectator Mode**: Camera follows active duel participants
- **Optimized Rendering**: Reduced draw calls and simplified materials
- **Viewport Detection**: Automatically detects stream vs. normal gameplay mode

**Entry Points:**
- `packages/client/stream.html` - HTML entry point
- `packages/client/src/stream.tsx` - React streaming app
- `packages/client/vite.config.ts` - Multi-page build configuration

### 2. Browser Capture (`packages/server/src/streaming/browser-capture.ts`)

Puppeteer-based headless browser that:

- Launches Chrome with WebGPU support
- Navigates to stream entry point
- Captures canvas frames at target FPS
- Handles graceful shutdown and error recovery

**Requirements:**
- **NVIDIA GPU with Display Driver** - Must have `gpu_display_active=true` on Vast.ai
- **Xorg or Xvfb** - WebGPU requires window context (no headless mode)
- **Chrome 113+** - WebGPU support required

### 3. RTMP Bridge (`packages/server/src/streaming/rtmp-bridge.ts`)

FFmpeg-based encoder that:

- Receives frames from browser capture
- Encodes to H.264 with target bitrate
- Streams to RTMP destinations (Twitch, YouTube, custom)
- Handles reconnection and placeholder frames during idle periods

## Configuration

### Environment Variables

**Server (`packages/server/.env`):**

```bash
# Streaming Toggle
STREAMING_ENABLED=true

# RTMP Destinations
STREAMING_RTMP_URL=rtmp://live.twitch.tv/app/your-stream-key
# OR multiple destinations (comma-separated)
STREAMING_RTMP_URL=rtmp://live.twitch.tv/app/key1,rtmp://a.rtmp.youtube.com/live2/key2

# Stream Quality
STREAMING_WIDTH=1920
STREAMING_HEIGHT=1080
STREAMING_FPS=30
STREAMING_BITRATE=6000k

# Browser Capture
STREAMING_BROWSER_HEADLESS=false  # Must be false for WebGPU
STREAMING_BROWSER_TIMEOUT=30000

# Placeholder Mode (prevents disconnects during idle)
STREAMING_PLACEHOLDER_ENABLED=true
STREAMING_PLACEHOLDER_FPS=1
```

**Client (`packages/client/.env`):**

```bash
# Stream entry point URL (used by browser capture)
PUBLIC_STREAM_URL=http://localhost:3333/stream.html
```

### Viewport Mode Detection

The client automatically detects stream mode using `clientViewportMode` utility:

```typescript
import { clientViewportMode } from './lib/clientViewportMode';

const mode = clientViewportMode(); // 'stream' | 'spectator' | 'normal'

if (mode === 'stream') {
  // Hide HUD, disable interactions
}
```

**Detection Logic:**
- `stream.html` entry point → `'stream'`
- `?spectator=true` query param → `'spectator'`
- Default → `'normal'`

## Deployment

### Vast.ai GPU Instances

The streaming system is designed for deployment on Vast.ai GPU instances:

**Requirements:**
- **GPU**: NVIDIA with display driver (`gpu_display_active=true`)
- **RAM**: 16GB+ recommended
- **Storage**: 50GB+ for Docker images and assets
- **Network**: 10+ Mbps upload for 1080p30 streaming

**Deployment Script:**

```bash
# From repository root
bash scripts/deploy-vast.sh
```

**What it does:**
1. Provisions Vast.ai instance with GPU
2. Installs Docker, Node.js, Bun
3. Clones repository and installs dependencies
4. Builds client and server
5. Starts PM2 processes (server + streaming)
6. Configures Xvfb for headless GPU access

**PM2 Configuration (`ecosystem.config.cjs`):**

```javascript
{
  name: 'hyperscape-server',
  script: 'bun',
  args: 'run start',
  cwd: './packages/server',
  env: {
    NODE_ENV: 'production',
    STREAMING_ENABLED: 'true',
    // ... other env vars
  }
}
```

### Manual Deployment

**1. Install Dependencies:**

```bash
# System packages
sudo apt-get update
sudo apt-get install -y \
  xvfb \
  x11vnc \
  fluxbox \
  ffmpeg \
  chromium-browser

# Node.js and Bun
curl -fsSL https://bun.sh/install | bash
```

**2. Configure Xvfb:**

```bash
# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

**3. Build and Start:**

```bash
# Build
bun install
bun run build

# Start server with streaming
cd packages/server
STREAMING_ENABLED=true bun run start
```

## Stream Destinations

### Twitch

```bash
STREAMING_RTMP_URL=rtmp://live.twitch.tv/app/YOUR_STREAM_KEY
```

**Get Stream Key:**
1. Go to [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream)
2. Copy "Primary Stream Key"
3. Set as `STREAMING_RTMP_URL`

### YouTube

```bash
STREAMING_RTMP_URL=rtmp://a.rtmp.youtube.com/live2/YOUR_STREAM_KEY
```

**Get Stream Key:**
1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click "Go Live" → "Stream"
3. Copy "Stream key"
4. Set as `STREAMING_RTMP_URL`

### Multiple Destinations

Stream to multiple platforms simultaneously:

```bash
STREAMING_RTMP_URL=rtmp://live.twitch.tv/app/key1,rtmp://a.rtmp.youtube.com/live2/key2
```

### Custom RTMP Server

Stream to your own RTMP server:

```bash
STREAMING_RTMP_URL=rtmp://your-server.com/live/stream-key
```

## Monitoring

### Stream Health

The server exposes streaming health endpoints:

**Check Status:**
```bash
curl http://localhost:5555/api/streaming/status
```

**Response:**
```json
{
  "enabled": true,
  "active": true,
  "destinations": [
    {
      "url": "rtmp://live.twitch.tv/app/***",
      "connected": true,
      "uptime": 3600000
    }
  ],
  "browser": {
    "running": true,
    "fps": 30,
    "lastFrame": "2026-03-09T12:00:00.000Z"
  }
}
```

### Logs

**Server Logs:**
```bash
# PM2 logs
pm2 logs hyperscape-server

# Direct logs
tail -f packages/server/logs/streaming.log
```

**Browser Logs:**
```bash
# Puppeteer console output
tail -f packages/server/logs/browser-capture.log
```

**FFmpeg Logs:**
```bash
# Encoder output
tail -f packages/server/logs/rtmp-bridge.log
```

## Troubleshooting

### WebGPU Not Available

**Symptom:** Browser fails to initialize WebGPU

**Solutions:**
- Ensure GPU has display driver (`gpu_display_active=true` on Vast.ai)
- Verify Xvfb is running: `ps aux | grep Xvfb`
- Check `DISPLAY` environment variable: `echo $DISPLAY`
- Test WebGPU in browser: Navigate to `chrome://gpu` in Puppeteer

### Stream Disconnects

**Symptom:** RTMP connection drops during idle periods

**Solutions:**
- Enable placeholder mode: `STREAMING_PLACEHOLDER_ENABLED=true`
- Increase placeholder FPS: `STREAMING_PLACEHOLDER_FPS=2`
- Check network stability: `ping -c 100 live.twitch.tv`
- Verify bitrate is within upload capacity

### High CPU Usage

**Symptom:** Server CPU usage >80%

**Solutions:**
- Reduce stream resolution: `STREAMING_WIDTH=1280 STREAMING_HEIGHT=720`
- Lower FPS: `STREAMING_FPS=24`
- Reduce bitrate: `STREAMING_BITRATE=4000k`
- Enable hardware encoding (if available): `STREAMING_HWACCEL=true`

### Frame Drops

**Symptom:** Stuttering or low FPS in stream

**Solutions:**
- Check GPU utilization: `nvidia-smi`
- Increase browser timeout: `STREAMING_BROWSER_TIMEOUT=60000`
- Verify network bandwidth: `speedtest-cli`
- Reduce concurrent viewers in game

### Memory Leaks

**Symptom:** Memory usage grows over time

**Solutions:**
- Restart streaming periodically: `pm2 restart hyperscape-server`
- Enable garbage collection: `NODE_OPTIONS=--max-old-space-size=4096`
- Monitor memory: `pm2 monit`
- Check for zombie processes: `ps aux | grep chrome`

## Advanced Configuration

### Custom Camera Behavior

Override default spectator camera in `packages/shared/src/systems/client/ClientCamera.ts`:

```typescript
// Follow specific agent
camera.followEntity(agentEntity);

// Fixed camera position
camera.setPosition(x, y, z);
camera.lookAt(targetX, targetY, targetZ);

// Orbit around duel arena
camera.orbitAround(centerX, centerY, centerZ, radius, speed);
```

### Stream Overlays

Add custom overlays in `packages/client/src/stream.tsx`:

```typescript
<StreamOverlay>
  <AgentStats agentA={agentA} agentB={agentB} />
  <DuelTimer startTime={startTime} />
  <Scoreboard />
</StreamOverlay>
```

### Quality Presets

**1080p60 (High Quality):**
```bash
STREAMING_WIDTH=1920
STREAMING_HEIGHT=1080
STREAMING_FPS=60
STREAMING_BITRATE=8000k
```

**720p30 (Balanced):**
```bash
STREAMING_WIDTH=1280
STREAMING_HEIGHT=720
STREAMING_FPS=30
STREAMING_BITRATE=4000k
```

**480p30 (Low Bandwidth):**
```bash
STREAMING_WIDTH=854
STREAMING_HEIGHT=480
STREAMING_FPS=30
STREAMING_BITRATE=2000k
```

## Integration with Duel System

The streaming system integrates with the duel scheduler:

**Automatic Stream Activation:**
- Stream starts when duel begins
- Camera follows active participants
- Placeholder mode during idle periods

**Event Hooks:**
```typescript
world.on('streaming:duel:start', (event) => {
  // Duel started, stream is active
});

world.on('streaming:duel:end', (event) => {
  // Duel ended, switch to placeholder
});
```

## Performance Optimization

### GPU Utilization

Monitor GPU usage:
```bash
watch -n 1 nvidia-smi
```

**Target Utilization:**
- GPU: 60-80%
- Memory: <8GB
- Temperature: <80°C

### Network Optimization

**Bandwidth Requirements:**
- 1080p60: 8-10 Mbps upload
- 1080p30: 5-7 Mbps upload
- 720p30: 3-5 Mbps upload

**Latency:**
- Target: <100ms to RTMP server
- Test: `ping live.twitch.tv`

### Resource Limits

**PM2 Configuration:**
```javascript
{
  max_memory_restart: '4G',
  max_restarts: 10,
  min_uptime: '10s',
  autorestart: true
}
```

## Security Considerations

### Stream Keys

**Never commit stream keys to version control:**
- Use `.env` files (gitignored)
- Rotate keys periodically
- Use separate keys for dev/prod

### Access Control

**Restrict stream endpoints:**
```typescript
// packages/server/src/startup/routes/streaming-routes.ts
fastify.get('/api/streaming/status', {
  preHandler: [requireAuth, requireAdmin]
}, async (request, reply) => {
  // Only admins can view stream status
});
```

### Network Security

**Firewall Rules:**
```bash
# Allow RTMP outbound
sudo ufw allow out 1935/tcp

# Block RTMP inbound (unless running RTMP server)
sudo ufw deny in 1935/tcp
```

## Future Enhancements

**Planned Features:**
- Multi-camera angles
- Automatic highlight detection
- Chat integration (Twitch/YouTube)
- Stream analytics dashboard
- VOD recording and archival
- Dynamic bitrate adjustment
- Scene transitions and effects

## Related Documentation

- [Duel Stack Documentation](./duel-stack.md)
- [Vast.ai Deployment Guide](./vast-deployment.md)
- [Oracle Integration](./duel-arena-oracle-deploy.md)
- [Server Configuration](../packages/server/.env.example)
