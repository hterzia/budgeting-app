# Consolidate CSV Parsing to Backend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove duplicate CSV parsing logic from frontend and centralize all parsing in backend for consistency and maintainability

**Architecture:**
- Backend already has `backend/src/utils/csv.ts` with templates and parsing utilities
- Frontend has `src/parsers/csvParser.ts` with duplicate logic
- Move all CSV parsing to backend, frontend only handles file upload and displays results

**Tech Stack:**
- TypeScript, Node.js, Express (backend)
- React, PapaParse (frontend)
- PostgreSQL with pgvector

---

## Task 1: Audit current CSV parsing differences

**Files:**
- `src/parsers/csvParser.ts` (frontend)
- `backend/src/utils/csv.ts` (backend)

**Step 1: Compare both files**

Read both files and document all differences in:
- Template definitions
- Field extraction logic
- Date normalization
- Amount parsing
- Transaction classification

**Step 2: Identify minimal backend API surface**

Define what the frontend needs from backend:
- Upload CSV string
- Get parsed transactions with proper types
- Get detected template name

**Step 3: Commit findings**

```bash
git add docs/csv-parsing-differences.md
git commit -m "docs: audit CSV parsing differences"
```

---

## Task 2: Update backend import route

**Files:**
- Modify: `backend/src/routes/imports.ts`

**Step 1: Update the import route to use csv.ts utilities**

Current route has duplicate field extraction. Replace with:
- Detect template from headers
- Use template's column names and date patterns
- Parse amounts via `parseAmount()`
- Normalize dates via `normalizeDate()`

**Step 2: Fix case-sensitive field lookup**

The `getField()` function needs case-insensitive matching when using templates:
- When template found: use `template.dateColumn` directly
- When no template: try both upper and lowercase variants

**Step 3: Test with sample CSVs**

```bash
# Test with lowercase headers (Standard CSV)
curl -X POST http://localhost:3001/imports \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","file":"date,description,amount,type\n2026-03-01,Netflix Subscription,-15.99,expense"}'

# Test with capitalized headers (Chase format)
curl -X POST http://localhost:3001/imports \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","file":"Transaction Date,Description,Type,Amount\n03/01/2026,Netflix Subscription,PURCHASE,-15.99"}'
```

**Expected:** Both formats parsed correctly, dates normalized to YYYY-MM-DD, amounts in cents

**Step 4: Commit backend changes**

```bash
git add backend/src/routes/imports.ts
git commit -m "feat: use csv.ts utilities for proper field extraction"
```

---

## Task 3: Add regression tests for backend parsing

**Files:**
- Create: `backend/src/routes/imports.test.ts`

**Step 1: Write tests for different template formats**

```typescript
describe('CSV Import Route', () => {
  test('parses lowercase headers (Standard CSV)', async () => { /* ... */ });
  test('parses capitalized headers (Chase format)', async () => { /* ... */ });
  test('normalizes MM/DD/YYYY dates to YYYY-MM-DD', async () => { /* ... */ });
  test('handles negative amounts correctly', async () => { /* ... */ });
});
```

**Step 2: Run tests**

```bash
npm test -- backend/src/routes/imports.test.ts
```

**Step 3: Commit tests**

```bash
git add backend/src/routes/imports.test.ts
git commit -m "test: add CSV parsing regression tests"
```

---

## Task 4: Simplify frontend to use backend for parsing

**Files:**
- Modify: `src/parsers/csvParser.ts`

**Step 1: Keep only template definitions in frontend**

The frontend needs templates for UI hints (what format each bank uses). Keep:
- `bankTemplates` array with display names
- `detectTemplate()` function for UI feedback

**Step 2: Remove parsing logic from frontend**

Remove:
- `normalizeDate()` - backend handles this
- `parseAmount()` - backend handles this
- `classifyTransaction()` - backend handles this
- `getField()` helper - backend handles this

**Step 3: Update frontend to send raw CSV to backend**

```typescript
// Before: parseCSV(file, accountType, accountId)
// After: uploadCSV(csvString, accountId)

async function uploadCSV(csvContent: string, accountId: string) {
  const response = await fetch('/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      file: csvContent,
      accountId
    })
  });
  return response.json();
}
```

**Step 4: Update frontend to use parsed results from backend**

Backend returns `totalRows` and `template` name in response. Use this for UI feedback.

**Step 5: Commit frontend changes**

```bash
git add src/parsers/csvParser.ts src/features/.../Upload.tsx
git commit -m "refactor: remove duplicate CSV parsing, use backend"
```

---

## Task 5: Update documentation

**Files:**
- Modify: `docs/category-feature-status.md` or create new doc

**Step 1: Document CSV parsing flow**

````markdown
## CSV Import

### Flow
1. User selects CSV file in frontend
2. Frontend sends CSV content to `/imports` endpoint
3. Backend detects template and parses using `backend/src/utils/csv.ts`
4. Transactions stored in `transactions` table with `category_source='unknown'`
5. User reviews and categorizes via `/imports/:id/review-queue`

### Template Support
- Chase Credit Card (Transaction Date, Description, Type, Amount)
- Chase Checking (Posting Date, Description, Type, Amount)
- Amex Credit Card (Date, Description, Amount)
- Bank of America (Posted Date, Payee, Amount)
- Revolut (Start date, Description, Amount, Type)
- Wells Fargo (Date, Message, Amount, Type)
- Standard CSV (date, merchant, amount, type)
````

**Step 2: Document backend CSV utilities**

Add JSDoc comments to `backend/src/utils/csv.ts`

**Step 3: Commit docs**

```bash
git add docs/*.md
git commit -m "docs: document CSV parsing architecture"
```

---

## Task 6: Final verification

**Files:**
- All CSV parsing related code

**Step 1: Test end-to-end**

```bash
# Start server
npm run dev

# Import CSV
curl -X POST http://localhost:3001/imports \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","file":"date,description,amount,type\n2026-03-01,Netflix Subscription,-15.99,expense\n2026-03-02,Salary Deposit,5000.00,income"}'
```

**Step 2: Verify database**

```sql
SELECT id, merchant_clean, amount_cents, posted_at, category_source
FROM transactions
ORDER BY id DESC LIMIT 5;
```

**Expected:**
- Merchant cleaned properly (e.g., "Netflix Subscription")
- Amounts in cents (1599, 500000)
- Dates normalized to YYYY-MM-DD
- category_source = 'unknown', needs_review = true

**Step 3: Final commit**

```bash
git add .
git commit -m "refactor: consolidate CSV parsing to backend"
```

---

Plan complete and saved to `docs/plans/2026-03-05-consolidate-csv-parsing.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
