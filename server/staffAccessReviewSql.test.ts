import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Sqlite from "better-sqlite3";
import { createLocalD1Database } from "../backend/_core/localD1";
import { getDb, hasStaffTrainingEnrollment } from "../backend/db";

const directory = mkdtempSync(join(tmpdir(), "xflex-staff-review-"));
const filename = join(directory, "fixture.sqlite");
const sqlite = new Sqlite(filename);
const queries: Array<{ sql: string; params: unknown[] }> = [];
let local: Awaited<ReturnType<typeof createLocalD1Database>>;
beforeAll(async () => {
  // Physical production column names and existing composite index. Orphans must
  // not expose training that the real myEnrollments inner join cannot return.
  sqlite.exec(`CREATE TABLE courses(id INTEGER PRIMARY KEY);
    CREATE TABLE enrollments(id INTEGER PRIMARY KEY,userId INTEGER NOT NULL,courseId INTEGER NOT NULL);
    CREATE INDEX idx_enrollments_user_course ON enrollments(userId,courseId);
    INSERT INTO courses VALUES(1);
    WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<10000)
      INSERT INTO enrollments SELECT x,x+1000,1 FROM n;
    INSERT INTO enrollments VALUES(10001,42,1),(10002,43,999);`);
  local = await createLocalD1Database(filename);
  await getDb({
    DB: {
      prepare(sql: string) {
        const statement = local.prepare(sql);
        return {
          ...statement,
          bind(...params: any[]) {
            queries.push({ sql, params });
            return statement.bind(...params);
          },
        };
      },
    } as any,
  });
});
afterAll(() => {
  local?.close();
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});
describe("bounded staff training presence query", () => {
  it("keeps employee boundaries and matches the real enrollment/course join", async () => {
    expect(await hasStaffTrainingEnrollment(42)).toBe(true);
    expect(await hasStaffTrainingEnrollment(43)).toBe(false);
    expect(await hasStaffTrainingEnrollment(99999)).toBe(false);
    expect(queries).toHaveLength(3);
  });
  it("uses the enrollment user index plus course primary key without a table scan", () => {
    for (const query of queries) {
      const plan = sqlite
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .all(...query.params) as Array<{ detail: string }>;
      expect(
        plan.some(row => row.detail.includes("idx_enrollments_user_course"))
      ).toBe(true);
      expect(
        plan.some(row =>
          /SEARCH courses USING INTEGER PRIMARY KEY/.test(row.detail)
        )
      ).toBe(true);
      expect(plan.some(row => /SCAN/.test(row.detail))).toBe(false);
      expect(query.params.at(-1)).toBe(1);
    }
  });
});
