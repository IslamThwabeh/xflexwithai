# Deployment Next Steps - Cloudflare Workers

## ✅ Completed Steps

1. ✅ Schema migration generated and applied to D1 database
   - File: `drizzle/0000_salty_turbo.sql`
   - Database: xflexwithai-db (cf374361-2caa-4597-a38d-5cecced7827d)
   - Status: 23 SQL commands executed successfully

2. ✅ Frontend and backend builds successful
   - Frontend: dist/public/ (367.64 kB HTML, 802.62 kB JS, 133.53 kB CSS)
   - Backend: dist/index.js (127.3 kB)

3. ✅ wrangler.toml configured with production environment bindings

## 🔄 Next Steps

### Step 1: Set Environment Secrets in Cloudflare

You need to set the following secrets for your production environment. Replace the placeholder values with actual credentials.

```bash
# JWT & Auth
wrangler secret put JWT_SECRET --env production
# Enter a strong random JWT secret (e.g., generated from: openssl rand -base64 32)

# OAuth Configuration
wrangler secret put OAUTH_SERVER_URL --env production
# Enter: https://your-oauth-provider.com (or your custom OAuth endpoint)

wrangler secret put OWNER_OPEN_ID --env production
# Enter: your-owner-openid-value

wrangler secret put OWNER_NAME --env production
# Enter: Your Name (the account owner)

# App Configuration
wrangler secret put VITE_APP_ID --env production
# Enter: xflex-trading-academy

wrangler secret put VITE_APP_TITLE --env production
# Enter: XFlex Trading Academy

wrangler secret put VITE_APP_LOGO --env production
# Enter: https://your-logo-url.png

# Forge API (if using custom Forge instance)
wrangler secret put BUILT_IN_FORGE_API_URL --env production
# Enter: https://your-forge-instance.com/api

wrangler secret put BUILT_IN_FORGE_API_KEY --env production
# Enter: your-forge-api-key

wrangler secret put VITE_FRONTEND_FORGE_API_URL --env production
# Enter: https://your-forge-instance.com/api

wrangler secret put VITE_FRONTEND_FORGE_API_KEY --env production
# Enter: your-forge-api-key
```

**Note**: To generate a strong JWT secret, you can use:
```bash
# On Windows PowerShell:
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString() + (New-Guid).ToString()))

# Or use online: https://www.uuidgenerator.net/ and base64 encode it
```

### Step 2: Set KV Namespace ID

You need to create a KV Namespace for session/cache storage and update wrangler.toml:

```bash
# Create KV namespace
wrangler kv:namespace create "KV_CACHE" --preview

# The output will show your namespace ID, e.g.:
# 👍 Successfully created a new KV Namespace!
# id = "your_namespace_id_here"
```

Then update `wrangler.toml` with your actual KV namespace ID:

```toml
[[env.production.kv_namespaces]]
binding = "KV_CACHE"
id = "your_namespace_id_here"  # Replace with actual ID

[[env.staging.kv_namespaces]]
binding = "KV_CACHE"
id = "your_namespace_id_here"  # Replace with actual ID

[[env.development.kv_namespaces]]
binding = "KV_CACHE"
id = "your_namespace_id_here"  # Replace with actual ID
```

### Step 3: Deploy Backend to Cloudflare Workers

```bash
wrangler deploy --env production
```

Expected output:
```
Uploaded xflexwithai-prod (X.XXkB)
Published http://xflexwithai-prod.your-account.workers.dev
```

### Step 4: Deploy Frontend to Cloudflare Pages

```bash
wrangler pages publish dist/public --project-name=xflexwithai --env production
```

Expected output:
```
Deploying your Pages application...
✓ Build status: Success
Project name: xflexwithai
✓ Deployment ID: xxxxx
✓ Deployment URL: https://xxxxx.pages.dev
✓ Branch Preview URL: https://production.xflexwithai.pages.dev
```

### Step 5: Configure Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to Workers > xflexwithai-prod (or xflexwithai Pages project)
3. Go to Settings > Custom Domains
4. Add: `api.xflexwithai.com` (for Workers)
5. Add: `xflexwithai.com` (for Pages) - or configure root domain routing

**DNS Configuration:**
- Make sure xflexwithai.com is registered with Cloudflare
- Point nameservers to Cloudflare
- Cloudflare will automatically handle SSL/TLS

### Step 6: Verify Deployment

Test your deployment with:

```bash
# Test API endpoint
curl https://api.xflexwithai.com/health

# Test frontend
curl https://xflexwithai.com/
```

## 📋 Deployment Checklist

- [ ] Set JWT_SECRET secret
- [ ] Set OAUTH_SERVER_URL secret
- [ ] Set OWNER_OPEN_ID secret
- [ ] Set OWNER_NAME secret
- [ ] Set VITE_APP_ID secret
- [ ] Set VITE_APP_TITLE secret
- [ ] Set VITE_APP_LOGO secret
- [ ] Set BUILT_IN_FORGE_API_URL secret (if needed)
- [ ] Set BUILT_IN_FORGE_API_KEY secret (if needed)
- [ ] Set VITE_FRONTEND_FORGE_API_URL secret (if needed)
- [ ] Set VITE_FRONTEND_FORGE_API_KEY secret (if needed)
- [ ] Create KV Namespace and update wrangler.toml
- [ ] Run `wrangler deploy --env production`
- [ ] Run `wrangler pages publish dist/public --project-name=xflexwithai --env production`
- [ ] Configure custom domains (api.xflexwithai.com and xflexwithai.com)
- [ ] Verify API endpoint is accessible
- [ ] Verify frontend is accessible
- [ ] Test user registration and login
- [ ] Test course enrollment and video playback

## 🔧 Troubleshooting

### Database Connection Issues
If you see database errors, verify:
```bash
# Check if database exists
wrangler d1 info xflexwithai-db --env production

# Verify migrations were applied
wrangler d1 execute xflexwithai-db --command="SELECT name FROM sqlite_master WHERE type='table';" --env production
```

### Secret Access Issues
Ensure secrets are being read correctly in your worker code:
- Secrets should be accessed via `env.SECRET_NAME` in your worker context
- Verify secret names match exactly (case-sensitive)

### Custom Domain Issues
- Ensure domain is registered with Cloudflare
- Check DNS propagation: `nslookup api.xflexwithai.com`
- Allow 24 hours for full DNS propagation

## 📊 Database Schema

Your D1 database now contains 17 tables:
- users, admins, courses, episodes, enrollments
- registrationKeys, episodeProgress
- lexaiSubscriptions, lexaiMessages
- flexaiSubscriptions, flexaiMessages
- quizzes, quizQuestions, quizOptions, quizAttempts, quizAnswers
- userQuizProgress

All migrations have been applied successfully!

## 🚀 Current Status

- ✅ Database: Configured and migrated
- ✅ Backend build: Complete (127.3 kB)
- ✅ Frontend build: Complete (802.62 kB JS)
- ✅ wrangler.toml: Configured for production
- ⏳ Next: Set secrets and deploy

**Next command to run:**
```bash
wrangler secret put JWT_SECRET --env production
```
