-- Migration 0005: Add 'llm' to category_source CHECK constraint
-- Required for LLM-based categorization fallback (cold-start support)

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_source_check
  CHECK (category_source IN ('rule', 'knn', 'llm', 'manual', 'unknown'));
