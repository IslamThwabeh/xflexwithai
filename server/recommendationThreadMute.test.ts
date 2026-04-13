import { describe, expect, it } from "vitest";

import {
  filterRecipientsByMutedThreads,
  getRecommendationThreadRootId,
} from "../backend/services/recommendation-thread.service";

describe("recommendation thread mute helpers", () => {
  it("uses the recommendation id as the root thread id for top-level messages", () => {
    expect(getRecommendationThreadRootId({ messageId: 42, parentId: null })).toBe(42);
  });

  it("uses the parent recommendation id as the root thread id for follow-ups", () => {
    expect(getRecommendationThreadRootId({ messageId: 99, parentId: 42 })).toBe(42);
  });

  it("filters out recipients who muted the thread", () => {
    const recipients = [
      { userId: 1, email: "one@example.com" },
      { userId: 2, email: "two@example.com" },
      { userId: 3, email: "three@example.com" },
    ];

    expect(filterRecipientsByMutedThreads(recipients, [2])).toEqual([
      { userId: 1, email: "one@example.com" },
      { userId: 3, email: "three@example.com" },
    ]);
  });

  it("keeps all recipients when nobody muted the thread", () => {
    const recipients = [
      { userId: 1, email: "one@example.com" },
      { userId: 2, email: "two@example.com" },
    ];

    expect(filterRecipientsByMutedThreads(recipients, [])).toEqual(recipients);
  });
});