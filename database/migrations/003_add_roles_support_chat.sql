-- Migration: Add RBAC user roles and support chat tables
-- Run against D1 via wrangler d1 execute

-- 1. User Roles table
CREATE TABLE IF NOT EXISTS userRoles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  role TEXT(30) NOT NULL,  -- 'analyst' | 'support' | 'key_manager'
  assignedAt TEXT NOT NULL DEFAULT (datetime('now')),
  assignedBy INTEGER,
  UNIQUE(userId, role)
);

-- 2. Support Conversations table
CREATE TABLE IF NOT EXISTS supportConversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  status TEXT(20) NOT NULL DEFAULT 'open',  -- 'open' | 'closed'
  assignedTo INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  closedAt TEXT
);

-- 3. Support Messages table
CREATE TABLE IF NOT EXISTS supportMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversationId INTEGER NOT NULL,
  senderId INTEGER NOT NULL,
  senderType TEXT(20) NOT NULL,  -- 'client' | 'support' | 'admin'
  content TEXT NOT NULL,
  isRead INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_userRoles_userId ON userRoles(userId);
CREATE INDEX IF NOT EXISTS idx_userRoles_role ON userRoles(role);
CREATE INDEX IF NOT EXISTS idx_supportConversations_userId ON supportConversations(userId);
CREATE INDEX IF NOT EXISTS idx_supportConversations_status ON supportConversations(status);
CREATE INDEX IF NOT EXISTS idx_supportMessages_conversationId ON supportMessages(conversationId);
CREATE INDEX IF NOT EXISTS idx_supportMessages_senderId ON supportMessages(senderId);

-- Migrate existing canPublishRecommendations users to analyst role
INSERT OR IGNORE INTO userRoles (userId, role, assignedAt)
SELECT id, 'analyst', datetime('now')
FROM users
WHERE canPublishRecommendations = 1;
