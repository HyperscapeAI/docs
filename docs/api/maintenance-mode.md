# Maintenance Mode API Reference

This document provides complete API reference for the maintenance mode endpoints introduced in February 2026.

## Overview

The maintenance mode API provides graceful deployment coordination for the streaming duel system. It prevents data loss and market inconsistency by pausing new duel cycles and waiting for active markets to resolve before allowing deployments.

**Base URL**: `https://your-server.com` (e.g., `https://hyperscape.gg`)

**Authentication**: All endpoints require `ADMIN_CODE` header:
```
x-admin-code: your-admin-code
```

## Endpoints

### Enter Maintenance Mode

Pauses new duel cycles and waits for active markets to resolve.

**Endpoint**: `POST /admin/maintenance/enter`

**Headers:**
```
Content-Type: application/json
x-admin-code: your-admin-code
```

**Request Body:**
```json
{
  "reason": "deployment",
  "timeoutMs": 300000
}
```

**Parameters:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `reason` | string | No | "manual" | Reason for maintenance (logged for audit) |
| `timeoutMs` | number | No | 300000 | Maximum wait time for markets to resolve (milliseconds) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Maintenance mode activated",
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0,
  "enteredAt": 1709000000000
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on successful activation |
| `message` | string | Human-readable status message |
| `safeToDeploy` | boolean | `true` if safe to deploy, `false` if waiting for markets |
| `currentPhase` | string | Current duel phase: `IDLE`, `COUNTDOWN`, `FIGHTING`, `ANNOUNCEMENT` |
| `marketStatus` | string | Market status: `resolved`, `active`, `locked` |
| `pendingMarkets` | number | Number of unresolved markets |
| `enteredAt` | number | Unix timestamp (milliseconds) when maintenance mode entered |

**Error Responses:**

**401 Unauthorized** - Missing or invalid `ADMIN_CODE`:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

**409 Conflict** - Already in maintenance mode:
```json
{
  "error": "Conflict",
  "message": "Maintenance mode already active",
  "enteredAt": 1709000000000,
  "reason": "deployment"
}
```

**504 Gateway Timeout** - Markets didn't resolve within timeout:
```json
{
  "success": false,
  "message": "Timeout waiting for markets to resolve",
  "safeToDeploy": false,
  "currentPhase": "FIGHTING",
  "marketStatus": "active",
  "pendingMarkets": 1,
  "timeoutMs": 300000
}
```

**Example (cURL):**
```bash
curl -X POST https://hyperscape.gg/admin/maintenance/enter \
  -H "x-admin-code: your-admin-code" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "deployment",
    "timeoutMs": 300000
  }'
```

**Example (JavaScript):**
```javascript
const response = await fetch('https://hyperscape.gg/admin/maintenance/enter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-code': 'your-admin-code',
  },
  body: JSON.stringify({
    reason: 'deployment',
    timeoutMs: 300000,
  }),
});

const data = await response.json();
console.log('Safe to deploy:', data.safeToDeploy);
```

---

### Check Maintenance Status

Returns current maintenance mode state and safe-to-deploy status.

**Endpoint**: `GET /admin/maintenance/status`

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
  "pendingMarkets": 0,
  "elapsedMs": 45000
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `active` | boolean | `true` if maintenance mode active, `false` otherwise |
| `enteredAt` | number \| null | Unix timestamp when entered (null if not active) |
| `reason` | string \| null | Reason for maintenance (null if not active) |
| `safeToDeploy` | boolean | `true` if safe to deploy (always `true` if not active) |
| `currentPhase` | string | Current duel phase |
| `marketStatus` | string | Market status |
| `pendingMarkets` | number | Number of unresolved markets |
| `elapsedMs` | number \| null | Time elapsed since entering (null if not active) |

**Response (Not Active):**
```json
{
  "active": false,
  "enteredAt": null,
  "reason": null,
  "safeToDeploy": true,
  "currentPhase": "IDLE",
  "marketStatus": "resolved",
  "pendingMarkets": 0,
  "elapsedMs": null
}
```

**Error Responses:**

**401 Unauthorized** - Missing or invalid `ADMIN_CODE`:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

**Example (cURL):**
```bash
curl https://hyperscape.gg/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

**Example (JavaScript):**
```javascript
const response = await fetch('https://hyperscape.gg/admin/maintenance/status', {
  headers: {
    'x-admin-code': 'your-admin-code',
  },
});

const data = await response.json();
if (data.active && data.safeToDeploy) {
  console.log('Safe to deploy');
} else if (data.active) {
  console.log('Waiting for markets to resolve...');
} else {
  console.log('Not in maintenance mode');
}
```

---

### Exit Maintenance Mode

Resumes normal operations (duel cycles and betting markets).

**Endpoint**: `POST /admin/maintenance/exit`

**Headers:**
```
x-admin-code: your-admin-code
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Maintenance mode deactivated",
  "duration": 120000
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on successful deactivation |
| `message` | string | Human-readable status message |
| `duration` | number | Total time spent in maintenance mode (milliseconds) |

**Error Responses:**

**401 Unauthorized** - Missing or invalid `ADMIN_CODE`:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

**409 Conflict** - Not in maintenance mode:
```json
{
  "error": "Conflict",
  "message": "Maintenance mode not active"
}
```

**Example (cURL):**
```bash
curl -X POST https://hyperscape.gg/admin/maintenance/exit \
  -H "x-admin-code: your-admin-code"
```

**Example (JavaScript):**
```javascript
const response = await fetch('https://hyperscape.gg/admin/maintenance/exit', {
  method: 'POST',
  headers: {
    'x-admin-code': 'your-admin-code',
  },
});

const data = await response.json();
console.log('Maintenance mode exited after', data.duration, 'ms');
```

## Workflow Examples

### Manual Deployment

```bash
#!/bin/bash
set -e

SERVER_URL="https://hyperscape.gg"
ADMIN_CODE="your-admin-code"

# 1. Enter maintenance mode
echo "Entering maintenance mode..."
curl -X POST "$SERVER_URL/admin/maintenance/enter" \
  -H "x-admin-code: $ADMIN_CODE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "manual deployment", "timeoutMs": 300000}'

# 2. Wait for safe state
echo "Waiting for safe state..."
while true; do
  STATUS=$(curl -s "$SERVER_URL/admin/maintenance/status" \
    -H "x-admin-code: $ADMIN_CODE")
  SAFE=$(echo $STATUS | jq -r '.safeToDeploy')
  
  if [ "$SAFE" = "true" ]; then
    echo "Safe to deploy"
    break
  fi
  
  echo "Waiting for markets to resolve..."
  sleep 10
done

# 3. Deploy (your deployment commands here)
echo "Deploying..."
# git pull, bun install, bun run build, pm2 restart, etc.

# 4. Health check
echo "Checking health..."
curl "$SERVER_URL/health"

# 5. Exit maintenance mode
echo "Exiting maintenance mode..."
curl -X POST "$SERVER_URL/admin/maintenance/exit" \
  -H "x-admin-code: $ADMIN_CODE"

echo "Deployment complete"
```

### Automated CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Enter maintenance mode
  run: |
    curl -X POST ${{ secrets.SERVER_URL }}/admin/maintenance/enter \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}" \
      -H "Content-Type: application/json" \
      -d '{"reason": "CI deployment", "timeoutMs": 300000}'

- name: Wait for safe state
  run: |
    for i in {1..30}; do
      STATUS=$(curl -s ${{ secrets.SERVER_URL }}/admin/maintenance/status \
        -H "x-admin-code: ${{ secrets.ADMIN_CODE }}")
      SAFE=$(echo $STATUS | jq -r '.safeToDeploy')
      
      if [ "$SAFE" = "true" ]; then
        echo "Safe to deploy"
        exit 0
      fi
      
      echo "Waiting for safe state... ($i/30)"
      sleep 10
    done
    
    echo "Timeout waiting for safe state"
    exit 1

- name: Deploy
  run: ./scripts/deploy.sh

- name: Exit maintenance mode
  if: always()
  run: |
    curl -X POST ${{ secrets.SERVER_URL }}/admin/maintenance/exit \
      -H "x-admin-code: ${{ secrets.ADMIN_CODE }}"
```

### Emergency Rollback

```bash
#!/bin/bash
set -e

SERVER_URL="https://hyperscape.gg"
ADMIN_CODE="your-admin-code"

# 1. Enter maintenance mode immediately
echo "Emergency maintenance mode..."
curl -X POST "$SERVER_URL/admin/maintenance/enter" \
  -H "x-admin-code: $ADMIN_CODE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "emergency rollback", "timeoutMs": 60000}'

# 2. Rollback (don't wait for safe state in emergency)
echo "Rolling back..."
git checkout <previous-commit>
bun install --frozen-lockfile
bun run build
pm2 restart all

# 3. Exit maintenance mode
echo "Resuming operations..."
curl -X POST "$SERVER_URL/admin/maintenance/exit" \
  -H "x-admin-code: $ADMIN_CODE"

echo "Rollback complete"
```

## State Machine

### Maintenance Mode States

```
NOT_ACTIVE → ENTERING → WAITING → SAFE → EXITING → NOT_ACTIVE
                ↓                    ↓
              TIMEOUT              TIMEOUT
```

**NOT_ACTIVE**: Normal operations, duel cycles running
**ENTERING**: Pausing new cycles, locking markets
**WAITING**: Waiting for active markets to resolve
**SAFE**: Safe to deploy (no active duels or markets)
**TIMEOUT**: Timeout reached, deployment can proceed (with caution)
**EXITING**: Resuming operations

### Duel Phase States

```
IDLE → COUNTDOWN → FIGHTING → ANNOUNCEMENT → IDLE
```

**IDLE**: No active duel, safe to deploy
**COUNTDOWN**: Duel starting soon, wait for completion
**FIGHTING**: Duel in progress, wait for completion
**ANNOUNCEMENT**: Winner announced, wait for market resolution

### Market States

```
OPEN → LOCKED → RESOLVED
```

**OPEN**: Accepting bets, not safe to deploy
**LOCKED**: No new bets, waiting for resolution
**RESOLVED**: Payouts complete, safe to deploy

## Integration Examples

### Node.js

```javascript
import fetch from 'node-fetch';

class MaintenanceClient {
  constructor(serverUrl, adminCode) {
    this.serverUrl = serverUrl;
    this.adminCode = adminCode;
  }

  async enter(reason = 'deployment', timeoutMs = 300000) {
    const response = await fetch(`${this.serverUrl}/admin/maintenance/enter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-code': this.adminCode,
      },
      body: JSON.stringify({ reason, timeoutMs }),
    });

    if (!response.ok) {
      throw new Error(`Failed to enter maintenance mode: ${response.statusText}`);
    }

    return response.json();
  }

  async status() {
    const response = await fetch(`${this.serverUrl}/admin/maintenance/status`, {
      headers: {
        'x-admin-code': this.adminCode,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  async exit() {
    const response = await fetch(`${this.serverUrl}/admin/maintenance/exit`, {
      method: 'POST',
      headers: {
        'x-admin-code': this.adminCode,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to exit maintenance mode: ${response.statusText}`);
    }

    return response.json();
  }

  async waitForSafeState(maxWaitMs = 300000, pollIntervalMs = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.status();

      if (status.safeToDeploy) {
        return status;
      }

      console.log(`Waiting for safe state... (${status.currentPhase}, ${status.pendingMarkets} pending markets)`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Timeout waiting for safe state');
  }
}

// Usage
const client = new MaintenanceClient('https://hyperscape.gg', process.env.ADMIN_CODE);

async function deploy() {
  try {
    // Enter maintenance mode
    await client.enter('automated deployment');

    // Wait for safe state
    await client.waitForSafeState();

    // Deploy
    console.log('Deploying...');
    // Your deployment logic here

    // Exit maintenance mode
    await client.exit();
    console.log('Deployment complete');
  } catch (error) {
    console.error('Deployment failed:', error);
    // Attempt to exit maintenance mode even on failure
    try {
      await client.exit();
    } catch (exitError) {
      console.error('Failed to exit maintenance mode:', exitError);
    }
    process.exit(1);
  }
}

deploy();
```

### Python

```python
import requests
import time
import json

class MaintenanceClient:
    def __init__(self, server_url, admin_code):
        self.server_url = server_url
        self.admin_code = admin_code
        self.headers = {'x-admin-code': admin_code}

    def enter(self, reason='deployment', timeout_ms=300000):
        response = requests.post(
            f'{self.server_url}/admin/maintenance/enter',
            headers={**self.headers, 'Content-Type': 'application/json'},
            json={'reason': reason, 'timeoutMs': timeout_ms}
        )
        response.raise_for_status()
        return response.json()

    def status(self):
        response = requests.get(
            f'{self.server_url}/admin/maintenance/status',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def exit(self):
        response = requests.post(
            f'{self.server_url}/admin/maintenance/exit',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def wait_for_safe_state(self, max_wait_ms=300000, poll_interval_ms=10000):
        start_time = time.time() * 1000

        while (time.time() * 1000 - start_time) < max_wait_ms:
            status = self.status()

            if status['safeToDeploy']:
                return status

            print(f"Waiting for safe state... ({status['currentPhase']}, {status['pendingMarkets']} pending markets)")
            time.sleep(poll_interval_ms / 1000)

        raise TimeoutError('Timeout waiting for safe state')

# Usage
client = MaintenanceClient('https://hyperscape.gg', os.environ['ADMIN_CODE'])

try:
    # Enter maintenance mode
    client.enter('automated deployment')

    # Wait for safe state
    client.wait_for_safe_state()

    # Deploy
    print('Deploying...')
    # Your deployment logic here

    # Exit maintenance mode
    client.exit()
    print('Deployment complete')
except Exception as e:
    print(f'Deployment failed: {e}')
    # Attempt to exit maintenance mode even on failure
    try:
        client.exit()
    except Exception as exit_error:
        print(f'Failed to exit maintenance mode: {exit_error}')
    sys.exit(1)
```

## Best Practices

### Timeout Configuration

**Recommended Timeouts:**
- **Development**: 60000ms (1 minute) - faster iteration
- **Staging**: 180000ms (3 minutes) - balance speed and safety
- **Production**: 300000ms (5 minutes) - maximum safety

**Considerations:**
- Duel duration: ~60-120 seconds
- Market resolution: ~10-30 seconds
- Network latency: ~1-5 seconds
- Buffer: 2x expected duration

### Error Handling

**Always exit maintenance mode** - even on deployment failure:

```javascript
try {
  await client.enter();
  await client.waitForSafeState();
  await deploy();
} finally {
  // Always exit, even on error
  try {
    await client.exit();
  } catch (error) {
    console.error('Failed to exit maintenance mode:', error);
    // Alert ops team
  }
}
```

### Monitoring

**Log all maintenance mode events:**
- Entry timestamp and reason
- Safe state achieved timestamp
- Exit timestamp and duration
- Any timeouts or errors

**Alert on:**
- Maintenance mode timeout (markets didn't resolve)
- Failed to exit maintenance mode
- Maintenance mode active > 10 minutes

### Health Endpoint Integration

The `/health` endpoint includes maintenance mode status:

```bash
curl https://hyperscape.gg/health
```

**Response:**
```json
{
  "status": "healthy",
  "maintenance": false,
  "streaming": {
    "active": true,
    "phase": "IDLE"
  }
}
```

**Use for:**
- Load balancer health checks
- Monitoring dashboards
- Automated alerts

## Implementation Details

**Source Code**: `packages/server/src/startup/maintenance-mode.ts`

**Dependencies:**
- DuelScheduler system (pauses cycles)
- Betting market system (locks markets)
- Streaming state (monitors phases)

**State Storage**: In-memory (resets on server restart)

**Thread Safety**: Single-threaded Node.js (no race conditions)

## Related Documentation

- **Deployment Guide**: [docs/deployment-best-practices.md](../deployment-best-practices.md)
- **Streaming Guide**: [docs/streaming-configuration.md](../streaming-configuration.md)
- **Railway Setup**: [docs/railway-dev-prod.md](../railway-dev-prod.md)
- **Environment Variables**: [packages/server/.env.example](../../packages/server/.env.example)

## Changelog

- **February 26, 2026** (Commit `30b52bd`): Initial implementation
  - Added `/admin/maintenance/enter` endpoint
  - Added `/admin/maintenance/status` endpoint
  - Added `/admin/maintenance/exit` endpoint
  - Integrated with CI/CD workflow
  - Added helper scripts

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/HyperscapeAI/hyperscape/issues
- **Documentation**: https://github.com/HyperscapeAI/hyperscape/tree/main/docs
- **Discord**: [Join our community](https://discord.gg/hyperscape)
