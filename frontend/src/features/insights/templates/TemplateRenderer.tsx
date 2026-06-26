import { WidgetDefinition, WidgetInstance } from "../types";
import { LineTemplate, LineTemplateProps } from "./LineTemplate";
import { BarTemplate, BarTemplateProps } from "./BarTemplate";
import { PieTemplate, PieTemplateProps } from "./PieTemplate";
import { SummaryTemplate, SummaryTemplateProps } from "./SummaryTemplate";
import {
  CategoryAverageTemplate,
  CategoryAverageTemplateProps,
} from "./CategoryAverageTemplate";

// Re-export template props types for convenience
export type {
  LineTemplateProps,
  BarTemplateProps,
  PieTemplateProps,
  SummaryTemplateProps,
  CategoryAverageTemplateProps,
};

// Calculate height based on row span (base height * number of rows)
const ROW_HEIGHT_PX = 200;

interface TemplateRendererProps {
  definition: WidgetDefinition;
  data: unknown;
  instance: WidgetInstance;
  categories?: Array<{ id: string; name: string; color: string }>;
}

const DYNAMIC_SERIES_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#eab308",
  "#ec4899",
];

function resolveBarSeries(
  definition: WidgetDefinition,
  data: unknown,
): BarTemplateProps["series"] {
  if (definition.display.series && definition.display.series.length > 0) {
    return definition.display.series;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const xAxisKey = definition.display.xAxisKey;
  const keys = new Set<string>();

  data.forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.entries(row).forEach(([key, value]) => {
      if (key === xAxisKey) return;
      if (typeof value === "number" && Number.isFinite(value)) {
        keys.add(key);
      }
    });
  });

  return Array.from(keys).map((key, index) => ({
    key,
    label: key,
    color: DYNAMIC_SERIES_COLORS[index % DYNAMIC_SERIES_COLORS.length],
  }));
}

// Calculate height based on row span
function calculateHeight(instance: WidgetInstance, definition: WidgetDefinition): number | string {
  // Merge definition gridSpan with instance overrides (instance takes precedence)
  const mergedGridSpan = {
    ...definition.gridSpan,
    ...instance.gridSpan,
  };

  const rowSpan = mergedGridSpan.rowLg ?? mergedGridSpan.rowMd ?? 1;
  return rowSpan * ROW_HEIGHT_PX;
}

export function TemplateRenderer({
  definition,
  data,
  instance,
  categories = [],
}: TemplateRendererProps) {
  const height = calculateHeight(instance, definition);

  switch (definition.template) {
    case "line":
      return (
        <LineTemplate
          data={data as Array<Record<string, unknown>>}
          series={definition.display.series ?? []}
          xAxisKey={definition.display.xAxisKey ?? ""}
          height={height}
        />
      );
    case "bar":
      return (
        <BarTemplate
          data={data as Array<Record<string, unknown>>}
          series={resolveBarSeries(definition, data)}
          xAxisKey={definition.display.xAxisKey ?? ""}
          layout={definition.display.layout ?? "horizontal"}
          height={height}
        />
      );
    case "pie":
      return (
        <PieTemplate
          data={data as Array<Record<string, unknown>>}
          dataKey={definition.display.dataKey ?? ""}
          nameKey={definition.display.nameKey ?? ""}
          height={height}
        />
      );
    case "summary":
      return (
        <SummaryTemplate
          data={data as SummaryTemplateProps["data"]}
          keys={definition.display.keys}
          labels={definition.display.labels}
        />
      );
    case "category-average":
      return (
        <CategoryAverageTemplate
          data={data as CategoryAverageTemplateProps["data"]}
          categories={categories}
          height={height}
        />
      );
    default:
      return (
        <div className="p-8 text-center text-gray-500">
          Unknown template type: {(definition as any).template}
        </div>
      );
  }
}
