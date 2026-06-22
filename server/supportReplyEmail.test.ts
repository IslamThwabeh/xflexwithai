import { describe, expect, it } from "vitest";
import { buildSupportReplyEmail } from "../backend/_core/supportEmails";

describe("support reply email", () => {
  it("includes the human reply, support link, and bilingual notification", () => {
    const result = buildSupportReplyEmail({
      clientName: "Ayah",
      replyContent: "We reviewed your account and restored access.",
      hasAttachment: true,
    });

    expect(result.subject).toContain("New reply");
    expect(result.text).toContain("We reviewed your account and restored access.");
    expect(result.text).toContain("https://xflexacademy.com/support");
    expect(result.text).toContain("يتضمن الرد مرفقاً");
    expect(result.html).toContain("Open support conversation");
  });

  it("escapes client names and support content in HTML", () => {
    const result = buildSupportReplyEmail({
      clientName: "<Ayah>",
      replyContent: "<script>alert('x')</script>",
    });

    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&lt;Ayah&gt;");
  });
});
