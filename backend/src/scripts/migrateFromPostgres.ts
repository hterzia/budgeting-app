// NOTE: This script requires 'pg' to be installed:
//   cd backend && npm install pg
// It's not included as a dependency since it's only needed for one-time migration.

import pg from 'pg';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateEmbeddings, initEmbeddingModel } from '../services/localEmbeddings.js';
import { serializeEmbedding } from '../db/sqliteQueries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMBEDDING_BATCH_SIZE = 64;

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error('Usage: tsx src/scripts/migrateFromPostgres.ts <output.sqlite>');
    console.error('');
    console.error('Environment variables:');
    console.error('  POSTGRES_HOST     (required)');
    console.error('  POSTGRES_PORT     (default: 5432)');
    console.error('  POSTGRES_DB       (required)');
    console.error('  POSTGRES_USER     (required)');
    console.error('  POSTGRES_PASSWORD (required)');
    process.exit(1);
  }

  const required = ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // 1. Connect to PostgreSQL
  const pool = new pg.Pool({
    host: process.env['POSTGRES_HOST'],
    port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
    database: process.env['POSTGRES_DB'],
    user: process.env['POSTGRES_USER'],
    password: process.env['POSTGRES_PASSWORD'],
  });

  console.log('Connected to PostgreSQL');

  // 2. Create SQLite database and apply schema
  const db = new Database(outputPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('SQLite schema applied');

  // 3. Migrate each table
  const simpleTables = [
    'accounts',
    'categories',
    'import_batches',
    'category_rules',
    'merchant_normalization_rules',
    'merchant_noise_tokens',
    'merchant_normalization_replacements',
    'transaction_classification_keywords',
  ];

  for (const table of simpleTables) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows (skipped)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    const insertAll = db.transaction((data: any[]) => {
      for (const row of data) {
        const values = columns.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return null;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (v instanceof Date) return v.toISOString();
          return v;
        });
        stmt.run(...values);
      }
    });

    insertAll(rows);
    console.log(`  ${table}: ${rows.length} rows`);
  }

  // 4. Migrate transactions
  {
    const { rows } = await pool.query('SELECT * FROM transactions');
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]).filter(c => c !== 'embedding');
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO transactions (${columns.join(', ')}) VALUES (${placeholders})`
      );

      const insertAll = db.transaction((data: any[]) => {
        for (const row of data) {
          const values = columns.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return null;
            if (typeof v === 'boolean') return v ? 1 : 0;
            if (v instanceof Date) return v.toISOString();
            return v;
          });
          stmt.run(...values);
        }
      });

      insertAll(rows);
      console.log(`  transactions: ${rows.length} rows`);
    }
  }

  // 5. Migrate transaction_labels
  {
    const { rows } = await pool.query('SELECT * FROM transaction_labels');
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO transaction_labels (${columns.join(', ')}) VALUES (${placeholders})`
      );

      const insertAll = db.transaction((data: any[]) => {
        for (const row of data) {
          const values = columns.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return null;
            if (v instanceof Date) return v.toISOString();
            return v;
          });
          stmt.run(...values);
        }
      });

      insertAll(rows);
      console.log(`  transaction_labels: ${rows.length} rows`);
    }
  }

  // 6. Re-generate embeddings with MiniLM
  console.log('\nRe-generating embeddings with MiniLM...');
  await initEmbeddingModel();

  const transactions = db.prepare(
    'SELECT id, user_id, text_for_embedding FROM transactions WHERE text_for_embedding IS NOT NULL'
  ).all() as Array<{ id: number; user_id: string; text_for_embedding: string }>;

  const embStmt = db.prepare(
    'INSERT OR REPLACE INTO transaction_embeddings (transaction_id, user_id, embedding) VALUES (?, ?, ?)'
  );

  for (let i = 0; i < transactions.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = transactions.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map(t => t.text_for_embedding);
    const embeddings = await generateEmbeddings(texts);

    const insertBatch = db.transaction((items: typeof batch) => {
      for (let j = 0; j < items.length; j++) {
        embStmt.run(items[j].id, items[j].user_id, serializeEmbedding(embeddings[j]));
      }
    });
    insertBatch(batch);

    console.log(`  Embedded ${Math.min(i + EMBEDDING_BATCH_SIZE, transactions.length)}/${transactions.length}`);
  }

  console.log('\nMigration complete!');
  console.log(`Output: ${path.resolve(outputPath)}`);

  db.close();
  await pool.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
