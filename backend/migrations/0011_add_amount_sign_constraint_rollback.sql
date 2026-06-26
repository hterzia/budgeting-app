-- Rollback migration 0011: Drop amount sign constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_amount_sign_check;
