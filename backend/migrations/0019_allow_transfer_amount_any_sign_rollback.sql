-- Rollback migration 0019: Restore previous transfer sign rule
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_amount_sign_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_amount_sign_check
  CHECK (
    (type IN ('expense', 'transfer') AND amount_cents <= 0)
    OR (type IN ('income', 'refund') AND amount_cents >= 0)
    OR type = 'ignored'
  );
