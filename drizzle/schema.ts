import { serial, pgTable, text, timestamp, varchar, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
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
