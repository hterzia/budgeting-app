-- Migration 0011: Add constraint to ensure amount_cents sign matches transaction type
-- Expenses/Transfers should have negative amounts, Income/Refunds should have positive amounts

-- First, update existing transactions to have correct signs based on type
-- (Assuming existing data has positive amounts that need to be negated for expenses)
-- This assumes expenses should be negative - adjust as needed for existing data
UPDATE transactions
SET amount_cents = CASE
  WHEN type IN ('expense', 'transfer') AND amount_cents > 0 THEN -amount_cents
  WHEN type IN ('income', 'refund') AND amount_cents < 0 THEN -amount_cents
  ELSE amount_cents
END;

-- Add constraint to ensure signed amounts are stored correctly
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_amount_sign_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_sign_check
  CHECK (
    (type IN ('expense', 'transfer') AND amount_cents <= 0)
    OR (type IN ('income', 'refund') AND amount_cents >= 0)
    OR type = 'ignored'
  );
