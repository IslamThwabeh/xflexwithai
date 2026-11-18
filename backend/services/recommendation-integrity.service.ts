import { sql, type SQL } from 'drizzle-orm';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core';
import type { getDb } from '../db';
import { buildRecommendationMessageEmail } from '../_core/recommendationEmails';
import { formatAcademyDateTime, ACADEMY_TIME_LABEL_AR, ACADEMY_TIME_LABEL_EN } from '../../shared/academyLocale';
import { recommendationManagementCopy, type RecommendationManagementAction } from '../../shared/recommendationIntegrity';

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export class RecommendationManagementError extends Error {}
export async function executeRecommendationBatch(database: Database, statements: SQL[]) {
  const dialect = new SQLiteAsyncDialect();
  const prepared = statements.map(statement => {
    const query = dialect.sqlToQuery(statement);
    if (query.params.length > 100) throw new Error('Recommendation statement exceeds the D1 parameter limit');
    return database.$client.prepare(query.sql).bind(...query.params);
  });
  return database.$client.batch(prepared);
}
export type ManagementInput = {
  rootId: number; requestId: string; action: RecommendationManagementAction;
  reason: string; confirmUntriggered?: boolean; actorUserId: number; isAdmin: boolean;
};

/** One D1 transaction persists the notice, terminal state and both delivery channels. */
export async function publishRecommendationManagement(database: Database, input: ManagementInput) {
  const root = await database.get<import('../../database/schema-sqlite').RecommendationMessage>(sql`SELECT * FROM recommendationMessages WHERE id=${input.rootId}`);
  // Deliberately conceal existence/ownership from other analysts.
  if (!root || (!input.isAdmin && root.userId !== input.actorUserId)) throw new RecommendationManagementError('Recommendation not found or unavailable.');
  if (root.parentId !== null || root.type !== 'recommendation') throw new RecommendationManagementError('Choose an original recommendation.');
  const copy = recommendationManagementCopy(input.action);
  const safeReason = input.reason.trim();
  if (safeReason.length < 5 || safeReason.length > 1000) throw new RecommendationManagementError('Enter a reason between 5 and 1000 characters.');
  const content = `${copy.titleAr} / ${copy.titleEn}\n${safeReason}\n\n${copy.instructionAr}\n${copy.instructionEn}`;
  const existing = await database.get<{id:number;parentId:number;userId:number;managementAction:string;content:string}>(sql`SELECT id,parentId,userId,managementAction,content FROM recommendationMessages WHERE managementRequestId=${input.requestId}`);
  if (existing) {
    if (existing.parentId !== root.id || existing.userId !== input.actorUserId || existing.managementAction !== input.action || existing.content !== content) throw new RecommendationManagementError('Request identifier already used.');
    return { messageId: existing.id as number, eventKey: `rec_msg:${existing.id}` };
  }
  if (input.action === 'cancel_pending' && (root.entryMode !== 'pending' || !input.confirmUntriggered)) throw new RecommendationManagementError('Only a confirmed untriggered pending entry can be cancelled.');
  if (root.cancelledAt || (root.threadStatus === 'closed' && input.action !== 'correction')) throw new RecommendationManagementError('This recommendation is already closed.');
  if (input.action === 'cancel_pending') {
    const child = await database.get(sql`SELECT id FROM recommendationMessages WHERE parentId=${root.id} LIMIT 1`);
    if (child) throw new RecommendationManagementError('This recommendation already has follow-ups. Use an update and record its result.');
  }
  const audience = await database.get(sql`SELECT id FROM recommendation_deliveries WHERE eventKey=${`rec_msg:${root.id}`} LIMIT 1`);
  if (!audience) throw new RecommendationManagementError('Original delivery audience is unavailable. Ask BO to review before sending.');

  const now = new Date().toISOString();
  const childForRequest = sql`SELECT id FROM recommendationMessages WHERE managementRequestId=${input.requestId} AND parentId=${root.id} AND userId=${input.actorUserId} AND managementAction=${input.action}`;
  const statements = [sql`
    INSERT INTO recommendationMessages (userId,type,content,symbol,parentId,createdAt,managementAction,managementRequestId)
    SELECT ${input.actorUserId},'update',${content},root.symbol,root.id,${now},${input.action},${input.requestId}
    FROM recommendationMessages root WHERE root.id=${root.id} AND root.type='recommendation' AND root.parentId IS NULL
      AND (${input.isAdmin ? 1 : 0}=1 OR root.userId=${input.actorUserId}) AND root.cancelledAt IS NULL
      AND (${input.action}='correction' OR COALESCE(root.threadStatus,'open')<>'closed')
      AND (${input.action}<>'cancel_pending' OR (root.entryMode='pending' AND NOT EXISTS (
        SELECT 1 FROM recommendationMessages child WHERE child.parentId=root.id
      )))
    ON CONFLICT(managementRequestId) DO NOTHING
  `];
  if (input.action === 'cancel_pending') statements.push(sql`
    UPDATE recommendationMessages SET cancelledAt=${now},threadStatus='closed',closedAt=${now},closedByUserId=${input.actorUserId}
    WHERE id=${root.id} AND cancelledAt IS NULL AND EXISTS (${childForRequest})
  `);
  // Root delivery rows include the original in-app audience, even those online
  // when the recommendation was published. No current-subscription expansion.
  const originalAudience = sql`
    FROM recommendation_deliveries original JOIN users u ON u.id=original.userId
    WHERE original.eventKey=${`rec_msg:${root.id}`} AND u.isStaff=0 AND u.login_blocked_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM userRoles role WHERE role.userId=u.id AND role.role='analyst')
  `;
  for (const language of ['ar','en'] as const) {
    const latestContent = `${language === 'ar' ? copy.titleAr : copy.titleEn}\n${safeReason}\n\n${language === 'ar' ? copy.instructionAr : copy.instructionEn}\n${formatAcademyDateTime(now,language)} (${language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN})`;
    const email = buildRecommendationMessageEmail({ language, type:'update', recommendation:root, latestMessage:{content:latestContent}, operationalNotice:true });
    const subject = `${language === 'ar' ? copy.titleAr : copy.titleEn} #${root.id}`;
    statements.push(sql`
      INSERT INTO recommendation_deliveries (eventKey,eventKind,refId,threadRootMessageId,userId,recipientEmail,language,status,subject,bodyText,bodyHtml,metadataJson,attempts,createdAt,updatedAt)
      SELECT ('rec_msg:' || (${childForRequest})),'management',(${childForRequest}),${root.id},u.id,u.email,${language},'pending',${subject},${email.text},${email.html},
        json_object('batchId',('rec_live_' || (${childForRequest})),'managementAction',${input.action}),0,${now},${now}
      ${originalAudience} AND (CASE WHEN original.language='en' THEN 'en' ELSE 'ar' END)=${language} AND EXISTS (${childForRequest})
      ON CONFLICT(eventKey,userId) DO NOTHING
    `);
  }
  statements.push(sql`
    INSERT INTO user_notifications (user_id,type,title_en,title_ar,content_en,content_ar,action_url,batch_id,created_at)
    SELECT u.id,'info',${copy.titleEn},${copy.titleAr},${`${copy.instructionEn}\n${safeReason}`},${`${copy.instructionAr}\n${safeReason}`},'/recommendations',('rec_live_' || (${childForRequest})),${now}
    ${originalAudience} AND EXISTS (${childForRequest}) AND NOT EXISTS (
      SELECT 1 FROM user_notifications n WHERE n.user_id=u.id AND n.batch_id=('rec_live_' || (${childForRequest}))
    )
  `);
  await executeRecommendationBatch(database,statements);
  const notice = await database.get<{id:number}>(sql`${childForRequest}`);
  if (!notice) throw new RecommendationManagementError('Recommendation changed. Refresh and review its latest state.');
  return { messageId: notice.id, eventKey: `rec_msg:${notice.id}` };
}
