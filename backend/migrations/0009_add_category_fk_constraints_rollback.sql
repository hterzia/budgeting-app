-- Rollback migration 0009: Remove FK constraints from category_id columns

-- Drop all category FK constraints if they exist
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE category_rules DROP CONSTRAINT IF EXISTS category_rules_category_id_fkey;
ALTER TABLE transaction_labels DROP CONSTRAINT IF EXISTS transaction_labels_new_category_id_fkey;
ALTER TABLE transaction_labels DROP CONSTRAINT IF EXISTS transaction_labels_old_category_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_transactions_category_id;
DROP INDEX IF EXISTS idx_category_rules_category_id;
DROP INDEX IF EXISTS idx_transaction_labels_new_category_id;
DROP INDEX IF EXISTS idx_transaction_labels_old_category_id;
