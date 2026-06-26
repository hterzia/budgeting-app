-- Migration 0012: Replace hard-coded accounts.type CHECK constraint with lookup table
-- This allows adding new account types without schema migrations

-- Create account_types lookup table
CREATE TABLE IF NOT EXISTS account_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  affects_net_worth BOOLEAN NOT NULL DEFAULT true
);

-- Insert default account types
INSERT INTO account_types (id, label, affects_net_worth) VALUES
  ('checking', 'Checking', true),
  ('savings', 'Savings', true),
  ('credit_card', 'Credit Card', true),
  ('investment', 'Investment', true),
  ('loan', 'Loan', true),
  ('mortgage', 'Mortgage', true)
ON CONFLICT (id) DO NOTHING;

-- Drop the old hard-coded constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;

-- Add foreign key constraint instead
ALTER TABLE accounts ADD CONSTRAINT accounts_type_fkey
  FOREIGN KEY (type) REFERENCES account_types(id);
