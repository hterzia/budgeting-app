# Category Feature Implementation Plan (pgvector + rules + KNN)

> **⚠️ Historical Plan:** This plan was written before the app migrated to a backend API architecture. References to Dexie and the local `src/database/db.ts` file are no longer applicable — the app now uses an Express + PostgreSQL backend with no browser-side database.

**Revision date:** March 5, 2026

## Goal
Ship reliable auto-categorization for monthly CSV imports using `rules -> KNN -> needs_review`, with immediate learning from user edits.

- In scope now: batch CSV imports, per-user isolation, review queue, edit-learning loop.
- Out of scope now: webhook ingestion, cross-user model sharing, supervised classifier training.

## Current repo reality
- Frontend is Vite + React with local Dexie (`src/database/db.ts`).
- CSV parsing and transaction-type heuristics already exist in `src/parsers/csvParser.ts`.
- This plan adds a backend service + Postgres/pgvector while keeping the existing frontend flow.

---

## High-level flow
1. Import CSV batch and normalize rows.
2. Save transactions, build `text_for_embedding`, and generate embeddings in batches.
3. Categorize rows with rules first, then KNN over trusted labeled examples.
4. Put low-confidence rows in review queue.
5. When user edits a category, record label, optionally create rule, and reuse label in future KNN immediately.

---

## Phase 0 - Decisions locked
- Embedding model: `nvidia/llama-embed-nemotron-8b` (4096 dimensions, cosine similarity).
- Embedding endpoint: self-hosted vLLM OpenAI-compatible API at `http://localhost:8001/v1/embeddings`.
- Service shape: thin Node/TS API + job worker + Postgres.
- Initial embedding batch size: `256` texts per request, then tune with real latency and VRAM measurements.

---

## Phase 1 - Postgres + pgvector setup
1. Enable extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Create schema/tables first.
3. Defer HNSW index until enough rows exist (exact scan is acceptable early).
4. Add HNSW in a later migration when volume justifies it.
   - Suggested trigger: `transaction_embeddings` > 250k rows total or KNN query p95 > 250ms.

---

## Phase 2 - Data model

### import_batches
Tracks async import state for UI polling.
```sql
CREATE TABLE import_batches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded','parsing','embedding','categorizing','completed','failed')),
  total_rows INT NOT NULL DEFAULT 0,
  embedded_rows INT NOT NULL DEFAULT 0,
  auto_categorized_rows INT NOT NULL DEFAULT 0,
  needs_review_rows INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ON import_batches (user_id, created_at DESC);
```

### transactions
Stores raw import data + final category state.
```sql
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  posted_at DATE NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_raw TEXT,
  description_raw TEXT,
  merchant_clean TEXT,
  text_for_embedding TEXT,
  category_id TEXT,
  category_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (category_source IN ('rule','knn','manual','unknown')),
  category_confidence REAL,
  needs_review BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON transactions (user_id, posted_at);
CREATE INDEX ON transactions (user_id, merchant_clean);
CREATE INDEX ON transactions (import_batch_id);
CREATE INDEX ON transactions (user_id, needs_review);
```

### transaction_embeddings
Holds one vector per transaction.
```sql
CREATE TABLE transaction_embeddings (
  transaction_id BIGINT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  embedding vector(4096) NOT NULL
);

CREATE INDEX ON transaction_embeddings (user_id);
-- Add HNSW later (Phase 8), not in initial migration:
-- CREATE INDEX transaction_embeddings_hnsw
--   ON transaction_embeddings
--   USING hnsw (embedding vector_cosine_ops);
```

### transaction_labels
Audit trail + trusted training source from explicit user edits.
```sql
CREATE TABLE transaction_labels (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_category_id TEXT,
  new_category_id TEXT NOT NULL,
  labeled_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON transaction_labels (user_id, created_at DESC);
CREATE INDEX ON transaction_labels (transaction_id, created_at DESC);
```

### category_rules
Deterministic fast path.
```sql
CREATE TABLE category_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('merchant_clean','contains','regex')),
  match_value TEXT NOT NULL,
  category_id TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_from TEXT NOT NULL DEFAULT 'edit_learning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX category_rules_unique_exact
  ON category_rules (user_id, match_type, match_value, category_id);
CREATE INDEX ON category_rules (user_id, enabled, priority);
```

---

## Phase 3 - CSV import pipeline (batch-first)
A) Upload + parse
- Validate required columns: date, amount, merchant/description.
- Reuse current template detection and normalization logic from `src/parsers/csvParser.ts` (extract shared helpers to avoid frontend/backend drift).
- Create `import_batches` row with `status='uploaded'`.
- Insert parsed rows into `transactions` with `needs_review=true`, `category_source='unknown'`.

B) Batch embed
- Select rows in batch with `text_for_embedding IS NOT NULL`.
- Call vLLM embeddings in chunks (start at 256).
- Insert into `transaction_embeddings`; update `import_batches.embedded_rows`.

C) Categorize (rules -> KNN -> review)
1. Rules pass:
   - Apply highest-priority enabled rule.
   - Set `category_source='rule'`, `category_confidence=0.98`, `needs_review=false`.
2. KNN pass for remaining uncategorized rows:
   - Use only trusted labels from `transaction_labels` (latest label per transaction).
   - K=20; weighted vote by similarity.
3. Decision thresholds:
   - assign category if agreement >= 6 of top 20 and top similarity >= 0.80.
   - otherwise keep `needs_review=true` and leave `category_id` null.
4. Update batch counters and set `import_batches.status='completed'` or `'failed'`.

---

## Phase 4 - KNN query pattern (cosine, trusted labels only)
```sql
WITH latest_labels AS (
  SELECT DISTINCT ON (tl.transaction_id)
    tl.transaction_id,
    tl.new_category_id AS category_id
  FROM transaction_labels tl
  WHERE tl.user_id = :user_id
  ORDER BY tl.transaction_id, tl.created_at DESC
)
SELECT ll.category_id,
       1 - (e.embedding <=> :query_embedding) AS similarity
FROM latest_labels ll
JOIN transaction_embeddings e ON e.transaction_id = ll.transaction_id
ORDER BY e.embedding <=> :query_embedding
LIMIT 20;
```
App layer applies similarity-weighted voting and threshold checks.

---

## Phase 5 - Build `text_for_embedding`
- Start with `merchant_clean`.
- Add useful description keywords.
- Optionally add normalized hints: channel (`online|pos|ach`), amount bucket (`small|medium|large`), inferred transaction type.
- Keep format stable across imports for better nearest-neighbor quality.

Example:
`Merchant: Blue Bottle Coffee. Description: SQ BLUEBOTTLE. Type: card purchase. Amount: small. Domain: coffee.`

---

## Phase 6 - Learning from user edits
When user changes a category:
1. Update transaction: set `category_id`, `category_source='manual'`, `needs_review=false`.
2. Insert label row into `transaction_labels`.
3. Offer toggle: "Apply to future transactions from this merchant?"
4. If enabled, upsert a `merchant_clean` rule in `category_rules`.
5. Optional second toggle: "Apply to past uncategorized matches?" (bulk backfill).
6. No re-embedding required for category-only edits.

---

## Phase 7 - UX review queue
- Group by `merchant_clean` with count and sample rows.
- Show source/confidence badges (`rule`, `knn`, `manual`, `unknown`).
- Support bulk labeling and "apply to past/future" toggles.
- Keep one-click category override from the transaction list.

---

## Phase 8 - Scale path
- Run embedding and categorization in async jobs.
- Process only uncategorized rows through KNN.
- Add HNSW index when threshold is hit; optionally `REINDEX` during maintenance windows.
- Track p50/p95 for embedding latency and KNN latency.

---

## Phase 9 - Integration tasks for this repo
1. Add backend workspace (Node/TS) with endpoints:
   - `POST /imports`
   - `GET /imports/:id`
   - `GET /imports/:id/review-queue`
   - `POST /transactions/:id/category`
2. Share CSV normalization logic between frontend and backend (move parser helpers into a shared module/package).
3. Frontend updates:
   - Upload CSV to backend import endpoint.
   - Poll batch status from `import_batches`.
   - Render merchant-grouped review queue with bulk actions.
4. Keep Dexie as UI cache/offline layer initially; backend Postgres is source of truth for categorization fields.
5. Add per-batch metrics logging: total, embedded, auto-categorized, needs-review, failures.

---

## Milestones / order of execution
1. Schema + extension + import-batch tracking.
2. Batch pipeline (parse -> embed -> categorize).
3. Edit-learning loop (manual labels + optional rules).
4. Review queue UI + bulk actions.
5. Scale optimizations (async tuning + HNSW rollout).

---

## Acceptance criteria
- Batch import returns status updates and completes without blocking UI.
- At least one deterministic rule and one manual edit both influence future categorization.
- KNN uses explicit user labels (no self-training on low-confidence auto labels).
- Review queue shows all `needs_review=true` rows grouped by merchant.
- Source/confidence fields are visible and editable in UI.

---

## Open questions
- vLLM practical limits at `localhost:8001` (max input length, stable batch size, timeout behavior).
- Category taxonomy ownership and versioning (static list vs user-editable).
- Migration strategy for existing local-only Dexie data into backend records.
- Final threshold tuning after first real imports (agreement count, similarity cutoff).
