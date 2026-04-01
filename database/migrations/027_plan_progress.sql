-- Foundation Plan Progress tracking (10-day program, Eid offer)
CREATE TABLE IF NOT EXISTS plan_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  fullName TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  progress TEXT NOT NULL DEFAULT '{}',       -- JSON: { "taskId": true/false, ... }
  answers TEXT NOT NULL DEFAULT '{}',        -- JSON: { "phaseN": "text answer", ... }
  currentPhase INTEGER NOT NULL DEFAULT 1,
  phaseApprovals TEXT NOT NULL DEFAULT '{}', -- JSON: { "1": true, "2": true, ... }
  adminNotes TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_progress_email ON plan_progress(email);
