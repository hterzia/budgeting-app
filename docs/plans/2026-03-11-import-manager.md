# Import Manager Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated Import Manager page (`/imports`) that allows users to view all import batches, see their processing status, view associated transactions, and delete imports permanently.

**Architecture:**
- Add new backend endpoints for listing imports, getting transactions by import, and deleting imports
- Create React component for the Import Manager page with import form, summary stats, and collapsible import list
- Follow existing patterns for import functionality in the codebase

**Tech Stack:** React, TypeScript, Express.js, PostgreSQL

---

## Task 1: Add new backend endpoints for import management

**Files:**
- Create: `backend/migrations/0020_add_import_batch_account_id.sql` - Add `account_id` column to `import_batches`
- Create: `backend/migrations/0020_add_import_batch_account_id_rollback.sql` - Rollback migration
- Modify: `backend/src/db/queries.ts:6-16` - Update `createImportBatch` to include `accountId` parameter
- Modify: `backend/src/routes/imports.ts:102` - Pass `accountId` when creating import batch

**Step 1: Create migration to add account_id column**

```sql
-- backend/migrations/0020_add_import_batch_account_id.sql
ALTER TABLE import_batches
ADD COLUMN account_id UUID REFERENCES accounts(id);

CREATE INDEX ON import_batches (account_id);
```

**Step 2: Create rollback migration**

```sql
-- backend/migrations/0020_add_import_batch_account_id_rollback.sql
ALTER TABLE import_batches
DROP COLUMN IF EXISTS account_id;

DROP INDEX IF EXISTS import_batches_account_id_idx;
```

**Step 3: Update createImportBatch function**

```typescript
export async function createImportBatch(
  pool: Pool,
  id: string,
  userId: string,
  totalRows: number,
  accountId?: string | null  // NEW
): Promise<void> {
  await pool.query(
    `INSERT INTO import_batches (id, user_id, status, total_rows, embedded_rows, auto_categorized_rows, needs_review_rows, account_id)
     VALUES ($1, $2, 'uploaded', $3, 0, 0, 0, $4)`,
    [id, userId, totalRows, accountId || null]
  );
}
```

**Step 4: Update route to pass accountId**

```typescript
await createImportBatch(pool, importId, userId, rows.length, accountId || null);
```

**Step 5: Run migration**

```bash
cd backend
npm run migration:up
```

---

## Task 2: Add frontend API functions for import management

**Files:**
- Modify: `frontend/src/features/import/api.ts`

**Step 1: Add new API functions**

Add these functions after `getCategories`:

```typescript
export async function getImports(): Promise<{ imports: ImportStatus[]; totalCount: number }> {
  const response = await fetch(`${BACKEND_URL}/imports`);
  if (!response.ok) throw new Error('Failed to fetch imports');
  return response.json();
}

export async function getImportTransactions(importId: string, limit: number = 50, offset: number = 0): Promise<{ transactions: any[]; totalCount: number }> {
  const response = await fetch(`${BACKEND_URL}/imports/${importId}/transactions?limit=${limit}&offset=${offset}`);
  if (!response.ok) throw new Error('Failed to fetch import transactions');
  return response.json();
}

export async function deleteImport(importId: string): Promise<{ status: string; importId: string }> {
  const response = await fetch(`${BACKEND_URL}/imports/${importId}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete import');
  }
  return response.json();
}
```

**Step 2: Run type-check to verify**

```bash
npm run type-check
```
Expected: No errors

---

## Task 3: Create the ImportManager React component

**Files:**
- Create: `frontend/src/features/import/ImportManager.tsx`

**Step 1: Create the main component**

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../../app/providers/BudgetProvider';
import { useToast } from '../../shared/ui';
import {
  getImports,
  deleteImport,
  ImportStatus,
} from './api';
import { formatCurrency } from '../../utils/format';

interface ImportStats {
  totalImports: number;
  totalTransactions: number;
  importsNeedingReview: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    uploaded: 'bg-gray-500',
    parsing: 'bg-blue-500',
    embedding: 'bg-indigo-500',
    categorizing: 'bg-purple-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    parsing: 'Parsing',
    embedding: 'Embedding',
    categorizing: 'Categorizing',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status] || status;
}

export function ImportManager() {
  const toast = useToast();
  const { accounts, refresh } = useBudget();
  const [imports, setImports] = useState<ImportStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [showImportForm, setShowImportForm] = useState(false);

  const stats = useMemo<ImportStats>(() => {
    return imports.reduce(
      (acc, imp) => {
        acc.totalImports += 1;
        acc.totalTransactions += imp.totalRows;
        if (imp.needsReviewRows > 0) acc.importsNeedingReview += 1;
        return acc;
      },
      { totalImports: 0, totalTransactions: 0, importsNeedingReview: 0 }
    );
  }, [imports]);

  useEffect(() => {
    fetchImports();
  }, []);

  const fetchImports = async () => {
    try {
      const data = await getImports();
      setImports(data.imports);
    } catch (err: any) {
      toast.push('Failed to load imports', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (importId: string) => {
    if (transactions[importId]) return;

    try {
      const data = await import('./api').then((m) => m.getImportTransactions(importId, 50, 0));
      setTransactions((prev) => ({ ...prev, [importId]: data.transactions }));
    } catch (err: any) {
      toast.push('Failed to load transactions', 'error');
    }
  };

  const handleDelete = async (importId: string) => {
    if (!window.confirm('This will permanently delete this import and all its transactions. Continue?')) {
      return;
    }

    setDeletingId(importId);
    try {
      await deleteImport(importId);
      toast.push('Import deleted successfully', 'success');
      await refresh();
      setImports((prev) => prev.filter((i) => i.id !== importId));
      setExpandedImportId(null);
    } catch (err: any) {
      toast.push('Failed to delete import', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (importId: string) => {
    if (expandedImportId === importId) {
      setExpandedImportId(null);
    } else {
      setExpandedImportId(importId);
      fetchTransactions(importId);
    }
  };

  const getAccountName = (accountId: string | null): string => {
    if (!accountId) return 'Unknown';
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Imports</h1>
        <p className="text-gray-500 mt-1">View and manage your CSV imports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Total Imports</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.totalImports}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Total Transactions</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.totalTransactions}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500">Needs Review</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.importsNeedingReview}</div>
        </div>
      </div>

      {/* Import Form Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowImportForm(!showImportForm)}
          className="w-full px-4 py-3 text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
        >
          <span>+ Import New CSV</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showImportForm ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showImportForm && (
          <div className="border-t border-gray-200 p-4">
            <ImportCSVForm accounts={accounts} onClose={() => setShowImportForm(false)} />
          </div>
        )}
      </div>

      {/* Imports List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Import History</h2>
        </div>

        {imports.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2">No imports yet. Upload a CSV to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {imports.map((imp) => (
              <div key={imp.id} className="hover:bg-gray-50 transition-colors">
                {/* Summary Row */}
                <div
                  className="px-6 py-4 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(imp.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(imp.status)}`}></div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900">
                          Import #{imp.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(imp.createdAt)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            imp.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : imp.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getStatusLabel(imp.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {imp.totalRows.toLocaleString()} rows |
                        {imp.embeddedRows.toLocaleString()} embedded |
                        {imp.autoCategorizedRows.toLocaleString()} auto-categorized |
                        {imp.needsReviewRows.toLocaleString()} needs review
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        Account: {getAccountName(imp.accountId || null)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(imp.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${expandedImportId === imp.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(imp.id);
                      }}
                      disabled={deletingId === imp.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      {deletingId === imp.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedImportId === imp.id && transactions[imp.id] && (
                  <div className="px-6 pb-4 border-t border-gray-200">
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Transactions</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transactions[imp.id].slice(0, 10).map((tx: any) => (
                              <tr key={tx.id}>
                                <td className="px-3 py-2 text-sm text-gray-500">{tx.posted_at}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{tx.merchant_clean || '-'}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  {formatCurrency(tx.amount_cents / 100, tx.currency)}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">
                                  {tx.category_id ? 'Categorized' : 'Uncategorized'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">
                                  {tx.category_source || 'unknown'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {transactions[imp.id].length > 10 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Showing 10 of {transactions[imp.id].length} transactions
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline ImportCSVForm component for the manager page
function ImportCSVForm({ accounts, onClose }: { accounts: any[]; onClose: () => void }) {
  const toast = useToast();
  const { refresh } = useBudget();

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invertAmountSign, setInvertAmountSign] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const processFile = (f: File) => {
    setFile(f);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith('.csv')) {
      processFile(f);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedAccount) return;
    setImporting(true);
    setError(null);

    try {
      const { uploadCSV, triggerProcess } = await import('./api');
      const response = await uploadCSV(
        file,
        '00000000-0000-0000-0000-000000000000',
        String(selectedAccount.id),
        invertAmountSign,
      );

      try {
        await triggerProcess(response.importId);
      } catch {
        // Processing might fail if vLLM not available
      }

      toast.push(`Imported ${response.totalRows} transactions`, 'success');
      await refresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed. Please try again.');
      toast.push('Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 shadow-sm text-sm py-2 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          {accounts.map((acct) => (
            <option key={acct.id} value={acct.id}>
              {acct.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div
          onClick={() => document.getElementById('file-input')?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <svg className="mx-auto w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-500">
            Drop your CSV here or <span className="text-blue-600 font-medium">browse</span>
          </p>
          <input
            id="file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {file && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{file.name}</span>
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={invertAmountSign}
            onChange={(e) => setInvertAmountSign(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Invert amount sign (treat positive as expense and negative as income/refund)</span>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || importing}
          className="bg-blue-600 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create the entry point**

Create `frontend/src/features/import/ImportManagerPage.tsx`:

```typescript
import React from 'react';
import { ImportManager } from './ImportManager';

export function ImportManagerPage() {
  return <ImportManager />;
}
```

**Step 3: Add route in App.tsx**

Modify `frontend/src/App.tsx` to add the import route:

```typescript
import { ImportManagerPage } from './features/import/ImportManagerPage';

// In the App component, add:
<Route path="/imports" element={<ImportManagerPage />} />
```

**Step 4: Add navigation link**

Modify `frontend/src/app/Layout.tsx` to add the imports link in the navigation.

---

## Task 4: Add types for import management

**Files:**
- Modify: `frontend/src/features/import/api.ts`

**Step 1: Add ImportStatusWithAccount type**

Update the `ImportStatus` interface to include `accountId`:

```typescript
export interface ImportStatus {
  id: string;
  userId: string;
  status: string;
  totalRows: number;
  embeddedRows: number;
  autoCategorizedRows: number;
  needsReviewRows: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  accountId?: string | null;  // NEW
}
```

---

## Task 5: Add missing field to import status response

**Files:**
- Modify: `backend/src/routes/imports.ts:229-240`

**Step 1: Update the GET /imports/:id response to include accountId**

```typescript
res.json({
  id: batch.id,
  userId: batch.user_id,
  status: batch.status,
  totalRows: batch.total_rows,
  embeddedRows: batch.embedded_rows_live ?? 0,
  autoCategorizedRows: batch.auto_categorized_rows_live ?? 0,
  needsReviewRows: batch.needs_review_rows_live ?? 0,
  errorMessage: batch.error_message,
  createdAt: batch.created_at,
  completedAt: batch.completed_at,
  accountId: batch.account_id,  // NEW
});
```

---

## Task 6: Add ImportManagerPage to registry for routes

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Import and add route**

```typescript
import { ImportManagerPage } from './features/import/ImportManagerPage';

// In the Routes:
<Route path="/imports" element={<ImportManagerPage />} />
```

---

## Task 7: Test the complete flow

**Files:**
- Manual testing

**Step 1: Start the application**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm run dev
```

**Step 2: Navigate to /imports and verify**

- [ ] Page loads without errors
- [ ] Stats cards show correct data
- [ ] Import form works (upload a test CSV)
- [ ] Import list displays recent imports
- [ ] Clicking expand shows transactions
- [ ] Delete confirmation appears
- [ ] Deleting removes import from list

**Step 3: Verify backend endpoints**

```bash
curl -s http://localhost:3001/imports | jq .
curl -s http://localhost:3001/imports/<import-id> | jq .
curl -s http://localhost:3001/imports/<import-id>/transactions | jq .
```

---

## Task 8: Final review and cleanup

**Files:**
- Code review

**Step 1: Run type-check**

```bash
npm run type-check
```

Expected: No errors

**Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 3: Code review checklist**

- [ ] No console.log statements in production code
- [ ] Proper error handling on all API calls
- [ ] Loading states for async operations
- [ ] Confirmation dialog before destructive action
- [ ] Responsive layout (mobile-friendly)
