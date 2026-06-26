-- Rollback migration 0014: Restore is_ignored column

-- Add back is_ignored column
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN NOT NULL DEFAULT false;

-- Backfill: set is_ignored=true where type='ignored' and there's an original_type
UPDATE transactions SET is_ignored = true WHERE type = 'ignored';

-- Drop original_type column
ALTER TABLE transactions DROP COLUMN IF EXISTS original_type;
