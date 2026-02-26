# CI/CD Improvements

This document summarizes recent CI/CD improvements and best practices for Hyperscape deployments.

## Overview

Recent improvements to the CI/CD pipeline include:
- **Maintenance mode integration** - Graceful deployments with market resolution
- **DATABASE_URL persistence** - Survives git reset operations
- **Cloudflare Pages automation** - Automatic client deployment
- **Build resilience** - Retry logic and frozen lockfile
- **Split builds** - Separate unsigned and release builds for desktop apps

## GitHub Actions Workflows

### 1. Deploy to Cloudflare Pages

**File:** `.github/workflows/deploy-pages.yml`

**Triggers:**
- Push to `main` branch
- Changes to `packages/client/**` or `packages/shared/**`
- Manual trigger via `workflow_dispatch`

**Features:**
- Automatic client deployment on push
- Builds client with shared + physx dependencies
- Uses Wrangler CLI for deployment
- Supports production and preview environments

**Required secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `PUBLIC_PRIVY_APP_ID` - Privy app ID

**Example:**
```yaml
- name: Deploy to Cloudflare Pages
  run: |
    npx wrangler pages deploy dist \
      --project-name=hyperscape \
      --branch=${{ github.ref_name }}
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 2. Deploy to Vast.ai

**File:** `.github/workflows/deploy-vast.yml`

**Triggers:**
- After CI passes on `main` branch
- Manual trigger via `workflow_dispatch`

**Features:**
- Maintenance mode integration
- DATABASE_URL persistence through git reset
- Health checking before exit
- Solana keypair setup
- Stream key configuration

**Required secrets:**
- `VAST_HOST` - Vast.ai instance IP
- `VAST_PORT` - SSH port
- `VAST_SSH_KEY` - Private SSH key
- `VAST_SERVER_URL` - Public server URL
- `DATABASE_URL` - PostgreSQL connection
- `ADMIN_CODE` - Admin API access
- `SOLANA_DEPLOYER_PRIVATE_KEY` - Solana keypair
- `TWITCH_STREAM_KEY` - Twitch stream key
- `X_STREAM_KEY` - X/Twitter stream key
- `X_RTMP_URL` - X RTMP URL

**Deployment flow:**
1. Enter maintenance mode
2. SSH to Vast instance
3. Checkout main branch explicitly
4. Write environment variables
5. Run deployment script
6. Wait for server health
7. Exit maintenance mode

**Example:**
```yaml
- name: Enter Maintenance Mode
  run: |
    curl -X POST "$VAST_SERVER_URL/admin/maintenance/enter" \
      -H "Content-Type: application/json" \
      -H "x-admin-code: $ADMIN_CODE" \
      -d '{"reason": "deployment", "timeoutMs": 300000}'
```

### 3. Build Native Apps

**File:** `.github/workflows/build-app.yml`

**Triggers:**
- Tagged releases (`v*`)

**Features:**
- Cross-platform builds (macOS, Windows, Linux, iOS, Android)
- Split unsigned and release builds
- Automatic GitHub Release creation
- Artifact upload to release

**Improvements:**
- Fixed Linux/Windows builds (use `--no-bundle` instead of `--bundles app`)
- Cross-platform `beforeBuildCommand` using Node.js
- Separate artifact upload for unsigned vs release builds

**Example:**
```yaml
- name: Build Desktop App
  run: |
    bun run tauri build --no-bundle
  env:
    TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
```

## Deployment Scripts

### deploy-vast.sh

**Location:** `scripts/deploy-vast.sh`

**Features:**
- Pulls latest code from main
- Restores DATABASE_URL after git reset
- Sets up Solana keypair
- Installs dependencies
- Builds packages
- Restarts PM2 processes

**Key improvements:**
```bash
# Explicitly checkout main first
git fetch origin
git checkout main
git reset --hard origin/main

# Restore DATABASE_URL (git reset overwrites .env)
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL=$DATABASE_URL" >> packages/server/.env
fi

# Setup Solana keypair
if [ -n "$SOLANA_DEPLOYER_PRIVATE_KEY" ]; then
  mkdir -p ~/.config/solana
  bun run packages/server/scripts/decode-key.ts \
    "$SOLANA_DEPLOYER_PRIVATE_KEY" \
    ~/.config/solana/id.json
fi
```

### configure-r2-cors.sh

**Location:** `scripts/configure-r2-cors.sh`

**Features:**
- Configures R2 bucket CORS for cross-origin asset loading
- Uses correct Wrangler API format
- Allows all origins, GET/HEAD methods

**Example:**
```bash
wrangler r2 bucket cors set hyperscape-assets \
  --config cors-config.json
```

## Best Practices

### 1. Maintenance Mode

**Always use maintenance mode for production deployments:**
```bash
# Enter maintenance mode
curl -X POST https://your-server.com/admin/maintenance/enter \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code" \
  -d '{"reason": "deployment", "timeoutMs": 300000}'

# Deploy changes
# ...

# Exit maintenance mode
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### 2. DATABASE_URL Persistence

**Write DATABASE_URL AFTER git reset:**
```bash
# ❌ WRONG - git reset will overwrite .env
echo "DATABASE_URL=$DATABASE_URL" > packages/server/.env
git reset --hard origin/main

# ✅ CORRECT - write after git reset
git reset --hard origin/main
echo "DATABASE_URL=$DATABASE_URL" >> packages/server/.env
```

### 3. Health Checking

**Wait for server to be healthy before exiting maintenance mode:**
```bash
for i in {1..30}; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/health")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "Server is healthy!"
    break
  fi
  sleep 10
done
```

### 4. Explicit Branch Checkout

**Always checkout main explicitly in deployment:**
```bash
# ❌ WRONG - may be on wrong branch
git pull origin main

# ✅ CORRECT - explicitly checkout main
git fetch origin
git checkout main
git reset --hard origin/main
```

### 5. Environment Variable Handling

**Pass secrets through SSH environment:**
```yaml
- name: SSH and Deploy
  uses: appleboy/ssh-action@v1.0.3
  with:
    envs: DATABASE_URL,TWITCH_STREAM_KEY
    script: |
      echo "DATABASE_URL=$DATABASE_URL" >> .env
      echo "TWITCH_STREAM_KEY=$TWITCH_STREAM_KEY" >> .env
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    TWITCH_STREAM_KEY: ${{ secrets.TWITCH_STREAM_KEY }}
```

### 6. Build Resilience

**Use frozen lockfile and retry logic:**
```yaml
- name: Install dependencies
  run: bun install --frozen-lockfile
  
- name: Build with retry
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: bun run build
```

### 7. Split Builds

**Separate unsigned and release builds:**
```yaml
# Unsigned builds (Linux/Windows)
- name: Build unsigned
  run: bun run tauri build --no-bundle

# Release builds (macOS with code signing)
- name: Build release
  run: bun run tauri build --bundles app
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
```

## Troubleshooting

### Deployment Stuck in Maintenance Mode

**Check status:**
```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

**Force exit:**
```bash
curl -X POST https://your-server.com/admin/maintenance/exit \
  -H "Content-Type: application/json" \
  -H "x-admin-code: your-admin-code"
```

### DATABASE_URL Lost After Deployment

**Check if written after git reset:**
```bash
# View deploy script
cat scripts/deploy-vast.sh | grep -A 5 "git reset"

# Should see DATABASE_URL write AFTER git reset
```

**Fix:**
```bash
# SSH to server
ssh -p $VAST_PORT root@$VAST_HOST

# Manually restore DATABASE_URL
echo "DATABASE_URL=your-database-url" >> packages/server/.env

# Restart server
pm2 restart server
```

### Build Fails on CI

**Check logs:**
```bash
# View in GitHub Actions
# Repository → Actions → Workflow → View logs
```

**Common issues:**
- npm rate limit: Use `--frozen-lockfile` and retry logic
- Out of memory: Increase `NODE_OPTIONS=--max-old-space-size=4096`
- Missing dependencies: Run `bun install` before build
- TypeScript errors: Run `bun run lint` locally first

### SSH Connection Fails

**Check secrets:**
```bash
# Verify secrets are set
# Repository → Settings → Secrets and variables → Actions
```

**Test SSH connection:**
```bash
ssh -p $VAST_PORT root@$VAST_HOST
```

**Common issues:**
- Wrong port: Check `VAST_PORT` secret
- Wrong host: Check `VAST_HOST` secret
- Invalid key: Regenerate `VAST_SSH_KEY` secret
- Firewall: Check Vast.ai instance firewall settings

### Cloudflare Deployment Fails

**Check Wrangler token:**
```bash
# Verify token has correct permissions
# Cloudflare Dashboard → API Tokens → Edit token
```

**Test deployment locally:**
```bash
cd packages/client
bun run build
npx wrangler pages deploy dist --project-name=hyperscape
```

**Common issues:**
- Invalid token: Regenerate `CLOUDFLARE_API_TOKEN`
- Wrong project name: Check `wrangler.toml`
- Build errors: Run `bun run build` locally first

## Monitoring

### GitHub Actions

**View workflow runs:**
```
Repository → Actions → Workflow name
```

**View logs:**
```
Actions → Workflow run → Job → Step
```

**Download artifacts:**
```
Actions → Workflow run → Artifacts
```

### Deployment Status

**Check server health:**
```bash
curl https://your-server.com/health
```

**Check maintenance mode:**
```bash
curl https://your-server.com/admin/maintenance/status \
  -H "x-admin-code: your-admin-code"
```

**Check PM2 status:**
```bash
ssh -p $VAST_PORT root@$VAST_HOST "pm2 status"
```

## Security

### Secrets Management

**Never commit secrets to git:**
- Use GitHub Secrets for CI/CD
- Use `.env` files for local development
- Add `.env` to `.gitignore`

**Rotate secrets regularly:**
- JWT_SECRET: Every 90 days
- ADMIN_CODE: Every 90 days
- API keys: As needed

**Use strong secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate ADMIN_CODE
openssl rand -hex 16
```

### Access Control

**Limit GitHub Actions permissions:**
```yaml
permissions:
  contents: read
  deployments: write
```

**Use environment protection rules:**
```
Repository → Settings → Environments → production
→ Required reviewers
→ Wait timer
→ Deployment branches
```

## See Also

- [Maintenance Mode API](maintenance-mode-api.md)
- [Vast.ai Deployment Guide](vast-deployment.md)
- [Cloudflare Deployment Guide](cloudflare-deployment.md)
- [Environment Variables Reference](environment-variables.md)
