-- Migration 0015: Make text_for_embedding NOT NULL with guaranteed fallback
-- Ensures all transactions have text for embedding even if minimal

-- Backfill any NULL values with a safe default
UPDATE transactions SET text_for_embedding = 'Merchant: Unknown. Description: . Type: expense. Amount: small. Domain: general.'
WHERE text_for_embedding IS NULL;

-- Add NOT NULL constraint
ALTER TABLE transactions ALTER COLUMN text_for_embedding SET NOT NULL;

-- Create index for filtering transactions without embeddings
CREATE INDEX IF NOT EXISTS idx_transactions_text_for_embedding ON transactions(text_for_embedding);
