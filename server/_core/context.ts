import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { logger } from "./logger";
import { verifyToken } from "./auth";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Get JWT token from cookie
    const token = opts.req.cookies[COOKIE_NAME];
    
    if (token) {
      // Verify and decode JWT
      const decoded = verifyToken(token);
      
      if (decoded && decoded.userId) {
        // Fetch user from database based on token type
        if (decoded.type === 'admin') {
          const admin = await db.getAdminById(decoded.userId);
          if (admin) {
            // Convert admin to User type for context
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
            } as User;
            logger.auth('Admin authenticated', { adminId: admin.id, email: admin.email });
          }
        } else {
          // Regular user
          const regularUser = await db.getUserById(decoded.userId);
          if (regularUser) {
            user = regularUser;
            logger.auth('User authenticated', { userId: regularUser.id, email: regularUser.email });
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures
    logger.debug('Authentication skipped or failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
