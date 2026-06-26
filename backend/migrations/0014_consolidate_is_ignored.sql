-- Migration 0014: Consolidate is_ignored into type='ignored'
-- Remove the redundant is_ignored column and add original_type for round-trip restore

-- Backfill: set type='ignored' where is_ignored=true
UPDATE transactions SET type = 'ignored' WHERE is_ignored = true;

-- Add original_type column to preserve original type when ignoring
ALTER TABLE transactions ADD COLUMN original_type TEXT;

-- Update original_type for rows that were ignored
UPDATE transactions SET original_type = type WHERE type = 'ignored';

-- Set original_type to NULL for rows that are already ignored (type='ignored')
-- We want to clear this for non-ignored rows
UPDATE transactions SET original_type = NULL WHERE type != 'ignored';

-- Drop the is_ignored column
ALTER TABLE transactions DROP COLUMN IF EXISTS is_ignored;
