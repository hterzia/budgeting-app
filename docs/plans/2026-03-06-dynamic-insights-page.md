# Dynamic Insights Page — Implementation Plan

**Date:** 2026-03-06
**Status:** Ready for Implementation

---

## Goal

Build a dynamic insights page at `/insights` where users add/remove/configure chart widgets to visualize their finances. Each widget has independent filters (date range, categories, accounts). Adding a new widget type = adding a config object to a registry — no new component needed.

---

## Architecture

### Three Layers

```
┌──────────────────────────────────────────────────────────┐
│  UI Layer                                                │
│  InsightsPage → WidgetCard → Template (Line/Bar/Pie/...) │
├──────────────────────────────────────────────────────────┤
│  Widget Layer                                            │
│  Registry (definitions) → Instances (user config)        │
│  useWidgetData() + useInsightsState()                    │
├──────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  filterTransactions() → aggregation functions             │
│  AggregationOptions → pure functions                     │
└──────────────────────────────────────────────────────────┘
```

### Key Types

```typescript
// --- Data Layer ---

interface AggregationOptions {
  bounds?: DateRangeBounds;
  categories?: string[];
  accounts?: string[];
  types?: TransactionType[];
  excludeIgnored?: boolean;      // defaults true
  limit?: number;
  bucketSize?: number;           // histogram
  mode?: 'calendar' | 'running'; // trends
}

// --- Widget Layer ---

type TemplateName = 'line' | 'bar' | 'pie' | 'summary';

interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  template: TemplateName;
  aggregate: (transactions: Transaction[], options: AggregationOptions) => unknown;
  display: {
    xAxisKey?: string;
    layout?: 'horizontal' | 'vertical';
    series?: Array<{ key: string; color: string; label: string }>;
    dataKey?: string;            // pie
    nameKey?: string;            // pie
  };
  defaultFilters: {
    dateRange: DateRangePreset;
  };
  aggregationDefaults?: Partial<AggregationOptions>;
}

interface WidgetInstance {
  id: string;
  type: string;                  // key into WIDGET_REGISTRY
  title?: string;                // override definition label
  filters: {
    dateRange?: DateRangePreset;
    categories?: string[];
    accounts?: string[];
    types?: TransactionType[];
  };
}
```

### Widget Registry

Each definition is declarative — a **function reference** for aggregation, display config for the template. No switch/case needed to render; `definition.aggregate(transactions, options)` is called directly.

```typescript
const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  cashflow: {
    type: 'cashflow',
    label: 'Cash Flow',
    description: 'Running balance over time',
    template: 'line',
    aggregate: buildCashFlowTrend,
    display: {
      xAxisKey: 'date',
      series: [
        { key: 'income', color: '#10b981', label: 'Income' },
        { key: 'expense', color: '#ef4444', label: 'Expenses' },
        { key: 'balance', color: '#3b82f6', label: 'Balance' },
      ],
    },
    defaultFilters: { dateRange: '30days' },
  },

  category_pie: {
    type: 'category_pie',
    label: 'Spending by Category',
    description: 'Where your money goes',
    template: 'pie',
    aggregate: groupByCategory,
    display: { dataKey: 'amount', nameKey: 'category' },
    defaultFilters: { dateRange: 'currentMonth' },
  },

  monthly_comparison: {
    type: 'monthly_comparison',
    label: 'Monthly Trends',
    description: 'Income vs expenses by month',
    template: 'bar',
    aggregate: buildMonthlyTrend,
    display: {
      xAxisKey: 'month',
      series: [
        { key: 'income', color: '#10b981', label: 'Income' },
        { key: 'expense', color: '#ef4444', label: 'Expenses' },
      ],
    },
    defaultFilters: { dateRange: '6months' },
  },

  weekday_spending: {
    type: 'weekday_spending',
    label: 'Day-of-Week Patterns',
    description: 'Which days you spend most',
    template: 'bar',
    aggregate: groupByDayOfWeek,
    display: {
      xAxisKey: 'day',
      series: [{ key: 'amount', color: '#f59e0b', label: 'Avg Spending' }],
    },
    defaultFilters: { dateRange: '90days' },
  },

  merchant_ranking: {
    type: 'merchant_ranking',
    label: 'Top Merchants',
    description: 'Where you spend the most',
    template: 'bar',
    aggregate: groupByMerchant,
    display: {
      xAxisKey: 'merchant',
      layout: 'vertical',
      series: [{ key: 'amount', color: '#3b82f6', label: 'Total' }],
    },
    defaultFilters: { dateRange: '30days' },
    aggregationDefaults: { limit: 10 },
  },

  histogram: {
    type: 'histogram',
    label: 'Transaction Sizes',
    description: 'Distribution of transaction amounts',
    template: 'bar',
    aggregate: groupBySizeBucket,
    display: {
      xAxisKey: 'bucket',
      series: [{ key: 'count', color: '#8b5cf6', label: 'Count' }],
    },
    defaultFilters: { dateRange: '90days' },
    aggregationDefaults: { bucketSize: 25 },
  },

  savings_rate: {
    type: 'savings_rate',
    label: 'Savings Rate',
    description: 'Monthly savings as % of income',
    template: 'line',
    aggregate: calculateSavingsRateByMonth,
    display: {
      xAxisKey: 'month',
      series: [{ key: 'rate', color: '#10b981', label: 'Savings Rate %' }],
    },
    defaultFilters: { dateRange: '6months' },
  },

  spending_summary: {
    type: 'spending_summary',
    label: 'Summary',
    description: 'Income, expenses, and savings at a glance',
    template: 'summary',
    aggregate: summarizeTotals,
    display: {},
    defaultFilters: { dateRange: 'currentMonth' },
  },
};
```

### Data Flow

```typescript
// useWidgetData: instance → memoized data
// Uses primitive deps for stable memoization (not object references)
function useWidgetData(instance: WidgetInstance) {
  const { transactions } = useBudget();
  const definition = WIDGET_REGISTRY[instance.type];

  const dateRange = instance.filters.dateRange ?? definition.defaultFilters.dateRange;
  const bounds = getRangeBounds(dateRange);

  const boundsKey = `${bounds.start.getTime()}-${bounds.end.getTime()}`;
  const categoriesKey = instance.filters.categories?.join(',') ?? '';
  const accountsKey = instance.filters.accounts?.join(',') ?? '';
  const typesKey = instance.filters.types?.join(',') ?? '';

  return useMemo(() => {
    const options: AggregationOptions = {
      bounds,
      categories: instance.filters.categories,
      accounts: instance.filters.accounts,
      types: instance.filters.types,
      ...definition.aggregationDefaults,
    };
    return definition.aggregate(transactions, options);
  }, [transactions, boundsKey, categoriesKey, accountsKey, typesKey]);
}
```

### Chart Templates

Generic Recharts wrappers — they know nothing about financial data.

```
LineTemplate:    data + series[] + xAxisKey → Recharts LineChart
BarTemplate:     data + series[] + xAxisKey + layout → Recharts BarChart
PieTemplate:     data + dataKey + nameKey → Recharts PieChart
SummaryTemplate: data → KPI cards (income/expense/savings)
```

`TemplateRenderer` selects the template based on the definition:

```typescript
function TemplateRenderer({ definition, data }: Props) {
  switch (definition.template) {
    case 'line': return <LineTemplate data={data} {...definition.display} />;
    case 'bar': return <BarTemplate data={data} {...definition.display} />;
    case 'pie': return <PieTemplate data={data} {...definition.display} />;
    case 'summary': return <SummaryTemplate data={data} />;
  }
}
```

### Routing

Install `react-router-dom` and add routes:
- `/` — Dashboard (existing layout, unchanged)
- `/insights` — InsightsPage

Navbar gets navigation links replacing current static title.

---

## File Structure

```
src/
├── features/
│   ├── transactions/
│   │   └── aggregations.ts              # Refactor existing + add new functions
│   └── insights/
│       ├── types.ts                      # AggregationOptions, WidgetDefinition, WidgetInstance
│       ├── registry.ts                   # WIDGET_REGISTRY + DEFAULT_WIDGETS
│       ├── useWidgetData.ts              # instance → memoized aggregated data
│       └── useInsightsState.ts           # widget CRUD + localStorage
├── components/
│   ├── Insights/
│   │   ├── InsightsPage.tsx              # Grid layout + add button
│   │   ├── WidgetCard.tsx                # Container: toolbar + error boundary + template
│   │   ├── WidgetPicker.tsx              # Modal: choose from registry
│   │   └── WidgetFilters.tsx             # Date range, category, account dropdowns
│   └── templates/
│       ├── LineTemplate.tsx              # Recharts LineChart wrapper
│       ├── BarTemplate.tsx               # Recharts BarChart wrapper
│       ├── PieTemplate.tsx               # Recharts PieChart wrapper
│       ├── SummaryTemplate.tsx           # KPI cards
│       └── TemplateRenderer.tsx          # Switch on template name
```

**Files modified:**
- `src/features/transactions/aggregations.ts` — refactor to AggregationOptions + add new functions
- `src/App.tsx` — add react-router, route to Dashboard and Insights
- `package.json` — add react-router-dom

**NOT modified:** `src/context/BudgetProvider.tsx` — stays focused on financial data.

---

## Implementation Steps

### Step 1: Types & Router Setup

- Create `src/features/insights/types.ts` — `AggregationOptions`, `WidgetDefinition`, `WidgetInstance`, `TemplateName`
- Install `react-router-dom`, add `BrowserRouter` + routes in `App.tsx`

### Step 2: Refactor Existing Aggregations

Update `src/features/transactions/aggregations.ts`:

1. Add `filterTransactions(transactions, options?)` helper
2. Refactor `summarizeTotals(transactions)` → `summarizeTotals(transactions, options?)`
3. Refactor `groupByCategory(transactions)` → `groupByCategory(transactions, options?)`
4. Refactor `buildMonthlyTrend(transactions, bounds, mode?)` → `buildMonthlyTrend(transactions, options?)`
5. Refactor `buildDailyTrend(transactions, bounds, mode?)` → `buildDailyTrend(transactions, options?)`
6. Keep `filterByRange` and `selectTrendGranularity` unchanged

Call site migration:
- `Trends.tsx`: `buildDailyTrend(txns, bounds, mode)` → `buildDailyTrend(txns, { bounds, mode })`
- `Trends.tsx`: `buildMonthlyTrend(txns, bounds, mode)` → `buildMonthlyTrend(txns, { bounds, mode })`
- `SpendingByCategory.tsx` and `SpendingSummary.tsx`: no change needed (options optional)

Update existing 33+ tests.

### Step 3: New Aggregation Functions + Tests

- `buildCashFlowTrend(transactions, options?)` — daily income/expense/cumulative balance
- `groupByMerchant(transactions, options?)` — group by merchant, sort desc, respect `limit`
- `groupBySizeBucket(transactions, options?)` — histogram buckets using `bucketSize`
- `groupByDayOfWeek(transactions, options?)` — average spending per weekday
- `calculateSavingsRateByMonth(transactions, options?)` — monthly savings rate %

Write tests for each.

### Step 4: Widget Registry

Create `src/features/insights/registry.ts`:
- `WIDGET_REGISTRY` — 8 definitions with function references
- `DEFAULT_WIDGETS` — starter set of 3 instances (spending_summary, cashflow, category_pie)

### Step 5: Chart Templates

Create `src/components/templates/`:
- `LineTemplate.tsx` — dynamic series, currency-formatted axes
- `BarTemplate.tsx` — horizontal/vertical layout, currency formatting
- `PieTemplate.tsx` — category colors, label formatting
- `SummaryTemplate.tsx` — KPI cards (adapted from SpendingSummary)
- `TemplateRenderer.tsx` — maps template name → component

### Step 6: Widget Hooks (keep simple for MVP)

- `useWidgetData.ts` — config → data via `definition.aggregate()`, primitive deps
- `useInsightsState.ts` — `useState` + `localStorage`, basic add/remove/updateFilters

### Step 7: Insights UI (keep simple for MVP)

- `InsightsPage.tsx` — CSS Grid (1/2/3 cols responsive), map widgets, "Add Widget" button
- `WidgetCard.tsx` — Card with title, remove button, date range selector, error boundary, TemplateRenderer
- `WidgetPicker.tsx` — Simple modal listing registry entries with "Add" buttons
- `WidgetFilters.tsx` — Date range dropdown (reuse existing DateRangeSelector pattern)

---

## Existing Assets Reused

| Asset | How It's Used |
|-------|---------------|
| `aggregations.ts` | Refactored functions become widget aggregation backends |
| `Trends.tsx` | Stays on dashboard; LineTemplate follows same Recharts pattern |
| `SpendingByCategory.tsx` | Stays on dashboard; PieTemplate + BarTemplate follow same pattern |
| `SpendingSummary.tsx` | Stays on dashboard; SummaryTemplate adapted from it |
| `BudgetProvider` / `useBudget()` | Read-only dependency for `useWidgetData` |
| `dateRange.ts` | `getRangeBounds()` + `DateRangePreset` used by widget filters |
| `format.ts` | `formatCurrency` used by all chart templates |
| `shared/ui/Card` | Used by WidgetCard |
| `shared/ui/Modal` | Used by WidgetPicker |

---

## Widget Types at Launch (8)

| Type | Template | Description |
|------|----------|-------------|
| `spending_summary` | summary | Income, expenses, savings KPIs |
| `cashflow` | line | Running balance over time |
| `category_pie` | pie | Expense breakdown by category |
| `monthly_comparison` | bar | Income vs expenses by month |
| `weekday_spending` | bar | Average spending by day of week |
| `merchant_ranking` | bar (vertical) | Top 10 merchants |
| `histogram` | bar | Transaction amount distribution |
| `savings_rate` | line | Monthly savings rate trend |

---

## Deferred (post-MVP)

| Item | Reason |
|------|--------|
| Drag-drop reorder | Install react-grid-layout when core widget system works |
| Widget resize | Needs react-grid-layout |
| CalendarHeatmap | Recharts can't do calendars; needs custom SVG or nivo |
| RecurringExpenses | Complex temporal pattern matching algorithm |
| Budget vs Actual | No Budget CRUD or API exists yet |
| Spending spikes | Z-score statistical analysis; advanced |
| LLM chat | Build widget system first; LLM generates WidgetInstance configs |

---

## Verification

1. `npm test` — existing 33+ aggregation tests pass after refactoring
2. `npm test` — new aggregation function tests pass
3. `npm run type-check` — no TypeScript errors
4. Manual: navigate to `/insights`, see default widgets
5. Manual: add/remove widgets from picker
6. Manual: change date range on one widget, others unaffected
7. Manual: refresh page, widgets persist (localStorage)
8. Manual: error in one widget doesn't crash others
