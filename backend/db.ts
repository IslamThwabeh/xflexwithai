import { eq, desc, and, or, sql, ne, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import {
  InsertUser, users,
  InsertAdmin, admins,
  courses, Course, InsertCourse,
  episodes, Episode, InsertEpisode,
  enrollments, Enrollment, InsertEnrollment,
  episodeProgress, EpisodeProgress, InsertEpisodeProgress,
  lexaiSubscriptions, LexaiSubscription, InsertLexaiSubscription,
  lexaiMessages, LexaiMessage, InsertLexaiMessage,
  registrationKeys, RegistrationKey, InsertRegistrationKey,
  recommendationSubscriptions, RecommendationSubscription, InsertRecommendationSubscription,
  recommendationMessages, RecommendationMessage, InsertRecommendationMessage,
  recommendationReactions, RecommendationReaction, InsertRecommendationReaction,
  authEmailOtps, AuthEmailOtp, InsertAuthEmailOtp,
  quizzes, Quiz,
  quizQuestions, QuizQuestion,
  quizOptions, QuizOption,
  quizAttempts,
  quizAnswers,
  userQuizProgress,
  // FlexAI imports
  flexaiSubscriptions, FlexaiSubscription, InsertFlexaiSubscription,
  flexaiMessages, FlexaiMessage, InsertFlexaiMessage,
  // RBAC & Support Chat imports
  userRoles, UserRole, InsertUserRole,
  supportConversations, SupportConversation, InsertSupportConversation,
  supportMessages, SupportMessage, InsertSupportMessage,
  // Package system imports
  packages, Package, InsertPackage,
  packageCourses, PackageCourse, InsertPackageCourse,
  orders, Order, InsertOrder,
  orderItems, OrderItem, InsertOrderItem,
  packageSubscriptions, PackageSubscription, InsertPackageSubscription,
  // Events & Articles imports
  events, Event, InsertEvent,
  articles, Article, InsertArticle,
  // Coupons & Testimonials
  coupons, Coupon, InsertCoupon,
  testimonials, Testimonial, InsertTestimonial,
  // Jobs / Careers
  jobs, Job, InsertJob,
  jobQuestions, JobQuestion, InsertJobQuestion,
  jobApplications, JobApplication, InsertJobApplication,
  jobApplicationAnswers, JobApplicationAnswer, InsertJobApplicationAnswer,
  // Phase 3+4: Reviews, Notifications, Points, Engagement
  courseReviews, CourseReview, InsertCourseReview,
  userNotifications, UserNotification, InsertUserNotification,
  pointsTransactions, PointsTransaction, InsertPointsTransaction,
  engagementEvents, EngagementEvent, InsertEngagementEvent,
} from "../database/schema-sqlite.ts";
import { ENV } from './_core/env';
import { logger } from './_core/logger';

let _db: ReturnType<typeof drizzle> | null = null;

const DEFAULT_KEY_ENTITLEMENT_DAYS = 30;

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function getKeyEntitlementDays(
  key: Pick<RegistrationKey, "entitlementDays"> | null | undefined,
  fallbackDays: number = DEFAULT_KEY_ENTITLEMENT_DAYS,
) {
  return normalizePositiveInteger(key?.entitlementDays) ?? fallbackDays;
}

function buildEndDateFromDays(startDate: Date, days: number) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}

export function getKeyAccessEndDate(
  key: Pick<RegistrationKey, "activatedAt" | "entitlementDays"> | null | undefined,
  fallbackDays: number = DEFAULT_KEY_ENTITLEMENT_DAYS,
) {
  if (!key?.activatedAt) return null;

  const activatedAt = new Date(key.activatedAt);
  if (Number.isNaN(activatedAt.getTime())) return null;

  return buildEndDateFromDays(activatedAt, getKeyEntitlementDays(key, fallbackDays));
}

function getRemainingDaysUntil(endDateInput: string | Date, fromDate: Date = new Date()) {
  const endDate = new Date(endDateInput);
  if (Number.isNaN(endDate.getTime())) return 0;

  const millisecondsRemaining = endDate.getTime() - fromDate.getTime();
  if (millisecondsRemaining <= 0) return 0;

  return Math.max(1, Math.ceil(millisecondsRemaining / (1000 * 60 * 60 * 24)));
}

/**
 * For Cloudflare Workers with D1, the database is passed via environment
 * For local development, it can use a file-based SQLite
 */
export async function getDb(env?: { DB: D1Database }) {
  if (!_db) {
    try {
      if (env?.DB) {
        // Cloudflare Workers D1 environment
        _db = drizzle(env.DB);
        logger.db('D1 Database connection established (Cloudflare Workers)');
      } else if (process.env.NODE_ENV === 'development') {
        // Local development fallback - would need better-sqlite3 setup
        logger.warn('Database not configured. Running in development mode without database.');
      } else {
        throw new Error("Database not available: D1 environment not provided");
      }
    } catch (error) {
      logger.error('Database connection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      _db = null;
    }
  }
  return _db;
}

// Export db instance that calls getDb() internally
export async function db(env?: { DB: D1Database }) {
  const dbInstance = await getDb(env);
  if (!dbInstance) throw new Error("Database not available");
  return dbInstance;
}

// ============================================================================
// User Management (Regular Users/Students)
// ============================================================================

/**
 * Create a new user
 */
export async function createUser(user: { email: string; passwordHash: string; name?: string; phone?: string; city?: string; country?: string }): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    logger.db('Creating new user', { email: user.email });
    const result = await db.insert(users).values({
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name || null,
      phone: user.phone || null,
      city: user.city || null,
      country: user.country || null,
      createdAt: new Date().toISOString(),
    }).returning({ id: users.id });
    const userId = result[0].id;
    logger.db('User created successfully', { userId, email: user.email });
    return userId;
  } catch (error) {
    logger.error('Failed to create user', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get user: database not available');
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get user: database not available');
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Upsert user (insert or update based on email)
 */
export async function upsertUser(user: { email: string; passwordHash?: string; name?: string; phone?: string }): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    logger.db('Upserting user', { email: user.email });
    
    // Check if user exists
    const existingUser = await getUserByEmail(user.email);
    
    if (existingUser) {
      // Update existing user
      const updateData: any = {
        lastSignedIn: new Date(),
        updatedAt: new Date(),
      };
      
      if (user.name !== undefined) updateData.name = user.name;
      if (user.phone !== undefined) updateData.phone = user.phone;
      if (user.passwordHash !== undefined) updateData.passwordHash = user.passwordHash;
      
      await db.update(users)
        .set(updateData)
        .where(eq(users.email, user.email));
      
      logger.db('User updated successfully', { userId: existingUser.id, email: user.email });
      return existingUser.id;
    } else {
      // Insert new user
      const result = await db.insert(users).values({
        email: user.email,
        passwordHash: user.passwordHash || '',
        name: user.name || null,
        phone: user.phone || null,
      }).returning({ id: users.id });
      
      const userId = result[0].id;
      logger.db('User created successfully', { userId, email: user.email });
      return userId;
    }
  } catch (error) {
    logger.error('Failed to upsert user', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Update user last sign in timestamp
 */
export async function updateUserLastSignIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot update user: database not available');
    return;
  }

  try {
    await db.update(users)
      .set({ lastSignedIn: new Date().toISOString() })
      .where(eq(users.id, userId));
    logger.db('User last sign in updated', { userId });
  } catch (error) {
    logger.error('Failed to update user last sign in', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Mark user's email as verified (used for OTP / magic-link auth).
 */
export async function setUserEmailVerified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));
}

// ============================================================================
// Passwordless Email OTP Login
// ============================================================================

export type OtpPurpose = "login" | "login_stepup" | "password_reset";

export async function deleteExpiredEmailOtps(nowMs: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(authEmailOtps).where(sql`${authEmailOtps.expiresAtMs} < ${nowMs}`);
}

export async function createEmailOtp(input: {
  email: string;
  purpose?: OtpPurpose;
  codeHash: string;
  salt: string;
  sentAtMs: number;
  expiresAtMs: number;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const purpose: OtpPurpose = input.purpose ?? "login";

  const result = await db
    .insert(authEmailOtps)
    .values({
      email: input.email,
      purpose,
      codeHash: input.codeHash,
      salt: input.salt,
      sentAtMs: input.sentAtMs,
      expiresAtMs: input.expiresAtMs,
      attempts: 0,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    } satisfies InsertAuthEmailOtp)
    .returning({ id: authEmailOtps.id });

  return result[0]?.id ?? 0;
}

export async function getLatestEmailOtp(email: string, purpose: OtpPurpose = "login"): Promise<AuthEmailOtp | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(authEmailOtps)
    .where(and(eq(authEmailOtps.email, email), eq(authEmailOtps.purpose, purpose)))
    .orderBy(desc(authEmailOtps.sentAtMs))
    .limit(1);

  return result[0] ?? null;
}

export async function incrementEmailOtpAttempts(id: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const otp = await db
    .select({ attempts: authEmailOtps.attempts })
    .from(authEmailOtps)
    .where(eq(authEmailOtps.id, id))
    .limit(1);

  const nextAttempts = (otp[0]?.attempts ?? 0) + 1;

  await db
    .update(authEmailOtps)
    .set({ attempts: nextAttempts })
    .where(eq(authEmailOtps.id, id));

  return nextAttempts;
}

export async function deleteEmailOtpsForEmail(email: string, purpose: OtpPurpose = "login"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(authEmailOtps).where(and(eq(authEmailOtps.email, email), eq(authEmailOtps.purpose, purpose)));
}

export async function countEmailOtpsSentSince(input: {
  email?: string;
  ipHash?: string;
  sinceMs: number;
  purpose?: OtpPurpose;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const purpose: OtpPurpose = input.purpose ?? "login";
  const whereParts = [sql`${authEmailOtps.sentAtMs} >= ${input.sinceMs}`];

  if (input.email) {
    whereParts.push(sql`${authEmailOtps.email} = ${input.email}`);
    whereParts.push(sql`${authEmailOtps.purpose} = ${purpose}`);
  }

  if (input.ipHash) {
    whereParts.push(sql`${authEmailOtps.ipHash} = ${input.ipHash}`);
  }

  const whereExpr = whereParts.reduce((acc, cur) => (acc ? sql`${acc} AND ${cur}` : cur), null as any);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(authEmailOtps)
    .where(whereExpr);

  return Number(result[0]?.count ?? 0);
}

/**
 * Get all users
 */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

/**
 * Update user (name, phone, etc.)
 */
export async function updateUser(userId: number, updates: { name?: string; phone?: string; loginSecurityMode?: "password_or_otp" | "password_only" | "password_plus_otp"; notificationPrefs?: string }): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot update user: database not available');
    return;
  }

  try {
    await db.update(users)
      .set({
        ...(updates.name !== undefined && { name: updates.name || null }),
        ...(updates.phone !== undefined && { phone: updates.phone || null }),
        ...(updates.loginSecurityMode !== undefined && { loginSecurityMode: updates.loginSecurityMode }),
        ...(updates.notificationPrefs !== undefined && { notificationPrefs: updates.notificationPrefs }),
      })
      .where(eq(users.id, userId));
    logger.db('User updated successfully', { userId });
  } catch (error) {
    logger.error('Failed to update user', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Touch user's lastActiveAt timestamp (called from auth middleware)
 */
export async function touchUserActivity(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users)
      .set({ lastActiveAt: new Date().toISOString() })
      .where(eq(users.id, userId));
  } catch {
    // Non-critical, don't throw
  }
}

/**
 * Check if user was active in the last N minutes (for email suppression)
 */
export async function isUserOnline(userId: number, withinMinutes = 5): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db.select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!result.length || !result[0].lastActiveAt) return false;
    const lastActive = new Date(result[0].lastActiveAt);
    const threshold = new Date(Date.now() - withinMinutes * 60 * 1000);
    return lastActive > threshold;
  } catch {
    return false;
  }
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot update user password: database not available');
    return;
  }

  try {
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
    logger.db('User password updated successfully', { userId });
  } catch (error) {
    logger.error('Failed to update user password', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Get enrollments by user ID
 */
export async function getEnrollmentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select({
      id: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      courseName: courses.titleEn,
      progressPercentage: enrollments.progressPercentage,
      completedEpisodes: enrollments.completedEpisodes,
      totalEpisodes: sql`(SELECT COUNT(*) FROM ${episodes} WHERE ${eq(episodes.courseId, courses.id)})`,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
    })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt));
    
    return result;
  } catch (error) {
    logger.error('Failed to get user enrollments', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    return [];
  }
}

/**
 * Get course progress for a user from their enrollment record.
 * progressPercentage is already maintained by markEpisodeComplete (episodes + quiz gating).
 */
export async function getCourseProgressForUser(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return { progressPercentage: 0, completedEpisodes: 0, totalEpisodes: 0 };
  const [enrollment] = await db
    .select({
      progressPercentage: enrollments.progressPercentage,
      completedEpisodes: enrollments.completedEpisodes,
      totalEpisodes: sql<number>`(SELECT COUNT(*) FROM ${episodes} WHERE ${episodes.courseId} = ${courseId})`,
    })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return enrollment ?? { progressPercentage: 0, completedEpisodes: 0, totalEpisodes: 0 };
}

/**
 * Get user statistics
 */
export async function getUserStatistics(userId: number) {
  const db = await getDb();
  if (!db) return {
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
    quizzesPassed: 0,
  };

  try {
    // Get enrolled courses count
    const enrollmentsList = await db.select()
      .from(enrollments)
      .where(eq(enrollments.userId, userId));
    const enrolledCoursesCount = enrollmentsList.length;

    // Get completed courses count
    const completedCount = enrollmentsList.filter(e => e.completedAt !== null).length;

    // Get quizzes passed (simplified - count unique quiz levels passed)
    const quizzesPassed = enrollmentsList.filter(e => e.progressPercentage >= 100).length;

    return {
      enrolledCoursesCount,
      completedCoursesCount: completedCount,
      quizzesPassed,
    };
  } catch (error) {
    logger.error('Failed to get user statistics', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
    return {
      enrolledCoursesCount: 0,
      completedCoursesCount: 0,
      quizzesPassed: 0,
    };
  }
}

// Legacy function - kept for backward compatibility but should not be used
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get user: database not available');
    return undefined;
  }
  // OpenId no longer exists, return undefined
  return undefined;
}

// ============================================================================
// Admin Management (Platform Administrators)
// ============================================================================

/**
 * Create a new admin
 */
export async function createAdmin(admin: { email: string; passwordHash: string; name?: string }): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    logger.db('Creating new admin', { email: admin.email });
    const result = await db.insert(admins).values({
      email: admin.email,
      passwordHash: admin.passwordHash,
      name: admin.name || null,
    }).returning({ id: admins.id });
    const adminId = result[0].id;
    logger.db('Admin created successfully', { adminId, email: admin.email });
    return adminId;
  } catch (error) {
    logger.error('Failed to create admin', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Get admin by email
 */
export async function getAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get admin: database not available');
    return undefined;
  }

  const result = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get admin by ID
 */
export async function getAdminById(id: number) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get admin: database not available');
    return undefined;
  }

  const result = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update admin last sign in timestamp
 */
export async function updateAdminLastSignIn(adminId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot update admin: database not available');
    return;
  }

  try {
    await db.update(admins)
      .set({ lastSignedIn: new Date().toISOString() })
      .where(eq(admins.id, adminId));
    logger.db('Admin last sign in updated', { adminId });
  } catch (error) {
    logger.error('Failed to update admin last sign in', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

// Legacy function - kept for backward compatibility but should not be used
export async function getAdminByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn('Cannot get admin: database not available');
    return undefined;
  }
  // OpenId no longer exists, return undefined
  return undefined;
}

/**
 * Get all admins
 */
export async function getAllAdmins() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(admins).orderBy(desc(admins.createdAt));
}

// ============================================================================
// Course Management
// ============================================================================

export async function getAllCourses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(courses).orderBy(desc(courses.createdAt));
}

export async function getPublishedCourses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(courses)
    .where(eq(courses.isPublished, true))
    .orderBy(desc(courses.createdAt));
}

export async function getFreeCourses() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(courses)
    .where(and(eq(courses.isPublished, true), eq(courses.price, 0)))
    .orderBy(courses.stageNumber, desc(courses.createdAt));
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCourse(course: InsertCourse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(courses).values(course).returning({ id: courses.id });
  return result[0].id;
}

export async function updateCourse(id: number, course: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courses).set(course).where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related episodes first
  await db.delete(episodes).where(eq(episodes.courseId, id));
  // Delete related enrollments
  await db.delete(enrollments).where(eq(enrollments.courseId, id));
  // Delete the course
  await db.delete(courses).where(eq(courses.id, id));
}

export async function getCourseByTitleEn(titleEn: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.titleEn, titleEn)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteEpisodesByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(episodes).where(eq(episodes.courseId, courseId));
}

export async function seedCourseWithEpisodes(params: {
  matchTitleEn: string;
  course: Omit<InsertCourse, 'duration'> & { duration?: number | null };
  episodes: Array<Omit<InsertEpisode, 'courseId'>>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalDurationSeconds = params.episodes.reduce((sum, ep) => sum + Number(ep.duration ?? 0), 0);
  const durationMinutes = Math.ceil(totalDurationSeconds / 60);

  const existing = await getCourseByTitleEn(params.matchTitleEn);
  let courseId: number;
  if (existing) {
    courseId = existing.id;
    await db.update(courses)
      .set({
        ...params.course,
        duration: durationMinutes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(courses.id, courseId));
  } else {
    const result = await db.insert(courses)
      .values({
        ...params.course,
        duration: durationMinutes,
      })
      .returning({ id: courses.id });
    courseId = result[0].id;
  }

  await deleteEpisodesByCourseId(courseId);

  // Cloudflare D1 can have lower SQLite variable limits than vanilla SQLite.
  // Insert in chunks to avoid "too many SQL variables" failures.
  const chunkSize = 8;
  for (let i = 0; i < params.episodes.length; i += chunkSize) {
    const chunk = params.episodes.slice(i, i + chunkSize);
    await db.insert(episodes).values(
      chunk.map((ep) => ({
        ...ep,
        courseId,
      }))
    );
  }

  return { courseId, episodesInserted: params.episodes.length, durationMinutes };
}

// ============================================================================
// Episode Management
// ============================================================================

function normalizeVideoUrl(url: string | null | undefined) {
  if (!url) return url;

  const targetBase = (ENV.r2BucketUrl || "").replace(/\/$/, "");
  if (!targetBase) return url;

  const legacyBases = [
    "https://videos.xflexwithai.com",
    "http://videos.xflexwithai.com",
  ];

  for (const legacyBase of legacyBases) {
    if (url.startsWith(legacyBase)) {
      return `${targetBase}${url.slice(legacyBase.length)}`;
    }
  }

  return url;
}

export async function getEpisodesByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(episodes)
    .where(eq(episodes.courseId, courseId))
    .orderBy(episodes.order);

  return rows.map((row) => ({
    ...row,
    videoUrl: normalizeVideoUrl(row.videoUrl),
  }));
}

export async function getEpisodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1);
  if (result.length === 0) return undefined;

  const row = result[0];
  return {
    ...row,
    videoUrl: normalizeVideoUrl(row.videoUrl),
  };
}

export async function createEpisode(episode: InsertEpisode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(episodes).values(episode).returning({ id: episodes.id });
  return result[0].id;
}

export async function updateEpisode(id: number, episode: Partial<InsertEpisode>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(episodes).set(episode).where(eq(episodes.id, id));
}

export async function deleteEpisode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related progress records
  await db.delete(episodeProgress).where(eq(episodeProgress.episodeId, id));
  // Delete the episode
  await db.delete(episodes).where(eq(episodes.id, id));
}

// ============================================================================
// Enrollment Management
// ============================================================================

export async function getUserEnrollments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt));
}

export async function getCourseEnrollments(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .orderBy(desc(enrollments.enrolledAt));
}

export async function getEnrollment(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollments)
    .where(and(
      eq(enrollments.userId, userId),
      eq(enrollments.courseId, courseId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEnrollment(enrollment: InsertEnrollment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(enrollments).values({
    ...enrollment,
    enrolledAt: enrollment.enrolledAt ?? new Date().toISOString(),
  }).returning({ id: enrollments.id });
  return result[0].id;
}

export async function updateEnrollment(id: number, enrollment: Partial<InsertEnrollment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(enrollments).set(enrollment).where(eq(enrollments.id, id));
}

export async function deleteEnrollment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(enrollments).where(eq(enrollments.id, id));
}

// ============================================================================
// Dashboard Statistics
// ============================================================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      totalCourses: 0,
      totalEnrollments: 0,
      activeEnrollments: 0,
      totalKeySales: 0,
      totalRevenue: 0,
      pendingOrders: 0,
    };
  }

  const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [totalCoursesResult] = await db.select({ count: sql<number>`count(*)` }).from(courses);
  const [totalEnrollmentsResult] = await db.select({ count: sql<number>`count(*)` }).from(enrollments);
  const [activeEnrollmentsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.isSubscriptionActive, true));

  // Pending orders (for attention banner)
  const [pendingOrdersResult] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'pending'));

  // Revenue = activated key sales only (the sole revenue source today)
  const [keySalesResult] = await db.select({
    count: sql<number>`count(*)`,
    total: sql<number>`COALESCE(SUM(${registrationKeys.price}), 0)`,
  }).from(registrationKeys)
    .where(and(sql`${registrationKeys.activatedAt} IS NOT NULL`, sql`${registrationKeys.price} > 0`));

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    totalCourses: Number(totalCoursesResult?.count ?? 0),
    totalEnrollments: Number(totalEnrollmentsResult?.count ?? 0),
    activeEnrollments: Number(activeEnrollmentsResult?.count ?? 0),
    totalKeySales: Number(keySalesResult?.count ?? 0),
    totalRevenue: Number(keySalesResult?.total ?? 0),  // dollars (not cents)
    pendingOrders: Number(pendingOrdersResult?.count ?? 0),
  };
}

// ============================================================================
// Registration Key Management
// ============================================================================

const REGISTRATION_KEY_PREFIX = "XFLEX";
const REGISTRATION_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRegistrationKeyCode(groupLength: number = 5, groups: number = 3): string {
  const totalLength = groupLength * groups;
  const bytes = new Uint8Array(totalLength);
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < totalLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let raw = "";
  for (let i = 0; i < totalLength; i += 1) {
    raw += REGISTRATION_KEY_ALPHABET[bytes[i] % REGISTRATION_KEY_ALPHABET.length];
  }

  const parts = [] as string[];
  for (let i = 0; i < raw.length; i += groupLength) {
    parts.push(raw.slice(i, i + groupLength));
  }

  return `${REGISTRATION_KEY_PREFIX}-${parts.join("-")}`;
}

export async function getRegistrationKeyByCode(keyCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateRegistrationKey(id: number, key: Partial<InsertRegistrationKey>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(registrationKeys).set(key).where(eq(registrationKeys.id, id));
}

export async function deactivateRegistrationKey(id: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch key details BEFORE deactivating so we can cascade
  const [keyRow] = await db.select().from(registrationKeys).where(eq(registrationKeys.id, id)).limit(1);
  if (!keyRow) throw new Error("Registration key not found");

  const setObj: Record<string, any> = { isActive: false };
  // Append reason to notes if provided
  if (reason) {
    const prev = keyRow.notes || '';
    setObj.notes = prev ? `${prev}\n[Deactivated: ${reason}]` : `[Deactivated: ${reason}]`;
  }

  await db
    .update(registrationKeys)
    .set(setObj)
    .where(eq(registrationKeys.id, id));

  // ── CASCADE: revoke MONTHLY entitlements granted by this package key ──
  // NOTE: Course enrollments are permanent (one-time) — they are NOT revoked here.
  // Only monthly subscriptions (LexAI, Recommendations) are deactivated.
  if (keyRow.email && keyRow.packageId) {
    const user = await getUserByEmail(keyRow.email);
    if (user) {
      // Deactivate the package subscription record
      const pkgSubs = await getUserPackageSubscriptions(user.id);
      for (const sub of pkgSubs) {
        if (sub.packageId === keyRow.packageId) {
          await db.update(packageSubscriptions).set({ isActive: false }).where(eq(packageSubscriptions.id, sub.id));
        }
      }

      // Deactivate LexAI / Recommendations (monthly services) if the package included them
      const pkg = await getPackageById(keyRow.packageId);
      if (pkg?.includesLexai) {
        const lexaiSub = await getActiveLexaiSubscription(user.id);
        if (lexaiSub) await updateLexaiSubscription(lexaiSub.id, { isActive: false });
      }
      if (pkg?.includesRecommendations) {
        const recSub = await getActiveRecommendationSubscription(user.id);
        if (recSub) await updateRecommendationSubscription(recSub.id, { isActive: false });
      }
    }
  }

  const [updated] = await db.select().from(registrationKeys).where(eq(registrationKeys.id, id)).limit(1);
  return updated;
}

export async function reactivateRegistrationKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(registrationKeys)
    .set({ isActive: true })
    .where(eq(registrationKeys.id, id));

  const [updated] = await db.select().from(registrationKeys).where(eq(registrationKeys.id, id)).limit(1);
  return updated;
}

// ============================================================================
// Recommendation Subscription Management
// ============================================================================

export async function getActiveRecommendationSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const nowIso = new Date().toISOString();
  const rows = await db
    .select()
    .from(recommendationSubscriptions)
    .where(
      and(
        eq(recommendationSubscriptions.userId, userId),
        eq(recommendationSubscriptions.isActive, true),
        eq(recommendationSubscriptions.isPaused, false),
        sql`${recommendationSubscriptions.endDate} >= ${nowIso}`
      )
    )
    .orderBy(desc(recommendationSubscriptions.endDate))
    .limit(1);

  return rows[0];
}

export async function createRecommendationSubscription(subscription: InsertRecommendationSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recommendationSubscriptions).values(subscription).returning({ id: recommendationSubscriptions.id });
  return result[0].id;
}

export async function updateRecommendationSubscription(id: number, updates: Partial<InsertRecommendationSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recommendationSubscriptions).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(recommendationSubscriptions.id, id));
}

export async function pauseRecommendationSubscription(id: number, reason?: string, frozenUntilDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db.select().from(recommendationSubscriptions).where(eq(recommendationSubscriptions.id, id)).limit(1);
  if (!subscription) throw new Error("Recommendation subscription not found");

  const now = new Date();
  const remainingDays = getRemainingDaysUntil(subscription.endDate, now);

  await db.update(recommendationSubscriptions).set({
    isPaused: true,
    pausedAt: now.toISOString(),
    pausedReason: reason ?? null,
    pausedRemainingDays: remainingDays,
    frozenUntil: frozenUntilDate ? frozenUntilDate.toISOString() : null,
    updatedAt: now.toISOString(),
  }).where(eq(recommendationSubscriptions.id, id));
}

export async function resumeRecommendationSubscription(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db.select().from(recommendationSubscriptions).where(eq(recommendationSubscriptions.id, id)).limit(1);
  if (!subscription) throw new Error("Recommendation subscription not found");

  const now = new Date();
  const remainingDays = normalizePositiveInteger(subscription.pausedRemainingDays) ?? 1;
  const endDate = buildEndDateFromDays(now, remainingDays);

  await db.update(recommendationSubscriptions).set({
    isActive: true,
    isPaused: false,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    pausedAt: null,
    pausedReason: null,
    pausedRemainingDays: null,
    frozenUntil: null,
    updatedAt: now.toISOString(),
  }).where(eq(recommendationSubscriptions.id, id));
}

export async function freezeUserSubscriptions(userId: number, reason?: string, frozenUntilDays?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const frozenUntilDate = frozenUntilDays
    ? new Date(Date.now() + frozenUntilDays * 86_400_000)
    : undefined;
  const [lexaiSub] = await db.select({ id: lexaiSubscriptions.id })
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isActive, true), eq(lexaiSubscriptions.isPaused, false)))
    .limit(1);
  if (lexaiSub) await pauseLexaiSubscription(lexaiSub.id, reason, frozenUntilDate);
  const [recSub] = await db.select({ id: recommendationSubscriptions.id })
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isActive, true), eq(recommendationSubscriptions.isPaused, false)))
    .limit(1);
  if (recSub) await pauseRecommendationSubscription(recSub.id, reason, frozenUntilDate);
  return { lexaiPaused: !!lexaiSub, recPaused: !!recSub };
}

export async function unfreezeUserSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [lexaiSub] = await db.select({ id: lexaiSubscriptions.id })
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isPaused, true)))
    .limit(1);
  if (lexaiSub) await resumeLexaiSubscription(lexaiSub.id);
  const [recSub] = await db.select({ id: recommendationSubscriptions.id })
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isPaused, true)))
    .limit(1);
  if (recSub) await resumeRecommendationSubscription(recSub.id);
  return { lexaiResumed: !!lexaiSub, recResumed: !!recSub };
}

/**
 * Called by the nightly cron job.
 * Finds all subscriptions where frozenUntil has passed, resumes them,
 * returns a list of { email, name } so the caller can send notifications.
 */
export async function processExpiredFreezes(): Promise<{ email: string; name: string | null }[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date().toISOString();
  const notified: { email: string; name: string | null }[] = [];

  // Expired LexAI freezes
  const expiredLexai = await db
    .select({ id: lexaiSubscriptions.id, userId: lexaiSubscriptions.userId })
    .from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.isPaused, true),
      sql`${lexaiSubscriptions.frozenUntil} IS NOT NULL`,
      sql`${lexaiSubscriptions.frozenUntil} <= ${now}`,
    ));
  for (const sub of expiredLexai) {
    await resumeLexaiSubscription(sub.id);
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, sub.userId)).limit(1);
    if (user?.email) notified.push({ email: user.email, name: user.name });
  }

  // Expired recommendation freezes
  const expiredRec = await db
    .select({ id: recommendationSubscriptions.id, userId: recommendationSubscriptions.userId })
    .from(recommendationSubscriptions)
    .where(and(
      eq(recommendationSubscriptions.isPaused, true),
      sql`${recommendationSubscriptions.frozenUntil} IS NOT NULL`,
      sql`${recommendationSubscriptions.frozenUntil} <= ${now}`,
    ));
  for (const sub of expiredRec) {
    await resumeRecommendationSubscription(sub.id);
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, sub.userId)).limit(1);
    // Only add once per user (they may have both types)
    if (user?.email && !notified.find(n => n.email === user.email)) {
      notified.push({ email: user.email, name: user.name });
    }
  }

  return notified;
}

/**
 * Get subscriptions expiring within a given number of days.
 * Used by the daily cron to send reminder emails.
 */
export async function getExpiringSubscriptions(withinDays: number): Promise<{ email: string; name: string | null; daysLeft: number; packageName: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const futureStr = futureDate.toISOString().slice(0, 10);

  // Find package subscriptions with endDate between today and futureDate
  const expiring = await db
    .select({
      userId: packageSubscriptions.userId,
      endDate: packageSubscriptions.endDate,
      packageId: packageSubscriptions.packageId,
    })
    .from(packageSubscriptions)
    .where(and(
      eq(packageSubscriptions.isActive, true),
      sql`date(${packageSubscriptions.endDate}) >= ${todayStr}`,
      sql`date(${packageSubscriptions.endDate}) <= ${futureStr}`,
    ));

  const results: { email: string; name: string | null; daysLeft: number; packageName: string }[] = [];
  for (const sub of expiring) {
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, sub.userId)).limit(1);
    if (!user?.email) continue;
    const pkg = await getPackageById(sub.packageId);
    const endMs = new Date(sub.endDate!).getTime();
    const daysLeft = Math.ceil((endMs - now.getTime()) / (1000 * 60 * 60 * 24));
    results.push({
      email: user.email,
      name: user.name,
      daysLeft: Math.max(0, daysLeft),
      packageName: pkg?.nameEn ?? `Package #${sub.packageId}`,
    });
  }
  return results;
}

export async function setRecommendationPublisher(userId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ canPublishRecommendations: enabled }).where(eq(users.id, userId));
}

export async function getRecommendationPublishers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.canPublishRecommendations, true))
    .orderBy(users.name, users.email);
}

export async function getUserRecommendationsAccess(userId: number) {
  const db = await getDb();
  if (!db) return { canPublish: false, hasSubscription: false, subscription: null as RecommendationSubscription | null };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const subscription = await getActiveRecommendationSubscription(userId);

  return {
    canPublish: Boolean(user?.canPublishRecommendations),
    hasSubscription: !!subscription,
    subscription: subscription ?? null,
  };
}

export async function getRecommendationSubscriberEmails() {
  const db = await getDb();
  if (!db) return [];

  const nowIso = new Date().toISOString();
  const activeSubscriptions = await db
    .select({ userId: recommendationSubscriptions.userId })
    .from(recommendationSubscriptions)
    .where(
      and(
        eq(recommendationSubscriptions.isActive, true),
        eq(recommendationSubscriptions.isPaused, false),
        sql`${recommendationSubscriptions.endDate} >= ${nowIso}`
      )
    );

  const userIds = activeSubscriptions.map((item) => item.userId);
  if (!userIds.length) return [];

  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  return Array.from(new Set(rows.map((row) => row.email).filter(Boolean)));
}

/**
 * Get recommendation subscriber details including online status and notification prefs.
 * Used for email suppression: skip email if user is online or opted out.
 */
export async function getRecommendationSubscriberDetails(): Promise<Array<{ userId: number; email: string; lastActiveAt: string | null; notificationPrefs: string | null }>> {
  const db = await getDb();
  if (!db) return [];

  const nowIso = new Date().toISOString();
  const activeSubscriptions = await db
    .select({ userId: recommendationSubscriptions.userId })
    .from(recommendationSubscriptions)
    .where(
      and(
        eq(recommendationSubscriptions.isActive, true),
        eq(recommendationSubscriptions.isPaused, false),
        sql`${recommendationSubscriptions.endDate} >= ${nowIso}`
      )
    );

  const userIds = activeSubscriptions.map((item) => item.userId);
  if (!userIds.length) return [];

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      lastActiveAt: users.lastActiveAt,
      notificationPrefs: users.notificationPrefs,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  return rows
    .filter(r => r.email)
    .map(r => ({ userId: r.id, email: r.email, lastActiveAt: r.lastActiveAt, notificationPrefs: r.notificationPrefs }));
}

export async function createRecommendationMessage(message: InsertRecommendationMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recommendationMessages).values(message).returning({ id: recommendationMessages.id });
  return result[0].id;
}

export async function getRecommendationMessagesFeed(userId: number, limit: number = 200) {
  const db = await getDb();
  if (!db) return [];

  const messages = await db
    .select()
    .from(recommendationMessages)
    .orderBy(desc(recommendationMessages.createdAt))
    .limit(limit);

  const messageIds = messages.map((message) => message.id);
  const authorIds = Array.from(new Set(messages.map((message) => message.userId)));

  const authors = authorIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email, canPublishRecommendations: users.canPublishRecommendations })
        .from(users)
        .where(inArray(users.id, authorIds))
    : [];

  const reactions = messageIds.length
    ? await db
        .select()
        .from(recommendationReactions)
        .where(inArray(recommendationReactions.messageId, messageIds))
    : [];

  return messages.map((message) => {
    const author = authors.find((item) => item.id === message.userId);
    const messageReactions = reactions.filter((reaction) => reaction.messageId === message.id);
    const reactionCounts = {
      like: messageReactions.filter((reaction) => reaction.reaction === "like").length,
      love: messageReactions.filter((reaction) => reaction.reaction === "love").length,
      sad: messageReactions.filter((reaction) => reaction.reaction === "sad").length,
      fire: messageReactions.filter((reaction) => reaction.reaction === "fire").length,
      rocket: messageReactions.filter((reaction) => reaction.reaction === "rocket").length,
    };

    const myReaction = messageReactions.find((reaction) => reaction.userId === userId)?.reaction ?? null;

    return {
      ...message,
      authorName: author?.name || author?.email || "Unknown",
      authorEmail: author?.email || null,
      isAnalyst: !!author?.canPublishRecommendations,
      reactions: reactionCounts,
      myReaction,
    };
  });
}

export async function setRecommendationReaction(messageId: number, userId: number, reaction: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(recommendationReactions)
    .where(and(eq(recommendationReactions.messageId, messageId), eq(recommendationReactions.userId, userId)))
    .limit(1);

  if (!reaction) {
    if (existing.length) {
      await db.delete(recommendationReactions).where(eq(recommendationReactions.id, existing[0].id));
    }
    return;
  }

  if (existing.length) {
    await db.update(recommendationReactions)
      .set({ reaction, createdAt: new Date().toISOString() })
      .where(eq(recommendationReactions.id, existing[0].id));
    return;
  }

  await db.insert(recommendationReactions).values({
    messageId,
    userId,
    reaction,
    createdAt: new Date().toISOString(),
  });
}

export async function syncUserEntitlementsFromKeys(userId: number, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const packageKeys = await getActivatedPackageKeysByEmail(normalizedEmail);
  for (const key of packageKeys) {
    if (!key.packageId) continue;
    await fulfillPackageEntitlements(userId, key.packageId, key.id, key.entitlementDays ?? undefined);
  }
}

/** Get all activated package keys for a given email (used by sync) */
async function getActivatedPackageKeysByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        sql`${registrationKeys.packageId} IS NOT NULL`,
        sql`lower(${registrationKeys.email}) = ${email}`,
        sql`${registrationKeys.activatedAt} is not null`,
        eq(registrationKeys.isActive, true)
      )
    );
}

export async function deleteRegistrationKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(registrationKeys).where(eq(registrationKeys.id, id));
}

// ============================================================================
// Package Key Management (consolidated key system)
// ============================================================================

export async function getAllPackageKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(sql`${registrationKeys.packageId} IS NOT NULL`)
    .orderBy(desc(registrationKeys.createdAt));
}

// Enriched package keys list with userId + subscription pause status via correlated subqueries
export async function getAllPackageKeysEnriched() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: registrationKeys.id,
    keyCode: registrationKeys.keyCode,
    courseId: registrationKeys.courseId,
    packageId: registrationKeys.packageId,
    createdBy: registrationKeys.createdBy,
    email: registrationKeys.email,
    isActive: registrationKeys.isActive,
    activatedAt: registrationKeys.activatedAt,
    notes: registrationKeys.notes,
    price: registrationKeys.price,
    currency: registrationKeys.currency,
    entitlementDays: registrationKeys.entitlementDays,
    createdAt: registrationKeys.createdAt,
    expiresAt: registrationKeys.expiresAt,
    isUpgrade: registrationKeys.isUpgrade,
    referredBy: registrationKeys.referredBy,
    userId: sql<number | null>`(SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1)`,
    lexaiSubId: sql<number | null>`(SELECT ls.id FROM lexaiSubscriptions ls WHERE ls.userId = (SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1) AND ls.isActive = 1 ORDER BY ls.createdAt DESC LIMIT 1)`,
    lexaiIsPaused: sql<0 | 1 | null>`(SELECT ls.isPaused FROM lexaiSubscriptions ls WHERE ls.userId = (SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1) AND ls.isActive = 1 ORDER BY ls.createdAt DESC LIMIT 1)`,
    recSubId: sql<number | null>`(SELECT rs.id FROM recommendationSubscriptions rs WHERE rs.userId = (SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1) AND rs.isActive = 1 ORDER BY rs.createdAt DESC LIMIT 1)`,
    recIsPaused: sql<0 | 1 | null>`(SELECT rs.isPaused FROM recommendationSubscriptions rs WHERE rs.userId = (SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1) AND rs.isActive = 1 ORDER BY rs.createdAt DESC LIMIT 1)`,
    subEndDate: sql<string | null>`(SELECT ps.endDate FROM packageSubscriptions ps WHERE ps.userId = (SELECT id FROM users WHERE LOWER(email) = LOWER(${registrationKeys.email}) LIMIT 1) AND ps.packageId = ${registrationKeys.packageId} ORDER BY ps.createdAt DESC LIMIT 1)`,
  })
  .from(registrationKeys)
  .where(sql`${registrationKeys.packageId} IS NOT NULL`)
  .orderBy(desc(registrationKeys.createdAt));
}

export async function getComprehensivePackageHolders() {
  const db = await getDb();
  if (!db) return [];

  // Step 1: Get key holders + user info via explicit JOINs (avoids Drizzle correlated subquery issues)
  const holderRows = await db.select({
    keyId: registrationKeys.id,
    userEmail: registrationKeys.email,
    packageId: registrationKeys.packageId,
    activatedAt: registrationKeys.activatedAt,
    userName: users.name,
    userId: users.id,
  })
  .from(registrationKeys)
  .leftJoin(users, sql`LOWER(${users.email}) = LOWER(${registrationKeys.email})`)
  .innerJoin(packages, eq(packages.id, registrationKeys.packageId))
  .where(and(
    eq(registrationKeys.isActive, true),
    sql`${registrationKeys.activatedAt} IS NOT NULL`,
    eq(packages.includesLexai, true)
  ))
  .orderBy(desc(registrationKeys.activatedAt));

  // Step 2: For each holder, look up their subscriptions by userId
  return await Promise.all(holderRows.map(async (holder) => {
    if (!holder.userId) {
      return {
        ...holder,
        lexaiSubId: null, lexaiIsPaused: null as 0 | 1 | null, lexaiEndDate: null, lexaiPausedRemainingDays: null,
        recSubId: null, recIsPaused: null as 0 | 1 | null, recEndDate: null, recPausedRemainingDays: null,
      };
    }
    const [lexaiSub] = await db.select({
      id: lexaiSubscriptions.id,
      isPaused: lexaiSubscriptions.isPaused,
      endDate: lexaiSubscriptions.endDate,
      pausedRemainingDays: lexaiSubscriptions.pausedRemainingDays,
    })
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, holder.userId), eq(lexaiSubscriptions.isActive, true)))
    .orderBy(desc(lexaiSubscriptions.id))
    .limit(1);

    const [recSub] = await db.select({
      id: recommendationSubscriptions.id,
      isPaused: recommendationSubscriptions.isPaused,
      endDate: recommendationSubscriptions.endDate,
      pausedRemainingDays: recommendationSubscriptions.pausedRemainingDays,
    })
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, holder.userId), eq(recommendationSubscriptions.isActive, true)))
    .orderBy(desc(recommendationSubscriptions.id))
    .limit(1);

    return {
      ...holder,
      lexaiSubId: lexaiSub?.id ?? null,
      lexaiIsPaused: (lexaiSub?.isPaused ?? null) as 0 | 1 | null,
      lexaiEndDate: lexaiSub?.endDate ?? null,
      lexaiPausedRemainingDays: lexaiSub?.pausedRemainingDays ?? null,
      recSubId: recSub?.id ?? null,
      recIsPaused: (recSub?.isPaused ?? null) as 0 | 1 | null,
      recEndDate: recSub?.endDate ?? null,
      recPausedRemainingDays: recSub?.pausedRemainingDays ?? null,
    };
  }));
}

export async function getPackageKeyStatistics() {
  const db = await getDb();
  if (!db) return { total: 0, activated: 0, unused: 0, deactivated: 0, activationRate: 0 };

  const filter = sql`${registrationKeys.packageId} IS NOT NULL`;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(filter);
  const [activatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(filter, sql`${registrationKeys.activatedAt} is not null`, eq(registrationKeys.isActive, true)));
  const [unusedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(filter, eq(registrationKeys.isActive, true), sql`${registrationKeys.activatedAt} is null`));
  const [deactivatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(filter, eq(registrationKeys.isActive, false)));

  const total = Number(totalResult?.count ?? 0);
  const activated = Number(activatedResult?.count ?? 0);
  return {
    total,
    activated,
    unused: Number(unusedResult?.count ?? 0),
    deactivated: Number(deactivatedResult?.count ?? 0),
    activationRate: total > 0 ? Math.round((activated / total) * 100) : 0,
  };
}

export async function createPackageKey(input: {
  packageId: number;
  createdBy: number;
  email?: string | null;
  notes?: string;
  price?: number;
  currency?: string;
  entitlementDays?: number | null;
  expiresAt?: string | Date | null;
  isUpgrade?: boolean;
  isRenewal?: boolean;
  referredBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const keyCode = generateRegistrationKeyCode();
  const values: InsertRegistrationKey = {
    keyCode,
    courseId: 0, // not used for package keys
    packageId: input.packageId,
    createdBy: input.createdBy,
    email: input.email ?? null,
    isActive: true,
    activatedAt: null,
    notes: input.notes ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "USD",
    entitlementDays: normalizePositiveInteger(input.entitlementDays),
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    isUpgrade: input.isUpgrade ?? false,
    isRenewal: input.isRenewal ?? false,
    referredBy: input.referredBy ?? null,
  };
  const result = await db.insert(registrationKeys).values(values).returning({ id: registrationKeys.id });
  return { id: result[0].id, keyCode };
}

export async function createBulkPackageKeys(input: {
  packageId: number;
  createdBy: number;
  quantity: number;
  notes?: string;
  price?: number;
  currency?: string;
  entitlementDays?: number | null;
  expiresAt?: string | Date | null;
  isUpgrade?: boolean;
  isRenewal?: boolean;
  referredBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: InsertRegistrationKey[] = Array.from({ length: input.quantity }, () => ({
    keyCode: generateRegistrationKeyCode(),
    courseId: 0,
    packageId: input.packageId,
    createdBy: input.createdBy,
    isActive: true,
    activatedAt: null,
    createdAt: new Date().toISOString(),
    notes: input.notes ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "USD",
    entitlementDays: normalizePositiveInteger(input.entitlementDays),
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    isUpgrade: input.isUpgrade ?? false,
    isRenewal: input.isRenewal ?? false,
    referredBy: input.referredBy ?? null,
  }));

  await db.insert(registrationKeys).values(values);
  return values;
}

/**
 * Activate a package key: validate, mark as activated, and grant all package entitlements.
 * This grants: course enrollments + LexAI subscription + Recommendation subscription
 * based on the package's includesLexai / includesRecommendations flags.
 */
export async function activatePackageKey(keyCode: string, email: string, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Validate key
  const [key] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);

  if (!key) return { success: false, message: "Invalid activation key" };
  if (!key.packageId) return { success: false, message: "This is not a package key" };
  if (!key.isActive) return { success: false, message: "This key has been deactivated" };

  if (key.activatedAt) {
    const keyEmail = (key.email ?? "").trim().toLowerCase();
    if (keyEmail === normalizedEmail) {
      return { success: true, message: "Key already activated for this email", key, alreadyActivated: true };
    }
    return { success: false, message: "This key has already been activated" };
  }

  if (key.email && key.email.trim().toLowerCase() !== normalizedEmail) {
    return { success: false, message: "This key is assigned to another email" };
  }

  if (key.expiresAt) {
    const expiresAt = new Date(key.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return { success: false, message: "This key has expired" };
    }
  }

  // 1b. For renewal keys: verify the user's current active subscription matches this package
  if (key.isRenewal) {
    const lookupUserId = userId ?? (await getUserByEmail(normalizedEmail))?.id;
    if (lookupUserId) {
      const existingSubs = await getUserPackageSubscriptions(lookupUserId);
      const hasMatchingSub = existingSubs.some(s => s.isActive && s.packageId === key.packageId);
      if (!hasMatchingSub) {
        return {
          success: false,
          message: "This renewal key is for a different subscription package. Please contact the support team to provide the correct renewal key for your subscription.",
          messageAr: "مفتاح التجديد هذا مخصص لباقة مختلفة. يرجى التواصل مع فريق الدعم للحصول على مفتاح التجديد الصحيح لاشتراكك.",
        };
      }
    }
  }

  // 2. Mark key as activated
  await db
    .update(registrationKeys)
    .set({ email: normalizedEmail, activatedAt: new Date().toISOString(), isActive: true })
    .where(eq(registrationKeys.id, key.id));

  // 3. Fetch the package to know what entitlements to grant
  const pkg = await getPackageById(key.packageId);
  if (!pkg) return { success: false, message: "Package not found" };

  // 4. Resolve the user ID
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const user = await getUserByEmail(normalizedEmail);
    resolvedUserId = user?.id;
  }

  if (resolvedUserId) {
    if (key.isRenewal) {
      await renewPackageEntitlements(resolvedUserId, key.packageId, key.id, key.entitlementDays ?? undefined);
    } else {
      await fulfillPackageEntitlements(resolvedUserId, key.packageId, key.id, key.entitlementDays ?? undefined);
    }
  }

  const [updated] = await db.select().from(registrationKeys).where(eq(registrationKeys.id, key.id)).limit(1);
  return {
    success: true,
    message: `Package "${pkg.nameEn || pkg.nameAr}" activated successfully`,
    key: updated ?? key,
    packageName: pkg.nameEn || pkg.nameAr,
    packageNameAr: pkg.nameAr || pkg.nameEn,
    isUpgrade: key.isUpgrade ?? false,
    isRenewal: key.isRenewal ?? false,
  };
}

/**
 * Renew package entitlements: extends existing subscription end dates rather than restarting.
 * If no existing subscription is found, falls back to fulfillPackageEntitlements.
 */
export async function renewPackageEntitlements(
  userId: number,
  packageId: number,
  registrationKeyId?: number,
  entitlementDaysOverride?: number,
) {
  const pkg = await getPackageById(packageId);
  if (!pkg) return;

  const entitlementDays = normalizePositiveInteger(entitlementDaysOverride)
    ?? normalizePositiveInteger(pkg.renewalPeriodDays)
    ?? normalizePositiveInteger(pkg.durationDays)
    ?? DEFAULT_KEY_ENTITLEMENT_DAYS;
  const now = new Date();

  // --- Package subscription ---
  const existingPackageSubs = await getUserPackageSubscriptions(userId);
  const currentPkgSub = existingPackageSubs.find(s => s.packageId === packageId && s.isActive);
  if (!currentPkgSub) {
    // No existing sub — fall back to fresh activation
    await fulfillPackageEntitlements(userId, packageId, registrationKeyId, entitlementDays);
    return;
  }
  const pkgBase = currentPkgSub.endDate && new Date(currentPkgSub.endDate) > now
    ? new Date(currentPkgSub.endDate)
    : now;
  const pkgNewEnd = buildEndDateFromDays(pkgBase, entitlementDays);
  const dbInst = await getDb();
  if (!dbInst) return;
  await dbInst.update(packageSubscriptions).set({
    isActive: true,
    endDate: pkgNewEnd.toISOString(),
    renewalDueDate: pkgNewEnd.toISOString(),
    updatedAt: now.toISOString(),
  }).where(eq(packageSubscriptions.id, currentPkgSub.id));

  // --- LexAI subscription ---
  if (pkg.includesLexai) {
    const current = await getActiveLexaiSubscription(userId);
    if (current) {
      const base = current.endDate && new Date(current.endDate) > now ? new Date(current.endDate) : now;
      const newEnd = buildEndDateFromDays(base, entitlementDays);
      await updateLexaiSubscription(current.id, {
        isActive: true,
        isPaused: false,
        isPendingActivation: false,
        endDate: newEnd.toISOString(),
        paymentStatus: "completed",
      });
    } else {
      const maxActivationDate = buildEndDateFromDays(now, 14);
      const newEnd = buildEndDateFromDays(now, entitlementDays);
      await createLexaiSubscription({
        userId,
        isActive: true,
        isPaused: false,
        isPendingActivation: true,
        studentActivatedAt: null,
        maxActivationDate: maxActivationDate.toISOString(),
        startDate: now.toISOString(),
        endDate: newEnd.toISOString(),
        paymentStatus: "completed",
        paymentAmount: 0,
        paymentCurrency: "USD",
        messagesUsed: 0,
        messagesLimit: 100,
        pausedAt: null,
        pausedReason: null,
        pausedRemainingDays: null,
      });
    }
  }

  // --- Recommendation subscription ---
  if (pkg.includesRecommendations) {
    const current = await getActiveRecommendationSubscription(userId);
    if (current) {
      const base = current.endDate && new Date(current.endDate) > now ? new Date(current.endDate) : now;
      const newEnd = buildEndDateFromDays(base, entitlementDays);
      await updateRecommendationSubscription(current.id, {
        isActive: true,
        isPaused: false,
        isPendingActivation: false,
        endDate: newEnd.toISOString(),
        paymentStatus: "completed",
      });
    } else {
      const maxActivationDate = buildEndDateFromDays(now, 14);
      const newEnd = buildEndDateFromDays(now, entitlementDays);
      await createRecommendationSubscription({
        userId,
        registrationKeyId: registrationKeyId ?? null,
        isActive: true,
        isPaused: false,
        isPendingActivation: true,
        studentActivatedAt: null,
        maxActivationDate: maxActivationDate.toISOString(),
        startDate: now.toISOString(),
        endDate: newEnd.toISOString(),
        paymentStatus: "completed",
        paymentAmount: 0,
        paymentCurrency: "USD",
        pausedAt: null,
        pausedReason: null,
        pausedRemainingDays: null,
      });
    }
  }
}

/**
 * Grant all entitlements for a package: enrollments, LexAI, recommendations.
 * Used by both key activation and order completion.
 */
export async function fulfillPackageEntitlements(
  userId: number,
  packageId: number,
  registrationKeyId?: number,
  entitlementDaysOverride?: number,
  orderId?: number,
) {
  const pkg = await getPackageById(packageId);
  if (!pkg) return;

  const entitlementDays = normalizePositiveInteger(entitlementDaysOverride)
    ?? normalizePositiveInteger(pkg.renewalPeriodDays)
    ?? normalizePositiveInteger(pkg.durationDays)
    ?? DEFAULT_KEY_ENTITLEMENT_DAYS;
  const now = new Date();
  const serviceEndDate = buildEndDateFromDays(now, entitlementDays);
  // For deferred activation: set a placeholder endDate to 14+30=44 days (max wait + real period)
  const placeholderEndDate = buildEndDateFromDays(now, 44); // 14 days max wait + 30 days real period
  const maxActivationDate = buildEndDateFromDays(now, 14); // 14 days from now

  // Check if student already completed the course (100% progress) — renewals should activate immediately
  const [existingEnrollment] = await (await getDb())!.select({ progressPercentage: enrollments.progressPercentage })
    .from(enrollments).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.enrolledAt)).limit(1);
  const isRenewal = (existingEnrollment?.progressPercentage ?? 0) >= 100;

  const existingPackageSubscriptions = await getUserPackageSubscriptions(userId);
  const currentPackageSubscription = existingPackageSubscriptions.find((subscription) => subscription.packageId === packageId);

  if (currentPackageSubscription) {
    const db = await getDb();
    if (!db) return;
    await db.update(packageSubscriptions).set({
      isActive: true,
      startDate: now.toISOString(),
      endDate: serviceEndDate.toISOString(),
      renewalDueDate: serviceEndDate.toISOString(),
      autoRenew: false,
      updatedAt: now.toISOString(),
    }).where(eq(packageSubscriptions.id, currentPackageSubscription.id));
  } else {
    await createPackageSubscription({
      userId,
      packageId,
      orderId: orderId ?? 0,
      isActive: true,
      startDate: now.toISOString(),
      endDate: serviceEndDate.toISOString(),
      renewalDueDate: serviceEndDate.toISOString(),
      autoRenew: false,
    });
  }

  // Enroll in all package courses (or all published courses if none linked)
  let pkgCourses = await getPackageCourses(packageId);
  let courseIdsToEnroll: number[] = pkgCourses.map(pc => pc.courseId);

  // Fallback: if no courses are linked to this package, enroll in ALL published courses
  if (courseIdsToEnroll.length === 0) {
    const allPublished = await getPublishedCourses();
    courseIdsToEnroll = allPublished.map(c => c.id);
  }

  for (const courseId of courseIdsToEnroll) {
    try {
      const existing = await getEnrollmentByUserAndCourse(userId, courseId);
      if (!existing) {
        await createEnrollment({
          userId,
          courseId,
          paymentStatus: "completed",
          isSubscriptionActive: true,
          registrationKeyId: registrationKeyId ?? null,
          activatedViaKey: !!registrationKeyId,
        });
      }
    } catch (e) {
      // ignore duplicate enrollment
    }
  }

  // If package includes LexAI, grant subscription
  if (pkg.includesLexai) {
    const current = await getActiveLexaiSubscription(userId);
    if (current) {
      if (isRenewal) {
        // Renewal student (100% progress) — activate immediately, no deferred
        const realEnd = buildEndDateFromDays(now, entitlementDays);
        await updateLexaiSubscription(current.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: false,
          studentActivatedAt: now.toISOString(),
          maxActivationDate: null,
          startDate: now.toISOString(),
          endDate: realEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesLimit: 100,
        });
      } else {
        await updateLexaiSubscription(current.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: true,
          studentActivatedAt: null,
          maxActivationDate: maxActivationDate.toISOString(),
          startDate: now.toISOString(),
          endDate: placeholderEndDate.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesLimit: 100,
        });
      }
    } else {
      await createLexaiSubscription({
        userId,
        isActive: true,
        isPaused: false,
        isPendingActivation: true,
        studentActivatedAt: null,
        maxActivationDate: maxActivationDate.toISOString(),
        startDate: now.toISOString(),
        endDate: placeholderEndDate.toISOString(),
        paymentStatus: "completed",
        paymentAmount: 0,
        paymentCurrency: "USD",
        messagesUsed: 0,
        messagesLimit: 100,
        pausedAt: null,
        pausedReason: null,
        pausedRemainingDays: null,
      });
    }
  }

  // If package includes recommendations, grant subscription
  if (pkg.includesRecommendations) {
    const current = await getActiveRecommendationSubscription(userId);
    if (current) {
      if (isRenewal) {
        // Renewal student (100% progress) — activate immediately
        const realEnd = buildEndDateFromDays(now, entitlementDays);
        await updateRecommendationSubscription(current.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: false,
          studentActivatedAt: now.toISOString(),
          maxActivationDate: null,
          startDate: now.toISOString(),
          endDate: realEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          registrationKeyId: registrationKeyId ?? current.registrationKeyId,
        });
      } else {
        await updateRecommendationSubscription(current.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: true,
          studentActivatedAt: null,
          maxActivationDate: maxActivationDate.toISOString(),
          startDate: now.toISOString(),
          endDate: placeholderEndDate.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          registrationKeyId: registrationKeyId ?? current.registrationKeyId,
        });
      }
    } else {
      await createRecommendationSubscription({
        userId,
        registrationKeyId: registrationKeyId ?? null,
        isActive: true,
        isPaused: false,
        isPendingActivation: true,
        studentActivatedAt: null,
        maxActivationDate: maxActivationDate.toISOString(),
        startDate: now.toISOString(),
        endDate: placeholderEndDate.toISOString(),
        paymentStatus: "completed",
        paymentAmount: 0,
        paymentCurrency: "USD",
        pausedAt: null,
        pausedReason: null,
        pausedRemainingDays: null,
      });
    }
  }
}

// ============================================================================
// Upgrade Service
// ============================================================================

/**
 * Check if a user is eligible to upgrade to a given package.
 * Returns the current subscription + upgrade pricing info.
 */
export async function checkUpgradeEligibility(userId: number, targetPackageId: number) {
  const db = await getDb();
  if (!db) return null;

  const targetPkg = await getPackageById(targetPackageId);
  if (!targetPkg) return null;
  if (!targetPkg.upgradePrice || targetPkg.upgradePrice <= 0) return null; // no upgrade path configured

  // Check user has an active subscription to a DIFFERENT (lower-tier) package
  const subs = await getUserPackageSubscriptions(userId);
  const activeSubs = subs.filter(s => s.isActive && s.packageId !== targetPackageId);
  if (activeSubs.length === 0) return null; // no active subscription to upgrade from

  // Take the first active subscription as the source
  const currentSub = activeSubs[0];
  const currentPkg = await getPackageById(currentSub.packageId);

  return {
    eligible: true,
    currentPackageId: currentSub.packageId,
    currentPackageName: currentPkg?.nameEn || 'Current Package',
    currentPackageNameAr: currentPkg?.nameAr || 'الباقة الحالية',
    targetPackageId: targetPkg.id,
    targetPackageName: targetPkg.nameEn,
    targetPackageNameAr: targetPkg.nameAr,
    upgradePrice: targetPkg.upgradePrice, // in cents
    renewalPrice: targetPkg.renewalPrice || 0, // in cents — renewal after upgrade
    renewalPeriodDays: targetPkg.renewalPeriodDays || 30,
  };
}

/**
 * Process an upgrade: deactivate old subscription, activate new one.
 */
export async function processUpgrade(
  userId: number,
  fromPackageId: number,
  toPackageId: number,
  orderId?: number,
) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();

  // Deactivate old subscription
  const subs = await getUserPackageSubscriptions(userId);
  const oldSub = subs.find(s => s.packageId === fromPackageId && s.isActive);
  if (oldSub) {
    await db.update(packageSubscriptions).set({
      isActive: false,
      updatedAt: now.toISOString(),
    }).where(eq(packageSubscriptions.id, oldSub.id));
  }

  // Fulfill new package entitlements (creates subscription + enrollments + LexAI + recommendations)
  await fulfillPackageEntitlements(userId, toPackageId);

  // Mark the new subscription as upgraded
  const newSubs = await getUserPackageSubscriptions(userId);
  const newSub = newSubs.find(s => s.packageId === toPackageId && s.isActive);
  if (newSub) {
    await db.update(packageSubscriptions).set({
      upgradedFromPackageId: fromPackageId,
      upgradedAt: now.toISOString(),
      orderId: orderId || newSub.orderId,
      updatedAt: now.toISOString(),
    }).where(eq(packageSubscriptions.id, newSub.id));
  }

  return { success: true, fromPackageId, toPackageId };
}

/**
 * Get upgrade statistics: total upgrades, monthly breakdown by referrer (leaderboard).
 */
export async function getUpgradeStatistics(month?: string) {
  const db = await getDb();
  if (!db) return { totalUpgrades: 0, monthlyUpgrades: 0, leaderboard: [] as { referredBy: string; count: number }[] };

  const upgradeFilter = and(
    sql`${registrationKeys.packageId} IS NOT NULL`,
    eq(registrationKeys.isUpgrade, true),
    sql`${registrationKeys.activatedAt} IS NOT NULL`,
  );

  // Total all-time upgrades
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(upgradeFilter);

  // Current month filter (YYYY-MM)
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const monthFilter = and(
    upgradeFilter,
    sql`substr(${registrationKeys.activatedAt}, 1, 7) = ${targetMonth}`,
  );

  const [monthResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(monthFilter);

  // Leaderboard: upgrades per referrer for the target month
  const leaderboardRows = await db
    .select({
      referredBy: registrationKeys.referredBy,
      count: sql<number>`count(*)`,
    })
    .from(registrationKeys)
    .where(and(
      monthFilter,
      sql`${registrationKeys.referredBy} IS NOT NULL AND ${registrationKeys.referredBy} != ''`,
    ))
    .groupBy(registrationKeys.referredBy)
    .orderBy(sql`count(*) DESC`);

  // Also get all-time leaderboard
  const allTimeLeaderboard = await db
    .select({
      referredBy: registrationKeys.referredBy,
      count: sql<number>`count(*)`,
    })
    .from(registrationKeys)
    .where(and(
      upgradeFilter,
      sql`${registrationKeys.referredBy} IS NOT NULL AND ${registrationKeys.referredBy} != ''`,
    ))
    .groupBy(registrationKeys.referredBy)
    .orderBy(sql`count(*) DESC`);

  return {
    totalUpgrades: Number(totalResult?.count ?? 0),
    monthlyUpgrades: Number(monthResult?.count ?? 0),
    targetMonth,
    leaderboard: leaderboardRows.map(r => ({
      referredBy: r.referredBy || 'Unknown',
      count: Number(r.count),
    })),
    allTimeLeaderboard: allTimeLeaderboard.map(r => ({
      referredBy: r.referredBy || 'Unknown',
      count: Number(r.count),
    })),
  };
}

// ============================================================================
// Episode Progress Management
// ============================================================================

export async function getUserEpisodeProgress(userId: number, episodeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(episodeProgress)
    .where(and(
      eq(episodeProgress.userId, userId),
      eq(episodeProgress.episodeId, episodeId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserCourseProgress(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(episodeProgress)
    .where(and(
      eq(episodeProgress.userId, userId),
      eq(episodeProgress.courseId, courseId)
    ))
    .orderBy(episodeProgress.lastWatchedAt);
}

export async function createOrUpdateEpisodeProgress(progress: InsertEpisodeProgress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserEpisodeProgress(progress.userId, progress.episodeId);
  
  if (existing) {
    const nextWatchedDuration = Math.max(existing.watchedDuration || 0, progress.watchedDuration || 0);
    const nextCompleted = Boolean(existing.isCompleted) || Boolean(progress.isCompleted);
    await db.update(episodeProgress)
      .set({
        watchedDuration: nextWatchedDuration,
        isCompleted: nextCompleted,
        lastWatchedAt: new Date().toISOString(),
      })
      .where(eq(episodeProgress.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(episodeProgress).values(progress).returning({ id: episodeProgress.id });
    return result[0].id;
  }
}

// ============================================================================
// Admin Quiz Management (CRUD)
// ============================================================================

export async function getAllQuizzes(): Promise<Quiz[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizzes).orderBy(quizzes.level);
}

export async function getQuizWithQuestionsAndOptions(quizId: number) {
  const db = await getDb();
  if (!db) return null;

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) return null;

  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.orderNum);

  const questionIds = questions.map(q => q.id);
  const options = questionIds.length > 0
    ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, questionIds))
    : [];

  return {
    ...quiz,
    questions: questions.map(q => ({
      ...q,
      options: options.filter(o => o.questionId === q.id).sort((a, b) => a.optionId.localeCompare(b.optionId)),
    })),
  };
}

export async function createQuiz(input: { level: number; title: string; description?: string; passingScore?: number }): Promise<Quiz | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date().toISOString();
  const [quiz] = await db.insert(quizzes).values({
    level: input.level,
    title: input.title,
    description: input.description ?? null,
    passingScore: input.passingScore ?? 50,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return quiz ?? null;
}

export async function updateQuiz(id: number, input: { title?: string; description?: string; passingScore?: number; level?: number }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(quizzes).set({
    ...input,
    updatedAt: new Date().toISOString(),
  }).where(eq(quizzes.id, id));
}

export async function deleteQuiz(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Get questions for this quiz to delete their options
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id));
  const questionIds = questions.map(q => q.id);
  if (questionIds.length > 0) {
    await db.delete(quizOptions).where(inArray(quizOptions.questionId, questionIds));
  }
  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
  // Delete attempts and progress for this quiz
  await db.delete(quizAnswers).where(
    inArray(quizAnswers.attemptId,
      db.select({ id: quizAttempts.id }).from(quizAttempts).where(eq(quizAttempts.quizId, id))
    )
  );
  await db.delete(quizAttempts).where(eq(quizAttempts.quizId, id));
  await db.delete(userQuizProgress).where(eq(userQuizProgress.quizId, id));
  await db.delete(quizzes).where(eq(quizzes.id, id));
}

export async function createQuizQuestion(input: { quizId: number; questionText: string; orderNum: number }): Promise<QuizQuestion | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date().toISOString();
  const [question] = await db.insert(quizQuestions).values({
    quizId: input.quizId,
    questionText: input.questionText,
    orderNum: input.orderNum,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return question ?? null;
}

export async function updateQuizQuestion(id: number, input: { questionText?: string; orderNum?: number }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(quizQuestions).set({
    ...input,
    updatedAt: new Date().toISOString(),
  }).where(eq(quizQuestions.id, id));
}

export async function deleteQuizQuestion(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizOptions).where(eq(quizOptions.questionId, id));
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
}

export async function createQuizOption(input: { questionId: number; optionId: string; optionText: string; isCorrect: boolean }): Promise<QuizOption | null> {
  const db = await getDb();
  if (!db) return null;
  const [option] = await db.insert(quizOptions).values({
    questionId: input.questionId,
    optionId: input.optionId,
    optionText: input.optionText,
    isCorrect: input.isCorrect,
    createdAt: new Date().toISOString(),
  }).returning();
  return option ?? null;
}

export async function updateQuizOption(id: number, input: { optionText?: string; isCorrect?: boolean }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(quizOptions).set(input).where(eq(quizOptions.id, id));
}

export async function deleteQuizOption(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizOptions).where(eq(quizOptions.id, id));
}

export async function getQuizStats(quizId: number) {
  const db = await getDb();
  if (!db) return { totalAttempts: 0, passRate: 0, avgScore: 0 };

  const [stats] = await db.select({
    totalAttempts: sql<number>`count(*)`,
    passedCount: sql<number>`sum(case when ${quizAttempts.passed} = 1 then 1 else 0 end)`,
    avgScore: sql<number>`avg(${quizAttempts.score})`,
  }).from(quizAttempts).where(eq(quizAttempts.quizId, quizId));

  const total = Number(stats?.totalAttempts ?? 0);
  const passed = Number(stats?.passedCount ?? 0);
  return {
    totalAttempts: total,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    avgScore: Math.round(Number(stats?.avgScore ?? 0)),
  };
}

// ============================================================================
// Episode Quiz Management
// ============================================================================

export async function getQuizByLevel(level: number): Promise<Quiz | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(quizzes)
    .where(eq(quizzes.level, level))
    .limit(1);
  return result[0];
}

export async function getQuizForLevelWithQuestions(level: number) {
  const db = await getDb();
  if (!db) return undefined;

  const quiz = await getQuizByLevel(level);
  if (!quiz) return undefined;

  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.orderNum);

  const questionIds = questions.map((q) => q.id);
  const options = questionIds.length > 0
    ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, questionIds))
    : [];

  const questionsWithOptions = questions.map((question) => ({
    id: question.id,
    questionText: question.questionText,
    orderNum: question.orderNum,
    options: options
      .filter((option) => option.questionId === question.id)
      .map((option) => ({
        id: option.id,
        optionId: option.optionId,
        text: option.optionText,
      })),
  }));

  return {
    id: quiz.id,
    level: quiz.level,
    title: quiz.title,
    description: quiz.description,
    passingScore: quiz.passingScore,
    questions: questionsWithOptions,
  };
}

export async function hasUserPassedQuizLevel(userId: number, level: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const quiz = await getQuizByLevel(level);
  if (!quiz) return false;

  const progress = await db.select().from(userQuizProgress)
    .where(and(
      eq(userQuizProgress.userId, userId),
      eq(userQuizProgress.quizId, quiz.id)
    ))
    .limit(1);

  if (!progress.length) return false;
  const record = progress[0];
  const bestScore = Number(record.bestScore || 0);
  return Boolean(record.isCompleted) || bestScore >= Number(quiz.passingScore || 50);
}

export async function getQuizAttemptsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const attempts = await db
    .select({
      attemptId: quizAttempts.id,
      quizId: quizAttempts.quizId,
      score: quizAttempts.score,
      totalQuestions: quizAttempts.totalQuestions,
      percentage: quizAttempts.percentage,
      passed: quizAttempts.passed,
      completedAt: quizAttempts.completedAt,
      quizTitle: quizzes.title,
      quizLevel: quizzes.level,
    })
    .from(quizAttempts)
    .leftJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
    .where(eq(quizAttempts.userId, userId))
    .orderBy(desc(quizAttempts.completedAt));

  return attempts;
}

export async function submitEpisodeQuizAttempt(
  userId: number,
  level: number,
  answers: { questionId: number; optionId: string }[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const quiz = await getQuizByLevel(level);
  if (!quiz) {
    throw new Error(`Quiz not configured for level ${level}`);
  }

  const questions = await db.select().from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id));

  if (!questions.length) {
    throw new Error("Quiz has no questions configured");
  }

  const questionIds = questions.map((q) => q.id);
  const allOptions = await db.select().from(quizOptions)
    .where(inArray(quizOptions.questionId, questionIds));

  const answerByQuestion = new Map<number, string>();
  for (const answer of answers) {
    answerByQuestion.set(answer.questionId, answer.optionId);
  }

  const detailedResults = questions.map((question) => {
    const correctOption = allOptions.find(
      (option) => option.questionId === question.id && option.isCorrect
    );
    const selectedOptionId = answerByQuestion.get(question.id) || "";
    const isCorrect = !!correctOption && correctOption.optionId === selectedOptionId;

    return {
      questionId: question.id,
      selectedOptionId,
      correctOptionId: correctOption?.optionId || "",
      isCorrect,
    };
  });

  const correctCount = detailedResults.filter((result) => result.isCorrect).length;
  const totalQuestions = questions.length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= Number(quiz.passingScore || 50);

  const [attempt] = await db.insert(quizAttempts).values({
    userId,
    quizId: quiz.id,
    score,
    totalQuestions,
    percentage: String(score),
    passed,
    completedAt: new Date().toISOString(),
  }).returning({ id: quizAttempts.id });

  await db.insert(quizAnswers).values(
    detailedResults.map((result) => ({
      attemptId: attempt.id,
      questionId: result.questionId,
      selectedOptionId: result.selectedOptionId || "",
      isCorrect: result.isCorrect,
    }))
  );

  const progress = await db.select().from(userQuizProgress)
    .where(and(
      eq(userQuizProgress.userId, userId),
      eq(userQuizProgress.quizId, quiz.id)
    ))
    .limit(1);

  if (progress.length) {
    const existing = progress[0];
    const nextBestScore = Math.max(Number(existing.bestScore || 0), score);
    const nextAttempts = Number(existing.attemptsCount || 0) + 1;
    await db.update(userQuizProgress)
      .set({
        isUnlocked: true,
        isCompleted: Boolean(existing.isCompleted) || passed,
        bestScore: nextBestScore,
        bestPercentage: String(nextBestScore),
        attemptsCount: nextAttempts,
        lastAttemptAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userQuizProgress.id, existing.id));
  } else {
    await db.insert(userQuizProgress).values({
      userId,
      quizId: quiz.id,
      isUnlocked: true,
      isCompleted: passed,
      bestScore: score,
      bestPercentage: String(score),
      attemptsCount: 1,
      lastAttemptAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    attemptId: attempt.id,
    score,
    passed,
    correctCount,
    totalQuestions,
    passingScore: Number(quiz.passingScore || 50),
    detailedResults,
  };
}

// ============================================================================
// User Quiz Progress (standalone /quiz page)
// ============================================================================

/**
 * Get a user's progress across all quiz levels.
 * Level 1 is always unlocked; other levels unlock when the previous is passed.
 */
export async function getUserQuizProgress(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const allQuizzes = await db.select().from(quizzes).orderBy(quizzes.level);
  if (!allQuizzes.length) return [];

  const progress = await db
    .select()
    .from(userQuizProgress)
    .where(eq(userQuizProgress.userId, userId));

  return allQuizzes.map((quiz) => {
    const up = progress.find((p) => p.quizId === quiz.id);
    return {
      level: quiz.level,
      title: quiz.title,
      description: quiz.description,
      passingScore: Number(quiz.passingScore || 50),
      isUnlocked: up ? Boolean(up.isUnlocked) : quiz.level === 1,
      isPassed: up ? Boolean(up.isCompleted) : false,
      bestScore: Number(up?.bestScore ?? 0),
      lastAttemptAt: up?.lastAttemptAt ?? null,
    };
  });
}

/**
 * Check whether a user can access a specific quiz level.
 */
export async function canAccessQuizLevel(userId: number, level: number): Promise<boolean> {
  if (level === 1) return true;

  const db = await getDb();
  if (!db) return false;

  // Find the previous-level quiz
  const prevQuiz = await getQuizByLevel(level - 1);
  if (!prevQuiz) return false;

  return hasUserPassedQuizLevel(userId, level - 1);
}

/**
 * Get attempt history for a user on a specific quiz level.
 */
export async function getQuizHistoryForLevel(userId: number, level: number) {
  const db = await getDb();
  if (!db) return [];

  const quiz = await getQuizByLevel(level);
  if (!quiz) return [];

  return db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quiz.id)))
    .orderBy(desc(quizAttempts.completedAt));
}

// ============================================================================
// LexAI Subscription Management
// ============================================================================

export async function getUserLexaiSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const nowIso = new Date().toISOString();
  const result = await db.select().from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.userId, userId),
      eq(lexaiSubscriptions.isActive, true),
      eq(lexaiSubscriptions.isPaused, false),
      sql`${lexaiSubscriptions.endDate} >= ${nowIso}`
    ))
    .orderBy(desc(lexaiSubscriptions.endDate), desc(lexaiSubscriptions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLexaiSubscription(subscription: InsertLexaiSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(lexaiSubscriptions).values(subscription).returning({ id: lexaiSubscriptions.id });
  return result[0].id;
}

export async function updateLexaiSubscription(id: number, subscription: Partial<InsertLexaiSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(lexaiSubscriptions).set({ ...subscription, updatedAt: new Date().toISOString() }).where(eq(lexaiSubscriptions.id, id));
}

export async function pauseLexaiSubscription(id: number, reason?: string, frozenUntilDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db.select().from(lexaiSubscriptions).where(eq(lexaiSubscriptions.id, id)).limit(1);
  if (!subscription) throw new Error("LexAI subscription not found");

  const now = new Date();
  const remainingDays = getRemainingDaysUntil(subscription.endDate, now);

  await db.update(lexaiSubscriptions).set({
    isPaused: true,
    pausedAt: now.toISOString(),
    pausedReason: reason ?? null,
    pausedRemainingDays: remainingDays,
    frozenUntil: frozenUntilDate ? frozenUntilDate.toISOString() : null,
    updatedAt: now.toISOString(),
  }).where(eq(lexaiSubscriptions.id, id));
}

export async function resumeLexaiSubscription(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db.select().from(lexaiSubscriptions).where(eq(lexaiSubscriptions.id, id)).limit(1);
  if (!subscription) throw new Error("LexAI subscription not found");

  const now = new Date();
  const remainingDays = normalizePositiveInteger(subscription.pausedRemainingDays) ?? 1;
  const endDate = buildEndDateFromDays(now, remainingDays);

  await db.update(lexaiSubscriptions).set({
    isActive: true,
    isPaused: false,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    pausedAt: null,
    pausedReason: null,
    pausedRemainingDays: null,
    frozenUntil: null,
    updatedAt: now.toISOString(),
  }).where(eq(lexaiSubscriptions.id, id));
}

export async function incrementLexaiMessageCount(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db
    .select()
    .from(lexaiSubscriptions)
    .where(eq(lexaiSubscriptions.id, subscriptionId))
    .limit(1);

  if (subscription) {
    const isKeySubscription = String(subscription.paymentStatus ?? "").toLowerCase() === "key";
    if (isKeySubscription && Number(subscription.messagesUsed ?? 0) === 0 && !subscription.startDate) {
      const startDate = new Date();

      await db
        .update(lexaiSubscriptions)
        .set({
          startDate: startDate.toISOString(),
        })
        .where(eq(lexaiSubscriptions.id, subscriptionId));
    }
  }

  await db
    .update(lexaiSubscriptions)
    .set({ messagesUsed: sql`${lexaiSubscriptions.messagesUsed} + 1` })
    .where(eq(lexaiSubscriptions.id, subscriptionId));
}

// ============================================================================
// LexAI Message Management
// ============================================================================

export async function getUserLexaiMessages(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(lexaiMessages)
    .where(eq(lexaiMessages.userId, userId))
    .orderBy(desc(lexaiMessages.createdAt))
    .limit(limit);
}

export async function createLexaiMessage(message: InsertLexaiMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .insert(lexaiMessages)
    .values({
      ...message,
      createdAt: new Date().toISOString(),
    } as InsertLexaiMessage)
    .returning({ id: lexaiMessages.id });
  return result[0].id;
}

export async function deleteLexaiMessagesByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(lexaiMessages).where(eq(lexaiMessages.userId, userId));
}

/**
 * Get all LexAI messages with user info (for admin moderation)
 */
export async function getAllLexaiMessagesWithUsers(limit: number = 500) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: lexaiMessages.id,
      userId: lexaiMessages.userId,
      subscriptionId: lexaiMessages.subscriptionId,
      role: lexaiMessages.role,
      content: lexaiMessages.content,
      analysisType: lexaiMessages.analysisType,
      imageUrl: lexaiMessages.imageUrl,
      createdAt: lexaiMessages.createdAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(lexaiMessages)
    .leftJoin(users, eq(lexaiMessages.userId, users.id))
    .orderBy(desc(lexaiMessages.createdAt))
    .limit(limit);
}

/**
 * Get users who have LexAI conversations (for admin listing)
 */
export async function getLexaiConversationUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      userId: lexaiMessages.userId,
      userEmail: users.email,
      userName: users.name,
      messageCount: sql<number>`count(*)`,
      lastMessageAt: sql<string>`max(${lexaiMessages.createdAt})`,
    })
    .from(lexaiMessages)
    .leftJoin(users, eq(lexaiMessages.userId, users.id))
    .groupBy(lexaiMessages.userId, users.email, users.name)
    .orderBy(desc(sql`max(${lexaiMessages.createdAt})`));
}

export async function getLexaiStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [totalSubs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lexaiSubscriptions);
  const [activeSubs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.isActive, true), eq(lexaiSubscriptions.isPaused, false)));
  const [totalMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lexaiMessages);

  return {
    totalSubscriptions: Number(totalSubs?.count ?? 0),
    activeSubscriptions: Number(activeSubs?.count ?? 0),
    totalMessages: Number(totalMessages?.count ?? 0),
  };
}

// ============================================================================
// Additional Helper Functions (for backward compatibility)
// ============================================================================

/**
 * Get all enrollments (admin function)
 */
export async function getAllEnrollments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(enrollments).orderBy(desc(enrollments.enrolledAt));
}

export async function getAllEnrollmentsWithDetails(limit?: number) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select({
      enrollment: enrollments,
      user: users,
      course: courses,
    })
    .from(enrollments)
    .leftJoin(users, eq(enrollments.userId, users.id))
    .leftJoin(courses, eq(enrollments.courseId, courses.id))
    .orderBy(desc(enrollments.enrolledAt));

  if (typeof limit === "number") {
    return await query.limit(limit);
  }

  return await query;
}

/**
 * Get enrollment by course and user (alias for getEnrollment with swapped params)
 */
export async function getEnrollmentByCourseAndUser(courseId: number, userId: number) {
  return getEnrollment(userId, courseId);
}

/**
 * Alias to match legacy call sites that pass (userId, courseId).
 */
export async function getEnrollmentByUserAndCourse(userId: number, courseId: number) {
  return getEnrollment(userId, courseId);
}

/**
 * Get active LexAI subscription for user (alias for getUserLexaiSubscription)
 */
export async function getActiveLexaiSubscription(userId: number) {
  return getUserLexaiSubscription(userId);
}

/**
 * Get LexAI messages by user (alias for getUserLexaiMessages)
 */
export async function getLexaiMessagesByUser(userId: number, limit: number = 50) {
  return getUserLexaiMessages(userId, limit);
}

export async function getLexaiSubscriptionsWithUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: lexaiSubscriptions.id,
      userId: lexaiSubscriptions.userId,
      isActive: lexaiSubscriptions.isActive,
      isPaused: lexaiSubscriptions.isPaused,
      startDate: lexaiSubscriptions.startDate,
      endDate: lexaiSubscriptions.endDate,
      paymentStatus: lexaiSubscriptions.paymentStatus,
      paymentAmount: lexaiSubscriptions.paymentAmount,
      paymentCurrency: lexaiSubscriptions.paymentCurrency,
      messagesUsed: lexaiSubscriptions.messagesUsed,
      messagesLimit: lexaiSubscriptions.messagesLimit,
      pausedAt: lexaiSubscriptions.pausedAt,
      pausedReason: lexaiSubscriptions.pausedReason,
      pausedRemainingDays: lexaiSubscriptions.pausedRemainingDays,
      createdAt: lexaiSubscriptions.createdAt,
      updatedAt: lexaiSubscriptions.updatedAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(lexaiSubscriptions)
    .leftJoin(users, eq(lexaiSubscriptions.userId, users.id))
    .orderBy(desc(lexaiSubscriptions.createdAt));
}

// ============================================================================
// User Roles (RBAC)
// ============================================================================

export async function getUserRoles(userId: number): Promise<UserRole[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function hasRole(userId: number, role: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
    .limit(1);
  return rows.length > 0;
}

export async function hasAnyRole(userId: number, roles: string[]): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), inArray(userRoles.role, roles)))
    .limit(1);
  return rows.length > 0;
}

export async function assignRole(userId: number, role: string, assignedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // INSERT OR IGNORE for unique constraint
  await db.insert(userRoles).values({ userId, role, assignedBy, assignedAt: new Date().toISOString() }).onConflictDoNothing();
}

export async function removeRole(userId: number, role: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userRoles).where(
    and(eq(userRoles.userId, userId), eq(userRoles.role, role))
  );
}

export async function getUsersWithRole(role: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      roleId: userRoles.id,
      userId: userRoles.userId,
      role: userRoles.role,
      assignedAt: userRoles.assignedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(userRoles)
    .leftJoin(users, eq(userRoles.userId, users.id))
    .where(eq(userRoles.role, role))
    .orderBy(desc(userRoles.assignedAt));
}

export async function getAllRoleAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      roleId: userRoles.id,
      userId: userRoles.userId,
      role: userRoles.role,
      assignedAt: userRoles.assignedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(userRoles)
    .leftJoin(users, eq(userRoles.userId, users.id))
    .orderBy(desc(userRoles.assignedAt));
}

// ============================================================================
// Support Chat
// ============================================================================

export async function getOrCreateSupportConversation(userId: number): Promise<SupportConversation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Try to find existing open conversation
  const [existing] = await db.select().from(supportConversations)
    .where(and(eq(supportConversations.userId, userId), eq(supportConversations.status, "open")))
    .limit(1);

  if (existing) return existing;

  // Create new conversation
  const [created] = await db.insert(supportConversations)
    .values({ userId, status: "open" })
    .returning();
  return created;
}

export async function getSupportConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return null;
  const [conv] = await db.select().from(supportConversations)
    .where(eq(supportConversations.id, conversationId)).limit(1);
  return conv ?? null;
}

export async function getSupportConversationByUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [conv] = await db.select().from(supportConversations)
    .where(and(eq(supportConversations.userId, userId), eq(supportConversations.status, "open")))
    .limit(1);
  return conv ?? null;
}

export async function createSupportMessage(msg: {
  conversationId: number;
  senderId: number;
  senderType: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  attachmentDuration?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date().toISOString();
  const [message] = await db.insert(supportMessages).values({
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderType: msg.senderType,
    content: msg.content,
    attachmentUrl: msg.attachmentUrl || null,
    attachmentName: msg.attachmentName || null,
    attachmentSize: msg.attachmentSize || null,
    attachmentType: msg.attachmentType || null,
    attachmentDuration: msg.attachmentDuration || null,
    createdAt: now,
  }).returning();

  // Update conversation updatedAt
  await db.update(supportConversations)
    .set({ updatedAt: now })
    .where(eq(supportConversations.id, msg.conversationId));

  return message;
}

export async function getSupportMessages(conversationId: number, limit: number = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportMessages)
    .where(eq(supportMessages.conversationId, conversationId))
    .orderBy(supportMessages.createdAt)
    .limit(limit);
}

export async function getAllSupportConversations(searchQuery?: string) {
  const db = await getDb();
  if (!db) return [];

  const conversations = await db
    .select({
      id: supportConversations.id,
      userId: supportConversations.userId,
      status: supportConversations.status,
      assignedTo: supportConversations.assignedTo,
      createdAt: supportConversations.createdAt,
      updatedAt: supportConversations.updatedAt,
      closedAt: supportConversations.closedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(supportConversations)
    .leftJoin(users, eq(supportConversations.userId, users.id))
    .orderBy(desc(supportConversations.updatedAt));

  // If searching within message content, find matching conversation IDs
  let messageMatchConvIds: Set<number> | null = null;
  if (searchQuery && searchQuery.trim().length >= 2) {
    const q = `%${searchQuery.trim().toLowerCase()}%`;
    const matchingMessages = await db
      .select({ conversationId: supportMessages.conversationId })
      .from(supportMessages)
      .where(sql`lower(${supportMessages.content}) LIKE ${q}`)
      .groupBy(supportMessages.conversationId);
    messageMatchConvIds = new Set(matchingMessages.map(m => m.conversationId));
  }

  // Filter conversations by search query (name/email match OR message content match)
  const q = searchQuery?.trim().toLowerCase();
  const filtered = q && q.length >= 2
    ? conversations.filter(conv => {
        const nameMatch = conv.userName?.toLowerCase().includes(q);
        const emailMatch = conv.userEmail?.toLowerCase().includes(q);
        const msgMatch = messageMatchConvIds?.has(conv.id);
        return nameMatch || emailMatch || msgMatch;
      })
    : conversations;

  // Get last message + unread count for each conversation
  const result = [];
  for (const conv of filtered) {
    const msgs = await db.select().from(supportMessages)
      .where(eq(supportMessages.conversationId, conv.id))
      .orderBy(desc(supportMessages.createdAt))
      .limit(1);

    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.conversationId, conv.id),
          eq(supportMessages.senderType, "client"),
          eq(supportMessages.isRead, false)
        )
      );

    result.push({
      ...conv,
      lastMessage: msgs[0] ?? null,
      unreadCount: unreadRow?.count ?? 0,
    });
  }

  return result;
}

export async function markSupportMessagesRead(conversationId: number, readerType: 'support' | 'admin') {
  const db = await getDb();
  if (!db) return;

  // Mark client messages as read when support/admin reads
  await db.update(supportMessages)
    .set({ isRead: true })
    .where(
      and(
        eq(supportMessages.conversationId, conversationId),
        eq(supportMessages.senderType, "client"),
        eq(supportMessages.isRead, false)
      )
    );
}

export async function markClientMessagesRead(conversationId: number) {
  const db = await getDb();
  if (!db) return;

  // Mark support/admin messages as read when client reads
  await db.update(supportMessages)
    .set({ isRead: true })
    .where(
      and(
        eq(supportMessages.conversationId, conversationId),
        ne(supportMessages.senderType, "client"),
        eq(supportMessages.isRead, false)
      )
    );
}

export async function closeSupportConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportConversations)
    .set({ status: "closed", closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(supportConversations.id, conversationId));
}

export async function reopenSupportConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportConversations)
    .set({ status: "open", closedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(supportConversations.id, conversationId));
}

export async function getUnreadSupportCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Get user's conversation
  const conv = await getSupportConversationByUser(userId);
  if (!conv) return 0;

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(supportMessages)
    .where(
      and(
        eq(supportMessages.conversationId, conv.id),
        ne(supportMessages.senderType, "client"),
        eq(supportMessages.isRead, false)
      )
    );

  return row?.count ?? 0;
}

// ============================================================================
// Package System
// ============================================================================

export async function getAllPackages(publishedOnly = false): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  if (publishedOnly) {
    return db.select().from(packages).where(eq(packages.isPublished, true)).orderBy(packages.displayOrder);
  }
  return db.select().from(packages).orderBy(packages.displayOrder);
}

export async function getPackageById(id: number): Promise<Package | null> {
  const db = await getDb();
  if (!db) return null;
  const [pkg] = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return pkg ?? null;
}

export async function getPackageBySlug(slug: string): Promise<Package | null> {
  const db = await getDb();
  if (!db) return null;
  const [pkg] = await db.select().from(packages).where(eq(packages.slug, slug)).limit(1);
  return pkg ?? null;
}

export async function createPackage(input: Omit<InsertPackage, 'id'>): Promise<Package | null> {
  const db = await getDb();
  if (!db) return null;
  const [pkg] = await db.insert(packages).values(input).returning();
  return pkg ?? null;
}

export async function updatePackage(id: number, input: Partial<InsertPackage>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(packages).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(packages.id, id));
}

export async function deletePackage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(packageCourses).where(eq(packageCourses.packageId, id));
  await db.delete(packages).where(eq(packages.id, id));
}

export async function getPackageCourses(packageId: number): Promise<(PackageCourse & { course: Course | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(packageCourses)
    .where(eq(packageCourses.packageId, packageId))
    .orderBy(packageCourses.displayOrder);

  const result: (PackageCourse & { course: Course | null })[] = [];
  for (const row of rows) {
    const [course] = await db.select().from(courses).where(eq(courses.id, row.courseId)).limit(1);
    result.push({ ...row, course: course ?? null });
  }
  return result;
}

export async function setPackageCourses(packageId: number, courseIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(packageCourses).where(eq(packageCourses.packageId, packageId));
  for (let i = 0; i < courseIds.length; i++) {
    await db.insert(packageCourses).values({ packageId, courseId: courseIds[i], displayOrder: i + 1 });
  }
}

// ============================================================================
// Orders
// ============================================================================

export async function createOrder(input: Omit<InsertOrder, 'id'>): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db.insert(orders).values(input).returning();
  return order ?? null;
}

export async function getOrderById(id: number): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return order ?? null;
}

export async function getUserOrders(userId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const q = db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      subtotal: orders.subtotal,
      discountAmount: orders.discountAmount,
      vatRate: orders.vatRate,
      vatAmount: orders.vatAmount,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      paymentReference: orders.paymentReference,
      paymentProofUrl: orders.paymentProofUrl,
      isGift: orders.isGift,
      giftEmail: orders.giftEmail,
      giftMessage: orders.giftMessage,
      notes: orders.notes,
      isUpgrade: orders.isUpgrade,
      upgradeFromPackageId: orders.upgradeFromPackageId,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      completedAt: orders.completedAt,
      userEmail: users.email,
      userName: users.name,
      userPhone: users.phone,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt));
  if (status) {
    return q.where(eq(orders.status, status));
  }
  return q;
}

export async function updateOrderStatus(
  id: number,
  status: string,
  metadata?: string | { paymentReference?: string; paymentProofUrl?: string },
): Promise<Order | null> {
  const db = await getDb();
  if (!db) return null;
  const updates: any = { status, updatedAt: new Date().toISOString() };
  if (typeof metadata === "string") {
    updates.paymentReference = metadata;
  } else if (metadata) {
    if (metadata.paymentReference) updates.paymentReference = metadata.paymentReference;
    if (metadata.paymentProofUrl) updates.paymentProofUrl = metadata.paymentProofUrl;
  }
  if (status === 'paid') updates.completedAt = new Date().toISOString();
  const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
  return updated ?? null;
}

export async function addOrderItem(input: Omit<InsertOrderItem, 'id'>): Promise<OrderItem | null> {
  const db = await getDb();
  if (!db) return null;
  const [item] = await db.insert(orderItems).values(input).returning();
  return item ?? null;
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

// ============================================================================
// Package Subscriptions
// ============================================================================

export async function createPackageSubscription(input: Omit<InsertPackageSubscription, 'id'>): Promise<PackageSubscription | null> {
  const db = await getDb();
  if (!db) return null;
  const [sub] = await db.insert(packageSubscriptions).values(input).returning();
  return sub ?? null;
}

export async function getUserPackageSubscriptions(userId: number): Promise<PackageSubscription[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageSubscriptions)
    .where(and(eq(packageSubscriptions.userId, userId), eq(packageSubscriptions.isActive, true)));
}

export async function getUserActivePackage(userId: number): Promise<(PackageSubscription & { package: Package | null }) | null> {
  const db = await getDb();
  if (!db) return null;
  const subs = await db.select().from(packageSubscriptions)
    .where(and(eq(packageSubscriptions.userId, userId), eq(packageSubscriptions.isActive, true)))
    .orderBy(desc(packageSubscriptions.createdAt))
    .limit(1);
  if (subs.length === 0) return null;
  const sub = subs[0];
  const pkg = await getPackageById(sub.packageId);
  return { ...sub, package: pkg };
}

export async function getAllPackageSubscriptions(): Promise<PackageSubscription[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageSubscriptions).orderBy(desc(packageSubscriptions.createdAt));
}

// ============================================================================
// Deferred Activation: student chooses when to start their 30-day timer
// ============================================================================

/**
 * Get pending-activation subscriptions for a user (both LexAI and Recommendations).
 * Also returns current course progress so the frontend can decide whether to show the popup.
 */
export async function getPendingActivationStatus(userId: number) {
  const db = await getDb();
  if (!db) return { hasPending: false, lexai: null, recommendation: null, progressPercent: 0 };

  const [lexaiSub] = await db
    .select()
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isPendingActivation, true)))
    .limit(1);

  const [recSub] = await db
    .select()
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isPendingActivation, true)))
    .limit(1);

  // Get course progress from the first enrolled course
  const [enrollment] = await db
    .select({ courseId: enrollments.courseId, progressPercentage: enrollments.progressPercentage })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.enrolledAt))
    .limit(1);

  const progressPercent = enrollment?.progressPercentage ?? 0;

  // Check if max activation date has passed and auto-activate if so
  const now = new Date();
  if (lexaiSub?.maxActivationDate && new Date(lexaiSub.maxActivationDate) <= now) {
    await activateStudentSubscriptions(userId, true);
    return { hasPending: false, lexai: null, recommendation: null, progressPercent };
  }
  if (!lexaiSub && recSub?.maxActivationDate && new Date(recSub.maxActivationDate) <= now) {
    await activateStudentSubscriptions(userId, true);
    return { hasPending: false, lexai: null, recommendation: null, progressPercent };
  }

  return {
    hasPending: !!(lexaiSub || recSub),
    lexai: lexaiSub ?? null,
    recommendation: recSub ?? null,
    progressPercent,
    canActivate: progressPercent >= 100,
    maxActivationDate: lexaiSub?.maxActivationDate ?? recSub?.maxActivationDate ?? null,
  };
}

/**
 * Activate all pending subscriptions for a user — starts the real 30-day timer.
 * Called by student (when they choose "Start Now") or auto-triggered at maxActivationDate.
 */
export async function activateStudentSubscriptions(userId: number, isAutoActivation = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const realEndDate = buildEndDateFromDays(now, 30);

  const [lexaiSub] = await db
    .select()
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isPendingActivation, true)))
    .limit(1);

  const [recSub] = await db
    .select()
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isPendingActivation, true)))
    .limit(1);

  if (lexaiSub) {
    await db.update(lexaiSubscriptions).set({
      isPendingActivation: false,
      studentActivatedAt: now.toISOString(),
      startDate: now.toISOString(),
      endDate: realEndDate.toISOString(),
      updatedAt: now.toISOString(),
    }).where(eq(lexaiSubscriptions.id, lexaiSub.id));
  }

  if (recSub) {
    await db.update(recommendationSubscriptions).set({
      isPendingActivation: false,
      studentActivatedAt: now.toISOString(),
      startDate: now.toISOString(),
      endDate: realEndDate.toISOString(),
      updatedAt: now.toISOString(),
    }).where(eq(recommendationSubscriptions.id, recSub.id));
  }

  return {
    activated: !!(lexaiSub || recSub),
    isAutoActivation,
    endDate: realEndDate.toISOString(),
  };
}

export async function getRecommendationSubscriptionsWithUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: recommendationSubscriptions.id,
      userId: recommendationSubscriptions.userId,
      registrationKeyId: recommendationSubscriptions.registrationKeyId,
      isActive: recommendationSubscriptions.isActive,
      isPaused: recommendationSubscriptions.isPaused,
      startDate: recommendationSubscriptions.startDate,
      endDate: recommendationSubscriptions.endDate,
      paymentStatus: recommendationSubscriptions.paymentStatus,
      paymentAmount: recommendationSubscriptions.paymentAmount,
      paymentCurrency: recommendationSubscriptions.paymentCurrency,
      pausedAt: recommendationSubscriptions.pausedAt,
      pausedReason: recommendationSubscriptions.pausedReason,
      pausedRemainingDays: recommendationSubscriptions.pausedRemainingDays,
      createdAt: recommendationSubscriptions.createdAt,
      updatedAt: recommendationSubscriptions.updatedAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(recommendationSubscriptions)
    .leftJoin(users, eq(recommendationSubscriptions.userId, users.id))
    .orderBy(desc(recommendationSubscriptions.createdAt));
}

// ============================================================================
// Events
// ============================================================================

export async function getAllEvents(publishedOnly = false): Promise<Event[]> {
  const db = await getDb();
  if (!db) return [];
  if (publishedOnly) {
    return db.select().from(events).where(eq(events.isPublished, true)).orderBy(desc(events.eventDate));
  }
  return db.select().from(events).orderBy(desc(events.eventDate));
}

export async function getEventById(id: number): Promise<Event | null> {
  const db = await getDb();
  if (!db) return null;
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return event ?? null;
}

export async function createEvent(input: Omit<InsertEvent, 'id'>): Promise<Event | null> {
  const db = await getDb();
  if (!db) return null;
  const [event] = await db.insert(events).values(input).returning();
  return event ?? null;
}

export async function updateEvent(id: number, input: Partial<InsertEvent>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(events).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(events.id, id));
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(events).where(eq(events.id, id));
}

// ============================================================================
// Articles
// ============================================================================

export async function getAllArticles(publishedOnly = false): Promise<Article[]> {
  const db = await getDb();
  if (!db) return [];
  if (publishedOnly) {
    return db.select().from(articles).where(eq(articles.isPublished, true)).orderBy(desc(articles.publishedAt));
  }
  return db.select().from(articles).orderBy(desc(articles.createdAt));
}

export async function getArticleById(id: number): Promise<Article | null> {
  const db = await getDb();
  if (!db) return null;
  const [article] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return article ?? null;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const db = await getDb();
  if (!db) return null;
  const [article] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return article ?? null;
}

export async function createArticle(input: Omit<InsertArticle, 'id'>): Promise<Article | null> {
  const db = await getDb();
  if (!db) return null;
  const [article] = await db.insert(articles).values(input).returning();
  return article ?? null;
}

export async function updateArticle(id: number, input: Partial<InsertArticle>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(articles).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(articles.id, id));
}

export async function deleteArticle(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(articles).where(eq(articles.id, id));
}

// ============================================================================
// Coupons / Discount Codes
// ============================================================================

export async function getAllCoupons(): Promise<Coupon[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const db = await getDb();
  if (!db) return null;
  const [coupon] = await db.select().from(coupons)
    .where(eq(coupons.code, code.toUpperCase().trim()))
    .limit(1);
  return coupon ?? null;
}

export async function getCouponById(id: number): Promise<Coupon | null> {
  const db = await getDb();
  if (!db) return null;
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return coupon ?? null;
}

export async function createCoupon(input: Omit<InsertCoupon, 'id'>): Promise<Coupon | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date().toISOString();
  const [coupon] = await db.insert(coupons).values({ ...input, code: input.code.toUpperCase().trim(), createdAt: now, updatedAt: now }).returning();
  return coupon ?? null;
}

export async function updateCoupon(id: number, input: Partial<InsertCoupon>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(coupons).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(coupons.id, id));
}

export async function deleteCoupon(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(coupons).where(eq(coupons.id, id));
}

export async function incrementCouponUsage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(coupons.id, id));
}

export function validateCoupon(coupon: Coupon, subtotal: number, packageId?: number): { valid: boolean; error?: string } {
  if (!coupon.isActive) return { valid: false, error: 'Coupon is inactive' };
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return { valid: false, error: 'Coupon usage limit reached' };
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return { valid: false, error: 'Order total below minimum' };
  if (coupon.validFrom && new Date() < new Date(coupon.validFrom)) return { valid: false, error: 'Coupon not yet active' };
  if (coupon.validUntil && new Date() > new Date(coupon.validUntil)) return { valid: false, error: 'Coupon expired' };
  if (coupon.packageId && packageId && coupon.packageId !== packageId) return { valid: false, error: 'Coupon not valid for this package' };
  return { valid: true };
}

export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.discountType === 'percentage') {
    return Math.round(subtotal * coupon.discountValue / 100);
  }
  // fixed amount (in cents)
  return Math.min(coupon.discountValue, subtotal);
}

// ============================================================================
// Testimonials
// ============================================================================

export async function getAllTestimonials(publishedOnly = false): Promise<Testimonial[]> {
  const db = await getDb();
  if (!db) return [];
  if (publishedOnly) {
    return db.select().from(testimonials).where(eq(testimonials.isPublished, true)).orderBy(testimonials.displayOrder);
  }
  return db.select().from(testimonials).orderBy(testimonials.displayOrder);
}

export async function getTestimonialsByContext(input: {
  publishedOnly?: boolean;
  packageSlug?: string;
  courseId?: number;
  serviceKey?: string;
  limit?: number;
}): Promise<Testimonial[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (input.publishedOnly !== false) {
    conditions.push(eq(testimonials.isPublished, true));
  }
  if (input.packageSlug) {
    conditions.push(eq(testimonials.packageSlug, input.packageSlug));
  }
  if (typeof input.courseId === "number") {
    conditions.push(eq(testimonials.courseId, input.courseId));
  }
  if (input.serviceKey) {
    conditions.push(eq(testimonials.serviceKey, input.serviceKey));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const hasLimit = typeof input.limit === "number" && input.limit > 0;

  if (whereClause && hasLimit) {
    return db
      .select()
      .from(testimonials)
      .where(whereClause)
      .orderBy(testimonials.displayOrder)
      .limit(input.limit as number);
  }

  if (whereClause) {
    return db
      .select()
      .from(testimonials)
      .where(whereClause)
      .orderBy(testimonials.displayOrder);
  }

  if (hasLimit) {
    return db
      .select()
      .from(testimonials)
      .orderBy(testimonials.displayOrder)
      .limit(input.limit as number);
  }

  return db.select().from(testimonials).orderBy(testimonials.displayOrder);
}

export async function createTestimonial(input: Omit<InsertTestimonial, 'id'>): Promise<Testimonial | null> {
  const db = await getDb();
  if (!db) return null;
  const [t] = await db.insert(testimonials).values({ ...input, createdAt: new Date().toISOString() }).returning();
  return t ?? null;
}

export async function updateTestimonial(id: number, input: Partial<InsertTestimonial>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(testimonials).set(input).where(eq(testimonials.id, id));
}

export async function deleteTestimonial(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(testimonials).where(eq(testimonials.id, id));
}


// ============================================================================
// Admin Reports
// ============================================================================

/**
 * Get subscribers report — all users with enriched data
 */
export async function getSubscribersReport(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get all users
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    city: users.city,
    country: users.country,
    createdAt: users.createdAt,
    emailVerified: users.emailVerified,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));

  // Get all package subscriptions
  const allPkgSubs = await db.select().from(packageSubscriptions);
  // Get all packages
  const allPackages = await db.select().from(packages);
  // Get all activated keys (the real revenue source)
  const allKeys = await db.select().from(registrationKeys)
    .where(sql`${registrationKeys.packageId} IS NOT NULL`);

  const pkgMap = new Map(allPackages.map(p => [p.id, p]));

  return allUsers.map(u => {
    const normalizedEmail = (u.email || '').trim().toLowerCase();
    // Key-based revenue: sum of prices from activated keys matching this user's email
    const userKeys = allKeys.filter(k =>
      k.activatedAt && (k.email || '').trim().toLowerCase() === normalizedEmail
    );
    const totalSpent = userKeys.reduce((s, k) => s + (k.price || 0), 0);
    // Count renewal keys
    const renewalCount = userKeys.filter(k => k.isRenewal).length;

    const userSubs = allPkgSubs.filter(s => s.userId === u.id);
    const activeSubs = userSubs.filter(s => s.isActive);
    const activePackageNames = activeSubs
      .map(s => {
        const pkg = pkgMap.get(s.packageId);
        return pkg ? pkg.nameEn : null;
      })
      .filter(Boolean);
    const activePackageNamesAr = activeSubs
      .map(s => {
        const pkg = pkgMap.get(s.packageId);
        return pkg ? pkg.nameAr : null;
      })
      .filter(Boolean);
    // Frozen status
    const isFrozen = userSubs.some(s => s.isActive && (s as any).isPaused);

    return {
      ...u,
      totalKeys: userKeys.length,
      totalSpent, // already in dollars (key prices are stored in dollars)
      activePackages: activePackageNames,
      activePackagesAr: activePackageNamesAr,
      subscriptionCount: userSubs.length,
      renewalCount,
    };
  });
}

/**
 * Get monthly revenue report
 */
export async function getRevenueReport(): Promise<{
  totalRevenue: number;
  totalKeySales: number;
  monthlyRevenue: { month: string; revenue: number; count: number }[];
  packageRevenue: { packageId: number; packageName: string; packageNameAr: string; revenue: number; count: number }[];
  recentActivations: { id: number; keyCode: string; price: number; packageName: string; packageNameAr: string; userName: string; userEmail: string; activatedAt: string; isUpgrade: boolean; isRenewal: boolean }[];
}> {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, totalKeySales: 0, monthlyRevenue: [], packageRevenue: [], recentActivations: [] };

  // All activated keys with price > 0 = actual sales
  const activatedKeys = await db.select().from(registrationKeys)
    .where(and(sql`${registrationKeys.activatedAt} IS NOT NULL`, sql`${registrationKeys.price} > 0`))
    .orderBy(desc(registrationKeys.activatedAt));

  const allPackages = await db.select().from(packages);
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);

  const pkgMap = new Map(allPackages.map(p => [p.id, p]));
  const userByEmail = new Map(allUsers.map(u => [u.email?.toLowerCase(), u]));

  const totalRevenue = activatedKeys.reduce((sum, k) => sum + (k.price || 0), 0);
  const totalKeySales = activatedKeys.length;

  // Monthly revenue by activatedAt month
  const monthMap = new Map<string, { revenue: number; count: number }>();
  for (const k of activatedKeys) {
    const month = k.activatedAt ? k.activatedAt.substring(0, 7) : 'unknown';
    const existing = monthMap.get(month) || { revenue: 0, count: 0 };
    existing.revenue += k.price || 0;
    existing.count += 1;
    monthMap.set(month, existing);
  }
  const monthlyRevenue = Array.from(monthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // Revenue by package
  const pkgRevMap = new Map<number, { revenue: number; count: number }>();
  for (const k of activatedKeys) {
    const pid = k.packageId || 0;
    const existing = pkgRevMap.get(pid) || { revenue: 0, count: 0 };
    existing.revenue += k.price || 0;
    existing.count += 1;
    pkgRevMap.set(pid, existing);
  }
  const packageRevenue = Array.from(pkgRevMap.entries())
    .map(([packageId, data]) => ({
      packageId,
      packageName: pkgMap.get(packageId)?.nameEn || (packageId === 0 ? 'Other' : `Package #${packageId}`),
      packageNameAr: pkgMap.get(packageId)?.nameAr || (packageId === 0 ? 'أخرى' : `باقة #${packageId}`),
      ...data,
    }));

  // Recent activations (last 50)
  const recentActivations = activatedKeys.slice(0, 50).map(k => {
    const user = k.email ? userByEmail.get(k.email.toLowerCase()) : undefined;
    const pkg = k.packageId ? pkgMap.get(k.packageId) : undefined;
    return {
      id: k.id,
      keyCode: k.keyCode,
      price: k.price || 0,
      packageName: pkg?.nameEn || 'Unknown',
      packageNameAr: pkg?.nameAr || 'غير معروف',
      userName: user?.name || k.email || 'Unknown',
      userEmail: k.email || user?.email || 'Unknown',
      activatedAt: k.activatedAt || '',
      isUpgrade: !!k.isUpgrade,
      isRenewal: !!k.isRenewal,
    };
  });

  return { totalRevenue, totalKeySales, monthlyRevenue, packageRevenue, recentActivations };
}

/**
 * Get subscription expiry report
 */
export async function getSubscriptionExpiryReport(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const allPackages = await db.select().from(packages);
  const pkgMap = new Map(allPackages.map(p => [p.id, p]));

  const results: any[] = [];

  // Package subscriptions
  const pkgSubs = await db.select().from(packageSubscriptions)
    .where(eq(packageSubscriptions.isActive, true));
  for (const sub of pkgSubs) {
    const user = userMap.get(sub.userId);
    const pkg = pkgMap.get(sub.packageId);
    results.push({
      type: 'package',
      userId: sub.userId,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userPhone: user?.phone || '',
      subscriptionName: pkg?.nameEn || `Package #${sub.packageId}`,
      startDate: sub.startDate,
      endDate: sub.endDate || 'Lifetime',
      renewalDueDate: sub.renewalDueDate,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
    });
  }

  // LexAI subscriptions
  const lexSubs = await db.select().from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.isActive, true), eq(lexaiSubscriptions.isPaused, false)));
  for (const sub of lexSubs) {
    const user = userMap.get(sub.userId);
    results.push({
      type: 'lexai',
      userId: sub.userId,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userPhone: user?.phone || '',
      subscriptionName: 'Lex AI',
      startDate: sub.startDate,
      endDate: sub.endDate,
      renewalDueDate: null,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
    });
  }

  // Recommendation subscriptions
  const recSubs = await db.select().from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.isActive, true), eq(recommendationSubscriptions.isPaused, false)));
  for (const sub of recSubs) {
    const user = userMap.get(sub.userId);
    results.push({
      type: 'recommendations',
      userId: sub.userId,
      userName: user?.name || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userPhone: user?.phone || '',
      subscriptionName: 'Recommendations',
      startDate: sub.startDate,
      endDate: sub.endDate,
      renewalDueDate: null,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
    });
  }

  // Sort by endDate ascending (soonest to expire first)
  results.sort((a, b) => {
    if (a.endDate === 'Lifetime') return 1;
    if (b.endDate === 'Lifetime') return -1;
    return (a.endDate || '').localeCompare(b.endDate || '');
  });

  return results;
}

// ============================================================================
// Jobs / Careers System
// ============================================================================

export async function getActiveJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).where(eq(jobs.isActive, true)).orderBy(jobs.sortOrder);
}

export async function getAllJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).orderBy(jobs.sortOrder);
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function createJob(data: { titleAr: string; titleEn: string; descriptionAr: string; descriptionEn?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobs).values({
    titleAr: data.titleAr,
    titleEn: data.titleEn,
    descriptionAr: data.descriptionAr,
    descriptionEn: data.descriptionEn || null,
    sortOrder: data.sortOrder ?? 0,
  }).returning({ id: jobs.id });
  return result[0].id;
}

export async function updateJob(id: number, data: Partial<{ titleAr: string; titleEn: string; descriptionAr: string; descriptionEn: string; isActive: boolean; sortOrder: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(jobs.id, id));
}

export async function getQuestionsForJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  // Job-specific + general (jobId IS NULL) questions
  return db.select().from(jobQuestions)
    .where(and(
      eq(jobQuestions.isActive, true),
      or(eq(jobQuestions.jobId, jobId), sql`${jobQuestions.jobId} IS NULL`)
    ))
    .orderBy(jobQuestions.jobId, jobQuestions.sortOrder);
}

export async function getAllJobQuestions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobQuestions).orderBy(jobQuestions.jobId, jobQuestions.sortOrder);
}

export async function createJobQuestion(data: { jobId: number | null; questionAr: string; questionEn?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobQuestions).values({
    jobId: data.jobId,
    questionAr: data.questionAr,
    questionEn: data.questionEn || null,
    sortOrder: data.sortOrder ?? 0,
  }).returning({ id: jobQuestions.id });
  return result[0].id;
}

export async function updateJobQuestion(id: number, data: Partial<{ jobId: number | null; questionAr: string; questionEn: string; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobQuestions).set(data).where(eq(jobQuestions.id, id));
}

export async function deleteJobQuestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobQuestions).where(eq(jobQuestions.id, id));
}

export async function createJobApplication(data: {
  jobId: number;
  applicantName: string;
  email: string;
  phone: string;
  country?: string;
  cvFileUrl?: string;
  cvFileKey?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(jobApplications).values({
    jobId: data.jobId,
    applicantName: data.applicantName,
    email: data.email,
    phone: data.phone,
    country: data.country || null,
    cvFileUrl: data.cvFileUrl || null,
    cvFileKey: data.cvFileKey || null,
  }).returning({ id: jobApplications.id });
  return result[0].id;
}

export async function createJobApplicationAnswers(answers: { applicationId: number; questionId: number; answer: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (answers.length === 0) return;
  await db.insert(jobApplicationAnswers).values(answers);
}

export async function getJobApplications(filters?: { jobId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.jobId) conditions.push(eq(jobApplications.jobId, filters.jobId));
  if (filters?.status) conditions.push(eq(jobApplications.status, filters.status));

  const apps = conditions.length > 0
    ? await db.select().from(jobApplications).where(and(...conditions)).orderBy(desc(jobApplications.submittedAt))
    : await db.select().from(jobApplications).orderBy(desc(jobApplications.submittedAt));

  return apps;
}

export async function getJobApplicationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobApplications).where(eq(jobApplications.id, id)).limit(1);
  return result[0];
}

export async function getJobApplicationAnswers(applicationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobApplicationAnswers).where(eq(jobApplicationAnswers.applicationId, applicationId)).orderBy(jobApplicationAnswers.questionId);
}

export async function updateJobApplicationStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobApplications).set({ status, updatedAt: new Date().toISOString() }).where(eq(jobApplications.id, id));
}

export async function getJobApplicationStats() {
  const db = await getDb();
  if (!db) return { total: 0, new: 0, reviewed: 0, shortlisted: 0, rejected: 0 };
  const all = await db.select({ status: jobApplications.status, count: sql<number>`count(*)` })
    .from(jobApplications).groupBy(jobApplications.status);
  const stats = { total: 0, new: 0, reviewed: 0, shortlisted: 0, rejected: 0 };
  for (const row of all) {
    const c = Number(row.count);
    stats.total += c;
    if (row.status in stats) (stats as any)[row.status] = c;
  }
  return stats;
}

// ============================================================================
// Global Search (Phase 3)
// ============================================================================

export async function globalSearch(query: string, limit: number = 20) {
  const db = await getDb();
  if (!db || !query.trim()) return { courses: [], packages: [], articles: [], events: [] };
  const q = `%${query.trim()}%`;

  const [matchedCourses, matchedPackages, matchedArticles, matchedEvents] = await Promise.all([
    db.select({
      id: courses.id, titleEn: courses.titleEn, titleAr: courses.titleAr,
      descriptionEn: courses.descriptionEn, thumbnailUrl: courses.thumbnailUrl,
      isPublished: courses.isPublished,
    }).from(courses).where(
      and(eq(courses.isPublished, true), or(
        sql`${courses.titleEn} LIKE ${q}`, sql`${courses.titleAr} LIKE ${q}`,
        sql`${courses.descriptionEn} LIKE ${q}`, sql`${courses.descriptionAr} LIKE ${q}`,
      ))
    ).limit(limit),

    db.select({
      id: packages.id, slug: packages.slug, nameEn: packages.nameEn, nameAr: packages.nameAr,
      descriptionEn: packages.descriptionEn, price: packages.price,
      isPublished: packages.isPublished,
    }).from(packages).where(
      and(eq(packages.isPublished, true), or(
        sql`${packages.nameEn} LIKE ${q}`, sql`${packages.nameAr} LIKE ${q}`,
        sql`${packages.descriptionEn} LIKE ${q}`, sql`${packages.descriptionAr} LIKE ${q}`,
      ))
    ).limit(limit),

    db.select({
      id: articles.id, slug: articles.slug, titleEn: articles.titleEn, titleAr: articles.titleAr,
      isPublished: articles.isPublished,
    }).from(articles).where(
      and(eq(articles.isPublished, true), or(
        sql`${articles.titleEn} LIKE ${q}`, sql`${articles.titleAr} LIKE ${q}`,
        sql`${articles.contentEn} LIKE ${q}`, sql`${articles.contentAr} LIKE ${q}`,
      ))
    ).limit(limit),

    db.select({
      id: events.id, titleEn: events.titleEn, titleAr: events.titleAr,
      eventType: events.eventType, eventDate: events.eventDate,
      isPublished: events.isPublished,
    }).from(events).where(
      and(eq(events.isPublished, true), or(
        sql`${events.titleEn} LIKE ${q}`, sql`${events.titleAr} LIKE ${q}`,
        sql`${events.descriptionEn} LIKE ${q}`, sql`${events.descriptionAr} LIKE ${q}`,
      ))
    ).limit(limit),
  ]);

  return { courses: matchedCourses, packages: matchedPackages, articles: matchedArticles, events: matchedEvents };
}

export async function adminGlobalSearch(query: string, limit: number = 20) {
  const db = await getDb();
  if (!db || !query.trim()) return { users: [], orders: [], courses: [], articles: [], keys: [] };
  const q = `%${query.trim()}%`;

  const [matchedUsers, matchedOrders, matchedCourses, matchedArticles, matchedKeys] = await Promise.all([
    db.select({
      id: users.id, email: users.email, name: users.name, phone: users.phone,
    }).from(users).where(
      or(sql`${users.email} LIKE ${q}`, sql`${users.name} LIKE ${q}`, sql`${users.phone} LIKE ${q}`)
    ).limit(limit),

    db.select({
      id: orders.id, userId: orders.userId, status: orders.status,
      totalAmount: orders.totalAmount, createdAt: orders.createdAt,
    }).from(orders).where(
      or(sql`CAST(${orders.id} AS TEXT) LIKE ${q}`, sql`${orders.status} LIKE ${q}`)
    ).limit(limit),

    db.select({
      id: courses.id, titleEn: courses.titleEn, titleAr: courses.titleAr, isPublished: courses.isPublished,
    }).from(courses).where(
      or(sql`${courses.titleEn} LIKE ${q}`, sql`${courses.titleAr} LIKE ${q}`)
    ).limit(limit),

    db.select({
      id: articles.id, slug: articles.slug, titleEn: articles.titleEn, titleAr: articles.titleAr,
    }).from(articles).where(
      or(sql`${articles.titleEn} LIKE ${q}`, sql`${articles.titleAr} LIKE ${q}`)
    ).limit(limit),

    db.select({
      id: registrationKeys.id, keyCode: registrationKeys.keyCode, email: registrationKeys.email,
      isActive: registrationKeys.isActive,
    }).from(registrationKeys).where(
      or(sql`${registrationKeys.keyCode} LIKE ${q}`, sql`${registrationKeys.email} LIKE ${q}`)
    ).limit(limit),
  ]);

  return { users: matchedUsers, orders: matchedOrders, courses: matchedCourses, articles: matchedArticles, keys: matchedKeys };
}

// ============================================================================
// Course Reviews (Phase 4)
// ============================================================================

export async function getCourseReviews(courseId: number, approvedOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(courseReviews.courseId, courseId)];
  if (approvedOnly) conditions.push(eq(courseReviews.isApproved, true));
  const rows = await db.select({
    id: courseReviews.id, userId: courseReviews.userId, courseId: courseReviews.courseId,
    rating: courseReviews.rating, comment: courseReviews.comment,
    isApproved: courseReviews.isApproved, createdAt: courseReviews.createdAt,
    userName: users.name, userEmail: users.email,
  }).from(courseReviews)
    .leftJoin(users, eq(courseReviews.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(courseReviews.createdAt));
  return rows;
}

export async function getAllReviews(filters?: { courseId?: number; isApproved?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.courseId) conditions.push(eq(courseReviews.courseId, filters.courseId));
  if (filters?.isApproved !== undefined) conditions.push(eq(courseReviews.isApproved, filters.isApproved));
  return db.select({
    id: courseReviews.id, userId: courseReviews.userId, courseId: courseReviews.courseId,
    rating: courseReviews.rating, comment: courseReviews.comment,
    isApproved: courseReviews.isApproved, createdAt: courseReviews.createdAt, updatedAt: courseReviews.updatedAt,
    userName: users.name, userEmail: users.email,
    courseTitleEn: courses.titleEn, courseTitleAr: courses.titleAr,
  }).from(courseReviews)
    .leftJoin(users, eq(courseReviews.userId, users.id))
    .leftJoin(courses, eq(courseReviews.courseId, courses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(courseReviews.createdAt));
}

export async function createCourseReview(review: { userId: number; courseId: number; rating: number; comment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date().toISOString();
  const [row] = await db.insert(courseReviews).values({
    userId: review.userId, courseId: review.courseId,
    rating: review.rating, comment: review.comment || null,
    isApproved: false, createdAt: now, updatedAt: now,
  }).returning();
  return row;
}

export async function updateReviewApproval(reviewId: number, isApproved: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courseReviews).set({ isApproved, updatedAt: new Date().toISOString() }).where(eq(courseReviews.id, reviewId));
}

export async function deleteReview(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(courseReviews).where(eq(courseReviews.id, reviewId));
}

export async function getCourseAverageRating(courseId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const [result] = await db.select({
    avg: sql<number>`COALESCE(AVG(${courseReviews.rating}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(courseReviews).where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.isApproved, true)));
  return { average: Number(result?.avg ?? 0), count: Number(result?.count ?? 0) };
}

// ============================================================================
// User Notifications (Phase 4)
// ============================================================================

export async function getUserNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)));
  return Number(result?.count ?? 0);
}

export async function createNotification(notif: {
  userId: number; type?: string; titleEn: string; titleAr: string;
  contentEn?: string; contentAr?: string; actionUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(userNotifications).values({
    ...notif, type: notif.type || 'info', createdAt: new Date().toISOString(),
  }).returning();
  return row;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userNotifications).set({ isRead: true })
    .where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userNotifications).set({ isRead: true })
    .where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)));
}

export async function sendBulkNotification(input: {
  userIds: number[]; type?: string; titleEn: string; titleAr: string;
  contentEn?: string; contentAr?: string; actionUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date().toISOString();
  const values = input.userIds.map(userId => ({
    userId, type: input.type || 'info', titleEn: input.titleEn, titleAr: input.titleAr,
    contentEn: input.contentEn, contentAr: input.contentAr, actionUrl: input.actionUrl,
    createdAt: now,
  }));
  if (values.length) await db.insert(userNotifications).values(values);
}

// ============================================================================
// Loyalty Points (Phase 4)
// ============================================================================

export async function getPointsBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [user] = await db.select({ pointsBalance: users.pointsBalance }).from(users).where(eq(users.id, userId));
  return Number(user?.pointsBalance ?? 0);
}

export async function getPointsHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointsTransactions)
    .where(eq(pointsTransactions.userId, userId))
    .orderBy(desc(pointsTransactions.createdAt))
    .limit(limit);
}

export async function addPoints(input: {
  userId: number; amount: number; type?: string;
  reasonEn: string; reasonAr: string;
  referenceId?: number; referenceType?: string;
}): Promise<PointsTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [tx] = await db.insert(pointsTransactions).values({
    userId: input.userId, amount: input.amount, type: input.type || 'earn',
    reasonEn: input.reasonEn, reasonAr: input.reasonAr,
    referenceId: input.referenceId, referenceType: input.referenceType,
    createdAt: new Date().toISOString(),
  }).returning();
  await db.update(users).set({
    pointsBalance: sql`${users.pointsBalance} + ${input.amount}`,
  }).where(eq(users.id, input.userId));
  return tx;
}

export async function redeemPoints(input: {
  userId: number; amount: number;
  reasonEn: string; reasonAr: string;
  referenceId?: number; referenceType?: string;
}): Promise<PointsTransaction | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getPointsBalance(input.userId);
  if (balance < input.amount) return null;
  const [tx] = await db.insert(pointsTransactions).values({
    userId: input.userId, amount: -input.amount, type: 'redeem',
    reasonEn: input.reasonEn, reasonAr: input.reasonAr,
    referenceId: input.referenceId, referenceType: input.referenceType,
    createdAt: new Date().toISOString(),
  }).returning();
  await db.update(users).set({
    pointsBalance: sql`${users.pointsBalance} - ${input.amount}`,
  }).where(eq(users.id, input.userId));
  return tx;
}

export async function getTopPointsUsers(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id, name: users.name, email: users.email,
    pointsBalance: users.pointsBalance,
  }).from(users)
    .where(sql`${users.pointsBalance} > 0`)
    .orderBy(desc(users.pointsBalance))
    .limit(limit);
}

// ============================================================================
// Engagement Tracking (Phase 4)
// ============================================================================

export async function trackEngagement(input: {
  userId: number; eventType: string; entityType?: string;
  entityId?: number; metadata?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(engagementEvents).values({
    userId: input.userId, eventType: input.eventType,
    entityType: input.entityType, entityId: input.entityId,
    metadata: input.metadata, createdAt: new Date().toISOString(),
  });
}

export async function getEngagementSummary(days = 30) {
  const db = await getDb();
  if (!db) return { totalEvents: 0, uniqueUsers: 0, byType: [] as any[] };
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const [totals] = await db.select({
    totalEvents: sql<number>`COUNT(*)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${engagementEvents.userId})`,
  }).from(engagementEvents).where(sql`${engagementEvents.createdAt} >= ${cutoff}`);

  const byType = await db.select({
    eventType: engagementEvents.eventType,
    count: sql<number>`COUNT(*)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${engagementEvents.userId})`,
  }).from(engagementEvents)
    .where(sql`${engagementEvents.createdAt} >= ${cutoff}`)
    .groupBy(engagementEvents.eventType)
    .orderBy(sql`COUNT(*) DESC`);

  return {
    totalEvents: Number(totals?.totalEvents ?? 0),
    uniqueUsers: Number(totals?.uniqueUsers ?? 0),
    byType: byType.map(r => ({ eventType: r.eventType, count: Number(r.count), uniqueUsers: Number(r.uniqueUsers) })),
  };
}

export async function getUserEngagementTimeline(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(engagementEvents)
    .where(eq(engagementEvents.userId, userId))
    .orderBy(desc(engagementEvents.createdAt))
    .limit(limit);
}

export async function getEngagementByEntity(entityType: string, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return db.select({
    entityId: engagementEvents.entityId,
    count: sql<number>`COUNT(*)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${engagementEvents.userId})`,
  }).from(engagementEvents)
    .where(and(
      eq(engagementEvents.entityType, entityType),
      sql`${engagementEvents.createdAt} >= ${cutoff}`,
    ))
    .groupBy(engagementEvents.entityId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(30);
}