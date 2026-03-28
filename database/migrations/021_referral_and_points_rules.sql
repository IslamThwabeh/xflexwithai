-- Migration: Add referral system + points reward rules
-- Phase D: Loyalty Points & Referral System

-- Add referral code to users (non-unique initially, we enforce uniqueness in code)
ALTER TABLE users ADD COLUMN referralCode TEXT;

-- Create unique index on referralCode (allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referralCode ON users(referralCode) WHERE referralCode IS NOT NULL;

-- Referrals table: tracks who referred whom
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrerId INTEGER NOT NULL,      -- the user who shared their code
  refereeId INTEGER NOT NULL,       -- the new user who signed up
  status TEXT DEFAULT 'pending' NOT NULL, -- pending | activated | rewarded
  referrerPoints INTEGER DEFAULT 0 NOT NULL,
  refereePoints INTEGER DEFAULT 0 NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  activatedAt TEXT,                  -- when referee activated a package
  UNIQUE(refereeId)                  -- each user can only be referred once
);

-- Points reward rules (admin-configurable)
CREATE TABLE IF NOT EXISTS points_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ruleKey TEXT NOT NULL UNIQUE,       -- e.g. 'course_complete', 'quiz_pass', 'daily_login', 'referral_referrer', 'referral_referee', 'renewal', 'review'
  points INTEGER NOT NULL DEFAULT 0,
  nameEn TEXT NOT NULL,
  nameAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  isActive INTEGER DEFAULT 1 NOT NULL,
  maxPerDay INTEGER,                  -- optional daily cap (e.g. daily_login = 1)
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed default reward rules
INSERT INTO points_rules (ruleKey, points, nameEn, nameAr, descriptionEn, descriptionAr, isActive, maxPerDay) VALUES
  ('course_complete', 100, 'Course Completion', 'إكمال الدورة', 'Earn points when you complete a course', 'اكسب نقاطًا عند إكمال دورة', 1, NULL),
  ('quiz_pass', 25, 'Quiz Passed', 'اجتياز الاختبار', 'Earn points for passing a quiz', 'اكسب نقاطًا عند اجتياز اختبار', 1, NULL),
  ('daily_login', 5, 'Daily Login', 'تسجيل الدخول اليومي', 'Earn points for logging in each day', 'اكسب نقاطًا لتسجيل الدخول يوميًا', 1, 1),
  ('review', 30, 'Course Review', 'تقييم الدورة', 'Earn points for writing a course review', 'اكسب نقاطًا عند كتابة تقييم للدورة', 1, NULL),
  ('referral_referrer', 200, 'Referral - You', 'إحالة - أنت', 'Earn points when someone you referred activates a package', 'اكسب نقاطًا عندما يفعّل شخص أحلته باقة', 1, NULL),
  ('referral_referee', 50, 'Referral - Friend', 'إحالة - صديقك', 'Earn bonus points when you sign up via a referral', 'اكسب نقاطًا إضافية عند التسجيل عبر إحالة', 1, NULL),
  ('renewal', 150, 'Subscription Renewal', 'تجديد الاشتراك', 'Earn bonus points when you renew your subscription', 'اكسب نقاطًا إضافية عند تجديد اشتراكك', 1, NULL),
  ('episode_milestone', 10, 'Episode Milestone', 'إنجاز حلقة', 'Earn points for every 5 episodes watched', 'اكسب نقاطًا لكل 5 حلقات تشاهدها', 1, NULL);

-- Generate referral codes for existing users (6 char alphanumeric)
-- This will be done per-user on demand via backend code, not in migration
