-- Remove accountId from import_batches table
ALTER TABLE import_batches
DROP COLUMN IF EXISTS account_id;

DROP INDEX IF EXISTS import_batches_account_id_idx;
