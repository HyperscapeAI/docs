# Deployment Best Practices

This guide consolidates best practices for deploying Hyperscape to production, based on lessons learned from recent stability improvements and production deployments.

## Table of Contents

1. [Database Configuration](#database-configuration)
2. [Streaming Pipeline](#streaming-pipeline)
3. [Zero-Downtime Deployments](#zero-downtime-deployments)
4. [Memory Management](#memory-management)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Troubleshooting](#troubleshooting)

## Database Configuration

### Railway Deployments

Railway uses connection pooling (pgbouncer) which requires special configuration. The server **automatically detects Railway** and applies the correct settings.

**Detection methods** (in order of reliability):
1. `RAILWAY_ENVIRONMENT` environment variable (most reliable)
2. Hostname patterns: `.rlwy.net`, `.railway.app`, `.railway.internal`

**Automatic adjustments when Railway is detected:**
- Disables prepared statements (not supported by pgbouncer)
- Uses lower connection pool limits (max: 6 instead of 20)
- Prevents "too many clients already" errors

**Recommended Railway environment variables:**

```bash
# Standard deployment
POSTGRES_POOL_MAX=6              # Lower limit for pooler connections
POSTGRES_POOL_MIN=0              # Don't hold idle connections

# Crash loop scenarios (server restarting frequently)
POSTGRES_POOL_MAX=3              # Even lower to prevent exhaustion
POSTGRES_POOL_MIN=0              # Don't hold idle connections
```

**PM2 configuration for Railway:**

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'hyperscape-server',
    script: './dist/index.js',
    restart_delay: 10000,            // 10s instead of 5s
    exp_backoff_restart_delay: 2000, // 2s for gradual backoff
    max_restarts: 10,
  }]
};
```

### Neon/Supabase Deployments

Serverless databases require different configuration:

```bash
# Neon/Supabase recommended settings
POSTGRES_POOL_MAX=10             # Moderate limit for serverless
POSTGRES_POOL_MIN=1              # Keep 1 connection warm
```

**Automatic detection:**
- Neon: `neon.tech` in connection string
- Supabase: `supabase.co` in connection string
- Pooler: `pooler` or `-pooler.` in connection string

### General Database Best Practices

1. **Always set explicit pool limits** - Don't rely on defaults
2. **Use `POSTGRES_POOL_MIN=0` for crash-prone deployments** - Prevents holding connections during restarts
3. **Increase restart delays** - Give connections time to close before PM2 restarts
4. **Monitor connection pool stats** - Use `/admin/pools/stats` endpoint
5. **Test with low limits first** - Start with `POSTGRES_POOL_MAX=3` and increase if needed

### Process Teardown Before Migrations

The deployment script now tears down existing processes **before** running database migrations:

```bash
# In scripts/deploy-vast.sh

# Stop PM2 gracefully
bunx pm2 stop all
sleep 2
bunx pm2 delete all
sleep 2
bunx pm2 kill
sleep 2

# Kill specific server processes (not all bun processes)
pkill -f "hyperscape-duel" || true
pkill -f "stream-to-rtmp" || true

# Wait for database connections to close
sleep 30

# NOW run migrations
bunx drizzle-kit push --force
```

**Why this matters:**
- Prevents "too many clients already" errors during migrations
- Ensures clean database state before schema changes
- Avoids race conditions between old processes and new schema

## Streaming Pipeline

### Placeholder Frame Mode

**Problem:** Twitch/YouTube disconnect streams after ~30 minutes of idle content.

**Solution:** Enable placeholder frame mode to keep streams alive during idle periods.

```bash
# In packages/server/.env or root .env
STREAM_PLACEHOLDER_ENABLED=true
```

**How it works:**
- Detects when no frames received for 5 seconds
- Switches to placeholder mode, sending minimal JPEG frames at configured FPS
- Automatically exits placeholder mode when live frames resume
- Uses minimal 16x16 JPEG (~300 bytes) scaled by FFmpeg to output size
- Zero CPU overhead - just pipes pre-generated JPEG buffer

**Use cases:**
- Duel arena between fights (ANNOUNCEMENT/RESOLUTION phases)
- Server maintenance or restarts
- Browser capture failures or reconnections
- Any content gap >5 seconds

### Stream Encoding Optimization

**Default configuration** (balanced quality and latency):

```bash
# Uses 'film' tune with B-frames for better compression
# GOP size: 60 frames (2 seconds at 30fps)
# Buffer: 2x bitrate (prevents backpressure buildup)
STREAM_GOP_SIZE=60
```

**Low-latency configuration** (faster playback start, lower quality):

```bash
# Uses 'zerolatency' tune, no B-frames
# Faster playback start, but larger file size
STREAM_LOW_LATENCY=true
STREAM_GOP_SIZE=30               # Smaller GOP for faster seeking
```

**Audio configuration:**

```bash
# Enable audio capture from PulseAudio
STREAM_AUDIO_ENABLED=true
PULSE_AUDIO_DEVICE=chrome_audio.monitor

# Disable audio (silent stream)
STREAM_AUDIO_ENABLED=false
```

### Production Client Build

**Problem:** Browser timeout during page load (>180s) caused by Vite's JIT compilation.

**Solution:** Use production client build for streaming deployments.

```bash
# In packages/server/.env
NODE_ENV=production              # Use production client build
DUEL_USE_PRODUCTION_CLIENT=true  # Force production client for streaming
```

**Benefits:**
- Significantly faster page loads (no on-demand module compilation)
- Fixes browser timeout issues
- Reduces server CPU usage
- More stable for long-running streams

### WebGPU Initialization

**Page navigation timeout** increased to 120s (up from 60s) for WebGPU shader compilation on first load.

```bash
# Automatically applied - no configuration needed
# Allows time for WebGPU shader compilation
```

**Browser restart** every 45 minutes to prevent WebGPU OOM crashes:

```bash
# Automatically applied - no configuration needed
# Prevents memory leaks in Chrome's WebGPU implementation
```

## Zero-Downtime Deployments

### Graceful Restart API

Request a server restart after the current duel ends:

```bash
# Request graceful restart
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Check restart status
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Response:**
```json
{
  "success": true,
  "message": "Graceful restart scheduled after current duel (phase: FIGHTING)",
  "pendingRestart": true,
  "currentPhase": "FIGHTING"
}
```

**Behavior:**
- **IDLE/ANNOUNCEMENT phase**: Restarts immediately via SIGTERM
- **FIGHTING/RESOLUTION phase**: Waits until RESOLUTION phase completes
- **PM2 auto-restart**: PM2 automatically restarts the server with new code

### Deployment Workflow

**Recommended workflow for production deployments:**

1. **Push new code** to your deployment platform (Railway, Vast.ai, etc.)
2. **Wait for build** to complete
3. **Request graceful restart** via API
4. **Monitor restart status** until complete
5. **Verify health** with `/health` and `/status` endpoints

**Example script:**

```bash
#!/bin/bash
# deploy-production.sh

# 1. Push to Railway
git push railway main

# 2. Wait for build (Railway webhook or manual check)
echo "Waiting for Railway build..."
sleep 60

# 3. Request graceful restart
echo "Requesting graceful restart..."
curl -X POST https://api.yourdomain.com/admin/graceful-restart \
  -H "x-admin-code: $ADMIN_CODE"

# 4. Monitor restart status
echo "Monitoring restart status..."
while true; do
  STATUS=$(curl -s https://api.yourdomain.com/admin/restart-status \
    -H "x-admin-code: $ADMIN_CODE")
  
  if echo "$STATUS" | grep -q '"pendingRestart":false'; then
    echo "Restart complete!"
    break
  fi
  
  echo "Waiting for restart..."
  sleep 5
done

# 5. Verify health
echo "Verifying health..."
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/status
```

### Programmatic API

For automated deployment pipelines:

```typescript
import { getStreamingDuelScheduler } from './systems/StreamingDuelScheduler';

async function deployWithGracefulRestart() {
  const scheduler = getStreamingDuelScheduler();
  
  if (!scheduler) {
    // No scheduler, restart immediately
    process.kill(process.pid, 'SIGTERM');
    return;
  }
  
  // Request graceful restart
  const scheduled = scheduler.requestGracefulRestart();
  
  if (!scheduled) {
    console.log('Restart already pending');
    return;
  }
  
  // Monitor restart status
  while (scheduler.isPendingRestart()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Restart complete');
}
```

## Memory Management

### Connection Pool Sizing

**General guidelines:**

| Deployment Type | POSTGRES_POOL_MAX | POSTGRES_POOL_MIN | Rationale |
|----------------|-------------------|-------------------|-----------|
| Railway (stable) | 6 | 0 | Pgbouncer pooler limits |
| Railway (crash loop) | 3 | 0 | Prevent exhaustion during restarts |
| Neon/Supabase | 10 | 1 | Serverless connection limits |
| Dedicated PostgreSQL | 20 | 2 | Standard connection pool |
| Duel streaming | 1 | 0 | Minimal connections for streaming |

**Signs you need to reduce pool size:**
- "too many clients already" errors
- Connection timeouts during restarts
- Database connection exhaustion

**Signs you can increase pool size:**
- Slow query response times
- Connection pool exhaustion warnings
- High concurrent user load

### PM2 Restart Configuration

**Prevent connection exhaustion during crash loops:**

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'hyperscape-server',
    script: './dist/index.js',
    
    // Restart delays
    restart_delay: 10000,            // 10s (up from 5s)
    exp_backoff_restart_delay: 2000, // 2s for gradual backoff
    
    // Restart limits
    max_restarts: 10,                // Prevent infinite restart loops
    min_uptime: 5000,                // Must run 5s to count as successful
    
    // Memory limits
    max_memory_restart: '2G',        // Restart if memory exceeds 2GB
  }]
};
```

**Why these settings matter:**
- `restart_delay: 10000` - Gives database connections time to close before restart
- `exp_backoff_restart_delay: 2000` - Gradual backoff prevents rapid restart loops
- `max_restarts: 10` - Prevents infinite loops, forces manual intervention
- `max_memory_restart: '2G'` - Automatic restart on memory leaks

### Object Pooling

**Use object pools for high-frequency events** to eliminate GC pressure:

```typescript
// ❌ WRONG - allocates on every event
world.emit('damage', { attackerId, targetId, damage });

// ✅ CORRECT - uses pool
const payload = CombatEventPools.damageDealt.acquire();
payload.attackerId = attackerId;
payload.targetId = targetId;
payload.damage = damage;
world.emitTypedEvent(EventType.COMBAT_DAMAGE_DEALT, payload);

// In listener - MUST release
world.on(EventType.COMBAT_DAMAGE_DEALT, (payload) => {
  try {
    // Process...
  } finally {
    CombatEventPools.damageDealt.release(payload);
  }
});
```

See [object-pooling-api.md](object-pooling-api.md) for complete API reference.

## Monitoring & Health Checks

### Essential Endpoints

Configure your monitoring service to poll these endpoints:

| Endpoint | Purpose | Frequency | Alert On |
|----------|---------|-----------|----------|
| `GET /health` | Basic uptime | 30s | Non-200 response |
| `GET /status` | Detailed status | 60s | Player count anomalies |
| `GET /api/streaming/state` | Streaming health | 60s | Missing duel context |
| `GET /admin/pools/stats` | Connection pool | 300s | Pool exhaustion |

### Streaming Health Check

Quick diagnostic for streaming deployments:

```bash
bun run duel:status
```

**Checks:**
- Server health endpoint (`/health`)
- Streaming API status (`/api/streaming/state`)
- Duel context (fighting phase, contestants)
- RTMP bridge status and bytes streamed
- PM2 process status
- Recent logs (last 50 lines)

**Example output:**
```
[✓] Server health: OK
[✓] Streaming API: OK (phase: FIGHTING)
[✓] RTMP bridge: 3 destinations, 45.2 MB streamed
[✓] PM2 processes: 2 running
[✓] Recent logs: No errors in last 50 lines
```

### Database Connection Pool Monitoring

Monitor connection pool health to prevent exhaustion:

```bash
curl http://your-server/admin/pools/stats \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Response:**
```json
{
  "bfs": {
    "poolSize": 100,
    "inUse": 12,
    "available": 88,
    "utilization": 12
  },
  "tile": {
    "poolSize": 200,
    "inUse": 45,
    "available": 155
  },
  "quaternion": {
    "poolSize": 50,
    "inUse": 8,
    "available": 42
  }
}
```

**Healthy metrics:**
- `inUse < poolSize` (not exhausted)
- `available > 0` (objects available)
- `utilization < 80%` (not near capacity)

**Warning signs:**
- `inUse === poolSize` (pool exhausted)
- `utilization > 90%` (near capacity)
- Frequent auto-growth warnings in logs

### RTMP Bridge Health

Monitor RTMP streaming health:

```bash
curl http://your-server/api/streaming/state
```

**Healthy response:**
```json
{
  "type": "STREAMING_STATE_UPDATE",
  "cycle": {
    "phase": "FIGHTING",
    "agent1": { "name": "Agent1", "hp": 85, "maxHp": 100 },
    "agent2": { "name": "Agent2", "hp": 72, "maxHp": 100 }
  },
  "cameraTarget": "agent1-id"
}
```

**Warning signs:**
- `phase: "IDLE"` for extended periods (no duels running)
- Missing `cameraTarget` (camera system failure)
- Stale `phaseStartTime` (phase stuck)

## Troubleshooting

### Database Connection Exhaustion

**Symptoms:**
- "too many clients already" errors
- Connection timeouts
- Slow query response times

**Solutions:**

1. **Reduce connection pool size:**
   ```bash
   POSTGRES_POOL_MAX=3
   POSTGRES_POOL_MIN=0
   ```

2. **Increase restart delay:**
   ```javascript
   restart_delay: 10000,
   exp_backoff_restart_delay: 2000,
   ```

3. **Check for connection leaks:**
   - Monitor pool stats over time
   - Look for increasing `inUse` count
   - Check for unclosed database clients

4. **Verify Railway detection:**
   - Check logs for "Supavisor pooler detected" message
   - Ensure prepared statements are disabled
   - Verify pool max is 6 or lower

### Stream Disconnects After 30 Minutes

**Symptoms:**
- Twitch/YouTube disconnects stream after ~30 minutes
- "Stream appears idle" messages
- Viewer count drops to zero

**Solution:**

Enable placeholder frame mode:

```bash
STREAM_PLACEHOLDER_ENABLED=true
```

**Verification:**
- Check logs for "Entering placeholder mode" message
- Monitor RTMP bridge stats for `inPlaceholderMode: true`
- Verify stream stays connected during idle periods

### Deployment Interrupts Active Duel

**Symptoms:**
- Deploying new code kills active duels mid-fight
- Viewers see abrupt stream interruption
- Betting markets resolve incorrectly

**Solution:**

Use graceful restart API:

```bash
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Verification:**
- Check response for `"pendingRestart": true`
- Monitor `/admin/restart-status` until restart completes
- Verify duel completes before restart

### WebGPU Not Initializing

**Symptoms:**
- Browser timeout during page load
- Black screen or loading spinner
- "WebGPU not available" errors

**Solutions:**

1. **Ensure GPU display driver** (Vast.ai):
   ```bash
   # Use provisioner to rent correct instance
   bun run vast:provision
   
   # Verify display driver
   nvidia-smi  # Should show display mode
   ```

2. **Use production client build:**
   ```bash
   NODE_ENV=production
   DUEL_USE_PRODUCTION_CLIENT=true
   ```

3. **Check WebGPU diagnostics:**
   - Deployment logs show WebGPU pre-check results
   - Look for "WebGPU adapter acquired" message
   - Check chrome://gpu in browser

4. **Verify Chrome executable:**
   ```bash
   # Set explicit Chrome path
   STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
   ```

### Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Frequent GC pauses
- Server crashes with OOM errors

**Diagnosis:**

1. **Check object pool statistics:**
   ```bash
   curl http://your-server/admin/pools/stats \
     -H "x-admin-code: YOUR_ADMIN_CODE"
   ```

2. **Look for leak warnings in logs:**
   ```
   [EventPayloadPool:CombatDamageDealt] Potential leak: 15 payloads still in use
   ```

3. **Monitor memory over time:**
   ```bash
   # Check PM2 memory usage
   pm2 monit
   
   # Or use admin endpoint
   curl http://your-server/admin/memory/report \
     -H "x-admin-code: YOUR_ADMIN_CODE"
   ```

**Solutions:**

1. **Fix event listener leaks:**
   - Ensure all listeners call `release()` on pooled payloads
   - Use try/finally blocks for error safety
   - Check for missing cleanup in error paths

2. **Enable automatic restart on memory threshold:**
   ```javascript
   max_memory_restart: '2G',
   ```

3. **Reduce pool sizes if over-allocated:**
   - Check peak usage in pool stats
   - Reduce initial size if peak << total

## Deployment Checklist

### Pre-Deployment

- [ ] Set `NODE_ENV=production`
- [ ] Configure database connection pool limits
- [ ] Set `ADMIN_CODE` for admin endpoints
- [ ] Configure RTMP stream keys (if streaming)
- [ ] Enable placeholder frame mode (if streaming)
- [ ] Set production client build flags (if streaming)
- [ ] Configure PM2 restart delays
- [ ] Test graceful restart API locally

### Post-Deployment

- [ ] Verify `/health` endpoint returns 200
- [ ] Check `/status` for correct player count
- [ ] Test graceful restart API
- [ ] Monitor connection pool stats
- [ ] Verify RTMP bridge status (if streaming)
- [ ] Check for memory leaks over 24 hours
- [ ] Configure monitoring alerts
- [ ] Test zero-downtime deployment workflow

### Streaming-Specific

- [ ] Verify WebGPU initialization in deployment logs
- [ ] Test placeholder frame mode activation
- [ ] Monitor stream uptime (should not disconnect)
- [ ] Verify production client build is active
- [ ] Check browser restart is working (every 45 min)
- [ ] Test graceful restart during active duel
- [ ] Monitor RTMP destination health

## Environment Variable Reference

### Required for Production

```bash
NODE_ENV=production
PORT=5555
DATABASE_URL=postgresql://...
JWT_SECRET=...                   # 32+ random bytes
ADMIN_CODE=...                   # For admin endpoints
PUBLIC_API_URL=https://...
PUBLIC_WS_URL=wss://...
PUBLIC_CDN_URL=https://...
```

### Recommended for Railway

```bash
POSTGRES_POOL_MAX=6              # Or 3 for crash loops
POSTGRES_POOL_MIN=0
# Railway auto-detects via RAILWAY_ENVIRONMENT
```

### Recommended for Streaming

```bash
STREAM_PLACEHOLDER_ENABLED=true
NODE_ENV=production
DUEL_USE_PRODUCTION_CLIENT=true
SPAWN_MODEL_AGENTS=true          # Auto-create agents
STREAM_CAPTURE_EXECUTABLE=/usr/bin/google-chrome-unstable
```

### Optional Optimizations

```bash
STREAM_LOW_LATENCY=true          # Faster playback start
STREAM_GOP_SIZE=30               # Smaller GOP for low latency
STREAM_AUDIO_ENABLED=true        # Enable audio capture
POSTGRES_POOL_MAX=1              # Minimal connections for streaming
```

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate secrets before production** - If ever committed/shared
3. **Use strong ADMIN_CODE** - 32+ random characters
4. **Enable rate limiting** - Don't set `DISABLE_RATE_LIMIT=true`
5. **Use HTTPS/WSS** - Never HTTP/WS in production
6. **Restrict admin endpoints** - Use Cloudflare WAF rules
7. **Monitor failed auth attempts** - Check logs for brute force
8. **Use origin secrets** - Prevent direct Railway access

## Performance Tuning

### Database Query Optimization

1. **Use connection pooling** - Don't create new connections per query
2. **Disable prepared statements on Railway** - Automatic with Railway detection
3. **Use indexes** - Add indexes for frequently queried columns
4. **Batch operations** - Combine multiple queries when possible
5. **Monitor slow queries** - Use PostgreSQL slow query log

### Streaming Performance

1. **Use production client build** - Eliminates JIT compilation overhead
2. **Enable placeholder mode** - Prevents stream disconnects
3. **Use hardware acceleration** - Set `FFMPEG_HWACCEL=nvidia` on GPU servers
4. **Monitor dropped frames** - Check RTMP bridge stats
5. **Optimize GOP size** - Balance quality and latency

### Memory Optimization

1. **Use object pools** - Eliminate allocations in hot paths
2. **Monitor pool statistics** - Check for leaks and exhaustion
3. **Set memory restart threshold** - `max_memory_restart: '2G'`
4. **Clean up event listeners** - Remove listeners on destroy
5. **Avoid memory leaks** - Follow cleanup patterns in SystemBase

## Related Documentation

- [duel-stack.md](duel-stack.md) - Duel stack configuration
- [betting-production-deploy.md](betting-production-deploy.md) - Production deployment guide
- [object-pooling-api.md](object-pooling-api.md) - Object pooling API reference
- [AGENTS.md](../AGENTS.md) - AI coding assistant instructions
- [CLAUDE.md](../CLAUDE.md) - Development guide
