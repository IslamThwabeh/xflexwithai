import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  claimEmailOutboxBatch: vi.fn(), getEmailOutboxRecipientBlockReason: vi.fn(), markEmailOutboxSent: vi.fn(), markEmailOutboxSkipped: vi.fn(), markEmailOutboxFailed: vi.fn(),
}));
vi.mock('../backend/_core/email', () => ({ sendEmail: vi.fn(), sendAdminNotificationEmail: vi.fn() }));
import * as db from '../backend/db';
import { liveExpertRouter } from '../backend/live-expert.router';
import { cleanupPendingExpertImages, validateExpertImage } from '../backend/services/live-expert.service';
import { buildLiveExpertAlertEmail, getLiveExpertAlertBlockReason } from '../backend/services/live-expert-alerts.service';
import { drainGenericEmailOutbox } from '../backend/services/email-outbox.service';
import { sendEmail } from '../backend/_core/email';
import { classifyEmailDelivery } from '../shared/emailDeliveryClasses';
import { getEmailDeliveryEventCategory } from '../shared/emailDeliveryCategories';

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
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, publicSupportName TEXT, isStaff INTEGER DEFAULT 0, login_blocked_at TEXT, notificationPrefs TEXT DEFAULT '{}', staffNotificationPrefs TEXT DEFAULT '{}');
    CREATE TABLE userRoles (userId INTEGER, role TEXT, UNIQUE(userId, role));
    CREATE TABLE admin_settings (settingKey TEXT UNIQUE, settingValue TEXT);
    CREATE TABLE live_package_entitlements (id INTEGER PRIMARY KEY, userId INTEGER, packageId INTEGER DEFAULT 1, cohortKey TEXT, sessionEndsAt TEXT, isActive INTEGER DEFAULT 1);
    CREATE TABLE schema_migrations (migration_name TEXT UNIQUE, source TEXT, notes TEXT);
    CREATE TABLE email_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT,dedupeKey TEXT NOT NULL UNIQUE,recipientUserId INTEGER,recipientEmail TEXT,eventType TEXT,deliveryClass TEXT,templateId TEXT,emailCategory TEXT,subject TEXT,bodyText TEXT,bodyHtml TEXT,metadataJson TEXT,status TEXT,attempts INTEGER,nextAttemptAt TEXT,createdAt TEXT,updatedAt TEXT);
    CREATE TABLE user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,type TEXT,title_en TEXT,title_ar TEXT,content_en TEXT,content_ar TEXT,action_url TEXT,dedupe_key TEXT,is_read INTEGER,created_at TEXT);
    CREATE UNIQUE INDEX uq_user_notifications_dedupe_key ON user_notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE TABLE staff_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,userId INTEGER,eventType TEXT,titleEn TEXT,titleAr TEXT,contentEn TEXT,contentAr TEXT,actionUrl TEXT,metadata TEXT,dedupe_key TEXT,isRead INTEGER,createdAt TEXT,archivedAt TEXT,archiveReason TEXT,archiveBatchKey TEXT);
    CREATE UNIQUE INDEX uq_staff_notifications_user_dedupe_key ON staff_notifications(userId,dedupe_key) WHERE dedupe_key IS NOT NULL;
  `);
  sqlite.exec(migration);
  sqlite.exec(migration);
  sqlite.exec(readFileSync(new URL('../database/migrations/131_live_expert_alerts.sql', import.meta.url), 'utf8'));
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
  sqlite.exec('DELETE FROM email_outbox; DELETE FROM user_notifications; DELETE FROM staff_notifications');
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
  vi.mocked(db.claimEmailOutboxBatch).mockReset();
  vi.mocked(db.getEmailOutboxRecipientBlockReason).mockResolvedValue(null);
  vi.mocked(db.markEmailOutboxSkipped).mockClear();
  vi.mocked(db.markEmailOutboxSent).mockClear();
  vi.mocked(db.markEmailOutboxFailed).mockClear();
  vi.mocked(sendEmail).mockReset();
  vi.mocked(sendEmail).mockResolvedValue({ provider: 'test', attemptedProviders: ['test'] });
});
afterAll(() => {
  (localD1 as any)?.close(); sqlite.close();
  if (!directory.startsWith(join(tmpdir(), 'live-expert-test-'))) throw new Error('Unexpected test cleanup directory');
  rmSync(directory, { recursive: true, force: true });
  delete (globalThis as any).ENV;
});
afterEach(() => vi.useRealTimers());

describe('Live Expert messaging with real SQLite/D1 transactions', () => {
  it('applies idempotently and does not create threads during workspace reads', async () => {
    expect(sqlite.prepare("SELECT count(*) AS n FROM schema_migrations WHERE migration_name = '130_live_expert_messaging.sql'").get()).toEqual({ n: 1 });
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
    const plan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT id,object_key FROM live_expert_attachments INDEXED BY idx_live_expert_attachments_pending WHERE message_id IS NULL AND created_at < ? ORDER BY created_at,id LIMIT 100").all('2026-10-25T00:00:00.000Z');
    expect(JSON.stringify(plan)).toContain('idx_live_expert_attachments_pending');
    expect(JSON.stringify(plan)).not.toContain('TEMP B-TREE');
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

describe('Live Expert email and bell alerts', () => {
  const emails = () => sqlite.prepare('SELECT * FROM email_outbox ORDER BY id').all() as any[];

  it('routes a client question only to the assigned expert and a reply only to that client', async () => {
    const thread = await open();
    await send(1, thread.id, 'Private lesson question');
    expect(emails()).toHaveLength(1);
    expect(emails()[0]).toMatchObject({ recipientUserId: 10, recipientEmail: 'live@example.test', eventType: 'live_expert_question', deliveryClass: 'urgent', emailCategory: 'transactional', status: 'pending' });
    expect(sqlite.prepare('SELECT userId,actionUrl,isRead FROM staff_notifications').all()).toEqual([{ userId: 10, actionUrl: `/admin/live-expert?conversationId=${thread.id}`, isRead: 0 }]);
    await send(10, thread.id, 'Private expert answer');
    expect(emails()).toHaveLength(2);
    expect(emails()[1]).toMatchObject({ recipientUserId: 1, recipientEmail: 'a@example.test', eventType: 'live_expert_reply' });
    expect(sqlite.prepare('SELECT user_id,action_url,is_read FROM user_notifications').all()).toEqual([{ user_id: 1, action_url: '/live-package/messages?cohortKey=cohort-a', is_read: 0 }]);
    expect(emails().every(row => !row.bodyText.includes('Private lesson question') && !row.bodyHtml.includes('Private expert answer'))).toBe(true);
    expect(classifyEmailDelivery({ eventType: emails()[0].eventType })).toBe('urgent');
    expect(getEmailDeliveryEventCategory(emails()[1].eventType)).toBe('support');
  });

  it('groups same-minute messages, coalesces bell entries, and deduplicates concurrent retries', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T12:00:10.000Z'));
    const thread = await open();
    const input = { conversationId: thread.id, content: 'Question', nonce: crypto.randomUUID() };
    await Promise.all([caller(1).send(input), caller(1).send(input)]);
    await send(1, thread.id, 'Follow-up');
    expect(emails()).toHaveLength(1);
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()).toEqual({ n: 1 });
    expect(emails()[0].nextAttemptAt).toBe('2026-10-26T12:01:00.000Z');
    vi.setSystemTime(new Date('2026-10-26T12:01:20.000Z'));
    const newest = await send(1, thread.id, 'Another question');
    expect(emails()).toHaveLength(2);
    await caller(10).markRead({ conversationId: thread.id, throughId: newest!.id });
    await caller(1).send(input);
    expect(emails()).toHaveLength(2);
    expect(sqlite.prepare('SELECT isRead FROM staff_notifications').get()).toEqual({ isRead: 1 });
  });

  it('honors email preferences independently of website notifications and rechecks them before sending', async () => {
    const thread = await open();
    sqlite.prepare('UPDATE users SET staffNotificationPrefs = ? WHERE id = 10').run(JSON.stringify({ live_expert_question: false }));
    await send(1, thread.id);
    expect(emails()).toHaveLength(0);
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()).toEqual({ n: 1 });
    sqlite.prepare('UPDATE users SET notificationPrefs = ? WHERE id = 1').run(JSON.stringify({ live_expert_replies: false }));
    await send(10, thread.id);
    expect(emails()).toHaveLength(0);
    expect(sqlite.prepare('SELECT count(*) AS n FROM user_notifications').get()).toEqual({ n: 1 });
    sqlite.exec("UPDATE users SET staffNotificationPrefs = '{}' WHERE id = 10");
    await send(1, thread.id);
    const row = emails()[0];
    expect(await getLiveExpertAlertBlockReason(row)).toBeNull();
    sqlite.prepare('UPDATE users SET staffNotificationPrefs = ? WHERE id = 10').run(JSON.stringify({ live_expert_question: false }));
    expect(await getLiveExpertAlertBlockReason(row)).toBe('live_expert_email_disabled');
  });

  it('clears bell alerts only when the recipient reads through incoming messages; admin oversight does not consume them', async () => {
    const thread = await open(); const question = await send(1, thread.id);
    await caller(-1).markRead({ conversationId: thread.id, throughId: question!.id });
    expect(sqlite.prepare('SELECT isRead FROM staff_notifications').get()).toEqual({ isRead: 0 });
    await caller(10).markRead({ conversationId: thread.id, throughId: question!.id });
    expect(sqlite.prepare('SELECT isRead FROM staff_notifications').get()).toEqual({ isRead: 1 });
    expect(await getLiveExpertAlertBlockReason(emails()[0])).toBe('live_expert_already_read');
    const reply = await send(10, thread.id);
    await caller(1).markRead({ conversationId: thread.id, throughId: question!.id });
    expect(sqlite.prepare('SELECT is_read FROM user_notifications').get()).toEqual({ is_read: 0 });
    await caller(1).markRead({ conversationId: thread.id, throughId: reply!.id });
    expect(sqlite.prepare('SELECT is_read FROM user_notifications').get()).toEqual({ is_read: 1 });
    expect(await getLiveExpertAlertBlockReason(emails()[1])).toBe('live_expert_already_read');
  });

  it('suppresses stale recipients after reassignment, role removal, email change, or account blocking', async () => {
    const thread = await open(); await send(1, thread.id);
    const row = emails()[0];
    await caller(-1).reassign({ conversationId: thread.id, expertUserId: 11 });
    expect(await getLiveExpertAlertBlockReason(row)).toBe('live_expert_access_changed');
    await send(1, thread.id);
    expect(emails()[1].recipientUserId).toBe(11);
    sqlite.exec("DELETE FROM userRoles WHERE userId = 11 AND role = 'live_expert'");
    expect(await getLiveExpertAlertBlockReason(emails()[1])).toBe('live_expert_access_changed');
    sqlite.exec("INSERT INTO userRoles VALUES (11,'live_expert'); UPDATE users SET email = 'changed@example.test' WHERE id = 11");
    expect(await getLiveExpertAlertBlockReason(emails()[1])).toBe('recipient_changed');
    sqlite.exec("UPDATE users SET login_blocked_at = '2026-10-26' WHERE id = 11");
    expect(await getLiveExpertAlertBlockReason(emails()[1])).toBe('recipient_account_disabled');
  });

  it('rolls back the message and bell alert when queue persistence fails, then safely retries', async () => {
    const thread = await open();
    const input = { conversationId: thread.id, content: 'Retry safely', nonce: crypto.randomUUID() };
    sqlite.exec("CREATE TRIGGER fail_expert_email BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(ABORT,'Synthetic email queue failure'); END");
    try { await expect(caller(1).send(input)).rejects.toThrow(); }
    finally { sqlite.exec('DROP TRIGGER fail_expert_email'); }
    expect((await caller(1).messages({ conversationId: thread.id })).messages).toHaveLength(0);
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()).toEqual({ n: 0 });
    await caller(1).send(input);
    expect(emails()).toHaveLength(1);
    expect(sqlite.prepare('SELECT alerts_enqueued FROM live_expert_messages').get()).toEqual({ alerts_enqueued: 1 });
  });

  it('delivers an eligible alert through the existing queue and skips a read alert without calling the provider', async () => {
    const thread = await open(); const question = await send(1, thread.id);
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce(emails() as any);
    expect(await drainGenericEmailOutbox({ limit: 5, deliveryClasses: ['urgent'] })).toMatchObject({ sent: 1, skipped: 0 });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'live@example.test', audit: expect.objectContaining({ eventType: 'live_expert_question' }) }));
    vi.mocked(sendEmail).mockClear();
    await caller(10).markRead({ conversationId: thread.id, throughId: question!.id });
    vi.mocked(db.claimEmailOutboxBatch).mockResolvedValueOnce(emails() as any);
    expect(await drainGenericEmailOutbox({ limit: 5, deliveryClasses: ['urgent'] })).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.markEmailOutboxSkipped).toHaveBeenCalledWith(emails()[0].id, 'live_expert_already_read', 'skipped_suppressed');
  });

  it('keeps older messages handled without a historical notification backlog and includes safe deep links', async () => {
    const thread = await open();
    const nonce = crypto.randomUUID();
    sqlite.prepare("INSERT INTO live_expert_messages (conversation_id,sender_id,sender_role,sender_name,content,client_nonce,created_at) VALUES (?,1,'client','Client','Old message',?,?)").run(thread.id, nonce, new Date().toISOString());
    expect(sqlite.prepare('SELECT alerts_enqueued FROM live_expert_messages').get()).toEqual({ alerts_enqueued: 1 });
    await caller(1).send({ conversationId: thread.id, content: 'Old message', nonce });
    expect(emails()).toHaveLength(0);
    const built = buildLiveExpertAlertEmail(false, '/live-package/messages?cohortKey=cohort-a&test="quoted"');
    expect(built.text).toContain('/live-package/messages?cohortKey=cohort-a');
    expect(built.html).toContain('&amp;test=&quot;quoted&quot;');
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
