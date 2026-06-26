-- Rollback migration 0012: Restore hard-coded CHECK constraint on accounts.type

-- Drop the foreign key constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_fkey;

-- Drop the lookup table
DROP TABLE IF EXISTS account_types;

-- Restore the original hard-coded constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('checking', 'savings', 'credit_card'));
