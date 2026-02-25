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
import { sendEmail, sendLoginCodeEmail } from "./_core/email";
import { generateNumericCode, generateSaltBase64, normalizeEmail, sha256Base64 } from "./_core/otp";
// FlexAI routes are registered in server/_core/index.ts

const getReqHeader = (req: any, name: string) => {
  const headers = req?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") {
    return headers.get(name) ?? "";
  }
  const key = String(name || "").toLowerCase();
  const value = headers[key] ?? headers[name];
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "string") return value;
  return "";
};

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

const userOnlyProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Please sign in with a user account to use this feature.' });
  }

  return next();
});
const ensureLexaiAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const admin = ctx.user.email ? await db.getAdminByEmail(ctx.user.email) : null;
  let subscription = await db.getActiveLexaiSubscription(ctx.user.id);

  if (!subscription) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active LexAI subscription" });
  }

  if (String(subscription.paymentStatus ?? "").toLowerCase() !== "key") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "LexAI requires an activated registration key",
    });
  }

  if (subscription.endDate) {
    const endDate = new Date(subscription.endDate);
    const shouldEnforceExpiry = Number(subscription.messagesUsed ?? 0) > 0;
    if (shouldEnforceExpiry && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
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

const RECOMMENDATION_REACTIONS = ["like", "love", "sad", "fire", "rocket"] as const;

const buildRecommendationPlainText = (payload: {
  type: "alert" | "recommendation" | "result";
  content: string;
  symbol?: string;
  side?: string;
  entryPrice?: string;
  stopLoss?: string;
  takeProfit1?: string;
  takeProfit2?: string;
  riskPercent?: string;
}) => {
  const lines: string[] = [];
  const title = payload.type === "alert"
    ? "تنبيه توصية"
    : payload.type === "result"
      ? "نتيجة توصية"
      : "توصية جديدة";

  lines.push(`XFlex - ${title}`);
  lines.push("------------------------------");
  if (payload.symbol) lines.push(`الزوج/الأصل: ${payload.symbol}`);
  if (payload.side) lines.push(`الاتجاه: ${payload.side}`);
  if (payload.entryPrice) lines.push(`الدخول: ${payload.entryPrice}`);
  if (payload.stopLoss) lines.push(`وقف الخسارة: ${payload.stopLoss}`);
  if (payload.takeProfit1) lines.push(`هدف 1: ${payload.takeProfit1}`);
  if (payload.takeProfit2) lines.push(`هدف 2: ${payload.takeProfit2}`);
  if (payload.riskPercent) lines.push(`نسبة المخاطرة: ${payload.riskPercent}`);
  lines.push("");
  lines.push(payload.content);
  lines.push("");
  lines.push("تابع القروب الآن للتنفيذ السريع.");

  return lines.join("\n");
};

const ensureRecommendationReadAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const access = await db.getUserRecommendationsAccess(ctx.user.id);
  const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));

  if (!access.hasSubscription && !access.canPublish && !isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Recommendation group requires an active key.",
    });
  }

  return { ...access, isAdmin };
};

const ensureRecommendationPublishAccess = async (ctx: { user: { id: number; email?: string | null } | null }) => {
  const access = await ensureRecommendationReadAccess(ctx);
  if (!access.canPublish && !access.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only analysts can publish recommendations.",
    });
  }
  return access;
};

const ensureEpisodeUnlockedForUser = async (userId: number, courseId: number, episodeId: number) => {
  const episodes = await db.getEpisodesByCourseId(courseId);
  const sortedEpisodes = [...episodes].sort((a, b) => a.order - b.order);
  const episode = sortedEpisodes.find((ep) => ep.id === episodeId);

  if (!episode) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found in this course' });
  }

  if (episode.order <= 1) {
    return { episode, episodes: sortedEpisodes };
  }

  const previousEpisode = sortedEpisodes.find((ep) => ep.order === episode.order - 1);
  if (!previousEpisode) {
    return { episode, episodes: sortedEpisodes };
  }

  const courseProgress = await db.getUserCourseProgress(userId, courseId);
  const completedEpisodeIds = new Set(
    courseProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)
  );

  if (!completedEpisodeIds.has(previousEpisode.id)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Complete the previous episode first.',
    });
  }

  return { episode, episodes: sortedEpisodes };
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

        // Sync entitlements from any keys already assigned to this email
        try {
          await db.syncUserEntitlementsFromKeys(userId, input.email);
        } catch (e) {
          logger.warn('[AUTH] Failed syncing entitlements after register', { email: input.email });
        }
        
        logger.info('[AUTH] User registered successfully', { userId, email: input.email });
        
        return { success: true, userId };
      }),

    /**
     * Passwordless sign-in: request a one-time code by email.
     * Always returns success to avoid email enumeration.
     */
    requestLoginCode: publicProcedure
      .input(
        z.object({
          email: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email || "");
        if (!isValidEmail(email)) {
          return { success: true };
        }

        // Do not allow OTP for admins (admin uses dedicated password login)
        const admin = await db.getAdminByEmail(email);
        if (admin) {
          return { success: true };
        }

        const nowMs = Date.now();
        await db.deleteExpiredEmailOtps(nowMs);

        const ip =
          getReqHeader(ctx.req, "cf-connecting-ip") ||
          (getReqHeader(ctx.req, "x-forwarded-for") || "").split(",")[0].trim() ||
          "";
        const userAgent = getReqHeader(ctx.req, "user-agent") || "";

        const ipHash = ip ? await sha256Base64(`ip:${ip}`) : null;
        const userAgentHash = userAgent ? await sha256Base64(`ua:${userAgent}`) : null;

        // Rate limits (best-effort)
        const per30SecEmail = await db.countEmailOtpsSentSince({
          email,
          sinceMs: nowMs - 30_000,
          purpose: "login",
        });
        if (per30SecEmail > 0) {
          return { success: true };
        }

        const perHourEmail = await db.countEmailOtpsSentSince({
          email,
          sinceMs: nowMs - 60 * 60_000,
          purpose: "login",
        });
        if (perHourEmail >= 5) {
          return { success: true };
        }

        const perHourIp = ipHash
          ? await db.countEmailOtpsSentSince({
              ipHash,
              sinceMs: nowMs - 60 * 60_000,
            })
          : 0;
        if (perHourIp >= 20) {
          return { success: true };
        }

        // Only send codes to existing users OR emails that already have access (assigned keys).
        const existingUser = await db.getUserByEmail(email);
        const hasLexaiKey = await db.hasValidLexaiKeyByEmail(email);
        const courseKeys = await db.getValidCourseKeysByEmail(email);
        const hasCourseKey = courseKeys.length > 0;

        if (!existingUser && !hasLexaiKey && !hasCourseKey) {
          return { success: true };
        }

        const code = generateNumericCode(6);
        const salt = generateSaltBase64(16);
        const codeHash = await sha256Base64(`${salt}:${code}`);
        const expiresMinutes = 10;
        const expiresAtMs = nowMs + expiresMinutes * 60_000;

        await db.createEmailOtp({
          email,
          purpose: "login",
          codeHash,
          salt,
          sentAtMs: nowMs,
          expiresAtMs,
          ipHash,
          userAgentHash,
        });

        try {
          await sendLoginCodeEmail({ to: email, code, expiresMinutes });
        } catch (e) {
          logger.error("[AUTH] Failed sending login code", {
            email,
            error: e instanceof Error ? e.message : "Unknown error",
          });
          // Don't leak delivery failures to the client.
        }

        return { success: true };
      }),

    /**
     * Passwordless sign-in: verify a one-time code and create a user session.
     */
    verifyLoginCode: publicProcedure
      .input(
        z.object({
          email: z.string(),
          code: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email || "");
        const code = (input.code || "").trim();

        if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        const admin = await db.getAdminByEmail(email);
        if (admin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Please sign in through the admin login page.",
          });
        }

        const nowMs = Date.now();
        await db.deleteExpiredEmailOtps(nowMs);
        const otp = await db.getLatestEmailOtp(email, "login");

        if (!otp || Number(otp.expiresAtMs) < nowMs) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        const computedHash = await sha256Base64(`${otp.salt}:${code}`);
        if (computedHash !== otp.codeHash) {
          const attempts = await db.incrementEmailOtpAttempts(otp.id);
          if (attempts >= 10) {
            await db.deleteEmailOtpsForEmail(email, "login");
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid code" });
        }

        await db.deleteEmailOtpsForEmail(email, "login");

        let user = await db.getUserByEmail(email);
        if (!user) {
          const hasLexaiKey = await db.hasValidLexaiKeyByEmail(email);
          const courseKeys = await db.getValidCourseKeysByEmail(email);
          const hasCourseKey = courseKeys.length > 0;

          if (!hasLexaiKey && !hasCourseKey) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "No access found for this email. Please activate a registration key.",
            });
          }

          const randomPassword = `${generateSaltBase64(24)}${generateSaltBase64(24)}`;
          const passwordHash = await hashPassword(randomPassword);
          const displayName = email.split("@")[0] || "User";

          const userId = await db.createUser({
            email,
            passwordHash,
            name: displayName,
          });
          user = await db.getUserById(userId);
        }

        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to sign in" });
        }

        await db.updateUserLastSignIn(user.id);
        await db.setUserEmailVerified(user.id);

        const token = await generateToken({
          userId: user.id,
          email,
          type: "user",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.setCookie(COOKIE_NAME, token, cookieOptions);

        try {
          await db.syncUserEntitlementsFromKeys(user.id, email);
        } catch (e) {
          logger.warn("[AUTH] Failed syncing entitlements after OTP login", { userId: user.id, email });
        }

        return { success: true };
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

        // Sync entitlements from any keys already assigned to this email
        try {
          await db.syncUserEntitlementsFromKeys(user.id, input.email);
        } catch (e) {
          logger.warn('[AUTH] Failed syncing entitlements after login', { email: input.email, userId: user.id });
        }
        
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
      return await db.getAllEnrollmentsWithDetails(5);
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

    // User: Sync entitlements from any assigned keys (courses + LexAI)
    syncEntitlements: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.email) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User email is required' });
      }

      await db.syncUserEntitlementsFromKeys(ctx.user.id, ctx.user.email);
      return { success: true };
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
      return await db.getAllEnrollmentsWithDetails();
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
        const { episode, episodes } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        const existingEpisodeProgress = await db.getUserEpisodeProgress(ctx.user.id, input.episodeId);
        if (existingEpisodeProgress?.isCompleted) {
          return { success: true, alreadyCompleted: true };
        }

        // Enforce a minimum watch duration (70% of episode duration, minimum 60s)
        const requiredWatchSeconds = episode.duration && episode.duration > 0
          ? Math.max(60, Math.floor(episode.duration * 60 * 0.7))
          : 60;
        const watchedDuration = Number(existingEpisodeProgress?.watchedDuration || 0);
        if (watchedDuration < requiredWatchSeconds) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Watch more of this episode before marking complete (${Math.ceil(requiredWatchSeconds / 60)} min required).`,
          });
        }

        // Intro episode (order = 1) is exempt from quiz gating
        if (episode.order > 1) {
          const quizLevel = episode.order - 1;
          const quiz = await db.getQuizByLevel(quizLevel);
          if (!quiz) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Quiz is not configured for this episode yet.',
            });
          }

          const hasPassedQuiz = await db.hasUserPassedQuizLevel(ctx.user.id, quizLevel);
          if (!hasPassedQuiz) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Pass the episode quiz (${quiz.passingScore}% required) before continuing.`,
            });
          }
        }

        await db.createOrUpdateEpisodeProgress({
          userId: ctx.user.id,
          episodeId: input.episodeId,
          courseId: input.courseId,
          watchedDuration: Math.max(watchedDuration, requiredWatchSeconds),
          isCompleted: true,
          lastWatchedAt: new Date().toISOString(),
        });

        // Compute progress from completed per-episode records
        const totalEpisodes = episodes.length;
        const courseProgress = await db.getUserCourseProgress(ctx.user.id, input.courseId);
        const completedEpisodeIds = new Set(
          courseProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)
        );
        const completedEpisodes = episodes.filter((ep) => completedEpisodeIds.has(ep.id)).length;
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

  episodeQuiz: router({
    getForEpisode: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { episode } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        if (episode.order <= 1) {
          return { required: false, passed: true, introEpisode: true, quiz: null };
        }

        const quizLevel = episode.order - 1;
        const quiz = await db.getQuizForLevelWithQuestions(quizLevel);

        if (!quiz) {
          return { required: true, passed: false, introEpisode: false, quiz: null };
        }

        const passed = await db.hasUserPassedQuizLevel(ctx.user.id, quizLevel);

        return {
          required: true,
          passed,
          introEpisode: false,
          quiz,
        };
      }),

    submitForEpisode: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        episodeId: z.number(),
        answers: z.array(z.object({
          questionId: z.number(),
          optionId: z.string().min(1),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const { episode } = await ensureEpisodeUnlockedForUser(
          ctx.user.id,
          input.courseId,
          input.episodeId
        );

        if (episode.order <= 1) {
          return {
            score: 100,
            passed: true,
            correctCount: 0,
            totalQuestions: 0,
            passingScore: 50,
            detailedResults: [],
            introEpisode: true,
          };
        }

        const quizLevel = episode.order - 1;
        const quiz = await db.getQuizByLevel(quizLevel);
        if (!quiz) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Quiz is not configured for this episode.',
          });
        }

        return await db.submitEpisodeQuizAttempt(ctx.user.id, quizLevel, input.answers);
      }),
  }),

  // Episode progress tracking (per user)
  episodeProgress: router({
    updateProgress: protectedProcedure
      .input(
        z.object({
          episodeId: z.number(),
          courseId: z.number(),
          watchedDuration: z.number().min(0),
          isCompleted: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureEpisodeUnlockedForUser(ctx.user.id, input.courseId, input.episodeId);

        await db.createOrUpdateEpisodeProgress({
          userId: ctx.user.id,
          episodeId: input.episodeId,
          courseId: input.courseId,
          watchedDuration: Math.floor(input.watchedDuration),
          isCompleted: input.isCompleted ?? false,
          lastWatchedAt: new Date().toISOString(),
        });

        return { success: true };
      }),

    getCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getUserCourseProgress(ctx.user.id, input.courseId);
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
    getSubscription: userOnlyProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting subscription', { userId: ctx.user.id });
      const subscription = await db.getActiveLexaiSubscription(ctx.user.id);

      if (!subscription) {
        return null;
      }

      if (subscription.endDate) {
        const endDate = new Date(subscription.endDate);
        const shouldEnforceExpiry = Number(subscription.messagesUsed ?? 0) > 0;
        if (shouldEnforceExpiry && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
          await db.updateLexaiSubscription(subscription.id, { isActive: false });
          return null;
        }
      }

      return subscription;
    }),

    redeemKey: userOnlyProcedure
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
          } else if (String(existing.paymentStatus ?? "").toLowerCase() === "key") {
            return { success: true };
          } else {
            await db.updateLexaiSubscription(existing.id, { isActive: false });
          }
        } else if (existing) {
          if (String(existing.paymentStatus ?? "").toLowerCase() === "key") {
            return { success: true };
          } else {
            await db.updateLexaiSubscription(existing.id, { isActive: false });
          }
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

        const current = await db.getActiveLexaiSubscription(ctx.user.id);
        if (current) {
          await db.updateLexaiSubscription(current.id, {
            isActive: true,
            startDate: new Date().toISOString(),
            endDate: endDate.toISOString(),
            paymentStatus: "key",
            paymentAmount: 0,
            paymentCurrency: "USD",
            messagesUsed: 0,
            messagesLimit: 100,
          });
        } else {
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
        }

        return { success: true };
      }),

    // Public: Redeem a LexAI key by email (no login required)
    redeemKeyByEmail: publicProcedure
      .input(z.object({
        keyCode: z.string().min(5),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[LexAI] Redeeming key by email', { email: input.email });

        const activation = await db.activateLexaiKey(input.keyCode, input.email);
        if (!activation.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: activation.message });
        }

        return { success: true };
      }),

    // Public: Verify if an email already has a valid assigned LexAI key
    hasAssignedKeyByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const hasKey = await db.hasValidLexaiKeyByEmail(input.email);
        return { hasKey };
      }),

    verifyAssignedKeyByEmail: userOnlyProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User email is required" });
        }

        const accountEmail = ctx.user.email.trim().toLowerCase();
        const requestedEmail = input.email.trim().toLowerCase();

        if (requestedEmail !== accountEmail) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please enter the same email as your account" });
        }

        const key = await db.getAssignedLexaiKeyByEmail(requestedEmail);
        if (!key || !key.activatedAt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No active assigned LexAI key found for this email" });
        }

        const activatedAt = new Date(key.activatedAt);
        if (Number.isNaN(activatedAt.getTime())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid key activation date" });
        }

        const keyExpiry = new Date(activatedAt);
        keyExpiry.setDate(keyExpiry.getDate() + 30);

        if (key.expiresAt) {
          const absoluteExpiry = new Date(key.expiresAt);
          if (!Number.isNaN(absoluteExpiry.getTime()) && absoluteExpiry.getTime() < keyExpiry.getTime()) {
            keyExpiry.setTime(absoluteExpiry.getTime());
          }
        }

        if (keyExpiry.getTime() < Date.now()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Assigned key has expired" });
        }

        const existing = await db.getActiveLexaiSubscription(ctx.user.id);
        if (existing) {
          await db.updateLexaiSubscription(existing.id, {
            isActive: true,
            startDate: new Date().toISOString(),
            endDate: keyExpiry.toISOString(),
            paymentStatus: "key",
            paymentAmount: 0,
            paymentCurrency: "USD",
            messagesUsed: 0,
            messagesLimit: 100,
          });
        } else {
          await db.createLexaiSubscription({
            userId: ctx.user.id,
            isActive: true,
            startDate: new Date().toISOString(),
            endDate: keyExpiry.toISOString(),
            paymentStatus: "key",
            paymentAmount: 0,
            paymentCurrency: "USD",
            messagesUsed: 0,
            messagesLimit: 100,
          });
        }

        return { success: true, expiresAt: keyExpiry.toISOString() };
      }),

    // Create new subscription
    createSubscription: userOnlyProcedure
      .input(z.object({
        paymentAmount: z.number(),
        durationMonths: z.number().default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        logger.warn('[LexAI] Blocked direct subscription creation', {
          userId: ctx.user.id,
          paymentAmount: input.paymentAmount,
          durationMonths: input.durationMonths,
        });

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Subscription creation is disabled. Please activate a registration key.",
        });
      }),

    // Get chat messages
    getMessages: userOnlyProcedure.query(async ({ ctx }) => {
      logger.info('[LexAI] Getting messages', { userId: ctx.user.id });
      const messages = await db.getLexaiMessagesByUser(ctx.user.id, 100);
      return messages;
    }),

    clearHistory: userOnlyProcedure.mutation(async ({ ctx }) => {
      logger.info('[LexAI] Clearing chat history', { userId: ctx.user.id });
      await db.deleteLexaiMessagesByUser(ctx.user.id);
      return { success: true };
    }),

    uploadImage: userOnlyProcedure
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

    analyzeM15: userOnlyProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "m15",
          language: "ar",
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

    analyzeH4: userOnlyProcedure
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
          language: "ar",
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

    analyzeSingle: userOnlyProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
        timeframe: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "single",
          language: "ar",
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

    analyzeFeedback: userOnlyProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback",
          language: "ar",
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

    analyzeFeedbackWithImage: userOnlyProcedure
      .input(z.object({
        userAnalysis: z.string().min(5),
        imageUrl: z.string().url(),
        language: z.enum(["ar", "en"]).default("ar"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { subscription } = await ensureLexaiAccess(ctx);
        const analysis = await analyzeLexai({
          flow: "feedback_with_image",
          language: "ar",
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

  recommendations: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const access = await db.getUserRecommendationsAccess(ctx.user.id);
      return {
        canPublish: access.canPublish,
        hasSubscription: access.hasSubscription,
        subscription: access.subscription,
      };
    }),

    feed: protectedProcedure
      .input(z.object({ limit: z.number().min(20).max(500).optional() }).optional())
      .query(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        return await db.getRecommendationMessagesFeed(ctx.user.id, input?.limit ?? 200);
      }),

    postMessage: protectedProcedure
      .input(
        z.object({
          type: z.enum(["alert", "recommendation", "result"]),
          content: z.string().min(3).max(4000),
          symbol: z.string().max(30).optional(),
          side: z.string().max(10).optional(),
          entryPrice: z.string().max(50).optional(),
          stopLoss: z.string().max(50).optional(),
          takeProfit1: z.string().max(50).optional(),
          takeProfit2: z.string().max(50).optional(),
          riskPercent: z.string().max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationPublishAccess(ctx);

        const messageId = await db.createRecommendationMessage({
          userId: ctx.user.id,
          type: input.type,
          content: input.content,
          symbol: input.symbol,
          side: input.side,
          entryPrice: input.entryPrice,
          stopLoss: input.stopLoss,
          takeProfit1: input.takeProfit1,
          takeProfit2: input.takeProfit2,
          riskPercent: input.riskPercent,
          createdAt: new Date().toISOString(),
        });

        if (input.type === "alert" || input.type === "recommendation") {
          const recipients = await db.getRecommendationSubscriberEmails();
          if (recipients.length) {
            const subject = input.type === "alert"
              ? "تنبيه: توصية جديدة خلال دقيقة - XFlex"
              : "توصية جديدة في قروب التوصيات - XFlex";
            const text = buildRecommendationPlainText(input);

            await Promise.allSettled(
              recipients.map((to) =>
                sendEmail({
                  to,
                  subject,
                  text,
                })
              )
            );
          }
        }

        return { success: true, messageId };
      }),

    react: protectedProcedure
      .input(
        z.object({
          messageId: z.number(),
          reaction: z.enum(RECOMMENDATION_REACTIONS).nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureRecommendationReadAccess(ctx);
        await db.setRecommendationReaction(input.messageId, ctx.user.id, input.reaction);
        return { success: true };
      }),

    activateKey: publicProcedure
      .input(z.object({ keyCode: z.string().min(5), email: z.string().email() }))
      .mutation(async ({ input }) => {
        const result = await db.activateRecommendationKey(input.keyCode, input.email);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
        }

        const user = await db.getUserByEmail(input.email);
        if (user) {
          await db.syncUserEntitlementsFromKeys(user.id, input.email);
        }

        return result;
      }),
  }),

  recommendationAdmin: router({
    listAnalysts: adminProcedure.query(async () => {
      return await db.getRecommendationPublishers();
    }),

    setAnalyst: adminProcedure
      .input(z.object({ userId: z.number(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setRecommendationPublisher(input.userId, input.enabled);
        return { success: true };
      }),

    keys: router({
      list: adminProcedure.query(async () => {
        return await db.getRecommendationKeys();
      }),
      stats: adminProcedure.query(async () => {
        return await db.getRecommendationKeyStatistics();
      }),
      generateKey: adminProcedure
        .input(z.object({ notes: z.string().optional(), expiresAt: z.date().optional() }))
        .mutation(async ({ input, ctx }) => {
          const key = await db.createRegistrationKey({
            courseId: -1,
            createdBy: ctx.admin.id,
            notes: input.notes,
            expiresAt: input.expiresAt,
          });
          return { success: true, key };
        }),
      generateBulkKeys: adminProcedure
        .input(z.object({ quantity: z.number().min(1).max(1000), notes: z.string().optional(), expiresAt: z.date().optional() }))
        .mutation(async ({ input, ctx }) => {
          const keys = await db.createBulkRegistrationKeys({
            courseId: -1,
            createdBy: ctx.admin.id,
            quantity: input.quantity,
            notes: input.notes,
            expiresAt: input.expiresAt,
          });
          return { success: true, keys, count: keys.length };
        }),
      deactivateKey: adminProcedure
        .input(z.object({ keyId: z.number() }))
        .mutation(async ({ input }) => {
          const key = await db.deactivateRegistrationKey(input.keyId);
          return { success: true, key };
        }),
    }),
  }),

  lexaiAdmin: router({
    subscriptions: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting subscriptions (admin)');
      return await db.getLexaiSubscriptionsWithUsers();
    }),
    
    // Get all users with LexAI conversations (for admin moderation)
    conversationUsers: adminProcedure.query(async () => {
      logger.info('[LexAI] Getting conversation users (admin)');
      return await db.getLexaiConversationUsers();
    }),
    
    // Get all messages (for admin moderation)
    allMessages: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(1000).optional() }).optional())
      .query(async ({ input }) => {
        logger.info('[LexAI] Getting all messages (admin)');
        return await db.getAllLexaiMessagesWithUsers(input?.limit ?? 500);
      }),
    
    // Get messages for a specific user (for admin moderation)
    userMessages: adminProcedure
      .input(z.object({ userId: z.number(), limit: z.number().min(1).max(500).optional() }))
      .query(async ({ input }) => {
        logger.info('[LexAI] Getting user messages (admin)', { userId: input.userId });
        return await db.getLexaiMessagesByUser(input.userId, input.limit ?? 100);
      }),
    
    // Delete a specific user's chat history (for admin moderation)
    deleteUserMessages: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[LexAI] Deleting user messages (admin)', { userId: input.userId, adminId: ctx.admin.id });
        await db.deleteLexaiMessagesByUser(input.userId);
        return { success: true };
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

    // Public: Get minimal key info (to guide UX and enforce correct activation path)
    getKeyInfo: publicProcedure
      .input(z.object({ keyCode: z.string().min(5) }))
      .query(async ({ input }) => {
        const key = await db.getRegistrationKeyByCode(input.keyCode);
        if (!key) {
          return { exists: false } as const;
        }

        return {
          exists: true,
          isActive: !!key.isActive,
          activatedAt: key.activatedAt ?? null,
          keyType: key.courseId === 0 ? 'lexai' : key.courseId === -1 ? 'recommendation' : 'course',
          courseId: key.courseId,
        } as const;
      }),

    // Public: Verify if an email already has at least one valid course key
    getCourseAccessByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const keys = await db.getValidCourseKeysByEmail(input.email);
        const courseIds = Array.from(new Set(keys.map(k => Number(k.courseId)).filter(Boolean)));
        return { hasAccess: courseIds.length > 0, courseIds };
      }),
    
    // Activate a key (public - for users)
    activateKey: publicProcedure
      .input(z.object({
        keyCode: z.string(),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        logger.info('[KEYS] Activating key', { keyCode: input.keyCode, email: input.email });

        const existingKey = await db.getRegistrationKeyByCode(input.keyCode);
        if (existingKey && existingKey.courseId === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This key is for LexAI. Please activate it from the LexAI page.',
          });
        }
        if (existingKey && existingKey.courseId === -1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This key is for recommendations. Please activate it from the recommendations page.',
          });
        }
        
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

    // Redeem a course key for the currently logged-in user
    // (Worker production only supports tRPC, not REST /api/courses/* routes)
    redeemKey: protectedProcedure
      .input(z.object({ keyCode: z.string().min(5) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.email) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'User email is required' });
        }

        logger.info('[KEYS] Redeeming key', { keyCode: input.keyCode, userId: ctx.user.id });

        const existingKey = await db.getRegistrationKeyByCode(input.keyCode);
        if (existingKey && existingKey.courseId === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This key is for LexAI. Please activate it from the LexAI page.',
          });
        }
        if (existingKey && existingKey.courseId === -1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This key is for recommendations. Please activate it from the recommendations page.',
          });
        }

        const result = await db.activateRegistrationKey(input.keyCode, ctx.user.email);

        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.message });
        }

        if (result.key?.courseId) {
          const existingEnrollment = await db.getEnrollmentByUserAndCourse(ctx.user.id, result.key.courseId);
          if (!existingEnrollment) {
            await db.createEnrollment({
              userId: ctx.user.id,
              courseId: result.key.courseId,
              paymentStatus: 'completed',
              isSubscriptionActive: true,
              registrationKeyId: result.key.id,
              activatedViaKey: true,
            });

            logger.info('[KEYS] Enrollment created via redeemKey', {
              userId: ctx.user.id,
              courseId: result.key.courseId,
              keyId: result.key.id,
            });
          }
        }

        return { success: true };
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