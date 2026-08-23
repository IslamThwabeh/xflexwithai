-- Repair historical rows created with the literal text CURRENT_TIMESTAMP.
-- Every replacement uses the closest trustworthy timestamp already present on
-- the same record or a directly related record. The migration is idempotent.

UPDATE users
SET updatedAt = COALESCE(
      NULLIF(lastInteractiveAt, 'CURRENT_TIMESTAMP'),
      NULLIF(lastActiveAt, 'CURRENT_TIMESTAMP'),
      NULLIF(lastSignedIn, 'CURRENT_TIMESTAMP'),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updatedAt = 'CURRENT_TIMESTAMP';

UPDATE users
SET lastSignedIn = COALESCE(
      NULLIF(lastActiveAt, 'CURRENT_TIMESTAMP'),
      NULLIF(lastInteractiveAt, 'CURRENT_TIMESTAMP'),
      NULLIF(updatedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE lastSignedIn = 'CURRENT_TIMESTAMP';

UPDATE courses
SET createdAt = COALESCE(NULLIF(updatedAt, 'CURRENT_TIMESTAMP'), datetime('now'))
WHERE createdAt = 'CURRENT_TIMESTAMP';

UPDATE episodes
SET createdAt = COALESCE(
      (SELECT NULLIF(c.createdAt, 'CURRENT_TIMESTAMP') FROM courses c WHERE c.id = episodes.courseId),
      (SELECT NULLIF(c.updatedAt, 'CURRENT_TIMESTAMP') FROM courses c WHERE c.id = episodes.courseId),
      datetime('now')
    )
WHERE createdAt = 'CURRENT_TIMESTAMP';

UPDATE episodes
SET updatedAt = COALESCE(
      (SELECT NULLIF(c.updatedAt, 'CURRENT_TIMESTAMP') FROM courses c WHERE c.id = episodes.courseId),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updatedAt = 'CURRENT_TIMESTAMP';

UPDATE enrollments
SET lastAccessed = COALESCE(NULLIF(enrolledAt, 'CURRENT_TIMESTAMP'), datetime('now'))
WHERE lastAccessed = 'CURRENT_TIMESTAMP';

UPDATE packageSubscriptions
SET createdAt = COALESCE(NULLIF(startDate, 'CURRENT_TIMESTAMP'), datetime('now'))
WHERE createdAt = 'CURRENT_TIMESTAMP';

UPDATE packageSubscriptions
SET updatedAt = COALESCE(
      NULLIF(upgradedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(startDate, 'CURRENT_TIMESTAMP'),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updatedAt = 'CURRENT_TIMESTAMP';

UPDATE lexaiSubscriptions
SET createdAt = COALESCE(NULLIF(startDate, 'CURRENT_TIMESTAMP'), datetime('now'))
WHERE createdAt = 'CURRENT_TIMESTAMP';

UPDATE lexaiSubscriptions
SET updatedAt = COALESCE(
      NULLIF(activationProcessedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(studentActivatedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(pausedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(startDate, 'CURRENT_TIMESTAMP'),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updatedAt = 'CURRENT_TIMESTAMP';

UPDATE recommendationSubscriptions
SET createdAt = COALESCE(NULLIF(startDate, 'CURRENT_TIMESTAMP'), datetime('now'))
WHERE createdAt = 'CURRENT_TIMESTAMP';

UPDATE recommendationSubscriptions
SET updatedAt = COALESCE(
      NULLIF(activationProcessedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(studentActivatedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(pausedAt, 'CURRENT_TIMESTAMP'),
      NULLIF(startDate, 'CURRENT_TIMESTAMP'),
      NULLIF(createdAt, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updatedAt = 'CURRENT_TIMESTAMP';

UPDATE quizzes
SET created_at = COALESCE(
      (SELECT MIN(NULLIF(qa.completed_at, 'CURRENT_TIMESTAMP'))
       FROM quiz_attempts qa WHERE qa.quiz_id = quizzes.id),
      datetime('now')
    )
WHERE created_at = 'CURRENT_TIMESTAMP';

UPDATE quizzes
SET updated_at = COALESCE(
      (SELECT MAX(NULLIF(qa.completed_at, 'CURRENT_TIMESTAMP'))
       FROM quiz_attempts qa WHERE qa.quiz_id = quizzes.id),
      NULLIF(created_at, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updated_at = 'CURRENT_TIMESTAMP';

UPDATE quiz_questions
SET created_at = COALESCE(
      (SELECT NULLIF(q.created_at, 'CURRENT_TIMESTAMP') FROM quizzes q WHERE q.id = quiz_questions.quiz_id),
      datetime('now')
    )
WHERE created_at = 'CURRENT_TIMESTAMP';

UPDATE quiz_questions
SET updated_at = COALESCE(
      (SELECT NULLIF(q.updated_at, 'CURRENT_TIMESTAMP') FROM quizzes q WHERE q.id = quiz_questions.quiz_id),
      NULLIF(created_at, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE updated_at = 'CURRENT_TIMESTAMP';

UPDATE quiz_options
SET created_at = COALESCE(
      (SELECT NULLIF(qq.created_at, 'CURRENT_TIMESTAMP') FROM quiz_questions qq WHERE qq.id = quiz_options.question_id),
      datetime('now')
    )
WHERE created_at = 'CURRENT_TIMESTAMP';

UPDATE quiz_attempts
SET started_at = CASE
      WHEN NULLIF(completed_at, 'CURRENT_TIMESTAMP') IS NOT NULL AND time_taken_seconds IS NOT NULL
        THEN strftime('%Y-%m-%dT%H:%M:%fZ', julianday(completed_at) - (time_taken_seconds / 86400.0))
      ELSE COALESCE(NULLIF(completed_at, 'CURRENT_TIMESTAMP'), datetime('now'))
    END
WHERE started_at = 'CURRENT_TIMESTAMP';

UPDATE quiz_answers
SET created_at = COALESCE(
      (SELECT NULLIF(qa.completed_at, 'CURRENT_TIMESTAMP') FROM quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id),
      datetime('now')
    )
WHERE created_at = 'CURRENT_TIMESTAMP';

UPDATE user_quiz_progress
SET created_at = COALESCE(
      (SELECT MIN(NULLIF(qa.completed_at, 'CURRENT_TIMESTAMP'))
       FROM quiz_attempts qa
       WHERE qa.user_id = user_quiz_progress.user_id
         AND qa.quiz_id = user_quiz_progress.quiz_id),
      NULLIF(last_attempt_at, 'CURRENT_TIMESTAMP'),
      (SELECT NULLIF(u.createdAt, 'CURRENT_TIMESTAMP') FROM users u WHERE u.id = user_quiz_progress.user_id),
      datetime('now')
    )
WHERE created_at = 'CURRENT_TIMESTAMP';

UPDATE job_applications
SET submitted_at = COALESCE(
      NULLIF(updated_at, 'CURRENT_TIMESTAMP'),
      NULLIF(interview_invite_sent_at, 'CURRENT_TIMESTAMP'),
      datetime('now')
    )
WHERE submitted_at = 'CURRENT_TIMESTAMP';

UPDATE job_invite_logs
SET sent_at = COALESCE(
      (SELECT NULLIF(ja.interview_invite_sent_at, 'CURRENT_TIMESTAMP')
       FROM job_applications ja WHERE ja.id = job_invite_logs.application_id),
      (SELECT NULLIF(ja.updated_at, 'CURRENT_TIMESTAMP')
       FROM job_applications ja WHERE ja.id = job_invite_logs.application_id),
      datetime('now')
    )
WHERE sent_at = 'CURRENT_TIMESTAMP';
