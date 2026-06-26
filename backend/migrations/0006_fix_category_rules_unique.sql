-- Fix category_rules unique constraint so that re-categorizing a merchant
-- updates the existing rule rather than creating a conflicting duplicate.
-- The old index included category_id, allowing multiple rules for the same
-- (user, match_type, match_value) triple.  The new index drops category_id so
-- there is at most one rule per merchant per user.

DROP INDEX IF EXISTS category_rules_unique_exact;

-- Remove duplicates, keeping the most recently created rule per (user, match_type, match_value).
DELETE FROM category_rules
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, match_type, match_value) id
  FROM category_rules
  ORDER BY user_id, match_type, match_value, created_at DESC, id DESC
);

CREATE UNIQUE INDEX category_rules_unique_merchant
  ON category_rules (user_id, match_type, match_value);
