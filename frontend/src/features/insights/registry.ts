import { Transaction } from "../../types";
import { AggregationOptions, WidgetDefinition, WidgetInstance } from "./types";
import { summarizeTotals } from "../transactions/aggregations";
import { presetSelection } from "../date-range/model/dateRange";

// Import aggregation functions
import {
  filterTransactions,
  buildDailyTrend,
  buildMonthlyTrend,
  groupByCategory,
  calculateAverageByCategory,
} from "../transactions/aggregations";
// Date range utilities are used via AggregationOptions

// ==============
// New Aggregation Functions
// ==============

export function buildCashFlowTrend(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);
  const bounds = options.bounds || {
    start: new Date(),
    end: new Date(),
  };

  // Use running trend, then convert cumulative values into day deltas.
  const dailyData = buildDailyTrend(filtered, bounds, "running");

  let previousIncome = 0;
  let previousExpense = 0;
  return dailyData.map((day) => {
    const income = day.income - previousIncome;
    const expense = day.expense - previousExpense;
    previousIncome = day.income;
    previousExpense = day.expense;

    return {
      date: day.day,
      income,
      expense,
      balance: day.net,
    };
  });
}

export function groupByMerchant(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);
  const limit = options.limit || 10;

  const totals: Record<string, number> = {};

  filtered.forEach((txn) => {
    const merchant = txn.merchant;
    totals[merchant] = (totals[merchant] ?? 0) + Math.abs(txn.amount);
  });

  return Object.entries(totals)
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function groupBySizeBucket(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);
  const bucketSize = options.bucketSize || 25;

  const buckets: Record<string, number> = {};

  filtered.forEach((txn) => {
    const amount = Math.abs(txn.amount);
    const bucket = Math.floor(amount / bucketSize) * bucketSize;
    const key = `${bucket}-${bucket + bucketSize}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  });

  return Object.entries(buckets)
    .map(([bucket, count]) => ({
      bucket,
      count,
      start: parseInt(bucket.split("-")[0]),
    }))
    .sort((a, b) => a.start - b.start);
}

export function groupByDayOfWeek(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);

  const days: Record<string, { total: number; count: number }> = {};

  filtered.forEach((txn) => {
    const date = parseTxnDate(txn.date);
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    if (!days[dayName]) {
      days[dayName] = { total: 0, count: 0 };
    }
    days[dayName].total += Math.abs(txn.amount);
    days[dayName].count += 1;
  });

  return Object.entries(days)
    .map(([day, data]) => ({
      day,
      amount: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => DAY_OF_WEEK_ORDER[a.day] - DAY_OF_WEEK_ORDER[b.day]);
}

const DAY_OF_WEEK_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parseTxnDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function listMonthsInBounds(options: AggregationOptions): string[] {
  const bounds = options.bounds || {
    start: new Date(),
    end: new Date(),
  };
  const start = new Date(bounds.start);
  const end = new Date(bounds.end);
  start.setDate(1);
  end.setDate(1);

  const months: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    months.push(formatMonthLabel(current));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

// ==============
// Stage 2 & 3 Aggregation Functions
// ==============

/**
 * Emergency Fund Runway
 * Calculates how many months of essential expenses are covered by liquid savings
 */
export function calculateEmergencyRunway(
  transactions: Transaction[],
  options: AggregationOptions = {},
  accounts: { id: string; type: "checking" | "savings" | "credit_card" }[] = [],
  essentialCategories: string[] = []
) {
  // Get liquid savings from checking/savings accounts
  const liquidAccounts = accounts.filter(
    (a) => a.type === "checking" || a.type === "savings"
  );
  const accountIds = liquidAccounts.map((a) => a.id);

  const filtered = filterTransactions(transactions, {
    ...options,
    accounts: accountIds.length > 0 ? accountIds : undefined,
  });

  // Calculate current balance (income - expenses)
  let currentBalance = 0;
  filtered.forEach((txn) => {
    if (txn.type === "income") currentBalance += Math.abs(txn.amount);
    if (txn.type === "expense") currentBalance -= Math.abs(txn.amount);
  });

  // Calculate monthly essential expenses
  // Only include expenses that match the provided essential categories
  // If no categories provided, return 0 runway (no data)
  if (essentialCategories.length === 0) {
    return {
      currentBalance,
      monthlyEssentialExpenses: 0,
      runwayMonths: 0,
      targetRunway: 3, // Recommended 3-6 months
    };
  }

  const filteredExpenses = filterTransactions(transactions, {
    ...options,
    types: ["expense"],
    categories: essentialCategories,
  });

  const monthlyExpensesByCategory: Record<string, number> = {};
  filteredExpenses.forEach((txn) => {
    if (txn.categoryId) {
      monthlyExpensesByCategory[txn.categoryId] =
        (monthlyExpensesByCategory[txn.categoryId] ?? 0) +
        Math.abs(txn.amount);
    }
  });

  const totalMonthlyEssentials = Object.values(monthlyExpensesByCategory).reduce(
    (sum, val) => sum + val,
    0
  );

  const runwayMonths = totalMonthlyEssentials > 0 ? currentBalance / totalMonthlyEssentials : 0;

  return {
    currentBalance,
    monthlyEssentialExpenses: totalMonthlyEssentials,
    runwayMonths: Math.round(runwayMonths * 10) / 10,
    targetRunway: 3, // Recommended 3-6 months
  };
}

/**
 * Debt Payoff - Current debt balances and payments
 */
export function calculateDebtPayoff(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, {
    ...options,
    types: ["expense"],
  });

  // Group by merchant/category to identify debt payments
  const debtPayments: Record<string, { amount: number; count: number }> = {};
  filtered.forEach((txn) => {
    if (txn.merchant && txn.merchant.toLowerCase().includes("payment")) {
      debtPayments[txn.merchant] = {
        amount: (debtPayments[txn.merchant]?.amount ?? 0) + Math.abs(txn.amount),
        count: (debtPayments[txn.merchant]?.count ?? 0) + 1,
      };
    }
  });

  const totalDebtPayments = Object.values(debtPayments).reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // Get recent debt transaction history for trend
  const bounds = options.bounds || { start: new Date(), end: new Date() };
  const sixMonthsAgo = new Date(bounds.end);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentFiltered = filterTransactions(transactions, {
    ...options,
    bounds: { start: sixMonthsAgo, end: bounds.end },
  });

  // Calculate debt trend over time
  const monthlyDebt: Record<string, number> = {};
  recentFiltered.forEach((txn) => {
    if (txn.type === "expense" && txn.merchant?.toLowerCase().includes("payment")) {
      const date = parseTxnDate(txn.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyDebt[monthKey] = (monthlyDebt[monthKey] ?? 0) + Math.abs(txn.amount);
    }
  });

  return {
    totalDebtPayments,
    debtPaymentCount: Object.values(debtPayments).reduce((sum, d) => sum + d.count, 0),
    monthlyDebtPattern: Object.entries(monthlyDebt)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/**
 * Fixed vs Variable Spending
 * Categorizes expenses as fixed (predictable) or variable (discretionary)
 */
export function calculateFixedVsVariable(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const fixedCategories = (options.fixedCategories as string[] | undefined) ?? [];
  const variableCategories = (options.variableCategories as string[] | undefined) ?? [];
  const filtered = filterTransactions(transactions, {
    ...options,
    types: ["expense"],
  });

  // Default fixed categories (housing, utilities, insurance, debt payments)
  const defaultFixed = ["housing", "utilities", "insurance", "debt", "loan"];
  const fixedCatSet = new Set([...defaultFixed, ...fixedCategories]);

  // Default variable categories (food, entertainment, shopping, dining)
  const defaultVariable = ["food", "entertainment", "shopping", "dining", "transport"];
  const variableCatSet = new Set([...defaultVariable, ...variableCategories]);

  let fixedTotal = 0;
  let variableTotal = 0;
  let unknownTotal = 0;

  filtered.forEach((txn) => {
    const catLower = (txn.categoryId || "").toLowerCase();
    const amount = Math.abs(txn.amount);

    // Check if category matches any fixed pattern
    let isFixed = false;
    fixedCatSet.forEach((cat) => {
      if (catLower.includes(cat)) isFixed = true;
    });
    if (isFixed) {
      fixedTotal += amount;
    } else {
      // Check if category matches any variable pattern
      let isVariable = false;
      variableCatSet.forEach((cat) => {
        if (catLower.includes(cat)) isVariable = true;
      });
      if (isVariable) {
        variableTotal += amount;
      } else {
        unknownTotal += amount;
      }
    }
  });

  const total = fixedTotal + variableTotal + unknownTotal;
  const fixedPercent = total > 0 ? (fixedTotal / total) * 100 : 0;
  const variablePercent = total > 0 ? (variableTotal / total) * 100 : 0;

  return {
    fixed: fixedTotal,
    variable: variableTotal,
    unknown: unknownTotal,
    fixedPercent: Math.round(fixedPercent * 10) / 10,
    variablePercent: Math.round(variablePercent * 10) / 10,
    total,
  };
}

/**
 * Budget vs Actual - compare planned vs actual spending
 * Note: Requires budget data which may need backend support
 */
export function calculateBudgetVsActual(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const budgets = (options.budgets as Record<string, number> | undefined) ?? {};
  const filtered = filterTransactions(transactions, {
    ...options,
    types: ["expense"],
  });

  const actualByCategory: Record<string, number> = {};
  filtered.forEach((txn) => {
    if (txn.categoryId) {
      actualByCategory[txn.categoryId] =
        (actualByCategory[txn.categoryId] ?? 0) + Math.abs(txn.amount);
    }
  });

  const comparison = Object.entries(actualByCategory).map(([categoryId, actual]) => ({
    categoryId,
    budgeted: budgets[categoryId] ?? 0,
    actual,
    variance: (budgets[categoryId] ?? 0) - actual,
    variancePercent:
      budgets[categoryId] && budgets[categoryId] > 0
        ? ((budgets[categoryId] - actual) / budgets[categoryId]) * 100
        : null,
  }));

  const totalBudgeted = Object.values(budgets).reduce((sum, v) => sum + v, 0);
  const totalActual = Object.values(actualByCategory).reduce((sum, v) => sum + v, 0);
  const totalVariance = totalBudgeted - totalActual;

  return {
    comparison,
    totalBudgeted,
    totalActual,
    totalVariance,
    totalVariancePercent: totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0,
  };
}

/**
 * Income Stability - analyze income variability over time
 */
export function calculateIncomeStability(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const incomeTransactions = filterTransactions(transactions, {
    ...options,
    types: ["income"],
  });

  // Group by month
  const monthlyIncome: Record<string, number> = {};
  incomeTransactions.forEach((txn) => {
    const date = parseTxnDate(txn.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyIncome[monthKey] = (monthlyIncome[monthKey] ?? 0) + Math.abs(txn.amount);
  });

  const incomeValues = Object.values(monthlyIncome);

  // Calculate statistics
  const mean = incomeValues.reduce((sum, v) => sum + v, 0) / incomeValues.length;
  const variance =
    incomeValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / incomeValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0; // Coefficient of variation

  // Sort values for percentile calculation
  const sorted = [...incomeValues].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];

  const max = Math.max(...incomeValues);
  const min = Math.min(...incomeValues);

  return {
    meanMonthlyIncome: mean,
    stdDev: stdDev,
    coefficientOfVariation: Math.round(cv * 10) / 10,
    minMonthlyIncome: min,
    maxMonthlyIncome: max,
    p25MonthlyIncome: p25, // "Safe baseline"
    p75MonthlyIncome: p75,
    monthsCount: incomeValues.length,
  };
}

/**
 * Net Worth Trend - calculate assets minus liabilities over time
 * Note: Requires account balance history or asset/liability data
 */
export function calculateNetWorthTrend(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  // Simplified net worth calculation based on transaction history
  // In a full implementation, this would track asset and liability accounts separately

  const bounds = options.bounds || { start: new Date(), end: new Date() };
  const twelveMonthsAgo = new Date(bounds.end);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const filtered = filterTransactions(transactions, {
    ...options,
    bounds: { start: twelveMonthsAgo, end: bounds.end },
  });

  // Calculate net worth at each month boundary
  const monthlyNetWorth: Array<{ month: string; netWorth: number }> = [];
  const monthlyData = buildMonthlyTrend(filtered, bounds, "calendar");

  // Simplified: net worth change ≈ cumulative savings
  let runningNetWorth = 0;
  monthlyData.forEach((month) => {
    runningNetWorth += month.net; // net = income - expense
    monthlyNetWorth.push({
      month: month.month,
      netWorth: runningNetWorth,
    });
  });

  const currentNetWorth = monthlyNetWorth[monthlyNetWorth.length - 1]?.netWorth ?? 0;
  const startNetWorth = monthlyNetWorth[0]?.netWorth ?? 0;
  const trend = currentNetWorth - startNetWorth;
  const trendPercent = startNetWorth !== 0 ? (trend / startNetWorth) * 100 : 0;

  // Determine trend direction
  let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (trendPercent > 5) trendDirection = "increasing";
  else if (trendPercent < -5) trendDirection = "decreasing";

  return {
    monthlyNetWorth,
    currentNetWorth,
    trend,
    trendPercent: Math.round(trendPercent * 10) / 10,
    trendDirection,
  };
}

/**
 * Goal Progress - calculate progress toward savings goals
 * Note: Requires goal data which may need backend support
 */
export function calculateGoalProgress(
  _transactions: Transaction[],
  _options: AggregationOptions = {},
  goals: Array<{ id: string; name: string; targetAmount: number; currentAmount: number; targetDate?: string }> = []
) {
  if (goals.length === 0) {
    return { goals: [], totalTarget: 0, totalSaved: 0, averageProgress: 0, completedGoals: 0 };
  }

  const progress = goals.map((goal) => {
    const percent = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const remaining = goal.targetAmount - goal.currentAmount;

    // Calculate time to goal (months)
    let monthsToGoal: number | null = null;
    if (goal.targetDate && goal.currentAmount < goal.targetAmount) {
      const targetDate = new Date(goal.targetDate);
      const now = new Date();
      const monthsDiff = (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth());
      monthsToGoal = Math.max(0, monthsDiff);
    }

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      percent: Math.round(percent * 10) / 10,
      remaining,
      monthsToGoal,
      isComplete: goal.currentAmount >= goal.targetAmount,
    };
  });

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const averageProgress =
    goals.length > 0 ? progress.reduce((sum, g) => sum + g.percent, 0) / goals.length : 0;
  const completedGoals = progress.filter(g => g.isComplete).length;

  return {
    goals: progress,
    totalTarget,
    totalSaved,
    averageProgress: Math.round(averageProgress * 10) / 10,
    completedGoals,
  };
}

export function groupByCategoryByMonth(
  transactions: Transaction[],
  options: AggregationOptions = {}
): Array<Record<string, string | number>> {
  // Default to expense type if no types filter is provided, to maintain
  // "Category Spending" behavior. If user explicitly selects types, use those.
  const types = options.types ?? ["expense"];
  const filtered = filterTransactions(transactions, { ...options, types });
  const months = listMonthsInBounds(options);
  if (months.length === 0) {
    return [];
  }

  const totalsByCategory: Record<string, Record<string, number>> = {};
  const totalByCategory: Record<string, number> = {};

  filtered.forEach((txn) => {
    if (!txn.categoryId) return;

    const month = formatMonthLabel(parseTxnDate(txn.date));
    const categoryId = txn.categoryId;

    if (!totalsByCategory[categoryId]) {
      totalsByCategory[categoryId] = {};
    }

    totalsByCategory[categoryId][month] =
      (totalsByCategory[categoryId][month] ?? 0) + Math.abs(txn.amount);
    totalByCategory[categoryId] =
      (totalByCategory[categoryId] ?? 0) + Math.abs(txn.amount);
  });

  return Object.entries(totalsByCategory)
    .map(([category, monthTotals]) => {
      const row: Record<string, string | number> = { category };
      months.forEach((month) => {
        row[month] = monthTotals[month] ?? 0;
      });
      return {
        ...row,
        __total: totalByCategory[category] ?? 0,
      };
    })
    .sort((a, b) => b.__total - a.__total)
    .map(({ __total, ...row }) => row);
}

export function calculateSavingsRateByMonth(
  transactions: Transaction[],
  options: AggregationOptions = {}
) {
  const filtered = filterTransactions(transactions, options);
  const bounds = options.bounds || {
    start: new Date(),
    end: new Date(),
  };

  const monthlyData = buildMonthlyTrend(filtered, bounds, "calendar");

  return monthlyData.map((month) => {
    const income = month.income;
    const expense = month.expense;
    const savings = income - expense;
    const rate = income > 0 ? (savings / income) * 100 : 0;
    return {
      month: month.month,
      income,
      expense,
      savings,
      rate,
    };
  });
}

// ==============
// Widget Registry
// ==============

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  cashflow: {
    type: "cashflow",
    label: "Cash Flow",
    description: "Running balance over time",
    template: "line",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: buildCashFlowTrend,
    display: {
      xAxisKey: "date",
      series: [
        { key: "income", color: "#10b981", label: "Income" },
        { key: "expense", color: "#ef4444", label: "Expenses" },
        { key: "balance", color: "#3b82f6", label: "Balance" },
      ],
    },
    defaultFilters: { dateRange: presetSelection("30days") },
  },

  category_pie: {
    type: "category_pie",
    label: "Spending by Category",
    description: "Where your money goes",
    template: "pie",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: groupByCategory,
    display: { dataKey: "amount", nameKey: "category" },
    defaultFilters: { dateRange: presetSelection("currentMonth") },
  },

  category_bar: {
    type: "category_bar",
    label: "Spending by Category (Bar)",
    description: "Category spending as a horizontal bar chart",
    template: "bar",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: groupByCategory,
    display: {
      xAxisKey: "category",
      layout: "vertical",
      series: [{ key: "amount", color: "#3b82f6", label: "Amount" }],
    },
    defaultFilters: { dateRange: presetSelection("currentMonth") },
  },

  category_monthly_bar: {
    type: "category_monthly_bar",
    label: "Category Spending by Month",
    description: "Horizontal grouped bars of category expenses across months",
    template: "bar",
    aggregate: groupByCategoryByMonth,
    display: {
      xAxisKey: "category",
      layout: "vertical",
    },
    defaultFilters: { dateRange: presetSelection("6months") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  monthly_comparison: {
    type: "monthly_comparison",
    label: "Monthly Trends",
    description: "Income vs expenses by month",
    template: "bar",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: buildMonthlyTrend,
    display: {
      xAxisKey: "month",
      series: [
        { key: "income", color: "#10b981", label: "Income" },
        { key: "expense", color: "#ef4444", label: "Expenses" },
      ],
    },
    defaultFilters: { dateRange: presetSelection("6months") },
  },

  weekday_spending: {
    type: "weekday_spending",
    label: "Day-of-Week Patterns",
    description: "Which days you spend most",
    template: "bar",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: groupByDayOfWeek,
    display: {
      xAxisKey: "day",
      series: [{ key: "amount", color: "#f59e0b", label: "Avg Spending" }],
    },
    defaultFilters: { dateRange: presetSelection("90days") },
  },

  merchant_ranking: {
    type: "merchant_ranking",
    label: "Top Merchants",
    description: "Where you spend the most",
    template: "bar",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: groupByMerchant,
    display: {
      xAxisKey: "merchant",
      layout: "vertical",
      series: [{ key: "amount", color: "#3b82f6", label: "Total" }],
    },
    defaultFilters: { dateRange: presetSelection("30days") },
    aggregationDefaults: { limit: 10 },
  },

  histogram: {
    type: "histogram",
    label: "Transaction Sizes",
    description: "Distribution of transaction amounts",
    template: "bar",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: groupBySizeBucket,
    display: {
      xAxisKey: "bucket",
      series: [{ key: "count", color: "#8b5cf6", label: "Count" }],
    },
    defaultFilters: { dateRange: presetSelection("90days") },
    aggregationDefaults: { bucketSize: 25 },
  },

  savings_rate: {
    type: "savings_rate",
    label: "Savings Rate",
    description: "Monthly savings as % of income",
    template: "line",
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
    aggregate: calculateSavingsRateByMonth,
    display: {
      xAxisKey: "month",
      series: [{ key: "rate", color: "#10b981", label: "Savings Rate %" }],
    },
    defaultFilters: { dateRange: presetSelection("6months") },
  },

  spending_summary: {
    type: "spending_summary",
    label: "Summary",
    description: "Income, expenses, and savings at a glance",
    template: "summary",
    aggregate: summarizeTotals,
    display: {},
    defaultFilters: { dateRange: presetSelection("currentMonth") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  // ======== STAGE 2 WIDGETS ========

  fixed_vs_variable: {
    type: "fixed_vs_variable",
    label: "Fixed vs Variable",
    description: "Fixed costs vs discretionary spending",
    template: "summary",
    aggregate: calculateFixedVsVariable,
    display: {
      keys: ["fixed", "variable", "unknown", "fixedPercent", "variablePercent", "unknownPercent"],
      labels: {
        fixed: "Fixed Costs",
        variable: "Variable Spending",
        unknown: "Uncategorized Spending",
        fixedPercent: "Fixed %",
        variablePercent: "Variable %",
        unknownPercent: "Unknown %",
      },
    },
    defaultFilters: { dateRange: presetSelection("12months") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  budget_vs_actual: {
    type: "budget_vs_actual",
    label: "Budget vs Actual",
    description: "Planned vs actual spending by category",
    template: "bar",
    aggregate: (transactions, options) => {
      const result = calculateBudgetVsActual(transactions, options);
      // Transform to array format for bar chart
      return result.comparison.map((item) => ({
        category: item.categoryId,
        budgeted: item.budgeted,
        actual: item.actual,
        variance: item.variance,
      }));
    },
    display: {
      xAxisKey: "category",
      layout: "vertical",
    },
    defaultFilters: { dateRange: presetSelection("currentMonth") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  income_stability: {
    type: "income_stability",
    label: "Income Stability",
    description: "Monthly income variability and safe baseline",
    template: "summary",
    aggregate: calculateIncomeStability,
    display: {
      keys: ["meanMonthlyIncome", "p25MonthlyIncome", "coefficientOfVariation", "monthsCount"],
      labels: {
        meanMonthlyIncome: "Average Income",
        p25MonthlyIncome: "Safe Baseline",
        coefficientOfVariation: "Variability %",
        monthsCount: "Months Analyzed",
      },
    },
    defaultFilters: { dateRange: presetSelection("24months") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  // ======== STAGE 3 WIDGETS ========

  net_worth: {
    type: "net_worth",
    label: "Net Worth Trend",
    description: "Assets minus liabilities over time",
    template: "line",
    aggregate: (transactions, options) => {
      const result = calculateNetWorthTrend(transactions, options);
      // Transform monthlyNetWorth array to chart format
      return result.monthlyNetWorth.map((item) => ({
        month: item.month,
        netWorth: item.netWorth,
      }));
    },
    display: {
      xAxisKey: "month",
      series: [{ key: "netWorth", color: "#8b5cf6", label: "Net Worth" }],
    },
    defaultFilters: { dateRange: presetSelection("36months") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  goal_progress: {
    type: "goal_progress",
    label: "Goal Progress",
    description: "Progress toward savings goals",
    template: "summary",
    aggregate: calculateGoalProgress,
    display: {
      keys: ["totalTarget", "totalSaved", "averageProgress", "completedGoals"],
      labels: {
        totalTarget: "Total Target",
        totalSaved: "Total Saved",
        averageProgress: "Avg Progress %",
        completedGoals: "Completed Goals",
      },
    },
    defaultFilters: { dateRange: presetSelection("allTime") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  emergency_runway: {
    type: "emergency_runway",
    label: "Emergency Runway",
    description: "Months of expenses covered by savings",
    template: "summary",
    aggregate: calculateEmergencyRunway,
    display: {
      keys: ["currentBalance", "monthlyEssentialExpenses", "runwayMonths", "targetRunway"],
      labels: {
        currentBalance: "Current Balance",
        monthlyEssentialExpenses: "Monthly Essentials",
        runwayMonths: "Runway (Months)",
        targetRunway: "Target (Months)",
      },
    },
    defaultFilters: { dateRange: presetSelection("currentMonth") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  debt_payoff: {
    type: "debt_payoff",
    label: "Debt Payoff",
    description: "Debt balances and payoff progress",
    template: "summary",
    aggregate: calculateDebtPayoff,
    display: {
      keys: ["totalDebtPayments", "debtPaymentCount"],
      labels: {
        totalDebtPayments: "Total Debt Payments",
        debtPaymentCount: "Number of Payments",
      },
    },
    defaultFilters: { dateRange: presetSelection("24months") },
    gridSpan: { md: 1, lg: 1, rowMd: 1, rowLg: 1 },
  },

  category_average: {
    type: "category_average",
    label: "Average Spending by Category",
    description: "Average monthly spending by category over time",
    template: "category-average",
    aggregate: calculateAverageByCategory,
    display: {},
    defaultFilters: { dateRange: presetSelection("6months") },
    gridSpan: { md: 2, lg: 3, rowMd: 1, rowLg: 1 },
  },
};

// ==============
// Default Widgets
// ==============

export function createWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createDefaultWidgets(): WidgetInstance[] {
  return [
    { id: createWidgetId(), type: "spending_summary" },
    { id: createWidgetId(), type: "cashflow" },
    { id: createWidgetId(), type: "category_bar" },
    { id: createWidgetId(), type: "emergency_runway" },
  ];
}
