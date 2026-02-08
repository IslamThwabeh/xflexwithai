# Deploying XFlex Trading Academy to Cloudflare Workers and Pages

Complete guide for migrating from Railway to **Cloudflare Workers** (backend) and **Cloudflare Pages** (frontend).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Setup Steps](#setup-steps)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Database Migration](#database-migration)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Current Setup (Railway)
```
Client (Vite React) → Express Server → MySQL Database
                    (Single Node.js app)
```

### Cloudflare Setup
```
Client (Vite React) → Cloudflare Pages (CDN)
                    ↓
Backend API         → Cloudflare Workers (Serverless)
                    ↓
Database            → Neon, Planetscale, or other serverless DB
```

### Key Benefits of Cloudflare
- ✅ **Free tier**: Generous free allowances for Pages and Workers
- ✅ **CDN**: Automatic global distribution for Pages
- ✅ **Serverless**: No server management, automatic scaling
- ✅ **Cost**: $5/month for Workers if you exceed free tier (vs Railway's higher pricing)
- ✅ **Performance**: Edge computing with Workers

---

## Prerequisites

Before starting, you need:

1. **Cloudflare Account** - Sign up at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. **Git Repository** - Your code on GitHub (required for Pages)
3. **Serverless Database** - Neon, Planetscale, or Turso (MySQL compatible)
4. **Wrangler CLI** - For local development and deployment
5. **Node.js 20+** - Already installed

---

## Setup Steps

### Step 1: Install Wrangler CLI

Wrangler is Cloudflare's CLI tool for developing and deploying Workers.

```bash
npm install -g wrangler
# or
pnpm add -g wrangler

# Verify installation
wrangler --version
```

### Step 2: Create Wrangler Configuration

Create a `wrangler.toml` file in your project root:

```toml
name = "xflex-trading-api"
type = "service"
main = "dist/index.js"
compatibility_date = "2024-12-16"

[env.production]
name = "xflex-trading-api-prod"
routes = [
  { pattern = "api.yourdomain.com/api/*", zone_name = "yourdomain.com" }
]

[[kv_namespaces]]
binding = "KV_STORE"
id = "your-kv-namespace-id"
preview_id = "your-kv-preview-namespace-id"

[build]
command = "npm run build"

[env.production]
vars = { ENVIRONMENT = "production" }
```

**Note**: Replace `yourdomain.com` with your actual domain (configured in Cloudflare)

### Step 3: Setup Serverless Database

Choose one of these options:

#### Option A: Neon (Recommended for PostgreSQL)
```bash
# Sign up at https://console.neon.tech
# Create a new project and get the connection string
# Format: postgresql://user:password@host/dbname
```

#### Option B: Planetscale (MySQL Compatible)
```bash
# Sign up at https://planetscale.com
# Create a database and get MySQL connection string
# Format: mysql://user:password@host/dbname
```

#### Option C: Turso (SQLite with replication)
```bash
# Sign up at https://turso.tech
# Create a database and get connection string
# Format: libsql://...
```

For this guide, we'll use **Planetscale** since your app is already MySQL-based.

### Step 4: Update Project Structure for Workers

Your current Express app needs modifications to work with Cloudflare Workers.

**Option A: Keep Express + Use `@cloudflare/workers-types`**

Install Workers compatibility packages:
```bash
npm install @cloudflare/workers-types wrangler
```

**Option B: Migrate to Hono (Recommended for Cloudflare)**

Hono is lightweight and built for Cloudflare Workers:
```bash
npm install hono
```

We'll use **Option A** for minimal changes to your Express app.

### Step 5: Create Cloudflare Worker Wrapper

Create `server/_core/worker.ts`:

```typescript
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Router } from "itty-router";
import type { PagesFunction } from "@cloudflare/workers-types";
import express from "express";
import cookieParser from "cookie-parser";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import quizRoutes from "../routes/quiz.routes";
import adminQuizRoutes from "../routes/admin-quiz.routes";

// Create Express app
const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
try {
  const flexaiRoutes = await import('../routes/flexai');
  app.use('/api/flexai', flexaiRoutes.default);
} catch (error) {
  console.error('Failed to load FlexAI routes:', error);
}

registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);
app.use("/api/quiz", quizRoutes);
app.use("/api/admin/quiz", adminQuizRoutes);

// Export for Cloudflare Pages Functions
export const onRequest: PagesFunction = async (context) => {
  return app(context.request as any);
};
```

### Step 6: Configure Cloudflare Pages

Create `wrangler-pages.toml` for the frontend:

```toml
name = "xflex-trading-academy"
type = "workers-site"
account_id = "your-account-id"
workers_dev = true
route = "yourdomain.com/*"
zone_id = "your-zone-id"

[build]
command = "npm run build"
cwd = "./client"
watch_paths = ["client/src/**"]

[build.upload]
format = "service-worker"

[env.production]
name = "xflex-trading-academy-prod"
```

---

## Configuration

### Step 1: Set Up Environment Variables in Cloudflare

In Cloudflare Dashboard → Workers & Pages → Settings → Environment Variables:

**Development (local)**:
```bash
# Create .env.local file
DATABASE_URL=mysql://user:password@host/dbname
JWT_SECRET=your-secret-key
NODE_ENV=development
OAUTH_SERVER_URL=your-oauth-url
# ... other variables from ENV_VARIABLES.md
```

**Production (Cloudflare)**:

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Settings → Environment Variables
4. Add all variables listed in [Environment Variables](#environment-variables)

### Step 2: Configure Database Connection

Update `server/db.ts` to support Cloudflare environment:

```typescript
import { drizzle } from "drizzle-orm/mysql2";
import { mysql } from "mysql2";

// This works for both Node.js and Cloudflare
const connection = mysql.createConnection({
  uri: process.env.DATABASE_URL,
  // For Cloudflare Workers, use connection pooling:
  // waitForConnections: true,
  // connectionLimit: 5,
  // queueLimit: 0,
});

export const db = drizzle(connection);
```

For Cloudflare Workers with persistent connections, use a connection pool or consider using **D1** (Cloudflare's native database).

### Step 3: Use Cloudflare D1 (Alternative - Simpler)

D1 is Cloudflare's native SQLite database. To use it:

```bash
# Create D1 database
wrangler d1 create xflex-trading-db

# Get database ID and update wrangler.toml
```

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "xflex-trading-db"
database_id = "your-database-id"
```

Then in your code:
```typescript
import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
}

// Usage
const db = drizzle(env.DB);
```

---

## Deployment

### Step 1: Deploy to Cloudflare Pages (Frontend)

```bash
# Login to Cloudflare
wrangler login

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
wrangler pages publish dist/public
```

Or connect via GitHub:
1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project" → "Connect to Git"
3. Select your GitHub repository
4. Set build command: `npm run build`
5. Set build output: `dist/public`
6. Deploy

### Step 2: Deploy to Cloudflare Workers (Backend)

```bash
# Build the server
npm run build

# Deploy worker
wrangler publish

# Or with deployment service:
wrangler deploy --env production
```

### Step 3: Set Up Custom Domain

In Cloudflare Dashboard:
1. **For Pages**: Workers & Pages → Custom Domain → Add custom domain
2. **For Workers**: Routes → Add route (e.g., `api.yourdomain.com/api/*`)

### Step 4: Configure CORS

In your Express app, add CORS middleware:

```typescript
import cors from "cors";

app.use(cors({
  origin: process.env.VITE_APP_URL || "https://yourdomain.com",
  credentials: true,
}));
```

---

## Database Migration

### From Railway MySQL to Planetscale/Neon

**Step 1: Export data from Railway**

```bash
# Get Railway MySQL connection details from dashboard
mysql -h <railway-host> -u <user> -p<password> <database> --single-transaction --lock-tables=false > backup.sql
```

**Step 2: Import to new database**

```bash
# For Planetscale
mysql -h <planetscale-host> -u <user> -p<password> <database> < backup.sql

# For Neon (PostgreSQL requires conversion)
psql -h <neon-host> -U <user> -d <database> < backup.sql
```

**Step 3: Update DATABASE_URL**

Replace the connection string in Cloudflare environment variables.

**Step 4: Run migrations**

```bash
npm run db:push
```

---

## Environment Variables

Copy these to Cloudflare (Workers Settings → Environment Variables):

```
# Database
DATABASE_URL=mysql://user:pass@host/dbname

# Authentication
JWT_SECRET=<generate-random-secret>
OAUTH_SERVER_URL=https://your-oauth-server
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal

# Manus/App Configuration
VITE_APP_ID=<your-app-id>
OWNER_OPEN_ID=<your-open-id>
OWNER_NAME=<your-name>
VITE_APP_TITLE=XFlex Trading Academy
VITE_APP_LOGO=/logo.png

# APIs
BUILT_IN_FORGE_API_URL=<forge-url>
BUILT_IN_FORGE_API_KEY=<forge-key>
VITE_FRONTEND_FORGE_API_URL=<forge-url>
VITE_FRONTEND_FORGE_API_KEY=<forge-key>

# Optional
DEBUG_LOGGING=false
NODE_ENV=production
VITE_APP_URL=https://yourdomain.com

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=<region>
```

---

## Troubleshooting

### Issue: Worker returns 502 Bad Gateway

**Solution**:
- Check database connectivity: `wrangler tail`
- Verify DATABASE_URL in environment variables
- Check if database accepts connections from Cloudflare IPs
- For Planetscale: Verify firewall rules allow Cloudflare IPs

### Issue: CORS errors in browser

**Solution**:
- Verify `origin` in CORS middleware matches frontend URL
- Check if credentials are being sent correctly
- Review Cloudflare Workers Analytics for request details

### Issue: Static assets (CSS, JS) return 404

**Solution**:
- Verify build output directory is `dist/public`
- Check that `wrangler.toml` has correct `cwd` for Pages
- Rebuild and redeploy: `npm run build && wrangler pages publish dist/public`

### Issue: Database connection timeout

**Solution**:
- For Planetscale: Use connection pooling
- For Neon: Check concurrent connections limit
- For Turso: Use replicas if available

### Issue: Environment variables not available

**Solution**:
- Verify variables are set in Cloudflare Dashboard
- Variables set via CLI: `wrangler secret put VARIABLE_NAME`
- Local testing: Use `.env.local` file
- Redeploy after adding variables: `wrangler deploy`

---

## Cost Comparison

### Railway (Current)
- Server: $7/month minimum
- Database: $15/month
- **Total: ~$22/month**

### Cloudflare (New)
- Pages: FREE (generous limits)
- Workers: FREE tier up to 100,000 requests/day
- Database (Planetscale): FREE tier up to 1M rows
- **Total: FREE or $5-20/month depending on usage**

---

## Next Steps

1. ✅ Create Cloudflare account
2. ✅ Set up serverless database
3. ✅ Install Wrangler CLI
4. ✅ Migrate database
5. ✅ Deploy frontend to Pages
6. ✅ Deploy backend to Workers
7. ✅ Configure custom domain
8. ✅ Set up monitoring (Cloudflare Analytics)

---

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Guide](https://developers.cloudflare.com/workers/wrangler/)
- [Planetscale Docs](https://planetscale.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Turso Docs](https://docs.turso.tech)

---

## Support

For issues specific to:
- **Cloudflare**: Use Cloudflare Community or support portal
- **Database**: Check provider's documentation
- **Express/Node**: Refer to their official docs
- **This Guide**: Cross-reference with your project structure

