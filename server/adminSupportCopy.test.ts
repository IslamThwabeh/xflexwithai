import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/AdminSupport.tsx"),
  "utf8",
);

describe("admin support message copying", () => {
  it("keeps message text natively selectable", () => {
    expect(source).toContain("data-support-message-text");
    expect(source).toContain("cursor-text select-text text-sm whitespace-pre-wrap break-words");
  });

  it("does not open the touch action menu while selecting message text", () => {
    expect(source).toContain("closest('[data-support-message-text]')");
  });

  it("provides a directly accessible mobile copy action", () => {
    expect(source).toContain("aria-label={isRtl ? 'نسخ الرسالة' : 'Copy message'}");
    expect(source).toContain("lg:hidden");
  });
});
