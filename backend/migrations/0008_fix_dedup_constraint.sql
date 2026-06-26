-- Migration 0008: Fix dedup constraint to prevent dropping legitimate transactions
-- The previous constraint (user_id, posted_at, merchant_clean, amount_cents) was too
-- restrictive - it would silently drop duplicate $5.50 coffees from Starbucks on the same day.
--
-- Solution: Add a hash column that captures the complete transaction data including
-- description_raw, making duplicates only occur when the SAME transaction is re-imported.

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hash column for proper deduplication (idempotent)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- Generate hash for existing transactions based on all transaction fields
-- This ensures re-imports of the exact same transaction will have the same hash
UPDATE transactions
SET tx_hash = encode(
  digest(
    COALESCE(merchant_raw, '') ||
    COALESCE(description_raw, '') ||
    COALESCE(merchant_clean, '') ||
    amount_cents::text ||
    posted_at::text ||
    currency,
    'sha256'
  ),
  'hex'
)
WHERE tx_hash IS NULL;

-- Make hash non-nullable (idempotent)
ALTER TABLE transactions ALTER COLUMN tx_hash SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN tx_hash SET DEFAULT '';

-- Create unique constraint with hash - this prevents true duplicates while allowing
-- legitimate transactions with the same merchant/date/amount but different descriptions
CREATE UNIQUE INDEX IF NOT EXISTS transactions_unique_with_hash
  ON transactions (user_id, posted_at, merchant_clean, amount_cents, tx_hash);

-- Drop the old unique constraint from migration 0004
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_unique_tx;
