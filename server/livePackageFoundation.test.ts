import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

const migration = readFileSync(new URL('../database/migrations/092_live_package_foundation.sql', import.meta.url), 'utf8');
const router = readFileSync(new URL('../backend/routers.ts', import.meta.url), 'utf8');
const database = readFileSync(new URL('../backend/db.ts', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../backend/_core/worker.ts', import.meta.url), 'utf8');

describe('Live package foundation contracts', () => {
  it('applies cleanly to the physical pre-migration package tables', () => {
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
    sqlite.exec(migration);
    const pkg = sqlite.prepare("SELECT slug, price, currency, isPublished, packageType FROM packages WHERE slug = 'live-package'").get() as any;
    expect(pkg).toEqual({ slug: 'live-package', price: 200000, currency: 'ILS', isPublished: 0, packageType: 'live' });
    expect(sqlite.prepare("SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_admin_visible'").pluck().get()).toBe('false');
    sqlite.close();
  });

  it('seeds the product disabled at the exact native ILS price', () => {
    expect(migration).toContain("'live-package', 'Live Package', 'بكج لايف'");
    expect(migration).toContain("200000, 'ILS'");
    expect(migration).toContain("('package_live_admin_visible', 'false')");
    expect(migration).toContain("('package_live_purchase_approved', 'false')");
  });

  it('uses the dedicated indexes for entitlement, session, and recording access paths', () => {
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
    sqlite.exec(migration);
    const plan = (sql: string) => sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row: any) => row.detail).join('\n');

    expect(plan("SELECT * FROM live_package_entitlements WHERE userId = 7 AND isActive = 1")).toContain('idx_live_package_entitlements_access');
    expect(plan("SELECT * FROM live_package_sessions WHERE packageId = 1 AND cohortKey = 'live-2026' ORDER BY startsAt")).toContain('idx_live_package_sessions_schedule');
    expect(plan("SELECT * FROM live_package_recordings WHERE packageId = 1 AND cohortKey = 'live-2026' AND isPublished = 1 ORDER BY sortOrder")).toContain('idx_live_package_recordings_catalog');
    sqlite.close();
  });

  it('models meeting, course, and recording lifetimes separately', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS live_package_entitlements');
    expect(migration).toContain('sessionStartsAt TEXT NOT NULL');
    expect(migration).toContain('sessionEndsAt TEXT NOT NULL');
    expect(migration).toContain("recordingPolicy TEXT NOT NULL DEFAULT 'permanent'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS live_package_sessions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS live_package_recordings');
    const fulfillment = database.slice(database.indexOf('export async function fulfillLivePackageEntitlement'), database.indexOf('export async function listLivePackageSessions('));
    expect(fulfillment).toContain('getLivePackageConfigurationErrors');
    expect(fulfillment).toContain('await db.batch([');
    expect(fulfillment).toContain("subscriptionEndDate: null");
    expect(fulfillment).toContain("isSubscriptionActive: true");
  });

  it('blocks Live renewal, upgrade, duplicate, and automatic staff activation paths', () => {
    expect(database).toContain("Live Package supports fresh one-time purchase keys only");
    expect(database).toContain("reason: 'live_package_already_owned'");
    expect(database).toContain("reason: 'live_package_staff_requires_complimentary_grant'");
    expect(database).toContain("reason: 'live_package_fulfillment_failed'");
    expect(database).toContain("set({ activatedAt: null })");
    expect(router).toContain('hasLivePackageCommitments');
    expect(router).toContain('course assignments are locked after the first order or cohort content is created');
    expect(router).toContain("'grant_live_package_complimentary_access'");
  });

  it('never includes the Zoom URL in public state or student schedule listings', () => {
    const publicState = router.slice(router.indexOf('livePublicState:'), router.indexOf('liveAdminPreview:'));
    expect(publicState).not.toContain('zoomJoinUrl');
    const studentScheduleSelection = database.slice(database.indexOf('export async function listLivePackageSessions('), database.indexOf('export async function listLivePackageSessionsAdmin'));
    expect(studentScheduleSelection).not.toContain('zoomJoinUrl');
    expect(router).toContain("zoomJoinUrl: '[protected]'");
    expect(router).toContain("hasZoomJoinUrl: true");
  });

  it('builds an admin-only, unsaved enabled-state preview without changing settings', () => {
    const preview = router.slice(router.indexOf('previewLiveConfig:'), router.indexOf('updateLiveConfig:'));
    expect(preview).toContain('adminProcedure');
    expect(preview).toContain('parseLivePackageConfig');
    expect(preview).toContain('true,');
    expect(preview).toContain('previewOnly: true');
    expect(preview).toContain('persisted: false');
    expect(preview).not.toContain('setAdminSettings');
    expect(preview).not.toContain('logAdminAction');
  });

  it('streams recordings only after authenticated entitlement checks and disallows advertised downloads', () => {
    expect(worker).toContain('getLivePackageRecordingForUser');
    expect(worker).toContain('Cache-Control", "private, no-store');
    expect(worker).toContain('Content-Disposition", buildContentDisposition("inline"');
    expect(worker).not.toContain('/api/live-package-recordings/${recording.id}/download');
  });

  it('uses native order currency and refuses direct hidden-package ordering', () => {
    expect(router).toContain("currency: orderCurrency");
    expect(router).toContain("if (!availability.purchasable)");
    expect(router).toContain("Coupons are not configured for this package currency.");
  });
});
