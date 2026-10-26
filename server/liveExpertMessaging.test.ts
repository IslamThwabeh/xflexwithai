import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/d1';
import { createLocalD1Database } from '../backend/_core/localD1';
import { getLiveExpertMessagingWindow } from '../shared/liveExpert';

vi.mock('../backend/db', () => ({
  getDb: vi.fn(), getAnyLivePackageEntitlement: vi.fn(), getUserById: vi.fn(),
  getAdminById: vi.fn(), hasAnyRole: vi.fn(), getUserTermsAcceptanceStatus: vi.fn(), logAdminAction: vi.fn(),
}));
import * as db from '../backend/db';
import { liveExpertRouter } from '../backend/live-expert.router';
import { cleanupPendingExpertImages, validateExpertImage } from '../backend/services/live-expert.service';

const directory = mkdtempSync(join(tmpdir(), 'live-expert-test-'));
const filename = join(directory, 'test.db');
const sqlite = new Database(filename);
const migration = readFileSync(new URL('../database/migrations/130_live_expert_messaging.sql', import.meta.url), 'utf8');
let localD1: Awaited<ReturnType<typeof createLocalD1Database>>;
const images = new Map<string, Uint8Array>();
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=';

function caller(id: number | null) {
  const row = id && id > 0 ? sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as any : null;
  return liveExpertRouter.createCaller({
    req: { headers: {}, method: 'POST' },
    user: id === null ? null : id < 0 ? { id, name: 'Admin', email: 'admin@example.test', isStaff: true } : { ...row, isStaff: Boolean(row?.isStaff) },
    setCookie() {}, clearCookie() {},
  } as any);
}
async function open(id = 1) { return caller(id).openConversation(); }
async function send(id: number, conversationId: number, content = 'Question') {
  return caller(id).send({ conversationId, content, nonce: crypto.randomUUID() });
}

beforeAll(async () => {
  sqlite.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, publicSupportName TEXT, isStaff INTEGER DEFAULT 0, login_blocked_at TEXT);
    CREATE TABLE userRoles (userId INTEGER, role TEXT, UNIQUE(userId, role));
    CREATE TABLE admin_settings (settingKey TEXT UNIQUE, settingValue TEXT);
    CREATE TABLE live_package_entitlements (id INTEGER PRIMARY KEY, userId INTEGER, packageId INTEGER DEFAULT 1, cohortKey TEXT, sessionEndsAt TEXT, isActive INTEGER DEFAULT 1);
    CREATE TABLE schema_migrations (migration_name TEXT UNIQUE, source TEXT, notes TEXT);
  `);
  sqlite.exec(migration);
  sqlite.exec(migration);
  localD1 = await createLocalD1Database(filename);
  vi.mocked(db.getDb).mockResolvedValue(drizzle(localD1));
  vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({ requiresAcceptance: false } as any);
  vi.mocked(db.getAnyLivePackageEntitlement).mockImplementation(async (id, cohort) => sqlite.prepare(`SELECT * FROM live_package_entitlements WHERE userId = ? ${cohort ? 'AND cohortKey = ?' : ''} ORDER BY id DESC LIMIT 1`).get(...(cohort ? [id, cohort] : [id])) as any);
  vi.mocked(db.getUserById).mockImplementation(async id => {
    const row = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return row ? { ...row, loginBlockedAt: row.login_blocked_at } : undefined;
  });
  vi.mocked(db.getAdminById).mockImplementation(async id => id === 1 ? { id, name: 'Admin' } as any : undefined);
  vi.mocked(db.hasAnyRole).mockImplementation(async (id, roles) => roles.some(role => Boolean(sqlite.prepare('SELECT 1 FROM userRoles WHERE userId = ? AND role = ?').get(id, role))));
  (globalThis as any).ENV = { LIVE_EXPERT_ATTACHMENTS_BUCKET: {
    put: async (key: string, value: Uint8Array) => { images.set(key, new Uint8Array(value)); return {}; },
    get: async (key: string) => images.has(key) ? { arrayBuffer: async () => images.get(key)!.buffer } : null,
    delete: async (key: string) => { images.delete(key); },
  } };
});

beforeEach(() => {
  sqlite.exec('UPDATE live_expert_settings SET expert_user_id = NULL');
  sqlite.exec(`DELETE FROM live_expert_attachments; DELETE FROM live_expert_messages; DELETE FROM live_expert_conversations; DELETE FROM live_package_entitlements; DELETE FROM userRoles; DELETE FROM users; DELETE FROM admin_settings;
    INSERT INTO users (id,name,email,isStaff) VALUES (1,'Client A','a@example.test',0),(2,'Client B','b@example.test',0),(10,'live','live@example.test',1),(11,'Other expert','other@example.test',1),(12,'Support','support@example.test',1);
    INSERT INTO userRoles VALUES (10,'live_expert'),(11,'live_expert'),(12,'support');
    UPDATE live_expert_settings SET expert_user_id = 10, grace_days = 7 WHERE id = 1;
    INSERT INTO admin_settings VALUES ('package_live_cohort_key','cohort-a'),('package_live_cohort_status','in_progress'),('package_live_session_ends_at','2099-01-01T00:00:00.000Z');
    INSERT INTO live_package_entitlements (id,userId,cohortKey,sessionEndsAt) VALUES (1,1,'cohort-a','2099-01-01T00:00:00.000Z'),(2,2,'cohort-a','2099-01-01T00:00:00.000Z');
  `);
  images.clear();
  vi.mocked(db.logAdminAction).mockClear();
});
afterAll(() => {
  (localD1 as any)?.close(); sqlite.close();
  if (!directory.startsWith(join(tmpdir(), 'live-expert-test-'))) throw new Error('Unexpected test cleanup directory');
  rmSync(directory, { recursive: true, force: true });
  delete (globalThis as any).ENV;
});

describe('Live Expert messaging with real SQLite/D1 transactions', () => {
  it('applies idempotently and does not create threads during workspace reads', async () => {
    expect(sqlite.prepare('SELECT count(*) AS n FROM schema_migrations').get()).toEqual({ n: 1 });
    const workspace = await caller(1).myWorkspace();
    expect(workspace.canSend).toBe(true); expect(workspace.thread).toBeNull();
    expect(sqlite.prepare('SELECT count(*) AS n FROM live_expert_conversations').get()).toEqual({ n: 0 });
    const first = await open(); const second = await open(); expect(first.id).toBe(second.id);
  });
  it('rejects guests, unenrolled clients, and general support inbox access', async () => {
    await expect(caller(null).myWorkspace()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    sqlite.prepare('DELETE FROM live_package_entitlements WHERE userId = 2').run();
    await expect(open(2)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(12).inbox()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(1).settings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('isolates clients and only allows the assigned expert or admin to open a thread', async () => {
    const thread = await open(); await send(1, thread.id);
    for (const id of [2, 11, 12]) {
      await expect(caller(id).messages({ conversationId: thread.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(send(id, thread.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(caller(id).markRead({ conversationId: thread.id, throughId: 9999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect((await caller(11).inbox()).items).toHaveLength(0);
    expect((await caller(10).messages({ conversationId: thread.id })).messages).toHaveLength(1);
    expect((await caller(-1).messages({ conversationId: thread.id })).messages).toHaveLength(1);
  });
  it('tracks unanswered threads and independent read cursors without admin reads consuming unread', async () => {
    const thread = await open(); const question = await send(1, thread.id);
    expect((await caller(10).inbox()).items[0].unread).toBe(1);
    await caller(-1).markRead({ conversationId: thread.id, throughId: question!.id });
    expect((await caller(10).inbox()).items[0].unread).toBe(1);
    await caller(10).markRead({ conversationId: thread.id, throughId: question!.id });
    expect((await caller(10).inbox()).items[0].unread).toBe(0);
    expect((await caller(10).inbox({ unansweredOnly: true })).items).toHaveLength(1);
    const reply = await send(10, thread.id, 'Here is some help');
    expect((await caller(1).myWorkspace()).unread).toBe(1);
    expect((await caller(10).inbox({ unansweredOnly: true })).items).toHaveLength(0);
    await caller(1).markRead({ conversationId: thread.id, throughId: reply!.id });
    expect((await caller(1).myWorkspace()).unread).toBe(0);
  });
  it('keeps prior messages readable after expiry/revocation and denies new messages/uploads', async () => {
    const thread = await open(); await send(1, thread.id);
    sqlite.exec("UPDATE live_package_entitlements SET isActive = 0 WHERE userId = 1");
    expect((await caller(1).myWorkspace()).canSend).toBe(false);
    expect((await caller(1).messages({ conversationId: thread.id })).messages).toHaveLength(1);
    await expect(send(1, thread.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(10).uploadImage({ conversationId: thread.id, data: png, contentType: 'image/png', fileName: 'help.png' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    sqlite.exec("UPDATE live_package_entitlements SET isActive = 1; UPDATE admin_settings SET settingValue = '2020-01-01T00:00:00.000Z' WHERE settingKey = 'package_live_session_ends_at'");
    await expect(send(10, thread.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('supports bounded history and delta cursors without gaps or duplicates', async () => {
    const thread = await open();
    const insert = sqlite.prepare("INSERT INTO live_expert_messages (conversation_id,sender_id,sender_role,sender_name,content,client_nonce,created_at) VALUES (?,1,'client','Client A',?,?,?)");
    for (let i = 0; i < 125; i++) insert.run(thread.id, String(i), crypto.randomUUID(), new Date().toISOString());
    const newest = await caller(1).messages({ conversationId: thread.id });
    expect(newest.messages).toHaveLength(50); expect(newest.hasMore).toBe(true); expect(newest.messages[0].content).toBe('75');
    const older = await caller(1).messages({ conversationId: thread.id, beforeId: newest.messages[0].id });
    expect(older.messages[0].content).toBe('25');
    const delta = await caller(1).messages({ conversationId: thread.id, afterId: older.messages.at(-1)!.id });
    expect(delta.messages.map(row => row.id)).toEqual(newest.messages.map(row => row.id));
  });
  it('deduplicates retried messages and enforces message limits', async () => {
    const thread = await open(); const input = { conversationId: thread.id, content: 'Hello', nonce: crypto.randomUUID() };
    const [a,b] = await Promise.all([caller(1).send(input), caller(1).send(input)]);
    expect(a!.id).toBe(b!.id); expect((await caller(1).messages({ conversationId: thread.id })).messages).toHaveLength(1);
    await expect(caller(1).send({ ...input, nonce: crypto.randomUUID(), content: ' ' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    for (let i = 1; i < 20; i++) await send(1, thread.id);
    await expect(send(1, thread.id)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
  it('stores screenshots privately, validates formats, and forbids cross-thread access or attachment reuse', async () => {
    const thread = await open(); const other = await open(2);
    const attachment = await caller(1).uploadImage({ conversationId: thread.id, data: png, contentType: 'image/png', fileName: 'help.png' });
    await expect(caller(2).image({ id: attachment.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(caller(10).image({ id: attachment.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(caller(2).send({ conversationId: other.id, content: '', nonce: crypto.randomUUID(), attachmentId: attachment.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await caller(1).send({ conversationId: thread.id, content: '', nonce: crypto.randomUUID(), attachmentId: attachment.id });
    expect((await caller(10).image({ id: attachment.id })).data).toBe(png);
    expect((await caller(-1).image({ id: attachment.id })).contentType).toBe('image/png');
    await expect(caller(1).send({ conversationId: thread.id, content: '', nonce: crypto.randomUUID(), attachmentId: attachment.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller(1).deletePendingImage({ id: attachment.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(() => validateExpertImage(Buffer.from('<svg/>').toString('base64'), 'image/png')).toThrow();
    expect(() => validateExpertImage('A'.repeat(3000000), 'image/png')).toThrow();
  });
  it('removes discarded screenshots and revokes old expert access on explicit admin reassignment', async () => {
    const thread = await open(); const attachment = await caller(1).uploadImage({ conversationId: thread.id, data: png, contentType: 'image/png', fileName: 'help.png' });
    await caller(1).deletePendingImage({ id: attachment.id }); expect(images.size).toBe(0);
    await expect(caller(10).reassign({ conversationId: thread.id, expertUserId: 11 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await caller(-1).reassign({ conversationId: thread.id, expertUserId: 11 });
    await expect(caller(10).messages({ conversationId: thread.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await caller(11).inbox()).items).toHaveLength(1); expect(db.logAdminAction).toHaveBeenCalled();
  });

  it('cleans expired unsent screenshots while preserving sent images', async () => {
    const thread = await open();
    const sent = await caller(1).uploadImage({ conversationId: thread.id, data: png, contentType: 'image/png', fileName: 'sent.png' });
    await caller(1).send({ conversationId: thread.id, content: '', nonce: crypto.randomUUID(), attachmentId: sent.id });
    const expired = await caller(1).uploadImage({ conversationId: thread.id, data: png, contentType: 'image/png', fileName: 'expired.png' });
    sqlite.exec("UPDATE live_expert_attachments SET created_at = '2020-01-01T00:00:00.000Z'");
    await expect(caller(1).send({ conversationId: thread.id, content: '', nonce: crypto.randomUUID(), attachmentId: expired.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await cleanupPendingExpertImages((globalThis as any).ENV.LIVE_EXPERT_ATTACHMENTS_BUCKET)).toBe(1);
    expect(images.size).toBe(1);
    expect((await caller(10).image({ id: sent.id })).data).toBe(png);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
  it('only allows admins to configure eligible experts, and keeps existing assignments', async () => {
    const thread = await open();
    const input = { expertUserId: 11, graceDays: 14, availabilityEn: 'Sunday to Thursday', availabilityAr: 'من الأحد إلى الخميس' };
    await expect(caller(10).updateSettings(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(-1).updateSettings({ ...input, expertUserId: 12 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await caller(-1).updateSettings(input);
    expect((await caller(-1).settings()).grace_days).toBe(14);
    expect((await open()).expert_user_id).toBe(10);
    expect((await open(2)).expert_user_id).toBe(11);
    sqlite.exec('DELETE FROM userRoles WHERE userId = 10');
    await expect(send(10, thread.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(send(1, thread.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Live expert messaging window', () => {
  it('allows enrolled pre-start questions, respects grace boundaries, and fails closed on unknown completed schedules', () => {
    expect(getLiveExpertMessagingWindow({ active: true, cohortStatus: 'not_started', sessionEndsAt: '', graceDays: 7 }).canSend).toBe(true);
    const end = '2026-10-01T12:00:00.000Z'; const boundary = Date.parse(end) + 7 * 86400000;
    expect(getLiveExpertMessagingWindow({ active: true, cohortStatus: 'completed', sessionEndsAt: end, graceDays: 7, now: boundary }).canSend).toBe(true);
    expect(getLiveExpertMessagingWindow({ active: true, cohortStatus: 'completed', sessionEndsAt: end, graceDays: 7, now: boundary + 1 }).canSend).toBe(false);
    expect(getLiveExpertMessagingWindow({ active: true, cohortStatus: 'completed', sessionEndsAt: '', graceDays: 7 }).canSend).toBe(false);
  });
});
