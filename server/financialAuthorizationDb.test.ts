import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import { isFinanceOwnerAdmin, removeStaffStatus, setFinanceRoleAssignment } from '../backend/db';

const temporaryDirectories: string[] = [];
const foundationMigration = readFileSync(new URL('../database/migrations/106_financial_management_foundation.sql', import.meta.url), 'utf8');
const ownerMigration = readFileSync(new URL('../database/migrations/109_explicit_finance_owner_authority.sql', import.meta.url), 'utf8');

async function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'xflex-finance-authorization-'));
  temporaryDirectories.push(directory);
  const filename = join(directory, 'test.db');
  const sqlite = new Database(filename);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE admins (id INTEGER PRIMARY KEY);
    CREATE TABLE users (id INTEGER PRIMARY KEY, isStaff INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE userRoles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      role TEXT NOT NULL,
      assignedBy INTEGER,
      assignedAt TEXT NOT NULL,
      UNIQUE(userId, role)
    );
    CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE orderItems (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY);
    CREATE TABLE account_refunds (id INTEGER PRIMARY KEY);
    CREATE TABLE schema_migrations (migration_name TEXT NOT NULL UNIQUE, source TEXT NOT NULL, notes TEXT, applied_at TEXT);
    INSERT INTO admins (id) VALUES (1), (2);
    INSERT INTO users (id, isStaff) VALUES (40, 1), (41, 1);
  `);
  sqlite.exec(foundationMigration);
  sqlite.exec(ownerMigration);
  sqlite.close();
  const database = await createLocalD1Database(filename);
  return { database, orm: drizzle(database) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('financial authorization database boundary', () => {
  it('resolves only the explicitly bootstrapped owner', async () => {
    const { database, orm } = await createFixture();
    try {
      await expect(isFinanceOwnerAdmin(1, orm)).resolves.toBe(true);
      await expect(isFinanceOwnerAdmin(2, orm)).resolves.toBe(false);
    } finally {
      (database as any).close();
    }
  });

  it('revokes finance roles and records immutable audit in the same batch', async () => {
    const { database, orm } = await createFixture();
    try {
      await setFinanceRoleAssignment({
        userId: 40,
        role: 'finance_clerk',
        action: 'assigned',
        performedByAdminId: 1,
      }, orm);
      await removeStaffStatus(40, 1, orm);

      expect(await database.prepare('SELECT COUNT(*) AS total FROM userRoles WHERE userId = 40').first('total')).toBe(0);
      expect(await database.prepare('SELECT isStaff FROM users WHERE id = 40').first('isStaff')).toBe(0);
      const auditRows = await database.prepare("SELECT action FROM financial_role_assignment_audit WHERE user_id = 40 ORDER BY id").all();
      expect(auditRows.results).toEqual([{ action: 'assigned' }, { action: 'removed' }]);
    } finally {
      (database as any).close();
    }
  });

  it('refuses to erase finance staff access without an accountable admin actor', async () => {
    const { database, orm } = await createFixture();
    try {
      await setFinanceRoleAssignment({
        userId: 41,
        role: 'finance_viewer',
        action: 'assigned',
        performedByAdminId: 1,
      }, orm);
      await expect(removeStaffStatus(41, undefined, orm)).rejects.toThrow(/accountable admin actor/i);
      expect(await database.prepare('SELECT COUNT(*) AS total FROM userRoles WHERE userId = 41').first('total')).toBe(1);
      expect(await database.prepare('SELECT isStaff FROM users WHERE id = 41').first('isStaff')).toBe(1);
    } finally {
      (database as any).close();
    }
  });
});
