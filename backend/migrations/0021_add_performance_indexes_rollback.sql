-- Rollback: Remove performance indexes

DROP INDEX IF EXISTS idx_transactions_user_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_import_batch;
DROP INDEX IF EXISTS idx_transactions_needs_review;
DROP INDEX IF EXISTS idx_transactions_merchant;
DROP INDEX IF EXISTS idx_embeddings_user;
DROP INDEX IF EXISTS idx_category_rules_user_enabled;
DROP INDEX IF EXISTS idx_import_batches_user_created;
DROP INDEX IF EXISTS idx_transaction_labels_user;
DROP INDEX IF EXISTS idx_transaction_classification_user;
DROP INDEX IF EXISTS idx_merchant_normalization_user;