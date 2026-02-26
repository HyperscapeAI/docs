# Streaming Stability Improvements (February 2026)

**Commit**: 14a1e1bbe558c0626a78f3d6e93197eb2e5d1a96  
**Author**: Shaw (@lalalune)

## Summary

Improved RTMP streaming reliability and WebGPU renderer initialization through increased stability thresholds, soft CDP recovery, and best-effort GPU limit negotiation.

## Changes

### 1. CDP Stall Threshold

**Increased**: 2 → 4 intervals (60s → 120s before restart)

```typescript
// packages/server/src/streaming/browser-capture.ts
const CDP_STALL_THRESHOLD = 4;  // Was: 2
```

**Rationale**: 2-interval threshold caused false restarts during legitimate pauses (loading screens, scene transitions). 4 intervals provides better tolerance for temporary stalls while still detecting real hangs.

**Impact**:
- Fewer false restarts
- More stable long-running streams
- Better handling of scene complexity spikes

### 2. Soft CDP Recovery

**Added**: Restart screencast without browser/FFmpeg teardown

```typescript
// Try soft recovery first (no stream gap)
await this.restartScreencast();

// Only do full restart if soft recovery fails
if (stillStalled) {
  await this.fullRestart();
}
```

**Benefits**:
- No stream interruption during recovery
- Faster recovery (no browser restart overhead)
- Preserves browser state (cookies, localStorage)

**Fallback**: Full restart if soft recovery fails after 3 attempts

### 3. FFmpeg Restart Attempts

**Increased**: 5 → 8 attempts

```typescript
const MAX_RESTART_ATTEMPTS = 8;  // Was: 5
```

**Rationale**: FFmpeg can fail transiently due to:
- Network hiccups
- RTMP server temporary unavailability
- Encoder initialization delays

8 attempts provides better resilience without infinite retry loops.

### 4. Capture Recovery Max Failures

**Increased**: 2 → 4 failures before full teardown

```typescript
const CAPTURE_RECOVERY_MAX_FAILURES = 4;  // Was: 2
```

**Rationale**: Allows more soft recovery attempts before giving up and doing full browser/FFmpeg restart.

### 5. WebGPU Best-Effort Initialization

**Added**: Retry with default limits if GPU rejects custom limits

```typescript
// Try with custom limits first
try {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxTextureArrayLayers: 2048  // Custom limit
    }
  });
} catch (error) {
  // Retry with default limits (no requiredLimits)
  const device = await adapter.requestDevice();
}
```

**Rationale**: Some GPUs reject custom limits even if they support the feature. Best-effort approach tries custom limits first, falls back to defaults if rejected.

**Result**: Always WebGPU (never falls back to WebGL in this path).

### 6. WebGL Fallback for Streaming

**Added**: Automatic WebGL fallback when WebGPU fails or is disabled

```typescript
// packages/shared/src/utils/rendering/RendererFactory.ts
if (forceWebGL || disableWebGPU || !navigator.gpu) {
  return createWebGLRenderer();
}

try {
  return await createWebGPURenderer();
} catch (error) {
  console.warn('WebGPU failed, falling back to WebGL:', error);
  return createWebGLRenderer();
}
```

**Query Params**:
- `?page=stream&forceWebGL=1` - Force WebGL
- `?page=stream&disableWebGPU=1` - Disable WebGPU

**Environment Variable**:
```bash
STREAM_CAPTURE_DISABLE_WEBGPU=true
```

**Use Cases**:
- Docker containers (WebGPU often unavailable)
- Vast.ai instances (GPU passthrough issues)
- Headless browsers (software rendering)

### 7. Swiftshader ANGLE Backend

**Updated**: ecosystem.config.cjs to use swiftshader for reliable software rendering

```javascript
// ecosystem.config.cjs
env: {
  STREAM_CAPTURE_DISABLE_WEBGPU: 'true',
  ANGLE_DEFAULT_PLATFORM: 'swiftshader',
  // ... other vars
}
```

**Rationale**: Swiftshader provides reliable software rendering when GPU is unavailable or unstable.

## Configuration

### Environment Variables

**packages/server/.env**:

```bash
# CDP stall detection (intervals before restart)
CDP_STALL_THRESHOLD=4                    # Default: 4 (120s)

# FFmpeg restart attempts
FFMPEG_MAX_RESTART_ATTEMPTS=8            # Default: 8

# Capture recovery failures before full teardown
CAPTURE_RECOVERY_MAX_FAILURES=4          # Default: 4

# Disable WebGPU for streaming (use WebGL fallback)
STREAM_CAPTURE_DISABLE_WEBGPU=false      # Default: false
```

### Tuning Guide

**Aggressive** (fast recovery, more restarts):
```bash
CDP_STALL_THRESHOLD=2
FFMPEG_MAX_RESTART_ATTEMPTS=5
CAPTURE_RECOVERY_MAX_FAILURES=2
```

**Conservative** (fewer restarts, longer tolerance):
```bash
CDP_STALL_THRESHOLD=6
FFMPEG_MAX_RESTART_ATTEMPTS=12
CAPTURE_RECOVERY_MAX_FAILURES=6
```

**Headless/Docker** (reliable software rendering):
```bash
STREAM_CAPTURE_DISABLE_WEBGPU=true
CDP_STALL_THRESHOLD=6
FFMPEG_MAX_RESTART_ATTEMPTS=10
```

## Debugging

### Check CDP Stall Detection

```bash
# In server logs, look for:
[StreamCapture] CDP stalled for 4 intervals, attempting soft recovery
[StreamCapture] Soft recovery successful
# or
[StreamCapture] Soft recovery failed, attempting full restart
```

### Check FFmpeg Restart Attempts

```bash
# In server logs, look for:
[StreamCapture] FFmpeg restart attempt 3/8
[StreamCapture] FFmpeg restarted successfully
# or
[StreamCapture] FFmpeg restart failed after 8 attempts, giving up
```

### Check WebGPU Initialization

```bash
# In browser console (streaming page):
WebGPU initialized with custom limits
# or
WebGPU initialization failed, retrying with default limits
# or
WebGPU unavailable, using WebGL fallback
```

### Monitor Stream Health

```bash
# Check RTMP connection
ffprobe rtmp://your-server/live/stream

# Check HLS playlist
curl http://your-server/live/stream.m3u8

# Monitor FFmpeg logs
tail -f /path/to/ffmpeg.log
```

## Performance Impact

### CDP Recovery

**Soft Recovery**:
- Time: ~2-5 seconds
- Stream gap: None (screencast restarts, FFmpeg continues)
- Browser state: Preserved

**Full Restart**:
- Time: ~10-20 seconds
- Stream gap: 5-10 seconds (browser + FFmpeg restart)
- Browser state: Lost (fresh browser instance)

### WebGPU vs WebGL

**WebGPU** (preferred):
- Better performance
- Lower CPU usage
- More features (compute shaders)

**WebGL** (fallback):
- More compatible (works in Docker/headless)
- Slightly higher CPU usage
- Proven reliability with software rendering

## Known Issues

### WebGPU Fails in Docker

**Symptom**: WebGPU initialization fails in Docker containers

**Cause**: GPU passthrough not configured or unavailable

**Solution**: Use WebGL fallback:
```bash
STREAM_CAPTURE_DISABLE_WEBGPU=true
```

### CDP Stalls During Scene Transitions

**Symptom**: CDP stalls during arena transitions or complex scenes

**Cause**: Browser busy with rendering, doesn't respond to CDP in time

**Solution**: Increase threshold:
```bash
CDP_STALL_THRESHOLD=6  # 180s tolerance
```

### FFmpeg Crashes on Startup

**Symptom**: FFmpeg fails to start, restarts repeatedly

**Cause**: RTMP server unavailable or invalid stream key

**Solution**:
1. Verify RTMP server is running
2. Check stream key is correct
3. Test with local nginx-rtmp:
   ```bash
   docker run -d -p 1935:1935 tiangolo/nginx-rtmp
   ```

## Testing

### Local RTMP Test

```bash
# Start local RTMP server
docker run -d -p 1935:1935 tiangolo/nginx-rtmp

# Configure server
export CUSTOM_RTMP_URL=rtmp://localhost:1935/live
export CUSTOM_STREAM_KEY=test

# Start streaming
bun run stream:test

# View stream
ffplay rtmp://localhost:1935/live/test
```

### Headless Rendering Test

```bash
# Force WebGL fallback
export STREAM_CAPTURE_DISABLE_WEBGPU=true

# Start streaming
bun run stream:rtmp

# Verify WebGL is used (check logs)
grep "WebGL" logs/stream-capture.log
```

### Stability Test

```bash
# Run stream for extended period
bun run stream:rtmp

# Monitor restart count
grep "restart attempt" logs/stream-capture.log | wc -l

# Should be low (<5 restarts per hour)
```

## Related Files

### Modified
- `packages/server/src/streaming/browser-capture.ts` - CDP stall detection
- `packages/server/src/streaming/stream-capture.ts` - FFmpeg restart logic
- `packages/shared/src/utils/rendering/RendererFactory.ts` - WebGPU/WebGL fallback
- `ecosystem.config.cjs` - Swiftshader ANGLE backend

### Configuration
- `packages/server/.env.example` - Environment variable documentation
- `.github/workflows/deploy-vast.yml` - CI/CD deployment

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - CDP documentation
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html) - FFmpeg reference
- [WebGPU Specification](https://www.w3.org/TR/webgpu/) - WebGPU API
- [ANGLE Project](https://chromium.googlesource.com/angle/angle/) - OpenGL ES implementation
