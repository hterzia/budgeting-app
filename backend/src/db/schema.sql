-- Portable Budgeting App SQLite Schema
-- Replaces PostgreSQL + pgvector with SQLite + in-process KNN

-- import_batches: Tracks async import state for UI polling
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded','parsing','embedding','categorizing','completed','failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  embedded_rows INTEGER NOT NULL DEFAULT 0,
  auto_categorized_rows INTEGER NOT NULL DEFAULT 0,
  needs_review_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_created ON import_batches (user_id, created_at DESC);

-- transactions: Stores raw import data + final category state
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  posted_at DATE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_raw TEXT,
  description_raw TEXT,
  merchant_clean TEXT,
  text_for_embedding TEXT NOT NULL,
  category_id TEXT,
  category_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (category_source IN ('rule','knn','keyword','llm','manual','unknown')),
  category_confidence REAL,
  needs_review INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'transfer', 'refund', 'ignored')),
  original_type TEXT,
  is_ignored INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_posted ON transactions (user_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant ON transactions (user_id, merchant_clean);
CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON transactions (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_review ON transactions (user_id, needs_review);

-- transaction_embeddings: Holds one vector per transaction (as BLOB)
CREATE TABLE IF NOT EXISTS transaction_embeddings (
  transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  embedding BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embeddings_user ON transaction_embeddings (user_id);

-- transaction_labels: Audit trail + trusted training source from explicit user edits
CREATE TABLE IF NOT EXISTS transaction_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  old_category_id TEXT,
  new_category_id TEXT NOT NULL,
  labeled_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_labels_user_created ON transaction_labels (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_labels_transaction_created ON transaction_labels (transaction_id, created_at DESC);

-- category_rules: Deterministic fast path
CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('merchant_clean','contains','regex')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_from TEXT NOT NULL DEFAULT 'edit_learning',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_unique ON category_rules (user_id, match_type, match_value, category_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_user_enabled_priority ON category_rules (user_id, enabled, priority);

-- accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (user_id);

-- categories table (supports user-specific and global categories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  color TEXT NOT NULL DEFAULT '#9ca3af',
  icon TEXT,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

-- Default categories
INSERT OR IGNORE INTO categories (id, name, type, color) VALUES
  ('groceries',      'Groceries',      'expense', '#10b981'),
  ('dining',         'Dining',         'expense', '#f59e0b'),
  ('transportation', 'Transportation', 'expense', '#3b82f6'),
  ('utilities',      'Utilities',      'expense', '#8b5cf6'),
  ('housing',        'Housing',        'expense', '#ec4899'),
  ('healthcare',     'Healthcare',     'expense', '#ef4444'),
  ('entertainment',  'Entertainment',  'expense', '#f97316'),
  ('shopping',       'Shopping',       'expense', '#14b8a6'),
  ('travel',         'Travel',         'expense', '#06b6d4'),
  ('insurance',      'Insurance',      'expense', '#64748b'),
  ('education',      'Education',      'expense', '#a855f7'),
  ('personal-care',  'Personal Care',  'expense', '#e879f9'),
  ('subscriptions',  'Subscriptions',  'expense', '#6366f1'),
  ('salary',         'Salary',         'income',  '#22c55e'),
  ('transfers',      'Transfers',      'transfer','#94a3b8'),
  ('uncategorized',  'Uncategorized',  'expense', '#9ca3af');

-- embedding_models metadata table
CREATE TABLE IF NOT EXISTS embedding_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default model (will be replaced by MiniLM)
INSERT OR IGNORE INTO embedding_models (model_name, dimension, is_active)
  VALUES ('all-MiniLM-L6-v2', 384, 1);

-- merchant_normalization_rules
CREATE TABLE IF NOT EXISTS merchant_normalization_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex')),
  pattern TEXT NOT NULL,
  canonical_merchant TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_normalization_rules_user_enabled_priority
  ON merchant_normalization_rules (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_normalization_rules_unique
  ON merchant_normalization_rules (
    COALESCE(user_id, '__global__'),
    rule_type,
    pattern,
    canonical_merchant
  );

-- merchant_noise_tokens
CREATE TABLE IF NOT EXISTS merchant_noise_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  token TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('word', 'regex')),
  position TEXT NOT NULL DEFAULT 'any' CHECK (position IN ('any', 'prefix', 'suffix')),
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_noise_tokens_user_enabled_priority
  ON merchant_noise_tokens (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_noise_tokens_unique
  ON merchant_noise_tokens (
    COALESCE(user_id, '__global__'),
    token,
    token_type,
    position
  );

-- merchant_normalization_replacements
CREATE TABLE IF NOT EXISTS merchant_normalization_replacements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  from_text TEXT NOT NULL,
  to_text TEXT NOT NULL DEFAULT '',
  is_regex INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merchant_normalization_replacements_user_enabled_priority
  ON merchant_normalization_replacements (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_normalization_replacements_unique
  ON merchant_normalization_replacements (
    COALESCE(user_id, '__global__'),
    from_text,
    to_text,
    is_regex
  );

-- transaction_classification_keywords
CREATE TABLE IF NOT EXISTS transaction_classification_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  keyword_group TEXT NOT NULL CHECK (keyword_group IN (
    'checking_transfer',
    'credit_card_transfer',
    'refund',
    'known_checking_transfer'
  )),
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'regex')),
  pattern TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_classification_keywords_user_enabled_priority
  ON transaction_classification_keywords (user_id, enabled, keyword_group, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS transaction_classification_keywords_unique
  ON transaction_classification_keywords (
    COALESCE(user_id, '__global__'),
    keyword_group,
    match_type,
    pattern
  );
