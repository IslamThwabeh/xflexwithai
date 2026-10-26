import { sql } from 'drizzle-orm';
import * as db from '../db';
import { ENV } from '../_core/env';
import type { EmailOutbox } from '../../database/schema-sqlite';

export const LIVE_EXPERT_QUESTION_EVENT = 'live_expert_question';
export const LIVE_EXPERT_REPLY_EVENT = 'live_expert_reply';

export function isLiveExpertEmailEvent(eventType: string) {
  return eventType === LIVE_EXPERT_QUESTION_EVENT || eventType === LIVE_EXPERT_REPLY_EVENT;
}

export function getLiveExpertAlertLink(isQuestion: boolean, conversationId: number, cohortKey: string) {
  return isQuestion ? `/admin/live-expert?conversationId=${conversationId}` : `/live-package/messages?cohortKey=${encodeURIComponent(cohortKey)}`;
}

export function buildLiveExpertAlertEmail(isQuestion: boolean, actionPath: string) {
  const base = ENV.siteUrl.replace(/\/$/, '');
  const url = `${base}${actionPath}`;
  const preferencesUrl = `${base}${isQuestion ? '/admin/live-expert' : '/profile'}`;
  const titleAr = isQuestion ? 'سؤال جديد لخبير لايف' : 'رد جديد من خبير لايف';
  const titleEn = isQuestion ? 'New Live Expert question' : 'New Live Expert reply';
  const textAr = isQuestion ? 'لديك رسائل جديدة من عميل في محادثة بكج لايف الخاصة.' : 'لديك رد جديد في محادثتك الخاصة مع خبير لايف.';
  const textEn = isQuestion ? 'A client has sent new messages in a private Live Package conversation.' : 'You have a new reply in your private Live Expert conversation.';
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
  return {
    subject: `${titleAr} | ${titleEn}`,
    text: `${titleAr}\n${textAr}\n\n${titleEn}\n${textEn}\n\nOpen conversation / فتح المحادثة:\n${url}\n\nSign in to view messages and screenshots.\nسجّل الدخول لعرض الرسائل والصور.\n\nEmail preferences / إعدادات البريد:\n${preferencesUrl}`,
    html: `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif"><div style="max-width:560px;margin:24px auto;background:white;border-radius:12px;overflow:hidden"><div style="background:#064e3b;color:white;padding:24px;text-align:center;font-size:22px;font-weight:bold">XFlex Trading Academy</div><div style="padding:28px;line-height:1.8"><h2>${titleAr}</h2><p>${textAr}</p><div dir="ltr"><h3>${titleEn}</h3><p>${textEn}</p></div><p style="text-align:center;margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#047857;color:white;text-decoration:none;padding:12px 20px;border-radius:8px">فتح المحادثة · Open conversation</a></p><p style="color:#64748b;font-size:13px">سجّل الدخول لعرض الرسائل والصور.<br>Sign in to view messages and screenshots.</p><p style="font-size:12px"><a href="${escape(preferencesUrl)}">إعدادات البريد · Email preferences</a></p></div></div></body></html>`,
  };
}

/** Append to the same D1 batch as the message. No alert can outlive a rolled-back send. */
export function buildLiveExpertAlertStatements(input: {
  conversationId: number; cohortKey: string; senderId: number; nonce: string; isQuestion: boolean; now: string;
}) {
  const { isQuestion, now } = input;
  const event = isQuestion ? LIVE_EXPERT_QUESTION_EVENT : LIVE_EXPERT_REPLY_EVENT;
  const actionPath = getLiveExpertAlertLink(isQuestion, input.conversationId, input.cohortKey);
  const email = buildLiveExpertAlertEmail(isQuestion, actionPath);
  const bucket = Math.floor(Date.parse(now) / 60000);
  const dueAt = new Date((bucket + 1) * 60000).toISOString();
  const recipient = isQuestion ? sql`c.expert_user_id` : sql`c.user_id`;
  const key = `live_expert_thread:${input.conversationId}`;
  const emailKeyPrefix = `${event}:${input.conversationId}:`;
  const titleEn = isQuestion ? 'New Live Expert question' : 'New Live Expert reply';
  const titleAr = isQuestion ? 'سؤال جديد لخبير لايف' : 'رد جديد من خبير لايف';
  const contentEn = isQuestion ? 'A client has sent a message. Open the private conversation to reply.' : 'Your Live Expert conversation has a new reply.';
  const contentAr = isQuestion ? 'أرسل عميل رسالة جديدة. افتح المحادثة الخاصة للرد.' : 'لديك رد جديد في محادثتك مع خبير لايف.';
  const source = sql`FROM live_expert_messages m JOIN live_expert_conversations c ON c.id = m.conversation_id JOIN users u ON u.id = ${recipient}
    WHERE m.conversation_id = ${input.conversationId} AND m.client_nonce = ${input.nonce} AND m.sender_id = ${input.senderId} AND m.alerts_enqueued = 0
    AND u.login_blocked_at IS NULL ${isQuestion ? sql`AND u.isStaff = 1 AND EXISTS (SELECT 1 FROM userRoles r WHERE r.userId = u.id AND r.role = 'live_expert')` : sql``}`;
  const metadata = sql`json_object('conversationId', c.id, 'recipientUserId', u.id, 'lastMessageId', m.id, 'cohortKey', c.cohort_key)`;
  const pref = isQuestion
    ? sql`coalesce(json_extract(CASE WHEN json_valid(u.staffNotificationPrefs) THEN u.staffNotificationPrefs ELSE '{}' END, '$.live_expert_question'), 1) <> 0`
    : sql`coalesce(json_extract(CASE WHEN json_valid(u.notificationPrefs) THEN u.notificationPrefs ELSE '{}' END, '$.live_expert_replies'), 1) <> 0`;
  const notification = isQuestion
    ? sql`INSERT INTO staff_notifications (userId,eventType,titleEn,titleAr,contentEn,contentAr,actionUrl,metadata,dedupe_key,isRead,createdAt)
        SELECT u.id,${event},${titleEn},${titleAr},${contentEn},${contentAr},${actionPath},${metadata},${key},0,${now} ${source}
        ON CONFLICT(userId,dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET titleEn=excluded.titleEn,titleAr=excluded.titleAr,contentEn=excluded.contentEn,contentAr=excluded.contentAr,actionUrl=excluded.actionUrl,metadata=excluded.metadata,isRead=0,archivedAt=NULL,archiveReason=NULL,archiveBatchKey=NULL,createdAt=excluded.createdAt`
    : sql`INSERT INTO user_notifications (user_id,type,title_en,title_ar,content_en,content_ar,action_url,dedupe_key,is_read,created_at)
        SELECT u.id,'info',${titleEn},${titleAr},${contentEn},${contentAr},${actionPath},${key},0,${now} ${source}
        ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET title_en=excluded.title_en,title_ar=excluded.title_ar,content_en=excluded.content_en,content_ar=excluded.content_ar,action_url=excluded.action_url,is_read=0,created_at=excluded.created_at`;
  return [
    notification,
    sql`INSERT INTO email_outbox (dedupeKey,recipientUserId,recipientEmail,eventType,deliveryClass,templateId,emailCategory,subject,bodyText,bodyHtml,metadataJson,status,attempts,nextAttemptAt,createdAt,updatedAt)
      SELECT ${emailKeyPrefix} || u.id || ${`:${bucket}`},u.id,lower(trim(u.email)),${event},'urgent',${event},'transactional',${email.subject},${email.text},${email.html},${metadata},'pending',0,${dueAt},${now},${now} ${source} AND ${pref} AND trim(u.email) <> ''
      ON CONFLICT(dedupeKey) DO UPDATE SET metadataJson=excluded.metadataJson,updatedAt=excluded.updatedAt WHERE email_outbox.status='pending'`,
    sql`UPDATE live_expert_messages SET alerts_enqueued = 1 WHERE conversation_id = ${input.conversationId} AND client_nonce = ${input.nonce} AND sender_id = ${input.senderId} AND alerts_enqueued = 0`,
  ];
}

type AlertRow = Pick<EmailOutbox, 'eventType' | 'recipientUserId' | 'recipientEmail' | 'metadataJson'>;

/** Recheck access/preferences at dispatch, including reassignment after enqueue. */
export async function getLiveExpertAlertBlockReason(row: AlertRow): Promise<string | null> {
  if (!isLiveExpertEmailEvent(row.eventType)) return null;
  let conversationId: unknown;
  try { conversationId = JSON.parse(row.metadataJson ?? '{}').conversationId; } catch { return 'live_expert_invalid_metadata'; }
  if (!Number.isSafeInteger(conversationId) || Number(conversationId) < 1 || !row.recipientUserId) return 'live_expert_invalid_metadata';
  const connection = await db.getDb();
  if (!connection) throw new Error('Database unavailable while checking Live Expert alert');
  const recipient = await connection.get<{
    user_id: number; expert_user_id: number; last_client_message_id: number; last_expert_message_id: number;
    client_read_id: number; expert_read_id: number; email: string; login_blocked_at: string | null;
    notificationPrefs: string | null; staffNotificationPrefs: string | null; isStaff: number; expert_role: number;
  } | undefined>(sql`SELECT c.*,u.email,u.login_blocked_at,u.notificationPrefs,u.staffNotificationPrefs,u.isStaff,
      EXISTS (SELECT 1 FROM userRoles r WHERE r.userId = u.id AND r.role = 'live_expert') AS expert_role
      FROM live_expert_conversations c JOIN users u ON u.id = ${row.recipientUserId} WHERE c.id = ${Number(conversationId)}`);
  if (!recipient) return 'live_expert_conversation_missing';
  if (recipient.login_blocked_at) return 'recipient_account_disabled';
  if (recipient.email.trim().toLowerCase() !== row.recipientEmail.trim().toLowerCase()) return 'recipient_changed';
  const isQuestion = row.eventType === LIVE_EXPERT_QUESTION_EVENT;
  if ((isQuestion ? recipient.expert_user_id : recipient.user_id) !== row.recipientUserId || (isQuestion && (!recipient.isStaff || !recipient.expert_role))) return 'live_expert_access_changed';
  let prefs: Record<string, unknown> = {};
  try { prefs = JSON.parse((isQuestion ? recipient.staffNotificationPrefs : recipient.notificationPrefs) || '{}') ?? {}; } catch { /* malformed preferences use defaults */ }
  if (prefs[isQuestion ? 'live_expert_question' : 'live_expert_replies'] === false) return 'live_expert_email_disabled';
  if (isQuestion ? recipient.expert_read_id >= recipient.last_client_message_id : recipient.client_read_id >= recipient.last_expert_message_id) return 'live_expert_already_read';
  return null;
}
