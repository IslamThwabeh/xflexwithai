import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
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
  KV_CACHE?: KVNamespace;
  JWT_SECRET: string;
  VITE_APP_TITLE: string;
  VITE_APP_LOGO: string;
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
      const url = new URL(request.url);
      const pathname = url.pathname;
      
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
      
      // API placeholder
      if (pathname.startsWith("/api")) {
        return new Response(JSON.stringify({ 
          status: "coming_soon", 
          message: "Backend API is being deployed. Please check again soon.",
          availableEndpoints: [
            "/health",
            "/api/test/db"
          ]
        }), {
          status: 200,
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
};
