import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  parseSupportInboxSearch,
  SUPPORT_INBOX_IDENTITY_SEARCH_MIN_LENGTH,
  SUPPORT_INBOX_MESSAGE_SEARCH_MIN_LENGTH,
} from "../backend/db";

const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const adminSupportSource = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/AdminSupport.tsx", import.meta.url)),
  "utf8",
);

describe("support inbox search D1 safeguards", () => {
  it("keeps ordinary support inbox searches on client identity fields", () => {
    const parsed = parseSupportInboxSearch("Client@example.com");

    expect(SUPPORT_INBOX_IDENTITY_SEARCH_MIN_LENGTH).toBe(2);
    expect(parsed).toMatchObject({
      kind: "identity",
      term: "client@example.com",
      pattern: "%client@example.com%",
    });
  });

  it("requires an explicit message-search prefix and longer term for message body search", () => {
    expect(SUPPORT_INBOX_MESSAGE_SEARCH_MIN_LENGTH).toBe(4);

    expect(parseSupportInboxSearch("msg: invoice issue")).toMatchObject({
      kind: "message",
      term: "invoice issue",
      pattern: "%invoice issue%",
    });
    expect(parseSupportInboxSearch("message: withdrawal")).toMatchObject({
      kind: "message",
      term: "withdrawal",
      pattern: "%withdrawal%",
    });
    expect(parseSupportInboxSearch("msg: abc")).toEqual({
      kind: "no_match",
      reason: "too_short",
    });
  });

  it("escapes LIKE wildcards so user input cannot become an unbounded wildcard", () => {
    expect(parseSupportInboxSearch("%_")).toEqual({
      kind: "identity",
      term: "%_",
      pattern: "%\\%\\_%",
    });
    expect(parseSupportInboxSearch("msg: 100%_ok")).toMatchObject({
      kind: "message",
      pattern: "%100\\%\\_ok%",
    });
  });

  it("does not include supportMessages content scans in identity search SQL", () => {
    const identitySection = backendSource.slice(
      backendSource.indexOf('if (searchSpec.kind === "identity")'),
      backendSource.indexOf("const messageCutoff"),
    );
    const messageSection = backendSource.slice(
      backendSource.indexOf("const messageCutoff"),
      backendSource.indexOf("const pageFilters"),
    );

    expect(identitySection).toContain("lower(COALESCE(u.name, ''))");
    expect(identitySection).toContain("lower(COALESCE(u.email, ''))");
    expect(identitySection).not.toContain("supportMessages AS search_message");
    expect(messageSection).toContain("supportMessages AS search_message");
    expect(messageSection).toContain("SUPPORT_INBOX_MESSAGE_SEARCH_DAYS");
  });

  it("keeps the admin support UI in an explicit search mode and avoids focus refetch for manual searches", () => {
    expect(adminSupportSource).toContain('const [searchMode, setSearchMode] = useState<"client" | "message">("client")');
    expect(adminSupportSource).toContain("searchMode === \"message\"");
    expect(adminSupportSource).toContain("`msg:${trimmedDebouncedSearch}`");
    expect(adminSupportSource).toContain("refetchInterval: isPageVisible && !hasActiveInboxSearch ? 60_000 : false");
    expect(adminSupportSource).toContain("refetchOnWindowFocus: !hasActiveInboxSearch");
    expect(adminSupportSource).toContain("if (!hasActiveInboxSearch) void refetchConvs();");
  });
});
