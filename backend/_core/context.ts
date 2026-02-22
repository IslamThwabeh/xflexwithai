import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../database/schema-sqlite";
import { logger } from "./logger";
import { verifyToken } from "./auth";
import { COOKIE_NAME } from "../../shared/const";
import * as db from "../db";

export type RequestLike = {
  headers: Headers | Record<string, string | string[] | undefined>;
  protocol?: string;
  url?: string;
  hostname?: string;
  path?: string;
  method?: string;
  cookies?: Record<string, string>;
};

export type TrpcContext = {
  req: RequestLike;
  user: User | null;
  setCookie: (name: string, value: string, options?: any) => void;
  clearCookie: (name: string, options?: any) => void;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 🔍 LOG: Request details
  logger.info('🔍 [AUTH DEBUG] Creating context', {
    path: opts.req.path,
    method: opts.req.method,
    cookies: Object.keys(opts.req.cookies || {}),
    hasCookie: !!opts.req.cookies[COOKIE_NAME],
  });

  try {
    // Get JWT token from cookie
    const token = opts.req.cookies[COOKIE_NAME];
    
    if (!token) {
      logger.warn('⚠️ [AUTH DEBUG] No JWT token found in cookies', {
        cookieName: COOKIE_NAME,
        allCookies: Object.keys(opts.req.cookies || {}),
      });
    } else {
      logger.info('✅ [AUTH DEBUG] JWT token found', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
      });

      // Verify and decode JWT
      const decoded = await verifyToken(token);
      
      if (!decoded) {
        logger.error('❌ [AUTH DEBUG] Token verification failed', {
          token: token.substring(0, 20) + '...',
        });
      } else {
        logger.info('✅ [AUTH DEBUG] Token verified successfully', {
          userId: decoded.userId,
          email: decoded.email,
          type: decoded.type,
        });

        if (decoded && decoded.userId) {
          // Fetch user from database based on token type
          if (decoded.type === 'admin') {
            logger.info('🔍 [AUTH DEBUG] Looking up admin in database', {
              userId: decoded.userId,
            });

            const admin = await db.getAdminById(decoded.userId);
            
            if (!admin) {
              logger.error('❌ [AUTH DEBUG] Admin not found in database', {
                userId: decoded.userId,
              });
            } else {
              logger.info('✅ [AUTH DEBUG] Admin found in database', {
                adminId: admin.id,
                email: admin.email,
                name: admin.name,
              });

              // Convert admin to User type for context
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
              } as User;
              
              logger.auth('✅ Admin authenticated successfully', { 
                adminId: admin.id, 
                email: admin.email 
              });
            }
          } else {
            // Regular user
            logger.info('🔍 [AUTH DEBUG] Looking up regular user in database', {
              userId: decoded.userId,
            });

            const regularUser = await db.getUserById(decoded.userId);
            
            if (!regularUser) {
              logger.error('❌ [AUTH DEBUG] User not found in database', {
                userId: decoded.userId,
              });
            } else {
              logger.info('✅ [AUTH DEBUG] User found in database', {
                userId: regularUser.id,
                email: regularUser.email,
                name: regularUser.name,
              });

              user = regularUser;
              logger.auth('✅ User authenticated successfully', { 
                userId: regularUser.id, 
                email: regularUser.email 
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures
    logger.error('❌ [AUTH DEBUG] Authentication error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    user = null;
  }

  logger.info('🏁 [AUTH DEBUG] Context created', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
  });

  return {
    req: opts.req,
    user,
    setCookie: (name, value, options) => opts.res.cookie(name, value, options),
    clearCookie: (name, options) => opts.res.clearCookie(name, options),
  };
}
