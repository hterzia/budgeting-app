# Cumulative Trends Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modify `buildDailyTrend` and `buildMonthlyTrend` to support cumulative income/expense tracking that either resets at calendar month boundaries ("calendar" mode) or continues running across all months in range ("running" mode).

**Architecture:** Add a `mode` parameter ("calendar" | "running") to both aggregation functions. Calendar mode resets cumulative totals at the start of each calendar month. Running mode maintains a running total throughout the entire date range. Create a UI toggle component for users to switch between modes.

**Tech Stack:** TypeScript, React, Vite, Recharts

---

## Task 1: Create CumulativeToggle Component

**Files:**
- Create: `src/components/Trends/CumulativeToggle.tsx`

**Step 1: Create the toggle component**

Write a new component with:
- Toggle switch UI (use existing Toggle component if available, or create simple switch)
- Labels: "Monthly" (calendar mode) and "Running" (running mode)
- Props: `mode: "calendar" | "running"` and `onChange: (mode) => void`

```tsx
// src/components/Trends/CumulativeToggle.tsx
import { useState } from "react";

type CumulativeMode = "calendar" | "running";

interface CumulativeToggleProps {
  mode: CumulativeMode;
  onChange: (mode: CumulativeMode) => void;
}

export function CumulativeToggle({ mode, onChange }: CumulativeToggleProps) {
  const isCalendar = mode === "calendar";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${isCalendar ? "font-semibold" : "text-gray-500"}`}>
        Monthly
      </span>
      <button
        onClick={() => onChange(isCalendar ? "running" : "calendar")}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ease-in-out ${
          isCalendar ? "bg-gray-300" : "bg-emerald-500"
        }`}
        role="switch"
        aria-checked={isCalendar}
        title={`Switch to ${isCalendar ? "running" : "monthly"} cumulative mode`}
      >
        <span
          className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ease-in-out ${
            isCalendar ? "translate-x-0" : "translate-x-5"
          }`}
        />
      </button>
      <span className={`text-sm ${!isCalendar ? "font-semibold" : "text-gray-500"}`}>
        Running
      </span>
    </div>
  );
}
```

**Step 2: Run tests to verify toggle renders correctly**

```bash
npx vitest run src/components/Trends/CumulativeToggle.test.tsx
```

---

## Task 2: Update `buildDailyTrend` in aggregations.ts

**Files:**
- Modify: `src/features/transactions/aggregations.ts:108-140`

**Step 1: Add mode parameter and cumulative logic**

```typescript
export function buildDailyTrend(
  transactions: Transaction[],
  bounds: DateRangeBounds,
  mode: "calendar" | "running" = "calendar",
) {
  // ... existing day bucket creation code ...

  let cumulativeIncome = 0;
  let cumulativeExpense = 0;
  let lastMonth: number | null = null;

  while (current <= endDate) {
    // ... day key creation ...

    if (mode === "calendar") {
      // Reset at calendar month boundary
      const currentMonth = current.getMonth();
      const currentYear = current.getFullYear();
      const monthKey = currentYear * 12 + currentMonth;

      if (lastMonth !== null && monthKey !== lastMonth) {
        cumulativeIncome = 0;
        cumulativeExpense = 0;
      }
      lastMonth = monthKey;
    }

    // ... existing transaction aggregation logic ...

    days.push({ day: dayKey, income: cumulativeIncome, expense: cumulativeExpense, net: cumulativeIncome - cumulativeExpense });

    current.setDate(current.getDate() + 1);
  }

  return days.map((d) => ({ ...d, net: d.income - d.expense }));
}
```

**Step 2: Run existing tests to verify backward compatibility**

```bash
npx vitest run src/features/transactions/aggregations.test.ts
```

---

## Task 3: Update `buildMonthlyTrend` in aggregations.ts

**Files:**
- Modify: `src/features/transactions/aggregations.ts:62-102`

**Step 1: Add mode parameter and cumulative logic**

```typescript
export function buildMonthlyTrend(
  transactions: Transaction[],
  bounds: DateRangeBounds,
  mode: "calendar" | "running" = "calendar",
) {
  // ... existing month bucket creation code ...

  let cumulativeIncome = 0;
  let cumulativeExpense = 0;

  while (current <= endDate) {
    const monthStr = formatDateKey(current);
    months.push({ month: monthStr, income: 0, expense: 0, net: 0 });
    current.setMonth(current.getMonth() + 1);
  }

  // Aggregate transactions by month
  const nonIgnored = transactions.filter((t) => !t.isIgnored);
  nonIgnored.forEach((txn) => {
    if (txn.type === "transfer") return;
    const txnDate = new Date(txn.date);
    txnDate.setDate(1);
    const txnMonthKey = getMonthKey(txnDate.getFullYear(), txnDate.getMonth());
    const bucket = months.find((m) => m.month === txnMonthKey);
    if (!bucket) return;

    if (txn.type === "income") cumulativeIncome += Math.abs(txn.amount);
    if (txn.type === "expense") cumulativeExpense += Math.abs(txn.amount);
    if (txn.type === "refund") cumulativeExpense -= Math.abs(txn.amount);
  });

  // Update buckets with cumulative or monthly values
  months.forEach((bucket) => {
    const txnMonthKey = getMonthKey(
      new Date(bucket.month).getFullYear(),
      new Date(bucket.month).getMonth()
    );
    // Re-aggregate for this specific month
    let monthIncome = 0;
    let monthExpense = 0;
    nonIgnored.forEach((txn) => {
      if (txn.type === "transfer") return;
      const txnDate = new Date(txn.date);
      txnDate.setDate(1);
      const txnMonthKeyInner = getMonthKey(txnDate.getFullYear(), txnDate.getMonth());
      if (txnMonthKeyInner === txnMonthKey) {
        if (txn.type === "income") monthIncome += Math.abs(txn.amount);
        if (txn.type === "expense") monthExpense += Math.abs(txn.amount);
        if (txn.type === "refund") monthExpense -= Math.abs(txn.amount);
      }
    });

    if (mode === "calendar") {
      bucket.income = monthIncome;
      bucket.expense = monthExpense;
    } else {
      // Running mode: accumulate
      bucket.income = cumulativeIncome;
      bucket.expense = cumulativeExpense;
    }
    bucket.net = bucket.income - bucket.expense;
  });

  return months.map((m) => ({ ...m, net: m.income - m.expense }));
}
```

**Step 2: Simplify the algorithm - accumulate then reset**

```typescript
export function buildMonthlyTrend(
  transactions: Transaction[],
  bounds: DateRangeBounds,
  mode: "calendar" | "running" = "calendar",
) {
  // Calculate all months in the range
  const months: {
    month: string;
    income: number;
    expense: number;
    net: number;
  }[] = [];
  const current = new Date(bounds.start);
  const endDate = new Date(bounds.end);
  current.setDate(1);

  while (current <= endDate) {
    const monthStr = formatDateKey(current);
    months.push({ month: monthStr, income: 0, expense: 0, net: 0 });
    current.setMonth(current.getMonth() + 1);
  }

  let cumulativeIncome = 0;
  let cumulativeExpense = 0;

  // Iterate through each month and calculate its transactions
  for (let i = 0; i < months.length; i++) {
    const monthBucket = months[i];
    const monthDate = new Date(monthBucket.month);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const nonIgnored = transactions.filter((t) => !t.isIgnored && t.type !== "transfer");
    nonIgnored.forEach((txn) => {
      const txnDate = new Date(txn.date);
      if (txnDate.getFullYear() === year && txnDate.getMonth() === month) {
        if (txn.type === "income") cumulativeIncome += Math.abs(txn.amount);
        if (txn.type === "expense") cumulativeExpense += Math.abs(txn.amount);
        if (txn.type === "refund") cumulativeExpense -= Math.abs(txn.amount);
      }
    });

    if (mode === "calendar") {
      // Store monthly values
      monthBucket.income = months[i].income = cumulativeIncome;
      monthBucket.expense = cumulativeExpense;
      monthBucket.net = cumulativeIncome - cumulativeExpense;
      // Reset for next month
      cumulativeIncome = 0;
      cumulativeExpense = 0;
    } else {
      // Running mode: keep cumulative
      monthBucket.income = cumulativeIncome;
      monthBucket.expense = cumulativeExpense;
      monthBucket.net = cumulativeIncome - cumulativeExpense;
    }
  }

  return months.map((m) => ({ ...m, net: m.income - m.expense }));
}
```

---

## Task 4: Update Trends.tsx to use mode

**Files:**
- Modify: `src/components/Trends/Trends.tsx`

**Step 1: Add mode state and pass to aggregation functions**

```typescript
import { Transaction } from "../../database/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "../../utils/format";
import {
  buildMonthlyTrend,
  buildDailyTrend,
  selectTrendGranularity,
} from "../../features/transactions/aggregations";
import { Card } from "../../shared/ui";
import { DateRangeBounds } from "../../features/date-range/dateRange";
import { CumulativeToggle } from "./CumulativeToggle";
import { useState } from "react";

export function Trends({
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
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <CumulativeToggle mode={mode} onChange={setMode} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} minTickGap={30} />
          <YAxis
            tickFormatter={(value: number) =>
              formatCurrency(value, { compact: true })
            }
          />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
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
    </Card>
  );
}
```

---

## Task 5: Update aggregations.test.ts

**Files:**
- Modify: `src/features/transactions/aggregations.test.ts`

**Step 1: Add tests for calendar mode cumulative behavior**

```typescript
describe("buildDailyTrend cumulative", () => {
  it("cumulative income across multiple days in same month (calendar mode)", () => {
    const start = new Date("2026-03-01T00:00:00");
    const end = new Date("2026-03-05T23:59:59");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-03-01",
        merchant: "Paycheck",
        amount: 100,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-01",
        createdAt: "2026-03-01",
      },
      {
        id: "t2",
        date: "2026-03-03",
        merchant: "Bonus",
        amount: 200,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-03",
        createdAt: "2026-03-03",
      },
    ];
    const data = buildDailyTrend(txns, { start, end }, "calendar");

    expect(data[0].income).toBe(100); // Mar 1: 100
    expect(data[1].income).toBe(100); // Mar 2: 100 (no change)
    expect(data[2].income).toBe(300); // Mar 3: 100 + 200
  });

  it("cumulative expenses across multiple days in same month (calendar mode)", () => {
    const start = new Date("2026-03-01T00:00:00");
    const end = new Date("2026-03-05T23:59:59");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-03-01",
        merchant: "Rent",
        amount: 100,
        type: "expense",
        categoryId: "cat-housing",
        accountId: "acct-1",
        importedAt: "2026-03-01",
        createdAt: "2026-03-01",
      },
      {
        id: "t2",
        date: "2026-03-02",
        merchant: "Groceries",
        amount: 50,
        type: "expense",
        categoryId: "cat-shopping",
        accountId: "acct-1",
        importedAt: "2026-03-02",
        createdAt: "2026-03-02",
      },
    ];
    const data = buildDailyTrend(txns, { start, end }, "calendar");

    expect(data[0].expense).toBe(100); // Mar 1: 100
    expect(data[1].expense).toBe(150); // Mar 2: 100 + 50
  });

  it("refunds reduce cumulative expenses", () => {
    const start = new Date("2026-03-01T00:00:00");
    const end = new Date("2026-03-05T23:59:59");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-03-01",
        merchant: "Store",
        amount: 100,
        type: "expense",
        categoryId: "cat-shopping",
        accountId: "acct-1",
        importedAt: "2026-03-01",
        createdAt: "2026-03-01",
      },
      {
        id: "t2",
        date: "2026-03-03",
        merchant: "Refund",
        amount: 30,
        type: "refund",
        categoryId: "cat-shopping",
        accountId: "acct-1",
        importedAt: "2026-03-03",
        createdAt: "2026-03-03",
      },
    ];
    const data = buildDailyTrend(txns, { start, end }, "calendar");

    expect(data[0].expense).toBe(100); // Mar 1: 100
    expect(data[1].expense).toBe(100); // Mar 2: 100 (no change)
    expect(data[2].expense).toBe(70); // Mar 3: 100 - 30
  });

  it("resets at month boundary (calendar mode)", () => {
    const start = new Date("2026-02-28T00:00:00");
    const end = new Date("2026-03-03T23:59:59");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-02-28",
        merchant: "Feb Income",
        amount: 100,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-02-28",
        createdAt: "2026-02-28",
      },
      {
        id: "t2",
        date: "2026-03-01",
        merchant: "Mar Income",
        amount: 200,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-01",
        createdAt: "2026-03-01",
      },
    ];
    const data = buildDailyTrend(txns, { start, end }, "calendar");

    expect(data[0].income).toBe(100); // Feb 28: 100 (last day of Feb)
    expect(data[1].income).toBe(200); // Mar 1: 200 (reset to 0 at Mar 1, then add 200)
  });
});

describe("buildDailyTrend running mode", () => {
  it("running cumulative across months", () => {
    const start = new Date("2026-02-28T00:00:00");
    const end = new Date("2026-03-03T23:59:59");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-02-28",
        merchant: "Feb Income",
        amount: 100,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-02-28",
        createdAt: "2026-02-28",
      },
      {
        id: "t2",
        date: "2026-03-01",
        merchant: "Mar Income",
        amount: 200,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-01",
        createdAt: "2026-03-01",
      },
    ];
    const data = buildDailyTrend(txns, { start, end }, "running");

    expect(data[0].income).toBe(100); // Feb 28: 100
    expect(data[1].income).toBe(300); // Mar 1: 100 + 200 (no reset)
  });
});

describe("buildMonthlyTrend cumulative", () => {
  it("calendar mode shows monthly totals", () => {
    const bounds = getRangeBounds("6months");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-02-15",
        merchant: "Feb Income",
        amount: 1000,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-02-15",
        createdAt: "2026-02-15",
      },
      {
        id: "t2",
        date: "2026-03-15",
        merchant: "Mar Income",
        amount: 2000,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-15",
        createdAt: "2026-03-15",
      },
    ];
    const data = buildMonthlyTrend(txns, bounds, "calendar");

    const feb = data.find((m) => m.month === "Feb 2026");
    const mar = data.find((m) => m.month === "Mar 2026");

    expect(feb?.income).toBe(1000);
    expect(mar?.income).toBe(2000);
  });

  it("running mode shows cumulative across months", () => {
    const bounds = getRangeBounds("6months");
    const txns: Transaction[] = [
      {
        id: "t1",
        date: "2026-02-15",
        merchant: "Feb Income",
        amount: 1000,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-02-15",
        createdAt: "2026-02-15",
      },
      {
        id: "t2",
        date: "2026-03-15",
        merchant: "Mar Income",
        amount: 2000,
        type: "income",
        categoryId: "cat-income",
        accountId: "acct-1",
        importedAt: "2026-03-15",
        createdAt: "2026-03-15",
      },
    ];
    const data = buildMonthlyTrend(txns, bounds, "running");

    const feb = data.find((m) => m.month === "Feb 2026");
    const mar = data.find((m) => m.month === "Mar 2026");

    expect(feb?.income).toBe(1000);
    expect(mar?.income).toBe(3000); // 1000 + 2000
  });
});
```

---

## Task 6: Export CumulativeToggle from index

**Files:**
- Modify: `src/components/Trends/index.ts`

**Step 1: Export CumulativeToggle**

```typescript
export { CumulativeToggle } from "./CumulativeToggle";
```

---

## Task 7: Run final verification

**Step 1: Run all aggregations tests**

```bash
npx vitest run src/features/transactions/aggregations.test.ts
```

**Step 2: Run all Trends tests** (if any exist)

```bash
npx vitest run src/components/Trends/
```

**Step 3: Manual verification in browser**

```bash
npm run dev
```

Then:
1. Navigate to the Trends chart
2. Select a date range spanning multiple months (e.g., "6months")
3. Test both toggle modes:
   - "Monthly" (calendar): Should show monthly totals that reset each month
   - "Running": Should show cumulative totals that continue across months
4. Verify the chart displays expected behavior

---

## Files Summary

| File | Change |
|------|--------|
| `src/features/transactions/aggregations.ts` | Update `buildDailyTrend` and `buildMonthlyTrend` with `mode` parameter |
| `src/components/Trends/CumulativeToggle.tsx` | Create new toggle component |
| `src/components/Trends/Trends.tsx` | Add mode state and pass mode to aggregation functions |
| `src/components/Trends/index.ts` | Export CumulativeToggle |
| `src/features/transactions/aggregations.test.ts` | Add new test cases for cumulative behavior |
