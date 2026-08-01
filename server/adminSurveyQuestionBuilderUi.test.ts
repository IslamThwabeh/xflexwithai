import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../frontend/src/pages/AdminStudentSurveys.tsx", import.meta.url),
  "utf8"
);

describe("admin survey question builder UI", () => {
  it("starts choice questions with two explicit option fields", () => {
    expect(source).toContain('options: ["", ""]');
    expect(source).toContain("optionFields.map");
    expect(source).toContain("Add another option");
    expect(source).toContain("إضافة خيار آخر");
  });

  it("validates choice options before enabling or sending the question", () => {
    expect(source).toContain("validateStudentSurveyChoiceOptions");
    expect(source).toContain("getChoiceQuestionCopy(isRtl).errors[validation.error]");
    expect(source).toContain("isChoiceQuestion && !choiceValidation.valid");
    expect(source).toContain("Each option must be different from the others.");
  });

  it("keeps option editing accessible and bounded", () => {
    expect(source).toContain("MAX_STUDENT_SURVEY_CHOICE_OPTIONS");
    expect(source).toContain("survey-choice-options-status");
    expect(source).toContain("aria-invalid={!choiceValidation.valid}");
    expect(source).toContain("choiceCopy.removeOption(index + 1)");
  });
});
