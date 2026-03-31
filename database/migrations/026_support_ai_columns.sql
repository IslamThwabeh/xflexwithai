-- Add needsHuman flag to supportConversations for human escalation
ALTER TABLE supportConversations ADD COLUMN needsHuman INTEGER NOT NULL DEFAULT 0;
