import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users,
  InsertAdmin, admins,
  courses, Course, InsertCourse,
  episodes, Episode, InsertEpisode,
  enrollments, Enrollment, InsertEnrollment,
  episodeProgress, EpisodeProgress, InsertEpisodeProgress,
  lexaiSubscriptions, LexaiSubscription, InsertLexaiSubscription,
  lexaiMessages, LexaiMessage, InsertLexaiMessage,
  registrationKeys, RegistrationKey, InsertRegistrationKey
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { logger } from './_core/logger';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
      logger.db('Database connection established');
    } catch (error) {
      logger.error('Database connection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      _db = null;
      _client = null;
    }
  }
  return _db;
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

export async function getAllEnrollments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    enrollment: enrollments,
    user: users,
    course: courses,
  })
  .from(enrollments)
  .leftJoin(users, eq(enrollments.userId, users.id))
  .leftJoin(courses, eq(enrollments.courseId, courses.id))
  .orderBy(desc(enrollments.enrolledAt));
}

export async function getEnrollmentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    enrollment: enrollments,
    course: courses,
  })
  .from(enrollments)
  .leftJoin(courses, eq(enrollments.courseId, courses.id))
  .where(eq(enrollments.userId, userId))
  .orderBy(desc(enrollments.enrolledAt));
}

export async function getEnrollmentByCourseAndUser(courseId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollments)
    .where(and(
      eq(enrollments.courseId, courseId),
      eq(enrollments.userId, userId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Alias for consistency
export async function getEnrollmentByUserAndCourse(userId: number, courseId: number) {
  return getEnrollmentByCourseAndUser(courseId, userId);
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

// ============================================================================
// Episode Progress Management
// ============================================================================

export async function getEpisodeProgress(userId: number, episodeId: number) {
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

export async function upsertEpisodeProgress(progress: InsertEpisodeProgress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // PostgreSQL uses ON CONFLICT for upsert operations
  await db.insert(episodeProgress)
    .values(progress)
    .onConflictDoUpdate({
      target: [episodeProgress.userId, episodeProgress.episodeId],
      set: {
        watchedDuration: progress.watchedDuration,
        isCompleted: progress.isCompleted,
        lastWatchedAt: new Date(),
      },
    });
}

export async function getCourseProgressByUser(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(episodeProgress)
    .where(and(
      eq(episodeProgress.userId, userId),
      eq(episodeProgress.courseId, courseId)
    ));
}

// ============================================================================
// Dashboard Statistics
// ============================================================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return {
    totalUsers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    activeEnrollments: 0,
  };

  // Count only regular users, not admins
  const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [totalCoursesResult] = await db.select({ count: sql<number>`count(*)` }).from(courses);
  const [totalEnrollmentsResult] = await db.select({ count: sql<number>`count(*)` }).from(enrollments);
  const [activeEnrollmentsResult] = await db.select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.isSubscriptionActive, true));

  return {
    totalUsers: Number(totalUsersResult.count),
    totalCourses: Number(totalCoursesResult.count),
    totalEnrollments: Number(totalEnrollmentsResult.count),
    activeEnrollments: Number(activeEnrollmentsResult.count),
  };
}

// ============================================================================
// LexAI Subscription Management
// ============================================================================

export async function createLexaiSubscription(data: InsertLexaiSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  logger.db('Creating LexAI subscription', { userId: data.userId });

  const result = await db.insert(lexaiSubscriptions).values(data).returning({ id: lexaiSubscriptions.id });
  return result[0].id;
}

export async function getLexaiSubscriptionByUserId(userId: number): Promise<LexaiSubscription | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(lexaiSubscriptions)
    .where(eq(lexaiSubscriptions.userId, userId))
    .orderBy(desc(lexaiSubscriptions.createdAt))
    .limit(1);

  return result[0];
}

export async function getActiveLexaiSubscription(userId: number): Promise<LexaiSubscription | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(lexaiSubscriptions)
    .where(
      and(
        eq(lexaiSubscriptions.userId, userId),
        eq(lexaiSubscriptions.isActive, true)
      )
    )
    .orderBy(desc(lexaiSubscriptions.createdAt))
    .limit(1);

  return result[0];
}

export async function updateLexaiSubscription(id: number, data: Partial<LexaiSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  logger.db('Updating LexAI subscription', { id });

  await db
    .update(lexaiSubscriptions)
    .set(data)
    .where(eq(lexaiSubscriptions.id, id));
}

export async function incrementLexaiMessageCount(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(lexaiSubscriptions)
    .set({
      messagesUsed: sql`${lexaiSubscriptions.messagesUsed} + 1`
    })
    .where(eq(lexaiSubscriptions.id, subscriptionId));
}

// ============================================================================
// LexAI Messages Management
// ============================================================================

export async function createLexaiMessage(data: InsertLexaiMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  logger.db('Creating LexAI message', { userId: data.userId, role: data.role });

  const result = await db.insert(lexaiMessages).values(data).returning({ id: lexaiMessages.id });
  return result[0].id;
}

export async function getLexaiMessagesByUser(userId: number, limit: number = 50): Promise<LexaiMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(lexaiMessages)
    .where(eq(lexaiMessages.userId, userId))
    .orderBy(desc(lexaiMessages.createdAt))
    .limit(limit);

  return result.reverse(); // Return in chronological order
}

export async function getLexaiMessagesBySubscription(subscriptionId: number): Promise<LexaiMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(lexaiMessages)
    .where(eq(lexaiMessages.subscriptionId, subscriptionId))
    .orderBy(desc(lexaiMessages.createdAt));

  return result.reverse();
}

export async function updateLexaiMessage(id: number, data: Partial<LexaiMessage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(lexaiMessages)
    .set(data)
    .where(eq(lexaiMessages.id, id));
}

// ============================================================================
// LexAI Statistics
// ============================================================================

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
    totalSubscriptions: Number(totalSubs?.count || 0),
    activeSubscriptions: Number(activeSubs?.count || 0),
    totalMessages: Number(totalMessages?.count || 0),
  };
}


// ============================================================================
// Registration Keys Management
// ============================================================================

import { nanoid } from "nanoid";
import { isNull } from "drizzle-orm";

/**
 * Generate a unique registration key code
 */
export function generateKeyCode(): string {
  // Format: XFLEX-XXXXX-XXXXX-XXXXX
  const part1 = nanoid(5).toUpperCase();
  const part2 = nanoid(5).toUpperCase();
  const part3 = nanoid(5).toUpperCase();
  return `XFLEX-${part1}-${part2}-${part3}`;
}

/**
 * Create a single registration key
 */
export async function createRegistrationKey(data: {
  courseId: number;
  createdBy: number;
  notes?: string;
  expiresAt?: Date;
}): Promise<RegistrationKey> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const keyCode = generateKeyCode();
  
  logger.db('Creating registration key', { courseId: data.courseId, keyCode });
  
  const [key] = await db.insert(registrationKeys).values({
    keyCode,
    courseId: data.courseId,
    createdBy: data.createdBy,
    notes: data.notes,
    expiresAt: data.expiresAt,
  }).returning();
  
  return key;
}

/**
 * Create multiple registration keys (bulk generation)
 */
export async function createBulkRegistrationKeys(data: {
  courseId: number;
  createdBy: number;
  quantity: number;
  notes?: string;
  expiresAt?: Date;
}): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const keys: InsertRegistrationKey[] = [];
  
  for (let i = 0; i < data.quantity; i++) {
    keys.push({
      keyCode: generateKeyCode(),
      courseId: data.courseId,
      createdBy: data.createdBy,
      notes: data.notes,
      expiresAt: data.expiresAt,
    });
  }
  
  logger.db('Creating bulk registration keys', { courseId: data.courseId, quantity: data.quantity });
  
  const createdKeys = await db.insert(registrationKeys).values(keys).returning();
  return createdKeys;
}

/**
 * Get registration key by code
 */
export async function getRegistrationKeyByCode(keyCode: string): Promise<RegistrationKey | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [key] = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.keyCode, keyCode))
    .limit(1);
  
  return key;
}

/**
 * Activate a registration key with user email
 */
export async function activateRegistrationKey(
  keyCode: string,
  email: string
): Promise<{ success: boolean; message: string; key?: RegistrationKey }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const key = await getRegistrationKeyByCode(keyCode);
  
  if (!key) {
    return { success: false, message: "Invalid registration key" };
  }
  
  if (!key.isActive) {
    return { success: false, message: "This key has been deactivated" };
  }
  
  if (key.expiresAt && new Date() > key.expiresAt) {
    return { success: false, message: "This key has expired" };
  }
  
  if (key.email) {
    if (key.email === email) {
      return { success: true, message: "Key already activated with this email", key };
    } else {
      return { success: false, message: "This key is already activated with a different email" };
    }
  }
  
  // Activate the key by locking it to this email
  logger.db('Activating registration key', { keyCode, email });
  
  const [updatedKey] = await db
    .update(registrationKeys)
    .set({
      email,
      activatedAt: new Date(),
    })
    .where(eq(registrationKeys.id, key.id))
    .returning();
  
  return { success: true, message: "Key activated successfully", key: updatedKey };
}

/**
 * Check if user has valid key for a course
 */
export async function userHasValidKeyForCourse(
  email: string,
  courseId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [key] = await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        eq(registrationKeys.email, email),
        eq(registrationKeys.courseId, courseId),
        eq(registrationKeys.isActive, true)
      )
    )
    .limit(1);
  
  if (!key) return false;
  
  // Check expiration
  if (key.expiresAt && new Date() > key.expiresAt) {
    return false;
  }
  
  return true;
}

/**
 * Get all registration keys (for admin)
 */
export async function getAllRegistrationKeys(): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(registrationKeys)
    .orderBy(desc(registrationKeys.createdAt));
}

/**
 * Get registration keys by course
 */
export async function getRegistrationKeysByCourse(courseId: number): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.courseId, courseId))
    .orderBy(desc(registrationKeys.createdAt));
}

/**
 * Get unused (not activated) keys
 */
export async function getUnusedKeys(): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(registrationKeys)
    .where(
      and(
        isNull(registrationKeys.email),
        eq(registrationKeys.isActive, true)
      )
    )
    .orderBy(desc(registrationKeys.createdAt));
}

/**
 * Get activated keys
 */
export async function getActivatedKeys(): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.isActive, true))
    .orderBy(desc(registrationKeys.activatedAt));
}

/**
 * Deactivate a registration key
 */
export async function deactivateRegistrationKey(keyId: number): Promise<RegistrationKey> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  logger.db('Deactivating registration key', { keyId });
  
  const [key] = await db
    .update(registrationKeys)
    .set({ isActive: false })
    .where(eq(registrationKeys.id, keyId))
    .returning();
  
  return key;
}

/**
 * Search keys by email
 */
export async function searchKeysByEmail(email: string): Promise<RegistrationKey[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.email, email))
    .orderBy(desc(registrationKeys.createdAt));
}

/**
 * Get key statistics
 */
export async function getKeyStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allKeys = await getAllRegistrationKeys();
  
  const total = allKeys.length;
  const activated = allKeys.filter(k => k.email !== null).length;
  const unused = allKeys.filter(k => k.email === null && k.isActive).length;
  const deactivated = allKeys.filter(k => !k.isActive).length;
  const expired = allKeys.filter(k => k.expiresAt && new Date() > k.expiresAt).length;
  
  return {
    total,
    activated,
    unused,
    deactivated,
    expired,
    activationRate: total > 0 ? ((activated / total) * 100).toFixed(2) : "0.00",
  };
}
