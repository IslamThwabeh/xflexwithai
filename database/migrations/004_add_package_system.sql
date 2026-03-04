-- Migration: Add Package System + Events + Articles
-- Description: Creates tables for subscription packages, events, articles, and cart/orders
-- Date: 2026-03-04

-- ============================================
-- 1. Packages Table (Basic / Comprehensive)
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nameEn TEXT NOT NULL,
  nameAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  renewalPrice INTEGER DEFAULT 0,
  renewalPeriodDays INTEGER DEFAULT 0,
  renewalDescription TEXT,
  includesLexai INTEGER NOT NULL DEFAULT 0,
  includesRecommendations INTEGER NOT NULL DEFAULT 0,
  includesSupport INTEGER NOT NULL DEFAULT 0,
  includesPdf INTEGER NOT NULL DEFAULT 0,
  durationDays INTEGER DEFAULT 0,
  isLifetime INTEGER NOT NULL DEFAULT 1,
  isPublished INTEGER NOT NULL DEFAULT 0,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  thumbnailUrl TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 2. Package-Course junction table
-- ============================================
CREATE TABLE IF NOT EXISTS packageCourses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packageId INTEGER NOT NULL,
  courseId INTEGER NOT NULL,
  displayOrder INTEGER NOT NULL DEFAULT 0,
  UNIQUE(packageId, courseId)
);

-- ============================================
-- 3. Add stageNumber + intro fields to courses
-- ============================================
ALTER TABLE courses ADD COLUMN stageNumber INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN introVideoUrl TEXT;
ALTER TABLE courses ADD COLUMN hasPdf INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN hasIntroVideo INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN pdfUrl TEXT;

-- ============================================
-- 4. Orders table (shopping cart → order)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discountAmount INTEGER NOT NULL DEFAULT 0,
  vatRate INTEGER NOT NULL DEFAULT 16,
  vatAmount INTEGER NOT NULL DEFAULT 0,
  totalAmount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  paymentMethod TEXT,
  paymentReference TEXT,
  paymentProofUrl TEXT,
  isGift INTEGER NOT NULL DEFAULT 0,
  giftEmail TEXT,
  giftMessage TEXT,
  notes TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completedAt TEXT
);

-- ============================================
-- 5. Order items (what's in the order)
-- ============================================
CREATE TABLE IF NOT EXISTS orderItems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  itemType TEXT NOT NULL DEFAULT 'package',
  packageId INTEGER,
  courseId INTEGER,
  priceAtPurchase INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD'
);

-- ============================================
-- 6. Package subscriptions (user owns package)
-- ============================================
CREATE TABLE IF NOT EXISTS packageSubscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  packageId INTEGER NOT NULL,
  orderId INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1,
  startDate TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  endDate TEXT,
  renewalDueDate TEXT,
  autoRenew INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 7. Events table (monthly events)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  eventType TEXT NOT NULL DEFAULT 'live',
  eventDate TEXT NOT NULL,
  eventEndDate TEXT,
  imageUrl TEXT,
  linkUrl TEXT,
  isPublished INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 8. Articles table (blog)
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  contentEn TEXT,
  contentAr TEXT,
  excerptEn TEXT,
  excerptAr TEXT,
  thumbnailUrl TEXT,
  authorId INTEGER,
  isPublished INTEGER NOT NULL DEFAULT 0,
  publishedAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 9. Seed the two packages
-- ============================================
INSERT OR IGNORE INTO packages (slug, nameEn, nameAr, descriptionEn, descriptionAr, price, currency, renewalPrice, renewalPeriodDays, renewalDescription, includesLexai, includesRecommendations, includesSupport, includesPdf, isLifetime, isPublished, displayOrder)
VALUES
  ('basic', 'Basic Package', 'الباقة الأساسية',
   'Complete trading education program with recommendations support and printable materials.',
   'برنامج تعليمي شامل للتداول مع التوصيات والدعم الفني وملفات قابلة للطباعة.',
   20000, 'USD', 5000, 30,
   'Optional $50/month renewal for recommendations',
   0, 1, 1, 1, 1, 1, 1),
  ('comprehensive', 'Comprehensive Package', 'الباقة الشاملة',
   'Everything in the Basic package plus LexAI artificial intelligence analysis and full recommendations.',
   'كل ما في الباقة الأساسية بالإضافة إلى تحليل الذكاء الاصطناعي LexAI والتوصيات الكاملة.',
   50000, 'USD', 10000, 30,
   '$100/month renewal for recommendations + LexAI',
   1, 1, 1, 1, 1, 1, 2);
