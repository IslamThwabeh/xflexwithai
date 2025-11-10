# XFlex Trading Academy - Windows Deployment Guide

Complete step-by-step instructions for deploying from your Windows PC to GitHub and Railway.

---

## Prerequisites

Before starting, ensure you have:
- Git installed on Windows ([Download Git](https://git-scm.com/download/win))
- GitHub account
- Railway account ([Sign up at railway.app](https://railway.app))
- Your GitHub repository URL ready (e.g., `https://github.com/IslamThwabeh/xflexwithai`)

---

## Part 1: Clean Local Directory and Download Code

### Step 1: Clean Your Local Directory

Open **Git Bash** or **PowerShell** and run:

```bash
# Navigate to your project directory
cd /c/Users/islamt/website-xflexwithai

# Remove all files (CAREFUL: This deletes everything!)
rm -rf *

# Also remove hidden files
rm -rf .*

# Verify directory is empty
ls -la
```

**Alternative (Safer):** Rename the old folder and create a fresh one:

```bash
cd /c/Users/islamt
mv website-xflexwithai website-xflexwithai-backup
mkdir website-xflexwithai
cd website-xflexwithai
```

### Step 2: Download Project Files from Manus

1. **Open Manus Management UI** in your browser
2. Click on **Code** panel (left sidebar)
3. Click **"Download All Files"** button (top right)
4. A ZIP file will be downloaded (e.g., `xflex-flask.zip`)
5. **Extract the ZIP** to `/c/Users/islamt/website-xflexwithai`

**Verify extraction:**

```bash
cd /c/Users/islamt/website-xflexwithai
ls -la
# You should see: client/, server/, drizzle/, package.json, etc.
```

---

## Part 2: Initialize Git and Push to GitHub

### Step 3: Initialize Git Repository

```bash
cd /c/Users/islamt/website-xflexwithai

# Initialize Git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - XFlex Trading Academy with language switcher"
```

### Step 4: Connect to GitHub Repository

**If you already have a GitHub repository:**

```bash
# Add remote origin (replace with your actual repo URL)
git remote add origin https://github.com/IslamThwabeh/xflexwithai.git

# Push to GitHub (force push to replace old code)
git branch -M main
git push -u origin main --force
```

**If you need to create a new GitHub repository:**

1. Go to [GitHub](https://github.com)
2. Click **"New Repository"** (green button)
3. Name it: `xflexwithai`
4. **Do NOT** initialize with README, .gitignore, or license
5. Click **"Create repository"**
6. Copy the repository URL
7. Run the commands above with your new URL

### Step 5: Verify GitHub Push

1. Open your GitHub repository in browser
2. Verify all files are there:
   - `client/` folder
   - `server/` folder
   - `drizzle/` folder
   - `package.json`
   - `README.md`
   - etc.

---

## Part 3: Deploy to Railway

### Step 6: Create Railway Project

1. Go to [Railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. **Authorize Railway** to access your GitHub account (if first time)
5. Select your repository: **`IslamThwabeh/xflexwithai`**
6. Railway will start deploying automatically

### Step 7: Add MySQL Database

1. In your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add MySQL"**
3. Railway will create a MySQL database
4. The `DATABASE_URL` environment variable will be automatically added

### Step 8: Configure Environment Variables

Click on your **web service** (not the database), then go to **"Variables"** tab.

Add these environment variables:

```bash
# Node Environment
NODE_ENV=production

# Database (should already be set automatically)
DATABASE_URL=mysql://... (auto-populated by Railway)

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Manus OAuth (get from Manus dashboard)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your-manus-app-id

# Owner Info (your details)
OWNER_OPEN_ID=your-openid-from-manus
OWNER_NAME=Islam Thwabeh

# App Branding
VITE_APP_TITLE=XFlex Trading Academy
VITE_APP_LOGO=/logo.svg

# Manus Built-in APIs (get from Manus dashboard)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key

# Analytics (optional, get from Manus)
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# Debugging (set to true for initial testing)
DEBUG_LOGGING=true
```

**How to get Manus credentials:**
1. Go to Manus Management UI
2. Click **Settings** → **Secrets**
3. Copy the values for:
   - `VITE_APP_ID`
   - `OWNER_OPEN_ID`
   - `BUILT_IN_FORGE_API_KEY`
   - `VITE_FRONTEND_FORGE_API_KEY`

### Step 9: Configure Build and Start Commands

In Railway, go to **"Settings"** tab:

**Build Command:**
```bash
pnpm install && pnpm build
```

**Start Command:**
```bash
pnpm start
```

**Root Directory:** (leave empty or set to `/`)

### Step 10: Wait for Deployment

1. Railway will automatically build and deploy
2. Watch the **"Deployments"** tab for progress
3. Build takes ~5-10 minutes
4. Once complete, you'll see a green checkmark ✅

### Step 11: Get Your Railway URL

1. Go to **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Railway will give you a URL like: `xflexwithai-production.up.railway.app`
5. **Copy this URL** - this is your live website!

---

## Part 4: Post-Deployment Setup

### Step 12: Run Database Migrations

Railway should automatically run migrations during build. Verify by checking logs:

1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Check logs for: `✅ Database migration completed`

If migrations didn't run, you can trigger them manually:

1. Go to **"Settings"** → **"Deploy Triggers"**
2. Click **"Redeploy"**

### Step 13: Add Your Admin Account

1. In Railway dashboard, click on **MySQL database**
2. Go to **"Data"** tab (or use **"Connect"** to get connection string)
3. Use a MySQL client (like MySQL Workbench or TablePlus) to connect
4. Run this SQL:

```sql
INSERT INTO admins (openId, name, email, createdAt, updatedAt)
VALUES (
  'your-openid-from-manus',  -- Replace with your actual OpenID
  'Islam Thwabeh',
  'your-email@example.com',
  NOW(),
  NOW()
);
```

**How to get your OpenID:**
1. Visit your deployed site
2. Log in with Manus OAuth
3. Check Railway logs for: `[AUTH] User authenticated: { openId: '...' }`
4. Copy the `openId` value
5. Use it in the SQL above

### Step 14: Test Your Deployed Application

Visit your Railway URL and test:

1. ✅ **Homepage loads** with language switcher (English/عربي)
2. ✅ **Click language switcher** - page should switch to Arabic (RTL)
3. ✅ **Login with Manus** - should redirect to Manus OAuth
4. ✅ **After login** - should see your name in header
5. ✅ **Access /admin/login** - should see admin login page
6. ✅ **Login as admin** - should access admin dashboard
7. ✅ **Create a test course** - upload thumbnail and add episodes
8. ✅ **Access /lexai** - should see LexAI subscription page
9. ✅ **Access /dashboard** - should see user dashboard

### Step 15: Configure Custom Domain (Optional)

If you have a custom domain (e.g., `xflexwithai.com`):

1. In Railway, go to **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Enter your domain: `xflexwithai.com`
4. Railway will show DNS records to add
5. Go to your domain registrar (e.g., Namecheap, GoDaddy)
6. Add the CNAME record Railway provides
7. Wait for DNS propagation (~10-60 minutes)

---

## Part 5: Troubleshooting

### Build Fails

**Error:** `pnpm: command not found`

**Solution:** Railway should auto-detect pnpm. If not, add to `package.json`:

```json
{
  "packageManager": "pnpm@8.15.0"
}
```

### Database Connection Error

**Error:** `Error: connect ECONNREFUSED`

**Solution:**
1. Verify `DATABASE_URL` is set correctly
2. Check MySQL database is running in Railway
3. Ensure database and web service are in the same project

### Admin Login Not Working

**Error:** "Invalid credentials" or "Not authorized"

**Solution:**
1. Verify you inserted your admin record in the database
2. Check `openId` matches exactly (case-sensitive)
3. Check Railway logs for authentication errors

### Environment Variables Not Working

**Solution:**
1. Go to Railway **"Variables"** tab
2. Click **"Raw Editor"**
3. Verify all variables are present
4. Click **"Redeploy"** after adding/changing variables

### Website Shows 404

**Solution:**
1. Check Railway deployment status (should be green)
2. Verify build completed successfully
3. Check start command is `pnpm start`
4. Review deployment logs for errors

---

## Part 6: Monitoring and Logs

### View Logs

1. In Railway dashboard, click your web service
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. View real-time logs

**Useful log filters:**
- `[LOGGER]` - Debug logs (if DEBUG_LOGGING=true)
- `[AUTH]` - Authentication events
- `[ERROR]` - Error messages
- `[DATABASE]` - Database operations

### Monitor Performance

1. Go to **"Metrics"** tab in Railway
2. Monitor:
   - CPU usage
   - Memory usage
   - Network traffic
   - Response times

---

## Part 7: Making Updates

### Update Code and Redeploy

When you make changes locally:

```bash
cd /c/Users/islamt/website-xflexwithai

# Make your changes...

# Commit changes
git add .
git commit -m "Description of your changes"

# Push to GitHub
git push origin main

# Railway will automatically redeploy!
```

Railway has **automatic deployments** enabled by default. Every push to `main` branch triggers a new deployment.

---

## Part 8: Production Checklist

Before going live with real users:

- [ ] Set `DEBUG_LOGGING=false` in Railway (reduce log volume)
- [ ] Add your admin account to database
- [ ] Test all features (courses, episodes, enrollment, LexAI)
- [ ] Configure custom domain (if applicable)
- [ ] Set up Stripe for payments (future)
- [ ] Test language switcher (English ↔ Arabic)
- [ ] Verify file uploads work (course thumbnails, episode videos)
- [ ] Check mobile responsiveness
- [ ] Test on different browsers (Chrome, Safari, Firefox)
- [ ] Set up error monitoring (optional: Sentry)
- [ ] Configure backups for MySQL database

---

## Quick Reference Commands

```bash
# Clean and start fresh
cd /c/Users/islamt
rm -rf website-xflexwithai
mkdir website-xflexwithai
cd website-xflexwithai

# Initialize Git
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/IslamThwabeh/xflexwithai.git
git branch -M main
git push -u origin main --force

# Update and redeploy
git add .
git commit -m "Update description"
git push origin main
```

---

## Support

If you encounter issues:

1. **Check Railway logs** for error messages
2. **Review this guide** for missed steps
3. **Check GitHub repository** to ensure all files were pushed
4. **Verify environment variables** are set correctly
5. **Contact Manus support** at https://help.manus.im for Manus-specific issues

---

## Summary

You've successfully deployed XFlex Trading Academy to Railway! 🎉

Your application is now live at your Railway URL with:
- ✅ Bilingual support (English/Arabic)
- ✅ Course management system
- ✅ LexAI AI currency analysis
- ✅ User dashboard and progress tracking
- ✅ Admin panel for content management
- ✅ File upload support for thumbnails and videos
- ✅ Comprehensive logging for debugging

**Next steps:**
1. Add your admin account
2. Create your first course
3. Test the complete user flow
4. Share your site with users!

Good luck with your trading academy! 📈
