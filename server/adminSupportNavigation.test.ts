import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_SUPPORT_INBOX_PATH,
  getAdminSupportConversationId,
  getAdminSupportConversationPath,
  getAdminSupportDraftKey,
} from "../frontend/src/lib/adminSupportNavigation";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/AdminSupport.tsx"),
  "utf8"
);

describe("admin support conversation navigation", () => {
  it("treats the inbox and conversation URL as distinct UI states", () => {
    expect(ADMIN_SUPPORT_INBOX_PATH).toBe("/admin/support");
    expect(getAdminSupportConversationPath(123)).toBe(
      "/admin/support?conversationId=123"
    );
    expect(getAdminSupportConversationId("?conversationId=123")).toBe(123);
    expect(getAdminSupportConversationId("")).toBeNull();
    expect(getAdminSupportConversationId("?conversationId=0")).toBeNull();
    expect(getAdminSupportConversationId("?conversationId=12.5")).toBeNull();
    expect(getAdminSupportConversationId("?conversationId=1e3")).toBeNull();
    expect(getAdminSupportConversationId("?conversationId=invalid")).toBeNull();
  });

  it("uses isolated per-conversation drafts", () => {
    expect(getAdminSupportDraftKey(12)).toBe("admin-support-draft:12");
    expect(getAdminSupportDraftKey(13)).not.toBe(getAdminSupportDraftKey(12));
  });

  it("keeps the chat controls fixed while only messages and a bounded composer scroll", () => {
    expect(source).toContain("h-[calc(100dvh-6rem)]");
    expect(source).toContain(
      "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3"
    );
    expect(source).toContain(
      "max-h-[45dvh] shrink-0 overflow-y-auto overscroll-contain border-t"
    );
    expect(source).toContain("العودة إلى المحادثات");
    expect(source).not.toContain('style={{ minHeight: "600px" }}');
    expect(source).not.toContain("window.history.replaceState");
  });
});
