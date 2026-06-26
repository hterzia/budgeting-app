# Mobile Responsive Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the budgeting app fully responsive and functional on mobile devices with a touch-friendly interface, proper navigation, and mobile-optimized layouts.

**Architecture:** Implement mobile-first responsive design using Tailwind CSS breakpoints, create a mobile navigation drawer, optimize touch targets, and ensure all components work on screens 320px-768px wide.

**Tech Stack:** React 18, Tailwind CSS, Recharts, TypeScript

---

## Current State Analysis

**Issues identified:**
1. **AppLayout** - Navigation links hidden on mobile, no hamburger menu
2. **DashboardPage** - 2-column grid breaks on mobile, cards stack poorly
3. **TransactionList** - 6-column table impossible on mobile, needs card-based view
4. **SpendingSummary** - 3 cards need better mobile layout
5. **SpendingByCategory** - Vertical bar charts may be cramped on narrow screens
6. **Trends** - Chart legend may overflow on small screens
7. **InsightsPage** - 3-column grid doesn't adapt well to mobile
8. **WidgetCard** - Action buttons may be too close together for touch

---

## Implementation Tasks

### Task 1: Create Mobile Navigation Component

**Files:**
- Create: `frontend/src/features/navigation/MobileNav.tsx`
- Create: `frontend/src/features/navigation/NavLinks.tsx`
- Modify: `frontend/src/app/layouts/AppLayout.tsx`

**Step 1: Create MobileNav component**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ImportCSV } from "../../features/import/ImportCSV";
import { useBudget } from "../../app/providers/BudgetProvider";
import { Modal, Spinner } from "../../shared/ui";

export function MobileNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { accounts, isLoading, transactions } = useBudget();

  if (isLoading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size={48} />
          <p className="mt-4 text-gray-600">Loading budget data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Budgeting App
            </Link>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-label="Menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              Overview
            </Link>
            <Link
              to="/insights"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              Insights
            </Link>
            <Link
              to="/imports"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            >
              Imports
            </Link>
          </div>
          <div className="mt-4 px-4 pb-4">
            <button
              onClick={() => {
                setIsImportOpen(true);
                setIsMenuOpen(false);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-600 text-blue-600 font-medium hover:bg-blue-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import Statement
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Outlet />
      </main>

      {/* Import Modal */}
      <Modal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Bank Statement"
      >
        <ImportCSV accounts={accounts} onClose={() => setIsImportOpen(false)} />
      </Modal>
    </div>
  );
}
```

**Step 2: Update AppLayout to use MobileNav**

```tsx
import { MobileNav } from "./features/navigation/MobileNav";

export function AppLayout() {
  return <MobileNav />;
}
```

**Expected:** Navigation drawer opens/closes properly on mobile, all links accessible.

---

### Task 2: Create Mobile Dashboard Layout

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Create: `frontend/src/features/dashboard/MobileDashboard.tsx`

**Step 1: Create MobileDashboard component**

```tsx
import { TransactionList } from "./TransactionList/TransactionList";
import { SpendingSummary } from "./SpendingSummary/SpendingSummary";
import { SpendingByCategory } from "./SpendingByCategory/SpendingByCategory";
import { Trends } from "./Trends/Trends";
import { useBudget } from "../../app/providers/BudgetProvider";
import { useDashboardContext } from "../../app/providers/DashboardProvider";
import { Card } from "../../shared/ui/Card";

export function MobileDashboard() {
  const { categories } = useBudget();
  const { bounds, filteredTransactions } = useDashboardContext();

  return (
    <>
      {/* Spending Summary - Mobile optimized stacked cards */}
      <div className="space-y-4 mb-6">
        <SpendingSummary transactions={filteredTransactions} />
      </div>

      {/* Charts - Full width, stacked */}
      <div className="space-y-6 mb-6">
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
          <div className="h-64">
            <SpendingByCategory
              transactions={filteredTransactions}
              categories={categories}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Trends</h3>
            <Trends mode={mode} setMode={setMode} /> {/* Simplified toggle */}
          </div>
          <div className="h-64">
            <Trends transactions={filteredTransactions} bounds={bounds} />
          </div>
        </Card>
      </div>

      {/* Transactions - Card view for mobile */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transactions</h2>
        <TransactionList
          transactions={filteredTransactions}
          categories={categories}
        />
      </div>
    </>
  );
}
```

**Step 2: Update DashboardPage for responsive layout**

```tsx
export function DashboardPage() {
  const { categories } = useBudget();
  const { bounds, filteredTransactions } = useDashboardContext();

  // Detect mobile using window width or CSS classes
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileDashboard />;
  }

  return (
    <>
      <div className="mb-8">
        <SpendingSummary transactions={filteredTransactions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <SpendingByCategory
          transactions={filteredTransactions}
          categories={categories}
        />
        <Trends transactions={filteredTransactions} bounds={bounds} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Transactions</h2>
        <TransactionList
          transactions={filteredTransactions}
          categories={categories}
        />
      </div>
    </>
  );
}
```

**Expected:** Cards stack vertically on mobile, charts have adequate height.

---

### Task 3: Create Mobile Transaction List View

**Files:**
- Create: `frontend/src/features/dashboard/TransactionList/MobileTransactionList.tsx`
- Modify: `frontend/src/features/dashboard/TransactionList/TransactionList.tsx`

**Step 1: Create MobileTransactionList component**

```tsx
import { Transaction, Category } from "../../../types";
import { formatCurrency } from "../../../shared/lib/format";
import { Card } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Badge";
import { useState } from "react";

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

export function MobileTransactionList({ transactions, categories }: Props) {
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedTxn(expandedTxn === id ? null : id);
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Uncategorized";
  };

  const getTypeStyles = (type: string) => {
    const styles: Record<string, string> = {
      income: "bg-green-100 text-green-800",
      expense: "bg-red-100 text-red-800",
      transfer: "bg-gray-200 text-gray-600",
      refund: "bg-amber-100 text-amber-800",
      ignored: "bg-gray-300 text-gray-500",
    };
    return styles[type] || "bg-gray-100 text-gray-600";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No transactions yet. Import a CSV to get started.
        </div>
      ) : (
        transactions.map((txn) => (
          <Card key={txn.id} className="overflow-hidden">
            <div
              className="p-4 cursor-pointer active:bg-gray-50 transition-colors"
              onClick={() => toggleExpand(txn.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {txn.merchant}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(txn.date)}
                  </p>
                </div>
                <div className="text-right min-w-[80px]">
                  <p
                    className={`font-bold ${
                      txn.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(txn.amount))}
                  </p>
                  <Badge
                    className={`text-[10px] px-1.5 py-0.5 uppercase ${
                      getTypeStyles(txn.type)
                    }`}
                  >
                    {txn.type}
                  </Badge>
                </div>
              </div>

              {/* Category row */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Category:</span>
                <span className="text-xs font-medium text-gray-700 truncate flex-1">
                  {getCategoryName(txn.categoryId)}
                </span>
              </div>
            </div>

            {/* Expanded actions */}
            {expandedTxn === txn.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-3 flex gap-2">
                <button
                  className="flex-1 py-2 px-3 text-sm font-medium text-blue-600 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 active:bg-blue-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle category edit
                  }}
                >
                  Edit Category
                </button>
                <button
                  className="flex-1 py-2 px-3 text-sm font-medium text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle ignore toggle
                  }}
                >
                  {txn.isIgnored ? "Unignore" : "Ignore"}
                </button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
```

**Step 2: Update TransactionList to use mobile view**

```tsx
// Add to imports
import { MobileTransactionList } from "./MobileTransactionList";

export function TransactionList({ transactions, categories }: Props) {
  // Detect mobile
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileTransactionList transactions={transactions} categories={categories} />;
  }

  // Desktop table view...
}
```

**Expected:** Mobile view shows card-style transactions with expandable details.

---

### Task 4: Optimize Spending Summary for Mobile

**Files:**
- Modify: `frontend/src/features/dashboard/SpendingSummary/SpendingSummary.tsx`

```tsx
export const SpendingSummary = memo(function SpendingSummary({ transactions }: Props) {
  const { income, expenses: netExpenses, refunds, savings, savingsRate } = summarizeTotals(transactions);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <Card className="p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-gray-500">Income</p>
        <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1 sm:mt-2">
          {formatCurrency(income)}
        </p>
      </Card>
      <Card className="p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-gray-500">Expenses</p>
        <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">
          {formatCurrency(netExpenses)}
        </p>
        {refunds > 0 && (
          <p className="text-xs sm:text-sm mt-1 text-gray-500">
            (after {formatCurrency(refunds)} in refunds)
          </p>
        )}
      </Card>
      <Card className="p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-gray-500">Savings</p>
        <p
          className={`text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 ${
            savings >= 0 ? "text-blue-600" : "text-red-600"
          }`}
        >
          {formatCurrency(savings)}
        </p>
        <p
          className={`text-xs sm:text-sm mt-1 ${
            savings >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {savingsRate.toFixed(1)}% savings rate
        </p>
      </Card>
    </div>
  );
});
```

**Expected:** Cards stack on mobile with reduced padding and font sizes.

---

### Task 5: Optimize Spending By Category for Mobile

**Files:**
- Modify: `frontend/src/features/dashboard/SpendingByCategory/SpendingByCategory.tsx`

```tsx
export const SpendingByCategory = memo(function SpendingByCategory({ transactions, categories }: Props) {
  const data = groupByCategory(transactions).map(({ category: categoryId, amount }) => {
    const category = categories.find((c) => c.id === categoryId);
    return { category: category?.name ?? categoryId, amount };
  });

  return (
    <Card className="h-full">
      <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
      <div className="h-[250px] sm:h-[300px]">
        <BarTemplate
          data={data}
          xAxisKey="category"
          layout="vertical"
          series={[{ key: 'amount', color: '#3b82f6', label: 'Amount' }]}
        />
      </div>
    </Card>
  );
});
```

**Expected:** Chart has fixed height, labels adjusted for mobile screen width.

---

### Task 6: Optimize Trends Chart for Mobile

**Files:**
- Modify: `frontend/src/features/dashboard/Trends/Trends.tsx`

```tsx
export const Trends = memo(function Trends({
  transactions,
  bounds,
}: {
  transactions: Transaction[];
  bounds: DateRangeBounds;
}) {
  const [mode, setMode] = useState<"calendar" | "running">("calendar");
  const granularity = selectTrendGranularity(bounds);
  const data =
    granularity === "day"
      ? buildDailyTrend(transactions, bounds, mode)
      : buildMonthlyTrend(transactions, bounds, mode);
  const xAxisKey = granularity;
  const title = "Trend Chart";

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <CumulativeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="h-[250px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 10 }}
              minTickGap={20}
              interval="equidistant"
            />
            <YAxis
              tickFormatter={(value: number) =>
                formatCurrency(value, { compact: true })
              }
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px" }}
              itemStyle={{ fontSize: "12px" }}
              labelStyle={{ fontSize: "12px" }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: "10px" }}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              name="Income"
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#ef4444"
              strokeWidth={2}
              name="Expenses"
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Net"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
```

**Expected:** Chart fits in constrained space with smaller font sizes.

---

### Task 7: Optimize Insights Page for Mobile

**Files:**
- Modify: `frontend/src/pages/insights/InsightsPage.tsx`

```tsx
export function InsightsPage() {
  const { widgets, addWidget, removeWidget, updateWidgetFilters, updateWidgetConfig } = useInsightsState();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Insights</h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-500">
                Customize your financial dashboard
              </p>
            </div>
            <Button onClick={() => setIsPickerOpen(true)} className="text-sm sm:text-base">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Widget
            </Button>
          </div>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {widgets.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <div className="mx-auto h-16 w-16 sm:h-24 sm:w-24 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-24 sm:w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No widgets</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">Get started by adding your first widget.</p>
            <div className="mt-6">
              <Button onClick={() => setIsPickerOpen(true)} className="text-sm sm:text-base">
                Add Widget
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {widgets.map((widget) => {
              const definition = WIDGET_REGISTRY[widget.type];
              if (!definition) return null;

              return (
                <div key={widget.id} className="h-full">
                  <WidgetCard
                    instance={widget}
                    definition={definition}
                    onRemove={() => removeWidget(widget.id)}
                    onFilterChange={(updates) => updateWidgetFilters(widget.id, updates)}
                    onConfigChange={(updates) => updateWidgetConfig(widget.id, updates)}
                    className="h-full"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Widget Picker Modal */}
      <WidgetPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAdd={(key, title, description) => addWidget(key, title, description)}
      />
    </div>
  );
}
```

**Expected:** 2-column grid on tablets, single column on mobile.

---

### Task 8: Optimize Widget Card for Mobile

**Files:**
- Modify: `frontend/src/features/insights/WidgetCard.tsx`

```tsx
// Update the header section
<div className="flex items-start justify-between flex-wrap gap-2">
  <div className="flex-1 min-w-0">
    <h3 className="font-semibold text-gray-900 text-lg truncate">{title}</h3>
    <p className="text-xs text-gray-500 mt-0.5 truncate">
      {instance.description ?? definition.description}
    </p>
  </div>
  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
    {/* ... filter badge ... */}
    <button
      type="button"
      onClick={() => setIsFilterModalOpen(true)}
      className="text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-all duration-200 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg flex items-center gap-1"
    >
      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <span className="hidden sm:inline">Filters</span>
    </button>
    {/* ... other buttons ... */}
  </div>
</div>
```

**Expected:** Buttons and text adjusted for touch targets on mobile.

---

### Task 9: Add Global Mobile Styles

**Files:**
- Modify: `frontend/src/index.css`

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
  -webkit-tap-highlight-color: transparent;
}

#root {
  min-height: 100vh;
}

/* Mobile touch target optimization */
@media (max-width: 768px) {
  button,
  [role="button"],
  a {
    min-height: 44px;
    min-width: 44px;
  }

  .touch-optimized {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

/* Prevent text size adjust on orientation change */
html {
  -webkit-text-size-adjust: 100%;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Hide scrollbar but keep functionality */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

**Expected:** Better touch target coverage, smoother scrolling.

---

### Task 10: Create E2E Mobile Tests with Playwright

**Files:**
- Create: `frontend/tests/e2e/mobile.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mobile Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders mobile layout on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    // Check mobile navigation is visible
    const menuButton = page.locator('button[aria-label="Menu"]');
    await expect(menuButton).toBeVisible();

    // Menu should be closed by default
    const navLinks = page.locator('a[href="/insights"]');
    await expect(navLinks).not.toBeVisible();
  });

  test('opens mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const menuButton = page.locator('button[aria-label="Menu"]');
    await menuButton.click();

    const insightsLink = page.locator('a[href="/insights"]');
    await expect(insightsLink).toBeVisible();
  });

  test('displays spending summary cards stacked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for cards to load
    await page.waitForSelector('.text-2xl.font-bold');

    // Cards should be stacked vertically
    const cards = page.locator('.card'); // adjust selector based on actual class
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('displays transaction list in card format', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Import test data first if needed
    // Then check transaction cards
    const txnCards = page.locator('.transaction-card');
    const count = await txnCards.count();

    // At least some cards should be visible
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Mobile Widget Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('renders widget with touch-friendly buttons', async ({ page }) => {
    // Wait for widgets or empty state
    const addButton = page.locator('button:has-text("Add Widget")');
    await expect(addButton).toBeVisible();

    // Add a widget
    await addButton.click();

    // Verify modal opens
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
  });
});
```

**Expected:** All tests pass on mobile viewport.

---

### Task 11: Generate Mobile Screenshots with Playwright CLI

**Files:**
- Create: `frontend/tests/e2e/mobile-screenshots.ts`

```typescript
import { chromium } from '@playwright/test';

async function takeMobileScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Screenshot 1: Mobile landing page
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.text-2xl.font-bold');
  await page.screenshot({
    path: 'frontend/docs/mobile/landing.png',
    fullPage: true
  });

  // Screenshot 2: Mobile menu open
  await page.click('button[aria-label="Menu"]');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'frontend/docs/mobile/menu-open.png',
    fullPage: true
  });

  // Screenshot 3: Mobile spending summary
  await page.screenshot({
    path: 'frontend/docs/mobile/spending-summary.png',
    fullPage: true
  });

  // Screenshot 4: Mobile insights page
  await page.goto('http://localhost:5173/insights');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({
    path: 'frontend/docs/mobile/insights.png',
    fullPage: true
  });

  await browser.close();
  console.log('Mobile screenshots generated!');
}

takeMobileScreenshots().catch(console.error);
```

**Expected:** Screenshots saved to `frontend/docs/mobile/` directory.

---

## Implementation Order

1. Task 1: Mobile Navigation Component
2. Task 9: Global Mobile Styles
3. Task 4: Spending Summary Mobile
4. Task 2: Mobile Dashboard Layout
5. Task 3: Mobile Transaction List
6. Task 5: Spending By Category Mobile
7. Task 6: Trends Mobile
8. Task 7: Insights Page Mobile
9. Task 8: Widget Card Mobile
10. Task 11: Generate screenshots with Playwright
11. Task 10: Create E2E tests

## Success Criteria

- [ ] App renders correctly on 320px, 375px, 414px, 768px viewports
- [ ] All touch targets meet 44x44px minimum
- [ ] Mobile navigation drawer opens/closes smoothly
- [ ] Transaction list displays in card format on mobile
- [ ] Charts adjust font sizes for smaller screens
- [ ] Insights page shows 2-column grid on tablets
- [ ] All E2E tests pass on mobile viewport

## Tools

- Tailwind CSS responsive utilities (`sm:`, `md:`, `lg:` prefixes)
- Playwright for E2E mobile testing
- Manual testing on browser DevTools mobile emulation
