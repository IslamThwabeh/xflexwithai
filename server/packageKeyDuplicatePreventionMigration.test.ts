import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

const migration = readFileSync(new URL('../database/migrations/094_prevent_duplicate_unused_package_keys.sql', import.meta.url), 'utf8');

describe('duplicate unused package-key prevention migration', () => {
  it('preserves historical duplicates but rejects new assigned duplicates', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE registrationKeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packageId INTEGER,
      email TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      activatedAt TEXT,
      isUpgrade INTEGER DEFAULT 0,
      isRenewal INTEGER DEFAULT 0
    );`);
    sqlite.exec(`INSERT INTO registrationKeys (packageId, email) VALUES
      (1, 'student@example.com'),
      (1, 'STUDENT@example.com');`);
    expect(() => sqlite.exec(migration)).not.toThrow();
    expect(() => sqlite.prepare('INSERT INTO registrationKeys (packageId, email) VALUES (?, ?)').run(1, ' student@example.com ')).toThrow(/duplicate active unused package key/);
    expect(() => sqlite.prepare('INSERT INTO registrationKeys (packageId, email, activatedAt) VALUES (?, ?, ?)').run(1, 'student@example.com', '2026-08-30T00:00:00Z')).not.toThrow();
    expect(() => sqlite.prepare('INSERT INTO registrationKeys (packageId, email) VALUES (?, ?)').run(2, 'student@example.com')).not.toThrow();
    sqlite.close();
  });

  it('also blocks assigning or reactivating a conflicting unused key', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE registrationKeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packageId INTEGER,
      email TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      activatedAt TEXT,
      isUpgrade INTEGER DEFAULT 0,
      isRenewal INTEGER DEFAULT 0
    );`);
    sqlite.exec(migration);
    sqlite.prepare('INSERT INTO registrationKeys (packageId, email) VALUES (?, ?)').run(1, 'student@example.com');
    const inventory = sqlite.prepare('INSERT INTO registrationKeys (packageId, email) VALUES (?, NULL)').run(1).lastInsertRowid;
    expect(() => sqlite.prepare('UPDATE registrationKeys SET email = ? WHERE id = ?').run('student@example.com', inventory)).toThrow(/duplicate active unused package key/);
    sqlite.close();
  });
});
