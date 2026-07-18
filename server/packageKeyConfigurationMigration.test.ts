import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/072_package_key_configuration_audit.sql", import.meta.url),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("package key configuration audit migration", () => {
  it("adds editor metadata and an append-only configuration history", () => {
    expect(migrationSql).toContain("ALTER TABLE registrationKeys ADD COLUMN configurationNotes TEXT");
    expect(migrationSql).toContain("ALTER TABLE registrationKeys ADD COLUMN configurationUpdatedByType TEXT");
    expect(migrationSql).toContain("ALTER TABLE registrationKeys ADD COLUMN configurationUpdatedById INTEGER");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS package_key_configuration_history");
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_no_update");
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_no_delete");
    expect(migrationSql).toContain("RAISE(ABORT, 'package_key_configuration_history_append_only')");
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_insert");
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS package_key_configuration_history_update");
    expect(migrationSql).toContain("COALESCE(NEW.configurationUpdatedById, NEW.assignedById, NEW.createdBy, 0)");
  });

  it("enforces activated-key immutability at the database boundary", () => {
    expect(migrationSql).toContain("CREATE TRIGGER IF NOT EXISTS package_key_configuration_activated_immutable");
    expect(migrationSql).toContain("WHEN OLD.activatedAt IS NOT NULL");
    expect(migrationSql).toContain("RAISE(ABORT, 'activated_package_key_configuration_immutable')");
  });
});
