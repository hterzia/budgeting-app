-- Rollback migration 0013: Remove updated_at from transactions

-- Drop the trigger
DROP TRIGGER IF EXISTS transactions_updated_at ON transactions;

-- Drop the function
DROP FUNCTION IF EXISTS set_updated_at();

-- Drop the column
ALTER TABLE transactions DROP COLUMN IF EXISTS updated_at;

-- Drop the index
DROP INDEX IF EXISTS idx_transactions_updated_at;
