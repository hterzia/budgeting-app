# Portable Budgeting App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the conversion from server-dependent architecture (PostgreSQL + vLLM + Ollama) to a fully self-contained Electron desktop app that runs offline on Mac/Windows with 8GB RAM and no GPU.

**Architecture:** The portable branch already has Phase 1 (SQLite) and Phase 3 (KNN) complete. This plan covers the remaining work: implementing Transformers.js embeddings (Phase 2), cleaning up dead code (Phase 4), packaging as Electron (Phase 5), building a data migration tool (Phase 6), and restoring test coverage.

**Tech Stack:** better-sqlite3, @huggingface/transformers (all-MiniLM-L6-v2, 384 dims), Electron, electron-builder, Vitest

**Starting point:** `portable` branch (1 commit ahead of main). All work happens on this branch.

---

## Current State (Portable Branch)

| Phase | Status | Notes |
|-------|--------|-------|
| 1: PostgreSQL → SQLite | DONE | schema.sql, sqliteQueries.ts, routes, server all converted |
| 2: vLLM → Transformers.js | STUB | embeddings.ts returns empty arrays |
| 3: pgvector → JS KNN | DONE | knn.ts has cosine similarity, works with BLOBs |
| 4: Ollama → Keywords | PARTIAL | Keyword categorization inline in categorizeSqlite.ts; llmCategorize.ts dead code remains |
| 5: Electron | NOT STARTED | No electron/ directory |
| 6: Data Migration | NOT STARTED | No migration script |
| Tests | 3 of 17 | Missing: embeddings, KNN, integration, import-flow, etc. |

**Known issue:** Embedding serialization uses Float64 (8 bytes/float) instead of Float32 (4 bytes). For 384-dim vectors this wastes 1,536 bytes per transaction. Must fix before generating real embeddings.

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `backend/src/services/localEmbeddings.ts` | In-process embedding generation via Transformers.js |
| `backend/src/services/vectorSearch.ts` | Cosine similarity + findKNearest utilities (extracted from knn.ts) |
| `backend/src/services/keywordCategorize.ts` | Standalone keyword categorization (extracted from categorizeSqlite.ts) |
| `backend/src/scripts/migrateFromPostgres.ts` | PostgreSQL → SQLite data migration CLI |
| `electron/main.ts` | Electron main process |
| `electron/preload.ts` | Electron preload script (IPC bridge) |
| `electron/tsconfig.json` | TypeScript config for Electron files |
| `electron-builder.yml` | Build/packaging configuration |
| `backend/tests/localEmbeddings.test.ts` | Embedding generation tests |
| `backend/tests/vectorSearch.test.ts` | Cosine similarity + KNN utility tests |
| `backend/tests/keywordCategorize.test.ts` | Keyword categorization tests |
| `backend/tests/sqliteQueries.test.ts` | BLOB serialization roundtrip + CRUD tests |
| `backend/tests/import-flow.test.ts` | End-to-end import flow integration test |

### Files to Modify

| File | What Changes |
|------|-------------|
| `backend/src/db/sqliteQueries.ts` | Fix Float64 → Float32 serialization |
| `backend/src/services/knn.ts` | Extract cosine similarity to vectorSearch.ts, import from there |
| `backend/src/services/categorizeSqlite.ts` | Extract keyword categorization to keywordCategorize.ts, integrate real embeddings |
| `backend/src/server.ts` | Export `startServer()` for Electron, init embedding model at startup |
| `backend/package.json` | Add `@huggingface/transformers`, remove `axios` |
| `package.json` (root) | Add Electron scripts + devDependencies |

### Files to Delete

| File | Reason |
|------|--------|
| `backend/src/services/llmCategorize.ts` | Dead code — replaced by keyword categorization |
| `backend/src/services/embeddings.ts` | Stub — replaced by localEmbeddings.ts |
| `backend/src/db/generateMigration.ts` | No incremental migrations in SQLite mode |

---

## Task 1: Fix Embedding Serialization (Float64 → Float32)

**Files:**
- Modify: `backend/src/db/sqliteQueries.ts:5-21`
- Create: `backend/tests/sqliteQueries.test.ts`

The current serialization uses `writeDoubleLE` (8 bytes/float). For 384-dim MiniLM embeddings, Float32 is sufficient and halves storage from 3,072 to 1,536 bytes per transaction. Since there are no real embeddings stored yet (the pipeline is stubbed), this is a safe change.

- [ ] **Step 1: Write the failing test for serialization roundtrip**

Create `backend/tests/sqliteQueries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeEmbedding, deserializeEmbedding } from '../src/db/sqliteQueries.js';

describe('embedding serialization', () => {
  it('roundtrips a 384-dim vector through Float32', () => {
    const original = Array.from({ length: 384 }, (_, i) => Math.sin(i) * 0.5);
    const buffer = serializeEmbedding(original);

    // Float32: 4 bytes per element
    expect(buffer.byteLength).toBe(384 * 4);

    const restored = deserializeEmbedding(buffer);
    expect(restored.length).toBe(384);

    // Float32 has ~7 decimal digits of precision
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 5);
    }
  });

  it('handles zero vector', () => {
    const zeros = new Array(384).fill(0);
    const buffer = serializeEmbedding(zeros);
    const restored = deserializeEmbedding(buffer);
    expect(restored).toEqual(zeros);
  });

  it('handles negative values', () => {
    const vec = [-1, -0.5, 0, 0.5, 1];
    const buffer = serializeEmbedding(vec);
    const restored = deserializeEmbedding(buffer);
    for (let i = 0; i < vec.length; i++) {
      expect(restored[i]).toBeCloseTo(vec[i], 5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/sqliteQueries.test.ts`
Expected: FAIL — current implementation uses Float64 so `buffer.byteLength` will be `384 * 8` not `384 * 4`.

- [ ] **Step 3: Fix serializeEmbedding and deserializeEmbedding**

In `backend/src/db/sqliteQueries.ts`, replace lines 5-21:

```typescript
// Serialize embedding array to Buffer (BLOB) for SQLite storage
// Uses Float32 (4 bytes/float) — sufficient precision for 384-dim MiniLM vectors
export function serializeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

// Deserialize Buffer (BLOB) to embedding array
export function deserializeEmbedding(buffer: Buffer): number[] {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/sqliteQueries.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/sqliteQueries.ts backend/tests/sqliteQueries.test.ts
git commit -m "fix: use Float32 for embedding serialization (halves storage)"
```

---

## Task 2: Extract vectorSearch.ts from knn.ts

**Files:**
- Create: `backend/src/services/vectorSearch.ts`
- Create: `backend/tests/vectorSearch.test.ts`
- Modify: `backend/src/services/knn.ts`

The `cosineSimilarity` function currently lives in `knn.ts`. Extract it to a standalone module so it can be tested independently and reused.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/vectorSearch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, findKNearest } from '../src/services/vectorSearch.js';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical normalized vectors', () => {
    const v = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 when either vector is all zeros', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });
});

describe('findKNearest', () => {
  const candidates = [
    { transactionId: 1, categoryId: 'groceries', embedding: [1, 0, 0] },
    { transactionId: 2, categoryId: 'dining', embedding: [0, 1, 0] },
    { transactionId: 3, categoryId: 'groceries', embedding: [0.9, 0.1, 0] },
    { transactionId: 4, categoryId: 'travel', embedding: [0, 0, 1] },
  ];

  it('returns K results sorted by similarity descending', () => {
    const query = [1, 0, 0]; // Most similar to candidate 1 and 3
    const results = findKNearest(query, candidates, 2);

    expect(results).toHaveLength(2);
    expect(results[0].transactionId).toBe(1);
    expect(results[0].similarity).toBeCloseTo(1.0, 3);
    expect(results[1].transactionId).toBe(3);
    expect(results[1].similarity).toBeGreaterThan(0.9);
  });

  it('returns all candidates when K > candidates.length', () => {
    const query = [1, 0, 0];
    const results = findKNearest(query, candidates, 100);
    expect(results).toHaveLength(4);
  });

  it('returns empty array for empty candidates', () => {
    const results = findKNearest([1, 0], [], 5);
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/vectorSearch.test.ts`
Expected: FAIL — module `vectorSearch.js` does not exist.

- [ ] **Step 3: Create vectorSearch.ts**

Create `backend/src/services/vectorSearch.ts`:

```typescript
/**
 * Compute cosine similarity between two vectors.
 * Returns value in [-1, 1]. For L2-normalized vectors, this equals the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

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

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/vectorSearch.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Update knn.ts to import from vectorSearch.ts**

In `backend/src/services/knn.ts`, replace the inline `cosineSimilarity` function:

Remove the `cosineSimilarity` function definition (lines ~14-33) and add this import at the top:

```typescript
import { cosineSimilarity } from './vectorSearch.js';
```

Keep the rest of knn.ts unchanged — it still uses `cosineSimilarity` the same way.

- [ ] **Step 6: Run existing tests to verify nothing broke**

Run: `cd backend && npx vitest run`
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/vectorSearch.ts backend/tests/vectorSearch.test.ts backend/src/services/knn.ts
git commit -m "refactor: extract vectorSearch.ts from knn.ts"
```

---

## Task 3: Extract keywordCategorize.ts from categorizeSqlite.ts

**Files:**
- Create: `backend/src/services/keywordCategorize.ts`
- Create: `backend/tests/keywordCategorize.test.ts`
- Modify: `backend/src/services/categorizeSqlite.ts`

The keyword categorization logic is currently inline in `categorizeSqlite.ts` as `keywordCategorizeTx()`. Extract it to its own module with the expanded keyword list from the plan doc.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/keywordCategorize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { keywordCategorize } from '../src/services/keywordCategorize.js';

describe('keywordCategorize', () => {
  const allCategories = new Set([
    'groceries', 'dining', 'transportation', 'utilities', 'housing',
    'healthcare', 'entertainment', 'shopping', 'travel', 'insurance',
    'education', 'personal-care', 'subscriptions', 'salary', 'transfers',
  ]);

  it('categorizes "Starbucks" as dining', () => {
    const result = keywordCategorize(
      { merchantClean: 'Starbucks', descriptionRaw: '', amountCents: -500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('dining');
  });

  it('categorizes "Whole Foods" as groceries', () => {
    const result = keywordCategorize(
      { merchantClean: 'Whole Foods Market', descriptionRaw: '', amountCents: -8500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('groceries');
  });

  it('categorizes "Uber" as transportation', () => {
    const result = keywordCategorize(
      { merchantClean: 'Uber', descriptionRaw: 'Trip', amountCents: -2500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('transportation');
  });

  it('categorizes income transactions as salary', () => {
    const result = keywordCategorize(
      { merchantClean: 'ADP Payroll', descriptionRaw: 'Direct Deposit', amountCents: 500000, type: 'income' },
      allCategories
    );
    expect(result.categoryId).toBe('salary');
  });

  it('returns null for unrecognizable merchants', () => {
    const result = keywordCategorize(
      { merchantClean: 'XYZZY Corp', descriptionRaw: '', amountCents: -1000, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBeNull();
  });

  it('skips categories not in validCategoryIds', () => {
    const limited = new Set(['groceries']);
    const result = keywordCategorize(
      { merchantClean: 'Starbucks', descriptionRaw: '', amountCents: -500, type: 'expense' },
      limited
    );
    // Starbucks matches 'dining' which is not in limited set
    expect(result.categoryId).toBeNull();
  });

  it('uses description_raw for matching too', () => {
    const result = keywordCategorize(
      { merchantClean: '', descriptionRaw: 'Netflix subscription', amountCents: -1599, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('entertainment');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/keywordCategorize.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create keywordCategorize.ts**

Create `backend/src/services/keywordCategorize.ts`:

```typescript
interface TransactionInput {
  merchantClean?: string;
  descriptionRaw?: string;
  amountCents: number;
  type?: string;
}

interface KeywordResult {
  categoryId: string | null;
  confidence: number;
}

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

/**
 * Categorize a single transaction using keyword matching.
 * Scores each category by total matched keyword character length.
 * Only returns a match if score >= 4 (at least one meaningful keyword matched).
 */
export function keywordCategorize(
  tx: TransactionInput,
  validCategoryIds: Set<string>
): KeywordResult {
  const text = `${tx.merchantClean ?? ''} ${tx.descriptionRaw ?? ''}`.toLowerCase();

  // Income transactions → salary shortcut
  if (tx.type === 'income' && validCategoryIds.has('salary')) {
    return { categoryId: 'salary', confidence: 0.7 };
  }

  let bestCategory: string | null = null;
  let bestScore = 0;

  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!validCategoryIds.has(categoryId)) continue;

    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryId;
    }
  }

  if (bestScore >= 4 && bestCategory) {
    return { categoryId: bestCategory, confidence: Math.min(0.95, bestScore / 20) };
  }

  return { categoryId: null, confidence: 0 };
}

/**
 * Batch version: categorize multiple transactions.
 * Returns a Map of transactionId → categoryId for matched transactions only.
 */
export function keywordCategorizeBatch(
  transactions: Array<TransactionInput & { id: number }>,
  validCategoryIds: Set<string>
): Map<number, { categoryId: string; confidence: number }> {
  const results = new Map<number, { categoryId: string; confidence: number }>();

  for (const tx of transactions) {
    const result = keywordCategorize(tx, validCategoryIds);
    if (result.categoryId) {
      results.set(tx.id, { categoryId: result.categoryId, confidence: result.confidence });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/keywordCategorize.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Update categorizeSqlite.ts to use the extracted module**

In `backend/src/services/categorizeSqlite.ts`:

1. Add import at top: `import { keywordCategorize } from './keywordCategorize.js';`
2. Delete the inline `keywordCategorizeTx` function (the last ~40 lines of the file)
3. In the categorization loop, replace:
   ```typescript
   // Step 3: Try keyword matching if still no category
   if (!categoryId) {
     const keywordResult = keywordCategorizeTx(tx);
   ```
   with:
   ```typescript
   // Step 3: Try keyword matching if still no category
   if (!categoryId) {
     const validIds = new Set(getCategoryIdsSqlite(db));
     const keywordResult = keywordCategorize(
       { merchantClean: tx.merchant_clean ?? '', descriptionRaw: tx.description_raw ?? '', amountCents: tx.amount_cents, type: tx.type },
       validIds
     );
   ```

   Add this helper near the other SQLite helpers:
   ```typescript
   function getCategoryIdsSqlite(db: Database): string[] {
     const rows = db.prepare('SELECT id FROM categories').all() as Array<{ id: string }>;
     return rows.map(r => r.id);
   }
   ```

- [ ] **Step 6: Run all tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/keywordCategorize.ts backend/tests/keywordCategorize.test.ts backend/src/services/categorizeSqlite.ts
git commit -m "refactor: extract keywordCategorize.ts from categorizeSqlite.ts"
```

---

## Task 4: Implement Transformers.js Embeddings (Phase 2)

**Files:**
- Create: `backend/src/services/localEmbeddings.ts`
- Create: `backend/tests/localEmbeddings.test.ts`
- Delete: `backend/src/services/embeddings.ts`
- Modify: `backend/package.json`

This is the core Phase 2 work. Replace the stub `embeddings.ts` with actual in-process embedding generation using `@huggingface/transformers` and the `all-MiniLM-L6-v2` model (22M params, 384 dims, ~50MB, CPU-only).

- [ ] **Step 1: Install dependencies**

```bash
cd backend
npm install @huggingface/transformers
npm uninstall axios  # No longer needed — was only used for vLLM HTTP calls
```

- [ ] **Step 2: Write the test**

Create `backend/tests/localEmbeddings.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { initEmbeddingModel, generateEmbeddings, EMBEDDING_DIMENSIONS } from '../src/services/localEmbeddings.js';

// These tests download a ~50MB model on first run. Skip in CI if needed.
describe('localEmbeddings', () => {
  beforeAll(async () => {
    await initEmbeddingModel();
  }, 120_000); // 2 min timeout for model download

  it('returns 384-dimensional embeddings', async () => {
    const results = await generateEmbeddings(['Hello world']);
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(results[0].every(v => typeof v === 'number' && !isNaN(v))).toBe(true);
  });

  it('returns one embedding per input text', async () => {
    const results = await generateEmbeddings(['text one', 'text two', 'text three']);
    expect(results).toHaveLength(3);
    results.forEach(emb => expect(emb).toHaveLength(EMBEDDING_DIMENSIONS));
  });

  it('produces similar embeddings for similar text', async () => {
    const [a, b, c] = await generateEmbeddings([
      'Starbucks coffee purchase',
      'Coffee shop latte',
      'Monthly rent payment',
    ]);

    // Inline cosine similarity for test
    const cosine = (x: number[], y: number[]) => {
      let dot = 0, nX = 0, nY = 0;
      for (let i = 0; i < x.length; i++) { dot += x[i]*y[i]; nX += x[i]*x[i]; nY += y[i]*y[i]; }
      return dot / (Math.sqrt(nX) * Math.sqrt(nY));
    };

    const simAB = cosine(a, b); // coffee vs coffee — should be high
    const simAC = cosine(a, c); // coffee vs rent — should be low

    expect(simAB).toBeGreaterThan(0.5);
    expect(simAC).toBeLessThan(simAB);
  });

  it('returns empty array for empty input', async () => {
    const results = await generateEmbeddings([]);
    expect(results).toEqual([]);
  });
}, { timeout: 180_000 }); // 3 min for entire suite
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/localEmbeddings.test.ts --timeout 180000`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Create localEmbeddings.ts**

Create `backend/src/services/localEmbeddings.ts`:

```typescript
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE = 64;

let embeddingPipeline: FeatureExtractionPipeline | null = null;

/**
 * Initialize the embedding model. Call once at app startup.
 * Downloads ~50MB model on first run, cached thereafter.
 *
 * In Electron, set cache dir before calling:
 *   process.env.TRANSFORMERS_CACHE = path.join(app.getPath('userData'), 'models');
 */
export async function initEmbeddingModel(): Promise<void> {
  if (embeddingPipeline) return;

  embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
    dtype: 'fp32',
    device: 'cpu',
  });
}

/**
 * Generate embeddings for an array of text strings.
 * Returns number[][] where each inner array has 384 elements.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized. Call initEmbeddingModel() first.');
  }

  const output = await embeddingPipeline(texts, {
    pooling: 'mean',
    normalize: true,
  });

  return output.tolist();
}

/**
 * Generate embeddings in batches for large sets of texts.
 * Yields progress after each batch.
 */
export async function generateEmbeddingsInBatches(
  texts: string[],
  onProgress?: (embedded: number, total: number) => void
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...embeddings);
    onProgress?.(allEmbeddings.length, texts.length);
  }

  return allEmbeddings;
}

export { MODEL_NAME };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/localEmbeddings.test.ts --timeout 180000`
Expected: PASS — model downloads on first run, then all 4 tests pass.

- [ ] **Step 6: Delete the old stub**

```bash
rm backend/src/services/embeddings.ts
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/localEmbeddings.ts backend/tests/localEmbeddings.test.ts backend/package.json backend/package-lock.json
git rm backend/src/services/embeddings.ts
git commit -m "feat: implement Transformers.js local embeddings (Phase 2)"
```

---

## Task 5: Wire Embeddings into the Import Pipeline

**Files:**
- Modify: `backend/src/services/categorizeSqlite.ts`
- Modify: `backend/src/routes/importsSqlite.ts`
- Modify: `backend/src/server.ts`

Now connect the real embedding generation to the import flow so that `POST /imports/:id/process` actually generates embeddings and uses them for KNN categorization.

- [ ] **Step 1: Update server.ts to init the embedding model at startup**

In `backend/src/server.ts`, add the import and init call:

```typescript
import { initEmbeddingModel } from './services/localEmbeddings.js';
```

In the server startup section (after `migrateUp()` call), add:

```typescript
// Pre-load embedding model (downloads ~50MB on first run)
initEmbeddingModel().catch(err => {
  logger.warn('Embedding model failed to load: %s', err.message);
  logger.warn('KNN categorization will be unavailable until model loads');
});
```

Note: We don't `await` this — the server starts immediately and the model loads in the background. If an import comes in before the model is ready, `generateEmbeddings` will throw and the import will still work (just without KNN).

- [ ] **Step 2: Update the `getOrCreateEmbeddingSqlite` function in categorizeSqlite.ts**

In `backend/src/services/categorizeSqlite.ts`, replace the `getOrCreateEmbeddingSqlite` function:

```typescript
import { generateEmbeddings } from './localEmbeddings.js';
import { serializeEmbedding, deserializeEmbedding } from '../db/sqliteQueries.js';

async function getOrCreateEmbeddingSqlite(
  db: Database,
  transactionId: number,
  userId: string,
  text: string
): Promise<number[] | null> {
  // Check for existing embedding
  const existing = db.prepare(
    'SELECT embedding FROM transaction_embeddings WHERE transaction_id = ?'
  ).get(transactionId) as { embedding: Buffer } | undefined;

  if (existing?.embedding && Buffer.isBuffer(existing.embedding)) {
    return deserializeEmbedding(existing.embedding);
  }

  // Generate new embedding
  try {
    const [embedding] = await generateEmbeddings([text]);
    if (embedding && embedding.length > 0) {
      db.prepare(
        'INSERT OR IGNORE INTO transaction_embeddings (transaction_id, user_id, embedding) VALUES (?, ?, ?)'
      ).run(transactionId, userId, serializeEmbedding(embedding));
      return embedding;
    }
  } catch (err: any) {
    console.warn(`[embedding] Failed for tx ${transactionId}: ${err.message}`);
  }

  return null;
}
```

Note: The `categorizeImportBatch` function must now be `async` since embedding generation is async. Update its signature:

```typescript
export async function categorizeImportBatch(
  db: Database,
  importBatchId: string,
  userId: string
): Promise<CategorizationResult> {
```

And the KNN step in the loop must `await`:

```typescript
    // Step 2: Try KNN if no rule match
    if (!categoryId && tx.text_for_embedding?.trim()) {
      const embedding = await getOrCreateEmbeddingSqlite(db, tx.id, userId, tx.text_for_embedding);
      // ... rest unchanged
    }
```

- [ ] **Step 3: Update importsSqlite.ts to handle async categorization**

In the `POST /imports/:id/process` route handler in `backend/src/routes/importsSqlite.ts`, the call to `categorizeImportBatch` is now async. Ensure it's awaited:

```typescript
const result = await categorizeImportBatch(db, id, userId);
```

(This should already be inside an `async` route handler, so just verify the `await` is present.)

- [ ] **Step 4: Run all tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass. (The categorize tests may need updating if they mock embeddings — check and fix.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/categorizeSqlite.ts backend/src/routes/importsSqlite.ts backend/src/server.ts
git commit -m "feat: wire Transformers.js embeddings into import pipeline"
```

---

## Task 6: Delete Dead Code (Phase 4 Cleanup)

**Files:**
- Delete: `backend/src/services/llmCategorize.ts`
- Delete: `backend/src/db/generateMigration.ts`

These files are no longer referenced anywhere in the portable branch.

- [ ] **Step 1: Verify no imports reference these files**

```bash
cd backend && grep -r "llmCategorize\|generateMigration" src/ --include="*.ts"
```

Expected: No matches (or only the files themselves).

- [ ] **Step 2: Delete the files**

```bash
rm backend/src/services/llmCategorize.ts
rm backend/src/db/generateMigration.ts
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git rm backend/src/services/llmCategorize.ts backend/src/db/generateMigration.ts
git commit -m "chore: remove dead code (llmCategorize, generateMigration)"
```

---

## Task 7: Electron Main Process (Phase 5)

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/tsconfig.json`
- Create: `electron-builder.yml`
- Modify: `package.json` (root)
- Modify: `backend/src/server.ts`

Package the app as a single Electron desktop application.

- [ ] **Step 1: Install Electron dependencies**

```bash
# From project root
npm install --save-dev electron electron-builder concurrently wait-on
```

- [ ] **Step 2: Modify server.ts to export startServer()**

In `backend/src/server.ts`, wrap the listen call so Electron can control the lifecycle:

```typescript
import { getDb, closeDb } from './db/sqlite.js';
import { migrateUp } from './db/migrateSqlite.js';
import { initEmbeddingModel } from './services/localEmbeddings.js';
import { logger } from './utils/logging.js';

// ... existing middleware and route setup ...

export async function startServer(): Promise<number> {
  const db = getDb();
  migrateUp();

  // Start loading embeddings model in background
  initEmbeddingModel().catch(err => {
    logger.warn('Embedding model failed to load: %s', err.message);
  });

  return new Promise((resolve) => {
    app.listen(PORT, BIND_HOST, () => {
      logger.info('Budgeting backend listening on %s:%d', BIND_HOST, PORT);
      resolve(PORT);
    });
  });
}

// Auto-start when run directly (not imported by Electron)
const isDirectRun = process.argv[1]?.includes('server');
if (isDirectRun) {
  startServer();
}

// Graceful shutdown
process.on('SIGTERM', () => closeDb());
process.on('SIGINT', () => closeDb());
```

- [ ] **Step 3: Create electron/tsconfig.json**

Create `electron/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 4: Create electron/preload.ts**

Create `electron/preload.ts`:

```typescript
import { contextBridge } from 'electron';

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
```

- [ ] **Step 5: Create electron/main.ts**

Create `electron/main.ts`:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

// Set environment for backend
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
    titleBarStyle: 'hiddenInset',
    title: 'Budget',
  });

  // Start the Express backend
  const { startServer } = await import('../backend/dist/server.js');
  const port = await startServer();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
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

- [ ] **Step 6: Create electron-builder.yml**

Create `electron-builder.yml` in project root:

```yaml
appId: com.budgeting.app
productName: Budget
directories:
  output: release

files:
  - electron/dist/**/*
  - backend/dist/**/*
  - backend/src/db/schema.sql
  - frontend/dist/**/*

mac:
  category: public.app-category.finance
  target:
    - dmg
    - zip

win:
  target:
    - nsis
    - portable

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 7: Update root package.json with Electron scripts**

Add these scripts to the root `package.json`:

```json
{
  "scripts": {
    "electron:dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\" \"wait-on http://localhost:3000 && electron electron/main.ts\"",
    "electron:build": "npm run build && tsc -p electron/tsconfig.json && electron-builder",
    "electron:build:mac": "npm run electron:build -- --mac",
    "electron:build:win": "npm run electron:build -- --win"
  }
}
```

- [ ] **Step 8: Test Electron dev mode**

```bash
npm run electron:dev
```

Expected: Electron window opens showing the budgeting app frontend, backend is accessible.

- [ ] **Step 9: Commit**

```bash
git add electron/ electron-builder.yml package.json package-lock.json backend/src/server.ts
git commit -m "feat: add Electron desktop packaging (Phase 5)"
```

---

## Task 8: Data Migration Tool (Phase 6)

**Files:**
- Create: `backend/src/scripts/migrateFromPostgres.ts`

For users with existing data in PostgreSQL, provide a CLI tool that exports data and imports into SQLite, re-generating embeddings with the new MiniLM model.

- [ ] **Step 1: Create the migration script**

Create `backend/src/scripts/migrateFromPostgres.ts`:

```typescript
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

  // 4. Migrate transactions (special handling for boolean fields)
  {
    const { rows } = await pool.query('SELECT * FROM transactions');
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]).filter(c => c !== 'embedding'); // Skip any vector columns
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

  // 6. Re-generate embeddings with MiniLM (old 4096-dim vectors are incompatible)
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
```

- [ ] **Step 2: Add npm script**

In `backend/package.json`, add to scripts:

```json
"migrate:from-postgres": "tsx src/scripts/migrateFromPostgres.ts"
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/migrateFromPostgres.ts backend/package.json
git commit -m "feat: add PostgreSQL to SQLite migration tool (Phase 6)"
```

---

## Task 9: Integration Test — Full Import Flow

**Files:**
- Create: `backend/tests/import-flow.test.ts`

End-to-end test that verifies the complete import pipeline: CSV upload → parsing → embedding → categorization → review queue.

- [ ] **Step 1: Write the integration test**

Create `backend/tests/import-flow.test.ts`:

```typescript
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
    // Create fresh test database
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
        userId, importBatchId: 'batch1', postedAt: '2026-01-15',
        amountCents: -5000, currency: 'USD', merchantRaw: 'STARBUCKS #1234',
        descriptionRaw: 'Coffee', merchantClean: 'Starbucks',
        textForEmbedding: 'Merchant: Starbucks. Description: Coffee. Type: expense. Amount: medium. Domain: coffee.',
        categoryId: null, categorySource: 'unknown' as const,
        categoryConfidence: null, needsReview: true,
        accountId: 'acc1', type: 'expense' as const,
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

    // Simulate user editing category
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
```

- [ ] **Step 2: Run test**

Run: `cd backend && npx vitest run tests/import-flow.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/import-flow.test.ts
git commit -m "test: add SQLite import flow integration test"
```

---

## Task 10: Run Full Test Suite and Fix Issues

**Files:**
- Possibly modify: any test file or source file with failures

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npx vitest run
```

- [ ] **Step 2: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 3: Run type check**

```bash
npm run type-check
```

- [ ] **Step 4: Fix any failures discovered**

Address each failure individually. Common issues to expect:
- Import paths referencing deleted files (`embeddings.ts`, `llmCategorize.ts`)
- Type errors from async/sync changes in categorization
- Missing type exports

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test and type-check issues from portability migration"
```

---

## Task 11: Manual Smoke Test

This is not automated — run through the app manually to verify core functionality.

- [ ] **Step 1: Start the dev servers**

```bash
npm run dev
```

- [ ] **Step 2: Verify these flows work**

- [ ] App loads at localhost:3000
- [ ] CSV import succeeds (upload a test CSV)
- [ ] Embeddings generate without error (check backend logs)
- [ ] Transactions appear in the transaction list
- [ ] Category editing works and creates rules
- [ ] Dashboard charts render with data
- [ ] Date range selector works

- [ ] **Step 3: Check resource usage**

```bash
# In a separate terminal while app is running
ps aux | grep node | grep -v grep
```

Verify backend RAM is under 500MB (most will be the embedding model).

---

## Implementation Order & Dependencies

```
Task 1: Fix Float32 serialization ─────────────┐
                                                 │
Task 2: Extract vectorSearch.ts ────────────────┤
                                                 │
Task 3: Extract keywordCategorize.ts ───────────┤
                                                 ├──▶ Task 5: Wire embeddings into pipeline
Task 4: Implement Transformers.js embeddings ───┘       │
                                                         │
Task 6: Delete dead code ───────────────────────────────┤
                                                         │
Task 7: Electron packaging ─────────────────────────────┤
                                                         │
Task 8: Data migration tool ────────────────────────────┤
                                                         │
Task 9: Integration test ──────────────────────────────┘
                                                         │
Task 10: Full test suite fix ───────────────────────────┘
                                                         │
Task 11: Manual smoke test ─────────────────────────────┘
```

Tasks 1-4 can be done in parallel. Task 5 depends on Tasks 1 and 4. Tasks 6-9 can be done after Task 5. Task 10-11 are final verification.
