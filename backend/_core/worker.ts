import type { D1Database, ExecutionContext, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../routers";
import { createWorkerContext } from "./context-worker";
import * as db from "../db";

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
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const origin = request.headers.get("origin") || "";
      (globalThis as { ENV?: Env }).ENV = env;
      const allowedOrigins = new Set([
        "https://xflexwithai.com",
        "https://www.xflexwithai.com",
      ]);

      const corsHeaders = new Headers();
      if (allowedOrigins.has(origin)) {
        corsHeaders.set("Access-Control-Allow-Origin", origin);
        corsHeaders.set("Access-Control-Allow-Credentials", "true");
        corsHeaders.set("Vary", "Origin");
      }

      await db.getDb({ DB: env.DB });
      
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
          createContext: async () => createWorkerContext({ req: request, env }),
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
};
