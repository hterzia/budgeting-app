import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool, getDatabaseConfig } from './config.js';

// Split SQL statements by semicolons, respecting:
// - Single-quoted string literals (including escaped quotes '')
// - Dollar-quoted string literals ($$ ... $$ or $tag$ ... $tag$)
// This prevents breaking SQL functions and DO blocks that contain semicolons
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let dollarTag: string | null = null;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // Toggle single-quoted string state (handle escaped quotes '')
    if (!dollarTag && ch === "'") {
      inSingleQuote = !inSingleQuote;
      current += ch;
      i++;
      continue;
    }

    // Dollar-quote: scan for the full tag (e.g. $$ or $body$)
    if (!inSingleQuote && !dollarTag && ch === '$') {
      const end = sql.indexOf('$', i + 1);
      if (end !== -1) {
        const tag = sql.slice(i, end + 1);
        dollarTag = tag;
        current += tag;
        i = end + 1;
        continue;
      }
    }

    // Closing dollar-quote tag
    if (!inSingleQuote && dollarTag && sql.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length;
      dollarTag = null;
      continue;
    }

    // Statement terminator — only outside any quoting context
    if (!inSingleQuote && !dollarTag && ch === ';') {
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migrations folder is in backend/migrations (two levels up from src/db)
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

export interface Migration {
  id: string;
  name: string;
  file: string;
}

export async function getMigrations(): Promise<Migration[]> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('_rollback.sql'));
  return files
    .sort()
    .map((file) => {
      const id = file.split('_')[0];
      const name = file.replace('.sql', '');
      return { id, name, file };
    });
}

export async function getAppliedMigrations(pool: any): Promise<string[]> {
  const result = await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );

  const rows = await pool.query('SELECT id FROM schema_migrations ORDER BY id');
  return rows.rows.map((r: any) => r.id);
}

export async function markMigrationApplied(pool: any, id: string): Promise<void> {
  await pool.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
}

export async function markMigrationRolledBack(pool: any, id: string): Promise<void> {
  await pool.query('DELETE FROM schema_migrations WHERE id = $1', [id]);
}

export async function runMigration(pool: any, migration: Migration): Promise<void> {
  const sqlPath = path.join(MIGRATIONS_DIR, migration.file);
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const statements = splitSqlStatements(sql);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  await markMigrationApplied(pool, migration.id);
  console.log(`[migration] Applied: ${migration.name}`);
}

export async function rollbackMigration(pool: any, migration: Migration): Promise<void> {
  // Try to find a rollback SQL file for this migration
  const rollbackPath = path.join(MIGRATIONS_DIR, migration.file.replace('.sql', '_rollback.sql'));

  if (fs.existsSync(rollbackPath)) {
    const sql = fs.readFileSync(rollbackPath, 'utf-8');
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log(`[migration] Executed rollback for: ${migration.name}`);
  } else {
    console.warn(`[migration] No rollback file found for: ${migration.name} - marking as rolled back without DDL`);
  }

  await markMigrationRolledBack(pool, migration.id);
}

export async function migrateUp(pool: any): Promise<void> {
  const migrations = await getMigrations();
  const applied = await getAppliedMigrations(pool);

  const pending = migrations.filter((m) => !applied.includes(m.id));

  if (pending.length === 0) {
    console.log('[migration] No pending migrations');
    return;
  }

  console.log(`[migration] Running ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    await runMigration(pool, migration);
  }

  console.log('[migration] All migrations applied successfully');
}

export async function migrateDown(pool: any, toId?: string): Promise<void> {
  const migrations = await getMigrations();
  const applied = await getAppliedMigrations(pool);

  const toRollback = migrations.filter(
    (m) => applied.includes(m.id) && (!toId || m.id > toId)
  );

  if (toRollback.length === 0) {
    console.log('[migration] Nothing to rollback');
    return;
  }

  console.log(`[migration] Rolling back ${toRollback.length} migration(s)...`);

  // Rollback in reverse order
  for (const migration of toRollback.reverse()) {
    await rollbackMigration(pool, migration);
  }

  console.log('[migration] Rollback complete');
}
