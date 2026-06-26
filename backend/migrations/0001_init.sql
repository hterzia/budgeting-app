-- Phase 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- import_batches: Tracks async import state for UI polling
CREATE TABLE import_batches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded','parsing','embedding','categorizing','completed','failed')),
  total_rows INT NOT NULL DEFAULT 0,
  embedded_rows INT NOT NULL DEFAULT 0,
  auto_categorized_rows INT NOT NULL DEFAULT 0,
  needs_review_rows INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ON import_batches (user_id, created_at DESC);

-- transactions: Stores raw import data + final category state
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  posted_at DATE NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_raw TEXT,
  description_raw TEXT,
  merchant_clean TEXT,
  text_for_embedding TEXT,
  category_id TEXT,
  category_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (category_source IN ('rule','knn','manual','unknown')),
  category_confidence REAL,
  needs_review BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON transactions (user_id, posted_at);
CREATE INDEX ON transactions (user_id, merchant_clean);
CREATE INDEX ON transactions (import_batch_id);
CREATE INDEX ON transactions (user_id, needs_review);

-- transaction_embeddings: Holds one vector per transaction
CREATE TABLE transaction_embeddings (
  transaction_id BIGINT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  embedding vector(4096) NOT NULL
);

CREATE INDEX ON transaction_embeddings (user_id);

-- transaction_labels: Audit trail + trusted training source from explicit user edits
CREATE TABLE transaction_labels (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_category_id TEXT,
  new_category_id TEXT NOT NULL,
  labeled_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON transaction_labels (user_id, created_at DESC);
CREATE INDEX ON transaction_labels (transaction_id, created_at DESC);

-- category_rules: Deterministic fast path
CREATE TABLE category_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('merchant_clean','contains','regex')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_from TEXT NOT NULL DEFAULT 'edit_learning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX category_rules_unique_exact
  ON category_rules (user_id, match_type, match_value, category_id);
CREATE INDEX ON category_rules (user_id, enabled, priority);
