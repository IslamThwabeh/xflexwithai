import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

const migration092 = readFileSync(new URL('../database/migrations/092_live_package_foundation.sql', import.meta.url), 'utf8');
const migration097 = readFileSync(new URL('../database/migrations/099_live_package_phase_2.sql', import.meta.url), 'utf8');
const migration102 = readFileSync(new URL('../database/migrations/102_live_package_multipart_completion_guardrails.sql', import.meta.url), 'utf8');
const migration103 = readFileSync(new URL('../database/migrations/103_live_package_phase_2_ledger_aliases.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../database/schema-sqlite.ts', import.meta.url), 'utf8');
const router = readFileSync(new URL('../backend/routers.ts', import.meta.url), 'utf8');
const database = readFileSync(new URL('../backend/db.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../backend/_core/worker.ts', import.meta.url), 'utf8');
const emailOutbox = readFileSync(new URL('../backend/services/email-outbox.service.ts', import.meta.url), 'utf8');
const adminPage = readFileSync(new URL('../frontend/src/pages/AdminLivePackage.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../frontend/src/pages/LivePackageWorkspace.tsx', import.meta.url), 'utf8');
const roles = readFileSync(new URL('../shared/const.ts', import.meta.url), 'utf8');

describe('Live Package Phase 2 contracts', () => {
  it('keeps Live Phase 2 migration filenames conflict-free after the release', () => {
    const migrationNames = readdirSync(new URL('../database/migrations/', import.meta.url))
      .filter((name) => /^\d+_.*\.sql$/.test(name));
    expect(migrationNames).toContain('099_live_package_phase_2.sql');
    expect(migrationNames).toContain('100_live_package_multipart_upload_tracking.sql');
    expect(migrationNames).toContain('101_live_package_phase_2_hardening.sql');
    expect(migrationNames).toContain('102_live_package_multipart_completion_guardrails.sql');
    expect(migrationNames).toContain('103_live_package_phase_2_ledger_aliases.sql');
    expect(migrationNames).not.toContain('097_live_package_phase_2.sql');
    expect(migrationNames).not.toContain('098_live_package_multipart_upload_tracking.sql');
  });

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
    sqlite.exec(migration102);
    const columns = sqlite.prepare("PRAGMA table_info(live_package_sessions)").all().map((row: any) => row.name);
    expect(columns).toContain('session_type');
    expect(columns).toContain('recurrence_key');
    const uploadColumns = sqlite.prepare("PRAGMA table_info(live_package_recording_uploads)").all().map((row: any) => row.name);
    expect(uploadColumns).toContain('part_size_bytes');
    expect(uploadColumns).toContain('expected_part_count');
    expect(uploadColumns).toContain('completed_part_count');
    const plan = (sql: string) => sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row: any) => row.detail).join('\n');
    expect(plan("SELECT * FROM live_package_notification_jobs WHERE status = 'queued' AND scheduled_for <= '2026-09-05T00:00:00.000Z' ORDER BY scheduled_for, id")).toContain('idx_live_notification_jobs_status_scheduled');
    expect(plan("SELECT * FROM live_package_recording_uploads WHERE status = 'initiated' AND expires_at < '2026-09-05T00:00:00.000Z'")).toContain('idx_live_recording_uploads_status_expires');
    sqlite.close();
  });

  it('reconciles production Live Phase 2 ledger aliases without business-data updates', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'manual',
        notes TEXT,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO schema_migrations (migration_name, source, notes)
      VALUES
        ('097_live_package_phase_2.sql', 'codex_wrangler', 'earlier production numbering'),
        ('098_live_package_multipart_upload_tracking.sql', 'codex_wrangler', 'earlier production numbering'),
        ('101_live_package_phase_2_hardening.sql', 'codex_wrangler', 'release hardening');
    `);
    sqlite.exec(migration103);
    const rows = sqlite.prepare("SELECT migration_name, source FROM schema_migrations ORDER BY migration_name").all();
    expect(rows).toContainEqual({ migration_name: '099_live_package_phase_2.sql', source: 'codex_reconciliation' });
    expect(rows).toContainEqual({ migration_name: '100_live_package_multipart_upload_tracking.sql', source: 'codex_reconciliation' });
    expect(migration103).not.toMatch(/\bUPDATE\s+(orders|orderItems|registrationKeys|live_package_entitlements|live_package_sessions)/i);
    expect(migration103).not.toMatch(/\bDELETE\b/i);
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
    expect(database).toContain('assertLivePackageSessionSlotAvailable');
    expect(database).toContain('assertLivePackageSessionBatchSlotsAvailable');
    expect(database).toContain('Live session time conflicts');
    expect(adminPage).toContain('trading_analysis');
    expect(router).toContain('createSessions');
    expect(router).toContain("action: 'create'");
    expect(adminPage).toContain('Save recurrence preview');
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
    expect(adminPage).toContain('notificationTiming');
    expect(adminPage).toContain('Preview count and message');
    expect(adminPage).toContain('materializedCount');
  });

  it('keeps recording storage private, draft-first, upload-tracked, and entitlement-gated for late buyers', () => {
    expect(worker).toContain('/api/live-package-recordings/upload');
    expect(worker).toContain('/api/live-package-recordings/multipart');
    expect(worker).toContain('action === "status"');
    expect(worker).toContain('createLivePackageRecordingUpload');
    expect(worker).toContain('markLivePackageRecordingUploadPart');
    expect(worker).toContain('completeLivePackageRecordingUpload');
    expect(worker).toContain('validateCompletedLiveRecordingParts');
    expect(worker).toContain('expectedPartCount');
    expect(worker).toContain('Completed upload size does not match the declared recording size');
    expect(worker).toContain('already_completed');
    expect(worker).toContain('listExpiredLivePackageRecordingUploads');
    expect(worker).toContain('resumeMultipartUpload');
    expect(worker).toContain('VIDEOS_BUCKET.put(objectKey, request.body');
    expect(database).toContain('r2UploadId');
    expect(database).toContain('completedPartsJson');
    expect(database).toContain('assertLivePackageRecordingSessionMatchesCohort');
    expect(database).toContain('replacedByRecordingId');
    expect(database).toContain('eq(livePackageRecordings.isPublished, true)');
    expect(worker).toContain('getLivePackageRecordingForUser');
    expect(worker).toContain('Content-Disposition", buildContentDisposition("inline"');
    expect(adminPage).toContain('Upload draft');
    expect(adminPage).toContain('Publish');
    expect(adminPage).toContain('completed parts can resume');
    expect(adminPage).toContain('updateRecording.mutate({ id: item.id, titleEn');
  });
});
