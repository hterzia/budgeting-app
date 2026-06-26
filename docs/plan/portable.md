# Portable Budgeting App — Implementation Plan

> **Goal:** Convert the budgeting app from a server-dependent architecture (PostgreSQL + vLLM + Ollama) into a fully self-contained desktop application that runs offline on Mac and Windows with 8GB RAM and no GPU.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Database Migration (PostgreSQL → SQLite)](#2-phase-1-database-migration-postgresql--sqlite)
3. [Phase 2: Embedding Migration (vLLM → Transformers.js)](#3-phase-2-embedding-migration-vllm--transformersjs)
4. [Phase 3: KNN Service (pgvector → In-Process JS)](#4-phase-3-knn-service-pgvector--in-process-js)
5. [Phase 4: LLM Replacement (Ollama → Enhanced Rules)](#5-phase-4-llm-replacement-ollama--enhanced-rules)
6. [Phase 5: Electron Desktop App](#6-phase-5-electron-desktop-app)
7. [Phase 6: Data Migration Tool](#7-phase-6-data-migration-tool)
8. [Current Codebase Reference](#8-current-codebase-reference)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Architecture Overview

### Current Architecture (Server-Dependent)

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│  React SPA  │───▶│  Express API │───▶│  PostgreSQL + pgvector   │
│  (Vite)     │    │  (port 3001) │    │  (4096-dim vectors)      │
└─────────────┘    └──────┬───────┘    └──────────────────────────┘
                          │
                   ┌──────┴───────┐
                   │  vLLM Server │  ← nvidia/llama-embed-nemotron-8b (8B params, GPU)
                   │  (port 8001) │
                   └──────┬───────┘
                   ┌──────┴───────┐
                   │  Ollama      │  ← qwen3-coder-next:q8_0 (8GB+ RAM)
                   │  (port 11434)│
                   └──────────────┘

External dependencies: PostgreSQL server, pgvector extension, vLLM GPU server, Ollama
```

### Target Architecture (Self-Contained)

```
┌──────────────────────────────────────────────────┐
│  Electron App (single .dmg / .exe install)       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  React Frontend (Chromium renderer)        │  │
│  └────────────────┬───────────────────────────┘  │
│                   │ IPC / localhost                │
│  ┌────────────────┴───────────────────────────┐  │
│  │  Express Backend (Node.js main process)    │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Transformers.js (ONNX Runtime)      │  │  │
│  │  │  Model: all-MiniLM-L6-v2             │  │  │
│  │  │  384 dims, ~50MB, CPU-only           │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  SQLite (better-sqlite3)             │  │  │
│  │  │  Embeddings stored as BLOB           │  │  │
│  │  │  Cosine similarity computed in JS    │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Enhanced Rule Engine                │  │  │
│  │  │  Replaces LLM categorization step    │  │  │
│  │  │  Zero RAM overhead                   │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  External dependencies: NONE                     │
└──────────────────────────────────────────────────┘

App size: ~150-200MB installed
RAM usage: ~300-500MB running
```

### Why These Technology Choices

| Component | Current | Portable | Why |
|-----------|---------|----------|-----|
| Database | PostgreSQL + pgvector | SQLite (`better-sqlite3`) | Zero install, single file, cross-platform. Your dataset (<100K transactions) is well within SQLite's sweet spot. |
| Embeddings | vLLM + nvidia/llama-embed-nemotron-8b (8B params, 4096 dims) | Transformers.js + all-MiniLM-L6-v2 (22M params, 384 dims) | 50MB vs 16GB model size. Transaction text is short ("Starbucks coffee") — MiniLM achieves ~95% accuracy at 1/400th the resource cost. |
| LLM categorization | Ollama + qwen3-coder-next | Enhanced keyword/rule engine | Zero RAM overhead. LLM was already the fallback step — enhanced rules + KNN handle most cases. |
| Packaging | Separate processes (frontend, backend, DB, vLLM, Ollama) | Single Electron app | One download, one install. Users don't need to understand infrastructure. |

---

## 2. Phase 1: Database Migration (PostgreSQL → SQLite)

### Overview

Replace the PostgreSQL driver (`pg`) with SQLite (`better-sqlite3`). This is the foundation — everything else depends on it.

### 2.1 Install Dependencies

```bash
cd backend
npm uninstall pg @types/pg
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### 2.2 Create SQLite Schema

Create `backend/src/db/schema.sql`. This replaces all 22 PostgreSQL migration files with a single SQLite-compatible schema.

**Key differences from PostgreSQL:**
- No `BIGSERIAL` → use `INTEGER PRIMARY KEY AUTOINCREMENT`
- No `UUID` type → use `TEXT` and generate UUIDs in application code
- No `TIMESTAMPTZ` → use `TEXT` (ISO 8601 strings)
- No `vector(4096)` → use `BLOB` (serialized Float32Array)
- No `CREATE EXTENSION` → remove pgvector/pgcrypto
- No `DISTINCT ON` → use `GROUP BY` + `MAX` or window functions
- No `FILTER (WHERE ...)` → use `CASE WHEN ... END` inside aggregate
- No `RETURNING *` → use `last_insert_rowid()` or separate SELECT
- No trigger functions → use simpler SQLite triggers
- Must enable foreign keys: `PRAGMA foreign_keys = ON;`

```sql
-- backend/src/db/schema.sql

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- LOOKUP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS account_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  affects_net_worth INTEGER NOT NULL DEFAULT 1  -- SQLite uses 1/0 for booleans
);

INSERT OR IGNORE INTO account_types (id, label, affects_net_worth) VALUES
  ('checking', 'Checking', 1),
  ('savings', 'Savings', 1),
  ('credit_card', 'Credit Card', 1),
  ('investment', 'Investment', 1),
  ('loan', 'Loan', 1),
  ('mortgage', 'Mortgage', 1);

CREATE TABLE IF NOT EXISTS embedding_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO embedding_models (model_name, dimension, is_active)
  VALUES ('Xenova/all-MiniLM-L6-v2', 384, 1);

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL REFERENCES account_types(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  color TEXT NOT NULL DEFAULT '#9ca3af',
  icon TEXT
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- Seed default categories
INSERT OR IGNORE INTO categories (id, user_id, name, type, color) VALUES
  ('groceries',     '00000000-0000-0000-0000-000000000000', 'Groceries',     'expense', '#10b981'),
  ('dining',        '00000000-0000-0000-0000-000000000000', 'Dining',        'expense', '#f59e0b'),
  ('transportation','00000000-0000-0000-0000-000000000000', 'Transportation','expense', '#3b82f6'),
  ('utilities',     '00000000-0000-0000-0000-000000000000', 'Utilities',     'expense', '#8b5cf6'),
  ('housing',       '00000000-0000-0000-0000-000000000000', 'Housing',       'expense', '#ec4899'),
  ('healthcare',    '00000000-0000-0000-0000-000000000000', 'Healthcare',    'expense', '#ef4444'),
  ('entertainment', '00000000-0000-0000-0000-000000000000', 'Entertainment', 'expense', '#f97316'),
  ('shopping',      '00000000-0000-0000-0000-000000000000', 'Shopping',      'expense', '#14b8a6'),
  ('travel',        '00000000-0000-0000-0000-000000000000', 'Travel',        'expense', '#06b6d4'),
  ('insurance',     '00000000-0000-0000-0000-000000000000', 'Insurance',     'expense', '#64748b'),
  ('education',     '00000000-0000-0000-0000-000000000000', 'Education',     'expense', '#a855f7'),
  ('personal-care', '00000000-0000-0000-0000-000000000000', 'Personal Care', 'expense', '#e879f9'),
  ('subscriptions', '00000000-0000-0000-0000-000000000000', 'Subscriptions', 'expense', '#6366f1'),
  ('salary',        '00000000-0000-0000-0000-000000000000', 'Salary',        'income',  '#22c55e'),
  ('transfers',     '00000000-0000-0000-0000-000000000000', 'Transfers',     'transfer','#94a3b8'),
  ('uncategorized', '00000000-0000-0000-0000-000000000000', 'Uncategorized', 'expense', '#9ca3af');

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  status TEXT NOT NULL CHECK (status IN ('uploaded','parsing','embedding','categorizing','completed','failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  embedded_rows INTEGER NOT NULL DEFAULT 0,
  auto_categorized_rows INTEGER NOT NULL DEFAULT 0,
  needs_review_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_import_batches_account ON import_batches(account_id);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  posted_at TEXT NOT NULL,                        -- 'YYYY-MM-DD'
  amount_cents INTEGER NOT NULL
    CHECK (amount_cents >= -100000000 AND amount_cents <= 100000000),
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_raw TEXT,
  description_raw TEXT,
  merchant_clean TEXT,
  text_for_embedding TEXT NOT NULL DEFAULT 'Merchant: Unknown. Description: . Type: expense. Amount: small. Domain: general.',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (category_source IN ('rule', 'knn', 'llm', 'manual', 'unknown')),
  category_confidence REAL CHECK (category_confidence IS NULL OR (category_confidence >= 0 AND category_confidence <= 1)),
  type TEXT NOT NULL DEFAULT 'expense'
    CHECK (type IN ('income', 'expense', 'transfer', 'refund', 'ignored')),
  original_type TEXT,
  needs_review INTEGER NOT NULL DEFAULT 1,        -- SQLite boolean
  tx_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Amount sign constraint (same logic as Postgres)
  CHECK (
    (type = 'expense' AND amount_cents <= 0) OR
    (type IN ('income', 'refund') AND amount_cents >= 0) OR
    type IN ('transfer', 'ignored')
  )
);

-- Dedup constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup
  ON transactions(user_id, posted_at, merchant_clean, amount_cents, tx_hash);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions(user_id, needs_review);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(user_id, merchant_clean);
CREATE INDEX IF NOT EXISTS idx_transactions_updated ON transactions(updated_at);

-- Auto-update updated_at on row change
CREATE TRIGGER IF NOT EXISTS trg_transactions_updated_at
  AFTER UPDATE ON transactions
  FOR EACH ROW
BEGIN
  UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- EMBEDDING & CATEGORIZATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_embeddings (
  transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  embedding BLOB NOT NULL   -- Serialized Float32Array (384 floats × 4 bytes = 1,536 bytes)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_user ON transaction_embeddings(user_id);

CREATE TABLE IF NOT EXISTS transaction_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  old_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  new_category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  labeled_by TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_labels_user ON transaction_labels(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_labels_tx ON transaction_labels(transaction_id, created_at DESC);

CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('merchant_clean', 'contains', 'regex')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_from TEXT NOT NULL DEFAULT 'edit_learning',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_unique
  ON category_rules(user_id, match_type, match_value);
CREATE INDEX IF NOT EXISTS idx_category_rules_user_enabled
  ON category_rules(user_id, enabled, priority);

-- ============================================================
-- MERCHANT NORMALIZATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS merchant_normalization_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,             -- NULL = global rule
  rule_type TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex')),
  pattern TEXT NOT NULL,
  canonical_merchant TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merch_norm_unique
  ON merchant_normalization_rules(COALESCE(user_id, '__global__'), rule_type, pattern, canonical_merchant);
CREATE INDEX IF NOT EXISTS idx_merch_norm_user
  ON merchant_normalization_rules(user_id, enabled, priority);

CREATE TABLE IF NOT EXISTS merchant_noise_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  token TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('word', 'regex')),
  position TEXT NOT NULL DEFAULT 'any' CHECK (position IN ('any', 'prefix', 'suffix')),
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_noise_tokens_unique
  ON merchant_noise_tokens(COALESCE(user_id, '__global__'), token, token_type, position);

CREATE TABLE IF NOT EXISTS merchant_normalization_replacements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  from_text TEXT NOT NULL,
  to_text TEXT NOT NULL DEFAULT '',
  is_regex INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merch_replace_unique
  ON merchant_normalization_replacements(COALESCE(user_id, '__global__'), from_text, to_text, is_regex);

-- ============================================================
-- TRANSACTION CLASSIFICATION KEYWORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS transaction_classification_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  keyword_group TEXT NOT NULL CHECK (keyword_group IN ('checking_transfer', 'credit_card_transfer', 'refund', 'known_checking_transfer')),
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'regex')),
  pattern TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_class_unique
  ON transaction_classification_keywords(COALESCE(user_id, '__global__'), keyword_group, match_type, pattern);

-- Seed default classification keywords
INSERT OR IGNORE INTO transaction_classification_keywords (user_id, keyword_group, match_type, pattern) VALUES
  -- Checking transfer keywords (credit card payment detection)
  (NULL, 'checking_transfer', 'contains', 'credit card'),
  (NULL, 'checking_transfer', 'contains', 'card payment'),
  (NULL, 'checking_transfer', 'contains', 'cc payment'),
  (NULL, 'checking_transfer', 'contains', 'chase credit'),
  (NULL, 'checking_transfer', 'contains', 'chase card'),
  (NULL, 'checking_transfer', 'contains', 'chase crd'),
  (NULL, 'checking_transfer', 'contains', 'capital one'),
  (NULL, 'checking_transfer', 'contains', 'amex'),
  (NULL, 'checking_transfer', 'contains', 'american express'),
  (NULL, 'checking_transfer', 'contains', 'citi card'),
  (NULL, 'checking_transfer', 'contains', 'citi credit'),
  (NULL, 'checking_transfer', 'contains', 'discover card'),
  (NULL, 'checking_transfer', 'contains', 'discover credit'),
  (NULL, 'checking_transfer', 'contains', 'wells fargo card'),
  (NULL, 'checking_transfer', 'contains', 'wells fargo credit'),
  (NULL, 'checking_transfer', 'contains', 'bank of america'),
  (NULL, 'checking_transfer', 'contains', 'barclays'),
  (NULL, 'checking_transfer', 'contains', 'synchrony'),
  (NULL, 'checking_transfer', 'contains', 'apple card'),
  -- Credit card transfer keywords (payment received)
  (NULL, 'credit_card_transfer', 'contains', 'payment'),
  (NULL, 'credit_card_transfer', 'contains', 'autopay'),
  (NULL, 'credit_card_transfer', 'contains', 'auto pay'),
  (NULL, 'credit_card_transfer', 'contains', 'thank you'),
  (NULL, 'credit_card_transfer', 'contains', 'payment received'),
  (NULL, 'credit_card_transfer', 'contains', 'online payment'),
  (NULL, 'credit_card_transfer', 'contains', 'ach payment'),
  (NULL, 'credit_card_transfer', 'contains', 'mobile payment'),
  -- Refund keywords
  (NULL, 'refund', 'contains', 'refund'),
  (NULL, 'refund', 'contains', 'return'),
  (NULL, 'refund', 'contains', 'rebate'),
  (NULL, 'refund', 'contains', 'credit adj'),
  (NULL, 'refund', 'contains', 'credit memo'),
  (NULL, 'refund', 'contains', 'reversal'),
  (NULL, 'refund', 'contains', 'adjustment'),
  (NULL, 'refund', 'contains', 'dispute'),
  (NULL, 'refund', 'contains', 'chargeback'),
  -- Known checking transfer patterns
  (NULL, 'known_checking_transfer', 'contains', 'online transfer from sav'),
  (NULL, 'known_checking_transfer', 'contains', 'bk of amer vi/mc online pmt');
```

### 2.3 Rewrite `backend/src/db/config.ts`

**Current:** Creates a PostgreSQL connection pool using `pg.Pool`.

**New:** Opens a SQLite database file using `better-sqlite3`.

```typescript
// backend/src/db/config.ts

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Get the database file path.
 * In Electron: uses app.getPath('userData')/budgeting.sqlite
 * In dev: uses ./data/budgeting.sqlite
 */
export function getDbPath(): string {
  // Electron sets this env var from the main process
  const userDataDir = process.env['USER_DATA_DIR'];
  if (userDataDir) {
    return path.join(userDataDir, 'budgeting.sqlite');
  }
  // Dev fallback
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'budgeting.sqlite');
}

/**
 * Get or create the SQLite database connection.
 * SQLite is single-connection — no pool needed.
 */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  }
  return db;
}

/**
 * Close the database connection (call on app shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

### 2.4 Rewrite `backend/src/db/migrate.ts`

**Current:** Reads SQL files from `backend/migrations/`, manages `schema_migrations` table in PostgreSQL.

**New:** Execute the single `schema.sql` file on first run. For future schema changes, use a version number.

```typescript
// backend/src/db/migrate.ts

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const SCHEMA_VERSION = 1; // Bump this when schema.sql changes

export function runMigrations(db: Database.Database): void {
  // Check current schema version
  db.exec(`CREATE TABLE IF NOT EXISTS schema_info (key TEXT PRIMARY KEY, value TEXT)`);
  const row = db.prepare(`SELECT value FROM schema_info WHERE key = 'version'`).get() as any;
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  if (currentVersion < SCHEMA_VERSION) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    db.prepare(
      `INSERT OR REPLACE INTO schema_info (key, value) VALUES ('version', ?)`
    ).run(String(SCHEMA_VERSION));
  }
}
```

### 2.5 Rewrite `backend/src/db/queries.ts`

This is the largest change. Every function that uses `pool.query()` must be rewritten to use `db.prepare().run/get/all()`.

**Key pattern changes:**

| PostgreSQL (`pg`) | SQLite (`better-sqlite3`) |
|---|---|
| `await pool.query(sql, [params])` | `db.prepare(sql).run(params)` (sync) |
| `result.rows` | `db.prepare(sql).all(params)` |
| `result.rows[0]` | `db.prepare(sql).get(params)` |
| `$1, $2, $3` placeholders | `?, ?, ?` placeholders |
| `RETURNING *` | Separate `SELECT` after `INSERT` |
| `DISTINCT ON (col)` | Window function + subquery (see below) |
| `COUNT(*) FILTER (WHERE ...)` | `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` |
| `gen_random_uuid()` | Generate UUID in JS with `crypto.randomUUID()` |
| `$1::vector` | Store as BLOB (see embedding section) |
| `NOW()` / `CURRENT_TIMESTAMP` | `datetime('now')` |
| `async function` | Regular `function` (better-sqlite3 is synchronous) |

**Example rewrites for the most important queries:**

#### `createImportBatch`
```typescript
// BEFORE (PostgreSQL)
export async function createImportBatch(pool: Pool, id: string, userId: string, totalRows: number, accountId?: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO import_batches (id, user_id, status, total_rows, embedded_rows, auto_categorized_rows, needs_review_rows, account_id)
     VALUES ($1, $2, 'uploaded', $3, 0, 0, 0, $4)`,
    [id, userId, totalRows, accountId ?? null]
  );
}

// AFTER (SQLite)
export function createImportBatch(db: Database.Database, id: string, userId: string, totalRows: number, accountId?: string | null): void {
  db.prepare(
    `INSERT INTO import_batches (id, user_id, status, total_rows, embedded_rows, auto_categorized_rows, needs_review_rows, account_id)
     VALUES (?, ?, 'uploaded', ?, 0, 0, 0, ?)`
  ).run(id, userId, totalRows, accountId ?? null);
}
```

#### `getImportBatch` — Uses `FILTER (WHERE ...)`, requires rewrite
```typescript
// BEFORE (PostgreSQL) — uses FILTER clause
`SELECT b.*, COUNT(t.id) FILTER (WHERE te.transaction_id IS NOT NULL) AS embedded_rows_live ...`

// AFTER (SQLite) — use CASE WHEN
export function getImportBatch(db: Database.Database, id: string): any {
  return db.prepare(`
    SELECT b.*,
      COUNT(t.id) AS total_rows_live,
      SUM(CASE WHEN te.transaction_id IS NOT NULL THEN 1 ELSE 0 END) AS embedded_rows_live,
      SUM(CASE WHEN t.needs_review = 0 AND t.category_source != 'unknown' THEN 1 ELSE 0 END) AS auto_categorized_rows_live,
      SUM(CASE WHEN t.needs_review = 1 THEN 1 ELSE 0 END) AS needs_review_rows_live
    FROM import_batches b
    LEFT JOIN transactions t ON t.import_batch_id = b.id
    LEFT JOIN transaction_embeddings te ON te.transaction_id = t.id
    WHERE b.id = ?
    GROUP BY b.id
  `).get(id);
}
```

#### `insertTransactions` — Uses `tx_hash`, `ON CONFLICT`
```typescript
// AFTER (SQLite)
export function insertTransactions(db: Database.Database, transactions: TransactionInsert[]): void {
  const stmt = db.prepare(`
    INSERT INTO transactions
      (user_id, import_batch_id, posted_at, amount_cents, currency,
       merchant_raw, description_raw, merchant_clean, text_for_embedding,
       category_id, category_source, category_confidence, needs_review,
       account_id, type, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  // Use a transaction for bulk inserts (much faster)
  const insertMany = db.transaction((txns: TransactionInsert[]) => {
    for (const t of txns) {
      stmt.run(
        t.userId, t.importBatchId, t.postedAt, t.amountCents, t.currency,
        t.merchantRaw ?? null, t.descriptionRaw ?? null, t.merchantClean ?? null,
        t.textForEmbedding ?? null, t.categoryId ?? null, t.categorySource,
        t.categoryConfidence ?? null, t.needsReview ? 1 : 0,
        t.accountId ?? null, t.type ?? 'expense', buildTxHash(t)
      );
    }
  });

  insertMany(transactions);
}
```

#### `getLatestLabelsWithEmbeddings` — Uses `DISTINCT ON`, requires rewrite
```typescript
// BEFORE (PostgreSQL) — uses DISTINCT ON
`SELECT DISTINCT ON (tl.transaction_id) tl.transaction_id, tl.new_category_id ...`

// AFTER (SQLite) — use GROUP BY + MAX
export function getLatestLabelsWithEmbeddings(db: Database.Database, userId: string, limit: number = 1000): any[] {
  return db.prepare(`
    SELECT tl.transaction_id, tl.new_category_id AS category_id, te.embedding
    FROM transaction_labels tl
    INNER JOIN (
      SELECT transaction_id, MAX(created_at) AS max_created
      FROM transaction_labels
      WHERE user_id = ?
      GROUP BY transaction_id
    ) latest ON tl.transaction_id = latest.transaction_id AND tl.created_at = latest.max_created
    JOIN transaction_embeddings te ON te.transaction_id = tl.transaction_id
    WHERE tl.user_id = ?
    LIMIT ?
  `).all(userId, userId, limit);
}
```

#### Complete list of all functions to rewrite

Every function in `queries.ts` (24 functions total) must be converted. Here is the full list:

| Function | PostgreSQL-specific features used | SQLite conversion notes |
|----------|----------------------------------|------------------------|
| `createImportBatch` | `$1` params | Change to `?` params |
| `updateImportBatchStatus` | Dynamic `SET` clauses | Same pattern works in SQLite |
| `getImportBatch` | `FILTER (WHERE ...)` | Use `SUM(CASE WHEN ... END)` |
| `getActiveEmbeddingModel` | None special | Direct conversion |
| `insertTransactions` | `$1::vector`, `gen_random_uuid` | Remove vector cast, use JS UUID |
| `getTransactionsForEmbedding` | Subquery with `NOT IN` | Works in SQLite |
| `getUncategorizedTransactions` | None special | Direct conversion |
| `insertEmbeddings` | `$3::vector` pgvector cast | Store as `BLOB` (Float32Array buffer) |
| `insertTransactionLabel` | None special | Direct conversion |
| `getLatestLabelsForUser` | `DISTINCT ON` | Use subquery with `MAX(created_at)` |
| `getLatestLabelsWithEmbeddings` | `DISTINCT ON`, vector column | Subquery + BLOB deserialization |
| `getCategoryRules` | None special | Direct conversion |
| `upsertCategoryRule` | `ON CONFLICT ... DO UPDATE` | Same syntax works in SQLite |
| `disableCategoryRule` | None special | Direct conversion |
| `getReviewQueue` | `COUNT(*) OVER()` | Window functions work in SQLite ≥3.25 |
| `getReviewQueueByMerchant` | `ROW_NUMBER OVER`, aggregates | Window functions work in SQLite ≥3.25 |
| `updateTransactionCategoryWithLabel` | Transaction block | Use `db.transaction()` |
| `applyCategoryRuleForMerchant` | `RETURNING id` | Use `lastInsertRowid` or separate SELECT |
| `applyCategoryRuleToPastTransactions` | None special | Use `.run().changes` for row count |
| `updateTransactionNeedsReview` | None special | Direct conversion |

### 2.6 Embedding Storage: BLOB Format

Embeddings are stored as `BLOB` in SQLite. Use `Float32Array` for compact binary storage.

```typescript
// Serialize: number[] → Buffer (for INSERT)
export function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

// Deserialize: Buffer → number[] (for SELECT)
export function deserializeEmbedding(blob: Buffer): number[] {
  return Array.from(new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4));
}

// Usage in insertEmbeddings:
export function insertEmbeddings(db: Database.Database, embeddings: EmbeddingInsert[]): void {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO transaction_embeddings (transaction_id, user_id, embedding)
     VALUES (?, ?, ?)`
  );
  const insertMany = db.transaction((embs: EmbeddingInsert[]) => {
    for (const e of embs) {
      stmt.run(e.transactionId, e.userId, serializeEmbedding(e.embedding));
    }
  });
  insertMany(embeddings);
}
```

**Storage size comparison:**
- Old: `vector(4096)` → 4096 × 4 bytes = **16,384 bytes** per transaction
- New: `BLOB (384 floats)` → 384 × 4 bytes = **1,536 bytes** per transaction (10.7x smaller)

### 2.7 Update All Route Handlers

Every route in `imports.ts` and `data.ts` passes `pool` as the first argument to query functions. Change these to pass `db` (the SQLite database instance) instead.

```typescript
// BEFORE
import { createPool } from '../db/config.js';
const pool = createPool();
// ... in route handler:
const batch = await getImportBatch(pool, id);

// AFTER
import { getDb } from '../db/config.js';
const db = getDb();
// ... in route handler:
const batch = getImportBatch(db, id);  // Note: no longer async
```

**Important:** `better-sqlite3` is **synchronous**. Remove `await` from all query calls. The route handlers themselves remain `async` (Express requires it), but the database calls within them are sync.

### 2.8 Update `server.ts`

```typescript
// BEFORE
import { createPool } from './db/config.js';
const pool = createPool();

// AFTER
import { getDb, closeDb } from './db/config.js';
import { runMigrations } from './db/migrate.js';

const db = getDb();
runMigrations(db); // Creates tables on first run

// Graceful shutdown
process.on('SIGTERM', () => closeDb());
process.on('SIGINT', () => closeDb());
```

---

## 3. Phase 2: Embedding Migration (vLLM → Transformers.js)

### Overview

Replace the external vLLM HTTP endpoint with in-process embedding generation using `@huggingface/transformers`.

### 3.1 Install Dependencies

```bash
cd backend
npm uninstall axios  # No longer needed for embeddings
npm install @huggingface/transformers
```

> **Note:** `@huggingface/transformers` (v3+) is the successor to `@xenova/transformers`. It includes ONNX Runtime and runs on CPU by default.

### 3.2 Create `backend/src/services/localEmbeddings.ts`

This replaces `embeddings.ts` entirely.

```typescript
// backend/src/services/localEmbeddings.ts

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { getDb } from '../db/config.js';
import { serializeEmbedding } from '../db/queries.js';
import { logger } from '../utils/logging.js';

// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384;
const EMBEDDING_BATCH_SIZE = 64; // Smaller batches for CPU

let embeddingPipeline: FeatureExtractionPipeline | null = null;

/**
 * Initialize the embedding model. Call once at app startup.
 * The model (~50MB) is downloaded on first run and cached locally.
 *
 * In Electron, set the cache directory to app userData:
 *   process.env.TRANSFORMERS_CACHE = path.join(app.getPath('userData'), 'models');
 */
export async function initEmbeddingModel(): Promise<void> {
  if (embeddingPipeline) return;

  logger.info(`Loading embedding model: ${MODEL_NAME}...`);
  embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
    // Use ONNX quantized model for smaller size and faster CPU inference
    dtype: 'fp32',       // or 'q8' for 8-bit quantized (even smaller)
    device: 'cpu',
  });
  logger.info(`Embedding model loaded. Dimensions: ${EMBEDDING_DIMENSIONS}`);
}

/**
 * Generate embeddings for an array of text strings.
 * Returns number[][] where each inner array has EMBEDDING_DIMENSIONS elements.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized. Call initEmbeddingModel() first.');
  }

  // Transformers.js handles batching internally
  const output = await embeddingPipeline(texts, {
    pooling: 'mean',     // Mean pooling over token embeddings
    normalize: true,     // L2 normalize (required for cosine similarity)
  });

  // output.tolist() returns number[][]
  return output.tolist();
}

/**
 * Generate embeddings for all un-embedded transactions in an import batch.
 * Processes in batches of EMBEDDING_BATCH_SIZE.
 */
export async function generateEmbeddingsForBatch(
  importBatchId: string
): Promise<{ success: boolean; count: number; errorMessage?: string }> {
  const db = getDb();
  let totalEmbedded = 0;

  try {
    await initEmbeddingModel();

    while (true) {
      // Get transactions that don't have embeddings yet
      const rows = db.prepare(`
        SELECT t.id, t.user_id, t.text_for_embedding
        FROM transactions t
        WHERE t.import_batch_id = ?
          AND t.text_for_embedding IS NOT NULL
          AND t.id NOT IN (SELECT transaction_id FROM transaction_embeddings)
        LIMIT ?
      `).all(importBatchId, EMBEDDING_BATCH_SIZE) as any[];

      if (rows.length === 0) break;

      const texts = rows.map(r => r.text_for_embedding);
      const embeddings = await generateEmbeddings(texts);

      // Bulk insert embeddings
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO transaction_embeddings (transaction_id, user_id, embedding)
         VALUES (?, ?, ?)`
      );
      const insertBatch = db.transaction((items: any[]) => {
        for (let i = 0; i < items.length; i++) {
          stmt.run(items[i].id, items[i].user_id, serializeEmbedding(embeddings[i]));
        }
      });
      insertBatch(rows);

      totalEmbedded += rows.length;
      logger.info(`Embedded ${totalEmbedded} transactions for batch ${importBatchId}`);
    }

    return { success: true, count: totalEmbedded };
  } catch (error: any) {
    logger.error(`Embedding error: ${error.message}`);
    return { success: false, count: totalEmbedded, errorMessage: error.message };
  }
}

export { EMBEDDING_DIMENSIONS, MODEL_NAME };
```

### 3.3 Model Download & Caching

On first run, Transformers.js downloads the model from Hugging Face Hub and caches it locally.

**Default cache location:** `~/.cache/huggingface/hub/`

**For Electron:** Override the cache directory so models are stored inside the app's user data:
```typescript
// In electron/main.ts (before any imports that use the model)
import { app } from 'electron';
import path from 'path';

process.env.TRANSFORMERS_CACHE = path.join(app.getPath('userData'), 'models');
```

**For offline/air-gapped installs:** Bundle the model files in the Electron app resources:
```typescript
process.env.TRANSFORMERS_CACHE = path.join(process.resourcesPath, 'models');
```

### 3.4 Update References

All files that import from `embeddings.ts` must be updated:

```typescript
// BEFORE
import { generateEmbeddingsInBatches, getEmbeddingModelFromDb } from './embeddings.js';

// AFTER
import { generateEmbeddingsForBatch, EMBEDDING_DIMENSIONS } from './localEmbeddings.js';
```

### 3.5 Delete Old Files

After migration:
- Delete `backend/src/services/embeddings.ts` (replaced by `localEmbeddings.ts`)
- Remove `axios` dependency if nothing else uses it

---

## 4. Phase 3: KNN Service (pgvector → In-Process JS)

### Overview

Replace the PostgreSQL pgvector `<=>` cosine distance operator with JavaScript-based cosine similarity computed over BLOB embeddings loaded from SQLite.

### 4.1 Create `backend/src/services/vectorSearch.ts`

```typescript
// backend/src/services/vectorSearch.ts

/**
 * Compute cosine similarity between two vectors.
 * Both vectors must be the same length and L2-normalized.
 *
 * For normalized vectors, cosine similarity = dot product.
 * But we compute the full formula for safety.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the K nearest neighbors from a set of candidate embeddings.
 * Returns results sorted by similarity descending.
 */
export function findKNearest(
  queryEmbedding: number[],
  candidates: Array<{ transactionId: number; categoryId: string; embedding: number[] }>,
  k: number
): Array<{ transactionId: number; categoryId: string; similarity: number }> {
  const scored = candidates.map(c => ({
    transactionId: c.transactionId,
    categoryId: c.categoryId,
    similarity: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  // Sort by similarity descending, take top K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
```

### 4.2 Rewrite `backend/src/services/knn.ts`

**Current:** Runs a SQL query with pgvector's `<=>` operator to find nearest neighbors.

**New:** Loads all labeled embeddings into memory, computes cosine similarity in JS.

```typescript
// backend/src/services/knn.ts (rewritten)

import Database from 'better-sqlite3';
import { deserializeEmbedding } from '../db/queries.js';
import { cosineSimilarity, findKNearest } from './vectorSearch.js';

export interface KNNResult {
  categoryId: string | null;
  confidence: number;
  source: 'knn' | null;
}

/**
 * Find the best category for a transaction using KNN on labeled embeddings.
 *
 * Performance note: For <5,000 labeled transactions with 384-dim vectors,
 * brute-force cosine similarity takes <5ms. No index needed.
 */
export function getKNNCategory(
  db: Database.Database,
  queryEmbedding: number[],
  userId: string,
  k: number = 20,
  minVoteProportion: number = 0.60,
  minNeighborCount: number = 2,
  minTopSimilarity: number = 0.80
): KNNResult {
  // Load latest label per transaction (with embedding)
  const rows = db.prepare(`
    SELECT tl.transaction_id, tl.new_category_id AS category_id, te.embedding
    FROM transaction_labels tl
    INNER JOIN (
      SELECT transaction_id, MAX(created_at) AS max_created
      FROM transaction_labels
      WHERE user_id = ?
      GROUP BY transaction_id
    ) latest ON tl.transaction_id = latest.transaction_id
           AND tl.created_at = latest.max_created
    JOIN transaction_embeddings te ON te.transaction_id = tl.transaction_id
    WHERE tl.user_id = ?
  `).all(userId, userId) as any[];

  if (rows.length === 0) {
    return { categoryId: null, confidence: 0, source: null };
  }

  // Deserialize BLOB embeddings
  const candidates = rows.map(r => ({
    transactionId: r.transaction_id as number,
    categoryId: r.category_id as string,
    embedding: deserializeEmbedding(r.embedding),
  }));

  // Find K nearest
  const neighbors = findKNearest(queryEmbedding, candidates, k);

  if (neighbors.length === 0) {
    return { categoryId: null, confidence: 0, source: null };
  }

  // Weighted voting (same logic as original)
  const votes = new Map<string, { weight: number; count: number }>();
  let totalWeight = 0;

  for (const n of neighbors) {
    const existing = votes.get(n.categoryId) ?? { weight: 0, count: 0 };
    existing.weight += n.similarity;
    existing.count += 1;
    votes.set(n.categoryId, existing);
    totalWeight += n.similarity;
  }

  // Find winner
  let bestCategory = '';
  let bestWeight = 0;
  let bestCount = 0;
  for (const [cat, v] of votes) {
    if (v.weight > bestWeight) {
      bestCategory = cat;
      bestWeight = v.weight;
      bestCount = v.count;
    }
  }

  const voteProportion = totalWeight > 0 ? bestWeight / totalWeight : 0;
  const topSimilarity = neighbors[0].similarity;

  // Check all thresholds
  if (voteProportion >= minVoteProportion &&
      bestCount >= minNeighborCount &&
      topSimilarity >= minTopSimilarity) {
    return { categoryId: bestCategory, confidence: voteProportion, source: 'knn' };
  }

  return { categoryId: null, confidence: 0, source: null };
}
```

### 4.3 Performance Expectations

| Labeled Transactions | Vector Dims | KNN Time (brute-force) |
|---------------------|-------------|----------------------|
| 100 | 384 | <1ms |
| 1,000 | 384 | ~2ms |
| 5,000 | 384 | ~5ms |
| 10,000 | 384 | ~10ms |
| 50,000 | 384 | ~50ms |

For a personal budgeting app, even 50,000 labeled transactions (which would take years to accumulate) runs under 50ms. No specialized vector index is needed.

---

## 5. Phase 4: LLM Replacement (Ollama → Enhanced Rules)

### Overview

The LLM categorization step (`llmCategorize.ts`) was the third fallback after rules and KNN. For 8GB RAM / no GPU, we replace it with an enhanced keyword matching system that has zero resource overhead.

### 5.1 Why Remove the LLM Step

- **Memory:** Even a small 1B model uses ~2-3GB RAM during inference
- **Speed:** CPU inference takes 5-10 seconds per batch vs instant keyword matching
- **Impact:** The LLM was already the 3rd fallback — rules and KNN handle ~75% of transactions after initial training
- **Trade-off:** Slightly more transactions go to manual review initially, but edit learning rapidly builds up rules and KNN labels

### 5.2 Create `backend/src/services/keywordCategorize.ts`

Replace `llmCategorize.ts` with a deterministic keyword matcher that uses the same category descriptions the LLM was using, but as direct string matching.

```typescript
// backend/src/services/keywordCategorize.ts

import { logger } from '../utils/logging.js';

interface TransactionInput {
  id: number;
  merchantClean?: string;
  descriptionRaw?: string;
  amountCents: number;
  type?: string;
}

/**
 * Keyword-based categorization.
 * This replaces the LLM step with zero-overhead deterministic matching.
 *
 * Uses weighted keyword scoring — the category with the most keyword hits wins.
 * Only returns a match if confidence is above threshold (0.7).
 */

// Each category maps to an array of keywords/phrases to match against
// merchant_clean and description_raw (case-insensitive)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: [
    'grocery', 'supermarket', 'whole foods', 'trader joe', 'aldi', 'kroger',
    'safeway', 'publix', 'wegmans', 'costco', 'target', 'walmart',
    'food lion', 'heb', 'meijer', 'sprouts', 'market basket',
  ],
  dining: [
    'restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald',
    'chipotle', 'subway', 'pizza', 'burger', 'taco', 'sushi',
    'grubhub', 'doordash', 'uber eats', 'postmates', 'diner',
    'bar', 'grill', 'kitchen', 'bistro', 'bakery', 'panda express',
  ],
  transportation: [
    'gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'mobil',
    'uber', 'lyft', 'taxi', 'parking', 'toll', 'transit', 'metro',
    'amtrak', 'greyhound', 'auto', 'car wash', 'jiffy lube',
  ],
  utilities: [
    'electric', 'water', 'gas bill', 'internet', 'comcast', 'att',
    'verizon', 'tmobile', 't-mobile', 'spectrum', 'xfinity', 'phone',
    'utility', 'power', 'energy', 'sewer', 'trash', 'waste',
  ],
  housing: [
    'rent', 'mortgage', 'rocket mortgage', 'newrez', 'home',
    'apartment', 'property', 'hoa', 'home depot', 'lowes',
    'maintenance', 'repair', 'plumber', 'electrician',
  ],
  healthcare: [
    'doctor', 'hospital', 'pharmacy', 'cvs', 'walgreen', 'medical',
    'dental', 'dentist', 'optometrist', 'vision', 'health', 'clinic',
    'urgent care', 'lab', 'prescription', 'rx',
  ],
  entertainment: [
    'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'youtube',
    'movie', 'theater', 'cinema', 'concert', 'ticket', 'game',
    'steam', 'playstation', 'xbox', 'nintendo', 'twitch',
  ],
  shopping: [
    'amazon', 'ebay', 'etsy', 'retail', 'store', 'shop', 'mall',
    'clothing', 'apparel', 'nike', 'adidas', 'nordstrom', 'macys',
    'best buy', 'electronics', 'ikea', 'wayfair',
  ],
  travel: [
    'hotel', 'airbnb', 'vrbo', 'flight', 'airline', 'delta',
    'united', 'american airlines', 'southwest', 'jetblue',
    'booking', 'expedia', 'kayak', 'rental car', 'hertz', 'avis',
  ],
  insurance: [
    'insurance', 'geico', 'state farm', 'allstate', 'progressive',
    'liberty mutual', 'premium', 'policy',
  ],
  education: [
    'tuition', 'university', 'college', 'school', 'course', 'udemy',
    'coursera', 'textbook', 'student',
  ],
  'personal-care': [
    'haircut', 'salon', 'barber', 'gym', 'fitness', 'spa',
    'beauty', 'cosmetic', 'nail', 'massage',
  ],
  subscriptions: [
    'subscription', 'membership', 'monthly', 'annual', 'recurring',
    'patreon', 'substack', 'medium', 'adobe', 'microsoft 365',
    'google one', 'icloud', 'dropbox',
  ],
  salary: [
    'payroll', 'paycheck', 'direct deposit', 'employer', 'salary',
    'wage', 'compensation', 'adp', 'gusto', 'paychex',
  ],
  transfers: [
    'zelle', 'venmo', 'cashapp', 'cash app', 'paypal', 'wire',
    'ach', 'transfer', 'credit card payment', 'cc payment',
  ],
};

export function keywordCategorizeBatch(
  transactions: TransactionInput[],
  validCategoryIds: Set<string>
): Map<number, string> {
  const results = new Map<number, string>();

  for (const tx of transactions) {
    const text = `${tx.merchantClean ?? ''} ${tx.descriptionRaw ?? ''}`.toLowerCase();

    // Special rules: income transactions → salary
    if (tx.type === 'income') {
      if (validCategoryIds.has('salary')) {
        results.set(tx.id, 'salary');
      }
      continue;
    }

    // Score each category by keyword hits
    let bestCategory = '';
    let bestScore = 0;

    for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (!validCategoryIds.has(categoryId)) continue;

      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.length; // Longer matches = higher confidence
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = categoryId;
      }
    }

    // Only accept if we have a meaningful match (at least one keyword ≥4 chars)
    if (bestScore >= 4 && bestCategory) {
      results.set(tx.id, bestCategory);
    }
  }

  logger.info(`Keyword categorization: ${results.size}/${transactions.length} matched`);
  return results;
}
```

### 5.3 Update `categorize.ts`

Replace the LLM call with the keyword categorizer:

```typescript
// BEFORE
import { llmCategorizeBatch } from './llmCategorize.js';
// In categorizeTransactions():
const llmResults = await llmCategorizeBatch(uncategorized, categories);

// AFTER
import { keywordCategorizeBatch } from './keywordCategorize.js';
// In categorizeTransactions():
const keywordResults = keywordCategorizeBatch(uncategorized, validCategoryIds);
```

### 5.4 Delete Old Files

- Delete `backend/src/services/llmCategorize.ts`
- Remove `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_BATCH_SIZE` from `.env` files

---

## 6. Phase 5: Electron Desktop App

### Overview

Package the React frontend and Express backend into a single Electron application.

### 6.1 Install Electron

```bash
# In the project root (not backend/ or frontend/)
npm install electron electron-builder --save-dev
```

### 6.2 Project Structure

```
budgeting-app/
├── electron/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Preload script (IPC bridge)
│   └── tsconfig.json    # TypeScript config for Electron files
├── frontend/            # React app (unchanged)
├── backend/             # Express app (SQLite + Transformers.js)
├── package.json         # Root: adds Electron scripts and config
└── electron-builder.yml # Build configuration
```

### 6.3 Create `electron/main.ts`

```typescript
// electron/main.ts

import { app, BrowserWindow } from 'electron';
import path from 'path';

// Set model cache before any imports that use Transformers.js
process.env.TRANSFORMERS_CACHE = path.join(app.getPath('userData'), 'models');
process.env.USER_DATA_DIR = app.getPath('userData');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset', // macOS native feel
    title: 'Budget',
  });

  // Start the Express backend
  const { startServer } = await import('../backend/src/server.js');
  const port = await startServer(); // Modified to return the port

  // Load the frontend
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, serve the built frontend files
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
```

### 6.4 Create `electron-builder.yml`

```yaml
# electron-builder.yml
appId: com.budgeting.app
productName: Budget
directories:
  output: release

files:
  - electron/dist/**/*
  - backend/dist/**/*
  - backend/src/db/schema.sql
  - frontend/dist/**/*

extraResources:
  # Bundle the ONNX model for offline installs (optional)
  # - from: models/
  #   to: models/

mac:
  category: public.app-category.finance
  target:
    - dmg
    - zip
  icon: assets/icon.icns

win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
```

### 6.5 Update Root `package.json`

Add these scripts:

```json
{
  "scripts": {
    "electron:dev": "concurrently \"npm run dev --prefix frontend\" \"npm run dev --prefix backend\" \"wait-on http://localhost:3000 && electron electron/main.ts\"",
    "electron:build": "npm run build --prefix frontend && npm run build --prefix backend && tsc -p electron/tsconfig.json && electron-builder",
    "electron:build:mac": "npm run electron:build -- --mac",
    "electron:build:win": "npm run electron:build -- --win"
  }
}
```

### 6.6 Update Frontend API Base URL

The frontend currently reads `VITE_BACKEND_URL`. In Electron, the backend runs on localhost:

```typescript
// frontend/src/features/import/api.ts
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

// This already works for Electron since both run on localhost.
// No changes needed here.
```

### 6.7 Modify `server.ts` for Electron Compatibility

The server must export a function (not auto-start) so Electron can control lifecycle:

```typescript
// backend/src/server.ts

// ... existing imports and setup ...

export async function startServer(): Promise<number> {
  const db = getDb();
  runMigrations(db);
  await initEmbeddingModel(); // Pre-load the model

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      resolve(PORT);
    });
  });
}

// Only auto-start if run directly (not imported by Electron)
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer();
}
```

---

## 7. Phase 6: Data Migration Tool

### Overview

For users with existing data in PostgreSQL, provide a CLI tool that exports their data and imports it into the new SQLite database, re-generating embeddings with the new model.

### 7.1 Create `backend/src/scripts/migrateToSqlite.ts`

```typescript
// backend/src/scripts/migrateToSqlite.ts

import pg from 'pg';
import Database from 'better-sqlite3';
import { generateEmbeddings } from '../services/localEmbeddings.js';
import { serializeEmbedding } from '../db/queries.js';

/**
 * Migrate data from PostgreSQL to SQLite.
 *
 * Usage:
 *   POSTGRES_HOST=... POSTGRES_DB=... tsx src/scripts/migrateToSqlite.ts ./output.sqlite
 *
 * What it migrates:
 *   - accounts
 *   - categories (including user-created)
 *   - import_batches
 *   - transactions
 *   - transaction_labels (KNN training data)
 *   - category_rules (edit learning rules)
 *   - merchant_normalization_rules
 *   - merchant_noise_tokens
 *   - merchant_normalization_replacements
 *   - transaction_classification_keywords
 *
 * What it re-generates:
 *   - transaction_embeddings (re-embedded with MiniLM, old 4096-dim vectors are incompatible)
 *
 * What it skips:
 *   - schema_migrations (not needed in SQLite)
 *   - embedding_models (reset to new model)
 */
async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    console.error('Usage: tsx migrateToSqlite.ts <output.sqlite>');
    process.exit(1);
  }

  // 1. Connect to PostgreSQL
  const pool = new pg.Pool({ /* config from env */ });

  // 2. Create SQLite database and run schema
  const db = new Database(outputPath);
  // ... run schema.sql ...

  // 3. Copy each table (SELECT from PG, INSERT into SQLite)
  const tables = [
    'accounts', 'categories', 'import_batches', 'transactions',
    'transaction_labels', 'category_rules',
    'merchant_normalization_rules', 'merchant_noise_tokens',
    'merchant_normalization_replacements', 'transaction_classification_keywords'
  ];

  for (const table of tables) {
    console.log(`Migrating ${table}...`);
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    // ... insert each row into SQLite ...
    console.log(`  ${rows.length} rows migrated`);
  }

  // 4. Re-generate embeddings with new model
  console.log('Re-generating embeddings with MiniLM...');
  const transactions = db.prepare(
    `SELECT id, user_id, text_for_embedding FROM transactions WHERE text_for_embedding IS NOT NULL`
  ).all() as any[];

  // Process in batches of 64
  for (let i = 0; i < transactions.length; i += 64) {
    const batch = transactions.slice(i, i + 64);
    const texts = batch.map(t => t.text_for_embedding);
    const embeddings = await generateEmbeddings(texts);

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO transaction_embeddings (transaction_id, user_id, embedding)
       VALUES (?, ?, ?)`
    );
    const insert = db.transaction((items: any[]) => {
      for (let j = 0; j < items.length; j++) {
        stmt.run(items[j].id, items[j].user_id, serializeEmbedding(embeddings[j]));
      }
    });
    insert(batch);

    console.log(`  Embedded ${Math.min(i + 64, transactions.length)}/${transactions.length}`);
  }

  console.log('Migration complete!');
  db.close();
  await pool.end();
}

main().catch(console.error);
```

---

## 8. Current Codebase Reference

### Files to Modify (with line counts)

| File | Lines | What Changes |
|------|-------|-------------|
| `backend/src/db/config.ts` | 52 | Replace `pg.Pool` → `better-sqlite3` |
| `backend/src/db/queries.ts` | 504 | Rewrite all 24 query functions for SQLite syntax |
| `backend/src/db/migrate.ts` | 186 | Simplify to single schema.sql execution |
| `backend/src/db/runMigrate.ts` | 62 | Simplify CLI (just runs schema) |
| `backend/src/services/embeddings.ts` | 176 | **Delete** → replaced by `localEmbeddings.ts` |
| `backend/src/services/knn.ts` | 147 | Rewrite to use in-process cosine similarity |
| `backend/src/services/categorize.ts` | 428 | Update to use new embedding/KNN services, remove vLLM fallbacks |
| `backend/src/services/llmCategorize.ts` | 174 | **Delete** → replaced by `keywordCategorize.ts` |
| `backend/src/services/merchantNormalization.ts` | 223 | Update `pool` → `db` parameter type only |
| `backend/src/services/transactionClassification.ts` | 78 | Update `pool` → `db` parameter type only |
| `backend/src/types/index.ts` | 83 | Remove `EmbeddingRequest`/`EmbeddingResponse` (no longer HTTP) |
| `backend/src/routes/imports.ts` | 655 | Update `pool` → `db`, remove async from db calls |
| `backend/src/routes/data.ts` | 498 | Update `pool` → `db`, remove async from db calls |
| `backend/src/server.ts` | 68 | Export `startServer()`, init embedding model |
| `backend/src/utils/csv.ts` | 336 | No changes needed |
| `backend/src/utils/logging.ts` | 26 | No changes needed |
| `backend/package.json` | 46 | Swap deps: `pg` → `better-sqlite3`, add `@huggingface/transformers` |

### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/db/schema.sql` | Complete SQLite schema (replaces 22 migration files) |
| `backend/src/services/localEmbeddings.ts` | In-process Transformers.js embeddings |
| `backend/src/services/vectorSearch.ts` | Cosine similarity + KNN utilities |
| `backend/src/services/keywordCategorize.ts` | Deterministic keyword-based categorization |
| `backend/src/scripts/migrateToSqlite.ts` | PostgreSQL → SQLite data migration |
| `electron/main.ts` | Electron main process |
| `electron/preload.ts` | Electron preload script |
| `electron-builder.yml` | Build configuration |

### Files to Delete (after migration)

| File | Reason |
|------|--------|
| `backend/src/services/embeddings.ts` | Replaced by `localEmbeddings.ts` |
| `backend/src/services/llmCategorize.ts` | Replaced by `keywordCategorize.ts` |
| `backend/migrations/*.sql` (44 files) | Replaced by single `schema.sql` |
| `docker-compose.yml` | No longer needed |
| `Dockerfile` | No longer needed |
| `.env.example` / `.env.local` | Simplified config (no external services) |
| `backend/src/db/generateMigration.ts` | No incremental migrations needed |

### SQL Syntax Conversion Cheatsheet

This is the complete list of PostgreSQL → SQLite syntax differences you'll encounter in this codebase:

| PostgreSQL | SQLite | Where Used |
|-----------|--------|-----------|
| `$1, $2, $3` | `?, ?, ?` | Every query in `queries.ts` |
| `BIGSERIAL PRIMARY KEY` | `INTEGER PRIMARY KEY AUTOINCREMENT` | transactions, labels, rules |
| `UUID` | `TEXT` | All ID columns |
| `TIMESTAMPTZ DEFAULT now()` | `TEXT DEFAULT (datetime('now'))` | All timestamp columns |
| `BOOLEAN` | `INTEGER` (0/1) | needs_review, enabled, is_regex |
| `REAL` | `REAL` | category_confidence (same) |
| `vector(4096)` | `BLOB` | transaction_embeddings.embedding |
| `$3::vector` | `?` (pass Buffer) | insertEmbeddings |
| `<=>` (cosine distance) | JS `cosineSimilarity()` | knn.ts |
| `DISTINCT ON (col)` | Subquery + `MAX(created_at)` | getLatestLabels* |
| `COUNT(*) FILTER (WHERE x)` | `SUM(CASE WHEN x THEN 1 ELSE 0 END)` | getImportBatch |
| `RETURNING *` | `lastInsertRowid` + separate SELECT | upsertCategoryRule |
| `gen_random_uuid()` | `crypto.randomUUID()` (in JS) | createImportBatch |
| `CREATE EXTENSION vector` | (removed) | schema |
| `CREATE EXTENSION pgcrypto` | (removed) | schema |
| `COALESCE(user_id, '00...0'::uuid)` | `COALESCE(user_id, '__global__')` | merchant normalization unique indexes |
| `pool.query(sql, params)` → async | `db.prepare(sql).run/get/all(params)` → sync | Every function |
| `result.rows` | `db.prepare().all()` | Every SELECT |
| `result.rows[0]` | `db.prepare().get()` | Single-row SELECT |
| `result.rowCount` | `.run().changes` | UPDATE/DELETE row count |
| `BEGIN/COMMIT` | `db.transaction(() => { ... })()` | Bulk inserts, atomic operations |

### Dependency Changes

```diff
# backend/package.json dependencies
- "axios": "^1.6.8",          # Remove (no more HTTP to vLLM/LLM)
- "pg": "^8.12.0",            # Remove (replaced by SQLite)
+ "better-sqlite3": "^11.0.0", # Add (SQLite driver)
+ "@huggingface/transformers": "^3.0.0",  # Add (local embeddings)

# backend/package.json devDependencies
- "@types/pg": "^8.11.6",     # Remove
+ "@types/better-sqlite3": "^7.6.0",  # Add

# Root package.json (new devDependencies for Electron)
+ "electron": "^33.0.0",
+ "electron-builder": "^25.0.0",
+ "concurrently": "^9.0.0",
+ "wait-on": "^8.0.0"
```

---

## 9. Testing Strategy

### 9.1 Unit Tests to Add

| Test | What to Verify |
|------|---------------|
| `vectorSearch.test.ts` | `cosineSimilarity()` returns 1.0 for identical vectors, 0 for orthogonal |
| `vectorSearch.test.ts` | `findKNearest()` returns correct K results sorted by similarity |
| `localEmbeddings.test.ts` | `generateEmbeddings()` returns 384-dim arrays |
| `localEmbeddings.test.ts` | Similar text produces similar embeddings |
| `keywordCategorize.test.ts` | "Starbucks" → dining, "Walmart" → groceries, "Uber" → transportation |
| `queries.test.ts` | BLOB serialization/deserialization roundtrips correctly |
| `queries.test.ts` | All CRUD operations work with SQLite |

### 9.2 Integration Tests to Update

| Existing Test | Changes Needed |
|--------------|----------------|
| `tests/categorize.test.ts` | Update to use SQLite, mock `localEmbeddings` |
| `tests/csv.test.ts` | No changes (CSV parsing is unchanged) |
| `tests/import-flow.test.ts` | Update to use SQLite instead of PostgreSQL |
| `tests/merchantNormalization.test.ts` | Update to use SQLite |

### 9.3 Manual Testing Checklist

- [ ] App launches on macOS (both Intel and Apple Silicon)
- [ ] App launches on Windows (x64)
- [ ] First run: model downloads automatically (~50MB)
- [ ] CSV import works (all supported bank templates)
- [ ] Embeddings generate without errors
- [ ] KNN categorization produces reasonable results
- [ ] Keyword categorization catches obvious categories
- [ ] Edit learning creates rules correctly
- [ ] Rules apply to future imports
- [ ] Database persists between app restarts
- [ ] App total RAM stays under 1GB during normal use
- [ ] App size is under 250MB installed

---

## Implementation Order & Dependencies

```
Phase 1: Database Migration ──────────────────────────────┐
  (PostgreSQL → SQLite)                                   │
  ↓                                                       │
Phase 2: Embedding Migration ────────────┐                │
  (vLLM → Transformers.js)              │                │
  ↓                                      │                │
Phase 3: KNN Service ────────────────────┤                │
  (pgvector → in-process JS)            │                │
  ↓                                      │                │
Phase 4: LLM Replacement ───────────────┤                │
  (Ollama → keyword engine)              │                │
                                         ↓                ↓
                                    Phase 5: Electron Packaging
                                      (bundle everything)
                                         ↓
                                    Phase 6: Data Migration Tool
                                      (PG → SQLite export)
```

**Start with Phase 1.** Everything else depends on the database layer being SQLite.
