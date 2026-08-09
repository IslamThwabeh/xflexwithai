import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STUDENT_SURVEY_REFERENCE_PATTERN,
  generateStudentSurveyReference,
  getStudentSurveyCreateErrorMessage,
  isValidStudentSurveyReference,
} from "../frontend/src/lib/studentSurveyReference";

const surveyPageSource = readFileSync(
  new URL("../frontend/src/pages/AdminStudentSurveys.tsx", import.meta.url),
  "utf8",
);

describe("student survey automatic references", () => {
  it("generates a short API-safe reference without depending on the Arabic title", () => {
    const reference = generateStudentSurveyReference(1_786_292_800_000, "AB-CD_1234");

    expect(reference).toMatch(STUDENT_SURVEY_REFERENCE_PATTERN);
    expect(reference).toBe("survey-msm0m1og-abcd1234");
    expect(reference.length).toBeLessThanOrEqual(80);
    expect(isValidStudentSurveyReference(reference)).toBe(true);
    expect(isValidStudentSurveyReference("استبيان-تجريبي")).toBe(false);
  });

  it("replaces raw reference validation payloads with helpful localized copy", () => {
    const rawError = '[{"origin":"string","code":"invalid_format","format":"regex","path":["code"],"message":"Invalid string: must match pattern"}]';

    expect(getStudentSurveyCreateErrorMessage(rawError, true)).toContain("المرجع الداخلي");
    expect(getStudentSurveyCreateErrorMessage(rawError, true)).not.toContain("invalid_format");
    expect(getStudentSurveyCreateErrorMessage(rawError, false)).toContain("internal reference");
  });

  it("keeps normal server messages intact", () => {
    expect(getStudentSurveyCreateErrorMessage("Database unavailable", true))
      .toBe("Database unavailable");
  });

  it("makes the generated reference read-only in the admin form", () => {
    expect(surveyPageSource).toContain("setSurveyForm(newSurveyForm())");
    expect(surveyPageSource).toContain("readOnly");
    expect(surveyPageSource).toContain("copy.automaticReferenceHelp");
    expect(surveyPageSource).not.toContain("event.target.value.replace(/\\s+/g");
  });
});
