# Maintenance Mode API

The maintenance mode API provides graceful deployment capabilities for the Hyperscape server. It allows administrators to pause new duel cycles, wait for active markets to resolve, and safely deploy updates without interrupting ongoing gameplay.

## Overview

Maintenance mode prevents new duel cycles from starting while allowing active duels to complete naturally. This ensures:
- No interrupted duels during deployments
- Clean market resolution before shutdown
- Zero data loss or corrupted game states
- Smooth player experience during updates

## API Endpoints

### Enter Maintenance Mode

Pauses new duel cycles and prevents new matches from starting.

```http
POST /admin/maintenance/enter
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "maintenanceMode": true,
  "timestamp": "2026-02-26T02:51:44Z"
}
```

**Behavior:**
- Stops the streaming duel scheduler from starting new cycles
- Allows active duels to complete normally
- Prevents new agent matchmaking
- Returns immediately (non-blocking)

### Exit Maintenance Mode

Resumes normal operations and allows new duel cycles to start.

```http
POST /admin/maintenance/exit
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "maintenanceMode": false,
  "timestamp": "2026-02-26T02:51:44Z"
}
```

**Behavior:**
- Re-enables the streaming duel scheduler
- Allows new duel cycles to start
- Resumes agent matchmaking
- Returns immediately (non-blocking)

### Check Maintenance Status

Query the current maintenance mode state.

```http
GET /admin/maintenance/status
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "maintenanceMode": false,
  "activeDuels": 2,
  "pendingMarkets": 1
}
```

**Fields:**
- `maintenanceMode`: Boolean indicating if maintenance mode is active
- `activeDuels`: Number of currently running duel cycles
- `pendingMarkets`: Number of unresolved betting markets

## Health Endpoint Integration

The `/health` endpoint now includes maintenance mode status:

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "maintenanceMode": false,
  "timestamp": "2026-02-26T02:51:44Z"
}
```

## Helper Scripts

Two convenience scripts are provided for manual maintenance mode control:

### Enter Maintenance Mode

```bash
# From repository root
./scripts/pre-deploy-maintenance.sh
```

This script:
1. Calls `POST /admin/maintenance/enter`
2. Polls `/admin/maintenance/status` until `activeDuels` reaches 0
3. Waits for all markets to resolve
4. Exits when safe to deploy

**Environment Variables:**
- `API_URL` - Server URL (default: `http://localhost:5555`)
- `ADMIN_TOKEN` - Admin authentication token

### Exit Maintenance Mode

```bash
# From repository root
./scripts/post-deploy-resume.sh
```

This script:
1. Calls `POST /admin/maintenance/exit`
2. Verifies maintenance mode is disabled
3. Confirms duel scheduler has resumed

## CI/CD Integration

The GitHub Actions workflow `.github/workflows/deploy-vast.yml` uses maintenance mode for zero-downtime deployments:

```yaml
- name: Enter maintenance mode
  run: |
    curl -X POST $API_URL/admin/maintenance/enter \
      -H "Authorization: Bearer $ADMIN_TOKEN"

- name: Wait for active duels to complete
  run: |
    while true; do
      STATUS=$(curl -s $API_URL/admin/maintenance/status \
        -H "Authorization: Bearer $ADMIN_TOKEN")
      ACTIVE=$(echo $STATUS | jq -r '.activeDuels')
      if [ "$ACTIVE" -eq "0" ]; then break; fi
      echo "Waiting for $ACTIVE active duels to complete..."
      sleep 10
    done

- name: Deploy new version
  run: ./scripts/deploy-vast.sh

- name: Exit maintenance mode
  run: |
    curl -X POST $API_URL/admin/maintenance/exit \
      -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Vast.ai Health Checking

The `vast-keeper` service now includes automatic health checking and instance recovery:

**Features:**
- Auto-detects unhealthy instances via `/health` endpoint polling
- Destroys and reprovisions instances when failures exceed threshold
- Configurable health check intervals
- Integrates with maintenance mode for safe deployments

**Environment Variables:**
```bash
HEALTH_CHECK_INTERVAL=60000          # Health check interval (ms)
HEALTH_CHECK_FAILURE_THRESHOLD=3     # Failures before destroy/reprovision
VAST_API_KEY=your-vast-api-key       # Required for instance management
```

## Deployment Best Practices

### Safe Deployment Workflow

1. **Enter maintenance mode** - Stop new duel cycles
2. **Wait for completion** - Poll until `activeDuels` reaches 0
3. **Deploy updates** - Run deployment scripts
4. **Health check** - Verify new instance is healthy
5. **Exit maintenance mode** - Resume normal operations

### Monitoring

Monitor maintenance mode status during deployments:

```bash
# Watch maintenance status
watch -n 5 'curl -s http://localhost:5555/admin/maintenance/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq'
```

### Rollback Procedure

If deployment fails:

```bash
# Exit maintenance mode immediately
curl -X POST http://localhost:5555/admin/maintenance/exit \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Revert to previous deployment
# (deployment-specific rollback steps)
```

## Security

**Authentication Required**: All maintenance mode endpoints require admin authentication via Bearer token.

**Authorization Header:**
```http
Authorization: Bearer <ADMIN_TOKEN>
```

The `ADMIN_TOKEN` must be set in server environment variables and kept secret.

## Implementation Details

**Server-Side:**
- Maintenance mode state is stored in-memory (not persisted)
- State resets to `false` on server restart
- Duel scheduler checks maintenance mode before starting new cycles
- No database changes required

**Client-Side:**
- No client-side changes needed
- Players in active duels are unaffected
- New duel requests are queued until maintenance mode exits

## Troubleshooting

**Maintenance mode stuck:**
```bash
# Force exit maintenance mode
curl -X POST http://localhost:5555/admin/maintenance/exit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Active duels not completing:**
- Check server logs for duel scheduler errors
- Verify combat system is processing ticks
- Inspect `/api/streaming/state` for duel status

**Health checks failing:**
- Verify `/health` endpoint is accessible
- Check server logs for errors
- Ensure database connection is healthy
- Verify WebSocket server is running

## Related Documentation

- [Deployment Guide](./railway-dev-prod.md) - Railway deployment setup
- [Duel Stack](./duel-stack.md) - Streaming duel system architecture
- [CI/CD Improvements](./ci-cd-improvements.md) - Build workflow enhancements
