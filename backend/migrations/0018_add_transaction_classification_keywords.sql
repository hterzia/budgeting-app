CREATE TABLE IF NOT EXISTS transaction_classification_keywords (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  keyword_group TEXT NOT NULL CHECK (keyword_group IN (
    'checking_transfer',
    'credit_card_transfer',
    'refund',
    'known_checking_transfer'
  )),
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'regex')),
  pattern TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_classification_keywords_user_enabled_priority
  ON transaction_classification_keywords (user_id, enabled, keyword_group, priority, id);

CREATE UNIQUE INDEX IF NOT EXISTS transaction_classification_keywords_unique
  ON transaction_classification_keywords (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    keyword_group,
    match_type,
    pattern
  );

INSERT INTO transaction_classification_keywords (user_id, keyword_group, match_type, pattern, priority)
VALUES
  -- checking transfer keywords
  (NULL, 'checking_transfer', 'contains', 'credit card', 100),
  (NULL, 'checking_transfer', 'contains', 'card payment', 100),
  (NULL, 'checking_transfer', 'contains', 'cc payment', 100),
  (NULL, 'checking_transfer', 'contains', 'chase credit', 100),
  (NULL, 'checking_transfer', 'contains', 'chase card', 100),
  (NULL, 'checking_transfer', 'contains', 'chase crd', 100),
  (NULL, 'checking_transfer', 'contains', 'capital one', 100),
  (NULL, 'checking_transfer', 'contains', 'amex', 100),
  (NULL, 'checking_transfer', 'contains', 'american express', 100),
  (NULL, 'checking_transfer', 'contains', 'citi card', 100),
  (NULL, 'checking_transfer', 'contains', 'citi credit', 100),
  (NULL, 'checking_transfer', 'contains', 'discover card', 100),
  (NULL, 'checking_transfer', 'contains', 'discover credit', 100),
  (NULL, 'checking_transfer', 'contains', 'wells fargo card', 100),
  (NULL, 'checking_transfer', 'contains', 'wells fargo credit', 100),
  (NULL, 'checking_transfer', 'contains', 'bank of america', 100),
  (NULL, 'checking_transfer', 'contains', 'barclays', 100),
  (NULL, 'checking_transfer', 'contains', 'synchrony', 100),
  (NULL, 'checking_transfer', 'contains', 'apple card', 100),

  -- credit card transfer keywords
  (NULL, 'credit_card_transfer', 'contains', 'payment', 100),
  (NULL, 'credit_card_transfer', 'contains', 'autopay', 100),
  (NULL, 'credit_card_transfer', 'contains', 'auto pay', 100),
  (NULL, 'credit_card_transfer', 'contains', 'thank you', 100),
  (NULL, 'credit_card_transfer', 'contains', 'payment received', 100),
  (NULL, 'credit_card_transfer', 'contains', 'online payment', 100),
  (NULL, 'credit_card_transfer', 'contains', 'ach payment', 100),
  (NULL, 'credit_card_transfer', 'contains', 'mobile payment', 100),

  -- refund keywords
  (NULL, 'refund', 'contains', 'refund', 100),
  (NULL, 'refund', 'contains', 'return', 100),
  (NULL, 'refund', 'contains', 'rebate', 100),
  (NULL, 'refund', 'contains', 'credit adj', 100),
  (NULL, 'refund', 'contains', 'credit memo', 100),
  (NULL, 'refund', 'contains', 'reversal', 100),
  (NULL, 'refund', 'contains', 'adjustment', 100),
  (NULL, 'refund', 'contains', 'dispute', 100),
  (NULL, 'refund', 'contains', 'chargeback', 100),

  -- known checking transfer phrases
  (NULL, 'known_checking_transfer', 'contains', 'online transfer from sav', 100),
  (NULL, 'known_checking_transfer', 'contains', 'bk of amer vi/mc online pmt', 100)
ON CONFLICT DO NOTHING;
