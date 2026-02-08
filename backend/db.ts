import { eq, desc, and, sql } from "drizzle-orm";
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
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, userId));
    logger.db('User last sign in updated', { userId });
  } catch (error) {
    logger.error('Failed to update user last sign in', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Get all users
 */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
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
      .set({ lastSignedIn: new Date() })
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
// Registration Key Management
// ============================================================================

export async function getAllRegistrationKeys() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(registrationKeys).orderBy(desc(registrationKeys.createdAt));
}

export async function getRegistrationKeyByCode(keyCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createRegistrationKey(key: InsertRegistrationKey) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(registrationKeys).values(key).returning({ id: registrationKeys.id });
  return result[0].id;
}

export async function updateRegistrationKey(id: number, key: Partial<InsertRegistrationKey>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(registrationKeys).set(key).where(eq(registrationKeys.id, id));
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
        lastWatchedAt: new Date(),
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
  const result = await db.insert(lexaiMessages).values(message).returning({ id: lexaiMessages.id });
  return result[0].id;
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

/**
 * Get enrollments by user ID (alias for getUserEnrollments)
 */
export async function getEnrollmentsByUserId(userId: number) {
  return getUserEnrollments(userId);
}

/**
 * Get enrollment by course and user (alias for getEnrollment with swapped params)
 */
export async function getEnrollmentByCourseAndUser(courseId: number, userId: number) {
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
