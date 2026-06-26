import { TransactionList } from "../../features/dashboard/TransactionList/TransactionList";
import { SpendingSummary } from "../../features/dashboard/SpendingSummary/SpendingSummary";
import { SpendingByCategory } from "../../features/dashboard/SpendingByCategory/SpendingByCategory";
import { Trends } from "../../features/dashboard/Trends/Trends";
import { DashboardSubheader } from "../../features/dashboard/DashboardSubheader/DashboardSubheader";
import { useBudget } from "../../app/providers/BudgetProvider";
import { useDashboardContext } from "../../app/providers/DashboardProvider";

export function OverviewPage() {
  const { categories, accounts } = useBudget();
  const { bounds, filteredTransactions } = useDashboardContext();

  return (
    <>
      <DashboardSubheader accounts={accounts} />

      <div className="mb-10">
        <SpendingSummary transactions={filteredTransactions} />
      </div>

      <div className="grid grid-cols-1 gap-8 mb-10 lg:grid-cols-2">
        <SpendingByCategory
          transactions={filteredTransactions}
          categories={categories}
        />
        <Trends transactions={filteredTransactions} bounds={bounds} />
      </div>

      <div>
        <div className="mb-8 flex items-center gap-6">
          <h2 className="text-3xl font-serif text-gray-900">Transactions</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-gray-200 via-gray-200/50 to-transparent" />
        </div>
        <TransactionList
          transactions={filteredTransactions}
          categories={categories}
        />
      </div>
    </>
  );
}
