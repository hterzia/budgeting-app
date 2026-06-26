CREATE TABLE IF NOT EXISTS merchant_normalization_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex')),
  pattern TEXT NOT NULL,
  canonical_merchant TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_normalization_rules_user_enabled_priority
  ON merchant_normalization_rules (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_normalization_rules_unique
  ON merchant_normalization_rules (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    rule_type,
    pattern,
    canonical_merchant
  );

CREATE TABLE IF NOT EXISTS merchant_noise_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  token TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('word', 'regex')),
  position TEXT NOT NULL DEFAULT 'any' CHECK (position IN ('any', 'prefix', 'suffix')),
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_noise_tokens_user_enabled_priority
  ON merchant_noise_tokens (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_noise_tokens_unique
  ON merchant_noise_tokens (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    token,
    token_type,
    position
  );

CREATE TABLE IF NOT EXISTS merchant_normalization_replacements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  from_text TEXT NOT NULL,
  to_text TEXT NOT NULL DEFAULT '',
  is_regex BOOLEAN NOT NULL DEFAULT FALSE,
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_normalization_replacements_user_enabled_priority
  ON merchant_normalization_replacements (user_id, enabled, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_normalization_replacements_unique
  ON merchant_normalization_replacements (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    from_text,
    to_text,
    is_regex
  );
