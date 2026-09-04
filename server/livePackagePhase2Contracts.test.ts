import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

const migration092 = readFileSync(new URL('../database/migrations/092_live_package_foundation.sql', import.meta.url), 'utf8');
const migration097 = readFileSync(new URL('../database/migrations/097_live_package_phase_2.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../database/schema-sqlite.ts', import.meta.url), 'utf8');
const router = readFileSync(new URL('../backend/routers.ts', import.meta.url), 'utf8');
const database = readFileSync(new URL('../backend/db.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../backend/_core/worker.ts', import.meta.url), 'utf8');
const emailOutbox = readFileSync(new URL('../backend/services/email-outbox.service.ts', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../frontend/src/pages/AdminLivePackage.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../frontend/src/pages/LivePackageWorkspace.tsx', import.meta.url), 'utf8');
const roles = readFileSync(new URL('../shared/const.ts', import.meta.url), 'utf8');

describe('Live Package Phase 2 contracts', () => {
  it('adds Phase 2 schema without mutating existing Live commercial state', () => {
    expect(migration097).toContain('ALTER TABLE live_package_sessions ADD COLUMN session_type');
    expect(migration097).toContain('CREATE TABLE IF NOT EXISTS live_package_session_audit');
    expect(migration097).toContain('CREATE TABLE IF NOT EXISTS live_package_notification_jobs');
    expect(migration097).toContain('CREATE TABLE IF NOT EXISTS live_package_recording_uploads');
    expect(migration097).not.toContain('UPDATE orders');
    expect(migration097).not.toContain('UPDATE packageSubscriptions');
    expect(migration097).not.toContain('DELETE');
  });

  it('applies after the Live foundation and creates indexed bounded access paths', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE,
        nameEn TEXT NOT NULL, nameAr TEXT NOT NULL, descriptionEn TEXT, descriptionAr TEXT,
        price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD',
        renewalPrice INTEGER DEFAULT 0, renewalPeriodDays INTEGER DEFAULT 0, renewalDescription TEXT,
        includesLexai INTEGER NOT NULL DEFAULT 0, includesRecommendations INTEGER NOT NULL DEFAULT 0,
        includesSupport INTEGER NOT NULL DEFAULT 0, includesPdf INTEGER NOT NULL DEFAULT 0,
        durationDays INTEGER DEFAULT 0, isLifetime INTEGER NOT NULL DEFAULT 1,
        isPublished INTEGER NOT NULL DEFAULT 0, displayOrder INTEGER NOT NULL DEFAULT 0,
        thumbnailUrl TEXT, upgradePrice INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE TABLE admin_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, settingKey TEXT NOT NULL UNIQUE, settingValue TEXT, updatedAt TEXT NOT NULL DEFAULT (datetime('now')));
    `);
    sqlite.exec(migration092);
    sqlite.exec(migration097);
    const columns = sqlite.prepare("PRAGMA table_info(live_package_sessions)").all().map((row: any) => row.name);
    expect(columns).toContain('session_type');
    expect(columns).toContain('recurrence_key');
    const plan = (sql: string) => sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row: any) => row.detail).join('\n');
    expect(plan("SELECT * FROM live_package_notification_jobs WHERE status = 'queued' AND scheduled_for <= '2026-09-05T00:00:00.000Z' ORDER BY scheduled_for, id")).toContain('idx_live_notification_jobs_status_scheduled');
    expect(plan("SELECT * FROM live_package_recording_uploads WHERE status = 'initiated' AND expires_at < '2026-09-05T00:00:00.000Z'")).toContain('idx_live_recording_uploads_status_expires');
    sqlite.close();
  });

  it('exposes only granular Live staff permissions for Phase 2 controls', () => {
    for (const role of ['live_sessions_manager', 'live_notifications_manager', 'live_recording_uploader', 'live_recording_publisher']) {
      expect(roles).toContain(role);
    }
    expect(router).toContain("adminOrRoleProcedure(['live_sessions_manager'])");
    expect(router).toContain("adminOrRoleProcedure(['live_notifications_manager'])");
    expect(router).toContain("adminOrRoleProcedure(['live_recording_uploader'])");
    expect(router).toContain("adminOrRoleProcedure(['live_recording_publisher'])");
  });

  it('supports session types, editing/cancellation, audit history, and post-start protection', () => {
    expect(schema).toContain('sessionType: text("session_type")');
    expect(router).toContain("z.enum(['educational', 'trading_analysis'])");
    expect(database).toContain('recordLivePackageSessionAudit');
    expect(database).toContain('Started Live sessions can no longer be rescheduled');
    expect(adminPage).toContain('trading_analysis');
    expect(workspace).toContain('Trading analysis');
  });

  it('queues Live notifications with dispatch-time recipients and privacy BCC delivery', () => {
    expect(database).toContain('dispatchDueLivePackageNotificationJobs');
    expect(database).toContain('listLivePackageNotificationRecipients');
    expect(database).toContain("eventType: 'live_session_reminder'");
    expect(emailOutbox).toContain('LIVE_SESSION_EMAIL_BCC_LIMIT = 50');
    expect(emailOutbox).toContain('drainLiveSessionEmailOutbox');
    expect(worker).toContain('drainLiveSessionEmailOutbox');
    expect(adminPage).toContain('previewNotification');
    expect(adminPage).toContain('cancelNotification');
  });

  it('keeps recording storage private, draft-first, upload-tracked, and entitlement-gated for late buyers', () => {
    expect(worker).toContain('/api/live-package-recordings/upload');
    expect(worker).toContain('createLivePackageRecordingUpload');
    expect(worker).toContain('completeLivePackageRecordingUpload');
    expect(worker).toContain('VIDEOS_BUCKET.put(objectKey, request.body');
    expect(database).toContain('eq(livePackageRecordings.isPublished, true)');
    expect(worker).toContain('getLivePackageRecordingForUser');
    expect(worker).toContain('Content-Disposition", buildContentDisposition("inline"');
    expect(adminPage).toContain('Upload draft');
    expect(adminPage).toContain('Publish');
  });
});
