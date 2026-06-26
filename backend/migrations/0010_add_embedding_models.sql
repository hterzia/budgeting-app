-- Migration 0010: Add embedding_models metadata table for dynamic dimension support
-- This allows changing embedding models without requiring a schema migration

CREATE TABLE IF NOT EXISTS embedding_models (
  id BIGSERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  dimension INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the current active model
INSERT INTO embedding_models (model_name, dimension, is_active)
  VALUES ('nvidia/llama-embed-nemotron-8b', 4096, true)
ON CONFLICT DO NOTHING;
