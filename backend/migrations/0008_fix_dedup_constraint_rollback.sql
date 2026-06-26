-- Rollback migration 0008: Remove hash-based dedup constraint
-- This reverts to the original dedup approach (if needed) or removes the constraint

-- Drop the new hash-based unique index
DROP INDEX IF EXISTS transactions_unique_with_hash;

-- Remove the tx_hash column
ALTER TABLE transactions DROP COLUMN IF EXISTS tx_hash;

-- Re-add the old constraint if it doesn't exist (for rollback compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'transactions_unique_tx'
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_unique_tx
          UNIQUE (user_id, posted_at, merchant_clean, amount_cents);
    END IF;
END $$;
