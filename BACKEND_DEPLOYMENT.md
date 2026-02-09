# Backend Deployment to Cloudflare Workers

## Overview
This guide walks through deploying the XFlex Trading Academy backend API to Cloudflare Workers with D1 database, R2 storage, and KV caching.

## Current Status
✅ Backend code structured in `backend/` directory
✅ Worker entry point: `backend/_core/worker.ts`
✅ D1 Database: `cf374361-2caa-4597-a38d-5cecced7827d` (xflexwithai)
✅ R2 Bucket: `xflexwithai-videos`
✅ Build command: `npm run build:worker` → `dist/worker.js`
✅ Wrangler config: `wrangler-worker.toml`

## Step 1: Get Cloudflare Account Details

Run these commands to gather information:

```bash
# Get your account ID
wrangler whoami

# List your domains/zones
wrangler list zones

# List D1 databases
wrangler d1 list

# List R2 buckets
wrangler r2 bucket list

# List KV namespaces
wrangler kv:namespace list
```

Note down:
- Your **Account ID** (12-char hex string)
- Your **Zone ID** for xflexwithai.com
- **KV Namespace ID** (create one if needed below)

## Step 2: Create KV Namespace (if not exists)

```bash
# Create production KV namespace
wrangler kv:namespace create "KV_CACHE" --env production

# Create preview KV namespace
wrangler kv:namespace create "KV_CACHE" --preview --env production
```

Update `wrangler-worker.toml` with the returned IDs.

## Step 3: Update wrangler-worker.toml

Replace placeholder values with your actual IDs:

```toml
# In wrangler-worker.toml
[[kv_namespaces]]
binding = "KV_CACHE"
id = "YOUR_KV_NAMESPACE_ID"                  # From Step 2
preview_id = "YOUR_KV_NAMESPACE_PREVIEW_ID"  # From Step 2

[env.production]
zone_id = "YOUR_ZONE_ID"  # From Step 1 (wrangler list zones)
```

## Step 4: Set Required Secrets

Set environment secrets that the backend needs:

```bash
# Authentication
wrangler secret put JWT_SECRET --env production
# (Paste: openssl rand -base64 32)

# OAuth Configuration (get from Manus team)
wrangler secret put OAUTH_SERVER_URL --env production
wrangler secret put VITE_OAUTH_PORTAL_URL --env production
wrangler secret put VITE_APP_ID --env production
wrangler secret put OWNER_OPEN_ID --env production
wrangler secret put OWNER_NAME --env production

# App Configuration
wrangler secret put VITE_APP_TITLE --env production
wrangler secret put VITE_APP_LOGO --env production

# Forge API (if using external Forge API)
wrangler secret put BUILT_IN_FORGE_API_URL --env production
wrangler secret put BUILT_IN_FORGE_API_KEY --env production
wrangler secret put VITE_FRONTEND_FORGE_API_URL --env production
wrangler secret put VITE_FRONTEND_FORGE_API_KEY --env production
```

## Step 5: Build and Deploy

Build the worker:
```bash
npm run build:worker
```

Deploy to production:
```bash
npm run deploy:worker
```

Or deploy to staging:
```bash
npm run deploy:worker:staging
```

## Step 6: Configure DNS Routing

Add DNS record for API subdomain:

In Cloudflare Dashboard:
1. Go to DNS Records
2. Add CNAME record:
   - **Name:** api
   - **Content:** xflexwithai-api-production.xflexwithai.workers.dev
   - **Proxy status:** Proxied
   - **TTL:** Auto

This makes your API available at: `https://api.xflexwithai.com`

## Step 7: Test the Deployment

```bash
# Test API health
curl https://api.xflexwithai.com/health

# Test from frontend
# Update frontend/.env or wrangler.toml to point to https://api.xflexwithai.com
```

## Monitoring & Debugging

View deployment logs:
```bash
wrangler tail --env production
```

View real-time logs:
```bash
wrangler tail --env production --format pretty
```

## Rollback

If you need to rollback to a previous version:
```bash
# List recent deployments
wrangler deployments list

# Rollback to a specific version
wrangler deployments rollback --env production
```

## Environment Variables Reference

### Required
- `JWT_SECRET` - JWT signing key
- `OAUTH_SERVER_URL` - OAuth server endpoint
- `VITE_OAUTH_PORTAL_URL` - OAuth portal URL
- `VITE_APP_ID` - Application ID
- `OWNER_OPEN_ID` - Owner's OpenID
- `OWNER_NAME` - Owner name

### Auto-Bound (via wrangler.toml)
- `DB` - D1 Database instance
- `VIDEOS_BUCKET` - R2 storage bucket
- `KV_CACHE` - KV namespace

### Optional
- `BUILT_IN_FORGE_API_URL` - Forge API endpoint
- `BUILT_IN_FORGE_API_KEY` - Forge API key
- `VITE_FRONTEND_FORGE_API_URL` - Frontend Forge API
- `VITE_FRONTEND_FORGE_API_KEY` - Frontend Forge API key

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Cloudflare Pages)                             │
│ https://xflexwithai.com                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS Requests
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend API (Cloudflare Workers)                        │
│ https://api.xflexwithai.com                             │
├─────────────────────────────────────────────────────────┤
│ ├─ tRPC Routes (/trpc/*)                                │
│ ├─ OAuth Routes (/oauth/*)                              │
│ ├─ Quiz Routes (/quiz/*)                                │
│ ├─ Admin Routes (/admin/*)                              │
│ ├─ FlexAI Routes (/flexai/*)                            │
│ └─ LexAI Routes (via tRPC)                              │
└────┬─────────────────┬──────────────────┬───────────────┘
     │                 │                  │
     ▼                 ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ D1 Database  │ │ R2 Storage   │ │ KV Cache     │
│ (SQLite)     │ │ (Videos)     │ │ (Sessions)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Troubleshooting

### Issue: Worker won't deploy
- Check `wrangler-worker.toml` has correct config
- Ensure `dist/worker.js` exists after `npm run build:worker`
- Verify account ID and zone ID in config

### Issue: Database connection errors
- Ensure D1 database ID is correct in wrangler.toml
- Check database binding name: `DB`
- Run `npm run db:push` to ensure migrations are applied

### Issue: Secrets not found
- Use `wrangler secret list --env production` to verify secrets are set
- Re-set any missing secrets with `wrangler secret put`

### Issue: R2 bucket access denied
- Ensure R2 bucket binding is correct in wrangler.toml
- Check bucket name: `xflexwithai-videos`
- Verify account has access to R2 bucket

## Next Steps

1. ✅ Build worker: `npm run build:worker`
2. Update `wrangler-worker.toml` with actual IDs
3. Set all required secrets with `wrangler secret put`
4. Deploy: `npm run deploy:worker`
5. Configure DNS for `api.xflexwithai.com`
6. Test endpoints and monitor logs
7. Update frontend to use new API URL
