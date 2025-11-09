# XFlex Trading Academy - Deployment Guide

## 📋 Overview

This guide will help you push your XFlex Trading Academy project to GitHub and deploy it to production.

---

## 🚀 Step 1: Push to GitHub

### Initialize Git Repository

```bash
cd /path/to/xflex-flask
git init
git add .
git commit -m "Initial commit: XFlex Trading Academy with registration-first design"
```

### Connect to Your GitHub Repository

```bash
# Replace with your actual GitHub repository URL
git remote add origin https://github.com/IslamThwabeh/xflexwithai.git

# Push to main branch
git branch -M main
git push -u origin main --force
```

**Note:** The `--force` flag will overwrite your existing repository. Remove it if you want to merge changes instead.

---

## 🗄️ Step 2: Database Setup

### Add Your Admin Account

1. Open the **Management UI** → **Database** panel
2. Navigate to the `admins` table
3. Click **Add Row** and fill in:
   - `username`: your-admin-username
   - `password`: your-secure-password (will be hashed)
   - `email`: your-email@example.com
   - `name`: Your Full Name

**Important:** The admin login uses the separate `admins` table, not the `users` table.

### Verify Database Tables

Ensure these tables exist:
- ✅ `users` - Regular student accounts
- ✅ `admins` - Admin accounts (separate from users)
- ✅ `courses` - Course information
- ✅ `episodes` - Course episodes/lessons
- ✅ `enrollments` - User course enrollments

---

## 🌐 Step 3: Deploy to Production

### Option A: Deploy via Manus (Recommended)

1. Click the **Publish** button in the Management UI header
2. Your site will be deployed to: `https://your-project.manus.space`
3. Custom domain can be configured in **Settings** → **Domains**

### Option B: Deploy to Railway/Vercel/Other Platform

#### Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables (copy from Management UI → Settings → Secrets):
   ```
   DATABASE_URL=your-database-url
   JWT_SECRET=your-jwt-secret
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_APP_TITLE=XFlex Trading Academy
   ```
3. Deploy command: `pnpm install && pnpm build && pnpm start`

#### Vercel Deployment

1. Import your GitHub repository in Vercel
2. Framework Preset: **Vite**
3. Build Command: `pnpm build`
4. Output Directory: `dist`
5. Install Command: `pnpm install`

---

## 🔐 Step 4: Configure Authentication

### Admin Login

- Admin login page: `https://your-domain.com/admin/login`
- Use credentials from the `admins` table (not Manus OAuth)

### User Registration

- Users register via the homepage "Create Free Account" button
- Uses Manus OAuth for authentication
- User data is stored in the `users` table

---

## ✅ Step 5: Verify Deployment

### Test Checklist

- [ ] Homepage loads with registration form
- [ ] "Create Free Account" button works
- [ ] Admin login page accessible at `/admin/login`
- [ ] Admin can log in with database credentials
- [ ] Admin dashboard shows statistics
- [ ] Admin can create/edit/delete courses
- [ ] Admin can add episodes to courses
- [ ] Published courses appear on homepage
- [ ] User enrollment tracking works

---

## 📝 Post-Deployment Tasks

### 1. Create Your First Course

1. Log in to admin panel: `/admin/login`
2. Navigate to **Courses** in sidebar
3. Click **Add Course**
4. Fill in bilingual content (English + Arabic)
5. Set price and publish status
6. Click **Create Course**

### 2. Add Episodes

1. From courses list, click **Manage Episodes**
2. Click **Add Episode**
3. Fill in episode details and video URL
4. Set episode order and free/premium status
5. Click **Create Episode**

### 3. Monitor Users

1. Navigate to **Users** in admin sidebar
2. View registered users and enrollments
3. Track subscription status and revenue

---

## 🎨 Customization

### Update Branding

**Logo:**
- Edit `client/src/const.ts` → `APP_LOGO` constant
- Update favicon in Management UI → Settings → General

**Colors:**
- Edit `client/src/index.css` → CSS variables in `:root` and `.dark`

**Homepage Content:**
- Edit `client/src/pages/Home.tsx`

### Add Custom Features

Follow the existing patterns:
1. Add database tables in `drizzle/schema.ts`
2. Run `pnpm db:push` to apply changes
3. Add query helpers in `server/db.ts`
4. Create tRPC procedures in `server/routers.ts`
5. Build UI components in `client/src/pages/`

---

## 🐛 Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` in environment variables
- Check database is accessible from your deployment platform
- Ensure SSL is enabled if required

### Admin Login Not Working

- Verify admin account exists in `admins` table (not `users`)
- Check password was hashed correctly
- Clear browser cookies and try again

### Courses Not Showing

- Verify course `isPublished` is set to `true`
- Check database connection
- Refresh the page

---

## 📞 Support

For deployment issues or questions:
- Check the Management UI → Dashboard for errors
- Review server logs in your deployment platform
- Verify all environment variables are set correctly

---

## 🎯 Next Steps

1. **Add Payment Integration**: Integrate Stripe for course purchases
2. **Implement LexAI**: Add the AI currency analysis chat feature
3. **Email Notifications**: Set up email confirmations for enrollments
4. **Course Certificates**: Generate completion certificates for students
5. **Analytics**: Track course completion rates and user engagement

---

**Congratulations!** 🎉 Your XFlex Trading Academy is now live!
