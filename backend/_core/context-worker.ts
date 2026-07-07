import { parse, serialize } from "cookie";
import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { COOKIE_NAME, IDLE_TIMEOUT_STAFF_MS } from "../../shared/const";
import { isAdminTokenValidForPasswordState, verifyToken } from "./auth";
import { getSessionCookieOptions } from "./cookies";
import { logger } from "./logger";
import * as db from "../db";
import type { TrpcContext } from "./context";

export type WorkerContextOptions = {
  req: Request;
  env: { DB: D1Database };
  executionCtx?: ExecutionContext;
};

export async function createWorkerContext(
  opts: WorkerContextOptions
): Promise<TrpcContext> {
  const { req } = opts;
  const cookieHeaders: string[] = [];
  let user: any = null;
  let sessionId: string | null = null;

  const setCookie: TrpcContext["setCookie"] = (name, value, options = {}) => {
    cookieHeaders.push(serialize(name, value, options));
  };

  const clearCookie: TrpcContext["clearCookie"] = (name, options = {}) => {
    cookieHeaders.push(serialize(name, "", { ...options, maxAge: 0 }));
  };

  try {
    const cookies = parse(req.headers.get("cookie") || "");
    const token = cookies[COOKIE_NAME];

    if (!token) {
      logger.warn("[AUTH] No JWT token found in cookies");
    } else {
      const decoded = await verifyToken(token);

      if (!decoded) {
        logger.error("[AUTH] Token verification failed");
      } else if (decoded.type === "admin") {
        const admin = await db.getAdminById(decoded.userId);
        if (admin && isAdminTokenValidForPasswordState(decoded, admin)) {
          user = {
            // IMPORTANT: admins and users are stored in separate tables that can share the same
            // numeric IDs. To prevent cross-account data collisions in user-scoped tables
            // (e.g. LexAI messages keyed by userId), map admin IDs into a separate namespace.
            // Admin id=1 becomes user.id=-1 in the request context.
            id: -Number(admin.id),
            email: admin.email,
            name: admin.name,
            phone: null,
            emailVerified: false,
            passwordHash: admin.passwordHash,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
            lastSignedIn: admin.lastSignedIn,
          };
        } else if (admin) {
          logger.info("[AUTH] Admin token invalidated by password change", {
            adminId: admin.id,
            email: admin.email,
          });
          clearCookie(COOKIE_NAME, getSessionCookieOptions(req, "admin"));
        }
      } else {
        const regularUser = await db.getUserById(decoded.userId);

        if (
          regularUser?.isStaff &&
          (!decoded.sessionId || !await db.validateActiveStaffSession(regularUser.id, decoded.sessionId))
        ) {
          logger.info("[AUTH] Staff session expired due to inactivity", {
            userId: regularUser.id,
            email: regularUser.email,
          });
          clearCookie(COOKIE_NAME, getSessionCookieOptions(req, "user"));
        } else {
          user = regularUser;
          if (user) {
            sessionId = decoded.sessionId ?? null;
            if (!user.isStaff) {
              db.touchUserActivity(user.id).catch(() => {});
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("[AUTH] Worker auth error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    user = null;
  }

  return {
    req,
    user,
    sessionId,
    defer: opts.executionCtx ? (task) => opts.executionCtx!.waitUntil(task) : undefined,
    setCookie,
    clearCookie,
    cookieHeaders,
  } as TrpcContext & { cookieHeaders: string[] };
}
