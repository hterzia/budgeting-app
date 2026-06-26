-- Migration 0009: Add foreign key constraints to category_id columns
-- Previously, category_id columns had no FK to categories.id, allowing orphaned references.
-- This migration adds proper FK constraints with ON DELETE SET NULL behavior.

-- First, ensure categories table has the expected structure
-- (categories.id is TEXT type, created in 0002_frontend_compat)

-- Add FK from transactions.category_id to categories.id
-- Use ON DELETE SET NULL to preserve transaction history even if category is deleted
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'transactions_category_id_fkey'
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK from category_rules.category_id to categories.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'category_rules_category_id_fkey'
        AND table_name = 'category_rules'
    ) THEN
        ALTER TABLE category_rules
        ADD CONSTRAINT category_rules_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK from transaction_labels.new_category_id to categories.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'transaction_labels_new_category_id_fkey'
        AND table_name = 'transaction_labels'
    ) THEN
        ALTER TABLE transaction_labels
        ADD CONSTRAINT transaction_labels_new_category_id_fkey
        FOREIGN KEY (new_category_id) REFERENCES categories(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK from transaction_labels.old_category_id to categories.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'transaction_labels_old_category_id_fkey'
        AND table_name = 'transaction_labels'
    ) THEN
        ALTER TABLE transaction_labels
        ADD CONSTRAINT transaction_labels_old_category_id_fkey
        FOREIGN KEY (old_category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for FK columns (for join performance and constraint validation)
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_category_id ON category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_labels_new_category_id ON transaction_labels(new_category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_labels_old_category_id ON transaction_labels(old_category_id);
