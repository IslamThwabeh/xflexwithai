/**
 * Environment variables configuration
 * Supports both Node.js and Cloudflare Workers
 */

export const ENV = {
  appId: process.env.VITE_APP_ID ?? globalThis.ENV?.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? globalThis.ENV?.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? globalThis.ENV?.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? globalThis.ENV?.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? globalThis.ENV?.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? globalThis.ENV?.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? globalThis.ENV?.BUILT_IN_FORGE_API_KEY ?? "",
  
  // Cloudflare specific
  r2BucketUrl: process.env.R2_PUBLIC_URL ?? globalThis.ENV?.R2_PUBLIC_URL ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? globalThis.ENV?.R2_BUCKET_NAME ?? "xflexwithai-videos",
};
