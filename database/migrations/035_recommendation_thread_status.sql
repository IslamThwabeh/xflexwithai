ALTER TABLE recommendationMessages ADD COLUMN threadStatus TEXT;
ALTER TABLE recommendationMessages ADD COLUMN closedAt TEXT;
ALTER TABLE recommendationMessages ADD COLUMN closedByUserId INTEGER;

UPDATE recommendationMessages
SET threadStatus = 'open'
WHERE parentId IS NULL
  AND type = 'recommendation'
  AND (threadStatus IS NULL OR threadStatus = '');

CREATE INDEX idx_recommendation_messages_thread_status
  ON recommendationMessages (threadStatus, createdAt);