import { TransactionList } from "./TransactionList/TransactionList";
import { SpendingSummary } from "./SpendingSummary/SpendingSummary";
import { SpendingByCategory } from "./SpendingByCategory/SpendingByCategory";
import { Trends } from "./Trends/Trends";
import { useBudget } from "../../app/providers/BudgetProvider";
import { useDashboardContext } from "../../app/providers/DashboardProvider";

export function DashboardPage() {
  const { categories } = useBudget();
  const { bounds, filteredTransactions } = useDashboardContext();

  return (
    <>
      {/* Spending Summary - Mobile optimized */}
      <div className="mb-6">
        <SpendingSummary transactions={filteredTransactions} />
      </div>

      {/* Charts - Mobile: stacked, Desktop: 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
