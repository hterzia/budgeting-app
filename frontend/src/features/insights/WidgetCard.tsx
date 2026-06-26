import { useState } from "react";
import { WidgetInstance, WidgetDefinition } from "./types";
import { useWidgetTitle, useWidgetData } from "./useWidgetData";
import { TemplateRenderer } from "./templates/TemplateRenderer";
import { Card } from "../../shared/ui/Card";
import { DateRangeSelector } from "../../shared/ui/DateRangeSelector";
import { useBudget } from "../../app/providers/BudgetProvider";
import { Modal } from "../../shared/ui/Modal";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { FilterPill } from "../../shared/ui/FilterPill";
import { WidgetConfigurationModal } from "./WidgetConfigurationModal";
import clsx from "clsx";

const WIDGET_FILTER_TYPES = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
] as const;

export interface WidgetCardProps {
  instance: WidgetInstance;
  definition: WidgetDefinition;
  onRemove: () => void;
  onFilterChange: (updates: Partial<WidgetInstance["filters"]>) => void;
  onConfigChange: (updates: Partial<Pick<WidgetInstance, "title" | "description" | "gridSpan">>) => void;
  className?: string;
}

export function WidgetCard({
  instance,
  definition,
  onRemove,
  onFilterChange,
  onConfigChange,
  className,
}: WidgetCardProps) {
  const title = useWidgetTitle(instance);
  const { categories, accounts } = useBudget();
  const data = useWidgetData(instance);

  // Get current date range for display
  const currentDateRange =
    instance.filters?.dateRange || definition.defaultFilters.dateRange;

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Derived state for active filters
  const activeCategories = instance.filters?.categories ?? [];
  const activeAccounts = instance.filters?.accounts ?? [];
  const activeTypes = instance.filters?.types ?? [];
  const activeFixedCategories = instance.filters?.fixedCategories ?? [];
  const activeVariableCategories = instance.filters?.variableCategories ?? [];
  const budgets = instance.filters?.budgets ?? {};

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = activeCategories.includes(categoryId)
      ? activeCategories.filter((id) => id !== categoryId)
      : [...activeCategories, categoryId];
    onFilterChange({ categories: newCategories });
  };

  const handleAccountToggle = (accountId: string) => {
    const newAccounts = activeAccounts.includes(accountId)
      ? activeAccounts.filter((id) => id !== accountId)
      : [...activeAccounts, accountId];
    onFilterChange({ accounts: newAccounts });
  };

  const handleTypeToggle = (
    type: typeof WIDGET_FILTER_TYPES[number]["value"]
  ) => {
    const newTypes = activeTypes.includes(type)
      ? activeTypes.filter((t) => t !== type)
      : [...activeTypes, type];
    onFilterChange({ types: newTypes });
  };

  const handleDateRangeChange = (dateRange: typeof currentDateRange) => {
    onFilterChange({ dateRange });
  };

  const handleFixedCategoryToggle = (categoryId: string) => {
    const newCategories = activeFixedCategories.includes(categoryId)
      ? activeFixedCategories.filter((id) => id !== categoryId)
      : [...activeFixedCategories, categoryId];
    onFilterChange({ fixedCategories: newCategories });
  };

  const handleVariableCategoryToggle = (categoryId: string) => {
    const newCategories = activeVariableCategories.includes(categoryId)
      ? activeVariableCategories.filter((id) => id !== categoryId)
      : [...activeVariableCategories, categoryId];
    onFilterChange({ variableCategories: newCategories });
  };

  const handleBudgetUpdate = (categoryId: string, amount: number) => {
    onFilterChange({
      budgets: {
        ...(instance.filters?.budgets ?? {}),
        [categoryId]: amount,
      },
    });
  };

  const handleResetFilters = () => {
    onFilterChange({
      dateRange: definition.defaultFilters.dateRange,
      categories: [],
      accounts: [],
      types: [],
      fixedCategories: [],
      variableCategories: [],
      budgets: {},
    });
  };

  const hasActiveFilters =
    activeCategories.length > 0 ||
    activeAccounts.length > 0 ||
    activeTypes.length > 0 ||
    Object.keys(budgets).length > 0;

  return (
    <>
      <Card className={clsx("flex flex-col h-full overflow-hidden", className)}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-900/10 bg-gradient-to-br from-white to-gray-50/50">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-serif text-gray-900 leading-tight mb-1">{title}</h3>
              <p className="text-xs tracking-widest text-gray-500 uppercase font-medium">
                {instance.description ?? definition.description}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-bold">
                  {activeCategories.length +
                    activeAccounts.length +
                    activeTypes.length +
                    Object.keys(budgets).length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50/50 transition-all duration-200 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border border-amber-200/50 hover:border-amber-300 flex items-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span className="hidden sm:inline">Filters</span>
              </button>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="text-gray-500 hover:text-amber-700 hover:bg-amber-50/50 transition-all duration-200 p-2 sm:p-2.5 rounded-lg border border-transparent hover:border-amber-100"
                title="Configure widget"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM14 13a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 012-2h12zM2 11a2 2 0 012-2h12a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1zM2 17a2 2 0 012-2h12a2 2 0 012 2v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="text-gray-400 hover:text-red-700 hover:bg-red-50/50 transition-all duration-200 p-2 sm:p-2.5 rounded-lg border border-transparent hover:border-red-100"
                title="Remove widget"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto">
          <WidgetErrorBoundary>
            <div className="h-full">
              <TemplateRenderer definition={definition} data={data} instance={instance} categories={categories} />
            </div>
          </WidgetErrorBoundary>
        </div>
      </Card>

      {/* Filters Modal */}
      <Modal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Widget Filters"
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-serif text-gray-900 mb-2">
              Date Range
            </label>
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-200">
              <DateRangeSelector
                value={currentDateRange}
                onChange={handleDateRangeChange}
                allowCustom={true}
              />
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-serif text-gray-900 mb-2">
                Categories
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const isSelected = activeCategories.includes(cat.id);
                  return (
                    <FilterPill
                      key={cat.id}
                      label={cat.name}
                      selected={isSelected}
                      onClick={() => handleCategoryToggle(cat.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Accounts */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-serif text-gray-900 mb-2">
                Accounts
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {accounts.map((acct) => {
                  const isSelected = activeAccounts.includes(acct.id);
                  return (
                    <FilterPill
                      key={acct.id}
                      label={acct.name}
                      selected={isSelected}
                      onClick={() => handleAccountToggle(acct.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Types */}
          <div>
            <label className="block text-sm font-serif text-gray-900 mb-2">
              Transaction Types
            </label>
            <div className="flex flex-wrap gap-2">
              {WIDGET_FILTER_TYPES.map((typeOption) => {
                const isSelected = activeTypes.includes(typeOption.value);
                return (
                  <FilterPill
                    key={typeOption.value}
                    label={typeOption.label}
                    selected={isSelected}
                    onClick={() => handleTypeToggle(typeOption.value)}
                  />
                );
              })}
            </div>
          </div>

          {/* Advanced Filters - Only show for relevant widgets */}
          {(instance.type === "fixed_vs_variable" ||
            instance.type === "budget_vs_actual" ||
            instance.type === "emergency_runway") && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              {/* Fixed vs Variable Categories */}
              {(instance.type === "fixed_vs_variable" ||
                instance.type === "emergency_runway") && (
                <div>
                  <label className="block text-sm font-serif text-gray-900 mb-2">
                    Fixed Categories
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      (housing, utilities, insurance, debt)
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories.map((cat) => {
                      const isSelected = activeFixedCategories.includes(cat.id);
                      return (
                        <FilterPill
                          key={cat.id}
                          label={cat.name}
                          selected={isSelected}
                          onClick={() => handleFixedCategoryToggle(cat.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {instance.type === "fixed_vs_variable" && (
                <div>
                  <label className="block text-sm font-serif text-gray-900 mb-2">
                    Variable Categories
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      (food, entertainment, shopping)
                    </span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories.map((cat) => {
                      const isSelected = activeVariableCategories.includes(cat.id);
                      return (
                        <FilterPill
                          key={cat.id}
                          label={cat.name}
                          selected={isSelected}
                          onClick={() => handleVariableCategoryToggle(cat.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Budget Input for Budget vs Actual */}
              {instance.type === "budget_vs_actual" && (
                <div>
                  <label className="block text-sm font-serif text-gray-900 mb-2">
                    Budget Amounts by Category
                  </label>
                  <div className="space-y-3">
                    {categories
                      .filter(
                        (cat) =>
                          activeCategories.length === 0 ||
                          activeCategories.includes(cat.id)
                      )
                      .map((cat) => {
                        const budgetValue = budgets[cat.id] ?? 0;
                        return (
                          <div
                            key={cat.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
                          >
                            <span className="text-sm font-medium text-gray-700 w-1/3">
                              {cat.name}
                            </span>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1.5 text-gray-400">
                                $
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                className="w-full pl-7 pr-3 py-2 rounded-lg border-gray-300 focus:border-amber-500 focus:ring-amber-500/20 sm:text-sm"
                                placeholder="Budget amount"
                                value={budgetValue}
                                onChange={(e) => {
                                  const newBudget =
                                    e.target.value === ""
                                      ? 0
                                      : parseInt(e.target.value, 10);
                                  handleBudgetUpdate(cat.id, newBudget);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {categories.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No categories available. Add categories first.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-sm font-medium text-gray-600 hover:text-amber-700 hover:bg-amber-50/50 px-4 py-2 rounded-lg transition-colors"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="bg-amber-700 text-white px-6 py-2 rounded-lg hover:bg-amber-800 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>

      {/* Widget Configuration Modal */}
      <WidgetConfigurationModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        widgetType={instance.type}
        currentTitle={instance.title}
        currentDescription={instance.description}
        currentGridSpan={instance.gridSpan}
        onSave={onConfigChange}
      />
    </>
  );
}
