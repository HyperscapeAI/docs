# Content Security Policy (CSP)

Hyperscape implements a strict Content Security Policy to protect against XSS and other web vulnerabilities.

## Overview

The CSP is configured in `packages/client/vite.config.ts` and enforced via HTTP headers in production deployments.

## Current Policy

### script-src

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' 
  https://esm.sh 
  https://cdn.jsdelivr.net 
  https://unpkg.com 
  https://static.cloudflareinsights.com
```

**Allowed sources**:
- `'self'` - Same origin scripts
- `'unsafe-inline'` - Inline scripts (required for Vite HMR)
- `'unsafe-eval'` - eval() (required for WASM and some libraries)
- `https://esm.sh` - ES module CDN
- `https://cdn.jsdelivr.net` - CDN for dependencies
- `https://unpkg.com` - npm package CDN
- `https://static.cloudflareinsights.com` - Cloudflare analytics

### style-src

```
style-src 'self' 'unsafe-inline' 
  https://fonts.googleapis.com
```

**Allowed sources**:
- `'self'` - Same origin styles
- `'unsafe-inline'` - Inline styles (required for styled-components)
- `https://fonts.googleapis.com` - Google Fonts CSS

### font-src

```
font-src 'self' data: 
  https://fonts.gstatic.com
```

**Allowed sources**:
- `'self'` - Same origin fonts
- `data:` - Data URLs for embedded fonts
- `https://fonts.gstatic.com` - Google Fonts files

### img-src

```
img-src 'self' data: blob: 
  https://*.r2.cloudflarestorage.com 
  https://assets.hyperscape.club
```

**Allowed sources**:
- `'self'` - Same origin images
- `data:` - Data URLs for embedded images
- `blob:` - Blob URLs for generated images
- `https://*.r2.cloudflarestorage.com` - Cloudflare R2 CDN
- `https://assets.hyperscape.club` - Asset CDN

### connect-src

```
connect-src 'self' 
  ws://localhost:* 
  wss://localhost:* 
  ws://*.hyperscape.gg 
  wss://*.hyperscape.gg 
  https://*.hyperscape.gg 
  https://api.privy.io 
  https://auth.privy.io
```

**Allowed sources**:
- `'self'` - Same origin connections
- `ws://localhost:*` / `wss://localhost:*` - Local WebSocket (development)
- `ws://*.hyperscape.gg` / `wss://*.hyperscape.gg` - Production WebSocket
- `https://*.hyperscape.gg` - Production API
- `https://api.privy.io` - Privy authentication
- `https://auth.privy.io` - Privy auth endpoints

### worker-src

```
worker-src 'self' blob: data:
```

**Allowed sources**:
- `'self'` - Same origin workers
- `blob:` - Blob URLs for workers
- `data:` - Data URLs for WASM workers

### child-src

```
child-src 'self' blob:
```

### frame-src

```
frame-src 'self' 
  https://verify.walletconnect.com 
  https://verify.walletconnect.org 
  https://auth.privy.io
```

**Allowed sources**:
- `'self'` - Same origin iframes
- `https://verify.walletconnect.com` - WalletConnect verification
- `https://verify.walletconnect.org` - WalletConnect verification
- `https://auth.privy.io` - Privy auth iframe

## Recent Changes

### February 2026 Updates

#### 1. Cloudflare Insights Support

**Commit**: `1b2e230bdb613dd3d1b04c12ae2c3d36ee3f0f81`

Added `https://static.cloudflareinsights.com` to `script-src` for Cloudflare analytics.

#### 2. Google Fonts Support

**Commit**: `e012ed2203cf0e2d5b310aaf6ee0d60d0e056e8c`

Added:
- `https://fonts.googleapis.com` to `style-src`
- `https://fonts.gstatic.com` to `font-src`

#### 3. WASM Data URLs

**Commit**: `8626299c98d3d346eaa6fcae63d9f27ef5f92c37`

Added `data:` to `worker-src` for WASM loading.

**Reason**: PhysX WASM module uses data URLs for worker initialization.

## Configuration

### Vite Configuration

CSP is configured in `packages/client/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [
    {
      name: 'csp-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader('Content-Security-Policy', CSP_POLICY);
          next();
        });
      }
    }
  ]
});
```

### Production Headers

For Cloudflare Pages, CSP is set in `packages/client/public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://static.cloudflareinsights.com; ...
```

## Troubleshooting

### CSP Violation Errors

**Symptom**: Console shows CSP violation warnings

**Example**:
```
Refused to load the script 'https://example.com/script.js' because it violates the following Content Security Policy directive: "script-src 'self' ..."
```

**Solution**:
1. Identify the blocked resource
2. Verify it's necessary and trusted
3. Add to appropriate CSP directive
4. Test in development
5. Deploy to production

### WASM Loading Blocked

**Symptom**: PhysX or other WASM modules fail to load

**Error**:
```
Refused to load worker from 'data:...' because it violates CSP directive "worker-src 'self'"
```

**Solution**: Ensure `data:` is in `worker-src` directive.

### Font Loading Blocked

**Symptom**: Google Fonts don't load

**Solution**: Verify both directives are set:
```
style-src: https://fonts.googleapis.com
font-src: https://fonts.gstatic.com
```

## Security Best Practices

### 1. Minimize 'unsafe-*' Directives

Current necessary uses:
- `'unsafe-inline'` - Required for styled-components and Vite HMR
- `'unsafe-eval'` - Required for WASM and some dependencies

**Goal**: Remove these in future by:
- Using nonces for inline scripts
- Migrating away from eval-dependent libraries

### 2. Restrict CDN Sources

Only allow trusted CDNs:
- ✅ `esm.sh` - ES module CDN (trusted)
- ✅ `cdn.jsdelivr.net` - npm CDN (trusted)
- ✅ `unpkg.com` - npm CDN (trusted)
- ❌ `cdn.example.com` - Unknown CDN (blocked)

### 3. Use Subresource Integrity (SRI)

For external scripts, use SRI hashes:

```html
<script 
  src="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 4. Monitor CSP Reports

**Future**: Enable CSP reporting to track violations:

```
Content-Security-Policy-Report-Only: ...; report-uri /api/csp-report
```

## Testing

### Validate CSP

```bash
# Check CSP headers in development
curl -I http://localhost:3333

# Check CSP headers in production
curl -I https://hyperscape.gg
```

### Test CSP Violations

```typescript
// Intentionally violate CSP to test blocking
const script = document.createElement('script');
script.src = 'https://evil.com/malicious.js';
document.body.appendChild(script);
// Should be blocked by CSP
```

## References

- **Configuration**: `packages/client/vite.config.ts`
- **Production Headers**: `packages/client/public/_headers`
- **CSP Spec**: [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- **CSP Evaluator**: [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
