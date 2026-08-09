import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(
  new URL(`../database/migrations/${name}`, import.meta.url),
  "utf8",
);

const staffFoundationSql = readMigration("063_staff_performance_foundation.sql");
const surveyFoundationSql = readMigration("064_student_surveys_foundation.sql");
const jobFoundationSql = readMigration("068_student_job_eligibility_foundation.sql");
const actorMigrationSql = readMigration("078_signed_admin_feature_actors.sql");

type ForeignKeyRow = {
  table: string;
  from: string;
  to: string;
};

function foreignKeys(sqlite: Database.Database, table: string): ForeignKeyRow[] {
  return sqlite.prepare(`PRAGMA foreign_key_list("${table}")`).all() as ForeignKeyRow[];
}

function namedIndexes(sqlite: Database.Database, tables: string[]): string[] {
  return (sqlite.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'index'
      AND tbl_name IN (${tables.map(() => "?").join(", ")})
      AND name NOT LIKE 'sqlite_autoindex_%'
    ORDER BY name
  `).all(...tables) as Array<{ name: string }>).map((row) => row.name);
}

describe("signed admin feature actor migration", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      );

      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY
      );

      CREATE TABLE admin_settings (
        settingKey TEXT PRIMARY KEY,
        settingValue TEXT,
        updatedAt TEXT
      );
    `);
    sqlite.exec(staffFoundationSql);
    sqlite.exec(surveyFoundationSql);
    sqlite.exec(jobFoundationSql);

    sqlite.exec(`
      INSERT INTO users (id, email) VALUES
        (10, 'manager@example.test'),
        (20, 'student@example.test'),
        (30, 'second-student@example.test');
      INSERT INTO jobs (id) VALUES (40), (41);

      INSERT INTO staff_performance_monthly_plans (
        id, staff_user_id, month, title, status, version, created_by_user_id
      ) VALUES (100, 20, '2026-07', 'July plan', 'draft', 1, 10);
      INSERT INTO staff_performance_goals (
        id, plan_id, title, expected_result, weight, sort_order, created_by_user_id
      ) VALUES (110, 100, 'Student follow-up', 'Ten calls', 100, 0, 10);
      INSERT INTO staff_performance_daily_logs (
        id, staff_user_id, local_date, status, version
      ) VALUES (120, 20, '2026-07-31', 'draft', 1);
      INSERT INTO staff_performance_daily_tasks (
        id, daily_log_id, monthly_goal_id, title, expected_output, completed
      ) VALUES (130, 120, 110, 'Call students', 'Ten calls', 0);
      INSERT INTO staff_performance_audit_logs (
        id, entity_type, entity_id, staff_user_id, actor_user_id, action
      ) VALUES (140, 'monthly_plan', 100, 20, 10, 'created');

      INSERT INTO student_surveys (
        id, code, title, created_by_user_id
      ) VALUES (200, 'existing-survey', 'Existing survey', 10);
      INSERT INTO student_survey_questions (
        id, survey_id, question_text, question_type
      ) VALUES (210, 200, 'How was the lesson?', 'short_text');
      INSERT INTO student_survey_assignments (
        id, survey_id, user_id, due_at, block_at, created_by_user_id
      ) VALUES (
        220, 200, 20, '2026-08-01T10:00:00.000Z',
        '2026-08-03T10:00:00.000Z', 10
      );
      INSERT INTO student_survey_answers (
        id, assignment_id, question_id, answer_text
      ) VALUES (230, 220, 210, 'Helpful');
      INSERT INTO student_survey_audit_logs (
        id, entity_type, entity_id, survey_id, user_id, actor_user_id, action
      ) VALUES (240, 'assignment', 220, 200, 20, 10, 'assigned');

      INSERT INTO student_job_eligibility_rules (
        id, job_id, created_by_user_id, updated_by_user_id
      ) VALUES (300, 40, 10, 10);
      INSERT INTO student_job_eligibility_reviews (
        id, user_id, job_id, status, reviewed_by_user_id
      ) VALUES (310, 20, 40, 'eligible', 10);
      INSERT INTO student_job_eligibility_audit_logs (
        id, user_id, job_id, actor_user_id, action
      ) VALUES (320, 20, 40, 10, 'review_decision');

      UPDATE sqlite_sequence
      SET seq = seq + 1000
      WHERE name IN (
        'staff_performance_monthly_plans',
        'staff_performance_goals',
        'staff_performance_daily_tasks',
        'staff_performance_audit_logs',
        'student_surveys',
        'student_survey_questions',
        'student_survey_assignments',
        'student_survey_answers',
        'student_survey_audit_logs',
        'student_job_eligibility_rules',
        'student_job_eligibility_reviews',
        'student_job_eligibility_audit_logs'
      );
    `);

    sqlite.exec("BEGIN");
    try {
      sqlite.exec(actorMigrationSql);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  });

  afterEach(() => {
    sqlite.close();
  });

  it("preserves every dependent row and relationship", () => {
    expect(sqlite.prepare(`
      SELECT created_by_user_id AS actor
      FROM staff_performance_monthly_plans
      WHERE id = 100
    `).get()).toEqual({ actor: 10 });
    expect(sqlite.prepare(`
      SELECT monthly_goal_id AS goalId
      FROM staff_performance_daily_tasks
      WHERE id = 130
    `).get()).toEqual({ goalId: 110 });
    expect(sqlite.prepare(`
      SELECT assignment_id AS assignmentId, question_id AS questionId, answer_text AS answer
      FROM student_survey_answers
      WHERE id = 230
    `).get()).toEqual({ assignmentId: 220, questionId: 210, answer: "Helpful" });
    expect(sqlite.prepare(`
      SELECT created_by_user_id AS createdBy, updated_by_user_id AS updatedBy
      FROM student_job_eligibility_rules
      WHERE id = 300
    `).get()).toEqual({ createdBy: 10, updatedBy: 10 });
    expect(sqlite.prepare(`
      SELECT name, seq
      FROM sqlite_sequence
      WHERE name IN (
        'staff_performance_monthly_plans',
        'student_survey_answers',
        'student_job_eligibility_audit_logs'
      )
      ORDER BY name
    `).all()).toEqual([
      { name: "staff_performance_monthly_plans", seq: 1100 },
      { name: "student_job_eligibility_audit_logs", seq: 1320 },
      { name: "student_survey_answers", seq: 1230 },
    ]);
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("accepts signed full-admin actors without weakening subject foreign keys", () => {
    sqlite.exec(`
      INSERT INTO staff_performance_monthly_plans (
        staff_user_id, month, title, created_by_user_id
      ) VALUES (20, '2026-08', 'Admin-authored plan', -1);
      INSERT INTO staff_performance_goals (
        plan_id, title, expected_result, weight, created_by_user_id
      ) VALUES (100, 'Admin goal', 'Reviewed result', 0, -1);
      INSERT INTO staff_performance_audit_logs (
        entity_type, entity_id, staff_user_id, actor_user_id, action
      ) VALUES ('monthly_plan', 100, 20, -1, 'updated');

      INSERT INTO student_surveys (code, title, created_by_user_id)
      VALUES ('admin-survey', 'Admin survey', -1);
      INSERT INTO student_survey_assignments (
        survey_id, user_id, due_at, block_at, created_by_user_id
      ) VALUES (
        200, 30, '2026-08-02T10:00:00.000Z',
        '2026-08-04T10:00:00.000Z', -1
      );
      INSERT INTO student_survey_audit_logs (
        entity_type, entity_id, survey_id, user_id, actor_user_id, action
      ) VALUES ('survey', 200, 200, 20, -1, 'updated');

      INSERT INTO student_job_eligibility_rules (
        job_id, created_by_user_id, updated_by_user_id
      ) VALUES (41, -1, -1);
      UPDATE student_job_eligibility_reviews
      SET reviewed_by_user_id = -1
      WHERE id = 310;
      INSERT INTO student_job_eligibility_audit_logs (
        user_id, job_id, actor_user_id, action
      ) VALUES (20, 40, -1, 'review_decision');
    `);

    expect(sqlite.prepare(`
      SELECT created_by_user_id AS actor
      FROM staff_performance_monthly_plans
      WHERE month = '2026-08'
    `).get()).toEqual({ actor: -1 });
    expect(sqlite.prepare(`
      SELECT reviewed_by_user_id AS actor
      FROM student_job_eligibility_reviews
      WHERE id = 310
    `).get()).toEqual({ actor: -1 });

    expect(() => sqlite.exec(`
      INSERT INTO staff_performance_monthly_plans (
        staff_user_id, month, title, created_by_user_id
      ) VALUES (9999, '2026-09', 'Invalid owner', -1);
    `)).toThrow(/FOREIGN KEY constraint failed/i);
    expect(() => sqlite.exec(`
      INSERT INTO student_survey_assignments (
        survey_id, user_id, due_at, block_at, created_by_user_id
      ) VALUES (
        200, 9999, '2026-08-05T10:00:00.000Z',
        '2026-08-06T10:00:00.000Z', -1
      );
    `)).toThrow(/FOREIGN KEY constraint failed/i);
    expect(() => sqlite.exec(`
      INSERT INTO student_job_eligibility_reviews (
        user_id, job_id, reviewed_by_user_id
      ) VALUES (9999, 40, -1);
    `)).toThrow(/FOREIGN KEY constraint failed/i);
  });

  it("removes only actor foreign keys and retains named indexes and checks", () => {
    const actorColumnsByTable: Record<string, string[]> = {
      staff_performance_monthly_plans: ["created_by_user_id"],
      staff_performance_goals: ["created_by_user_id"],
      staff_performance_audit_logs: ["actor_user_id"],
      student_surveys: ["created_by_user_id"],
      student_survey_assignments: ["created_by_user_id"],
      student_survey_audit_logs: ["actor_user_id"],
      student_job_eligibility_rules: ["created_by_user_id", "updated_by_user_id"],
      student_job_eligibility_reviews: ["reviewed_by_user_id"],
      student_job_eligibility_audit_logs: ["actor_user_id"],
    };
    for (const [table, actorColumns] of Object.entries(actorColumnsByTable)) {
      expect(foreignKeys(sqlite, table).filter((key) => actorColumns.includes(key.from)))
        .toEqual([]);
    }

    expect(foreignKeys(sqlite, "staff_performance_monthly_plans"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ table: "users", from: "staff_user_id", to: "id" }),
      ]));
    expect(foreignKeys(sqlite, "student_survey_assignments"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ table: "users", from: "user_id", to: "id" }),
        expect.objectContaining({ table: "student_surveys", from: "survey_id", to: "id" }),
      ]));
    expect(foreignKeys(sqlite, "student_job_eligibility_reviews"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ table: "jobs", from: "job_id", to: "id" }),
        expect.objectContaining({ table: "users", from: "user_id", to: "id" }),
      ]));

    expect(namedIndexes(sqlite, [
      "staff_performance_monthly_plans",
      "staff_performance_goals",
      "staff_performance_daily_tasks",
      "staff_performance_audit_logs",
      "student_surveys",
      "student_survey_questions",
      "student_survey_assignments",
      "student_survey_answers",
      "student_survey_audit_logs",
      "student_job_eligibility_rules",
      "student_job_eligibility_reviews",
      "student_job_eligibility_audit_logs",
    ])).toEqual([
      "idx_staff_performance_audit_entity",
      "idx_staff_performance_audit_staff",
      "idx_staff_performance_daily_tasks_goal",
      "idx_staff_performance_daily_tasks_log",
      "idx_staff_performance_goals_plan",
      "idx_staff_performance_monthly_plans_staff_month",
      "idx_staff_performance_monthly_plans_status",
      "idx_student_job_audit_user_job",
      "idx_student_job_reviews_job_status",
      "idx_student_job_reviews_user",
      "idx_student_job_rules_job",
      "idx_student_survey_answers_assignment",
      "idx_student_survey_assignments_blocking",
      "idx_student_survey_assignments_user_status",
      "idx_student_survey_audit_entity",
      "idx_student_survey_audit_user",
      "idx_student_survey_questions_survey",
      "idx_student_surveys_active",
    ]);

    expect(() => sqlite.exec(`
      INSERT INTO staff_performance_monthly_plans (
        staff_user_id, month, title, status, created_by_user_id
      ) VALUES (20, '2026-10', 'Bad status', 'unknown', -1);
    `)).toThrow(/CHECK constraint failed/i);
    expect(() => sqlite.exec(`
      INSERT INTO student_survey_questions (
        survey_id, question_text, question_type
      ) VALUES (200, 'Invalid type', 'boolean');
    `)).toThrow(/CHECK constraint failed/i);
    expect(() => sqlite.exec(`
      INSERT INTO student_job_eligibility_reviews (user_id, job_id, status)
      VALUES (30, 40, 'unknown');
    `)).toThrow(/CHECK constraint failed/i);
  });
});
