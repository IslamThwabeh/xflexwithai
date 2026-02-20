/**
 * Environment variables configuration
 * Supports both Node.js and Cloudflare Workers
 */

const getWorkerEnv = () =>
  (globalThis as { ENV?: Record<string, string> }).ENV ?? {};

const getEnvVar = (name: string, fallback = "") =>
  process.env[name] ?? getWorkerEnv()[name] ?? fallback;

export const ENV = {
  get appId() {
    return getEnvVar("VITE_APP_ID", "xflex-trading-academy");
  },
  get cookieSecret() {
    return getEnvVar("JWT_SECRET", "");
  },
  get jwtSecret() {
    return getEnvVar("JWT_SECRET", "");
  },
  get databaseUrl() {
    return getEnvVar("DATABASE_URL", "");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },

  // Cloudflare specific
  get r2BucketUrl() {
    return getEnvVar("R2_PUBLIC_URL", "");
  },
  get r2BucketName() {
    return getEnvVar("R2_BUCKET_NAME", "xflexwithai-videos");
  },
};
