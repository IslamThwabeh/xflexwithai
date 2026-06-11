import type { D1Database, ExecutionContext, KVNamespace, R2Bucket, ScheduledController } from "@cloudflare/workers-types";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../routers";
import { createWorkerContext } from "./context-worker";
import * as db from "../db";
import { verifyFreeVideoPlaybackToken } from "./freeLibraryPlayback";
import { sendFreezeExpiredEmail, sendExpiryAlertEmail, sendDripEmail, sendMilestoneEmail, sendInactivityEmail, sendOnboardingStalledEmail } from "./orderEmails";
import { sendEmail } from "./email";
import { logger } from "./logger";
import { getFreeLibraryDocumentBySlug, getFreeLibraryVideoBySlug } from "../../shared/freeLibrary";

function appendCookieHeaders(headers: Headers, cookieHeaders: string[] | undefined) {
  if (!cookieHeaders?.length) return;
  for (const cookie of cookieHeaders) {
    headers.append("Set-Cookie", cookie);
  }
}

function jsonResponse(status: number, payload: unknown, headers?: Headers) {
  const responseHeaders = headers ?? new Headers();
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function buildContentDisposition(type: "inline" | "attachment", fileName: string) {
  const asciiFallback = fileName.replace(/[\\/\r\n\"]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function parseRangeHeader(rangeHeader: string, totalSize: number) {
  if (!rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const requestedRange = rangeHeader.slice(6).split(",")[0]?.trim();
  if (!requestedRange) {
    return null;
  }

  const [startText, endText] = requestedRange.split("-");
  let start = 0;
  let end = totalSize - 1;

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const length = Math.min(suffixLength, totalSize);
    start = totalSize - length;
  } else {
    start = Number(startText);
    if (!Number.isFinite(start) || start < 0) {
      return null;
    }

    if (endText) {
      end = Number(endText);
      if (!Number.isFinite(end)) {
        return null;
      }
    }
  }

  if (start >= totalSize || start > end) {
    return null;
  }

  end = Math.min(end, totalSize - 1);
  return { start, end };
}

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

      let normalizedOrigin = "";
      let originHost = "";
      if (origin) {
        try {
          const parsedOrigin = new URL(origin);
          normalizedOrigin = parsedOrigin.origin;
          originHost = parsedOrigin.hostname.toLowerCase();
        } catch {
          normalizedOrigin = "";
          originHost = "";
        }
      }

      const isAllowedOrigin =
        !!normalizedOrigin && (
          allowedOrigins.has(normalizedOrigin) ||
          originHost.endsWith(".xflexwithai.pages.dev") ||
          originHost.endsWith(".xflexacademy.pages.dev")
        );

      const corsHeaders = new Headers();
      if (isAllowedOrigin) {
        corsHeaders.set("Access-Control-Allow-Origin", normalizedOrigin);
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

      const freeLibraryDocumentMatch = pathname.match(/^\/api\/free-library\/documents\/([^/]+)\/(view|download)$/);
      if (freeLibraryDocumentMatch) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(405, { status: "method_not_allowed" });
        }

        const headers = new Headers();
        corsHeaders.forEach((value, key) => {
          headers.set(key, value);
        });

        const slug = decodeURIComponent(freeLibraryDocumentMatch[1]);
        const action = freeLibraryDocumentMatch[2] as "view" | "download";
        const document = getFreeLibraryDocumentBySlug(slug);

        if (!document) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Free-library document not found",
          }, headers);
        }

        const object = await env.VIDEOS_BUCKET.get(document.objectKey);
        if (!object) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Document file is missing from storage",
          }, headers);
        }

        headers.set("Content-Type", "application/pdf");
        headers.set("Content-Disposition", buildContentDisposition(action === "view" ? "inline" : "attachment", document.originalFileName));
        headers.set("Cache-Control", "public, max-age=3600");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");

        const contentLength = document.fileSizeBytes ?? (typeof object.size === "number" ? object.size : null);
        if (contentLength) {
          headers.set("Content-Length", String(contentLength));
        }

        if (request.method === "HEAD") {
          return new Response(null, { status: 200, headers });
        }

        return new Response(object.body, { status: 200, headers });
      }

      const freeLibraryVideoMatch = pathname.match(/^\/api\/free-library\/videos\/([^/]+)\/stream$/);
      if (freeLibraryVideoMatch) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(405, { status: "method_not_allowed" });
        }

        const headers = new Headers();
        corsHeaders.forEach((value, key) => {
          headers.set(key, value);
        });

        const slug = decodeURIComponent(freeLibraryVideoMatch[1]);
        const token = url.searchParams.get("token") ?? "";
        const isTokenValid = token ? await verifyFreeVideoPlaybackToken(token, slug) : false;

        if (!isTokenValid) {
          return jsonResponse(401, {
            status: "unauthorized",
            message: "A valid playback token is required",
          }, headers);
        }

        const video = getFreeLibraryVideoBySlug(slug);
        if (!video) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Free-library video not found",
          }, headers);
        }

        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Type", "video/mp4");
        headers.set("Content-Disposition", buildContentDisposition("inline", video.originalFileName));
        headers.set("Cache-Control", "private, no-store, max-age=0");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");

        const rangeHeader = request.headers.get("range");
        const totalSize = video.fileSizeBytes;

        if (rangeHeader && totalSize > 0) {
          const range = parseRangeHeader(rangeHeader, totalSize);
          if (!range) {
            headers.set("Content-Range", `bytes */${totalSize}`);
            return new Response(null, { status: 416, headers });
          }

          const length = range.end - range.start + 1;
          const object = await env.VIDEOS_BUCKET.get(video.objectKey, {
            range: { offset: range.start, length },
          } as any);

          if (!object) {
            return jsonResponse(404, {
              status: "not_found",
              message: "Video file is missing from storage",
            }, headers);
          }

          headers.set("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
          headers.set("Content-Length", String(length));

          if (request.method === "HEAD") {
            return new Response(null, { status: 206, headers });
          }

          if (!("body" in object) || !object.body) {
            return jsonResponse(404, {
              status: "not_found",
              message: "Video file is missing from storage",
            }, headers);
          }
          return new Response(object.body, { status: 206, headers });
        }

        const object = await env.VIDEOS_BUCKET.get(video.objectKey);
        if (!object) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Video file is missing from storage",
          }, headers);
        }

        const contentLength = typeof object.size === "number" ? object.size : totalSize;
        if (contentLength > 0) {
          headers.set("Content-Length", String(contentLength));
        }

        if (request.method === "HEAD") {
          return new Response(null, { status: 200, headers });
        }

        return new Response(object.body, { status: 200, headers });
      }

      const studentDocumentMatch = pathname.match(/^\/api\/student-documents\/(\d+)\/(view|download)$/);
      if (studentDocumentMatch) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(405, { status: "method_not_allowed" });
        }

        const authContext = await createWorkerContext({ req: request, env });
        const headers = new Headers();
        const cookieHeaders = (authContext as { cookieHeaders?: string[] }).cookieHeaders;

        corsHeaders.forEach((value, key) => {
          headers.set(key, value);
        });
        appendCookieHeaders(headers, cookieHeaders);

        if (!authContext.user || authContext.user.id <= 0) {
          return jsonResponse(401, {
            status: "unauthorized",
            message: "Please login to access student documents",
          }, headers);
        }

        const activePackage = await db.getUserActivePackage(authContext.user.id);
        if (!activePackage) {
          return jsonResponse(403, {
            status: "forbidden",
            message: "An activated package is required to access student documents",
          }, headers);
        }

        const documentId = Number(studentDocumentMatch[1]);
        const action = studentDocumentMatch[2] as "view" | "download";
        const document = await db.getPublishedStudentDocumentById(documentId);

        if (!document) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Student document not found",
          }, headers);
        }

        if (action === "view" && (document.isBulkArchive || document.mimeType !== "application/pdf")) {
          return jsonResponse(400, {
            status: "invalid_request",
            message: "This document can only be downloaded",
          }, headers);
        }

        const object = await env.VIDEOS_BUCKET.get(document.objectKey);
        if (!object) {
          return jsonResponse(404, {
            status: "not_found",
            message: "Document file is missing from storage",
          }, headers);
        }

        headers.set("Content-Type", document.mimeType || "application/octet-stream");
        headers.set(
          "Content-Disposition",
          buildContentDisposition(action === "view" ? "inline" : "attachment", document.originalFileName),
        );
        headers.set("Cache-Control", "private, no-store");
        headers.set("X-Content-Type-Options", "nosniff");

        if (document.fileSizeBytes) {
          headers.set("Content-Length", String(document.fileSizeBytes));
        } else if (typeof object.size === "number") {
          headers.set("Content-Length", String(object.size));
        }

        if (request.method === "HEAD") {
          return new Response(null, { status: 200, headers });
        }

        return new Response(object.body, { status: 200, headers });
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

    // Send timed-service renewal reminders (pre-expiry, day-of, and bounded recovery).
    const renewalReminderOffsets = [14, 7, 3, 1, 0, -3, -10];
    const renewalReminderCandidates = await db.getRenewalReminderCandidates(renewalReminderOffsets);
    for (const sub of renewalReminderCandidates) {
      const emailType = `subscription_expiry_${sub.serviceType}_${sub.stage}_${sub.endDate.slice(0, 10)}`;
      const alreadySent = await db.hasEmailBeenSent(sub.userId, emailType);
      if (alreadySent) {
        await db.logEmailDeliveryAttempt({
          recipientEmail: sub.email,
          recipientUserId: sub.userId,
          eventType: 'subscription_expiry_alert',
          templateId: 'subscription_expiry_alert',
          subject: `[deduped] ${sub.serviceName} renewal reminder ${sub.stage}`,
          status: 'skipped_deduped',
          metadata: {
            emailType,
            serviceType: sub.serviceType,
            stage: sub.stage,
            endDate: sub.endDate,
          },
        }).catch(() => {});
        continue;
      }

      await sendExpiryAlertEmail(sub.email, sub.name, sub.daysLeft, sub.packageName, sub.serviceName, sub.language);
      await db.logEmailSent(sub.userId, emailType, {
        serviceType: sub.serviceType,
        stage: sub.stage,
        endDate: sub.endDate,
      });

      const displayName = sub.name || sub.email;
      const isExpired = sub.daysLeft < 0;
      const absDays = Math.abs(sub.daysLeft);
      await db.notifyStaffByEvent('subscription_expiring', {
        titleEn: isExpired
          ? `${sub.serviceName} expired ${absDays} day(s) ago – ${displayName}`
          : sub.daysLeft === 0
            ? `${sub.serviceName} expires today – ${displayName}`
            : `${sub.serviceName} expires in ${sub.daysLeft} days – ${displayName}`,
        titleAr: isExpired
          ? `انتهت خدمة ${sub.serviceName} منذ ${absDays} يوم – ${displayName}`
          : sub.daysLeft === 0
            ? `تنتهي خدمة ${sub.serviceName} اليوم – ${displayName}`
            : `تنتهي خدمة ${sub.serviceName} خلال ${sub.daysLeft} أيام – ${displayName}`,
        contentEn: isExpired
          ? `${displayName}'s ${sub.serviceName} access has expired. A renewal key is needed to restore timed-service access.`
          : `${displayName}'s ${sub.serviceName} access expires in ${sub.daysLeft} day(s).`,
        contentAr: isExpired
          ? `انتهى وصول ${displayName} إلى ${sub.serviceName}. يحتاج إلى مفتاح تجديد لاستعادة الخدمة.`
          : `وصول ${displayName} إلى ${sub.serviceName} ينتهي خلال ${sub.daysLeft} يوم.`,
        metadata: {
          userId: sub.userId,
          packageName: sub.packageName,
          serviceType: sub.serviceType,
          daysLeft: sub.daysLeft,
          stage: sub.stage,
        },
      }).catch((e) => logger.error('[CRON] Staff notify (subscription_expiring) failed', e));

      await db.createNotification({
        userId: sub.userId,
        type: sub.daysLeft <= 0 ? 'warning' : 'info',
        titleAr: isExpired
          ? `انتهت خدمة ${sub.serviceName}`
          : sub.daysLeft === 0
            ? `تنتهي خدمة ${sub.serviceName} اليوم`
            : `خدمة ${sub.serviceName} تنتهي خلال ${sub.daysLeft} أيام`,
        titleEn: isExpired
          ? `${sub.serviceName} Has Expired`
          : sub.daysLeft === 0
            ? `${sub.serviceName} Expires Today`
            : `${sub.serviceName} Expires in ${sub.daysLeft} Days`,
        contentAr: isExpired
          ? 'محتوى الدورة ما زال متاحاً لك، لكن هذه الخدمة المحددة المدة تحتاج إلى مفتاح تجديد جديد.'
          : 'محتوى الدورة سيبقى متاحاً لك، لكن هذه الخدمة المحددة المدة تنتهي قريباً. جهّز مفتاح التجديد لتجنب الانقطاع.',
        contentEn: isExpired
          ? 'Your course content is still available, but this timed service needs a new renewal key.'
          : 'Your course content will remain available, but this timed service expires soon. Prepare your renewal key to avoid interruption.',
        actionUrl: '/my-packages?focus=renewal',
      }).catch((error) => logger.error('[CRON] Student notification (subscription_expiring) failed', {
        userId: sub.userId,
        packageName: sub.packageName,
        serviceType: sub.serviceType,
        daysLeft: sub.daysLeft,
        error: error instanceof Error ? error.message : String(error),
      }));
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
        }).catch((e) => logger.error('[CRON] Staff notify (lexai_expiry_soon) failed', e));
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
        logger.error(`[CRON] Drip day ${day} failed`, { error: e instanceof Error ? e.message : String(e) });
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
        logger.error(`[CRON] Milestone ${milestone} failed`, { error: e instanceof Error ? e.message : String(e) });
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
        logger.error(`[CRON] Inactivity ${days}d failed`, { error: e instanceof Error ? e.message : String(e) });
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
      logger.error("[CRON] Onboarding stalled check failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // --- Auto-close stale support conversations (3 days inactivity) ---
    try {
      const closed = await db.autoCloseStaleConversations(3);
      if (closed > 0) {
        logger.info(`[CRON] Auto-closed ${closed} stale support conversation(s)`);
      }
    } catch (e) {
      logger.error("[CRON] Auto-close stale conversations failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // --- Recommendation subscriber repair (moved off the hot send path) ---
    try {
      await db.runRecommendationSubscriberRepair();
    } catch (e) {
      logger.error("[CRON] Recommendation subscriber repair failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // --- Recommendation delivery retry/drain ---
    // Re-send pending/failed deliveries (capped attempts; dead-letter on the
    // final failure). The stored subject/body lets us resend without
    // recomputing template state.
    try {
      const drainBatch = await db.listPendingRecommendationDeliveriesForRetry(50);
      for (const row of drainBatch) {
        if (!row.subject || !row.bodyText) {
          // Legacy row without rendered body — skip; cannot rebuild safely.
          continue;
        }
        try {
          const result = await sendEmail({
            to: row.recipientEmail,
            subject: row.subject,
            text: row.bodyText,
            html: row.bodyHtml ?? undefined,
            audit: {
              eventType: row.eventKind === 'alert' ? 'recommendation_alert' : `recommendation_${row.eventKind}`,
              templateId: row.eventKind === 'alert' ? 'recommendation_alert' : `recommendation_${row.eventKind}`,
              recipientUserId: row.userId,
              metadata: { retry: true, eventKey: row.eventKey, refId: row.refId },
            },
          });
          await db.markRecommendationDeliverySent({
            eventKey: row.eventKey,
            userId: row.userId,
            provider: result?.provider ?? null,
            attemptedProviders: result?.attemptedProviders,
          });
        } catch (err) {
          const category = (err as { category?: string })?.category ?? 'unknown';
          const attempted = (err as { attemptedProviders?: string[] })?.attemptedProviders;
          await db.markRecommendationDeliveryFailed({
            eventKey: row.eventKey,
            userId: row.userId,
            errorCategory: category,
            errorMessage: err instanceof Error ? err.message : String(err),
            attemptedProviders: attempted,
          });
        }
      }
    } catch (e) {
      logger.error("[CRON] Recommendation delivery drain failed", { error: e instanceof Error ? e.message : String(e) });
    }

    // --- Recommendation delivery anomaly check (rolling 24h) ---
    try {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const stats = await db.getRecommendationDeliveryStats(sinceIso);
      const attempted = stats.sent + stats.failed + stats.deadLetter;
      const failureRatio = attempted > 0 ? (stats.failed + stats.deadLetter) / attempted : 0;
      if (stats.deadLetter > 0 || failureRatio > 0.05) {
        await db.notifyStaffByEvent('recommendation_delivery_anomaly', {
          titleEn: `Recommendation delivery anomaly (${stats.deadLetter} dead-lettered)`,
          titleAr: `شذوذ في توصيل التوصيات (${stats.deadLetter} رسائل فشلت نهائياً)`,
          contentEn: `Last 24h: ${stats.sent} sent, ${stats.failed} failed, ${stats.deadLetter} dead-lettered, ${stats.pending} still pending, ${stats.skipped} skipped.`,
          contentAr: `آخر 24 ساعة: ${stats.sent} مرسلة، ${stats.failed} فاشلة، ${stats.deadLetter} فاشلة نهائياً، ${stats.pending} معلقة، ${stats.skipped} متخطّاة.`,
          metadata: {
            sent: stats.sent,
            failed: stats.failed,
            deadLetter: stats.deadLetter,
            pending: stats.pending,
            skipped: stats.skipped,
            failureRatio: Number(failureRatio.toFixed(3)),
          },
        }).catch((e) => logger.error('[CRON] Staff notify (recommendation_delivery_anomaly) failed', e));
      }
    } catch (e) {
      logger.error("[CRON] Recommendation delivery anomaly check failed", { error: e instanceof Error ? e.message : String(e) });
    }
  },
};
