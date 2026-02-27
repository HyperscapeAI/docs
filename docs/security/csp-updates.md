# Content Security Policy Updates

Recent CSP (Content Security Policy) updates to support new features while maintaining security.

## Recent Changes

### Google Fonts Support (Commit e012ed2)

**Added:**
- `fonts.googleapis.com` to `style-src`
- `fonts.gstatic.com` to `font-src`

**Reason:**
UI components now use Google Fonts for better typography.

**Configuration:**
```typescript
// vite.config.ts
const csp = {
  'style-src': ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
  'font-src': ["'self'", "fonts.gstatic.com"],
};
```

---

### Cloudflare Insights (Commit 1b2e230)

**Added:**
- `static.cloudflareinsights.com` to `script-src`

**Reason:**
Cloudflare Web Analytics integration for production deployment.

**Configuration:**
```typescript
const csp = {
  'script-src': ["'self'", "'unsafe-inline'", "static.cloudflareinsights.com"],
};
```

---

### WASM Loading (Commit 8626299)

**Added:**
- `data:` to `script-src`

**Reason:**
PhysX WASM module loading requires data URLs for inline scripts.

**Removed:**
- `report-uri` directive (broken endpoint)

**Configuration:**
```typescript
const csp = {
  'script-src': ["'self'", "'unsafe-inline'", "data:"],
};
```

---

### Vite Node Polyfills (Commit e012ed2)

**Added:**
- Module resolution aliases for `vite-plugin-node-polyfills/shims/*`

**Reason:**
Production builds failed with "Failed to resolve module specifier" errors.

**Configuration:**
```typescript
// vite.config.ts
resolve: {
  alias: {
    'vite-plugin-node-polyfills/shims/buffer': 'vite-plugin-node-polyfills/dist/shims/buffer.js',
    'vite-plugin-node-polyfills/shims/global': 'vite-plugin-node-polyfills/dist/shims/global.js',
    'vite-plugin-node-polyfills/shims/process': 'vite-plugin-node-polyfills/dist/shims/process.js',
  }
}
```

## Current CSP Configuration

### Client (packages/client/vite.config.ts)

```typescript
const csp = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "data:",
    "static.cloudflareinsights.com",
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    "fonts.googleapis.com",
  ],
  'font-src': [
    "'self'",
    "fonts.gstatic.com",
  ],
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https:",
  ],
  'connect-src': [
    "'self'",
    "wss:",
    "https:",
  ],
  'worker-src': [
    "'self'",
    "blob:",
  ],
  'child-src': [
    "'self'",
    "blob:",
  ],
};
```

### Why `unsafe-inline` and `unsafe-eval`?

**`unsafe-inline` for scripts:**
- Required for Vite HMR (Hot Module Replacement) in development
- Required for inline event handlers in React
- Required for Cloudflare Insights

**`unsafe-inline` for styles:**
- Required for styled-components
- Required for inline styles in React components
- Required for Google Fonts

**`unsafe-eval` for scripts:**
- Required for Vite development mode
- Required for dynamic imports
- Required for WASM instantiation

**Production Hardening:**
For production, consider using nonces or hashes instead of `unsafe-inline`:

```typescript
// Generate nonce per request
const nonce = crypto.randomBytes(16).toString('base64');

// Add to CSP header
'script-src': [`'self'`, `'nonce-${nonce}'`],

// Add to script tags
<script nonce={nonce}>...</script>
```

## Security Considerations

### Allowed Origins

**Fonts:**
- `fonts.googleapis.com` - Google Fonts CSS
- `fonts.gstatic.com` - Google Fonts WOFF2 files

**Analytics:**
- `static.cloudflareinsights.com` - Cloudflare Web Analytics

**Images:**
- `https:` - Allow all HTTPS images (for user avatars, external assets)
- `data:` - Data URLs for inline images
- `blob:` - Blob URLs for generated images

**WebSocket:**
- `wss:` - Secure WebSocket connections
- `https:` - HTTPS connections

### Blocked by Default

- `http:` origins (except localhost in development)
- `ws:` origins (except localhost in development)
- `ftp:` origins
- `file:` origins
- Inline event handlers (except with `unsafe-inline`)

## Testing CSP

### Development

CSP violations are logged to console:

```javascript
// Check for CSP violations
window.addEventListener('securitypolicyviolation', (e) => {
  console.error('CSP Violation:', {
    blockedURI: e.blockedURI,
    violatedDirective: e.violatedDirective,
    originalPolicy: e.originalPolicy,
  });
});
```

### Production

CSP violations can be reported to an endpoint:

```typescript
const csp = {
  // ... other directives
  'report-uri': '/api/csp-report',
  'report-to': 'csp-endpoint',
};
```

**Note:** `report-uri` was removed in commit 8626299 due to broken endpoint. Re-enable when endpoint is fixed.

## Related Files

- `packages/client/vite.config.ts` - CSP configuration
- `packages/client/public/_headers` - Cloudflare Pages headers
- `packages/client/src/lib/error-reporting.ts` - CSP violation handling

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Cloudflare CSP Guide](https://developers.cloudflare.com/pages/platform/headers/)
