# Cloudflare D1 SQLite Deployment - Step-by-Step Guide

You've successfully configured your project for Cloudflare D1 + SQLite deployment!

Here's what we've done so far:
✅ Created `wrangler.toml` with D1 and R2 bindings
✅ Created SQLite schema (`drizzle/schema-sqlite.ts`)
✅ Updated database config for D1 (`server/db.ts`)
✅ Created R2 storage service (`server/storage-r2.ts`)
✅ Updated environment configuration

---

## Next Steps: Deploy to Cloudflare

### Step 1: Install Dependencies

```bash
npm install
# or if using pnpm:
pnpm install
```

### Step 2: Build the Project

```bash
npm run build
```

This will:
- Build the React frontend to `dist/public`
- Bundle the Express backend to `dist/index.js`

### Step 3: Create Database Schema in D1

Since D1 database is SQLite, we need to initialize it with your schema.

```bash
# Generate Drizzle migration files
npm run db:generate

# Then manually create the database schema in D1:
wrangler d1 execute xflexwithai-db --file=./drizzle/0000_*.sql --env production
```

Or use the SQL migration manually in Cloudflare Dashboard.

### Step 4: Set Environment Secrets in Cloudflare

```bash
# Set all your secrets
wrangler secret put JWT_SECRET --env production
# (Paste your generated JWT secret, e.g., from: openssl rand -base64 32)

wrangler secret put OAUTH_SERVER_URL --env production
wrangler secret put VITE_OAUTH_PORTAL_URL --env production
wrangler secret put VITE_APP_ID --env production
wrangler secret put OWNER_OPEN_ID --env production
wrangler secret put OWNER_NAME --env production
wrangler secret put VITE_APP_TITLE --env production
wrangler secret put VITE_APP_LOGO --env production
wrangler secret put BUILT_IN_FORGE_API_URL --env production
wrangler secret put BUILT_IN_FORGE_API_KEY --env production
wrangler secret put VITE_FRONTEND_FORGE_API_URL --env production
wrangler secret put VITE_FRONTEND_FORGE_API_KEY --env production

# Optional: R2 access credentials
wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
wrangler secret put R2_BUCKET_NAME --env production
wrangler secret put R2_PUBLIC_URL --env production
```

### Step 5: Deploy Backend to Cloudflare Workers

```bash
# Deploy the Express app to Workers
wrangler deploy --env production
```

### Step 6: Deploy Frontend to Cloudflare Pages

```bash
# Deploy the React app to Pages
wrangler pages publish dist/public --project-name=xflexwithai
```

Or connect via GitHub:
1. Go to Cloudflare Dashboard → Pages
2. Create a new project
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set build output: `dist/public`
6. Deploy

### Step 7: Configure Your Domain

In Cloudflare Dashboard:

**For Pages (Frontend):**
1. Go to Pages → xflexwithai
2. Custom domains → Add custom domain
3. Enter `xflexwithai.com`
4. Follow DNS setup instructions

**For Workers (Backend API):**
1. Go to Workers → xflexwithai
2. Settings → Domains & Routes
3. Add route: `api.xflexwithai.com/api/*`
4. Verify domain is registered with Cloudflare DNS

### Step 8: Set Up Cloudflare DNS

In Cloudflare Dashboard → DNS Records:

```
A Record: xflexwithai.com → <Pages IP>
CNAME: api.xflexwithai.com → xflexwithai.workers.dev
```

---

## Database Migration (If You Had Data)

If you had data in the old PostgreSQL/Railway database:

### Export from Old Database:

```bash
# From your old server
psql DATABASE_URL -c "SELECT * FROM users;" > users.sql
# ... export all tables
```

### Import to D1:

```bash
# Create SQL insert statements
# Then run:
wrangler d1 execute xflexwithai-db --stdin < users.sql --env production
```

**Note**: Since you deleted Railway, you'll need to have a backup or recreate the schema with the Cloudflare Dashboard.

---

## Verify Deployment

### 1. Check Workers Status
```bash
wrangler tail --env production
```

### 2. Test API Endpoint
```bash
curl https://api.xflexwithai.com/api/health
```

### 3. Check Pages Deploy
Visit: `https://xflexwithai.com`
- Should see your React app
- Should load styles/assets correctly

### 4. Test Database Connection
```bash
# Check D1 database status
wrangler d1 info xflexwithai-db --env production
```

### 5. Check R2 Bucket
```bash
# List R2 bucket contents
wrangler r2 ls xflexwithai-videos/
```

---

## Troubleshooting

### Issue: Build fails with "Module not found"

**Solution**: Make sure all dependencies are installed:
```bash
npm install
npm install @cloudflare/workers-types --save-dev
```

### Issue: D1 database not found

**Solution**: Create database first:
```bash
wrangler d1 create xflexwithai-db
# Copy the database ID to wrangler.toml
```

### Issue: Workers returns 502 Bad Gateway

**Solution**:
1. Check error logs: `wrangler tail --env production`
2. Verify environment variables are set
3. Check D1 database is accessible
4. Ensure schema migrations were run

### Issue: Static assets return 404 (Pages)

**Solution**:
1. Verify build output: `npm run build`
2. Check `dist/public` directory exists
3. Redeploy: `wrangler pages publish dist/public`
4. Wait 2-3 minutes for cache to invalidate

### Issue: CORS errors on API calls

**Solution**:
1. Check API URL in client matches deployed API domain
2. Add CORS headers to Express middleware:
```typescript
app.use(cors({
  origin: ["https://xflexwithai.com", "https://api.xflexwithai.com"],
  credentials: true,
}));
```

### Issue: R2 file uploads fail

**Solution**:
1. Verify R2 bucket name in environment variables
2. Check R2 API credentials are set
3. Ensure bucket policy allows uploads
4. Test with: `wrangler r2 object upload xflexwithai-videos test.txt`

---

## File Structure Summary

Your Cloudflare deployment uses:

```
xflexwithai/
├── wrangler.toml              # Cloudflare Workers config
├── drizzle/
│   └── schema-sqlite.ts       # SQLite schema (new)
├── dist/
│   ├── public/                # React build (Cloudflare Pages)
│   └── index.js               # Express server bundle
├── server/
│   ├── _core/
│   │   ├── worker.ts          # Worker entry point (new)
│   │   ├── db.ts              # D1 database config
│   │   └── env.ts             # Environment variables
│   └── storage-r2.ts          # R2 file upload service (new)
└── package.json
```

---

## Cost Estimate

### Cloudflare Pricing (as of Feb 2026):

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Pages** | 500 deploys/month | Included |
| **Workers** | 100,000 requests/day | $0.50 per 1M requests |
| **D1 (SQLite)** | 5M rows read/month | $0.75 per 1M reads, $1.25 per 1M writes |
| **R2 (Storage)** | 10 GB storage | $0.015 per GB/month |
| **KV (Cache)** | 100k read/day | $0.50 per 1M reads |

**Estimate**: For a small-medium platform, ~$5-20/month (vs Railway's $22+/month).

---

## Next: Monitoring & Maintenance

Once deployed, set up:

1. **Error Monitoring**: Sentry or Cloudflare Tail
2. **Database Backups**: Regular exports from D1
3. **Analytics**: Cloudflare Web Analytics
4. **Performance**: Monitor Worker execution time

Check logs with:
```bash
wrangler tail --env production --follow
```

---

## Support Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [R2 Bucket Guide](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Drizzle ORM D1 Guide](https://orm.drizzle.team/docs/get-started-sqlite)

---

## You're All Set! 🚀

Your XFlex Trading Academy is ready for Cloudflare deployment:
- ✅ SQLite D1 database configured
- ✅ R2 file storage ready
- ✅ Express backend ready for Workers
- ✅ React frontend ready for Pages
- ✅ Environment variables configured

Next: Run `npm install`, then `npm run build`, then deploy!
