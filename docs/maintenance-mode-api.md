# Maintenance Mode API

**Added**: February 2026 (commit 30b52bd)

Graceful deployment coordination system for the streaming duel platform. Prevents data loss and market inconsistency during deployments by pausing new duel cycles and waiting for active markets to resolve.

## Overview

The Maintenance Mode API provides three endpoints for controlling deployment safety:

- `POST /admin/maintenance/enter` - Enter maintenance mode
- `POST /admin/maintenance/exit` - Exit maintenance mode
- `GET /admin/maintenance/status` - Check current status

All endpoints require `x-admin-code` header authentication.

## How It Works

### Entering Maintenance Mode

When maintenance mode is entered:

1. **Pause New Cycles**: Sets `STREAMING_DUEL_MAINTENANCE_MODE=true` environment variable
2. **Current Cycle Completes**: Active duel finishes normally
3. **Market Resolution**: Waits for betting markets to resolve
4. **Safe State**: Reports when safe to deploy

### Safe Deploy Criteria

The system is safe to deploy when ALL conditions are met:

- ✅ Maintenance mode is active
- ✅ No active duel phase (not FIGHTING, COUNTDOWN, or ANNOUNCEMENT)
- ✅ No pending betting markets (or all markets resolved)

### Exiting Maintenance Mode

When maintenance mode is exited:

1. **Resume Operations**: Removes `STREAMING_DUEL_MAINTENANCE_MODE` environment variable
2. **Scheduler Resumes**: StreamingDuelScheduler starts new cycles
3. **Markets Re-enabled**: Betting markets accept new bets

## API Reference

### POST /admin/maintenance/enter

Enter maintenance mode and wait for safe deploy state.

**Headers:**
```
x-admin-code: your-admin-code
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**
- `reason` (string, optional) - Reason for maintenance (default: "deployment")
- `timeoutMs` (number, optional) - Max time to wait for safe state in milliseconds (default: 300000 = 5 minutes)

**Response:**
```json
{
  "success": true,
  "status": {
    "active": true,
    "enteredAt": 1709000000000,
    "reason": "deployment",
    "safeToDeploy": true,
    "currentPhase": "IDLE",
    "marketStatus": "resolved",
    "pendingMarkets": 0
  }
}
```

**Status Codes:**
- `200` - Success (may or may not be safe to deploy yet - check `safeToDeploy`)
- `403` - Unauthorized (invalid or missing admin code)
- `429` - Too many failed auth attempts (rate limited)
- `500` - Server error

### GET /admin/maintenance/status

Check current maintenance mode status.

**Headers:**
```
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "active": true,
  "enteredAt": 1709000000000,
  "reason": "deployment",
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0
}
```

**Response Fields:**
- `active` (boolean) - Whether maintenance mode is currently active
- `enteredAt` (number | null) - Unix timestamp when maintenance mode was entered
- `reason` (string | null) - Reason for maintenance
- `safeToDeploy` (boolean) - Whether it's safe to deploy now
- `currentPhase` (string | null) - Current duel phase (IDLE, FIGHTING, COUNTDOWN, etc.)
- `marketStatus` (string) - Current market status: "betting" | "locked" | "resolved" | "none"
- `pendingMarkets` (number) - Number of unresolved betting markets

### POST /admin/maintenance/exit

Exit maintenance mode and resume normal operations.

**Headers:**
```
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "success": true,
  "status": {
    "active": false,
    "enteredAt": null,
    "reason": null,
    "safeToDeploy": false,
    "currentPhase": "IDLE",
    "marketStatus": "none",
    "pendingMarkets": 0
  }
}
```

## Usage Examples

### Manual Deployment

```bash
# 1. Enter maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/enter \
  -H "x-admin-code: $ADMIN_CODE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# 2. Wait for safeToDeploy: true
curl https://hyperscape.gg/admin/maintenance/status \
  -H "x-admin-code: $ADMIN_CODE"

# 3. Deploy your changes
git pull
bun install
bun run build
pm2 restart hyperscape-duel

# 4. Exit maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: $ADMIN_CODE"
```

### CI/CD Integration

The `.github/workflows/deploy-vast.yml` workflow automatically handles maintenance mode:

```yaml
# Step 1: Enter maintenance mode
- name: Enter Maintenance Mode
  run: |
    curl -X POST "${{ secrets.VAST_SERVER_URL }}/admin/maintenance/enter" \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'

# Step 2: Deploy
- name: SSH and Deploy Vast
  uses: appleboy/ssh-action@v1.0.3
  # ... deployment steps

# Step 3: Exit maintenance mode
- name: Exit Maintenance Mode
  run: |
    # Wait for server health check
    curl "${{ secrets.VAST_SERVER_URL }}/health"
    
    # Exit maintenance mode
    curl -X POST "${{ secrets.VAST_SERVER_URL }}/admin/maintenance/exit" \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}"
```

## Implementation Details

### Source Files

- `packages/server/src/startup/maintenance-mode.ts` - Core maintenance mode logic
- `packages/server/src/startup/routes/admin-routes.ts` - API endpoint handlers
- `packages/server/src/startup/routes/health-routes.ts` - Health endpoint includes maintenance status
- `.github/workflows/deploy-vast.yml` - CI/CD integration

### How Scheduler Checks Maintenance Mode

The `StreamingDuelScheduler` checks for maintenance mode before starting new cycles:

```typescript
// In StreamingDuelScheduler.update()
if (process.env.STREAMING_DUEL_MAINTENANCE_MODE === 'true') {
  // Skip starting new cycles
  return;
}
```

### Health Endpoint Integration

The `/health` endpoint now includes maintenance mode status:

```json
{
  "status": "ok",
  "timestamp": "2026-02-26T03:00:00.000Z",
  "uptime": 12345.67,
  "maintenanceMode": true
}
```

## Security

### Authentication

All maintenance mode endpoints require the `x-admin-code` header:

```bash
x-admin-code: your-admin-code
```

The admin code must be set in `packages/server/.env`:

```bash
ADMIN_CODE=your-secure-admin-code
```

### Rate Limiting

Failed authentication attempts are rate limited:

- **Max Attempts**: 5 per minute per IP
- **Lockout Duration**: 5 minutes after exceeding limit
- **Timing-Safe Comparison**: Uses `crypto.timingSafeEqual()` to prevent timing attacks

### Production Requirements

**CRITICAL**: Set `ADMIN_CODE` in production. Without it:
- Admin panel is disabled
- Maintenance mode endpoints return 403
- Only `GRANT_DEV_ADMIN` provides admin access (development only)

## Troubleshooting

### Timeout Waiting for Safe State

If `enterMaintenanceMode()` times out (default: 5 minutes):

1. **Check Current Phase**:
   ```bash
   curl https://your-server.com/admin/maintenance/status \
     -H "x-admin-code: $ADMIN_CODE"
   ```

2. **Common Causes**:
   - Duel stuck in FIGHTING phase (combat not resolving)
   - Market stuck in "betting" or "locked" state
   - Network issues preventing market resolution

3. **Manual Intervention**:
   ```bash
   # Force exit maintenance mode (use with caution)
   curl -X POST https://your-server.com/admin/maintenance/exit \
     -H "x-admin-code: $ADMIN_CODE"
   ```

### Maintenance Mode Not Pausing Cycles

**Symptoms**: New duel cycles start despite maintenance mode being active.

**Cause**: Scheduler not checking `STREAMING_DUEL_MAINTENANCE_MODE` environment variable.

**Solution**: Verify environment variable is set:
```bash
# In server logs, should see:
# [MaintenanceMode] Streaming duel scheduler paused
```

### 403 Unauthorized

**Symptoms**: All maintenance mode endpoints return 403.

**Causes**:
1. Missing or incorrect `x-admin-code` header
2. `ADMIN_CODE` not set in server environment
3. Rate limited (too many failed attempts)

**Solutions**:
```bash
# Verify ADMIN_CODE is set
echo $ADMIN_CODE

# Check rate limit status (wait 5 minutes if locked out)
# Rate limit resets automatically after lockout period
```

## Best Practices

### Deployment Workflow

1. **Always use maintenance mode** for production deployments
2. **Set reasonable timeout** (5 minutes is usually sufficient)
3. **Monitor status** during deployment
4. **Verify health** before exiting maintenance mode
5. **Log all maintenance events** for audit trail

### Monitoring

Add monitoring for maintenance mode status:

```bash
# Prometheus/Grafana metric
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: $ADMIN_CODE" \
  | jq '.active'
```

### Emergency Procedures

If deployment fails while in maintenance mode:

1. **Check server health**: `curl https://your-server.com/health`
2. **Review logs**: `pm2 logs hyperscape-duel`
3. **Exit maintenance mode**: `POST /admin/maintenance/exit`
4. **Rollback if needed**: `git reset --hard <previous-commit>`

## Related Documentation

- [deploy-vast.yml](.github/workflows/deploy-vast.yml) - CI/CD workflow
- [maintenance-mode.ts](packages/server/src/startup/maintenance-mode.ts) - Implementation
- [admin-routes.ts](packages/server/src/startup/routes/admin-routes.ts) - API endpoints
- [health-routes.ts](packages/server/src/startup/routes/health-routes.ts) - Health endpoint
