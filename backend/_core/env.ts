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
  get openaiApiKey() {
    return getEnvVar("OPENAI_API_KEY", "");
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
    return getEnvVar("R2_PUBLIC_URL", "https://videos.xflexwithai.com");
  },
  get r2BucketName() {
    return getEnvVar("R2_BUCKET_NAME", "xflexwithai-videos");
  },

  // Optional Forge API fallback (legacy storage proxy)
  get forgeApiUrl() {
    return getEnvVar("BUILT_IN_FORGE_API_URL", "");
  },
  get forgeApiKey() {
    return getEnvVar("BUILT_IN_FORGE_API_KEY", "");
  },

  // Email / OTP auth
  get emailProvider() {
    // "auto" | "mailchannels" | "resend"
    return getEnvVar("EMAIL_PROVIDER", "auto");
  },
  get emailFrom() {
    return getEnvVar("EMAIL_FROM", "");
  },
  get emailFromName() {
    return getEnvVar("EMAIL_FROM_NAME", "");
  },
  get resendApiKey() {
    return getEnvVar("RESEND_API_KEY", "");
  },
};
