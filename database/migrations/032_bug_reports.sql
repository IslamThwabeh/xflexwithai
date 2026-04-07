-- Migration 032: Client bug reports with admin/support review and points rewards

CREATE TABLE IF NOT EXISTS bug_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  description TEXT,
  imageUrl TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','rewarded','rejected')),
  riskLevel TEXT CHECK(riskLevel IS NULL OR riskLevel IN ('low','medium','high','critical')),
  awardedPoints INTEGER NOT NULL DEFAULT 0,
  adminNote TEXT,
  reviewedAt TEXT,
  reviewedByType TEXT CHECK(reviewedByType IS NULL OR reviewedByType IN ('admin','staff')),
  reviewedById INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_userId ON bug_reports(userId);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_createdAt ON bug_reports(createdAt);