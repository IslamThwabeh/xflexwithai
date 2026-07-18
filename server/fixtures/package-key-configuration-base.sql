CREATE TABLE registrationKeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packageId INTEGER,
  orderId INTEGER,
  entitlementDays INTEGER,
  expiresAt TEXT,
  activatedAt TEXT,
  assignedByType TEXT,
  assignedById INTEGER,
  createdBy INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
