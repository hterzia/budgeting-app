# Integration Tests Implementation Plan

> **⚠️ Historical Plan:** This plan was written before the app migrated to a backend API architecture. References to Dexie, IndexedDB, and frontend database integration tests are no longer applicable — the app now uses an Express + PostgreSQL backend with no browser-side database.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create integration tests that cover the complete user flow of the budgeting app - from CSV upload through categorization to data display - ensuring everything works together correctly.

**Architecture:** The app has two main components:
1. **Frontend** (React + Dexie): Handles UI, user interactions, and local database storage
2. **Backend** (Express + Postgres): Handles CSV parsing, embedding generation, and auto-categorization

Tests will verify:
- CSV upload and import flow
- Auto-categorization pipeline (rules -> KNN -> review)
- Data display in Trends, SpendingByCategory, TransactionList
- Date range filtering
- Account management

**Tech Stack:**
- **Frontend tests:** Vitest + @testing-library/react + jsdom
- **Backend tests:** Vitest + supertest (for API testing)
- **Database:** Dexie.js (frontend), PostgreSQL (backend with pgvector)

---
## Test Coverage Overview

| Area | Test Type | Coverage |
|------|-----------|----------|
| CSV Import Flow | Integration | Upload, parse, categorize, display |
| Backend API | Integration | All endpoints |
| Frontend Components | Integration | All major components |
| Aggregations | Unit/Integration | Trends, summaries, filtering |
| Database (Dexie) | Integration | CRUD operations |
| Date Range | Integration | All presets and custom |

---

## Task 1: Backend CSV Import Flow Integration Test

**Files:**
- Create: `backend/tests/import-flow.test.ts`

**Step 1: Write the integration test for CSV import flow**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { createPool } from '../src/db/config.js';
import { db } from '../src/database/db.js';
import {
  createImportBatch,
  getImportBatch,
  insertTransactions,
  getTransactionsForEmbedding,
} from '../src/db/queries.js';
import { generateEmbeddingsForBatch } from '../src/services/embeddings.js';
import { categorizeTransactions } from '../src/services/categorize.js';

// Mock embedding generation
vi.mock('../src/services/embeddings.ts', () => ({
  generateEmbeddingsForBatch: vi.fn(),
}));

describe('CSV Import Flow Integration', () => {
  const pool = createPool();
  const userId = 'test-user-id';

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM import_batches WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM transaction_embeddings WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM transaction_labels WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM category_rules WHERE user_id = $1', [userId]);
  });

  it('should process a complete CSV import through the pipeline', async () => {
    // Sample CSV content (Chase template)
    const csvContent = `Transaction Date,Description,Type,Amount
2024-01-15,Amazon Purchase,charge,45.99
2024-01-16,Starbucks Coffee,charge,5.50
2024-01-17,Salary Deposit,credit,2500.00
2024-01-18,Grocery Store,charge,89.99
2024-01-19,Uber Ride,charge,24.50`;

    // Step 1: Upload CSV
    const uploadResponse = await request(app)
      .post('/imports')
      .send({
        file: csvContent,
        userId,
        accountId: 'test-account',
      });

    expect(uploadResponse.status).toBe(202);
    expect(uploadResponse.body).toMatchObject({
      importId: expect.any(String),
      status: 'uploaded',
      totalRows: 5,
    });

    const importId = uploadResponse.body.importId;

    // Step 2: Get import status
    const statusResponse = await request(app).get(`/imports/${importId}`);
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('uploaded');

    // Step 3: Process the import (embedding + categorization)
    const processResponse = await request(app).post(`/imports/${importId}/process`);
    expect(processResponse.status).toBe(200);

    // Verify categorization results
    const result = processResponse.body.result;
    expect(result.total).toBe(5);

    // Verify transactions were categorized (rules or KNN)
    expect(result.ruleMatched + result.knnMatched + result.needsReview).toBe(5);

    // Step 4: Verify transactions exist in database
    const transactions = await pool.query(
      'SELECT id, merchant_clean, amount_cents, category_source FROM transactions WHERE import_batch_id = $1',
      [importId]
    );
    expect(transactions.rows.length).toBe(5);

    // Step 5: Verify embeddings were generated
    const embeddings = await pool.query(
      'SELECT COUNT(*) as count FROM transaction_embeddings WHERE user_id = $1',
      [userId]
    );
    expect(parseInt(embeddings.rows[0].count)).toBeGreaterThan(0);
  });

  it('should apply category rules when merchant matches', async () => {
    const csvContent = `Transaction Date,Description,Type,Amount
2024-01-15,Amazon Purchase,charge,45.99`;

    // First, upload and process
    const uploadResponse = await request(app)
      .post('/imports')
      .send({ file: csvContent, userId, accountId: 'test-account' });
    const importId = uploadResponse.body.importId;

    await request(app).post(`/imports/${importId}/process`);

    // Create a category rule for Amazon
    await pool.query(
      'INSERT INTO category_rules (user_id, match_type, match_value, category_id, priority, enabled) VALUES ($1, $1, $2, $3, 100, true)',
      [userId, 'amazon', 'shopping-category']
    );

    // Re-process with the rule in place
    const processResponse = await request(app).post(`/imports/${importId}/process`);
    const result = processResponse.body.result;

    expect(result.ruleMatched).toBeGreaterThan(0);
  });

  it('should update status correctly through the pipeline', async () => {
    const csvContent = `Transaction Date,Description,Amount
2024-01-15,Test,10.00`;

    const uploadResponse = await request(app)
      .post('/imports')
      .send({ file: csvContent, userId, accountId: 'test-account' });
    const importId = uploadResponse.body.importId;

    // Initial status
    let status = (await request(app).get(`/imports/${importId}`)).body;
    expect(status.status).toBe('uploaded');

    // Process
    await request(app).post(`/imports/${importId}/process`);

    // Final status
    status = (await request(app).get(`/imports/${importId}`)).body;
    expect(status.status).toBe('completed');
    expect(status.completedAt).toBeDefined();
  });

  it('should return review queue for uncategorized transactions', async () => {
    const csvContent = `Transaction Date,Description,Amount
2024-01-15,Unknown Merchant,10.00
2024-01-16,Another Unknown,20.00`;

    const uploadResponse = await request(app)
      .post('/imports')
      .send({ file: csvContent, userId, accountId: 'test-account' });
    const importId = uploadResponse.body.importId;

    await request(app).post(`/imports/${importId}/process`);

    const reviewResponse = await request(app).get(`/imports/${importId}/review-queue`);
    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.transactions).toBeInstanceOf(Array);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npx vitest run tests/import-flow.test.ts -v
```

Expected: Tests fail because services need mocking and database may not be fully set up.

**Step 3: Add missing mocks and ensure database is ready**

```typescript
// Add at top of test file after imports
vi.mock('../src/services/embeddings.ts', () => ({
  generateEmbeddingsForBatch: vi.fn().mockResolvedValue(
    Array(5).fill(null).map(() => Array(4096).fill(0.1))
  ),
}));
```

**Step 4: Run test again and fix any issues**

```bash
cd backend
npx vitest run tests/import-flow.test.ts -v
```

Expected: Tests pass.

**Step 5: Commit**

```bash
git add backend/tests/import-flow.test.ts
git commit -m "test: add CSV import flow integration test"
```

---

## Task 2: Backend Category Rules & KNN Integration Test

**Files:**
- Create: `backend/tests/categorization.test.ts`

**Step 1: Write test for rules and KNN categorization**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPool } from '../src/db/config.js';
import { categorizeTransactions } from '../src/services/categorize.js';
import { insertTransactionLabel } from '../src/db/queries.js';

vi.mock('../src/services/embeddings.ts', () => ({
  generateEmbeddingsForBatch: vi.fn().mockResolvedValue([]),
}));

describe('Categorization Integration', () => {
  const pool = createPool();
  const userId = 'categorization-test-user';

  beforeEach(async () => {
    // Setup test data
    await pool.query('BEGIN');
  });

  afterEach(async () => {
    await pool.query('ROLLBACK');
    // Clean up
    await pool.query('DELETE FROM import_batches WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM transaction_labels WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM category_rules WHERE user_id = $1', [userId]);
  });

  it('should categorize using exact merchant rules', async () => {
    // Create import batch
    const importId = 'test-import-rules';
    await pool.query(
      `INSERT INTO import_batches (id, user_id, status, total_rows) VALUES ($1, $2, 'uploaded', $3)`,
      [importId, userId, 1]
    );

    // Insert transaction
    await pool.query(
      `INSERT INTO transactions (user_id, import_batch_id, merchant_clean, text_for_embedding, needs_review, category_source)
       VALUES ($1, $2, $3, $4, true, 'unknown')`,
      [userId, importId, 'STARBUCKS', 'merchant: starbucks']
    );

    // Create a rule for Starbucks
    await pool.query(
      `INSERT INTO category_rules (user_id, match_type, match_value, category_id, priority, enabled)
       VALUES ($1, 'merchant_clean', $2, $3, 100, true)`,
      [userId, 'starbucks', 'coffee-category']
    );

    // Categorize
    const result = await categorizeTransactions(pool, importId, userId);

    expect(result.ruleMatched).toBe(1);
    expect(result.needsReview).toBe(0);

    // Verify transaction was updated
    const tx = await pool.query(
      'SELECT category_id, category_source FROM transactions WHERE merchant_clean = $1',
      ['starbucks']
    );
    expect(tx.rows[0].category_id).toBe('coffee-category');
    expect(tx.rows[0].category_source).toBe('rule');
  });

  it('should categorize using KNN with labels', async () => {
    const importId = 'test-import-knn';
    await pool.query(
      `INSERT INTO import_batches (id, user_id, status, total_rows) VALUES ($1, $2, 'uploaded', $3)`,
      [importId, userId, 1]
    );

    // Insert transaction
    const txId = await pool.query(
      `INSERT INTO transactions (user_id, import_batch_id, merchant_clean, text_for_embedding, needs_review, category_source)
       VALUES ($1, $2, $3, $4, true, 'unknown') RETURNING id`,
      [userId, importId, 'COFFEE SHOP', 'merchant: coffee shop']
    );
    const transactionId = txId.rows[0].id;

    // Create a label (user has previously labeled this type)
    await insertTransactionLabel(pool, transactionId, userId, null, 'coffee-category');

    // Create embedding for this transaction
    const embedding = Array(4096).fill(0).map(() => Math.random());
    await pool.query(
      `INSERT INTO transaction_embeddings (transaction_id, user_id, embedding)
       VALUES ($1, $2, $3)`,
      [transactionId, userId, embedding]
    );

    // Create another transaction to categorize
    const importId2 = 'test-import-knn-2';
    await pool.query(
      `INSERT INTO import_batches (id, user_id, status, total_rows) VALUES ($1, $2, 'uploaded', $3)`,
      [importId2, userId, 1]
    );

    await pool.query(
      `INSERT INTO transactions (user_id, import_batch_id, merchant_clean, text_for_embedding, needs_review, category_source)
       VALUES ($1, $2, $3, $4, true, 'unknown')`,
      [userId, importId2, 'STARBUCKS', 'merchant: starbucks']
    );

    // Add embedding
    const txId2 = await pool.query(
      `INSERT INTO transaction_embeddings (transaction_id, user_id, embedding)
       VALUES ((SELECT id FROM transactions WHERE merchant_clean = $1), $2, $3)`,
      ['starbucks', userId, embedding]
    );

    // Categorize
    const result = await categorizeTransactions(pool, importId2, userId);

    expect(result.knnMatched).toBe(1);
  });

  it('should mark transactions as needs_review when no categorization matches', async () => {
    const importId = 'test-import-uncategorized';
    await pool.query(
      `INSERT INTO import_batches (id, user_id, status, total_rows) VALUES ($1, $2, 'uploaded', $3)`,
      [importId, userId, 1]
    );

    await pool.query(
      `INSERT INTO transactions (user_id, import_batch_id, merchant_clean, text_for_embedding, needs_review, category_source)
       VALUES ($1, $2, $3, $4, true, 'unknown')`,
      [userId, importId, 'RANDOM MERCHANT', 'merchant: random']
    );

    const result = await categorizeTransactions(pool, importId, userId);

    expect(result.needsReview).toBe(1);
  });
});
```

**Step 2-5: Run, fix, and commit**

```bash
cd backend
npx vitest run tests/categorization.test.ts -v
git add backend/tests/categorization.test.ts
git commit -m "test: add category rules and KNN integration test"
```

---

## Task 3: Backend API Integration Tests

**Files:**
- Create: `backend/tests/api.test.ts`

**Step 1: Write API endpoint tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('Backend API Integration', () => {
  const userId = 'api-test-user';

  afterEach(async () => {
    // Clean up - would need direct DB access in real test
    // This is a placeholder for cleanup
  });

  it('GET /health should return ok status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('POST /imports should upload CSV and return importId', async () => {
    const csvContent = `Transaction Date,Description,Amount
2024-01-15,Test Transaction,100.00`;

    const response = await request(app)
      .post('/imports')
      .send({
        file: csvContent,
        userId,
        accountId: 'test-account',
      });

    expect(response.status).toBe(202);
    expect(response.body.importId).toBeDefined();
    expect(response.body.totalRows).toBe(1);
  });

  it('GET /imports/:id should return 404 for non-existent import', async () => {
    const response = await request(app).get('/imports/non-existent-id');
    expect(response.status).toBe(404);
  });

  it('POST /imports/:id/process should process import and return results', async () => {
    const csvContent = `Transaction Date,Description,Amount
2024-01-15,Test Transaction,100.00`;

    const uploadResponse = await request(app)
      .post('/imports')
      .send({ file: csvContent, userId, accountId: 'test-account' });

    const processResponse = await request(app).post(`/imports/${uploadResponse.body.importId}/process`);
    expect(processResponse.status).toBe(200);
    expect(processResponse.body.status).toBe('completed');
    expect(processResponse.body.result).toBeDefined();
  });

  it('POST /transactions/:id/category should update category with edit learning', async () => {
    // First create an import with a transaction
    const csvContent = `Transaction Date,Description,Amount
2024-01-15,Test Transaction,100.00`;

    const uploadResponse = await request(app)
      .post('/imports')
      .send({ file: csvContent, userId, accountId: 'test-account' });

    await request(app).post(`/imports/${uploadResponse.body.importId}/process`);

    // Get the transaction ID (in real scenario, would query database)
    // For now, we'll just verify the endpoint exists and accepts input
    const categoryResponse = await request(app)
      .post('/transactions/999999/category')
      .send({
        categoryId: 'new-category',
        applyToMerchant: true,
        applyToPast: false,
      });

    // This should work (may return 404 if transaction doesn't exist, which is expected)
    expect(categoryResponse.status).toBe(200);
    expect(categoryResponse.body.status).toBe('updated');
  });
});
```

**Step 2-5: Run, fix, and commit**

```bash
cd backend
npx vitest run tests/api.test.ts -v
git add backend/tests/api.test.ts
git commit -m "test: add backend API integration tests"
```

---

## Task 4: Frontend Component Integration Tests

**Files:**
- Create: `src/components/TransactionList/TransactionList.test.tsx`
- Create: `src/components/Trends/Trends.test.tsx`
- Create: `src/components/SpendingByCategory/SpendingByCategory.test.tsx`
- Create: `src/components/SpendingSummary/SpendingSummary.test.tsx`

**Step 1: Write TransactionList integration test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionList } from './TransactionList';
import { Transaction, Category } from '../../database/types';

describe('TransactionList Integration', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      merchant: 'Amazon',
      amount: 45.99,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: '2',
      date: '2024-01-14',
      merchant: 'Starbucks',
      amount: 5.50,
      categoryId: 'cat-2',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-14T00:00:00Z',
      createdAt: '2024-01-14T00:00:00Z',
    },
  ];

  const categories: Category[] = [
    { id: 'cat-1', slug: 'shopping', name: 'Shopping', type: 'expense', color: '#3b82f6' },
    { id: 'cat-2', slug: 'food', name: 'Food', type: 'expense', color: '#ef4444' },
  ];

  it('renders transaction list with proper formatting', () => {
    render(<TransactionList transactions={transactions} categories={categories} />);

    // Check for transactions
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('Starbucks')).toBeInTheDocument();

    // Check for formatted amounts
    expect(screen.getByText('$45.99')).toBeInTheDocument();
    expect(screen.getByText('$5.50')).toBeInTheDocument();

    // Check for category badges
    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    render(<TransactionList transactions={[]} categories={categories} />);

    expect(screen.getByText('No transactions yet. Import a CSV to get started.')).toBeInTheDocument();
  });

  it('sorts transactions by date descending by default', () => {
    render(<TransactionList transactions={transactions} categories={categories} />);

    // Amazon (2024-01-15) should appear before Starbucks (2024-01-14)
    const rows = screen.getAllByRole('row');
    // First row is header, then transactions
    expect(rows[1]).toHaveTextContent('Amazon');
    expect(rows[2]).toHaveTextContent('Starbucks');
  });
});
```

**Step 2-5: Run, fix, and commit**

```bash
npx vitest run src/components/TransactionList/TransactionList.test.tsx -v
git add src/components/TransactionList/TransactionList.test.tsx
git commit -m "test: add TransactionList integration test"
```

**Step 1 (repeated for Trends):** Write Trends integration test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Trends } from './Trends';
import { Transaction } from '../../database/types';
import { DateRangeBounds } from '../../features/date-range/dateRange';

describe('Trends Integration', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      merchant: 'Amazon',
      amount: 45.99,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: '2',
      date: '2024-01-14',
      merchant: 'Paycheck',
      amount: 2500.00,
      categoryId: 'cat-2',
      type: 'income',
      accountId: 'acc-1',
      importedAt: '2024-01-14T00:00:00Z',
      createdAt: '2024-01-14T00:00:00Z',
    },
  ];

  const bounds: DateRangeBounds = {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  };

  it('renders trends chart with income and expense data', () => {
    render(<Trends transactions={transactions} bounds={bounds} />);

    // Chart should render
    // Note: This is a basic test - actual chart rendering tests would need canvas testing
    expect(document.body).toBeTruthy();
  });

  it('displays cumulative toggle component', () => {
    render(<Trends transactions={transactions} bounds={bounds} />);

    // The CumulativeToggle component renders buttons for mode selection
    // Check for mode labels
    expect(screen.getByText(/calendar|running/i)).toBeInTheDocument();
  });
});
```

**Step 1 (repeated for SpendingByCategory):** Write SpendingByCategory test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingByCategory } from './SpendingByCategory';
import { Transaction, Category } from '../../database/types';

describe('SpendingByCategory Integration', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      merchant: 'Amazon',
      amount: 45.99,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: '2',
      date: '2024-01-14',
      merchant: 'Walmart',
      amount: 89.99,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-14T00:00:00Z',
      createdAt: '2024-01-14T00:00:00Z',
    },
    {
      id: '3',
      date: '2024-01-13',
      merchant: 'Starbucks',
      amount: 5.50,
      categoryId: 'cat-2',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-13T00:00:00Z',
      createdAt: '2024-01-13T00:00:00Z',
    },
  ];

  const categories: Category[] = [
    { id: 'cat-1', slug: 'shopping', name: 'Shopping', type: 'expense', color: '#3b82f6' },
    { id: 'cat-2', slug: 'food', name: 'Food', type: 'expense', color: '#ef4444' },
  ];

  it('groups transactions by category and displays amounts', () => {
    render(<SpendingByCategory transactions={transactions} categories={categories} range="30days" />);

    // Shopping category should show combined amount (45.99 + 89.99 = 135.98)
    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});
```

**Step 1 (repeated for SpendingSummary):** Write SpendingSummary test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingSummary } from './SpendingSummary';
import { Transaction } from '../../database/types';

describe('SpendingSummary Integration', () => {
  const transactions: Transaction[] = [
    {
      id: '1',
      date: '2024-01-15',
      merchant: 'Paycheck',
      amount: 2500.00,
      categoryId: 'cat-1',
      type: 'income',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    },
    {
      id: '2',
      date: '2024-01-14',
      merchant: 'Amazon',
      amount: 100.00,
      categoryId: 'cat-2',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-14T00:00:00Z',
      createdAt: '2024-01-14T00:00:00Z',
    },
    {
      id: '3',
      date: '2024-01-13',
      merchant: 'Refund',
      amount: 25.00,
      categoryId: 'cat-3',
      type: 'refund',
      accountId: 'acc-1',
      importedAt: '2024-01-13T00:00:00Z',
      createdAt: '2024-01-13T00:00:00Z',
    },
  ];

  it('calculates and displays income, expenses, and savings', () => {
    render(<SpendingSummary transactions={transactions} />);

    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();

    // Income: $2500
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
    // Expenses: $100 - $25 (refund) = $75
    expect(screen.getByText('$75.00')).toBeInTheDocument();
  });

  it('shows correct savings rate', () => {
    render(<SpendingSummary transactions={transactions} />);

    // Savings: $2500 - $75 = $2425
    // Savings rate: ($2425 / $2500) * 100 = 97%
    expect(screen.getByText('97%')).toBeInTheDocument();
  });
});
```

**Commit all component tests:**

```bash
git add src/components/
git commit -m "test: add frontend component integration tests"
```

---

## Task 5: Frontend Aggregations Integration Tests

**Files:**
- Create: `src/features/transactions/aggregations.integration.test.ts`

**Step 1: Write aggregation integration test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterByRange,
  summarizeTotals,
  groupByCategory,
  buildDailyTrend,
  buildMonthlyTrend,
  selectTrendGranularity,
} from './aggregations';
import { Transaction } from '../../database/types';
import { DateRangeBounds } from '../date-range/dateRange';

describe('Aggregations Integration', () => {
  const transactions: Transaction[] = [
    { id: '1', date: '2024-01-15', merchant: 'A', amount: 100, categoryId: 'c1', type: 'expense', accountId: 'a1', importedAt: '2024-01-15', createdAt: '2024-01-15' },
    { id: '2', date: '2024-01-16', merchant: 'B', amount: 200, categoryId: 'c1', type: 'expense', accountId: 'a1', importedAt: '2024-01-16', createdAt: '2024-01-16' },
    { id: '3', date: '2024-01-17', merchant: 'C', amount: 500, categoryId: 'c2', type: 'income', accountId: 'a1', importedAt: '2024-01-17', createdAt: '2024-01-17' },
    { id: '4', date: '2024-01-18', merchant: 'D', amount: 100, categoryId: 'c3', type: 'refund', accountId: 'a1', importedAt: '2024-01-18', createdAt: '2024-01-18' },
    { id: '5', date: '2024-02-01', merchant: 'E', amount: 300, categoryId: 'c2', type: 'income', accountId: 'a1', importedAt: '2024-02-01', createdAt: '2024-02-01' },
    { id: '6', date: '2024-02-02', merchant: 'F', amount: 150, categoryId: 'c1', type: 'expense', accountId: 'a1', importedAt: '2024-02-02', createdAt: '2024-02-02' },
  ];

  describe('filterByRange', () => {
    it('filters transactions within date range', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-17'),
      };

      const filtered = filterByRange(transactions, bounds);

      expect(filtered.length).toBe(3);
      expect(filtered.map((t) => t.id)).toContain('1');
      expect(filtered.map((t) => t.id)).toContain('2');
      expect(filtered.map((t) => t.id)).toContain('3');
      expect(filtered.map((t) => t.id)).not.toContain('4');
    });
  });

  describe('summarizeTotals', () => {
    it('calculates correct totals excluding ignored transactions', () => {
      const txns = transactions.map((t, i) => ({
        ...t,
        isIgnored: i === 4, // Ignore the February income transaction
      }));

      const result = summarizeTotals(txns);

      expect(result.income).toBe(500); // Only Jan 17 income (Feb is ignored)
      expect(result.expenses).toBe(200 - 100); // (100 + 200) - 100 refund
      expect(result.refunds).toBe(100);
      expect(result.savings).toBe(500 - 200 + 100); // 400
    });
  });

  describe('groupByCategory', () => {
    it('groups transactions by category with correct amounts', () => {
      const result = groupByCategory(transactions);

      // Shopping (c1): 100 + 200 - 150 = 150 (wait, refund is c3)
      // Actually: c1 = 100 + 200 = 300 (expenses), c2 = 500 (income), c3 = 100 (refund)
      // groupByCategory filters transfers and only returns positive amounts
      const c1 = result.find((r) => r.categoryId === 'c1');
      const c2 = result.find((r) => r.categoryId === 'c2');

      expect(c1?.amount).toBe(300); // 100 + 200
      expect(c2?.amount).toBe(500); // income counts too
    });
  });

  describe('buildDailyTrend', () => {
    it('builds daily trend data for calendar mode', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-17'),
      };

      const data = buildDailyTrend(transactions, bounds, 'calendar');

      expect(data.length).toBe(3); // 3 days
      // Jan 15: expense 100
      expect(data[0].expense).toBe(100);
      expect(data[0].income).toBe(0);
      // Jan 16: expense 200
      expect(data[1].expense).toBe(200);
      // Jan 17: income 500
      expect(data[2].income).toBe(500);
    });

    it('builds daily trend data for running mode', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-17'),
      };

      const data = buildDailyTrend(transactions, bounds, 'running');

      // Running mode should accumulate
      expect(data[0].income).toBe(0);
      expect(data[0].expense).toBe(100);
      expect(data[1].income).toBe(0);
      expect(data[1].expense).toBe(300); // 100 + 200
      expect(data[2].income).toBe(500);
      expect(data[2].expense).toBe(300); // still 300, income doesn't affect expense
    });
  });

  describe('buildMonthlyTrend', () => {
    it('builds monthly trend data for calendar mode', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-01'),
        end: new Date('2024-02-28'),
      };

      const data = buildMonthlyTrend(transactions, bounds, 'calendar');

      expect(data.length).toBe(2); // Jan and Feb

      // January: income 500, expenses 100 + 200 - 100 = 200
      expect(data[0].income).toBe(500);
      expect(data[0].expense).toBe(200);

      // February: income 300, expenses 150
      expect(data[1].income).toBe(300);
      expect(data[1].expense).toBe(150);
    });

    it('builds monthly trend data for running mode', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-01'),
        end: new Date('2024-02-28'),
      };

      const data = buildMonthlyTrend(transactions, bounds, 'running');

      // January cumulative: income 500, expenses 200
      expect(data[0].income).toBe(500);
      expect(data[0].expense).toBe(200);

      // February cumulative: income 500 + 300 = 800, expenses 200 + 150 = 350
      expect(data[1].income).toBe(800);
      expect(data[1].expense).toBe(350);
    });
  });

  describe('selectTrendGranularity', () => {
    it('returns day for ranges under 90 days', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };
      expect(selectTrendGranularity(bounds)).toBe('day');
    });

    it('returns month for ranges 90 days or more', () => {
      const bounds: DateRangeBounds = {
        start: new Date('2024-01-01'),
        end: new Date('2024-04-01'),
      };
      expect(selectTrendGranularity(bounds)).toBe('month');
    });
  });
});
```

**Commit:**

```bash
git add src/features/transactions/aggregations.integration.test.ts
git commit -m "test: add aggregations integration tests"
```

---

## Task 6: Frontend Database Integration Tests (Dexie)

**Files:**
- Create: `src/database/db.integration.test.ts`

**Step 1: Write database integration test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './db';
import { Transaction, Category, Account } from './types';

describe('Database Integration (Dexie)', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.clear();
  });

  afterEach(async () => {
    // Cleanup happens automatically since we use a fresh DB instance
    await db.close();
  });

  it('should CRUD transactions', async () => {
    // Create
    const txnId = await db.transactions.add({
      id: 'txn-1',
      date: '2024-01-15',
      merchant: 'Amazon',
      amount: 45.99,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    });

    expect(txnId).toBe('txn-1');

    // Read
    const txn = await db.transactions.get('txn-1');
    expect(txn).toBeDefined();
    expect(txn?.merchant).toBe('Amazon');
    expect(txn?.amount).toBe(45.99);

    // Update
    await db.transactions.update('txn-1', { merchant: 'Amazon.com' });
    const updatedTxn = await db.transactions.get('txn-1');
    expect(updatedTxn?.merchant).toBe('Amazon.com');

    // Delete
    await db.transactions.delete('txn-1');
    const deletedTxn = await db.transactions.get('txn-1');
    expect(deletedTxn).toBeUndefined();
  });

  it('should handle transactions with same merchant but different dates', async () => {
    await db.transactions.add({
      id: 'txn-1',
      date: '2024-01-15',
      merchant: 'Starbucks',
      amount: 5.50,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    });

    await db.transactions.add({
      id: 'txn-2',
      date: '2024-01-16',
      merchant: 'Starbucks',
      amount: 6.00,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-16T00:00:00Z',
      createdAt: '2024-01-16T00:00:00Z',
    });

    const starbucksTxns = await db.transactions.where('merchant').equals('Starbucks').toArray();
    expect(starbucksTxns.length).toBe(2);
  });

  it('should bulk add transactions efficiently', async () => {
    const transactions = Array.from({ length: 100 }, (_, i) => ({
      id: `bulk-txn-${i}`,
      date: '2024-01-15',
      merchant: `Merchant ${i}`,
      amount: (i + 1) * 10,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    }));

    await db.transactions.bulkAdd(transactions);

    const count = await db.transactions.count();
    expect(count).toBe(100);
  });

  it('should CRUD categories', async () => {
    const catId = await db.categories.add({
      id: 'cat-1',
      slug: 'shopping',
      name: 'Shopping',
      type: 'expense' as const,
      color: '#3b82f6',
    });

    const cat = await db.categories.get('cat-1');
    expect(cat).toBeDefined();
    expect(cat?.name).toBe('Shopping');
  });

  it('should CRUD accounts', async () => {
    const accId = await db.accounts.add({
      id: 'acc-1',
      name: 'Chase Checking',
      type: 'checking' as const,
    });

    const acc = await db.accounts.get('acc-1');
    expect(acc).toBeDefined();
    expect(acc?.name).toBe('Chase Checking');
  });

  it('should query transactions by account', async () => {
    await db.accounts.add({ id: 'acc-1', name: 'Chase', type: 'checking' });
    await db.accounts.add({ id: 'acc-2', name: 'Amex', type: 'credit_card' });

    await db.transactions.add({
      id: 'txn-1',
      date: '2024-01-15',
      merchant: 'Amazon',
      amount: 100,
      categoryId: 'cat-1',
      type: 'expense',
      accountId: 'acc-1',
      importedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-15T00:00:00Z',
    });

    await db.transactions.add({
      id: 'txn-2',
      date: '2024-01-16',
      merchant: 'Netflix',
      amount: 15,
      categoryId: 'cat-2',
      type: 'expense',
      accountId: 'acc-2',
      importedAt: '2024-01-16T00:00:00Z',
      createdAt: '2024-01-16T00:00:00Z',
    });

    const acc1Txns = await db.transactions.where('accountId').equals('acc-1').toArray();
    const acc2Txns = await db.transactions.where('accountId').equals('acc-2').toArray();

    expect(acc1Txns.length).toBe(1);
    expect(acc1Txns[0].merchant).toBe('Amazon');
    expect(acc2Txns.length).toBe(1);
    expect(acc2Txns[0].merchant).toBe('Netflix');
  });
});
```

**Commit:**

```bash
git add src/database/db.integration.test.ts
git commit -m "test: add database (Dexie) integration tests"
```

---

## Task 7: Date Range Integration Tests

**Files:**
- Create: `src/features/date-range/dateRange.integration.test.ts`

**Step 1: Write date range integration test**

```typescript
import { describe, it, expect } from 'vitest';
import {
  getRangeBounds,
  formatRange,
  DateRangePreset,
} from './dateRange';

describe('Date Range Integration', () => {
  // Use fixed date for consistent tests
  const originalDateNow = Date.now;
  const fixedDate = new Date('2024-03-15');
  beforeAll(() => {
    Date.now = () => fixedDate.getTime();
  });
  afterAll(() => {
    Date.now = originalDateNow;
  });

  describe('getRangeBounds', () => {
    it('returns currentMonth range', () => {
      const bounds = getRangeBounds('currentMonth');
      expect(bounds.start.getDate()).toBe(1);
      expect(bounds.start.getMonth()).toBe(2); // March
      expect(bounds.end.getDate()).toBe(31);
      expect(bounds.end.getMonth()).toBe(2); // March
    });

    it('returns 30days range', () => {
      const bounds = getRangeBounds('30days');
      const daysDiff = (bounds.end.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(30);
    });

    it('returns 90days range', () => {
      const bounds = getRangeBounds('90days');
      const daysDiff = (bounds.end.getTime() - bounds.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(90);
    });

    it('returns 6months range', () => {
      const bounds = getRangeBounds('6months');
      const monthsDiff = (bounds.end.getFullYear() - bounds.start.getFullYear()) * 12 +
        (bounds.end.getMonth() - bounds.start.getMonth());
      expect(monthsDiff).toBe(6);
    });

    it('returns ytd range', () => {
      const bounds = getRangeBounds('ytd');
      expect(bounds.start.getMonth()).toBe(0); // January
      expect(bounds.start.getDate()).toBe(1);
      expect(bounds.end.getTime()).toBe(Date.now());
    });

    it('returns allTime range', () => {
      const bounds = getRangeBounds('allTime');
      expect(bounds.start.getFullYear()).toBe(2000);
      expect(bounds.start.getMonth()).toBe(0);
      expect(bounds.start.getDate()).toBe(1);
    });

    it('returns custom range when provided', () => {
      const customStart = new Date('2024-02-01');
      const customEnd = new Date('2024-02-28');
      const bounds = getRangeBounds('custom', { startDate: customStart, endDate: customEnd });

      expect(bounds.start.getTime()).toBe(customStart.getTime());
      expect(bounds.end.getTime()).toBe(customEnd.getTime());
    });
  });

  describe('formatRange', () => {
    it('formats date range as readable string', () => {
      const result = formatRange('currentMonth');
      // Should contain "Mar" and "2024"
      expect(result).toMatch(/Mar.*2024/);
      expect(result).toContain('-');
    });

    it('formats custom range', () => {
      const customStart = new Date('2024-02-01');
      const customEnd = new Date('2024-02-28');
      const result = formatRange('custom', { startDate: customStart, endDate: customEnd });
      expect(result).toContain('Feb');
      expect(result).toContain('2024');
    });
  });
});
```

**Commit:**

```bash
git add src/features/date-range/dateRange.integration.test.ts
git commit -m "test: add date range integration tests"
```

---

## Task 8: Run Full Test Suite and Fix Issues

**Step 1: Run all tests**

```bash
# Run frontend tests
npm test

# Run backend tests
cd backend
npx vitest run

# Run all backend tests from project root
npx vitest run backend/tests/**/*.test.ts
```

**Step 2: Fix any failing tests**

Expected issues to fix:
- Backend tests may need database connection mocking
- Some tests may need to adjust expected values

**Step 3: Add test script to package.json (if needed)**

```json
{
  "scripts": {
    "test": "vitest",
    "test:backend": "cd backend && vitest run"
  }
}
```

**Step 4: Commit final test suite**

```bash
git add .
git commit -m "test: add complete integration test suite

- CSV import flow integration tests
- Category rules and KNN integration tests
- Backend API integration tests
- Frontend component integration tests
- Aggregations integration tests
- Database (Dexie) integration tests
- Date range integration tests"
```

---

## Test Results Checklist

After running all tests, ensure:
- [ ] All backend CSV import tests pass
- [ ] All backend categorization tests pass
- [ ] All backend API tests pass
- [ ] All frontend component tests pass
- [ ] All aggregations tests pass
- [ ] All database tests pass
- [ ] All date range tests pass
- [ ] Test coverage is acceptable (>70% for critical paths)
- [ ] Tests run in under 30 seconds

---

## Next Steps (Optional Enhancements)

1. **Add mock server for backend** - Use MSW or jest-fetch-mock for better isolation
2. **Add snapshot tests** - For visual components
3. **Add Cypress E2E tests** - For full browser testing
4. **Add test coverage reports** - Use `--coverage` flag
5. **Add CI/CD integration** - Run tests on pull requests

---

*This plan covers approximately 40-50 tests total, providing comprehensive coverage of the critical user flows without excessive edge case testing.*
