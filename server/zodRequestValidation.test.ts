import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { appRouter } from "../backend/routers";
import { MAX_STUDENT_SURVEY_BULK_RECIPIENTS } from "../backend/services/student-surveys.service";

// Exercise the actual registered API schemas without invoking mutation handlers,
// sending notifications, or reading/writing customer data.
function inputSchema(path: string): z.ZodType {
  const procedures = appRouter._def.procedures as Record<string, { _def: { inputs: z.ZodType[] } }>;
  const inputs = procedures[path]?._def.inputs;
  if (inputs?.length !== 1 || typeof inputs[0].safeParse !== "function") {
    throw new Error(`Expected one Zod input schema for ${path}`);
  }
  return inputs[0];
}

describe("API request validation compatibility", () => {
  it("preserves bilingual registration data and strips unknown input properties", () => {
    const registration = {
      email: "student@example.test", password: "test-password-123", name: "طالب تجريبي",
      phone: "+970599123456", city: "رام الله", country: "Palestine", referralCode: "TEST24",
    };
    expect(inputSchema("auth.register").parse({ ...registration, isAdmin: true })).toEqual(registration);
  });

  it("keeps invalid public registration on tRPC's BAD_REQUEST path", async () => {
    const caller = appRouter.createCaller({
      req: { headers: {}, method: "POST", path: "/api/trpc/auth.register" },
      user: null, setCookie() {}, clearCookie() {},
    } as never);
    await expect(caller.auth.register({
      email: "student@example.test", password: "short", name: "Student",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("continues to accept a valid quiz answer batch", () => {
    const input = { quizId: 7, level: 2, answers: [{ questionId: 10, optionId: "A" }] };
    expect(inputSchema("userQuiz.submit").parse(input)).toEqual(input);
  });

  it("continues to reject an empty quiz answer batch", () => {
    expect(inputSchema("userQuiz.submit").safeParse({ quizId: 7, level: 2, answers: [] }).success).toBe(false);
  });

  it("preserves the existing 100-answer survey boundary, trimming and null values", () => {
    const answers = Array.from({ length: 100 }, (_, index) => ({
      questionId: index + 1, answerText: "  إجابة تجريبية  ", answerJson: null,
    }));
    const result = inputSchema("studentSurveys.submit").parse({ id: 7, answers }) as { answers: typeof answers };
    expect(result.answers).toHaveLength(100);
    expect(result.answers[0]).toEqual({ questionId: 1, answerText: "إجابة تجريبية", answerJson: null });
    expect(inputSchema("studentSurveys.submit").safeParse({ id: 7, answers: [...answers, answers[0]] }).success).toBe(false);
  });

  it("preserves the existing staff survey audience batch capacity", () => {
    const userIds = Array.from({ length: MAX_STUDENT_SURVEY_BULK_RECIPIENTS }, (_, index) => index + 1);
    const input = { surveyId: 3, audience: { mode: "selected", userIds } };
    expect(inputSchema("studentSurveys.previewAudience").parse(input)).toEqual(input);
    expect(inputSchema("studentSurveys.previewAudience").safeParse({
      ...input, audience: { ...input.audience, userIds: [...userIds, userIds.length + 1] },
    }).success).toBe(false);
  });

  it("preserves the single-student audience refinement", () => {
    const result = inputSchema("studentSurveys.previewAudience").safeParse({
      surveyId: 3, audience: { mode: "single", userIds: [1, 2] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "custom", path: ["audience", "userIds"] }),
    ]));
  });

  it("preserves confirmed audience scheduling and blocking-date validation", () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const blockAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const input = {
      surveyId: 3, audience: { mode: "selected", userIds: [1] },
      dueAt, blockAt, expectedRecipientIds: [1], expectedMatchedStudentIds: [1], confirmed: true,
    };
    const schema = inputSchema("studentSurveys.assignAudience");
    expect(schema.parse(input)).toEqual(input);
    const result = schema.safeParse({ ...input, blockAt: dueAt });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "custom", path: ["blockAt"] }),
    ]));
  });

  it("preserves the existing notification batch capacity and optional fields", () => {
    const input = { userIds: Array.from({ length: 1000 }, (_, index) => index + 1), titleAr: "إشعار تجريبي" };
    expect(inputSchema("notifications.send").parse(input)).toEqual(input);
  });

  it("preserves bounded string-keyed records used by staff forms", () => {
    const input = { answers: { test_question: "A bilingual answer / إجابة" } };
    expect(inputSchema("seoOwnerIntake.save").parse(input)).toEqual(input);
    expect(inputSchema("seoOwnerIntake.save").safeParse({ answers: { test_question: "x".repeat(5001) } }).success).toBe(false);
  });
});

describe("Zod collection-size security regression", () => {
  it("rejects an oversized notification recipient array before reading any elements", () => {
    let elementsRead = 0;
    // A small bounded fixture proves early rejection without a resource-exhaustion test.
    const userIds = new Proxy(Array.from({ length: 1001 }, () => "invalid"), {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) elementsRead += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    const result = inputSchema("notifications.send").safeParse({ userIds, titleAr: "إشعار تجريبي" });
    expect(result.success).toBe(false);
    expect(elementsRead).toBe(0);
    if (!result.success) expect(result.error.issues).toEqual([
      expect.objectContaining({ code: "too_big", path: ["userIds"] }),
    ]);
  });

  it("rejects an oversized set before invoking element validation", () => {
    const validateElement = vi.fn(() => true);
    const schema = z.set(z.custom(validateElement)).max(2);
    expect(schema.safeParse(new Set([1, 2, 3])).success).toBe(false);
    expect(validateElement).not.toHaveBeenCalled();
  });

  it("rejects an oversized map before invoking key or value validation", () => {
    const validateElement = vi.fn(() => true);
    const schema = z.map(z.custom(validateElement), z.custom(validateElement)).max(2);
    expect(schema.safeParse(new Map([[1, 1], [2, 2], [3, 3]])).success).toBe(false);
    expect(validateElement).not.toHaveBeenCalled();
  });
});
