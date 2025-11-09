# XFlex Trading Academy - Deployment Guide

Complete guide for deploying XFlex Trading Academy to GitHub and Railway.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GitHub Setup](#github-setup)
3. [Railway Deployment](#railway-deployment)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub account
- ✅ Railway account (sign up at [railway.app](https://railway.app))
- ✅ Git installed on your local machine
- ✅ All code tested locally

---

## GitHub Setup

### Step 1: Create a New Repository

1. Go to [GitHub](https://github.com) and log in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository settings:
   - **Repository name**: `xflex-trading-academy` (or your preferred name)
   - **Description**: "Trading education platform with course management and user progress tracking"
   - **Visibility**: Choose **Private** or **Public**
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

### Step 2: Push Your Code to GitHub

Open your terminal in the project directory and run:

```bash
# Navigate to project directory
cd /path/to/xflex-flask

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: XFlex Trading Academy platform"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/xflex-trading-academy.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note**: If you already have a remote origin, use:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/xflex-trading-academy.git
```

### Step 3: Verify Upload

1. Refresh your GitHub repository page
2. You should see all your project files
3. Verify that `.env` is **NOT** uploaded (it's in `.gitignore`)

---

## Railway Deployment

### Step 1: Create New Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account (if first time)
5. Select your `xflex-trading-academy` repository
6. Railway will automatically detect it's a Node.js project

### Step 2: Add Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add MySQL"**
3. Railway will provision a MySQL database
4. The `DATABASE_URL` will be automatically added to your environment variables

### Step 3: Configure Environment Variables

1. Click on your web service (not the database)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** and add each of the following:

#### Required Variables

```bash
# Node Environment
NODE_ENV=production

# Database (automatically added by Railway, verify it exists)
DATABASE_URL=mysql://...

# Logging (enable for initial deployment to debug issues)
DEBUG_LOGGING=true

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Manus OAuth (if using Manus authentication)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your-manus-app-id
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Your Name

# Application Settings
VITE_APP_TITLE=XFlex Trading Academy
VITE_APP_LOGO=/logo.svg

# Built-in APIs (if using Manus services)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.yourdomain.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

**Important**: 
- Generate a strong random string for `JWT_SECRET` (at least 32 characters)
- You can use this command to generate one: `openssl rand -base64 32`
- Never commit these values to GitHub

### Step 4: Deploy

1. Railway will automatically start deploying after you add the variables
2. Monitor the deployment logs in the **"Deployments"** tab
3. Wait for the build to complete (usually 2-5 minutes)
4. Once deployed, Railway will provide a public URL (e.g., `https://your-app.up.railway.app`)

### Step 5: Run Database Migrations

After the first deployment:

1. Go to your Railway project
2. Click on your web service
3. Go to **"Settings"** tab
4. Scroll to **"Deploy"** section
5. Under **"Custom Start Command"**, add:
   ```bash
   pnpm db:push && pnpm start
   ```
6. This ensures migrations run before the app starts

**Alternative**: Use Railway CLI to run migrations manually:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run pnpm db:push
```

---

## Environment Variables

### Complete List

Here's a complete reference of all environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `DATABASE_URL` | Yes | MySQL connection string | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Yes | Secret for JWT tokens | `random-32-char-string` |
| `DEBUG_LOGGING` | No | Enable detailed logging | `true` or `false` |
| `OAUTH_SERVER_URL` | If using Manus | OAuth server URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | If using Manus | OAuth portal URL | `https://portal.manus.im` |
| `VITE_APP_ID` | If using Manus | Manus app ID | `your-app-id` |
| `OWNER_OPEN_ID` | If using Manus | Owner's OpenID | `your-open-id` |
| `OWNER_NAME` | If using Manus | Owner's name | `Your Name` |
| `VITE_APP_TITLE` | No | Application title | `XFlex Trading Academy` |
| `VITE_APP_LOGO` | No | Logo path | `/logo.svg` |
| `BUILT_IN_FORGE_API_URL` | If using Manus | Forge API URL | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | If using Manus | Forge API key (server) | `your-api-key` |
| `VITE_FRONTEND_FORGE_API_URL` | If using Manus | Forge API URL (frontend) | `https://forge.manus.im` |
| `VITE_FRONTEND_FORGE_API_KEY` | If using Manus | Forge API key (frontend) | `your-frontend-key` |

### Generating Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Database Setup

### Verify Database Connection

1. After deployment, check the logs for database connection messages:
   ```
   [LOGGER] Debug logging is ENABLED
   [Database] Database connection established
   ```

2. If you see connection errors, verify:
   - `DATABASE_URL` is correctly set
   - Railway MySQL service is running
   - Database migrations have run

### Access Database

Railway provides a web-based database viewer:

1. Go to your Railway project
2. Click on the **MySQL** service
3. Go to **"Data"** tab
4. You can view and edit tables directly

### Add Your Admin Account

After deployment, you need to add yourself as an admin:

1. Access the Railway MySQL database
2. Go to the `admins` table
3. Click **"Add Row"**
4. Fill in:
   - `openId`: Your Manus OpenID (or a unique identifier)
   - `name`: Your name
   - `email`: Your email
   - `loginMethod`: `manus` (or your auth method)
5. Save

Now you can access `/admin/login` with your credentials.

---

## Post-Deployment

### Step 1: Verify Deployment

1. Visit your Railway URL (e.g., `https://your-app.up.railway.app`)
2. You should see the XFlex Trading Academy homepage
3. Check that:
   - Homepage loads correctly
   - Registration form is visible
   - No console errors (open browser DevTools)

### Step 2: Test Admin Access

1. Go to `/admin/login`
2. Log in with your admin credentials
3. Verify you can access:
   - Admin dashboard
   - Courses management
   - Episodes management
   - Users management

### Step 3: Create Test Course

1. In admin panel, go to **"Courses"**
2. Click **"Create New Course"**
3. Fill in bilingual content (English + Arabic)
4. Upload a thumbnail (or use a URL)
5. Set price and level
6. Click **"Create Course"**
7. Add episodes to the course

### Step 4: Test User Flow

1. Log out from admin
2. Create a test user account
3. Enroll in the test course
4. Watch an episode
5. Mark it as complete
6. Verify progress tracking works

### Step 5: Disable Debug Logging (Production)

Once everything is working:

1. Go to Railway → Your service → Variables
2. Change `DEBUG_LOGGING` to `false` (or remove it)
3. This reduces log volume and improves performance

---

## Custom Domain (Optional)

### Add Your Own Domain

1. In Railway, go to your web service
2. Go to **"Settings"** tab
3. Scroll to **"Domains"**
4. Click **"+ Custom Domain"**
5. Enter your domain (e.g., `xflexacademy.com`)
6. Railway will provide DNS records
7. Add these records to your domain registrar:
   - Type: `CNAME`
   - Name: `@` (or `www`)
   - Value: `your-app.up.railway.app`
8. Wait for DNS propagation (5-30 minutes)
9. Railway will automatically provision SSL certificate

---

## Troubleshooting

### Build Fails

**Error**: `Module not found` or `Cannot find package`

**Solution**:
```bash
# Ensure all dependencies are in package.json
pnpm install
git add package.json pnpm-lock.yaml
git commit -m "Update dependencies"
git push
```

### Database Connection Fails

**Error**: `Database connection failed`

**Solution**:
1. Verify `DATABASE_URL` is set in Railway variables
2. Check that MySQL service is running
3. Ensure your IP is not blocked (Railway handles this automatically)

### App Crashes on Startup

**Error**: `Application error` or `502 Bad Gateway`

**Solution**:
1. Check Railway logs for specific error
2. Common issues:
   - Missing environment variables
   - Database migrations not run
   - Port binding issues (Railway handles this automatically)

### Admin Login Not Working

**Error**: `Admin access required` or `Forbidden`

**Solution**:
1. Verify you added your account to the `admins` table
2. Check that `openId` matches your login credentials
3. Clear browser cookies and try again

### Logging Not Working

**Error**: No logs appearing in Railway

**Solution**:
1. Ensure `DEBUG_LOGGING=true` is set
2. Check that you're looking at the correct service logs
3. Logs appear in Railway → Service → Deployments → (latest deployment) → Logs

---

## Continuous Deployment

Railway automatically redeploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Your commit message"
git push

# Railway will automatically:
# 1. Detect the push
# 2. Build the new version
# 3. Run migrations
# 4. Deploy
# 5. Zero-downtime switch to new version
```

---

## Monitoring

### View Logs

```bash
# Using Railway CLI
railway logs

# Or view in Railway dashboard
# Project → Service → Deployments → Logs
```

### Monitor Performance

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network traffic
- Request count

Access these in: Project → Service → Metrics

---

## Backup

### Database Backup

Railway doesn't provide automatic backups on the free tier. To backup:

```bash
# Using Railway CLI
railway connect MySQL

# Then use mysqldump
mysqldump -u user -p database > backup.sql
```

**Recommended**: Set up automated backups using a cron job or Railway's scheduled tasks.

---

## Cost Estimates

### Railway Pricing

- **Starter Plan** (Free):
  - $5 credit per month
  - Suitable for testing
  - May sleep after inactivity

- **Developer Plan** ($5/month):
  - $5 credit + $5 usage
  - No sleeping
  - Better for production

- **Pro Plan** ($20/month):
  - $20 credit + usage
  - Priority support
  - Higher limits

**Estimated monthly cost for XFlex Academy**:
- Small traffic (<1000 users/month): $5-10
- Medium traffic (1000-10000 users/month): $20-50
- High traffic (>10000 users/month): $50+

---

## Security Checklist

Before going live:

- [ ] `JWT_SECRET` is a strong random string
- [ ] `DEBUG_LOGGING` is set to `false` in production
- [ ] `.env` file is in `.gitignore` and not committed
- [ ] All environment variables are set in Railway (not in code)
- [ ] Database credentials are secure
- [ ] Admin account uses a strong password
- [ ] HTTPS is enabled (Railway provides this automatically)
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented (if needed)

---

## Support

If you encounter issues:

1. Check Railway logs first
2. Review this deployment guide
3. Check the LOGGING_GUIDE.md for debugging tips
4. Contact Railway support: https://railway.app/help

---

**Deployment Complete!** 🎉

Your XFlex Trading Academy is now live and ready to accept students!

---

**Last Updated:** November 9, 2025
