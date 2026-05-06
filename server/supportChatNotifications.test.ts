import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getOrCreateSupportConversation: vi.fn(),
    getSupportMessages: vi.fn(),
    setNeedsHuman: vi.fn().mockResolvedValue(undefined),
    createSupportMessage: vi.fn(),
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

describe("support chat staff notifications", () => {
  const getOrCreateSupportConversation = vi.mocked(db.getOrCreateSupportConversation);
  const getSupportMessages = vi.mocked(db.getSupportMessages);
  const setNeedsHuman = vi.mocked(db.setNeedsHuman);
  const createSupportMessage = vi.mocked(db.createSupportMessage);
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
    notifyStaffByEvent.mockResolvedValue(undefined as any);
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
          contentEn: "Need help",
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
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, {
      conversationId: 10,
      senderId: 0,
      senderType: "bot",
      content: "Hello from AI",
    });
  });
});