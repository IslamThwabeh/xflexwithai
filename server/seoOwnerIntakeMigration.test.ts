import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../database/migrations/087_seo_owner_intake.sql", import.meta.url)
);

describe("SEO owner intake migration", () => {
  const migrationSql = readFileSync(migrationPath, "utf8");

  it("creates an additive singleton intake and isolated answer rows", () => {
    const statementsOnly = migrationSql.replace(/^--.*$/gm, "");
    expect(statementsOnly).not.toMatch(
      /(?:^|;)\s*(?:ALTER|DROP|DELETE|UPDATE)\b/im
    );
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS seo_owner_intake"
    );
    expect(migrationSql).toContain("CHECK (id = 1)");
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS seo_owner_intake_answers"
    );
    expect(migrationSql).toContain("question_id TEXT PRIMARY KEY");
    expect(migrationSql).toContain("length(answer_text) <= 5000");
  });

  it("seeds one draft and preserves unrelated answers during autosave", async () => {
    const imported = await import("better-sqlite3");
    const Database = (imported.default ?? imported) as any;
    const database = new Database(":memory:");
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE admins (id INTEGER PRIMARY KEY);
        INSERT INTO admins (id) VALUES (1), (2);
        ${migrationSql}
      `);
      expect(
        database.prepare("SELECT id, status FROM seo_owner_intake").all()
      ).toEqual([{ id: 1, status: "draft" }]);

      database
        .prepare(
          `
        INSERT INTO seo_owner_intake_answers (question_id, answer_text, updated_by_admin_id)
        VALUES ('q01', 'XFlex', 1), ('q02', 'Legal name', 1)
      `
        )
        .run();
      database
        .prepare(
          `
        INSERT INTO seo_owner_intake_answers (question_id, answer_text, updated_by_admin_id)
        VALUES ('q01', 'XFlex Academy', 2)
        ON CONFLICT(question_id) DO UPDATE SET
          answer_text = excluded.answer_text,
          updated_by_admin_id = excluded.updated_by_admin_id,
          updated_at = datetime('now')
      `
        )
        .run();

      expect(
        database
          .prepare(
            `
        SELECT question_id AS questionId, answer_text AS answerText
        FROM seo_owner_intake_answers ORDER BY question_id
      `
          )
          .all()
      ).toEqual([
        { questionId: "q01", answerText: "XFlex Academy" },
        { questionId: "q02", answerText: "Legal name" },
      ]);

      expect(() =>
        database
          .prepare(
            `
        INSERT INTO seo_owner_intake_answers (question_id, answer_text)
        VALUES ('too-long', ?)
      `
          )
          .run("x".repeat(5001))
      ).toThrow();
    } finally {
      database.close();
    }
  });
});
