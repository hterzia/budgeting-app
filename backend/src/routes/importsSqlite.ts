import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from 'better-sqlite3';
import Papa from 'papaparse';
import { detectTemplate, normalizeDate, parseAmount, getField, classifyTransaction } from '../utils/csv.js';
import {
  buildTextForEmbedding,
  categorizeTransactionsSqlite,
} from '../services/categorizeSqlite.js';
import { generateEmbeddingsInBatches } from '../services/localEmbeddings.js';
import {
  loadMerchantNormalizationConfig,
  normalizeMerchant,
} from '../services/merchantNormalization.js';
import {
  loadTransactionClassificationConfig,
} from '../services/transactionClassification.js';
import {
  createImportBatch,
  updateImportBatchStatus,
  getImportBatch,
  insertTransactions,
  getTransactionsForEmbedding,
  insertEmbeddings,
} from '../db/sqliteQueries.js';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

function normalizeAmountCentsForType(
  amountCents: number,
  txType: string,
  accountType: string
): number {
  const absAmountCents = Math.abs(amountCents);
  if (txType === 'expense') {
    return -absAmountCents;
  }
  if (txType === 'transfer') {
    // Credit card statements should store payments/transfers as positive.
    // For checking/savings, preserve source direction (inflow/outflow).
    return accountType === 'credit_card' ? absAmountCents : amountCents;
  }
  if (txType === 'income' || txType === 'refund') {
    return absAmountCents;
  }
  return amountCents;
}

export function createImportRouter(db: Database): Router {
  const router = Router();

  // POST /imports - Upload and start import process
  router.post('/', async (req: Request, res): Promise<any> => {
    try {
      const { file, userId, accountId, invertAmountSign } = req.body;
      const shouldInvertAmountSign = invertAmountSign === true;

      if (!file || !userId) {
        return res.status(400).json({ error: 'Missing file or userId' });
      }

      const importId = uuidv4();
      console.log(
        `[import/upload] start importId=${importId} userId=${userId} accountId=${accountId ?? 'none'} invertAmountSign=${shouldInvertAmountSign}`
      );

      // Parse CSV
      const parseResult = Papa.parse(file, { header: true });
      // Bug 1 fix: normalize all row keys to lowercase so template column lookups work
      // regardless of whether the CSV headers are Title Case or lowercase.
      const rows = parseResult.data.map((row: any) => {
        const normalized: any = {};
        for (const key of Object.keys(row)) {
          normalized[key.toLowerCase()] = row[key];
        }
        return normalized;
      }).filter((row: any) => row && Object.values(row).some((v: any) => v && String(v).trim()));

      if (rows.length === 0) {
        return res.status(400).json({ error: 'No valid rows found in CSV' });
      }

      // Detect template based on headers
      const template = detectTemplate(parseResult.meta.fields || []);
      console.log(
        `[import/upload] parsed importId=${importId} headers=${parseResult.meta.fields?.length ?? 0} rows=${rows.length} template=${template?.name ?? 'unknown'}`
      );

      // Use persisted account type for correct transaction classification.
      let accountType: string = 'checking';
      if (accountId) {
        const accountRowRaw = db.prepare(
          `SELECT type FROM accounts WHERE id = ? AND user_id = ? LIMIT 1`
        ).get(accountId, userId);
        const accountRow = accountRowRaw as { type?: string };
        if (accountRow?.type) {
          accountType = accountRow.type;
        }
      }
      console.log(
        `[import/upload] account importId=${importId} accountType=${accountType}`
      );

      // Create import batch
      createImportBatch(db, importId, userId, rows.length, accountId || null);
      const normalizationConfig = loadMerchantNormalizationConfig(db, userId);
      const classificationConfig = loadTransactionClassificationConfig(db, userId);
      console.log(
        `[import/upload] config importId=${importId} normalization={replacements:${normalizationConfig.replacements.length},noise:${normalizationConfig.noiseTokens.length},canonical:${normalizationConfig.canonicalRules.length}} classification={checkingTransfer:${classificationConfig.checkingTransferKeywords.length},creditCardTransfer:${classificationConfig.creditCardTransferKeywords.length},refund:${classificationConfig.refundKeywords.length},knownCheckingTransfer:${classificationConfig.knownCheckingTransferKeywords.length}}`
      );

      // Normalize and insert transactions
      const transactions = rows.map((row: any) => {
        let date = '';
        let amount = 0;
        let merchant = '';
        let description = '';

        if (template) {
          // Bug 1 fix: use lowercase column names to match normalized row keys
          date = normalizeDate(row[template.dateColumn.toLowerCase()] || '', template.datePattern);
          amount = parseAmount(row[template.amountColumn.toLowerCase()]);
          merchant = row[template.merchantColumn.toLowerCase()] || '';
          description = template.typeColumn ? row[template.typeColumn.toLowerCase()] || '' : '';
        } else {
          // Fallback: try common column names
          const dateFields = ['Transaction Date', 'Date', 'Posting Date', 'date', 'transaction_date', 'Start date', 'Posted Date'];
          const amountFields = ['Amount', 'amount'];
          const merchantFields = ['Description', 'Payee', 'merchant', 'description', 'payee'];
          const descFields = ['Message', 'Details', 'message', 'details'];

          date = normalizeDate(getField(row, dateFields) || '', 'YYYY-MM-DD');
          amount = parseAmount(getField(row, amountFields));
          merchant = getField(row, merchantFields) || '';
          description = getField(row, descFields) || '';
        }

        const signedAmount = shouldInvertAmountSign ? -amount : amount;
        const merchantClean = normalizeMerchant(merchant, description, normalizationConfig);

        const rawAmountCents = Math.round(signedAmount * 100);
        // Bug 4A fix: classify type using the existing classifyTransaction utility
        const typeColumnValue = template?.typeColumn ? row[template.typeColumn.toLowerCase()] || undefined : undefined;
        const txType = classifyTransaction(
          merchant,
          signedAmount,
          accountType,
          typeColumnValue,
          classificationConfig
        );
        // Ensure amount sign always matches the DB constraint for transaction type.
        const amountCents = normalizeAmountCentsForType(rawAmountCents, txType, accountType);

        // Read currency from CSV if present, default to USD
        // Check for common currency column names (case-insensitive)
        const currencyField = row.currency || row['Currency'] || row['CURRENCY'];
        const currency = currencyField && String(currencyField).length > 0
          ? String(currencyField).toUpperCase().trim().slice(0, 3)
          : 'USD';

        // Build text for embedding
        const textForEmbedding = buildTextForEmbedding({
          merchantClean,
          descriptionRaw: description,
          amountCents: amountCents,
        });

        return {
          userId,
          importBatchId: importId,
          postedAt: date,
          amountCents,
          currency: currency,
          merchantRaw: merchant,
          descriptionRaw: description,
          merchantClean,
          textForEmbedding,
          needsReview: true,
          categorySource: 'unknown' as const,
          // Bug 2 fix: include accountId so it gets stored on each transaction
          accountId: accountId || null,
          // Bug 4A fix: store computed type
          type: txType,
        };
      });

      const uploadStats = transactions.reduce(
        (acc, tx) => {
          if (tx.merchantRaw !== tx.merchantClean) acc.normalizedMerchantChanged++;
          if (tx.amountCents > 0) acc.positiveAmountCount++;
          else if (tx.amountCents < 0) acc.negativeAmountCount++;
          else acc.zeroAmountCount++;
          acc.typeCounts[tx.type] = (acc.typeCounts[tx.type] ?? 0) + 1;
          return acc;
        },
        {
          normalizedMerchantChanged: 0,
          positiveAmountCount: 0,
          negativeAmountCount: 0,
          zeroAmountCount: 0,
          typeCounts: {} as Record<string, number>,
        }
      );
      console.log(
        `[import/upload] prepared importId=${importId} tx=${transactions.length} normalizedMerchantChanged=${uploadStats.normalizedMerchantChanged} amounts={pos:${uploadStats.positiveAmountCount},neg:${uploadStats.negativeAmountCount},zero:${uploadStats.zeroAmountCount}} types=${JSON.stringify(uploadStats.typeCounts)}`
      );

      insertTransactions(db, transactions);
      console.log(`[import/upload] inserted importId=${importId} tx=${transactions.length}`);

      // Update batch status
      updateImportBatchStatus(db, importId, 'uploaded');

      res.status(202).json({ importId, status: 'uploaded', totalRows: transactions.length, template: template?.name || 'unknown' });
    } catch (error: any) {
      console.error('[import] Error:', error.message);
      console.error('[import] Stack:', error.stack);
      res.status(500).json({ error: 'Failed to process import', details: error.message });
    }
  });

  // GET /imports/:id - Get import batch status
  router.get('/:id', (req: Request, res): any => {
    try {
      const { id } = req.params;
      const batch = getImportBatch(db, id);

      if (!batch) {
        return res.status(404).json({ error: 'Import batch not found' });
      }

      res.json({
        id: batch.id,
        userId: batch.user_id,
        accountId: batch.account_id,
        status: batch.status,
        totalRows: batch.total_rows,
        embeddedRows: batch.embedded_rows_live ?? 0,
        autoCategorizedRows: batch.auto_categorized_rows_live ?? 0,
        needsReviewRows: batch.needs_review_rows_live ?? 0,
        errorMessage: batch.error_message,
        createdAt: batch.created_at,
        completedAt: batch.completed_at,
      });
    } catch (error: any) {
      console.error('[import] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch import status' });
    }
  });

  // GET /imports/:id/review-queue - Get review queue
  router.get('/:id/review-queue', (req: Request, res): any => {
    try {
      const { id } = req.params;
      const { limit = 100, offset = 0 } = req.query as any;

      const stmt = db.prepare(
        `SELECT t.id, t.merchant_clean, t.amount_cents, t.posted_at,
                t.category_source, t.category_confidence, t.category_id
         FROM transactions t
         WHERE t.import_batch_id = ? AND t.needs_review = 1
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`
      );
      const rows = stmt.all(id, limit, offset);

      res.json({
        transactions: (rows as any[]).map(row => ({
          id: row.id,
          merchantClean: row.merchant_clean,
          amountCents: row.amount_cents,
          postedAt: row.posted_at,
          categorySource: row.category_source,
          categoryConfidence: row.category_confidence,
          categoryId: row.category_id,
        })),
        totalCount: rows.length,
      });
    } catch (error: any) {
      console.error('[import] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch review queue' });
    }
  });

  // POST /imports/:id/process - Trigger processing (embedding + categorization)
  router.post('/:id/process', async (req: Request, res): Promise<any> => {
    try {
      const { id } = req.params;
      const batch = getImportBatch(db, id);

      if (!batch) {
        return res.status(404).json({ error: 'Import batch not found' });
      }

      if (batch.status !== 'uploaded') {
        return res.status(400).json({ error: `Batch is already ${batch.status}` });
      }
      console.log(
        `[import/process] start importId=${id} userId=${batch.user_id} status=${batch.status} totalRows=${batch.total_rows}`
      );

      // Update status to parsing/embedding
      updateImportBatchStatus(db, id, 'parsing');

      try {
        // Get transactions for embedding
        const transactions = getTransactionsForEmbedding(db, id, 256);
        console.log(
          `[import/process] embedding-candidates importId=${id} count=${transactions.length}`
        );

        if (transactions.length > 0) {
          updateImportBatchStatus(db, id, 'embedding');

          const userId = transactions[0]?.user_id;

          // Get texts for embedding
          const texts = transactions.map((t: any) => t.text_for_embedding);

          // Generate embeddings (async call)
          const embeddings = await generateEmbeddingsInBatches(texts);

          // Store embeddings
          const embeddingRecords = embeddings.map((embedding: number[], i: number) => ({
            transactionId: transactions[i].id,
            userId,
            embedding,
          }));

          insertEmbeddings(db, embeddingRecords);
          console.log(
            `[import/process] embedding-stored importId=${id} count=${embeddingRecords.length}`
          );

          // Update embedded rows count
          updateImportBatchStatus(db, id, 'embedding', {
            embeddedRows: embeddingRecords.length,
          });
        } else {
          console.log(`[import/process] embedding-skip importId=${id} reason=no_candidates`);
        }
      } catch (error: any) {
        console.warn('[process] Embedding generation failed, continuing with categorization:', error.message);
      }

      // Categorize
      updateImportBatchStatus(db, id, 'categorizing');

      const result = await categorizeTransactionsSqlite(db, id, batch.user_id);
      console.log(
        `[import/process] categorize-result importId=${id} total=${result.total} rule=${result.ruleMatched} knn=${result.knnMatched} keyword=${result.keywordMatched} needsReview=${result.needsReview}`
      );

      // Update batch status to completed
      updateImportBatchStatus(db, id, 'completed', {
        autoCategorizedRows: result.ruleMatched + result.knnMatched + result.keywordMatched,
        needsReviewRows: result.needsReview,
        completedAt: new Date().toISOString(),
      });

      res.json({
        status: 'completed',
        result: {
          total: result.total,
          ruleMatched: result.ruleMatched,
          knnMatched: result.knnMatched,
          keywordMatched: result.keywordMatched,
          needsReview: result.needsReview,
        },
      });
      console.log(`[import/process] completed importId=${id}`);
    } catch (error: any) {
      console.error('[import/process] Error:', error.message);
      updateImportBatchStatus(db, (req.params as any).id, 'failed', {
        errorMessage: error.message,
      });
      res.status(500).json({ error: 'Failed to process import' });
    }
  });

  // GET /imports - List all import batches with stats
  router.get('/', (req: Request, res): any => {
    try {
      const stmt = db.prepare(
        `SELECT
          id,
          user_id,
          account_id,
          status,
          total_rows,
          embedded_rows,
          auto_categorized_rows,
          needs_review_rows,
          error_message,
          created_at,
          completed_at
         FROM import_batches
         WHERE user_id = ?
         ORDER BY created_at DESC`
      );
      const rows = stmt.all(DEFAULT_USER_ID);

      const mapped = (rows as any[]).map(row => ({
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        status: row.status,
        totalRows: row.total_rows ?? 0,
        embeddedRows: row.embedded_rows ?? 0,
        autoCategorizedRows: row.auto_categorized_rows ?? 0,
        needsReviewRows: row.needs_review_rows ?? 0,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      }));

      res.json({
        imports: mapped,
        totalCount: mapped.length,
      });
    } catch (error: any) {
      console.error('[imports/list] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch imports' });
    }
  });

  // GET /imports/:id/transactions - Get transactions for a specific import
  router.get('/:id/transactions', (req: Request, res): any => {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query as any;

      const stmt = db.prepare(
        `SELECT
          id,
          merchant_clean,
          amount_cents,
          posted_at,
          currency,
          category_id,
          category_source,
          needs_review
         FROM transactions
         WHERE import_batch_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      );
      const rows = stmt.all(id, limit, offset);

      const countStmt = db.prepare(
        `SELECT COUNT(*) as total FROM transactions WHERE import_batch_id = ?`
      );
      const countRow = countStmt.get(id);

      res.json({
        transactions: (rows as any[]).map(row => ({
          id: row.id,
          merchantClean: row.merchant_clean,
          amountCents: row.amount_cents,
          postedAt: row.posted_at,
          currency: row.currency,
          categoryId: row.category_id,
          categorySource: row.category_source,
          needsReview: !!row.needs_review,
        })),
        totalCount: (countRow as any).total,
      });
    } catch (error: any) {
      console.error('[imports/transactions] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // DELETE /imports/:id - Delete an import batch and associated data
  router.delete('/:id', (req: Request, res): any => {
    try {
      const { id } = req.params;

      // Delete associated transaction embeddings
      db.prepare(
        `DELETE FROM transaction_embeddings
         WHERE transaction_id IN (
           SELECT id FROM transactions WHERE import_batch_id = ?
         )`
      ).run(id);

      // Delete category rules created from this import's transactions
      db.prepare(
        `DELETE FROM category_rules
         WHERE user_id = ?
           AND match_type = 'merchant_clean'
           AND match_value IN (
             SELECT DISTINCT merchant_clean
             FROM transactions
             WHERE import_batch_id = ?
               AND merchant_clean IS NOT NULL
         )`
      ).run(DEFAULT_USER_ID, id);

      // Delete associated transaction labels
      db.prepare(
        `DELETE FROM transaction_labels
         WHERE transaction_id IN (
           SELECT id FROM transactions WHERE import_batch_id = ?
         )`
      ).run(id);

      // Delete the import batch (cascades to transactions)
      const deleteResult = db.prepare(`DELETE FROM import_batches WHERE id = ?`).run(id);

      if (deleteResult.changes === 0) {
        return res.status(404).json({ error: 'Import batch not found' });
      }

      res.json({ status: 'deleted', importId: id });
    } catch (error: any) {
      console.error('[imports/delete] Error:', error.message);
      res.status(500).json({ error: 'Failed to delete import' });
    }
  });

  return router;
}

export function createTransactionRouter(db: Database): Router {
  const router = Router();

  // Disable HTTP caching for transaction mutation endpoints.
  router.use((req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
    return;
  });

  // POST /transactions/:id/category - Update transaction category
  router.post('/:id/category', (req: Request, res): any => {
    try {
      const { id } = req.params;
      const { categoryId, applyToMerchant, applyToPast } = req.body;

      if (!categoryId) {
        return res.status(400).json({ error: 'Missing categoryId' });
      }

      // Get existing transaction (with user_id filter for multi-user safety)
      interface TransactionRow {
        id: number;
        user_id: string;
        category_id: string | null;
        category_source: string;
        merchant_clean: string | null;
        type: string;
      }
      const existingRaw = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, DEFAULT_USER_ID);
      const existing = existingRaw as TransactionRow;

      if (!existing) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const tx = existing;

      // Validate category type matches transaction type
      const categoryRowRaw = db.prepare('SELECT type FROM categories WHERE id = ? AND user_id = ?').get(categoryId, DEFAULT_USER_ID);
      const categoryRow = categoryRowRaw as { type?: string };
      if (!categoryRow) {
        return res.status(400).json({ error: 'Category not found' });
      }

      // Map transaction type to category type for comparison
      // Refunds are treated as expenses for category matching
      const getCategoryTypeForTransaction = (type: string): string => {
        if (type === 'refund') return 'expense';
        return type;
      };

      const categoryType = categoryRow.type;
      const transactionCategoryType = getCategoryTypeForTransaction((tx as any).type);

      if (categoryType !== transactionCategoryType) {
        return res.status(400).json({
          error: `Category type '${categoryType}' does not match transaction type '${(tx as any).type}'`,
        });
      }

      // Update transaction category with edit learning in a transaction
      // This wraps label insertion and transaction update in a single atomic operation
      try {
        db.transaction(() => {
          // Record the category change in transaction_labels
          db.prepare(
            `INSERT OR IGNORE INTO transaction_labels (transaction_id, user_id, old_category_id, new_category_id, labeled_by)
             VALUES (?, ?, ?, ?, 'user')`
          ).run(id, (tx as any).user_id, (tx as any).category_id, categoryId);

          // Update the transaction with the new category
          db.prepare(
            `UPDATE transactions
             SET category_id = ?,
                 category_source = 'manual',
                 category_confidence = 1.0,
                 needs_review = 0
             WHERE id = ?`
          ).run(categoryId, id);
        })();
      } catch (error: any) {
        console.error('[transaction/category] Transaction rollback:', error.message);
        throw error;
      }

      let ruleApplied = false;

      // Apply to future transactions from this merchant if requested
      // Validate merchant_clean is non-empty before creating rule
      if (applyToMerchant && (tx as any).merchant_clean?.trim()) {
        const merchant = (tx as any).merchant_clean.trim();
        const result = db.prepare(
          `INSERT INTO category_rules (user_id, match_type, match_value, category_id, priority, enabled, created_from)
           VALUES (?, 'merchant_clean', ?, ?, 100, 1, 'edit_learning')
           ON CONFLICT (user_id, match_type, match_value, category_id)
           DO UPDATE SET category_id = excluded.category_id, enabled = 1
           RETURNING id`
        ).get((tx as any).user_id, merchant, categoryId);
        ruleApplied = !!result;
      }

      // Apply to past uncategorized matches if requested
      // Include type filter to prevent applying expense rules to income transactions
      if (applyToPast && (tx as any).merchant_clean?.trim()) {
        const merchant = (tx as any).merchant_clean.trim();
        // For refunds, also apply to past uncategorized expenses (since refunds reduce expense categories)
        const pastTypeFilter = (tx as any).type === 'refund' ? ['expense', 'refund'] : [(tx as any).type];

        for (const type of pastTypeFilter) {
          db.prepare(
            `UPDATE transactions
             SET category_id = ?,
                 category_source = 'rule',
                 category_confidence = 0.98,
                 needs_review = 0
             WHERE user_id = ?
               AND merchant_clean = ?
               AND category_id IS NULL
               AND type = ?`
          ).run(categoryId, tx.user_id, merchant, type);
        }
      }

      res.json({
        status: 'updated',
        transactionId: id,
        categoryId,
        ruleApplied,
      });
    } catch (error: any) {
      console.error('[transaction/category] Error:', error.message);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  return router;
}
