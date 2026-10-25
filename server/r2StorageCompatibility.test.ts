import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageArchiveR2, storageDeleteR2, storageGetR2, storagePutR2 } from "../backend/storage-r2";

function bucketFixture() {
  return {
    put: vi.fn().mockResolvedValue({ key: "fixture-object" }),
    get: vi.fn().mockResolvedValue({ key: "fixture-object" }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.stubEnv("R2_PUBLIC_URL", "https://media.fixture.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("native R2 storage compatibility", () => {
  it("uploads bytes through the supplied binding with the existing metadata and public URL", async () => {
    const bucket = bucketFixture();
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await storagePutR2(bucket as never, "/videos/fixture.mp4", bytes, "video/mp4")).toEqual({
      key: "videos/fixture.mp4", url: "https://media.fixture.test/videos/fixture.mp4",
    });
    expect(bucket.put).toHaveBeenCalledWith("videos/fixture.mp4", bytes, {
      httpMetadata: { contentType: "video/mp4", cacheControl: "max-age=604800" },
    });
  });

  it("retrieves through the native binding and preserves the configured URL format", async () => {
    const bucket = bucketFixture();
    expect(await storageGetR2(bucket as never, "/documents/fixture.pdf")).toEqual({
      key: "documents/fixture.pdf", url: "https://media.fixture.test/documents/fixture.pdf",
    });
    expect(bucket.get).toHaveBeenCalledWith("documents/fixture.pdf");
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("reports missing objects instead of returning a usable-looking link", async () => {
    const bucket = bucketFixture();
    bucket.get.mockResolvedValue(null);
    await expect(storageGetR2(bucket as never, "/documents/missing.pdf")).rejects.toThrow(/File not found/);
  });

  it("deletes only the normalized key in the supplied binding", async () => {
    const bucket = bucketFixture();
    await storageDeleteR2(bucket as never, "/support/fixture.png");
    expect(bucket.delete).toHaveBeenCalledTimes(1);
    expect(bucket.delete).toHaveBeenCalledWith("support/fixture.png");
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("archives the original body and metadata before deleting its source", async () => {
    const bucket = bucketFixture();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const httpMetadata = { contentType: "image/png", cacheControl: "private" };
    bucket.get.mockResolvedValue({ body, httpMetadata });
    expect(await storageArchiveR2(bucket as never, "/payment-proofs/fixture.png")).toEqual({
      archivedKey: "_archived/payment-proofs/fixture.png",
    });
    expect(bucket.put).toHaveBeenCalledWith("_archived/payment-proofs/fixture.png", body, { httpMetadata });
    expect(bucket.delete).toHaveBeenCalledWith("payment-proofs/fixture.png");
    expect(bucket.put.mock.invocationCallOrder[0]).toBeLessThan(bucket.delete.mock.invocationCallOrder[0]);
  });

  it("preserves the original object when its archive copy fails", async () => {
    const bucket = bucketFixture();
    bucket.get.mockResolvedValue({ body: "fixture", httpMetadata: { contentType: "text/plain" } });
    bucket.put.mockRejectedValue(new Error("fixture copy failure"));
    await expect(storageArchiveR2(bucket as never, "/support/fixture.txt")).rejects.toThrow("fixture copy failure");
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it("keeps an already-missing archive operation idempotent", async () => {
    const bucket = bucketFixture();
    bucket.get.mockResolvedValue(null);
    expect(await storageArchiveR2(bucket as never, "/support/missing.txt")).toEqual({
      archivedKey: "_archived/support/missing.txt",
    });
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });
});
