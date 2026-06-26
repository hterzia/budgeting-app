import { useState, useRef, useEffect } from "react";
import { DateRangeSelector } from "../../../shared/ui/DateRangeSelector";
import { useDashboardContext } from "../../../app/providers/DashboardProvider";
import { useBudget } from "../../../app/providers/BudgetProvider";
import type { Account } from "../../../types";

interface Props {
  accounts: Account[];
}

function accountTypeLabel(type: Account["type"]): string {
  switch (type) {
    case "checking":
      return "Checking";
    case "savings":
      return "Savings";
    case "credit_card":
      return "Credit Card";
    default:
      return type;
  }
}

export function DashboardSubheader({ accounts }: Props) {
  const {
    dateRange,
    setDateRange,
    selectedAccountIds,
    setSelectedAccountIds,
    selectedCategoryIds,
    setSelectedCategoryIds,
  } = useDashboardContext();
  const { categories } = useBudget();

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev: string[]) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev: string[]) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectAllAccounts = () => setSelectedAccountIds([]);
  const selectAllCategories = () => setSelectedCategoryIds([]);

  const selectedAccounts = accounts.filter((acc) => selectedAccountIds.includes(acc.id));
  const selectedCategories = categories.filter((cat) => selectedCategoryIds.includes(cat.id));

  const hasCustomAccountSelection = selectedAccountIds.length > 0;
  const hasCustomCategorySelection = selectedCategoryIds.length > 0;

  return (
    <div className="mb-8 rounded-2xl border border-gray-900/10 bg-white px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Account filter */}
          <div className="relative" ref={accountDropdownRef}>
            <button
              id="dashboard-account-filter"
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className={`flex min-w-[160px] items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                hasCustomAccountSelection
                  ? "border-amber-300 bg-amber-50/50 text-amber-800 hover:border-amber-400"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <span className="truncate">
                {hasCustomAccountSelection
                  ? `${selectedAccounts.length} account${selectedAccounts.length !== 1 ? "s" : ""}`
                  : "All Accounts"}
              </span>
              <svg
                className={`ml-2 h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                  isAccountDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isAccountDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-4 ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Select Accounts
                  </span>
                  <button
                    onClick={selectAllAccounts}
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                  >
                    All Accounts
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {accounts.map((account) => {
                    const isSelected = selectedAccountIds.includes(account.id);
                    return (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                              isSelected
                                ? "border-amber-600 bg-amber-600"
                                : "border-gray-300 bg-white group-hover:border-amber-400"
                            }`}
                          >
                            {isSelected && (
                              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                              {account.name}
                            </span>
                            <span className="text-xs text-gray-500">{accountTypeLabel(account.type)}</span>
                          </div>
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleAccount(account.id)} className="hidden" />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Category filter */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              id="dashboard-category-filter"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className={`flex min-w-[160px] items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                hasCustomCategorySelection
                  ? "border-amber-300 bg-amber-50/50 text-amber-800 hover:border-amber-400"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <span className="truncate">
                {hasCustomCategorySelection
                  ? `${selectedCategories.length} categor${selectedCategories.length !== 1 ? "ies" : "y"}`
                  : "All Categories"}
              </span>
              <svg
                className={`ml-2 h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                  isCategoryDropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-4 ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Select Categories
                  </span>
                  <button
                    onClick={selectAllCategories}
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                  >
                    All Categories
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {categories.map((category) => {
                    const isSelected = selectedCategoryIds.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                              isSelected
                                ? "border-amber-600 bg-amber-600"
                                : "border-gray-300 bg-white group-hover:border-amber-400"
                            }`}
                          >
                            {isSelected && (
                              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className={`text-sm font-medium ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                              {category.name}
                            </span>
                          </div>
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleCategory(category.id)} className="hidden" />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active filter chips with amber styling */}
          {selectedAccounts.map((account) => (
            <span
              key={account.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-100 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {account.name}
              <button
                onClick={() => toggleAccount(account.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-amber-100 hover:text-amber-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-100 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
              {category.name}
              <button
                onClick={() => toggleCategory(category.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-amber-100 hover:text-amber-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>

        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>
    </div>
  );
}
