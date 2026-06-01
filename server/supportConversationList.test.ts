import { describe, expect, it } from "vitest";

import {
  getSupportConversationSummaryTimestamp,
  sortSupportConversationSummaries,
} from "../backend/db";

describe("support conversation list shaping", () => {
  it("keeps conversations with messages ahead of empty threads", () => {
    const ordered = sortSupportConversationSummaries([
      {
        id: 1,
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-01T09:00:00.000Z",
        needsHuman: false,
        lastMessage: null,
      },
      {
        id: 2,
        createdAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        needsHuman: false,
        lastMessage: { createdAt: "2026-06-01T10:00:00.000Z" },
      },
      {
        id: 3,
        createdAt: "2026-06-01T07:00:00.000Z",
        updatedAt: "2026-06-01T09:30:00.000Z",
        needsHuman: true,
        lastMessage: { createdAt: "2026-06-01T09:30:00.000Z" },
      },
    ]);

    expect(ordered.map((conversation) => conversation.id)).toEqual([3, 2, 1]);
  });

  it("returns no summary timestamp for empty legacy threads", () => {
    expect(
      getSupportConversationSummaryTimestamp({
        lastMessage: null,
      }),
    ).toBeNull();

    expect(
      getSupportConversationSummaryTimestamp({
        lastMessage: { createdAt: "CURRENT_TIMESTAMP" },
      }),
    ).toBeNull();
  });
});