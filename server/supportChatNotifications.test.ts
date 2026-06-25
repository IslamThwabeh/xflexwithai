import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getOrCreateSupportConversation: vi.fn(),
    getSupportMessages: vi.fn(),
    getSupportConversation: vi.fn(),
    getUserById: vi.fn(),
    hasAnyRole: vi.fn().mockResolvedValue(true),
    setNeedsHuman: vi.fn().mockResolvedValue(undefined),
    createSupportMessage: vi.fn(),
    createNotification: vi.fn().mockResolvedValue(undefined),
    enqueueEmailOutbox: vi.fn().mockResolvedValue(true),
    enqueueSupportReplyDigestEmail: vi.fn().mockResolvedValue(true),
    notifyStaffByEvent: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/supportChat.requestHuman",
    },
    user: {
      id: 123,
      email: "student@example.com",
      passwordHash: "",
      name: "Student User",
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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createSupportStaffCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/supportChat.reply",
    },
    user: {
      id: 456,
      email: "support2@example.com",
      passwordHash: "",
      name: "Support 2",
      phone: null,
      emailVerified: true,
      isStaff: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("support chat staff notifications", () => {
  const getOrCreateSupportConversation = vi.mocked(db.getOrCreateSupportConversation);
  const getSupportMessages = vi.mocked(db.getSupportMessages);
  const getSupportConversation = vi.mocked(db.getSupportConversation);
  const getUserById = vi.mocked(db.getUserById);
  const setNeedsHuman = vi.mocked(db.setNeedsHuman);
  const createSupportMessage = vi.mocked(db.createSupportMessage);
  const createNotification = vi.mocked(db.createNotification);
  const enqueueSupportReplyDigestEmail = vi.mocked(db.enqueueSupportReplyDigestEmail);
  const notifyStaffByEvent = vi.mocked(db.notifyStaffByEvent);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    getOrCreateSupportConversation.mockResolvedValue({
      id: 10,
      userId: 123,
      status: "open",
      needsHuman: false,
    } as any);
    getSupportMessages.mockResolvedValue([] as any);
    setNeedsHuman.mockResolvedValue(undefined as any);
    createSupportMessage.mockResolvedValue(55 as any);
    getSupportConversation.mockResolvedValue(null);
    getUserById.mockResolvedValue(null);
    createNotification.mockResolvedValue(undefined as any);
    enqueueSupportReplyDigestEmail.mockResolvedValue(true);
    notifyStaffByEvent.mockResolvedValue(undefined as any);
  });

  it("queues a digest email for a human reply even when the client is currently online", async () => {
    const caller = createSupportStaffCaller();
    getSupportConversation.mockResolvedValue({
      id: 10,
      userId: 123,
      status: "open",
    } as any);
    getUserById.mockResolvedValue({
      id: 123,
      email: "student@example.com",
      name: "Online Student",
      lastInteractiveAt: new Date().toISOString(),
    } as any);
    createSupportMessage.mockResolvedValue({
      id: 88,
      conversationId: 10,
      senderType: "support",
      content: "Your issue has been resolved.",
    } as any);

    await caller.supportChat.reply({
      conversationId: 10,
      content: "Your issue has been resolved.",
    });

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 123,
      actionUrl: "/support",
    }));
    expect(enqueueSupportReplyDigestEmail).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      messageId: 88,
      recipientUserId: 123,
      recipientEmail: "student@example.com",
      replyContent: "Your issue has been resolved.",
      buildEmail: expect.any(Function),
    }));
  });

  it("waits for the human escalation notification dispatch before returning", async () => {
    const caller = createAuthedCaller();
    const deferred = createDeferred();
    notifyStaffByEvent.mockImplementation(() => deferred.promise as any);

    let settled = false;
    const resultPromise = caller.supportChat.requestHuman().then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => {
      expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
      expect(createSupportMessage).toHaveBeenCalledWith({
        conversationId: 10,
        senderId: 0,
        senderType: "bot",
        content: "⚠️ Student requested a human agent.",
      });
      expect(notifyStaffByEvent).toHaveBeenCalledWith(
        "human_escalation",
        expect.objectContaining({
          metadata: { userId: 123, conversationId: 10 },
        }),
      );
    });

    expect(settled).toBe(false);

    deferred.resolve();

    await expect(resultPromise).resolves.toEqual({ success: true });
  });

  it("waits for the new support message notification dispatch before returning", async () => {
    const caller = createAuthedCaller();
    const deferred = createDeferred();

    getOrCreateSupportConversation.mockResolvedValue({
      id: 10,
      userId: 123,
      status: "open",
      needsHuman: true,
    } as any);
    createSupportMessage.mockResolvedValue({ id: 77, conversationId: 10, content: "Need help" } as any);
    notifyStaffByEvent.mockImplementation(() => deferred.promise as any);

    let settled = false;
    const resultPromise = caller.supportChat.send({ content: "Need help" }).then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => {
      expect(notifyStaffByEvent).toHaveBeenCalledWith(
        "new_support_message",
        expect.objectContaining({
          actionUrl: "/admin/support?conversationId=10",
          contentEn: expect.stringContaining("Client: Student User"),
          metadata: { userId: 123, conversationId: 10 },
        }),
      );
    });

    expect(settled).toBe(false);

    deferred.resolve();

    await expect(resultPromise).resolves.toMatchObject({ id: 77, conversationId: 10, content: "Need help" });
  });

  it("creates an AI reply during working hours until the client requests a human", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T10:00:00.000Z"));
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from AI" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    createSupportMessage
      .mockResolvedValueOnce({ id: 77, conversationId: 10, content: "hi" } as any)
      .mockResolvedValueOnce({ id: 78, conversationId: 10, content: "Hello from AI" } as any);
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "hi" },
    ] as any);

    const caller = createAuthedCaller();
    await caller.supportChat.send({ content: "hi" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const openAiRequest = fetchMock.mock.calls[0]?.[1];
    const parsedBody = JSON.parse(String(openAiRequest?.body ?? "{}"));
    expect(parsedBody.messages?.[0]?.content).toContain("Rawan is the founder of XFlex Trading Academy");
    expect(parsedBody.messages?.[0]?.content).toContain("Birzeit University");
    expect(parsedBody.messages?.[0]?.content).toContain("Locked lessons or missing lesson quizzes");
    expect(parsedBody.messages?.[0]?.content).toContain("Start with one concrete self-service step");
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, {
      conversationId: 10,
      senderId: 0,
      senderType: "bot",
      content: "Hello from AI",
    });
  });

  it("treats an explicit typed human request as an escalation and skips AI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const caller = createAuthedCaller();
    createSupportMessage
      .mockResolvedValueOnce({ id: 77, conversationId: 10, content: "اريد مساعد بشري" } as any)
      .mockResolvedValueOnce({ id: 78, conversationId: 10, content: "⚠️ Student requested a human agent." } as any);

    await caller.supportChat.send({ content: "اريد مساعد بشري" });

    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, {
      conversationId: 10,
      senderId: 0,
      senderType: "bot",
      content: "⚠️ Student requested a human agent.",
    });
    expect(notifyStaffByEvent).toHaveBeenCalledWith(
      "human_escalation",
      expect.objectContaining({
        metadata: { userId: 123, conversationId: 10 },
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acknowledges attachment-only messages without asking OpenAI to inspect them", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const caller = createAuthedCaller();
    createSupportMessage
      .mockResolvedValueOnce({ id: 77, conversationId: 10, content: "[IMG_2723.png]" } as any)
      .mockResolvedValueOnce({ id: 78, conversationId: 10, content: "وصلتني المرفقات." } as any);

    await caller.supportChat.send({
      content: "[IMG_2723.png]",
      attachmentUrl: "https://videos.xflexacademy.com/support/83/image.png",
      attachmentName: "IMG_2723.png",
      attachmentType: "file",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createSupportMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversationId: 10,
        senderId: 0,
        senderType: "bot",
        content: expect.stringContaining("لا أستطيع قراءة الصورة"),
      }),
    );
  });

  it("normalizes voice-note duration before persisting the support message", async () => {
    const caller = createAuthedCaller();

    getOrCreateSupportConversation.mockResolvedValue({
      id: 10,
      userId: 123,
      status: "open",
      needsHuman: true,
    } as any);
    createSupportMessage.mockResolvedValue({ id: 91, conversationId: 10, content: "voice" } as any);

    await caller.supportChat.send({
      content: "voice",
      attachmentType: "voice",
      attachmentDuration: 12.6,
    });

    expect(createSupportMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentType: "voice",
        attachmentDuration: 13,
      }),
    );
  });

  it("rejects support chat videos that are one minute or longer", async () => {
    const caller = createAuthedCaller();

    getOrCreateSupportConversation.mockResolvedValue({
      id: 10,
      userId: 123,
      status: "open",
      needsHuman: true,
    } as any);

    await expect(
      caller.supportChat.send({
        content: "video",
        attachmentType: "video",
        attachmentDuration: 60,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(createSupportMessage).not.toHaveBeenCalled();
  });
});
