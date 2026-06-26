import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildCashFlowTrend,
  groupByMerchant,
  groupBySizeBucket,
  groupByDayOfWeek,
  groupByCategoryByMonth,
  calculateSavingsRateByMonth,
  calculateEmergencyRunway,
  calculateDebtPayoff,
  calculateFixedVsVariable,
  calculateBudgetVsActual,
  calculateIncomeStability,
  calculateNetWorthTrend,
  calculateGoalProgress,
} from "./registry";
import { Transaction } from "../../types";
import { getRangeBounds, presetSelection } from "../date-range/model/dateRange";

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
    merchant: "Store",
    amount: 150,
    categoryId: "cat-shopping",
    type: "expense",
    accountId: "acct-checking",
    importedAt: "2026-03-03",
    createdAt: "2026-03-03",
  },
  {
    id: "5",
    date: "2026-03-04",
    merchant: "Refund",
    amount: 100,
    categoryId: "cat-shopping",
    type: "refund",
    accountId: "acct-credit-card",
    importedAt: "2026-03-04",
    createdAt: "2026-03-04",
  },
  {
    id: "6",
    date: "2026-03-10",
    merchant: "Paycheck",
    amount: 3000,
    categoryId: "cat-income",
    type: "income",
    accountId: "acct-checking",
    importedAt: "2026-03-10",
    createdAt: "2026-03-10",
  },
  {
    id: "7",
    date: "2026-03-15",
    merchant: "Restaurant",
    amount: 80,
    categoryId: "cat-food",
    type: "expense",
    accountId: "acct-checking",
    importedAt: "2026-03-15",
    createdAt: "2026-03-15",
  },
];

describe("new aggregation functions", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T00:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("buildCashFlowTrend", () => {
    it("builds daily cash flow with cumulative balance", () => {
      // Use a date range that includes all transactions
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      const result = buildCashFlowTrend(baseTransactions, { bounds });

      expect(result.length).toBeGreaterThan(0);
      // The balance should eventually become positive after income arrives
      expect(result[result.length - 1]?.balance).toBeGreaterThan(0);
    });

    it("applies filters correctly", () => {
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      // Filter to only expenses - balance should decrease (negative)
      const result = buildCashFlowTrend(baseTransactions, {
        bounds,
        types: ["expense"],
      });
      // All values should be negative (only expenses, no income)
      expect(result.every((d) => d.balance <= 0)).toBe(true);
    });

    it("computes running balance from daily values only once", () => {
      const txns: Transaction[] = [
        {
          id: "cf-1",
          date: "2026-03-01",
          merchant: "Income",
          amount: 100,
          categoryId: "cat-income",
          type: "income",
          accountId: "acct-checking",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "cf-2",
          date: "2026-03-02",
          merchant: "Expense",
          amount: 20,
          categoryId: "cat-food",
          type: "expense",
          accountId: "acct-checking",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-03T23:59:59"),
      };

      const result = buildCashFlowTrend(txns, { bounds });

      expect(result.map((d) => d.balance)).toEqual([100, 80, 80]);
    });
  });

  describe("groupByMerchant", () => {
    it("groups transactions by merchant", () => {
      const result = groupByMerchant(baseTransactions);
      // Should have Paycheck (6000), Rent (1200), Store (150), Restaurant (80)
      // Plus CC Payment (500) and Refund (100) - all types included by default
      expect(result.length).toBe(6);
      expect(result[0].merchant).toBe("Paycheck");
      expect(result[0].amount).toBe(6000);
      expect(result[1].merchant).toBe("Rent");
      expect(result[1].amount).toBe(1200);
    });

    it("respects limit option", () => {
      const result = groupByMerchant(baseTransactions, { limit: 2 });
      expect(result.length).toBe(2);
      expect(result[0].merchant).toBe("Paycheck");
    });

    it("respects types filter to exclude transfers and refunds", () => {
      const result = groupByMerchant(baseTransactions, { types: ["expense", "income"] });
      const transfer = result.find((r) => r.merchant === "CC Payment");
      const refund = result.find((r) => r.merchant === "Refund");
      expect(transfer).toBeUndefined();
      expect(refund).toBeUndefined();
    });
  });

  describe("groupBySizeBucket", () => {
    it("groups transactions by size buckets", () => {
      // With bucketSize 500:
      const result = groupBySizeBucket(baseTransactions, { bucketSize: 500 });

      // Check that buckets are created correctly
      // Total count should be 7 (Paycheck x2, Rent, Store, Restaurant, CC Payment, Refund)
      const totalCount = result.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBe(7);

      // Check that buckets are sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
      }
    });

    it("uses default bucketSize of 25", () => {
      const result = groupBySizeBucket(baseTransactions);
      // Should have at least some buckets
      expect(result.length).toBeGreaterThan(0);
    });

    it("respects types filter to exclude transfers and refunds", () => {
      const result = groupBySizeBucket(baseTransactions, { types: ["expense", "income"] });
      // Total count should be 5 (Paycheck x2, Rent, Store, Restaurant)
      const totalCount = result.reduce((sum, r) => sum + r.count, 0);
      expect(totalCount).toBe(5);
    });
  });

  describe("groupByDayOfWeek", () => {
    it("groups transactions by day of week", () => {
      const result = groupByDayOfWeek(baseTransactions);
      // We should have some days with transactions
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(7);

      // Each result should have a valid day name and positive amount
      result.forEach((r) => {
        expect(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]).toContain(r.day);
        expect(r.amount).toBeGreaterThan(0);
      });
    });

    it("sorts weekdays in calendar order", () => {
      const txns: Transaction[] = [
        {
          id: "dow-1",
          date: "2026-03-04",
          merchant: "Wed Expense",
          amount: 10,
          categoryId: "cat-a",
          type: "expense",
          accountId: "acct-checking",
          importedAt: "2026-03-04",
          createdAt: "2026-03-04",
        },
        {
          id: "dow-2",
          date: "2026-03-01",
          merchant: "Sun Expense",
          amount: 20,
          categoryId: "cat-a",
          type: "expense",
          accountId: "acct-checking",
          importedAt: "2026-03-01",
          createdAt: "2026-03-01",
        },
        {
          id: "dow-3",
          date: "2026-03-02",
          merchant: "Mon Expense",
          amount: 30,
          categoryId: "cat-a",
          type: "expense",
          accountId: "acct-checking",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];

      const result = groupByDayOfWeek(txns);
      expect(result.map((row) => row.day)).toEqual(["Sunday", "Monday", "Wednesday"]);
    });
  });

  describe("groupByCategoryByMonth", () => {
    it("returns category rows with one series per month in range", () => {
      const bounds = {
        start: new Date("2026-02-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      const result = groupByCategoryByMonth(baseTransactions, { bounds });

      const housing = result.find((row) => row.category === "cat-housing");
      const shopping = result.find((row) => row.category === "cat-shopping");
      const food = result.find((row) => row.category === "cat-food");

      expect(housing).toBeDefined();
      expect(shopping).toBeDefined();
      expect(food).toBeDefined();

      expect(housing?.["Feb 2026"]).toBe(0);
      expect(housing?.["Mar 2026"]).toBe(1200);

      expect(shopping?.["Feb 2026"]).toBe(0);
      expect(shopping?.["Mar 2026"]).toBe(150);

      expect(food?.["Feb 2026"]).toBe(0);
      expect(food?.["Mar 2026"]).toBe(80);
    });

    it("sorts categories by total spending descending", () => {
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      const result = groupByCategoryByMonth(baseTransactions, { bounds });

      expect(result.map((row) => row.category)).toEqual([
        "cat-housing",
        "cat-shopping",
        "cat-food",
      ]);
    });

    it("respects types filter to include refunds", () => {
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      // Include both expense and refund types
      const result = groupByCategoryByMonth(baseTransactions, {
        bounds,
        types: ["expense", "refund"],
      });

      const shopping = result.find((row) => row.category === "cat-shopping");
      // Should include both expense ($150) and refund ($100) = $250
      expect(shopping?.["Mar 2026"]).toBe(250);
    });

    it("respects types filter to include income", () => {
      const bounds = {
        start: new Date("2026-03-01T00:00:00"),
        end: new Date("2026-03-31T23:59:59"),
      };
      // Include income type
      const result = groupByCategoryByMonth(baseTransactions, {
        bounds,
        types: ["income"],
      });

      const income = result.find((row) => row.category === "cat-income");
      // Should include only March paycheck ($3000) - Feb transaction is filtered by date range
      expect(income?.["Mar 2026"]).toBe(3000);
    });
  });

  describe("calculateSavingsRateByMonth", () => {
    it("calculates monthly savings rate", () => {
      const bounds = getRangeBounds(presetSelection("6months"));
      const result = calculateSavingsRateByMonth(baseTransactions, { bounds });

      // Should have some months with data
      expect(result.length).toBeGreaterThan(0);

      // Each result should have valid month, income, expense, savings, and rate
      result.forEach((r) => {
        expect(r.month).toBeDefined();
        expect(typeof r.income).toBe("number");
        expect(typeof r.expense).toBe("number");
        expect(typeof r.savings).toBe("number");
        expect(typeof r.rate).toBe("number");
      });
    });
  });

  describe("calculateEmergencyRunway", () => {
    it("calculates runway based on balance and essential expenses", () => {
      const result = calculateEmergencyRunway(baseTransactions, {});
      expect(result).toBeDefined();
      expect(typeof result.currentBalance).toBe("number");
      expect(typeof result.monthlyEssentialExpenses).toBe("number");
      expect(typeof result.runwayMonths).toBe("number");
    });

    it("returns 0 when essential expenses are 0", () => {
      const result = calculateEmergencyRunway(baseTransactions, {}, [], []);
      expect(result.runwayMonths).toBe(0);
    });
  });

  describe("calculateDebtPayoff", () => {
    it("calculates debt payments from transactions", () => {
      const result = calculateDebtPayoff(baseTransactions, {});
      expect(result).toBeDefined();
      expect(typeof result.totalDebtPayments).toBe("number");
      expect(Array.isArray(result.monthlyDebtPattern)).toBe(true);
    });
  });

  describe("calculateFixedVsVariable", () => {
    it("categorizes expenses as fixed or variable", () => {
      const result = calculateFixedVsVariable(baseTransactions, {});
      expect(result).toBeDefined();
      expect(typeof result.fixed).toBe("number");
      expect(typeof result.variable).toBe("number");
      expect(typeof result.fixedPercent).toBe("number");
      expect(typeof result.variablePercent).toBe("number");
    });

    it("correctly categorizes known fixed categories", () => {
      const txns: Transaction[] = [
        {
          id: "f-1",
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
          id: "v-1",
          date: "2026-03-02",
          merchant: "Grocery",
          amount: 200,
          categoryId: "cat-food",
          type: "expense",
          accountId: "acct-checking",
          importedAt: "2026-03-02",
          createdAt: "2026-03-02",
        },
      ];
      const result = calculateFixedVsVariable(txns, {});
      expect(result.fixed).toBe(1200);
      expect(result.variable).toBe(200);
    });
  });

  describe("calculateBudgetVsActual", () => {
    it("compares budgeted vs actual spending", () => {
      const budgets: Record<string, number> = {
        "cat-housing": 1000,
        "cat-food": 300,
      };
      const result = calculateBudgetVsActual(baseTransactions, { budgets });
      expect(result).toBeDefined();
      expect(Array.isArray(result.comparison)).toBe(true);
      expect(typeof result.totalBudgeted).toBe("number");
      expect(typeof result.totalActual).toBe("number");
      expect(typeof result.totalVariance).toBe("number");
    });
  });

  describe("calculateIncomeStability", () => {
    it("calculates income statistics over time", () => {
      const result = calculateIncomeStability(baseTransactions, {});
      expect(result).toBeDefined();
      expect(typeof result.meanMonthlyIncome).toBe("number");
      expect(typeof result.stdDev).toBe("number");
      expect(typeof result.coefficientOfVariation).toBe("number");
      expect(typeof result.p25MonthlyIncome).toBe("number");
    });
  });

  describe("calculateNetWorthTrend", () => {
    it("calculates net worth trend over time", () => {
      const result = calculateNetWorthTrend(baseTransactions, {});
      expect(result).toBeDefined();
      expect(Array.isArray(result.monthlyNetWorth)).toBe(true);
      expect(typeof result.currentNetWorth).toBe("number");
      expect(typeof result.trend).toBe("number");
    });
  });

  describe("calculateGoalProgress", () => {
    it("calculates goal progress", () => {
      const goals = [
        {
          id: "g1",
          name: "Emergency Fund",
          targetAmount: 10000,
          currentAmount: 5000,
        },
        {
          id: "g2",
          name: "Vacation",
          targetAmount: 5000,
          currentAmount: 2000,
        },
      ];
      const result = calculateGoalProgress(baseTransactions, {}, goals);
      expect(result).toBeDefined();
      expect(result.goals).toHaveLength(2);
      expect(result.goals[0].percent).toBe(50);
      expect(result.goals[1].percent).toBe(40);
      expect(typeof result.averageProgress).toBe("number");
      expect(result.completedGoals).toBe(0);
    });

    it("handles empty goals", () => {
      const result = calculateGoalProgress(baseTransactions, {}, []);
      expect(result).toEqual({
        goals: [],
        totalTarget: 0,
        totalSaved: 0,
        averageProgress: 0,
        completedGoals: 0,
      });
    });
  });
});
