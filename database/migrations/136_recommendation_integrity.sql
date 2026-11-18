-- Additive only. No historical repair, notification seed or customer-data deletion.
ALTER TABLE recommendationMessages ADD COLUMN entryMode TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE recommendationMessages ADD COLUMN cancelledAt TEXT;
ALTER TABLE recommendationMessages ADD COLUMN managementAction TEXT;
ALTER TABLE recommendationMessages ADD COLUMN managementRequestId TEXT;
CREATE UNIQUE INDEX ux_recommendation_management_request ON recommendationMessages(managementRequestId);

CREATE TABLE recommendation_result_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId INTEGER NOT NULL REFERENCES recommendationMessages(id),
  actorUserId INTEGER NOT NULL,
  reason TEXT NOT NULL,
  previousOutcome TEXT,
  previousPips REAL,
  outcome TEXT NOT NULL,
  pips REAL NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX idx_recommendation_result_corrections_message ON recommendation_result_corrections(messageId,id);
CREATE TRIGGER recommendation_no_delete BEFORE DELETE ON recommendationMessages
BEGIN SELECT RAISE(ABORT,'Published recommendation messages cannot be deleted'); END;
CREATE TRIGGER recommendation_original_immutable BEFORE UPDATE OF
  userId,type,content,symbol,side,entryPrice,stopLoss,takeProfit1,takeProfit2,takeProfit3,riskPercent,parentId,createdAt,entryMode,managementAction,managementRequestId
ON recommendationMessages WHEN
  OLD.userId IS NOT NEW.userId OR OLD.type IS NOT NEW.type OR OLD.content IS NOT NEW.content
  OR OLD.symbol IS NOT NEW.symbol OR OLD.side IS NOT NEW.side OR OLD.entryPrice IS NOT NEW.entryPrice
  OR OLD.stopLoss IS NOT NEW.stopLoss OR OLD.takeProfit1 IS NOT NEW.takeProfit1
  OR OLD.takeProfit2 IS NOT NEW.takeProfit2 OR OLD.takeProfit3 IS NOT NEW.takeProfit3
  OR OLD.riskPercent IS NOT NEW.riskPercent OR OLD.parentId IS NOT NEW.parentId
  OR OLD.createdAt IS NOT NEW.createdAt OR OLD.entryMode IS NOT NEW.entryMode
  OR OLD.managementAction IS NOT NEW.managementAction OR OLD.managementRequestId IS NOT NEW.managementRequestId
BEGIN SELECT RAISE(ABORT,'Published messages are immutable; append a clarification'); END;
CREATE TRIGGER recommendation_no_reply_after_cancel BEFORE INSERT ON recommendationMessages
WHEN NEW.parentId IS NOT NULL AND EXISTS (
  SELECT 1 FROM recommendationMessages root WHERE root.id=NEW.parentId AND root.cancelledAt IS NOT NULL
)
BEGIN SELECT RAISE(ABORT,'Pending recommendation is already cancelled'); END;
CREATE TRIGGER recommendation_cancel_guard BEFORE UPDATE OF cancelledAt ON recommendationMessages
WHEN OLD.cancelledAt IS NOT NEW.cancelledAt AND (
  OLD.cancelledAt IS NOT NULL OR NEW.cancelledAt IS NULL OR OLD.entryMode <> 'pending'
  OR OLD.parentId IS NOT NULL OR OLD.type <> 'recommendation'
  OR NOT EXISTS (SELECT 1 FROM recommendationMessages child WHERE child.parentId=OLD.id AND child.managementAction='cancel_pending')
  OR EXISTS (SELECT 1 FROM recommendationMessages child WHERE child.parentId=OLD.id AND COALESCE(child.managementAction,'') <> 'cancel_pending')
)
BEGIN SELECT RAISE(ABORT,'Only an untouched pending entry can be cancelled'); END;
CREATE TRIGGER recommendation_result_correction_required BEFORE UPDATE OF resultOutcome,resultPips ON recommendationMessages
WHEN (OLD.resultOutcome IS NOT NEW.resultOutcome OR OLD.resultPips IS NOT NEW.resultPips) AND NOT EXISTS (
  SELECT 1 FROM recommendation_result_corrections audit
  WHERE audit.id=(SELECT MAX(id) FROM recommendation_result_corrections WHERE messageId=OLD.id)
    AND audit.messageId=OLD.id AND audit.previousOutcome IS OLD.resultOutcome
    AND audit.previousPips IS OLD.resultPips AND audit.outcome IS NEW.resultOutcome AND audit.pips IS NEW.resultPips
)
BEGIN SELECT RAISE(ABORT,'An audited result correction is required'); END;
CREATE TRIGGER recommendation_result_corrections_no_delete BEFORE DELETE ON recommendation_result_corrections
BEGIN SELECT RAISE(ABORT,'Result correction history is append only'); END;
CREATE TRIGGER recommendation_result_corrections_no_update BEFORE UPDATE ON recommendation_result_corrections
BEGIN SELECT RAISE(ABORT,'Result correction history is append only'); END;
