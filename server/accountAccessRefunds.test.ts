import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("../backend/routers.ts", import.meta.url), "utf8");
const workerContextSource = readFileSync(new URL("../backend/_core/context-worker.ts", import.meta.url), "utf8");
const nodeContextSource = readFileSync(new URL("../backend/_core/context.ts", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("../frontend/src/components/admin/AdminClientProfileSheet.tsx", import.meta.url), "utf8");
const revenueSource = readFileSync(new URL("../frontend/src/pages/AdminRevenueReport.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../database/migrations/082_account_access_and_ils_refunds.sql", import.meta.url), "utf8");

describe("account restriction and ILS refund workflow", () => {
  it("blocks password, OTP, and existing-session access", () => {
    expect(routerSource.match(/loginBlockedAt/g)?.length).toBeGreaterThanOrEqual(3);
    expect(workerContextSource).toContain("Blocked client session rejected");
    expect(nodeContextSource).toContain("Blocked client session rejected");
  });

  it("limits account decisions to admin/support and requires a reason", () => {
    expect(routerSource).toContain("blockAccess: adminOrRoleProcedure(['support'])");
    expect(routerSource).toContain("restoreAccess: adminOrRoleProcedure(['support'])");
    expect(routerSource).toContain("reason: z.string().trim().min(5).max(1000)");
    expect(routerSource).toContain("canManageAccountAccess");
  });

  it("keeps login, services, and refund as separate audited decisions", () => {
    expect(profileSource).toContain("deactivateServices");
    expect(profileSource).toContain("recordRefund");
    expect(profileSource).toContain("Restoring login later does not reactivate these services automatically");
    expect(dbSource).toContain('action: "blocked"');
    expect(dbSource).toContain('action: "restored"');
  });

  it("does not roll back supported service deactivation when the legacy FlexAI table is absent", () => {
    const flexaiGuardIndex = dbSource.indexOf('if (await databaseTableExists(db, "flexaiSubscriptions"))');
    const flexaiUpdateIndex = dbSource.indexOf("db.update(flexaiSubscriptions)", flexaiGuardIndex);

    expect(flexaiGuardIndex).toBeGreaterThan(-1);
    expect(flexaiUpdateIndex).toBeGreaterThan(flexaiGuardIndex);
    expect(dbSource).toContain("Legacy FlexAI deactivation skipped because its table is absent");
  });

  it("uses an append-only ILS refund ledger and prevents over-refunds", () => {
    expect(migrationSource).toContain("amount_ils_agorot");
    expect(migrationSource).toContain("ACCOUNT_REFUND_EXCEEDS_ILS_SALE");
    expect(migrationSource).toContain("ACCOUNT_REFUND_SALE_MISMATCH");
    expect(dbSource).toContain("grossRevenueIls");
    expect(dbSource).toContain("refundedRevenueIls");
    expect(dbSource).toContain("netRevenueIls");
  });

  it("shows only shekel-denominated financial decisions in the new admin UI", () => {
    expect(profileSource).toContain("Refund Amount (₪)");
    expect(profileSource).toContain("All amounts are in ILS");
    expect(revenueSource).toContain("ILS Refund Ledger");
    expect(revenueSource).toContain("Gross (₪)");
  });
});
