-- Rollback for 0005_llm_category_source.sql
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_source_check
  CHECK (category_source IN ('rule', 'knn', 'manual', 'unknown'));
