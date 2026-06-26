import type { Database } from 'better-sqlite3';
import { getKNNCategory as getKNNCategorySqlite } from './knn.js';
import { serializeEmbedding, deserializeEmbedding } from '../db/sqliteQueries.js';
import { keywordCategorize } from './keywordCategorize.js';
import { generateEmbeddings } from './localEmbeddings.js';

export interface CategorizationResult {
  total: number;
  ruleMatched: number;
  knnMatched: number;
  keywordMatched: number;
  needsReview: number;
}

export interface SqliteTransaction {
  id: number;
  user_id: string;
  text_for_embedding: string | null;
  merchant_clean: string | null;
  description_raw: string | null;
  amount_cents: number;
  type: string;
  category_id: string | null;
  category_source: string;
  category_confidence: number | null;
  needs_review: number;
}

export type TransactionRow = {
  id: number;
  user_id: string;
  text_for_embedding: string | null;
  merchant_clean: string | null;
  description_raw: string | null;
  amount_cents: number;
  type: string;
};

/**
 * Build text_for_embedding from transaction data.
 * Format: "Merchant: [merchant]. Description: [description]. Type: [type]. Amount: [bucket]. Domain: [domain]."
 */
export function buildTextForEmbedding(tx: {
  merchantClean?: string;
  descriptionRaw?: string;
  amountCents: number;
  type?: string;
}): string {
  const merchant = tx.merchantClean?.trim() || 'Unknown';
  const description = tx.descriptionRaw?.trim() || '';
  const txType = tx.type?.trim() || 'expense';

  // Amount bucket
  const amount = Math.abs(tx.amountCents);
  let amountBucket = 'small';
  if (amount < 1000) amountBucket = 'small';         // < $10
  else if (amount < 10000) amountBucket = 'medium';  // $10-$100
  else if (amount < 100000) amountBucket = 'large';  // $100-$1000
  else amountBucket = 'very large';                  // > $1000

  // Simple domain extraction from merchant
  const domain = extractDomain(merchant);

  return `Merchant: ${merchant}. Description: ${description}. Type: ${txType}. Amount: ${amountBucket}. Domain: ${domain}.`;
}

function extractDomain(merchant: string): string {
  const lower = merchant.toLowerCase();

  const domains: { keywords: string[]; domain: string }[] = [
    { keywords: ['coffee', 'cafe', 'starbucks', 'dunkin'], domain: 'coffee' },
    { keywords: ['restaurant', 'dinner', 'food', 'grill', 'burger'], domain: 'food' },
    { keywords: ['uber', 'lyft', 'gas', 'petrol', 'fuel'], domain: 'transport' },
    { keywords: ['amazon', 'store', 'shop', 'retail'], domain: 'shopping' },
    { keywords: ['rent', 'lease', 'apartment', 'housing'], domain: 'housing' },
    { keywords: ['electric', 'water', 'gas', 'utilities'], domain: 'utilities' },
    { keywords: ['doctor', 'hospital', 'health', 'pharmacy'], domain: 'health' },
    { keywords: ['gym', 'fitness', 'sport', 'exercise'], domain: 'fitness' },
    { keywords: ['travel', 'hotel', 'airbnb', 'flight'], domain: 'travel' },
  ];

  for (const d of domains) {
    if (d.keywords.some((k) => lower.includes(k))) {
      return d.domain;
    }
  }

  return 'general';
}

/**
 * Apply category rules to a transaction.
 * Returns matched category if any rule matches, null otherwise.
 */
export function applyCategoryRules(
  tx: { merchantClean?: string; descriptionRaw?: string },
  rules: Array<{ matchType: string; matchValue: string; categoryId: string; priority: number }>
): { categoryId: string; confidence: number } | null {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    const matchResult = matchRule(tx, rule);
    if (matchResult) {
      return { categoryId: rule.categoryId, confidence: 0.98 };
    }
  }

  return null;
}

function matchRule(
  tx: { merchantClean?: string; descriptionRaw?: string },
  rule: { matchType: string; matchValue: string }
): boolean {
  const merchant = (tx.merchantClean || '').toLowerCase();
  const description = (tx.descriptionRaw || '').toLowerCase();

  switch (rule.matchType) {
    case 'merchant_clean':
      return merchant === rule.matchValue.toLowerCase();
    case 'contains':
      return merchant.includes(rule.matchValue.toLowerCase());
    case 'regex':
      try {
        const regex = new RegExp(rule.matchValue, 'i');
        return regex.test(merchant) || regex.test(description);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Categorize transactions using rules -> KNN -> keyword -> review flow.
 */
export async function categorizeTransactionsSqlite(
  db: Database,
  importBatchId: string,
  userId: string
): Promise<CategorizationResult> {
  let ruleMatched = 0;
  let knnMatched = 0;
  let keywordMatched = 0;
  let needsReview = 0;

  // Get user's category rules
  const rules = getCategoryRulesSqlite(db, userId);
  console.log(`[categorize] start importId=${importBatchId} userId=${userId} rules=${rules.length}`);

  // Get uncategorized transactions
  const stmt = db.prepare(
    `SELECT id, user_id, text_for_embedding, merchant_clean, description_raw, amount_cents, type
     FROM transactions
     WHERE import_batch_id = ?
       AND needs_review = 1
     ORDER BY id ASC`
  );
  const allTransactionsRaw = stmt.all(importBatchId);
  const allTransactions = allTransactionsRaw as TransactionRow[];

  console.log(`[categorize] processing ${allTransactions.length} transactions`);

  // Pre-fetch valid category IDs (used by keyword categorizer)
  const validCategoryIds = new Set(getCategoryIdsSqlite(db));

  // Process transactions
  for (const tx of allTransactions) {
    let categoryId: string | null = null;
    let categorySource: 'rule' | 'knn' | 'keyword' | 'unknown' = 'unknown';
    let confidence: number | null = null;

    // Step 1: Try rules first
    if (rules.length > 0 && tx.merchant_clean) {
      const ruleMatch = applyCategoryRules(
        {
          merchantClean: tx.merchant_clean ?? '',
          descriptionRaw: tx.description_raw ?? '',
        },
        rules
      );

      if (ruleMatch) {
        categoryId = ruleMatch.categoryId;
        categorySource = 'rule';
        confidence = ruleMatch.confidence;
        ruleMatched++;
      }
    }

    // Step 2: Try KNN if no rule match
    if (!categoryId && tx.text_for_embedding?.trim()) {
      const embedding = await getOrCreateEmbeddingSqlite(db, tx.id, userId, tx.text_for_embedding);

      if (embedding) {
        const knnResult = getKNNCategorySqlite(
          db,
          embedding,
          userId,
          20, // k
          0.60, // minVoteProportion
          2, // minNeighborCount
          0.80 // minTopSimilarity
        );

        if (knnResult.categoryId) {
          categoryId = knnResult.categoryId;
          categorySource = 'knn';
          confidence = knnResult.confidence;
          knnMatched++;
        }
      }
    }

    // Step 3: Try keyword matching if still no category
    if (!categoryId) {
      const keywordResult = keywordCategorize(
        { merchantClean: tx.merchant_clean ?? '', descriptionRaw: tx.description_raw ?? '', amountCents: tx.amount_cents, type: tx.type },
        validCategoryIds
      );
      if (keywordResult.categoryId) {
        categoryId = keywordResult.categoryId;
        categorySource = 'keyword';
        confidence = keywordResult.confidence;
        keywordMatched++;
      }
    }

    // Update transaction
    updateTransactionCategorySqlite(db, tx.id, categoryId, categorySource, confidence, !categoryId);
  }

  // Count remaining as needsReview
  needsReview = allTransactions.length - ruleMatched - knnMatched - keywordMatched;

  console.log(
    `[categorize] completed importId=${importBatchId} total=${allTransactions.length} rule=${ruleMatched} knn=${knnMatched} keyword=${keywordMatched} needsReview=${needsReview}`
  );

  return {
    total: allTransactions.length,
    ruleMatched,
    knnMatched,
    keywordMatched,
    needsReview,
  };
}

function getCategoryRulesSqlite(db: Database, userId: string): Array<{ matchType: string; matchValue: string; categoryId: string; priority: number }> {
  const stmt = db.prepare(
    `SELECT id, match_type, match_value, category_id, priority
     FROM category_rules
     WHERE user_id = ? AND enabled = 1
     ORDER BY priority ASC`
  );
  const rows = stmt.all(userId);
  return rows.map((r: any) => ({
    matchType: r.match_type,
    matchValue: r.match_value,
    categoryId: r.category_id,
    priority: r.priority,
  }));
}

async function getOrCreateEmbeddingSqlite(
  db: Database,
  transactionId: number,
  userId: string,
  text: string
): Promise<number[] | null> {
  const existing = db.prepare(
    'SELECT embedding FROM transaction_embeddings WHERE transaction_id = ?'
  ).get(transactionId) as { embedding: Buffer } | undefined;

  if (existing?.embedding && Buffer.isBuffer(existing.embedding)) {
    return deserializeEmbedding(existing.embedding);
  }

  try {
    const [embedding] = await generateEmbeddings([text]);
    if (embedding && embedding.length > 0) {
      db.prepare(
        'INSERT OR IGNORE INTO transaction_embeddings (transaction_id, user_id, embedding) VALUES (?, ?, ?)'
      ).run(transactionId, userId, serializeEmbedding(embedding));
      return embedding;
    }
  } catch (err: any) {
    console.warn(`[embedding] Failed for tx ${transactionId}: ${err.message}`);
  }

  return null;
}

function updateTransactionCategorySqlite(
  db: Database,
  transactionId: number,
  categoryId: string | null,
  categorySource: 'rule' | 'knn' | 'keyword' | 'unknown',
  confidence: number | null,
  needsReview: boolean
): void {
  db.prepare(
    `UPDATE transactions
     SET category_id = ?,
         category_source = ?,
         category_confidence = ?,
         needs_review = ?
     WHERE id = ?`
  ).run(categoryId, categorySource, confidence, needsReview ? 1 : 0, transactionId);
}

function getCategoryIdsSqlite(db: Database): string[] {
  const rows = db.prepare('SELECT id FROM categories').all() as Array<{ id: string }>;
  return rows.map(r => r.id);
}
