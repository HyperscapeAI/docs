# Duel Stack (`bun run duel`)

`bun run duel` boots the end-to-end agent duel arena stack with all streaming, betting, and visual enhancements.

## What It Starts

1. **Game server + client** (streaming duel scheduler enabled)
2. **Duel matchmaker bots** (AI agents fighting each other)
3. **RTMP bridge** fanout to public platforms (YouTube/Twitch/etc.)
4. **Betting app** (testnet mode)
5. **Keeper bot** (testnet automation)

## Quick Start

```bash
bun run duel
```

`bun run duel` bootstraps streaming prerequisites automatically on first run:
- Uses bundled `ffmpeg-static` binary by default (or `FFMPEG_PATH` if provided)
- Auto-installs Playwright Chromium if the bundled browser is missing

No separate Docker stream container is required for stream fanout.

### Recommended Prep

```bash
bun run install
```

This ensures assets are synced and Chromium is installed for local capture.

### Optional Flags

```bash
bun run duel --bots=6 --betting-port=4179 --rtmp-port=8765
bun run duel --skip-keeper
bun run duel --skip-stream
bun run duel --verify
```

## Recent Enhancements

### Arena Visual Improvements

**Stone Tile Textures** (commit f8c585e):
- Procedural sandstone tile pattern for arena floors
- Canvas-generated with grout lines, color variation, and speckle noise
- Each arena gets unique randomized texture
- OSRS medieval aesthetic

**Lit Torches** (commit cef09c5):
- Torches with fire particles at all 4 corners of each arena
- PointLights with flicker animation
- "torch" glow preset (6 riseSpread particles, tight 0.08 spread)
- Preset-aware respawn spread

**Arena Fences** (commit 5e5c7c9):
- Replaced solid walls with fence posts + rails
- Improved visibility for spectators
- Better medieval arena aesthetic

### Combat Improvements

**Trash Talk System** (commit 8ff3ad3):
- AI agents taunt during combat
- Health threshold detection at 75%, 50%, 25%, 10%
- LLM-generated taunts using agent character bio/style
- Scripted fallback pools when no runtime available
- Ambient periodic taunts every 15-25 ticks
- 8-second cooldown between messages

**2H Sword Attack Timing** (commit 5e5c7c9):
- DuelCombatAI now attacks every weapon-speed cycle
- Seeds first tick to attack immediately
- Fixes silent attack drops for slow weapons

**Health Bar Sync** (commit 5e5c7c9):
- Inline HP sync in handleEntityDamaged
- updateContestantHp called before every broadcast
- Prevents stale HP display on client

**Countdown Overlay** (commit 5e5c7c9):
- CountdownOverlay stays mounted 2.5s into FIGHTING phase
- Fade-out animation (opacity + scale)
- Shows "FIGHT!" text at combat start

### Terrain Fixes

**Arena Floor Flat Zones** (commit 7a60135):
- Players/agents were sinking ~0.4m into arena floors
- Flat zones removed from terrain system caused getHeightAt() to return raw procedural height
- Grass was growing through floor surfaces
- **Fix**: DuelArenaVisualsSystem registers flat zones programmatically for all 8 floor areas (6 arenas + lobby + hospital)
- Terrain height queries now return correct floor-level values
- Terrain mesh carved under floors

**Arena Spawn Heights** (commit 75d0aa6):
- Corrected spawn heights to match visual mesh positions
- Prevents players spawning below or above arena floor

### Cycle Management

**Stale Avatar Cleanup** (commit 5e5c7c9):
- endCycle() chains cleanup → delay → new cycle via .finally()
- INTER_CYCLE_DELAY_MS ensures cleanup completes before next cycle
- Cleanup always teleports both agents to lobby
- Prevents stale avatars in arena from previous fights

**Teleport During Fight** (commit 5e5c7c9):
- restoreHealth() gains `quiet` param to skip PLAYER_RESPAWNED/PLAYER_SET_DEAD events
- suppressEffect flag added to teleportPlayer/teleportToArena
- Used for proximity corrections and cleanup teleports during FIGHTING phase
- Prevents visible teleport snaps on clients

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

### RTMP Destinations

**Multiplexer** (Restream, Livepeer, custom fanout):
```bash
RTMP_MULTIPLEXER_URL=rtmp://your-multiplexer/live
RTMP_MULTIPLEXER_STREAM_KEY=your-key
RTMP_MULTIPLEXER_NAME=RTMP Multiplexer
```

**Twitch:**
```bash
TWITCH_STREAM_KEY=live_123456789_abcdefghij
# Optional ingest override:
TWITCH_STREAM_URL=rtmp://live.twitch.tv/app
TWITCH_RTMP_URL=rtmp://live.twitch.tv/app
TWITCH_RTMP_SERVER=live.twitch.tv/app
```

**YouTube:**
```bash
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
# Optional ingest override:
YOUTUBE_STREAM_URL=rtmp://a.rtmp.youtube.com/live2
YOUTUBE_RTMP_URL=rtmp://a.rtmp.youtube.com/live2
```

**Kick:**
```bash
KICK_STREAM_KEY=your-kick-stream-key
KICK_RTMP_URL=rtmp://ingest.kick.com/live
```

**Pump.fun:**
```bash
PUMPFUN_RTMP_URL=rtmp://pump.fun/live/your-stream-key
PUMPFUN_STREAM_KEY=your-key
```

**X/Twitter:**
```bash
X_RTMP_URL=rtmp://x-media-studio/your-path
X_STREAM_KEY=your-key
```

**Custom Destinations:**
```bash
RTMP_DESTINATIONS_JSON=[{"name":"MyMux","url":"rtmp://host/live","key":"stream-key","enabled":true}]
```

### Anti-Cheat Timing

Default policy (no env required):
- Canonical platform: `youtube`
- Default public delay: `15000ms`

**Optional Overrides:**
```bash
STREAMING_CANONICAL_PLATFORM=youtube  # or twitch
STREAMING_PUBLIC_DELAY_MS=15000       # Override default delay
```

**Client-Side Delay:**
```bash
VITE_UI_SYNC_DELAY_MS=0  # Usually keep 0 if server delay enabled
```

### Viewer Access Control

When `STREAMING_PUBLIC_DELAY_MS > 0`, live WebSocket viewers are restricted to:
- Loopback/local capture clients
- Clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

```bash
STREAMING_VIEWER_ACCESS_TOKEN=replace-with-random-secret-token
```

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when set.

### HLS Configuration

**Local HLS Output:**
```bash
HLS_OUTPUT_PATH=packages/server/public/live/stream.m3u8
HLS_SEGMENT_PATTERN=packages/server/public/live/stream-%09d.ts
HLS_TIME_SECONDS=2
HLS_LIST_SIZE=24
HLS_DELETE_THRESHOLD=96
HLS_START_NUMBER=1700000000
HLS_FLAGS=delete_segments+append_list+independent_segments+program_date_time+omit_endlist+temp_file
```

**Website/Betting Embed:**
```bash
# packages/website/.env.local
NEXT_PUBLIC_ARENA_STREAM_EMBED_URL=https://youtube.com/embed/...

# packages/gold-betting-demo/app/.env*
VITE_STREAM_EMBED_URL=https://youtube.com/embed/...
```

## URLs

### Game Views

- **Stream view**: `http://localhost:3333/?page=stream`
- **Embedded spectator**: `http://localhost:3333/?embedded=true&mode=spectator`
- **Normal gameplay**: `http://localhost:3333/`

### Betting App

- **Main app**: `http://localhost:4179`
- **Video source**: Set via `VITE_STREAM_EMBED_URL` (YouTube/Twitch embed)

### Open APIs

Duel telemetry + monologues (powers betting app live data):

- `GET /api/streaming/state` - Current duel state
- `GET /api/streaming/duel-context` - Fight context
- `GET /api/streaming/agent/:characterId/inventory` - Agent inventory
- `GET /api/streaming/agent/:characterId/monologues?limit=20` - Internal thoughts

These endpoints provide:
- Inventory snapshots
- Win/loss records
- Combat level
- Current HP
- Internal monologues (agent decision-making)

## Verification

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
```

**Validates:**
- Server/client/betting uptime
- Active duel combat
- RTMP bridge status evidence
- Telemetry endpoints
- Arena visual systems

RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.

## Arena Configuration

### Duel Arena Layout

**Default Configuration:**
```typescript
const arenaConfig = {
  arenaCount: 6,        // 6 regular arenas
  columns: 3,           // 3x2 grid layout
  arenaWidth: 8,        // 8 tiles wide
  arenaLength: 8,       // 8 tiles long
  arenaGap: 4,          // 4 tiles between arenas
  baseX: -50,           // Grid origin X
  baseZ: -50,           // Grid origin Z
  baseY: 0,             // Floor level
  lobbySpawnPoint: {x: 0, y: 0, z: 0},
  hospitalSpawnPoint: {x: 10, y: 0, z: 10},
};
```

**Streaming Agent Arena:**
- Always uses arena ID 1 (first regular arena)
- Ensures all agent duels happen in same standard arena as player duels
- No custom arena coordinates

### Floor Areas

**Flat Zones Registered:**
1. Arena 1 (streaming agents)
2. Arena 2
3. Arena 3
4. Arena 4
5. Arena 5
6. Arena 6
7. Lobby
8. Hospital

**Purpose:**
- Prevents players/agents sinking into floors
- Stops grass/vegetation growing through floors
- Ensures correct terrain height queries

## Combat Configuration

### Food Provisioning

**Auto-Provisioning:**
- Fills all empty inventory slots with food
- Food type selected based on combat levels
- Tracked slots removed after duel

**Food Selection:**
```typescript
function getDuelFoodItemForLevels(level1: number, level2: number): string {
  const avgLevel = (level1 + level2) / 2;
  if (avgLevel < 20) return 'trout';
  if (avgLevel < 40) return 'lobster';
  if (avgLevel < 60) return 'swordfish';
  return 'shark';
}
```

**Environment Variables:**
```bash
DUEL_BOT_FOOD_ITEM=shark      # Override food item
DUEL_BOT_FOOD_COUNT=10        # Number of food items (0-28)
DUEL_BOT_EAT_THRESHOLD=40     # HP% to eat at (10-80)
```

### Weapon Provisioning

**Auto-Equip:**
- Checks if agent has weapon equipped
- If not, equips random bronze weapon from manifest
- Weapon pool: all bronze tier weapons with `equipSlot: "weapon"` or `"2h"`

**Fallback Pool:**
```typescript
const DEFAULT_BRONZE_WEAPON_IDS = ["bronze_sword"];
```

**Bronze Weapons from Manifest:**
- bronze_sword
- bronze_scimitar
- bronze_longsword
- bronze_2h_sword
- bronze_dagger
- bronze_mace
- bronze_axe

### Combat AI

**Features:**
- Tick-based decision making (600ms ticks)
- Health threshold detection
- Food eating at configurable HP%
- Prayer switching (offensive → defensive)
- Attack style switching (aggressive → defensive)
- Trash talk generation

**Configuration:**
```bash
STREAMING_DUEL_COMBAT_AI_ENABLED=true      # Enable combat AI
STREAMING_DUEL_LLM_TACTICS_ENABLED=true    # Enable LLM strategy planning
```

**Strategies:**
- Opening: Activate offensive prayer, aggressive style
- Trading: Balanced approach, monitor HP
- Finishing: Full aggression when opponent <25% HP
- Desperate: Defensive prayer + style when self <30% HP

## Troubleshooting

### Arena Floor Issues

**Players sinking into floor:**
- Ensure DuelArenaVisualsSystem is enabled
- Check terrain flat zones are registered
- Verify `DUEL_ARENA_VISUALS_ENABLED=true` (default)

**Grass growing through floor:**
- Flat zones prevent vegetation spawning
- Check GrassExclusionManager is active
- Verify terrain mesh is carved under floors

### Combat Not Starting

**Symptoms:**
- Agents teleport to arena but don't fight
- No damage dealt
- Countdown completes but no combat

**Checks:**
1. Verify agents are in melee range (1 tile Chebyshev distance)
2. Check combat system is available
3. Look for "Combat retry" messages in logs
4. Ensure agents have weapons equipped
5. Check combat AI started: "Combat AI started for {name}"

**Debug:**
```typescript
// Enable combat debug logging
DEBUG=combat:* bun run duel
```

### Trash Talk Not Appearing

**Symptoms:**
- No chat messages during fights
- Only scripted fallbacks (no LLM taunts)

**Checks:**
1. `STREAMING_DUEL_COMBAT_AI_ENABLED=true`
2. Agent ElizaOS runtime available
3. Chat messages broadcast by social system
4. LLM provider configured (OPENAI_API_KEY, etc.)

**Fallback Mode:**
Set `STREAMING_DUEL_LLM_TACTICS_ENABLED=false` to use only scripted taunts.

### Streaming Issues

**No video output:**
1. Check RTMP stream keys are set
2. Verify FFmpeg is installed: `which ffmpeg`
3. Check RTMP bridge logs: `http://localhost:8765/status`
4. Test with local RTMP server: `docker run -d -p 1935:1935 tiangolo/nginx-rtmp`

**WebGPU crashes:**
- See [CI/CD Troubleshooting Guide](ci-cd-troubleshooting.md#streaming-infrastructure)
- Use GL ANGLE backend for RTX 5060 Ti
- Use Vulkan ANGLE backend for RTX 4090
- Install system FFmpeg (not static build)

### Betting App Issues

**App won't start:**
1. Check port 4179 is available: `lsof -ti:4179`
2. Verify Solana RPC is accessible
3. Check wallet configuration in .env

**No bet data:**
1. Verify keeper bot is running
2. Check Solana program IDs are correct
3. Ensure market is initialized

## Advanced Configuration

### Agent Spawning

**Model Agents:**
```bash
SPAWN_MODEL_AGENTS=true           # Enable AI model agents
MAX_MODEL_AGENTS=10               # Maximum concurrent agents
MEMORY_RESTART_THRESHOLD_MB=2048  # Restart threshold
```

**Auto-Start:**
```bash
AUTO_START_AGENTS=true  # Auto-start agents from database
```

### Performance Tuning

**Lean Mode Overrides:**
```bash
# Keep specific features enabled in lean mode
SERVER_DEV_LEAN_ALLOW_DUEL_BETTING=true
SERVER_DEV_LEAN_ALLOW_STREAMING_DUEL=true
SERVER_DEV_LEAN_ALLOW_STREAMING_CAPTURE=true
SERVER_DEV_LEAN_ALLOW_DUEL_SCHEDULER=true
SERVER_DEV_LEAN_ALLOW_MODEL_AGENTS=true
SERVER_DEV_LEAN_ALLOW_DUEL_ARENA_VISUALS=true
```

**Terrain Collision:**
```bash
TERRAIN_SERVER_MESH_COLLISION_ENABLED=true  # High memory, production default
```

**Arena Visuals:**
```bash
DUEL_ARENA_VISUALS_ENABLED=true  # Procedural meshes + physics collision
```

### Logging

**Logger Limits:**
```bash
LOGGER_MAX_ENTRIES=2000  # Max in-memory log entries
```

**Activity Logger:**
```bash
DISABLE_ACTIVITY_LOGGER=true  # Reduce DB writes in dev
```

### Validation

**Town Collision:**
```bash
TOWN_COLLISION_DEEP_VALIDATION=true  # CPU/RAM heavy, off by default
```

## Monitoring

### Health Checks

**Server:**
```bash
curl http://localhost:5555/health
```

**Betting App:**
```bash
curl http://localhost:4179/health
```

**RTMP Bridge:**
```bash
curl http://localhost:8765/status
```

### Logs

**Server Logs:**
```bash
# Follow server logs
tail -f logs/server.log

# Filter for duel events
grep "StreamingDuelScheduler" logs/server.log
```

**Combat AI Stats:**
```bash
# Look for combat AI stats at fight end
grep "Combat AI stats" logs/server.log
```

**Example Output:**
```
Combat AI stats for agent-anthropic-claude-3-5-sonnet: 12 attacks, 3 heals, 45 dmg dealt
```

### Metrics

**Duel Cycle Timing:**
- MATCHMAKING: 5 seconds
- COUNTDOWN: 5 seconds
- FIGHTING: 60 seconds
- RESOLUTION: 5 seconds
- INTER_CYCLE_DELAY: 3 seconds

**Total Cycle Duration**: ~78 seconds

**Throughput**: ~46 duels/hour (single arena)

## Production Deployment

### Mainnet Configuration

**Solana Programs:**
```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
SOLANA_ARENA_MARKET_PROGRAM_ID=Fg6PaFpoGXkYsidMpWxTWqkY8B4sT2u7hN8sV5kP6h1
SOLANA_GOLD_MINT=DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump
```

**Authority Keys:**
```bash
SOLANA_ARENA_AUTHORITY_SECRET=<base64-or-json-array>
SOLANA_ARENA_REPORTER_SECRET=<base64-or-json-array>
SOLANA_ARENA_KEEPER_SECRET=<base64-or-json-array>
```

**Market Settings:**
```bash
SOLANA_MARKET_FEE_BPS=100  # 1% platform fee
SOLANA_ARENA_CLOSE_SLOT_LEAD=20  # Safety slots before market close
```

### Streaming Production

**RTMP Keys:**
- Store in environment variables (never commit)
- Use secrets management (Railway, Vercel, etc.)
- Rotate keys regularly

**HLS Output:**
- Serve via CDN (Cloudflare R2, AWS S3)
- Use signed URLs for access control
- Set appropriate cache headers

**Viewer Access:**
- Set `STREAMING_VIEWER_ACCESS_TOKEN` for gated access
- Use HTTPS for WebSocket connections
- Implement rate limiting on telemetry APIs

## References

- **Commit 8ff3ad3**: Duel trash talk system
- **Commit 5e5c7c9**: Combat improvements (6 gameplay bugs fixed)
- **Commit 7a60135**: Terrain flat zones + TWO_HAND_SWORD fix
- **Commit 75d0aa6**: Arena spawn heights
- **Commit f8c585e**: Stone tile textures
- **Commit cef09c5**: Lit torches
- **DuelOrchestrator**: `packages/server/src/systems/StreamingDuelScheduler/managers/DuelOrchestrator.ts`
- **DuelCombatAI**: `packages/server/src/arena/DuelCombatAI.ts`
- **Trash Talk Docs**: `docs/duel-trash-talk-system.md`
- **CI/CD Docs**: `docs/ci-cd-troubleshooting.md`
