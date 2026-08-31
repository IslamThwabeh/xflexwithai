ALTER TABLE packages ADD COLUMN packageType TEXT NOT NULL DEFAULT 'standard';

INSERT INTO packages (
  slug, nameEn, nameAr, descriptionEn, descriptionAr, price, currency,
  renewalPrice, renewalPeriodDays, includesLexai, includesRecommendations,
  includesSupport, includesPdf, durationDays, isLifetime, isPublished,
  displayOrder, packageType, createdAt, updatedAt
)
SELECT
  'live-package', 'Live Package', 'بكج لايف',
  'A limited, fixed-window educational Live Package with two scheduled Zoom sessions per week and permanent access to its recordings and assigned base-course content.',
  'بكج تعليمي مباشر ومؤقت، يتضمن لقاءين مجدولين أسبوعياً عبر Zoom، مع وصول دائم إلى التسجيلات والمحتوى التعليمي الأساسي المخصص للبكج.',
  200000, 'ILS', 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 'live', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM packages WHERE slug = 'live-package');

CREATE TABLE IF NOT EXISTS live_package_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  packageId INTEGER NOT NULL,
  registrationKeyId INTEGER,
  orderId INTEGER,
  cohortKey TEXT NOT NULL,
  accessSource TEXT NOT NULL DEFAULT 'purchase' CHECK (accessSource IN ('purchase', 'complimentary')),
  grantReason TEXT,
  grantedByAdminId INTEGER,
  sessionStartsAt TEXT NOT NULL,
  sessionEndsAt TEXT NOT NULL,
  recordingPolicy TEXT NOT NULL DEFAULT 'permanent' CHECK (recordingPolicy IN ('permanent', 'until_date')),
  recordingAccessEndsAt TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (julianday(sessionEndsAt) > julianday(sessionStartsAt)),
  CHECK (recordingPolicy = 'permanent' OR recordingAccessEndsAt IS NOT NULL),
  CHECK (isActive IN (0, 1)),
  UNIQUE(registrationKeyId)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_live_package_entitlements_user_cohort
  ON live_package_entitlements(userId, cohortKey);
CREATE INDEX IF NOT EXISTS idx_live_package_entitlements_access
  ON live_package_entitlements(userId, isActive, sessionEndsAt);

CREATE TABLE IF NOT EXISTS live_package_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packageId INTEGER NOT NULL,
  cohortKey TEXT NOT NULL,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  startsAt TEXT NOT NULL,
  endsAt TEXT NOT NULL,
  zoomJoinUrl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  createdByAdminId INTEGER NOT NULL,
  updatedByAdminId INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (julianday(endsAt) > julianday(startsAt))
);

CREATE INDEX IF NOT EXISTS idx_live_package_sessions_schedule
  ON live_package_sessions(packageId, cohortKey, status, startsAt);

CREATE TABLE IF NOT EXISTS live_package_recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packageId INTEGER NOT NULL,
  cohortKey TEXT NOT NULL,
  sessionId INTEGER,
  titleEn TEXT NOT NULL,
  titleAr TEXT NOT NULL,
  descriptionEn TEXT,
  descriptionAr TEXT,
  objectKey TEXT NOT NULL UNIQUE,
  originalFileName TEXT NOT NULL,
  mimeType TEXT NOT NULL DEFAULT 'video/mp4',
  fileSizeBytes INTEGER,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isPublished INTEGER NOT NULL DEFAULT 0 CHECK (isPublished IN (0, 1)),
  createdByAdminId INTEGER NOT NULL,
  updatedByAdminId INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_live_package_recordings_catalog
  ON live_package_recordings(packageId, cohortKey, isPublished, sortOrder);

INSERT OR IGNORE INTO admin_settings (settingKey, settingValue) VALUES
  ('package_live_admin_visible', 'false'),
  ('package_live_purchase_approved', 'false'),
  ('package_live_lifecycle', 'coming_soon'),
  ('package_live_cohort_key', 'live-2026'),
  ('package_live_sales_starts_at', '2026-09-03T21:00:00.000Z'),
  ('package_live_sales_ends_at', '2026-12-31T20:59:00.000Z'),
  ('package_live_session_starts_at', '2026-09-04T21:00:00.000Z'),
  ('package_live_session_ends_at', '2026-12-31T20:59:00.000Z'),
  ('package_live_recording_policy', 'permanent'),
  ('package_live_recording_access_ends_at', '');
