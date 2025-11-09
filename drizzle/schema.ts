import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  phone: varchar("phone", { length: 20 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Admins table - separate from regular users
 * Admins manage the platform but are not counted as students/users
 */
export const admins = mysqlTable("admins", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = typeof admins.$inferInsert;

/**
 * Courses table - stores trading course information
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn").notNull(),
  descriptionAr: text("descriptionAr").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  price: int("price").default(0).notNull(), // Price in cents to avoid decimal issues
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  level: mysqlEnum("level", ["beginner", "intermediate", "advanced"]).default("beginner").notNull(),
  duration: int("duration"), // Total duration in minutes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Episodes table - stores individual course lessons/videos
 */
export const episodes = mysqlTable("episodes", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  titleEn: varchar("titleEn", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }).notNull(),
  descriptionEn: text("descriptionEn"),
  descriptionAr: text("descriptionAr"),
  videoUrl: text("videoUrl"),
  duration: int("duration"), // Duration in seconds
  order: int("order").notNull(), // Episode order within the course
  isFree: boolean("isFree").default(false).notNull(), // Free preview episodes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

/**
 * Enrollments table - tracks user course enrollments and subscriptions
 */
export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  lastAccessed: timestamp("lastAccessed").defaultNow().notNull(),
  progressPercentage: int("progressPercentage").default(0).notNull(),
  completedEpisodes: int("completedEpisodes").default(0).notNull(),
  completedAt: timestamp("completedAt"),
  
  // Payment and subscription info
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  paymentAmount: int("paymentAmount"), // Amount in cents
  paymentCurrency: varchar("paymentCurrency", { length: 3 }).default("USD"),
  
  // Subscription tracking
  isSubscriptionActive: boolean("isSubscriptionActive").default(true).notNull(),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Episode Progress table - tracks which episodes users have watched
 */
export const episodeProgress = mysqlTable("episodeProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  episodeId: int("episodeId").notNull(),
  courseId: int("courseId").notNull(),
  watchedDuration: int("watchedDuration").default(0).notNull(), // Seconds watched
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
