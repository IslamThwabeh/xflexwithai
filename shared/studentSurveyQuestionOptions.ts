export const MIN_STUDENT_SURVEY_CHOICE_OPTIONS = 2;
export const MAX_STUDENT_SURVEY_CHOICE_OPTIONS = 20;

export type StudentSurveyChoiceOptionError =
  | "minimum"
  | "empty"
  | "duplicate"
  | "too_many";

export type StudentSurveyChoiceOptionsValidation =
  | {
      valid: true;
      error: null;
      options: string[];
    }
  | {
      valid: false;
      error: StudentSurveyChoiceOptionError;
      options: string[];
    };

export function isStudentSurveyChoiceQuestionType(questionType: string): boolean {
  return questionType === "single_choice" || questionType === "multiple_choice";
}

export function validateStudentSurveyChoiceOptions(
  options: readonly string[]
): StudentSurveyChoiceOptionsValidation {
  const normalizedOptions = options.map((option) => option.trim());
  const completeOptions = normalizedOptions.filter(Boolean);

  if (normalizedOptions.length > MAX_STUDENT_SURVEY_CHOICE_OPTIONS) {
    return { valid: false, error: "too_many", options: completeOptions };
  }

  if (completeOptions.length < MIN_STUDENT_SURVEY_CHOICE_OPTIONS) {
    return { valid: false, error: "minimum", options: completeOptions };
  }

  if (completeOptions.length !== normalizedOptions.length) {
    return { valid: false, error: "empty", options: completeOptions };
  }

  const comparisonKeys = normalizedOptions.map((option) =>
    option.normalize("NFKC").toLowerCase()
  );
  if (new Set(comparisonKeys).size !== comparisonKeys.length) {
    return { valid: false, error: "duplicate", options: normalizedOptions };
  }

  return { valid: true, error: null, options: normalizedOptions };
}
