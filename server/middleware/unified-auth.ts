// server/middleware/unified-auth.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email?: string | null;
    telegram_user_id?: bigint | null;
    user_type: 'web' | 'telegram';
  };
}

/**
 * Unified authentication middleware
 * Supports both web sessions and Telegram user IDs
 */
export async function unifiedAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Try web authentication first (session-based)
    if (req.session?.userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.session.userId)
      });
      
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          telegram_user_id: user.telegram_user_id,
          user_type: 'web'
        };
        return next();
      }
    }
    
    // Try Telegram authentication (telegram_user_id in body)
    const telegramUserId = req.body?.telegram_user_id;
    
    if (telegramUserId) {
      // Find or create Telegram user
      let user = await db.query.users.findFirst({
        where: eq(users.telegram_user_id, BigInt(telegramUserId))
      });
      
      // Auto-create Telegram user if doesn't exist
      if (!user) {
        const [newUser] = await db.insert(users).values({
          telegram_user_id: BigInt(telegramUserId),
          user_type: 'telegram',
          name: `Telegram User ${telegramUserId}`
        }).returning();
        
        user = newUser;
      }
      
      req.user = {
        id: user.id,
        email: user.email,
        telegram_user_id: user.telegram_user_id,
        user_type: 'telegram'
      };
      return next();
    }
    
    // No authentication found
    return res.status(401).json({ 
      success: false,
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}
