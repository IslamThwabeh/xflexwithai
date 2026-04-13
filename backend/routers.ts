import {
  BUG_REPORT_RISK_LEVELS,
  BUG_REPORT_STATUSES,
  COOKIE_NAME,
  LEXAI_SUPPORT_CASE_PRIORITIES,
  LEXAI_SUPPORT_CASE_STATUSES,
} from "../shared/const";
import {
  FREE_LIBRARY_DOCUMENTS,
  FREE_LIBRARY_VIDEOS,
  buildFreeLibraryDocumentPath,
  buildFreeLibraryVideoStreamPath,
} from "../shared/freeLibrary";
import {
  CURATED_ARTICLES,
  estimateReadingTimeMinutes,
  getCuratedArticleBySlug,
  type PublicArticleTheme,
} from "../shared/curatedArticles";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "./_core/logger";
import * as db from "./db";
import { filterRecipientsByMutedThreads } from "./services/recommendation-thread.service";
import { storagePutR2, storageArchiveR2 } from "./storage-r2";
import { analyzeLexai } from "./_core/lexai";
import { hashPassword, verifyPassword, generateToken, isValidEmail, isValidPassword, normalizeEmailAddress } from "./_core/auth";
import { generateFreeVideoPlaybackToken } from "./_core/freeLibraryPlayback";
import { sendEmail, sendLoginCodeEmail } from "./_core/email";
import { buildRecommendationAlertEmail, buildRecommendationMessageEmail } from "./_core/recommendationEmails";
import { sendOrderConfirmationEmail, sendPaymentReceivedEmail, sendAdminNewOrderNotification, sendAnnouncementEmail, sendStaffWelcomeEmail } from "./_core/orderEmails";
import { ENV } from "./_core/env";
import { generateNumericCode, generateSaltBase64, normalizeEmail, sha256Base64 } from "./_core/otp";
// FlexAI routes are registered in server/_core/index.ts

const getReqHeader = (req: any, name: string) => {
  const headers = req?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return headers.get(name) ?? "";
  }
  const key = String(name || "").toLowerCase();
  const value = headers[key] ?? headers[name];
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "string") return value;
  return "";
};

const getRequestIp = (req: any) => {
  return getReqHeader(req, "cf-connecting-ip") ||
    (getReqHeader(req, "x-forwarded-for") || "").split(",")[0].trim() ||
    "";
};

const getRequestUserAgent = (req: any) => getReqHeader(req, "user-agent") || "";

const STAFF_ACTIVITY_QUERY_ALLOWLIST = new Set([
  "supportDashboard.searchClients",
  "supportDashboard.clientProgress",
  "supportDashboard.clientSubscriptions",
  "supportDashboard.clientQuizProgress",
  "supportDashboard.recommendationFeed",
  "supportChat.getMessages",
  "lexaiSupport.getCase",
  "plan.listAll",
]);

const STAFF_ACTIVITY_MUTATION_IGNORELIST = new Set([
  "staffNotifications.markRead",
  "staffNotifications.markReadByRoute",
  "staffNotifications.markAllRead",
]);

const STAFF_ACTIVITY_RESOURCE_ID_KEYS = [
  "conversationId",
  "caseId",
  "messageId",
  "userId",
  "subscriptionId",
  "orderId",
  "packageId",
  "keyId",
  "courseId",
  "eventId",
  "articleId",
  "testimonialId",
  "id",
];

const isSensitiveStaffActivityKey = (key: string) => {
  const normalized = key.toLowerCase();
  if (
    normalized.includes("password") ||
    normalized.includes("token") ||
    normalized.includes("code") ||
    normalized.includes("hash") ||
    normalized.includes("filedata")
  ) {
    return true;
  }

  return ["content", "note", "details", "metadata", "proofurl"].includes(normalized);
};

const summarizeStaffActivityInput = (value: unknown, depth = 0): unknown => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= 1) {
      return `[${value.length} items]`;
    }
    return value.slice(0, 5).map((entry) => summarizeStaffActivityInput(entry, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 2) {
      return "[object]";
    }

    const summary: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      summary[key] = isSensitiveStaffActivityKey(key)
        ? "[redacted]"
        : summarizeStaffActivityInput(entry, depth + 1);
    }
    return summary;
  }

  return String(value);
};

const getStaffActivityResourceId = (input: unknown) => {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;

  for (const key of STAFF_ACTIVITY_RESOURCE_ID_KEYS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const getStaffActivityResourceType = (path: string) => {
  const [scope] = path.split(".");
  switch (scope) {
    case "supportDashboard":
      return "student_profile";
    case "supportChat":
      return "support_conversation";
    case "lexaiSupport":
      return "lexai_case";
    case "roles":
      return "staff_role";
    case "recommendations":
      return "recommendation_channel";
    case "plan":
      return "plan_progress";
    default:
      return scope || "staff_action";
  }
};

const writeStaffActivityLog = async ({
  ctx,
  path,
  type,
  input,
  actionType,
  resourceType,
  resourceId,
  details,
}: {
  ctx: any;
  path: string;
  type: "query" | "mutation";
  input: unknown;
  actionType?: string;
  resourceType?: string | null;
  resourceId?: number | null;
  details?: Record<string, unknown>;
}) => {
  const user = ctx?.user;
  const isStaffUser = !!user && user.id > 0 && !!user.isStaff;
  const isAdmin = !!ctx?.admin;
  if (!isStaffUser || isAdmin) return;

  const summarizedInput = summarizeStaffActivityInput(input);
  await db.logStaffAction({
    staffUserId: user.id,
    actionType: actionType ?? path,
    resourceType: resourceType ?? getStaffActivityResourceType(path),
    resourceId: resourceId ?? getStaffActivityResourceId(input),
    details: {
      operationType: type,
      path,
      input: summarizedInput,
      ...details,
    },
    ipAddress: getRequestIp(ctx.req),
  });
};

const staffActivityTrackingMiddleware = async ({ ctx, path, type, input, next }: any) => {
  const result = await next();

  if (!result.ok) {
    return result;
  }

  const shouldTrackMutation = type === "mutation" && !STAFF_ACTIVITY_MUTATION_IGNORELIST.has(path);
  const shouldTrackQuery = type === "query" && STAFF_ACTIVITY_QUERY_ALLOWLIST.has(path);
  if (!shouldTrackMutation && !shouldTrackQuery) {
    return result;
  }

  try {
    await writeStaffActivityLog({ ctx, path, type, input });
  } catch (error) {
    logger.warn("[STAFF MONITORING] Failed to log staff activity", {
      path,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return result;
};

// Admin-only procedure - checks if user is in admins table
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.user.email) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (!admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx: { ...ctx, admin } });
});

const getWorkerEnv = () => (globalThis as { ENV?: { VIDEOS_BUCKET?: any } }).ENV;

const PUBLIC_ARTICLE_THEMES: PublicArticleTheme[] = ["emerald", "teal", "amber"];

const getDefaultPublicArticleTheme = (seed: string) => {
  let hash = 0;
  for (const char of seed) {
    hash = (hash + char.charCodeAt(0)) % PUBLIC_ARTICLE_THEMES.length;
  }

  return PUBLIC_ARTICLE_THEMES[hash];
};

const toPublicArticle = (article: Awaited<ReturnType<typeof db.getAllArticles>>[number]) => ({
  ...article,
  isCurated: false as const,
  subjectEn: "Market Insight",
  subjectAr: "رؤية سوقية",
  readingTimeMinutes: estimateReadingTimeMinutes(article.contentEn || article.contentAr),
  theme: getDefaultPublicArticleTheme(article.slug),
});

const mergePublicArticles = (articles: Awaited<ReturnType<typeof db.getAllArticles>>) => {
  const curatedSlugs = new Set(CURATED_ARTICLES.map((article) => article.slug));
  const merged = [
    ...CURATED_ARTICLES,
    ...articles.filter((article) => !curatedSlugs.has(article.slug)).map(toPublicArticle),
  ];

  return merged.sort((left, right) => {
    const leftDate = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
    const rightDate = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    return rightDate - leftDate;
  });
};

const userOnlyProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Please sign in with a user account to use this feature.' });
  }

  return next();
});

// Staff procedure – checks if user has any staff role (support, analyst, permissions), or is admin
const supportStaffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) return next({ ctx: { ...ctx, admin, staffRole: 'admin' as const } });
  const isStaff = await db.hasAnyRole(ctx.user.id, [
    'support', 'key_manager', 'plan_manager',
    'client_lookup', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes',
  ]);
  if (!isStaff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return next({ ctx: { ...ctx, admin: null, staffRole: 'support' as const } });
}).use(staffActivityTrackingMiddleware);

const lexaiSupportProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) return next({ ctx: { ...ctx, admin } });
  const hasLexaiAccess = await db.hasAnyRole(ctx.user.id, ['lexai_support']);
  if (!hasLexaiAccess) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'LexAI support access required' });
  }
  return next({ ctx: { ...ctx, admin: null } });
}).use(staffActivityTrackingMiddleware);

// Admin-or-role procedure factory
const adminOrRoleProcedure = (roles: string[]) => protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) return next({ ctx: { ...ctx, admin } });
  const has = await db.hasAnyRole(ctx.user.id, roles);
  if (!has) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }
  return next({ ctx: { ...ctx, admin: null } });
}).use(staffActivityTrackingMiddleware);
const ensureLexaiAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const admin = ctx.user.email ? await db.getAdminByEmail(ctx.user.email) : null;
  let subscription = await db.getActiveLexaiSubscription(ctx.user.id);

  if (!subscription) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active LexAI subscription" });
  }

  // Accept both "key" (legacy key activation) and "completed" (package activation / order)
  const validStatuses = ["key", "completed"];
  if (!validStatuses.includes(String(subscription.paymentStatus ?? "").toLowerCase())) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "LexAI requires an active subscription",
    });
  }

  if (subscription.endDate) {
    const endDate = new Date(subscription.endDate);
    const shouldEnforceExpiry = Number(subscription.messagesUsed ?? 0) > 0;
    if (shouldEnforceExpiry && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      await db.updateLexaiSubscription(subscription.id, { isActive: false });
      throw new TRPCError({ code: "FORBIDDEN", message: "LexAI subscription expired" });
    }
  }

  return { subscription, isAdmin: !!admin };
};

const requireActivePackage = async (userId: number) => {
  const sub = await db.getUserActivePackage(userId);
  if (!sub) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'يجب تفعيل مفتاح الباقة أولاً للوصول إلى الاختبارات',
    });
  }
};

const getLatestLexaiAnalysis = async (userId: number, analysisType: string) => {
  const messages = await db.getLexaiMessagesByUser(userId, 50);
  return messages.find(
    message => message.role === "assistant" && message.analysisType === analysisType
  );
};

const RECOMMENDATION_REACTIONS = ["like", "love", "sad", "fire", "rocket"] as const;
const RECOMMENDATION_ALERT_UNLOCK_SECONDS = 60;
const RECOMMENDATION_ALERT_EXPIRY_MINUTES = 15;
const RECOMMENDATION_EMAIL_INACTIVE_MINUTES = 15;
const buildRecommendationThreadUnfollowUrl = (threadRootMessageId: number) =>
  `https://xflexacademy.com/recommendations?threadAction=unfollow&threadId=${threadRootMessageId}`;

const buildRecommendationPlainText = (payload: {
  type: "alert" | "recommendation" | "update" | "result";
  content: string;
  symbol?: string;
  side?: string;
  entryPrice?: string;
  stopLoss?: string;
  takeProfit1?: string;
  takeProfit2?: string;
  riskPercent?: string;
}) => {
  const lines: string[] = [];
  const title = payload.type === "alert"
    ? "تنبيه توصية"
    : payload.type === "result"
      ? "نتيجة توصية"
      : "توصية جديدة";

  lines.push(`XFlex - ${title}`);
  lines.push("------------------------------");
  if (payload.symbol) lines.push(`الزوج/الأصل: ${payload.symbol}`);
  if (payload.side) lines.push(`الاتجاه: ${payload.side}`);
  if (payload.entryPrice) lines.push(`الدخول: ${payload.entryPrice}`);
  if (payload.stopLoss) lines.push(`وقف الخسارة: ${payload.stopLoss}`);
  if (payload.takeProfit1) lines.push(`هدف 1: ${payload.takeProfit1}`);
  if (payload.takeProfit2) lines.push(`هدف 2: ${payload.takeProfit2}`);
  if (payload.riskPercent) lines.push(`نسبة المخاطرة: ${payload.riskPercent}`);
  lines.push("");
  lines.push(payload.content);
  lines.push("");
  lines.push("تابع القروب الآن للتنفيذ السريع.");

  return lines.join("\n");
};

type UserNotificationPrefs = {
  support_replies?: boolean;
  recommendations?: boolean;
  course_updates?: boolean;
  admin_announcements?: boolean;
  language?: "ar" | "en";
};

const parseNotificationPrefs = (notificationPrefs: string | null | undefined): UserNotificationPrefs => {
  try {
    return JSON.parse(notificationPrefs || '{}') as UserNotificationPrefs;
  } catch {
    return {};
  }
};

const recommendationNotificationsEnabled = (notificationPrefs: string | null | undefined) => {
  const prefs = parseNotificationPrefs(notificationPrefs);
  return prefs.recommendations !== false;
};

const getPreferredNotificationLanguage = (notificationPrefs: string | null | undefined): "ar" | "en" => {
  const prefs = parseNotificationPrefs(notificationPrefs);
  return prefs.language === "en" ? "en" : "ar";
};

const isRecommendationEmailCandidate = (
  lastInteractiveAt: string | null | undefined,
  threshold: Date,
) => {
  if (!lastInteractiveAt) return true;
  const parsed = new Date(lastInteractiveAt);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed <= threshold;
};

const buildRecommendationAlertNotificationCopy = () => ({
  titleEn: 'Recommendations channel alert',
  titleAr: 'تنبيه قناة التوصيات',
  contentEn: `Be ready and open your trading app. The analyst is about to post a new recommendation in about ${RECOMMENDATION_ALERT_UNLOCK_SECONDS} seconds.`,
  contentAr: `كن مستعداً وافتح تطبيق التداول. المحلل على وشك نشر توصية جديدة خلال حوالي ${RECOMMENDATION_ALERT_UNLOCK_SECONDS} ثانية.`,
});

const buildRecommendationMessageNotificationCopy = (payload: {
  type: "recommendation" | "update" | "result";
  symbol?: string | null;
  content: string;
}) => {
  const symbolTag = payload.symbol ? ` — ${payload.symbol}` : '';
  const preview = payload.content.length > 100 ? `${payload.content.slice(0, 100)}…` : payload.content;

  if (payload.type === "result") {
    return {
      titleEn: `Trade Result${symbolTag}`,
      titleAr: `نتيجة الصفقة${symbolTag}`,
      contentEn: preview,
      contentAr: preview,
    };
  }

  if (payload.type === "update") {
    return {
      titleEn: `Trade Update${symbolTag}`,
      titleAr: `تحديث على الصفقة${symbolTag}`,
      contentEn: preview,
      contentAr: preview,
    };
  }

  return {
    titleEn: `New Recommendation${symbolTag}`,
    titleAr: `توصية جديدة${symbolTag}`,
    contentEn: preview,
    contentAr: preview,
  };
};

const ensureRecommendationReadAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const access = await db.getUserRecommendationsAccess(ctx.user.id);
  const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));

  if (!access.hasSubscription && !access.canPublish && !isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Recommendation group requires an active key.",
    });
  }

  return { ...access, isAdmin };
};

const ensureRecommendationPublishAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  const access = await ensureRecommendationReadAccess(ctx);
  if (!access.canPublish && !access.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only analysts can publish recommendations.",
    });
  }
  return access;
};

const ensureEpisodeUnlockedForUser = async (userId: number, courseId: number, episodeId: number) => {
  const episodes = await db.getEpisodesByCourseId(courseId);
  const sortedEpisodes = [...episodes].sort((a, b) => a.order - b.order);
  const episode = sortedEpisodes.find((ep) => ep.id === episodeId);

  if (!episode) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found in this course' });
  }

  if (episode.order <= 1) {
    return { episode, episodes: sortedEpisodes };
  }

  const previousEpisode = sortedEpisodes.find((ep) => ep.order === episode.order - 1);
  if (!previousEpisode) {
    return { episode, episodes: sortedEpisodes };
  }

  const courseProgress = await db.getUserCourseProgress(userId, courseId);
  const completedEpisodeIds = new Set(
    courseProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)
  );

  if (!completedEpisodeIds.has(previousEpisode.id)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Complete the previous episode first.',
    });
  }

  return { episode, episodes: sortedEpisodes };
};

// ============================================================================
// AI Proof Verification for Broker Onboarding
// ============================================================================
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function verifyOnboardingProofWithAI(stepId: number, step: string, proofUrl: string) {
  const prompts: Record<string, string> = {
    open_account: `You are verifying a broker onboarding proof image. The student claims they opened and verified a real trading account with a broker.

Analyze this image and determine if it is a legitimate proof of account opening AND verification. Look for:
- Email confirmation from a broker (e.g. Equiti, XM, Exness, etc.)
- Account number or client ID visible
- Mention of account creation, linking, registration, or verification
- Verification status showing "verified", "approved", or "fully verified"
- Identity verification confirmation
- Official broker branding/letterhead

Return a JSON object with exactly these fields:
{"confidence": 0.0 to 1.0, "reason": "brief explanation"}

confidence should be >= 0.9 if the image clearly shows a broker account opening or verification confirmation.
confidence should be < 0.5 if the image is unrelated, blurry, or suspicious.
Respond ONLY with the JSON object, nothing else.`,

    deposit: `You are verifying a broker onboarding proof image. The student claims they deposited at least $10 into their trading account.

Analyze this image and determine if it shows proof of a deposit. Look for:
- Transaction history showing a deposit
- Deposit confirmation email
- Amount visible (should be >= $10)
- Account balance or equity showing funds
- Official broker branding

Return a JSON object with exactly these fields:
{"confidence": 0.0 to 1.0, "reason": "brief explanation"}

confidence should be >= 0.9 if the image clearly shows a deposit of $10 or more.
Respond ONLY with the JSON object, nothing else.`,
  };

  const prompt = prompts[step];
  if (!prompt) return; // No AI check for select_broker

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: proofUrl, detail: "low" } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.error('[Onboarding AI] OpenAI request failed', { status: response.status, detail });
    return;
  }

  const data: any = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? "";

  // Parse JSON from response
  let confidence = 0;
  let reason = "AI analysis failed";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
      reason = String(parsed.reason || "No reason provided").substring(0, 500);
    }
  } catch {
    logger.error('[Onboarding AI] Failed to parse response', { text });
    return;
  }

  logger.info('[Onboarding AI] Verification result', { stepId, step, confidence, reason });

  // Save result (auto-approves if confidence >= 0.9 via saveOnboardingAiResult)
  await db.saveOnboardingAiResult(stepId, confidence, reason);
}

// ============================================================================
// Support Chat — Working Hours & AI Auto-Reply
// ============================================================================

/** Check if current Jordan time is within working hours (Sun-Thu 12:00-20:00) */
function isSupportWorkingHours(): boolean {
  const now = new Date();
  // Jordan is UTC+3 (Asia/Amman). Get day/hour in Jordan time.
  const jordanStr = now.toLocaleString('en-US', { timeZone: 'Asia/Amman', hour12: false });
  const jordanDate = new Date(jordanStr);
  const day = jordanDate.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  const hour = jordanDate.getHours();
  // Working days: Sun(0)-Thu(4), hours 12:00-19:59
  return day >= 0 && day <= 4 && hour >= 12 && hour < 20;
}

const SUPPORT_AI_SYSTEM_PROMPT = `You are the XFlex Trading Academy support assistant. You help students with questions about their courses, packages, subscriptions, and platform usage.

About XFlex:
- Online trading academy based in Jordan, teaching in Arabic and English
- Two packages: Basic ($200) includes Trading Course + Recommendations, Comprehensive ($500) adds LexAI chatbot
- Students activate access via package keys given after purchase
- Platform has: video courses, quizzes, broker onboarding, trading recommendations, LexAI, loyalty points

Common topics you can help with:
- How to activate a package key (go to Dashboard, enter the key)
- How to access courses and watch episodes
- Quiz system (must watch episodes first, pass quizzes to earn points)
- Broker onboarding steps (select broker → open & verify account → deposit $10+)
- Trading recommendations (available after subscription activation)
- LexAI access (Comprehensive package only, activates after course completion)
- Loyalty points and referral program
- Technical issues (video not loading, login problems)

Rules:
- Be concise and helpful. Keep responses under 150 words.
- Respond in the same language the student uses (Arabic or English).
- If you don't know the answer or the question requires human judgment (refunds, billing disputes, account issues), say you'll connect them with a human agent.
- Never make up information about prices, features, or policies you're unsure about.
- Be friendly but professional. Use the student's context when available.
- Do NOT discuss competitor platforms or give financial/trading advice.`;

/** Generate an AI auto-reply for a student message using GPT-4o-mini */
async function generateSupportAIReply(
  conversationMessages: Array<{ senderType: string; content: string }>,
): Promise<string | null> {
  if (!ENV.openaiApiKey) return null;

  // Sliding window: last 10 messages for context
  const recentMessages = conversationMessages.slice(-10);

  const chatMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SUPPORT_AI_SYSTEM_PROMPT },
  ];

  for (const msg of recentMessages) {
    chatMessages.push({
      role: msg.senderType === 'client' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      logger.error('[Support AI] OpenAI request failed', { status: response.status });
      return null;
    }

    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    logger.error('[Support AI] Failed to generate reply', { error: String(err) });
    return null;
  }
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // Check if current user is an admin or staff member
    isAdmin: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { isAdmin: false, isStaff: false, staffRoles: [], admin: null };
      const admin = await db.getAdminByEmail(ctx.user.email);
      if (admin) return { isAdmin: true, isStaff: false, staffRoles: [], admin };
      // Check if staff
      const isStaff = !!(ctx.user as any).isStaff;
      if (isStaff) {
        const roles = await db.getUserRoles(ctx.user.id);
        return { isAdmin: false, isStaff: true, staffRoles: roles.map((r: any) => r.role), admin: null };
      }
      return { isAdmin: false, isStaff: false, staffRoles: [], admin: null };
    }),
    
    // User registration
    register: publicProcedure
      .input(z.object({
        email: z.string().min(3),
        password: z.string().min(8),
        name: z.string().min(2),
        phone: z.string().min(5).optional(),
        city: z.string().min(1).optional(),
        country: z.string().min(1).optional(),
        referralCode: z.string().min(4).max(10).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const normalizedEmail = normalizeEmailAddress(input.email);
        logger.info('[AUTH] Registration attempt', { email: normalizedEmail });
        
        // Validate email format
        if (!isValidEmail(normalizedEmail)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid email format' });
        }
        
        // Validate password strength
        if (!isValidPassword(input.password)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' 
          });
        }
        
        // Check if user already exists
        const existingUser = await db.getUserByEmail(normalizedEmail);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
        }
        
        // Hash password
        const passwordHash = await hashPassword(input.password);
        
        // Create user
        const userId = await db.createUser({
          email: normalizedEmail,
          passwordHash,
          name: input.name,
          phone: input.phone,
          city: input.city,
          country: input.country,
        });

        if (input.referralCode) {
          try {
            const referrer = await db.getUserByReferralCode(input.referralCode);
            if (referrer) {
              await db.createReferral(referrer.id, userId);
            } else {
              logger.warn('[AUTH] Referral code not found during registration', {
                email: normalizedEmail,
                referralCode: input.referralCode,
              });
            }
          } catch (error) {
            logger.warn('[AUTH] Failed registering referral during sign-up', {
              email: normalizedEmail,
              referralCode: input.referralCode,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        // Generate JWT token
        const token = await generateToken({
          userId,
          email: normalizedEmail,
          type: 'user',
        });
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req, 'user');
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);

        // Sync entitlements from any keys already assigned to this email
        try {
          await db.syncUserEntitlementsFromKeys(userId, normalizedEmail);
        } catch (e) {
          logger.warn('[AUTH] Failed syncing entitlements after register', { email: normalizedEmail });
        }
        
        logger.info('[AUTH] User registered successfully', { userId, email: normalizedEmail });
        
        return { success: true, userId };
      }),

    /**
     * Passwordless sign-in: request a one-time code by email.
     * Always returns success to avoid email enumeration.
     */
    requestLoginCode: publicProcedure
      .input(
        z.object({
          email: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email || "");
        if (!isValidEmail(email)) {
          return { success: true };
        }

        // Do not allow OTP for admins (admin uses dedicated password login)
        const admin = await db.getAdminByEmail(email);
        if (admin) {
          return { success: true };
        }

        const nowMs = Date.now();
        await db.deleteExpiredEmailOtps(nowMs);

        const ip = getRequestIp(ctx.req);
        const userAgent = getRequestUserAgent(ctx.req);

        const ipHash = ip ? await sha256Base64(`ip:${ip}`) : null;
        const userAgentHash = userAgent ? await sha256Base64(`ua:${userAgent}`) : null;

        // Rate limits (best-effort)
        const per30SecEmail = await db.countEmailOtpsSentSince({
          email,
          sinceMs: nowMs - 30_000,
          purpose: "login",
        });
        if (per30SecEmail > 0) {
          return { success: true };
        }

        const perHourEmail = await db.countEmailOtpsSentSince({
          email,
          sinceMs: nowMs - 60 * 60_000,
          purpose: "login",
        });
        if (perHourEmail >= 5) {
          return { success: true };
        }

        const perHourIp = ipHash
          ? await db.countEmailOtpsSentSince({
              ipHash,
              sinceMs: nowMs - 60 * 60_000,
            })
          : 0;
        if (perHourIp >= 20) {
          return { success: true };
        }

        // Option A: OTP is for login only. First-time users must register with password.
        const existingUser = await db.getUserByEmail(email);
        if (!existingUser) {
          return { success: true };
        }

        // Users can disable OTP login from profile.
        if (existingUser.loginSecurityMode === "password_only" || existingUser.loginSecurityMode === "password_plus_otp") {
          return { success: true };
        }

        const code = generateNumericCode(6);
        const salt = generateSaltBase64(16);
        const codeHash = await sha256Base64(`${salt}:${code}`);
        const expiresMinutes = 10;
        const expiresAtMs = nowMs + expiresMinutes * 60_000;

        await db.createEmailOtp({
          email,
          purpose: "login",
          codeHash,
          salt,
          sentAtMs: nowMs,
          expiresAtMs,
          ipHash,
          userAgentHash,
        });

        try {
          await sendLoginCodeEmail({ to: email, code, expiresMinutes });
        } catch (e) {
          logger.error("[AUTH] Failed sending login code", {
            email,
            error: e instanceof Error ? e.message : "Unknown error",
          });
          // Don't leak delivery failures to the client.
        }

        return { success: true };
      }),

    /**
     * Passwordless sign-in: verify a one-time code and create a user session.
     */
    verifyLoginCode: publicProcedure
      .input(
        z.object({
          email: z.string(),
          code: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email || "");
        const code = (input.code || "").trim();

        if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        const admin = await db.getAdminByEmail(email);
        if (admin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Please sign in through the admin login page.",
          });
        }

        const nowMs = Date.now();
        await db.deleteExpiredEmailOtps(nowMs);

        const existingUser = await db.getUserByEmail(email);
        const otpPurpose = existingUser?.loginSecurityMode === "password_plus_otp" ? "login_stepup" : "login";
        const otp = await db.getLatestEmailOtp(email, otpPurpose);

        if (!otp || Number(otp.expiresAtMs) < nowMs) {
          if (existingUser?.loginSecurityMode === "password_plus_otp") {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in with your password first." });
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        const computedHash = await sha256Base64(`${otp.salt}:${code}`);
        if (computedHash !== otp.codeHash) {
          const attempts = await db.incrementEmailOtpAttempts(otp.id);
          if (attempts >= 10) {
            await db.deleteEmailOtpsForEmail(email, otpPurpose);
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        await db.deleteEmailOtpsForEmail(email, otpPurpose);

        const user = await db.getUserByEmail(email);

        if (!user) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No account found for this email. Please register first.",
          });
        }

        if (user.loginSecurityMode === "password_only") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "OTP login is disabled for your account. Please use your password.",
          });
        }

        await db.updateUserLastSignIn(user.id);
        await db.setUserEmailVerified(user.id);

        // Daily login points
        try { await db.autoAwardPoints(user.id, 'daily_login'); } catch {}

        const token = await generateToken({
          userId: user.id,
          email,
          type: "user",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req, 'user');
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        await db.touchUserActivity(user.id);

        try {
          await db.syncUserEntitlementsFromKeys(user.id, email);
        } catch (e) {
          logger.warn("[AUTH] Failed syncing entitlements after OTP login", { userId: user.id, email });
        }

        // Return staff info for frontend redirect
        let staffRoles: string[] = [];
        if (user.isStaff) {
          const ip = getRequestIp(ctx.req);
          const userAgent = getRequestUserAgent(ctx.req);
          await db.startStaffSession({
            staffUserId: user.id,
            ipAddress: ip,
            userAgent,
          });
          await db.logStaffAction({
            staffUserId: user.id,
            actionType: 'auth.login',
            resourceType: 'session',
            details: {
              operationType: 'mutation',
              path: 'auth.verifyLoginCode',
              authMethod: otpPurpose === 'login_stepup' ? 'password_plus_otp' : 'otp',
            },
            ipAddress: ip,
          });
          const roles = await db.getUserRoles(user.id);
          staffRoles = roles.map(r => r.role);
        }

        return { success: true, isStaff: !!user.isStaff, staffRoles };
      }),
    
    // User login
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[AUTH] Login attempt', { email: input.email });
        
        // Find user
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // Verify password
        const isValid = await verifyPassword(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // If user enforces password + OTP, send a step-up OTP and require verification.
        if (user.loginSecurityMode === "password_plus_otp") {
          const nowMs = Date.now();
          await db.deleteExpiredEmailOtps(nowMs);

          const code = generateNumericCode(6);
          const salt = generateSaltBase64(16);
          const codeHash = await sha256Base64(`${salt}:${code}`);
          const expiresMinutes = 10;
          const expiresAtMs = nowMs + expiresMinutes * 60_000;

          await db.createEmailOtp({
            email: user.email,
            purpose: "login_stepup",
            codeHash,
            salt,
            sentAtMs: nowMs,
            expiresAtMs,
          });

          try {
            await sendLoginCodeEmail({ to: user.email, code, expiresMinutes });
          } catch (e) {
            logger.error("[AUTH] Failed sending step-up login code", {
              email: user.email,
              error: e instanceof Error ? e.message : "Unknown error",
            });
          }

          return {
            success: true,
            requiresOtp: true,
            message: "We sent a verification code to your email. Enter it to complete sign in.",
          };
        }

        // Update last signed in
        await db.updateUserLastSignIn(user.id);

        // Daily login points
        try { await db.autoAwardPoints(user.id, 'daily_login'); } catch {}

        // Generate JWT token
        const token = await generateToken({
          userId: user.id,
          email: user.email,
          type: 'user',
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req, 'user');
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        await db.touchUserActivity(user.id);

        if (user.isStaff) {
          const ip = getRequestIp(ctx.req);
          const userAgent = getRequestUserAgent(ctx.req);
          await db.startStaffSession({
            staffUserId: user.id,
            ipAddress: ip,
            userAgent,
          });
          await db.logStaffAction({
            staffUserId: user.id,
            actionType: 'auth.login',
            resourceType: 'session',
            details: {
              operationType: 'mutation',
              path: 'auth.login',
              authMethod: 'password',
            },
            ipAddress: ip,
          });
        }

        // Sync entitlements from any keys already assigned to this email
        try {
          await db.syncUserEntitlementsFromKeys(user.id, input.email);
        } catch (e) {
          logger.warn('[AUTH] Failed syncing entitlements after login', { email: input.email, userId: user.id });
        }
        
        logger.info('[AUTH] User logged in successfully', { userId: user.id, email: user.email });
        
        return { success: true, requiresOtp: false, user: { id: user.id, email: user.email, name: user.name } };
      }),
    
    // Admin login (separate from user login)
    adminLogin: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('🔐 [ADMIN LOGIN] Login attempt started', { 
          email: input.email,
          timestamp: new Date().toISOString(),
        });
        
        // Find admin
        logger.info('🔍 [ADMIN LOGIN] Looking up admin by email', { email: input.email });
        const admin = await db.getAdminByEmail(input.email);
        
        if (!admin) {
          logger.error('❌ [ADMIN LOGIN] Admin not found', { email: input.email });
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        logger.info('✅ [ADMIN LOGIN] Admin found in database', { 
          adminId: admin.id,
          email: admin.email,
          name: admin.name,
        });
        
        // Verify password
        logger.info('🔍 [ADMIN LOGIN] Verifying password');
        const isValid = await verifyPassword(input.password, admin.passwordHash);
        
        if (!isValid) {
          logger.error('❌ [ADMIN LOGIN] Password verification failed', { 
            email: input.email,
            adminId: admin.id,
          });
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        logger.info('✅ [ADMIN LOGIN] Password verified successfully');
        
        // Update last signed in
        logger.info('🔍 [ADMIN LOGIN] Updating last sign-in timestamp');
        await db.updateAdminLastSignIn(admin.id);
        logger.info('✅ [ADMIN LOGIN] Last sign-in updated');
        
        // Generate JWT token
        logger.info('🔍 [ADMIN LOGIN] Generating JWT token', {
          userId: admin.id,
          email: admin.email,
          type: 'admin',
        });
        const token = await generateToken({
          userId: admin.id,
          email: admin.email,
          type: 'admin',
        });
        logger.info('✅ [ADMIN LOGIN] JWT token generated', {
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...',
        });
        
        // Set cookie
        logger.info('🔍 [ADMIN LOGIN] Setting cookie', {
          cookieName: COOKIE_NAME,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req, 'admin');
        logger.info('🔍 [ADMIN LOGIN] Cookie options', {
          ...cookieOptions,
          domain: cookieOptions.domain || 'not set',
        });
        
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        logger.info('✅ [ADMIN LOGIN] Cookie set successfully');
        
        logger.info('🎉 [ADMIN LOGIN] Admin logged in successfully', { 
          adminId: admin.id, 
          email: admin.email,
          timestamp: new Date().toISOString(),
        });
        
        return { success: true, admin: { id: admin.id, email: admin.email, name: admin.name } };
      }),

    // Change password (authenticated users only)
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[AUTH] Change password attempt', { userId: ctx.user?.id });
        
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        // Get user
        const user = await db.getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        // Verify current password
        const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await hashPassword(input.newPassword);

        // Update user password
        await db.updateUserPassword(ctx.user.id, hashedPassword);
        
        logger.info('[AUTH] Password changed successfully', { userId: ctx.user.id });
        
        return { success: true };
      }),

    // ── OTP-based password reset (for profile page) ──────────────
    requestPasswordResetCode: protectedProcedure
      .input(z.object({ email: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const email = normalizeEmail(input.email || "");
        // Only allow resetting your own password
        const user = await db.getUserByEmail(email);
        if (!user || user.id !== ctx.user.id) {
          return { success: true };
        }

        const nowMs = Date.now();
        await db.deleteExpiredEmailOtps(nowMs);

        const ip = getReqHeader(ctx.req, "cf-connecting-ip") ||
          (getReqHeader(ctx.req, "x-forwarded-for") || "").split(",")[0].trim() || "";
        const ipHash = ip ? await sha256Base64(`ip:${ip}`) : null;
        const userAgent = getReqHeader(ctx.req, "user-agent") || "";
        const userAgentHash = userAgent ? await sha256Base64(`ua:${userAgent}`) : null;

        // Rate limits
        const per30Sec = await db.countEmailOtpsSentSince({ email, sinceMs: nowMs - 30_000, purpose: "password_reset" });
        if (per30Sec > 0) return { success: true };
        const perHour = await db.countEmailOtpsSentSince({ email, sinceMs: nowMs - 60 * 60_000, purpose: "password_reset" });
        if (perHour >= 5) return { success: true };

        const code = generateNumericCode(6);
        const salt = generateSaltBase64(16);
        const codeHash = await sha256Base64(`${salt}:${code}`);
        const expiresMinutes = 10;

        await db.createEmailOtp({
          email,
          purpose: "password_reset",
          codeHash,
          salt,
          sentAtMs: nowMs,
          expiresAtMs: nowMs + expiresMinutes * 60_000,
          ipHash,
          userAgentHash,
        });

        try {
          await sendLoginCodeEmail({ to: email, code, expiresMinutes });
        } catch (e) {
          logger.error("[AUTH] Failed sending password reset code", { email, error: e instanceof Error ? e.message : "Unknown" });
        }

        return { success: true };
      }),

    resetPasswordWithOtp: protectedProcedure
      .input(z.object({
        email: z.string(),
        code: z.string().regex(/^\d{6}$/),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const email = normalizeEmail(input.email);
        const code = input.code.trim();

        const user = await db.getUserByEmail(email);
        if (!user || user.id !== ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid request' });
        }

        const otp = await db.getLatestEmailOtp(email, "password_reset");
        if (!otp || otp.expiresAtMs < Date.now()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Code expired. Please request a new one.' });
        }

        const computedHash = await sha256Base64(`${otp.salt}:${code}`);
        if (computedHash !== otp.codeHash) {
          await db.incrementEmailOtpAttempts(otp.id);
          if ((otp.attempts ?? 0) + 1 >= 10) {
            await db.deleteEmailOtpsForEmail(email, "password_reset");
          }
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid code' });
        }

        // Valid OTP — update password
        if (!isValidPassword(input.newPassword)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
        }
        const hashed = await hashPassword(input.newPassword);
        await db.updateUserPassword(user.id, hashed);
        await db.deleteEmailOtpsForEmail(email, "password_reset");

        logger.info('[AUTH] Password reset via OTP', { userId: user.id });
        return { success: true };
      }),
    
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user && ctx.user.id > 0 && ctx.user.isStaff) {
        const logoutAt = new Date();
        const ip = getRequestIp(ctx.req);
        try {
          await db.endActiveStaffSessions(ctx.user.id, logoutAt);
          await db.logStaffAction({
            staffUserId: ctx.user.id,
            actionType: 'auth.logout',
            resourceType: 'session',
            details: {
              operationType: 'mutation',
              path: 'auth.logout',
            },
            ipAddress: ip,
            createdAt: logoutAt,
          });
        } catch (error) {
          logger.warn('[STAFF MONITORING] Failed to close staff session on logout', {
            userId: ctx.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (ctx.user && ctx.user.id > 0) {
        try {
          await db.clearUserInteraction(ctx.user.id);
        } catch (error) {
          logger.warn('[AUTH] Failed to clear user interaction on logout', {
            userId: ctx.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Clear with both role maxAge values – the important thing is maxAge: -1 which deletes the cookie
      const cookieOptions = getSessionCookieOptions(ctx.req, 'user');
      ctx.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Dashboard statistics (admin only)
  dashboard: router({
    stats: adminProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
    
    recentEnrollments: adminProcedure.query(async () => {
      return await db.getAllEnrollmentsWithDetails(5);
    }),
  }),

  // User management
  users: router({
    // Admin: List all users
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    // Admin: Get user by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        return user;
      }),

    // User: Update own profile
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        logger.info('[USER] Updating profile', { userId: ctx.user.id });

        await db.updateUser(ctx.user.id, {
          name: input.name,
          phone: input.phone,
        });

        logger.info('[USER] Profile updated successfully', { userId: ctx.user.id });
        
        return { success: true };
      }),

    // User: Update notification preferences
    updateNotificationPrefs: protectedProcedure
      .input(z.object({
        support_replies: z.boolean().optional(),
        recommendations: z.boolean().optional(),
        course_updates: z.boolean().optional(),
        admin_announcements: z.boolean().optional(),
        language: z.enum(["ar", "en"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }
        const current = JSON.parse((ctx.user as any).notificationPrefs || '{}');
        const updated = { ...current, ...input };
        await db.updateUser(ctx.user.id, { notificationPrefs: JSON.stringify(updated) });
        return { success: true, prefs: updated };
      }),

    touchInteraction: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await db.touchUserInteraction(ctx.user.id);
      return { success: true };
    }),

    // User: Update login security mode
    updateLoginSecurity: protectedProcedure
      .input(z.object({
        loginSecurityMode: z.enum(["password_or_otp", "password_only", "password_plus_otp"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        await db.updateUser(ctx.user.id, {
          loginSecurityMode: input.loginSecurityMode,
        });

        logger.info('[USER] Login security mode updated', {
          userId: ctx.user.id,
          loginSecurityMode: input.loginSecurityMode,
        });

        return { success: true };
      }),

    // User: Get own enrollments
    getUserEnrollments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      logger.info('[USER] Getting enrollments', { userId: ctx.user.id });
      
      const enrollments = await db.getEnrollmentsByUserId(ctx.user.id);
      
      return enrollments.map((enrollment: any) => ({
        id: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        courseName: enrollment.courseName || 'Unknown Course',
        progressPercentage: enrollment.progressPercentage,
        completedEpisodes: enrollment.completedEpisodes,
        totalEpisodes: enrollment.totalEpisodes || 0,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      }));
    }),

    // User: Get own statistics
    getUserStats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      logger.info('[USER] Getting statistics', { userId: ctx.user.id });
      
      const stats = await db.getUserStatistics(ctx.user.id);
      
      return stats;
    }),

    // User: Sync entitlements from any assigned keys (courses + LexAI)
    syncEntitlements: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.email) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User email is required' });
      }

      // Disabled as an automatic dashboard command.
      // Login/register already perform entitlement sync, and mount-driven re-entry here caused repeated expiry mutations.
      return { success: true, skipped: true };
    }),
  }),

  // Course management
  courses: router({
    // Public: Get all published courses
    list: publicProcedure.query(async () => {
      return await db.getPublishedCourses();
    }),

    // Public: Get free courses (price = 0)
    free: publicProcedure.query(async () => {
      return await db.getFreeCourses();
    }),

    // Admin: Get all courses (including unpublished)
    listAll: adminProcedure.query(async () => {
      return await db.getAllCourses();
    }),

    // Alias for getAllCourses (used by AdminKeys page)
    getAllCourses: adminProcedure.query(async () => {
      return await db.getAllCourses();
    }),

    // Public: Get course by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const course = await db.getCourseById(input.id);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        return course;
      }),

    // Admin: Create course
    create: adminProcedure
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().min(1),
        descriptionAr: z.string().min(1),
        thumbnailUrl: z.string().optional(),
        price: z.number().default(0),
        currency: z.string().default("USD"),
        isPublished: z.boolean().default(false),
        level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
        duration: z.number().optional(),
        stageNumber: z.number().default(0),
        introVideoUrl: z.string().optional(),
        hasPdf: z.boolean().default(false),
        hasIntroVideo: z.boolean().default(false),
        pdfUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.create', { title: input.titleEn }, ctx.admin?.id);
        const courseId = await db.createCourse(input);
        logger.info('Course created successfully', { courseId });
        return { id: courseId };
      }),

    // Admin: Update course
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        descriptionEn: z.string().min(1).optional(),
        descriptionAr: z.string().min(1).optional(),
        thumbnailUrl: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        isPublished: z.boolean().optional(),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        duration: z.number().optional(),
        stageNumber: z.number().optional(),
        introVideoUrl: z.string().optional(),
        hasPdf: z.boolean().optional(),
        hasIntroVideo: z.boolean().optional(),
        pdfUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.update', { id: input.id }, ctx.admin?.id);
        const { id, ...updates } = input;
        await db.updateCourse(id, updates);
        logger.info('Course updated successfully', { id });
        return { success: true };
      }),

    // Admin: Delete course
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.delete', input, ctx.admin?.id);
        await db.deleteCourse(input.id);
        logger.info('Course deleted successfully', input);
        return { success: true };
      }),
  }),

  // Episode management
  episodes: router({
    // Public: Get episodes for a course
    listByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEpisodesByCourseId(input.courseId);
      }),

    // Admin: Get episode by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const episode = await db.getEpisodeById(input.id);
        if (!episode) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' });
        }
        return episode;
      }),

    // Admin: Create episode
    create: adminProcedure
      .input(z.object({
        courseId: z.number(),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        order: z.number(),
        isFree: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const episodeId = await db.createEpisode(input);
        return { id: episodeId };
      }),

    // Admin: Update episode
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        order: z.number().optional(),
        isFree: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateEpisode(id, updates);
        return { success: true };
      }),

    // Admin: Delete episode
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // Archive the video in R2 before deleting the DB record
        const episode = await db.getEpisodeById(input.id);
        if (episode?.videoUrl) {
          try {
            const env = getWorkerEnv();
            if (env?.VIDEOS_BUCKET) {
              const url = new URL(episode.videoUrl);
              const r2Key = decodeURIComponent(url.pathname.replace(/^\//, ''));
              await storageArchiveR2(env.VIDEOS_BUCKET, r2Key);
            }
          } catch {
            // Log but don't block deletion if archive fails
            console.error(`Failed to archive video for episode ${input.id}`);
          }
        }
        await db.deleteEpisode(input.id);
        return { success: true };
      }),
  }),

  // Enrollment management
  enrollments: router({
    // Admin: Get all enrollments
    listAll: adminProcedure.query(async () => {
      return await db.getAllEnrollmentsWithDetails();
    }),

    // User: Get my enrollments
    myEnrollments: protectedProcedure.query(async ({ ctx }) => {
      logger.procedure('enrollments.myEnrollments', undefined, ctx.user.id);
      return await db.getEnrollmentsByUserId(ctx.user.id);
    }),

    // User: Enroll in a course
    enroll: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        paymentAmount: z.number().optional(),
        paymentCurrency: z.string().default("USD"),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.enroll', input, ctx.user.id);
        // Check if already enrolled
        const existing = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (existing) {
          logger.warn('User already enrolled in course', { userId: ctx.user.id, courseId: input.courseId });
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already enrolled in this course' });
        }

        const enrollmentId = await db.createEnrollment({
          userId: ctx.user.id,
          courseId: input.courseId,
          paymentAmount: input.paymentAmount,
          paymentCurrency: input.paymentCurrency,
          paymentStatus: input.paymentAmount ? 'pending' : 'completed',
          isSubscriptionActive: true,
        });

        logger.info('User enrolled in course successfully', { enrollmentId, userId: ctx.user.id, courseId: input.courseId });
        return { id: enrollmentId };
      }),

    // User: Update enrollment progress
    updateProgress: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        progressPercentage: z.number(),
        completedEpisodes: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateEnrollment(input.enrollmentId, {
          progressPercentage: input.progressPercentage,
          completedEpisodes: input.completedEpisodes,
          lastAccessed: new Date().toISOString(),
        });
        return { success: true };
      }),
    // Get enrollment for a specific course
    getEnrollment: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          return null;
        }
        return enrollment;
      }),
    // Mark episode as complete
    markEpisodeComplete: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
        watchedDuration: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.markEpisodeComplete', input, ctx.user.id);
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          logger.error('Enrollment not found for episode completion', { userId: ctx.user.id, courseId: input.courseId });
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
        const { episode, episodes } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        const existingEpisodeProgress = await db.getUserEpisodeProgress(ctx.user.id, input.episodeId);
        if (existingEpisodeProgress?.isCompleted) {
          return { success: true, alreadyCompleted: true };
        }

        // Enforce a minimum watch duration (70% of episode duration, minimum 60s)
        const requiredWatchSeconds = episode.duration && episode.duration > 0
          ? Math.max(60, Math.floor(episode.duration * 0.7))
          : 60;
        const watchedDuration = Math.max(
          Number(existingEpisodeProgress?.watchedDuration || 0),
          Math.floor(Number(input.watchedDuration || 0))
        );
        if (watchedDuration < requiredWatchSeconds) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Watch more of this episode before marking complete (${Math.ceil(requiredWatchSeconds / 60)} min required).`,
          });
        }

        // Intro episode (order = 1) is exempt from quiz gating
        if (episode.order > 1) {
          const quizLevel = episode.order - 1;
          const quiz = await db.getQuizByLevel(quizLevel);
          if (!quiz) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Quiz is not configured for this episode yet.',
            });
          }

          const hasPassedQuiz = await db.hasUserPassedQuizLevel(ctx.user.id, quizLevel);
          if (!hasPassedQuiz) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Pass the episode quiz (${quiz.passingScore}% required) before continuing.`,
            });
          }
        }

        await db.createOrUpdateEpisodeProgress({
          userId: ctx.user.id,
          episodeId: input.episodeId,
          courseId: input.courseId,
          watchedDuration: Math.max(watchedDuration, requiredWatchSeconds),
          isCompleted: true,
          lastWatchedAt: new Date().toISOString(),
        });

        // Compute progress from completed per-episode records
        const totalEpisodes = episodes.length;
        const courseProgress = await db.getUserCourseProgress(ctx.user.id, input.courseId);
        const completedEpisodeIds = new Set(
          courseProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)
        );
        const completedEpisodes = episodes.filter((ep) => completedEpisodeIds.has(ep.id)).length;
        const progressPercentage = Math.round((completedEpisodes / totalEpisodes) * 100);
        
        await db.updateEnrollment(enrollment.id, {
          completedEpisodes,
          progressPercentage,
          lastAccessed: new Date().toISOString(),
          completedAt: completedEpisodes >= totalEpisodes ? new Date().toISOString() : null,
        });

        // When course is 100% complete, immediately activate pending subscriptions
        // At lower percentages, just check if maxActivationDate has passed (14-day deadline)
        let subscriptionActivated = false;
        if (completedEpisodes >= totalEpisodes) {
          // Notify: course completed
          await db.createNotification({
            userId: ctx.user.id,
            type: 'success',
            titleAr: 'مبروك! أكملت الدورة بنجاح 🎉',
            titleEn: 'Congratulations! Course Completed 🎉',
            contentAr: 'أكملت جميع الحلقات. يمكنك الآن البدء بإعداد حساب الوسيط.',
            contentEn: 'You completed all episodes. You can now start your broker account setup.',
            actionUrl: '/broker-onboarding',
          }).catch(() => {});

          // Only activate subscriptions if broker onboarding is also complete
          const brokerDone = await db.isUserBrokerOnboardingComplete(ctx.user.id);
          if (brokerDone) {
            const activation = await db.activateStudentSubscriptions(ctx.user.id, false);
            subscriptionActivated = activation.activated;
          }

          // Notify admin of course completion
          db.notifyStaffByEvent('course_completion', {
            titleEn: `Course completed: ${ctx.user.name || ctx.user.email}`,
            titleAr: `تم إكمال الكورس: ${ctx.user.name || ctx.user.email}`,
            contentEn: `Student ${ctx.user.email} completed 100% of the course.`,
            contentAr: `الطالب ${ctx.user.email} أكمل 100% من الكورس.`,
            metadata: { userId: ctx.user.id, courseId: input.courseId },
          }).catch(() => {});
        } else if (progressPercentage >= 50) {
          const activationStatus = await db.getPendingActivationStatus(ctx.user.id);
          subscriptionActivated = activationStatus.hasPending === false && !activationStatus.lexai && !activationStatus.recommendation;
        }

        logger.info('Episode marked as complete', { 
          userId: ctx.user.id, 
          episodeId: input.episodeId, 
          courseId: input.courseId,
          progress: progressPercentage,
          completed: completedEpisodes >= totalEpisodes
        });
        return { success: true, progressPercentage, reachedHalfway: progressPercentage >= 50 };
      }),

    // Admin/Support: Skip course for a user (flag-only, preserves real progress)
    skipCourse: adminOrRoleProcedure(['key_manager', 'support'])
      .input(z.object({
        userId: z.number(),
        courseId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.skipCourse', input, ctx.user.id);
        const result = await db.skipCourseForUser(input.userId, input.courseId);

        // Log admin action for audit trail
        await db.logAdminAction(ctx.user.id, input.userId, 'skip_course', {
          courseId: input.courseId,
          enrollmentId: result.enrollmentId,
          previousProgress: result.previousProgress,
          activated: result.activated,
        });

        logger.info('Course skipped for user by admin (flag-only)', {
          adminId: ctx.user.id,
          userId: input.userId,
          courseId: input.courseId,
          previousProgress: result.previousProgress,
          activated: result.activated,
        });
        return { success: true, ...result };
      }),

    // Admin/Support: Rollback a skip (restores pending state if not genuinely completed)
    rollbackSkip: adminOrRoleProcedure(['key_manager', 'support'])
      .input(z.object({
        userId: z.number(),
        courseId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.rollbackSkip', input, ctx.user.id);
        const result = await db.rollbackSkipCourse(input.userId, input.courseId);

        await db.logAdminAction(ctx.user.id, input.userId, 'rollback_skip', {
          courseId: input.courseId,
          enrollmentId: result.enrollmentId,
          restoredProgress: result.restoredProgress,
        });

        logger.info('Course skip rolled back by admin', {
          adminId: ctx.user.id,
          userId: input.userId,
          courseId: input.courseId,
          restoredProgress: result.restoredProgress,
        });
        return { success: true, ...result };
      }),

    // Admin: Get admin action history for a user
    adminActions: adminOrRoleProcedure(['key_manager', 'support'])
      .input(z.object({
        userId: z.number(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        return db.getAdminActionsForUser(input.userId, input.limit);
      }),

    // Admin: Skip broker onboarding for a user (QC testing)
    skipBrokerOnboarding: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.skipBrokerOnboarding', input, ctx.user.id);
        return db.skipBrokerOnboardingForUser(input.userId, ctx.user.id);
      }),

    // Admin: Rollback broker onboarding skip
    rollbackBrokerSkip: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.rollbackBrokerSkip', input, ctx.user.id);
        return db.rollbackBrokerOnboardingSkip(input.userId, ctx.user.id);
      }),

    // Student timeline for troubleshooting (requires 'view_progress' or admin)
    studentTimeline: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_progress']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View progress permission required' });
        }
        return db.getStudentTimeline(input.userId);
      }),
  }),

  episodeQuiz: router({
    getForEpisode: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { episode } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        if (episode.order <= 1) {
          return { required: false, passed: true, introEpisode: true, quiz: null };
        }

        const quizLevel = episode.order - 1;
        const quiz = await db.getQuizForLevelWithQuestions(quizLevel);

        if (!quiz) {
          return { required: true, passed: false, introEpisode: false, quiz: null };
        }

        const passed = await db.hasUserPassedQuizLevel(ctx.user.id, quizLevel);

        return {
          required: true,
          passed,
          introEpisode: false,
          quiz,
        };
      }),

    submitForEpisode: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
        answers: z.array(z.object({
          questionId: z.number(),
          optionId: z.string().min(1),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const { episode } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        if (episode.order <= 1) {
          return {
            score: 100,
            passed: true,
            correctCount: 0,
            totalQuestions: 0,
            passingScore: 50,
            detailedResults: [],
            introEpisode: true,
          };
        }

        const quizLevel = episode.order - 1;
        const quiz = await db.getQuizByLevel(quizLevel);
        if (!quiz) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Quiz is not configured for this episode.',
          });
        }

        return await db.submitEpisodeQuizAttempt(ctx.user.id, quizLevel, input.answers);
      }),
  }),

  // =============================================
  // USER QUIZ (standalone /quiz page)
  // =============================================
  userQuiz: router({
    // Get progress for all levels (used by /quiz page)
    progress: protectedProcedure.query(async ({ ctx }) => {
      await requireActivePackage(ctx.user.id);
      return db.getUserQuizProgress(ctx.user.id);
    }),

    // Get quiz questions for a specific level
    getLevel: protectedProcedure
      .input(z.object({ level: z.number().min(1).max(20) }))
      .query(async ({ ctx, input }) => {
        await requireActivePackage(ctx.user.id);
        const canAccess = await db.canAccessQuizLevel(ctx.user.id, input.level);
        if (!canAccess) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'هذا المستوى مقفل. أكمل المستوى السابق أولاً',
          });
        }
        const quiz = await db.getQuizForLevelWithQuestions(input.level);
        if (!quiz) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Quiz not found for this level.',
          });
        }
        return quiz;
      }),

    // Submit quiz answers
    submit: protectedProcedure
      .input(z.object({
        quizId: z.number(),
        level: z.number().min(1),
        answers: z.array(z.object({
          questionId: z.number(),
          optionId: z.string().min(1),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireActivePackage(ctx.user.id);
        const quiz = await db.getQuizByLevel(input.level);
        if (!quiz || quiz.id !== input.quizId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Quiz not found.',
          });
        }
        return db.submitEpisodeQuizAttempt(ctx.user.id, input.level, input.answers);
      }),

    // Get attempt history for a level
    history: protectedProcedure
      .input(z.object({ level: z.number().min(1).max(20) }))
      .query(async ({ ctx, input }) => {
        return db.getQuizHistoryForLevel(ctx.user.id, input.level);
      }),
  }),

  // Episode progress tracking (per user)
  episodeProgress: router({
    updateProgress: protectedProcedure
      .input(
        z.object({
          episodeId: z.number(),
          courseId: z.number(),
          watchedDuration: z.number().min(0),
          isCompleted: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureEpisodeUnlockedForUser(ctx.user.id, input.courseId, input.episodeId);

        await db.createOrUpdateEpisodeProgress({
          userId: ctx.user.id,
          episodeId: input.episodeId,
          courseId: input.courseId,
          watchedDuration: Math.floor(input.watchedDuration),
          isCompleted: input.isCompleted ?? false,
          lastWatchedAt: new Date().toISOString(),
        });

        return { success: true };
      }),

    getCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserCourseProgress(ctx.user.id, input.courseId);
      }),
  }),

  // File upload helper
  upload: router({
    image: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[Upload] Uploading image', { fileName: input.fileName });
        
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'R2 bucket not configured' });
        }

        try {
          // Generate unique file key
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileKey = `courses/images/${Date.now()}-${randomSuffix}-${input.fileName}`;
          
          // Convert base64 to buffer
          const buffer = Buffer.from(input.fileData, 'base64');
          
          // Upload to R2
          const result = await storagePutR2(env.VIDEOS_BUCKET, fileKey, buffer, input.contentType);
          
          logger.info('[Upload] Image uploaded successfully', { url: result.url });
          return { url: result.url, key: result.key };
        } catch (error) {
          logger.error('[Upload] Image upload failed', { error });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload image' });
        }
      }),
    
    video: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[Upload] Uploading video', { fileName: input.fileName });
        
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'R2 bucket not configured' });
        }

        try {
          // Generate unique file key
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileKey = `courses/videos/${Date.now()}-${randomSuffix}-${input.fileName}`;
          
          // Convert base64 to buffer
          const buffer = Buffer.from(input.fileData, 'base64');
          
          // Upload to R2
          const result = await storagePutR2(env.VIDEOS_BUCKET, fileKey, buffer, input.contentType);
          
          logger.info('[Upload] Video uploaded successfully', { url: result.url });
          return { url: result.url, key: result.key };
        } catch (error) {
          logger.error('[Upload] Video upload failed', { error });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload video' });
        }
      }),
  }),

  // LexAI - AI Currency Analysis Chat
  lexai: router({
    // Get active subscription for current user
    getSubscription: userOnlyProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting subscription', { userId: ctx.user.id });
      const subscription = await db.getActiveLexaiSubscription(ctx.user.id);

      if (!subscription) {
        // Check if subscription is frozen
        const frozen = await db.getFrozenLexaiSubscription(ctx.user.id);
        if (frozen) {
          return { isFrozen: true, frozenUntil: frozen.frozenUntil ?? null, frozenReason: frozen.pausedReason ?? null };
        }
        return null;
      }

      if (subscription.endDate) {
        const endDate = new Date(subscription.endDate);
        const shouldEnforceExpiry = Number(subscription.messagesUsed ?? 0) > 0;
        if (shouldEnforceExpiry && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
          await db.updateLexaiSubscription(subscription.id, { isActive: false });
          return null;
        }
      }

      return subscription;
    }),

    // Create new subscription
    createSubscription: userOnlyProcedure
      .input(z.object({
        paymentAmount: z.number(),
        durationMonths: z.number().default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.warn('[LexAI] Blocked direct subscription creation', {
          userId: ctx.user.id,
          paymentAmount: input.paymentAmount,
          durationMonths: input.durationMonths,
        });

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Subscription creation is disabled. Please activate a registration key.",
        });
      }),

    // Get chat messages
    getMessages: userOnlyProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting messages', { userId: ctx.user.id });
      const messages = await db.getLexaiMessagesByUser(ctx.user.id, 100);
      return messages;
    }),

    clearHistory: userOnlyProcedure.mutation(async ({ ctx }) => {
      logger.info('[LexAI] Clearing chat history', { userId: ctx.user.id });
      await db.deleteLexaiMessagesByUser(ctx.user.id);
      return { success: true };
    }),

    uploadImage: userOnlyProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "R2 bucket not configured" });
        }

        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `lexai/${ctx.user.id}/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const buffer = Buffer.from(input.fileData, "base64");
        const result = await storagePutR2(env.VIDEOS_BUCKET, key, buffer, input.contentType);

        return { url: result.url, key: result.key };
      }),

    analyzeM15: userOnlyProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "m15",
          language: "ar",
          timeframe: "M15",
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: "M15",
          imageUrl: input.imageUrl,
          analysisType: "m15",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "m15",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeH4: userOnlyProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const previous = await getLatestLexaiAnalysis(ctx.user.id, "m15");

        if (!previous) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "M15 analysis required before H4" });
        }

        const analysis = await analyzeLexai({
          flow: "h4",
          language: "ar",
          timeframe: "H4",
          imageUrl: input.imageUrl,
          previousAnalysis: previous.content,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: "H4",
          imageUrl: input.imageUrl,
          analysisType: "h4",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "h4",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeSingle: userOnlyProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
        timeframe: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "single",
          language: "ar",
          timeframe: input.timeframe || "M15",
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.timeframe || "M15",
          imageUrl: input.imageUrl,
          analysisType: "single",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "single",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeFeedback: userOnlyProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback",
          language: "ar",
          userAnalysis: input.userAnalysis,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.userAnalysis,
          analysisType: "feedback",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "feedback",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeFeedbackWithImage: userOnlyProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback_with_image",
          language: "ar",
          userAnalysis: input.userAnalysis,
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.userAnalysis,
          imageUrl: input.imageUrl,
          analysisType: "feedback_with_image",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "feedback_with_image",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    // Get subscription stats (admin)
    getStats: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting stats');
      const stats = await db.getLexaiStats();
      return stats;
    }),
  }),

  recommendations: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const access = await db.getUserRecommendationsAccess(ctx.user.id);
      return {
        userId: ctx.user.id,
        canPublish: access.canPublish,
        hasSubscription: access.hasSubscription,
        subscription: access.subscription,
        isFrozen: access.isFrozen,
        frozenUntil: access.frozenUntil,
        frozenReason: access.frozenReason,
      };
    }),

    publishState: protectedProcedure.query(async ({ ctx }) => {
      await ensureRecommendationPublishAccess(ctx);
      return db.getRecommendationPublishState(ctx.user.id);
    }),

    activeAlerts: protectedProcedure.query(async ({ ctx }) => {
      await ensureRecommendationReadAccess(ctx);
      return db.listActiveRecommendationAlerts();
    }),

    feed: protectedProcedure
      .input(z.object({ limit: z.number().min(20).max(500).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        return await db.getRecommendationMessagesFeed(ctx.user.id, input?.limit ?? 200);
      }),

    muteThread: protectedProcedure
      .input(z.object({ threadRootMessageId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        return await db.muteRecommendationThread(ctx.user.id, input.threadRootMessageId);
      }),

    unmuteThread: protectedProcedure
      .input(z.object({ threadRootMessageId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        return await db.unmuteRecommendationThread(ctx.user.id, input.threadRootMessageId);
      }),

    notifyClients: protectedProcedure
      .input(z.object({
        note: z.string().max(200).optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);

        const alert = await db.createRecommendationAlert({
          analystUserId: ctx.user.id,
          note: input?.note,
        });

        const subscribers = await db.getRecommendationSubscriberDetails();
        const recipients = subscribers.filter((sub) => recommendationNotificationsEnabled(sub.notificationPrefs));
        const copy = buildRecommendationAlertNotificationCopy();
        const batchId = `rec_alert_${alert.id}_${Date.now()}`;

        if (recipients.length) {
          await db.sendBulkNotification({
            userIds: recipients.map((sub) => sub.userId),
            type: 'info',
            titleEn: copy.titleEn,
            titleAr: copy.titleAr,
            contentEn: copy.contentEn,
            contentAr: copy.contentAr,
            actionUrl: '/recommendations',
            batchId,
          });
        }

        const inactivityThreshold = new Date(Date.now() - RECOMMENDATION_EMAIL_INACTIVE_MINUTES * 60 * 1000);
        const emailCandidates = recipients.filter((sub) => isRecommendationEmailCandidate(sub.lastInteractiveAt, inactivityThreshold));
        const emailResults = await Promise.allSettled(
          emailCandidates.map(async (sub) => {
            const emailCopy = buildRecommendationAlertEmail({
              language: getPreferredNotificationLanguage(sub.notificationPrefs),
              unlockSeconds: RECOMMENDATION_ALERT_UNLOCK_SECONDS,
            });
            await sendEmail({
              to: sub.email,
              subject: emailCopy.subject,
              text: emailCopy.text,
              html: emailCopy.html,
            });
            await db.markNotificationEmailSent(batchId, sub.userId);
            return sub.userId;
          })
        );

        const emailCount = emailResults.filter((result) => result.status === 'fulfilled').length;

        const isAdmin = !!(ctx.user?.email && await db.getAdminByEmail(ctx.user.email));
        if (ctx.user?.isStaff && !isAdmin) {
          await writeStaffActivityLog({
            ctx: { ...ctx, admin: null },
            path: 'recommendations.notifyClients',
            type: 'mutation',
            input: {
              alertId: alert.id,
              recipientCount: recipients.length,
              emailCount,
            },
          });
        }

        return {
          success: true,
          alert,
          recipientCount: recipients.length,
          emailCount,
        };
      }),

    cancelAlert: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);
        const isAdmin = !!(ctx.user?.email && await db.getAdminByEmail(ctx.user.email));
        await db.cancelRecommendationAlert(input.alertId, ctx.user.id, isAdmin);

        if (ctx.user?.isStaff && !isAdmin) {
          await writeStaffActivityLog({
            ctx: { ...ctx, admin: null },
            path: 'recommendations.cancelAlert',
            type: 'mutation',
            input,
          });
        }

        return { success: true };
      }),

    postMessage: protectedProcedure
      .input(
        z.object({
          type: z.enum(["recommendation", "update", "result"]),
          content: z.string().min(3).max(4000),
          symbol: z.string().max(30).optional(),
          side: z.string().max(10).optional(),
          entryPrice: z.string().max(50).optional(),
          stopLoss: z.string().max(50).optional(),
          takeProfit1: z.string().max(50).optional(),
          takeProfit2: z.string().max(50).optional(),
          riskPercent: z.string().max(20).optional(),
          parentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);

        const trimmedContent = input.content.trim();
        if (trimmedContent.length < 3) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please write a clear message first.' });
        }

        const isAdmin = !!(ctx.user?.email && await db.getAdminByEmail(ctx.user.email));
        const publishState = await db.getRecommendationPublishState(ctx.user.id);
        if (!publishState.activeAlert) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Notify clients first, then wait one minute before sending in the recommendations channel.',
          });
        }
        if (!publishState.canPostMessages) {
          if (publishState.secondsUntilUnlock > 0) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Wait ${publishState.secondsUntilUnlock} more seconds before sending the next channel message.`,
            });
          }
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'The chat paused after 15 minutes of analyst silence. Notify clients again before sending a new message.',
          });
        }

        let messageId: number;
        let parentMessage: Awaited<ReturnType<typeof db.getRecommendationMessageById>> | null = null;
        let rootMessageForDelivery: {
          content: string;
          symbol?: string | null;
          side?: string | null;
          entryPrice?: string | null;
          stopLoss?: string | null;
          takeProfit1?: string | null;
          takeProfit2?: string | null;
          riskPercent?: string | null;
        } | null = null;
        let notificationSymbol: string | null | undefined;
        const linkedAlertId = publishState.activeAlert.id;

        if (input.type === 'recommendation') {
          if (input.parentId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Top-level recommendations cannot be posted inside another thread.' });
          }

          const normalizedSymbol = input.symbol?.trim().toUpperCase();
          if (!normalizedSymbol) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose the symbol first.' });
          }

          rootMessageForDelivery = {
            content: trimmedContent,
            symbol: normalizedSymbol,
            side: input.side?.trim() || undefined,
            entryPrice: input.entryPrice?.trim() || undefined,
            stopLoss: input.stopLoss?.trim() || undefined,
            takeProfit1: input.takeProfit1?.trim() || undefined,
            takeProfit2: input.takeProfit2?.trim() || undefined,
            riskPercent: input.riskPercent?.trim() || undefined,
          };
          notificationSymbol = normalizedSymbol;

          messageId = await db.createRecommendationMessage({
            userId: ctx.user.id,
            type: input.type,
            content: trimmedContent,
            symbol: normalizedSymbol,
            side: input.side,
            entryPrice: input.entryPrice,
            stopLoss: input.stopLoss,
            takeProfit1: input.takeProfit1,
            takeProfit2: input.takeProfit2,
            riskPercent: input.riskPercent,
            parentId: null,
            threadStatus: 'open',
            closedAt: null,
            closedByUserId: null,
            createdAt: new Date().toISOString(),
          });
        } else {
          if (!input.parentId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose the parent recommendation first.' });
          }

          parentMessage = await db.getRecommendationMessageById(input.parentId);
          if (!parentMessage) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent recommendation not found.' });
          }
          if (parentMessage.type !== 'recommendation') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Replies and results can only be added to an existing recommendation.' });
          }

          const normalizedSymbol = input.symbol?.trim().toUpperCase();
          if (normalizedSymbol && parentMessage.symbol && normalizedSymbol !== parentMessage.symbol) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Same-trade updates must stay on the original recommendation symbol.',
            });
          }

          rootMessageForDelivery = {
            content: parentMessage.content || '',
            symbol: parentMessage.symbol ?? normalizedSymbol ?? undefined,
            side: parentMessage.side ?? undefined,
            entryPrice: parentMessage.entryPrice ?? undefined,
            stopLoss: parentMessage.stopLoss ?? undefined,
            takeProfit1: parentMessage.takeProfit1 ?? undefined,
            takeProfit2: parentMessage.takeProfit2 ?? undefined,
            riskPercent: parentMessage.riskPercent ?? undefined,
          };
          notificationSymbol = parentMessage.symbol ?? normalizedSymbol ?? undefined;

          messageId = await db.createRecommendationMessage({
            userId: ctx.user.id,
            type: input.type,
            content: trimmedContent,
            symbol: parentMessage.symbol ?? normalizedSymbol ?? undefined,
            side: input.side,
            entryPrice: input.entryPrice,
            stopLoss: input.stopLoss,
            takeProfit1: input.takeProfit1,
            takeProfit2: input.takeProfit2,
            riskPercent: input.riskPercent,
            parentId: input.parentId,
            createdAt: new Date().toISOString(),
          });
        }

        const threadRootMessageId = parentMessage?.id ?? messageId;

        await db.extendRecommendationAlertActivity(linkedAlertId, ctx.user.id);

        const allSubs = await db.getRecommendationSubscriberDetails();
        const optedInRecipients = allSubs.filter((sub) => recommendationNotificationsEnabled(sub.notificationPrefs));
        const mutedUserIds = input.type === 'recommendation'
          ? []
          : await db.getMutedRecommendationUserIdsForThread(
              threadRootMessageId,
              optedInRecipients.map((sub) => sub.userId),
            );
        const recipients = input.type === 'recommendation'
          ? optedInRecipients
          : filterRecipientsByMutedThreads(optedInRecipients, mutedUserIds);
        const batchId = `rec_live_${messageId}`;

        if (recipients.length && rootMessageForDelivery) {
          const notificationCopy = buildRecommendationMessageNotificationCopy({
            type: input.type,
            symbol: notificationSymbol,
            content: trimmedContent,
          });

          await db.sendBulkNotification({
            userIds: recipients.map((sub) => sub.userId),
            type: 'info',
            titleEn: notificationCopy.titleEn,
            titleAr: notificationCopy.titleAr,
            contentEn: notificationCopy.contentEn,
            contentAr: notificationCopy.contentAr,
            actionUrl: '/recommendations',
            batchId,
          });

          const inactivityThreshold = new Date(Date.now() - RECOMMENDATION_EMAIL_INACTIVE_MINUTES * 60 * 1000);
          await Promise.allSettled(
            recipients
              .filter((sub) => isRecommendationEmailCandidate(sub.lastInteractiveAt, inactivityThreshold))
              .map(async (sub) => {
                const emailCopy = buildRecommendationMessageEmail({
                  language: getPreferredNotificationLanguage(sub.notificationPrefs),
                  type: input.type,
                  recommendation: rootMessageForDelivery!,
                  latestMessage: input.type === 'recommendation' ? undefined : { content: trimmedContent },
                  threadUnfollowUrl: input.type === 'recommendation'
                    ? undefined
                    : buildRecommendationThreadUnfollowUrl(threadRootMessageId),
                });

                await sendEmail({
                  to: sub.email,
                  subject: emailCopy.subject,
                  text: emailCopy.text,
                  html: emailCopy.html,
                });
                await db.markNotificationEmailSent(batchId, sub.userId);
              })
          );
        }

        if (ctx.user?.isStaff && !isAdmin) {
          await writeStaffActivityLog({
            ctx: { ...ctx, admin: null },
            path: 'recommendations.postMessage',
            type: 'mutation',
            input: {
              type: input.type,
              symbol: input.symbol?.trim().toUpperCase(),
              side: input.side,
              parentId: input.parentId,
              alertId: linkedAlertId,
            },
          });
        }

        return { success: true, messageId };
      }),

    closeThread: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);

        const rootMessage = await db.getRecommendationMessageById(input.messageId);
        if (!rootMessage) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recommendation thread not found.' });
        }
        if (rootMessage.parentId || rootMessage.type !== 'recommendation') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only top-level recommendations can be closed.' });
        }
        if (rootMessage.threadStatus === 'closed') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This recommendation thread is already closed.' });
        }

        const hasResultChild = await db.hasRecommendationResultChild(rootMessage.id);
        if (!hasResultChild) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add a result before closing this recommendation thread.' });
        }

        const isAdmin = !!(ctx.user?.email && await db.getAdminByEmail(ctx.user.email));
        await db.closeRecommendationThread(rootMessage.id, ctx.user.id);

        if (ctx.user?.isStaff && !isAdmin) {
          await writeStaffActivityLog({
            ctx: { ...ctx, admin: null },
            path: 'recommendations.closeThread',
            type: 'mutation',
            input,
          });
        }

        return { success: true };
      }),

    react: protectedProcedure
      .input(
        z.object({
          messageId: z.number(),
          reaction: z.enum(RECOMMENDATION_REACTIONS).nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        await db.setRecommendationReaction(input.messageId, ctx.user.id, input.reaction);
        return { success: true };
      }),

    deleteMessage: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);
        // Check admin status via DB lookup (ctx.admin only exists on adminProcedure)
        const isAdmin = !!(ctx.user?.email && await db.getAdminByEmail(ctx.user.email));
        await db.deleteRecommendationMessage(input.messageId, ctx.user.id, isAdmin);

        if (ctx.user?.isStaff && !isAdmin) {
          await writeStaffActivityLog({
            ctx: { ...ctx, admin: null },
            path: 'recommendations.deleteMessage',
            type: 'mutation',
            input,
          });
        }

        return { success: true };
      }),

  }),

  recommendationAdmin: router({
    listAnalysts: adminProcedure.query(async () => {
      return await db.getRecommendationPublishers();
    }),

    subscriptions: router({
      list: adminProcedure.query(async () => {
        return await db.getRecommendationSubscriptionsWithUsers();
      }),
      pause: adminProcedure
        .input(z.object({ subscriptionId: z.number(), reason: z.string().optional() }))
        .mutation(async ({ input }) => {
          await db.pauseRecommendationSubscription(input.subscriptionId, input.reason);
          return { success: true };
        }),
      resume: adminProcedure
        .input(z.object({ subscriptionId: z.number() }))
        .mutation(async ({ input }) => {
          await db.resumeRecommendationSubscription(input.subscriptionId);
          return { success: true };
        }),
    }),

    setAnalyst: adminProcedure
      .input(z.object({ userId: z.number(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (input.enabled) {
          // Ensure user is marked as staff so they appear in Admin Roles page
          await db.markUserAsStaff(input.userId);
          await db.assignRole(input.userId, 'analyst', (ctx as any).admin?.id);
        } else {
          await db.removeRole(input.userId, 'analyst');
        }
        return { success: true };
      }),
  }),

  lexaiAdmin: router({
    subscriptions: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting subscriptions (admin)');
      return await db.getLexaiSubscriptionsWithUsers();
    }),
    
    // Get all users with LexAI conversations (for admin moderation)
    conversationUsers: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting conversation users (admin)');
      return await db.getLexaiConversationUsers();
    }),
    
    // Get all messages (for admin moderation)
    allMessages: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(1000).optional() }).optional())
      .query(async ({ input }) => {
        logger.info('[LexAI] Getting all messages (admin)');
        return await db.getAllLexaiMessagesWithUsers(input?.limit ?? 500);
      }),
    
    // Get messages for a specific user (for admin moderation)
    userMessages: adminProcedure
      .input(z.object({ userId: z.number(), limit: z.number().min(1).max(500).optional() }))
      .query(async ({ input }) => {
        logger.info('[LexAI] Getting user messages (admin)', { userId: input.userId });
        return await db.getLexaiMessagesByUser(input.userId, input.limit ?? 100);
      }),
    
    // Delete a specific user's chat history (for admin moderation)
    deleteUserMessages: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[LexAI] Deleting user messages (admin)', { userId: input.userId, adminId: ctx.admin.id });
        await db.deleteLexaiMessagesByUser(input.userId);
        return { success: true };
      }),

    pauseSubscription: adminProcedure
      .input(z.object({ subscriptionId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.pauseLexaiSubscription(input.subscriptionId, input.reason);
        return { success: true };
      }),

    resumeSubscription: adminProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.resumeLexaiSubscription(input.subscriptionId);
        return { success: true };
      }),
  }),

  lexaiSupport: router({
    listCases: lexaiSupportProcedure
      .input(z.object({
        search: z.string().max(200).optional(),
        status: z.enum(LEXAI_SUPPORT_CASE_STATUSES).optional(),
        assignedToMe: z.boolean().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.listLexaiSupportCases({
          search: input?.search,
          status: input?.status,
          assignedToUserId: input?.assignedToMe ? ctx.user.id : undefined,
        });
      }),

    getCase: lexaiSupportProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const supportCase = await db.getLexaiSupportCase(input.caseId);
        if (!supportCase) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'LexAI support case not found' });
        }
        await db.markLexaiSupportCaseReviewed(input.caseId);
        return supportCase;
      }),

    addNote: lexaiSupportProcedure
      .input(z.object({
        caseId: z.number(),
        content: z.string().min(1).max(4000),
        noteType: z.enum(['note', 'assignment', 'status_change', 'admin_request']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.addLexaiSupportNote({
          caseId: input.caseId,
          authorUserId: ctx.user.id,
          content: input.content,
          noteType: input.noteType,
        });
        return { success: true };
      }),

    notes: lexaiSupportProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        return db.getLexaiSupportNotes(input.caseId);
      }),

    assignCase: lexaiSupportProcedure
      .input(z.object({ caseId: z.number(), assignedToUserId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await db.assignLexaiSupportCase(input.caseId, input.assignedToUserId, ctx.user.id, !!ctx.admin);
        return { success: true };
      }),

    updateStatus: lexaiSupportProcedure
      .input(z.object({
        caseId: z.number(),
        status: z.enum(LEXAI_SUPPORT_CASE_STATUSES),
        note: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateLexaiSupportCaseStatus(input.caseId, input.status, ctx.user.id, input.note);
        return { success: true };
      }),

    updatePriority: lexaiSupportProcedure
      .input(z.object({
        caseId: z.number(),
        priority: z.enum(LEXAI_SUPPORT_CASE_PRIORITIES),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateLexaiSupportCasePriority(input.caseId, input.priority, ctx.user.id);
        return { success: true };
      }),

    requestFollowup: lexaiSupportProcedure
      .input(z.object({ caseId: z.number(), note: z.string().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await db.requestLexaiSupportFollowup(input.caseId, ctx.user.id, input.note);
        return { success: true };
      }),

    pauseSubscription: adminProcedure
      .input(z.object({ subscriptionId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.pauseLexaiSubscription(input.subscriptionId, input.reason);
        return { success: true };
      }),

    resumeSubscription: adminProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.resumeLexaiSubscription(input.subscriptionId);
        return { success: true };
      }),

    deleteHistory: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLexaiMessagesByUser(input.userId);
        return { success: true };
      }),
  }),
  
  // Contact Support (public, sends email to admin)
  contactSupport: publicProcedure
    .input(z.object({
      email: z.string().email(),
      message: z.string().min(5).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const adminEmail = ENV.emailFrom || 'support@xflexacademy.com';
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[XFlex Support] New message from ${input.email}`,
          text: `New support message from: ${input.email}\n\n${input.message}\n\n---\nReply directly to ${input.email}`,
        });
      } catch (e) {
        logger.error('[CONTACT] Failed to send contact form email', { email: input.email, error: e });
        // Still return success — the message intent is captured in logs
      }
      return { success: true };
    }),

  // =========================================================================
  // Support Chat – real-time 1-on-1 client↔support messaging
  // =========================================================================

  // ── Working-hours & AI auto-reply helpers ──────────────────────────────
  // Jordan working hours: Sun-Thu 12:00-20:00 (Asia/Amman, UTC+3)
  // Outside those hours, GPT-4o-mini answers automatically.
  // ──────────────────────────────────────────────────────────────────────

  supportChat: router({
    // Upload attachment (file or voice note) to R2
    uploadAttachment: protectedProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded
        fileName: z.string(),
        contentType: z.string(),
        attachmentType: z.enum(['file', 'voice']).default('file'),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'R2 bucket not configured' });
        }

        const buffer = Buffer.from(input.fileData, 'base64');
        // Limit: 5MB for files, 2MB for voice
        const maxSize = input.attachmentType === 'voice' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'File too large' });
        }

        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `support/${ctx.user.id}/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const result = await storagePutR2(env.VIDEOS_BUCKET, key, buffer, input.contentType);
        return { url: result.url, key: result.key, size: buffer.length };
      }),

    // Client: get or create their conversation & messages
    myConversation: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const conv = await db.getOrCreateSupportConversation(ctx.user.id);
      const messages = await db.getSupportMessages(conv.id);
      // Mark support/admin replies as read
      await db.markClientMessagesRead(conv.id);
      return { conversation: conv, messages };
    }),

    // Client: send a message (with optional attachment)
    send: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(5000),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentSize: z.number().optional(),
        attachmentType: z.enum(['file', 'voice']).optional(),
        attachmentDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const conv = await db.getOrCreateSupportConversation(ctx.user.id);
        const msg = await db.createSupportMessage({
          conversationId: conv.id,
          senderId: ctx.user.id,
          senderType: 'client',
          content: input.content,
          attachmentUrl: input.attachmentUrl,
          attachmentName: input.attachmentName,
          attachmentSize: input.attachmentSize,
          attachmentType: input.attachmentType,
          attachmentDuration: input.attachmentDuration,
        });

        // AI auto-reply when outside working hours and student hasn't requested human
        if (!isSupportWorkingHours() && !conv.needsHuman) {
          const allMessages = await db.getSupportMessages(conv.id);
          const aiReply = await generateSupportAIReply(
            allMessages.map(m => ({ senderType: m.senderType, content: m.content })),
          );
          if (aiReply) {
            await db.createSupportMessage({
              conversationId: conv.id,
              senderId: 0, // bot has no real user ID
              senderType: 'bot',
              content: aiReply,
            });
          }
        }

        // Notify admin/support staff of new student message
        db.notifyStaffByEvent('new_support_message', {
          titleEn: `New support message from ${ctx.user.name || ctx.user.email}`,
          titleAr: `رسالة دعم جديدة من ${ctx.user.name || ctx.user.email}`,
          contentEn: input.content.slice(0, 120),
          contentAr: input.content.slice(0, 120),
          metadata: { userId: ctx.user.id, conversationId: conv.id },
        }).catch(() => {});

        return msg;
      }),

    // Client: check if support is currently in working hours
    isWorkingHours: protectedProcedure.query(() => {
      return { working: isSupportWorkingHours() };
    }),

    // Client: request human agent (escalation from AI)
    requestHuman: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const conv = await db.getOrCreateSupportConversation(ctx.user.id);
      await db.setNeedsHuman(conv.id, true);
      // Add a system-style bot message so admin sees the escalation
      await db.createSupportMessage({
        conversationId: conv.id,
        senderId: 0,
        senderType: 'bot',
        content: '⚠️ Student requested a human agent.',
      });

      // Notify admin/support staff of escalation
      db.notifyStaffByEvent('human_escalation', {
        titleEn: `Human agent requested by ${ctx.user.name || ctx.user.email}`,
        titleAr: `طلب تحويل لموظف من ${ctx.user.name || ctx.user.email}`,
        contentEn: 'A student has requested to speak with a human support agent.',
        contentAr: 'طالب يطلب التحدث مع موظف دعم.',
        metadata: { userId: ctx.user.id, conversationId: conv.id },
      }).catch(() => {});

      return { success: true };
    }),

    // Client: unread count badge
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { count: 0 };
      const count = await db.getUnreadSupportCount(ctx.user.id);
      return { count };
    }),

    // Support/Admin: list all conversations with last message & unread counts
    listAll: supportStaffProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllSupportConversations(input?.search);
      }),

    // Support/Admin: get messages of a specific conversation
    getMessages: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        const conv = await db.getSupportConversation(input.conversationId);
        if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        await db.markSupportMessagesRead(input.conversationId, 'support');
        const messages = await db.getSupportMessages(input.conversationId);
        return { conversation: conv, messages };
      }),

    // Support/Admin: reply to a conversation
    reply: supportStaffProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string().min(1).max(5000),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentSize: z.number().optional(),
        attachmentType: z.enum(['file', 'voice']).optional(),
        attachmentDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const conv = await db.getSupportConversation(input.conversationId);
        if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });

        const isAdmin = ctx.user.email ? !!(await db.getAdminByEmail(ctx.user.email)) : false;
        const msg = await db.createSupportMessage({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          senderType: isAdmin ? 'admin' : 'support',
          content: input.content,
          attachmentUrl: input.attachmentUrl,
          attachmentName: input.attachmentName,
          attachmentSize: input.attachmentSize,
          attachmentType: input.attachmentType,
          attachmentDuration: input.attachmentDuration,
        });

        // Notify student when admin/support replies
        if ((isAdmin || ctx.user.id !== conv.userId) && conv.userId) {
          await db.createNotification({
            userId: conv.userId,
            type: 'info',
            titleAr: 'رد جديد من الدعم',
            titleEn: 'New Support Reply',
            contentAr: input.content.length > 80 ? input.content.slice(0, 80) + '…' : input.content,
            contentEn: input.content.length > 80 ? input.content.slice(0, 80) + '…' : input.content,
            actionUrl: '/support',
          }).catch(() => {});
        }

        // Auto-clear escalation flag when human replies
        if (conv.needsHuman) {
          await db.setNeedsHuman(input.conversationId, false);
        }

        return msg;
      }),

    // Support/Admin: AI-suggested reply for a conversation
    suggestReply: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        const allMessages = await db.getSupportMessages(input.conversationId);
        if (allMessages.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No messages in conversation' });
        }
        const suggestion = await generateSupportAIReply(
          allMessages.map(m => ({ senderType: m.senderType, content: m.content })),
        );
        if (!suggestion) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI suggestion unavailable' });
        }
        return { suggestion };
      }),

    // Support/Admin: clear needsHuman flag after admin responds
    clearEscalation: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.setNeedsHuman(input.conversationId, false);
        return { success: true };
      }),

    // Support/Admin: close a conversation
    close: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.closeSupportConversation(input.conversationId);
        return { success: true };
      }),

    // Support/Admin: reopen a closed conversation
    reopen: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.reopenSupportConversation(input.conversationId);
        return { success: true };
      }),

    // Edit a message (client edits own, staff edits own)
    editMessage: protectedProcedure
      .input(z.object({ messageId: z.number(), content: z.string().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const updated = await db.editSupportMessage(input.messageId, ctx.user.id, input.content);
        if (!updated) throw new Error("Cannot edit this message");
        return { success: true, message: updated };
      }),

    // Delete a message (client deletes own, staff deletes staff/bot messages)
    deleteMessage: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        const isStaff = isAdmin || !!ctx.user.isStaff;
        const deleted = await db.deleteSupportMessage(input.messageId, ctx.user.id, isStaff);
        if (!deleted) throw new Error("Cannot delete this message");
        return { success: true };
      }),
  }),

  bugReports: router({
    uploadImage: userOnlyProcedure
      .input(z.object({
        fileData: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'R2 bucket not configured' });
        }

        if (!input.contentType.startsWith('image/')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only image uploads are allowed' });
        }

        const buffer = Buffer.from(input.fileData, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image too large' });
        }

        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `bug-reports/${ctx.user.id}/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const result = await storagePutR2(env.VIDEOS_BUCKET, key, buffer, input.contentType);

        return { url: result.url, key: result.key, size: buffer.length };
      }),

    submit: userOnlyProcedure
      .input(z.object({
        description: z.string().max(3000).optional(),
        imageUrl: z.string().max(1000).optional(),
      }).refine(
        (value) => Boolean(value.description?.trim() || value.imageUrl?.trim()),
        { message: 'Description or image is required' }
      ))
      .mutation(async ({ ctx, input }) => {
        const report = await db.createBugReport({
          userId: ctx.user.id,
          description: input.description,
          imageUrl: input.imageUrl,
        });

        const clientLabel = ctx.user.name?.trim() || ctx.user.email;
        const hasDescription = !!input.description?.trim();

        await db.notifyStaffByEvent('bug_report_submitted', {
          titleEn: `New bug report from ${clientLabel}`,
          titleAr: `بلاغ خطأ جديد من ${clientLabel}`,
          contentEn: hasDescription
            ? input.description!.trim().slice(0, 140)
            : 'Image-only bug report submitted.',
          contentAr: hasDescription
            ? input.description!.trim().slice(0, 140)
            : 'تم إرسال بلاغ خطأ مرفق بصورة فقط.',
          metadata: { reportId: report.id, userId: ctx.user.id },
        });

        return report;
      }),

    myList: userOnlyProcedure.query(async ({ ctx }) => {
      return db.getMyBugReports(ctx.user.id);
    }),

    list: adminOrRoleProcedure(['support'])
      .input(z.object({
        status: z.enum(BUG_REPORT_STATUSES).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listBugReports(input?.status ? { status: input.status } : undefined);
      }),

    review: adminOrRoleProcedure(['support'])
      .input(z.object({
        reportId: z.number(),
        decision: z.enum(['rewarded', 'rejected']),
        riskLevel: z.enum(BUG_REPORT_RISK_LEVELS).nullable().optional(),
        awardedPoints: z.number().min(0).max(100000).optional(),
        adminNote: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.reviewBugReport({
          reportId: input.reportId,
          reviewerContextId: ctx.user.id,
          decision: input.decision,
          riskLevel: input.riskLevel,
          awardedPoints: input.awardedPoints,
          adminNote: input.adminNote,
        });
      }),
  }),

  // =========================================================================
  // Role Management (admin only)
  // =========================================================================
  roles: router({
    // List all role assignments
    list: adminProcedure.query(async () => {
      return db.getAllRoleAssignments();
    }),

    // List users with a specific role
    byRole: adminProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => {
        return db.getUsersWithRole(input.role);
      }),

    // Assign a role to a user
    assign: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['analyst', 'support', 'lexai_support', 'key_manager', 'plan_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup']),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user exists
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        await db.assignRole(input.userId, input.role, (ctx as any).admin?.id);

        return { success: true };
      }),

    // Remove a role from a user
    remove: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['analyst', 'support', 'lexai_support', 'key_manager', 'plan_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup']),
      }))
      .mutation(async ({ input }) => {
        await db.removeRole(input.userId, input.role);

        return { success: true };
      }),

    // Bulk update: set all roles for a user at once
    setRoles: adminProcedure
      .input(z.object({
        userId: z.number(),
        roles: z.array(z.enum(['analyst', 'support', 'lexai_support', 'key_manager', 'plan_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup'])),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        if (!(user as any).isStaff) throw new TRPCError({ code: 'BAD_REQUEST', message: 'User must be a staff member' });
        await db.setUserRoles(input.userId, input.roles, (ctx as any).admin?.id);
        return { success: true };
      }),

    // Get roles for a specific user
    forUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserRoles(input.userId);
      }),

    // Client: get my own roles (for UI gating)
    myRoles: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return db.getUserRoles(ctx.user.id);
    }),

    // ---- Staff Management ----

    // Create a staff member (+ assign roles in one step)
    createStaff: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        roles: z.array(z.enum(['analyst', 'support', 'lexai_support', 'key_manager', 'plan_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup'])).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = await db.createStaffUser({ name: input.name, email: input.email, phone: input.phone });
        // Assign all selected roles
        for (const role of input.roles) {
          await db.assignRole(userId, role, (ctx as any).admin?.id);
        }

        // Send welcome email to the new staff member
        const roleLabels: Record<string, string> = {
          analyst: 'Analyst / محلل',
          support: 'Support / دعم فني',
          lexai_support: 'LexAI Support / دعم LexAI',
          key_manager: 'Key Manager / مدير المفاتيح',
          plan_manager: 'Plan Manager / مدير الخطط',
          view_progress: 'View Progress / عرض التقدم',
          view_recommendations: 'View Recommendations / عرض التوصيات',
          view_subscriptions: 'View Subscriptions / عرض الاشتراكات',
          view_quizzes: 'View Quizzes / عرض الاختبارات',
          client_lookup: 'Client Lookup / بحث العملاء',
        };
        try {
          await sendStaffWelcomeEmail(input.email, {
            name: input.name,
            roles: input.roles,
            roleLabels,
          });
        } catch (emailErr) {
          // Don't fail the mutation if email fails — staff is still created
          console.error('[createStaff] Welcome email failed:', emailErr);
        }

        return { success: true, userId };
      }),

    // List all staff members with their roles
    listStaff: adminProcedure.query(async () => {
      return db.getStaffMembers();
    }),

    // Remove a staff member (reverts to student, removes all roles)
    removeStaff: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeStaffStatus(input.userId);
        return { success: true };
      }),

    // Get staff member access preview for admin impersonation/review
    getStaffAccessPreview: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        const roles = await db.getUserRoles(input.userId);
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: (user as any).phone,
          isStaff: (user as any).isStaff,
          roles: roles.map((r: any) => r.role),
          lastSignIn: (user as any).lastSignIn,
        };
      }),
  }),

  // =========================================================================
  // Support Dashboard – permission-gated client data for support staff
  // =========================================================================
  supportDashboard: router({
    // Search clients by email or name (requires 'client_lookup' or 'support' role, or admin)
    searchClients: supportStaffProcedure
      .input(z.object({ query: z.string().min(1).max(200) }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canSearch = await db.hasAnyRole(ctx.user.id, ['client_lookup', 'support']);
          if (!canSearch) throw new TRPCError({ code: 'FORBIDDEN', message: 'Client lookup permission required' });
        }
        const allUsers = await db.getAllUsers();
        const q = input.query.toLowerCase();
        return (allUsers ?? []).filter((u: any) =>
          u.email?.toLowerCase().includes(q) ||
          u.name?.toLowerCase().includes(q) ||
          u.phone?.includes(q)
        ).slice(0, 50).map((u: any) => ({
          id: u.id, email: u.email, name: u.name, phone: u.phone, createdAt: u.createdAt,
        }));
      }),

    // Get client course progress & enrollments (requires 'view_progress' or admin)
    clientProgress: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_progress']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View progress permission required' });
        }
        const enrollmentsList = await db.getEnrollmentsByUserId(input.userId);
        // For each enrollment, get episode-level progress
        const result = [];
        for (const enr of enrollmentsList) {
          const epProgress = await db.getUserCourseProgress(input.userId, enr.courseId);
          result.push({ ...enr, episodeProgress: epProgress });
        }
        return result;
      }),

    // Get client subscriptions & keys (requires 'view_subscriptions' or admin)
    clientSubscriptions: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_subscriptions']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View subscriptions permission required' });
        }
        const lexai = await db.getActiveLexaiSubscription(input.userId);
        const recommendation = await db.getActiveRecommendationSubscription(input.userId);
        const enrollmentsList = await db.getEnrollmentsByUserId(input.userId);
        return {
          lexai: lexai ?? null,
          recommendation: recommendation ?? null,
          enrollments: enrollmentsList,
        };
      }),

    // Get client quiz progress (requires 'view_quizzes' or admin)
    clientQuizProgress: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_quizzes']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View quizzes permission required' });
        }
        // Get all quiz attempts for this user
        return db.getQuizAttemptsByUser(input.userId);
      }),

    // Get recommendation feed (requires 'view_recommendations' or admin)
    recommendationFeed: supportStaffProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_recommendations']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View recommendations permission required' });
        }
        return db.getRecommendationMessagesFeed(0, 100);
      }),

    // Get my staff permissions (support + analyst)
    myPermissions: supportStaffProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { isAdmin: false, isAnalyst: false, permissions: [] as string[] };
      const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
      if (isAdmin) {
        return {
          isAdmin: true,
          isAnalyst: true,
          permissions: ['support', 'lexai_support', 'analyst', 'client_lookup', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'key_manager'],
        };
      }
      const roles = await db.getUserRoles(ctx.user.id);
      const roleNames = roles.map(r => r.role);
      const access = await db.getUserRecommendationsAccess(ctx.user.id);
      return {
        isAdmin: false,
        isAnalyst: access.canPublish || roleNames.includes('analyst'),
        permissions: roleNames,
      };
    }),
  }),

  // =============================================
  // PACKAGES (public + admin)
  // =============================================
  packages: router({
    // Public: list published packages
    list: publicProcedure.query(async () => {
      return db.getAllPackages(true);
    }),

    // Public: get single package by slug
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const pkg = await db.getPackageBySlug(input.slug);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        return pkg;
      }),

    // Public: get single package by id
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const pkg = await db.getPackageById(input.id);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        return pkg;
      }),

    // Public: get courses in a package
    courses: publicProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackageCourses(input.packageId);
      }),

    // Admin: list all packages (including unpublished)
    adminList: adminProcedure.query(async () => {
      return db.getAllPackages(false);
    }),

    // Admin: create package
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number().min(0),
        currency: z.string().default('USD'),
        renewalPrice: z.number().optional(),
        renewalPeriodDays: z.number().optional(),
        renewalDescription: z.string().optional(),
        includesLexai: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        includesRecommendations: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        includesSupport: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        includesPdf: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        durationDays: z.number().optional(),
        isLifetime: z.union([z.boolean(), z.number().min(0).max(1)]).default(1),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        displayOrder: z.number().default(0),
        thumbnailUrl: z.string().optional(),
        upgradePrice: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createPackage({
          ...input,
          includesLexai: Boolean(input.includesLexai),
          includesRecommendations: Boolean(input.includesRecommendations),
          includesSupport: Boolean(input.includesSupport),
          includesPdf: Boolean(input.includesPdf),
          isLifetime: Boolean(input.isLifetime),
          isPublished: Boolean(input.isPublished),
        });
      }),

    // Admin: update package
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().optional(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        renewalPrice: z.number().optional(),
        renewalPeriodDays: z.number().optional(),
        renewalDescription: z.string().optional(),
        includesLexai: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        includesRecommendations: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        includesSupport: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        includesPdf: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        durationDays: z.number().optional(),
        isLifetime: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        displayOrder: z.number().optional(),
        thumbnailUrl: z.string().optional(),
        upgradePrice: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.includesLexai !== undefined) updateData.includesLexai = Boolean(data.includesLexai);
        if (data.includesRecommendations !== undefined) updateData.includesRecommendations = Boolean(data.includesRecommendations);
        if (data.includesSupport !== undefined) updateData.includesSupport = Boolean(data.includesSupport);
        if (data.includesPdf !== undefined) updateData.includesPdf = Boolean(data.includesPdf);
        if (data.isLifetime !== undefined) updateData.isLifetime = Boolean(data.isLifetime);
        if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
        return db.updatePackage(id, updateData);
      }),

    // Admin: delete package
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deletePackage(input.id);
      }),

    // Admin: set courses for a package
    setCourses: adminProcedure
      .input(z.object({
        packageId: z.number(),
        courseIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.setPackageCourses(input.packageId, input.courseIds);
        return { success: true };
      }),
  }),

  // =============================================
  // ORDERS
  // =============================================
  orders: router({
    // User: create order (checkout)
    create: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          itemType: z.enum(['package']),
          packageId: z.number().optional(),
          courseId: z.number().optional(),
        })),
        paymentMethod: z.enum(['paypal', 'bank_transfer']),
        isGift: z.boolean().default(false),
        giftEmail: z.string().optional(),
        giftMessage: z.string().optional(),
        notes: z.string().optional(),
        couponCode: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

        // Calculate totals
        let subtotal = 0;
        const resolvedItems: Array<{ itemType: string; packageId?: number; courseId?: number; price: number }> = [];

        for (const item of input.items) {
          if (item.itemType === 'package' && item.packageId) {
            const pkg = await db.getPackageById(item.packageId);
            if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${item.packageId} not found` });
            subtotal += pkg.price;
            resolvedItems.push({ itemType: 'package', packageId: item.packageId, price: pkg.price });
          }
        }

        // Apply coupon discount
        let discountAmount = 0;
        let couponId: number | null = null;
        if (input.couponCode) {
          const coupon = await db.getCouponByCode(input.couponCode);
          if (coupon) {
            const packageId = resolvedItems[0]?.packageId;
            const validation = db.validateCoupon(coupon, subtotal, packageId);
            if (validation.valid) {
              discountAmount = db.calculateDiscount(coupon, subtotal);
              couponId = coupon.id;
            }
          }
        }

        const vatRate = 16;
        // Prices are VAT-inclusive: extract VAT from the total
        const totalAmount = subtotal - discountAmount;
        const vatAmount = Math.round(totalAmount * vatRate / (100 + vatRate));
        const subtotalExVat = totalAmount - vatAmount;

        // Create order
        const order = await db.createOrder({
          userId: ctx.user.id,
          status: 'pending',
          subtotal: subtotalExVat,
          discountAmount,
          vatRate,
          vatAmount,
          totalAmount,
          currency: 'USD',
          paymentMethod: input.paymentMethod,
          isGift: input.isGift,
          giftEmail: input.giftEmail || null,
          giftMessage: input.giftMessage || null,
          notes: input.notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (!order) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create order' });

        // Increment coupon usage
        if (couponId) {
          db.incrementCouponUsage(couponId).catch(() => {});
        }

        // Add order items
        let packageName = 'Package';
        for (const item of resolvedItems) {
          await db.addOrderItem({
            orderId: order.id,
            itemType: item.itemType,
            packageId: item.packageId || null,
            courseId: item.courseId || null,
            priceAtPurchase: item.price,
            currency: 'USD',
          });
          if (item.packageId) {
            const pkg = await db.getPackageById(item.packageId);
            if (pkg) packageName = pkg.nameEn || pkg.nameAr || 'Package';
          }
        }

        // Send email notifications (non-blocking)
        const totalUsd = totalAmount / 100;
        sendOrderConfirmationEmail(ctx.user.email, {
          orderId: order.id, packageName, totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});
        sendAdminNewOrderNotification({
          orderId: order.id, userEmail: ctx.user.email, packageName, totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});

        // Notify admin/key_manager staff of new order
        db.notifyStaffByEvent('new_order', {
          titleEn: `New order #${order.id} — ${packageName} ($${totalUsd.toFixed(2)})`,
          titleAr: `طلب جديد #${order.id} — ${packageName} ($${totalUsd.toFixed(2)})`,
          contentEn: `${ctx.user.email} placed a ${input.paymentMethod} order.`,
          contentAr: `${ctx.user.email} قام بتقديم طلب ${input.paymentMethod}.`,
          metadata: { orderId: order.id, userId: ctx.user.id, packageName, totalUsd },
        }).catch(() => {});

        return order;
      }),

    // User: get my orders
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getUserOrders(ctx.user.id);
    }),

    // User: get order details
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const order = await db.getOrderById(input.id);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        // Only allow order owner or admin to see the order
        if (order.userId !== ctx.user.id) {
          const admin = ctx.user.email ? await db.getAdminByEmail(ctx.user.email) : null;
          if (!admin) throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    // User: upload payment proof (bank transfer)
    uploadProof: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        paymentProofUrl: z.string(),
        paymentReference: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        return db.updateOrderStatus(input.orderId, 'awaiting_confirmation', {
          paymentProofUrl: input.paymentProofUrl,
          paymentReference: input.paymentReference,
        });
      }),

    // Admin/Key Manager: list all orders
    adminList: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllOrders(input?.status);
      }),

    // Admin/Key Manager: update order status
    adminUpdateStatus: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        orderId: z.number(),
        status: z.enum(['pending', 'awaiting_confirmation', 'paid', 'completed', 'cancelled', 'refunded']),
        paymentReference: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

        const updated = await db.updateOrderStatus(input.orderId, input.status, {
          paymentReference: input.paymentReference,
        });

        // If status changed to 'completed', activate package subscriptions
        if (input.status === 'completed' && updated) {
          const items = await db.getOrderItems(input.orderId);
          let packageName = 'Package';
          for (const item of items) {
            if (item.itemType === 'package' && item.packageId) {
              const pkg = await db.getPackageById(item.packageId);
              if (pkg) packageName = pkg.nameEn || pkg.nameAr || 'Package';
              const targetUserId = order.isGift && order.giftEmail
                ? (await db.getUserByEmail(order.giftEmail))?.id
                : order.userId;

              if (targetUserId) {
                // Use fulfillPackageEntitlements which grants courses + LexAI + Recommendations
                await db.fulfillPackageEntitlements(targetUserId, item.packageId, undefined, undefined, order.id);
              }
            }
          }

          // Send subscription activated email (non-blocking)
          const userEmail = order.isGift && order.giftEmail ? order.giftEmail : (await db.getUserById(order.userId))?.email;
          if (userEmail) {
            sendPaymentReceivedEmail(userEmail, { orderId: order.id, packageName }).catch(() => {});
          }
        }

        return updated;
      }),
  }),

  // =============================================
  // PACKAGE SUBSCRIPTIONS
  // =============================================
  subscriptions: router({
    // User: get my active subscriptions
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const subs = await db.getUserPackageSubscriptions(ctx.user.id);
      // Enrich each subscription with package name
      const enriched = await Promise.all(
        subs.map(async (sub) => {
          const pkg = await db.getPackageById(sub.packageId);
          return {
            ...sub,
            packageNameEn: pkg?.nameEn ?? `Package #${sub.packageId}`,
            packageNameAr: pkg?.nameAr ?? `الباقة #${sub.packageId}`,
          };
        })
      );
      return enriched;
    }),

    // User: get active package (most recent active)
    myActivePackage: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const pkg = await db.getUserActivePackage(ctx.user.id);
      // Include LexAI/Rec endDate for remaining days display (course is forever)
      const lexaiSub = await db.getUserLexaiSubscription(ctx.user.id);
      const recSub = await db.getActiveRecommendationSubscription(ctx.user.id);
      return {
        ...pkg,
        lexaiEndDate: lexaiSub?.endDate ?? null,
        recEndDate: recSub?.endDate ?? null,
      };
    }),

    // User: check if subscriptions are pending activation + course progress
    activationStatus: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getPendingActivationStatus(ctx.user.id);
    }),

    // User: get subscription timeline history
    myTimeline: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getStudentTimeline(ctx.user.id);
    }),

    // User: check if LexAI / Recommendations are frozen
    frozenStatus: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const frozenLexai = await db.getFrozenLexaiSubscription(ctx.user.id);
      const frozenRec = await db.getFrozenRecommendationSubscription(ctx.user.id);
      return {
        lexaiFrozen: !!frozenLexai,
        lexaiFrozenUntil: frozenLexai?.frozenUntil ?? null,
        recFrozen: !!frozenRec,
        recFrozenUntil: frozenRec?.frozenUntil ?? null,
      };
    }),

    // User: start the 30-day timer now (student's choice)
    activateNow: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const status = await db.getPendingActivationStatus(ctx.user.id);
      if (!status.hasPending) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No pending subscriptions to activate' });
      }
      if (!status.canActivate) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Complete the course first (currently at ${status.progressPercent}%)`,
        });
      }
      return db.activateStudentSubscriptions(ctx.user.id, false);
    }),

    // User: request freeze (sends a support chat message, admin handles manually)
    requestFreeze: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Auto-send a freeze request as a support chat message
      const conv = await db.getOrCreateSupportConversation(ctx.user.id);
      await db.createSupportMessage({
        conversationId: conv.id,
        senderId: ctx.user.id,
        senderType: 'client',
        content: `🧊 Freeze Request / طلب تجميد\n\nI would like to freeze my subscription. Please contact me to discuss the freeze period.\n\nأرغب في تجميد اشتراكي. يرجى التواصل معي لمناقشة فترة التجميد.`,
      });

      return { success: true };
    }),

    // Admin: list all subscriptions
    adminList: adminProcedure.query(async () => {
      return db.getAllPackageSubscriptions();
    }),
  }),

  // =============================================
  // STUDENT DOCUMENTS
  // =============================================
  documents: router({
    myLibrary: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const activePackage = await db.getUserActivePackage(ctx.user.id);
      if (!activePackage) {
        return {
          hasAccess: false,
          packageNameEn: null,
          packageNameAr: null,
          documents: [],
          bulkDownloadPath: null,
        };
      }

      const allDocuments = await db.listPublishedStudentDocuments();
      const bulkArchive = allDocuments.find((document) => document.isBulkArchive);
      const documents = allDocuments
        .filter((document) => !document.isBulkArchive)
        .map((document) => ({
          id: document.id,
          titleEn: document.titleEn,
          titleAr: document.titleAr,
          descriptionEn: document.descriptionEn,
          descriptionAr: document.descriptionAr,
          originalFileName: document.originalFileName,
          mimeType: document.mimeType,
          fileSizeBytes: document.fileSizeBytes,
          viewPath: document.mimeType === 'application/pdf'
            ? `/api/student-documents/${document.id}/view`
            : null,
          downloadPath: `/api/student-documents/${document.id}/download`,
        }));

      return {
        hasAccess: true,
        packageNameEn: activePackage.package?.nameEn ?? null,
        packageNameAr: activePackage.package?.nameAr ?? null,
        documents,
        bulkDownloadPath: bulkArchive ? `/api/student-documents/${bulkArchive.id}/download` : null,
      };
    }),
  }),

  // =============================================
  // FREE LIBRARY (public)
  // =============================================
  freeLibrary: router({
    list: publicProcedure.query(async () => {
      const videos = await Promise.all(
        FREE_LIBRARY_VIDEOS.map(async (video) => ({
          slug: video.slug,
          titleEn: video.titleEn,
          titleAr: video.titleAr,
          descriptionEn: video.descriptionEn,
          descriptionAr: video.descriptionAr,
          categoryEn: video.categoryEn,
          categoryAr: video.categoryAr,
          originalFileName: video.originalFileName,
          fileSizeBytes: video.fileSizeBytes,
          tone: video.tone,
          streamPath: buildFreeLibraryVideoStreamPath(
            video.slug,
            await generateFreeVideoPlaybackToken(video.slug),
          ),
        })),
      );

      const documents = FREE_LIBRARY_DOCUMENTS.map((document) => ({
        slug: document.slug,
        titleEn: document.titleEn,
        titleAr: document.titleAr,
        descriptionEn: document.descriptionEn,
        descriptionAr: document.descriptionAr,
        originalFileName: document.originalFileName,
        fileSizeBytes: document.fileSizeBytes,
        highlightTopicsEn: document.highlightTopicsEn,
        highlightTopicsAr: document.highlightTopicsAr,
        viewPath: buildFreeLibraryDocumentPath(document.slug, 'view'),
        downloadPath: buildFreeLibraryDocumentPath(document.slug, 'download'),
      }));

      return {
        documents,
        videos,
      };
    }),
  }),

  // =============================================
  // EVENTS (public + admin)
  // =============================================
  events: router({
    // Public: list published events
    list: publicProcedure.query(async () => {
      return db.getAllEvents(true);
    }),

    // Public: get single event
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const event = await db.getEventById(input.id);
        if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
        return event;
      }),

    // Admin: list all events
    adminList: adminProcedure.query(async () => {
      return db.getAllEvents(false);
    }),

    // Admin: create event
    create: adminProcedure
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        eventType: z.enum(['live', 'competition', 'discount', 'webinar']).default('live'),
        eventDate: z.string(),
        eventEndDate: z.string().optional(),
        imageUrl: z.string().optional(),
        linkUrl: z.string().optional(),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
      }))
      .mutation(async ({ input }) => {
        return db.createEvent({
          ...input,
          isPublished: Boolean(input.isPublished),
        });
      }),

    // Admin: update event
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        eventType: z.string().optional(),
        eventDate: z.string().optional(),
        eventEndDate: z.string().optional(),
        imageUrl: z.string().optional(),
        linkUrl: z.string().optional(),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
        return db.updateEvent(id, updateData);
      }),

    // Admin: delete event
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteEvent(input.id);
      }),
  }),

  // =============================================
  // ADMIN QUIZ MANAGEMENT
  // =============================================
  adminQuiz: router({
    // List all quizzes (admin or staff with view_quizzes)
    list: adminOrRoleProcedure(['view_quizzes']).query(async () => {
      return db.getAllQuizzes();
    }),

    // Get quiz with questions + options
    getById: adminOrRoleProcedure(['view_quizzes'])
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuizWithQuestionsAndOptions(input.id);
      }),

    // Get quiz stats
    stats: adminOrRoleProcedure(['view_quizzes'])
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuizStats(input.id);
      }),

    // Create quiz
    create: adminProcedure
      .input(z.object({
        level: z.number().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        passingScore: z.number().min(1).max(100).default(50),
      }))
      .mutation(async ({ input }) => {
        return db.createQuiz(input);
      }),

    // Update quiz
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        passingScore: z.number().min(1).max(100).optional(),
        level: z.number().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuiz(id, data);
      }),

    // Delete quiz
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuiz(input.id);
      }),

    // Create question
    createQuestion: adminProcedure
      .input(z.object({
        quizId: z.number(),
        questionText: z.string().min(1),
        orderNum: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        return db.createQuizQuestion(input);
      }),

    // Update question
    updateQuestion: adminProcedure
      .input(z.object({
        id: z.number(),
        questionText: z.string().optional(),
        orderNum: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuizQuestion(id, data);
      }),

    // Delete question
    deleteQuestion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuizQuestion(input.id);
      }),

    // Create option
    createOption: adminProcedure
      .input(z.object({
        questionId: z.number(),
        optionId: z.string().length(1),
        optionText: z.string().min(1),
        isCorrect: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return db.createQuizOption(input);
      }),

    // Update option
    updateOption: adminProcedure
      .input(z.object({
        id: z.number(),
        optionText: z.string().optional(),
        isCorrect: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuizOption(id, data);
      }),

    // Delete option
    deleteOption: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuizOption(input.id);
      }),
  }),

  // =============================================
  // UPGRADE SERVICE
  // =============================================
  upgrade: router({
    // Student: check if eligible to upgrade
    checkEligibility: protectedProcedure
      .input(z.object({ targetPackageId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return db.checkUpgradeEligibility(ctx.user.id, input.targetPackageId);
      }),

    // Student: create an upgrade order
    createOrder: protectedProcedure
      .input(z.object({
        targetPackageId: z.number(),
        paymentMethod: z.enum(['paypal', 'bank_transfer']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

        const eligibility = await db.checkUpgradeEligibility(ctx.user.id, input.targetPackageId);
        if (!eligibility) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not eligible for upgrade' });

        const vatRate = 16;
        // Prices are VAT-inclusive: extract VAT from the upgrade price
        const totalAmount = eligibility.upgradePrice;
        const vatAmount = Math.round(totalAmount * vatRate / (100 + vatRate));
        const subtotal = totalAmount - vatAmount;

        const order = await db.createOrder({
          userId: ctx.user.id,
          status: 'pending',
          subtotal,
          discountAmount: 0,
          vatRate,
          vatAmount,
          totalAmount,
          currency: 'USD',
          paymentMethod: input.paymentMethod,
          isGift: false,
          giftEmail: null,
          giftMessage: null,
          notes: input.notes || `Upgrade from ${eligibility.currentPackageName} to ${eligibility.targetPackageName}`,
          isUpgrade: true,
          upgradeFromPackageId: eligibility.currentPackageId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (!order) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create order' });

        await db.addOrderItem({
          orderId: order.id,
          itemType: 'package',
          packageId: input.targetPackageId,
          courseId: null,
          priceAtPurchase: totalAmount,
          currency: 'USD',
        });

        // Send email notifications
        const totalUsd = totalAmount / 100;
        sendOrderConfirmationEmail(ctx.user.email, {
          orderId: order.id, packageName: `Upgrade: ${eligibility.targetPackageName}`,
          totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});
        sendAdminNewOrderNotification({
          orderId: order.id, userEmail: ctx.user.email,
          packageName: `UPGRADE: ${eligibility.currentPackageName} → ${eligibility.targetPackageName}`,
          totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});

        // Notify admin/key_manager staff of upgrade order
        db.notifyStaffByEvent('new_order', {
          titleEn: `Upgrade order #${order.id} — ${eligibility.currentPackageName} → ${eligibility.targetPackageName}`,
          titleAr: `طلب ترقية #${order.id} — ${eligibility.currentPackageName} → ${eligibility.targetPackageName}`,
          contentEn: `${ctx.user.email} requested an upgrade ($${totalUsd.toFixed(2)}).`,
          contentAr: `${ctx.user.email} طلب ترقية ($${totalUsd.toFixed(2)}).`,
          metadata: { orderId: order.id, userId: ctx.user.id, totalUsd },
        }).catch(() => {});

        return order;
      }),

    // Admin/Key Manager: process/approve an upgrade after payment confirmed
    process: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        if (!order.isUpgrade) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not an upgrade order' });
        if (!order.upgradeFromPackageId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing upgrade source' });

        // Get target package from order items
        const items = await db.getOrderItems(order.id);
        const pkgItem = items.find((i: any) => i.itemType === 'package' && i.packageId);
        if (!pkgItem) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No package in order' });

        // Process the upgrade
        const result = await db.processUpgrade(
          order.userId,
          order.upgradeFromPackageId,
          pkgItem.packageId!,
          order.id,
        );

        // Mark order as paid
        await db.updateOrderStatus(order.id, 'paid');

        return result;
      }),
  }),

  // =============================================
  // ARTICLES (public + admin)
  // =============================================
  // ====== Coupons / Discount Codes ======
  coupons: router({
    // Public: validate a coupon code
    validate: publicProcedure
      .input(z.object({ code: z.string().min(1), subtotal: z.number(), packageId: z.number().optional() }))
      .query(async ({ input }) => {
        const coupon = await db.getCouponByCode(input.code);
        if (!coupon) throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon not found' });
        const result = db.validateCoupon(coupon, input.subtotal, input.packageId);
        if (!result.valid) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'Invalid coupon' });
        const discount = db.calculateDiscount(coupon, input.subtotal);
        return { couponId: coupon.id, code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, discount };
      }),

    // Admin: list all coupons
    adminList: adminProcedure.query(async () => {
      return db.getAllCoupons();
    }),

    // Admin: create coupon
    create: adminProcedure
      .input(z.object({
        code: z.string().min(1),
        discountType: z.enum(['percentage', 'fixed']),
        discountValue: z.number().min(1),
        maxUses: z.number().optional(),
        minOrderAmount: z.number().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
        isActive: z.boolean().default(true),
        packageId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createCoupon({ ...input, usedCount: 0 });
      }),

    // Admin: update coupon
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().optional(),
        maxUses: z.number().nullable().optional(),
        minOrderAmount: z.number().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validUntil: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        packageId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCoupon(id, data);
      }),

    // Admin: delete coupon
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteCoupon(input.id);
      }),
  }),

  // ====== Testimonials ======
  testimonials: router({
    // Public: published testimonials
    list: publicProcedure.query(async () => {
      return db.getAllTestimonials(true);
    }),

    // Public: published testimonials filtered by package/course/service context
    listWithContext: publicProcedure
      .input(z.object({
        packageSlug: z.string().optional(),
        courseId: z.number().optional(),
        serviceKey: z.string().optional(),
        limit: z.number().min(1).max(30).optional(),
      }))
      .query(async ({ input }) => {
        return db.getTestimonialsByContext({
          publishedOnly: true,
          packageSlug: input.packageSlug,
          courseId: input.courseId,
          serviceKey: input.serviceKey,
          limit: input.limit,
        });
      }),

    // Public: proof-backed testimonials for specific surfaces
    listProofs: publicProcedure
      .input(z.object({
        surface: z.enum(['home', 'dashboard']),
        packageSlug: z.string().optional(),
        courseId: z.number().optional(),
        serviceKey: z.string().optional(),
        limit: z.number().min(1).max(30).optional(),
      }))
      .query(async ({ input }) => {
        return db.getTestimonialProofs({
          surface: input.surface,
          packageSlug: input.packageSlug,
          courseId: input.courseId,
          serviceKey: input.serviceKey,
          limit: input.limit,
        });
      }),

    // Admin: all testimonials
    adminList: adminProcedure.query(async () => {
      return db.getAllTestimonials(false);
    }),

    uploadProofImage: adminProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'R2 bucket not configured' });
        }

        if (!input.contentType.startsWith('image/')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only image uploads are allowed' });
        }

        const buffer = Buffer.from(input.fileData, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image too large' });
        }

        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `testimonials/proofs/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const result = await storagePutR2(env.VIDEOS_BUCKET, key, buffer, input.contentType);

        return { url: result.url, key: result.key, size: buffer.length };
      }),

    // Admin: create testimonial
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        titleEn: z.string().default(''),
        titleAr: z.string().default(''),
        textEn: z.string().min(1),
        textAr: z.string().min(1),
        avatarUrl: z.string().optional(),
        proofImageUrl: z.string().default(''),
        rating: z.number().min(1).max(5).default(5),
        packageSlug: z.string().optional(),
        courseId: z.number().optional(),
        serviceKey: z.string().optional(),
        displayOrder: z.number().default(0),
        showProofOnHome: z.boolean().default(false),
        showProofOnDashboard: z.boolean().default(false),
        isPublished: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        return db.createTestimonial(input);
      }),

    // Admin: update testimonial
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        textEn: z.string().optional(),
        textAr: z.string().optional(),
        avatarUrl: z.string().optional(),
        proofImageUrl: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        packageSlug: z.string().optional(),
        courseId: z.number().optional(),
        serviceKey: z.string().optional(),
        displayOrder: z.number().optional(),
        showProofOnHome: z.boolean().optional(),
        showProofOnDashboard: z.boolean().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateTestimonial(id, data);
      }),

    // Admin: delete testimonial
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteTestimonial(input.id);
      }),
  }),

  articles: router({
    // Public: list published articles
    list: publicProcedure.query(async () => {
      const articles = await db.getAllArticles(true);
      return mergePublicArticles(articles);
    }),

    // Public: get article by slug
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const curatedArticle = getCuratedArticleBySlug(input.slug);
        if (curatedArticle) {
          return curatedArticle;
        }

        const article = await db.getArticleBySlug(input.slug);
        if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
        return toPublicArticle(article);
      }),

    // Public: get article by id
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const article = await db.getArticleById(input.id);
        if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
        return article;
      }),

    // Admin: list all articles
    adminList: adminProcedure.query(async () => {
      return db.getAllArticles(false);
    }),

    // Admin: create article
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptAr: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        authorId: z.number().optional(),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).default(0),
        publishedAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArticle({
          ...input,
          isPublished: Boolean(input.isPublished),
        });
      }),

    // Admin: update article
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptAr: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        authorId: z.number().optional(),
        isPublished: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
        publishedAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
        return db.updateArticle(id, updateData);
      }),

    // Admin: delete article
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteArticle(input.id);
      }),
  }),

  // ============================================================================
  // Package Keys (consolidated key system — admin + key_manager role)
  // ============================================================================
  packageKeys: router({
    list: adminOrRoleProcedure(['key_manager']).query(async () => {
      const keys = await db.getAllPackageKeysEnriched();
      // Enrich with package info
      const allPackages = await db.getAllPackages();
      const pkgMap = new Map(allPackages.map(p => [p.id, p]));
      return keys.map(k => ({
        ...k,
        packageName: k.packageId ? (pkgMap.get(k.packageId)?.nameEn || pkgMap.get(k.packageId)?.nameAr || 'Unknown') : null,
        packageNameAr: k.packageId ? (pkgMap.get(k.packageId)?.nameAr || null) : null,
        isUpgrade: k.isUpgrade ?? false,
        referredBy: k.referredBy ?? null,
      }));
    }),

    lexaiHolders: adminOrRoleProcedure(['key_manager', 'view_subscriptions']).query(async () => {
      const holders = await db.getComprehensivePackageHolders();
      const allPackages = await db.getAllPackages();
      const pkgMap = new Map(allPackages.map(p => [p.id, p]));
      return holders.map(h => ({
        ...h,
        packageName: h.packageId ? (pkgMap.get(h.packageId)?.nameEn ?? pkgMap.get(h.packageId)?.nameAr ?? 'Comprehensive') : 'Comprehensive',
        packageNameAr: h.packageId ? (pkgMap.get(h.packageId)?.nameAr ?? null) : null,
      }));
    }),

    stats: adminOrRoleProcedure(['key_manager']).query(async () => {
      return db.getPackageKeyStatistics();
    }),

    generateKey: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        packageId: z.number(),
        email: z.string().email().optional(),
        notes: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        entitlementDays: z.number().int().min(1).max(3650).optional(),
        expiresAt: z.string().optional(),
        isUpgrade: z.boolean().optional(),
        isRenewal: z.boolean().optional(),
        referredBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const admin = ctx.admin ?? ctx.user;
        const result = await db.createPackageKey({
          packageId: input.packageId,
          createdBy: admin?.id ?? 0,
          email: input.email,
          notes: input.notes,
          price: input.price,
          currency: input.currency,
          entitlementDays: input.entitlementDays,
          expiresAt: input.expiresAt,
          isUpgrade: input.isUpgrade,
          isRenewal: input.isRenewal,
          referredBy: input.referredBy,
        });
        return result;
      }),

    generateBulkKeys: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        packageId: z.number(),
        quantity: z.number().min(1).max(100),
        notes: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        entitlementDays: z.number().int().min(1).max(3650).optional(),
        expiresAt: z.string().optional(),
        isUpgrade: z.boolean().optional(),
        isRenewal: z.boolean().optional(),
        referredBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const admin = ctx.admin ?? ctx.user;
        const keys = await db.createBulkPackageKeys({
          packageId: input.packageId,
          createdBy: admin?.id ?? 0,
          quantity: input.quantity,
          notes: input.notes,
          price: input.price,
          currency: input.currency,
          entitlementDays: input.entitlementDays,
          expiresAt: input.expiresAt,
          isUpgrade: input.isUpgrade,
          isRenewal: input.isRenewal,
          referredBy: input.referredBy,
        });
        return { count: keys.length };
      }),

    deactivateKey: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        return db.deactivateRegistrationKey(input.id, input.reason);
      }),

    reactivateKey: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.reactivateRegistrationKey(input.id);
      }),

    freeze: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ userId: z.number(), reason: z.string().optional(), frozenUntilDays: z.number().int().min(1).max(365).optional() }))
      .mutation(async ({ input }) => {
        const result = await db.freezeUserSubscriptions(input.userId, input.reason, input.frozenUntilDays);
        return { success: true, ...result };
      }),

    unfreeze: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await db.unfreezeUserSubscriptions(input.userId);
        return { success: true, ...result };
      }),

    // Public: get key info (used by activation page)
    getKeyInfo: publicProcedure
      .input(z.object({ keyCode: z.string() }))
      .query(async ({ input }) => {
        const key = await db.getRegistrationKeyByCode(input.keyCode);
        if (!key) return { exists: false, keyType: null };
        return {
          exists: true,
          isActive: key.isActive,
          activatedAt: key.activatedAt,
          keyType: key.packageId ? 'package' as const : (key.courseId > 0 ? 'course' as const : key.courseId === 0 ? 'lexai' as const : 'recommendation' as const),
          packageId: key.packageId,
          entitlementDays: key.entitlementDays,
        };
      }),

    // Public: activate a package key (requires email; will resolve user)
    activateKey: protectedProcedure
      .input(z.object({
        keyCode: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.activatePackageKey(input.keyCode, ctx.user.email, ctx.user.id);
        if (result.success) {
          // Auto-award referral points (if user was referred)
          try { await db.activateReferral(ctx.user.id); } catch {}
        }
        return result;
      }),

    // Upgrade leaderboard: monthly stats by referrer
    upgradeStats: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ month: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getUpgradeStatistics(input?.month);
      }),
  }),

  clientProfiles: router({
    getProfile: adminOrRoleProcedure([
      'support',
      'lexai_support',
      'key_manager',
      'plan_manager',
      'client_lookup',
      'view_progress',
      'view_recommendations',
      'view_subscriptions',
      'view_quizzes',
    ])
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        const canViewTimeline = !!ctx.admin || await db.hasAnyRole(ctx.user.id, ['view_progress']);
        const profile = await db.getAdminClientProfile(input.userId, { includeTimeline: canViewTimeline });

        return {
          ...profile,
          permissions: {
            canViewTimeline,
          },
        };
      }),
  }),

  // ============================================================================
  // Admin Reports
  // ============================================================================
  reports: router({
    subscribers: supportStaffProcedure.query(async () => {
      return db.getSubscribersReport();
    }),
    revenue: adminProcedure.query(async () => {
      return db.getRevenueReport();
    }),
    expirations: adminProcedure.query(async () => {
      return db.getSubscriptionExpiryReport();
    }),
  }),

  // ============================================================================
  // Jobs / Careers System
  // ============================================================================
  jobs: router({
    // Public: list active jobs
    list: publicProcedure.query(async () => {
      return db.getActiveJobs();
    }),

    // Public: get single job with questions
    getWithQuestions: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const job = await db.getJobById(input.jobId);
        if (!job || !job.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }
        const questions = await db.getQuestionsForJob(input.jobId);
        return { job, questions };
      }),

    // Public: submit application with CV upload
    submitApplication: publicProcedure
      .input(z.object({
        jobId: z.number(),
        applicantName: z.string().min(2).max(200),
        email: z.string().email().max(320),
        phone: z.string().min(5).max(30),
        country: z.string().max(100).optional(),
        cvBase64: z.string().max(7_500_000).optional(), // ~5MB base64
        cvFileName: z.string().max(255).optional(),
        cvContentType: z.string().max(100).optional(),
        answers: z.array(z.object({
          questionId: z.number(),
          answer: z.string().min(1).max(5000),
        })),
      }))
      .mutation(async ({ input }) => {
        // Validate job exists and is active
        const job = await db.getJobById(input.jobId);
        if (!job || !job.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الوظيفة غير موجودة أو غير مفعلة' });
        }

        // CV upload to R2
        let cvFileUrl: string | undefined;
        let cvFileKey: string | undefined;

        if (input.cvBase64 && input.cvFileName && input.cvContentType) {
          // Validate file type
          const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ];
          if (!allowedTypes.includes(input.cvContentType)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'يُسمح فقط بملفات PDF أو DOC أو DOCX' });
          }

          // Validate file size (~5MB before base64 encoding)
          const sizeEstimate = (input.cvBase64.length * 3) / 4;
          if (sizeEstimate > 5 * 1024 * 1024) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'يجب أن يكون حجم الملف أقل من 5 ميجابايت' });
          }

          // Sanitize filename
          const safeFileName = input.cvFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const timestamp = Date.now();
          const key = `cvs/${timestamp}_${safeFileName}`;

          try {
            const workerEnv = getWorkerEnv();
            if (workerEnv?.VIDEOS_BUCKET) {
              const buffer = Uint8Array.from(atob(input.cvBase64), c => c.charCodeAt(0));
              const result = await storagePutR2(
                workerEnv.VIDEOS_BUCKET,
                key,
                buffer,
                input.cvContentType
              );
              cvFileUrl = result.url;
              cvFileKey = result.key;
            }
          } catch (err) {
            logger.error('CV upload failed', { error: err instanceof Error ? err.message : String(err) });
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل رفع السيرة الذاتية' });
          }
        }

        // Create application
        const applicationId = await db.createJobApplication({
          jobId: input.jobId,
          applicantName: input.applicantName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          cvFileUrl,
          cvFileKey,
        });

        // Save answers
        if (input.answers.length > 0) {
          await db.createJobApplicationAnswers(
            input.answers.map(a => ({
              applicationId,
              questionId: a.questionId,
              answer: a.answer,
            }))
          );
        }

        return { success: true, applicationId };
      }),

    // Admin: list all jobs (including inactive)
    adminList: adminProcedure.query(async () => {
      return db.getAllJobs();
    }),

    // Admin: create job
    create: adminProcedure
      .input(z.object({
        titleAr: z.string().min(1),
        titleEn: z.string().min(1),
        descriptionAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createJob(input);
        return { id };
      }),

    // Admin: update job
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleAr: z.string().optional(),
        titleEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateJob(id, data);
        return { success: true };
      }),

    // Admin: list all questions
    listQuestions: adminProcedure.query(async () => {
      return db.getAllJobQuestions();
    }),

    // Admin: create question
    createQuestion: adminProcedure
      .input(z.object({
        jobId: z.number().nullable(),
        questionAr: z.string().min(1),
        questionEn: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createJobQuestion(input);
        return { id };
      }),

    // Admin: update question
    updateQuestion: adminProcedure
      .input(z.object({
        id: z.number(),
        jobId: z.number().nullable().optional(),
        questionAr: z.string().optional(),
        questionEn: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateJobQuestion(id, data);
        return { success: true };
      }),

    // Admin: delete question
    deleteQuestion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteJobQuestion(input.id);
        return { success: true };
      }),

    // Admin: list applications with optional filters
    listApplications: adminProcedure
      .input(z.object({
        jobId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const apps = await db.getJobApplications(input ?? undefined);
        // Attach job title for display
        const allJobs = await db.getAllJobs();
        const jobMap = new Map(allJobs.map(j => [j.id, j]));
        return apps.map(a => ({ ...a, jobTitle: jobMap.get(a.jobId)?.titleAr || '—' }));
      }),

    // Admin: get single application details with answers
    getApplication: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const app = await db.getJobApplicationById(input.id);
        if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
        const answers = await db.getJobApplicationAnswers(input.id);
        const questions = await db.getAllJobQuestions();
        const questionMap = new Map(questions.map(q => [q.id, q]));
        return {
          ...app,
          answers: answers.map(a => ({
            ...a,
            questionText: questionMap.get(a.questionId)?.questionAr || '—',
          })),
        };
      }),

    // Admin: update application status
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'reviewed', 'shortlisted', 'rejected']),
      }))
      .mutation(async ({ input }) => {
        await db.updateJobApplicationStatus(input.id, input.status);
        return { success: true };
      }),

    // Admin: stats
    stats: adminProcedure.query(async () => {
      return db.getJobApplicationStats();
    }),

    // Admin: AI screening – send applicant answers to LLM for evaluation
    aiScreen: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const app = await db.getJobApplicationById(input.id);
        if (!app) throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });

        const answers = await db.getJobApplicationAnswers(input.id);
        const questions = await db.getAllJobQuestions();
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const job = await db.getJobById(app.jobId);

        // Build Q&A text
        const qaText = answers.map(a => {
          const q = questionMap.get(a.questionId);
          return `السؤال: ${q?.questionAr || '—'}\nالإجابة: ${a.answer}`;
        }).join('\n\n');

        const systemPrompt = `أنت خبير موارد بشرية ومتخصص في تقييم المرشحين للوظائف. مهمتك تقييم إجابات المتقدم على أسئلة التقديم وإعطاء توصية واضحة.

قيّم المتقدم من 1 إلى 10 بناءً على:
1. جودة الإجابات ومدى تفصيلها
2. الخبرة والمؤهلات المذكورة
3. مدى ملاءمة المتقدم للوظيفة
4. مهارات التواصل الظاهرة من الإجابات

أجب بالعربية فقط بالشكل التالي:
### التقييم: X/10

### نقاط القوة:
- ...

### نقاط الضعف:
- ...

### التوصية:
(مرشح بشدة / مرشح / يحتاج مقابلة / غير مناسب)

### ملاحظات إضافية:
- ...`;

        const userMessage = `الوظيفة: ${job?.titleAr || '—'}
الوصف: ${job?.descriptionAr || '—'}

المتقدم: ${app.applicantName}
البريد: ${app.email}
الهاتف: ${app.phone}
الدولة: ${app.country || '—'}

--- الإجابات ---
${qaText}`;

        if (!ENV.openaiApiKey) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'مفتاح OpenAI غير مُعد' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ENV.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.error('AI screening failed', { error: errText });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل تقييم الذكاء الاصطناعي' });
        }

        const data = await response.json() as any;
        const recommendation = data.choices?.[0]?.message?.content || 'لا توجد نتيجة';

        return { recommendation };
      }),
  }),

  // ============================================================================
  // Global Search (Phase 3)
  // ============================================================================
  search: router({
    public: publicProcedure
      .input(z.object({ query: z.string().min(1).max(200) }))
      .query(async ({ input }) => {
        return db.globalSearch(input.query);
      }),
    admin: adminProcedure
      .input(z.object({ query: z.string().min(1).max(200) }))
      .query(async ({ input }) => {
        return db.adminGlobalSearch(input.query);
      }),
  }),

  // ============================================================================
  // Course Reviews / Star Ratings (Phase 4)
  // ============================================================================
  reviews: router({
    // Public: get approved reviews for a course
    byCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return db.getCourseReviews(input.courseId, true);
      }),

    // Public: get average rating for a course
    averageRating: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return db.getCourseAverageRating(input.courseId);
      }),

    // Student: submit a review
    submit: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const review = await db.createCourseReview({
          userId: ctx.user.id, courseId: input.courseId,
          rating: input.rating, comment: input.comment,
        });
        // Auto-award points for review
        try { await db.autoAwardPoints(ctx.user.id, 'review', { referenceId: input.courseId, referenceType: 'review' }); } catch {}
        return review;
      }),

    // Admin: list all reviews with filters
    listAll: adminProcedure
      .input(z.object({
        courseId: z.number().optional(),
        isApproved: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllReviews(input ?? undefined);
      }),

    // Admin: approve/reject a review
    moderate: adminProcedure
      .input(z.object({ reviewId: z.number(), isApproved: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.updateReviewApproval(input.reviewId, input.isApproved);
        return { success: true };
      }),

    // Admin: delete a review
    delete: adminProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReview(input.reviewId);
        return { success: true };
      }),
  }),

  // ============================================================================
  // User Notifications (Phase 4)
  // ============================================================================
  notifications: router({
    // Student: get my notifications
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getUserNotifications(ctx.user.id);
    }),

    // Student: unread count
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { count: 0 };
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),

    // Student: mark one as read
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        await db.markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    // Student: mark all as read
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),

    // Admin: send notification to specific users (+ optional email)
    send: adminProcedure
      .input(z.object({
        userIds: z.array(z.number()).min(1).max(1000),
        type: z.string().optional(),
        titleEn: z.string().max(200).optional(),
        titleAr: z.string().min(1).max(200),
        contentEn: z.string().max(2000).optional(),
        contentAr: z.string().max(2000).optional(),
        actionUrl: z.string().max(500).optional(),
        sendEmail: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        // Fallback: if English title is empty, use Arabic
        const titleEn = input.titleEn?.trim() || input.titleAr;
        const contentEn = input.contentEn?.trim() || input.contentAr;
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await db.sendBulkNotification({ ...input, titleEn, contentEn, batchId });

        // Send branded HTML emails if requested
        let emailsSent = 0;
        if (input.sendEmail) {
          const users = await db.getAllUsers();
          const emailMap = new Map(users.map((u: any) => [u.id, u.email]));
          const subject = input.titleAr; // Arabic subject
          for (const userId of input.userIds) {
            const email = emailMap.get(userId);
            if (email) {
              try {
                await sendAnnouncementEmail(email, {
                  subject,
                  titleAr: input.titleAr,
                  contentAr: input.contentAr || '',
                  titleEn: input.titleEn?.trim() || undefined,
                  contentEn: input.contentEn?.trim() || undefined,
                  actionUrl: input.actionUrl || undefined,
                });
                await db.markNotificationEmailSent(batchId, userId);
                emailsSent++;
              } catch (err) {
                console.error(`Failed to send email to user ${userId}:`, err);
              }
            }
          }
        }

        return { success: true, count: input.userIds.length, emailsSent };
      }),

    // Admin: get students grouped by active/inactive for targeting
    targetStudents: adminProcedure.query(async () => {
      return db.getStudentsForNotification();
    }),

    // Admin: sent notification history
    sentHistory: adminProcedure.query(async () => {
      return db.getRecentSentNotifications();
    }),

    // Admin: get recipients for a specific sent batch
    sentRecipients: adminProcedure
      .input(z.object({ batchId: z.string() }))
      .query(async ({ input }) => {
        return db.getNotificationRecipients(input.batchId);
      }),
  }),

  // ============================================================================
  // Loyalty Points (Phase 4)
  // ============================================================================
  points: router({
    // Student: get my balance and history
    myBalance: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { balance: 0 };
      return { balance: await db.getPointsBalance(ctx.user.id) };
    }),

    myHistory: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getPointsHistory(ctx.user.id);
    }),

    // Student: get my referral code (generates one if missing)
    myReferralCode: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const code = await db.getOrCreateReferralCode(ctx.user.id);
      return { code };
    }),

    // Student: get my referrals list
    myReferrals: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getMyReferrals(ctx.user.id);
    }),

    // Student: get points earning rules
    rules: protectedProcedure.query(async () => {
      return db.getPointsRules();
    }),

    // Public: register a referral (when new user signs up via referral code)
    registerReferral: publicProcedure
      .input(z.object({ referralCode: z.string().min(4).max(10) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const referrer = await db.getUserByReferralCode(input.referralCode);
        if (!referrer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid referral code' });
        const result = await db.createReferral(referrer.id, ctx.user.id);
        if (!result) throw new TRPCError({ code: 'CONFLICT', message: 'Referral already registered' });
        return { success: true };
      }),

    // Admin: add points to a user
    award: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().min(1).max(100000),
        reasonEn: z.string().min(1).max(200),
        reasonAr: z.string().min(1).max(200),
        referenceType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.addPoints({
          userId: input.userId, amount: input.amount,
          reasonEn: input.reasonEn, reasonAr: input.reasonAr,
          referenceType: input.referenceType,
        });
      }),

    // Admin: deduct points
    deduct: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().min(1).max(100000),
        reasonEn: z.string().min(1).max(200),
        reasonAr: z.string().min(1).max(200),
      }))
      .mutation(async ({ input }) => {
        const result = await db.redeemPoints({
          userId: input.userId, amount: input.amount,
          reasonEn: input.reasonEn, reasonAr: input.reasonAr,
        });
        if (!result) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient points balance' });
        return result;
      }),

    // Admin: leaderboard
    leaderboard: adminProcedure.query(async () => {
      return db.getTopPointsUsers();
    }),

    // Admin: referral stats
    referralStats: adminProcedure.query(async () => {
      return db.getReferralStats();
    }),

    // Admin: list/update points rules
    adminRules: adminProcedure.query(async () => {
      return db.getPointsRules();
    }),

    updateRule: adminProcedure
      .input(z.object({
        id: z.number(),
        points: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
        maxPerDay: z.number().min(1).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updatePointsRule(id, data);
      }),
  }),

  // ============================================================================
  // Engagement Tracking (Phase 4)
  // ============================================================================
  engagement: router({
    // Student: track an event
    track: protectedProcedure
      .input(z.object({
        eventType: z.string().min(1).max(50),
        entityType: z.string().max(30).optional(),
        entityId: z.number().optional(),
        metadata: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false };
        await db.trackEngagement({
          userId: ctx.user.id, eventType: input.eventType,
          entityType: input.entityType, entityId: input.entityId,
          metadata: input.metadata,
        });
        return { success: true };
      }),

    // Admin: engagement summary
    summary: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365).optional() }).optional())
      .query(async ({ input }) => {
        return db.getEngagementSummary(input?.days ?? 30);
      }),

    // Admin: engagement by entity
    byEntity: adminProcedure
      .input(z.object({
        entityType: z.string(),
        days: z.number().min(1).max(365).optional(),
      }))
      .query(async ({ input }) => {
        return db.getEngagementByEntity(input.entityType, input.days ?? 30);
      }),

    // Admin: user timeline
    userTimeline: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserEngagementTimeline(input.userId);
      }),
  }),

  // ====== Brokers ======
  brokers: router({
    // Public: active brokers for students
    listActive: publicProcedure.query(async () => {
      return db.getActiveBrokers();
    }),

    // Admin: all brokers
    list: adminProcedure.query(async () => {
      return db.getAllBrokers();
    }),

    // Admin: get single broker
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBrokerById(input.id);
      }),

    // Admin: create broker
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        logoUrl: z.string().optional(),
        affiliateUrl: z.string().url(),
        supportWhatsapp: z.string().optional(),
        minDeposit: z.number().min(0).default(0),
        minDepositCurrency: z.string().default("USD"),
        featuresEn: z.string().optional(),
        featuresAr: z.string().optional(),
        isActive: z.boolean().default(true),
        displayOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return db.createBroker(input);
      }),

    // Admin: update broker
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().min(1).optional(),
        nameAr: z.string().min(1).optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        logoUrl: z.string().optional(),
        affiliateUrl: z.string().url().optional(),
        supportWhatsapp: z.string().optional(),
        minDeposit: z.number().min(0).optional(),
        minDepositCurrency: z.string().optional(),
        featuresEn: z.string().optional(),
        featuresAr: z.string().optional(),
        isActive: z.boolean().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateBroker(id, data);
      }),

    // Admin: delete broker
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteBroker(input.id);
      }),
  }),

  // ====== Broker Onboarding ======
  onboarding: router({
    // Student: get my onboarding status
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('Not authenticated');
      return db.getUserOnboardingStatus(userId);
    }),

    // Student: check if onboarding is complete (for gating)
    isComplete: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const complete = await db.isUserBrokerOnboardingComplete(userId);
      return { complete };
    }),

    // Student: select a broker (step 1)
    selectBroker: protectedProcedure
      .input(z.object({ brokerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id;
        if (!userId) throw new Error('Not authenticated');
        return db.selectBrokerForOnboarding(userId, input.brokerId);
      }),

    // Student: submit proof for a step
    submitProof: protectedProcedure
      .input(z.object({
        step: z.string(),
        proofUrl: z.string().min(1),
        proofType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id;
        if (!userId) throw new Error('Not authenticated');
        const result = await db.submitOnboardingProof(userId, input.step, input.proofUrl, input.proofType);

        // Notify admin/support of new proof submission
        db.notifyStaffByEvent('broker_proof_submitted', {
          titleEn: `Broker proof submitted: ${ctx.user.name || ctx.user.email} (${input.step})`,
          titleAr: `تم رفع إثبات الوسيط: ${ctx.user.name || ctx.user.email} (${input.step})`,
          contentEn: `Student uploaded proof for step "${input.step}".`,
          contentAr: `الطالب رفع إثبات لخطوة "${input.step}".`,
          metadata: { userId, step: input.step },
        }).catch(() => {});

        // Run AI verification synchronously (Workers kill detached promises after response)
        if (result.stepId && ENV.openaiApiKey) {
          try {
            await verifyOnboardingProofWithAI(result.stepId, input.step, input.proofUrl);
          } catch (err) {
            logger.error('[Onboarding AI] Verification failed', { stepId: result.stepId, error: String(err) });
          }
        }

        return result;
      }),

    // Admin: get pending proofs for review
    pendingProofs: adminProcedure.query(async () => {
      return db.getPendingOnboardingProofs();
    }),

    // Admin: get all onboarding records
    allRecords: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        step: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllOnboardingRecords(input ?? undefined);
      }),

    // Admin: approve a step
    approve: adminProcedure
      .input(z.object({
        stepId: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const adminId = ctx.admin?.id ?? ctx.user?.id;
        if (!adminId) throw new Error('Not authenticated');
        return db.approveOnboardingStep(input.stepId, adminId, input.adminNote);
      }),

    // Admin: reject a step
    reject: adminProcedure
      .input(z.object({
        stepId: z.number(),
        rejectionReason: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const adminId = ctx.admin?.id ?? ctx.user?.id;
        if (!adminId) throw new Error('Not authenticated');
        return db.rejectOnboardingStep(input.stepId, adminId, input.rejectionReason);
      }),

    // Admin: save AI result on a proof
    saveAiResult: adminProcedure
      .input(z.object({
        stepId: z.number(),
        aiConfidence: z.number().min(0).max(1),
        aiResult: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.saveOnboardingAiResult(input.stepId, input.aiConfidence, input.aiResult);
      }),
  }),

  // ====== Offer Agreements ======
  offers: router({
    // Public: submit agreement (from standalone offer page)
    submitAgreement: publicProcedure
      .input(z.object({
        fullName: z.string().min(2).max(100),
        email: z.string().email().max(320),
        phone: z.string().max(20).optional(),
        offerSlug: z.string().min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = getReqHeader(ctx.req, 'cf-connecting-ip') || getReqHeader(ctx.req, 'x-forwarded-for') || '';
        const result = await db.submitOfferAgreement({ ...input, ipAddress: ip });

        // Notify admin of new offer agreement (only if not duplicate)
        if (!result.duplicate) {
          db.notifyStaffByEvent('offer_agreement', {
            titleEn: `Offer agreement signed: ${input.fullName}`,
            titleAr: `تم توقيع اتفاقية عرض: ${input.fullName}`,
            contentEn: `${input.email} signed the ${input.offerSlug} agreement.`,
            contentAr: `${input.email} وقّع على اتفاقية ${input.offerSlug}.`,
            metadata: { email: input.email, offerSlug: input.offerSlug },
          }).catch(() => {});
        }

        return result;
      }),

    // Admin: list agreements
    listAgreements: adminProcedure
      .input(z.object({ offerSlug: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.listOfferAgreements(input?.offerSlug);
      }),

    // Admin: delete agreement
    deleteAgreement: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteOfferAgreement(input.id);
      }),
  }),

  // ====== Foundation Plan Progress (10-Day Program) ======
  plan: router({
    // Public: lookup plan progress by email only (returning users)
    lookup: publicProcedure
      .input(z.object({ email: z.string().email().max(320) }))
      .mutation(async ({ input }) => {
        return db.lookupPlanProgress(input.email);
      }),

    // Public: get or create plan progress (student identifies by email)
    getProgress: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        fullName: z.string().min(2).max(100),
        phone: z.string().max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.getOrCreatePlanProgress(input);
      }),

    // Public: update task checkbox (enforces phase lock)
    updateTask: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        taskId: z.string().min(1).max(100),
        completed: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        // Extract phase number from taskId (e.g. "p1_open_demo" → 1)
        const phaseMatch = input.taskId.match(/^p(\d+)_/);
        if (phaseMatch) {
          const phaseNum = parseInt(phaseMatch[1]);
          const record = await db.getOrCreatePlanProgress({ email: input.email, fullName: '' });
          if (record) {
            const approvals = JSON.parse(record.phaseApprovals || '{}');
            const currentPhase = record.currentPhase || 1;
            const isAccessible = !!approvals[String(phaseNum)] || phaseNum === currentPhase;
            if (!isAccessible) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'هذه المرحلة مقفلة — تحتاج موافقة الدعم الفني' });
            }
          }
        }
        return db.updatePlanTaskProgress(input.email, input.taskId, input.completed);
      }),

    // Public: update phase answer text (enforces phase lock)
    updateAnswer: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
        phaseKey: z.string().min(1).max(50),
        answer: z.string().max(5000),
      }))
      .mutation(async ({ input }) => {
        // Extract phase number from phaseKey (e.g. "phase2" → 2)
        const phaseMatch = input.phaseKey.match(/^phase(\d+)$/);
        if (phaseMatch) {
          const phaseNum = parseInt(phaseMatch[1]);
          const record = await db.getOrCreatePlanProgress({ email: input.email, fullName: '' });
          if (record) {
            const approvals = JSON.parse(record.phaseApprovals || '{}');
            const currentPhase = record.currentPhase || 1;
            const isAccessible = !!approvals[String(phaseNum)] || phaseNum === currentPhase;
            if (!isAccessible) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'هذه المرحلة مقفلة — تحتاج موافقة الدعم الفني' });
            }
          }
        }
        const answerResult = await db.updatePlanAnswer(input.email, input.phaseKey, input.answer);

        // Notify admin/plan_manager of plan answer submission
        db.notifyStaffByEvent('plan_progress_update', {
          titleEn: `Plan answer submitted: ${input.email} (${input.phaseKey})`,
          titleAr: `تم إرسال إجابة الخطة: ${input.email} (${input.phaseKey})`,
          contentEn: `Student ${input.email} submitted an answer for ${input.phaseKey}.`,
          contentAr: `الطالب ${input.email} أرسل إجابة لـ ${input.phaseKey}.`,
          metadata: { email: input.email, phaseKey: input.phaseKey },
        }).catch(() => {});

        return answerResult;
      }),

    // Admin: list all student progress
    listAll: adminOrRoleProcedure(['plan_manager', 'support'])
      .query(async () => {
        return db.listPlanProgress();
      }),

    // Admin: approve a phase
    approvePhase: adminOrRoleProcedure(['plan_manager', 'support'])
      .input(z.object({ studentId: z.number(), phase: z.number().min(1).max(6) }))
      .mutation(async ({ input }) => {
        return db.approvePlanPhase(input.studentId, input.phase);
      }),

    // Admin: revoke phase approval
    revokePhase: adminOrRoleProcedure(['plan_manager', 'support'])
      .input(z.object({ studentId: z.number(), phase: z.number().min(1).max(6) }))
      .mutation(async ({ input }) => {
        return db.revokePlanPhase(input.studentId, input.phase);
      }),

    // Admin: update notes
    updateNotes: adminOrRoleProcedure(['plan_manager', 'support'])
      .input(z.object({ studentId: z.number(), notes: z.string().max(2000) }))
      .mutation(async ({ input }) => {
        return db.updatePlanAdminNotes(input.studentId, input.notes);
      }),
  }),

  // ============================================================================
  // Staff Notifications (Admin/Staff inbox)
  // ============================================================================
  staffNotifications: router({
    list: supportStaffProcedure.query(async ({ ctx }) => {
      return db.getStaffNotifications(ctx.user.id);
    }),

    unreadCount: supportStaffProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadStaffNotificationCount(ctx.user.id) };
    }),

    countByRoute: supportStaffProcedure.query(async ({ ctx }) => {
      return db.getUnreadStaffNotificationCountByRoute(ctx.user.id);
    }),

    markRead: supportStaffProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markStaffNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),

    markReadByRoute: supportStaffProcedure
      .input(z.object({ actionUrl: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.markStaffNotificationsReadByRoute(ctx.user.id, input.actionUrl);
        return { success: true };
      }),

    markAllRead: supportStaffProcedure.mutation(async ({ ctx }) => {
      await db.markAllStaffNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  monitoring: router({
    summary: adminProcedure
      .input(z.object({ days: z.number().min(1).max(90).optional() }).optional())
      .query(async ({ input }) => {
        return db.getStaffMonitoringSummary(input?.days ?? 14);
      }),

    actions: adminProcedure
      .input(z.object({
        days: z.number().min(1).max(90).optional(),
        staffUserId: z.number().optional(),
        limit: z.number().min(1).max(200).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listStaffActionLogs({
          days: input?.days,
          staffUserId: input?.staffUserId,
          limit: input?.limit,
        });
      }),

    sessions: adminProcedure
      .input(z.object({
        days: z.number().min(1).max(90).optional(),
        staffUserId: z.number().optional(),
        limit: z.number().min(1).max(200).optional(),
        status: z.enum(['all', 'active', 'closed']).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listStaffSessions({
          days: input?.days,
          staffUserId: input?.staffUserId,
          limit: input?.limit,
          status: input?.status,
        });
      }),
  }),

  // ============================================================================
  // Admin Settings (site-wide config)
  // ============================================================================
  adminSettings: router({
    getAll: adminProcedure.query(async () => {
      return db.getAllAdminSettings();
    }),

    update: adminProcedure
      .input(z.object({ key: z.string().min(1).max(100), value: z.string().max(5000) }))
      .mutation(async ({ input }) => {
        await db.setAdminSetting(input.key, input.value);
        return { success: true };
      }),

    // Per-staff or admin: update own notification email preferences
    updateNotificationPrefs: supportStaffProcedure
      .input(z.object({ prefs: z.record(z.string(), z.boolean()) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateStaffNotificationPrefs(ctx.user.id, input.prefs);
        return { success: true };
      }),

    getNotificationPrefs: supportStaffProcedure.query(async ({ ctx }) => {
      return db.getStaffNotificationPrefs(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;