-- Add user_id column to categories table (nullable first)
ALTER TABLE categories ADD COLUMN user_id UUID;

-- Update existing categories to use the default user
UPDATE categories SET user_id = '00000000-0000-0000-0000-000000000000';

-- Make user_id non-nullable
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;

-- Add default value for future inserts
ALTER TABLE categories ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- Add foreign key constraint (optional - comment out if users table doesn't exist yet)
-- ALTER TABLE categories ADD CONSTRAINT categories_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for user-based category lookup
CREATE INDEX ON categories (user_id);
