-- Migration 0013: Add updated_at column to transactions with automatic trigger
-- This provides a timestamp trail for when transactions are modified

-- Add updated_at column with default now()
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS transactions_updated_at ON transactions;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Create index on updated_at for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at);
