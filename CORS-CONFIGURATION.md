# CORS Configuration Guide

Complete guide for configuring Cross-Origin Resource Sharing (CORS) in Hyperscape.

## Overview

Hyperscape uses a split deployment architecture where the frontend and backend are hosted on different domains. CORS configuration is critical for allowing the frontend to communicate with the backend API and WebSocket server.

## Current Configuration

### Allowed Origins

**File:** `packages/server/src/startup/http-server.ts`

**Production Domains (HTTPS):**
- `https://hyperscape.club` - Main production domain
- `https://www.hyperscape.club` - WWW subdomain
- `https://hyperscape.pages.dev` - Cloudflare Pages primary domain
- `https://hyperscape-production.up.railway.app` - Railway server domain

**Production Domains (HTTP):**
- `http://hyperscape.pages.dev` - HTTP fallback for testing

**Development:**
- `http://localhost:3333` - Default client dev server
- `http://localhost:5555` - Default game server
- `http://localhost:4001` - ElizaOS API server

**Dynamic Patterns:**
```javascript
/^https?:\/\/localhost:\d+$/                    // Any localhost port
/^https?:\/\/.+\.hyperscape\.pages\.dev$/       // Cloudflare preview deployments
/^https:\/\/.+\.farcaster\.xyz$/                // Farcaster integration
/^https:\/\/.+\.warpcast\.com$/                 // Warpcast integration
/^https:\/\/.+\.privy\.io$/                     // Privy authentication
/^https:\/\/.+\.up\.railway\.app$/              // Railway deployments
```

### Allowed Methods

- `GET` - Read operations
- `POST` - Create operations
- `PUT` - Update operations
- `DELETE` - Delete operations
- `OPTIONS` - Preflight requests
- `PATCH` - Partial updates

### Allowed Headers

- `Content-Type` - Request content type
- `Authorization` - JWT tokens
- `X-Requested-With` - AJAX requests

### Credentials

**Enabled:** `credentials: true`

Allows cookies and authentication headers to be sent cross-origin.

## Adding New Origins

### Development Domains

**Add to allowedOrigins array:**

```typescript
// In packages/server/src/startup/http-server.ts
const allowedOrigins = [
  // ... existing origins
  "http://localhost:3000",  // Add your dev port
];
```

### Production Domains

**Add to allowedOrigins array:**

```typescript
const allowedOrigins = [
  // ... existing origins
  "https://your-custom-domain.com",
];
```

**Or use environment variable:**

```env
# In packages/server/.env
PUBLIC_APP_URL=https://your-custom-domain.com
```

The server automatically adds `PUBLIC_APP_URL` to the allowlist.

### Dynamic Patterns

**Add regex pattern:**

```typescript
const allowedOrigins = [
  // ... existing origins
  /^https:\/\/.+\.your-domain\.com$/,  // All subdomains
];
```

## Common CORS Issues

### Issue: "CORS policy blocked request"

**Symptoms:**
- Browser console shows CORS error
- Network tab shows failed preflight request
- Status code 0 or CORS error

**Solutions:**

1. **Check origin is in allowlist:**
   ```bash
   # View current CORS config
   grep -A 20 "allowedOrigins" packages/server/src/startup/http-server.ts
   ```

2. **Add origin to allowlist:**
   ```typescript
   const allowedOrigins = [
     // ... existing
     "https://your-domain.com",
   ];
   ```

3. **Verify environment variables:**
   ```bash
   # Check PUBLIC_APP_URL is set
   echo $PUBLIC_APP_URL
   ```

4. **Restart server:**
   ```bash
   bun run dev  # Development
   railway restart  # Production
   ```

### Issue: "Credentials not allowed"

**Symptoms:**
- CORS error mentioning credentials
- Authentication fails cross-origin

**Solution:**

Ensure `credentials: true` is set:

```typescript
await fastify.register(cors, {
  origin: allowedOrigins,
  credentials: true,  // Must be true for auth
  // ...
});
```

### Issue: "Method not allowed"

**Symptoms:**
- CORS error for specific HTTP method
- Preflight request fails

**Solution:**

Add method to allowed methods:

```typescript
await fastify.register(cors, {
  // ...
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
});
```

### Issue: "Header not allowed"

**Symptoms:**
- CORS error mentioning specific header
- Custom headers rejected

**Solution:**

Add header to allowed headers:

```typescript
await fastify.register(cors, {
  // ...
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
});
```

## Testing CORS Configuration

### Manual Testing

**Test with cURL:**

```bash
# Preflight request
curl -X OPTIONS http://localhost:5555/api/data/skill-unlocks \
  -H "Origin: https://hyperscape.club" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Actual request
curl http://localhost:5555/api/data/skill-unlocks \
  -H "Origin: https://hyperscape.club" \
  -v
```

**Expected headers:**
```http
Access-Control-Allow-Origin: https://hyperscape.club
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
```

### Browser Testing

**Open browser console:**

```javascript
// Test CORS from browser
fetch('http://localhost:5555/api/data/skill-unlocks', {
  credentials: 'include',
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Check Network tab:**
1. Look for preflight OPTIONS request
2. Verify response headers include `Access-Control-Allow-Origin`
3. Check actual request succeeds

### Automated Testing

**Add to test suite:**

```typescript
// packages/server/tests/integration/cors.test.ts
import { test, expect } from 'vitest';

test('CORS allows production domain', async () => {
  const response = await fetch('http://localhost:5555/api/data/skill-unlocks', {
    headers: {
      'Origin': 'https://hyperscape.club',
    },
  });
  
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://hyperscape.club');
});
```

## Security Considerations

### 1. Restrict Origins in Production

**Never use wildcard in production:**

```typescript
// ❌ INSECURE - allows any origin
origin: '*'

// ✅ SECURE - explicit allowlist
origin: ['https://hyperscape.club', 'https://www.hyperscape.club']
```

### 2. Validate Origin Dynamically

**Use function for complex logic:**

```typescript
await fastify.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check against allowlist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // Check against regex patterns
    for (const pattern of allowedPatterns) {
      if (pattern.test(origin)) {
        callback(null, true);
        return;
      }
    }
    
    // Reject unknown origins
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});
```

### 3. Limit Exposed Headers

**Only expose necessary headers:**

```typescript
await fastify.register(cors, {
  // ...
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
});
```

### 4. Monitor CORS Errors

**Log rejected origins:**

```typescript
origin: (origin, callback) => {
  if (!isAllowed(origin)) {
    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(new Error('Not allowed by CORS'), false);
    return;
  }
  callback(null, true);
},
```

## Environment-Specific Configuration

### Development

**Permissive CORS for local testing:**

```typescript
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    /^https?:\/\/localhost:\d+$/,
    /^https?:\/\/127\.0\.0\.1:\d+$/,
  );
}
```

### Staging

**Add staging domains:**

```typescript
if (process.env.NODE_ENV === 'staging') {
  allowedOrigins.push(
    'https://staging.hyperscape.club',
    'https://hyperscape-staging.up.railway.app',
  );
}
```

### Production

**Strict allowlist:**

```typescript
if (process.env.NODE_ENV === 'production') {
  allowedOrigins = [
    'https://hyperscape.club',
    'https://www.hyperscape.club',
    'https://hyperscape.pages.dev',
  ];
}
```

## Cloudflare Pages Preview Deployments

### Challenge

Cloudflare Pages creates preview deployments with dynamic URLs:
- Format: `https://<hash>.hyperscape.pages.dev`
- Hash changes for each deployment
- Cannot be added to static allowlist

### Solution

**Use regex pattern:**

```typescript
/^https?:\/\/.+\.hyperscape\.pages\.dev$/
```

**Matches:**
- `https://abc123.hyperscape.pages.dev`
- `https://preview-pr-123.hyperscape.pages.dev`
- `http://test.hyperscape.pages.dev` (HTTP for testing)

**Security:**
- Only matches `*.hyperscape.pages.dev` subdomains
- Does not match other domains
- Safe for production use

## WebSocket CORS

### Configuration

WebSocket connections also require CORS configuration:

```typescript
// In packages/server/src/startup/websocket.ts
fastify.register(fastifyWebSocket, {
  options: {
    verifyClient: (info, callback) => {
      const origin = info.origin;
      
      // Check if origin is allowed
      if (isOriginAllowed(origin)) {
        callback(true);
      } else {
        console.warn(`[WebSocket] Rejected origin: ${origin}`);
        callback(false, 403, 'Forbidden');
      }
    },
  },
});
```

### Testing WebSocket CORS

**Test with wscat:**

```bash
# Install wscat
npm install -g wscat

# Test connection
wscat -c ws://localhost:5555/ws \
  --origin https://hyperscape.club
```

**Expected:** Connection succeeds

**If rejected:** Check server logs for rejected origin

## Troubleshooting Checklist

- [ ] Origin is in `allowedOrigins` array or matches regex pattern
- [ ] `credentials: true` is set
- [ ] Required methods are in `methods` array
- [ ] Required headers are in `allowedHeaders` array
- [ ] Server has been restarted after config changes
- [ ] Browser cache has been cleared
- [ ] Environment variables are set correctly
- [ ] HTTPS is used in production (not HTTP)
- [ ] WebSocket uses WSS in production (not WS)

## References

- **MDN CORS Guide:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Fastify CORS Plugin:** https://github.com/fastify/fastify-cors
- **Railway CORS Docs:** https://docs.railway.app/guides/cors

## License

MIT - See LICENSE file
