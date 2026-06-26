-- Rollback for 0004_dedup_constraint.sql
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_unique_tx;
