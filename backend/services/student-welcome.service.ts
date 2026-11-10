import type { D1Database } from '@cloudflare/workers-types';
import { STUDENT_WELCOME_AR } from '../../shared/studentWelcome';
import { buildSupportReplyEmail } from '../_core/supportEmails';

/** Every write shares one D1 transaction. Concurrent calls and retries are harmless. */
export async function deliverStudentSupportWelcome(database: D1Database, userId: number): Promise<boolean> {
  const user = await database.prepare(`
    SELECT u.id, u.email, u.name FROM users u
    WHERE u.id = ? AND COALESCE(u.isStaff, 0) = 0
      AND NOT EXISTS (SELECT 1 FROM student_support_welcomes w WHERE w.user_id = u.id)
      AND EXISTS (SELECT 1 FROM registrationKeys k
        WHERE lower(trim(k.email)) = lower(trim(u.email)) AND k.activatedAt IS NOT NULL
          AND k.packageId IS NOT NULL AND COALESCE(k.isRenewal, 0) = 0 AND COALESCE(k.isUpgrade, 0) = 0)
  `).bind(userId).first<{ id: number; email: string; name: string | null }>();
  if (!user) return false;

  const now = new Date().toISOString();
  const dedupeKey = `student_support_welcome:${userId}`;
  const email = buildSupportReplyEmail({ clientName: user.name, replyContent: STUDENT_WELCOME_AR });
  const notDelivered = 'NOT EXISTS (SELECT 1 FROM student_support_welcomes WHERE user_id = ?)';
  const conversation = '(SELECT MAX(id) FROM supportConversations WHERE userId = ?)';
  const results = await database.batch([
    database.prepare(`INSERT INTO supportConversations (userId, status, createdAt, updatedAt)
      SELECT ?, 'open', ?, ? WHERE ${notDelivered}
      AND NOT EXISTS (SELECT 1 FROM supportConversations WHERE userId = ?)`)
      .bind(userId, now, now, userId, userId),
    database.prepare(`INSERT INTO supportMessages
      (conversationId, senderId, senderType, senderDisplayName, content, isRead, createdAt)
      SELECT ${conversation}, 0, 'support', ?, ?, 0, ? WHERE ${notDelivered}`)
      .bind(userId, 'فريق XFlex — ترحيب تلقائي', STUDENT_WELCOME_AR, now, userId),
    // Appointment replies belong to the team, not the AI assistant.
    database.prepare(`UPDATE supportConversations SET status = 'open', closedAt = NULL,
      needsHuman = 1, needsHumanAt = ?, updatedAt = ?
      WHERE id = ${conversation} AND ${notDelivered}`).bind(now, now, userId, userId),
    database.prepare(`INSERT INTO user_notifications
      (user_id, type, title_en, title_ar, content_en, content_ar, action_url, dedupe_key, created_at)
      SELECT ?, 'info', 'Welcome to XFlex Academy', 'نورت أكاديمية XFlex',
      'Open support chat to arrange your introductory Zoom call and read the getting-started guide.',
      'افتح محادثة الدعم لتنسيق مكالمة Zoom التعريفية وقراءة تعليمات البداية.', '/support', ?, ?
      WHERE ${notDelivered}`).bind(userId, dedupeKey, now, userId),
    database.prepare(`INSERT INTO email_outbox
      (dedupeKey, recipientUserId, recipientEmail, eventType, deliveryClass, templateId, emailCategory,
       subject, bodyText, bodyHtml, metadataJson, status, attempts, nextAttemptAt, createdAt, updatedAt)
      SELECT ?, ?, ?, 'support_client_reply', 'urgent', 'student_support_welcome', 'transactional',
       ?, ?, ?, ?, 'pending', 0, ?, ?, ? WHERE ${notDelivered}`)
      .bind(dedupeKey, userId, user.email.trim().toLowerCase(), email.subject, email.text, email.html,
        JSON.stringify({ automatedWelcome: true, userId }), now, now, now, userId),
    database.prepare(`INSERT OR IGNORE INTO student_support_welcomes (user_id, conversation_id, delivered_at, created_at)
      VALUES (?, ${conversation}, ?, ?)`).bind(userId, userId, now, now),
  ]);
  return results[1].meta.changes > 0;
}
