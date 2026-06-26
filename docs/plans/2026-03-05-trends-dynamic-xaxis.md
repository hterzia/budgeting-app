# Trends Dynamic X-Axis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch the Trends chart x-axis to per-day granularity when the selected date range is under 90 days, and per-month for 90 days or more.

**Architecture:** Add a `buildDailyTrend` function alongside the existing `buildMonthlyTrend` in `aggregations.ts`. In `Trends.tsx`, compute the day span of `bounds`, pick the right aggregation function, and pass the matching key to `XAxis dataKey`.

**Tech Stack:** React, TypeScript, Recharts, Vitest

---

### Task 1: Add `buildDailyTrend` to aggregations (TDD)

**Files:**

- Modify: `src/features/transactions/aggregations.ts`
- Test: `src/features/transactions/aggregations.test.ts`

**Step 1: Write failing tests**

Add these four `it` blocks inside the existing `describe('aggregations', ...)` block in `src/features/transactions/aggregations.test.ts`. Add `buildDailyTrend` to the import at the top of the file:

```ts
import {
  filterByRange,
  summarizeTotals,
  groupByCategory,
  buildMonthlyTrend,
  buildDailyTrend,
} from "./aggregations";
```

Then add these tests at the end of the `describe` block:

```ts
it("builds daily trend with correct number of day buckets", () => {
  const start = new Date("2026-03-01T00:00:00");
  const end = new Date("2026-03-05T23:59:59");
  const data = buildDailyTrend([], { start, end });
  expect(data.length).toBe(5); // Mar 1 through Mar 5
});

it("buckets a transaction into the correct day", () => {
  const start = new Date("2026-03-01T00:00:00");
  const end = new Date("2026-03-05T23:59:59");
  const txns: Transaction[] = [
    {
      id: "t1",
      date: "2026-03-03",
      merchant: "Paycheck",
      amount: 500,
      type: "income",
      categoryId: "cat-income",
      accountId: "acct-1",
      importedAt: "2026-03-03",
      createdAt: "2026-03-03",
    },
  ];
  const data = buildDailyTrend(txns, { start, end });
  const mar3 = data.find((d) => d.day === "Mar 3");
  expect(mar3?.income).toBe(500);
  expect(mar3?.expense).toBe(0);
  expect(mar3?.net).toBe(500);
});

it("excludes transfers from daily trend", () => {
  const start = new Date("2026-03-01T00:00:00");
  const end = new Date("2026-03-05T23:59:59");
  const txns: Transaction[] = [
    {
      id: "t1",
      date: "2026-03-03",
      merchant: "CC Payment",
      amount: 500,
      type: "transfer",
      categoryId: "cat-transfer",
      accountId: "acct-1",
      importedAt: "2026-03-03",
      createdAt: "2026-03-03",
    },
  ];
  const data = buildDailyTrend(txns, { start, end });
  expect(data.every((d) => d.income === 0 && d.expense === 0)).toBe(true);
});

it("applies refund as negative expense in daily trend", () => {
  const start = new Date("2026-03-01T00:00:00");
  const end = new Date("2026-03-05T23:59:59");
  const txns: Transaction[] = [
    {
      id: "t1",
      date: "2026-03-03",
      merchant: "Store",
      amount: 100,
      type: "expense",
      categoryId: "cat-shopping",
      accountId: "acct-1",
      importedAt: "2026-03-03",
      createdAt: "2026-03-03",
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
  const data = buildDailyTrend(txns, { start, end });
  const mar3 = data.find((d) => d.day === "Mar 3");
  expect(mar3?.expense).toBe(70);
  expect(mar3?.net).toBe(-70);
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/transactions/aggregations.test.ts
```

Expected: 4 new tests FAIL with something like `buildDailyTrend is not a function` or similar export error.

**Step 3: Implement `buildDailyTrend`**

Add the following to the bottom of `src/features/transactions/aggregations.ts`:

```ts
function formatDayKey(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function buildDailyTrend(
  transactions: Transaction[],
  bounds: DateRangeBounds,
) {
  const days: { day: string; income: number; expense: number; net: number }[] =
    [];
  const current = new Date(bounds.start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(bounds.end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    days.push({ day: formatDayKey(current), income: 0, expense: 0, net: 0 });
    current.setDate(current.getDate() + 1);
  }

  transactions.forEach((txn) => {
    if (txn.type === "transfer") return;
    const txnDate = new Date(txn.date);
    txnDate.setHours(0, 0, 0, 0);
    const dayKey = formatDayKey(txnDate);
    const bucket = days.find((d) => d.day === dayKey);
    if (!bucket) return;

    if (txn.type === "income") bucket.income += Math.abs(txn.amount);
    if (txn.type === "expense") bucket.expense += Math.abs(txn.amount);
    if (txn.type === "refund") bucket.expense -= Math.abs(txn.amount);
  });

  return days.map((d) => ({ ...d, net: d.income - d.expense }));
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/transactions/aggregations.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/features/transactions/aggregations.ts src/features/transactions/aggregations.test.ts
git commit -m "feat: add buildDailyTrend aggregation for sub-90-day ranges"
```

---

### Task 2: Update `Trends.tsx` for dynamic granularity

**Files:**

- Modify: `src/components/Trends/Trends.tsx`

**Step 1: Update the import**

In `src/components/Trends/Trends.tsx`, change:

```ts
import { buildMonthlyTrend } from "../../features/transactions/aggregations";
```

to:

```ts
import {
  buildMonthlyTrend,
  buildDailyTrend,
} from "../../features/transactions/aggregations";
```

**Step 2: Replace the data line with dynamic logic**

Replace:

```ts
const data = buildMonthlyTrend(transactions, bounds);
const title = "Trend Chart";
```

with:

```ts
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const daysDiff = (bounds.end.getTime() - bounds.start.getTime()) / MS_PER_DAY;
const useDaily = daysDiff < 90;
const data = useDaily
  ? buildDailyTrend(transactions, bounds)
  : buildMonthlyTrend(transactions, bounds);
const xAxisKey = useDaily ? "day" : "month";
const title = "Trend Chart";
```

**Step 3: Update XAxis to use the dynamic key**

Replace:

```tsx
<XAxis dataKey="month" tick={{ fontSize: 12 }} minTickGap={30} />
```

with:

```tsx
<XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} minTickGap={30} />
```

**Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/components/Trends/Trends.tsx
git commit -m "feat: dynamic x-axis granularity in Trends (daily <90 days, monthly >=90 days)"
```
