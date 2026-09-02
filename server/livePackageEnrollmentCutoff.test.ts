import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

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
      CREATE TABLE packages (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        descriptionEn TEXT,
        descriptionAr TEXT,
        updatedAt TEXT
      );
      CREATE TABLE packageCourses (packageId INTEGER, courseId INTEGER);
      CREATE TABLE live_package_entitlements (
        id INTEGER PRIMARY KEY,
        recordingPolicy TEXT,
        recordingAccessEndsAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE registrationKeys (
        id INTEGER PRIMARY KEY,
        packageId INTEGER,
        orderId INTEGER,
        activatedAt TEXT,
        entitlementDays INTEGER,
        expiresAt TEXT,
        configurationNotes TEXT,
        configurationUpdatedAt TEXT,
        configurationUpdatedByType TEXT,
        configurationUpdatedById INTEGER
      );
      CREATE TABLE package_key_configuration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER,
        order_id INTEGER,
        actor_type TEXT,
        actor_id INTEGER,
        previous_entitlement_days INTEGER,
        new_entitlement_days INTEGER,
        previous_expires_at TEXT,
        new_expires_at TEXT,
        previous_configuration_notes TEXT,
        new_configuration_notes TEXT,
        reason TEXT,
        created_at TEXT
      );
      INSERT INTO admin_settings (settingKey, settingValue)
        VALUES ('package_live_registration_open', 'true');
      INSERT INTO packages (id, slug, descriptionEn, descriptionAr, updatedAt)
        VALUES (1, 'live-package', 'old', 'قديم', datetime('now')),
               (2, 'basic', 'basic', 'أساسية', datetime('now'));
      INSERT INTO packageCourses VALUES (1, 10), (2, 20);
      INSERT INTO live_package_entitlements VALUES
        (1, 'until_date', '2026-12-31T20:59:00.000Z', datetime('now'));
      INSERT INTO registrationKeys VALUES
        (1, 1, 100, NULL, 1, '2026-09-30T20:59:00.000Z', 'legacy', NULL, NULL, NULL),
        (2, 1, 101, '2026-09-10T00:00:00.000Z', 1, '2026-09-30T20:59:00.000Z', 'activated', NULL, NULL, NULL),
        (3, 2, 102, NULL, 30, '2026-10-01T00:00:00.000Z', 'basic', NULL, NULL, NULL);
    `);

    db.exec(migration);

    expect(db.prepare("SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_registration_open'").pluck().get()).toBe("true");
    expect(db.prepare("SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_cohort_status'").pluck().get()).toBe("not_started");
    expect(db.prepare("SELECT courseId FROM packageCourses ORDER BY courseId").pluck().all()).toEqual([20]);
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 1").pluck().get()).toBeNull();
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 2").pluck().get()).toBe("2026-09-30T20:59:00.000Z");
    expect(db.prepare("SELECT expiresAt FROM registrationKeys WHERE id = 3").pluck().get()).toBe("2026-10-01T00:00:00.000Z");
    expect(db.prepare("SELECT count(*) FROM package_key_configuration_history").pluck().get()).toBe(1);
    expect(db.prepare("SELECT recordingPolicy, recordingAccessEndsAt FROM live_package_entitlements WHERE id = 1").get()).toEqual({
      recordingPolicy: "permanent",
      recordingAccessEndsAt: null,
    });
    db.close();
  });
});
