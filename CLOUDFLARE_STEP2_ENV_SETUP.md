# Step 2: Cloudflare Environment Variables & Secrets Setup

## Overview
This guide shows you how to set up all required environment variables in Cloudflare Dashboard for your XFlex Trading Academy deployment.

## Prerequisites
- Cloudflare Account (you already have one ✅)
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged into Wrangler (`wrangler login`)

---

## Part 1: Set Up Wrangler Secrets (Required Secrets)

Secrets are sensitive values that should NOT be in version control. They're set via the Cloudflare Dashboard or CLI.

### How to Set Secrets via CLI:

```bash
# Login to Cloudflare
wrangler login

# Set secrets (it will prompt you to paste the value)
wrangler secret put JWT_SECRET --env production
# (Paste your secret when prompted)

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
```

### Or Set Secrets via Cloudflare Dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account → Workers & Pages
3. Click on **xflexwithai** worker
4. Go to **Settings** → **Environment & Secrets** (or **Variables**)
5. Click **"Add variable"** for each of these:

| Variable Name | Value | Source |
|---|---|---|
| `JWT_SECRET` | Generate with: `openssl rand -base64 32` | Generate new |
| `OAUTH_SERVER_URL` | Your OAuth server URL | From your OAuth provider |
| `VITE_OAUTH_PORTAL_URL` | Your OAuth portal URL | From your OAuth provider |
| `VITE_APP_ID` | Your app ID | From Manus config |
| `OWNER_OPEN_ID` | Your OpenID | From Manus config |
| `OWNER_NAME` | Your name | Any name |
| `VITE_APP_TITLE` | XFlex Trading Academy | Same name |
| `VITE_APP_LOGO` | /logo.png | Your logo path |
| `BUILT_IN_FORGE_API_URL` | Your API URL | From API provider |
| `BUILT_IN_FORGE_API_KEY` | Your API key | From API provider |
| `VITE_FRONTEND_FORGE_API_URL` | Same as above | From API provider |
| `VITE_FRONTEND_FORGE_API_KEY` | Same API key | From API provider |

---

## Part 2: Database Configuration

You currently have PostgreSQL (from Railway). For Cloudflare Workers, you have two options:

### Option A: Use Neon (PostgreSQL - Recommended for minimal changes)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project:
   - Project name: `xflexwithai`
   - Postgres version: 16
3. Copy the connection string (looks like: `postgresql://user:password@host/dbname`)
4. Set as secret:
   ```bash
   wrangler secret put DATABASE_URL --env production
   # Paste: postgresql://user:password@host/dbname
   ```

**Neon Pricing**: Free tier supports 10 branches + 3 GB storage. Good for development/small deployments.

### Option B: Use Cloudflare D1 (SQLite - Free but requires schema migration)

You already have D1 created (`cf374361-2caa-4597-a38d-5cecced7827d`).

**Note**: D1 uses SQLite, not PostgreSQL. This requires:
1. Converting your PostgreSQL schema to SQLite
2. Migrating your data from PostgreSQL to SQLite
3. Testing thoroughly

This is more involved. I recommend **Option A (Neon)** for now.

---

## Part 3: R2 Bucket Setup (Already Configured)

Your R2 bucket `xflexwithai-videos` is already created with videos at `xflexwithai-videos/media/`

You need to get your **R2 API credentials**:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **R2** → Click on your bucket name `xflexwithai-videos`
3. Click **Settings** → **Bucket Details**
4. Copy the **S3 API Token** URL (looks like: `https://xflexwithai-videos.YOUR_ACCOUNT_ID.r2.dev`)
5. Go to **R2** → **API Tokens** → Create API Token:
   - Token name: `xflexwithai-upload`
   - Permissions: `Object Read & Write`
   - Scope: `Apply to specific buckets` → Select `xflexwithai-videos`
6. Click **Create API Token** and copy:
   - Access Key ID
   - Secret Access Key
7. Set as secrets:
   ```bash
   wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
   # Paste your account ID (from R2 bucket URL)
   
   wrangler secret put R2_ACCESS_KEY_ID --env production
   # Paste Access Key ID
   
   wrangler secret put R2_SECRET_ACCESS_KEY --env production
   # Paste Secret Access Key
   
   wrangler secret put R2_BUCKET_NAME --env production
   # Paste: xflexwithai-videos
   
   wrangler secret put R2_PUBLIC_URL --env production
   # Paste: https://xflexwithai-videos.YOUR_ACCOUNT_ID.r2.dev
   ```

---

## Part 4: Verify All Environment Variables Are Set

Run this command to list all set variables:

```bash
wrangler secret list --env production
```

You should see all the variables you set above listed.

---

## Next Steps

After setting all environment variables:

1. ✅ (Done) Create wrangler.toml
2. ✅ (Done) Set up environment variables
3. ⏭️ **Next**: Update database configuration
4. ⏭️ **Next**: Configure R2 bucket access in code
5. ⏭️ **Next**: Build the project
6. ⏭️ **Next**: Deploy to Cloudflare

---

## Troubleshooting

**Q: I don't know my OAuth credentials**
A: Contact your OAuth provider (likely from Manus documentation)

**Q: What's a good JWT_SECRET?**
A: Generate one with:
```bash
openssl rand -base64 32
# or in PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object {[byte](Get-Random -Maximum 256)}))
```

**Q: Can I use environment variables instead of secrets?**
A: Yes, but only for non-sensitive values. Secrets are encrypted. Use `vars` in `wrangler.toml` for public values like `NODE_ENV`, `ENVIRONMENT`, URLs, etc.

