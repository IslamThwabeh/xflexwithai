import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "./_core/logger";
import * as db from "./db";
import { storagePut } from "./storage";
import { storagePutR2 } from "./storage-r2";
import { analyzeLexai } from "./_core/lexai";
import { hashPassword, verifyPassword, generateToken, isValidEmail, isValidPassword } from "./_core/auth";
// FlexAI routes are registered in server/_core/index.ts

// Admin-only procedure - checks if user is in admins table
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.user.email) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (!admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx: { ...ctx, admin } });
});

const getWorkerEnv = () => (globalThis as { ENV?: { VIDEOS_BUCKET?: any } }).ENV;

const ensureLexaiAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const admin = ctx.user.email ? await db.getAdminByEmail(ctx.user.email) : null;
  let subscription = await db.getActiveLexaiSubscription(ctx.user.id);

  if (!subscription) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active LexAI subscription" });
  }

  if (subscription.endDate) {
    const endDate = new Date(subscription.endDate);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      await db.updateLexaiSubscription(subscription.id, { isActive: false });
      throw new TRPCError({ code: "FORBIDDEN", message: "LexAI subscription expired" });
    }
  }

  if (!admin && subscription.messagesUsed >= subscription.messagesLimit) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Monthly message limit reached" });
  }

  return { subscription, isAdmin: !!admin };
};

const getLatestLexaiAnalysis = async (userId: number, analysisType: string) => {
  const messages = await db.getLexaiMessagesByUser(userId, 50);
  return messages.find(
    message => message.role === "assistant" && message.analysisType === analysisType
  );
};

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // Check if current user is an admin
    isAdmin: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { isAdmin: false, admin: null };
      const admin = await db.getAdminByEmail(ctx.user.email);
      return { isAdmin: !!admin, admin };
    }),
    
    // User registration
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[AUTH] Registration attempt', { email: input.email });
        
        // Validate email format
        if (!isValidEmail(input.email)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid email format' });
        }
        
        // Validate password strength
        if (!isValidPassword(input.password)) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' 
          });
        }
        
        // Check if user already exists
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
        }
        
        // Hash password
        const passwordHash = await hashPassword(input.password);
        
        // Create user
        const userId = await db.createUser({
          email: input.email,
          passwordHash,
          name: input.name,
        });
        
        // Generate JWT token
        const token = await generateToken({
          userId,
          email: input.email,
          type: 'user',
        });
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        
        logger.info('[AUTH] User registered successfully', { userId, email: input.email });
        
        return { success: true, userId };
      }),
    
    // User login
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[AUTH] Login attempt', { email: input.email });
        
        // Find user
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // Verify password
        const isValid = await verifyPassword(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // Update last signed in
        await db.updateUserLastSignIn(user.id);
        
        // Generate JWT token
        const token = await generateToken({
          userId: user.id,
          email: user.email,
          type: 'user',
        });
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        
        logger.info('[AUTH] User logged in successfully', { userId: user.id, email: user.email });
        
        return { success: true, user: { id: user.id, email: user.email, name: user.name } };
      }),
    
    // Admin login (separate from user login)
    adminLogin: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('🔐 [ADMIN LOGIN] Login attempt started', { 
          email: input.email,
          timestamp: new Date().toISOString(),
        });
        
        // Find admin
        logger.info('🔍 [ADMIN LOGIN] Looking up admin by email', { email: input.email });
        const admin = await db.getAdminByEmail(input.email);
        
        if (!admin) {
          logger.error('❌ [ADMIN LOGIN] Admin not found', { email: input.email });
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        logger.info('✅ [ADMIN LOGIN] Admin found in database', { 
          adminId: admin.id,
          email: admin.email,
          name: admin.name,
        });
        
        // Verify password
        logger.info('🔍 [ADMIN LOGIN] Verifying password');
        const isValid = await verifyPassword(input.password, admin.passwordHash);
        
        if (!isValid) {
          logger.error('❌ [ADMIN LOGIN] Password verification failed', { 
            email: input.email,
            adminId: admin.id,
          });
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        logger.info('✅ [ADMIN LOGIN] Password verified successfully');
        
        // Update last signed in
        logger.info('🔍 [ADMIN LOGIN] Updating last sign-in timestamp');
        await db.updateAdminLastSignIn(admin.id);
        logger.info('✅ [ADMIN LOGIN] Last sign-in updated');
        
        // Generate JWT token
        logger.info('🔍 [ADMIN LOGIN] Generating JWT token', {
          userId: admin.id,
          email: admin.email,
          type: 'admin',
        });
        const token = await generateToken({
          userId: admin.id,
          email: admin.email,
          type: 'admin',
        });
        logger.info('✅ [ADMIN LOGIN] JWT token generated', {
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...',
        });
        
        // Set cookie
        logger.info('🔍 [ADMIN LOGIN] Setting cookie', {
          cookieName: COOKIE_NAME,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        logger.info('🔍 [ADMIN LOGIN] Cookie options', {
          ...cookieOptions,
          domain: cookieOptions.domain || 'not set',
        });
        
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);
        logger.info('✅ [ADMIN LOGIN] Cookie set successfully');
        
        logger.info('🎉 [ADMIN LOGIN] Admin logged in successfully', { 
          adminId: admin.id, 
          email: admin.email,
          timestamp: new Date().toISOString(),
        });
        
        return { success: true, admin: { id: admin.id, email: admin.email, name: admin.name } };
      }),

    // Change password (authenticated users only)
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[AUTH] Change password attempt', { userId: ctx.user?.id });
        
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        // Get user
        const user = await db.getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        // Verify current password
        const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await hashPassword(input.newPassword);

        // Update user password
        await db.updateUserPassword(ctx.user.id, hashedPassword);
        
        logger.info('[AUTH] Password changed successfully', { userId: ctx.user.id });
        
        return { success: true };
      }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Dashboard statistics (admin only)
  dashboard: router({
    stats: adminProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
    
    recentEnrollments: adminProcedure.query(async () => {
      const enrollments = await db.getAllEnrollments();
      return enrollments.slice(0, 5);
    }),
  }),

  // User management
  users: router({
    // Admin: List all users
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    // Admin: Get user by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        return user;
      }),

    // User: Update own profile
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }

        logger.info('[USER] Updating profile', { userId: ctx.user.id });

        await db.updateUser(ctx.user.id, {
          name: input.name,
          phone: input.phone,
        });

        logger.info('[USER] Profile updated successfully', { userId: ctx.user.id });
        
        return { success: true };
      }),

    // User: Get own enrollments
    getUserEnrollments: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      logger.info('[USER] Getting enrollments', { userId: ctx.user.id });
      
      const enrollments = await db.getEnrollmentsByUserId(ctx.user.id);
      
      return enrollments.map((enrollment: any) => ({
        id: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        courseName: enrollment.courseName || 'Unknown Course',
        progressPercentage: enrollment.progressPercentage,
        completedEpisodes: enrollment.completedEpisodes,
        totalEpisodes: enrollment.totalEpisodes || 0,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      }));
    }),

    // User: Get own statistics
    getUserStats: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      logger.info('[USER] Getting statistics', { userId: ctx.user.id });
      
      const stats = await db.getUserStatistics(ctx.user.id);
      
      return stats;
    }),
  }),

  // Course management
  courses: router({
    // Public: Get all published courses
    list: publicProcedure.query(async () => {
      return await db.getPublishedCourses();
    }),

    // Admin: Get all courses (including unpublished)
    listAll: adminProcedure.query(async () => {
      return await db.getAllCourses();
    }),

    // Alias for getAllCourses (used by AdminKeys page)
    getAllCourses: adminProcedure.query(async () => {
      return await db.getAllCourses();
    }),

    // Public: Get course by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const course = await db.getCourseById(input.id);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        return course;
      }),

    // Admin: Create course
    create: adminProcedure
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().min(1),
        descriptionAr: z.string().min(1),
        thumbnailUrl: z.string().optional(),
        price: z.number().default(0),
        currency: z.string().default("USD"),
        isPublished: z.boolean().default(false),
        level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.create', { title: input.titleEn }, ctx.admin?.id);
        const courseId = await db.createCourse(input);
        logger.info('Course created successfully', { courseId });
        return { id: courseId };
      }),

    // Admin: Update course
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        descriptionEn: z.string().min(1).optional(),
        descriptionAr: z.string().min(1).optional(),
        thumbnailUrl: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        isPublished: z.boolean().optional(),
        level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.update', { id: input.id }, ctx.admin?.id);
        const { id, ...updates } = input;
        await db.updateCourse(id, updates);
        logger.info('Course updated successfully', { id });
        return { success: true };
      }),

    // Admin: Delete course
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        logger.procedure('courses.delete', input, ctx.admin?.id);
        await db.deleteCourse(input.id);
        logger.info('Course deleted successfully', input);
        return { success: true };
      }),
  }),

  // Episode management
  episodes: router({
    // Public: Get episodes for a course
    listByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEpisodesByCourseId(input.courseId);
      }),

    // Admin: Get episode by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const episode = await db.getEpisodeById(input.id);
        if (!episode) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' });
        }
        return episode;
      }),

    // Admin: Create episode
    create: adminProcedure
      .input(z.object({
        courseId: z.number(),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        order: z.number(),
        isFree: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const episodeId = await db.createEpisode(input);
        return { id: episodeId };
      }),

    // Admin: Update episode
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().min(1).optional(),
        titleAr: z.string().min(1).optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        videoUrl: z.string().optional(),
        duration: z.number().optional(),
        order: z.number().optional(),
        isFree: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateEpisode(id, updates);
        return { success: true };
      }),

    // Admin: Delete episode
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEpisode(input.id);
        return { success: true };
      }),
  }),

  // Enrollment management
  enrollments: router({
    // Admin: Get all enrollments
    listAll: adminProcedure.query(async () => {
      return await db.getAllEnrollments();
    }),

    // User: Get my enrollments
    myEnrollments: protectedProcedure.query(async ({ ctx }) => {
      logger.procedure('enrollments.myEnrollments', undefined, ctx.user.id);
      return await db.getEnrollmentsByUserId(ctx.user.id);
    }),

    // User: Enroll in a course
    enroll: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        paymentAmount: z.number().optional(),
        paymentCurrency: z.string().default("USD"),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.enroll', input, ctx.user.id);
        // Check if already enrolled
        const existing = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (existing) {
          logger.warn('User already enrolled in course', { userId: ctx.user.id, courseId: input.courseId });
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already enrolled in this course' });
        }

        const enrollmentId = await db.createEnrollment({
          userId: ctx.user.id,
          courseId: input.courseId,
          paymentAmount: input.paymentAmount,
          paymentCurrency: input.paymentCurrency,
          paymentStatus: input.paymentAmount ? 'pending' : 'completed',
          isSubscriptionActive: true,
        });

        logger.info('User enrolled in course successfully', { enrollmentId, userId: ctx.user.id, courseId: input.courseId });
        return { id: enrollmentId };
      }),

    // User: Update enrollment progress
    updateProgress: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        progressPercentage: z.number(),
        completedEpisodes: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateEnrollment(input.enrollmentId, {
          progressPercentage: input.progressPercentage,
          completedEpisodes: input.completedEpisodes,
          lastAccessed: new Date().toISOString(),
        });
        return { success: true };
      }),
    // Get enrollment for a specific course
    getEnrollment: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          return null;
        }
        return enrollment;
      }),
    // Mark episode as complete
    markEpisodeComplete: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.procedure('enrollments.markEpisodeComplete', input, ctx.user.id);
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          logger.error('Enrollment not found for episode completion', { userId: ctx.user.id, courseId: input.courseId });
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
        // Get total episodes for this course
        const episodes = await db.getEpisodesByCourseId(input.courseId);
        const totalEpisodes = episodes.length;
        const completedEpisodes = enrollment.completedEpisodes + 1;
        const progressPercentage = Math.round((completedEpisodes / totalEpisodes) * 100);
        
        await db.updateEnrollment(enrollment.id, {
          completedEpisodes,
          progressPercentage,
          lastAccessed: new Date().toISOString(),
          completedAt: completedEpisodes >= totalEpisodes ? new Date().toISOString() : null,
        });
        logger.info('Episode marked as complete', { 
          userId: ctx.user.id, 
          episodeId: input.episodeId, 
          courseId: input.courseId,
          progress: progressPercentage,
          completed: completedEpisodes >= totalEpisodes
        });
        return { success: true };
      }),
  }),

  // File upload helper
  upload: router({
    image: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[Upload] Uploading image', { fileName: input.fileName });
        
        try {
          // Generate unique file key
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileKey = `courses/images/${Date.now()}-${randomSuffix}-${input.fileName}`;
          
          // Convert base64 to buffer
          const buffer = Buffer.from(input.fileData, 'base64');
          
          // Upload to S3
          const result = await storagePut(fileKey, buffer, input.contentType);
          
          logger.info('[Upload] Image uploaded successfully', { url: result.url });
          return { url: result.url, key: result.key };
        } catch (error) {
          logger.error('[Upload] Image upload failed', { error });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload image' });
        }
      }),
    
    video: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[Upload] Uploading video', { fileName: input.fileName });
        
        try {
          // Generate unique file key
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileKey = `courses/videos/${Date.now()}-${randomSuffix}-${input.fileName}`;
          
          // Convert base64 to buffer
          const buffer = Buffer.from(input.fileData, 'base64');
          
          // Upload to S3
          const result = await storagePut(fileKey, buffer, input.contentType);
          
          logger.info('[Upload] Video uploaded successfully', { url: result.url });
          return { url: result.url, key: result.key };
        } catch (error) {
          logger.error('[Upload] Video upload failed', { error });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload video' });
        }
      }),
  }),

  // LexAI - AI Currency Analysis Chat
  lexai: router({
    // Get active subscription for current user
    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting subscription', { userId: ctx.user.id });
      const subscription = await db.getActiveLexaiSubscription(ctx.user.id);

      if (!subscription) {
        return null;
      }

      if (subscription.endDate) {
        const endDate = new Date(subscription.endDate);
        if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
          await db.updateLexaiSubscription(subscription.id, { isActive: false });
          return null;
        }
      }

      return subscription;
    }),

    redeemKey: protectedProcedure
      .input(z.object({
        keyCode: z.string().min(5),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.info('[LexAI] Redeeming key', { userId: ctx.user.id });

        const existing = await db.getActiveLexaiSubscription(ctx.user.id);
        if (existing?.endDate) {
          const endDate = new Date(existing.endDate);
          if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
            await db.updateLexaiSubscription(existing.id, { isActive: false });
          } else {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Active subscription already exists" });
          }
        } else if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Active subscription already exists" });
        }

        if (!ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User email is required" });
        }

        const activation = await db.activateLexaiKey(input.keyCode, ctx.user.email);
        if (!activation.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: activation.message });
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        await db.createLexaiSubscription({
          userId: ctx.user.id,
          isActive: true,
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
          paymentStatus: "key",
          paymentAmount: 0,
          paymentCurrency: "USD",
          messagesUsed: 0,
          messagesLimit: 100,
        });

        return { success: true };
      }),

    // Create new subscription
    createSubscription: protectedProcedure
      .input(z.object({
        paymentAmount: z.number(),
        durationMonths: z.number().default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.info('[LexAI] Creating subscription', { userId: ctx.user.id });
        
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + input.durationMonths);
        const endDateIso = endDate.toISOString();
        
        await db.createLexaiSubscription({
          userId: ctx.user.id,
          isActive: true,
          startDate: new Date().toISOString(),
          endDate: endDateIso,
          paymentStatus: 'completed',
          paymentAmount: input.paymentAmount,
          messagesUsed: 0,
          messagesLimit: 100,
        });
        
        return { success: true };
      }),

    // Get chat messages
    getMessages: protectedProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting messages', { userId: ctx.user.id });
      const messages = await db.getLexaiMessagesByUser(ctx.user.id, 100);
      return messages;
    }),

    uploadImage: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const env = getWorkerEnv();
        if (!env?.VIDEOS_BUCKET) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "R2 bucket not configured" });
        }

        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `lexai/${ctx.user.id}/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const buffer = Buffer.from(input.fileData, "base64");
        const result = await storagePutR2(env.VIDEOS_BUCKET, key, buffer, input.contentType);

        return { url: result.url, key: result.key };
      }),

    analyzeM15: protectedProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "m15",
          language: input.language,
          timeframe: "M15",
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: "M15",
          imageUrl: input.imageUrl,
          analysisType: "m15",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "m15",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeH4: protectedProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const previous = await getLatestLexaiAnalysis(ctx.user.id, "m15");

        if (!previous) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "M15 analysis required before H4" });
        }

        const analysis = await analyzeLexai({
          flow: "h4",
          language: input.language,
          timeframe: "H4",
          imageUrl: input.imageUrl,
          previousAnalysis: previous.content,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: "H4",
          imageUrl: input.imageUrl,
          analysisType: "h4",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "h4",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeSingle: protectedProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
        timeframe: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "single",
          language: input.language,
          timeframe: input.timeframe || "M15",
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.timeframe || "M15",
          imageUrl: input.imageUrl,
          analysisType: "single",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "single",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeFeedback: protectedProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback",
          language: input.language,
          userAnalysis: input.userAnalysis,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.userAnalysis,
          analysisType: "feedback",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "feedback",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    analyzeFeedbackWithImage: protectedProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback_with_image",
          language: input.language,
          userAnalysis: input.userAnalysis,
          imageUrl: input.imageUrl,
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "user",
          content: input.userAnalysis,
          imageUrl: input.imageUrl,
          analysisType: "feedback_with_image",
        });

        await db.createLexaiMessage({
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          role: "assistant",
          content: analysis.text,
          apiStatus: "success",
          apiRequestId: analysis.id,
          analysisType: "feedback_with_image",
        });

        await db.incrementLexaiMessageCount(subscription.id);

        return { success: true, analysis: analysis.text };
      }),

    // Get subscription stats (admin)
    getStats: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting stats');
      const stats = await db.getLexaiStats();
      return stats;
    }),
  }),

  lexaiAdmin: router({
    subscriptions: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting subscriptions (admin)');
      return await db.getLexaiSubscriptionsWithUsers();
    }),
    keys: router({
      list: adminProcedure.query(async () => {
        logger.info('[LexAI] Getting keys (admin)');
        return await db.getLexaiKeys();
      }),
      stats: adminProcedure.query(async () => {
        logger.info('[LexAI] Getting key stats (admin)');
        return await db.getLexaiKeyStatistics();
      }),
      generateKey: adminProcedure
        .input(z.object({
          notes: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          logger.info('[LexAI] Generating key (admin)', { adminId: ctx.admin.id });
          const key = await db.createRegistrationKey({
            courseId: 0,
            createdBy: ctx.admin.id,
            notes: input.notes,
          });
          return { success: true, key };
        }),
      generateBulkKeys: adminProcedure
        .input(z.object({
          quantity: z.number().min(1).max(1000),
          notes: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          logger.info('[LexAI] Generating bulk keys (admin)', { adminId: ctx.admin.id, quantity: input.quantity });
          const keys = await db.createBulkRegistrationKeys({
            courseId: 0,
            createdBy: ctx.admin.id,
            quantity: input.quantity,
            notes: input.notes,
          });
          return { success: true, keys, count: keys.length };
        }),
      deactivateKey: adminProcedure
        .input(z.object({ keyId: z.number() }))
        .mutation(async ({ input }) => {
          logger.info('[LexAI] Deactivating key (admin)', { keyId: input.keyId });
          const key = await db.deactivateRegistrationKey(input.keyId);
          return { success: true, key };
        }),
    }),
  }),
  
  // ============================================================================
  // Registration Keys Management
  // ============================================================================
  registrationKeys: router({
    // Generate a single key (admin only)
    generateKey: adminProcedure
      .input(z.object({
        courseId: z.number(),
        notes: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[KEYS] Generating single key', { courseId: input.courseId, adminId: ctx.admin.id });
        
        const key = await db.createRegistrationKey({
          courseId: input.courseId,
          createdBy: ctx.admin.id,
          notes: input.notes,
          expiresAt: input.expiresAt,
        });
        
        return { success: true, key };
      }),
    
    // Generate bulk keys (admin only)
    generateBulkKeys: adminProcedure
      .input(z.object({
        courseId: z.number(),
        quantity: z.number().min(1).max(1000),
        notes: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[KEYS] Generating bulk keys', { 
          courseId: input.courseId, 
          quantity: input.quantity,
          adminId: ctx.admin.id 
        });
        
        const keys = await db.createBulkRegistrationKeys({
          courseId: input.courseId,
          createdBy: ctx.admin.id,
          quantity: input.quantity,
          notes: input.notes,
          expiresAt: input.expiresAt,
        });
        
        return { success: true, keys, count: keys.length };
      }),
    
    // Get all keys (admin only)
    getAllKeys: adminProcedure.query(async () => {
      logger.info('[KEYS] Getting all keys');
      const keys = await db.getAllRegistrationKeys();
      return keys;
    }),
    
    // Get keys by course (admin only)
    getKeysByCourse: adminProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        logger.info('[KEYS] Getting keys by course', { courseId: input.courseId });
        const keys = await db.getRegistrationKeysByCourse(input.courseId);
        return keys;
      }),
    
    // Get unused keys (admin only)
    getUnusedKeys: adminProcedure.query(async () => {
      logger.info('[KEYS] Getting unused keys');
      const keys = await db.getUnusedKeys();
      return keys;
    }),
    
    // Get activated keys (admin only)
    getActivatedKeys: adminProcedure.query(async () => {
      logger.info('[KEYS] Getting activated keys');
      const keys = await db.getActivatedKeys();
      return keys;
    }),
    
    // Search keys by email (admin only)
    searchByEmail: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        logger.info('[KEYS] Searching keys by email', { email: input.email });
        const keys = await db.searchKeysByEmail(input.email);
        return keys;
      }),
    
    // Deactivate a key (admin only)
    deactivateKey: adminProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input }) => {
        logger.info('[KEYS] Deactivating key', { keyId: input.keyId });
        const key = await db.deactivateRegistrationKey(input.keyId);
        return { success: true, key };
      }),
    
    // Get key statistics (admin only)
    getStatistics: adminProcedure.query(async () => {
      logger.info('[KEYS] Getting statistics');
      const stats = await db.getKeyStatistics();
      return stats;
    }),
    
    // Activate a key (public - for users)
    activateKey: publicProcedure
      .input(z.object({
        keyCode: z.string(),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[KEYS] Activating key', { keyCode: input.keyCode, email: input.email });
        
        const result = await db.activateRegistrationKey(input.keyCode, input.email);
        
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
        }
        
        // If activation successful and key has a course, create enrollment
        if (result.key && result.key.courseId) {
          // Check if user exists
          const user = await db.getUserByEmail(input.email);
          
          if (user) {
            // Check if enrollment already exists
            const existingEnrollment = await db.getEnrollmentByUserAndCourse(user.id, result.key.courseId);
            
            if (!existingEnrollment) {
              // Create enrollment
              await db.createEnrollment({
                userId: user.id,
                courseId: result.key.courseId,
                paymentStatus: 'completed',
                isSubscriptionActive: true,
                registrationKeyId: result.key.id,
                activatedViaKey: true,
              });
              
              logger.info('[KEYS] Enrollment created', { 
                userId: user.id, 
                courseId: result.key.courseId,
                keyId: result.key.id 
              });
            }
          }
        }
        
        return result;
      }),
    
    // Check if user has valid key for course (public)
    checkAccess: publicProcedure
      .input(z.object({
        email: z.string().email(),
        courseId: z.number(),
      }))
      .query(async ({ input }) => {
        const hasAccess = await db.userHasValidKeyForCourse(input.email, input.courseId);
        return { hasAccess };
      }),
  }),
});

export type AppRouter = typeof appRouter;