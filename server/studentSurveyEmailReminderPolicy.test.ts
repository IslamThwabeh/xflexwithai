import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalD1Database } from "../backend/_core/localD1";
import { getDb, getStudentSurveyEmailOutboxBlockReason, materializeDueStudentSurveyNotifications } from "../backend/db";

const directory = mkdtempSync(join(tmpdir(), "xflex-survey-email-policy-"));
let database: Awaited<ReturnType<typeof createLocalD1Database>>;

beforeAll(async () => {
  const imported = await import("better-sqlite3");
  const sqlite = new imported.default(join(directory, "fixture.db"));
  sqlite.exec(`
    CREATE TABLE admin_settings (id INTEGER PRIMARY KEY, settingKey TEXT UNIQUE, settingValue TEXT, updatedAt TEXT);
    INSERT INTO admin_settings VALUES (1,'student_surveys_enabled','true',NULL),(2,'student_surveys_email_reminders_enabled','false',NULL);
    CREATE TABLE users (id INTEGER PRIMARY KEY,email TEXT,notificationPrefs TEXT,login_blocked_at TEXT);
    INSERT INTO users VALUES (9,'student@example.test','{}',NULL);
    CREATE TABLE student_surveys (id INTEGER PRIMARY KEY,title TEXT,is_active INTEGER);
    INSERT INTO student_surveys VALUES (7,'تقييم التجربة',1);
    CREATE TABLE student_survey_assignments (
      id INTEGER PRIMARY KEY,survey_id INTEGER,user_id INTEGER,status TEXT,due_at TEXT,block_at TEXT,
      notification_schedule_started_at TEXT,next_notification_at TEXT,last_notification_at TEXT,
      last_notification_stage TEXT,notification_count INTEGER,created_by_user_id INTEGER,updated_at TEXT
    );
    INSERT INTO student_survey_assignments VALUES
      (31,7,9,'pending','2026-11-01T10:00:00.000Z','2026-11-02T10:00:00.000Z',
      '2026-10-30T10:00:00.000Z','2026-11-03T09:00:00.000Z',NULL,'overdue',5,-1,NULL);
    CREATE TABLE user_notifications (
      id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,title_en TEXT,title_ar TEXT,content_en TEXT,content_ar TEXT,
      action_url TEXT,is_read INTEGER DEFAULT 0,batch_id TEXT,email_sent INTEGER DEFAULT 0,dedupe_key TEXT UNIQUE,created_at TEXT
    );
    CREATE TABLE student_survey_audit_logs (
      id INTEGER PRIMARY KEY,entity_type TEXT,entity_id INTEGER,survey_id INTEGER,user_id INTEGER,
      actor_user_id INTEGER,action TEXT,from_status TEXT,to_status TEXT,details TEXT,created_at TEXT
    );
  `);
  sqlite.close();
  database = await createLocalD1Database(join(directory, "fixture.db"));
  await getDb({ DB: database });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
  (database as any)?.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("survey reminder email pause", () => {
  it("continues in-app reminders and advances the daily schedule without touching the email outbox", async () => {
    // No email_outbox table exists: attempting to queue email would fail this test.
    expect(await materializeDueStudentSurveyNotifications()).toEqual({ processed: 1, dashboardCreated: 1, emailsQueued: 0 });
    expect(await database.prepare("SELECT action_url FROM user_notifications").first("action_url")).toBe("/surveys");
    expect(await database.prepare("SELECT next_notification_at FROM student_survey_assignments WHERE id=31").first("next_notification_at"))
      .toBe("2026-11-04T10:00:00.000Z");
    const audit = await database.prepare("SELECT details FROM student_survey_audit_logs").first<string>("details");
    expect(JSON.parse(audit!)).toMatchObject({ channel: "in_app", stage: "overdue" });
    expect(await materializeDueStudentSurveyNotifications()).toEqual({ processed: 0, dashboardCreated: 0, emailsQueued: 0 });
  });

  it("suppresses already-queued reminder mail at delivery time, with assignment and support mail unaffected", async () => {
    expect(await getStudentSurveyEmailOutboxBlockReason({ eventType: "student_survey_reminder", metadataJson: "not-json" } as any))
      .toBe("survey_email_reminders_disabled");
    expect(await getStudentSurveyEmailOutboxBlockReason({ eventType: "student_survey_assigned", metadataJson: '{"assignmentId":31}' } as any)).toBeNull();
    expect(await getStudentSurveyEmailOutboxBlockReason({ eventType: "support_client_reply" } as any)).toBeNull();
    await database.exec("UPDATE admin_settings SET settingValue='true' WHERE settingKey='student_surveys_email_reminders_enabled'");
    expect(await getStudentSurveyEmailOutboxBlockReason({ eventType: "student_survey_reminder", metadataJson: '{"assignmentId":31}' } as any)).toBeNull();
  });
});
