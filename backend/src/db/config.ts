import path from 'path';
import * as dotenv from 'dotenv';
import fs from 'fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

// Load .env.local file
dotenv.config({ path: new URL('../..', import.meta.url).pathname + '/.env.local' });

// SQLite uses a file path, not connection string
const DB_PATH =
  process.env['SQLITE_DB_PATH'] ||
  path.join(path.dirname(new URL('.', import.meta.url).pathname), '..', '.local-db', 'budgeting.db');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create a singleton database instance
let dbInstance: DatabaseType | null = null;

export function getDb(): DatabaseType {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// For backward compatibility with existing code that expects a pool-like interface
export interface DatabaseConfig {
  type: 'sqlite';
}

export function getDatabaseConfig(): DatabaseConfig {
  return { type: 'sqlite' };
}

// Note: SQLite doesn't need connection pooling
export function createPool(): any {
  return getDb();
}

export function getConnectionUrl(): string {
  return `sqlite://${DB_PATH}`;
}
