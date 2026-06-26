-- Rollback for 0007_add_user_id_to_categories.sql
DROP INDEX IF EXISTS categories_user_id_idx;
ALTER TABLE categories DROP COLUMN IF EXISTS user_id;
