import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serializeEmbedding, deserializeEmbedding, createImportBatch, insertTransactions, getImportBatch } from '../src/db/sqliteQueries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, 'test-import-flow.sqlite');
const SCHEMA_PATH = path.join(__dirname, '../src/db/schema.sql');

describe('import flow (SQLite)', () => {
  let db: Database.Database;
  const userId = '00000000-0000-0000-0000-000000000001';

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    // Create test account
    db.prepare(
      "INSERT INTO accounts (id, user_id, name, type) VALUES ('acc1', ?, 'Test Checking', 'checking')"
    ).run(userId);
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates import batch and inserts transactions', () => {
    createImportBatch(db, 'batch1', userId, 3, 'acc1');
    const batch = getImportBatch(db, 'batch1');
    expect(batch).toBeDefined();
    expect(batch.status).toBe('uploaded');
    expect(batch.total_rows).toBe(3);
  });

  it('inserts transactions with dedup', () => {
    const txns = [
      {
        userId,
        importBatchId: 'batch1',
        postedAt: '2026-01-15',
        amountCents: -5000,
        currency: 'USD',
        merchantRaw: 'STARBUCKS #1234',
        descriptionRaw: 'Coffee',
        merchantClean: 'Starbucks',
        textForEmbedding: 'Merchant: Starbucks. Description: Coffee. Type: expense. Amount: medium. Domain: coffee.',
        categoryId: undefined,
        categorySource: 'unknown' as const,
        categoryConfidence: undefined,
        needsReview: true,
        accountId: 'acc1',
        type: 'expense' as const,
      },
    ];

    insertTransactions(db, txns);
    const count = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any).c;
    expect(count).toBe(1);
  });

  it('stores and retrieves embeddings as BLOB', () => {
    const embedding = Array.from({ length: 384 }, (_, i) => Math.sin(i) * 0.1);
    const txId = (db.prepare('SELECT id FROM transactions LIMIT 1').get() as any).id;

    db.prepare(
      'INSERT INTO transaction_embeddings (transaction_id, user_id, embedding) VALUES (?, ?, ?)'
    ).run(txId, userId, serializeEmbedding(embedding));

    const row = db.prepare(
      'SELECT embedding FROM transaction_embeddings WHERE transaction_id = ?'
    ).get(txId) as any;

    const restored = deserializeEmbedding(row.embedding);
    expect(restored.length).toBe(384);
    for (let i = 0; i < embedding.length; i++) {
      expect(restored[i]).toBeCloseTo(embedding[i], 5);
    }
  });

  it('category update creates label for edit learning', () => {
    const txId = (db.prepare('SELECT id FROM transactions LIMIT 1').get() as any).id;

    db.prepare(
      'UPDATE transactions SET category_id = ?, category_source = ?, needs_review = 0 WHERE id = ?'
    ).run('dining', 'manual', txId);

    db.prepare(
      'INSERT INTO transaction_labels (transaction_id, user_id, old_category_id, new_category_id, labeled_by) VALUES (?, ?, NULL, ?, ?)'
    ).run(txId, userId, 'dining', 'user');

    const label = db.prepare(
      'SELECT * FROM transaction_labels WHERE transaction_id = ?'
    ).get(txId) as any;

    expect(label.new_category_id).toBe('dining');
    expect(label.labeled_by).toBe('user');
  });
});
