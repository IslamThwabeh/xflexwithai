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
import { sendOrderConfirmationEmail, sendPaymentReceivedEmail, sendAdminNewOrderNotification } from "./_core/orderEmails";
import { ENV } from "./_core/env";
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

// Staff procedure – checks if user has any staff role (support, analyst, permissions), or is admin
const supportStaffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) return next({ ctx: { ...ctx, admin, staffRole: 'admin' as const } });
  const isStaff = await db.hasAnyRole(ctx.user.id, [
    'support', 'key_manager', 'analyst',
    'client_lookup', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes',
  ]);
  if (!isStaff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return next({ ctx: { ...ctx, admin: null, staffRole: 'support' as const } });
});

// Admin-or-role procedure factory
const adminOrRoleProcedure = (roles: string[]) => protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  const admin = await db.getAdminByEmail(ctx.user.email);
  if (admin) return next({ ctx: { ...ctx, admin } });
  const has = await db.hasAnyRole(ctx.user.id, roles);
  if (!has) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }
  return next({ ctx: { ...ctx, admin: null } });
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

  // Accept both "key" (legacy key activation) and "completed" (package activation / order)
  const validStatuses = ["key", "completed"];
  if (!validStatuses.includes(String(subscription.paymentStatus ?? "").toLowerCase())) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "LexAI requires an active subscription",
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
        phone: z.string().min(5).optional(),
        city: z.string().min(1).optional(),
        country: z.string().min(1).optional(),
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
          phone: input.phone,
          city: input.city,
          country: input.country,
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

    // Public: Get free courses (price = 0)
    free: publicProcedure.query(async () => {
      return await db.getFreeCourses();
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
        stageNumber: z.number().default(0),
        introVideoUrl: z.string().optional(),
        hasPdf: z.boolean().default(false),
        hasIntroVideo: z.boolean().default(false),
        pdfUrl: z.string().optional(),
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
        stageNumber: z.number().optional(),
        introVideoUrl: z.string().optional(),
        hasPdf: z.boolean().optional(),
        hasIntroVideo: z.boolean().optional(),
        pdfUrl: z.string().optional(),
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
        price: z.number().min(0).optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        logger.info('[KEYS] Generating single key', { courseId: input.courseId, adminId: ctx.admin.id });
        
        const key = await db.createRegistrationKey({
          courseId: input.courseId,
          createdBy: ctx.admin.id,
          notes: input.notes,
          price: input.price ?? 0,
          currency: "USD",
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
        price: z.number().min(0).optional(),
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
          price: input.price ?? 0,
          currency: "USD",
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
                paymentAmount: result.key.price ?? 0,
                paymentCurrency: result.key.currency ?? 'USD',
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
              paymentAmount: result.key.price ?? 0,
              paymentCurrency: result.key.currency ?? 'USD',
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

  // Contact Support (public, sends email to admin)
  contactSupport: publicProcedure
    .input(z.object({
      email: z.string().email(),
      message: z.string().min(5).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const adminEmail = ENV.emailFrom || 'support@xflexacademy.com';
      await sendEmail({
        to: adminEmail,
        subject: `[XFlex Support] New message from ${input.email}`,
        text: `New support message from: ${input.email}\n\n${input.message}\n\n---\nReply directly to ${input.email}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Support Chat – real-time 1-on-1 client↔support messaging
  // =========================================================================
  supportChat: router({
    // Client: get or create their conversation & messages
    myConversation: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const conv = await db.getOrCreateSupportConversation(ctx.user.id);
      const messages = await db.getSupportMessages(conv.id);
      // Mark support/admin replies as read
      await db.markClientMessagesRead(conv.id);
      return { conversation: conv, messages };
    }),

    // Client: send a message
    send: protectedProcedure
      .input(z.object({ content: z.string().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const conv = await db.getOrCreateSupportConversation(ctx.user.id);
        const msg = await db.createSupportMessage({
          conversationId: conv.id,
          senderId: ctx.user.id,
          senderType: 'client',
          content: input.content,
        });
        return msg;
      }),

    // Client: unread count badge
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { count: 0 };
      const count = await db.getUnreadSupportCount(ctx.user.id);
      return { count };
    }),

    // Support/Admin: list all conversations with last message & unread counts
    listAll: supportStaffProcedure.query(async () => {
      return db.getAllSupportConversations();
    }),

    // Support/Admin: get messages of a specific conversation
    getMessages: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        const conv = await db.getSupportConversation(input.conversationId);
        if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        await db.markSupportMessagesRead(input.conversationId, 'support');
        const messages = await db.getSupportMessages(input.conversationId);
        return { conversation: conv, messages };
      }),

    // Support/Admin: reply to a conversation
    reply: supportStaffProcedure
      .input(z.object({
        conversationId: z.number(),
        content: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const conv = await db.getSupportConversation(input.conversationId);
        if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });

        const isAdmin = ctx.user.email ? !!(await db.getAdminByEmail(ctx.user.email)) : false;
        const msg = await db.createSupportMessage({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          senderType: isAdmin ? 'admin' : 'support',
          content: input.content,
        });
        return msg;
      }),

    // Support/Admin: close a conversation
    close: supportStaffProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        await db.closeSupportConversation(input.conversationId);
        return { success: true };
      }),
  }),

  // =========================================================================
  // Role Management (admin only)
  // =========================================================================
  roles: router({
    // List all role assignments
    list: adminProcedure.query(async () => {
      return db.getAllRoleAssignments();
    }),

    // List users with a specific role
    byRole: adminProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => {
        return db.getUsersWithRole(input.role);
      }),

    // Assign a role to a user
    assign: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['analyst', 'support', 'key_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup']),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user exists
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        await db.assignRole(input.userId, input.role, (ctx as any).admin?.id);

        // Keep canPublishRecommendations in sync for backward compat
        if (input.role === 'analyst') {
          await db.setRecommendationPublisher(input.userId, true);
        }

        return { success: true };
      }),

    // Remove a role from a user
    remove: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['analyst', 'support', 'key_manager', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'client_lookup']),
      }))
      .mutation(async ({ input }) => {
        await db.removeRole(input.userId, input.role);

        // Keep canPublishRecommendations in sync for backward compat
        if (input.role === 'analyst') {
          await db.setRecommendationPublisher(input.userId, false);
        }

        return { success: true };
      }),

    // Get roles for a specific user
    forUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserRoles(input.userId);
      }),

    // Client: get my own roles (for UI gating)
    myRoles: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return db.getUserRoles(ctx.user.id);
    }),
  }),

  // =========================================================================
  // Support Dashboard – permission-gated client data for support staff
  // =========================================================================
  supportDashboard: router({
    // Search clients by email or name (requires 'client_lookup' or 'support' role, or admin)
    searchClients: supportStaffProcedure
      .input(z.object({ query: z.string().min(1).max(200) }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canSearch = await db.hasAnyRole(ctx.user.id, ['client_lookup', 'support']);
          if (!canSearch) throw new TRPCError({ code: 'FORBIDDEN', message: 'Client lookup permission required' });
        }
        const allUsers = await db.getAllUsers();
        const q = input.query.toLowerCase();
        return (allUsers ?? []).filter((u: any) =>
          u.email?.toLowerCase().includes(q) ||
          u.name?.toLowerCase().includes(q) ||
          u.phone?.includes(q)
        ).slice(0, 50).map((u: any) => ({
          id: u.id, email: u.email, name: u.name, phone: u.phone, createdAt: u.createdAt,
        }));
      }),

    // Get client course progress & enrollments (requires 'view_progress' or admin)
    clientProgress: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_progress']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View progress permission required' });
        }
        const enrollmentsList = await db.getEnrollmentsByUserId(input.userId);
        // For each enrollment, get episode-level progress
        const result = [];
        for (const enr of enrollmentsList) {
          const epProgress = await db.getUserCourseProgress(input.userId, enr.courseId);
          result.push({ ...enr, episodeProgress: epProgress });
        }
        return result;
      }),

    // Get client subscriptions & keys (requires 'view_subscriptions' or admin)
    clientSubscriptions: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_subscriptions']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View subscriptions permission required' });
        }
        const lexai = await db.getActiveLexaiSubscription(input.userId);
        const recommendation = await db.getActiveRecommendationSubscription(input.userId);
        const enrollmentsList = await db.getEnrollmentsByUserId(input.userId);
        return {
          lexai: lexai ?? null,
          recommendation: recommendation ?? null,
          enrollments: enrollmentsList,
        };
      }),

    // Get client quiz progress (requires 'view_quizzes' or admin)
    clientQuizProgress: supportStaffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_quizzes']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View quizzes permission required' });
        }
        // Get all quiz attempts for this user
        return db.getQuizAttemptsByUser(input.userId);
      }),

    // Get recommendation feed (requires 'view_recommendations' or admin)
    recommendationFeed: supportStaffProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
        if (!isAdmin) {
          const canView = await db.hasAnyRole(ctx.user.id, ['view_recommendations']);
          if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'View recommendations permission required' });
        }
        return db.getRecommendationMessagesFeed(0, 100);
      }),

    // Get my staff permissions (support + analyst)
    myPermissions: supportStaffProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { isAdmin: false, isAnalyst: false, permissions: [] as string[] };
      const isAdmin = !!(ctx.user.email && await db.getAdminByEmail(ctx.user.email));
      if (isAdmin) {
        return {
          isAdmin: true,
          isAnalyst: true,
          permissions: ['support', 'analyst', 'client_lookup', 'view_progress', 'view_recommendations', 'view_subscriptions', 'view_quizzes', 'key_manager'],
        };
      }
      const roles = await db.getUserRoles(ctx.user.id);
      const roleNames = roles.map(r => r.role);
      const access = await db.getUserRecommendationsAccess(ctx.user.id);
      return {
        isAdmin: false,
        isAnalyst: access.canPublish || roleNames.includes('analyst'),
        permissions: roleNames,
      };
    }),
  }),

  // =============================================
  // PACKAGES (public + admin)
  // =============================================
  packages: router({
    // Public: list published packages
    list: publicProcedure.query(async () => {
      return db.getAllPackages(true);
    }),

    // Public: get single package by slug
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const pkg = await db.getPackageBySlug(input.slug);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        return pkg;
      }),

    // Public: get single package by id
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const pkg = await db.getPackageById(input.id);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        return pkg;
      }),

    // Public: get courses in a package
    courses: publicProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackageCourses(input.packageId);
      }),

    // Admin: list all packages (including unpublished)
    adminList: adminProcedure.query(async () => {
      return db.getAllPackages(false);
    }),

    // Admin: create package
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number().min(0),
        currency: z.string().default('USD'),
        renewalPrice: z.number().optional(),
        renewalPeriodDays: z.number().optional(),
        renewalDescription: z.string().optional(),
        includesLexai: z.number().min(0).max(1).default(0),
        includesRecommendations: z.number().min(0).max(1).default(0),
        includesSupport: z.number().min(0).max(1).default(0),
        includesPdf: z.number().min(0).max(1).default(0),
        durationDays: z.number().optional(),
        isLifetime: z.number().min(0).max(1).default(1),
        isPublished: z.number().min(0).max(1).default(0),
        displayOrder: z.number().default(0),
        thumbnailUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createPackage(input);
      }),

    // Admin: update package
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().optional(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        renewalPrice: z.number().optional(),
        renewalPeriodDays: z.number().optional(),
        renewalDescription: z.string().optional(),
        includesLexai: z.number().optional(),
        includesRecommendations: z.number().optional(),
        includesSupport: z.number().optional(),
        includesPdf: z.number().optional(),
        durationDays: z.number().optional(),
        isLifetime: z.number().optional(),
        isPublished: z.number().optional(),
        displayOrder: z.number().optional(),
        thumbnailUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updatePackage(id, data);
      }),

    // Admin: delete package
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deletePackage(input.id);
      }),

    // Admin: set courses for a package
    setCourses: adminProcedure
      .input(z.object({
        packageId: z.number(),
        courseIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.setPackageCourses(input.packageId, input.courseIds);
        return { success: true };
      }),
  }),

  // =============================================
  // ORDERS
  // =============================================
  orders: router({
    // User: create order (checkout)
    create: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          itemType: z.enum(['package']),
          packageId: z.number().optional(),
          courseId: z.number().optional(),
        })),
        paymentMethod: z.enum(['paypal', 'bank_transfer']),
        isGift: z.boolean().default(false),
        giftEmail: z.string().optional(),
        giftMessage: z.string().optional(),
        notes: z.string().optional(),
        couponCode: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

        // Calculate totals
        let subtotal = 0;
        const resolvedItems: Array<{ itemType: string; packageId?: number; courseId?: number; price: number }> = [];

        for (const item of input.items) {
          if (item.itemType === 'package' && item.packageId) {
            const pkg = await db.getPackageById(item.packageId);
            if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${item.packageId} not found` });
            subtotal += pkg.price;
            resolvedItems.push({ itemType: 'package', packageId: item.packageId, price: pkg.price });
          }
        }

        // Apply coupon discount
        let discountAmount = 0;
        let couponId: number | null = null;
        if (input.couponCode) {
          const coupon = await db.getCouponByCode(input.couponCode);
          if (coupon) {
            const packageId = resolvedItems[0]?.packageId;
            const validation = db.validateCoupon(coupon, subtotal, packageId);
            if (validation.valid) {
              discountAmount = db.calculateDiscount(coupon, subtotal);
              couponId = coupon.id;
            }
          }
        }

        const vatRate = 16;
        const vatAmount = Math.round((subtotal - discountAmount) * vatRate / 100);
        const totalAmount = subtotal - discountAmount + vatAmount;

        // Create order
        const order = await db.createOrder({
          userId: ctx.user.id,
          status: 'pending',
          subtotal,
          discountAmount,
          vatRate,
          vatAmount,
          totalAmount,
          currency: 'USD',
          paymentMethod: input.paymentMethod,
          isGift: input.isGift ? 1 : 0,
          giftEmail: input.giftEmail || null,
          giftMessage: input.giftMessage || null,
          notes: input.notes || null,
        });

        if (!order) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create order' });

        // Increment coupon usage
        if (couponId) {
          db.incrementCouponUsage(couponId).catch(() => {});
        }

        // Add order items
        let packageName = 'Package';
        for (const item of resolvedItems) {
          await db.addOrderItem({
            orderId: order.id,
            itemType: item.itemType,
            packageId: item.packageId || null,
            courseId: item.courseId || null,
            priceAtPurchase: item.price,
            currency: 'USD',
          });
          if (item.packageId) {
            const pkg = await db.getPackageById(item.packageId);
            if (pkg) packageName = pkg.titleEn || pkg.titleAr || 'Package';
          }
        }

        // Send email notifications (non-blocking)
        const totalUsd = totalAmount / 100;
        sendOrderConfirmationEmail(ctx.user.email, {
          orderId: order.id, packageName, totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});
        sendAdminNewOrderNotification({
          orderId: order.id, userEmail: ctx.user.email, packageName, totalUsd, paymentMethod: input.paymentMethod,
        }).catch(() => {});

        return order;
      }),

    // User: get my orders
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getUserOrders(ctx.user.id);
    }),

    // User: get order details
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const order = await db.getOrderById(input.id);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        // Only allow order owner or admin to see the order
        if (order.userId !== ctx.user.id) {
          const admin = ctx.user.email ? await db.getAdminByEmail(ctx.user.email) : null;
          if (!admin) throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    // User: upload payment proof (bank transfer)
    uploadProof: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        paymentProofUrl: z.string(),
        paymentReference: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        return db.updateOrderStatus(input.orderId, 'awaiting_confirmation', {
          paymentProofUrl: input.paymentProofUrl,
          paymentReference: input.paymentReference,
        });
      }),

    // Admin: list all orders
    adminList: adminProcedure
      .input(z.object({
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllOrders(input?.status);
      }),

    // Admin: update order status (approve/reject bank transfer, mark as paid from PayPal)
    adminUpdateStatus: adminProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(['pending', 'awaiting_confirmation', 'paid', 'completed', 'cancelled', 'refunded']),
        paymentReference: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

        const updated = await db.updateOrderStatus(input.orderId, input.status, {
          paymentReference: input.paymentReference,
        });

        // If status changed to 'completed', activate package subscriptions
        if (input.status === 'completed' && updated) {
          const items = await db.getOrderItems(input.orderId);
          let packageName = 'Package';
          for (const item of items) {
            if (item.itemType === 'package' && item.packageId) {
              const pkg = await db.getPackageById(item.packageId);
              if (pkg) packageName = pkg.titleEn || pkg.titleAr || 'Package';
              const targetUserId = order.isGift && order.giftEmail
                ? (await db.getUserByEmail(order.giftEmail))?.id
                : order.userId;

              if (targetUserId) {
                // Use fulfillPackageEntitlements which grants courses + LexAI + Recommendations
                await db.fulfillPackageEntitlements(targetUserId, item.packageId);
              }
            }
          }

          // Send subscription activated email (non-blocking)
          const userEmail = order.isGift && order.giftEmail ? order.giftEmail : (await db.getUserById(order.userId))?.email;
          if (userEmail) {
            sendPaymentReceivedEmail(userEmail, { orderId: order.id, packageName }).catch(() => {});
          }
        }

        return updated;
      }),
  }),

  // =============================================
  // PACKAGE SUBSCRIPTIONS
  // =============================================
  subscriptions: router({
    // User: get my active subscriptions
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getUserPackageSubscriptions(ctx.user.id);
    }),

    // User: get active package (most recent active)
    myActivePackage: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return db.getUserActivePackage(ctx.user.id);
    }),

    // Admin: list all subscriptions
    adminList: adminProcedure.query(async () => {
      return db.getAllPackageSubscriptions();
    }),
  }),

  // =============================================
  // EVENTS (public + admin)
  // =============================================
  events: router({
    // Public: list published events
    list: publicProcedure.query(async () => {
      return db.getAllEvents(true);
    }),

    // Public: get single event
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const event = await db.getEventById(input.id);
        if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
        return event;
      }),

    // Admin: list all events
    adminList: adminProcedure.query(async () => {
      return db.getAllEvents(false);
    }),

    // Admin: create event
    create: adminProcedure
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        eventType: z.enum(['live', 'competition', 'discount', 'webinar']).default('live'),
        eventDate: z.string(),
        eventEndDate: z.string().optional(),
        imageUrl: z.string().optional(),
        linkUrl: z.string().optional(),
        isPublished: z.number().min(0).max(1).default(0),
      }))
      .mutation(async ({ input }) => {
        return db.createEvent(input);
      }),

    // Admin: update event
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        eventType: z.string().optional(),
        eventDate: z.string().optional(),
        eventEndDate: z.string().optional(),
        imageUrl: z.string().optional(),
        linkUrl: z.string().optional(),
        isPublished: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateEvent(id, data);
      }),

    // Admin: delete event
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteEvent(input.id);
      }),
  }),

  // =============================================
  // ADMIN QUIZ MANAGEMENT
  // =============================================
  adminQuiz: router({
    // List all quizzes (admin)
    list: adminProcedure.query(async () => {
      return db.getAllQuizzes();
    }),

    // Get quiz with questions + options
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuizWithQuestionsAndOptions(input.id);
      }),

    // Get quiz stats
    stats: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuizStats(input.id);
      }),

    // Create quiz
    create: adminProcedure
      .input(z.object({
        level: z.number().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        passingScore: z.number().min(1).max(100).default(50),
      }))
      .mutation(async ({ input }) => {
        return db.createQuiz(input);
      }),

    // Update quiz
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        passingScore: z.number().min(1).max(100).optional(),
        level: z.number().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuiz(id, data);
      }),

    // Delete quiz
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuiz(input.id);
      }),

    // Create question
    createQuestion: adminProcedure
      .input(z.object({
        quizId: z.number(),
        questionText: z.string().min(1),
        orderNum: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        return db.createQuizQuestion(input);
      }),

    // Update question
    updateQuestion: adminProcedure
      .input(z.object({
        id: z.number(),
        questionText: z.string().optional(),
        orderNum: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuizQuestion(id, data);
      }),

    // Delete question
    deleteQuestion: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuizQuestion(input.id);
      }),

    // Create option
    createOption: adminProcedure
      .input(z.object({
        questionId: z.number(),
        optionId: z.string().length(1),
        optionText: z.string().min(1),
        isCorrect: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return db.createQuizOption(input);
      }),

    // Update option
    updateOption: adminProcedure
      .input(z.object({
        id: z.number(),
        optionText: z.string().optional(),
        isCorrect: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateQuizOption(id, data);
      }),

    // Delete option
    deleteOption: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuizOption(input.id);
      }),
  }),

  // =============================================
  // ARTICLES (public + admin)
  // =============================================
  // ====== Coupons / Discount Codes ======
  coupons: router({
    // Public: validate a coupon code
    validate: publicProcedure
      .input(z.object({ code: z.string().min(1), subtotal: z.number(), packageId: z.number().optional() }))
      .query(async ({ input }) => {
        const coupon = await db.getCouponByCode(input.code);
        if (!coupon) throw new TRPCError({ code: 'NOT_FOUND', message: 'Coupon not found' });
        const result = db.validateCoupon(coupon, input.subtotal, input.packageId);
        if (!result.valid) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || 'Invalid coupon' });
        const discount = db.calculateDiscount(coupon, input.subtotal);
        return { couponId: coupon.id, code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, discount };
      }),

    // Admin: list all coupons
    adminList: adminProcedure.query(async () => {
      return db.getAllCoupons();
    }),

    // Admin: create coupon
    create: adminProcedure
      .input(z.object({
        code: z.string().min(1),
        discountType: z.enum(['percentage', 'fixed']),
        discountValue: z.number().min(1),
        maxUses: z.number().optional(),
        minOrderAmount: z.number().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
        isActive: z.boolean().default(true),
        packageId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createCoupon({ ...input, usedCount: 0 });
      }),

    // Admin: update coupon
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().optional(),
        maxUses: z.number().nullable().optional(),
        minOrderAmount: z.number().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validUntil: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        packageId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCoupon(id, data);
      }),

    // Admin: delete coupon
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteCoupon(input.id);
      }),
  }),

  // ====== Testimonials ======
  testimonials: router({
    // Public: published testimonials
    list: publicProcedure.query(async () => {
      return db.getAllTestimonials(true);
    }),

    // Admin: all testimonials
    adminList: adminProcedure.query(async () => {
      return db.getAllTestimonials(false);
    }),

    // Admin: create testimonial
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        textEn: z.string().min(1),
        textAr: z.string().min(1),
        avatarUrl: z.string().optional(),
        rating: z.number().min(1).max(5).default(5),
        displayOrder: z.number().default(0),
        isPublished: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        return db.createTestimonial(input);
      }),

    // Admin: update testimonial
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        textEn: z.string().optional(),
        textAr: z.string().optional(),
        avatarUrl: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        displayOrder: z.number().optional(),
        isPublished: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateTestimonial(id, data);
      }),

    // Admin: delete testimonial
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteTestimonial(input.id);
      }),
  }),

  articles: router({
    // Public: list published articles
    list: publicProcedure.query(async () => {
      return db.getAllArticles(true);
    }),

    // Public: get article by slug
    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const article = await db.getArticleBySlug(input.slug);
        if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
        return article;
      }),

    // Public: get article by id
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const article = await db.getArticleById(input.id);
        if (!article) throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' });
        return article;
      }),

    // Admin: list all articles
    adminList: adminProcedure.query(async () => {
      return db.getAllArticles(false);
    }),

    // Admin: create article
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptAr: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        authorId: z.number().optional(),
        isPublished: z.number().min(0).max(1).default(0),
        publishedAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArticle(input);
      }),

    // Admin: update article
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        excerptEn: z.string().optional(),
        excerptAr: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        authorId: z.number().optional(),
        isPublished: z.number().optional(),
        publishedAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateArticle(id, data);
      }),

    // Admin: delete article
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteArticle(input.id);
      }),
  }),

  // ============================================================================
  // Package Keys (consolidated key system — admin + key_manager role)
  // ============================================================================
  packageKeys: router({
    list: adminOrRoleProcedure(['key_manager']).query(async () => {
      const keys = await db.getAllPackageKeys();
      // Enrich with package info
      const allPackages = await db.getAllPackages();
      const pkgMap = new Map(allPackages.map(p => [p.id, p]));
      return keys.map(k => ({
        ...k,
        packageName: k.packageId ? (pkgMap.get(k.packageId)?.nameEn || pkgMap.get(k.packageId)?.nameAr || 'Unknown') : null,
        packageNameAr: k.packageId ? (pkgMap.get(k.packageId)?.nameAr || null) : null,
        isUpgrade: k.isUpgrade ?? false,
        referredBy: k.referredBy ?? null,
      }));
    }),

    stats: adminOrRoleProcedure(['key_manager']).query(async () => {
      return db.getPackageKeyStatistics();
    }),

    generateKey: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        packageId: z.number(),
        email: z.string().email().optional(),
        notes: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        expiresAt: z.string().optional(),
        isUpgrade: z.boolean().optional(),
        referredBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const admin = ctx.admin ?? ctx.user;
        const result = await db.createPackageKey({
          packageId: input.packageId,
          createdBy: admin?.id ?? 0,
          email: input.email,
          notes: input.notes,
          price: input.price,
          currency: input.currency,
          expiresAt: input.expiresAt,
          isUpgrade: input.isUpgrade,
          referredBy: input.referredBy,
        });
        return result;
      }),

    generateBulkKeys: adminOrRoleProcedure(['key_manager'])
      .input(z.object({
        packageId: z.number(),
        quantity: z.number().min(1).max(100),
        notes: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        expiresAt: z.string().optional(),
        isUpgrade: z.boolean().optional(),
        referredBy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const admin = ctx.admin ?? ctx.user;
        const keys = await db.createBulkPackageKeys({
          packageId: input.packageId,
          createdBy: admin?.id ?? 0,
          quantity: input.quantity,
          notes: input.notes,
          price: input.price,
          currency: input.currency,
          expiresAt: input.expiresAt,
          isUpgrade: input.isUpgrade,
          referredBy: input.referredBy,
        });
        return { count: keys.length };
      }),

    deactivateKey: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deactivateRegistrationKey(input.id);
      }),

    // Public: get key info (used by activation page)
    getKeyInfo: publicProcedure
      .input(z.object({ keyCode: z.string() }))
      .query(async ({ input }) => {
        const key = await db.getRegistrationKeyByCode(input.keyCode);
        if (!key) return { exists: false, keyType: null };
        return {
          exists: true,
          isActive: key.isActive,
          activatedAt: key.activatedAt,
          keyType: key.packageId ? 'package' as const : (key.courseId > 0 ? 'course' as const : key.courseId === 0 ? 'lexai' as const : 'recommendation' as const),
          packageId: key.packageId,
        };
      }),

    // Public: activate a package key (requires email; will resolve user)
    activateKey: publicProcedure
      .input(z.object({
        keyCode: z.string().min(1),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        return db.activatePackageKey(input.keyCode, input.email);
      }),

    // Upgrade leaderboard: monthly stats by referrer
    upgradeStats: adminOrRoleProcedure(['key_manager'])
      .input(z.object({ month: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getUpgradeStatistics(input?.month);
      }),
  }),

  // ============================================================================
  // Admin Reports
  // ============================================================================
  reports: router({
    subscribers: adminProcedure.query(async () => {
      return db.getSubscribersReport();
    }),
    revenue: adminProcedure.query(async () => {
      return db.getRevenueReport();
    }),
    expirations: adminProcedure.query(async () => {
      return db.getSubscriptionExpiryReport();
    }),
  }),
});

export type AppRouter = typeof appRouter;