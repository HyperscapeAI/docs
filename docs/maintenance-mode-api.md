# Maintenance Mode API

The Maintenance Mode API enables graceful deployments by pausing new duel cycles while allowing active markets to resolve naturally. This prevents mid-duel interruptions and ensures all bets are settled before the server restarts.

## Overview

Maintenance mode provides:

- **Zero-downtime deployments** - Active duels complete before restart
- **Market protection** - All bets resolve before shutdown
- **Timeout safety** - Automatic force-proceed if markets don't resolve
- **Status monitoring** - Real-time visibility into deployment readiness

## API Endpoints

### Enter Maintenance Mode

Pauses new duel cycles and waits for active markets to resolve.

```http
POST /admin/maintenance/enter
Content-Type: application/json
x-admin-code: YOUR_ADMIN_CODE

{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Reason for entering maintenance mode (e.g., "deployment", "emergency") |
| `timeoutMs` | number | No | Maximum wait time in milliseconds (default: 300000 = 5 minutes) |

**Response:**

```json
{
  "success": true,
  "message": "Entered maintenance mode",
  "status": {
    "active": true,
    "reason": "deployment",
    "enteredAt": "2026-02-26T07:00:00.000Z",
    "currentPhase": "BETTING",
    "pendingMarkets": 2,
    "safeToDeploy": false,
    "estimatedWaitMs": 45000
  }
}
```

**Status Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `active` | boolean | Whether maintenance mode is active |
| `reason` | string | Reason for maintenance mode |
| `enteredAt` | string | ISO timestamp when maintenance mode was entered |
| `currentPhase` | string | Current duel cycle phase (BETTING, COUNTDOWN, COMBAT, RESOLUTION) |
| `pendingMarkets` | number | Number of active markets that need to resolve |
| `safeToDeploy` | boolean | Whether it's safe to deploy (no pending markets) |
| `estimatedWaitMs` | number | Estimated time until safe to deploy |

**Error Responses:**

```json
// Missing admin code
{
  "error": "Unauthorized",
  "message": "Missing or invalid admin code"
}

// Already in maintenance mode
{
  "error": "Already in maintenance mode",
  "status": { ... }
}
```

### Check Maintenance Status

Get current maintenance mode status.

```http
GET /admin/maintenance/status
x-admin-code: YOUR_ADMIN_CODE
```

**Response:**

```json
{
  "active": true,
  "reason": "deployment",
  "enteredAt": "2026-02-26T07:00:00.000Z",
  "currentPhase": "RESOLUTION",
  "pendingMarkets": 0,
  "safeToDeploy": true,
  "estimatedWaitMs": 0
}
```

### Exit Maintenance Mode

Resumes normal duel cycle operations.

```http
POST /admin/maintenance/exit
Content-Type: application/json
x-admin-code: YOUR_ADMIN_CODE
```

**Response:**

```json
{
  "success": true,
  "message": "Exited maintenance mode"
}
```

**Error Responses:**

```json
// Not in maintenance mode
{
  "error": "Not in maintenance mode"
}
```

## Usage Examples

### Automated Deployment (GitHub Actions)

The `deploy-vast.yml` workflow uses maintenance mode automatically:

```yaml
# Step 1: Enter maintenance mode
- name: Enter Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'

# Step 2: Deploy code
- name: Deploy
  run: bash scripts/deploy-vast.sh

# Step 3: Exit maintenance mode
- name: Exit Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/exit" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE"
```

### Manual Deployment

For manual deployments, use the helper scripts:

```bash
# Enter maintenance mode
bash scripts/pre-deploy-maintenance.sh

# Wait for safe deployment status
# (script polls /admin/maintenance/status until safeToDeploy: true)

# Deploy your changes
bash scripts/deploy-vast.sh

# Exit maintenance mode
bash scripts/post-deploy-resume.sh
```

### Emergency Maintenance

For emergency shutdowns (e.g., critical bug):

```bash
# Enter maintenance mode with short timeout
curl -X POST http://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: YOUR_ADMIN_CODE" \
  -d '{"reason": "emergency: critical bug fix", "timeoutMs": 60000}'

# Force-stop after timeout if needed
# (maintenance mode will auto-proceed after 60 seconds)
```

## Implementation Details

### What Happens During Maintenance Mode

1. **Duel Scheduler Pauses**
   - `StreamingDuelScheduler` stops starting new cycles
   - Current cycle completes normally
   - No new duels are created

2. **Market Resolution**
   - Active duels finish combat
   - Markets resolve and pay out winners
   - All on-chain transactions complete

3. **Timeout Protection**
   - If markets don't resolve within `timeoutMs`, maintenance mode force-proceeds
   - This prevents indefinite hangs from stuck markets
   - Logs warning if timeout is triggered

### Safe Deployment Criteria

The API reports `safeToDeploy: true` when:

- No active duel cycles are running
- All markets have resolved
- No pending on-chain transactions
- Current phase is not COMBAT or COUNTDOWN

### Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

```json
{
  "status": "healthy",
  "maintenance": {
    "active": true,
    "reason": "deployment"
  }
}
```

This allows monitoring systems to detect maintenance mode and avoid false alarms.

## Security

### Authentication

All maintenance mode endpoints require the `x-admin-code` header:

```bash
x-admin-code: YOUR_ADMIN_CODE
```

The admin code is configured via:

1. `ADMIN_CODE` environment variable (production)
2. GitHub Secret `ADMIN_CODE` (CI/CD)

**Never commit admin codes to git or expose them publicly.**

### Authorization

Only requests with valid admin codes can:

- Enter/exit maintenance mode
- Check maintenance status
- Access admin endpoints

Invalid or missing codes return `401 Unauthorized`.

## Best Practices

### Deployment Workflow

1. **Always use maintenance mode** for production deployments
2. **Monitor status** until `safeToDeploy: true` before restarting
3. **Set reasonable timeouts** (5 minutes is usually sufficient)
4. **Exit maintenance mode** after deployment completes
5. **Check health endpoint** to verify server is operational

### Timeout Configuration

Choose timeout based on duel cycle length:

- **Standard deployment**: 300000ms (5 minutes)
- **Quick fix**: 60000ms (1 minute)
- **Major update**: 600000ms (10 minutes)

Duel cycles typically complete within 2-3 minutes, so 5 minutes provides safe margin.

### Error Handling

Always handle maintenance mode API errors:

```bash
# Example with error handling
RESPONSE=$(curl -s -X POST "$URL/admin/maintenance/enter" \
  -H "Content-Type: application/json" \
  -H "x-admin-code: $ADMIN_CODE" \
  -d '{"reason": "deployment", "timeoutMs": 300000}' \
  || echo '{"error": "curl failed"}')

SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
  echo "Failed to enter maintenance mode: $RESPONSE"
  exit 1
fi
```

## Troubleshooting

### Maintenance Mode Won't Enter

**Symptom**: POST /admin/maintenance/enter returns error

**Causes**:
- Invalid or missing `x-admin-code` header
- Already in maintenance mode
- Server not responding

**Solution**:
```bash
# Check if already in maintenance mode
curl http://your-server.com/admin/maintenance/status \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Verify admin code is correct
echo $ADMIN_CODE

# Check server health
curl http://your-server.com/health
```

### Markets Not Resolving

**Symptom**: `safeToDeploy` stays `false` for extended period

**Causes**:
- Stuck duel combat
- On-chain transaction failures
- Network issues

**Solution**:
```bash
# Check current phase and pending markets
curl http://your-server.com/admin/maintenance/status \
  -H "x-admin-code: YOUR_ADMIN_CODE"

# Wait for timeout to force-proceed
# Or manually investigate stuck markets in logs
bunx pm2 logs hyperscape-duel | grep -i "market\|duel\|combat"
```

### Timeout Triggered

**Symptom**: Deployment proceeds but markets didn't resolve

**Impact**: Some bets may not settle correctly

**Solution**:
- Investigate why markets didn't resolve (check logs)
- Increase timeout for future deployments
- Consider manual market resolution if needed

## Related Documentation

- [Vast.ai Deployment](./vast-deployment.md) - Full Vast.ai deployment guide
- [Duel Stack](./duel-stack.md) - Duel system architecture
- [Railway Deployment](./railway-dev-prod.md) - Alternative deployment target
