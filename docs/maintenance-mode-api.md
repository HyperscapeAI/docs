# Maintenance Mode API

The Maintenance Mode API enables graceful deployments by pausing new duel cycles and waiting for active markets to resolve before deploying updates.

## Overview

When deploying to production, you want to avoid:
- Interrupting active duels mid-fight
- Leaving unresolved betting markets
- Causing player disconnections during critical moments

The Maintenance Mode API solves this by:
1. Pausing new duel cycle starts
2. Allowing current duels to complete naturally
3. Waiting for all markets to resolve
4. Signaling when it's safe to deploy
5. Resuming operations after deployment

## API Endpoints

All endpoints require the `x-admin-code` header for authentication.

### Enter Maintenance Mode

```http
POST /admin/maintenance/enter
Content-Type: application/json
x-admin-code: your-admin-code

{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**
- `reason` (string, optional): Reason for entering maintenance mode (e.g., "deployment", "emergency fix")
- `timeoutMs` (number, optional): Maximum time to wait for markets to resolve (default: 300000ms = 5 minutes)

**Response:**
```json
{
  "success": true,
  "message": "Entered maintenance mode",
  "status": {
    "maintenanceMode": true,
    "currentPhase": "intermission",
    "pendingMarkets": 0,
    "safeToDeploy": true,
    "reason": "deployment"
  }
}
```

**Status Fields:**
- `maintenanceMode` (boolean): Whether maintenance mode is active
- `currentPhase` (string): Current duel phase ("intermission", "combat", "resolution")
- `pendingMarkets` (number): Number of unresolved betting markets
- `safeToDeploy` (boolean): Whether it's safe to deploy now
- `reason` (string): Reason for maintenance mode

### Check Maintenance Status

```http
GET /admin/maintenance/status
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "maintenanceMode": true,
  "currentPhase": "intermission",
  "pendingMarkets": 0,
  "safeToDeploy": true,
  "reason": "deployment"
}
```

### Exit Maintenance Mode

```http
POST /admin/maintenance/exit
Content-Type: application/json
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "success": true,
  "message": "Exited maintenance mode"
}
```

## Usage in CI/CD

The Vast.ai deployment workflow (`.github/workflows/deploy-vast.yml`) uses maintenance mode automatically:

```yaml
# Step 1: Enter maintenance mode
- name: Enter Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'

# Step 2: Deploy (SSH to server, pull code, restart)
- name: SSH and Deploy Vast
  uses: appleboy/ssh-action@v1.0.3
  # ... deployment steps ...

# Step 3: Wait for server health
- name: Wait for Server Health
  run: |
    for i in {1..30}; do
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VAST_SERVER_URL/health")
      if [ "$HTTP_STATUS" = "200" ]; then
        echo "Server is healthy!"
        break
      fi
      sleep 10
    done

# Step 4: Exit maintenance mode
- name: Exit Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/exit" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE"
```

## Manual Deployment

For manual deployments, use the helper scripts:

```bash
# Enter maintenance mode
bash scripts/maintenance-enter.sh

# Check status
bash scripts/maintenance-status.sh

# Deploy your changes
# ... deployment steps ...

# Exit maintenance mode
bash scripts/maintenance-exit.sh
```

## Environment Variables

Required in `packages/server/.env`:

```bash
# Admin code for maintenance mode API access
ADMIN_CODE=your-secure-admin-code
```

Also required in GitHub Secrets for CI/CD:
- `ADMIN_CODE` - Admin authentication code
- `VAST_SERVER_URL` - Production server URL (e.g., https://your-server.com)

## Behavior Details

### What Happens in Maintenance Mode

**Paused:**
- New duel cycle starts
- New market creation
- Duel scheduler tick processing

**Continues:**
- Active duels complete normally
- Market resolution for completed duels
- Player connections and gameplay
- WebSocket communication
- HTTP API requests

### Safe to Deploy Conditions

The API reports `safeToDeploy: true` when:
1. Maintenance mode is active
2. Current phase is "intermission" (no active duel)
3. No pending unresolved markets

### Timeout Handling

If markets don't resolve within `timeoutMs`:
- The API still enters maintenance mode
- `safeToDeploy` may be `false`
- You can check status and decide whether to proceed
- Consider increasing timeout or manually resolving issues

## Error Handling

### Missing Admin Code

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

### Already in Maintenance Mode

```json
{
  "success": true,
  "message": "Already in maintenance mode",
  "status": { ... }
}
```

### Not in Maintenance Mode (on exit)

```json
{
  "success": true,
  "message": "Not in maintenance mode"
}
```

## Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "uptime": 123456,
  "maintenanceMode": true,
  "version": "1.0.0"
}
```

## Best Practices

1. **Always use maintenance mode for production deployments** - Prevents interrupting active gameplay
2. **Set appropriate timeouts** - 5 minutes (300000ms) is usually sufficient for markets to resolve
3. **Monitor status** - Check `safeToDeploy` before proceeding with deployment
4. **Health check after deployment** - Wait for server to be healthy before exiting maintenance mode
5. **Have rollback plan** - If deployment fails, you can exit maintenance mode to restore service

## Troubleshooting

**Maintenance mode stuck:**
- Check current phase: `curl https://your-server.com/admin/maintenance/status -H "x-admin-code: your-code"`
- If phase is "combat", wait for duel to complete
- If phase is "resolution", wait for market resolution
- If stuck for >10 minutes, investigate server logs

**Can't exit maintenance mode:**
- Verify server is healthy: `curl https://your-server.com/health`
- Check server logs for errors
- Ensure ADMIN_CODE is correct
- Try restarting the server if necessary

**Deployment failed during maintenance:**
- Server will remain in maintenance mode
- Fix the deployment issue
- Manually exit maintenance mode: `bash scripts/maintenance-exit.sh`

## See Also

- [Vast.ai Deployment Guide](vast-deployment.md)
- [CI/CD Improvements](ci-cd-improvements.md)
- [Streaming Configuration](streaming-configuration.md)
