import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";
import { TERMS_ACCEPTANCE_REQUIRED_ERROR } from "../../shared/legal";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/** Authentication without the customer compliance gate. Keep usage limited to
 * auth/compliance recovery paths that must remain reachable while gated. */
export const authenticatedProcedure = t.procedure.use(requireUser);

const TERMS_GATE_EXEMPT_PATHS = new Set([
  "orders.create",
  "upgrade.createOrder",
]);

const requireCustomerTerms = t.middleware(async opts => {
  const { ctx, next, path } = opts;
  const user = ctx.user!;

  // Admin IDs are namespaced as negative values; staff must retain operations
  // access. Auth, support, and checkout acceptance paths remain recoverable.
  if (
    user.id < 0
    || user.isStaff
    || path.startsWith("auth.")
    || path.startsWith("support.")
    || TERMS_GATE_EXEMPT_PATHS.has(path)
  ) {
    return next();
  }

  const mutableCtx = ctx as TrpcContext & {
    termsAcceptanceStatusPromise?: ReturnType<typeof db.getUserTermsAcceptanceStatus>;
  };
  mutableCtx.termsAcceptanceStatusPromise ??= db.getUserTermsAcceptanceStatus(user.id, user.email);
  const status = await mutableCtx.termsAcceptanceStatusPromise;

  if (status.requiresAcceptance) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: TERMS_ACCEPTANCE_REQUIRED_ERROR,
    });
  }

  return next();
});

export const protectedProcedure = authenticatedProcedure.use(requireCustomerTerms);

// Note: adminProcedure is now defined in routers.ts to check against admins table
