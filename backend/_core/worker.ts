import type { D1Database, ExecutionContext, KVNamespace, R2Bucket, ScheduledController } from "@cloudflare/workers-types";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../routers";
import { createWorkerContext } from "./context-worker";
import * as db from "../db";
import { verifyFreeVideoPlaybackToken } from "./freeLibraryPlayback";
import { sendFreezeExpiredEmail, sendExpiryAlertEmail, sendDripEmail, sendMilestoneEmail, sendInactivityEmail, sendOnboardingStalledEmail } from "./orderEmails";
import { logger } from "./logger";
import { getFreeLibraryDocumentBySlug, getFreeLibraryVideoBySlug } from "../../shared/freeLibrary";
import {
  buildSubscriptionExpiryDigestNotification,
  type SubscriptionExpiryDigestItem,
} from "./subscriptionExpiryDigest";
import {
  buildInactivityDigestNotification,
  type InactivityDigestItem,
} from "./inactivityDigest";
import {
  drainGenericEmailOutbox,
  drainStudentCommunityPostEmailOutbox,
  drainStudentSurveyEmailOutbox,
  GENERIC_EMAIL_OUTBOX_DRAIN_LIMIT,
  STUDENT_COMMUNITY_EMAIL_BCC_LIMIT,
  STUDENT_COMMUNITY_POST_EMAIL_EVENT,
  SUPPORT_REPLY_EMAIL_DRAIN_LIMIT,
} from "../services/email-outbox.service";
import {
  drainRecommendationDeliveryQueue,
  getRemainingGenericEmailBudget,
  RECOMMENDATION_DELIVERY_BATCH_SIZE,
  RECOMMENDATION_PROVIDER_BATCH_LIMIT,
} from "../services/recommendation-delivery.service";
import { handleZeptoMailWebhookRequest } from "./zeptoMailWebhook";
import { storageDeleteR2, storagePutR2 } from "../storage-r2";
import {
  PAYMENT_PROOF_MAX_BYTES,
  PaymentProofUploadError,
  processPaymentProofUpload,
} from "../services/payment-proof-upload.service";
import { checkScheduledEmailOutboxHealth } from "../services/email-outbox-health-monitor.service";
import { runPriorityDeliveryLanes } from "../services/worker-priority-delivery.service";
import { LIVE_PACKAGE_SLUG, parseLivePackageConfig } from "../services/live-package.service";

const MINUTE_DELIVERY_CRON = "* * * * *";
const TIMED_SERVICE_REPAIR_CRON = "*/5 * * * *";
const DAILY_MAINTENANCE_CRON = "0 5 * * *";

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

async function runFrequentEmailJobs() {
  // Recommendation and human-support delivery are the priority minute lanes.
  // Keep both ahead of surveys, campaigns, and maintenance so Workers Free CPU
  // exhaustion in lower-priority work cannot delay time-sensitive messages.
  const priorityDrain = await runPriorityDeliveryLanes({
    drainRecommendations: () => drainRecommendationDeliveryQueue({
      limit: RECOMMENDATION_DELIVERY_BATCH_SIZE,
      source: "scheduled",
    }),
    drainSupportReplies: () => drainGenericEmailOutbox({
      limit: SUPPORT_REPLY_EMAIL_DRAIN_LIMIT,
      eventTypes: ["support_client_reply"],
    }),
    recommendationFailureProviderRequests: RECOMMENDATION_PROVIDER_BATCH_LIMIT,
    onError: (lane, error) => logger.error(`[CRON] Priority ${lane} delivery failed`, {
      error: error instanceof Error ? error.message : String(error),
    }),
  });

  // Survey events are first materialized into the durable outbox. Existing
  // pre-Phase-1 assignments have no schedule and are never picked up here.
  let surveyProviderRequests = 0;
  try {
    await db.materializeDueStudentSurveyNotifications({ limit: 50 });
    const surveyBudget = Math.min(
      2,
      getRemainingGenericEmailBudget(priorityDrain.recommendationProviderRequests),
    );
    if (surveyBudget > 0) {
      const surveyDrain = await drainStudentSurveyEmailOutbox({ providerRequestLimit: surveyBudget });
      surveyProviderRequests = surveyDrain.providerRequests;
    }
  } catch (error) {
    logger.error("[CRON] Student survey notification jobs failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Community announcements are bulk awareness mail. Keep them behind live
  // recommendations and support replies, materialize at most one 50-client
  // BCC batch, and preserve the generic transactional capacity calculation.
  let communityProviderRequests = 0;
  try {
    const communityBudget = Math.min(
      2,
      getRemainingGenericEmailBudget(
        priorityDrain.recommendationProviderRequests + surveyProviderRequests,
      ),
    );
    if (communityBudget > 0) {
      await db.materializeEmailOutboxCampaigns(STUDENT_COMMUNITY_EMAIL_BCC_LIMIT, {
        eventTypes: [STUDENT_COMMUNITY_POST_EMAIL_EVENT],
        maxBatchSize: STUDENT_COMMUNITY_EMAIL_BCC_LIMIT,
      });
      const communityDrain = await drainStudentCommunityPostEmailOutbox({
        providerRequestLimit: communityBudget,
      });
      communityProviderRequests = communityDrain.providerRequests;
    }
  } catch (error) {
    logger.error("[CRON] Student community post email jobs failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const genericBudget = getRemainingGenericEmailBudget(
    priorityDrain.recommendationProviderRequests + surveyProviderRequests + communityProviderRequests,
  );
  const genericLimit = Math.min(GENERIC_EMAIL_OUTBOX_DRAIN_LIMIT, genericBudget);

  if (genericLimit > 0) {
    await db.materializeEmailOutboxCampaigns(genericLimit, {
      excludedEventTypes: [STUDENT_COMMUNITY_POST_EMAIL_EVENT],
    });
  }
  if (genericLimit > 0) {
    await drainGenericEmailOutbox({ limit: genericLimit });
  }

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
  ZEPTOMAIL_WEBHOOK_SECRET?: string;
  PACKAGE_LIVE_DEPLOYMENT_ENABLED?: string;
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
          normalizedOrigin === url.origin ||
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

      if (pathname === "/api/uploads/payment-proof") {
        const headers = new Headers();
        corsHeaders.forEach((value, key) => {
          headers.set(key, value);
        });

        if (request.method === "OPTIONS") {
          headers.set(
            "Access-Control-Allow-Headers",
            request.headers.get("access-control-request-headers") || "content-type"
          );
          headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
          return new Response(null, { status: 204, headers });
        }
        if (request.method !== "POST") {
          return jsonResponse(405, {
            status: "method_not_allowed",
            code: "method_not_allowed",
            message: "Use POST to upload a payment proof.",
          }, headers);
        }

        const authContext = await createWorkerContext({ req: request, env, executionCtx: ctx });
        const cookieHeaders = (authContext as { cookieHeaders?: string[] }).cookieHeaders;
        appendCookieHeaders(headers, cookieHeaders);
        if (!authContext.user || authContext.user.id <= 0) {
          return jsonResponse(401, {
            status: "unauthorized",
            code: "unauthorized",
            message: "Please login before uploading a payment proof.",
          }, headers);
        }

        const orderId = Number(url.searchParams.get("orderId"));
        if (!Number.isInteger(orderId) || orderId <= 0) {
          return jsonResponse(400, {
            status: "invalid_request",
            code: "invalid_order_id",
            message: "A valid order is required.",
          }, headers);
        }

        const declaredLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > PAYMENT_PROOF_MAX_BYTES) {
          return jsonResponse(413, {
            status: "invalid_request",
            code: "file_too_large",
            message: "Payment proof must be 10 MB or smaller.",
          }, headers);
        }

        try {
          const bytes = new Uint8Array(await request.arrayBuffer());
          const result = await processPaymentProofUpload({
            userId: authContext.user.id,
            orderId,
            bytes,
            declaredContentType: request.headers.get("content-type"),
            paymentReference: url.searchParams.get("reference"),
          }, {
            getOrder: db.getOrderById,
            putObject: (key, body, contentType) => storagePutR2(
              env.VIDEOS_BUCKET,
              key,
              body,
              contentType,
            ),
            submitOrderProof: db.submitOrderPaymentProof,
            deleteObject: async (key) => {
              await storageDeleteR2(env.VIDEOS_BUCKET, key);
              const remaining = await env.VIDEOS_BUCKET.head(key);
              if (remaining) {
                throw new Error(`R2 object still exists after delete: ${key}`);
              }
            },
            recordEvent: ({ eventType, orderId: eventOrderId, metadata }) => db.trackEngagement({
              userId: authContext.user!.id,
              eventType,
              entityType: "order",
              entityId: eventOrderId,
              metadata: JSON.stringify(metadata),
            }),
            recordStatusTransition: (transition) => db.logOrderStatusHistory({
              orderId: transition.orderId,
              userId: transition.userId,
              previousStatus: transition.previousStatus,
              newStatus: transition.newStatus,
              actorType: "user",
              actorId: transition.userId,
              reason: "Payment proof uploaded by order owner",
              ipAddress: request.headers.get("cf-connecting-ip"),
              createdAt: new Date().toISOString(),
            }),
          });

          logger.info("[PAYMENT PROOF] Upload completed", {
            userId: authContext.user.id,
            orderId,
            objectKey: result.key,
            sizeBytes: result.sizeBytes,
            contentType: result.contentType,
          });
          return jsonResponse(200, {
            status: "success",
            order: result.order,
            proof: {
              key: result.key,
              url: result.url,
              sizeBytes: result.sizeBytes,
              contentType: result.contentType,
            },
          }, headers);
        } catch (error) {
          const uploadError = error instanceof PaymentProofUploadError
            ? error
            : new PaymentProofUploadError(
                500,
                "upload_failed",
                "Payment proof upload failed. Please retry.",
              );
          logger.error("[PAYMENT PROOF] Upload rejected", {
            userId: authContext.user.id,
            orderId,
            code: uploadError.code,
            error: error instanceof Error ? error.message : String(error),
          });
          return jsonResponse(uploadError.status, {
            status: "error",
            code: uploadError.code,
            message: uploadError.message,
          }, headers);
        }
      }

      if (pathname === "/api/live-package-recordings/upload") {
        const headers = new Headers();
        corsHeaders.forEach((value, key) => headers.set(key, value));
        if (request.method === "OPTIONS") {
          headers.set("Access-Control-Allow-Headers", "content-type");
          headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
          return new Response(null, { status: 204, headers });
        }
        if (request.method !== "POST") return jsonResponse(405, { status: "method_not_allowed" }, headers);
        if (!isAllowedOrigin) return jsonResponse(403, { status: "forbidden", message: "A trusted same-origin request is required" }, headers);
        const authContext = await createWorkerContext({ req: request, env, executionCtx: ctx });
        appendCookieHeaders(headers, (authContext as { cookieHeaders?: string[] }).cookieHeaders);
        const admin = authContext.user?.email ? await db.getAdminByEmail(authContext.user.email) : null;
        if (!authContext.user || !admin) return jsonResponse(403, { status: "forbidden", message: "Full admin access is required" }, headers);
        const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
        if (contentType !== "video/mp4" && contentType !== "video/webm") {
          return jsonResponse(400, { status: "invalid_request", message: "Only MP4 or WebM recordings are accepted" }, headers);
        }
        const size = Number(request.headers.get("content-length"));
        if (!Number.isFinite(size) || size <= 0 || size > 500 * 1024 * 1024) {
          return jsonResponse(413, { status: "invalid_request", message: "Recording must declare a size between 1 byte and 500 MB" }, headers);
        }
        const titleEn = (url.searchParams.get("titleEn") ?? "").trim();
        const titleAr = (url.searchParams.get("titleAr") ?? "").trim();
        const originalFileName = (url.searchParams.get("fileName") ?? "recording").trim().slice(0, 255);
        const sessionIdValue = Number(url.searchParams.get("sessionId"));
        const sessionId = Number.isInteger(sessionIdValue) && sessionIdValue > 0 ? sessionIdValue : null;
        if (!titleEn || !titleAr || titleEn.length > 200 || titleAr.length > 200) {
          return jsonResponse(400, { status: "invalid_request", message: "Bilingual recording titles are required" }, headers);
        }
        const [pkg, settings] = await Promise.all([db.getPackageBySlug(LIVE_PACKAGE_SLUG), db.getAllAdminSettings()]);
        if (!pkg || pkg.packageType !== "live") return jsonResponse(409, { status: "not_ready", message: "Live package is not configured" }, headers);
        const config = parseLivePackageConfig(settings);
        const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const objectKey = `protected/live-package/${config.cohortKey}/${Date.now()}-${safeName}`;
        try {
          if (!request.body) throw new Error("Recording body is missing");
          await env.VIDEOS_BUCKET.put(objectKey, request.body, { httpMetadata: { contentType } });
          const recording = await db.createLivePackageRecording({
            packageId: pkg.id,
            cohortKey: config.cohortKey,
            sessionId,
            titleEn,
            titleAr,
            objectKey,
            originalFileName,
            mimeType: contentType,
            fileSizeBytes: size,
            adminId: admin.id,
          });
          await db.logAdminAction(admin.id, admin.id, "upload_live_package_recording", {
            recordingId: recording.id,
            sessionId,
            fileSizeBytes: size,
            mimeType: contentType,
          });
          return jsonResponse(200, { status: "success", recording: { id: recording.id, isPublished: false } }, headers);
        } catch (error) {
          await env.VIDEOS_BUCKET.delete(objectKey).catch(() => undefined);
          logger.error("[LIVE PACKAGE] Protected recording upload failed", { adminId: admin.id, error: error instanceof Error ? error.message : String(error) });
          return jsonResponse(500, { status: "error", message: "Recording upload failed" }, headers);
        }
      }

      if (pathname === "/api/webhooks/zeptomail") {
        return handleZeptoMailWebhookRequest(request, env.ZEPTOMAIL_WEBHOOK_SECRET ?? "");
      }
      
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
          createContext: async () => createWorkerContext({ req: request, env, executionCtx: ctx }),
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

      const liveRecordingMatch = pathname.match(/^\/api\/live-package-recordings\/(\d+)\/stream$/);
      if (liveRecordingMatch) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return jsonResponse(405, { status: "method_not_allowed" });
        }
        const authContext = await createWorkerContext({ req: request, env });
        const headers = new Headers();
        corsHeaders.forEach((value, key) => headers.set(key, value));
        appendCookieHeaders(headers, (authContext as { cookieHeaders?: string[] }).cookieHeaders);
        headers.set("Cache-Control", "private, no-store, max-age=0");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Robots-Tag", "noindex, noarchive, nosnippet");
        headers.set("Accept-Ranges", "bytes");
        if (!authContext.user || authContext.user.id <= 0) {
          return jsonResponse(401, { status: "unauthorized", message: "Please login to access this recording" }, headers);
        }
        const recording = await db.getLivePackageRecordingForUser(Number(liveRecordingMatch[1]), authContext.user.id);
        if (!recording) {
          return jsonResponse(404, { status: "not_found", message: "Recording not found" }, headers);
        }
        headers.set("Content-Type", recording.mimeType || "video/mp4");
        headers.set("Content-Disposition", buildContentDisposition("inline", recording.originalFileName));
        const rangeHeader = request.headers.get("range");
        const totalSize = Number(recording.fileSizeBytes ?? 0);
        if (rangeHeader && totalSize > 0) {
          const range = parseRangeHeader(rangeHeader, totalSize);
          if (!range) {
            headers.set("Content-Range", `bytes */${totalSize}`);
            return new Response(null, { status: 416, headers });
          }
          const length = range.end - range.start + 1;
          const object = await env.VIDEOS_BUCKET.get(recording.objectKey, { range: { offset: range.start, length } } as any);
          if (!object || !("body" in object) || !object.body) {
            return jsonResponse(404, { status: "not_found", message: "Recording file is missing" }, headers);
          }
          headers.set("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
          headers.set("Content-Length", String(length));
          return new Response(request.method === "HEAD" ? null : object.body, { status: 206, headers });
        }
        const object = await env.VIDEOS_BUCKET.get(recording.objectKey);
        if (!object || !("body" in object) || !object.body) {
          return jsonResponse(404, { status: "not_found", message: "Recording file is missing" }, headers);
        }
        const size = totalSize || Number(object.size ?? 0);
        if (size) headers.set("Content-Length", String(size));
        return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
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

        const courseAccess = await db.getUserCourseDocumentAccess(authContext.user.id);
        if (!courseAccess) {
          return jsonResponse(403, {
            status: "forbidden",
            message: "Paid course access is required to access student documents",
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

        ctx.waitUntil(db.trackEngagement({
          userId: authContext.user.id,
          eventType: action === "view" ? "student_document_viewed" : "student_document_downloaded",
          entityType: "student_document",
          entityId: document.id,
          metadata: JSON.stringify({
            isBulkArchive: !!document.isBulkArchive,
            mimeType: document.mimeType,
            fileSizeBytes: document.fileSizeBytes ?? object.size ?? null,
          }),
        }).catch((error) => {
          logger.warn("[DOCUMENTS] Failed to track document access", {
            userId: authContext.user?.id,
            documentId: document.id,
            action,
            error: error instanceof Error ? error.message : String(error),
          });
        }));

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

  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    (globalThis as { ENV?: Env }).ENV = env;
    await db.getDb({ DB: env.DB });
    if (controller.cron === MINUTE_DELIVERY_CRON) {
      try {
        await runFrequentEmailJobs();
      } catch (error) {
        logger.error("[CRON] Frequent email jobs failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        await checkScheduledEmailOutboxHealth(5);
      } catch (error) {
        logger.error("[CRON] Email outbox health check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const minute = new Date().getUTCMinutes();
      if (minute === 0) {
        const stats = await db.getEmailOutboxStats(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        if (stats.deadLetter > 0 || stats.pending + stats.failed > 100) {
          await db.notifyStaffByEvent("email_delivery_anomaly", {
            titleEn: `Email outbox needs attention (${stats.deadLetter} dead-lettered)`,
            titleAr: `صندوق البريد يحتاج متابعة (${stats.deadLetter} فشل نهائياً)`,
            contentEn: `${stats.pending} pending, ${stats.failed} failed, ${stats.processing} processing.`,
            contentAr: `${stats.pending} معلقة، ${stats.failed} فاشلة، ${stats.processing} قيد المعالجة.`,
            metadata: stats,
          }).catch(() => {});
        }
      }
      return;
    }

    if (controller.cron === TIMED_SERVICE_REPAIR_CRON) {
      // This repair can scan several future-pending users. Keep it outside the
      // minute delivery invocation so it cannot consume that invocation's CPU.
      try {
        await db.runTimedServiceActivationRepair();
      } catch (error) {
        logger.error("[CRON] Timed-service activation repair failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (controller.cron !== DAILY_MAINTENANCE_CRON) {
      logger.warn("[CRON] Ignoring unknown schedule", {
        cron: controller.cron,
      });
      return;
    }

    try {
      await db.runStaffMonitoringRetention();
    } catch (error) {
      logger.error("[CRON] Staff monitoring retention failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const unfrozen = await db.processExpiredFreezes();
    for (const user of unfrozen) {
      if (user.email) {
        await sendFreezeExpiredEmail(user.email, user.name);
      }
    }

    // Send timed-service renewal reminders (pre-expiry, day-of, and bounded recovery).
    const renewalReminderOffsets = [14, 7, 3, 1, 0, -3, -10];
    const renewalReminderCandidates = await db.getRenewalReminderCandidates(renewalReminderOffsets);
    const staffExpiryDigestItems: SubscriptionExpiryDigestItem[] = [];
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
      staffExpiryDigestItems.push(sub);

      const isExpired = sub.daysLeft < 0;

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

    const staffExpiryDigest = buildSubscriptionExpiryDigestNotification(staffExpiryDigestItems);
    if (staffExpiryDigest) {
      await db.notifyStaffByEvent('subscription_expiring', {
        ...staffExpiryDigest,
        emailContentHtmlEn: staffExpiryDigest.emailContentHtmlEn,
        emailActionLabelEn: 'Open Expiry Report',
        metadata: {
          ...staffExpiryDigest.metadata,
          generatedAt: new Date().toISOString(),
        },
      }).catch((e) => logger.error('[CRON] Staff notify (subscription_expiring digest) failed', e));
    }

    // Send LexAI-specific staff alerts (7 days, 3 days, and day-of)
    const expiringLexaiWithin7 = await db.getExpiringLexaiSubscriptions(7);
    for (const sub of expiringLexaiWithin7) {
      if (sub.daysLeft === 7 || sub.daysLeft === 3 || sub.daysLeft === 0) {
        await db.flagLexaiSupportCaseExpiry(sub.userId, sub.daysLeft);
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

    // --- Timed-service inactivity emails (7 days, 14 days) ---
    // Clients receive personalized messages with configured admins copied by
    // BCC. Staff receive one digest instead of one extra alert per client.
    const inactivityDigestItems: InactivityDigestItem[] = [];
    const inactivityAdminBcc = await db.getConfiguredAdminNotificationEmails();
    for (const days of [7, 14]) {
      try {
        const users = await db.getInactiveUsers(days);
        for (const u of users) {
          const clientEmail = u.email.trim().toLowerCase();
          const adminBcc = inactivityAdminBcc.filter(
            (email) => email.trim().toLowerCase() !== clientEmail,
          );
          const delivery = await sendInactivityEmail(u.email, days, {
            userId: u.userId,
            name: u.name,
            services: u.services,
            adminBcc,
          });
          if (delivery.status !== 'failed') {
            await db.logEmailSent(u.userId, u.emailLogKey, {
              inactiveDays: days,
              lastActiveAt: u.lastActiveAt,
              services: u.services,
              deliveryStatus: delivery.status,
              skippedReason: delivery.skippedReason ?? null,
            });
          }
          inactivityDigestItems.push({
            userId: u.userId,
            email: u.email,
            name: u.name,
            inactiveDays: u.daysSinceActive,
            services: u.services,
            deliveryStatus: delivery.status,
          });
        }
      } catch (e) {
        logger.error(`[CRON] Inactivity ${days}d failed`, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    const inactivityDigest = buildInactivityDigestNotification(inactivityDigestItems);
    if (inactivityDigest) {
      await db.notifyStaffByEvent('student_inactivity', {
        ...inactivityDigest,
        emailContentHtmlEn: inactivityDigest.emailContentHtmlEn,
        emailActionLabelEn: 'Open Student Report',
        metadata: {
          ...inactivityDigest.metadata,
          generatedAt: new Date().toISOString(),
        },
      }).catch((error) => logger.error('[CRON] Staff notify (inactivity digest) failed', {
        error: error instanceof Error ? error.message : String(error),
      }));
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
      await drainRecommendationDeliveryQueue({
        limit: RECOMMENDATION_DELIVERY_BATCH_SIZE,
        source: "daily",
      });
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
