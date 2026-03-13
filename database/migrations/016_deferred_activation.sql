-- Deferred activation: student must complete 50% of course + quizzes before 30-day timer starts
-- isPendingActivation = 1 means subscription exists but timer not started yet
-- studentActivatedAt = timestamp when student chose to start their 30 days
-- maxActivationDate = auto-activation deadline (21 days after key redemption)

ALTER TABLE lexaiSubscriptions ADD COLUMN isPendingActivation INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE lexaiSubscriptions ADD COLUMN studentActivatedAt TEXT;
ALTER TABLE lexaiSubscriptions ADD COLUMN maxActivationDate TEXT;

ALTER TABLE recommendationSubscriptions ADD COLUMN isPendingActivation INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE recommendationSubscriptions ADD COLUMN studentActivatedAt TEXT;
ALTER TABLE recommendationSubscriptions ADD COLUMN maxActivationDate TEXT;
