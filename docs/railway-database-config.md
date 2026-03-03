# Railway Database Configuration

Railway uses connection pooling (pgbouncer) which requires special configuration for Hyperscape deployments. This guide covers automatic detection, configuration, and troubleshooting.

## Automatic Detection

Hyperscape automatically detects Railway deployments and applies appropriate database configuration.

### Detection Methods

Railway is detected via:

1. **RAILWAY_ENVIRONMENT** environment variable (most reliable)
   - Automatically set by Railway
   - Values: `production`, `staging`, `development`

2. **Hostname patterns**:
   - `.rlwy.net` - Railway proxy connections
   - `.railway.app` - Direct Railway connections
   - `.railway.internal` - Internal Railway connections

### Automatic Configuration

When Railway is detected, Hyperscape automatically:

- **Disables prepared statements** (not supported by pgbouncer)
- **Uses lower connection pool limits** (max: 6 connections)
- **Prevents "too many clients already" errors**

## Configuration

### Environment Variables

Add these to your Railway service environment variables:

```bash
# Database Connection
DATABASE_URL=postgresql://...  # Provided by Railway

# Connection Pool Configuration
POSTGRES_POOL_MAX=6            # Max connections (Railway proxy limit)
POSTGRES_POOL_MIN=0            # Don't hold idle connections

# For crash loop protection
POSTGRES_POOL_MAX=3            # Even lower for unstable deployments
```

### PM2 Configuration

If using PM2 on Railway, configure restart delays to allow connections to close:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'hyperscape-server',
    script: 'bun',
    args: 'run start',
    autorestart: true,
    restart_delay: 10000,            // 10s instead of 5s
    exp_backoff_restart_delay: 2000, // 2s for gradual backoff
    env: {
      NODE_ENV: 'production',
      POSTGRES_POOL_MAX: '3',        // Lower pool for crash loops
      POSTGRES_POOL_MIN: '0',        // Don't hold idle connections
    }
  }]
};
```

## Connection Pool Limits

### Railway Proxy Limits

Railway's pgbouncer proxy has strict connection limits:

| Deployment Type | Max Connections | Recommended Pool Max |
|----------------|-----------------|---------------------|
| Hobby Plan | 20 | 3-6 |
| Pro Plan | 100 | 6-10 |
| Team Plan | 200 | 10-20 |

### Hyperscape Recommendations

| Scenario | POSTGRES_POOL_MAX | POSTGRES_POOL_MIN | Notes |
|----------|-------------------|-------------------|-------|
| Stable deployment | 6 | 0 | Default for Railway |
| Crash loops | 3 | 0 | Prevents connection exhaustion |
| Duel arena | 1 | 0 | Minimal connections for streaming |
| Development | 10 | 2 | Higher limits for local testing |

## Troubleshooting

### "too many clients already" Error

**Symptom**: PostgreSQL error 53300 during deployment or crashes

**Causes**:
- Connection pool too large for Railway limits
- Connections not closing before restart
- Multiple instances competing for connections

**Solutions**:

1. **Reduce pool size**:
   ```bash
   POSTGRES_POOL_MAX=3
   POSTGRES_POOL_MIN=0
   ```

2. **Increase restart delay**:
   ```javascript
   // ecosystem.config.cjs
   restart_delay: 10000,  // 10s instead of 5s
   ```

3. **Check active connections**:
   ```sql
   SELECT count(*) FROM pg_stat_activity 
   WHERE datname = 'your_database';
   ```

### Prepared Statement Errors

**Symptom**: Errors like "prepared statement does not exist"

**Cause**: Prepared statements not supported by pgbouncer

**Solution**: Automatic - Hyperscape disables prepared statements when Railway is detected. If you see this error, verify Railway detection is working:

```typescript
// Check detection in logs
console.log('Railway detected:', isRailway());
console.log('Using pooler:', isSupavisorPooler(DATABASE_URL));
```

### Connection Leaks

**Symptom**: Connections not being released, pool exhaustion over time

**Causes**:
- Missing `await` on database queries
- Transactions not committed/rolled back
- Connections held during crashes

**Solutions**:

1. **Always use transactions properly**:
   ```typescript
   const db = await getDatabase();
   try {
     await db.transaction(async (tx) => {
       // Your queries here
     });
   } catch (error) {
     // Transaction auto-rolled back
     throw error;
   }
   ```

2. **Set connection timeout**:
   ```bash
   POSTGRES_IDLE_TIMEOUT=30000  # 30s idle timeout
   ```

3. **Monitor connection count**:
   ```bash
   # Check Railway metrics dashboard
   # Or query directly:
   SELECT count(*) FROM pg_stat_activity;
   ```

## Best Practices

### 1. Use Minimal Connection Pools

Railway's pgbouncer is designed for many clients with few connections each:

```bash
# ✅ GOOD - Minimal pool
POSTGRES_POOL_MAX=3
POSTGRES_POOL_MIN=0

# ❌ BAD - Too many connections
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=5
```

### 2. Don't Hold Idle Connections

Set `POSTGRES_POOL_MIN=0` to release connections when not in use:

```bash
# ✅ GOOD - Release idle connections
POSTGRES_POOL_MIN=0

# ❌ BAD - Hold connections even when idle
POSTGRES_POOL_MIN=5
```

### 3. Increase Restart Delays

Allow connections to close before PM2 restarts:

```javascript
// ✅ GOOD - 10s delay
restart_delay: 10000,

// ❌ BAD - 5s may not be enough
restart_delay: 5000,
```

### 4. Monitor Connection Usage

Check Railway metrics regularly:

- Active connections
- Connection pool utilization
- Query performance
- Error rates

## Migration from Other Platforms

### From Neon/Supabase

Railway uses pgbouncer, while Neon/Supabase may use different poolers:

```bash
# Neon (Supavisor pooler)
DATABASE_URL=postgresql://...neon.tech/...
POSTGRES_POOL_MAX=10  # Higher limits OK

# Railway (pgbouncer)
DATABASE_URL=postgresql://...railway.app/...
POSTGRES_POOL_MAX=6   # Lower limits required
```

### From Direct PostgreSQL

Direct PostgreSQL connections support higher limits:

```bash
# Direct PostgreSQL
DATABASE_URL=postgresql://localhost:5432/...
POSTGRES_POOL_MAX=20  # Higher limits OK

# Railway (pgbouncer)
DATABASE_URL=postgresql://...railway.app/...
POSTGRES_POOL_MAX=6   # Lower limits required
```

## Advanced Configuration

### Connection String Parameters

Railway supports additional connection parameters:

```bash
# Basic connection
DATABASE_URL=postgresql://user:pass@host:port/db

# With pooler parameters
DATABASE_URL=postgresql://user:pass@host:port/db?pgbouncer=true&statement_cache_size=0

# With SSL (recommended for production)
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
```

### Drizzle ORM Configuration

Hyperscape uses Drizzle ORM with automatic Railway detection:

```typescript
// packages/server/src/database/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const isRailway = process.env.RAILWAY_ENVIRONMENT || 
                  DATABASE_URL.includes('.railway.app') ||
                  DATABASE_URL.includes('.rlwy.net') ||
                  DATABASE_URL.includes('.railway.internal');

const client = postgres(DATABASE_URL, {
  max: parseInt(process.env.POSTGRES_POOL_MAX || '6'),
  idle_timeout: 30,
  connect_timeout: 10,
  // Disable prepared statements for Railway
  prepare: !isRailway,
});

export const db = drizzle(client);
```

## Monitoring

### Railway Dashboard

Monitor database health in Railway dashboard:

1. Navigate to your service
2. Click "Metrics" tab
3. Check:
   - Active connections
   - Query latency
   - Error rates
   - CPU/Memory usage

### Application Logs

Enable database logging in your application:

```bash
# Enable query logging
DEBUG=drizzle:*

# Enable connection pool logging
POSTGRES_LOG_LEVEL=debug
```

### Health Checks

Add database health check endpoint:

```typescript
// packages/server/src/startup/routes/health-routes.ts
app.get('/health/database', async (request, reply) => {
  try {
    const result = await db.execute(sql`SELECT 1`);
    const poolStats = getPoolStats();
    
    return {
      status: 'healthy',
      connections: poolStats.totalCount,
      idle: poolStats.idleCount,
      waiting: poolStats.waitingCount,
    };
  } catch (error) {
    return reply.code(503).send({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

## Related Documentation

- [Railway Dev/Prod Setup](./railway-dev-prod.md) - Full Railway deployment guide
- [AGENTS.md](../AGENTS.md) - PostgreSQL connection pool configuration
- [README.md](../README.md) - Troubleshooting Railway errors
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview) - ORM documentation
