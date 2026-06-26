-- Phase 2.1: Performance indexes for common query patterns
-- These indexes improve performance for frequently used query patterns

-- Transactions by user and date range (used in transaction filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date
ON transactions (user_id, posted_at DESC);

-- Transactions by category (used in category aggregation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_category
ON transactions (user_id, category_id);

-- Transactions by import batch (used in import processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_import_batch
ON transactions (import_batch_id);

-- Transactions by needs_review flag
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_needs_review
ON transactions (user_id, needs_review);

-- Transactions by merchant (used in search and categorization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_merchant
ON transactions (user_id, merchant_clean);

-- Embeddings by user (used in KNN queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_user
ON transaction_embeddings (user_id);

-- Category rules by user and enabled status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_rules_user_enabled
ON category_rules (user_id, enabled, priority);

-- Import batches by user and creation time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_batches_user_created
ON import_batches (user_id, created_at DESC);

-- Transaction labels by user (used in KNN training)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_labels_user
ON transaction_labels (user_id, created_at DESC);

-- Transaction classification keywords by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_classification_user
ON transaction_classification_keywords (user_id, enabled);

-- Merchant normalization by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merchant_normalization_user
ON merchant_normalization_replacements (user_id, enabled);