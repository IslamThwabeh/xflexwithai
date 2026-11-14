import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalD1Database } from '../backend/_core/localD1';
import { getDb, getEnrollmentsByUserId } from '../backend/db';

describe('student dashboard enrollment projection', () => {
  it('returns Arabic titles and exemption state through the real indexed query', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'xflex-dashboard-query-'));
    const filename = join(directory, 'fixture.db');
    const sqlite = new Database(filename);
    // Physical columns and indexes used by the existing production query.
    sqlite.exec(`
      CREATE TABLE courses (id INTEGER PRIMARY KEY, titleEn TEXT NOT NULL, titleAr TEXT NOT NULL);
      CREATE TABLE enrollments (
        id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, courseId INTEGER NOT NULL,
        enrolledAt TEXT NOT NULL, completedAt TEXT, progressPercentage INTEGER NOT NULL,
        completedEpisodes INTEGER NOT NULL, isAdminSkipped INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_enrollments_user_course ON enrollments(userId, courseId);
      CREATE TABLE episodes (id INTEGER PRIMARY KEY, courseId INTEGER NOT NULL, "order" INTEGER NOT NULL);
      CREATE INDEX idx_episodes_course_order_id ON episodes(courseId, "order", id);
      INSERT INTO courses VALUES (1, 'Trading Course', 'كورس التداول');
      INSERT INTO enrollments VALUES (1, 7, 1, '2026-11-01', '2026-11-02', 3, 1, 1);
      INSERT INTO enrollments VALUES (2, 8, 1, '2026-11-01', NULL, 0, 0, 0);
      INSERT INTO episodes VALUES (1, 1, 1), (2, 1, 2);
    `);
    const local = await createLocalD1Database(filename);
    let executedSql = '';
    const boundary = {
      prepare(sql: string) {
        if (sql.startsWith('select')) executedSql = sql;
        return local.prepare(sql);
      },
    };
    try {
      await getDb({ DB: boundary as D1Database });
      const rows = await getEnrollmentsByUserId(7);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: 7, courseName: 'Trading Course', courseNameAr: 'كورس التداول',
        isAdminSkipped: true, progressPercentage: 3, completedEpisodes: 1, totalEpisodes: 2,
      });
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${executedSql}`).all(7) as Array<{ detail: string }>;
      expect(plan.some(row => row.detail.includes('idx_enrollments_user_course'))).toBe(true);
      expect(plan.some(row => row.detail.includes('idx_episodes_course_order_id'))).toBe(true);
      expect(plan.some(row => /SCAN enrollments/.test(row.detail))).toBe(false);
    } finally {
      (local as unknown as { close(): void }).close();
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
