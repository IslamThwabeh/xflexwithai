import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import quizRoutes from "../routes/quiz.routes";
import adminQuizRoutes from "../routes/admin-quiz.routes";
import type { D1Database } from "@cloudflare/workers-types";

declare const KVNamespace: any;
declare const R2Bucket: any;

/**
 * Cloudflare Workers environment
 */
export interface Env {
  DB: D1Database;
  VIDEOS_BUCKET: R2Bucket;
  KV_CACHE: KVNamespace;
  JWT_SECRET: string;
  OAUTH_SERVER_URL: string;
  VITE_OAUTH_PORTAL_URL: string;
  VITE_APP_ID: string;
  OWNER_OPEN_ID: string;
  OWNER_NAME: string;
  VITE_APP_TITLE: string;
  VITE_APP_LOGO: string;
  BUILT_IN_FORGE_API_URL: string;
  BUILT_IN_FORGE_API_KEY: string;
  VITE_FRONTEND_FORGE_API_URL: string;
  VITE_FRONTEND_FORGE_API_KEY: string;
  ENVIRONMENT: "production" | "staging" | "development";
}

/**
 * Create Express app with routes
 */
function createApp(env: Env) {
  const app = express();

  // Inject environment into context
  app.use((req, res, next) => {
    (req as any).env = env;
    next();
  });

  // Configure cookie parser
  app.use(cookieParser());

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // FlexAI routes
  try {
    const flexaiRoutes = require("../routes/flexai");
    app.use("/api/flexai", flexaiRoutes.default);
  } catch (error) {
    console.error("Failed to load FlexAI routes:", error);
  }

  // OAuth callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use("/api/quiz", quizRoutes);
  app.use("/api/admin/quiz", adminQuizRoutes);

  // Vite/Static files
  if (process.env.NODE_ENV === "development") {
    setupVite(app, null as any);
  } else {
    serveStatic(app);
  }

  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}/`);
  });
}

/**
 * For Cloudflare Workers
 */
export function createWorkerHandler() {
  const app = express();

  // Configure cookie parser
  app.use(cookieParser());

  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // FlexAI routes
  try {
    const flexaiRoutes = require("../routes/flexai");
    app.use("/api/flexai", flexaiRoutes.default);
  } catch (error) {
    console.error("Failed to load FlexAI routes:", error);
  }

  // OAuth callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use("/api/quiz", quizRoutes);
  app.use("/api/admin/quiz", adminQuizRoutes);

  // Serve static files (for SPA)
  serveStatic(app);

  return app;
}

/**
 * Main Cloudflare Workers fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const app = createApp(env);
      
      return new Promise((resolve, reject) => {
        // For now, return a simple response
        resolve(
          new Response("Cloudflare Workers deployment in progress. Please check again soon.", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          })
        );
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
