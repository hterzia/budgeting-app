-- Migration 0019: Allow transfer amounts to be either sign
-- Credit card statements can represent payments as positive values,
-- while checking/savings typically represent them as negative.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_amount_sign_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_amount_sign_check
  CHECK (
    (type = 'expense' AND amount_cents <= 0)
    OR (type IN ('income', 'refund') AND amount_cents >= 0)
    OR type IN ('transfer', 'ignored')
  );
