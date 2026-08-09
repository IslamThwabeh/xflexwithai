import { describe, expect, it } from "vitest";

import {
  MAX_STUDENT_SURVEY_CHOICE_OPTIONS,
  isStudentSurveyChoiceQuestionType,
  validateStudentSurveyChoiceOptions,
} from "../shared/studentSurveyQuestionOptions";

describe("student survey choice options", () => {
  it("requires at least two completed options", () => {
    expect(validateStudentSurveyChoiceOptions([])).toMatchObject({
      valid: false,
      error: "minimum",
    });
    expect(validateStudentSurveyChoiceOptions(["Yes", ""])).toMatchObject({
      valid: false,
      error: "minimum",
    });
  });

  it("trims valid options before they are saved", () => {
    expect(validateStudentSurveyChoiceOptions(["  Yes ", " No  "])).toEqual({
      valid: true,
      error: null,
      options: ["Yes", "No"],
    });
  });

  it("requires every added option field to be completed", () => {
    expect(validateStudentSurveyChoiceOptions(["Yes", "No", "  "])).toMatchObject({
      valid: false,
      error: "empty",
    });
  });

  it("rejects duplicate options after case and Unicode normalization", () => {
    expect(validateStudentSurveyChoiceOptions(["Yes", " yes "])).toMatchObject({
      valid: false,
      error: "duplicate",
    });
    expect(validateStudentSurveyChoiceOptions(["Ａ", "A"])).toMatchObject({
      valid: false,
      error: "duplicate",
    });
  });

  it("enforces the option limit and recognizes both choice question types", () => {
    const tooManyOptions = Array.from(
      { length: MAX_STUDENT_SURVEY_CHOICE_OPTIONS + 1 },
      (_, index) => `Option ${index + 1}`
    );
    expect(validateStudentSurveyChoiceOptions(tooManyOptions)).toMatchObject({
      valid: false,
      error: "too_many",
    });
    expect(isStudentSurveyChoiceQuestionType("single_choice")).toBe(true);
    expect(isStudentSurveyChoiceQuestionType("multiple_choice")).toBe(true);
    expect(isStudentSurveyChoiceQuestionType("short_text")).toBe(false);
  });
});
