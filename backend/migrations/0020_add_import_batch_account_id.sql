-- Add accountId to import_batches table
ALTER TABLE import_batches
ADD COLUMN account_id UUID REFERENCES accounts(id);

-- Create index on account_id for faster queries
CREATE INDEX ON import_batches (account_id);
