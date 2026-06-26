import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './sqlite.js';
import { logger } from '../utils/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema file is in backend/src/db/schema.sql
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export async function migrateUp(): Promise<void> {
  const db = getDb();

  try {
    const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');

    // Split SQL statements by semicolons
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      if (stmt.trim()) {
        db.prepare(stmt).run();
      }
    }

    logger.info('[migration] SQLite schema applied successfully');
  } catch (error: any) {
    logger.error(`[migration] Error applying schema: ${error.message}`);
    throw error;
  }
}

export async function migrateDown(): Promise<void> {
  const db = getDb();

  try {
    // For SQLite, we'll just drop all tables (reverse order of creation)
    const tables = [
      'transaction_classification_keywords',
      'merchant_normalization_replacements',
      'merchant_noise_tokens',
      'merchant_normalization_rules',
      'categories',
      'accounts',
      'category_rules',
      'transaction_labels',
      'transaction_embeddings',
      'transactions',
      'import_batches',
      'embedding_models',
    ];

    for (const table of tables) {
      db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }

    logger.info('[migration] SQLite schema dropped successfully');
  } catch (error: any) {
    logger.error(`[migration] Error dropping schema: ${error.message}`);
    throw error;
  }
}

// Split SQL statements by semicolons, respecting:
// - Single-quoted string literals (including escaped quotes '')
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // Toggle single-quoted string state (handle escaped quotes '')
    if (ch === "'") {
      inSingleQuote = !inSingleQuote;
      current += ch;
      i++;
      continue;
    }

    // Statement terminator — only outside any quoting context
    if (!inSingleQuote && ch === ';') {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}
