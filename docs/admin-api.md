# Admin API Documentation

Administrative endpoints for managing Hyperscape server deployments.

## Authentication

All admin endpoints require authentication via the `x-admin-code` header:

```bash
curl -H "x-admin-code: YOUR_ADMIN_CODE" http://your-server/admin/endpoint
```

Set `ADMIN_CODE` in your environment variables or `.env` file.

## Graceful Restart

### POST /admin/graceful-restart

Request a server restart after the current duel ends. Enables zero-downtime deployments for the duel arena stream.

**Headers:**
- `x-admin-code` (required): Admin authentication code

**Response:**
```json
{
  "success": true,
  "pendingRestart": true,
  "currentPhase": "FIGHTING"
}
```

**Behavior:**
- If no duel active (IDLE/ANNOUNCEMENT): Restarts immediately via SIGTERM
- If duel in progress (FIGHTING/RESOLUTION): Waits until RESOLUTION phase completes
- PM2 automatically restarts the server with new code
- No interruption to active duels or streams

**Example:**
```bash
curl -X POST http://your-server/admin/graceful-restart \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

**Use Cases:**
- Deploy new code without interrupting active duels
- Update server configuration during live streams
- Apply security patches with minimal disruption

### GET /admin/restart-status

Check if a graceful restart is pending.

**Headers:**
- `x-admin-code` (required): Admin authentication code

**Response:**
```json
{
  "success": true,
  "pendingRestart": false,
  "currentPhase": "IDLE"
}
```

**Fields:**
- `success` (boolean): Request succeeded
- `pendingRestart` (boolean): Whether restart is pending
- `currentPhase` (string): Current duel phase (IDLE, ANNOUNCEMENT, FIGHTING, RESOLUTION)

**Example:**
```bash
curl http://your-server/admin/restart-status \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

## Programmatic API

The graceful restart functionality is also available programmatically via the `StreamingDuelScheduler` class:

```typescript
import { StreamingDuelScheduler } from '@hyperscape/server/systems/StreamingDuelScheduler';

// Request graceful restart
const scheduler = world.getSystem('streamingDuelScheduler') as StreamingDuelScheduler;
scheduler.requestGracefulRestart();

// Check if restart is pending
const isPending = scheduler.isPendingRestart();
```

## Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin code"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to request graceful restart"
}
```

## Configuration

Set the admin code in your environment:

```bash
# .env or environment variables
ADMIN_CODE=your-secret-admin-code
```

**Security Notes:**
- Never commit `ADMIN_CODE` to git
- Use a strong, randomly generated code
- Rotate the code periodically
- Store in GitHub Secrets for CI/CD deployments

## Related Documentation

- [Deployment Process](../scripts/deploy-vast.sh) - Vast.ai deployment script
- [PM2 Configuration](../ecosystem.config.cjs) - PM2 process management
- [Streaming Status Check](../scripts/check-streaming-status.sh) - Health monitoring script
