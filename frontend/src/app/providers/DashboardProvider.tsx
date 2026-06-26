import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DateRangeSelection,
  getRangeBounds,
  presetSelection,
} from "../../features/date-range/model/dateRange";
import { useBudget } from "./BudgetProvider";
import { filterTransactions } from "../../features/transactions/aggregations";
import type { Transaction } from "../../types";
import type { DateRangeBounds } from "../../features/date-range/model/dateRange";

interface DashboardContextValue {
  dateRange: DateRangeSelection;
  setDateRange: (range: DateRangeSelection) => void;
  selectedAccountIds: string[];
  setSelectedAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCategoryIds: string[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
  bounds: DateRangeBounds;
  filteredTransactions: Transaction[];
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardContext must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(
    presetSelection("currentMonth")
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const { transactions, accounts } = useBudget();

  const bounds = useMemo(() => {
    return getRangeBounds(dateRange);
  }, [dateRange]);

  const filteredTransactions = useMemo(() => {
    const accountsToFilter = selectedAccountIds.length > 0
      ? selectedAccountIds
      : accounts.map(a => a.id);
    return filterTransactions(transactions, {
      bounds,
      accounts: accountsToFilter,
      // Empty selection = no filter (show all)
      categories: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      excludeIgnored: false,
    });
  }, [transactions, bounds, selectedAccountIds, accounts, selectedCategoryIds]);

  return (
    <DashboardContext.Provider
      value={{
        dateRange,
        setDateRange,
        selectedAccountIds,
        setSelectedAccountIds,
        selectedCategoryIds,
        setSelectedCategoryIds,
        bounds,
        filteredTransactions,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
