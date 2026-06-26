-- Phase 2.2: Add data integrity constraints

-- Ensure amounts are reasonable (prevent accidental billion dollar transactions or negative amounts that are too large)
ALTER TABLE transactions
ADD CONSTRAINT chk_amount_cents_reasonable
CHECK (amount_cents >= -100000000 AND amount_cents <= 100000000);

-- Ensure category confidence is between 0 and 1 (when present)
ALTER TABLE transactions
ADD CONSTRAINT chk_category_confidence_range
CHECK (category_confidence IS NULL OR (category_confidence >= 0 AND category_confidence <= 1));

-- Ensure currency is valid (ISO 4217 3-letter code)
ALTER TABLE transactions
ADD CONSTRAINT chk_currency_valid
CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

-- Ensure type values are valid
ALTER TABLE transactions
ADD CONSTRAINT chk_transaction_type
CHECK (type IN ('income', 'expense', 'transfer', 'refund', 'ignored'));

-- Ensure category_id references a valid category (when present)
ALTER TABLE transactions
ADD CONSTRAINT fk_category
FOREIGN KEY (category_id, user_id)
REFERENCES categories(id, user_id)
ON DELETE SET NULL;

-- Ensure import_batch_id references a valid import batch
ALTER TABLE transactions
ADD CONSTRAINT fk_import_batch
FOREIGN KEY (import_batch_id)
REFERENCES import_batches(id)
ON DELETE CASCADE;

-- Ensure account_id references a valid account (when present)
ALTER TABLE transactions
ADD CONSTRAINT fk_account
FOREIGN KEY (account_id, user_id)
REFERENCES accounts(id, user_id)
ON DELETE SET NULL;

-- Ensure category type matches transaction type
-- This constraint is enforced in the application layer via rules in categorize.ts

-- Ensure user_id is not null on all tables
ALTER TABLE import_batches
ADD CONSTRAINT chk_import_batch_user_not_null
CHECK (user_id IS NOT NULL);

ALTER TABLE transaction_embeddings
ADD CONSTRAINT chk_embeddings_user_not_null
CHECK (user_id IS NOT NULL);

ALTER TABLE transaction_labels
ADD CONSTRAINT chk_labels_user_not_null
CHECK (user_id IS NOT NULL);

ALTER TABLE category_rules
ADD CONSTRAINT chk_rules_user_not_null
CHECK (user_id IS NOT NULL);