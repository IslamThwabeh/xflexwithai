import { describe, expect, it, vi } from "vitest";
import {
  findCommunityPolicyMatch,
  isHighRiskCommunityModerationDecision,
  moderateStudentCommunitySubmission,
  normalizeCommunityPolicyText,
} from "../backend/services/student-community-moderation.service";

describe("student community pre-publication moderation", () => {
  it("classifies threatening and severe safety categories as high risk", () => {
    expect(isHighRiskCommunityModerationDecision({
      flaggedCategories: ["violence"],
    })).toBe(true);
    expect(isHighRiskCommunityModerationDecision({
      flaggedCategories: ["harassment/threatening"],
    })).toBe(true);
    expect(isHighRiskCommunityModerationDecision({
      flaggedCategories: ["harassment"],
    })).toBe(false);
  });

  it("normalizes Arabic variants, punctuation, case, and spacing", () => {
    expect(normalizeCommunityPolicyText("  شَـرِكَةُ أَلِف!!  ")).toBe("شركه الف");
    expect(normalizeCommunityPolicyText("Example-BROKER.com")).toBe("example broker com");
  });

  it("matches complete normalized competitor phrases without substring false positives", () => {
    const terms = [{
      id: 4,
      term: "Example Broker",
      normalizedTerm: "example broker",
      category: "competitor" as const,
    }];

    expect(findCommunityPolicyMatch("Try EXAMPLE-broker today", terms)?.id).toBe(4);
    expect(findCommunityPolicyMatch("example brokerage is a generic phrase", terms)).toBeNull();
  });

  it("blocks a competitor match before calling OpenAI", async () => {
    const invokeModeration = vi.fn();
    await expect(moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "post",
      content: "Visit Example Broker",
      policyTerms: [{
        id: 4,
        term: "Example Broker",
        normalizedTerm: "example broker",
        category: "competitor",
      }],
      invokeModeration,
    })).resolves.toMatchObject({
      outcome: "blocked_policy",
      reasonCode: "competitor_reference",
      matchedPolicyTermId: 4,
    });
    expect(invokeModeration).not.toHaveBeenCalled();
  });

  it("blocks prohibited language before calling OpenAI", async () => {
    const invokeModeration = vi.fn();
    await expect(moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "comment",
      content: "This includes qa-badword in the sentence",
      policyTerms: [{
        id: 8,
        term: "qa badword",
        normalizedTerm: "qa badword",
        category: "prohibited_language",
      }],
      invokeModeration,
    })).resolves.toMatchObject({
      outcome: "blocked_policy",
      reasonCode: "prohibited_language",
      matchedPolicyTermId: 8,
    });
    expect(invokeModeration).not.toHaveBeenCalled();
  });

  it("allows only an explicit unflagged OpenAI moderation result", async () => {
    const decision = await moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "comment",
      content: "A respectful learning comment",
      policyTerms: [],
      invokeModeration: vi.fn().mockResolvedValue({
        id: "modr-allowed",
        model: "omni-moderation-latest",
        results: [{
          flagged: false,
          categories: { harassment: false },
          category_scores: { harassment: 0.001 },
        }],
      }),
    });

    expect(decision).toMatchObject({
      outcome: "allowed",
      reasonCode: "approved",
      requestId: "modr-allowed",
      flaggedCategories: [],
    });
  });

  it("records flagged categories and fails closed on API errors or malformed results", async () => {
    const flagged = await moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "post",
      content: "Unsafe content",
      policyTerms: [],
      invokeModeration: vi.fn().mockResolvedValue({
        id: "modr-blocked",
        model: "omni-moderation-latest",
        results: [{
          flagged: true,
          categories: { violence: true, harassment: false },
          category_scores: { violence: 0.99, harassment: 0.02 },
        }],
      }),
    });
    expect(flagged).toMatchObject({
      outcome: "blocked_openai",
      reasonCode: "openai_flagged",
      flaggedCategories: ["violence"],
    });

    const unavailable = await moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "comment",
      content: "Content pending a safety check",
      policyTerms: [],
      invokeModeration: vi.fn().mockRejectedValue(new Error("network unavailable")),
    });
    expect(unavailable).toMatchObject({
      outcome: "error",
      reasonCode: "openai_unavailable",
    });

    const malformed = await moderateStudentCommunitySubmission({
      userId: 9,
      contentType: "comment",
      content: "Content with no result",
      policyTerms: [],
      invokeModeration: vi.fn().mockResolvedValue({ results: [] }),
    });
    expect(malformed).toMatchObject({
      outcome: "error",
      reasonCode: "openai_unavailable",
    });
  });
});
