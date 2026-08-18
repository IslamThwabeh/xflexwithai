import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getOrCreateSupportConversation: vi.fn(),
    getSupportMessages: vi.fn(),
    getSupportConversation: vi.fn(),
    getSupportAssignmentOptions: vi.fn(),
    assignSupportConversation: vi.fn(),
    getUserById: vi.fn(),
    hasAnyRole: vi.fn().mockResolvedValue(true),
    setNeedsHuman: vi.fn().mockResolvedValue(undefined),
    createSupportMessage: vi.fn(),
    recordSupportAiDecision: vi.fn().mockResolvedValue({ id: 1 }),
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

function supportAiResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: "chatcmpl-support-test",
      model: "gpt-4o-mini-2024-07-18",
      choices: [{
        message: {
          content: JSON.stringify({
            intent: "technical_issue",
            answer: "Hello from AI",
            confidence: 0.95,
            needsHuman: false,
            escalationReason: "none",
            ...overrides,
          }),
        },
      }],
    }),
  };
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
  const assignSupportConversation = vi.mocked(db.assignSupportConversation);
  const getUserById = vi.mocked(db.getUserById);
  const setNeedsHuman = vi.mocked(db.setNeedsHuman);
  const createSupportMessage = vi.mocked(db.createSupportMessage);
  const recordSupportAiDecision = vi.mocked(db.recordSupportAiDecision);
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
    assignSupportConversation.mockImplementation(async (input) => ({
      id: input.conversationId,
      assignedTo: input.assignedTo,
    } as any));
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
    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(assignSupportConversation).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      assignedTo: 456,
      actorType: "support",
    }));
  });

  it("lets support staff assign an unassigned conversation to themselves", async () => {
    getSupportConversation.mockResolvedValue({ id: 10, assignedTo: null } as any);
    getUserById.mockResolvedValue({ id: 456, isStaff: true } as any);

    await createSupportStaffCaller().supportChat.assign({
      conversationId: 10,
      assignedTo: 456,
      reason: "Taking ownership",
    });

    expect(assignSupportConversation).toHaveBeenCalledWith({
      conversationId: 10,
      assignedTo: 456,
      actorType: "support",
      actorId: 456,
      reason: "Taking ownership",
    });
  });

  it("prevents support staff from assigning a conversation to another user", async () => {
    getSupportConversation.mockResolvedValue({ id: 10, assignedTo: null } as any);

    await expect(createSupportStaffCaller().supportChat.assign({
      conversationId: 10,
      assignedTo: 789,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(assignSupportConversation).not.toHaveBeenCalled();
  });

  it("pauses AI when support starts a conversation for a client", async () => {
    const caller = createSupportStaffCaller();
    getUserById.mockResolvedValue({
      id: 123,
      email: "student@example.com",
      name: "Student User",
    } as any);
    createSupportMessage.mockResolvedValue({
      id: 89,
      conversationId: 10,
      senderType: "support",
      content: "We are following up on your case.",
    } as any);

    await caller.supportChat.startConversationForUser({
      userId: 123,
      content: "We are following up on your case.",
    });

    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 123,
      actionUrl: "/support",
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

    const fetchMock = vi.fn().mockResolvedValue(supportAiResponse());
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
    expect(parsedBody.messages?.[0]?.content).toContain("Rawan is the founder");
    expect(parsedBody.messages?.[0]?.content).toContain("Birzeit University");
    expect(parsedBody.messages?.[0]?.content).toContain("Course access included with an activated package is permanent");
    expect(parsedBody.messages?.[0]?.content).toContain("duration of LexAI and Recommendations is configured");
    expect(parsedBody.messages?.[0]?.content).toContain("eight learning levels with checkpoint quizzes");
    expect(parsedBody.messages?.[0]?.content).toContain("Start with one concrete self-service step");
    expect(parsedBody.messages?.[0]?.content).toContain('Arabic phrases such as "حجز الأرباح"');
    expect(parsedBody.messages?.[0]?.content).toContain("Never invent a dashboard page, button, or workflow");
    expect(parsedBody.messages?.[0]?.content).toContain('escalationReason must be "none" exactly when needsHuman=false');
    expect(parsedBody.temperature).toBe(0.2);
    expect(parsedBody.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "support_ai_reply",
        strict: true,
      },
    });
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, {
      conversationId: 10,
      senderId: 0,
      senderType: "bot",
      content: "Hello from AI",
    });
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      userId: 123,
      actionType: "support_auto_reply",
      decisionSource: "openai",
      providerRequestId: "chatcmpl-support-test",
      model: "gpt-4o-mini-2024-07-18",
      intent: "technical_issue",
      confidence: 0.95,
      needsHuman: false,
      escalationReason: "none",
      validationOutcome: "valid",
      validationIssue: null,
    }));
    expect(recordSupportAiDecision.mock.calls[0]?.[0]).not.toHaveProperty("content");
    expect(notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it("sends the latest support context chronologically and keeps previous AI replies", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn().mockResolvedValue(supportAiResponse({
      answer: "Try the updated step",
    }));
    vi.stubGlobal("fetch", fetchMock);

    createSupportMessage
      .mockResolvedValueOnce({ id: 80, conversationId: 10, content: "It still fails" } as any)
      .mockResolvedValueOnce({ id: 81, conversationId: 10, content: "Try the updated step" } as any);
    // Database order is newest-first.
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "It still fails" },
      { senderType: "bot", content: "Please clear your browser cache" },
      { senderType: "client", content: "The video does not load" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "It still fails" });

    const parsedBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(parsedBody.messages.slice(1)).toEqual([
      { role: "user", content: "The video does not load" },
      { role: "assistant", content: "Please clear your browser cache" },
      { role: "user", content: "It still fails" },
    ]);
  });

  it("does not mistake a reference to the support team for a human request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn().mockResolvedValue(supportAiResponse());
    vi.stubGlobal("fetch", fetchMock);
    createSupportMessage
      .mockResolvedValueOnce({ id: 82, conversationId: 10, content: "I contacted the support team yesterday" } as any)
      .mockResolvedValueOnce({ id: 83, conversationId: 10, content: "Hello from AI" } as any);
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "I contacted the support team yesterday" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "I contacted the support team yesterday" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(setNeedsHuman).not.toHaveBeenCalled();
  });

  it("notifies staff when the structured AI decision has low confidence", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supportAiResponse({
      confidence: 0.55,
      answer: "Please share the lesson number.",
    })));
    createSupportMessage
      .mockResolvedValueOnce({ id: 84, conversationId: 10, content: "It is broken" } as any)
      .mockResolvedValueOnce({ id: 85, conversationId: 10, content: "Please share the lesson number." } as any);
    getSupportMessages
      .mockResolvedValueOnce([{ senderType: "client", content: "It is broken" }] as any)
      .mockResolvedValueOnce([{ senderType: "client", content: "It is broken", deletedAt: null }] as any);

    await createAuthedCaller().supportChat.send({ content: "It is broken" });

    expect(notifyStaffByEvent).toHaveBeenCalledWith(
      "new_support_message",
      expect.objectContaining({ metadata: { userId: 123, conversationId: 10 } }),
    );
  });

  it("escalates when the structured AI decision requires account review", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supportAiResponse({
      intent: "activation_key",
      answer: "A team member needs to verify your activation key.",
      confidence: 0.92,
      needsHuman: true,
      escalationReason: "account_data_required",
    })));
    createSupportMessage
      .mockResolvedValueOnce({ id: 86, conversationId: 10, content: "Why is my key expired?" } as any)
      .mockResolvedValueOnce({ id: 87, conversationId: 10, content: "A team member needs to verify your activation key." } as any);
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "Why is my key expired?" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "Why is my key expired?" });

    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(notifyStaffByEvent).toHaveBeenCalledTimes(1);
    expect(notifyStaffByEvent).toHaveBeenCalledWith(
      "human_escalation",
      expect.objectContaining({ metadata: { userId: 123, conversationId: 10 } }),
    );
  });

  it("deterministically escalates a repeated notification failure without asking AI again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    createSupportMessage
      .mockResolvedValueOnce({ id: 90, conversationId: 10, content: "الرسائل مش موجودة بالسبام كمان" } as any)
      .mockResolvedValueOnce({ id: 91, conversationId: 10, senderType: "bot" } as any);
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "الرسائل مش موجودة بالسبام كمان" },
      { senderType: "bot", content: "يرجى التحقق من مجلد السبام في البريد ومن إعدادات الإشعارات" },
      { senderType: "client", content: "لا تصلني إشعارات البريد" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "الرسائل مش موجودة بالسبام كمان" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      conversationId: 10,
      senderType: "bot",
      content: expect.stringContaining("حوّلت المحادثة الآن لفريق الدعم"),
    }));
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      decisionSource: "local_rule",
      intent: "notifications",
      needsHuman: true,
      escalationReason: "repeated_failed_step",
      validationIssue: "deterministic_repeated_notification_failure",
    }));
    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(notifyStaffByEvent).toHaveBeenCalledWith("human_escalation", expect.objectContaining({
      actionUrl: "/admin/support?conversationId=10",
    }));
  });

  it("keeps a first notification complaint in the normal AI flow", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    const fetchMock = vi.fn().mockResolvedValue(supportAiResponse({ intent: "notifications" }));
    vi.stubGlobal("fetch", fetchMock);
    createSupportMessage
      .mockResolvedValueOnce({ id: 92, conversationId: 10, content: "I am not receiving email notifications" } as any)
      .mockResolvedValueOnce({ id: 93, conversationId: 10, content: "Hello from AI" } as any);
    getSupportMessages.mockResolvedValue([
      { senderType: "client", content: "I am not receiving email notifications" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "I am not receiving email notifications" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      decisionSource: "openai",
      intent: "notifications",
      needsHuman: false,
    }));
  });

  it("normalizes needsHuman=true with reason=none before escalating", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supportAiResponse({
      intent: "other",
      answer: "هل تقصد سحب الأرباح من الوسيط أم شيئاً آخر؟",
      confidence: 0.73,
      needsHuman: true,
      escalationReason: "none",
    })));
    createSupportMessage
      .mockResolvedValueOnce({ id: 92, conversationId: 10, content: "للارباح" } as any)
      .mockResolvedValueOnce({ id: 93, conversationId: 10, content: "هل تقصد سحب الأرباح من الوسيط أم شيئاً آخر؟" } as any);
    getSupportMessages.mockResolvedValue([
      { id: 92, senderType: "client", content: "للارباح" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "للارباح" });

    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(notifyStaffByEvent).toHaveBeenCalledWith(
      "human_escalation",
      expect.objectContaining({
        contentEn: expect.stringContaining("low_confidence"),
        metadata: { userId: 123, conversationId: 10 },
      }),
    );
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 10,
      triggerMessageId: 92,
      botMessageId: 93,
      needsHuman: true,
      escalationReason: "low_confidence",
      validationOutcome: "normalized",
      validationIssue: "needs_human_with_none_reason",
    }));
  });

  it("honors a non-none human reason when the AI boolean contradicts it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supportAiResponse({
      intent: "activation_key",
      answer: "A team member must verify the account data.",
      confidence: 0.91,
      needsHuman: false,
      escalationReason: "account_data_required",
    })));
    createSupportMessage
      .mockResolvedValueOnce({ id: 94, conversationId: 10, content: "My key is wrong" } as any)
      .mockResolvedValueOnce({ id: 95, conversationId: 10, content: "A team member must verify the account data." } as any);
    getSupportMessages.mockResolvedValue([
      { id: 94, senderType: "client", content: "My key is wrong" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "My key is wrong" });

    expect(setNeedsHuman).toHaveBeenCalledWith(10, true);
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      needsHuman: true,
      escalationReason: "account_data_required",
      validationOutcome: "normalized",
      validationIssue: "non_none_reason_without_needs_human",
    }));
  });

  it("keeps an ambiguous Arabic profit question in AI clarification flow", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supportAiResponse({
      intent: "other",
      answer: "هل تقصد سحب الأرباح من حساب الوسيط، أم إغلاق صفقة رابحة، أم ميزة داخل الأكاديمية؟",
      confidence: 0.9,
      needsHuman: false,
      escalationReason: "none",
    })));
    createSupportMessage
      .mockResolvedValueOnce({ id: 96, conversationId: 10, content: "كيف اعمل حجز للارباح" } as any)
      .mockResolvedValueOnce({ id: 97, conversationId: 10, content: "clarification" } as any);
    getSupportMessages.mockResolvedValue([
      { id: 96, senderType: "client", content: "كيف اعمل حجز للارباح" },
    ] as any);

    await createAuthedCaller().supportChat.send({ content: "كيف اعمل حجز للارباح" });

    expect(setNeedsHuman).not.toHaveBeenCalled();
    expect(notifyStaffByEvent).not.toHaveBeenCalled();
    expect(createSupportMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      senderType: "bot",
      content: expect.stringContaining("هل تقصد"),
    }));
    expect(recordSupportAiDecision).toHaveBeenCalledWith(expect.objectContaining({
      intent: "other",
      needsHuman: false,
      escalationReason: "none",
      validationOutcome: "valid",
    }));
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
