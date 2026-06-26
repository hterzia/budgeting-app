-- Migration 0004: Add unique constraint to prevent duplicate transactions on re-import
-- The ON CONFLICT DO NOTHING in insertTransactions relies on this constraint.
ALTER TABLE transactions ADD CONSTRAINT transactions_unique_tx
  UNIQUE (user_id, posted_at, merchant_clean, amount_cents);
