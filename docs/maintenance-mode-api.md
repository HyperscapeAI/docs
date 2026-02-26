# Maintenance Mode API

The maintenance mode API enables graceful deployments by pausing new duel cycles and waiting for active markets to resolve before deploying new code.

## Overview

When maintenance mode is enabled:
1. **New duel cycles are paused** - No new duels start
2. **Active markets continue** - Current duels complete normally
3. **API returns status** - Indicates when safe to deploy
4. **Timeout protection** - Auto-exits if deployment doesn't complete

## Endpoints

### Enter Maintenance Mode

**POST** `/admin/maintenance/enter`

Pauses new duel cycles and waits for active markets to resolve.

**Headers:**
```
Content-Type: application/json
x-admin-code: YOUR_ADMIN_CODE
```

**Request Body:**
```json
{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**
- `reason` (string, optional) - Reason for maintenance (logged)
- `timeoutMs` (number, optional) - Auto-exit after this duration (default: 300000 = 5 minutes)

**Response:**
```json
{
  "success": true,
  "status": {
    "maintenanceMode": true,
    "safeToDeploy": true,
    "currentPhase": "idle",
    "pendingMarkets": 0,
    "reason": "deployment",
    "enteredAt": "2026-02-26T07:00:00.000Z"
  }
}
```

**Status Fields:**
- `maintenanceMode` (boolean) - Whether maintenance mode is active
- `safeToDeploy` (boolean) - Whether it's safe to deploy (no active markets)
- `currentPhase` (string) - Current duel scheduler phase (`idle`, `betting`, `fighting`, etc.)
- `pendingMarkets` (number) - Number of active markets that need to resolve
- `reason` (string) - Reason provided when entering maintenance
- `enteredAt` (string) - ISO timestamp when maintenance mode was entered

### Check Maintenance Status

**GET** `/admin/maintenance/status`

Returns current maintenance mode status.

**Headers:**
```
x-admin-code: YOUR_ADMIN_CODE
```

**Response:**
```json
{
  "maintenanceMode": false,
  "safeToDeploy": true,
  "currentPhase": "idle",
  "pendingMarkets": 0
}
```

### Exit Maintenance Mode

**POST** `/admin/maintenance/exit`

Resumes normal operations (new duel cycles can start).

**Headers:**
```
Content-Type: application/json
x-admin-code: YOUR_ADMIN_CODE
```

**Response:**
```json
{
  "success": true,
  "status": {
    "maintenanceMode": false,
    "safeToDeploy": true,
    "currentPhase": "idle",
    "pendingMarkets": 0
  }
}
```

## Health Endpoint

The `/health` endpoint now includes maintenance mode status:

**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "maintenanceMode": false
}
```

## Usage in CI/CD

### GitHub Actions Example

```yaml
- name: Enter Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'

- name: Deploy
  # ... deployment steps ...

- name: Exit Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/exit" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE"
```

### Manual Deployment Scripts

```bash
#!/bin/bash
# Pre-deployment: Enter maintenance mode
curl -X POST "https://your-server.com/admin/maintenance/enter" \
  -H "Content-Type: application/json" \
  -H "x-admin-code: $ADMIN_CODE" \
  -d '{"reason": "manual deployment", "timeoutMs": 600000}'

# Wait for safe deployment status
while true; do
  SAFE=$(curl -s "https://your-server.com/admin/maintenance/status" \
    -H "x-admin-code: $ADMIN_CODE" | jq -r '.safeToDeploy')
  
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy!"
    break
  fi
  
  echo "Waiting for active markets to resolve..."
  sleep 10
done

# Deploy your code here
# ...

# Post-deployment: Exit maintenance mode
curl -X POST "https://your-server.com/admin/maintenance/exit" \
  -H "Content-Type: application/json" \
  -H "x-admin-code: $ADMIN_CODE"
```

## Error Handling

### Authentication Errors

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

Fix: Verify `ADMIN_CODE` environment variable matches the `x-admin-code` header.

### Timeout Behavior

If maintenance mode is entered with `timeoutMs`, it will automatically exit after that duration even if you don't explicitly call `/exit`. This prevents indefinite maintenance mode if deployment fails.

## Best Practices

1. **Always use timeouts** - Set `timeoutMs` to prevent stuck maintenance mode
2. **Wait for safeToDeploy** - Don't deploy while `pendingMarkets > 0`
3. **Monitor health endpoint** - Verify server is healthy after deployment
4. **Use in CI/CD** - Automate maintenance mode in deployment pipelines
5. **Set ADMIN_CODE** - Never deploy without admin authentication

## Related Documentation

- [docs/vast-deployment.md](vast-deployment.md) - Full Vast.ai deployment guide
- [.github/workflows/deploy-vast.yml](../.github/workflows/deploy-vast.yml) - CI/CD implementation
- [scripts/deploy-vast.sh](../scripts/deploy-vast.sh) - Deployment script
