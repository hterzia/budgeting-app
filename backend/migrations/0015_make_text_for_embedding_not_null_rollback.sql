-- Rollback migration 0015: Remove NOT NULL constraint on text_for_embedding

-- Drop the index
DROP INDEX IF EXISTS idx_transactions_text_for_embedding;

-- Drop NOT NULL constraint
ALTER TABLE transactions ALTER COLUMN text_for_embedding DROP NOT NULL;
