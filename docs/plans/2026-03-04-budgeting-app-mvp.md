# Budgeting App MVP Implementation Plan

> **⚠️ Historical Plan:** This plan was written before the app migrated to a backend API architecture. References to Dexie, IndexedDB, and `BudgetDB` are no longer applicable — the app now uses an Express + PostgreSQL backend with no browser-side database.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local React budgeting app that imports bank CSV statements, categorizes transactions, and provides spending analytics including monthly trends and budget tracking.

**Architecture:** React + Vite frontend with SQLite (Dexie.js) for local storage. Bank CSV parser auto-detects templates. Smart categorization learns from user history. Minimalist Tailwind CSS styling.

**Tech Stack:**
- React 18 + Vite (Bulletproof React structure)
- Dexie.js (SQLite wrapper with async IndexedDB)
- Recharts (charts and visualizations)
- PapaParse (CSV parsing)
- Tailwind CSS (styling)

---

## Phase 1: Project Setup & Database

### Task 1: Initialize React + Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`

**Step 1: Create package.json with dependencies**

```json
{
  "name": "budgeting-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "dexie": "^4.0.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.11",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

**Step 2: Run npm install**

```bash
npm install
```

Expected: All dependencies installed successfully.

---

### Task 2: Create Vite & TypeScript config

**Files:**
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`

**Step 1: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
});
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Run build to verify config**

```bash
npm run build
```

Expected: Build fails because source files don't exist yet - this is expected.

---

### Task 3: Create HTML entry point & main.tsx

**Files:**
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/index.css`

**Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Budgeting App</title>
    <link rel="stylesheet" href="src/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 2: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Step 3: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f9fafb;
}

#root {
  min-height: 100vh;
}
```

---

### Task 4: Create database schema with Dexie

**Files:**
- Create: `src/database/db.ts`
- Create: `src/database/types.ts`

**Step 1: Create src/database/types.ts**

```typescript
export type TransactionType = 'income' | 'expense';
export type CategoryType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO string
  merchant: string;
  amount: number;
  categoryId: string;
  type: TransactionType;
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

**Step 2: Create src/database/db.ts**

```typescript
import Dexie, { Table } from 'dexie';
import { Transaction, Category, Budget, SavingsGoal } from './types';

export class BudgetDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  savingsGoals!: Table<SavingsGoal, string>;

  constructor() {
    super('BudgetDB');
    this.version(1).stores({
      transactions: '++id, date, merchant, amount, categoryId, type, importedAt',
      categories: '++id, name, type, color',
      budgets: '++id, month, categoryId',
      savingsGoals: '++id, name',
    });
  }
}

export const db = new BudgetDB();

// Custom hook for database access
export function useDB() {
  // Hook implementation will be added in next revision
  return { db, seedInitialCategories };
}
```

---

### Task 5: Create initial seed data (categories)

**Files:**
- Create: `src/database/seed.ts`

**Step 1: Create src/database/seed.ts**

```typescript
import { db } from './db';
import { Category } from './types';

export const initialCategories: Category[] = [
  { id: '1', name: 'Housing', type: 'expense', color: '#3b82f6' },
  { id: '2', name: 'Groceries', type: 'expense', color: '#10b981' },
  { id: '3', name: 'Dining Out', type: 'expense', color: '#f59e0b' },
  { id: '4', name: 'Transportation', type: 'expense', color: '#8b5cf6' },
  { id: '5', name: 'Utilities', type: 'expense', color: '#ef4444' },
  { id: '6', name: 'Entertainment', type: 'expense', color: '#ec4899' },
  { id: '7', name: 'Healthcare', type: 'expense', color: '#6366f1' },
  { id: '8', name: 'Shopping', type: 'expense', color: '#14b8a6' },
  { id: '9', name: 'Income', type: 'income', color: '#22c55e' },
  { id: '10', name: 'Investments', type: 'income', color: '#a855f7' },
];

export async function seedInitialCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(initialCategories);
  }
}
```

---

### Task 5.5: Create useDB custom hook

**Files:**
- Create: `src/hooks/useDB.ts`

**Step 1: Create src/hooks/useDB.ts**

```typescript
import { useState, useEffect } from 'react';
import { db, seedInitialCategories } from '../database/db';
import { Transaction, Category } from '../database/types';

export function useDB() {
  const [dbInstance, setDbInstance] = useState<typeof db | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initDB = async () => {
      try {
        await seedInitialCategories();
        const catData = await db.categories.toArray();
        setCategories(catData);
        setDbInstance(db);
      } catch (error) {
        console.error('Failed to initialize DB:', error);
      } finally {
        setLoading(false);
      }
    };
    initDB();
  }, []);

  return { db: dbInstance, categories, loading };
}
```

---

## Phase 2: CSV Parser with Auto-Detection

### Task 6: Create CSV parser utility

**Files:**
- Create: `src/parsers/csvParser.ts`

**Step 1: Create src/parsers/csvParser.ts**

```typescript
import Papa from 'papaparse';
import { Transaction } from '../database/types';

export interface BankTemplate {
  name: string;
  headers: string[];
  datePattern: string;
  amountColumn: 'credit' | 'debit' | 'amount';
  merchantColumn: string;
}

export const bankTemplates: BankTemplate[] = [
  {
    name: 'Chase Bank',
    headers: ['Date', 'Description', 'Amount', 'Type'],
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'amount',
    merchantColumn: 'Description',
  },
  {
    name: 'Capital One',
    headers: ['Transaction Date', 'Description', 'Amount', 'Type'],
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'amount',
    merchantColumn: 'Description',
  },
  {
    name: 'Revolut',
    headers: ['Start date', 'Description', 'Amount', 'Type'],
    datePattern: 'YYYY-MM-DD',
    amountColumn: 'amount',
    merchantColumn: 'Description',
  },
  {
    name: 'Wells Fargo',
    headers: ['Date', 'Message', 'Amount', 'Type'],
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'amount',
    merchantColumn: 'Message',
  },
  {
    name: 'Standard CSV',
    headers: ['date', 'merchant', 'amount', 'type'],
    datePattern: 'YYYY-MM-DD',
    amountColumn: 'amount',
    merchantColumn: 'merchant',
  },
];

export function detectTemplate(headers: string[]): BankTemplate | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const template of bankTemplates) {
    const templateHeaders = template.headers.map(h => h.toLowerCase());
    const match = templateHeaders.every(h =>
      normalizedHeaders.some(h2 => h2.includes(h) || h.includes(h2))
    );
    if (match) return template;
  }
  return null;
}

export function parseCSV(file: File): Promise<{ transactions: any[], template: BankTemplate | null }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const template = detectTemplate(results.meta.fields || []);
        const transactions = results.data
          .filter((row: any) => row && Object.values(row).some(v => v && v.toString().trim()))
          .map((row: any, index: number) => {
            const amount = parseFloat(row.amount || row['Amount'] || '0');
            const isExpense = amount < 0 || (row.type?.toLowerCase() === 'expense');
            const absAmount = Math.abs(amount);

            return {
              id: `txn-${Date.now()}-${index}`,
              date: row.date || row['Transaction Date'] || row['Start date'] || row['Date'],
              merchant: row.description || row['Description'] || row.message || row['Message'] || '',
              amount: absAmount,
              type: isExpense ? 'expense' : 'income',
              categoryId: '1',
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

---

### Task 7: Create CSV import component

**Files:**
- Create: `src/components/ImportCSV/ImportCSV.tsx`

**Step 1: Create src/components/ImportCSV/ImportCSV.tsx**

```typescript
import React, { useState } from 'react';
import { useDB } from '../../hooks/useDB';
import { parseCSV, BankTemplate } from '../../parsers/csvParser';

export function ImportCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<BankTemplate | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { db, seedInitialCategories } = useDB();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTemplate(null);
      setError(null);

      // Preview first few rows to detect template
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const lines = content.split('\n').slice(0, 5);
        const headers = lines[0]?.split(',').map(h => h.trim());
        if (headers) {
          // Simple template detection
          const templateNames = ['Chase', 'Capital One', 'Revolut', 'Wells Fargo', 'Standard'];
          let detected = 'Standard';
          headers.forEach((h, i) => {
            const lower = h.toLowerCase();
            if (lower.includes('description') || lower.includes('message')) detected = 'Chase';
            if (lower.includes('type')) detected = 'Capital One';
            if (lower.includes('start date')) detected = 'Revolut';
          });
          setTemplate({
            name: detected,
            headers: headers,
            datePattern: 'MM/DD/YYYY',
            amountColumn: 'amount',
            merchantColumn: detected === 'Wells Fargo' ? 'Message' : 'Description'
          });
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file || !db) return;

    setImporting(true);
    setError(null);

    try {
      await seedInitialCategories();
      const result = await parseCSV(file);

      // Map categories based on merchant keywords
      const categorizedTransactions = result.transactions.map(txn => ({
        ...txn,
        categoryId: categorizeTransaction(txn.merchant),
      }));

      await db.transactions.bulkAdd(categorizedTransactions);
      alert(`Successfully imported ${categorizedTransactions.length} transactions`);
      setFile(null);
      setTemplate(null);
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
    return '1'; // Default to housing
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Import Bank Statement</h2>

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

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!file || importing}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-300"
      >
        {importing ? 'Importing...' : 'Import CSV'}
      </button>
    </div>
  );
}
```

---

## Phase 3: Dashboard & Analytics

### Task 8: Create transaction list component

**Files:**
- Create: `src/components/TransactionList/TransactionList.tsx`

**Step 1: Create src/components/TransactionList/TransactionList.tsx**

```typescript
import React from 'react';
import { Transaction } from '../../database/types';

interface Props {
  transactions: Transaction[];
  onEdit?: (txn: Transaction) => void;
  onDelete?: (id: string) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No transactions yet. Import a CSV to get started.
              </td>
            </tr>
          ) : (
            transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(txn.date)}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{txn.merchant}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: txn.categoryColor || '#e5e7eb', color: '#374151' }}>
                    {txn.categoryName || 'Uncategorized'}
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${
                  txn.amount < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  ${Math.abs(txn.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                    txn.type === 'income'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {txn.type}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Task 9: Create spending summary component

**Files:**
- Create: `src/components/SpendingSummary/SpendingSummary.tsx`

**Step 1: Create src/components/SpendingSummary/SpendingSummary.tsx**

```typescript
import React from 'react';
import { Transaction } from '../../database/types';
import { formatCurrency } from '../../utils/format';

interface Props {
  transactions: Transaction[];
  period: 'month' | 'year';
}

export function SpendingSummary({ transactions, period }: Props) {
  const getTransactionsForPeriod = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return transactions.filter(txn => {
      const txnDate = new Date(txn.date);
      if (period === 'month') {
        return txnDate.getMonth() === month && txnDate.getFullYear() === year;
      }
      return txnDate.getFullYear() === year;
    });
  };

  const filteredTransactions = getTransactionsForPeriod();

  const income = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const expenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-500">Income</p>
        <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(income)}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-500">Expenses</p>
        <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(expenses)}</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-500">Savings</p>
        <p className={`text-3xl font-bold mt-2 ${savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
          {formatCurrency(savings)}
        </p>
        <p className={`text-sm mt-1 ${savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {savingsRate.toFixed(1)}% savings rate
        </p>
      </div>
    </div>
  );
}
```

---

### Task 10: Create spending by category chart

**Files:**
- Create: `src/components/SpendingByCategory/SpendingByCategory.tsx`

**Step 1: Create src/components/SpendingByCategory/SpendingByCategory.tsx**

```typescript
import React from 'react';
import { Transaction } from '../../database/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/format';

interface Props {
  transactions: Transaction[];
}

export function SpendingByCategory({ transactions }: Props) {
  const getTransactionsForCurrentMonth = () => {
    const now = new Date();
    return transactions.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
    });
  };

  const filteredTransactions = getTransactionsForCurrentMonth();

  const categoryData = filteredTransactions.reduce((acc, txn) => {
    if (txn.type === 'expense') {
      acc[txn.categoryId] = (acc[txn.categoryId] || 0) + Math.abs(txn.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(categoryData).map(([categoryId, amount]) => ({
    category: categoryId,
    amount: Math.round(amount),
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">Spending by Category (This Month)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="category" />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="amount" fill="#3b82f6" barSize={20} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

### Task 11: Create monthly trends component

**Files:**
- Create: `src/components/MonthlyTrends/MonthlyTrends.tsx`

**Step 1: Create src/components/MonthlyTrends/MonthlyTrends.tsx**

```typescript
import React from 'react';
import { Transaction } from '../../database/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/format';

interface Props {
  transactions: Transaction[];
}

export function MonthlyTrends({ transactions }: Props) {
  const getLast12Months = () => {
    const now = new Date();
    const months = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      months.push({
        month: monthStr,
        dateObj: date,
        income: 0,
        expense: 0,
      });
    }

    // Aggregate transactions
    transactions.forEach(txn => {
      const txnDate = new Date(txn.date);
      months.forEach(monthData => {
        if (txnDate.getMonth() === monthData.dateObj.getMonth() &&
            txnDate.getFullYear() === monthData.dateObj.getFullYear()) {
          if (txn.type === 'income') {
            monthData.income += Math.abs(txn.amount);
          } else {
            monthData.expense += Math.abs(txn.amount);
          }
        }
      });
    });

    return months.map(m => ({
      ...m,
      net: m.income - m.expense,
    }));
  };

  const data = getLast12Months();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">12-Month Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value: number) => formatCurrency(value, { compact: true })} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
          <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Expenses" />
          <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="Net" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

### Task 12: Create main App component with routing

**Files:**
- Create: `src/App.tsx`

**Step 1: Create src/App.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import { db, seedInitialCategories } from './database/db';
import { Transaction, Category, Budget, SavingsGoal } from './database/types';
import { ImportCSV } from './components/ImportCSV/ImportCSV';
import { TransactionList } from './components/TransactionList/TransactionList';
import { SpendingSummary } from './components/SpendingSummary/SpendingSummary';
import { SpendingByCategory } from './components/SpendingByCategory/SpendingByCategory';
import { MonthlyTrends } from './components/MonthlyTrends/MonthlyTrends';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await seedInitialCategories();

      const [txnData, catData] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
      ]);

      setTransactions(txnData);
      setCategories(catData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = () => {
    if (transactions.length === 0) return 'No data';

    const dates = transactions.map(t => new Date(t.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading budget data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Budgeting App</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{formatDateRange()}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Import Section */}
        <div className="mb-8">
          <ImportCSV />
        </div>

        {/* Summary Cards */}
        <div className="mb-8">
          <SpendingSummary transactions={transactions} period="month" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <SpendingByCategory transactions={transactions} />
          <MonthlyTrends transactions={transactions} />
        </div>

        {/* Transaction List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Transactions</h2>
          <TransactionList
            transactions={transactions}
            onDelete={(id) => {
              db.transactions.delete(id);
              setTransactions(transactions.filter(t => t.id !== id));
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
```

---

### Task 13: Create utility functions

**Files:**
- Create: `src/utils/format.ts`

**Step 1: Create src/utils/format.ts**

```typescript
export function formatCurrency(amount: number, options: { compact?: boolean; currency?: string } = {}) {
  const { compact = false, currency = 'USD' } = options;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
  }).format(value / 100);
}
```

---

## Phase 4: Advanced Features (Post-MVP)

### Task 14: Create Budget Planning Component

**Files:**
- Create: `src/components/BudgetPlanner/BudgetPlanner.tsx`

### Task 15: Create Savings Goals Component

**Files:**
- Create: `src/components/SavingsGoals/SavingsGoals.tsx`

---

## Implementation Commands

After creating all files, run:

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Test Verification

**Manual Testing Checklist:**
- [ ] App compiles without errors (`npm run build`)
- [ ] Dev server starts on port 3000 (`npm run dev`)
- [ ] Can upload CSV file with auto-detection
- [ ] Transactions appear in list after import
- [ ] Spending summary shows correct income/expense/savings
- [ ] Spending by category chart displays correctly
- [ ] Monthly trends chart shows 12-month history
- [ ] Can delete transactions

---

## Additional MVP Features to Consider

Here are some features you might want for a complete MVP:

| Feature | Why It Matters | Effort |
|---------|---------------|--------|
| **Search/Filter Transactions** | Find specific transactions quickly | Low |
| **Category Management** | Rename, delete, or add custom categories | Low |
| **Edit Transaction** | Correct merchant or amount errors | Low |
| **Transaction Notes** | Add reminders or details to transactions | Low |
| **Export to CSV** | Download your data for backup | Low |
| **Monthly Budget Alerts** | Notify when approaching category limit | Medium |
| **Savings Goal Progress** | Track and visualize goal completion | Medium |
| **Period Selector** | View data from different months | Low |

**My recommendation for true MVP (ship faster):**
- Core: CSV import, categorization, dashboard with charts, transaction list
- Add: Search/filter and CSV export
- Optional: Budget alerts and savings goals (can come in v1.1)

**Which additional features would you like included in this plan?**

**Plan complete and saved to `docs/plans/2026-03-04-budgeting-app-mvp.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
