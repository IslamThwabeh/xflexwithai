import { eq, desc, and, or, sql, ne, inArray, isNotNull, isNull, gte } from "drizzle-orm";
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
  recommendationAlerts, RecommendationAlert, InsertRecommendationAlert,
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
  bugReports, BugReport,
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
  brokers, Broker, NewBroker,
  referrals, Referral, NewReferral,
  pointsRules, PointsRule, NewPointsRule,
  offerAgreements, OfferAgreement, InsertOfferAgreement,
  adminActions, AdminAction, InsertAdminAction,
  brokerOnboarding, BrokerOnboarding, InsertBrokerOnboarding,
  emailLog, EmailLog, InsertEmailLog,
  planProgress, PlanProgress, InsertPlanProgress,
  lexaiSupportCases, LexaiSupportCase, InsertLexaiSupportCase,
  lexaiSupportNotes, LexaiSupportNote, InsertLexaiSupportNote,
  staffNotifications, StaffNotification, InsertStaffNotification,
  adminSettings, AdminSetting, InsertAdminSetting,
  staffActionLogs, staffSessions,
} from "../database/schema-sqlite.ts";
import { ENV } from './_core/env';
import { logger } from './_core/logger';
import { sendWelcomeEmail, sendMilestoneEmail, sendQuizFeedbackEmail, sendStaffAlertEmail } from './_core/orderEmails';
import {
  BUG_REPORT_RISK_LEVELS,
  IDLE_TIMEOUT_STAFF_MS,
  STAFF_NOTIFICATION_EVENTS,
  type BugReportRiskLevel,
  type BugReportStatus,
  type StaffNotificationEventType,
} from '../shared/const';

let _db: ReturnType<typeof drizzle> | null = null;

const DEFAULT_KEY_ENTITLEMENT_DAYS = 30;
const DEFAULT_STUDY_PERIOD_DAYS = 14;
const RECOMMENDATION_ALERT_UNLOCK_MS = 60 * 1000;
const RECOMMENDATION_ALERT_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Get the configurable study period (فترة التعلم) from admin settings.
 * This is the grace period before LexAI/Rec auto-activate.
 */
export async function getStudyPeriodDays(): Promise<number> {
  const val = await getAdminSetting('study_period_days');
  if (val) {
    const parsed = parseInt(val, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 60) return parsed;
  }
  return DEFAULT_STUDY_PERIOD_DAYS;
}

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

/**
 * Look up actual entitlement days for a user from their most recent activated key → package.
 * Keys can have custom durations (15, 45, etc.) — never assume 30.
 */
async function getUserEntitlementDays(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return DEFAULT_KEY_ENTITLEMENT_DAYS;

  // Get user email to find their key
  const [user] = await db.select({ email: users.email }).from(users)
    .where(eq(users.id, userId)).limit(1);
  if (!user?.email) return DEFAULT_KEY_ENTITLEMENT_DAYS;

  // Find the latest activated package key for this user
  const [key] = await db.select({
    entitlementDays: registrationKeys.entitlementDays,
    packageId: registrationKeys.packageId,
  }).from(registrationKeys)
    .where(and(
      sql`LOWER(${registrationKeys.email}) = LOWER(${user.email})`,
      sql`${registrationKeys.activatedAt} IS NOT NULL`,
      sql`${registrationKeys.packageId} IS NOT NULL`,
    ))
    .orderBy(desc(registrationKeys.activatedAt))
    .limit(1);

  if (!key) return DEFAULT_KEY_ENTITLEMENT_DAYS;

  // Key's custom entitlement days take priority
  const keyDays = normalizePositiveInteger(key.entitlementDays);
  if (keyDays) return keyDays;

  // Fallback to the package's configured duration
  if (key.packageId) {
    const pkg = await getPackageById(key.packageId);
    return normalizePositiveInteger(pkg?.durationDays) ?? DEFAULT_KEY_ENTITLEMENT_DAYS;
  }

  return DEFAULT_KEY_ENTITLEMENT_DAYS;
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

type TimedServiceSubscriptionSnapshot = {
  isActive: boolean;
  isPaused: boolean;
  isPendingActivation: boolean;
  endDate: string | null;
  pausedRemainingDays: number | null;
  maxActivationDate?: string | null;
};

function getTimedServiceSubscriptionState(subscription?: TimedServiceSubscriptionSnapshot | null) {
  if (!subscription) return "no_subscription";
  if (subscription.isPendingActivation) return "pending_activation";
  if (subscription.isPaused) return "paused";
  if (!subscription.isActive) return "inactive";
  if (subscription.endDate && new Date(subscription.endDate).getTime() < Date.now()) return "expired";
  return "active";
}

function getTimedServiceRemainingDays(subscription?: TimedServiceSubscriptionSnapshot | null) {
  if (!subscription) return 0;
  if (subscription.isPaused) {
    return normalizePositiveInteger(subscription.pausedRemainingDays) ?? 0;
  }
  if (!subscription.endDate) return 0;
  return getRemainingDaysUntil(subscription.endDate);
}

function getTimedServiceActivationDeadlineDays(subscription?: TimedServiceSubscriptionSnapshot | null) {
  if (!subscription?.maxActivationDate || !subscription.isPendingActivation) return 0;
  return getRemainingDaysUntil(subscription.maxActivationDate);
}

type LexaiSupportCaseStatus = "open" | "waiting_student" | "escalated" | "resolved";
type LexaiSupportCasePriority = "normal" | "high" | "urgent";

type LexaiSupportSubscriptionSnapshot = {
  id: number;
  isActive: boolean;
  isPaused: boolean;
  isPendingActivation: boolean;
  endDate: string | null;
  pausedRemainingDays: number | null;
  pausedReason: string | null;
  maxActivationDate: string | null;
  messagesUsed: number;
};

function getLexaiSupportSubscriptionState(subscription?: LexaiSupportSubscriptionSnapshot | null) {
  return getTimedServiceSubscriptionState(subscription);
}

function getLexaiSupportRemainingDays(subscription?: LexaiSupportSubscriptionSnapshot | null) {
  return getTimedServiceRemainingDays(subscription);
}

function getLexaiSupportActivationDeadlineDays(subscription?: LexaiSupportSubscriptionSnapshot | null) {
  return getTimedServiceActivationDeadlineDays(subscription);
}

function getLexaiSupportPriorityRank(priority: LexaiSupportCasePriority) {
  switch (priority) {
    case "urgent":
      return 3;
    case "high":
      return 2;
    default:
      return 1;
  }
}

function getLexaiSupportPriorityForExpiry(daysLeft: number): LexaiSupportCasePriority {
  if (daysLeft <= 0) return "urgent";
  if (daysLeft <= 3) return "high";
  return "normal";
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
 * Touch user's last real interaction timestamp.
 * This is separate from authenticated request activity, which may be driven by polling.
 */
export async function touchUserInteraction(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users)
      .set({ lastInteractiveAt: new Date().toISOString() })
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

/**
 * Skip course for a user — sets isAdminSkipped flag WITHOUT touching episode progress.
 * The student's real progress is preserved for rollback.
 * Immediately activates pending LexAI/Rec subscriptions (starts the 30-day timer).
 */
export async function skipCourseForUser(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get or create enrollment
  let enrollment = await getEnrollment(userId, courseId);
  if (!enrollment) {
    await createEnrollment({
      userId,
      courseId,
      paymentStatus: 'completed',
    });
    enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      throw new Error("Failed to create enrollment for skip action");
    }
  }

  if (enrollment.isAdminSkipped) {
    throw new Error("Course is already skipped for this user");
  }

  // Set the admin-skipped flag + mark as completed — do NOT touch individual episodes
  await updateEnrollment(enrollment.id, {
    isAdminSkipped: true,
    completedAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  });

  // Course completion has ZERO effect on LexAI/Rec activation — broker is the only gate

  return {
    enrollmentId: enrollment.id,
    previousProgress: enrollment.progressPercentage ?? 0,
    activated: false,
  };
}

/**
 * Rollback a skipped course — clears the admin-skip flag, restores pending subscriptions.
 * The student's real episode progress is untouched (preserved during skip).
 */
export async function rollbackSkipCourse(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const enrollment = await getEnrollment(userId, courseId);
  if (!enrollment) throw new Error("No enrollment found");
  if (!enrollment.isAdminSkipped) throw new Error("Course was not skipped");

  // Clear the skip flag + completedAt (unless they actually completed on their own)
  const genuinelyCompleted = (enrollment.progressPercentage ?? 0) >= 100;
  await updateEnrollment(enrollment.id, {
    isAdminSkipped: false,
    completedAt: genuinelyCompleted ? enrollment.completedAt : null,
  });

  // Course rollback has ZERO effect on LexAI/Rec — broker is the only gate

  return { enrollmentId: enrollment.id, restoredProgress: enrollment.progressPercentage ?? 0 };
}

/**
 * Deactivate student subscriptions back to pending state (reversal of activateStudentSubscriptions).
 * Used when rolling back an admin skip.
 */
async function deactivateStudentSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const entitlementDays = await getUserEntitlementDays(userId);
  const maxActivationDate = buildEndDateFromDays(now, 14).toISOString();
  const placeholderEndDate = buildEndDateFromDays(now, 14 + entitlementDays).toISOString();

  // Find recently activated (non-pending) LexAI sub
  const [lexaiSub] = await db.select().from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.userId, userId),
      eq(lexaiSubscriptions.isActive, true),
      eq(lexaiSubscriptions.isPendingActivation, false),
    ))
    .orderBy(desc(lexaiSubscriptions.createdAt))
    .limit(1);

  if (lexaiSub) {
    await db.update(lexaiSubscriptions).set({
      isPendingActivation: true,
      studentActivatedAt: null,
      maxActivationDate,
      startDate: now.toISOString(),
      endDate: placeholderEndDate,
      updatedAt: now.toISOString(),
    }).where(eq(lexaiSubscriptions.id, lexaiSub.id));
  }

  // Find recently activated (non-pending) Rec sub
  const [recSub] = await db.select().from(recommendationSubscriptions)
    .where(and(
      eq(recommendationSubscriptions.userId, userId),
      eq(recommendationSubscriptions.isActive, true),
      eq(recommendationSubscriptions.isPendingActivation, false),
    ))
    .orderBy(desc(recommendationSubscriptions.createdAt))
    .limit(1);

  if (recSub) {
    await db.update(recommendationSubscriptions).set({
      isPendingActivation: true,
      studentActivatedAt: null,
      maxActivationDate,
      startDate: now.toISOString(),
      endDate: placeholderEndDate,
      updatedAt: now.toISOString(),
    }).where(eq(recommendationSubscriptions.id, recSub.id));
  }
}

// ============================================================================
// Admin Actions (Audit Trail)
// ============================================================================

function parseOptionalJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function coerceTimestampToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1000);
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getStaffSessionLastActivityAt(loginAt: Date, lastActiveAt: unknown) {
  const parsedLastActiveAt = coerceTimestampToDate(lastActiveAt);
  if (!parsedLastActiveAt || parsedLastActiveAt.getTime() < loginAt.getTime()) {
    return loginAt;
  }

  return parsedLastActiveAt;
}

function mapStaffSessionRow<T extends {
  loginAt: unknown;
  logoutAt: unknown;
  durationSeconds: number | null;
  lastActiveAt?: unknown;
}>(row: T, now: Date = new Date()) {
  const loginAt = coerceTimestampToDate(row.loginAt) ?? new Date(0);
  const logoutAt = coerceTimestampToDate(row.logoutAt);
  const lastActiveAt = getStaffSessionLastActivityAt(loginAt, row.lastActiveAt);
  const sessionExpiresAt = logoutAt ? null : new Date(lastActiveAt.getTime() + IDLE_TIMEOUT_STAFF_MS);
  const timedOutAt = !logoutAt && sessionExpiresAt && sessionExpiresAt.getTime() <= now.getTime()
    ? sessionExpiresAt
    : null;
  const effectiveLogoutAt = logoutAt ?? timedOutAt;
  const fallbackDurationSeconds = Math.max(
    0,
    Math.floor(((effectiveLogoutAt ?? now).getTime() - loginAt.getTime()) / 1000),
  );
  const currentDurationSeconds = Number(row.durationSeconds ?? fallbackDurationSeconds ?? 0);

  return {
    ...row,
    loginAt,
    logoutAt,
    lastActiveAt,
    sessionExpiresAt,
    timedOutAt,
    effectiveLogoutAt,
    currentDurationSeconds,
    isActive: !effectiveLogoutAt,
    status: effectiveLogoutAt ? (logoutAt ? "closed" : "timed_out") : "active",
  };
}

export async function logAdminAction(adminId: number, userId: number, action: string, details?: Record<string, any>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminActions).values({
    adminId,
    userId,
    action,
    details: details ? JSON.stringify(details) : null,
    createdAt: new Date().toISOString(),
  });
}

export async function getAdminActionsForUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: adminActions.id,
      adminId: adminActions.adminId,
      adminName: users.name,
      userId: adminActions.userId,
      action: adminActions.action,
      details: adminActions.details,
      createdAt: adminActions.createdAt,
    })
    .from(adminActions)
    .leftJoin(users, eq(adminActions.adminId, users.id))
    .where(eq(adminActions.userId, userId))
    .orderBy(desc(adminActions.createdAt))
    .limit(limit);
  return rows.map(r => ({
    ...r,
    details: parseOptionalJson(r.details),
  }));
}

// ============================================================================
// Staff Monitoring
// ============================================================================

export async function logStaffAction(input: {
  staffUserId: number;
  actionType: string;
  resourceType?: string | null;
  resourceId?: number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(staffActionLogs).values({
    staffUserId: input.staffUserId,
    actionType: input.actionType,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    details: input.details ? JSON.stringify(input.details) : null,
    ipAddress: input.ipAddress?.trim() ? input.ipAddress.trim().slice(0, 255) : null,
    createdAt: input.createdAt ?? new Date(),
  });
}

export async function startStaffSession(input: {
  staffUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  loginAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  const loginAt = input.loginAt ?? new Date();
  const openSessions = await db
    .select({
      id: staffSessions.id,
      loginAt: staffSessions.loginAt,
    })
    .from(staffSessions)
    .where(and(
      eq(staffSessions.staffUserId, input.staffUserId),
      isNull(staffSessions.logoutAt),
    ))
    .orderBy(desc(staffSessions.loginAt));

  for (const openSession of openSessions) {
    const openedAt = new Date(openSession.loginAt);
    const durationSeconds = Math.max(
      0,
      Math.floor((loginAt.getTime() - openedAt.getTime()) / 1000),
    );

    await db.update(staffSessions).set({
      logoutAt: loginAt,
      durationSeconds,
    }).where(eq(staffSessions.id, openSession.id));
  }

  const [session] = await db.insert(staffSessions).values({
    staffUserId: input.staffUserId,
    loginAt,
    ipAddress: input.ipAddress?.trim() ? input.ipAddress.trim().slice(0, 255) : null,
    userAgent: input.userAgent?.trim() ? input.userAgent.trim().slice(0, 1000) : null,
  }).returning();

  return session ?? null;
}

export async function endActiveStaffSessions(staffUserId: number, logoutAt: Date = new Date()) {
  const db = await getDb();
  if (!db) return { closedCount: 0 };

  const openSessions = await db
    .select({
      id: staffSessions.id,
      loginAt: staffSessions.loginAt,
    })
    .from(staffSessions)
    .where(and(
      eq(staffSessions.staffUserId, staffUserId),
      isNull(staffSessions.logoutAt),
    ))
    .orderBy(desc(staffSessions.loginAt));

  for (const openSession of openSessions) {
    const openedAt = new Date(openSession.loginAt);
    const durationSeconds = Math.max(
      0,
      Math.floor((logoutAt.getTime() - openedAt.getTime()) / 1000),
    );

    await db.update(staffSessions).set({
      logoutAt,
      durationSeconds,
    }).where(eq(staffSessions.id, openSession.id));
  }

  return { closedCount: openSessions.length };
}

export async function listStaffActionLogs(options: {
  limit?: number;
  days?: number;
  staffUserId?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const filters = [] as any[];

  if (options.days && options.days > 0) {
    const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
    filters.push(gte(staffActionLogs.createdAt, since));
  }

  if (options.staffUserId) {
    filters.push(eq(staffActionLogs.staffUserId, options.staffUserId));
  }

  const baseQuery = db.select({
    id: staffActionLogs.id,
    staffUserId: staffActionLogs.staffUserId,
    staffName: users.name,
    staffEmail: users.email,
    actionType: staffActionLogs.actionType,
    resourceType: staffActionLogs.resourceType,
    resourceId: staffActionLogs.resourceId,
    details: staffActionLogs.details,
    ipAddress: staffActionLogs.ipAddress,
    createdAt: staffActionLogs.createdAt,
  }).from(staffActionLogs)
    .leftJoin(users, eq(staffActionLogs.staffUserId, users.id));

  const rows = filters.length > 0
    ? await baseQuery.where(filters.length === 1 ? filters[0] : and(...filters)).orderBy(desc(staffActionLogs.createdAt)).limit(limit)
    : await baseQuery.orderBy(desc(staffActionLogs.createdAt)).limit(limit);

  return rows.map((row) => ({
    ...row,
    details: parseOptionalJson<Record<string, unknown>>(row.details),
  }));
}

export async function listStaffSessions(options: {
  limit?: number;
  days?: number;
  staffUserId?: number;
  status?: "all" | "active" | "closed";
} = {}) {
  const db = await getDb();
  if (!db) return [];

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const filters = [] as any[];

  if (options.days && options.days > 0) {
    const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
    filters.push(gte(staffSessions.loginAt, since));
  }

  if (options.staffUserId) {
    filters.push(eq(staffSessions.staffUserId, options.staffUserId));
  }

  const rawLimit = options.status && options.status !== "all"
    ? Math.min(Math.max(limit * 4, 100), 800)
    : limit;

  const baseQuery = db.select({
    id: staffSessions.id,
    staffUserId: staffSessions.staffUserId,
    staffName: users.name,
    staffEmail: users.email,
    loginAt: staffSessions.loginAt,
    logoutAt: staffSessions.logoutAt,
    durationSeconds: staffSessions.durationSeconds,
    ipAddress: staffSessions.ipAddress,
    userAgent: staffSessions.userAgent,
    createdAt: staffSessions.createdAt,
    lastActiveAt: users.lastActiveAt,
  }).from(staffSessions)
    .leftJoin(users, eq(staffSessions.staffUserId, users.id));

  const rows = filters.length > 0
    ? await baseQuery.where(filters.length === 1 ? filters[0] : and(...filters)).orderBy(desc(staffSessions.loginAt)).limit(rawLimit)
    : await baseQuery.orderBy(desc(staffSessions.loginAt)).limit(rawLimit);

  const mappedRows = rows.map((row) => mapStaffSessionRow(row));
  const filteredRows = mappedRows.filter((row) => {
    if (options.status === "active") return row.isActive;
    if (options.status === "closed") return !row.isActive;
    return true;
  });

  return filteredRows.slice(0, limit);
}

export async function getStaffMonitoringBreakdown(days = 14) {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [staffRows, actionRows, sessionRows] = await Promise.all([
    getStaffMembers(),
    db.select({
      staffUserId: staffActionLogs.staffUserId,
      actionCount: sql<number>`COUNT(*)`,
      lastActionAt: sql<number | null>`MAX(${staffActionLogs.createdAt})`,
    })
      .from(staffActionLogs)
      .where(gte(staffActionLogs.createdAt, since))
      .groupBy(staffActionLogs.staffUserId),
    db.select({
      id: staffSessions.id,
      staffUserId: staffSessions.staffUserId,
      loginAt: staffSessions.loginAt,
      logoutAt: staffSessions.logoutAt,
      durationSeconds: staffSessions.durationSeconds,
      lastActiveAt: users.lastActiveAt,
    })
      .from(staffSessions)
      .leftJoin(users, eq(staffSessions.staffUserId, users.id))
      .where(gte(staffSessions.loginAt, since))
      .orderBy(desc(staffSessions.loginAt)),
  ]);

  const actionsByStaff = new Map(actionRows.map((row) => [
    Number(row.staffUserId),
    {
      actionCount: Number(row.actionCount ?? 0),
      lastActionAt: coerceTimestampToDate(row.lastActionAt),
    },
  ]));

  const sessionsByStaff = new Map<number, {
    sessionCount: number;
    totalSessionSeconds: number;
    averageSessionSeconds: number;
    activeSessionCount: number;
    lastLoginAt: Date | null;
  }>();

  for (const row of sessionRows.map((sessionRow) => mapStaffSessionRow(sessionRow))) {
    const staffUserId = Number(row.staffUserId);
    const current = sessionsByStaff.get(staffUserId) ?? {
      sessionCount: 0,
      totalSessionSeconds: 0,
      averageSessionSeconds: 0,
      activeSessionCount: 0,
      lastLoginAt: null,
    };

    current.sessionCount += 1;
    current.totalSessionSeconds += row.currentDurationSeconds;
    current.activeSessionCount += row.isActive ? 1 : 0;
    if (!current.lastLoginAt || row.loginAt.getTime() > current.lastLoginAt.getTime()) {
      current.lastLoginAt = row.loginAt;
    }

    sessionsByStaff.set(staffUserId, current);
  }

  for (const current of sessionsByStaff.values()) {
    current.averageSessionSeconds = current.sessionCount > 0
      ? Math.round(current.totalSessionSeconds / current.sessionCount)
      : 0;
  }

  return staffRows
    .map((staff) => {
      const actionStats = actionsByStaff.get(staff.id);
      const sessionStats = sessionsByStaff.get(staff.id);

      return {
        staffUserId: staff.id,
        staffName: staff.name,
        staffEmail: staff.email,
        roles: staff.roles,
        actionCount: actionStats?.actionCount ?? 0,
        sessionCount: sessionStats?.sessionCount ?? 0,
        totalSessionSeconds: sessionStats?.totalSessionSeconds ?? 0,
        averageSessionSeconds: sessionStats?.averageSessionSeconds ?? 0,
        activeSessionCount: sessionStats?.activeSessionCount ?? 0,
        isOnline: (sessionStats?.activeSessionCount ?? 0) > 0,
        lastActionAt: actionStats?.lastActionAt ?? null,
        lastLoginAt: sessionStats?.lastLoginAt ?? null,
      };
    })
    .sort((a, b) => {
      if (b.totalSessionSeconds !== a.totalSessionSeconds) {
        return b.totalSessionSeconds - a.totalSessionSeconds;
      }
      if (b.actionCount !== a.actionCount) {
        return b.actionCount - a.actionCount;
      }
      return a.staffEmail.localeCompare(b.staffEmail);
    });
}

export async function getStaffMonitoringSummary(days = 14) {
  const [breakdown, activeSessionRows] = await Promise.all([
    getStaffMonitoringBreakdown(days),
    listStaffSessions({ limit: 200, status: "active" }),
  ]);

  const totals = breakdown.reduce((acc, row) => {
    acc.totalActions += row.actionCount;
    acc.totalSessions += row.sessionCount;
    acc.totalSessionSeconds += row.totalSessionSeconds;
    if (row.actionCount > 0 || row.sessionCount > 0) {
      acc.staffWithActivity += 1;
    }
    return acc;
  }, {
    totalActions: 0,
    totalSessions: 0,
    totalSessionSeconds: 0,
    staffWithActivity: 0,
  });

  return {
    days,
    totalActions: totals.totalActions,
    totalSessions: totals.totalSessions,
    totalSessionSeconds: totals.totalSessionSeconds,
    averageSessionSeconds: totals.totalSessions > 0
      ? Math.round(totals.totalSessionSeconds / totals.totalSessions)
      : 0,
    staffWithActivity: totals.staffWithActivity,
    currentlyOnline: activeSessionRows.length,
    breakdown,
    topByActions: [...breakdown]
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 5),
    topByTime: [...breakdown]
      .sort((a, b) => b.totalSessionSeconds - a.totalSessionSeconds)
      .slice(0, 5),
    activeSessions: activeSessionRows.slice(0, 20),
  };
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
        eq(recommendationSubscriptions.isPendingActivation, false),
        sql`${recommendationSubscriptions.endDate} >= ${nowIso}`
      )
    )
    .orderBy(desc(recommendationSubscriptions.endDate))
    .limit(1);

  return rows[0];
}

/** Returns ANY existing Recommendation subscription for the user (including pending), for create-or-update logic. */
export async function getAnyRecommendationSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(recommendationSubscriptions)
    .where(
      and(
        eq(recommendationSubscriptions.userId, userId),
        eq(recommendationSubscriptions.isActive, true),
      )
    )
    .orderBy(desc(recommendationSubscriptions.endDate))
    .limit(1);
  return rows[0];
}

/** Returns the frozen (paused) Recommendation subscription if one exists, or undefined. */
export async function getFrozenRecommendationSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    id: recommendationSubscriptions.id,
    isPaused: recommendationSubscriptions.isPaused,
    frozenUntil: recommendationSubscriptions.frozenUntil,
    pausedReason: recommendationSubscriptions.pausedReason,
    endDate: recommendationSubscriptions.endDate,
  }).from(recommendationSubscriptions)
    .where(and(
      eq(recommendationSubscriptions.userId, userId),
      eq(recommendationSubscriptions.isActive, true),
      eq(recommendationSubscriptions.isPaused, true),
    ))
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
export async function getExpiringSubscriptions(withinDays: number): Promise<{ userId: number; email: string; name: string | null; daysLeft: number; packageName: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const futureStr = futureDate.toISOString().slice(0, 10);

  // Find lexai/rec subscriptions with endDate between today and futureDate
  // (packageSubscriptions have no expiry — course is forever)
  const expiringLexai = await db
    .select({
      userId: lexaiSubscriptions.userId,
      endDate: lexaiSubscriptions.endDate,
    })
    .from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.isActive, true),
      eq(lexaiSubscriptions.isPendingActivation, false),
      sql`date(${lexaiSubscriptions.endDate}) >= ${todayStr}`,
      sql`date(${lexaiSubscriptions.endDate}) <= ${futureStr}`,
    ));

  const expiringRec = await db
    .select({
      userId: recommendationSubscriptions.userId,
      endDate: recommendationSubscriptions.endDate,
    })
    .from(recommendationSubscriptions)
    .where(and(
      eq(recommendationSubscriptions.isActive, true),
      eq(recommendationSubscriptions.isPendingActivation, false),
      sql`date(${recommendationSubscriptions.endDate}) >= ${todayStr}`,
      sql`date(${recommendationSubscriptions.endDate}) <= ${futureStr}`,
    ));

  // Merge unique userIds from both tables
  const expiringUserMap = new Map<number, { userId: number; endDate: string }>();
  for (const sub of [...expiringLexai, ...expiringRec]) {
    const existing = expiringUserMap.get(sub.userId);
    if (!existing || new Date(sub.endDate) < new Date(existing.endDate)) {
      expiringUserMap.set(sub.userId, { userId: sub.userId, endDate: sub.endDate });
    }
  }
  const expiring = Array.from(expiringUserMap.values());

  const results: { userId: number; email: string; name: string | null; daysLeft: number; packageName: string }[] = [];
  for (const sub of expiring) {
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, sub.userId)).limit(1);
    if (!user?.email) continue;
    // Look up the user's active package for display name
    const [pkgSub] = await db.select({ packageId: packageSubscriptions.packageId })
      .from(packageSubscriptions)
      .where(and(eq(packageSubscriptions.userId, sub.userId), eq(packageSubscriptions.isActive, true)))
      .limit(1);
    const pkg = pkgSub ? await getPackageById(pkgSub.packageId) : null;
    const endMs = new Date(sub.endDate).getTime();
    const daysLeft = Math.ceil((endMs - now.getTime()) / (1000 * 60 * 60 * 24));
    results.push({
      userId: sub.userId,
      email: user.email,
      name: user.name,
      daysLeft: Math.max(0, daysLeft),
      packageName: pkg?.nameEn ?? 'Subscription',
    });
  }
  return results;
}

/**
 * Get active, non-paused LexAI subscriptions expiring within a given number of days.
 * Used by the daily cron to route LexAI-specific support alerts.
 */
export async function getExpiringLexaiSubscriptions(withinDays: number): Promise<Array<{
  userId: number;
  email: string;
  name: string | null;
  endDate: string;
  daysLeft: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);
  const futureStr = futureDate.toISOString().slice(0, 10);

  const rows = await db
    .select({
      userId: lexaiSubscriptions.userId,
      email: users.email,
      name: users.name,
      endDate: lexaiSubscriptions.endDate,
    })
    .from(lexaiSubscriptions)
    .innerJoin(users, eq(lexaiSubscriptions.userId, users.id))
    .where(and(
      eq(lexaiSubscriptions.isActive, true),
      eq(lexaiSubscriptions.isPaused, false),
      eq(lexaiSubscriptions.isPendingActivation, false),
      eq(users.isStaff, false),
      sql`date(${lexaiSubscriptions.endDate}) >= ${todayStr}`,
      sql`date(${lexaiSubscriptions.endDate}) <= ${futureStr}`,
    ))
    .orderBy(lexaiSubscriptions.endDate);

  const earliestByUser = new Map<number, typeof rows[number]>();
  for (const row of rows) {
    const existing = earliestByUser.get(row.userId);
    if (!existing || new Date(row.endDate).getTime() < new Date(existing.endDate).getTime()) {
      earliestByUser.set(row.userId, row);
    }
  }

  const results: Array<{
    userId: number;
    email: string;
    name: string | null;
    endDate: string;
    daysLeft: number;
  }> = [];

  for (const row of earliestByUser.values()) {
    if (!row.email) continue;
    const endMs = new Date(row.endDate).getTime();
    const daysLeft = Math.ceil((endMs - now.getTime()) / (1000 * 60 * 60 * 24));
    results.push({
      userId: row.userId,
      email: row.email,
      name: row.name,
      endDate: row.endDate,
      daysLeft: Math.max(0, daysLeft),
    });
  }

  return results;
}

export async function getRecommendationPublishers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(eq(userRoles.role, 'analyst'))
    .orderBy(users.name, users.email);
}

export async function getUserRecommendationsAccess(userId: number) {
  const db = await getDb();
  if (!db) return { canPublish: false, hasSubscription: false, subscription: null as RecommendationSubscription | null, isFrozen: false, frozenUntil: null as string | null, frozenReason: null as string | null };

  const canPublish = await hasRole(userId, 'analyst');
  const subscription = await getActiveRecommendationSubscription(userId);

  let isFrozen = false;
  let frozenUntil: string | null = null;
  let frozenReason: string | null = null;
  if (!subscription) {
    const frozen = await getFrozenRecommendationSubscription(userId);
    if (frozen) {
      isFrozen = true;
      frozenUntil = frozen.frozenUntil ?? null;
      frozenReason = frozen.pausedReason ?? null;
    }
  }

  return {
    canPublish,
    hasSubscription: !!subscription,
    subscription: subscription ?? null,
    isFrozen,
    frozenUntil,
    frozenReason,
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
        eq(recommendationSubscriptions.isPendingActivation, false),
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
export type RecommendationSubscriberDetail = {
  userId: number;
  email: string;
  lastActiveAt: string | null;
  lastInteractiveAt: string | null;
  notificationPrefs: string | null;
};

export async function getRecommendationSubscriberDetails(): Promise<RecommendationSubscriberDetail[]> {
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
        eq(recommendationSubscriptions.isPendingActivation, false),
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
      lastInteractiveAt: users.lastInteractiveAt,
      notificationPrefs: users.notificationPrefs,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  return rows
    .filter(r => r.email)
    .map(r => ({
      userId: r.id,
      email: r.email,
      lastActiveAt: r.lastActiveAt,
      lastInteractiveAt: r.lastInteractiveAt,
      notificationPrefs: r.notificationPrefs,
    }));
}

async function expireRecommendationAlertsForAnalyst(analystUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const nowIso = new Date().toISOString();
  const filters = [
    eq(recommendationAlerts.status, 'pending'),
    sql`${recommendationAlerts.expiresAt} <= ${nowIso}`,
  ];

  if (analystUserId !== undefined) {
    filters.push(eq(recommendationAlerts.analystUserId, analystUserId));
  }

  await db.update(recommendationAlerts)
    .set({ status: 'expired', updatedAt: nowIso })
    .where(and(...filters));
}

export async function getActiveRecommendationAlertForAnalyst(analystUserId: number): Promise<RecommendationAlert | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await expireRecommendationAlertsForAnalyst(analystUserId);

  const nowIso = new Date().toISOString();
  const rows = await db.select()
    .from(recommendationAlerts)
    .where(and(
      eq(recommendationAlerts.analystUserId, analystUserId),
      eq(recommendationAlerts.status, 'pending'),
      sql`${recommendationAlerts.expiresAt} > ${nowIso}`,
    ))
    .orderBy(desc(recommendationAlerts.notifiedAt))
    .limit(1);

  return rows[0];
}

export async function createRecommendationAlert(input: {
  analystUserId: number;
  note?: string | null;
}): Promise<RecommendationAlert> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getActiveRecommendationAlertForAnalyst(input.analystUserId);
  if (existing) {
    throw new Error("There is already an active chat session. Wait for it to pause or cancel it before starting a new one.");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const unlockAt = new Date(now.getTime() + RECOMMENDATION_ALERT_UNLOCK_MS).toISOString();
  const expiresAt = new Date(now.getTime() + RECOMMENDATION_ALERT_EXPIRY_MS).toISOString();
  const note = input.note?.trim() || null;

  const [row] = await db.insert(recommendationAlerts).values({
    analystUserId: input.analystUserId,
    note,
    notifiedAt: nowIso,
    unlockAt,
    expiresAt,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  }).returning();

  return row;
}

export async function cancelRecommendationAlert(alertId: number, analystUserId: number, isAdmin: boolean = false): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db.select()
    .from(recommendationAlerts)
    .where(eq(recommendationAlerts.id, alertId))
    .limit(1);

  if (!row) {
    throw new Error("Notification window not found");
  }
  if (!isAdmin && row.analystUserId !== analystUserId) {
    throw new Error("You can only cancel your own notification window");
  }
  if (row.status !== 'pending') {
    throw new Error("This notification window is no longer active");
  }

  const nowIso = new Date().toISOString();
  await db.update(recommendationAlerts)
    .set({
      status: 'cancelled',
      cancelledAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(recommendationAlerts.id, alertId));
}

export async function extendRecommendationAlertActivity(alertId: number, analystUserId: number): Promise<RecommendationAlert> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RECOMMENDATION_ALERT_EXPIRY_MS).toISOString();

  const [row] = await db.update(recommendationAlerts)
    .set({
      expiresAt,
      updatedAt: nowIso,
    })
    .where(and(
      eq(recommendationAlerts.id, alertId),
      eq(recommendationAlerts.analystUserId, analystUserId),
      eq(recommendationAlerts.status, 'pending'),
    ))
    .returning();

  if (!row) {
    throw new Error("Notification window not found");
  }

  return row;
}

export async function listActiveRecommendationAlerts(): Promise<RecommendationAlert[]> {
  const db = await getDb();
  if (!db) return [];

  await expireRecommendationAlertsForAnalyst();

  const nowIso = new Date().toISOString();
  return db.select()
    .from(recommendationAlerts)
    .where(and(
      eq(recommendationAlerts.status, 'pending'),
      sql`${recommendationAlerts.expiresAt} > ${nowIso}`,
    ))
    .orderBy(desc(recommendationAlerts.notifiedAt));
}

export async function getRecommendationPublishState(analystUserId: number): Promise<{
  activeAlert: RecommendationAlert | null;
  canNotify: boolean;
  canPostMessages: boolean;
  secondsUntilUnlock: number;
  secondsUntilExpiry: number;
}> {
  const activeAlert = await getActiveRecommendationAlertForAnalyst(analystUserId);
  if (!activeAlert) {
    return {
      activeAlert: null,
      canNotify: true,
      canPostMessages: false,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 0,
    };
  }

  const now = Date.now();
  const unlockAt = new Date(activeAlert.unlockAt).getTime();
  const expiresAt = new Date(activeAlert.expiresAt).getTime();
  const secondsUntilUnlock = Math.max(0, Math.ceil((unlockAt - now) / 1000));
  const secondsUntilExpiry = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return {
    activeAlert,
    canNotify: false,
    canPostMessages: secondsUntilUnlock === 0 && secondsUntilExpiry > 0,
    secondsUntilUnlock,
    secondsUntilExpiry,
  };
}

export async function createRecommendationMessage(message: InsertRecommendationMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recommendationMessages).values(message).returning({ id: recommendationMessages.id });
  return result[0].id;
}

export async function getRecommendationMessageById(messageId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db.select()
    .from(recommendationMessages)
    .where(eq(recommendationMessages.id, messageId))
    .limit(1);

  return rows[0];
}

export async function deleteRecommendationMessage(messageId: number, userId: number, isAdmin: boolean = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ id: recommendationMessages.id, ownerId: recommendationMessages.userId })
    .from(recommendationMessages)
    .where(eq(recommendationMessages.id, messageId))
    .limit(1);

  const target = existing[0];
  if (!target) {
    throw new Error("Recommendation message not found");
  }

  if (!isAdmin && target.ownerId !== userId) {
    throw new Error("You can only delete your own recommendation messages");
  }

  await db.delete(recommendationMessages).where(eq(recommendationMessages.id, messageId));
  await db.delete(recommendationMessages).where(eq(recommendationMessages.parentId, messageId));
}

export async function getRecommendationMessagesFeed(userId: number, limit: number = 200) {
  const db = await getDb();
  if (!db) return [];

  const messages = await db
    .select()
    .from(recommendationMessages)
    .orderBy(desc(recommendationMessages.createdAt))
    .limit(limit);

  const orderedMessages = [...messages].reverse();

  const messageIds = orderedMessages.map((message) => message.id);
  const authorIds = Array.from(new Set(orderedMessages.map((message) => message.userId)));

  const authors = authorIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, authorIds))
    : [];

  // Check which authors have the analyst role
  const analystRoles = authorIds.length
    ? await db.select({ userId: userRoles.userId })
        .from(userRoles)
        .where(and(inArray(userRoles.userId, authorIds), eq(userRoles.role, 'analyst')))
    : [];
  const analystSet = new Set(analystRoles.map(r => r.userId));

  const reactions = messageIds.length
    ? await db
        .select()
        .from(recommendationReactions)
        .where(inArray(recommendationReactions.messageId, messageIds))
    : [];

  return orderedMessages.map((message) => {
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
      isAnalyst: analystSet.has(message.userId),
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
  const activePackageSubs = await getUserPackageSubscriptions(userId);
  const activePackageIds = new Set(
    activePackageSubs
      .map((subscription) => Number(subscription.packageId))
      .filter((packageId) => Number.isFinite(packageId))
  );

  // Also check LexAI/Rec — if already activated (non-pending), skip entirely
  const existingLexai = await getAnyLexaiSubscription(userId);
  const existingRec = await getAnyRecommendationSubscription(userId);
  const hasActiveSubs = (existingLexai && !existingLexai.isPendingActivation) || (existingRec && !existingRec.isPendingActivation);

  console.log(`[syncEntitlements] userId=${userId} keys=${packageKeys.length} activePkgIds=[${[...activePackageIds]}] hasActiveSubs=${hasActiveSubs}`);

  for (const key of packageKeys) {
    const keyPackageId = Number(key.packageId);
    if (!Number.isFinite(keyPackageId)) continue;
    if (activePackageIds.has(keyPackageId)) {
      console.log(`[syncEntitlements] SKIP key ${key.id} pkgId=${key.packageId} — already has active packageSub`);
      continue;
    }
    if (hasActiveSubs) {
      console.log(`[syncEntitlements] SKIP key ${key.id} pkgId=${key.packageId} — has active LexAI/Rec (non-pending)`);
      continue;
    }
    console.log(`[syncEntitlements] FULFILLING key ${key.id} pkgId=${key.packageId}`);
    await fulfillPackageEntitlements(userId, keyPackageId, key.id, key.entitlementDays ?? undefined);
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
        lexaiSubId: null, lexaiIsPaused: null as boolean | null, lexaiEndDate: null, lexaiPausedRemainingDays: null,
        recSubId: null, recIsPaused: null as boolean | null, recEndDate: null, recPausedRemainingDays: null,
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
      lexaiIsPaused: lexaiSub?.isPaused ?? null,
      lexaiEndDate: lexaiSub?.endDate ?? null,
      lexaiPausedRemainingDays: lexaiSub?.pausedRemainingDays ?? null,
      recSubId: recSub?.id ?? null,
      recIsPaused: recSub?.isPaused ?? null,
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

  // Send welcome / renewal email (fire-and-forget, don't block activation)
  try {
    const recipientUser = resolvedUserId ? await getUserById(resolvedUserId) : null;
    sendWelcomeEmail(normalizedEmail, {
      name: recipientUser?.name,
      packageName: pkg.nameEn || pkg.nameAr || 'XFlex Package',
      packageNameAr: pkg.nameAr || pkg.nameEn || 'باقة XFlex',
      isRenewal: !!key.isRenewal,
      includesLexai: !!pkg.includesLexai,
    }).catch((error) => logger.error('Welcome email failed', { error }));
  } catch (e) {
    logger.error('Welcome email setup failed', { error: e });
  }

  // In-app notification: package activated
  if (resolvedUserId) {
    const pkgNameEn = pkg.nameEn || pkg.nameAr || 'XFlex Package';
    const pkgNameAr = pkg.nameAr || pkg.nameEn || 'باقة XFlex';
    await createNotification({
      userId: resolvedUserId,
      type: 'success',
      titleAr: key.isRenewal ? `تم تجديد اشتراكك بنجاح` : `مرحباً! تم تفعيل باقة ${pkgNameAr}`,
      titleEn: key.isRenewal ? `Subscription Renewed Successfully` : `Welcome! ${pkgNameEn} Activated`,
      contentAr: key.isRenewal
        ? `تم تجديد باقة ${pkgNameAr} بنجاح.`
        : `تم تفعيل باقة ${pkgNameAr}. ابدأ رحلتك الآن!`,
      contentEn: key.isRenewal
        ? `Your ${pkgNameEn} has been renewed.`
        : `Your ${pkgNameEn} is now active. Start your journey!`,
      actionUrl: '/dashboard',
    }).catch(() => {});

    // Notify admin/key_manager of key activation
    const pkgLabel = `${pkg.nameEn || pkg.nameAr}`;
    notifyStaffByEvent('key_activated', {
      titleEn: `Key activated: ${pkgLabel} by ${normalizedEmail}`,
      titleAr: `تم تفعيل مفتاح: ${pkgLabel} بواسطة ${normalizedEmail}`,
      contentEn: key.isRenewal ? `Renewal key activated for ${normalizedEmail}.` : `New key activated for ${normalizedEmail}.`,
      contentAr: key.isRenewal ? `تم تفعيل مفتاح تجديد لـ ${normalizedEmail}.` : `تم تفعيل مفتاح جديد لـ ${normalizedEmail}.`,
      metadata: { keyId: key.id, userId: resolvedUserId, packageName: pkgLabel, isRenewal: !!key.isRenewal },
    }).catch(() => {});
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
  const normalizedPackageId = Number(packageId);

  const entitlementDays = normalizePositiveInteger(entitlementDaysOverride)
    ?? normalizePositiveInteger(pkg.renewalPeriodDays)
    ?? normalizePositiveInteger(pkg.durationDays)
    ?? DEFAULT_KEY_ENTITLEMENT_DAYS;
  const now = new Date();

  // --- Package subscription ---
  const existingPackageSubs = await getUserPackageSubscriptions(userId);
  const currentPkgSub = existingPackageSubs.find(
    (subscription) => Number(subscription.packageId) === normalizedPackageId && subscription.isActive
  );
  if (!currentPkgSub) {
    // No existing sub — fall back to fresh activation
    await fulfillPackageEntitlements(userId, packageId, registrationKeyId, entitlementDays);
    return;
  }
  // Course access is forever — just ensure active flag is set
  const dbInst = await getDb();
  if (!dbInst) return;
  await dbInst.update(packageSubscriptions).set({
    isActive: true,
    updatedAt: now.toISOString(),
  }).where(eq(packageSubscriptions.id, currentPkgSub.id));

  // --- LexAI subscription ---
  if (pkg.includesLexai) {
    const current = await getAnyLexaiSubscription(userId);
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
    const current = await getAnyRecommendationSubscription(userId);
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
 *
 * Subscription lifecycle:
 * - First-time: LexAI/Rec created with isPendingActivation=true, auto-activates after study period
 * - Renewal/upgrade: endDate = max(currentEndDate, now) + entitlementDays (stacking)
 * - Both gates cleared (course+broker done): activate immediately
 * - Upgrade basic→comp: LexAI starts immediately (new feature), Rec stacks after current
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
  const normalizedPackageId = Number(packageId);

  const entitlementDays = normalizePositiveInteger(entitlementDaysOverride)
    ?? normalizePositiveInteger(pkg.renewalPeriodDays)
    ?? normalizePositiveInteger(pkg.durationDays)
    ?? DEFAULT_KEY_ENTITLEMENT_DAYS;
  const now = new Date();
  const studyPeriodDays = await getStudyPeriodDays();
  const placeholderEndDate = buildEndDateFromDays(now, studyPeriodDays + entitlementDays);
  const maxActivationDate = buildEndDateFromDays(now, studyPeriodDays);
  console.log(`[fulfillEntitlements] userId=${userId} pkgId=${packageId} entDays=${entitlementDays} studyDays=${studyPeriodDays}`);

  const db = await getDb();
  if (!db) return;

  // Only broker gate matters for immediate activation (course has zero effect)
  const [userRow] = await db.select({ brokerOnboardingComplete: users.brokerOnboardingComplete })
    .from(users).where(eq(users.id, userId)).limit(1);
  const brokerComplete = !!userRow?.brokerOnboardingComplete;

  // Determine if this is a renewal/upgrade (student has existing active subs)
  const existingLexai = await getAnyLexaiSubscription(userId);
  const existingRec = await getAnyRecommendationSubscription(userId);

  // ── Idempotency guard: if subs are already active & not pending, this is a no-op sync ──
  // Only stack when there's genuinely something new (pending subs or no subs at all).
  const lexaiAlreadyActive = existingLexai && !existingLexai.isPendingActivation && existingLexai.endDate && new Date(existingLexai.endDate) > now;
  const recAlreadyActive = existingRec && !existingRec.isPendingActivation && existingRec.endDate && new Date(existingRec.endDate) > now;
  const existingPackageSubscriptions = await getUserPackageSubscriptions(userId);
  const currentPackageSubscription = existingPackageSubscriptions.find(
    (subscription) => Number(subscription.packageId) === normalizedPackageId
  );

  if (currentPackageSubscription && (lexaiAlreadyActive || recAlreadyActive)) {
    // User already has this package and active subs — just ensure enrollments exist, skip stacking
    console.log(`[fulfillEntitlements] IDEMPOTENT SKIP userId=${userId} — subs already active, not stacking`);

    // Still ensure course enrollments exist
    let pkgCourses = await getPackageCourses(packageId);
    let courseIdsToEnroll: number[] = pkgCourses.map(pc => pc.courseId);
    if (courseIdsToEnroll.length === 0) {
      const allPublished = await getPublishedCourses();
      courseIdsToEnroll = allPublished.map(c => c.id);
    }
    for (const courseId of courseIdsToEnroll) {
      try {
        const existing = await getEnrollmentByUserAndCourse(userId, courseId);
        if (!existing) {
          await createEnrollment({ userId, courseId, paymentStatus: "completed", isSubscriptionActive: true, registrationKeyId: registrationKeyId ?? null, activatedViaKey: !!registrationKeyId });
        }
      } catch (e) { /* ignore */ }
    }
    return;
  }

  const isRenewalOrUpgrade = brokerComplete || (existingLexai && !existingLexai.isPendingActivation) || (existingRec && !existingRec.isPendingActivation);

  // Stacking helper: endDate = max(currentEndDate, now) + entitlementDays
  const getStackedEndDate = (currentEndDate: string | null): Date => {
    const base = currentEndDate ? new Date(Math.max(new Date(currentEndDate).getTime(), now.getTime())) : now;
    return buildEndDateFromDays(base, entitlementDays);
  };

  // ── Package subscription (course access = forever) ──
  const pkgSubs = await getUserPackageSubscriptions(userId);
  const currentPkgSub = pkgSubs.find(
    (subscription) => Number(subscription.packageId) === normalizedPackageId
  );

  if (currentPkgSub) {
    await db.update(packageSubscriptions).set({
      isActive: true,
      updatedAt: now.toISOString(),
    }).where(eq(packageSubscriptions.id, currentPkgSub.id));
  } else {
    await createPackageSubscription({
      userId,
      packageId,
      orderId: orderId ?? 0,
      isActive: true,
      startDate: now.toISOString(),
      endDate: null as any,
      renewalDueDate: null as any,
      autoRenew: false,
    });
  }

  // ── Enroll in all package courses ──
  let pkgCourses = await getPackageCourses(packageId);
  let courseIdsToEnroll: number[] = pkgCourses.map(pc => pc.courseId);
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

  // ── LexAI subscription ──
  if (pkg.includesLexai) {
    if (existingLexai) {
      if (isRenewalOrUpgrade) {
        // Stack after current endDate (or start now if expired/new)
        const stackedEnd = getStackedEndDate(existingLexai.endDate);
        await updateLexaiSubscription(existingLexai.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: false,
          studentActivatedAt: existingLexai.studentActivatedAt || now.toISOString(),
          maxActivationDate: null,
          startDate: existingLexai.isPendingActivation ? now.toISOString() : existingLexai.startDate,
          endDate: stackedEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesLimit: (existingLexai.messagesLimit ?? 100),
        });
      } else {
        // First-time, deferred activation
        await updateLexaiSubscription(existingLexai.id, {
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
      if (isRenewalOrUpgrade) {
        // Upgrade: brand new LexAI, activate immediately (e.g. basic→comp)
        const stackedEnd = getStackedEndDate(existingRec?.endDate ?? null); // Sync with Rec if exists
        await createLexaiSubscription({
          userId,
          isActive: true,
          isPaused: false,
          isPendingActivation: false,
          studentActivatedAt: now.toISOString(),
          maxActivationDate: null,
          startDate: now.toISOString(),
          endDate: stackedEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesUsed: 0,
          messagesLimit: 100,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
        });
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
  }

  // ── Recommendation subscription ──
  if (pkg.includesRecommendations) {
    if (existingRec) {
      if (isRenewalOrUpgrade) {
        // Stack after current endDate
        const stackedEnd = getStackedEndDate(existingRec.endDate);
        await updateRecommendationSubscription(existingRec.id, {
          isActive: true,
          isPaused: false,
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
          isPendingActivation: false,
          studentActivatedAt: existingRec.studentActivatedAt || now.toISOString(),
          maxActivationDate: null,
          startDate: existingRec.isPendingActivation ? now.toISOString() : existingRec.startDate,
          endDate: stackedEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          registrationKeyId: registrationKeyId ?? existingRec.registrationKeyId,
        });
      } else {
        // First-time, deferred activation
        await updateRecommendationSubscription(existingRec.id, {
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
          registrationKeyId: registrationKeyId ?? existingRec.registrationKeyId,
        });
      }
    } else {
      if (isRenewalOrUpgrade) {
        const stackedEnd = getStackedEndDate(null);
        await createRecommendationSubscription({
          userId,
          registrationKeyId: registrationKeyId ?? null,
          isActive: true,
          isPaused: false,
          isPendingActivation: false,
          studentActivatedAt: now.toISOString(),
          maxActivationDate: null,
          startDate: now.toISOString(),
          endDate: stackedEnd.toISOString(),
          paymentStatus: "completed",
          paymentAmount: 0,
          paymentCurrency: "USD",
          pausedAt: null,
          pausedReason: null,
          pausedRemainingDays: null,
        });
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
  const oldSub = subs.find(
    (subscription) => Number(subscription.packageId) === Number(fromPackageId) && subscription.isActive
  );
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
  const newSub = newSubs.find(
    (subscription) => Number(subscription.packageId) === Number(toPackageId) && subscription.isActive
  );
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
    // Award points on first episode completion
    if (nextCompleted && !existing.isCompleted) {
      try {
        const completed = await db.select({ c: sql<number>`COUNT(*)` }).from(episodeProgress)
          .where(and(eq(episodeProgress.userId, progress.userId), eq(episodeProgress.isCompleted, true)));
        const count = Number(completed[0]?.c ?? 0);
        if (count > 0 && count % 5 === 0) {
          await autoAwardPoints(progress.userId, 'episode_milestone', { referenceId: progress.episodeId, referenceType: 'episode_milestone' });
        }
        // Send milestone email at 10, 14, 27, 39 episodes
        if ([10, 14, 27, 39].includes(count)) {
          const emailType = `milestone_${count}`;
          hasEmailBeenSent(progress.userId, emailType).then(async sent => {
            if (sent) return;
            const [u] = await db.select({ email: users.email, name: users.name })
              .from(users).where(eq(users.id, progress.userId)).limit(1);
            if (u) {
              sendMilestoneEmail(u.email, count, { name: u.name, completedCount: count }).catch(() => {});
              logEmailSent(progress.userId, emailType).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch {}
    }
  } else {
    const result = await db.insert(episodeProgress).values(progress).returning({ id: episodeProgress.id });
    // Award milestone on first creation if completed
    if (progress.isCompleted) {
      try {
        const completed = await db.select({ c: sql<number>`COUNT(*)` }).from(episodeProgress)
          .where(and(eq(episodeProgress.userId, progress.userId), eq(episodeProgress.isCompleted, true)));
        const count = Number(completed[0]?.c ?? 0);
        if (count > 0 && count % 5 === 0) {
          await autoAwardPoints(progress.userId, 'episode_milestone', { referenceId: progress.episodeId, referenceType: 'episode_milestone' });
        }
        // Send milestone email at 10, 14, 27, 39 episodes
        if ([10, 14, 27, 39].includes(count)) {
          const emailType = `milestone_${count}`;
          hasEmailBeenSent(progress.userId, emailType).then(async sent => {
            if (sent) return;
            const [u] = await db.select({ email: users.email, name: users.name })
              .from(users).where(eq(users.id, progress.userId)).limit(1);
            if (u) {
              sendMilestoneEmail(u.email, count, { name: u.name, completedCount: count }).catch(() => {});
              logEmailSent(progress.userId, emailType).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch {}
    }
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

  // Auto-award points for passing quiz
  if (passed) {
    try { await autoAwardPoints(userId, 'quiz_pass', { referenceId: quiz.id, referenceType: 'quiz' }); } catch {}
  }

  // Send post-quiz feedback email (fire-and-forget)
  try {
    const [quizUser] = await db.select({ email: users.email, name: users.name })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (quizUser) {
      sendQuizFeedbackEmail(quizUser.email, {
        name: quizUser.name,
        quizLevel: level,
        score,
        passed,
        correctCount,
        totalQuestions,
      }).catch(() => {});
    }
  } catch {}

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
      eq(lexaiSubscriptions.isPendingActivation, false),
      sql`${lexaiSubscriptions.endDate} >= ${nowIso}`
    ))
    .orderBy(desc(lexaiSubscriptions.endDate), desc(lexaiSubscriptions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Returns ANY existing LexAI subscription for the user (including pending), for create-or-update logic. */
export async function getAnyLexaiSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.userId, userId),
      eq(lexaiSubscriptions.isActive, true),
    ))
    .orderBy(desc(lexaiSubscriptions.endDate), desc(lexaiSubscriptions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Returns the frozen (paused) LexAI subscription if one exists, or undefined. */
export async function getFrozenLexaiSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: lexaiSubscriptions.id,
    isPaused: lexaiSubscriptions.isPaused,
    frozenUntil: lexaiSubscriptions.frozenUntil,
    pausedReason: lexaiSubscriptions.pausedReason,
    endDate: lexaiSubscriptions.endDate,
  }).from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.userId, userId),
      eq(lexaiSubscriptions.isActive, true),
      eq(lexaiSubscriptions.isPaused, true),
    ))
    .orderBy(desc(lexaiSubscriptions.endDate))
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
  const createdAt = new Date().toISOString();
  const result = await db
    .insert(lexaiMessages)
    .values({
      ...message,
      createdAt,
    } as InsertLexaiMessage)
    .returning({ id: lexaiMessages.id });
  await touchLexaiSupportCaseMessage(message.userId, createdAt);
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

export async function getLexaiSupportCaseByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(lexaiSupportCases)
    .where(eq(lexaiSupportCases.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function ensureLexaiSupportCase(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getLexaiSupportCaseByUserId(userId);
  if (existing) return existing;

  const [latestMessage] = await db.select({ createdAt: lexaiMessages.createdAt })
    .from(lexaiMessages)
    .where(eq(lexaiMessages.userId, userId))
    .orderBy(desc(lexaiMessages.createdAt))
    .limit(1);

  const now = new Date().toISOString();
  await db.insert(lexaiSupportCases).values({
    userId,
    status: "open",
    priority: "normal",
    lastMessageAt: latestMessage?.createdAt ?? null,
    createdAt: now,
    updatedAt: now,
  } as InsertLexaiSupportCase).onConflictDoNothing();

  const created = await getLexaiSupportCaseByUserId(userId);
  if (!created) throw new Error("Failed to create LexAI support case");
  return created;
}

export async function touchLexaiSupportCaseMessage(userId: number, messageCreatedAt?: string) {
  const db = await getDb();
  if (!db) return;
  const supportCase = await ensureLexaiSupportCase(userId);
  const timestamp = messageCreatedAt ?? new Date().toISOString();

  await db.update(lexaiSupportCases).set({
    lastMessageAt: timestamp,
    updatedAt: timestamp,
  }).where(eq(lexaiSupportCases.id, supportCase.id));
}

export async function flagLexaiSupportCaseExpiry(userId: number, daysLeft: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const supportCase = await ensureLexaiSupportCase(userId);
  const suggestedPriority = getLexaiSupportPriorityForExpiry(daysLeft);
  const currentPriority = (supportCase.priority as LexaiSupportCasePriority) || "normal";
  const nextPriority = supportCase.status === "resolved"
    ? suggestedPriority
    : getLexaiSupportPriorityRank(currentPriority) >= getLexaiSupportPriorityRank(suggestedPriority)
      ? currentPriority
      : suggestedPriority;

  const now = new Date().toISOString();
  await db.update(lexaiSupportCases).set({
    status: supportCase.status === "resolved" ? "open" : supportCase.status,
    priority: nextPriority,
    updatedAt: now,
  }).where(eq(lexaiSupportCases.id, supportCase.id));

  return supportCase.id;
}

export async function listLexaiSupportCases(filters?: {
  search?: string;
  status?: LexaiSupportCaseStatus;
  assignedToUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(lexaiSupportCases.status, filters.status));
  }
  if (typeof filters?.assignedToUserId === "number") {
    conditions.push(eq(lexaiSupportCases.assignedToUserId, filters.assignedToUserId));
  }
  if (filters?.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    conditions.push(or(
      sql`LOWER(COALESCE(${users.name}, '')) LIKE LOWER(${search})`,
      sql`LOWER(COALESCE(${users.email}, '')) LIKE LOWER(${search})`
    ));
  }

  const baseQuery = db.select({
    id: lexaiSupportCases.id,
    userId: lexaiSupportCases.userId,
    status: lexaiSupportCases.status,
    priority: lexaiSupportCases.priority,
    assignedToUserId: lexaiSupportCases.assignedToUserId,
    assignedToName: sql<string | null>`CASE
      WHEN ${lexaiSupportCases.assignedToUserId} < 0 THEN (SELECT a.name FROM admins a WHERE a.id = ABS(${lexaiSupportCases.assignedToUserId}) LIMIT 1)
      ELSE (SELECT u.name FROM users u WHERE u.id = ${lexaiSupportCases.assignedToUserId} LIMIT 1)
    END`,
    lastMessageAt: lexaiSupportCases.lastMessageAt,
    lastReviewedAt: lexaiSupportCases.lastReviewedAt,
    resolvedAt: lexaiSupportCases.resolvedAt,
    createdAt: lexaiSupportCases.createdAt,
    updatedAt: lexaiSupportCases.updatedAt,
    userName: users.name,
    userEmail: users.email,
  }).from(lexaiSupportCases)
    .leftJoin(users, eq(lexaiSupportCases.userId, users.id));

  const whereClause = conditions.length === 0
    ? null
    : conditions.length === 1
      ? conditions[0]
      : and(...conditions);

  const baseRows = whereClause
    ? await baseQuery.where(whereClause).orderBy(desc(lexaiSupportCases.updatedAt))
    : await baseQuery.orderBy(desc(lexaiSupportCases.updatedAt));

  const userIds = Array.from(new Set(baseRows.map((row) => row.userId)));
  if (userIds.length === 0) return [];

  const messageStatsRows = await db.select({
    userId: lexaiMessages.userId,
    count: sql<number>`COUNT(*)`,
    lastMessageAt: sql<string>`MAX(${lexaiMessages.createdAt})`,
  }).from(lexaiMessages)
    .where(inArray(lexaiMessages.userId, userIds))
    .groupBy(lexaiMessages.userId);

  const latestMessageRows = await db.select({
    userId: lexaiMessages.userId,
    analysisType: lexaiMessages.analysisType,
    createdAt: lexaiMessages.createdAt,
  }).from(lexaiMessages)
    .where(inArray(lexaiMessages.userId, userIds))
    .orderBy(desc(lexaiMessages.createdAt));

  const subscriptionRows = await db.select({
    userId: lexaiSubscriptions.userId,
    id: lexaiSubscriptions.id,
    isActive: lexaiSubscriptions.isActive,
    isPaused: lexaiSubscriptions.isPaused,
    isPendingActivation: lexaiSubscriptions.isPendingActivation,
    endDate: lexaiSubscriptions.endDate,
    pausedRemainingDays: lexaiSubscriptions.pausedRemainingDays,
    pausedReason: lexaiSubscriptions.pausedReason,
    maxActivationDate: lexaiSubscriptions.maxActivationDate,
    messagesUsed: lexaiSubscriptions.messagesUsed,
    createdAt: lexaiSubscriptions.createdAt,
  }).from(lexaiSubscriptions)
    .where(inArray(lexaiSubscriptions.userId, userIds))
    .orderBy(desc(lexaiSubscriptions.createdAt));

  const supportRows = await db.select({
    userId: supportConversations.userId,
    id: supportConversations.id,
    status: supportConversations.status,
    needsHuman: supportConversations.needsHuman,
    updatedAt: supportConversations.updatedAt,
  }).from(supportConversations)
    .where(inArray(supportConversations.userId, userIds))
    .orderBy(desc(supportConversations.updatedAt));

  const messageStatsMap = new Map(messageStatsRows.map((row) => [row.userId, row]));
  const latestMessageMap = new Map<number, typeof latestMessageRows[number]>();
  for (const row of latestMessageRows) {
    if (!latestMessageMap.has(row.userId)) latestMessageMap.set(row.userId, row);
  }

  const subscriptionMap = new Map<number, LexaiSupportSubscriptionSnapshot>();
  for (const row of subscriptionRows) {
    if (!subscriptionMap.has(row.userId)) {
      subscriptionMap.set(row.userId, {
        id: row.id,
        isActive: !!row.isActive,
        isPaused: !!row.isPaused,
        isPendingActivation: !!row.isPendingActivation,
        endDate: row.endDate,
        pausedRemainingDays: row.pausedRemainingDays,
        pausedReason: row.pausedReason,
        maxActivationDate: row.maxActivationDate,
        messagesUsed: Number(row.messagesUsed ?? 0),
      });
    }
  }

  const supportMap = new Map<number, typeof supportRows[number]>();
  for (const row of supportRows) {
    if (!supportMap.has(row.userId)) supportMap.set(row.userId, row);
  }

  return baseRows.map((row) => {
    const messageStats = messageStatsMap.get(row.userId);
    const latestMessage = latestMessageMap.get(row.userId);
    const subscription = subscriptionMap.get(row.userId);
    const supportConversation = supportMap.get(row.userId);

    return {
      ...row,
      messageCount: Number(messageStats?.count ?? 0),
      lastMessageAt: row.lastMessageAt ?? messageStats?.lastMessageAt ?? latestMessage?.createdAt ?? null,
      lastAnalysisType: latestMessage?.analysisType ?? null,
      lexaiSubscriptionId: subscription?.id ?? null,
      lexaiSubscriptionState: getLexaiSupportSubscriptionState(subscription),
      remainingDays: getLexaiSupportRemainingDays(subscription),
      activationDeadlineDays: getLexaiSupportActivationDeadlineDays(subscription),
      pausedReason: subscription?.pausedReason ?? null,
      messagesUsed: Number(subscription?.messagesUsed ?? 0),
      supportConversationId: supportConversation?.id ?? null,
      supportConversationStatus: supportConversation?.status ?? null,
      supportNeedsHuman: !!supportConversation?.needsHuman,
    };
  });
}

export async function getLexaiSupportNotes(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: lexaiSupportNotes.id,
    caseId: lexaiSupportNotes.caseId,
    authorUserId: lexaiSupportNotes.authorUserId,
    authorName: sql<string | null>`CASE
      WHEN ${lexaiSupportNotes.authorUserId} < 0 THEN (SELECT a.name FROM admins a WHERE a.id = ABS(${lexaiSupportNotes.authorUserId}) LIMIT 1)
      ELSE (SELECT u.name FROM users u WHERE u.id = ${lexaiSupportNotes.authorUserId} LIMIT 1)
    END`,
    authorEmail: sql<string | null>`CASE
      WHEN ${lexaiSupportNotes.authorUserId} < 0 THEN (SELECT a.email FROM admins a WHERE a.id = ABS(${lexaiSupportNotes.authorUserId}) LIMIT 1)
      ELSE (SELECT u.email FROM users u WHERE u.id = ${lexaiSupportNotes.authorUserId} LIMIT 1)
    END`,
    noteType: lexaiSupportNotes.noteType,
    content: lexaiSupportNotes.content,
    createdAt: lexaiSupportNotes.createdAt,
  }).from(lexaiSupportNotes)
    .where(eq(lexaiSupportNotes.caseId, caseId))
    .orderBy(desc(lexaiSupportNotes.createdAt));
}

export async function addLexaiSupportNote(input: {
  caseId: number;
  authorUserId: number;
  noteType?: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date().toISOString();
  await db.insert(lexaiSupportNotes).values({
    caseId: input.caseId,
    authorUserId: input.authorUserId,
    noteType: input.noteType ?? "note",
    content: input.content,
    createdAt: now,
  } as InsertLexaiSupportNote);

  await db.update(lexaiSupportCases).set({ updatedAt: now })
    .where(eq(lexaiSupportCases.id, input.caseId));
}

export async function markLexaiSupportCaseReviewed(caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date().toISOString();
  await db.update(lexaiSupportCases).set({
    lastReviewedAt: now,
    updatedAt: now,
  }).where(eq(lexaiSupportCases.id, caseId));
}

async function getSharedClientServiceContext(userId: number, options?: { includeTimeline?: boolean }) {
  const db = await getDb();
  if (!db) {
    return {
      lexaiCase: null,
      lexaiSubscription: null,
      recommendationSubscription: null,
      supportConversation: null,
      timeline: [],
    };
  }

  const includeTimeline = options?.includeTimeline !== false;

  const [lexaiCase, rawLexaiSubscription, rawRecommendationSubscription, supportConversation, timeline] = await Promise.all([
    getLexaiSupportCaseByUserId(userId),
    getAnyLexaiSubscription(userId),
    getAnyRecommendationSubscription(userId),
    db.select({
      id: supportConversations.id,
      userId: supportConversations.userId,
      status: supportConversations.status,
      needsHuman: supportConversations.needsHuman,
      assignedTo: supportConversations.assignedTo,
      updatedAt: supportConversations.updatedAt,
      closedAt: supportConversations.closedAt,
    }).from(supportConversations)
      .where(eq(supportConversations.userId, userId))
      .orderBy(desc(supportConversations.updatedAt), desc(supportConversations.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    includeTimeline ? getStudentTimeline(userId) : Promise.resolve([]),
  ]);

  const lexaiSnapshot = rawLexaiSubscription ? {
    isActive: !!rawLexaiSubscription.isActive,
    isPaused: !!rawLexaiSubscription.isPaused,
    isPendingActivation: !!rawLexaiSubscription.isPendingActivation,
    endDate: rawLexaiSubscription.endDate,
    pausedRemainingDays: rawLexaiSubscription.pausedRemainingDays,
    maxActivationDate: rawLexaiSubscription.maxActivationDate,
  } satisfies TimedServiceSubscriptionSnapshot : null;

  const recommendationSnapshot = rawRecommendationSubscription ? {
    isActive: !!rawRecommendationSubscription.isActive,
    isPaused: !!rawRecommendationSubscription.isPaused,
    isPendingActivation: !!rawRecommendationSubscription.isPendingActivation,
    endDate: rawRecommendationSubscription.endDate,
    pausedRemainingDays: rawRecommendationSubscription.pausedRemainingDays,
    maxActivationDate: rawRecommendationSubscription.maxActivationDate,
  } satisfies TimedServiceSubscriptionSnapshot : null;

  return {
    lexaiCase: lexaiCase
      ? {
          id: lexaiCase.id,
          status: lexaiCase.status,
          priority: lexaiCase.priority,
          lastMessageAt: lexaiCase.lastMessageAt,
          updatedAt: lexaiCase.updatedAt,
        }
      : null,
    lexaiSubscription: rawLexaiSubscription
      ? {
          ...rawLexaiSubscription,
          messagesUsed: Number(rawLexaiSubscription.messagesUsed ?? 0),
          subscriptionState: getTimedServiceSubscriptionState(lexaiSnapshot),
          remainingDays: getTimedServiceRemainingDays(lexaiSnapshot),
          activationDeadlineDays: getTimedServiceActivationDeadlineDays(lexaiSnapshot),
        }
      : null,
    recommendationSubscription: rawRecommendationSubscription
      ? {
          ...rawRecommendationSubscription,
          subscriptionState: getTimedServiceSubscriptionState(recommendationSnapshot),
          remainingDays: getTimedServiceRemainingDays(recommendationSnapshot),
          activationDeadlineDays: getTimedServiceActivationDeadlineDays(recommendationSnapshot),
        }
      : null,
    supportConversation,
    timeline,
  };
}

export async function getAdminClientProfile(userId: number, options?: { includeTimeline?: boolean }) {
  const [user, activePackageSubs, serviceContext] = await Promise.all([
    getUserById(userId),
    getUserPackageSubscriptions(userId),
    getSharedClientServiceContext(userId, options),
  ]);

  const activePackages = await Promise.all(
    activePackageSubs.map(async (subscription) => {
      const pkg = await getPackageById(subscription.packageId);
      return {
        subscriptionId: subscription.id,
        packageId: subscription.packageId,
        nameEn: pkg?.nameEn ?? `Package #${subscription.packageId}`,
        nameAr: pkg?.nameAr ?? pkg?.nameEn ?? `Package #${subscription.packageId}`,
        startDate: subscription.startDate,
        renewalDueDate: subscription.renewalDueDate ?? null,
      };
    }),
  );

  return {
    user: {
      id: userId,
      name: user?.name ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      city: user?.city ?? null,
      country: user?.country ?? null,
      createdAt: user?.createdAt ?? null,
      lastSignedIn: user?.lastSignedIn ?? null,
      emailVerified: !!user?.emailVerified,
      brokerOnboardingComplete: !!user?.brokerOnboardingComplete,
      isDeleted: !user,
    },
    packageSummary: {
      activePackages,
    },
    ...serviceContext,
  };
}

export async function getLexaiSupportCase(caseId: number) {
  const db = await getDb();
  if (!db) return null;

  const [supportCase] = await db.select({
    id: lexaiSupportCases.id,
    userId: lexaiSupportCases.userId,
    status: lexaiSupportCases.status,
    priority: lexaiSupportCases.priority,
    assignedToUserId: lexaiSupportCases.assignedToUserId,
    assignedByUserId: lexaiSupportCases.assignedByUserId,
    assignedToName: sql<string | null>`CASE
      WHEN ${lexaiSupportCases.assignedToUserId} < 0 THEN (SELECT a.name FROM admins a WHERE a.id = ABS(${lexaiSupportCases.assignedToUserId}) LIMIT 1)
      ELSE (SELECT u.name FROM users u WHERE u.id = ${lexaiSupportCases.assignedToUserId} LIMIT 1)
    END`,
    assignedByName: sql<string | null>`CASE
      WHEN ${lexaiSupportCases.assignedByUserId} < 0 THEN (SELECT a.name FROM admins a WHERE a.id = ABS(${lexaiSupportCases.assignedByUserId}) LIMIT 1)
      ELSE (SELECT u.name FROM users u WHERE u.id = ${lexaiSupportCases.assignedByUserId} LIMIT 1)
    END`,
    resolvedByName: sql<string | null>`CASE
      WHEN ${lexaiSupportCases.resolvedByUserId} < 0 THEN (SELECT a.name FROM admins a WHERE a.id = ABS(${lexaiSupportCases.resolvedByUserId}) LIMIT 1)
      ELSE (SELECT u.name FROM users u WHERE u.id = ${lexaiSupportCases.resolvedByUserId} LIMIT 1)
    END`,
    lastMessageAt: lexaiSupportCases.lastMessageAt,
    lastReviewedAt: lexaiSupportCases.lastReviewedAt,
    resolvedAt: lexaiSupportCases.resolvedAt,
    resolvedByUserId: lexaiSupportCases.resolvedByUserId,
    createdAt: lexaiSupportCases.createdAt,
    updatedAt: lexaiSupportCases.updatedAt,
    userName: users.name,
    userEmail: users.email,
  }).from(lexaiSupportCases)
    .leftJoin(users, eq(lexaiSupportCases.userId, users.id))
    .where(eq(lexaiSupportCases.id, caseId))
    .limit(1);

  if (!supportCase) return null;
  const messages = await getLexaiMessagesByUser(supportCase.userId, 200);
  const notes = await getLexaiSupportNotes(caseId);
  const serviceContext = await getSharedClientServiceContext(supportCase.userId, { includeTimeline: true });

  return {
    ...supportCase,
    messages,
    notes,
    timeline: serviceContext.timeline,
    lexaiSubscription: serviceContext.lexaiSubscription,
    recommendationSubscription: serviceContext.recommendationSubscription,
    supportConversation: serviceContext.supportConversation,
  };
}

export async function assignLexaiSupportCase(
  caseId: number,
  assignedToUserId: number | null,
  actorUserId: number,
  actorIsAdmin: boolean,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!actorIsAdmin && assignedToUserId !== actorUserId && assignedToUserId !== null) {
    throw new Error("You can only assign LexAI cases to yourself");
  }

  const supportCase = await getLexaiSupportCase(caseId);
  if (!supportCase) throw new Error("LexAI support case not found");

  const actor = await getUserById(actorUserId);
  const assignee = assignedToUserId ? await getUserById(assignedToUserId) : null;
  const now = new Date().toISOString();

  await db.update(lexaiSupportCases).set({
    assignedToUserId,
    assignedByUserId: actorUserId,
    updatedAt: now,
  }).where(eq(lexaiSupportCases.id, caseId));

  const actorLabel = actor?.name || actor?.email || `User #${actorUserId}`;
  const assigneeLabel = assignee?.name || assignee?.email || (assignedToUserId ? `User #${assignedToUserId}` : null);
  const studentLabel = supportCase.userName || supportCase.userEmail || `User #${supportCase.userId}`;

  await addLexaiSupportNote({
    caseId,
    authorUserId: actorUserId,
    noteType: "assignment",
    content: assignedToUserId
      ? `${actorLabel} assigned this case to ${assigneeLabel}.`
      : `${actorLabel} unassigned this case.`,
  });

  if (assignedToUserId) {
    await notifyStaffByEvent('lexai_case_assigned', {
      titleEn: `LexAI case assigned: ${studentLabel}`,
      titleAr: `تم تعيين حالة LexAI: ${studentLabel}`,
      contentEn: assigneeLabel
        ? `${actorLabel} assigned this LexAI case to ${assigneeLabel}.`
        : `${actorLabel} assigned a LexAI case.`,
      contentAr: assigneeLabel
        ? `${actorLabel} قام بتعيين حالة LexAI إلى ${assigneeLabel}.`
        : `${actorLabel} قام بتعيين حالة LexAI.`,
      metadata: { caseId, userId: supportCase.userId, assignedToUserId },
    });
  }
}

export async function updateLexaiSupportCaseStatus(
  caseId: number,
  status: LexaiSupportCaseStatus,
  actorUserId: number,
  note?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const supportCase = await getLexaiSupportCase(caseId);
  if (!supportCase) throw new Error("LexAI support case not found");

  const actor = await getUserById(actorUserId);
  const actorLabel = actor?.name || actor?.email || `User #${actorUserId}`;
  const now = new Date().toISOString();

  await db.update(lexaiSupportCases).set({
    status,
    resolvedAt: status === "resolved" ? now : null,
    resolvedByUserId: status === "resolved" ? actorUserId : null,
    updatedAt: now,
  }).where(eq(lexaiSupportCases.id, caseId));

  await addLexaiSupportNote({
    caseId,
    authorUserId: actorUserId,
    noteType: "status_change",
    content: note?.trim()
      ? `${actorLabel} set the case to ${status}. ${note.trim()}`
      : `${actorLabel} set the case to ${status}.`,
  });
}

export async function updateLexaiSupportCasePriority(
  caseId: number,
  priority: LexaiSupportCasePriority,
  actorUserId: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const supportCase = await getLexaiSupportCase(caseId);
  if (!supportCase) throw new Error("LexAI support case not found");

  const actor = await getUserById(actorUserId);
  const actorLabel = actor?.name || actor?.email || `User #${actorUserId}`;
  const now = new Date().toISOString();

  await db.update(lexaiSupportCases).set({
    priority,
    updatedAt: now,
  }).where(eq(lexaiSupportCases.id, caseId));

  await addLexaiSupportNote({
    caseId,
    authorUserId: actorUserId,
    noteType: "status_change",
    content: `${actorLabel} set the case priority to ${priority}.`,
  });
}

export async function requestLexaiSupportFollowup(caseId: number, actorUserId: number, note?: string) {
  const supportCase = await getLexaiSupportCase(caseId);
  if (!supportCase) throw new Error("LexAI support case not found");

  await updateLexaiSupportCaseStatus(caseId, "escalated", actorUserId, note);

  const actor = await getUserById(actorUserId);
  const actorLabel = actor?.name || actor?.email || `User #${actorUserId}`;
  const studentLabel = supportCase.userName || supportCase.userEmail || `User #${supportCase.userId}`;

  await notifyStaffByEvent('lexai_followup_requested', {
    titleEn: `LexAI follow-up requested: ${studentLabel}`,
    titleAr: `تم طلب متابعة LexAI: ${studentLabel}`,
    contentEn: note?.trim()
      ? `${actorLabel} requested LexAI follow-up. ${note.trim()}`
      : `${actorLabel} requested LexAI follow-up for this case.`,
    contentAr: note?.trim()
      ? `${actorLabel} طلب متابعة LexAI. ${note.trim()}`
      : `${actorLabel} طلب متابعة LexAI لهذه الحالة.`,
    metadata: { caseId, userId: supportCase.userId },
  });
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

/**
 * Replace all roles for a user with the given set.
 * Diffs current vs desired to minimize DB writes.
 */
export async function setUserRoles(userId: number, desiredRoles: string[], assignedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const current = await getUserRoles(userId);
  const currentSet = new Set(current.map(r => r.role));
  const desiredSet = new Set(desiredRoles);

  // Remove roles no longer desired
  for (const r of current) {
    if (!desiredSet.has(r.role)) {
      await removeRole(userId, r.role);
    }
  }
  // Add new roles
  for (const role of desiredRoles) {
    if (!currentSet.has(role)) {
      await assignRole(userId, role, assignedBy);
    }
  }

  logger.db('User roles updated', { userId, roles: desiredRoles });
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

/**
 * Create a staff user account (for roles assignment).
 * Sets isStaff=true, emailVerified=true, dummy password (they login via OTP).
 */
export async function createStaffUser(data: { name: string; email: string; phone?: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if email already exists
  const existing = await getUserByEmail(data.email);
  if (existing) {
    // If existing user is already staff, throw
    if ((existing as any).isStaff) {
      throw new Error("Staff member with this email already exists");
    }
    // Convert existing student to staff
    await db.update(users).set({ isStaff: true }).where(eq(users.id, existing.id));
    logger.db('Converted existing user to staff', { userId: existing.id, email: data.email });
    return existing.id;
  }

  // Create new staff user with dummy password (OTP login)
  const now = new Date().toISOString();
  const result = await db.insert(users).values({
    email: data.email,
    name: data.name,
    phone: data.phone || null,
    passwordHash: '__staff_no_password__',
    emailVerified: true,
    isStaff: true,
    loginSecurityMode: 'password_or_otp',
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  }).returning({ id: users.id });

  logger.db('Staff user created', { userId: result[0].id, email: data.email });
  return result[0].id;
}

/**
 * Get all staff members with their roles
 */
export async function getStaffMembers() {
  const db = await getDb();
  if (!db) return [];

  const staffUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.isStaff, true)).orderBy(desc(users.createdAt));

  // Get all roles for staff users
  const staffIds = staffUsers.map(u => u.id);
  if (staffIds.length === 0) return [];

  const allRoles = await db.select().from(userRoles)
    .where(inArray(userRoles.userId, staffIds));

  return staffUsers.map(u => ({
    ...u,
    roles: allRoles.filter(r => r.userId === u.id).map(r => r.role),
  }));
}

/**
 * Mark a user as staff (sets isStaff=true). No-op if already staff.
 */
export async function markUserAsStaff(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isStaff: true }).where(eq(users.id, userId));
}

/**
 * Remove staff status from a user (reverts to regular student)
 */
export async function removeStaffStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Remove all roles first
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  // Remove staff flag
  await db.update(users).set({ isStaff: false }).where(eq(users.id, userId));
  logger.db('Staff status removed', { userId });
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

/** Edit a support message's content. Returns the updated message or null. */
export async function editSupportMessage(messageId: number, senderId: number, newContent: string) {
  const db = await getDb();
  if (!db) return null;
  const [msg] = await db.select().from(supportMessages).where(eq(supportMessages.id, messageId)).limit(1);
  if (!msg || msg.senderId !== senderId) return null;
  if (msg.deletedAt) return null; // can't edit deleted
  const [updated] = await db.update(supportMessages)
    .set({ content: newContent, editedAt: new Date().toISOString() })
    .where(eq(supportMessages.id, messageId))
    .returning();
  return updated;
}

/** Soft-delete a support message. Returns true on success. */
export async function deleteSupportMessage(messageId: number, senderId: number, isStaff: boolean) {
  const db = await getDb();
  if (!db) return false;
  const [msg] = await db.select().from(supportMessages).where(eq(supportMessages.id, messageId)).limit(1);
  if (!msg) return false;
  // Staff can delete any non-client message; clients can only delete their own
  if (!isStaff && msg.senderId !== senderId) return false;
  if (isStaff && msg.senderType === 'client') return false;
  if (msg.deletedAt) return false; // already deleted
  await db.update(supportMessages)
    .set({ deletedAt: new Date().toISOString(), content: '' })
    .where(eq(supportMessages.id, messageId));
  return true;
}

export async function getAllSupportConversations(searchQuery?: string) {
  const db = await getDb();
  if (!db) return [];

  const conversations = await db
    .select({
      id: supportConversations.id,
      userId: supportConversations.userId,
      status: supportConversations.status,
      needsHuman: supportConversations.needsHuman,
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

export async function setNeedsHuman(conversationId: number, value: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportConversations)
    .set({ needsHuman: value, updatedAt: new Date().toISOString() })
    .where(eq(supportConversations.id, conversationId));
}

export async function reopenSupportConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportConversations)
    .set({ status: "open", closedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(supportConversations.id, conversationId));
}

const BUG_REPORT_RISK_LABELS: Record<BugReportRiskLevel, { en: string; ar: string }> = {
  low: { en: 'Low Risk', ar: 'مخاطر منخفضة' },
  medium: { en: 'Medium Risk', ar: 'مخاطر متوسطة' },
  high: { en: 'High Risk', ar: 'مخاطر عالية' },
  critical: { en: 'Critical Risk', ar: 'مخاطر حرجة' },
};

function isBugReportRiskLevel(value: string | null | undefined): value is BugReportRiskLevel {
  return !!value && (BUG_REPORT_RISK_LEVELS as readonly string[]).includes(value);
}

function getBugReportReviewerContext(reviewerContextId: number) {
  if (reviewerContextId < 0) {
    return {
      reviewedByType: 'admin' as const,
      reviewedById: Math.abs(reviewerContextId),
    };
  }

  return {
    reviewedByType: 'staff' as const,
    reviewedById: reviewerContextId,
  };
}

async function getBugReportRewardTransaction(reportId: number) {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db.select().from(pointsTransactions)
    .where(and(
      eq(pointsTransactions.referenceType, 'bug_report'),
      eq(pointsTransactions.referenceId, reportId),
      sql`${pointsTransactions.amount} > 0`,
    ))
    .orderBy(desc(pointsTransactions.createdAt))
    .limit(1);

  return row ?? null;
}

export async function createBugReport(input: {
  userId: number;
  description?: string | null;
  imageUrl?: string | null;
}): Promise<BugReport> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const description = input.description?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;

  if (!description && !imageUrl) {
    throw new Error('Description or image is required');
  }

  const now = new Date().toISOString();
  const [row] = await db.insert(bugReports).values({
    userId: input.userId,
    description,
    imageUrl,
    status: 'pending',
    awardedPoints: 0,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return row;
}

export async function getMyBugReports(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(bugReports)
    .where(eq(bugReports.userId, userId))
    .orderBy(desc(bugReports.createdAt), desc(bugReports.id));
}

export async function listBugReports(filters?: { status?: BugReportStatus }) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(bugReports.status, filters.status));

  return db.select({
    id: bugReports.id,
    userId: bugReports.userId,
    description: bugReports.description,
    imageUrl: bugReports.imageUrl,
    status: bugReports.status,
    riskLevel: bugReports.riskLevel,
    awardedPoints: bugReports.awardedPoints,
    adminNote: bugReports.adminNote,
    reviewedAt: bugReports.reviewedAt,
    reviewedByType: bugReports.reviewedByType,
    reviewedById: bugReports.reviewedById,
    createdAt: bugReports.createdAt,
    updatedAt: bugReports.updatedAt,
    userName: users.name,
    userEmail: users.email,
  }).from(bugReports)
    .innerJoin(users, eq(users.id, bugReports.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bugReports.createdAt), desc(bugReports.id));
}

export async function reviewBugReport(input: {
  reportId: number;
  reviewerContextId: number;
  decision: 'rewarded' | 'rejected';
  riskLevel?: BugReportRiskLevel | null;
  awardedPoints?: number;
  adminNote?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [report] = await db.select().from(bugReports).where(eq(bugReports.id, input.reportId)).limit(1);
  if (!report) throw new Error('Bug report not found');

  const existingReward = await getBugReportRewardTransaction(report.id);
  const reviewer = getBugReportReviewerContext(input.reviewerContextId);
  const now = new Date().toISOString();
  const adminNote = input.adminNote?.trim() || null;

  if (report.status !== 'pending') {
    if (report.status === input.decision) {
      return {
        success: true,
        alreadyReviewed: true,
        reportId: report.id,
        status: report.status,
        awardedPoints: Number(report.awardedPoints ?? 0),
      };
    }

    throw new Error('Bug report has already been reviewed');
  }

  if (input.decision === 'rewarded') {
    const riskLevel = input.riskLevel;
    const requestedPoints = Math.max(0, Math.floor(Number(input.awardedPoints ?? 0)));

    if (!riskLevel || !isBugReportRiskLevel(riskLevel)) {
      throw new Error('Risk level is required');
    }

    if (requestedPoints < 1 && !existingReward) {
      throw new Error('Points must be at least 1');
    }

    if (existingReward && Number(existingReward.amount ?? 0) <= 0) {
      throw new Error('Invalid existing reward transaction');
    }

    const rewardTx = existingReward ?? await addPoints({
      userId: report.userId,
      amount: requestedPoints,
      type: 'bonus',
      reasonEn: `Bug report reward (${BUG_REPORT_RISK_LABELS[riskLevel].en})`,
      reasonAr: `مكافأة بلاغ خطأ (${BUG_REPORT_RISK_LABELS[riskLevel].ar})`,
      referenceId: report.id,
      referenceType: 'bug_report',
    });

    const awardedPoints = Math.max(requestedPoints, Number(rewardTx.amount ?? 0));

    await db.update(bugReports).set({
      status: 'rewarded',
      riskLevel,
      awardedPoints,
      adminNote,
      reviewedAt: now,
      reviewedByType: reviewer.reviewedByType,
      reviewedById: reviewer.reviewedById,
      updatedAt: now,
    }).where(eq(bugReports.id, report.id));

    await logAdminAction(input.reviewerContextId, report.userId, 'reward_bug_report', {
      reportId: report.id,
      awardedPoints,
      riskLevel,
      reviewedByType: reviewer.reviewedByType,
    });

    await createNotification({
      userId: report.userId,
      type: 'success',
      titleEn: 'Bug report accepted',
      titleAr: 'تم قبول بلاغ الخطأ',
      contentEn: awardedPoints > 0
        ? `Your bug report was accepted and ${awardedPoints} points were added to your balance.`
        : 'Your bug report was accepted.',
      contentAr: awardedPoints > 0
        ? `تم قبول بلاغ الخطأ وإضافة ${awardedPoints} نقطة إلى رصيدك.`
        : 'تم قبول بلاغ الخطأ بنجاح.',
      actionUrl: '/support?tab=bugs',
    });

    return {
      success: true,
      alreadyReviewed: false,
      reportId: report.id,
      status: 'rewarded' as const,
      awardedPoints,
    };
  }

  if (existingReward) {
    throw new Error('This bug report already has a reward transaction');
  }

  await db.update(bugReports).set({
    status: 'rejected',
    riskLevel: null,
    awardedPoints: 0,
    adminNote,
    reviewedAt: now,
    reviewedByType: reviewer.reviewedByType,
    reviewedById: reviewer.reviewedById,
    updatedAt: now,
  }).where(eq(bugReports.id, report.id));

  await logAdminAction(input.reviewerContextId, report.userId, 'reject_bug_report', {
    reportId: report.id,
    reviewedByType: reviewer.reviewedByType,
  });

  await createNotification({
    userId: report.userId,
    type: 'warning',
    titleEn: 'Bug report reviewed',
    titleAr: 'تمت مراجعة بلاغ الخطأ',
    contentEn: adminNote
      ? `Your bug report was not accepted. Team note: ${adminNote}`
      : 'Your bug report was reviewed and was not accepted this time.',
    contentAr: adminNote
      ? `لم يتم قبول بلاغ الخطأ. ملاحظة الفريق: ${adminNote}`
      : 'تمت مراجعة بلاغ الخطأ ولم يتم قبوله هذه المرة.',
    actionUrl: '/support?tab=bugs',
  });

  return {
    success: true,
    alreadyReviewed: false,
    reportId: report.id,
    status: 'rejected' as const,
    awardedPoints: 0,
  };
}

/** Auto-close open conversations with no activity for `days` days. Returns count closed. */
export async function autoCloseStaleConversations(days: number = 3): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Find stale open conversations
  const stale = await db.select({ id: supportConversations.id })
    .from(supportConversations)
    .where(
      and(
        eq(supportConversations.status, "open"),
        sql`${supportConversations.updatedAt} < ${cutoff}`
      )
    );

  if (stale.length === 0) return 0;

  const ids = stale.map(c => c.id);

  // Insert a system bot message in each conversation
  for (const convId of ids) {
    await db.insert(supportMessages).values({
      conversationId: convId,
      senderId: 0,
      senderType: "bot",
      content: "تم إغلاق هذه المحادثة تلقائيًا لعدم وجود نشاط خلال 3 أيام. يمكنك إعادة فتحها في أي وقت.\n\nThis conversation was automatically closed due to 3 days of inactivity. You can reopen it anytime.",
      createdAt: now,
    });
  }

  // Batch close all stale conversations
  await db.update(supportConversations)
    .set({ status: "closed", closedAt: now, updatedAt: now })
    .where(inArray(supportConversations.id, ids));

  return ids.length;
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
  const studyPeriodDays = await getStudyPeriodDays();
  const entitlementDays = await getUserEntitlementDays(userId);

  // Broker gate only — course completion has zero effect on activation
  const [userRow] = await db.select({ brokerOnboardingComplete: users.brokerOnboardingComplete })
    .from(users).where(eq(users.id, userId)).limit(1);
  const brokerComplete = !!userRow?.brokerOnboardingComplete;

  // If broker gate cleared, auto-activate any pending subs
  if (brokerComplete) {
    const [pendingLex] = await db.select({ id: lexaiSubscriptions.id })
      .from(lexaiSubscriptions)
      .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isPendingActivation, true)))
      .limit(1);
    const [pendingRec] = await db.select({ id: recommendationSubscriptions.id })
      .from(recommendationSubscriptions)
      .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isPendingActivation, true)))
      .limit(1);
    if (pendingLex || pendingRec) {
      await activateStudentSubscriptions(userId, false);
    }
    return {
      hasPending: false,
      lexai: null,
      recommendation: null,
      progressPercent: 100,
      studyPeriodDays,
      entitlementDays,
      maxActivationDate: null,
    };
  }

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

  // Auto-activate after study period regardless of broker status
  const now = new Date();
  if (lexaiSub?.maxActivationDate && new Date(lexaiSub.maxActivationDate) <= now) {
    await activateStudentSubscriptions(userId, true);
    return {
      hasPending: false,
      lexai: null,
      recommendation: null,
      progressPercent: 0,
      studyPeriodDays,
      entitlementDays,
      maxActivationDate: lexaiSub.maxActivationDate,
    };
  }
  if (!lexaiSub && recSub?.maxActivationDate && new Date(recSub.maxActivationDate) <= now) {
    await activateStudentSubscriptions(userId, true);
    return {
      hasPending: false,
      lexai: null,
      recommendation: null,
      progressPercent: 0,
      studyPeriodDays,
      entitlementDays,
      maxActivationDate: recSub.maxActivationDate,
    };
  }

  return {
    hasPending: !!(lexaiSub || recSub),
    lexai: lexaiSub ?? null,
    recommendation: recSub ?? null,
    progressPercent: 0,
    canActivate: false,
    studyPeriodDays,
    entitlementDays,
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
  const entitlementDays = await getUserEntitlementDays(userId);
  const DAY_MS = 24 * 60 * 60 * 1000;

  console.log(`[activateSubs] userId=${userId} auto=${isAutoActivation} entitlementDays=${entitlementDays}`);

  // Activate ALL pending subs (not just the first) to handle duplicate subscriptions
  const pendingLexai = await db
    .select()
    .from(lexaiSubscriptions)
    .where(and(eq(lexaiSubscriptions.userId, userId), eq(lexaiSubscriptions.isPendingActivation, true)));

  const pendingRec = await db
    .select()
    .from(recommendationSubscriptions)
    .where(and(eq(recommendationSubscriptions.userId, userId), eq(recommendationSubscriptions.isPendingActivation, true)));

  const nowStr = now.toISOString();

  for (const sub of pendingLexai) {
    // Cap: endDate = min(now + entitlementDays, maxActivationDate + entitlementDays)
    let endDate = new Date(now.getTime() + entitlementDays * DAY_MS);
    if (sub.maxActivationDate) {
      const absoluteMax = new Date(new Date(sub.maxActivationDate).getTime() + entitlementDays * DAY_MS);
      if (absoluteMax < endDate) endDate = absoluteMax;
    }
    const endStr = endDate.toISOString();
    console.log(`[activateSubs] LexAI id=${sub.id} oldEnd=${sub.endDate} newEnd=${endStr} maxAct=${sub.maxActivationDate}`);
    await db.update(lexaiSubscriptions).set({
      isPendingActivation: false,
      studentActivatedAt: nowStr,
      startDate: nowStr,
      endDate: endStr,
      updatedAt: nowStr,
    }).where(eq(lexaiSubscriptions.id, sub.id));
  }

  for (const sub of pendingRec) {
    let endDate = new Date(now.getTime() + entitlementDays * DAY_MS);
    if (sub.maxActivationDate) {
      const absoluteMax = new Date(new Date(sub.maxActivationDate).getTime() + entitlementDays * DAY_MS);
      if (absoluteMax < endDate) endDate = absoluteMax;
    }
    const endStr = endDate.toISOString();
    console.log(`[activateSubs] Rec id=${sub.id} oldEnd=${sub.endDate} newEnd=${endStr} maxAct=${sub.maxActivationDate}`);
    await db.update(recommendationSubscriptions).set({
      isPendingActivation: false,
      studentActivatedAt: nowStr,
      startDate: nowStr,
      endDate: endStr,
      updatedAt: nowStr,
    }).where(eq(recommendationSubscriptions.id, sub.id));
  }

  // Notify student that LexAI/Rec access is now active
  if (pendingLexai.length > 0) {
    await createNotification({
      userId,
      type: 'success',
      titleAr: 'تم تفعيل LexAI 🌟',
      titleEn: 'LexAI Access Activated 🌟',
      contentAr: `يمكنك الآن استخدام LexAI. اشتراكك فعّال لمدة ${entitlementDays} يوم.`,
      contentEn: `You now have LexAI access. Your subscription is active for ${entitlementDays} days.`,
      actionUrl: '/lexai',
    }).catch(() => {});
  }
  if (pendingRec.length > 0) {
    await createNotification({
      userId,
      type: 'success',
      titleAr: 'تم تفعيل قروب التوصيات 📈',
      titleEn: 'Recommendations Access Activated 📈',
      contentAr: `يمكنك الآن الوصول لقروب التوصيات. اشتراكك فعّال لمدة ${entitlementDays} يوم.`,
      contentEn: `You now have Recommendations access. Your subscription is active for ${entitlementDays} days.`,
      actionUrl: '/recommendations',
    }).catch(() => {});
  }

  return {
    activated: !!(pendingLexai.length || pendingRec.length),
    isAutoActivation,
    endDate: nowStr,
  };
}

/**
 * Get a student's full subscription timeline for admin troubleshooting and student visibility.
 * Returns key events in chronological order.
 */
export async function getStudentTimeline(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const events: Array<{
    date: string;
    type: string;
    labelEn: string;
    labelAr: string;
    details?: string;
  }> = [];

  // 1. Registration date
  const [user] = await db.select({
    createdAt: users.createdAt,
    email: users.email,
    brokerOnboardingComplete: users.brokerOnboardingComplete,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.createdAt) {
    events.push({ date: user.createdAt, type: 'registration', labelEn: 'Account Created', labelAr: 'إنشاء الحساب' });
  }

  // 2. Package key activations
  const keys = user?.email
    ? await db.select({
        activatedAt: registrationKeys.activatedAt,
        packageId: registrationKeys.packageId,
      }).from(registrationKeys)
        .where(and(
          sql`LOWER(${registrationKeys.email}) = LOWER(${user.email})`,
          sql`${registrationKeys.activatedAt} IS NOT NULL`,
          sql`${registrationKeys.packageId} IS NOT NULL`,
        ))
        .orderBy(registrationKeys.activatedAt)
    : [];
  for (const key of keys) {
    if (key.activatedAt) {
      const pkg = key.packageId ? await getPackageById(key.packageId) : null;
      events.push({
        date: key.activatedAt,
        type: 'key_activated',
        labelEn: `Package Key Activated: ${pkg?.nameEn ?? 'Unknown'}`,
        labelAr: `تفعيل مفتاح الباقة: ${pkg?.nameAr ?? 'غير معروف'}`,
      });
    }
  }

  // 3. Course enrollment
  const enrollmentRows = await db.select({
    enrolledAt: enrollments.enrolledAt,
    completedAt: enrollments.completedAt,
    isAdminSkipped: enrollments.isAdminSkipped,
    progressPercentage: enrollments.progressPercentage,
  }).from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(enrollments.enrolledAt);
  for (const e of enrollmentRows) {
    if (e.enrolledAt) {
      events.push({ date: e.enrolledAt, type: 'enrolled', labelEn: 'Course Enrolled', labelAr: 'تسجيل في الدورة' });
    }
    if (e.completedAt) {
      events.push({ date: e.completedAt, type: 'course_completed', labelEn: 'Course Completed', labelAr: 'إكمال الدورة' });
    }
    if (e.isAdminSkipped) {
      // Find the admin action timestamp
      const [skipAction] = await db.select({ createdAt: adminActions.createdAt })
        .from(adminActions)
        .where(and(eq(adminActions.userId, userId), eq(adminActions.action, 'skip_course')))
        .orderBy(desc(adminActions.createdAt)).limit(1);
      events.push({
        date: skipAction?.createdAt ?? e.enrolledAt ?? new Date().toISOString(),
        type: 'course_skipped',
        labelEn: 'Course Skipped (Admin)',
        labelAr: 'تخطي الدورة (مشرف)',
      });
    }
  }

  // 4. Broker onboarding
  if (user?.brokerOnboardingComplete) {
    const [skipAction] = await db.select({ createdAt: adminActions.createdAt })
      .from(adminActions)
      .where(and(eq(adminActions.userId, userId), eq(adminActions.action, 'skip_broker_onboarding')))
      .orderBy(desc(adminActions.createdAt)).limit(1);
    if (skipAction) {
      events.push({ date: skipAction.createdAt, type: 'broker_skipped', labelEn: 'Broker Skipped (Admin)', labelAr: 'تخطي الوسيط (مشرف)' });
    } else {
      // Genuinely completed - get last approved step date
      const [lastStep] = await db.select({ reviewedAt: brokerOnboarding.reviewedAt })
        .from(brokerOnboarding)
        .where(and(eq(brokerOnboarding.userId, userId), eq(brokerOnboarding.status, 'approved')))
        .orderBy(desc(brokerOnboarding.reviewedAt)).limit(1);
      if (lastStep?.reviewedAt) {
        events.push({ date: lastStep.reviewedAt, type: 'broker_completed', labelEn: 'Broker Onboarding Completed', labelAr: 'إكمال فتح حساب الوسيط' });
      }
    }
  }

  // 5. LexAI subscription events
  const [lexSub] = await db.select({
    startDate: lexaiSubscriptions.startDate,
    endDate: lexaiSubscriptions.endDate,
    isPendingActivation: lexaiSubscriptions.isPendingActivation,
    studentActivatedAt: lexaiSubscriptions.studentActivatedAt,
  }).from(lexaiSubscriptions)
    .where(eq(lexaiSubscriptions.userId, userId))
    .orderBy(desc(lexaiSubscriptions.startDate)).limit(1);
  if (lexSub) {
    if (lexSub.isPendingActivation) {
      events.push({ date: lexSub.startDate, type: 'lexai_pending', labelEn: 'LexAI: Pending Activation', labelAr: 'LexAI: في انتظار التفعيل' });
    } else {
      if (lexSub.studentActivatedAt) {
        events.push({ date: lexSub.studentActivatedAt, type: 'lexai_activated', labelEn: 'LexAI Activated', labelAr: 'تفعيل LexAI' });
      }
      if (lexSub.endDate) {
        events.push({ date: lexSub.endDate, type: 'lexai_expires', labelEn: 'LexAI Expires', labelAr: 'انتهاء LexAI' });
      }
    }
  }

  // 6. Recommendation subscription events
  const [recSub] = await db.select({
    startDate: recommendationSubscriptions.startDate,
    endDate: recommendationSubscriptions.endDate,
    isPendingActivation: recommendationSubscriptions.isPendingActivation,
    studentActivatedAt: recommendationSubscriptions.studentActivatedAt,
  }).from(recommendationSubscriptions)
    .where(eq(recommendationSubscriptions.userId, userId))
    .orderBy(desc(recommendationSubscriptions.startDate)).limit(1);
  if (recSub) {
    if (recSub.isPendingActivation) {
      events.push({ date: recSub.startDate, type: 'rec_pending', labelEn: 'Recommendations: Pending Activation', labelAr: 'التوصيات: في انتظار التفعيل' });
    } else {
      if (recSub.studentActivatedAt) {
        events.push({ date: recSub.studentActivatedAt, type: 'rec_activated', labelEn: 'Recommendations Activated', labelAr: 'تفعيل التوصيات' });
      }
      if (recSub.endDate) {
        events.push({ date: recSub.endDate, type: 'rec_expires', labelEn: 'Recommendations Expires', labelAr: 'انتهاء التوصيات' });
      }
    }
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
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

export async function getTestimonialProofs(input: {
  surface: 'home' | 'dashboard';
  packageSlug?: string;
  courseId?: number;
  serviceKey?: string;
  limit?: number;
}): Promise<Testimonial[]> {
  const db = await getDb();
  if (!db) return [];

  const surfaceColumn = input.surface === 'home'
    ? testimonials.showProofOnHome
    : testimonials.showProofOnDashboard;

  const conditions = [
    eq(testimonials.isPublished, true),
    eq(surfaceColumn, true),
    isNotNull(testimonials.proofImageUrl),
    ne(testimonials.proofImageUrl, ''),
  ];

  if (input.packageSlug) {
    conditions.push(eq(testimonials.packageSlug, input.packageSlug));
  }
  if (typeof input.courseId === 'number') {
    conditions.push(eq(testimonials.courseId, input.courseId));
  }
  if (input.serviceKey) {
    conditions.push(eq(testimonials.serviceKey, input.serviceKey));
  }

  const query = db
    .select()
    .from(testimonials)
    .where(and(...conditions))
    .orderBy(testimonials.displayOrder);

  if (typeof input.limit === 'number' && input.limit > 0) {
    return query.limit(input.limit);
  }

  return query;
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
  
  // Get all users (exclude staff members)
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
    brokerOnboardingComplete: users.brokerOnboardingComplete,
  }).from(users).where(eq(users.isStaff, false)).orderBy(desc(users.createdAt));

  // Get all package subscriptions
  const allPkgSubs = await db.select().from(packageSubscriptions);
  // Get all packages
  const allPackages = await db.select().from(packages);
  // Get all activated keys (the real revenue source)
  const allKeys = await db.select().from(registrationKeys)
    .where(sql`${registrationKeys.packageId} IS NOT NULL`);
  // Get enrollments for skip status
  const allEnrollments = await db.select({
    userId: enrollments.userId,
    courseId: enrollments.courseId,
    isAdminSkipped: enrollments.isAdminSkipped,
    progressPercentage: enrollments.progressPercentage,
    completedAt: enrollments.completedAt,
  }).from(enrollments);

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

    // Enrollment info (main course = courseId 1)
    const enrollment = allEnrollments.find(e => e.userId === u.id && e.courseId === 1);

    return {
      ...u,
      totalKeys: userKeys.length,
      totalSpent, // already in dollars (key prices are stored in dollars)
      activePackages: activePackageNames,
      activePackagesAr: activePackageNamesAr,
      subscriptionCount: userSubs.length,
      renewalCount,
      isAdminSkipped: enrollment?.isAdminSkipped ?? false,
      courseProgress: enrollment?.progressPercentage ?? 0,
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

  // Package subscriptions (only — lexai/recommendations are legacy, managed via packages now)
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
      subscriptionNameAr: pkg?.nameAr || pkg?.nameEn || `Package #${sub.packageId}`,
      startDate: sub.startDate,
      endDate: sub.endDate || 'Lifetime',
      renewalDueDate: sub.renewalDueDate,
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
  contentEn?: string; contentAr?: string; actionUrl?: string; batchId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date().toISOString();
  const values = input.userIds.map(userId => ({
    userId, type: input.type || 'info', titleEn: input.titleEn, titleAr: input.titleAr,
    contentEn: input.contentEn, contentAr: input.contentAr, actionUrl: input.actionUrl,
    batchId: input.batchId || null,
    createdAt: now,
  }));
  if (values.length) await db.insert(userNotifications).values(values);
}

export async function getStudentsForNotification(): Promise<{ id: number; name: string | null; email: string; hasActivePackage: boolean }[]> {
  const db = await getDb();
  if (!db) return [];
  const students = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.isStaff, false)).orderBy(users.name);
  const activeSubs = await db.select({ userId: packageSubscriptions.userId })
    .from(packageSubscriptions).where(eq(packageSubscriptions.isActive, true));
  const activeUserIds = new Set(activeSubs.map(s => s.userId));
  return students.map(s => ({ ...s, hasActivePackage: activeUserIds.has(s.id) }));
}

export async function getRecentSentNotifications(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    batchId: userNotifications.batchId,
    titleEn: userNotifications.titleEn,
    titleAr: userNotifications.titleAr,
    contentEn: userNotifications.contentEn,
    contentAr: userNotifications.contentAr,
    type: userNotifications.type,
    createdAt: userNotifications.createdAt,
    recipientCount: sql<number>`COUNT(*)`,
    emailSentCount: sql<number>`SUM(CASE WHEN ${userNotifications.emailSent} = 1 THEN 1 ELSE 0 END)`,
  }).from(userNotifications)
    .where(isNotNull(userNotifications.batchId))
    .groupBy(userNotifications.batchId)
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);
}

export async function getNotificationRecipients(batchId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: userNotifications.userId,
    emailSent: userNotifications.emailSent,
    name: users.name,
    email: users.email,
  }).from(userNotifications)
    .innerJoin(users, eq(userNotifications.userId, users.id))
    .where(eq(userNotifications.batchId, batchId))
    .orderBy(users.name);
}

export async function markNotificationEmailSent(batchId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userNotifications)
    .set({ emailSent: true })
    .where(and(eq(userNotifications.batchId, batchId), eq(userNotifications.userId, userId)));
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

// ── Broker CRUD ──────────────────────────────────────────

export async function getAllBrokers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brokers).orderBy(brokers.displayOrder);
}

export async function getActiveBrokers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brokers)
    .where(eq(brokers.isActive, true))
    .orderBy(brokers.displayOrder);
}

export async function getBrokerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brokers).where(eq(brokers.id, id));
  return rows[0] ?? null;
}

export async function createBroker(data: Omit<NewBroker, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const result = await db.insert(brokers).values({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { id: Number(result.lastInsertRowid) };
}

export async function updateBroker(id: number, data: Partial<Omit<NewBroker, 'id' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(brokers).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }).where(eq(brokers.id, id));
  return { success: true };
}

export async function deleteBroker(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(brokers).where(eq(brokers.id, id));
  return { success: true };
}

// ── Points Rules ────────────────────────────────────────────

export async function getPointsRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pointsRules).orderBy(pointsRules.id);
}

export async function getActivePointsRule(ruleKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pointsRules)
    .where(and(eq(pointsRules.ruleKey, ruleKey), eq(pointsRules.isActive, true)));
  return rows[0] ?? null;
}

export async function updatePointsRule(id: number, data: { points?: number; isActive?: boolean; maxPerDay?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(pointsRules).set(data).where(eq(pointsRules.id, id));
  return { success: true };
}

// ── Referral System ─────────────────────────────────────────

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getOrCreateReferralCode(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [user] = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId));
  if (user?.referralCode) return user.referralCode;
  // Generate unique code
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      return code;
    } catch {
      // collision — retry
    }
  }
  throw new Error('Failed to generate unique referral code');
}

export async function getUserByReferralCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.referralCode, code.toUpperCase()));
  return rows[0] ?? null;
}

export async function createReferral(referrerId: number, refereeId: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // Check if referee already has a referral
  const existing = await db.select().from(referrals).where(eq(referrals.refereeId, refereeId));
  if (existing.length > 0) return null; // already referred
  // Don't allow self-referral
  if (referrerId === refereeId) return null;
  await db.insert(referrals).values({
    referrerId,
    refereeId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  return { success: true };
}

export async function activateReferral(refereeId: number) {
  const db = await getDb();
  if (!db) return null;
  // Find pending referral for this referee
  const rows = await db.select().from(referrals)
    .where(and(eq(referrals.refereeId, refereeId), eq(referrals.status, 'pending')));
  const ref = rows[0];
  if (!ref) return null;

  // Get reward rules
  const referrerRule = await getActivePointsRule('referral_referrer');
  const refereeRule = await getActivePointsRule('referral_referee');
  const referrerPts = referrerRule?.points ?? 200;
  const refereePts = refereeRule?.points ?? 50;

  // Award points to referrer
  await addPoints({
    userId: ref.referrerId,
    amount: referrerPts,
    type: 'bonus',
    reasonEn: 'Referral reward — your friend activated a package!',
    reasonAr: 'مكافأة إحالة — صديقك فعّل باقة!',
    referenceId: refereeId,
    referenceType: 'referral',
  });

  // Award points to referee
  await addPoints({
    userId: refereeId,
    amount: refereePts,
    type: 'bonus',
    reasonEn: 'Welcome bonus — you signed up via a referral!',
    reasonAr: 'مكافأة ترحيبية — سجلت عبر إحالة!',
    referenceId: ref.referrerId,
    referenceType: 'referral',
  });

  // Update referral status
  await db.update(referrals).set({
    status: 'rewarded',
    referrerPoints: referrerPts,
    refereePoints: refereePts,
    activatedAt: new Date().toISOString(),
  }).where(eq(referrals.id, ref.id));

  return { referrerPoints: referrerPts, refereePoints: refereePts };
}

export async function getMyReferrals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: referrals.id,
    refereeId: referrals.refereeId,
    refereeName: users.name,
    refereeEmail: users.email,
    status: referrals.status,
    referrerPoints: referrals.referrerPoints,
    createdAt: referrals.createdAt,
    activatedAt: referrals.activatedAt,
  }).from(referrals)
    .innerJoin(users, eq(referrals.refereeId, users.id))
    .where(eq(referrals.referrerId, userId))
    .orderBy(desc(referrals.createdAt));
}

export async function getReferralStats() {
  const db = await getDb();
  if (!db) return { totalReferrals: 0, activatedReferrals: 0, totalPointsAwarded: 0, topReferrers: [] };

  const total = await db.select({ count: sql<number>`COUNT(*)` }).from(referrals);
  const activated = await db.select({ count: sql<number>`COUNT(*)` }).from(referrals)
    .where(eq(referrals.status, 'rewarded'));
  const pointsSum = await db.select({
    total: sql<number>`COALESCE(SUM(${referrals.referrerPoints} + ${referrals.refereePoints}), 0)`,
  }).from(referrals).where(eq(referrals.status, 'rewarded'));

  const topReferrers = await db.select({
    userId: referrals.referrerId,
    name: users.name,
    email: users.email,
    count: sql<number>`COUNT(*)`,
    totalPoints: sql<number>`SUM(${referrals.referrerPoints})`,
  }).from(referrals)
    .innerJoin(users, eq(referrals.referrerId, users.id))
    .where(eq(referrals.status, 'rewarded'))
    .groupBy(referrals.referrerId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  return {
    totalReferrals: Number(total[0]?.count ?? 0),
    activatedReferrals: Number(activated[0]?.count ?? 0),
    totalPointsAwarded: Number(pointsSum[0]?.total ?? 0),
    topReferrers: topReferrers.map(r => ({
      ...r,
      count: Number(r.count),
      totalPoints: Number(r.totalPoints),
    })),
  };
}

// ── Auto-Award Points by Rule ───────────────────────────────

export async function autoAwardPoints(userId: number, ruleKey: string, meta?: { referenceId?: number; referenceType?: string }) {
  const rule = await getActivePointsRule(ruleKey);
  if (!rule || rule.points <= 0) return null;

  // Check daily cap
  if (rule.maxPerDay) {
    const db = await getDb();
    if (!db) return null;
    const today = new Date().toISOString().slice(0, 10);
    const [count] = await db.select({ c: sql<number>`COUNT(*)` }).from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.userId, userId),
        sql`${pointsTransactions.referenceType} = ${ruleKey}`,
        sql`${pointsTransactions.createdAt} >= ${today}`,
      ));
    if (Number(count?.c ?? 0) >= rule.maxPerDay) return null; // already hit limit
  }

  return addPoints({
    userId,
    amount: rule.points,
    type: 'earn',
    reasonEn: rule.nameEn,
    reasonAr: rule.nameAr,
    referenceId: meta?.referenceId,
    referenceType: ruleKey,
  });
}

// ============================================================================
// Offer Agreements
// ============================================================================

export async function submitOfferAgreement(data: { fullName: string; email: string; phone?: string; offerSlug: string; ipAddress?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // Check for duplicate
  const existing = await db.select().from(offerAgreements)
    .where(and(eq(offerAgreements.email, data.email.toLowerCase().trim()), eq(offerAgreements.offerSlug, data.offerSlug)))
    .limit(1);
  if (existing.length > 0) {
    return { duplicate: true, agreement: existing[0] };
  }
  const [row] = await db.insert(offerAgreements).values({
    fullName: data.fullName.trim(),
    email: data.email.toLowerCase().trim(),
    phone: data.phone?.trim() || '',
    offerSlug: data.offerSlug,
    agreedAt: new Date().toISOString(),
    ipAddress: data.ipAddress || '',
  }).returning();
  return { duplicate: false, agreement: row };
}

export async function listOfferAgreements(offerSlug?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = offerSlug ? [eq(offerAgreements.offerSlug, offerSlug)] : [];
  return db.select().from(offerAgreements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(offerAgreements.agreedAt));
}

export async function deleteOfferAgreement(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(offerAgreements).where(eq(offerAgreements.id, id));
  return { success: true };
}

// ── Broker Onboarding ────────────────────────────────────────
// 3-step wizard: select_broker → open_account (covers opening + verification) → deposit

const ONBOARDING_STEPS = ['select_broker', 'open_account', 'deposit'] as const;
type OnboardingStep = typeof ONBOARDING_STEPS[number];

/**
 * Get a student's full onboarding status (all steps).
 */
export async function getUserOnboardingStatus(userId: number) {
  const db = await getDb();
  if (!db) return { steps: [], isComplete: false, currentStep: 'select_broker' as OnboardingStep, brokerId: null as number | null };

  const rows = await db.select().from(brokerOnboarding)
    .where(eq(brokerOnboarding.userId, userId))
    .orderBy(brokerOnboarding.createdAt);

  // Derive current step: first non-approved step (or all done)
  const approvedSteps = new Set(rows.filter(r => r.status === 'approved').map(r => r.step));
  const currentStep = ONBOARDING_STEPS.find(s => !approvedSteps.has(s)) ?? null;
  const isComplete = ONBOARDING_STEPS.every(s => approvedSteps.has(s));
  const brokerId = rows[0]?.brokerId ?? null;

  return { steps: rows, isComplete, currentStep, brokerId };
}

/**
 * Student selects a broker (step 1 — auto-approved).
 */
export async function selectBrokerForOnboarding(userId: number, brokerId: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const now = new Date().toISOString();

  // Check broker exists and is active
  const broker = await getBrokerById(brokerId);
  if (!broker || !broker.isActive) throw new Error('Broker not found or inactive');

  // Delete any existing onboarding rows for this user (start fresh if selecting different broker)
  await db.delete(brokerOnboarding).where(eq(brokerOnboarding.userId, userId));

  // Create select_broker step as auto-approved
  await db.insert(brokerOnboarding).values({
    userId,
    brokerId,
    step: 'select_broker',
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Pre-create remaining steps as not_started
  for (const step of ['open_account', 'deposit'] as const) {
    await db.insert(brokerOnboarding).values({
      userId,
      brokerId,
      step,
      status: 'not_started',
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

/**
 * Student submits proof for a step.
 */
export async function submitOnboardingProof(userId: number, step: string, proofUrl: string, proofType?: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const now = new Date().toISOString();

  // Validate step is valid
  if (!ONBOARDING_STEPS.includes(step as OnboardingStep)) throw new Error('Invalid step');
  if (step === 'select_broker') throw new Error('Broker selection does not require proof');

  // Get the step row
  const [row] = await db.select().from(brokerOnboarding)
    .where(and(eq(brokerOnboarding.userId, userId), eq(brokerOnboarding.step, step)));

  if (!row) throw new Error('Onboarding step not found — select a broker first');
  if (row.status === 'approved') throw new Error('This step is already approved');

  // Check previous step is approved
  const stepIndex = ONBOARDING_STEPS.indexOf(step as OnboardingStep);
  if (stepIndex > 0) {
    const prevStep = ONBOARDING_STEPS[stepIndex - 1];
    const [prev] = await db.select().from(brokerOnboarding)
      .where(and(eq(brokerOnboarding.userId, userId), eq(brokerOnboarding.step, prevStep)));
    if (!prev || prev.status !== 'approved') {
      throw new Error('Complete the previous step first');
    }
  }

  await db.update(brokerOnboarding).set({
    proofUrl,
    proofType: proofType || null,
    status: 'pending_review',
    submittedAt: now,
    rejectionReason: null,  // Clear any old rejection
    updatedAt: now,
  }).where(eq(brokerOnboarding.id, row.id));

  return { success: true, stepId: row.id };
}

/**
 * Admin: approve an onboarding step.
 */
export async function approveOnboardingStep(stepId: number, adminId: number, adminNote?: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const now = new Date().toISOString();

  const [row] = await db.select().from(brokerOnboarding).where(eq(brokerOnboarding.id, stepId));
  if (!row) throw new Error('Step not found');
  if (row.status === 'approved') throw new Error('Already approved');

  await db.update(brokerOnboarding).set({
    status: 'approved',
    adminNote: adminNote || null,
    reviewedAt: now,
    reviewedBy: adminId,
    updatedAt: now,
  }).where(eq(brokerOnboarding.id, stepId));

  // If this was the last step (deposit), mark user as onboarding complete
  if (row.step === 'deposit') {
    const status = await getUserOnboardingStatus(row.userId);
    if (status.isComplete) {
      await db.update(users).set({ brokerOnboardingComplete: true })
        .where(eq(users.id, row.userId));
    }
  }

  // Log admin action
  await db.insert(adminActions).values({
    adminId,
    userId: row.userId,
    action: 'approve_onboarding_step',
    details: JSON.stringify({ stepId, step: row.step, brokerId: row.brokerId }),
    createdAt: now,
  });

  // Notify student
  const stepLabels: Record<string, [string, string]> = {
    open_account: ['فتح وتوثيق الحساب', 'Account Opening & Verification'],
    deposit: ['الإيداع', 'Deposit'],
  };
  const [labelAr, labelEn] = stepLabels[row.step] || [row.step, row.step];
  await createNotification({
    userId: row.userId,
    type: 'success',
    titleAr: `تمت الموافقة على خطوة ${labelAr}`,
    titleEn: `${labelEn} Step Approved`,
    contentAr: adminId === 0
      ? `تم التحقق تلقائياً والموافقة على خطوة ${labelAr}. يمكنك الانتقال للخطوة التالية.`
      : `تمت مراجعة إثبات ${labelAr} والموافقة عليه. يمكنك الانتقال للخطوة التالية.`,
    contentEn: adminId === 0
      ? `${labelEn} step was auto-verified and approved. You can proceed to the next step.`
      : `Your ${labelEn.toLowerCase()} proof was reviewed and approved. You can proceed to the next step.`,
    actionUrl: '/broker-onboarding',
  });

  return { success: true };
}

/**
 * Admin: reject an onboarding step (student can re-upload).
 */
export async function rejectOnboardingStep(stepId: number, adminId: number, rejectionReason: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const now = new Date().toISOString();

  const [row] = await db.select().from(brokerOnboarding).where(eq(brokerOnboarding.id, stepId));
  if (!row) throw new Error('Step not found');

  await db.update(brokerOnboarding).set({
    status: 'rejected',
    rejectionReason,
    reviewedAt: now,
    reviewedBy: adminId,
    updatedAt: now,
  }).where(eq(brokerOnboarding.id, stepId));

  // Log admin action
  await db.insert(adminActions).values({
    adminId,
    userId: row.userId,
    action: 'reject_onboarding_step',
    details: JSON.stringify({ stepId, step: row.step, brokerId: row.brokerId, reason: rejectionReason }),
    createdAt: now,
  });

  // Notify student
  const stepLabels: Record<string, [string, string]> = {
    open_account: ['فتح وتوثيق الحساب', 'Account Opening & Verification'],
    deposit: ['الإيداع', 'Deposit'],
  };
  const [labelAr, labelEn] = stepLabels[row.step] || [row.step, row.step];
  await createNotification({
    userId: row.userId,
    type: 'warning',
    titleAr: `تم رفض إثبات ${labelAr}`,
    titleEn: `${labelEn} Proof Rejected`,
    contentAr: `تم رفض الإثبات: ${rejectionReason}. يرجى رفع صورة جديدة.`,
    contentEn: `Proof rejected: ${rejectionReason}. Please upload a new screenshot.`,
    actionUrl: '/broker-onboarding',
  });

  return { success: true };
}

/**
 * Admin: save AI verification result on a proof.
 */
export async function saveOnboardingAiResult(stepId: number, aiConfidence: number, aiResult: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  await db.update(brokerOnboarding).set({
    aiConfidence,
    aiResult,
    updatedAt: new Date().toISOString(),
  }).where(eq(brokerOnboarding.id, stepId));

  const [row] = await db.select().from(brokerOnboarding).where(eq(brokerOnboarding.id, stepId));
  if (!row || row.status !== 'pending_review') return { success: true };

  // Auto-approve if confidence >= 90%
  if (aiConfidence >= 0.9) {
    await approveOnboardingStep(stepId, 0, `AI auto-approved (confidence: ${(aiConfidence * 100).toFixed(0)}%)`);
  }
  // Auto-reject if confidence < 50% — let student re-upload immediately
  else if (aiConfidence < 0.5) {
    await rejectOnboardingStep(stepId, 0, aiResult || 'The uploaded image does not appear to be valid proof for this step. Please upload a clear screenshot.');
  }

  return { success: true };
}

/**
 * Admin: get all pending onboarding proofs for review.
 */
export async function getPendingOnboardingProofs() {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({
    id: brokerOnboarding.id,
    userId: brokerOnboarding.userId,
    brokerId: brokerOnboarding.brokerId,
    step: brokerOnboarding.step,
    status: brokerOnboarding.status,
    proofUrl: brokerOnboarding.proofUrl,
    proofType: brokerOnboarding.proofType,
    aiConfidence: brokerOnboarding.aiConfidence,
    aiResult: brokerOnboarding.aiResult,
    adminNote: brokerOnboarding.adminNote,
    rejectionReason: brokerOnboarding.rejectionReason,
    submittedAt: brokerOnboarding.submittedAt,
    reviewedAt: brokerOnboarding.reviewedAt,
    createdAt: brokerOnboarding.createdAt,
    userName: users.name,
    userEmail: users.email,
    brokerName: brokers.nameEn,
  }).from(brokerOnboarding)
    .innerJoin(users, eq(users.id, brokerOnboarding.userId))
    .innerJoin(brokers, eq(brokers.id, brokerOnboarding.brokerId))
    .where(eq(brokerOnboarding.status, 'pending_review'))
    .orderBy(brokerOnboarding.submittedAt);

  return rows;
}

/**
 * Admin: get all onboarding records (with filters).
 */
export async function getAllOnboardingRecords(filters?: { status?: string; step?: string }) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(brokerOnboarding.status, filters.status));
  if (filters?.step) conditions.push(eq(brokerOnboarding.step, filters.step));

  return db.select({
    id: brokerOnboarding.id,
    userId: brokerOnboarding.userId,
    brokerId: brokerOnboarding.brokerId,
    step: brokerOnboarding.step,
    status: brokerOnboarding.status,
    proofUrl: brokerOnboarding.proofUrl,
    proofType: brokerOnboarding.proofType,
    aiConfidence: brokerOnboarding.aiConfidence,
    aiResult: brokerOnboarding.aiResult,
    adminNote: brokerOnboarding.adminNote,
    rejectionReason: brokerOnboarding.rejectionReason,
    submittedAt: brokerOnboarding.submittedAt,
    reviewedAt: brokerOnboarding.reviewedAt,
    createdAt: brokerOnboarding.createdAt,
    userName: users.name,
    userEmail: users.email,
    brokerName: brokers.nameEn,
  }).from(brokerOnboarding)
    .innerJoin(users, eq(users.id, brokerOnboarding.userId))
    .innerJoin(brokers, eq(brokers.id, brokerOnboarding.brokerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(brokerOnboarding.updatedAt));
}

/**
 * Check if a user has completed broker onboarding.
 * Used for gating LexAI/Recommendations access.
 */
export async function isUserBrokerOnboardingComplete(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Fast path: check the flag on users table
  const [user] = await db.select({ flag: users.brokerOnboardingComplete })
    .from(users).where(eq(users.id, userId));
  if (user?.flag) return true;

  // Fallback: check all steps approved
  const status = await getUserOnboardingStatus(userId);
  if (status.isComplete) {
    // Update the flag for next time
    await db.update(users).set({ brokerOnboardingComplete: true })
      .where(eq(users.id, userId));
    return true;
  }
  return false;
}

// ============================================================================
// Email Log — automated email tracking (prevents duplicate sends)
// ============================================================================

export async function logEmailSent(userId: number, emailType: string, metadata?: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(emailLog).values({
      userId,
      emailType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {
    // UNIQUE constraint = already sent, silently ignore
  }
}

export async function hasEmailBeenSent(userId: number, emailType: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true; // fail-safe: assume sent to avoid spam
  const [row] = await db.select({ id: emailLog.id })
    .from(emailLog)
    .where(and(eq(emailLog.userId, userId), eq(emailLog.emailType, emailType)))
    .limit(1);
  return !!row;
}

/**
 * Find active subscribers who activated exactly N days ago and haven't received drip_day_N email.
 */
export async function getUsersForDripEmail(dayNumber: number): Promise<Array<{
  userId: number; email: string; name: string | null; packageName: string;
  packageNameAr: string; includesLexai: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];
  const emailType = `drip_day_${dayNumber}`;

  // Find users whose packageSubscription startDate is exactly N days ago
  // Exclude users who already completed broker onboarding (they already have LexAI/Rec active)
  const results = await db
    .select({
      userId: packageSubscriptions.userId,
      email: users.email,
      name: users.name,
      packageName: packages.nameEn,
      packageNameAr: packages.nameAr,
      includesLexai: packages.includesLexai,
    })
    .from(packageSubscriptions)
    .innerJoin(users, eq(packageSubscriptions.userId, users.id))
    .innerJoin(packages, eq(packageSubscriptions.packageId, packages.id))
    .where(and(
      eq(packageSubscriptions.isActive, true),
      sql`date(${packageSubscriptions.startDate}) = date('now', '-${sql.raw(String(dayNumber))} days')`,
      eq(users.isStaff, false),
      sql`${users.brokerOnboardingComplete} IS NOT 1`,
    ));

  // Filter out users who already received this drip email
  const filtered: typeof results = [];
  for (const r of results) {
    const sent = await hasEmailBeenSent(r.userId, emailType);
    if (!sent) filtered.push(r);
  }
  return filtered.map(r => ({
    userId: r.userId,
    email: r.email,
    name: r.name,
    packageName: r.packageName || 'XFlex Package',
    packageNameAr: r.packageNameAr || 'باقة XFlex',
    includesLexai: !!r.includesLexai,
  }));
}

/**
 * Find users inactive for N+ days who still have active subscriptions.
 */
export async function getInactiveUsers(inactiveDays: number): Promise<Array<{
  userId: number; email: string; name: string | null; daysSinceActive: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  const emailType = `inactivity_${inactiveDays}`;

  const results = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .innerJoin(packageSubscriptions, eq(users.id, packageSubscriptions.userId))
    .where(and(
      eq(packageSubscriptions.isActive, true),
      eq(users.isStaff, false),
      sql`${users.lastActiveAt} IS NOT NULL`,
      sql`julianday('now') - julianday(${users.lastActiveAt}) >= ${inactiveDays}`,
    ));

  // Deduplicate by userId (user may have multiple active subs)
  const seen = new Set<number>();
  const unique = results.filter(r => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });

  const filtered: Array<{
    userId: number; email: string; name: string | null; daysSinceActive: number;
  }> = [];
  for (const r of unique) {
    const sent = await hasEmailBeenSent(r.userId, emailType);
    if (!sent) {
      const days = r.lastActiveAt
        ? Math.floor((Date.now() - new Date(r.lastActiveAt).getTime()) / 86400000)
        : inactiveDays;
      filtered.push({ userId: r.userId, email: r.email, name: r.name, daysSinceActive: days });
    }
  }
  return filtered;
}

/**
 * Find users who have completed exactly N episodes across all courses
 * and haven't received the milestone email yet.
 */
export async function getUsersAtEpisodeMilestone(milestone: number): Promise<Array<{
  userId: number; email: string; name: string | null; completedCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  const emailType = `milestone_${milestone}`;

  const results = await db
    .select({
      userId: episodeProgress.userId,
      completedCount: sql<number>`count(*)`.as('completedCount'),
    })
    .from(episodeProgress)
    .where(eq(episodeProgress.isCompleted, true))
    .groupBy(episodeProgress.userId)
    .having(sql`count(*) >= ${milestone}`);

  const filtered: Array<{
    userId: number; email: string; name: string | null; completedCount: number;
  }> = [];
  for (const r of results) {
    const sent = await hasEmailBeenSent(r.userId, emailType);
    if (sent) continue;
    const [user] = await db.select({ email: users.email, name: users.name, isStaff: users.isStaff })
      .from(users).where(eq(users.id, r.userId)).limit(1);
    if (user && !user.isStaff) {
      filtered.push({
        userId: r.userId,
        email: user.email,
        name: user.name,
        completedCount: r.completedCount,
      });
    }
  }
  return filtered;
}

/**
 * Find broker onboarding steps that have been pending_review for N+ days with no admin action.
 */
export async function getStalledOnboardingUsers(stalledDays: number): Promise<Array<{
  userId: number; email: string; name: string | null; step: string; daysPending: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  const emailType = `onboarding_stalled_${stalledDays}`;

  const results = await db
    .select({
      userId: brokerOnboarding.userId,
      step: brokerOnboarding.step,
      submittedAt: brokerOnboarding.submittedAt,
    })
    .from(brokerOnboarding)
    .where(and(
      eq(brokerOnboarding.status, 'pending_review'),
      sql`${brokerOnboarding.submittedAt} IS NOT NULL`,
      sql`julianday('now') - julianday(${brokerOnboarding.submittedAt}) >= ${stalledDays}`,
    ));

  const filtered: Array<{
    userId: number; email: string; name: string | null; step: string; daysPending: number;
  }> = [];
  for (const r of results) {
    const sent = await hasEmailBeenSent(r.userId, emailType);
    if (sent) continue;
    const [user] = await db.select({ email: users.email, name: users.name })
      .from(users).where(eq(users.id, r.userId)).limit(1);
    if (user) {
      const days = r.submittedAt
        ? Math.floor((Date.now() - new Date(r.submittedAt).getTime()) / 86400000)
        : stalledDays;
      filtered.push({ userId: r.userId, email: user.email, name: user.name, step: r.step, daysPending: days });
    }
  }
  return filtered;
}

/**
 * Get the count of completed episodes for a user (used for milestone checks).
 */
export async function getCompletedEpisodeCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(episodeProgress)
    .where(and(eq(episodeProgress.userId, userId), eq(episodeProgress.isCompleted, true)));
  return result?.count ?? 0;
}

// ============================================================================
// Plan Progress (10-Day Foundation Program)
// ============================================================================

/** Get or create a plan progress record by email */
/** Lookup plan progress by email only (returning users) */
export async function lookupPlanProgress(email: string): Promise<PlanProgress | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(planProgress)
    .where(eq(planProgress.email, email.toLowerCase().trim()))
    .limit(1);
  return row || null;
}

export async function getOrCreatePlanProgress(data: { email: string; fullName: string; phone?: string }): Promise<PlanProgress | null> {
  const db = await getDb();
  if (!db) return null;
  const email = data.email.toLowerCase().trim();

  const existing = await db.select().from(planProgress)
    .where(eq(planProgress.email, email))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [row] = await db.insert(planProgress).values({
    email,
    fullName: data.fullName.trim(),
    phone: data.phone?.trim() || '',
    progress: '{}',
    answers: '{}',
    currentPhase: 1,
    phaseApprovals: '{}',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning();
  return row;
}

/** Update task progress (checkbox toggle) */
export async function updatePlanTaskProgress(email: string, taskId: string, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const emailLower = email.toLowerCase().trim();

  const [existing] = await db.select().from(planProgress)
    .where(eq(planProgress.email, emailLower))
    .limit(1);
  if (!existing) throw new Error('Plan progress record not found');

  const progress = JSON.parse(existing.progress || '{}');
  progress[taskId] = completed;

  await db.update(planProgress).set({
    progress: JSON.stringify(progress),
    updatedAt: new Date().toISOString(),
  }).where(eq(planProgress.id, existing.id));
  return { success: true };
}

/** Update phase answer text */
export async function updatePlanAnswer(email: string, phaseKey: string, answer: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const emailLower = email.toLowerCase().trim();

  const [existing] = await db.select().from(planProgress)
    .where(eq(planProgress.email, emailLower))
    .limit(1);
  if (!existing) throw new Error('Plan progress record not found');

  const answers = JSON.parse(existing.answers || '{}');
  answers[phaseKey] = answer;

  await db.update(planProgress).set({
    answers: JSON.stringify(answers),
    updatedAt: new Date().toISOString(),
  }).where(eq(planProgress.id, existing.id));
  return { success: true };
}

/** Admin: list all plan progress records */
export async function listPlanProgress(): Promise<PlanProgress[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planProgress)
    .orderBy(desc(planProgress.updatedAt));
}

/** Admin: approve a phase for a student */
export async function approvePlanPhase(studentId: number, phase: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  const [existing] = await db.select().from(planProgress)
    .where(eq(planProgress.id, studentId))
    .limit(1);
  if (!existing) throw new Error('Plan progress record not found');

  const approvals = JSON.parse(existing.phaseApprovals || '{}');
  approvals[String(phase)] = true;

  // Advance currentPhase to the next unapproved phase
  let nextPhase = existing.currentPhase;
  for (let p = 1; p <= 6; p++) {
    if (!approvals[String(p)]) {
      nextPhase = p;
      break;
    }
    if (p === 6) nextPhase = 7; // all done
  }

  await db.update(planProgress).set({
    phaseApprovals: JSON.stringify(approvals),
    currentPhase: nextPhase,
    updatedAt: new Date().toISOString(),
  }).where(eq(planProgress.id, existing.id));
  return { success: true };
}

/** Admin: revoke phase approval */
export async function revokePlanPhase(studentId: number, phase: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  const [existing] = await db.select().from(planProgress)
    .where(eq(planProgress.id, studentId))
    .limit(1);
  if (!existing) throw new Error('Plan progress record not found');

  const approvals = JSON.parse(existing.phaseApprovals || '{}');
  delete approvals[String(phase)];

  // Reset currentPhase to the earliest unapproved
  let nextPhase = 1;
  for (let p = 1; p <= 6; p++) {
    if (!approvals[String(p)]) {
      nextPhase = p;
      break;
    }
  }

  await db.update(planProgress).set({
    phaseApprovals: JSON.stringify(approvals),
    currentPhase: nextPhase,
    updatedAt: new Date().toISOString(),
  }).where(eq(planProgress.id, existing.id));
  return { success: true };
}

/** Admin: add a note to a student's plan */
export async function updatePlanAdminNotes(studentId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(planProgress).set({
    adminNotes: notes,
    updatedAt: new Date().toISOString(),
  }).where(eq(planProgress.id, studentId));
  return { success: true };
}

// ============================================================================
// Staff Notifications (Admin/Staff inbox)
// ============================================================================

export async function createStaffNotification(notif: {
  userId: number; eventType: string; titleEn: string; titleAr: string;
  contentEn?: string; contentAr?: string; actionUrl?: string; metadata?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(staffNotifications).values({
    ...notif, createdAt: new Date().toISOString(),
  });
}

export async function getStaffNotifications(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffNotifications)
    .where(eq(staffNotifications.userId, userId))
    .orderBy(desc(staffNotifications.createdAt))
    .limit(limit);
}

export async function getUnreadStaffNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(staffNotifications)
    .where(and(eq(staffNotifications.userId, userId), eq(staffNotifications.isRead, false)));
  return Number(result?.count ?? 0);
}

export async function getUnreadStaffNotificationCountByRoute(userId: number): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({
      actionUrl: staffNotifications.actionUrl,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(staffNotifications)
    .where(and(
      eq(staffNotifications.userId, userId),
      eq(staffNotifications.isRead, false),
      sql`${staffNotifications.actionUrl} IS NOT NULL`,
    ))
    .groupBy(staffNotifications.actionUrl);

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.actionUrl) result[row.actionUrl] = Number(row.count);
  }
  return result;
}

export async function markStaffNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(staffNotifications).set({ isRead: true })
    .where(and(eq(staffNotifications.id, notificationId), eq(staffNotifications.userId, userId)));
}

export async function markStaffNotificationsReadByRoute(userId: number, actionUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(staffNotifications).set({ isRead: true })
    .where(and(
      eq(staffNotifications.userId, userId),
      eq(staffNotifications.isRead, false),
      eq(staffNotifications.actionUrl, actionUrl),
    ));
}

export async function markAllStaffNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(staffNotifications).set({ isRead: true })
    .where(and(eq(staffNotifications.userId, userId), eq(staffNotifications.isRead, false)));
}

/**
 * Core dispatcher: notifies relevant admin + staff by event type.
 * Creates in-portal notifications, and sends email to offline users who have email enabled.
 */
export async function notifyStaffByEvent(
  eventType: StaffNotificationEventType,
  data: {
    titleEn: string; titleAr: string;
    contentEn?: string; contentAr?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const db = await getDb();
  if (!db) return;

  const eventConfig = STAFF_NOTIFICATION_EVENTS[eventType];
  if (!eventConfig) return;

  const actionUrl = eventConfig.actionUrl;
  const metadataStr = data.metadata ? JSON.stringify(data.metadata) : undefined;

  // Collect target user IDs: all admins + staff with matching roles
  const targetUserIds: number[] = [];

  // All admin accounts
  const adminRows = await db.select({ id: admins.id }).from(admins);
  for (const adminRow of adminRows) {
    const adminNotificationUserId = -Number(adminRow.id);
    if (!targetUserIds.includes(adminNotificationUserId)) {
      targetUserIds.push(adminNotificationUserId);
    }
  }

  // Staff with matching roles
  if (eventConfig.roles.length > 0) {
    const roleRows = await db.select({ userId: userRoles.userId }).from(userRoles)
      .where(inArray(userRoles.role, eventConfig.roles));
    for (const r of roleRows) {
      if (!targetUserIds.includes(r.userId)) targetUserIds.push(r.userId);
    }
  }

  if (targetUserIds.length === 0) return;

  // Create in-portal notifications for each target
  const now = new Date().toISOString();
  const notifValues = targetUserIds.map(userId => ({
    userId,
    eventType,
    titleEn: data.titleEn,
    titleAr: data.titleAr,
    contentEn: data.contentEn,
    contentAr: data.contentAr,
    actionUrl,
    metadata: metadataStr,
    createdAt: now,
  }));
  await db.insert(staffNotifications).values(notifValues);

  // Send email to offline users who have email alerts enabled for this event
  const notificationEmail = await getAdminSetting('notification_email');
  const emailPrefsRaw = await getAdminSetting('email_alert_prefs');
  const globalEmailPrefs: Record<string, boolean> = emailPrefsRaw ? JSON.parse(emailPrefsRaw) : {};

  // Skip email entirely if this event is disabled globally
  if (globalEmailPrefs[eventType] === false) return;

  if (notificationEmail) {
    try {
      await sendStaffAlertEmail({
        to: notificationEmail,
        eventType,
        titleEn: data.titleEn,
        contentEn: data.contentEn || data.titleEn,
        actionUrl: actionUrl || '',
      });
    } catch (e) {
      logger.warn(`[STAFF_NOTIF] Failed to email configured admin notification address`, { error: String(e), eventType });
    }
  }

  for (const userId of targetUserIds) {
    if (userId < 0) continue;

    try {
      const online = await isUserOnline(userId);
      if (online) continue; // Skip email for online users

      // Check per-staff prefs
      const [userRow] = await db.select({
        email: users.email,
        prefs: users.staffNotificationPrefs,
        isAdmin: sql<number>`(SELECT COUNT(*) FROM admins WHERE admins.userId = ${users.id})`,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (!userRow) continue;

      const staffPrefs: Record<string, boolean> = userRow.prefs ? JSON.parse(userRow.prefs as string) : {};
      if (staffPrefs[eventType] === false) continue;

      const emailTo = userRow.email;

      if (!emailTo) continue;

      await sendStaffAlertEmail({
        to: emailTo,
        eventType,
        titleEn: data.titleEn,
        contentEn: data.contentEn || data.titleEn,
        actionUrl: actionUrl || '',
      });
    } catch (e) {
      logger.warn(`[STAFF_NOTIF] Failed to email userId=${userId}`, { error: String(e) });
    }
  }
}

// ============================================================================
// Admin Settings (key-value store)
// ============================================================================

export async function getAdminSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ value: adminSettings.settingValue })
    .from(adminSettings)
    .where(eq(adminSettings.settingKey, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date().toISOString();
  // Upsert: try update first, insert if no rows affected
  const result = await db.update(adminSettings)
    .set({ settingValue: value, updatedAt: now })
    .where(eq(adminSettings.settingKey, key));
  if (!result.rowsAffected) {
    await db.insert(adminSettings).values({ settingKey: key, settingValue: value, updatedAt: now });
  }
}

export async function getAllAdminSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(adminSettings);
  const result: Record<string, string> = {};
  for (const row of rows) result[row.settingKey] = row.settingValue ?? '';
  return result;
}

export async function getStaffNotificationPrefs(userId: number): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return {};
  const [row] = await db.select({ prefs: users.staffNotificationPrefs })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row?.prefs ? JSON.parse(row.prefs) : {};
}

export async function updateStaffNotificationPrefs(userId: number, prefs: Record<string, boolean>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select({ prefs: users.staffNotificationPrefs })
    .from(users).where(eq(users.id, userId)).limit(1);
  const current = existing?.prefs ? JSON.parse(existing.prefs) : {};
  const merged = { ...current, ...prefs };
  await db.update(users).set({ staffNotificationPrefs: JSON.stringify(merged) })
    .where(eq(users.id, userId));
}

// ============================================================================
// Skip Broker Onboarding (Admin tool for QC testing)
// ============================================================================

/**
 * Skip all broker onboarding steps for a user — creates approved rows.
 * Uses the same audit pattern as skipCourseForUser().
 */
export async function skipBrokerOnboardingForUser(userId: number, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already complete
  const isComplete = await isUserBrokerOnboardingComplete(userId);
  if (isComplete) throw new Error("Broker onboarding is already complete for this user");

  // Pick first active broker
  const [broker] = await db.select({ id: brokers.id })
    .from(brokers)
    .where(eq(brokers.isActive, true))
    .orderBy(brokers.displayOrder)
    .limit(1);
  if (!broker) throw new Error("No active broker found");

  const now = new Date().toISOString();

  // Delete any existing onboarding rows for this user
  await db.delete(brokerOnboarding).where(eq(brokerOnboarding.userId, userId));

  // Insert 3 approved steps
  for (const step of ['select_broker', 'open_account', 'deposit'] as const) {
    await db.insert(brokerOnboarding).values({
      userId,
      brokerId: broker.id,
      step,
      status: 'approved',
      adminNote: 'Admin skip',
      reviewedBy: adminId,
      reviewedAt: now,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Set the fast-check flag
  await db.update(users).set({ brokerOnboardingComplete: true })
    .where(eq(users.id, userId));

  // Audit trail
  await db.insert(adminActions).values({
    adminId,
    userId,
    action: 'skip_broker_onboarding',
    details: JSON.stringify({ brokerId: broker.id }),
    createdAt: now,
  });

  // Broker is the only gate — always activate pending subscriptions
  const activation = await activateStudentSubscriptions(userId, false);
  const activated = activation.activated;

  return { success: true, brokerId: broker.id, activated };
}

/**
 * Rollback a broker onboarding skip — removes the approved rows and resets the flag.
 */
export async function rollbackBrokerOnboardingSkip(userId: number, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date().toISOString();

  // Delete broker_onboarding rows that were admin-skipped
  await db.delete(brokerOnboarding).where(eq(brokerOnboarding.userId, userId));

  // Reset the flag
  await db.update(users).set({ brokerOnboardingComplete: false })
    .where(eq(users.id, userId));

  // Audit trail
  await db.insert(adminActions).values({
    adminId,
    userId,
    action: 'rollback_broker_skip',
    details: JSON.stringify({}),
    createdAt: now,
  });

  return { success: true };
}