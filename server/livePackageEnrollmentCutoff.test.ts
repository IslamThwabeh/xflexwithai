import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(
  new URL("../backend/db.ts", import.meta.url),
  "utf8"
);
const migration = readFileSync(
  new URL(
    "../database/migrations/095_live_package_enrollment_cutoff.sql",
    import.meta.url
  ),
  "utf8"
);

describe("Live Package enrollment cutoff", () => {
  it("uses the sales cutoff for Live-key redemption without another settings query", () => {
    expect(dbSource).toContain("expiresAt: liveConfig.salesEndsAt");
    expect(dbSource).toContain("Once redeemed");
    expect(dbSource).not.toContain(
      "parseLivePackageConfig(await getAllAdminSettings()).sessionEndsAt"
    );
  });

  it("updates only the existing Live sales setting", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE admin_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settingKey TEXT NOT NULL UNIQUE,
        settingValue TEXT,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO admin_settings (settingKey, settingValue) VALUES
        ('package_live_sales_ends_at', '2026-12-31T20:59:00.000Z'),
        ('package_live_session_ends_at', '2026-12-31T20:59:00.000Z'),
        ('package_live_recording_policy', 'permanent');
    `);

    db.exec(migration);

    const settings = db
      .prepare(
        "SELECT settingKey, settingValue FROM admin_settings ORDER BY id"
      )
      .all() as Array<{ settingKey: string; settingValue: string }>;
    expect(settings).toEqual([
      {
        settingKey: "package_live_sales_ends_at",
        settingValue: "2026-09-30T20:59:00.000Z",
      },
      {
        settingKey: "package_live_session_ends_at",
        settingValue: "2026-12-31T20:59:00.000Z",
      },
      {
        settingKey: "package_live_recording_policy",
        settingValue: "permanent",
      },
    ]);
  });
});
