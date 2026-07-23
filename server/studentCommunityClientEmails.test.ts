import { describe, expect, it } from "vitest";
import { buildStudentCommunityClientEmail } from "../backend/_core/communityEmails";

describe("student community client emails", () => {
  it("builds a bilingual reply email with a direct post link", () => {
    const email = buildStudentCommunityClientEmail({
      kind: "reply",
      clientName: "Student",
      postId: 42,
    });

    expect(email.subject).toContain("New community reply");
    expect(email.text).toContain("https://xflexacademy.com/community?postId=42");
    expect(email.html).toContain("https://xflexacademy.com/community?postId=42");
    expect(email.actionUrl).toBe("/community?postId=42");
  });

  it("escapes client-controlled values in HTML", () => {
    const email = buildStudentCommunityClientEmail({
      kind: "access_suspended",
      clientName: "<script>alert(1)</script>",
      reason: "<img src=x onerror=alert(1)>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("never includes reviewed community text in moderation emails", () => {
    const email = buildStudentCommunityClientEmail({
      kind: "content_deleted",
      clientName: "Student",
      contentType: "comment",
      postId: 12,
    });

    expect(email.text).toContain("لا يحتوي هذا البريد على النص محل المراجعة");
    expect(email.text).toContain("The reviewed text is not included");
    expect(email.actionUrl).toBe("/support");
  });
});
