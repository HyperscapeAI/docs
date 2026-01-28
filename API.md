# Hyperscape API Reference

Complete API documentation for the Hyperscape game server.

## Base URLs

| Environment | HTTP API | WebSocket |
|-------------|----------|-----------|
| **Development** | `http://localhost:5555` | `ws://localhost:5555/ws` |
| **Production** | `https://hyperscape-production.up.railway.app` | `wss://hyperscape-production.up.railway.app/ws` |

## Authentication

Most endpoints require authentication via JWT token or Privy authentication.

**Headers:**
```http
Authorization: Bearer <jwt-token>
```

**Getting a token:**
1. Authenticate with Privy on the client
2. Client receives JWT token from server
3. Include token in subsequent requests

## REST API Endpoints

### Health & Status

#### GET /health

Health check endpoint for load balancers.

**Response:**
```json
{
  "status": "ok"
}
```

#### GET /status

Detailed server status with metrics.

**Response:**
```json
{
  "status": "ok",
  "players": 12,
  "uptime": 3600,
  "version": "1.0.0",
  "timestamp": 1706000000000
}
```

### Game Data

#### GET /api/data/skill-unlocks

Get skill unlock definitions for all skills.

**Description:** Returns server-authoritative skill unlock data used by the Skill Guide Panel. This data is not bundled in the client to ensure consistency and allow updates without client rebuilds.

**Authentication:** Not required (public data)

**Response:**
```json
{
  "attack": [
    {
      "level": 1,
      "description": "Bronze weapons, Iron weapons",
      "type": "item"
    },
    {
      "level": 40,
      "description": "Rune weapons",
      "type": "item"
    }
  ],
  "woodcutting": [
    {
      "level": 1,
      "description": "Normal trees",
      "type": "item"
    },
    {
      "level": 15,
      "description": "Oak trees",
      "type": "item"
    }
  ]
}
```

**Unlock Types:**
- `item` - Equipment, resources, or craftable items
- `ability` - Passive bonuses, prayers, or unlocked actions
- `area` - New locations or zones
- `quest` - Quest requirements or unlocks
- `activity` - New activities or minigames

**Skills Available:**
- `attack`, `strength`, `defense`, `constitution`, `ranged`
- `woodcutting`, `mining`, `fishing`, `cooking`, `firemaking`, `smithing`
- `agility`, `prayer`

**Example Usage:**
```typescript
const response = await fetch('http://localhost:5555/api/data/skill-unlocks');
const unlocks = await response.json();
const attackUnlocks = unlocks.attack; // Array of SkillUnlock
```

### Actions

#### GET /api/actions

List all available actions in the game.

**Response:**
```json
{
  "actions": [
    "attack",
    "gather",
    "cook",
    "bank",
    "equip",
    "move"
  ]
}
```

#### GET /api/actions/available

Get actions available to a specific player.

**Query Parameters:**
- `playerId` (required) - Player entity ID

**Response:**
```json
{
  "actions": [
    {
      "name": "attack",
      "enabled": true,
      "cooldown": 0
    },
    {
      "name": "gather",
      "enabled": true,
      "cooldown": 0
    }
  ]
}
```

#### POST /api/actions/:name

Execute a specific action.

**Path Parameters:**
- `name` - Action name (e.g., "attack", "gather")

**Request Body:**
```json
{
  "playerId": "player-123",
  "targetId": "goblin-456",
  "data": {}
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "damage": 5,
    "xp": 10
  }
}
```

### Assets

#### GET /assets/world/:path

Serve game assets (models, textures, audio).

**Examples:**
- `/assets/world/models/mobs/goblin.glb`
- `/assets/world/audio/music/normal/1.mp3`
- `/assets/world/textures/terrain/grass.png`

**Headers:**
```http
Cache-Control: public, max-age=31536000, immutable
Content-Type: <mime-type>
Accept-Ranges: bytes
```

#### GET /manifests/:path

Serve JSON manifest files.

**Examples:**
- `/manifests/npcs.json`
- `/manifests/items/weapons.json`
- `/manifests/gathering/fishing.json`

**Headers:**
```http
Cache-Control: public, max-age=300, must-revalidate
Content-Type: application/json; charset=utf-8
```

### Utility

#### GET /env.js

Get public environment variables for client configuration.

**Response:**
```javascript
window.ENV = {
  PUBLIC_CDN_URL: "https://assets.hyperscape.club",
  PUBLIC_WS_URL: "wss://hyperscape-production.up.railway.app/ws",
  PUBLIC_API_URL: "https://hyperscape-production.up.railway.app",
  PUBLIC_PRIVY_APP_ID: "clxxx...",
  PUBLIC_APP_URL: "https://hyperscape.club"
};
```

#### POST /api/upload

Upload user assets (VRM avatars, textures).

**Request:**
```http
Content-Type: multipart/form-data

file: <binary-data>
type: "avatar" | "texture"
```

**Response:**
```json
{
  "success": true,
  "url": "/uploads/avatar-123.vrm"
}
```

**Limits:**
- Max file size: 100 MB
- Allowed types: `.vrm`, `.png`, `.jpg`, `.glb`

#### GET /api/upload-check

Check if an uploaded asset exists.

**Query Parameters:**
- `filename` (required) - Asset filename

**Response:**
```json
{
  "exists": true,
  "url": "/uploads/avatar-123.vrm"
}
```

### Debug

#### GET /debug/public

Debug endpoint showing public directory contents.

**Response:**
```json
{
  "publicDir": "/app/packages/server/public",
  "assetsDir": "/app/packages/server/public/assets",
  "publicContents": ["index.html", "favicon.ico", "assets"],
  "assetsContents": ["models", "audio", "textures"],
  "configDirname": "/app/packages/server"
}
```

**Use Case:** Troubleshooting deployment issues, verifying frontend build was copied correctly.

## WebSocket API

### Connection

**Endpoint:** `ws://localhost:5555/ws` (dev) or `wss://hyperscape-production.up.railway.app/ws` (prod)

**Connection Flow:**
```
1. Client connects to WebSocket endpoint
2. Server sends "connected" message
3. Client sends authentication message
4. Server verifies token and spawns player
5. Bidirectional communication begins
```

### Message Format

All WebSocket messages use JSON:

```typescript
interface Message {
  type: string;
  data: any;
}
```

### Client → Server Messages

#### authenticate

Authenticate the connection.

```json
{
  "type": "authenticate",
  "data": {
    "token": "jwt-token-here"
  }
}
```

#### selectCharacter

Select a character to spawn.

```json
{
  "type": "selectCharacter",
  "data": {
    "characterId": "char-123"
  }
}
```

#### move

Move player to a position.

```json
{
  "type": "move",
  "data": {
    "x": 10.5,
    "y": 0,
    "z": 20.3
  }
}
```

#### attack

Attack a target entity.

```json
{
  "type": "attack",
  "data": {
    "targetId": "goblin-456"
  }
}
```

#### chat

Send a chat message.

```json
{
  "type": "chat",
  "data": {
    "message": "Hello world!"
  }
}
```

### Server → Client Messages

#### connected

Sent when client connects.

```json
{
  "type": "connected",
  "data": {
    "serverId": "server-1",
    "timestamp": 1706000000000
  }
}
```

#### playerSpawned

Sent when player spawns in world.

```json
{
  "type": "playerSpawned",
  "data": {
    "playerId": "player-123",
    "position": { "x": 0, "y": 0, "z": 0 },
    "stats": {
      "attack": { "level": 1, "xp": 0 },
      "strength": { "level": 1, "xp": 0 }
    }
  }
}
```

#### entityUpdate

Sent when entities change.

```json
{
  "type": "entityUpdate",
  "data": {
    "entities": [
      {
        "id": "goblin-456",
        "type": "Mob",
        "position": { "x": 5, "y": 0, "z": 10 },
        "health": 50
      }
    ]
  }
}
```

#### combatHit

Sent when combat damage occurs.

```json
{
  "type": "combatHit",
  "data": {
    "attackerId": "player-123",
    "targetId": "goblin-456",
    "damage": 5,
    "attackStyle": "melee"
  }
}
```

#### xpGain

Sent when player gains XP.

```json
{
  "type": "xpGain",
  "data": {
    "skill": "attack",
    "xp": 10,
    "newLevel": 2
  }
}
```

## Rate Limiting

### Global Rate Limit

**Limit:** 100 requests per minute per IP address

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706000060
```

**Response (when exceeded):**
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

### Endpoint-Specific Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/upload` | 10 requests | 1 minute |
| `/api/actions/*` | 60 requests | 1 minute |
| WebSocket messages | 100 messages | 1 second |

### Disabling Rate Limiting

**Development only:**
```env
DISABLE_RATE_LIMIT=true
```

**Never disable in production** - exposes server to abuse and DDoS attacks.

## Error Responses

### Standard Error Format

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid player ID"
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Server is starting or overloaded |

## CORS Configuration

### Allowed Origins

**Production:**
- `https://hyperscape.club`
- `https://www.hyperscape.club`
- `https://hyperscape.pages.dev`
- `https://*.hyperscape.pages.dev` (preview deployments)
- `https://hyperscape-production.up.railway.app`

**Development:**
- `http://localhost:*` (any port)
- `http://127.0.0.1:*` (any port)

**Dynamic Patterns:**
- `/^https?:\/\/localhost:\d+$/` - Localhost with any port
- `/^https?:\/\/.+\.hyperscape\.pages\.dev$/` - Cloudflare preview deployments
- `/^https:\/\/.+\.farcaster\.xyz$/` - Farcaster integration
- `/^https:\/\/.+\.privy\.io$/` - Privy authentication
- `/^https:\/\/.+\.up\.railway\.app$/` - Railway deployments

### Allowed Methods

- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`

### Allowed Headers

- `Content-Type`
- `Authorization`
- `X-Requested-With`

### Credentials

CORS credentials are enabled for authenticated requests.

## Caching Strategy

### Static Assets

**Long-term cache** (1 year):
```http
Cache-Control: public, max-age=31536000, immutable
```

**Applied to:**
- 3D models (`.glb`)
- Audio files (`.mp3`, `.ogg`, `.wav`)
- Textures (`.png`, `.jpg`)
- Scripts in `/assets/` directory

### Manifests

**Short-term cache** (5 minutes):
```http
Cache-Control: public, max-age=300, must-revalidate
```

**Applied to:**
- JSON manifests (`/manifests/*.json`)

### HTML/Scripts

**No cache** (always fresh):
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

**Applied to:**
- `index.html`
- Scripts outside `/assets/` directory

## Security Headers

### SharedArrayBuffer Support

Required for PhysX WASM:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### Content Security

```http
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
```

## WebSocket Protocol

### Connection Lifecycle

```
1. Client connects to /ws
2. Server sends "connected" event
3. Client sends "authenticate" message
4. Server verifies token
5. Client sends "selectCharacter" message
6. Server spawns player and sends "playerSpawned"
7. Bidirectional game messages
8. Client disconnects or server closes connection
```

### Message Types

**Client → Server:**
- `authenticate` - Authenticate connection
- `selectCharacter` - Select character to spawn
- `createCharacter` - Create new character
- `move` - Move player
- `attack` - Attack target
- `gather` - Gather resource
- `cook` - Cook food
- `bank` - Bank interaction
- `equip` - Equip item
- `chat` - Send chat message
- `emote` - Play emote animation

**Server → Client:**
- `connected` - Connection established
- `authenticated` - Authentication successful
- `characterList` - Available characters
- `playerSpawned` - Player spawned in world
- `entityUpdate` - Entity state changes
- `combatHit` - Combat damage event
- `xpGain` - XP gained event
- `levelUp` - Level up event
- `itemPickup` - Item picked up
- `chatMessage` - Chat message from player
- `error` - Error message

### Ping/Pong

**Server → Client:**
```json
{
  "type": "ping",
  "data": {
    "timestamp": 1706000000000
  }
}
```

**Client → Server:**
```json
{
  "type": "pong",
  "data": {
    "timestamp": 1706000000000
  }
}
```

**Configuration:**
```env
WS_PING_INTERVAL_SEC=5        # Ping every 5 seconds
WS_PING_MISS_TOLERANCE=3      # Disconnect after 3 missed pongs
WS_PING_GRACE_MS=5000         # Grace period for new connections
```

## Data Models

### SkillUnlock

```typescript
interface SkillUnlock {
  level: number;
  description: string;
  type: "item" | "ability" | "area" | "quest" | "activity";
}
```

### PlayerStats

```typescript
interface PlayerStats {
  attack: { level: number; xp: number };
  strength: { level: number; xp: number };
  defense: { level: number; xp: number };
  constitution: { level: number; xp: number };
  ranged: { level: number; xp: number };
  woodcutting: { level: number; xp: number };
  mining: { level: number; xp: number };
  fishing: { level: number; xp: number };
  cooking: { level: number; xp: number };
  firemaking: { level: number; xp: number };
  smithing: { level: number; xp: number };
  agility: { level: number; xp: number };
  prayer: { level: number; xp: number };
}
```

### Character

```typescript
interface Character {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  lastPlayed: number;
  stats: PlayerStats;
  position: { x: number; y: number; z: number };
  inventory: Item[];
  equipment: Equipment;
}
```

## Client Libraries

### TypeScript/JavaScript

```typescript
import { HyperscapeClient } from '@hyperscape/client';

const client = new HyperscapeClient({
  apiUrl: 'https://hyperscape-production.up.railway.app',
  wsUrl: 'wss://hyperscape-production.up.railway.app/ws',
});

// Authenticate
await client.authenticate(privyToken);

// Get skill unlocks
const unlocks = await client.getSkillUnlocks();

// Connect to WebSocket
await client.connect();

// Send action
await client.sendAction('attack', { targetId: 'goblin-123' });
```

### Python

```python
import requests
import websocket

# REST API
response = requests.get('https://hyperscape-production.up.railway.app/api/data/skill-unlocks')
unlocks = response.json()

# WebSocket
ws = websocket.create_connection('wss://hyperscape-production.up.railway.app/ws')
ws.send('{"type":"authenticate","data":{"token":"..."}}')
result = ws.recv()
```

### cURL

```bash
# Get skill unlocks
curl https://hyperscape-production.up.railway.app/api/data/skill-unlocks

# Health check
curl https://hyperscape-production.up.railway.app/health

# Execute action (requires auth)
curl -X POST https://hyperscape-production.up.railway.app/api/actions/attack \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player-123","targetId":"goblin-456"}'
```

## Changelog

### v1.1.0 (2026-01-22)

**New Endpoints:**
- `GET /api/data/skill-unlocks` - Skill unlock definitions
- `GET /debug/public` - Public directory debug info

**Changes:**
- Manifests now fetched from CDN at startup
- CORS allowlist expanded for Cloudflare Pages
- Frontend build integrated into server deployment
- Improved error messages for missing frontend

**Deprecations:**
- None

**Breaking Changes:**
- None

### v1.0.0 (2026-01-15)

**Initial Release:**
- REST API for actions and game data
- WebSocket API for real-time gameplay
- PostgreSQL persistence
- Privy authentication
- Asset serving with CDN support

## Support

- **API Issues:** https://github.com/HyperscapeAI/hyperscape/issues
- **Documentation:** See README.md and CLAUDE.md
- **Community:** Discord server (link in main README)

## License

MIT - See LICENSE file
