import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { R2Bucket } from '@cloudflare/workers-types';
import * as db from '../db';
import { getLiveExpertMessagingWindow, LIVE_EXPERT_IMAGE_MAX_BYTES, LIVE_EXPERT_ROLE } from '../../shared/liveExpert';

export type ExpertActor = { id: number; name: string; isAdmin: boolean; isExpert: boolean };
export type ExpertSettings = { expert_user_id: number | null; grace_days: number; availability_en: string; availability_ar: string };
export type ExpertThread = {
  id: number; user_id: number; entitlement_id: number; cohort_key: string; expert_user_id: number;
  last_client_message_id: number; last_expert_message_id: number; client_read_id: number; expert_read_id: number;
  last_message_at: string;
};
export type ExpertMessage = {
  id: number; conversation_id: number; sender_id: number; sender_role: 'client' | 'expert' | 'admin';
  sender_name: string; content: string; created_at: string;
  attachment_id: string | null; file_name: string | null;
};

export async function expertDatabase() {
  const connection = await db.getDb();
  if (!connection) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
  return connection;
}

export async function getExpertSettings() {
  const connection = await expertDatabase();
  const settings = await connection.get<ExpertSettings>(sql`SELECT expert_user_id, grace_days, availability_en, availability_ar FROM live_expert_settings WHERE id = 1`);
  if (!settings) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Expert messaging is not configured yet.' });
  return settings;
}

export async function requireExpertThread(actor: ExpertActor, id: number) {
  const connection = await expertDatabase();
  const thread = await connection.get<ExpertThread>(sql`SELECT * FROM live_expert_conversations WHERE id = ${id}`);
  if (!thread || (!actor.isAdmin && thread.user_id !== actor.id && !(actor.isExpert && thread.expert_user_id === actor.id))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
  }
  return thread;
}

async function expertAvailable(id: number | null) {
  if (!id) return false;
  const connection = await expertDatabase();
  return Boolean(await connection.get(sql`SELECT u.id FROM users u WHERE u.id = ${id} AND u.isStaff = 1 AND u.login_blocked_at IS NULL AND EXISTS (SELECT 1 FROM userRoles r WHERE r.userId = u.id AND r.role = ${LIVE_EXPERT_ROLE})`));
}

export async function getExpertThreadWindow(thread: ExpertThread, settings?: ExpertSettings) {
  const connection = await expertDatabase();
  const entitlement = await connection.get<{ isActive: number; sessionEndsAt: string; current_cohort_key: string | null; cohort_status: string | null; schedule_ends_at: string | null } | undefined>(sql`SELECT isActive, sessionEndsAt,
    (SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_cohort_key') AS current_cohort_key,
    (SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_cohort_status') AS cohort_status,
    (SELECT settingValue FROM admin_settings WHERE settingKey = 'package_live_session_ends_at') AS schedule_ends_at
    FROM live_package_entitlements WHERE id = ${thread.entitlement_id} AND userId = ${thread.user_id} AND cohortKey = ${thread.cohort_key}`);
  const current = settings ?? await getExpertSettings();
  const isCurrentCohort = entitlement?.current_cohort_key === thread.cohort_key;
  return getLiveExpertMessagingWindow({
    active: Boolean(entitlement?.isActive),
    cohortStatus: isCurrentCohort ? entitlement?.cohort_status ?? 'not_started' : 'completed',
    sessionEndsAt: (isCurrentCohort ? entitlement?.schedule_ends_at : null) || entitlement?.sessionEndsAt || null,
    graceDays: current.grace_days,
  });
}

export async function getClientExpertWorkspace(actor: ExpertActor, cohortKey?: string) {
  if (actor.id <= 0) throw new TRPCError({ code: 'FORBIDDEN' });
  const connection = await expertDatabase();
  const settings = await getExpertSettings();
  const entitlement = await db.getAnyLivePackageEntitlement(actor.id, cohortKey);
  if (!entitlement) return { hasAccess: false as const, thread: null, canSend: false, messagingEndsAt: null, expertName: '', expertAvailable: false, unread: 0, settings, cohorts: [] };
  const thread = await connection.get<ExpertThread | undefined>(sql`SELECT * FROM live_expert_conversations WHERE user_id = ${actor.id} AND cohort_key = ${entitlement.cohortKey}`) ?? null;
  const window = await getExpertThreadWindow(thread ?? {
    user_id: actor.id, entitlement_id: entitlement.id, cohort_key: entitlement.cohortKey,
  } as ExpertThread, settings);
  const expertId = thread?.expert_user_id ?? settings.expert_user_id;
  const [available, expert, cohorts, unread] = await Promise.all([
    expertAvailable(expertId),
    expertId ? db.getUserById(expertId) : null,
    connection.all<{ cohortKey: string }>(sql`SELECT cohortKey FROM live_package_entitlements WHERE userId = ${actor.id} ORDER BY id DESC LIMIT 50`),
    thread ? connection.get<{ count: number }>(sql`SELECT count(*) AS count FROM live_expert_messages WHERE conversation_id = ${thread.id} AND id > ${thread.client_read_id} AND sender_role <> 'client'`) : null,
  ]);
  return { hasAccess: true as const, thread, ...window, canSend: window.canSend && available, expertAvailable: available, expertName: expert?.publicSupportName || expert?.name || 'Live Expert', unread: unread?.count ?? 0, settings, cohorts };
}

export async function openClientExpertThread(actor: ExpertActor, cohortKey?: string) {
  const workspace = await getClientExpertWorkspace(actor, cohortKey);
  if (workspace.thread) return workspace.thread;
  if (!workspace.hasAccess || !workspace.canSend || !workspace.settings.expert_user_id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Expert messaging is currently unavailable for this cohort.' });
  const entitlement = await db.getAnyLivePackageEntitlement(actor.id, cohortKey);
  if (!entitlement) throw new TRPCError({ code: 'FORBIDDEN' });
  const connection = await expertDatabase();
  await connection.run(sql`INSERT INTO live_expert_conversations (user_id, entitlement_id, cohort_key, expert_user_id, last_message_at) VALUES (${actor.id}, ${entitlement.id}, ${entitlement.cohortKey}, ${workspace.settings.expert_user_id}, ${new Date().toISOString()}) ON CONFLICT(user_id, cohort_key) DO NOTHING`);
  const thread = await connection.get<ExpertThread>(sql`SELECT * FROM live_expert_conversations WHERE user_id = ${actor.id} AND cohort_key = ${entitlement.cohortKey}`);
  if (!thread) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  return thread;
}

export async function getExpertMessages(actor: ExpertActor, input: { conversationId: number; beforeId?: number; afterId?: number }) {
  const thread = await requireExpertThread(actor, input.conversationId);
  const connection = await expertDatabase();
  const filter = input.afterId !== undefined ? sql`AND m.id > ${input.afterId}` : input.beforeId ? sql`AND m.id < ${input.beforeId}` : sql``;
  const order = input.afterId !== undefined ? sql`ASC` : sql`DESC`;
  const rows = await connection.all<ExpertMessage>(sql`SELECT m.id, m.conversation_id, m.sender_id, m.sender_role, m.sender_name, m.content, m.created_at, a.id AS attachment_id, a.file_name FROM live_expert_messages m LEFT JOIN live_expert_attachments a ON a.message_id = m.id WHERE m.conversation_id = ${thread.id} ${filter} ORDER BY m.id ${order} LIMIT 51`);
  const hasMore = rows.length > 50;
  const messages = rows.slice(0, 50);
  if (input.afterId === undefined) messages.reverse();
  const window = await getExpertThreadWindow(thread);
  return { messages, hasMore, ...window, canSend: window.canSend && await expertAvailable(thread.expert_user_id) };
}

export async function markExpertRead(actor: ExpertActor, conversationId: number, throughId: number) {
  const thread = await requireExpertThread(actor, conversationId);
  const connection = await expertDatabase();
  // Admin oversight must not consume the assigned expert's unread messages.
  if (actor.isAdmin) return;
  const cursor = actor.id === thread.user_id ? sql`client_read_id` : sql`expert_read_id`;
  await connection.run(sql`UPDATE live_expert_conversations SET ${cursor} = max(${cursor}, min(${throughId}, max(last_client_message_id, last_expert_message_id))) WHERE id = ${thread.id} AND ${cursor} < ${throughId}`);
}

export async function sendExpertMessage(actor: ExpertActor, input: { conversationId: number; content: string; nonce: string; attachmentId?: string }) {
  const thread = await requireExpertThread(actor, input.conversationId);
  const connection = await expertDatabase();
  const isClient = actor.id === thread.user_id && !actor.isAdmin;
  if (!(await getExpertThreadWindow(thread)).canSend || !await expertAvailable(thread.expert_user_id)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Messaging has ended or the expert is currently unavailable. Previous messages remain readable.' });
  const existing = await connection.get<{ id: number; sender_id: number }>(sql`SELECT id, sender_id FROM live_expert_messages WHERE conversation_id = ${thread.id} AND client_nonce = ${input.nonce}`);
  if (existing) {
    if (existing.sender_id !== actor.id) throw new TRPCError({ code: 'CONFLICT' });
    return existing;
  }
  const recent = await connection.get<{ count: number }>(sql`SELECT count(*) AS count FROM live_expert_messages WHERE conversation_id = ${thread.id} AND sender_id = ${actor.id} AND created_at > ${new Date(Date.now() - 60000).toISOString()}`);
  if ((recent?.count ?? 0) >= 20) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Please wait a minute before sending more messages.' });
  const uploadCutoff = new Date(Date.now() - 86400000).toISOString();
  if (input.attachmentId) {
    const attachment = await connection.get(sql`SELECT id FROM live_expert_attachments WHERE id = ${input.attachmentId} AND conversation_id = ${thread.id} AND uploader_id = ${actor.id} AND message_id IS NULL AND created_at > ${uploadCutoff}`);
    if (!attachment) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Screenshot unavailable or already sent.' });
  }
  const role = isClient ? 'client' : actor.isAdmin ? 'admin' : 'expert';
  const now = new Date().toISOString();
  // A batch is an atomic transaction on D1 and the local D1 adapter.
  const batchQueries = [
    sql`INSERT INTO live_expert_messages (conversation_id, sender_id, sender_role, sender_name, content, client_nonce, created_at) SELECT ${thread.id}, ${actor.id}, ${role}, ${actor.name}, ${input.content}, ${input.nonce}, ${now} WHERE ${input.attachmentId ?? ''} = '' OR EXISTS (SELECT 1 FROM live_expert_attachments WHERE id = ${input.attachmentId ?? ''} AND conversation_id = ${thread.id} AND uploader_id = ${actor.id} AND message_id IS NULL AND created_at > ${uploadCutoff}) ON CONFLICT(conversation_id, client_nonce) DO NOTHING`,
    sql`UPDATE live_expert_attachments SET message_id = (SELECT id FROM live_expert_messages WHERE conversation_id = ${thread.id} AND client_nonce = ${input.nonce} AND sender_id = ${actor.id}) WHERE id = ${input.attachmentId ?? ''} AND conversation_id = ${thread.id} AND uploader_id = ${actor.id} AND message_id IS NULL`,
    sql`UPDATE live_expert_conversations SET ${isClient ? sql`last_client_message_id` : sql`last_expert_message_id`} = max(${isClient ? sql`last_client_message_id` : sql`last_expert_message_id`}, (SELECT id FROM live_expert_messages WHERE conversation_id = ${thread.id} AND client_nonce = ${input.nonce})), last_message_at = max(last_message_at, ${now}) WHERE id = ${thread.id} AND EXISTS (SELECT 1 FROM live_expert_messages WHERE conversation_id = ${thread.id} AND client_nonce = ${input.nonce})`,
  ];
  const dialect = new SQLiteSyncDialect();
  await connection.$client.batch(batchQueries.map(statement => {
    const query = dialect.sqlToQuery(statement);
    return connection.$client.prepare(query.sql).bind(...query.params);
  }));
  const sent = await connection.get<{ id: number; sender_id: number } | undefined>(sql`SELECT id, sender_id FROM live_expert_messages WHERE conversation_id = ${thread.id} AND client_nonce = ${input.nonce}`);
  if (!sent || sent.sender_id !== actor.id) throw new TRPCError({ code: 'CONFLICT', message: 'Screenshot was removed or already sent. Refresh and try again.' });
  return { id: sent.id };
}

function attachmentBucket() {
  const bucket = (globalThis as { ENV?: { LIVE_EXPERT_ATTACHMENTS_BUCKET?: R2Bucket } }).ENV?.LIVE_EXPERT_ATTACHMENTS_BUCKET;
  if (!bucket) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Screenshot uploads are currently unavailable.' });
  return bucket;
}

export function validateExpertImage(data: string, contentType: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0 || data.length > Math.ceil(LIVE_EXPERT_IMAGE_MAX_BYTES / 3) * 4) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a PNG, JPEG or WebP screenshot up to 2 MB.' });
  const bytes = Buffer.from(data, 'base64');
  const valid = contentType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : contentType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : contentType === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || !bytes.length || bytes.length > LIVE_EXPERT_IMAGE_MAX_BYTES) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid screenshot format or size.' });
  return bytes;
}

export async function uploadExpertImage(actor: ExpertActor, input: { conversationId: number; data: string; contentType: string; fileName: string }) {
  const thread = await requireExpertThread(actor, input.conversationId);
  if (!(await getExpertThreadWindow(thread)).canSend || !await expertAvailable(thread.expert_user_id)) throw new TRPCError({ code: 'FORBIDDEN' });
  const bytes = validateExpertImage(input.data, input.contentType);
  const connection = await expertDatabase();
  const pending = await connection.get<{ count: number }>(sql`SELECT count(*) AS count FROM live_expert_attachments WHERE conversation_id = ${thread.id} AND uploader_id = ${actor.id} AND created_at > ${new Date(Date.now() - 86400000).toISOString()} AND (message_id IS NULL OR created_at > ${new Date(Date.now() - 60000).toISOString()})`);
  if ((pending?.count ?? 0) >= 10) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Send or remove your pending screenshots before uploading more.' });
  const id = crypto.randomUUID();
  const key = `live-expert/${thread.id}/${id}`;
  const bucket = attachmentBucket();
  await bucket.put(key, bytes, { httpMetadata: { contentType: input.contentType, cacheControl: 'private, no-store' } });
  try {
    await connection.run(sql`INSERT INTO live_expert_attachments (id, conversation_id, uploader_id, object_key, file_name, content_type, size_bytes, created_at) VALUES (${id}, ${thread.id}, ${actor.id}, ${key}, ${input.fileName}, ${input.contentType}, ${bytes.length}, ${new Date().toISOString()})`);
  } catch (error) { await bucket.delete(key); throw error; }
  return { id, fileName: input.fileName };
}

export async function readExpertImage(actor: ExpertActor, id: string) {
  const connection = await expertDatabase();
  const attachment = await connection.get<{ conversation_id: number; uploader_id: number; message_id: number | null; object_key: string; content_type: string; file_name: string }>(sql`SELECT * FROM live_expert_attachments WHERE id = ${id}`);
  if (!attachment) throw new TRPCError({ code: 'NOT_FOUND' });
  await requireExpertThread(actor, attachment.conversation_id);
  if (attachment.message_id === null && attachment.uploader_id !== actor.id) throw new TRPCError({ code: 'NOT_FOUND' });
  const object = await attachmentBucket().get(attachment.object_key);
  if (!object) throw new TRPCError({ code: 'NOT_FOUND' });
  return { data: Buffer.from(await object.arrayBuffer()).toString('base64'), contentType: attachment.content_type, fileName: attachment.file_name };
}

export async function deletePendingExpertImage(actor: ExpertActor, id: string) {
  const connection = await expertDatabase();
  const attachment = await connection.get<{ conversation_id: number; object_key: string }>(sql`SELECT conversation_id, object_key FROM live_expert_attachments WHERE id = ${id} AND uploader_id = ${actor.id} AND message_id IS NULL`);
  if (!attachment) throw new TRPCError({ code: 'NOT_FOUND' });
  await requireExpertThread(actor, attachment.conversation_id);
  await connection.run(sql`DELETE FROM live_expert_attachments WHERE id = ${id} AND message_id IS NULL AND uploader_id = ${actor.id}`);
  // A concurrent send may have attached it while deletion was requested.
  const retained = await connection.get(sql`SELECT id FROM live_expert_attachments WHERE id = ${id}`);
  if (!retained) await attachmentBucket().delete(attachment.object_key);
}

export async function cleanupPendingExpertImages(bucket: R2Bucket) {
  const connection = await expertDatabase();
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const expired = await connection.all<{ id: string; object_key: string }>(sql`SELECT id, object_key FROM live_expert_attachments INDEXED BY idx_live_expert_attachments_pending WHERE message_id IS NULL AND created_at < ${cutoff} ORDER BY created_at, id LIMIT 100`);
  for (const attachment of expired) {
    // Expired pending images cannot be attached to a new message.
    await bucket.delete(attachment.object_key);
    await connection.run(sql`DELETE FROM live_expert_attachments WHERE id = ${attachment.id} AND message_id IS NULL AND created_at < ${cutoff}`);
  }
  return expired.length;
}
