import { createHash } from 'crypto';
import { CategorySource, ImportStatus, MatchType } from '../types/index.js';
import type { Database } from 'better-sqlite3';

// Serialize embedding array to Buffer (BLOB) for SQLite storage using Float32 (4 bytes/float)
export function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

// Deserialize Buffer (BLOB) to embedding array from Float32 (4 bytes/float)
export function deserializeEmbedding(buffer: Buffer): number[] {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
}

// Import batches
export function createImportBatch(
  db: Database,
  id: string,
  userId: string,
  totalRows: number,
  accountId?: string | null
): void {
  db.prepare(
    `INSERT INTO import_batches (id, user_id, status, total_rows, embedded_rows, auto_categorized_rows, needs_review_rows, account_id)
     VALUES (?, ?, 'uploaded', ?, 0, 0, 0, ?)`
  ).run(id, userId, totalRows, accountId || null);
}

export function updateImportBatchStatus(
  db: Database,
  id: string,
  status: ImportStatus,
  updates?: {
    embeddedRows?: number;
    autoCategorizedRows?: number;
    needsReviewRows?: number;
    errorMessage?: string;
    completedAt?: string;
  }
): void {
  const setClauses: string[] = ['status = ?'];
  const values: any[] = [status];

  if (updates?.embeddedRows !== undefined) {
    setClauses.push(`embedded_rows = ?`);
    values.push(updates.embeddedRows);
  }
  if (updates?.autoCategorizedRows !== undefined) {
    setClauses.push(`auto_categorized_rows = ?`);
    values.push(updates.autoCategorizedRows);
  }
  if (updates?.needsReviewRows !== undefined) {
    setClauses.push(`needs_review_rows = ?`);
    values.push(updates.needsReviewRows);
  }
  if (updates?.errorMessage !== undefined) {
    setClauses.push(`error_message = ?`);
    values.push(updates.errorMessage);
  }
  if (updates?.completedAt !== undefined) {
    setClauses.push(`completed_at = ?`);
    values.push(updates.completedAt);
  }

  values.push(id);
  db.prepare(
    `UPDATE import_batches SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values);
}

export function getImportBatch(db: Database, id: string): any {
  const stmt = db.prepare(
    `SELECT
       b.*,
       COUNT(t.id) AS total_rows_live,
       COUNT(t.id) FILTER (WHERE te.transaction_id IS NOT NULL) AS embedded_rows_live,
       COUNT(t.id) FILTER (WHERE t.needs_review = 0 AND t.category_source != 'unknown') AS auto_categorized_rows_live,
       COUNT(t.id) FILTER (WHERE t.needs_review = 1) AS needs_review_rows_live
     FROM import_batches b
     LEFT JOIN transactions t ON t.import_batch_id = b.id
     LEFT JOIN transaction_embeddings te ON te.transaction_id = t.id
     WHERE b.id = ?
     GROUP BY b.id`
  );
  return stmt.get(id);
}

export function getActiveEmbeddingModel(db: Database): { name: string; dimension: number } | null {
  const stmt = db.prepare(
    `SELECT model_name, dimension FROM embedding_models WHERE is_active = 1 LIMIT 1`
  );
  const result = stmt.get() as any;
  if (!result) return null;
  return { name: result.model_name, dimension: result.dimension };
}

// Transactions
export function insertTransactions(
  db: Database,
  transactions: Array<{
    userId: string;
    importBatchId: string;
    postedAt: string;
    amountCents: number;
    currency: string;
    merchantRaw?: string;
    descriptionRaw?: string;
    merchantClean?: string;
    textForEmbedding?: string;
    categoryId?: string;
    categorySource: CategorySource;
    categoryConfidence?: number;
    needsReview: boolean;
    accountId?: string | null;
    type?: string;
  }>
): void {
  if (transactions.length === 0) return;

  const buildTxHash = (t: {
    merchantRaw?: string;
    descriptionRaw?: string;
    merchantClean?: string;
    amountCents: number;
    postedAt: string;
    currency: string;
  }): string => {
    return createHash('sha256')
      .update(
        `${t.merchantRaw ?? ''}${t.descriptionRaw ?? ''}${t.merchantClean ?? ''}${t.amountCents}${t.postedAt}${t.currency}`
      )
      .digest('hex');
  };

  // Prepare insert statement once for performance
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO transactions (
      user_id, import_batch_id, posted_at, amount_cents, currency,
      merchant_raw, description_raw, merchant_clean, text_for_embedding,
      category_id, category_source, category_confidence, needs_review,
      account_id, type, tx_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((txs: any[]) => {
    for (const t of txs) {
      stmt.run(
        t.userId,
        t.importBatchId,
        t.postedAt,
        t.amountCents,
        t.currency,
        t.merchantRaw ?? null,
        t.descriptionRaw ?? null,
        t.merchantClean ?? null,
        t.textForEmbedding ?? null,
        t.categoryId ?? null,
        t.categorySource,
        t.categoryConfidence ?? null,
        t.needsReview ? 1 : 0,
        t.accountId ?? null,
        t.type || 'expense',
        buildTxHash(t)
      );
    }
  });

  tx(transactions);
}

export function getTransactionsForEmbedding(
  db: Database,
  importBatchId: string,
  limit: number = 256
): any[] {
  const stmt = db.prepare(
    `SELECT id, user_id, text_for_embedding
     FROM transactions
     WHERE import_batch_id = ?
       AND text_for_embedding IS NOT NULL
       AND id NOT IN (SELECT transaction_id FROM transaction_embeddings)
     LIMIT ?`
  );
  return stmt.all(importBatchId, limit);
}

export function getUncategorizedTransactions(
  db: Database,
  importBatchId: string
): any[] {
  const stmt = db.prepare(
    `SELECT id, user_id, text_for_embedding, merchant_clean, amount_cents
     FROM transactions
     WHERE import_batch_id = ?
       AND needs_review = 1
     LIMIT 500`
  );
  return stmt.all(importBatchId);
}

// Embeddings
export function insertEmbeddings(
  db: Database,
  embeddings: Array<{ transactionId: number; userId: string; embedding: number[] }>
): void {
  if (embeddings.length === 0) return;

  // Validate embeddings
  for (const e of embeddings) {
    if (!Number.isFinite(e.transactionId)) {
      throw new Error(`Invalid transactionId: ${e.transactionId}`);
    }
    if (typeof e.userId !== 'string' || e.userId.length === 0) {
      throw new Error(`Invalid userId: ${e.userId}`);
    }
    if (!Array.isArray(e.embedding) || e.embedding.length === 0) {
      throw new Error(`Invalid embedding array`);
    }
    for (const val of e.embedding) {
      if (!Number.isFinite(val) || Number.isNaN(val)) {
        throw new Error(`Invalid embedding value: ${val}`);
      }
    }
  }

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO transaction_embeddings (transaction_id, user_id, embedding)
     VALUES (?, ?, ?)`
  );

  const tx = db.transaction((items: any[]) => {
    for (const e of items) {
      stmt.run(e.transactionId, e.userId, serializeEmbedding(e.embedding));
    }
  });

  tx(embeddings);
}

// Labels
export function insertTransactionLabel(
  db: Database,
  transactionId: number,
  userId: string,
  oldCategoryId: string | null,
  newCategoryId: string
): void {
  db.prepare(
    `INSERT INTO transaction_labels (transaction_id, user_id, old_category_id, new_category_id, labeled_by)
     VALUES (?, ?, ?, ?, 'user')`
  ).run(transactionId, userId, oldCategoryId, newCategoryId);
}

export function getLatestLabelsForUser(db: Database, userId: string): Map<number, string> {
  const stmt = db.prepare(
    `SELECT transaction_id, new_category_id
     FROM transaction_labels
     WHERE user_id = ?
     ORDER BY transaction_id, created_at DESC`
  );
  const rows = stmt.all(userId) as Array<{ transaction_id: number; new_category_id: string }>;
  const result = new Map<number, string>();
  // SQLite doesn't support DISTINCT ON, so we filter in JS
  const seen = new Set<number>();
  for (const row of rows) {
    if (!seen.has(row.transaction_id)) {
      result.set(row.transaction_id, row.new_category_id);
      seen.add(row.transaction_id);
    }
  }
  return result;
}

export function getLatestLabelsWithEmbeddings(
  db: Database,
  userId: string,
  limit: number = 1000
): any[] {
  const stmt = db.prepare(
    `WITH latest_labels AS (
       SELECT transaction_id, new_category_id AS category_id
       FROM transaction_labels
       WHERE user_id = ?
       GROUP BY transaction_id
       HAVING created_at = MAX(created_at)
     )
     SELECT ll.transaction_id, ll.category_id, e.embedding
     FROM latest_labels ll
     JOIN transaction_embeddings e ON e.transaction_id = ll.transaction_id
     LIMIT ?`
  );
  return stmt.all(userId, limit);
}

// Category Rules
export function getCategoryRules(
  db: Database,
  userId: string,
  enabledOnly: boolean = true
): any[] {
  const stmt = db.prepare(
    `SELECT id, match_type, match_value, category_id, priority, enabled
     FROM category_rules
     WHERE user_id = ?${enabledOnly ? ' AND enabled = 1' : ''}
     ORDER BY priority ASC, created_at ASC`
  );
  return stmt.all(userId);
}

export function upsertCategoryRule(
  db: Database,
  userId: string,
  matchType: MatchType,
  matchValue: string,
  categoryId: string,
  priority: number = 100,
  enabled: boolean = true
): void {
  db.prepare(
    `INSERT INTO category_rules (user_id, match_type, match_value, category_id, priority, enabled, created_from)
     VALUES (?, ?, ?, ?, ?, ?, 'edit_learning')
     ON CONFLICT (user_id, match_type, match_value, category_id)
     DO UPDATE SET
       category_id = excluded.category_id,
       priority = excluded.priority,
       enabled = excluded.enabled,
       created_from = excluded.created_from,
       created_at = datetime('now')`
  ).run(userId, matchType, matchValue, categoryId, priority, enabled ? 1 : 0);
}

export function disableCategoryRule(
  db: Database,
  userId: string,
  matchType: MatchType,
  matchValue: string
): void {
  db.prepare(
    `UPDATE category_rules SET enabled = 0
     WHERE user_id = ? AND match_type = ? AND match_value = ?`
  ).run(userId, matchType, matchValue);
}

// Review queue
export function getReviewQueue(
  db: Database,
  userId: string,
  limit: number = 100,
  offset: number = 0
): any[] {
  const stmt = db.prepare(
    `SELECT t.id, t.merchant_clean, t.amount_cents, t.posted_at,
            t.category_source, t.category_confidence, t.category_id,
            (SELECT COUNT(*) FROM transactions WHERE user_id = ? AND needs_review = 1) as total_count
     FROM transactions t
     WHERE t.user_id = ? AND t.needs_review = 1
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`
  );
  return stmt.all(userId, userId, limit, offset);
}

export function getReviewQueueByMerchant(
  db: Database,
  userId: string,
  limit: number = 100
): any[] {
  const stmt = db.prepare(
    `WITH ranked_transactions AS (
       SELECT id, merchant_clean, amount_cents, posted_at,
              ROW_NUMBER() OVER (
                PARTITION BY merchant_clean
                ORDER BY amount_cents DESC, id DESC
              ) as rn
       FROM transactions
       WHERE user_id = ? AND needs_review = 1
     ),
     top3 AS (
       SELECT id, merchant_clean, posted_at, amount_cents
       FROM ranked_transactions
       WHERE rn <= 3
     ),
     merchant_stats AS (
       SELECT merchant_clean,
              COUNT(*) as count,
              MIN(posted_at) as first_seen,
              MAX(posted_at) as last_seen
       FROM transactions
       WHERE user_id = ? AND needs_review = 1
       GROUP BY merchant_clean
     )
     SELECT ms.merchant_clean,
            ms.count,
            (SELECT GROUP_CONCAT(id, ',')
             FROM top3 t WHERE t.merchant_clean = ms.merchant_clean) as sample_ids,
            ms.first_seen,
            ms.last_seen
     FROM merchant_stats ms
     ORDER BY ms.count DESC
     LIMIT ?`
  );
  return stmt.all(userId, userId, limit);
}

// Transaction-wrapped operations for multi-statement consistency

export function updateTransactionCategoryWithLabel(
  db: Database,
  transactionId: number,
  userId: string,
  oldCategoryId: string | null,
  newCategoryId: string
): void {
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO transaction_labels (transaction_id, user_id, old_category_id, new_category_id, labeled_by)
       VALUES (?, ?, ?, ?, 'user')`
    ).run(transactionId, userId, oldCategoryId, newCategoryId);

    db.prepare(
      `UPDATE transactions
       SET category_id = ?,
           category_source = 'manual',
           category_confidence = 1.0,
           needs_review = 0
       WHERE id = ?`
    ).run(newCategoryId, transactionId);
  });
  tx();
}

export function applyCategoryRuleForMerchant(
  db: Database,
  userId: string,
  merchant: string,
  categoryId: string
): boolean {
  const result = db.prepare(
    `INSERT INTO category_rules (user_id, match_type, match_value, category_id, priority, enabled, created_from)
     VALUES (?, 'merchant_clean', ?, ?, 100, 1, 'edit_learning')
     ON CONFLICT (user_id, match_type, match_value, category_id)
     DO UPDATE SET category_id = excluded.category_id, enabled = 1
     RETURNING id`
  ).get(userId, merchant, categoryId);
  return !!result;
}

export function applyCategoryRuleToPastTransactions(
  db: Database,
  userId: string,
  merchant: string,
  categoryId: string,
  txType: string
): number {
  const result = db.prepare(
    `UPDATE transactions
     SET category_id = ?,
         category_source = 'rule',
         category_confidence = 0.98,
         needs_review = 0
     WHERE user_id = ?
       AND merchant_clean = ?
       AND category_id IS NULL
       AND type = ?`
  ).run(categoryId, userId, merchant, txType);
  return result.changes;
}

export function updateTransactionNeedsReview(
  db: Database,
  transactionId: number,
  needsReview: boolean
): void {
  db.prepare(`UPDATE transactions SET needs_review = ? WHERE id = ?`).run(
    needsReview ? 1 : 0,
    transactionId
  );
}
