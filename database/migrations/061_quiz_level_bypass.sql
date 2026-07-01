-- Additive only: allows a student-confirmed level quiz bypass without marking the quiz as passed.
ALTER TABLE user_quiz_progress ADD COLUMN is_bypassed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_quiz_progress ADD COLUMN bypassed_at TEXT;
