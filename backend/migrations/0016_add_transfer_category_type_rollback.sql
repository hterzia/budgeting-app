-- Rollback: Revert categories type constraint
ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_type_check,
  ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense'));
