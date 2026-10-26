import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import * as db from './db';
import * as expert from './services/live-expert.service';
import { LIVE_EXPERT_ROLE } from '../shared/liveExpert';

const actorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const admin = ctx.user.id < 0 ? await db.getAdminById(-ctx.user.id) : null;
  const isExpert = !admin && ctx.user.id > 0 && await db.hasAnyRole(ctx.user.id, [LIVE_EXPERT_ROLE]);
  const actor: expert.ExpertActor = {
    id: ctx.user.id, name: ctx.user.publicSupportName || ctx.user.name || (admin ? 'Admin' : 'Client'),
    isAdmin: Boolean(admin), isExpert: Boolean(isExpert),
  };
  return next({ ctx: { ...ctx, expertActor: actor } });
});
const inboxProcedure = actorProcedure.use(({ ctx, next }) => {
  if (!ctx.expertActor.isAdmin && !ctx.expertActor.isExpert) throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});
const settingsProcedure = inboxProcedure.use(({ ctx, next }) => {
  if (!ctx.expertActor.isAdmin) throw new TRPCError({ code: 'FORBIDDEN' });
  return next();
});
const threadInput = z.object({ conversationId: z.number().int().positive() });
const cohortInput = z.object({ cohortKey: z.string().trim().min(1).max(100).optional() }).optional();

export const liveExpertRouter = router({
  myWorkspace: actorProcedure.input(cohortInput).query(({ ctx, input }) => expert.getClientExpertWorkspace(ctx.expertActor, input?.cohortKey)),
  openConversation: actorProcedure.input(cohortInput).mutation(({ ctx, input }) => expert.openClientExpertThread(ctx.expertActor, input?.cohortKey)),
  messages: actorProcedure.input(threadInput.extend({ beforeId: z.number().int().positive().optional(), afterId: z.number().int().min(0).optional() }).refine(input => !(input.beforeId && input.afterId !== undefined), 'Use one cursor at a time'))
    .query(({ ctx, input }) => expert.getExpertMessages(ctx.expertActor, input)),
  markRead: actorProcedure.input(threadInput.extend({ throughId: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => { await expert.markExpertRead(ctx.expertActor, input.conversationId, input.throughId); return { success: true }; }),
  send: actorProcedure.input(threadInput.extend({ content: z.string().trim().max(5000), nonce: z.string().uuid(), attachmentId: z.string().uuid().optional() }).refine(input => Boolean(input.content || input.attachmentId), 'Write a message or attach a screenshot'))
    .mutation(({ ctx, input }) => expert.sendExpertMessage(ctx.expertActor, input)),
  uploadImage: actorProcedure.input(threadInput.extend({ data: z.string().max(2796204), contentType: z.enum(['image/png','image/jpeg','image/webp']), fileName: z.string().trim().min(1).max(180) }))
    .mutation(({ ctx, input }) => expert.uploadExpertImage(ctx.expertActor, input)),
  image: actorProcedure.input(z.object({ id: z.string().uuid() })).query(({ ctx, input }) => expert.readExpertImage(ctx.expertActor, input.id)),
  deletePendingImage: actorProcedure.input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { await expert.deletePendingExpertImage(ctx.expertActor, input.id); return { success: true }; }),
  inbox: inboxProcedure.input(z.object({ search: z.string().trim().max(100).default(''), unansweredOnly: z.boolean().default(false), beforeId: z.number().int().positive().optional(), offset: z.number().int().min(0).max(100000).default(0) }).optional())
    .query(async ({ ctx, input }) => {
      const connection = await expert.expertDatabase();
      const scope = ctx.expertActor.isAdmin ? sql`` : sql`AND c.expert_user_id = ${ctx.user.id}`;
      const search = input?.search ? sql`AND (u.name LIKE ${`%${input.search}%`} OR c.cohort_key LIKE ${`%${input.search}%`})` : sql``;
      const unanswered = input?.unansweredOnly ? sql`AND c.last_client_message_id > c.last_expert_message_id` : sql``;
      const rows = await connection.all<expert.ExpertThread & { client_name: string | null; expert_name: string | null; unread: number; preview: string }>(sql`SELECT c.*, u.name AS client_name, e.publicSupportName AS expert_name,
        (SELECT count(*) FROM live_expert_messages m WHERE m.conversation_id = c.id AND m.id > c.expert_read_id AND m.sender_role = 'client') AS unread,
        (SELECT content FROM live_expert_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
        FROM live_expert_conversations c JOIN users u ON u.id = c.user_id JOIN users e ON e.id = c.expert_user_id
        WHERE 1 = 1 ${scope} ${search} ${unanswered}
        ORDER BY (c.last_client_message_id > c.last_expert_message_id) DESC, c.last_message_at DESC, c.id DESC LIMIT 51 OFFSET ${input?.offset ?? 0}`);
      return { items: rows.slice(0, 50), hasMore: rows.length > 50, isAdmin: ctx.expertActor.isAdmin };
    }),
  settings: settingsProcedure.query(async () => {
    const connection = await expert.expertDatabase();
    const [settings, experts] = await Promise.all([
      expert.getExpertSettings(),
      connection.all<{ id: number; name: string | null; email: string }>(sql`SELECT u.id, u.name, u.email FROM users u WHERE u.isStaff = 1 AND u.login_blocked_at IS NULL AND EXISTS (SELECT 1 FROM userRoles r WHERE r.userId = u.id AND r.role = ${LIVE_EXPERT_ROLE}) ORDER BY u.name LIMIT 200`),
    ]);
    return { ...settings, experts };
  }),
  updateSettings: settingsProcedure.input(z.object({ expertUserId: z.number().int().positive(), graceDays: z.number().int().min(0).max(90), availabilityEn: z.string().trim().min(1).max(500), availabilityAr: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const target = await db.getUserById(input.expertUserId);
      if (!target?.isStaff || target.loginBlockedAt || !await db.hasAnyRole(input.expertUserId, [LIVE_EXPERT_ROLE])) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an active staff member with the Live Expert role.' });
      const connection = await expert.expertDatabase();
      const previous = await expert.getExpertSettings();
      await connection.run(sql`UPDATE live_expert_settings SET expert_user_id = ${input.expertUserId}, grace_days = ${input.graceDays}, availability_en = ${input.availabilityEn}, availability_ar = ${input.availabilityAr} WHERE id = 1`);
      await db.logAdminAction(-ctx.user.id, input.expertUserId, 'update_live_expert_settings', { previousExpertId: previous.expert_user_id, ...input });
      return { success: true };
    }),
  reassign: settingsProcedure.input(threadInput.extend({ expertUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const thread = await expert.requireExpertThread(ctx.expertActor, input.conversationId);
    const target = await db.getUserById(input.expertUserId);
    if (!target?.isStaff || target.loginBlockedAt || !await db.hasAnyRole(input.expertUserId, [LIVE_EXPERT_ROLE])) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an active Live Expert.' });
    const connection = await expert.expertDatabase();
    await connection.run(sql`UPDATE live_expert_conversations SET expert_user_id = ${input.expertUserId} WHERE id = ${thread.id}`);
    await db.logAdminAction(-ctx.user.id, thread.user_id, 'reassign_live_expert_thread', { conversationId: thread.id, previousExpertId: thread.expert_user_id, expertUserId: input.expertUserId });
    return { success: true };
  }),
});
