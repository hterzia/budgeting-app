import { Transaction, TransactionType } from "../../types";
import { DateRangeBounds } from "../date-range/model/dateRange";

// ==============
// Filter Helper
// ==============

export interface AggregationOptions {
  bounds?: DateRangeBounds;
  categories?: string[];
  accounts?: string[];
  types?: TransactionType[];
  excludeIgnored?: boolean;
  limit?: number;
  bucketSize?: number;
  mode?: "calendar" | "running";
  budgets?: Record<string, number>; // category -> budgeted amount
  fixedCategories?: string[]; // categories classified as fixed costs
  variableCategories?: string[]; // categories classified as variable spending
}

function parseTransactionDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function filterByRange(
  transactions: Transaction[],
  bounds: DateRangeBounds
) {
  return transactions.filter((txn) => {
    // Normalize transaction date to midnight of its day in local timezone
    const txnDate = parseTransactionDate(txn.date);
    txnDate.setHours(0, 0, 0, 0);

    // Normalize bounds to midnight for consistent comparison
    const start = new Date(bounds.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(bounds.end);
    end.setHours(23, 59, 59, 999);

    return txnDate >= start && txnDate <= end;
  });
}

export function filterTransactions(
  transactions: Transaction[],
  options: AggregationOptions = {}
): Transaction[] {
  let result = transactions;

  // Filter by date range
  if (options.bounds) {
    result = filterByRange(result, options.bounds);
  }

  // Filter by categories
  if (options.categories && options.categories.length > 0) {
    result = result.filter((t) => options.categories?.includes(t.categoryId));
  }

  // Filter by accounts
  if (options.accounts && options.accounts.length > 0) {
    result = result.filter((t) => options.accounts?.includes(t.accountId));
  }

  // Filter by types
  if (options.types && options.types.length > 0) {
    result = result.filter((t) => options.types?.includes(t.type));
  }

  // Exclude ignored transactions (default true)
  if (options.excludeIgnored !== false) {
    result = result.filter((t) => !t.isIgnored);
  }

  return result;
}

// Legacy alias for backward compatibility
export { filterTransactions as filterByOptions };

// ==============
// Aggregation Functions with Options Pattern
// ==============

export function summarizeTotals(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);

  const income = filtered
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const expenses = filtered
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const refunds = filtered
    .filter((t) => t.type === "refund")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netExpenses = expenses - refunds;
  const savings = income - netExpenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  return { income, expenses: netExpenses, refunds, savings, savingsRate };
}

export function groupByCategory(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);
  const totals: Record<string, number> = {};
  filtered.forEach((txn) => {
    const key = txn.categoryId;
    if (!key) return;
    totals[key] = (totals[key] ?? 0) + Math.abs(txn.amount);
  });

  return Object.entries(totals)
    .map(([categoryId, amount]) => ({ category: categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function calculateAverageByCategory(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);

  // Group transactions by category
  const categoryData: Record<string, { total: number; months: Set<string> }> = {};

  filtered.forEach((txn) => {
    if (!txn.categoryId) return;

    const txnDate = parseTransactionDate(txn.date);
    const monthKey = getMonthKey(txnDate.getFullYear(), txnDate.getMonth());

    if (!categoryData[txn.categoryId]) {
      categoryData[txn.categoryId] = { total: 0, months: new Set<string>() };
    }

    categoryData[txn.categoryId].total += Math.abs(txn.amount);
    categoryData[txn.categoryId].months.add(monthKey);
  });

  return Object.entries(categoryData)
    .map(([categoryId, data]) => {
      const monthsCount = data.months.size;
      const average = monthsCount > 0 ? data.total / monthsCount : 0;
      return {
        categoryId,
        total: data.total,
        average,
        months: monthsCount,
      };
    })
    .sort((a, b) => b.average - a.average);
}

function formatDateKey(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getMonthKey(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return formatDateKey(date);
}

export function buildMonthlyTrend(
  transactions: Transaction[],
  boundsOrOptions: DateRangeBounds | AggregationOptions = {},
  mode?: "calendar" | "running"
) {
  let bounds: DateRangeBounds;
  let options: AggregationOptions = {};

  if (isDateRangeBounds(boundsOrOptions)) {
    bounds = boundsOrOptions;
    // If mode is passed as third parameter, set it in options
    if (mode) {
      options = { ...options, mode };
    }
  } else {
    options = boundsOrOptions;
    bounds = options.bounds || { start: new Date(), end: new Date() };
    // options.mode takes precedence, but we can still pass mode for backward compat
    if (mode && !options.mode) {
      options = { ...options, mode };
    }
  }

  // Calculate all months in the range
  const months: {
    month: string;
    income: number;
    expense: number;
    net: number;
  }[] = [];
  const current = new Date(bounds.start);
  const endDate = new Date(bounds.end);

  // Normalize to first day of month for consistent iteration
  current.setDate(1);

  while (current <= endDate) {
    const monthStr = formatDateKey(current);
    months.push({ month: monthStr, income: 0, expense: 0, net: 0 });
    current.setMonth(current.getMonth() + 1);
  }

  // Aggregate transactions by month
  const filtered = filterTransactions(transactions, options);

  // Initialize monthly totals
  const monthlyIncome: Record<string, number> = {};
  const monthlyExpense: Record<string, number> = {};

  // Aggregate transactions by month to get monthly totals
  filtered.forEach((txn) => {
    if (txn.type === "transfer") return;
    const txnDate = parseTransactionDate(txn.date);
    txnDate.setDate(1); // Normalize to first day for comparison

    const txnMonthKey = getMonthKey(txnDate.getFullYear(), txnDate.getMonth());
    const bucket = months.find((m) => m.month === txnMonthKey);
    if (!bucket) return;

    // Track monthly totals
    monthlyIncome[txnMonthKey] =
      (monthlyIncome[txnMonthKey] ?? 0) +
      (txn.type === "income" ? Math.abs(txn.amount) : 0);
    monthlyExpense[txnMonthKey] =
      (monthlyExpense[txnMonthKey] ?? 0) +
      (txn.type === "expense" ? Math.abs(txn.amount) : 0);
    if (txn.type === "refund") {
      monthlyExpense[txnMonthKey] =
        (monthlyExpense[txnMonthKey] ?? 0) - Math.abs(txn.amount);
    }
  });

  // Set monthly or cumulative totals based on mode
  const currentMode = options.mode || "calendar";
  if (currentMode === "calendar") {
    months.forEach((m) => {
      m.income = monthlyIncome[m.month] ?? 0;
      m.expense = monthlyExpense[m.month] ?? 0;
    });
  } else {
    // Running mode: compute cumulative totals by iterating through months in order
    let runningIncome = 0;
    let runningExpense = 0;
    months.forEach((m) => {
      runningIncome += monthlyIncome[m.month] ?? 0;
      runningExpense += monthlyExpense[m.month] ?? 0;
      m.income = runningIncome;
      m.expense = runningExpense;
    });
  }

  return months.map((m) => ({ ...m, net: m.income - m.expense }));
}

function formatDayKey(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function buildDailyTrend(
  transactions: Transaction[],
  boundsOrOptions: DateRangeBounds | AggregationOptions = {},
  mode?: "calendar" | "running"
) {
  let bounds: DateRangeBounds;
  let options: AggregationOptions = {};

  if (isDateRangeBounds(boundsOrOptions)) {
    bounds = boundsOrOptions;
    // If mode is passed as third parameter, set it in options
    if (mode) {
      options = { ...options, mode };
    }
  } else {
    options = boundsOrOptions;
    bounds = options.bounds || { start: new Date(), end: new Date() };
    // options.mode takes precedence, but we can still pass mode for backward compat
    if (mode && !options.mode) {
      options = { ...options, mode };
    }
  }

  const days: { day: string; income: number; expense: number; net: number }[] =
    [];
  const current = new Date(bounds.start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(bounds.end);
  endDate.setHours(0, 0, 0, 0);

  const filtered = filterTransactions(transactions, options);

  // Group transactions by day for efficient lookup
  const transactionsByDay: Record<string, Transaction[]> = {};
  filtered.forEach((txn) => {
    if (txn.type === "transfer") return;
    const txnDate = parseTransactionDate(txn.date);
    txnDate.setHours(0, 0, 0, 0);
    const dayKey = formatDayKey(txnDate);
    if (!transactionsByDay[dayKey]) {
      transactionsByDay[dayKey] = [];
    }
    transactionsByDay[dayKey].push(txn);
  });

  // Initialize cumulative totals
  let cumulativeIncome = 0;
  let cumulativeExpense = 0;
  let lastMonth = -1;
  let lastYear = -1;

  const currentMode = options.mode || "calendar";

  while (current <= endDate) {
    // Calendar mode: reset cumulative totals at month boundaries
    if (currentMode === "calendar") {
      const currentMonth = current.getMonth();
      const currentYear = current.getFullYear();

      if (
        currentMonth !== lastMonth ||
        currentYear !== lastYear
      ) {
        // Reset at month boundary
        cumulativeIncome = 0;
        cumulativeExpense = 0;
        lastMonth = currentMonth;
        lastYear = currentYear;
      }
    }

    const dayKey = formatDayKey(current);
    const dayTransactions = transactionsByDay[dayKey] || [];

    // Process transactions for this day and update cumulative
    dayTransactions.forEach((txn) => {
      if (txn.type === "income") cumulativeIncome += Math.abs(txn.amount);
      if (txn.type === "expense") cumulativeExpense += Math.abs(txn.amount);
      if (txn.type === "refund") cumulativeExpense -= Math.abs(txn.amount);
    });

    days.push({
      day: dayKey,
      income: cumulativeIncome,
      expense: cumulativeExpense,
      net: cumulativeIncome - cumulativeExpense,
    });

    current.setDate(current.getDate() + 1);
  }

  return days.map((d) => ({ ...d, net: d.income - d.expense }));
}

export function selectTrendGranularity(
  bounds: DateRangeBounds
): "day" | "month" {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysDiff = (bounds.end.getTime() - bounds.start.getTime()) / MS_PER_DAY;
  return daysDiff < 90 ? "day" : "month";
}

// Type guard for DateRangeBounds
function isDateRangeBounds(value: any): value is DateRangeBounds {
  return value && typeof value.start !== "undefined" && typeof value.end !== "undefined";
}

// Export helper functions for use in other modules
export { parseTransactionDate, formatDateKey, getMonthKey };
