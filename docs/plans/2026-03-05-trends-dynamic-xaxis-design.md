# Design: Dynamic X-Axis Granularity in Trends

**Date:** 2026-03-05

## Problem

The Trends chart always displays data bucketed by month, even for short date ranges (e.g. 30 days) where per-day granularity would be more useful and informative.

## Goal

Switch the Trends chart x-axis to daily granularity when the selected range is under 90 days, and keep monthly granularity for ranges of 90 days or more.

## Approach

Approach A: two separate aggregation functions, conditional selection in the component.

## Design

### New function: `buildDailyTrend` (`aggregations.ts`)

Add a `buildDailyTrend(transactions: Transaction[], bounds: DateRangeBounds)` function alongside the existing `buildMonthlyTrend`. It:

- Iterates day-by-day from `bounds.start` to `bounds.end`
- Formats each day as `"MMM D"` (e.g. `"Mar 5"`) using `toLocaleDateString`
- Returns `{ day: string, income: number, expense: number, net: number }[]`
- Excludes transfers; applies refunds as negative expenses; computes `net = income - expense`

`buildMonthlyTrend` is unchanged.

### Granularity detection (`Trends.tsx`)

```ts
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const daysDiff = (bounds.end.getTime() - bounds.start.getTime()) / MS_PER_DAY;
const useDaily = daysDiff < 90;

const data = useDaily
  ? buildDailyTrend(transactions, bounds)
  : buildMonthlyTrend(transactions, bounds);

const xAxisKey = useDaily ? "day" : "month";
```

The `90days` preset spans ~90 days, landing at `>= 90` → monthly. The `30days` and `currentMonth` presets land at `< 90` → daily.

### XAxis change

```tsx
<XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} minTickGap={30} />
```

No other chart changes are needed.

### Tests

Add to `aggregations.test.ts`:

- `buildDailyTrend` produces the correct number of day buckets for a given range
- Transactions are bucketed into the correct day
- Transfers are excluded
- Refunds reduce expense
- `net` equals `income - expense`

## Files Changed

| File                                             | Change                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/features/transactions/aggregations.ts`      | Add `buildDailyTrend`                                                     |
| `src/features/transactions/aggregations.test.ts` | Add tests for `buildDailyTrend`                                           |
| `src/components/Trends/Trends.tsx`               | Compute `useDaily`, conditionally call aggregation, set dynamic `dataKey` |
