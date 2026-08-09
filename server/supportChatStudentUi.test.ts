import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "frontend/src/pages/SupportChat.tsx"),
  "utf8",
);

describe("student support chat long-history layout", () => {
  it("uses bounded cursor history and incremental message polling", () => {
    expect(source).toContain("supportChat.myMessageHistory.query");
    expect(source).toContain("supportChat.myMessageChanges.useQuery");
    expect(source).toContain("Load previous messages");
    expect(source).toContain("New messages");
  });

  it("keeps one bounded message scroller and an in-flow composer", () => {
    expect(source).toContain("h-[calc(100dvh-5rem)]");
    expect(source).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
    expect(source).toContain("h-full space-y-3 overflow-y-auto overscroll-contain");
    expect(source).toContain("max-h-[45dvh] shrink-0 overflow-y-auto border-t");
    expect(source).not.toContain("messagesEndRef.current?.scrollIntoView");
    expect(source).not.toContain("space-y-3 pb-56 md:pb-48");
    expect(source).not.toContain("fixed bottom-0 left-0 right-0 z-40 border-t");
  });
});
