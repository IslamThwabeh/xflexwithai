import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { logger } from "./logger";

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
    user = await sdk.authenticateRequest(opts.req);
    if (user) {
      logger.auth('User authenticated', { userId: user.id, email: user.email });
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    logger.debug('Authentication skipped or failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
