# Maintenance Mode API

The Maintenance Mode API provides graceful deployment coordination for the streaming duel system. It prevents data loss and market inconsistency by pausing new duels and waiting for active markets to resolve before allowing deployments.

## Overview

**Purpose**: Coordinate deployments with active duel cycles and betting markets

**Use Cases**:
- Automated CI/CD deployments (Vast.ai, Railway)
- Manual server maintenance
- Emergency shutdowns with market protection

**Key Features**:
- Pauses new duel cycles (current cycle completes)
- Locks betting markets (no new bets accepted)
- Waits for current market to resolve
- Reports "safe to deploy" status
- Automatic timeout handling

## API Endpoints

### Enter Maintenance Mode

Pauses new duel cycles and waits for safe deploy state.

**Endpoint**: `POST /admin/maintenance/enter`

**Headers**:
```
Content-Type: application/json
x-admin-code: your-admin-code
```

**Request Body**:
```json
{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters**:
- `reason` (string, optional): Reason for maintenance (for logging). Default: `"deployment"`
- `timeoutMs` (number, optional): Maximum time to wait for safe state in milliseconds. Default: `300000` (5 minutes)

**Response** (200 OK):
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

**Response Fields**:
- `active` (boolean): Whether maintenance mode is currently active
- `enteredAt` (number | null): Unix timestamp when maintenance mode was entered
- `reason` (string | null): Reason provided when entering maintenance mode
- `safeToDeploy` (boolean): Whether it's safe to deploy (no active duels or markets)
- `currentPhase` (string | null): Current duel phase (`IDLE`, `FIGHTING`, `COUNTDOWN`, `ANNOUNCEMENT`, `RESOLUTION`)
- `marketStatus` (string): Current market status (`betting`, `locked`, `resolved`, `none`)
- `pendingMarkets` (number): Number of unresolved betting markets

**Error Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

### Exit Maintenance Mode

Resumes duel cycle scheduling and betting markets.

**Endpoint**: `POST /admin/maintenance/exit`

**Headers**:
```
Content-Type: application/json
x-admin-code: your-admin-code
```

**Request Body**: None required

**Response** (200 OK):
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

### Get Maintenance Status

Check current maintenance mode status without making changes.

**Endpoint**: `GET /admin/maintenance/status`

**Headers**:
```
x-admin-code: your-admin-code
```

**Response** (200 OK):
```json
{
  "success": true,
  "status": {
    "active": false,
    "enteredAt": null,
    "reason": null,
    "safeToDeploy": false,
    "currentPhase": "FIGHTING",
    "marketStatus": "betting",
    "pendingMarkets": 1
  }
}
```

## Safe Deploy Logic

The system reports `safeToDeploy: true` when **all** conditions are met:

1. **Maintenance mode is active** (`active: true`)
2. **No active duel phase**: `currentPhase` is not `FIGHTING`, `COUNTDOWN`, or `ANNOUNCEMENT`
3. **No pending markets**: `pendingMarkets === 0` OR `marketStatus === "resolved"`

**Example Safe States**:
```json
// ✅ Safe - idle with no markets
{ "currentPhase": "IDLE", "marketStatus": "none", "pendingMarkets": 0 }

// ✅ Safe - resolution phase with resolved market
{ "currentPhase": "RESOLUTION", "marketStatus": "resolved", "pendingMarkets": 1 }

// ❌ Unsafe - active fight
{ "currentPhase": "FIGHTING", "marketStatus": "betting", "pendingMarkets": 1 }

// ❌ Unsafe - countdown to fight
{ "currentPhase": "COUNTDOWN", "marketStatus": "locked", "pendingMarkets": 1 }
```

## Usage Examples

### Automated Deployment (GitHub Actions)

```yaml
# Enter maintenance mode
- name: Enter Maintenance Mode
  env:
    VAST_SERVER_URL: ${{ secrets.VAST_SERVER_URL }}
    ADMIN_CODE: ${{ secrets.ADMIN_CODE }}
  run: |
    RESPONSE=$(curl -s -X POST \
      "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}')
    
    SAFE=$(echo "$RESPONSE" | jq -r '.status.safeToDeploy')
    if [ "$SAFE" != "true" ]; then
      echo "Warning: Not safe to deploy yet"
    fi

# Deploy...

# Exit maintenance mode
- name: Exit Maintenance Mode
  env:
    VAST_SERVER_URL: ${{ secrets.VAST_SERVER_URL }}
    ADMIN_CODE: ${{ secrets.ADMIN_CODE }}
  run: |
    curl -s -X POST \
      "$VAST_SERVER_URL/admin/maintenance/exit" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE"
```

### Manual Deployment

```bash
# Enter maintenance mode
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# Wait for safe state
while true; do
  STATUS=$(curl -s https://your-server.com/admin/maintenance/status \
    -H "x-admin-code: your-admin-code")
  
  SAFE=$(echo "$STATUS" | jq -r '.status.safeToDeploy')
  
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy!"
    break
  fi
  
  echo "Waiting for safe state..."
  sleep 5
done

# Perform deployment
# ...

# Exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### Monitoring Script

```bash
#!/bin/bash
# monitor-maintenance.sh - Watch maintenance mode status

ADMIN_CODE="your-admin-code"
SERVER_URL="https://your-server.com"

while true; do
  STATUS=$(curl -s "$SERVER_URL/admin/maintenance/status" \
    -H "x-admin-code: $ADMIN_CODE")
  
  ACTIVE=$(echo "$STATUS" | jq -r '.status.active')
  SAFE=$(echo "$STATUS" | jq -r '.status.safeToDeploy')
  PHASE=$(echo "$STATUS" | jq -r '.status.currentPhase')
  MARKETS=$(echo "$STATUS" | jq -r '.status.pendingMarkets')
  
  echo "[$(date)] Active: $ACTIVE | Safe: $SAFE | Phase: $PHASE | Markets: $MARKETS"
  
  sleep 10
done
```

## Implementation Details

### Server-Side Logic

**File**: `packages/server/src/startup/maintenance-mode.ts`

**Key Functions**:
- `enterMaintenanceMode(reason, timeoutMs)` - Pauses scheduler, waits for safe state
- `exitMaintenanceMode()` - Resumes operations
- `getMaintenanceStatus()` - Returns current status
- `isMaintenanceModeActive()` - Boolean check

**Environment Variable**:
```bash
# Set by enterMaintenanceMode(), checked by scheduler
STREAMING_DUEL_MAINTENANCE_MODE=true
```

### Scheduler Integration

The `StreamingDuelScheduler` checks maintenance mode before starting new cycles:

```typescript
if (process.env.STREAMING_DUEL_MAINTENANCE_MODE === 'true') {
  // Skip starting new cycle
  // Current cycle will complete normally
  return;
}
```

### Market Integration

The `DuelMarketMaker` reports market status:

```typescript
const activeMarkets = marketMaker.getActiveMarkets();
const pendingMarkets = activeMarkets.length;
const marketStatus = activeMarkets[0]?.status ?? 'none';
```

## Security

### Authentication

All maintenance endpoints require the `x-admin-code` header.

**Setting Admin Code**:
```bash
# In packages/server/.env
ADMIN_CODE=your-secure-random-string

# Generate secure code
openssl rand -base64 32
```

**Without Admin Code**: In development mode with `NODE_ENV=development` and no `ADMIN_CODE` set, you can use `GRANT_DEV_ADMIN=true` to bypass authentication (not recommended for production).

### Rate Limiting

Maintenance endpoints are exempt from rate limiting to prevent deployment failures.

## Timeout Handling

If `enterMaintenanceMode()` times out before reaching safe state:

1. **Returns current status** (may not be fully safe)
2. **Logs warning**: `Timeout waiting for safe deploy state after ${timeoutMs}ms`
3. **Deployment continues** (caller decides whether to proceed)

**Recommendation**: Set `timeoutMs` to at least 5 minutes (300000ms) to allow time for:
- Current duel to finish (max 5 minutes)
- Market resolution (usually <30 seconds)
- Network delays

## Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

```bash
curl https://your-server.com/health
```

**Response**:
```json
{
  "status": "ok",
  "uptime": 12345,
  "maintenanceMode": true,
  "version": "1.0.0"
}
```

## Best Practices

### Automated Deployments

1. **Always enter maintenance mode** before deploying
2. **Wait for `safeToDeploy: true`** before proceeding
3. **Exit maintenance mode** after deployment completes
4. **Use `continue-on-error: true`** in CI to prevent deployment failures if maintenance API is unavailable

### Manual Deployments

1. **Check current status** before entering maintenance mode
2. **Monitor logs** during maintenance window
3. **Verify health** after exiting maintenance mode
4. **Have rollback plan** ready

### Emergency Situations

If you need to deploy immediately without waiting:

```bash
# Skip maintenance mode (not recommended)
# Deploy directly

# Or force exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

**Warning**: Skipping maintenance mode may cause:
- Active duels to be interrupted
- Betting markets to become inconsistent
- Players to lose connection mid-fight

## See Also

- [docs/vast-deployment.md](vast-deployment.md) - Vast.ai deployment guide
- [packages/server/src/startup/maintenance-mode.ts](../packages/server/src/startup/maintenance-mode.ts) - Implementation
- [.github/workflows/deploy-vast.yml](../.github/workflows/deploy-vast.yml) - CI/CD usage example
