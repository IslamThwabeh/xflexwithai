-- Keep every survey's admin review/export complete and bounded. This trigger is
-- evaluated for each row inside the assignment transaction, so concurrent or
-- multi-row writes cannot take a survey above 500 assignments.
CREATE TRIGGER IF NOT EXISTS student_survey_assignment_cap
BEFORE INSERT ON student_survey_assignments
WHEN (
  SELECT COUNT(*)
  FROM student_survey_assignments
  WHERE survey_id = NEW.survey_id
) >= 500
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_ASSIGNMENT_CAP_EXCEEDED');
END;

-- The submitted audit is the first statement in the transactional submission
-- batch. Rejecting it prevents a second concurrent submission from changing
-- answers after the first submission commits.
CREATE TRIGGER IF NOT EXISTS student_survey_submission_audit_guard
BEFORE INSERT ON student_survey_audit_logs
WHEN NEW.entity_type = 'assignment'
  AND NEW.action = 'submitted'
  AND (
    NEW.user_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM student_survey_assignments
      WHERE id = NEW.entity_id
        AND user_id = NEW.user_id
        AND status <> 'submitted'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_SUBMISSION_CONFLICT');
END;

CREATE TRIGGER IF NOT EXISTS student_survey_reminder_audit_guard
BEFORE INSERT ON student_survey_audit_logs
WHEN NEW.entity_type = 'assignment'
  AND NEW.action = 'reminder_sent'
  AND NOT EXISTS (
    SELECT 1
    FROM student_survey_assignments
    WHERE id = NEW.entity_id
      AND user_id = NEW.user_id
      AND status <> 'submitted'
  )
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_REMINDER_CONFLICT');
END;

-- Submitted answers are immutable. Initial submission writes answers before
-- moving the assignment to submitted inside the same transaction.
CREATE TRIGGER IF NOT EXISTS student_survey_submitted_answer_insert_guard
BEFORE INSERT ON student_survey_answers
WHEN EXISTS (
  SELECT 1 FROM student_survey_assignments
  WHERE id = NEW.assignment_id AND status = 'submitted'
)
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_SUBMITTED_ANSWERS_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS student_survey_submitted_answer_update_guard
BEFORE UPDATE ON student_survey_answers
WHEN EXISTS (
  SELECT 1 FROM student_survey_assignments
  WHERE id = OLD.assignment_id AND status = 'submitted'
)
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_SUBMITTED_ANSWERS_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS student_survey_submitted_answer_delete_guard
BEFORE DELETE ON student_survey_answers
WHEN EXISTS (
  SELECT 1 FROM student_survey_assignments
  WHERE id = OLD.assignment_id AND status = 'submitted'
)
BEGIN
  SELECT RAISE(ABORT, 'STUDENT_SURVEY_SUBMITTED_ANSWERS_IMMUTABLE');
END;
