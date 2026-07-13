-- Migration 069: Make loyalty reward requests and rejection refunds atomic.
-- D1 does not expose interactive transactions, so the invariants live in
-- SQLite triggers and execute in the transaction of the redemption write.

CREATE TRIGGER IF NOT EXISTS loyalty_reward_request_validate
BEFORE INSERT ON loyalty_reward_redemptions
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM loyalty_reward_items
      WHERE id = NEW.reward_item_id AND is_active = 1
    ) THEN RAISE(ABORT, 'loyalty_reward_not_available')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM loyalty_reward_redemptions
      WHERE user_id = NEW.user_id
        AND reward_item_id = NEW.reward_item_id
        AND status IN ('pending', 'approved')
    ) THEN RAISE(ABORT, 'loyalty_reward_already_pending')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM loyalty_reward_items
      WHERE id = NEW.reward_item_id
        AND points_cost = NEW.points_cost
    ) THEN RAISE(ABORT, 'loyalty_reward_price_changed')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM loyalty_reward_items
      WHERE id = NEW.reward_item_id
        AND stock_quantity IS NOT NULL
        AND stock_quantity <= 0
    ) THEN RAISE(ABORT, 'loyalty_reward_out_of_stock')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM users
      WHERE id = NEW.user_id AND points_balance >= NEW.points_cost
    ) THEN RAISE(ABORT, 'loyalty_reward_insufficient_points')
  END;
END;

CREATE TRIGGER IF NOT EXISTS loyalty_reward_request_apply
AFTER INSERT ON loyalty_reward_redemptions
FOR EACH ROW
BEGIN
  UPDATE users
  SET points_balance = points_balance - NEW.points_cost
  WHERE id = NEW.user_id;

  UPDATE loyalty_reward_items
  SET stock_quantity = CASE
        WHEN stock_quantity IS NULL THEN NULL
        ELSE stock_quantity - 1
      END,
      updated_at = NEW.requested_at
  WHERE id = NEW.reward_item_id;

  INSERT INTO points_transactions (
    user_id, amount, type, reason_en, reason_ar,
    reference_id, reference_type, created_at
  ) VALUES (
    NEW.user_id,
    -NEW.points_cost,
    'redeem',
    'Reward redemption requested',
    'طلب استبدال مكافأة',
    NEW.id,
    'loyalty_reward',
    NEW.requested_at
  );

  UPDATE loyalty_reward_redemptions
  SET points_transaction_id = last_insert_rowid(),
      updated_at = NEW.requested_at
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS loyalty_reward_rejection_refund
AFTER UPDATE OF status ON loyalty_reward_redemptions
FOR EACH ROW
WHEN OLD.status = 'pending' AND NEW.status = 'rejected'
BEGIN
  UPDATE users
  SET points_balance = points_balance + OLD.points_cost
  WHERE id = OLD.user_id;

  UPDATE loyalty_reward_items
  SET stock_quantity = CASE
        WHEN stock_quantity IS NULL THEN NULL
        ELSE stock_quantity + 1
      END,
      updated_at = NEW.updated_at
  WHERE id = OLD.reward_item_id;

  INSERT INTO points_transactions (
    user_id, amount, type, reason_en, reason_ar,
    reference_id, reference_type, created_at
  ) VALUES (
    OLD.user_id,
    OLD.points_cost,
    'bonus',
    'Reward redemption refund',
    'استرجاع نقاط مكافأة',
    OLD.id,
    'loyalty_reward_refund',
    NEW.updated_at
  );
END;
