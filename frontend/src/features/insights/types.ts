import { DateRangeSelection } from "../date-range/model/dateRange";
import { Transaction, TransactionType } from "../../types";
import type { AggregationOptions as TransactionAggregationOptions } from "../transactions/aggregations";

export type TemplateName = "line" | "bar" | "pie" | "summary" | "category-average";
export type { TransactionType };

export type AggregationOptions = TransactionAggregationOptions;

export interface WidgetDefinitionDisplay {
  xAxisKey?: string;
  layout?: "horizontal" | "vertical";
  series?: Array<{ key: string; color: string; label: string }>;
  dataKey?: string;
  nameKey?: string;
  // Summary template specific
  keys?: string[];
  labels?: Record<string, string>;
}

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  template: TemplateName;
  aggregate: (transactions: Transaction[], options: AggregationOptions) => unknown;
  display: WidgetDefinitionDisplay;
  gridSpan?: {
    md?: 1 | 2 | 3;
    lg?: 1 | 2 | 3;
    rowMd?: 1 | 2 | 3;
    rowLg?: 1 | 2 | 3;
  };
  defaultFilters: {
    dateRange: DateRangeSelection;
  };
  aggregationDefaults?: Partial<AggregationOptions>;
}

export interface WidgetInstanceGridSpan {
  md?: 1 | 2 | 3;
  lg?: 1 | 2 | 3;
  rowMd?: 1 | 2 | 3;
  rowLg?: 1 | 2 | 3;
}

export interface WidgetInstance {
  id: string;
  type: string;
  title?: string;
  description?: string;
  gridSpan?: WidgetInstanceGridSpan;
  filters?: {
    dateRange?: DateRangeSelection;
    categories?: string[];
    accounts?: string[];
    types?: TransactionType[];
    budgets?: Record<string, number>; // category -> budgeted amount
    fixedCategories?: string[]; // categories classified as fixed costs
    variableCategories?: string[]; // categories classified as variable spending
  };
}
