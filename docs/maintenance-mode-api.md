# Maintenance Mode API

The Maintenance Mode API enables graceful deployments by pausing new duel cycles and waiting for active markets to resolve before deploying code changes.

## Overview

Maintenance mode prevents data loss and incomplete transactions during deployments by:
- Pausing new duel cycle starts
- Allowing active duels to complete naturally
- Waiting for on-chain markets to resolve
- Providing deployment safety status

## Authentication

All maintenance mode endpoints require admin authentication via the `x-admin-code` header:

```bash
x-admin-code: your-admin-code
```

The admin code is configured via the `ADMIN_CODE` environment variable in `packages/server/.env`.

## Endpoints

### POST /admin/maintenance/enter

Enters maintenance mode and pauses new duel cycles.

**Request:**
```bash
POST /admin/maintenance/enter
Content-Type: application/json
x-admin-code: your-admin-code

{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**
- `reason` (string, optional): Reason for entering maintenance mode (e.g., "deployment", "emergency")
- `timeoutMs` (number, optional): Maximum time to wait for safe deployment state (default: 300000 = 5 minutes)

**Response:**
```json
{
  "success": true,
  "message": "Entered maintenance mode",
  "status": {
    "maintenanceMode": true,
    "reason": "deployment",
    "enteredAt": "2026-02-26T08:00:00.000Z",
    "safeToDeploy": false,
    "currentPhase": "betting",
    "pendingMarkets": 2,
    "estimatedWaitMs": 45000
  }
}
```

**Status Fields:**
- `maintenanceMode` (boolean): Whether maintenance mode is active
- `reason` (string): Reason for maintenance mode
- `enteredAt` (string): ISO timestamp when maintenance mode was entered
- `safeToDeploy` (boolean): Whether it's safe to deploy (no active markets)
- `currentPhase` (string): Current duel cycle phase (`idle`, `betting`, `fighting`, `resolving`)
- `pendingMarkets` (number): Number of active markets that need to resolve
- `estimatedWaitMs` (number): Estimated time until safe to deploy (milliseconds)

**Behavior:**
- Immediately pauses new duel cycle starts
- Waits up to `timeoutMs` for active markets to resolve
- Returns `safeToDeploy: true` when all markets are resolved
- Returns `safeToDeploy: false` if timeout is reached with pending markets

### GET /admin/maintenance/status

Checks current maintenance mode status.

**Request:**
```bash
GET /admin/maintenance/status
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "maintenanceMode": true,
  "reason": "deployment",
  "enteredAt": "2026-02-26T08:00:00.000Z",
  "safeToDeploy": true,
  "currentPhase": "idle",
  "pendingMarkets": 0,
  "estimatedWaitMs": 0
}
```

### POST /admin/maintenance/exit

Exits maintenance mode and resumes normal operations.

**Request:**
```bash
POST /admin/maintenance/exit
Content-Type: application/json
x-admin-code: your-admin-code
```

**Response:**
```json
{
  "success": true,
  "message": "Exited maintenance mode",
  "status": {
    "maintenanceMode": false,
    "reason": null,
    "enteredAt": null,
    "safeToDeploy": true,
    "currentPhase": "idle",
    "pendingMarkets": 0
  }
}
```

**Behavior:**
- Immediately exits maintenance mode
- Resumes duel cycle scheduling
- Next cycle starts according to normal schedule

## Usage Examples

### Manual Deployment

```bash
# 1. Enter maintenance mode
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# 2. Wait for safe deployment status
while true; do
  STATUS=$(curl -s https://your-server.com/admin/maintenance/status \
    -H "x-admin-code: your-admin-code")
  
  SAFE=$(echo "$STATUS" | jq -r '.safeToDeploy')
  
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy!"
    break
  fi
  
  echo "Waiting for markets to resolve..."
  sleep 10
done

# 3. Deploy your changes
# ... (git pull, restart server, etc.)

# 4. Exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### Automated CI/CD

The GitHub Actions workflow (`.github/workflows/deploy-vast.yml`) automates this process:

```yaml
# Step 1: Enter maintenance mode
- name: Enter Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'

# Step 2: Deploy
- name: SSH and Deploy
  # ... deployment steps ...

# Step 3: Wait for health
- name: Wait for Server Health
  run: |
    for i in {1..30}; do
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VAST_SERVER_URL/health")
      if [ "$HTTP_STATUS" = "200" ]; then
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

### Emergency Maintenance

For emergency maintenance (e.g., critical bug fix):

```bash
# Enter maintenance mode immediately
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "emergency: critical bug fix", "timeoutMs": 0}'

# This will pause new cycles immediately without waiting
```

## Integration with Duel System

### Cycle State Machine

The maintenance mode integrates with the `StreamingDuelScheduler` cycle state machine:

```
┌─────────────────────────────────────────────────────────┐
│ Normal Operation                                        │
├─────────────────────────────────────────────────────────┤
│ idle → betting → fighting → resolving → idle (repeat)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Maintenance Mode Entered                                │
├─────────────────────────────────────────────────────────┤
│ Current cycle completes → idle → PAUSED (no new cycles) │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Maintenance Mode Exited                                 │
├─────────────────────────────────────────────────────────┤
│ PAUSED → idle → betting (normal operation resumes)      │
└─────────────────────────────────────────────────────────┘
```

### Safe Deployment Criteria

The API returns `safeToDeploy: true` when:
- No active duel is in progress
- No pending on-chain markets need resolution
- Current phase is `idle`
- `pendingMarkets === 0`

### Timeout Behavior

If `timeoutMs` is reached before `safeToDeploy: true`:
- Maintenance mode remains active
- `safeToDeploy` returns `false`
- `pendingMarkets` shows remaining markets
- `estimatedWaitMs` shows estimated time to completion

**Recommendation**: Wait for `safeToDeploy: true` before deploying to avoid interrupting active markets.

## Error Handling

### Missing Admin Code

**Request:**
```bash
GET /admin/maintenance/status
# (no x-admin-code header)
```

**Response:**
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid admin code"
}
```

**Status Code**: 401 Unauthorized

### Invalid Admin Code

**Request:**
```bash
GET /admin/maintenance/status
x-admin-code: wrong-code
```

**Response:**
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid admin code"
}
```

**Status Code**: 401 Unauthorized

### Server Error

If the server encounters an error during maintenance mode operations:

**Response:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to enter maintenance mode: <error details>"
}
```

**Status Code**: 500 Internal Server Error

## Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

**Request:**
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "abc123def456",
  "maintenanceMode": true,
  "maintenanceReason": "deployment"
}
```

This allows monitoring systems to detect maintenance mode without admin authentication.

## Best Practices

### Deployment Workflow

1. **Enter maintenance mode** with sufficient timeout (5-10 minutes)
2. **Poll status endpoint** until `safeToDeploy: true`
3. **Deploy changes** (git pull, restart, etc.)
4. **Wait for health check** to confirm server is ready
5. **Exit maintenance mode** to resume operations

### Timeout Configuration

- **Development**: 60000ms (1 minute) - faster iteration
- **Staging**: 180000ms (3 minutes) - moderate safety
- **Production**: 300000ms (5 minutes) - maximum safety

### Error Recovery

If deployment fails after entering maintenance mode:

```bash
# Exit maintenance mode to restore service
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### Monitoring

Monitor maintenance mode status during deployments:

```bash
# Watch status in real-time
watch -n 5 'curl -s https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code" | jq'
```

## Related Documentation

- [docs/vast-deployment.md](docs/vast-deployment.md) - Vast.ai deployment guide
- [.github/workflows/deploy-vast.yml](../.github/workflows/deploy-vast.yml) - Deployment workflow
- [packages/server/src/startup/maintenance-mode.ts](../packages/server/src/startup/maintenance-mode.ts) - Implementation
- [packages/server/src/startup/routes/admin-routes.ts](../packages/server/src/startup/routes/admin-routes.ts) - Route handlers
