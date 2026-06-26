-- Rollback for 0002_frontend_compat.sql
ALTER TABLE transactions DROP COLUMN IF EXISTS is_ignored;
ALTER TABLE transactions DROP COLUMN IF EXISTS type;
ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;

DROP INDEX IF EXISTS accounts_user_id_idx;
DROP TABLE IF EXISTS accounts;
