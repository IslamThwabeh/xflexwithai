CREATE TABLE IF NOT EXISTS recommendationThreadMutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  threadRootMessageId INTEGER NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_thread_mute_by_user UNIQUE (userId, threadRootMessageId)
);

CREATE INDEX IF NOT EXISTS idx_recommendation_thread_mutes_user
  ON recommendationThreadMutes(userId, threadRootMessageId);

CREATE INDEX IF NOT EXISTS idx_recommendation_thread_mutes_thread
  ON recommendationThreadMutes(threadRootMessageId, userId);