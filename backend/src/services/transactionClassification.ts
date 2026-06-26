import type { Database } from 'better-sqlite3';
import {
  ClassificationKeywordMatcher,
  ClassificationKeywordMatchType,
  DEFAULT_TRANSACTION_CLASSIFICATION_CONFIG,
  TransactionClassificationConfig,
} from '../utils/csv.js';

type KeywordGroup =
  | 'checking_transfer'
  | 'credit_card_transfer'
  | 'refund'
  | 'known_checking_transfer';

function dedupe(values: ClassificationKeywordMatcher[]): ClassificationKeywordMatcher[] {
  const seen = new Set<string>();
  const result: ClassificationKeywordMatcher[] = [];
  for (const value of values) {
    const pattern = value.pattern.trim();
    const normalized = `${value.matchType}:${pattern.toLowerCase()}`;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ matchType: value.matchType, pattern });
  }
  return result;
}

export function loadTransactionClassificationConfig(
  db: Database,
  userId: string
): TransactionClassificationConfig {
  try {
    const stmt = db.prepare(
      `SELECT keyword_group, match_type, pattern
       FROM transaction_classification_keywords
       WHERE enabled = 1
         AND (user_id IS NULL OR user_id = ?)
       ORDER BY priority ASC,
                CASE WHEN user_id = ? THEN 0 ELSE 1 END,
                id ASC`
    );

    const rows = stmt.all(userId, userId);

    const grouped: Record<KeywordGroup, ClassificationKeywordMatcher[]> = {
      checking_transfer: [],
      credit_card_transfer: [],
      refund: [],
      known_checking_transfer: [],
    };

    for (const row of rows) {
      const group = (row as any).keyword_group as KeywordGroup;
      if (!grouped[group]) continue;
      const matchType = (row as any).match_type as ClassificationKeywordMatchType;
      if (matchType !== 'contains' && matchType !== 'regex') continue;
      grouped[group].push({
        matchType,
        pattern: String((row as any).pattern || ''),
      });
    }

    return {
      checkingTransferKeywords: dedupe(grouped.checking_transfer),
      creditCardTransferKeywords: dedupe(grouped.credit_card_transfer),
      refundKeywords: dedupe(grouped.refund),
      knownCheckingTransferKeywords: dedupe(grouped.known_checking_transfer),
    };
  } catch (error: any) {
    if (error?.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
      console.warn(
        '[transaction-classification] Table missing, using default keyword config'
      );
      return DEFAULT_TRANSACTION_CLASSIFICATION_CONFIG;
    }
    throw error;
  }
}
