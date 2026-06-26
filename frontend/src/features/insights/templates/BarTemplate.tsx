import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../../shared/lib/format";

const formatCurrencyValue = (value: number) => formatCurrency(value);

export interface BarTemplateProps {
  data: Array<{ [key: string]: unknown }>;
  series: Array<{ key: string; color: string; label: string }>;
  xAxisKey: string;
  layout?: "horizontal" | "vertical";
  height?: number | string;
  minCategoryAxisWidth?: number;
  maxCategoryAxisWidth?: number;
}

export function BarTemplate({
  data,
  series,
  xAxisKey,
  layout = "horizontal",
  height = 300,
  minCategoryAxisWidth = 72,
  maxCategoryAxisWidth = 180,
}: BarTemplateProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  const isHorizontal = layout === "horizontal";
  const maxCategoryLabelLength = useMemo(() => {
    if (isHorizontal) {
      return 0;
    }

    return data.reduce((max, row) => {
      const rawValue = row[xAxisKey];
      const label = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
      return Math.max(max, label.length);
    }, 0);
  }, [data, isHorizontal, xAxisKey]);

  const categoryAxisWidth = isHorizontal
    ? undefined
    : Math.min(
        maxCategoryAxisWidth,
        Math.max(minCategoryAxisWidth, maxCategoryLabelLength * 7 + 16),
      );

  const margins = isHorizontal
    ? { top: 20, right: 20, left: 12, bottom: 52 }
    : { top: 16, right: 16, left: 8, bottom: 12 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={margins}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-gray-200/60"
        />
        <XAxis
          type={isHorizontal ? "category" : "number"}
          dataKey={isHorizontal ? xAxisKey : undefined}
          angle={isHorizontal ? -45 : undefined}
          textAnchor={isHorizontal ? "end" : undefined}
          height={isHorizontal ? 60 : undefined}
          tickFormatter={isHorizontal ? undefined : formatCurrencyValue}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          domain={
            isHorizontal
              ? undefined
              : [
                  (dataMin: number) => Math.min(0, dataMin),
                  (dataMax: number) => Math.max(0, dataMax),
                ]
          }
        />
        <YAxis
          type={isHorizontal ? "number" : "category"}
          dataKey={isHorizontal ? undefined : xAxisKey}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickFormatter={isHorizontal ? formatCurrencyValue : undefined}
          width={categoryAxisWidth}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(229, 231, 235, 0.6)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
          itemStyle={{ color: "#374151", fontSize: "12px" }}
        />
        <Legend
          iconType="square"
          verticalAlign="bottom"
          wrapperStyle={{ fontSize: "12px", color: "#6b7280", paddingTop: "12px" }}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            name={s.label}
            radius={isHorizontal ? [4, 4, 0, 0] : [0, 4, 4, 0]}
            barSize={isHorizontal ? 16 : 24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
