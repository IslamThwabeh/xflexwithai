import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { buildStudentSurveyDashboardNotificationInsert } from "../backend/db";

const USER_NOTIFICATIONS_PRODUCTION_SHAPED_DDL = `
  CREATE TABLE user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    title_en TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    content_en TEXT,
    content_ar TEXT,
    action_url TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    batch_id TEXT,
    email_sent INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX uq_user_notifications_dedupe_key
    ON user_notifications(dedupe_key)
    WHERE dedupe_key IS NOT NULL;
`;

function notificationValues(dedupeKey: string | null) {
  return {
    userId: 34,
    type: "action",
    titleEn: "A new survey is waiting for you",
    titleAr: "استبيان جديد بانتظارك",
    contentEn: "Please complete the assigned survey.",
    contentAr: "يرجى إكمال الاستبيان المعيّن.",
    actionUrl: "/surveys",
    dedupeKey,
    createdAt: "2026-08-24T19:09:14.311Z",
  };
}

describe("student survey dashboard notification SQL contract", () => {
  it("executes against the production partial unique index and dedupes a non-null key", async () => {
    const database = new Database(":memory:");
    try {
      database.exec(USER_NOTIFICATIONS_PRODUCTION_SHAPED_DDL);
      const orm = drizzle(database);
      const values = notificationValues("student_survey:61:assigned");

      expect(await buildStudentSurveyDashboardNotificationInsert(orm, values)).toHaveLength(1);
      expect(await buildStudentSurveyDashboardNotificationInsert(orm, values)).toEqual([]);

      const stored = database.prepare(`
        SELECT user_id AS userId, dedupe_key AS dedupeKey
        FROM user_notifications
        WHERE dedupe_key = ?
      `).all(values.dedupeKey);
      expect(stored).toEqual([{ userId: 34, dedupeKey: values.dedupeKey }]);
    } finally {
      database.close();
    }
  });

  it("preserves the production rule that null dedupe keys may repeat", async () => {
    const database = new Database(":memory:");
    try {
      database.exec(USER_NOTIFICATIONS_PRODUCTION_SHAPED_DDL);
      const orm = drizzle(database);

      expect(await buildStudentSurveyDashboardNotificationInsert(orm, notificationValues(null)))
        .toHaveLength(1);
      expect(await buildStudentSurveyDashboardNotificationInsert(orm, notificationValues(null)))
        .toHaveLength(1);
      expect(database.prepare(
        "SELECT COUNT(*) AS total FROM user_notifications WHERE dedupe_key IS NULL",
      ).get()).toEqual({ total: 2 });
    } finally {
      database.close();
    }
  });
});
