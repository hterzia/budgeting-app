# Multi-Account Import & Transfer Detection Plan

> **⚠️ Historical Plan:** This plan was written before the app migrated to a backend API architecture. References to Dexie, IndexedDB, and `BudgetDB` are no longer applicable — the app now uses an Express + PostgreSQL backend with no browser-side database.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support importing both checking/savings and credit card statements without double-counting. Auto-detect transfers (CC payments) and refunds so they don't inflate income/expense totals.

**Problem:** The app currently treats all transactions as either `income` or `expense`. This causes issues when importing multiple account types:

- **Credit card payments from checking** appear as expenses, but the CC statement already has the itemized purchases — double-counting.
- **Credit card payments received on CC** appear as income, but it's just money moving between your own accounts.
- **Credit card refunds** appear as income, but they should reduce expenses in that category.

**Solution:** Add account types, expand transaction types to include `transfer` and `refund`, and auto-detect these during import using merchant keyword matching.

**Decisions:**

- Account type is **user-selected** at import time (dropdown selector)
- Transfer detection is **keyword-based** on merchant name
- Refunds are **negative expenses** — they reduce spending in their category
- Transfers are **fully excluded** from all income/expense/savings calculations
- No cross-account linking for now — transfers are simply excluded, not matched between accounts

---

## Phase 1: Data Model Changes

### Task 1: Add Account type and expand Transaction types

**Files:**

- Edit: `src/database/types.ts`

**Step 1: Add AccountType, Account interface, expand TransactionType**

```typescript
export type AccountType = "checking" | "savings" | "credit_card";
export type TransactionType = "income" | "expense" | "transfer" | "refund";
export type CategoryType = "income" | "expense";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  merchant: string;
  amount: number;
  categoryId: string;
  type: TransactionType;
  accountId: string;
  importedAt: string;
  isDeduplicated?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: string;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM
  categoryId: string;
  limit: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}
```

**Verify:** `npm run build` — expect type errors in downstream files (expected, will fix in later tasks).

---

### Task 2: Update Dexie schema for accounts table

**Files:**

- Edit: `src/database/db.ts`

**Step 1: Add accounts table, add accountId index to transactions, bump to version 2**

```typescript
import Dexie, { Table } from "dexie";
import { Transaction, Category, Budget, SavingsGoal, Account } from "./types";

export class BudgetDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  accounts!: Table<Account, string>;

  constructor() {
    super("BudgetDB");

    this.version(1).stores({
      transactions:
        "++id, date, merchant, amount, categoryId, type, importedAt",
      categories: "++id, name, type, color",
      budgets: "++id, month, categoryId",
      savingsGoals: "++id, name",
    });

    this.version(2).stores({
      transactions:
        "++id, date, merchant, amount, categoryId, type, accountId, importedAt",
      categories: "++id, name, type, color",
      budgets: "++id, month, categoryId",
      savingsGoals: "++id, name",
      accounts: "++id, name, type",
    });
  }
}

export const db = new BudgetDB();
```

**Verify:** No runtime errors — Dexie handles schema upgrades automatically.

---

### Task 3: Add seed accounts

**Files:**

- Edit: `src/database/seed.ts`

**Step 1: Add initial accounts and seedInitialAccounts function**

```typescript
import { db } from "./db";
import { Category, Account } from "./types";

export const initialCategories: Category[] = [
  { id: "1", name: "Housing", type: "expense", color: "#3b82f6" },
  { id: "2", name: "Groceries", type: "expense", color: "#10b981" },
  { id: "3", name: "Dining Out", type: "expense", color: "#f59e0b" },
  { id: "4", name: "Transportation", type: "expense", color: "#8b5cf6" },
  { id: "5", name: "Utilities", type: "expense", color: "#ef4444" },
  { id: "6", name: "Entertainment", type: "expense", color: "#ec4899" },
  { id: "7", name: "Healthcare", type: "expense", color: "#6366f1" },
  { id: "8", name: "Shopping", type: "expense", color: "#14b8a6" },
  { id: "9", name: "Income", type: "income", color: "#22c55e" },
  { id: "10", name: "Investments", type: "income", color: "#a855f7" },
];

export const initialAccounts: Account[] = [
  { id: "acct-checking", name: "Checking", type: "checking" },
  { id: "acct-savings", name: "Savings", type: "savings" },
  { id: "acct-credit-card", name: "Credit Card", type: "credit_card" },
];

export async function seedInitialCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(initialCategories);
  }
}

export async function seedInitialAccounts() {
  const count = await db.accounts.count();
  if (count === 0) {
    await db.accounts.bulkAdd(initialAccounts);
  }
}
```

---

### Task 4: Update database exports

**Files:**

- Edit: `src/database/index.ts`

**Step 1: Export new Account type and seedInitialAccounts**

```typescript
export { db } from "./db";
export * from "./types";
export * from "./seed";
```

No change needed — the wildcard re-exports will pick up the new types and seed function automatically.

**Verify:** Confirm `Account`, `AccountType`, `seedInitialAccounts` are accessible via `'../database'` imports.

---

## Phase 2: Smart Transaction Classification

### Task 5: Create transfer and refund detection logic

**Files:**

- Edit: `src/parsers/csvParser.ts`

**Step 1: Add keyword lists and classifyTransaction function**

Add above the existing `parseCSV` function:

```typescript
import { AccountType, TransactionType } from "../database/types";

// Keywords that indicate a credit card payment (transfer between own accounts)
const TRANSFER_KEYWORDS_CHECKING = [
  "credit card",
  "card payment",
  "cc payment",
  "chase",
  "capital one",
  "amex",
  "american express",
  "citi",
  "discover",
  "wells fargo",
  "bank of america",
  "barclays",
  "synchrony",
  "apple card",
];

// Keywords on CC statements that indicate a payment received (transfer)
const TRANSFER_KEYWORDS_CREDIT_CARD = [
  "payment",
  "autopay",
  "auto pay",
  "thank you",
  "payment received",
  "online payment",
  "ach payment",
  "mobile payment",
];

// Keywords on CC statements that indicate a refund
const REFUND_KEYWORDS = [
  "refund",
  "return",
  "credit",
  "reversal",
  "adjustment",
  "dispute",
  "chargeback",
];

export function classifyTransaction(
  merchant: string,
  amount: number,
  accountType: AccountType,
): TransactionType {
  const lower = merchant.toLowerCase();

  if (accountType === "credit_card") {
    // On a CC statement, positive amounts are payments or refunds (money coming in)
    // Negative amounts (or charges) are expenses
    if (amount > 0 || lower.match(/payment|autopay|thank you/)) {
      // Check if it's a refund first (more specific)
      if (REFUND_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "refund";
      }
      // Otherwise it's a payment to the CC (transfer)
      if (TRANSFER_KEYWORDS_CREDIT_CARD.some((kw) => lower.includes(kw))) {
        return "transfer";
      }
      // Positive amount with no keyword match — likely a refund or credit
      if (amount > 0) {
        return "refund";
      }
    }
    return "expense";
  }

  if (accountType === "checking" || accountType === "savings") {
    // Negative amounts are outflows
    if (amount < 0) {
      // Check if it's a CC payment (transfer)
      if (TRANSFER_KEYWORDS_CHECKING.some((kw) => lower.includes(kw))) {
        return "transfer";
      }
      return "expense";
    }
    // Positive amounts are inflows (income)
    return "income";
  }

  // Fallback
  return amount < 0 ? "expense" : "income";
}
```

**Step 2: Update parseCSV to accept accountType and accountId**

```typescript
export function parseCSV(
  file: File,
  accountType: AccountType,
  accountId: string,
): Promise<{ transactions: any[]; template: BankTemplate | null }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const template = detectTemplate(results.meta.fields || []);
        const transactions = results.data
          .filter(
            (row: any) =>
              row && Object.values(row).some((v: any) => v && String(v).trim()),
          )
          .map((row: any, index: number) => {
            const rawAmount = parseFloat(row.amount || row["Amount"] || "0");
            const absAmount = Math.abs(rawAmount);
            const type = classifyTransaction(
              row.description ||
                row["Description"] ||
                row.message ||
                row["Message"] ||
                "",
              rawAmount,
              accountType,
            );

            return {
              id: `txn-${Date.now()}-${index}`,
              date:
                row.date ||
                row["Transaction Date"] ||
                row["Start date"] ||
                row["Date"],
              merchant:
                row.description ||
                row["Description"] ||
                row.message ||
                row["Message"] ||
                "",
              amount: absAmount,
              type,
              categoryId: "1",
              accountId,
              importedAt: new Date().toISOString(),
            };
          });

        resolve({ transactions, template });
      },
      error: (error: Error) => reject(error),
    });
  });
}
```

**Verify:** Parser correctly classifies:

- Checking: negative "CHASE CREDIT CARD" → `transfer`
- Checking: negative "WALMART" → `expense`
- Checking: positive "PAYROLL" → `income`
- CC: "PAYMENT THANK YOU" → `transfer`
- CC: "REFUND - AMAZON" → `refund`
- CC: negative "STARBUCKS" → `expense`

---

### Task 6: Update parser exports

**Files:**

- Edit: `src/parsers/index.ts`

**Step 1: Export classifyTransaction**

```typescript
import { parseCSV, BankTemplate, classifyTransaction } from "./csvParser";

export { parseCSV, classifyTransaction };
export type { BankTemplate };
```

---

## Phase 3: Import UI Changes

### Task 7: Update ImportCSV component with account selector

**Files:**

- Edit: `src/components/ImportCSV/ImportCSV.tsx`

**Step 1: Add account type dropdown and classification preview**

```typescript
import React, { useState, useEffect } from 'react';
import { parseCSV, BankTemplate } from '../../parsers/csvParser';
import { db } from '../../database/db';
import { seedInitialCategories, seedInitialAccounts } from '../../database/seed';
import { Account, AccountType } from '../../database/types';

export function ImportCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<BankTemplate | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [preview, setPreview] = useState<{
    total: number;
    expenses: number;
    income: number;
    transfers: number;
    refunds: number;
  } | null>(null);

  useEffect(() => {
    const loadAccounts = async () => {
      await seedInitialAccounts();
      const accts = await db.accounts.toArray();
      setAccounts(accts);
      if (accts.length > 0) setSelectedAccountId(accts[0].id);
    };
    loadAccounts();
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !selectedAccount) return;

    setFile(selectedFile);
    setTemplate(null);
    setError(null);
    setPreview(null);

    // Parse to generate preview
    try {
      const result = await parseCSV(selectedFile, selectedAccount.type, selectedAccount.id);
      setTemplate(result.template);

      const counts = { total: 0, expenses: 0, income: 0, transfers: 0, refunds: 0 };
      result.transactions.forEach((txn: any) => {
        counts.total++;
        if (txn.type === 'expense') counts.expenses++;
        else if (txn.type === 'income') counts.income++;
        else if (txn.type === 'transfer') counts.transfers++;
        else if (txn.type === 'refund') counts.refunds++;
      });
      setPreview(counts);
    } catch (err) {
      setError('Failed to preview CSV file');
    }
  };

  const handleAccountChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAccountId(e.target.value);
    // Re-parse if file already selected
    if (file) {
      const acct = accounts.find(a => a.id === e.target.value);
      if (acct) {
        try {
          const result = await parseCSV(file, acct.type, acct.id);
          const counts = { total: 0, expenses: 0, income: 0, transfers: 0, refunds: 0 };
          result.transactions.forEach((txn: any) => {
            counts.total++;
            if (txn.type === 'expense') counts.expenses++;
            else if (txn.type === 'income') counts.income++;
            else if (txn.type === 'transfer') counts.transfers++;
            else if (txn.type === 'refund') counts.refunds++;
          });
          setPreview(counts);
        } catch (err) {
          setError('Failed to re-parse CSV file');
        }
      }
    }
  };

  const handleImport = async () => {
    if (!file || !selectedAccount) return;

    setImporting(true);
    setError(null);

    try {
      await seedInitialCategories();
      const result = await parseCSV(file, selectedAccount.type, selectedAccount.id);

      const categorizedTransactions = result.transactions.map((txn: any) => ({
        ...txn,
        categoryId: categorizeTransaction(txn.merchant),
      }));

      await db.transactions.bulkAdd(categorizedTransactions);
      alert(`Successfully imported ${categorizedTransactions.length} transactions`);
      setFile(null);
      setTemplate(null);
      setPreview(null);
    } catch (err) {
      setError('Failed to import CSV file');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const categorizeTransaction = (merchant: string): string => {
    const lower = merchant.toLowerCase();
    if (lower.includes('grocery') || lower.includes('starbucks') || lower.includes('walmart')) return '2';
    if (lower.includes('uber') || lower.includes('lyft') || lower.includes('gas')) return '4';
    if (lower.includes('rent') || lower.includes('mortgage') || lower.includes('apartment')) return '1';
    return '1';
  };

  const accountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'checking': return 'Checking';
      case 'savings': return 'Savings';
      case 'credit_card': return 'Credit Card';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Import Bank Statement</h2>

      {/* Account Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
        <select
          value={selectedAccountId}
          onChange={handleAccountChange}
          className="block w-full rounded border-gray-300 shadow-sm text-sm py-2 px-3 border focus:border-blue-500 focus:ring-blue-500"
        >
          {accounts.map(acct => (
            <option key={acct.id} value={acct.id}>
              {acct.name} ({accountTypeLabel(acct.type)})
            </option>
          ))}
        </select>
      </div>

      {/* File Input */}
      <div className="mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {file.name}
            {template && ` | Detected: ${template.name}`}
          </p>
        )}
      </div>

      {/* Classification Preview */}
      {preview && (
        <div className="mb-4 p-3 bg-gray-50 rounded text-sm space-y-1">
          <p className="font-medium text-gray-700">Preview: {preview.total} transactions detected</p>
          <div className="flex flex-wrap gap-3 mt-1">
            {preview.expenses > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-medium">
                {preview.expenses} expenses
              </span>
            )}
            {preview.income > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                {preview.income} income
              </span>
            )}
            {preview.transfers > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-medium">
                {preview.transfers} transfers (excluded from totals)
              </span>
            )}
            {preview.refunds > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                {preview.refunds} refunds (reduce expenses)
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!file || importing || !selectedAccountId}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-300"
      >
        {importing ? 'Importing...' : 'Import CSV'}
      </button>
    </div>
  );
}
```

---

## Phase 4: Fix Calculations & Visuals

### Task 8: Update SpendingSummary to exclude transfers and handle refunds

**Files:**

- Edit: `src/components/SpendingSummary/SpendingSummary.tsx`

**Step 1: Modify income/expense calculations**

Replace the income/expense/savings calculation block with:

```typescript
const income = filteredTransactions
  .filter((t) => t.type === "income")
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);

const expenses = filteredTransactions
  .filter((t) => t.type === "expense")
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);

const refunds = filteredTransactions
  .filter((t) => t.type === "refund")
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);

// Refunds reduce the expense total. Transfers are excluded entirely.
const netExpenses = expenses - refunds;
const savings = income - netExpenses;
const savingsRate = income > 0 ? (savings / income) * 100 : 0;
```

Update the JSX to use `netExpenses` for the expenses card display, and add a small "after refunds" note when refunds > 0.

**Verify:** Transfers do NOT appear in income or expense totals. Refunds reduce expenses.

---

### Task 9: Update SpendingByCategory to exclude transfers and handle refunds

**Files:**

- Edit: `src/components/SpendingByCategory/SpendingByCategory.tsx`

**Step 1: Modify category aggregation**

Replace the `categoryData` reduce block with:

```typescript
const categoryData = filteredTransactions.reduce(
  (acc, txn) => {
    if (txn.type === "expense") {
      acc[txn.categoryId] = (acc[txn.categoryId] || 0) + Math.abs(txn.amount);
    } else if (txn.type === "refund") {
      // Refunds reduce spending in their category
      acc[txn.categoryId] = (acc[txn.categoryId] || 0) - Math.abs(txn.amount);
    }
    // Transfers are excluded entirely
    return acc;
  },
  {} as Record<string, number>,
);

// Filter out categories with zero or negative net spending
const data = Object.entries(categoryData)
  .filter(([_, amount]) => amount > 0)
  .map(([categoryId, amount]) => ({
    category: categoryId,
    amount: Math.round(amount),
  }))
  .sort((a, b) => b.amount - a.amount);
```

**Verify:** Chart shows no transfer entries. Refunds reduce the bar for their category.

---

### Task 10: Update MonthlyTrends to exclude transfers

**Files:**

- Edit: `src/components/MonthlyTrends/MonthlyTrends.tsx`

**Step 1: Modify monthly aggregation**

In the `transactions.forEach` loop inside `getLast12Months`, update to handle all types:

```typescript
transactions.forEach((txn) => {
  // Exclude transfers from trend calculations
  if (txn.type === "transfer") return;

  const txnDate = new Date(txn.date);
  months.forEach((monthData) => {
    if (
      txnDate.getMonth() === monthData.dateObj.getMonth() &&
      txnDate.getFullYear() === monthData.dateObj.getFullYear()
    ) {
      if (txn.type === "income") {
        monthData.income += Math.abs(txn.amount);
      } else if (txn.type === "expense") {
        monthData.expense += Math.abs(txn.amount);
      } else if (txn.type === "refund") {
        // Refunds reduce expenses
        monthData.expense -= Math.abs(txn.amount);
      }
    }
  });
});
```

**Verify:** Trend lines don't include transfer amounts. Refunds reduce the expense line.

---

### Task 11: Update TransactionList with type badges and account column

**Files:**

- Edit: `src/components/TransactionList/TransactionList.tsx`

**Step 1: Add Account column header and expand type badge styles**

Add an "Account" column after the "Type" column. Update the type badge to support all four types:

```typescript
const typeBadge = (type: string) => {
  switch (type) {
    case "income":
      return "bg-green-100 text-green-800";
    case "expense":
      return "bg-red-100 text-red-800";
    case "transfer":
      return "bg-gray-200 text-gray-600";
    case "refund":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
};
```

Use this in the JSX for the type column badge.

**Verify:** Transactions display correct badges — green for income, red for expense, gray for transfer, amber for refund.

---

## Phase 5: Wiring

### Task 12: Update useDB hook to seed accounts

**Files:**

- Edit: `src/hooks/useDB.ts`

**Step 1: Add account seeding and loading**

```typescript
import { useState, useEffect } from "react";
import { db } from "../database/db";
import { Category, Account } from "../database/types";
import { seedInitialCategories, seedInitialAccounts } from "../database/seed";

export function useDB() {
  const [dbInstance, setDbInstance] = useState<typeof db | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initDB = async () => {
      try {
        await seedInitialCategories();
        await seedInitialAccounts();
        const [catData, acctData] = await Promise.all([
          db.categories.toArray(),
          db.accounts.toArray(),
        ]);
        setCategories(catData);
        setAccounts(acctData);
        setDbInstance(db);
      } catch (error) {
        console.error("Failed to initialize DB:", error);
      } finally {
        setLoading(false);
      }
    };
    initDB();
  }, []);

  return { db: dbInstance, categories, accounts, loading };
}
```

---

### Task 13: Update App.tsx to load accounts

**Files:**

- Edit: `src/App.tsx`

**Step 1: Load accounts on mount, pass to child components if needed**

Add `Account` to the imports from `./database/types`. Add an `accounts` state similar to `categories`:

```typescript
const [accounts, setAccounts] = useState<Account[]>([]);
```

In `loadData`, seed accounts and load them:

```typescript
const loadData = async () => {
  try {
    await seedInitialCategories();
    await seedInitialAccounts();

    const [txnData, catData, acctData] = await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.accounts.toArray(),
    ]);

    setTransactions(txnData);
    setCategories(catData);
    setAccounts(acctData);
  } catch (error) {
    console.error("Failed to load data:", error);
  } finally {
    setLoading(false);
  }
};
```

Add import for `seedInitialAccounts` from `./database/seed`.

**Verify:** `npm run build` passes with no errors.

---

## Test Verification

**Manual Testing Checklist:**

- [ ] App compiles without errors (`npm run build`)
- [ ] Account selector dropdown appears in ImportCSV with Checking, Savings, Credit Card options
- [ ] Import checking CSV: CC payment line classified as `transfer`, regular purchases as `expense`, payroll as `income`
- [ ] Import credit card CSV: purchases as `expense`, "PAYMENT THANK YOU" as `transfer`, "REFUND" as `refund`
- [ ] Classification preview shows correct counts before importing
- [ ] SpendingSummary: transfers excluded from income and expense totals
- [ ] SpendingSummary: refunds reduce the expense total
- [ ] SpendingByCategory: no transfer entries, refunds reduce category amounts
- [ ] MonthlyTrends: trend lines exclude transfers, refunds reduce expense line
- [ ] TransactionList: correct color badges (green/red/gray/amber) for each type

**Test CSV Data (Checking):**

```csv
Date,Description,Amount,Type
03/01/2026,PAYROLL DEPOSIT,3500.00,income
03/02/2026,WALMART GROCERY,-85.42,expense
03/03/2026,CHASE CREDIT CARD PAYMENT,-1200.00,expense
03/04/2026,NETFLIX,-15.99,expense
```

Expected after import with "Checking" selected:

- PAYROLL → `income`
- WALMART → `expense`
- CHASE CREDIT CARD → `transfer`
- NETFLIX → `expense`

**Test CSV Data (Credit Card):**

```csv
Date,Description,Amount,Type
03/01/2026,STARBUCKS,-5.75,expense
03/02/2026,AMAZON REFUND,29.99,expense
03/03/2026,PAYMENT THANK YOU,1200.00,income
03/04/2026,UBER EATS,-22.50,expense
```

Expected after import with "Credit Card" selected:

- STARBUCKS → `expense`
- AMAZON REFUND → `refund`
- PAYMENT THANK YOU → `transfer`
- UBER EATS → `expense`

---

## Future Considerations

| Feature                              | Description                                                                       | Effort |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------ |
| **Cross-account transfer matching**  | Link the checking CC payment to the CC payment received, show as one transfer     | Medium |
| **User override for classification** | Let user reclassify a transaction type via dropdown in transaction list           | Low    |
| **Flip sign option**                 | Some banks use opposite sign conventions for CC charges — add toggle in import UI | Low    |
| **Account management UI**            | Add/rename/delete accounts beyond the 3 defaults                                  | Low    |
| **Per-account views**                | Filter dashboard by account                                                       | Low    |
| **Account balances**                 | Track running balance per account                                                 | Medium |
