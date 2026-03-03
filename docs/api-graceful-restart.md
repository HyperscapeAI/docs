# Graceful Restart API

The Graceful Restart API enables zero-downtime deployments for the duel arena streaming server. When a graceful restart is requested, the server waits for the current duel to complete before restarting, ensuring no interruption to active duels or streams.

## Endpoints

### POST /admin/graceful-restart

Request a server restart after the current duel ends.

**Authentication**: Requires `x-admin-code` header matching `ADMIN_CODE` environment variable.

**Request**:
```bash
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Response**:
```json
{
  "success": true,
  "message": "Graceful restart requested",
  "willRestartAfterDuel": true
}
```

**Behavior**:
- If no duel is active: Server restarts immediately via SIGTERM
- If duel is in progress: Server waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

**Status Codes**:
- `200 OK`: Restart request accepted
- `401 Unauthorized`: Missing or invalid admin code
- `500 Internal Server Error`: Failed to request restart

### GET /admin/restart-status

Check if a graceful restart is pending.

**Authentication**: Requires `x-admin-code` header matching `ADMIN_CODE` environment variable.

**Request**:
```bash
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Response**:
```json
{
  "restartPending": true,
  "duelActive": true,
  "currentPhase": "FIGHTING"
}
```

**Response Fields**:
- `restartPending` (boolean): Whether a graceful restart has been requested
- `duelActive` (boolean): Whether a duel is currently in progress
- `currentPhase` (string): Current duel phase (MATCHMAKING, COUNTDOWN, FIGHTING, RESOLUTION, IDLE)

**Status Codes**:
- `200 OK`: Status retrieved successfully
- `401 Unauthorized`: Missing or invalid admin code
- `500 Internal Server Error`: Failed to retrieve status

## Programmatic API

### StreamingDuelScheduler.requestGracefulRestart()

Request a graceful restart programmatically from within the server code.

**Usage**:
```typescript
import { streamingDuelScheduler } from './systems/StreamingDuelScheduler';

// Request graceful restart
streamingDuelScheduler.requestGracefulRestart();
```

**Behavior**:
- Sets internal flag to trigger restart after current duel
- If no duel active: Triggers immediate restart
- If duel in progress: Waits for RESOLUTION phase to complete
- Restart is handled by PM2 process manager

## Use Cases

### Zero-Downtime Deployments

Deploy new code to the duel arena streaming server without interrupting active duels:

```bash
# 1. Deploy new code to server (via git pull, CI/CD, etc.)
ssh your-server "cd /path/to/hyperscape && git pull origin main"

# 2. Request graceful restart
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# 3. Monitor restart status
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# 4. Server will restart automatically after current duel ends
# PM2 will restart the process with new code
```

### Automated Deployment Pipeline

Integrate graceful restart into your CI/CD pipeline:

```yaml
# .github/workflows/deploy-vast.yml
- name: Request graceful restart
  run: |
    curl -X POST ${{ secrets.VAST_SERVER_URL }}/admin/graceful-restart \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}"
    
- name: Wait for restart
  run: |
    while true; do
      STATUS=$(curl -s ${{ secrets.VAST_SERVER_URL }}/admin/restart-status \
        -H "x-admin-code: ${{ secrets.ADMIN_CODE }}")
      if echo "$STATUS" | jq -e '.restartPending == false'; then
        echo "Restart complete"
        break
      fi
      echo "Waiting for duel to complete..."
      sleep 10
    done
```

## Configuration

**Environment Variables**:
```bash
ADMIN_CODE=your-secret-admin-code  # Required for authentication
```

**PM2 Configuration** (`ecosystem.config.cjs`):
```javascript
module.exports = {
  apps: [{
    name: 'duel-arena',
    script: 'bun',
    args: 'run start',
    autorestart: true,
    restart_delay: 10000,  // 10s cooldown between restarts
    exp_backoff_restart_delay: 2000,  // Exponential backoff
  }]
};
```

## Implementation Details

The graceful restart system is implemented in `StreamingDuelScheduler`:

1. **Request Handling**: Admin route sets `restartPending` flag
2. **Duel Monitoring**: Scheduler checks flag at end of each cycle
3. **Phase Detection**: Waits for RESOLUTION phase to complete
4. **Process Termination**: Sends SIGTERM to current process
5. **PM2 Restart**: PM2 automatically restarts with new code

**Key Files**:
- `packages/server/src/systems/StreamingDuelScheduler/index.ts` - Main scheduler logic
- `packages/server/src/startup/routes/admin-routes.ts` - API endpoints
- `ecosystem.config.cjs` - PM2 configuration

## Troubleshooting

**Restart not triggering**:
- Check `ADMIN_CODE` environment variable is set
- Verify admin code in request matches server configuration
- Check PM2 logs: `pm2 logs duel-arena`

**Restart happens immediately despite active duel**:
- Verify duel is in FIGHTING phase (not IDLE or MATCHMAKING)
- Check scheduler logs for phase transitions
- Ensure `STREAMING_DUEL_ENABLED=true` in environment

**PM2 not restarting after SIGTERM**:
- Check PM2 configuration: `pm2 show duel-arena`
- Verify `autorestart: true` in ecosystem.config.cjs
- Check PM2 process status: `pm2 status`

## Related Documentation

- [Vast.ai Deployment](../scripts/deploy-vast.sh) - Full deployment script
- [Streaming Status Check](../scripts/check-streaming-status.sh) - Health monitoring
- [PM2 Configuration](../ecosystem.config.cjs) - Process manager settings
- [AGENTS.md](../AGENTS.md) - WebGPU streaming architecture
