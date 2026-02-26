# Maintenance Mode API

Graceful deployment coordination for the streaming duel system. Prevents data loss and market inconsistency during code deployments.

## Overview

The Maintenance Mode API provides endpoints to safely pause the streaming duel system before deployments, wait for active markets to resolve, and resume operations after deployment completes.

**Key Features:**
- Pauses new duel cycles (current cycle completes naturally)
- Locks betting markets (no new bets accepted)
- Waits for current market to resolve before reporting "safe to deploy"
- Prevents data loss from mid-duel deployments
- Automatic timeout with forced resolution if markets don't resolve

## Authentication

All maintenance mode endpoints require the `ADMIN_CODE` header:

```bash
-H "x-admin-code: your-admin-code"
```

Set `ADMIN_CODE` in `packages/server/.env` (required for production).

## API Endpoints

### Enter Maintenance Mode

Pauses new duel cycles and waits for active markets to resolve.

**Endpoint:** `POST /admin/maintenance/enter`

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
- `reason` (string, optional): Reason for entering maintenance mode (logged for audit trail)
- `timeoutMs` (number, optional): Maximum time to wait for markets to resolve (default: 300000 = 5 minutes)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Entered maintenance mode",
  "status": {
    "active": true,
    "enteredAt": 1709000000000,
    "reason": "deployment",
    "safeToDeploy": false,
    "currentPhase": "FIGHTING",
    "marketStatus": "active",
    "pendingMarkets": 1
  }
}
```

**Example:**
```bash
curl -X POST https://hyperscape.gg/admin/maintenance/enter \
  -H "x-admin-code: your-admin-code" \
  -H "Content-Type: application/json" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'
```

### Check Maintenance Status

Get current maintenance mode status and deployment safety.

**Endpoint:** `GET /admin/maintenance/status`

**Headers:**
```
x-admin-code: your-admin-code
```

**Response (200 OK):**
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

**Status Fields:**
- `active` (boolean): Whether maintenance mode is currently active
- `enteredAt` (number): Unix timestamp when maintenance mode was entered
- `reason` (string): Reason provided when entering maintenance mode
- `safeToDeploy` (boolean): **Critical** - true when safe to deploy (no active duels/markets)
- `currentPhase` (string): Current duel cycle phase (IDLE, COUNTDOWN, FIGHTING, ANNOUNCEMENT, RESOLUTION)
- `marketStatus` (string): Betting market status (none, active, resolved)
- `pendingMarkets` (number): Number of unresolved betting markets

**Example:**
```bash
curl https://hyperscape.gg/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

### Exit Maintenance Mode

Resume normal operations after deployment.

**Endpoint:** `POST /admin/maintenance/exit`

**Headers:**
```
x-admin-code: your-admin-code
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Exited maintenance mode"
}
```

**Example:**
```bash
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: your-admin-code"
```

## Deployment Workflow

### Manual Deployment

```bash
# 1. Enter maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/enter \
  -H "x-admin-code: $ADMIN_CODE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# 2. Poll status until safeToDeploy is true
while true; do
  STATUS=$(curl -s https://hyperscape.gg/admin/maintenance/status \
    -H "x-admin-code: $ADMIN_CODE")
  SAFE=$(echo $STATUS | jq -r '.safeToDeploy')
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy!"
    break
  fi
  echo "Waiting for markets to resolve... (safeToDeploy=$SAFE)"
  sleep 10
done

# 3. Deploy your code
git pull origin main
bun install
bun run build
pm2 restart hyperscape

# 4. Exit maintenance mode
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: $ADMIN_CODE"
```

### Automated CI/CD (GitHub Actions)

The `.github/workflows/deploy-vast.yml` workflow automatically handles maintenance mode:

```yaml
- name: Enter maintenance mode
  run: |
    curl -X POST ${{ secrets.VAST_SERVER_URL }}/admin/maintenance/enter \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}" \
      -H "Content-Type: application/json" \
      -d '{"reason": "automated deployment", "timeoutMs": 300000}'

- name: Wait for safe deployment state
  run: |
    for i in {1..30}; do
      STATUS=$(curl -s ${{ secrets.VAST_SERVER_URL }}/admin/maintenance/status \
        -H "x-admin-code: ${{ secrets.ADMIN_CODE }}")
      SAFE=$(echo $STATUS | jq -r '.safeToDeploy')
      if [ "$SAFE" = "true" ]; then
        echo "Safe to deploy!"
        exit 0
      fi
      echo "Waiting for markets to resolve... (attempt $i/30)"
      sleep 10
    done
    echo "Timeout waiting for safe deployment state"
    exit 1

- name: Deploy code
  # ... SSH deployment steps ...

- name: Exit maintenance mode
  run: |
    curl -X POST ${{ secrets.VAST_SERVER_URL }}/admin/maintenance/exit \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}"
```

## Implementation Details

### State Machine

Maintenance mode integrates with the `StreamingDuelScheduler` state machine:

1. **Enter**: Sets `maintenanceMode.active = true`, broadcasts to scheduler
2. **Scheduler Response**: Completes current cycle, pauses before starting new cycle
3. **Market Resolution**: Waits for betting markets to resolve (or timeout)
4. **Safe State**: Reports `safeToDeploy: true` when phase is IDLE and no pending markets
5. **Exit**: Sets `maintenanceMode.active = false`, scheduler resumes normal operation

### Timeout Behavior

If markets don't resolve within `timeoutMs`:
- Maintenance mode remains active
- `safeToDeploy` becomes true (forced)
- Markets are force-resolved (prevents indefinite blocking)
- Warning logged to server logs

### Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

```json
{
  "status": "ok",
  "uptime": 123456,
  "maintenanceMode": {
    "active": true,
    "reason": "deployment",
    "safeToDeploy": true
  }
}
```

## Error Responses

### 401 Unauthorized
Missing or invalid `ADMIN_CODE`:
```json
{
  "error": "Unauthorized",
  "message": "Invalid admin code"
}
```

### 400 Bad Request
Invalid request body:
```json
{
  "error": "Bad Request",
  "message": "Invalid timeoutMs value"
}
```

### 500 Internal Server Error
Server error during operation:
```json
{
  "error": "Internal Server Error",
  "message": "Failed to enter maintenance mode"
}
```

## Best Practices

1. **Always check `safeToDeploy`** before deploying - don't rely on timing alone
2. **Set reasonable timeouts** - 5 minutes (300000ms) is recommended for most deployments
3. **Monitor logs** - Check server logs for maintenance mode state transitions
4. **Exit after deployment** - Always call `/exit` to resume normal operations
5. **Use in CI/CD** - Automate maintenance mode in deployment pipelines (see `.github/workflows/deploy-vast.yml`)

## Troubleshooting

**Maintenance mode stuck active:**
```bash
# Force exit
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: $ADMIN_CODE"
```

**Markets not resolving:**
- Check server logs for market resolution errors
- Verify Solana RPC connectivity (if using on-chain betting)
- Timeout will force resolution after `timeoutMs`

**safeToDeploy never becomes true:**
- Check `currentPhase` - must be IDLE
- Check `pendingMarkets` - must be 0
- Increase `timeoutMs` if markets are slow to resolve
- Check server logs for scheduler errors

## Related Files

- **Implementation**: `packages/server/src/startup/maintenance-mode.ts`
- **Scheduler Integration**: `packages/server/src/systems/StreamingDuelScheduler/index.ts`
- **CI/CD Workflow**: `.github/workflows/deploy-vast.yml`
- **Helper Scripts**: `scripts/pre-deploy-maintenance.sh`, `scripts/post-deploy-resume.sh`
