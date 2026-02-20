/**
 * Storage service for Cloudflare R2
 * Handles file uploads to R2 bucket (xflexwithai-videos)
 */

import { ENV } from './_core/env';

interface R2Bucket {
  put(
    key: string,
    body: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string,
    options?: any
  ): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploadedOn: Date;
  httpMetadata?: any;
}

/**
 * Store file in R2 bucket
 * @param bucket - R2 bucket object from Cloudflare environment
 * @param key - Path in bucket (e.g., 'videos/episode1.mp4')
 * @param data - File data as Buffer, string, or stream
 * @param contentType - MIME type (e.g., 'video/mp4')
 */
export async function storagePutR2(
  bucket: R2Bucket,
  key: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    const normalizedKey = key.replace(/^\/+/, ""); // Remove leading slashes
    
    const response = await bucket.put(normalizedKey, data, {
      httpMetadata: {
        contentType,
        cacheControl: "max-age=604800", // 7 days
      },
    });

    const url = `${ENV.r2BucketUrl}/${normalizedKey}`;
    return { key: normalizedKey, url };
  } catch (error) {
    throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieve file from R2 bucket
 * @param bucket - R2 bucket object from Cloudflare environment
 * @param key - Path in bucket
 */
export async function storageGetR2(
  bucket: R2Bucket,
  key: string
): Promise<{ key: string; url: string }> {
  try {
    const normalizedKey = key.replace(/^\/+/, "");
    const object = await bucket.get(normalizedKey);
    
    if (!object) {
      throw new Error(`File not found in R2: ${normalizedKey}`);
    }

    const url = `${ENV.r2BucketUrl}/${normalizedKey}`;
    return { key: normalizedKey, url };
  } catch (error) {
    throw new Error(`R2 get failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete file from R2 bucket
 * @param bucket - R2 bucket object from Cloudflare environment
 * @param key - Path in bucket
 */
export async function storageDeleteR2(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  try {
    const normalizedKey = key.replace(/^\/+/, "");
    await bucket.delete(normalizedKey);
  } catch (error) {
    throw new Error(`R2 delete failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Legacy storage function for backward compatibility
 * Falls back to Forge API if R2 is not available
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // In Cloudflare Workers context, use R2
  // In local development, use Forge API or fallback
  
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return storageUsingForge(relKey, data, contentType);
  }
  
  throw new Error("Storage not configured: Neither R2 nor Forge API available");
}

/**
 * Legacy storage get for backward compatibility
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return storageGetUsingForge(relKey);
  }

  throw new Error("Storage not configured: Neither R2 nor Forge API available");
}

// ============================================================================
// Forge API Storage (fallback)
// ============================================================================

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storageUsingForge(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGetUsingForge(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
