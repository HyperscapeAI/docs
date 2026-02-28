# Troubleshooting Guide

Common issues and solutions for Hyperscape development and deployment.

## Quick Diagnosis

### Symptoms → Solutions

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Black screen in browser | WebGPU unavailable | [WebGPU Issues](#webgpu-issues) |
| Characters vanishing | Missing Privy credentials | [Authentication Issues](#authentication-issues) |
| Assets not loading (404) | CDN not running | [Asset Loading Issues](#asset-loading-issues) |
| Stream not working | GPU/display issues | [Streaming Issues](#streaming-issues) |
| Database errors | Schema mismatch | [Database Issues](#database-issues) |
| Port conflicts | Services already running | [Port Conflicts](#port-conflicts) |

## WebGPU Issues

### Black Screen / "WebGPU is REQUIRED"

**Symptoms**:
- Browser shows black screen
- Console error: "WebGPU is REQUIRED but not available"
- Game doesn't render

**Diagnosis**:
```typescript
// Check WebGPU availability
if (!await navigator.gpu?.requestAdapter()) {
  console.error('WebGPU not available');
}
```

**Solutions**:

1. **Update Browser**:
   - Chrome 113+ (recommended)
   - Edge 113+
   - Safari 18+ (macOS 15+)
   - Check: https://webgpureport.org

2. **Enable Hardware Acceleration**:
   - Chrome: `chrome://settings` → Advanced → System → "Use hardware acceleration"
   - Safari: Preferences → Advanced → "Use hardware acceleration"

3. **Update GPU Drivers**:
   - NVIDIA: https://www.nvidia.com/drivers
   - AMD: https://www.amd.com/support
   - Intel: https://www.intel.com/content/www/us/en/download-center/home.html

4. **Check Browser Flags** (Chrome):
   - Visit `chrome://flags`
   - Search "WebGPU"
   - Ensure "Unsafe WebGPU" is enabled

### WebGPU Initialization Failed

**Symptoms**:
- WebGPU detected but renderer fails to initialize
- Error: "Renderer initialization FAILED"

**Solutions**:

1. **Check GPU Compatibility**:
   ```bash
   # Visit in browser
   https://webgpureport.org
   
   # Check for required features
   ```

2. **Try Different Browser**:
   - Chrome usually has best WebGPU support
   - Edge is second-best
   - Safari requires macOS 15+

3. **Disable Browser Extensions**:
   - Some extensions interfere with WebGPU
   - Try incognito/private mode

## Streaming Issues

### "Cannot establish WebGPU-capable rendering mode"

**Symptoms**:
- Vast.ai deployment fails
- Error in deploy logs
- Streaming doesn't start

**Diagnosis**:
```bash
# SSH to Vast.ai instance
ssh -p $VAST_PORT root@$VAST_HOST

# Check GPU
nvidia-smi

# Check Vulkan
vulkaninfo --summary

# Check display
xdpyinfo -display :99

# Check Xorg logs
cat /var/log/Xorg.99.log
```

**Solutions**:

1. **Verify NVIDIA GPU**:
   ```bash
   nvidia-smi
   # Should show GPU info, not error
   ```

2. **Check Vulkan ICD**:
   ```bash
   ls -la /usr/share/vulkan/icd.d/nvidia_icd.json
   # Should exist
   ```

3. **Verify Display Server**:
   ```bash
   ps aux | grep -E "Xorg|Xvfb"
   # Should show running process
   ```

4. **Check DRI Devices**:
   ```bash
   ls -la /dev/dri/
   # If empty, Xvfb fallback will be used
   ```

### Audio Not Capturing

**Symptoms**:
- Stream has video but no audio
- FFmpeg error: "pulse: Connection refused"

**Diagnosis**:
```bash
# Check PulseAudio
pulseaudio --check
echo $?  # Should be 0

# List sinks
pactl list short sinks
# Should show chrome_audio

# Check permissions
ls -la /tmp/pulse-runtime
```

**Solutions**:

1. **Restart PulseAudio**:
   ```bash
   pulseaudio --kill
   pulseaudio --start --exit-idle-time=-1
   pactl load-module module-null-sink sink_name=chrome_audio
   ```

2. **Fix Permissions**:
   ```bash
   chmod 700 /tmp/pulse-runtime
   chown root:root /tmp/pulse-runtime
   ```

3. **Verify Sink**:
   ```bash
   pactl list short sinks | grep chrome_audio
   # Should show: chrome_audio module-null-sink
   ```

### Stream Stalls/Buffering

**Symptoms**:
- Viewers experience buffering
- Stream freezes intermittently
- FFmpeg warnings about buffer

**Solutions**:

1. **Increase GOP Size**:
   ```bash
   STREAM_GOP_SIZE=90  # 3 seconds at 30fps
   ```

2. **Enable Low Latency**:
   ```bash
   STREAM_LOW_LATENCY=true
   ```

3. **Check Network**:
   ```bash
   # Test upload speed
   speedtest-cli --upload-only
   # Should be >10 Mbps for 720p30
   ```

4. **Reduce Bitrate**:
   ```typescript
   // In ecosystem.config.cjs or rtmp-bridge.ts
   bitrate: 3000000  // 3 Mbps instead of 4.5 Mbps
   ```

### CDP Capture Stalls

**Symptoms**:
- "CDP capture stalled" warnings
- No frames for 30+ seconds
- Automatic recovery attempts

**Automatic Recovery**:
- System tries soft recovery (restart screencast)
- Falls back to hard recovery (restart browser)
- Switches to MediaRecorder after 6 failures

**Manual Recovery**:
```bash
bunx pm2 restart hyperscape-duel
```

## Authentication Issues

### Characters Vanishing

**Symptoms**:
- Characters disappear after page refresh
- Character select shows no characters
- New character created every time

**Cause**: Missing Privy credentials → anonymous mode → new user ID each refresh

**Solution**:

1. **Get Privy Credentials**:
   - Sign up: https://dashboard.privy.io
   - Create app
   - Copy App ID and App Secret

2. **Configure Client**:
   ```bash
   # packages/client/.env
   PUBLIC_PRIVY_APP_ID=your-app-id
   ```

3. **Configure Server**:
   ```bash
   # packages/server/.env
   PUBLIC_PRIVY_APP_ID=your-app-id
   PRIVY_APP_SECRET=your-app-secret
   ```

4. **Restart**:
   ```bash
   bun run dev
   ```

## Asset Loading Issues

### 404 Errors for Models/Avatars

**Symptoms**:
- Console errors: "Failed to load resource: 404"
- Missing 3D models
- Avatars don't appear

**Cause**: CDN container not running

**Solution**:

```bash
# Start CDN
bun run cdn:up

# Verify CDN is running
curl http://localhost:8080/health
# Should return 200 OK

# Check Docker
docker ps | grep cdn
# Should show running container
```

### Git LFS Files Not Downloaded

**Symptoms**:
- Asset files are tiny (< 1KB)
- Models don't load
- Textures are missing

**Solution**:

```bash
# Install Git LFS
brew install git-lfs  # macOS
apt install git-lfs   # Linux

# Initialize Git LFS
git lfs install

# Pull LFS files
git lfs pull

# Verify
ls -lh packages/server/world/assets/models/
# Files should be >1KB
```

## Database Issues

### Schema Errors / Stale Data

**Symptoms**:
- "column does not exist" errors
- "relation does not exist" errors
- Old data after pulling updates

**Cause**: Database schema out of sync with code

**Solution** (⚠️ Deletes all local data):

```bash
# Stop and remove postgres container
docker stop hyperscape-postgres 2>/dev/null
docker rm hyperscape-postgres 2>/dev/null

# Remove volumes
docker volume rm hyperscape-postgres-data 2>/dev/null
docker volume rm server_postgres-data 2>/dev/null

# Remove all hyperscape volumes
docker volume ls | grep hyperscape | awk '{print $2}' | xargs -r docker volume rm

# Verify cleanup
docker volume ls | grep hyperscape
# Should show nothing

# Restart with fresh database
bun run dev
```

### Connection Refused

**Symptoms**:
- "ECONNREFUSED" errors
- "Connection refused" in logs

**Solutions**:

1. **Check Docker**:
   ```bash
   docker ps | grep postgres
   # Should show running container
   ```

2. **Check Port**:
   ```bash
   lsof -i:5488
   # Should show postgres
   ```

3. **Check DATABASE_URL**:
   ```bash
   # packages/server/.env
   DATABASE_URL=postgresql://hyperscape:hyperscape_dev_password@localhost:5488/hyperscape
   ```

## Port Conflicts

### "Address already in use"

**Symptoms**:
- Error: "EADDRINUSE"
- Server won't start

**Diagnosis**:
```bash
# Check what's using the port
lsof -i:5555  # Game server
lsof -i:3333  # Client
lsof -i:8080  # CDN
```

**Solutions**:

```bash
# Kill process on port
lsof -ti:5555 | xargs kill -9

# Or kill all Hyperscape ports
lsof -ti:5555 | xargs kill -9  # Server
lsof -ti:3333 | xargs kill -9  # Client
lsof -ti:8080 | xargs kill -9  # CDN
lsof -ti:4001 | xargs kill -9  # ElizaOS
```

## Build Issues

### Build Fails

**Symptoms**:
- TypeScript errors
- "Cannot find module" errors
- Build hangs

**Solutions**:

1. **Clean Build**:
   ```bash
   npm run clean
   rm -rf node_modules packages/*/node_modules
   bun install
   bun run build
   ```

2. **Build Order**:
   ```bash
   # Build in correct order
   cd packages/physx-js-webidl && bun run build && cd ../..
   cd packages/shared && bun run build && cd ../..
   bun run build
   ```

3. **Check Bun Version**:
   ```bash
   bun --version
   # Should be 1.1.38 or higher
   ```

### PhysX Build Fails

**Symptoms**:
- PhysX WASM build errors
- Missing physx-js-webidl.wasm

**Solution**:

PhysX is pre-built and committed. If you need to rebuild:

```bash
cd packages/physx-js-webidl

# Requires emscripten toolchain
./make.sh

# Or use Docker
docker-compose up
```

## Test Failures

### Tests Timeout

**Symptoms**:
- Tests hang indefinitely
- Playwright timeout errors

**Solutions**:

1. **Kill Existing Servers**:
   ```bash
   lsof -ti:5555 | xargs kill -9
   lsof -ti:3333 | xargs kill -9
   ```

2. **Increase Timeout**:
   ```typescript
   // In test file
   test('my test', async () => {
     // ...
   }, { timeout: 60000 });  // 60 seconds
   ```

3. **Check Logs**:
   ```bash
   ls -la logs/
   cat logs/test-*.log
   ```

### Visual Tests Fail

**Symptoms**:
- Screenshot comparison failures
- "WebGPU not available" in tests

**Solutions**:

1. **Use Headful Browser**:
   ```typescript
   const browser = await chromium.launch({
     headless: false  // Required for WebGPU
   });
   ```

2. **Enable WebGPU Flags**:
   ```typescript
   const browser = await chromium.launch({
     args: [
       '--enable-unsafe-webgpu',
       '--enable-features=Vulkan,UseSkiaRenderer,WebGPU'
     ]
   });
   ```

## AI Agent Issues

### Agents Not Responding

**Symptoms**:
- Agents stand still
- No LLM calls in logs
- "Action lock" messages

**Diagnosis**:
```bash
# Check agent status
curl http://localhost:4001/api/agents

# Check agent logs
bunx pm2 logs hyperscape-duel | grep "Agent Decision"
```

**Solutions**:

1. **Check API Keys**:
   ```bash
   # packages/plugin-hyperscape/.env
   OPENAI_API_KEY=sk-...
   # or
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Check Movement State**:
   ```typescript
   // In agent dashboard
   console.log('Is moving:', agent.isMoving());
   // If stuck in moving state, restart agent
   ```

3. **Restart Agents**:
   ```bash
   bunx pm2 restart hyperscape-duel
   ```

### High LLM Costs

**Symptoms**:
- Unexpected API bills
- Many LLM calls per minute

**Solutions**:

1. **Enable Optimizations**:
   - Action locks (automatic)
   - Fast-tick mode (automatic)
   - Short-circuit decisions (automatic)

2. **Check Call Frequency**:
   ```bash
   bunx pm2 logs hyperscape-duel | grep "LLM Call" | wc -l
   # Should be <2 per minute per agent
   ```

3. **Reduce Agent Count**:
   ```bash
   # packages/server/.env
   AUTO_START_AGENTS_MAX=5  # Reduce from 10
   ```

## Deployment Issues

### Railway Deployment Fails

**Symptoms**:
- Build fails in Railway
- "Out of memory" errors

**Solutions**:

1. **Check Build Logs**:
   - Railway dashboard → Deployments → View logs

2. **Increase Memory**:
   - Railway dashboard → Settings → Resources
   - Increase memory limit

3. **Check Environment Variables**:
   - Railway dashboard → Variables
   - Verify all required vars are set

### Vast.ai Deployment Fails

**Symptoms**:
- GitHub Actions workflow fails
- SSH connection errors
- GPU validation errors

**Solutions**:

1. **Check GitHub Secrets**:
   - Repository → Settings → Secrets
   - Verify: `VAST_HOST`, `VAST_PORT`, `VAST_SSH_KEY`

2. **Check Vast.ai Instance**:
   - Vast.ai dashboard → Instances
   - Verify instance is running
   - Check SSH port is correct

3. **Check GPU**:
   ```bash
   # SSH to instance
   ssh -p $VAST_PORT root@$VAST_HOST
   
   # Verify GPU
   nvidia-smi
   ```

## Performance Issues

### Low FPS

**Symptoms**:
- Game runs slowly
- FPS < 30

**Solutions**:

1. **Check GPU Usage**:
   - Browser DevTools → Performance
   - Should show GPU activity

2. **Reduce Graphics Settings**:
   - In-game settings → Graphics
   - Lower shadow quality
   - Reduce view distance

3. **Check CPU Usage**:
   ```bash
   # macOS
   top -o cpu
   
   # Linux
   htop
   ```

### High Memory Usage

**Symptoms**:
- Browser uses >4GB RAM
- "Out of memory" errors

**Solutions**:

1. **Restart Browser**:
   - Close and reopen browser
   - Clears WebGPU memory leaks

2. **Reduce Instance Count**:
   - Fewer trees/rocks in view
   - Lower LOD distances

3. **Check for Leaks**:
   ```typescript
   // In browser console
   performance.memory.usedJSHeapSize / 1024 / 1024
   // Should be <500MB
   ```

## Network Issues

### WebSocket Connection Failed

**Symptoms**:
- "WebSocket connection failed"
- "Connection refused"
- Can't connect to server

**Solutions**:

1. **Check Server Running**:
   ```bash
   curl http://localhost:5555/health
   # Should return 200 OK
   ```

2. **Check WebSocket URL**:
   ```bash
   # packages/client/.env
   PUBLIC_WS_URL=ws://localhost:5555/ws
   # Must match server port
   ```

3. **Check Firewall**:
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   
   # Linux
   sudo ufw status
   ```

### High Latency

**Symptoms**:
- Actions feel delayed
- Rubber-banding
- Lag spikes

**Solutions**:

1. **Check Network**:
   ```bash
   ping localhost
   # Should be <1ms
   ```

2. **Check Server Load**:
   ```bash
   # In server logs
   [Status] Tick time: 45ms
   # Should be <50ms
   ```

3. **Reduce Tick Rate**:
   ```bash
   # packages/server/.env
   SERVER_RUNTIME_MAX_TICKS_PER_FRAME=1
   SERVER_RUNTIME_MIN_DELAY_MS=10
   ```

## CSP Violations

### "Refused to load script"

**Symptoms**:
- Console error: "Refused to load the script"
- External resources blocked

**Solutions**:

1. **Check CSP Policy**:
   ```bash
   curl -I http://localhost:3333
   # Look for Content-Security-Policy header
   ```

2. **Add to Allowlist**:
   ```typescript
   // In packages/client/vite.config.ts
   const CSP_POLICY = `
     script-src 'self' https://trusted-cdn.com;
   `;
   ```

3. **Verify Source is Trusted**:
   - Only add trusted CDNs
   - Verify HTTPS
   - Check for SRI hashes

## Common Error Messages

### "No screens found" (Xorg)

**Cause**: DRI/DRM devices not available

**Solution**: Script automatically falls back to Xvfb

### "swrast" in Xorg logs

**Cause**: NVIDIA driver failed, using software rendering

**Solution**: Script detects this and switches to Xvfb

### "Execution context was destroyed"

**Cause**: Page navigation during operation

**Solution**: Transient error, automatically retried

### "Target page, context or browser has been closed"

**Cause**: Browser closed during operation

**Solution**: Restart streaming process

## Getting Help

### Before Asking for Help

1. **Check this guide** for your specific issue
2. **Check logs**:
   ```bash
   # Server logs
   bunx pm2 logs hyperscape-duel
   
   # Browser console
   # Open DevTools → Console
   
   # Test logs
   ls -la logs/
   ```

3. **Check documentation**:
   - [README.md](../README.md)
   - [CLAUDE.md](../CLAUDE.md)
   - [docs/](.)

### Reporting Issues

Include in your issue report:

1. **Environment**:
   - OS and version
   - Browser and version
   - Node/Bun version
   - GPU model

2. **Steps to Reproduce**:
   - Exact commands run
   - Configuration used
   - Expected vs actual behavior

3. **Logs**:
   - Server logs (bunx pm2 logs)
   - Browser console errors
   - Test output (if applicable)

4. **Screenshots**:
   - Error messages
   - Browser DevTools
   - Visual issues

### Support Channels

- **GitHub Issues**: https://github.com/HyperscapeAI/hyperscape/issues
- **GitHub Discussions**: https://github.com/HyperscapeAI/hyperscape/discussions
- **Documentation**: [docs/](.)

## Diagnostic Commands

### System Info

```bash
# OS
uname -a

# Bun version
bun --version

# Node version
node --version

# Docker version
docker --version

# GPU info (NVIDIA)
nvidia-smi

# GPU info (macOS)
system_profiler SPDisplaysDataType

# Vulkan info
vulkaninfo --summary
```

### Service Status

```bash
# PM2 processes
bunx pm2 status

# Docker containers
docker ps

# Ports in use
lsof -i -P -n | grep LISTEN

# Disk space
df -h

# Memory usage
free -h  # Linux
vm_stat  # macOS
```

### Network Diagnostics

```bash
# Test server
curl http://localhost:5555/health

# Test WebSocket
wscat -c ws://localhost:5555/ws

# Test CDN
curl http://localhost:8080/health

# Test streaming
curl http://localhost:5555/api/streaming/state
```

## References

- **Main Documentation**: [README.md](../README.md)
- **Development Guide**: [CLAUDE.md](../CLAUDE.md)
- **Recent Changes**: [docs/RECENT_CHANGES.md](RECENT_CHANGES.md)
- **Environment Variables**: [docs/configuration/environment-variables.md](configuration/environment-variables.md)
