/**
 * Environment variables configuration
 * Supports both Node.js and Cloudflare Workers
 */

export const ENV = {
  appId: process.env.VITE_APP_ID ?? globalThis.ENV?.VITE_APP_ID ?? "xflex-trading-academy",
  cookieSecret: process.env.JWT_SECRET ?? globalThis.ENV?.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? globalThis.ENV?.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  
  // Cloudflare specific
  r2BucketUrl: process.env.R2_PUBLIC_URL ?? globalThis.ENV?.R2_PUBLIC_URL ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? globalThis.ENV?.R2_BUCKET_NAME ?? "xflexwithai-videos",
};
