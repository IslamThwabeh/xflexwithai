import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/066_loyalty_rewards_foundation.sql", import.meta.url),
);

describe("loyalty rewards migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("is additive and seeds the feature flag as disabled", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(/(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im);
    expect(migrationSql).toContain(
      "VALUES ('loyalty_rewards_enabled', 'false', datetime('now'))",
    );
  });

  it("creates reward catalog, redemption, and audit tables with safe constraints", () => {
    for (const table of [
      "loyalty_reward_items",
      "loyalty_reward_redemptions",
      "loyalty_reward_audit_logs",
    ]) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migrationSql).toContain("CHECK (points_cost > 0)");
    expect(migrationSql).toContain("CHECK (stock_quantity IS NULL OR stock_quantity >= 0)");
    expect(migrationSql).toContain(
      "CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled'))",
    );
    expect(migrationSql).toContain("CHECK (entity_type IN ('item', 'redemption'))");
  });
});
