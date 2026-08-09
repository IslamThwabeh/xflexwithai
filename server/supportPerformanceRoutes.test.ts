import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    getSupportInboxPage: vi.fn(),
    getOrCreateSupportConversation: vi.fn(),
    getSupportConversation: vi.fn(),
    getUserById: vi.fn(),
    markClientMessagesRead: vi.fn(),
    markSupportMessagesRead: vi.fn(),
    getSupportMessageHistory: vi.fn(),
    getSupportMessageChanges: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createStaffCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/supportChat" },
    user: {
      id: 9,
      email: "admin@example.com",
      passwordHash: "",
      name: "Admin",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: false,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

function createStudentCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/supportChat" },
    user: {
      id: 44,
      email: "student@example.com",
      passwordHash: "",
      name: "Student",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: false,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("support performance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.getOrCreateSupportConversation).mockResolvedValue({
      id: 12,
      userId: 44,
      status: "open",
      needsHuman: false,
    } as any);
    vi.mocked(db.getSupportConversation).mockResolvedValue({
      id: 12,
      userId: 44,
      status: "open",
    } as any);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 44,
      name: "Client",
      email: "client@example.com",
    } as any);
    vi.mocked(db.markSupportMessagesRead).mockResolvedValue(undefined);
    vi.mocked(db.markClientMessagesRead).mockResolvedValue(undefined);
  });

  it("loads only the newest 50 messages for the student and returns an older-history cursor", async () => {
    const nextCursor = { createdAt: "2026-06-01T10:00:00.000Z", id: 501 };
    vi.mocked(db.getSupportMessageHistory).mockResolvedValue({
      messages: [{ id: 550, conversationId: 12, senderType: "support" }] as any,
      nextCursor,
    });

    const result = await createStudentCaller().supportChat.myConversation();

    expect(db.getSupportMessageHistory).toHaveBeenCalledWith({
      conversationId: 12,
      limit: 50,
    });
    expect(db.markClientMessagesRead).toHaveBeenCalledWith(12);
    expect(result.nextCursor).toEqual(nextCursor);
    expect(result.messages).toHaveLength(1);
  });

  it("infers the student's conversation when loading older history", async () => {
    const cursor = { createdAt: "2026-06-01T10:00:00.000Z", id: 501 };
    vi.mocked(db.getSupportMessageHistory).mockResolvedValue({ messages: [], nextCursor: null });

    await createStudentCaller().supportChat.myMessageHistory({ limit: 50, cursor });

    expect(db.getSupportMessageHistory).toHaveBeenCalledWith({
      conversationId: 12,
      limit: 50,
      cursor,
    });
  });

  it("polls only student message changes and marks a new staff reply as read", async () => {
    vi.mocked(db.getSupportMessageChanges).mockResolvedValue([{
      id: 551,
      conversationId: 12,
      senderType: "support",
      isRead: false,
      createdAt: "2026-06-20T10:00:00.000Z",
    }] as any);

    const result = await createStudentCaller().supportChat.myMessageChanges({
      afterMessageId: 550,
      changedAfter: "2026-06-20T09:59:55.000Z",
    });

    expect(db.getSupportMessageChanges).toHaveBeenCalledWith({
      conversationId: 12,
      afterMessageId: 550,
      changedAfter: "2026-06-20T09:59:55.000Z",
    });
    expect(db.markClientMessagesRead).toHaveBeenCalledWith(12);
    expect(result.messages).toHaveLength(1);
  });

  it("uses a bounded 30-row inbox page by default", async () => {
    vi.mocked(db.getSupportInboxPage).mockResolvedValue({
      items: [],
      nextCursor: null,
      aggregates: { total: 0, open: 0, closed: 0, unread: 0, escalated: 0 },
    });

    await createStaffCaller().supportChat.inboxPage({
      limit: 30,
      status: "all",
    });

    expect(db.getSupportInboxPage).toHaveBeenCalledWith({
      limit: 30,
      status: "all",
      search: undefined,
      cursor: undefined,
    });
  });

  it("marks unread messages only when the first history page is opened", async () => {
    vi.mocked(db.getSupportMessageHistory).mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
    const caller = createStaffCaller();

    await caller.supportChat.messageHistory({ conversationId: 12, limit: 50 });
    await caller.supportChat.messageHistory({
      conversationId: 12,
      limit: 50,
      cursor: { createdAt: "2026-06-01T10:00:00.000Z", id: 100 },
    });

    expect(db.markSupportMessagesRead).toHaveBeenCalledTimes(1);
    expect(db.getSupportMessageHistory).toHaveBeenNthCalledWith(1, {
      conversationId: 12,
      limit: 50,
      cursor: undefined,
    });
  });

  it("marks a genuinely new unread client message during incremental polling", async () => {
    vi.mocked(db.getSupportMessageChanges).mockResolvedValue([{
      id: 101,
      conversationId: 12,
      senderType: "client",
      isRead: false,
      createdAt: "2026-06-20T10:00:00.000Z",
    }] as any);

    const result = await createStaffCaller().supportChat.messageChanges({
      conversationId: 12,
      afterMessageId: 100,
      changedAfter: "2026-06-20T09:59:55.000Z",
    });

    expect(result.messages).toHaveLength(1);
    expect(db.markSupportMessagesRead).toHaveBeenCalledWith(12, "support");
  });
});
