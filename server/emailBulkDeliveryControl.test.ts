import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  decideAutomaticBulkDeliveryState,
  type BulkDeliveryControlState,
} from "../backend/services/bulk-email-control.service";

const migrationSql = readFileSync(
  fileURLToPath(new URL("../database/migrations/120_email_bulk_delivery_control.sql", import.meta.url)),
  "utf8",
);
const workerSource = readFileSync(
  fileURLToPath(new URL("../backend/_core/worker.ts", import.meta.url)),
  "utf8",
);
const adminEmailSource = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/AdminEmailLogs.tsx", import.meta.url)),
  "utf8",
);

const baseState: BulkDeliveryControlState = {
  mode: "automatic",
  isPaused: false,
  reason: null,
  pausedAt: null,
  healthySince: null,
  lastEvaluatedAt: null,
  updatedAt: "2026-09-22T08:00:00.000Z",
  updatedByAdminId: null,
};

describe("bulk email delivery control", () => {
  it("pauses on priority delay and requires ten stable minutes before resuming", () => {
    const paused = decideAutomaticBulkDeliveryState({
      state: baseState,
      hasPriorityDelay: true,
      now: new Date("2026-09-22T08:01:00.000Z"),
    });
    expect(paused.action).toBe("automatic_paused");
    expect(paused.next).toMatchObject({ isPaused: true, reason: "priority_delivery_delayed" });

    const recovering = decideAutomaticBulkDeliveryState({
      state: paused.next,
      hasPriorityDelay: false,
      now: new Date("2026-09-22T08:02:00.000Z"),
    });
    expect(recovering.action).toBe("automatic_recovery_started");

    const stillPaused = decideAutomaticBulkDeliveryState({
      state: recovering.next,
      hasPriorityDelay: false,
      now: new Date("2026-09-22T08:11:59.000Z"),
    });
    expect(stillPaused.action).toBe("none");
    expect(stillPaused.next.isPaused).toBe(true);

    const resumed = decideAutomaticBulkDeliveryState({
      state: recovering.next,
      hasPriorityDelay: false,
      now: new Date("2026-09-22T08:12:00.000Z"),
    });
    expect(resumed.action).toBe("automatic_resumed");
    expect(resumed.next).toMatchObject({ isPaused: false, reason: null, healthySince: null });
  });

  it("cancels recovery when priority delay returns and preserves manual pause", () => {
    const recoveringState = {
      ...baseState,
      isPaused: true,
      reason: "priority_delivery_delayed",
      pausedAt: "2026-09-22T08:01:00.000Z",
      healthySince: "2026-09-22T08:02:00.000Z",
    };
    const cancelled = decideAutomaticBulkDeliveryState({
      state: recoveringState,
      hasPriorityDelay: true,
      now: new Date("2026-09-22T08:05:00.000Z"),
    });
    expect(cancelled.action).toBe("automatic_recovery_cancelled");
    expect(cancelled.next.healthySince).toBeNull();

    const manualState = { ...recoveringState, mode: "manual_paused" as const };
    const manual = decideAutomaticBulkDeliveryState({
      state: manualState,
      hasPriorityDelay: false,
      now: new Date("2026-09-22T09:00:00.000Z"),
    });
    expect(manual).toEqual({ action: "none", next: manualState });
  });

  it("creates an idempotent singleton controller and indexed priority probe", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE schema_migrations (
        migration_name TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        notes TEXT
      );
      CREATE TABLE email_outbox (
        id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        deliveryClass TEXT NOT NULL,
        nextAttemptAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_email_outbox_status_class_due
        ON email_outbox(status, deliveryClass, nextAttemptAt, createdAt, id);
    `);
    database.exec(migrationSql);
    database.exec(migrationSql);

    expect(database.prepare("SELECT COUNT(*) AS count FROM email_bulk_delivery_control").get())
      .toEqual({ count: 1 });
    expect(database.prepare(`
      SELECT COUNT(*) AS count FROM schema_migrations
      WHERE migration_name = '120_email_bulk_delivery_control.sql'
    `).get()).toEqual({ count: 1 });
    database.prepare(`
      UPDATE email_bulk_delivery_control
      SET isPaused = 1, reason = 'priority_delivery_delayed',
          pausedAt = '2026-09-22T08:00:00.000Z', updatedAt = '2026-09-22T08:00:00.000Z'
      WHERE id = 1
    `).run();
    database.prepare(`
      UPDATE email_bulk_delivery_control
      SET healthySince = '2026-09-22T08:01:00.000Z', updatedAt = '2026-09-22T08:01:00.000Z'
      WHERE id = 1
    `).run();
    expect(database.prepare(`
      SELECT action FROM email_bulk_delivery_control_events ORDER BY id
    `).all()).toEqual([
      { action: "automatic_paused" },
      { action: "automatic_recovery_started" },
    ]);
    const plan = database.prepare(`
      EXPLAIN QUERY PLAN
      SELECT id FROM email_outbox
      WHERE status IN ('pending', 'failed')
        AND deliveryClass IN ('critical', 'urgent')
        AND nextAttemptAt <= ?
        AND attempts < 3
      LIMIT 1
    `).all("2026-09-22T08:00:00.000Z") as Array<{ detail: string }>;
    expect(plan.map((entry) => entry.detail).join("\n"))
      .toContain("idx_email_outbox_status_class_due");
    expect(database.pragma("integrity_check", { simple: true })).toBe("ok");
    database.close();
  });

  it("checks the controller after priority delivery and before every bulk lane", () => {
    const priorityCall = workerSource.indexOf("await runPriorityDeliveryLanes");
    const controlCall = workerSource.indexOf("await db.evaluateEmailBulkDeliveryControl()");
    const lowerLane = workerSource.indexOf("const lowerPriorityLane = scheduledMinute % 5");
    expect(priorityCall).toBeGreaterThan(-1);
    expect(controlCall).toBeGreaterThan(priorityCall);
    expect(lowerLane).toBeGreaterThan(controlCall);
    expect(workerSource.slice(controlCall, lowerLane)).toContain("if (bulkDeliveryPaused) return");
  });

  it("shows confirmed manual pause and return-to-automatic controls to admins", () => {
    expect(adminEmailSource).toContain("setBulkDeliveryPaused.useMutation");
    expect(adminEmailSource).toContain("window.confirm(prompt)");
    expect(adminEmailSource).toContain("Pause bulk delivery");
    expect(adminEmailSource).toContain("Return to automatic");
  });
});
