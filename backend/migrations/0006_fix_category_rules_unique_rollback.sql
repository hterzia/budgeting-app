-- Rollback for 0006_fix_category_rules_unique.sql
-- Drop the new unique index
DROP INDEX IF EXISTS category_rules_unique_merchant;

-- Recreate the old 4-column unique index
CREATE UNIQUE INDEX category_rules_unique_exact
  ON category_rules (user_id, match_type, match_value, category_id);
