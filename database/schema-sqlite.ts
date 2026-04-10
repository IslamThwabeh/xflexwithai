import { int, sqliteTable, text, integer, unique, real } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash", { length: 255 }).notNull(),
  loginSecurityMode: text("loginSecurityMode", { length: 30 }).default("password_or_otp").notNull(),
  name: text("name"),
  phone: text("phone", { length: 20 }),
  city: text("city", { length: 100 }),
  country: text("country", { length: 100 }),
  emailVerified: integer("emailVerified", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
  lastSignedIn: text("lastSignedIn").default("CURRENT_TIMESTAMP").notNull(),
  lastActiveAt: text("lastActiveAt"),
  lastInteractiveAt: text("lastInteractiveAt"),
  notificationPrefs: text("notificationPrefs").default("{}"),
  telegram_user_id: text("telegram_user_id").unique(),
  user_type: text("user_type", { length: 20 }).default("web"),
  pointsBalance: integer("points_balance").default(0).notNull(),
  referralCode: text("referralCode"),
  isStaff: integer("isStaff", { mode: 'boolean' }).default(false).notNull(),
  brokerOnboardingComplete: integer("brokerOnboardingComplete", { mode: 'boolean' }).default(false).notNull(),
  staffNotificationPrefs: text("staffNotificationPrefs").default("{}"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Email OTPs for passwordless sign-in.
 * Store only hashed codes + salt.
 */
export const authEmailOtps = sqliteTable("authEmailOtps", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email", { length: 320 }).notNull(),
  purpose: text("purpose", { length: 20 }).default("login").notNull(),
  codeHash: text("codeHash", { length: 128 }).notNull(),
  salt: text("salt", { length: 64 }).notNull(),
  ipHash: text("ipHash", { length: 128 }),
  userAgentHash: text("userAgentHash", { length: 128 }),
  sentAtMs: integer("sentAtMs").notNull(),
  expiresAtMs: integer("expiresAtMs").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type AuthEmailOtp = typeof authEmailOtps.$inferSelect;
export type InsertAuthEmailOtp = typeof authEmailOtps.$inferInsert;

/**
 * Admins table - separate from regular users
 */
export const admins = sqliteTable("admins", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
  lastSignedIn: text("lastSignedIn").default("CURRENT_TIMESTAMP").notNull(),
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = typeof admins.$inferInsert;

/**
 * Courses table - stores trading course information
 */
export const courses = sqliteTable("courses", {
  id: int("id").primaryKey({ autoIncrement: true }),
  titleEn: text("titleEn", { length: 255 }).notNull(),
  titleAr: text("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn").notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  price: integer("price").default(0).notNull(),
  currency: text("currency", { length: 3 }).default("USD").notNull(),
  isPublished: integer("isPublished", { mode: 'boolean' }).default(false).notNull(),
  level: text("level", { length: 20 }).default("beginner").notNull(), // 'beginner' | 'intermediate' | 'advanced'
  duration: integer("duration"),
  stageNumber: integer("stageNumber").default(0), // Stage order (1-8 for the 8 stages)
  introVideoUrl: text("introVideoUrl"), // Short intro video for non-subscribers
  hasPdf: integer("hasPdf", { mode: 'boolean' }).default(false),
  hasIntroVideo: integer("hasIntroVideo", { mode: 'boolean' }).default(false),
  pdfUrl: text("pdfUrl"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Episodes table - stores individual course lessons/videos
 */
export const episodes = sqliteTable("episodes", {
  id: int("id").primaryKey({ autoIncrement: true }),
  courseId: integer("courseId").notNull(),
  titleEn: text("titleEn", { length: 255 }).notNull(),
  titleAr: text("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  videoUrl: text("videoUrl"),
  duration: integer("duration"),
  order: integer("order").notNull(),
  isFree: integer("isFree", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

/**
 * Enrollments table - tracks user course enrollments and subscriptions
 */
export const enrollments = sqliteTable("enrollments", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  enrolledAt: text("enrolledAt").default("CURRENT_TIMESTAMP").notNull(),
  lastAccessed: text("lastAccessed").default("CURRENT_TIMESTAMP").notNull(),
  progressPercentage: integer("progressPercentage").default(0).notNull(),
  completedEpisodes: integer("completedEpisodes").default(0).notNull(),
  completedAt: text("completedAt"),
  paymentStatus: text("paymentStatus", { length: 20 }).default("pending").notNull(), // 'pending' | 'completed' | 'failed' | 'refunded'
  paymentAmount: integer("paymentAmount"),
  paymentCurrency: text("paymentCurrency", { length: 3 }).default("USD"),
  isSubscriptionActive: integer("isSubscriptionActive", { mode: 'boolean' }).default(true).notNull(),
  subscriptionStartDate: text("subscriptionStartDate"),
  subscriptionEndDate: text("subscriptionEndDate"),
  registrationKeyId: integer("registrationKeyId"),
  activatedViaKey: integer("activatedViaKey", { mode: 'boolean' }).default(false).notNull(),
  isAdminSkipped: integer("isAdminSkipped", { mode: 'boolean' }).default(false).notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Registration Keys table - stores activation keys for package/course access control
 * Legacy: courseId > 0 = course key, 0 = lexai, -1 = recommendation
 * New: packageId != null = package key (grants full package entitlements)
 */
export const registrationKeys = sqliteTable("registrationKeys", {
  id: int("id").primaryKey({ autoIncrement: true }),
  keyCode: text("keyCode", { length: 255 }).notNull().unique(),
  email: text("email", { length: 320 }),
  courseId: integer("courseId").notNull(),
  packageId: integer("packageId"), // NEW: links to packages.id — when set, this is a package key
  isUpgrade: integer("isUpgrade", { mode: 'boolean' }).default(false), // true if this key is an upgrade from Basic→Comprehensive
  isRenewal: integer("isRenewal", { mode: 'boolean' }).default(false), // true if this key extends (renews) an existing subscription
  referredBy: text("referredBy"), // team member who convinced the user to upgrade
  activatedAt: text("activatedAt"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  createdBy: integer("createdBy").notNull(),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  notes: text("notes"),
  price: integer("price").default(0).notNull(),
  currency: text("currency", { length: 3 }).default("USD").notNull(),
  entitlementDays: integer("entitlementDays"),
  expiresAt: text("expiresAt"),
});

export type RegistrationKey = typeof registrationKeys.$inferSelect;
export type InsertRegistrationKey = typeof registrationKeys.$inferInsert;

/**
 * Episode Progress table - tracks which episodes users have watched
 */
export const episodeProgress = sqliteTable("episodeProgress", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  episodeId: integer("episodeId").notNull(),
  courseId: integer("courseId").notNull(),
  watchedDuration: integer("watchedDuration").default(0).notNull(),
  isCompleted: integer("isCompleted", { mode: 'boolean' }).default(false).notNull(),
  lastWatchedAt: text("lastWatchedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type EpisodeProgress = typeof episodeProgress.$inferSelect;
export type InsertEpisodeProgress = typeof episodeProgress.$inferInsert;

/**
 * LexAI Subscriptions table
 */
export const lexaiSubscriptions = sqliteTable("lexaiSubscriptions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  isPaused: integer("isPaused", { mode: 'boolean' }).default(false).notNull(),
  isPendingActivation: integer("isPendingActivation", { mode: 'boolean' }).default(false).notNull(),
  studentActivatedAt: text("studentActivatedAt"),
  maxActivationDate: text("maxActivationDate"),
  startDate: text("startDate").default("CURRENT_TIMESTAMP").notNull(),
  endDate: text("endDate").notNull(),
  autoRenew: integer("autoRenew", { mode: 'boolean' }).default(true).notNull(),
  paymentStatus: text("paymentStatus", { length: 20 }).default("pending").notNull(),
  paymentAmount: integer("paymentAmount").notNull(),
  paymentCurrency: text("paymentCurrency", { length: 3 }).default("USD").notNull(),
  messagesUsed: integer("messagesUsed").default(0).notNull(),
  messagesLimit: integer("messagesLimit").default(100).notNull(),
  pausedAt: text("pausedAt"),
  pausedReason: text("pausedReason"),
  pausedRemainingDays: integer("pausedRemainingDays"),
  frozenUntil: text("frozenUntil"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type LexaiSubscription = typeof lexaiSubscriptions.$inferSelect;
export type InsertLexaiSubscription = typeof lexaiSubscriptions.$inferInsert;

/**
 * LexAI Messages table
 */
export const lexaiMessages = sqliteTable("lexaiMessages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId").notNull(),
  role: text("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  analysisType: text("analysisType", { length: 50 }),
  confidence: integer("confidence"),
  apiRequestId: text("apiRequestId", { length: 255 }),
  apiStatus: text("apiStatus", { length: 20 }).default("pending"), // 'pending' | 'success' | 'failed'
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type LexaiMessage = typeof lexaiMessages.$inferSelect;
export type InsertLexaiMessage = typeof lexaiMessages.$inferInsert;

/**
 * FlexAI Subscriptions table
 */
export const flexaiSubscriptions = sqliteTable("flexaiSubscriptions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  registrationKeyId: integer("registrationKeyId"),
  status: text("status", { length: 20 }).default("active"),
  activatedAt: text("activatedAt").default("CURRENT_TIMESTAMP"),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP"),
});

export type FlexaiSubscription = typeof flexaiSubscriptions.$inferSelect;
export type InsertFlexaiSubscription = typeof flexaiSubscriptions.$inferInsert;

/**
 * FlexAI Messages table
 */
export const flexaiMessages = sqliteTable("flexaiMessages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  role: text("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  analysisResult: text("analysisResult"), // JSON as text
  analysisType: text("analysisType", { length: 50 }),
  timeframe: text("timeframe", { length: 10 }),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP"),
});

export type FlexaiMessage = typeof flexaiMessages.$inferSelect;
export type InsertFlexaiMessage = typeof flexaiMessages.$inferInsert;

/**
 * Recommendation group subscriptions
 */
export const recommendationSubscriptions = sqliteTable("recommendationSubscriptions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  registrationKeyId: integer("registrationKeyId"),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  isPaused: integer("isPaused", { mode: 'boolean' }).default(false).notNull(),
  isPendingActivation: integer("isPendingActivation", { mode: 'boolean' }).default(false).notNull(),
  studentActivatedAt: text("studentActivatedAt"),
  maxActivationDate: text("maxActivationDate"),
  startDate: text("startDate").default("CURRENT_TIMESTAMP").notNull(),
  endDate: text("endDate").notNull(),
  paymentStatus: text("paymentStatus", { length: 20 }).default("key").notNull(),
  paymentAmount: integer("paymentAmount").default(100).notNull(),
  paymentCurrency: text("paymentCurrency", { length: 3 }).default("USD").notNull(),
  pausedAt: text("pausedAt"),
  pausedReason: text("pausedReason"),
  pausedRemainingDays: integer("pausedRemainingDays"),
  frozenUntil: text("frozenUntil"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type RecommendationSubscription = typeof recommendationSubscriptions.$inferSelect;
export type InsertRecommendationSubscription = typeof recommendationSubscriptions.$inferInsert;

/**
 * Pending recommendation alert workflow
 */
export const recommendationAlerts = sqliteTable("recommendationAlerts", {
  id: int("id").primaryKey({ autoIncrement: true }),
  analystUserId: integer("analystUserId").notNull(),
  note: text("note"),
  notifiedAt: text("notifiedAt").notNull(),
  unlockAt: text("unlockAt").notNull(),
  expiresAt: text("expiresAt").notNull(),
  status: text("status", { length: 20 }).default("pending").notNull(),
  cancelledAt: text("cancelledAt"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type RecommendationAlert = typeof recommendationAlerts.$inferSelect;
export type InsertRecommendationAlert = typeof recommendationAlerts.$inferInsert;

/**
 * Recommendation group messages
 */
export const recommendationMessages = sqliteTable("recommendationMessages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  type: text("type", { length: 20 }).default("recommendation").notNull(), // historical 'alert' | 'recommendation' | 'update' | 'result'
  content: text("content").notNull(),
  symbol: text("symbol", { length: 30 }),
  side: text("side", { length: 10 }), // buy/sell
  entryPrice: text("entryPrice", { length: 50 }),
  stopLoss: text("stopLoss", { length: 50 }),
  takeProfit1: text("takeProfit1", { length: 50 }),
  takeProfit2: text("takeProfit2", { length: 50 }),
  riskPercent: text("riskPercent", { length: 20 }),
  parentId: integer("parentId"),  // links result to original recommendation
  threadStatus: text("threadStatus", { length: 20 }), // root-only: 'open' | 'closed'
  closedAt: text("closedAt"),
  closedByUserId: integer("closedByUserId"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type RecommendationMessage = typeof recommendationMessages.$inferSelect;
export type InsertRecommendationMessage = typeof recommendationMessages.$inferInsert;

/**
 * Recommendation message reactions
 */
export const recommendationReactions = sqliteTable("recommendationReactions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  messageId: integer("messageId").notNull(),
  userId: integer("userId").notNull(),
  reaction: text("reaction", { length: 20 }).notNull(), // like | love | sad | fire | rocket
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
}, (table) => ({
  uniqueMessageReactionByUser: unique("unique_message_reaction_by_user").on(table.messageId, table.userId),
}));

export type RecommendationReaction = typeof recommendationReactions.$inferSelect;
export type InsertRecommendationReaction = typeof recommendationReactions.$inferInsert;

/**
 * Quizzes table
 */
export const quizzes = sqliteTable("quizzes", {
  id: int("id").primaryKey({ autoIncrement: true }),
  level: integer("level").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").notNull().default(50),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

/**
 * Quiz questions table
 */
export const quizQuestions = sqliteTable("quiz_questions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  quizId: integer("quiz_id").notNull(),
  questionText: text("question_text").notNull(),
  orderNum: integer("order_num").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

/**
 * Quiz options table
 */
export const quizOptions = sqliteTable("quiz_options", {
  id: int("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").notNull(),
  optionId: text("option_id", { length: 1 }).notNull(),
  optionText: text("option_text").notNull(),
  isCorrect: integer("is_correct", { mode: 'boolean' }).notNull().default(false),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type QuizOption = typeof quizOptions.$inferSelect;
export type InsertQuizOption = typeof quizOptions.$inferInsert;

/**
 * Quiz attempts table
 */
export const quizAttempts = sqliteTable("quiz_attempts", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  quizId: integer("quiz_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: text("percentage").notNull(), // Store as text instead of decimal
  passed: integer("passed", { mode: 'boolean' }).notNull(),
  startedAt: text("started_at").default("CURRENT_TIMESTAMP").notNull(),
  completedAt: text("completed_at").default("CURRENT_TIMESTAMP").notNull(),
  timeTakenSeconds: integer("time_taken_seconds"),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

/**
 * Quiz answers table
 */
export const quizAnswers = sqliteTable("quiz_answers", {
  id: int("id").primaryKey({ autoIncrement: true }),
  attemptId: integer("attempt_id").notNull(),
  questionId: integer("question_id").notNull(),
  selectedOptionId: text("selected_option_id", { length: 1 }).notNull(),
  isCorrect: integer("is_correct", { mode: 'boolean' }).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type InsertQuizAnswer = typeof quizAnswers.$inferInsert;

/**
 * User quiz progress table
 */
export const userQuizProgress = sqliteTable("user_quiz_progress", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  quizId: integer("quiz_id").notNull(),
  isUnlocked: integer("is_unlocked", { mode: 'boolean' }).notNull().default(false),
  isCompleted: integer("is_completed", { mode: 'boolean' }).notNull().default(false),
  bestScore: integer("best_score").default(0),
  bestPercentage: text("best_percentage").default("0"), // Store as text instead of decimal
  attemptsCount: integer("attempts_count").default(0),
  lastAttemptAt: text("last_attempt_at"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
}, (table) => ({
  uniqueUserQuiz: unique("unique_user_quiz").on(table.userId, table.quizId),
}));

export type UserQuizProgress = typeof userQuizProgress.$inferSelect;
export type InsertUserQuizProgress = typeof userQuizProgress.$inferInsert;

// ============================================================================
// User Roles – RBAC for admin-assigned roles
// ============================================================================

/**
 * Stores role assignments for users.
 * Roles: 'analyst' (handles recommendations), 'support' (handles support chats),
 *        'key_manager' (generates registration keys – a special support member)
 * Admin is NOT stored here; admin access is via the separate admins table.
 */
export const userRoles = sqliteTable("userRoles", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  role: text("role", { length: 30 }).notNull(), // 'analyst' | 'support' | 'key_manager'
  assignedAt: text("assignedAt").default("CURRENT_TIMESTAMP").notNull(),
  assignedBy: integer("assignedBy"), // admin id who assigned
}, (table) => ({
  uniqueUserRole: unique("unique_user_role").on(table.userId, table.role),
}));

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ============================================================================
// Support Chat – private 1-on-1 client↔support conversations
// ============================================================================

/**
 * Each client has at most one open conversation at a time.
 */
export const supportConversations = sqliteTable("supportConversations", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  status: text("status", { length: 20 }).default("open").notNull(), // 'open' | 'closed'
  needsHuman: integer("needsHuman", { mode: 'boolean' }).default(false).notNull(), // student escalated to human
  assignedTo: integer("assignedTo"), // support user id handling this conversation
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
  closedAt: text("closedAt"),
});

export type SupportConversation = typeof supportConversations.$inferSelect;
export type InsertSupportConversation = typeof supportConversations.$inferInsert;

/**
 * Messages in a support conversation.
 */
export const supportMessages = sqliteTable("supportMessages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversationId").notNull(),
  senderId: integer("senderId").notNull(),
  senderType: text("senderType", { length: 20 }).notNull(), // 'client' | 'support' | 'admin' | 'bot'
  content: text("content").notNull(),
  isRead: integer("isRead", { mode: 'boolean' }).default(false).notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  attachmentSize: integer("attachment_size"),
  attachmentType: text("attachmentType"), // 'file' | 'voice' | null
  attachmentDuration: integer("attachmentDuration"), // voice duration in seconds
  editedAt: text("editedAt"),   // ISO timestamp if message was edited, null otherwise
  deletedAt: text("deletedAt"), // ISO timestamp if message was soft-deleted, null otherwise
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;

/**
 * Bug reports submitted by clients for manual review and point rewards.
 */
export const bugReports = sqliteTable("bug_reports", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  status: text("status", { length: 20 }).default("pending").notNull(), // pending | rewarded | rejected
  riskLevel: text("riskLevel", { length: 20 }), // low | medium | high | critical
  awardedPoints: integer("awardedPoints").default(0).notNull(),
  adminNote: text("adminNote"),
  reviewedAt: text("reviewedAt"),
  reviewedByType: text("reviewedByType", { length: 20 }), // admin | staff
  reviewedById: integer("reviewedById"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type BugReport = typeof bugReports.$inferSelect;
export type InsertBugReport = typeof bugReports.$inferInsert;

// ============================================================================
// Packages – subscription bundles (Basic / Comprehensive)
// ============================================================================

export const packages = sqliteTable("packages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  slug: text("slug", { length: 50 }).notNull().unique(),
  nameEn: text("nameEn", { length: 255 }).notNull(),
  nameAr: text("nameAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  price: integer("price").notNull().default(0), // in cents (e.g. 20000 = $200)
  currency: text("currency", { length: 3 }).default("USD").notNull(),
  renewalPrice: integer("renewalPrice").default(0), // optional monthly renewal in cents
  renewalPeriodDays: integer("renewalPeriodDays").default(0),
  renewalDescription: text("renewalDescription"),
  includesLexai: integer("includesLexai", { mode: 'boolean' }).default(false).notNull(),
  includesRecommendations: integer("includesRecommendations", { mode: 'boolean' }).default(false).notNull(),
  includesSupport: integer("includesSupport", { mode: 'boolean' }).default(false).notNull(),
  includesPdf: integer("includesPdf", { mode: 'boolean' }).default(false).notNull(),
  durationDays: integer("durationDays").default(0),
  isLifetime: integer("isLifetime", { mode: 'boolean' }).default(true).notNull(),
  isPublished: integer("isPublished", { mode: 'boolean' }).default(false).notNull(),
  displayOrder: integer("displayOrder").default(0).notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  upgradePrice: integer("upgradePrice").default(0), // in cents — price to upgrade from a lower-tier package to this one
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

export const packageCourses = sqliteTable("packageCourses", {
  id: int("id").primaryKey({ autoIncrement: true }),
  packageId: integer("packageId").notNull(),
  courseId: integer("courseId").notNull(),
  displayOrder: integer("displayOrder").default(0).notNull(),
}, (table) => ({
  uniquePackageCourse: unique("unique_package_course").on(table.packageId, table.courseId),
}));

export type PackageCourse = typeof packageCourses.$inferSelect;
export type InsertPackageCourse = typeof packageCourses.$inferInsert;

// ============================================================================
// Orders – shopping cart checkout
// ============================================================================

export const orders = sqliteTable("orders", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  status: text("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'paid' | 'failed' | 'refunded'
  subtotal: integer("subtotal").default(0).notNull(), // in cents
  discountAmount: integer("discountAmount").default(0).notNull(),
  vatRate: integer("vatRate").default(16).notNull(), // 16 = 16%
  vatAmount: integer("vatAmount").default(0).notNull(),
  totalAmount: integer("totalAmount").default(0).notNull(),
  currency: text("currency", { length: 3 }).default("USD").notNull(),
  paymentMethod: text("paymentMethod", { length: 30 }), // 'paypal' | 'bank_transfer' | 'visa'
  paymentReference: text("paymentReference"), // external payment ID
  paymentProofUrl: text("paymentProofUrl"), // receipt upload for bank transfers
  isGift: integer("isGift", { mode: 'boolean' }).default(false).notNull(),
  giftEmail: text("giftEmail", { length: 320 }),
  giftMessage: text("giftMessage"),
  notes: text("notes"),
  isUpgrade: integer("isUpgrade", { mode: 'boolean' }).default(false).notNull(),
  upgradeFromPackageId: integer("upgradeFromPackageId"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
  completedAt: text("completedAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export const orderItems = sqliteTable("orderItems", {
  id: int("id").primaryKey({ autoIncrement: true }),
  orderId: integer("orderId").notNull(),
  itemType: text("itemType", { length: 20 }).default("package").notNull(), // 'package' | 'course'
  packageId: integer("packageId"),
  courseId: integer("courseId"),
  priceAtPurchase: integer("priceAtPurchase").default(0).notNull(),
  currency: text("currency", { length: 3 }).default("USD").notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// Package Subscriptions – user owns a package
// ============================================================================

export const packageSubscriptions = sqliteTable("packageSubscriptions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  packageId: integer("packageId").notNull(),
  orderId: integer("orderId"),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  startDate: text("startDate").default("CURRENT_TIMESTAMP").notNull(),
  endDate: text("endDate"),
  renewalDueDate: text("renewalDueDate"),
  autoRenew: integer("autoRenew", { mode: 'boolean' }).default(false).notNull(),
  upgradedFromPackageId: integer("upgradedFromPackageId"),
  upgradedAt: text("upgradedAt"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type PackageSubscription = typeof packageSubscriptions.$inferSelect;
export type InsertPackageSubscription = typeof packageSubscriptions.$inferInsert;

// ============================================================================
// Events – monthly events (live streams, competitions, offers)
// ============================================================================

export const events = sqliteTable("events", {
  id: int("id").primaryKey({ autoIncrement: true }),
  titleEn: text("titleEn", { length: 255 }).notNull(),
  titleAr: text("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  eventType: text("eventType", { length: 20 }).default("live").notNull(), // 'live' | 'competition' | 'offer' | 'webinar'
  eventDate: text("eventDate").notNull(),
  eventEndDate: text("eventEndDate"),
  imageUrl: text("imageUrl"),
  linkUrl: text("linkUrl"),
  isPublished: integer("isPublished", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ============================================================================
// Articles – blog posts
// ============================================================================

export const articles = sqliteTable("articles", {
  id: int("id").primaryKey({ autoIncrement: true }),
  slug: text("slug", { length: 255 }).notNull().unique(),
  titleEn: text("titleEn", { length: 255 }).notNull(),
  titleAr: text("titleAr", { length: 255 }).notNull(),
  contentEn: text("contentEn"),
  contentAr: text("contentAr"),
  excerptEn: text("excerptEn"),
  excerptAr: text("excerptAr"),
  thumbnailUrl: text("thumbnailUrl"),
  authorId: integer("authorId"),
  isPublished: integer("isPublished", { mode: 'boolean' }).default(false).notNull(),
  publishedAt: text("publishedAt"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ============================================================================
// Relations
// ============================================================================

export const coursesRelations = relations(courses, ({ many }) => ({
  episodes: many(episodes),
  enrollments: many(enrollments),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  course: one(courses, {
    fields: [episodes.courseId],
    references: [courses.id],
  }),
  progress: many(episodeProgress),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  registrationKey: one(registrationKeys, {
    fields: [enrollments.registrationKeyId],
    references: [registrationKeys.id],
  }),
}));

export const registrationKeysRelations = relations(registrationKeys, ({ one, many }) => ({
  course: one(courses, {
    fields: [registrationKeys.courseId],
    references: [courses.id],
  }),
  admin: one(admins, {
    fields: [registrationKeys.createdBy],
    references: [admins.id],
  }),
  enrollments: many(enrollments),
}));

export const episodeProgressRelations = relations(episodeProgress, ({ one }) => ({
  user: one(users, {
    fields: [episodeProgress.userId],
    references: [users.id],
  }),
  episode: one(episodes, {
    fields: [episodeProgress.episodeId],
    references: [episodes.id],
  }),
  course: one(courses, {
    fields: [episodeProgress.courseId],
    references: [courses.id],
  }),
}));

export const lexaiSubscriptionsRelations = relations(lexaiSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [lexaiSubscriptions.userId],
    references: [users.id],
  }),
  messages: many(lexaiMessages),
}));

export const lexaiMessagesRelations = relations(lexaiMessages, ({ one }) => ({
  user: one(users, {
    fields: [lexaiMessages.userId],
    references: [users.id],
  }),
  subscription: one(lexaiSubscriptions, {
    fields: [lexaiMessages.subscriptionId],
    references: [lexaiSubscriptions.id],
  }),
}));

export const flexaiSubscriptionsRelations = relations(flexaiSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [flexaiSubscriptions.userId],
    references: [users.id],
  }),
  registrationKey: one(registrationKeys, {
    fields: [flexaiSubscriptions.registrationKeyId],
    references: [registrationKeys.id],
  }),
  messages: many(flexaiMessages),
}));

export const flexaiMessagesRelations = relations(flexaiMessages, ({ one }) => ({
  user: one(users, {
    fields: [flexaiMessages.userId],
    references: [users.id],
  }),
  subscription: one(flexaiSubscriptions, {
    fields: [flexaiMessages.subscriptionId],
    references: [flexaiSubscriptions.id],
  }),
}));

export const recommendationSubscriptionsRelations = relations(recommendationSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [recommendationSubscriptions.userId],
    references: [users.id],
  }),
  registrationKey: one(registrationKeys, {
    fields: [recommendationSubscriptions.registrationKeyId],
    references: [registrationKeys.id],
  }),
}));

export const recommendationAlertsRelations = relations(recommendationAlerts, ({ one }) => ({
  user: one(users, {
    fields: [recommendationAlerts.analystUserId],
    references: [users.id],
  }),
}));

export const recommendationMessagesRelations = relations(recommendationMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [recommendationMessages.userId],
    references: [users.id],
  }),
  reactions: many(recommendationReactions),
}));

export const recommendationReactionsRelations = relations(recommendationReactions, ({ one }) => ({
  message: one(recommendationMessages, {
    fields: [recommendationReactions.messageId],
    references: [recommendationMessages.id],
  }),
  user: one(users, {
    fields: [recommendationReactions.userId],
    references: [users.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
  progress: many(userQuizProgress),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  options: many(quizOptions),
  answers: many(quizAnswers),
}));

export const quizOptionsRelations = relations(quizOptions, ({ one }) => ({
  question: one(quizQuestions, {
    fields: [quizOptions.questionId],
    references: [quizQuestions.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  answers: many(quizAnswers),
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizAnswers.questionId],
    references: [quizQuestions.id],
  }),
}));

export const userQuizProgressRelations = relations(userQuizProgress, ({ one }) => ({
  user: one(users, {
    fields: [userQuizProgress.userId],
    references: [users.id],
  }),
  quiz: one(quizzes, {
    fields: [userQuizProgress.quizId],
    references: [quizzes.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const supportConversationsRelations = relations(supportConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [supportConversations.userId],
    references: [users.id],
  }),
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  conversation: one(supportConversations, {
    fields: [supportMessages.conversationId],
    references: [supportConversations.id],
  }),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Package system relations
// ============================================================================

export const packagesRelations = relations(packages, ({ many }) => ({
  packageCourses: many(packageCourses),
  subscriptions: many(packageSubscriptions),
}));

export const packageCoursesRelations = relations(packageCourses, ({ one }) => ({
  package: one(packages, {
    fields: [packageCourses.packageId],
    references: [packages.id],
  }),
  course: one(courses, {
    fields: [packageCourses.courseId],
    references: [courses.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  package: one(packages, {
    fields: [orderItems.packageId],
    references: [packages.id],
  }),
  course: one(courses, {
    fields: [orderItems.courseId],
    references: [courses.id],
  }),
}));

export const packageSubscriptionsRelations = relations(packageSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [packageSubscriptions.userId],
    references: [users.id],
  }),
  package: one(packages, {
    fields: [packageSubscriptions.packageId],
    references: [packages.id],
  }),
  order: one(orders, {
    fields: [packageSubscriptions.orderId],
    references: [orders.id],
  }),
}));

export const eventsRelations = relations(events, () => ({}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(admins, {
    fields: [articles.authorId],
    references: [admins.id],
  }),
}));

// ============================================================================
// Coupons / Discount Codes
// ============================================================================

export const coupons = sqliteTable("coupons", {
  id: int("id").primaryKey({ autoIncrement: true }),
  code: text("code", { length: 50 }).notNull().unique(),
  discountType: text("discount_type", { length: 20 }).notNull(), // 'percentage' | 'fixed'
  discountValue: integer("discount_value").notNull(), // percentage (0-100) or fixed amount in cents
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  minOrderAmount: integer("min_order_amount"), // in cents, null = no minimum
  validFrom: text("valid_from"),
  validUntil: text("valid_until"),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  packageId: integer("package_id"), // null = applies to all packages
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// ============================================================================
// Testimonials
// ============================================================================

export const testimonials = sqliteTable("testimonials", {
  id: int("id").primaryKey({ autoIncrement: true }),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  titleEn: text("title_en"),
  titleAr: text("title_ar"),
  textEn: text("text_en").notNull(),
  textAr: text("text_ar").notNull(),
  avatarUrl: text("avatar_url"),
  proofImageUrl: text("proof_image_url"),
  rating: integer("rating").notNull().default(5), // 1-5 stars
  packageSlug: text("package_slug"),
  courseId: integer("course_id"),
  serviceKey: text("service_key", { length: 40 }), // lexai | recommendations | courses | community
  displayOrder: integer("display_order").notNull().default(0),
  showProofOnHome: integer("show_proof_on_home", { mode: 'boolean' }).notNull().default(false),
  showProofOnDashboard: integer("show_proof_on_dashboard", { mode: 'boolean' }).notNull().default(false),
  isPublished: integer("is_published", { mode: 'boolean' }).notNull().default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

// ============================================================================
// Jobs / Careers System
// ============================================================================

export const jobs = sqliteTable("jobs", {
  id: int("id").primaryKey({ autoIncrement: true }),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en"),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

export const jobQuestions = sqliteTable("job_questions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id"),
  questionAr: text("question_ar").notNull(),
  questionEn: text("question_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
});

export type JobQuestion = typeof jobQuestions.$inferSelect;
export type InsertJobQuestion = typeof jobQuestions.$inferInsert;

export const jobApplications = sqliteTable("job_applications", {
  id: int("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country"),
  cvFileUrl: text("cv_file_url"),
  cvFileKey: text("cv_file_key"),
  status: text("status", { length: 20 }).notNull().default("new"), // new | reviewed | shortlisted | rejected
  submittedAt: text("submitted_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
  // AI scoring fields (future)
  aiScore: integer("ai_score"),
  aiSummary: text("ai_summary"),
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = typeof jobApplications.$inferInsert;

export const jobApplicationAnswers = sqliteTable("job_application_answers", {
  id: int("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull(),
  questionId: integer("question_id").notNull(),
  answer: text("answer").notNull(),
});

export type JobApplicationAnswer = typeof jobApplicationAnswers.$inferSelect;
export type InsertJobApplicationAnswer = typeof jobApplicationAnswers.$inferInsert;

// Relations for jobs
export const jobsRelations = relations(jobs, ({ many }) => ({
  questions: many(jobQuestions),
  applications: many(jobApplications),
}));

export const jobQuestionsRelations = relations(jobQuestions, ({ one }) => ({
  job: one(jobs, {
    fields: [jobQuestions.jobId],
    references: [jobs.id],
  }),
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one, many }) => ({
  job: one(jobs, {
    fields: [jobApplications.jobId],
    references: [jobs.id],
  }),
  answers: many(jobApplicationAnswers),
}));

export const jobApplicationAnswersRelations = relations(jobApplicationAnswers, ({ one }) => ({
  application: one(jobApplications, {
    fields: [jobApplicationAnswers.applicationId],
    references: [jobApplications.id],
  }),
  question: one(jobQuestions, {
    fields: [jobApplicationAnswers.questionId],
    references: [jobQuestions.id],
  }),
}));

// ============================================================================
// Course Reviews / Star Ratings (Phase 4)
// ============================================================================

export const courseReviews = sqliteTable("course_reviews", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  rating: integer("rating").notNull().default(5), // 1-5
  comment: text("comment"),
  isApproved: integer("is_approved", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP").notNull(),
}, (table) => ({
  uniqueUserCourse: unique().on(table.userId, table.courseId),
}));

export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = typeof courseReviews.$inferInsert;

// ============================================================================
// Offer Agreements (Eid / Promotional offers — terms acceptance tracking)
// ============================================================================

export const offerAgreements = sqliteTable("offer_agreements", {
  id: int("id").primaryKey({ autoIncrement: true }),
  fullName: text("fullName").notNull(),
  email: text("email").notNull(),
  phone: text("phone").default(""),
  offerSlug: text("offerSlug").notNull().default("eid-fitr-2026"),
  agreedAt: text("agreedAt").default("CURRENT_TIMESTAMP").notNull(),
  ipAddress: text("ipAddress").default(""),
}, (table) => ({
  uniqueEmailSlug: unique().on(table.email, table.offerSlug),
}));

export type OfferAgreement = typeof offerAgreements.$inferSelect;
export type InsertOfferAgreement = typeof offerAgreements.$inferInsert;

export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  user: one(users, {
    fields: [courseReviews.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
}));

// ============================================================================
// User Notifications (Phase 4)
// ============================================================================

export const userNotifications = sqliteTable("user_notifications", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  type: text("type", { length: 30 }).default("info").notNull(), // info | success | warning | action
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  contentEn: text("content_en"),
  contentAr: text("content_ar"),
  actionUrl: text("action_url"),
  isRead: integer("is_read", { mode: 'boolean' }).default(false).notNull(),
  batchId: text("batch_id"),
  emailSent: integer("email_sent", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = typeof userNotifications.$inferInsert;

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, {
    fields: [userNotifications.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Admin Actions (Audit Trail)
// ============================================================================

export const adminActions = sqliteTable("admin_actions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  adminId: integer("adminId").notNull(),
  userId: integer("userId").notNull(),
  action: text("action").notNull(),
  details: text("details"), // JSON string
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
});

export type AdminAction = typeof adminActions.$inferSelect;
export type InsertAdminAction = typeof adminActions.$inferInsert;

// ============================================================================
// Plan Progress (10-Day Foundation Program)
// ============================================================================

export const planProgress = sqliteTable("plan_progress", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  fullName: text("fullName").notNull(),
  phone: text("phone").default(""),
  progress: text("progress").default("{}").notNull(),       // JSON: taskId -> boolean
  answers: text("answers").default("{}").notNull(),          // JSON: phaseN -> text answer
  currentPhase: integer("currentPhase").default(1).notNull(),
  phaseApprovals: text("phaseApprovals").default("{}").notNull(), // JSON: phase -> boolean
  adminNotes: text("adminNotes").default(""),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
}, (table) => ({
  uniqueEmail: unique().on(table.email),
}));

export type PlanProgress = typeof planProgress.$inferSelect;
export type InsertPlanProgress = typeof planProgress.$inferInsert;

// ============================================================================
// Loyalty Points Transactions (Phase 4)
// ============================================================================

export const pointsTransactions = sqliteTable("points_transactions", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // positive = earn, negative = redeem
  type: text("type", { length: 20 }).default("earn").notNull(), // earn | redeem | bonus | expire
  reasonEn: text("reason_en"),
  reasonAr: text("reason_ar"),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type", { length: 30 }), // order | quiz | review | course_complete | login | referral
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type InsertPointsTransaction = typeof pointsTransactions.$inferInsert;

export const pointsTransactionsRelations = relations(pointsTransactions, ({ one }) => ({
  user: one(users, {
    fields: [pointsTransactions.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Engagement Events (Phase 4)
// ============================================================================

export const engagementEvents = sqliteTable("engagement_events", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  eventType: text("event_type").notNull(), // page_view | feature_use | course_start | course_complete | quiz_attempt | lexai_chat | recommendation_view
  entityType: text("entity_type"), // course | episode | package | article | event
  entityId: integer("entity_id"),
  metadata: text("metadata"), // JSON
  createdAt: text("created_at").default("CURRENT_TIMESTAMP").notNull(),
});

export type EngagementEvent = typeof engagementEvents.$inferSelect;
export type InsertEngagementEvent = typeof engagementEvents.$inferInsert;

export const engagementEventsRelations = relations(engagementEvents, ({ one }) => ({
  user: one(users, {
    fields: [engagementEvents.userId],
    references: [users.id],
  }),
}));

// ── Brokers ──────────────────────────────────────────────
export const brokers = sqliteTable("brokers", {
  id: int("id").primaryKey({ autoIncrement: true }),
  nameEn: text("nameEn").notNull(),
  nameAr: text("nameAr").notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  logoUrl: text("logoUrl"),
  affiliateUrl: text("affiliateUrl").notNull(),
  supportWhatsapp: text("supportWhatsapp"),
  minDeposit: integer("minDeposit").default(0),
  minDepositCurrency: text("minDepositCurrency").default("USD"),
  featuresEn: text("featuresEn"), // JSON array
  featuresAr: text("featuresAr"), // JSON array
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("displayOrder").notNull().default(0),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Broker = typeof brokers.$inferSelect;
export type NewBroker = typeof brokers.$inferInsert;

// ── Referrals ────────────────────────────────────────────
export const referrals = sqliteTable("referrals", {
  id: int("id").primaryKey({ autoIncrement: true }),
  referrerId: integer("referrerId").notNull(),
  refereeId: integer("refereeId").notNull(),
  status: text("status", { length: 20 }).default("pending").notNull(), // pending | activated | rewarded
  referrerPoints: integer("referrerPoints").default(0).notNull(),
  refereePoints: integer("refereePoints").default(0).notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  activatedAt: text("activatedAt"),
});

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;

export const referralRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, { fields: [referrals.referrerId], references: [users.id] }),
  referee: one(users, { fields: [referrals.refereeId], references: [users.id] }),
}));

// ── Points Rules ─────────────────────────────────────────
export const pointsRules = sqliteTable("points_rules", {
  id: int("id").primaryKey({ autoIncrement: true }),
  ruleKey: text("ruleKey").notNull().unique(),
  points: integer("points").notNull().default(0),
  nameEn: text("nameEn").notNull(),
  nameAr: text("nameAr").notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  maxPerDay: integer("maxPerDay"),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PointsRule = typeof pointsRules.$inferSelect;
export type NewPointsRule = typeof pointsRules.$inferInsert;

// ── Broker Onboarding ────────────────────────────────────
export const brokerOnboarding = sqliteTable("broker_onboarding", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  brokerId: integer("brokerId").notNull(),
  step: text("step").notNull(), // select_broker | open_account | deposit
  status: text("status").notNull().default("not_started"), // not_started | pending_review | approved | rejected
  proofUrl: text("proofUrl"),
  proofType: text("proofType"),
  aiConfidence: real("aiConfidence"),
  aiResult: text("aiResult"),
  adminNote: text("adminNote"),
  rejectionReason: text("rejectionReason"),
  submittedAt: text("submittedAt"),
  reviewedAt: text("reviewedAt"),
  reviewedBy: integer("reviewedBy"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type BrokerOnboarding = typeof brokerOnboarding.$inferSelect;
export type InsertBrokerOnboarding = typeof brokerOnboarding.$inferInsert;

// ============================================================================
// Email Log — tracks automated emails to prevent duplicates
// ============================================================================

export const emailLog = sqliteTable("email_log", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  emailType: text("emailType").notNull(), // drip_day_5, drip_day_10, milestone_10, inactivity_7, etc.
  metadata: text("metadata"), // JSON for extra context
  sentAt: text("sentAt").default(sql`(datetime('now'))`).notNull(),
});

export type EmailLog = typeof emailLog.$inferSelect;
export type InsertEmailLog = typeof emailLog.$inferInsert;

// ============================================================================
// LexAI Support Cases — internal workflow queue for LexAI monitoring/support
// ============================================================================

export const lexaiSupportCases = sqliteTable("lexai_support_cases", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  status: text("status").default("open").notNull(),
  priority: text("priority").default("normal").notNull(),
  assignedToUserId: integer("assignedToUserId"),
  assignedByUserId: integer("assignedByUserId"),
  lastMessageAt: text("lastMessageAt"),
  lastReviewedAt: text("lastReviewedAt"),
  resolvedAt: text("resolvedAt"),
  resolvedByUserId: integer("resolvedByUserId"),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type LexaiSupportCase = typeof lexaiSupportCases.$inferSelect;
export type InsertLexaiSupportCase = typeof lexaiSupportCases.$inferInsert;

export const lexaiSupportNotes = sqliteTable("lexai_support_notes", {
  id: int("id").primaryKey({ autoIncrement: true }),
  caseId: integer("caseId").notNull(),
  authorUserId: integer("authorUserId").notNull(),
  noteType: text("noteType").default("note").notNull(),
  content: text("content").notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type LexaiSupportNote = typeof lexaiSupportNotes.$inferSelect;
export type InsertLexaiSupportNote = typeof lexaiSupportNotes.$inferInsert;

// ============================================================================
// Staff Notifications (Admin/Staff inbox — separate from student notifications)
// ============================================================================

export const staffNotifications = sqliteTable("staff_notifications", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  eventType: text("eventType").notNull(),
  titleEn: text("titleEn").notNull(),
  titleAr: text("titleAr").notNull(),
  contentEn: text("contentEn"),
  contentAr: text("contentAr"),
  actionUrl: text("actionUrl"),
  metadata: text("metadata"), // JSON
  isRead: integer("isRead", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type StaffNotification = typeof staffNotifications.$inferSelect;
export type InsertStaffNotification = typeof staffNotifications.$inferInsert;

// ============================================================================
// Admin Settings (key-value store for site-wide config)
// ============================================================================

export const adminSettings = sqliteTable("admin_settings", {
  id: int("id").primaryKey({ autoIncrement: true }),
  settingKey: text("settingKey").notNull().unique(),
  settingValue: text("settingValue"),
  updatedAt: text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;

// ============================================================================
// Staff Monitoring Tables
// ============================================================================

/**
 * Staff Action Logs table - tracks significant actions performed by staff members.
 */
export const staffActionLogs = sqliteTable("staffActionLogs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffUserId: integer("staffUserId").notNull().references(() => users.id),
  actionType: text("actionType").notNull(), // e.g., 'KEY_GENERATED', 'USER_ROLE_CHANGED'
  resourceType: text("resourceType"), // e.g., 'packageKey', 'user'
  resourceId: integer("resourceId"),
  details: text("details"), // JSON blob for additional context
  ipAddress: text("ipAddress"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export type StaffActionLog = typeof staffActionLogs.$inferSelect;
export type InsertStaffActionLog = typeof staffActionLogs.$inferInsert;

/**
 * Staff Sessions table - tracks staff member login/logout events and session durations.
 */
export const staffSessions = sqliteTable("staffSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffUserId: integer("staffUserId").notNull().references(() => users.id),
  loginAt: integer("loginAt", { mode: "timestamp" }).notNull(),
  logoutAt: integer("logoutAt", { mode: "timestamp" }),
  durationSeconds: integer("durationSeconds"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export type StaffSession = typeof staffSessions.$inferSelect;
export type InsertStaffSession = typeof staffSessions.$inferInsert;

// ============================================
// Relations for Staff Monitoring
// ============================================

export const staffActionLogsRelations = relations(staffActionLogs, ({ one }) => ({
  staffUser: one(users, {
    fields: [staffActionLogs.staffUserId],
    references: [users.id],
  }),
}));

export const staffSessionsRelations = relations(staffSessions, ({ one }) => ({
  staffUser: one(users, {
    fields: [staffSessions.staffUserId],
    references: [users.id],
  }),
}));
