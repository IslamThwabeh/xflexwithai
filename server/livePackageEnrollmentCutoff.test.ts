import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  getLivePackageAvailability,
  parseLivePackageConfig,
} from "../backend/services/live-package.service";

const dbSource = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../database/migrations/097_live_package_manual_registration.sql", import.meta.url),
  "utf8"
);

describe("Live Package manual registration migration", () => {
  it("issues Live keys without a registration cutoff and ignores legacy expiry at activation", () => {
    expect(dbSource).toContain("expiresAt: null");
    expect(dbSource).toContain("manual registration state does not expire issued keys");
    expect(dbSource).toContain("pkg.packageType !== 'live' && key.expiresAt");
    expect(dbSource).not.toContain("expiresAt: liveConfig.salesEndsAt");
  });

  it("preserves production state while clearing only unused Live-key deadlines", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE admin_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settingKey TEXT NOT NULL UNIQUE,
        settingValue TEXT,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE packages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, nameEn TEXT NOT NULL, nameAr TEXT NOT NULL, descriptionEn TEXT, descriptionAr TEXT, price INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', renewalPrice INTEGER DEFAULT 0, renewalPeriodDays INTEGER DEFAULT 0, renewalDescription TEXT, includesLexai INTEGER NOT NULL DEFAULT 0, includesRecommendations INTEGER NOT NULL DEFAULT 0, includesSupport INTEGER NOT NULL DEFAULT 0, includesPdf INTEGER NOT NULL DEFAULT 0, durationDays INTEGER DEFAULT 0, isLifetime INTEGER NOT NULL DEFAULT 1, isPublished INTEGER NOT NULL DEFAULT 0, displayOrder INTEGER NOT NULL DEFAULT 0, thumbnailUrl TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, upgradePrice INTEGER DEFAULT 0, packageType TEXT NOT NULL DEFAULT 'standard');
      CREATE TABLE packageCourses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        packageId INTEGER NOT NULL,
        courseId INTEGER NOT NULL,
        displayOrder INTEGER NOT NULL DEFAULT 0,
        UNIQUE(packageId, courseId)
      );
      CREATE TABLE live_package_entitlements (
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
      CREATE UNIQUE INDEX uq_live_package_entitlements_user_cohort ON live_package_entitlements(userId, cohortKey);
      CREATE INDEX idx_live_package_entitlements_access ON live_package_entitlements(userId, isActive, sessionEndsAt);
      CREATE TABLE registrationKeys (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL, keyCode text(255) NOT NULL, email text(320),
        courseId integer NOT NULL, activatedAt text, createdAt text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
        createdBy integer NOT NULL, isActive integer DEFAULT 1 NOT NULL, notes text, expiresAt text,
        price INTEGER DEFAULT 0 NOT NULL, currency TEXT DEFAULT 'USD' NOT NULL, packageId INTEGER,
        isUpgrade INTEGER DEFAULT 0, referredBy TEXT, entitlementDays INTEGER, isRenewal INTEGER DEFAULT 0,
        orderId INTEGER, issuanceType TEXT NOT NULL DEFAULT 'manual', assignedAt TEXT, assignedByType TEXT,
        assignedById INTEGER, configurationNotes TEXT, configurationUpdatedAt TEXT,
        configurationUpdatedByType TEXT, configurationUpdatedById INTEGER,
        issuancePurpose TEXT NOT NULL DEFAULT 'legacy', activationPolicy TEXT NOT NULL DEFAULT 'legacy',
        authorizationReason TEXT, authorizedByType TEXT, authorizedById INTEGER, authorizedAt TEXT
      );
      CREATE UNIQUE INDEX registrationKeys_keyCode_unique ON registrationKeys(keyCode);
      CREATE UNIQUE INDEX idx_registration_keys_order_package ON registrationKeys(orderId, packageId)
        WHERE orderId IS NOT NULL AND packageId IS NOT NULL;
      CREATE INDEX idx_registration_keys_assignment ON registrationKeys(email, activatedAt, isActive);
      CREATE INDEX idx_registration_keys_pending_policy_email
        ON registrationKeys(activationPolicy, email, packageId, isActive, activatedAt, orderId);
      CREATE TABLE package_key_configuration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER NOT NULL,
        order_id INTEGER,
        actor_type TEXT NOT NULL,
        actor_id INTEGER NOT NULL,
        previous_entitlement_days INTEGER,
        new_entitlement_days INTEGER,
        previous_expires_at TEXT,
        new_expires_at TEXT,
        previous_configuration_notes TEXT,
        new_configuration_notes TEXT,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_package_key_configuration_history_key_created
        ON package_key_configuration_history(key_id, created_at DESC, id DESC);
      CREATE TRIGGER package_key_configuration_history_no_update
      BEFORE UPDATE ON package_key_configuration_history FOR EACH ROW
      BEGIN SELECT RAISE(ABORT, 'package_key_configuration_history_append_only'); END;
      CREATE TRIGGER package_key_configuration_history_no_delete
      BEFORE DELETE ON package_key_configuration_history FOR EACH ROW
      BEGIN SELECT RAISE(ABORT, 'package_key_configuration_history_append_only'); END;
      CREATE TRIGGER package_key_configuration_activated_immutable
      BEFORE UPDATE OF entitlementDays, expiresAt, configurationNotes ON registrationKeys
      FOR EACH ROW WHEN OLD.activatedAt IS NOT NULL AND (
        OLD.entitlementDays IS NOT NEW.entitlementDays OR OLD.expiresAt IS NOT NEW.expiresAt
        OR OLD.configurationNotes IS NOT NEW.configurationNotes
      ) BEGIN SELECT RAISE(ABORT, 'activated_package_key_configuration_immutable'); END;
      CREATE TRIGGER package_key_configuration_history_update
      AFTER UPDATE OF entitlementDays, expiresAt, configurationNotes ON registrationKeys
      FOR EACH ROW WHEN OLD.packageId IS NOT NULL AND (
        OLD.entitlementDays IS NOT NEW.entitlementDays OR OLD.expiresAt IS NOT NEW.expiresAt
        OR OLD.configurationNotes IS NOT NEW.configurationNotes
      ) BEGIN
        INSERT INTO package_key_configuration_history (
          key_id, order_id, actor_type, actor_id, previous_entitlement_days, new_entitlement_days,
          previous_expires_at, new_expires_at, previous_configuration_notes, new_configuration_notes,
          reason, created_at
        ) VALUES (
          NEW.id, NEW.orderId, COALESCE(NULLIF(trim(NEW.configurationUpdatedByType), ''), 'system'),
          COALESCE(NEW.configurationUpdatedById, 0), OLD.entitlementDays, NEW.entitlementDays,
          OLD.expiresAt, NEW.expiresAt, OLD.configurationNotes, NEW.configurationNotes,
          'configuration_updated', COALESCE(NEW.configurationUpdatedAt, datetime('now'))
        );
      END;
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, migration_name TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'manual', notes TEXT, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

      INSERT INTO admin_settings (settingKey, settingValue) VALUES
        ('package_live_admin_visible', 'true'), ('package_live_purchase_approved', 'true'),
        ('package_live_lifecycle', 'active'), ('package_live_cohort_key', 'live-2026'),
        ('package_live_session_starts_at', '2026-09-04T21:00:00.000Z'),
        ('package_live_session_ends_at', '2026-12-31T20:59:00.000Z'),
        ('package_live_recording_policy', 'until_date'),
        ('package_live_recording_access_ends_at', '2026-12-31T20:59:00.000Z');
      INSERT INTO packages (id, slug, nameEn, nameAr, descriptionEn, descriptionAr, price, currency, renewalPrice, packageType)
        VALUES (1, 'live-package', 'Live', 'لايف', 'old', 'قديم', 200000, 'ILS', 0, 'live'),
               (2, 'basic', 'Basic', 'أساسية', 'basic', 'أساسية', 50000, 'ILS', 0, 'standard');
      INSERT INTO packageCourses (packageId, courseId, displayOrder) VALUES (1, 10, 0), (2, 20, 0);
      INSERT INTO live_package_entitlements (
        id, userId, packageId, registrationKeyId, orderId, cohortKey, sessionStartsAt, sessionEndsAt,
        recordingPolicy, recordingAccessEndsAt
      ) VALUES (1, 7, 1, NULL, 100, 'live-2026', '2026-09-04T21:00:00.000Z',
        '2026-12-31T20:59:00.000Z', 'until_date', '2026-12-31T20:59:00.000Z');
      INSERT INTO registrationKeys (
        id, keyCode, courseId, createdBy, packageId, orderId, activatedAt, entitlementDays,
        expiresAt, configurationNotes
      ) VALUES
        (1, 'LIVE-UNUSED', 0, 1, 1, 100, NULL, 1, '2026-09-30T20:59:00.000Z', 'legacy'),
        (2, 'LIVE-ACTIVATED', 0, 1, 1, 101, '2026-09-10T00:00:00.000Z', 1, '2026-09-30T20:59:00.000Z', 'activated'),
        (3, 'BASIC-UNUSED', 0, 1, 2, 102, NULL, 30, '2026-10-01T00:00:00.000Z', 'basic');
    `);

    const unrelatedBefore = db.prepare("SELECT * FROM registrationKeys WHERE id IN (2, 3) ORDER BY id").all();
    const unrelatedCourseBefore = db.prepare("SELECT * FROM packageCourses WHERE packageId = 2").all();
    db.exec(migration);

    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.prepare("SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_registration_open'").pluck().get()).toBe("false");
    expect(db.prepare("SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_cohort_status'").pluck().get()).toBe("not_started");
    expect(db.prepare("SELECT courseId FROM packageCourses ORDER BY courseId").pluck().all()).toEqual([20]);
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 1").pluck().get()).toBeNull();
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 2").pluck().get()).toBe("2026-09-30T20:59:00.000Z");
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 3").pluck().get()).toBe("2026-10-01T00:00:00.000Z");
    expect(db.prepare("SELECT count(*) FROM package_key_configuration_history").pluck().get()).toBe(1);
    expect(db.prepare("SELECT reason FROM package_key_configuration_history").pluck().get()).toBe("configuration_updated");
    expect(db.prepare("SELECT * FROM registrationKeys WHERE id IN (2, 3) ORDER BY id").all()).toEqual(unrelatedBefore);
    expect(db.prepare("SELECT * FROM packageCourses WHERE packageId = 2").all()).toEqual(unrelatedCourseBefore);
    expect(db.prepare("SELECT recordingPolicy, recordingAccessEndsAt FROM live_package_entitlements WHERE id = 1").get()).toEqual({
      recordingPolicy: "permanent",
      recordingAccessEndsAt: null,
    });

    const settings = Object.fromEntries(
      db.prepare("SELECT settingKey, settingValue FROM admin_settings").all().map((row: any) => [row.settingKey, row.settingValue])
    );
    const packageRecord = db.prepare("SELECT packageType, currency, price, renewalPrice FROM packages WHERE id = 1").get() as any;
    expect(getLivePackageAvailability({
      config: parseLivePackageConfig(settings, true),
      packageRecord,
      assignedCourseCount: 0,
      now: new Date("2026-09-05T10:00:00.000Z"),
    }).purchasable).toBe(false);

    const businessStateAfterFirstRun = {
      settings: db.prepare("SELECT settingKey, settingValue FROM admin_settings ORDER BY settingKey").all(),
      courses: db.prepare("SELECT packageId, courseId, displayOrder FROM packageCourses ORDER BY id").all(),
      entitlements: db.prepare("SELECT recordingPolicy, recordingAccessEndsAt FROM live_package_entitlements ORDER BY id").all(),
      keys: db.prepare("SELECT id, expiresAt, configurationNotes FROM registrationKeys ORDER BY id").all(),
      historyCount: db.prepare("SELECT count(*) FROM package_key_configuration_history").pluck().get(),
    };
    db.exec(migration);
    expect({
      settings: db.prepare("SELECT settingKey, settingValue FROM admin_settings ORDER BY settingKey").all(),
      courses: db.prepare("SELECT packageId, courseId, displayOrder FROM packageCourses ORDER BY id").all(),
      entitlements: db.prepare("SELECT recordingPolicy, recordingAccessEndsAt FROM live_package_entitlements ORDER BY id").all(),
      keys: db.prepare("SELECT id, expiresAt, configurationNotes FROM registrationKeys ORDER BY id").all(),
      historyCount: db.prepare("SELECT count(*) FROM package_key_configuration_history").pluck().get(),
    }).toEqual(businessStateAfterFirstRun);
    db.close();
  });
});
