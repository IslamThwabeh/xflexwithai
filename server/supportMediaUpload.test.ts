import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/storage-r2", () => ({
  storageArchiveR2: vi.fn(),
  storagePutR2: vi.fn(async (_bucket: unknown, key: string) => ({
    key,
    url: `https://videos.xflexacademy.com/${key}`,
  })),
}));

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
  };
});

import { appRouter } from "../backend/routers";
import { storagePutR2 } from "../backend/storage-r2";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/supportChat.uploadAttachment",
    },
    user: {
      id: 123,
      email: "tester@example.com",
      passwordHash: "",
      name: "Test User",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("support media upload routing", () => {
  const storagePut = vi.mocked(storagePutR2);

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ENV = { VIDEOS_BUCKET: {} };
  });

  it("stores support chat videos under the video lifecycle prefix", async () => {
    const caller = createAuthedCaller();

    await caller.supportChat.uploadAttachment({
      fileData: Buffer.from("video").toString("base64"),
      fileName: "clip.mp4",
      contentType: "video/mp4",
      attachmentType: "video",
      attachmentDuration: 38,
    });

    expect(storagePut).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^support\/videos\/123\/\d+-[a-z0-9]+-clip\.mp4$/),
      expect.any(Buffer),
      "video/mp4",
    );
  });

  it("keeps support chat non-video attachments on the legacy support prefix", async () => {
    const caller = createAuthedCaller();

    await caller.supportChat.uploadAttachment({
      fileData: Buffer.from("image").toString("base64"),
      fileName: "proof.png",
      contentType: "image/png",
      attachmentType: "file",
    });

    expect(storagePut).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^support\/123\/\d+-[a-z0-9]+-proof\.png$/),
      expect.any(Buffer),
      "image/png",
    );
  });

  it("stores bug report videos under the bug report video lifecycle prefix", async () => {
    const caller = createAuthedCaller();

    await caller.bugReports.uploadImage({
      fileData: Buffer.from("video").toString("base64"),
      fileName: "bug.mp4",
      contentType: "video/mp4",
      attachmentDuration: 38,
    });

    expect(storagePut).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^bug-reports\/videos\/123\/\d+-[a-z0-9]+-bug\.mp4$/),
      expect.any(Buffer),
      "video/mp4",
    );
  });
});
