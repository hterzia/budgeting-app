INSERT INTO categories (id, name, type, color, user_id) VALUES
  ('groceries', 'Groceries', 'expense', '#22c55e', '00000000-0000-0000-0000-000000000000'),
  ('dining', 'Dining', 'expense', '#f97316', '00000000-0000-0000-0000-000000000000'),
  ('transportation', 'Transportation', 'expense', '#3b82f6', '00000000-0000-0000-0000-000000000000'),
  ('utilities', 'Utilities', 'expense', '#8b5cf6', '00000000-0000-0000-0000-000000000000'),
  ('housing', 'Housing', 'expense', '#ec4899', '00000000-0000-0000-0000-000000000000'),
  ('healthcare', 'Healthcare', 'expense', '#ef4444', '00000000-0000-0000-0000-000000000000'),
  ('entertainment', 'Entertainment', 'expense', '#a855f7', '00000000-0000-0000-0000-000000000000'),
  ('shopping', 'Shopping', 'expense', '#0ea5e9', '00000000-0000-0000-0000-000000000000'),
  ('travel', 'Travel', 'expense', '#14b8a6', '00000000-0000-0000-0000-000000000000'),
  ('insurance', 'Insurance', 'expense', '#6b7280', '00000000-0000-0000-0000-000000000000'),
  ('education', 'Education', 'expense', '#84cc16', '00000000-0000-0000-0000-000000000000'),
  ('personal-care', 'Personal Care', 'expense', '#f59e0b', '00000000-0000-0000-0000-000000000000'),
  ('subscriptions', 'Subscriptions', 'expense', '#6366f1', '00000000-0000-0000-0000-000000000000'),
  ('salary', 'Salary', 'income', '#16a34a', '00000000-0000-0000-0000-000000000000'),
  ('transfers', 'Transfers', 'expense', '#94a3b8', '00000000-0000-0000-0000-000000000000'),
  ('uncategorized', 'Uncategorized', 'expense', '#9ca3af', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id;
