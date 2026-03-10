# Viewport Mode Detection API

The `clientViewportMode` utility provides automatic detection of different viewport modes for conditional rendering and optimization.

## Location

`packages/shared/src/runtime/clientViewportMode.ts`

## Functions

### `isStreamPageRoute(win?: Window): boolean`

Detects if the client is running in streaming capture mode.

**Returns**: `true` if running on `/stream.html` or with `?page=stream` query parameter.

**Usage**:
```typescript
import { isStreamPageRoute } from '@hyperscape/shared';

if (isStreamPageRoute(window)) {
  // Optimized for streaming capture
  // - Minimal UI overhead
  // - No interactive elements
  // - Optimized for RTMP encoding
}
```

**Detection Logic**:
- Checks if pathname ends with `/stream.html`
- Checks if `?page=stream` query parameter is present
- Case-insensitive matching

### `isEmbeddedSpectatorViewport(win?: Window): boolean`

Detects if the client is running as an embedded spectator (e.g., in betting app iframe).

**Returns**: `true` if running with `?embedded=true&mode=spectator` or configured via `__HYPERSCAPE_EMBEDDED__` and `__HYPERSCAPE_CONFIG__`.

**Usage**:
```typescript
import { isEmbeddedSpectatorViewport } from '@hyperscape/shared';

if (isEmbeddedSpectatorViewport(window)) {
  // Embedded spectator UI
  // - Read-only view
  // - No player controls
  // - Optimized for iframe embedding
}
```

**Detection Logic**:
- Checks `?embedded=true&mode=spectator` query parameters
- Checks `window.__HYPERSCAPE_EMBEDDED__ === true` and `window.__HYPERSCAPE_CONFIG__.mode === 'spectator'`
- Supports both URL-based and programmatic configuration

### `isStreamingLikeViewport(win?: Window): boolean`

Detects any streaming-like viewport (streaming capture or embedded spectator).

**Returns**: `true` if either `isStreamPageRoute()` or `isEmbeddedSpectatorViewport()` returns `true`.

**Usage**:
```typescript
import { isStreamingLikeViewport } from '@hyperscape/shared';

if (isStreamingLikeViewport(window)) {
  // Any streaming-like viewport
  // - Disable heavy UI features
  // - Optimize for performance
  // - Reduce network overhead
}
```

## Streaming Entry Points

### Main Game Entry

**File**: `packages/client/src/index.html` → `dist/index.html`

**Purpose**: Full game client with all UI features and player controls.

**URL**: `http://localhost:3333/` or `https://hyperscape.gg/`

### Streaming Capture Entry

**File**: `packages/client/src/stream.html` → `dist/stream.html`

**Purpose**: Optimized for RTMP streaming capture with minimal UI overhead.

**URL**: `http://localhost:3333/stream.html` or `http://localhost:3333/?page=stream`

**Features**:
- Minimal UI (no panels, no controls)
- Optimized rendering for streaming
- Automatic viewport mode detection
- Separate bundle for faster loading

**Vite Configuration**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        stream: resolve(__dirname, 'src/stream.html'),
      },
    },
  },
});
```

## Environment Variables

### Streaming Capture Configuration

```bash
# Chrome channel (chrome-beta recommended for stability)
STREAM_CAPTURE_CHANNEL=chrome-beta

# ANGLE backend (default recommended for compatibility)
STREAM_CAPTURE_ANGLE=default

# Capture resolution
STREAM_CAPTURE_WIDTH=1280
STREAM_CAPTURE_HEIGHT=720

# Xvfb virtual display (for headless servers)
DISPLAY=:99

# Game URL for streaming capture
GAME_URL=http://localhost:3333/?page=stream

# Fallback URLs (comma-separated)
GAME_FALLBACK_URLS=http://localhost:3333/?page=stream,http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/
```

### Stream Destination Auto-Detection

```bash
# Auto-detected from available keys (no manual config needed)
STREAM_ENABLED_DESTINATIONS=twitch,kick

# Twitch (multiple formats supported)
TWITCH_STREAM_KEY=live_123456789_abcdefghij
TWITCH_RTMP_STREAM_KEY=live_123456789_abcdefghij

# Kick
KICK_STREAM_KEY=your-kick-stream-key

# YouTube
YOUTUBE_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
YOUTUBE_RTMP_STREAM_KEY=xxxx-xxxx-xxxx-xxxx-xxxx
```

## Implementation Example

```typescript
// packages/client/src/stream.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { isStreamPageRoute } from '@hyperscape/shared';
import { GameClient } from './screens/GameClient';

// Detect streaming mode
const isStreaming = isStreamPageRoute(window);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameClient 
      streamingMode={isStreaming}
      showUI={!isStreaming}
      enableControls={!isStreaming}
    />
  </React.StrictMode>
);
```

## Conditional Rendering

```typescript
// Example: Conditionally render UI based on viewport mode
import { isStreamingLikeViewport } from '@hyperscape/shared';

function GameUI() {
  const isStreaming = isStreamingLikeViewport(window);

  return (
    <>
      {/* Always render game world */}
      <GameWorld />

      {/* Only render UI in non-streaming mode */}
      {!isStreaming && (
        <>
          <InventoryPanel />
          <EquipmentPanel />
          <SkillsPanel />
          <ChatPanel />
        </>
      )}

      {/* Minimal HUD for streaming */}
      {isStreaming && (
        <StreamingOverlay />
      )}
    </>
  );
}
```

## Browser Compatibility

### WebGPU Requirements

All viewport modes require WebGPU support:

- Chrome 113+
- Edge 113+
- Safari 18+ (macOS 15+)
- Check: [webgpureport.org](https://webgpureport.org)

### Server/Streaming Requirements

For Vast.ai and GPU server deployments:

- **NVIDIA GPU with Display Driver** - Must have `gpu_display_active=true`
- **Chrome Beta Channel** - `google-chrome-beta` for stability
- **ANGLE Backend** - Use `--use-angle=default` (NOT Vulkan)
- **Xvfb Virtual Display** - Required for headless servers
- **PM2 Environment** - Explicit `DISPLAY=:99` forwarding

## Related Documentation

- `AGENTS.md` - Streaming pipeline fixes and recent changes
- `CLAUDE.md` - WebGPU requirements and development guidelines
- `docs/duel-stack.md` - Duel stack configuration and streaming setup
- `packages/server/.env.example` - Complete streaming configuration reference
