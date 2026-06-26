-- Rollback for 0001_init.sql
DROP TABLE IF EXISTS category_rules;
DROP TABLE IF EXISTS transaction_labels;
DROP TABLE IF EXISTS transaction_embeddings;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS import_batches;

DROP INDEX IF EXISTS category_rules_unique_exact;
DROP INDEX IF EXISTS category_rules_user_id_enabled_priority_idx;
DROP INDEX IF EXISTS transaction_labels_user_id_idx;
DROP INDEX IF EXISTS transaction_labels_transaction_id_idx;
DROP INDEX IF EXISTS import_batches_user_id_created_at_idx;
DROP INDEX IF EXISTS transactions_user_id_posted_at_idx;
DROP INDEX IF EXISTS transactions_user_id_merchant_clean_idx;
DROP INDEX IF EXISTS transactions_import_batch_id_idx;
DROP INDEX IF EXISTS transactions_user_id_needs_review_idx;

-- Note: pgvector extension cannot be dropped if other objects depend on it
-- DROP EXTENSION IF EXISTS vector;
