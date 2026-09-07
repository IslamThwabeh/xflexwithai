import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

const dbSource = fs.readFileSync(path.resolve(process.cwd(), "backend/db.ts"), "utf8");
const translationsSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/contexts/LanguageContext.tsx"),
  "utf8",
);
const clientSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/SupportChat.tsx"),
  "utf8",
);
const staffSource = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/AdminSupport.tsx"),
  "utf8",
);
const schemaSource = fs.readFileSync(path.resolve(process.cwd(), "database/schema-sqlite.ts"), "utf8");
const routerSource = fs.readFileSync(path.resolve(process.cwd(), "backend/routers.ts"), "utf8");
const rolesSource = fs.readFileSync(path.resolve(process.cwd(), "frontend/src/pages/AdminRoles.tsx"), "utf8");
const aliasMigration = fs.readFileSync(
  path.resolve(process.cwd(), "database/migrations/105_support_public_alias.sql"),
  "utf8",
);

describe("support sender role labels", () => {
  it("uses the requested bilingual Support Team label", () => {
    expect(translationsSource.match(/'support\.agent': 'Support Team'/g)).toHaveLength(1);
    expect(translationsSource.match(/'support\.agent': 'فريق الدعم'/g)).toHaveLength(1);
    expect(translationsSource.match(/'admin\.support\.support': 'Support Team'/g)).toHaveLength(1);
    expect(translationsSource.match(/'admin\.support\.support': 'فريق الدعم'/g)).toHaveLength(1);
  });

  it("does not join or expose internal personal names from support-message reads", () => {
    expect(dbSource).not.toContain("supportMessageWithSender");
    expect(dbSource).not.toContain('as("senderName")');
  });

  it("renders a snapshotted public alias with a generic fallback", () => {
    expect(clientSource).not.toContain("getSupportStaffDisplayName");
    expect(staffSource).not.toContain("getSupportStaffDisplayName");
    expect(clientSource).toContain("target.senderDisplayName?.trim() || t('support.agent')");
    expect(schemaSource).toContain('senderDisplayName: text("senderDisplayName"');
    expect(routerSource).toContain("senderDisplayName: isAdmin ? undefined : ctx.user.publicSupportName?.trim() || undefined");
    expect(staffSource.match(/t\('admin\.support\.support'\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("lets admins assign the public alias without changing the internal employee name", () => {
    expect(schemaSource).toContain('publicSupportName: text("publicSupportName"');
    expect(rolesSource).toContain("Name shown to clients");
    expect(routerSource).toContain("updateStaffPublicSupportName");

    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE supportMessages (id INTEGER PRIMARY KEY, senderType TEXT NOT NULL);
    `);
    database.exec(aliasMigration);
    const userColumns = database.prepare("PRAGMA table_info(users)").all().map((column: any) => column.name);
    const messageColumns = database.prepare("PRAGMA table_info(supportMessages)").all().map((column: any) => column.name);
    expect(userColumns).toContain("publicSupportName");
    expect(messageColumns).toContain("senderDisplayName");
    database.close();
  });
});
