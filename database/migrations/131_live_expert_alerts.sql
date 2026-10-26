-- Existing messages are already handled: this rollout sends no historical alerts.
ALTER TABLE live_expert_messages ADD COLUMN alerts_enqueued INTEGER NOT NULL DEFAULT 1 CHECK (alerts_enqueued IN (0,1));

INSERT OR IGNORE INTO schema_migrations (migration_name, source, notes)
VALUES ('131_live_expert_alerts.sql', 'codex', 'Atomic Live Expert email and bell alerts for new messages only; existing messages remain handled.');
