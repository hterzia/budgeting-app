-- Rollback: Remove data constraints

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_amount_cents_reasonable;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_category_confidence_range;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_currency_valid;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transaction_type;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_category;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_import_batch;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_account;

ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS chk_import_batch_user_not_null;
ALTER TABLE transaction_embeddings DROP CONSTRAINT IF EXISTS chk_embeddings_user_not_null;
ALTER TABLE transaction_labels DROP CONSTRAINT IF EXISTS chk_labels_user_not_null;
ALTER TABLE category_rules DROP CONSTRAINT IF EXISTS chk_rules_user_not_null;