import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { readFileSync } from 'node:fs';
import { createLocalD1Database } from '../backend/_core/localD1';
import { deliverStudentSupportWelcome } from '../backend/services/student-welcome.service';
import { isSupportWorkingHours, STUDENT_WELCOME_AR, HOME_SCREEN_GUIDE_URL } from '../shared/studentWelcome';

let database: D1Database;
const migration = readFileSync(new URL('../database/migrations/134_student_support_welcome.sql', import.meta.url), 'utf8');

beforeEach(async () => {
  database = await createLocalD1Database(':memory:');
  await database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT, isStaff INTEGER DEFAULT 0, firstPackageActivatedAt TEXT);
    CREATE TABLE registrationKeys (id INTEGER PRIMARY KEY, email TEXT, activatedAt TEXT, packageId INTEGER, isRenewal INTEGER DEFAULT 0, isUpgrade INTEGER DEFAULT 0);
    CREATE TABLE supportConversations (id INTEGER PRIMARY KEY, userId INTEGER, status TEXT, createdAt TEXT, updatedAt TEXT, needsHuman INTEGER DEFAULT 0, needsHumanAt TEXT, assignedTo INTEGER, closedAt TEXT);
    CREATE TABLE supportMessages (id INTEGER PRIMARY KEY, conversationId INTEGER, senderId INTEGER, senderType TEXT, senderDisplayName TEXT, content TEXT, isRead INTEGER, createdAt TEXT, deletedAt TEXT);
    CREATE TABLE user_notifications (id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT, title_en TEXT, title_ar TEXT, content_en TEXT, content_ar TEXT, action_url TEXT, dedupe_key TEXT UNIQUE, created_at TEXT);
    CREATE TABLE email_outbox (id INTEGER PRIMARY KEY, dedupeKey TEXT UNIQUE, recipientUserId INTEGER, recipientEmail TEXT, eventType TEXT, deliveryClass TEXT, templateId TEXT, emailCategory TEXT, subject TEXT, bodyText TEXT, bodyHtml TEXT, metadataJson TEXT, status TEXT, attempts INTEGER, nextAttemptAt TEXT, createdAt TEXT, updatedAt TEXT);
    INSERT INTO users (id, email, name) VALUES (1, 'student@example.com', '<Student>');
  `);
  await database.exec(migration);
});

afterEach(() => (database as D1Database & { close(): void }).close());

async function activate(flag?: 'isRenewal' | 'isUpgrade') {
  await database.prepare(`INSERT INTO registrationKeys (id, email, activatedAt, packageId, isRenewal, isUpgrade)
    VALUES (1, 'student@example.com', '2026-11-10T10:00:00Z', 2, ?, ?)`)
    .bind(Number(flag === 'isRenewal'), Number(flag === 'isUpgrade')).run();
}
async function count(table: string) {
  return database.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>('n');
}

describe('student support welcome', () => {
  it('does not welcome an unactivated account', async () => {
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(false);
    expect(await count('supportMessages')).toBe(0);
  });

  it('atomically sends one welcome, one notification and one queued email, including concurrent retries', async () => {
    await activate();
    await Promise.all([deliverStudentSupportWelcome(database, 1), deliverStudentSupportWelcome(database, 1)]);
    await deliverStudentSupportWelcome(database, 1);
    for (const table of ['supportConversations', 'supportMessages', 'user_notifications', 'email_outbox', 'student_support_welcomes']) expect(await count(table)).toBe(1);
    const message = await database.prepare('SELECT * FROM supportMessages').first<any>();
    expect(message).toMatchObject({ senderId: 0, senderType: 'support', isRead: 0, content: STUDENT_WELCOME_AR });
    expect(message.content).toContain(HOME_SCREEN_GUIDE_URL);
    expect(message.content).toContain('٣ للساعة ٧');
    expect(message.content).toContain('ما رح يظهر عدد الرسائل');
    const conversation = await database.prepare('SELECT * FROM supportConversations').first<any>();
    expect(conversation.needsHuman).toBe(1);
    const email = await database.prepare('SELECT * FROM email_outbox').first<any>();
    expect(email).toMatchObject({ eventType: 'support_client_reply', status: 'pending', recipientEmail: 'student@example.com' });
    expect(email.bodyHtml).toContain('&lt;Student&gt;');
  });

  it('reuses a closed conversation and preserves its staff assignment and history', async () => {
    await activate();
    await database.exec(`INSERT INTO supportConversations (id, userId, status, assignedTo, closedAt) VALUES (7, 1, 'closed', 24, '2026-11-01');
      INSERT INTO supportMessages (conversationId, content) VALUES (7, 'Earlier conversation');`);
    await deliverStudentSupportWelcome(database, 1);
    expect(await count('supportConversations')).toBe(1);
    expect(await count('supportMessages')).toBe(2);
    expect(await database.prepare('SELECT status, assignedTo, closedAt FROM supportConversations').first()).toEqual({ status: 'open', assignedTo: 24, closedAt: null });
    await database.exec('UPDATE supportMessages SET deletedAt = datetime(\'now\'); UPDATE supportConversations SET needsHuman = 0');
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(false);
    expect(await database.prepare('SELECT needsHuman FROM supportConversations').first<number>('needsHuman')).toBe(0);
  });

  it.each(['isRenewal', 'isUpgrade'] as const)('does not welcome a %s activation', async flag => {
    await activate(flag);
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(false);
  });

  it('does not welcome staff', async () => {
    await activate();
    await database.exec('UPDATE users SET isStaff = 1');
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(false);
  });

  it('rolls back every write on failure and recovers on the next call', async () => {
    await activate();
    await database.exec(`CREATE TRIGGER fail_email BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(ABORT, 'email unavailable'); END;`);
    await expect(deliverStudentSupportWelcome(database, 1)).rejects.toThrow();
    for (const table of ['supportConversations', 'supportMessages', 'user_notifications', 'student_support_welcomes']) expect(await count(table)).toBe(0);
    await database.exec('DROP TRIGGER fail_email');
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(true);
    expect(await count('supportMessages')).toBe(1);
  });

  it('marks pre-existing students excluded at migration without contacting them', async () => {
    await database.exec('DROP TABLE student_support_welcomes');
    await activate();
    await database.exec(migration);
    expect(await deliverStudentSupportWelcome(database, 1)).toBe(false);
    expect(await count('email_outbox')).toBe(0);
    expect(await database.prepare('SELECT delivered_at FROM student_support_welcomes').first()).toEqual({ delivered_at: null });
  });
});

describe('Jordan support hours', () => {
  it.each([
    ['2026-11-08T11:59:59Z', false], // Sunday, 14:59 Jordan
    ['2026-11-08T12:00:00Z', true],
    ['2026-11-12T15:59:59Z', true], // Thursday, 18:59 Jordan
    ['2026-11-12T16:00:00Z', false],
    ['2026-11-13T13:00:00Z', false], // Friday
    ['2026-11-14T13:00:00Z', false], // Saturday
  ])('%s => %s', (time, expected) => {
    expect(isSupportWorkingHours(new Date(time))).toBe(expected);
  });
});
