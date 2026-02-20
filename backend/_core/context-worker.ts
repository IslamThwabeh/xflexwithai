import * as cookie from "cookie";
import type { D1Database } from "@cloudflare/workers-types";
import { COOKIE_NAME } from "@shared/const";
import { verifyToken } from "./auth";
import { logger } from "./logger";
import * as db from "../db";
import type { TrpcContext } from "./context";

export type WorkerContextOptions = {
  req: Request;
  env: { DB: D1Database };
};

export async function createWorkerContext(
  opts: WorkerContextOptions
): Promise<TrpcContext> {
  const { req } = opts;
  const cookieHeaders: string[] = [];
  let user: any = null;

  const setCookie: TrpcContext["setCookie"] = (name, value, options = {}) => {
    cookieHeaders.push(cookie.serialize(name, value, options));
  };

  const clearCookie: TrpcContext["clearCookie"] = (name, options = {}) => {
    cookieHeaders.push(cookie.serialize(name, "", { ...options, maxAge: 0 }));
  };

  try {
    const cookies = cookie.parse(req.headers.get("cookie") || "");
    const token = cookies[COOKIE_NAME];

    if (!token) {
      logger.warn("[AUTH] No JWT token found in cookies");
    } else {
      const decoded = verifyToken(token);

      if (!decoded) {
        logger.error("[AUTH] Token verification failed");
      } else if (decoded.type === "admin") {
        const admin = await db.getAdminById(decoded.userId);
        if (admin) {
          user = {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            phone: null,
            emailVerified: false,
            passwordHash: admin.passwordHash,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
            lastSignedIn: admin.lastSignedIn,
          };
        }
      } else {
        user = await db.getUserById(decoded.userId);
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
    setCookie,
    clearCookie,
    cookieHeaders,
  } as TrpcContext & { cookieHeaders: string[] };
}
