import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";

// Admin-only procedure - checks if user is in admins table
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const admin = await db.getAdminByOpenId(ctx.user.openId);
  if (!admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx: { ...ctx, admin } });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // Check if current user is an admin
    isAdmin: protectedProcedure.query(async ({ ctx }) => {
      const admin = await db.getAdminByOpenId(ctx.user.openId);
      return { isAdmin: !!admin, admin };
    }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
      .mutation(async ({ input }) => {
        const courseId = await db.createCourse(input);
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
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateCourse(id, updates);
        return { success: true };
      }),

    // Admin: Delete course
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCourse(input.id);
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
        // Check if already enrolled
        const existing = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (existing) {
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
          lastAccessed: new Date(),
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
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
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
          lastAccessed: new Date(),
          completedAt: completedEpisodes >= totalEpisodes ? new Date() : null,
        });
        return { success: true };
      }),
  }),

  // User management (admin only)
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.id);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        return user;
      }),
  }),

  // File upload helper
  upload: router({
    // Generate upload URL for files
    getUploadUrl: adminProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Generate a unique key for the file
        const timestamp = Date.now();
        const fileKey = `uploads/${timestamp}-${input.filename}`;
        
        return {
          fileKey,
          uploadUrl: `/api/upload/${fileKey}`, // This would need to be implemented
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
