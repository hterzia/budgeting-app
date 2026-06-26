import { useMemo } from "react";
import { AggregationOptions, WidgetInstance } from "./types";
import { WIDGET_REGISTRY } from "./registry";
import {
  getRangeBounds,
  presetSelection,
} from "../date-range/model/dateRange";
import { useBudget } from "../../app/providers/BudgetProvider";

export function useWidgetData(instance: WidgetInstance) {
  const { transactions, categories } = useBudget();
  const definition = WIDGET_REGISTRY[instance.type];

  // Get date range from instance filters or use definition's default
  const dateRange =
    instance.filters?.dateRange ??
    definition?.defaultFilters.dateRange ??
    presetSelection("currentMonth");
  const bounds = getRangeBounds(dateRange);

  // Create primitive keys for stable memoization (not object references)
  const boundsKey = `${bounds.start.getTime()}-${bounds.end.getTime()}`;
  // Use empty array string for empty arrays to ensure stable keys
  const categoriesKey = instance.filters?.categories?.length
    ? instance.filters.categories.join(",")
    : "_empty_";
  const accountsKey = instance.filters?.accounts?.length
    ? instance.filters.accounts.join(",")
    : "_empty_";
  const typesKey = instance.filters?.types?.length
    ? instance.filters.types.join(",")
    : "_empty_";
  const fixedCategoriesKey = instance.filters?.fixedCategories?.length
    ? instance.filters.fixedCategories.join(",")
    : "_empty_";
  const variableCategoriesKey = instance.filters?.variableCategories?.length
    ? instance.filters.variableCategories.join(",")
    : "_empty_";
  const categoryNamesKey = categories.length
    ? categories.map((c) => `${c.id}:${c.name}`).join(",")
    : "_empty_";

  return useMemo(() => {
    if (!definition) {
      return [];
    }

    const options: AggregationOptions = {
      ...definition.aggregationDefaults,
      bounds,
      categories: instance.filters?.categories,
      accounts: instance.filters?.accounts,
      types: instance.filters?.types,
      budgets: instance.filters?.budgets,
      fixedCategories: instance.filters?.fixedCategories,
      variableCategories: instance.filters?.variableCategories,
    };
    const aggregated = definition.aggregate(transactions ?? [], options);
    const categoryNameById = new Map(
      categories.map((category) => [category.id, category.name]),
    );

    // Category aggregations return category IDs; map them to display names for charts.
    const mapsCategoryNames =
      instance.type === "category_pie" ||
      definition.display.xAxisKey === "category";
    if (mapsCategoryNames && Array.isArray(aggregated)) {
      return aggregated.map((row) => {
        const categoryId = typeof row?.category === "string" ? row.category : "";
        const categoryName = categoryNameById.get(categoryId) ?? categoryId;
        return {
          ...row,
          category: categoryName,
        };
      });
    }

    return aggregated;
  }, [
    transactions,
    categoryNamesKey,
    boundsKey,
    categoriesKey,
    accountsKey,
    typesKey,
    fixedCategoriesKey,
    variableCategoriesKey,
    instance.type,
    definition?.aggregate,
    definition,
  ]);
}

// Custom hook to get a widget's title (either instance override or definition label)
export function useWidgetTitle(instance: WidgetInstance): string {
  const definition = WIDGET_REGISTRY[instance.type];
  return instance.title ?? definition?.label ?? "Unknown Widget";
}
