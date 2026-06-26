import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  filterByRange,
  summarizeTotals,
  groupByCategory,
  buildMonthlyTrend,
  buildDailyTrend,
  selectTrendGranularity,
  calculateAverageByCategory,
} from "./aggregations";
import { Transaction } from "../../types";
import { customSelection, getRangeBounds, presetSelection } from "../date-range/model/dateRange";

const baseTransactions: Transaction[] = [
  {
    id: "1",
    date: "2026-02-15",
    merchant: "Paycheck",
    amount: 3000,
    categoryId: "cat-income",
    type: "income",
    accountId: "acct-checking",
    importedAt: "2026-02-15",
    createdAt: "2026-02-15",
  },
  {
    id: "2",
    date: "2026-03-01",
    merchant: "Rent",
    amount: 1200,
    categoryId: "cat-housing",
    type: "expense",
    accountId: "acct-checking",
    importedAt: "2026-03-01",
    createdAt: "2026-03-01",
  },
  {
    id: "3",
    date: "2026-03-02",
    merchant: "CC Payment",
    amount: 500,
    categoryId: "cat-transfer",
    type: "transfer",
    accountId: "acct-checking",
    importedAt: "2026-03-02",
    createdAt: "2026-03-02",
  },
  {
    id: "4",
    date: "2026-03-03",
    merchant: "Refund",
    amount: 100,
    categoryId: "cat-shopping",
    type: "refund",
    accountId: "acct-credit-card",
    importedAt: "2026-03-03",
    createdAt: "2026-03-03",
  },
];

const transactionsWithIgnored: Transaction[] = [
  ...baseTransactions,
  {
    id: "5",
    date: "2026-03-04",
    merchant: "Ignored Expense",
    amount: 9999,
    categoryId: "cat-shopping",
    type: "expense",
    accountId: "acct-checking",
    importedAt: "2026-03-04",
    createdAt: "2026-03-04",
    isIgnored: true,
  },
  {
    id: "6",
    date: "2026-03-05",
    merchant: "Ignored Income",
    amount: 5000,
    categoryId: "cat-income",
    type: "income",
    accountId: "acct-checking",
    importedAt: "2026-03-05",
    createdAt: "2026-03-05",
    isIgnored: true,
  },
];

describe("aggregations", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T00:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("filters by date range (30days)", () => {
    const bounds = getRangeBounds(presetSelection("30days"));
    const filtered = filterByRange(baseTransactions, bounds);
    expect(filtered.length).toBe(4);
  });

  it("builds monthly trend", () => {
    const bounds = getRangeBounds(presetSelection("6months"));
    const data = buildMonthlyTrend(baseTransactions, bounds);
    expect(data.length).toBeGreaterThan(0);
  });

  it("summarizes totals excluding transfers and reducing refunds", () => {
    const { income, expenses, refunds, savings } =
      summarizeTotals(baseTransactions);
    expect(income).toBe(3000);
    expect(refunds).toBe(100);
    expect(expenses).toBe(1100); // 1200 - 100 refund
    expect(savings).toBe(1900);
  });

  it("groups by category and includes all transaction types", () => {
    const grouped = groupByCategory(baseTransactions);
    const shopping = grouped.find((g) => g.category === "cat-shopping");
    const housing = grouped.find((g) => g.category === "cat-housing");
    const income = grouped.find((g) => g.category === "cat-income");
    expect(housing?.amount).toBe(1200);
    expect(shopping?.amount).toBe(100); // Refund (100)
    expect(income?.amount).toBe(3000); // Paycheck
  });

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

  it("excludes ignored transactions from summarizeTotals", () => {
    const { income, expenses, refunds, savings } = summarizeTotals(
      transactionsWithIgnored
    );
    // Should be same as baseTransactions (ignoring 9999 expense and 5000 income)
    expect(income).toBe(3000);
    expect(refunds).toBe(100);
    expect(expenses).toBe(1100); // 1200 - 100 refund
    expect(savings).toBe(1900);
  });

  it("excludes ignored transactions from groupByCategory", () => {
    const grouped = groupByCategory(transactionsWithIgnored);
    // Ignored expense should not appear
    // Shopping now includes the refund (cat-shopping has Refund 100)
    const shopping = grouped.find((g) => g.category === "cat-shopping");
    expect(shopping?.amount).toBe(100); // Only the non-ignored Refund
  });

  it("respects types filter for groupByCategory", () => {
    // Filter to only expenses
    const grouped = groupByCategory(baseTransactions, { types: ["expense"] });
    const shopping = grouped.find((g) => g.category === "cat-shopping");
    const housing = grouped.find((g) => g.category === "cat-housing");
    const income = grouped.find((g) => g.category === "cat-income");
    expect(housing?.amount).toBe(1200);
    expect(shopping).toBeUndefined(); // Refund is not expense type
    expect(income).toBeUndefined(); // Income is not expense type
  });

  it("excludes ignored transactions from buildDailyTrend", () => {
    const start = new Date("2026-03-01T00:00:00");
    const end = new Date("2026-03-05T23:59:59");
    const data = buildDailyTrend(transactionsWithIgnored, { start, end });
    const mar4 = data.find((d) => d.day === "Mar 4");
    const mar5 = data.find((d) => d.day === "Mar 5");
    // Ignored transactions should not appear in cumulative values
    // Mar 1 has $1200 expense, Mar 3 has $100 refund, so cumulative expense is $1100
    // Mar 4 and Mar 5 should show cumulative $1100 expense (from previous days)
    // The ignored transactions ($9999 expense on Mar 4, $5000 income on Mar 5) do not appear
    expect(mar4?.income).toBe(0); // No income transactions before Mar 4
    expect(mar4?.expense).toBe(1100); // 1200 - 100 refund
    expect(mar5?.income).toBe(0); // No income transactions
    expect(mar5?.expense).toBe(1100); // Same cumulative as Mar 4
  });

  // Cumulative tests for buildDailyTrend in calendar mode
  describe("buildDailyTrend calendar mode cumulative", () => {
    it("cumulative income across multiple days in same month", () => {
      const start = new Date("2026-03-01T00:00:00");
      const end = new Date("2026-03-05T23:59:59");
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-01",
          merchant: "Income Day 1",
          amount: 100,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t2",
          date: "2026-03-02",
          merchant: "Income Day 2",
          amount: 200,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
        {
          id: "t3",
          date: "2026-03-03",
          merchant: "Income Day 3",
          amount: 300,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-03",
          createdAt: "2026-03-03",
        },
      ];
      const data = buildDailyTrend(txns, { start, end }, "calendar");
      expect(data[0].income).toBe(100); // Mar 1: 100
      expect(data[1].income).toBe(300); // Mar 2: 100 + 200 = 300
      expect(data[2].income).toBe(600); // Mar 3: 100 + 200 + 300 = 600
      expect(data[3].income).toBe(600); // Mar 4: no change
      expect(data[4].income).toBe(600); // Mar 5: no change
    });

    it("cumulative expenses across multiple days in same month", () => {
      const start = new Date("2026-03-01T00:00:00");
      const end = new Date("2026-03-05T23:59:59");
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-01",
          merchant: "Expense Day 1",
          amount: 100,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t2",
          date: "2026-03-02",
          merchant: "Expense Day 2",
          amount: 200,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
        {
          id: "t3",
          date: "2026-03-03",
          merchant: "Expense Day 3",
          amount: 300,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-03",
          createdAt: "2026-03-03",
        },
      ];
      const data = buildDailyTrend(txns, { start, end }, "calendar");
      expect(data[0].expense).toBe(100); // Mar 1: 100
      expect(data[1].expense).toBe(300); // Mar 2: 100 + 200 = 300
      expect(data[2].expense).toBe(600); // Mar 3: 100 + 200 + 300 = 600
      expect(data[3].expense).toBe(600); // Mar 4: no change
      expect(data[4].expense).toBe(600); // Mar 5: no change
    });

    it("refunds reduce cumulative expenses", () => {
      const start = new Date("2026-03-01T00:00:00");
      const end = new Date("2026-03-05T23:59:59");
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-01",
          merchant: "Expense Day 1",
          amount: 100,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t2",
          date: "2026-03-02",
          merchant: "Expense Day 2",
          amount: 200,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
        {
          id: "t3",
          date: "2026-03-03",
          merchant: "Refund",
          amount: 50,
          type: "refund",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-03",
          createdAt: "2026-03-03",
        },
      ];
      const data = buildDailyTrend(txns, { start, end }, "calendar");
      expect(data[0].expense).toBe(100); // Mar 1: 100
      expect(data[1].expense).toBe(300); // Mar 2: 100 + 200 = 300
      expect(data[2].expense).toBe(250); // Mar 3: 300 - 50 = 250
      expect(data[3].expense).toBe(250); // Mar 4: no change
      expect(data[4].expense).toBe(250); // Mar 5: no change
    });

    it("resets at month boundary", () => {
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
          merchant: "Mar Income 1",
          amount: 200,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t3",
          date: "2026-03-02",
          merchant: "Mar Income 2",
          amount: 300,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];
      const data = buildDailyTrend(txns, { start, end }, "calendar");
      // Feb 28 should have cumulative income of 100
      const feb28 = data.find((d) => d.day === "Feb 28");
      expect(feb28?.income).toBe(100);
      // Mar 1 should reset and start fresh at 200 (not 300)
      const mar1 = data.find((d) => d.day === "Mar 1");
      expect(mar1?.income).toBe(200);
      // Mar 2 should be cumulative within March only: 200 + 300 = 500
      const mar2 = data.find((d) => d.day === "Mar 2");
      expect(mar2?.income).toBe(500);
    });
  });

  // Running mode tests for buildDailyTrend
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
          merchant: "Mar Income 1",
          amount: 200,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t3",
          date: "2026-03-02",
          merchant: "Mar Income 2",
          amount: 300,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];
      const data = buildDailyTrend(txns, { start, end }, "running");
      // Running mode should continue cumulative across months
      const feb28 = data.find((d) => d.day === "Feb 28");
      expect(feb28?.income).toBe(100);
      const mar1 = data.find((d) => d.day === "Mar 1");
      expect(mar1?.income).toBe(300); // 100 + 200 = 300 (continues from Feb)
      const mar2 = data.find((d) => d.day === "Mar 2");
      expect(mar2?.income).toBe(600); // 100 + 200 + 300 = 600 (continues)
    });
  });

  // Cumulative tests for buildMonthlyTrend
  describe("buildMonthlyTrend cumulative", () => {
    it("calendar mode shows monthly totals", () => {
      const bounds = getRangeBounds(presetSelection("6months"));
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
          date: "2026-02-20",
          merchant: "Feb Expense",
          amount: 500,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-02-20",
          createdAt: "2026-02-20",
        },
        {
          id: "t3",
          date: "2026-03-15",
          merchant: "Mar Income",
          amount: 2000,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-15",
          createdAt: "2026-03-15",
        },
        {
          id: "t4",
          date: "2026-03-20",
          merchant: "Mar Expense",
          amount: 800,
          type: "expense",
          categoryId: "cat-shopping",
          accountId: "acct-1",
          importedAt: "2026-03-20",
          createdAt: "2026-03-20",
        },
      ];
      const data = buildMonthlyTrend(txns, bounds, "calendar");
      const febData = data.find((d) => d.month === "Feb 2026");
      const marData = data.find((d) => d.month === "Mar 2026");
      // Calendar mode: each month shows only its own total
      expect(febData?.income).toBe(1000);
      expect(febData?.expense).toBe(500);
      expect(marData?.income).toBe(2000);
      expect(marData?.expense).toBe(800);
    });

    it("running mode shows cumulative across months", () => {
      // Use a custom range that includes Feb, Mar, and Apr 2026
      const bounds = {
        start: new Date("2026-02-01T00:00:00"),
        end: new Date("2026-04-30T23:59:59"),
      };
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
        {
          id: "t3",
          date: "2026-04-15",
          merchant: "Apr Income",
          amount: 3000,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-04-15",
          createdAt: "2026-04-15",
        },
      ];
      const data = buildMonthlyTrend(txns, bounds, "running");
      const febData = data.find((d) => d.month === "Feb 2026");
      const marData = data.find((d) => d.month === "Mar 2026");
      const aprData = data.find((d) => d.month === "Apr 2026");
      // Running mode: cumulative continues across months
      expect(febData?.income).toBe(1000);
      expect(marData?.income).toBe(3000); // 1000 + 2000 = 3000
      expect(aprData?.income).toBe(6000); // 1000 + 2000 + 3000 = 6000
    });
  });

  describe("selectTrendGranularity", () => {
    it("returns 'day' for ranges under 90 days", () => {
      const bounds = {
        start: new Date("2026-01-01"),
        end: new Date("2026-03-01"), // ~59 days
      };
      expect(selectTrendGranularity(bounds)).toBe("day");
    });

    it("returns 'month' for ranges of 90 days or more", () => {
      const bounds = {
        start: new Date("2026-01-01"),
        end: new Date("2026-04-01"), // 90 days
      };
      expect(selectTrendGranularity(bounds)).toBe("month");
    });

    it("returns 'month' for a full year range", () => {
      const bounds = {
        start: new Date("2025-03-05"),
        end: new Date("2026-03-05"),
      };
      expect(selectTrendGranularity(bounds)).toBe("month");
    });

    it("returns 'day' for a single-day range", () => {
      const bounds = {
        start: new Date("2026-03-05T00:00:00"),
        end: new Date("2026-03-05T23:59:59"),
      };
      expect(selectTrendGranularity(bounds)).toBe("day");
    });
  });

  describe("edge cases", () => {
    it("summarizeTotals returns zeros for empty transactions", () => {
      const result = summarizeTotals([]);
      expect(result.income).toBe(0);
      expect(result.expenses).toBe(0);
      expect(result.refunds).toBe(0);
      expect(result.savings).toBe(0);
      expect(result.savingsRate).toBe(0);
    });

    it("summarizeTotals computes savingsRate correctly", () => {
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-01",
          merchant: "Salary",
          amount: 1000,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t2",
          date: "2026-03-02",
          merchant: "Rent",
          amount: 400,
          type: "expense",
          categoryId: "cat-housing",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];
      const result = summarizeTotals(txns);
      expect(result.savingsRate).toBe(60); // (1000-400)/1000 * 100
    });

    it("groupByCategory returns empty array for empty transactions", () => {
      expect(groupByCategory([])).toEqual([]);
    });

    it("groupByCategory aggregates multiple categories and sorts descending", () => {
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-01",
          merchant: "Rent",
          amount: 1200,
          type: "expense",
          categoryId: "cat-housing",
          accountId: "acct-1",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "t2",
          date: "2026-03-02",
          merchant: "Grocery",
          amount: 300,
          type: "expense",
          categoryId: "cat-groceries",
          accountId: "acct-1",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
        {
          id: "t3",
          date: "2026-03-03",
          merchant: "More Grocery",
          amount: 200,
          type: "expense",
          categoryId: "cat-groceries",
          accountId: "acct-1",
          importedAt: "2026-03-03",
          createdAt: "2026-03-03",
        },
      ];
      const grouped = groupByCategory(txns);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].category).toBe("cat-housing");
      expect(grouped[0].amount).toBe(1200);
      expect(grouped[1].category).toBe("cat-groceries");
      expect(grouped[1].amount).toBe(500);
    });

    it("buildDailyTrend returns empty array for zero-width range", () => {
      const start = new Date("2026-03-05T12:00:00");
      const end = new Date("2026-03-04T12:00:00"); // end before start
      const data = buildDailyTrend([], { start, end });
      expect(data).toEqual([]);
    });

    it("filterByRange returns empty for no matches", () => {
      const bounds = getRangeBounds(
        customSelection(new Date(2020, 0, 1), new Date(2020, 0, 31))
      );
      const filtered = filterByRange(baseTransactions, bounds);
      expect(filtered).toHaveLength(0);
    });

    it("excludes ignored transactions from buildMonthlyTrend", () => {
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      const txns: Transaction[] = [
        {
          id: "t1",
          date: "2026-03-10",
          merchant: "Salary",
          amount: 5000,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-10",
          createdAt: "2026-03-10",
        },
        {
          id: "t2",
          date: "2026-03-15",
          merchant: "Ignored Salary",
          amount: 9999,
          type: "income",
          categoryId: "cat-income",
          accountId: "acct-1",
          importedAt: "2026-03-15",
          createdAt: "2026-03-15",
          isIgnored: true,
        },
      ];
      const data = buildMonthlyTrend(txns, bounds, "calendar");
      const mar = data.find((d) => d.month === "Mar 2026");
      expect(mar?.income).toBe(5000); // ignored transaction excluded
    });
  });
});

describe("calculateAverageByCategory", () => {
  const baseTransactions: Transaction[] = [
    {
      id: "1",
      date: "2026-01-15",
      merchant: "Grocery Store",
      amount: 150,
      categoryId: "cat-groceries",
      type: "expense",
      accountId: "acct-checking",
      importedAt: "2026-01-15",
      createdAt: "2026-01-15",
    },
    {
      id: "2",
      date: "2026-01-20",
      merchant: "Gas Station",
      amount: 50,
      categoryId: "cat-transportation",
      type: "expense",
      accountId: "acct-checking",
      importedAt: "2026-01-20",
      createdAt: "2026-01-20",
    },
    {
      id: "3",
      date: "2026-02-10",
      merchant: "Grocery Store",
      amount: 200,
      categoryId: "cat-groceries",
      type: "expense",
      accountId: "acct-checking",
      importedAt: "2026-02-10",
      createdAt: "2026-02-10",
    },
    {
      id: "4",
      date: "2026-02-15",
      merchant: "Restaurant",
      amount: 75,
      categoryId: "cat-dining",
      type: "expense",
      accountId: "acct-checking",
      importedAt: "2026-02-15",
      createdAt: "2026-02-15",
    },
    {
      id: "5",
      date: "2026-03-05",
      merchant: "Grocery Store",
      amount: 100,
      categoryId: "cat-groceries",
      type: "expense",
      accountId: "acct-checking",
      importedAt: "2026-03-05",
      createdAt: "2026-03-05",
    },
  ];

  it("calculates average spending by category", () => {
    const bounds = getRangeBounds(presetSelection("6months"));
    const result = calculateAverageByCategory(baseTransactions, { bounds });

    const groceries = result.find((r) => r.categoryId === "cat-groceries");
    const transportation = result.find((r) => r.categoryId === "cat-transportation");
    const dining = result.find((r) => r.categoryId === "cat-dining");

    expect(groceries).toBeDefined();
    expect(groceries?.total).toBe(450); // 150 + 200 + 100
    expect(groceries?.average).toBe(150); // 450 / 3 months
    expect(groceries?.months).toBe(3);

    expect(transportation).toBeDefined();
    expect(transportation?.total).toBe(50);
    expect(transportation?.average).toBe(50);
    expect(transportation?.months).toBe(1);

    expect(dining).toBeDefined();
    expect(dining?.total).toBe(75);
    expect(dining?.average).toBe(75);
    expect(dining?.months).toBe(1);
  });

  it("sorts by average spending descending", () => {
    const bounds = getRangeBounds(presetSelection("6months"));
    const result = calculateAverageByCategory(baseTransactions, { bounds });

    // Sorted by average: groceries (150), dining (75), transportation (50)
    expect(result[0].categoryId).toBe("cat-groceries"); // 150 avg
    expect(result[1].categoryId).toBe("cat-dining"); // 75 avg
    expect(result[2].categoryId).toBe("cat-transportation"); // 50 avg
  });

  it("excludes ignored transactions", () => {
    const transactionsWithIgnored: Transaction[] = [
      ...baseTransactions,
      {
        id: "6",
        date: "2026-03-10",
        merchant: "Ignored Expense",
        amount: 9999,
        categoryId: "cat-groceries",
        type: "expense" as const,
        accountId: "acct-checking",
        importedAt: "2026-03-10",
        createdAt: "2026-03-10",
        isIgnored: true,
      },
    ];

    const bounds = getRangeBounds(presetSelection("6months"));
    const result = calculateAverageByCategory(transactionsWithIgnored, { bounds });

    const groceries = result.find((r) => r.categoryId === "cat-groceries");
    expect(groceries?.total).toBe(450); // Ignored 9999 not included
  });

  it("handles empty transactions", () => {
    const bounds = getRangeBounds(presetSelection("6months"));
    const result = calculateAverageByCategory([], { bounds });
    expect(result).toEqual([]);
  });

  it("respects category filter", () => {
    const bounds = getRangeBounds(presetSelection("6months"));
    const result = calculateAverageByCategory(baseTransactions, {
      bounds,
      categories: ["cat-groceries"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe("cat-groceries");
    expect(result[0].total).toBe(450);
  });

  it("respects types filter", () => {
    const txns: Transaction[] = [
      ...baseTransactions,
      {
        id: "6",
        date: "2026-03-10",
        merchant: "Refund",
        amount: 50,
        categoryId: "cat-groceries",
        type: "refund",
        accountId: "acct-checking",
        importedAt: "2026-03-10",
        createdAt: "2026-03-10",
      },
    ];

    const bounds = getRangeBounds(presetSelection("6months"));
    // With types filter for expense only, refund should be excluded
    const result = calculateAverageByCategory(txns, {
      bounds,
      types: ["expense"],
    });

    const groceries = result.find((r) => r.categoryId === "cat-groceries");
    expect(groceries?.total).toBe(450); // No refund included
  });
});
