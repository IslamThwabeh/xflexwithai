# User Authentication System Implementation Plan

## 📊 Current Status

### ✅ Already Implemented
- [x] User registration endpoint (`auth.register`)
- [x] User login endpoint (`auth.login`)
- [x] Admin login endpoint (`auth.adminLogin`)
- [x] Password hashing with bcrypt
- [x] JWT token generation and verification
- [x] Cookie-based session management
- [x] LoginForm and RegisterForm components
- [x] Auth page at `/auth`
- [x] useAuth hook for client-side auth state
- [x] AdminRoute protection component
- [x] Database schema with users and admins tables
- [x] Email validation
- [x] Password strength validation

### ⏳ Needs Completion

#### Phase 1: User Dashboard & Protected Routes
1. **Create User Dashboard Page** (`/dashboard`)
   - Show user profile info
   - Display enrolled courses
   - Show course progress
   - Quick action buttons
   - User settings link

2. **Create Protected Route Component** (User-level)
   - Similar to AdminRoute but for regular users
   - Redirect to `/auth` if not authenticated
   - Show loading state

3. **Create User Profile Page** (`/profile`)
   - Edit name, email, phone
   - Change password
   - Avatar upload (optional)
   - Account settings

#### Phase 2: Password Management
1. **Change Password Feature**
   - Verify old password
   - New password validation
   - Confirmation
   - Success message

2. **Forgot Password Flow**
   - Email request endpoint
   - Generate password reset token
   - Send email with reset link
   - Reset form page
   - Update password with token verification

3. **Password Reset Email Template**
   - Professional HTML template
   - Reset link with token
   - Expiry information

#### Phase 3: Email Management
1. **Email Verification Flow**
   - Send verification email on registration
   - Email verification token
   - Verification page
   - Resend verification email

2. **Email Verification UI**
   - Post-register verification screen
   - Resend button
   - Skip option (optional)

3. **Email Service Setup**
   - Configure email provider (SendGrid, Mailgun, Resend)
   - Email templates
   - Queue system for reliability

#### Phase 4: Session & Security
1. **Session Management**
   - Session timeout handling
   - "Remember me" functionality
   - Multiple device/session management

2. **Two-Factor Authentication (Optional)** 
   - SMS/Email OTP
   - TOTP support
   - Backup codes

3. **Security Features**
   - Rate limiting on auth endpoints
   - Brute force protection
   - Login attempt logging
   - Device/IP tracking

#### Phase 5: User Experience
1. **Auth Loading States**
   - Skeleton loaders
   - Smooth transitions
   - Error messages

2. **Auth Redirects**
   - Remember redirect URL
   - Post-login redirect
   - Post-logout cleanup

3. **Account Status**
   - Show login status in header
   - User dropdown menu
   - Quick logout button
   - Settings link

---

## 🎯 Implementation Steps

### Step 1: Create User Dashboard
**Files to create/modify:**
- `frontend/src/pages/Dashboard.tsx` (NEW)
- `frontend/src/components/ProtectedRoute.tsx` (NEW)
- `frontend/src/_core/hooks/useUser.ts` (NEW)
- `frontend/src/App.tsx` (UPDATE routes)

### Step 2: Create User Profile Page
**Files to create/modify:**
- `frontend/src/pages/Profile.tsx` (NEW)
- `backend/routers.ts` (ADD profile update endpoints)
- `backend/db.ts` (ADD updateUser function)

### Step 3: Implement Password Change
**Backend:**
- Add `auth.changePassword` procedure to `backend/routers.ts`
- Create frontend form component

**Frontend:**
- Create `ChangePasswordForm` component
- Add route/modal in Profile page

### Step 4: Implement Password Reset
**Backend:**
- Create password reset token generation
- Add endpoints: `auth.requestPasswordReset`, `auth.resetPassword`
- Store reset tokens in database
- Send email with reset link

**Frontend:**
- Create `ForgotPasswordPage`
- Create `ResetPasswordPage`
- Add routes

### Step 5: Email Verification
**Backend:**
- Add email verification status to users table (if not exists)
- Create email verification endpoints
- Send verification email on registration

**Frontend:**
- Create `EmailVerificationPage`
- Show prompt after signup
- Resend button

---

## 📝 Database Migrations Needed

### New Columns for Users Table
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN password_reset_token_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_token_expires_at TIMESTAMP;
```

### Password Reset Tokens Table
```sql
CREATE TABLE password_reset_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Security Checklist

- [ ] Rate limiting on auth endpoints (5 attempts per 15 minutes)
- [ ] Password validation (min 8 chars, uppercase, lowercase, number)
- [ ] Email validation
- [ ] CSRF protection
- [ ] Secure password reset token (cryptographically random)
- [ ] Password reset token expiry (15-30 minutes)
- [ ] Email verification token expiry (24 hours)
- [ ] Log failed login attempts
- [ ] HTTPS only for auth endpoints
- [ ] Secure cookie flags (HttpOnly, Secure, SameSite)
- [ ] Never expose password reset tokens in URL (use POST if possible)

---

## 🧪 Testing Checklist

- [ ] User registration with valid data
- [ ] Prevent registration with existing email
- [ ] User login with correct credentials
- [ ] Reject login with wrong password
- [ ] JWT token validation
- [ ] Protected route access
- [ ] Redirect unauthenticated users
- [ ] Logout clears session
- [ ] Password change verification
- [ ] Password reset flow
- [ ] Email verification flow
- [ ] Session timeout (if implemented)

---

## 📚 API Endpoints Summary

### Auth Endpoints (Already Implemented)
- `POST /trpc/auth.register` - Register new user
- `POST /trpc/auth.login` - User login
- `POST /trpc/auth.adminLogin` - Admin login
- `POST /trpc/auth.logout` - Logout
- `GET /trpc/auth.me` - Get current user

### Auth Endpoints (To Implement)
- `POST /trpc/auth.changePassword` - Change password
- `POST /trpc/auth.requestPasswordReset` - Request password reset
- `POST /trpc/auth.resetPassword` - Reset password with token
- `POST /trpc/auth.requestEmailVerification` - Request email verification
- `POST /trpc/auth.verifyEmail` - Verify email with token
- `GET /trpc/users.profile` - Get user profile
- `PUT /trpc/users.updateProfile` - Update user profile

---

## 🚀 Priority Order

1. **HIGH** - User Dashboard (core feature)
2. **HIGH** - Protected Routes (security)
3. **HIGH** - User Profile Page (core feature)
4. **MEDIUM** - Password Change
5. **MEDIUM** - Forgot Password / Password Reset
6. **MEDIUM** - Email Verification
7. **LOW** - Two-factor Authentication
8. **LOW** - Session Management UI

---

## 📦 Dependencies

Already installed:
- bcryptjs (password hashing)
- jsonwebtoken (JWT)
- zod (validation)

Might need:
- nodemailer or service provider SDK (for emails)
- crypto (for token generation - Node.js built-in)

