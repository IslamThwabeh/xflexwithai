import { eq, desc, and, or, sql, ne } from "drizzle-orm";
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
  authEmailOtps, AuthEmailOtp, InsertAuthEmailOtp,
  // FlexAI imports
  flexaiSubscriptions, FlexaiSubscription, InsertFlexaiSubscription,
  flexaiMessages, FlexaiMessage, InsertFlexaiMessage
} from "../database/schema-sqlite.ts";
import { ENV } from './_core/env';
import { logger } from './_core/logger';

let _db: ReturnType<typeof drizzle> | null = null;

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
export async function createUser(user: { email: string; passwordHash: string; name?: string }): Promise<number> {
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

export type OtpPurpose = "login";

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
export async function updateUser(userId: number, updates: { name?: string; phone?: string }): Promise<void> {
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
      })
      .where(eq(users.id, userId));
    logger.db('User updated successfully', { userId });
  } catch (error) {
    logger.error('Failed to update user', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
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

export async function getEpisodesByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(episodes)
    .where(eq(episodes.courseId, courseId))
    .orderBy(episodes.order);
}

export async function getEpisodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  const result = await db.insert(enrollments).values(enrollment).returning({ id: enrollments.id });
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
    };
  }

  const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [totalCoursesResult] = await db.select({ count: sql<number>`count(*)` }).from(courses);
  const [totalEnrollmentsResult] = await db.select({ count: sql<number>`count(*)` }).from(enrollments);
  const [activeEnrollmentsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.isSubscriptionActive, true));

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    totalCourses: Number(totalCoursesResult?.count ?? 0),
    totalEnrollments: Number(totalEnrollmentsResult?.count ?? 0),
    activeEnrollments: Number(activeEnrollmentsResult?.count ?? 0),
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

export async function getAllRegistrationKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(ne(registrationKeys.courseId, 0))
    .orderBy(desc(registrationKeys.createdAt));
}

export async function getRegistrationKeysByCourse(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.courseId, courseId))
    .orderBy(desc(registrationKeys.createdAt));
}

export async function getUnusedKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        ne(registrationKeys.courseId, 0),
        eq(registrationKeys.isActive, true),
        sql`${registrationKeys.activatedAt} is null`
      )
    )
    .orderBy(desc(registrationKeys.createdAt));
}

export async function getActivatedKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        ne(registrationKeys.courseId, 0),
        eq(registrationKeys.isActive, true),
        sql`${registrationKeys.activatedAt} is not null`
      )
    )
    .orderBy(desc(registrationKeys.activatedAt));
}

export async function getRegistrationKeyByCode(keyCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createRegistrationKey(
  key: Omit<InsertRegistrationKey, "keyCode" | "expiresAt"> & { keyCode?: string; expiresAt?: string | Date | null }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const keyCode = key.keyCode ?? generateRegistrationKeyCode();
  const values: InsertRegistrationKey = {
    ...key,
    keyCode,
    createdAt: new Date().toISOString(),
    expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
  } as InsertRegistrationKey;
  const result = await db.insert(registrationKeys).values(values).returning({ id: registrationKeys.id });
  return result[0].id;
}

export async function createBulkRegistrationKeys(input: {
  courseId: number;
  createdBy: number;
  quantity: number;
  notes?: string;
  expiresAt?: string | Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: InsertRegistrationKey[] = Array.from({ length: input.quantity }, () => ({
    keyCode: generateRegistrationKeyCode(),
    courseId: input.courseId,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    notes: input.notes ?? null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
  }));

  await db.insert(registrationKeys).values(values);
  return values;
}

export async function updateRegistrationKey(id: number, key: Partial<InsertRegistrationKey>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(registrationKeys).set(key).where(eq(registrationKeys.id, id));
}

export async function deactivateRegistrationKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(registrationKeys)
    .set({ isActive: false })
    .where(eq(registrationKeys.id, id));

  const [updated] = await db.select().from(registrationKeys).where(eq(registrationKeys.id, id)).limit(1);
  return updated;
}

export async function searchKeysByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(and(ne(registrationKeys.courseId, 0), eq(registrationKeys.email, email)))
    .orderBy(desc(registrationKeys.createdAt));
}

export async function getKeyStatistics() {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      activated: 0,
      unused: 0,
      deactivated: 0,
      activationRate: 0,
    };
  }

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(ne(registrationKeys.courseId, 0));
  const [activatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(ne(registrationKeys.courseId, 0), sql`${registrationKeys.activatedAt} is not null`));
  const [unusedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(
      and(
        ne(registrationKeys.courseId, 0),
        eq(registrationKeys.isActive, true),
        sql`${registrationKeys.activatedAt} is null`
      )
    );
  const [deactivatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(ne(registrationKeys.courseId, 0), eq(registrationKeys.isActive, false)));

  const total = Number(totalResult?.count ?? 0);
  const activated = Number(activatedResult?.count ?? 0);
  const activationRate = total > 0 ? Math.round((activated / total) * 100) : 0;

  return {
    total,
    activated,
    unused: Number(unusedResult?.count ?? 0),
    deactivated: Number(deactivatedResult?.count ?? 0),
    activationRate,
  };
}

export async function getLexaiKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.courseId, 0))
    .orderBy(desc(registrationKeys.createdAt));
}

export async function getLexaiKeyStatistics() {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      activated: 0,
      unused: 0,
      deactivated: 0,
      activationRate: 0,
    };
  }

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(eq(registrationKeys.courseId, 0));
  const [activatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(eq(registrationKeys.courseId, 0), sql`${registrationKeys.activatedAt} is not null`));
  const [unusedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(
      and(
        eq(registrationKeys.courseId, 0),
        eq(registrationKeys.isActive, true),
        sql`${registrationKeys.activatedAt} is null`
      )
    );
  const [deactivatedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationKeys)
    .where(and(eq(registrationKeys.courseId, 0), eq(registrationKeys.isActive, false)));

  const total = Number(totalResult?.count ?? 0);
  const activated = Number(activatedResult?.count ?? 0);
  const activationRate = total > 0 ? Math.round((activated / total) * 100) : 0;

  return {
    total,
    activated,
    unused: Number(unusedResult?.count ?? 0),
    deactivated: Number(deactivatedResult?.count ?? 0),
    activationRate,
  };
}

export async function activateRegistrationKey(keyCode: string, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [key] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);

  if (!key) {
    return { success: false, message: "Invalid registration key" };
  }

  if (!key.isActive) {
    return { success: false, message: "This registration key is deactivated" };
  }

  if (key.activatedAt) {
    return { success: false, message: "This registration key has already been activated" };
  }

  if (key.email && key.email !== email) {
    return { success: false, message: "This registration key is assigned to another email" };
  }

  if (key.expiresAt) {
    const expiresAt = new Date(key.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return { success: false, message: "This registration key has expired" };
    }
  }

  await db
    .update(registrationKeys)
    .set({
      email,
      activatedAt: new Date().toISOString(),
      isActive: true,
    })
    .where(eq(registrationKeys.id, key.id));

  const [updated] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.id, key.id))
    .limit(1);

  return {
    success: true,
    message: "Key activated successfully",
    key: updated ?? key,
  };
}

export async function activateLexaiKey(keyCode: string, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [key] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);

  if (!key) {
    return { success: false, message: "Invalid LexAI key" };
  }

  if (key.courseId !== 0) {
    return { success: false, message: "This key is not for LexAI" };
  }

  if (!key.isActive) {
    return { success: false, message: "This LexAI key is deactivated" };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (key.activatedAt) {
    const keyEmail = (key.email ?? "").trim().toLowerCase();
    if (keyEmail === normalizedEmail) {
      return {
        success: true,
        message: "LexAI key already activated for this email",
        key,
      };
    }
    return { success: false, message: "This LexAI key has already been activated" };
  }

  if (key.email && key.email.trim().toLowerCase() !== normalizedEmail) {
    return { success: false, message: "This LexAI key is assigned to another email" };
  }

  if (key.expiresAt) {
    const expiresAt = new Date(key.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return { success: false, message: "This LexAI key has expired" };
    }
  }

  await db
    .update(registrationKeys)
    .set({
      email: normalizedEmail,
      activatedAt: new Date().toISOString(),
      isActive: true,
    })
    .where(eq(registrationKeys.id, key.id));

  const [updated] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.id, key.id))
    .limit(1);

  return {
    success: true,
    message: "LexAI key activated successfully",
    key: updated ?? key,
  };
}

export async function getAssignedLexaiKeyByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const normalizedEmail = email.trim().toLowerCase();
  const keys = await db
    .select()
    .from(registrationKeys)
    .where(and(eq(registrationKeys.courseId, 0), eq(registrationKeys.email, normalizedEmail), eq(registrationKeys.isActive, true)))
    .orderBy(desc(registrationKeys.activatedAt), desc(registrationKeys.createdAt))
    .limit(1);

  return keys[0];
}

export async function userHasValidKeyForCourse(email: string, courseId: number) {
  const db = await getDb();
  if (!db) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const keys = await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        eq(registrationKeys.courseId, courseId),
        sql`lower(${registrationKeys.email}) = ${normalizedEmail}`
      )
    );

  if (keys.length === 0) return false;

  const now = Date.now();
  return keys.some((key) => {
    if (!key.isActive || !key.activatedAt) return false;
    if (!key.expiresAt) return true;
    const expiresAt = new Date(key.expiresAt).getTime();
    return Number.isNaN(expiresAt) ? true : expiresAt >= now;
  });
}

export async function getValidCourseKeysByEmail(email: string) {
  const db = await getDb();
  if (!db) return [];

  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const keys = await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        sql`lower(${registrationKeys.email}) = ${normalizedEmail}`,
        sql`${registrationKeys.activatedAt} is not null`,
        eq(registrationKeys.isActive, true),
        sql`${registrationKeys.courseId} > 0`,
        or(sql`${registrationKeys.expiresAt} is null`, sql`${registrationKeys.expiresAt} >= ${nowIso}`)
      )
    );

  return keys;
}

function computeLexaiKeyEndDate(key: any) {
  if (!key?.activatedAt) return null;
  const activatedAt = new Date(key.activatedAt);
  if (Number.isNaN(activatedAt.getTime())) return null;

  const keyExpiry = new Date(activatedAt);
  keyExpiry.setDate(keyExpiry.getDate() + 30);

  if (key.expiresAt) {
    const absoluteExpiry = new Date(key.expiresAt);
    if (!Number.isNaN(absoluteExpiry.getTime()) && absoluteExpiry.getTime() < keyExpiry.getTime()) {
      keyExpiry.setTime(absoluteExpiry.getTime());
    }
  }

  return keyExpiry;
}

export async function hasValidLexaiKeyByEmail(email: string) {
  const key = await getAssignedLexaiKeyByEmail(email);
  if (!key) return false;
  if (!key.isActive || !key.activatedAt) return false;
  const endDate = computeLexaiKeyEndDate(key);
  if (!endDate) return false;
  return endDate.getTime() >= Date.now();
}

export async function syncUserEntitlementsFromKeys(userId: number, email: string) {
  const db = await getDb();
  if (!db) return;

  const normalizedEmail = email.trim().toLowerCase();

  // Course keys -> ensure enrollments
  const courseKeys = await getValidCourseKeysByEmail(normalizedEmail);
  for (const key of courseKeys) {
    const courseId = Number(key.courseId);
    if (!courseId) continue;

    const existingEnrollment = await getEnrollmentByUserAndCourse(userId, courseId);
    if (existingEnrollment) continue;

    await createEnrollment({
      userId,
      courseId,
      paymentStatus: "completed",
      isSubscriptionActive: true,
      registrationKeyId: key.id,
      activatedViaKey: true,
    });
  }

  // LexAI key -> ensure active subscription
  const lexaiKey = await getAssignedLexaiKeyByEmail(normalizedEmail);
  if (lexaiKey?.isActive && lexaiKey.activatedAt) {
    const endDate = computeLexaiKeyEndDate(lexaiKey);
    if (endDate && endDate.getTime() >= Date.now()) {
      const current = await getActiveLexaiSubscription(userId);
      if (current) {
        await updateLexaiSubscription(current.id, {
          isActive: true,
          endDate: endDate.toISOString(),
          paymentStatus: "key",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesLimit: 100,
        });
      } else {
        await createLexaiSubscription({
          userId,
          isActive: true,
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
          paymentStatus: "key",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesUsed: 0,
          messagesLimit: 100,
        });
      }
    }
  }
}

export async function deleteRegistrationKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(registrationKeys).where(eq(registrationKeys.id, id));
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
    await db.update(episodeProgress)
      .set({
        watchedDuration: progress.watchedDuration,
        isCompleted: progress.isCompleted,
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
// LexAI Subscription Management
// ============================================================================

export async function getUserLexaiSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lexaiSubscriptions)
    .where(and(
      eq(lexaiSubscriptions.userId, userId),
      eq(lexaiSubscriptions.isActive, true)
    ))
    .orderBy(desc(lexaiSubscriptions.createdAt))
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
  await db.update(lexaiSubscriptions).set(subscription).where(eq(lexaiSubscriptions.id, id));
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
    if (isKeySubscription && Number(subscription.messagesUsed ?? 0) === 0) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      await db
        .update(lexaiSubscriptions)
        .set({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
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

export async function getLexaiStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [totalSubs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lexaiSubscriptions);
  const [activeSubs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lexaiSubscriptions)
    .where(eq(lexaiSubscriptions.isActive, true));
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
      startDate: lexaiSubscriptions.startDate,
      endDate: lexaiSubscriptions.endDate,
      paymentStatus: lexaiSubscriptions.paymentStatus,
      paymentAmount: lexaiSubscriptions.paymentAmount,
      paymentCurrency: lexaiSubscriptions.paymentCurrency,
      messagesUsed: lexaiSubscriptions.messagesUsed,
      messagesLimit: lexaiSubscriptions.messagesLimit,
      createdAt: lexaiSubscriptions.createdAt,
      updatedAt: lexaiSubscriptions.updatedAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(lexaiSubscriptions)
    .leftJoin(users, eq(lexaiSubscriptions.userId, users.id))
    .orderBy(desc(lexaiSubscriptions.createdAt));
}
