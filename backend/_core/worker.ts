import type { D1Database, ExecutionContext, KVNamespace, R2Bucket, ScheduledController } from "@cloudflare/workers-types";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../routers";
import { createWorkerContext } from "./context-worker";
import * as db from "../db";
import { sendFreezeExpiredEmail, sendExpiryAlertEmail, sendDripEmail, sendMilestoneEmail, sendInactivityEmail, sendOnboardingStalledEmail } from "./orderEmails";
import { logger } from "./logger";

export interface Env {
  DB: D1Database;
  VIDEOS_BUCKET: R2Bucket;
  KV_CACHE?: KVNamespace;
  JWT_SECRET: string;
  OPENAI_API_KEY: string;
  R2_PUBLIC_URL?: string;
  VITE_APP_TITLE: string;
  VITE_APP_LOGO: string;
  ENVIRONMENT: "production" | "staging" | "development";

  // Email / OTP
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  RESEND_API_KEY?: string;
  ZEPTOMAIL_TOKEN?: string;
  ZEPTOMAIL_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const origin = request.headers.get("origin") || "";
      (globalThis as { ENV?: Env }).ENV = env;
      const allowedOrigins = new Set([
        "https://xflexacademy.com",
        "https://www.xflexacademy.com",
        "https://xflexwithai.com",
        "https://www.xflexwithai.com",
        "https://xflex-careers.pages.dev",
        "https://eid-offer.pages.dev",
      ]);

      const corsHeaders = new Headers();
      if (allowedOrigins.has(origin)) {
        corsHeaders.set("Access-Control-Allow-Origin", origin);
        corsHeaders.set("Access-Control-Allow-Credentials", "true");
        corsHeaders.set("Vary", "Origin");
      }

      await db.getDb({ DB: env.DB });
      
      // Health check endpoint
      if (pathname === "/health") {
        return new Response(JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Test database endpoint
      if (pathname === "/api/test/db") {
        try {
          const db = env.DB;
          const result = await db.prepare("SELECT 1 as test").first();
          return new Response(JSON.stringify({ 
            status: "ok", 
            message: "Database connected",
            result 
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ 
            status: "error", 
            message: "Database error",
            error: error.message 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      if (pathname.startsWith("/api/trpc")) {
        if (request.method === "OPTIONS") {
          corsHeaders.set(
            "Access-Control-Allow-Headers",
            request.headers.get("access-control-request-headers") || "content-type"
          );
          corsHeaders.set(
            "Access-Control-Allow-Methods",
            request.headers.get("access-control-request-method") || "POST, GET, OPTIONS"
          );
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        return fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          allowBatching: true,
          allowMethodOverride: true,
          createContext: async () => createWorkerContext({ req: request, env }),
          responseMeta({ ctx }) {
            const headers = new Headers();
            const cookieHeaders = (ctx as any)?.cookieHeaders as string[] | undefined;

            corsHeaders.forEach((value, key) => {
              headers.set(key, value);
            });

            if (cookieHeaders?.length) {
              for (const cookie of cookieHeaders) {
                headers.append("Set-Cookie", cookie);
              }
            }

            return { headers };
          },
        });
      }

      if (pathname.startsWith("/api")) {
        return new Response(JSON.stringify({
          status: "not_found",
          message: "Endpoint not implemented in worker",
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Default response
      return new Response(JSON.stringify({
        status: "ok",
        message: "XFlex Trading Academy API Server",
        environment: env.ENVIRONMENT,
        endpoints: {
          health: "/health",
          database_test: "/api/test/db"
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        status: "error",
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    (globalThis as { ENV?: Env }).ENV = env;
    await db.getDb({ DB: env.DB });
    const unfrozen = await db.processExpiredFreezes();
    for (const user of unfrozen) {
      if (user.email) {
        await sendFreezeExpiredEmail(user.email, user.name);
      }
    }

    // Send package expiry alerts (7 days, 3 days, and day-of)
    const expiringWithin7 = await db.getExpiringSubscriptions(7);
    for (const sub of expiringWithin7) {
      // Send alerts at exactly 7, 3, and 0 days before expiry
      if (sub.daysLeft === 7 || sub.daysLeft === 3 || sub.daysLeft === 0) {
        await sendExpiryAlertEmail(sub.email, sub.name, sub.daysLeft, sub.packageName);
        // Staff alert for expiring subscriptions
        await db.notifyStaffByEvent('subscription_expiring', {
          titleEn: `Subscription expiring in ${sub.daysLeft} days – ${sub.name}`,
          titleAr: `اشتراك ينتهي خلال ${sub.daysLeft} أيام – ${sub.name}`,
          contentEn: `${sub.name}'s ${sub.packageName} expires in ${sub.daysLeft} day(s).`,
          contentAr: `اشتراك ${sub.name} في ${sub.packageName} ينتهي خلال ${sub.daysLeft} يوم.`,
          metadata: { userId: sub.userId, packageName: sub.packageName, daysLeft: sub.daysLeft },
        }).catch(() => {});
        // Dashboard notification for expiry warning
        await db.createNotification({
          userId: sub.userId,
          type: sub.daysLeft === 0 ? 'warning' : 'info',
          titleAr: sub.daysLeft === 0 ? 'انتهى اشتراكك اليوم' : `اشتراكك ينتهي خلال ${sub.daysLeft} أيام`,
          titleEn: sub.daysLeft === 0 ? 'Your Subscription Expires Today' : `Subscription Expires in ${sub.daysLeft} Days`,
          contentAr: sub.daysLeft === 0
            ? 'يرجى تجديد اشتراكك للحفاظ على وصولك.'
            : `اشتراكك ينتهي قريباً. جدّد الآن لتجنب الانقطاع.`,
          contentEn: sub.daysLeft === 0
            ? 'Please renew to keep your access.'
            : `Your ${sub.packageName} expires soon. Renew now to avoid interruption.`,
          actionUrl: '/my-packages',
        }).catch(() => {});
      }
    }

    // Send LexAI-specific staff alerts (7 days, 3 days, and day-of)
    const expiringLexaiWithin7 = await db.getExpiringLexaiSubscriptions(7);
    for (const sub of expiringLexaiWithin7) {
      if (sub.daysLeft === 7 || sub.daysLeft === 3 || sub.daysLeft === 0) {
        const displayName = sub.name || sub.email;
        await db.flagLexaiSupportCaseExpiry(sub.userId, sub.daysLeft);
        await db.notifyStaffByEvent('lexai_expiry_soon', {
          titleEn: sub.daysLeft === 0
            ? `LexAI expires today – ${displayName}`
            : `LexAI expires in ${sub.daysLeft} days – ${displayName}`,
          titleAr: sub.daysLeft === 0
            ? `ينتهي وصول LexAI اليوم – ${displayName}`
            : `ينتهي وصول LexAI خلال ${sub.daysLeft} أيام – ${displayName}`,
          contentEn: sub.daysLeft === 0
            ? `${displayName}'s LexAI access expires today. Review the LexAI queue for follow-up.`
            : `${displayName}'s LexAI access expires in ${sub.daysLeft} day(s). Review the LexAI queue for follow-up.`,
          contentAr: sub.daysLeft === 0
            ? `وصول LexAI للمستخدم ${displayName} ينتهي اليوم. راجع قائمة LexAI للمتابعة.`
            : `وصول LexAI للمستخدم ${displayName} ينتهي خلال ${sub.daysLeft} يوم. راجع قائمة LexAI للمتابعة.`,
          metadata: { userId: sub.userId, daysLeft: sub.daysLeft, endDate: sub.endDate },
        }).catch(() => {});
      }
    }

    // --- Drip emails (day 5, 10, 20, 30 after activation) ---
    for (const day of [5, 10, 20, 30]) {
      try {
        const users = await db.getUsersForDripEmail(day);
        for (const u of users) {
          await sendDripEmail(u.email, day, { name: u.name, packageName: u.packageName, packageNameAr: u.packageNameAr });
          await db.logEmailSent(u.userId, `drip_day_${day}`);
        }
      } catch (e) {
        logger.error(`[CRON] Drip day ${day} failed`, e);
      }
    }

    // --- Episode milestone emails (10, 14, 27, 39) ---
    for (const milestone of [10, 14, 27, 39]) {
      try {
        const users = await db.getUsersAtEpisodeMilestone(milestone);
        for (const u of users) {
          await sendMilestoneEmail(u.email, milestone, { name: u.name, completedCount: u.completedCount });
          await db.logEmailSent(u.userId, `milestone_${milestone}`);
        }
      } catch (e) {
        logger.error(`[CRON] Milestone ${milestone} failed`, e);
      }
    }

    // --- Inactivity emails (7 days, 14 days) ---
    for (const days of [7, 14]) {
      try {
        const users = await db.getInactiveUsers(days);
        for (const u of users) {
          await sendInactivityEmail(u.email, days, { name: u.name });
          await db.logEmailSent(u.userId, `inactivity_${days}`);
          // Staff alert for student inactivity
          db.notifyStaffByEvent('student_inactivity', {
            titleEn: `Student inactive for ${days} days – ${u.name}`,
            titleAr: `طالب غير نشط منذ ${days} أيام – ${u.name}`,
            contentEn: `${u.name} hasn't logged in for ${days} days.`,
            contentAr: `${u.name} لم يسجل دخولًا منذ ${days} أيام.`,
            metadata: { userId: (u as any).userId ?? null, name: u.name, inactiveDays: days },
          }).catch(() => {});
        }
      } catch (e) {
        logger.error(`[CRON] Inactivity ${days}d failed`, e);
      }
    }

    // --- Onboarding stalled (3+ days pending review) ---
    try {
      const stalled = await db.getStalledOnboardingUsers(3);
      for (const u of stalled) {
        await sendOnboardingStalledEmail(u.email, { name: u.name, step: u.step, daysPending: u.daysPending });
        await db.logEmailSent(u.userId, `onboarding_stalled_3`);
      }
    } catch (e) {
      logger.error("[CRON] Onboarding stalled check failed", e);
    }

    // --- Auto-close stale support conversations (3 days inactivity) ---
    try {
      const closed = await db.autoCloseStaleConversations(3);
      if (closed > 0) {
        logger.info(`[CRON] Auto-closed ${closed} stale support conversation(s)`);
      }
    } catch (e) {
      logger.error("[CRON] Auto-close stale conversations failed", e);
    }
  },
};
