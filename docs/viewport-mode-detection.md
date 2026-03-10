# Viewport Mode Detection API

The `clientViewportMode` utility provides runtime detection of different viewport modes for conditional rendering and behavior.

## Overview

Hyperscape supports three viewport modes:
1. **Normal Mode** - Standard gameplay (default)
2. **Stream Mode** - Optimized for streaming capture (`/stream.html` or `?page=stream`)
3. **Embedded Spectator Mode** - Embedded spectator view (`?embedded=true&mode=spectator`)

## API Reference

### `isStreamPageRoute(win?: Window): boolean`

Detects if the current page is running in streaming capture mode.

**Returns**: `true` if:
- URL pathname ends with `/stream.html`
- URL query parameter `page=stream`

**Example**:
```typescript
import { isStreamPageRoute } from '@hyperscape/shared/runtime/clientViewportMode';

if (isStreamPageRoute()) {
  // Hide UI elements for clean streaming capture
  hidePlayerUI();
}
```

### `isEmbeddedSpectatorViewport(win?: Window): boolean`

Detects if running as an embedded spectator (e.g., in betting app iframe).

**Returns**: `true` if:
- URL query parameters: `embedded=true` AND `mode=spectator`
- OR window config: `__HYPERSCAPE_EMBEDDED__=true` AND `__HYPERSCAPE_CONFIG__.mode="spectator"`

**Example**:
```typescript
import { isEmbeddedSpectatorViewport } from '@hyperscape/shared/runtime/clientViewportMode';

if (isEmbeddedSpectatorViewport()) {
  // Disable player controls in spectator mode
  disablePlayerInput();
}
```

### `isStreamingLikeViewport(win?: Window): boolean`

Detects any streaming-like viewport (stream OR embedded spectator).

**Returns**: `true` if either `isStreamPageRoute()` or `isEmbeddedSpectatorViewport()` returns `true`.

**Example**:
```typescript
import { isStreamingLikeViewport } from '@hyperscape/shared/runtime/clientViewportMode';

if (isStreamingLikeViewport()) {
  // Apply streaming-specific optimizations
  reduceUIOverhead();
  disableDebugOverlays();
}
```

## Usage Patterns

### Conditional UI Rendering

```typescript
import { isStreamPageRoute } from '@hyperscape/shared/runtime/clientViewportMode';

function GameUI() {
  const isStreaming = isStreamPageRoute();
  
  return (
    <>
      {!isStreaming && <PlayerInventory />}
      {!isStreaming && <ChatPanel />}
      <GameViewport />
    </>
  );
}
```

### Streaming Optimizations

```typescript
import { isStreamingLikeViewport } from '@hyperscape/shared/runtime/clientViewportMode';

function initializeRenderer() {
  const renderer = new WebGPURenderer();
  
  if (isStreamingLikeViewport()) {
    // Optimize for streaming capture
    renderer.setPixelRatio(1); // Fixed 1:1 for consistent encoding
    renderer.shadowMap.enabled = true; // High quality shadows for viewers
  } else {
    // Optimize for player experience
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = userSettings.shadows;
  }
  
  return renderer;
}
```

### Spectator Controls

```typescript
import { isEmbeddedSpectatorViewport } from '@hyperscape/shared/runtime/clientViewportMode';

function CameraController() {
  const isSpectator = isEmbeddedSpectatorViewport();
  
  useEffect(() => {
    if (isSpectator) {
      // Lock camera to arena view
      camera.position.set(0, 50, 50);
      camera.lookAt(0, 0, 0);
      controls.enabled = false;
    }
  }, [isSpectator]);
}
```

## URL Patterns

### Stream Mode

```
http://localhost:3333/stream.html
http://localhost:3333/?page=stream
https://hyperscape.gg/stream.html
https://hyperscape.gg/?page=stream
```

### Embedded Spectator Mode

```
http://localhost:3333/?embedded=true&mode=spectator
https://hyperscape.gg/?embedded=true&mode=spectator
```

### Normal Mode

```
http://localhost:3333/
http://localhost:3333/index.html
https://hyperscape.gg/
```

## Vite Multi-Page Build

The client now builds separate entry points for different modes:

**vite.config.ts**:
```typescript
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

**Output**:
- `dist/index.html` - Main game bundle
- `dist/stream.html` - Streaming capture bundle (minimal UI)

## Integration with Streaming Pipeline

The streaming capture pipeline uses these URLs:

**ecosystem.config.cjs**:
```javascript
env: {
  GAME_URL: "http://localhost:3333/?page=stream",
  GAME_FALLBACK_URLS: "http://localhost:3333/?page=stream,http://localhost:3333/?embedded=true&mode=spectator,http://localhost:3333/",
}
```

**Fallback Order**:
1. Stream page (`?page=stream`) - Preferred for clean capture
2. Embedded spectator (`?embedded=true&mode=spectator`) - Fallback if stream page fails
3. Normal game (`/`) - Last resort

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { isStreamPageRoute, isEmbeddedSpectatorViewport, isStreamingLikeViewport } from '@hyperscape/shared/runtime/clientViewportMode';

describe('Viewport Mode Detection', () => {
  it('detects stream page route', () => {
    const mockWindow = {
      location: { pathname: '/stream.html', search: '' }
    } as Window;
    
    expect(isStreamPageRoute(mockWindow)).toBe(true);
  });
  
  it('detects embedded spectator', () => {
    const mockWindow = {
      location: { pathname: '/', search: '?embedded=true&mode=spectator' }
    } as Window;
    
    expect(isEmbeddedSpectatorViewport(mockWindow)).toBe(true);
  });
  
  it('detects streaming-like viewport', () => {
    const mockWindow = {
      location: { pathname: '/stream.html', search: '' }
    } as Window;
    
    expect(isStreamingLikeViewport(mockWindow)).toBe(true);
  });
});
```

## Migration Guide

### Before (Manual URL Parsing)

```typescript
// Old approach - manual URL parsing
const urlParams = new URLSearchParams(window.location.search);
const isStreaming = urlParams.get('page') === 'stream';
```

### After (Utility Functions)

```typescript
// New approach - use utility functions
import { isStreamPageRoute } from '@hyperscape/shared/runtime/clientViewportMode';

const isStreaming = isStreamPageRoute();
```

## Related Files

- `packages/shared/src/runtime/clientViewportMode.ts` - Core implementation
- `packages/client/src/stream.html` - Streaming entry point
- `packages/client/src/stream.tsx` - Streaming React entry
- `ecosystem.config.cjs` - PM2 streaming configuration
- `packages/client/vite.config.ts` - Multi-page build configuration
