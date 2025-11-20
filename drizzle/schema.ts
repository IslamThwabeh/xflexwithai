import { serial, pgTable, text, timestamp, varchar, boolean, integer, pgEnum, bigint, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  phone: varchar("phone", { length: 20 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // FlexAI: Add Telegram support
  telegram_user_id: bigint("telegram_user_id", { mode: "bigint" }).unique(),
  user_type: varchar("user_type", { length: 20 }).default("web"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Admins table - separate from regular users
 * Admins manage the platform but are not counted as students/users
 */
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = typeof admins.$inferInsert;

/**
 * Enums for courses and enrollments
 */
export const levelEnum = pgEnum("level", ["beginner", "intermediate", "advanced"]);
export const paymentStatusEnum = pgEnum("paymentStatus", ["pending", "completed", "failed", "refunded"]);
export const roleEnum = pgEnum("role", ["user", "assistant", "system"]);
export const apiStatusEnum = pgEnum("apiStatus", ["pending", "success", "failed"]);

/**
 * Courses table - stores trading course information
 */
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn").notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  price: integer("price").default(0).notNull(), // Price in cents to avoid decimal issues
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  level: levelEnum("level").default("beginner").notNull(),
  duration: integer("duration"), // Total duration in minutes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Episodes table - stores individual course lessons/videos
 */
export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  courseId: integer("courseId").notNull(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  videoUrl: text("videoUrl"),
  duration: integer("duration"), // Duration in seconds
  order: integer("order").notNull(), // Episode order within the course
  isFree: boolean("isFree").default(false).notNull(), // Free preview episodes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

/**
 * Enrollments table - tracks user course enrollments and subscriptions
 */
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  lastAccessed: timestamp("lastAccessed").defaultNow().notNull(),
  progressPercentage: integer("progressPercentage").default(0).notNull(),
  completedEpisodes: integer("completedEpisodes").default(0).notNull(),
  completedAt: timestamp("completedAt"),
  
  // Payment and subscription info
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  paymentAmount: integer("paymentAmount"), // Amount in cents
  paymentCurrency: varchar("paymentCurrency", { length: 3 }).default("USD"),
  
  // Subscription tracking
  isSubscriptionActive: boolean("isSubscriptionActive").default(true).notNull(),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  
  // Registration key tracking
  registrationKeyId: integer("registrationKeyId"),
  activatedViaKey: boolean("activatedViaKey").default(false).notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Registration Keys table - stores activation keys for course access control
 * Keys are email-locked on first activation to prevent sharing
 */
export const registrationKeys = pgTable("registrationKeys", {
  id: serial("id").primaryKey(),
  keyCode: varchar("keyCode", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }), // NULL until activated, then locked
  courseId: integer("courseId").notNull(),
  activatedAt: timestamp("activatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: integer("createdBy").notNull(), // admin_id who created the key
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"), // Admin notes about this key
  expiresAt: timestamp("expiresAt"), // NULL = lifetime access
});

export type RegistrationKey = typeof registrationKeys.$inferSelect;
export type InsertRegistrationKey = typeof registrationKeys.$inferInsert;

/**
 * Episode Progress table - tracks which episodes users have watched
 */
export const episodeProgress = pgTable("episodeProgress", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  episodeId: integer("episodeId").notNull(),
  courseId: integer("courseId").notNull(),
  watchedDuration: integer("watchedDuration").default(0).notNull(), // Seconds watched
  isCompleted: boolean("isCompleted").default(false).notNull(),
  lastWatchedAt: timestamp("lastWatchedAt").defaultNow().notNull(),
});

export type EpisodeProgress = typeof episodeProgress.$inferSelect;
export type InsertEpisodeProgress = typeof episodeProgress.$inferInsert;

// Relations
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

/**
 * LexAI Subscriptions table - tracks monthly subscriptions for AI currency analysis
 */
export const lexaiSubscriptions = pgTable("lexaiSubscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate").notNull(),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  
  // Payment info
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  paymentAmount: integer("paymentAmount").notNull(), // Monthly price in cents
  paymentCurrency: varchar("paymentCurrency", { length: 3 }).default("USD").notNull(),
  
  // Usage tracking
  messagesUsed: integer("messagesUsed").default(0).notNull(),
  messagesLimit: integer("messagesLimit").default(100).notNull(), // Monthly message limit
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LexaiSubscription = typeof lexaiSubscriptions.$inferSelect;
export type InsertLexaiSubscription = typeof lexaiSubscriptions.$inferInsert;

/**
 * LexAI Messages table - stores chat conversation history
 */
export const lexaiMessages = pgTable("lexaiMessages", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId").notNull(),
  
  // Message content
  role: roleEnum("role").notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"), // For chart images uploaded by user
  
  // Analysis metadata (for assistant messages)
  analysisType: varchar("analysisType", { length: 50 }), // e.g., "chart_analysis", "signal", "recommendation"
  confidence: integer("confidence"), // Confidence level 0-100
  
  // API tracking
  apiRequestId: varchar("apiRequestId", { length: 255 }), // External API request ID
  apiStatus: apiStatusEnum("apiStatus").default("pending"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LexaiMessage = typeof lexaiMessages.$inferSelect;
export type InsertLexaiMessage = typeof lexaiMessages.$inferInsert;

// LexAI Relations
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

// ============================================================================
// FlexAI Tables (for web + Telegram unified bot)
// ============================================================================

/**
 * FlexAI Subscriptions table - tracks 30-day subscriptions for AI chart analysis
 * Supports both web users and Telegram users
 */
export const flexaiSubscriptions = pgTable("flexaiSubscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  registrationKeyId: integer("registrationKeyId"),
  status: varchar("status", { length: 20 }).default("active"),
  activatedAt: timestamp("activatedAt").defaultNow(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type FlexaiSubscription = typeof flexaiSubscriptions.$inferSelect;
export type InsertFlexaiSubscription = typeof flexaiSubscriptions.$inferInsert;

/**
 * FlexAI Messages table - stores chart analysis conversation history
 * Supports both web and Telegram users
 */
export const flexaiMessages = pgTable("flexaiMessages", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  role: varchar("role", { length: 20 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  analysisResult: jsonb("analysisResult"),
  analysisType: varchar("analysisType", { length: 50 }),
  timeframe: varchar("timeframe", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type FlexaiMessage = typeof flexaiMessages.$inferSelect;
export type InsertFlexaiMessage = typeof flexaiMessages.$inferInsert;

// FlexAI Relations
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

// ============================================
// Quiz System Tables - Add to drizzle/schema.ts
// ============================================

import { pgTable, serial, integer, text, varchar, boolean, timestamp, decimal, bigint, pgEnum, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Quizzes table - one quiz per course level
 */
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

/**
 * Quiz questions table
 */
export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  orderNum: integer("order_num").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueQuizOrder: unique("unique_quiz_order").on(table.quizId, table.orderNum),
}));

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;

/**
 * Quiz options table
 */
export const quizOptions = pgTable("quiz_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  optionId: varchar("option_id", { length: 1 }).notNull(), // 'a', 'b', 'c', 'd'
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueQuestionOption: unique("unique_question_option").on(table.questionId, table.optionId),
}));

export type QuizOption = typeof quizOptions.$inferSelect;
export type InsertQuizOption = typeof quizOptions.$inferInsert;

/**
 * Quiz attempts table - records each quiz attempt
 */
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(),
  passed: boolean("passed").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  timeTakenSeconds: integer("time_taken_seconds"),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

/**
 * Quiz answers table - records individual answers
 */
export const quizAnswers = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedOptionId: varchar("selected_option_id", { length: 1 }).notNull(),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type InsertQuizAnswer = typeof quizAnswers.$inferInsert;

/**
 * User quiz progress table - tracks unlock status and best scores
 */
export const userQuizProgress = pgTable("user_quiz_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  isUnlocked: boolean("is_unlocked").notNull().default(false),
  isCompleted: boolean("is_completed").notNull().default(false),
  bestScore: integer("best_score").default(0),
  bestPercentage: decimal("best_percentage", { precision: 5, scale: 2 }).default("0"),
  attemptsCount: integer("attempts_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserQuiz: unique("unique_user_quiz").on(table.userId, table.quizId),
}));

export type UserQuizProgress = typeof userQuizProgress.$inferSelect;
export type InsertUserQuizProgress = typeof userQuizProgress.$inferInsert;

// ============================================
// Relations
// ============================================

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

