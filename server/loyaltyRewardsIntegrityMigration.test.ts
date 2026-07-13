import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/069_loyalty_redemption_integrity.sql", import.meta.url),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("loyalty redemption integrity migration", () => {
  it("validates availability, duplicate requests, price, stock, and balance before insert", () => {
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS loyalty_reward_request_validate");
    for (const invariant of [
      "loyalty_reward_not_available",
      "loyalty_reward_already_pending",
      "loyalty_reward_price_changed",
      "loyalty_reward_out_of_stock",
      "loyalty_reward_insufficient_points",
    ]) {
      expect(migrationSql).toContain(`RAISE(ABORT, '${invariant}')`);
    }
  });

  it("applies balance, inventory, ledger, and redemption changes in the insert transaction", () => {
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS loyalty_reward_request_apply");
    expect(migrationSql).toMatch(/points_balance\s*=\s*points_balance\s*-\s*NEW\.points_cost/i);
    expect(migrationSql).toMatch(/stock_quantity\s*-\s*1/i);
    expect(migrationSql).toContain("'loyalty_reward'");
    expect(migrationSql).toContain("SET points_transaction_id = last_insert_rowid()");
  });

  it("refunds points and restores finite inventory only on pending-to-rejected transitions", () => {
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS loyalty_reward_rejection_refund");
    expect(migrationSql).toContain("WHEN OLD.status = 'pending' AND NEW.status = 'rejected'");
    expect(migrationSql).toMatch(/points_balance\s*=\s*points_balance\s*\+\s*OLD\.points_cost/i);
    expect(migrationSql).toMatch(/stock_quantity\s*\+\s*1/i);
    expect(migrationSql).toContain("'loyalty_reward_refund'");
  });
});
