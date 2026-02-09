# Backend Deployment Checklist

## Pre-Deployment
- [x] Backend code in `backend/` directory
- [x] Worker entry point: `backend/_core/worker.ts`
- [x] Build command configured: `npm run build:worker`
- [x] Worker builds to: `dist/worker.js` (94.5KB)
- [x] D1 database created: `cf374361-2caa-4597-a38d-5cecced7827d`
- [x] R2 bucket created: `xflexwithai-videos`
- [x] wrangler-worker.toml configured
- [x] Package.json deployment scripts added

## Deployment Steps

### Step 1: Build Worker ✅
```bash
npm run build:worker
```
**Status:** ✅ Complete - `dist/worker.js` (94.5KB)

### Step 2: Set JWT Secret
```bash
wrangler secret put JWT_SECRET --env production
```
**Required:** Yes  
**How to generate:**
```bash
openssl rand -base64 32
# Or on Windows with Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
**Status:** ⏳ Pending

### Step 3: Set OAuth Secrets
```bash
wrangler secret put OAUTH_SERVER_URL --env production
wrangler secret put VITE_OAUTH_PORTAL_URL --env production
wrangler secret put VITE_APP_ID --env production
wrangler secret put OWNER_OPEN_ID --env production
wrangler secret put OWNER_NAME --env production
```
**Note:** Get these values from Manus team  
**Status:** ⏳ Pending

### Step 4: Set App Branding Secrets (Optional)
```bash
wrangler secret put VITE_APP_TITLE --env production
wrangler secret put VITE_APP_LOGO --env production
```
**Status:** ⏳ Pending

### Step 5: Set Forge API Secrets (If Using)
```bash
wrangler secret put BUILT_IN_FORGE_API_URL --env production
wrangler secret put BUILT_IN_FORGE_API_KEY --env production
wrangler secret put VITE_FRONTEND_FORGE_API_URL --env production
wrangler secret put VITE_FRONTEND_FORGE_API_KEY --env production
```
**Status:** ⏳ Pending (Optional)

### Step 6: Deploy Worker
```bash
npm run deploy:worker
```
**Status:** ⏳ Pending

### Step 7: Add DNS CNAME Record
In Cloudflare Dashboard > DNS Records:
- **Type:** CNAME
- **Name:** api
- **Content:** xflexwithai-api-production.xflexwithai.workers.dev
- **Proxy status:** Proxied
- **TTL:** Auto

**Status:** ⏳ Pending

### Step 8: Test Deployment
```bash
# Test health endpoint
curl https://api.xflexwithai.com/health

# View live logs
wrangler tail --env production
```
**Status:** ⏳ Pending

### Step 9: Update Frontend API URL
Update frontend environment to point to API:
- Location: `frontend/src/lib/trpc.ts` or `frontend/.env`
- Value: `https://api.xflexwithai.com`

**Status:** ⏳ Pending

## Infrastructure Summary

| Component | Status | Details |
|-----------|--------|---------|
| Frontend (Pages) | ✅ Live | https://xflexwithai.com |
| Backend (Workers) | 🔄 Building | https://api.xflexwithai.com |
| Database (D1) | ✅ Ready | cf374361-2caa-4597-a38d-5cecced7827d |
| Storage (R2) | ✅ Ready | xflexwithai-videos |
| Cache (KV) | ⏳ Later | Optional, add if needed |
| Domain | ✅ Configured | xflexwithai.com on Cloudflare |

## Environment Variables Needed

### REQUIRED (Secrets)
1. `JWT_SECRET` - Secret for JWT tokens
2. `OAUTH_SERVER_URL` - OAuth server endpoint
3. `VITE_OAUTH_PORTAL_URL` - OAuth portal URL
4. `VITE_APP_ID` - Application ID
5. `OWNER_OPEN_ID` - Owner's OpenID
6. `OWNER_NAME` - Owner name

### AUTO-BOUND (via wrangler.toml)
- `DB` - D1 database connection
- `VIDEOS_BUCKET` - R2 storage bucket

### OPTIONAL (Secrets)
- `BUILT_IN_FORGE_API_URL` - Forge API endpoint
- `BUILT_IN_FORGE_API_KEY` - Forge API key
- `VITE_FRONTEND_FORGE_API_URL` - Frontend Forge URL
- `VITE_FRONTEND_FORGE_API_KEY` - Frontend Forge key

## Troubleshooting

### Build Issues
**Problem:** `npm run build:worker` fails  
**Solution:**
1. Ensure `backend/_core/worker.ts` exists
2. Check `dist/` directory is writable
3. Run `npm install` to update dependencies

### Deployment Issues
**Problem:** `wrangler deploy` fails with auth error  
**Solution:**
```bash
wrangler logout
wrangler login
# Then try deploy again
```

**Problem:** Database binding fails  
**Solution:**
1. Verify D1 database ID in wrangler-worker.toml
2. Ensure migrations are applied: `npm run db:push`
3. Check database still exists in Cloudflare Dashboard

**Problem:** R2 bucket access denied  
**Solution:**
1. Verify bucket name in wrangler-worker.toml: `xflexwithai-videos`
2. Check account has access in Cloudflare Dashboard
3. Ensure R2 API token has bucket access

### Runtime Issues
**Problem:** Worker returns 500 error  
**Solution:**
```bash
# View real-time logs
wrangler tail --env production

# Check recent deployments
wrangler deployments list
```

## Rollback Procedure

If something goes wrong:
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --env production
```

## Post-Deployment Verification

After deployment, verify:
1. ✅ Worker is deployed: https://api.xflexwithai.com/
2. ✅ Can connect to D1 database
3. ✅ Can access R2 bucket
4. ✅ OAuth routes work
5. ✅ tRPC routes work
6. ✅ Frontend can reach API
7. ✅ No errors in logs: `wrangler tail --env production`

## Next Steps

1. Gather OAuth credentials from Manus team
2. Generate JWT_SECRET with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. Set all required secrets with `wrangler secret put`
4. Deploy with: `npm run deploy:worker`
5. Add DNS CNAME record for `api.xflexwithai.com`
6. Test endpoints and monitor logs
7. Update frontend to use new API URL
