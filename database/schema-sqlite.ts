import { int, sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  phone: text("phone", { length: 20 }),
  emailVerified: integer("emailVerified", { mode: 'boolean' }).default(false).notNull(),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: text("updatedAt").default("CURRENT_TIMESTAMP").notNull(),
  lastSignedIn: text("lastSignedIn").default("CURRENT_TIMESTAMP").notNull(),
  telegram_user_id: text("telegram_user_id").unique(),
  user_type: text("user_type", { length: 20 }).default("web"),
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
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Registration Keys table - stores activation keys for course access control
 */
export const registrationKeys = sqliteTable("registrationKeys", {
  id: int("id").primaryKey({ autoIncrement: true }),
  keyCode: text("keyCode", { length: 255 }).notNull().unique(),
  email: text("email", { length: 320 }),
  courseId: integer("courseId").notNull(),
  activatedAt: text("activatedAt"),
  createdAt: text("createdAt").default("CURRENT_TIMESTAMP").notNull(),
  createdBy: integer("createdBy").notNull(),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  notes: text("notes"),
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
  startDate: text("startDate").default("CURRENT_TIMESTAMP").notNull(),
  endDate: text("endDate").notNull(),
  autoRenew: integer("autoRenew", { mode: 'boolean' }).default(true).notNull(),
  paymentStatus: text("paymentStatus", { length: 20 }).default("pending").notNull(),
  paymentAmount: integer("paymentAmount").notNull(),
  paymentCurrency: text("paymentCurrency", { length: 3 }).default("USD").notNull(),
  messagesUsed: integer("messagesUsed").default(0).notNull(),
  messagesLimit: integer("messagesLimit").default(100).notNull(),
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
