import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logging.js';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path - use userData directory for persistence
const DB_PATH = path.join(
  process.env['USER_DATA_DIR'] ||
    path.join(path.dirname(__dirname), '..', '..', '.local-db'),
  'budgeting.db'
);

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance: DatabaseType | null = null;

export function getDb(): DatabaseType {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');

    // Enable foreign keys
    dbInstance.pragma('foreign_keys = ON');

    logger.info(`[sqlite] Database initialized at ${DB_PATH}`);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('[sqlite] Database closed');
  }
}
