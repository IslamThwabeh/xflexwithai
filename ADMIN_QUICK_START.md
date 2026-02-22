# 🚀 Admin Panel Quick Setup

## ✅ Follow These Steps (5 minutes)

### Step 1: Create Admin User in D1
Copy this INSERT statement and run it in **Cloudflare D1 Dashboard**:

```sql
INSERT INTO admins (email, passwordHash, name, createdAt, updatedAt, lastSignedIn)
VALUES (
   'admin@xflexacademy.com',
  '$2a$10$E9sey.JDMyGlTVq04R8W7Ok./mDe9N1JSF3ZLLK8j.QP7JlBR3d.W',
  'Admin',
  datetime('now'),
  datetime('now'),
  datetime('now')
);
```

**Login Credentials:**
- **Email:** `admin@xflexacademy.com`
- **Password:** `Admin@123456`

⚠️ Change this password after first login!

---

### Step 2: Seed Sample Courses

Copy ALL the INSERT statements from above (courses + episodes) and run in D1.

**Result:** 
- 3 sample courses (2 published, 1 draft)
- 7 episodes across courses
- Ready to manage in admin panel

---

### Step 3: Access Admin Panel

1. Go to: **https://xflexacademy.com/admin/login**
2. Enter credentials from Step 1
3. You're in! 🎉

---

## 📍 Admin Panel Map

```
/admin/login              ← LOGIN PAGE
         ↓
/admin/dashboard          ← Main stats & overview
         ↓
    /admin/courses        ← List/create/edit courses
         ↓
    /admin/courses/1/episodes  ← Manage course episodes
         ↓
    /admin/users          ← View all users
    /admin/keys           ← Manage registration keys
```

---

## 🎬 What You Can Do Now

✅ View all courses  
✅ Create new courses  
✅ Add/edit episodes  
✅ View users  
✅ See course progress  
✅ Generate registration keys  

❌ Upload videos (coming next)  
❌ Edit episode videos (coming next)  
❌ Publish/unpublish (coming next)

---

## 🎥 What We Need to Build Next

1. **Video Upload Endpoint**
   - Route: `POST /api/upload/video`
   - Uploads to R2 bucket
   - Returns video URL

2. **Admin Video Upload Form**
   - In episode management
   - Drag-drop or file select
   - Progress indicator

3. **Course Publishing UI**
   - Publish/unpublish toggle
   - Show "Published" badge
   - Price display

---

## 📋 SQL Reference

### Insert Admin
```sql
INSERT INTO admins (email, passwordHash, name)
VALUES ('email@example.com', '$2a$10$...', 'Name');
```

### Insert Course
```sql
INSERT INTO courses (title, description, price, level, isPublished)
VALUES ('Title', 'Description', 29.99, 'beginner', 1);
```

### Insert Episode
```sql
INSERT INTO episodes (courseId, title, description, duration, orderIndex)
VALUES (1, 'Episode Title', 'Description', 15, 1);
```

---

## 🐛 Troubleshooting

**Forgot admin password?**
→ Run `npx tsx scripts/create-admin.ts NewPassword123`

**Database empty?**
→ Run the seed script steps, paste SQL into D1 console

**Can't login?**
→ Check email/password are correct  
→ Clear browser cookies  
→ Try incognito window

---

## 📞 Next Steps

Once you confirm admin login works:
1. Build video upload UI
2. Connect to R2 storage
3. Enable episode video editing
4. Test with real video file

---

**Ready to proceed?** Let me know once you've completed steps 1-3! 🚀
